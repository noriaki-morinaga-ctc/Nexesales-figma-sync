// 計画詳細(マージン率固定)：実販EDI（実販FACT）と計画行の突合（補足8-7.EDI反映 マッチングUI）。
// 画面の状態を持たない処理だけを置く（状態と操作は useEdiMatching.ts、列は utilsEdiColumns.tsx）。
//
// 前提（補足8-1 マージン率固定の反映ルール。上から順に判定する）：
//   ① 同じサマリ商品で、反映済みの同じEDI納価の行に加算する
//   ② ①が無ければ、同じサマリ商品・同じ計画納価の行に反映する
//   ③ ②が複数あれば、商品区分・販促区分の優先順位の順で選んだ1行に反映する
//   ④ ①〜③のいずれにも当てはまらなければ、計画納価が空欄の行を追加する
// ①〜③で反映先が決まらなかった実販EDI（未突合）を、④で行を追加する前に担当者が
// 計画行へ寄せられるようにする（手動の突合）のが本画面の処理。

import { SUMMARY_PRODUCT_BY_VALUE } from '@/constants/productMasters';
import type {
  EdiActual,
  EdiMatchStatus,
  ProductData,
} from '@/types/salesPlanRetail';
import {
  PLAN_DETAIL_DIGITS,
  roundPlanNumber,
} from '@/utils/sales-plan/common/planDetailNumberFormat';
import { makeEmptyProduct } from '@/utils/sales-plan/plan-detail/planDetailEmptyRow';

// 行頭マーカーの文言（補足8-7 ②：突合の状態をそのまま出す。自動はルール①〜③をまとめて「自動」）
export const EDI_MARKER_LABELS: Record<EdiMatchStatus, string> = {
  unmatched: '未突合',
  auto1: '自動',
  auto2: '自動',
  auto3: '自動',
  manual: '手動',
  added: '追加',
};

// 行頭マーカーのツールチップ（どのように成立したか。補足8-7 ②）
export const EDI_STATUS_DESCRIPTIONS: Record<EdiMatchStatus, string> = {
  unmatched:
    '未突合：一致する計画納価が無い実販EDI。計画行へドラッグするか、計画行と一緒に選んで突合する',
  auto1:
    '自動（ルール①）：同じサマリ商品で、反映済みの同じEDI納価の行に加算した',
  auto2: '自動（ルール②）：同じサマリ商品・同じ計画納価の行に反映した',
  auto3:
    '自動（ルール③）：同じ計画納価の行が複数あるため、商品区分・販促区分の優先順位で選んだ行に反映した',
  manual: '手動：担当者が突合した行（行頭の取消で突合の前に戻せる）',
  added:
    '追加：未突合のまま保存したため、計画納価が空欄の明細として追加した行（商品区分・販促区分・計画函数・納価・売価を入力する）',
};

const toNumber = (value: unknown): number => {
  const num = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(num) ? num : 0;
};

const hasValue = (value: unknown): boolean => String(value ?? '').trim() !== '';

// 納価を小数第2位の文字列にする（空欄は空欄のまま）
export const formatEdiPrice = (value: unknown): string =>
  hasValue(value)
    ? roundPlanNumber(toNumber(value), PLAN_DETAIL_DIGITS.price)
    : '';

// 納価を銭（整数）にする。小数の誤差で一致の判定を誤らないようにする。
const toSen = (value: unknown): number => Math.round(toNumber(value) * 100);

// 計画納価とEDI納価が違うか。両方に値があるときだけ判定する
// （手動で突合した行・閾値内で反映した行で起きる。補足8-7 ③）。
export const isEdiPriceDifferent = (
  planPrice: unknown,
  ediPrice: unknown
): boolean =>
  hasValue(planPrice) &&
  hasValue(ediPrice) &&
  toSen(planPrice) !== toSen(ediPrice);

