export function nameMatches(a, b) {
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

/**
 * 「から揚げ、さっぱりしたもの」のような複数語のリクエスト文を
 * 区切り文字で分割し、語ごとに一致判定できるようにする。
 */
export function tokenize(text) {
  return (text || "")
    .split(/[、,・\/\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * リクエスト（自由文＋任意のジャンル）がレシピに合致するか判定する。
 * 文全体だけでなく、区切って分割した各語でも一致を試みる。
 */
export function recipeMatchesRequest(recipe, req) {
  if (req.genre && req.genre === recipe.genre) return true;
  const candidates = [req.text, ...tokenize(req.text)];
  return candidates.some(
    (c) =>
      nameMatches(recipe.genre, c) ||
      nameMatches(recipe.name, c) ||
      recipe.tags.some((t) => nameMatches(t, c))
  );
}
