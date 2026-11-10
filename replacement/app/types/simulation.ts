// 販売計画シミュレーションの共通部品（components/shared/sales-plan/simulation/）で使う型。部品どうしが型のために参照し合わないよう、types/ に置く。

export interface ProductData {
  // 行の一意ID（getRowId・行更新／削除の照合に使用。販売計画表と同じく id で統一）
  id?: string;
  campaign?: string;
  // 企画名（確度の右隣に表示。企画コード/区分に対応する名称）
  campaignName?: string;
  probability?: string;
  targetMonth?: string;
  section: string;
  metaBrand: string;
  containerCapacityG?: string;
  summaryProduct: string;
  wholesaleMesh: string;
  productCategory: string;
  // 販売期間（ギフトは上旬/中旬/下旬の3行1セットで自動表示）
  period?: string;
  // ギフトの「上旬・中旬・下旬」3行1セットを識別するキー。
  // 同一 giftSetId の行はグリッドで販売期間・計画(函数)以外をセル結合し、
  // 追加・コピー・削除を3行まとめて行う。
  giftSetId?: string;
  // グリッド表示用の一時フラグ（rowData生成時に付与。セル結合の先頭行判定と行数）。
  _giftFirst?: boolean;
  _giftSpan?: number;
  // 操作列（右固定・結合不可）のギフト表示制御：中央行にのみアイコンを描画し、
  // 最終行のみ下罫線を出してセット境界を示す。
  _giftMiddle?: boolean;
  _giftLast?: boolean;
  quantity: string;
  plan: string;
  net: string;
  planPrice: string;
  price: string;
  margin: string;
  discount: string;
  // 変更前（販売計画表の保存値スナップショット）／AF実績（参照） — 比較表示用
  planBefore?: string;
  netBefore?: string;
  planPriceBefore?: string;
  priceBefore?: string;
  marginBefore?: string;
  exp1PlannedAmountBefore?: string;
  exp2PlannedAmountBefore?: string;
  planAfter?: string;
  netAfter?: string;
  planPriceAfter?: string;
  priceAfter?: string;
  marginAfter?: string;
  exp1PlannedAmountAfter?: string;
  exp2PlannedAmountAfter?: string;
  _isHeader?: boolean;
  // 明細追加・コピーで採番する挿入順。値が大きいほど新しく、表示時は合計行直下（先頭）へ並べる
  _addedSeq?: number;
  // 計画キー（コピー元グループ単位）。同一計画の明細はこのキーを共有し、確定の排他判定に使う
  _planKey?: string;
  // 行の追加経路（カラーバー表示用）: reference=コピー元ペイン / detail=グリッドの行コピー / new=明細追加
  _copySource?: 'reference' | 'detail' | 'new';
  managementProfitAmount?: string;
  managementProfitRate?: string;
  netSales?: string;
  externalSales?: string;
  // 企画単位集計の合計行で値入率（加重平均）を算出するための集計専用値（非表示）。
  //   _markupAmount＝Σ(売価−納価)×入数×計画函数／_retailAmount＝Σ売価×入数×計画函数
  _markupAmount?: string;
  _retailAmount?: string;
  // 売上高（＝社外売上高−量経追加口−条件口）の算出途中値（非表示。計算式ツールチップ用）
  _volumeAdd?: string;
  _condition?: string;
  // 管理利益額（＝売買差益−直接固定費）の算出途中値（非表示。計算式ツールチップ用）
  _tradeProfit?: string;
  _directFixed?: string;
  // 摘要1（企画に紐づく摘要）、販促区分、受渡、生販
  summary1?: string;
  promotion?: string;
  delivery?: string;
  production?: string;
  exp1PlannedAmount: string;
  exp1PostingMonth: string;
  exp1ManagementCode: string;
  exp1AccountItem: string;
  exp1ManagementClass: string;
  exp1CampaignClass?: string;
  exp1CampaignCode?: string;
  exp1Description: string; // 摘要1(社内用)
  exp1Creator?: string; // 作成者（行追加・コピー時にログインユーザー名を自動設定。編集不可）
  exp2PlannedAmount: string;
  exp2PostingMonth: string;
  exp2ManagementCode: string;
  exp2AccountItem: string;
  exp2ManagementClass: string;
  exp2CampaignClass?: string;
  exp2CampaignCode?: string;
  exp2Description: string; // 摘要1(社内用)
  exp2Creator?: string; // 作成者（行追加・コピー時にログインユーザー名を自動設定。編集不可）
}
