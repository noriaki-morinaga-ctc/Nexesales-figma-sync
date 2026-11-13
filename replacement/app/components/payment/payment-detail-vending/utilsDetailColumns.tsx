// 支払詳細(自販機)：支払明細情報（経費明細・ロケ契約料前払金・他部門から分割/振替）のグリッドの列の定義。
// 画面は useMemo（依存配列はこれまでどおり）からこの関数を呼ぶ。

import { ColDef, ICellEditorParams } from 'ag-grid-community';
import { toast } from 'sonner';

import {
  GRID_EMPTY_TEXT,
  withHeaderTooltips,
  suppressEditNavKeys,
  useLinkedCellUndo,
  GRID_NUMBER_TEXT_FILTER,
  revertNonNumericValueParser,
  requiredEmptyCellStyle,
} from '@/app/components/grid';

import { SingleComboboxCellEditor } from '@/app/components/ui/single-combobox-cell-editor';

import type { ExpenseItemData } from './paymentDetailVending.types';
import {
  SPLIT_INFO_COL_IDS,
  SPLIT_SOURCE_INFO_COL_IDS,
  SPLIT_FROM_OTHER_HEADER_OVERRIDES,
  SPLIT_SOURCE_INFO_HIDDEN_COL_IDS,
  MANAGEMENT_CATEGORY_COMBO_OPTIONS,
  COMBO_CELL_EDITOR_PARAMS,
  TAX_CATEGORY_OPTIONS,
  MEASURE_CATEGORY_COMBO_OPTIONS,
  MEASURE_CODE_COMBO_OPTIONS,
  PREPAID_AMORTIZATION_ITEM,
  PREPAID_AMORTIZATION_ACCOUNT,
  SALES_STORE_COMBO_OPTIONS,
  PRIMARY_STORE_COMBO_OPTIONS,
  TERTIARY_STORE_COMBO_OPTIONS,
  COST_BEARING_DEPT_COMBO_OPTIONS,
  SALES_REP_COMBO_OPTIONS,
  EDITABLE_CELL_BG,
  NON_EDITABLE_CELL_BG,
  SPLIT_SOURCE_INFO_EXTRA_COLUMN_DEFS,
  AMORTIZATION_INFO_COLUMN_DEFS,
  AMORTIZATION_JOURNAL_COLUMN_DEFS,
} from './constants';
import {
  managementCodeComboOptions,
  managementAccount,
  inheritOnDestCellStyle,
  destEditableCellStyle,
} from './utilsMaster';
import { OWN_COST_BEARING_DEPT } from '@/mocks/payment/payment-detail-vending/paymentDetail';
import { RowMenuCellRenderer } from './components/RowMenuCellRenderer';
import {
  isSplitDestRow,
  groupColumnsByIds,
  splitCategoryCode,
  splitCategoryName,
  nameWithoutCode,
  parseNumber,
  formatNumber,
  mirrorParentField,
  editableExceptDest,
  destFieldValue,
  dualFieldValue,
  dualFieldSetter,
  rowManagementCategory,
  managementCategorySetter,
  managementCodeEditable,
  ownBurdenAmount,
} from './utilsRows';

