// 条件口単価の導出（新_補足4-2）で参照するマスタのダミー。
//
// 補足4-2 付録2 の抽出ステップ No.1〜7 に対応するマスタを、
// 商品マスタ（productMasters）から機械的に導けるダミーとして定義する。
// 実システムでは各マスタが独立したテーブルになるが、モックでは
// 「同じ入力からは常に同じ結果が返る」ことだけを保証する。

// 商流販売店マスタを引くときの入力キー（販売店＊採算組織第5階層＊担当エリア）。
// モックは単一の商流のみを扱うため固定値。
export const DEFAULT_STORE_KEY = 'ライフコーポレーション＊首都圏第1部＊東京東';

// No.2 商品・商流分類紐づけマスタ：サマリ商品のメタブランド → 商流分類
export const CHANNEL_CLASS_BY_META_BRAND: Record<string, string> = {
  三ツ矢: 'CC01_炭酸',
  三ツ矢特濃: 'CC01_炭酸',
  ウィルキンソン: 'CC01_炭酸',
  十六茶: 'CC02_茶系',
  和紅茶: 'CC02_茶系',
  ワンダ: 'CC03_コーヒー',
  カルピス: 'CC04_乳性',
  モンスター: 'CC05_栄養',
  ドデカミン: 'CC05_栄養',
  バヤリース: 'CC06_果汁',
  水: 'CC07_ミネラルウォーター',
  PB商品: 'CC08_PB',
};
export const DEFAULT_CHANNEL_CLASS = 'CC99_その他';

// No.3 商流販売店マスタ：商流分類 × 販売店キー → 直送商流内部コード
// （＝一次店〜五次店の組合せコード）
export const DIRECT_CHANNEL_CODE_BY_CLASS: Record<string, string> = {
  CC01_炭酸: 'DC1001',
  CC02_茶系: 'DC1002',
  CC03_コーヒー: 'DC1003',
  CC04_乳性: 'DC1004',
  CC05_栄養: 'DC1005',
  CC06_果汁: 'DC1006',
  CC07_ミネラルウォーター: 'DC1007',
  CC08_PB: 'DC1008',
  CC99_その他: 'DC1099',
};

// No.4 商流マスタ：直送商流内部コード → 一次店・二次店・三次店、売上区分
export interface ChannelMasterRecord {
  tier1: string; // 一次店
  tier2: string; // 二次店
  tier3: string; // 三次店
  salesKbn: 'ドライ' | 'チルド';
}

export const CHANNEL_MASTER: Record<string, ChannelMasterRecord> = {
  DC1001: {
    tier1: '国分グループ本社',
    tier2: '国分首都圏',
    tier3: 'ライフコーポレーション',
    salesKbn: 'ドライ',
  },
  DC1002: {
    tier1: '三菱食品',
    tier2: '三菱食品 首都圏支社',
    tier3: 'ライフコーポレーション',
    salesKbn: 'ドライ',
  },
  DC1003: {
    tier1: '日本アクセス',
    tier2: '日本アクセス 東日本',
    tier3: 'ライフコーポレーション',
    salesKbn: 'ドライ',
  },
  DC1004: {
    tier1: '日本アクセス',
    tier2: '日本アクセス 東日本',
    tier3: 'ライフコーポレーション',
    salesKbn: 'チルド',
  },
  DC1005: {
    tier1: '伊藤忠食品',
    tier2: '伊藤忠食品 東京',
    tier3: 'ライフコーポレーション',
    salesKbn: 'ドライ',
  },
  DC1006: {
    tier1: '加藤産業',
    tier2: '加藤産業 関東',
    tier3: 'ライフコーポレーション',
    salesKbn: 'ドライ',
  },
  DC1007: {
    tier1: '国分グループ本社',
    tier2: '国分首都圏',
    tier3: 'ライフコーポレーション',
    salesKbn: 'ドライ',
  },
  DC1008: {
    tier1: 'ライフコーポレーション',
    tier2: 'ライフコーポレーション',
    tier3: 'ライフコーポレーション',
    salesKbn: 'ドライ',
  },
  DC1099: {
    tier1: 'その他卸',
    tier2: 'その他卸',
    tier3: 'ライフコーポレーション',
    salesKbn: 'ドライ',
  },
};

// No.5 量販経費情報マスタ：一次店＋売上区分 → 条件口パターンコード
export const PATTERN_CODE_BY_TIER1: Record<string, string> = {
  国分グループ本社: 'V1010',
  三菱食品: 'V1020',
  日本アクセス: 'V1030',
  伊藤忠食品: 'V1040',
  加藤産業: 'V1050',
  ライフコーポレーション: 'V1060',
  その他卸: 'V1099',
};
export const CHILLED_PATTERN_SUFFIX = 'C';

// No.7 単価パターンマスタ：条件口パターンコード → 条件口単価（円／バラ1本）
export const CONDITION_UNIT_PRICE_BY_PATTERN: Record<string, number> = {
  V1010: 6,
  V1020: 7,
  V1030: 8,
  V1040: 7.5,
  V1050: 6.5,
  V1060: 4,
  V1099: 5,
  V1030C: 9,
  V1040C: 8.5,
};
export const DEFAULT_CONDITION_UNIT_PRICE = 5;
