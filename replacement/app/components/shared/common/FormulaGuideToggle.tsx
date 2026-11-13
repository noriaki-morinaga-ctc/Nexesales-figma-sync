// 数式ガイドの ON/OFF（全画面共通。UI/UX UX-063 → 02 §6「数式ガイドの切替（FormulaGuideToggle）」）。
// 項目名「数式ガイド」＋OFF／ON の切替（SegmentToggle。ほかの表示の切替と同じ見た目）。
// ON のときだけ、切替の左に凡例（選択セル＝青の実線・参照セル＝緑の実線・影響セル＝オレンジの破線）を出す。
// カードの見出しの行（headerActions）に置く。
import { SegmentToggle } from './SegmentToggle';

interface FormulaGuideToggleProps {
  shown: boolean;
  onChange: (shown: boolean) => void;
}

interface LegendItemProps {
  // 枠の線の種類と色のクラス（例：border-solid border-blue-500）
  borderClass: string;
  label: string;
}

// 凡例の1項目（枠の見本＋名前）。色以外に線の種類（実線・破線）でも見分けられる（→ 06）
function LegendItem({ borderClass, label }: LegendItemProps) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`inline-block h-4 w-4 rounded-sm border-2 ${borderClass}`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

export function FormulaGuideToggle({
  shown,
  onChange,
}: FormulaGuideToggleProps) {
  return (
    <>
      {shown && (
        <div className="flex items-center gap-3 text-sm whitespace-nowrap text-gray-600">
          <LegendItem
            borderClass="border-solid border-blue-500"
            label="選択セル"
          />
          <LegendItem
            borderClass="border-solid border-green-500"
            label="参照セル"
          />
          <LegendItem
            borderClass="border-dashed border-orange-500"
            label="影響セル"
          />
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold whitespace-nowrap text-gray-700">
          数式ガイド
        </span>
        <SegmentToggle
          ariaLabel="数式ガイド"
          options={[
            { value: 'off', label: 'OFF' },
            { value: 'on', label: 'ON' },
          ]}
          value={shown ? 'on' : 'off'}
          onChange={(v) => onChange(v === 'on')}
        />
      </div>
    </>
  );
}