// 経費明細グリッドの列定義。
// ・"コード:名称" の1値は「コード列」「名称列」の2列に分けて表示する（同じ field を参照し
//   valueFormatter で出し分ける）。両列とも同じ選択肢で入力でき、同一 field を更新する
//   ため、どちらを編集しても隣のセルへ即座に連動する。
// ・管理区分・管理コード・施策区分/コード・摘要は分割元と分割先で同じ列を使い、
//   dualFieldValue／dualFieldSetter で保持先のフィールドだけを行の役割で切り替える
//   （分割先行は splitDest〜、それ以外は本体フィールド。どちらの行でも入力可）。
// ・mirrorParentField／inheritOnDestCellStyle を使う列（請求書番号）は分割先行で
//   分割元（親）の値を参照表示し編集不可。
// ・destFieldValue／destEditableCellStyle を使う列は分割先行のみ表示・入力可能とする
//   （分割元・通常行は空・入力不可）。
export const buildDetailColumnDefs = (
  handleManagementCategoryChanged: ReturnType<
    ReturnType<typeof useLinkedCellUndo<ExpenseItemData>>['makeHandler']
  >
): ColDef[] => {
  return [
    {
      headerName: '管理区分',
      colId: 'managementCategoryCode',
      field: 'managementCategory',
      valueGetter: dualFieldValue(
        'managementCategory',
        'splitDestMgmtCategory'
      ),
      valueSetter: managementCategorySetter,
      onCellValueChanged: handleManagementCategoryChanged,
      valueFormatter: (p) => splitCategoryCode(p.value) || GRID_EMPTY_TEXT,
      // 横スクロールしても管理区分列は左端に固定する
      lockPinned: true,
      editable: true,
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: {
        ...COMBO_CELL_EDITOR_PARAMS,
        comboOptions: MANAGEMENT_CATEGORY_COMBO_OPTIONS,
      },
      cellEditorPopup: true,
      suppressKeyboardEvent: suppressEditNavKeys,
      // 必須の項目が空なら赤の破線枠（手売りと同じ → UI/UX UX-089）
      cellStyle: (params) => {
        const base = { backgroundColor: EDITABLE_CELL_BG };
        return String(params.value ?? '').trim() === ''
          ? requiredEmptyCellStyle(base)
          : base;
      },
    },
    {
      headerName: '管理区分名称',
      colId: 'managementCategoryName',
      field: 'managementCategory',
      valueGetter: dualFieldValue(
        'managementCategory',
        'splitDestMgmtCategory'
      ),
      valueSetter: managementCategorySetter,
      onCellValueChanged: handleManagementCategoryChanged,
      valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
      editable: true,
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: {
        ...COMBO_CELL_EDITOR_PARAMS,
        comboOptions: MANAGEMENT_CATEGORY_COMBO_OPTIONS,
      },
      cellEditorPopup: true,
      suppressKeyboardEvent: suppressEditNavKeys,
      cellStyle: { backgroundColor: EDITABLE_CELL_BG },
    },
    {
      headerName: '管理コード',
      colId: 'managementCodeCode',
      field: 'managementCode',
      valueGetter: dualFieldValue('managementCode', 'splitDestMgmtCode'),
      valueSetter: dualFieldSetter('managementCode', 'splitDestMgmtCode'),
      valueFormatter: (p) => splitCategoryCode(p.value) || GRID_EMPTY_TEXT,
      // 管理区分が未選択の行は組み合わせが定まらないため入力不可（グレー背景）にする
      editable: managementCodeEditable,
      cellEditor: SingleComboboxCellEditor,
      // 管理コードの選択肢は行の管理区分で絞り込む（組み合わせマスタ準拠）
      cellEditorParams: (params: ICellEditorParams) => ({
        ...COMBO_CELL_EDITOR_PARAMS,
        comboOptions: managementCodeComboOptions(
          rowManagementCategory(params.data as ExpenseItemData | undefined)
        ),
      }),
      cellEditorPopup: true,
      suppressKeyboardEvent: suppressEditNavKeys,
      cellStyle: (params) => {
        if (!rowManagementCategory(params.data))
          return { backgroundColor: NON_EDITABLE_CELL_BG };
        const base = { backgroundColor: EDITABLE_CELL_BG };
        // 入力できる行で空なら赤の破線枠（→ UX-089）
        return String(params.value ?? '').trim() === ''
          ? requiredEmptyCellStyle(base)
          : base;
      },
    },
    {
      headerName: '管理コード名称',
      colId: 'managementCodeName',
      field: 'managementCode',
      valueGetter: dualFieldValue('managementCode', 'splitDestMgmtCode'),
      valueSetter: dualFieldSetter('managementCode', 'splitDestMgmtCode'),
      valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
      // 管理区分が未選択の行は組み合わせが定まらないため入力不可（グレー背景）にする
      editable: managementCodeEditable,
      cellEditor: SingleComboboxCellEditor,
      // 管理コードの選択肢は行の管理区分で絞り込む（組み合わせマスタ準拠）
      cellEditorParams: (params: ICellEditorParams) => ({
        ...COMBO_CELL_EDITOR_PARAMS,
        comboOptions: managementCodeComboOptions(
          rowManagementCategory(params.data as ExpenseItemData | undefined)
        ),
      }),
      cellEditorPopup: true,
      suppressKeyboardEvent: suppressEditNavKeys,
      cellStyle: (params) => ({
        backgroundColor: rowManagementCategory(params.data)
          ? EDITABLE_CELL_BG
          : NON_EDITABLE_CELL_BG,
      }),
    },
    // 勘定科目は管理区分ごとに一意に決まるため、入力欄ではなく管理区分に連動した
    // 表示（読み取り専用）とする。コード列・名称列は同じ値を出し分ける。
    // ※6/23 の「画面表示は不要」から 20260812_第29回 決定事項7 で表示する方針に変わっている。
    {
      headerName: '勘定科目コード',
      colId: 'accountCode',
      valueGetter: (p) =>
        managementAccount(
          rowManagementCategory(p.data as ExpenseItemData | undefined)
        ),
      valueFormatter: (p) => splitCategoryCode(p.value) || GRID_EMPTY_TEXT,
      editable: false,
      cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
    },
    {
      headerName: '勘定科目名称',
      colId: 'accountName',
      valueGetter: (p) =>
        managementAccount(
          rowManagementCategory(p.data as ExpenseItemData | undefined)
        ),
      valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
      editable: false,
      cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
    },
    {
      headerName: '支払金額',
      field: 'amount',
      ...GRID_NUMBER_TEXT_FILTER,
      valueFormatter: (params) =>
        params.value
          ? formatNumber(parseNumber(params.value))
          : GRID_EMPTY_TEXT,
      // 分割先行は編集不可（金額をブランクとし負担金額で管理する）。
      editable: (params) => !isSplitDestRow(params.data),
      cellEditor: 'agTextCellEditor',
      // 数字以外を入れたら元の値へ戻す（手売りと同じ → UI/UX UX-089）
      valueParser: revertNonNumericValueParser,
      // 分割元は、分割先の負担金額の合計を下回る支払金額にできない（手売りと同じ → UX-089）
      valueSetter: (params) => {
        const d = params.data as ExpenseItemData;
        let destTotal = 0;
        params.api.forEachNode((node) => {
          const row = node.data as ExpenseItemData | undefined;
          if (row?.splitRole === 'dest' && row.splitGroupId === d.id)
            destTotal += parseNumber(row.splitAmount ?? '');
        });
        const next = parseNumber(String(params.newValue ?? ''));
        if (destTotal > 0 && next < destTotal) {
          toast.error(
            `支払金額は分割先の負担金額の合計（${destTotal.toLocaleString('ja-JP')}円）を下回る値に変更できません。`
          );
          return false;
        }
        d.amount = params.newValue as ExpenseItemData['amount'];
        return true;
      },
      // 横寄せは cellClass、背景色のみ cellStyle（→ 02 §6/§7）
      cellClass: 'cell-right',
      cellStyle: (params) => {
        if (isSplitDestRow(params.data))
          return { backgroundColor: NON_EDITABLE_CELL_BG };
        const base = { backgroundColor: EDITABLE_CELL_BG };
        // 必須の項目が空なら赤の破線枠（→ UX-089）
        return String(params.value ?? '').trim() === ''
          ? requiredEmptyCellStyle(base)
          : base;
      },
    },
    {
      // 分割先行＝その分割先が負担する額（入力可）。
      // 分割元・通常行＝支払金額 − 分割先行の負担金額合計（自部門の負担分・入力不可）。
      headerName: '負担金額',
      colId: 'splitAmount',
      field: 'splitAmount',
      ...GRID_NUMBER_TEXT_FILTER,
      editable: (params) => isSplitDestRow(params.data),
      cellEditor: 'agTextCellEditor',
      valueGetter: (params) => {
        const d = params.data as ExpenseItemData | undefined;
        if (!d) return '';
        return d.splitRole === 'dest'
          ? (d.splitAmount ?? '')
          : String(ownBurdenAmount(params));
      },
      valueFormatter: (params) =>
        params.value
          ? formatNumber(parseNumber(params.value))
          : GRID_EMPTY_TEXT,
      // valueGetter を持つため編集反映には valueSetter が必要（分割先行のみ splitAmount へ書き戻す）。
      // 数字以外を入れたら元の値へ戻す（→ UX-089）
      valueParser: revertNonNumericValueParser,
      valueSetter: (params) => {
        if (!isSplitDestRow(params.data)) return false;
        // 分割先の負担金額の合計は、分割元の支払金額を超えられない（手売りと同じ → UX-089）
        const d = params.data as ExpenseItemData;
        let source: ExpenseItemData | undefined;
        let othersTotal = 0;
        params.api.forEachNode((node) => {
          const row = node.data as ExpenseItemData | undefined;
          if (!row) return;
          if (row.id === d.splitGroupId) source = row;
          else if (
            row.splitRole === 'dest' &&
            row.splitGroupId === d.splitGroupId &&
            row !== d
          )
            othersTotal += parseNumber(row.splitAmount ?? '');
        });
        const sourceAmount = source ? parseNumber(source.amount) : 0;
        const next = parseNumber(String(params.newValue ?? ''));
        if (source && othersTotal + next > sourceAmount) {
          toast.error(
            `分割先の負担金額の合計は、分割元の支払金額（${sourceAmount.toLocaleString('ja-JP')}円）を超えられません。`
          );
          return false;
        }
        params.data.splitAmount = params.newValue;
        return true;
      },
      cellClass: 'cell-right',
      cellStyle: destEditableCellStyle,
    },
    {
      headerName: '税区分',
      field: 'taxCategory',
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: TAX_CATEGORY_OPTIONS },
      cellStyle: { backgroundColor: EDITABLE_CELL_BG },
    },
    {
      // 分割先行＝振り分け先の部署（入力可・既定は基本情報の費用負担部署）。
      // 分割元・通常行＝基本情報の費用負担部署で固定（入力不可）。
      headerName: '費用負担部署',
      colId: 'splitDestDept',
      field: 'splitDestDept',
      editable: (params) => isSplitDestRow(params.data),
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: {
        ...COMBO_CELL_EDITOR_PARAMS,
        comboOptions: COST_BEARING_DEPT_COMBO_OPTIONS,
      },
      cellEditorPopup: true,
      suppressKeyboardEvent: suppressEditNavKeys,
      valueGetter: (params) => {
        const d = params.data as ExpenseItemData | undefined;
        if (!d) return '';
        return d.splitRole === 'dest'
          ? (d.splitDestDept ?? OWN_COST_BEARING_DEPT)
          : OWN_COST_BEARING_DEPT;
      },
      valueFormatter: (params) =>
        nameWithoutCode(params.value) || GRID_EMPTY_TEXT,
      cellStyle: destEditableCellStyle,
    },
    {
      headerName: '施策区分',
      colId: 'measureCategoryCode',
      field: 'measureCategory',
      valueGetter: dualFieldValue(
        'measureCategory',
        'splitDestMeasureCategory'
      ),
      valueSetter: dualFieldSetter(
        'measureCategory',
        'splitDestMeasureCategory'
      ),
      valueFormatter: (p) => splitCategoryCode(p.value) || GRID_EMPTY_TEXT,
      editable: true,
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: {
        ...COMBO_CELL_EDITOR_PARAMS,
        comboOptions: MEASURE_CATEGORY_COMBO_OPTIONS,
        clearable: true,
      },
      cellEditorPopup: true,
      suppressKeyboardEvent: suppressEditNavKeys,
      cellStyle: { backgroundColor: EDITABLE_CELL_BG },
    },
    {
      headerName: '施策区分名称',
      colId: 'measureCategoryName',
      field: 'measureCategory',
      valueGetter: dualFieldValue(
        'measureCategory',
        'splitDestMeasureCategory'
      ),
      valueSetter: dualFieldSetter(
        'measureCategory',
        'splitDestMeasureCategory'
      ),
      valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
      editable: true,
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: {
        ...COMBO_CELL_EDITOR_PARAMS,
        comboOptions: MEASURE_CATEGORY_COMBO_OPTIONS,
        clearable: true,
      },
      cellEditorPopup: true,
      suppressKeyboardEvent: suppressEditNavKeys,
      cellStyle: { backgroundColor: EDITABLE_CELL_BG },
    },
    {
      headerName: '施策コード',
      colId: 'measureCodeCode',
      field: 'measureCode',
      valueGetter: dualFieldValue('measureCode', 'splitDestMeasureCode'),
      valueSetter: dualFieldSetter('measureCode', 'splitDestMeasureCode'),
      valueFormatter: (p) => splitCategoryCode(p.value) || GRID_EMPTY_TEXT,
      editable: true,
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: {
        ...COMBO_CELL_EDITOR_PARAMS,
        comboOptions: MEASURE_CODE_COMBO_OPTIONS,
        clearable: true,
      },
      cellEditorPopup: true,
      suppressKeyboardEvent: suppressEditNavKeys,
      cellStyle: { backgroundColor: EDITABLE_CELL_BG },
    },
    {
      headerName: '施策コード名称',
      colId: 'measureCodeName',
      field: 'measureCode',
      valueGetter: dualFieldValue('measureCode', 'splitDestMeasureCode'),
      valueSetter: dualFieldSetter('measureCode', 'splitDestMeasureCode'),
      valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
      editable: true,
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: {
        ...COMBO_CELL_EDITOR_PARAMS,
        comboOptions: MEASURE_CODE_COMBO_OPTIONS,
        clearable: true,
      },
      cellEditorPopup: true,
      suppressKeyboardEvent: suppressEditNavKeys,
      cellStyle: { backgroundColor: EDITABLE_CELL_BG },
    },
    {
      headerName: '請求書番号',
      field: 'invoiceNumber',
      valueGetter: mirrorParentField('invoiceNumber'),
      editable: editableExceptDest,
      cellEditor: 'agTextCellEditor',
      cellStyle: inheritOnDestCellStyle(EDITABLE_CELL_BG),
    },
    {
      headerName: '摘要1（社内用）',
      field: 'note1',
      colId: 'note1',
      valueGetter: dualFieldValue('note1', 'splitDestNote1'),
      valueSetter: dualFieldSetter('note1', 'splitDestNote1'),
      editable: true,
      cellEditor: 'agTextCellEditor',
      cellStyle: { backgroundColor: EDITABLE_CELL_BG },
    },
    {
      headerName: '摘要2（社外用）',
      field: 'note2',
      colId: 'note2',
      valueGetter: dualFieldValue('note2', 'splitDestNote2'),
      valueSetter: dualFieldSetter('note2', 'splitDestNote2'),
      editable: true,
      cellEditor: 'agTextCellEditor',
      cellStyle: { backgroundColor: EDITABLE_CELL_BG },
    },
    // ===== 分割先行のみが持つ項目（販売店・三次店・一次店・営業担当者・分割案内） =====
    // 管理区分・管理コード・施策区分/コード・摘要は分割元と同じ列で入力する。
    {
      headerName: '販売店',
      colId: 'splitDestStore',
      editable: (params) => isSplitDestRow(params.data),
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: {
        ...COMBO_CELL_EDITOR_PARAMS,
        comboOptions: SALES_STORE_COMBO_OPTIONS,
      },
      cellEditorPopup: true,
      suppressKeyboardEvent: suppressEditNavKeys,
      // 値の読み書きは splitDestName に対して行うため field は持たない。
      // 分割元・通常行は基本情報の販売店を表示する（初期値として保持済み・入力不可）。
      valueGetter: (params) =>
        (params.data as ExpenseItemData | undefined)?.splitDestName ?? '',
      valueFormatter: (params) =>
        nameWithoutCode(params.value) || GRID_EMPTY_TEXT,
      // valueGetter を持つため編集反映には valueSetter が必要（分割先行のみ splitDestName へ書き戻す）。
      valueSetter: (params) => {
        if (!isSplitDestRow(params.data)) return false;
        params.data.splitDestName = params.newValue;
        return true;
      },
      cellStyle: destEditableCellStyle,
    },
    {
      headerName: '三次店',
      colId: 'splitTertiaryStore',
      field: 'splitTertiaryStore',
      // 分割元・通常行は基本情報の三次店を表示する（初期値として保持済み・入力不可）。
      valueFormatter: (params) =>
        nameWithoutCode(params.value) || GRID_EMPTY_TEXT,
      editable: (params) => isSplitDestRow(params.data),
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: {
        ...COMBO_CELL_EDITOR_PARAMS,
        comboOptions: TERTIARY_STORE_COMBO_OPTIONS,
      },
      cellEditorPopup: true,
      suppressKeyboardEvent: suppressEditNavKeys,
      cellStyle: destEditableCellStyle,
    },
    {
      headerName: '一次店',
      colId: 'splitPrimaryStore',
      field: 'splitPrimaryStore',
      // 分割元・通常行は基本情報の一次店を表示する（初期値として保持済み・入力不可）。
      valueFormatter: (params) =>
        nameWithoutCode(params.value) || GRID_EMPTY_TEXT,
      editable: (params) => isSplitDestRow(params.data),
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: {
        ...COMBO_CELL_EDITOR_PARAMS,
        comboOptions: PRIMARY_STORE_COMBO_OPTIONS,
      },
      cellEditorPopup: true,
      suppressKeyboardEvent: suppressEditNavKeys,
      cellStyle: destEditableCellStyle,
    },
    {
      headerName: '営業担当者',
      colId: 'splitDestManager',
      field: 'splitDestManager',
      // 分割元・通常行は基本情報の営業担当者を表示する（初期値として保持済み・入力不可）。
      valueFormatter: (params) =>
        nameWithoutCode(params.value) || GRID_EMPTY_TEXT,
      editable: (params) => isSplitDestRow(params.data),
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: {
        ...COMBO_CELL_EDITOR_PARAMS,
        comboOptions: SALES_REP_COMBO_OPTIONS,
      },
      cellEditorPopup: true,
      suppressKeyboardEvent: suppressEditNavKeys,
      cellStyle: destEditableCellStyle,
    },
    {
      headerName: '分割案内',
      colId: 'splitDestGuide',
      field: 'splitDestGuide',
      valueGetter: destFieldValue('splitDestGuide'),
      editable: (params) => isSplitDestRow(params.data),
      cellEditor: 'agTextCellEditor',
      cellStyle: destEditableCellStyle,
    },
    {
      headerName: '',
      // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
      suppressColumnsToolPanel: true,
      colId: 'actions',
      pinned: 'right',
      lockPinned: true,
      sortable: false,
      filter: false,
      resizable: false,
      editable: false,
      // 「︙」のメニューだけを出す列のため幅を固定（手売りの支払詳細と同じ幅。自動列幅調整の対象外にする → UX-087）
      width: 45,
      minWidth: 45,
      maxWidth: 45,
      suppressAutoSize: true,
      cellRenderer: RowMenuCellRenderer,
      // 中央寄せはレンダラー側で行い、cellStyle に display:flex を持たせない（→ 02 §7）
    },
  ];
};

