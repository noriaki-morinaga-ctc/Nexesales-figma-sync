// 請求EDI取込一覧の絞り込み・集計・表示整形。
// 画面から切り離して vitest で検証できるよう、副作用のない純粋関数のみを置く。
import {
  ERROR_CATEGORY_OWNERS,
  QTY_UNIT_DEFINITIONS,
} from '../constants/billingEdiMockData';
import type {
  BillingEdiCorrection,
  BillingEdiDetailRow,
  BillingEdiErrorSummary,
  BillingEdiDetailStatus,
  BillingEdiImportRow,
  BillingEdiSearchCriteria,
} from '../constants/billingEdiMockData';

/**
 * その明細の指定項目を画面で修正できるか。
 * 変換エラー（マスタ未登録）はマスタを修正して再取込するため対象外とし（決定4）、
 * 形式エラー（数値以外・日付として不正・定義外の区分値・必須項目が未連携）のみ修正できる。
 * 単価×数量と請求金額の不一致は取込時にチェックしないため、ここには現れない（決定21）。
 */
export function isCorrectableField(
  row: BillingEdiDetailRow,
  field: string
): boolean {
  return row.errors.some(
    (e) => e.category === 'データ不正' && e.field === field
  );
}

/**
 * 計上対象数量単位で選べる区分値。0：円 は請求計上条件区分が「％」の明細のみ選べる
 * （請求EDIフォーマット定義 区分4-12）。定義に合わない値で直して再びエラーになるのを防ぐ。
 */
export function selectableQtyUnits(
  row: BillingEdiDetailRow
): typeof QTY_UNIT_DEFINITIONS {
  return QTY_UNIT_DEFINITIONS.filter(
    (unit) => unit.code !== '0' || row.billingConditionType === '％'
  );
}

/** 計上対象数量単位のコードを表示用の名称にする。定義外のコードはそのまま返す。 */
export function qtyUnitLabel(code: string): string {
  return QTY_UNIT_DEFINITIONS.find((unit) => unit.code === code)?.label ?? code;
}

// エラー項目名 → 明細が保持している値。型変換できた項目の原本を引くのに使う
const VALUE_OF_FIELD: Record<string, (row: BillingEdiDetailRow) => string> = {
  計上日: (r) => r.accountingDate,
  請求計上金額: (r) => (r.billingAmount == null ? '' : String(r.billingAmount)),
  計上対象数量単位: (r) => r.qtyUnit,
  商品コード: (r) => r.productCodeOriginal,
};

/**
 * 原本（卸から連携された値）。型変換できなかった項目は生値（rawValues）を、
 * 変換できた項目は明細が保持している値を返す。
 */
export function originalValueOf(
  row: BillingEdiDetailRow,
  field: string
): string {
  return row.rawValues[field] ?? VALUE_OF_FIELD[field]?.(row) ?? '';
}

// エラー項目名 → その項目の連携値を持つ明細のフィールド（候補）。
// エラーサマリ（同じ原因の明細をまとめた単位）から対象明細を引くのに使う。
// 商流販売店は①／②の組合せで変換するため（決定12）、サマリの値が
// 請求元企業事業所コードのことも得意先コードのこともある。どちらかに一致すれば対象とする。
// ここに無い項目（データ不正の各項目）は originalValueOf で原本の値を1つ引く。
const KEYS_OF_FIELD: Record<string, (row: BillingEdiDetailRow) => string[]> = {
  商流販売店: (r) => [r.senderOfficeCode, r.customerCode],
  商品コード: (r) => [r.productCodeOriginal],
};

/**
 * エラーサマリとの突合に使う原本の値。
 * 画面でセルを修正すると rawValues から生値が落ちるため、原本が残っている
 * corrections を先に見る。これを見ないと、修正した明細がエラーサマリの対象から
 * 外れ、再取込の対象にならなくなる。
 */
function keyValueOf(row: BillingEdiDetailRow, field: string): string {
  return findCorrection(row, field)?.original ?? originalValueOf(row, field);
}

/**
 * エラーサマリ1件の対象明細かどうか。
 * エラーサマリの単位は「エラー項目＋エラーの値（コード）」（決定 第30回 2026-08-18）のため、
 * エラー項目・エラー内容・値の3つが一致する明細を対象とする。
 * エラー内容だけで突合すると、同じエラー内容を持つ別項目・別値のサマリが同じ明細を拾い、
 * 再取込で直していないエラーまで解消したことになってしまう（決定14に反する）。
 */
