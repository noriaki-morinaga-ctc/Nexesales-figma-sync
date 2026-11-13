// 支払詳細(追加口請求書有)の追加口分割 ─ ステップ2「追加口分割ペイン」（ケース・バラ入力）。
//
// 追加口明細の全行を行、ステップ1で選んだ分割先の商流販売店を列にし、その交点へケースとバラを入力する
//（明細の選択は不要。分割しない明細は 0 のままにする → 20260901_第33回 決定事項3）。
//   ・入力するのはケース・バラのみ。金額は（ケース × 入数 ＋ バラ）× 追加口バラ単価で自動計算し、
//     入力できない（→ 第33回 決定事項8）。表記は「函数」ではなく「ケース」（→ 決定事項6）
//   ・自部署負担分は支払ケース・支払バラから分割先の合計を引いた残り（入力できない）
//   ・分割元の支払がプラスで自部署負担分がマイナスの明細は赤くし、フッタに件数と No. を出す。
//     ［設定］は止めない。合計の一致検証も行わない（→ 決定事項10〜12）
//   ・計の行（ケース・バラ・金額の合計）を上部に固定する（→ 決定事項9）
//   ・列の並びは画面イメージどおり「No.・商品 → 入数〜追加口金額 → 自部署負担分 → 分割先」とし、
//     列の固定（pinned）は行わない
//   ・Excel からの貼り付けは AG Grid 標準の範囲貼り付け（GRID_BASE_PROPS の cellSelection）。
//     貼り付け・手入力とも小数は四捨五入で整数にする（→ 課題1507）。CSV取込は設けない（→ 決定事項7）
//
// 行データには分割先のケース・バラだけを持ち、自部署負担分と金額は valueGetter で都度計算する。
// 連動して書き替わるセルを持たないため、Undo（Ctrl+Z）は入力セルだけで成立する（→ 02 §7.1・§7.3）。
// 列は開いた時点の分割先で確定し、表示中は columnDefs の参照を変えない（Undo 履歴を消さないため）。
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AlertTriangle } from 'lucide-react';
import type {
  CellClassParams,
  CellValueChangedEvent,
  ColDef,
  ColGroupDef,
  GetRowIdParams,
  ValueFormatterParams,
  ValueGetterParams,
  ValueSetterParams,
} from 'ag-grid-community';
import {
  GRID_DEFAULT_COL_DEF,
  GRID_BASE_PROPS,
  GRID_STATUS_BAR,
  GRID_COLORS,
  gridFilterContextMenuItems,
  useChangedCells,
  CellColorLegend,
  GRID_NUMBER_TEXT_FILTER,
  GRID_EMPTY_TEXT,
  useGridColumnState,
  withGridHeaderStyle,
} from '@/app/components/grid';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import type { CellColorLegendItem } from '@/app/components/grid';
import { parseFormulaNumber } from '@/app/components/grid/gridCommon';
import type { AdditionalEntryData } from '@/app/types/paymentDetail';
import type { SplitDestination } from '@/app/types/paymentDetail';
import {
  alertLineNos,
  calcSelfShare,
  calcSelfShareAmount,
  calcSplitAmount,
  isSelfShareAlert,
  toIntegerCount,
  type SplitAllocation,
} from '@/app/utils/payment/payment-detail/additionalEntrySplit';

// ペイン1行分（追加口明細1行）。分割先の入力は destId ごとのケース・バラで持つ。
interface SplitRow {
  lineNo: number | string;
  productCode: string;
  productName: string;
  capacity: number | string;
  payCases: number | string;
  payLoose: number | string;
  addUnit: number | string;
  addAmount: number | string;
  alloc: Record<string, { cases: number; loose: number }>;
  isTotal?: boolean;
  // 計の行のみ：列ID → 合計値
  totals?: Record<string, number>;
}

export interface AdditionalEntrySplitPaneHandle {
  // 現在の入力（ケース・バラとも 0 の組み合わせは含めない）
  getAllocations: () => SplitAllocation[];
  // 分割先の入力をすべて 0 に戻す（全量が自部署負担分に戻る）
  clear: () => void;
}

