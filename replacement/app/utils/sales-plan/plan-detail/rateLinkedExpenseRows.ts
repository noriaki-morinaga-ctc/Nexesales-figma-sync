// 拡売費計画グリッドに表示する年契基本分・取組強化マージンの行を組み立てる。
//
// 年契基本分・取組強化マージンは拡売費計画の合計を集計表の拡売費計画と一致させるため、
// グリッドの最上段（合計行の直下）に非活性の行で表示する（課題「年契基本分・取組強化マージン反映方法検討」）。
// 計上年月だけは活性とし、初期値（対象年月の翌月）をグリッドで上書きできる。変更は右ペインの設定へ反映する。
// 拡売費の明細とは別に持ち、金額は右ペインの率設定から算出する（明細には含めないため集計表へ二重に計上しない）。
//
// 【想定】種別は施策区分・施策コードで識別する方針（2026-10-08 ASD回答）だが、施策の値が未定のため、
// サマリ商品名の欄に「年契基本分」「取組強化マージン」と表示する。メタブランドは空欄とする。
import type { NonProductExpenseData } from '@/app/types/nonProductExpense';
import { addMonths } from '@/app/utils/common/yearMonth';

// 右ペインで設定する経費の反映先（管理区分・管理コードは「コード:名称」）
export interface RateLinkedExpenseSetting {
  managementClass: string;
  managementCode: string;
  postingMonth: string; // YYYY/MM
  campaignClass: string;
  campaignCode: string;
}

// 右ペインを更新する前の初期値（ペインの初期値と同じ。10/8 ASD資料）。計上月は対象年月の翌月。
export const defaultRateLinkedExpenseSetting = (
  targetYearMonth: string
): RateLinkedExpenseSetting => ({
  managementClass: '1C5:年契・短契（売上連動）',
  managementCode: '10015:支社A卸部門',
  postingMonth: addMonths(targetYearMonth, 1),
  campaignClass: '',
  campaignCode: '',
});

// 右ペインの更新結果（RateInputResult）から反映先を取り出す
export const toRateLinkedExpenseSetting = (result: {
  managementClass: string;
  managementCode: string;
  postingMonth: string;
  campaign?: { campaignClass: string; campaignCode: string };
}): RateLinkedExpenseSetting => ({
  managementClass: result.managementClass,
  managementCode: result.managementCode,
  postingMonth: result.postingMonth,
  campaignClass: result.campaign?.campaignClass ?? '',
  campaignCode: result.campaign?.campaignCode ?? '',
});

// 「コード:名称」をコードと名称に分ける（区切りが無ければ全体を名称とみなす）
const splitCodeName = (value: string): [string, string] => {
  const i = value.indexOf(':');
  return i < 0 ? ['', value] : [value.slice(0, i), value.slice(i + 1)];
};

const LABELS: Record<'annualContract' | 'incentive', string> = {
  annualContract: '年契基本分',
  incentive: '取組強化マージン',
};

export interface RateLinkedExpenseInput {
  kind: 'annualContract' | 'incentive';
  // 対象年月に算出した金額（円）
  amount: number;
  setting: RateLinkedExpenseSetting;
}

// 金額が0の項目は行を出さない（削除したいときは右ペインで0にする）
export function buildRateLinkedExpenseRows(
  inputs: RateLinkedExpenseInput[]
): NonProductExpenseData[] {
  return inputs
    .map(({ kind, amount, setting }) => ({
      kind,
      amount: Math.round(amount),
      setting,
    }))
    .filter(({ amount }) => amount !== 0)
    .map(({ kind, amount, setting }) => {
      const [classCode, className] = splitCodeName(setting.managementClass);
      const [code, codeName] = splitCodeName(setting.managementCode);
      return {
        _rateLinked: kind,
        metaBrand: '',
        summaryProduct: LABELS[kind],
        exp1PlannedAmount: amount,
        // 前年実績は引当処理（PRIME連携）したものを表示する（9/29 ASD資料 p.6）。モックでは持たない
        exp1PriorYearActual: null,
        exp1PaymentActual: null,
        exp1PostingMonth: setting.postingMonth,
        exp1ManagementClass: className,
        exp1ManagementCode: code,
        _managementClassCode: classCode,
        _managementCodeName: codeName,
        exp1AccountItem: '',
        exp1CampaignClass: setting.campaignClass,
        exp1CampaignCode: setting.campaignCode,
        exp1Description: '',
        exp1Creator: '',
      };
    });
}
