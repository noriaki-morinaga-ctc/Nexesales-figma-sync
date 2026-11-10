// 当月着地見込の算出ヘルパー（販売計画(詳細) 各画面で共通利用）。
//
// 当月着地見込 ＝ 当月実績 ÷ 当月実績反映日数 × 当月日数
//   ・当月日数：システム日付の当月の暦日数（例：2月=28/29、4月=30、7月=31）。
//   ・当月実績反映日数：モックではサマリ商品ごとに決定的な擬似乱数（10〜25日）を割り当てる。
//     同一商品では常に同じ日数となり、サマリ商品を変更すると着地見込も流動的に変わる。

// システム日付の当月日数。
export const CURRENT_MONTH_DAYS = (() => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
})();

// サマリ商品キーから決定的に当月実績反映日数（10〜25日）を生成する。
export const actualReflectDays = (key: string | undefined | null): number => {
  if (!key) return CURRENT_MONTH_DAYS;
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return 10 + (h % 16); // 10〜25日
};

// 当月着地見込を算出（当月実績が無い行は 0）。
// key はサマリ商品名（定番商品は一般卸メッシュ）を渡す。
export const currentMonthEstimate = (
  actual: number,
  key: string | undefined | null
): number => {
  if (!actual) return 0;
  return Math.round((actual / actualReflectDays(key)) * CURRENT_MONTH_DAYS);
};
