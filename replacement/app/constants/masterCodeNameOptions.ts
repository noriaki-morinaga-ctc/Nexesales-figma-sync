// マスタメンテ画面（型1）で共通に使う「コード・名称」の候補（モック）。
// 既存のモックマスタ（productMasters／storeHierarchy）と下記の採算組織の対応を唯一の情報源にし、
// 各マスタ画面で同じコード体系を使う（例：サマリ商品コードは一般卸メッシュ・戦略NET・管理対象商品で共通）。

import {
  CONTAINER_CAPACITY_MASTER,
  META_BRAND_MASTER,
  SUMMARY_PRODUCT_OPTIONS,
  WHOLESALE_MESH_BY_VALUE,
} from './productMasters';
import { wholesaleMeshCodeOf } from './comboFieldOptions';
import { STORE_HIERARCHY } from './storeHierarchy';

export interface CodeNameOption {
  code: string;
  name: string;
}

// 「名称:コード」（storeHierarchy の表記）→ { code, name }
const fromNameCode = (value: string): CodeNameOption => {
  const at = value.lastIndexOf(':');
  return { code: value.slice(at + 1), name: value.slice(0, at) };
};
// 「コード:名称」（draftingOrgCascade の表記）→ { code, name }
const fromCodeName = (value: string): CodeNameOption => {
  const at = value.indexOf(':');
  return { code: value.slice(0, at), name: value.slice(at + 1) };
};
const uniqueByCode = (options: CodeNameOption[]): CodeNameOption[] => {
  const seen = new Set<string>();
  return options.filter((o) =>
    seen.has(o.code) ? false : (seen.add(o.code), true)
  );
};

/** メタブランド */
export const META_BRAND_CODE_NAME: CodeNameOption[] = META_BRAND_MASTER.map(
  (b) => ({ code: b.code, name: b.name })
);

// 容器容量Ｇコードは現行どおり数字2桁（Q&A No.36。新ドメインの確定待ち）。
// 業務画面のモック（productMasters）は CG 始まりのコードのため、マスタ画面では並び順で 01〜 に読み替える。
const CONTAINER_GROUP_CODE_BY_MASTER_CODE = new Map<string, string>(
  CONTAINER_CAPACITY_MASTER.map((c, i) => [
    c.code,
    String(i + 1).padStart(2, '0'),
  ])
);

/** 容器容量グループ（コード＝01〜） */
export const CONTAINER_GROUP_CODE_NAME: CodeNameOption[] =
  CONTAINER_CAPACITY_MASTER.map((c) => ({
    code: CONTAINER_GROUP_CODE_BY_MASTER_CODE.get(c.code) ?? c.code,
    name: c.name,
  }));

/** 業務画面モックの容器容量Gコード（CG…）→ マスタ画面の容器容量Ｇコード（2桁） */
export const containerGroupCodeOf = (masterCode: string): string =>
  CONTAINER_GROUP_CODE_BY_MASTER_CODE.get(masterCode) ?? '';

/** 容器容量（容器容量グループの代表容器容量の候補。モックでは容器容量Gと同じ粒度で CC コードを振る） */
export const CONTAINER_CAPACITY_CODE_NAME: CodeNameOption[] =
  CONTAINER_CAPACITY_MASTER.map((c, i) => ({
    code: `CC${String(i + 1).padStart(3, '0')}`,
    name: c.name,
  }));

// サマリ商品コードはマスタに実値が無いため、一覧順に P0001 から決定的に採番する（モック）。
// 新商品コード対応のダミーのサマリ商品は含めない（代表サマリ商品・戦略NETには設定しない：10/8 決定9・14）。
const SUMMARY_PRODUCT_CODE_BY_VALUE = new Map<string, string>();
SUMMARY_PRODUCT_OPTIONS.forEach((p) => {
  if (!SUMMARY_PRODUCT_CODE_BY_VALUE.has(p.value)) {
    SUMMARY_PRODUCT_CODE_BY_VALUE.set(
      p.value,
      `P${String(SUMMARY_PRODUCT_CODE_BY_VALUE.size + 1).padStart(4, '0')}`
    );
  }
});

