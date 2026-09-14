const APPETITE_WEIGHT = { 少なめ: 0.7, 普通: 1.0, 多め: 1.3 };

/**
 * 家族構成から「何人前を目安に作るか」を算出する。
 * 家族未登録の場合はレシピ基準のまま（呼び出し側でfactor=1として扱う）。
 */
export function computeTargetServings(profile) {
  if (!profile.members || profile.members.length === 0) return null;
  const total = profile.members.reduce(
    (sum, m) => sum + (APPETITE_WEIGHT[m.appetite] ?? 1),
    0
  );
  return Math.max(0.5, Math.round(total * 2) / 2);
}

/**
 * "200g" のような分量文字列の先頭の数値だけを倍率でスケーリングする。
 * "少々" 等、数値を含まない分量はそのまま返す。
 */
function roundForDisplay(value) {
  if (value <= 0) return 0;
  if (value < 1) return Math.max(0.1, Math.round(value * 10) / 10);
  if (value < 10) return Math.round(value * 2) / 2;
  return Math.round(value / 5) * 5;
}

export function scaleAmount(amountStr, factor) {
  if (!amountStr || factor === 1) return amountStr;
  const match = amountStr.match(/^([\d.]+)(.*)$/);
  if (!match) return amountStr;
  const [, numStr, rest] = match;
  const scaled = roundForDisplay(parseFloat(numStr) * factor);
  const formatted = Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1);
  return `${formatted}${rest}`;
}
