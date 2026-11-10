// 計画系画面（計画詳細／販売計画シミュレーション）の基本情報エリアに表示する参照専用値。
// 実データ連携までのモック。画面では joinCodeName() で「コード:名称」に整形して表示する。

// 参照専用項目の名称とコードの組。
export interface NameCodeValue {
  name: string;
  code: string;
}

// 取引制度。画面ごとに値が異なるため、名称からコードを引く。
const TRADING_SYSTEM_CODES: Record<string, string> = {
  マージン率固定: 'TS001',
  NET固定: 'TS002',
};

// 取引制度の名称に対応するコードを返す（未定義の名称は空文字）。
export function tradingSystemCode(name: string): string {
  return TRADING_SYSTEM_CODES[name] ?? '';
}

export const BASIC_INFO_CHANNEL: NameCodeValue = {
  name: '全国',
  code: 'CH000',
};

export const BASIC_INFO_OFFICE: NameCodeValue = {
  name: '首都圏本部',
  code: 'OFC001',
};

export const BASIC_INFO_DEPARTMENT: NameCodeValue = {
  name: '首都圏営業第二部',
  code: 'DEP002',
};

export const BASIC_INFO_AREA: NameCodeValue = { name: '首都圏', code: 'AR10' };

export const BASIC_INFO_CREATOR: NameCodeValue = {
  name: 'アサヒ　太郎',
  code: 'EMP010',
};

// ログインユーザー名。グリッドで行を追加したときの作成者列に自動設定する。
export const CURRENT_USER_NAME: string = BASIC_INFO_CREATOR.name;

// 計画のステータス。基本情報エリアに表示する参照専用値で、
// モックでは申請前の初期状態＝「未申請」を全画面共通で表示する。
export const BASIC_INFO_STATUS = '未申請';

// 確定・未承認確定の月（ダミー）。実際は月次計画のステータスで判定する。
// 詳細の初期値（当年1月）の扱いが未確定のため、初期値と重ならない月にしている。
export const SIMULATION_CLOSED_MONTHS = [2, 3].map(
  (month) => `${new Date().getFullYear()}/${String(month).padStart(2, '0')}`
);

// 年の途中で取引制度を変更した計画の、変更後の最初の対象年月（ダミー）。実際は計画単位マスタから導出する。
const TRADING_SYSTEM_CHANGED_FROM = '2025/12';

// 取引制度を変更した後の対象年月か。その年の変更後の月は、シミュレーション・年間計画作成を
// 使用できない（10/27 第4回 決定事項28）。
export const isAfterTradingSystemChange = (yearMonth: string): boolean =>
  yearMonth.slice(0, 4) === TRADING_SYSTEM_CHANGED_FROM.slice(0, 4) &&
  yearMonth >= TRADING_SYSTEM_CHANGED_FROM;

// 販売店。NET固定は「その他販売店」、それ以外の取引制度は「イオンリテール」。
export const BASIC_INFO_DEALER: NameCodeValue = {
  name: 'イオンリテール',
  code: 'DLR001',
};

export const BASIC_INFO_DEALER_OTHER: NameCodeValue = {
  name: 'その他販売店',
  code: 'DLR006',
};

// 三次店企業。販売店が「その他販売店」の計画だけ表示する（10/20 第2回 決定事項11）。
export const BASIC_INFO_TERTIARY_COMPANY: NameCodeValue = {
  name: '三菱食品株式会社',
  code: 'TSC001',
};

// 販売店に対応する三次店企業。「その他販売店」以外の計画は値を持たない（画面は「-」）。
export const tertiaryCompanyOf = (
  dealer: NameCodeValue
): NameCodeValue | null =>
  dealer.code === BASIC_INFO_DEALER_OTHER.code
    ? BASIC_INFO_TERTIARY_COMPANY
    : null;

// 取引先補足情報マスタ_単価取得区分（補足2-2）。
// 社外売単価の導出で使う。'取得可能' なら納価をそのまま社外売単価とする（分岐No.5）。
// モックでは分岐1〜4を画面で確認できるよう '取得不可' を既定とする。
// '取得可能' にすると全行が納価分岐（No.5）に落ち、他の分岐（特殊単価・生販）が
// 画面上で一切確認できない死に枝になってしまうため、あえて '取得不可' を選んでいる。
export const UNIT_PRICE_KBN = '取得不可';
