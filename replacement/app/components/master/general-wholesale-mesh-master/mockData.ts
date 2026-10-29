// 一般卸メッシュマスタ：画面定義（型1）とモックデータ。
// 項目はエンティティ一覧表・定義書（2026-10-22 版）「一般卸メッシュマスタ」シートに合わせる
// （PK＝一般卸メッシュコード・適用開始年月日。メタブランドコード・容器容量Ｇコード・希望小売価格・商品函バラ入数は
// 適用開始年月日と組でユニーク制約）。業務キーは一般卸メッシュコード（登録時に自動採番、変更不可）。
// モックの一般卸メッシュは販売計画表と同じ WHOLESALE_MESH_OPTIONS（単一の情報源）から起こし、
// コード・名称の候補は masterCodeNameOptions（マスタ画面共通）を使う。

import {
  CONTAINER_CAPACITY_MASTER,
  META_BRAND_MASTER,
  SUMMARY_PRODUCT_BY_WHOLESALE_MESH,
  WHOLESALE_MESH_BY_VALUE,
} from '../../../constants/productMasters';
import {
  containerCapacityCodeOf,
  metaBrandCodeOf,
  wholesaleMeshCodeOf,
} from '../../../constants/comboFieldOptions';
import {
  CONTAINER_GROUP_CODE_NAME,
  META_BRAND_CODE_NAME,
  SUMMARY_PRODUCT_CODE_NAME_NO_DUMMY,
  containerGroupCodeOf,
  summaryProductCodeOf,
} from '../../../constants/masterCodeNameOptions';
import { END_OF_TIME } from '../../shared/master';
import type { MasterRow, MasterScreenDef } from '../../shared/master';

export const GENERAL_WHOLESALE_MESH_DEF: MasterScreenDef = {
  routeId: 'general-wholesale-mesh-master',
  title: '一般卸メッシュマスタ',
  entityLabel: '一般卸メッシュ',
  fields: [
    {
      key: 'meshCode',
      label: '一般卸メッシュコード',
      kind: 'text',
      pk: true,
      readOnly: true,
    },
    {
      key: 'startDate',
      label: '適用開始年月日',
      kind: 'date',
      pk: true,
      required: true,
    },
    {
      key: 'endDate',
      label: '適用終了年月日',
      kind: 'date',
      required: true,
    },
    {
      key: 'metaBrand',
      label: 'メタブランド',
      kind: 'combo',
      unique: true,
      required: true,
      options: META_BRAND_CODE_NAME,
    },
    {
      key: 'containerGroup',
      label: '容器容量グループ',
      kind: 'combo',
      unique: true,
      required: true,
      options: CONTAINER_GROUP_CODE_NAME,
      codeLabel: '容器容量Gコード',
      nameLabel: '容器容量G名称',
    },
    {
      key: 'retailPrice',
      label: '希望小売価格',
      kind: 'number',
      unique: true,
      required: true,
      format: 'integer',
      unit: '円',
    },
    {
      key: 'caseQuantity',
      label: '商品函バラ入数',
      kind: 'number',
      unique: true,
      required: true,
      format: 'integer',
      unit: '本',
    },
    {
      key: 'meshName',
      label: '一般卸メッシュ名称',
      kind: 'text',
      required: true,
      searchAlsoKeys: ['meshCode'],
      placeholder: '例：三ツ矢サイダー500mL24本',
    },
    {
      key: 'summaryProduct',
      label: '代表サマリ商品',
      kind: 'combo',
      required: true,
      // ダミーのサマリ商品は設定しない（10/8 決定14、Q&A No.31）
      options: SUMMARY_PRODUCT_CODE_NAME_NO_DUMMY,
    },
    {
      key: 'costOfSales',
      label: '売上原価(支社受渡バラ単価・保証金抜き)',
      kind: 'number',
      required: true,
      format: 'decimal2',
      unit: '円',
    },
    {
      key: 'baseNet',
      label: '基準NET(バラ単価)',
      kind: 'number',
      required: true,
      format: 'decimal2',
      unit: '円',
    },
  ],
  searchKeys: [
    'meshName',
    'metaBrand',
    'containerGroup',
    'summaryProduct',
    'startDate',
  ],
  generation: {
    startKey: 'startDate',
    endKey: 'endDate',
  },
  copyAction: true,
  bulkUpload: true,
  autoNumberKey: 'meshCode',
  autoNumberPrefix: 'WM',
};

// 希望小売価格：メッシュ名の「〇〇円」から取り、無ければ代表サマリ商品の売価、それも無ければ 150円
const retailPriceOf = (meshValue: string, fallback?: string): number => {
  const m = /(\d+)円/.exec(meshValue);
  if (m) return Number(m[1]);
  const price = Number(fallback);
  return Number.isNaN(price) || price === 0 ? 150 : price;
};

const CREATED_AT = '2026/03/15 10:00';

const buildRows = (): MasterRow[] => {
  const rows: MasterRow[] = [];
  Array.from(WHOLESALE_MESH_BY_VALUE.values()).forEach((mesh, index) => {
    const summary = SUMMARY_PRODUCT_BY_WHOLESALE_MESH.get(mesh.value);
    const summaryCode = summary ? summaryProductCodeOf(summary.value) : '';
    const base: Omit<MasterRow, 'id'> = {
      meshCode: wholesaleMeshCodeOf(mesh.value),
      meshName: mesh.value,
      metaBrand: metaBrandCodeOf(mesh.metaBrand) || META_BRAND_MASTER[1].code,
      containerGroup: containerGroupCodeOf(
        containerCapacityCodeOf(mesh.containerCapacityG) ||
          CONTAINER_CAPACITY_MASTER[0].code
      ),
      retailPrice: retailPriceOf(mesh.value, summary?.price),
      caseQuantity: Number(mesh.quantity) || 24,
      startDate: '2026/04/01',
      endDate: END_OF_TIME,
      // 代表サマリ商品は必須のため、対応が無いメッシュには候補の先頭から順に仮の値を置く
      summaryProduct:
        summaryCode ||
        SUMMARY_PRODUCT_CODE_NAME_NO_DUMMY[
          index % SUMMARY_PRODUCT_CODE_NAME_NO_DUMMY.length
        ].code,
      costOfSales: Number(mesh.costOfSales) || 0,
      baseNet: Number(mesh.net) || 0,
      createdBy: '営戦 花子',
      createdAt: CREATED_AT,
      updatedBy: '営戦 花子',
      updatedAt: CREATED_AT,
    };
    rows.push({ ...base, id: `gwm-${index + 1}-current` });

    // 先頭5件は前年度の世代を持たせ、集約表示（展開で全世代を確認）を確かめられるようにする
    if (index < 5) {
      rows.push({
        ...base,
        id: `gwm-${index + 1}-prev`,
        startDate: '2025/04/01',
        endDate: '2026/03/31',
        costOfSales: Math.round(Number(base.costOfSales) * 0.97 * 100) / 100,
        baseNet: Math.round(Number(base.baseNet) * 0.97 * 100) / 100,
        createdAt: '2025/03/14 09:30',
        updatedAt: '2025/03/14 09:30',
      });
    }
  });
  return rows;
};

export const GENERAL_WHOLESALE_MESH_ROWS: MasterRow[] = buildRows();
