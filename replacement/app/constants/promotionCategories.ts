import type { SelectOption } from '@/app/types/master';
import { getPromotionLabels } from '@/app/utils/sales-plan/common/promotionCategories';

const toOptions = (labels: string[]): SelectOption[] =>
  labels.map((label) => ({ value: label, label }));

// 商品区分 → 販促区分ラベルの対応表（特殊商品はリストなし）
export const PROMOTION_LABELS_BY_CATEGORY: Record<string, string[]> = {
  定番商品: ['定番・EDLP', 'アプリ販促', 'ポイント販促', 'リテールメディア'],
  特売: [
    'アプリ販促',
    'ポイント販促',
    'リテールメディア',
    'チラシ（日替り）',
    'チラシ（通し）',
    'エンド',
    '催事',
    '景品企画',
    '月間強化',
    '週間強化',
    '試飲会',
    '契約対策',
    '長在品',
    'その他',
  ],
  新商品: [
    'アプリ販促',
    'ポイント販促',
    'リテールメディア',
    'チラシ（日替り）',
    'チラシ（通し）',
    'エンド',
    '催事',
    '景品企画',
    '月間強化',
    '週間強化',
    '試飲会',
    '送込み',
    '店舗吸い上げ',
    '導入条件',
    'サンプリング',
    'その他',
  ],
  // ギフトは販促区分を「ギフト」のみに固定（区分名固定表示）
  ギフト: ['ギフト'],
  // 特殊商品は販促区分を「特殊商品」のみに固定（区分名固定表示）
  特殊商品: ['特殊商品'],
};

// 販促区分リストを持つ商品区分（特殊商品以外）
export const PROMOTABLE_CATEGORIES = ['定番商品', '特売', '新商品', 'ギフト'];

// 販促区分が存在しない場合に表示する記号（特殊商品など）
export const PROMOTION_NONE_LABEL = '-';

// 指定した商品区分の販促区分オプション（value/label）配列を返す
export const getPromotionOptions = (category: string): SelectOption[] =>
  toOptions(getPromotionLabels(category));

// ===== 商品区分の選択肢（画面種別ごと） =====
// マージン率固定・NET入力画面: 定番商品 / 新商品 / 特売 / ギフト
export const CATEGORY_LABELS_MARGIN = ['定番商品', '新商品', '特売', 'ギフト'];
export const CATEGORY_OPTIONS_MARGIN = toOptions(CATEGORY_LABELS_MARGIN);

// NET固定画面: 定番商品 / 新商品 / 特殊商品 / ギフト
export const CATEGORY_LABELS_NET = ['定番商品', '新商品', '特殊商品', 'ギフト'];
export const CATEGORY_OPTIONS_NET = toOptions(CATEGORY_LABELS_NET);

// NET固定（計画詳細・シミュレーション）で新規に作成できる商品区分: 新商品 / 特殊商品 / ギフト
// 定番商品は一般卸メッシュ単位で、取引制度メッシュのマスタから全行が表示されるため
// 新規追加が発生しない（補足5-2）。明細追加ペインの商品区分プルダウンと、
// グリッドの商品区分セルの選択肢から除外する。
export const CATEGORY_LABELS_NET_ADDABLE = ['新商品', '特殊商品', 'ギフト'];
export const CATEGORY_OPTIONS_NET_ADDABLE = toOptions(
  CATEGORY_LABELS_NET_ADDABLE
);

// 年間計画: 定番商品 / 特売 / 新商品 / ギフト / 特殊商品
export const CATEGORY_LABELS_ANNUAL = [
  '定番商品',
  '特売',
  '新商品',
  'ギフト',
  '特殊商品',
];
export const CATEGORY_OPTIONS_ANNUAL = toOptions(CATEGORY_LABELS_ANNUAL);
