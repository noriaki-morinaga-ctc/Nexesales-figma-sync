// masterCodeNameOptions（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import {
  CONTAINER_GROUP_CODE_BY_MASTER_CODE,
  SUMMARY_PRODUCT_CODE_BY_VALUE,
} from '@/constants/masterCodeNameOptions';

/** 業務画面モックの容器容量Gコード（CG…）→ マスタ画面の容器容量Ｇコード（2桁） */
export const containerGroupCodeOf = (masterCode: string): string =>
  CONTAINER_GROUP_CODE_BY_MASTER_CODE.get(masterCode) ?? '';

/** サマリ商品名 → サマリ商品コード */
export const summaryProductCodeOf = (name?: string): string =>
  SUMMARY_PRODUCT_CODE_BY_VALUE.get(String(name ?? '')) ?? '';
