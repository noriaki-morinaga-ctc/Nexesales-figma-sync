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
} from 'react';
import { ReceiptText, Plus } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  CellValueChangedEvent,
  PostSortRowsParams,
  IRowNode,
  GetRowIdParams,
} from 'ag-grid-community';
import { toast } from 'sonner';
import {
  useGridColumnState,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  withHeaderTooltips,
  gridFilterContextMenuItems,
  GRID_COLORS,
  useChangedCells,
  useLinkedCellUndo,
  useRevealNewRows,
  GRID_NO_FILTER_COLUMN_TYPES,
  CellColorLegend,
  viewportGridHeight,
} from '@/app/components/grid';
import { FORM_LABEL_CLASS, TEXT_INPUT_CLASS } from '@/styles/commonStyles';
import { RequiredBadge } from '@/app/components/ui/required-badge';
import { SingleCombobox } from '@/app/components/ui/single-combobox';

import { Input } from '@/app/components/ui/input';
import { MonthYearPicker } from '@/app/components/ui/month-year-picker';

import { CollapsibleCard } from '@/app/components/ui/collapsible-card';
import {
  useResizableHeight,
  ResizeHandle,
} from '@/app/components/ui/resizable-panel';

// コメント履歴（右ペイン）。支払詳細の各画面で共通の履歴・体裁を使う。
import { CommentHistoryPane } from '@/app/components/shared/common/CommentHistoryPane';
// 支払回数の切替・追加（支払詳細の各画面で共通）。
import { usePaymentRounds } from '@/app/components/shared/payment/payment-detail/usePaymentRounds';
import { PaymentRoundConfirmDialog } from '@/app/components/shared/payment/payment-detail/PaymentRoundConfirmDialog';

// 支払根拠資料ペイン（根拠資料表示・登録の統合ペイン）と、その表示用モック画像。
import {
  EvidenceUploadPane,
  type EvidenceTab,
  type RegisteredEvidence,
} from './components/EvidenceUploadPane';
import {
  type EvidenceFile,
  type PaymentStatus,
  type ReceiptFormat,
} from './components/EvidenceViewerPane';
import { ScreenTitle } from '@/app/components/ui/screen-title';
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog';
import type {
  ConfirmAction,
  NavigationTarget,
  ExpenseItemData,
  ExpenseSummaryData,
  PaymentRoundData,
} from './paymentDetailVending.types';
import {
  CONFIRM_MESSAGE_MAP,
  NAVIGATION_CONFIRM_MAP,
  AMORTIZATION_INFO_COL_IDS,
  AMORTIZATION_JOURNAL_COL_IDS,
  PAYMENT_DESTINATION_PANE_OPTIONS,
  SUMMARY_CARD_DEFAULT_HEIGHT,
  SUMMARY_CARD_MIN_HEIGHT,
  DETAIL_GRID_OFFSET_REM,
  PAYMENT_ROUND_OPTIONS,
  NON_EDITABLE_CELL_BG,
  ID_COLUMN_DEF,
  DETAIL_COLOR_LEGEND,
  SPLIT_COLLAPSE_COLUMN_DEF,
} from './constants';
import {
  isExpenseSectionRow,
  isExpenseAggregateRow,
  deriveManagementCodeDeps,
} from './utilsMaster';
import {
  HAS_UNARRIVED_INVOICE,
  OWN_COST_BEARING_DEPT,
  BASIC_INFO_CREATOR,
  BASIC_INFO_SALES_STORE,
  BASIC_INFO_TERTIARY_STORE,
  BASIC_INFO_PRIMARY_STORE,
  PAYMENT_NO,
  INITIAL_EVIDENCE_FILES_BY_ROUND,
  EVIDENCE_USER_ROLE,
  QUOTE_SOURCE_ROUND_OPTIONS,
  QUOTED_ACCOUNTING_MONTH,
  QUOTED_PAYMENT_SCHEDULE_DATE,
  QUOTE_SOURCE_BY_ROUND,
  SPLIT_FROM_OTHER_INITIAL_DATA,
  INITIAL_ROUND,
} from '@/mocks/payment/payment-detail-vending/paymentDetail';

