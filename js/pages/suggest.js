import { fetchRecipes } from "../recipes.js";
import { suggestRecipes, suggestWeeklyPlan } from "../suggest.js";
import { computeTargetServings, scaleAmount } from "../quantity.js";
import { nameMatches } from "../textMatch.js";

function findConsumedIngredientIds(usedIngredients, ingredients) {
  const names = new Set(usedIngredients.map((u) => u.name));
  return ingredients.filter((i) => names.has(i.name)).map((i) => i.id);
}

function renderModeCard(store, rerender) {
  const settings = store.getSettings();
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h2>提案モード</h2>
    <div class="mode-toggle">
      <button class="mode-btn ${settings.planMode === "day" ? "active" : ""}" data-mode="day">今日の提案</button>
      <button class="mode-btn ${settings.planMode === "week" ? "active" : ""}" data-mode="week">1週間の献立プラン</button>
    </div>
    ${
      settings.planMode === "week"
        ? `<div class="field-group" style="margin-top:10px;max-width:220px;">
             <label class="field-label" for="week-days">週に自炊する日数</label>
             <input type="number" id="week-days" min="1" max="7" value="${settings.weeklyCookDays}" />
           </div>`
        : ""
    }
  `;

  card.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      store.setSettings({ ...store.getSettings(), planMode: btn.dataset.mode });
      rerender();
    });
  });

  const daysInput = card.querySelector("#week-days");
  if (daysInput) {
    daysInput.addEventListener("change", () => {
      const days = Math.min(7, Math.max(1, Number(daysInput.value) || 1));
      store.setSettings({ ...store.getSettings(), weeklyCookDays: days });
      rerender();
    });
  }

  return card;
}

function renderRecipeCard({ recipe, reasons, usedIngredients }, { store, rerender, label }) {
  const profile = store.getProfile();
  const targetServings = computeTargetServings(profile);
  const factor = targetServings ? targetServings / recipe.servings : 1;
  const servingsLabel = targetServings ? `${targetServings}人前の目安` : `${recipe.servings}人前（基準）`;

  const card = document.createElement("div");
  card.className = "card recipe-card";
  card.innerHTML = `
    ${label ? `<div class="badge ok" style="margin-bottom:6px;">${label}</div>` : ""}
    <h3>${recipe.name}</h3>
    <div class="tag-list">
      <span class="tag">${recipe.genre}</span>
      ${recipe.tags.map((t) => `<span class="tag">${t}</span>`).join("")}
      <span class="tag">${servingsLabel}</span>
    </div>
    <ul class="reason-list">
      ${reasons.map((r) => `<li>${r}</li>`).join("")}
    </ul>
    ${
      !targetServings
        ? `<p class="item-sub">※「家族・好み」で家族構成を登録すると人数に合わせた分量が表示されます</p>`
        : ""
    }
    <details>
      <summary>材料と分量を見る</summary>
      <ul class="steps">
        ${recipe.ingredients
          .map((ing) => `<li>${ing.name} ${scaleAmount(ing.amount, factor)}</li>`)
          .join("")}
      </ul>
    </details>
    <details>
      <summary>作り方を見る</summary>
      <ol class="steps">
        ${recipe.steps.map((s) => `<li>${s}</li>`).join("")}
      </ol>
    </details>
    <div class="recipe-actions">
      <button class="primary" data-action="cooked">作った</button>
      <button class="secondary" data-action="shopping">不足食材を買い物リストに追加</button>
      <button class="secondary" data-action="skip">今回は作らない</button>
    </div>
  `;

  card.querySelector('[data-action="cooked"]').addEventListener("click", () => {
    const currentIngredients = store.getIngredients();
    const consumedIds = findConsumedIngredientIds(usedIngredients, currentIngredients);
    const remaining = currentIngredients.filter((i) => !consumedIds.includes(i.id));
    store.setIngredients(remaining);

    const history = store.getHistory();
    history.push({
      id: store.uid(),
      date: new Date().toISOString(),
      recipeId: recipe.id,
      recipeName: recipe.name,
      genre: recipe.genre,
      cooked: true,
      consumedIngredientIds: consumedIds,
    });
    store.setHistory(history);

    alert(`「${recipe.name}」を記録しました。使った食材は在庫から削除されます。`);
    rerender();
  });

  card.querySelector('[data-action="shopping"]').addEventListener("click", () => {
    const currentIngredients = store.getIngredients();
    const missingIngredients = recipe.ingredients.filter(
      (ing) => !currentIngredients.some((i) => nameMatches(i.name, ing.name))
    );
    if (missingIngredients.length === 0) {
      alert("必要な食材はすべて在庫にあります");
      return;
    }
    const existingNames = new Set(store.getShoppingList().map((i) => i.name));
    const additions = missingIngredients
      .filter((ing) => !existingNames.has(ing.name))
      .map((ing) => ({
        id: store.uid(),
        name: ing.name,
        reason: `「${recipe.name}」に使用`,
        checked: false,
      }));
    if (additions.length === 0) {
      alert("不足食材はすでに買い物リストにあります");
      return;
    }
    store.setShoppingList([...store.getShoppingList(), ...additions]);
    alert(`${additions.length}件を買い物リストに追加しました`);
  });

  card.querySelector('[data-action="skip"]').addEventListener("click", () => {
    card.remove();
  });

  return card;
}

export function renderSuggestPage(container, { store, rerender }) {
  const settings = store.getSettings();

  container.appendChild(renderModeCard(store, rerender));

  const wrap = document.createElement("div");
  wrap.className = "card";
  const title = settings.planMode === "week" ? "1週間の献立プラン" : "今日の献立提案";
  wrap.innerHTML = `<h2>${title}</h2><p class="empty-state">読み込み中…</p>`;
  container.appendChild(wrap);

  (async () => {
    const recipes = await fetchRecipes();
    const ingredients = store.getIngredients();
    const profile = store.getProfile();
    const requests = store.getRequests();
    const history = store.getHistory();

    const results =
      settings.planMode === "week"
        ? suggestWeeklyPlan({ recipes, ingredients, profile, requests, history }, settings.weeklyCookDays)
        : suggestRecipes({ recipes, ingredients, profile, requests, history });

    wrap.innerHTML = "";
    const header = document.createElement("h2");
    header.textContent = title;
    wrap.appendChild(header);

    if (ingredients.length === 0) {
      const hint = document.createElement("p");
      hint.className = "empty-state";
      hint.textContent = "食材を登録すると、期限に合わせた提案が受けられます";
      wrap.appendChild(hint);
    }

    if (results.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "提案できるレシピがありません（アレルギー・苦手食材で全て除外された可能性があります）";
      wrap.appendChild(empty);
    }

    results.forEach((result, idx) => {
      const label = settings.planMode === "week" ? `${idx + 1}食目` : "";
      wrap.appendChild(renderRecipeCard(result, { store, rerender, label }));
    });
  })();
}
