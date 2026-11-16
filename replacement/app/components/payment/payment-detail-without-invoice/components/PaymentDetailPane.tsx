// Todo：朴：C追加口・拡売費支払モック修正中
import { useState, forwardRef, useImperativeHandle } from 'react';
import { ReceiptText } from 'lucide-react';
import { CollapsibleCard } from '@/app/components/ui/collapsible-card';
import { SingleCombobox } from '@/app/components/ui/single-combobox';
import { RequiredBadge } from '@/app/components/ui/required-badge';
import { DateMonthYearPicker } from '@/app/components/ui/date-month-year-picker';
import { joinCodeName } from '@/app/utils/common/nameCode';
import {
  calcExpensePaymentScheduleDate,
  firstDayOfMonth,
  lastDayOfMonth,
  latestOpenAccountingMonth,
  toSlashYearMonth,
} from '@/app/utils/payment/payment-detail/paymentScheduleDate';
import { BASIC_INFO } from '@/app/components/shared/payment/payment-detail/AdditionalPaymentBasicInfoPane';
import { FORM_LABEL_CLASS } from '@/styles/commonStyles';
import { valueOrEmpty } from '@/app/components/ui/empty-value';
import { WITHOUT_INVOICE_DATA_SOURCE_COLUMNS } from '@/app/constants/dataSource';
import {
  PaymentAmountBreakdownTable,
  type PaymentAmountBreakdownItem,
} from '@/app/components/shared/payment/payment-detail/PaymentAmountBreakdownTable';

// 支払情報の入力値（支払回数ごとのデータセットとして親＝PaymentDetailWithoutInvoice が保持する）。
// 支払全体の備考は持たない（支払無しなどの理由はフッターのコメント欄に書く）。
export interface PaymentDetailPaneValues {
  paymentDestination: string; // 支払先
  paymentScheduleDate: string; // 拡売費支払予定日（YYYY/MM/DD）
  occurrenceDate: string; // 発生日（YYYY/MM/DD）
  postingMonth: string; // 計上年月（YYYY/MM）
  status: string; // ステータス（参照専用）
  // 請求方法（AIC入力／手入力）。支払回数ごとに、その回の支払データがどこから
  // 入ったものかを示す（参照専用 → 20260710_第16回 決定事項10）。
  billingMethod: string;
  applicantOffice: string; // 申請事業場（参照専用）
  applicantDept: string; // 申請部署（参照専用）
  applicantTerminalOrg: string; // 申請末端組織（参照専用）
  applicant: string; // 申請者（参照専用）
  applicationDate: string; // 申請日（参照専用・YYYY/MM/DD）
}

// 親（PaymentDetailWithoutInvoice）へ公開するハンドル。
//   getValues: 支払回数の切替時に、表示中の回の入力値を退避するために呼ぶ。
export interface PaymentDetailPaneHandle {
  getValues: () => PaymentDetailPaneValues;
}

interface PaymentDetailPaneProps {
  // ヘッダの「根拠資料格納」ボタン押下時のハンドラ（拡売費ヘッダから移動）
  onStoreEvidence?: () => void;
  // 表示する支払情報（支払回数ごとのデータセット）。未指定時は既定値を使う。
  initialValues?: PaymentDetailPaneValues;
  // 支払回全体の合計表（追加口計・拡売費計・税抜金額計）。
  // 選択中の支払回数の値を親が集計して渡す。未指定なら表を出さない。
  breakdownItems?: PaymentAmountBreakdownItem[];
}

// 未着請求書の有無（モック）。支払データの未着請求書区分を参照専用のテキストで表示する。
const HAS_UNARRIVED_INVOICE = false;

// 支払明細情報のステータス（モック）。費用分割の分割元情報など、他画面から参照するため export する。
// 値は支払一覧のステータス（未申請／承認待ち／承認差戻し／検印待ち／検印差戻し／検印済）に合わせる。
export const PAYMENT_DETAIL_STATUS = '承認待ち';

// 支払先の選択肢（支払詳細(その他)と同じ単一選択コンボボックス）。
// 表記は基本情報と揃えて「コード:名称」とする。
const PAYMENT_DESTINATION_OPTIONS = [
  joinCodeName('1001584', '伊藤忠食品株式会社東日本営業本部商品部'),
  joinCodeName('1001585', '三菱食品株式会社'),
  joinCodeName('1001586', '加藤産業株式会社'),
].map((opt) => ({ value: opt, label: opt }));

