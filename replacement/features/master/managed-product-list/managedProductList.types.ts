// 管理対象商品一覧（master/managed-product-list）の型

export interface ProductTargetData {
  id: string;
  productCategory: string;
  summaryProduct: string;
  metaBrand: string;
  referenceProduct: string;
  targetStartMonth: string;
  targetEndMonth: string;
  targetArea: string;
}
