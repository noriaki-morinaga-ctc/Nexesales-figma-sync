// 単価マスタ：画面定義（型1 マスタメンテCRUD型）。一覧のモック行は src/mocks/master/new-product-unit-price-master.ts。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/new-product-unit-price-master.json）。項目はエンティティ定義に合わせる。
// 単価マスタ（型1・更新有）。Figma Make のモック「単価マスタ」（UnitPriceMaster.tsx）に合わせて定義 JSON と共通部品（features/master/shared）で作り直したもの（W062、2026-11-18 決定。Make 側が正）。
// エンティティ一覧表・定義書「新商品・新価格用単価マスタ」。ルート ID は new-product-unit-price-master のまま。
// データ区分のコード（1：正式商品・2：ダミー商品・3：価格改定商品）は Make の区分名に仮に振ったもの（サマリ商品マスタと同じ）。
// 三次店・一次店は商流から決まる表示用の項目（右ペインには出さない）。世代は展開せず、過去の世代も一覧に並べる。価格改定（コピー）は付けない（部品のコピーは主キーを変えられず重複エラーになるため。2026-11-18 決定）。

import { COMPANY_CODE_NAME } from '@/constants/masterCodeNameOptions';
import type { MasterScreenDef } from '@/features/master/shared';

export const NEW_PRODUCT_UNIT_PRICE_DEF: MasterScreenDef = {
  routeId: 'new-product-unit-price-master',
  title: '単価マスタ',
  entityLabel: '単価マスタ',
  fields: [
    {
      key: 'dataCategory',
      label: 'データ区分',
      kind: 'select',
      options: [
        { code: '1', name: '正式商品' },
        { code: '2', name: 'ダミー商品' },
        { code: '3', name: '価格改定商品' },
      ],
      hideInForm: true,
      readOnly: true,
    },
    {
      key: 'salesItem',
      label: '販売アイテム内部コード',
      kind: 'combo',
      pk: true,
      required: true,
      options: [
        { code: '99999999', name: 'グリーンコーラPET500' },
        { code: '00004120', name: 'グルメコーンポタージュ缶１９０' },
        { code: '00004432', name: 'ティオレモンティー缶２４５' },
        { code: '00004215', name: 'オー．プラスＰＥＴ５００（丸）' },
        { code: '00004687', name: '三ツ矢サイダーイチロー缶２５０　６本×５' },
        { code: '00004351', name: 'ＫＡＦＥＯブラック缶１９０Ｎ' },
        { code: '00003998', name: '一級茶葉烏龍茶タイガース缶３４０Ｎ' },
        { code: '00004802', name: '十六茶ＰＥＴ１．５ＬＮ' },
        { code: '00004076', name: 'ナイス．ワンチアーパック３００' },
        { code: '00004563', name: '三ツ矢アップル１．５Ｌ' },
      ],
      codeLabel: '販売アイテム内部コード',
      nameLabel: '商品名',
    },
    {
      key: 'channel',
      label: '商流内部コード',
      kind: 'text',
      pk: true,
      required: true,
      maxLength: 8,
      placeholder: '商流内部コードを入力',
    },
    {
      key: 'tertiaryStore',
      label: '三次店',
      kind: 'combo',
      options: [
        { code: '00032127', name: '三菱食品株式会社広島FC' },
        { code: '00000256', name: '伊藤忠食品株式会社東北支社' },
        { code: '00032243', name: '日本アクセス株式会社首都圏支社' },
        { code: '00032065', name: '国分北海道株式会社経営FC' },
        { code: '00032190', name: '中部ドリンク支社' },
        { code: '00000171', name: '近畿ドリンク食品' },
        { code: '00032066', name: '中国四国ドリンク会社' },
        { code: '00000298', name: '九州食品株式会社' },
      ],
      hideInForm: true,
      readOnly: true,
    },
    {
      key: 'primaryStore',
      label: '一次店',
      kind: 'combo',
      options: [
        { code: '00032296', name: '三菱食品株式会社北見営業所' },
        { code: '00000255', name: '伊藤忠食品札幌支店' },
        { code: '00032200', name: '日本アクセス仙台営業所' },
        { code: '00000314', name: '国分北海道株式会社' },
      ],
      hideInForm: true,
      readOnly: true,
    },
    {
      key: 'priceKbn',
      label: '単価区分',
      kind: 'select',
      pk: true,
      required: true,
      options: [
        { code: '210M', name: 'XX（210M）' },
        { code: '2101', name: 'XX（2101）' },
        { code: '212M', name: 'XX（212M）' },
        { code: '2107', name: 'XX（2107）' },
        { code: '210S', name: 'XX（210S）' },
      ],
    },
    {
      key: 'priceStart',
      label: '適用開始年月日',
      kind: 'date',
      pk: true,
      required: true,
    },
    {
      key: 'piecePrice',
      label: 'アイテムバラ単価',
      kind: 'number',
      required: true,
      format: 'integer',
      unit: '円',
    },
    {
      key: 'piecePriceExDeposit',
      label: 'アイテムバラ保証金抜き単価',
      kind: 'number',
      required: true,
      format: 'integer',
      unit: '円',
    },
    {
      key: 'company',
      label: '共通会社コード',
      kind: 'combo',
      options: COMPANY_CODE_NAME,
      codeLabel: '共通会社コード',
      nameLabel: '共通会社名',
      fixedValue: '0093',
    },
  ],
  searchKeys: ['salesItem', 'priceStart', 'tertiaryStore', 'primaryStore'],
};
