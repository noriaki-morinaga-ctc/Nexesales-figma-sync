// 全件エクスポート（全グリッド共通仕様）。
//
// 【仕様】画面で見えているものと同じ条件で、ページング（無限スクロール）だけ外した全件を出力する。
//   ・行：画面の絞り込み（検索条件・列フィルタ）と並び替えを反映した全件
//   ・列：非表示の列も含めた全列を、画面の並び順で出力する
//   ・値を持たない列（操作ボタン列など）は自動で除外する
//   ・値：数値は生の値（Excel では数値のセル）、それ以外は画面の表示値。値が無いセルは空欄
//        （画面の「-」は出力しない）
//   ・ファイル名：［ダウンロード内容］(全件)_yyyyMMddHHmmss.拡張子（日時は JST）。
//        ダウンロード内容は context.exportName、無ければ画面名（グリッドが複数ある画面は「画面名_表の見出し」）。
//        Excel のシート名も同じ（31文字まで）
//   ・CSV は BOM 付き UTF-8
//   ・Excel のみ、10,000件以上で注意・30,000件以上で強い警告の確認ダイアログを出す（CSV は出さない）
//   （画面設計標準 4.5）
//
// 【2つの経路】
//   (1) クライアントサイド行モデル（全行がブラウザ上にある）
//       画面のグリッドからそのまま出力する。AG Grid 既定の
//       exportedRows='filteredAndSorted' が「絞り込み・並び替えを反映した全件」に一致する。
//   (2) 無限スクロール／サーバーサイド行モデル（画面はロード済みの行しか持たない）
//       グリッドから出力すると読み込み済みの分しか出ないため、画面の絞り込み・並び替えを
//       サーバーへ渡して全件を取得し、画面外に使い捨てのグリッドを組んでそこから出力する。
//       この経路を使う画面は、グリッドの context に exportAll（GridExportAllSource）を持たせる。
import { createGrid } from 'ag-grid-community';
import type {
  ColDef,
  ColGroupDef,
  ColumnState,
  CsvExportParams,
  ExcelExportParams,
  FilterModel,
  GridApi,
  ProcessCellForExportParams,
} from 'ag-grid-community';
import { toast } from 'sonner';
import { getCurrentScreenTitle } from '../ui/screen-title';
import { requestConfirm } from '../ui/confirm-dialog';

// 全件取得時にサーバーへ渡す、画面の絞り込み・並び替えの状態
export interface GridExportAllFetchParams {
  // 列フィルタの状態（api.getFilterModel() の内容）
  filterModel: FilterModel;
  // 並び替えの状態（api.getColumnState() のうちソート指定を持つもの）
  sortModel: ColumnState[];
}

// サーバーから全件を取得する画面が context.exportAll に持たせる設定
export interface GridExportAllSource<TData = unknown> {
  // 画面の検索条件＋引数の絞り込み・並び替えを渡して全件を取得する
  fetchAll: (params: GridExportAllFetchParams) => Promise<TData[]>;
  // 画面と同じ列定義（一時グリッドの組み立てに使う）
  columnDefs: (ColDef<TData> | ColGroupDef)[];
  // valueGetter が参照する context を、取得した行から組み立てる。
  // 画面の context を使い回してはならない。行番号や他行参照は行配列から導出するため、
  // 画面が持つ行と取得した行が違うと値が欠落する（例：画面に無い行の行番号が空欄になる）。
  buildContext?: (rows: TData[]) => unknown;
}

// グリッド context のうち本モジュールが参照する部分
interface GridContextWithExport {
  exportAll?: GridExportAllSource;
  // ファイル名・シート名の［ダウンロード内容］。グリッドが複数ある画面で表を区別するときに指定する
  // （未指定は画面名）
  exportName?: string;
}

// 一時グリッドの置き場。画面外へ出す。
// 寸法0だと AG Grid が高さ不足の警告を出すため、実寸を与えたうえで画面外へ飛ばす。
const OFFSCREEN_STYLE =
  'position:fixed;left:-10000rem;top:0;width:62.5rem;height:37.5rem;';

