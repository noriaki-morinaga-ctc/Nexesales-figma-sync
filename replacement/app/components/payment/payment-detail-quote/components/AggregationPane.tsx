// 支払詳細(引用)画面用：AggregationPane をベースに作成
import { useState, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ColGroupDef, GetRowIdParams } from 'ag-grid-community';
import {
  GRID_DEFAULT_COL_DEF,
  GRID_BASE_PROPS,
  gridFilterContextMenuItems,
  GRID_NUMBER_TEXT_FILTER,
} from '../../../grid';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../../ui/collapsible';
import { ChevronDown } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// 列定義（実績・請求 比較表）
interface ColDefItem {
  key: string;
  name: string;
  width: number;
}

const COLS: ColDefItem[] = [
  { key: 'jisFn', name: '実販函数', width: 100 },
  { key: 'billFn', name: '請求函数', width: 100 },
  { key: 'extSales', name: '社外売上高', width: 120 },
  { key: 'marginRate', name: 'マージン率', width: 90 },
  { key: 'cfAmount', name: 'ＣＦ額', width: 90 },
  { key: 'cfRate', name: 'ＣＦ率', width: 80 },
  { key: 'addAmount', name: '追加口金額', width: 110 },
  { key: 'addRate', name: '追加口率', width: 90 },
  { key: 'expUnapproved', name: '拡売費(NET未承認)', width: 130 },
  { key: 'exp', name: '拡売費', width: 100 },
];

// 行定義
type RowKind = 'confirm' | 'plan' | 'diff' | 'errRate' | 'prev' | 'ratio';
interface RowDefItem {
  label: string;
  kind: RowKind;
  vals: Record<string, string>;
}

const ROWS: RowDefItem[] = [
  {
    label: '確定実績・請求書',
    kind: 'confirm',
    vals: {
      jisFn: '5,895',
      billFn: '5,890',
      extSales: '16,492,000',
      delivery: '10,602,000',
      payNet: '9,541,800',
      marginRate: '10.0%',
      cfAmount: '265,050',
      cfRate: '2.5%',
      addAmount: '6,950,200',
      addRate: '42.1%',
      expUnapproved: '45,998',
      exp: '100,000',
    },
  },
  {
    label: '販売計画書',
    kind: 'plan',
    vals: {
      jisFn: '5,910',
      billFn: '5,910',
      extSales: '16,548,000',
      delivery: '10,638,000',
      payNet: '9,574,200',
      marginRate: '10.0%',
      cfAmount: '265,950',
      cfRate: '2.5%',
      addAmount: '6,973,800',
      addRate: '42.1%',
      expUnapproved: '–',
      exp: '120,000',
    },
  },
  {
    label: '計画差',
    kind: 'diff',
    vals: {
      jisFn: '-15',
      billFn: '-20',
      extSales: '-56,000',
      delivery: '-36,000',
      payNet: '-32,400',
      marginRate: '0.0%',
      cfAmount: '-900',
      cfRate: '0.0%',
      addAmount: '-23,600',
      addRate: '0.0%',
      expUnapproved: '–',
      exp: '-20,000',
    },
  },
  {
    label: '計画誤差率',
    kind: 'errRate',
    vals: {
      jisFn: '-0.3%',
      billFn: '-0.3%',
      extSales: '-0.3%',
      delivery: '-0.3%',
      payNet: '-0.3%',
      marginRate: '0.0%',
      cfAmount: '-0.3%',
      cfRate: '0.0%',
      addAmount: '-0.3%',
      addRate: '0.0%',
      expUnapproved: '–',
      exp: '-20.0%',
    },
  },
  {
    label: '前年実績',
    kind: 'prev',
    vals: {
      jisFn: '5,857',
      billFn: '5,857',
      extSales: '15,696,760',
      delivery: '9,956,900',
      payNet: '8,961,210',
      marginRate: '10.0%',
      cfAmount: '248,923',
      cfRate: '2.5%',
      addAmount: '6,735,550',
      addRate: '42.9%',
      expUnapproved: '23,009',
      exp: '120,000',
    },
  },
  {
    label: '前年比',
    kind: 'ratio',
    vals: {
      jisFn: '100.6%',
      billFn: '100.6%',
      extSales: '105.1%',
      delivery: '106.5%',
      payNet: '106.5%',
      marginRate: '100.0%',
      cfAmount: '106.5%',
      cfRate: '100.0%',
      addAmount: '103.2%',
      addRate: '98.2%',
      expUnapproved: '199.9%',
      exp: '83.3%',
    },
  },
];