/** サマリ商品（コード＝P0001〜、名称＝サマリ商品名） */
export const SUMMARY_PRODUCT_CODE_NAME: CodeNameOption[] = Array.from(
  SUMMARY_PRODUCT_CODE_BY_VALUE.entries()
).map(([name, code]) => ({ code, name }));

/** ダミーのサマリ商品か（コード先頭が「D」。判定は暫定で、新商品・新価格用サマリ商品の設計で変わり得る。Q&A No.31） */
export const isDummySummaryProductCode = (code: string): boolean =>
  code.startsWith('D');

/** ダミーを除いたサマリ商品（一般卸メッシュの代表サマリ商品・戦略NETのサマリ商品の候補。10/8 決定9・14） */
export const SUMMARY_PRODUCT_CODE_NAME_NO_DUMMY: CodeNameOption[] =
  SUMMARY_PRODUCT_CODE_NAME.filter((o) => !isDummySummaryProductCode(o.code));

/** サマリ商品名 → サマリ商品コード */
export const summaryProductCodeOf = (name?: string): string =>
  SUMMARY_PRODUCT_CODE_BY_VALUE.get(String(name ?? '')) ?? '';

/** 一般卸メッシュ（コード＝WM0001〜、名称＝メッシュ名） */
export const WHOLESALE_MESH_CODE_NAME: CodeNameOption[] = Array.from(
  WHOLESALE_MESH_BY_VALUE.keys()
).map((name) => ({ code: wholesaleMeshCodeOf(name), name }));

/** 商流（一次店・三次店・販売店）の組合せ。個別NET等のモック行を起こすときに使う */
export const STORE_CHAIN_COMBOS: {
  primary: CodeNameOption;
  tertiary: CodeNameOption;
  retailer: CodeNameOption;
}[] = STORE_HIERARCHY.flatMap((p) =>
  p.tertiaries.flatMap((t) =>
    t.stores.map((s) => ({
      primary: fromNameCode(p.primary),
      tertiary: fromNameCode(t.tertiary),
      retailer: fromNameCode(s),
    }))
  )
);

/** 一次店 */
export const PRIMARY_STORE_CODE_NAME: CodeNameOption[] = uniqueByCode(
  STORE_CHAIN_COMBOS.map((c) => c.primary)
);
/** 三次店 */
export const TERTIARY_STORE_CODE_NAME: CodeNameOption[] = uniqueByCode(
  STORE_CHAIN_COMBOS.map((c) => c.tertiary)
);
/** 販売店 */
export const RETAILER_CODE_NAME: CodeNameOption[] = uniqueByCode(
  STORE_CHAIN_COMBOS.map((c) => c.retailer)
);

// 採算組織：事業場（第4階層）→ 部署（第5階層）。「コード:名称」表記。
// 旧 draftingOrgCascade.ts（main で 10/28 に削除）の定義をそのまま持ってきた。
// 確認：検索条件の連動用 orgHierarchy.ts（事業場・部署のコードが別体系）との統一は未。
const DEPTS_BY_OFFICE: Record<string, string[]> = {
  '10000621:北海道支社': ['10003041:北海道営業部'],
  '10000622:東北支社': ['10003056:東北営業部'],
  '10000623:首都圏本部': [
    '10002985:首都圏営業第一部',
    '10002990:首都圏営業第二部',
  ],
  '10000624:中部北陸本部': ['10003002:中部営業部'],
  '10000625:近畿圏本部': ['10003015:近畿営業部', '10003001:関西第1営業部'],
  '10000626:中四国支社': ['10003025:中四国営業部'],
  '10000627:九州支社': ['10003030:九州営業部'],
  '10000628:本社': ['10000175:本社広域量販営業部'],
};

/** 採算組織：事業場（第4階層） */
export const OFFICE_CODE_NAME: CodeNameOption[] =
  Object.keys(DEPTS_BY_OFFICE).map(fromCodeName);

/** 採算組織：部署（第5階層）。戦略NETの管理単位 */
export const PROFIT_ORG_DEPT_CODE_NAME: CodeNameOption[] = Object.values(
  DEPTS_BY_OFFICE
)
  .flat()
  .map(fromCodeName);

