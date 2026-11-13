// 支払詳細の拡売費一覧（shared/payment/payment-detail/PaymentNonProductExpensePane）の行の処理と、処理が使う定数（未承認NETの管理区分・空の行・計算式の列・行の判定・行IDと No. の採番・表示順・行の作成・数値の変換と書式・計算式の再計算など）
import { GetRowIdParams, IRowNode } from 'ag-grid-community';
import { GRID_EMPTY_TEXT } from '@/app/components/grid';
import {
  managementClassCode,
  summaryProductComboOptions,
} from '@/app/utils/payment/payment-detail/paymentComboFieldOptions';
import { EXPENSE_MANAGEMENT_CODE_OPTIONS } from '@/app/constants/expenseRelations';
import { isManagementCodeInClass } from '@/app/utils/common/expenseRelations';
import {
  SUMMARY_PRODUCT_BY_VALUE,
  SUMMARY_PRODUCT_VALUES,
} from '@/app/constants/productMasters';
import { DEFAULT_META_BRAND } from '@/app/constants/nonProductExpenseForm';
import type { StoreOrgSelection } from '@/app/types/organization';
import {
  DEFAULT_DATA_SOURCE,
  type DataSource,
} from '@/app/constants/dataSource';
import { NET_UNAPPROVED_MGMT_CLASS_NAME } from './paymentSummaryAggregate';
import { computeExpenseBreakdown } from './paymentBreakdownItems';
import {
  linkNetUnapprovedRows,
  type NetUnapprovedLink,
} from './netUnapprovedLink';
import type {
  ExpenseRow,
  QuotedExpenseItem,
  ExpenseFormValues,
  ExpenseSummary,
} from '@/app/types/paymentDetail';

// ── 未承認NET拡売費の管理区分 ──────────────────────────────
// 未承認NET明細（追加口のNET差額の自動振替分）は「値引き（売上連動）」で起票される。
// 共通の拡売費マスタ（EXPENSE_MANAGEMENT_CLASS_OPTIONS）には無い区分のため、
// 本一覧の管理区分／管理区分名称列の選択肢・区分値をここで定義する。
// 名称は支払情報サマリの集計（拡売費（NET未承認）の判定）と同じ定数を使う。
export const NET_MGMT_CLASS_NAME = NET_UNAPPROVED_MGMT_CLASS_NAME;

export const NET_MGMT_CLASS_CODE = '1B3';

// 管理区分名称 → 区分値。未承認NET用の区分は共通マスタに無いため個別に返す。
export const managementClassCodeOf = (className: string): string =>
  className === NET_MGMT_CLASS_NAME
    ? NET_MGMT_CLASS_CODE
    : managementClassCode(className);

// 管理コード／管理コード名称列の候補。管理区分が選択済みなら該当コードへ絞り込む。
// ただし「値引き（売上連動）」は該当する管理コードを持たない区分のため絞り込まない
//（絞り込むと候補が0件になり、管理コードを選べなくなる）。
export const managementCodeCandidates = (mgmtClass: string): string[] => {
  const all = EXPENSE_MANAGEMENT_CODE_OPTIONS.map((o) => o.value);
  if (!mgmtClass || mgmtClass === NET_MGMT_CLASS_NAME) return all;
  return all.filter((c) => isManagementCodeInClass(c, mgmtClass));
};

// 分割の枝番行が持つ商流・組織の現在値（連動関数への入力）。
export const storeOrgSelectionOf = (row?: ExpenseRow): StoreOrgSelection => ({
  primaryStore: row?.splitPrimaryStore ?? '',
  tertiaryStore: row?.splitTertiaryStore ?? '',
  store: row?.splitStore ?? '',
  dept: row?.splitDept ?? '',
  staff: row?.splitStaff ?? '',
});

// ── メタブランド／サマリ商品の選択肢 ─────────────────────────
// サマリ商品の未選択値（商品マスタの「ー（指定なし）」に相当）。
export const SUMMARY_PRODUCT_NONE = '-';

