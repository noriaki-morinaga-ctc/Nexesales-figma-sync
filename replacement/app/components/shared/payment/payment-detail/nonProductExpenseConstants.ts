// 拡売費一覧（PaymentNonProductExpensePane）の定数（未承認NETの管理区分・選択肢・列の状態の保存キー・税率・凡例・空の行・計算式の列など）
import { RowSelectionOptions } from 'ag-grid-community';
import { GRID_COLORS } from '@/app/components/grid';
import type { CellColorLegendItem } from '@/app/components/grid';
import { metaBrandComboOptions } from '@/app/constants/paymentComboFieldOptions';
import type { StoreOrgSelection } from '@/app/types/organization';
import { managementClassComboOptions } from '@/app/constants/comboFieldOptions';
import { MATCH_PAYMENT_TYPE_OPTIONS } from '@/app/constants/matchPaymentType';
import { createEmptyAmountBreakdown } from '@/app/utils/payment/payment-detail/paymentAmountBreakdown';
import {
  NET_MGMT_CLASS_NAME,
  NET_MGMT_CLASS_CODE,
} from '@/app/utils/payment/payment-detail/nonProductExpenseRows';
import type {
  ExpenseBasicInfo,
  ExpenseRow,
  ExpensePaneVariant,
  ExpenseSummary,
} from '@/app/types/paymentDetail';

// 管理区分／管理区分名称列の選択肢（共通マスタのみ）。
// 未承認NETの区分を持たない画面（請求書無・商流販売店紐づけなし）で使う。
export const MANAGEMENT_CLASS_COMBO_OPTIONS = managementClassComboOptions();

// 未承認NET用の区分を先頭に足した選択肢（未承認NETの一覧を持つ画面で使う）。
// 「値引き（売上連動）」は共通マスタに無い区分のため、支払情報サマリの
// 管理項目別合計値（共通マスタ10件を集計）では合計に含まれない。
// 未承認NETを持たない画面で選べてしまうと明細とサマリの合計が合わなくなるため、
// hasNetGroup の画面にだけ出す。
export const MANAGEMENT_CLASS_COMBO_OPTIONS_WITH_NET = [
  {
    value: NET_MGMT_CLASS_NAME,
    label: NET_MGMT_CLASS_NAME,
    code: `管理区分: ${NET_MGMT_CLASS_CODE}`,
  },
  ...MANAGEMENT_CLASS_COMBO_OPTIONS,
];

// basicInfo 未指定時の既定値（商流・組織列を空表示にする）。
export const EMPTY_BASIC_INFO: ExpenseBasicInfo = {
  primaryStore: '',
  tertiaryStore: '',
  store: '',
  dept: '',
  staff: '',
};

// 商流・組織の連動（StoreOrgSelection）の各項目と、行が保持するフィールドの対応。
export const STORE_ORG_FIELD: Record<
  keyof StoreOrgSelection,
  keyof ExpenseRow
> = {
  primaryStore: 'splitPrimaryStore',
  tertiaryStore: 'splitTertiaryStore',
  store: 'splitStore',
  dept: 'splitDept',
  staff: 'splitStaff',
};

// 区分・コードを選び直したときに破棄する、販売計画選択から引き継いだ区分値・名称（→ 02 §7.3 の従属セル）。
export const MGMT_PLAN_CLEARED = {
  planMgmtClassCode: '',
  planMgmtCodeName: '',
};

export const MEASURE_PLAN_CLEARED = {
  planMeasureClassCode: '',
  planMeasureCodeName: '',
};

// メタブランド列の選択肢（メタブランド名＋ブランドコードの2行表示）。
export const META_BRAND_COMBO_OPTIONS = metaBrandComboOptions();

