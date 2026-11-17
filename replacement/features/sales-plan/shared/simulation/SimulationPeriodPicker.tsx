import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { FORM_LABEL_CLASS } from '@/styles/commonStyles';
import { nextYearDecember, thisYearJanuary } from '@/utils/common/yearMonth';

// シミュレーション（集計）の対象期間（from）の入力欄の id。画面の初期フォーカスでも使う。
export const AGGREGATION_PERIOD_FROM_ID = 'aggregation-period-from';
// シミュレーション（詳細）の対象期間（from）の入力欄の id。
export const DETAIL_PERIOD_FROM_ID = 'detail-period-from';

interface SimulationPeriodPickerProps {
  // from 入力欄の id（ラベルの htmlFor と紐付ける）。to は `${fromId}-to` とする。
  fromId: string;
  // 開始・終了を区別するアクセシブル名の接頭辞（例：「集計の対象期間」）
  ariaLabelPrefix: string;
  fromPeriod: string;
  toPeriod: string;
  onFromPeriodChange: (value: string) => void;
  onToPeriodChange: (value: string) => void;
  // 当年より前の月も選べるようにする（シミュレーション（集計）。10/27 第4回 決定事項18）
  shouldAllowPastMonths?: boolean;
  // 選択させない月（シミュレーション（詳細）の確定・未承認確定の月。10/27 第4回 決定事項18）
  disabledMonths?: string[];
}

// 販売計画シミュレーションの対象期間（From〜To）の入力。
// シミュレーション（集計）とシミュレーション（詳細）はそれぞれ独立して対象期間を持ち、
// 連動させない（6/16 第9回 決定9）。
export function SimulationPeriodPicker({
  fromId,
  ariaLabelPrefix,
  fromPeriod,
  toPeriod,
  onFromPeriodChange,
  onToPeriodChange,
  shouldAllowPastMonths = false,
  disabledMonths,
}: SimulationPeriodPickerProps) {
  // 選択可能範囲は暦年基準で from・to とも当年1月〜次年12月とする（集計は当年より前も選べる）。
  // from の上限は「次年12月」と「to」の小さい方。
  // （'YYYY/MM' はゼロ埋めのため辞書順＝時系列順として文字列比較で判定できる）
  const fromPeriodMax =
    toPeriod < nextYearDecember() ? toPeriod : nextYearDecember();

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor={fromId}
        className={`${FORM_LABEL_CLASS} whitespace-nowrap px-2 py-1`}
      >
        対象期間
      </label>
      {/* トリガーの aria-label がラベルより優先されるため、開始・終了を区別する名前を渡す */}
      <MonthYearPicker
        id={fromId}
        ariaLabel={`${ariaLabelPrefix}（開始）`}
        value={fromPeriod}
        onChange={onFromPeriodChange}
        min={shouldAllowPastMonths ? undefined : thisYearJanuary()}
        max={fromPeriodMax}
        disabledMonths={disabledMonths}
      />
      <span className="text-sm text-gray-600">〜</span>
      <MonthYearPicker
        id={`${fromId}-to`}
        ariaLabel={`${ariaLabelPrefix}（終了）`}
        value={toPeriod}
        onChange={onToPeriodChange}
        min={fromPeriod}
        max={nextYearDecember()}
        disabledMonths={disabledMonths}
      />
    </div>
  );
}
