import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { toast } from 'sonner';
import {
  Save,
  Send,
  Check,
  Undo2,
  Copy,
  CornerUpLeft,
  ArrowLeft,
} from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog';
import { PlanSearchPane } from '@/app/components/shared/sales-plan/plan-detail/PlanSearchPane';
import { PlanAggregationPane } from '@/app/components/shared/sales-plan/plan-detail/PlanAggregationPane';
import { PLAN_DETAIL_SECTION_OPTIONS } from '@/app/components/shared/sales-plan/plan-detail/PlanDetailHeaderMenus';
import { SegmentToggle } from '@/app/components/shared/common/SegmentToggle';
import { DetailTable } from './components/DetailTable';
import {
  PlanNonProductExpensePane,
  type NonProductExpenseGridHandle,
} from '@/app/components/shared/sales-plan/plan-detail/PlanNonProductExpensePane';
import type { DetailTableHandle } from './components/DetailTable';
import { RightPane } from '@/app/components/ui/right-pane';
import { CenterFeeAnnualContractIncentiveRatePane } from '@/app/components/shared/sales-plan/plan-detail/CenterFeeAnnualContractIncentiveRatePane';
import { MarginNetRatePane } from '@/app/components/shared/sales-plan/plan-detail/MarginNetRatePane';
import { NumericInput } from '@/app/components/ui/numeric-input';
import {
  PLAN_DETAIL_DIGITS,
  formatPlanAmountText,
  formatPlanCountText,
  formatPlanRateText,
} from '@/app/utils/sales-plan/common/planDetailNumberFormat';
import { Input } from '@/app/components/ui/input';
import { TEXT_INPUT_CLASS } from '@/styles/commonStyles';
import { Label } from '@/app/components/ui/label';
import { ExpenseBlockFields } from '@/app/components/shared/sales-plan/common/ExpenseBlockFields';
import { RequiredBadge } from '@/app/components/ui/required-badge';
import { SingleCombobox } from '@/app/components/ui/single-combobox';
import { BottomPane } from '@/app/components/ui/bottom-pane';
import {
  PlanReferencePeriodField,
  PlanReferenceTable,
  usePlanReferencePeriod,
} from '@/app/components/shared/sales-plan/plan-detail/PlanReferenceTable';
import { CommentHistoryPane } from '@/app/components/shared/common/CommentHistoryPane';
import {
  COMMENT_HISTORY_DATA,
  WHOLESALE_MARGIN_RATES,
  REGULAR_PRODUCTS_DATA,
  NEW_PRODUCTS_DATA,
  PROMOTION_PRODUCTS_DATA,
  GIFT_PRODUCTS_DATA,
} from '@/mocks/sales-plan/plan-detail-net-fixed';
import { EMPTY_DETAIL_FORM } from '@/app/components/sales-plan/plan-detail-net-fixed/constants';
import { EMPTY_EXPENSE_FORM } from '@/app/constants/nonProductExpenseForm';
import { type ExpenseFormValues } from '@/app/types/nonProductExpense';
import type {
  DetailFormValues,
  ProductData,
} from '@/app/types/salesPlanWholesale';
import { NON_PRODUCT_EXPENSE_ROWS } from '@/mocks/common/nonProductExpense';
import { toAggregationProducts } from '@/app/utils/sales-plan/plan-detail/planGridToAggregation';
import { toAggregationExpenses } from '@/app/utils/sales-plan/plan-detail/expenseGridToAggregation';
import { DEFAULT_META_BRAND } from '@/app/constants/nonProductExpenseForm';
import {
  expenseMissingFields,
  toExpenseForm,
  fromExpenseForm,
} from '@/app/utils/common/nonProductExpenseForm';
import {
  META_BRAND_MASTER,
  SUMMARY_PRODUCT_BY_WHOLESALE_MESH,
  EXPENSE_SUMMARY_PRODUCT_OPTIONS,
} from '@/app/constants/productMasters';
import { periodFromProductValue } from '@/app/utils/common/productMasters';
import { CURRENT_USER_NAME } from '@/mocks/common/planBasicInfo';
import { DEFAULT_TARGET_MONTH_IDX0 } from '@/app/constants/defaultAggregationSource';
import { addMonths, monthIndex0Of } from '@/app/utils/common/yearMonth';
import { computeMonth } from '@/app/utils/sales-plan/common/aggregationCalc';
import {
  buildRateLinkedExpenseRows,
  defaultRateLinkedExpenseSetting,
  toRateLinkedExpenseSetting,
  type RateLinkedExpenseSetting,
} from '@/app/utils/sales-plan/plan-detail/rateLinkedExpenseRows';
import { CATEGORY_OPTIONS_NET_ADDABLE } from '@/app/constants/promotionCategories';
import { DetailProductSelector } from '@/app/components/shared/sales-plan/common/DetailProductSelector';
import { isAfterTradingSystemChange } from '@/mocks/common/planBasicInfo';
import {
  promotionLabelsFor,
  promotionValueFor,
  promotionValid,
  promotionFixed,
} from '@/app/utils/sales-plan/common/promotionCategoryHelpers';
import { promotionComboOptions } from '@/app/constants/comboFieldOptions';
import { productCodeFromValue } from '@/app/utils/common/comboFieldOptions';
import { expenseSummaryProductOptionCode } from '@/app/utils/common/summaryProductSearch';
import { ScreenTitle } from '@/app/components/ui/screen-title';
import { useAppNavigation } from '@/app/components/ui/use-app-navigation';
import type { NonProductExpenseData } from '@/app/types/nonProductExpense';
import type { MarginRate } from '@/app/types/planDetail';
import { planBasicInfoOf } from '@/mocks/common/planBasicInfo';
import { CollapsibleCard } from '@/app/components/ui/collapsible-card';
import { UNIT_PRICE_KBN } from '@/mocks/common/planBasicInfo';
import { FooterCommentField } from '@/app/components/shared/common/FooterCommentField';

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

