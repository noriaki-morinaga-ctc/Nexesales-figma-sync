// 原価軸と実原価の閲覧制御 ─ 新_補足2-3「原価情報の統一と実原価の閲覧制御」。
//
// 売上原価（集計）＝ 売上原価単価 × 入数 × 函数(計画) の集計（FR-0074-14）。
// 用いる原価単価は閲覧権限に応じた原価軸で決まる。
//   ・権限あり（FR-0074-10）：実原価ベース／支社受渡原価ベースを任意に切替できる
//   ・権限なし（FR-0074-11）：支社受渡原価ベースのみ。切替操作を画面に出さない
// 権限は採算組織第5階層（部署）単位で設定する（FR-0074-06）。
//
// ※ 支社受渡原価は productMasters の costOfSales（商品支社受渡バラ保証金抜き価格）。
//    実原価は「オンラインCD × 年間計」の粒度で持つ想定だが本モックではマスタを持たず、
//    ACTUAL_COST_FACTOR を乗じたダミー値で代替する。
import { ACTUAL_COST_FACTOR } from '../../../constants/aggregationMasterDummy';

// 原価軸。transfer=支社受渡原価 / actual=実原価。
export type CostAxis = 'transfer' | 'actual';

// 画面表示用ラベル
export const COST_AXIS_LABELS: Record<CostAxis, string> = {
  transfer: '支社受渡原価',
  actual: '実原価',
};

// 実原価の閲覧権限を付与する想定部署（FR-0074-08）。
export const ACTUAL_COST_VIEWER_DEPARTMENTS: readonly string[] = [
  '本社 営業統括部統括企画G',
  '本社 広域流通部CVS第一G',
  '本社 広域流通部CVS第二G',
  '本社 広域流通部CVS第三G',
  '本社 e-コマース部',
];

// ログインユーザーの所属部署（モック）。切替トグルの表示可否の既定判定に使う。
export const CURRENT_USER_DEPARTMENT = '本社 広域流通部CVS第一G';

// 指定部署が実原価を閲覧できるか。
export const canViewActualCost = (
  department: string = CURRENT_USER_DEPARTMENT
): boolean => ACTUAL_COST_VIEWER_DEPARTMENTS.includes(department);

// 要求された原価軸を権限で解決する。権限が無ければ支社受渡原価へ倒す（FR-0074-11）。
export const resolveCostAxis = (
  requested: CostAxis,
  department: string = CURRENT_USER_DEPARTMENT
): CostAxis => (canViewActualCost(department) ? requested : 'transfer');

// 支社受渡原価（マスタ値）から、指定軸の売上原価単価を返す。
// マスタが引けない行（NaN）は 0 として扱い、集計を壊さない。
export const costUnitPriceOfAxis = (
  transferCost: number,
  axis: CostAxis
): number => {
  if (!Number.isFinite(transferCost)) return 0;
  return axis === 'actual' ? transferCost * ACTUAL_COST_FACTOR : transferCost;
};
