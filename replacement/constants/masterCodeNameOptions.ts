// マスタメンテ画面（型1）で共通に使う「コード・名称」の候補（モック）。
// 既存のモックマスタ（productMasters／storeHierarchy）と下記の採算組織の対応を唯一の情報源にし、
// 各マスタ画面で同じコード体系を使う（例：サマリ商品コードは一般卸メッシュ・戦略NET・管理対象商品で共通）。

import {
  CONTAINER_CAPACITY_MASTER,
  META_BRAND_MASTER,
  SUMMARY_PRODUCT_OPTIONS,
  WHOLESALE_MESH_BY_VALUE,
} from './productMasters';
import { wholesaleMeshCodeOf } from '@/utils/common/comboFieldOptions';
import { STORE_HIERARCHY } from './storeHierarchy';
import type { CodeNameOption } from '@/types/master';
import { isDummySummaryProductCode } from '@/utils/common/summaryProductCode';

// 「コード:名称」（storeHierarchy・draftingOrgCascade の表記）→ { code, name }
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
export const CONTAINER_GROUP_CODE_BY_MASTER_CODE = new Map<string, string>(
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

/** 容器容量（容器容量グループの代表容器容量の候補。モックでは容器容量Gと同じ粒度で CC コードを振る） */
export const CONTAINER_CAPACITY_CODE_NAME: CodeNameOption[] =
  CONTAINER_CAPACITY_MASTER.map((c, i) => ({
    code: `CC${String(i + 1).padStart(3, '0')}`,
    name: c.name,
  }));

// サマリ商品コードはマスタに実値が無いため、一覧順に P0001 から決定的に採番する（モック）。
// 新商品コード対応のダミーのサマリ商品は含めない（代表サマリ商品・戦略NETには設定しない：10/8 決定9・14）。
export const SUMMARY_PRODUCT_CODE_BY_VALUE = new Map<string, string>();
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

/** ダミーを除いたサマリ商品（一般卸メッシュの代表サマリ商品・戦略NETのサマリ商品の候補。10/8 決定9・14） */
export const SUMMARY_PRODUCT_CODE_NAME_NO_DUMMY: CodeNameOption[] =
  SUMMARY_PRODUCT_CODE_NAME.filter((o) => !isDummySummaryProductCode(o.code));

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
      primary: fromCodeName(p.primary),
      tertiary: fromCodeName(t.tertiary),
      retailer: fromCodeName(s),
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

/** 社員コード → 所属する部署（採算組織の第5階層）のコード。事業場→部署→社員の絞り込みに使う（モック。Q&A QM-032） */
export const DEPT_CODE_BY_STAFF_CODE: Record<string, string> =
  Object.fromEntries(
    STAFF_CODE_NAME.map((s, i) => [
      s.code,
      PROFIT_ORG_DEPT_CODE_NAME[i % 4]?.code ?? '',
    ])
  );

/**
 * 役職（人事の役職コード＝社員マスタの社員共通役職コード、半角 3 桁。コード・名称は仮）。
 * 名称は汎用コード値明細マスタの区分「役職コード」（KBN-028）から取る（Q&A QM-037）
 */
export const POSITION_CODE_NAME: CodeNameOption[] = [
  { code: '100', name: '本部長' },
  { code: '200', name: '部長' },
  { code: '300', name: '部支店長' },
  { code: '400', name: 'グループリーダー' },
  { code: '500', name: 'チームリーダー' },
  { code: '600', name: '担当' },
];

/** 役職区分（役職区分マスタ。承認権限の単位。区分値は未定義のため仮） */
export const POSITION_CLASS_CODE_NAME: CodeNameOption[] = [
  { code: '01', name: '本部長' },
  { code: '02', name: '部長' },
  { code: '03', name: '部支店長' },
  { code: '04', name: 'グループリーダー・チームリーダー' },
  { code: '05', name: '担当' },
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

// ── 商品分類導出マスタ（2026-10-26 作成、10-30 更新）：判断軸の候補。アサヒ整理の商品分類マスタ【26.8.6ver】に合わせる ──
// 判断軸の「指定なし」（ルールの any）は値を持たない（NULL）で表し、専用のコードは作らない（Q&A QM-028 の回答 10/30）。
// 画面では未設定を「指定なし」と表示する（MasterFieldDef.emptyLabel）

/** メタブランド（現行コード＋ToBe 案だけの区分は仮コード T〜） */
export const DERIVATION_META_BRAND_CODE_NAME: CodeNameOption[] = [
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

/** 容器容量（モックの容器容量と同じ） */
export const DERIVATION_CONTAINER_CAPACITY_CODE_NAME: CodeNameOption[] = [
  ...CONTAINER_CAPACITY_CODE_NAME,
];

/** 容器容量グループ（現行コード＋ToBe 案だけの区分は仮コード T〜） */
export const DERIVATION_CONTAINER_GROUP_CODE_NAME: CodeNameOption[] = [
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

// ── サマリ商品マスタ（2026-11-17 作成）：Figma Make のモック「サマリ商品マスタ」の選択肢 ──
// メタブランド → ブランド → 小ブランドの 3 段で絞り込む。コードは Make のモックの値（現行のコード体系に合わせた仮の値）

/** メタブランド（サマリ商品マスタ） */
export const SUMMARY_PRODUCT_MASTER_META_BRAND_CODE_NAME: CodeNameOption[] = [
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
];

/** ブランド（サマリ商品マスタ。metaBrand は所属するメタブランドのコード） */
const SUMMARY_PRODUCT_MASTER_BRANDS: {
  code: string;
  name: string;
  metaBrand: string;
}[] = [
  { code: '2B100', name: 'ワンダ', metaBrand: '2B10' },
  { code: '2B200', name: '三ツ矢', metaBrand: '2B20' },
  { code: '2B300', name: 'ウイルキンソン', metaBrand: '2B30' },
  { code: '2B400', name: '十六茶', metaBrand: '2B40' },
  { code: '2B500', name: 'おいしい水', metaBrand: '2B50' },
  { code: '2B600', name: 'カルピスコンク', metaBrand: '2B60' },
  { code: '2B610', name: 'カルピスストレート', metaBrand: '2B65' },
  { code: '2S110', name: 'モンスター', metaBrand: '2B71' },
  { code: '2S050', name: '健茶王', metaBrand: '2B80' },
  { code: '2S060', name: '守る働く乳酸菌', metaBrand: '2B80' },
  { code: '2S070', name: '届く強さの乳酸菌', metaBrand: '2B80' },
  { code: '2S090', name: 'アミール', metaBrand: '2B80' },
  { code: '2S320', name: '抹茶ラテ', metaBrand: '2B80' },
  { code: '2S330', name: 'ラクトノナデカペプチド', metaBrand: '2B80' },
  { code: '2S340', name: 'ラクトスマート', metaBrand: '2B80' },
  { code: '2S350', name: 'プラントタイム', metaBrand: '2B80' },
  { code: '2S355', name: 'ハピ・ウェル', metaBrand: '2B80' },
  { code: '2S360', name: 'ヘルスケアその他', metaBrand: '2B80' },
  { code: '2S500', name: 'その他コーヒー（ＰＢ）', metaBrand: '2B85' },
  { code: '2S510', name: 'その他炭酸（ＰＢ）', metaBrand: '2B85' },
  { code: '2S520', name: 'その他日本茶（ＰＢ）', metaBrand: '2B85' },
  { code: '2S530', name: 'その他中国茶（ＰＢ）', metaBrand: '2B85' },
  { code: '2S540', name: 'その他紅茶（ＰＢ）', metaBrand: '2B85' },
  { code: '2S550', name: 'その他茶（ＰＢ）', metaBrand: '2B85' },
  { code: '2S560', name: 'その他果汁（ＰＢ）', metaBrand: '2B85' },
  { code: '2S570', name: 'その他果実（ＰＢ）', metaBrand: '2B85' },
  { code: '2S580', name: 'その他乳性飲料（ＰＢ）', metaBrand: '2B85' },
  { code: '2S585', name: 'その他健康（ＰＢ）', metaBrand: '2B85' },
  { code: '2S590', name: 'その他（ＰＢ）', metaBrand: '2B85' },
  { code: '2B700', name: 'ギフト', metaBrand: '2S10' },
  { code: '2S010', name: '六条麦茶', metaBrand: '2S10' },
  { code: '2S020', name: 'バヤリース', metaBrand: '2S10' },
  { code: '2S030', name: 'ウェルチ', metaBrand: '2S10' },
  { code: '2S040', name: 'ほっと', metaBrand: '2S10' },
  { code: '2S080', name: 'ドデカミンシリーズ', metaBrand: '2S10' },
  { code: '2S100', name: '食事の脂にシリーズ', metaBrand: '2S10' },
  { code: '2S120', name: 'フォション', metaBrand: '2S10' },
  { code: '2S125', name: 'フォション(コンク)', metaBrand: '2S10' },
  { code: '2S130', name: 'スーパーＨ２Ｏ', metaBrand: '2S10' },
  { code: '2S140', name: '一級茶葉使用烏龍茶', metaBrand: '2S10' },
  { code: '2S150', name: 'ぐんぐんグルト', metaBrand: '2S10' },
  { code: '2S160', name: '黒豆黒茶', metaBrand: '2S10' },
  { code: '2S170', name: 'ＡＢ社販売分', metaBrand: '2S10' },
  { code: '2S180', name: '提携品', metaBrand: '2S10' },
  { code: '2S190', name: '直販社外品', metaBrand: '2S10' },
  { code: '2S200', name: 'その他コーヒー', metaBrand: '2S10' },
  { code: '2S210', name: 'その他炭酸', metaBrand: '2S10' },
  { code: '2S220', name: 'その他日本茶', metaBrand: '2S10' },
  { code: '2S230', name: 'その他中国茶', metaBrand: '2S10' },
  { code: '2S240', name: 'その他紅茶', metaBrand: '2S10' },
  { code: '2S245', name: 'その他茶', metaBrand: '2S10' },
  { code: '2S250', name: 'その他果実・野菜', metaBrand: '2S10' },
  { code: '2S260', name: 'その他健康', metaBrand: '2S10' },
  { code: '2S270', name: 'その他ストレート', metaBrand: '2S10' },
  { code: '2S280', name: 'その他コンク', metaBrand: '2S10' },
  { code: '2S310', name: '加工用原料', metaBrand: '2S10' },
  { code: '2S990', name: 'その他', metaBrand: '2S10' },
  { code: '2S127', name: '和紅茶', metaBrand: '2S12' },
  { code: '2S225', name: '颯', metaBrand: '2S13' },
];
export const SUMMARY_PRODUCT_MASTER_BRAND_CODE_NAME: CodeNameOption[] =
  SUMMARY_PRODUCT_MASTER_BRANDS.map((b) => ({ code: b.code, name: b.name }));
/** ブランドコード → メタブランドコード（サマリ商品マスタのメタブランド → ブランドの絞り込みに使う） */
export const META_BRAND_CODE_BY_SUMMARY_PRODUCT_MASTER_BRAND_CODE: Record<
  string,
  string
> = Object.fromEntries(
  SUMMARY_PRODUCT_MASTER_BRANDS.map((b) => [b.code, b.metaBrand])
);

/** 小ブランド（サマリ商品マスタ。brand は所属するブランドのコード） */
const SUMMARY_PRODUCT_MASTER_SUB_BRANDS: {
  code: string;
  name: string;
  brand: string;
}[] = [
  { code: '230000', name: 'モーニングショット', brand: '2B100' },
  { code: '230100', name: 'ブラック', brand: '2B100' },
  { code: '230200', name: 'カフェオレ', brand: '2B100' },
  { code: '230300', name: 'デミタス', brand: '2B100' },
  { code: '230400', name: '金の微糖', brand: '2B100' },
  { code: '230900', name: 'ワンダその他', brand: '2B100' },
  { code: '230950', name: 'ワンダ（健康領域）', brand: '2B100' },
  { code: '210000', name: '三ツ矢サイダー', brand: '2B200' },
  { code: '210300', name: '三ツ矢ゼロ', brand: '2B200' },
  { code: '210900', name: '三ツ矢その他', brand: '2B200' },
  { code: '210901', name: '三ツ矢果汁', brand: '2B200' },
  { code: '210902', name: '三ツ矢（健康領域）', brand: '2B200' },
  { code: '210903', name: '三ツ矢乳性', brand: '2B200' },
  { code: '211000', name: 'ウィルキンソンタンサン', brand: '2B300' },
  { code: '211001', name: 'ウィルキンソン（健康領域）', brand: '2B300' },
  { code: '211002', name: 'ウィルキンソンレモン', brand: '2B300' },
  { code: '211100', name: 'ウィルキンソンその他', brand: '2B300' },
  { code: '260000', name: '十六茶', brand: '2B400' },
  { code: '260100', name: '十六茶（健康領域）', brand: '2B400' },
  { code: '295228', name: '十六茶その他', brand: '2B400' },
  { code: '285000', name: '富士山のバナジウム天然水', brand: '2B500' },
  { code: '285100', name: 'おいしい水', brand: '2B500' },
  { code: '285110', name: 'おいしい水プラス', brand: '2B500' },
  { code: '295120', name: 'カルピス（コンク）', brand: '2B600' },
  { code: '295122', name: 'ダイエット（コンク）', brand: '2B600' },
  { code: '295124', name: 'カルピスフルーツ（コンク）', brand: '2B600' },
  { code: '295126', name: 'Ｌパック（業務用）', brand: '2B600' },
  { code: '295131', name: 'Ｌパックフルーツ（業務用）', brand: '2B600' },
  { code: '295160', name: 'カルピスウォーター', brand: '2B610' },
  { code: '295161', name: '果実＆カルピス', brand: '2B610' },
  { code: '295162', name: 'カルピスオアシス', brand: '2B610' },
  { code: '295163', name: 'プレミアムカルピス', brand: '2B610' },
  { code: '295164', name: 'ほっとカルピス', brand: '2B610' },
  { code: '295165', name: 'カルピスソーダ', brand: '2B610' },
  { code: '295196', name: 'その他カルピスストレート', brand: '2B610' },
  { code: '295202', name: 'カルピス（健康領域）', brand: '2B610' },
  { code: '295229', name: '発酵ＢＬＥＮＤ', brand: '2B610' },
  { code: '295230', name: 'ＧＲＥＥＮ　ＣＡＬＰＩＳ', brand: '2B610' },
  { code: '295232', name: '濃いめのカルピス', brand: '2B610' },
  { code: '289005', name: 'モンスター', brand: '2S110' },
  { code: '295177', name: '健茶王（健康領域）', brand: '2S050' },
  { code: '295183', name: '守る働く乳酸菌（健康領域）', brand: '2S060' },
  { code: '295184', name: '届く強さの乳酸菌（健康領域）', brand: '2S070' },
  { code: '295176', name: 'アミール（健康領域）', brand: '2S090' },
  { code: '295180', name: 'アミール健食（健康領域）', brand: '2S090' },
  { code: '295205', name: '抹茶ラテ（健康領域）', brand: '2S320' },
  {
    code: '295207',
    name: 'ラクトノナデカペプチド（健康領域）',
    brand: '2S330',
  },
  { code: '295231', name: 'ラクトスマート（健康領域）', brand: '2S340' },
  { code: '295227', name: 'プラントタイム', brand: '2S350' },
  { code: '295237', name: 'ハピ・ウェル（健康領域）', brand: '2S355' },
  { code: '295235', name: 'ヘルスケアその他', brand: '2S360' },
  { code: '239100', name: 'その他コーヒー（ＰＢ）', brand: '2S500' },
  { code: '213000', name: 'その他炭酸（ＰＢ）', brand: '2S510' },
  { code: '269500', name: 'その他日本茶（ＰＢ）', brand: '2S520' },
  { code: '259950', name: 'その他中国茶（ＰＢ）', brand: '2S530' },
  { code: '249100', name: 'その他紅茶（ＰＢ）', brand: '2S540' },
  { code: '269700', name: 'その他茶（ＰＢ）', brand: '2S550' },
  { code: '221500', name: 'その他果汁（ＰＢ）', brand: '2S560' },
  { code: '295199', name: 'その他果実（ＰＢ）', brand: '2S570' },
  { code: '295197', name: 'その他乳性飲料（ＰＢ）', brand: '2S580' },
  { code: '279500', name: 'その他健康（ＰＢ）', brand: '2S585' },
  { code: '284003', name: 'その他（ＰＢ）', brand: '2S590' },
  { code: '295133', name: 'ＣＮ系統', brand: '2B700' },
  { code: '295134', name: 'ＣＮＨ系統', brand: '2B700' },
  { code: '295135', name: 'ＣＲ系統', brand: '2B700' },
  { code: '295136', name: 'Ｓ系統', brand: '2B700' },
  { code: '295137', name: 'ＣＨ系統', brand: '2B700' },
  { code: '295138', name: 'ＶＬ系統', brand: '2B700' },
  { code: '295139', name: 'ＨＧ系統', brand: '2B700' },
  { code: '295140', name: 'Ｃオリジナル系統', brand: '2B700' },
  { code: '295142', name: 'ＳＣ系統', brand: '2B700' },
  { code: '295143', name: 'ＳＣＨ系統', brand: '2B700' },
  { code: '295144', name: 'ＬＣ系統', brand: '2B700' },
  { code: '295145', name: '限定系統１', brand: '2B700' },
  { code: '295146', name: 'Ｗ系統', brand: '2B700' },
  { code: '295147', name: 'ＷＨ系統', brand: '2B700' },
  { code: '295148', name: 'ＷＴ系統', brand: '2B700' },
  { code: '295149', name: 'ＷＳ系統', brand: '2B700' },
  { code: '295151', name: 'ＡＰ系統', brand: '2B700' },
  { code: '295152', name: 'ＳＪ系統', brand: '2B700' },
  { code: '295153', name: 'ＶＣ系統', brand: '2B700' },
  { code: '295155', name: 'Ｖオリジナル系統', brand: '2B700' },
  { code: '295157', name: 'ギフト単品（カルピス）', brand: '2B700' },
  { code: '295158', name: 'ギフト単品（果汁）', brand: '2B700' },
  { code: '295159', name: 'その他ブランド', brand: '2B700' },
  { code: '295186', name: 'ＷＫ系統', brand: '2B700' },
  { code: '295200', name: 'ＣＰ系統', brand: '2B700' },
  { code: '295201', name: 'ＫＮＧ系統', brand: '2B700' },
  { code: '295203', name: 'ＺＣＧ系統', brand: '2B700' },
  { code: '295208', name: 'ＣＫ系統', brand: '2B700' },
  { code: '295209', name: 'ＣＳＰ系統', brand: '2B700' },
  { code: '295210', name: 'ＣＤＢ系統', brand: '2B700' },
  { code: '295211', name: 'ポーション系統', brand: '2B700' },
  { code: '295226', name: 'ＮＣ系統', brand: '2B700' },
  { code: '295236', name: 'ＫＮＰ系統', brand: '2B700' },
  { code: '295240', name: 'ＣＷＭ系統', brand: '2B700' },
  { code: '295241', name: 'ＴＮＧ系統', brand: '2B700' },
  { code: '295242', name: 'ＣＲＶ系統', brand: '2B700' },
  { code: '264000', name: '六条麦茶', brand: '2S010' },
  { code: '220000', name: 'バヤリース（オレンジ低果汁）', brand: '2S020' },
  { code: '220100', name: 'バヤリース（その他低果汁）', brand: '2S020' },
  { code: '220300', name: 'バヤリース（１００％果汁）', brand: '2S020' },
  { code: '220400', name: 'バヤリース（トマト・野菜）', brand: '2S020' },
  { code: '220500', name: 'バヤリース１００％果汁（ギフト）', brand: '2S020' },
  { code: '220600', name: '沖縄バヤリース', brand: '2S020' },
  { code: '289006', name: '沖縄バヤリース（仕入）', brand: '2S020' },
  { code: '295168', name: 'ウェルチホームユース', brand: '2S030' },
  { code: '295169', name: 'ウェルチパーソナルユース', brand: '2S030' },
  { code: '295170', name: 'ウェルチ業務用', brand: '2S030' },
  { code: '295206', name: 'ウェルチ（健康領域）', brand: '2S030' },
  { code: '295128', name: 'ほっと飲料（コンク）', brand: '2S040' },
  { code: '295171', name: 'ほっとレモン', brand: '2S040' },
  { code: '295172', name: 'ほっと（その他）', brand: '2S040' },
  { code: '279100', name: 'ドデカミンシリーズ', brand: '2S080' },
  { code: '259100', name: '食事の脂にシリーズ', brand: '2S100' },
  { code: '242000', name: 'フォション', brand: '2S120' },
  { code: '242100', name: 'フォション（コンク）', brand: '2S125' },
  { code: '271000', name: 'スーパーＨ２Ｏ', brand: '2S130' },
  { code: '250000', name: '一級茶葉使用烏龍茶', brand: '2S140' },
  { code: '295166', name: 'ぐんぐんグルト', brand: '2S150' },
  { code: '295174', name: '無糖茶', brand: '2S160' },
  { code: '295198', name: '黒豆黒茶', brand: '2S160' },
  { code: '288000', name: '業務用烏龍茶', brand: '2S170' },
  { code: '289001', name: 'カゴメ', brand: '2S180' },
  { code: '289002', name: '大塚製薬', brand: '2S180' },
  { code: '289003', name: '大正製薬', brand: '2S180' },
  { code: '289007', name: 'ダイドードリンコ', brand: '2S180' },
  { code: '289008', name: '伊藤園', brand: '2S180' },
  { code: '299200', name: 'オリオンビール', brand: '2S180' },
  { code: '299000', name: '直販社外品', brand: '2S190' },
  { code: '299100', name: 'フードアンドヘルスケア', brand: '2S190' },
  { code: '231000', name: 'カフェオ', brand: '2S200' },
  { code: '232900', name: 'ドトール', brand: '2S200' },
  { code: '212900', name: 'その他炭酸', brand: '2S210' },
  { code: '260500', name: '若武者', brand: '2S220' },
  { code: '260700', name: 'いぶき', brand: '2S220' },
  { code: '260800', name: '匠屋', brand: '2S220' },
  { code: '265000', name: 'その他麦茶', brand: '2S220' },
  { code: '269000', name: 'その他日本茶', brand: '2S220' },
  { code: '269600', name: 'その他日本茶（健康領域）', brand: '2S220' },
  { code: '259900', name: 'その他中国茶', brand: '2S230' },
  { code: '243000', name: 'ティオ', brand: '2S240' },
  { code: '249000', name: 'その他紅茶', brand: '2S240' },
  { code: '269800', name: 'その他茶', brand: '2S245' },
  { code: '221100', name: 'その他果実・野菜', brand: '2S250' },
  { code: '279000', name: 'その他健康', brand: '2S260' },
  { code: '279600', name: 'その他健康（健康領域）', brand: '2S260' },
  { code: '295125', name: 'カルピスコンク（家庭用）他', brand: '2S270' },
  { code: '295167', name: 'その他乳性飲料', brand: '2S270' },
  { code: '295173', name: 'その他機能性（カルピス）', brand: '2S270' },
  { code: '295179', name: 'その他健康飲料', brand: '2S270' },
  { code: '295129', name: 'その他コンク', brand: '2S280' },
  { code: '295191', name: '飼料原料', brand: '2S310' },
  { code: '295192', name: '製菓原料', brand: '2S310' },
  { code: '295193', name: 'ＡＢ向け中間原料', brand: '2S310' },
  { code: '295194', name: 'ＬＢ向け中間原料', brand: '2S310' },
  { code: '295204', name: 'アサヒグループ向け中間原料', brand: '2S310' },
  { code: '284000', name: 'その他', brand: '2S990' },
  { code: '284001', name: 'バンホーテン', brand: '2S990' },
  { code: '284002', name: 'おしるこ', brand: '2S990' },
  { code: '285900', name: '水・その他', brand: '2S990' },
  { code: '286000', name: '水・その他（ＰＢ）', brand: '2S990' },
  { code: '289000', name: 'カルピス', brand: '2S990' },
  { code: '295127', name: 'カルピスコンク（業務用）他', brand: '2S990' },
  { code: '295175', name: 'その他非乳性', brand: '2S990' },
  { code: '244000', name: '和紅茶', brand: '2S127' },
  { code: '261500', name: '颯', brand: '2S225' },
];
export const SUMMARY_PRODUCT_MASTER_SUB_BRAND_CODE_NAME: CodeNameOption[] =
  SUMMARY_PRODUCT_MASTER_SUB_BRANDS.map((b) => ({
    code: b.code,
    name: b.name,
  }));
/** 小ブランドコード → ブランドコード（サマリ商品マスタのブランド → 小ブランドの絞り込みに使う） */
export const BRAND_CODE_BY_SUMMARY_PRODUCT_MASTER_SUB_BRAND_CODE: Record<
  string,
  string
> = Object.fromEntries(
  SUMMARY_PRODUCT_MASTER_SUB_BRANDS.map((b) => [b.code, b.brand])
);

/** 容器（サマリ商品マスタ） */
export const SUMMARY_PRODUCT_MASTER_CONTAINER_CODE_NAME: CodeNameOption[] = [
  { code: '00', name: '指定なし' },
  { code: '10', name: '瓶' },
  { code: '20', name: '缶' },
  { code: '22', name: 'ＰＥＴ' },
  { code: '33', name: 'コンテナ' },
  { code: '40', name: 'パック' },
  { code: '41', name: 'バッグインボックス' },
  { code: '42', name: 'ティーバック' },
  { code: '50', name: 'カップ（ＰＰ）' },
];

/** 容量（サマリ商品マスタ。名称はコードと同じ） */
export const SUMMARY_PRODUCT_MASTER_VOLUME_CODE_NAME: CodeNameOption[] = [
  { code: '100', name: '100' },
  { code: '200', name: '200' },
  { code: '335', name: '335' },
  { code: '600', name: '600' },
  { code: '630', name: '630' },
  { code: '750', name: '750' },
  { code: '900', name: '900' },
  { code: '1000', name: '1000' },
  { code: '1500', name: '1500' },
  { code: '2000', name: '2000' },
];
