// 型1 マスタメンテ画面の検索条件カード。
// 検索ボタンは設けず、条件を変えるたびに一覧を随時更新する（マスタ画面標準化 p.7「検索」、9/24 決定3）。
// 一覧の業務キー（PK）・名称・外部キーを候補にし、クリアで初期値へ戻す（画面設計標準 3.2）。
// 世代管理の適用開始年月日は From〜To で指定し、各業務キーの最新世代で判定する（Q&A No.34②）。

import { RotateCcw, Search, X } from 'lucide-react';
import { CollapsibleCard } from '../../ui/collapsible-card';
import { DateMonthYearPicker } from '../../ui/date-month-year-picker';
import { MonthYearPicker } from '../../ui/month-year-picker';
import { Input } from '../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { SingleCombobox } from '../../ui/single-combobox';
import {
  buildSearchSummary,
  formatSummaryRange,
  formatSummaryValue,
} from '../../ui/search-summary';
import {
  BUTTON_BASE,
  BUTTON_STYLES,
  FORM_LABEL_CLASS,
} from '../../../../styles/commonStyles';
import type {
  MasterCriteria,
  MasterFieldDef,
  MasterScreenDef,
} from './masterTypes';
import {
  INACTIVE_CRITERIA_KEY,
  childOptions,
  fieldByKey,
  startFromKey,
  startToKey,
  toComboOptions,
} from './masterUtils';

// shadcn Select は空文字の value を持てないため、「全て」は別の値で表す
const ALL_VALUE = '__all__';

// 無効化の条件の表示名（折り畳んだときの要約用。「全て」は条件なしのため出さない）
const INACTIVE_SUMMARY_LABELS: Record<string, string> = {
  active: '有効のみ',
  inactive: '無効のみ',
};

// フォーム入力の共通スタイル（→ 05「フォーム項目レイアウト」）
const INPUT_CLASS =
  'h-8 text-sm bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500';

interface MasterSearchCardProps {
  def: MasterScreenDef;
  criteria: MasterCriteria;
  onChange: (key: string, value: string) => void;
  onClear: () => void;
}