export function matchesErrorSummary(
  row: BillingEdiDetailRow,
  summary: BillingEdiErrorSummary
): boolean {
  // 再取込済み（解消／未解消）のエラーは明細からは取り除かれているため、記録した対応で引く
  if (row.reimportedSummaryIds.includes(summary.id)) {
    return true;
  }
  // エラー項目とエラー内容の両方が一致すること。片方だけでは識別できない
  //（例：「必須項目が未連携」は商品コードにも計上日にも起こり得る）
  if (
    !row.errors.some(
      (e) => e.field === summary.field && e.reason === summary.reason
    )
  ) {
    return false;
  }
  // 値（コード）を持たないサマリ（必須項目が未連携など、値そのものが連携されていない）は
  // 値で束ねられないため、エラー項目とエラー内容だけで判定する
  if (!summary.valueCode) {
    return true;
  }
  const keys =
    KEYS_OF_FIELD[summary.field] ??
    ((r: BillingEdiDetailRow) => [keyValueOf(r, summary.field)]);
  return keys(row).includes(summary.valueCode);
}

/**
 * エラーサマリ1件の対象明細の件数（＝エラーサマリの「エラー明細件数」）。
 * 対象明細の定義を matchesErrorSummary に一本化するため件数もここから導出する
 * （仮データ側に件数を手書きすると、行押下で絞り込んだ結果とズレる余地があるため）。
 */
export function targetCountOf(
  details: BillingEdiDetailRow[],
  summary: BillingEdiErrorSummary
): number {
  return details.filter((row) => matchesErrorSummary(row, summary)).length;
}

/**
 * エラーサマリ1件の対象となる請求元事業所（「コード:名称」の重複なし一覧）。
 * 決定14により取込可否は請求元事業所単位で決まるため、影響範囲に代えてこれを示す。
 * 商流販売店のエラーは値に事業所が含まれるため1件に、商品コード・形式エラーは
 * 事業所をまたぐことがあるため複数件になる（決定18の一括修正が成り立つ単位）。
 */
export function targetOfficesOf(
  details: BillingEdiDetailRow[],
  summary: BillingEdiErrorSummary
): string[] {
  const offices = details
    .filter((row) => matchesErrorSummary(row, summary))
    .map((row) => `${row.senderOfficeCode}:${row.senderOfficeName}`);
  return Array.from(new Set(offices));
}

/** 対象事業所の表示文言。1件はコード:名称、複数件は件数でまとめる。 */
export function formatTargetOffices(offices: string[]): string {
  if (offices.length === 0) return '-';
  if (offices.length === 1) return offices[0];
  return `${offices.length}事業所`;
}

/** 指定項目の修正差分（原本→修正後）。修正していなければ undefined。 */
export function findCorrection(
  row: BillingEdiDetailRow,
  field: string
): BillingEdiCorrection | undefined {
  return row.corrections.find((c) => c.field === field);
}

/** 画面で1つでも値を修正した明細か。 */
export function isCorrectedRow(row: BillingEdiDetailRow): boolean {
  return row.corrections.length > 0;
}

/** 修正差分のツールチップ文言（原本→修正後・修正者・修正日時）。 */
export function formatCorrectionTooltip(
  correction: BillingEdiCorrection
): string {
  return `原本：${correction.original} → 修正後：${correction.corrected}（${correction.correctedBy} ${correction.correctedAt}）`;
}

/** 明細1行のステータス。エラーの有無から導出する（保持しないため矛盾が起きない）。 */
export function resolveDetailStatus(
  row: BillingEdiDetailRow
): BillingEdiDetailStatus {
  return row.errors.length > 0 ? 'エラー' : '正常';
}

// 1明細に複数のエラーが付きうるため、重複を除いて連結する
const joinUnique = (values: string[]): string =>
  Array.from(new Set(values.filter(Boolean))).join('、');

/** エラー区分（変換／形式）。両方あれば「変換、形式」。 */
export function formatDetailErrorCategories(row: BillingEdiDetailRow): string {
  return joinUnique(row.errors.map((e) => e.category));
}

/** エラー項目（商流販売店・商品コード 等）。 */
export function formatDetailErrorFields(row: BillingEdiDetailRow): string {
  return joinUnique(row.errors.map((e) => e.field));
}

/** エラー内容。複数あれば連結する。 */
export function formatDetailErrorReasons(row: BillingEdiDetailRow): string {
  return joinUnique(row.errors.map((e) => e.reason));
}

/**
 * 明細の受信日時のうち最も古いもの。基本情報の受信日時に出す。
 * 明細を持たない行（ファイル単位のエラー）は一覧の受信日時をそのまま使う。
 */
export function oldestReceivedAt(details: BillingEdiDetailRow[]): string {
  const values = details.map((d) => d.receivedAt).filter(Boolean);
  return values.length === 0 ? '' : values.reduce((a, b) => (a <= b ? a : b));
}

/**
 * 明細の再取込日時のうち最も新しいもの。基本情報の再取込日時に出す。
 * 一度も再取込していない場合は空文字（画面はハイフンにする）。
 */
export function latestReimportedAt(details: BillingEdiDetailRow[]): string {
  const values = details.map((d) => d.reimportedAt).filter(Boolean);
  return values.length === 0 ? '' : values.reduce((a, b) => (a >= b ? a : b));
}

/** 請求元（変換前）の表示文言。詳細の基本情報で全件を並べる。 */
export function formatSenderNames(names: string[]): string {
  if (names.length === 0) {
    return '-';
  }
  return names.join('、');
}

