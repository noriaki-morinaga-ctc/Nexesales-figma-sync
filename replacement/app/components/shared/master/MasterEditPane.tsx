// 型1 マスタメンテ画面の右ペイン（登録／更新）。
// ・登録と更新は別ペイン（同じ部品を mode で切り替える）。1ペインに同居させない（9/17 宿題1700）
// ・登録ボタン：チェック → 登録 → 完了表示 → 入力をクリアして続けて登録できる。連続追加ボタンは設けない（9/24 決定3・4）
// ・エラーはペイン上部にまとめて表示する（マスタ画面標準化 p.7「エラー表示・チェック」）
// ・更新時は業務キー（PK）を変更不可にし、作成者・最終更新者と日時を表示する（7/30 決定7）
// ・コピー登録は新規登録と別の種類で、適用開始年月日以外の主キーを変更不可にする（Q&A No.34⑦）
// ・固定値の項目（共通会社など）は登録・更新とも変更不可（Q&A No.35①）

import { Save } from 'lucide-react';
import { MASTER_MESSAGES } from '../../../constants/masterMessages';
import { RightPane } from '../../ui/right-pane';
import { DateMonthYearPicker } from '../../ui/date-month-year-picker';
import { MonthYearPicker } from '../../ui/month-year-picker';
import { Input } from '../../ui/input';
import { RequiredBadge } from '../../ui/required-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { SingleCombobox } from '../../ui/single-combobox';
import { FORM_LABEL_CLASS } from '../../../../styles/commonStyles';
import type {
  MasterDraft,
  MasterFieldDef,
  MasterPaneMode,
  MasterRow,
  MasterScreenDef,
} from './masterTypes';
import { childOptions, formFields, toComboOptions } from './masterUtils';

// フォーム入力の共通スタイル（→ 05「フォーム項目レイアウト」）
const INPUT_CLASS =
  'h-8 text-sm bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500';

interface MasterEditPaneProps {
  def: MasterScreenDef;
  open: boolean;
  mode: MasterPaneMode;
  draft: MasterDraft;
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
  // 親項目（事業場など）は、子（部署など）が変更不可なら一緒に変更不可にする
  const isDisabled = (field: MasterFieldDef): boolean =>
    isLocked(field) ||
    def.fields.some((c) => c.parentKey === field.key && isLocked(c));

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
          className="flex h-8 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700"
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
            placeholder="コード または 名称で検索..."
            clearable={!field.required}
            ariaRequired={field.required}
            disabled={disabled}
          />
        );
      case 'select':
        return (
          <Select
            value={value}
            onValueChange={(v) => onChange(field.key, v)}
            disabled={disabled}
            required={field.required}
          >
            <SelectTrigger
              id={id}
              aria-required={field.required}
              className={`w-full ${INPUT_CLASS}`}
            >
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((o) => (
                <SelectItem key={o.code} value={o.code}>
                  {o.code}:{o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'date':
        return (
          <DateMonthYearPicker
            id={id}
            value={value}
            onChange={(v) => onChange(field.key, v)}
            disabled={disabled}
            required={field.required}
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
            ariaLabel={`${field.label}を選択`}
          />
        );
      case 'number':
        return (
          <div className="flex items-center gap-2">
            <Input
              id={id}
              inputMode="decimal"
              value={value}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              aria-required={field.required}
              disabled={disabled}
              className={`text-right ${INPUT_CLASS}`}
            />
            {field.unit && (
              <span className="shrink-0 text-sm text-gray-600">
                {field.unit}
              </span>
            )}
          </div>
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
            className={INPUT_CLASS}
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
      initialWidth={34}
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
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          {formFields(def).map((field) => (
            <div key={field.key} className="flex flex-col gap-1">
              {field.readOnly ? (
                // 表示のみの項目は labelable 要素が無いため、label ではなく span で名前を付ける（→ 06）
                <span
                  id={`${def.routeId}-form-${field.key}-label`}
                  className={FORM_LABEL_CLASS}
                >
                  {field.label}
                </span>
              ) : (
                <label
                  htmlFor={`${def.routeId}-form-${field.key}`}
                  className={FORM_LABEL_CLASS}
                >
                  {field.label}
                  {field.required && <RequiredBadge />}
                </label>
              )}
              {renderControl(field)}
              {field.note && (
                <p className="text-xs text-gray-500">{field.note}</p>
              )}
            </div>
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