// ロケ契約料前払金グリッドの列定義。経費明細の列から分割先固有列（当グリッドは
// 分割を行わない）と右端アクション列を除いて流用し、償却情報・償却仕訳情報グループの
// 列を加える。負担金額は分割先行が前提の列のため併せて除き、費用負担部署は
// 行ごとに入力可とする。
export const buildPrepaymentColumnDefs = (columnDefs: ColDef[]): ColDef[] => {
  const prepaymentExcludedColIds = [...SPLIT_INFO_COL_IDS, 'splitAmount'];
  const baseCols = columnDefs
    .filter(
      (col) =>
        !prepaymentExcludedColIds.includes(col.colId ?? '') &&
        col.colId !== 'actions'
    )
    // 当グリッドは管理区分「XKA / 長期前払費用自販機関係費」、
    // 管理コード「99999 / 長期前払費用自販機関係費」を固定・読み取り専用にする。
    .map((col) => {
      if (col.colId === 'managementCategoryCode') {
        return {
          ...col,
          editable: false,
          valueGetter: () => 'XKA',
          valueFormatter: undefined,
          cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
        };
      }
      if (col.colId === 'managementCategoryName') {
        return {
          ...col,
          editable: false,
          valueGetter: () => PREPAID_AMORTIZATION_ITEM,
          valueFormatter: undefined,
          cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
        };
      }
      if (col.colId === 'managementCodeCode') {
        return {
          ...col,
          editable: false,
          valueGetter: () => '99999',
          valueFormatter: undefined,
          cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
        };
      }
      if (col.colId === 'managementCodeName') {
        return {
          ...col,
          editable: false,
          valueGetter: () => PREPAID_AMORTIZATION_ITEM,
          valueFormatter: undefined,
          cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
        };
      }
      // 費用負担部署は分割を行わない当グリッドでは行自身の負担部署として入力可にする
      // （既定は基本情報の自部門）。経費明細の分割先用 valueGetter は使わず、
      // 「他部門へ」の集計対象である costBearingDept を直接読み書きする。
      if (col.colId === 'splitDestDept') {
        return {
          ...col,
          editable: true,
          valueGetter: (params: any) => {
            const d = params.data as ExpenseItemData | undefined;
            return d?.costBearingDept ?? OWN_COST_BEARING_DEPT;
          },
          valueSetter: (params: any) => {
            params.data.costBearingDept = params.newValue;
            return true;
          },
          cellStyle: { backgroundColor: EDITABLE_CELL_BG },
        };
      }
      // 勘定科目は管理区分 XKA に対応する科目で固定する
      // （行データの管理区分ではなく、当グリッドの固定表示に合わせる）。
      if (col.colId === 'accountCode' || col.colId === 'accountName') {
        return {
          ...col,
          valueGetter: () => PREPAID_AMORTIZATION_ACCOUNT,
        };
      }
      return col;
    });
  const actionsCol = columnDefs.find((col) => col.colId === 'actions');
  return [
    ...baseCols,
    ...AMORTIZATION_INFO_COLUMN_DEFS,
    ...AMORTIZATION_JOURNAL_COLUMN_DEFS,
    ...(actionsCol ? [actionsCol] : []),
  ];
};

