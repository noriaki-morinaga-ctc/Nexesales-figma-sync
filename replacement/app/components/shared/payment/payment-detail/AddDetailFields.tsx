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
import { RequiredBadge } from '../../../ui/required-badge';

// 非活性欄の見た目（グリッドの編集不可セル＝灰と対応させる）。
const READONLY_INPUT_CLASS =
  'w-full cursor-default border-gray-300 bg-gray-100 text-gray-600';

interface FieldFrameProps {
  label: string;
  htmlFor: string;
  wide?: boolean;
  // 必須項目（ラベルの右に必須バッジを出す）。
  required?: boolean;
  children: React.ReactNode;
}

// 項目1件の枠（ラベル＋コントロール）。
// wide=true の項目はグループの1行を丸ごと使う（長文の入力欄を横に広く取り、
// 続けて並べた項目が横並びではなく上下に並ぶようにする）。
function FieldFrame({
  label,
  htmlFor,
  wide = false,
  required = false,
  children,
}: FieldFrameProps) {
  return (
    <div
      className={`space-y-1.5 ${wide ? '@md:col-span-2 @2xl:col-span-3' : ''}`}
    >
      <Label htmlFor={htmlFor} className="text-sm font-medium text-gray-700">
        {label}
        {required && <RequiredBadge />}
      </Label>
      {children}
    </div>
  );
}

interface InputFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  // 入力欄に入ったとき。
  onFocus?: () => void;
  // 入力欄を離れたとき（入力の確定。数値入力ボックスは指定桁へ整えたあとに呼ぶ）。
  onBlur?: () => void;
  placeholder?: string;
  // 数値項目（右寄せ）。グリッドの数値列と表示をそろえる。
  numeric?: boolean;
  // 数値入力ボックスにする場合の小数桁（0=整数）。未指定ならテキスト入力欄。
  maxFractionDigits?: number;
  // グループの1行を丸ごと使う（長文の入力欄向け）。
  wide?: boolean;
  // 必須項目（ラベルの右に必須バッジを出す）。
  required?: boolean;
  // 必須項目が未入力のまま追加を試みたとき、入力欄を赤枠で示す。
  invalid?: boolean;
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
  onFocus,
  onBlur,
  placeholder,
  numeric = false,
  maxFractionDigits,
  wide = false,
  required = false,
  invalid = false,
}: InputFieldProps) {
  const borderClass = invalid
    ? 'border-red-500 ring-1 ring-red-500'
    : 'border-gray-400';
  return (
    <FieldFrame label={label} htmlFor={id} wide={wide} required={required}>
      {maxFractionDigits == null ? (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          inputMode={numeric ? 'numeric' : undefined}
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          className={`${TEXT_INPUT_CLASS} w-full ${borderClass} ${numeric ? 'text-right' : ''}`}
        />
      ) : (
        <NumericInput
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          maxFractionDigits={maxFractionDigits}
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          className={`w-full bg-white text-right ${borderClass}`}
        />
      )}
    </FieldFrame>
  );
}

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SingleComboboxOption[];
  placeholder?: string;
  // 必須項目（ラベルの右に必須バッジを出す）。
  required?: boolean;
  // 必須項目が未選択のまま追加を試みたとき、選択欄を赤枠で示す。
  invalid?: boolean;
}

// 活性の選択欄（単一選択コンボボックス）。グリッドのコンボボックス列に対応する。
export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  invalid = false,
}: SelectFieldProps) {
  return (
    <FieldFrame label={label} htmlFor={id} required={required}>
      <div className={invalid ? 'rounded-md ring-1 ring-red-500' : ''}>
        <SingleCombobox
          ariaRequired={required}
          id={id}
          options={options}
          value={value}
          onChange={onChange}
          placeholder={placeholder ?? `${label}を選択`}
          clearable
        />
      </div>
    </FieldFrame>
  );
}

interface ReadOnlyFieldProps {
  id: string;
  label: string;
  value?: string;
  hint?: string;
  // グループの1行を丸ごと使う。
  wide?: boolean;
}

// 非活性の表示欄。グリッドで編集できない列に対応する。
// hint には値が入る経緯（自動採番・自動表示・自動算出）を書き、空欄の理由が分かるようにする。
export function ReadOnlyField({
  id,
  label,
  value,
  hint,
  wide = false,
}: ReadOnlyFieldProps) {
  return (
    <FieldFrame label={label} htmlFor={id} wide={wide}>
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

interface CheckFieldProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  // グループの1行を丸ごと使う。
  wide?: boolean;
}

// チェックボックス項目（グリッドのチェックボックス列に対応する）。
// 横に並ぶ項目（ラベル＋入力欄）と高さをそろえるため、既定ではラベル1行分の余白を
// 上に取る。wide=true（1行を丸ごと使う）のときは並ぶ相手が居ないため余白を取らない。
export function CheckField({
  id,
  label,
  checked,
  onChange,
  wide = false,
}: CheckFieldProps) {
  return (
    <div
      className={`flex items-center gap-2 ${
        wide ? '@md:col-span-2 @2xl:col-span-3' : 'pt-6'
      }`}
    >
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

interface FieldGroupProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

// 項目のまとまり（グリッドの列グループに対応する見出し＋2〜3列のグリッド）。
export function FieldGroup({ title, description, children }: FieldGroupProps) {
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
