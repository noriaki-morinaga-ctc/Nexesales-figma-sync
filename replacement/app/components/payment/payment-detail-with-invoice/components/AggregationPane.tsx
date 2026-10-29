// Todo：朴：C追加口・拡売費支払モック修正中
// 支払詳細(追加口請求書有)画面の「支払情報サマリ」カード。
// 表は Excel「20260710_支払集計画面.xlsx」シート「★支払画面集計修正」に合わせ、
// 表示項目を行、情報の種類（支払・実績情報／販売計画書／差／計画誤差率／前年実績／前年比）を
// 列に置いた縦持ちの構成とする。行の並び順・項目名・計算式は同シートに準拠する。
import { useState, useMemo, type ReactNode } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ColGroupDef, GetRowIdParams } from 'ag-grid-community';
import { Minus, Plus } from 'lucide-react';
import {
  GRID_DEFAULT_COL_DEF,
  GRID_BASE_PROPS,
  gridFilterContextMenuItems,
  useGridColumnState,
  GRID_NUMBER_TEXT_FILTER,
} from '../../../grid';
import {
  formulaTooltip,
  parseFormulaNumber,
  type FormulaTemplate,
} from '../../../grid/gridCommon';
import { CollapsibleCard } from '../../../ui/collapsible-card';
import { CARD_TITLE_CLASS } from '../../../../../styles/commonStyles';
import { SPLIT_AFFECTED_SUMMARY_KEYS } from '../../../../utils/paymentSummarySplit';
import {
  fillSummaryRowValues,
  summaryPayValuesOf,
  type SummaryDetailTotals,
  type SummaryRowKind,
} from '../../../../utils/paymentSummaryAggregate';
import {
  WITH_INVOICE_ACTUAL_FUNC,
  WITH_INVOICE_SUMMARY_FIXED_VALUES,
} from '../../../../constants/paymentWithInvoiceMockData';
import type { SplitOutTotal } from '../../../../utils/additionalEntrySplit';

// 列（情報の種類）。差＝支払・実績情報−販売計画書、計画誤差率＝差／支払・実績情報、
// 前年比＝支払・実績情報／前年実績。
interface ColDefItem {
  key: string;
  name: string;
  width: number;
  // 金額行で表示単位（円／千円）の換算対象になる列。率の列（計画誤差率・前年比）は対象外。
  convertible?: boolean;
  // 列見出しの補足（Excelの吹き出しに対応）。
  tooltip?: string;
}

const COLS: ColDefItem[] = [
  {
    key: 'pay',
    name: '支払・実績情報',
    width: 130,
    convertible: true,
    tooltip:
      '同商流販売店で支払回数が増える場合は、加算していく（支払先が違う場合も）',
  },
  {
    key: 'plan',
    name: '販売計画書',
    width: 130,
    convertible: true,
    tooltip:
      '販売計画に複数商流がある場合は、支払対象の商流販売店分の計画数値を抽出する',
  },
  { key: 'diff', name: '差', width: 120, convertible: true },
  { key: 'errRate', name: '計画誤差率', width: 110 },
  { key: 'prev', name: '前年実績', width: 130, convertible: true },
  { key: 'yoy', name: '前年比', width: 100 },
];

// 列キー → 列名（列方向の計算式ツールチップの置換に使う）。
const COL_LABELS: Record<string, string> = Object.fromEntries(
  COLS.map((c) => [c.key, c.name])
);

// 列方向の計算式（同じ行の別列を参照する）。→ ★支払画面集計修正 の G／H／J 列。
const COL_FORMULAS: Record<string, FormulaTemplate> = {
  diff: { template: '{pay} − {plan}' },
  errRate: { template: '{diff} ÷ {pay}' },
  yoy: { template: '{pay} ÷ {prev}' },
};

// 算出しない（Excel の「ー」）セルの表示値。
const NOT_APPLICABLE = '–';

// 行（表示項目）。並び順・項目名は ★支払画面集計修正 の D4〜D18 に一致させる。
//   kind        … amount＝金額（表示単位の換算対象）、rate＝率、count＝函数
//   folded      … 「折り畳み」指定の内訳項目（既定では隠し、補助項目トグルで表示する）
//   source      … 実績算出元（実販FACT／支払情報／実績+支払）
//   payFormula  … 支払・実績情報 列の計算式（{key} は同じ列の別項目行を指す）
//   planFormula … 販売計画書・前年実績 列の計算式（計画側は算出経路が異なる項目がある）
//   note        … 空欄になる条件などの補足
type RowKind = SummaryRowKind;
interface RowDefItem {
  key: string;
  label: string;
  kind: RowKind;
  folded?: boolean;
  source: string;
  payFormula?: FormulaTemplate;
  planFormula?: FormulaTemplate;
  note?: string;
  vals: Record<string, string>;
  // 追加口の分割を反映した場合の、支払・実績情報セルの内訳（計算式を持たない取得値のみ）
  splitTip?: string;
}