// サマリ商品列の選択肢（サマリ商品名＋商品コードの2行表示）。
// 候補・表示とも計画詳細(マージン率固定・NET入力)のサマリ商品列にそろえ、
// 先頭に未選択（ー（指定なし））を置いて選択を外せるようにする。
// メタブランド選択時は、そのメタブランドに紐づくサマリ商品のみに絞り込む
//（計画詳細(マージン率固定・NET入力)の拡売費計画グリッドと同じ仕様）。
// ただしブランド横断(全商品)は絞り込まず全商品を出す。
export const summaryProductComboOptionsFor = (metaBrand?: string) => [
  { value: SUMMARY_PRODUCT_NONE, label: 'ー（指定なし）' },
  ...summaryProductComboOptions(
    metaBrand && metaBrand !== DEFAULT_META_BRAND
      ? SUMMARY_PRODUCT_VALUES.filter(
          (value) =>
            SUMMARY_PRODUCT_BY_VALUE.get(value)?.metaBrand === metaBrand
        )
      : SUMMARY_PRODUCT_VALUES
  ),
];

// 行にサマリ商品が選択されているか（空・「-」は未選択とみなす）。
export const hasSummaryProduct = (row?: ExpenseRow): boolean =>
  !!row?.product && row.product !== SUMMARY_PRODUCT_NONE;

// 枝番行（親行の直下に置き、親行のデータを再掲する行）の判定。
//   分割先：費用分割で生じた行（分割列＝「分割先」）。No. は「親No.-枝番」。
// 編集・行操作は限定し、合計にも含めない（金額列が空白のため）。
export const isSplitDestData = (row?: ExpenseRow) =>
  row?.costSplit === '分割先';

export const isBranchData = (row?: ExpenseRow) => isSplitDestData(row);

// ── 行ID（getRowId） ─────────────────────────────────────
// 行ID の採番。モジュール直下で数え上げるため、ペインを開き直しても重複しない。
let expenseRowIdSeq = 0;

export const newExpenseRowId = (): string => {
  expenseRowIdSeq += 1;
  return `expense-${expenseRowIdSeq}`;
};

// 明細追加・追加口からの転記で足した順の採番（_addedSeq）。行ID と同じくモジュール直下で数え上げる。
let addedRowSeq = 0;

export const nextAddedRowSeq = (): number => {
  addedRowSeq += 1;
  return addedRowSeq;
};

// 行ID を持たない行（受け取った明細データ・画面の操作で追加した行）へ行ID を振る。
// 行の特定に行データの同一性を使う処理があるため、行データの実体は入れ替えずに書き込む。
// 同じ行ID を持つ別の行（行を複製して作った明細など）は、2件目以降を振り直して一意にする。
export const assignExpenseRowIds = (rows: ExpenseRow[]): void => {
  const ownerById = new Map<string, ExpenseRow>();
  rows.forEach((row) => {
    const owner = row._rowId ? ownerById.get(row._rowId) : undefined;
    if (!row._rowId || (owner && owner !== row)) row._rowId = newExpenseRowId();
    ownerById.set(row._rowId, row);
  });
};

// 行ID（AG Grid 公式 getRowId）。モジュール直下に置いて参照を固定する（→ 02 §7.1）。
export const getExpenseRowId = (params: GetRowIdParams<ExpenseRow>): string =>
  params.data._rowId ?? '';

// 1つ目（未承認NET）の一覧に属する行か判定する。
//   ＝「未承認NET拡売費合計」グループ行＋未承認NET明細（ワンダ極微糖〜ワンダ ブラック）。
// それ以外（その他拡売費合計グループ＋その他明細）は2つ目の一覧。
export const isNetListRow = (d: ExpenseRow | undefined): boolean =>
  !!d &&
  (!!d.isNetUnapproved || (!!d.isGroup && d.product === '未承認NET拡売費合計'));

