// orgHierarchy（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import type { OrgItem, OrgLevel } from '@/types/organization';
import { ITEM_BY_VALUE, ORG_LEVELS } from '@/constants/orgHierarchy';

export const findOrgItem = (
  level: OrgLevel,
  value: string
): OrgItem | undefined => ITEM_BY_VALUE[level].get(value);

// 下位の値から、指定した上位階層の値を引く（同じ階層なら自分自身。見つからなければ undefined）。
export function orgAncestor(
  level: OrgLevel,
  value: string,
  upper: OrgLevel
): string | undefined {
  let lv = ORG_LEVELS.indexOf(level);
  const target = ORG_LEVELS.indexOf(upper);
  let v: string | undefined = value;
  while (v !== undefined && lv > target) {
    v = findOrgItem(ORG_LEVELS[lv], v)?.parent;
    lv -= 1;
  }
  return lv === target ? v : undefined;
}
