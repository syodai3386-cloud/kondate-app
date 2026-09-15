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
    <div class="form-row">
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
      ${
        isSeasoning
          ? ""
          : `<div class="field-group">
               <label class="field-label" for="ing-expiry">消費期限</label>
               <input type="date" id="ing-expiry" />
             </div>`
      }
    </div>
    <button class="primary" id="ing-add">登録する</button>
  `;

  card.querySelector("#ing-add").addEventListener("click", () => {
    const name = card.querySelector("#ing-name").value.trim();
    const quantity = Number(card.querySelector("#ing-qty").value) || 1;
    const unit = card.querySelector("#ing-unit").value;
    const expiryInput = card.querySelector("#ing-expiry");
    const expiryDate = expiryInput ? expiryInput.value : "";

    if (!name || (!isSeasoning && !expiryDate)) {
      alert(isSeasoning ? "調味料名を入力してください" : "食材名と消費期限を入力してください");
      return;
    }
    const next = [
      ...store.getIngredients(),
      {
        id: store.uid(),
        name,
        category: inferCategory(name),
        quantity,
        unit,
        expiryDate: isSeasoning ? null : expiryDate,
        registeredAt: new Date().toISOString(),
      },
    ];
    store.setIngredients(next);
    rerender();
  });

  return card;
}

function renderListCard(store, rerender) {
  const isSeasoning = activeTab === "seasoning";
  const ingredients = store.getIngredients().filter((i) =>
    isSeasoning ? i.category === "調味料" : i.category !== "調味料"
  );

  const listCard = document.createElement("div");
  listCard.className = "card";

  const sorted = isSeasoning
    ? [...ingredients].sort((a, b) => a.name.localeCompare(b.name, "ja"))
    : [...ingredients].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  const title = isSeasoning ? "在庫調味料" : "在庫食材（期限が近い順）";

  if (sorted.length === 0) {
    listCard.innerHTML = `<h2>${isSeasoning ? "在庫調味料" : "在庫食材"}</h2><p class="empty-state">まだ${isSeasoning ? "調味料が" : "食材が"}登録されていません</p>`;
  } else {
    listCard.innerHTML = `<h2>${title}</h2>`;
    sorted.forEach((ing) => {
      const row = document.createElement("div");
      row.className = "list-item";
      const badgeHtml = (() => {
        if (isSeasoning || !ing.expiryDate) return "";
        const daysLeft = daysUntil(ing.expiryDate);
        const badge = expiryBadge(daysLeft);
        return `<span class="badge ${badge.cls}">${badge.label}</span>`;
      })();
      row.innerHTML = `
        <div class="item-main">
          <span class="item-name">${ing.name}</span>
          <span class="item-sub">${ing.category} ・ ${ing.quantity}${ing.unit}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${badgeHtml}
          <button class="link" data-id="${ing.id}">削除</button>
        </div>
      `;
      row.querySelector("button.link").addEventListener("click", () => {
        const next = store.getIngredients().filter((i) => i.id !== ing.id);
        store.setIngredients(next);
        rerender();
      });
      listCard.appendChild(row);
    });
  }

  return listCard;
}

export function renderIngredientsPage(container, { store, rerender }) {
  container.appendChild(renderTabsCard(store, rerender));
  container.appendChild(renderFormCard(store, rerender));
  container.appendChild(renderListCard(store, rerender));
}