// チェックできる行（明細行のみ）。グループ合計行・総合計行は明細ではないため対象外。
// 分割の枝番行は分割先ごとに項目を持つため、親行と同様にチェックできる。
export const isPlanTargetSelectable = (node: IRowNode) => {
  const row = node.data as ExpenseRow | undefined;
  return !!row && !row.isGroup && !row.isTotal;
};

// 空セル既定値（各行はこれを基にした差分のみ記述）
export const BLANK: ExpenseRow = {
  lineNo: '',
  // 画面の操作（明細追加・分割・引用など）で追加した明細は「手入力」。
  // 請求EDI取込・AIC入力の明細は各行で個別に指定する。
  dataSource: DEFAULT_DATA_SOURCE,
  billName: '',
  billNote: '',
  planExpContent: '',
  product: '',
  billAmount: '',
  payAmount: '',
  planAmount: '',
  taxClass: '',
  costSplit: '',
  mgmtClass: '',
  mgmtClassName: '',
  mgmtCode: '',
  mgmtCodeName: '',
  measureClass: '',
  measureCode: '',
  summary1: '',
  summary2: '',
  planDiff: '',
  matchType: '',
  billNo: '',
  billPage: '',
  splitDept: '',
  splitStaff: '',
  splitStore: '',
  splitTertiaryStore: '',
  splitPrimaryStore: '',
};

// 枝番行の No.「親No.-枝番」から親行の No. を取り出す（枝番行以外は null）。
// モジュール内の複数箇所（折りたたみ・分割の枝番行の採番）で使うため関数として切り出す。
export const parentLineNoOfRow = (row: ExpenseRow): string | null => {
  const lineNo = String(row.lineNo ?? '');
  const dash = lineNo.lastIndexOf('-');
  return dash < 0 ? null : lineNo.slice(0, dash);
};

// 行が属する一覧（未承認NET／その他）。枝番行は親行から isNetUnapproved を
// 引き継ぐため、枝番行でも親行と同じ値になる。
export const listKeyOf = (row?: ExpenseRow): 'net' | 'other' =>
  row?.isNetUnapproved ? 'net' : 'other';

// 一覧の並び替えキー：［一覧, 追加順, 親行の No., 枝番］。
// コピー・追加口からの転記で最大 No.＋1 の明細が途中に入っても、画面上は
// No. の昇順（1・2・3…）で並ぶようにするために使う。
// ただし明細追加・追加口からの転記で足した行（_addedSeq あり）は、一覧の最上部に
// 新しい順で並べる（画面設計標準 4.4：新規の行は明細の最上部に追加）。追加順は第2キーにし、
// 枝番行は親行の追加順（addedSeqByParent）を引き継いで親行の直下に置く。
// 分割の枝番行は親行の直下に置きたいため、親の No. を第3キー、枝番を第4キーにする。
// No. を数値にできない行（合計行など）は一覧の末尾へ寄せる。
export const displayOrderKeyOf = (
  row: ExpenseRow,
  addedSeqByParent: Map<string, number>
): [number, number, number, number] => {
  const listRank = listKeyOf(row) === 'net' ? 0 : 1;
  // グループ合計行・総合計行は外部フィルタで非表示のため、並びの端に寄せる。
  if (row.isGroup) return [listRank, Number.NEGATIVE_INFINITY, 0, 0];
  if (row.isTotal) return [listRank, Number.POSITIVE_INFINITY, 0, 0];
  const lineNo = String(row.lineNo ?? '');
  const parentLineNo = parentLineNoOfRow(row);
  const parentNo = Number(parentLineNo ?? lineNo);
  const branchNo =
    parentLineNo === null ? 0 : Number(lineNo.slice(parentLineNo.length + 1));
  // 追加した行は負の値（新しいほど小さい）で先頭へ。それ以外は 0（No. の昇順）
  const addedSeq = addedSeqByParent.get(
    branchParentKeyOfBranch(row) ?? branchParentKeyOf(row)
  );
  return [
    listRank,
    addedSeq === undefined ? 0 : -addedSeq,
    Number.isFinite(parentNo) ? parentNo : Number.POSITIVE_INFINITY,
    Number.isFinite(branchNo) ? branchNo : 0,
  ];
};