// 「他部門から分割/振替された経費明細」タブの列定義。経費明細の列を流用しつつ、
// ・右端アクション列と請求書番号は非表示、参照専用のため全列を入力不可（グレー背景）
// ・分割セット固有列は部署・営業担当者のみ残し、当タブ専用の支払No・支払回数・
//   事業場を加えて第一階層「分割/振替元」でまとめ、グリッド右端に配置する
// ・分割案内はグループ対象外の単独列として摘要２の右に置く
// ・項目名が異なる列は SPLIT_FROM_OTHER_HEADER_OVERRIDES で改称する
export const buildSplitFromOtherColumnDefs = (columnDefs: ColDef[]) => {
  const excludedFields = ['actions', 'invoiceNumber'];
  const baseCols: ColDef[] = columnDefs
    .filter(
      (col) =>
        !excludedFields.includes((col.colId ?? col.field) as string) &&
        !SPLIT_SOURCE_INFO_HIDDEN_COL_IDS.includes(col.colId ?? '')
    )
    .map((col) => {
      const overriddenHeader =
        SPLIT_FROM_OTHER_HEADER_OVERRIDES[col.colId ?? col.field ?? ''];
      // 費用負担部署列は経費明細では自部門固定を表示するが、当タブでは分割/振替元の
      // 部署を表示するため、行の値をそのまま読む valueGetter に差し替える。
      const overriddenValueGetter =
        col.colId === 'splitDestDept'
          ? { valueGetter: destFieldValue('splitDestDept') }
          : {};
      return {
        ...col,
        ...(overriddenHeader ? { headerName: overriddenHeader } : {}),
        ...overriddenValueGetter,
        editable: false,
        cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
      };
    });
  // 分割案内（columnDefs 上は末尾）を摘要2（社外用）の直後へ移動する。
  const guideCol = baseCols.find((col) => col.colId === 'splitDestGuide');
  const orderedCols = guideCol
    ? baseCols
        .filter((col) => col.colId !== 'splitDestGuide')
        .flatMap((col) => (col.field === 'note2' ? [col, guideCol] : [col]))
    : baseCols;
  // 分割/振替元グループの子列順は groupColumnsByIds に渡す配列の並びで決まるため、
  // SPLIT_SOURCE_INFO_COL_IDS の順に並べ替える（当タブ専用列も候補に含める）。
  const sourceInfoPool = [
    ...orderedCols,
    ...SPLIT_SOURCE_INFO_EXTRA_COLUMN_DEFS,
  ];
  const sourceInfoCols = SPLIT_SOURCE_INFO_COL_IDS.map((colId) =>
    sourceInfoPool.find((col) => col.colId === colId)
  ).filter((col): col is ColDef => col !== undefined);
  // 対象列を元の位置から取り除き、グリッド右端へまとめて並べる
  // （groupColumnsByIds は最初の対象列の位置にグループを差し込むため、末尾に置けば右端になる）。
  const finalCols = [
    ...orderedCols.filter(
      (col) => !SPLIT_SOURCE_INFO_COL_IDS.includes(col.colId ?? '')
    ),
    ...sourceInfoCols,
  ];
  // 先頭は手売りの同じ表と同じく見出し「No.」の番号の列にする（AG Grid の見出しの無い行番号は使わない → UX-085）
  const noCol: ColDef = {
    headerName: 'No.',
    colId: 'splitFromOtherNo',
    valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
    width: 56,
    sortable: false,
    filter: false,
    editable: false,
    cellClass: 'cell-right',
  };
  return groupColumnsByIds(
    withHeaderTooltips([noCol, ...finalCols]),
    SPLIT_SOURCE_INFO_COL_IDS,
    '分割/振替元'
  );
};
