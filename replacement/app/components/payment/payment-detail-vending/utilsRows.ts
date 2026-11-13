// 支払詳細(自販機)：支払明細の行と値の処理（画面の状態・定数に依存しない。行の判定・コードと名称の分解・選択肢の形への変換・数値の変換・行の作成・セルの値の受け渡しなど）（行の判定・コードと名称の分解・選択肢の形への変換・数値の変換・行の作成・セルの値の受け渡しなど）
import {
  ColDef,
  ColGroupDef,
  ICellRendererParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { parse } from 'date-fns';
import { type SingleComboboxOption } from '@/app/components/ui/single-combobox';
import type {
  ExpenseItemData,
  PaymentRoundData,
} from './paymentDetailVending.types';
import { OWN_COST_BEARING_DEPT } from '@/mocks/payment/payment-detail-vending/paymentDetail';

// 計画差異が大きい行。赤背景でハイライトし、この行だけ差異理由を入力可能にする。
export const isExpenseAlertRow = (data?: { expenseItem?: string }): boolean =>
  data?.expenseItem === 'ロケ運転費';

// 分割先の行。負担金額・費用負担部署・販売店等は分割先行のみ入力可、
// 支払金額は分割先行では入力不可（負担金額で管理する）といった出し分けに使う。
export const isSplitDestRow = (data?: { splitRole?: string }): boolean =>
  data?.splitRole === 'dest';

// ===== 列グループ（2階層ヘッダー）の定義 =====
// 経費明細グリッドは1階層。2階層化するのは「他部門から分割/振替された経費明細」タブの
// 分割/振替元グループと、ロケ契約料前払金グリッドの償却情報／償却仕訳情報グループ。

// 指定 colId の列を headerName のグループ配下へまとめ、ヘッダーを2階層化する汎用ヘルパー。
// 対象列は連続配置のため、最初の対象列の位置にグループを差し込み個々の列は取り除く。
// 分割先（経費明細）・分割/振替元（他部門タブ）・償却情報／償却仕訳情報（前払金）で共用する。
export const groupColumnsByIds = (
  cols: (ColDef | ColGroupDef)[],
  colIds: readonly string[],
  headerName: string
): (ColDef | ColGroupDef)[] => {
  const isTarget = (c: ColDef | ColGroupDef): boolean =>
    'colId' in c && typeof c.colId === 'string' && colIds.includes(c.colId);
  const children = cols.filter(isTarget) as ColDef[];
  if (children.length === 0) return cols;
  const result: (ColDef | ColGroupDef)[] = [];
  let inserted = false;
  for (const col of cols) {
    if (isTarget(col)) {
      if (!inserted) {
        result.push({ headerName, children });
        inserted = true;
      }
      continue; // 個々の対象列はグループ側に集約済みのためスキップ
    }
    result.push(col);
  }
  return result;
};

// 管理区分・管理コード・施策区分/コードは "コード:名称"（例 "69D:オペ協力金"）の1値で保持し、
// グリッドではコード列・名称列の2列に分けて表示する。以下はその取り出し・整形ヘルパー。
export const splitCategoryCode = (v?: string) => {
  if (!v) return '';
  const i = v.indexOf(':');
  return i === -1 ? v : v.slice(0, i);
};

export const splitCategoryName = (v?: string) => {
  if (!v) return '';
  const i = v.indexOf(':');
  return i === -1 ? '' : v.slice(i + 1);
};

// "コード:名称" から名称のみを返す（コードが無い値〈本社 等〉はそのまま返す）。セル表示用。
export const nameWithoutCode = (v?: string): string => {
  const s = v ?? '';
  const i = s.indexOf(':');
  return i === -1 ? s : s.slice(i + 1);
};

// SingleCombobox の選択肢へ変換する。
// グリッドのセル編集用（toComboOption）は名称＋コードの2行表示、
// 右ペイン用（toPaneOption）は "コード:名称" の1行表示。
export const toComboOption = (opt: string) => ({
  value: opt,
  label: splitCategoryName(opt),
  code: splitCategoryCode(opt),
});

export const toPaneOption = (opt: string) => ({ value: opt, label: opt });

// ===== 管理区分マスタ（経費明細グリッド） =====

// 経費明細グリッドの管理区分について、以下4点の対応を1か所で定義する。
//   ・入力可能な管理コード         … 設計資料「管理区分、管理コード.xlsx」
//   ・勘定科目                     … 設計資料「管理区分と勘定科目の組み合わせ.xlsx」
//   ・支払情報サマリの集計先管理区分 … 設計資料「支払情報サマリの管理区分集計.xlsx」
//                                     ＋ 入力対象外の管理区分の集計ルール（aggregationOnlyCodes）
//   ・管理区分の選択肢と並び順       … 下記 categories の登録順
// 集計先管理区分と勘定科目が同じ管理区分をグループにまとめ、管理区分ごとの重複記述を避ける。

// 年月日文字列（yyyy/MM/dd 等）を Date へパースする。
export const parseDateString = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  for (const fmt of ['yyyy/MM/dd', 'yyyy-MM-dd', 'yyyy/M/d']) {
    const parsed = parse(dateStr, fmt, new Date());
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

// 金額は文字列（カンマ付き）で保持するため、計算時は数値へ、表示時は3桁区切りへ変換する。
export const parseNumber = (str: string): number => {
  if (!str) return 0;
  const num = parseFloat(str.replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
};

export const formatNumber = (num: number): string =>
  Math.round(num).toLocaleString();

// 合計金額サマリーバーの表示項目（税抜合計＋税区分別の税抜金額合計）を生成する。
// 支払明細情報カード／他部門から分割/振替された経費のサマリーバーで共用する。
export const buildTotalSummaryItems = (data: ExpenseItemData[]) => {
  const exclTax = data.reduce((sum, item) => sum + parseNumber(item.amount), 0);
  const base10 = data
    .filter((item) => item.taxCategory === '1:課税10%')
    .reduce((sum, item) => sum + parseNumber(item.amount), 0);
  const base8 = data
    .filter((item) => item.taxCategory === '2:課税8%')
    .reduce((sum, item) => sum + parseNumber(item.amount), 0);
  // 非課税分の合計。税区分の名称に「非課税」を含む明細をすべて集計する
  // （コードや表記の違いに左右されないよう、コード完全一致では判定しない）。
  const baseNonTaxable = data
    .filter((item) => item.taxCategory?.includes('非課税'))
    .reduce((sum, item) => sum + parseNumber(item.amount), 0);

  // 税抜合計のみ強調表示にする。
  return [
    {
      label: '合計金額（税抜）',
      value: formatNumber(exclTax),
      emphasize: true,
    },
    { label: '10%税対象', value: formatNumber(base10), emphasize: false },
    { label: '8%税対象', value: formatNumber(base8), emphasize: false },
    {
      label: '非課税対象',
      value: formatNumber(baseNonTaxable),
      emphasize: false,
    },
  ];
};

// 基本情報カードの費用負担部署（＝自部門）と異なる部署が指定されているか。
// 未設定（undefined／空）は自部門とみなし、他部門扱いにしない。
export const isOtherCostBearingDept = (dept?: string): boolean =>
  !!dept && dept !== OWN_COST_BEARING_DEPT;

// 管理項目別合計値の「他部門へ」は、次の2つを別々の管理区分の行へ計上する。
// 経費明細グリッド・ロケ契約料前払金グリッド・費用分割グリッドで共用する。

// (1) 行の費用負担部署が自部門と異なる場合の支払金額。行の管理区分の行へ計上する。
export const sumPaymentToOtherDept = (rows: ExpenseItemData[]): number =>
  rows.reduce(
    (sum, row) =>
      sum +
      (isOtherCostBearingDept(row.costBearingDept)
        ? parseNumber(row.amount)
        : 0),
    0
  );

// (2) 分割先の費用負担部署が自部門と異なる場合の分割金額。
// 計上先は分割先の管理区分の行（呼び出し側で matchesSplitDestSummaryItem により絞り込む）。
export const sumSplitToOtherDept = (rows: ExpenseItemData[]): number =>
  rows.reduce(
    (sum, row) =>
      sum +
      (isOtherCostBearingDept(row.splitDestDept)
        ? parseNumber(row.splitAmount ?? '')
        : 0),
    0
  );

// ===== 初期データ（モック） =====
// 店舗・部署・営業担当者の コンボのセル編集用の選択肢へ変換する。
// "コード:名称" はコード/名称の2行表示、コード無し（ユカ・八洋 等）は名称1行表示にする。
export const toStoreComboOption = (opt: string): SingleComboboxOption => {
  const i = opt.indexOf(':');
  return i === -1
    ? { value: opt, label: opt }
    : { value: opt, label: opt.slice(i + 1), code: opt.slice(0, i) };
};

// 分割グループ（分割元行＋その分割先行）へ行を追加する位置と、採番する ID を求める。
// 挿入位置＝グループ内の最下行の直後、ID＝「分割元ID-枝番」（既存の最大枝番の次）。
export const splitGroupInsertInfo = (
  rows: ExpenseItemData[],
  groupId: string
): { insertIndex: number; nextId: string } => {
  let lastIndex = -1;
  let maxBranch = 0;
  rows.forEach((item, index) => {
    const isSource = item.id === groupId;
    const isDest = item.splitRole === 'dest' && item.splitGroupId === groupId;
    if (!isSource && !isDest) return;
    lastIndex = index;
    if (isDest) {
      const branch = Number(item.id.split('-').pop());
      if (!isNaN(branch)) maxBranch = Math.max(maxBranch, branch);
    }
  });
  return {
    insertIndex: lastIndex + 1,
    nextId: `${groupId}-${maxBranch + 1}`,
  };
};

// ===== セルレンダラー =====

// 明細行の複製。回の切替で表示する明細は必ずコピーを渡し、
// グリッド上の編集が保存内容（roundStore）へ及ばないようにする。
export const copyRows = (rows: ExpenseItemData[]): ExpenseItemData[] =>
  rows.map((row) => ({ ...row }));

// 新規入力用の空の1回分データ（支払情報は空・明細は0件）。
export const createEmptyRound = (): PaymentRoundData => ({
  paymentDestination: '',
  note: '',
  status: '未申請',
  applicantOffice: '',
  applicantDept: '',
  applicant: '',
  applicationDate: '',
  occurrenceDate: new Date(),
  occurrenceDateInput: '',
  accountingDateInput: '',
  paymentScheduleDate: new Date(),
  paymentScheduleDateInput: '',
  expenseData: [],
  prepaymentData: [],
});

// ===== グリッド共通のセル配色と valueGetter/cellStyle ヘルパー =====

// 分割先行のみ、指定フィールドを分割元（親：splitGroupId＝分割元 id の行）の値で表示する valueGetter。
// 通常行・分割元行は自身の値を返す。分割元の特定には共通 getRowId（id）で getRowNode を使う。
export const mirrorParentField =
  (field: keyof ExpenseItemData) =>
  (params: ValueGetterParams): string => {
    const d = params.data as ExpenseItemData | undefined;
    if (!d) return '';
    if (d.splitRole === 'dest' && d.splitGroupId) {
      const parent = params.api.getRowNode(d.splitGroupId)?.data as
        | ExpenseItemData
        | undefined;
      return (parent?.[field] as string | undefined) ?? '';
    }
    return (d[field] as string | undefined) ?? '';
  };

// 通常行のみ編集可・分割先行は編集不可とする editable コールバック。
export const editableExceptDest = (params: {
  data?: { splitRole?: string };
}): boolean => !isSplitDestRow(params.data);

// 分割先行のみが持つ列で使う valueGetter（分割元・通常行は空）。
export const destFieldValue =
  (field: keyof ExpenseItemData) =>
  (params: ValueGetterParams): string => {
    const d = params.data as ExpenseItemData | undefined;
    if (!d || d.splitRole !== 'dest') return '';
    return (d[field] as string | undefined) ?? '';
  };

// 管理区分・管理コード・施策区分/コード・摘要のように、分割元と分割先で同じ列を使い
// 保持先のフィールドだけを行の役割で切り替える列のための valueGetter／valueSetter。
// 分割先行は分割先固有フィールド（splitDest〜）、それ以外は本体フィールドを読み書きする。
export const dualFieldValue =
  (ownField: keyof ExpenseItemData, destField: keyof ExpenseItemData) =>
  (params: ValueGetterParams): string => {
    const d = params.data as ExpenseItemData | undefined;
    if (!d) return '';
    const field = d.splitRole === 'dest' ? destField : ownField;
    return (d[field] as string | undefined) ?? '';
  };

export const dualFieldSetter =
  (ownField: keyof ExpenseItemData, destField: keyof ExpenseItemData) =>
  (params: { data: ExpenseItemData; newValue: string }): boolean => {
    const field = params.data.splitRole === 'dest' ? destField : ownField;
    (params.data as unknown as Record<string, unknown>)[field] =
      params.newValue;
    return true;
  };

// 行が保持する管理区分・管理コード（分割先行は分割先固有フィールド）。
export const rowManagementCategory = (d?: ExpenseItemData): string =>
  (d?.splitRole === 'dest'
    ? d?.splitDestMgmtCategory
    : d?.managementCategory) ?? '';

export const rowManagementCodeField = (
  d: ExpenseItemData
): keyof ExpenseItemData =>
  d.splitRole === 'dest' ? 'splitDestMgmtCode' : 'managementCode';

// 管理区分の valueSetter。管理区分（主セル）だけを書き込む。
// 連動する管理コード（従属セル）は useLinkedCellUndo の deriveDeps（deriveManagementCodeDeps）で
// 更新し、Ctrl+Z 1回で管理区分と管理コードが一緒に戻るようにする（→ 02 §7.3）。
export const managementCategorySetter = dualFieldSetter(
  'managementCategory',
  'splitDestMgmtCategory'
);

// 管理コードは管理区分に紐づく組み合わせから選ぶため、管理区分が未選択の行では入力不可とする。
export const managementCodeEditable = (params: {
  data?: ExpenseItemData;
}): boolean => !!rowManagementCategory(params.data);

// 分割元・通常行の負担金額 ＝ 支払金額 − 紐づく分割先行の負担金額合計。
// 分割先へ振り分けた残り（自部門が負担する額）を表す。
export const ownBurdenAmount = (params: ValueGetterParams): number => {
  const d = params.data as ExpenseItemData | undefined;
  if (!d) return 0;
  let splitTotal = 0;
  params.api.forEachNode((node) => {
    const row = node.data as ExpenseItemData | undefined;
    if (row?.splitRole === 'dest' && row.splitGroupId === d.id) {
      splitTotal += parseNumber(row.splitAmount ?? '');
    }
  });
  return parseNumber(d.amount) - splitTotal;
};

// ===== グリッド列定義 =====

// 指定の行を分割元とする分割先行がグリッド上に存在するか。
// 折り畳みで非表示の行も対象にするため、表示行ではなく全行（forEachNode）を見る。
export const hasSplitDestRows = (
  api: ICellRendererParams['api'],
  sourceId: string
): boolean => {
  let found = false;
  api.forEachNode((node) => {
    const data = node.data as ExpenseItemData | undefined;
    if (data?.splitRole === 'dest' && data.splitGroupId === sourceId) {
      found = true;
    }
  });
  return found;
};