// 明細行を No. の昇順（枝番行は親行の直下）に並べ替えた配列を返す。
// 明細追加・追加口からの転記で足した行は、一覧の最上部に新しい順で並べる。
// 行データの実体は入れ替えずに並び順だけを整えるため、元の配列は変更しない。
export const sortRowsForDisplay = (rows: ExpenseRow[]): ExpenseRow[] => {
  // 追加した親行のキー（一覧:No.）→ 追加順
  const addedSeqByParent = new Map<string, number>();
  rows.forEach((r) => {
    if (r._addedSeq !== undefined && parentLineNoOfRow(r) === null) {
      addedSeqByParent.set(branchParentKeyOf(r), r._addedSeq);
    }
  });
  return [...rows].sort((a, b) => {
    const ka = displayOrderKeyOf(a, addedSeqByParent);
    const kb = displayOrderKeyOf(b, addedSeqByParent);
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2] || ka[3] - kb[3];
  });
};

// 親行のキー。No. は未承認NET／その他の一覧で重複するため、No. だけでは
// 一覧をまたいで同じ行と判定されてしまう。どちらの一覧かを前置した
// 「net:1」「other:1」形式にして、枝番行の有無・折りたたみ状態を一覧ごとに扱う。
export const branchParentKeyOf = (row: ExpenseRow): string =>
  `${listKeyOf(row)}:${row.lineNo}`;

// 枝番行から見た親行のキー（枝番行以外は null）。
export const branchParentKeyOfBranch = (row: ExpenseRow): string | null => {
  const parentLineNo = parentLineNoOfRow(row);
  return parentLineNo === null ? null : `${listKeyOf(row)}:${parentLineNo}`;
};

