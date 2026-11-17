// 請求（請求一覧・請求詳細）の型（型だけを書く → 04 §画面ディレクトリ構成「共通の型」）

// ── ステータス・区分の定義 ──────────────────────────────

// 入力単位（請求元事業所×データ元）の入力状況。
//   入力中：AIC が入力・修正できる状態（支払画面へ未反映）
//   反映済：支払画面へ反映済み（参照専用）
export type BillingStatus = '入力中' | '反映済';

// 明細のデータ元（どの経路で作られた明細か）。
//   EDI  ：請求EDIの取込結果から夜間バッチで自動作成される
//   AIC入力：紙・PDF の請求書を見て AIC が画面から直接入力する
// どちらも作成経路を表す属性のため、画面では参照専用とする。
export type BillingDataSource = 'EDI' | 'AIC入力';

// 明細のステータス（⑤-1 シートの凡例）。支払画面へ反映する前の明細は「支払画面未反映」
// （空欄ではなく値で示す。→ 補足1 コメント 2026-09-14）。
export type BillingDetailStatus =
  | '支払画面未反映'
  | '商流未設定'
  | '支払画面反映済'
  | '支払処理申請中'
  | '支払処理検印済'
  // 申請後に引戻し・差戻しで未申請へ戻し、支払詳細で「支払無し」にした明細（レアケース）。
  // 検印へは進まない（→ 補足1 コメント 福士 2026-09-17）
  | '支払無';

// 検索条件の選択肢（請求元企業・請求元企業事業所）。
// いずれもマスタの12桁コードを持ち、表記は「12桁コード:名称」に統一する（→ 02 §9）。
// ※コードはモックの仮値（企業は 1 始まり／事業所は 2 始まりの12桁）。
// 選択肢の実体は入力単位（BILLING_LIST）から作る。定義はファイル末尾を参照。
export interface BillingCodeName {
  code: string;
  name: string;
}

// 請求元企業の選択肢。どの提供企業に属するかを併せ持ち、
// 提供企業を選んだときの絞り込み（連動フィルタ）に使う。
export interface BillingCompanyOption extends BillingCodeName {
  // 親の提供企業コード（請求EDIレコード区分1。→ 20261006_第37回 決定事項4）
  providerCode: string;
}

// 請求元企業事業所の選択肢。どの請求元企業・提供企業に属するかを併せ持ち、
// 請求元企業・提供企業を選んだときの絞り込み（連動フィルタ）に使う。
export interface BillingOfficeOption extends BillingCodeName {
  // 親の請求元企業コード。AIC入力分は請求元企業を持たないため空になる（決定24）
  companyCode: string;
  // 親の提供企業コード。AIC入力分は提供企業を持たないため空になる
  providerCode: string;
}

// ── サマリ商品マスタ（AIC 入力用） ──────────────────────
// PPT：独自のサマリ商品コード一覧を作成し、コードは短縮の下4桁で作業する。
// コンボボックスは名称・コードの部分一致で絞り込むため、下4桁の入力でも候補が出る。

export interface BillingSummaryProduct {
  name: string; // サマリ商品名
  code: string; // サマリ商品コード（下4桁で検索する運用）
  perCase: number; // 入数
}

// ── 販売店紐づけ表（得意先コード → 商流販売店） ────────────
// PPT：請求書の得意先名（コード）から商流販売店を特定する紐づけ表を用意し、
// 該当分の請求内容を各商流販売店の支払画面へ反映させる。

export interface BillingCustomerLink {
  customerCode: string; // 得意先コード（EDI区分3-5）
  customerName: string; // 得意先名（EDI区分3-6）
  // 担当者は営業担当者コード（7桁）を持ち、表記は「コード:名称」に統一する（→ 02 §9）
  staffName: string; // 担当者（商流販売店より）
  // 販売店・一次店・三次店は紐づけ表から取得し、表記は「コード:名称」に統一する（→ 02 §9）
  storeName: string; // 販売店
  primaryStore: string; // 一次店
  tertiaryStore: string; // 三次店
}

// 商流販売店（販売店・一次店・三次店）の選択肢。
// EDI取込分は商流販売店変換マスタからの自動反映のみだが、AIC入力分はマスタで導出できない明細が
// あるため画面で選べるようにする。選択肢はマスタの値から重複を除いて作り、専用のマスタは持たない。
export type BillingStoreField = 'storeName' | 'primaryStore' | 'tertiaryStore';

// ── 明細行 ──────────────────────────────────────────────

// 費目（追加口／拡売費）。請求EDI取込時に卸ごとの判別ロジックで決まる（決定9）
export type BillingExpenseType = '追加口' | '拡売費' | 'センターフィ';

