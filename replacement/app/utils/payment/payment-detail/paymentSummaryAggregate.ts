// 支払詳細(追加口請求書有／追加口請求書無)の支払情報サマリ ─ 明細からの集計。
//
// 支払情報サマリの支払・実績情報の列のうち、支払の行（支払函数・追加口金額・拡売費）は
// 本画面の追加口明細と拡売費明細から集計する（→ 補足3-2 支払情報サマリの集計）。
// 集計の範囲は、同じ商流販売店・対象年月の「すべての支払回数」の明細とする。
//
//   支払函数            … 追加口明細の（支払ケース＋支払バラ÷入数）の合計。小数第1位を四捨五入。
//                          請求書有は函数無効チェックを付けた明細を含めない。
//   追加口金額          … 請求書有＝追加口明細の追加口金額の合計
//                          請求書無＝追加口明細の支払金額（＝追加口金額）の合計
//   拡売費（NET未承認） … 請求書有のみ。未承認NETの拡売費明細のうち、
//                          管理区分が値引き（売上連動）（1B3）の明細の支払金額の合計
//   拡売費（NET未承認以外） … 請求書有＝その他の拡売費明細の支払金額の合計
//                          （未承認NETで管理区分を変えた明細は、保存の前でもこちらへ入れる）
//                          請求書無＝拡売費明細の支払金額の合計
// 拡売費の枝番行（分割先）は金額が親行の内訳のため含めない（合計表と同じ）。
//
// 実販函数・納品金額・社外売上高（実販FACT）は本画面の明細からは集計しない。
import { parseFormulaNumber } from '@/app/components/grid/gridCommon';
import {
  roundHalfAway,
  sumSplitOut,
  type SplitAllocation,
  type SplitOutTotal,
  type SplitSourceEntry,
} from './additionalEntrySplit';
import {
  applySplitToSummary,
  derivedColumnsOf,
  type SummaryPayAfterSplit,
} from './paymentSummarySplit';

// 未承認NET拡売費の管理区分（名称）。区分値は 1B3。
// 拡売費明細は管理区分を名称で保持するため、判定も名称で行う。
export const NET_UNAPPROVED_MGMT_CLASS_NAME = '値引き（売上連動）';

// 拡売費の枝番行（費用分割の分割先）の分割列の値。
const SPLIT_DEST_COST_SPLIT = '分割先';

// 集計に使う追加口明細の項目（画面の行データは数値・文字列が混在するため、どちらも受け付ける）。
export interface SummaryEntryRow {
  isTotal?: boolean; // 合計行（集計対象外）
  productName?: string; // サマリ商品名（未承認NET拡売費との連動に使う）
  capacity: number | string; // 入数
  payCases: number | string; // 支払ケース
  payLoose: number | string; // 支払バラ
  addAmount: number | string; // 追加口金額
  payAmount: number | string; // 支払金額
  expAmount?: number | string; // 拡売費金額（NET未承認）。請求書有のみ
  funcCheck?: boolean | string; // 函数無効チェック。請求書有のみ
}

// 集計に使う拡売費明細の項目。
export interface SummaryExpenseRow {
  isGroup?: boolean; // グループ合計行（集計対象外）
  isTotal?: boolean; // 総合計行（集計対象外）
  isNetUnapproved?: boolean; // 未承認NETの明細
  payAmountManual?: boolean; // 未承認NETの支払金額を手入力した明細
  costSplit?: string; // 分割列（「分割先」は枝番行）
  mgmtClass?: string; // 管理区分（名称）
  product?: string; // サマリ商品名
  payAmount: number | string; // 支払金額
  billAmount?: number | string; // 請求金額
}

// 支払回数1回分の明細。
export interface SummaryRoundRows {
  entryRows: readonly SummaryEntryRow[];
  expenseRows: readonly SummaryExpenseRow[];
}

// 請求書有／請求書無（集計の式が異なる）。
export type SummaryVariant = 'with-invoice' | 'without-invoice';

// 明細から集計した支払の行の値（分割前。全支払回数の合計）。
export interface SummaryDetailTotals {
  payFunc: number; // 支払函数（小数第1位を四捨五入）
  addEntryAmount: number; // 追加口金額
  promoNetUnapproved: number; // 拡売費（NET未承認）。請求書無は 0
  promoLinked: number; // 拡売費（NET未承認以外）
}

