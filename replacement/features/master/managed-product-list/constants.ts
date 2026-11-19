// 管理対象商品一覧（master/managed-product-list）の定数・初期値

// 管理対象商品ペインのフォーム初期値。
// useState の初期化・新規登録・連続追加の3箇所で共通利用する。
export const EMPTY_TARGET_FORM = {
  productCategory: '',
  summaryProduct: '',
  referenceProduct: '',
  targetStartMonth: '',
  targetEndMonth: '',
  areaType: '' as '全国' | 'エリア指定' | '',
  targetArea: [] as string[],
};

// 検索条件の初期値（既定値）。
// 各 useState の初期化とクリアボタンの2箇所で共通利用する。
// 選択項目の未選択（''）＝条件なし（「指定なし」）
export const INITIAL_SEARCH_FILTERS = {
  productCategory: '',
  summaryProduct: '',
  targetArea: '',
  startMonth: '2025/04',
  endMonth: '',
};