export function MasterSearchCard({
  def,
  criteria,
  onChange,
  onClear,
}: MasterSearchCardProps) {
  const fields = def.searchKeys
    .map((key) => fieldByKey(def, key))
    .filter((f): f is MasterFieldDef => Boolean(f));

  // 検索条件カードを折り畳んだときに見出しの行へ出す要約（値が入っている項目だけ。UI/UX UX-024）。
  // 表示は入力欄と同じ（コンボは選択肢の表示名、区分は「コード:名称」）
  const summaryValueOf = (field: MasterFieldDef): string => {
    if (def.generation && field.key === def.generation.startKey) {
      return formatSummaryRange(
        criteria[startFromKey(def)] ?? '',
        criteria[startToKey(def)] ?? ''
      );
    }
    const value = criteria[field.key] ?? '';
    if (field.kind === 'combo') {
      return formatSummaryValue(
        value,
        toComboOptions(
          childOptions(field, criteria[field.parentKey ?? ''] ?? '')
        )
      );
    }
    if (field.kind === 'select') {
      const option = (field.options ?? []).find((o) => o.code === value);
      return option ? `${option.code}:${option.name}` : value;
    }
    return value;
  };
  const searchSummary = buildSearchSummary([
    ...fields.map((field) => ({
      label: field.label,
      value: summaryValueOf(field),
    })),
    ...(def.inactivation
      ? [
          {
            label: '無効化',
            value:
              INACTIVE_SUMMARY_LABELS[criteria[INACTIVE_CRITERIA_KEY] ?? ''] ??
              '',
          },
        ]
      : []),
  ]);

  // 日付（年月日または年月）1つ分の入力（カレンダー＋クリア）
  const renderDatePicker = (
    id: string,
    key: string,
    ariaLabel: string,
    kind: 'date' | 'month' = 'date'
  ) => {
    const value = criteria[key] ?? '';
    return (
      <div className="flex items-center gap-1">
        {kind === 'month' ? (
          <MonthYearPicker
            id={id}
            value={value}
            onChange={(v) => onChange(key, v)}
            ariaLabel={`${ariaLabel}を選択`}
          />
        ) : (
          <DateMonthYearPicker
            id={id}
            value={value}
            onChange={(v) => onChange(key, v)}
            ariaLabel={`${ariaLabel}を選択`}
          />
        )}
        {value !== '' && (
          <button
            type="button"
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`${ariaLabel}をクリア`}
            title={`${ariaLabel}をクリア`}
            onClick={() => onChange(key, '')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  };

  const renderControl = (field: MasterFieldDef) => {
    const id = `${def.routeId}-search-${field.key}`;
    const value = criteria[field.key] ?? '';
    if (def.generation && field.key === def.generation.startKey) {
      // 適用開始の From〜To（最新世代の適用開始で判定）。年月のマスタは年月で指定する
      const kind = field.kind === 'month' ? 'month' : 'date';
      return (
        <div className="flex items-center gap-1">
          {renderDatePicker(
            id,
            startFromKey(def),
            `${field.label}（開始）`,
            kind
          )}
          <span className="text-sm text-gray-600" aria-hidden="true">
            〜
          </span>
          {renderDatePicker(
            `${id}-to`,
            startToKey(def),
            `${field.label}（終了）`,
            kind
          )}
        </div>
      );
    }
    switch (field.kind) {
      case 'combo':
        return (
          <SingleCombobox
            id={id}
            options={toComboOptions(
              childOptions(field, criteria[field.parentKey ?? ''] ?? '')
            )}
            value={value}
            onChange={(v) => onChange(field.key, v)}
            placeholder="コード または 名称で検索..."
            clearable
            className="w-72"
          />
        );
      case 'select':
        return (
          <Select
            value={value === '' ? ALL_VALUE : value}
            onValueChange={(v) => onChange(field.key, v === ALL_VALUE ? '' : v)}
          >
            <SelectTrigger id={id} className={`w-44 ${INPUT_CLASS}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>全て</SelectItem>
              {(field.options ?? []).map((o) => (
                <SelectItem key={o.code} value={o.code}>
                  {o.code}:{o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'date':
        return renderDatePicker(id, field.key, field.label);
      case 'month':
        return renderDatePicker(id, field.key, field.label, 'month');
      case 'number':
        return (
          <Input
            id={id}
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder ?? '完全一致'}
            className={`w-40 text-right ${INPUT_CLASS}`}
          />
        );
      default:
        return (
          <Input
            id={id}
            value={value}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder ?? 'コード または 名称（部分一致）'}
            className={`w-64 ${INPUT_CLASS}`}
          />
        );
    }
  };

  return (
    <CollapsibleCard
      title={
        <span className="flex items-center gap-2">
          <Search className="h-5 w-5 text-gray-700" aria-hidden="true" />
          検索条件
        </span>
      }
      className="mb-3"
      collapsedSummary={searchSummary}
    >
      <div className="px-4 py-3 flex flex-wrap items-end gap-x-6 gap-y-3">
        {fields.map((field) => (
          <div key={field.key} className="flex items-center gap-2">
            <label
              htmlFor={`${def.routeId}-search-${field.key}`}
              className={`${FORM_LABEL_CLASS} whitespace-nowrap`}
            >
              {field.label}
            </label>
            {renderControl(field)}
          </div>
        ))}
        {def.inactivation && (
          <div className="flex items-center gap-2">
            <label
              htmlFor={`${def.routeId}-search-inactive`}
              className={`${FORM_LABEL_CLASS} whitespace-nowrap`}
            >
              無効化
            </label>
            <Select
              value={criteria[INACTIVE_CRITERIA_KEY] || ALL_VALUE}
              onValueChange={(v) =>
                onChange(INACTIVE_CRITERIA_KEY, v === ALL_VALUE ? '' : v)
              }
            >
              <SelectTrigger
                id={`${def.routeId}-search-inactive`}
                className={`w-36 ${INPUT_CLASS}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>全て</SelectItem>
                <SelectItem value="active">有効のみ</SelectItem>
                <SelectItem value="inactive">無効のみ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {/* 検索ボタンは設けない。クリアは検索条件を初期値に戻す（列フィルタ・ソートは変えない） */}
        <div className="ml-auto flex items-center">
          <button
            type="button"
            onClick={onClear}
            className={`${BUTTON_STYLES.cancel} ${BUTTON_BASE} flex items-center gap-2 px-3 py-1.5 text-sm`}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            クリア
          </button>
        </div>
      </div>
    </CollapsibleCard>
  );
}
