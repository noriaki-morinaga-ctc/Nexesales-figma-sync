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
  SUMMARY_PRODUCT_VALUES,
  WHOLESALE_MESH_OPTIONS,
} from './productMasters';
import { PROMOTION_LABELS_BY_CATEGORY } from './promotionCategories';
import {
  campaignClassCodeOf,
  campaignCodeNameOf,
  managementClassCodeOf,
  managementCodeNameOf,
  productCodeFromValue,
} from '@/utils/common/comboFieldOptions';

// 2桁ゼロ詰め（区分値: 10,20,30…）
const seq2 = (i: number): string => String((i + 1) * 10).padStart(2, '0');

// ── コード対応マップ（決定的ダミー） ─────────────────────────

// 管理区分 → 区分値（名称が value。区分値は順序で採番）
export const MANAGEMENT_CLASS_CODE: Record<string, string> =
  EXPENSE_MANAGEMENT_CLASS_OPTIONS.reduce(
    (m, o, i) => ((m[o.value] = seq2(i)), m),
    {} as Record<string, string>
  );

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
export const CAMPAIGN_CLASS_CODE: Record<string, string> =
  EXPENSE_CAMPAIGN_CLASS_OPTIONS.reduce(
    (m, o, i) => ((m[o.value] = seq2(i)), m),
    {} as Record<string, string>
  );

// 管理コード → 名称（管理区分とは別物。独自のダミー名称を割り当てる）
export const MANAGEMENT_CODE_NAME: Record<string, string> = {
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
  LC001: 'ロケーション補填',
  LC002: 'ロケ設置協力金',
  CL001: 'コラム使用料',
  LS001: '自販機リース料',
  EQ001: '販売器具購入費',
};

// 施策コード → 名称（施策区分とは別物。コードごとに一意のダミー名称を割り当てる）。
// 名称からコードを一意に逆引きできる必要があるため、区分名の流用はしない。
export const CAMPAIGN_CODE_NAME: Record<string, string> = {
  SN001: '新商品導入キャンペーン',
  SN002: '新規棚獲得施策',
  SN003: '新商品Web告知',
  SN004: '新商品サンプリング',
  SP001: '店頭値引き支援',
  SP002: 'TV-CM連動施策',
  SP003: '雑誌タイアップ施策',
  SS001: 'スポット協賛A',
  SS002: 'スポットサンプリング',
  SS003: 'スポットイベント',
  SR001: 'リピート購入特典',
  SR002: 'リピート展示会',
  SR003: 'リピート販促物',
};

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

// ── 逆引き（コード／名称セルで選択した値から、行が保持する値へ戻す） ──

const invert = (map: Record<string, string>): Record<string, string> =>
  Object.entries(map).reduce(
    (m, [k, v]) => (v ? ((m[v] = k), m) : m),
    {} as Record<string, string>
  );

export const MANAGEMENT_CLASS_NAME_BY_CODE = invert(MANAGEMENT_CLASS_CODE);
export const MANAGEMENT_CODE_BY_NAME = invert(MANAGEMENT_CODE_NAME);
export const CAMPAIGN_CLASS_NAME_BY_CODE = invert(CAMPAIGN_CLASS_CODE);
export const CAMPAIGN_CODE_BY_NAME = invert(CAMPAIGN_CODE_NAME);

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

// 商品コード参照（年間計画の新商品リスト等、value=コードで持つ画面向け）
export { PROMOTION_CODE, SUMMARY_PRODUCT_CODE };

// 一般卸メッシュコード（一覧順に WM0001 から採番。一覧に無い名称は決定的に採番）
export const WHOLESALE_MESH_CODE: Record<string, string> =
  WHOLESALE_MESH_OPTIONS.reduce(
    (m, o, i) => ((m[o.value] = `WM${String(i + 1).padStart(4, '0')}`), m),
    {} as Record<string, string>
  );
// 商品区分の区分値
export const PRODUCT_CATEGORY_CODE: Record<string, string> = {
  定番商品: '01',
  新商品: '02',
  特売: '03',
  特殊商品: '04',
  ギフト: '05',
};