// 明細行（枝番行以外）に次へ採番する No.（同じ一覧の明細行の最大 No.＋1）。
// 「コピー」で明細行を複製するときに使う。
export const nextDetailLineNo = (
  rows: ExpenseRow[],
  listKey: 'net' | 'other'
): number =>
  rows.reduce((max, r) => {
    if (r.isGroup || r.isTotal || isSplitDestData(r)) return max;
    if (listKeyOf(r) !== listKey) return max;
    const n = Number(r.lineNo);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0) + 1;

// 当該親行に次へ追加する分割の枝番行の枝番（既存の分割の枝番行の最大枝番＋1）。
// 「分割」での追加と「コピー」での複製の双方で使う。
// ※No. は未承認NET／その他の一覧で重複するため、採番の対象はどちらの一覧かも
//   あわせて絞り込む（listKey は操作元の行が属する一覧＝`listKeyOf` の値）。
export const nextSplitBranchNo = (
  rows: ExpenseRow[],
  parentLineNo: string,
  listKey: 'net' | 'other'
): number =>
  rows
    .filter(
      (r) =>
        isSplitDestData(r) &&
        branchParentKeyOfBranch(r) === `${listKey}:${parentLineNo}`
    )
    .reduce((max, r) => {
      const no = String(r.lineNo);
      const n = Number(no.slice(no.lastIndexOf('-') + 1));
      return Number.isFinite(n) && n > max ? n : max;
    }, 0) + 1;

// 当該一覧（未承認NET／その他）で次に採番する明細の No.（既存の明細の最大No.＋1）。
// ※No. は未承認NET／その他の一覧で重複するため、採番は一覧ごとに行う。
//   枝番行（No.「親No.-枝番」）は親行の内訳のため採番の対象外。
export const nextParentLineNo = (
  rows: ExpenseRow[],
  listKey: 'net' | 'other'
): number =>
  rows
    .filter(
      (r) =>
        !r.isGroup &&
        !r.isTotal &&
        listKeyOf(r) === listKey &&
        parentLineNoOfRow(r) === null
    )
    .reduce((max, r) => {
      const n = Number(r.lineNo);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0) + 1;

// 分割の枝番行へ親行から再掲する列（金額に関連しない列）。
// 管理区分〜施策コード名称・摘要は計画明細の値を設定するため含めない。
export const inheritedFromParent = (
  parent: ExpenseRow
): Partial<ExpenseRow> => ({
  // データ元は明細（親行）の作成元を表すため、枝番行も親行と同じ値を再掲する。
  dataSource: parent.dataSource,
  billName: parent.billName,
  billNote: parent.billNote,
  planExpContent: parent.planExpContent,
  product: parent.product,
  taxClass: parent.taxClass,
  matchType: parent.matchType,
  billNo: parent.billNo,
  billPage: parent.billPage,
  // 未承認NET／その他のどちらの一覧に属するかは親行に合わせる（外部フィルタの判定に使う）。
  isNetUnapproved: parent.isNetUnapproved,
});

// 空の拡売費明細1行（モックデータの各行の基にする。src/mocks/payment/payment-detail-with-invoice/paymentDetail・src/mocks/payment/payment-detail-without-invoice）。
export const createBlankExpenseRow = (): ExpenseRow => ({ ...BLANK });

// 未承認NETの明細1行（追加口明細の拡売費金額（NET未承認）をサマリ商品ごとに支払う明細）。
// 管理区分は「値引き（売上連動）」（区分値 1B3）。支払金額は追加口明細の値に連動する
//（applyExpenseFormulas）。モックデータの初期明細と、追加口明細で新たに差が出たサマリ商品の
// 明細を足すときに使う。
export const createNetUnapprovedRow = (item: {
  lineNo: number;
  product: string;
  payAmount: number;
  dataSource?: DataSource;
  originDataSource?: DataSource;
  billNo?: string;
  billPage?: string;
}): ExpenseRow => ({
  ...BLANK,
  isNetUnapproved: true,
  lineNo: item.lineNo,
  dataSource: item.dataSource ?? DEFAULT_DATA_SOURCE,
  ...(item.originDataSource ? { originDataSource: item.originDataSource } : {}),
  billName: `アサヒ飲料 ${item.product} NET差額拡売費`,
  planExpContent: SUMMARY_PRODUCT_BY_VALUE.get(item.product)?.metaBrand ?? '',
  product: item.product,
  payAmount: item.payAmount,
  planAmount: 0,
  taxClass: '課税8%:2',
  mgmtClass: NET_MGMT_CLASS_NAME,
  mgmtCode: 'RA001',
  measureClass: '販売促進',
  measureCode: 'SP001',
  billNo: item.billNo ?? '',
  summary1:
    item.dataSource === DEFAULT_DATA_SOURCE || !item.dataSource
      ? '担当者が直した支払NETの差額（社内）'
      : 'NET差額の自動振替（社内）',
  summary2: 'ネット差額調整（社外）',
  billPage: item.billPage ?? '',
});

// 引用（引用明細選択の「引用」ボタン）した明細を拡売費明細（その他拡売費）へ変換する。
// 引用で新しい支払回を追加する場合は、その回の初期明細としてこの結果を渡す。
// 未承認NET明細ではないため isNetUnapproved は付けない。
export const createQuotedExpenseRows = (
  items: QuotedExpenseItem[]
): ExpenseRow[] => items.map((item) => ({ ...BLANK, ...item }));

// 明細を持たない拡売費一覧を新規生成する（「＋支払回数追加」で追加した回の初期表示）。
// グループ合計行（未承認NET拡売費合計／その他拡売費合計）だけを残して明細行は持たせず、
// 合計金額は 0 から始める（明細を足すと applyExpenseFormulas が再集計する）。
export const createEmptyExpenseRows = (): ExpenseRow[] => [
  {
    ...BLANK,
    isGroup: true,
    product: '未承認NET拡売費合計',
    payAmount: 0,
    planAmount: 0,
    summary1: 'NET差額拡売費自動振替分',
  },
  {
    ...BLANK,
    isGroup: true,
    product: 'その他拡売費合計',
    payAmount: 0,
    planAmount: 0,
  },
];

// サマリーバー用の数値整形（支払金額は整数表示）。
export const fmtPay = (n: number): string => Math.round(n).toLocaleString();

// 整数表示（小数点以下を四捨五入、カンマ区切り、文字列はそのまま。空はグレーの「-」）
export const intFmt = (params: { value: unknown }) => {
  const v = params.value;
  if (v === '' || v === null || v === undefined) return GRID_EMPTY_TEXT;
  if (typeof v === 'number') {
    return Math.round(v).toLocaleString();
  }
  return String(v);
};

// 金額列（整数）の入力値パーサ。カンマ区切りを許容し、小数は四捨五入して整数にする。
// 数値にできない入力は編集前の値へ戻す（空欄はそのまま空欄にする）。
export const intValueParser = (params: {
  newValue: unknown;
  oldValue: unknown;
}): unknown => {
  const raw = String(params.newValue ?? '')
    .trim()
    .replace(/,/g, '');
  if (raw === '') return '';
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : params.oldValue;
};

// 値を数値化する（カンマ区切り文字列も可）。数値化できなければ null。
export const toNum = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === '' || v === null || v === undefined || v === '-') return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

// 請求－支払：差額（請求金額 − 支払金額）。どちらも数値でない行は空白を返す。
// 20260821_第31回 決定事項4 により、拡売費明細にも追加口明細と同じ差額列を持たせる。
export const billPayDiffOf = (row: ExpenseRow): number | '' => {
  const bill = toNum(row.billAmount);
  const pay = toNum(row.payAmount);
  if (bill === null || pay === null) return '';
  return bill - pay;
};

// ツールチップ用に値を桁区切り文字列へ整形する（数値化できなければそのまま）。
export const fmtN = (v: unknown): string => {
  const n = toNum(v);
  return n === null ? String(v ?? '') : n.toLocaleString();
};

// 計算式が設定された列（派生項目）の定義。
//   refs    : ハイライト対象の参照元フィールド（当該行内）。
//   tooltip : 当該行データから計算式テキスト（式＋実値）を生成する。
// Excel「拡売費」表の数式に対応する。
export const FORMULA_DEFS: Record<
  string,
  {
    refs: (row: ExpenseRow) => string[];
    tooltip: (row: ExpenseRow) => string;
  }
> = {
  // 請求－支払：差額 = 請求金額 − 支払金額
  billPayDiff: {
    refs: () => ['billAmount', 'payAmount'],
    tooltip: (r) =>
      `請求－支払：差額 ＝ 請求金額 － 支払金額 ＝ ${fmtN(r.billAmount)} － ${fmtN(
        r.payAmount
      )}`,
  },
};

// 当該セルが計算式セルか判定する。グループ合計行・総合計行は対象外。
export const isFormulaCell = (field: string | undefined, row: ExpenseRow) =>
  !!field && !row.isGroup && !row.isTotal && !!FORMULA_DEFS[field];

// 未承認NET明細の合計対象を判定する。
// 管理区分が既定の「値引き（売上連動）」（区分値 1B3）から変更された明細は、
// NET差額の自動振替分ではなくなるため「その他拡売費」の合計対象として集計する。
// ※管理区分・管理区分名称の両列とも mgmtClass（名称）を編集するため、判定は名称で行う。
export const isNetGroupDetail = (row: ExpenseRow): boolean =>
  !!row.isNetUnapproved && row.mgmtClass === NET_MGMT_CLASS_NAME;

// 未承認NET明細のうち、管理区分を既定の「値引き（売上連動）」（区分値 1B3）から
// 変更した明細（＝その他拡売費の合計対象になっている明細）。
// フッタの「保存」「申請」押下時に、その他拡売費の明細行へ移動する対象になる。
export const isNetDetailReclassified = (row: ExpenseRow): boolean =>
  !!row.isNetUnapproved && row.mgmtClass !== NET_MGMT_CLASS_NAME;

// その他拡売費の明細のうち、管理区分を「値引き（売上連動）」（区分値 1B3）へ変更した明細。
// 未承認NET拡売費は管理区分 1B3 の明細だけを表示する一覧のため、
// フッタの「保存」「申請」押下時に未承認NET拡売費の明細行へ移動する対象になる。
export const isOtherDetailReclassifiedToNet = (row: ExpenseRow): boolean =>
  !row.isNetUnapproved && row.mgmtClass === NET_MGMT_CLASS_NAME;

// 拡売費一覧の数式を一括適用する。
//  ・未承認NET明細の支払金額＝追加口の該当商品のO列（net.byProduct[商品名]）。
//    追加口に同じ商品が無い場合は明細の値を保持する。
//    ただし利用者が支払金額を手入力した明細（payAmountManual）は上書きしない。
//    差を出した追加口明細が手入力なら、未承認NET明細も手入力にする（→ utils/payment/payment-detail/netUnapprovedLink）。
//  ・未承認NET拡売費合計（グループ）＝未承認NET明細の支払金額合計
//    （管理区分を「値引き（売上連動）」から変更した明細は その他拡売費合計 へ計上する）
//  ・各明細の税額・計画差異を再計算
//  ・その他拡売費合計（グループ）の支払金額・計画金額＝その他明細の各合計
//    （支払金額 Excel G42=SUM(G43:G49)、計画金額＝その下の明細の計画金額合計）
//  ・総合計（ピン留め）の支払金額＝未承認NET合計 + その他合計（Excel G36=SUM(G38,G42)）
//  ・総合計（ピン留め）の計画金額＝未承認NET拡売費合計の計画金額 + その他拡売費合計の計画金額
//    （Excel H36=SUM(H38,H42相当)。未承認NET明細の計画金額は対象外）
export const applyExpenseFormulas = (
  api: any,
  net?: NetUnapprovedLink
): ExpenseSummary => {
  // 未承認NET明細へ追加口一覧の連動データを当てる（支払金額・データ元）。
  if (net) {
    const nodeRows: ExpenseRow[] = [];
    api.forEachNode((node: any) => {
      if (node.data) nodeRows.push(node.data as ExpenseRow);
    });
    linkNetUnapprovedRows(nodeRows, net);
  }
  api.forEachNode((node: any) => {
    const d = node.data as ExpenseRow | undefined;
    if (!d || d.isTotal || d.isGroup) return;
    // 支払金額の初期値には請求金額を入れる（項目は分けず、手で直せる上書き）。
    // 未入力の明細だけが対象で、いったん値が入った明細は上書きしない
    //（→ 20260821_第31回 決定事項13・14）。
    if (
      !d.isNetUnapproved &&
      (d.payAmount === '' || d.payAmount == null) &&
      toNum(d.billAmount) !== null
    ) {
      d.payAmount = toNum(d.billAmount) as number;
    }
  });

  // 未承認NET明細／その他明細（未承認NET以外の明細）の各合計を集計する。
  // 枝番行は合計に含めない（グリッドの列の合計と一致させるため）。
  //   分割先  ：支払金額・計画金額列が空白（金額は分割先グループの分割金額で表す）。
  //   計画選択：支払金額列が空白。計画金額は親行の計画金額の内訳のため二重計上になる。
  let netDetailPay = 0;
  let netDetailCount = 0;
  let otherTotal = 0;
  let otherPlanTotal = 0;
  // 合計表（拡売費計）の集計対象の明細行。
  const detailRows: ExpenseRow[] = [];
  api.forEachNode((node: any) => {
    const d = node.data as ExpenseRow | undefined;
    if (!d || d.isTotal) return;
    if (d.isGroup) return;
    if (isBranchData(d)) return; // 枝番行（分割先・計画選択）は合計対象外
    detailRows.push(d);
    // 未承認NET明細でも、管理区分を「値引き（売上連動）」から変更した行は
    // その他拡売費の合計対象として集計する。
    if (isNetGroupDetail(d)) {
      netDetailPay += toNum(d.payAmount) ?? 0;
      netDetailCount += 1;
    } else {
      otherTotal += toNum(d.payAmount) ?? 0;
      otherPlanTotal += toNum(d.planAmount) ?? 0;
    }
  });
  // 未承認NET拡売費の計画金額（合計）は参照・計算せず固定値 250,000 とする。
  // ただし未承認NET明細が1件も無い場合（引用で追加した明細0件の支払回など）は 0 とする。
  const netGroupPlan = netDetailCount > 0 ? 250000 : 0;

  // グループ小計（未承認NET拡売費合計・その他拡売費合計）の支払金額・計画金額を反映する。
  api.forEachNode((node: any) => {
    const d = node.data as ExpenseRow | undefined;
    if (!d?.isGroup) return;
    if (d.product === '未承認NET拡売費合計') d.payAmount = netDetailPay;
    if (d.product === 'その他拡売費合計') {
      d.payAmount = otherTotal;
      d.planAmount = otherPlanTotal;
    }
  });

  // 総合計の支払金額＝未承認NET拡売費合計 + その他拡売費合計
  // 総合計の計画金額＝未承認NET拡売費合計の計画金額 + その他拡売費合計の計画金額
  const netPay = netDetailPay;
  const grandPay = netPay + otherTotal;
  const grandPlan = netGroupPlan + otherPlanTotal;
  // グループ行（小計）の再計算結果をグリッドへ反映する。
  api.refreshCells({ force: true });
  // タイトル下の合計サマリーバー用に、総合計とグループ別（未承認NET／その他）の
  // 支払金額・計画金額を返す。
  return {
    grandPay,
    grandPlan,
    netPay,
    netPlan: netGroupPlan,
    otherPay: otherTotal,
    otherPlan: otherPlanTotal,
    breakdown: computeExpenseBreakdown(detailRows),
  };
};

// 明細追加ペインの入力値から、その他の一覧に足す明細を作る。
// 画面の操作で追加した明細のため、データ元は「手入力」。支払金額の未入力は請求金額で埋める
//（グリッドの数式 applyExpenseFormulas と同じ扱い）。請求書番号・ページはペインの入力値
//（請求書有だけ入力できる。ほかの画面は空欄）。
export const createManualExpenseRow = (
  values: ExpenseFormValues,
  lineNo: number
): ExpenseRow => {
  const billAmount = toNum(values.billAmount);
  const payAmount = toNum(values.payAmount);
  return {
    ...BLANK,
    lineNo,
    dataSource: DEFAULT_DATA_SOURCE,
    billName: values.billName,
    billNote: values.billNote,
    planExpContent: values.planExpContent,
    product: values.product,
    billAmount: billAmount ?? '',
    payAmount: payAmount ?? billAmount ?? '',
    planAmount: 0,
    matchType: values.matchType,
    mgmtClass: values.mgmtClass,
    mgmtCode: values.mgmtCode,
    measureClass: values.measureClass,
    measureCode: values.measureCode,
    summary1: values.summary1,
    summary2: values.summary2,
    taxClass: values.taxClass,
    billNo: values.billNo ?? '',
    billPage: values.billPage ?? '',
  };
};