// 販売計画書・前年実績の列は固定値。全支払回数の明細から求めた支払・実績情報と並べて
// 比率が自然になるよう、見本（★支払画面集計修正）の値を同じ比で縮めて置いた
//（率の行は見本のまま。函数は函数の比、金額は追加口金額の比で縮めた）。
// 支払・実績情報の列は、実販FACT の行（実販函数・納品金額・社外売上高）だけが固定値で、
// それ以外は明細から求める（→ buildSummaryRows）。
const formatCount = (value: number): string => value.toLocaleString();

const ROWS: RowDefItem[] = [
  {
    key: 'actualFunc',
    label: '実販函数',
    kind: 'count',
    source: '実販FACT',
    // 実販FACT（固定値 → constants/paymentWithInvoiceMockData）。明細から求めた支払函数
    //（初期表示 1,536）と並べて差が小さくなる値。
    vals: {
      pay: formatCount(WITH_INVOICE_ACTUAL_FUNC),
      plan: '1,544',
      prev: '1,527',
    },
  },
  {
    key: 'payFunc',
    label: '支払函数',
    kind: 'count',
    source: '支払情報',
    // 支払・実績情報は追加口明細から集計する（→ summaryPayValuesOf）。
    vals: {
      pay: '',
      plan: '1,544',
      prev: '1,527',
    },
  },
  {
    key: 'marginRate',
    label: 'マージン率',
    kind: 'rate',
    source: '支払情報',
    // ★支払画面集計修正 M6：（納品金額-支払NET売上高）/納品金額
    payFormula: {
      template: '（{deliveryAmount} − {payNetSales}）÷ {deliveryAmount}',
    },
    planFormula: {
      template: '（{deliveryAmount} − {payNetSales}）÷ {deliveryAmount}',
    },
    note: '納価未取得の場合は空欄',
    vals: {
      pay: '',
      plan: '10.0%',
      prev: '10.0%',
    },
  },
  {
    key: 'deliveryAmount',
    label: '納品金額',
    kind: 'amount',
    folded: true,
    source: '実販FACT',
    note: '納価未取得の場合は空欄',
    vals: {
      pay: formatCount(WITH_INVOICE_SUMMARY_FIXED_VALUES.deliveryAmount),
      plan: '3,576,000',
      prev: '3,341,000',
    },
  },
  {
    key: 'payNetSales',
    label: '支払NET売上高',
    kind: 'amount',
    folded: true,
    source: '支払情報',
    // ★支払画面集計修正 M8：社外売上高-追加口金額-拡売費（NET未承認）
    payFormula: {
      template: '{externalSales} − {addEntryAmount} − {promoNetUnapproved}',
    },
    vals: {
      pay: '',
      plan: '3,218,000',
      prev: '3,007,000',
    },
  },
  {
    key: 'addEntryAmount',
    label: '追加口金額',
    kind: 'amount',
    source: '支払情報',
    // 計画・前年は 社外売上高−支払NET売上高 で算出する（★支払画面集計修正 F9／I9）。
    planFormula: { template: '{externalSales} − {payNetSales}' },
    // 支払・実績情報は追加口明細から集計する（→ summaryPayValuesOf）。
    vals: {
      pay: '',
      plan: '2,344,000',
      prev: '2,260,000',
    },
  },
  {
    key: 'addEntryRate',
    label: '追加口率',
    kind: 'rate',
    source: '実績+支払',
    // ★支払画面集計修正 E10：追加口金額/社外売上高
    payFormula: { template: '{addEntryAmount} ÷ {externalSales}' },
    planFormula: { template: '{addEntryAmount} ÷ {externalSales}' },
    vals: {
      pay: '',
      plan: '42.1%',
      prev: '42.9%',
    },
  },
  {
    key: 'centerFeeRate',
    label: 'センターフィ率',
    kind: 'rate',
    source: '支払情報',
    // ★支払画面集計修正 M11：センターフィ額/納品金額
    payFormula: { template: '{centerFeeAmount} ÷ {deliveryAmount}' },
    note: '支払が無い場合は空欄',
    vals: {
      pay: '',
      plan: '2.5%',
      prev: '2.5%',
    },
  },
  {
    key: 'centerFeeAmount',
    label: 'センターフィ額',
    kind: 'amount',
    folded: true,
    source: '支払情報',
    // 計画・前年は 納品金額×センターフィ率 で算出する（★支払画面集計修正 F12／I12）。
    planFormula: { template: '{deliveryAmount} × {centerFeeRate}' },
    // 支払・実績情報は、追加口明細ごとの 社外売上高単価×数量×センターフィ率 の合計
    //（全支払回。社外売上高単価が納品金額に当たる）。
    // 合計表のセンターフィ（請求詳細のセンターフィの合算）とは別の値になる（→ buildSummaryRows）。
    note: '支払が無い場合は空欄。支払・実績情報は、追加口明細の「社外売上高単価×数量×センターフィ率」の合計（全支払回）',
    vals: {
      pay: '',
      plan: '89,400',
      prev: '83,525',
    },
  },
  {
    key: 'sales',
    label: '売上高',
    kind: 'amount',
    source: '実績+支払',
    // ★支払画面集計修正 M12：社外売上高-追加口金額-拡売費（NET未承認）-拡売費（NET未承認以外）
    payFormula: {
      template:
        '{externalSales} − {addEntryAmount} − {promoNetUnapproved} − {promoLinked}',
    },
    // 計画・前年は 支払NET売上高−拡売費（NET未承認以外）で算出する（F13／I13）。
    planFormula: { template: '{payNetSales} − {promoLinked}' },
    vals: {
      pay: '',
      plan: '2,984,000',
      prev: '2,773,000',
    },
  },
  {
    key: 'externalSales',
    label: '社外売上高',
    kind: 'amount',
    folded: true,
    source: '実販FACT',
    // 実販FACT（固定値 → constants/paymentWithInvoiceMockData）。明細から求めた追加口金額で、
    // 追加口率・マージン率が見本と同じ 42%・10% 前後になる値に置いた。
    vals: {
      pay: formatCount(WITH_INVOICE_SUMMARY_FIXED_VALUES.externalSales),
      plan: '5,562,000',
      prev: '5,267,000',
    },
  },
  {
    key: 'mgmtProfitAmount',
    label: '管理利益額',
    kind: 'amount',
    source: '実績+支払',
    // 計画・前年は 管理利益率×売上高 で算出する（★支払画面集計修正 F15／I15）。
    // 支払・実績側は管理利益額が与えられ、管理利益率をそこから求める。
    planFormula: { template: '{mgmtProfitRate} × {sales}' },
    vals: {
      pay: '',
      plan: '731,080',
      prev: '668,293',
    },
  },
  {
    key: 'mgmtProfitRate',
    label: '管理利益率',
    kind: 'rate',
    source: '実績+支払',
    // ★支払画面集計修正 E16：管理利益額/売上高
    payFormula: { template: '{mgmtProfitAmount} ÷ {sales}' },
    vals: {
      pay: '',
      plan: '24.5%',
      prev: '24.1%',
    },
  },
  {
    key: 'promoNetUnapproved',
    label: '拡売費（NET未承認）',
    kind: 'amount',
    source: '支払情報',
    note: '拡売費は計画時には商流情報を持たないが、支払時に入力するため、対象の商流販売店の支払画面に反映する',
    // 支払・実績情報は拡売費明細から集計する（→ summaryPayValuesOf）。
    vals: {
      pay: '',
      plan: NOT_APPLICABLE,
      diff: NOT_APPLICABLE,
      errRate: NOT_APPLICABLE,
      prev: '3,240',
    },
  },
  {
    key: 'promoLinked',
    label: '拡売費（NET未承認以外）',
    kind: 'amount',
    source: '支払情報',
    note: '拡売費は計画時には商流情報を持たないが、支払時に入力するため、対象の商流販売店の支払画面に反映する',
    // 支払・実績情報は拡売費明細から集計する（→ summaryPayValuesOf）。
    vals: {
      pay: '',
      plan: '234,000',
      prev: '234,000',
    },
  },
];

