// 請求詳細（請求EDI取込／AIC入力）の単価系の数値桁。
//
// 数量×請求書記載単価・請求単価・請求書記載単価は、いずれも小数第2位まで
//（端数は四捨五入）で揃える。モックデータや算出結果の桁がばらついても画面表示は
// この桁に統一し、手入力欄は確定時にも同じ桁へ丸めて保持する
//（→ 販売計画の planDetailNumberFormat と同方針）。
export const BILLING_UNIT_PRICE_DIGITS = 2;

// 指定桁への丸め（四捨五入）。
// Number.toFixed は2進表現の誤差で桁上がりを落とすこと（例: (95.365).toFixed(2) === '95.36'）が
// あり、Math.round は負数で0側へ寄る（例: Math.round(-3830.5) === -3830）。
// 取消の明細は数量・単価がマイナスで連携されるため負数も正しく丸める必要があり、
// toLocaleString（既定の丸めは halfExpand ＝ 四捨五入）で文字列化してから数値へ戻す。
export const roundBillingNumber = (
  value: number,
  digits: number = BILLING_UNIT_PRICE_DIGITS
): number =>
  Number(
    value.toLocaleString('ja-JP', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      useGrouping: false,
    })
  );

// 単価系の表示（小数第2位まで固定・3桁区切り）。
// 端数の無い値も 0 を補って桁を揃える（例: 2080 → 2,080.00／20.8 → 20.80）。
// 未入力（null）・数値として読めない値は空欄にする。
export const formatBillingUnitPrice = (
  value: unknown,
  digits: number = BILLING_UNIT_PRICE_DIGITS
): string =>
  typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('ja-JP', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : '';
