import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  ColGroupDef,
  FilterChangedEvent,
  GetRowIdParams,
  GridApi,
  RowDataUpdatedEvent,
} from 'ag-grid-community';
import { ChevronRight, Plus, Copy } from 'lucide-react';

import {
  viewportGridHeight,
  GRID_COLORS,
  GRID_DEFAULT_COL_DEF,
  GRID_WRAP_HEADER_COL_DEF,
  GRID_EMPTY_TEXT,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  changedCellStyle,
  formatEmptyAsDash,
  gridFilterContextMenuItems,
  useGridColumnState,
  copySourceLeftBorder,
  CopySourceLegend,
  withHeaderTooltips,
  withSpanSafeHeaderHeight,
  useRevealNewRows,
  useChangedCells,
  useLinkedCellUndo,
  GRID_MONTH_TEXT_FILTER,
  GRID_NUMBER_FILTER,
  CopyDeleteCellRenderer,
  asCellStyle,
} from '@/app/components/grid';

import { MonthYearCellEditor } from '@/app/components/ui/month-year-cell-editor';
import type { SingleComboboxOption } from '@/app/components/ui/single-combobox';
import { EXPENSE_SUMMARY_PRODUCT_OPTIONS } from '@/app/constants/productMasters';
import { SingleComboboxCellEditor } from '@/app/components/ui/single-combobox-cell-editor';
import {
  managementClassFromCode,
  isManagementCodeInClass,
  campaignClassFromCode,
  isCampaignCodeInClass,
} from '@/app/utils/common/expenseRelations';
import {
  managementClassComboOptions,
  managementCodeComboOptions,
  campaignClassComboOptions,
  campaignCodeComboOptions,
  summaryProductComboOptions,
  managementClassCodeComboOptions,
  managementCodeNameComboOptions,
  campaignClassCodeComboOptions,
  campaignCodeNameComboOptions,
} from '@/app/constants/comboFieldOptions';
import {
  metaBrandComboOptions,
  managementClassCodeOf,
  managementCodeNameOf,
  campaignClassCodeOf,
  campaignCodeNameOf,
  managementClassNameOf,
  managementCodeOfName,
  campaignClassNameOf,
  campaignCodeOfName,
} from '@/app/utils/common/comboFieldOptions';

// 拡売費データ／グリッド操作ハンドルは共有型（types/nonProductExpense）へ集約。
// 既存の import 元互換のため、ここから再エクスポートする。
import type {
  NonProductExpenseData,
  NonProductExpenseGridHandle,
} from '@/app/types/nonProductExpense';
import { hasPriorYearActual } from '@/app/utils/sales-plan/plan-detail/nonProductExpenseRow';
import { PlanRateMenu, type PlanRateLinkItem } from './PlanDetailHeaderMenus';

export type { NonProductExpenseData, NonProductExpenseGridHandle };

// 行ID（合計行・年契基本分・取組強化マージンの行は固定ID、明細行は no）。
// 参照を固定して Undo 履歴を保つ（→ 02 §7.1）
const getExpenseRowId = (params: GetRowIdParams<NonProductExpenseData>) =>
  params.data.isTotal
    ? 'total'
    : params.data._rateLinked
      ? `rate-${params.data._rateLinked}`
      : String(params.data.no);

// 上段固定の行のうち、年契基本分・取組強化マージンの行は計上年月を編集できるため
// 変更ハイライトの対象に含める（合計行は対象外）。
const isRateLinkedPinnedRow = (params: any) => !!params.data?._rateLinked;

// 拡売費サマリ商品マスタ（「ー（指定なし）」を除く）と
// サマリ商品名 → メタブランド の対応（行内の自動連動に使用）
const EXPENSE_PRODUCTS = EXPENSE_SUMMARY_PRODUCT_OPTIONS.filter(
  (o) => o.value !== '-'
);
const BRAND_BY_PRODUCT = new Map<string, string>(
  EXPENSE_PRODUCTS.map((o) => [o.value, o.metaBrand])
);

// 行にサマリ商品名が選択されているか（「ー（指定なし）」・空は未選択とみなす）
const hasSummaryProduct = (row?: NonProductExpenseData) =>
  !!row?.summaryProduct && row.summaryProduct !== '-';

// rateLinkedRows 未指定時の既定値（毎レンダリングで新しい配列を作らないよう定数にする）
const EMPTY_ROWS: NonProductExpenseData[] = [];

// 編集・操作できない行（合計行／年契基本分・取組強化マージンの行）か。
// ただし年契基本分・取組強化マージンの行も計上年月だけは編集できる（計上年月の列で個別に判定）。
const isFixedRow = (row?: NonProductExpenseData) =>
  !!row?.isTotal || !!row?._rateLinked;