// 差（EDI納価 − 計画納価）の表示。マイナスは「−」、プラスは「+」を付ける。
// どちらかが空欄のときは空文字。
export function ediPriceDiffText(
  planPrice: unknown,
  ediPrice: unknown
): string {
  if (!hasValue(planPrice) || !hasValue(ediPrice)) return '';
  const diffSen = toSen(ediPrice) - toSen(planPrice);
  const abs = roundPlanNumber(
    Math.abs(diffSen) / 100,
    PLAN_DETAIL_DIGITS.price
  );
  if (diffSen < 0) return `−${abs}`;
  if (diffSen > 0) return `+${abs}`;
  return abs;
}

// 突合先の候補になる計画行か（補足8-7 ⑤）：同じサマリ商品で、まだ実販EDIを反映していない計画行。
// 反映済みの行は外す（同じEDI納価の実績はルール①で自動で加算されるため、未突合の寄せ先にはしない）。
// ギフトは上旬・中旬・下旬の3行で当月実績を1つ持つため、1行を選ぶ突合の対象にしない。
export function isEdiMatchCandidate(
  row: ProductData | undefined,
  summaryProduct: string
): boolean {
  if (!row || row._ediRow || row._isHeader) return false;
  if (row.section === 'ギフト') return false;
  return row.summaryProduct === summaryProduct && !hasValue(row.ediPrice);
}

// 突合できない理由。突合できるときは null（補足8-7 ⑤：同じサマリ商品・双方が未突合の1対1に限る）。
export function ediMatchErrorOf(
  planRow: ProductData | undefined,
  edi: EdiActual | undefined
): string | null {
  if (!edi || edi.status !== 'unmatched') {
    return '未突合のEDI行を1行選んでください。';
  }
  if (!planRow || planRow._ediRow || planRow._isHeader) {
    return '突合先の計画行を1行選んでください。';
  }
  if (planRow.summaryProduct !== edi.summaryProduct) {
    return 'サマリ商品が違う計画行には突合できません。同じサマリ商品の計画行を選んでください。';
  }
  if (planRow.section === 'ギフト') {
    return 'ギフトの行には突合できません。';
  }
  if (hasValue(planRow.ediPrice)) {
    return '実販EDIを反映済みの計画行には突合できません。';
  }
  return null;
}

// 手動で突合した後の計画行。入るのは実販函数（当月実績に加算）とEDI納価だけで、
// 計画納価は書き換えない（補足8-7 ⑧。計画納価との違いは計画納価の色塗りで示す → ③）。
export function matchedPlanRowOf(
  planRow: ProductData,
  edi: EdiActual
): ProductData {
  return {
    ...planRow,
    actual: String(toNumber(planRow.actual) + toNumber(edi.count)),
    ediPrice: formatEdiPrice(edi.ediPrice),
    ediMatchStatus: 'manual',
    _ediActualId: edi.id,
  };
}

// 突合を取り消した後の計画行。実販EDIを反映する前に戻す（補足8-7 ④）。
export function unmatchedPlanRowOf(
  planRow: ProductData,
  edi: EdiActual
): ProductData {
  const rest = toNumber(planRow.actual) - toNumber(edi.count);
  return {
    ...planRow,
    actual: rest > 0 ? String(rest) : '',
    ediPrice: '',
    ediMatchStatus: undefined,
    _ediActualId: undefined,
  };
}

// コピー・明細追加で作る行。突合は元の行のものなので、突合の状態とEDI納価は引き継がない
// （補足8-7 ⑦：EDI納価は突合した行にだけ入る。引き継ぐと、コピー先の取消で元の行の実績が外れる）。
export function withoutEdiMatch<T extends Partial<ProductData>>(row: T): T {
  return {
    ...row,
    ediPrice: '',
    ediMatchStatus: undefined,
    _ediActualId: undefined,
  };
}

// 未突合の実販EDIを出す表示専用の行（EDI行）。サマリ商品名・入数・実販函数・EDI納価だけを持ち、
// 計画側の項目は空にする（補足8-7 図1-1 の注記）。容器容量Gはサマリ商品を見分けるために出す。
export function ediRowOf(edi: EdiActual): ProductData {
  const master = SUMMARY_PRODUCT_BY_VALUE.get(edi.summaryProduct);
  return {
    ...makeEmptyProduct(''),
    id: `edi-${edi.id}`,
    productCategory: '',
    summaryProduct: edi.summaryProduct,
    containerCapacityG: master?.containerCapacityG ?? '',
    quantity: master?.quantity ?? '',
    actual: edi.count,
    ediPrice: formatEdiPrice(edi.ediPrice),
    _ediRow: true,
    _ediActualId: edi.id,
  };
}

