import type { CommonRateSettings } from '@/app/types/master';

// 既定設定（画面のツールバー表示値と揃える）。
// センターフィ率 8.70%／年契基本分 8.70%／取組強化マージン率 8.70%。
export const DEFAULT_COMMON_RATE_SETTINGS: CommonRateSettings = {
  centerFee: {
    method: '社外売上高',
    scope: '商流別',
    includePB: false,
    index: 1,
    value: 0.087,
  },
  annualContract: {
    method: '社外売上高',
    scope: '商流別',
    includePB: false,
    index: 1,
    value: 0.087,
  },
  incentive: {
    method: '社外売上高',
    scope: '商流別',
    includePB: false,
    index: 1,
    value: 0.087,
  },
};

// 年契基本分・取組強化マージン率の集計表反映先（補足4-1「集計表反映先の条件指定」）。
// 実装（utils/sales-plan/common/aggregationCalc.ts の annualContractToA/B/H・salesLinkedB 算出）に
// ロジックとして直接埋め込まれているため定数としては参照されないが、
// 反映先の仕様は以下のとおり（値としては使わないドキュメント目的のコメント）。
//   ・年契基本分：A口のみ☑時＝売上連動拡売費B口／□時＝売上連動拡売費A口+B口+本社口
//     （拡売費の集計「A口のみ」チェックと連動する）
//   ・取組強化マージン率：常に売上連動拡売費B口（補足4-1 取組強化マージン率 No.1〜3）