// 申請時に確定する組織・申請者・申請日（モック）。基本情報エリアから支払情報エリアへ移動。
// 申請事業場・申請部署＝実際に伝票を入力した組織。本支払は代行入力ではないため事業場・部署と同値。
const APPLICANT_OFFICE = joinCodeName('10000623', '首都圏本部'); // 申請事業場
const APPLICANT_DEPT = joinCodeName('10002990', '首都圏営業第二部'); // 申請部署
// 申請末端組織は計画無し支払でのみ入力される項目のため、計画有りの本画面では空（グレーの「-」で表示）
const APPLICANT_TERMINAL_ORG = '';
const APPLICANT = joinCodeName('5172733', 'アサヒ　太郎'); // 申請者
const APPLICATION_DATE = '2025/10/15'; // 申請日

// 支払情報の日付の初期値（→ 20261006_第36回 手売り自販機共通 決定事項6・7・9）。
// 対象年月（基本情報）の初日・末日。発生日の初期値と、発生日を手で選べる範囲に使う。
const TARGET_MONTH = toSlashYearMonth(BASIC_INFO.targetMonth);
const TARGET_MONTH_FIRST_DAY = firstDayOfMonth(TARGET_MONTH);
const TARGET_MONTH_LAST_DAY = lastDayOfMonth(TARGET_MONTH);
// 計上年月＝直近の有効な会計月。モックの業務日付は申請日と同じ日とする。
const POSTING_MONTH = latestOpenAccountingMonth(APPLICATION_DATE);

// 支払先と日付の初期値。発生日＝対象年月の末日、計上年月＝直近の有効な会計月、
// 拡売費支払予定日＝支払先から計算した日（支払先が無ければ空で、初期表示しない）。
const initialDestinationAndDates = (paymentDestination: string) => ({
  paymentDestination,
  paymentScheduleDate: calcExpensePaymentScheduleDate(
    paymentDestination,
    POSTING_MONTH
  ),
  occurrenceDate: TARGET_MONTH_LAST_DAY,
  postingMonth: POSTING_MONTH,
});

// 引用・「＋支払回数追加」で追加する支払回のステータス（申請前のため未申請）。
const EMPTY_PAYMENT_DETAIL_STATUS = '未申請';

// 支払情報の既定値（支払回数ごとのデータセットの初期値としても使う）。
// round は支払回数で、請求方法を回ごとに決めるために使う。
export const createPaymentDetailValues = (
  round = '1'
): PaymentDetailPaneValues => ({
  ...initialDestinationAndDates(
    joinCodeName('1001584', '伊藤忠食品株式会社東日本営業本部商品部')
  ),
  status: PAYMENT_DETAIL_STATUS,
  // 1回目はAIC（アサヒインフォメーションセンター）で入力された支払データをもとに支払う回、
  // 2回目以降は画面で入力した支払データをもとに支払う回とする。
  billingMethod: round === '1' ? 'AIC入力' : '手入力',
  applicantOffice: APPLICANT_OFFICE,
  applicantDept: APPLICANT_DEPT,
  applicantTerminalOrg: APPLICANT_TERMINAL_ORG,
  applicant: APPLICANT,
  applicationDate: APPLICATION_DATE,
});

// 引用で追加する支払回の支払情報の初期値。
// 引用元が異なることが分かるよう、支払回数「1」とは別の支払先を初期表示する
//（日付は支払先・対象年月から決まる）。
// ステータスは「未申請」とする。
// 申請前の回のため、申請組織・申請者・申請日はブランクで開始する。
export const createQuotePaymentDetailValues = (): PaymentDetailPaneValues => ({
  ...initialDestinationAndDates(joinCodeName('1001585', '三菱食品株式会社')),
  status: EMPTY_PAYMENT_DETAIL_STATUS,
  // 引用で作る回は画面で明細を作るため手入力。
  billingMethod: '手入力',
  applicantOffice: '',
  applicantDept: '',
  applicantTerminalOrg: '',
  applicant: '',
  applicationDate: '',
});

// 「＋支払回数追加」で追加する支払回の支払情報の初期値。
// 明細を持たない空の回のため、支払先はブランクで開始する。発生日・計上年月は初期値を入れ、
// 拡売費支払予定日は支払先を入れたときに計算する。
// ステータスは「未申請」、請求方法は画面で入力する回のため「手入力」とする。
export const createEmptyPaymentDetailValues = (): PaymentDetailPaneValues => ({
  ...initialDestinationAndDates(''),
  status: EMPTY_PAYMENT_DETAIL_STATUS,
  billingMethod: '手入力',
  applicantOffice: '',
  applicantDept: '',
  applicantTerminalOrg: '',
  applicant: '',
  applicationDate: '',
});

// 支払明細情報エリア（支払詳細(マージン率固定・NET入力)）。基本情報とは別ファイルに分離。
export const PaymentDetailPane = forwardRef<
  PaymentDetailPaneHandle,
  PaymentDetailPaneProps
