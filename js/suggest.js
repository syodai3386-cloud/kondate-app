import { nameMatches, recipeMatchesRequest } from "./textMatch.js";

const RECENT_PLAN_WINDOW = 5;

function daysUntil(dateStr) {
  if (!dateStr) return null;
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
  if (daysLeft === null || daysLeft < 0) return 0;
  return Math.max(0, 10 - daysLeft);
}

/**
 * 1レシピをスコアリングする。アレルギー・苦手食材に該当する場合はnullを返す。
 */
function scoreRecipe(recipe, { ingredients, profile, requests, recentGenres }) {
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
  const varietyPenalty = recentSameGenreCount * 3;

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
  if (recentSameGenreCount === 0) {
    reasons.push(`最近作っていないジャンルで変化がつく`);
  }

  return { recipe, score: total, reasons, usedIngredients };
}

/**
 * 指定した日のレシピ提案：在庫・好み・リクエスト・献立予定履歴から上位N件を返す。
 * course が指定されていれば（"all" 以外）そのコース種別のレシピに絞り込む。
 */
export function suggestRecipes({ recipes, ingredients, profile, requests, mealPlans, course }, limit = 5) {
  const recentGenres = (mealPlans || [])
    .slice(-RECENT_PLAN_WINDOW)
    .map((p) => p.genre);

  const candidates =
    course && course !== "all" ? recipes.filter((r) => r.course === course) : recipes;

  const scored = candidates
    .map((recipe) => scoreRecipe(recipe, { ingredients, profile, requests, recentGenres }))
    .filter(Boolean);

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