/**
 * 配下（請求書・伝票・明細）を持たない行か。
 * システムエラー（形式不正・受信失敗・二重取込）はファイルの中身を読めないため、
 * 一覧の件数はハイフンにし、請求EDI取込結果詳細も開けないようにする。
 */
export function hasNoDetail(row: BillingEdiImportRow): boolean {
  return row.isSystemError;
}

/**
 * 一覧のエラー種別。**誰が対応するか**を見分けるために出す。
 *   フォーマット不正／二重取込／件数・金額不一致 … システム管理担当。ファイル全体が取込不可
 *   変換マスタ未登録 … 業務担当。マスタを直すか変換後の値を登録して再取込する
 *   データ不正       … 卸へ照会（業務担当が窓口）。画面で値を直して再取込することもできる
 * ファイル単位のエラーは中身を読めないため他と併存しない（常に単独）。
 */
export function formatRowErrorCategories(row: BillingEdiImportRow): string {
  if (row.isSystemError) {
    return row.systemErrorReason;
  }
  // 解消済みは対応が要らないため種別から外す（履歴としては詳細のエラーサマリに残る）
  return joinUnique(
    row.errorSummaries
      .filter((e) => e.resolveState !== '解消')
      .map((e) => e.category)
  );
}

/**
 * エラーサマリの区分を「、」で並べた文言。請求EDI取込結果詳細の基本情報に出す。
 * 一覧のエラー種別（formatRowErrorCategories）は解消済みを外すのに対し、
 * こちらは画面のエラーサマリグリッドに並ぶ値をそのまま並べる（解消済みも含む）。
 */
export function formatSummaryCategories(
  summaries: BillingEdiErrorSummary[]
): string {
  return joinUnique(summaries.map((e) => e.category));
}

/**
 * まだ取り込めていない請求元事業所の件数（決定14・16）。
 * 取込可否は請求元事業所単位で決まるため、明細単位ではなくこの単位で数える。
 * 再取込で解消したエラーは含めず、現時点で残っているエラーだけを数える
 * （→ 一覧 4.レイアウト AK89 スレッド 加藤 2026-09-14「No7は現時点のエラー件数を表示」）。
 */
export function countErrorOffices(row: BillingEdiImportRow): number {
  const offices = row.errorSummaries
    .filter((summary) => summary.resolveState !== '解消')
    .flatMap((summary) => targetOfficesOf(row.details, summary));
  return new Set(offices).size;
}

/**
 * エラー種別ごとの対応部署（決定10）。1行に複数の種別があれば全件を並べる。
 * マスタで設定した値をそのまま出す（対応の進行に応じて付け替えない）。
 */
export function formatRowOwners(row: BillingEdiImportRow): string {
  const categories = formatRowErrorCategories(row).split('、').filter(Boolean);
  return joinUnique(categories.map((c) => ERROR_CATEGORY_OWNERS[c] ?? ''));
}

/**
 * 請求元企業の表示文言。マスタ変換は行わず、請求EDIの連携値をそのまま表示する。
 * フォーマット不正のように中身を読めない場合は請求元企業も取れないためハイフン。
 * 二重取込・件数不一致は区分1・2を読めているので請求元企業を表示する。
 */
export function formatPayeeName(row: BillingEdiImportRow): string {
  return row.payeeName ?? '-';
}

/** 'YYYY/MM/DD HH:mm' の日付部分（'YYYY/MM/DD'）を取り出す。検索条件（共通カレンダー部品の値）と同じ形式。 */
const toDateKey = (receivedAt: string): string => receivedAt.slice(0, 10);

/** 検索条件で一覧行を絞り込む。 */
export function filterBillingEdiRows(
  rows: BillingEdiImportRow[],
  criteria: BillingEdiSearchCriteria
): BillingEdiImportRow[] {
  const payee = criteria.payee.trim();

  return rows.filter((row) => {
    // ステータス
    if (criteria.status !== 'all' && row.status !== criteria.status) {
      return false;
    }
    // 請求元企業。中身を読めないシステムエラー行は請求元企業を持たないため、条件指定時は必ず除外される
    if (payee) {
      const target = row.payeeName ?? '';
      if (!target.includes(payee)) {
        return false;
      }
    }
    // 受信日（範囲）
    const dateKey = toDateKey(row.receivedAt);
    if (criteria.importDateFrom && dateKey < criteria.importDateFrom) {
      return false;
    }
    if (criteria.importDateTo && dateKey > criteria.importDateTo) {
      return false;
    }
    return true;
  });
}

/** サマリ表示用の件数。再取込指示済はどちらにも数えない。 */
export function summarizeBillingEdiStatus(rows: BillingEdiImportRow[]): {
  normalCount: number;
  errorCount: number;
} {
  return {
    normalCount: rows.filter((r) => r.status === '正常').length,
    errorCount: rows.filter((r) => r.status === 'エラー').length,
  };
}
