// sim(マージン率固定)：明細表の列の定義。画面の状態・処理は引数で受け取る。
// 明細表は最初の描画で1回だけ作る（これまでの useMemo(…, []) と同じ。値は ref から読む）。

import type { MutableRefObject } from 'react';
import { ColDef, ColGroupDef, ICellRendererParams } from 'ag-grid-community';
import { Trash2, Copy } from 'lucide-react';

import { campaignComboOptions } from '@/app/utils/sales-plan/simulation/simulationCampaignName';
import {
  formatEmptyAsDash,
  useChangedCells,
  useLinkedCellUndo,
  copySourceLeftBorder,
  GRID_NUMBER_TEXT_FILTER,
  GRID_MONTH_TEXT_FILTER,
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
import {
  PROMOTION_NONE_LABEL,
  CATEGORY_LABELS_MARGIN,
} from '@/app/constants/promotionCategories';

import { planDetailCodeColumns } from '@/app/components/shared/sales-plan/common/planDetailCodeColumns';

import type { ProductData } from '@/app/types/simulation';

import { DERIVED_FIELDS, CAMPAIGN_OPTIONS } from './constants';
import {
  isNetInputRow,
  usesNetAsKey,
  computeDerived,
  parseMetric,
} from './utils';
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
    recomputeDerived: computeDerived,
    usesNetAsKey,
    derivedFields: DERIVED_FIELDS,
  });

  // ヘッダー/合計行以外は全て編集可（売価・マージン率の既存ルールに準拠）
  const allEditable = (params: any) =>
    !params.data?._isHeader && !params.node?.rowPinned;
  // 固定マージン率モード：納価（変更後）から NET・マージン率（変更後）を再計算する。
  // NET = 納価 − 納価 × マージン率(固定＝変更前) ÷ 100、マージン率 = (納価−NET)/納価 × 100。
  // 算出列を販売計画表（補足2-1/補足3-1）と同様に動的算出する。
  //   NET      = 納価 − 納価 × マージン率/100（固定マージン率）
  //   マージン率 = (納価 − NET) / 納価 × 100
  //   値入率    = (売価 − 納価) / 売価 × 100
  //   社外売上高 = 売価 × 入数 × 函数 ／ 売上高 = NET × 入数 × 函数
  //   管理利益額 = 売上高 − 拡売費(①+②) ／ 管理利益率 = 管理利益額/売上高×100
  // 算出は補足2-1 パターン対応の共通 computeDerived（モジュール）へ委譲。
  const recomputeDerived = (data: any) => computeDerived(data);
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
    // 変更後が算出値（入力不可）か。NET・マージン率は固定マージン率から算出する。
    computed?: boolean;
    // 変更後セル編集後の追加処理（納価変更時に NET・マージン率を再計算）。
    onAfterCellChange?: (p: any) => void;
    // 変更後セルの valueSetter を差し替える（納価の同一値制御などに使用）。
    afterValueSetter?: (p: any) => boolean;
    // ギフト3行1セットで結合対象外にするか（計画函数は期間ごとに値が異なるため true）。
    unmerge?: boolean;
    // 変更後セルを整数のみ入力可にする（計画函数・売価）。
    integerOnly?: boolean;
  }): ColDef[] => {
    const suffix = m.childSuffix ?? '';
    // ギフト結合対象外の指標は各行で表示（rowSpan を常に1で上書き）。
    const rowSpanOverride = m.unmerge ? { rowSpan: () => 1 } : {};
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
    // 算出列（NET・マージン率）は入力不可のため、エディタ・セッターは付与しない
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
        ...rowSpanOverride,
        valueFormatter: decimalFormatter ?? formatEmptyAsDash,
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
        ...rowSpanOverride,
        valueGetter: makeDeltaGetter(m.field, m.isPercent, m.decimals),
        cellRenderer: DeltaCell,
      },
    ];
  };
  // 1指標 → 「変更前/変更後/増減/AF」を子に持つ列グループ
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
    // ギフト3行1セットで結合対象外にするか（計画函数のみ true）。
    unmerge?: boolean;
    // 変更後セルを整数のみ入力可にする（計画函数・売価）。
    integerOnly?: boolean;
  }) => ({
    headerName: m.header,
    headerTooltip: m.headerTooltip,
    marryChildren: true,
    // 既定で変更前/増減/AFを展開表示（グループの＋/−で折りたたみ可能）
    openByDefault: true,
    children: makeComparisonChildren(m),
  });

  // NET（変更後）：補足2-1 のNET入力パターン(Pattern B)のみ活性。
  // 固定マージン率(Pattern A)と、取引制度を判定できない行は非活性。
  const netEditable = (params: any) =>
    allEditable(params) && isNetInputRow(params.data);

  // NET（変更後）セルのスタイル：Pattern B=黄（活性）、それ以外=グレー（非活性）。
  const netAfterStyle = (params: any) => {
    if (params.data?._isHeader || params.node?.rowPinned) return undefined;
    return isNetInputRow(params.data)
      ? yellowCellStyleWithRedNegative(params)
      : whiteCellStyleWithRedNegative(params);
  };

  // コード値・区分値の列（PJルール：名称と別列で保持。既定は非表示で列メニューから表示できる。
  // 初期表示は基本設計で業務側が項目ごとに決める）。計画詳細と同じ列定義を使う。
  const codeColumns = planDetailCodeColumns(whiteCellStyle);

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
      // 合計行は対象年月＋企画（先頭の列）を結合して「合計」と表示
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
      // 合計行は企画名～サマリ商品名（スクロール列）を結合（表示は空欄）
      colSpan: (params: any) => (params.node?.rowPinned ? 7 : 1),
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
      // 商品区分：全区分を活性（編集可＝白／変更後は黄）。ギフトは3行1セットの先頭セルで結合表示する。
      cellStyle: yellowCellStyle,
      editable: baseEditable,
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: {
        // ギフトを含む全区分から選択できる（ギフト⇄他区分の変更も可）。
        comboOptions: CATEGORY_LABELS_MARGIN.map((value) => ({
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
      // 全区分=グレー（非活性・自動表示）。特殊商品/ギフトは区分名で固定表示。
      headerName: '販促区分',
      field: 'promotion',
      width: 144,
      cellClass: 'ag-cell-left',
      cellStyle: whiteCellStyle,
      // 読み取り専用（自動表示）のため editor 設定は持たない。
      editable: false,
      // 特殊商品/ギフトは販促区分を区分名で固定表示（データ値に依存しない）
      valueFormatter: (params: any) =>
        params.data?.productCategory === '特殊商品'
          ? PROMOTION_NONE_LABEL
          : params.data?.productCategory === 'ギフト'
            ? 'ギフト'
            : (params.value ?? ''),
      headerTooltip: '販促区分[自動表示]サマリ商品に紐づく販促区分を取得表示',
    },
    {
      headerName: 'メタブランド',
      field: 'metaBrand',
      width: 112,
      cellClass: 'ag-cell-left',
      cellStyle: whiteCellStyle,
      filter: true,
      headerTooltip:
        'メタブランド[自動表示]サマリ商品に紐づくメタブランドを取得表示',
    },
    {
      headerName: '容器容量G',
      field: 'containerCapacityG',
      width: 112,
      cellClass: 'ag-cell-left',
      cellStyle: whiteCellStyle,
      filter: true,
      headerTooltip: '容器容量G[自動表示]サマリ商品に紐づく容器容量Gを取得表示',
    },
    {
      // 定番商品/新商品/特殊/ギフト=黄（セレクトボックス）
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
    // コード値・区分値の列（PJルール：名称と別列で保持。既定は非表示で列メニューから表示できる）
    codeColumns.metaBrandCode,
    codeColumns.containerCapacityCode,
    codeColumns.summaryProductCode,
    {
      // 販売期間：入数の左隣に配置。非活性（グレー）。
      // ギフトは上旬/中旬/下旬の3行1セットで自動表示（field:'period'）。
      // セル結合対象外（行ごとに表示）のため rowSpan は常に1。
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
      headerTooltip: '入数[自動表示]サマリ商品に紐づく入数を取得表示',
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
      // ギフトは上旬/中旬/下旬で計画(箱数)が異なるためセル結合対象外
      unmerge: true,
      // 函数変更で社外売上高・売上高・管理利益（算出値）を再計算
      onAfterCellChange: (params: any) => recomputeDerived(params.data),
    }),
    makeComparisonGroup({
      field: 'net',
      header: 'NET',
      decimals: PLAN_DETAIL_DIGITS.price,
      headerTooltip: 'NET[自動表示]固定マージン率：納価-納価*マージン率',
      width: 84,
      isPercent: false,
      // 補足2-1：NET入力パターンのみ活性、固定マージン率パターンは算出・非活性
      editable: netEditable,
      afterStyle: netAfterStyle,
      // シミュレーション更新KEYが同じ明細があれば変更できない（VL-04）
      afterValueSetter: netValueSetter,
      onAfterCellChange: (params: any) => recomputeDerived(params.data),
    }),
    makeComparisonGroup({
      field: 'planPrice',
      header: '納価',
      decimals: PLAN_DETAIL_DIGITS.price,
      headerTooltip:
        '納価-計画[入力値]固定マージン率：前年同月実績を初期表示し手入力',
      width: 80,
      isPercent: false,
      // 納価は両パターンとも活性
      editable: allEditable,
      afterStyle: yellowCellStyleWithRedNegative,
      // シミュレーション更新KEYが同じ明細があれば変更できない（VL-04）
      afterValueSetter: napaValueSetter,
      // 納価変更で NET・マージン率・値入率・社外売上高等（算出値）を再計算
      onAfterCellChange: (params: any) => recomputeDerived(params.data),
    }),
    makeComparisonGroup({
      field: 'price',
      header: '売価',
      // 売価は整数のみ入力可
      integerOnly: true,
      decimals: PLAN_DETAIL_DIGITS.amount,
      headerTooltip:
        '売値[入力値/自動表示]前年同月実績値を取得表示（手入力可）',
      width: 80,
      isPercent: false,
      editable: allEditable,
      afterStyle: yellowCellStyleWithRedNegative,
      // 売価変更で値入率・社外売上高（算出値）を再計算
      onAfterCellChange: (params: any) => recomputeDerived(params.data),
    }),
    {
      // マージン率は変更前/変更後/増減に分けず1列で表示（算出値・入力不可）。
      // 値＝固定マージン率（(納価−NET)/納価×100）。
      headerName: 'マージン率',
      headerTooltip:
        'マージン率[条件分岐]固定マージン率：[自動表示]固定マージン率設定値を取得表示、NET入力：[算出](納価-NET)/納価*100%',
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
      headerTooltip: '社外売上高[算出]社外売単価×入数×計画函数(SIM値)',
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

        // ギフトは3行1セット。コピー・削除はセット単位で行う。
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

        // 確度が反映済の行はコピー・削除を非活性にする（編集アイコンは廃止し、コピー・削除のみ）
        const isReflected = params.data.probability === '反映済';

        return (
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={isReflected ? undefined : handleCopyForPane}
              disabled={isReflected}
              className={`p-1 rounded transition-colors ${
                isReflected
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-green-600 hover:text-green-800 hover:bg-green-50 focus:ring-2 focus:ring-green-500 focus:outline-none'
              }`}
              aria-label={`${params.data.summaryProduct}をコピー`}
              title="コピー"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={isReflected ? undefined : handleDelete}
              disabled={isReflected}
              className={`p-1 rounded transition-colors ${
                isReflected
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-red-600 hover:text-red-800 hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:outline-none'
              }`}
              aria-label={`${params.data.summaryProduct}を削除`}
              title="削除"
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
