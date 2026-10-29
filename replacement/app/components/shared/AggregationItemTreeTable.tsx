// 集計表「表示項目」ドリルダウン ─ 課題0623 共通コンポーネント
// 資料「各項目_折りたたみ表示」の階層木を AG Grid ネイティブ treeData で描画する、
// 集計系テーブル共通の表示項目パネル。ビュー（グラフ/詳細/年間/シミュレーション詳細）ごとに
// 〇=常時表示・△=＋ボタン切替・×=非表示を反映し、chevron＋件数でドリルダウンする。
//
// 数値は valueFor（実データ）で差し替える。periodTabs を渡すと対象月合計／累計／年間の
// サブタブを表示し、期間ごとの算出結果へ切り替える（シミュレーションはタブ無しで単一 valueFor）。
//
// treeData 用の共通 props・△項目の表示状態フック・項目名セルレンダラは本コンポーネント
// 専用のため、同ファイル内に持つ（旧 grid/gridAggregationTree.tsx から統合）。
import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { AgGridReact, type AgGridReactProps } from 'ag-grid-react';
import type {
  ColDef,
  ColGroupDef,
  GetRowIdParams,
  ICellRendererParams,
  GridApi,
} from 'ag-grid-community';
import {
  Plus,
  Minus,
  Calendar,
  TrendingUp,
  CalendarRange,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import {
  GRID_BASE_PROPS,
  GRID_DEFAULT_COL_DEF,
  GRID_COLORS,
  GRID_STATUS_BAR,
  useFormulaSourceHighlight,
  type FormulaDef,
  type FormulaDefs,
  GRID_NO_FILTER_COLUMN_TYPES,
} from '../grid';
import { formulaTooltip } from '../grid/gridCommon';
import type { AggregationView } from '../../constants/aggregationDisplayItems';
import {
  flattenAggregationTree,
  flattenAllTreeNodes,
  getOptionalItemIds,
  type AggTreeRow,
  type AggTreeNodeRef,
} from '../../constants/aggregationTree';
import {
  AGGREGATION_FORMULAS,
  AGG_RATIO_FORMULAS,
  AGG_COLUMN_LABELS,
} from '../../constants/aggregationFormulas';

// 期間サブタブのアイコン（対象月合計＝カレンダー／累計＝トレンド／年間＝期間）。
const PERIOD_TAB_ICONS = [Calendar, TrendingUp, CalendarRange];

// treeData 表示に必要な共通 props（getDataPath は行の hierarchyPath を参照）。
// 行クリックでも開閉できるようにする。autoGroupColumn は隠し、項目名は通常列＋
// AggregationTreeCell で描画する。
const AGGREGATION_TREE_GRID_PROPS: Partial<AgGridReactProps> = {
  treeData: true,
  getDataPath: (row: any) => row.hierarchyPath,
  groupDisplayType: 'custom',
  groupDefaultExpanded: 0,
  autoGroupColumnDef: {
    hide: true,
    headerName: '',
    width: 0,
    minWidth: 0,
  },
  suppressAggFuncInHeader: true,
  onRowClicked: (e: any) => {
    if (!e.node || e.node.rowPinned) return;
    if ((e.node.allChildrenCount ?? 0) > 0) {
      e.node.setExpanded(!e.node.expanded);
    }
  },
};

// △（optional）項目の表示ON/OFFを管理するフック。
// ＋ボタン（showAll/hideAll/toggle）で表示中の optional itemId 集合を切り替える。
const useOptionalItemToggle = (view: AggregationView) => {
  const optionalIds = useMemo(() => getOptionalItemIds(view), [view]);
  const [shownOptionalIds, setShownOptionalIds] = useState<Set<number>>(
    () => new Set()
  );

  const allShown =
    optionalIds.length > 0 &&
    optionalIds.every((id) => shownOptionalIds.has(id));

  const showAll = useCallback(
    () => setShownOptionalIds(new Set(optionalIds)),
    [optionalIds]
  );
  const hideAll = useCallback(() => setShownOptionalIds(new Set()), []);
  const toggleAll = useCallback(
    () =>
      setShownOptionalIds((prev) =>
        prev.size > 0 ? new Set() : new Set(optionalIds)
      ),
    [optionalIds]
  );
  const toggleItem = useCallback(
    (id: number) =>
      setShownOptionalIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    []
  );

  return {
    optionalIds,
    shownOptionalIds,
    allShown,
    hasOptional: optionalIds.length > 0,
    showAll,
    hideAll,
    toggleAll,
    toggleItem,
  };
};

// ── ドリルダウン開閉状態の永続化 ──
// 行の階層パスを1本のキーにする（項目名に区切り文字が含まれない前提の制御文字を使う）。
const PATH_SEPARATOR = '';
const pathKeyOf = (row: any): string =>
  Array.isArray(row?.hierarchyPath)
    ? row.hierarchyPath.join(PATH_SEPARATOR)
    : '';

// 行ID（→ 画面設計標準 4.7）。treeData のため、木全体で一意な階層パス（ノードキーの連結）を使う。
const getTreeRowId = (params: GetRowIdParams) => pathKeyOf(params.data);

// 保存キー：補助項目の表示／非表示ごとに別々に持ち、切り替えても各状態を維持する。
const expandStorageKeyOf = (baseKey: string, auxShown: boolean): string =>
  `${baseKey}.expand.${auxShown ? 'aux' : 'noaux'}`;

// 展開中の項目パスを localStorage から読む（未保存・パース失敗時は null＝既定の全折りたたみ）。
const readExpandedPaths = (storageKey: string): Set<string> | null => {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : null;
  } catch {
    return null;
  }
};