// 数値化できない値（空欄・「-」など）は 0 として数える。
const numberOf = (value: unknown): number => {
  const n = parseFormulaNumber(value);
  return Number.isFinite(n) ? n : 0;
};

// 追加口明細1行の支払のケース換算（支払ケース＋支払バラ÷入数）。
// 入数が取れない明細はバラをケースに換算できないため、ケースだけを数える（分割の換算と同じ）。
export const payCaseEquivalentOf = (row: SummaryEntryRow): number => {
  const capacity = numberOf(row.capacity);
  return (
    numberOf(row.payCases) +
    (capacity > 0 ? numberOf(row.payLoose) / capacity : 0)
  );
};

// 支払函数の集計対象の明細か。請求書有は函数無効チェックを付けた明細を除く。
const isPayFuncTarget = (
  row: SummaryEntryRow,
  variant: SummaryVariant
): boolean =>
  !row.isTotal && !(variant === 'with-invoice' && row.funcCheck === true);

// 追加口明細の、サマリ商品ごとの拡売費金額（NET未承認）の合計。
// 拡売費一覧の未承認NET明細は、この値を支払金額として参照する（追加口一覧との連動）。
export const netUnapprovedByProduct = (
  entryRows: readonly SummaryEntryRow[]
): Record<string, number> => {
  const byProduct: Record<string, number> = {};
  for (const row of entryRows) {
    if (row.isTotal) continue;
    const name = String(row.productName ?? '');
    if (!name) continue;
    byProduct[name] = (byProduct[name] ?? 0) + numberOf(row.expAmount);
  }
  return byProduct;
};

// 拡売費明細1行の支払金額（拡売費一覧の数式を適用したあとの値）。
//   ・未承認NETの明細は、追加口明細の同じサマリ商品の拡売費金額（NET未承認）を参照する。
//     支払金額を手入力した明細と、追加口明細に同じサマリ商品が無い明細は、明細の値のまま。
//   ・その他の明細で支払金額が空欄なら、請求金額を初期値とする。
// 表示中でない支払回の明細は一覧の数式が掛かっていないため、ここで同じ導出をそろえる。
export const effectiveExpensePayAmount = (
  row: SummaryExpenseRow,
  netByProduct?: Readonly<Record<string, number>>
): number => {
  if (row.isNetUnapproved && !row.payAmountManual) {
    const linked = netByProduct?.[String(row.product ?? '')];
    if (linked != null) return linked;
  }
  if (
    !row.isNetUnapproved &&
    (row.payAmount === '' || row.payAmount == null) &&
    Number.isFinite(parseFormulaNumber(row.billAmount))
  ) {
    return numberOf(row.billAmount);
  }
  return numberOf(row.payAmount);
};

// 拡売費の集計対象の明細か（グループ合計行・総合計行・枝番行を除く）。
const isExpenseDetail = (row: SummaryExpenseRow): boolean =>
  !row.isGroup && !row.isTotal && row.costSplit !== SPLIT_DEST_COST_SPLIT;

// 拡売費（NET未承認）へ入れる明細か（請求書有）。
// 未承認NETの明細のうち、管理区分が値引き（売上連動）のままの明細だけが対象。
const isNetUnapprovedTarget = (row: SummaryExpenseRow): boolean =>
  !!row.isNetUnapproved && row.mgmtClass === NET_UNAPPROVED_MGMT_CLASS_NAME;

