// 商品区分（productCategory）変更に伴う明細行の組み替えロジック。
// ギフトは「上旬・中旬・下旬」の3行1セット、それ以外は1行で明細を表現するため、
// 区分をギフトへ変更したら 1行→3行、ギフトから他区分へ変更したら 3行→1行 に変換する。
// あわせてタブ振り分けに使う section と、区分に連動する販促区分も自動反映する。
// 計画詳細（マージン率固定／NET固定）・シミュレーション（同2画面）の明細表で共有する。
import { getPromotionLabels } from '../constants/promotionCategories';

// 商品区分「ギフト」のラベル。
export const GIFT_CATEGORY = 'ギフト';

// ギフトの販売期間（3行1セットの並び順）。
export const GIFT_PERIODS = ['上旬', '中旬', '下旬'];

// 販売期間の並び順インデックス（未設定・対象外は末尾扱い）。
export const giftPeriodIndex = (period?: string): number => {
  const i = GIFT_PERIODS.indexOf(period ?? '');
  return i < 0 ? GIFT_PERIODS.length : i;
};

// 商品区分に連動する販促区分を返す。
// ・特殊商品は販促区分を持たない（明細表では区分名を固定表示する）ため空文字
// ・ギフトは「ギフト」固定
// ・その他は現在値が新しい区分の選択肢に含まれていれば維持、無ければ先頭の選択肢
export function promotionForCategory(
  category: string,
  current?: string
): string {
  if (category === '特殊商品') return '';
  const labels = getPromotionLabels(category);
  if (labels.length === 0) return '';
  if (current && labels.includes(current)) return current;
  return labels[0];
}

// 明細行のうち、区分変更で組み替える対象となる項目。
export interface CategoryChangeRow {
  id?: string;
  section?: string;
  productCategory?: string;
  promotion?: string;
  period?: string;
  giftSetId?: string;
  plan?: string;
  estimate?: string;
}

export interface CategoryChangeOptions {
  /** 新しいギフトセットIDの採番 */
  newGiftSetId: () => string;
  /** ギフト化で増える2行目以降（中旬・下旬）の行IDの採番 */
  newRowId: (index: number) => string;
  /**
   * 明細表のセクション名（タブ・状態配列のキー）。既定は商品区分と同じ。
   * 量販シミュレーションのように商品区分「特売」＝セクション「特殊商品」と
   * 読み替える画面で指定する。
   */
  section?: string;
  /**
   * 販売期間ごとに持つ項目（既定：計画函数・当月着地見込）。
   * ギフト化では上旬へ寄せて中旬・下旬を空欄にし、ギフト解除では合算する。
   * シミュレーションのように変更前／変更後を持つ画面で差し替える。
   */
  periodFields?: string[];
}

// 販売期間ごとに持つ項目の既定値（計画詳細の明細表）。
export const DEFAULT_PERIOD_FIELDS = ['plan', 'estimate'];

// カンマ区切りの数値文字列を合計して文字列で返す（全て空なら空文字）。
const sumNumericStrings = (values: (string | undefined)[]): string => {
  let sum = 0;
  let found = false;
  for (const value of values) {
    const num = parseFloat(String(value ?? '').replace(/,/g, ''));
    if (Number.isFinite(num)) {
      sum += num;
      found = true;
    }
  }
  if (!found) return '';
  return String(Math.round(sum * 100) / 100);
};

// 商品区分の変更後の明細行を生成する。
// sourceRows には変更対象の明細を構成する行（ギフトはセットの3行、それ以外は1行）を渡す。
// 戻り値は置き換え後の行（ギフト化＝3行、ギフト解除・区分変更＝1行）。
// 先頭行のIDは維持するため、変更セルのハイライト記録は引き継がれる。
// サマリ商品名・一般卸メッシュなどの商品情報は変更しない（既存の選択を保持する）。
export function buildCategoryChangeRows<T extends CategoryChangeRow>(
  sourceRows: T[],
  newCategory: string,
  options: CategoryChangeOptions
): T[] {
  if (sourceRows.length === 0) return [];
  const periodFields = options.periodFields ?? DEFAULT_PERIOD_FIELDS;
  const ordered = [...sourceRows].sort(
    (a, b) => giftPeriodIndex(a.period) - giftPeriodIndex(b.period)
  );
  const base = ordered[0];
  const common: Record<string, unknown> = {
    section: options.section ?? newCategory,
    productCategory: newCategory,
    promotion: promotionForCategory(newCategory, base.promotion),
  };
  // 複数行（ギフトセット）を1行へ畳む場合のみ販売期間ごとの項目を合算する。
  const merged: Record<string, string> = {};
  periodFields.forEach((field) => {
    const values = ordered.map(
      (row) => (row as unknown as Record<string, string | undefined>)[field]
    );
    merged[field] =
      ordered.length === 1 ? (values[0] ?? '') : sumNumericStrings(values);
  });

  if (newCategory === GIFT_CATEGORY) {
    // 1行→3行：販売期間ごとの項目は上旬へ寄せ、中旬・下旬は空欄から入力させる
    // （セット合計が変わらないようにする）。
    const giftSetId = options.newGiftSetId();
    return GIFT_PERIODS.map((period, i) => {
      const periodValues: Record<string, string> = {};
      periodFields.forEach((field) => {
        periodValues[field] = i === 0 ? merged[field] : '';
      });
      return {
        ...base,
        ...common,
        ...periodValues,
        giftSetId,
        period,
        id: i === 0 ? base.id : options.newRowId(i),
      } as unknown as T;
    });
  }

  // 3行→1行（またはギフト以外どうしの区分変更）。ギフト固有の項目は解除する。
  return [
    {
      ...base,
      ...common,
      ...merged,
      giftSetId: undefined,
      period: '',
    } as unknown as T,
  ];
}