const writeExpandedPaths = (storageKey: string, paths: string[]): void => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(paths));
  } catch {
    // 保存できない環境（プライベートモード等）では永続化を諦める
  }
};

// 行が保持する木メタ情報（constants/aggregationTree.ts の AggTreeRow と対応）
interface TreeRowLike {
  label?: string;
  level?: number;
  descendantCount?: number;
}

// 項目名セル：親（子を持つ行）は chevron＋折りたたみ時に件数(n)を表示。
// 葉はインデントのみ。列は field を持たず本レンダラで data.label を描画する。
function AggregationTreeCell(params: ICellRendererParams) {
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
  const row = data as TreeRowLike;

  const hasChildren = (node?.allChildrenCount ?? 0) > 0;
  const level = row.level ?? 0;
  const descendantCount = row.descendantCount ?? 0;
  const showCount = hasChildren && !expanded && descendantCount > 0;

  return (
    <div
      className="flex items-center h-full w-full"
      style={{ paddingLeft: `${level}rem` }}
    >
      {hasChildren ? (
        <button
          type="button"
          className="flex items-center border-0 bg-transparent cursor-pointer px-1"
          aria-label={expanded ? '折りたたむ' : '展開する'}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      ) : (
        <span className="inline-block w-[1.5rem]" />
      )}
      <span>
        {row.label}
        {showCount && (
          <span className="ml-1 text-gray-500">({descendantCount})</span>
        )}
      </span>
    </div>
  );
}

// 表示する数値列の定義。key は valueFor の第2引数に渡る。
export interface AggTreeColumn {
  key: string;
  headerName: string;
  // 率列（100%超で赤字・末尾%表示）
  isRate?: boolean;
}

// 対象期間別サブタブ（対象月合計／累計／年間）。各期間の算出結果 valueFor を持つ。
export interface AggTreePeriodTab {
  label: string;
  valueFor: (row: AggTreeNodeRef, columnKey: string) => string | number;
}

