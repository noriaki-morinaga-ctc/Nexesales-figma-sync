import { AG_GRID_LOCALE_JP } from '@ag-grid-community/locale';

/**
 * AG Grid 日本語ロケール設定
 *
 * AG Grid 公式の完全な日本語ロケール（AG_GRID_LOCALE_JP）を土台とし、
 * その上にプロジェクト独自の表記だけを上書きする。
 * 公式を土台にすることで、手書きサブセットでは未定義だったキー
 * （フィルターUIの一部など）が英語にフォールバックする問題を防ぐ。
 *
 * ※ 下記の上書きは「公式と表記を変えたいもの」のみ。
 *   新たに英語表記が見つかった場合は、まず公式ロケールに含まれていないか確認し、
 *   含まれていれば上書き不要（自動で日本語化される）。
 */
export const AG_GRID_LOCALE_JA = {
  // 公式の完全な日本語ロケール（未定義キーの英語化を防ぐ土台）
  ...AG_GRID_LOCALE_JP,

  // =========================================
  // プロジェクト独自の表記（公式より優先）
  // =========================================

  // フィルタ（「フィルター」ではなく「フィルタ」で統一）
  filterOoo: 'フィルタ...',
  equals: '等しい',
  notEqual: '等しくない',
  lessThan: '未満',
  greaterThan: 'より大きい',
  lessThanOrEqual: '以下',
  greaterThanOrEqual: '以上',
  inRange: '範囲内',
  contains: '含む',
  notContains: '含まない',
  startsWith: '始まる',
  endsWith: '終わる',
  blank: '空白',
  notBlank: '空白でない',
  blanks: '空白',
  andCondition: 'AND',
  orCondition: 'OR',
  applyFilter: 'フィルタを適用',
  clearFilter: 'フィルタをクリア',
  resetFilter: 'フィルタをリセット',
  dateFormatOoo: 'yyyy-mm-dd',

  // ソート
  sortAscending: '昇順に並び替え',
  sortDescending: '降順に並び替え',
  sortUnSort: 'ソート解除',

  // 列メニュー
  pinColumn: '列を固定',
  pinLeft: '左に固定',
  pinRight: '右に固定',
  noPin: '固定解除',
  groupBy: 'グループ化',
  ungroupBy: 'グループ解除',
  autosizeThisColumn: 'この列の幅を自動調整',
  autosizeAllColumns: 'すべての列を自動サイズ調整',
  resetColumns: '列設定をリセット',
  expandAll: 'すべて展開',
  collapseAll: 'すべて折りたたむ',
  pivotMode: 'ピボットモード',

  // コンテキストメニュー
  cut: '切り取り',
  copy: 'コピー',
  copyWithHeaders: 'ヘッダー付きコピー',
  copyWithGroupHeaders: 'グループヘッダー付きコピー',
  paste: '貼り付け',
  pasteFromClipboard: 'クリップボードから貼り付け',
  export: 'エクスポート',
  csvExport: 'CSV出力',
  excelExport: 'Excel出力',
  exportingOoo: 'エクスポート中...', // エクスポート中のオーバーレイ（画面設計標準 4.5）
  columnChooser: '列選択', // コンテキストメニュー項目名
  chooseColumns: '列選択', // 列選択ダイアログタイトル

  // 検索・選択
  selectAll: 'すべて選択',
  searchOoo: '検索...',

  // ページネーション
  page: 'ページ',
  to: 'から',
  of: 'の',
  next: '次へ',
  last: '最後へ',
  first: '最初へ',
  previous: '前へ',

  // その他
  // 0件時の文言（画面設計標準 4.7）。検索結果0件と列フィルタで0件を区別し、画面ごとに変えない
  noRowsToShow: '該当するデータがありません',
  noMatchingRows: 'フィルタの条件に一致する行がありません',
  loadingOoo: '読み込み中...',
  enabled: '有効',
  disabled: '無効',
};
