import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { Button } from '../../ui/button';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { Save, Send, Check, Undo2, Copy, CornerUpLeft } from 'lucide-react';
import { PlanSearchPane } from '../../shared/PlanSearchPane';
import { PlanAggregationPane } from '../../shared/PlanAggregationPane';
import { DetailTable } from './components/DetailTable';
import {
  PlanNonProductExpensePane,
  type NonProductExpenseData,
  type NonProductExpenseGridHandle,
} from '../../shared/PlanNonProductExpensePane';
import type { DetailTableHandle } from './components/DetailTable';
import { RightPane } from '../../ui/right-pane';
import { DeleteConfirmPane } from '../../ui/delete-confirm-pane';
import { CenterFeeAnnualContractIncentiveRatePane } from '../../shared/CenterFeeAnnualContractIncentiveRatePane';
import {
  MarginNetRatePane,
  type MarginRate,
} from '../../shared/MarginNetRatePane';
import { NumericInput } from '../../ui/numeric-input';
import {
  PLAN_DETAIL_DIGITS,
  formatPlanAmountText,
  formatPlanCountText,
  formatPlanRateText,
  roundPlanNumber,
} from '../../../utils/planDetailNumberFormat';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Input } from '../../ui/input';
import { TEXT_INPUT_CLASS } from '../../../../styles/commonStyles';
import { Label } from '../../ui/label';
import { ExpenseBlockFields } from '../../shared/ExpenseBlockFields';
import { ApproverSelect } from '../../shared/ApproverSelect';
import { Textarea } from '../../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { RequiredBadge } from '../../ui/required-badge';
import { SingleCombobox } from '../../ui/single-combobox';
import { BottomPane } from '../../ui/bottom-pane';
import { PlanReferenceTable } from '../../shared/PlanReferenceTable';
import { CommentHistoryPane } from '../../shared/CommentHistoryPane';
import {
  COMMENT_HISTORY_DATA,
  EMPTY_DETAIL_FORM,
  EMPTY_EXPENSE_FORM,
  RETAIL_MARGIN_RATES,
  REGULAR_PRODUCTS_DATA,
  NEW_PRODUCTS_DATA,
  PROMOTION_PRODUCTS_DATA,
  GIFT_PRODUCTS_DATA,
  type DetailFormValues,
  type ExpenseFormValues,
  type ProductData,
} from '../../../constants/salesPlanRetailMockData';
import { NON_PRODUCT_EXPENSE_ROWS } from '../../../constants/nonProductExpenseMockData';
import { toAggregationProducts } from '../../../utils/planGridToAggregation';
import { toAggregationExpenses } from '../../../utils/expenseGridToAggregation';
import {
  DEFAULT_META_BRAND,
  expenseMissingFields,
  fromExpenseForm,
  toExpenseForm,
} from '../../../constants/nonProductExpenseForm';
import {
  META_BRAND_MASTER,
  EXPENSE_SUMMARY_PRODUCT_OPTIONS,
  periodFromProductValue,
} from '../../../constants/productMasters';
import { CURRENT_USER_NAME } from '../../../constants/planBasicInfoMockData';
import { DEFAULT_TARGET_MONTH_IDX0 } from '../../../constants/defaultAggregationSource';
import { addMonths, monthIndex0Of } from '../../../utils/yearMonth';
import { computeMonth } from '../../../utils/aggregationCalc';
import {
  buildRateLinkedExpenseRows,
  defaultRateLinkedExpenseSetting,
  toRateLinkedExpenseSetting,
  type RateLinkedExpenseSetting,
} from '../../../utils/rateLinkedExpenseRows';
import { CATEGORY_OPTIONS_MARGIN } from '../../../constants/promotionCategories';
import { DetailProductSelector } from '../../shared/DetailProductSelector';
import {
  promotionLabelsFor,
  promotionValueFor,
  promotionValid,
  promotionFixed,
} from '../../../constants/promotionCategoryHelpers';
import {
  promotionComboOptions,
  productCodeFromValue,
} from '../../../constants/comboFieldOptions';
import { expenseSummaryProductOptionCode } from '../../../utils/summaryProductSearch';
import {
  expenseDeleteItems,
  planDetailKeyItems,
} from '../../../constants/planDeleteItems';
import { ScreenTitle } from '../../ui/screen-title';

// ── モックデータ ────────────────────────────────────────────

// コメント履歴のモックデータ

// 販売期間の選択肢（上旬・中旬・下旬）

// 終売区分のオプション生成（現在の年月から前後2年分）
const generateEndSaleOptions = () => {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();

  // 2年前から2年後まで生成
  for (let yearOffset = -2; yearOffset <= 2; yearOffset++) {
    const year = currentYear + yearOffset;
    for (let month = 1; month <= 12; month++) {
      const value = `${year}年${String(month).padStart(2, '0')}月`;
      options.push({ value, label: value });
    }
  }

  return options;
};

export const END_SALE_OPTIONS = generateEndSaleOptions();

// 施策区分・施策コードの選択肢（任意入力。SingleCombobox で選択／クリア可能）

// 明細表のセクション名 → 明細追加ペインの商品区分。
// 本画面の商品区分は 定番商品／新商品／特売／ギフト（CATEGORY_OPTIONS_MARGIN）。
// 「特殊商品」表記で渡ってきた場合も、選択肢に存在する「特売」へ寄せる。
// 未知の値は定番商品へ寄せる。
export const sectionToCategory = (section: string): string => {
  if (section.includes('新商品')) return '新商品';
  if (section.includes('特売') || section.includes('特殊商品')) return '特売';
  if (section === 'ギフト') return 'ギフト';
  return '定番商品';
};

// ── フォーム共通ヘルパー ────────────────────────────────────
export const autoInputCls =
  'w-full bg-gray-50 border-gray-300 text-gray-600 cursor-default';
export const reqInputCls = (err: boolean) =>
  `w-full bg-white shadow-sm focus:ring-2 ${
    err
      ? 'border-red-500 focus:ring-red-500'
      : 'border-gray-400 focus:ring-blue-500'
  }`;

// 未入力の必須項目名を列挙してトースト文言にする。
const requiredMsg = (fields: string[]): string =>
  `${fields.join('・')}を入力してください。`;
// 非活性項目の表示補完。空（undefined/null/空文字）は Grid と同様に「-」を表示する。
const dashIfEmpty = (v: any): string =>
  v === undefined || v === null || v === '' ? '-' : String(v);
// 明細フォームの未入力必須項目（サマリ商品名・販促区分・計画函数）。商品区分は選択式のため常に値あり。
const detailMissingFields = (f: any): string[] => {
  const m: string[] = [];
  if (String(f.summaryProduct ?? '').trim() === '') m.push('サマリ商品名');
  if (!promotionValid(f)) m.push('販促区分');
  // 計画函数は必須。ギフトは上旬/中旬/下旬の3行1セットで追加するため、各期間を必須にする。
  // 0 は有効な入力値として扱い、空欄のみを未入力とみなす。
  const planMissing =
    f.category === 'ギフト'
      ? [f.boxEarly, f.boxMid, f.boxLate].some(
          (v) => String(v ?? '').trim() === ''
        )
      : String(f.plan ?? '').trim() === '';
  if (planMissing) m.push('計画函数');
  return m;
};
interface PlanDetailMarginRateFixedProps {
  // 年間計画／シミュレーションへの画面遷移コールバック。
  // 年間計画は基本情報を遷移元と一致させるため取引制度を引き継ぐ。
  onMenuChange?: (menuId: string, payload?: { tradingSystem: string }) => void;
}

