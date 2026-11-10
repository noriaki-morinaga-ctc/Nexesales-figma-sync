// シミュレーション明細の追加に関する排他ルール（手売り／卸 共通）
//
// 要件:
// 1. 追加制限 … シミュレーション更新KEYが同じ明細は追加・変更できない（VL-04・VL-06）。
//    追加ボタンは非活性にせず、押下時に判定する（10/27 第4回 決定事項25）。
// 2. 重複追加可 … 同一計画は複数明細に追加できる（コピーで採番した _planKey を共有）。
//
// ※ かつて存在した「確定の排他」ルール（1計画につき確定は1明細のみ／同一商品の二重確定不可）は
//    廃止。確度はどの明細でも「確定」を選択可能とする（confirmBlockReason は常に null、
//    canSelectConfirm は常に true）。

// 排他判定に必要な行の最小構造（ProductData の部分集合）
export interface ConfirmRuleRow {
  id?: string;
  summaryProduct: string;
  probability?: string;
  _planKey?: string;
  _addedSeq?: number;
}

// シミュレーション更新KEY（7.バリデーション定義 VL-04・VL-06）の判定に使う行の項目。
export interface SimulationKeyRow {
  id?: string;
  targetMonth?: string;
  campaign?: string;
  probability?: string;
  summaryProduct?: string;
  wholesaleMesh?: string;
  section?: string;
  promotion?: string;
  net?: string;
  planPrice?: string;
  period?: string;
}

const keyPriceOf = (value?: string): number | null => {
  const parsed = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isNaN(parsed) ? null : parsed;
};

// シミュレーション更新KEY（対象年月・企画・確度・サマリ商品〔NET固定の定番商品は一般卸メッシュ〕・
// 商品区分・販促区分・納価〔NET入力・NET固定はNET〕、ギフトは販売期間も）が同じ明細が他にあるか。
// 企画・確度が未入力の明細はKEYが揃っていないため判定しない（未入力は必須チェックで止める）。
export const hasSameSimulationKey = (
  target: SimulationKeyRow,
  rows: SimulationKeyRow[],
  usesNetAsKey: (row: SimulationKeyRow) => boolean
): boolean => {
  if (!target.campaign || !target.probability) return false;
  const priceField = usesNetAsKey(target) ? 'net' : 'planPrice';
  const productOf = (row: SimulationKeyRow) =>
    row.summaryProduct || row.wholesaleMesh;
  return rows.some(
    (row) =>
      row.id !== target.id &&
      row.targetMonth === target.targetMonth &&
      row.campaign === target.campaign &&
      row.probability === target.probability &&
      productOf(row) === productOf(target) &&
      row.section === target.section &&
      (row.promotion ?? '') === (target.promotion ?? '') &&
      (row.period ?? '') === (target.period ?? '') &&
      keyPriceOf(row[priceField]) === keyPriceOf(target[priceField])
  );
};

// シミュレーション更新KEYの重複エラーの文言（MSG-E-012）。
export const simulationKeyDuplicateMessage = (operation: string): string =>
  `シミュレーション更新KEYが同一の明細が既に存在するため、${operation}できません。`;

// 確定の排他ルールは廃止。確定をブロックする理由は無い（常に確定可能）。
export const confirmBlockReason = (
  _target: ConfirmRuleRow,
  _rows: ConfirmRuleRow[]
): string | null => null;

// 「確定」を選択肢に含めてよいか。排他ルール廃止により常に true。
export const canSelectConfirm = (
  _target: ConfirmRuleRow,
  _rows: ConfirmRuleRow[]
): boolean => true;