>(function PaymentDetailPane(
  { onStoreEvidence, initialValues, breakdownItems }: PaymentDetailPaneProps,
  ref
) {
  // 折り畳み状態（既定は展開）
  const [isPaymentDetailOpen, setIsPaymentDetailOpen] = useState(true);

  // 支払情報の初期値（支払回数ごとのデータセットが渡されない場合は既定値）。
  const [initial] = useState(
    () => initialValues ?? createPaymentDetailValues()
  );

  // 支払明細情報の入力項目（支払詳細(その他)と同一）
  // ※ 支払回数は支払詳細(自販機)と同様、タブバーと支払明細情報の間（PaymentDetailWithoutInvoice 側）へ移動。
  const [paymentDestination, setPaymentDestination] = useState(
    initial.paymentDestination
  );
  // 拡売費支払予定日（YYYY/MM/DD 文字列。DateMonthYearPicker で選択）
  const [paymentScheduleDate, setPaymentScheduleDate] = useState(
    initial.paymentScheduleDate
  );

  // 発生日（YYYY/MM/DD 文字列。DateMonthYearPicker で選択）
  const [occurrenceDate, setOccurrenceDate] = useState(initial.occurrenceDate);

  // 計上年月（YYYY/MM）。直近の有効な会計月をシステムが入れ、手入力はできない
  //（→ 第36回 決定事項6・7）。
  const postingMonth = initial.postingMonth;

  // 拡売費支払予定日の計算値（支払先・計上年月から求めた日）。
  // 計算値から手で変えたときは、入力欄を強調して示す（→ 第36回 決定事項6）。
  const calculatedScheduleDate = calcExpensePaymentScheduleDate(
    paymentDestination,
    postingMonth
  );
  const isScheduleDateEdited =
    !!calculatedScheduleDate && paymentScheduleDate !== calculatedScheduleDate;

  // 支払先を変えたら、拡売費支払予定日を計算し直す（手で変えた日も計算値に戻す）。
  const handleDestinationChange = (value: string) => {
    setPaymentDestination(value);
    setPaymentScheduleDate(calcExpensePaymentScheduleDate(value, postingMonth));
  };

  // 支払回数の切替時に、表示中の回の入力値を親へ受け渡す。
  // ステータス・請求方法・申請情報は参照専用のため、初期値をそのまま返す。
  useImperativeHandle(ref, () => ({
    getValues: () => ({
      paymentDestination,
      paymentScheduleDate,
      occurrenceDate,
      postingMonth,
      status: initial.status,
      billingMethod: initial.billingMethod,
      applicantOffice: initial.applicantOffice,
      applicantDept: initial.applicantDept,
      applicantTerminalOrg: initial.applicantTerminalOrg,
      applicant: initial.applicant,
      applicationDate: initial.applicationDate,
    }),
  }));

  // 参照専用項目（申請組織・申請者・申請日）の共通描画。基本情報エリアと同じ体裁に揃える。
  const renderLabelField = (label: string, value: string) => (
    <div className="flex items-center gap-2">
      <label
        className={`${FORM_LABEL_CLASS} whitespace-nowrap w-36 text-right`}
      >
        {label}
      </label>
      <span className="h-8 flex items-center text-sm text-gray-900">
        {valueOrEmpty(value)}
      </span>
    </div>
  );

  return (
    // 支払明細情報エリア（支払詳細(その他)と同じ折り畳みカード）
    <CollapsibleCard
      title="支払情報"
      open={isPaymentDetailOpen}
      onOpenChange={setIsPaymentDetailOpen}
      headerActions={
        <>
          {/* 未着請求書の有無（参照専用のテキスト表示）。
              利用者が変えられる項目ではないため、チェックボックスは置かず
              「未着請求書有」「未着請求書無」のどちらかだけを出す。 */}
          <span className={`${FORM_LABEL_CLASS} whitespace-nowrap`}>
            {HAS_UNARRIVED_INVOICE ? '未着請求書有' : '未着請求書無'}
          </span>
          <button
            type="button"
            onClick={() => onStoreEvidence?.()}
            className="btn-toolbar-outline"
            aria-label="根拠資料格納"
          >
            <ReceiptText className="h-4 w-4" />
            根拠資料格納
          </button>
        </>
      }
    >
      <div className="p-4">
        {/* 1行目: 支払先 / ステータス（支払回数はタブバー直下へ移動） */}
        <div className="grid grid-cols-4 gap-3 mb-2.5 pb-2.5 border-b border-gray-300">
          {/* 支払先（単一選択・コード/名称で検索・2列分結合） */}
          <div className="flex items-center gap-2 col-span-2">
            <label
              htmlFor="payment-destination"
              className="text-sm text-blue-900 whitespace-nowrap font-bold w-36 text-right"
            >
              支払先
              <RequiredBadge />
            </label>
            <div className="w-64">
              <SingleCombobox
                id="payment-destination"
                ariaRequired
                options={PAYMENT_DESTINATION_OPTIONS}
                value={paymentDestination}
                onChange={handleDestinationChange}
                placeholder="コード または 名称で検索..."
              />
            </div>
          </div>
          {/* ステータス（支払先の右へ移動。コメント履歴はフッターのコメント欄の「履歴」から開く。UI/UX UX-107） */}
          <div className="flex items-center gap-2 col-span-2">
            <label className="text-sm text-blue-900 whitespace-nowrap font-bold w-36 text-right">
              ステータス
            </label>
            <span className="h-8 flex items-center text-sm text-gray-900">
              {initial.status}
            </span>
          </div>
        </div>

        {/* 2行目: 請求方法 */}
        <div className="grid grid-cols-4 gap-3 mb-2.5 pb-2.5 border-b border-gray-300">
          <div className="col-span-2">
            {renderLabelField('請求方法', initial.billingMethod)}
          </div>
        </div>

        {/* 3行目: 発生日 / 計上年月 / 拡売費支払予定日 / 申請日 */}
        <div className="grid grid-cols-4 gap-3 mb-2.5 pb-2.5 border-b border-gray-300">
          {/* 発生日（カレンダー付）。選べるのは対象年月内（未来日も可 → 第36回 決定事項9）。 */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="occurrence-date"
              className="text-sm text-blue-900 whitespace-nowrap font-bold w-36 text-right"
            >
              発生日
            </label>
            <div className="w-[9.375rem]">
              <DateMonthYearPicker
                id="occurrence-date"
                value={occurrenceDate}
                onChange={setOccurrenceDate}
                min={TARGET_MONTH_FIRST_DAY}
                max={TARGET_MONTH_LAST_DAY}
                clearable
                className="w-full"
              />
            </div>
          </div>

          {/* 計上年月（参照表示）。直近の有効な会計月をシステムが入れ、手入力はできない
              （→ 第36回 決定事項6・7）。 */}
          {renderLabelField('計上年月', postingMonth)}

          {/* 拡売費支払予定日（カレンダー付）。支払先を入れると計算した日が入り、手で変えられる。
              計算した日から変えたときは、変更ハイライトと同じ色（黄背景・オレンジ枠）で示す。 */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="payment-schedule-date"
              className="text-sm text-blue-900 whitespace-nowrap font-bold w-36 flex items-center justify-end shrink-0"
            >
              拡売費支払予定日
              <RequiredBadge />
            </label>
            <div className="w-[9.375rem]">
              <DateMonthYearPicker
                id="payment-schedule-date"
                value={paymentScheduleDate}
                onChange={setPaymentScheduleDate}
                required
                className={
                  isScheduleDateEdited
                    ? 'w-full border-orange-300 bg-yellow-100'
                    : 'w-full'
                }
              />
              {isScheduleDateEdited && (
                <span className="sr-only">
                  {`計算した日（${calculatedScheduleDate}）から変更しています`}
                </span>
              )}
            </div>
          </div>

          {renderLabelField('申請日', initial.applicationDate)}
        </div>

        {/* 4行目: 申請事業場 / 申請部署 / 申請末端組織 / 申請者 */}
        <div
          className={`grid grid-cols-4 gap-3 ${
            breakdownItems ? 'mb-3 pb-3 border-b border-gray-300' : ''
          }`}
        >
          {renderLabelField('申請事業場', initial.applicantOffice)}
          {renderLabelField('申請部署', initial.applicantDept)}
          {renderLabelField('申請末端組織', initial.applicantTerminalOrg)}
          {renderLabelField('申請者', initial.applicant)}
        </div>

        {/* 5行目: 支払回全体の合計表（支払詳細(追加口請求書有)と同じ形）。
            追加口計・拡売費計と、2つを足した税抜金額計を出す（→ 20260710_第16回 決定事項12）。
            センターフィは本画面では扱わない。請求を扱わないため、全項目の請求・差額の行を「-」とする。
            データ元別の列はAIC入力・手入力（追加口明細・拡売費明細の合計表と同じ見出し）。
            長い場合は表だけを横スクロールさせる。 */}
        {breakdownItems && (
          <PaymentAmountBreakdownTable
            ariaLabel="支払回の合計"
            items={breakdownItems}
            dataSourceColumns={WITHOUT_INVOICE_DATA_SOURCE_COLUMNS}
            // マイナスは括弧では分かりにくいため「-」符号で表示する。
            negativeFormat="minus"
          />
        )}
      </div>
    </CollapsibleCard>
  );
});
