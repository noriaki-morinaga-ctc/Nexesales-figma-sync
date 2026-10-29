// 計画詳細(手売り) の削除確認ペインに並べる項目の単一の情報源。
// 明細削除は「補足5-1.計画詳細の表示、KEY項目」の販売計画更新KEYを、
// 拡売費削除は拡売費グリッドと同じ並び（メタブランド～摘要1(社内用)）を並べ、
// マージン率固定・NET入力／NET固定／拡売費計画(紐づき無し)の3画面で同じ並びを使う。

import type { DeleteConfirmItem } from '../components/ui/delete-confirm-pane';
import type { NonProductExpenseData } from './nonProductExpenseTypes';
import {
  campaignClassCodeOf,
  campaignCodeNameOf,
  managementClassCodeOf,
  managementCodeNameOf,
  metaBrandCodeName,
  promotionCodeName,
  summaryProductCodeName,
} from './comboFieldOptions';
import { GIFT_PERIODS } from '../utils/productCategoryChange';
import { toMonthLabel } from '../utils/yearMonth';

// 値なしの表示（グリッドの空欄表示に合わせる）
const DASH = '-';

// 空文字・null を「-」に落とす
const orDash = (value: unknown): string => {
  const text = String(value ?? '').trim();
  return text === '' ? DASH : text;
};

// 金額の表示整形（拡売費グリッドの計画金額と同じ丸め）
const formatAmount = (value: number | null | undefined): string =>
  value == null
    ? DASH
    : value.toLocaleString('ja-JP', { maximumFractionDigits: 2 });

// 削除確認ペインが参照する明細行の項目（マージン率固定・NET固定で型が別のため構造で受ける）
export interface PlanDetailKeyRow {
  productCategory?: string;
  summaryProduct?: string;
  wholesaleMesh?: string;
  promotion?: string;
  net?: string;
}

// 取引制度の別。マージン率固定とNET入力はKEYが同一のため1画面＝1種別として扱う。
export type PlanTradingSystemKind = 'marginNet' | 'netFixed';

// 販売計画(詳細)の業務KEY項目（補足5-1）。
// ・マージン率固定／NET入力：対象年月、サマリ商品名、商品区分、販促区分（ギフトは＋販売期間）
// ・NET固定：対象年月、サマリ商品名（定番商品のみ一般卸メッシュ）、商品区分、販促区分
//   ＋特殊商品はNET、ギフトは販売期間・NET
// ギフトは上旬・中旬・下旬の3行1セットをまとめて削除するため、販売期間は3期間を並べる。
export function planDetailKeyItems(
  kind: PlanTradingSystemKind,
  row: PlanDetailKeyRow | undefined,
  targetYearMonth: string
): DeleteConfirmItem[] {
  const category = row?.productCategory ?? '';
  const isGift = category === 'ギフト';
  const items: DeleteConfirmItem[] = [
    { label: '対象年月', value: orDash(toMonthLabel(targetYearMonth)) },
  ];

  // NET固定の定番商品だけはサマリ商品名を持たず、一般卸メッシュがKEYになる
  if (kind === 'netFixed' && category === '定番商品') {
    items.push({ label: '一般卸メッシュ', value: orDash(row?.wholesaleMesh) });
  } else {
    items.push({
      label: 'サマリ商品名',
      value: summaryProductCodeName(row?.summaryProduct),
    });
  }

  items.push({ label: '商品区分', value: orDash(category) });
  items.push({ label: '販促区分', value: promotionCodeName(row) });

  if (isGift) {
    items.push({ label: '販売期間', value: GIFT_PERIODS.join('・') });
  }

  // NET固定の特殊商品・ギフトはNETを手入力するためKEYに含まれる
  if (kind === 'netFixed' && (category === '特殊商品' || isGift)) {
    items.push({ label: 'NET', value: orDash(row?.net) });
  }

  return items;
}

// 拡売費削除確認ペインの表示切り替え。
// 作成者は拡売費計画(紐づき無し)だけが表示するため、画面側から明示的に指定する。
export interface ExpenseDeleteOptions {
  showCreator?: boolean;
}

// 拡売費計画の削除確認ペインの項目。
// 削除対象を特定できるよう、拡売費グリッドと同じ並びで
// メタブランド～摘要1(社内用)を表示する（前年実績・実績金額は表示しない）。
// 区分／コードは行が片側だけを保持するため、対になる値は相互変換ヘルパーで導出する。
export function expenseDeleteItems(
  row: NonProductExpenseData | undefined,
  options: ExpenseDeleteOptions = {}
): DeleteConfirmItem[] {
  const managementClass = row?.exp1ManagementClass ?? '';
  const managementCode = row?.exp1ManagementCode ?? '';
  const campaignClass = row?.exp1CampaignClass ?? '';
  const campaignCode = row?.exp1CampaignCode ?? '';

  const items: DeleteConfirmItem[] = [
    { label: 'メタブランド', value: metaBrandCodeName(row?.metaBrand) },
    {
      label: 'サマリ商品名',
      value: summaryProductCodeName(row?.summaryProduct),
    },
    { label: '計画金額', value: formatAmount(row?.exp1PlannedAmount) },
    { label: '計上年月', value: orDash(row?.exp1PostingMonth) },
    {
      label: '管理区分',
      value: orDash(managementClassCodeOf(managementClass)),
    },
    { label: '管理区分名称', value: orDash(managementClass) },
    { label: '管理コード', value: orDash(managementCode) },
    {
      label: '管理コード名称',
      value: orDash(managementCodeNameOf(managementCode)),
    },
    { label: '施策区分', value: orDash(campaignClassCodeOf(campaignClass)) },
    { label: '施策区分名称', value: orDash(campaignClass) },
    { label: '施策コード', value: orDash(campaignCode) },
    {
      label: '施策コード名称',
      value: orDash(campaignCodeNameOf(campaignCode)),
    },
    { label: '摘要1(社内用)', value: orDash(row?.exp1Description) },
  ];

  if (options.showCreator) {
    items.push({ label: '作成者', value: orDash(row?.exp1Creator) });
  }

  return items;
}

