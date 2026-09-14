import { inferCategory } from "../categoryInference.js";

const UNITS = ["個", "g", "kg", "ml", "L", "本", "枚", "束", "パック", "丁", "玉", "袋"];

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

export function renderIngredientsPage(container, { store, rerender }) {
  const ingredients = store.getIngredients();

  const wrap = document.createElement("div");

  const form = document.createElement("div");
  form.className = "card";
  form.innerHTML = `
    <h2>食材を登録</h2>
    <label class="field-label" for="ing-name">食材名</label>
    <div class="form-row">
      <input type="text" id="ing-name" placeholder="例：豚肉" />
    </div>
    <div class="form-row">
      <div class="field-group">
        <label class="field-label" for="ing-qty">数量</label>
        <input type="number" id="ing-qty" min="0" step="0.1" value="1" />
      </div>
      <div class="field-group">
        <label class="field-label" for="ing-unit">単位</label>
        <select id="ing-unit">
          ${UNITS.map((u) => `<option value="${u}">${u}</option>`).join("")}
        </select>
      </div>
      <div class="field-group">
        <label class="field-label" for="ing-expiry">消費期限</label>
        <input type="date" id="ing-expiry" />
      </div>
    </div>
    <button class="primary" id="ing-add">登録する</button>
  `;
  wrap.appendChild(form);

  const listCard = document.createElement("div");
  listCard.className = "card";
  const sorted = [...ingredients].sort(
    (a, b) => new Date(a.expiryDate) - new Date(b.expiryDate)
  );

  if (sorted.length === 0) {
    listCard.innerHTML = `<h2>在庫食材</h2><p class="empty-state">まだ食材が登録されていません</p>`;
  } else {
    listCard.innerHTML = `<h2>在庫食材（期限が近い順）</h2>`;
    sorted.forEach((ing) => {
      const daysLeft = daysUntil(ing.expiryDate);
      const badge = expiryBadge(daysLeft);
      const row = document.createElement("div");
      row.className = "list-item";
      row.innerHTML = `
        <div class="item-main">
          <span class="item-name">${ing.name}</span>
          <span class="item-sub">${ing.category} ・ ${ing.quantity}${ing.unit}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="badge ${badge.cls}">${badge.label}</span>
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
  wrap.appendChild(listCard);

  container.appendChild(wrap);

  form.querySelector("#ing-add").addEventListener("click", () => {
    const name = form.querySelector("#ing-name").value.trim();
    const quantity = Number(form.querySelector("#ing-qty").value) || 1;
    const unit = form.querySelector("#ing-unit").value;
    const expiryDate = form.querySelector("#ing-expiry").value;
    if (!name || !expiryDate) {
      alert("食材名と消費期限を入力してください");
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
        expiryDate,
        registeredAt: new Date().toISOString(),
      },
    ];
    store.setIngredients(next);
    rerender();
  });
}