// セクション（タブ）→ 明細追加ペインの商品区分。
// 定番商品はペインの選択肢に無い（一般卸メッシュ単位で新規追加が発生しないため）ので、
// 定番商品タブ・全てタブから開いた場合は先頭の選択肢である新商品を初期表示する。
export const sectionToCategory = (section: string): string => {
  if (section.includes('特殊商品')) return '特殊商品';
  if (section === 'ギフト') return 'ギフト';
  return '新商品';
};

// ── フォーム共通ヘルパー ────────────────────────────────────
export const AUTO_INPUT_CLS =
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
// 明細フォームの未入力必須項目（主選択・販促区分・計画函数）。
// 主選択は定番商品＝一般卸メッシュ、それ以外＝サマリ商品名。
const detailMissingFields = (f: any): string[] => {
  const m: string[] = [];
  if (f.category === '定番商品') {
    if (String(f.wholesaleMesh ?? '').trim() === '') m.push('一般卸メッシュ');
  } else if (String(f.summaryProduct ?? '').trim() === '') {
    m.push('サマリ商品名');
  }
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
// 拡売費フォームのヘルパー（expenseMissingFields・toExpenseForm・fromExpenseForm）は
// 共通モジュール utils/common/nonProductExpenseForm に集約（単一ソース）。

// 計画の基本情報（モック。実システムでは計画1件の基本情報を API から受け取る）
const PLAN_BASIC_INFO = planBasicInfoOf('NET固定');

export default function PlanDetailNetFixed() {
  // 画面の切り替え（→ ui/use-app-navigation）
  const navigate = useAppNavigation();
  const [activeTab, setActiveTab] = useState<string>('sales-detail');
  // 汎用確認ダイアログ（戻る・遷移・対象年月変更・右ペイン更新で共通利用）
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    // 実行ボタンのラベル（操作名。画面設計標準 3.8 2/2）
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  // 「入力中のデータがリセットされます」確認を出して onOk を実行する（対象年月変更等）
  const requestResetConfirm = (onOk: () => void, title = '確認') =>
    setConfirmState({
      title,
      description: '入力中のデータがリセットされます。本当によろしいですか？',
      confirmLabel: '変更',
      onConfirm: onOk,
    });
  // 画面遷移（戻る・年間計画／シミュレーション）の確認。入力中データの破棄を確認する
  const requestDiscardConfirm = (onOk: () => void) =>
    setConfirmState({
      title: '画面移動の確認',
      description: '入力中のデータが破棄されます。本当によろしいですか？',
      confirmLabel: '移動',
      onConfirm: onOk,
    });
  // フッターのコメント入力（差戻し理由など）
  const [commentInput, setCommentInput] = useState('');
  const [isFixedMarginPaneShown, setIsFixedMarginPaneShown] = useState(false);
  const [isCommentHistoryPaneShown, setIsCommentHistoryPaneShown] =
    useState(false);

  // 明細系右ペインの状態管理
  const [isAddDetailPaneShown, setIsAddDetailPaneShown] = useState(false);
  const [detailSection, setDetailSection] = useState<string>('');

  // 販売計画(詳細)コピー用
  const detailTableRef = useRef<DetailTableHandle>(null);
  // 拡売費グリッドへの行操作ハンドル（追加/コピー/編集/削除を反映）
  const expenseGridRef = useRef<NonProductExpenseGridHandle>(null);

  // 明細追加・編集フォーム
  const [addForm, setAddForm] = useState<DetailFormValues>(EMPTY_DETAIL_FORM);
  const [isAddSubmitted, setIsAddSubmitted] = useState(false);

  // 拡売費追加・編集・コピーフォーム
  const [addExpenseForm, setAddExpenseForm] =
    useState<ExpenseFormValues>(EMPTY_EXPENSE_FORM);
  const [isAddExpenseSubmitted, setIsAddExpenseSubmitted] = useState(false);
  // 拡売費 各ペインの「新商品のみ表示」絞り込み状態
  const [isAddExpenseOnlyNew, setIsAddExpenseOnlyNew] = useState(false);

  // 拡売費系右ペインの状態管理
  const [isAddExpensePaneShown, setIsAddExpensePaneShown] = useState(false);
  const [pendingCopyExpenseRow, setPendingCopyExpenseRow] =
    useState<NonProductExpenseData | null>(null);

  // 対象年月（販売計画エリアの検索条件）。集計エリアと共有し、集計値を動的に駆動する。
  const [targetYearMonth, setTargetYearMonth] = useState('2025/10');
  // 拡売費計画(コピー元)の対象年月（下ペインの見出しの行で選ぶ）
  const [referencePeriod, setReferencePeriod] =
    usePlanReferencePeriod(targetYearMonth);

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
  // 月の解釈は utils/common/yearMonth の monthIndex0Of に集約する。PlanAggregationPane の
  // 「○月合計／1〜○月累計」も同じヘルパーを使うため、独自解釈するとソースの基準月と
  // 表示期間がズレる（基本情報の対象年月＝集計の基準月、という不変条件を壊さない）。
  const targetMonthIdx0 =
    monthIndex0Of(targetYearMonth) ?? DEFAULT_TARGET_MONTH_IDX0;

  // 集計ソース（補足3-1 の計算式の算出元）。グリッドの編集・行追加・行削除に追従する。
  const aggregationSource = useMemo(
    () => ({
      products: toAggregationProducts(detailRows, {
        planPattern: 'netFixed' as const,
        unitPriceKbn: UNIT_PRICE_KBN,
        targetMonthIdx0,
      }),
      expenses: toAggregationExpenses(expenseRows, { targetMonthIdx0 }),
    }),
    [detailRows, expenseRows, targetMonthIdx0]
  );

  // 拡売費「参照用」下ペインの状態管理
  const [isReferencePaneShown, setIsReferencePaneShown] = useState(false);
  // コピー元ペインを開いた際、拡売費計画（コピー先）タブがヘッダーメニュー直下に
  // 来るようスクロールするための参照。
  const referenceScrollRef = useRef<HTMLDivElement>(null);

  // コピー元ペインを展開したら、拡売費計画（コピー先）タブへ切り替え、その表の見出しが
  // 画面内スクロール領域の先頭（ヘッダーメニュー直下）へ来るようスクロールする。
  // scrollIntoView は main/ドキュメントまで動かして sticky ヘッダーの表示を乱すため使わず、
  // 最も近いスクロール可能な祖先だけを動かす。
  useEffect(() => {
    if (!isReferencePaneShown) return;
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
  }, [isReferencePaneShown]);
  // 参照表のコピーボタンで取り込む行（拡売費計画の最下行へ入れる）
  const [pendingReferenceCopyRows, setPendingReferenceCopyRows] = useState<
    NonProductExpenseData[] | null
  >(null);

  // 年契基本分・取組強化マージン系右ペインの状態管理
  const [isAnnualContractPaneShown, setIsAnnualContractPaneShown] =
    useState(false);
  const [isCenterFeePaneShown, setIsCenterFeePaneShown] = useState(false);
  const [isWholesaleIncentivePaneShown, setIsWholesaleIncentivePaneShown] =
    useState(false);

  // 固定マージン率データ
  const [marginRates, setMarginRates] = useState<MarginRate[]>(
    WHOLESALE_MARGIN_RATES
  );

  const handleMarginRatesChange = (rates: MarginRate[]) => {
    setMarginRates(rates);
  };

  // ボタン横の表示値は**単位を含んだ文字列**で保持する。
  // 率設定ペインは直接入力（金額）を選べるため、率なら「%」、金額なら「円」と単位が変わる。
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

  // 販売計画(詳細)の「計画コピー」右ペイン。他の右ペインと排他表示するため親で管理する。
  const [isCopyPaneShown, setIsCopyPaneShown] = useState(false);

  // 販売計画(集計)の「集計対象設定」右ペイン。他の右ペインと排他表示するため親で管理する。
  // （集計単位①②・除外ペアの値は集計コンポーネント側で保持するため開閉しても失われない）
  const [isAggFilterPaneShown, setIsAggFilterPaneShown] = useState(false);

  // 右ペインの折り畳み（付箋）状態。右ペインは常に1つのみ表示するため画面で1つ保持する。
  const [isPaneCollapsed, setIsPaneCollapsed] = useState(false);

  // すべての右ペインを閉じるヘルパー関数
  const closeAllRightPanes = () => {
    setIsAggFilterPaneShown(false);
    setIsFixedMarginPaneShown(false);
    setIsCommentHistoryPaneShown(false);
    setIsAddDetailPaneShown(false);
    setIsAddExpensePaneShown(false);
    setIsAnnualContractPaneShown(false);
    setIsCenterFeePaneShown(false);
    setIsWholesaleIncentivePaneShown(false);
    setIsReferencePaneShown(false);
    setIsCopyPaneShown(false);
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
    setIsAddSubmitted(true);
    const addMissing = detailMissingFields(addForm);
    if (addMissing.length) {
      toast.error(requiredMsg(addMissing));
      return;
    }
    // 合計行の直下（先頭）に新規明細を追加する。
    // 計画函数は必須項目のため、この時点で必ず値が入っている。
    // 追加先セクションはフォームで選択中の商品区分から決める（どの＋から開いたかではない）。
    // ペインで商品区分を変更した場合も、選択どおりのセクションへ追加される。
    // 商品区分は必須。未選択のフォールバックも、ペインで選べる先頭の区分に合わせる。
    const section = addForm.category || '新商品';
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
      // （ギフト/特殊商品は追加後に納価・NET を編集すると算出値へ戻る）
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
    setIsAddSubmitted(false);
    if (!continuous) setIsAddDetailPaneShown(false);
    toast.success('明細を追加しました。');
  };

  // 明細追加ペインを開く
  const handleOpenAddDetail = (section: string) => {
    const isOpen = isAddDetailPaneShown && detailSection === section;
    closeAllRightPanes();
    if (isOpen) return;
    setDetailSection(section);
    setAddForm({
      ...EMPTY_DETAIL_FORM,
      category: sectionToCategory(section),
    });
    setIsAddSubmitted(false);
    setIsAddDetailPaneShown(true);
  };

  // 明細を削除する（確認は出さず、削除したことをトーストで知らせる → 02 §5）
  const handleDeleteDetail = (data: any) => {
    if (data) detailTableRef.current?.deleteRow(data);
    toast.success('明細を削除しました。');
  };

  // 拡売費追加ペインを開く
  const handleOpenAddExpense = () => {
    const isOpen = isAddExpensePaneShown;
    closeAllRightPanes();
    if (isOpen) return;
    setAddExpenseForm({ ...EMPTY_EXPENSE_FORM, metaBrand: DEFAULT_META_BRAND });
    setIsAddExpenseSubmitted(false);
    setIsAddExpenseOnlyNew(false);
    setIsAddExpensePaneShown(true);
  };

  // 拡売費追加ペインの追加実行。
  // continuous=true（連続追加）はペインを開いたままフォームを初期化し、
  // false（追加）は他ペインと同様にペインを閉じる。
  const handleAddExpenseSubmit = (continuous: boolean) => {
    setIsAddExpenseSubmitted(true);
    const missing = expenseMissingFields(addExpenseForm, {
      metaBrandRequired: true,
    });
    if (missing.length) {
      toast.error(requiredMsg(missing));
      return;
    }
    // 最下行に追加（→ 02 §8「行の追加位置」・UX-112）
    expenseGridRef.current?.addRow(
      fromExpenseForm(addExpenseForm, CURRENT_USER_NAME)
    );
    setAddExpenseForm({ ...EMPTY_EXPENSE_FORM, metaBrand: DEFAULT_META_BRAND });
    setIsAddExpenseSubmitted(false);
    if (!continuous) setIsAddExpensePaneShown(false);
    toast.success('拡売費を追加しました。');
  };

  // 拡売費コピー：ペインを開かず、拡売費計画グリッドのコピー元の行のすぐ下へ直接行を複製する。
  // 前年実績は引き継がず（削除可）、作成者はログインユーザーになる（fromExpenseForm）。
  const handleCopyExpenseRow = (data: NonProductExpenseData) => {
    // コピー元の行（data.no）のすぐ下に入れる（→ 02 §8「行の追加位置」・UX-112）
    expenseGridRef.current?.addRow(
      {
        ...fromExpenseForm(toExpenseForm(data), CURRENT_USER_NAME),
        _copySource: 'detail',
      },
      data.no
    );
    toast.success('拡売費計画へコピーしました。');
  };

  // 拡売費を削除する（確認は出さず、削除したことをトーストで知らせる → 02 §5）
  const handleDeleteExpense = (data: NonProductExpenseData) => {
    if (data?.no != null) expenseGridRef.current?.deleteRow(data.no);
    toast.success('拡売費を削除しました。');
  };

  // 年契基本分ペインを開く
  const handleOpenAnnualContract = () => {
    togglePane(isAnnualContractPaneShown, () =>
      setIsAnnualContractPaneShown(true)
    );
  };

  // センターフィペインを開く
  const handleOpenCenterFee = () => {
    togglePane(isCenterFeePaneShown, () => setIsCenterFeePaneShown(true));
  };

  // 取組強化マージンペインを開く
  const handleOpenWholesaleIncentive = () => {
    togglePane(isWholesaleIncentivePaneShown, () =>
      setIsWholesaleIncentivePaneShown(true)
    );
  };

  // 販売計画(詳細)／拡売費計画の切替（それぞれの見出しの行の先頭に置く。UX-106）
  const sectionSwitch = (
    <SegmentToggle
      ariaLabel="販売計画の表示"
      options={[...PLAN_DETAIL_SECTION_OPTIONS]}
      value={activeTab}
      onChange={setActiveTab}
    />
  );

  return (
    <div className="flex h-full w-full overflow-hidden bg-gray-100">
      {/* 左ペイン：メインコンテンツ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* スクロール可能エリア */}
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <div className="min-w-300">
            <div className="px-6 pt-3 pb-2">
              {/* 画面名はヘッダー（システム名の右）に表示する */}
              <ScreenTitle title="計画詳細(NET固定)" />

              {/* 販売計画条件エリア */}
              <section aria-labelledby="search-heading">
                <h2 id="search-heading" className="sr-only">
                  検索条件
                </h2>
                <PlanSearchPane
                  // 折り畳んでも対象年月・ステータス・販売店を見出しに表示する
                  showSummaryWhenCollapsed
                  basicInfo={PLAN_BASIC_INFO}
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
                  aggFilterPaneOpen={isAggFilterPaneShown}
                  onToggleAggFilterPane={() =>
                    togglePane(isAggFilterPaneShown, () =>
                      setIsAggFilterPaneShown(true)
                    )
                  }
                  onCloseAggFilterPane={() => setIsAggFilterPaneShown(false)}
                  // 詳細タブのドリルダウン開閉状態を画面ごとに保存する
                  expandStateKey="PlanNetFixed.agg"
                  // 年間集計・拡売費集計タブも基本情報の対象年月を基準月にする
                  linkTotalTabsToTargetMonth
                />
              </section>

              {/* タブ切り替え: 販売計画(詳細) / 拡売費計画 */}
              <section ref={referenceScrollRef}>
                {/* 販売計画(詳細)／拡売費計画のタブと中身を1枚の影付きの開閉カードに入れる（→ 05「白カード」・UX-065） */}
                <CollapsibleCard title="販売計画" className="mb-4">
                  <div className="p-4">
                    {/* 販売計画(詳細)／拡売費計画の切替は、横いっぱいのタブにせず、それぞれの見出しの行の先頭に
                        SegmentToggle で置く（UI/UX UX-106 → 02 §10.4 PlanDetailHeaderMenus） */}
                    {activeTab === 'sales-detail' && (
                      <DetailTable
                        ref={detailTableRef}
                        sectionSwitch={sectionSwitch}
                        isPlanNavigationDisabled={isAfterTradingSystemChange(
                          targetYearMonth
                        )}
                        onNavigate={(menuId) =>
                          // 年間計画作成の基本情報を本画面と一致させるため取引制度を渡す
                          navigate(
                            menuId,
                            menuId === 'annual-plan-creation'
                              ? { tradingSystem: 'NET固定' }
                              : undefined
                          )
                        }
                        onOpenFixedMargin={() =>
                          togglePane(isFixedMarginPaneShown, () =>
                            setIsFixedMarginPaneShown(true)
                          )
                        }
                        onOpenAddDetail={handleOpenAddDetail}
                        onDeleteDetail={handleDeleteDetail}
                        onOpenAnnualContract={handleOpenAnnualContract}
                        onOpenCenterFee={handleOpenCenterFee}
                        onOpenWholesaleIncentive={handleOpenWholesaleIncentive}
                        copyPaneOpen={isCopyPaneShown}
                        onOpenCopyPane={() =>
                          togglePane(isCopyPaneShown, () =>
                            setIsCopyPaneShown(true)
                          )
                        }
                        onCloseCopyPane={() => setIsCopyPaneShown(false)}
                        annualContractAvg={annualContractAvg}
                        centerFeeAvg={centerFeeAvg}
                        wholesaleIncentiveAvg={wholesaleIncentiveAvg}
                        onRowsChange={handleDetailRowsChange}
                      />
                    )}

                    {activeTab === 'non-product-expense' && (
                      <PlanNonProductExpensePane
                        sectionSwitch={sectionSwitch}
                        initialRows={NON_PRODUCT_EXPENSE_ROWS}
                        ref={expenseGridRef}
                        onOpenAddExpense={handleOpenAddExpense}
                        onDeleteExpense={handleDeleteExpense}
                        onOpenCopyExpense={handleCopyExpenseRow}
                        pendingCopyRow={pendingCopyExpenseRow}
                        onCopyComplete={() => setPendingCopyExpenseRow(null)}
                        onOpenReference={() =>
                          togglePane(isReferencePaneShown, () =>
                            setIsReferencePaneShown(true)
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
                        ]}
                        onRateLinkedPostingMonthChange={
                          handleRateLinkedPostingMonthChange
                        }
                      />
                    )}
                  </div>
                </CollapsibleCard>
              </section>
            </div>
          </div>
        </div>

        {/* 拡売費「参照」下ペイン：自計画（過去12か月）を表示し、コピーボタンで拡売費計画へ追加。
            プッシュ式：親画面に被さらず中身を押し上げるため、参照表と拡売費計画を同時に視認できる。 */}
        <BottomPane
          open
          collapsed={!isReferencePaneShown}
          onCollapsedChange={(next) => setIsReferencePaneShown(!next)}
          onClose={() => setIsReferencePaneShown(false)}
          prominentTab
          collapsedTabLabel="過去の拡売費計画からコピー"
          collapsedTabIcon={<Copy className="h-4 w-4" />}
          title="拡売費計画(コピー元)"
          titleExtra={
            <PlanReferencePeriodField
              value={referencePeriod}
              onChange={setReferencePeriod}
              targetMonth={targetYearMonth}
            />
          }
          description="コピーボタン、または行のダブルクリックで拡売費計画へ追加できます"
        >
          <PlanReferenceTable
            period={referencePeriod}
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
              <button
                type="button"
                className="btn-action-base btn-action-outline"
                onClick={() =>
                  requestDiscardConfirm(() => navigate('plan-list'))
                }
              >
                <ArrowLeft className="h-4 w-4" />
                一覧へ戻る
              </button>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
              {/* コメント欄（支払詳細(追加口請求書有)と同一の複数行テキストエリア） */}
              <FooterCommentField
                id="sales-plan-wholesale-comment"
                value={commentInput}
                onChange={setCommentInput}
                onOpenHistory={() =>
                  togglePane(isCommentHistoryPaneShown, () =>
                    setIsCommentHistoryPaneShown(true)
                  )
                }
              />
              <button
                type="button"
                className="btn-action-base btn-action-red"
                onClick={() => toast.success('差し戻しました。')}
              >
                <Undo2 className="h-4 w-4" />
                差戻し
              </button>
              <button
                type="button"
                className="btn-action-base btn-action-green"
                onClick={() => toast.success('承認しました。')}
              >
                <Check className="h-4 w-4" />
                承認
              </button>
              <button
                type="button"
                className="btn-action-base btn-action-outline-blue"
                onClick={() => toast.success('計画を引き戻しました。')}
              >
                <CornerUpLeft className="h-4 w-4" />
                引戻し
              </button>
              <button
                type="button"
                className="btn-action-base btn-action-green"
                onClick={() => toast.success('計画承認申請を送信しました。')}
              >
                <Send className="h-4 w-4" />
                申請
              </button>

              <button
                type="button"
                className="btn-action-base btn-action-blue"
                onClick={() => {
                  // 保存したら明細コピー・明細追加の帯と編集セルの強調を消す
                  detailTableRef.current?.clearSavedMarks();
                  expenseGridRef.current?.clearSavedMarks?.();
                  toast.success('販売計画を保存しました。');
                }}
              >
                <Save className="h-4 w-4" />
                保存
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 右ペイン：固定マージン率設定（更新確認・トーストは MarginNetRatePane 内で実装） */}
      <MarginNetRatePane
        open={isFixedMarginPaneShown}
        onClose={() => setIsFixedMarginPaneShown(false)}
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
        open={isAddDetailPaneShown}
        onClose={() => setIsAddDetailPaneShown(false)}
        title="明細追加"
        description="明細を追加します"
        footer={
          <div className="flex items-center justify-end gap-3">
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
                showCategorySelect={true}
                categoryOptions={CATEGORY_OPTIONS_NET_ADDABLE}
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
                onSelectWholesaleMesh={(m) => {
                  // 一般卸メッシュ→対応サマリ商品の連動情報も自動補完（NET固定・定番）
                  const s = SUMMARY_PRODUCT_BY_WHOLESALE_MESH.get(m.value);
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
                    // メッシュ選択時に終売区分を自動反映（定番商品でも非活性表示）
                    endSale: m.endSale ?? '',
                    ...(s
                      ? {
                          summaryProduct: s.value,
                          promotion: s.promotion,
                          endSale: s.endSale,
                          deliveryPrice: s.deliveryPrice,
                          margin: s.margin,
                          price: s.price,
                          costOfSales: s.costOfSales,
                          seihan: s.seihan,
                          profitRate: s.profitRate,
                          discountRate: s.discountRate,
                          period: periodFromProductValue(s.value),
                        }
                      : {}),
                  }));
                }}
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
                submitted={isAddSubmitted}
                newProductBaseMonth={targetYearMonth}
                // 商品区分が新商品のときは「新商品のみ表示」を初期でチェックする
                onlyNewByDefaultForNewCategory
              />
            </div>
          </div>

          {/* 入力フォームエリア（コンテナ幅に応じて 1→2→3 列に変動） */}
          <div className="flex-1 overflow-y-auto bg-white p-4">
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 @md:grid-cols-2 @2xl:grid-cols-3">
              {/* 定番商品はサマリ商品名不要（主選択の一般卸メッシュのみ）。
                  定番商品以外（新商品／特殊商品／ギフト）の一般卸メッシュはサマリ商品名から決まるため、
                  入力させずにサマリ商品名の選択時に自動表示する（終売区分と同じ表示専用の項目）。 */}
              {addForm.category !== '定番商品' && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">
                    一般卸メッシュ
                  </Label>
                  <Input
                    value={dashIfEmpty(addForm.wholesaleMesh)}
                    readOnly
                    title="サマリ商品名を選択すると自動で表示されます"
                    className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
                  />
                </div>
              )}

              {/* 販促区分 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  販促区分 <RequiredBadge />
                </Label>
                {/* 商品区分によらず販促区分は活性・必須 */}
                <div
                  className={
                    isAddSubmitted && !promotionValueFor(addForm).trim()
                      ? 'rounded-md ring-1 ring-red-500'
                      : ''
                  }
                >
                  <SingleCombobox
                    ariaRequired
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
                          aria-required="true"
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
                            isAddSubmitted && !String(addForm[key] ?? '').trim()
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
                    aria-required="true"
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
                      isAddSubmitted && !String(addForm.plan ?? '').trim()
                        ? 'w-full bg-white border-gray-400 shadow-sm ring-1 ring-red-500 focus:ring-2 focus:ring-blue-500'
                        : 'w-full bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500'
                    }
                  />
                </div>
              )}

              {/* NET */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">NET</Label>
                {addForm.category === 'ギフト' ||
                addForm.category === '特殊商品' ? (
                  <NumericInput
                    value={addForm.net}
                    maxFractionDigits={PLAN_DETAIL_DIGITS.price}
                    onChange={(e) =>
                      setAddForm((p) => ({
                        ...p,
                        net: e.target.value,
                      }))
                    }
                    placeholder="NET（任意）"
                    className="w-full bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <Input
                    value={formatPlanAmountText(
                      addForm.net,
                      PLAN_DETAIL_DIGITS.price
                    )}
                    readOnly
                    className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
                  />
                )}
              </div>

              {/* 納価（商品区分によらず入力可。商品選択時はマスタ値を自動表示し、手入力で上書きできる） */}
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

              {/* マージン率（商品区分によらず入力可。商品選択時は算出値を自動表示し、手入力で上書きできる） */}
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

      {/* 右ペイン：拡売費追加 */}
      <RightPane
        open={isAddExpensePaneShown}
        onClose={() => setIsAddExpensePaneShown(false)}
        title="拡売費追加"
        description="拡売費を追加します"
        footer={
          <div className="flex items-center justify-end gap-3">
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
          const sub = isAddExpenseSubmitted;
          const onlyNew = isAddExpenseOnlyNew;
          const setOnlyNew = setIsAddExpenseOnlyNew;
          return (
            <div className="space-y-3">
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
                  placeholder="サマリ商品名を選択（任意）"
                  clearable
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
                    ariaRequired
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

      {/* 右ペイン：コメント履歴（共通コンポーネント。操作と操作後のステータスを表示） */}
      <CommentHistoryPane
        open={isCommentHistoryPaneShown}
        onClose={() => setIsCommentHistoryPaneShown(false)}
        items={COMMENT_HISTORY_DATA}
      />

      {/* 右ペイン：年契基本分・センターフィ率・取組強化マージン率（共通コンポーネント）
          メタブランド別は年契基本分・センターフィ率で選択可（取組強化マージン率は非活性） */}
      <CenterFeeAnnualContractIncentiveRatePane
        open={isAnnualContractPaneShown}
        onClose={() => setIsAnnualContractPaneShown(false)}
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
        open={isCenterFeePaneShown}
        onClose={() => setIsCenterFeePaneShown(false)}
        title="センターフィ設定"
        description=""
        idPrefix="centerfee"
        marginRates={marginRates}
        enablePB
        enableBrandMode
        // 管理区分・管理コードはセンターフィの値を初期表示し、担当者が上書きできる
        centerFeeManagement
        // 計上月の初期値は対象年月の翌月
        defaultPostingMonth={addMonths(targetYearMonth, 1)}
        onSubmit={(r) => setCenterFeeAvg(r.averageDisplay)}
        collapsed={isPaneCollapsed}
        onCollapsedChange={setIsPaneCollapsed}
      />
      <CenterFeeAnnualContractIncentiveRatePane
        open={isWholesaleIncentivePaneShown}
        onClose={() => setIsWholesaleIncentivePaneShown(false)}
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
