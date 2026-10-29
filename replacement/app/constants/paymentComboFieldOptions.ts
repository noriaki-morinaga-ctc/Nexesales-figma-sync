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
// ・施策コード … 名称（所属する施策区分名を導出して使用）
// ・メタブランド / 容器容量G … マスタに code/name が実在するためそのまま使用

import type { SingleComboboxOption } from '../components/ui/single-combobox';
import {
  EXPENSE_MANAGEMENT_CODE_OPTIONS,
  EXPENSE_MANAGEMENT_CLASS_OPTIONS,
  EXPENSE_ACCOUNT_ITEM_OPTIONS,
  EXPENSE_CAMPAIGN_CLASS_OPTIONS,
  EXPENSE_CAMPAIGN_CODE_OPTIONS,
  campaignClassFromCode,
} from './expenseRelations';
import {
  META_BRAND_MASTER,
  CONTAINER_CAPACITY_MASTER,
  SUMMARY_PRODUCT_VALUES,
} from './productMasters';
import { PROMOTION_LABELS_BY_CATEGORY } from './promotionCategories';

// 2桁ゼロ詰め（区分値: 10,20,30…）
const seq2 = (i: number): string => String((i + 1) * 10).padStart(2, '0');

// ── コード対応マップ（決定的ダミー） ─────────────────────────

// 管理区分 → 区分値（名称が value。区分値は順序で採番）
const MANAGEMENT_CLASS_CODE: Record<string, string> =
  EXPENSE_MANAGEMENT_CLASS_OPTIONS.reduce(
    (m, o, i) => ((m[o.value] = seq2(i)), m),
    {} as Record<string, string>
  );

// 管理区分名称 → 区分値コード（表示用。名称→コードの導出）
export const managementClassCode = (className: string): string =>
  MANAGEMENT_CLASS_CODE[className] ?? '';

// 勘定科目 → 勘定コード（51010 から +10）
// グリッド側のローカルリストには canonical 定数に無い「イベント費／その他」も
// 含まれるため、それらも採番に含める（2行目のコードが空にならないように）。
const ACCOUNT_ITEM_NAMES: string[] = Array.from(
  new Set([
    ...EXPENSE_ACCOUNT_ITEM_OPTIONS.map((o) => o.value),
    'イベント費',
    'その他',
  ])
);
const ACCOUNT_ITEM_CODE: Record<string, string> = ACCOUNT_ITEM_NAMES.reduce(
  (m, name, i) => ((m[name] = String(51010 + i * 10)), m),
  {} as Record<string, string>
);

// 施策区分 → 区分値
const CAMPAIGN_CLASS_CODE: Record<string, string> =
  EXPENSE_CAMPAIGN_CLASS_OPTIONS.reduce(
    (m, o, i) => ((m[o.value] = seq2(i)), m),
    {} as Record<string, string>
  );

// 施策区分名称 → 区分値コード（表示用。名称→コードの導出）
export const campaignClassCode = (className: string): string =>
  CAMPAIGN_CLASS_CODE[className] ?? '';

// 管理コード → 名称（管理区分とは別物。独自のダミー名称を割り当てる）
const MANAGEMENT_CODE_NAME: Record<string, string> = {
  RA001: '店頭定番販促',
  RA002: 'チラシ協賛A',
  RB001: '新規導入販促',
  RB002: 'エンド展開A',
  RH001: '本社一括販促',
  RH002: '全国施策A',
  FA001: '什器設置費',
  FA002: 'クーラー什器費',
  FB001: '看板広告費',
  FB002: 'デジタル広告費',
  FH001: '本社広告枠',
  FH002: '全国広告費',
};

// 管理コード → 名称（表示用。コード→ダミー名称の導出）
export const managementCodeName = (code: string): string =>
  MANAGEMENT_CODE_NAME[code] ?? '';

// 販促区分（ラベル）→ 販促コード（全カテゴリ横断で一意採番。同一ラベルは同一コード）
const PROMOTION_CODE: Record<string, string> = (() => {
  const seen: string[] = [];
  Object.values(PROMOTION_LABELS_BY_CATEGORY).forEach((labels) =>
    labels.forEach((l) => {
      if (!seen.includes(l)) seen.push(l);
    })
  );
  return seen.reduce(
    (m, label, i) => ((m[label] = `PR${String(i + 1).padStart(3, '0')}`), m),
    {} as Record<string, string>
  );
})();

// サマリ商品名（value）→ 商品コード（P0001 から。商品名単位で一意）
const SUMMARY_PRODUCT_CODE: Record<string, string> =
  SUMMARY_PRODUCT_VALUES.reduce(
    (m, value, i) => ((m[value] = `P${String(i + 1).padStart(4, '0')}`), m),
    {} as Record<string, string>
  );

// 一覧に無い商品名（拡売費版や新規行）でも決定的にコードを返すフォールバック。
const productCodeFromValue = (value: string): string => {
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

// 商品コード参照（年間計画の新商品リスト等、value=コードで持つ画面向け）
export { productCodeFromValue, PROMOTION_CODE, SUMMARY_PRODUCT_CODE };
