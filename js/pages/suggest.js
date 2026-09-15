import { fetchRecipes } from "../recipes.js";
import { suggestRecipes } from "../suggest.js";
import { computeTargetServings, scaleAmount } from "../quantity.js";
import { nameMatches } from "../textMatch.js";

const COURSES = ["all", "主菜", "副菜", "汁物", "主食", "デザート"];
const COURSE_LABELS = { all: "すべて" };
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

// ページ内での表示状態。rerender()のたびにモジュールが作り直されるわけではないので
// ここに保持しておけば週送り・選択日・コース選択が再描画をまたいで維持される。
const viewState = {
  weekOffset: 0,
  selectedDate: toISODate(new Date()),
  selectedCourse: "all",
};

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAY_LABELS[d.getDay()]}）`;
}

function getWeekDates(weekOffset) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function findMatchedInventoryItems(recipeIngredients, currentIngredients) {
  return currentIngredients.filter((item) =>
    recipeIngredients.some((ing) => nameMatches(item.name, ing.name))
  );
}

function renderCalendarCard(store, rerender) {
  const todayStr = toISODate(new Date());
  const mealPlans = store.getMealPlans();
  const weekDates = getWeekDates(viewState.weekOffset);

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h2>献立カレンダー</h2>
    <div class="calendar-nav">
      <button class="secondary" data-nav="prev">＜ 前週</button>
      <button class="secondary" data-nav="next">次週 ＞</button>
    </div>
    <div class="calendar-strip">
      ${weekDates
        .map((d) => {
          const dateStr = toISODate(d);
          const plansForDay = mealPlans.filter((p) => p.date === dateStr);
          const classes = [
            "calendar-day",
            dateStr === viewState.selectedDate ? "active" : "",
            dateStr === todayStr ? "today" : "",
            plansForDay.length > 0 ? "has-plan" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const planLabel =
            plansForDay.length === 0
              ? ""
              : plansForDay.length === 1
              ? plansForDay[0].recipeName
              : `${plansForDay.length}件登録済み`;
          return `
            <button class="${classes}" data-date="${dateStr}">
              <span class="calendar-weekday">${WEEKDAY_LABELS[d.getDay()]}</span>
              <span class="calendar-daynum">${d.getDate()}</span>
              ${planLabel ? `<span class="calendar-plan-name">${planLabel}</span>` : ""}
            </button>
          `;
        })
        .join("")}
    </div>
  `;

  card.querySelector('[data-nav="prev"]').addEventListener("click", () => {
    viewState.weekOffset -= 1;
    rerender();
  });
  card.querySelector('[data-nav="next"]').addEventListener("click", () => {
    viewState.weekOffset += 1;
    rerender();
  });
  card.querySelectorAll(".calendar-day").forEach((btn) => {
    btn.addEventListener("click", () => {
      viewState.selectedDate = btn.dataset.date;
      rerender();
    });
  });

  return card;
}

/**
 * 予定取り消し：作る前の状態に在庫・買い物リストを戻す。
 */
function cancelPlan(plan, { store, rerender }) {
  const currentIngredients = store.getIngredients();
  let updatedIngredients = [...currentIngredients];

  (plan.matchedSnapshots || []).forEach((snap) => {
    const idx = updatedIngredients.findIndex((i) => i.id === snap.id);
    if (snap.leftoverQuantity === null) {
      // 使い切り扱いだった食材：在庫に再登録する
      if (idx === -1) {
        updatedIngredients.push({
          id: snap.id,
          name: snap.name,
          category: snap.category,
          quantity: snap.quantity,
          unit: snap.unit,
          expiryDate: snap.expiryDate,
          registeredAt: new Date().toISOString(),
        });
      }
    } else if (idx !== -1) {
      // 一部残っていた食材：元の数量に戻す
      updatedIngredients[idx] = { ...updatedIngredients[idx], quantity: snap.quantity };
    } else {
      // 手動で削除済みだった場合はスナップショットの内容で復元する
      updatedIngredients.push({
        id: snap.id,
        name: snap.name,
        category: snap.category,
        quantity: snap.quantity,
        unit: snap.unit,
        expiryDate: snap.expiryDate,
        registeredAt: new Date().toISOString(),
      });
    }
  });
  store.setIngredients(updatedIngredients);

  // まだ購入されていない（＝まだリストに残っている）分だけ買い物リストから取り除く
  const shoppingIdsToRemove = new Set(plan.shoppingListIds || []);
  if (shoppingIdsToRemove.size > 0) {
    const nextShoppingList = store.getShoppingList().filter((i) => !shoppingIdsToRemove.has(i.id));
    store.setShoppingList(nextShoppingList);
  }

  store.setMealPlans(store.getMealPlans().filter((p) => p.id !== plan.id));

  alert(`「${plan.recipeName}」の予定を取り消し、在庫・買い物リストを元に戻しました`);
  rerender();
}