// 削除確認ペインが参照するシミュレーション明細行の項目。
export interface SimulationKeyRow extends PlanDetailKeyRow {
  targetMonth?: string;
  campaign?: string;
  probability?: string;
}

// シミュレーション(詳細)の業務KEY項目（補足5-2）。
// ・マージン率固定／NET入力：対象年月、企画、確度、サマリ商品名、商品区分、販促区分
// ・NET固定：同上。ただし定番商品はサマリ商品名ではなく一般卸メッシュ。
// ・いずれもギフトは販売期間が加わる（上旬・中旬・下旬の3行1セットをまとめて削除する）。
export function simulationKeyItems(
  kind: PlanTradingSystemKind,
  row: SimulationKeyRow | undefined
): DeleteConfirmItem[] {
  const category = row?.productCategory ?? '';
  const items: DeleteConfirmItem[] = [
    { label: '対象年月', value: orDash(toMonthLabel(row?.targetMonth ?? '')) },
    { label: '企画', value: orDash(row?.campaign) },
    { label: '確度', value: orDash(row?.probability) },
  ];

  if (kind === 'netFixed' && category === '定番商品') {
    items.push({ label: '一般卸メッシュ', value: orDash(row?.wholesaleMesh) });
  } else {
    items.push({
      label: 'サマリ商品名',
      value: summaryProductCodeName(row?.summaryProduct),
    });
  }

  items.push({ label: '商品区分', value: orDash(category) });
  items.push({ label: '販促区分', value: promotionCodeName(row) });

  if (category === 'ギフト') {
    items.push({ label: '販売期間', value: GIFT_PERIODS.join('・') });
  }

  return items;
}

// シミュレーション明細が持つ拡売費①②（接頭辞 exp1/exp2）。
export interface SimulationExpenseRow {
  [key: string]: unknown;
}

// シミュレーション明細の計画金額は「変更前金額」を計画金額へ改称した経緯があり、
// 保持する項目名が PlannedAmountBefore のままのため定数で参照先をそろえる。
const PLANNED_AMOUNT_SUFFIX = 'PlannedAmountBefore';

// 拡売費①／②のうち、その拡売費に固有の値（接頭辞つき）を取り出す。
const expenseValue = (
  row: SimulationExpenseRow | undefined,
  prefix: 'exp1' | 'exp2',
  suffix: string
): string => String(row?.[`${prefix}${suffix}`] ?? '');

// 拡売費①／②の内訳（補足5-2 ■拡売費）。
// 削除対象を特定できるよう、シミュレーション明細の拡売費列と同じ並びで
// 計画金額～摘要1(社内用)を表示する。
// 計画金額はグリッドの編集対象と同じ PlannedAmountBefore を参照する。
// 区分／コードは行が片側だけを保持するため、対になる値は相互変換ヘルパーで導出する。
export function simulationExpenseItems(
  row: SimulationExpenseRow | undefined,
  prefix: 'exp1' | 'exp2'
): DeleteConfirmItem[] {
  const managementClass = expenseValue(row, prefix, 'ManagementClass');
  const managementCode = expenseValue(row, prefix, 'ManagementCode');
  const campaignClass = expenseValue(row, prefix, 'CampaignClass');
  const campaignCode = expenseValue(row, prefix, 'CampaignCode');

  return [
    {
      label: '計画金額',
      value: orDash(expenseValue(row, prefix, PLANNED_AMOUNT_SUFFIX)),
    },
    {
      label: '計上年月',
      value: orDash(expenseValue(row, prefix, 'PostingMonth')),
    },
    {
      label: '管理区分',
      value: orDash(managementClassCodeOf(managementClass)),
    },
    { label: '管理区分名称', value: orDash(managementClass) },
    { label: '管理コード', value: orDash(managementCode) },
    {
      label: '管理コード名称',
      value: orDash(managementCodeNameOf(managementCode)),
    },
    { label: '施策区分', value: orDash(campaignClassCodeOf(campaignClass)) },
    { label: '施策区分名称', value: orDash(campaignClass) },
    { label: '施策コード', value: orDash(campaignCode) },
    {
      label: '施策コード名称',
      value: orDash(campaignCodeNameOf(campaignCode)),
    },
    {
      label: '摘要1(社内用)',
      value: orDash(expenseValue(row, prefix, 'Description')),
    },
  ];
}

// 拡売費①／②に1つでも入力があるか（未入力のブロックは内訳を畳んで「-」1行にする）。
export function hasSimulationExpense(
  row: SimulationExpenseRow | undefined,
  prefix: 'exp1' | 'exp2'
): boolean {
  return [PLANNED_AMOUNT_SUFFIX, 'PostingMonth'].some(
    (suffix) => expenseValue(row, prefix, suffix).trim() !== ''
  );
}
