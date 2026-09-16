import { inferCategory } from "../categoryInference.js";

export const UNITS = ["個", "g", "kg", "ml", "L", "本", "枚", "束", "パック", "丁", "玉", "袋"];

const TABS = [
  { id: "food", label: "食材" },
  { id: "seasoning", label: "調味料" },
];

// タブの選択状態はモジュールスコープで保持し、rerender()をまたいで維持する
let activeTab = "food";

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function expiryBadge(daysLeft) {
  if (daysLeft < 0) return { cls: "expired", label: "期限切れ" };
  if (daysLeft <= 3) return { cls: "soon", label: `あと${daysLeft}日` };
  return { cls: "ok", label: `あと${daysLeft}日` };
}

/**
 * 食材を在庫に追加する。同名・同単位・同賞味期限の在庫が既にあれば数量を合算し、
 * そうでなければ新しいロットとして追加する（賞味期限が違う複数ロットは
 * 一覧表示側で1項目にまとめて内訳を表示する）。
 */
export function addOrMergeFoodIngredient(store, { name, category, quantity, unit, expiryDate }) {
  const current = store.getIngredients();
  const idx = current.findIndex(
    (i) => i.category !== "調味料" && i.name === name && i.unit === unit && i.expiryDate === expiryDate
  );
  if (idx !== -1) {
    const next = [...current];
    next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
    store.setIngredients(next);
  } else {
    store.setIngredients([
      ...current,
      {
        id: store.uid(),
        name,
        category,
        quantity,
        unit,
        expiryDate,
        registeredAt: new Date().toISOString(),
      },
    ]);
  }
}

function renderTabsCard(store, rerender) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="mode-toggle">
      ${TABS.map(
        (t) => `<button class="mode-btn ${activeTab === t.id ? "active" : ""}" data-tab="${t.id}">${t.label}</button>`
      ).join("")}
    </div>
  `;
  card.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      rerender();
    });
  });
  return card;
}

function renderFormCard(store, rerender) {
  const isSeasoning = activeTab === "seasoning";
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h2>${isSeasoning ? "調味料を登録" : "食材を登録"}</h2>
    <label class="field-label" for="ing-name">${isSeasoning ? "調味料名" : "食材名"}</label>
    <div class="form-row">
      <input type="text" id="ing-name" placeholder="${isSeasoning ? "例：醤油" : "例：豚肉"}" />
    </div>
    ${
      isSeasoning
        ? ""
        : `<div class="form-row">
             <div class="field-group field-narrow">
               <label class="field-label" for="ing-qty">数量</label>
               <input type="number" id="ing-qty" min="0" step="0.1" value="1" />
             </div>
             <div class="field-group field-narrow">
               <label class="field-label" for="ing-unit">単位</label>
               <select id="ing-unit">
                 ${UNITS.map((u) => `<option value="${u}">${u}</option>`).join("")}
               </select>
             </div>
             <div class="field-group">
               <label class="field-label" for="ing-expiry">消費期限</label>
               <input type="date" id="ing-expiry" />
             </div>
           </div>`
    }
    <button class="primary" id="ing-add">登録する</button>
  `;

  card.querySelector("#ing-add").addEventListener("click", () => {
    const name = card.querySelector("#ing-name").value.trim();
    if (!name) {
      alert(isSeasoning ? "調味料名を入力してください" : "食材名を入力してください");
      return;
    }

    if (isSeasoning) {
      const alreadyHave = store
        .getIngredients()
        .some((i) => i.category === "調味料" && i.name === name);
      if (alreadyHave) {
        alert("すでに登録されています");
        return;
      }
      store.setIngredients([
        ...store.getIngredients(),
        {
          id: store.uid(),
          name,
          category: "調味料",
          quantity: 1,
          unit: "",
          expiryDate: null,
          registeredAt: new Date().toISOString(),
        },
      ]);
      rerender();
      return;
    }

    const quantity = Number(card.querySelector("#ing-qty").value) || 1;
    const unit = card.querySelector("#ing-unit").value;
    const expiryDate = card.querySelector("#ing-expiry").value;
    if (!expiryDate) {
      alert("消費期限を入力してください");
      return;
    }
    addOrMergeFoodIngredient(store, { name, category: inferCategory(name), quantity, unit, expiryDate });
    rerender();
  });

  return card;
}

