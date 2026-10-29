// 販売計画(集計)のダミーマスタ。
//
// 計画詳細のグリッドは対象年月1か月分の行しか持たないが、集計は
// 年間・累計・月別(1〜12月)を要求する（補足3-2 の集計イメージ）。
// また補足3-1 の「量経追加口(金額)」「実原価」は [マスタ] 由来で明細表に列が無い。
// これらをここでダミーとして供給する。
//
// ※ 対象月の値はグリッドの入力値と一致させる（expandToMonths の要件）。
//    こうしておくと、対象月の集計値をグリッドの合計と突き合わせて検証できる。

// 月別展開に使う季節指数（index0=1月 … index11=12月）。飲料の一般的な繁閑を模した固定値。
export const SEASONAL_INDEX: readonly number[] = [
  0.92, 0.86, 0.95, 1.02, 1.1, 1.18, 1.3, 1.32, 1.12, 0.98, 0.9, 0.95,
];

// グリッドの対象月の値を、季節指数で12か月へ展開する。
// 対象月の要素は必ず入力値そのもの（丸め誤差で動かさない）。
export const expandToMonths = (
  baseValue: number,
  targetMonthIdx0: number
): number[] => {
  const pivot = SEASONAL_INDEX[targetMonthIdx0] ?? 1;
  return SEASONAL_INDEX.map((factor, index) =>
    index === targetMonthIdx0
      ? baseValue
      : Math.round((baseValue * factor) / pivot)
  );
};

// 月別系列を指定月数だけ後ろへずらす（12か月で循環）。
// 拡売費の「対象月基準 → 計上月基準」の読み替えに使用する。
export const shiftMonths = (series: number[], shift: number): number[] =>
  series.map((_, index) => series[(((index - shift) % 12) + 12) % 12]);

// 量経追加口率（対社外売上高）。集計軸メタブランド別のダミー値。
export const DEFAULT_VOLUME_ADD_RATE = 0.06;

const VOLUME_ADD_RATE_BY_BRAND: Record<string, number> = {
  三ツ矢: 0.07,
  ワンダ: 0.06,
  ウィルキンソン: 0.07,
  十六茶: 0.065,
  水: 0.05,
  カルピスコンク: 0.08,
  カルピスストレート: 0.075,
  モンスター: 0.09,
  ヘルスケア: 0.055,
  PB: 0.03,
  和紅茶: 0.06,
  その他: DEFAULT_VOLUME_ADD_RATE,
};

// 集計軸メタブランドから量経追加口率を引く。未登録は既定率。
export const volumeAddRateOf = (axisMetaBrand: string): number =>
  VOLUME_ADD_RATE_BY_BRAND[axisMetaBrand] ?? DEFAULT_VOLUME_ADD_RATE;

// 実原価 ＝ 支社受渡原価 × 係数（補足2-3 の2軸をモックで用意するための暫定係数）。
// 実原価は「オンラインCD × 年間計」の粒度で持つ想定だが、本モックではマスタを持たず係数で導出する。
export const ACTUAL_COST_FACTOR = 0.94;
