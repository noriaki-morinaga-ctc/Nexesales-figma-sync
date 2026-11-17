// paymentComboFieldOptions（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import {
  ACCOUNT_ITEM_CODE,
  CAMPAIGN_CLASS_CODE,
  MANAGEMENT_CLASS_CODE,
  MANAGEMENT_CODE_NAME,
  PROMOTION_CODE,
  SUMMARY_PRODUCT_CODE,
} from '@/constants/paymentComboFieldOptions';
import type { SingleComboboxOption } from '@/components/ui/single-combobox';
import {
  EXPENSE_ACCOUNT_ITEM_OPTIONS,
  EXPENSE_CAMPAIGN_CLASS_OPTIONS,
  EXPENSE_CAMPAIGN_CODE_OPTIONS,
  EXPENSE_MANAGEMENT_CLASS_OPTIONS,
  EXPENSE_MANAGEMENT_CODE_OPTIONS,
} from '@/constants/expenseRelations';
import { campaignClassFromCode } from '@/utils/common/expenseRelations';
import { CONTAINER_CAPACITY_MASTER } from '@/constants/productMasters';

// 管理区分名称 → 区分値コード（表示用。名称→コードの導出）
export const managementClassCode = (className: string): string =>
  MANAGEMENT_CLASS_CODE[className] ?? '';

// 施策区分名称 → 区分値コード（表示用。名称→コードの導出）
export const campaignClassCode = (className: string): string =>
  CAMPAIGN_CLASS_CODE[className] ?? '';

// 管理コード → 名称（表示用。コード→ダミー名称の導出）
export const managementCodeName = (code: string): string =>
  MANAGEMENT_CODE_NAME[code] ?? '';

// 一覧に無い商品名（拡売費版や新規行）でも決定的にコードを返すフォールバック。
export const productCodeFromValue = (value: string): string => {
  if (SUMMARY_PRODUCT_CODE[value]) return SUMMARY_PRODUCT_CODE[value];
  const s = String(value ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `P${String((Math.abs(h) % 9000) + 1000).padStart(4, '0')}`;
};

// ── 2行目テキスト（承認プレビューに合わせ、種別ラベルを前置） ────────
const secondLine = (kind: string, value: string): string =>
  value ? `${kind}: ${value}` : '';

// ── 各フィールドの選択肢ビルダー ─────────────────────────────

// 管理区分: 名称(上)・区分値(下)
export const managementClassComboOptions = (
  values?: string[]
): SingleComboboxOption[] => {
  const list = values ?? EXPENSE_MANAGEMENT_CLASS_OPTIONS.map((o) => o.value);
  return list.map((value) => ({
    value,
    label: value,
    code: secondLine('区分値', MANAGEMENT_CLASS_CODE[value] ?? ''),
  }));
};

// 管理コード: コード(上)・名称(下)
export const managementCodeComboOptions = (
  values?: string[]
): SingleComboboxOption[] => {
  const list = values ?? EXPENSE_MANAGEMENT_CODE_OPTIONS.map((o) => o.value);
  return list.map((value) => ({
    value,
    label: value,
    code: secondLine('名称', MANAGEMENT_CODE_NAME[value] ?? ''),
  }));
};

// 勘定科目: 名称(上)・コード(下)
export const accountItemComboOptions = (
  values?: string[]
): SingleComboboxOption[] => {
  const list = values ?? EXPENSE_ACCOUNT_ITEM_OPTIONS.map((o) => o.value);
  return list.map((value) => ({
    value,
    label: value,
    code: secondLine('コード', ACCOUNT_ITEM_CODE[value] ?? ''),
  }));
};

// 施策区分: 名称(上)・区分値(下)
export const campaignClassComboOptions = (
  values?: string[]
): SingleComboboxOption[] => {
  const list = values ?? EXPENSE_CAMPAIGN_CLASS_OPTIONS.map((o) => o.value);
  return list.map((value) => ({
    value,
    label: value,
    code: secondLine('区分値', CAMPAIGN_CLASS_CODE[value] ?? ''),
  }));
};

// 施策コード: コード(上)・名称(下)＝所属する施策区分名を導出
export const campaignCodeComboOptions = (
  values?: string[]
): SingleComboboxOption[] => {
  const list = values ?? EXPENSE_CAMPAIGN_CODE_OPTIONS.map((o) => o.value);
  return list.map((value) => ({
    value,
    label: value,
    code: secondLine('名称', campaignClassFromCode(value)),
  }));
};

// 販促区分: 名称(上)・コード(下)
export const promotionComboOptions = (
  labels: string[]
): SingleComboboxOption[] =>
  labels.map((value) => ({
    value,
    label: value,
    code: secondLine('コード', PROMOTION_CODE[value] ?? ''),
  }));

// サマリ商品名: 名称(上)・商品コード(下)
export const summaryProductComboOptions = (
  values: string[]
): SingleComboboxOption[] =>
  values.map((value) => ({
    value,
    label: value,
    code: secondLine('商品コード', productCodeFromValue(value)),
  }));

// 容器容量G: 名称(上)・コード(下)（マスタ実値）
export const containerComboOptions = (): SingleComboboxOption[] =>
  CONTAINER_CAPACITY_MASTER.map((c) => ({
    value: c.value,
    label: c.name,
    code: c.code,
  }));
