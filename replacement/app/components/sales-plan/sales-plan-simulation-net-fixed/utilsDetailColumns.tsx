// sim(NET固定)：明細表の列の定義。画面の状態・処理は引数で受け取る。
// 明細表は最初の描画で1回だけ作る（これまでの useMemo(…, []) と同じ。値は ref から読む）。

import type { MutableRefObject } from 'react';
import { ColDef, ColGroupDef, ICellRendererParams } from 'ag-grid-community';
import { Trash2, Copy } from 'lucide-react';

import { campaignComboOptions } from '@/app/utils/sales-plan/simulation/simulationCampaignName';
import {
  GRID_COLORS,
  formatEmptyAsDash,
  copySourceLeftBorder,
  useChangedCells,
  useLinkedCellUndo,
  GRID_NUMBER_TEXT_FILTER,
  GRID_MONTH_TEXT_FILTER,
  asCellStyle,
} from '@/app/components/grid';
import { DeltaCell } from '@/app/components/ui/delta-cell';
import {
  PLAN_DETAIL_DIGITS,
  planAmountFormatter,
  planRateFormatter,
} from '@/app/utils/sales-plan/common/planDetailNumberFormat';

import {
  canSelectConfirm,
  confirmBlockReason,
} from '@/app/utils/sales-plan/simulation/simulationConfirmRules';

import {
  SingleComboboxCellEditor,
  toComboOptions,
} from '@/app/components/ui/single-combobox-cell-editor';

import { CATEGORY_LABELS_NET_ADDABLE } from '@/app/constants/promotionCategories';

import { planDetailCodeColumns } from '@/app/components/shared/sales-plan/common/planDetailCodeColumns';

import type { ProductData } from '@/app/types/simulation';

import { DERIVED_FIELDS, CAMPAIGN_OPTIONS } from './constants';
import { usesNetAsKey, recomputeDerived, parseMetric } from './utils';
import { buildSimulationDetailColumnParts } from '@/app/components/shared/sales-plan/simulation/simulationDetailColumnParts';

// 明細表から受け取る状態・処理
interface DetailColumnDeps {
  allDataRef: MutableRefObject<ProductData[]>;
  handleSyncCampaignName: (
    targetMonth: string,
    campaign: string,
    campaignName: string
  ) => void;
  handleUpdateRegularProduct: (updatedData: ProductData) => void;
  handleUpdateNewProduct: (updatedData: ProductData) => void;
  handleUpdatePromotionProduct: (updatedData: ProductData) => void;
  handleUpdateGiftProduct: (updatedData: ProductData) => void;
  isCellChanged: ReturnType<typeof useChangedCells>['isCellChanged'];
  makeLinkedHandler: ReturnType<
    typeof useLinkedCellUndo<ProductData>
  >['makeHandler'];
}

