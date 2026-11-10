// 型1 マスタメンテ画面の右ペイン（登録／更新）。
// ・登録と更新は別ペイン（同じ部品を mode で切り替える）。1ペインに同居させない（9/17 宿題1700）
// ・登録ボタン：チェック → 登録 → 完了表示 → 入力をクリアして続けて登録できる。連続追加ボタンは設けない（9/24 決定3・4）
// ・エラーはペイン上部にまとめて表示する（マスタ画面標準化 p.7「エラー表示・チェック」）
// ・更新時は業務キー（PK）を変更不可にし、作成者・最終更新者と日時を表示する（7/30 決定7）
// ・コピー登録は新規登録と別の種類で、適用開始年月日以外の主キーを変更不可にする（Q&A No.34⑦）
// ・固定値の項目（共通会社など）は登録・更新とも変更不可（Q&A No.35①）
// 2026-10-30 画面設計標準 ver0.3・guidelines（10/28〜29）への準拠：
// ・未保存の入力の破棄確認は RightPane の dirty に渡す（×・Esc・別のペインを開いたとき。→ 02 §13.1）
// ・入力欄は TEXT_INPUT_CLASS、数値は NumericInput、区分は SingleCombobox（searchable なし）。shadcn の Select は使わない（→ 02 §4・§9）
// ・ラベルは左・入力欄は右の横並び（→ 05 フォーム項目レイアウト）
// 2026-10-30（2回目）Q&A の回答への対応：
// ・数値はマイナスを入力できない（型1 の標準。allowNegative の項目だけ許す。QM-020・026）
// ・長い文字の項目：複数行の入力欄（textarea）と文字数の上限（maxLength）。幅の広い入力欄を持つ画面は右ペインを 44rem で開く（QM-034）
// 2026-11-05 Q&A QM-043 の対応：
// ・ラベル列は固定幅（w-32）をやめ、そのペインで最も長いラベルに合わせる（2 列 grid の max-content）。
//   固定幅だと長いラベルが justify-end で左へはみ出し、ペイン本体がスクロール領域のため左端で切れていた（→ 05 右ペインのフォーム）

import { Fragment } from 'react';
import { Save } from 'lucide-react';
import { Textarea } from '../../ui/textarea';
import { MASTER_MESSAGES } from '../../../constants/masterMessages';
import { RightPane } from '../../ui/right-pane';
import { DateMonthYearPicker } from '../../ui/date-month-year-picker';
import { MonthYearPicker } from '../../ui/month-year-picker';
import { Input } from '../../ui/input';
import { NumericInput } from '../../ui/numeric-input';
import { RequiredBadge } from '../../ui/required-badge';
import { SingleCombobox } from '../../ui/single-combobox';
import {
  FORM_LABEL_CLASS,
  TEXT_INPUT_CLASS,
} from '../../../../styles/commonStyles';
import type {
  MasterDraft,
  MasterFieldDef,
  MasterPaneMode,
  MasterRow,
  MasterScreenDef,
} from './masterTypes';
import {
  childOptions,
  formFields,
  integerDigitsOf,
  paneWidthOf,
  textareaRows,
  toComboOptions,
} from './masterUtils';

// 項目の並び：ラベル列＝そのペインの最長ラベルの幅（max-content）、値列＝残り（minmax(0,1fr)。入力欄を縮められるよう最小 0）（→ 05 右ペインのフォーム）
const PANE_FORM_CLASS =
  'grid grid-cols-[max-content_minmax(0,1fr)] items-start gap-x-2 gap-y-3';
// ラベル（右寄せ・折り返さない・入力欄と同じ高さ）。固定幅は付けない（ペインの左端で切れる。Q&A QM-043）
const PANE_LABEL_CLASS = `${FORM_LABEL_CLASS} flex h-9.5 items-center justify-end whitespace-nowrap`;

