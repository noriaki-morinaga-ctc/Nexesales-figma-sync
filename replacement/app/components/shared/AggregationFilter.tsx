// 集計対象フィルタ（除外ペア対応）─ 課題0290
// 「メタブランド × 容器容量G」の掛け合わせ集計のうち、特定の組合せだけを除外するためのUI。
// 包含フィルタ（①×②の複数選択）は親画面の MultiCombobox が担当し、本コンポーネントは
// 除外ペアの編集とクロスマトリクスのプレビューを担当する（shukei_filter_mock.html をReact移植）。
//
// 配色は画面設計標準（gridStyles / commonStyles）に統一：
//   集計対象セル＝薄青(blue-100＝GRID_COLORS.total)、除外セル＝薄赤(red-100)、
//   見出し＝灰(gray-100＝GRID_COLORS.readonly)、ラベル＝青太字(FORM_LABEL_CLASS)。
// 除外ペアのプルダウンは SingleCombobox（白背景・クリア可）を使用する。

import { useMemo } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { SingleCombobox } from '../ui/single-combobox';
import type { MultiComboboxOption } from '../ui/multi-combobox';
import {
  FORM_LABEL_CLASS,
  BUTTON_STYLES,
  BUTTON_BASE,
} from '../../../styles/commonStyles';

// 除外ペアの型と判定関数は集計エンジンからも使うため、React 非依存モジュールへ切り出した。
// 既存の import 元（`from './AggregationFilter'`）を壊さないよう、ここから再エクスポートする。
// 値として再エクスポートするため、間接エクスポート（export ... from）ではなく
// いったん import してローカル束縛を作る。間接エクスポートは本モジュールに束縛を作らないため、
// 下の isPairExcluded 呼び出しが実行時に ReferenceError になる。
import {
  isPairExcluded,
  type ExcludePair,
} from '../../constants/aggregationExcludePair';

export { isPairExcluded, type ExcludePair };

interface AggregationFilterProps {
  // 集計軸の全選択肢（除外ペアのプルダウンは、この中から①・②で選択中の値のみを表示）
  metaBrandOptions: MultiComboboxOption[];
  containerCapacityOptions: MultiComboboxOption[];
  // 包含フィルタで選択中の値（プレビューのマトリクス軸）
  selectedMetaBrands: string[];
  selectedContainerCapacities: string[];
  // 除外ペア（制御コンポーネント）
  excludePairs: ExcludePair[];
  onChangeExcludePairs: (pairs: ExcludePair[]) => void;
}

// セル共通の枠線（グリッドと同じ灰枠）
const CELL_BORDER = 'border border-gray-200';

