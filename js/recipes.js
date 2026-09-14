let cache = null;

/**
 * レシピ一覧を取得する。
 * 現在は同梱のJSONデータを返すだけだが、将来的にはここを
 * 楽天レシピAPI等の外部データ取得に差し替える想定のインターフェース。
 */
export async function fetchRecipes() {
  if (cache) return cache;
  const res = await fetch("data/recipes.json", { cache: "no-store" });
  cache = await res.json();
  return cache;
}
