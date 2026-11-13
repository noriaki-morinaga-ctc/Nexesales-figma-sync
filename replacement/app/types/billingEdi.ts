// 請求EDI（取込一覧・取込結果詳細）の型（型だけを書く → 04 §画面ディレクトリ構成「共通の型」）
import type {
  BillingEdiErrorCategory,
  CorrectionKind,
  ReimportState,
  SystemErrorReason,
} from '@/app/constants/billingEdi';

// 取込ステータス。取込・再取込はオンラインで実行され結果が即時に確定するため、
// 「取込中」「再取込指示済」のような待ち状態は持たない。
export type BillingEdiStatus = '正常' | 'エラー';

// 明細1行のステータス。エラー行を一目で判別するために使う（errors から導出する）
export type BillingEdiDetailStatus = '正常' | 'エラー';

// 影響範囲（請求書内すべて／伝票内すべて／この明細のみ）は決定14で意味を持たなくなったため
// 型・判定関数ごと廃止した。取込可否は請求元事業所単位で決まり、1件でもエラーがあれば
// その事業所は取り込まないため、どのレコード区分まで波及するかを持つ必要がない。

// 計上区分（区分4-3）。取消はこの区分で表し、請求計上金額は正の値のまま連携される
export type RecordingType = '通常' | '取消';

// 請求金額計算区分（区分4-16）。単価×数量と金額の突合（スライド7 No8）に使う
export type AmountCalcType = '切捨て' | '切上げ' | '四捨五入';

// 費目区分（決定9。卸ごとの判別ロジックで決まる）。判別できない場合は空文字。
// センターフィは追加口・拡売費とは別の費目として扱う（第31回 決定19／8-24 決定1・3・4）
export type ExpenseType = '追加口' | '拡売費' | 'センターフィ';

// 商品コード使用区分（区分4-9）。変換エラーの原因切り分けに使う。
// 標準フォーマット（4-9）の定義は 1：プライベート／3：JAN の2値だが、
// 5：SDP（旭食品）・6：GTIN（加藤産業）を卸独自の拡張値として使う卸がある
// （8-04 EDI打合せ 決定1・2）。GTIN は先頭ゼロを除いて JAN の変換ルールへ合流させる。
export type ProductCodeType = 'プライベート' | 'JAN' | 'SDP' | 'GTIN';

// 得意先区分（区分3-8）。商流変換の粒度に影響する。空白運用の卸もあるため空文字を許容
export type CustomerClass = '全店' | '地域' | '店舗' | '';

// 消費税区分（区分4-19）。宿題事項3で「条件単価・税率が変換の対象」とされた項目
export type TaxType = '外税' | '内税' | '非課税';

// 計上対象数量単位（区分4-12）の区分値。EDIからはコードで届き、画面・再取込ともコードのまま扱う
// （名称は表示時にだけ変換する）。定義外の区分値が連携された場合は空文字（生値は rawValues へ）
export type QtyUnitCode = '0' | '1' | '3' | '5' | '7';

// 請求計上条件区分（区分4-13）。「％」のときは請求計上条件（4-14）が単価ではなく率になる
// （議事録2026/8/4 ASD芳賀発言：拡売費の一部はパーセントで連携される）
export type BillingConditionType =
  | '％'
  | 'ケース'
  | 'バラ'
  | 'キログラム'
  | 'グラム'
  | '金額';

// 明細1行に付くエラー。原因（区分・エラー項目）で表す。
// 影響範囲は決定14で意味を持たなくなったため持たない
export interface BillingEdiDetailError {
  category: BillingEdiErrorCategory; // 区分（変換／形式）
  field: string; // エラー項目（事業所コード・得意先コード・商品コード 等）
  reason: string; // エラー内容
}

// 原本（卸から連携された値）との差分。画面で値を直した項目だけ保持する。
// 受領した請求データの原本は保管が必要なため（宿題事項2・電子帳簿保存）、
// 連携値は上書きせず、直した後の値と修正者・修正日時を別に持つ。
export interface BillingEdiCorrection {
  kind: CorrectionKind;
  field: string; // 直した項目
  original: string; // 原本の連携値（変換値指定の場合は「(未変換)」）
  corrected: string; // 直した後の値
  correctedBy: string; // 修正者
  correctedAt: string; // 修正日時 'YYYY/MM/DD HH:mm'
}