import {
  isExpenseAlertRow,
  isSplitDestRow,
  groupColumnsByIds,
  parseDateString,
  buildTotalSummaryItems,
  splitGroupInsertInfo,
  copyRows,
  createEmptyRound,
} from './utilsRows';
import {
  buildDetailColumnDefs,
  buildPrepaymentColumnDefs,
  buildSplitFromOtherColumnDefs,
} from './utilsDetailColumns';
import { buildSummaryData, buildSummaryColumnDefs } from './utilsSummary';
import { LabelField } from './components/LabelField';
import { BasicInfoCard } from './components/BasicInfoCard';
import { PaymentRoundBar } from './components/PaymentRoundBar';
import { QuoteSourcePane } from './components/QuoteSourcePane';
import { DeleteDetailDialog } from './components/DeleteDetailDialog';
import { PaymentDetailFooter } from './components/PaymentDetailFooter';
import { paymentFooterActionStateOf } from '@/app/utils/payment/payment-detail/paymentFooterActions';
import { SegmentToggle } from '@/app/components/shared/common/SegmentToggle';
import { DateMonthYearPicker } from '@/app/components/ui/date-month-year-picker';
import { useAppNavigation } from '@/app/components/ui/use-app-navigation';

export default function PaymentDetailVending() {
  // 画面の切り替え（→ ui/use-app-navigation）
  const navigate = useAppNavigation();
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
  const [isCommentPanelOpen, setIsCommentPanelOpen] = useState(false);
  const [commentInput, setCommentInput] = useState('');

  // ===== 支払根拠資料ペイン（根拠資料表示・登録の統合ペイン） =====
  // 開閉と、開いたときに表示するタブ。折り畳み中（付箋）にボタンを押した場合も
  // 展開し直す必要があるため、open が true のままでも nonce を進めてペインへ伝える。
  const [isEvidencePaneOpen, setIsEvidencePaneOpen] = useState(false);
  const [evidencePaneNonce, setEvidencePaneNonce] = useState(0);
  const [evidencePaneDefaultTab, setEvidencePaneDefaultTab] =
    useState<EvidenceTab>('表示');
  // 根拠資料の実体（支払回数ごと）。
  // 登録・編集・削除の結果を保つため、定数ではなく状態として持つ。
  // 請求書の未着・回収予定日は支払回単位ではなく資料（EvidenceFile）単位で持つ（2026-09-08 回答A-6）。
  const [evidenceFilesByRound, setEvidenceFilesByRound] = useState(
    INITIAL_EVIDENCE_FILES_BY_ROUND
  );

  // ===== 日付入力（YYYY/MM/DD の文字列で保持。入力欄は共通部品 DateMonthYearPicker → UX-067） =====
  // 支払予定日
  const [paymentScheduleDateInput, setPaymentScheduleDateInput] = useState(
    INITIAL_ROUND.paymentScheduleDateInput
  );

  // 発生日
  const [occurrenceDateInput, setOccurrenceDateInput] = useState(
    INITIAL_ROUND.occurrenceDateInput
  );

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
  // フッターのボタンの活性（手売りの支払詳細と同じくステータスで決める。UI/UX UX-072）。
  // 支払無しを押した回は、ステータスを「支払無し」として扱う。
  const footerActions = paymentFooterActionStateOf(
    isNoPayment ? '支払無し' : status
  );
  // 戻る確認
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null); // 申請/承認等の確認

  // 引用明細選択ペイン（下ペイン）の開閉と入力値。「支払情報引用」ボタンで開く。
  const [isQuoteSourcePaneOpen, setIsQuoteSourcePaneOpen] = useState(false);
  const [quoteSourceRound, setQuoteSourceRound] = useState(
    QUOTE_SOURCE_ROUND_OPTIONS[0]
  );
  // 選択中の支払回数に対応する引用元（表示・引用の双方で参照する）。
  const quoteSource =
    QUOTE_SOURCE_BY_ROUND[quoteSourceRound] ?? QUOTE_SOURCE_BY_ROUND['1'];

  // 各カードの折り畳み状態（いずれも既定は展開）
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

  // 支払明細情報カードのグリッド表示切替（青枠ボタン群）。
  // 'payment'＝経費明細グリッド／'prepayment'＝ロケ契約料前払金グリッド。
  const [detailGridView, setDetailGridView] = useState<
    'payment' | 'prepayment'
  >('payment');

  // テキスト直接入力の反映（日付として解釈できたときのみ Date 側を更新する）。
  const handlePaymentDateInputChange = (value: string) => {
    setPaymentScheduleDateInput(value);
  };

  const handleOccurrenceDateInputChange = (value: string) => {
    setOccurrenceDateInput(value);
  };

  // 計上月（年月 YYYY/MM）を選択したときに、表示用の文字列を更新する。
  const handleAccountingMonthChange = (value: string) => {
    setAccountingDateInput(value);
  };

  // ===== フッター操作（保存・戻る・申請/承認等） =====

  // 必須の項目（管理区分・管理コード・支払金額）が空の明細があるか。保存・申請の前に確かめ、
  // あればメッセージを出して止める（セルは赤の破線枠で示す。手売りと同じ → 02 §7「入力値のチェック」・UX-089）。
  const hasMissingRequired = (): boolean => {
    const api = gridRef.current?.api;
    if (!api) return false;
    let missing = false;
    api.forEachNode((node) => {
      const d = node.data as ExpenseItemData | undefined;
      if (!d || missing) return;
      const isDest = d.splitRole === 'dest';
      const category = isDest ? d.splitDestMgmtCategory : d.managementCategory;
      const code = isDest ? d.splitDestMgmtCode : d.managementCode;
      const amount = isDest ? d.splitAmount : d.amount;
      if (!category || !code || String(amount ?? '').trim() === '')
        missing = true;
    });
    if (missing)
      toast.error(
        '管理区分・管理コード・金額が未入力の明細があります。赤枠のセルを入力してください。'
      );
    return missing;
  };

  const handleSave = () => {
    if (hasMissingRequired()) return;
    // TODO: 支払データの保存処理（API連携・未実装）
    // 保存確定で編集セルの変更ハイライトをクリアする（両グリッド分／→ 02 §7.2）
    paymentChangedCells.resetChangedCells();
    prepaymentChangedCells.resetChangedCells();
    // 保存確定で連動セル（管理区分→管理コード）のキャッシュも破棄する（→ 02 §7.3）
    clearLinkedCellCache();
    gridRef.current?.api?.refreshCells({ force: true });
    toast.success('保存が完了しました。');
  };

  // 画面遷移の確定 → 編集中の内容を破棄して対象画面へ遷移する。
  const handleNavigationConfirm = () => {
    if (!pendingNavigation) return;
    const { menuId } = NAVIGATION_CONFIRM_MAP[pendingNavigation];
    setPendingNavigation(null);
    navigate(menuId);
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

  // 見出しの開閉ボタン：指定の分割元をまとめて閉じる（collapse=true）／開く（→ SplitCollapseHeader・UX-088）。
  const handleSetSplitGroupsCollapsed = useCallback(
    (sourceIds: string[], collapse: boolean) => {
      setCollapsedSplitGroups((prev) =>
        collapse
          ? [...new Set([...prev, ...sourceIds])]
          : prev.filter((id) => !sourceIds.includes(id))
      );
    },
    []
  );

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
    // 見出しのまとめて開閉ボタンの向きも描き直す
    api.refreshHeader();
  }, [collapsedSplitGroups]);

  // 分割行の追加・削除で開閉ボタンの有無が変わる。開閉の列はセルの値が無く
  // 自動では再描画されないため、明細の増減に合わせて明示的に再描画する。
  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    api.refreshCells({ columns: ['splitCollapse'], force: true });
    api.refreshHeader();
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
      setOccurrenceDateInput(data.occurrenceDateInput);
      setAccountingDateInput(data.accountingDateInput);
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
    setIsEvidencePaneOpen(true);
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

  // 引用明細選択ペインの「引用」押下：引用元の支払情報・支払明細を、
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

  // 管理区分 → 管理コード（連動セル）。管理コードは node.data 直接更新で反映し、
  // Undo/Redo は主セル（管理区分）1回で管理コードごと戻る（→ 02 §7.3）。
  // 管理区分を編集できるのは支払明細グリッドだけのため、state の同期先は expenseData とする。
  const {
    makeHandler: makeLinkedCellHandler,
    clearCache: clearLinkedCellCache,
  } = useLinkedCellUndo<ExpenseItemData>();
  const handleManagementCategoryChanged = useMemo(
    () =>
      makeLinkedCellHandler('managementCategory', {
        depFields: ['managementCode', 'splitDestMgmtCode'],
        deriveDeps: deriveManagementCodeDeps,
        syncState: (row) =>
          setExpenseData((prev) =>
            prev.map((item) =>
              item.id === row.id ? { ...item, ...row } : item
            )
          ),
      }),
    [makeLinkedCellHandler]
  );
  // 行の作り直し（行の追加・分割・コピー・削除・支払回の切替）で Undo 履歴が消えるため、
  // 連動セルのキャッシュも破棄する（→ 02 §7.3）。
  useEffect(() => {
    clearLinkedCellCache();
  }, [detailRowStructureSignature, clearLinkedCellCache]);

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
    () => buildDetailColumnDefs(handleManagementCategoryChanged),
    // 連動セルのハンドラは参照が固定（useLinkedCellUndo の makeHandler）のため列は再生成されない
    [handleManagementCategoryChanged]
  );

  // 経費明細グリッドの列状態（列幅・並び順・ソート）の保存／復元（共通フック）。
  // ※ 列の追加・削除・並び替え・グループ化を行ったら、保存キー末尾の版番号を必ず上げる
  //   （旧 localStorage の列状態を復元すると新列が末尾に回る・削除済み列が残るため）。
  //   本ファイルの各グリッドで共通のルール。
  const expenseGridColumnStateProps = useGridColumnState(
    'paymentApproval.expenseItem.columnState.v28'
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
  const summaryData: ExpenseSummaryData[] = useMemo(
    () =>
      buildSummaryData(
        allRoundsExpenseData,
        allRoundsPrepaymentData,
        summaryAmountUnit
      ),
    [allRoundsExpenseData, allRoundsPrepaymentData, summaryAmountUnit]
  );

  // 管理項目別合計値グリッドの列定義
  const summaryColumnDefs: ColDef[] = useMemo(
    () => buildSummaryColumnDefs(amountHeaderColDef),
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
    () =>
      withHeaderTooltips([
        SPLIT_COLLAPSE_COLUMN_DEF,
        ID_COLUMN_DEF,
        ...columnDefs,
      ]),
    [columnDefs]
  );

  // 引用明細選択ペインの支払明細情報グリッド。経費明細の列から右端アクション列を除いて
  // 流用し、引用元の参照専用のため全列を入力不可（グレー背景）にする。
  const quoteSourceColumnDefsWithTooltip = useMemo(
    () =>
      withHeaderTooltips([
        ID_COLUMN_DEF,
        ...columnDefs
          .filter((col) => col.colId !== 'actions')
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
  const prepaymentColumnDefs = useMemo<ColDef[]>(
    () => buildPrepaymentColumnDefs(columnDefs),
    [columnDefs]
  );

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
  const splitFromOtherColumnDefsWithTooltip = useMemo(
    () => buildSplitFromOtherColumnDefs(columnDefs),
    [columnDefs]
  );

  // 当グリッドも経費明細の columnDefs を流用するため、そちらの列変更でも版番号を上げる。
  const splitFromOtherGridColumnStateProps = useGridColumnState(
    'paymentApproval.splitFromOther.columnState.v23'
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
      onSetSplitGroupsCollapsed: handleSetSplitGroupsCollapsed,
    }),
    [
      detailGridView,
      handleSplitRow,
      handleCopyRow,
      handleDeleteRow,
      detailChangedCells,
      collapsedSplitGroups,
      handleToggleSplitGroup,
      handleSetSplitGroupsCollapsed,
    ]
  );

  return (
    <div className="min-w-300">
      <div className="px-6 pt-3 pb-0">
        {/* 画面名はヘッダー（システム名の右）に表示する */}
        <ScreenTitle title="支払詳細(自販機)" />

        {/* 基本情報カード（参照専用・行ごとに下線で区切る） */}
        <BasicInfoCard onSalesPlanNoClick={handleSalesPlanNoClick} />
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
            <SegmentToggle
              ariaLabel="支払情報サマリの表示"
              className="w-fit"
              options={[
                { value: 'summary', label: '管理項目別合計値' },
                {
                  value: 'split-from-other',
                  label: '他部門から分割/振替された経費明細',
                },
              ]}
              value={summaryView}
              onChange={setSummaryView}
            />
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
                {/* 表示単位トグル（円／千円）。金額列のみ千円換算し、列ヘッダーの単位表記も
                    追従させる。グリッド直上に右寄せ配置（支払詳細(追加口請求書有)の
                    支払情報サマリと同じ）。 */}
                <div className="flex items-center justify-end gap-2 mb-2">
                  <label className="text-sm text-blue-900 whitespace-nowrap font-bold">
                    表示単位
                  </label>
                  <SegmentToggle
                    ariaLabel="表示単位"
                    options={[
                      { value: 'yen', label: '円' },
                      { value: 'thousand', label: '千円' },
                    ]}
                    value={summaryAmountUnit}
                    onChange={setSummaryAmountUnit}
                  />
                </div>
                {/* 管理項目別合計値グリッド。
                    高さはリサイズハンドルで調整した値（JS動的値のため inline style） */}
                <div
                  className="expense-summary-grid w-full"
                  style={{ height: summaryResize.height }}
                >
                  {/* 規約例外（集計表）：表示項目（管理区分）ごとの行が決まっている集計表（支払情報サマリ）のため、件数表示（statusBar）は付けない */}
                  <AgGridReact
                    className="grid-summary-table"
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
                    // 先頭の「No.」は列定義の番号の列で出す（→ buildSplitFromOtherColumnDefs）
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
          <PaymentRoundBar
            roundOptions={rounds.options}
            invoiceCount={invoiceCount}
            onSelectRound={rounds.selectRound}
            onAddRound={rounds.requestAddRound}
            onQuotePaymentInfo={handleQuotePaymentInfo}
          />
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
              <div className="grid grid-cols-4 gap-3 mb-2.5 pb-2.5 border-b border-gray-300">
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
                {/* ステータス（コメント履歴はフッターのコメント欄の「履歴」から開く。UI/UX UX-107） */}
                <div className="flex items-center gap-2 col-span-2">
                  <label
                    className={`${FORM_LABEL_CLASS} whitespace-nowrap w-36 text-right`}
                  >
                    ステータス
                  </label>
                  <span className="h-8 flex items-center text-sm text-gray-900">
                    {status}
                  </span>
                </div>
              </div>

              {/* 2行目: 発生日 / 計上月 / 支払予定日 */}
              <div className="grid grid-cols-4 gap-3 mb-2.5 pb-2.5 border-b border-gray-300">
                {/* 発生日（カレンダー付） */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="occurrence-date"
                    className={`${FORM_LABEL_CLASS} whitespace-nowrap w-36 text-right`}
                  >
                    発生日
                  </label>
                  {/* 日付は共通部品（選ぶ・打ち込むの両方ができる → 02 §14・UX-067） */}
                  <DateMonthYearPicker
                    id="occurrence-date"
                    // 発生日は任意の項目のため×で空に戻せるようにする（→ 02 §14.1）
                    clearable
                    value={occurrenceDateInput}
                    onChange={handleOccurrenceDateInputChange}
                  />
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
                  <DateMonthYearPicker
                    id="payment-schedule-date"
                    required
                    value={paymentScheduleDateInput}
                    onChange={handlePaymentDateInputChange}
                  />
                </div>
                <div />
              </div>

              {/* 3行目: 申請日 / 申請事業場 / 申請部署 / 申請者 */}
              <div className="grid grid-cols-4 gap-3 mb-2.5 pb-2.5 border-b border-gray-300">
                <LabelField label="申請日" value={applicationDate} />
                <LabelField label="申請事業場" value={applicantOffice} />
                <LabelField label="申請部署" value={applicantDept} />
                <LabelField label="申請者" value={applicant} />
              </div>

              {/* 4行目: 備考（最終行のため下区切り罫線なし） */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="payment-note"
                  className={`${FORM_LABEL_CLASS} whitespace-nowrap w-36 text-right`}
                >
                  備考
                </label>
                <Input
                  id="payment-note"
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
                <SegmentToggle
                  ariaLabel="支払明細の表示"
                  className="ml-auto w-fit self-end"
                  options={[
                    { value: 'payment', label: '経費明細' },
                    { value: 'prepayment', label: 'ロケ契約料前払金' },
                  ]}
                  value={detailGridView}
                  onChange={setDetailGridView}
                />
              </div>

              {/* 下段・右端：明細追加（ラベルは表示中グリッドで切り替える） */}
              <div className="ml-auto flex items-center gap-2">
                <button
                  className="btn-toolbar-outline"
                  onClick={handleAddClick}
                  aria-label={
                    detailGridView === 'prepayment'
                      ? '前払金明細追加'
                      : '経費明細追加'
                  }
                >
                  <Plus className="h-4 w-4" />
                  {detailGridView === 'prepayment'
                    ? '前払金明細追加'
                    : '経費明細追加'}
                </button>
              </div>
            </div>

            {/* 色の凡例（手売りの支払詳細と同じ部品 → 02 CellColorLegend・UX-084） */}
            <CellColorLegend
              className="mx-3 mb-2"
              items={DETAIL_COLOR_LEGEND}
            />
            <div
              className="expense-item-grid w-full px-3 pt-0 pb-2"
              // 画面のいちばん下の表は、画面いっぱいの高さにする（UX-099 → 05「画面いっぱいのグリッド」）。
              // 最下部までスクロールした状態で表が画面にちょうど収まる高さ。下ペインを開いている間は
              // ペインの高さだけ低くなる（viewportGridHeight）。下端のバーで高さは変えない
              style={{
                height: viewportGridHeight(DETAIL_GRID_OFFSET_REM),
                minHeight: '25rem',
              }}
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
          </CollapsibleCard>
        </div>

        {/* 引用明細選択ペイン（下ペイン）：「支払情報引用」ボタンで開く。 */}
        <QuoteSourcePane
          open={isQuoteSourcePaneOpen}
          onClose={() => setIsQuoteSourcePaneOpen(false)}
          onApply={handleApplyQuoteSource}
          quoteSourceRound={quoteSourceRound}
          onQuoteSourceRoundChange={setQuoteSourceRound}
          quoteSource={quoteSource}
          columnDefs={quoteSourceColumnDefsWithTooltip}
          gridColumnStateProps={quoteSourceGridColumnStateProps}
          getRowId={getRowId}
        />

        {/* コメント履歴ペイン（右ペイン）。操作・ステータス・体裁は他の支払詳細と共通。 */}
        <CommentHistoryPane
          open={isCommentPanelOpen}
          onClose={() => setIsCommentPanelOpen(false)}
        />

        {/* 明細削除確認ダイアログ */}
        <DeleteDetailDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          target={deleteTarget}
          hasDestRows={deleteTargetHasDestRows}
          onConfirm={handleConfirmDelete}
        />
      </div>

      {/* フッターエリア（画面下部に固定）。
          data-screen-footer は下ペインがこのバーの上へドックするための目印。 */}
      <PaymentDetailFooter
        actions={footerActions}
        commentInput={commentInput}
        onCommentInputChange={setCommentInput}
        onOpenHistory={() => setIsCommentPanelOpen(true)}
        isNoPayment={isNoPayment}
        onToggleNoPayment={() => setIsNoPayment((prev) => !prev)}
        onBack={() => setPendingNavigation('paymentList')}
        onConfirmAction={(action) => {
          // 申請の前に必須の項目を確かめる（→ UX-089）
          if (action === 'apply' && hasMissingRequired()) return;
          setConfirmAction(action);
        }}
        onSave={handleSave}
      />

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
      <ConfirmDialog
        open={pendingNavigation !== null}
        onOpenChange={(open) => {
          if (!open) setPendingNavigation(null);
        }}
        title="画面遷移の確認"
        description={
          pendingNavigation
            ? NAVIGATION_CONFIRM_MAP[pendingNavigation].description
            : ''
        }
        confirmLabel="移動"
        onConfirm={handleNavigationConfirm}
      />

      {/* 支払確認ダイアログ（申請／引戻し／承認／検印／差戻し共通。文言は CONFIRM_MESSAGE_MAP） */}
      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title={confirmAction ? CONFIRM_MESSAGE_MAP[confirmAction].title : ''}
        description={
          confirmAction ? CONFIRM_MESSAGE_MAP[confirmAction].description : ''
        }
        confirmLabel={
          confirmAction ? CONFIRM_MESSAGE_MAP[confirmAction].button : ''
        }
        confirmClassName={`${
          confirmAction ? CONFIRM_MESSAGE_MAP[confirmAction].buttonClass : ''
        } text-white rounded-lg`}
        onConfirm={handleConfirmAction}
      />

      {/* 支払根拠資料（右ペイン）。根拠資料表示・登録をタブで切り替える統合ペイン。
          表示対象・登録先は現在表示中の支払回（invoiceCount）の根拠資料。 */}
      <EvidenceUploadPane
        open={isEvidencePaneOpen}
        onOpenChange={setIsEvidencePaneOpen}
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