// 一時グリッドは素の createGrid（Reactを介さない）で生成するため、
// React コンポーネントを指定したセルエディタ／セルレンダラーは解決できない。
// 出力値は valueGetter／valueFormatter から決まり、表示・編集用の指定は不要なため落とす。
const OMITTED_COL_PROPS = [
  'cellEditor',
  'cellEditorParams',
  'cellEditorPopup',
  'cellEditorSelector',
  'cellRenderer',
  'cellRendererParams',
  'cellRendererSelector',
  'editable',
  'onCellValueChanged',
  'cellStyle',
  'cellClass',
  'cellClassRules',
  'suppressKeyboardEvent',
] as const;

// 列定義から表示・編集用のプロパティを除く（列グループは子まで再帰的に処理する）
const toExportColumnDef = <TData>(
  column: ColDef<TData> | ColGroupDef
): ColDef<TData> | ColGroupDef => {
  if ('children' in column) {
    return { ...column, children: column.children.map(toExportColumnDef) };
  }
  const sanitized = { ...column } as Record<string, unknown>;
  OMITTED_COL_PROPS.forEach((prop) => delete sanitized[prop]);
  return sanitized as ColDef<TData>;
};

// 出力対象の列ID。非表示の列も含めた全列を画面の並び順で取り出し、値を持たない列は除く。
// 操作ボタンだけを置いた列（field も valueGetter も無い）はデータではないため出力しない。
const valueColumnKeys = (api: GridApi): string[] =>
  api
    .getAllGridColumns()
    .filter((column) => {
      const colDef = column.getColDef();
      return !!colDef.field || !!colDef.valueGetter;
    })
    .map((column) => column.getColId());

// 画面で値が無いことを示す表示（出力では空欄にする）
const EMPTY_MARKS = new Set(['-', '－']);

// 出力するセルの値。数値は生の値（Excel が数値のセルとして扱う）、それ以外は画面の表示値とする。
const exportCellValue = (params: ProcessCellForExportParams): string => {
  const raw: unknown = params.value;
  if (raw === null || raw === undefined || raw === '') return '';
  if (typeof raw === 'number') return Number.isFinite(raw) ? String(raw) : '';
  const shown = String(params.formatValue(raw) ?? '');
  return EMPTY_MARKS.has(shown.trim()) ? '' : shown;
};