export function AggregationFilter({
  metaBrandOptions,
  containerCapacityOptions,
  selectedMetaBrands,
  selectedContainerCapacities,
  excludePairs,
  onChangeExcludePairs,
}: AggregationFilterProps) {
  // 行追加（初期値はブランク。意図しない組合せが除外されるのを防ぐため先頭の選択肢は入れない）
  const handleAddRow = () => {
    onChangeExcludePairs([...excludePairs, { brand: '', capacity: '' }]);
  };

  const handleRemoveRow = (idx: number) => {
    onChangeExcludePairs(excludePairs.filter((_, i) => i !== idx));
  };

  const handleChangePair = (
    idx: number,
    key: keyof ExcludePair,
    value: string
  ) => {
    onChangeExcludePairs(
      excludePairs.map((p, i) => (i === idx ? { ...p, [key]: value } : p))
    );
  };

  const hasPreview =
    selectedMetaBrands.length > 0 && selectedContainerCapacities.length > 0;

  // 除外する組合せは、集計単位①・②をそれぞれ2つ以上選択した場合のみ設定できる
  // （どちらかが1つだけの場合、除外すると掛け合わせの軸自体が消えてしまうため）
  const canExclude =
    selectedMetaBrands.length >= 2 && selectedContainerCapacities.length >= 2;

  // 除外ペアのプルダウンは、集計単位①・②で選択中の値のみを候補にする
  const brandOptions = useMemo(
    () => metaBrandOptions.filter((o) => selectedMetaBrands.includes(o.value)),
    [metaBrandOptions, selectedMetaBrands]
  );
  const capacityOptions = useMemo(
    () =>
      containerCapacityOptions.filter((o) =>
        selectedContainerCapacities.includes(o.value)
      ),
    [containerCapacityOptions, selectedContainerCapacities]
  );

  return (
    <div className="flex flex-col gap-4 border-t border-gray-200 pt-4">
      {/* 除外する組合せ（右ペイン用・縦並びコンパクト） */}
      {canExclude && (
        <div className="flex flex-col gap-2">
          <div className={FORM_LABEL_CLASS}>除外する組合せ</div>

          {excludePairs.length === 0 ? (
            <p className="rounded-md bg-gray-50 px-3 py-3 text-xs text-gray-400">
              除外ペアは未登録です。「＋ 除外ペアを追加」で、集計対象から外す
              メタブランド × 容器容量G の組合せを指定できます。
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {excludePairs.map((pair, idx) => (
                <li
                  key={idx}
                  className={`flex flex-col gap-1.5 rounded-md ${CELL_BORDER} bg-gray-50 p-2`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500">
                      除外 {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(idx)}
                      className={`${BUTTON_STYLES.delete} ${BUTTON_BASE} inline-flex h-6 items-center gap-1 px-2 text-xs`}
                    >
                      <Trash2 className="size-3" />
                      削除
                    </button>
                  </div>
                  <SingleCombobox
                    options={brandOptions}
                    value={pair.brand}
                    onChange={(val) => handleChangePair(idx, 'brand', val)}
                    placeholder="メタブランド"
                    clearable
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-gray-400">×</span>
                    <div className="flex-1">
                      <SingleCombobox
                        options={capacityOptions}
                        value={pair.capacity}
                        onChange={(val) =>
                          handleChangePair(idx, 'capacity', val)
                        }
                        placeholder="容器容量G"
                        clearable
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={handleAddRow}
            className={`${BUTTON_STYLES.outline} ${BUTTON_BASE} inline-flex h-8 w-full items-center justify-center gap-1 px-3 text-sm`}
          >
            <Plus className="size-4" />
            除外ペアを追加
          </button>
        </div>
      )}

      {/* 集計対象プレビュー（クロスマトリクス・右ペイン用） */}
      {/* 除外する組合せ非表示時は上の区切り線が重なるため付けない */}
      <div
        className={`flex flex-col gap-2 ${canExclude ? 'border-t border-gray-200 pt-4' : ''}`}
      >
        <div className={FORM_LABEL_CLASS}>集計対象プレビュー</div>

        {hasPreview ? (
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs">
              <thead>
                <tr>
                  <th
                    className={`sticky left-0 z-10 ${CELL_BORDER} bg-gray-100 px-2 py-1.5 text-left font-bold text-gray-900`}
                  >
                    ﾒﾀﾌﾞﾗﾝﾄﾞ＼容量
                  </th>
                  {selectedContainerCapacities.map((c) => (
                    <th
                      key={c}
                      className={`whitespace-nowrap ${CELL_BORDER} bg-gray-100 px-2 py-1.5 text-center font-bold text-gray-900`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedMetaBrands.map((b) => (
                  <tr key={b}>
                    <th
                      className={`sticky left-0 z-10 whitespace-nowrap ${CELL_BORDER} bg-gray-100 px-2 py-1.5 text-left font-bold text-gray-900`}
                    >
                      {b}
                    </th>
                    {selectedContainerCapacities.map((c) => {
                      const excluded = isPairExcluded(excludePairs, b, c);
                      return (
                        <td
                          key={c}
                          className={`${CELL_BORDER} px-2 py-1.5 text-center font-bold ${
                            excluded
                              ? 'bg-red-100 text-red-600'
                              : 'bg-blue-100 text-[rgb(19,80,218)]'
                          }`}
                        >
                          {excluded ? '除外' : '集計'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-md bg-gray-50 px-3 py-3 text-xs text-gray-400">
            メタブランドと容器容量Gを1つ以上選択してください。
          </p>
        )}
      </div>
    </div>
  );
}
