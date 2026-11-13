// 未償却案件請求画面：支払詳細(商流販売店紐づけなし)（PaymentDetailUnlinked）をコピーし、基本情報カードだけを残した画面。
// タブ・支払明細情報・拡売費グリッド・計画明細選択ペイン・フッター等は削除している。
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible';
import { Input } from '@/app/components/ui/input';
import { TEXT_INPUT_CLASS, CARD_CLASS } from '@/styles/commonStyles';
import {
  SingleCombobox,
  type SingleComboboxOption,
} from '@/app/components/ui/single-combobox';
import { DateMonthYearPicker } from '@/app/components/ui/date-month-year-picker';
import { CollapsibleCard } from '@/app/components/ui/collapsible-card';
import { RightPane } from '@/app/components/ui/right-pane';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from '@/app/components/ui/alert-dialog';
import {
  ChevronDown,
  History,
  X,
  Undo2,
  Trash2,
  Check,
  Send,
  Save,
  Printer,
  CornerUpLeft,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ScreenTitle } from '@/app/components/ui/screen-title';
import { useAppNavigation } from '@/app/components/ui/use-app-navigation';
import { FooterCommentField } from '@/app/components/shared/common/FooterCommentField';

// フッターの支払確認ダイアログで扱うアクション種別（支払詳細(自販機)と同一＋取消）
type ConfirmAction =
  | 'apply'
  | 'withdraw'
  | 'approve'
  | 'reject'
  | 'cancel'
  | null;

// 支払確認ダイアログのメッセージ（支払詳細(自販機)と同一）
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
    description: '請求データを申請します。よろしいですか？',
    toast: '申請が完了しました。',
    button: '申請',
    buttonClass: 'bg-green-500 hover:bg-green-600',
  },
  withdraw: {
    title: '引戻しの確認',
    description: '請求データを引戻しします。よろしいですか？',
    toast: '引戻しが完了しました。',
    button: '引戻し',
    buttonClass:
      'bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50',
  },
  approve: {
    title: '承認の確認',
    description: '請求データを承認します。よろしいですか？',
    toast: '承認が完了しました。',
    button: '承認',
    buttonClass: 'bg-green-500 hover:bg-green-600',
  },
  reject: {
    title: '差戻しの確認',
    description: '請求データを差戻しします。よろしいですか？',
    toast: '差戻しが完了しました。',
    button: '差戻し',
    buttonClass: 'bg-red-500 hover:bg-red-600',
  },
  cancel: {
    title: '解約取消の確認',
    description: '解約処理を取消します。よろしいですか？',
    toast: '解約取消が完了しました。',
    button: '解約取消',
    buttonClass: 'bg-red-500 hover:bg-red-600',
  },
};

// 対象年月（テキスト表示）
const TARGET_MONTH = '2025年10月';

// 支払No.（テキスト表示）
const PAYMENT_NO = 'C2400NTO4';

// 契約状況（テキスト表示・モック）
const CONTRACT_STATUS = '解約処理中';

// ステータス（テキスト表示・モック）
const PAYMENT_STATUS = '未申請';

// CRMコード（テキスト表示・モック）
const CRM_CODE = 'CRM001';

// 販売店・一次店・三次店（テキスト表示。「コード値：名称」形式）
const SALES_STORE = '999999999:その他販売店';
const PRIMARY_STORE = '99999977:卸共通';
const TERTIARY_STORE = '99999977:卸共通';

// 事業場・部署・営業担当者（テキスト表示）
const OFFICE = '10000623:首都圏本部';
const DEPARTMENT = '10002990:首都圏営業第二部';
const SALES_REP = '5172733:アサヒ　太郎';

// 支払回数（固定値・テキスト表示）
const PAYMENT_COUNT = '1';

// 税区分の選択肢（請求情報カード）
const TAX_CATEGORY_OPTIONS = [
  '1:課税10%',
  '2:課税8%',
  '3:その他(5%)',
  '4:その他(非課税)',
];

// 管理区分・管理コードは "コード:名称"（例 "K83:その他未収入金"）の1値で保持する。
// 値からコード／名称を取り出すヘルパー（支払詳細(自販機)の支払情報グリッドと同方式）。
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