/** 部署コード → 事業場コード（事業場 → 部署の絞り込みに使う） */
export const OFFICE_CODE_BY_DEPT_CODE: Record<string, string> =
  Object.fromEntries(
    Object.entries(DEPTS_BY_OFFICE).flatMap(([office, depts]) =>
      depts.map((d) => [fromCodeName(d).code, fromCodeName(office).code])
    )
  );

/** 商品取り扱い区分（管理対象商品。区分値は仮） */
export const PRODUCT_HANDLING_KBN: CodeNameOption[] = [
  { code: '01', name: '新商品' },
  { code: '02', name: '重点商品' },
  { code: '03', name: '自販機専用商品' },
];

/** 管理対象エリア（全国＋事業場。コードは仮） */
export const TARGET_AREA_CODE_NAME: CodeNameOption[] = [
  { code: '00', name: '全国' },
  ...OFFICE_CODE_NAME,
];

/** 共通会社コード */
export const COMPANY_CODE_NAME: CodeNameOption[] = [
  { code: '0093', name: 'アサヒ飲料' },
  { code: '0001', name: 'アサヒビール' },
  { code: '0120', name: 'アサヒ飲料販売（APM）' },
];

// ── 第2陣（通知管理・権限系・表示管理・商品分類導出・担当エリア・新商品系）で使う候補（2026-10-23 追加） ──

/** 採算組織（事業場＋部署。表示管理・役職承認者設定の採算組織の候補） */
export const PROFIT_ORG_CODE_NAME: CodeNameOption[] = uniqueByCode([
  ...OFFICE_CODE_NAME,
  ...PROFIT_ORG_DEPT_CODE_NAME,
]);

/** 社員（モック。実在しない） */
export const STAFF_CODE_NAME: CodeNameOption[] = [
  { code: '1000101', name: '営戦 花子' },
  { code: '1000102', name: '営戦 太郎' },
  { code: '1000103', name: '営戦 次郎' },
  { code: '1000104', name: '営戦 三郎' },
  { code: '1000105', name: '営戦 四郎' },
  { code: '1000106', name: '営戦 五月' },
  { code: '1000107', name: '営戦 六実' },
  { code: '1000108', name: '営戦 七海' },
];

/** 役職（人事の役職コード。コード・名称は仮） */
export const POSITION_CODE_NAME: CodeNameOption[] = [
  { code: '0100', name: '本部長' },
  { code: '0200', name: '部長' },
  { code: '0300', name: '部支店長' },
  { code: '0400', name: 'グループリーダー' },
  { code: '0500', name: 'チームリーダー' },
  { code: '0600', name: '担当' },
];

/** ブランド（コードは現行のブランドコード体系に合わせた仮の値。メタブランドは META_BRAND_MASTER のコード） */
const BRAND_MASTER: { code: string; name: string; metaBrand: string }[] = [
  { code: '2B100', name: 'ワンダ', metaBrand: 'MB007' },
  { code: '2B200', name: '三ツ矢', metaBrand: 'MB002' },
  { code: '2B300', name: 'ウィルキンソン', metaBrand: 'MB004' },
  { code: '2B400', name: '十六茶', metaBrand: 'MB005' },
  { code: '2B500', name: 'おいしい水', metaBrand: 'MB008' },
  { code: '2B600', name: 'カルピス', metaBrand: 'MB003' },
  { code: '2B700', name: 'バヤリース', metaBrand: 'MB009' },
  { code: '2B800', name: 'モンスター', metaBrand: 'MB006' },
  { code: '2B900', name: 'ドデカミン', metaBrand: 'MB010' },
];
export const BRAND_CODE_NAME: CodeNameOption[] = BRAND_MASTER.map((b) => ({
  code: b.code,
  name: b.name,
}));
/** ブランドコード → メタブランドコード（メタブランド → ブランドの絞り込みに使う） */
export const META_BRAND_CODE_BY_BRAND_CODE: Record<string, string> =
  Object.fromEntries(BRAND_MASTER.map((b) => [b.code, b.metaBrand]));