// 未突合のまま保存した実販EDIから作る計画行（補足8-1 ルール④）。
// 入力・選択欄（商品区分・販促区分・計画函数・納価・売価）は空欄のまま追加し、担当者が入力する。
export function addedPlanRowOf(
  edi: EdiActual,
  section: string,
  id: string
): ProductData {
  const master = SUMMARY_PRODUCT_BY_VALUE.get(edi.summaryProduct);
  return {
    ...makeEmptyProduct(section),
    id,
    productCategory: '',
    metaBrand: master?.metaBrand ?? '',
    containerCapacityG: master?.containerCapacityG ?? '',
    summaryProduct: edi.summaryProduct,
    wholesaleMesh: master?.wholesaleMesh ?? '',
    quantity: master?.quantity ?? '',
    actual: edi.count,
    ediPrice: formatEdiPrice(edi.ediPrice),
    ediMatchStatus: 'added',
  };
}

// 行の並びの中で、指定したサマリ商品の最後の行の位置（無ければ -1）
const lastIndexOfProduct = (
  rows: ProductData[],
  summaryProduct: string
): number => {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i].summaryProduct === summaryProduct) return i;
  }
  return -1;
};

// EDI行を、同じサマリ商品の計画行の直下に差し込む（補足8-7 3.）。同じサマリ商品の行が
// 複数あるときは最後の行の下（ギフトは3行のセットの下）。同じサマリ商品の計画行が無いEDI行は先頭に置く。
export function insertEdiRows(
  planRows: ProductData[],
  ediRows: ProductData[]
): ProductData[] {
  const result = [...planRows];
  const heads: ProductData[] = [];
  ediRows.forEach((ediRow) => {
    const last = lastIndexOfProduct(result, ediRow.summaryProduct);
    if (last < 0) {
      heads.push(ediRow);
      return;
    }
    result.splice(last + 1, 0, ediRow);
  });
  return [...heads, ...result];
}

// 未突合のまま保存した実販EDIを、どの区分の配列のどこに追加するか。
// 同じサマリ商品の計画行の最後の行と同じ区分の、その行の直下に置く（EDI行があった位置で行に変わる）。
// 同じサマリ商品の計画行が無ければ定番商品の先頭。
export function addedRowPlacementOf(
  sections: Record<string, ProductData[]>,
  summaryProduct: string
): { section: string; index: number } {
  const entries = Object.entries(sections);
  for (let s = entries.length - 1; s >= 0; s -= 1) {
    const [section, rows] = entries[s];
    const last = lastIndexOfProduct(rows, summaryProduct);
    if (last >= 0) return { section, index: last + 1 };
  }
  return { section: '定番商品', index: 0 };
}

// EDI行のツールチップ：一致する計画納価が無いことと、突合先の候補（補足8-7 図1-1 の案内）。
export function ediRowHintOf(edi: EdiActual, planRows: ProductData[]): string {
  const price = formatEdiPrice(edi.ediPrice);
  const candidates = planRows.filter((row) =>
    isEdiMatchCandidate(row, edi.summaryProduct)
  );
  const head = `実販EDI（EDI納価 ${price}／実販函数 ${edi.count}）：一致する計画納価がありません。`;
  const onSave =
    '突合しないまま保存すると、計画納価が空欄の明細として追加されます。';
  if (candidates.length === 0) {
    return `${head}\n突合できる計画行がありません。${onSave}`;
  }
  const list = candidates
    .map(
      (row) =>
        `${row.productCategory || '-'}・${row.promotion || '-'}（計画${
          formatEdiPrice(row.planPrice) || '-'
        }／差 ${ediPriceDiffText(row.planPrice, edi.ediPrice) || '-'}）`
    )
    .join('、');
  return `${head}\n突合先の候補：${list}\n計画行へドラッグするか、計画行と一緒に選んで「選択した2行を突合」を押すと反映します。${onSave}`;
}
