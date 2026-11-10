// 支払詳細(追加口請求書有／追加口請求書無)の追加口明細 ─ 行の計算式と判定。
//
// 画面（DetailTable）とモックデータ（constants/payment*MockData）の両方から使うため、
// 純粋な関数としてまとめる。
//
// 請求書有：
//   ・計算式（recalcEntryRow）… Excel「追加口」表の数式（→ 補足1-5 b21）
//   ・計画の種類（→ 補足2-1 No.10、利用者の決定 Q5）
//       一般卸メッシュで作った計画に紐づく明細 … 請求NET＜計画NET のとき、取込・反映の時点で
//         支払NET（追加口分）を自動で計画NETにする（差は拡売費（NET未承認）になる）。赤くしない。
//         自動の振替は請求EDI・AIC入力の明細にだけ行い、手入力の明細には行わない。
//       サマリ商品で作った計画に紐づく明細 … 請求NET＜計画NET のとき行を赤く表示し、担当者が直す。
//   ・計画に無いサマリ商品は計画NETを空欄にし、行を赤く表示する（→ 利用者の決定 Q6）。
// 請求書無：
//   ・計算式（deriveWithoutInvoiceEntryRow）… 支払NET（追加口分）から追加口金額を求める（→ 補足1-6 b21）
import type { AdditionalEntryData } from '../../../components/payment/payment-detail-with-invoice/components/DetailTable';
import type { EntryRow as WithoutInvoiceEntryRow } from '../../../components/payment/payment-detail-without-invoice/components/DetailTable';
import { markManualEdit, originDataSourceOf } from './paymentDataSource';

// 計画の種類（追加口明細が紐づく計画行をどう作ったか）。
export const PLAN_TYPES = ['一般卸メッシュ', 'サマリ商品'] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

// 値を数値化する（カンマ区切り文字列も可）。数値化できなければ null。
export const toEntryNumber = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === '' || v === null || v === undefined || v === '-') return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

// バラ換算の本数（入数×ケース＋バラ）。ケース・バラがどちらも未入力なら null
//（金額を再計算せず、引き継いだ・手入力した金額をそのまま残す）。
const looseQtyOf = (
  capacity: number | null,
  cases: number | null,
  loose: number | null
): number | null => {
  if (cases === null && loose === null) return null;
  if (cases !== null && cases !== 0 && capacity === null) return null; // 入数が無いとケースを換算できない
  return (capacity ?? 0) * (cases ?? 0) + (loose ?? 0);
};

// 請求情報の計算に使う項目（追加口明細と明細追加－追加口ペインで共通）。
export interface EntryBillingCalcInput {
  seihan?: unknown; // 社外売上高単価
  capacity?: unknown; // 入数
  billNet?: unknown; // 請求NET
  cases?: unknown; // ケース
  loose?: unknown; // バラ
  unitPrice?: unknown; // バラ単価
}

// 計算式のバラ単価（社外売上高単価－請求NET）。計算できなければ null。
export const calcEntryUnitPrice = (
  row: EntryBillingCalcInput
): number | null => {
  const U = toEntryNumber(row.seihan);
  const W = toEntryNumber(row.billNet);
  return U !== null && W !== null ? U - W : null;
};

// 計算式の金額（（入数×ケース＋バラ）×バラ単価、1円未満四捨五入）。計算できなければ null。
export const calcEntryAmount = (row: EntryBillingCalcInput): number | null => {
  const H = toEntryNumber(row.unitPrice);
  const qty = looseQtyOf(
    toEntryNumber(row.capacity),
    toEntryNumber(row.cases),
    toEntryNumber(row.loose)
  );
  return H !== null && qty !== null ? Math.round(qty * H) : null;
};

