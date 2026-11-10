// 拡売費集計「種類別」の勘定科目マスタ。
//
// コード体系：5桁の 5xxxx。51000番台＝売上連動拡売費／52000番台＝拡売費(固定費)および
// その他の直接固定費（ロケ補填・コラム料・リース料・販売器具費）。
// 下2桁が 00 の 51000／52000 が区分計、下3桁目で口（A口＝x100／B口＝x200／本社口＝x300）を表す。
// キーは集計エンジン（utils/sales-plan/common/aggregationCalc の AggAmounts）の項目キーと一致させ、
// 集計値と勘定科目の対応がずれないようにする。

export interface PromotionAccountItem {
  code: string; // 勘定科目コード
  name: string; // 勘定科目名称
}

// 拡売費（合計）は単独の勘定科目を持たないため、集計対象のコード範囲で表記する。
export const PROMOTION_ACCOUNT_ITEMS: Record<string, PromotionAccountItem> = {
  promo: { code: '51000〜52700', name: '拡売費（合計）' },
  salesLinked: { code: '51000', name: '拡売費(売上連動)' },
  salesLinkedA: { code: '51100', name: '拡売奨励金(売上連動)' },
  salesLinkedB: { code: '51200', name: '販売促進費(売上連動)' },
  salesLinkedH: { code: '51300', name: '拡売費(売上連動・本社)' },
  fixed: { code: '52000', name: '拡売費(固定費)' },
  fixedA: { code: '52100', name: '拡売費(固定費)' },
  fixedB: { code: '52200', name: '拡売費(固定費)' },
  fixedH: { code: '52300', name: '拡売費(固定費・本社)' },
  locFill: { code: '52400', name: 'ロケ補填' },
  column: { code: '52500', name: 'コラム料' },
  lease: { code: '52600', name: 'リース料' },
  equip: { code: '52700', name: '販売器具費' },
};

// 管理区分名称 → 対応する勘定科目キー。
// 拡売費計画Grid の「管理区分を選ぶと勘定科目が決まる」連動と、拡売費集計の口明細行が
// 同じ対応関係を参照できるようにする（対応表をここ1か所に集約する）。
export const ACCOUNT_KEY_BY_MANAGEMENT_CLASS: Record<string, string> = {
  売上連動拡売費A口: 'salesLinkedA',
  売上連動拡売費B口: 'salesLinkedB',
  売上連動拡売費本社口: 'salesLinkedH',
  '拡売費(固定費)A口': 'fixedA',
  '拡売費(固定費)B口': 'fixedB',
  '拡売費(固定費)本社口': 'fixedH',
};

/** 勘定科目の表示ラベル（コード＋名称）を返す。未定義キーは空文字。 */
export const promotionAccountLabel = (key: string): string => {
  const item = PROMOTION_ACCOUNT_ITEMS[key];
  return item ? `${item.code} ${item.name}` : '';
};
