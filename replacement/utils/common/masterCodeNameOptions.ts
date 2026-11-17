// masterCodeNameOptions（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import {
  CONTAINER_GROUP_CODE_BY_MASTER_CODE,
  SUMMARY_PRODUCT_CODE_BY_VALUE,
} from '@/constants/masterCodeNameOptions';

/** 業務画面モックの容器容量Gコード（CG…）→ マスタ画面の容器容量Ｇコード（2桁） */
export const containerGroupCodeOf = (masterCode: string): string =>
  CONTAINER_GROUP_CODE_BY_MASTER_CODE.get(masterCode) ?? '';

/** ダミーのサマリ商品か（コード先頭が「D」。判定は暫定で、新商品・新価格用サマリ商品の設計で変わり得る。Q&A No.31） */
export const isDummySummaryProductCode = (code: string): boolean =>
  code.startsWith('D');

/** サマリ商品名 → サマリ商品コード */
export const summaryProductCodeOf = (name?: string): string =>
  SUMMARY_PRODUCT_CODE_BY_VALUE.get(String(name ?? '')) ?? '';