// 拡売費一覧の列状態（列幅・並び順・ソート・固定・表示）を保存する localStorage キー。
// 列構成が画面ごとに異なるため、画面（variant）ごとに必ず別のキーにする。
// 同じキーを共有すると、一方の画面で出していない列が「非表示」として保存され、
// もう一方の画面を開いたときに復元されて列が消える（lockVisible は利用者のUI操作を
// 止めるだけで、applyColumnState による復元は止められない）。
// 版数は列ID・列順・列幅を変えたときに上げ、旧い保存状態を破棄する。
export const COLUMN_STATE_KEYS: Record<ExpensePaneVariant, string> = {
  'with-invoice': '支払詳細C.拡売費.columnState.v25',
  // v4→v5：請求－支払：差額・照合支払区分の2列を表示する列構成にしたため、
  // 2列を hide:true で保存した旧い状態を破棄する。
  'without-invoice': '支払詳細B.拡売費.columnState.v5',
  // v1→v2：請求－支払：差額・照合支払区分の2列を復活させたため、
  // 旧い保存状態（2列を持たない列順）を破棄する。
  // v2→v3：No. の右にデータ元列、卸からの請求名称の右に備考列を追加したため、
  // 2列を hide:true で保存した旧い状態を破棄する。
  'no-store-link': '支払詳細(商流販売店紐づけなし).拡売費.columnState.v3',
};

// 選択チェックボックス列（折りたたみ機能列の左）の選択オプション。
// 販売計画選択（下ペイン）の「選択」で計画明細の項目を設定する対象を選ぶ列で、
// 複数行をチェックできる（チェックした全明細へ同じ項目を設定する）。
// ※本一覧はセル編集を行うグリッドのため、行クリックでの選択（enableClickSelection）は
//   有効にせず、チェックボックスの操作のみで選択する。
export const PLAN_TARGET_ROW_SELECTION: RowSelectionOptions = {
  mode: 'multiRow',
  checkboxes: true,
  // ヘッダーは標準の全選択チェックボックスではなく「計画選択」アイコン
  //（PlanTargetSelectAllHeader）を置き、押下で一括チェック／解除する。
  headerCheckbox: false,
};

// 税区分が裏で持つ税率（パーセントの数値）。税込(円)の計算に使用する。
export const TAX_RATE_BY_CLASS: Record<string, number> = {
  '課税10%:1': 0.1,
  '課税8%:2': 0.08,
  'その他(5%):3': 0.05,
  'その他(非課税):4': 0,
};

// 税区分の選択肢（税率マスタのキーをそのまま使う）。
// 明細追加ペインでも同じ選択肢を出すため、税区分の一覧を export する。
export const EXPENSE_TAX_CLASS_OPTIONS = Object.keys(TAX_RATE_BY_CLASS);

export const TAX_CLASS_COMBO_OPTIONS = Object.keys(TAX_RATE_BY_CLASS).map(
  (v) => ({
    value: v,
    label: v,
  })
);

// 照合支払区分の選択肢（追加口明細と共通の定数を使う）。
export const MATCH_TYPE_COMBO_OPTIONS = MATCH_PAYMENT_TYPE_OPTIONS.map((v) => ({
  value: v,
  label: v,
}));

// 拡売費一覧のセルの色の凡例。色は GRID_COLORS を単一の情報源とする（→ 02 §10.1）。
// 「追加口から移した明細」（薄い紫）は、追加口と拡売費の間で明細を移す操作
//（追加口の「拡売費処理」／拡売費の「追加口処理」）を持つ画面でのみ使う。
// 請求書無ではその操作自体が無く、紫になる明細も生じないため凡例に出さない。
export const TRANSFERRED_LEGEND_ITEM: CellColorLegendItem = {
  color: GRID_COLORS.transferredBg,
  label: '追加口から移した明細',
};

export const EXPENSE_COLOR_LEGEND: CellColorLegendItem[] = [
  { color: GRID_COLORS.appliedBg, label: '拡売費計画引用で入れた項目' },
  {
    color: GRID_COLORS.changedBg,
    label: '編集したセル',
  },
  { color: GRID_COLORS.readonly, label: '入力できないセル' },
];

// サマリーバーの初期値（初回描画後は applyExpenseFormulas が再集計して上書き）。
export const INITIAL_SUMMARY: ExpenseSummary = {
  grandPay: 307633,
  grandPlan: 320233,
  netPay: 250000,
  netPlan: 250000,
  otherPay: 57633,
  otherPlan: 70233,
  breakdown: createEmptyAmountBreakdown(),
};

// 合計表（拡売費計）は utils/payment/payment-detail/paymentBreakdownItems の computeExpenseBreakdown で集計する
//（請求＝請求金額〔未承認NETの明細は0〕、支払＝支払金額、税率別＝税区分、データ元別＝明細のデータ元。
//  グループ合計行・総合計行・枝番行は含めない）。値は分割前の明細の値（→ 20260901_第33回 決定事項15）。
