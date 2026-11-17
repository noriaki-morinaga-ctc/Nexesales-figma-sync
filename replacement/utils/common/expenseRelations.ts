// expenseRelations（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import {
  CAMPAIGN_CODE_PREFIX_TO_CLASS,
  EXPENSE_MANAGEMENT_CLASS_OPTIONS,
  MANAGEMENT_CODE_PREFIX_TO_CLASS,
} from '@/constants/expenseRelations';
import type { ExpenseCodePatch } from '@/types/master';

export const managementClassFromCode = (code: string): string => {
  if (!code) return '';
  return MANAGEMENT_CODE_PREFIX_TO_CLASS[code.slice(0, 2).toUpperCase()] ?? '';
};

// 管理区分に属する管理コードか
export const isManagementCodeInClass = (code: string, cls: string): boolean =>
  managementClassFromCode(code) === cls;

export const campaignClassFromCode = (code: string): string => {
  if (!code) return '';
  return CAMPAIGN_CODE_PREFIX_TO_CLASS[code.slice(0, 2).toUpperCase()] ?? '';
};

// 施策区分に属する施策コードか
export const isCampaignCodeInClass = (code: string, cls: string): boolean =>
  campaignClassFromCode(code) === cls;

// フォームの拡売費①②入力値を明細行フィールドへ展開する（シミュレーション 追加/編集/コピー共通）。
// 計画金額はGrid列 exp*PlannedAmountBefore にも複製する。
export const buildExpenseFields = (f: any) => ({
  exp1PlannedAmount: f.exp1PlannedAmount,
  exp1PlannedAmountBefore: f.exp1PlannedAmount,
  exp1PostingMonth: f.exp1PostingMonth,
  exp1ManagementCode: f.exp1ManagementCode,
  exp1AccountItem: f.exp1AccountItem,
  exp1ManagementClass: f.exp1ManagementClass,
  exp1CampaignClass: f.exp1CampaignClass,
  exp1CampaignCode: f.exp1CampaignCode,
  exp1Description: f.exp1Description,
  exp2PlannedAmount: f.exp2PlannedAmount,
  exp2PlannedAmountBefore: f.exp2PlannedAmount,
  exp2PostingMonth: f.exp2PostingMonth,
  exp2ManagementCode: f.exp2ManagementCode,
  exp2AccountItem: f.exp2AccountItem,
  exp2ManagementClass: f.exp2ManagementClass,
  exp2CampaignClass: f.exp2CampaignClass,
  exp2CampaignCode: f.exp2CampaignCode,
  exp2Description: f.exp2Description,
});

// 管理区分に対応する勘定科目を返す（未定義の区分は空文字）。
export const accountItemFromManagementClass = (cls: string): string =>
  EXPENSE_MANAGEMENT_CLASS_OPTIONS.find((o) => o.value === cls)?.accountItem ??
  '';

// 管理コード確定時：管理区分・勘定科目を補完する。
export const fillFromManagementCode = (code: string): ExpenseCodePatch => {
  const cls = managementClassFromCode(code);
  // コードをクリアした場合は管理区分・勘定科目を維持する。
  if (!cls) return { ManagementCode: code };
  const accountItem = accountItemFromManagementClass(cls);
  return {
    ManagementCode: code,
    ManagementClass: cls,
    ...(accountItem ? { AccountItem: accountItem } : {}),
  };
};

// 管理区分確定時：勘定科目を補完し、該当しない管理コードはクリアする。
export const fillFromManagementClass = (
  cls: string,
  currentCode: string
): ExpenseCodePatch => {
  const accountItem = accountItemFromManagementClass(cls);
  const keepCode = !currentCode || isManagementCodeInClass(currentCode, cls);
  return {
    ManagementClass: cls,
    ...(accountItem ? { AccountItem: accountItem } : {}),
    ManagementCode: keepCode ? currentCode : '',
  };
};

// 施策コード確定時：施策区分を補完する（施策は勘定科目を持たない）。
export const fillFromCampaignCode = (code: string): ExpenseCodePatch => {
  const cls = campaignClassFromCode(code);
  // コードをクリアした場合は施策区分を維持する。
  if (!cls) return { CampaignCode: code };
  return { CampaignCode: code, CampaignClass: cls };
};

// 施策区分確定時：該当しない施策コードはクリアする。
export const fillFromCampaignClass = (
  cls: string,
  currentCode: string
): ExpenseCodePatch => {
  const keepCode = !currentCode || isCampaignCodeInClass(currentCode, cls);
  return { CampaignClass: cls, CampaignCode: keepCode ? currentCode : '' };
};