interface PlanNonProductExpensePaneProps {
  // 拡売費の明細の初期値（画面が取得して渡す）
  initialRows: NonProductExpenseData[];
  // 年契基本分・センターフィ等の右ペインを開く項目。販売計画(詳細)と同じく見出しの行の「率設定」メニューに出す。
  // 開いた右ペインは販売計画(詳細)から開いた場合と同じく編集できる（課題1780）。
  rateLinks?: PlanRateLinkItem[];
  // 見出しの行の先頭に置く「販売計画(詳細)｜拡売費計画」の切替（親が持つ。UX-106）
  sectionSwitch?: React.ReactNode;
  onOpenAddExpense?: () => void;
  onDeleteExpense?: (data: NonProductExpenseData) => void;
  onOpenCopyExpense?: (data: NonProductExpenseData) => void;
  pendingCopyRow?: NonProductExpenseData | null;
  onCopyComplete?: () => void;
  /** 「参照用」ボタン押下（コピー元の下ペインを開閉する） */
  onOpenReference?: () => void;
  /** 参照ペインのコピーボタンで取り込む行（合計行の直下へ挿入） */
  pendingReferenceRows?: NonProductExpenseData[] | null;
  /** 取り込み完了通知 */
  onReferenceConsumed?: () => void;
  // 拡売費の全明細行が変わったときに親へ通知する（販売計画(集計)の算出元）。
  // 親側は必ず useCallback で安定化したハンドラを渡すこと。
  onRowsChange?: (rows: NonProductExpenseData[]) => void;
  // 年契基本分・取組強化マージンの行（右ペインの設定から親が組み立てる。utils/sales-plan/plan-detail/rateLinkedExpenseRows）。
  // 合計行の直下に非活性で表示し、合計に含める。拡売費の明細（onRowsChange）には含めない。
  // 計上年月だけは編集でき、変更は onRateLinkedPostingMonthChange で親へ通知する。
  rateLinkedRows?: NonProductExpenseData[];
  // 年契基本分・取組強化マージンの行で計上年月を変更したときに親へ通知する（右ペインの設定へ反映する）
  onRateLinkedPostingMonthChange?: (
    kind: NonNullable<NonProductExpenseData['_rateLinked']>,
    postingMonth: string
  ) => void;
}

// 施策区分・施策コードの選択肢（任意入力。SingleCombobox で選択／クリア可能）
const CAMPAIGN_CLASS_OPTIONS: SingleComboboxOption[] = [
  { value: '新規導入', label: '新規導入' },
  { value: '販売促進', label: '販売促進' },
  { value: 'スポット', label: 'スポット' },
  { value: 'リピート', label: 'リピート' },
];

const CAMPAIGN_CODE_OPTIONS: SingleComboboxOption[] = [
  'SN001',
  'SN002',
  'SN003',
  'SN004',
  'SP001',
  'SP002',
  'SP003',
  'SS001',
  'SS002',
  'SS003',
  'SR001',
  'SR002',
  'SR003',
].map((code) => ({ value: code, label: code }));

// 拡売費の各列で共通の選択肢
const EXPENSE_MANAGEMENT_CLASS_LIST = [
  '売上連動拡売費A口',
  '売上連動拡売費B口',
  '売上連動拡売費本社口',
  '拡売費(固定費)A口',
  '拡売費(固定費)B口',
  '拡売費(固定費)本社口',
];
const EXPENSE_MANAGEMENT_CODE_LIST = [
  'RA001',
  'RA002',
  'RB001',
  'RB002',
  'RH001',
  'RH002',
  'FA001',
  'FA002',
  'FB001',
  'FB002',
  'FH001',
  'FH002',
];

// コピー・削除の列（共通セル部品 CopyDeleteCellRenderer）。
// 年契基本分・取組強化マージンの行はコピー・削除させない（削除したいときは右ペインで0にする）。
// 前年実績がある行は実績と紐づくため削除させない。
const COPY_DELETE_PARAMS = {
  isHidden: (row: unknown) => isFixedRow(row as NonProductExpenseData),
  deleteDisabledReason: (row: unknown) =>
    hasPriorYearActual((row as NonProductExpenseData)?.exp1PriorYearActual)
      ? '前年実績がある行は削除できません'
      : null,
};

export const PlanNonProductExpensePane = forwardRef<
  NonProductExpenseGridHandle,
  PlanNonProductExpensePaneProps