// "コード:名称" を SingleCombobox の選択肢へ変換する。
// 主表示＝コード（label）／副表示＝名称（code）とし、コード・名称どちらでも絞り込める。
const toCodeOption = (opt: string): SingleComboboxOption => ({
  value: opt,
  label: splitCategoryCode(opt),
  code: splitCategoryName(opt),
});

// 管理区分の選択肢（"コード:名称"）。初期値 K83:その他未収入金 を含む。
const MGMT_CATEGORY_OPTIONS = [
  'K83:その他未収入金',
  '127:オペ条件口(手出票)',
  '33S:ロケ運転費',
  '69D:オペ協力金',
  '69F:その他一時費用',
  '69E:ロケ契約料',
  '604:ロケ契約料他前払い金(償却)',
  'V7P:コラム料',
  'V7U:販売器具費',
];
const MGMT_CATEGORY_COMBO_OPTIONS = MGMT_CATEGORY_OPTIONS.map(toCodeOption);

// 管理コードの選択肢（"コード:名称"）。初期値 99999:その他未収入金 を含む。
const MGMT_CODE_OPTIONS = [
  '99999:その他未収入金',
  '10010:本社',
  '10020:支社Ａ　自販機部門',
  '10180:支社Ｂ自販機（共通）',
  '10210:支社Ｂ開発（開拓）',
];
const MGMT_CODE_COMBO_OPTIONS = MGMT_CODE_OPTIONS.map(toCodeOption);

// 請求書発行区分の選択肢（請求先情報カード）
const INVOICE_ISSUE_TYPE_OPTIONS = [
  'E:通常発行(10%)',
  'I:即時発行(10%)',
  '3:発行なし',
  'D:通常発行(軽税8%)',
  'H:即時発行(軽税8%)',
  '6:通常発行(税なし)',
  '7:即時発行(税なし)',
  'W:即時発行 税修正10%',
  'L:即時発行 税修正軽8%',
  '1:通常発行(旧8%)',
  '2:即時発行(旧8%)',
  '8:即時発行(税修正 旧8%)',
  'Q:即時発行 5%',
  'S:即時発行 税修正5%',
  'T:即時発行 税修正3%',
  'M:通常(軽税8%)返還請求',
  'X:通常(10%)返還請求',
];
// 回収方法の選択肢（請求先情報カード・プレースホルダ）
const COLLECTION_METHOD_OPTIONS = ['1:振込', '2:口座振替', '3:相殺'];

// コメント履歴のモックデータ
const COMMENT_HISTORY_DATA = [
  {
    actionType: '承認',
    datetime: '2025/02/21 12:47:05',
    userName: '◇山　〇郎',
    comment: '',
  },
  {
    actionType: '申請',
    datetime: '2025/02/21 09:30:45',
    userName: '河〇　雅◇',
    comment: '請求書の承認をお願いします。',
  },
  {
    actionType: '保存',
    datetime: '2025/02/21 09:20:45',
    userName: '河〇　雅◇',
    comment: '取引先と請求金額を調整中。',
  },
  {
    actionType: '差戻し',
    datetime: '2025/02/20 18:47:05',
    userName: '◇山　〇郎',
    comment: '月途中の解約は契約時の取り決めに従うこと。',
  },
];

// 基本情報カードのラベル・値の共通クラス（青字ラベル／右寄せ・値は左寄せテキスト）
const CARD_LABEL_CLASS =
  'text-sm text-blue-900 whitespace-nowrap w-36 text-right font-bold px-2 py-1';
const CARD_VALUE_CLASS =
  'flex-1 h-8 flex items-center text-sm px-2 text-gray-900';
// 請求情報カードの入力欄（Input）共通クラス
const CARD_INPUT_CLASS = 'flex-1 text-gray-900';
// 請求情報カードの読み取り専用欄（管理区分名称・管理コード名称）共通クラス。
// 変更不可の管理区分／管理コード（disabled の SingleCombobox）と見た目を揃える
// （bg-gray-100／border-gray-200／opacity-70／cursor-not-allowed・影なし）。
const CARD_READONLY_INPUT_CLASS =
  'flex-1 text-gray-900 bg-gray-100 border-gray-200 opacity-70 cursor-not-allowed';

