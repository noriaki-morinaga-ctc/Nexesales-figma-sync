// 支払詳細(引用)画面用：PaymentDetailPane をベースに作成
import { useState } from 'react';
import { CollapsibleCard } from '@/app/components/ui/collapsible-card';
import { SingleCombobox } from '@/app/components/ui/single-combobox';
import { RequiredBadge } from '@/app/components/ui/required-badge';
import { Input } from '@/app/components/ui/input';
import { TEXT_INPUT_CLASS } from '@/styles/commonStyles';
import { DateMonthYearPicker } from '@/app/components/ui/date-month-year-picker';
import { MonthYearPicker } from '@/app/components/ui/month-year-picker';

interface PaymentDetailPaneProps {
  // 支払明細情報のステータス（モック。画面ごとに違う）
  status: string;
}

// 支払先の選択肢（支払詳細(その他)と同じ単一選択コンボボックス）
const PAYMENT_DESTINATION_OPTIONS = [
  '1001584:伊藤忠食品株式会社東日本営業本部商品部',
  '1001585:三菱食品株式会社',
  '1001586:加藤産業株式会社',
].map((opt) => ({ value: opt, label: opt }));

// 支払明細情報エリア（支払詳細(引用)）。基本情報とは別ファイルに分離。
export function QuotePaymentDetailPane({ status }: PaymentDetailPaneProps) {
  // 折り畳み状態（既定は展開）
  const [isPaymentDetailOpen, setIsPaymentDetailOpen] = useState(true);

  // 支払明細情報の入力項目（支払詳細(その他)と同一）
  // ※ 支払回数は支払詳細(自販機)と同様、支払明細情報の上（画面の page 側）へ移動。
  const [paymentDestination, setPaymentDestination] = useState(
    '1001584:伊藤忠食品株式会社東日本営業本部商品部'
  );
  const [note, setNote] = useState('');

  // 拡売費支払予定日（YYYY/MM/DD 文字列。DateMonthYearPicker で選択）
  const [paymentScheduleDate, setPaymentScheduleDate] = useState('2024/10/31');

  // 発生日（YYYY/MM/DD 文字列。DateMonthYearPicker で選択）
  const [occurrenceDate, setOccurrenceDate] = useState('2024/08/31');

  // 計上年月（YYYY/MM 文字列。基本情報から移動・MonthYearPicker で選択）
  const [postingMonth, setPostingMonth] = useState('2025/10');

  return (
    // 支払明細情報エリア（支払詳細(その他)と同じ折り畳みカード）
    <CollapsibleCard
      title="支払明細情報"
      open={isPaymentDetailOpen}
      onOpenChange={setIsPaymentDetailOpen}
    >
      <div className="p-4">
        {/* 1行目: 支払先 / ステータス（支払回数はカード上部へ移動） */}
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
                onChange={setPaymentDestination}
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
              {status}
            </span>
          </div>
        </div>

        {/* 2行目: 発生日 / 計上年月 / 拡売費支払予定日 */}
        <div className="grid grid-cols-4 gap-3 mb-2.5 pb-2.5 border-b border-gray-300">
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
                id="occurrence-date"
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
                id="posting-month"
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
                id="payment-schedule-date"
                value={paymentScheduleDate}
                onChange={setPaymentScheduleDate}
                required
                className="w-full"
              />
            </div>
          </div>

          <div />
        </div>

        {/* 備考 */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="note"
            className="text-sm text-blue-900 whitespace-nowrap font-bold w-36 text-right"
          >
            備考
          </label>
          <Input
            id="note"
            className={`${TEXT_INPUT_CLASS} flex-1 text-gray-900`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </CollapsibleCard>
  );
}