/** 小ブランド（コードは現行の小ブランドコード体系に合わせた仮の値） */
const SUB_BRAND_MASTER: { code: string; name: string; brand: string }[] = [
  { code: '230000', name: 'モーニングショット', brand: '2B100' },
  { code: '230100', name: 'ブラック', brand: '2B100' },
  { code: '230200', name: 'カフェオレ', brand: '2B100' },
  { code: '230400', name: '金の微糖', brand: '2B100' },
  { code: '210000', name: '三ツ矢サイダー', brand: '2B200' },
  { code: '210200', name: '三ツ矢サイダーゼロ', brand: '2B200' },
  { code: '220000', name: 'ウィルキンソン タンサン', brand: '2B300' },
  { code: '220100', name: 'ウィルキンソン ジンジャエール', brand: '2B300' },
  { code: '240000', name: '十六茶', brand: '2B400' },
  { code: '250000', name: 'おいしい水 天然水', brand: '2B500' },
  { code: '260000', name: 'カルピスウォーター', brand: '2B600' },
  { code: '260100', name: 'カルピスソーダ', brand: '2B600' },
];
export const SUB_BRAND_CODE_NAME: CodeNameOption[] = SUB_BRAND_MASTER.map(
  (b) => ({ code: b.code, name: b.name })
);
/** 小ブランドコード → ブランドコード（ブランド → 小ブランドの絞り込みに使う） */
export const BRAND_CODE_BY_SUB_BRAND_CODE: Record<string, string> =
  Object.fromEntries(SUB_BRAND_MASTER.map((b) => [b.code, b.brand]));

/** 商品分類③（コードは仮。名称はアサヒ整理の商品分類マスタ【26.8.6ver】と商流分岐一覧） */
export const PRODUCT_CLASS_CODE_NAME: CodeNameOption[] = [
  { code: '01', name: 'AS/通常品' },
  { code: '02', name: 'AS/PB' },
  { code: '03', name: 'AS/モンスター' },
  { code: '04', name: 'AS/リタ瓶' },
  { code: '05', name: 'AS/ウィルキンソン缶190' },
  { code: '06', name: 'AS/ウィルキンソン（缶190・リタ瓶以外）' },
  { code: '07', name: 'AS/提携品' },
  { code: '08', name: 'AS/ヘルスケア' },
  { code: '09', name: 'AS/ギフト' },
  { code: '10', name: 'AS/コンク（家庭用）' },
  { code: '11', name: 'CA/通常品' },
  { code: '12', name: 'CA/PB' },
  { code: '13', name: 'CA/ギフト' },
  { code: '14', name: 'CA/ヘルスケア' },
  { code: '15', name: 'CA/Lパック' },
  { code: '16', name: 'CA/コンク' },
];

/** 販売アイテム（オンライン商品。正式コードとダミーコードのモック） */
export const SALES_ITEM_CODE_NAME: CodeNameOption[] = [
  { code: '00410147', name: '三ツ矢サイダー PET1.5L' },
  { code: '00410187', name: '三ツ矢サイダー 缶250ml×20本入り' },
  { code: '00410200', name: '三ツ矢サイダー PET500' },
  { code: '00420100', name: 'カルピスウォーター PET500' },
  { code: '00430100', name: 'ワンダ モーニングショット 缶185g' },
  { code: '00440100', name: '十六茶 PET600' },
  { code: '99999901', name: 'グリーンコーラ PET500（ダミー）' },
  { code: '99999902', name: 'グリーンコーラ 缶350（ダミー）' },
];

/** ダミーのサマリ商品（新商品コード対応で主管部が登録するもの。コード先頭「D」） */
export const SUMMARY_PRODUCT_CODE_NAME_DUMMY: CodeNameOption[] = [
  { code: 'D0001', name: 'グリーンコーラPET500（ダミー）' },
  { code: 'D0002', name: 'グリーンコーラ缶350（ダミー）' },
  { code: 'D0003', name: '新商品ティーPET600（ダミー）' },
];

