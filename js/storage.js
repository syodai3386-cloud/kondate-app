const KEYS = {
  ingredients: "kondate.ingredients",
  profile: "kondate.profile",
  requests: "kondate.requests",
  mealPlans: "kondate.mealPlans",
  shoppingList: "kondate.shoppingList",
};

const DEFAULTS = {
  ingredients: [],
  profile: { members: [], allergies: [], dislikes: [], likes: [] },
  requests: [],
  mealPlans: [],
  shoppingList: [],
};

function load(key) {
  const raw = localStorage.getItem(KEYS[key]);
  if (!raw) return structuredClone(DEFAULTS[key]);
  try {
    return JSON.parse(raw);
  } catch {
    return structuredClone(DEFAULTS[key]);
  }
}

function save(key, value) {
  localStorage.setItem(KEYS[key], JSON.stringify(value));
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * 食材配列を保存前に整理する。調味料は同名のものを1件にまとめ、
 * 食材は同じ名前・単位・賞味期限のロットが複数あれば数量を合算して1件にする
 * （登録経路によらず、常に重複が残らないようにするための最終防衛ライン）。
 */
function normalizeIngredients(ingredients) {
  const seasoningByName = new Map();
  const foodByKey = new Map();
  const order = [];

  ingredients.forEach((item) => {
    if (item.category === "調味料") {
      if (!seasoningByName.has(item.name)) {
        seasoningByName.set(item.name, item);
        order.push({ type: "seasoning", key: item.name });
      }
    } else {
      const key = [item.name, item.unit, item.expiryDate].join("|");
      if (foodByKey.has(key)) {
        const existing = foodByKey.get(key);
        foodByKey.set(key, { ...existing, quantity: existing.quantity + item.quantity });
      } else {
        foodByKey.set(key, item);
        order.push({ type: "food", key });
      }
    }
  });

  return order.map((o) => (o.type === "seasoning" ? seasoningByName.get(o.key) : foodByKey.get(o.key)));
}

export const store = {
  getIngredients: () => load("ingredients"),
  setIngredients: (v) => save("ingredients", normalizeIngredients(v)),

  getProfile: () => load("profile"),
  setProfile: (v) => save("profile", v),

  getRequests: () => load("requests"),
  setRequests: (v) => save("requests", v),

  getMealPlans: () => load("mealPlans"),
  setMealPlans: (v) => save("mealPlans", v),

  getShoppingList: () => load("shoppingList"),
  setShoppingList: (v) => save("shoppingList", v),

  uid,
};
