const GENRES = ["", "和食", "洋食", "中華", "その他"];

export function renderRequestsPage(container, { store, rerender }) {
  const requests = store.getRequests();

  const wrap = document.createElement("div");

  const form = document.createElement("div");
  form.className = "card";
  form.innerHTML = `
    <h2>こんなものが食べたい</h2>
    <div class="form-row">
      <div class="field-group" style="flex:1 1 200px;">
        <label class="field-label" for="req-text">内容</label>
        <input type="text" id="req-text" placeholder="例：から揚げ、さっぱりしたもの" />
      </div>
      <div class="field-group">
        <label class="field-label" for="req-genre">ジャンル</label>
        <select id="req-genre">
          ${GENRES.map((g) => `<option value="${g}">${g || "指定なし"}</option>`).join("")}
        </select>
      </div>
    </div>
    <button class="primary" id="req-add">登録する</button>
  `;
  wrap.appendChild(form);

  const listCard = document.createElement("div");
  listCard.className = "card";
  if (requests.length === 0) {
    listCard.innerHTML = `<h2>登録中のリクエスト</h2><p class="empty-state">まだ登録されていません</p>`;
  } else {
    listCard.innerHTML = `<h2>登録中のリクエスト</h2>`;
    requests.forEach((req) => {
      const row = document.createElement("div");
      row.className = "list-item";
      row.innerHTML = `
        <div class="item-main">
          <span class="item-name">${req.text}</span>
          ${req.genre ? `<span class="item-sub">${req.genre}</span>` : ""}
        </div>
        <button class="link" data-id="${req.id}">削除</button>
      `;
      row.querySelector("button.link").addEventListener("click", () => {
        const next = store.getRequests().filter((r) => r.id !== req.id);
        store.setRequests(next);
        rerender();
      });
      listCard.appendChild(row);
    });
  }
  wrap.appendChild(listCard);
  container.appendChild(wrap);

  form.querySelector("#req-add").addEventListener("click", () => {
    const text = form.querySelector("#req-text").value.trim();
    const genre = form.querySelector("#req-genre").value;
    if (!text) return;
    const next = [
      ...store.getRequests(),
      { id: store.uid(), text, genre, addedAt: new Date().toISOString() },
    ];
    store.setRequests(next);
    rerender();
  });
}