export interface AggregationItemTreeTableProps {
  // どのタブの可視性を使うか
  view: AggregationView;
  // パネル見出し（省略可）
  title?: string;
  // 数値列（省略時は既存集計表と同じ：計画/実績・予算・予算比・予算差・前年・前年比・前年差）
  columns?: AggTreeColumn[];
  // itemId・列key から表示値を返す（単一期間。periodTabs 指定時は無視）
  valueFor?: (row: AggTreeNodeRef, columnKey: string) => string | number;
  // 対象期間サブタブ（指定時はタブを表示し、選択期間の valueFor を使用）
  periodTabs?: AggTreePeriodTab[];
  // グリッド高さ（px 相当の数値。省略時 420）
  height?: number;
  // ドリルダウン開閉状態を localStorage へ保存するときのキー（画面・表ごとに一意）。
  // 省略時は保存せず、従来どおり常に全て折りたたんだ状態で表示する。
  expandStateKey?: string;
}

// 既存集計表と揃えた既定列：計画/実績・予算・予算比・予算差・前年・前年比・前年差。
const DEFAULT_COLUMNS: AggTreeColumn[] = [
  { key: 'plan', headerName: '計画/実績' },
  { key: 'budget', headerName: '予算' },
  { key: 'budgetRate', headerName: '予算比', isRate: true },
  { key: 'budgetDiff', headerName: '予算差' },
  { key: 'prevYear', headerName: '前年' },
  { key: 'yoy', headerName: '前年比', isRate: true },
  { key: 'prevYearDiff', headerName: '前年差' },
];

// グリッドへ渡す行。AggTreeRow に各列の表示値を載せたもの。
type AggGridRow = AggTreeRow & Record<string, unknown>;

const toNum = (s: unknown) =>
  s === '' || s == null ? NaN : parseFloat(String(s).replace(/,/g, ''));

