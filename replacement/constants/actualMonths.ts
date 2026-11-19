// 実績反映月の定義（モック共通）。
// 年間の表は1〜12月を持つが、当年の途中までは実績、それ以降は計画値となる。
// モックでは「1月〜5月を実績反映済み」として固定し、実績セルの強調表示（青枠）に使用する。
export const ACTUAL_REFLECTED_MONTHS: readonly string[] = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
];
