// 計画詳細（手売り）の画面の骨組み PlanDetailScreen（features/sales-plan/shared/plan-detail）に差し込む、計算のパターン（NET固定・マージン率固定）ごとの定義。
// 画面の骨組み（見出し・基本情報・集計・明細のカード・フッター・確認ダイアログ・右ペインの排他・保存の流れ）は共通にし、
// パターンで違うもの（値・明細の表・明細追加ペインの決まり・片方だけの機能）だけをここで渡す（→ 03 ファイルと関数の大きさ）。
import type { ComponentType, ReactNode, RefAttributes } from 'react';

import type { CommentHistoryItem } from '@/components/shared/common/CommentHistoryPane';
import type {
  SUMMARY_PRODUCT_OPTIONS,
  WHOLESALE_MESH_OPTIONS,
} from '@/constants/productMasters';
import type { MarginRate, PlanBasicInfo } from '@/types/planDetail';
import type { NonProductExpenseData } from '@/types/nonProductExpense';
import type { PlanPattern } from '@/utils/sales-plan/common/conditionUnitPrice';
// 行の型はマージン率固定（salesPlanRetail）が NET固定（salesPlanWholesale）に EDI の項目を足したもの。
// 骨組みは両方に共通の NET固定の型で書く。
import type { DetailFormValues, ProductData } from '@/types/salesPlanWholesale';

export type WholesaleMeshOption = (typeof WHOLESALE_MESH_OPTIONS)[number];
export type SummaryProductOption = (typeof SUMMARY_PRODUCT_OPTIONS)[number];

// 明細の表の操作（親の画面から呼ぶ）
export interface PlanDetailTableHandle {
  addCopiedRow: (data: ProductData) => void;
  // 明細追加：フォーム値から新規行を生成し、最下行へ追加
  addNewRow: (overrides: Partial<ProductData> & { section: string }) => void;
  // 明細削除：一意な id で対象行を表から除去
  deleteRow: (target: ProductData | string) => void;
  // ギフト以外の明細編集を id 一致で更新（商品区分＝section で対象配列を選択）
  updateRow: (data: ProductData) => void;
  // ギフト：上旬/中旬/下旬の3行を1セットとして追加（plans=各期間の箱数=計画函数）
  addGiftSet: (
    base: Partial<ProductData>,
    plans: [string, string, string]
  ) => void;
  // ギフト：セットをまるごと複製して新規セット（3行）を追加（コピー由来）
  addCopiedGiftSet: (
    base: Partial<ProductData>,
    plans: [string, string, string]
  ) => void;
  // ギフト：セットの共通項目・各期間の計画(箱数)を更新
  updateGiftSet: (
    giftSetId: string,
    base: Partial<ProductData>,
    plans: [string, string, string]
  ) => void;
  // ギフト：セットの現在値を取得（編集ペインの初期表示用）
  getGiftSet: (
    giftSetId: string
  ) => { base: ProductData; plans: [string, string, string] } | null;
  // 計画保存時：明細コピー・明細追加の帯と編集セルの強調を消し、未保存状態を解除する
  clearSavedMarks: () => void;
}

// 明細の表に親の画面が渡すもの
export interface PlanDetailTableProps {
  onOpenFixedMargin?: () => void;
  onOpenAddDetail?: (section: string) => void;
  onDeleteDetail?: (data: ProductData) => void;
  onOpenAnnualContract?: () => void;
  onOpenCenterFee?: () => void;
  onOpenWholesaleIncentive?: () => void;
  // コピーの右ペイン（null=閉／'plan'=計画コピー／'headquarters'=本部計画コピー）。
  // 他の右ペインと排他表示するため開閉は親が管理する。本部計画コピーはパターンの hasHeadquartersCopy のときだけ出す。
  copyPaneMode?: null | 'plan' | 'headquarters';
  onOpenPlanCopy?: () => void;
  onOpenHeadquartersCopy?: () => void;
  onCloseCopyPane?: () => void;
  // 各ペインで設定した値。**単位を含んだ表示用文字列**（率は `8.70%`、直接入力の金額は `123,000円`）。
  annualContractAvg?: string;
  centerFeeAvg?: string;
  wholesaleIncentiveAvg?: string;
  // 固定マージン率（各行設定値の平均）。パターンの showFixedMarginRate のときだけ表の見出しに出す
  fixedMarginAvg?: string;
  // 年間計画／シミュレーションへの画面遷移コールバック
  onNavigate?: (menuId: string) => void;
  // 年間計画・シミュレーションのボタンを非活性にするか（取引制度を変更した後の対象年月）
  isPlanNavigationDisabled?: boolean;
  // グリッドの全明細行が変わったときに親へ通知する（販売計画(集計)の算出元）。
  // 親側は必ず useCallback で安定化したハンドラを渡すこと（毎レンダリング再生成すると無限ループになる）。
  onRowsChange?: (rows: ProductData[]) => void;
  // 見出しの行の先頭に置く「販売計画(詳細)｜拡売費計画」の切替（親が持つ。UX-106）
  sectionSwitch?: ReactNode;
}

