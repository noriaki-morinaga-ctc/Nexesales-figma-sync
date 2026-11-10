// 型1 マスタメンテ画面の検索条件カード。
// 検索ボタンは設けず、条件を変えるたびに一覧を随時更新する（マスタ画面標準化 p.7「検索」、9/24 決定3）。
// 一覧の業務キー（PK）・名称・外部キーを候補にし、クリアで初期値へ戻す（画面設計標準 3.2）。
// 世代管理の適用開始年月日は From〜To で指定し、各業務キーの最新世代で判定する（Q&A No.34②）。
// 2026-10-30 画面設計標準 ver0.3・guidelines（10/28〜29）への準拠：
// ・検索条件は全画面共通の 5 列（SEARCH_GRID_CLASS）に並べ、ラベルは SEARCH_LABEL_CLASS、入力欄は flex-1（→ 05）
// ・選択肢のある項目（外部キー・区分・無効化）は MultiCombobox の複数選択。未選択＝条件なし（→ 02 §9-2）
// ・クリアはヘッダー右の SearchClearButton、折り畳み中は値のある条件を見出しに要約（→ 02 §11）
// ・カードは CopyableArea で囲み、表示中の値を Ctrl+C／右クリックでコピーできる（→ 02 §15）
// ・年月日は共通のカレンダー部品で、任意のため×でクリア。範囲は min／max で逆転を防ぐ（→ 02 §14）
// 2026-11-06 修正依頼 SR-001（Q&A QM-041）の対応：
// ・ラベルの固定幅（SEARCH_LABEL_CLASS 5.625rem）をやめ、5 列を「ラベル列（max-content）＋入力列（minmax(0,1fr)）」の 10 トラックの grid にする。
//   型1 の項目名は 8〜15 文字あり、固定幅だと 1 列目がカードの左端で切れ、2 列目以降は左隣の入力欄に重なっていた（→ 05 ラベルが幅に収まらない画面）
// ・ラベル・入力欄は grid の直接の子（Fragment）。範囲指定は label・開始・「～」・終了の 4 トラック

import { Fragment } from 'react';
import { Search } from 'lucide-react';
import { CollapsibleCard } from '../../ui/collapsible-card';
import { CopyableArea } from '../../ui/copyable-area';
import { DateMonthYearPicker } from '../../ui/date-month-year-picker';
import { MonthYearPicker } from '../../ui/month-year-picker';
import { Input } from '../../ui/input';
import { MultiCombobox } from '../../ui/multi-combobox';
import { NumericInput } from '../../ui/numeric-input';
import { SearchClearButton } from '../../ui/search-clear-button';
import {
  buildSearchSummary,
  formatSummaryRange,
  formatSummaryValues,
} from '../../ui/search-summary';
import {
  FORM_LABEL_CLASS,
  TEXT_INPUT_CLASS,
} from '../../../../styles/commonStyles';
import type {
  MasterCriteria,
  MasterCriteriaValue,
  MasterFieldDef,
  MasterScreenDef,
} from './masterTypes';
import {
  INACTIVE_CRITERIA_KEY,
  childOptions,
  criteriaValues,
  fieldByKey,
  startFromKey,
  startToKey,
  toComboOptions,
} from './masterUtils';

// 検索条件の並び：ラベル列（max-content＝その列で最も長いラベル）＋入力列（minmax(0,1fr)＝残りを 5 列で等分）を 5 組（→ 05 ラベルが幅に収まらない画面）
const SEARCH_FORM_CLASS =
  'grid grid-cols-[repeat(5,max-content_minmax(0,1fr))] items-center gap-x-2 gap-y-2.5';