// 行ID（AG Grid 公式 getRowId）。表示項目名（行定義 ROWS の label）は行ごとに重複しない。
// モジュール直下に置いて参照を固定する（→ 02 §7.1）。
const getSummaryRowId = (params: GetRowIdParams<{ label: string }>): string =>
  params.data.label;

// 行キー → 項目名（行方向の計算式ツールチップの置換に使う）。
const ROW_LABELS: Record<string, string> = Object.fromEntries(
  ROWS.map((r) => [r.key, r.label])
);

// 函数の切り出し表示（実販・支払・その差）。全員が最初に見る値のため、
// 表とは別に上部へ抜き出して常に見えるようにする（→ ★支払画面集計修正 の注記）。
// 支払は追加口の分割を反映した値（分割後の自部署負担分）。差＝実販−支払。
const fnHighlightOf = (
  rows: RowDefItem[]
): { label: string; value: string; emphasis?: boolean }[] => {
  const payOf = (key: string) =>
    parseFormulaNumber(rows.find((r) => r.key === key)?.vals.pay);
  const pay = payOf('payFunc');
  const actual = payOf('actualFunc');
  const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString() : '');
  return [
    { label: '実販', value: fmt(actual) },
    { label: '支払', value: fmt(pay) },
    { label: '差', value: fmt(actual - pay), emphasis: true },
  ];
};

