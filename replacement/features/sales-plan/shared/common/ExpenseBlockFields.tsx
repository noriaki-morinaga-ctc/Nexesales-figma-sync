import type { Dispatch, SetStateAction } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NumericInput } from '@/components/ui/numeric-input';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import {
  SingleCombobox,
  type SingleComboboxOption,
} from '@/components/ui/single-combobox';
import { RequiredBadge } from '@/components/ui/required-badge';
import {
  EXPENSE_CAMPAIGN_CODE_OPTIONS,
  EXPENSE_MANAGEMENT_CODE_OPTIONS,
} from '@/constants/expenseRelations';
import {
  isManagementCodeInClass,
  isCampaignCodeInClass,
  fillFromManagementCode,
  fillFromManagementClass,
  fillFromCampaignCode,
  fillFromCampaignClass,
} from '@/utils/common/expenseRelations';
import type { ExpenseCodePatch } from '@/types/master';
import {
  managementCodeComboOptions,
  managementClassComboOptions,
  campaignCodeComboOptions,
  campaignClassComboOptions,
  managementClassCodeComboOptions,
  managementCodeNameComboOptions,
  campaignClassCodeComboOptions,
  campaignCodeNameComboOptions,
} from '@/constants/comboFieldOptions';
import {
  managementClassCodeOf,
  managementClassNameOf,
  managementCodeNameOf,
  managementCodeOfName,
  campaignClassCodeOf,
  campaignClassNameOf,
  campaignCodeNameOf,
  campaignCodeOfName,
} from '@/utils/common/comboFieldOptions';

// 拡売費追加・編集・コピーフォームの拡売費入力ブロック（共通）。
// prefix で exp1*/exp2* のフォーム値へ振り分ける（販売計画表・シミュレーション共用）。
// required で必須表示・必須チェックを切替。shouldValidateRequired で必須エラー表示のみを切替
// （シミュレーションの拡売費②は「②に入力あり」の時のみ true を動的に渡す）。
interface ExpenseBlockFieldsProps {
  prefix: 'exp1' | 'exp2';
  // フォーム値（exp1*/exp2* のキーを持つ任意のフォーム型）
  form: any;
  setForm: Dispatch<SetStateAction<any>>;
  submitted: boolean;
  /** 必須バッジ・必須エラー表示（既定 true） */
  required?: boolean;
  /**
   * 必須エラー表示（赤枠）の有無（既定は required に従う）。
   * シミュレーションの拡売費②は任意入力のため、入力ありの時のみ true を渡す。
   */
  shouldValidateRequired?: boolean;
  /**
   * 施策コード・施策区分の必須表示（既定は required に従う）。
   * 拡売費計画は明細1行がキーのため、施策は任意入力として false を渡す。
   */
  campaignRequired?: boolean;
  /** 計上年月カレンダーの寄せ方向（既定 'end'＝右寄せ） */
  postingMonthAlign?: 'start' | 'center' | 'end';
  /** ブロック全体を非活性にする（シミュレーションの拡売費②＝①未入力時に使用）。必須バッジもグレー表示にする */
  disabled?: boolean;
}

// 必須バッジ。非活性の間はグレー表示にする（RequiredBadge は ui 配下のため外側で切り替える）。
const requiredBadge = (disabled: boolean) =>
  disabled ? (
    <span className="grayscale opacity-50">
      <RequiredBadge />
    </span>
  ) : (
    <RequiredBadge />
  );

const reqRing = (err: boolean) => (err ? 'rounded-md ring-1 ring-red-500' : '');
const reqInputCls = (err: boolean) =>
  `w-full bg-white shadow-sm focus:ring-2 ${
    err
      ? 'border-red-500 focus:ring-red-500'
      : 'border-gray-400 focus:ring-blue-500'
  }`;

// 区分／コードのコンボボックス1項目分の仕様。8項目が同形のため共通化する。
interface ComboFieldSpec {
  label: string;
  required: boolean;
  error: boolean;
  options: SingleComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}

