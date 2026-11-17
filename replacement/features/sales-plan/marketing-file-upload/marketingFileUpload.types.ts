// ===== ファイルアップロード画面の型定義 =====

import type {
  UploadErrorItem,
  UploadHistoryCommon,
  UploadOption,
} from '@/components/shared/upload/uploadTypes';

// エラー明細は共通（→ shared/upload/uploadTypes.ts）
export type { UploadErrorItem };

// アップロード・ダウンロード対象（テンプレートファイルのシートと1対1）
export type UploadTargetType =
  | 'managed_product_target'
  | 'alliance_additional_sales'
  | 'sales_equipment_lease'
  | 'partner_machine'
  | 'alliance_product';

// アップロード履歴の1件分（共通の項目＋対象年月）
export interface UploadHistoryItem
  extends UploadHistoryCommon<UploadTargetType> {
  // 対象年月 From／To（YYYY/MM）。ファイル内の明細の対象年月（更新キー）の最小／最大。
  // 読み取れない場合は空
  targetYearMonthFrom: string;
  targetYearMonthTo: string;
}

// アップロード・ダウンロード対象の選択肢
export type UploadTargetOption = UploadOption<UploadTargetType>;

// テンプレート（Excel）1シート分の定義
export interface TemplateDefinition {
  sheetName: string; // シート名
  fileName: string; // ダウンロード時のファイル名
  // 見出しの上段（グループ見出し）。null は空セル。上段が無いシートは undefined
  groupHeaders?: (string | null)[];
  headers: string[]; // 見出し（項目名）
  colWidths: { wch: number }[]; // Excel列幅
}

// 商流（販売店・三次店・一次店）。テンプレートの販売店CD〜一次店名の列に対応する
export interface SalesChannel {
  retailerCode: number; // 販売店CD
  retailerName: string; // 販売店名
  tertiaryStoreCode: number; // 三次店CD
  tertiaryStoreName: string; // 三次店名
  primaryStoreCode: number; // 一次店CD
  primaryStoreName: string; // 一次店名
}

// ダウンロード用の明細1行
export interface TemplateRow {
  yearMonth: string; // 対象年月（YYYY/MM）
  channel: SalesChannel; // 商流（販売店CD〜一次店名）
  // 商流より右の列の値（一次店名の次〜最終列）
  values: (string | number)[];
}

// ダウンロード条件の販売店・三次店・一次店（各コード。''＝未選択）
export interface StoreFilter {
  retailer: string;
  tertiaryStore: string;
  primaryStore: string;
}