function renderSeasoningListCard(store, rerender) {
  const seasonings = store
    .getIngredients()
    .filter((i) => i.category === "調味料")
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  const listCard = document.createElement("div");
  listCard.className = "card";

  if (seasonings.length === 0) {
    listCard.innerHTML = `<h2>在庫調味料</h2><p class="empty-state">まだ調味料が登録されていません</p>`;
    return listCard;
  }

  listCard.innerHTML = `<h2>在庫調味料</h2>`;
  seasonings.forEach((ing) => {
    const row = document.createElement("div");
    row.className = "list-item";
    row.innerHTML = `
      <div class="item-main">
        <span class="item-name">${ing.name}</span>
      </div>
      <div class="list-item-actions">
        <button class="link" data-id="${ing.id}">削除</button>
      </div>
    `;
    row.querySelector("button.link").addEventListener("click", () => {
      store.setIngredients(store.getIngredients().filter((i) => i.id !== ing.id));
      rerender();
    });
    listCard.appendChild(row);
  });

  return listCard;
}

function renderFoodListCard(store, rerender) {
  const foods = store.getIngredients().filter((i) => i.category !== "調味料");

  const listCard = document.createElement("div");
  listCard.className = "card";

  if (foods.length === 0) {
    listCard.innerHTML = `<h2>在庫食材</h2><p class="empty-state">まだ食材が登録されていません</p>`;
    return listCard;
  }

  // 同じ名前の食材は、賞味期限違いのロットが複数あっても1項目にまとめて表示する
  const groups = new Map();
  foods.forEach((ing) => {
    if (!groups.has(ing.name)) groups.set(ing.name, []);
    groups.get(ing.name).push(ing);
  });
  const groupList = Array.from(groups.values()).map((batches) => {
    const sortedBatches = [...batches].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    return { name: sortedBatches[0].name, category: sortedBatches[0].category, batches: sortedBatches };
  });
  groupList.sort((a, b) => new Date(a.batches[0].expiryDate) - new Date(b.batches[0].expiryDate));

  listCard.innerHTML = `<h2>在庫食材（期限が近い順）</h2>`;
  groupList.forEach((group) => {
    const entry = document.createElement("div");
    entry.className = "list-entry";
    entry.innerHTML = `
      <div class="item-main" style="margin-bottom:4px;">
        <span class="item-name">${group.name}</span>
        <span class="item-sub">${group.category}</span>
      </div>
      <div class="ingredient-batch-list">
        ${group.batches
          .map((b) => {
            const daysLeft = daysUntil(b.expiryDate);
            const badge = expiryBadge(daysLeft);
            return `
              <div class="ingredient-batch-row">
                <span class="ingredient-batch-qty">${b.quantity}${b.unit}</span>
                <span class="badge ${badge.cls}">${badge.label}</span>
                <button class="link" data-id="${b.id}">削除</button>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
    entry.querySelectorAll(".ingredient-batch-row button.link").forEach((btn) => {
      btn.addEventListener("click", () => {
        store.setIngredients(store.getIngredients().filter((i) => i.id !== btn.dataset.id));
        rerender();
      });
    });
    listCard.appendChild(entry);
  });

  return listCard;
}

function renderListCard(store, rerender) {
  return activeTab === "seasoning"
    ? renderSeasoningListCard(store, rerender)
    : renderFoodListCard(store, rerender);
}

export function renderIngredientsPage(container, { store, rerender }) {
  // 過去のデータに重複ロットが残っていた場合、表示前に一度整理しておく
  store.setIngredients(store.getIngredients());

  container.appendChild(renderTabsCard(store, rerender));
  container.appendChild(renderFormCard(store, rerender));
  container.appendChild(renderListCard(store, rerender));
}