// 支払回数1回分の明細を集計する（支払函数は四捨五入する前の値）。
const aggregateRound = (
  round: SummaryRoundRows,
  variant: SummaryVariant
): SummaryDetailTotals => {
  let payFunc = 0;
  let addEntryAmount = 0;
  for (const row of round.entryRows) {
    if (row.isTotal) continue;
    if (isPayFuncTarget(row, variant)) payFunc += payCaseEquivalentOf(row);
    addEntryAmount += numberOf(
      variant === 'with-invoice' ? row.addAmount : row.payAmount
    );
  }

  const netByProduct =
    variant === 'with-invoice'
      ? netUnapprovedByProduct(round.entryRows)
      : undefined;
  let promoNetUnapproved = 0;
  let promoLinked = 0;
  for (const row of round.expenseRows) {
    if (!isExpenseDetail(row)) continue;
    const pay = effectiveExpensePayAmount(row, netByProduct);
    if (variant === 'with-invoice' && isNetUnapprovedTarget(row)) {
      promoNetUnapproved += pay;
    } else {
      promoLinked += pay;
    }
  }
  // 未承認NETの明細がまだ無いサマリ商品の拡売費金額（NET未承認）も、拡売費（NET未承認）へ入れる。
  // 担当者が支払NETを直して新たに差が出たサマリ商品は、拡売費一覧が未承認NETの明細を足すが
  // （→ PaymentNonProductExpensePane）、表示中でない支払回の明細にはその行が無いため。
  if (netByProduct) {
    for (const [product, amount] of Object.entries(netByProduct)) {
      const hasNetRow = round.expenseRows.some(
        (row) => !!row.isNetUnapproved && row.product === product
      );
      if (!hasNetRow) promoNetUnapproved += amount;
    }
  }
  return { payFunc, addEntryAmount, promoNetUnapproved, promoLinked };
};

// 全支払回数の明細を集計する。支払函数は合計してから小数第1位を四捨五入する。
export const aggregateSummaryDetails = (
  rounds: readonly SummaryRoundRows[],
  variant: SummaryVariant
): SummaryDetailTotals => {
  const total = rounds.reduce<SummaryDetailTotals>(
    (sum, round) => {
      const r = aggregateRound(round, variant);
      return {
        payFunc: sum.payFunc + r.payFunc,
        addEntryAmount: sum.addEntryAmount + r.addEntryAmount,
        promoNetUnapproved: sum.promoNetUnapproved + r.promoNetUnapproved,
        promoLinked: sum.promoLinked + r.promoLinked,
      };
    },
    { payFunc: 0, addEntryAmount: 0, promoNetUnapproved: 0, promoLinked: 0 }
  );
  return { ...total, payFunc: roundHalfAway(total.payFunc) };
};

// 全支払回数の、分割先へ出した分の合計（バラは入数でケース換算）。
// 追加口分割は支払回数ごとに持つが、支払情報サマリは支払回数をまたいで合計するため、
// 全回の分割を合計する（→ 第33回 決定事項17）。分割の無い回・明細の無い回は0。
export const totalSplitOut = (
  splitByRound: Readonly<
    Record<string, { allocations: readonly SplitAllocation[] }>
  >,
  entryRowsByRound: Readonly<Record<string, readonly SplitSourceEntry[]>>
): Pick<SplitOutTotal, 'caseEquivalent' | 'addAmount'> => {
  let caseEquivalent = 0;
  let addAmount = 0;
  for (const [round, split] of Object.entries(splitByRound)) {
    const total = sumSplitOut(entryRowsByRound[round] ?? [], split.allocations);
    caseEquivalent += total.caseEquivalent;
    addAmount += total.addAmount;
  }
  return { caseEquivalent, addAmount };
};

// ── 支払・実績情報の列の値 ──────────────────────────────

// 支払情報サマリの固定値（画面に元データが無い値）。
//   社外売上高・納品金額 … 実販FACT から集計する値（本画面の明細からは集計しない）
//   管理利益額の基準     … 管理利益額は式が定義されていないため、見本の管理利益額に
//                          「売上高の見本からの増減」を足して近似する。その基準の組
export interface SummaryFixedValues {
  externalSales: number; // 社外売上高
  deliveryAmount: number; // 納品金額
  salesBasis: number; // 管理利益額の近似の基準にする売上高（見本の値）
  mgmtProfitBasis: number; // 管理利益額の近似の基準にする管理利益額（見本の値）
}

// 支払・実績情報の列のうち、明細から求める行の値（追加口分割の反映後）。
export type SummaryPayValues = SummaryPayAfterSplit &
  Pick<SummaryDetailTotals, 'promoNetUnapproved' | 'promoLinked'>;

