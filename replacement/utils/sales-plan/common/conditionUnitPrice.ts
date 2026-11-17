// 条件口単価の導出 ─ 新_補足4-2「条件口単価の導出ロジック」付録2 の抽出ステップ No.1〜7。
//
// 補足3-1 No.5「└条件口」＝ 条件口単価 × 入数 × 函数(計画) の集計 で使う。
//
//   No.1 取引制度メッシュマスタ  一般卸メッシュ                 → 代表サマリ商品（NET固定のみ）
//   No.2 商品・商流分類紐づけM   サマリ商品                     → 商流分類
//   No.3 商流販売店マスタ        商流分類＋販売店キー           → 直送商流内部コード
//   No.4 商流マスタ              直送商流内部コード             → 一次店・二次店・三次店、売上区分
//   No.5 量販経費情報マスタ      一次店・売上区分               → 条件口パターンコード
//   No.6 サマリ商品紐づけマスタ  サマリ商品                     → 代表オンライン商品
//   No.7 単価パターンマスタ      代表オンライン商品＋パターンCD → 条件口単価
//
// 単価パターンの取得は必須（国分商流でも V1010 が適用されることがあるため）。
// マスタが引けない場合は例外を投げず単価0を返し、集計側で0として扱う。
import {
  SUMMARY_PRODUCT_OPTIONS,
  WHOLESALE_MESH_OPTIONS,
} from '@/constants/productMasters';
import {
  DEFAULT_STORE_KEY,
  CHANNEL_CLASS_BY_META_BRAND,
  DEFAULT_CHANNEL_CLASS,
  DIRECT_CHANNEL_CODE_BY_CLASS,
  CHANNEL_MASTER,
  PATTERN_CODE_BY_TIER1,
  CHILLED_PATTERN_SUFFIX,
  CONDITION_UNIT_PRICE_BY_PATTERN,
  DEFAULT_CONDITION_UNIT_PRICE,
} from '@/constants/conditionUnitPriceMaster';

export { DEFAULT_STORE_KEY };

// 計画パターン。以降のタスク（集計ソース変換・集計エンジン）でも共通で使う。
export type PlanPattern = 'marginRateFixed' | 'netFixed';

export interface ConditionUnitPriceInput {
  // NET固定は取引制度メッシュから代表サマリ商品を引く一手が先に入る
  planPattern: PlanPattern;
  // サマリ商品名（マージン率固定は必須。NET固定でも新商品等では設定される）
  summaryProduct: string;
  // 一般卸メッシュ（NET固定の定番商品で使用）
  wholesaleMesh: string;
  // 商流販売店マスタの入力キー（販売店＊採算組織第5階層＊担当エリア）
  storeKey: string;
}

export interface ConditionUnitPriceResult {
  value: number;
  representativeSummaryProduct: string;
  channelClass: string;
  directChannelCode: string;
  tier1: string;
  tier2: string;
  tier3: string;
  salesKbn: 'ドライ' | 'チルド' | '';
  patternCode: string;
  onlineProduct: string;
  // たどった抽出ステップ（マスタ名）。導出経路の説明・検証用。
  steps: string[];
}

const EMPTY_RESULT: ConditionUnitPriceResult = {
  value: 0,
  representativeSummaryProduct: '',
  channelClass: '',
  directChannelCode: '',
  tier1: '',
  tier2: '',
  tier3: '',
  salesKbn: '',
  patternCode: '',
  onlineProduct: '',
  steps: [],
};

// No.6 サマリ商品紐づけマスタ：サマリ商品 → 代表オンライン商品。
// モックはオンライン商品コードを保持しないため、サマリ商品名から決定的に採番する。
const onlineProductOf = (summaryProduct: string): string => {
  const index = SUMMARY_PRODUCT_OPTIONS.findIndex(
    (option) => option.value === summaryProduct
  );
  return index < 0 ? '' : `OL${String(index + 1).padStart(5, '0')}`;
};

export function deriveConditionUnitPrice(
  input: ConditionUnitPriceInput
): ConditionUnitPriceResult {
  const steps: string[] = [];

  // No.1 取引制度メッシュマスタ（NET固定のみ）：一般卸メッシュ → 代表サマリ商品
  let summaryProduct = input.summaryProduct;
  if (input.planPattern === 'netFixed') {
    steps.push('取引制度メッシュマスタ');
    if (!summaryProduct) {
      const mesh = WHOLESALE_MESH_OPTIONS.find(
        (option) => option.value === input.wholesaleMesh
      );
      // 取引制度メッシュのメタブランド＋容器容量Gに一致するサマリ商品を代表とする
      summaryProduct =
        SUMMARY_PRODUCT_OPTIONS.find(
          (option) =>
            option.metaBrand === mesh?.metaBrand &&
            option.containerCapacityG === mesh?.containerCapacityG
        )?.value ?? '';
    }
  }

  const master = SUMMARY_PRODUCT_OPTIONS.find(
    (option) => option.value === summaryProduct
  );
  if (!master) return { ...EMPTY_RESULT };

  // No.2 商品・商流分類紐づけマスタ：サマリ商品 → 商流分類
  steps.push('商品・商流分類紐づけマスタ');
  const channelClass =
    CHANNEL_CLASS_BY_META_BRAND[master.metaBrand] ?? DEFAULT_CHANNEL_CLASS;

  // No.3 商流販売店マスタ：商流分類＋販売店キー → 直送商流内部コード
  steps.push('商流販売店マスタ');
  const directChannelCode =
    DIRECT_CHANNEL_CODE_BY_CLASS[channelClass] ??
    DIRECT_CHANNEL_CODE_BY_CLASS[DEFAULT_CHANNEL_CLASS];

  // No.4 商流マスタ：直送商流内部コード → 一次店・二次店・三次店、売上区分
  steps.push('商流マスタ');
  const channel = CHANNEL_MASTER[directChannelCode] ?? CHANNEL_MASTER.DC1099;

  // No.5 量販経費情報マスタ：一次店・売上区分 → 条件口パターンコード
  steps.push('量販経費情報マスタ');
  const basePattern = PATTERN_CODE_BY_TIER1[channel.tier1] ?? 'V1099';
  const chilledPattern = `${basePattern}${CHILLED_PATTERN_SUFFIX}`;
  const patternCode =
    channel.salesKbn === 'チルド' &&
    CONDITION_UNIT_PRICE_BY_PATTERN[chilledPattern] !== undefined
      ? chilledPattern
      : basePattern;

  // No.6 サマリ商品紐づけマスタ：サマリ商品 → 代表オンライン商品
  steps.push('サマリ商品紐づけマスタ');
  const onlineProduct = onlineProductOf(summaryProduct);

  // No.7 単価パターンマスタ：代表オンライン商品＋条件口パターンコード → 条件口単価
  steps.push('単価パターンマスタ');
  const value =
    CONDITION_UNIT_PRICE_BY_PATTERN[patternCode] ??
    DEFAULT_CONDITION_UNIT_PRICE;

  return {
    value,
    representativeSummaryProduct: summaryProduct,
    channelClass,
    directChannelCode,
    tier1: channel.tier1,
    tier2: channel.tier2,
    tier3: channel.tier3,
    salesKbn: channel.salesKbn,
    patternCode,
    onlineProduct,
    steps,
  };
}