// ── 商流販売店変換マスタ（2026/08/18 第30回 決定事項No.12）
// 次の組合せから商流販売店（一次店・三次店・販売店）を直接導出する。
//   ①原則：提供企業コード（1-15）＋請求元企業事業所コード（2-7）＋得意先コード（3-6）
//   ②請求元企業事業所コードが連携されない場合：提供企業コード＋請求元企業コード（2-5）＋得意先コード
// コードを1つずつ個別に変換する方式は採らない（事業所・得意先の個別変換は行わない）。
export interface RetailerConversion {
  storeCode: string; // 販売店コード
  storeName: string; // 販売店名
  primaryStoreCode: string; // 一次店コード
  primaryStoreName: string; // 一次店名
  tertiaryStoreCode: string; // 三次店コード
  tertiaryStoreName: string; // 三次店名
}

// 「変換後の値」で選ぶ商流販売店の選択肢（一次店・三次店・販売店の組）。
// 選択肢の母集団は変換マスタ（RETAILER_CONVERSION）ではなく自社の商流販売店マスタとする。
// 変換マスタに登録が無いコードに対し、自社マスタにある商流販売店を指定して変換マスタへ
// 登録し直す操作のため、変換マスタ由来の組合せでは選べる先が足りない（決定28）。
export interface RetailerAssignOption extends RetailerConversion {
  // 選択値。同じ三次店・販売店が複数の一次店にぶら下がるため、3つの組で一意にする
  value: string;
  label: string; // 表示（一次店名 / 三次店名 / 販売店名:販売店コード）
}

// エラーサマリ（詳細画面 中段）の1行。同じ原因の明細をまとめた作業単位＝再取込の単位。
// 「エラー項目」が何で、その「値」が何だったか、変換に併せて使う「補助項目」は何かを持つ。
export interface BillingEdiErrorSummary {
  id: string;
  category: BillingEdiErrorCategory; // 区分（変換／形式）
  field: string; // エラー項目
  valueCode: string; // エラー項目の値（コード）
  valueName: string; // エラー項目の値（名称）。名称を持たない項目は空
  // 補助項目。変換・検証に併せて使う項目を「項目名：値」で並べる。
  // 請求EDI明細で確認できる内容のため画面には出さない（保持のみ）
  subFields: string;
  // 影響範囲（この明細のみ／伝票内すべて／請求書内すべて）は決定14で意味を持たなくなったため廃止。
  // 1件でもエラーがあればその請求元事業所は取り込まないため、対象の請求元事業所を画面で示す。
  reason: string; // エラー内容
  // これを解消すると直る明細件数（＝エラー明細件数）はデータとして持たない。
  // 対象明細の定義を matchesErrorSummary に一本化し、targetCountOf() で都度導出する
  // （データに手書きすると、行押下で絞り込んだ結果と件数がズレる余地があるため）
  // 明細のセルで連携値を直せるか（形式エラー＝true）。
  // 形式エラーは卸から届いた値そのものが不正で、マスタでは直せないため明細側で直す。
  correctable: boolean;
  // 画面で登録した「変換後の値」。変換エラーのみ。未登録は空文字。
  // 値があればそれを適用して再変換し、無ければマスタから再変換する（分岐は持たない）
  assignedValue: string;
  // 再取込の状態。取込はオンラインのため、押した時点で解消／未解消が確定する。
  //   未実施 … まだ再取込していない
  //   解消   … 再取込して対象明細のエラーが解消した（履歴として表示に残す）
  //   未解消 … 再取込したが、このエラー自体が解消しなかった（マスタ未修正のまま再取込した等）。
  //            対象明細に別のエラーが残っているかどうかは状態に影響しない
  resolveState: ReimportState;
}

// 請求EDI明細（フラット）＝詳細画面 下段。決定6により集約しない。
// 列は区分2（請求書）→ 区分3（伝票）→ 区分4/5（明細）の順に並べる。
export interface BillingEdiDetailRow {
  id: string;

  // ── 区分1 ファイルヘッダー
  providerCode: string; // 提供企業コード（1-15）。卸会社の判定・商流変換の入力

