// 明細追加ペイン（追加口・拡売費）で共用する入力項目の部品。
// グリッドの列と項目・活性/非活性をそろえるため、次の2種類だけを使う。
//   InputField    … グリッドで編集できる列に対応する活性の入力欄
//   ReadOnlyField … グリッドで編集できない列に対応する非活性の表示欄
//                  （自動採番・マスタからの自動表示・数式による自動算出）
import { Label } from '../../../ui/label';
import { Input } from '../../../ui/input';
import { TEXT_INPUT_CLASS } from '../../../../../styles/commonStyles';
import { NumericInput } from '../../../ui/numeric-input';
import {
  SingleCombobox,
  type SingleComboboxOption,
} from '../../../ui/single-combobox';

// 非活性欄の見た目（グリッドの編集不可セル＝灰と対応させる）。
const READONLY_INPUT_CLASS =
  'w-full cursor-default border-gray-300 bg-gray-100 text-gray-600';

// 項目1件の枠（ラベル＋コントロール）。
function FieldFrame({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-gray-700">
        {label}
      </Label>
      {children}
    </div>
  );
}

// 活性の入力欄（テキスト・数値）。グリッドで編集できる列に対応する。
// maxFractionDigits を指定した項目は数値入力ボックス（NumericInput）にする。
// 指定桁を超える小数は受け付けず、フォーカスアウトで指定桁へ四捨五入する
//（0=整数。2=小数第2位まで＝小数第3位を四捨五入）。
export function InputField({
  id,
  label,
  value,
  onChange,
  placeholder,
  numeric = false,
  maxFractionDigits,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  // 数値項目（右寄せ）。グリッドの数値列と表示をそろえる。
  numeric?: boolean;
  // 数値入力ボックスにする場合の小数桁（0=整数）。未指定ならテキスト入力欄。
  maxFractionDigits?: number;
}) {
  return (
    <FieldFrame label={label} htmlFor={id}>
      {maxFractionDigits == null ? (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={numeric ? 'numeric' : undefined}
          className={`${TEXT_INPUT_CLASS} w-full ${numeric ? 'text-right' : ''}`}
        />
      ) : (
        <NumericInput
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxFractionDigits={maxFractionDigits}
          className="w-full border-gray-400 bg-white text-right"
        />
      )}
    </FieldFrame>
  );
}

// 活性の選択欄（単一選択コンボボックス）。グリッドのコンボボックス列に対応する。
export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SingleComboboxOption[];
  placeholder?: string;
}) {
  return (
    <FieldFrame label={label} htmlFor={id}>
      <SingleCombobox
        id={id}
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder ?? `${label}を選択`}
        clearable
      />
    </FieldFrame>
  );
}

// 非活性の表示欄。グリッドで編集できない列に対応する。
// hint には値が入る経緯（自動採番・自動表示・自動算出）を書き、空欄の理由が分かるようにする。
export function ReadOnlyField({
  id,
  label,
  value,
  hint,
}: {
  id: string;
  label: string;
  value?: string;
  hint?: string;
}) {
  return (
    <FieldFrame label={label} htmlFor={id}>
      <Input
        id={id}
        value={value ?? ''}
        readOnly
        placeholder={hint}
        className={`${TEXT_INPUT_CLASS} ${READONLY_INPUT_CLASS}`}
      />
    </FieldFrame>
  );
}

// チェックボックス項目（グリッドのチェックボックス列に対応する）。
export function CheckField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2 pt-6">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-400 text-blue-600 focus:ring-2 focus:ring-blue-500"
      />
      <Label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </Label>
    </div>
  );
}

// 項目のまとまり（グリッドの列グループに対応する見出し＋2〜3列のグリッド）。
export function FieldGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="border-b border-gray-200 pb-1 text-sm font-bold text-gray-900">
        {title}
      </h3>
      {description && <p className="text-sm text-gray-600">{description}</p>}
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 @md:grid-cols-2 @2xl:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

// 文字列を数値へ（カンマ区切りも許容）。数値にできなければ null。
export const toFormNumber = (value: string): number | null => {
  const n = Number.parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};
