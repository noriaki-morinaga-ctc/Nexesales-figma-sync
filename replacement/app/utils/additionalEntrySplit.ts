// 支払詳細(追加口請求書有)の追加口分割 ─ 計算ロジック。
//
// 追加口の明細を商流販売店ごとのケース・バラで分割する（→ 20260825_第32回 決定事項3・4）。
//   ・分割先の金額 ＝（ケース × 入数 ＋ バラ）× 追加口バラ単価（単価は分割元の単価をそのまま使う）
//   ・自部署負担分 ＝ 支払ケース・支払バラ − 分割先の合計（入力できない。残りが自動で入る）
//   ・自部署負担分の金額 ＝ 追加口金額 − 分割先の金額の合計（単価の端数のズレは自部署で吸収する
//     → 第33回 決定事項8・12）
//   ・合計は必ず一致するため、［設定］時の一致検証は行わない（→ 20260901_第33回 決定事項12）
//   ・分割元の支払がプラスで自部署負担分がマイナスの明細だけアラートを出す。
//     返品などで分割元の支払自体がマイナスの明細は対象外（→ 第33回 決定事項10・11）
//
// 端数はすべて四捨五入とする（小数の貼り付け・金額とも。→ 実装計画 暫定仕様）。
// 数量・金額はマイナス（返品）もあり得るため、四捨五入は符号に対して対称に行う。
import { parseFormulaNumber } from '../components/grid/gridCommon';

// 分割先1件・明細1行分の入力（追加口分割ペインで入力するケース・バラ）。
export interface SplitAllocation {
  lineNo: number | string; // 追加口明細の No.
  destId: string; // 分割先の商流販売店を識別するキー
  cases: number; // ケース
  loose: number; // バラ
}

// 分割の計算に使う追加口明細の項目（AdditionalEntryData の該当列）。
// 画面の行データは数値・文字列が混在するため、どちらも受け付ける。
export interface SplitSourceEntry {
  lineNo: number | string; // No.
  capacity: number | string; // 入数
  payCases: number | string; // 支払ケース
  payLoose: number | string; // 支払バラ
  addUnit: number | string; // 追加口バラ単価
}

// ケース・バラの組。
export interface CaseLoose {
  cases: number;
  loose: number;
}

// 分割先へ出した分の合計（支払情報サマリの再計算に使う）。
export interface SplitOutTotal {
  cases: number; // ケース合計
  loose: number; // バラ合計
  caseEquivalent: number; // バラを入数でケースに換算して足したケース数（四捨五入）
  addAmount: number; // 追加口金額の合計
}

// 数値へ変換する。空・非数は 0 として扱い、計算を止めない。
const toNumber = (value: unknown): number => {
  const n = parseFormulaNumber(value);
  return Number.isFinite(n) ? n : 0;
};

// 符号に対して対称な四捨五入（-12.5 → -13）。Math.round は -12.5 を -12 に丸めるため使わない。
// -0.4 などが -0 にならないよう、0 はそのまま 0 を返す（表示・比較で -0 を出さない）。
export const roundHalfAway = (value: number): number => {
  const rounded = Math.sign(value) * Math.round(Math.abs(value));
  return rounded === 0 ? 0 : rounded;
};

// 入力・貼り付けされたケース・バラを整数にする（小数は四捨五入、空・非数は 0）。
// Excel は表示が整数でも内部で小数を持つことがあるため、貼り付け時に整数へそろえる
//（→ 第33回 宿題事項1／課題1507）。
export const toIntegerCount = (value: unknown): number =>
  roundHalfAway(toNumber(value));

// 分割先1件の金額：（ケース × 入数 ＋ バラ）× 追加口バラ単価（四捨五入）。
export const calcSplitAmount = (
  cases: number | string,
  loose: number | string,
  capacity: number | string,
  addUnit: number | string
): number =>
  roundHalfAway(
    (toNumber(cases) * toNumber(capacity) + toNumber(loose)) * toNumber(addUnit)
  );

// 指定した明細の分割先入力だけを取り出す。
const allocationsOf = (
  lineNo: number | string,
  allocations: readonly SplitAllocation[]
): SplitAllocation[] =>
  allocations.filter((a) => String(a.lineNo) === String(lineNo));

// 自部署負担分のケース・バラ：支払ケース・支払バラ − 当該明細の分割先の合計。
export const calcSelfShare = (
  entry: SplitSourceEntry,
  allocations: readonly SplitAllocation[]
): CaseLoose => {
  const own = allocationsOf(entry.lineNo, allocations);
  const outCases = own.reduce((sum, a) => sum + a.cases, 0);
  const outLoose = own.reduce((sum, a) => sum + a.loose, 0);
  return {
    cases: toNumber(entry.payCases) - outCases,
    loose: toNumber(entry.payLoose) - outLoose,
  };
};