// ラベル（右寄せ・折り返さない・固定幅なし）。2 列目以降は左余白 0.75rem を足し、入力欄と次のラベルの間隔を従来の 1.25rem にそろえる（1 列目＝10n+1 番目は 0）
const SEARCH_LABEL_CLASS = `${FORM_LABEL_CLASS} flex items-center justify-end whitespace-nowrap pl-3 nth-[10n+1]:pl-0`;
// 入力欄の箱（列幅を超えないよう最小 0）
const SEARCH_FIELD_CLASS = 'min-w-0';

// 無効化の条件（複数選択。両方選ぶ・未選択＝条件なし）
const INACTIVE_OPTIONS = [
  { value: 'active', label: '有効' },
  { value: 'inactive', label: '無効' },
];

// 数値の入力欄の小数桁（整数は小数点を入力させない）
const FRACTION_DIGITS: Record<string, number> = {
  integer: 0,
  decimal2: 2,
  decimal4: 4,
};

interface MasterSearchCardProps {
  def: MasterScreenDef;
  criteria: MasterCriteria;
  onChange: (key: string, value: MasterCriteriaValue) => void;
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

  const textOf = (key: string): string => {
    const v = criteria[key];
    return Array.isArray(v) ? '' : (v ?? '');
  };
  // 選択肢（親項目があれば親の選択値で絞る）
  const optionsOf = (field: MasterFieldDef) =>
    toComboOptions(childOptions(field, criteria[field.parentKey ?? '']));