export const buildDetailColumnDefs = ({
  allDataRef,
  handleSyncCampaignName,
  handleUpdateRegularProduct,
  handleUpdateNewProduct,
  handleUpdatePromotionProduct,
  handleUpdateGiftProduct,
  isCellChanged,
  makeLinkedHandler,
}: DetailColumnDeps): (ColDef | ColGroupDef)[] => {
  // 2画面とも同じ列の部品（→ shared/sales-plan/simulation/simulationDetailColumnParts.tsx）
  const {
    yellowCellStyle,
    yellowCellStyleWithRedNegative,
    whiteCellStyle,
    whiteCellStyleWithRedNegative,
    makeCellStyleWithRedNegative,
    isReflectedRow,
    baseEditable,
    routeUpdate,
    makeAfterSetter,
    deltaBaseOf,
    makeDeltaGetter,
    deltaCellStyle,
    makeAfterStyle,
    requiredCellStyle,
    campaignValueSetter,
    probabilityValueSetter,
    netValueSetter,
    napaValueSetter,
    handleCampaignChanged,
    makeExpenseColumns,
  } = buildSimulationDetailColumnParts({
    allDataRef,
    handleUpdateRegularProduct,
    handleUpdateNewProduct,
    handleUpdatePromotionProduct,
    handleUpdateGiftProduct,
    isCellChanged,
    makeLinkedHandler,
    recomputeDerived,
    usesNetAsKey,
    derivedFields: DERIVED_FIELDS,
  });

  // Yellow: 手入力可能セル
  // 定番商品の行か（NET固定は一般卸メッシュ単位のため商品区分を変更できない）。
  const isRegularProductRow = (params: any) =>
    params.data?.section === '定番商品' ||
    params.data?.productCategory === '定番商品';

  const makeEditable = (categories: string[]) => (params: any) => {
    if (params.data?._isHeader || params.node?.rowPinned) return false;
    if (isReflectedRow(params)) return false;
    return categories.includes(params.data?.productCategory ?? '');
  };

  // ヘッダー/合計行以外は全て編集可
  const allEditable = (params: any) =>
    !params.data?._isHeader &&
    !params.node?.rowPinned &&
    !isReflectedRow(params);
  // recomputeDerived はモジュールスコープへ切り出し済み（初期表示 withBaseline からも呼べるようにするため）。
  // 1指標 → 変更前/変更後/増減 の子列を生成
  const makeComparisonChildren = (m: {
    field: string;
    width: number;
    isPercent: boolean;
    // 項目一覧の小数桁（NET・納価=2／売価=0）。変更前・変更後・増減で共通に使う。
    decimals?: number;
    editable: (p: any) => boolean;
    afterStyle: (p: any) => any;
    childSuffix?: string;
    // 変更後が算出値（入力不可）か。マージン率は NET・納価から算出する。
    computed?: boolean;
    // 変更後セル編集後の追加処理（NET・納価変更時にマージン率を再計算）。
    onAfterCellChange?: (p: any) => void;
    // 変更後セルの valueSetter を差し替える（納価の同一値制御などに使用）。
    afterValueSetter?: (p: any) => boolean;
    // ギフトのセル結合対象外にする（計画函数は行ごとに値が異なるため）。
    perRow?: boolean;
    // 変更後セルを整数のみ入力可にする（計画函数・売価）。
    integerOnly?: boolean;
  }): ColDef[] => {
    const suffix = m.childSuffix ?? '';
    // ギフト3行1セットで結合させない列（先頭行が覆わず行ごとに表示）。
    const rowSpanOverride: Partial<ColDef> = m.perRow
      ? { rowSpan: () => 1 }
      : {};
    // 変更前・変更後は同じ項目のため同じ桁数で表示する。
    const decimalFormatter =
      m.decimals === undefined
        ? undefined
        : m.isPercent
          ? planRateFormatter(m.decimals)
          : planAmountFormatter(m.decimals);
    const afterCol: ColDef = {
      headerName: `SIM値${suffix}`,
      field: m.field,
      ...GRID_NUMBER_TEXT_FILTER,
      width: m.width,
      cellClass: 'ag-cell-right',
      ...(decimalFormatter && { valueFormatter: decimalFormatter }),
      cellStyle: m.computed
        ? whiteCellStyleWithRedNegative
        : makeAfterStyle(m.field, m.afterStyle),
      editable: m.computed ? false : m.editable,
      ...rowSpanOverride,
      onCellValueChanged: (params: any) => {
        m.onAfterCellChange?.(params);
        routeUpdate(params, { ...params.data });
      },
    };
    // 算出列（マージン率）は入力不可のため、エディタ・セッターは付与しない
    if (!m.computed) {
      // 整数のみの項目（計画函数・売価）は小数を入力させない
      if (m.integerOnly) {
        afterCol.cellEditor = 'agNumberCellEditor';
        afterCol.cellEditorParams = { precision: 0 };
        // cellDataType の自動推論は valueSetter/valueParser を上書きするため無効化する
        afterCol.cellDataType = false;
      } else {
        afterCol.cellEditor = 'agTextCellEditor';
      }
      afterCol.valueSetter =
        m.afterValueSetter ?? makeAfterSetter(m.field, m.isPercent, m.decimals);
    }
    return [
      {
        headerName: `計画値${suffix}`,
        field: `${m.field}Before`,
        ...GRID_NUMBER_TEXT_FILTER,
        columnGroupShow: 'open',
        width: m.width,
        cellClass: 'ag-cell-right',
        cellStyle: whiteCellStyleWithRedNegative,
        editable: false,
        valueFormatter: decimalFormatter ?? formatEmptyAsDash,
        ...rowSpanOverride,
      },
      afterCol,
      {
        headerName: `増減${suffix}`,
        colId: `${m.field}Delta`,
        ...GRID_NUMBER_TEXT_FILTER,
        // 表示値はマイナスを「▲N」で持ち数値へ変換できないため、絞り込みは変更後−変更前の数値で行う
        filterValueGetter: (params) => {
          const delta =
            parseMetric(params.data?.[m.field]) -
            deltaBaseOf(m.field, params.data);
          return isNaN(delta) ? null : delta;
        },
        columnGroupShow: 'open',
        width: m.width,
        cellClass: 'ag-cell-right',
        // 増減列は入力不可（非活性）で表示のみ。差分は共通の DeltaCell でアイコン表示。
        cellStyle: deltaCellStyle(() => false),
        editable: false,
        valueGetter: makeDeltaGetter(m.field, m.isPercent, m.decimals),
        cellRenderer: DeltaCell,
        ...rowSpanOverride,
      },
    ];
  };
  // 1指標 → 「変更前/変更後/増減」を子に持つ列グループ
  const makeComparisonGroup = (m: {
    field: string;
    header: string;
    width: number;
    isPercent: boolean;
    // 項目一覧の小数桁（NET・納価=2／売価=0）。
    decimals?: number;
    editable: (p: any) => boolean;
    afterStyle: (p: any) => any;
    computed?: boolean;
    onAfterCellChange?: (p: any) => void;
    afterValueSetter?: (p: any) => boolean;
    // グループヘッダーのツールチップ（計画詳細と同じ説明を表示）
    headerTooltip?: string;
    // ギフトのセル結合対象外にする（計画函数は行ごとに値が異なるため）。
    perRow?: boolean;
    // 変更後セルを整数のみ入力可にする（計画函数・売価）。
    integerOnly?: boolean;
  }) => ({
    headerName: m.header,
    headerTooltip: m.headerTooltip,
    marryChildren: true,
    // 既定で変更前/増減を展開表示（グループの＋/−で折りたたみ可能）
    openByDefault: true,
    children: makeComparisonChildren(m),
  });

  // コード値・区分値の列（PJルール：名称と別列で保持。既定は非表示で列メニューから表示できる。
  // 初期表示は基本設計で業務側が項目ごとに決める）。計画詳細(NET固定)と同じ列定義を使う。
  const codeColumns = planDetailCodeColumns(whiteCellStyle, {
    // 定番商品は一般卸メッシュ粒度のためサマリ商品コードは出さない（計画詳細(NET固定)と同じ）
    isWithoutSummaryProduct: (d) => d.productCategory === '定番商品',
  });

  const columnDefs: (ColDef | ColGroupDef)[] = [
    {
      headerName: '対象年月',
      field: 'targetMonth',
      ...GRID_MONTH_TEXT_FILTER,
      width: 104,
      lockPinned: true,
      cellClass: 'ag-cell-left',
      // 自動表示の白背景に、行の追加経路を示すカラーバー（左罫線）を合成
      cellStyle: (params: any) => ({
        ...(whiteCellStyle(params) || {}),
        ...copySourceLeftBorder(params.data?._copySource),
      }),
      // 合計行は対象年月＋企画（固定列）を結合して「合計」と表示
      colSpan: (params: any) => (params.node?.rowPinned ? 2 : 1),
      // 編集不可（自動表示）。読み取り専用のため editor 設定は持たない。
      editable: false,
    },
    {
      headerName: '企画',
      field: 'campaign',
      width: 80,
      lockPinned: true,
      cellClass: 'ag-cell-left',
      cellStyle: requiredCellStyle,
      editable: baseEditable,
      cellEditor: SingleComboboxCellEditor,
      cellEditorPopup: true,
      // 使用中の企画は企画名を併記する（対象年月ごとに管理するため行の対象年月で作る）
      cellEditorParams: (params: any) => ({
        comboOptions: campaignComboOptions(
          CAMPAIGN_OPTIONS,
          allDataRef.current,
          params.data?.targetMonth
        ),
        width: '22rem',
      }),
      valueSetter: campaignValueSetter,
      onCellValueChanged: handleCampaignChanged,
    },
    {
      // 企画名（企画の右隣・手入力）
      headerName: '企画名',
      field: 'campaignName',
      width: 128,
      cellClass: 'ag-cell-left',
      cellStyle: requiredCellStyle,
      // 合計行は企画名～一般卸メッシュ（スクロール列）を結合（表示は空欄）
      colSpan: (params: any) => (params.node?.rowPinned ? 8 : 1),
      editable: baseEditable,
      cellEditor: 'agTextCellEditor',
      valueFormatter: (params: any) =>
        params.node?.rowPinned ? '' : formatEmptyAsDash(params),
      onCellValueChanged: (params) => {
        routeUpdate(params, {
          ...params.data,
          campaignName: params.newValue,
        });
        // 同じ対象年月・同じ企画の明細へ連動する（Undo でも再発火するため元の名前に戻る）
        handleSyncCampaignName(
          params.data.targetMonth,
          params.data.campaign,
          params.newValue ?? ''
        );
      },
    },
    {
      headerName: '確度',
      field: 'probability',
      width: 80,
      cellClass: 'ag-cell-left',
      cellStyle: requiredCellStyle,
      editable: baseEditable,
      cellEditor: SingleComboboxCellEditor,
      cellEditorPopup: true,
      valueFormatter: (params: any) =>
        params.node?.rowPinned ? '' : formatEmptyAsDash(params),
      valueSetter: probabilityValueSetter,
      // 確定の排他（同一計画・同一商品の二重確定）に該当する行は「確定」を選択不可にする。
      // 反映済はシステムが付与する状態のため手動選択肢には含めない。
      cellEditorParams: (params: any) => ({
        comboOptions: toComboOptions(
          canSelectConfirm(params.data, allDataRef.current)
            ? ['A', 'B', 'C', '確定', '不採用']
            : ['A', 'B', 'C', '不採用']
        ),
      }),
      // 確定不可の理由をセルのツールチップで表示する
      tooltipValueGetter: (params: any) =>
        params.node?.rowPinned
          ? null
          : confirmBlockReason(params.data, allDataRef.current),
      onCellValueChanged: (params) => {
        const updatedData = {
          ...params.data,
          probability: params.newValue,
        };
        // rowData は値編集で作り直さないため、当該ノードの data を直接更新する。
        // 確度で行の背景（反映済・不採用のグレー：getRowStyle）が変わるため行ごと描き直す。
        Object.assign(params.data, updatedData);
        if (params.node) params.api.redrawRows({ rowNodes: [params.node] });
        if (params.data.section === '定番商品') {
          params.context.updateRegularProduct(updatedData);
        } else if (params.data.section === '新商品') {
          params.context.updateNewProduct(updatedData);
        } else if (params.data.section === '特殊商品') {
          params.context.updatePromotionProduct(updatedData);
        } else if (params.data.section === 'ギフト') {
          params.context.updateGiftProduct(updatedData);
        }
      },
    },
    codeColumns.productCategoryCode,
    {
      headerName: '商品区分',
      field: 'productCategory',
      width: 88,
      cellClass: 'ag-cell-left',
      // 商品区分：新商品/特殊商品/ギフトを活性（編集可＝黄）。
      // ギフトは3行1セットの先頭セルで結合表示する。
      // 定番商品は一般卸メッシュ単位でシミュレーションの入力対象外のため（補足5-2）、
      // 選択肢から外し、既存の定番商品行はグレーアウトして非活性にする。
      cellStyle: asCellStyle((params: any) =>
        isRegularProductRow(params)
          ? { backgroundColor: GRID_COLORS.readonly }
          : yellowCellStyle(params)
      ),
      editable: (params: any) =>
        baseEditable(params) && !isRegularProductRow(params),
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: {
        // ギフトを含む選択可能な区分から選ぶ（ギフト⇄他区分の変更も可）。
        comboOptions: CATEGORY_LABELS_NET_ADDABLE.map((value) => ({
          value,
          label: value,
        })),
        placeholder: '商品区分を選択',
      },
      cellEditorPopup: true,
      filter: true,
      headerTooltip:
        '商品区分[自動表示]前年同月実績の商品区分(定番商品/新商品/特殊商品/ギフト)を取得表示',
      onCellValueChanged: (params: any) => {
        // 商品区分の変更に応じてタブ振り分け（section）・販促区分を連動させ、
        // ギフト⇄他区分では販売期間の 1行⇔3行 を組み替える。
        if (params.newValue === params.oldValue) return;
        params.context.changeProductCategory(params.data, params.newValue);
      },
    },
    codeColumns.promotionCode,
    {
      // ギフト=黄（手入力）、その他=グレー（非活性）
      headerName: '販促区分',
      field: 'promotion',
      width: 144,
      cellClass: 'ag-cell-left',
      cellStyle: whiteCellStyle,
      // 読み取り専用（自動表示）のため editor 設定は持たない。
      editable: false,
      // 特殊商品/ギフトは商品区分名を固定表示（編集不可）
      valueFormatter: (params: any) => {
        const cat = params.data?.productCategory;
        if (cat === '特殊商品') return '特殊商品';
        if (cat === 'ギフト') return 'ギフト';
        return formatEmptyAsDash(params);
      },
      headerTooltip:
        '販促区分[自動表示]サマリ商品/一般卸メッシュに紐づく販促区分を取得表示',
    },
    {
      headerName: 'メタブランド',
      field: 'metaBrand',
      width: 112,
      cellClass: 'ag-cell-left',
      cellStyle: whiteCellStyle,
      filter: true,
      headerTooltip:
        'メタブランド[自動表示]サマリ商品/一般卸メッシュに紐づくメタブランドを取得表示',
    },
    {
      headerName: '容器容量G',
      field: 'containerCapacityG',
      width: 112,
      cellClass: 'ag-cell-left',
      cellStyle: whiteCellStyle,
      filter: true,
      headerTooltip:
        '容器容量G[自動表示]サマリ商品/一般卸メッシュに紐づく容器容量Gを取得表示',
    },
    {
      // 定番商品=グレー（一般卸メッシュを使用）、新商品/特殊/ギフト=黄（セレクトボックス）
      headerName: 'サマリ商品',
      field: 'summaryProduct',
      width: 264,
      cellClass: 'ag-cell-left',
      cellStyle: whiteCellStyle,
      // 読み取り専用（自動表示）のため editor 設定は持たない。
      editable: false,
      filter: true,
      headerTooltip: 'サマリ商品[自動表示]前年同月実績のサマリ商品を取得表示',
    },
    {
      // 定番商品=黄（セレクトボックス）、新商品=白、特殊商品=グレー（不使用）、ギフト=白（自動表示）
      headerName: '一般卸メッシュ',
      field: 'wholesaleMesh',
      width: 160,
      cellClass: 'ag-cell-left',
      cellStyle: whiteCellStyle,
      // 読み取り専用（自動表示）のため editor 設定は持たない。
      editable: false,
      filter: true,
      headerTooltip:
        '一般卸メッシュ[自動表示]前年同月実績の一般卸メッシュを取得表示',
    },
    // コード値・区分値の列（PJルール：名称と別列で保持。既定は非表示で列メニューから表示できる）
    codeColumns.metaBrandCode,
    codeColumns.containerCapacityCode,
    codeColumns.summaryProductCode,
    codeColumns.wholesaleMeshCode,
    {
      // ギフトは上旬/中旬/下旬の3行1セット。販売期間はセット構成として自動表示（非活性）。
      // セル結合対象外（行ごとに表示）。
      headerName: '販売期間',
      field: 'period',
      width: 72,
      cellClass: 'ag-cell-left',
      cellStyle: whiteCellStyle,
      editable: false,
      rowSpan: () => 1,
      valueFormatter: (params: any) =>
        params.node?.rowPinned ? '' : formatEmptyAsDash(params),
      headerTooltip:
        '販売期間[自動表示]ギフトは上旬/中旬/下旬の3行1セットで表示',
    },
    {
      headerName: '入数',
      headerTooltip:
        '入数[自動表示]サマリ商品/一般卸メッシュに紐づく入数を取得表示',
      field: 'quantity',
      ...GRID_NUMBER_TEXT_FILTER,
      width: 68,
      cellClass: 'ag-cell-right',
      cellStyle: whiteCellStyle,
    },
    makeComparisonGroup({
      field: 'plan',
      header: '計画函数',
      // 計画函数は整数（3桁区切り）
      decimals: 0,
      // 計画函数は整数のみ入力可
      integerOnly: true,
      headerTooltip: '函数-計画[入力値/自動表示]前年同月実績値を取得表示',
      width: 80,
      isPercent: false,
      editable: baseEditable,
      afterStyle: yellowCellStyleWithRedNegative,
      // 函数変更で社外売上高・売上高・管理利益（算出値）を再計算
      onAfterCellChange: (params: any) => recomputeDerived(params.data),
      // ギフトは上旬/中旬/下旬で計画函数が異なるためセル結合対象外（行ごとに表示）
      perRow: true,
    }),
    makeComparisonGroup({
      field: 'net',
      header: 'NET',
      decimals: PLAN_DETAIL_DIGITS.price,
      headerTooltip:
        'NET[条件分岐]固定マージン率：[自動表示]納価-納価*マージン率、固定NET(ギフト以外)：[算出]固定NET設定値、固定NET(ギフト/特殊商品)：[入力値]、取引制度外：[入力値]',
      width: 84,
      isPercent: false,
      // 特殊商品・ギフトのみ変更後を入力可（その他は非活性）
      editable: makeEditable(['特殊商品', 'ギフト']),
      afterStyle: makeCellStyleWithRedNegative(
        { 特殊商品: 'yellow', ギフト: 'yellow' },
        'gray'
      ),
      // シミュレーション更新KEYが同じ明細があれば変更できない（VL-04）
      afterValueSetter: netValueSetter,
      // 特殊商品・ギフトの NET 変更時にマージン率（変更後）を再計算
      onAfterCellChange: (params: any) => recomputeDerived(params.data),
    }),
    makeComparisonGroup({
      field: 'planPrice',
      header: '納価',
      decimals: PLAN_DETAIL_DIGITS.price,
      headerTooltip:
        '納価-計画[条件分岐]固定マージン率：[入力値]、固定NET(ギフト以外)：[入力無し]、固定NET(ギフト/特殊商品)：[入力値]、取引制度外：[入力値]',
      width: 80,
      isPercent: false,
      // 特殊商品・ギフトのみ変更後を入力可（その他は非活性）
      editable: makeEditable(['特殊商品', 'ギフト']),
      afterStyle: makeCellStyleWithRedNegative(
        { 特殊商品: 'yellow', ギフト: 'yellow' },
        'gray'
      ),
      // シミュレーション更新KEYが同じ明細があれば変更できない（VL-04）
      afterValueSetter: napaValueSetter,
      // 特殊商品・ギフトの納価変更時にマージン率（変更後）を再計算
      onAfterCellChange: (params: any) => recomputeDerived(params.data),
    }),
    makeComparisonGroup({
      field: 'price',
      header: '売価',
      // 売価は整数のみ入力可
      integerOnly: true,
      decimals: PLAN_DETAIL_DIGITS.amount,
      headerTooltip:
        '売価[入力値/自動表示]前年同月実績値を取得表示（手入力可）',
      width: 80,
      isPercent: false,
      // 全区分で変更後を入力可（活性）
      editable: allEditable,
      afterStyle: yellowCellStyleWithRedNegative,
      // 売価変更で値入率・社外売上高（算出値）を再計算
      onAfterCellChange: (params: any) => recomputeDerived(params.data),
    }),
    {
      // マージン率は変更前/変更後/増減に分けず1列で表示（算出値・全区分で入力不可）。
      // 値＝(納価−NET)/納価×100。
      headerName: 'マージン率',
      headerTooltip: 'マージン率[算出](納価-NET)/納価*100%',
      field: 'margin',
      ...GRID_NUMBER_TEXT_FILTER,
      width: 88,
      cellClass: 'ag-cell-right',
      cellStyle: whiteCellStyleWithRedNegative,
      editable: false,
      // マージン率＝小数第2位（％）
      valueFormatter: planRateFormatter(PLAN_DETAIL_DIGITS.marginRate),
    },
    {
      // ギフト=白（算出値）、その他=グレー（入力不可）
      headerName: '値入率',
      headerTooltip: '値入率[算出](売価-納価)/売価*100%',
      field: 'discount',
      ...GRID_NUMBER_TEXT_FILTER,
      width: 80,
      cellClass: 'ag-cell-right',
      cellStyle: makeCellStyleWithRedNegative({ ギフト: 'white' }, 'gray'),
      // 値入率＝小数第1位（％）
      valueFormatter: planRateFormatter(PLAN_DETAIL_DIGITS.rate),
    },
    {
      headerName: '管理利益額',
      field: 'managementProfitAmount',
      ...GRID_NUMBER_TEXT_FILTER,
      width: 96,
      cellClass: 'ag-cell-right',
      cellStyle: whiteCellStyleWithRedNegative,
      editable: false,
      // 管理利益額＝整数
      valueFormatter: planAmountFormatter(PLAN_DETAIL_DIGITS.amount),
    },
    {
      headerName: '管理利益率',
      field: 'managementProfitRate',
      ...GRID_NUMBER_TEXT_FILTER,
      width: 96,
      cellClass: 'ag-cell-right',
      cellStyle: whiteCellStyleWithRedNegative,
      editable: false,
    },
    {
      headerName: '売上高',
      field: 'netSales',
      ...GRID_NUMBER_TEXT_FILTER,
      width: 96,
      cellClass: 'ag-cell-right',
      cellStyle: whiteCellStyleWithRedNegative,
      editable: false,
      // 売上高＝整数
      valueFormatter: planAmountFormatter(PLAN_DETAIL_DIGITS.amount),
    },
    {
      headerName: '社外売上高',
      headerTooltip: '社外売上高[算出]社外売単価×入数×函数(計画)',
      field: 'externalSales',
      ...GRID_NUMBER_TEXT_FILTER,
      width: 96,
      cellClass: 'ag-cell-right',
      cellStyle: whiteCellStyleWithRedNegative,
      editable: false,
      // 社外売上高＝整数
      valueFormatter: planAmountFormatter(PLAN_DETAIL_DIGITS.amount),
    },
    {
      headerName: '拡売費①',
      openByDefault: true,
      children: makeExpenseColumns('exp1'),
    },
    {
      headerName: '拡売費②',
      openByDefault: true,
      children: makeExpenseColumns('exp2'),
    },
    {
      headerName: '',
      // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
      suppressColumnsToolPanel: true,
      colId: 'actions',
      width: 80,
      pinned: 'right',
      lockPinned: true,
      cellClass: 'ag-cell-center',
      sortable: false,
      filter: false,
      resizable: false,
      // 右固定列は rowSpan が効かないため結合はしない（rowSpan:1）。
      // 代わりにセット中央行(_giftMiddle)にのみアイコンを描画し、内部罫線を消して
      // 1セットに結合されたように見せる（下記 cellClassRules / CSS）。
      rowSpan: () => 1,
      cellClassRules: {
        // ギフトのセット内部の横罫線を消す
        'gift-actions': (p: any) => p.data?.section === 'ギフト',
        // セット最終行(下旬)のみ下罫線を出してセット境界を示す
        'gift-actions-bottom': (p: any) =>
          p.data?.section === 'ギフト' && !!p.data?._giftLast,
      },
      cellRenderer: (params: ICellRendererParams) => {
        if (params.data._isHeader) return null;
        if (params.node.rowPinned) return null;

        // ギフトは3行1セット。編集・コピー・削除はセット単位で行う。
        // アイコンはセット中央行(中旬)にのみ描画し、3行を結合した中央に1つ表示する（10/27 第4回 決定事項24）。
        const isGift = params.data.section === 'ギフト';
        if (isGift && !params.data._giftMiddle) return null;

        const handleDelete = () => {
          params.context.onDeleteRow(params.data);
        };

        const handleCopyForPane = () => {
          // ギフトも他区分と同様にコピーする（セット単位で3行まとめて複製する）
          params.context.onCopyForPane(params.data);
        };

        // NET固定の定番商品は一般卸メッシュ単位のため、シミュレーションの入力対象外
        //（補足5-2）。計画詳細(NET固定)と同様に、行のコピー・削除をいずれも不可とする。
        const isRegularProduct =
          params.data.section === '定番商品' ||
          params.data.productCategory === '定番商品';
        // 確度が反映済の行もコピー・削除を非活性にする
        const isActionDisabled =
          isRegularProduct || params.data.probability === '反映済';

        return (
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={isActionDisabled ? undefined : handleCopyForPane}
              disabled={isActionDisabled}
              className={`p-1 rounded transition-colors ${
                isActionDisabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-green-600 hover:text-green-800 hover:bg-green-50 focus:ring-2 focus:ring-green-500 focus:outline-none'
              }`}
              aria-label={`${params.data.summaryProduct}をコピー`}
              title={isRegularProduct ? '定番商品はコピーできません' : 'コピー'}
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={isActionDisabled ? undefined : handleDelete}
              disabled={isActionDisabled}
              className={`p-1 rounded transition-colors ${
                isActionDisabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-red-600 hover:text-red-800 hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:outline-none'
              }`}
              aria-label={`${params.data.summaryProduct}を削除`}
              title={isRegularProduct ? '定番商品は削除できません' : '削除'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  return columnDefs;
};
