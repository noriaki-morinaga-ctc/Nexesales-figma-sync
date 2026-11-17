// 組織・商流（組織の階層・販売店の階層・商流の連動・一次店〜販売店）の型（型だけを書く → 04 §画面ディレクトリ構成「共通の型」）

// 組織階層マスタ（モック）：事業場 → 部署 → 末端組織 → 担当者（作成者・営業担当者・申請者）。
// 検索条件の連動フィルタリング（utils/common/orgCascade.ts）が、上位・下位の対応を引くために使う。
// 担当者は現在の所属（末端組織）で紐づける。
// value は各画面の検索条件で使ってきた値（'hokkaido' 等）に合わせる。

export type OrgLevel = 'office' | 'department' | 'terminalOrg' | 'salesRep';

export interface OrgItem {
  value: string;
  code: string;
  name: string;
  /** すぐ上の階層の value（事業場は持たない） */
  parent?: string;
}

// 商流３項目（一次店・三次店・販売店）の現在値。
export interface StoreSelection {
  primaryStore: string;
  tertiaryStore: string;
  store: string;
}

// 商流・組織の現在値（分割先明細・振替先明細の1行分／検索条件の1組）。
export interface OrgSelection {
  store: string; // 販売店
  dept: string; // 費用負担部署
  staff: string; // 担当者
}

// 商流3項目と組織3項目をあわせた現在値（販売店は共通の1項目）。
export type StoreOrgSelection = StoreSelection & OrgSelection;

export interface OrgOption {
  value: string;
  label: string;
}

// 「対象年月 × 販売店 × 費用負担部署 × 担当者」の1組合せ。
export interface PaymentOrgCombo {
  targetMonth: string; // 対象年月（'YYYY/MM'）
  store: string; // 販売店（コード:名称）
  dept: string; // 費用負担部署（コード:名称）
  staff: string; // 担当者（コード:名称）
}

// ============================================================================
// 商流販売店の担当組織
// ============================================================================
// 振替詳細の基本情報が、固定する側（振替元／振替先）の商流販売店の担当組織を
// 表示するために参照する（20260728 第24回 宿題事項7／課題管理表 No.1080）。
// 上の連動（候補の絞り込み）とは別で、販売店1件に対して一意に定まる組織を表す。

// 販売店の担当組織。
export interface StoreOwnerOrg {
  office: string; // 事業場
  dept: string; // 担当部署
  terminalOrg: string; // 担当末端組織
  staff: string; // 営業担当者
}

// 一次店/三次店のダミーリスト（販売計画条件・年間計画の「販売店」アコーディオン表示用）。
// 各画面でインライン定義していたものをここへ集約する。

export interface StoreTier {
  /** 一次店 */
  first: string;
  /** 三次店 */
  third: string;
}

// 名称・コードで検索できるシングルコンボボックス用の選択肢。
export interface StoreSelectOption {
  value: string;
  label: string;
  code?: string;
}

// 本部計画コピーの「チェーン（販売店）」選択Grid用のモックデータ。
// 参照：課題0386,0433 販売計画コピーの整理／「コピー時の選択項目画像.png」。
// 列は 販売店（コード・販売店名）／三次店（内部コード・コード・三次店名）／
// 一次店（内部コード・コード・一次店名）の3グループ構成。
// ※要件：自分の計画チェーン名を最上部に表示する（isOwn＝true を先頭に配置）。

// チェーン（販売店）1件分。三次店・一次店は画像同様、未設定（空）のケースを許容する。
export interface ChainStore {
  /** 販売店コード */
  code: string;
  /** 販売店名 */
  name: string;
  /** 三次店 内部コード */
  tier3InternalCode?: string;
  /** 三次店 コード */
  tier3Code?: string;
  /** 三次店名 */
  tier3Name?: string;
  /** 一次店 内部コード */
  tier1InternalCode?: string;
  /** 一次店 コード */
  tier1Code?: string;
  /** 一次店名 */
  tier1Name?: string;
  /** 自社（自分の計画）チェーンか。true の行を初期選択・最上部表示する */
  isOwn?: boolean;
}
