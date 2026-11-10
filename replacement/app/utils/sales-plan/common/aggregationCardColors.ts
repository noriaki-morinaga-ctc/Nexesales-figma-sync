// 集計エリアのカード（ミニ棒グラフ）の配色判定。
// 計画詳細（マージン率固定・NET入力／NET固定）と販売計画シミュレーションで
// 閾値を揃えるため、判定をここに集約する（画面側で個別に閾値を書かない）。

// 達成率に応じた棒グラフの塗りと率テキストの色。
export interface CardRateColor {
  // 棒グラフの塗り（Tailwind の背景色クラス）
  bar: string;
  // 率テキストの文字色（Tailwind の文字色クラス）
  text: string;
}

const EMERALD: CardRateColor = {
  bar: 'bg-emerald-500',
  text: 'text-emerald-600',
};
const AMBER: CardRateColor = { bar: 'bg-amber-500', text: 'text-amber-600' };
const RED: CardRateColor = { bar: 'bg-red-500', text: 'text-red-600' };

// コスト項目（拡売費）は「少ないほど良い」ため、通常項目と逆の配色にする。
// 予算達成率・前年比とも 100%以下＝緑／100%超＝赤（境界の 100% は緑側）。
// 率が算出できない（予算・前年同月が 0 で NaN／Infinity）場合は赤に倒す。
const costRateColor = (rate: number): CardRateColor =>
  rate <= 100 ? EMERALD : RED;

// 予算達成率の色。通常項目は 95%以上＝緑／85%以上＝黄／それ未満＝赤。
export function budgetRateColor(rate: number, isCost = false): CardRateColor {
  if (isCost) return costRateColor(rate);
  if (rate >= 95) return EMERALD;
  if (rate >= 85) return AMBER;
  return RED;
}

// 前年比の色。通常項目は 100%以上＝緑／90%以上＝黄／それ未満＝赤。
export function previousYearRateColor(
  rate: number,
  isCost = false
): CardRateColor {
  if (isCost) return costRateColor(rate);
  if (rate >= 100) return EMERALD;
  if (rate >= 90) return AMBER;
  return RED;
}

// 予算差・前年差（計画−予算／計画−前年同月）の文字色。
// 通常項目はプラス＝青／マイナス＝赤。コスト項目（拡売費）は予算・前年を上回る＝×
// のため色だけ反転する（符号の +／△ は算術どおりで変えない）。
// 丸めた結果が 0 の差は呼び出し側で既定色（グレー）にするため、ここでは扱わない。
export function diffTextColor(diff: number, isCost = false): string {
  if (diff > 0) return isCost ? 'text-red-600' : 'text-blue-600';
  return isCost ? 'text-blue-600' : 'text-red-600';
}