// ファイル名に使えない文字（Windows）
const FILE_NAME_NG = /[\\/:*?"<>|]/g;
// Excel のシート名に使えない文字と長さの上限
const SHEET_NAME_NG = /[\\/:*?[\]]/g;
const SHEET_NAME_MAX = 31;

// Excel の件数確認（画面設計標準 4.5・4.9）。AG Grid での出力は Excel 50,000行が目安。
const EXCEL_NOTICE_ROWS = 10000;
const EXCEL_WARNING_ROWS = 30000;
const confirmExcelRowCount = (rowCount: number): Promise<boolean> => {
  if (rowCount < EXCEL_NOTICE_ROWS) return Promise.resolve(true);
  const count = rowCount.toLocaleString('ja-JP');
  return requestConfirm(
    rowCount >= EXCEL_WARNING_ROWS
      ? {
          title: 'Excel出力の確認（件数が非常に多い）',
          description: `${count}件を Excel に出力します。件数が非常に多いため、出力に時間がかかり、ブラウザが応答しなくなる場合があります。CSV出力も検討してください。出力しますか？`,
          confirmLabel: '出力',
        }
      : {
          title: 'Excel出力の確認',
          description: `${count}件を Excel に出力します。件数が多いため、出力に時間がかかる場合があります。出力しますか？`,
          confirmLabel: '出力',
        }
  );
};

// 出力日時（JST）を yyyyMMddHHmmss で返す
const jstTimestamp = (): string => {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return (
    part('year') +
    part('month') +
    part('day') +
    part('hour') +
    part('minute') +
    part('second')
  );
};

// 表の見出し（カードのタイトル・ペインのタイトル）
const TABLE_TITLE_SELECTOR =
  '.card-header-accent .font-bold, [data-slot="sheet-title"]';

// グリッドを囲むカード（またはペイン）の見出しを返す。
// グリッドの外側へ親をたどり、最初に見つかった見出しを使う。
// 他のグリッドも含む範囲まで来たら、そのグリッド専用の見出しは無いとみなす。
const tableTitleOf = (api: GridApi): string => {
  const root = document.querySelector(`[grid-id="${api.getGridId()}"]`);
  if (!root) return '';
  for (
    let el = root.parentElement;
    el && el !== document.body;
    el = el.parentElement
  ) {
    // 行の展開（masterDetail）の子グリッドは自分の中にあるので数えない
    const others = Array.from(el.querySelectorAll('[grid-id]')).filter(
      (other) => other !== root && !root.contains(other)
    );
    if (others.length > 0) return '';
    const title = el.querySelector(TABLE_TITLE_SELECTOR)?.textContent?.trim();
    if (title) return title;
  }
  return '';
};

// 画面に表示中のグリッドの数（行の展開の子グリッドは除く）
const topLevelGridCount = (): number => {
  const roots = Array.from(document.querySelectorAll('[grid-id]'));
  return roots.filter((r) => !roots.some((o) => o !== r && o.contains(r)))
    .length;
};

// ［ダウンロード内容］。グリッドの exportName を優先し、無ければ画面名。
// グリッドが複数ある画面では、画面名に表の見出しを付けて区別する（例：計画詳細_販売計画(詳細)）。
const exportNameOf = (
  api: GridApi,
  context: GridContextWithExport | undefined
): string => {
  if (context?.exportName) return context.exportName.trim();
  const screen = getCurrentScreenTitle().trim();
  const table = topLevelGridCount() > 1 ? tableTitleOf(api) : '';
  if (screen && table && table !== screen) return `${screen}_${table}`;
  return screen || table || '一覧';
};

// ファイル名（拡張子なし）とシート名
const exportNamesOf = (
  api: GridApi,
  context: GridContextWithExport | undefined
) => {
  const name = exportNameOf(api, context);
  return {
    fileName: `${name.replace(FILE_NAME_NG, '_')}(全件)_${jstTimestamp()}`,
    sheetName: name.replace(SHEET_NAME_NG, '_').slice(0, SHEET_NAME_MAX),
  };
};

// 画面の並び替え状態（ソート指定を持つ列のみ）
const sortModelOf = (api: GridApi): ColumnState[] =>
  api.getColumnState().filter((state) => !!state.sort);

// 生成済みのファイル内容をダウンロードさせる。
// 一時グリッド経由では AG Grid のダウンロード処理を使えないため自前で行う。
const downloadContent = (
  content: string | Blob,
  fileName: string,
  mimeType: string
): void => {
  // CSV（文字列）は BOM 付き UTF-8 にする（Excel で開いたときの文字化け防止）
  const blob =
    typeof content === 'string'
      ? new Blob(['\uFEFF' + content], { type: mimeType })
      : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // クリック直後の revoke はブラウザによってダウンロードが中断されるため次のタスクで解放する
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const EXCEL_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// サーバーから取得した全件を、画面外の一時グリッド経由で出力する。
const exportFetchedRows = async (
  source: GridExportAllSource,
  fetchParams: GridExportAllFetchParams,
  columnKeys: string[],
  format: 'csv' | 'excel',
  names: { fileName: string; sheetName: string }
): Promise<boolean> => {
  const rowData = await source.fetchAll(fetchParams);
  // 取得した全件の件数で Excel の件数確認をする（キャンセルなら何もしない）
  if (format === 'excel' && !(await confirmExcelRowCount(rowData.length)))
    return false;

  const host = document.createElement('div');
  host.style.cssText = OFFSCREEN_STYLE;
  document.body.appendChild(host);

  // 行データは gridOptions では渡さない。createGrid の時点では行モデルへの反映が
  // 完了しておらず（onGridReady も同様）、その状態で出力するとヘッダーだけの
  // 空ファイルになるため、生成後に setGridOption で明示的に投入する。
  const api = createGrid(host, {
    columnDefs: source.columnDefs.map(toExportColumnDef),
    context: source.buildContext?.(rowData),
  });

  // 絞り込み・並び替えはサーバー側で適用済みのため、一時グリッドでは何も掛けない。
  // よって exportedRows は 'all'（一時グリッド上の全行）でよい。
  const exportParams = {
    columnKeys,
    exportedRows: 'all' as const,
    processCellCallback: exportCellValue,
    sheetName: names.sheetName,
  };

  let content: string | Blob | undefined;
  try {
    api.setGridOption('rowData', rowData);
    // 行が入っていない状態で出力すると空ファイルを配ってしまうため、
    // 出力前に行数を確認して不整合なら中断する（呼び出し側でエラー通知する）。
    if (rowData.length > 0 && api.getDisplayedRowCount() === 0) {
      throw new Error('エクスポート用グリッドに行データを反映できませんでした');
    }
    // exportDataAsExcel／exportDataAsCsv は使わない。内部で「エクスポート中」オーバーレイの
    // 表示を await してから行データを収集するため（overlays.showExportOverlay が async）、
    // 収集が走る前に一時グリッドを破棄してしまい本文が空になる。
    // getDataAsExcel／getDataAsCsv は同期的にファイル内容を返すので、破棄前に取得できる。
    content =
      format === 'excel'
        ? api.getDataAsExcel(exportParams)
        : api.getDataAsCsv(exportParams);
  } finally {
    api.destroy();
    host.remove();
  }

  if (!content) {
    throw new Error('エクスポートファイルを生成できませんでした');
  }
  const fileName = `${names.fileName}.${format === 'excel' ? 'xlsx' : 'csv'}`;
  downloadContent(
    content,
    fileName,
    format === 'excel' ? EXCEL_MIME : 'text/csv'
  );
  return true;
};

// 全件エクスポートを実行する（共通コンテキストメニューから呼ばれる）。
export async function exportGridAllRows(
  api: GridApi,
  context: unknown,
  format: 'csv' | 'excel'
): Promise<void> {
  const columnKeys = valueColumnKeys(api);
  const exportContext = context as GridContextWithExport | undefined;
  const source = exportContext?.exportAll;
  const names = exportNamesOf(api, exportContext);

  if (!source) {
    // クライアントサイド行モデル：全行がブラウザ上にあるため画面のグリッドから出力する。
    // exportedRows は既定（'filteredAndSorted'）のまま＝絞り込み・並び替えを反映した全件。
    // CSV の BOM は AG Grid が付ける。
    const exportParams: CsvExportParams & ExcelExportParams = {
      columnKeys,
      processCellCallback: exportCellValue,
    };
    if (format === 'excel') {
      // 絞り込み後の行数で件数確認をする（キャンセルなら何もしない）
      if (!(await confirmExcelRowCount(api.getDisplayedRowCount()))) return;
      api.exportDataAsExcel({
        ...exportParams,
        fileName: `${names.fileName}.xlsx`,
        sheetName: names.sheetName,
      });
    } else {
      api.exportDataAsCsv({
        ...exportParams,
        fileName: `${names.fileName}.csv`,
      });
    }
    toast.success('エクスポートが完了しました');
    return;
  }

  const exported = await exportFetchedRows(
    source,
    { filterModel: api.getFilterModel(), sortModel: sortModelOf(api) },
    columnKeys,
    format,
    names
  );
  if (exported) toast.success('エクスポートが完了しました');
}
