// 明細の「データ元」（当該明細がどの経路で作成されたか）。
// 追加口一覧・拡売費一覧の「データ元」列（No. の右・非活性）と、合計表のデータ元別の列で表示する。
// 値をそのまま画面の表示名として使う（表示名はこのファイルで一か所にまとめる）。
//   ・請求EDI … 請求EDI取込で作成した明細（支払詳細(追加口請求書有)だけにある）
//   ・AIC入力 … AIC（アサヒインフォメーションセンター）で入力した明細
//   ・手入力  … 画面で追加・入力した明細と、項目を手で直した明細
export const DATA_SOURCES = ['請求EDI', 'AIC入力', '手入力'] as const;

export type DataSource = (typeof DATA_SOURCES)[number];

// 画面の操作（明細追加・分割・引用など）で追加した明細と、手で直した明細のデータ元。
export const DEFAULT_DATA_SOURCE: DataSource = '手入力';

// 合計表のデータ元別の列（表示順）。画面ごとに持つ列が異なる（→ 補足3-2 3章）。
//   支払詳細(追加口請求書有) … 請求EDI・AIC入力・手入力
//   支払詳細(追加口請求書無) … AIC入力・手入力
//     （EDI を持たない画面のため、明細はAIC入力か手入力のどちらか。追加口・拡売費・支払情報の
//       3つの合計表とも同じ見出し。追加口明細はデータ元の区分を持たないため、追加口の金額は
//       データ元別のどの列にも入れず、合計・税率別にだけ入れる）
export const WITH_INVOICE_DATA_SOURCE_COLUMNS: readonly DataSource[] = [
  '請求EDI',
  'AIC入力',
  '手入力',
];
export const WITHOUT_INVOICE_DATA_SOURCE_COLUMNS: readonly DataSource[] = [
  'AIC入力',
  '手入力',
];
