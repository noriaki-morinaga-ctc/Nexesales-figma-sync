// 販売計画（小売：計画詳細(マージン率固定・NET入力)）の明細の型（型だけを書く → 04 §画面ディレクトリ構成「共通の型」）

export interface ProductData {
  // 行の一意ID（getRowId・行削除の照合に使用。withRowId／コピー時に採番）
  id?: string;
  section: string;
  metaBrand: string;
  containerCapacityG?: string;
  summaryProduct: string;
  wholesaleMesh: string;
  productCategory: string;
  endSale: string;
  period?: string;
  promotion: string;
  quantity: string;
  plan: string;
  estimate: string;
  actual: string;
  prevYear: string;
  ratio: string;
  net: string;
  planPrice: string;
  ediPrice?: string;
  prevYearPrice: string;
  price: string;
  margin: string;
  volumeAddRate: string;
  externalSales: string;
  delivery: string;
  discount: string;
  markupAmount?: string; // 値入額（算出：(売価 − 納価) × 入数 × 函数(計画)）
  profit: string;
  exp1PlannedAmount: string;
  exp1PostingMonth: string;
  exp1ManagementCode: string;
  exp1AccountItem: string;
  exp1ManagementClass: string;
  exp1Description: string;
  exp2PlannedAmount: string;
  exp2PostingMonth: string;
  exp2ManagementCode: string;
  exp2AccountItem: string;
  exp2ManagementClass: string;
  exp2Description: string;
  tier1?: string; // 一次店
  tier3?: string; // 三次店
  // 明細追加・コピーで採番する挿入順（値が大きいほど新しい）。表示時は新規・下ペインのコピーを
  // 最下行へ追加した順に、行コピーをコピー元の行のすぐ下へ並べる（orderAddedRows → 02 §8・UX-112）
  _addedSeq?: number;
  // 行コピーで作った行の、コピー元のまとまりのキー（ギフトは giftSetId、ほかは行の id）
  _copyOf?: string;
  // 区分の見出し行（グリッドで区切りとして出す行。明細ではない）
  _isHeader?: boolean;
  // 行の追加経路（カラーバー表示用）: detail=グリッドの行コピー / new=明細追加
  _copySource?: 'reference' | 'detail' | 'new';
  // ギフトの「上旬・中旬・下旬」3行1セットを識別するキー。
  // 同一 giftSetId の行はグリッドで販売期間・計画(函数)以外をセル結合し、
  // 追加・コピー・削除を3行まとめて行う。
  giftSetId?: string;
  // グリッド表示用の一時フラグ（rowData生成時に付与。セル結合の先頭行判定と行数）。
  _giftFirst?: boolean;
  _giftSpan?: number;
  // 操作アイコンをセット中央行にのみ表示するための一時フラグ（rowData生成時に付与）。
  _giftMiddle?: boolean;
  // セット最終行（下旬）判定。操作列の内部罫線制御に使用。
  _giftLast?: boolean;
  // 計画行に反映した実販EDI（実販FACT）の突合の状態（行頭マーカー：自動・手動・追加）。
  // 実販EDIを反映していない行は持たない（補足8-7 ②）。
  ediMatchStatus?: Exclude<EdiMatchStatus, 'unmatched'>;
  // 未突合の実販EDIを計画行の直下に出す表示専用の行（EDI行）。計画行ではないため、
  // 編集・合計・販売計画(集計)の対象にしない（補足8-7 3.）。
  _ediRow?: boolean;
  // EDI行の元の実販EDI・手動で突合した計画行に寄せた実販EDIの ID（EdiActual.id）。
  // 商品区分の変更で計画行の id が変わっても、突合の取消で元の実販EDIを引けるように行に持つ。
  _ediActualId?: string;
}

// 実販EDI（実販FACT）の突合の状態（補足8-7 ②）。
// 自動はどの反映ルールで決まったかを持つ（補足8-1 マージン率固定のルール①〜③）。
// unmatched＝未突合／auto1〜3＝自動（ルール①〜③）／manual＝手動で突合／added＝未突合のまま保存して行を追加（ルール④）
export type EdiMatchStatus =
  | 'unmatched'
  | 'auto1'
  | 'auto2'
  | 'auto3'
  | 'manual'
  | 'added';

// 実販EDI（実販FACT）の実績1件。計画行とは別の実体として持ち、突合しても消さずに
// 突合先の計画行を参照する（補足8-7 ①：いつ・どの実績を・どの行に・誰が寄せたかを残す）。
export interface EdiActual {
  id: string;
  summaryProduct: string;
  // EDI納価
  ediPrice: string;
  // 実販函数
  count: string;
  status: EdiMatchStatus;
  // 突合先の計画行の id（未突合は無し）
  planRowId?: string;
  // 手動で突合した日時・利用者
  matchedAt?: string;
  matchedBy?: string;
}

export type DetailFormValues = {
  category: string;
  wholesaleMesh: string;
  summaryProduct: string;
  metaBrand: string;
  containerCapacityG: string;
  quantity: string;
  endSale: string;
  promotion: string;
  plan: string;
  period: string;
  // ギフト専用：上旬/中旬/下旬ごとの箱数（＝計画函数）。ギフト以外は未使用。
  boxEarly: string;
  boxMid: string;
  boxLate: string;
  currentEstimate: string;
  currentActual: string;
  prevYearActual: string;
  net: string;
  deliveryPrice: string;
  price: string;
  margin: string;
  costOfSales: string;
  seihan: string;
  profitRate: string;
  discountRate: string;
};
