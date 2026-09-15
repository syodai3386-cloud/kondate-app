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

// 動作確認用のサンプルデータ（食材・調味料）。「テストデータを読み込む」から使う。
const SAMPLE_FOODS = [
  { name: "豚肉", category: "肉", quantity: 300, unit: "g", days: 1 },
  { name: "鶏肉", category: "肉", quantity: 400, unit: "g", days: 5 },
  { name: "牛肉", category: "肉", quantity: 200, unit: "g", days: 3 },
  { name: "ひき肉", category: "肉", quantity: 250, unit: "g", days: 2 },
  { name: "鮭", category: "魚", quantity: 2, unit: "枚", days: 2 },
  { name: "えび", category: "魚", quantity: 150, unit: "g", days: 4 },
  { name: "卵", category: "卵・乳", quantity: 10, unit: "個", days: 10 },
  { name: "牛乳", category: "卵・乳", quantity: 1, unit: "L", days: 4 },
  { name: "豆腐", category: "豆腐・大豆製品", quantity: 1, unit: "丁", days: 3 },
  { name: "厚揚げ", category: "豆腐・大豆製品", quantity: 2, unit: "枚", days: 6 },
  { name: "白菜", category: "野菜", quantity: 0.5, unit: "個", days: 6 },
  { name: "キャベツ", category: "野菜", quantity: 1, unit: "個", days: 7 },
  { name: "玉ねぎ", category: "野菜", quantity: 3, unit: "個", days: 14 },
  { name: "人参", category: "野菜", quantity: 2, unit: "本", days: 10 },
  { name: "じゃがいも", category: "野菜", quantity: 4, unit: "個", days: 14 },
  { name: "ピーマン", category: "野菜", quantity: 3, unit: "個", days: 5 },
  { name: "もやし", category: "野菜", quantity: 1, unit: "袋", days: 2 },
  { name: "しめじ", category: "野菜", quantity: 1, unit: "パック", days: 4 },
  { name: "大根", category: "野菜", quantity: 1, unit: "本", days: 9 },
  { name: "なす", category: "野菜", quantity: 3, unit: "本", days: 5 },
  { name: "米", category: "主食", quantity: 5, unit: "kg", days: 60 },
];

const SAMPLE_SEASONINGS = [
  "醤油", "みりん", "酒", "砂糖", "塩", "酢", "サラダ油", "ごま油", "味噌",
  "マヨネーズ", "ケチャップ", "片栗粉", "小麦粉", "鶏がらスープの素",
  "和風だしの素", "にんにく", "しょうが", "こしょう", "ポン酢", "カレールウ",
];

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function seedTestData(store, rerender) {
  if (!confirm("現在の食材・調味料の在庫をテスト用データに置き換えます。よろしいですか？")) return;
  const now = new Date().toISOString();
  const foodItems = SAMPLE_FOODS.map((f) => ({
    id: store.uid(),
    name: f.name,
    category: f.category,
    quantity: f.quantity,
    unit: f.unit,
    expiryDate: addDays(f.days),
    registeredAt: now,
  }));
  const seasoningItems = SAMPLE_SEASONINGS.map((name) => ({
    id: store.uid(),
    name,
    category: "調味料",
    quantity: 1,
    unit: "",
    expiryDate: null,
    registeredAt: now,
  }));
  store.setIngredients([...foodItems, ...seasoningItems]);
  rerender();
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
    <p class="item-sub" style="margin-top:8px;">
      <button class="link" id="seed-test-data" style="color:var(--muted);text-decoration:underline;">テストデータを読み込む</button>
    </p>
  `;
  card.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      rerender();
    });
  });
  card.querySelector("#seed-test-data").addEventListener("click", () => {
    seedTestData(store, rerender);
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
    store.setIngredients([
      ...store.getIngredients(),
      {
        id: store.uid(),
        name,
        category: inferCategory(name),
        quantity,
        unit,
        expiryDate,
        registeredAt: new Date().toISOString(),
      },
    ]);
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
          ${isSeasoning ? "" : `<span class="item-sub">${ing.category} ・ ${ing.quantity}${ing.unit}</span>`}
        </div>
        <div class="list-item-actions">
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