// 入力項目（支払ケース/バラ・支払NET（追加口分）・支払NET（全体）等）から派生項目を再計算する。
// Excel「追加口」表の数式に準拠：
//   バラ単価H       = 社外売上高単価U − 請求NET W
//   金額I           =（入数E×請求ケースF ＋ 請求バラG）× バラ単価H
//   追加口バラ単価L = 社外売上高単価U − 支払NET（追加口分）X
//   拡売費バラ単価M = 支払NET（追加口分）X − 支払NET（全体）Y
//   追加口金額N     =（入数E×支払ケースJ ＋ 支払バラK）× 追加口バラ単価L
//   拡売費金額O     =（入数E×支払ケースJ ＋ 支払バラK）× 拡売費バラ単価M
//   支払金額P       = 追加口金額N + 拡売費金額O
//   差額R           = 金額I − 支払金額P
// 金額の数式はケース・バラをバラ換算の本数（入数×ケース＋バラ）にまとめて掛ける。
// 函数無効チェックON、または必要な値が数値でない行（拡売費処理行など）は
// 当該項目の再計算をスキップし、既存の手入力値を保持する。
// 金額項目は円単位で扱うため、算出結果は四捨五入する。
export const recalcEntryRow = (row: AdditionalEntryData): void => {
  if (row.isTotal) return;
  if (row.funcCheck === true) return; // 函数無効チェックON＝手入力値を優先

  const E = toEntryNumber(row.capacity);
  const U = toEntryNumber(row.seihan);
  const X = toEntryNumber(row.addNet);
  const Y = toEntryNumber(row.payNet);
  const J = toEntryNumber(row.payCases);
  const K = toEntryNumber(row.payLoose);

  // 手入力の明細でバラ単価・金額を手で直した場合は、その値を残す（→ applyEntryCellEdit）。
  const unitPrice = calcEntryUnitPrice(row);
  if (unitPrice !== null && !row.unitPriceManual) row.unitPrice = unitPrice;
  const amount = calcEntryAmount(row);
  if (amount !== null && !row.amountManual) row.amount = amount;
  if (U !== null && X !== null) row.addUnit = U - X;
  if (X !== null && Y !== null) row.expUnit = X - Y;
  const payQty = looseQtyOf(E, J, K);
  const L = toEntryNumber(row.addUnit);
  if (L !== null && payQty !== null) row.addAmount = Math.round(payQty * L);
  const M = toEntryNumber(row.expUnit);
  if (M !== null && payQty !== null) row.expAmount = Math.round(payQty * M);
  const N = toEntryNumber(row.addAmount);
  const O = toEntryNumber(row.expAmount);
  if (N !== null && O !== null) row.payAmount = N + O;
  // 差額は常に金額と支払金額に合わせる。空欄は0として数え（合計行の差額＝金額計－支払金額計と
  // 同じ数え方）、どちらも空欄なら空欄にする。
  const I = toEntryNumber(row.amount);
  const P = toEntryNumber(row.payAmount);
  row.diff = I === null && P === null ? '' : (I ?? 0) - (P ?? 0);
};

// 追加口明細のセルを手で直したときに呼ぶ（請求書有）。どの項目を直しても、請求EDI・AIC入力の
// 明細は手入力になる（活性は元のデータ元のまま → utils/payment/payment-detail/paymentDataSource）。
// あわせて派生項目を計算式で求め直す。データ元が変わったら true を返す。
export const applyEntryManualEdit = (row: AdditionalEntryData): boolean => {
  const changed = markManualEdit(row);
  recalcEntryRow(row);
  return changed;
};

// ── 手入力の明細の請求情報・請求書情報（→ 補足1-5 b21.t13〜t17・t35〜t37） ──
// 元のデータ元が手入力の明細（明細追加・追加口処理で作った明細）だけ、請求情報（請求NET・ケース・
// バラ・バラ単価・金額）と請求書情報（請求書ページ・請求明細番号・販売店名）を直せる。
// 請求EDI・AIC入力の明細は、手で直して手入力になっても元のデータ元のまま直せない。
export const ENTRY_MANUAL_ONLY_FIELDS = [
  'billNet',
  'cases',
  'loose',
  'unitPrice',
  'amount',
  'billPage',
  'billDetailNo',
  'retailerName',
] as const;

// 元のデータ元が手入力の明細か（手で直して手入力になった請求EDI・AIC入力の明細は含まない）。
export const isManualOriginEntry = (
  row: AdditionalEntryData | undefined
): boolean => !!row && !row.isTotal && originDataSourceOf(row) === '手入力';

// 請求情報・請求書情報（ENTRY_MANUAL_ONLY_FIELDS）のセルを直せるか。ほかの列の活性は
// 列定義（DetailTable の editable）で決める。
export const isEntryCellEditable = (
  row: AdditionalEntryData | undefined,
  field: string
): boolean =>
  (ENTRY_MANUAL_ONLY_FIELDS as readonly string[]).includes(field) &&
  isManualOriginEntry(row);

