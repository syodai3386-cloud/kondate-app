import { store } from "./storage.js";
import { renderIngredientsPage } from "./pages/ingredients.js";
import { renderSuggestPage } from "./pages/suggest.js";
import { renderProfilePage } from "./pages/profile.js";
import { renderRequestsPage } from "./pages/requests.js";
import { renderShoppingPage } from "./pages/shopping.js";

const ROUTES = [
  { id: "ingredients", label: "食材", icon: "🥬", render: renderIngredientsPage },
  { id: "suggest", label: "献立提案", icon: "🍳", render: renderSuggestPage },
  { id: "requests", label: "食べたいもの", icon: "💭", render: renderRequestsPage },
  { id: "shopping", label: "買い物リスト", icon: "🛒", render: renderShoppingPage },
  { id: "profile", label: "家族・好み", icon: "👪", render: renderProfilePage },
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
    btn.innerHTML = `<span class="nav-icon">${r.icon}</span><span class="nav-label">${r.label}</span>`;
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
