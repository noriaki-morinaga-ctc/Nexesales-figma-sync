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
  GRID_COLORS,
  GRID_DEFAULT_COL_DEF,
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
  useRevealNewRows,
  GRID_MONTH_TEXT_FILTER,
  GRID_NUMBER_FILTER,
} from '../../../grid';
import { CARD_TITLE_CLASS } from '../../../../../styles/commonStyles';
import {
  ColDef,
  ColGroupDef,
  GridApi,
  ICellRendererParams,
} from 'ag-grid-community';
import { Button } from '../../../ui/button';
import { Trash2, Plus, Copy, FileSearch } from 'lucide-react';
import { MonthYearCellEditor } from '../../../ui/month-year-cell-editor';
import type { SingleComboboxOption } from '../../../ui/single-combobox';
import { NON_PRODUCT_EXPENSE_ROWS } from '../../../../constants/nonProductExpenseMockData';
import { EXPENSE_SUMMARY_PRODUCT_OPTIONS } from '../../../../constants/productMasters';
import { SingleComboboxCellEditor } from '../../../ui/single-combobox-cell-editor';
import {
  isManagementCodeInClass,
  isCampaignCodeInClass,
  fillFromManagementCode,
  fillFromManagementClass,
  fillFromCampaignCode,
  fillFromCampaignClass,
  type ExpenseCodePatch,
} from '../../../../constants/expenseRelations';
import {
  managementClassComboOptions,
  managementCodeComboOptions,
  campaignClassComboOptions,
  campaignCodeComboOptions,
  metaBrandComboOptions,
  summaryProductComboOptions,
  managementClassCodeOf,
  managementCodeNameOf,
  campaignClassCodeOf,
  campaignCodeNameOf,
  managementClassNameOf,
  managementCodeOfName,
  campaignClassNameOf,
  campaignCodeOfName,
  managementClassCodeComboOptions,
  managementCodeNameComboOptions,
  campaignClassCodeComboOptions,
  campaignCodeNameComboOptions,
} from '../../../../constants/comboFieldOptions';

// 拡売費データ／グリッド操作ハンドルは共有型（constants/nonProductExpenseTypes）へ集約。
// 既存の import 元互換のため、ここから再エクスポートする。
import type {
  NonProductExpenseData,
  NonProductExpenseGridHandle,
} from '../../../../constants/nonProductExpenseTypes';
import {
  hasPriorYearActual,
  hasSummaryProduct,
  isMetaBrandEditable,
  clearExpenseSavedMarks,
} from '../../../../constants/nonProductExpenseTypes';

export type { NonProductExpenseData, NonProductExpenseGridHandle };

// 拡売費サマリ商品マスタ（「ー（指定なし）」を除く）と
// サマリ商品名 → メタブランド の対応（行内の自動連動に使用）
const EXPENSE_PRODUCTS = EXPENSE_SUMMARY_PRODUCT_OPTIONS.filter(
  (o) => o.value !== '-'
);
const BRAND_BY_PRODUCT = new Map<string, string>(
  EXPENSE_PRODUCTS.map((o) => [o.value, o.metaBrand])
);

