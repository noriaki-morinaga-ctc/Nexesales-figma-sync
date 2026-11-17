import type { PromotionAccountItem } from '@/types/master';

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