// ── 支払・実績情報の列（→ 補足3-2 支払情報サマリの集計） ──
// 支払の行（支払函数・追加口金額・拡売費）は、全支払回数の追加口明細・拡売費明細から集計した値
// （detailTotals）を使う。追加口を分割した支払は、分割後の自部署負担分（明細の合計 − 分割先へ
// 出した分）で計算する（→ 20260901_第33回 決定事項17）。追加口明細グリッドは分割前の値のまま。
// 支払NET売上高・売上高・追加口率・マージン率・管理利益率は今の式で計算し直し、
// センターフィ額は追加口明細から求めた値、センターフィ率＝センターフィ額÷納品金額とする。
// 実販函数・納品金額・社外売上高（実販FACT）と、販売計画書・前年実績の列は行定義の固定値。
// 差・計画誤差率・前年比は列方向の式で求める（→ fillSummaryRowValues）。

// 分割先へ出した分の合計（全支払回。バラは入数でケース換算）。
export type SummarySplitOut = Pick<
  SplitOutTotal,
  'caseEquivalent' | 'addAmount'
>;

// 支払・実績情報の列を求めるための固定値（実販FACT の値と、管理利益額の近似の基準）。
// 管理利益額は式が定義されていないため、基準の管理利益額に売上高の基準からの増減を足して
// 近似する（→ summaryPayValuesOf、constants/paymentWithInvoiceMockData）。
const SUMMARY_FIXED_VALUES = WITH_INVOICE_SUMMARY_FIXED_VALUES;

// 明細から求めた値を支払・実績情報の列へ入れた行定義を返す。
const buildSummaryRows = (
  detailTotals: SummaryDetailTotals,
  splitOut: SummarySplitOut,
  centerFeePayAmount: number
): RowDefItem[] => {
  const values = summaryPayValuesOf(
    detailTotals,
    SUMMARY_FIXED_VALUES,
    splitOut
  );
  const { deliveryAmount } = SUMMARY_FIXED_VALUES;
  const payByKey: Record<string, number> = {
    payFunc: values.payFunc,
    marginRate: values.marginRate,
    payNetSales: values.payNetSales,
    addEntryAmount: values.addEntryAmount,
    addEntryRate: values.addEntryRate,
    centerFeeRate:
      deliveryAmount > 0
        ? (centerFeePayAmount / deliveryAmount) * 100
        : Number.NaN,
    centerFeeAmount: centerFeePayAmount,
    sales: values.sales,
    mgmtProfitAmount: values.mgmtProfitAmount,
    mgmtProfitRate: values.mgmtProfitRate,
    promoNetUnapproved: values.promoNetUnapproved,
    promoLinked: values.promoLinked,
  };
  // 計算式を持たない取得値（支払函数・追加口金額）は、分割があるとき内訳をツールチップに出す。
  const hasSplit = splitOut.caseEquivalent !== 0 || splitOut.addAmount !== 0;
  const splitTips: Record<string, string> = hasSplit
    ? {
        payFunc: `明細の合計 ${detailTotals.payFunc.toLocaleString()}、分割先へ出した分 ${Math.round(
          splitOut.caseEquivalent
        ).toLocaleString()}（バラはケース換算）→ 自部署負担分 ${values.payFunc.toLocaleString()}`,
        addEntryAmount: `明細の合計 ${detailTotals.addEntryAmount.toLocaleString()}、分割先へ出した分 ${splitOut.addAmount.toLocaleString()} → 自部署負担分 ${values.addEntryAmount.toLocaleString()}`,
      }
    : {};
  return fillSummaryRowValues(ROWS, payByKey).map((row) => ({
    ...row,
    splitTip: splitTips[row.key],
  }));
};

