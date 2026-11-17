import type { ExpenseFormValues } from '@/types/nonProductExpense';

export const EMPTY_EXPENSE_FORM: ExpenseFormValues = {
  summaryProduct: '',
  metaBrand: '',
  exp1ManagementCode: '',
  exp1ManagementClass: '',
  exp1AccountItem: '',
  exp1CampaignClass: '',
  exp1CampaignCode: '',
  exp1Description: '',
  exp1PlannedAmount: '',
  exp1PostingMonth: '',
};

// 拡売費のメタブランド既定値。販売計画表（小売／卸／紐づき無し）の追加ペインで
// 初期選択にする。EMPTY_EXPENSE_FORM 自体は他画面（引当・支払）も使うため変更せず、
// 呼び出し側でこの値を渡して適用範囲を閉じる。
export const DEFAULT_META_BRAND = 'ブランド横断(全商品)';
