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

export const store = {
  getIngredients: () => load("ingredients"),
  setIngredients: (v) => save("ingredients", v),

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