export function AggregationItemTreeTable({
  view,
  title,
  columns = DEFAULT_COLUMNS,
  valueFor,
  periodTabs,
  height = 420,
  expandStateKey,
}: AggregationItemTreeTableProps) {
  const { shownOptionalIds, hasOptional, allShown, toggleAll } =
    useOptionalItemToggle(view);
  const [activePeriod, setActivePeriod] = useState(0);

  // ドリルダウンの開閉状態。expandStateKey 指定時のみ localStorage に保存し、
  // 補助項目の表示／非表示それぞれの状態を別々に保持する。
  const expandApiRef = useRef<GridApi | null>(null);
  // 復元中の setExpanded で保存が走らないようにするフラグ。
  const restoringExpandRef = useRef(false);
  const expandStorageKey = expandStateKey
    ? expandStorageKeyOf(expandStateKey, allShown)
    : null;

  // 保存済みの開閉状態をグリッドへ適用する。保存が無ければ既定（全て折りたたみ）。
  const restoreExpandState = useCallback(() => {
    const api = expandApiRef.current;
    if (!api || !expandStorageKey) return;
    const saved = readExpandedPaths(expandStorageKey);
    restoringExpandRef.current = true;
    api.forEachNode((node) => {
      if ((node.allChildrenCount ?? 0) <= 0) return;
      const shouldExpand = saved ? saved.has(pathKeyOf(node.data)) : false;
      if (!!node.expanded !== shouldExpand) node.setExpanded(shouldExpand);
    });
    restoringExpandRef.current = false;
  }, [expandStorageKey]);

  // 現在の開閉状態を保存する。
  const saveExpandState = useCallback(() => {
    const api = expandApiRef.current;
    if (!api || !expandStorageKey || restoringExpandRef.current) return;
    const paths: string[] = [];
    api.forEachNode((node) => {
      if (node.expanded && (node.allChildrenCount ?? 0) > 0) {
        const key = pathKeyOf(node.data);
        if (key) paths.push(key);
      }
    });
    writeExpandedPaths(expandStorageKey, paths);
  }, [expandStorageKey]);

  // 補助項目の表示／非表示を切り替えると行が作り直されるため、
  // 切り替え後にそのモードで保存された開閉状態を復元する。
  useEffect(() => {
    restoreExpandState();
  }, [restoreExpandState]);

  // 期間サブタブがあれば選択中期間の valueFor、なければ単一 valueFor を使用
  const activeValueFor = periodTabs
    ? periodTabs[activePeriod]?.valueFor
    : valueFor;

  // 可視性＋＋ボタン状態を反映した treeData 行（選択期間の算出結果を各列へ）
  const rows = useMemo(() => {
    const treeRows = flattenAggregationTree(view, { shownOptionalIds });
    return treeRows.map((r) => {
      const withValues: Record<string, unknown> = { ...r };
      columns.forEach((c) => {
        withValues[c.key] = activeValueFor ? activeValueFor(r, c.key) : '';
      });
      return withValues;
    });
  }, [view, shownOptionalIds, columns, activeValueFor]);

  // 計算式ツールチップの実値行は、画面に出ていない算出元（× 非表示・△ 非表示・
  // 折りたたみ中）の値も表示する。可視性を無視した全ノードの表示値を引けるようにする。
  const valueByKey = useMemo(() => {
    const map = new Map<string, Record<string, string>>();
    if (!activeValueFor) return map;
    flattenAllTreeNodes().forEach((node) => {
      const byColumn: Record<string, string> = {};
      columns.forEach((c) => {
        byColumn[c.key] = String(activeValueFor(node, c.key) ?? '');
      });
      map.set(node.key, byColumn);
    });
    return map;
  }, [columns, activeValueFor]);

  // ノードキー → 項目名（ツールチップ1行目の置換に使う）。
  const labelByKey = useMemo(() => {
    const map = new Map<string, string>();
    flattenAllTreeNodes().forEach((n) => map.set(n.key, n.label));
    return map;
  }, []);

  // 列ごとの計算式定義。valueByKey / labelByKey が変わるたびに作り直される。
  //   計画/実績列 … 項目ごとの式（参照先は同じ列の別項目行）
  //   予算比/予算差/前年比/前年差 … 同一行の別列を参照する式（補足3-1）
  //   予算・前年の金額列は設定値／実績値なので算出セルにしない
  const liveFormulaDefs = useMemo<FormulaDefs<AggGridRow>>(() => {
    const cellValue = (nodeKey: string, columnKey: string): string | null =>
      valueByKey.get(nodeKey)?.[columnKey] ?? null;

    const planDef: FormulaDef<AggGridRow> = {
      isFormula: (row) => !!AGGREGATION_FORMULAS[row.key],
      crossRefs: (row, colId) =>
        (AGGREGATION_FORMULAS[row.key]?.refKeys ?? []).map(
          (ref) => `${colId}::${ref}`
        ),
      tooltip: (row, colId) => {
        const formula = AGGREGATION_FORMULAS[row.key];
        if (!formula) return '';
        return formulaTooltip(
          formula,
          (token) => labelByKey.get(token) ?? token,
          (token) => cellValue(token, colId),
          String(row[colId] ?? '')
        );
      },
    };

    const ratioDef = (
      columnKey: keyof typeof AGG_RATIO_FORMULAS
    ): FormulaDef<AggGridRow> => ({
      crossRefs: (row) =>
        AGG_RATIO_FORMULAS[columnKey].refKeys.map(
          (ref) => `${ref}::${row.key}`
        ),
      tooltip: (row, colId) =>
        formulaTooltip(
          AGG_RATIO_FORMULAS[columnKey],
          (token) => AGG_COLUMN_LABELS[token] ?? token,
          (token) => cellValue(row.key, token),
          String(row[colId] ?? '')
        ),
    });

    return {
      plan: planDef,
      budgetRate: ratioDef('budgetRate'),
      budgetDiff: ratioDef('budgetDiff'),
      yoy: ratioDef('yoy'),
      prevYearDiff: ratioDef('prevYearDiff'),
    };
  }, [valueByKey, labelByKey]);

  // フックは初回の defs を保持するため、可変な定義は ref 経由で読む。
  const formulaDefsRef = useRef(liveFormulaDefs);
  formulaDefsRef.current = liveFormulaDefs;

  const stableFormulaDefs = useMemo<FormulaDefs<AggGridRow>>(() => {
    const proxyFor = (colId: string): FormulaDef<AggGridRow> => ({
      isFormula: (row) => {
        const def = formulaDefsRef.current[colId];
        if (!def) return false;
        return def.isFormula ? def.isFormula(row) : true;
      },
      crossRefs: (row, id) =>
        formulaDefsRef.current[colId]?.crossRefs?.(row, id) ?? [],
      tooltip: (row, id) =>
        formulaDefsRef.current[colId]?.tooltip?.(row, id) ?? '',
    });
    return {
      plan: proxyFor('plan'),
      budgetRate: proxyFor('budgetRate'),
      budgetDiff: proxyFor('budgetDiff'),
      yoy: proxyFor('yoy'),
      prevYearDiff: proxyFor('prevYearDiff'),
    };
  }, []);

  // 行はツリーノードキーで識別する（行またぎのハイライトに使う）。
  const formulaHL = useFormulaSourceHighlight<AggGridRow>(stableFormulaDefs, {
    cellKeyOf: (params) =>
      `${params.colDef?.colId ?? params.colDef?.field ?? ''}::${params.data?.key ?? ''}`,
  });

  const numberCellStyle = (params: any) => {
    const style: any = { textAlign: 'right' };
    if (toNum(params.value) < 0) style.color = GRID_COLORS.overText;
    return style;
  };
  const rateCellStyle = (params: any) => {
    const style: any = { textAlign: 'right' };
    if (toNum(params.value) > 100) style.color = GRID_COLORS.overText;
    return style;
  };

  // 列は「計画詳細の詳細タブ」と同構成：項目 / 計画・実績 / 予算(予算・予算比・予算差) /
  // 前年(前年・前年比・前年差)。予算比/差・前年比/差は列グループ開閉で表示する。
  const columnDefs: (ColDef | ColGroupDef)[] = useMemo(() => {
    const valCol = (
      headerName: string,
      field: string,
      opts: { isRate?: boolean; collapse?: boolean } = {}
    ): ColDef => ({
      headerName,
      field,
      colId: field,
      flex: 1,
      minWidth: 96,
      cellStyle: opts.isRate ? rateCellStyle : numberCellStyle,
      ...(opts.collapse ? { columnGroupShow: 'open' as const } : {}),
    });
    return [
      {
        headerName: '項目',
        field: 'label',
        colId: 'label',
        width: 240,
        lockPinned: true,
        // 中身は左寄せ（grid.css の ag-cell-left-pinned）。ヘッダ色・罫線は共通テーマに準拠。
        cellClass: 'ag-cell-left-pinned',
        cellRenderer: AggregationTreeCell,
      },
      valCol('計画/実績', 'plan'),
      {
        headerName: '予算',
        groupId: 'budgetGroup',
        children: [
          valCol('金額', 'budget'),
          valCol('予算比', 'budgetRate', { isRate: true, collapse: true }),
          valCol('予算差', 'budgetDiff', { collapse: true }),
        ],
      },
      {
        headerName: '前年',
        groupId: 'prevGroup',
        children: [
          valCol('金額', 'prevYear'),
          valCol('前年比', 'yoy', { isRate: true, collapse: true }),
          valCol('前年差', 'prevYearDiff', { collapse: true }),
        ],
      },
    ];
  }, []);

  const defaultColDef = useMemo(
    () => ({
      ...GRID_DEFAULT_COL_DEF,
      resizable: true,
      sortable: false,
      filter: false,
      // 計算式セルは計算式テキスト、それ以外は従来どおりセル値を表示する。
      // 注記を持つ項目（納品金額など）は、その行のどのセルでも注記を添える（課題1815）。
      tooltipValueGetter: (params: any) => {
        const base = formulaHL.tooltipValueGetter(params);
        const note: string | undefined = params.data?.note;
        if (!note) return base;
        return base
          ? `${base}
${note}`
          : note;
      },
      // 算出元セルの枠線ハイライト（計算式セルのホバー中のみ付与）。値が無いセルのグレーの「-」は共通のルールを残す
      cellClassRules: {
        ...GRID_DEFAULT_COL_DEF.cellClassRules,
        ...formulaHL.cellClassRules,
      },
    }),
    [formulaHL.tooltipValueGetter, formulaHL.cellClassRules]
  );

  return (
    <div className="w-full">
      {/* 見出し（任意） */}
      {title && (
        <div className="mb-2">
          <span className="text-sm font-bold text-gray-900">{title}</span>
        </div>
      )}
      {/* 対象期間サブタブ（対象月合計／累計／年間）。グラフ側の期間タブと同デザイン。 */}
      {periodTabs && periodTabs.length > 0 && (
        <div className="grid w-full grid-cols-3 gap-1 mb-2">
          {periodTabs.map((tab, idx) => {
            const Icon = PERIOD_TAB_ICONS[idx] ?? Calendar;
            const active = activePeriod === idx;
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => setActivePeriod(idx)}
                className={`flex items-center justify-center gap-2 rounded border-b-2 px-4 py-3 transition-colors ${
                  active
                    ? 'bg-transparent text-blue-600 border-b-blue-600'
                    : 'bg-gray-100 text-gray-600 border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}
      {/* 補助項目トグル（期間タブの下に配置） */}
      {hasOptional && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={toggleAll}
            className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
            aria-label={allShown ? '補助項目を隠す' : '補助項目を表示'}
          >
            {allShown ? (
              <Minus className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {allShown ? '補助項目を隠す' : '補助項目を表示'}
          </button>
        </div>
      )}
      <div style={{ height }} className="w-full">
        <AgGridReact
          {...GRID_BASE_PROPS}
          // ツリー表示に必要な設定は共通設定の後ろに置いて優先する
          {...AGGREGATION_TREE_GRID_PROPS}
          onRowClicked={undefined}
          rowData={rows}
          getRowId={getTreeRowId}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          // defaultColDef で filter: false のため、型によるフィルタの追加を止める（→ grid/gridCommon）
          columnTypes={GRID_NO_FILTER_COLUMN_TYPES}
          statusBar={GRID_STATUS_BAR}
          suppressMovableColumns={true}
          ensureDomOrder={true}
          onGridReady={(e) => {
            formulaHL.captureApi(e.api);
            expandApiRef.current = e.api;
            restoreExpandState();
          }}
          // 行が作り直された後（補助項目の切り替え等）に開閉状態を復元する
          onRowDataUpdated={restoreExpandState}
          // 開閉のたびに現在の状態を保存する（AG Grid 公式イベント）
          onRowGroupOpened={saveExpandState}
          onCellMouseOver={formulaHL.onCellMouseOver}
          onCellMouseOut={formulaHL.onCellMouseOut}
          // 計算式をツールチップで見せるため、省略されていないセルでも出す（グローバルは whenTruncated）
          tooltipShowMode="standard"
          tooltipShowDelay={300}
          tooltipHideDelay={5000}
          onCellClicked={(e) => {
            // 予算/前年セルのクリックで列グループ（比/差）を開閉
            const colId = e.column?.getColId();
            if (colId === 'budget' || colId === 'prevYear') {
              const groupId = colId === 'budget' ? 'budgetGroup' : 'prevGroup';
              const st = e.api
                .getColumnGroupState()
                .find((g) => g.groupId === groupId);
              e.api.setColumnGroupOpened(groupId, !(st?.open ?? false));
              return;
            }
            // それ以外のセルのクリックで行ドリルダウンを開閉
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
