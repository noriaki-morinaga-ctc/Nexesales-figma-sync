// 支払詳細(自販機)：支払データの明細確認・編集と申請/承認操作を行う画面。
// 構成は上から 基本情報カード → 管理項目別合計値 → 支払明細情報カード
// （経費明細／ロケ契約料前払金の2グリッドをトグル切替）→ 他部門から分割/振替された経費明細。
// 明細行の分割ボタンで分割先行を追加し、経費明細グリッド上で直接編集する
// （分割先行は No. 列の開閉ボタンで折り畳める）。
import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import {
  ArrowRight,
  Ban,
  CalendarIcon,
  X,
  Save,
  Send,
  Trash2,
  Check,
  Copy,
  ReceiptText,
  History,
  Split,
  Undo2,
  Stamp,
  ChevronDown,
  CornerUpLeft,
} from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import type { CustomCellEditorProps } from 'ag-grid-react';
import {
  ColDef,
  ColGroupDef,
  ICellRendererParams,
  CellValueChangedEvent,
  PostSortRowsParams,
  IRowNode,
  ValueGetterParams,
  ICellEditorParams,
  CellClassParams,
  CellStyle,
  GetRowIdParams,
} from 'ag-grid-community';
import { format, parse } from 'date-fns';
import { ja } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  useGridColumnState,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  GRID_EMPTY_TEXT,
  withHeaderTooltips,
  gridFilterContextMenuItems,
  GRID_COLORS,
  suppressEditNavKeys,
  useChangedCells,
  useRevealNewRows,
  GRID_NO_FILTER_COLUMN_TYPES,
  GRID_NUMBER_TEXT_FILTER,
} from '../../grid';
import {
  FORM_LABEL_CLASS,
  BUTTON_STYLES,
  BUTTON_BASE,
  TEXT_INPUT_CLASS,
} from '../../../../styles/commonStyles';
import { COST_BEARING_DEPT_MASTER } from '../../../constants/costBearingDeptMaster';
import { RequiredBadge } from '../../ui/required-badge';
import {
  SingleCombobox,
  type SingleComboboxOption,
} from '../../ui/single-combobox';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '../../ui/popover';
import { Calendar } from '../../ui/calendar';
import { MonthYearPicker } from '../../ui/month-year-picker';
import { BottomPane } from '../../ui/bottom-pane';
import { CollapsibleCard } from '../../ui/collapsible-card';
import { useResizableHeight, ResizeHandle } from '../../ui/resizable-panel';
import { SplitTransferMarks } from '../../shared/PaymentStatusIcons';
// コメント履歴（右ペイン）。支払詳細の各画面で共通の履歴・体裁を使う。
import { CommentHistoryPane } from '../../shared/CommentHistoryPane';
// 支払回数の切替・追加（支払詳細の各画面で共通）。
import { usePaymentRounds } from '../../shared/usePaymentRounds';
import { PaymentRoundConfirmDialog } from '../../shared/PaymentRoundConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from '../../ui/alert-dialog';
// 支払根拠資料ペイン（根拠資料表示・登録の統合ペイン）と、その表示用モック画像。
import {
  EvidenceUploadPane,
  type EvidenceTab,
  type RegisteredEvidence,
} from './components/EvidenceUploadPane';
import {
  type EvidenceFile,
  type PaymentStatus,
  type EvidenceUserRole,
  type ReceiptFormat,
} from './components/EvidenceViewerPane';
import {
  INVOICE_LANDSCAPE_PAGES,
  INVOICE_PORTRAIT,
  QUOTATION_LOCATION_OPERATION,
  QUOTATION_LOCATION_CONTRACT,
  APPROVAL_LOCATION_CONTRACT,
  APPROVAL_LOCATION_OPERATION,
  GENERIC_DOCUMENT,
} from './evidenceSampleImages';
import { ScreenTitle } from '../../ui/screen-title';

interface PaymentDetailVendingProps {
  onMenuChange?: (menuId: string) => void;
}

// 支払確認ダイアログで扱うアクション種別
type ConfirmAction =
  | 'apply'
  | 'withdraw'
  | 'approve'
  | 'seal'
  | 'reject'
  | null;

// 支払確認ダイアログのメッセージ（不変のためモジュール定数として保持・レンダー毎の再生成を避ける）
const CONFIRM_MESSAGE_MAP: Record<
  Exclude<ConfirmAction, null>,
  {
    title: string;
    description: string;
    toast: string;
    button: string;
    buttonClass: string;
  }
> = {
  apply: {
    title: '申請の確認',
    description: '支払データを申請します。よろしいですか？',
    toast: '申請が完了しました。',
    button: '申請',
    buttonClass: 'bg-green-500 hover:bg-green-600',
  },
  withdraw: {
    title: '引戻しの確認',
    description: '支払データを引戻しします。よろしいですか？',
    toast: '引戻しが完了しました。',
    button: '引戻し',
    buttonClass:
      'bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50',
  },
  approve: {
    title: '承認の確認',
    description: '支払データを承認します。よろしいですか？',
    toast: '承認が完了しました。',
    button: '承認',
    buttonClass: 'bg-green-500 hover:bg-green-600',
  },
  seal: {
    title: '検印の確認',
    description: '支払データに検印します。よろしいですか？',
    toast: '検印が完了しました。',
    button: '検印',
    buttonClass: 'bg-green-500 hover:bg-green-600',
  },
  reject: {
    title: '差戻しの確認',
    description: '支払データを差戻しします。よろしいですか？',
    toast: '差戻しが完了しました。',
    button: '差戻し',
    buttonClass: 'bg-red-500 hover:bg-red-600',
  },
};

// 画面遷移の確認ダイアログの遷移先。「一覧へ戻る」と基本情報の販売計画書No リンクで
// 同じダイアログを使い回すため、遷移先の画面IDと確認文言をまとめて持つ。
type NavigationTarget = 'paymentList' | 'planDetail';

const NAVIGATION_CONFIRM_MAP: Record<
  NavigationTarget,
  { menuId: string; description: string }
> = {
  paymentList: {
    menuId: 'payment-list',
    description:
      '支払申請一覧参照画面へ戻ります。編集中の内容は保存されません。よろしいですか？',
  },
  planDetail: {
    menuId: 'plan-detail-vending',
    description:
      '計画詳細(自販機)画面へ遷移します。編集中の内容は保存されません。よろしいですか？',
  },
};

// 経費項目一覧の1明細を表す型
interface ExpenseItemData {
  id: string; // 内部識別子
  expenseItem: string; // 経費項目
  managementCategory: string; // 管理区分
  managementCode: string; // 管理コード
  amount: string; // 金額 (円)
  taxCategory: string; // 税区分（1:課税10% / 2:課税8% / 4:その他(非課税)）。税率はこの値から自動表示
  measureCategory: string; // 施策区分
  measureCode: string; // 施策コード
  invoiceNumber: string; // 請求書番号
  note1: string; // 摘要１(社内用)
  note2: string; // 摘要２(社外用)
  // 費用負担部署（"コード:名称"）。既定は自部門。グリッド列としては表示せず、
  // 分割先の費用負担部署の初期値と「他部門へ」の集計にのみ使用する。
  costBearingDept?: string;
  // ===== 分割（分割元／分割先）関連 =====
  splitRole?: 'source' | 'dest'; // 分割セットでの役割（分割元／分割先）
  splitGroupId?: string; // 同一分割セットを束ねるキー（＝分割元の id）。ソート時のセット維持に使用
  // 販売店。分割先行は分割先の店、分割元・通常行は基本情報の値（入力不可）。
  splitDestName?: string;
  splitDestDept?: string; // 分割先の費用負担部署（分割先行のみ）
  splitSourceDate?: string; // 分割/振替日（「他部門から分割/振替された経費明細」タブ専用）
  splitSourcePaymentNo?: string; // 分割/振替元の支払No（「他部門から分割/振替された経費明細」タブ専用）
  splitSourcePaymentRound?: string; // 分割/振替元の支払回数（「他部門から分割/振替された経費明細」タブ専用）
  splitSourceOffice?: string; // 分割/振替元の事業場（「他部門から分割/振替された経費明細」タブ専用）
  splitAmount?: string; // 負担金額（分割先行のみ）。支払金額(amount)とは別枠で保持する
  // 分割先行が本体項目とは別枠で保持する値。明細グリッドでは本体と同じ列で入力し、
  // 行の役割に応じて保持先だけを切り替える（dualFieldValue／dualFieldSetter）。
  // 営業担当者。分割先行は分割先の担当者、分割元・通常行は基本情報の値（入力不可）。
  splitDestManager?: string;
  splitDestMgmtCategory?: string; // 分割先の管理区分（"コード:名称"）
  splitDestMgmtCode?: string; // 分割先の管理コード（"コード:名称"）
  splitDestMeasureCategory?: string; // 分割先の施策区分（"コード:名称"）
  splitDestMeasureCode?: string; // 分割先の施策コード（"コード:名称"）
  splitDestNote1?: string; // 分割先の摘要１(社内用)
  splitDestNote2?: string; // 分割先の摘要２(社外用)
  // 三次店・一次店。分割先行は分割先の店、分割元・通常行は基本情報の値（入力不可）。
  splitTertiaryStore?: string;
  splitPrimaryStore?: string;
  splitDestGuide?: string; // 分割先の分割案内
  // ===== ロケ契約料前払金グリッド（償却情報／償却仕訳情報）関連 =====
  amortAccrualDate?: string; // 発生日(計上開始初月)
  amortStartDate?: string; // 償却期間開始
  amortEndDate?: string; // 償却期間終了
  crmCode?: string; // CRMコード
  amortMgmtCode?: string; // 償却仕訳の管理コード（"コード:名称"）
  amortMeasureCategory?: string; // 償却仕訳の施策区分（"コード:名称"）
  amortMeasureCode?: string; // 償却仕訳の施策コード（"コード:名称"）
}

// 管理項目別合計値の1行を表す型
interface ExpenseSummaryData {
  managementCode: string; // 管理区分（コード）
  expenseItem: string; // 管理区分名称（＝経費項目名。集計の突き合わせキーも兼ねる）
  amount: string; // 支払合計 (円)
  chargeTo: string; // 他部門へ (円)（費用負担部署が自部門以外の支払金額＋分割金額）
  chargeFrom: string; // 他部門から (円)（他部門から分割/振替された金額）
  monthlyTotal: string; // 負担額合計 (円)（支払合計 − 他部門へ ＋ 他部門から）
  yearOverYear: string; // 前年比
  planAmount: string; // 計画金額
  planDifference: string; // 計画差 (円)（負担額合計 − 計画金額）
  planDifferenceRate: string; // 計画差異（％）
  differenceReason: string; // 差異理由
  aggregationAccount: string; // 集計対象の勘定科目（管理区分に対応する科目。複数ある場合は "、" 区切り）
}

// ===== 行種別の判定（行の背景色・編集可否の共用条件） =====

// 計画差異が大きい行。赤背景でハイライトし、この行だけ差異理由を入力可能にする。
const isExpenseAlertRow = (data?: { expenseItem?: string }): boolean =>
  data?.expenseItem === 'ロケ運転費';

// 配下の経費項目の上に置く区切り（見出し）行。名称に「小計」は付けない。
// 背景は計画詳細(自販機)の経費計画グリッドの営業経費／自販機関係費と同じ
// GRID_COLORS.sectionRowBg（グレー）に揃える（→ 02 §7）。
const EXPENSE_SECTION_ITEMS = ['営業経費', '自販機関係費', '長期前払費用'];
const isExpenseSectionRow = (data?: { expenseItem?: string }): boolean =>
  EXPENSE_SECTION_ITEMS.includes(data?.expenseItem ?? '');

// 集計行（合計・営業経費・自販機関係費）。1行全体を強調する
// （背景は合計＝薄い青、区切り行＝グレー。太字は合計行のみ → 02 §7）。
const EXPENSE_AGGREGATE_ITEMS = ['合計', ...EXPENSE_SECTION_ITEMS];
const isExpenseAggregateRow = (data?: { expenseItem?: string }): boolean =>
  EXPENSE_AGGREGATE_ITEMS.includes(data?.expenseItem ?? '');

// 分割先の行。負担金額・費用負担部署・販売店等は分割先行のみ入力可、
// 支払金額は分割先行では入力不可（負担金額で管理する）といった出し分けに使う。
const isSplitDestRow = (data?: { splitRole?: string }): boolean =>
  data?.splitRole === 'dest';

// ===== 列グループ（2階層ヘッダー）の定義 =====
// 経費明細グリッドは1階層。2階層化するのは「他部門から分割/振替された経費明細」タブの
// 分割/振替元グループと、ロケ契約料前払金グリッドの償却情報／償却仕訳情報グループ。

// 分割先行のみが持つ項目の colId。経費明細グリッドでは本体列と同じ階層に並べ、
// ロケ契約料前払金グリッド（分割を行わない）では除外するために使う。
const SPLIT_INFO_COL_IDS = [
  'splitDestManager',
  'splitDestStore',
  'splitPrimaryStore',
  'splitTertiaryStore',
  'splitDestGuide',
];

// 「他部門から分割/振替された経費明細」タブで第一階層「分割/振替元」にまとめる列の colId。
// 当タブは自部門が分割先のため、分割セット固有列を分割元（他部門）の情報として表示する。
// グループ内はこの配列の並び順で表示する（columnDefs 上の並びと異なるため事前に並べ替える）。
const SPLIT_SOURCE_INFO_COL_IDS = [
  'splitSourceDate',
  'splitSourcePaymentNo',
  'splitSourcePaymentRound',
  'splitSourceOffice',
  'splitDestDept',
  'splitDestManager',
];

// 「他部門から分割/振替された経費明細」タブで支払明細グリッドと項目名が異なる列のヘッダー名。
// キーは colId（colId を持たない列は field）。
const SPLIT_FROM_OTHER_HEADER_OVERRIDES: Record<string, string> = {
  amount: '負担金額 (円)', // 支払金額（当タブは他部門から計上された負担分のため）
  splitDestDept: '部署', // 分割/振替元の部署
};

// 当タブで非表示にする分割セット固有列（負担金額・販売店・三次店・一次店）。
// 負担金額は当タブでは支払金額列を「負担金額 (円)」へ改称して表示するため重複を避ける。
// 分割案内は分割/振替元グループの対象外だが列としては残すため除外対象にしない。
const SPLIT_SOURCE_INFO_HIDDEN_COL_IDS = [
  'splitAmount',
  ...SPLIT_INFO_COL_IDS.filter(
    (colId) =>
      !SPLIT_SOURCE_INFO_COL_IDS.includes(colId) && colId !== 'splitDestGuide'
  ),
];

