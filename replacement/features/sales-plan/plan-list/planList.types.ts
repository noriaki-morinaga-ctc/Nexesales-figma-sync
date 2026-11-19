// 計画一覧（実績一覧を含む）の型。

/** 三次店・一次店の組み合わせ（1つの計画に複数あるときは行を開いて見せる） */
export interface StoreDetail {
  tertiaryStore: string;
  primaryStore: string;
}

/** 計画一覧の1行 */
export interface SalesPlanData {
  id: string;
  targetMonth: string;
  monthlyPlanNo: string; // 計画書番号
  actualNo?: string; // 実績番号（採番されている自販機の計画だけ値を持つ）
  applicationStatus: string;
  status: string;
  channel: string;
  area: string;
  office: string;
  retailer: string;
  tertiaryStoreCompany: string; // 三次店企業（その他企業のみ値を持ち、それ以外は「ー」）
  tertiaryStore: string;
  primaryStore: string;
  department: string;
  terminalOrg: string; // 末端組織（＝採算組織第6階層。組織階層は 事業場→部署→末端組織→作成者）
  salesRep: string;
  inputProductGranularity: string; // 商品粒度
  tradeSystem: string; // 作成パターン（マージン率固定／NET入力／NET固定／自販機／商流販売店に紐づかない）
  // コード（名称の左の列に出す。値の無い項目はコードも空）
  retailerCode: string; // 販売店コード
  tertiaryStoreCode: string; // 三次店コード
  primaryStoreCode: string; // 一次店コード
  tertiaryStoreCompanyCode: string; // 三次店企業コード
  areaCode: string; // 担当エリアコード
  officeCode: string; // 事業場コード
  terminalOrgCode: string; // 末端組織コード
  salesRepCode: string; // 作成者コード
  storeDetails?: StoreDetail[]; // 三次店・一次店の組み合わせ
  isNoLink?: boolean; // 商流紐づけなし計画（計画表ボタンで商流紐づけなし画面へ遷移）
}
