const KEYS = {
  ingredients: "kondate.ingredients",
  profile: "kondate.profile",
  requests: "kondate.requests",
  history: "kondate.history",
  shoppingList: "kondate.shoppingList",
  settings: "kondate.settings",
};

const DEFAULTS = {
  ingredients: [],
  profile: { members: [], allergies: [], dislikes: [], likes: [] },
  requests: [],
  history: [],
  shoppingList: [],
  settings: { planMode: "day", weeklyCookDays: 5 },
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

  getHistory: () => load("history"),
  setHistory: (v) => save("history", v),

  getShoppingList: () => load("shoppingList"),
  setShoppingList: (v) => save("shoppingList", v),

  getSettings: () => load("settings"),
  setSettings: (v) => save("settings", v),

  uid,
};