>(function PlanNonProductExpensePane(
  {
    initialRows,
    onOpenAddExpense,
    onDeleteExpense,
    onOpenCopyExpense,
    pendingCopyRow,
    onCopyComplete,
    onOpenReference,
    pendingReferenceRows,
    onReferenceConsumed,
    onRowsChange,
    rateLinkedRows = EMPTY_ROWS,
    onRateLinkedPostingMonthChange,
    rateLinks,
    sectionSwitch,
  }: PlanNonProductExpensePaneProps,
  ref
) {
  // コピーで増えた行を見つけやすくする（行全体をフラッシュし可視域へ送る）。
  // 行追加は state 更新のため、追加直後はまだグリッドに行が無い。コピー処理で
  // markRows へ行を記録し、onRowDataUpdated（＝行が反映された後）で強調する。
  const reveal = useRevealNewRows({ focusColumn: 'metaBrand' });
  // 保存時に編集セルの強調を消す（値は変わらないため再描画を明示する）ためのAPI
  const gridApiRef = useRef<GridApi | null>(null);

  // 列状態（列幅・並び順・ソート・固定・表示）を localStorage へ永続化。
  const gridColumnStateProps = useGridColumnState(
    'Wholesale.nonProductExpense.columnState.v2',
    {
      // 新規行の強調表示にグリッドAPIが要るため、ここで受け取る
      // （JSX の onGridReady は本フックの戻り値に上書きされるので使わない）
      onGridReady: (event: { api: GridApi }) => {
        reveal.captureApi(event.api);
        gridApiRef.current = event.api;
      },
    }
  );

  // 編集セルの変更ハイライト（黄色＋オレンジ枠）の追跡・判定（共通フック → 02 §7.2）。
  // 上段固定の行のうち、年契基本分・取組強化マージンの行は計上年月を編集できるため強調対象に含める。
  const { isCellChanged, trackCellChange, resetChangedCells } = useChangedCells(
    { isPinnedRowTracked: isRateLinkedPinnedRow }
  );

  // 主セルの編集に連動する従属セルの更新は共通フックに委譲する（→ 02 §7.3）。
  // 従属セルは node.data 直接更新のため Undo スタックに積まれず、Ctrl+Z 1回で主セルごと戻る。
  const { makeHandler, clearCache } =
    useLinkedCellUndo<NonProductExpenseData>();

  // サンプルデータ (10件)
  const [expenseRows, setExpenseRows] =
    useState<NonProductExpenseData[]>(initialRows);
  // 拡売費行が変わるたびに親へ通知する（集計値をグリッドの現在値へ追従させる）
  useEffect(() => {
    onRowsChange?.(expenseRows);
  }, [expenseRows, onRowsChange]);
  // コピー／参照取り込み行に一意な no を採番するためのカウンタ
  const nextNoRef = useRef(1000);

  // 親（追加/コピー/編集/削除ペイン）からの行操作を公開
  useImperativeHandle(ref, () => ({
    addRow: (row: NonProductExpenseData) => {
      // 拡売費追加=new。行コピーから呼ぶ場合は row._copySource='detail' を渡して上書きできる
      const copySource = row._copySource ?? 'new';
      const added = {
        ...row,
        no: nextNoRef.current++,
        isTotal: false,
        _copySource: copySource,
      };
      // 強調はコピー経路のみ（拡売費追加ペインからの追加は対象外）
      if (copySource !== 'new') reveal.markRows([added]);
      setExpenseRows((prev) => [added, ...prev]);
    },
    // セル編集を経由しない行の差し替えのため、連動セルのキャッシュも破棄する（→ 02 §7.3）
    updateRow: (row: NonProductExpenseData) => {
      setExpenseRows((prev) =>
        prev.map((r) => (r.no === row.no ? { ...r, ...row } : r))
      );
      clearCache();
    },
    deleteRow: (no: number) =>
      setExpenseRows((prev) => prev.filter((r) => r.no !== no)),
    // 計画保存時：左端の帯（コピー・追加由来）と編集セルの強調を消す。
    // 保存した値を新たな元値とするため、元値の記録もリセットする。
    clearSavedMarks: () => {
      setExpenseRows((prev) =>
        prev.map((r) => (r._copySource ? { ...r, _copySource: undefined } : r))
      );
      resetChangedCells();
      // 保存した値を新たな基準とするため、連動セルのキャッシュも破棄する（→ 02 §7.3）
      clearCache();
      setTimeout(() => gridApiRef.current?.refreshCells({ force: true }), 0);
    },
  }));

  const handleDelete = (data: NonProductExpenseData) => {
    if (onDeleteExpense) {
      onDeleteExpense(data);
    }
  };

  const handleCopy = (data: NonProductExpenseData) => {
    if (onOpenCopyExpense) {
      onOpenCopyExpense(data);
    }
  };

  const handleAdd = () => {
    if (onOpenAddExpense) {
      onOpenAddExpense();
    }
  };

  // 編集済みセルを記録（元値に戻したら解除）し、当該セルを再描画して
  // 黄色＋オレンジ枠（changedCellStyle）を反映する
  const markChangedCell = useCallback(
    (params: any) => {
      trackCellChange(params);
      params.api.refreshCells({
        rowNodes: [params.node],
        columns: [params.column.getColId()],
        force: true,
      });
    },
    [trackCellChange]
  );

  // セル値更新ハンドラ
  const handleCellValueChanged = useCallback(
    (params: any) => {
      markChangedCell(params);
      const updatedData = params.data;
      setExpenseRows((prev) =>
        prev.map((row) => (row.no === updatedData.no ? updatedData : row))
      );
    },
    [markChangedCell]
  );

  // 計上年月の更新ハンドラ。年契基本分・取組強化マージンの行は拡売費の明細に含めず
  // 右ペインの設定から組み立て直すため、親へ通知して設定側の計上月を変える。
  const handlePostingMonthChanged = useCallback(
    (params: any) => {
      const kind = params.data?._rateLinked;
      if (!kind) {
        handleCellValueChanged(params);
        return;
      }
      markChangedCell(params);
      onRateLinkedPostingMonthChange?.(kind, String(params.newValue ?? ''));
    },
    [handleCellValueChanged, markChangedCell, onRateLinkedPostingMonthChange]
  );

  // 連動ハンドラの後に、主セルの変更記録・state 同期（handleCellValueChanged）を行う。
  // highlightDeps：値が変わったら変更ハイライトを付ける従属セル（メタブランド・サマリ商品名）。
  const withChangeTracking = useCallback(
    (
      linked: (params: any) => Promise<void>,
      highlightDeps: (keyof NonProductExpenseData)[] = []
    ) =>
      async (params: any): Promise<void> => {
        const before = highlightDeps.map((f) => params.data[f]);
        await linked(params);
        highlightDeps.forEach((field, i) => {
          if (before[i] === params.data[field]) return;
          trackCellChange({
            node: params.node,
            colDef: { field },
            oldValue: before[i],
            newValue: params.data[field],
          });
        });
        if (highlightDeps.length > 0) {
          params.api.refreshCells({ rowNodes: [params.node], force: true });
        }
        handleCellValueChanged(params);
      },
    [trackCellChange, handleCellValueChanged]
  );

  // サマリ商品名変更時：該当するメタブランドを自動セットし、変更ハイライトも付ける。
  const handleSummaryProductChanged = useMemo(
    () =>
      withChangeTracking(
        makeHandler('summaryProduct', {
          depFields: ['metaBrand'],
          deriveDeps: (value, row) => ({
            metaBrand: BRAND_BY_PRODUCT.get(value) ?? row.metaBrand,
          }),
        }),
        ['metaBrand']
      ),
    [withChangeTracking, makeHandler]
  );

  // メタブランド変更時：新ブランドに該当しないサマリ商品名はクリアし、変更ハイライトも付ける。
  const handleMetaBrandChanged = useMemo(
    () =>
      withChangeTracking(
        makeHandler('metaBrand', {
          depFields: ['summaryProduct'],
          deriveDeps: (value, row) => ({
            summaryProduct:
              row.summaryProduct &&
              BRAND_BY_PRODUCT.get(row.summaryProduct) !== value
                ? ''
                : row.summaryProduct,
          }),
        }),
        ['summaryProduct']
      ),
    [withChangeTracking, makeHandler]
  );

  // 以下4つは、コード列・名称列のどちらから確定しても同じ結果になるよう、
  // 確定値（params.newValue）ではなく行データの値を基準に導出する。
  // 管理コード（コード列・名称列のいずれか）確定時：
  // 行の管理コードから管理区分を自動セットする（管理区分・管理区分名称の両列に反映）。
  const handleMgmtCodeChanged = useMemo(
    () =>
      withChangeTracking(
        makeHandler('exp1ManagementCode', {
          depFields: ['exp1ManagementClass'],
          deriveDeps: (_value, row) => ({
            exp1ManagementClass:
              managementClassFromCode(row.exp1ManagementCode) ||
              row.exp1ManagementClass,
          }),
        })
      ),
    [withChangeTracking, makeHandler]
  );

  // 管理区分（区分値列・名称列のいずれか）確定時：該当しない管理コードはクリア
  const handleMgmtClassChanged = useMemo(
    () =>
      withChangeTracking(
        makeHandler('exp1ManagementClass', {
          depFields: ['exp1ManagementCode'],
          deriveDeps: (_value, row) => ({
            exp1ManagementCode:
              row.exp1ManagementCode &&
              !isManagementCodeInClass(
                row.exp1ManagementCode,
                row.exp1ManagementClass
              )
                ? ''
                : row.exp1ManagementCode,
          }),
        })
      ),
    [withChangeTracking, makeHandler]
  );

  // 施策コード（コード列・名称列のいずれか）確定時：施策区分を自動セット
  const handleCampaignCodeChanged = useMemo(
    () =>
      withChangeTracking(
        makeHandler('exp1CampaignCode', {
          depFields: ['exp1CampaignClass'],
          deriveDeps: (_value, row) => ({
            exp1CampaignClass:
              campaignClassFromCode(row.exp1CampaignCode) ||
              row.exp1CampaignClass,
          }),
        })
      ),
    [withChangeTracking, makeHandler]
  );

  // 施策区分（区分値列・名称列のいずれか）確定時：該当しない施策コードはクリア
  const handleCampaignClassChanged = useMemo(
    () =>
      withChangeTracking(
        makeHandler('exp1CampaignClass', {
          depFields: ['exp1CampaignCode'],
          deriveDeps: (_value, row) => ({
            exp1CampaignCode:
              row.exp1CampaignCode &&
              !isCampaignCodeInClass(
                row.exp1CampaignCode,
                row.exp1CampaignClass
              )
                ? ''
                : row.exp1CampaignCode,
          }),
        })
      ),
    [withChangeTracking, makeHandler]
  );

  // pendingCopyRow が来たらコピー行を追加（一意な no を採番）
  useEffect(() => {
    if (pendingCopyRow) {
      const added = {
        ...pendingCopyRow,
        no: nextNoRef.current++,
        isTotal: false,
        // 'detail' は共有カラーバー凡例の「拡売費コピー」（緑）を指す
        // （COPY_SOURCE_COLORS.detail）。拡売費行のコピーペイン経由の追加を表す。
        _copySource: 'detail' as const,
      };
      // 追加した行を強調対象にする（行反映後にフックが拾う）
      reveal.markRows([added]);
      // 新規の行は明細の最上部に追加する（→ 02 §8「行の追加位置」）
      setExpenseRows((prev) => [added, ...prev]);
      onCopyComplete?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 意図的に依存を限定（列定義/ヘルパーの安定化・再実行抑止のため）
  }, [pendingCopyRow]);

  // 参照ペインのコピーボタンで取り込んだ行を合計行の直下（先頭）へ挿入。
  // 合計行は上段固定（pinnedTopRows）のため、先頭に積めば固定行の直下に並ぶ。
  useEffect(() => {
    if (pendingReferenceRows && pendingReferenceRows.length > 0) {
      const added = pendingReferenceRows.map((row) => ({
        ...row,
        isTotal: false,
        no: nextNoRef.current++,
        _copySource: 'reference' as const,
      }));
      // 追加した行を強調対象にする（行反映後にフックが拾う）
      reveal.markRows(added);
      setExpenseRows((prev) => [...added, ...prev]);
      onReferenceConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 意図的に依存を限定（列定義/ヘルパーの安定化・再実行抑止のため）
  }, [pendingReferenceRows]);

  // 編集可能セルのスタイル（編集後は黄色＋オレンジ枠で強調）。
  // base は編集可能セルの基本スタイル（背景色・文字寄せ等）。
  // totalExtra は合計行に追加で付与するスタイル（文字寄せ等）。
  // rateLinkedEditable は年契基本分・取組強化マージンの行でも編集できる列（計上年月）で true にする。
  const editableCellStyle =
    (
      base: Record<string, any> = { backgroundColor: GRID_COLORS.editable },
      totalExtra: Record<string, any> = {},
      rateLinkedEditable = false
    ) =>
    (params: any) => {
      if (params.data?.isTotal) {
        return {
          fontWeight: 'bold',
          backgroundColor: GRID_COLORS.total,
          ...totalExtra,
        };
      }
      // 年契基本分・取組強化マージンの行は非活性（灰）
      if (params.data?._rateLinked && !rateLinkedEditable) {
        return { ...base, backgroundColor: GRID_COLORS.readonly };
      }
      return isCellChanged(params) ? { ...base, ...changedCellStyle() } : base;
    };

  // グリッド最上段に固定する行（合計行＋年契基本分・取組強化マージンの行）。
  // 販売計画(詳細)の合計行と同じく AG Grid の pinnedTopRowData で固定し、
  // スクロール・並べ替え・フィルタの対象にしない。
  // 合計は年契基本分・取組強化マージンも含め、集計表の拡売費計画と一致させる。
  // 列フィルタを通過した拡売費行の no（フィルタ無しは null）。合計行を表示中の行だけで計算し直すために使う
  // （画面設計標準 4.4 ③）。公式の onFilterChanged／forEachNodeAfterFilter で取得する。
  // 行の追加・編集・削除で行が変わったときも、フィルタを掛け直した結果で取り直す（onRowDataUpdated）。
  const [filteredRowNos, setFilteredRowNos] = useState<Set<number> | null>(
    null
  );
  const collectFilteredRowNos = useCallback((api: GridApi) => {
    if (!api.isAnyFilterPresent()) {
      setFilteredRowNos(null);
      return;
    }
    const nos = new Set<number>();
    api.forEachNodeAfterFilter((node) => {
      if (node.data) nos.add(node.data.no);
    });
    setFilteredRowNos(nos);
  }, []);
  const handleFilterChanged = useCallback(
    (e: FilterChangedEvent) => collectFilteredRowNos(e.api),
    [collectFilteredRowNos]
  );
  const { onRowDataUpdated: revealOnRowDataUpdated } = reveal;
  const handleRowDataUpdated = useCallback(
    (e: RowDataUpdatedEvent) => {
      revealOnRowDataUpdated(e);
      collectFilteredRowNos(e.api);
    },
    [revealOnRowDataUpdated, collectFilteredRowNos]
  );

  // 列フィルタ中は、フィルタを通過した拡売費行だけで合計する（年契基本分・取組強化マージンの行は固定行のため常に含める）。
  const pinnedTopRows = useMemo(() => {
    const visibleExpenseRows = filteredRowNos
      ? expenseRows.filter(
          (row) => row.no !== undefined && filteredRowNos.has(row.no)
        )
      : expenseRows;
    const allRows = [...rateLinkedRows, ...visibleExpenseRows];
    const sum = (f: keyof NonProductExpenseData) =>
      allRows.reduce((s, item) => s + (Number(item[f]) || 0), 0);
    const total: NonProductExpenseData = {
      isTotal: true,
      metaBrand: '合計',
      summaryProduct: '',
      exp1PlannedAmount: sum('exp1PlannedAmount'),
      exp1PriorYearActual: sum('exp1PriorYearActual'),
      exp1PaymentActual: sum('exp1PaymentActual'),
      exp1PostingMonth: '',
      exp1ManagementClass: '',
      exp1ManagementCode: '',
      exp1AccountItem: '',
      exp1CampaignClass: '',
      exp1CampaignCode: '',
      exp1Description: '',
      exp1Creator: '',
    };
    // 年契基本分・取組強化マージンの行は合計行の直下に置く
    return [total, ...rateLinkedRows];
  }, [expenseRows, rateLinkedRows, filteredRowNos]);

  // 拡売費の列（計画金額～摘要1（社内用）の13列）を生成する。
  // 区分・コードは名称セルで選択し、区分値／名称の導出列は読取専用で追従表示する。
  const makeExpenseColumns = (prefix: 'exp1'): ColDef[] => [
    {
      headerName: '計画金額',
      headerTooltip: '[入力値/自動表示]前年同月実績の計画金額を取得表示',
      field: `${prefix}PlannedAmount`,
      width: 104,
      editable: (params: any) => !isFixedRow(params.data),
      // 計画金額＝整数のみ入力可（小数は入力させず、保持値も四捨五入して整数にする）
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { precision: 0 },
      // cellDataType の自動推論は valueParser を上書きするため false で無効化する
      cellDataType: false,
      // 型の推定を止めているため、数値フィルタを明示する（→ grid/gridCommon 列フィルタの種類）
      ...GRID_NUMBER_FILTER,
      valueFormatter: (params: any) =>
        params.value?.toLocaleString('ja-JP', { maximumFractionDigits: 0 }) ||
        GRID_EMPTY_TEXT,
      valueParser: (params: any) => {
        const value = String(params.newValue).replace(/,/g, '');
        return isNaN(Number(value))
          ? params.oldValue
          : Math.round(Number(value));
      },
      cellStyle: editableCellStyle(
        { backgroundColor: GRID_COLORS.editable, textAlign: 'right' },
        { textAlign: 'right' }
      ),
      onCellValueChanged: handleCellValueChanged,
    },
    {
      headerName: '前年実績',
      headerTooltip: '[自動表示]前年同月実績値を取得表示',
      field: `${prefix}PriorYearActual`,
      width: 104,
      // 金額は整数表示だが、小数を持つ値が来ても3桁以上出さないよう小数点以下2桁で丸める。
      valueFormatter: (params: any) =>
        params.value?.toLocaleString('ja-JP', { maximumFractionDigits: 2 }) ||
        GRID_EMPTY_TEXT,
      // 前年実績は編集不可のため readonly（灰）背景を適用
      // 横寄せは共通クラスで指定する（→ 02 §6 セルの寄せ）
      cellClass: 'cell-right',
      cellStyle: asCellStyle((params: any) =>
        params.data?.isTotal
          ? {
              fontWeight: 'bold',
              backgroundColor: GRID_COLORS.total,
            }
          : { backgroundColor: GRID_COLORS.readonly }
      ),
    },
    {
      // 実績金額：支払側から連携される実績値のため入力不可（前年実績と同じ readonly 表現）。
      headerName: '実績金額',
      headerTooltip: '[自動表示]支払済の実績金額を取得表示',
      field: `${prefix}PaymentActual`,
      width: 104,
      editable: false,
      valueFormatter: (params: any) =>
        params.value?.toLocaleString('ja-JP', { maximumFractionDigits: 2 }) ||
        GRID_EMPTY_TEXT,
      // 横寄せは共通クラスで指定する（→ 02 §6 セルの寄せ）
      cellClass: 'cell-right',
      cellStyle: asCellStyle((params: any) =>
        params.data?.isTotal
          ? {
              fontWeight: 'bold',
              backgroundColor: GRID_COLORS.total,
            }
          : { backgroundColor: GRID_COLORS.readonly }
      ),
    },
    {
      headerName: '計上年月',
      headerTooltip: '[入力値/自動表示]対象年月の翌月を初期表示',
      field: `${prefix}PostingMonth`,
      ...GRID_MONTH_TEXT_FILTER,
      width: 104,
      // 年契基本分・取組強化マージンの行も計上年月だけは変更できる（合計行は不可）
      editable: (params: any) => !params.data?.isTotal,
      cellEditor: MonthYearCellEditor,
      cellEditorPopup: true,
      // 合計行は当グループのスクロール列（計上年月～摘要1（社内用））を結合して空欄表示
      colSpan: (params: any) => (params.data?.isTotal ? 11 : 1),
      valueFormatter: (params: any) =>
        params.data?.isTotal ? '' : formatEmptyAsDash(params),
      cellStyle: editableCellStyle(
        { backgroundColor: GRID_COLORS.editable, textAlign: 'left' },
        { textAlign: 'left' },
        true
      ),
      onCellValueChanged: handlePostingMonthChanged,
    },
    {
      headerName: '管理区分',
      headerTooltip:
        '[入力値/自動表示]管理区分の区分値。管理区分名称と相互連動',
      colId: `${prefix}ManagementClassCode`,
      width: 88,
      editable: (params: any) => !isFixedRow(params.data),
      valueGetter: (params: any) =>
        params.data?.isTotal
          ? ''
          : (params.data?._managementClassCode ??
            managementClassCodeOf(
              params.data?.[`${prefix}ManagementClass`] ?? ''
            )),
      // 区分値で選択された場合も、行は管理区分の名称を保持する。
      valueSetter: (params: any) => {
        params.data[`${prefix}ManagementClass`] = managementClassNameOf(
          params.newValue
        );
        return true;
      },
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: {
        comboOptions: managementClassCodeComboOptions(
          EXPENSE_MANAGEMENT_CLASS_LIST
        ),
        placeholder: '管理区分を選択',
      },
      cellEditorPopup: true,
      cellStyle: editableCellStyle(),
      onCellValueChanged: handleMgmtClassChanged,
    },
    {
      headerName: '管理区分名称',
      headerTooltip: '[入力値/自動表示]管理区分の名称。管理区分と相互連動',
      field: `${prefix}ManagementClass`,
      width: 136,
      editable: (params: any) => !isFixedRow(params.data),
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: {
        comboOptions: managementClassComboOptions(
          EXPENSE_MANAGEMENT_CLASS_LIST
        ),
        placeholder: '管理区分名称を選択',
      },
      cellEditorPopup: true,
      cellStyle: editableCellStyle(),
      onCellValueChanged: handleMgmtClassChanged,
    },
    {
      headerName: '管理コード',
      headerTooltip:
        '[入力値/自動表示]管理コード。選択すると管理区分が自動で入る',
      field: `${prefix}ManagementCode`,
      width: 104,
      editable: (params: any) => !isFixedRow(params.data),
      cellEditor: SingleComboboxCellEditor,
      // 管理区分が選択済みなら該当する管理コードのみに絞り込む
      cellEditorParams: (params: any) => {
        const cls = params.data[`${prefix}ManagementClass`];
        return {
          comboOptions: managementCodeComboOptions(
            EXPENSE_MANAGEMENT_CODE_LIST.filter(
              (c) => !cls || isManagementCodeInClass(c, cls)
            )
          ),
          placeholder: '管理コードを選択',
        };
      },
      cellEditorPopup: true,
      cellStyle: editableCellStyle(),
      onCellValueChanged: handleMgmtCodeChanged,
    },
    {
      headerName: '管理コード名称',
      headerTooltip:
        '[入力値/自動表示]管理コードの名称。選択すると管理コード・管理区分が自動で入る',
      colId: `${prefix}ManagementCodeName`,
      width: 136,
      editable: (params: any) => !isFixedRow(params.data),
      valueGetter: (params: any) =>
        params.data?.isTotal
          ? ''
          : (params.data?._managementCodeName ??
            managementCodeNameOf(
              params.data?.[`${prefix}ManagementCode`] ?? ''
            )),
      // 名称で選択された場合も、行は管理コードを保持する。
      valueSetter: (params: any) => {
        params.data[`${prefix}ManagementCode`] = managementCodeOfName(
          params.newValue
        );
        return true;
      },
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: (params: any) => {
        const cls = params.data[`${prefix}ManagementClass`];
        return {
          comboOptions: managementCodeNameComboOptions(
            EXPENSE_MANAGEMENT_CODE_LIST.filter(
              (c) => !cls || isManagementCodeInClass(c, cls)
            )
          ),
          placeholder: '管理コード名称を選択',
        };
      },
      cellEditorPopup: true,
      cellStyle: editableCellStyle(),
      onCellValueChanged: handleMgmtCodeChanged,
    },
    {
      headerName: '施策区分',
      headerTooltip: '[任意入力]施策区分の区分値。施策区分名称と相互連動',
      colId: `${prefix}CampaignClassCode`,
      width: 88,
      editable: (params: any) => !isFixedRow(params.data),
      valueGetter: (params: any) =>
        params.data?.isTotal
          ? ''
          : campaignClassCodeOf(params.data?.[`${prefix}CampaignClass`] ?? ''),
      valueSetter: (params: any) => {
        params.data[`${prefix}CampaignClass`] = campaignClassNameOf(
          params.newValue
        );
        return true;
      },
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: {
        comboOptions: campaignClassCodeComboOptions(
          CAMPAIGN_CLASS_OPTIONS.map((o) => o.value)
        ),
        placeholder: '施策区分を選択（任意）',
      },
      cellEditorPopup: true,
      cellStyle: editableCellStyle(),
      onCellValueChanged: handleCampaignClassChanged,
    },
    {
      headerName: '施策区分名称',
      headerTooltip: '[任意入力]施策区分の名称。施策区分と相互連動',
      field: `${prefix}CampaignClass`,
      width: 120,
      editable: (params: any) => !isFixedRow(params.data),
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: {
        comboOptions: campaignClassComboOptions(
          CAMPAIGN_CLASS_OPTIONS.map((o) => o.value)
        ),
        placeholder: '施策区分名称を選択（任意）',
      },
      cellEditorPopup: true,
      cellStyle: editableCellStyle(),
      onCellValueChanged: handleCampaignClassChanged,
    },
    {
      headerName: '施策コード',
      headerTooltip: '[任意入力]施策コード。選択すると施策区分が自動で入る',
      field: `${prefix}CampaignCode`,
      width: 104,
      editable: (params: any) => !isFixedRow(params.data),
      cellEditor: SingleComboboxCellEditor,
      // 施策区分が選択済みなら該当する施策コードのみに絞り込む
      cellEditorParams: (params: any) => {
        const cls = params.data[`${prefix}CampaignClass`];
        return {
          comboOptions: campaignCodeComboOptions(
            CAMPAIGN_CODE_OPTIONS.filter(
              (o) => !cls || isCampaignCodeInClass(o.value, cls)
            ).map((o) => o.value)
          ),
          placeholder: '施策コードを選択（任意）',
        };
      },
      cellEditorPopup: true,
      cellStyle: editableCellStyle(),
      onCellValueChanged: handleCampaignCodeChanged,
    },
    {
      headerName: '施策コード名称',
      headerTooltip:
        '[任意入力]施策コードの名称。選択すると施策コード・施策区分が自動で入る',
      colId: `${prefix}CampaignCodeName`,
      width: 152,
      editable: (params: any) => !isFixedRow(params.data),
      valueGetter: (params: any) =>
        params.data?.isTotal
          ? ''
          : campaignCodeNameOf(params.data?.[`${prefix}CampaignCode`] ?? ''),
      valueSetter: (params: any) => {
        params.data[`${prefix}CampaignCode`] = campaignCodeOfName(
          params.newValue
        );
        return true;
      },
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: (params: any) => {
        const cls = params.data[`${prefix}CampaignClass`];
        return {
          comboOptions: campaignCodeNameComboOptions(
            CAMPAIGN_CODE_OPTIONS.filter(
              (o) => !cls || isCampaignCodeInClass(o.value, cls)
            ).map((o) => o.value)
          ),
          placeholder: '施策コード名称を選択（任意）',
        };
      },
      cellEditorPopup: true,
      cellStyle: editableCellStyle(),
      onCellValueChanged: handleCampaignCodeChanged,
    },
    {
      headerName: '摘要1（社内用）',
      headerTooltip: '[入力値/自動表示]前年同月実績の摘要1を取得表示',
      field: `${prefix}Description`,
      // 残り幅いっぱいに伸ばし、右固定アクション列との間に空白を作らない
      flex: 1,
      suppressAutoSize: true, // 残りの幅に広げる列のため自動調整から外す（flex を保つ）
      minWidth: 160,
      editable: (params: any) => !isFixedRow(params.data),
      cellEditor: 'agTextCellEditor',
      cellStyle: editableCellStyle(),
      onCellValueChanged: handleCellValueChanged,
    },
  ];

  const columnDefs: (ColDef | ColGroupDef)[] = useMemo(
    () => [
      {
        headerName: 'メタブランド',
        headerTooltip:
          '[入力値/自動表示]前年同月実績のメタブランドを取得表示。サマリ商品名を選択すると紐づくメタブランドを自動表示（サマリ商品名の選択中は変更不可）',
        field: 'metaBrand',
        width: 120,
        // 先頭列の中央寄せ（チェックボックス用共通CSS）を左寄せに戻すためのクラス
        cellClass: 'ag-cell-left',
        filter: true,
        sortable: true,
        // 合計行は固定列（メタブランド・サマリ商品名）を結合して「合計」表示
        colSpan: (params) => (params.data?.isTotal ? 2 : 1),
        // サマリ商品名の選択中はメタブランドがサマリ商品名から決まるため変更させない
        // （サマリ商品名をクリアすると再び選択できる）
        editable: (params) =>
          !isFixedRow(params.data) && !hasSummaryProduct(params.data),
        cellEditor: SingleComboboxCellEditor,
        cellEditorParams: {
          comboOptions: metaBrandComboOptions(),
          placeholder: 'メタブランドを選択',
        },
        cellEditorPopup: true,
        // コピー由来カラーバー（左端）を編集可否に応じたセルスタイルに重畳
        cellStyle: (params: any) => ({
          ...(!params.data?.isTotal && hasSummaryProduct(params.data)
            ? { backgroundColor: GRID_COLORS.readonly }
            : editableCellStyle()(params) || {}),
          ...copySourceLeftBorder(params.data?._copySource),
        }),
        onCellValueChanged: handleMetaBrandChanged,
      },
      {
        headerName: 'サマリ商品',
        headerTooltip: '[任意入力/自動表示]前年同月実績のサマリ商品を取得表示',
        field: 'summaryProduct',
        width: 120,
        filter: true,
        sortable: true,
        editable: (params) => !isFixedRow(params.data),
        cellEditor: SingleComboboxCellEditor,
        // メタブランド選択時は該当するサマリ商品名のみに絞り込む
        cellEditorParams: (params: any) => ({
          comboOptions: summaryProductComboOptions(
            EXPENSE_PRODUCTS.filter(
              (o) =>
                !params.data.metaBrand || o.metaBrand === params.data.metaBrand
            ).map((o) => o.value)
          ),
          placeholder: 'サマリ商品名を選択',
        }),
        cellEditorPopup: true,
        cellStyle: editableCellStyle(),
        onCellValueChanged: handleSummaryProductChanged,
      },
      // 拡売費（計画金額～摘要1）
      ...makeExpenseColumns('exp1'),
      {
        headerName: '',
        // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
        suppressColumnsToolPanel: true,
        colId: 'actions',
        // 「︙」のメニューだけを出す列（→ UX-087）
        width: 45,
        minWidth: 45,
        maxWidth: 45,
        cellRenderer: CopyDeleteCellRenderer,
        cellRendererParams: COPY_DELETE_PARAMS,
        // 合計行は操作列も含めてブルー背景に揃える
        cellStyle: (params: any) =>
          params.data?.isTotal
            ? { backgroundColor: GRID_COLORS.total }
            : undefined,
        suppressHeaderMenuButton: true,
        sortable: false,
        filter: false,
        pinned: 'right',
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 意図的に依存を限定（列定義/ヘルパーの安定化・再実行抑止のため）
    [
      handleCellValueChanged,
      handleSummaryProductChanged,
      handleMetaBrandChanged,
      handleMgmtCodeChanged,
      handleMgmtClassChanged,
      handleCampaignCodeChanged,
      handleCampaignClassChanged,
      handlePostingMonthChanged,
    ]
  );

  // ヘッダーツールチップを付けた列定義（参照を固定して Undo 履歴を保つ → 02 §7.1）
  const gridColumnDefs = useMemo(
    () => withSpanSafeHeaderHeight(withHeaderTooltips(columnDefs)),
    [columnDefs]
  );

  const defaultColDef: ColDef = useMemo(
    () => ({
      ...GRID_DEFAULT_COL_DEF,
      // 収まらない見出しは折り返し、見出しの高さを中身に合わせる（→ 02 §7・UX-078）
      ...GRID_WRAP_HEADER_COL_DEF,
      resizable: true,
      sortable: true,
      filter: true,
      // 空白セルは「－」を表示（画面設計標準）
      valueFormatter: formatEmptyAsDash,
    }),
    []
  );

  const gridContext = {
    onDelete: handleDelete,
    onCopy: handleCopy,
  };

  return (
    // 拡売費計画のタブの中身（カードの枠・見出しは親の開閉カード〔CollapsibleCard〕が持つため、ここでは枠を付けない → 05「白カード」・UX-065）
    <div className="mb-4">
      {/* 見出しの行（1行。UI/UX UX-106 → 02 §10.4 PlanDetailHeaderMenus）。
          左：販売計画(詳細)｜拡売費計画 › 拡売費計画(コピー元)・凡例。右：率設定・拡売費追加 */}
      <div className="flex flex-wrap items-center gap-2 pb-3">
        {sectionSwitch}
        {sectionSwitch && (
          <ChevronRight className="h-5 w-5 text-gray-400" aria-hidden="true" />
        )}
        {/* 参照用ボタン（押下で対象期間の自計画を下ペインに表示。対象期間は下ペイン内で指定） */}
        <button
          type="button"
          onClick={() => onOpenReference?.()}
          className="btn-toolbar-outline"
        >
          <Copy className="h-4 w-4" />
          拡売費計画(コピー元)
        </button>
        {/* コピー由来カラーバーの凡例（青=コピー元 / 緑=拡売費コピー / 橙=新規） */}
        <CopySourceLegend
          referenceLabel="拡売費計画(コピー元)"
          detailLabel="拡売費コピー"
          className="ml-2"
        />

        <div className="ml-auto flex items-center gap-2">
          {/* 率設定：年契基本分・センターフィ等の右ペインを開く（販売計画(詳細)と同じ並び。課題1780） */}
          {rateLinks && rateLinks.length > 0 && (
            <PlanRateMenu items={rateLinks} />
          )}
          {/* 拡売費追加（右端） */}
          <button
            type="button"
            onClick={handleAdd}
            className="btn-toolbar-outline"
          >
            <Plus className="h-4 w-4" />
            拡売費追加
          </button>
        </div>
      </div>

      {/* AG Grid Table（1920x1080 のPCで画面いっぱいに表示）
          expense-plan-grid: コピー元ペイン展開時にこのグリッド見出しを画面上部へスクロールする目印
          減算値 10.5rem = ヘッダ・フッタ・カード下余白の固定高。最下部までスクロールした
          状態でグリッド本体が画面高にちょうど収まる値（カード見出し・タブ・ツールバーは
          スクロールアウトしてよい方針）。 */}
      <div
        className="expense-plan-grid"
        style={{ height: viewportGridHeight(10.5), minHeight: '25rem' }}
      >
        <style>{`
          .ag-theme-quartz .ag-cell[style*="background-color: rgb(255, 255, 255)"] {
            cursor: pointer;
          }
          .ag-theme-quartz .ag-cell-inline-editing[style*="background-color: rgb(255, 255, 255)"] {
            background-color: var(--grid-editing-bg) !important;
            box-shadow: 0 0 0 2px var(--grid-editing-border) inset;
          }
        `}</style>
        <AgGridReact
          rowData={expenseRows}
          pinnedTopRowData={pinnedTopRows}
          columnDefs={gridColumnDefs}
          defaultColDef={defaultColDef}
          getContextMenuItems={gridFilterContextMenuItems}
          statusBar={GRID_STATUS_BAR}
          context={gridContext}
          getRowId={getExpenseRowId}
          onRowDataUpdated={handleRowDataUpdated}
          onFilterChanged={handleFilterChanged}
          {...GRID_BASE_PROPS}
          {...gridColumnStateProps}
        />
      </div>
    </div>
  );
});
