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

// 販売店。NET固定は「その他販売店」、それ以外の取引制度は「イオンリテール」。
export const BASIC_INFO_DEALER: NameCodeValue = {
  name: 'イオンリテール',
  code: 'DLR001',
};

export const BASIC_INFO_DEALER_OTHER: NameCodeValue = {
  name: 'その他販売店',
  code: 'DLR006',
};

// 三次店企業。NET固定の基本情報にのみ表示する。
export const BASIC_INFO_TERTIARY_COMPANY: NameCodeValue = {
  name: '三菱食品株式会社',
  code: 'TSC001',
};

// 取引先補足情報マスタ_単価取得区分（補足2-2）。
// 社外売単価の導出で使う。'取得可能' なら納価をそのまま社外売単価とする（分岐No.5）。
// モックでは分岐1〜4を画面で確認できるよう '取得不可' を既定とする。
// '取得可能' にすると全行が納価分岐（No.5）に落ち、他の分岐（特殊単価・生販）が
// 画面上で一切確認できない死に枝になってしまうため、あえて '取得不可' を選んでいる。
export const UNIT_PRICE_KBN = '取得不可';
