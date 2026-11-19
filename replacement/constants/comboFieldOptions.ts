// 拡売費・販売計画系のシングル/マルチコンボボックスを「名称＋コード（区分値）」の
// 2行表示にし、どちらの行でも検索ヒットさせるための共通選択肢ビルダー。
//
// SingleCombobox / MultiCombobox は option に `code` があると自動で2行表示になり、
// 検索は label・code・value のいずれにも部分一致する（ui/single-combobox.tsx）。
// 本モジュールは各フィールドの option を `{ value, label, code }` で組み立てる。
//
// ■ データ方針（本プロジェクトはモック）
// マスタに「2行目の値」が無いフィールドは、インデックスから決定的にダミーを生成する。
// ・管理区分 / 施策区分 … 区分値（2桁: 10,20,30…）
// ・勘定科目 … 勘定コード（51010,51020…）
// ・販促区分 … 販促コード（PR001…・ラベル単位で一意）
// ・サマリ商品名 … 商品コード（P0001…・商品名単位で一意）
// ・管理コード … 名称（管理区分とは別物のため区分から導出せず独自ダミー名称）
// ・施策コード … 名称（施策区分とは別物。名称からコードを一意に逆引きするため独自ダミー名称）
// ・メタブランド / 容器容量G … マスタに code/name が実在するためそのまま使用

import type { SingleComboboxOption } from '@/components/ui/single-combobox';
import {
  EXPENSE_MANAGEMENT_CODE_OPTIONS,
  EXPENSE_MANAGEMENT_CLASS_OPTIONS,
  EXPENSE_ACCOUNT_ITEM_OPTIONS,
  EXPENSE_CAMPAIGN_CLASS_OPTIONS,
  EXPENSE_CAMPAIGN_CODE_OPTIONS,
} from './expenseRelations';
import {
  campaignClassCodeOf,
  campaignCodeNameOf,
  managementClassCodeOf,
  managementCodeNameOf,
  productCodeFromValue,
} from '@/utils/common/comboFieldOptions';

import {
  ACCOUNT_ITEM_CODE,
  CAMPAIGN_CLASS_CODE,
  MANAGEMENT_CLASS_CODE,
  MANAGEMENT_CODE_NAME,
  PROMOTION_CODE,
} from './comboFieldCodes';

// ── 2行目テキスト（承認プレビューに合わせ、種別ラベルを前置） ────────
const secondLine = (kind: string, value: string): string =>
  value ? `${kind}: ${value}` : '';

// ── 各フィールドの選択肢ビルダー ─────────────────────────────

// 管理区分名称の列: 名称(上)・管理区分＝区分値(下)
export const managementClassComboOptions = (
  values?: string[]
): SingleComboboxOption[] => {
  const list = values ?? EXPENSE_MANAGEMENT_CLASS_OPTIONS.map((o) => o.value);
  return list.map((value) => ({
    value,
    label: value,
    code: secondLine('管理区分', MANAGEMENT_CLASS_CODE[value] ?? ''),
  }));
};

// 管理コードの列: コード(上)・管理コード名称(下)
export const managementCodeComboOptions = (
  values?: string[]
): SingleComboboxOption[] => {
  const list = values ?? EXPENSE_MANAGEMENT_CODE_OPTIONS.map((o) => o.value);
  return list.map((value) => ({
    value,
    label: value,
    code: secondLine('管理コード名称', MANAGEMENT_CODE_NAME[value] ?? ''),
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

// 施策区分名称の列: 名称(上)・施策区分＝区分値(下)
export const campaignClassComboOptions = (
  values?: string[]
): SingleComboboxOption[] => {
  const list = values ?? EXPENSE_CAMPAIGN_CLASS_OPTIONS.map((o) => o.value);
  return list.map((value) => ({
    value,
    label: value,
    code: secondLine('施策区分', CAMPAIGN_CLASS_CODE[value] ?? ''),
  }));
};

// 施策コードの列: コード(上)・施策コード名称(下)
export const campaignCodeComboOptions = (
  values?: string[]
): SingleComboboxOption[] => {
  const list = values ?? EXPENSE_CAMPAIGN_CODE_OPTIONS.map((o) => o.value);
  return list.map((value) => ({
    value,
    label: value,
    code: secondLine('施策コード名称', campaignCodeNameOf(value)),
  }));
};

// ── 区分値／名称そのものを選択させる列の選択肢（拡売費計画グリッドの8列） ──

// 管理区分の列: 区分値(上)・管理区分名称(下)。値は区分値。
export const managementClassCodeComboOptions = (
  names?: string[]
): SingleComboboxOption[] => {
  const list = names ?? EXPENSE_MANAGEMENT_CLASS_OPTIONS.map((o) => o.value);
  return list.map((name) => ({
    value: managementClassCodeOf(name),
    label: managementClassCodeOf(name),
    code: secondLine('管理区分名称', name),
  }));
};

// 管理コード名称の列: 名称(上)・管理コード(下)。値は名称。
export const managementCodeNameComboOptions = (
  codes?: string[]
): SingleComboboxOption[] => {
  const list = codes ?? EXPENSE_MANAGEMENT_CODE_OPTIONS.map((o) => o.value);
  return list.map((code) => ({
    value: managementCodeNameOf(code),
    label: managementCodeNameOf(code),
    code: secondLine('管理コード', code),
  }));
};

// 施策区分の列: 区分値(上)・施策区分名称(下)。値は区分値。
export const campaignClassCodeComboOptions = (
  names?: string[]
): SingleComboboxOption[] => {
  const list = names ?? EXPENSE_CAMPAIGN_CLASS_OPTIONS.map((o) => o.value);
  return list.map((name) => ({
    value: campaignClassCodeOf(name),
    label: campaignClassCodeOf(name),
    code: secondLine('施策区分名称', name),
  }));
};

// 施策コード名称の列: 名称(上)・施策コード(下)。値は名称。
export const campaignCodeNameComboOptions = (
  codes?: string[]
): SingleComboboxOption[] => {
  const list = codes ?? EXPENSE_CAMPAIGN_CODE_OPTIONS.map((o) => o.value);
  return list.map((code) => ({
    value: campaignCodeNameOf(code),
    label: campaignCodeNameOf(code),
    code: secondLine('施策コード', code),
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

// コードの対応表は comboFieldCodes に置く（ここからも今までどおり読めるよう再 export する）
export {
  MANAGEMENT_CLASS_CODE,
  CAMPAIGN_CLASS_CODE,
  MANAGEMENT_CODE_NAME,
  CAMPAIGN_CODE_NAME,
  MANAGEMENT_CLASS_NAME_BY_CODE,
  MANAGEMENT_CODE_BY_NAME,
  CAMPAIGN_CLASS_NAME_BY_CODE,
  CAMPAIGN_CODE_BY_NAME,
  PROMOTION_CODE,
  SUMMARY_PRODUCT_CODE,
  WHOLESALE_MESH_CODE,
  PRODUCT_CATEGORY_CODE,
} from './comboFieldCodes';