// 指定 colId の列を headerName のグループ配下へまとめ、ヘッダーを2階層化する汎用ヘルパー。
// 対象列は連続配置のため、最初の対象列の位置にグループを差し込み個々の列は取り除く。
// 分割先（経費明細）・分割/振替元（他部門タブ）・償却情報／償却仕訳情報（前払金）で共用する。
const groupColumnsByIds = (
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

// 償却情報グループ（前払金グリッド）の子列 colId。
const AMORTIZATION_INFO_COL_IDS = [
  'amortAccrualDate',
  'amortStartDate',
  'amortEndDate',
  'crmCode',
];

// 償却仕訳情報グループ（前払金グリッド）の子列 colId。
const AMORTIZATION_JOURNAL_COL_IDS = [
  'amortMgmtCategoryCode',
  'amortMgmtCategoryName',
  'amortMgmtCodeCode',
  'amortMgmtCodeName',
  'amortMeasureCategoryCode',
  'amortMeasureCategoryName',
  'amortMeasureCodeCode',
  'amortMeasureCodeName',
];

// ===== 選択肢マスタと "コード:名称" の変換ヘルパー =====

// 管理区分・管理コード・施策区分/コードは "コード:名称"（例 "69D:オペ協力金"）の1値で保持し、
// グリッドではコード列・名称列の2列に分けて表示する。以下はその取り出し・整形ヘルパー。
const splitCategoryCode = (v?: string) => {
  if (!v) return '';
  const i = v.indexOf(':');
  return i === -1 ? v : v.slice(0, i);
};
const splitCategoryName = (v?: string) => {
  if (!v) return '';
  const i = v.indexOf(':');
  return i === -1 ? '' : v.slice(i + 1);
};
// "コード:名称" から名称のみを返す（コードが無い値〈本社 等〉はそのまま返す）。セル表示用。
const nameWithoutCode = (v?: string): string => {
  const s = v ?? '';
  const i = s.indexOf(':');
  return i === -1 ? s : s.slice(i + 1);
};

// SingleCombobox の選択肢へ変換する。
// グリッドのセル編集用（toComboOption）は名称＋コードの2行表示、
// 右ペイン用（toPaneOption）は "コード:名称" の1行表示。
const toComboOption = (opt: string) => ({
  value: opt,
  label: splitCategoryName(opt),
  code: splitCategoryCode(opt),
});
const toPaneOption = (opt: string) => ({ value: opt, label: opt });

// ===== 管理区分マスタ（経費明細グリッド） =====

// 経費明細グリッドの管理区分について、以下4点の対応を1か所で定義する。
//   ・入力可能な管理コード         … 設計資料「管理区分、管理コード.xlsx」
//   ・勘定科目                     … 設計資料「管理区分と勘定科目の組み合わせ.xlsx」
//   ・支払情報サマリの集計先管理区分 … 設計資料「支払情報サマリの管理区分集計.xlsx」
//                                     ＋ 入力対象外の管理区分の集計ルール（aggregationOnlyCodes）
//   ・管理区分の選択肢と並び順       … 下記 categories の登録順
// 集計先管理区分と勘定科目が同じ管理区分をグループにまとめ、管理区分ごとの重複記述を避ける。

// 管理コードを1件しか持たない管理区分のコード（名称は管理区分名称と同じ）。
// 組み合わせが一意に決まるため、管理区分の入力時に管理コードを自動補完する。
const SELF_MANAGEMENT_CODE = '99999';

// 部門を管理コードで持つ管理区分（オペ協力金・ロケ契約料・その他一時費用）で共用する選択肢。
const DEPARTMENT_MANAGEMENT_CODES = [
  '10010:本社',
  '10020:支社Ａ　自販機部門',
  '10180:支社Ｂ自販機（共通）',
  '10210:支社Ｂ開発（開拓）',
];

// categories は経費明細グリッドで入力できる管理区分（"コード:名称"）。
// 管理コードが SELF_MANAGEMENT_CODE の1件だけの管理区分は文字列で、
// 複数の管理コードを持つ管理区分は { category, codes } で列挙する。
// aggregationOnlyCodes は経費明細グリッドでは入力できないが、支払情報サマリでは
// このグループへ集計する管理区分コード（他システム由来の明細を拾うための集計ルール）。
const MANAGEMENT_ITEM_GROUPS: {
  summaryCategory: string; // 支払情報サマリの集計先管理区分コード
  account: string; // 勘定科目（"コード:名称"）
  categories: (string | { category: string; codes: string[] })[];
  aggregationOnlyCodes?: string[];
}[] = [
  {
    summaryCategory: '127',
    account: '1220:条件口（売上連動）',
    categories: ['127:オペ条件口(手出票)'],
    aggregationOnlyCodes: ['120', '121', '122'],
  },
  {
    summaryCategory: '33S',
    account: '2751:量販経費追加口（売上非連動）',
    categories: ['33S:ロケ運転費（売上非連動）'],
  },
  {
    summaryCategory: '69D',
    account: '5220:販売促進費（その他）',
    categories: [
      { category: '69D:オペ協力金', codes: DEPARTMENT_MANAGEMENT_CODES },
    ],
  },
  {
    summaryCategory: '69E',
    account: '5220:販売促進費（その他）',
    categories: [
      { category: '69E:ロケ契約料', codes: DEPARTMENT_MANAGEMENT_CODES },
    ],
  },
  {
    summaryCategory: '69F',
    account: '5220:販売促進費（その他）',
    categories: [
      { category: '69F:その他一時費用', codes: DEPARTMENT_MANAGEMENT_CODES },
    ],
  },
  {
    summaryCategory: 'V7P',
    account: '5590:販売器具自販機（コラム料）',
    categories: ['V7P:自販機コラム料'],
  },
  {
    summaryCategory: '880',
    account: '5520:販売器具自販機（リース料）',
    categories: [
      '880:自販機リース料',
      '881:リース料振替口（自販機）',
      '882:カードＲリース料',
      '883:自販機リース貸収入',
      'V7A:自動出票専用',
    ],
  },
  {
    summaryCategory: '89H',
    account: '5530:販売器具自販機（関係費）',
    categories: [
      '890:販売器具空缶・ビニール袋代',
      '891:販売器具工事代',
      '892:販売器具リフレッシュ費',
      '893:販売器具リース料等',
      '894:販売器具保守メンテ料',
      '895:販売器具費繰延処理',
      '896:販売器具転送費',
      '897:自販機廃棄費',
      '898:防盗対策費',
      '899:販売器具買取費',
      '89A:その他販売器具費',
      '89B:修繕費収入',
      '89C:リフレッシュ収入',
      '89D:廃棄費収入',
      '89E:リース自販機買取費',
      '89G:販売器具修繕費',
      '89H:販売器具移設費',
      {
        category: '89I:販売器具費振替',
        codes: ['88888:販売器具費振替－災害対応', '99999:販売器具費振替'],
      },
      '89J:自販機移設転送費',
      '89K:自販機整備転送費',
      '89L:自販機廃棄転送費',
      '89M:自販機付帯品送料',
      '89N:自販機部品送料',
      '89O:自販機付帯品取付取外',
      '89P:自販機付帯品整備',
      'V7F:自動出票専用',
    ],
  },
  {
    summaryCategory: '89H',
    account: '5580:販売器具自販機（減価償却費）',
    categories: ['8A1:リース自販機買取（減価償却費）', 'V7K:自動出票専用'],
  },
  {
    summaryCategory: '89H',
    account: '5610:販売器具自販機（保険料）',
    categories: ['V7U:販売器具自販機（保険料）'],
  },
  {
    summaryCategory: '89H',
    account: '5630:販売器リース資産減価償却費',
    categories: ['V7Z:自販機リース資産減価償却費'],
  },
];

// グループを管理区分単位へ展開したマスタ。以降の参照はすべてこの配列から導出する。
const MANAGEMENT_ITEM_MASTER = MANAGEMENT_ITEM_GROUPS.flatMap((group) =>
  group.categories.map((entry) => {
    const category = typeof entry === 'string' ? entry : entry.category;
    return {
      category,
      codes:
        typeof entry === 'string'
          ? [`${SELF_MANAGEMENT_CODE}:${splitCategoryName(category)}`]
          : entry.codes,
      summaryCategory: group.summaryCategory,
      account: group.account,
    };
  })
);

// 管理区分コードでの参照用（管理コード・勘定科目・集計先はすべてここから引く）。
const MANAGEMENT_ITEM_BY_CATEGORY_CODE = Object.fromEntries(
  MANAGEMENT_ITEM_MASTER.map((m) => [splitCategoryCode(m.category), m])
);
const managementItem = (managementCategory?: string) =>
  MANAGEMENT_ITEM_BY_CATEGORY_CODE[splitCategoryCode(managementCategory)];

// 管理区分の選択肢（マスタの登録順）。
const MANAGEMENT_CATEGORY_OPTIONS = MANAGEMENT_ITEM_MASTER.map(
  (m) => m.category
);
const MANAGEMENT_CATEGORY_COMBO_OPTIONS =
  MANAGEMENT_CATEGORY_OPTIONS.map(toComboOption);

// 管理区分に紐づく管理コードの選択肢。管理区分が未選択の行では選択肢を出さない
// （管理区分を決めないと組み合わせが定まらないため）。
const managementCodeOptions = (managementCategory?: string): string[] =>
  managementItem(managementCategory)?.codes ?? [];
const MANAGEMENT_CODE_COMBO_OPTIONS_BY_CATEGORY: Record<
  string,
  SingleComboboxOption[]
> = Object.fromEntries(
  MANAGEMENT_ITEM_MASTER.map((m) => [
    splitCategoryCode(m.category),
    m.codes.map(toComboOption),
  ])
);
const managementCodeComboOptions = (
  managementCategory?: string
): SingleComboboxOption[] =>
  MANAGEMENT_CODE_COMBO_OPTIONS_BY_CATEGORY[
    splitCategoryCode(managementCategory)
  ] ?? [];

// 管理区分に紐づく管理コードかを判定する（管理区分の変更時に組み合わせの成立を確認する）。
const isValidManagementCode = (
  managementCategory: string,
  managementCode: string
): boolean =>
  managementCodeOptions(managementCategory).includes(managementCode);

// 管理区分に対応する勘定科目。対応が無い管理区分（未入力・旧データ）は空文字を返す。
const managementAccount = (managementCategory?: string): string =>
  managementItem(managementCategory)?.account ?? '';

// 管理区分コード → 支払情報サマリの集計先管理区分コード。
// 入力可能な管理区分に加え、入力はできないが集計対象となるコード（aggregationOnlyCodes）も含める。
const SUMMARY_TARGET_BY_CATEGORY_CODE: Record<string, string> =
  Object.fromEntries([
    ...MANAGEMENT_ITEM_MASTER.map((m) => [
      splitCategoryCode(m.category),
      m.summaryCategory,
    ]),
    ...MANAGEMENT_ITEM_GROUPS.flatMap((group) =>
      (group.aggregationOnlyCodes ?? []).map((code) => [
        code,
        group.summaryCategory,
      ])
    ),
  ]);

// 支払情報サマリの集計先管理区分コード。マスタに無いコード（旧データ等）は自身を集計先とする。
const summaryTargetCategoryCode = (categoryCode: string): string =>
  SUMMARY_TARGET_BY_CATEGORY_CODE[categoryCode] ?? categoryCode;

// ===== 基本情報カードの参照専用の項目値（モック）。他の支払詳細画面と表記・構成を揃える =====
const BASIC_INFO_APPLICATION_DATE = '2025/06/15'; // 申請日（対象年月の翌月）
// 申請時に確定する組織情報（モック）。申請事業場・申請部署＝実際に伝票を入力した組織。
const BASIC_INFO_APPLICANT_OFFICE = '10002012:近畿圏本部'; // 申請事業場
const BASIC_INFO_APPLICANT_DEPT = '10000121:近畿圏本部営業一部'; // 申請部署
// 分割・振替有無。本支払は分割・振替とも発生していない。
const BASIC_INFO_IS_SPLIT = false;
const BASIC_INFO_IS_TRANSFER = false;

// 未着請求書有（モック）。支払データの未着請求書区分を参照専用（非活性）で表示する。
const HAS_UNARRIVED_INVOICE = false;

// ロケ契約料前払金グリッドの償却仕訳情報グループ内「管理区分」の固定値（"コード:名称"）。
// 当グリッドは全行がロケ契約料他前払い金(償却)のため、604 固定・入力不可で表示する。
const AMORTIZATION_FIXED_MANAGEMENT_CATEGORY = '604:ロケ契約料他前払い金(償却)';

// ===== セルエディタ =====

// "コード:名称" 項目の検索付きドロップダウン（コード/名称どちらでも絞り込み可）。
// 選択肢は cellEditorParams.comboOptions で受け取る。
// AG Grid 35 のリアクティブ方式：props.onValueChange で確定値をプロキシへ反映してから stopEditing。
const ComboCellEditor = (
  props: CustomCellEditorProps & {
    comboOptions: SingleComboboxOption[];
    clearable?: boolean;
  }
) => {
  return (
    <div className="p-1" style={{ width: '22rem' }}>
      <SingleCombobox
        options={props.comboOptions}
        value={(props.value as string) ?? ''}
        clearable={props.clearable}
        onChange={(v) => {
          props.onValueChange(v); // 確定値をプロキシへ反映（同期更新）
          props.stopEditing(); // 選択で編集確定
        }}
        autoOpen
        // ポップアップエディタ内ではポータルにすると外側クリック扱いになり
        // 選択前に編集確定してしまうため、インライン描画にする。
        usePortal={false}
        placeholder="コード または 名称で検索..."
      />
    </div>
  );
};

// 年月日文字列（yyyy/MM/dd 等）を Date へパースする。
const parseDateString = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  for (const fmt of ['yyyy/MM/dd', 'yyyy-MM-dd', 'yyyy/M/d']) {
    const parsed = parse(dateStr, fmt, new Date());
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

// 年月日（yyyy/MM/dd）をテキスト入力またはカレンダー選択で入力するセルエディタ。
// カレンダーは ComboCellEditor と同じ理由でインライン描画する。
const DateCellEditor = (props: CustomCellEditorProps) => {
  const value = (props.value as string) ?? '';
  const selected = parseDateString(value) ?? undefined;
  return (
    <div className="w-64 space-y-1 rounded-md border border-gray-200 bg-white p-2 shadow-md">
      <Input
        value={value}
        onChange={(e) => props.onValueChange(e.target.value)}
        placeholder="yyyy/MM/dd"
        className={`${TEXT_INPUT_CLASS} w-full`}
        autoFocus
      />
      <Calendar
        mode="single"
        selected={selected}
        onSelect={(date) => {
          if (!date) return;
          props.onValueChange(format(date, 'yyyy/MM/dd', { locale: ja }));
          props.stopEditing(); // 日付選択で編集確定
        }}
        initialFocus
      />
    </div>
  );
};

// 税区分の選択肢。税率はこの税区分に応じて自動表示する（読み取り専用）。
// コードはマスタの値のため、選択肢から外したコード（3:その他(5%)）の分は
// 欠番のままにし、後続の「4:その他(非課税)」を繰り上げない。
const TAX_CATEGORY_OPTIONS = ['1:課税10%', '2:課税8%', '4:その他(非課税)'];

const MEASURE_CATEGORY_OPTIONS = [
  '01:本社拡売費',
  '02:支社拡売費',
  '99:その他',
];
const MEASURE_CODE_OPTIONS = [
  '001:新商品導入施策',
  '002:店頭販促施策',
  '003:価格訴求施策',
  '004:季節キャンペーン',
  '005:エリア限定施策',
];
const PAYMENT_DESTINATION_OPTIONS = [
  '1001584:AAA営業本部商品部',
  '1001585:BBB営業本部商品部',
  '1001586:CCC営業本部商品部',
];

// 施策区分・施策コード・支払先の選択肢（グリッド用／右ペイン用）。
// ロケ契約料前払金グリッドの償却仕訳情報グループの管理コード（管理区分は 604 固定のため
// 経費明細グリッドの組み合わせマスタの対象外）は部門の選択肢を流用する。
const AMORTIZATION_MANAGEMENT_CODE_COMBO_OPTIONS =
  DEPARTMENT_MANAGEMENT_CODES.map(toComboOption);
const MEASURE_CATEGORY_COMBO_OPTIONS =
  MEASURE_CATEGORY_OPTIONS.map(toComboOption);
const MEASURE_CODE_COMBO_OPTIONS = MEASURE_CODE_OPTIONS.map(toComboOption);
const PAYMENT_DESTINATION_PANE_OPTIONS =
  PAYMENT_DESTINATION_OPTIONS.map(toPaneOption);

// ===== 管理項目別合計値の集計定義 =====

// 前払金の償却項目（管理区分コード XKA）の経費項目名。
// 合計値グリッドの最下行・ロケ契約料前払金グリッドの固定表示・計画対象外の判定で
// 同じ文字列を参照するため定数化する。
const PREPAID_AMORTIZATION_ITEM = '長期前払費用自販機関係費';

// XKA に対応する勘定科目。合計値グリッドの集計対象の勘定科目と、
// ロケ契約料前払金グリッド（管理区分 XKA 固定）の勘定科目表示で共用する。
const PREPAID_AMORTIZATION_ACCOUNT = 'K150:長期前払費用C/V関係費';

// 合計値グリッドに表示する経費項目（集計対象が無い項目は金額0で表示される）。
const SUMMARY_EXPENSE_ITEMS = [
  'オペ条件口(手出票)',
  'ロケ運転費',
  'オペ協力金',
  'その他一時費用',
  'ロケ契約料',
  '自販機コラム料',
  '自販機リース料',
  '販売器具移設費',
  // XKA（前払金の償却項目）は最下行に配置する
  PREPAID_AMORTIZATION_ITEM,
];

// 「管理区分」列に表示する管理区分コード（経費明細の集計先管理区分＝
// MANAGEMENT_ITEM_MASTER の summaryCategory に対応）。
// 880（自販機リース料）・89H（販売器具移設費）の行は、それぞれ同じグループの
// 他の管理区分（881〜883・890〜89P 等）もまとめて集計する。
const SUMMARY_MANAGEMENT_CODE: Record<string, string> = {
  'オペ条件口(手出票)': '127',
  ロケ運転費: '33S',
  オペ協力金: '69D',
  その他一時費用: '69F',
  ロケ契約料: '69E',
  [PREPAID_AMORTIZATION_ITEM]: 'XKA',
  自販機コラム料: 'V7P',
  自販機リース料: '880',
  販売器具移設費: '89H',
};

// 「集計対象の勘定科目」列に表示する科目（サマリの管理区分コード別）。
// サマリの各行に集計される管理区分の勘定科目を、管理区分マスタから集約する
// （集計先が同じ管理区分でも勘定科目は異なりうるため配列で保持し、表示時に "、" で連結する）。
// XKA（前払金の償却項目）は経費明細の管理区分マスタの対象外のため個別に持つ。
const SUMMARY_AGGREGATION_ACCOUNTS: Record<string, string[]> =
  MANAGEMENT_ITEM_MASTER.reduce(
    (accounts, item) => {
      const list = (accounts[item.summaryCategory] ??= []);
      if (!list.includes(item.account)) list.push(item.account);
      return accounts;
    },
    { XKA: [PREPAID_AMORTIZATION_ACCOUNT] } as Record<string, string[]>
  );

// 合計値の各行に足し込む明細かを判定する。
// 明細グリッドに「経費項目」列は無く利用者が入力するのは管理区分のため、管理区分コードで突き合わせる
// （これにより行追加で入力された明細も合計値へ反映される）。
// 明細の管理区分は集計先管理区分（自販機リース料＝880・販売器具移設費＝89H へ寄せる）へ読み替えて比較する。
// 管理区分が未入力の行（分割先明細など）は経費項目名の一致で判定する。
const matchesSummaryItem = (
  d: Pick<ExpenseItemData, 'expenseItem' | 'managementCategory'>,
  item: string
): boolean => {
  const code = splitCategoryCode(d.managementCategory);
  return code
    ? summaryTargetCategoryCode(code) === SUMMARY_MANAGEMENT_CODE[item]
    : d.expenseItem === item;
};

// 分割金額（「他部門へ」）を足し込む合計値の行かを、分割先の管理区分で判定する。
// 分割先の管理区分が未入力の場合は分割元から引き継いだ経費項目名で判定する。
const matchesSplitDestSummaryItem = (
  d: ExpenseItemData,
  item: string
): boolean =>
  matchesSummaryItem(
    {
      expenseItem: d.expenseItem,
      managementCategory: d.splitDestMgmtCategory ?? '',
    },
    item
  );

// 金額は文字列（カンマ付き）で保持するため、計算時は数値へ、表示時は3桁区切りへ変換する。
const parseNumber = (str: string): number => {
  if (!str) return 0;
  const num = parseFloat(str.replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
};

const formatNumber = (num: number): string => Math.round(num).toLocaleString();

// 合計金額サマリーバーの表示項目（税抜合計＋税区分別の税抜金額合計）を生成する。
// 支払明細情報カード／他部門から分割/振替された経費のサマリーバーで共用する。
const buildTotalSummaryItems = (data: ExpenseItemData[]) => {
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
    { label: '合計金額(税抜)', value: formatNumber(exclTax), emphasize: true },
    { label: '10%税対象', value: formatNumber(base10), emphasize: false },
    { label: '8%税対象', value: formatNumber(base8), emphasize: false },
    {
      label: '非課税対象',
      value: formatNumber(baseNonTaxable),
      emphasize: false,
    },
  ];
};

// 自部門の費用負担部署（画面ヘッダー表示・明細/分割先の既定値で共用）
const OWN_COST_BEARING_DEPT = '10000328:近畿圏本部営業一部';

// 基本情報カード（画面ヘッダー）の表示値。明細の初期データ・分割先の新規行初期値でも
// 参照するため、それらより前に定義する。
const BASIC_INFO_CREATOR = '5172733:アサヒ太郎'; // 営業担当者
const BASIC_INFO_SALES_STORE = '30200743:イオン'; // 販売店
const BASIC_INFO_TERTIARY_STORE = '10754885:日本アクセス株式会社首都圏支社'; // 三次店
const BASIC_INFO_PRIMARY_STORE = '10010078:日本アクセス仙台営業所'; // 一次店

// 基本情報カードの費用負担部署（＝自部門）と異なる部署が指定されているか。
// 未設定（undefined／空）は自部門とみなし、他部門扱いにしない。
const isOtherCostBearingDept = (dept?: string): boolean =>
  !!dept && dept !== OWN_COST_BEARING_DEPT;

// 管理項目別合計値の「他部門へ」は、次の2つを別々の管理区分の行へ計上する。
// 経費明細グリッド・ロケ契約料前払金グリッド・費用分割グリッドで共用する。

// (1) 行の費用負担部署が自部門と異なる場合の支払金額。行の管理区分の行へ計上する。
const sumPaymentToOtherDept = (rows: ExpenseItemData[]): number =>
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
const sumSplitToOtherDept = (rows: ExpenseItemData[]): number =>
  rows.reduce(
    (sum, row) =>
      sum +
      (isOtherCostBearingDept(row.splitDestDept)
        ? parseNumber(row.splitAmount ?? '')
        : 0),
    0
  );

// ===== 初期データ（モック） =====

const INITIAL_DATA: ExpenseItemData[] = [
  {
    id: '1',
    expenseItem: 'ロケ運転費',
    managementCategory: '33S:ロケ運転費（売上非連動）',
    managementCode: '99999:ロケ運転費（売上非連動）',
    amount: '500,000',
    taxCategory: '1:課税10%',
    measureCategory: '',
    measureCode: '',
    invoiceNumber: '',
    note1: '',
    note2: '',
  },
  {
    id: '2',
    expenseItem: 'オペ協力金',
    managementCategory: '69D:オペ協力金',
    managementCode: '10020:支社Ａ　自販機部門',
    amount: '30,000',
    taxCategory: '1:課税10%',
    measureCategory: '',
    measureCode: '',
    invoiceNumber: '',
    note1: '',
    note2: '',
    splitRole: 'source',
    splitGroupId: '2',
  },
  // オペ協力金の分割先1（分割元 id:2 の直下に表示）。金額以外は分割元の情報を表示し非活性。
  {
    id: '2-1',
    expenseItem: 'オペ協力金',
    managementCategory: '69D:オペ協力金',
    managementCode: '10020:支社Ａ　自販機部門',
    amount: '',
    taxCategory: '1:課税10%',
    measureCategory: '',
    measureCode: '',
    invoiceNumber: '',
    note1: '',
    note2: '',
    splitRole: 'dest',
    splitGroupId: '2',
    splitDestName: 'ユカ',
    splitDestDept: '10000219:本社共通',
    splitAmount: '12,500',
    splitDestMgmtCategory: '69D:オペ協力金',
    splitDestMgmtCode: '10180:支社Ｂ自販機（共通）',
  },
  // オペ協力金の分割先2
  {
    id: '2-2',
    expenseItem: 'オペ協力金',
    managementCategory: '69D:オペ協力金',
    managementCode: '10210:支社Ｂ開発（開拓）',
    amount: '',
    taxCategory: '1:課税10%',
    measureCategory: '',
    measureCode: '',
    invoiceNumber: '',
    note1: '',
    note2: '',
    splitRole: 'dest',
    splitGroupId: '2',
    splitDestName: '八洋',
    splitDestDept: '10001938:首都圏本部営業二部',
    splitAmount: '12,500',
    splitDestMgmtCategory: '69F:その他一時費用',
    splitDestMgmtCode: '10210:支社Ｂ開発（開拓）',
  },
  {
    id: '3',
    expenseItem: 'その他一時費用',
    managementCategory: '69F:その他一時費用',
    managementCode: '10010:本社',
    amount: '120,000',
    taxCategory: '2:課税8%',
    measureCategory: '',
    measureCode: '',
    invoiceNumber: '',
    note1: '',
    note2: '',
  },
  {
    id: '4',
    expenseItem: '自販機コラム料',
    managementCategory: 'V7P:自販機コラム料',
    managementCode: '99999:自販機コラム料',
    amount: '80,000',
    taxCategory: '1:課税10%',
    measureCategory: '',
    measureCode: '',
    invoiceNumber: '',
    note1: '',
    note2: '',
  },
];

// 明細行の既定値。費用負担部署は自部門、販売店・三次店・一次店は基本情報の値、
// 営業担当者は基本情報の値とする。
// 分割先行は自身が持つ値を使うため、この既定値は分割元・通常行にのみ適用する
// （行ごとの値があればそちらを優先）。
const withRowDefaults = (row: ExpenseItemData): ExpenseItemData =>
  row.splitRole === 'dest'
    ? { costBearingDept: OWN_COST_BEARING_DEPT, ...row }
    : {
        costBearingDept: OWN_COST_BEARING_DEPT,
        splitDestName: BASIC_INFO_SALES_STORE,
        splitTertiaryStore: BASIC_INFO_TERTIARY_STORE,
        splitPrimaryStore: BASIC_INFO_PRIMARY_STORE,
        splitDestManager: BASIC_INFO_CREATOR,
        ...row,
      };

// 経費明細グリッドの初期データ（INITIAL_DATA の全行）。
const PAYMENT_DETAIL_INITIAL_DATA: ExpenseItemData[] =
  INITIAL_DATA.map(withRowDefaults);

// 「ロケ契約料前払金」グリッドの初期データ（支払明細とは独立したコピーとして保持する）。
const PREPAYMENT_EXCLUDED_IDS = ['2-1', '2-2', '3', '4'];
const PREPAYMENT_INITIAL_DATA: ExpenseItemData[] = INITIAL_DATA.filter(
  (row) => !PREPAYMENT_EXCLUDED_IDS.includes(row.id)
).map(withRowDefaults);

// ===== 画面固有の定数（基本情報カードの表示値・レイアウト値） =====

const PAYMENT_NO = 'C2400NTO2'; // 支払No
const SALES_PLAN_NO = 'D2420TK08'; // 販売計画書No（計画詳細(自販機)へのリンク元）

// ===== 支払根拠資料（モックデータ） =====

// 根拠資料のダミーデータ（支払回数ごと）。
// 根拠資料は支払回数単位で持つため、回をキーにして保持する。
// NO. は登録した順に振る（登録日の昇順＝サムネの並び順の初期値）。
// タイムスタンプはアマノ社の定額プラン（1TS/30秒）の制約で順次付与されるため、
// 最後に登録した2件を「待ち」にして、順に付与されていく様子を見せる。
// 1回目：資料を登録済みの回。
//        検印後の資料は置かない。検印後の見せ方は別途 APM用画面で作るため、
//        この画面に混ぜると「通常画面なのに削除できない」状態になってしまう。
// 2回目以降：未登録（0件表示の確認用）
// 既存のモックデータは原本ファイル（アップロードされた実体）を持たない。
// プレビューはページ画像（pageUrls）で見せるが、原本DLはできない状態として初期化する
// （指示書 D5・T4：DLボタンは disabled ＋「モックデータのため原本ファイルなし」）。
const asMockWithoutOriginal = (files: EvidenceFile[]): EvidenceFile[] =>
  files.map((f) => ({
    ...f,
    originalUrl: undefined,
    pdfPreviewUrl: undefined,
    convertStatus: 'failed' as const,
  }));

const INITIAL_EVIDENCE_FILES_BY_ROUND: Record<string, EvidenceFile[]> = {
  '1': asMockWithoutOriginal([
    {
      id: 'e1',
      no: 1,
      kind: '請求書',
      fileName: '請求書_サンプルベンディング東_202206.pdf',
      updatedAt: '2026/07/10',
      // 横長（A4横）の請求書。3ページあるためプレビュー内を縦スクロールして送る
      thumbnailUrl: INVOICE_LANDSCAPE_PAGES[0],
      pageUrls: INVOICE_LANDSCAPE_PAGES,
      receiptFormat: '紙と電子' as const,
      issueDate: '2026/07/01',
      timestampStatus: '付与済',
      timestampedAt: '2026/07/10',
    },
    {
      id: 'e2',
      no: 2,
      kind: '見積書',
      fileName: '見積書_ロケ運転費_サンプルベンディング東_202507.pdf',
      updatedAt: '2026/07/10',
      thumbnailUrl: QUOTATION_LOCATION_OPERATION,
      memo: '請求金額が見積と一部異なるため、差額の内訳を別紙（その他資料）に添付。',
      timestampStatus: '付与済',
      timestampedAt: '2026/07/10',
    },
    {
      id: 'e3',
      no: 3,
      kind: '稟議書',
      fileName: '稟議書_ロケ契約_RG-2025-0713.pdf',
      updatedAt: '2026/07/10',
      thumbnailUrl: APPROVAL_LOCATION_CONTRACT,
      timestampStatus: '付与済',
      timestampedAt: '2026/07/10',
    },
    {
      id: 'e4',
      no: 4,
      kind: 'その他の資料',
      fileName: 'ロケ運転費台帳_202206.xlsx',
      updatedAt: '2026/07/11',
      timestampStatus: '付与済',
      timestampedAt: '2026/07/11',
    },
    {
      // 覚書・契約書（2026-09-08 修正指示3 で区分追加）。ロケ契約の覚書。
      id: 'e5c',
      no: 5,
      kind: '覚書・契約書',
      fileName: '覚書_ロケ契約_サンプルベンディング東_2025年度.pdf',
      updatedAt: '2026/07/10',
      thumbnailUrl: GENERIC_DOCUMENT,
      memo: '2025年度ロケ契約の覚書（契約料改定分）。',
      timestampStatus: '付与済',
      timestampedAt: '2026/07/10',
    },
    {
      // 未着の覚書・契約書（代替＝ドラフト版を登録したもの）。
      // 表示タブでは区分「覚書・契約書」＋未着バッジ＋回収予定日を出す（修正指示9）。
      id: 'e5d',
      no: 6,
      kind: '覚書・契約書',
      fileName: '覚書ドラフト_ロケ契約更新_202207.pdf',
      updatedAt: '2026/07/11',
      thumbnailUrl: GENERIC_DOCUMENT,
      notReceived: true,
      collectionDate: '2026/07/31',
      timestampStatus: '付与済',
      timestampedAt: '2026/07/11',
    },
    {
      id: 'e6',
      no: 7,
      // 未着の請求書（代替請求書＝支払通知書を登録したもの）。
      // 表示タブでは区分「請求書」＋未着バッジ＋回収予定日を出す（回答A-3・修正指示8）。
      kind: '請求書',
      fileName: '支払通知書_サンプルベンディング中央_202206.pdf',
      updatedAt: '2026/07/11',
      thumbnailUrl: INVOICE_PORTRAIT,
      notReceived: true,
      collectionDate: '2026/07/25',
      receiptFormat: '電子' as const,
      issueDate: '2026/07/05',
      timestampStatus: '付与済',
      timestampedAt: '2026/07/11',
    },
    {
      id: 'e7b',
      no: 6,
      kind: '稟議書',
      fileName: '稟議書_ロケ運転費_RG-2025-0689.pdf',
      updatedAt: '2026/07/11',
      thumbnailUrl: APPROVAL_LOCATION_OPERATION,
      timestampStatus: '付与済',
      timestampedAt: '2026/07/11',
    },
    {
      id: 'e8',
      no: 7,
      kind: '見積書',
      fileName: '見積書_ロケ契約料他前払金_ダミーストア本部.pdf',
      updatedAt: '2026/07/12',
      thumbnailUrl: QUOTATION_LOCATION_CONTRACT,
      // 付与待ち。開くと30秒間隔（モックは5秒）で順に付与されていく
      timestampStatus: '待ち',
    },
    {
      // 縦長（A4縦）の請求書。検印後に APM が登録した正式な請求書の想定。
      //  ・afterSeal … 「検印後」バッジが出る。検印済の伝票を開いたときの見え方を確認できる
      //  ・付与待ち … 1件付与された後も「済」と「待ち」が画面に並んで残るようにする
      //    （差が見えないと状態表示の意味が伝わらない）
      id: 'e5',
      no: 8,
      kind: '請求書',
      fileName: '請求書_サンプルベンディング中央_202206_検印後追加.pdf',
      updatedAt: '2026/07/18',
      thumbnailUrl: INVOICE_PORTRAIT,
      afterSeal: true,
      timestampStatus: '待ち',
    },
  ]),
  // 2回目は根拠資料が未登録の回。開くと0件メッセージが出る（未登録の状態を見せるため）。
  '2': [],
};

// ログインしている利用者の区分。本番は認証情報から決まる値であり、画面側で選ぶものではない。
// モックは担当者に固定する（APM 用の見え方は別途 APM用画面で作る）。
const EVIDENCE_USER_ROLE: EvidenceUserRole = '担当者';

// 引用元選択ペインの表示値。対象年月は引用元が固定のため入力不可で表示する。
const QUOTE_SOURCE_TARGET_MONTH = '2025/04';
const QUOTE_SOURCE_PAYMENT_NO = 'C2400NTO1';
const QUOTE_SOURCE_ROUND_OPTIONS = ['1', '2'];

// 引用で追加する回の計上月・支払予定日（引用元の日付ではなく当月分の値を設定する）。
const QUOTED_ACCOUNTING_MONTH = '2025/06';
const QUOTED_PAYMENT_SCHEDULE_DATE = '2025/07/31';

// 支払回数=2 の引用元では持たない明細の id（分割先2件と その他一時費用）。
const QUOTE_SOURCE_ROUND2_EXCLUDED_IDS = ['2-1', '2-2', '3'];

// 支払回数=2 の引用元で id を振り直す明細（除外により空いた番号を詰める）。
const QUOTE_SOURCE_ROUND2_RENUMBERED_IDS: Record<string, string> = {
  '4': '3', // コラム料：id:3 が除外されたため繰り上げる
};

// 引用元の支払情報・経費明細（モック・参照専用）。支払回数の選択で切り替える。
// 引用元選択ペインでの表示と、引用時のコピー元で共用する
// （ロケ契約料前払金は引用対象外のため持たない）。
const QUOTE_SOURCE_BY_ROUND: Record<
  string,
  {
    destination: string; // 支払先
    occurrenceDate: string; // 発生日
    scheduledDate: string; // 支払予定日
    note: string; // 備考
    expenseData: ExpenseItemData[]; // 経費明細
  }
> = {
  '1': {
    destination: '1001584:AAA営業本部商品部',
    occurrenceDate: '2025/04/15',
    scheduledDate: '2025/06/30',
    note: '4月分の支払情報',
    expenseData: PAYMENT_DETAIL_INITIAL_DATA,
  },
  '2': {
    destination: '1001586:CCC営業本部商品部',
    occurrenceDate: '2025/04/15',
    scheduledDate: '2025/06/30',
    note: '4月分の支払情報',
    expenseData: PAYMENT_DETAIL_INITIAL_DATA.filter(
      (row) => !QUOTE_SOURCE_ROUND2_EXCLUDED_IDS.includes(row.id)
    ).map((row) => ({
      ...row,
      id: QUOTE_SOURCE_ROUND2_RENUMBERED_IDS[row.id] ?? row.id,
    })),
  },
};

// 支払情報サマリカードの本体高さ（px）。リサイズハンドルのドラッグで手動調整する。
// 既定値は管理項目別合計値グリッドが縦スクロールせずに収まる高さ、下限は縮めすぎ防止。
// 高さの拡縮は共通フック useResizableHeight（ui/resizable-panel）に統一しているため、
// 単位も同フックに合わせて px とする（計画詳細(NET固定)＝ PlanAggregationPane と同じ）。
const SUMMARY_CARD_DEFAULT_HEIGHT = 512;
const SUMMARY_CARD_MIN_HEIGHT = 200;

// 支払明細情報カードの本体高さ（px）。サマリカードと同じくドラッグで手動調整する。
// 既定値は「画面高 － 上部の固定領域(140px)」の 3/4。画面高に応じて算出するため、
// 従来のビューポート基準の高さ（calc(100vh - 8.75rem)）との比率を画面サイズによらず保てる。
const DETAIL_CARD_HEIGHT_OFFSET = 140;
const DETAIL_CARD_INITIAL_RATIO = 0.75;
const DETAIL_CARD_MIN_HEIGHT = 300;
// 拡縮の上限（既定の 800px では画面いっぱいまで広げられないため、画面高を上限にする）
const DETAIL_CARD_MAX_HEIGHT = 2000;
const initialDetailCardHeight = (): number =>
  Math.max(
    DETAIL_CARD_MIN_HEIGHT,
    (window.innerHeight - DETAIL_CARD_HEIGHT_OFFSET) * DETAIL_CARD_INITIAL_RATIO
  );

// トグル切替（青枠ボタン群）の各ボタンのクラス。選択中＝塗り青／未選択＝白地・青文字。
const toggleButtonClass = (isActive: boolean, isFirst = false): string =>
  `h-8 whitespace-nowrap px-4 py-1 text-sm font-medium transition-colors ${
    isFirst ? '' : 'border-l border-blue-600 '
  }${isActive ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 hover:bg-blue-50'}`;

// 分割先行のドロップダウン選択肢（販売店・三次店・一次店）。
// 費用負担部署は共通マスタ（constants/costBearingDeptMaster.ts）の全部署をそのまま使う。
const SALES_STORE_OPTIONS = ['21100677:XXX九州', 'ユカ', '八洋'];
const TERTIARY_STORE_OPTIONS = ['10863223:YYY九州', '10863224:YYY関東'];
const PRIMARY_STORE_OPTIONS = ['10888030:ZZZ九州支店', '10888031:ZZZ関東支店'];

// 店舗・部署・営業担当者の ComboCellEditor 用の選択肢へ変換する。
// "コード:名称" はコード/名称の2行表示、コード無し（ユカ・八洋 等）は名称1行表示にする。
const toStoreComboOption = (opt: string): SingleComboboxOption => {
  const i = opt.indexOf(':');
  return i === -1
    ? { value: opt, label: opt }
    : { value: opt, label: opt.slice(i + 1), code: opt.slice(0, i) };
};
const SALES_STORE_COMBO_OPTIONS = SALES_STORE_OPTIONS.map(toStoreComboOption);
const PRIMARY_STORE_COMBO_OPTIONS =
  PRIMARY_STORE_OPTIONS.map(toStoreComboOption);
const TERTIARY_STORE_COMBO_OPTIONS =
  TERTIARY_STORE_OPTIONS.map(toStoreComboOption);
const COST_BEARING_DEPT_COMBO_OPTIONS =
  COST_BEARING_DEPT_MASTER.map(toStoreComboOption);
const SALES_REP_OPTIONS = [
  BASIC_INFO_CREATOR, // 基本情報の営業担当者
  '5172734:サッポロ花子',
  '5172735:キリン一郎',
];
const SALES_REP_COMBO_OPTIONS = SALES_REP_OPTIONS.map(toStoreComboOption);

// 「他部門から分割/振替された経費」タブの初期データ（列構成は経費明細グリッドの列を流用する）。
const SPLIT_FROM_OTHER_INITIAL_DATA: ExpenseItemData[] = [
  {
    id: 'o1',
    expenseItem: 'オペ協力金',
    managementCategory: '69D:オペ協力金',
    managementCode: '10010:本社',
    amount: '40,000',
    taxCategory: '1:課税10%',
    measureCategory: '',
    measureCode: '',
    invoiceNumber: '',
    note1: '東日本支社より分割',
    note2: '',
  },
  {
    id: 'o2',
    expenseItem: 'その他一時費用',
    managementCategory: '69F:その他一時費用',
    managementCode: '10020:支社Ａ　自販機部門',
    amount: '18,000',
    taxCategory: '2:課税8%',
    measureCategory: '',
    measureCode: '',
    invoiceNumber: '',
    note1: '中部支社より分割',
    note2: '',
  },
];

// 分割グループ（分割元行＋その分割先行）へ行を追加する位置と、採番する ID を求める。
// 挿入位置＝グループ内の最下行の直後、ID＝「分割元ID-枝番」（既存の最大枝番の次）。
const splitGroupInsertInfo = (
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

// 行アクション（分割・コピー・削除）のアイコンをセルに直接並べるレンダラー。
// 分割先行は分割できないため、コピー・削除のみ表示する。
const RowMenuCellRenderer = (props: ICellRendererParams) => {
  if (!props.data) return null;
  const { showSplit, onSplitRow, onCopyRow, onDeleteRow } = props.context;

  return (
    <div className="flex h-full items-center justify-center gap-1">
      {/* 分割は経費明細グリッドの分割先以外の行のみ。
          ロケ契約料前払金グリッドでは表示しない（showSplit=false）。
          非表示の行でもコピー・削除アイコンの位置が揃うよう、同じ大きさの枠を確保する。 */}
      {showSplit &&
        (isSplitDestRow(props.data) ? (
          <span className="h-6 w-6 shrink-0" aria-hidden="true" />
        ) : (
          <button
            onClick={() => onSplitRow(props.data)}
            className="rounded p-1 text-blue-600 transition-colors hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            aria-label="分割"
            title="分割"
          >
            <Split className="w-4 h-4" />
          </button>
        ))}
      <button
        onClick={() => onCopyRow(props.data)}
        className="rounded p-1 text-green-600 transition-colors hover:bg-green-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        aria-label="コピー"
        title="コピー"
      >
        <Copy className="w-4 h-4" />
      </button>
      <button
        onClick={() => onDeleteRow(props.data)}
        className="rounded p-1 text-red-600 transition-colors hover:bg-red-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        aria-label="削除"
        title="削除"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

// 支払回数1回分のデータ（支払情報＋支払明細）。
// 支払回数プルダウンで回を切り替えると、この単位で保存／復元する。
interface PaymentRoundData {
  // 支払情報
  paymentDestination: string;
  note: string;
  status: string; // ステータス
  applicantOffice: string; // 申請事業場
  applicantDept: string; // 申請部署
  applicant: string; // 申請者
  applicationDate: string; // 申請日
  occurrenceDate: Date;
  occurrenceDateInput: string;
  accountingDateInput: string;
  paymentScheduleDate: Date;
  paymentScheduleDateInput: string;
  // 支払明細（経費項目一覧）
  expenseData: ExpenseItemData[];
  // ロケ契約料前払金（支払明細と切り替えて表示するグリッド）
  prepaymentData: ExpenseItemData[];
}

// 支払回数プルダウンの初期の選択肢（既存の回）。
const PAYMENT_ROUND_OPTIONS = ['1'];

// 明細行の複製。回の切替で表示する明細は必ずコピーを渡し、
// グリッド上の編集が保存内容（roundStore）へ及ばないようにする。
const copyRows = (rows: ExpenseItemData[]): ExpenseItemData[] =>
  rows.map((row) => ({ ...row }));

// 支払回数=1（初期表示）の内容。各 state の初期値と、回を戻したときの復元元に使う。
const INITIAL_ROUND: PaymentRoundData = {
  paymentDestination: '1001584:AAA営業本部商品部',
  note: '',
  status: '承認待ち',
  applicantOffice: BASIC_INFO_APPLICANT_OFFICE,
  applicantDept: BASIC_INFO_APPLICANT_DEPT,
  applicant: BASIC_INFO_CREATOR,
  applicationDate: BASIC_INFO_APPLICATION_DATE,
  occurrenceDate: new Date(2025, 4, 15),
  occurrenceDateInput: format(new Date(2025, 4, 15), 'yyyy/MM/dd'),
  accountingDateInput: format(new Date(2025, 5, 1), 'yyyy/MM'),
  paymentScheduleDate: new Date(2025, 6, 31),
  paymentScheduleDateInput: format(new Date(2025, 6, 31), 'yyyy/MM/dd'),
  expenseData: PAYMENT_DETAIL_INITIAL_DATA,
  prepaymentData: PREPAYMENT_INITIAL_DATA,
};

// 新規入力用の空の1回分データ（支払情報は空・明細は0件）。
const createEmptyRound = (): PaymentRoundData => ({
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

// セル背景は共通配色 GRID_COLORS に集約する（hex 直書きしない・→ 02 §10.1）。
const EDITABLE_CELL_BG = GRID_COLORS.editable; // 編集可：白
const NON_EDITABLE_CELL_BG = GRID_COLORS.readonly; // 編集不可：灰
const INHERITED_TEXT_COLOR = GRID_COLORS.inheritedText; // 親の値の参照表示：薄いグレー

// 分割先行のみ、指定フィールドを分割元（親：splitGroupId＝分割元 id の行）の値で表示する valueGetter。
// 通常行・分割元行は自身の値を返す。分割元の特定には共通 getRowId（id）で getRowNode を使う。
const mirrorParentField =
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

// 分割先行は入力不可（灰背景・薄いグレー文字＝親の参照値）、通常行は editableBase で表示する cellStyle。
const inheritOnDestCellStyle =
  (editableBase: string) =>
  (params: CellClassParams): CellStyle =>
    isSplitDestRow(params.data)
      ? {
          backgroundColor: NON_EDITABLE_CELL_BG,
          color: INHERITED_TEXT_COLOR,
        }
      : { backgroundColor: editableBase };

// 通常行のみ編集可・分割先行は編集不可とする editable コールバック。
const editableExceptDest = (params: {
  data?: { splitRole?: string };
}): boolean => !isSplitDestRow(params.data);

// 分割先行のみが持つ列で使う valueGetter（分割元・通常行は空）。
const destFieldValue =
  (field: keyof ExpenseItemData) =>
  (params: ValueGetterParams): string => {
    const d = params.data as ExpenseItemData | undefined;
    if (!d || d.splitRole !== 'dest') return '';
    return (d[field] as string | undefined) ?? '';
  };

// 分割先行は入力可（白）、それ以外は入力不可（灰）とする共通 cellStyle。
const destEditableCellStyle = (params: CellClassParams): CellStyle => ({
  backgroundColor: isSplitDestRow(params.data)
    ? EDITABLE_CELL_BG
    : NON_EDITABLE_CELL_BG,
});

// 管理区分・管理コード・施策区分/コード・摘要のように、分割元と分割先で同じ列を使い
// 保持先のフィールドだけを行の役割で切り替える列のための valueGetter／valueSetter。
// 分割先行は分割先固有フィールド（splitDest〜）、それ以外は本体フィールドを読み書きする。
const dualFieldValue =
  (ownField: keyof ExpenseItemData, destField: keyof ExpenseItemData) =>
  (params: ValueGetterParams): string => {
    const d = params.data as ExpenseItemData | undefined;
    if (!d) return '';
    const field = d.splitRole === 'dest' ? destField : ownField;
    return (d[field] as string | undefined) ?? '';
  };
const dualFieldSetter =
  (ownField: keyof ExpenseItemData, destField: keyof ExpenseItemData) =>
  (params: { data: ExpenseItemData; newValue: string }): boolean => {
    const field = params.data.splitRole === 'dest' ? destField : ownField;
    (params.data as Record<string, unknown>)[field] = params.newValue;
    return true;
  };

// 行が保持する管理区分・管理コード（分割先行は分割先固有フィールド）。
const rowManagementCategory = (d?: ExpenseItemData): string =>
  (d?.splitRole === 'dest'
    ? d?.splitDestMgmtCategory
    : d?.managementCategory) ?? '';
const rowManagementCodeField = (d: ExpenseItemData): keyof ExpenseItemData =>
  d.splitRole === 'dest' ? 'splitDestMgmtCode' : 'managementCode';

// 管理区分の valueSetter。管理コードは管理区分ごとに選択肢が決まっているため、
// 管理区分の変更に合わせて管理コードも次のとおり更新する。
//  ・選択肢が1件しかない管理区分 … 組み合わせが一意に決まるためその管理コードを自動補完する
//  ・上記以外 … 新しい管理区分で組み合わせが成立しなくなった管理コードをクリアする
const managementCategorySetter = (params: {
  data: ExpenseItemData;
  newValue: string;
}): boolean => {
  dualFieldSetter('managementCategory', 'splitDestMgmtCategory')(params);
  const codeField = rowManagementCodeField(params.data);
  const currentCode = (params.data[codeField] as string | undefined) ?? '';
  const codeOptions = managementCodeOptions(params.newValue);
  if (codeOptions.length === 1) {
    (params.data as Record<string, unknown>)[codeField] = codeOptions[0];
  } else if (
    currentCode &&
    !isValidManagementCode(params.newValue, currentCode)
  ) {
    (params.data as Record<string, unknown>)[codeField] = '';
  }
  return true;
};

// 管理コードは管理区分に紐づく組み合わせから選ぶため、管理区分が未選択の行では入力不可とする。
const managementCodeEditable = (params: { data?: ExpenseItemData }): boolean =>
  !!rowManagementCategory(params.data);

// 分割元・通常行の負担金額 ＝ 支払金額 − 紐づく分割先行の負担金額合計。
// 分割先へ振り分けた残り（自部門が負担する額）を表す。
const ownBurdenAmount = (params: ValueGetterParams): number => {
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

// 「他部門から分割/振替された経費明細」タブ専用の列
// （支払明細グリッドには無い分割/振替日・支払No・支払回数・事業場）。
// 当タブは参照専用のため読み取り専用・灰背景にする。表示順は SPLIT_SOURCE_INFO_COL_IDS で決まる。
const SPLIT_SOURCE_INFO_EXTRA_COLUMN_DEFS: ColDef[] = [
  {
    headerName: '分割/振替日',
    colId: 'splitSourceDate',
    field: 'splitSourceDate',
    editable: false,
    cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
  },
  {
    headerName: '支払No',
    colId: 'splitSourcePaymentNo',
    field: 'splitSourcePaymentNo',
    editable: false,
    cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
  },
  {
    headerName: '支払回数',
    colId: 'splitSourcePaymentRound',
    field: 'splitSourcePaymentRound',
    editable: false,
    cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
  },
  {
    headerName: '事業場',
    colId: 'splitSourceOffice',
    field: 'splitSourceOffice',
    editable: false,
    valueFormatter: (params) =>
      nameWithoutCode(params.value) || GRID_EMPTY_TEXT,
    cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
  },
];

// 指定の行を分割元とする分割先行がグリッド上に存在するか。
// 折り畳みで非表示の行も対象にするため、表示行ではなく全行（forEachNode）を見る。
const hasSplitDestRows = (
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

// No. 列のレンダラー。分割先行を持つ分割元行には開閉ボタンを添える。
const IdCellRenderer = (props: ICellRendererParams) => {
  const data = props.data as ExpenseItemData | undefined;
  const id = (props.value as string) ?? '';
  if (!data) return null;
  const { collapsedSplitGroups, onToggleSplitGroup } = (props.context ??
    {}) as {
    collapsedSplitGroups?: string[];
    onToggleSplitGroup?: (sourceId: string) => void;
  };
  const canToggle =
    !!onToggleSplitGroup &&
    data.splitRole === 'source' &&
    hasSplitDestRows(props.api, data.id);
  const isCollapsed = collapsedSplitGroups?.includes(data.id) ?? false;

  // 開閉ボタンの有無で ID の開始位置がずれないよう、ボタンの枠は全行で同じ幅を確保し、
  // 対象外の行は同じ大きさの空要素を置く。
  return (
    <div className="flex h-full items-center gap-1">
      {canToggle ? (
        <button
          type="button"
          onClick={() => onToggleSplitGroup(data.id)}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? '分割先を開く' : '分割先を閉じる'}
          title={isCollapsed ? '分割先を開く' : '分割先を閉じる'}
          className="shrink-0 transition-colors hover:text-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          {/* シェブロンの向き・大きさ・色は開閉カード（CollapsibleCard）と揃える。
              下向き＝閉じている／180度回転して上向き＝開いている。 */}
          <ChevronDown
            className={`h-5 w-5 text-gray-500 transition-transform ${
              isCollapsed ? '' : 'rotate-180'
            }`}
          />
        </button>
      ) : (
        <span className="h-5 w-5 shrink-0" aria-hidden="true" />
      )}
      <span>{id}</span>
    </div>
  );
};

// 一番左にデータのID（No.）を表示する列（行番号の代わり）。読み取り専用。
const ID_COLUMN_DEF: ColDef = {
  headerName: 'No.',
  field: 'id',
  lockPinned: true,
  editable: false,
  sortable: false,
  filter: false,
  resizable: false,
  // 分割元行では開閉ボタンとIDを横に並べるため、その分の幅を確保する。
  width: 96,
  minWidth: 80,
  suppressAutoSize: true,
  cellRenderer: IdCellRenderer,
  cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
};

// 償却情報グループ（前払金グリッド）の子列定義。編集セルは白・名称/コード列は検索付きセレクト。
const AMORTIZATION_INFO_COLUMN_DEFS: ColDef[] = [
  {
    headerName: '発生日(計上開始初月)',
    colId: 'amortAccrualDate',
    field: 'amortAccrualDate',
    editable: true,
    cellEditor: DateCellEditor,
    cellEditorPopup: true,
    cellStyle: { backgroundColor: EDITABLE_CELL_BG },
  },
  {
    headerName: '償却期間開始',
    colId: 'amortStartDate',
    field: 'amortStartDate',
    editable: true,
    cellEditor: DateCellEditor,
    cellEditorPopup: true,
    cellStyle: { backgroundColor: EDITABLE_CELL_BG },
  },
  {
    headerName: '償却期間終了',
    colId: 'amortEndDate',
    field: 'amortEndDate',
    editable: true,
    cellEditor: DateCellEditor,
    cellEditorPopup: true,
    cellStyle: { backgroundColor: EDITABLE_CELL_BG },
  },
  {
    headerName: 'CRMコード',
    colId: 'crmCode',
    field: 'crmCode',
    editable: true,
    cellEditor: 'agTextCellEditor',
    cellStyle: { backgroundColor: EDITABLE_CELL_BG },
  },
];

// 償却仕訳情報グループ（前払金グリッド）の子列定義。
// コード列・名称列は同じ field を共有し、どちらからでも同じ選択肢で入力できる（相互に連動）。
// 管理区分・管理区分名称のみ 604（ロケ契約料他前払い金(償却)）固定・入力不可。
const AMORTIZATION_JOURNAL_COLUMN_DEFS: ColDef[] = [
  {
    headerName: '管理区分',
    colId: 'amortMgmtCategoryCode',
    valueGetter: () =>
      splitCategoryCode(AMORTIZATION_FIXED_MANAGEMENT_CATEGORY),
    editable: false,
    cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
  },
  {
    headerName: '管理区分名称',
    colId: 'amortMgmtCategoryName',
    valueGetter: () =>
      splitCategoryName(AMORTIZATION_FIXED_MANAGEMENT_CATEGORY),
    editable: false,
    cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
  },
  {
    headerName: '管理コード',
    colId: 'amortMgmtCodeCode',
    field: 'amortMgmtCode',
    valueFormatter: (p) => splitCategoryCode(p.value) || GRID_EMPTY_TEXT,
    editable: true,
    cellEditor: ComboCellEditor,
    cellEditorParams: {
      comboOptions: AMORTIZATION_MANAGEMENT_CODE_COMBO_OPTIONS,
    },
    cellEditorPopup: true,
    suppressKeyboardEvent: suppressEditNavKeys,
    cellStyle: { backgroundColor: EDITABLE_CELL_BG },
  },
  {
    headerName: '管理コード名称',
    colId: 'amortMgmtCodeName',
    field: 'amortMgmtCode',
    valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
    editable: true,
    cellEditor: ComboCellEditor,
    cellEditorParams: {
      comboOptions: AMORTIZATION_MANAGEMENT_CODE_COMBO_OPTIONS,
    },
    cellEditorPopup: true,
    suppressKeyboardEvent: suppressEditNavKeys,
    cellStyle: { backgroundColor: EDITABLE_CELL_BG },
  },
  {
    headerName: '施策区分',
    colId: 'amortMeasureCategoryCode',
    field: 'amortMeasureCategory',
    valueFormatter: (p) => splitCategoryCode(p.value) || GRID_EMPTY_TEXT,
    editable: true,
    cellEditor: ComboCellEditor,
    cellEditorParams: {
      comboOptions: MEASURE_CATEGORY_COMBO_OPTIONS,
      clearable: true,
    },
    cellEditorPopup: true,
    suppressKeyboardEvent: suppressEditNavKeys,
    cellStyle: { backgroundColor: EDITABLE_CELL_BG },
  },
  {
    headerName: '施策区分名称',
    colId: 'amortMeasureCategoryName',
    field: 'amortMeasureCategory',
    valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
    editable: true,
    cellEditor: ComboCellEditor,
    cellEditorParams: {
      comboOptions: MEASURE_CATEGORY_COMBO_OPTIONS,
      clearable: true,
    },
    cellEditorPopup: true,
    suppressKeyboardEvent: suppressEditNavKeys,
    cellStyle: { backgroundColor: EDITABLE_CELL_BG },
  },
  {
    headerName: '施策コード',
    colId: 'amortMeasureCodeCode',
    field: 'amortMeasureCode',
    valueFormatter: (p) => splitCategoryCode(p.value) || GRID_EMPTY_TEXT,
    editable: true,
    cellEditor: ComboCellEditor,
    cellEditorParams: {
      comboOptions: MEASURE_CODE_COMBO_OPTIONS,
      clearable: true,
    },
    cellEditorPopup: true,
    suppressKeyboardEvent: suppressEditNavKeys,
    cellStyle: { backgroundColor: EDITABLE_CELL_BG },
  },
  {
    headerName: '施策コード名称',
    colId: 'amortMeasureCodeName',
    field: 'amortMeasureCode',
    valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
    editable: true,
    cellEditor: ComboCellEditor,
    cellEditorParams: {
      comboOptions: MEASURE_CODE_COMBO_OPTIONS,
      clearable: true,
    },
    cellEditorPopup: true,
    suppressKeyboardEvent: suppressEditNavKeys,
    cellStyle: { backgroundColor: EDITABLE_CELL_BG },
  },
];

export default function PaymentDetailVending({
  onMenuChange,
}: PaymentDetailVendingProps) {
  // ===== 支払回数（支払回）の状態 =====
  // 回ごとの保存内容（回番号→1回分データ）。表示中の回の値は個別 state 側が持ち、
  // 入力中の編集はここへ退避しない（回の切替で破棄されるため。
  // → 20260804_第26回 決定事項23・24）。
  const roundStore = useRef<Record<string, PaymentRoundData>>({
    '1': INITIAL_ROUND,
  });

  // 切替・追加の挙動は支払詳細(商流販売店紐づけなし)と共通のフックで扱う。
  const rounds = usePaymentRounds({
    initialOptions: PAYMENT_ROUND_OPTIONS,
    // 追加した回は空の支払情報・明細から始める。
    // 引用で追加した回は、直後に引用元の内容で上書きする（handleApplyQuoteSource）。
    onRoundAdded: (round) => {
      roundStore.current[round] = createEmptyRound();
    },
  });
  // 現在表示している支払回（"1" 起点）。
  const invoiceCount = rounds.round;

  // ===== 支払情報の状態 =====
  const [paymentDestination, setPaymentDestination] = useState(
    INITIAL_ROUND.paymentDestination
  );
  const [note, setNote] = useState(INITIAL_ROUND.note);
  // ステータス・申請組織・申請者・申請日は支払回ごとに異なるため、回単位で保持する。
  const [status, setStatus] = useState(INITIAL_ROUND.status);
  const [applicantOffice, setApplicantOffice] = useState(
    INITIAL_ROUND.applicantOffice
  );
  const [applicantDept, setApplicantDept] = useState(
    INITIAL_ROUND.applicantDept
  );
  const [applicant, setApplicant] = useState(INITIAL_ROUND.applicant);
  const [applicationDate, setApplicationDate] = useState(
    INITIAL_ROUND.applicationDate
  );

  // コメント履歴（右ペイン）の開閉とコメント入力（差戻し理由など）。
  // 履歴の内容は共通の CommentHistoryPane が持つ（→ 支払詳細の各画面で共通）。
  const [commentPanelOpen, setCommentPanelOpen] = useState(false);
  const [commentInput, setCommentInput] = useState('');

  // ===== 支払根拠資料ペイン（根拠資料表示・登録の統合ペイン） =====
  // 開閉と、開いたときに表示するタブ。折り畳み中（付箋）にボタンを押した場合も
  // 展開し直す必要があるため、open が true のままでも nonce を進めてペインへ伝える。
  const [evidencePaneOpen, setEvidencePaneOpen] = useState(false);
  const [evidencePaneNonce, setEvidencePaneNonce] = useState(0);
  const [evidencePaneDefaultTab, setEvidencePaneDefaultTab] =
    useState<EvidenceTab>('表示');
  // 根拠資料の実体（支払回数ごと）。
  // 登録・編集・削除の結果を保つため、定数ではなく状態として持つ。
  // 請求書の未着・回収予定日は支払回単位ではなく資料（EvidenceFile）単位で持つ（2026-09-08 回答A-6）。
  const [evidenceFilesByRound, setEvidenceFilesByRound] = useState(
    INITIAL_EVIDENCE_FILES_BY_ROUND
  );

  // ===== 日付入力（カレンダー選択とテキスト入力を併用するため Date と文字列を対で保持） =====
  // 支払予定日
  const [paymentScheduleDate, setPaymentScheduleDate] = useState<Date>(
    INITIAL_ROUND.paymentScheduleDate
  );
  const [paymentScheduleDateInput, setPaymentScheduleDateInput] = useState(
    INITIAL_ROUND.paymentScheduleDateInput
  );
  const [isPaymentDateOpen, setIsPaymentDateOpen] = useState(false);

  // 発生日
  const [occurrenceDate, setOccurrenceDate] = useState<Date>(
    INITIAL_ROUND.occurrenceDate
  );
  const [occurrenceDateInput, setOccurrenceDateInput] = useState(
    INITIAL_ROUND.occurrenceDateInput
  );
  const [isOccurrenceDateOpen, setIsOccurrenceDateOpen] = useState(false);

  // 計上月
  const [accountingDateInput, setAccountingDateInput] = useState(
    INITIAL_ROUND.accountingDateInput
  );

  // ===== ダイアログ・カードの開閉状態 =====
  // 画面遷移の確認ダイアログの遷移先（null＝非表示）。
  const [pendingNavigation, setPendingNavigation] =
    useState<NavigationTarget | null>(null);
  // 支払無し（当月は支払が発生しない伝票）。支払一覧と同じく未申請との間を
  // 行き来する。理由は備考欄へ書く（→ 20260724_第23回_共通 決定事項8）。
  const [isNoPayment, setIsNoPayment] = useState(false);
  // 戻る確認
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null); // 申請/承認等の確認

  // 引用元選択ペイン（下ペイン）の開閉と入力値。「支払情報引用」ボタンで開く。
  const [isQuoteSourcePaneOpen, setIsQuoteSourcePaneOpen] = useState(false);
  const [quoteSourceRound, setQuoteSourceRound] = useState(
    QUOTE_SOURCE_ROUND_OPTIONS[0]
  );
  // 選択中の支払回数に対応する引用元（表示・引用の双方で参照する）。
  const quoteSource =
    QUOTE_SOURCE_BY_ROUND[quoteSourceRound] ?? QUOTE_SOURCE_BY_ROUND['1'];

  // 各カードの折り畳み状態（いずれも既定は展開）
  const [isHeaderOpen, setIsHeaderOpen] = useState(true);
  const [isSummaryOpen, setIsSummaryOpen] = useState(true);
  const [isPaymentSanctionOpen, setIsPaymentSanctionOpen] = useState(true);
  const [isPaymentDetailOpen, setIsPaymentDetailOpen] = useState(true);

  // 支払情報サマリカード内の表示切替（トグル）。
  // 'summary'＝管理項目別合計値グリッド／'split-from-other'＝他部門から分割/振替された経費明細
  const [summaryView, setSummaryView] = useState<
    'summary' | 'split-from-other'
  >('summary');

  // 管理項目別合計値グリッドの金額単位（円／千円）。金額列のみ千円換算する。
  // 金額の桁が大きいため既定は千円（支払詳細(追加口請求書有)の支払情報サマリと同じ）。
  const [summaryAmountUnit, setSummaryAmountUnit] = useState<
    'yen' | 'thousand'
  >('thousand');
  const summaryUnitLabel = summaryAmountUnit === 'thousand' ? '千円' : '円';

  // 金額単位を切り替えても列の並び・幅をリセットしないため、列ヘッダーの単位表記は
  // headerName を作り直さず headerValueGetter（参照固定）で差し込む。
  // headerName を変えると columnDefs ごと差し替わり、AG Grid が列定義を適用し直す際に
  // 列の並びと明示幅（集計対象の勘定科目）が既定へ戻ってしまうため（→ 02 §7.1）。
  // 実際の描き直しは単位切替時の refreshHeader()（公式API）で行う。
  const summaryUnitLabelRef = useRef(summaryUnitLabel);
  const summaryGridRef = useRef<AgGridReact>(null);
  useEffect(() => {
    summaryUnitLabelRef.current = summaryUnitLabel;
    summaryGridRef.current?.api?.refreshHeader();
  }, [summaryUnitLabel]);

  // 金額列のヘッダー定義（「項目名 (円/千円)」）。参照を固定するため useCallback で保持する。
  const amountHeaderColDef = useCallback(
    (name: string): Pick<ColDef, 'headerName' | 'headerValueGetter'> => ({
      headerName: name,
      headerValueGetter: () => `${name} (${summaryUnitLabelRef.current})`,
    }),
    []
  );

  // 支払情報サマリカード本体（タブ内グリッド）の高さ（px）。
  const summaryResize = useResizableHeight({
    defaultHeight: SUMMARY_CARD_DEFAULT_HEIGHT,
    minHeight: SUMMARY_CARD_MIN_HEIGHT,
  });

  // 支払明細情報カード本体（明細グリッド）の高さ（px）。初期値のみ画面高から算出する。
  const detailResize = useResizableHeight({
    defaultHeight: initialDetailCardHeight(),
    minHeight: DETAIL_CARD_MIN_HEIGHT,
    maxHeight: DETAIL_CARD_MAX_HEIGHT,
  });

  // 支払明細情報カードのグリッド表示切替（青枠ボタン群）。
  // 'payment'＝経費明細グリッド／'prepayment'＝ロケ契約料前払金グリッド。
  const [detailGridView, setDetailGridView] = useState<
    'payment' | 'prepayment'
  >('payment');

  const handlePaymentDateSelect = (date: Date | undefined) => {
    if (date) {
      setPaymentScheduleDate(date);
      setPaymentScheduleDateInput(format(date, 'yyyy/MM/dd', { locale: ja }));
      setIsPaymentDateOpen(false);
    }
  };

  // テキスト直接入力の反映（日付として解釈できたときのみ Date 側を更新する）。
  const handlePaymentDateInputChange = (value: string) => {
    setPaymentScheduleDateInput(value);
    const parsed = parseDateString(value);
    if (parsed) setPaymentScheduleDate(parsed);
  };

  const handleOccurrenceDateSelect = (date: Date | undefined) => {
    if (date) {
      setOccurrenceDate(date);
      setOccurrenceDateInput(format(date, 'yyyy/MM/dd', { locale: ja }));
      setIsOccurrenceDateOpen(false);
    }
  };

  const handleOccurrenceDateInputChange = (value: string) => {
    setOccurrenceDateInput(value);
    const parsed = parseDateString(value);
    if (parsed) setOccurrenceDate(parsed);
  };

  // 計上月（年月 YYYY/MM）を選択したときに、表示用の文字列を更新する。
  const handleAccountingMonthChange = (value: string) => {
    setAccountingDateInput(value);
  };

  // ===== フッター操作（保存・戻る・申請/承認等） =====

  const handleSave = () => {
    // TODO: 支払データの保存処理（API連携・未実装）
    // 保存確定で編集セルの変更ハイライトをクリアする（両グリッド分／→ 02 §7.2）
    paymentChangedCells.resetChangedCells();
    prepaymentChangedCells.resetChangedCells();
    gridRef.current?.api?.refreshCells({ force: true });
    toast.success('保存が完了しました。');
  };

  // 画面遷移の確定 → 編集中の内容を破棄して対象画面へ遷移する。
  const handleNavigationConfirm = () => {
    if (!pendingNavigation) return;
    const { menuId } = NAVIGATION_CONFIRM_MAP[pendingNavigation];
    setPendingNavigation(null);
    if (onMenuChange) {
      onMenuChange(menuId);
    }
  };

  // 販売計画書No の押下 → 破棄確認のうえ計画詳細(自販機)画面へ遷移する。
  const handleSalesPlanNoClick = () => {
    setPendingNavigation('planDetail');
  };

  // 支払確認ダイアログの確定
  const handleConfirmAction = () => {
    if (!confirmAction) return;
    const { toast: toastMessage } = CONFIRM_MESSAGE_MAP[confirmAction];
    // TODO: 支払データの承認/差戻し処理（API連携・未実装）
    toast.success(toastMessage);
    setConfirmAction(null);
  };

  // ヘッダー項目（テキストラベル）の共通描画。
  // 値は "コード:名称" の並びでそのまま表示する（支払系画面で表記を統一）。
  // 値はアイコン等も置けるよう ReactNode で受ける。
  const renderLabelField = (label: string, value: ReactNode) => (
    <div className="flex items-center gap-2">
      <label
        className={`${FORM_LABEL_CLASS} whitespace-nowrap w-36 text-right`}
      >
        {label}
      </label>
      <span className="h-8 flex items-center text-sm text-gray-900">
        {value}
      </span>
    </div>
  );

  // ===== 支払明細情報（経費明細／ロケ契約料前払金の2グリッド） =====
  // 2つのグリッドはトグルで切り替え、データは独立して保持する。
  // 初期値は保存内容（INITIAL_ROUND）のコピーとする。グリッドの編集は行オブジェクトへ
  // 直接反映されるため、コピーを渡して回の保存内容へ編集が及ばないようにする。
  const [expenseData, setExpenseData] = useState<ExpenseItemData[]>(() =>
    copyRows(INITIAL_ROUND.expenseData)
  );
  const [prepaymentData, setPrepaymentData] = useState<ExpenseItemData[]>(() =>
    copyRows(INITIAL_ROUND.prepaymentData)
  );

  // 現在表示中グリッドのデータと更新関数。明細の追加・分割・コピー・削除・インライン編集は
  // 表示中グリッドのみに反映する。
  const activeDetailData =
    detailGridView === 'payment' ? expenseData : prepaymentData;
  const setActiveDetailData =
    detailGridView === 'payment' ? setExpenseData : setPrepaymentData;

  const gridRef = useRef<AgGridReact>(null);

  // コピー・追加で増えた行を見つけやすくする（行全体をフラッシュし可視域へ送る）。
  // 追加処理が親側にあり markRows を差し込めないため、行数の増加から自動検出する。
  const reveal = useRevealNewRows({ autoDetect: true });

  // 行ID（AG Grid 公式 getRowId）。全グリッドで共用し、参照を固定する（→ 02 §7.1）。
  const getRowId = useCallback((params: GetRowIdParams) => params.data.id, []);

  // 編集セルの変更ハイライト（黄）の共通フック（→ 02 §7.2）。
  // 行ID・列IDが重複しうるため変更セットはグリッド単位で分けて保持する
  // （共用すると一方の変更が他方の同じ行・列にも黄で表示されてしまう）。
  const paymentChangedCells = useChangedCells();
  const prepaymentChangedCells = useChangedCells();
  // 変更ハイライトのクリア（支払回数の切替時に呼ぶ）。参照が安定した関数だけを取り出す。
  const { resetChangedCells: resetPaymentChangedCells } = paymentChangedCells;
  const { resetChangedCells: resetPrepaymentChangedCells } =
    prepaymentChangedCells;

  const detailChangedCells =
    detailGridView === 'payment' ? paymentChangedCells : prepaymentChangedCells;

  // ===== Undo/Redo を効かせるための rowData 参照安定化（→ 02 §7.1） =====
  // AG Grid は rowData の参照が変わると Undo履歴をクリアするため、セル編集では参照を変えず、
  // 行構造（表示グリッド・支払回・行IDの並び）が変わったときだけ再生成する。
  // セル値は AG Grid がノードの data を直接更新し、state への永続化は onCellValueChanged が担う。
  const detailRowStructureSignature = useMemo(
    () =>
      `${detailGridView}#${invoiceCount}#${activeDetailData.map((row) => row.id).join(',')}`,
    [detailGridView, invoiceCount, activeDetailData]
  );
  const detailRowData = useMemo(
    () => activeDetailData,
    // activeDetailData は本文で参照するが依存には含めない（値編集で参照を変えないため）。
    // 構造変化時は最新の activeDetailData が渡る。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [detailRowStructureSignature]
  );

  // ===== 分割グループの折り畳み =====
  // 折り畳み中の分割元行の id。分割先行の表示/非表示は AG Grid 公式の外部フィルターで
  // 切り替える（行データは変えないため、Undo履歴や負担金額の集計に影響しない）。
  const [collapsedSplitGroups, setCollapsedSplitGroups] = useState<string[]>(
    []
  );

  const handleToggleSplitGroup = useCallback((sourceId: string) => {
    setCollapsedSplitGroups((prev) =>
      prev.includes(sourceId)
        ? prev.filter((id) => id !== sourceId)
        : [...prev, sourceId]
    );
  }, []);

  // 指定グループの折り畳みを解除する（分割先を追加したとき、追加行が隠れないようにする）。
  const expandSplitGroup = useCallback((sourceId: string) => {
    setCollapsedSplitGroups((prev) =>
      prev.includes(sourceId) ? prev.filter((id) => id !== sourceId) : prev
    );
  }, []);

  // 明細の増減に追従して折り畳み状態を整理する。分割先が1件も無くなったグループは
  // 対象から外し、同じ行を分割し直したときに閉じたままにならないようにする。
  useEffect(() => {
    setCollapsedSplitGroups((prev) => {
      const next = prev.filter((groupId) =>
        activeDetailData.some(
          (item) => item.splitRole === 'dest' && item.splitGroupId === groupId
        )
      );
      return next.length === prev.length ? prev : next;
    });
  }, [activeDetailData]);

  const isExternalFilterPresent = useCallback(
    () => collapsedSplitGroups.length > 0,
    [collapsedSplitGroups]
  );

  // 折り畳み中のグループに属する分割先行だけを非表示にする。
  const doesExternalFilterPass = useCallback(
    (node: IRowNode) => {
      const data = node.data as ExpenseItemData | undefined;
      if (data?.splitRole !== 'dest' || !data.splitGroupId) return true;
      return !collapsedSplitGroups.includes(data.splitGroupId);
    },
    [collapsedSplitGroups]
  );

  // 折り畳み状態が変わったら、フィルターの再評価と開閉ボタンの再描画を行う。
  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    api.onFilterChanged();
    api.refreshCells({ force: true });
  }, [collapsedSplitGroups]);

  // 分割行の追加・削除で開閉ボタンの有無が変わる。No. 列はセルの値（ID）が変わらず
  // 自動では再描画されないため、明細の増減に合わせて明示的に再描画する。
  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    api.refreshCells({ columns: ['id'], force: true });
  }, [activeDetailData]);

  // 明細削除の確認ダイアログ
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseItemData | null>(
    null
  );

  // 削除対象に紐づく分割先行が実際に存在するか。確認・完了メッセージの出し分けに使う。
  // 行の splitRole ではなく現在の明細から判定するため、分割先を全件削除したあとに
  // 分割元行を削除しても「分割先も削除」とは表示しない。
  const deleteTargetHasDestRows = useMemo(
    () =>
      !!deleteTarget &&
      !isSplitDestRow(deleteTarget) &&
      activeDetailData.some(
        (item) =>
          item.splitRole === 'dest' && item.splitGroupId === deleteTarget.id
      ),
    [deleteTarget, activeDetailData]
  );

  // ===== 明細の行操作（追加・コピー・削除・分割） =====

  // 表示中グリッドの最大IDの次を新規IDとして採番する。
  const generateId = useCallback(
    () =>
      (
        activeDetailData.reduce(
          (max, item) => Math.max(max, Number(item.id) || 0),
          0
        ) + 1
      ).toString(),
    [activeDetailData]
  );

  // 新規行の初期値（税区分は課税10%・費用負担部署は自部門・
  // 販売店・三次店・一次店・営業担当者は基本情報の値を既定とする）。
  const createEmptyForm = useCallback(
    (): Partial<ExpenseItemData> => ({
      expenseItem: '',
      managementCategory: '',
      managementCode: '',
      amount: '',
      taxCategory: '1:課税10%',
      measureCategory: '',
      measureCode: '',
      invoiceNumber: '',
      note1: '',
      note2: '',
      costBearingDept: OWN_COST_BEARING_DEPT,
      splitDestName: BASIC_INFO_SALES_STORE,
      splitTertiaryStore: BASIC_INFO_TERTIARY_STORE,
      splitPrimaryStore: BASIC_INFO_PRIMARY_STORE,
      splitDestManager: BASIC_INFO_CREATOR,
    }),
    []
  );

  // ===== 支払回数の切替（回ごとに支払情報＋明細を保持） =====

  // 1回分データを各 state へ反映して画面に表示する。
  // 明細はコピーを渡し、グリッド上の編集が回の保存内容へ及ばないようにする。
  // 表示する内容が入れ替わるため、編集セルの変更ハイライトはクリアする（→ 02 §7.2）。
  const applyRound = useCallback(
    (data: PaymentRoundData) => {
      setPaymentDestination(data.paymentDestination);
      setNote(data.note);
      setStatus(data.status);
      setApplicantOffice(data.applicantOffice);
      setApplicantDept(data.applicantDept);
      setApplicant(data.applicant);
      setApplicationDate(data.applicationDate);
      setOccurrenceDate(data.occurrenceDate);
      setOccurrenceDateInput(data.occurrenceDateInput);
      setAccountingDateInput(data.accountingDateInput);
      setPaymentScheduleDate(data.paymentScheduleDate);
      setPaymentScheduleDateInput(data.paymentScheduleDateInput);
      setExpenseData(copyRows(data.expenseData));
      setPrepaymentData(copyRows(data.prepaymentData));
      resetPaymentChangedCells();
      resetPrepaymentChangedCells();
    },
    [resetPaymentChangedCells, resetPrepaymentChangedCells]
  );

  // 確認ダイアログの「はい」：入力中の内容は破棄し、対象の回を表示する。
  // 表示するのは対象回の保存内容（「＋支払回数追加」で追加した回は空の入力画面）。
  const handleConfirmRound = useCallback(() => {
    const target = rounds.pending;
    if (!target) return;
    // 追加の場合はここで回が選択肢へ加わり、onRoundAdded が空の回を保存内容へ登録する。
    rounds.confirmPending();
    applyRound(roundStore.current[target.count] ?? createEmptyRound());
  }, [rounds, applyRound]);

  // 明細追加ボタン：表示中グリッドの最上部に空行を追加する（グリッド上で直接入力する。画面設計標準 4.4）。
  const handleAddClick = useCallback(() => {
    const newItem: ExpenseItemData = {
      ...createEmptyForm(),
      id: generateId(),
    } as ExpenseItemData;
    setActiveDetailData((prev) => [newItem, ...prev]);
    toast.success('明細を追加しました。');
  }, [createEmptyForm, generateId, setActiveDetailData]);

  // ===== 支払根拠資料 =====
  // 根拠資料の編集可否・案内文の判定に使うステータス。支払情報カードの「ステータス」と
  // 同じ状態から取る（表示のズレ防止）。PaymentStatus に無い値の場合も、
  // ペイン側で「編集不可＋ステータス名入りの案内」として扱われる。
  const evidenceStatus = status as PaymentStatus;

  // 根拠資料格納ボタン：支払根拠資料ペインを「根拠資料表示」タブで開く（登録はペイン内のタブで切替）。
  // 根拠資料は支払回数ごとに持つため、表示・登録の対象は現在表示中の回（invoiceCount）。
  // 折り畳み中（付箋の状態）に押した場合も展開するよう、nonce を進めて「開き直し」を伝える。
  const handleStoreEvidence = useCallback(() => {
    setEvidencePaneDefaultTab('表示');
    setEvidencePaneOpen(true);
    setEvidencePaneNonce((n) => n + 1);
  }, []);

  // 現在表示中の回の根拠資料だけを差し替える共通処理。
  // 登録・編集・削除のいずれもこの回のぶんだけを対象にする。
  const updateEvidenceOfRound = useCallback(
    (updater: (prev: EvidenceFile[]) => EvidenceFile[]) =>
      setEvidenceFilesByRound((prev) => ({
        ...prev,
        [invoiceCount]: updater(prev[invoiceCount] ?? []),
      })),
    [invoiceCount]
  );

  // 根拠資料の登録。登録タブで登録した資料をこの回の一覧へ足す。
  // NO. は登録した順に続けて振る。登録直後はタイムスタンプ「待ち」で入り、
  // 表示タブを開くと30秒間隔（モックは5秒）で順に付与されていく。
  const handleRegisterEvidence = useCallback(
    (registered: RegisteredEvidence[]) => {
      const today = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const stamp = `${today.getFullYear()}/${pad(today.getMonth() + 1)}/${pad(today.getDate())}`;
      updateEvidenceOfRound((prev) => [
        ...prev,
        ...registered.map((r, i) => ({
          id: `e-new-${Date.now()}-${i}`,
          no: prev.length + i + 1,
          kind: r.kind,
          fileName: r.fileName,
          updatedAt: stamp,
          memo: r.memo || undefined,
          // D1: プレビュー（変換後PDF）とDL（原本）は登録タブから引き継ぐ
          originalUrl: r.originalUrl,
          pdfPreviewUrl: r.pdfPreviewUrl,
          convertStatus: r.convertStatus,
          receiptFormat: r.receiptFormat,
          issueDate: r.issueDate,
          // 未着（代替資料）と回収予定日は資料単位で持つ（修正指示1・2、回答A-6）
          notReceived: r.notReceived,
          collectionDate: r.collectionDate,
          // 検印済のステータスで足した資料は「検印後」として記録する（要件）。
          // APM が検印後に登録した請求書がこれに当たる。
          afterSeal: evidenceStatus === '検印済',
          timestampStatus: '待ち' as const,
        })),
      ]);
      toast.success('根拠資料を登録しました。');
    },
    [updateEvidenceOfRound, evidenceStatus]
  );

  // 備考・受領形態・発行日・回収予定日の変更。タイムスタンプはファイルの中身（ハッシュ値）に付くため、
  // これらメタ情報の変更は改ざんに当たらず、登録後もいつでもできる。
  // 登録日（updatedAt）は登録した日のままにする（メタ情報を直しても登録日は動かさない）。
  const handleUpdateEvidence = useCallback(
    (
      id: string,
      patch: {
        fileName?: string;
        memo?: string;
        receiptFormat?: ReceiptFormat;
        issueDate?: string;
        collectionDate?: string;
      }
    ) =>
      updateEvidenceOfRound((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...patch } : f))
      ),
    [updateEvidenceOfRound]
  );

  // 根拠資料の削除（未申請・差戻し時のみ）。消した後は NO. を振り直して欠番を作らない。
  const handleDeleteEvidence = useCallback(
    (id: string) =>
      updateEvidenceOfRound((prev) =>
        prev.filter((f) => f.id !== id).map((f, i) => ({ ...f, no: i + 1 }))
      ),
    [updateEvidenceOfRound]
  );

  // タイムスタンプが1件付与されたときの記録。
  // 付与は30秒間隔（モックは5秒）で順に進むため、済んだものからここへ残していく。
  const handleEvidenceTimestamped = useCallback(
    (id: string, timestampedAt: string) =>
      updateEvidenceOfRound((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, timestampStatus: '付与済' as const, timestampedAt }
            : f
        )
      ),
    [updateEvidenceOfRound]
  );

  // 支払情報引用ボタン：引用元を選ぶ下ペインを開く。
  const handleQuotePaymentInfo = useCallback(() => {
    setIsQuoteSourcePaneOpen(true);
  }, []);

  // 引用元選択ペインの「引用」押下：引用元の支払情報・支払明細を、
  // 支払回数の最大値＋1の回として追加し、その回を表示する。
  // 新しい回のため、ステータスは未申請・発生日と申請組織/申請者/申請日はブランクで開始する。
  const handleApplyQuoteSource = useCallback(() => {
    // 引用は確認を挟まずに回を追加する（追加した回は空で登録されるため、直後に上書きする）。
    const nextRound = rounds.addRoundNow();
    const quotedRound: PaymentRoundData = {
      paymentDestination: quoteSource.destination,
      note: quoteSource.note,
      status: '未申請',
      applicantOffice: '',
      applicantDept: '',
      applicant: '',
      applicationDate: '',
      // 発生日はブランク（Date 側は未入力扱いのため現在日時を置く）
      occurrenceDate: new Date(),
      occurrenceDateInput: '',
      accountingDateInput: QUOTED_ACCOUNTING_MONTH,
      paymentScheduleDate:
        parseDateString(QUOTED_PAYMENT_SCHEDULE_DATE) ?? new Date(),
      paymentScheduleDateInput: QUOTED_PAYMENT_SCHEDULE_DATE,
      // 経費明細は引用元の内容をコピーする（以降の編集が引用元へ影響しないよう複製する）。
      // ロケ契約料前払金は引用対象外のため0件で開始する。
      expenseData: quoteSource.expenseData.map((row) => ({ ...row })),
      prepaymentData: [],
    };
    roundStore.current[nextRound] = quotedRound;
    applyRound(quotedRound);
    setIsQuoteSourcePaneOpen(false);
    toast.success('支払情報を引用しました。');
  }, [rounds, applyRound, quoteSource]);

  // 明細コピー（行アクション）：対象行を複製して追加する。
  // ・分割先行 … 同じ分割グループの最下行へ追加し、分割先のままにする。
  // ・それ以外 … 最下行へ追加し、分割関連（役割・グループ）をクリアして独立した行にする。
  // ※ ID は更新関数内の最新 prev から採番する（古いクロージャでも ID が重複しないようにする。
  //    重複すると getRowId により新規行として追加されない）。
  const handleCopyRow = useCallback(
    (row: ExpenseItemData) => {
      setActiveDetailData((prev) => {
        if (isSplitDestRow(row) && row.splitGroupId) {
          const { insertIndex, nextId } = splitGroupInsertInfo(
            prev,
            row.splitGroupId
          );
          const next = [...prev];
          next.splice(insertIndex, 0, { ...row, id: nextId });
          return next;
        }
        const nextId = (
          prev.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1
        ).toString();
        const newItem: ExpenseItemData = {
          ...row,
          id: nextId,
          splitRole: undefined,
          splitGroupId: undefined,
        };
        return [...prev, newItem];
      });
      // 分割先行のコピーは、折り畳み中でも追加行が見えるよう対象グループを開く。
      if (isSplitDestRow(row) && row.splitGroupId) {
        expandSplitGroup(row.splitGroupId);
      }
      toast.success('明細をコピーしました。');
    },
    [setActiveDetailData, expandSplitGroup]
  );

  // 分割ボタン（行アクション）：押した行を分割元とし、分割先行を1件追加する。
  const handleSplitRow = useCallback(
    (row: ExpenseItemData) => {
      setActiveDetailData((prev) => {
        // 分割元行を「分割済」にする。
        const withSource = prev.map((item) =>
          item.id === row.id
            ? ({
                ...item,
                splitRole: 'source' as const,
                splitGroupId: row.id,
              } as ExpenseItemData)
            : item
        );
        const { insertIndex, nextId } = splitGroupInsertInfo(
          withSource,
          row.id
        );
        const newRow: ExpenseItemData = {
          ...row,
          id: nextId,
          splitRole: 'dest',
          splitGroupId: row.id,
          // 支払金額・請求書番号・分割案内はブランク、負担金額は 0 で開始する。
          amount: '',
          invoiceNumber: '',
          splitDestGuide: '',
          splitAmount: '0',
          // 分割先行が別枠で保持する項目へ、分割元行の値を引き継ぐ。
          splitDestDept: row.costBearingDept ?? OWN_COST_BEARING_DEPT,
          splitDestMgmtCategory: row.managementCategory,
          splitDestMgmtCode: row.managementCode,
          splitDestMeasureCategory: row.measureCategory,
          splitDestMeasureCode: row.measureCode,
          splitDestNote1: row.note1,
          splitDestNote2: row.note2,
        };
        // 同じ分割グループの最下行の直後へ挿入する。
        const next = [...withSource];
        next.splice(insertIndex, 0, newRow);
        return next;
      });
      // 折り畳み中に追加すると追加行が隠れてしまうため、対象グループを開く。
      expandSplitGroup(row.id);
      toast.success('分割行を追加しました。');
    },
    [setActiveDetailData, expandSplitGroup]
  );

  // 明細削除（行アクション）：確認ダイアログを開く。
  const handleDeleteRow = useCallback((row: ExpenseItemData) => {
    setDeleteTarget(row);
    setIsDeleteDialogOpen(true);
  }, []);

  // 削除の確定
  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    // 分割元行の削除は、紐づく分割先行（分割グループ）もまとめて取り除く。
    const deletesGroup = !isSplitDestRow(deleteTarget);
    setActiveDetailData((prev) => {
      const remaining = prev.filter((item) =>
        deletesGroup
          ? item.id !== deleteTarget.id &&
            !(
              item.splitRole === 'dest' && item.splitGroupId === deleteTarget.id
            )
          : item.id !== deleteTarget.id
      );
      // 分割先行を削除して同じグループの分割先が0件になったら、分割元行を通常行へ戻す。
      const groupId = deleteTarget.splitGroupId;
      if (deletesGroup || !groupId) return remaining;
      const hasDest = remaining.some(
        (item) => item.splitRole === 'dest' && item.splitGroupId === groupId
      );
      if (hasDest) return remaining;
      return remaining.map((item) =>
        item.id === groupId
          ? ({
              ...item,
              splitRole: undefined,
              splitGroupId: undefined,
            } as ExpenseItemData)
          : item
      );
    });
    setIsDeleteDialogOpen(false);
    setDeleteTarget(null);
    toast.success(
      deleteTargetHasDestRows
        ? '明細と分割先を削除しました。'
        : '明細を削除しました。'
    );
  }, [deleteTarget, deleteTargetHasDestRows, setActiveDetailData]);

  // インライン編集で変更されたセルを明細データに反映する
  // （管理項目別合計値・合計金額サマリーバーは明細データから再計算されるため state を更新する）
  const handleCellValueChanged = useCallback(
    (params: CellValueChangedEvent) => {
      // 変更セルの黄ハイライトを追跡して再描画する（→ 02 §7.2）。
      // 分割元行の負担金額は分割先行の負担金額から算出するため、変更行だけでなく
      // グリッド全体を再描画して依存するセルにも反映する。
      detailChangedCells.trackCellChange(params);
      params.api.refreshCells({ force: true });
      setActiveDetailData((prev) =>
        prev.map((item) =>
          item.id === params.data.id
            ? ({ ...item, ...params.data } as ExpenseItemData)
            : item
        )
      );
    },
    [setActiveDetailData, detailChangedCells]
  );

  // ソート後、分割先行を必ず分割元行の直下へ並べ替えて「セット」を維持する（AG Grid公式 postSortRows）。
  // どの列でソートしても分割元と分割先がまとまって移動する。
  const handlePostSortRows = useCallback((params: PostSortRowsParams) => {
    const nodes = params.nodes;
    // 分割元 id ごとに分割先ノードをまとめる
    const destByGroup = new Map<string, IRowNode[]>();
    nodes.forEach((node) => {
      const data = node.data as ExpenseItemData | undefined;
      if (data?.splitRole === 'dest' && data.splitGroupId) {
        const list = destByGroup.get(data.splitGroupId) ?? [];
        list.push(node);
        destByGroup.set(data.splitGroupId, list);
      }
    });
    if (destByGroup.size === 0) return;
    // 分割先以外をソート順のまま並べ、各行の直後にその行を分割元とする分割先を挿入する
    const reordered: IRowNode[] = [];
    nodes.forEach((node) => {
      if (node.data?.splitRole === 'dest') return; // 分割先は分割元の直後で挿入するためスキップ
      reordered.push(node);
      const dests = destByGroup.get(node.data?.id);
      if (dests) reordered.push(...dests);
    });
    // params.nodes を破壊的に並べ替える（postSortRows の仕様）
    nodes.length = 0;
    nodes.push(...reordered);
  }, []);

  // 経費明細グリッドの列定義。
  // ・"コード:名称" の1値は「コード列」「名称列」の2列に分けて表示する（同じ field を参照し
  //   valueFormatter で出し分ける）。両列とも同じ選択肢で入力でき、同一 field を更新する
  //   ため、どちらを編集しても隣のセルへ即座に連動する。
  // ・管理区分・管理コード・施策区分/コード・摘要は分割元と分割先で同じ列を使い、
  //   dualFieldValue／dualFieldSetter で保持先のフィールドだけを行の役割で切り替える
  //   （分割先行は splitDest〜、それ以外は本体フィールド。どちらの行でも入力可）。
  // ・mirrorParentField／inheritOnDestCellStyle を使う列（請求書番号）は分割先行で
  //   分割元（親）の値を参照表示し編集不可。
  // ・destFieldValue／destEditableCellStyle を使う列は分割先行のみ表示・入力可能とする
  //   （分割元・通常行は空・入力不可）。
  const columnDefs: ColDef[] = useMemo(
    () => [
      {
        headerName: '管理区分',
        colId: 'managementCategoryCode',
        field: 'managementCategory',
        valueGetter: dualFieldValue(
          'managementCategory',
          'splitDestMgmtCategory'
        ),
        valueSetter: managementCategorySetter,
        valueFormatter: (p) => splitCategoryCode(p.value) || GRID_EMPTY_TEXT,
        // 横スクロールしても管理区分列は左端に固定する
        lockPinned: true,
        editable: true,
        cellEditor: ComboCellEditor,
        cellEditorParams: {
          comboOptions: MANAGEMENT_CATEGORY_COMBO_OPTIONS,
        },
        cellEditorPopup: true,
        suppressKeyboardEvent: suppressEditNavKeys,
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      {
        headerName: '管理区分名称',
        colId: 'managementCategoryName',
        field: 'managementCategory',
        valueGetter: dualFieldValue(
          'managementCategory',
          'splitDestMgmtCategory'
        ),
        valueSetter: managementCategorySetter,
        valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
        editable: true,
        cellEditor: ComboCellEditor,
        cellEditorParams: {
          comboOptions: MANAGEMENT_CATEGORY_COMBO_OPTIONS,
        },
        cellEditorPopup: true,
        suppressKeyboardEvent: suppressEditNavKeys,
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      {
        headerName: '管理コード',
        colId: 'managementCodeCode',
        field: 'managementCode',
        valueGetter: dualFieldValue('managementCode', 'splitDestMgmtCode'),
        valueSetter: dualFieldSetter('managementCode', 'splitDestMgmtCode'),
        valueFormatter: (p) => splitCategoryCode(p.value) || GRID_EMPTY_TEXT,
        // 管理区分が未選択の行は組み合わせが定まらないため入力不可（グレー背景）にする
        editable: managementCodeEditable,
        cellEditor: ComboCellEditor,
        // 管理コードの選択肢は行の管理区分で絞り込む（組み合わせマスタ準拠）
        cellEditorParams: (params: ICellEditorParams) => ({
          comboOptions: managementCodeComboOptions(
            rowManagementCategory(params.data as ExpenseItemData | undefined)
          ),
        }),
        cellEditorPopup: true,
        suppressKeyboardEvent: suppressEditNavKeys,
        cellStyle: (params) => ({
          backgroundColor: rowManagementCategory(params.data)
            ? EDITABLE_CELL_BG
            : NON_EDITABLE_CELL_BG,
        }),
      },
      {
        headerName: '管理コード名称',
        colId: 'managementCodeName',
        field: 'managementCode',
        valueGetter: dualFieldValue('managementCode', 'splitDestMgmtCode'),
        valueSetter: dualFieldSetter('managementCode', 'splitDestMgmtCode'),
        valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
        // 管理区分が未選択の行は組み合わせが定まらないため入力不可（グレー背景）にする
        editable: managementCodeEditable,
        cellEditor: ComboCellEditor,
        // 管理コードの選択肢は行の管理区分で絞り込む（組み合わせマスタ準拠）
        cellEditorParams: (params: ICellEditorParams) => ({
          comboOptions: managementCodeComboOptions(
            rowManagementCategory(params.data as ExpenseItemData | undefined)
          ),
        }),
        cellEditorPopup: true,
        suppressKeyboardEvent: suppressEditNavKeys,
        cellStyle: (params) => ({
          backgroundColor: rowManagementCategory(params.data)
            ? EDITABLE_CELL_BG
            : NON_EDITABLE_CELL_BG,
        }),
      },
      // 勘定科目は管理区分ごとに一意に決まるため、入力欄ではなく管理区分に連動した
      // 表示（読み取り専用）とする。コード列・名称列は同じ値を出し分ける。
      // ※6/23 の「画面表示は不要」から 20260812_第29回 決定事項7 で表示する方針に変わっている。
      {
        headerName: '勘定科目コード',
        colId: 'accountCode',
        valueGetter: (p) =>
          managementAccount(
            rowManagementCategory(p.data as ExpenseItemData | undefined)
          ),
        valueFormatter: (p) => splitCategoryCode(p.value) || GRID_EMPTY_TEXT,
        editable: false,
        cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
      },
      {
        headerName: '勘定科目名称',
        colId: 'accountName',
        valueGetter: (p) =>
          managementAccount(
            rowManagementCategory(p.data as ExpenseItemData | undefined)
          ),
        valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
        editable: false,
        cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
      },
      {
        headerName: '支払金額 (円)',
        field: 'amount',
        ...GRID_NUMBER_TEXT_FILTER,
        valueFormatter: (params) =>
          params.value
            ? formatNumber(parseNumber(params.value))
            : GRID_EMPTY_TEXT,
        // 分割先行は編集不可（金額をブランクとし負担金額で管理する）。
        editable: (params) => !isSplitDestRow(params.data),
        cellEditor: 'agTextCellEditor',
        // 横寄せは cellClass、背景色のみ cellStyle（→ 02 §6/§7）
        cellClass: 'cell-right',
        cellStyle: (params) => ({
          backgroundColor: isSplitDestRow(params.data)
            ? NON_EDITABLE_CELL_BG
            : EDITABLE_CELL_BG,
        }),
      },
      {
        // 分割先行＝その分割先が負担する額（入力可）。
        // 分割元・通常行＝支払金額 − 分割先行の負担金額合計（自部門の負担分・入力不可）。
        headerName: '負担金額 (円)',
        colId: 'splitAmount',
        field: 'splitAmount',
        ...GRID_NUMBER_TEXT_FILTER,
        editable: (params) => isSplitDestRow(params.data),
        cellEditor: 'agTextCellEditor',
        valueGetter: (params) => {
          const d = params.data as ExpenseItemData | undefined;
          if (!d) return '';
          return d.splitRole === 'dest'
            ? (d.splitAmount ?? '')
            : String(ownBurdenAmount(params));
        },
        valueFormatter: (params) =>
          params.value
            ? formatNumber(parseNumber(params.value))
            : GRID_EMPTY_TEXT,
        // valueGetter を持つため編集反映には valueSetter が必要（分割先行のみ splitAmount へ書き戻す）。
        valueSetter: (params) => {
          if (!isSplitDestRow(params.data)) return false;
          params.data.splitAmount = params.newValue;
          return true;
        },
        cellClass: 'cell-right',
        cellStyle: destEditableCellStyle,
      },
      {
        headerName: '税区分',
        field: 'taxCategory',
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: TAX_CATEGORY_OPTIONS },
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      {
        // 分割先行＝振り分け先の部署（入力可・既定は基本情報の費用負担部署）。
        // 分割元・通常行＝基本情報の費用負担部署で固定（入力不可）。
        headerName: '費用負担部署',
        colId: 'splitDestDept',
        field: 'splitDestDept',
        editable: (params) => isSplitDestRow(params.data),
        cellEditor: ComboCellEditor,
        cellEditorParams: { comboOptions: COST_BEARING_DEPT_COMBO_OPTIONS },
        cellEditorPopup: true,
        suppressKeyboardEvent: suppressEditNavKeys,
        valueGetter: (params) => {
          const d = params.data as ExpenseItemData | undefined;
          if (!d) return '';
          return d.splitRole === 'dest'
            ? (d.splitDestDept ?? OWN_COST_BEARING_DEPT)
            : OWN_COST_BEARING_DEPT;
        },
        valueFormatter: (params) =>
          nameWithoutCode(params.value) || GRID_EMPTY_TEXT,
        cellStyle: destEditableCellStyle,
      },
      {
        headerName: '施策区分',
        colId: 'measureCategoryCode',
        field: 'measureCategory',
        valueGetter: dualFieldValue(
          'measureCategory',
          'splitDestMeasureCategory'
        ),
        valueSetter: dualFieldSetter(
          'measureCategory',
          'splitDestMeasureCategory'
        ),
        valueFormatter: (p) => splitCategoryCode(p.value) || GRID_EMPTY_TEXT,
        editable: true,
        cellEditor: ComboCellEditor,
        cellEditorParams: {
          comboOptions: MEASURE_CATEGORY_COMBO_OPTIONS,
          clearable: true,
        },
        cellEditorPopup: true,
        suppressKeyboardEvent: suppressEditNavKeys,
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      {
        headerName: '施策区分名称',
        colId: 'measureCategoryName',
        field: 'measureCategory',
        valueGetter: dualFieldValue(
          'measureCategory',
          'splitDestMeasureCategory'
        ),
        valueSetter: dualFieldSetter(
          'measureCategory',
          'splitDestMeasureCategory'
        ),
        valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
        editable: true,
        cellEditor: ComboCellEditor,
        cellEditorParams: {
          comboOptions: MEASURE_CATEGORY_COMBO_OPTIONS,
          clearable: true,
        },
        cellEditorPopup: true,
        suppressKeyboardEvent: suppressEditNavKeys,
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      {
        headerName: '施策コード',
        colId: 'measureCodeCode',
        field: 'measureCode',
        valueGetter: dualFieldValue('measureCode', 'splitDestMeasureCode'),
        valueSetter: dualFieldSetter('measureCode', 'splitDestMeasureCode'),
        valueFormatter: (p) => splitCategoryCode(p.value) || GRID_EMPTY_TEXT,
        editable: true,
        cellEditor: ComboCellEditor,
        cellEditorParams: {
          comboOptions: MEASURE_CODE_COMBO_OPTIONS,
          clearable: true,
        },
        cellEditorPopup: true,
        suppressKeyboardEvent: suppressEditNavKeys,
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      {
        headerName: '施策コード名称',
        colId: 'measureCodeName',
        field: 'measureCode',
        valueGetter: dualFieldValue('measureCode', 'splitDestMeasureCode'),
        valueSetter: dualFieldSetter('measureCode', 'splitDestMeasureCode'),
        valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
        editable: true,
        cellEditor: ComboCellEditor,
        cellEditorParams: {
          comboOptions: MEASURE_CODE_COMBO_OPTIONS,
          clearable: true,
        },
        cellEditorPopup: true,
        suppressKeyboardEvent: suppressEditNavKeys,
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      {
        headerName: '請求書番号',
        field: 'invoiceNumber',
        valueGetter: mirrorParentField('invoiceNumber'),
        editable: editableExceptDest,
        cellEditor: 'agTextCellEditor',
        cellStyle: inheritOnDestCellStyle(EDITABLE_CELL_BG),
      },
      {
        headerName: '摘要１(社内用)',
        field: 'note1',
        colId: 'note1',
        valueGetter: dualFieldValue('note1', 'splitDestNote1'),
        valueSetter: dualFieldSetter('note1', 'splitDestNote1'),
        editable: true,
        cellEditor: 'agTextCellEditor',
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      {
        headerName: '摘要２(社外用)',
        field: 'note2',
        colId: 'note2',
        valueGetter: dualFieldValue('note2', 'splitDestNote2'),
        valueSetter: dualFieldSetter('note2', 'splitDestNote2'),
        editable: true,
        cellEditor: 'agTextCellEditor',
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      // ===== 分割先行のみが持つ項目（販売店・三次店・一次店・営業担当者・分割案内） =====
      // 管理区分・管理コード・施策区分/コード・摘要は分割元と同じ列で入力する。
      {
        headerName: '販売店',
        colId: 'splitDestStore',
        editable: (params) => isSplitDestRow(params.data),
        cellEditor: ComboCellEditor,
        cellEditorParams: { comboOptions: SALES_STORE_COMBO_OPTIONS },
        cellEditorPopup: true,
        suppressKeyboardEvent: suppressEditNavKeys,
        // 値の読み書きは splitDestName に対して行うため field は持たない。
        // 分割元・通常行は基本情報の販売店を表示する（初期値として保持済み・入力不可）。
        valueGetter: (params) =>
          (params.data as ExpenseItemData | undefined)?.splitDestName ?? '',
        valueFormatter: (params) =>
          nameWithoutCode(params.value) || GRID_EMPTY_TEXT,
        // valueGetter を持つため編集反映には valueSetter が必要（分割先行のみ splitDestName へ書き戻す）。
        valueSetter: (params) => {
          if (!isSplitDestRow(params.data)) return false;
          params.data.splitDestName = params.newValue;
          return true;
        },
        cellStyle: destEditableCellStyle,
      },
      {
        headerName: '三次店',
        colId: 'splitTertiaryStore',
        field: 'splitTertiaryStore',
        // 分割元・通常行は基本情報の三次店を表示する（初期値として保持済み・入力不可）。
        valueFormatter: (params) =>
          nameWithoutCode(params.value) || GRID_EMPTY_TEXT,
        editable: (params) => isSplitDestRow(params.data),
        cellEditor: ComboCellEditor,
        cellEditorParams: { comboOptions: TERTIARY_STORE_COMBO_OPTIONS },
        cellEditorPopup: true,
        suppressKeyboardEvent: suppressEditNavKeys,
        cellStyle: destEditableCellStyle,
      },
      {
        headerName: '一次店',
        colId: 'splitPrimaryStore',
        field: 'splitPrimaryStore',
        // 分割元・通常行は基本情報の一次店を表示する（初期値として保持済み・入力不可）。
        valueFormatter: (params) =>
          nameWithoutCode(params.value) || GRID_EMPTY_TEXT,
        editable: (params) => isSplitDestRow(params.data),
        cellEditor: ComboCellEditor,
        cellEditorParams: { comboOptions: PRIMARY_STORE_COMBO_OPTIONS },
        cellEditorPopup: true,
        suppressKeyboardEvent: suppressEditNavKeys,
        cellStyle: destEditableCellStyle,
      },
      {
        headerName: '営業担当者',
        colId: 'splitDestManager',
        field: 'splitDestManager',
        // 分割元・通常行は基本情報の営業担当者を表示する（初期値として保持済み・入力不可）。
        valueFormatter: (params) =>
          nameWithoutCode(params.value) || GRID_EMPTY_TEXT,
        editable: (params) => isSplitDestRow(params.data),
        cellEditor: ComboCellEditor,
        cellEditorParams: { comboOptions: SALES_REP_COMBO_OPTIONS },
        cellEditorPopup: true,
        suppressKeyboardEvent: suppressEditNavKeys,
        cellStyle: destEditableCellStyle,
      },
      {
        headerName: '分割案内',
        colId: 'splitDestGuide',
        field: 'splitDestGuide',
        valueGetter: destFieldValue('splitDestGuide'),
        editable: (params) => isSplitDestRow(params.data),
        cellEditor: 'agTextCellEditor',
        cellStyle: destEditableCellStyle,
      },
      {
        headerName: '',
        field: 'actions',
        pinned: 'right',
        lockPinned: true,
        sortable: false,
        filter: false,
        resizable: false,
        editable: false,
        // アイコンを横並びで表示する列のため幅を固定（自動列幅調整の対象外にする）
        width: 96,
        minWidth: 96,
        maxWidth: 96,
        suppressAutoSize: true,
        cellRenderer: RowMenuCellRenderer,
        // 中央寄せはレンダラー側で行い、cellStyle に display:flex を持たせない（→ 02 §7）
      },
    ],
    []
  );

  // 経費明細グリッドの列状態（列幅・並び順・ソート）の保存／復元（共通フック）。
  // ※ 列の追加・削除・並び替え・グループ化を行ったら、保存キー末尾の版番号を必ず上げる
  //   （旧 localStorage の列状態を復元すると新列が末尾に回る・削除済み列が残るため）。
  //   本ファイルの各グリッドで共通のルール。
  const expenseGridColumnStateProps = useGridColumnState(
    'paymentApproval.expenseItem.columnState.v27'
  );

  // ===== 管理項目別合計値（すべての支払回数分を合算） =====
  // 表示中の回は state から、それ以外の回は roundStore の保存内容から取得する
  // （入力中の内容は保存されるまで他の回として合算しない）。
  // ※ roundStore は ref のため依存配列に載せられないが、内容が変わるのは回の追加時のみで、
  //   追加時は invoiceCount も変わるため同じ契機で再集計できる。
  const allRoundsExpenseData: ExpenseItemData[] = useMemo(
    () => [
      ...expenseData,
      ...Object.entries(roundStore.current)
        .filter(([round]) => round !== invoiceCount)
        .flatMap(([, round]) => round.expenseData),
    ],
    [expenseData, invoiceCount]
  );

  // 同上：ロケ契約料前払金グリッド（長期前払費用自販機関係費＝XKA 行の集計対象）。
  const allRoundsPrepaymentData: ExpenseItemData[] = useMemo(
    () => [
      ...prepaymentData,
      ...Object.entries(roundStore.current)
        .filter(([round]) => round !== invoiceCount)
        .flatMap(([, round]) => round.prepaymentData),
    ],
    [prepaymentData, invoiceCount]
  );

  // 管理項目別合計値グリッドの行データ。
  const summaryData: ExpenseSummaryData[] = useMemo(() => {
    // 金額列を金額単位（円／千円）へ換算して3桁区切りへ整形する。
    // 率（前年比・計画差異）と「-」は単位に依存しないため換算しない。
    const unitDivisor = summaryAmountUnit === 'thousand' ? 1000 : 1;
    const formatAmount = (num: number): string =>
      formatNumber(num / unitDivisor);

    // 各経費項目の集計値。小計・合計の合算に使うため数値のまま保持する。
    const rows = SUMMARY_EXPENSE_ITEMS.map((item) => {
      // 支払合計：経費明細の金額合計。
      // ※ 長期前払費用自販機関係費（XKA）は前払金グリッドが全行当カテゴリのため、その全行も加算する。
      const paymentTotal =
        allRoundsExpenseData
          .filter((d) => matchesSummaryItem(d, item))
          .reduce((sum, d) => sum + parseNumber(d.amount), 0) +
        (item === PREPAID_AMORTIZATION_ITEM
          ? allRoundsPrepaymentData.reduce(
              (sum, d) => sum + parseNumber(d.amount),
              0
            )
          : 0);
      // 他部門へ：自部門以外が負担する金額。次の2つを別々の管理区分で振り分ける。
      //  ・行の支払金額 … 行の管理区分（支払合計と同じ範囲）
      //  ・分割金額 … 分割先の管理区分（分割元の管理区分とは別の行へ計上される）
      // ※ 長期前払費用自販機関係費（XKA）は前払金グリッドの全行も対象に含める。
      const chargeTo =
        sumPaymentToOtherDept(
          allRoundsExpenseData.filter((d) => matchesSummaryItem(d, item))
        ) +
        sumSplitToOtherDept(
          allRoundsExpenseData.filter((d) =>
            matchesSplitDestSummaryItem(d, item)
          )
        ) +
        (item === PREPAID_AMORTIZATION_ITEM
          ? sumPaymentToOtherDept(allRoundsPrepaymentData) +
            sumSplitToOtherDept(allRoundsPrepaymentData)
          : 0);
      // 他部門から：他部門から分割/振替された経費明細の合計
      const chargeFrom = SPLIT_FROM_OTHER_INITIAL_DATA.filter((d) =>
        matchesSummaryItem(d, item)
      ).reduce((sum, d) => sum + parseNumber(d.amount), 0);
      const monthlyTotal = paymentTotal - chargeTo + chargeFrom; // 負担額合計
      const planAmount = paymentTotal * 1.1; // 計画金額はモック
      const planDifference = monthlyTotal - planAmount; // 計画差
      // 長期前払費用自販機関係費（前払金の償却項目）は計画対象外のため、
      // 前年比・計画金額・計画差・計画差異の各列は「-」、差異理由はブランクにする。
      const isPlanExcluded = item === PREPAID_AMORTIZATION_ITEM;
      return {
        item,
        paymentTotal,
        chargeTo,
        chargeFrom,
        monthlyTotal,
        planAmount,
        planDifference,
        isPlanExcluded,
      };
    });

    // 計画差異（％）：計画差 ÷ 計画金額
    const toRate = (planDifference: number, planAmount: number): string =>
      planAmount === 0
        ? '0.00%'
        : ((planDifference / planAmount) * 100).toFixed(2) + '%';

    // 集計値（数値）→ グリッド表示用の行データへ変換する。
    const displayRows: ExpenseSummaryData[] = rows.map((r) => ({
      managementCode: SUMMARY_MANAGEMENT_CODE[r.item] ?? '',
      aggregationAccount: (
        SUMMARY_AGGREGATION_ACCOUNTS[SUMMARY_MANAGEMENT_CODE[r.item] ?? ''] ??
        []
      ).join('、'),
      expenseItem: r.item,
      amount: formatAmount(r.paymentTotal),
      chargeTo: formatAmount(r.chargeTo),
      chargeFrom: formatAmount(r.chargeFrom),
      monthlyTotal: formatAmount(r.monthlyTotal),
      yearOverYear: r.isPlanExcluded ? GRID_EMPTY_TEXT : '100.0%',
      planAmount: r.isPlanExcluded
        ? GRID_EMPTY_TEXT
        : formatAmount(r.planAmount),
      planDifference: r.isPlanExcluded
        ? GRID_EMPTY_TEXT
        : formatAmount(r.planDifference),
      planDifferenceRate: r.isPlanExcluded
        ? GRID_EMPTY_TEXT
        : toRate(r.planDifference, r.planAmount),
      differenceReason: '',
    }));

    // 小計行を作る（対象行の各列を合算する）。
    const buildSubtotalRow = (
      label: string,
      source: typeof rows
    ): ExpenseSummaryData => {
      const sum = (pick: (r: (typeof rows)[number]) => number): number =>
        source.reduce((s, r) => s + pick(r), 0);
      const planAmount = sum((r) => r.planAmount);
      const planDifference = sum((r) => r.planDifference);
      return {
        managementCode: '',
        aggregationAccount: '',
        expenseItem: label,
        amount: formatAmount(sum((r) => r.paymentTotal)),
        chargeTo: formatAmount(sum((r) => r.chargeTo)),
        chargeFrom: formatAmount(sum((r) => r.chargeFrom)),
        monthlyTotal: formatAmount(sum((r) => r.monthlyTotal)),
        yearOverYear: '100.0%',
        planAmount: formatAmount(planAmount),
        planDifference: formatAmount(planDifference),
        planDifferenceRate: toRate(planDifference, planAmount),
        differenceReason: '',
      };
    };

    // 営業経費：オペ条件口(手出票)〜ロケ契約料の集計。
    // 自販機関係費：自販機コラム料〜販売器具移設費の集計（XKA を除く）。
    const salesExpenseEnd = rows.findIndex((r) => r.item === 'ロケ契約料');
    const vendingExpenseEnd = rows.findIndex(
      (r) => r.item === '販売器具移設費'
    );
    const salesExpenseRows = rows.slice(0, salesExpenseEnd + 1);
    const vendingExpenseRows = rows.slice(
      salesExpenseEnd + 1,
      vendingExpenseEnd + 1
    );
    const salesSubtotalRow = buildSubtotalRow('営業経費', salesExpenseRows);
    const vendingSubtotalRow = buildSubtotalRow(
      '自販機関係費',
      vendingExpenseRows
    );

    // 長期前払費用：長期前払費用自販機関係費（XKA）の集計。XKA は計画対象外のため、
    // 前年比〜計画差異は XKA 行・合計行と同じく「-」にする（差異理由はブランク）。
    const prepaidRows = rows.filter(
      (r) => r.item === PREPAID_AMORTIZATION_ITEM
    );
    const prepaidSectionRow: ExpenseSummaryData = {
      ...buildSubtotalRow('長期前払費用', prepaidRows),
      yearOverYear: GRID_EMPTY_TEXT,
      planAmount: GRID_EMPTY_TEXT,
      planDifference: GRID_EMPTY_TEXT,
      planDifferenceRate: GRID_EMPTY_TEXT,
    };

    // 合計：営業経費 ＋ 自販機関係費 ＋ 長期前払費用自販機関係費（XKA）。
    // 支払合計〜負担額合計のみ集計し、前年比〜計画差異は「-」、差異理由はブランク。
    const xkaRow = rows.find((r) => r.item === PREPAID_AMORTIZATION_ITEM);
    const totalSource = [
      ...salesExpenseRows,
      ...vendingExpenseRows,
      ...(xkaRow ? [xkaRow] : []),
    ];
    const totalSum = (pick: (r: (typeof rows)[number]) => number): number =>
      totalSource.reduce((s, r) => s + pick(r), 0);
    const totalRow: ExpenseSummaryData = {
      managementCode: '',
      aggregationAccount: '',
      expenseItem: '合計',
      amount: formatAmount(totalSum((r) => r.paymentTotal)),
      chargeTo: formatAmount(totalSum((r) => r.chargeTo)),
      chargeFrom: formatAmount(totalSum((r) => r.chargeFrom)),
      monthlyTotal: formatAmount(totalSum((r) => r.monthlyTotal)),
      yearOverYear: GRID_EMPTY_TEXT,
      planAmount: GRID_EMPTY_TEXT,
      planDifference: GRID_EMPTY_TEXT,
      planDifferenceRate: GRID_EMPTY_TEXT,
      differenceReason: '',
    };

    // 集計行は配下の経費項目より前に置く（合計＝先頭行、営業経費＝オペ条件口(手出票)の直前、
    // 自販機関係費＝コラム料の直前、長期前払費用＝長期前払費用自販機関係費(XKA)の直前）。
    // XKA は引き続き最下行。
    return [
      totalRow,
      salesSubtotalRow,
      ...displayRows.slice(0, salesExpenseEnd + 1),
      vendingSubtotalRow,
      ...displayRows.slice(salesExpenseEnd + 1, vendingExpenseEnd + 1),
      prepaidSectionRow,
      ...displayRows.slice(vendingExpenseEnd + 1),
    ];
  }, [allRoundsExpenseData, allRoundsPrepaymentData, summaryAmountUnit]);

  // 管理項目別合計値グリッドの列定義
  const summaryColumnDefs: ColDef[] = useMemo(
    () => [
      { headerName: '管理区分', field: 'managementCode' },
      { headerName: '管理区分名称', field: 'expenseItem' },
      {
        ...amountHeaderColDef('支払合計'),
        field: 'amount',
        cellClass: 'cell-right',
      },
      {
        ...amountHeaderColDef('他部門へ'),
        field: 'chargeTo',
        cellClass: 'cell-right',
      },
      {
        ...amountHeaderColDef('他部門から'),
        field: 'chargeFrom',
        cellClass: 'cell-right',
      },
      {
        ...amountHeaderColDef('負担額合計'),
        field: 'monthlyTotal',
        cellClass: 'cell-right',
      },
      {
        headerName: '前年比 (％)',
        field: 'yearOverYear',
        cellClass: 'cell-right',
      },
      {
        ...amountHeaderColDef('計画金額'),
        field: 'planAmount',
        cellClass: 'cell-right',
      },
      {
        ...amountHeaderColDef('計画差'),
        field: 'planDifference',
        cellClass: 'cell-right',
      },
      {
        headerName: '計画差異（％）',
        field: 'planDifferenceRate',
        cellClass: 'cell-right',
      },
      {
        headerName: '差異理由',
        field: 'differenceReason',
        // 計画差異が大きく赤背景になる行のみ入力可能にする
        editable: (params) => isExpenseAlertRow(params.data),
        cellStyle: { backgroundColor: GRID_COLORS.editable },
        // 入力可能な行（計画差異が大きく赤背景になる行）が未入力のときだけ、
        // 入力を促すプレースホルダを表示する
        cellRenderer: (params: ICellRendererParams) => {
          if (params.value) return params.value;
          if (isExpenseAlertRow(params.data)) {
            return (
              <span className="text-gray-400 italic">
                差異理由を入力してください
              </span>
            );
          }
          return '';
        },
        // ※ 差異理由は表示用集計のため state へは保持しない（入力値はグリッド内に留まる）。
      },
      {
        headerName: '集計対象の勘定科目',
        field: 'aggregationAccount',
        // 複数科目が紐づく管理区分（89H）は1行に収まらないため折り返し＋行高自動調整で全文表示する
        width: 320,
        wrapText: true,
        autoHeight: true,
        cellClass: 'cell-left',
      },
    ],
    [amountHeaderColDef]
  );

  // ===== 各サマリーバーの表示項目 =====

  // 支払明細情報カード：表示中グリッドに関わらず経費明細＋ロケ契約料前払金を合算するため、
  // グリッドを切り替えても合計金額は変わらない。
  const summaryItems = useMemo(
    () => buildTotalSummaryItems([...expenseData, ...prepaymentData]),
    [expenseData, prepaymentData]
  );

  // 他部門から分割/振替された経費の合計金額
  const splitFromOtherSummaryItems = useMemo(
    () => buildTotalSummaryItems(SPLIT_FROM_OTHER_INITIAL_DATA),
    []
  );

  // ===== 各グリッドの列定義の組み立てと列状態の保存／復元 =====
  // withHeaderTooltips＝ヘッダー省略時にマウスオーバーで全文表示するためのツールチップ付与、
  // groupColumnsByIds＝ヘッダーの2階層化。列状態は版番号付きのキーで localStorage に保持する。

  // 共通プリセット GRID_DEFAULT_COL_DEF を土台に、合計グリッド固有の差分のみ上書きする（→ 02 §7）。
  // 読み取り専用の集計表のためソート・フィルターは無効にする。
  const summaryDefaultColDef = useMemo(
    () => ({
      ...GRID_DEFAULT_COL_DEF,
      sortable: false,
      filter: false,
      suppressMovable: true,
    }),
    []
  );

  const summaryGridColumnStateProps = useGridColumnState(
    'paymentApproval.expenseSummary.columnState.v2'
  );

  // 経費明細グリッド：分割先固有列も本体列と同じ階層に並べる（2階層化しない）。
  const columnDefsWithTooltip = useMemo(
    () => withHeaderTooltips([ID_COLUMN_DEF, ...columnDefs]),
    [columnDefs]
  );

  // 引用元選択ペインの支払明細情報グリッド。経費明細の列から右端アクション列を除いて
  // 流用し、引用元の参照専用のため全列を入力不可（グレー背景）にする。
  const quoteSourceColumnDefsWithTooltip = useMemo(
    () =>
      withHeaderTooltips([
        ID_COLUMN_DEF,
        ...columnDefs
          .filter((col) => col.field !== 'actions')
          .map((col) => ({
            ...col,
            editable: false,
            cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
          })),
      ]),
    [columnDefs]
  );

  const quoteSourceGridColumnStateProps = useGridColumnState(
    'paymentApproval.quoteSource.columnState.v2'
  );

  // ロケ契約料前払金グリッドの列定義。経費明細の列から分割先固有列（当グリッドは
  // 分割を行わない）と右端アクション列を除いて流用し、償却情報・償却仕訳情報グループの
  // 列を加える。負担金額は分割先行が前提の列のため併せて除き、費用負担部署は
  // 行ごとに入力可とする。
  const prepaymentColumnDefs = useMemo<ColDef[]>(() => {
    const prepaymentExcludedColIds = [...SPLIT_INFO_COL_IDS, 'splitAmount'];
    const baseCols = columnDefs
      .filter(
        (col) =>
          !prepaymentExcludedColIds.includes(col.colId ?? '') &&
          col.field !== 'actions'
      )
      // 当グリッドは管理区分「XKA / 長期前払費用自販機関係費」、
      // 管理コード「99999 / 長期前払費用自販機関係費」を固定・読み取り専用にする。
      .map((col) => {
        if (col.colId === 'managementCategoryCode') {
          return {
            ...col,
            editable: false,
            valueGetter: () => 'XKA',
            valueFormatter: undefined,
            cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
          };
        }
        if (col.colId === 'managementCategoryName') {
          return {
            ...col,
            editable: false,
            valueGetter: () => PREPAID_AMORTIZATION_ITEM,
            valueFormatter: undefined,
            cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
          };
        }
        if (col.colId === 'managementCodeCode') {
          return {
            ...col,
            editable: false,
            valueGetter: () => '99999',
            valueFormatter: undefined,
            cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
          };
        }
        if (col.colId === 'managementCodeName') {
          return {
            ...col,
            editable: false,
            valueGetter: () => PREPAID_AMORTIZATION_ITEM,
            valueFormatter: undefined,
            cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
          };
        }
        // 費用負担部署は分割を行わない当グリッドでは行自身の負担部署として入力可にする
        // （既定は基本情報の自部門）。経費明細の分割先用 valueGetter は使わず、
        // 「他部門へ」の集計対象である costBearingDept を直接読み書きする。
        if (col.colId === 'splitDestDept') {
          return {
            ...col,
            editable: true,
            valueGetter: (params) => {
              const d = params.data as ExpenseItemData | undefined;
              return d?.costBearingDept ?? OWN_COST_BEARING_DEPT;
            },
            valueSetter: (params) => {
              params.data.costBearingDept = params.newValue;
              return true;
            },
            cellStyle: { backgroundColor: EDITABLE_CELL_BG },
          };
        }
        // 勘定科目は管理区分 XKA に対応する科目で固定する
        // （行データの管理区分ではなく、当グリッドの固定表示に合わせる）。
        if (col.colId === 'accountCode' || col.colId === 'accountName') {
          return {
            ...col,
            valueGetter: () => PREPAID_AMORTIZATION_ACCOUNT,
          };
        }
        return col;
      });
    const actionsCol = columnDefs.find((col) => col.field === 'actions');
    return [
      ...baseCols,
      ...AMORTIZATION_INFO_COLUMN_DEFS,
      ...AMORTIZATION_JOURNAL_COLUMN_DEFS,
      ...(actionsCol ? [actionsCol] : []),
    ];
  }, [columnDefs]);

  // 同グリッド：償却情報／償却仕訳情報の2階層化。
  const prepaymentColumnDefsWithTooltip = useMemo(() => {
    const withTooltip = withHeaderTooltips([
      ID_COLUMN_DEF,
      ...prepaymentColumnDefs,
    ]);
    const grouped = groupColumnsByIds(
      withTooltip,
      AMORTIZATION_INFO_COL_IDS,
      '償却情報'
    );
    return groupColumnsByIds(
      grouped,
      AMORTIZATION_JOURNAL_COL_IDS,
      '償却仕訳情報'
    );
  }, [prepaymentColumnDefs]);

  // 当グリッドは経費明細の columnDefs を流用するため、そちらの列変更でも版番号を上げる。
  const prepaymentGridColumnStateProps = useGridColumnState(
    'paymentApproval.prepaymentItem.columnState.v12'
  );
  const summaryColumnDefsWithTooltip = useMemo(
    () => withHeaderTooltips(summaryColumnDefs),
    [summaryColumnDefs]
  );

  // 「他部門から分割/振替された経費明細」タブの列定義。経費明細の列を流用しつつ、
  // ・右端アクション列と請求書番号は非表示、参照専用のため全列を入力不可（グレー背景）
  // ・分割セット固有列は部署・営業担当者のみ残し、当タブ専用の支払No・支払回数・
  //   事業場を加えて第一階層「分割/振替元」でまとめ、グリッド右端に配置する
  // ・分割案内はグループ対象外の単独列として摘要２の右に置く
  // ・項目名が異なる列は SPLIT_FROM_OTHER_HEADER_OVERRIDES で改称する
  const splitFromOtherColumnDefsWithTooltip = useMemo(() => {
    const excludedFields = ['actions', 'invoiceNumber'];
    const baseCols: ColDef[] = columnDefs
      .filter(
        (col) =>
          !excludedFields.includes(col.field as string) &&
          !SPLIT_SOURCE_INFO_HIDDEN_COL_IDS.includes(col.colId ?? '')
      )
      .map((col) => {
        const overriddenHeader =
          SPLIT_FROM_OTHER_HEADER_OVERRIDES[col.colId ?? col.field ?? ''];
        // 費用負担部署列は経費明細では自部門固定を表示するが、当タブでは分割/振替元の
        // 部署を表示するため、行の値をそのまま読む valueGetter に差し替える。
        const overriddenValueGetter =
          col.colId === 'splitDestDept'
            ? { valueGetter: destFieldValue('splitDestDept') }
            : {};
        return {
          ...col,
          ...(overriddenHeader ? { headerName: overriddenHeader } : {}),
          ...overriddenValueGetter,
          editable: false,
          cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
        };
      });
    // 分割案内（columnDefs 上は末尾）を摘要２(社外用)の直後へ移動する。
    const guideCol = baseCols.find((col) => col.colId === 'splitDestGuide');
    const orderedCols = guideCol
      ? baseCols
          .filter((col) => col.colId !== 'splitDestGuide')
          .flatMap((col) => (col.field === 'note2' ? [col, guideCol] : [col]))
      : baseCols;
    // 分割/振替元グループの子列順は groupColumnsByIds に渡す配列の並びで決まるため、
    // SPLIT_SOURCE_INFO_COL_IDS の順に並べ替える（当タブ専用列も候補に含める）。
    const sourceInfoPool = [
      ...orderedCols,
      ...SPLIT_SOURCE_INFO_EXTRA_COLUMN_DEFS,
    ];
    const sourceInfoCols = SPLIT_SOURCE_INFO_COL_IDS.map((colId) =>
      sourceInfoPool.find((col) => col.colId === colId)
    ).filter((col): col is ColDef => col !== undefined);
    // 対象列を元の位置から取り除き、グリッド右端へまとめて並べる
    // （groupColumnsByIds は最初の対象列の位置にグループを差し込むため、末尾に置けば右端になる）。
    const finalCols = [
      ...orderedCols.filter(
        (col) => !SPLIT_SOURCE_INFO_COL_IDS.includes(col.colId ?? '')
      ),
      ...sourceInfoCols,
    ];
    return groupColumnsByIds(
      withHeaderTooltips(finalCols),
      SPLIT_SOURCE_INFO_COL_IDS,
      '分割/振替元'
    );
  }, [columnDefs]);

  // 当グリッドも経費明細の columnDefs を流用するため、そちらの列変更でも版番号を上げる。
  const splitFromOtherGridColumnStateProps = useGridColumnState(
    'paymentApproval.splitFromOther.columnState.v22'
  );

  // ===== 各グリッドへ渡す context（編集グリッドのため参照を固定・→ 02 §7.1） =====

  // 行アクション＋変更セル判定。isCellChanged は共通 cellClassRules が参照する（→ 02 §7.2）。
  const detailGridContext = useMemo(
    () => ({
      // 分割は経費明細グリッドのみで提供する
      showSplit: detailGridView === 'payment',
      onSplitRow: handleSplitRow,
      onCopyRow: handleCopyRow,
      onDeleteRow: handleDeleteRow,
      isCellChanged: detailChangedCells.isCellChanged,
      // No. 列の開閉ボタン（分割先を持つ分割元行のみ表示）
      collapsedSplitGroups,
      onToggleSplitGroup: handleToggleSplitGroup,
    }),
    [
      detailGridView,
      handleSplitRow,
      handleCopyRow,
      handleDeleteRow,
      detailChangedCells,
      collapsedSplitGroups,
      handleToggleSplitGroup,
    ]
  );

  return (
    <div className="min-w-[75rem]">
      <div className="px-6 pt-3 pb-0">
        {/* 画面名はヘッダー（システム名の右）に表示する */}
        <ScreenTitle title="支払詳細(自販機)" />

        {/* 基本情報カード（参照専用・行ごとに下線で区切る） */}
        <CollapsibleCard
          title="基本情報"
          open={isHeaderOpen}
          onOpenChange={setIsHeaderOpen}
        >
          <div className="p-4">
            {/* 1行目: 対象年月 / 販売計画書No / 支払No / 分割・振替有無 */}
            <div className="grid grid-cols-4 gap-3 mb-2 items-center pb-3 border-b border-gray-300">
              {renderLabelField('対象年月', '2025年5月')}
              {/* 販売計画書No は計画詳細(自販機)へのリンク。URL 遷移ではなく
                  onMenuChange による画面切替のため、Button の link バリアントで表現する。
                  余白は他のヘッダー項目の値と左端をそろえるため 0 にする。 */}
              {renderLabelField(
                '販売計画書No',
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={handleSalesPlanNoClick}
                  aria-label={`販売計画書No ${SALES_PLAN_NO} の計画詳細を開く`}
                >
                  {SALES_PLAN_NO}
                </Button>
              )}
              {renderLabelField('支払No', PAYMENT_NO)}
              {renderLabelField(
                '分割・振替有無',
                <SplitTransferMarks
                  isSplit={BASIC_INFO_IS_SPLIT}
                  isTransfer={BASIC_INFO_IS_TRANSFER}
                />
              )}
            </div>

            {/* 販売店 / 三次店 / 一次店 */}
            <div className="grid grid-cols-4 gap-3 mb-2 pb-3 border-b border-gray-300">
              {renderLabelField('販売店', BASIC_INFO_SALES_STORE)}
              {renderLabelField('三次店', BASIC_INFO_TERTIARY_STORE)}
              {renderLabelField('一次店', BASIC_INFO_PRIMARY_STORE)}
              <div />
            </div>

            {/* 事業場 / 部署 / 費用負担部署 / 営業担当者（最終行・下線なし）。
                申請側の組織（申請事業場・申請部署・申請者）は支払情報エリアに持ち、
                「申請」を冠して区別する（→ 20260804_第26回 決定事項18／課題 No.0956）。 */}
            <div className="grid grid-cols-4 gap-3 mb-2">
              {renderLabelField('事業場', '10002012:近畿圏本部')}
              {renderLabelField('部署', '10000121:近畿圏本部営業一部')}
              {renderLabelField('費用負担部署', OWN_COST_BEARING_DEPT)}
              {renderLabelField('営業担当者', BASIC_INFO_CREATOR)}
            </div>
          </div>
        </CollapsibleCard>
      </div>

      {/* 明細エリア（管理項目別合計値・支払明細情報・他部門から分割/振替された経費明細）。
          行ハイライト色は GRID_COLORS を CSS変数で注入し、<style> 内の hex 直書きを避ける（→ 02 §10.1） */}
      <div
        className="w-full px-6 pt-0 pb-2"
        style={
          {
            '--expense-alert-bg': GRID_COLORS.alertRowBg,
            '--expense-subtotal-bg': GRID_COLORS.total,
            '--expense-section-bg': GRID_COLORS.sectionRowBg,
          } as React.CSSProperties
        }
      >
        {/* グローバルCSSの「先頭列を中央寄せ」（チェックボックス列向け）を
            本画面のデータ先頭列では左寄せに上書きする */}
        <style>{`
          .expense-item-grid .ag-cell[aria-colindex="1"],
          .expense-summary-grid .ag-cell[aria-colindex="1"] {
            justify-content: flex-start;
            padding-left: var(--ag-cell-horizontal-padding);
            padding-right: var(--ag-cell-horizontal-padding);
          }
          .expense-item-grid .ag-cell[aria-colindex="1"] > *,
          .expense-summary-grid .ag-cell[aria-colindex="1"] > * {
            justify-content: flex-start;
          }
          /* 管理区分（先頭列）の上下位置を管理区分名称の列と揃える。
             集計対象の勘定科目の折り返しで行が高くなると、グローバルCSSの縦中央寄せ
             （チェックボックス列向け）が効く管理区分だけが中央に残りずれるため、
             通常セルと同じ上寄せに戻す（セル本体と、高さ100%が指定される子要素の両方）。 */
          .expense-summary-grid .ag-cell[aria-colindex="1"] {
            align-items: flex-start;
          }
          .expense-summary-grid .ag-cell[aria-colindex="1"] > * {
            height: auto;
          }
          /* 以下の1行ハイライトはいずれも、各セルの cellStyle 背景（白/グレー）を
             上書きするため全セルを対象にする。
             ホバー行はセル背景を透明にし、テーマが行(.ag-row)へ塗るホバー色を見せる
             （セルに直接ホバー色を塗ると行側の塗りと二重になり濃く見えるため）。 */
          .expense-item-grid .ag-row-hover .ag-cell,
          .expense-summary-grid .ag-row-hover .ag-cell {
            background-color: transparent !important;
          }
          /* 計画差異が大きい行（ロケ運転費）：赤背景 */
          .expense-summary-grid .ag-row.expense-summary-alert .ag-cell {
            background-color: var(--expense-alert-bg) !important;
          }
          /* 集計行（合計・営業経費・自販機関係費）：薄い青背景・太字 */
          .expense-summary-grid .ag-row.expense-summary-aggregate .ag-cell {
            background-color: var(--expense-subtotal-bg) !important;
            font-weight: 700;
          }
          /* 区切り行（営業経費・自販機関係費）：計画詳細(自販機)の経費計画グリッドと
             同じ区切り行色（グレー）＋太字なし（太字は合計行のみ → 02 §7）。
             上の集計行ルールと同じ詳細度のため、後に書いて背景と文字ウェイトを上書きする。 */
          .expense-summary-grid .ag-row.expense-summary-section .ag-cell {
            background-color: var(--expense-section-bg) !important;
            font-weight: 400;
          }
        `}</style>

        {/* 支払情報サマリカード：管理項目別合計値／他部門から分割/振替された経費明細をトグル切替する。 */}
        <CollapsibleCard
          title="支払情報サマリ"
          open={isSummaryOpen}
          onOpenChange={setIsSummaryOpen}
          headerActions={
            /* 表示切替（青枠ボタン群） */
            <div className="flex w-fit overflow-hidden rounded-lg border-2 border-blue-600">
              <button
                type="button"
                onClick={() => setSummaryView('summary')}
                aria-pressed={summaryView === 'summary'}
                className={toggleButtonClass(summaryView === 'summary', true)}
              >
                管理項目別合計値
              </button>
              <button
                type="button"
                onClick={() => setSummaryView('split-from-other')}
                aria-pressed={summaryView === 'split-from-other'}
                className={toggleButtonClass(
                  summaryView === 'split-from-other'
                )}
              >
                他部門から分割/振替された経費明細
              </button>
            </div>
          }
        >
          <div className="w-full p-3">
            {summaryView === 'summary' ? (
              // 表示切替の両分岐とも Fragment のため、key が無いと React が同じ位置の
              // <AgGridReact> を作り直さずに使い回してしまう。他部門から分割/振替された
              // 経費明細で有効な getRowId（data.id）が管理項目別合計値へ持ち込まれると、
              // 合計値の行は id を持たず全行が同じ行IDになり最後の合計行しか残らない。
              // key を分けてグリッドごと作り直す。
              <React.Fragment key="summary">
                {/* 金額単位トグル（円／千円）。金額列のみ千円換算し、列ヘッダーの単位表記も
                    追従させる。グリッド直上に右寄せ配置（支払詳細(追加口請求書有)の
                    支払情報サマリと同じ）。 */}
                <div className="flex items-center justify-end gap-2 mb-2">
                  <label className="text-sm text-blue-900 whitespace-nowrap font-bold">
                    金額単位
                  </label>
                  <div className="inline-flex rounded-md border border-gray-300 overflow-hidden h-8">
                    <button
                      type="button"
                      onClick={() => setSummaryAmountUnit('yen')}
                      aria-pressed={summaryAmountUnit === 'yen'}
                      className={`px-4 text-sm font-medium transition-colors ${
                        summaryAmountUnit === 'yen'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      円
                    </button>
                    <button
                      type="button"
                      onClick={() => setSummaryAmountUnit('thousand')}
                      aria-pressed={summaryAmountUnit === 'thousand'}
                      className={`px-4 text-sm font-medium transition-colors ${
                        summaryAmountUnit === 'thousand'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      千円
                    </button>
                  </div>
                </div>
                {/* 管理項目別合計値グリッド。
                    高さはリサイズハンドルで調整した値（JS動的値のため inline style） */}
                <div
                  className="expense-summary-grid w-full"
                  style={{ height: summaryResize.height }}
                >
                  <AgGridReact
                    ref={summaryGridRef}
                    onRowDataUpdated={reveal.onRowDataUpdated}
                    rowData={summaryData}
                    columnDefs={summaryColumnDefsWithTooltip}
                    defaultColDef={summaryDefaultColDef}
                    // defaultColDef で filter: false のため、型によるフィルタの追加を止める（→ grid/gridCommon）
                    columnTypes={GRID_NO_FILTER_COLUMN_TYPES}
                    // 行ハイライト（赤＝計画差異が大きい行／青＝集計行）。実際の配色は上の <style> 側。
                    rowClassRules={{
                      'expense-summary-alert': (params) =>
                        isExpenseAlertRow(params.data),
                      'expense-summary-aggregate': (params) =>
                        isExpenseAggregateRow(params.data),
                      'expense-summary-section': (params) =>
                        isExpenseSectionRow(params.data),
                    }}
                    suppressMovableColumns={true}
                    // 列状態（列幅）の保存／復元（共通フック）
                    {...summaryGridColumnStateProps}
                    // 共通基本プロパティ（Enter縦移動・テキスト選択／grid/）
                    {...GRID_BASE_PROPS}
                  />
                </div>
              </React.Fragment>
            ) : (
              <React.Fragment key="split-from-other">
                {/* 合計金額サマリーバー（支払明細情報カードのサマリーバーとスタイルを揃える） */}
                <div className="flex items-center gap-2 pb-2">
                  <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
                    <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
                      合計金額
                    </span>
                    <div className="flex items-stretch divide-x divide-gray-200">
                      {splitFromOtherSummaryItems.map((item) => (
                        <div
                          key={item.label}
                          className="flex w-40 flex-col items-end px-3"
                        >
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {item.label}
                          </span>
                          <span
                            className={`text-sm font-bold whitespace-nowrap ${
                              item.emphasize ? 'text-blue-700' : 'text-gray-900'
                            }`}
                          >
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* グリッド高さは管理項目別合計値と同じくリサイズハンドルの調整値に追従する */}
                <div
                  className="expense-item-grid w-full"
                  style={{ height: summaryResize.height }}
                >
                  <AgGridReact
                    rowData={SPLIT_FROM_OTHER_INITIAL_DATA}
                    columnDefs={splitFromOtherColumnDefsWithTooltip}
                    defaultColDef={GRID_DEFAULT_COL_DEF}
                    // 行番号列を左端に表示（AG Grid公式 Row Numbers 機能）
                    rowNumbers={true}
                    getRowId={getRowId}
                    statusBar={GRID_STATUS_BAR}
                    // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）
                    {...splitFromOtherGridColumnStateProps}
                    // 共通基本プロパティ（Enter縦移動・テキスト選択／grid/）
                    {...GRID_BASE_PROPS}
                  />
                </div>
              </React.Fragment>
            )}
          </div>

          {/* リサイズハンドル：上下ドラッグでカード本体（表示中グリッド）の高さを調整する。
              計画詳細(NET固定)＝ PlanAggregationPane と同じ共通部品を使う */}
          <div className="relative h-2">
            <ResizeHandle onMouseDown={summaryResize.handleMouseDown} />
          </div>
        </CollapsibleCard>

        {/* 支払明細エリア（支払情報サマリカードの下） */}
        <div className="w-full mt-2 space-y-2">
          {/* 支払回数（横位置は支払先に揃える） */}
          <div className="flex items-center gap-2 px-4">
            <label
              htmlFor="invoice-count"
              className={`${FORM_LABEL_CLASS} whitespace-nowrap w-36 text-right`}
            >
              支払回数
            </label>
            {/* 回を選ぶと、確認のうえその回の保存内容へ表示を切り替える */}
            <SingleCombobox
              id="invoice-count"
              className="w-20"
              options={[...rounds.options.map((n) => ({ value: n, label: n }))]}
              value={invoiceCount}
              onChange={rounds.selectRound}
              placeholder="選択"
              searchable={false}
            />
            {/* 支払回数追加（支払回数の右・左に全角2文字程度の空白） */}
            <button
              type="button"
              className="btn-toolbar-outline ml-8"
              onClick={rounds.requestAddRound}
              aria-label="支払回数追加"
            >
              ＋支払回数追加
            </button>
            {/* 支払情報引用（支払回数追加の右・間隔は全角1文字分＝1rem） */}
            <button
              type="button"
              className="btn-toolbar-outline ml-4"
              onClick={handleQuotePaymentInfo}
              aria-label="支払情報引用"
            >
              支払情報引用
            </button>
          </div>
          {/* 支払情報カード（支払先・日付・備考） */}
          <CollapsibleCard
            title="支払情報"
            open={isPaymentSanctionOpen}
            onOpenChange={setIsPaymentSanctionOpen}
            headerActions={
              <>
                {/* 未着請求書有（参照専用・非活性） */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="unarrived-invoice"
                    className={`${FORM_LABEL_CLASS} whitespace-nowrap`}
                  >
                    未着請求書有
                  </label>
                  {/* 拡売費一覧の「計画なし・計画漏れ」列と同じデザイン（accent-blue-600） */}
                  <input
                    id="unarrived-invoice"
                    type="checkbox"
                    className="w-4 h-4 accent-blue-600"
                    checked={HAS_UNARRIVED_INVOICE}
                    disabled
                  />
                </div>
                {/* 根拠資料格納（未着請求書有との間隔は全角2文字分＝2rem。
                    ヘッダー操作の並びが gap-2＝0.5rem のため ml-6 を足す）。
                    押下で支払根拠資料ペイン（根拠資料表示タブ）を開く */}
                <button
                  type="button"
                  className="btn-toolbar-outline ml-6"
                  onClick={handleStoreEvidence}
                  aria-label="根拠資料格納"
                >
                  <ReceiptText className="h-4 w-4" />
                  根拠資料格納
                </button>
              </>
            }
          >
            <div className="p-4">
              {/* 1行目: 支払先 / ステータス */}
              <div className="grid grid-cols-4 gap-3 mb-2 pb-3 border-b border-gray-300">
                {/* 支払先（コード/名称で検索する単一選択・2列分結合） */}
                <div className="flex items-center gap-2 col-span-2">
                  <label
                    htmlFor="payment-destination"
                    className={`${FORM_LABEL_CLASS} whitespace-nowrap w-36 text-right`}
                  >
                    支払先
                    <RequiredBadge />
                  </label>
                  <div className="w-64">
                    <SingleCombobox
                      id="payment-destination"
                      ariaRequired
                      options={PAYMENT_DESTINATION_PANE_OPTIONS}
                      value={paymentDestination}
                      onChange={setPaymentDestination}
                      placeholder="コード または 名称で検索..."
                    />
                  </div>
                </div>
                {/* ステータス（右にコメント履歴ボタン） */}
                <div className="flex items-center gap-2 col-span-2">
                  <label
                    className={`${FORM_LABEL_CLASS} whitespace-nowrap w-36 text-right`}
                  >
                    ステータス
                  </label>
                  <span className="h-8 flex items-center text-sm text-gray-900">
                    {status}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCommentPanelOpen(true)}
                    className="btn-toolbar-outline ml-8"
                    aria-label="コメント履歴"
                  >
                    <History className="h-4 w-4" />
                    コメント履歴
                  </button>
                </div>
              </div>

              {/* 2行目: 発生日 / 計上月 / 支払予定日 */}
              <div className="grid grid-cols-4 gap-3 mb-2 pb-3 border-b border-gray-300">
                {/* 発生日（カレンダー付） */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="occurrence-date"
                    className={`${FORM_LABEL_CLASS} whitespace-nowrap w-36 text-right`}
                  >
                    発生日
                  </label>
                  <div className="w-[9.375rem] relative">
                    <Input
                      id="occurrence-date"
                      className={`${TEXT_INPUT_CLASS} text-gray-900 pr-9 w-full`}
                      value={occurrenceDateInput}
                      onChange={(e) =>
                        handleOccurrenceDateInputChange(e.target.value)
                      }
                      placeholder="yyyy/MM/dd"
                    />
                    <Popover
                      open={isOccurrenceDateOpen}
                      onOpenChange={setIsOccurrenceDateOpen}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
                          aria-label="発生日カレンダーを開く"
                          title="カレンダーを開く"
                          onClick={() =>
                            setIsOccurrenceDateOpen(!isOccurrenceDateOpen)
                          }
                        >
                          <CalendarIcon className="h-4 w-4 text-gray-500" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={occurrenceDate}
                          onSelect={handleOccurrenceDateSelect}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* 計上月（年月ピッカー） */}
                <div className="flex items-center gap-2">
                  <label
                    className={`${FORM_LABEL_CLASS} whitespace-nowrap w-36 flex items-center justify-end shrink-0`}
                  >
                    計上月
                    <RequiredBadge />
                  </label>
                  <MonthYearPicker
                    value={accountingDateInput}
                    onChange={handleAccountingMonthChange}
                    required
                    className="w-[9.375rem]"
                  />
                </div>

                {/* 支払予定日（カレンダー付） */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="payment-schedule-date"
                    className={`${FORM_LABEL_CLASS} whitespace-nowrap w-36 flex items-center justify-end shrink-0`}
                  >
                    支払予定日
                    <RequiredBadge />
                  </label>
                  <div className="w-[9.375rem] relative">
                    <Input
                      id="payment-schedule-date"
                      aria-required="true"
                      className={`${TEXT_INPUT_CLASS} text-gray-900 pr-9 w-full`}
                      value={paymentScheduleDateInput}
                      onChange={(e) =>
                        handlePaymentDateInputChange(e.target.value)
                      }
                      placeholder="yyyy/MM/dd"
                    />
                    <Popover
                      open={isPaymentDateOpen}
                      onOpenChange={setIsPaymentDateOpen}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
                          aria-label="支払予定日カレンダーを開く"
                          title="カレンダーを開く"
                          onClick={() =>
                            setIsPaymentDateOpen(!isPaymentDateOpen)
                          }
                        >
                          <CalendarIcon className="h-4 w-4 text-gray-500" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={paymentScheduleDate}
                          onSelect={handlePaymentDateSelect}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div />
              </div>

              {/* 3行目: 申請日 / 申請事業場 / 申請部署 / 申請者 */}
              <div className="grid grid-cols-4 gap-3 mb-2 pb-3 border-b border-gray-300">
                {renderLabelField('申請日', applicationDate)}
                {renderLabelField('申請事業場', applicantOffice)}
                {renderLabelField('申請部署', applicantDept)}
                {renderLabelField('申請者', applicant)}
              </div>

              {/* 4行目: 備考（最終行のため下区切り罫線なし） */}
              <div className="flex items-center gap-2">
                <label
                  className={`${FORM_LABEL_CLASS} whitespace-nowrap w-36 text-right`}
                >
                  備考
                </label>
                <Input
                  className={`${TEXT_INPUT_CLASS} flex-1 text-gray-900`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
          </CollapsibleCard>

          {/* 支払明細情報カード（経費明細／ロケ契約料前払金グリッド） */}
          <CollapsibleCard
            title="支払明細情報"
            open={isPaymentDetailOpen}
            onOpenChange={setIsPaymentDetailOpen}
          >
            {/* 上段＝合計金額サマリーバー＋グリッド切替トグル／下段＝明細追加 */}
            <div className="flex flex-col gap-2 px-3 pt-3 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
                  <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
                    合計金額
                  </span>
                  <div className="flex items-stretch divide-x divide-gray-200">
                    {summaryItems.map((item) => (
                      <div
                        key={item.label}
                        className="flex w-40 flex-col items-end px-3"
                      >
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {item.label}
                        </span>
                        <span
                          className={`text-sm font-bold whitespace-nowrap ${
                            item.emphasize ? 'text-blue-700' : 'text-gray-900'
                          }`}
                        >
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* グリッド切替（経費明細／ロケ契約料前払金）：合計金額バーの右端・下揃え */}
                <div className="ml-auto self-end flex w-fit overflow-hidden rounded-lg border-2 border-blue-600">
                  <button
                    type="button"
                    onClick={() => setDetailGridView('payment')}
                    aria-pressed={detailGridView === 'payment'}
                    className={toggleButtonClass(
                      detailGridView === 'payment',
                      true
                    )}
                  >
                    経費明細
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailGridView('prepayment')}
                    aria-pressed={detailGridView === 'prepayment'}
                    className={toggleButtonClass(
                      detailGridView === 'prepayment'
                    )}
                  >
                    ロケ契約料前払金
                  </button>
                </div>
              </div>

              {/* 下段・右端：＋明細追加（ラベルは表示中グリッドで切り替える） */}
              <div className="ml-auto flex items-center gap-2">
                <button
                  className="btn-toolbar-outline"
                  onClick={handleAddClick}
                  aria-label={
                    detailGridView === 'prepayment'
                      ? '＋前払金明細追加'
                      : '＋経費明細追加'
                  }
                >
                  {detailGridView === 'prepayment'
                    ? '＋前払金明細追加'
                    : '＋経費明細追加'}
                </button>
              </div>
            </div>

            <div
              className="expense-item-grid w-full px-3 pt-0 pb-2"
              // 高さはリサイズハンドルで調整した値（JS動的値のため inline style）
              style={{ height: detailResize.height }}
            >
              <AgGridReact
                // グリッド切替で列構成・列状態が変わるため、view 切替時は再マウントして
                // 列定義／列状態の保存キーをクリーンに差し替える。
                key={detailGridView}
                ref={gridRef}
                rowData={detailRowData}
                columnDefs={
                  detailGridView === 'payment'
                    ? columnDefsWithTooltip
                    : prepaymentColumnDefsWithTooltip
                }
                defaultColDef={GRID_DEFAULT_COL_DEF}
                // 左端はデータのID列（先頭列）を表示するため行番号列は無効化
                rowNumbers={false}
                // 分割先行は行全体のハイライトを付けず、各セルの cellStyle に委ねる
                // （分割元行と背景を揃えるため）
                getContextMenuItems={gridFilterContextMenuItems}
                getRowId={getRowId}
                onCellValueChanged={handleCellValueChanged}
                stopEditingWhenCellsLoseFocus={true}
                statusBar={GRID_STATUS_BAR}
                // ソート時も分割元の直下に分割先を並べる（AG Grid公式 postSortRows）
                postSortRows={handlePostSortRows}
                // 折り畳み中の分割グループの分割先行を隠す（AG Grid公式 外部フィルター）
                isExternalFilterPresent={isExternalFilterPresent}
                doesExternalFilterPass={doesExternalFilterPass}
                // 列状態の保存／復元（共通フック）。グリッド毎に別キー。
                {...(detailGridView === 'payment'
                  ? expenseGridColumnStateProps
                  : prepaymentGridColumnStateProps)}
                // 共通基本プロパティ（Enter縦移動・テキスト選択／grid/）
                {...GRID_BASE_PROPS}
                context={detailGridContext}
              />
            </div>

            {/* リサイズハンドル：上下ドラッグでカード本体（明細グリッド）の高さを調整する。
                計画詳細(NET固定)＝ PlanAggregationPane と同じ共通部品を使う */}
            <div className="relative h-2">
              <ResizeHandle onMouseDown={detailResize.handleMouseDown} />
            </div>
          </CollapsibleCard>
        </div>

        {/* 引用元選択ペイン（下ペイン）：「支払情報引用」ボタンで開く。 */}
        <BottomPane
          open={isQuoteSourcePaneOpen}
          onClose={() => setIsQuoteSourcePaneOpen(false)}
          title="引用元選択"
          initialHeight={40}
          minHeight={20}
          maxHeight={56}
          headerActions={
            // 引用：選択した引用元の内容を当画面へ取り込む（当ペインの確定操作）。
            // DB更新を伴う確定系のため塗り青（→ 01・02 §10.2）。
            // 高さはタイトル（text-lg＝行高 1.75rem）と同じ h-7 に抑え、ボタンを置いても
            // ヘッダーが既定の高さのままになるようにする（btn-action-base は 2.25rem のため使わない）。
            <button
              className={`${BUTTON_STYLES.primary} ${BUTTON_BASE} inline-flex h-7 items-center gap-2 px-3 text-sm font-medium whitespace-nowrap`}
              onClick={handleApplyQuoteSource}
              aria-label="引用"
            >
              引用
            </button>
          }
        >
          <div className="p-3">
            <div className="grid grid-cols-4 gap-3">
              {/* 対象年月（引用元は当画面の対象年月に固定のため入力不可） */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="quote-source-target-month"
                  className={`${FORM_LABEL_CLASS} whitespace-nowrap w-36 text-right`}
                >
                  対象年月
                </label>
                <MonthYearPicker
                  id="quote-source-target-month"
                  value={QUOTE_SOURCE_TARGET_MONTH}
                  onChange={() => {}}
                  disabled
                  className="w-[9.375rem]"
                />
              </div>

              {/* 支払No（引用元が定まると自動で決まるため入力不可） */}
              {renderLabelField('支払No', QUOTE_SOURCE_PAYMENT_NO)}

              {/* 支払回数 */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="quote-source-round"
                  className={`${FORM_LABEL_CLASS} whitespace-nowrap w-36 text-right`}
                >
                  支払回数
                </label>
                <SingleCombobox
                  id="quote-source-round"
                  className="w-20"
                  options={[
                    ...QUOTE_SOURCE_ROUND_OPTIONS.map((round) => ({
                      value: round,
                      label: round,
                    })),
                  ]}
                  value={quoteSourceRound}
                  onChange={setQuoteSourceRound}
                  placeholder="選択"
                  searchable={false}
                />
              </div>
            </div>

            {/* 引用元の支払情報（参照専用）。選択した対象年月・支払回数の内容を表示する。 */}
            <CollapsibleCard title="支払情報" className="mt-3">
              <div className="p-4">
                {/* 1行目: 支払先 / 発生日 / 支払予定日 */}
                <div className="grid grid-cols-4 gap-3 mb-2 pb-3 border-b border-gray-300">
                  {renderLabelField('支払先', quoteSource.destination)}
                  {renderLabelField('発生日', quoteSource.occurrenceDate)}
                  {renderLabelField('支払予定日', quoteSource.scheduledDate)}
                  <div />
                </div>

                {/* 2行目: 備考（最終行のため下区切り罫線なし） */}
                {renderLabelField('備考', quoteSource.note)}
              </div>
            </CollapsibleCard>

            {/* 引用元の支払明細（参照専用）。列構成は経費明細グリッドと同じ。 */}
            <CollapsibleCard title="支払明細情報" className="mt-3">
              <div className="expense-item-grid w-full px-3 py-3 h-[18.75rem]">
                <AgGridReact
                  rowData={quoteSource.expenseData}
                  columnDefs={quoteSourceColumnDefsWithTooltip}
                  defaultColDef={GRID_DEFAULT_COL_DEF}
                  // 左端はデータのID列（先頭列）を表示するため行番号列は無効化
                  rowNumbers={false}
                  getRowId={getRowId}
                  statusBar={GRID_STATUS_BAR}
                  // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）
                  {...quoteSourceGridColumnStateProps}
                  // 共通基本プロパティ（Enter縦移動・テキスト選択／grid/）
                  {...GRID_BASE_PROPS}
                />
              </div>
            </CollapsibleCard>
          </div>
        </BottomPane>

        {/* コメント履歴ペイン（右ペイン）。操作・ステータス・体裁は他の支払詳細と共通。 */}
        <CommentHistoryPane
          open={commentPanelOpen}
          onClose={() => setCommentPanelOpen(false)}
        />

        {/* 明細削除確認ダイアログ */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>明細削除</DialogTitle>
              <DialogDescription>
                {deleteTargetHasDestRows
                  ? '選択した明細と、紐づく分割先の明細をすべて削除します。よろしいですか？'
                  : '選択した明細を削除してもよろしいですか？'}
              </DialogDescription>
            </DialogHeader>
            {deleteTarget && (
              <div className="py-4">
                <p className="text-sm text-gray-600">
                  <strong>経費項目:</strong>{' '}
                  {deleteTarget.expenseItem || '（未設定）'}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>金額 (円):</strong> {deleteTarget.amount}
                </p>
              </div>
            )}
            <DialogFooter>
              {/* 閉じる操作は右上×（DialogContent標準）に統一する */}
              <Button
                variant="destructive"
                className="rounded-lg"
                onClick={handleConfirmDelete}
              >
                削除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* フッターエリア（画面下部に固定）。
          data-screen-footer は下ペインがこのバーの上へドックするための目印。 */}
      <div
        data-screen-footer
        className="bg-white border-t border-gray-200 px-6 py-2 sticky bottom-0 z-10 mt-4 min-w-[75rem]"
      >
        <div className="flex flex-wrap gap-3 justify-between">
          <div className="flex flex-wrap gap-3">
            <button
              className="btn-action-base btn-action-outline"
              onClick={() => setPendingNavigation('paymentList')}
              aria-label="一覧へ戻る"
            >
              <Undo2 className="h-4 w-4" />
              一覧へ戻る
            </button>
            {/* 次の伝票へ：一覧の次の支払伝票へ送るためのボタン。
                現時点では画面遷移は行わない（表示のみ）。 */}
            <button
              type="button"
              className="btn-action-base btn-action-outline"
              aria-label="次の伝票へ"
            >
              <ArrowRight className="h-4 w-4" />
              次の伝票へ
            </button>
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
            {/* 支払無しとコメント欄の間は全角4文字分（4rem）あける */}
            <div className="flex min-w-0 items-center gap-[4rem]">
              {/* 支払無し：当月は支払が発生しない伝票にする。理由は備考欄へ書く
                  （→ 20260724_第23回_共通 決定事項8）。 */}
              <button
                type="button"
                onClick={() => setIsNoPayment((prev) => !prev)}
                className="btn-action-base btn-action-outline"
                aria-label={isNoPayment ? '支払無しを解除' : '支払無しにする'}
                title="当月は支払が発生しない伝票にします。理由は備考欄へ入力してください"
              >
                <Ban className="h-4 w-4" />
                {isNoPayment ? '支払無しを解除' : '支払無し'}
              </button>
              {/* コメント欄（差戻し理由など） */}
              <div className="flex min-w-0 items-center gap-2">
                <label
                  htmlFor="approval-comment"
                  className="text-sm text-gray-600 whitespace-nowrap"
                >
                  コメント
                </label>
                <textarea
                  id="approval-comment"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="コメントを入力（差戻し理由など）"
                  rows={2}
                  className="h-10 w-[24rem] min-w-[10rem] max-w-[32rem] border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
                />
              </div>
            </div>
            <button
              className="btn-action-base btn-action-red"
              onClick={() => setConfirmAction('reject')}
              aria-label="差戻し"
            >
              <CornerUpLeft className="h-4 w-4" />
              差戻し
            </button>
            <button
              className="btn-action-base btn-action-green"
              onClick={() => setConfirmAction('approve')}
              aria-label="承認"
            >
              <Check className="h-4 w-4" />
              承認
            </button>
            <button
              className="btn-action-base btn-action-green"
              onClick={() => setConfirmAction('seal')}
              aria-label="検印"
            >
              <Stamp className="h-4 w-4" />
              検印
            </button>
            <button
              className="btn-action-base btn-action-outline-blue"
              onClick={() => setConfirmAction('withdraw')}
              aria-label="引戻し"
            >
              <CornerUpLeft className="h-4 w-4" />
              引戻し
            </button>
            <button
              className="btn-action-base btn-action-green"
              onClick={() => setConfirmAction('apply')}
              aria-label="申請"
            >
              <Send className="h-4 w-4" />
              申請
            </button>
            <button
              className="btn-action-base btn-action-blue"
              onClick={handleSave}
              aria-label="保存"
            >
              <Save className="h-4 w-4" />
              保存
            </button>
          </div>
        </div>
      </div>

      {/* 支払回数の切替・追加の確認ポップアップ（支払詳細の各画面で共通）。
          「はい」で入力中の内容を破棄し、対象の回の保存内容を表示する
          （→ 20260804_第26回 決定事項23・24）。 */}
      <PaymentRoundConfirmDialog
        pending={rounds.pending}
        onConfirm={handleConfirmRound}
        onCancel={rounds.cancelPending}
      />

      {/* 画面遷移の確認ダイアログ（一覧へ戻る／販売計画書No リンクで共用）。
          文言は遷移先ごとに NAVIGATION_CONFIRM_MAP から取る。 */}
      <AlertDialog
        open={pendingNavigation !== null}
        onOpenChange={(open) => {
          if (!open) setPendingNavigation(null);
        }}
      >
        <AlertDialogContent>
          {/* ×ボタン */}
          <button
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
            onClick={() => setPendingNavigation(null)}
            aria-label="閉じる"
          >
            <X className="size-6" />
            <span className="sr-only">Close</span>
          </button>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-gray-900">
              画面遷移の確認
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingNavigation
                ? NAVIGATION_CONFIRM_MAP[pendingNavigation].description
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
              onClick={handleNavigationConfirm}
            >
              移動
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 支払確認ダイアログ（申請／引戻し／承認／検印／差戻し共通。文言は CONFIRM_MESSAGE_MAP） */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          {/* ×ボタン */}
          <button
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
            onClick={() => setConfirmAction(null)}
            aria-label="閉じる"
          >
            <X className="size-6" />
            <span className="sr-only">Close</span>
          </button>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-gray-900">
              {confirmAction ? CONFIRM_MESSAGE_MAP[confirmAction].title : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction
                ? CONFIRM_MESSAGE_MAP[confirmAction].description
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className={`${
                confirmAction
                  ? CONFIRM_MESSAGE_MAP[confirmAction].buttonClass
                  : ''
              } text-white rounded-lg`}
              onClick={handleConfirmAction}
            >
              {confirmAction ? CONFIRM_MESSAGE_MAP[confirmAction].button : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 支払根拠資料（右ペイン）。根拠資料表示・登録をタブで切り替える統合ペイン。
          表示対象・登録先は現在表示中の支払回（invoiceCount）の根拠資料。 */}
      <EvidenceUploadPane
        open={evidencePaneOpen}
        onOpenChange={setEvidencePaneOpen}
        openNonce={evidencePaneNonce}
        defaultTab={evidencePaneDefaultTab}
        paymentSlipNo={PAYMENT_NO}
        paymentRound={Number(invoiceCount)}
        evidenceFiles={evidenceFilesByRound[invoiceCount] ?? []}
        status={evidenceStatus}
        role={EVIDENCE_USER_ROLE}
        onUpdateFile={handleUpdateEvidence}
        onDeleteFile={handleDeleteEvidence}
        onTimestamped={handleEvidenceTimestamped}
        onRegister={handleRegisterEvidence}
      />
    </div>
  );
}