// 自部署負担分の金額：追加口金額 − 当該明細の分割先の金額の合計。
// 分割先の金額は1円未満を四捨五入するため、単価の端数によるズレは自部署負担分で吸収する。
// 追加口金額と「自部署＋分割先」の金額の合計は必ず一致する（→ 第33回 決定事項8・12）。
export const calcSelfShareAmount = (
  entry: SplitSourceEntry & { addAmount: number | string },
  allocations: readonly SplitAllocation[]
): number =>
  toNumber(entry.addAmount) -
  allocationsOf(entry.lineNo, allocations).reduce(
    (sum, a) =>
      sum + calcSplitAmount(a.cases, a.loose, entry.capacity, entry.addUnit),
    0
  );

// 自部署負担分のアラート要否。
// 分割元の支払（支払ケース・支払バラ）がプラスで、自部署負担分のケースまたはバラがマイナスの明細が対象。
// 分割元の支払がマイナス（返品など）の明細は、自部署負担分がマイナスになって当然のため対象外。
// アラートは表示のみで、［設定］は止めない（→ 第33回 決定事項11）。
export const isSelfShareAlert = (
  entry: SplitSourceEntry,
  allocations: readonly SplitAllocation[]
): boolean => {
  const payCases = toNumber(entry.payCases);
  const payLoose = toNumber(entry.payLoose);
  const isPositivePayment =
    payCases >= 0 && payLoose >= 0 && payCases + payLoose > 0;
  if (!isPositivePayment) return false;
  const self = calcSelfShare(entry, allocations);
  return self.cases < 0 || self.loose < 0;
};

// アラート対象の明細 No. の一覧（フッタの「No.2・No.8」表示に使う）。
export const alertLineNos = (
  entries: readonly SplitSourceEntry[],
  allocations: readonly SplitAllocation[]
): (number | string)[] =>
  entries.filter((e) => isSelfShareAlert(e, allocations)).map((e) => e.lineNo);

// 分割の有無。ケース・バラが 0 以外の入力が1件でもあれば「分割あり」。
// 全て 0 で［設定］した場合は「分割なし」に戻す（→ 実装計画 暫定仕様）。
export const hasAnySplit = (allocations: readonly SplitAllocation[]): boolean =>
  allocations.some((a) => a.cases !== 0 || a.loose !== 0);

// ケース・バラとも 0 の入力を除く。0 の組み合わせは分割先の明細として作らない
//（→ 実装計画 暫定仕様）。
export const effectiveAllocations = (
  allocations: readonly SplitAllocation[]
): SplitAllocation[] =>
  allocations.filter((a) => a.cases !== 0 || a.loose !== 0);

// 分割先へ出した分の合計（全明細・全分割先）。支払情報サマリで
// 分割前の値から差し引いて自部署負担分を求めるのに使う（→ 第33回 決定事項17）。
// 分割元の明細に無い No. の入力は無視する（明細削除・拡売費処理への移動の取り残し対策）。
export const sumSplitOut = (
  entries: readonly SplitSourceEntry[],
  allocations: readonly SplitAllocation[]
): SplitOutTotal => {
  let cases = 0;
  let loose = 0;
  let caseEquivalent = 0;
  let addAmount = 0;
  for (const entry of entries) {
    const capacity = toNumber(entry.capacity);
    for (const a of allocationsOf(entry.lineNo, allocations)) {
      cases += a.cases;
      loose += a.loose;
      // 入数が取れない明細はバラをケース換算できないため、ケースのみ数える。
      caseEquivalent += a.cases + (capacity > 0 ? a.loose / capacity : 0);
      addAmount += calcSplitAmount(a.cases, a.loose, capacity, entry.addUnit);
    }
  }
  return {
    cases,
    loose,
    caseEquivalent: roundHalfAway(caseEquivalent),
    addAmount,
  };
};

// 分割を編集できる支払ステータス（申請前・差戻し）。
// 申請後（承認待ち・検印待ち・検印済など）は［追加口分割］を押しても参照のみで開く。
// 申請後の上長確認で誤って変更されるのを防ぐため（→ 第33回 決定事項16）。
export const SPLIT_EDITABLE_STATUSES: readonly string[] = [
  '未申請',
  '承認差戻し',
  '検印差戻し',
];

// 当該ステータスの支払で分割を編集できるか。
export const isSplitEditable = (status: string): boolean =>
  SPLIT_EDITABLE_STATUSES.includes(status);