function renderPlannedListCard(plans, { store, rerender }) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<h2>${formatDateLabel(viewState.selectedDate)}に作る予定</h2>`;

  plans.forEach((plan) => {
    const row = document.createElement("div");
    row.className = "card recipe-card";
    row.innerHTML = `
      <h3>${plan.recipeName}</h3>
      <div class="tag-list">
        <span class="tag">${plan.genre}</span>
        <span class="tag">${plan.course}</span>
      </div>
      <div class="recipe-actions">
        <button class="secondary" data-action="cancel-plan">予定を取り消す</button>
      </div>
    `;
    row.querySelector('[data-action="cancel-plan"]').addEventListener("click", () => {
      cancelPlan(plan, { store, rerender });
    });
    card.appendChild(row);
  });

  return card;
}

function renderCourseFilterCard(store, rerender) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h2>${formatDateLabel(viewState.selectedDate)}に何を作る？</h2>
    <div class="mode-toggle">
      ${COURSES.map(
        (c) => `
        <button class="mode-btn ${viewState.selectedCourse === c ? "active" : ""}" data-course="${c}">
          ${COURSE_LABELS[c] || c}
        </button>`
      ).join("")}
    </div>
  `;

  card.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      viewState.selectedCourse = btn.dataset.course;
      rerender();
    });
  });

  return card;
}

