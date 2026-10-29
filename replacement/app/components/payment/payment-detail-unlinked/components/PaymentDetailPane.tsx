// 支払詳細(商流販売店紐づけなし)画面用：PaymentDetailPane をベースに作成
import { useState } from 'react';
import type React from 'react';
import { History, ReceiptText } from 'lucide-react';
import { CollapsibleCard } from '../../../ui/collapsible-card';
import { SingleCombobox } from '../../../ui/single-combobox';
import { RequiredBadge } from '../../../ui/required-badge';
import { DateMonthYearPicker } from '../../../ui/date-month-year-picker';
import { MonthYearPicker } from '../../../ui/month-year-picker';
import { FORM_LABEL_CLASS } from '../../../../../styles/commonStyles';
import { joinCodeName } from '../../../../utils/nameCode';

interface PaymentDetailPaneProps {
  // ステータス横のコメント履歴ボタン押下時のハンドラ
  onStatusClick?: () => void;
  // ヘッダの「根拠資料格納」ボタン押下時のハンドラ（拡売費ヘッダから移動）
  onStoreEvidence?: () => void;
  // ＋支払回数追加で作成した支払回数を表示しているか。
  // true のときは真っさらな入力画面とする（→ 20260804_第26回 決定事項23）。
  isNewRound?: boolean;
}

// 支払情報のステータス（モック）。
// 値は支払一覧のステータス（未申請／承認待ち／承認差戻し／検印待ち／検印差戻し／検印済）に合わせる。
const PAYMENT_DETAIL_STATUS = '承認待ち';

// 未着請求書の有無（モック）。支払データの未着請求書区分を参照専用のテキストで表示する。
const HAS_UNARRIVED_INVOICE = false;

// 申請時に確定する組織・申請者・申請日（モック）。基本情報エリアから支払情報エリアへ移動
// （支払回ごとの情報のため。支払詳細(追加口請求書有)と同じ持ち方）。
// 申請側の組織＝実際に伝票を入力した組織。販売計画側（事業場・部署・末端組織・
// 営業担当者）とは分けて持ち、申請したタイミングで確定する
// （→ 20260804_第26回 決定事項7・18／課題 No.0956）。
const APPLICANT_OFFICE = joinCodeName('10000623', '首都圏本部'); // 申請事業場
const APPLICANT_DEPT = joinCodeName('10002990', '首都圏営業第二部'); // 申請部署
// 本画面は計画に紐づかない支払のため、申請末端組織まで入力される。
const APPLICANT_TERMINAL_ORG = joinCodeName('10004512', '東京第一営業所');
const APPLICANT = joinCodeName('5172733', '山田　太郎'); // 申請者
const APPLICATION_DATE = '2025/10/15'; // 申請日

// 支払先の選択肢（支払詳細(その他)と同じ単一選択コンボボックス）
const PAYMENT_DESTINATION_OPTIONS = [
  '1001584:伊藤忠食品株式会社東日本営業本部商品部',
  '1001585:三菱食品株式会社',
  '1001586:加藤産業株式会社',
].map((opt) => ({ value: opt, label: opt }));

