// 支払詳細(追加口請求書無)：追加口一覧。
// 支払詳細(追加口請求書有)の追加口明細グリッドを基準に、請求書に関わる列と入力用の列を外した
// 構成とする（→ 課題 No.1534／20260911_第34回 決定事項6・7。第16回 決定事項14「生販・単価・
// NET・入数を持つ」の具体化）。列の並び・取得方法は請求書有に合わせ、全項目を非活性（参照のみ）
// とする。拡売費と違って分割がないため親行・子行（枝行）は持たず、請求書有と同じく1行ずつが
// 明細番号（No.）を持つ。
// グリッドの上に合計表（追加口計。請求書有と同じ形）を出す。請求書を受領しないため、
// 請求・差額の行は「-」とする。追加口明細はデータ元の区分を持たない（データ元の列も持たない）ため、
// 合計表のデータ元別（AIC入力・手入力）の列には入れず、常に「-」になる。
// センターフィは本画面では扱わない。アンマッチ区分・差異理由は Ｂパターンでは発生しないため設けない
// （→ 20260710_第16回 決定事項14、20260714_第17回 決定事項13）。
import {
  useMemo,
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { AgGridReact } from 'ag-grid-react';
import type {
  ColDef,
  ColGroupDef,
  CellMouseOverEvent,
  GridReadyEvent,
  GridApi,
} from 'ag-grid-community';
import {
  GRID_DEFAULT_COL_DEF,
  GRID_BASE_PROPS,
  GRID_STATUS_BAR,
  GRID_COLORS,
  detailGridInitialHeight,
  gridFilterContextMenuItems,
  useGridColumnState,
  GRID_NUMBER_TEXT_FILTER,
  GRID_EMPTY_TEXT,
} from '../../../grid';
import { CollapsibleCard } from '../../../ui/collapsible-card';
import { CARD_TITLE_CLASS } from '../../../../../styles/commonStyles';
import { WITHOUT_INVOICE_DATA_SOURCE_COLUMNS } from '../../../../constants/dataSource';
import { createWithoutInvoiceEntryRows } from '../../../../constants/paymentWithoutInvoiceMockData';
import { toEntryNumber as toNum } from '../../../../utils/payment/payment-detail/additionalEntryRules';
import { computeWithoutInvoiceEntryBreakdown as computeEntryBreakdown } from '../../../../utils/payment/payment-detail/paymentBreakdownItems';
import type { AmountBreakdown } from '../../../../utils/payment/payment-detail/paymentAmountBreakdown';
import { PaymentAmountBreakdownTable } from '../../../shared/payment/payment-detail/PaymentAmountBreakdownTable';
import { useResizableHeight, ResizeHandle } from '../../../ui/resizable-panel';

// 追加口明細データ（本グリッドの1行）。項目名・フィールド名は請求書有の追加口明細
// （AdditionalEntryData）に合わせる。親行・子行（枝行）は持たず、1行ずつが明細番号（No.）を持つ。
export interface EntryRow {
  lineNo: number; // No.（明細番号。行の識別にも使う）
  productCode: string; // サマリ商品コード
  productName: string; // サマリ商品名
  capacity: number | string; // 入数
  // 計画情報
  seihan: number | string; // 社外売上高単価
  planNet: number | string; // 計画NET
  // 支払情報
  addNet: number | string; // 支払NET（追加口分）
  payCases: number | string; // ケース
  payLoose: number | string; // バラ
  addUnit: number | string; // 追加口バラ単価
  addAmount: number | string; // 追加口金額
  payAmount: number | string; // 支払金額
  summary: string; // 摘要2（社外用）
  summary1: string; // 摘要1（社内用）
}

// 数値表示（カンマ区切り、空は「-」）。
const numFmt = (params: { value: unknown }) => {
  const v = params.value;
  if (v === '' || v === null || v === undefined) return GRID_EMPTY_TEXT;
  if (typeof v === 'number') return v.toLocaleString();
  return String(v);
};

// ツールチップ用に値を桁区切り文字列へ整形する（数値化できなければそのまま）。
const fmtN = (v: unknown): string => {
  const n = toNum(v);
  return n === null ? String(v ?? '') : n.toLocaleString();
};

// 指定セル（行・列field）の計算式情報を返す。計算式が無いセルは null。
//  refKeys は `field::rowId` 形式（cellClassRules での枠線ハイライト判定に使う）。
const getFormula = (
  row: EntryRow,
  field: string
): { tooltip: string; refKeys: string[] } | null => {
  const refsOf = (fields: string[]) => fields.map((f) => `${f}::${row.lineNo}`);
  switch (field) {
    case 'addUnit':
      return {
        tooltip: `追加口バラ単価 ＝ 社外売上高単価 − 支払NET（追加口分） ＝ ${fmtN(row.seihan)} − ${fmtN(row.addNet)}`,
        refKeys: refsOf(['seihan', 'addNet']),
      };
    case 'addAmount':
      return {
        tooltip: `追加口金額 ＝（入数 × 支払ケース ＋ 支払バラ）× 追加口バラ単価 ＝（${fmtN(row.capacity)} × ${fmtN(row.payCases)} ＋ ${fmtN(row.payLoose)}）× ${fmtN(row.addUnit)}`,
        refKeys: refsOf(['capacity', 'payCases', 'payLoose', 'addUnit']),
      };
    case 'payAmount':
      return {
        tooltip: `支払金額 ＝ 追加口金額 ＝ ${fmtN(row.addAmount)}`,
        refKeys: refsOf(['addAmount']),
      };
    default:
      return null;
  }
};

// 全項目が非活性（参照のみ）のため、データ行は灰（readonly）で統一する。
const rightStyle = () => ({
  backgroundColor: GRID_COLORS.readonly,
  textAlign: 'right' as const,
});
// display:block で AG Grid 既定の flex 中央寄せを打ち消し、
// text-align:left を効かせる。
const leftStyle = () => ({
  backgroundColor: GRID_COLORS.readonly,
  display: 'block' as const,
  textAlign: 'left' as const,
});

// 支払回数1の追加口明細を新規生成する（モックデータ → constants/paymentWithoutInvoiceMockData）。
// 画面は支払回数ごとのデータセットを initialRows で渡す。派生項目（追加口バラ単価・追加口金額・
// 支払金額）は utils/payment/payment-detail/additionalEntryRules の deriveWithoutInvoiceEntryRow で導く。
export const createEntryRows = (): EntryRow[] =>
  createWithoutInvoiceEntryRows('1');

// 親へ公開するハンドル。
export interface DetailTableHandle {
  // 表示中の明細行（支払回数の切替時に退避するため）。
  getRows: () => EntryRow[];
}

interface DetailTableProps {
  // 表示する追加口明細（支払回数ごとのデータセット）。未指定時は既定データを生成する。
  initialRows?: EntryRow[];
  // 合計表（追加口計）の通知。親が支払情報カードの合計表へ渡す。
  onBreakdownChange?: (breakdown: AmountBreakdown) => void;
}

export const DetailTable = forwardRef<DetailTableHandle, DetailTableProps>(
  function DetailTable({ initialRows, onBreakdownChange }, ref) {
    // AG Grid API（ハイライト再描画用）。
    const gridApiRef = useRef<GridApi | null>(null);

    // 表示中の明細（支払回数ごとに独立した実体を持つ）。
    const [entryRows] = useState<EntryRow[]>(
      () => initialRows ?? createEntryRows()
    );

    useImperativeHandle(ref, () => ({ getRows: () => entryRows }), [entryRows]);

    // タイトル下の合計表（追加口計）。支払情報カードの合計表にも使う。
    // 明細は参照のみで変わらないため、表示する明細が決まったときに1回だけ集計する。
    const breakdown = useMemo(
      () => computeEntryBreakdown(entryRows),
      [entryRows]
    );

    // 合計表を親へ通知する（親が支払情報カードの合計表へ渡す）。
    useEffect(() => {
      onBreakdownChange?.(breakdown);
    }, [breakdown, onBreakdownChange]);

    // 列幅・並び順・ソートの永続化。画面独自の onGridReady はフックのオプション経由で
    // 実行する（spread で共通の onGridReady を上書きしないため）。
    // ※列構成を変更したらキーの版数を上げて旧状態を破棄する。
    const gridColumnStateProps = useGridColumnState(
      '支払詳細B.追加口.columnState.v1',
      {
        onGridReady: (event: GridReadyEvent) => {
          gridApiRef.current = event.api;
        },
      }
    );

    // カードの開閉状態（既定は展開。支払詳細(追加口請求書有)の追加口カードと同様）。
    const [isCardOpen, setIsCardOpen] = useState(true);

    // グリッドの縦幅（リサイズハンドルのドラッグで手動調整可能）。
    const GRID_MIN_HEIGHT = 240; // 縮めすぎ防止の下限
    // 既定の高さは 支払詳細(自販機) の「支払明細情報」と同じ算出式で揃える
    //（grid/ の detailGridInitialHeight）。
    const gridResize = useResizableHeight({
      defaultHeight: detailGridInitialHeight,
      minHeight: GRID_MIN_HEIGHT,
      maxHeight: Infinity,
    });
    const gridHeight = gridResize.height;

    // 計算式セルにマウスオーバー中、計算に使われる参照元セル（`field::rowId`）の集合。
    // ref で保持し cellClassRules から最新値を参照、変更時に refreshCells で枠線を反映する。
    const hoverRefsRef = useRef<Set<string>>(new Set());
    const setHoverRefs = (keys: string[]) => {
      const next = new Set(keys);
      const cur = hoverRefsRef.current;
      // 同一集合なら再描画しない（マウス移動中の無駄な再描画を抑止）。
      if (cur.size === next.size && [...next].every((k) => cur.has(k))) return;
      hoverRefsRef.current = next;
      gridApiRef.current?.refreshCells({ force: true });
    };

    // 計算式セルにマウスオーバーしたら、計算に使われる参照元セルをハイライト対象にする。
    const handleCellMouseOver = (e: CellMouseOverEvent) => {
      const field = e.colDef?.field;
      const row = e.data as EntryRow | undefined;
      const f = field && row ? getFormula(row, field) : null;
      setHoverRefs(f ? f.refKeys : []);
    };

    // セルから外れたらハイライトを解除する。
    const handleCellMouseOut = () => setHoverRefs([]);

    // 列の並び・幅は支払詳細(追加口請求書有)の追加口明細に合わせる。
    const columnDefs = useMemo<(ColDef | ColGroupDef)[]>(
      () => [
        {
          headerName: 'No.',
          field: 'lineNo',
          width: 56,
          // 先頭列（aria-colindex=1）は grid.css で display:flex・中央寄せが強制されるため、
          // text-align では左寄せにできない。左寄せ用クラス（justify-content:flex-start）を付与する。
          cellClass: 'ag-cell-left-pinned',
          cellStyle: leftStyle,
        },
        {
          // 項目名は拡売費明細・請求詳細に合わせる（→ 20260821_第31回 決定事項7）。
          headerName: 'サマリ商品コード',
          field: 'productCode',
          width: 88,
          cellStyle: leftStyle,
        },
        {
          headerName: 'サマリ商品名',
          field: 'productName',
          width: 240,
          cellStyle: leftStyle,
        },
        {
          headerName: '入数',
          field: 'capacity',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 56,
          valueFormatter: numFmt,
          cellStyle: rightStyle,
        },
        {
          // 計画紐づけ情報。社外売上高単価・計画NETとも販売計画から引く。
          headerName: '計画情報',
          children: [
            {
              headerName: '社外売上高単価',
              field: 'seihan',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 104,
              valueFormatter: numFmt,
              cellStyle: rightStyle,
            },
            {
              headerName: '計画NET',
              field: 'planNet',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 72,
              valueFormatter: numFmt,
              cellStyle: rightStyle,
            },
          ],
        },
        {
          // 支払情報。請求書有にある支払NET（全体）・拡売費バラ単価（NET未承認）・
          // 拡売費金額（NET未承認）は持たない（→ 課題 No.1534）。
          headerName: '支払情報',
          children: [
            {
              headerName: '支払NET（追加口分）',
              field: 'addNet',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 128,
              valueFormatter: numFmt,
              cellStyle: rightStyle,
            },
            {
              headerName: 'ケース',
              field: 'payCases',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 64,
              valueFormatter: numFmt,
              cellStyle: rightStyle,
            },
            {
              headerName: 'バラ',
              field: 'payLoose',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 56,
              valueFormatter: numFmt,
              cellStyle: rightStyle,
            },
            {
              headerName: '追加口バラ単価',
              field: 'addUnit',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 112,
              valueFormatter: numFmt,
              cellStyle: rightStyle,
            },
            {
              headerName: '追加口金額',
              field: 'addAmount',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 88,
              valueFormatter: numFmt,
              cellStyle: rightStyle,
            },
            {
              headerName: '支払金額',
              field: 'payAmount',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 88,
              valueFormatter: numFmt,
              cellStyle: rightStyle,
            },
          ],
        },
        {
          headerName: '摘要2（社外用）',
          field: 'summary',
          width: 160,
          cellStyle: leftStyle,
        },
        {
          headerName: '摘要1（社内用）',
          field: 'summary1',
          width: 192,
          cellStyle: leftStyle,
        },
      ],
      []
    );

    const defaultColDef: ColDef = useMemo(
      () => ({
        // 共通の既定列定義（grid/）。ソート/リサイズ/フィルター・ヘッダーtooltip 等を内包。
        ...GRID_DEFAULT_COL_DEF,
        // 空欄（''）を含む数値列が "Invalid Number" 表示になるのを防ぐ（請求書有と同じ）。
        cellDataType: false,
        // 計算式セルは計算式テキストを、それ以外は従来どおりセル値をツールチップ表示する。
        tooltipValueGetter: (params) => {
          const field = params.colDef.field;
          const row = params.data as EntryRow | undefined;
          if (field && row) {
            const f = getFormula(row, field);
            if (f) return f.tooltip;
          }
          return params.value ?? '';
        },
        // マウスオーバー中の計算式セルの参照元セル（`field::rowId`）に枠線を付ける。
        cellClassRules: {
          'formula-ref-highlight': (params) => {
            const field = params.colDef.field;
            const rowId = params.node?.id ?? '';
            return !!field && hoverRefsRef.current.has(`${field}::${rowId}`);
          },
        },
      }),
      []
    );

    return (
      <CollapsibleCard
        title="追加口"
        open={isCardOpen}
        onOpenChange={setIsCardOpen}
        contentClassName="p-4"
      >
        {/* 合計表（請求／支払／差額 × 合計・税率別・データ元別。請求書有の追加口カードと同じ形）。
              請求書を受領しないため請求・差額の行は「-」とする。 */}
        <PaymentAmountBreakdownTable
          className="mb-4"
          ariaLabel="追加口の合計"
          items={[
            {
              label: '合計',
              breakdown,
              isBillUnavailable: true,
            },
          ]}
          dataSourceColumns={WITHOUT_INVOICE_DATA_SOURCE_COLUMNS}
          negativeFormat="minus"
        />

        {/* AG Grid（縦幅はリサイズハンドルで可変。JS動的値のため inline style 許容） */}
        <div
          className="additional-entry-grid"
          style={{ height: gridHeight, width: '100%' }}
        >
          {/* 罫線・ヘッダ背景・行高は共通テーマ（GRID_THEME）に委譲。
            formula-ref-highlight：計算式セルのホバー時に計算元セルへ青枠（内側）を付与する。 */}
          <style>{`
          .additional-entry-grid .ag-cell.formula-ref-highlight {
            box-shadow: inset 0 0 0 2px var(--grid-source-highlight-border);
          }
        `}</style>
          <AgGridReact
            rowData={entryRows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            // 計算式をツールチップで見せるため、省略されていないセルでも出す（グローバルは whenTruncated）
            tooltipShowMode="standard"
            getRowId={(p) => String((p.data as EntryRow).lineNo)}
            getContextMenuItems={gridFilterContextMenuItems}
            onCellMouseOver={handleCellMouseOver}
            onCellMouseOut={handleCellMouseOut}
            suppressMovableColumns={true}
            ensureDomOrder={true}
            // 横スクロールバーを常時表示し、左右スクロールの存在を分かりやすくする
            alwaysShowHorizontalScroll={true}
            tooltipShowDelay={300}
            statusBar={GRID_STATUS_BAR}
            {...GRID_BASE_PROPS}
            {...gridColumnStateProps}
          />
        </div>

        {/* リサイズハンドル：上下ドラッグでグリッドの縦幅を手動調整する。 */}
        <div className="relative h-2">
          <ResizeHandle
            onMouseDown={gridResize.handleMouseDown}
            ariaLabel="追加口一覧の高さを変更"
          />
        </div>
      </CollapsibleCard>
    );
  }
);