// 同じ値か（小数の誤差は無視する）。
export const isSameEntryNumber = (a: unknown, b: number | null): boolean => {
  const n = toEntryNumber(a);
  return n !== null && b !== null && Math.abs(n - b) < 1e-9;
};

// 追加口明細のセル（field）を直したあとの処理。手入力の明細のバラ単価・金額は計算した値を
// 手で直せる（→ 補足1-5 b21.t16・t17「手入力の明細は、計算した値を手で直せる」）。
//   ・バラ単価を直す … バラ単価は直した値を残し、金額はその単価で計算し直す
//   ・金額を直す     … 金額は直した値を残す
//   ・請求NETを直す  … バラ単価・金額とも計算し直す（手で直した値は捨てる）
//   ・ケース・バラを直す … 金額を計算し直す（手で直した金額は捨てる。バラ単価は残す）
// 手で直した値は、その値の元になる項目を直すまで残す。支払金額・差額・赤表示・合計表は
// 直した値で計算し直す。そのほかは applyEntryManualEdit と同じ（手入力にして計算し直す）。
//   ・バラ単価・金額を空欄にする … 計算した値に戻す（計算できなければ空欄）
//   ・計算した値と同じ値を入れる … 手で直した値として扱わない（元に戻す（Undo）で計算値に
//     戻したときも、以後は計算式に追随する）
//   ・請求NET・ケース・バラを空欄にする … その値から導くバラ単価・金額は古い値を残さず、
//     計算し直す（計算できなければ空欄）。手で直したバラ単価・金額は残す
// 函数無効チェックONの明細は再計算しないため、空欄にした項目以外は変えない。
export const applyEntryCellEdit = (
  row: AdditionalEntryData,
  field: string | undefined
): boolean => {
  const value = field
    ? (row as unknown as Record<string, unknown>)[field]
    : undefined;
  const blank = toEntryNumber(value) === null;
  if (field === 'unitPrice') {
    row.unitPriceManual =
      !blank && !isSameEntryNumber(value, calcEntryUnitPrice(row));
    row.amountManual = false;
  } else if (field === 'amount') {
    row.amountManual =
      !blank && !isSameEntryNumber(value, calcEntryAmount(row));
  } else if (field === 'billNet') {
    row.unitPriceManual = false;
    row.amountManual = false;
  } else if (field === 'cases' || field === 'loose') {
    row.amountManual = false;
  }
  // 空欄にした項目から導く値は空欄に戻し、下の再計算で求め直す（計算できなければ空欄のまま）。
  if (blank && row.funcCheck !== true) {
    if ((field === 'billNet' || field === 'unitPrice') && !row.unitPriceManual)
      row.unitPrice = '';
    if (
      (field === 'billNet' ||
        field === 'unitPrice' ||
        field === 'cases' ||
        field === 'loose' ||
        field === 'amount') &&
      !row.amountManual
    )
      row.amount = '';
  }
  return applyEntryManualEdit(row);
};

// ── 明細追加－追加口ペインの請求情報（→ 補足1-5 b24.t7〜t11） ──
// 請求NETは初期値なし（担当者が請求書を見て入力する）。バラ単価・金額は計算した値を表示し
//（計算できないあいだは空欄）、手で直せる。直した値の扱いはグリッド（applyEntryCellEdit）と同じ：
//   ・直した値は、その値の元になる項目を直すまで残す
//   ・請求NETを直す・サマリ商品を選び直す … バラ単価・金額とも計算し直す
//   ・ケース・バラを直す … 金額だけ計算し直す（直したバラ単価は残す）
//   ・バラ単価を直す … 金額を計算し直す
//   ・直した値を空欄にする … 計算した値に戻す（計算できなければ空欄）
//   ・計算した値と同じ値は、直した値として扱わない
// バラ単価・金額の入力中（focused）は、入力中の文字をそのまま残す（1文字ずつ消す・全部消して
// 打ち直すときに、計算した値へ戻したり書式を整えたりしない）。上の「空欄→計算した値」
//「計算した値と同じ→直した値として扱わない」の確定と表示の整形は、入力欄を離れたとき
//（focused なしで呼ぶ）に行う。
// 金額は丸める前のバラ単価で計算する（一覧の明細 recalcEntryRow と同じ）。バラ単価の小数第2位
// までの丸めは表示だけ。
export interface EntryBillingDraft {
  billNet: string;
  cases: string;
  loose: string;
  unitPrice: string;
  amount: string;
  unitPriceManual: boolean;
  amountManual: boolean;
}

