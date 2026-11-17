// 計画詳細の共通部品（features/sales-plan/shared/plan-detail/）で使う型。部品どうしが型のために参照し合わないよう、types/ に置く。

export interface MarginRate {
  tier1: string;
  tier3: string;
  rate: number;
}

// 計画系画面（計画詳細／販売計画シミュレーション）の基本情報エリアに表示する参照専用値。
// 実データ連携までのモック。画面では joinCodeName() で「コード:名称」に整形して表示する。

// 参照専用項目の名称とコードの組。
export interface NameCodeValue {
  name: string;
  code: string;
}

// 基本情報エリアの三次店・一次店の組（コード＋名称）
export interface PlanStoreTier {
  first: NameCodeValue;
  third: NameCodeValue;
}

// 計画の基本情報（計画詳細・販売計画シミュレーション・年間計画作成の基本情報エリアに表示する参照専用の値）
export interface PlanBasicInfo {
  /** 取引制度 */
  tradingSystem: NameCodeValue;
  /** チャネル */
  channel: NameCodeValue;
  /** 事業所 */
  office: NameCodeValue;
  /** 部署 */
  department: NameCodeValue;
  /** 担当エリア */
  area: NameCodeValue;
  /** 作成者 */
  creator: NameCodeValue;
  /** 計画のステータス */
  status: string;
  /** 計画のデータが無い月（YYYY/MM）。対象年月のカルーセルで押せなくする */
  noDataMonths: string[];
  /** 販売店 */
  dealer: NameCodeValue;
  /** 三次店企業（販売店が「その他販売店」の計画だけ持つ。無ければ null で画面は「-」） */
  tertiaryCompany: NameCodeValue | null;
  /** 三次店・一次店の組 */
  storeTiers: PlanStoreTier[];
}

// 削除確認ペインが参照する明細行の項目（マージン率固定・NET固定で型が別のため構造で受ける）
export interface PlanDetailKeyRow {
  productCategory?: string;
  summaryProduct?: string;
  wholesaleMesh?: string;
  promotion?: string;
  net?: string;
}

// 取引制度の別。マージン率固定とNET入力はKEYが同一のため1画面＝1種別として扱う。
export type PlanTradingSystemKind = 'marginNet' | 'netFixed';

// 拡売費削除確認ペインの表示切り替え。
// 作成者は拡売費計画(紐づき無し)だけが表示するため、画面側から明示的に指定する。
export interface ExpenseDeleteOptions {
  showCreator?: boolean;
}

// 削除確認ペインが参照するシミュレーション明細行の項目。
export interface SimulationKeyRow extends PlanDetailKeyRow {
  targetMonth?: string;
  campaign?: string;
  probability?: string;
}

// シミュレーション明細が持つ拡売費①②（接頭辞 exp1/exp2）。
export interface SimulationExpenseRow {
  [key: string]: unknown;
}

// 販売計画の検索条件で使う選択肢（末端組織／営業担当者／事業所／部署）。
// リストは販売計画一覧に準拠。code は短縮コード（名称・コード両方で検索可能）。

export interface SelectionOption {
  value: string;
  label: string;
  code?: string;
}