/** ダミーを含むサマリ商品（新商品用のマスタの候補） */
export const SUMMARY_PRODUCT_CODE_NAME_WITH_DUMMY: CodeNameOption[] = [
  ...SUMMARY_PRODUCT_CODE_NAME_NO_DUMMY,
  ...SUMMARY_PRODUCT_CODE_NAME_DUMMY,
];

// ── 商品分類導出マスタ（2026-10-26 更新）：判断軸の候補。アサヒ整理の商品分類マスタ【26.8.6ver】に合わせる ──
// 「（指定なし）」は判断軸のどの値にも当てはまる（ルールの any）。保持の仕方は確認中のためモックではコード「*」
/** 判断軸の「指定なし」 */
export const RULE_WILDCARD_OPTION: CodeNameOption = {
  code: '*',
  name: '（指定なし）',
};

/** メタブランド（現行コード＋ToBe 案だけの区分は仮コード T〜） */
export const DERIVATION_META_BRAND_CODE_NAME: CodeNameOption[] = [
  RULE_WILDCARD_OPTION,
  { code: '2B10', name: 'ワンダ' },
  { code: '2B20', name: '三ツ矢' },
  { code: '2B30', name: 'ウイルキンソン' },
  { code: '2B40', name: '十六茶' },
  { code: '2B50', name: '水' },
  { code: '2B60', name: 'カルピスコンク' },
  { code: '2B65', name: 'カルピスストレート' },
  { code: '2B71', name: 'モンスター' },
  { code: '2B80', name: 'ヘルスケア' },
  { code: '2B85', name: 'ＰＢ' },
  { code: '2S10', name: 'その他' },
  { code: '2S12', name: '和紅茶' },
  { code: '2S13', name: '颯' },
  { code: 'T01', name: 'ドデカミン' },
  { code: 'T02', name: 'バヤリース' },
  { code: 'T03', name: 'PB(AS)' },
  { code: 'T04', name: 'PB(CA)' },
  { code: 'T05', name: 'その他(AS)' },
  { code: 'T06', name: 'その他(CA)' },
  { code: 'T07', name: 'ぐんぐんグルト' },
  { code: 'T08', name: 'ウェルチ' },
  { code: 'T09', name: 'ギフト' },
];

/** ブランド（判断軸に出てくるものと代表的なもの。コードは現行） */
export const DERIVATION_BRAND_CODE_NAME: CodeNameOption[] = [
  RULE_WILDCARD_OPTION,
  { code: '2S180', name: '提携品' },
  { code: '2B300', name: 'ウイルキンソン' },
  { code: '2S030', name: 'ウェルチ' },
  { code: '2S150', name: 'ぐんぐんグルト' },
  { code: '2B700', name: 'ギフト' },
  { code: '2S110', name: 'モンスター' },
  { code: '2B600', name: 'カルピスコンク' },
  { code: '2B610', name: 'カルピスストレート' },
  { code: '2S510', name: 'その他炭酸（ＰＢ）' },
  { code: '2S520', name: 'その他日本茶（ＰＢ）' },
];

/** 容器容量（指定なし＋モックの容器容量） */
export const DERIVATION_CONTAINER_CAPACITY_CODE_NAME: CodeNameOption[] = [
  RULE_WILDCARD_OPTION,
  ...CONTAINER_CAPACITY_CODE_NAME,
];

/** 容器容量グループ（現行コード＋ToBe 案だけの区分は仮コード T〜） */
export const DERIVATION_CONTAINER_GROUP_CODE_NAME: CodeNameOption[] = [
  RULE_WILDCARD_OPTION,
  { code: '01', name: 'ＰＥＴ・ボトル缶２８０・３５０' },
  { code: '02', name: 'ＰＥＴ・ボトル缶５００' },
  { code: '04', name: 'ＰＥＴ１．５' },
  { code: '06', name: 'ＰＥＴ２Ｌ' },
  { code: '08', name: 'コーヒー缶' },
  { code: '09', name: '２５０缶' },
  { code: '15', name: 'その他' },
  { code: '21', name: 'Lパック' },
  { code: '22', name: 'ギフト' },
  { code: '41', name: 'コンクプラボトル' },
  { code: '42', name: 'リタ瓶' },
  { code: 'T01', name: '缶150-190' },
];