// 'product' はサマリ商品を選び直したとき（社外売上高単価・入数が変わる）。value は使わない。
// reference は選んだ商品の参照値。
export type EntryBillingDraftField =
  | 'product'
  | 'billNet'
  | 'cases'
  | 'loose'
  | 'unitPrice'
  | 'amount';

// 入力欄に出す文字列（バラ単価は小数第2位まで、金額は整数）。計算できなければ空欄。
const draftUnitPriceText = (v: number | null): string =>
  v === null ? '' : (Math.round(v * 100) / 100).toFixed(2);
const draftAmountText = (v: number | null): string =>
  v === null ? '' : String(v);

// バラ単価・金額は、入力欄に入った時点の値（options.committed。省略時は draft）と比べて
// 値が変わったときだけ「直した」とみなす。変わっていなければ（入力欄に入って何も変えずに
// 離れた・打ち直して元の値に戻した）、入った時点の値と手で直した印をそのまま残す
//（もう一方の手で直した値も消さない）。
export const updateEntryBillingDraft = (
  draft: EntryBillingDraft,
  field: EntryBillingDraftField,
  value: string,
  reference: { seihan?: unknown; capacity?: unknown } | undefined,
  options: { focused?: boolean; committed?: EntryBillingDraft } = {}
): EntryBillingDraft => {
  if (field === 'unitPrice' || field === 'amount') {
    const committed = options.committed ?? draft;
    const before = toEntryNumber(committed[field]);
    const after = toEntryNumber(value);
    const unchanged =
      before === null ? after === null : isSameEntryNumber(value, before);
    if (unchanged)
      return {
        ...committed,
        // 入力中は入力中の文字のまま、離れたら入った時点の表示に戻す。
        [field]: options.focused === true ? value : committed[field],
      };
    // 変わったときは、入った時点の値を起点に決まりを当てる。
    draft = committed;
  }
  const next: EntryBillingDraft =
    field === 'product' ? { ...draft } : { ...draft, [field]: value };
  // 入力中のバラ単価・金額は、入力中の文字を書き換えない。
  const typingUnitPrice = options.focused === true && field === 'unitPrice';
  const typingAmount = options.focused === true && field === 'amount';
  const base = (): EntryBillingCalcInput => ({
    seihan: reference?.seihan,
    capacity: reference?.capacity,
    billNet: next.billNet,
    cases: next.cases,
    loose: next.loose,
  });
  const calcUnit = () => calcEntryUnitPrice(base());
  // 金額の計算に使うバラ単価：手で直した値・入力中の値（空欄なら計算した値）、
  // それ以外は計算した値（丸める前）。
  const effectiveUnit = (): number | null =>
    typingUnitPrice || next.unitPriceManual
      ? (toEntryNumber(next.unitPrice) ?? calcUnit())
      : calcUnit();
  const calcAmount = () =>
    calcEntryAmount({ ...base(), unitPrice: effectiveUnit() });

  const blank = toEntryNumber(value) === null;
  if (field === 'unitPrice') {
    next.unitPriceManual = !blank && !isSameEntryNumber(value, calcUnit());
    next.amountManual = false;
  } else if (field === 'amount') {
    next.amountManual = !blank && !isSameEntryNumber(value, calcAmount());
  } else if (field === 'billNet' || field === 'product') {
    next.unitPriceManual = false;
    next.amountManual = false;
  } else {
    next.amountManual = false; // ケース・バラ
  }
  if (!typingUnitPrice && !next.unitPriceManual)
    next.unitPrice = draftUnitPriceText(calcUnit());
  if (!typingAmount && !next.amountManual)
    next.amount = draftAmountText(calcAmount());
  return next;
};

// 計画に無いサマリ商品の明細か（計画NETが空欄）。合計行・サマリ商品の無い行は対象外。
export const isPlanMissingEntry = (row: AdditionalEntryData): boolean =>
  !row.isTotal &&
  !!row.productName &&
  (row.planNet === '' || row.planNet == null);

// 請求NETが計画NETを下回る明細か。どちらかが数値でなければ false。
const isBillNetBelowPlanNet = (row: AdditionalEntryData): boolean => {
  const plan = toEntryNumber(row.planNet);
  const bill = toEntryNumber(row.billNet);
  return plan !== null && bill !== null && bill < plan;
};

