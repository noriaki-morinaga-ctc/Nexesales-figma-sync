import { useMemo, useCallback, useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  FilterChangedEvent,
  GetRowIdParams,
  GridApi,
  ICellRendererParams,
  RowDataUpdatedEvent,
} from 'ag-grid-community';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { ExpandCollapseButton } from '../common/ExpandCollapseButton';
import {
  GRID_BASE_PROPS,
  GRID_COLORS,
  GRID_DEFAULT_COL_DEF,
  GRID_EMPTY_TEXT,
  GRID_STATUS_BAR,
  gridFilterContextMenuItems,
  GRID_NUMBER_TEXT_FILTER,
  GRID_MONTH_TEXT_FILTER,
} from '../../../grid';
import {
  PLAN_DETAIL_DIGITS,
  formatPlanAmount,
  formatPlanRate,
  planRateFormatter,
} from '../../../../utils/sales-plan/common/planDetailNumberFormat';
import type { ProductData } from '../../../../types/simulation';

interface SimulationCampaignSummaryTableProps {
  // 詳細表と同型（企画×確度ごとに集計済みの行）
  data: ProductData[];
  // 一般卸メッシュ列の表示有無（NET固定のみ表示。10/27 第4回 決定事項15）
  showWholesaleMesh?: boolean;
  // 表示単位（円／千円）。千円時は金額列を floor(v/1000) で表示する。
  displayUnit?: 'yen' | 'thousand';
  // 集計表（AG Grid）の高さ(px)。呼び出し側でリサイズ制御する場合に渡す。
  height?: number;
  // 「反映済を除く」「不採用を除く」。詳細／グラフを切り替えても保持するため親で持つ。
  shouldExcludeReflected: boolean;
  shouldExcludeRejected: boolean;
  onExcludeReflectedChange: (value: boolean) => void;
  onExcludeRejectedChange: (value: boolean) => void;
}

// 行ID（→ 画面設計標準 4.7）。treeData のため、木全体で一意な階層パス（企画／確度＿連番）を使う。
// 合計行（pinnedTopRowData）は1行だけのため固定IDにする。
const getRowId = (params: GetRowIdParams) =>
  params.rowPinned ? 'pinned-total' : JSON.stringify(params.data.hierarchyPath);

// 文字列の数値をパース
const toNum = (s?: string) =>
  s ? parseFloat(String(s).replace(/,/g, '')) || 0 : 0;

// 合計対象の数値フィールド（表示している数値列のみ）
const NUMERIC_FIELDS: (keyof ProductData)[] = [
  'plan',
  'externalSales',
  'managementProfitAmount',
  'exp1PlannedAmount',
  'exp2PlannedAmount',
];

// 管理利益率の表示桁（明細グリッドの管理利益率と同じ小数第2位）
const MANAGEMENT_PROFIT_RATE_DIGITS = 2;

// 分子÷分母×100 の率。分母が0の場合は null（表示は「-」）
const weightedRate = (numerator: number, denominator: number) =>
  denominator !== 0 ? (numerator / denominator) * 100 : null;

// グループ内で最初に値を持つ行の値を代表値として採用
const pick = (rows: ProductData[], f: keyof ProductData) => {
  const found = rows.find((r) => r[f] != null && String(r[f]).trim() !== '');
  return found ? String(found[f]) : '';
};

// 企画セル：展開/折りたたみアイコン付き。企画行（level 0）のみ企画名＋Chevronを表示し、
// 確度行（level 1）はインデントのみ（確度は専用列で表示）。
function CampaignCellRenderer(params: ICellRendererParams) {
  const { data, node } = params;
  const [expanded, setExpanded] = useState<boolean>(!!node?.expanded);

  useEffect(() => {
    if (!node) return;
    const handleExpandedChanged = () => setExpanded(!!node.expanded);
    node.addEventListener('expandedChanged', handleExpandedChanged);
    return () =>
      node.removeEventListener('expandedChanged', handleExpandedChanged);
  }, [node]);

  if (!data) return null;

  const hasChildren = (node.allChildrenCount ?? 0) > 0;
  const level = data.level ?? 0;
  const descendantCount = data.descendantCount ?? 0;
  const showCount = hasChildren && !expanded && descendantCount > 0;

  return (
    <div
      className="flex items-center h-full w-full"
      style={{ paddingLeft: `${level}rem` }}
    >
      {hasChildren ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`${data.campaign}を${expanded ? '閉じる' : '開く'}`}
          className="flex items-center border-0 bg-transparent cursor-pointer px-1"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      ) : (
        <span style={{ width: '1.5rem' }} />
      )}
      <span>
        {data.campaign}
        {showCount && (
          <span className="ml-1 text-gray-500">({descendantCount})</span>
        )}
      </span>
    </div>
  );
}