// 数値の入力欄の小数桁（整数は小数点を入力させない）
const FRACTION_DIGITS: Record<string, number> = {
  integer: 0,
  decimal2: 2,
  decimal4: 4,
};

interface MasterEditPaneProps {
  def: MasterScreenDef;
  open: boolean;
  mode: MasterPaneMode;
  draft: MasterDraft;
  /** 未保存の入力があるか（RightPane の破棄確認に渡す） */
  dirty: boolean;
  errors: string[];
  /** 更新対象の行（作成者・更新者の表示用。登録時は undefined） */
  current?: MasterRow;
  onChange: (key: string, value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function MasterEditPane({
  def,
  open,
  mode,
  draft,
  dirty,
  errors,
  current,
  onChange,
  onSubmit,
  onClose,
}: MasterEditPaneProps) {
  const actionLabel = mode === 'update' ? '更新' : '登録';
  const paneTitle =
    mode === 'copy'
      ? `${def.entityLabel} コピー登録`
      : `${def.entityLabel} ${actionLabel}`;

  // 変更不可の判定：更新は主キー全て、コピー登録は適用期間（開始・終了）以外の主キー、固定値の項目は常に
  const isLocked = (field: MasterFieldDef): boolean => {
    if (field.fixedValue !== undefined) return true;
    if (field.pk !== true) return false;
    if (mode === 'update') return true;
    return (
      mode === 'copy' &&
      field.key !== def.generation?.startKey &&
      field.key !== def.generation?.endKey
    );
  };
  // 親項目（事業場など）は、子（部署など）が変更不可なら一緒に変更不可にする（子の子が変更不可でも同じ）
  const isDisabled = (field: MasterFieldDef): boolean =>
    isLocked(field) ||
    def.fields.some((c) => c.parentKey === field.key && isDisabled(c));

  // 数値の入力：桁の上限を超える入力は受け付けない（Q&A QM-029）。マイナスは allowNegative の項目以外は受け付けない（型1 の標準。QM-020・026）
  const handleNumberChange = (field: MasterFieldDef, raw: string) => {
    const value = field.allowNegative ? raw : raw.replace(/-/g, '');
    if (
      field.maxDigits !== undefined &&
      integerDigitsOf(value) > field.maxDigits
    )
      return;
    onChange(field.key, value);
  };

  const renderControl = (field: MasterFieldDef) => {
    const id = `${def.routeId}-form-${field.key}`;
    const value = draft[field.key] ?? '';
    const disabled = isDisabled(field);
    if (field.readOnly) {
      return (
        <div
          id={id}
          role="textbox"
          aria-readonly="true"
          aria-labelledby={`${id}-label`}
          className="flex h-9.5 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700"
        >
          {value || (mode !== 'update' ? '登録時に自動採番' : '-')}
        </div>
      );
    }
    switch (field.kind) {
      case 'combo':
        return (
          <SingleCombobox
            id={id}
            options={toComboOptions(
              childOptions(field, draft[field.parentKey ?? ''] ?? '')
            )}
            value={value}
            onChange={(v) => onChange(field.key, v)}
            // 任意の判断軸は未設定＝「指定なし」を表示し、クリアで未設定に戻せる
            placeholder={field.emptyLabel ?? 'コード または 名称で検索...'}
            clearable={!field.required}
            ariaRequired={field.required}
            disabled={disabled}
          />
        );
      case 'select':
        // 短い固定リストは絞り込み欄なしのコンボボックス（shadcn の Select は使わない → 02 §4）
        return (
          <SingleCombobox
            id={id}
            options={toComboOptions(field.options)}
            value={value}
            onChange={(v) => onChange(field.key, v)}
            placeholder={field.emptyLabel ?? '選択してください'}
            clearable={!field.required}
            ariaRequired={field.required}
            disabled={disabled}
            searchable={false}
          />
        );
      case 'date':
        return (
          <DateMonthYearPicker
            id={id}
            value={value}
            onChange={(v) => onChange(field.key, v)}
            disabled={disabled}
            required={field.required}
            clearable={!field.required}
            ariaLabel={`${field.label}を選択`}
          />
        );
      case 'month':
        return (
          <MonthYearPicker
            id={id}
            value={value}
            onChange={(v) => onChange(field.key, v)}
            disabled={disabled}
            required={field.required}
            clearable={!field.required}
            ariaLabel={`${field.label}を選択`}
          />
        );
      case 'number':
        return (
          <div className="flex items-center gap-2">
            <NumericInput
              id={id}
              value={value}
              onChange={(e) => handleNumberChange(field, e.target.value)}
              placeholder={field.placeholder}
              aria-required={field.required}
              disabled={disabled}
              maxFractionDigits={FRACTION_DIGITS[field.format ?? 'integer']}
              min={field.min}
              max={field.max}
              className={`${TEXT_INPUT_CLASS} text-right`}
            />
            {field.unit && (
              <span className="shrink-0 text-sm text-gray-600">
                {field.unit}
              </span>
            )}
          </div>
        );
      case 'textarea':
        // 複数行の文字入力（100 文字を超える本文など）。行数は文字数から決め、文字数の上限を超える入力は受け付けない（Q&A QM-034）
        return (
          <Textarea
            id={id}
            value={value}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            aria-required={field.required}
            disabled={disabled}
            maxLength={field.maxLength}
            rows={textareaRows(field)}
            className={`${TEXT_INPUT_CLASS} h-auto`}
          />
        );
      default:
        return (
          <Input
            id={id}
            value={value}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            aria-required={field.required}
            disabled={disabled}
            maxLength={field.maxLength}
            className={TEXT_INPUT_CLASS}
          />
        );
    }
  };

  return (
    <RightPane
      open={open}
      onClose={onClose}
      title={paneTitle}
      description={`${def.entityLabel}マスタの${actionLabel}を行います`}
      // 幅の広い入力欄（複数行・40 文字以上）を持つ画面は広げて開く（Q&A QM-034）
      initialWidth={paneWidthOf(def)}
      // 未保存の入力があれば、×・Esc・別のペインを開くときに破棄の確認を出す（画面設計標準 3.4）
      dirty={dirty}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onSubmit}
            className="btn-action-base btn-action-blue"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {actionLabel}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {errors.length > 0 && (
          <div
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700"
          >
            <p className="font-bold">{MASTER_MESSAGES['MSG-E-007']}</p>
            <ul className="mt-1 list-disc pl-5">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}
        {mode === 'create' && (
          <p className="text-xs text-gray-500">
            登録後は入力内容をクリアし、続けて登録できます。終了するときは右上の×で閉じてください。
          </p>
        )}
        <div className={PANE_FORM_CLASS}>
          {formFields(def).map((field) => (
            <Fragment key={field.key}>
              {field.readOnly ? (
                // 表示のみの項目は labelable 要素が無いため、label ではなく span で名前を付ける（→ 06）
                <span
                  id={`${def.routeId}-form-${field.key}-label`}
                  className={PANE_LABEL_CLASS}
                >
                  {field.label}
                </span>
              ) : (
                <label
                  htmlFor={`${def.routeId}-form-${field.key}`}
                  className={PANE_LABEL_CLASS}
                >
                  {field.label}
                  {field.required && <RequiredBadge />}
                </label>
              )}
              <div className="flex min-w-0 flex-col gap-1">
                {renderControl(field)}
                {field.note && (
                  <p className="text-xs text-gray-500">{field.note}</p>
                )}
              </div>
            </Fragment>
          ))}
        </div>
        {mode === 'update' && current && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-gray-200 pt-3 text-xs text-gray-600">
            <dt>作成者</dt>
            <dd>
              {current.createdBy} / {current.createdAt}
            </dd>
            <dt>最終更新者</dt>
            <dd>
              {current.updatedBy} / {current.updatedAt}
            </dd>
          </dl>
        )}
      </div>
    </RightPane>
  );
}