export default function PlanDetailMarginRateFixed({
  onMenuChange,
}: PlanDetailMarginRateFixedProps = {}) {
  const [activeTab, setActiveTab] = useState<string>('sales-detail');
  // 汎用確認ダイアログ（戻る・対象年月変更・右ペイン更新で共通利用）
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    // 実行ボタンのラベル（操作名。画面設計標準 3.8 2/2）
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  // 対象年月変更等で「入力中のデータがリセットされます」確認を出す
  const requestResetConfirm = (onOk: () => void, title = '確認') =>
    setConfirmState({
      title,
      description: '入力中のデータがリセットされます。本当によろしいですか？',
      confirmLabel: '変更',
      onConfirm: onOk,
    });
  // 画面移動（戻る）の確認。入力中データの破棄を確認する
  const requestDiscardConfirm = (onOk: () => void) =>
    setConfirmState({
      title: '画面移動の確認',
      description: '入力中のデータが破棄されます。本当によろしいですか？',
      confirmLabel: '移動',
      onConfirm: onOk,
    });
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  // フッターのコメント入力（差戻し理由など）
  const [commentInput, setCommentInput] = useState('');
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showFixedMarginPane, setShowFixedMarginPane] = useState(false);
  const [showCommentHistoryPane, setShowCommentHistoryPane] = useState(false);

  // 明細系右ペインの状態管理
  const [showAddDetailPane, setShowAddDetailPane] = useState(false);
  const [showDeleteDetailPane, setShowDeleteDetailPane] = useState(false);
  const [detailSection, setDetailSection] = useState<string>('');
  const [detailData, setDetailData] = useState<any>(null);

  // 販売計画(詳細)コピー用
  const detailTableRef = useRef<DetailTableHandle>(null);
  // 拡売費グリッドへの行操作ハンドル（追加/コピー/編集/削除を反映）
  const expenseGridRef = useRef<NonProductExpenseGridHandle>(null);

  // 明細追加・編集フォーム
  const [addForm, setAddForm] = useState<DetailFormValues>(EMPTY_DETAIL_FORM);
  const [addSubmitted, setAddSubmitted] = useState(false);

  // 拡売費追加・編集・コピーフォーム
  const [addExpenseForm, setAddExpenseForm] =
    useState<ExpenseFormValues>(EMPTY_EXPENSE_FORM);
  const [addExpenseSubmitted, setAddExpenseSubmitted] = useState(false);
  // 拡売費 各ペインの「新商品のみ表示」絞り込み状態
  const [addExpenseOnlyNew, setAddExpenseOnlyNew] = useState(false);

  // 拡売費系右ペインの状態管理
  const [showAddExpensePane, setShowAddExpensePane] = useState(false);
  const [showDeleteExpensePane, setShowDeleteExpensePane] = useState(false);
  const [expenseData, setExpenseData] = useState<NonProductExpenseData | null>(
    null
  );
  const [pendingCopyExpenseRow, setPendingCopyExpenseRow] =
    useState<NonProductExpenseData | null>(null);

  // 対象年月（販売計画エリアの検索条件）。集計エリアと共有し、集計値を動的に駆動する。
  const [targetYearMonth, setTargetYearMonth] = useState('2025/10');

  // 販売計画(集計)の算出元。グリッドの現在値を受け取り、集計ソースへ変換して集計エリアへ渡す。
  //
  // 初期値はグリッドが初期化に使うモック定数そのものを使う（空配列にしない）。
  // 拡売費計画タブは初期表示ではマウントされず onRowsChange が発火しないため、
  // 空配列で初期化すると拡売費・直接固定費・管理利益が0のまま表示されてしまう。
  const [detailRows, setDetailRows] = useState<ProductData[]>(() => [
    ...REGULAR_PRODUCTS_DATA,
    ...NEW_PRODUCTS_DATA,
    ...PROMOTION_PRODUCTS_DATA,
    ...GIFT_PRODUCTS_DATA,
  ]);
  const [expenseRows, setExpenseRows] = useState<NonProductExpenseData[]>(
    () => NON_PRODUCT_EXPENSE_ROWS
  );

  // グリッドからのコールバックは useEffect の依存に入るため useCallback で安定化する
  // （毎レンダリングで新しい関数を渡すと更新が止まらなくなる）。
  const handleDetailRowsChange = useCallback(
    (rows: ProductData[]) => setDetailRows(rows),
    []
  );
  const handleExpenseRowsChange = useCallback(
    (rows: NonProductExpenseData[]) => setExpenseRows(rows),
    []
  );

  // 対象年月の月インデックス（0始まり）。月別展開・拡売費の計上月ずらしの基準になる。
  // 月の解釈は utils/yearMonth の monthIndex0Of に集約する。PlanAggregationPane の
  // 「○月合計／1〜○月累計」も同じヘルパーを使うため、独自解釈するとソースの基準月と
  // 表示期間がズレる（基本情報の対象年月＝集計の基準月、という不変条件を壊さない）。
  const targetMonthIdx0 =
    monthIndex0Of(targetYearMonth) ?? DEFAULT_TARGET_MONTH_IDX0;

  // 集計ソース（補足3-1 の計算式の算出元）。グリッドの編集・行追加・行削除に追従する。
  const aggregationSource = useMemo(
    () => ({
      products: toAggregationProducts(detailRows, {
        planPattern: 'marginRateFixed' as const,
        targetMonthIdx0,
      }),
      expenses: toAggregationExpenses(expenseRows, { targetMonthIdx0 }),
    }),
    [detailRows, expenseRows, targetMonthIdx0]
  );

  // 拡売費「参照用」下ペインの状態管理
  const [showReferencePane, setShowReferencePane] = useState(false);
  // コピー元ペインを開いた際、拡売費計画（コピー先）タブがヘッダーメニュー直下に
  // 来るようスクロールするための参照。
  const referenceScrollRef = useRef<HTMLDivElement>(null);

  // コピー元ペインを展開したら、拡売費計画（コピー先）タブへ切り替え、その表の見出しが
  // 画面内スクロール領域の先頭（ヘッダーメニュー直下）へ来るようスクロールする。
  // scrollIntoView は main/ドキュメントまで動かして sticky ヘッダーの表示を乱すため使わず、
  // 最も近いスクロール可能な祖先だけを動かす。
  useEffect(() => {
    if (!showReferencePane) return;
    // 拡売費計画タブを開く（コピー先）
    setActiveTab('non-product-expense');
    // タブ切替後の描画確定を待ってからスクロール
    const id = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>('.expense-plan-grid');
      if (!el) return;
      let scroller: HTMLElement | null = el.parentElement;
      while (scroller) {
        const overflowY = window.getComputedStyle(scroller).overflowY;
        if (
          (overflowY === 'auto' || overflowY === 'scroll') &&
          scroller.scrollHeight > scroller.clientHeight
        ) {
          break;
        }
        scroller = scroller.parentElement;
      }
      if (!scroller) return;
      const delta =
        el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      scroller.scrollBy({ top: delta, behavior: 'smooth' });
    }, 350);
    return () => window.clearTimeout(id);
  }, [showReferencePane]);
  // 参照表のコピーボタンで取り込む行（拡売費計画の合計行直下へ挿入）
  const [pendingReferenceCopyRows, setPendingReferenceCopyRows] = useState<
    NonProductExpenseData[] | null
  >(null);

  // 年契基本分・取組強化マージン系右ペインの状態管理
  const [showAnnualContractPane, setShowAnnualContractPane] = useState(false);
  const [showCenterFeePane, setShowCenterFeePane] = useState(false);
  const [showWholesaleIncentivePane, setShowWholesaleIncentivePane] =
    useState(false);

  // 固定マージン率データ
  const [marginRates, setMarginRates] =
    useState<MarginRate[]>(RETAIL_MARGIN_RATES);

  const handleMarginRatesChange = (rates: MarginRate[]) => {
    setMarginRates(rates);
  };

  // 数値配列の平均を小数点以下2桁（四捨五入）の文字列で返す
  const average2 = (values: number[]): string => {
    if (values.length === 0) return '0.00';
    return roundPlanNumber(
      values.reduce((s, v) => s + v, 0) / values.length,
      PLAN_DETAIL_DIGITS.marginRate
    );
  };
  // ボタン横の表示値は**単位を含んだ文字列**で保持する。
  // 率設定ペインは直接入力（金額）を選べるため、率なら「%」、金額なら「円」と単位が変わる。
  // 固定マージン率：各行設定値の平均（率のみ）
  const fixedMarginAvg = `${average2(marginRates.map((r) => r.rate))}%`;
  // 年契基本分・センターフィ率・取組強化マージン率：各ペインで設定した値（率 or 金額）
  const [annualContractAvg, setAnnualContractAvg] = useState('8.70%');
  const [centerFeeAvg, setCenterFeeAvg] = useState('8.70%');
  const [wholesaleIncentiveAvg, setWholesaleIncentiveAvg] = useState('8.70%');
  // 年契基本分・取組強化マージンの右ペインで設定した経費の反映先（管理区分・管理コード・施策・計上月）。
  // ペインを更新するまでは null とし、ペインの初期値（計上月は対象年月の翌月）で表示する。
  const [annualExpenseSetting, setAnnualExpenseSetting] =
    useState<RateLinkedExpenseSetting | null>(null);
  const [incentiveExpenseSetting, setIncentiveExpenseSetting] =
    useState<RateLinkedExpenseSetting | null>(null);
  // 拡売費計画の最上段に表示する年契基本分・取組強化マージンの行。
  // 金額は集計表と同じ計算（対象年月の算出額）とし、拡売費計画の合計を集計表の拡売費計画と一致させる。
  const rateLinkedExpenseRows = useMemo(() => {
    const amounts = computeMonth(aggregationSource, targetMonthIdx0 + 1);
    const initial = defaultRateLinkedExpenseSetting(targetYearMonth);
    return buildRateLinkedExpenseRows([
      {
        kind: 'annualContract',
        amount: amounts.annualContractAmount,
        setting: annualExpenseSetting ?? initial,
      },
      {
        kind: 'incentive',
        amount: amounts.incentiveAmount,
        setting: incentiveExpenseSetting ?? initial,
      },
    ]);
  }, [
    aggregationSource,
    targetMonthIdx0,
    targetYearMonth,
    annualExpenseSetting,
    incentiveExpenseSetting,
  ]);
  // 拡売費計画グリッドで年契基本分・取組強化マージンの行の計上月を変えたとき、右ペインの設定の計上月を差し替える。
  // ペイン未更新（null）の場合は初期値（計上月は対象年月の翌月）をもとにする。
  const handleRateLinkedPostingMonthChange = useCallback(
    (kind: 'annualContract' | 'incentive', postingMonth: string) => {
      const withPostingMonth = (
        prev: RateLinkedExpenseSetting | null
      ): RateLinkedExpenseSetting => ({
        ...(prev ?? defaultRateLinkedExpenseSetting(targetYearMonth)),
        postingMonth,
      });
      if (kind === 'annualContract') setAnnualExpenseSetting(withPostingMonth);
      else setIncentiveExpenseSetting(withPostingMonth);
    },
    [targetYearMonth]
  );

  // 販売計画(詳細)のコピー右ペインの表示種別
  // （null=閉／'plan'=計画コピー／'headquarters'=本部計画コピー）。
  // 他の右ペインと排他表示するため親で管理する。
  const [copyPaneMode, setCopyPaneMode] = useState<
    null | 'plan' | 'headquarters'
  >(null);

  // 販売計画(集計)の「集計対象設定」右ペイン。他の右ペインと排他表示するため親で管理する。
  // （集計単位①②・除外ペアの値は集計コンポーネント側で保持するため開閉しても失われない）
  const [showAggFilterPane, setShowAggFilterPane] = useState(false);

  // 右ペインの折り畳み（付箋）状態。右ペインは常に1つのみ表示するため画面で1つ保持する。
  const [isPaneCollapsed, setIsPaneCollapsed] = useState(false);

  // すべての右ペインを閉じるヘルパー関数
  const closeAllRightPanes = () => {
    setShowAggFilterPane(false);
    setShowFixedMarginPane(false);
    setShowCommentHistoryPane(false);
    setShowAddDetailPane(false);
    setShowDeleteDetailPane(false);
    setShowAddExpensePane(false);
    setShowDeleteExpensePane(false);
    setShowAnnualContractPane(false);
    setShowCenterFeePane(false);
    setShowWholesaleIncentivePane(false);
    setShowReferencePane(false);
    setCopyPaneMode(null);
    setIsPaneCollapsed(false);
  };

  // ペイン元のボタン/リンクを押下するたびに開閉を切り替えるヘルパー
  // 折り畳み（付箋）状態で再押下された場合は閉じずに展開して再表示する。
  // それ以外は、既に開いていれば全ペインを閉じ、閉じていれば対象ペインのみ開く。
  const togglePane = (isOpen: boolean, openFn: () => void) => {
    if (isOpen && isPaneCollapsed) {
      setIsPaneCollapsed(false);
      return;
    }
    closeAllRightPanes();
    if (!isOpen) openFn();
  };

  // 明細追加ペインの追加実行。
  // continuous=true（連続追加）はペインを開いたままフォームを初期化し、
  // false（追加）は他ペインと同様にペインを閉じる。
  const handleAddDetailSubmit = (continuous: boolean) => {
    // 未入力の必須項目（サマリ商品名・販促区分）があれば追加をブロックする
    setAddSubmitted(true);
    const addMissing = detailMissingFields(addForm);
    if (addMissing.length) {
      toast.error(requiredMsg(addMissing));
      return;
    }
    // 合計行の直下（先頭）に新規明細を追加する。
    // 計画函数は必須項目のため、この時点で必ず値が入っている。
    // 追加先セクションはフォームで選択中の商品区分から決める（どの＋から開いたかではない）。
    // ペインで商品区分を変更した場合も、選択どおりのセクションへ追加される。
    const section = addForm.category || '定番商品';
    const commonFields = {
      metaBrand: addForm.metaBrand,
      summaryProduct: addForm.summaryProduct,
      wholesaleMesh: addForm.wholesaleMesh,
      containerCapacityG: addForm.containerCapacityG,
      quantity: addForm.quantity,
      endSale: addForm.endSale,
      promotion: promotionValueFor(addForm),
      estimate: addForm.currentEstimate,
      actual: addForm.currentActual,
      prevYear: addForm.prevYearActual,
      net: addForm.net,
      planPrice: addForm.deliveryPrice,
      delivery: addForm.deliveryPrice,
      price: addForm.price,
      // マージン率は追加ペインで入力可のため、入力値をそのまま行へ引き渡す
      // （追加後にグリッドで納価・売価等を編集すると、この値で NET・値入率が再計算される）
      margin: addForm.margin,
    };
    if (section === 'ギフト') {
      // ギフトは上旬/中旬/下旬の3行1セットで追加（各期間の箱数=計画）
      detailTableRef.current?.addGiftSet(
        { ...commonFields, section, productCategory: section },
        [addForm.boxEarly.trim(), addForm.boxMid.trim(), addForm.boxLate.trim()]
      );
    } else {
      detailTableRef.current?.addNewRow({
        section,
        productCategory: section,
        ...commonFields,
        plan: addForm.plan.trim(),
      });
    }
    setAddForm({ ...EMPTY_DETAIL_FORM, category: addForm.category });
    setAddSubmitted(false);
    if (!continuous) setShowAddDetailPane(false);
    toast.success('明細を追加しました。');
  };

  // 明細追加ペインを開く
  const handleOpenAddDetail = (section: string) => {
    const isOpen = showAddDetailPane && detailSection === section;
    closeAllRightPanes();
    if (isOpen) return;
    setDetailSection(section);
    setAddForm({
      ...EMPTY_DETAIL_FORM,
      category: sectionToCategory(section),
    });
    setAddSubmitted(false);
    setShowAddDetailPane(true);
  };

  // 明細削除ペインを開く
  const handleOpenDeleteDetail = (data: any) => {
    const isOpen = showDeleteDetailPane && detailData === data;
    closeAllRightPanes();
    if (isOpen) return;
    setDetailData(data);
    setShowDeleteDetailPane(true);
  };

  // 拡売費追加ペインを開く
  const handleOpenAddExpense = () => {
    const isOpen = showAddExpensePane;
    closeAllRightPanes();
    if (isOpen) return;
    setAddExpenseForm({ ...EMPTY_EXPENSE_FORM, metaBrand: DEFAULT_META_BRAND });
    setAddExpenseSubmitted(false);
    setAddExpenseOnlyNew(false);
    setShowAddExpensePane(true);
  };

  // 拡売費追加ペインの追加実行。
  // continuous=true（連続追加）はペインを開いたままフォームを初期化し、
  // false（追加）は他ペインと同様にペインを閉じる。
  const handleAddExpenseSubmit = (continuous: boolean) => {
    setAddExpenseSubmitted(true);
    const missing = expenseMissingFields(addExpenseForm, {
      metaBrandRequired: true,
    });
    if (missing.length) {
      toast.error(requiredMsg(missing));
      return;
    }
    // 合計行の直下に追加
    expenseGridRef.current?.addRow(fromExpenseForm(addExpenseForm));
    setAddExpenseForm({ ...EMPTY_EXPENSE_FORM, metaBrand: DEFAULT_META_BRAND });
    setAddExpenseSubmitted(false);
    if (!continuous) setShowAddExpensePane(false);
    toast.success('拡売費を追加しました。');
  };

  // 拡売費コピー：ペインを開かず、拡売費計画グリッドの合計行直下へ直接行を複製する。
  // 前年実績は引き継がず（削除可）、作成者はログインユーザーになる（fromExpenseForm）。
  const handleCopyExpenseRow = (data: NonProductExpenseData) => {
    expenseGridRef.current?.addRow({
      ...fromExpenseForm(toExpenseForm(data)),
      _copySource: 'detail',
    });
    toast.success('拡売費計画へコピーしました。');
  };

  // 拡売費削除ペインを開く
  const handleOpenDeleteExpense = (data: NonProductExpenseData) => {
    const isOpen = showDeleteExpensePane && expenseData === data;
    closeAllRightPanes();
    if (isOpen) return;
    setExpenseData(data);
    setShowDeleteExpensePane(true);
  };

  // 年契基本分ペインを開く
  const handleOpenAnnualContract = () => {
    togglePane(showAnnualContractPane, () => setShowAnnualContractPane(true));
  };

  // センターフィペインを開く
  const handleOpenCenterFee = () => {
    togglePane(showCenterFeePane, () => setShowCenterFeePane(true));
  };

  // 取組強化マージンペインを開く
  const handleOpenWholesaleIncentive = () => {
    togglePane(showWholesaleIncentivePane, () =>
      setShowWholesaleIncentivePane(true)
    );
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-gray-100">
      {/* 左ペイン：メインコンテンツ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* スクロール可能エリア */}
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <div className="min-w-[75rem]">
            <div className="px-6 pt-3 pb-2">
              {/* 画面名はヘッダー（システム名の右）に表示する */}
              <ScreenTitle title="計画詳細(マージン率固定・NET入力)" />

              {/* 販売計画条件エリア */}
              <section aria-labelledby="search-heading">
                <h2 id="search-heading" className="sr-only">
                  検索条件
                </h2>
                <PlanSearchPane
                  // 折り畳んでも対象年月・ステータス・販売店を見出しに表示する
                  showSummaryWhenCollapsed
                  tradingSystem="マージン率固定"
                  onStatusClick={() =>
                    togglePane(showCommentHistoryPane, () =>
                      setShowCommentHistoryPane(true)
                    )
                  }
                  targetYearMonth={targetYearMonth}
                  onChangeTargetYearMonth={(v) =>
                    requestResetConfirm(
                      () => setTargetYearMonth(v),
                      '対象年月変更の確認'
                    )
                  }
                />
              </section>

              {/* 販売計画(集計)エリア */}
              <section aria-labelledby="aggregation-heading" className="mb-6">
                <h2 id="aggregation-heading" className="sr-only">
                  販売計画(集計)
                </h2>
                <PlanAggregationPane
                  targetYearMonth={targetYearMonth}
                  source={aggregationSource}
                  aggFilterPaneOpen={showAggFilterPane}
                  onToggleAggFilterPane={() =>
                    togglePane(showAggFilterPane, () =>
                      setShowAggFilterPane(true)
                    )
                  }
                  onCloseAggFilterPane={() => setShowAggFilterPane(false)}
                  // 詳細タブのドリルダウン開閉状態を画面ごとに保存する
                  expandStateKey="PlanMarginNet.agg"
                  // 年間集計・拡売費集計タブも基本情報の対象年月を基準月にする
                  linkTotalTabsToTargetMonth
                />
              </section>

              {/* タブ切り替え: 販売計画(詳細) / 拡売費計画 */}
              <section
                ref={referenceScrollRef}
                className="mb-4 bg-white"
                aria-labelledby="detail-tabs-heading"
              >
                <h2 id="detail-tabs-heading" className="sr-only">
                  販売詳細とその他費用
                </h2>
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2  bg-transparent p-0 h-auto gap-1">
                    <TabsTrigger
                      value="sales-detail"
                      className="flex items-center justify-center gap-2 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded px-4 py-3"
                    >
                      <span className="font-medium">販売計画(詳細)</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="non-product-expense"
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded"
                    >
                      <span className="font-medium">拡売費計画</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="sales-detail">
                    <DetailTable
                      ref={detailTableRef}
                      onNavigate={(menuId) =>
                        // 年間計画作成の基本情報を本画面と一致させるため取引制度を渡す
                        onMenuChange?.(
                          menuId,
                          menuId === 'annual-plan-creation'
                            ? { tradingSystem: 'マージン率固定' }
                            : undefined
                        )
                      }
                      onOpenFixedMargin={() =>
                        togglePane(showFixedMarginPane, () =>
                          setShowFixedMarginPane(true)
                        )
                      }
                      onOpenAddDetail={handleOpenAddDetail}
                      onOpenDeleteDetail={handleOpenDeleteDetail}
                      onOpenAnnualContract={handleOpenAnnualContract}
                      onOpenCenterFee={handleOpenCenterFee}
                      onOpenWholesaleIncentive={handleOpenWholesaleIncentive}
                      copyPaneMode={copyPaneMode}
                      onOpenPlanCopy={() =>
                        togglePane(copyPaneMode === 'plan', () =>
                          setCopyPaneMode('plan')
                        )
                      }
                      onOpenHeadquartersCopy={() =>
                        togglePane(copyPaneMode === 'headquarters', () =>
                          setCopyPaneMode('headquarters')
                        )
                      }
                      onCloseCopyPane={() => setCopyPaneMode(null)}
                      annualContractAvg={annualContractAvg}
                      centerFeeAvg={centerFeeAvg}
                      wholesaleIncentiveAvg={wholesaleIncentiveAvg}
                      fixedMarginAvg={fixedMarginAvg}
                      onRowsChange={handleDetailRowsChange}
                    />
                  </TabsContent>

                  <TabsContent value="non-product-expense">
                    <PlanNonProductExpensePane
                      ref={expenseGridRef}
                      onOpenAddExpense={handleOpenAddExpense}
                      onOpenDeleteExpense={handleOpenDeleteExpense}
                      onOpenCopyExpense={handleCopyExpenseRow}
                      pendingCopyRow={pendingCopyExpenseRow}
                      onCopyComplete={() => setPendingCopyExpenseRow(null)}
                      onOpenReference={() =>
                        togglePane(showReferencePane, () =>
                          setShowReferencePane(true)
                        )
                      }
                      pendingReferenceRows={pendingReferenceCopyRows}
                      onReferenceConsumed={() =>
                        setPendingReferenceCopyRows(null)
                      }
                      onRowsChange={handleExpenseRowsChange}
                      rateLinkedRows={rateLinkedExpenseRows}
                      // 拡売費計画タブにも右ペインを開くリンクを出す（9/29 第35回 決定事項10・課題1780）
                      rateLinks={[
                        {
                          label: '年契基本分',
                          value: annualContractAvg,
                          onClick: handleOpenAnnualContract,
                        },
                        {
                          label: 'センターフィ',
                          value: centerFeeAvg,
                          onClick: handleOpenCenterFee,
                        },
                        {
                          label: '取組強化マージン',
                          value: wholesaleIncentiveAvg,
                          onClick: handleOpenWholesaleIncentive,
                        },
                        {
                          label: '固定マージン率',
                          value: fixedMarginAvg,
                          onClick: () =>
                            togglePane(showFixedMarginPane, () =>
                              setShowFixedMarginPane(true)
                            ),
                        },
                      ]}
                      onRateLinkedPostingMonthChange={
                        handleRateLinkedPostingMonthChange
                      }
                    />
                  </TabsContent>
                </Tabs>
              </section>
            </div>
          </div>
        </div>

        {/* 拡売費「参照」下ペイン：自計画（過去12か月）を表示し、コピーボタンで拡売費計画へ追加。
            プッシュ式：親画面に被さらず中身を押し上げるため、参照表と拡売費計画を同時に視認できる。 */}
        <BottomPane
          open
          collapsed={!showReferencePane}
          onCollapsedChange={(next) => setShowReferencePane(!next)}
          onClose={() => setShowReferencePane(false)}
          prominentTab
          collapsedTabLabel="過去の拡売費計画からコピー"
          collapsedTabIcon={<Copy className="h-4 w-4" />}
          title="拡売費計画(コピー元)"
          description="コピーボタン、または行のダブルクリックで拡売費計画へ追加できます"
        >
          <PlanReferenceTable
            targetMonth={targetYearMonth}
            onCopyRow={(row) => {
              // 取り込んだ行は当計画の新規行。前年実績は持たず（削除可）、
              // 計上年月は基本情報の対象年月の翌月、作成者はログインユーザー。
              setPendingReferenceCopyRows([
                {
                  ...row,
                  isTotal: false,
                  exp1PriorYearActual: null,
                  exp1PostingMonth: addMonths(targetYearMonth, 1),
                  exp1Creator: CURRENT_USER_NAME,
                },
              ]);
              toast.success('参照表からコピーしました。');
            }}
          />
        </BottomPane>

        {/* アクションボタン。data-screen-footer は下ペインが上へドックする目印で、
            下ペイン表示中もこのバーは画面最下部に表示されたままになる。 */}
        <div
          data-screen-footer
          className="bg-white border-t border-gray-200 px-6 py-2 flex-shrink-0"
        >
          <div className="flex flex-wrap gap-3 justify-between">
            <div>
              <Button
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50 h-9 rounded-lg"
                onClick={() =>
                  requestDiscardConfirm(() => onMenuChange?.('plan-list'))
                }
              >
                <Undo2 className="h-4 w-4 mr-2" />
                一覧へ戻る
              </Button>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
              {/* コメント欄（支払詳細(追加口請求書有)と同一の複数行テキストエリア） */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <label
                  htmlFor="sales-plan-retail-comment"
                  className="text-sm text-gray-700 whitespace-nowrap font-medium"
                >
                  コメント
                </label>
                <textarea
                  id="sales-plan-retail-comment"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="コメントを入力(差戻し理由など)"
                  rows={2}
                  className="h-10 w-full min-w-[10rem] max-w-[32rem] border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
                />
              </div>
              <Button
                className="bg-red-500 hover:bg-red-600 text-white h-9 rounded-lg"
                onClick={() => toast.success('差し戻しました。')}
              >
                <CornerUpLeft className="h-4 w-4 mr-2" />
                差戻し
              </Button>
              <Button
                className="bg-green-500 hover:bg-green-600 text-white h-9 rounded-lg"
                onClick={() => toast.success('承認しました。')}
              >
                <Check className="h-4 w-4 mr-2" />
                承認
              </Button>
              <Button
                className="bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50 h-9 rounded-lg"
                onClick={() => toast.success('計画を引き戻しました。')}
              >
                <CornerUpLeft className="h-4 w-4 mr-2" />
                引戻し
              </Button>
              <Button
                className="bg-green-500 hover:bg-green-600 text-white h-9 rounded-lg"
                onClick={() => toast.success('計画承認申請を送信しました。')}
              >
                <Send className="h-4 w-4 mr-2" />
                申請
              </Button>

              <Button
                className="bg-blue-500 hover:bg-blue-600 text-white h-9 rounded-lg"
                onClick={() => {
                  // 保存したら明細コピー・明細追加の帯と編集セルの強調を消す
                  detailTableRef.current?.clearSavedMarks();
                  expenseGridRef.current?.clearSavedMarks?.();
                  toast.success('販売計画を保存しました。');
                }}
              >
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
            </div>
          </div>
        </div>

        {/* 計画保存ダイアログ */}
        <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>計画保存</DialogTitle>
              <DialogDescription>販売計画を保存します。</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              販売計画を保存しますがよろしいですか？
            </div>
            <DialogFooter>
              <Button
                className="bg-blue-500 hover:bg-blue-600 text-white py-6 rounded-lg"
                onClick={() => setShowRegisterDialog(false)}
              >
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 計画承認申請ダイアログ */}
        <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>計画承認申請</DialogTitle>
              <DialogDescription>
                販売計画の承認を申請します。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  月次販売計画書No
                </Label>
                <div className="col-span-3 text-sm">SP-2025-10-001</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">対象年月</Label>
                <div className="col-span-3 text-sm">2025年10月</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  申請担当者
                </Label>
                <div className="col-span-3 text-sm">アサヒ　太郎</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  承認担当者
                </Label>
                <ApproverSelect className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">申請備考</Label>
                <Textarea
                  className="col-span-3 bg-white"
                  placeholder="備考を入力してください"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                className="bg-green-500 hover:bg-green-600 text-white py-6 rounded-lg"
                onClick={() => setShowApprovalDialog(false)}
              >
                <Send className="h-4 w-4 mr-2" />
                計画承認申請
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 計画引戻しダイアログ */}
        <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>計画引戻し</DialogTitle>
              <DialogDescription>
                申請した販売計画を引き戻します。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  月次販売計画書No
                </Label>
                <div className="col-span-3 text-sm">SP-2025-10-001</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">対象年月</Label>
                <div className="col-span-3 text-sm">2025年10月</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  申請担当者
                </Label>
                <div className="col-span-3 text-sm">アサヒ　太郎</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  承認担当者
                </Label>
                <div className="col-span-3 text-sm">アサヒ　早苗</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">申請備考</Label>
                <div className="col-span-3 text-sm">10月の販売計画</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  引戻し理由
                </Label>
                <Textarea
                  className="col-span-3 bg-white"
                  placeholder="引戻し理由を入力してください"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                className="bg-green-500 hover:bg-green-600 text-white py-6 rounded-lg"
                onClick={() => setShowWithdrawDialog(false)}
              >
                <CornerUpLeft className="h-4 w-4 mr-2" />
                計画引戻し
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 計画承認ダイアログ */}
        <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>計画承認</DialogTitle>
              <DialogDescription>販売計画を承認します。</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  月次販売計画書No
                </Label>
                <div className="col-span-3 text-sm">SP-2025-10-001</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">対象年月</Label>
                <div className="col-span-3 text-sm">2025年10月</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  申請担当者
                </Label>
                <div className="col-span-3 text-sm">アサヒ　太郎</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  承認担当者
                </Label>
                <div className="col-span-3 text-sm">アサヒ　早苗</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">申請備考</Label>
                <div className="col-span-3 text-sm">10月の販売計画</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">承認備考</Label>
                <Textarea
                  className="col-span-3 bg-white"
                  placeholder="承認備考を入力してください"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                className="bg-green-500 hover:bg-green-600 text-white py-6 rounded-lg"
                onClick={() => setShowApproveDialog(false)}
              >
                <Check className="h-4 w-4 mr-2" />
                承認
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 計画差戻しダイアログ */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>計画差戻し</DialogTitle>
              <DialogDescription>販売計画を差し戻します。</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  月次販売計画書No
                </Label>
                <div className="col-span-3 text-sm">SP-2025-10-001</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">対象年月</Label>
                <div className="col-span-3 text-sm">2025年10月</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  申請担当者
                </Label>
                <div className="col-span-3 text-sm">アサヒ　太郎</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  承認担当者
                </Label>
                <div className="col-span-3 text-sm">アサヒ　早苗</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">申請備考</Label>
                <div className="col-span-3 text-sm">10月の販売計画</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  差戻し理由
                </Label>
                <Textarea
                  className="col-span-3 bg-white"
                  placeholder="差戻し理由を入力してください"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                className="bg-red-500 hover:bg-red-600 text-white py-6 rounded-lg"
                onClick={() => setShowRejectDialog(false)}
              >
                <CornerUpLeft className="h-4 w-4 mr-2" />
                差戻し
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 右ペイン：固定マージン率設定（更新確認・トーストは MarginNetRatePane 内で実装） */}
      <MarginNetRatePane
        open={showFixedMarginPane}
        onClose={() => setShowFixedMarginPane(false)}
        variant="margin"
        rates={marginRates}
        onRatesChange={handleMarginRatesChange}
        collapsed={isPaneCollapsed}
        onCollapsedChange={setIsPaneCollapsed}
      />

      {/* 汎用確認ダイアログ（戻る・対象年月変更・右ペイン更新で共通利用） */}
      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title ?? '確認'}
        confirmLabel={confirmState?.confirmLabel ?? ''}
        description={confirmState?.description ?? ''}
        onConfirm={() => {
          const fn = confirmState?.onConfirm;
          setConfirmState(null);
          fn?.();
        }}
        onCancel={() => setConfirmState(null)}
      />

      {/* 右ペイン：明細追加 */}
      <RightPane
        open={showAddDetailPane}
        onClose={() => setShowAddDetailPane(false)}
        title="明細追加"
        description="明細を追加します"
        footer={
          <div className="flex items-center justify-end gap-[0.75rem]">
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => handleAddDetailSubmit(true)}
            >
              連続追加
            </Button>
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => handleAddDetailSubmit(false)}
            >
              追加
            </Button>
          </div>
        }
      >
        <div className="flex flex-col h-full">
          {/* 検索エリア */}
          <div className="bg-white p-4 border-b border-gray-300">
            <div className="space-y-3">
              <DetailProductSelector
                useWholesaleMesh={false}
                categoryOptions={CATEGORY_OPTIONS_MARGIN}
                showCategorySelect={true}
                category={addForm.category}
                onCategoryChange={(v) =>
                  setAddForm({
                    ...EMPTY_DETAIL_FORM,
                    category: v,
                  })
                }
                summaryProduct={addForm.summaryProduct}
                wholesaleMesh={addForm.wholesaleMesh}
                metaBrand={addForm.metaBrand}
                containerCapacityG={addForm.containerCapacityG}
                onSelectSummaryProduct={(p) =>
                  setAddForm((prev) => ({
                    ...prev,
                    summaryProduct: p.value,
                    metaBrand: p.metaBrand,
                    containerCapacityG: p.containerCapacityG,
                    wholesaleMesh: p.wholesaleMesh,
                    quantity: p.quantity,
                    promotion: p.promotion,
                    currentEstimate: p.currentEstimate,
                    currentActual: p.currentActual,
                    prevYearActual: p.prevYearActual,
                    net: p.net,
                    deliveryPrice: p.deliveryPrice,
                    price: p.price,
                    margin: p.margin,
                    costOfSales: p.costOfSales,
                    seihan: p.seihan,
                    profitRate: p.profitRate,
                    discountRate: p.discountRate,
                    endSale: p.endSale,
                    period: periodFromProductValue(p.value),
                  }))
                }
                onSelectWholesaleMesh={(m) =>
                  setAddForm((prev) => ({
                    ...prev,
                    wholesaleMesh: m.value,
                    metaBrand: m.metaBrand,
                    containerCapacityG: m.containerCapacityG,
                    quantity: m.quantity,
                    currentEstimate: m.currentEstimate,
                    currentActual: m.currentActual,
                    prevYearActual: m.prevYearActual,
                    net: m.net,
                  }))
                }
                onChangeMetaBrand={(v) =>
                  setAddForm((prev) => ({ ...prev, metaBrand: v }))
                }
                onChangeContainerCapacity={(v) =>
                  setAddForm((prev) => ({
                    ...prev,
                    containerCapacityG: v,
                  }))
                }
                onClearPrimary={() =>
                  setAddForm((prev) => ({
                    ...prev,
                    summaryProduct: '',
                    wholesaleMesh: '',
                    metaBrand: '',
                    containerCapacityG: '',
                  }))
                }
                submitted={addSubmitted}
                newProductBaseMonth={targetYearMonth}
                // 商品区分が新商品のときは「新商品のみ表示」を初期でチェックする
                onlyNewByDefaultForNewCategory
              />
            </div>
          </div>

          {/* 入力フォームエリア（コンテナ幅に応じて 1→2→3 列に変動） */}
          <div className="flex-1 overflow-y-auto bg-white p-4">
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 @md:grid-cols-2 @2xl:grid-cols-3">
              {/* 販促区分 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  販促区分 <RequiredBadge />
                </Label>
                {/* 商品区分によらず販促区分は活性・必須 */}
                <div
                  className={
                    addSubmitted && !promotionValueFor(addForm).trim()
                      ? 'rounded-md ring-1 ring-red-500'
                      : ''
                  }
                >
                  <SingleCombobox
                    options={promotionComboOptions(
                      promotionLabelsFor(addForm.category)
                    )}
                    value={promotionValueFor(addForm)}
                    disabled={promotionFixed(addForm.category)}
                    onChange={(v) =>
                      setAddForm((p) => ({
                        ...p,
                        promotion: v,
                      }))
                    }
                    placeholder="販促区分を選択"
                    clearable
                  />
                </div>
              </div>

              {/* 終売区分：サマリ商品名の選択に紐づいて自動表示されるため非活性 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  終売区分
                </Label>
                <Input
                  value={dashIfEmpty(addForm.endSale)}
                  readOnly
                  className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
                />
              </div>

              {/* 計画函数（ギフトは上旬/中旬/下旬ごとの箱数を入力） */}
              {addForm.category === 'ギフト' ? (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">
                    計画函数：上旬／中旬／下旬 <RequiredBadge />
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ['上旬', 'boxEarly'],
                        ['中旬', 'boxMid'],
                        ['下旬', 'boxLate'],
                      ] as const
                    ).map(([label, key]) => (
                      <div key={key} className="space-y-1">
                        <span className="block text-xs text-gray-500">
                          {label}
                        </span>
                        <NumericInput
                          value={addForm[key]}
                          /* 計画函数は整数のみ入力可 */
                          maxFractionDigits={0}
                          onChange={(e) =>
                            setAddForm((p) => ({
                              ...p,
                              [key]: e.target.value,
                            }))
                          }
                          placeholder="計画函数"
                          className={
                            addSubmitted && !String(addForm[key] ?? '').trim()
                              ? 'w-full bg-white border-gray-400 shadow-sm ring-1 ring-red-500 focus:ring-2 focus:ring-blue-500'
                              : 'w-full bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500'
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">
                    計画函数 <RequiredBadge />
                  </Label>
                  <NumericInput
                    value={addForm.plan}
                    /* 計画函数は整数のみ入力可 */
                    maxFractionDigits={0}
                    onChange={(e) =>
                      setAddForm((p) => ({
                        ...p,
                        plan: e.target.value,
                      }))
                    }
                    placeholder="計画函数を入力"
                    className={
                      addSubmitted && !String(addForm.plan ?? '').trim()
                        ? 'w-full bg-white border-gray-400 shadow-sm ring-1 ring-red-500 focus:ring-2 focus:ring-blue-500'
                        : 'w-full bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500'
                    }
                  />
                </div>
              )}

              {/* NET */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">NET</Label>
                <Input
                  value={formatPlanAmountText(
                    addForm.net,
                    PLAN_DETAIL_DIGITS.price
                  )}
                  readOnly
                  className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
                />
              </div>

              {/* 納価（商品区分によらず活性） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  納価
                </Label>
                <NumericInput
                  value={addForm.deliveryPrice}
                  maxFractionDigits={PLAN_DETAIL_DIGITS.price}
                  onChange={(e) =>
                    setAddForm((p) => ({
                      ...p,
                      deliveryPrice: e.target.value,
                    }))
                  }
                  placeholder="納価（任意）"
                  className="w-full bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* マージン率（固定マージン率。サマリ商品選択で自動表示し、手入力での上書きも可） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  マージン率
                </Label>
                <NumericInput
                  value={addForm.margin}
                  maxFractionDigits={PLAN_DETAIL_DIGITS.marginRate}
                  onChange={(e) =>
                    setAddForm((p) => ({
                      ...p,
                      margin: e.target.value,
                    }))
                  }
                  placeholder="マージン率（任意）"
                  className="w-full bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 売価 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  売価
                </Label>
                <NumericInput
                  value={addForm.price}
                  maxFractionDigits={PLAN_DETAIL_DIGITS.amount}
                  onChange={(e) =>
                    setAddForm((p) => ({
                      ...p,
                      price: e.target.value,
                    }))
                  }
                  placeholder="売価（任意）"
                  className="w-full bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 売上原価（非活性） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  売上原価
                </Label>
                <Input
                  value={formatPlanAmountText(
                    addForm.costOfSales,
                    PLAN_DETAIL_DIGITS.amount
                  )}
                  readOnly
                  className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
                />
              </div>

              {/* 社外売上高（非活性） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  社外売上高
                </Label>
                <Input
                  value={formatPlanAmountText(
                    addForm.seihan,
                    PLAN_DETAIL_DIGITS.amount
                  )}
                  readOnly
                  className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
                />
              </div>

              {/* 入数（非活性） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  入数
                </Label>
                <Input
                  value={formatPlanCountText(addForm.quantity)}
                  readOnly
                  className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
                />
              </div>

              {/* 売買差益率（非活性） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  売買差益率
                </Label>
                <Input
                  value={formatPlanRateText(
                    addForm.profitRate,
                    PLAN_DETAIL_DIGITS.rate
                  )}
                  readOnly
                  className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
                />
              </div>

              {/* 値入率（非活性） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  値入率
                </Label>
                <Input
                  value={formatPlanRateText(
                    addForm.discountRate,
                    PLAN_DETAIL_DIGITS.rate
                  )}
                  readOnly
                  className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
                />
              </div>
            </div>
          </div>
        </div>
      </RightPane>

      {/* 右ペイン：明細削除確認（共通部品 DeleteConfirmPane） */}
      <DeleteConfirmPane
        open={showDeleteDetailPane}
        onClose={() => setShowDeleteDetailPane(false)}
        title="明細削除の確認"
        description="明細を削除します"
        // 削除対象は業務KEY項目（補足5-1）で示す
        items={planDetailKeyItems('marginNet', detailData, targetYearMonth)}
        onDelete={() => {
          // 対象明細を表から削除する
          if (detailData) {
            detailTableRef.current?.deleteRow(detailData);
          }
          setShowDeleteDetailPane(false);
          toast.success('明細を削除しました。');
        }}
      />

      {/* 右ペイン：拡売費追加 */}
      <RightPane
        open={showAddExpensePane}
        onClose={() => setShowAddExpensePane(false)}
        title="拡売費追加"
        description="拡売費を追加します"
        footer={
          <div className="flex items-center justify-end gap-[0.75rem]">
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => handleAddExpenseSubmit(true)}
            >
              連続追加
            </Button>
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => handleAddExpenseSubmit(false)}
            >
              追加
            </Button>
          </div>
        }
      >
        {(() => {
          const f = addExpenseForm;
          const setF = setAddExpenseForm;
          const sub = addExpenseSubmitted;
          const onlyNew = addExpenseOnlyNew;
          const setOnlyNew = setAddExpenseOnlyNew;
          return (
            <div className="space-y-4">
              {/* サマリ商品名 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  サマリ商品名
                </Label>
                <SingleCombobox
                  options={EXPENSE_SUMMARY_PRODUCT_OPTIONS.filter(
                    (o) => o.value === f.summaryProduct || !onlyNew || o.isNew
                  )
                    .filter(
                      (o) =>
                        o.value === f.summaryProduct ||
                        (o.value !== '-' &&
                          // ブランド横断(全商品)は絞り込まず全商品を出す。
                          (!f.metaBrand ||
                            f.metaBrand === DEFAULT_META_BRAND ||
                            o.metaBrand === f.metaBrand))
                    )
                    .map((o) => ({
                      value: o.value,
                      label: o.label ?? o.value,
                      // 明細追加ペインと同じく、サマリ商品コードでも検索できるよう2行目の先頭にコードを表示する
                      code: expenseSummaryProductOptionCode(
                        productCodeFromValue(o.value),
                        o.metaBrand,
                        o.containerCapacityG
                      ),
                      badge: o.isNew ? 'NEW' : undefined,
                    }))}
                  value={f.summaryProduct}
                  onChange={(v) => {
                    const opt = EXPENSE_SUMMARY_PRODUCT_OPTIONS.find(
                      (o) => o.value === v
                    );
                    setF((prev) => ({
                      ...prev,
                      summaryProduct: v,
                      metaBrand:
                        opt && v !== '-'
                          ? opt.metaBrand
                          : v === '-'
                            ? ''
                            : prev.metaBrand,
                    }));
                  }}
                  clearable
                  placeholder="サマリ商品名を選択（任意）"
                />
              </div>

              {/* メタブランド（必須。既定はブランド横断(全商品)） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  メタブランド <RequiredBadge />
                </Label>
                <div
                  className={
                    sub && !f.metaBrand.trim()
                      ? 'rounded-md ring-1 ring-red-500'
                      : ''
                  }
                >
                  {/* サマリ商品名の選択中はサマリ商品名から決まるメタブランドを変更させない
                      （サマリ商品名をクリアすると再び選択できる） */}
                  <SingleCombobox
                    options={META_BRAND_MASTER.map((b) => ({
                      value: b.value,
                      label: b.name,
                      code: b.code,
                    }))}
                    value={f.metaBrand}
                    onChange={(v) => setF((p) => ({ ...p, metaBrand: v }))}
                    placeholder="メタブランドを選択"
                    clearable
                    disabled={!!f.summaryProduct && f.summaryProduct !== '-'}
                  />
                </div>
              </div>

              {/* 新商品のみ表示 */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={onlyNew}
                  onChange={(e) => setOnlyNew(e.target.checked)}
                />
                <Label>新商品のみ表示</Label>
              </div>

              {/* 拡売費（計画金額～摘要1） */}
              <div className="border-t border-gray-200 pt-3">
                <ExpenseBlockFields
                  prefix="exp1"
                  form={f}
                  setForm={setF}
                  submitted={sub}
                  campaignRequired={false}
                  postingMonthAlign="start"
                />
              </div>
            </div>
          );
        })()}
      </RightPane>

      {/* 右ペイン：拡売費削除確認（共通部品 DeleteConfirmPane）。
          削除対象を特定できるよう、拡売費グリッドと同じ並びで
          メタブランド～摘要1(社内用)を並べる。 */}
      <DeleteConfirmPane
        open={showDeleteExpensePane}
        onClose={() => setShowDeleteExpensePane(false)}
        title="拡売費削除"
        description="拡売費を削除します"
        items={expenseDeleteItems(expenseData)}
        onDelete={() => {
          // 対象行をグリッドから削除
          if (expenseData?.no != null) {
            expenseGridRef.current?.deleteRow(expenseData.no);
          }
          setShowDeleteExpensePane(false);
          toast.success('拡売費を削除しました。');
        }}
      />

      {/* 右ペイン：コメント履歴（共通コンポーネント。操作と操作後のステータスを表示） */}
      <CommentHistoryPane
        open={showCommentHistoryPane}
        onClose={() => setShowCommentHistoryPane(false)}
        items={COMMENT_HISTORY_DATA}
      />

      {/* 右ペイン：年契基本分・センターフィ率・取組強化マージン率（共通コンポーネント）
          メタブランド別は年契基本分・センターフィ率で選択可（取組強化マージン率は非活性） */}
      <CenterFeeAnnualContractIncentiveRatePane
        open={showAnnualContractPane}
        onClose={() => setShowAnnualContractPane(false)}
        title="年契基本分設定"
        description=""
        idPrefix="annual"
        marginRates={marginRates}
        enableBrandMode
        showWater2L
        // 施策区分・施策コードを表示する（必須）。管理区分・管理コードは担当者が選択
        showCampaign
        defaultPostingMonth={addMonths(targetYearMonth, 1)}
        // 拡売費計画グリッドで変えた計上月をペインにも反映する
        postingMonth={annualExpenseSetting?.postingMonth}
        onSubmit={(r) => {
          setAnnualContractAvg(r.averageDisplay);
          setAnnualExpenseSetting(toRateLinkedExpenseSetting(r));
        }}
        collapsed={isPaneCollapsed}
        onCollapsedChange={setIsPaneCollapsed}
      />
      <CenterFeeAnnualContractIncentiveRatePane
        open={showCenterFeePane}
        onClose={() => setShowCenterFeePane(false)}
        title="センターフィ設定"
        description=""
        idPrefix="centerfee"
        marginRates={marginRates}
        enablePB
        enableBrandMode
        // 管理区分・管理コードはマスタ管理者が設定した値を非活性で表示する
        fixedManagement
        // 計上月の初期値は対象年月の翌月
        defaultPostingMonth={addMonths(targetYearMonth, 1)}
        onSubmit={(r) => setCenterFeeAvg(r.averageDisplay)}
        collapsed={isPaneCollapsed}
        onCollapsedChange={setIsPaneCollapsed}
      />
      <CenterFeeAnnualContractIncentiveRatePane
        open={showWholesaleIncentivePane}
        onClose={() => setShowWholesaleIncentivePane(false)}
        title="取組強化マージン設定"
        description=""
        idPrefix="incentive"
        marginRates={marginRates}
        // 取組強化マージン率には社外売単価の指数が無いため非活性にする
        enableIndex={false}
        // 施策区分・施策コードを表示する（必須）。管理区分・管理コードは担当者が選択
        showCampaign
        defaultPostingMonth={addMonths(targetYearMonth, 1)}
        // 拡売費計画グリッドで変えた計上月をペインにも反映する
        postingMonth={incentiveExpenseSetting?.postingMonth}
        onSubmit={(r) => {
          setWholesaleIncentiveAvg(r.averageDisplay);
          setIncentiveExpenseSetting(toRateLinkedExpenseSetting(r));
        }}
        collapsed={isPaneCollapsed}
        onCollapsedChange={setIsPaneCollapsed}
      />
    </div>
  );
}
