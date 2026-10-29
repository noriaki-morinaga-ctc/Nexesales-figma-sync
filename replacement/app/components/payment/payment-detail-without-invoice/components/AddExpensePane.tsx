// 拡売費の「明細追加」ペイン（右ペインの本文）。
// 項目・並び・活性/非活性は拡売費一覧（PaymentNonProductExpensePane）の列にそろえる。
//   活性  … グリッドで編集できる列（卸からの請求名称〜摘要2（社外用）・税区分）
//   非活性… グリッドで編集できない列（自動採番・自動算出・画面の基本情報の参照表示・
//           分割先の枝番行でだけ入力する列）
// 管理区分／管理コード／施策区分／施策コードは、グリッドと同じくコード列と名称列の
// 両方を項目として並べる。8項目とも活性（選択可）で、どれを選んでも対になる項目へ
// 同じ値を反映し、区分を選ぶとコードの候補をその区分に属するものだけへ絞り込む
//（計画詳細(マージン率固定・NET入力)の拡売費追加と同じ挙動）。
import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  META_BRAND_MASTER,
  SUMMARY_PRODUCT_BY_VALUE,
} from '../../../../constants/productMasters';
import { DEFAULT_DATA_SOURCE } from '../../../../constants/dataSource';
import { MATCH_PAYMENT_TYPE_OPTIONS } from '../../../../constants/matchPaymentType';
import {
  EXPENSE_MANAGEMENT_CODE_OPTIONS,
  EXPENSE_CAMPAIGN_CODE_OPTIONS,
  isManagementCodeInClass,
  isCampaignCodeInClass,
  managementClassFromCode,
  campaignClassFromCode,
} from '../../../../constants/expenseRelations';
// 区分値／名称の対をそれぞれ選べるようにするための選択肢ビルダーと相互変換
//（拡売費一覧のグリッド・計画詳細の拡売費追加と同じものを使う）。
import {
  managementClassCodeComboOptions,
  managementClassComboOptions,
  managementCodeComboOptions,
  managementCodeNameComboOptions,
  campaignClassCodeComboOptions,
  campaignClassComboOptions,
  campaignCodeComboOptions,
  campaignCodeNameComboOptions,
  managementClassCodeOf,
  managementClassNameOf,
  managementCodeNameOf,
  managementCodeOfName,
  campaignClassCodeOf,
  campaignClassNameOf,
  campaignCodeNameOf,
  campaignCodeOfName,
  expenseSummaryProductComboOptions,
} from '../../../../constants/comboFieldOptions';
import {
  EXPENSE_TAX_CLASS_OPTIONS,
  type ExpenseFormValues,
} from '../../../shared/PaymentNonProductExpensePane';
import type { ExpenseBasicInfo } from '../../../shared/PaymentNonProductExpensePane';
import { linkedTaxClassOf } from '../../../../utils/expenseTaxClass';
import {
  FieldGroup,
  InputField,
  SelectField,
  ReadOnlyField,
} from './AddDetailFields';

// 親（画面）から「追加」ボタンで呼ぶハンドル。
export interface AddExpensePaneHandle {
  // 入力値を検証して明細を1件追加し、フォームを初期化する。
  // 追加できたら true を返す（ペインは閉じず、続けて入力できる）。
  submit: () => boolean;
}

interface AddExpensePaneProps {
  // 「追加」押下時。拡売費一覧（その他拡売費）へ明細を1件足す。
  onAdd: (values: ExpenseFormValues) => void;
  // 商流・組織列に表示する画面の基本情報（グリッドの親行と同じ参照表示にする）。
  basicInfo?: ExpenseBasicInfo;
}

const EMPTY_FORM: ExpenseFormValues = {
  billName: '',
  billNote: '',
  planExpContent: '',
  product: '',
  billAmount: '',
  payAmount: '',
  matchType: '',
  mgmtClass: '',
  mgmtCode: '',
  measureClass: '',
  measureCode: '',
  summary1: '',
  summary2: '',
  taxClass: '',
  billNo: '',
  billPage: '',
};

const BRANCH_ONLY_HINT = '分割先の行で入力';
const AUTO_CALC_HINT = '追加後に自動算出';

export const AddExpensePane = forwardRef<
  AddExpensePaneHandle,
  AddExpensePaneProps