// 支払情報エリア（支払詳細(商流販売店紐づけなし)）。基本情報とは別ファイルに分離。
export function PaymentDetailPane({
  onStatusClick,
  onStoreEvidence,
  isNewRound = false,
}: PaymentDetailPaneProps) {
  // 折り畳み状態（既定は展開）
  const [isPaymentDetailOpen, setIsPaymentDetailOpen] = useState(true);

  // 支払情報の入力項目（支払詳細(その他)と同一）
  // ※ 支払回数は支払詳細(自販機)と同様、支払情報の上（PaymentDetailUnlinked 側）へ移動。
  // ※ ＋支払回数追加で作成した回は未入力の状態から始めるため、いずれも空で初期化する。
  const [paymentDestination, setPaymentDestination] = useState(
    isNewRound ? '' : '1001584:伊藤忠食品株式会社東日本営業本部商品部'
  );

  // 拡売費支払予定日（YYYY/MM/DD 文字列。DateMonthYearPicker で選択）
  const [paymentScheduleDate, setPaymentScheduleDate] = useState(
    isNewRound ? '' : '2024/10/31'
  );

  // 発生日（YYYY/MM/DD 文字列。DateMonthYearPicker で選択）
  const [occurrenceDate, setOccurrenceDate] = useState(
    isNewRound ? '' : '2024/08/31'
  );

  // 計上年月（YYYY/MM 文字列。基本情報から移動・MonthYearPicker で選択）
  const [postingMonth, setPostingMonth] = useState(isNewRound ? '' : '2025/10');

  // 参照専用項目（申請組織・申請者・申請日）の共通描画。
  // 基本情報エリアと同じ体裁に揃える。
  const renderLabelField = (label: string, value: React.ReactNode) => (
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

  return (
    // 支払情報エリア（支払詳細(その他)と同じ折り畳みカード）
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
        {/* 1行目: 支払先 / ステータス（支払回数はカード上部へ移動） */}
        <div className="grid grid-cols-4 gap-3 mb-2 pb-3 border-b border-gray-300">
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
                onChange={setPaymentDestination}
                placeholder="コード または 名称で検索..."
              />
            </div>
          </div>
          {/* ステータス（支払先の右へ移動・横にコメント履歴ボタン） */}
          <div className="flex items-center gap-2 col-span-2">
            <label className="text-sm text-blue-900 whitespace-nowrap font-bold w-36 text-right">
              ステータス
            </label>
            <span className="h-8 flex items-center text-sm text-gray-900">
              {PAYMENT_DETAIL_STATUS}
            </span>
            <button
              type="button"
              onClick={onStatusClick}
              className="btn-toolbar-outline"
              aria-label="コメント履歴"
            >
              <History className="h-4 w-4" />
              コメント履歴
            </button>
          </div>
        </div>

        {/* 2行目: 発生日 / 計上年月 / 拡売費支払予定日 / 申請日 */}
        <div className="grid grid-cols-4 gap-3 mb-2 pb-3 border-b border-gray-300">
          {/* 発生日（カレンダー付） */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="occurrence-date"
              className="text-sm text-blue-900 whitespace-nowrap font-bold w-36 text-right"
            >
              発生日
            </label>
            <div className="w-[9.375rem]">
              <DateMonthYearPicker
                value={occurrenceDate}
                onChange={setOccurrenceDate}
                clearable
                className="w-full"
              />
            </div>
          </div>

          {/* 計上年月（基本情報から移動・MonthYearPicker・必須） */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="posting-month"
              className="text-sm text-blue-900 whitespace-nowrap font-bold w-36 flex items-center justify-end shrink-0"
            >
              計上年月
              <RequiredBadge />
            </label>
            <div className="w-[9.375rem]">
              <MonthYearPicker
                value={postingMonth}
                onChange={setPostingMonth}
                required
                className="w-full"
              />
            </div>
          </div>

          {/* 拡売費支払予定日（カレンダー付） */}
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
                value={paymentScheduleDate}
                onChange={setPaymentScheduleDate}
                required
                className="w-full"
              />
            </div>
          </div>

          {renderLabelField('申請日', APPLICATION_DATE)}
        </div>

        {/* 3行目: 申請事業場 / 申請部署 / 申請末端組織 / 申請者（基本情報から移動）。
            申請部署はログインユーザーの部署が入り、申請したタイミングで確定する
            （→ 20260804_第26回 決定事項7・18）。 */}
        <div className="grid grid-cols-4 gap-3">
          {renderLabelField('申請事業場', APPLICANT_OFFICE)}
          {renderLabelField('申請部署', APPLICANT_DEPT)}
          {renderLabelField('申請末端組織', APPLICANT_TERMINAL_ORG)}
          {renderLabelField('申請者', APPLICANT)}
        </div>
      </div>
    </CollapsibleCard>
  );
}
