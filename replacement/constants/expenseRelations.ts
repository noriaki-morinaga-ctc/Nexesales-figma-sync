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

// ── 施策コード ↔ 施策区分 ────────────────────────────────
// 施策コードの接頭辞（2文字）が施策区分に対応する（区分ごとに別接頭辞）。
//   SN=新規導入 / SP=販売促進 / SS=スポット / SR=リピート
export const CAMPAIGN_CODE_PREFIX_TO_CLASS: Record<string, string> = {
  SN: '新規導入',
  SP: '販売促進',
  SS: 'スポット',
  SR: 'リピート',
};

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