export default function UnamortizedProjectBilling() {
  // 画面の切り替え（→ ui/use-app-navigation）
  const navigate = useAppNavigation();
  // 基本情報カードの開閉状態
  const [isOpen, setIsOpen] = useState(true);
  // コメント履歴ペイン（右スライド）の開閉状態
  const [showCommentHistoryPane, setShowCommentHistoryPane] = useState(false);

  // フッター（支払詳細(自販機)と同一）：コメント入力・戻る確認・支払確認ダイアログ
  const [commentInput, setCommentInput] = useState('');
  const [isBackDialogOpen, setIsBackDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  // 請求情報カードの開閉状態
  const [isBillingOpen, setIsBillingOpen] = useState(true);
  // 請求先情報カードの開閉状態・入力項目
  const [isBillingDestOpen, setIsBillingDestOpen] = useState(true);
  const [billingTo, setBillingTo] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [address3, setAddress3] = useState('');
  const [invoiceIssueType, setInvoiceIssueType] = useState('');
  const [invoiceIssueDate, setInvoiceIssueDate] = useState('');
  const [billingContent, setBillingContent] = useState('');
  const [collectionMethod, setCollectionMethod] = useState('');
  const [collectionScheduledDate, setCollectionScheduledDate] = useState('');

  // 請求情報カードの入力項目
  const [cancellationDate, setCancellationDate] = useState('');
  // 管理区分・管理コードは "コード:名称" の1値で保持（名称欄は選択値から自動表示）。初期値あり。
  const [mgmtCategory, setMgmtCategory] = useState('K83:その他未収入金');
  const [mgmtCode, setMgmtCode] = useState('99999:その他未収入金');
  const [billingAmount, setBillingAmount] = useState('');
  const [taxCategory, setTaxCategory] = useState('1:課税10%');
  const [billingNote1, setBillingNote1] = useState('');

  // 請求書出力押下処理（トースト通知のみ・API連携は未実装）
  const handleInvoiceOutput = () => {
    toast.success('請求書を出力しました。');
  };

  // 保存（支払詳細(自販機)と同一）
  const handleSave = () => {
    toast.success('保存が完了しました。');
  };

  // 戻る確定 → ロケ契約(償却)一覧へ遷移
  const handleBackConfirm = () => {
    setIsBackDialogOpen(false);
    navigate('location-contract-amortization-list');
  };

  // 支払確認ダイアログの確定（支払詳細(自販機)と同一）
  const handleConfirmAction = () => {
    if (!confirmAction) return;
    toast.success(CONFIRM_MESSAGE_MAP[confirmAction].toast);
    setConfirmAction(null);
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
              <ScreenTitle title="未償却案件請求" />

              {/* 基本情報カード（支払詳細(商流販売店紐づけなし)から流用） */}
              <section aria-labelledby="basic-info-heading">
                <h2 id="basic-info-heading" className="sr-only">
                  基本情報
                </h2>
                <Collapsible
                  open={isOpen}
                  onOpenChange={setIsOpen}
                  className={`${CARD_CLASS} overflow-hidden mb-4`}
                >
                  {/* タイトルヘッダー */}
                  <div className="bg-white px-3 pt-2 pb-4 card-header-accent flex items-center justify-between">
                    <span className="text-gray-900 font-bold text-lg">
                      基本情報
                    </span>

                    <CollapsibleTrigger className="hover:text-blue-700 transition-colors">
                      <ChevronDown
                        className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      {/* 1行目: 対象年月 / 支払No. / 支払回数 */}
                      <div className="grid grid-cols-4 gap-3 mb-2 pb-3 border-b border-gray-300">
                        {/* 対象年月 */}
                        <div className="flex items-center gap-2">
                          <label className={CARD_LABEL_CLASS}>対象年月</label>
                          <div className={CARD_VALUE_CLASS}>{TARGET_MONTH}</div>
                        </div>

                        {/* 支払No. */}
                        <div className="flex items-center gap-2">
                          <label className={CARD_LABEL_CLASS}>支払No.</label>
                          <div className={CARD_VALUE_CLASS}>{PAYMENT_NO}</div>
                        </div>

                        {/* 支払回数（固定値・テキスト表示） */}
                        <div className="flex items-center gap-2">
                          <label className={CARD_LABEL_CLASS}>支払回数</label>
                          <div className={CARD_VALUE_CLASS}>
                            {PAYMENT_COUNT}
                          </div>
                        </div>

                        {/* 空白セル（4列目） */}
                        <div className="flex items-center gap-2"></div>
                      </div>

                      {/* 2行目: CRMコード / 契約状況 / ステータス（＋コメント履歴） */}
                      <div className="grid grid-cols-4 gap-3 mb-2 pb-3 border-b border-gray-300">
                        {/* CRMコード（2段目の先頭） */}
                        <div className="flex items-center gap-2">
                          <label className={CARD_LABEL_CLASS}>CRMコード</label>
                          <div className={CARD_VALUE_CLASS}>{CRM_CODE}</div>
                        </div>

                        {/* 契約状況（CRMコードの右） */}
                        <div className="flex items-center gap-2">
                          <label className={CARD_LABEL_CLASS}>契約状況</label>
                          <div className={CARD_VALUE_CLASS}>
                            {CONTRACT_STATUS}
                          </div>
                        </div>

                        {/* ステータス（契約状況の右・＋コメント履歴ボタン） */}
                        <div className="flex items-center gap-2 col-span-2">
                          <label className={CARD_LABEL_CLASS}>ステータス</label>
                          <span className="h-8 flex items-center text-sm text-gray-900">
                            {PAYMENT_STATUS}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setShowCommentHistoryPane((prev) => !prev)
                            }
                            className="btn-toolbar-outline ml-4"
                            aria-label="コメント履歴"
                          >
                            <History className="h-4 w-4" />
                            コメント履歴
                          </button>
                        </div>
                      </div>

                      {/* 3行目: 販売店 / 三次店 / 一次店 */}
                      <div className="grid grid-cols-4 gap-3 mb-2 pb-3 border-b border-gray-300">
                        {/* 販売店 */}
                        <div className="flex items-center gap-2">
                          <label className={CARD_LABEL_CLASS}>販売店</label>
                          <div className={CARD_VALUE_CLASS}>{SALES_STORE}</div>
                        </div>

                        {/* 三次店 */}
                        <div className="flex items-center gap-2">
                          <label className={CARD_LABEL_CLASS}>三次店</label>
                          <div className={CARD_VALUE_CLASS}>
                            {TERTIARY_STORE}
                          </div>
                        </div>

                        {/* 一次店 */}
                        <div className="flex items-center gap-2">
                          <label className={CARD_LABEL_CLASS}>一次店</label>
                          <div className={CARD_VALUE_CLASS}>
                            {PRIMARY_STORE}
                          </div>
                        </div>

                        {/* 空白セル（4列目） */}
                        <div className="flex items-center gap-2"></div>
                      </div>

                      {/* 4行目: 事業場 / 部署 / 営業担当者（最終行のため下区切り罫線なし） */}
                      <div className="grid grid-cols-4 gap-3">
                        {/* 事業場 */}
                        <div className="flex items-center gap-2">
                          <label className={CARD_LABEL_CLASS}>事業場</label>
                          <div className={CARD_VALUE_CLASS}>{OFFICE}</div>
                        </div>

                        {/* 部署 */}
                        <div className="flex items-center gap-2">
                          <label className={CARD_LABEL_CLASS}>部署</label>
                          <div className={CARD_VALUE_CLASS}>{DEPARTMENT}</div>
                        </div>

                        {/* 営業担当者 */}
                        <div className="flex items-center gap-2">
                          <label className={CARD_LABEL_CLASS}>営業担当者</label>
                          <div className={CARD_VALUE_CLASS}>{SALES_REP}</div>
                        </div>

                        {/* 空白セル（4列目） */}
                        <div className="flex items-center gap-2"></div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </section>

              {/* 請求情報カード（左）／請求先情報カード（右）を横並び。半幅のため各カードは1列レイアウト。
                  表示順は order で入れ替える（請求情報＝order-1・請求先情報＝order-2）。 */}
              <div className="grid grid-cols-2 gap-3 items-start">
                {/* 請求先情報カード（右・order-2） */}
                <section
                  aria-labelledby="billing-dest-heading"
                  className="order-2"
                >
                  <h2 id="billing-dest-heading" className="sr-only">
                    請求先情報
                  </h2>
                  <CollapsibleCard
                    title="請求先情報"
                    open={isBillingDestOpen}
                    onOpenChange={setIsBillingDestOpen}
                    headerActions={
                      <button
                        type="button"
                        className="btn-toolbar-outline"
                        aria-label="請求書出力"
                        onClick={handleInvoiceOutput}
                      >
                        <Printer className="h-4 w-4" />
                        請求書出力
                      </button>
                    }
                  >
                    <div className="p-4">
                      <div className="space-y-3">
                        {/* 請求先 */}
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="billing-to"
                            className={CARD_LABEL_CLASS}
                          >
                            請求先
                          </label>
                          <Input
                            id="billing-to"
                            className={`${TEXT_INPUT_CLASS} ${CARD_INPUT_CLASS}`}
                            value={billingTo}
                            onChange={(e) => setBillingTo(e.target.value)}
                          />
                        </div>

                        {/* 郵便番号（入力幅は請求書発行日付等の日付欄と同じ幅に固定） */}
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="postal-code"
                            className={CARD_LABEL_CLASS}
                          >
                            郵便番号
                          </label>
                          <div className="w-[9.375rem]">
                            <Input
                              id="postal-code"
                              className={`${TEXT_INPUT_CLASS} ${CARD_INPUT_CLASS}`}
                              value={postalCode}
                              onChange={(e) => setPostalCode(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* 住所1 */}
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="address1"
                            className={CARD_LABEL_CLASS}
                          >
                            住所1
                          </label>
                          <Input
                            id="address1"
                            className={`${TEXT_INPUT_CLASS} ${CARD_INPUT_CLASS}`}
                            value={address1}
                            onChange={(e) => setAddress1(e.target.value)}
                          />
                        </div>

                        {/* 住所2 */}
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="address2"
                            className={CARD_LABEL_CLASS}
                          >
                            住所2
                          </label>
                          <Input
                            id="address2"
                            className={`${TEXT_INPUT_CLASS} ${CARD_INPUT_CLASS}`}
                            value={address2}
                            onChange={(e) => setAddress2(e.target.value)}
                          />
                        </div>

                        {/* 住所3 */}
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="address3"
                            className={CARD_LABEL_CLASS}
                          >
                            住所3
                          </label>
                          <Input
                            id="address3"
                            className={`${TEXT_INPUT_CLASS} ${CARD_INPUT_CLASS}`}
                            value={address3}
                            onChange={(e) => setAddress3(e.target.value)}
                          />
                        </div>

                        {/* 請求書発行日付 ＋ 請求書発行区分（横並び：日付を左、区分を右へ移動）。
                            日付ラベルは他行と揃えて w-36、区分ラベルは行中のため自然幅にして
                            セレクトの表示幅を確保する。 */}
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="invoice-issue-date"
                            className={CARD_LABEL_CLASS}
                          >
                            請求書発行日付
                          </label>
                          <div className="w-[9.375rem]">
                            <DateMonthYearPicker
                              value={invoiceIssueDate}
                              onChange={setInvoiceIssueDate}
                              className="w-full"
                            />
                          </div>
                          <label
                            htmlFor="invoice-issue-type"
                            className="text-sm text-blue-900 whitespace-nowrap font-bold px-2 py-1 w-32 text-right"
                          >
                            請求書発行区分
                          </label>
                          <SingleCombobox
                            id="invoice-issue-type"
                            className="flex-1"
                            options={[
                              ...INVOICE_ISSUE_TYPE_OPTIONS.map((opt) => ({
                                value: opt,
                                label: opt,
                              })),
                            ]}
                            value={invoiceIssueType}
                            onChange={setInvoiceIssueType}
                            placeholder="選択"
                            searchable={false}
                          />
                        </div>

                        {/* 請求内容 */}
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="billing-content"
                            className={CARD_LABEL_CLASS}
                          >
                            請求内容
                          </label>
                          <Input
                            id="billing-content"
                            className={`${TEXT_INPUT_CLASS} ${CARD_INPUT_CLASS}`}
                            value={billingContent}
                            onChange={(e) => setBillingContent(e.target.value)}
                          />
                        </div>

                        {/* 回収予定日 ＋ 回収方法（横並び：予定日を左、回収方法を右へ移動）。
                            予定日ラベルは他行と揃えて w-36、回収方法ラベルは行中のため自然幅にして
                            セレクトの表示幅を確保する。 */}
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="collection-scheduled-date"
                            className={CARD_LABEL_CLASS}
                          >
                            回収予定日
                          </label>
                          <div className="w-[9.375rem]">
                            <DateMonthYearPicker
                              value={collectionScheduledDate}
                              onChange={setCollectionScheduledDate}
                              className="w-full"
                            />
                          </div>
                          <label
                            htmlFor="collection-method"
                            className="text-sm text-blue-900 whitespace-nowrap font-bold px-2 py-1 w-32 text-right"
                          >
                            回収方法
                          </label>
                          <SingleCombobox
                            id="collection-method"
                            className="flex-1"
                            options={[
                              ...COLLECTION_METHOD_OPTIONS.map((opt) => ({
                                value: opt,
                                label: opt,
                              })),
                            ]}
                            value={collectionMethod}
                            onChange={setCollectionMethod}
                            placeholder="選択"
                            searchable={false}
                          />
                        </div>
                      </div>
                    </div>
                  </CollapsibleCard>
                </section>

                {/* 請求情報カード（左・order-1） */}
                <section
                  aria-labelledby="billing-info-heading"
                  className="order-1"
                >
                  <h2 id="billing-info-heading" className="sr-only">
                    請求情報
                  </h2>
                  <CollapsibleCard
                    title="請求情報"
                    open={isBillingOpen}
                    onOpenChange={setIsBillingOpen}
                  >
                    <div className="p-4">
                      <div className="space-y-3">
                        {/* 解約日 */}
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="cancellation-date"
                            className={CARD_LABEL_CLASS}
                          >
                            解約日
                          </label>
                          <div className="w-[9.375rem]">
                            <DateMonthYearPicker
                              value={cancellationDate}
                              onChange={setCancellationDate}
                              className="w-full"
                            />
                          </div>
                        </div>

                        {/* 管理区分 ＋ 管理区分名称（横並び） */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* 管理区分（変更不可・"コード:名称" を表示。支払情報グリッドと同方式） */}
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor="mgmt-category"
                              className={CARD_LABEL_CLASS}
                            >
                              管理区分
                            </label>
                            <div className="flex-1">
                              <SingleCombobox
                                id="mgmt-category"
                                options={MGMT_CATEGORY_COMBO_OPTIONS}
                                value={mgmtCategory}
                                onChange={setMgmtCategory}
                                placeholder="コード または 名称で検索..."
                                disabled
                              />
                            </div>
                          </div>

                          {/* 管理区分名称（管理区分の選択値から自動表示・読み取り専用） */}
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor="mgmt-category-name"
                              className={CARD_LABEL_CLASS}
                            >
                              管理区分名称
                            </label>
                            <Input
                              id="mgmt-category-name"
                              className={`${TEXT_INPUT_CLASS} ${CARD_READONLY_INPUT_CLASS}`}
                              value={splitCategoryName(mgmtCategory)}
                              readOnly
                            />
                          </div>
                        </div>

                        {/* 管理コード ＋ 管理コード名称（横並び） */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* 管理コード（変更不可・"コード:名称" を表示） */}
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor="mgmt-code"
                              className={CARD_LABEL_CLASS}
                            >
                              管理コード
                            </label>
                            <div className="flex-1">
                              <SingleCombobox
                                id="mgmt-code"
                                options={MGMT_CODE_COMBO_OPTIONS}
                                value={mgmtCode}
                                onChange={setMgmtCode}
                                placeholder="コード または 名称で検索..."
                                disabled
                              />
                            </div>
                          </div>

                          {/* 管理コード名称（管理コードの選択値から自動表示・読み取り専用） */}
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor="mgmt-code-name"
                              className={CARD_LABEL_CLASS}
                            >
                              管理コード名称
                            </label>
                            <Input
                              id="mgmt-code-name"
                              className={`${TEXT_INPUT_CLASS} ${CARD_READONLY_INPUT_CLASS}`}
                              value={splitCategoryName(mgmtCode)}
                              readOnly
                            />
                          </div>
                        </div>

                        {/* 請求金額 ＋ 税区分（横並び） */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* 請求金額 */}
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor="billing-amount"
                              className={CARD_LABEL_CLASS}
                            >
                              請求金額
                            </label>
                            <Input
                              id="billing-amount"
                              className={`${TEXT_INPUT_CLASS} ${CARD_INPUT_CLASS} text-right`}
                              value={billingAmount}
                              onChange={(e) => setBillingAmount(e.target.value)}
                            />
                          </div>

                          {/* 税区分 */}
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor="tax-category"
                              className={CARD_LABEL_CLASS}
                            >
                              税区分
                            </label>
                            <SingleCombobox
                              id="tax-category"
                              className="flex-1"
                              options={[
                                ...TAX_CATEGORY_OPTIONS.map((opt) => ({
                                  value: opt,
                                  label: opt,
                                })),
                              ]}
                              value={taxCategory}
                              onChange={setTaxCategory}
                              placeholder="選択してください"
                              searchable={false}
                            />
                          </div>
                        </div>

                        {/* 摘要1（社内用） */}
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="billing-note1"
                            className={CARD_LABEL_CLASS}
                          >
                            摘要1（社内用）
                          </label>
                          <Input
                            id="billing-note1"
                            className={`${TEXT_INPUT_CLASS} ${CARD_INPUT_CLASS}`}
                            value={billingNote1}
                            onChange={(e) => setBillingNote1(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </CollapsibleCard>
                </section>
              </div>
            </div>

            {/* フッターエリア（固定・支払詳細(自販機)と同一） */}
            <div className="bg-white border-t border-gray-200 px-6 py-2 sticky bottom-0 z-10 mt-4 min-w-[75rem]">
              <div className="flex flex-wrap gap-3 justify-between">
                <div>
                  <button
                    className="btn-action-base btn-action-outline"
                    onClick={() => setIsBackDialogOpen(true)}
                    aria-label="一覧へ戻る"
                  >
                    <Undo2 className="h-4 w-4" />
                    一覧へ戻る
                  </button>
                </div>

                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
                  {/* コメント欄（差戻しボタンの左・販売・経費計画申請承認を参考） */}
                  <FooterCommentField
                    id="approval-comment"
                    value={commentInput}
                    onChange={setCommentInput}
                  />
                  {/* 解約取消 */}
                  <button
                    className="btn-action-base btn-action-red"
                    onClick={() => setConfirmAction('cancel')}
                    aria-label="解約取消"
                  >
                    <Trash2 className="h-4 w-4" />
                    解約取消
                  </button>
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
          </div>
        </div>
      </div>

      {/* 右ペイン：コメント履歴 */}
      <RightPane
        open={showCommentHistoryPane}
        onClose={() => setShowCommentHistoryPane(false)}
        title="コメント履歴"
        description=""
      >
        <div className="space-y-3">
          {COMMENT_HISTORY_DATA.map((item, index) => (
            <div
              key={index}
              className="bg-gray-50 p-4 rounded-lg space-y-2 border border-gray-200"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900">
                  {item.actionType}
                </span>
                <span className="text-sm text-gray-600">{item.datetime}</span>
                <span className="text-sm text-gray-900">{item.userName}</span>
              </div>
              {item.comment && (
                <div className="text-sm text-gray-700 bg-white p-2 rounded border border-gray-200">
                  {item.comment}
                </div>
              )}
            </div>
          ))}
        </div>
      </RightPane>

      {/* 戻る確認ダイアログ（支払詳細(自販機)と同一） */}
      <AlertDialog open={isBackDialogOpen} onOpenChange={setIsBackDialogOpen}>
        <AlertDialogContent>
          {/* ×ボタン */}
          <button
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
            onClick={() => setIsBackDialogOpen(false)}
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
              ロケ契約(償却)一覧画面へ戻ります。編集中の内容は保存されません。よろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
              onClick={handleBackConfirm}
            >
              移動
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 支払確認ダイアログ（申請／引戻し／承認／差戻し共通・支払詳細(自販機)と同一） */}
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
    </div>
  );
}