export function SimulationCampaignSummaryTable({
  data,
  showWholesaleMesh = false,
  displayUnit = 'yen',
  height = 400,
  shouldExcludeReflected,
  shouldExcludeRejected,
  onExcludeReflectedChange,
  onExcludeRejectedChange,
}: SimulationCampaignSummaryTableProps) {
  // 「全展開」「折り畳み」の切り替えボタンへ渡すグリッド API
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  // フィルター適用後のデータ（企画×確度行）
  const filteredData = useMemo(
    () =>
      data.filter((row) => {
        if (shouldExcludeReflected && row.probability === '反映済')
          return false;
        if (shouldExcludeRejected && row.probability === '不採用') return false;
        return true;
      }),
    [data, shouldExcludeReflected, shouldExcludeRejected]
  );

  // 合計行（ピン留め）かどうかの判定
  const isTotalRow = (params: any) => !!params.node?.rowPinned;

  // 数値セルのスタイル（マイナス赤字・合計行は薄青：gridStyles準拠）
  const numberCellStyle = useCallback((params: any) => {
    const style: any = { textAlign: 'right' };
    if (isTotalRow(params)) {
      style.backgroundColor = GRID_COLORS.total;
      style.fontWeight = 'bold';
    }
    if (toNum(params.value) < 0) style.color = GRID_COLORS.overText;
    return style;
  }, []);

  // テキストセルのスタイル（合計行は薄青：gridStyles準拠）
  const textCellStyle = useCallback((params: any) => {
    if (isTotalRow(params)) {
      return { backgroundColor: GRID_COLORS.total, fontWeight: 'bold' };
    }
    return {};
  }, []);

  // 率セルのスタイル（100%超過は赤字。合計行クリームは踏襲）
  const rateCellStyle = useCallback(
    (params: any) => {
      const style: any = { ...textCellStyle(params) };
      if (toNum(params.value) > 100) style.color = GRID_COLORS.overText;
      return style;
    },
    [textCellStyle]
  );

  // 金額は千円選択時に v/1000。数量（計画函数）は単位換算しない。
  // いずれも項目一覧に合わせて整数表示とし、端数は四捨五入する。
  const numberFormatter = (params: any) => {
    if (params.value === '' || params.value == null) return GRID_EMPTY_TEXT;
    return formatPlanAmount(toNum(params.value), PLAN_DETAIL_DIGITS.amount);
  };
  const amountFormatter = (params: any) => {
    if (params.value === '' || params.value == null) return GRID_EMPTY_TEXT;
    const n = toNum(params.value);
    return formatPlanAmount(
      displayUnit === 'thousand' ? n / 1000 : n,
      PLAN_DETAIL_DIGITS.amount
    );
  };

  // 数値列定義の生成（isAmount=false の列＝数量は単位換算しない）
  const numCol = (
    headerName: string,
    field: keyof ProductData,
    isAmount = true
  ): ColDef => ({
    headerName,
    field: field as string,
    // 値は文字列で持つため、数値へ変換して数値フィルタで絞り込む
    ...GRID_NUMBER_TEXT_FILTER,
    // 表全体の横幅いっぱいに広げる（最終列右の余白を解消・最小幅は確保）
    flex: 1,
    minWidth: 88,
    cellClass: 'ag-cell-right',
    cellStyle: numberCellStyle,
    valueFormatter: isAmount ? amountFormatter : numberFormatter,
  });

  // テキスト列定義の生成
  const textCol = (
    headerName: string,
    field: keyof ProductData,
    width = 88
  ): ColDef => ({
    headerName,
    field: field as string,
    // 表全体の横幅いっぱいに広げる（最終列右の余白を解消・最小幅は確保）
    flex: 1,
    minWidth: width,
    cellStyle: textCellStyle,
  });

  // 表示列（指定の順序・読み取り専用）：
  // 対象年月／企画／企画名／確度／計画函数／社外売上高／管理利益額／管理利益率／値入率／
  // 拡売費①金額／拡売費②金額／摘要1
  const columnDefs: ColDef[] = useMemo(
    () => [
      {
        headerName: '対象年月',
        field: 'targetMonth',
        ...GRID_MONTH_TEXT_FILTER,
        width: 72,
        cellStyle: textCellStyle,
        // 合計行は対象年月〜確度を結合して「合計」と表示
        colSpan: (params: any) => (params.node?.rowPinned ? 4 : 1),
      },
      {
        headerName: '企画',
        field: 'campaign',
        width: 128,
        cellStyle: textCellStyle,
        cellRenderer: CampaignCellRenderer,
      },
      textCol('企画名', 'campaignName', 128),
      textCol('確度', 'probability', 72),
      ...(showWholesaleMesh
        ? [textCol('一般卸メッシュ', 'wholesaleMesh', 144)]
        : []),
      numCol('計画函数', 'plan', false),
      numCol('社外売上高', 'externalSales'),
      numCol('管理利益額', 'managementProfitAmount'),
      {
        headerName: '管理利益率',
        field: 'managementProfitRate',
        ...GRID_NUMBER_TEXT_FILTER,
        width: 80,
        cellStyle: rateCellStyle,
      },
      {
        // 値入率は率項目のため管理利益率と同じ体裁で、小数第1位（％）に整形する。
        headerName: '値入率',
        field: 'discount',
        ...GRID_NUMBER_TEXT_FILTER,
        width: 72,
        cellStyle: rateCellStyle,
        valueFormatter: planRateFormatter(PLAN_DETAIL_DIGITS.rate),
      },
      numCol('拡売費①金額', 'exp1PlannedAmount'),
      numCol('拡売費②金額', 'exp2PlannedAmount'),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      numberCellStyle,
      textCellStyle,
      rateCellStyle,
      displayUnit,
      showWholesaleMesh,
    ]
  );

  const defaultColDef = useMemo(
    () => ({
      ...GRID_DEFAULT_COL_DEF,
      resizable: true,
      sortable: true,
      filter: true,
    }),
    []
  );

  // 企画でドリルダウン表示するためのツリー行を生成。
  // 企画行（level 0／数値は確度行の合計）＋確度行（level 1）。
  const treeRows = useMemo(() => {
    const groups = new Map<string, ProductData[]>();
    filteredData.forEach((row) => {
      const key = row.campaign || '（未設定）';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    });

    const sum = (rows: ProductData[], f: keyof ProductData) =>
      String(rows.reduce((s, r) => s + toNum(r[f] as string), 0));

    const rows: any[] = [];
    groups.forEach((children, campaign) => {
      // 企画行（集計）
      rows.push({
        level: 0,
        descendantCount: children.length,
        hierarchyPath: [campaign],
        campaign,
        campaignName: pick(children, 'campaignName'),
        probability: '',
        wholesaleMesh: pick(children, 'wholesaleMesh'),
        targetMonth: pick(children, 'targetMonth'),
        plan: sum(children, 'plan'),
        externalSales: sum(children, 'externalSales'),
        managementProfitAmount: sum(children, 'managementProfitAmount'),
        managementProfitRate: pick(children, 'managementProfitRate'),
        discount: pick(children, 'discount'),
        exp1PlannedAmount: sum(children, 'exp1PlannedAmount'),
        exp2PlannedAmount: sum(children, 'exp2PlannedAmount'),
        summary1: pick(children, 'summary1'),
      });
      // 確度行（明細）
      children.forEach((child, idx) => {
        rows.push({
          ...child,
          level: 1,
          hierarchyPath: [
            campaign,
            `${child.probability || GRID_EMPTY_TEXT}＿${idx}`,
          ],
        });
      });
    });
    return rows;
  }, [filteredData]);

  // 列フィルタを通過した確度行（フィルタ無しは null）。合計行を表示中の行だけで計算し直すために使う
  // （画面設計標準 4.4 ③）。公式の onFilterChanged／forEachNodeAfterFilter で取得する。
  // 確度フィルター（チェック）で行が作り直されたときも、フィルタを掛け直した結果で取り直す（onRowDataUpdated）。
  const [visibleLeafRows, setVisibleLeafRows] = useState<ProductData[] | null>(
    null
  );
  const collectVisibleLeafRows = useCallback((api: GridApi) => {
    if (!api.isAnyFilterPresent()) {
      setVisibleLeafRows(null);
      return;
    }
    const rows: ProductData[] = [];
    api.forEachNodeAfterFilter((node) => {
      // 企画行（level 0）は確度行の集計のため、合計には確度行（level 1）だけを使う
      if (node.data?.level === 1) rows.push(node.data);
    });
    setVisibleLeafRows(rows);
  }, []);
  const handleFilterChanged = useCallback(
    (e: FilterChangedEvent) => collectVisibleLeafRows(e.api),
    [collectVisibleLeafRows]
  );
  const handleRowDataUpdated = useCallback(
    (e: RowDataUpdatedEvent) => collectVisibleLeafRows(e.api),
    [collectVisibleLeafRows]
  );

  // 合計行（ピン留め）。数値列は合計、率列は加重平均（補足3-1）で算出する。
  // 列フィルタ中は、フィルタを通過した確度行だけで合計する。
  const pinnedTotal = useMemo(() => {
    const total: any = { __isTotal: true, targetMonth: '合計' };
    const totalRows = visibleLeafRows ?? filteredData;
    const sumOf = (f: keyof ProductData) =>
      totalRows.reduce((s, row) => s + toNum(row[f] as string), 0);
    NUMERIC_FIELDS.forEach((f) => {
      total[f] = String(sumOf(f));
    });
    // 管理利益率 ＝ Σ管理利益額 ÷ Σ売上高 × 100
    const mgmtRate = weightedRate(
      sumOf('managementProfitAmount'),
      sumOf('netSales')
    );
    total.managementProfitRate =
      mgmtRate == null
        ? GRID_EMPTY_TEXT
        : formatPlanRate(mgmtRate, MANAGEMENT_PROFIT_RATE_DIGITS);
    // 値入率 ＝ Σ(売価−納価)×入数×計画函数 ÷ Σ売価×入数×計画函数 × 100
    // （表示整形は値入率列の valueFormatter に任せる）
    const markupRate = weightedRate(
      sumOf('_markupAmount'),
      sumOf('_retailAmount')
    );
    total.discount = markupRate == null ? GRID_EMPTY_TEXT : String(markupRate);
    return [total];
  }, [filteredData, visibleLeafRows]);

  return (
    <div className="campaign-summary-table" style={{ width: '100%' }}>
      <style>{`
        .campaign-summary-table .ag-cell-right {
          text-align: right;
        }
        /* 罫線・ヘッダ背景は共通テーマ（GRID_THEME＝支払申請一覧参照と同一）に統一 */
      `}</style>

      {/* 全展開・折り畳みの切り替え（左端）と確度フィルター（チェックに応じて確度・集計値が動的に変わる） */}
      <div className="flex items-center gap-4 mb-2">
        <ExpandCollapseButton api={gridApi} />
        <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={shouldExcludeReflected}
            onChange={(e) => onExcludeReflectedChange(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-900 font-bold">反映済を除く</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={shouldExcludeRejected}
            onChange={(e) => onExcludeRejectedChange(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-900 font-bold">不採用を除く</span>
        </label>
      </div>

      <div style={{ height, width: '100%' }}>
        {/* 規約例外（集計表）：行と列が決まっている集計表のため、列の状態の保存（useGridColumnState）は付けない */}
        <AgGridReact
          {...GRID_BASE_PROPS}
          rowData={treeRows}
          getRowId={getRowId}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getContextMenuItems={gridFilterContextMenuItems}
          statusBar={GRID_STATUS_BAR}
          treeData={true}
          getDataPath={(row: any) => row.hierarchyPath}
          groupDisplayType="custom"
          groupDefaultExpanded={0}
          autoGroupColumnDef={{
            hide: true,
            headerName: '',
            width: 0,
            minWidth: 0,
          }}
          pinnedTopRowData={pinnedTotal}
          onGridReady={(e) => {
            setGridApi(e.api);
          }}
          onFilterChanged={handleFilterChanged}
          onRowDataUpdated={handleRowDataUpdated}
          suppressMovableColumns={true}
          ensureDomOrder={true}
          onRowClicked={(e) => {
            // 行クリックでドリルダウン開閉（chevron以外でも開閉可能にする）
            if (!e.node || e.node.rowPinned) return;
            if ((e.node.allChildrenCount ?? 0) > 0) {
              e.node.setExpanded(!e.node.expanded);
            }
          }}
        />
      </div>
    </div>
  );
}
