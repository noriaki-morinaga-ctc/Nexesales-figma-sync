// nonProductExpenseForm（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import type {
  ExpenseFormValues,
  NonProductExpenseData,
} from '@/app/types/nonProductExpense';

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
// base を渡すと no・前年実績など既存値を引き継ぐ（編集時）。creator は追加・コピーで作成者にするログインユーザー名。
export const fromExpenseForm = (
  form: ExpenseFormValues,
  creator: string,
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
    exp1Creator: base?.exp1Creator ?? creator,
  };
};
