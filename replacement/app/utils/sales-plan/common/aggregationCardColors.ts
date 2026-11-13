// 販売計画(集計)の KPI カード（KpiCard）の率・差の文字色の判定。
// 計画詳細（マージン率固定・NET入力／NET固定／自販機）と販売計画シミュレーションで
// 閾値を揃えるため、判定をここに集約する（画面側で個別に閾値を書かない → 02 §10.4）。

// 文字色（白〜薄い青の背景で、いずれもコントラスト 4.5:1 以上 → 06）
export const KPI_RATE_COLORS = {
  good: 'text-blue-800', // 紺
  warn: 'text-orange-700', // オレンジ
  bad: 'text-red-600', // 赤
} as const;

// 予算達成率・前年比の文字色（予算差・前年差も同じ色にする）。
// 通常項目は 100%以上＝紺／90%以上＝オレンジ／90%未満＝赤。
// コスト項目（拡売費）は少ないほど良いため向きを逆にし、100%以下＝紺／110%以下＝オレンジ／110%超＝赤。
// 率が算出できない（予算・前年同月が 0 で NaN／Infinity）場合は赤にする。
export function kpiRateColor(rate: number, isCost = false): string {
  if (!Number.isFinite(rate)) return KPI_RATE_COLORS.bad;
  if (isCost) {
    if (rate <= 100) return KPI_RATE_COLORS.good;
    if (rate <= 110) return KPI_RATE_COLORS.warn;
    return KPI_RATE_COLORS.bad;
  }
  if (rate >= 100) return KPI_RATE_COLORS.good;
  if (rate >= 90) return KPI_RATE_COLORS.warn;
  return KPI_RATE_COLORS.bad;
}
