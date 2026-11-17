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
  GetRowIdParams,
  GridApi,
} from 'ag-grid-community';
import { Plus, Copy } from 'lucide-react';

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
  copySourceLeftBorder,
  CopySourceLegend,
  useGridColumnState,
  withHeaderTooltips,
  withSpanSafeHeaderHeight,
  useRevealNewRows,
  useChangedCells,
  useLinkedCellUndo,
  GRID_MONTH_TEXT_FILTER,
  GRID_NUMBER_FILTER,
  CopyDeleteCellRenderer,
  asCellStyle,
} from '@/components/grid';
import { CARD_TITLE_CLASS, CARD_CLASS } from '@/styles/commonStyles';
import { MonthYearCellEditor } from '@/components/ui/month-year-cell-editor';
import type { SingleComboboxOption } from '@/components/ui/single-combobox';
import { NON_PRODUCT_EXPENSE_ROWS } from '@/mocks/common/nonProductExpense';
import { EXPENSE_SUMMARY_PRODUCT_OPTIONS } from '@/constants/productMasters';
import { SingleComboboxCellEditor } from '@/components/ui/single-combobox-cell-editor';
import {
  isManagementCodeInClass,
  isCampaignCodeInClass,
  fillFromManagementCode,
  fillFromManagementClass,
  fillFromCampaignCode,
  fillFromCampaignClass,
} from '@/utils/common/expenseRelations';
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
} from '@/constants/comboFieldOptions';
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
} from '@/utils/common/comboFieldOptions';

// 拡売費データ／グリッド操作ハンドルは共有型（types/nonProductExpense）へ集約。
// 既存の import 元互換のため、ここから再エクスポートする。
import type {
  NonProductExpenseData,
  NonProductExpenseGridHandle,
} from '@/types/nonProductExpense';
import { insertRowsAfter } from '@/utils/common/addedRowOrder';
import {
  hasPriorYearActual,
  hasSummaryProduct,
  isMetaBrandEditable,
  clearExpenseSavedMarks,
} from '@/utils/sales-plan/plan-detail/nonProductExpenseRow';

export type { NonProductExpenseData, NonProductExpenseGridHandle };

// 拡売費サマリ商品マスタ（「ー（指定なし）」を除く）と
// サマリ商品名 → メタブランド の対応（行内の自動連動に使用）
const EXPENSE_PRODUCTS = EXPENSE_SUMMARY_PRODUCT_OPTIONS.filter(
  (o) => o.value !== '-'
);
const BRAND_BY_PRODUCT = new Map<string, string>(
  EXPENSE_PRODUCTS.map((o) => [o.value, o.metaBrand])
);

// 行ID（合計行は固定ID、明細行は no）。参照を固定して Undo 履歴を保つ（→ 02 §7.1）
const getExpenseRowId = (params: GetRowIdParams<NonProductExpenseData>) =>
  params.data.isTotal ? 'total' : String(params.data.no);

