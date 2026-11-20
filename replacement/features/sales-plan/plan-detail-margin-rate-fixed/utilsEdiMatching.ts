// 計画詳細(マージン率固定)：実販EDI（実販FACT）と計画行の突合（補足8-7.EDI反映 マッチングUI）。
// 画面の状態を持たない処理だけを置く（状態と操作は useEdiMatching.ts、列は utilsEdiColumns.tsx）。
//
// 前提（補足8-1 マージン率固定の反映ルール。実販EDIの反映のときに上から順に判定する）：
//   ① 同じサマリ商品で、反映済みの同じEDI納価の行に加算する
//   ② ①が無ければ、同じサマリ商品・同じ計画納価の行に反映する
//   ③ ②が複数あれば、商品区分・販促区分の優先順位の順で選んだ1行に反映する
//   ④ ①〜③のいずれにも当てはまらなければ、計画行を追加する（入力・選択欄は空欄。突合の状態「追加」）
// ④で追加された行を、担当者が同じサマリ商品の元の計画行へ寄せる（手動の突合）のが本画面の処理。
// 追加された行への入力と元の行の削除を、1回の操作で済ませるため（課題 No.0596・決定事項 No.565）。
// 突合しなければ、追加された行は計画行のまま残り、担当者が入力して使う。

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
  auto1: '自動',
  auto2: '自動',
  auto3: '自動',
  manual: '手動',
  added: '追加',
};

// 行頭マーカーのツールチップ（どのように成立したか。補足8-7 ②）
export const EDI_STATUS_DESCRIPTIONS: Record<EdiMatchStatus, string> = {
  auto1:
    '自動（ルール①）：同じサマリ商品で、反映済みの同じEDI納価の行に加算した',
  auto2: '自動（ルール②）：同じサマリ商品・同じ計画納価の行に反映した',
  auto3:
    '自動（ルール③）：同じ計画納価の行が複数あるため、商品区分・販促区分の優先順位で選んだ行に反映した',
  manual:
    '手動：担当者が突合した行（保存するまでは行頭の取消で突合の前に戻せる）',
  added:
    '追加（ルール④）：一致する計画納価が無いため、実販EDIの反映で追加した行。商品区分・販促区分・計画函数・納価・売価を入力するか、同じサマリ商品の計画行へ突合する',
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

// 実販EDIの反映で追加された行か（反映ルール④。突合の元になる行）
export const isAddedByEdiRow = (row: ProductData | undefined): boolean =>
  row?.ediMatchStatus === 'added';

// 突合先の候補になる計画行か（補足8-7 ⑤）：同じサマリ商品で、まだ実販EDIを反映していない計画行。
// 反映済みの行（追加の行を含む）は外す（同じEDI納価の実績はルール①で自動で加算されるため）。
// ギフトは上旬・中旬・下旬の3行で当月実績を1つ持つため、1行を選ぶ突合の対象にしない。
export function isEdiMatchCandidate(
  row: ProductData | undefined,
  summaryProduct: string
): boolean {
  if (!row || row._isHeader) return false;
  if (row.section === 'ギフト') return false;
  return row.summaryProduct === summaryProduct && !hasValue(row.ediPrice);
}

// 突合できない理由。突合できるときは null（補足8-7 ⑤：同じサマリ商品・双方が未突合の1対1に限る）。
export function ediMatchErrorOf(
  planRow: ProductData | undefined,
  edi: EdiActual | undefined
): string | null {
  if (!edi || edi.status !== 'added') {
    return '実販EDIで追加した行（行頭が「追加」の行）を1行選んでください。';
  }
  if (!planRow || planRow._isHeader || isAddedByEdiRow(planRow)) {
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
    _ediMatchUnsaved: true,
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
    _ediMatchUnsaved: undefined,
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
    _ediMatchUnsaved: undefined,
  };
}

// 実販EDIの反映で追加する計画行の id
export const addedRowIdOf = (edi: EdiActual): string => `edi-added-${edi.id}`;

// 実販EDIの反映で追加する計画行（補足8-1 ルール④）。突合を取り消したときに作り直すのにも使う。
// 入力・選択欄（商品区分・販促区分・計画函数・納価・売価）は空欄のまま追加し、担当者が入力する。
export function addedPlanRowOf(edi: EdiActual, section: string): ProductData {
  const master = SUMMARY_PRODUCT_BY_VALUE.get(edi.summaryProduct);
  return {
    ...makeEmptyProduct(section),
    id: addedRowIdOf(edi),
    productCategory: '',
    metaBrand: master?.metaBrand ?? '',
    containerCapacityG: master?.containerCapacityG ?? '',
    summaryProduct: edi.summaryProduct,
    wholesaleMesh: master?.wholesaleMesh ?? '',
    quantity: master?.quantity ?? '',
    actual: edi.count,
    ediPrice: formatEdiPrice(edi.ediPrice),
    ediMatchStatus: 'added',
    _ediActualId: edi.id,
  };
}

type Sections = Record<string, ProductData[]>;

// 突合した後の商品区分ごとの行：突合先の計画行を置き換え、追加の行を消す（1行にまとめる）。
export function sectionsAfterMatch(
  sections: Sections,
  matchedRow: ProductData,
  addedRowId: string
): Sections {
  return Object.fromEntries(
    Object.entries(sections).map(([section, rows]) => [
      section,
      rows
        .filter((row) => row.id !== addedRowId)
        .map((row) => (row.id === matchedRow.id ? matchedRow : row)),
    ])
  );
}

// 突合を取り消した後の商品区分ごとの行：計画行を反映の前に戻し、その直下に追加の行を作り直す。
export function sectionsAfterCancel(
  sections: Sections,
  restoredRow: ProductData,
  edi: EdiActual
): Sections {
  return Object.fromEntries(
    Object.entries(sections).map(([section, rows]) => {
      const index = rows.findIndex((row) => row.id === restoredRow.id);
      if (index < 0) return [section, rows];
      return [
        section,
        [
          ...rows.slice(0, index),
          restoredRow,
          addedPlanRowOf(edi, section),
          ...rows.slice(index + 1),
        ],
      ];
    })
  );
}

// 追加の行のツールチップ：一致する計画納価が無いことと、突合先の候補（補足8-7 図1-1 の案内）。
export function addedRowHintOf(
  edi: EdiActual,
  planRows: ProductData[]
): string {
  const price = formatEdiPrice(edi.ediPrice);
  const candidates = planRows.filter((row) =>
    isEdiMatchCandidate(row, edi.summaryProduct)
  );
  const head = `実販EDI（EDI納価 ${price}／実販函数 ${edi.count}）：一致する計画納価が無いため、行を追加しました。`;
  const onInput =
    '商品区分・販促区分・計画函数・納価・売価を入力してください。';
  if (candidates.length === 0) {
    return `${head}\n${onInput}（突合できる計画行はありません）`;
  }
  const list = candidates
    .map(
      (row) =>
        `${row.productCategory || '-'}・${row.promotion || '-'}（計画${
          formatEdiPrice(row.planPrice) || '-'
        }／差 ${ediPriceDiffText(row.planPrice, edi.ediPrice) || '-'}）`
    )
    .join('、');
  return `${head}\n突合先の候補：${list}\n計画行へドラッグするか、計画行と一緒に選んで「選択した2行を突合」を押すと、その計画行へまとめます。突合しない場合は、${onInput}`;
}
