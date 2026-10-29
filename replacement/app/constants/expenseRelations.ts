// 拡売費の「管理コード↔管理区分」「施策コード↔施策区分」の対応関係を集約する。
// データ側に明示的な対応が無いため、ここで関係を定義し全画面（販売計画表・シミュレーション）で共用する。

// ── 管理コード ↔ 管理区分 ────────────────────────────────
// 管理コードの接頭辞（2文字）が管理区分に対応する。
//   RA=売上連動拡売費A口 / RB=売上連動拡売費B口 / RH=売上連動拡売費本社口
//   FA=拡売費(固定費)A口 / FB=拡売費(固定費)B口 / FH=拡売費(固定費)本社口
//   LC=ロケ補填 / CL=コラム料 / LS=リース料 / EQ=販売器具費
//   （後半4区分は補足3-1 No.22〜24・31 の集計対象。変動費・自販機関連費に集計する）
export const MANAGEMENT_CODE_PREFIX_TO_CLASS: Record<string, string> = {
  RA: '売上連動拡売費A口',
  RB: '売上連動拡売費B口',
  RH: '売上連動拡売費本社口',
  FA: '拡売費(固定費)A口',
  FB: '拡売費(固定費)B口',
  FH: '拡売費(固定費)本社口',
  LC: 'ロケ補填',
  CL: 'コラム料',
  LS: 'リース料',
  EQ: '販売器具費',
};

export const managementClassFromCode = (code: string): string => {
  if (!code) return '';
  return MANAGEMENT_CODE_PREFIX_TO_CLASS[code.slice(0, 2).toUpperCase()] ?? '';
};

// 管理区分に属する管理コードか
export const isManagementCodeInClass = (code: string, cls: string): boolean =>
  managementClassFromCode(code) === cls;

// ── 施策コード ↔ 施策区分 ────────────────────────────────
// 施策コードの接頭辞（2文字）が施策区分に対応する（区分ごとに別接頭辞）。
//   SN=新規導入 / SP=販売促進 / SS=スポット / SR=リピート
export const CAMPAIGN_CODE_PREFIX_TO_CLASS: Record<string, string> = {
  SN: '新規導入',
  SP: '販売促進',
  SS: 'スポット',
  SR: 'リピート',
};

export const campaignClassFromCode = (code: string): string => {
  if (!code) return '';
  return CAMPAIGN_CODE_PREFIX_TO_CLASS[code.slice(0, 2).toUpperCase()] ?? '';
};

// 施策区分に属する施策コードか
export const isCampaignCodeInClass = (code: string, cls: string): boolean =>
  campaignClassFromCode(code) === cls;

// ── 拡売費の選択肢（全画面共通。各 mockData から re-export して一元管理） ──────
export const EXPENSE_MANAGEMENT_CODE_OPTIONS = [
  { value: 'RA001' },
  { value: 'RA002' },
  { value: 'RB001' },
  { value: 'RB002' },
  { value: 'RH001' },
  { value: 'RH002' },
  { value: 'FA001' },
  { value: 'FA002' },
  { value: 'FB001' },
  { value: 'FB002' },
  { value: 'FH001' },
  { value: 'FH002' },
  { value: 'LC001' },
  { value: 'LC002' },
  { value: 'CL001' },
  { value: 'LS001' },
  { value: 'EQ001' },
];

export const EXPENSE_MANAGEMENT_CLASS_OPTIONS = [
  { value: '売上連動拡売費A口', accountItem: '販促費' },
  { value: '売上連動拡売費B口', accountItem: '販促費' },
  { value: '売上連動拡売費本社口', accountItem: '販促費' },
  { value: '拡売費(固定費)A口', accountItem: '販促費' },
  { value: '拡売費(固定費)B口', accountItem: '販促費' },
  { value: '拡売費(固定費)本社口', accountItem: '販促費' },
  { value: 'ロケ補填', accountItem: '販促費' },
  { value: 'コラム料', accountItem: '販促費' },
  { value: 'リース料', accountItem: '販促費' },
  { value: '販売器具費', accountItem: '販促費' },
];

export const EXPENSE_ACCOUNT_ITEM_OPTIONS = [
  { value: '販促費' },
  { value: '広告費' },
];

export const EXPENSE_CAMPAIGN_CLASS_OPTIONS = [
  { value: '新規導入' },
  { value: '販売促進' },
  { value: 'スポット' },
  { value: 'リピート' },
];

export const EXPENSE_CAMPAIGN_CODE_OPTIONS = [
  { value: 'SN001' },
  { value: 'SN002' },
  { value: 'SN003' },
  { value: 'SN004' },
  { value: 'SP001' },
  { value: 'SP002' },
  { value: 'SP003' },
  { value: 'SS001' },
  { value: 'SS002' },
  { value: 'SS003' },
  { value: 'SR001' },
  { value: 'SR002' },
  { value: 'SR003' },
];

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

// ── 区分／コードの自動補完（Grid・拡売費追加ペインで共用） ──────────────
// 補完結果は「接頭辞なしのキー」を持つパッチで返す。呼び出し側で exp1/exp2 を付けて適用する。
// キーを省略した項目は「現在値を維持する」意味になる（コードをクリアしても区分は残す既存挙動）。

export interface ExpenseCodePatch {
  ManagementCode?: string;
  ManagementClass?: string;
  AccountItem?: string;
  CampaignCode?: string;
  CampaignClass?: string;
}

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