// 金額セルを表示単位（円／千円）に応じて整形する。
//  ・金額行以外（函数・各種率）と、率の列（計画誤差率・前年比）は変換しない
//  ・数値でない値（–等）はそのまま
const convertCell = (
  kind: RowKind,
  convertible: boolean,
  value: string,
  unit: 'yen' | 'thousand'
): string => {
  if (unit === 'yen' || kind !== 'amount' || !convertible) return value;
  const n = parseFloat(value.replace(/,/g, ''));
  if (!Number.isFinite(n)) return value;
  return Math.round(n / 1000).toLocaleString();
};

// 値セルの並べ替え比較。セル値は「1,234」「10.0%」等の整形済み文字列のため、
// 数値へ戻して比較する。算出しない「–」は数値化できないため常に末尾へ寄せる。
const compareValueCells = (a: string, b: string): number => {
  const na = parseFormulaNumber(a);
  const nb = parseFormulaNumber(b);
  const aNaN = !Number.isFinite(na);
  const bNaN = !Number.isFinite(nb);
  if (aNaN && bNaN) return 0;
  if (aNaN) return 1;
  if (bNaN) return -1;
  return na - nb;
};

// 計算式テンプレートの `{key}` を項目名に置換した式（ツールチップ1行目相当）。
const expressionOf = (tpl: FormulaTemplate): string =>
  tpl.template.replace(
    /\{([^}]+)\}/g,
    (_, token) => ROW_LABELS[token] ?? token
  );

// 表示項目セルのツールチップ（実績算出元・計算式・補足）を組み立てる。
const buildRowTooltip = (row: RowDefItem): string =>
  [
    `実績算出元：${row.source}`,
    row.payFormula ? `計算式：${expressionOf(row.payFormula)}` : '',
    row.note ? `※${row.note}` : '',
    (SPLIT_AFFECTED_SUMMARY_KEYS as readonly string[]).includes(row.key)
      ? '※追加口の分割がある場合、支払・実績情報は分割後の自部署負担分で計算する'
      : '',
  ]
    .filter(Boolean)
    .join('\n');

// 値セルのツールチップ。列ごとに参照方向が変わる。
//   支払・実績情報／販売計画書／前年実績 … 同じ列の別項目行を参照する行方向の式
//   差／計画誤差率／前年比               … 同じ行の別列を参照する列方向の式
// 計算式を持たない項目（実販FACT・支払情報からの取得値）は算出元を示す。
const buildCellTooltip = (
  row: RowDefItem,
  colKey: string,
  cellValue: string,
  valueOfRow: (rowKey: string, colKey: string) => string | null
): string => {
  if (cellValue === NOT_APPLICABLE) {
    return '拡売費は計画時に商流情報を持たないため、販売計画書・差・計画誤差率は算出しない';
  }

  const colFormula = COL_FORMULAS[colKey];
  if (colFormula) {
    return formulaTooltip(
      colFormula,
      (token) => COL_LABELS[token] ?? token,
      (token) => valueOfRow(row.key, token),
      cellValue
    );
  }

  const tpl = colKey === 'pay' ? row.payFormula : row.planFormula;
  if (tpl) {
    return formulaTooltip(
      tpl,
      (token) => ROW_LABELS[token] ?? token,
      (token) => valueOfRow(token, colKey),
      cellValue
    );
  }

  // 計算式を持たない取得値。列ごとに取得元を示す。
  // 追加口の分割の変更を反映した値は、初期表示からの増減の内訳も示す。
  if (colKey === 'pay' && row.splitTip) {
    return `実績算出元：${row.source}\n追加口分割の反映：${row.splitTip}`;
  }
  if (colKey === 'pay') return `実績算出元：${row.source}`;
  if (colKey === 'plan') return '販売計画書の値';
  return '前年実績の値';
};

