import { kpiRateColor } from '@/utils/sales-plan/common/aggregationCardColors';

interface KpiCardProps {
  // 指標の名前（例：函数・売上高・拡売費（売上連動拡売費＋直接固定費））
  name: string;
  // 値の見出し（計画値／計画/実績）
  valueLabel: string;
  // 値（単位付きで整形済み）
  valueText: string;
  // 予算達成率・前年比（％。色の判定に使う）と、その表示文字・差の表示文字（整形済み）
  budgetRate: number;
  budgetRateText: string;
  budgetDiffText: string;
  previousYearRate: number;
  previousYearRateText: string;
  previousYearDiffText: string;
  // コスト項目（拡売費）。少ないほど良いため、率の色の向きを逆にする
  isCost?: boolean;
}

// 販売計画(集計)の KPI カード（→ 02 §10.4）。
// 見出しの行に指標の名前と値（黒の太字）を並べ、その下に「予算達成率・予算差」「前年比・前年差」を1行ずつ出す。
// グラフ（棒）は置かない。率と差は閾値の色（100%以上＝紺／90%以上＝オレンジ／90%未満＝赤。
// コスト項目は 100%以下＝紺／110%以下＝オレンジ／110%超＝赤）にする。
export function KpiCard({
  name,
  valueLabel,
  valueText,
  budgetRate,
  budgetRateText,
  budgetDiffText,
  previousYearRate,
  previousYearRateText,
  previousYearDiffText,
  isCost = false,
}: KpiCardProps) {
  const budgetColor = kpiRateColor(budgetRate, isCost);
  const previousYearColor = kpiRateColor(previousYearRate, isCost);

  // 率と差の1行。折り返さず、常に1段目＝予算達成率・予算差、2段目＝前年比・前年差にする。
  // 狭いカードでも1行に収まるよう、項目名は text-xs、値は text-sm（1536px 未満の画面では text-xs）にする
  const rateRow = (
    rateLabel: string,
    rateText: string,
    diffLabel: string,
    diffText: string,
    color: string
  ) => (
    <div className="flex items-baseline justify-between gap-1 whitespace-nowrap">
      <span className="flex min-w-0 items-baseline gap-0.5">
        <span className="text-xs text-gray-600">{rateLabel}</span>
        <span className={`text-xs font-bold 2xl:text-sm ${color}`}>
          {rateText}
        </span>
      </span>
      <span className="flex min-w-0 items-baseline gap-0.5">
        <span className="text-xs text-gray-500">{diffLabel}</span>
        <span className={`text-xs font-bold 2xl:text-sm ${color}`}>
          {diffText}
        </span>
      </span>
    </div>
  );

  return (
    <div className="min-w-0 rounded-lg border border-gray-300 bg-gradient-to-b from-white to-blue-50 px-2 pt-2 pb-3">
      <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-blue-100 pb-1.5">
        <span
          className="min-w-0 truncate text-sm font-bold text-gray-700"
          title={name}
        >
          {name}
        </span>
        <span className="flex items-baseline gap-1 whitespace-nowrap">
          <span className="text-xs text-gray-500">{valueLabel}</span>
          <span className="text-base font-bold text-gray-900">{valueText}</span>
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {rateRow(
          '予算達成率',
          budgetRateText,
          '予算差',
          budgetDiffText,
          budgetColor
        )}
        {rateRow(
          '前年比',
          previousYearRateText,
          '前年差',
          previousYearDiffText,
          previousYearColor
        )}
      </div>
    </div>
  );
}