>(function AddExpensePane({ onAdd, basicInfo }: AddExpensePaneProps, ref) {
  const [form, setForm] = useState<ExpenseFormValues>(EMPTY_FORM);

  const set = <K extends keyof ExpenseFormValues>(
    key: K,
    value: ExpenseFormValues[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const metaBrandOptions = useMemo(
    () =>
      META_BRAND_MASTER.map((brand) => ({
        value: brand.value,
        label: brand.name,
        code: brand.code,
      })),
    []
  );

  // サマリ商品の選択肢（商品マスタ）。2行目は拡売費一覧のサマリ商品列と同じ
  // 商品コードとし、商品名・商品コードのどちらでも検索できるようにする。
  const productOptions = useMemo(() => expenseSummaryProductComboOptions(), []);

  // 管理コードは管理区分を選んでいればその区分に属するものだけに絞り込む
  //（グリッドの管理コード列と同じ絞り込み）。コード・名称の両列で同じ候補を使う。
  const mgmtCodeList = useMemo(
    () =>
      EXPENSE_MANAGEMENT_CODE_OPTIONS.filter(
        (option) =>
          !form.mgmtClass ||
          isManagementCodeInClass(option.value, form.mgmtClass)
      ).map((option) => option.value),
    [form.mgmtClass]
  );

  // 施策コードも同様に、施策区分を選んでいればその区分に属するものだけに絞り込む。
  const measureCodeList = useMemo(
    () =>
      EXPENSE_CAMPAIGN_CODE_OPTIONS.filter(
        (option) =>
          !form.measureClass ||
          isCampaignCodeInClass(option.value, form.measureClass)
      ).map((option) => option.value),
    [form.measureClass]
  );

  // サマリ商品を選んだら、メタブランドを商品マスタから自動で入れる
  //（グリッドの「拡売費処理」での転記と同じ扱い）。
  const handleProductChange = (value: string) => {
    const brand = SUMMARY_PRODUCT_BY_VALUE.get(value)?.metaBrand;
    setForm((prev) => ({
      ...prev,
      product: value,
      planExpContent: brand ?? prev.planExpContent,
    }));
  };

  // 管理コードを選んだら、対応する管理区分を自動で入れる（グリッドの列間連動と同じ）。
  // 管理区分に紐づく税区分（1B3＝課税8%:2）があれば、税区分も入れる（→ C79）。
  const handleMgmtCodeChange = (value: string) =>
    setForm((prev) => {
      // コードをクリアした場合は管理区分をそのまま残す。
      const mgmtClass = managementClassFromCode(value) || prev.mgmtClass;
      return {
        ...prev,
        mgmtCode: value,
        mgmtClass,
        taxClass: linkedTaxClassOf(mgmtClass) ?? prev.taxClass,
      };
    });

  // 管理区分を変えたら、その区分に属さない管理コードはクリアする。
  // 管理区分に紐づく税区分（1B3＝課税8%:2）があれば、税区分も入れる（→ C79）。
  const handleMgmtClassChange = (value: string) =>
    setForm((prev) => ({
      ...prev,
      mgmtClass: value,
      mgmtCode:
        !prev.mgmtCode || isManagementCodeInClass(prev.mgmtCode, value)
          ? prev.mgmtCode
          : '',
      taxClass: linkedTaxClassOf(value) ?? prev.taxClass,
    }));

  // 施策コード・施策区分も管理側と同じ連動にする。
  const handleMeasureCodeChange = (value: string) =>
    setForm((prev) => ({
      ...prev,
      measureCode: value,
      measureClass: campaignClassFromCode(value) || prev.measureClass,
    }));

  const handleMeasureClassChange = (value: string) =>
    setForm((prev) => ({
      ...prev,
      measureClass: value,
      measureCode:
        !prev.measureCode || isCampaignCodeInClass(prev.measureCode, value)
          ? prev.measureCode
          : '',
    }));

  useImperativeHandle(ref, () => ({
    submit: () => {
      if (!form.billName.trim()) {
        toast.warning('卸からの請求名称を入力してください。');
        return false;
      }
      onAdd(form);
      // 次の入力に備えてフォームを初期化する（ペインの開閉は親が決める）。
      setForm(EMPTY_FORM);
      return true;
    },
  }));

  return (
    <div className="space-y-5 bg-white p-4">
      <FieldGroup title="明細">
        <ReadOnlyField id="add-exp-no" label="No." hint="追加時に自動採番" />
        <ReadOnlyField
          id="add-exp-source"
          label="データ元"
          value={DEFAULT_DATA_SOURCE}
        />
        <InputField
          id="add-exp-bill-name"
          label="卸からの請求名称"
          value={form.billName}
          onChange={(v) => set('billName', v)}
        />
        <InputField
          id="add-exp-bill-note"
          label="備考"
          value={form.billNote}
          onChange={(v) => set('billNote', v)}
        />
        <SelectField
          id="add-exp-meta-brand"
          label="メタブランド"
          value={form.planExpContent}
          onChange={(v) => set('planExpContent', v)}
          options={metaBrandOptions}
        />
        <SelectField
          id="add-exp-product"
          label="サマリ商品"
          value={form.product}
          onChange={handleProductChange}
          options={productOptions}
        />
      </FieldGroup>

      <FieldGroup title="金額・照合">
        <InputField
          id="add-exp-bill-amount"
          label="請求金額"
          value={form.billAmount}
          onChange={(v) => set('billAmount', v)}
          numeric
          maxFractionDigits={0}
        />
        <InputField
          id="add-exp-pay-amount"
          label="支払金額"
          value={form.payAmount}
          onChange={(v) => set('payAmount', v)}
          numeric
          maxFractionDigits={0}
          placeholder="未入力なら請求金額を初期表示"
        />
        <ReadOnlyField
          id="add-exp-split-amount"
          label="負担金額"
          hint={BRANCH_ONLY_HINT}
        />
        <ReadOnlyField
          id="add-exp-bill-pay-diff"
          label="請求－支払：差額"
          hint={AUTO_CALC_HINT}
        />
        <SelectField
          id="add-exp-match-type"
          label="照合支払区分"
          value={form.matchType}
          onChange={(v) => set('matchType', v)}
          options={MATCH_PAYMENT_TYPE_OPTIONS.map((v) => ({
            value: v,
            label: v,
          }))}
        />
      </FieldGroup>

      <FieldGroup
        title="商流・組織"
        description="明細行は画面の基本情報の値を表示します（分割先の行でのみ変更できます）。"
      >
        <ReadOnlyField
          id="add-exp-store"
          label="販売店"
          value={basicInfo?.store}
        />
        <ReadOnlyField
          id="add-exp-tertiary-store"
          label="三次店"
          value={basicInfo?.tertiaryStore}
        />
        <ReadOnlyField
          id="add-exp-primary-store"
          label="一次店"
          value={basicInfo?.primaryStore}
        />
        <ReadOnlyField
          id="add-exp-dept"
          label="費用負担部署"
          value={basicInfo?.dept}
        />
        <ReadOnlyField
          id="add-exp-staff"
          label="担当者"
          value={basicInfo?.staff}
        />
      </FieldGroup>

      <FieldGroup title="管理区分・施策区分">
        <SelectField
          id="add-exp-mgmt-class-code"
          label="管理区分"
          value={managementClassCodeOf(form.mgmtClass)}
          onChange={(v) => handleMgmtClassChange(managementClassNameOf(v))}
          options={managementClassCodeComboOptions()}
        />
        <SelectField
          id="add-exp-mgmt-class-name"
          label="管理区分名称"
          value={form.mgmtClass}
          onChange={handleMgmtClassChange}
          options={managementClassComboOptions()}
        />
        <SelectField
          id="add-exp-mgmt-code"
          label="管理コード"
          value={form.mgmtCode}
          onChange={handleMgmtCodeChange}
          options={managementCodeComboOptions(mgmtCodeList)}
        />
        <SelectField
          id="add-exp-mgmt-code-name"
          label="管理コード名称"
          value={managementCodeNameOf(form.mgmtCode)}
          onChange={(v) => handleMgmtCodeChange(managementCodeOfName(v))}
          options={managementCodeNameComboOptions(mgmtCodeList)}
        />
        <SelectField
          id="add-exp-measure-class-code"
          label="施策区分"
          value={campaignClassCodeOf(form.measureClass)}
          onChange={(v) => handleMeasureClassChange(campaignClassNameOf(v))}
          options={campaignClassCodeComboOptions()}
        />
        <SelectField
          id="add-exp-measure-class-name"
          label="施策区分名称"
          value={form.measureClass}
          onChange={handleMeasureClassChange}
          options={campaignClassComboOptions()}
        />
        <SelectField
          id="add-exp-measure-code"
          label="施策コード"
          value={form.measureCode}
          onChange={handleMeasureCodeChange}
          options={campaignCodeComboOptions(measureCodeList)}
        />
        <SelectField
          id="add-exp-measure-code-name"
          label="施策コード名称"
          value={campaignCodeNameOf(form.measureCode)}
          onChange={(v) => handleMeasureCodeChange(campaignCodeOfName(v))}
          options={campaignCodeNameComboOptions(measureCodeList)}
        />
      </FieldGroup>

      <FieldGroup title="摘要・税区分・請求書情報">
        <InputField
          id="add-exp-summary1"
          label="摘要1（社内用）"
          value={form.summary1}
          onChange={(v) => set('summary1', v)}
        />
        <InputField
          id="add-exp-summary2"
          label="摘要2（社外用）"
          value={form.summary2}
          onChange={(v) => set('summary2', v)}
        />
        {/* 管理区分に紐づく税区分がある明細（1B3＝課税8%:2）は、税区分を非活性にする
            （グリッドの税区分列と同じ → C79）。 */}
        {linkedTaxClassOf(form.mgmtClass) ? (
          <ReadOnlyField
            id="add-exp-tax-class"
            label="税区分"
            value={form.taxClass}
          />
        ) : (
          <SelectField
            id="add-exp-tax-class"
            label="税区分"
            value={form.taxClass}
            onChange={(v) => set('taxClass', v)}
            options={EXPENSE_TAX_CLASS_OPTIONS.map((v) => ({
              value: v,
              label: v,
            }))}
          />
        )}
        {/* 紙の請求書で届いた拡売費を手入力するため、担当者が請求書を見て入力する
            （→ C80。補足1-6 拡売費明細 No.22・23「手入力：明細追加で入力した値」）。 */}
        <InputField
          id="add-exp-bill-no"
          label="請求書番号"
          value={form.billNo ?? ''}
          onChange={(v) => set('billNo', v)}
        />
        <InputField
          id="add-exp-bill-page"
          label="請求書ページ"
          value={form.billPage ?? ''}
          onChange={(v) => set('billPage', v)}
        />
      </FieldGroup>
    </div>
  );
});