interface AggregationPaneProps {
  // 支払情報サマリ右端のトグル（詳細／分割／振替）の選択値。
  //   詳細＝支払No.（支払明細情報・追加口・拡売費）、分割・振替＝他部門から分割された経費明細。
  summaryTab?: '詳細' | '分割' | '振替';
  onSummaryTabChange?: (tab: '詳細' | '分割' | '振替') => void;
  // 分割・振替 選択時にカード本体へ表示する「他部門から分割された経費明細」一覧。
  // 計画詳細(マージン率固定・NET入力)の「年間集計」ボタンと同様に、カード内で表示を切り替える。
  // リサイズハンドルで調整した本体の縦幅（gridHeight）を受け取り、一覧の高さに反映する。
  // 分割・振替で別々のグリッドを表示するため、選択中のタブも渡す。
  splitContent?: (gridHeight: number, tab: '分割' | '振替') => ReactNode;
  // 支払情報サマリの支払の行（支払函数・追加口金額・拡売費）の、明細から集計した値。
  // 全支払回数の追加口明細・拡売費明細の合計（分割前）。明細の編集に合わせて親が求め直す。
  detailTotals: SummaryDetailTotals;
  // 分割先へ出した分の合計（全支払回）。支払・実績情報列の支払系の項目を
  // 分割後の自部署負担分で計算し直す（→ 第33回 決定事項17）。未指定・0 なら分割なし。
  splitOut?: SummarySplitOut;
  // センターフィ額（支払・実績情報）。追加口明細から求めた全支払回の合計。
  centerFeePayAmount: number;
}