export interface BillingDetailRow {
  id: string;
  dataSource: BillingDataSource; // データ元【参照】EDI＝夜間バッチ自動作成／AIC入力＝AICが直接入力
  status: BillingDetailStatus; // ステータス（支払側で更新される）
  expenseType: BillingExpenseType; // 費目【参照】取込時に判別した結果
  // 取込時に費目を判別できず追加口として取り込んだ明細（決定19 2026-08-18）。
  // 判別できなかったことは請求EDI取込結果詳細ではなくこの画面で分かるようにし、
  // 誤っている場合は営業担当者が支払詳細画面で拡売費に修正する。
  expenseUnresolved: boolean;
  // 対象月 'YYYY/MM'。請求EDI取込結果詳細から連携される（レコード区分4の対象期間（終了日）が
  // 属する月。終了日が空欄なら請求締日が属する月 → 20260804_第27回 決定事項8）。
  targetMonth: string;
  billAmount: number | null; // 請求金額【入力】
  payAmount: number | null; // 支払金額【参照】支払明細から
  matchKbn: string; // 照合区分【参照】支払明細から
  taxKbn: string; // 消費税区分【入力】
  payTaxAmount: number | null; // 支払消費税額【参照】
  productName: string; // サマリ商品名【入力】
  // 商品名は請求書に記載された商品名で、サマリ商品名とは別項目（→ 20260821_第31回 決定事項8）
  itemName: string; // 商品名【入力】
  perCase: number | null; // 入数【自動】サマリ商品マスタから
  billingUnit: string; // 請求単位【入力】
  qty: number | null; // 数量【入力】
  unitPrice: number | null; // 請求単価【入力】
  slipNo: string; // 請求伝票No.【入力】
  invoiceNo: string; // 請求書No.【入力】
  customerCode: string; // 得意先コード【入力】
  customerName: string; // 得意先名【入力】
  // 担当者（表記は「コード:名称」）。販売店を候補から選んだ明細は商流販売店変換マスタから
  // 自動反映する【参照】。販売店が未選択・手入力の明細はマスタから導出できないため、
  // 得意先名を手掛かりに画面で選ぶ【入力】（→ 請求詳細（AIC入力））。
  staffName: string;
  // 販売店・一次店・三次店は名称だけを持つ。商流販売店変換マスタで導出できない先は
  // コードを持てないため、候補から選ぶ／手で入力するのいずれも名称で統一する。
  storeName: string; // 販売店【入力】名称のみ
  primaryStore: string; // 一次店【入力】名称のみ
  tertiaryStore: string; // 三次店【入力】名称のみ
  note: string; // 備考【入力】（→ 20260821_第31回 決定事項8）
  // 支払画面へ反映した明細の反映先。卸から差異の問い合わせがあった際に
  // どの支払へ反映したかを追えるようにする（→ 20260821_第31回 AL115 コメント）。
  payNo?: string; // 支払No.【参照】支払画面へ反映した明細のみ
  payCount?: number | null; // 支払回数【参照】支払画面へ反映した明細のみ
  // 行の追加経路。左端の列（No.）の左ボーダー帯で示す（計画詳細と同じ共通表現）。
  // 'detail'＝明細コピー／'new'＝明細追加／'reference'＝参照ペインからのコピー。
  _copySource?: 'reference' | 'detail' | 'new';
}

// ── 一覧行（1行＝請求元事業所×データ元＝入力単位1件） ────────
// 保持する項目は「⑤-１請求・支払反映画面」シートのヘッダー部（管理単位＋集計項目）と
// 入力状況に限る。請求書No. は入力単位の中に複数あるため明細側で持つ。

export interface BillingRow {
  id: string;
  status: BillingStatus; // 入力状況（入力中／反映済）
  // データ元（決定23）。入力単位の属性として持ち、同じ請求元企業事業所でも
  // 請求EDIとAIC入力は別の入力単位（別行）にする。明細側では持たない。
  dataSource: BillingDataSource;
  // 受付日時（20260818_第30回 宿題事項15）。請求EDIは受信日時、AIC入力は登録日時。
  // 対象年月は請求元レコード（区分2）に複数月が含まれることがあるためキーにしない。
  // 項目名は課題 No.1287 で「受付日時」に決着した。
  receivedAt: string; // 'YYYY/MM/DD HH:mm'
  // 提供企業（請求EDIレコード区分1の提供企業コード・提供企業名）。
  // 請求EDI取込一覧（提供企業単位）とのつながりを示すために持つ。1つの提供企業の下に
  // 請求元企業が複数あることがある（例：北陸中央食品／カナカン）。
  // AIC入力分は提供企業を持たないためブランク（→ 20261006_第37回 決定事項2・4）
  providerCode: string; // 提供企業コード
  providerName: string; // 提供企業名
  // 請求元企業・請求元企業事業所はコードと名称を別項目で持つ。
  // AIC入力分は請求元企業を特定できないためコード・名称ともブランクとし、
  // 事業所はコードを持たず名称のみで識別する（決定24）
  billCompanyCode: string; // 請求元企業コード
  billCompanyName: string; // 請求元企業名
  billOfficeCode: string; // 請求元企業事業所コード
  billOfficeName: string; // 請求元企業事業所名
  billAmount: number; // 請求金額 計（税抜）
  payAmount: number; // 支払処理金額 計（税抜）
  correction: number; // 支払訂正（差異）分 計
  // 支払処理検印済の明細だけを集計した支払金額（税抜）。
  // 20260821_第31回 決定事項20 により、確定（検印）後金額は独立エリアではなく
  // 合計サマリーへまとめ、明細の支払金額合計と名称で区別する。
  sealedPayAmount: number;
}
