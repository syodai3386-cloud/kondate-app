import { nameMatches, recipeMatchesRequest } from "./textMatch.js";

const RECENT_HISTORY_WINDOW = 5;

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function findInventoryMatch(recipeIngredient, ingredients) {
  const match = ingredients.find((inv) => nameMatches(inv.name, recipeIngredient.name));
  return { match, isStrong: !!match };
}

function urgencyWeight(daysLeft) {
  if (daysLeft < 0) return 0;
  return Math.max(0, 10 - daysLeft);
}

/**
 * 1レシピをスコアリングする。アレルギー・苦手食材に該当する場合はnullを返す。
 */
function scoreRecipe(recipe, { ingredients, profile, requests, recentGenres, weekGenreCounts }) {
  const hasAllergen = recipe.allergens.some((a) => profile.allergies.includes(a));
  if (hasAllergen) return null;

  const hasDisliked = recipe.ingredients.some((ing) =>
    profile.dislikes.some((d) => nameMatches(ing.name, d))
  );
  if (hasDisliked) return null;

  let ingredientScore = 0;
  const usedIngredients = [];
  for (const recipeIng of recipe.ingredients) {
    const { match, isStrong } = findInventoryMatch(recipeIng, ingredients);
    if (!match) continue;
    const daysLeft = daysUntil(match.expiryDate);
    const weight = urgencyWeight(daysLeft) * (isStrong ? 1 : 0.5);
    if (weight > 0) {
      ingredientScore += weight;
      usedIngredients.push({ name: match.name, daysLeft, weight });
    }
  }

  let likesBonus = 0;
  const matchedLikes = profile.likes.filter(
    (like) => nameMatches(recipe.genre, like) || recipe.tags.some((t) => nameMatches(t, like))
  );
  if (matchedLikes.length) likesBonus = 5;

  let requestBonus = 0;
  let matchedRequest = null;
  for (const req of requests || []) {
    if (recipeMatchesRequest(recipe, req)) {
      matchedRequest = req;
      requestBonus = 8;
      break;
    }
  }

  const recentSameGenreCount = recentGenres.filter((g) => g === recipe.genre).length;
  const weekSameGenreCount = weekGenreCounts ? weekGenreCounts[recipe.genre] || 0 : 0;
  const varietyPenalty = recentSameGenreCount * 3 + weekSameGenreCount * 6;

  const total = ingredientScore + likesBonus + requestBonus - varietyPenalty;

  const reasons = [];
  usedIngredients
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .forEach((u) => {
      if (u.daysLeft <= 0) reasons.push(`${u.name}の期限切れ間近`);
      else if (u.daysLeft <= 2) reasons.push(`${u.name}の期限が近い`);
      else reasons.push(`${u.name}を使い切れる`);
    });
  if (matchedRequest) reasons.push(`「${matchedRequest.text}」のリクエストに合致`);
  if (likesBonus) reasons.push(`好みの傾向に合致`);
  if (recentSameGenreCount === 0 && weekSameGenreCount === 0) {
    reasons.push(`最近作っていないジャンルで変化がつく`);
  }

  return { recipe, score: total, reasons, usedIngredients };
}

/**
 * 「今日の提案」：在庫・好み・リクエスト・履歴から上位N件を返す。
 */
export function suggestRecipes({ recipes, ingredients, profile, requests, history }, limit = 5) {
  const recentGenres = history
    .filter((h) => h.cooked)
    .slice(-RECENT_HISTORY_WINDOW)
    .map((h) => h.genre);

  const scored = recipes
    .map((recipe) => scoreRecipe(recipe, { ingredients, profile, requests, recentGenres }))
    .filter(Boolean);

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * 「1週間の献立プラン」：days件を1件ずつ選び、選ぶたびに使った食材を
 * 作業用コピーから取り除き、同じジャンルの連続を避けながらバラエティを確保する。
 */
export function suggestWeeklyPlan({ recipes, ingredients, profile, requests, history }, days) {
  const recentGenres = history
    .filter((h) => h.cooked)
    .slice(-RECENT_HISTORY_WINDOW)
    .map((h) => h.genre);

  let workingIngredients = ingredients.map((i) => ({ ...i }));
  const usedRecipeIds = new Set();
  const weekGenreCounts = {};
  const plan = [];

  for (let day = 0; day < days; day++) {
    const candidates = recipes
      .filter((r) => !usedRecipeIds.has(r.id))
      .map((recipe) =>
        scoreRecipe(recipe, {
          ingredients: workingIngredients,
          profile,
          requests,
          recentGenres,
          weekGenreCounts,
        })
      )
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    const picked = candidates[0];
    if (!picked) break;

    plan.push(picked);
    usedRecipeIds.add(picked.recipe.id);
    weekGenreCounts[picked.recipe.genre] = (weekGenreCounts[picked.recipe.genre] || 0) + 1;

    const consumedNames = new Set(picked.usedIngredients.map((u) => u.name));
    workingIngredients = workingIngredients.filter((i) => !consumedNames.has(i.name));
  }

  return plan;
}