// 行を赤く表示する明細か（請求書有の追加口明細）。
//   ・サマリ商品で作った計画に紐づき、請求NET＜計画NET の明細
//   ・計画に無いサマリ商品の明細（計画NETが空欄）
// 一般卸メッシュで作った計画に紐づく明細は、請求NET＜計画NET でも赤くしない（自動で振り替えるため）。
export const isEntryAlertRow = (
  row: AdditionalEntryData | undefined
): boolean => {
  if (!row || row.isTotal) return false;
  if (isPlanMissingEntry(row)) return true;
  return row.planType === 'サマリ商品' && isBillNetBelowPlanNet(row);
};

// 一般卸メッシュの自動振替の対象か。取込・反映した請求EDI・AIC入力の明細だけが対象で、
// 手入力の明細（明細追加・手で直した明細）には行わない。
export const isAutoTransferTarget = (row: AdditionalEntryData): boolean =>
  !row.isTotal &&
  row.planType === '一般卸メッシュ' &&
  (row.dataSource === '請求EDI' || row.dataSource === 'AIC入力') &&
  isBillNetBelowPlanNet(row);

// 取込・反映の時点で行う一般卸メッシュの自動振替。
// 支払NET（追加口分）を計画NETにし（支払NET（全体）は請求NETのまま）、派生項目を計算し直す。
// 差（計画NET−請求NET）は拡売費バラ単価（NET未承認）になり、拡売費「未承認NET」の明細で支払う。
// 振り替えたら true を返す。データ元は変えない（担当者が直したのではないため）。
export const applyAutoTransfer = (row: AdditionalEntryData): boolean => {
  if (!isAutoTransferTarget(row)) return false;
  row.addNet = toEntryNumber(row.planNet) as number;
  recalcEntryRow(row);
  return true;
};

// センターフィ額（明細1行分）＝社外売上高単価×数量×センターフィ率。
// 数量は支払のバラ換算の本数（入数×支払ケース＋支払バラ）。円単位のため四捨五入する。
// 社外売上高単価・センターフィ率・数量のいずれかが無い行は 0。
export const computeCenterFeeAmount = (row: AdditionalEntryData): number => {
  if (row.isTotal) return 0;
  const seihan = toEntryNumber(row.seihan);
  const rate = toEntryNumber(row.centerFeeRate);
  const capacity = toEntryNumber(row.capacity) ?? 0;
  const payCases = toEntryNumber(row.payCases) ?? 0;
  const payLoose = toEntryNumber(row.payLoose) ?? 0;
  if (seihan === null || rate === null) return 0;
  return Math.round(seihan * (capacity * payCases + payLoose) * rate);
};

// 支払情報サマリのセンターフィ額（支払回1回分）＝追加口明細ごとのセンターフィ額の合計（合計行を除く）。
// 合計表のセンターフィ（請求詳細のセンターフィの合算 → computeBilledCenterFeeBreakdown）とは別の値になる。
export const computeEntryCenterFeeTotal = (
  rows: readonly AdditionalEntryData[]
): number =>
  rows.reduce(
    (sum, row) => (row.isTotal ? sum : sum + computeCenterFeeAmount(row)),
    0
  );

// 請求書無の追加口明細の派生項目を導く（→ 補足1-6 b21）：
//   追加口バラ単価 = 社外売上高単価 − 支払NET（追加口分）
//   追加口金額     =（入数×支払ケース ＋ 支払バラ）× 追加口バラ単価
//   支払金額       = 追加口金額（請求書無は拡売費金額（NET未承認）を持たないため）
// 金額項目は円単位で扱うため、算出結果は四捨五入する。
export const deriveWithoutInvoiceEntryRow = (
  row: WithoutInvoiceEntryRow
): WithoutInvoiceEntryRow => {
  const capacity = toEntryNumber(row.capacity);
  const seihan = toEntryNumber(row.seihan);
  const addNet = toEntryNumber(row.addNet);
  const cases = toEntryNumber(row.payCases);
  const loose = toEntryNumber(row.payLoose);
  if (seihan !== null && addNet !== null) row.addUnit = seihan - addNet;
  const addUnit = toEntryNumber(row.addUnit);
  if (addUnit !== null && (cases !== null || loose !== null)) {
    const qty = (capacity ?? 0) * (cases ?? 0) + (loose ?? 0);
    row.addAmount = Math.round(qty * addUnit);
  }
  row.payAmount = row.addAmount;
  return row;
};