// 明細の合計（分割前）と固定値から、支払・実績情報の列の値を求める。
//   支払函数・追加口金額 … 明細の合計 − 分割先へ出した分（追加口分割の自部署負担分）
//   拡売費               … 明細の合計（分割の対象外）
//   支払NET売上高・売上高・追加口率・マージン率・管理利益率 … 今の式で計算し直す
//   管理利益額           … 基準の管理利益額 ＋（売上高 − 基準の売上高）
// 請求書無は拡売費（NET未承認）が 0 のため、同じ式で請求書無の式（NET未承認を引かない）になる。
export const summaryPayValuesOf = (
  details: SummaryDetailTotals,
  fixed: SummaryFixedValues,
  splitOut: Pick<SplitOutTotal, 'caseEquivalent' | 'addAmount'> = {
    caseEquivalent: 0,
    addAmount: 0,
  }
): SummaryPayValues => {
  // 分割前の売上高。管理利益額の基準からの増減はここから数え、分割の増減は
  // applySplitToSummary が同じ考え方（売上高の増減）で足す。
  const salesBeforeSplit =
    fixed.externalSales -
    details.addEntryAmount -
    details.promoNetUnapproved -
    details.promoLinked;
  const after = applySplitToSummary(
    {
      payFunc: details.payFunc,
      addEntryAmount: details.addEntryAmount,
      externalSales: fixed.externalSales,
      deliveryAmount: fixed.deliveryAmount,
      promoNetUnapproved: details.promoNetUnapproved,
      promoLinked: details.promoLinked,
      mgmtProfitAmount:
        fixed.mgmtProfitBasis + (salesBeforeSplit - fixed.salesBasis),
    },
    splitOut
  );
  return {
    ...after,
    promoNetUnapproved: details.promoNetUnapproved,
    promoLinked: details.promoLinked,
  };
};

// ── サマリ表の行への反映 ──────────────────────────────

// 行の種類。amount＝金額、rate＝率（百分率）、count＝函数。
export type SummaryRowKind = 'amount' | 'rate' | 'count';

// サマリ表の1行（列キー → 表示値）。
export interface SummaryValueRow {
  key: string;
  kind: SummaryRowKind;
  vals: Record<string, string>;
}

// 率は小数1桁の百分率、金額・函数は整数の3桁区切りで表示する。数値でなければ空欄。
// 小数1桁の百分率（-0.0% は 0.0% と表示する）。
const percentText = (value: number): string => {
  const fixed = value.toFixed(1);
  return `${fixed === '-0.0' ? '0.0' : fixed}%`;
};
const formatSummaryValue = (kind: SummaryRowKind, value: number): string => {
  if (!Number.isFinite(value)) return '';
  if (kind === 'rate') return percentText(value);
  const rounded = Math.round(value);
  // -0 を「-0」と出さない
  return (rounded === 0 ? 0 : rounded).toLocaleString();
};
const formatRatio = (value: number): string =>
  Number.isFinite(value) ? percentText(value) : '';

// 支払・実績情報の列へ値を入れ、差・計画誤差率・前年比を列方向の式で求め直す。
//   payByKey にある行 … 支払・実績情報をその値に置き換える
//   それ以外の行     … 支払・実績情報は行定義の値（固定値）のまま
// 差・計画誤差率・前年比は全行で求め直す（率の行の差はポイント差）。
// 販売計画書・前年実績が数値でない（「–」など）場合は、行定義の表示のままにする。
export const fillSummaryRowValues = <T extends SummaryValueRow>(
  rows: readonly T[],
  payByKey: Readonly<Partial<Record<string, number>>>
): T[] =>
  rows.map((row) => {
    const payValue = payByKey[row.key];
    const pay =
      payValue === undefined
        ? parseFormulaNumber(row.vals.pay)
        : (payValue as number);
    const derived = derivedColumnsOf(
      pay,
      parseFormulaNumber(row.vals.plan),
      parseFormulaNumber(row.vals.prev)
    );
    return {
      ...row,
      vals: {
        ...row.vals,
        pay:
          payValue === undefined
            ? (row.vals.pay ?? '')
            : formatSummaryValue(row.kind, pay),
        diff: Number.isFinite(derived.diff)
          ? formatSummaryValue(row.kind, derived.diff)
          : (row.vals.diff ?? ''),
        errRate: Number.isFinite(derived.errRate)
          ? formatRatio(derived.errRate)
          : (row.vals.errRate ?? ''),
        yoy: Number.isFinite(derived.yoy)
          ? formatRatio(derived.yoy)
          : (row.vals.yoy ?? ''),
      },
    };
  });