  // ── 区分2 請求元情報（請求書単位）
  billingNo: string; // 請求書№（2-3）
  senderCode: string; // 請求元企業コード（2-5）。卸会社判定・商流変換の入力
  senderName: string; // 請求元企業名（2-6）
  senderOfficeCode: string; // 請求元企業事業所コード（2-7）。決定7の粒度キー
  senderOfficeName: string; // 請求元企業事業所名（2-8）
  // 請求締日（区分2）。対象期間（終了日）が空欄の明細は、この日付が属する月を
  // 対象月とする（→ 20260804_第27回 決定事項8／課題 No.1184・No.1286）。
  billingClosingDate: string;

  // ── 区分3 得意先情報（伝票単位）※伝票ヘッダ項目のため1伝票に1つ
  slipNo: string; // 請求伝票番号（3-3）
  customerCode: string; // 得意先コード（3-6）。商流変換の入力
  customerName: string; // 得意先名（3-9）
  // 得意先区分（3-8）。取込では保持するが請求EDI取込結果詳細の画面には表示しない（決定22）
  customerClass: CustomerClass;

  // ── 変換後（卸会社）
  // 提供企業コード（1-15）から導出する。一覧の行キーに使う（決定15）。
  // 請求元企業は一覧・基本情報とも連携値をそのまま表示する方式のため、
  // 明細には変換後の列を出さない（取込では保持する）
  convertedPayeeCode: string; // 卸会社コード
  convertedPayeeName: string; // 卸会社名

  // ── 変換後（商流販売店）
  // 商流販売店変換マスタを①／②の組合せで引いて導出する（決定12）。
  // 導出できない明細は取込エラーとし、請求詳細画面へは連携しない（決定13）。
  storeCode: string; // 販売店コード。導出できない場合は空文字
  storeName: string; // 販売店名
  primaryStoreCode: string; // 一次店コード。導出できない場合は空文字
  primaryStoreName: string; // 一次店名
  tertiaryStoreCode: string; // 三次店コード。導出できない場合は空文字
  tertiaryStoreName: string; // 三次店名

  // ── 区分4 請求明細
  recordingNo: string; // 計上№（4-4）。卸への照会キー
  accountingDate: string; // 計上日（4-5）'YYYY/MM/DD'。形式エラー時は連携生値のまま
  // 対象年月 'YYYY/MM'。対象期間（終了日・4-22）が属する月。終了日が空欄なら
  // 請求締日（区分2）が属する月とする（決定8）。どちらも取れない場合は空文字。
  targetMonth: string;
  periodFrom: string; // 対象期間（開始日・4-21）。計上月＋01
  periodTo: string; // 対象期間（終了日・4-22）。計上月＋末日
  recordingType: RecordingType; // 計上区分（4-3）
  summaryCode: string; // 販売促進金摘要コード（4-24）。費目判別の入力のひとつ
  summaryName: string; // 摘要名（コード表より）。未定義コードは空文字
  // 適用した費目判別ロジック（決定9。卸ごとにパターン化し、項目単位で適用先を設定する）。
  // 摘要コードを使わない卸があるため、判別に使う項目は卸ごとに異なる
  expenseRule: string;
  // 約定区分（8-24 決定1）。連携項目が未特定のため画面には出さず、判別の入力としてのみ持つ
  contractType: string;
  expenseType: ExpenseType | ''; // 費目（変換後）。判別不可は空文字
  promotionPlanNo: string; // 販売促進企画番号（4-23）。支払データへ引き継ぐ
  productCodeOriginal: string; // 商品コード（変換前・4-8）。未連携は空文字
  productNameOriginal: string; // 商品名（変換前・区分5-3）。未変換時の唯一の手がかり
  // 備考（区分5-5）。卸によって拡売費の内容が商品名の欄ではなくこちらに入る（第31回 決定8）。
  // どちらも連携値のまま表示し、読み替えロジックは設けない
  noteOriginal: string;
  productCodeType: ProductCodeType | ''; // 商品コード使用区分（4-9）
  // 商品は 商品コード（JAN／卸プライベート）→ オンライン商品コード → サマリ商品コード の
  // 2段階で変換する（宿題事項4の回答：JANとオンライン商品は1:Nだがロジックで一意化）。
  // サマリ商品へは変換するがレコードは集約しない（決定6）。
  onlineProductCode: string; // オンライン商品コード（変換後）。未変換は空文字
  onlineProductName: string; // オンライン商品名（変換後）。未変換は空文字
  summaryProductCode: string; // サマリ商品コード（オンライン商品から導出）。未変換は空文字
  summaryProductName: string; // サマリ商品名。未変換は空文字
  billingQty: number | null; // 請求計上対象数量（4-11）。決定11により null を許容
  qtyUnit: QtyUnitCode | ''; // 計上対象数量単位（4-12）のコード。定義外の区分値は空文字
  casePack: number; // ケース入数（4-10）。金額の検算に使う
  billingConditionType: BillingConditionType; // 請求計上条件区分（4-13）
  billingCondition: number; // 請求計上条件（4-14）。区分が「％」なら率、それ以外は単価（金額）
  // 請求計上金額（4-15）。実データでは常に正の値で連携され、取消は計上区分（4-3）で表される
  // （区分8-4 の合計も、束の計上区分 8-6 を考慮すると実サンプル2,786束すべてで一致した）。
  // 数値に変換できない場合は null
  billingAmount: number | null;
  amountCalcType: AmountCalcType; // 請求金額計算区分（4-16）
  taxType: TaxType; // 消費税区分（4-19）。外税／内税／非課税
  // 請求消費税額（4-17）。仕様上ゼロ固定で実データでも常にゼロのため画面には出さない。
  // 取込では保持する（税額の見せ方は区分8の値を基本情報に出すかを含め整理中）
  billingTax: number;

