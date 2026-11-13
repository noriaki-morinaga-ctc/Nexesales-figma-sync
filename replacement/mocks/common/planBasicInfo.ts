// 計画詳細・販売計画シミュレーション・年間計画作成ほか：計画の基本情報（チャネル・組織・作成者・販売店など）、ログインユーザー、
// 確定済みの月・取引制度の変更月、単価取得区分のモック（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。

import type { NameCodeValue, PlanBasicInfo } from '@/app/types/planDetail';
import {
  STORE_TIER_LIST,
  firstStoreCode,
  thirdStoreCode,
} from '@/mocks/common/storeTier';

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

// 計画の基本情報（モック）。取引制度の名称から作る。販売店を渡さないときは、NET固定は「その他販売店」、
// それ以外の取引制度は「イオンリテール」にする。実システムでは計画1件の基本情報を API から受け取る。
export const planBasicInfoOf = (
  tradingSystemName: string,
  dealer: NameCodeValue = tradingSystemName === 'NET固定'
    ? BASIC_INFO_DEALER_OTHER
    : BASIC_INFO_DEALER
): PlanBasicInfo => ({
  tradingSystem: {
    name: tradingSystemName,
    code: tradingSystemCode(tradingSystemName),
  },
  channel: BASIC_INFO_CHANNEL,
  office: BASIC_INFO_OFFICE,
  department: BASIC_INFO_DEPARTMENT,
  area: BASIC_INFO_AREA,
  creator: BASIC_INFO_CREATOR,
  status: BASIC_INFO_STATUS,
  noDataMonths: PLAN_NO_DATA_MONTHS,
  dealer,
  tertiaryCompany: tertiaryCompanyOf(dealer),
  storeTiers: STORE_TIER_LIST.map((tier) => ({
    first: { name: tier.first, code: firstStoreCode(tier.first) },
    third: { name: tier.third, code: thirdStoreCode(tier.third) },
  })),
});

// 計画のデータが無い月（ダミー）。対象年月のカルーセル（MonthStripPicker）でグレーにして押せなくする。
// 実システムでは計画の有無から導出する。
export const PLAN_NO_DATA_MONTHS: string[] = ['2025/07', '2026/01', '2026/04'];