function renderRecipeCard({ recipe, reasons }, { store, rerender, dateStr }) {
  const profile = store.getProfile();
  const targetServings = computeTargetServings(profile);
  const factor = targetServings ? targetServings / recipe.servings : 1;
  const servingsLabel = targetServings ? `${targetServings}人前の目安` : `${recipe.servings}人前（基準）`;

  const card = document.createElement("div");
  card.className = "card recipe-card";
  card.innerHTML = `
    ${recipe.imageUrl ? `<img src="${recipe.imageUrl}" alt="${recipe.name}" class="recipe-photo" />` : ""}
    <h3>${recipe.name}</h3>
    <div class="tag-list">
      <span class="tag">${recipe.genre}</span>
      <span class="tag">${recipe.course}</span>
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
    ${
      recipe.sourceUrl
        ? `<p class="item-sub"><a href="${recipe.sourceUrl}" target="_blank" rel="noopener">楽天レシピで元のレシピを見る（写真・投稿者コメントなど）</a></p>`
        : ""
    }
    <div class="actions-slot"></div>
  `;

  const actionsSlot = card.querySelector(".actions-slot");

  function commitPlan(matched, leftoverMap) {
    const currentIngredients = store.getIngredients();

    // 更新前のスナップショットを保存しておく（取り消し時の復元に使う）
    const matchedSnapshots = matched.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      expiryDate: item.expiryDate,
      leftoverQuantity: leftoverMap.has(item.id) ? leftoverMap.get(item.id) : null,
    }));

    const matchedIds = new Set(matched.map((m) => m.id));
    const updatedIngredients = currentIngredients
      .filter((i) => !matchedIds.has(i.id) || leftoverMap.has(i.id))
      .map((i) => (leftoverMap.has(i.id) ? { ...i, quantity: leftoverMap.get(i.id) } : i));
    store.setIngredients(updatedIngredients);

    const missingIngredients = recipe.ingredients.filter(
      (ing) => !currentIngredients.some((i) => nameMatches(i.name, ing.name))
    );
    const existingShoppingNames = new Set(store.getShoppingList().map((i) => i.name));
    const shoppingAdditions = missingIngredients
      .filter((ing) => !existingShoppingNames.has(ing.name))
      .map((ing) => ({
        id: store.uid(),
        name: ing.name,
        reason: `「${recipe.name}」（${formatDateLabel(dateStr)}に作る予定）に使用`,
        checked: false,
      }));
    if (shoppingAdditions.length > 0) {
      store.setShoppingList([...store.getShoppingList(), ...shoppingAdditions]);
    }

    const mealPlans = store.getMealPlans();
    mealPlans.push({
      id: store.uid(),
      date: dateStr,
      recipeId: recipe.id,
      recipeName: recipe.name,
      genre: recipe.genre,
      course: recipe.course,
      matchedSnapshots,
      shoppingListIds: shoppingAdditions.map((a) => a.id),
      createdAt: new Date().toISOString(),
    });
    store.setMealPlans(mealPlans);

    let message = `「${recipe.name}」を${formatDateLabel(dateStr)}の献立として登録しました。`;
    if (shoppingAdditions.length > 0) {
      message += `不足していた${shoppingAdditions.length}件の食材を買い物リストに追加しました。`;
    }
    alert(message);
    rerender();
  }

  function renderDefaultActions() {
    actionsSlot.innerHTML = `
      <div class="recipe-actions">
        <button class="primary" data-action="plan">作る</button>
        <button class="secondary" data-action="skip">今回は作らない</button>
      </div>
    `;

    actionsSlot.querySelector('[data-action="plan"]').addEventListener("click", () => {
      const currentIngredients = store.getIngredients();
      const matched = findMatchedInventoryItems(recipe.ingredients, currentIngredients);
      if (matched.length === 0) {
        commitPlan([], new Map());
        return;
      }
      renderLeftoverForm(matched);
    });

    actionsSlot.querySelector('[data-action="skip"]').addEventListener("click", () => {
      card.remove();
    });
  }

  function renderLeftoverForm(matched) {
    actionsSlot.innerHTML = `
      <div class="leftover-form">
        <p class="item-sub">
          このレシピを作ると、以下の食材を使う予定です。作った後に残りそうな分量があれば入力してください（空欄＝使い切る予定）
        </p>
        ${matched
          .map(
            (item) => `
          <div class="form-row leftover-row" data-id="${item.id}">
            <span class="item-name" style="flex:1 1 140px;align-self:center;">${item.name}</span>
            <div class="field-group">
              <label class="field-label">残りそうな分量（現在庫: ${item.quantity}${item.unit}）</label>
              <input type="number" min="0" step="0.1" class="leftover-qty" placeholder="空欄=使い切る予定" />
            </div>
          </div>`
          )
          .join("")}
        <div class="recipe-actions">
          <button class="primary" data-action="confirm-plan">登録する</button>
          <button class="secondary" data-action="cancel-plan-form">キャンセル</button>
        </div>
      </div>
    `;

    actionsSlot.querySelector('[data-action="confirm-plan"]').addEventListener("click", () => {
      const leftoverMap = new Map();
      actionsSlot.querySelectorAll(".leftover-row").forEach((row) => {
        const input = row.querySelector(".leftover-qty");
        if (input.value !== "" && Number(input.value) > 0) {
          leftoverMap.set(row.dataset.id, Number(input.value));
        }
      });
      commitPlan(matched, leftoverMap);
    });

    actionsSlot.querySelector('[data-action="cancel-plan-form"]').addEventListener("click", () => {
      renderDefaultActions();
    });
  }

  renderDefaultActions();

  return card;
}

export function renderSuggestPage(container, { store, rerender }) {
  container.appendChild(renderCalendarCard(store, rerender));

  const plansForDate = store.getMealPlans().filter((p) => p.date === viewState.selectedDate);

  if (plansForDate.length > 0) {
    container.appendChild(renderPlannedListCard(plansForDate, { store, rerender }));
  }

  container.appendChild(renderCourseFilterCard(store, rerender));

  const wrap = document.createElement("div");
  wrap.className = "card";
  wrap.innerHTML = `<h2>提案レシピ</h2><p class="empty-state">読み込み中…</p>`;
  container.appendChild(wrap);

  (async () => {
    const allRecipes = await fetchRecipes();
    const plannedRecipeIds = new Set(plansForDate.map((p) => p.recipeId));
    const recipes = allRecipes.filter((r) => !plannedRecipeIds.has(r.id));
    const ingredients = store.getIngredients();
    const profile = store.getProfile();
    const requests = store.getRequests();
    const mealPlans = store.getMealPlans();

    const results = suggestRecipes({
      recipes,
      ingredients,
      profile,
      requests,
      mealPlans,
      course: viewState.selectedCourse,
    });

    wrap.innerHTML = "";
    const header = document.createElement("h2");
    header.textContent = "提案レシピ";
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
      empty.textContent = "提案できるレシピがありません（コースの絞り込みやアレルギー・苦手食材で全て除外された可能性があります）";
      wrap.appendChild(empty);
    }

    results.forEach((result) => {
      wrap.appendChild(renderRecipeCard(result, { store, rerender, dateStr: viewState.selectedDate }));
    });
  })();
}