interface AdditionalEntrySplitPaneProps {
  // 追加口明細（当該支払回。合計行は含めない）
  entries: AdditionalEntryData[];
  // ステップ1で選んだ分割先（列の並び順）
  destinations: SplitDestination[];
  // 初期の入力値（当該支払回で保存済みの分割。無ければ空＝0。選んだ分割先以外の入力は無視する）
  initialAllocations: SplitAllocation[];
  // 自部署負担分の見出しに出す自部署の情報
  self: {
    deptName: string;
    staffName: string;
    tertiaryName: string;
    primaryName: string;
  };
  // 参照のみ（申請後の支払回 → 第33回 決定事項16）
  readOnly?: boolean;
}

// 列ID（分割先・自部署の各列）。分割先 ID は三次店コード（数字）のため区切りに「_」を使う
//（field にドットを使うと入れ子参照になるため使わない）。
const destColId = (destId: string, kind: 'cases' | 'loose' | 'amount') =>
  `dest_${destId}_${kind}`;
const SELF_COL = {
  cases: 'self_cases',
  loose: 'self_loose',
  amount: 'self_amount',
} as const;

const toNum = (v: unknown): number => {
  const n = parseFormulaNumber(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtNum = (p: ValueFormatterParams) =>
  typeof p.value === 'number'
    ? p.value.toLocaleString()
    : String(p.value ?? '') || GRID_EMPTY_TEXT;

// 行の入力を SplitAllocation の配列にする（0 の組み合わせを除く）。
const allocationsOfRows = (rows: SplitRow[]): SplitAllocation[] =>
  rows.flatMap((row) =>
    Object.entries(row.alloc)
      .filter(([, v]) => v.cases !== 0 || v.loose !== 0)
      .map(([destId, v]) => ({
        lineNo: row.lineNo,
        destId,
        cases: v.cases,
        loose: v.loose,
      }))
  );

// 明細と初期値から行データを作る。
const buildRows = (
  entries: AdditionalEntryData[],
  destinations: SplitDestination[],
  initialAllocations: SplitAllocation[]
): SplitRow[] =>
  entries
    .filter((e) => !e.isTotal)
    .map((e) => {
      const alloc: SplitRow['alloc'] = {};
      for (const d of destinations) {
        const init = initialAllocations.find(
          (a) => String(a.lineNo) === String(e.lineNo) && a.destId === d.id
        );
        alloc[d.id] = { cases: init?.cases ?? 0, loose: init?.loose ?? 0 };
      }
      return {
        lineNo: e.lineNo,
        productCode: e.productCode,
        productName: e.productName,
        capacity: e.capacity,
        payCases: e.payCases,
        payLoose: e.payLoose,
        addUnit: e.addUnit,
        addAmount: e.addAmount,
        alloc,
      };
    });

// 計の行（固定行）。各列の合計を列IDで持つ。
const buildTotalRow = (
  rows: SplitRow[],
  destinations: SplitDestination[]
): SplitRow => {
  const totals: Record<string, number> = {
    payCases: 0,
    payLoose: 0,
    addAmount: 0,
    [SELF_COL.cases]: 0,
    [SELF_COL.loose]: 0,
    [SELF_COL.amount]: 0,
  };
  for (const d of destinations) {
    totals[destColId(d.id, 'cases')] = 0;
    totals[destColId(d.id, 'loose')] = 0;
    totals[destColId(d.id, 'amount')] = 0;
  }
  const allocations = allocationsOfRows(rows);
  for (const row of rows) {
    totals.payCases += toNum(row.payCases);
    totals.payLoose += toNum(row.payLoose);
    totals.addAmount += toNum(row.addAmount);
    const self = calcSelfShare(row, allocations);
    totals[SELF_COL.cases] += self.cases;
    totals[SELF_COL.loose] += self.loose;
    totals[SELF_COL.amount] += calcSelfShareAmount(row, allocations);
    for (const d of destinations) {
      const v = row.alloc[d.id];
      totals[destColId(d.id, 'cases')] += v.cases;
      totals[destColId(d.id, 'loose')] += v.loose;
      totals[destColId(d.id, 'amount')] += calcSplitAmount(
        v.cases,
        v.loose,
        row.capacity,
        row.addUnit
      );
    }
  }
  return {
    lineNo: '計',
    productCode: '',
    productName: '',
    capacity: '',
    payCases: '',
    payLoose: '',
    addUnit: '',
    addAmount: '',
    alloc: {},
    isTotal: true,
    totals,
  };
};

// 行の自部署負担分（当該行の分割先入力から算出）。
const selfShareOfRow = (row: SplitRow) =>
  calcSelfShare(row, allocationsOfRows([row]));

// 自部署負担分・分割先ごとのまとまりの区切り線（薄い青・太め）。見出しの全段と先頭列のセルの左端に引く。
// 追加口金額と自部署負担分の間も、分割先どうしの間と同じ線にそろえる。
// 太さは rem で指定する（px は 1px の罫線のみ許可 → 01）。
const GROUP_DIVIDER_STYLE = {
  borderLeft: `0.125rem solid ${GRID_COLORS.groupDivider}`,
};
// 三次店と一次店の段の間の線：上端の罫線を消し、中央部分だけの短い線（通常の罫線色）を描く。
const SOFT_TOP_DIVIDER_STYLE = {
  borderTop: 'none',
  backgroundImage: `linear-gradient(${GRID_COLORS.gridLine}, ${GRID_COLORS.gridLine})`,
  backgroundSize: '60% 0.0625rem',
  backgroundPosition: 'center top',
  backgroundRepeat: 'no-repeat',
};

// セルの色の凡例（色は GRID_COLORS を単一の情報源とする → 02 §10.1）。
// 入力するセル（白）と計の行は見れば分かるため凡例に載せない。
const SPLIT_COLOR_LEGEND: CellColorLegendItem[] = [
  {
    color: GRID_COLORS.changedBg,
    label: '編集したセル',
  },
  { color: GRID_COLORS.readonly, label: '自動算出・入力できないセル' },
  {
    color: GRID_COLORS.overBilledBg,
    label: '分割元の支払がプラスで自部署負担分がマイナス',
  },
];

export const AdditionalEntrySplitPane = forwardRef<
  AdditionalEntrySplitPaneHandle,
  AdditionalEntrySplitPaneProps
>(function AdditionalEntrySplitPane(
  { entries, destinations, initialAllocations, self, readOnly = false },
  ref
) {
  const gridRef = useRef<AgGridReact<SplitRow>>(null);
  const { isCellChanged, trackCellChange, resetChangedCells } =
    useChangedCells();

  // 行データは開いた時点で1回だけ作る。以降の入力は行オブジェクトへ直接反映する
  //（rowData の参照を変えると Undo 履歴が消えるため → 02 §7.1）。
  // ［入力をクリア］のような一括更新のみ rebuildToken で作り直す。
  const [rebuildToken, setRebuildToken] = useState(0);
  const rowsRef = useRef<SplitRow[] | null>(null);
  const rowData = useMemo(() => {
    const rows = buildRows(
      entries,
      destinations,
      rebuildToken === 0 ? initialAllocations : []
    );
    rowsRef.current = rows;
    return rows;
    // 列（分割先）と明細は開いた時点で確定する。rebuildToken の変化時のみ作り直す。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rebuildToken]);

  // 計の行とアラート（入力のたびに更新）。
  // 計の行は表示中（フィルタ後）の明細だけで集計する（画面設計標準 4.4 ③）。アラートは全明細が対象。
  const [totalRow, setTotalRow] = useState<SplitRow>(() =>
    buildTotalRow(rowData, destinations)
  );
  const [alertNos, setAlertNos] = useState<(number | string)[]>(() =>
    alertLineNos(rowData, allocationsOfRows(rowData))
  );
  // 表示中（フィルタ後）の明細。グリッドの初期化前は全明細
  const visibleRows = useCallback((): SplitRow[] => {
    const api = gridRef.current?.api;
    if (!api) return rowsRef.current ?? [];
    const rows: SplitRow[] = [];
    api.forEachNodeAfterFilter((node) => {
      if (node.data) rows.push(node.data);
    });
    return rows;
  }, []);
  // フィルタの変更・行の作り直し（［入力をクリア］）のときに計の行を集計し直す
  const handleRefreshTotalRow = useCallback(() => {
    setTotalRow(buildTotalRow(visibleRows(), destinations));
  }, [destinations, visibleRows]);
  const refreshSummary = useCallback(() => {
    const rows = rowsRef.current ?? [];
    handleRefreshTotalRow();
    setAlertNos(alertLineNos(rows, allocationsOfRows(rows)));
  }, [handleRefreshTotalRow]);

  useImperativeHandle(
    ref,
    () => ({
      getAllocations: () => allocationsOfRows(rowsRef.current ?? []),
      clear: () => {
        resetChangedCells();
        setRebuildToken((t) => t + 1);
        // 作り直した行で計・アラートを更新する（rowsRef は次の描画で差し替わる）
        const cleared = buildRows(entries, destinations, []);
        setTotalRow(buildTotalRow(cleared, destinations));
        setAlertNos([]);
      },
    }),
    [destinations, entries, resetChangedCells]
  );

  const getRowId = useCallback(
    (p: GetRowIdParams<SplitRow>) =>
      p.data.isTotal ? 'total' : String(p.data.lineNo),
    []
  );

  // ── セルのスタイル ──
  const totalStyle = { fontWeight: 'bold', backgroundColor: GRID_COLORS.total };
  const readonlyStyle = useCallback(
    (p: CellClassParams<SplitRow>) =>
      p.data?.isTotal
        ? { ...totalStyle, textAlign: 'right' }
        : { backgroundColor: GRID_COLORS.readonly, textAlign: 'right' },
    // totalStyle は定数
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  // 入力セル：編集可＝白／参照のみ＝灰。編集したセルの黄色ハイライトは共通の仕組み
  //（GRID_DEFAULT_COL_DEF の cellClassRules 'ag-cell-changed'＋グリッドの context.isCellChanged）に
  // 任せ、ここでは付けない（→ 02 §7.2）。
  const inputStyle = useCallback(
    (p: CellClassParams<SplitRow>) => {
      if (p.data?.isTotal) return { ...totalStyle, textAlign: 'right' };
      return {
        backgroundColor: readOnly ? GRID_COLORS.readonly : GRID_COLORS.editable,
        textAlign: 'right',
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readOnly]
  );

  // 共通の変更ハイライト（'ag-cell-changed'）が参照する判定関数をグリッドへ渡す。
  const gridContext = useMemo(() => ({ isCellChanged }), [isCellChanged]);
  // 自部署負担分：分割元の支払がプラスで自部署負担分がマイナスなら赤。
  const selfStyle = useCallback(
    (p: CellClassParams<SplitRow>) => {
      if (p.data && !p.data.isTotal) {
        const row = p.data;
        if (isSelfShareAlert(row, allocationsOfRows([row]))) {
          return {
            backgroundColor: GRID_COLORS.overBilledBg,
            fontWeight: 'bold',
            textAlign: 'right',
          };
        }
      }
      return readonlyStyle(p);
    },
    [readonlyStyle]
  );

  // 計の行は totals から値を取る。
  const totalOr =
    (colId: string, getter: (row: SplitRow) => number | string) =>
    (p: ValueGetterParams<SplitRow>) =>
      p.data?.isTotal
        ? (p.data.totals?.[colId] ?? '')
        : p.data
          ? getter(p.data)
          : '';

  const columnDefs = useMemo<(ColDef<SplitRow> | ColGroupDef<SplitRow>)[]>(
    () => {
      const fixedCols: ColDef<SplitRow>[] = [
        {
          headerName: 'No.',
          field: 'lineNo',
          width: 56,
          cellClass: 'ag-cell-left-pinned',
          cellStyle: (p) =>
            p.data?.isTotal
              ? totalStyle
              : { backgroundColor: GRID_COLORS.readonly },
        },
        {
          headerName: 'サマリ商品コード',
          field: 'productCode',
          width: 96,
          cellStyle: (p) =>
            p.data?.isTotal
              ? totalStyle
              : { backgroundColor: GRID_COLORS.readonly },
        },
        {
          headerName: 'サマリ商品名',
          field: 'productName',
          width: 176,
          cellStyle: (p) =>
            p.data?.isTotal
              ? totalStyle
              : { backgroundColor: GRID_COLORS.readonly },
        },
        {
          headerName: '入数',
          field: 'capacity',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 56,
          valueFormatter: fmtNum,
          cellStyle: readonlyStyle,
        },
        {
          headerName: '支払ケース',
          colId: 'payCases',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 80,
          valueGetter: totalOr('payCases', (r) => toNum(r.payCases)),
          valueFormatter: fmtNum,
          cellStyle: readonlyStyle,
        },
        {
          headerName: '支払バラ',
          colId: 'payLoose',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 72,
          valueGetter: totalOr('payLoose', (r) => toNum(r.payLoose)),
          valueFormatter: fmtNum,
          cellStyle: readonlyStyle,
        },
        {
          headerName: '追加口バラ単価',
          field: 'addUnit',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 104,
          valueFormatter: fmtNum,
          cellStyle: readonlyStyle,
        },
        {
          headerName: '追加口金額',
          colId: 'addAmount',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 96,
          valueGetter: totalOr('addAmount', (r) => toNum(r.addAmount)),
          valueFormatter: fmtNum,
          cellStyle: readonlyStyle,
        },
      ];

      // 商流販売店ごとの見出し（4段）：部署（担当者）／三次店／一次店／ケース・バラ・金額。
      // 商流販売店は一次店と三次店の組み合わせで判別するため、両方を見出しに出す（画面イメージ 2-3）。
      // 名称が列幅に収まらない場合はツールチップで全文を確認できる。
      // 自部署負担分・分割先ごとのまとまりの左端に区切り線を引く（見出しの全段と先頭列のセル）。
      // 三次店と一次店の段の間は、きっちり区切らず中央部分だけの短い線にして、
      // 三次店・一次店が1つの商流販売店を表すまとまりに見えるようにする。
      const storeHeaderGroup = (
        topHeader: string,
        tertiaryName: string,
        primaryName: string,
        leaves: ColDef<SplitRow>[]
      ): ColGroupDef<SplitRow> => {
        const tooltip = `${topHeader}\n三次店：${tertiaryName}\n一次店：${primaryName}`;
        const [firstLeaf, ...restLeaves] = leaves;
        const baseCellStyle = firstLeaf.cellStyle;
        const dividedFirstLeaf: ColDef<SplitRow> = {
          ...firstLeaf,
          headerStyle: withGridHeaderStyle(GROUP_DIVIDER_STYLE),
          cellStyle: (p) => ({
            ...(typeof baseCellStyle === 'function'
              ? baseCellStyle(p)
              : baseCellStyle),
            ...GROUP_DIVIDER_STYLE,
          }),
        };
        return {
          headerName: topHeader,
          headerTooltip: tooltip,
          headerStyle: withGridHeaderStyle(GROUP_DIVIDER_STYLE),
          children: [
            {
              headerName: `三次店：${tertiaryName}`,
              headerTooltip: tooltip,
              headerStyle: withGridHeaderStyle(GROUP_DIVIDER_STYLE),
              children: [
                {
                  headerName: `一次店：${primaryName}`,
                  headerTooltip: tooltip,
                  headerStyle: withGridHeaderStyle({
                    ...GROUP_DIVIDER_STYLE,
                    ...SOFT_TOP_DIVIDER_STYLE,
                  }),
                  children: [dividedFirstLeaf, ...restLeaves],
                },
              ],
            },
          ],
        };
      };

      // 自部署負担分（追加口金額の右、分割先の左。入力できない）
      const selfGroup = storeHeaderGroup(
        `自部署負担分（${self.deptName}／${self.staffName}）`,
        self.tertiaryName,
        self.primaryName,
        [
          {
            headerName: 'ケース',
            colId: SELF_COL.cases,
            ...GRID_NUMBER_TEXT_FILTER,
            width: 72,
            valueGetter: totalOr(
              SELF_COL.cases,
              (r) => selfShareOfRow(r).cases
            ),
            valueFormatter: fmtNum,
            cellStyle: selfStyle,
          },
          {
            headerName: 'バラ',
            colId: SELF_COL.loose,
            ...GRID_NUMBER_TEXT_FILTER,
            width: 64,
            valueGetter: totalOr(
              SELF_COL.loose,
              (r) => selfShareOfRow(r).loose
            ),
            valueFormatter: fmtNum,
            cellStyle: selfStyle,
          },
          {
            headerName: '金額',
            colId: SELF_COL.amount,
            ...GRID_NUMBER_TEXT_FILTER,
            width: 96,
            // 追加口金額 − 分割先の金額の合計（端数は自部署で吸収 → 第33回 決定事項8・12）
            valueGetter: totalOr(SELF_COL.amount, (r) =>
              calcSelfShareAmount(r, allocationsOfRows([r]))
            ),
            valueFormatter: fmtNum,
            cellStyle: selfStyle,
          },
        ]
      );

      // 分割先（選んだ商流販売店ごとに ケース・バラ・金額 の3列）
      const countCol = (
        d: SplitDestination,
        kind: 'cases' | 'loose'
      ): ColDef<SplitRow> => ({
        headerName: kind === 'cases' ? 'ケース' : 'バラ',
        colId: destColId(d.id, kind),
        ...GRID_NUMBER_TEXT_FILTER,
        width: kind === 'cases' ? 72 : 64,
        editable: (p) => !readOnly && !p.data?.isTotal,
        valueGetter: totalOr(destColId(d.id, kind), (r) => r.alloc[d.id][kind]),
        // 手入力・貼り付けとも整数へそろえる（小数は四捨五入 → 課題1507）
        valueParser: (p) => toIntegerCount(p.newValue),
        valueSetter: (p: ValueSetterParams<SplitRow>) => {
          if (!p.data || p.data.isTotal) return false;
          const next = toIntegerCount(p.newValue);
          if (p.data.alloc[d.id][kind] === next) return false;
          p.data.alloc[d.id][kind] = next;
          return true;
        },
        valueFormatter: fmtNum,
        cellStyle: inputStyle,
      });
      const destGroups: ColGroupDef<SplitRow>[] = destinations.map((d) =>
        storeHeaderGroup(
          `${d.deptName}（${d.staffName}）`,
          d.tertiaryName,
          d.primaryName,
          [
            countCol(d, 'cases'),
            countCol(d, 'loose'),
            {
              headerName: '金額',
              colId: destColId(d.id, 'amount'),
              ...GRID_NUMBER_TEXT_FILTER,
              width: 96,
              valueGetter: totalOr(destColId(d.id, 'amount'), (r) =>
                calcSplitAmount(
                  r.alloc[d.id].cases,
                  r.alloc[d.id].loose,
                  r.capacity,
                  r.addUnit
                )
              ),
              valueFormatter: fmtNum,
              cellStyle: readonlyStyle,
            },
          ]
        )
      );

      return [...fixedCols, selfGroup, ...destGroups];
    },
    // 列は開いた時点で確定する（表示中に参照を変えない → 02 §7.1）
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const defaultColDef = useMemo<ColDef<SplitRow>>(
    () => ({
      // 共通の既定（行の型を持たない ColDef）を、この表の行の型の列設定として混ぜる
      ...(GRID_DEFAULT_COL_DEF as ColDef<SplitRow>),
      cellDataType: false,
      editable: false,
      sortable: false,
    }),
    []
  );

  const pinnedTopRowData = useMemo(() => [totalRow], [totalRow]);

  const handleCellValueChanged = (event: CellValueChangedEvent<SplitRow>) => {
    trackCellChange(event);
    // 同じ行の自部署負担分・金額（valueGetter）と強調を再描画する
    event.api.refreshCells({ rowNodes: [event.node], force: true });
    refreshSummary();
  };

  // 列幅・並び・ソートの状態を保存／復元する（→ 02 §7 列状態の永続化）
  const splitGridColumnStateProps = useGridColumnState(
    '支払詳細(追加口請求書有).追加口分割.columnState'
  );
  return (
    <div className="flex h-full flex-col">
      <p className="px-4 pb-1 text-sm text-gray-700">
        {readOnly
          ? '申請後のため、分割の内容は変更できません。'
          : '商流販売店ごとにケースとバラを入力してください。Excel の列をそのまま貼り付けられます（小数は四捨五入して整数にします）。分割しない明細は 0 のままにしてください。金額は「（ケース × 入数 ＋ バラ）× 追加口バラ単価」で自動算出し、自部署負担分には残りが自動で入ります。'}
      </p>
      <div className="px-4 pb-1">
        <CellColorLegend items={SPLIT_COLOR_LEGEND} />
      </div>
      <div className="min-h-0 flex-1 px-4">
        <div className="h-full w-full">
          <AgGridReact<SplitRow>
            {...splitGridColumnStateProps}
            ref={gridRef}
            rowData={rowData}
            pinnedTopRowData={pinnedTopRowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={getRowId}
            context={gridContext}
            getContextMenuItems={gridFilterContextMenuItems}
            onCellValueChanged={handleCellValueChanged}
            onFilterChanged={handleRefreshTotalRow}
            onRowDataUpdated={handleRefreshTotalRow}
            statusBar={GRID_STATUS_BAR}
            {...GRID_BASE_PROPS}
          />
        </div>
      </div>
      {/* 自部署負担分がマイナスの明細の警告（共通部品 Alert）。［設定］は止めないため、
          エラー（destructive）ではなく注意の配色にする（→ 第33回 決定事項10・11）。 */}
      {alertNos.length > 0 && (
        <Alert className="mx-4 mt-2 w-auto border-amber-300 bg-amber-50 py-2 text-amber-800">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="font-bold text-amber-800">
            自部署負担分がマイナスの明細が {alertNos.length} 件あります（
            {alertNos.map((n) => `No.${n}`).join('・')}
            ）。商流販売店に入れたケース・バラを確認してください。問題なければこのまま［設定］できます。
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
});
