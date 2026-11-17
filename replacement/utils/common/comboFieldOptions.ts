// comboFieldOptions（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import {
  CAMPAIGN_CLASS_CODE,
  CAMPAIGN_CLASS_NAME_BY_CODE,
  CAMPAIGN_CODE_BY_NAME,
  CAMPAIGN_CODE_NAME,
  MANAGEMENT_CLASS_CODE,
  MANAGEMENT_CLASS_NAME_BY_CODE,
  MANAGEMENT_CODE_BY_NAME,
  MANAGEMENT_CODE_NAME,
  PRODUCT_CATEGORY_CODE,
  PROMOTION_CODE,
  SUMMARY_PRODUCT_CODE,
  WHOLESALE_MESH_CODE,
} from '@/constants/comboFieldOptions';
import type { SingleComboboxOption } from '@/components/ui/single-combobox';
import {
  CONTAINER_CAPACITY_MASTER,
  EXPENSE_SUMMARY_PRODUCT_OPTIONS,
  META_BRAND_MASTER,
} from '@/constants/productMasters';
import { expenseSummaryProductOptionCode } from '@/utils/common/summaryProductSearch';
import { joinCodeName } from '@/utils/common/nameCode';

// 一覧に無い商品名（拡売費版や新規行）でも決定的にコードを返すフォールバック。
export const productCodeFromValue = (value: string): string => {
  if (SUMMARY_PRODUCT_CODE[value]) return SUMMARY_PRODUCT_CODE[value];
  const s = String(value ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `P${String((Math.abs(h) % 9000) + 1000).padStart(4, '0')}`;
};

// ── 名称⇄コードの相互変換（拡売費計画グリッドの区分／名称の分割列で使う） ──

// 管理区分の名称（保持値）から区分値を返す。
export function managementClassCodeOf(name: string): string {
  return MANAGEMENT_CLASS_CODE[name] ?? '';
}

// 管理コード（保持値）から名称を返す。
export function managementCodeNameOf(code: string): string {
  return MANAGEMENT_CODE_NAME[code] ?? '';
}

// 施策区分の名称（保持値）から区分値を返す。
export function campaignClassCodeOf(name: string): string {
  return CAMPAIGN_CLASS_CODE[name] ?? '';
}

// 施策コード（保持値）から名称を返す。
export function campaignCodeNameOf(code: string): string {
  return CAMPAIGN_CODE_NAME[code] ?? '';
}

// 管理区分の区分値から名称を返す。
export function managementClassNameOf(classCode: string): string {
  return MANAGEMENT_CLASS_NAME_BY_CODE[classCode] ?? '';
}

// 管理コード名称からコードを返す。
export function managementCodeOfName(name: string): string {
  return MANAGEMENT_CODE_BY_NAME[name] ?? '';
}

// 施策区分の区分値から名称を返す。
export function campaignClassNameOf(classCode: string): string {
  return CAMPAIGN_CLASS_NAME_BY_CODE[classCode] ?? '';
}

// 施策コード名称からコードを返す。
export function campaignCodeOfName(name: string): string {
  return CAMPAIGN_CODE_BY_NAME[name] ?? '';
}

// 支払詳細の拡売費の明細追加ペインのサマリ商品: 名称(上)・「コード／メタブランド：容器容量G」(下)
// 2行目は計画詳細の拡売費追加ペインと同じ体裁（expenseSummaryProductOptionCode）とし、
// 先頭のコードは拡売費一覧のサマリ商品列と同じ商品コードにして、商品コードでも
// 検索できるようにする。未選択（ー（指定なし））はコードを持たない。
// 新商品には NEW バッジを付ける。
export const expenseSummaryProductComboOptions = (): SingleComboboxOption[] =>
  EXPENSE_SUMMARY_PRODUCT_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label ?? option.value,
    code:
      option.value === '-'
        ? undefined
        : expenseSummaryProductOptionCode(
            productCodeFromValue(option.value),
            option.metaBrand,
            option.containerCapacityG
          ),
    badge: option.isNew ? 'NEW' : undefined,
  }));

// メタブランド: 名称(上)・コード(下)（マスタ実値）
export const metaBrandComboOptions = (
  values?: string[]
): SingleComboboxOption[] => {
  const source = values
    ? META_BRAND_MASTER.filter((b) => values.includes(b.value))
    : META_BRAND_MASTER;
  return source.map((b) => ({ value: b.value, label: b.name, code: b.code }));
};

// 容器容量G: 名称(上)・コード(下)（マスタ実値）
export const containerComboOptions = (): SingleComboboxOption[] =>
  CONTAINER_CAPACITY_MASTER.map((c) => ({
    value: c.value,
    label: c.name,
    code: c.code,
  }));

// ── 削除ペイン等の「コード:名称」表示ヘルパー ─────────────────
// 計画詳細の削除確認ペインは、基本情報エリア（joinCodeName）と同じ「コード:名称」表記で揃える。
// 名称が空なら「-」、コードが引けなければ名称のみを返す。
const codeWithName = (code: string, name: string): string => {
  const trimmedName = name.trim();
  if (!trimmedName) return '-';
  return joinCodeName(code.trim(), trimmedName);
};

// サマリ商品名：商品コード:名称。
export const summaryProductCodeName = (value?: string): string =>
  codeWithName(productCodeFromValue(String(value ?? '')), String(value ?? ''));

// メタブランド：コード:名称（マスタ実値）。
export const metaBrandCodeName = (value?: string): string => {
  const name = String(value ?? '');
  const code = META_BRAND_MASTER.find((b) => b.value === name)?.code ?? '';
  return codeWithName(code, name);
};

// 販促区分：販促コード:名称。特殊商品・ギフトは区分名で固定表示（区分名の販促コードを付与）。
export const promotionCodeName = (data: any): string => {
  const category = data?.productCategory ?? '';
  const name =
    category === '特殊商品' || category === 'ギフト'
      ? category
      : String(data?.promotion ?? '').trim();
  return codeWithName(PROMOTION_CODE[name] ?? '', name);
};

// ── 名称からコード値・区分値を引く（計画詳細の明細グリッドのコード列で使う） ──
// PJルール（6/4 共通セッション 決定事項15）：コード値・区分値を持つ項目は、
// 名称とは別の列でコード値・区分値を保持する。いずれもモック用のダミー値。

// メタブランドコード（マスタ実値）
export const metaBrandCodeOf = (name?: string): string =>
  META_BRAND_MASTER.find((b) => b.value === String(name ?? ''))?.code ?? '';

// 容器容量Gコード（マスタ実値）
export const containerCapacityCodeOf = (name?: string): string =>
  CONTAINER_CAPACITY_MASTER.find((c) => c.value === String(name ?? ''))?.code ??
  '';

export const wholesaleMeshCodeOf = (name?: string): string => {
  const s = String(name ?? '').trim();
  if (!s) return '';
  if (WHOLESALE_MESH_CODE[s]) return WHOLESALE_MESH_CODE[s];
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `WM${String((Math.abs(h) % 9000) + 1000).padStart(4, '0')}`;
};

export const productCategoryCodeOf = (category?: string): string =>
  PRODUCT_CATEGORY_CODE[String(category ?? '')] ?? '';

// 販促区分の区分値（特殊商品・ギフトは区分名で固定表示のため、区分名の販促コードを返す）
export const promotionCodeOf = (data: any): string => {
  const category = data?.productCategory ?? '';
  const name =
    category === '特殊商品' || category === 'ギフト'
      ? category
      : String(data?.promotion ?? '').trim();
  return PROMOTION_CODE[name] ?? '';
};