  // ── 取込結果
  // 型変換できなかった項目の連携生値（列見出し→生値）。数値・日付として保持できないため、
  // 画面はここから元の値を表示する。
  rawValues: Record<string, string>;
  // 画面で修正した項目の差分（原本→修正後）。原本は上書きしない
  corrections: BillingEdiCorrection[];
  errors: BillingEdiDetailError[]; // エラー（複数可）。空＝実質正常
  // 再取込で取り除いたエラーのエラーサマリID。再取込するとエラーは errors から消えるが、
  // エラーサマリの行を選んだときに対象明細を引き当てられるよう対応を残す
  reimportedSummaryIds: string[];
  // 受信日時。卸からこの明細を受け取った日時。基本情報の受信日時は明細の最も古い値を出す
  receivedAt: string;
  // 再取込日時。この明細を最後に再取込した日時。未実施は空文字。
  // 基本情報の再取込日時は明細の最も新しい値を出す
  reimportedAt: string;
}

// 一覧の1行＝請求元企業 × 受信日時
export interface BillingEdiImportRow {
  id: string;
  receivedAt: string; // 受信日時 'YYYY/MM/DD HH:mm'。卸から受け取った日時。行キーであり再取込しても変わらない
  reimportedAt: string; // 再取込日時 'YYYY/MM/DD HH:mm'。再取込を実行した日時。未実施は空文字
  // 請求元企業。マスタ変換は行わず請求EDIの連携値をそのまま表示する。
  // フォーマット不正のように中身を読めない場合のみ null＝配下を特定できない
  payeeName: string | null;
  senderNames: string[]; // 請求元（変換前）。詳細の基本情報でのみ使用
  status: BillingEdiStatus;
  isSystemError: boolean; // 形式不正・受信失敗・二重取込。配下を持たない
  systemErrorReason: SystemErrorReason | ''; // ファイル単位のエラー内容。通常行は空文字
  counts: { invoices: number; slips: number; details: number };
  errorCount: number; // エラー明細件数
  errorSummaries: BillingEdiErrorSummary[];
  details: BillingEdiDetailRow[];
}

// 検索条件。一覧に列として存在する項目だけを条件にする
export interface BillingEdiSearchCriteria {
  importDateFrom: string; // 受信日（開始・YYYY/MM/DD。未指定は空文字）
  importDateTo: string; // 受信日（終了・YYYY/MM/DD。未指定は空文字）
  payee: string; // 卸会社（部分一致）
  status: string; // 'all' または BillingEdiStatus
}