export function AggregationPane({
  summaryTab = '詳細',
  onSummaryTabChange,
  splitContent,
  detailTotals,
  splitOut,
  centerFeePayAmount,
}: AggregationPaneProps) {
  const [isOpen, setIsOpen] = useState(true);

  // 明細から求めた値・追加口の分割・センターフィ額を反映した行定義と、函数の切り出し表示。
  // 親は描画のたびに新しいオブジェクトを渡すため、依存は数値で持つ。
  const { payFunc, addEntryAmount, promoNetUnapproved, promoLinked } =
    detailTotals;
  const splitCaseEquivalent = splitOut?.caseEquivalent ?? 0;
  const splitAddAmount = splitOut?.addAmount ?? 0;
  const rows = useMemo(
    () =>
      buildSummaryRows(
        { payFunc, addEntryAmount, promoNetUnapproved, promoLinked },
        { caseEquivalent: splitCaseEquivalent, addAmount: splitAddAmount },
        centerFeePayAmount
      ),
    [
      payFunc,
      addEntryAmount,
      promoNetUnapproved,
      promoLinked,
      splitCaseEquivalent,
      splitAddAmount,
      centerFeePayAmount,
    ]
  );
  const fnHighlight = useMemo(() => fnHighlightOf(rows), [rows]);
  // 表示単位（円／千円）。金額行のみ千円換算する。金額の桁が大きいため既定は千円。
  const [displayUnit, setDisplayUnit] = useState<'yen' | 'thousand'>(
    'thousand'
  );
  // 補助項目（Excelの「折り畳み」指定＝納品金額・支払NET売上高・センターフィ額・社外売上高）の表示。
  // 計画詳細(マージン率固定・NET入力)の販売計画(集計)詳細タブと同じトグルにそろえる。
  const [showFolded, setShowFolded] = useState(false);

  // カード本体（サマリ表）の縦幅。追加口一覧と同様にリサイズハンドルのドラッグで
  // 手動調整可能。JS動的値のため inline style を許容する。
  const GRID_MIN_HEIGHT = 200; // 縮めすぎ防止の下限
  // 既定は「補助項目を隠した状態の11項目＋ヘッダー」が縦スクロールなしで収まる高さ。
  const [gridHeight, setGridHeight] = useState(440);

  // リサイズハンドルのドラッグ開始。マウス移動量に応じて本体の縦幅を更新する。
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = gridHeight;
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(
        GRID_MIN_HEIGHT,
        startHeight + (ev.clientY - startY)
      );
      setGridHeight(next);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
    };
    document.body.style.userSelect = 'none'; // ドラッグ中のテキスト選択を抑止
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // 列幅・並び順・ソートの永続化。
  // v1→v2：表示項目を行・情報の種類を列に置く構成へ組み替えた（→ ★支払画面集計修正）。
  // v2→v3：項目名「拡売費（NET未承認以外）」が収まるよう表示項目の列幅を広げた。
  // 列数が少なく横に余白が出るため、列幅は自動調整ではなく列定義の flex で表幅いっぱいに広げる。
  const gridColumnStateProps = useGridColumnState(
    '支払詳細C.支払情報サマリ.columnState.v3',
    { autoSize: false }
  );

  // 表示単位を反映した全項目の値（補助項目を隠していても計算式の実値行に使うため全行分持つ）。
  const valueByKey = useMemo(() => {
    const map = new Map<string, Record<string, string>>();
    for (const r of rows) {
      const vals: Record<string, string> = {};
      for (const c of COLS) {
        vals[c.key] = convertCell(
          r.kind,
          !!c.convertible,
          r.vals[c.key] ?? '',
          displayUnit
        );
      }
      map.set(r.key, vals);
    }
    return map;
  }, [displayUnit, rows]);

  // 行データ（実販函数 〜 拡売費（NET未承認以外））。値セルのツールチップ（計算式）も併せて持つ。
  const rowData = useMemo(() => {
    const valueOfRow = (rowKey: string, colKey: string): string | null =>
      valueByKey.get(rowKey)?.[colKey] ?? null;

    return rows
      .filter((r) => showFolded || !r.folded)
      .map((r) => {
        const vals = valueByKey.get(r.key) ?? {};
        const tips: Record<string, string> = {};
        for (const c of COLS) {
          tips[`_tip_${c.key}`] = buildCellTooltip(
            r,
            c.key,
            vals[c.key] ?? '',
            valueOfRow
          );
        }
        return {
          label: r.label,
          _tooltip: buildRowTooltip(r),
          ...vals,
          ...tips,
        };
      });
  }, [valueByKey, showFolded, rows]);

  // 値セルのスタイル（データ行は右寄せ）
  const valueCellStyle = () => ({ textAlign: 'right' as const });

  const buildValueCol = (c: ColDefItem): ColDef => ({
    headerName: c.name,
    field: c.key,
    headerTooltip: c.tooltip,
    // 値は右寄せのため、見出しも右寄せにして数値と縦位置をそろえる。
    headerClass: 'jbr-summary-header-right',
    // 表全体の横幅いっぱいに広げる（最小幅は確保）
    flex: 1,
    minWidth: c.width,
    // 見出しクリックでの並べ替え。整形済み文字列を数値へ戻して比較する。
    sortable: true,
    comparator: compareValueCells,
    ...GRID_NUMBER_TEXT_FILTER,
    cellStyle: valueCellStyle,
    // 各セルの計算式をツールチップで示す（→ ★支払画面集計修正 の計算式列）。
    tooltipValueGetter: (params) => params.data?.[`_tip_${c.key}`] ?? '',
  });

  const columnDefs: (ColDef | ColGroupDef)[] = useMemo(() => {
    const defs: (ColDef | ColGroupDef)[] = [
      {
        headerName: '表示項目',
        field: 'label',
        width: 190,
        sortable: true,
        filter: true,
        // 実績算出元・計算式・補足はツールチップで示す（Excelの右側の注記に対応）。
        tooltipValueGetter: (params) => params.data?._tooltip ?? '',
        // 中身は左寄せ（grid.css の ag-cell-left-pinned）。
        // 先頭列に強制される中央寄せ・padding:0 を解除し、他セルと同じ左右余白に戻す。
        cellClass: 'ag-cell-left-pinned',
      },
      ...COLS.map((c) => buildValueCol(c)),
    ];
    return defs;
  }, []);

  const defaultColDef: ColDef = useMemo(
    () => ({
      // 共通の既定列定義（grid/）。ヘッダーの…メニュー・フィルターボタン非表示、
      // tooltip 等を内包（販売計画詳細と統一）。並べ替えは共通既定どおり有効。
      ...GRID_DEFAULT_COL_DEF,
      cellDataType: false,
    }),
    []
  );

  return (
    <CollapsibleCard
      title={<span className={CARD_TITLE_CLASS}>支払情報サマリ</span>}
      open={isOpen}
      onOpenChange={setIsOpen}
      className="mb-4"
      headerActions={
        /* 詳細／分割（IN）／振替（IN） トグル。詳細＝支払No.、分割（IN）・振替（IN）＝他部門から
           分割・振替を受けた経費明細（受領側であることが分かるよう表示名に「（IN）」を付す）。 */
        <div className="flex shrink-0 overflow-hidden rounded-lg border-2 border-blue-600">
          <button
            onClick={() => onSummaryTabChange?.('詳細')}
            className={`px-4 py-1 h-8 whitespace-nowrap text-sm font-medium transition-colors ${
              summaryTab === '詳細'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-blue-600 hover:bg-blue-50'
            }`}
          >
            詳細
          </button>
          <div className="w-px bg-blue-600" />
          <button
            onClick={() => onSummaryTabChange?.('分割')}
            className={`px-4 py-1 h-8 whitespace-nowrap text-sm font-medium transition-colors ${
              summaryTab === '分割'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-blue-600 hover:bg-blue-50'
            }`}
          >
            分割（IN）
          </button>
          <div className="w-px bg-blue-600" />
          <button
            onClick={() => onSummaryTabChange?.('振替')}
            className={`px-4 py-1 h-8 whitespace-nowrap text-sm font-medium transition-colors ${
              summaryTab === '振替'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-blue-600 hover:bg-blue-50'
            }`}
          >
            振替（IN）
          </button>
        </div>
      }
    >
      <>
        {summaryTab !== '詳細' ? (
          // 分割・振替：カード本体に「他部門から分割された経費明細」一覧を表示する。
          <div className="p-4">
            {splitContent?.(
              gridHeight,
              summaryTab === '振替' ? '振替' : '分割'
            )}
          </div>
        ) : (
          <div className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              {/* 函数の切り出し表示。実販・支払とその差は全員が最初に見る値のため、
                  表とは別に常に見える位置へ抜き出す。
                  カードの体裁は分割（IN）・振替（IN）の「合計金額」サマリーバーと統一する。 */}
              <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
                <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
                  函数
                </span>
                <div className="flex items-stretch divide-x divide-gray-200">
                  {fnHighlight.map((f) => (
                    <div
                      key={f.label}
                      className="flex flex-col items-end px-3 min-w-0"
                    >
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {f.label}
                      </span>
                      <span
                        className={`text-sm font-bold whitespace-nowrap ${
                          f.emphasis ? 'text-blue-700' : 'text-gray-900'
                        }`}
                      >
                        {f.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* 補助項目（納品金額・支払NET売上高・センターフィ額・社外売上高）の表示切替。
                    計画詳細(マージン率固定・NET入力)の販売計画(集計)詳細タブと同テーマ・同挙動。 */}
                <button
                  type="button"
                  onClick={() => setShowFolded((prev) => !prev)}
                  aria-pressed={showFolded}
                  aria-label={showFolded ? '補助項目を隠す' : '補助項目を表示'}
                  className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm whitespace-nowrap text-gray-700 hover:bg-gray-50"
                >
                  {showFolded ? (
                    <Minus className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {showFolded ? '補助項目を隠す' : '補助項目を表示'}
                </button>

                {/* 表示単位トグル（円／千円）。金額行のみ千円換算する。 */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-blue-900 whitespace-nowrap font-bold">
                    表示単位
                  </label>
                  <div className="inline-flex rounded-md border border-gray-300 overflow-hidden h-8">
                    <button
                      type="button"
                      onClick={() => setDisplayUnit('yen')}
                      aria-pressed={displayUnit === 'yen'}
                      className={`px-4 text-sm font-medium transition-colors ${
                        displayUnit === 'yen'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      円
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisplayUnit('thousand')}
                      aria-pressed={displayUnit === 'thousand'}
                      className={`px-4 text-sm font-medium transition-colors ${
                        displayUnit === 'thousand'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      千円
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="jbr-actual-bill-grid"
              style={{ height: gridHeight, width: '100%' }}
            >
              {/* 罫線・ヘッダ背景・行高は共通テーマ（GRID_THEME）に委譲。
                    項目名列の左寄せは共通クラス（ag-cell-left-pinned）に委譲する。 */}
              <style>{`
                  /* ヘッダー文字を左寄せ */
                  .jbr-actual-bill-grid .ag-header-cell-label {
                    justify-content: flex-start;
                  }
                  /* 値列（右寄せ）の見出しは右寄せにして数値と縦位置をそろえる */
                  .jbr-actual-bill-grid
                    .ag-header-cell.jbr-summary-header-right
                    .ag-header-cell-label {
                    justify-content: flex-end;
                  }
                `}</style>
              <AgGridReact
                rowData={rowData}
                getRowId={getSummaryRowId}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                // 計算式をツールチップで見せるため、省略されていないセルでも出す（グローバルは whenTruncated）
                tooltipShowMode="standard"
                getContextMenuItems={gridFilterContextMenuItems}
                suppressMovableColumns={true}
                ensureDomOrder={true}
                {...GRID_BASE_PROPS}
                {...gridColumnStateProps}
              />
            </div>
          </div>
        )}
        {/* リサイズハンドル：上下ドラッグでカード本体の縦幅を手動調整する（追加口一覧と同様）。
              詳細＝サマリ表／グラフ、分割・振替＝他部門一覧の各グリッドを可変にする。 */}
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="支払情報サマリの高さを変更"
          onMouseDown={handleResizeStart}
          className="flex items-center justify-center h-3 cursor-ns-resize bg-gray-100 hover:bg-gray-200 border-t border-gray-200 transition-colors"
        >
          <div className="w-10 h-1 rounded-full bg-gray-400" />
        </div>
      </>
    </CollapsibleCard>
  );
}