  // 検索条件カードを折り畳んだときに見出しの行へ出す要約（値が入っている項目だけ。UI/UX UX-024）。
  // 表示は入力欄と同じ（選択肢は表示名。複数選択は 2 件まで＋他N件）
  const summaryValueOf = (field: MasterFieldDef): string => {
    if (def.generation && field.key === def.generation.startKey) {
      return formatSummaryRange(
        textOf(startFromKey(def)),
        textOf(startToKey(def))
      );
    }
    if (field.kind === 'combo' || field.kind === 'select') {
      return formatSummaryValues(
        criteriaValues(criteria[field.key]),
        optionsOf(field)
      );
    }
    return textOf(field.key);
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
            value: formatSummaryValues(
              criteriaValues(criteria[INACTIVE_CRITERIA_KEY]),
              INACTIVE_OPTIONS
            ),
          },
        ]
      : []),
  ]);

  // 年月日（または年月）の入力。任意のため×でクリアできる（→ 02 §14.1）
  const renderDatePicker = (
    id: string,
    key: string,
    ariaLabel: string,
    kind: 'date' | 'month',
    range?: { min?: string; max?: string }
  ) => {
    const value = textOf(key);
    const Picker = kind === 'month' ? MonthYearPicker : DateMonthYearPicker;
    return (
      <Picker
        id={id}
        value={value}
        onChange={(v) => onChange(key, v)}
        ariaLabel={`${ariaLabel}を選択`}
        min={range?.min || undefined}
        max={range?.max || undefined}
        clearable
        // 一覧画面の検索条件では入力欄の幅いっぱいにする（→ 02 §14.1・UI/UX UX-029）
        className="w-full"
      />
    );
  };

  // 世代管理の適用開始（From〜To）：label・開始・「～」・終了の 4 トラックに置く。
  // 「～」は 2 列目のラベル列、終了は 2 列目の入力列に乗るため、終了が 2 列目の線にそろう（→ 05）
  // 5 列目から始まると終了が次の行に割れるため、5 列目に当たるときは行頭（col-start-1）から始める
  const renderRange = (field: MasterFieldDef, column: number) => {
    const id = `${def.routeId}-search-${field.key}`;
    const kind = field.kind === 'month' ? 'month' : 'date';
    const from = textOf(startFromKey(def));
    const to = textOf(startToKey(def));
    const labelClass =
      column === 4 ? `${SEARCH_LABEL_CLASS} col-start-1` : SEARCH_LABEL_CLASS;
    return (
      <Fragment key={field.key}>
        <label htmlFor={id} className={labelClass}>
          {field.label}
        </label>
        <div className={SEARCH_FIELD_CLASS}>
          {renderDatePicker(
            id,
            startFromKey(def),
            `${field.label}（開始）`,
            kind,
            {
              max: to,
            }
          )}
        </div>
        <span
          className="flex items-center justify-center text-sm text-gray-700"
          aria-hidden="true"
        >
          ～
        </span>
        <div className={SEARCH_FIELD_CLASS}>
          {renderDatePicker(
            `${id}-to`,
            startToKey(def),
            `${field.label}（終了）`,
            kind,
            { min: from }
          )}
        </div>
      </Fragment>
    );
  };

  const renderControl = (field: MasterFieldDef) => {
    const id = `${def.routeId}-search-${field.key}`;
    switch (field.kind) {
      case 'combo':
      case 'select':
        // 複数選択。未選択＝条件なし（「全て」の選択肢は持たない。→ 02 §9-2）
        return (
          <MultiCombobox
            id={id}
            options={optionsOf(field)}
            value={criteriaValues(criteria[field.key])}
            onChange={(v) => onChange(field.key, v)}
          />
        );
      case 'date':
      case 'month':
        return renderDatePicker(id, field.key, field.label, field.kind);
      case 'number':
        return (
          <NumericInput
            id={id}
            value={textOf(field.key)}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder ?? '完全一致'}
            maxFractionDigits={FRACTION_DIGITS[field.format ?? 'integer']}
            className={`${TEXT_INPUT_CLASS} text-right`}
          />
        );
      default:
        return (
          <Input
            id={id}
            value={textOf(field.key)}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder ?? 'コード または 名称（部分一致）'}
            className={TEXT_INPUT_CLASS}
          />
        );
    }
  };

  // index＝項目の並び順。範囲指定は 2 列分を使うため、それより後の項目は列が 1 つずれる
  const rangeIndex = def.generation
    ? fields.findIndex((f) => f.key === def.generation?.startKey)
    : -1;
  const renderItem = (field: MasterFieldDef, index: number) => {
    const column =
      (index + (rangeIndex >= 0 && index > rangeIndex ? 1 : 0)) % 5;
    if (def.generation && field.key === def.generation.startKey) {
      return renderRange(field, column);
    }
    return (
      <Fragment key={field.key}>
        <label
          htmlFor={`${def.routeId}-search-${field.key}`}
          className={SEARCH_LABEL_CLASS}
        >
          {field.label}
        </label>
        <div className={SEARCH_FIELD_CLASS}>{renderControl(field)}</div>
      </Fragment>
    );
  };

  return (
    <CopyableArea className="shrink-0">
      <CollapsibleCard
        title={
          <span className="flex items-center gap-2">
            <Search className="h-5 w-5 text-gray-700" aria-hidden="true" />
            検索条件
          </span>
        }
        // 画面が低くても一覧カードに押しつぶされないよう縮めない（→ 05 一覧画面の型）
        className="shrink-0"
        // クリアはヘッダーに置き、専用の行を使わない（検索はリアルタイムのため検索ボタンは設けない）
        headerActions={<SearchClearButton onClick={onClear} />}
        collapsedSummary={searchSummary}
      >
        <div className="px-4 py-1.5">
          <div className={SEARCH_FORM_CLASS}>
            {fields.map(renderItem)}
            {def.inactivation && (
              <>
                <label
                  htmlFor={`${def.routeId}-search-inactive`}
                  className={SEARCH_LABEL_CLASS}
                >
                  無効化
                </label>
                <div className={SEARCH_FIELD_CLASS}>
                  <MultiCombobox
                    id={`${def.routeId}-search-inactive`}
                    options={INACTIVE_OPTIONS}
                    value={criteriaValues(criteria[INACTIVE_CRITERIA_KEY])}
                    onChange={(v) => onChange(INACTIVE_CRITERIA_KEY, v)}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </CollapsibleCard>
    </CopyableArea>
  );
}