export interface PlanDetailPattern {
  // 画面名（ヘッダーに出す）
  screenTitle: string;
  // 取引制度（基本情報のモック・年間計画作成へ渡す値）
  tradingSystem: 'NET固定' | 'マージン率固定';
  // 販売計画(集計)の計算のパターン
  planPattern: PlanPattern;
  // 販売計画(集計)の詳細タブの開閉状態を保存するキー
  aggExpandStateKey: string;
  // フッターのコメント欄の id
  commentFieldId: string;
  // 明細の表（パターンごとの列の定義・計算を持つ）
  DetailTable: ComponentType<
    PlanDetailTableProps & RefAttributes<PlanDetailTableHandle>
  >;
  // 明細追加ペインの決まり
  addPane: {
    emptyForm: DetailFormValues;
    categoryOptions: { value: string; label: string }[];
    // 商品区分が未選択のまま追加したときに入れる区分（ペインで選べる先頭の区分）
    fallbackCategory: string;
    // 明細の表のセクション（どの＋から開いたか）→ ペインの商品区分の初期値
    sectionToCategory: (section: string) => string;
    // 未入力の必須項目名
    missingFields: (form: DetailFormValues) => string[];
    // 定番商品の主選択を一般卸メッシュにするか（DetailProductSelector の useWholesaleMesh）
    useWholesaleMesh: boolean;
    // 一般卸メッシュを選んだときのフォームの反映
    applyWholesaleMesh: (
      prev: DetailFormValues,
      mesh: WholesaleMeshOption
    ) => DetailFormValues;
    // 一般卸メッシュを表示専用の項目として出すか（商品区分ごと）
    showWholesaleMeshField: (category: string) => boolean;
    // NET を入力できるか（商品区分ごと。入力できないときは表示専用）
    isNetEditable: (category: string) => boolean;
  };
  // 本部計画コピーを出すか
  hasHeadquartersCopy: boolean;
  // 固定マージン率を明細の表・拡売費計画のリンクに出すか
  showFixedMarginRate: boolean;
  // 保存のときに明細の表へ追加で行う処理。戻り値の文言は保存のトーストの後に注意として出す
  onSave?: (table: PlanDetailTableHandle) => string | undefined;
}

// 計画1件のデータ。今は画面がモック（src/mocks）から作って渡し、バックエンドをつないだら API から受け取る。
// 骨組み（共通の置き場所）は src/mocks を読み込まないため、画面から受け取る（→ 04 §画面ディレクトリ構成「モックデータ」）。
export interface PlanDetailData {
  // 計画の基本情報
  basicInfo: PlanBasicInfo;
  // 明細の初期行（販売計画(集計)の算出元の初期値。明細の表が初期化に使うものと同じ並び）
  initialDetailRows: () => ProductData[];
  // 拡売費計画の初期行
  initialExpenseRows: NonProductExpenseData[];
  // 固定マージン率の初期値
  initialMarginRates: MarginRate[];
  // コメント履歴
  commentHistory: CommentHistoryItem[];
  // 単価区分（販売計画(集計)の算出に使う）
  unitPriceKbn: string;
  // ログインユーザー名（拡売費の作成者）
  currentUserName: string;
  // 取引制度を変更した後の対象年月か（年間計画・シミュレーションのボタンを非活性にする）
  isAfterTradingSystemChange: (yearMonth: string) => boolean;
}