interface NonProductExpensePaneProps {
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

// コピー・削除の列（共通セル部品 CopyDeleteCellRenderer）。合計行はボタンを出さない。
// 前年実績がある行は実績と紐づくため削除させない。
const COPY_DELETE_PARAMS = {
  isHidden: (row: unknown) => !!(row as { isTotal?: boolean })?.isTotal,
  deleteDisabledReason: (row: unknown) =>
    hasPriorYearActual(
      (row as { exp1PriorYearActual?: string })?.exp1PriorYearActual
    )
      ? '前年実績がある行は削除できません'
      : null,
};

export const NonProductExpensePane = forwardRef<
  NonProductExpenseGridHandle,
  NonProductExpensePaneProps
>(function NonProductExpensePane(
  {
    onOpenAddExpense,
    onDeleteExpense,
    onOpenCopyExpense,
    pendingCopyRow,
    onCopyComplete,
    onOpenReference,
    pendingReferenceRows,
    onReferenceConsumed,
  }: NonProductExpensePaneProps,
  ref
) {
  // 編集セルの変更ハイライト（黄色＋オレンジ枠）の追跡・判定（共通フック → 02 §7.2）
  const { isCellChanged, trackCellChange, resetChangedCells } =
    useChangedCells();
  // 主セルの編集に連動する従属セルの更新は共通フックに委譲する（→ 02 §7.3）。
  // 従属セルは node.data 直接更新のため Undo スタックに積まれず、Ctrl+Z 1回で主セルごと戻る。
  const { makeHandler, clearCache } =
    useLinkedCellUndo<NonProductExpenseData>();
  // 保存時に編集セルの強調を消す（値は変わらないため再描画を明示する）ためのAPI
  const gridApiRef = useRef<GridApi | null>(null);

  // サンプルデータ (10件)
  const [expenseRows, setExpenseRows] = useState<NonProductExpenseData[]>(
    NON_PRODUCT_EXPENSE_ROWS
  );
  // コピー／参照取り込み行に一意な no を採番するためのカウンタ
  const nextNoRef = useRef(1000);
  // セル編集を通らない値更新（親ペインからの行更新）で rowData を明示再構築するためのトークン（→ 02 §7.1）
  const [gridRebuildToken, setGridRebuildToken] = useState(0);

  // 親（追加/コピー/編集/削除ペイン）からの行操作を公開
  useImperativeHandle(ref, () => ({
    addRow: (row: NonProductExpenseData, afterNo?: number) => {
      // 拡売費追加=new。行コピーから呼ぶ場合は row._copySource='detail' を渡して上書きできる
      const copySource = row._copySource ?? 'new';
      const added = {
        ...row,
        no: nextNoRef.current++,
        isTotal: false,
        _copySource: copySource,
      };
      // 追加した行へ移って強調する（行反映後にフックが拾う）
      reveal.markRows([added]);
      // 新規は最下行、行コピーはコピー元の行のすぐ下に入れる（→ 02 §8「行の追加位置」・UX-112）
      setExpenseRows((prev) =>
        insertRowsAfter(
          prev,
          [added],
          afterNo == null ? undefined : (r) => r.no === afterNo
        )
      );
    },
    // セル編集を経由しない値更新のため、rowData を再構築してグリッドへ反映する
    updateRow: (row: NonProductExpenseData) => {
      setExpenseRows((prev) =>
        prev.map((r) => (r.no === row.no ? { ...r, ...row } : r))
      );
      setGridRebuildToken((t) => t + 1);
      // 再構築に合わせて連動セルのキャッシュも破棄する（→ 02 §7.3）
      clearCache();
    },
    deleteRow: (no: number) =>
      setExpenseRows((prev) => prev.filter((r) => r.no !== no)),
    // 計画保存時：左端の帯（コピー・追加由来）と編集セルの強調を消す。
    // 保存した値を新たな元値とするため、元値の記録も resetChangedCells でリセットする。
    clearSavedMarks: () => {
      setExpenseRows((prev) =>
        clearExpenseSavedMarks(prev, { clear: resetChangedCells })
      );
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

  // セル値更新ハンドラ
  const handleCellValueChanged = useCallback(
    (params: any) => {
      // 編集済みセルを記録（元値に戻したら解除）し、当該セルを再描画して
      // 黄色＋オレンジ枠（changedCellStyle）を反映する
      trackCellChange(params);
      params.api.refreshCells({
        rowNodes: [params.node],
        columns: [params.column.getColId()],
        force: true,
      });

      const updatedData = params.data;
      setExpenseRows((prev) =>
        prev.map((row) => (row.no === updatedData.no ? updatedData : row))
      );
    },
    [trackCellChange]
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
  // 補完パッチで省略された項目は現在値を維持する（fillFrom* の仕様）。
  // 管理コード（コード列・名称列のいずれか）確定時：管理区分・勘定科目を自動セットする。
  const handleMgmtCodeChanged = useMemo(
    () =>
      withChangeTracking(
        makeHandler('exp1ManagementCode', {
          depFields: ['exp1ManagementClass', 'exp1AccountItem'],
          deriveDeps: (_value, row) => {
            const patch = fillFromManagementCode(row.exp1ManagementCode);
            return {
              exp1ManagementClass:
                patch.ManagementClass ?? row.exp1ManagementClass,
              exp1AccountItem: patch.AccountItem ?? row.exp1AccountItem,
            };
          },
        })
      ),
    [withChangeTracking, makeHandler]
  );

  // 管理区分（区分値列・名称列のいずれか）確定時：勘定科目を補完し、該当しない管理コードはクリア
  const handleMgmtClassChanged = useMemo(
    () =>
      withChangeTracking(
        makeHandler('exp1ManagementClass', {
          depFields: ['exp1ManagementCode', 'exp1AccountItem'],
          deriveDeps: (_value, row) => {
            const patch = fillFromManagementClass(
              row.exp1ManagementClass,
              row.exp1ManagementCode
            );
            return {
              exp1ManagementCode:
                patch.ManagementCode ?? row.exp1ManagementCode,
              exp1AccountItem: patch.AccountItem ?? row.exp1AccountItem,
            };
          },
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
              fillFromCampaignCode(row.exp1CampaignCode).CampaignClass ??
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
              fillFromCampaignClass(row.exp1CampaignClass, row.exp1CampaignCode)
                .CampaignCode ?? row.exp1CampaignCode,
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
      // コピー元の行（同じ no）のすぐ下に入れる（→ 02 §8「行の追加位置」・UX-112）
      setExpenseRows((prev) =>
        insertRowsAfter(prev, [added], (r) => r.no === pendingCopyRow.no)
      );
      onCopyComplete?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 意図的に依存を限定（列定義/ヘルパーの安定化・再実行抑止のため）
  }, [pendingCopyRow]);

  // 参照ペイン（下ペイン）のコピーボタンで取り込んだ行を最下行へ入れる（→ 02 §8・UX-112）。
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
      // 下ペインからのコピーは最下行に入れる（→ 02 §8「行の追加位置」・UX-112）
      setExpenseRows((prev) => [...prev, ...added]);
      onReferenceConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 意図的に依存を限定（列定義/ヘルパーの安定化・再実行抑止のため）
  }, [pendingReferenceRows]);

  // 編集可能セルのスタイル（編集後は黄色＋オレンジ枠で強調）。
  // base は編集可能セルの基本スタイル（背景色・文字寄せ等）。
  // totalExtra は合計行に追加で付与するスタイル（文字寄せ等）。
  const editableCellStyle =
    (
      base: Record<string, any> = { backgroundColor: GRID_COLORS.editable },
      totalExtra: Record<string, any> = {}
    ) =>
    (params: any) => {
      if (params.data?.isTotal) {
        return {
          fontWeight: 'bold',
          backgroundColor: GRID_COLORS.total,
          ...totalExtra,
        };
      }
      return isCellChanged(params) ? { ...base, ...changedCellStyle() } : base;
    };

  // 導出列（区分値・名称）用の読取専用セルスタイル。
  const derivedCellStyle = (params: any): Record<string, string> =>
    params.data?.isTotal
      ? { fontWeight: 'bold', backgroundColor: GRID_COLORS.total }
      : { backgroundColor: GRID_COLORS.readonly };

  // 合計行を計算（拡売費の計画金額・前年実績を集計）
  const totalRow = useMemo(() => {
    const sum = (f: keyof NonProductExpenseData) =>
      expenseRows.reduce((s, item) => s + (Number(item[f]) || 0), 0);
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
    return total;
  }, [expenseRows]);

  // 行の構造シグネチャ（行ID＋並び順＋左端の帯）。セル値の編集では変わらない（→ 02 §7.1）
  const rowStructureSignature = useMemo(
    () => expenseRows.map((r) => `${r.no}#${r._copySource ?? ''}`).join('|'),
    [expenseRows]
  );

  // グリッドに渡す行データ（先頭に合計行）。rowData の参照差し替えは AG Grid の Undo 履歴を
  // クリアするため、行の追加・削除・並び替え・帯の変更・親ペインからの行更新でのみ作り直す。
  // セル編集では AG Grid が node.data を直接更新済みのため、参照を維持して Undo を効かせる。
  const dataWithTotal = useMemo(
    () => [totalRow, ...expenseRows],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 構造変化時のみ再構築（→ 02 §7.1）
    [rowStructureSignature, gridRebuildToken]
  );

  // セル編集（Undo/Redo を含む）で合計が変わったら、合計行の node.data を直接更新して再描画する。
  // rowData を差し替えないため Undo 履歴は保たれる。
  useEffect(() => {
    const api = gridApiRef.current;
    const node = api?.getRowNode('total');
    if (!api || !node?.data || node.data === totalRow) return;
    Object.assign(node.data, totalRow);
    api.refreshCells({ rowNodes: [node], force: true });
  }, [totalRow]);

  // 拡売費の列（計画金額～摘要1の9列）を生成。2段ヘッダーは使わずフラットに表示する。
  const makeExpenseColumns = (prefix: 'exp1'): ColDef[] => [
    {
      headerName: '計画金額',
      headerTooltip: '[入力値/自動表示]前年同月実績の計画金額を取得表示',
      field: `${prefix}PlannedAmount`,
      width: 104,
      editable: (params: any) => !params.data.isTotal,
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
      cellClass: 'cell-right',
      cellStyle: editableCellStyle(),
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
      editable: (params: any) => !params.data.isTotal,
      cellEditor: MonthYearCellEditor,
      cellEditorPopup: true,
      // 合計行は当グループのスクロール列（計上年月～作成者）を結合して空欄表示
      colSpan: (params: any) => (params.data?.isTotal ? 12 : 1),
      valueFormatter: (params: any) =>
        params.data?.isTotal ? '' : formatEmptyAsDash(params),
      // 計上年月はカレンダー（年月）入力のため左寄せ
      cellClass: 'cell-left',
      cellStyle: editableCellStyle(),
      onCellValueChanged: handleCellValueChanged,
    },
    {
      headerName: '管理区分',
      headerTooltip:
        '[入力値/自動表示]管理区分の区分値。管理区分名称と相互連動',
      colId: `${prefix}ManagementClassCode`,
      width: 88,
      editable: (params: any) => !params.data.isTotal,
      valueGetter: (params: any) =>
        params.data?.isTotal
          ? ''
          : managementClassCodeOf(
              params.data?.[`${prefix}ManagementClass`] ?? ''
            ),
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
      editable: (params: any) => !params.data.isTotal,
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
      editable: (params: any) => !params.data.isTotal,
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
      editable: (params: any) => !params.data.isTotal,
      valueGetter: (params: any) =>
        params.data?.isTotal
          ? ''
          : managementCodeNameOf(
              params.data?.[`${prefix}ManagementCode`] ?? ''
            ),
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
      editable: (params: any) => !params.data.isTotal,
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
      editable: (params: any) => !params.data.isTotal,
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
      editable: (params: any) => !params.data.isTotal,
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
      editable: (params: any) => !params.data.isTotal,
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
      editable: (params: any) => !params.data.isTotal,
      cellEditor: 'agTextCellEditor',
      cellStyle: editableCellStyle(),
      onCellValueChanged: handleCellValueChanged,
    },
    {
      headerName: '作成者',
      headerTooltip: '[自動表示]行を追加したユーザー名',
      field: `${prefix}Creator`,
      width: 112,
      cellStyle: derivedCellStyle,
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
        // 合計行は先頭の列（メタブランド・サマリ商品名）を結合して「合計」表示
        colSpan: (params) => (params.data?.isTotal ? 2 : 1),
        // サマリ商品名の選択中はメタブランドがサマリ商品名から決まるため変更させない
        // （サマリ商品名をクリアすると再び選択できる）
        editable: (params) => isMetaBrandEditable(params.data),
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
        editable: (params) => !params.data.isTotal,
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
      // 拡売費（フラット表示：計画金額～摘要1）
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
      // 空白セルは「-」を表示（画面設計標準）
      valueFormatter: formatEmptyAsDash,
    }),
    []
  );

  const gridContext = {
    onDelete: handleDelete,
    onCopy: handleCopy,
  };
  // コピーで増えた行を見つけやすくする（行全体をフラッシュし可視域へ送る）。
  // 行追加は state 更新のため、追加直後はまだグリッドに行が無い。コピー処理で
  // markRows へ行を記録し、onRowDataUpdated（＝行が反映された後）で強調する。
  const reveal = useRevealNewRows({ focusColumn: 'metaBrand' });

  // 列状態（幅・並び順・ソート・固定）を localStorage に永続化
  const gridColumnStateProps = useGridColumnState(
    '拡売費計画NoLink.拡売費.columnState.v2',
    {
      // 新規行の強調表示にグリッドAPIが要るため、ここで受け取る
      // （JSX の onGridReady は本フックの戻り値に上書きされるので使わない）
      onGridReady: (event: { api: GridApi }) => {
        reveal.captureApi(event.api);
        gridApiRef.current = event.api;
      },
    }
  );

  return (
    <div className={`${CARD_CLASS} overflow-hidden mb-4`}>
      <div className="flex items-center justify-between px-3 pt-2 pb-4 card-header-accent">
        {/* タイトルの右隣に「拡売費計画(コピー元)」を配置（右端ではない） */}
        <div className="flex items-center gap-2">
          {/* タイトル：commonStyles の CARD_TITLE_CLASS（text-base 太字）。
              コピー元ボタンとは販売計画(詳細)と同等の間隔（pr-12≒3rem）を空ける */}
          <h2 className={`${CARD_TITLE_CLASS} pr-12`}>拡売費計画</h2>

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
        </div>

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

      {/* AG Grid Table（1920x1080 のPCで画面いっぱいに表示）
          expense-plan-grid: コピー元ペイン展開時にこのグリッド見出しを画面上部へスクロールする目印
          減算値 10rem = ヘッダ・フッタ・カード下余白の固定高。最下部までスクロールした
          状態でグリッド本体が画面高にちょうど収まる値（カード見出し・ボタン行は
          スクロールアウトしてよい方針）。 */}
      <div
        className="expense-plan-grid"
        style={{ height: viewportGridHeight(10), minHeight: '25rem' }}
      >
        <AgGridReact
          rowData={dataWithTotal}
          columnDefs={gridColumnDefs}
          defaultColDef={defaultColDef}
          getContextMenuItems={gridFilterContextMenuItems}
          statusBar={GRID_STATUS_BAR}
          context={gridContext}
          getRowId={getExpenseRowId}
          onRowDataUpdated={reveal.onRowDataUpdated}
          ensureDomOrder={true}
          // セル外クリックで編集を終了し、コンボボックス（セルエディタ）を確実に閉じる。
          // 選択肢の mousedown 抑止（single-combobox）で早期確定は防止済み。
          stopEditingWhenCellsLoseFocus={true}
          {...GRID_BASE_PROPS}
          {...gridColumnStateProps}
        />
      </div>
    </div>
  );
});