// グラフ用データ
const toNum = (s: string) => parseFloat(s.replace(/[,%]/g, '')) || 0;
const GRAPH_METRICS = [
  { key: 'extSales', name: '社外売上高' },
  { key: 'addAmount', name: '追加口金額' },
  { key: 'expUnapproved', name: '拡売費(NET未承認)' },
  { key: 'exp', name: '拡売費' },
];

// 行IDは行種別（ROWS で行ごとに一意。→ 画面設計標準 4.7）
const getRowId = (params: GetRowIdParams<{ _kind: RowKind }>) =>
  params.data._kind;

export function AggregationPane() {
  const [isOpen, setIsOpen] = useState(true);
  const [view, setView] = useState<'table' | 'graph'>('table');

  const confirmRow = ROWS.find((r) => r.kind === 'confirm')!;
  const planRow = ROWS.find((r) => r.kind === 'plan')!;
  const prevRow = ROWS.find((r) => r.kind === 'prev')!;

  const graphData = useMemo(
    () =>
      GRAPH_METRICS.map((m) => ({
        name: m.name,
        確定実績・請求書: toNum(confirmRow.vals[m.key]),
        販売計画書: toNum(planRow.vals[m.key]),
        前年実績: toNum(prevRow.vals[m.key]),
      })),
    [confirmRow, planRow, prevRow]
  );

  // 行データ（確定実績・請求書 〜 前年比）
  const rowData = useMemo(
    () => ROWS.map((r) => ({ label: r.label, _kind: r.kind, ...r.vals })),
    []
  );

  // 値セルのスタイル（データ行は右寄せ）
  const valueCellStyle = () => ({ textAlign: 'right' as const });

  const buildValueCol = (c: ColDefItem): ColDef => ({
    headerName: c.name,
    field: c.key,
    // 表全体の横幅いっぱいに広げる（最小幅は確保）
    flex: 1,
    minWidth: c.width,
    sortable: false,
    ...GRID_NUMBER_TEXT_FILTER,
    cellStyle: valueCellStyle,
  });

  const columnDefs: (ColDef | ColGroupDef)[] = useMemo(() => {
    const defs: (ColDef | ColGroupDef)[] = [
      {
        headerName: '表示項目',
        field: 'label',
        width: 150,
        sortable: false,
        filter: true,
        // 中身は左寄せ（grid.css の ag-cell-left-pinned）。
        // 先頭列に強制される中央寄せ・padding:0 を解除し、他セルと同じ左右余白に戻す。
        cellClass: 'ag-cell-left-pinned',
      },
      ...COLS.map((c) => buildValueCol(c)),
    ];
    return defs;
  }, []);

  const defaultColDef: ColDef = useMemo(
    () => ({
      // 共通の既定列定義（grid/）。ヘッダーの…メニュー・フィルターボタン非表示、
      // tooltip 等を内包（販売計画詳細と統一）。本表はソート対象外のため上書き。
      ...GRID_DEFAULT_COL_DEF,
      sortable: false,
      cellDataType: false,
    }),
    []
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
        <div className="bg-white px-3 pt-2 pb-4 card-header-accent flex items-center justify-between">
          <span className="text-gray-900 font-bold text-lg">
            支払情報サマリ
          </span>

          <div className="flex items-center gap-3">
            <CollapsibleTrigger className="hover:text-blue-700 transition-colors">
              <ChevronDown
                className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent>
          <div className="p-4">
            {view === 'table' ? (
              <div
                className="jbr-actual-bill-grid"
                style={{ height: 300, width: '100%' }}
              >
                {/* 罫線・ヘッダ背景・行高は共通テーマ（GRID_THEME）に委譲。
                    項目名列の左寄せは共通クラス（ag-cell-left-pinned）に委譲する。 */}
                <style>{`
                  /* ヘッダー文字を左寄せ */
                  .jbr-actual-bill-grid .ag-header-cell-label {
                    justify-content: flex-start;
                  }
                `}</style>
                <AgGridReact
                  rowData={rowData}
                  getRowId={getRowId}
                  columnDefs={columnDefs}
                  defaultColDef={defaultColDef}
                  getContextMenuItems={gridFilterContextMenuItems}
                  suppressMovableColumns={true}
                  ensureDomOrder={true}
                  {...GRID_BASE_PROPS}
                />
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-bold text-gray-800 mb-3">
                  確定実績・請求書／販売計画書／前年実績 比較
                </div>
                <div style={{ width: '100%', height: 360 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={graphData}
                      margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) => v.toLocaleString()}
                      />
                      <Tooltip formatter={(v: number) => v.toLocaleString()} />
                      <Legend />
                      <Bar dataKey="確定実績・請求書" fill="#3b82f6" />
                      <Bar dataKey="販売計画書" fill="#14b8a6" />
                      <Bar dataKey="前年実績" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
