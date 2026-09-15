import { fetchRecipes } from "../recipes.js";
import { nameMatches, recipeMatchesRequest } from "../textMatch.js";
import { inferCategory } from "../categoryInference.js";
import { UNITS } from "./ingredients.js";

// どの項目が「購入」フォームを展開中かをモジュールスコープで保持する
let purchasingId = null;

async function findMissingForRequests(requests, ingredients) {
  if (requests.length === 0) return { missing: [], unmatchedRequests: [] };
  const recipes = await fetchRecipes();
  const missing = new Map();
  const unmatchedRequests = [];

  requests.forEach((req) => {
    const matchedRecipes = recipes.filter((r) => recipeMatchesRequest(r, req));
    if (matchedRecipes.length === 0) {
      unmatchedRequests.push(req.text);
      return;
    }
    matchedRecipes.forEach((recipe) => {
      recipe.ingredients.forEach((ing) => {
        const inStock = ingredients.some((i) => nameMatches(i.name, ing.name));
        if (!inStock && !missing.has(ing.name)) {
          missing.set(ing.name, `「${req.text}」（${recipe.name}）に使用`);
        }
      });
    });
  });

  return {
    missing: Array.from(missing, ([name, reason]) => ({ name, reason })),
    unmatchedRequests,
  };
}

function renderPurchaseForm(item, { store, rerender }) {
  const isSeasoning = inferCategory(item.name) === "調味料";
  const wrap = document.createElement("div");
  wrap.className = "leftover-form";
  wrap.innerHTML = `
    <div class="form-row">
      <div class="field-group field-narrow">
        <label class="field-label">数量</label>
        <input type="number" min="0" step="0.1" value="1" class="purchase-qty" />
      </div>
      <div class="field-group field-narrow">
        <label class="field-label">単位</label>
        <select class="purchase-unit">
          ${UNITS.map((u) => `<option value="${u}">${u}</option>`).join("")}
        </select>
      </div>
      ${
        isSeasoning
          ? ""
          : `<div class="field-group">
               <label class="field-label">消費期限</label>
               <input type="date" class="purchase-expiry" />
             </div>`
      }
    </div>
    <div class="recipe-actions">
      <button class="primary" data-action="confirm-purchase">在庫に追加</button>
      <button class="secondary" data-action="cancel-purchase">キャンセル</button>
    </div>
  `;

  wrap.querySelector('[data-action="confirm-purchase"]').addEventListener("click", () => {
    const quantity = Number(wrap.querySelector(".purchase-qty").value) || 1;
    const unit = wrap.querySelector(".purchase-unit").value;
    const expiryInput = wrap.querySelector(".purchase-expiry");
    const expiryDate = expiryInput ? expiryInput.value : "";
    if (!isSeasoning && !expiryDate) {
      alert("消費期限を入力してください");
      return;
    }
    const nextIngredients = [
      ...store.getIngredients(),
      {
        id: store.uid(),
        name: item.name,
        category: inferCategory(item.name),
        quantity,
        unit,
        expiryDate: isSeasoning ? null : expiryDate,
        registeredAt: new Date().toISOString(),
      },
    ];
    store.setIngredients(nextIngredients);
    store.setShoppingList(store.getShoppingList().filter((i) => i.id !== item.id));
    purchasingId = null;
    rerender();
  });

  wrap.querySelector('[data-action="cancel-purchase"]').addEventListener("click", () => {
    purchasingId = null;
    rerender();
  });

  return wrap;
}

export function renderShoppingPage(container, { store, rerender }) {
  const wrap = document.createElement("div");

  const autoCard = document.createElement("div");
  autoCard.className = "card";
  autoCard.innerHTML = `
    <h2>不足食材をチェック</h2>
    <p class="item-sub">登録中の「食べたいもの」リクエストから、在庫にない食材を洗い出します</p>
    <button class="secondary" id="auto-check">不足食材を確認してリストに追加</button>
  `;
  wrap.appendChild(autoCard);

  const form = document.createElement("div");
  form.className = "card";
  form.innerHTML = `
    <h2>買い物リストに追加</h2>
    <label class="field-label" for="item-name">食材名</label>
    <div class="form-row">
      <input type="text" id="item-name" placeholder="例：牛乳" />
      <button class="secondary" id="item-add">追加</button>
    </div>
  `;
  wrap.appendChild(form);

  const listCard = document.createElement("div");
  listCard.className = "card";
  const list = store.getShoppingList();
  if (list.length === 0) {
    listCard.innerHTML = `<h2>買い物リスト</h2><p class="empty-state">リストは空です</p>`;
  } else {
    listCard.innerHTML = `<h2>買い物リスト</h2>`;
    list.forEach((item) => {
      const row = document.createElement("div");
      row.className = "list-item";
      row.style.flexDirection = "column";
      row.style.alignItems = "stretch";
      row.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;">
          <div class="item-main">
            <span class="item-name">${item.name}</span>
            ${item.reason ? `<span class="item-sub">${item.reason}</span>` : ""}
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button class="secondary" data-buy="${item.id}">購入</button>
            <button class="link" data-del="${item.id}">削除</button>
          </div>
        </div>
      `;
      if (purchasingId === item.id) {
        row.appendChild(renderPurchaseForm(item, { store, rerender }));
      }
      row.querySelector("[data-buy]").addEventListener("click", () => {
        purchasingId = purchasingId === item.id ? null : item.id;
        rerender();
      });
      row.querySelector("[data-del]").addEventListener("click", () => {
        const next = store.getShoppingList().filter((i) => i.id !== item.id);
        store.setShoppingList(next);
        rerender();
      });
      listCard.appendChild(row);
    });
  }
  wrap.appendChild(listCard);

  container.appendChild(wrap);

  form.querySelector("#item-add").addEventListener("click", () => {
    const name = form.querySelector("#item-name").value.trim();
    if (!name) return;
    const next = [
      ...store.getShoppingList(),
      { id: store.uid(), name, reason: "", checked: false },
    ];
    store.setShoppingList(next);
    rerender();
  });

  autoCard.querySelector("#auto-check").addEventListener("click", async () => {
    const requests = store.getRequests();
    if (requests.length === 0) {
      alert("先に「食べたいもの」を登録してください");
      return;
    }
    const { missing, unmatchedRequests } = await findMissingForRequests(
      requests,
      store.getIngredients()
    );
    const existingNames = new Set(store.getShoppingList().map((i) => i.name));
    const additions = missing
      .filter((m) => !existingNames.has(m.name))
      .map((m) => ({ id: store.uid(), name: m.name, reason: m.reason, checked: false }));

    if (additions.length > 0) {
      store.setShoppingList([...store.getShoppingList(), ...additions]);
    }

    let message =
      additions.length > 0
        ? `${additions.length}件をリストに追加しました。`
        : "追加する不足食材は見つかりませんでした。";
    if (unmatchedRequests.length > 0) {
      message += `\nただし「${unmatchedRequests.join("」「")}」は該当レシピが見つかりませんでした。`;
    }
    alert(message);

    if (additions.length > 0) rerender();
  });
}
