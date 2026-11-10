import type { NonProductExpenseData } from '../types/nonProductExpense';
import { CURRENT_USER_NAME } from './planBasicInfoMockData';

// 拡売費（非商品費用）追加・編集・コピーフォームの共通型・初期値・変換ヘルパー。
// 販売計画表（小売／卸／連携なし）で共用する単一のソース。

export type ExpenseFormValues = {
  // 共通
  summaryProduct: string;
  metaBrand: string;
  // 拡売費
  exp1ManagementCode: string;
  exp1ManagementClass: string;
  exp1AccountItem: string;
  exp1CampaignClass: string; // 施策区分（任意入力）
  exp1CampaignCode: string; // 施策コード（任意入力）
  exp1Description: string;
  exp1PlannedAmount: string;
  exp1PostingMonth: string;
};

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

// 拡売費フォームの未入力必須項目。
// 施策コード・施策区分は任意入力（拡売費計画は明細1行がキーとなるため）。
// メタブランドは販売計画表3画面のみ必須のため、options で切り替える。
export const expenseMissingFields = (
  f: any,
  options?: { metaBrandRequired?: boolean }
): string[] => {
  const m: string[] = [];
  if (options?.metaBrandRequired && !String(f.metaBrand ?? '').trim()) {
    m.push('メタブランド');
  }
  if (!String(f.exp1ManagementCode ?? '').trim()) m.push('管理コード');
  if (!String(f.exp1ManagementClass ?? '').trim()) m.push('管理区分');
  if (!String(f.exp1PlannedAmount ?? '').trim()) m.push('計画金額');
  if (!String(f.exp1PostingMonth ?? '').trim()) m.push('計上年月');
  return m;
};

// 拡売費行データ → 拡売費フォーム値（①②）へのマッピング（編集・コピーで共通）
export const toExpenseForm = (
  data: NonProductExpenseData
): ExpenseFormValues => ({
  summaryProduct: data.summaryProduct || '',
  metaBrand: data.metaBrand || '',
  exp1ManagementCode: data.exp1ManagementCode || '',
  exp1ManagementClass: data.exp1ManagementClass || '',
  exp1AccountItem: data.exp1AccountItem || '',
  exp1CampaignClass: data.exp1CampaignClass || '',
  exp1CampaignCode: data.exp1CampaignCode || '',
  exp1Description: data.exp1Description || '',
  exp1PlannedAmount:
    data.exp1PlannedAmount != null ? String(data.exp1PlannedAmount) : '',
  exp1PostingMonth: data.exp1PostingMonth || '',
});

// 拡売費フォーム値 → グリッド行データへの変換（追加・コピー・編集で共通）。
// base を渡すと no・前年実績など既存値を引き継ぐ（編集時）。
export const fromExpenseForm = (
  form: ExpenseFormValues,
  base?: NonProductExpenseData | null
): NonProductExpenseData => {
  const num = (v: string) => Number(String(v).replace(/,/g, '')) || 0;
  return {
    no: base?.no,
    isTotal: false,
    metaBrand: form.metaBrand || '',
    summaryProduct: form.summaryProduct || '',
    exp1PlannedAmount: num(form.exp1PlannedAmount),
    // 新規行・コピー行（base なし）は前年実績を持たないため削除できる。
    exp1PriorYearActual: base?.exp1PriorYearActual ?? null,
    exp1PostingMonth: form.exp1PostingMonth || '',
    exp1ManagementClass: form.exp1ManagementClass || '',
    exp1ManagementCode: form.exp1ManagementCode || '',
    exp1AccountItem: form.exp1AccountItem || '',
    exp1CampaignClass: form.exp1CampaignClass || '',
    exp1CampaignCode: form.exp1CampaignCode || '',
    exp1Description: form.exp1Description || '',
    // 追加・コピーはログインユーザーを作成者にする（編集時は元の作成者を保持）。
    exp1Creator: base?.exp1Creator ?? CURRENT_USER_NAME,
  };
};
