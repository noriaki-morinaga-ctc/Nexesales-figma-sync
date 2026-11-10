// センターフィ・年契基本分・取組強化マージン率の金額算出 ─ 新_補足4-1。
//
//   社外売上高：(社外売単価×入数×函数)の集計 × 指数(%) × 入力値(率%)
//   納品金額  ：(納価×入数×函数)の集計 × 入力値(率%)   ※指数は乗じない
//   直接入力  ：入力値(金額)                              ※集計を行わない
//
// PB商品を除く／含むの選択は率で算出する場合のみ用いる（T5-01 補足）。
import type {
  CommonRateSetting,
  CommonRateBase,
} from '../../../constants/commonRateSettings';

export function computeCommonRateAmount(
  setting: CommonRateSetting,
  base: CommonRateBase
): number {
  // 直接入力：集計対象の指定は行わず、入力値をそのまま金額とする（T5-04）
  if (setting.method === '直接入力') return setting.value;

  if (setting.method === '納品金額') {
    // 納品金額から算出する場合は指数を乗じない（T5-03 の設計側整理）
    const total = setting.includePB
      ? base.deliveryAll
      : base.deliveryExcludingPB;
    return total * setting.value;
  }

  // 社外売上高から算出する場合のみ指数(%)を乗じる（T5-02 の設計側整理）
  const total = setting.includePB ? base.extSalesAll : base.extSalesExcludingPB;
  return total * (setting.index ?? 1) * setting.value;
}
