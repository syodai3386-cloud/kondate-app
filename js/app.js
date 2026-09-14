import { store } from "./storage.js";
import { renderIngredientsPage } from "./pages/ingredients.js";
import { renderSuggestPage } from "./pages/suggest.js";
import { renderProfilePage } from "./pages/profile.js";
import { renderRequestsPage } from "./pages/requests.js";
import { renderShoppingPage } from "./pages/shopping.js";

const ROUTES = [
  { id: "ingredients", label: "食材", render: renderIngredientsPage },
  { id: "suggest", label: "献立提案", render: renderSuggestPage },
  { id: "requests", label: "食べたいもの", render: renderRequestsPage },
  { id: "shopping", label: "買い物リスト", render: renderShoppingPage },
  { id: "profile", label: "家族・好み", render: renderProfilePage },
];

const appEl = document.getElementById("app");
const navEl = document.getElementById("nav");

function currentRouteId() {
  const hash = location.hash.replace("#", "");
  return ROUTES.some((r) => r.id === hash) ? hash : "ingredients";
}

function renderNav() {
  const active = currentRouteId();
  navEl.innerHTML = "";
  ROUTES.forEach((r) => {
    const btn = document.createElement("button");
    btn.textContent = r.label;
    btn.className = active === r.id ? "active" : "";
    btn.addEventListener("click", () => {
      location.hash = r.id;
    });
    navEl.appendChild(btn);
  });
}

function renderRoute() {
  renderNav();
  const route = ROUTES.find((r) => r.id === currentRouteId());
  appEl.innerHTML = "";
  route.render(appEl, { store, rerender: renderRoute });
}

window.addEventListener("hashchange", renderRoute);
renderRoute();
