const APPETITES = ["少なめ", "普通", "多め"];

function renderChipList(container, items, onRemove) {
  container.innerHTML = "";
  items.forEach((item, idx) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `${item} <button aria-label="削除">×</button>`;
    chip.querySelector("button").addEventListener("click", () => onRemove(idx));
    container.appendChild(chip);
  });
}

function renderChipSection(parent, { title, placeholder, getItems, setItems, rerenderAll }) {
  const section = document.createElement("div");
  section.className = "card";
  section.innerHTML = `
    <h2>${title}</h2>
    <div class="chip-input" id="chips"></div>
    <label class="field-label" for="chip-text">追加する項目</label>
    <div class="form-row">
      <input type="text" id="chip-text" placeholder="${placeholder}" />
      <button class="secondary" id="chip-add">追加</button>
    </div>
  `;
  const chipsEl = section.querySelector("#chips");
  renderChipList(chipsEl, getItems(), (idx) => {
    const items = getItems();
    items.splice(idx, 1);
    setItems(items);
    rerenderAll();
  });
  section.querySelector("#chip-add").addEventListener("click", () => {
    const input = section.querySelector("#chip-text");
    const value = input.value.trim();
    if (!value) return;
    const items = getItems();
    items.push(value);
    setItems(items);
    rerenderAll();
  });
  parent.appendChild(section);
}

export function renderProfilePage(container, { store, rerender }) {
  const profile = store.getProfile();

  const wrap = document.createElement("div");

  const membersCard = document.createElement("div");
  membersCard.className = "card";
  membersCard.innerHTML = `<h2>家族構成</h2>`;
  if (profile.members.length === 0) {
    membersCard.innerHTML += `<p class="empty-state">まだ登録されていません</p>`;
  }
  profile.members.forEach((m, idx) => {
    const row = document.createElement("div");
    row.className = "list-item";
    row.innerHTML = `
      <div class="item-main">
        <span class="item-name">${m.name}</span>
        <span class="item-sub">食べる量：${m.appetite}</span>
      </div>
      <button class="link" data-idx="${idx}">削除</button>
    `;
    row.querySelector("button.link").addEventListener("click", () => {
      const p = store.getProfile();
      p.members.splice(idx, 1);
      store.setProfile(p);
      rerender();
    });
    membersCard.appendChild(row);
  });

  const addMemberRow = document.createElement("div");
  addMemberRow.className = "form-row";
  addMemberRow.innerHTML = `
    <div class="field-group">
      <label class="field-label" for="member-name">名前</label>
      <input type="text" id="member-name" placeholder="例：長女" />
    </div>
    <div class="field-group">
      <label class="field-label" for="member-appetite">食べる量</label>
      <select id="member-appetite">
        ${APPETITES.map((a) => `<option value="${a}">${a}</option>`).join("")}
      </select>
    </div>
    <button class="secondary" id="member-add" style="align-self:flex-end;">追加</button>
  `;
  membersCard.appendChild(addMemberRow);
  wrap.appendChild(membersCard);

  container.appendChild(wrap);

  addMemberRow.querySelector("#member-add").addEventListener("click", () => {
    const name = addMemberRow.querySelector("#member-name").value.trim();
    const appetite = addMemberRow.querySelector("#member-appetite").value;
    if (!name) return;
    const p = store.getProfile();
    p.members.push({ name, appetite });
    store.setProfile(p);
    rerender();
  });

  renderChipSection(wrap, {
    title: "アレルギー",
    placeholder: "例：卵、乳、小麦、えび",
    getItems: () => store.getProfile().allergies,
    setItems: (items) => {
      const p = store.getProfile();
      p.allergies = items;
      store.setProfile(p);
    },
    rerenderAll: rerender,
  });

  renderChipSection(wrap, {
    title: "苦手な食材",
    placeholder: "例：セロリ",
    getItems: () => store.getProfile().dislikes,
    setItems: (items) => {
      const p = store.getProfile();
      p.dislikes = items;
      store.setProfile(p);
    },
    rerenderAll: rerender,
  });

  renderChipSection(wrap, {
    title: "好きなジャンル・傾向",
    placeholder: "例：和食、ヘルシー",
    getItems: () => store.getProfile().likes,
    setItems: (items) => {
      const p = store.getProfile();
      p.likes = items;
      store.setProfile(p);
    },
    rerenderAll: rerender,
  });
}