interface NonProductExpensePaneProps {
  onOpenAddExpense?: () => void;
  onOpenDeleteExpense?: (data: NonProductExpenseData) => void;
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

const ActionCellRenderer = (props: ICellRendererParams) => {
  if (props.data.isTotal) {
    return null;
  }

  const { onDelete, onCopy } = props.context;
  // 前年実績がある行は実績と紐づくため削除させない。
  const priorYearExists = hasPriorYearActual(props.data.exp1PriorYearActual);

  return (
    <div className="flex items-center justify-center gap-2 h-full">
      <button
        className="text-green-600 hover:text-green-800 p-1"
        onClick={() => onCopy(props.data)}
        title="コピー"
        aria-label="コピー"
      >
        <Copy className="w-4 h-4" />
      </button>
      <button
        onClick={priorYearExists ? undefined : () => onDelete(props.data)}
        disabled={priorYearExists}
        className={`p-1 rounded transition-colors ${
          priorYearExists
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-red-600 hover:text-red-800 hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:outline-none'
        }`}
        title={priorYearExists ? '前年実績がある行は削除できません' : '削除'}
        aria-label="削除"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

export const NonProductExpensePane = forwardRef<
  NonProductExpenseGridHandle,
  NonProductExpensePaneProps
>(function NonProductExpensePane(
  {
    onOpenAddExpense,
    onOpenDeleteExpense,
    onOpenCopyExpense,
    pendingCopyRow,
    onCopyComplete,
    onOpenReference,
    pendingReferenceRows,
    onReferenceConsumed,
  }: NonProductExpensePaneProps,
  ref
) {
  // 編集されたセル（行ID::列ID）の集合。編集後に黄色＋オレンジ枠で強調する。
  const changedCellsRef = useRef<Set<string>>(new Set());
  // 各セルの元値（初回編集時に記録）。元値に戻したら強調を解除するため。
  const originalCellValuesRef = useRef<Map<string, string>>(new Map());
  // 保存時に編集セルの強調を消す（値は変わらないため再描画を明示する）ためのAPI
  const gridApiRef = useRef<GridApi | null>(null);
  const cellChangeKey = (params: any) =>
    `${params.node?.id}::${params.column?.getColId?.() ?? params.colDef?.field}`;
  // セルが編集済み（元値と異なる）か
  const isCellChanged = (params: any) => {
    if (params.data?.isTotal || params.node?.rowPinned) return false;
    return changedCellsRef.current.has(cellChangeKey(params));
  };

  // サンプルデータ (10件)
  const [expenseRows, setExpenseRows] = useState<NonProductExpenseData[]>(
    NON_PRODUCT_EXPENSE_ROWS
  );
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
    updateRow: (row: NonProductExpenseData) =>
      setExpenseRows((prev) =>
        prev.map((r) => (r.no === row.no ? { ...r, ...row } : r))
      ),
    deleteRow: (no: number) =>
      setExpenseRows((prev) => prev.filter((r) => r.no !== no)),
    // 計画保存時：左端の帯（コピー・追加由来）と編集セルの強調を消す。
    // 保存した値を新たな元値とするため、元値の記録もリセットする。
    clearSavedMarks: () => {
      setExpenseRows((prev) =>
        clearExpenseSavedMarks(prev, changedCellsRef.current)
      );
      originalCellValuesRef.current.clear();
      setTimeout(() => gridApiRef.current?.refreshCells({ force: true }), 0);
    },
  }));

  const handleDelete = (data: NonProductExpenseData) => {
    if (onOpenDeleteExpense) {
      onOpenDeleteExpense(data);
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
  const handleCellValueChanged = useCallback((params: any) => {
    // 編集済みセルを記録（元値に戻したら解除）し、当該セルを再描画して
    // 黄色＋オレンジ枠（changedCellStyle）を反映する
    const key = cellChangeKey(params);
    if (!originalCellValuesRef.current.has(key)) {
      originalCellValuesRef.current.set(key, String(params.oldValue ?? ''));
    }
    const orig = originalCellValuesRef.current.get(key) ?? '';
    if (String(params.newValue ?? '') === orig) {
      changedCellsRef.current.delete(key);
    } else {
      changedCellsRef.current.add(key);
    }
    params.api.refreshCells({
      rowNodes: [params.node],
      columns: [params.column.getColId()],
      force: true,
    });

    const updatedData = params.data;
    setExpenseRows((prev) =>
      prev.map((row) => (row.no === updatedData.no ? updatedData : row))
    );
  }, []);

  // サマリ商品名変更時：該当するメタブランドを自動セットする。
  // setDataValue でメタブランド列の変更イベント（handleMetaBrandChanged）を発火させ、
  // 自動で変わったメタブランドセルにも変更ハイライト（黄色背景＋オレンジ枠）を付ける。
  const handleSummaryProductChanged = useCallback(
    (params: any) => {
      const brand = BRAND_BY_PRODUCT.get(params.newValue);
      if (brand && params.data.metaBrand !== brand) {
        params.node.setDataValue('metaBrand', brand);
      }
      handleCellValueChanged(params);
    },
    [handleCellValueChanged]
  );

  // メタブランド変更時：新ブランドに該当しないサマリ商品名はクリアする。
  // setDataValue でサマリ商品名列の変更イベントを発火させ、クリアされたセルにも
  // 変更ハイライトを付ける。
  const handleMetaBrandChanged = useCallback(
    (params: any) => {
      const current = params.data.summaryProduct;
      if (current && BRAND_BY_PRODUCT.get(current) !== params.newValue) {
        params.node.setDataValue('summaryProduct', '');
      }
      handleCellValueChanged(params);
    },
    [handleCellValueChanged]
  );

  // 拡売費列の接頭辞（exp1 のみ）
  const prefixOf = (_params: any) => 'exp1';

  // 区分／コードの相互連動で書き換えた同一行の他セルを再描画する。
  const refreshRow = (params: any) =>
    params.api?.refreshCells({ rowNodes: [params.node], force: true });

  // 補完パッチ（接頭辞なしキー）を行データへ接頭辞付きで適用する。
  const applyPatch = (params: any, patch: ExpenseCodePatch) => {
    const prefix = prefixOf(params);
    Object.entries(patch).forEach(([key, value]) => {
      params.data[`${prefix}${key}`] = value;
    });
  };

  // 管理コード（コード列・名称列のいずれか）確定時：
  // 行の管理コードから管理区分を自動セットする（管理区分・管理区分名称の両列に反映）。
  const handleMgmtCodeChanged = useCallback(
    (params: any) => {
      const prefix = prefixOf(params);
      applyPatch(
        params,
        fillFromManagementCode(params.data[`${prefix}ManagementCode`])
      );
      refreshRow(params);
      handleCellValueChanged(params);
    },
    [handleCellValueChanged]
  );

  // 管理区分（区分値列・名称列のいずれか）確定時：該当しない管理コードはクリア
  const handleMgmtClassChanged = useCallback(
    (params: any) => {
      const prefix = prefixOf(params);
      applyPatch(
        params,
        fillFromManagementClass(
          params.data[`${prefix}ManagementClass`],
          params.data[`${prefix}ManagementCode`]
        )
      );
      refreshRow(params);
      handleCellValueChanged(params);
    },
    [handleCellValueChanged]
  );

  // 施策コード（コード列・名称列のいずれか）確定時：施策区分を自動セット
  const handleCampaignCodeChanged = useCallback(
    (params: any) => {
      const prefix = prefixOf(params);
      applyPatch(
        params,
        fillFromCampaignCode(params.data[`${prefix}CampaignCode`])
      );
      refreshRow(params);
      handleCellValueChanged(params);
    },
    [handleCellValueChanged]
  );

  // 施策区分（区分値列・名称列のいずれか）確定時：該当しない施策コードはクリア
  const handleCampaignClassChanged = useCallback(
    (params: any) => {
      const prefix = prefixOf(params);
      applyPatch(
        params,
        fillFromCampaignClass(
          params.data[`${prefix}CampaignClass`],
          params.data[`${prefix}CampaignCode`]
        )
      );
      refreshRow(params);
      handleCellValueChanged(params);
    },
    [handleCellValueChanged]
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
      setExpenseRows((prev) => [...prev, added]);
      onCopyComplete?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 意図的に依存を限定（列定義/ヘルパーの安定化・再実行抑止のため）
  }, [pendingCopyRow]);

  // 参照ペインのコピーボタンで取り込んだ行を合計行の直下（先頭）へ挿入。
  // dataWithTotal は [合計, ...expenseRows] のため、先頭に積めば合計行の直下に並ぶ。
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
  const dataWithTotal = useMemo(() => {
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
    return [total, ...expenseRows];
  }, [expenseRows]);

  // 拡売費の列（計画金額～摘要1の9列）を生成。2段ヘッダーは使わずフラットに表示する。
  const makeExpenseColumns = (prefix: 'exp1'): ColDef[] => [
    {
      headerName: '計画金額',
      headerTooltip: '[入力値/自動表示]前年同月実績の計画金額を取得表示',
      field: `${prefix}PlannedAmount`,
      width: 130,
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
      width: 130,
      // 金額は整数表示だが、小数を持つ値が来ても3桁以上出さないよう小数点以下2桁で丸める。
      valueFormatter: (params: any) =>
        params.value?.toLocaleString('ja-JP', { maximumFractionDigits: 2 }) ||
        GRID_EMPTY_TEXT,
      // 前年実績は編集不可のため readonly（灰）背景を適用
      cellClass: 'cell-right',
      cellStyle: (params: any) =>
        params.data?.isTotal
          ? {
              fontWeight: 'bold',
              backgroundColor: GRID_COLORS.total,
            }
          : { backgroundColor: GRID_COLORS.readonly },
    },
    {
      // 実績金額：支払側から連携される実績値のため入力不可（前年実績と同じ readonly 表現）。
      headerName: '実績金額',
      headerTooltip: '[自動表示]支払済の実績金額を取得表示',
      field: `${prefix}PaymentActual`,
      width: 130,
      editable: false,
      valueFormatter: (params: any) =>
        params.value?.toLocaleString('ja-JP', { maximumFractionDigits: 2 }) ||
        GRID_EMPTY_TEXT,
      cellClass: 'cell-right',
      cellStyle: (params: any) =>
        params.data?.isTotal
          ? {
              fontWeight: 'bold',
              backgroundColor: GRID_COLORS.total,
            }
          : { backgroundColor: GRID_COLORS.readonly },
    },
    {
      headerName: '計上年月',
      headerTooltip: '[入力値/自動表示]対象年月の翌月を初期表示',
      field: `${prefix}PostingMonth`,
      ...GRID_MONTH_TEXT_FILTER,
      width: 130,
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
      width: 110,
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
      width: 170,
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
      width: 130,
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
      width: 170,
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
      width: 110,
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
      width: 150,
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
      width: 130,
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
      width: 190,
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
      headerName: '摘要1(社内用)',
      headerTooltip: '[入力値/自動表示]前年同月実績の摘要1を取得表示',
      field: `${prefix}Description`,
      // 残り幅いっぱいに伸ばし、右固定アクション列との間に空白を作らない
      flex: 1,
      minWidth: 200,
      editable: (params: any) => !params.data.isTotal,
      cellEditor: 'agTextCellEditor',
      cellStyle: editableCellStyle(),
      onCellValueChanged: handleCellValueChanged,
    },
    {
      headerName: '作成者',
      headerTooltip: '[自動表示]行を追加したユーザー名',
      field: `${prefix}Creator`,
      width: 140,
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
        width: 150,
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
        width: 150,
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
        field: 'actions',
        width: 100,
        cellRenderer: ActionCellRenderer,
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

  const defaultColDef: ColDef = useMemo(
    () => ({
      ...GRID_DEFAULT_COL_DEF,
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

  // 列状態（幅・並び順・ソート・固定）を localStorage に永続化（明示幅のため autoSize 無効）
  const gridColumnStateProps = useGridColumnState(
    '拡売費計画NoLink.拡売費.columnState.v2',
    {
      autoSize: false,
      // 新規行の強調表示にグリッドAPIが要るため、ここで受け取る
      // （JSX の onGridReady は本フックの戻り値に上書きされるので使わない）
      onGridReady: (event: { api: GridApi }) => {
        reveal.captureApi(event.api);
        gridApiRef.current = event.api;
      },
    }
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
      <div className="flex items-center justify-between px-3 pt-2 pb-4 card-header-accent">
        {/* タイトルの右隣に「拡売費計画(コピー元)」を配置（右端ではない） */}
        <div className="flex items-center gap-2">
          {/* タイトル：commonStyles の CARD_TITLE_CLASS（text-base 太字）。
              コピー元ボタンとは販売計画(詳細)と同等の間隔（pr-12≒3rem）を空ける */}
          <h2 className={`${CARD_TITLE_CLASS} pr-12`}>拡売費計画</h2>

          {/* 参照用ボタン（押下で対象期間の自計画を下ペインに表示。対象期間は下ペイン内で指定） */}
          <Button
            size="sm"
            onClick={() => onOpenReference?.()}
            className="bg-white text-blue-600 px-3 py-1 rounded-lg border-2 border-blue-600 hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors whitespace-nowrap text-sm"
          >
            <FileSearch className="h-4 w-4 mr-1" />
            拡売費計画(コピー元)
          </Button>

          {/* コピー由来カラーバーの凡例（青=コピー元 / 緑=拡売費コピー / 橙=新規） */}
          <CopySourceLegend
            referenceLabel="拡売費計画(コピー元)"
            detailLabel="拡売費コピー"
            className="ml-2"
          />
        </div>

        {/* 拡売費追加（右端） */}
        <Button
          size="sm"
          onClick={handleAdd}
          className="bg-white text-blue-600 px-3 py-1 rounded-lg border-2 border-blue-600 hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors whitespace-nowrap text-sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          拡売費追加
        </Button>
      </div>

      {/* AG Grid Table（1920x1080 のPCで画面いっぱいに表示）
          expense-plan-grid: コピー元ペイン展開時にこのグリッド見出しを画面上部へスクロールする目印
          減算値 10rem = ヘッダ・フッタ・カード下余白の固定高。最下部までスクロールした
          状態でグリッド本体が画面高にちょうど収まる値（カード見出し・ボタン行は
          スクロールアウトしてよい方針）。 */}
      <div
        className="expense-plan-grid"
        style={{ height: 'calc(100vh - 10rem)', minHeight: '25rem' }}
      >
        <AgGridReact
          rowData={dataWithTotal}
          columnDefs={withHeaderTooltips(columnDefs)}
          defaultColDef={defaultColDef}
          getContextMenuItems={gridFilterContextMenuItems}
          statusBar={GRID_STATUS_BAR}
          context={gridContext}
          getRowId={(params) =>
            params.data.isTotal ? 'total' : String(params.data.no)
          }
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