// ComboFieldSpec 1件をラベル付きのコンボボックスへ描画する。
const comboField = ({
  label,
  required,
  error,
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
}: ComboFieldSpec) => (
  <div className="space-y-1.5" key={label}>
    <Label className="text-sm font-medium text-gray-700">
      {label} {required && requiredBadge(disabled)}
    </Label>
    <div className={reqRing(error)}>
      <SingleCombobox
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        clearable
      />
    </div>
  </div>
);

export function ExpenseBlockFields({
  prefix,
  form,
  setForm,
  submitted,
  required = true,
  shouldValidateRequired = required,
  campaignRequired = required,
  postingMonthAlign = 'end',
  disabled = false,
}: ExpenseBlockFieldsProps) {
  // exp1*/exp2* のキー生成・取得・更新ヘルパー
  const k = (suffix: string) => `${prefix}${suffix}`;
  const val = (suffix: string) => (form[k(suffix)] as string) ?? '';
  const set = (suffix: string, v: string) =>
    setForm((p: any) => ({ ...p, [k(suffix)]: v }));

  // 補完パッチ（接頭辞なしキー）をフォームへ接頭辞付きで適用する。
  const applyPatch = (patch: ExpenseCodePatch) =>
    setForm((p: any) => {
      const next: any = { ...p };
      Object.entries(patch).forEach(([key, value]) => {
        next[k(key)] = value;
      });
      return next;
    });

  const codeErr =
    shouldValidateRequired && submitted && !val('ManagementCode').trim();
  const classErr =
    shouldValidateRequired && submitted && !val('ManagementClass').trim();
  const amountErr =
    shouldValidateRequired && submitted && !val('PlannedAmount').trim();
  const monthErr =
    shouldValidateRequired && submitted && !val('PostingMonth').trim();
  const campClassErr =
    campaignRequired && submitted && !val('CampaignClass').trim();
  const campCodeErr =
    campaignRequired && submitted && !val('CampaignCode').trim();

  // 管理区分が選択済みなら該当する管理コードのみに絞り込む
  const managementCodeList = EXPENSE_MANAGEMENT_CODE_OPTIONS.filter(
    (o) =>
      !val('ManagementClass') ||
      isManagementCodeInClass(o.value, val('ManagementClass'))
  ).map((o) => o.value);

  // 管理区分・管理コードの4項目（区分値／名称の対）。
  // フォームが保持するのは管理区分＝名称・管理コード＝コードのため、
  // 対になる項目は変換して表示し、選択されたら逆変換して同じ値へ書き戻す。
  const managementFields: ComboFieldSpec[] = [
    {
      label: '管理区分',
      required,
      error: classErr,
      options: managementClassCodeComboOptions(),
      value: managementClassCodeOf(val('ManagementClass')),
      onChange: (v) =>
        applyPatch(
          fillFromManagementClass(
            managementClassNameOf(v),
            val('ManagementCode')
          )
        ),
      placeholder: '管理区分を選択',
    },
    {
      label: '管理区分名称',
      required,
      error: classErr,
      options: managementClassComboOptions(),
      value: val('ManagementClass'),
      onChange: (v) =>
        applyPatch(fillFromManagementClass(v, val('ManagementCode'))),
      placeholder: '管理区分名称を選択',
    },
    {
      label: '管理コード',
      required,
      error: codeErr,
      options: managementCodeComboOptions(managementCodeList),
      value: val('ManagementCode'),
      onChange: (v) => applyPatch(fillFromManagementCode(v)),
      placeholder: '管理コードを選択',
    },
    {
      label: '管理コード名称',
      required,
      error: codeErr,
      options: managementCodeNameComboOptions(managementCodeList),
      value: managementCodeNameOf(val('ManagementCode')),
      onChange: (v) =>
        applyPatch(fillFromManagementCode(managementCodeOfName(v))),
      placeholder: '管理コード名称を選択',
    },
  ];

  // 施策区分が選択済みなら該当する施策コードのみに絞り込む
  const campaignCodeList = EXPENSE_CAMPAIGN_CODE_OPTIONS.filter(
    (o) =>
      !val('CampaignClass') ||
      isCampaignCodeInClass(o.value, val('CampaignClass'))
  ).map((o) => o.value);

  // 施策は任意入力のため、プレースホルダへ「（任意）」を付ける。
  const optionalSuffix = campaignRequired ? '' : '（任意）';

  // 施策区分・施策コードの4項目（管理側と同じく区分値／名称の対）。
  const campaignFields: ComboFieldSpec[] = [
    {
      label: '施策区分',
      required: campaignRequired,
      error: campClassErr,
      options: campaignClassCodeComboOptions(),
      value: campaignClassCodeOf(val('CampaignClass')),
      onChange: (v) =>
        applyPatch(
          fillFromCampaignClass(campaignClassNameOf(v), val('CampaignCode'))
        ),
      placeholder: `施策区分を選択${optionalSuffix}`,
    },
    {
      label: '施策区分名称',
      required: campaignRequired,
      error: campClassErr,
      options: campaignClassComboOptions(),
      value: val('CampaignClass'),
      onChange: (v) =>
        applyPatch(fillFromCampaignClass(v, val('CampaignCode'))),
      placeholder: `施策区分名称を選択${optionalSuffix}`,
    },
    {
      label: '施策コード',
      required: campaignRequired,
      error: campCodeErr,
      options: campaignCodeComboOptions(campaignCodeList),
      value: val('CampaignCode'),
      onChange: (v) => applyPatch(fillFromCampaignCode(v)),
      placeholder: `施策コードを選択${optionalSuffix}`,
    },
    {
      label: '施策コード名称',
      required: campaignRequired,
      error: campCodeErr,
      options: campaignCodeNameComboOptions(campaignCodeList),
      value: campaignCodeNameOf(val('CampaignCode')),
      onChange: (v) => applyPatch(fillFromCampaignCode(campaignCodeOfName(v))),
      placeholder: `施策コード名称を選択${optionalSuffix}`,
    },
  ];

  return (
    <div className="space-y-4">
      {/* 管理区分・管理コード（区分値／名称の対を必ず隣り合わせる。幅に関わらず常に2列） */}
      <div className="grid grid-cols-2 gap-3">
        {managementFields.map((f) => comboField({ ...f, disabled }))}
      </div>

      {/* 施策区分・施策コード（任意入力。幅に関わらず常に2列） */}
      <div className="grid grid-cols-2 gap-3">
        {campaignFields.map((f) => comboField({ ...f, disabled }))}
      </div>

      {/* 計画金額・計上年月（1行2列） */}
      <div className="grid grid-cols-1 gap-3 @md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">
            計画金額 {required && requiredBadge(disabled)}
          </Label>
          <NumericInput
            value={val('PlannedAmount')}
            /* 計画金額は整数のみ入力可（小数点を入力させない） */
            maxFractionDigits={0}
            onChange={(e) => set('PlannedAmount', e.target.value)}
            placeholder="例: 150000"
            disabled={disabled}
            className={reqInputCls(amountErr)}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">
            計上年月 {required && requiredBadge(disabled)}
          </Label>
          <div className={reqRing(monthErr)}>
            <MonthYearPicker
              className="w-full"
              align={postingMonthAlign}
              value={val('PostingMonth')}
              onChange={(v) => set('PostingMonth', v)}
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {/* 摘要1（社内用） */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">
          摘要1（社内用）
        </Label>
        <Textarea
          value={val('Description')}
          onChange={(e) => set('Description', e.target.value)}
          placeholder="摘要を入力（任意）"
          disabled={disabled}
          className="w-full bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
