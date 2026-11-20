// 計画詳細(NET固定)：明細表の列の定義。明細表の状態・処理は引数で受け取る。
// 明細表は最初の描画で1回だけ作る（これまでの useMemo(…, []) と同じ。値は ref から読む）。

import { ColDef, ColGroupDef, ICellRendererParams } from 'ag-grid-community';
import { Trash2, Copy } from 'lucide-react';

import {
  GRID_COLORS,
  changedCellStyle,
  formatEmptyAsDash,
  useFormulaSourceHighlight,
  copySourceLeftBorder,
  GRID_NUMBER_TEXT_FILTER,
  GRID_MONTH_TEXT_FILTER,
  useChangedCells,
  useLinkedCellUndo,
  RowActionMenu,
} from '@/components/grid';
import {
  GRID_EMPTY_TEXT,
  parseFormulaNumber,
} from '@/components/grid/gridCommon';

import { NO_DELIVERY_PRICE_NOTE } from '@/constants/aggregationTree';
import { planDetailCodeColumns } from '@/features/sales-plan/shared/common/planDetailCodeColumns';

import { MonthYearCellEditor } from '@/components/ui/month-year-cell-editor';
import {
  SingleComboboxCellEditor,
  toComboOptions,
} from '@/components/ui/single-combobox-cell-editor';
import { hasPriorYearActual } from '@/utils/sales-plan/plan-detail/nonProductExpenseRow';

import { SAMPLE_STORES } from '@/mocks/sales-plan/plan-detail-net-fixed';
import type { ProductData } from '@/types/salesPlanWholesale';
import { firstStoreCode, thirdStoreCode } from '@/mocks/common/storeTier';
import { CATEGORY_LABELS_NET_ADDABLE } from '@/constants/promotionCategories';
import { getPromotionLabels } from '@/utils/sales-plan/common/promotionCategories';
import {
  SUMMARY_PRODUCT_BY_VALUE,
  SUMMARY_PRODUCT_VALUES,
  WHOLESALE_MESH_BY_VALUE,
  WHOLESALE_MESH_VALUES,
  SUMMARY_PRODUCT_BY_WHOLESALE_MESH,
} from '@/constants/productMasters';
import {
  promotionComboOptions,
  summaryProductComboOptions,
} from '@/constants/comboFieldOptions';

import {
  PLAN_DETAIL_DIGITS,
  planAmountFormatter,
  planCountFormatter,
  planRateFormatter,
  planNumberParser,
} from '@/utils/sales-plan/common/planDetailNumberFormat';
import { currentMonthEstimate } from '@/utils/sales-plan/plan-detail/currentMonthEstimate';

import { GIFT_LIKE_CALC_FIELDS, SUMMARY_MASTER_FIELDS } from './constants';
import { ediValueOf, recalcGiftLikeRates, linkedRowKeyOf } from './utils';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';

// 明細表から受け取る状態・処理
interface DetailColumnDeps {
  formulaHL: ReturnType<typeof useFormulaSourceHighlight<ProductData>>;
  isCellChanged: ReturnType<typeof useChangedCells>['isCellChanged'];
  makeHandler: ReturnType<typeof useLinkedCellUndo<ProductData>>['makeHandler'];
  parseNumber: (value: string | number | undefined | null) => number;
  syncRowBySection: (row: ProductData) => void;
}

export const buildDetailColumnDefs = ({
  formulaHL,
  isCellChanged,
  makeHandler,
  parseNumber,
  syncRowBySection,
}: DetailColumnDeps): (ColDef | ColGroupDef)[] => {
  // Yellow: 手入力可能セル（編集後は黄色＋オレンジ枠で強調 / gridStyles準拠）
  // 定番商品の行か（NET固定は一般卸メッシュ単位のため商品区分を変更できない）。
  const isRegularProductRow = (params: any) =>
    params.data?.section === '定番商品' ||
    params.data?.productCategory === '定番商品';

  const yellowCellStyle = (params: any) => {
    if (params.data?._isHeader || params.node?.rowPinned) return undefined;
    const base = { backgroundColor: GRID_COLORS.editable, cursor: 'pointer' };
    return isCellChanged(params) ? { ...base, ...changedCellStyle() } : base;
  };

  // White: 自動表示・参照セル
  const whiteCellStyle = (params: any) => {
    if (params.data?._isHeader || params.node?.rowPinned) return undefined;
    return { backgroundColor: GRID_COLORS.readonly };
  };

  // 一次店/三次店 のサンプル（モック行に値が無い場合のフォールバック表示用）

  // 行インデックスから決定的にサンプル店舗を割り当てる
  const sampleStore = (node: any) => {
    const idx =
      typeof node?.rowIndex === 'number' && node.rowIndex >= 0
        ? node.rowIndex
        : 0;
    return SAMPLE_STORES[idx % SAMPLE_STORES.length];
  };

  // 一次店/三次店 セルの値取得（実データ優先・無ければサンプル）
  const storeValueGetter = (key: 'tier1' | 'tier3') => (params: any) => {
    if (params.data?._isHeader || params.node?.rowPinned) return '';
    return params.data?.[key] || sampleStore(params.node)[key];
  };

  // 一次店コード/三次店コード セルの値取得。表示中の店舗名から共通マスタのコードを引く
  // （基本情報エリアの「コード:名称」表示と同じ src/mocks/common/storeTier を参照）。
  const storeCodeValueGetter = (key: 'tier1' | 'tier3') => (params: any) => {
    const name = storeValueGetter(key)(params);
    if (!name) return '';
    return key === 'tier1' ? firstStoreCode(name) : thirdStoreCode(name);
  };

  // 行ID由来の決定的シード（並び替え・絞り込みでも安定する擬似ランダム種）。
  const rowSeed = (params: any) => {
    const id = params.data?.id;
    if (typeof id === 'string') {
      let h = 0;
      for (let i = 0; i < id.length; i += 1)
        h = (h * 31 + id.charCodeAt(i)) | 0;
      return Math.abs(h);
    }
    const idx = params.node?.rowIndex;
    return typeof idx === 'number' && idx >= 0 ? idx : 0;
  };

  // 終売区分のダミー値（決定的擬似ランダムなYYYY/MM）。一部行はデータなし（ー表示）。
  const endSaleDummy = (params: any) => {
    if (params.data?._isHeader || params.node?.rowPinned) return '';
    if (params.data?.endSale) return params.data.endSale;
    const s = rowSeed(params);
    if (s % 7 === 0) return ''; // 一部はデータなし（ー）
    return `${2025 + (s % 3)}/${String((s % 12) + 1).padStart(2, '0')}`;
  };

  // EDI反映は withRowId で固定値（data.ediPrice）を設定済み（定番商品・新商品はー）。
  const ediDummy = (params: any) => {
    if (params.node?.rowPinned) return '';
    return ediValueOf(params.data);
  };

  // NET・納価（計画／EDI反映／前年実績）は単価のため合計行では集計せず「-」を表示する（課題1758）。
  const priceFormatterExceptTotal = (params: any) =>
    params.node?.rowPinned
      ? GRID_EMPTY_TEXT
      : planAmountFormatter(PLAN_DETAIL_DIGITS.price)(params);

  // 入数・売価も合計行では集計せず「-」を表示する（課題1758）。
  const countFormatterExceptTotal = (params: any) =>
    params.node?.rowPinned ? GRID_EMPTY_TEXT : planCountFormatter(params);
  const amountFormatterExceptTotal = (params: any) =>
    params.node?.rowPinned
      ? GRID_EMPTY_TEXT
      : planAmountFormatter(PLAN_DETAIL_DIGITS.amount)(params);

  // 納価-計画セルのスタイル：EDI反映との差異が±1.00以上なら赤字・太字で強調。
  // 強調しない場合は元のスタイル（baseStyleFn）をそのまま返す。
  const withEdiDiffHighlight =
    (baseStyleFn: (p: any) => any) => (params: any) => {
      const base = baseStyleFn(params) || {};
      if (params.data?._isHeader || params.node?.rowPinned) return base;
      const plan = parseNumber(params.data?.planPrice);
      const ediStr = ediDummy(params);
      const edi = parseNumber(ediStr);
      if (ediStr !== '' && plan > 0 && Math.abs(plan - edi) >= 1.0) {
        return { ...base, color: GRID_COLORS.overText, fontWeight: 'bold' };
      }
      return base;
    };

  // 商品区分ごとに背景色を切り替えるファクトリ
  const makeCellStyle =
    (
      rules: Record<string, 'yellow' | 'white' | 'gray'>,
      defaultStyle: 'yellow' | 'white' | 'gray' = 'white'
    ) =>
    (params: any) => {
      if (params.data?._isHeader || params.node?.rowPinned) return undefined;
      const cat: string = params.data?.productCategory ?? '';
      const style = rules[cat] ?? defaultStyle;
      if (style === 'yellow') {
        const base = {
          backgroundColor: GRID_COLORS.editable,
          cursor: 'pointer',
        };
        return isCellChanged(params)
          ? { ...base, ...changedCellStyle() }
          : base;
      }
      if (style === 'gray') return { backgroundColor: GRID_COLORS.readonly };
      return { backgroundColor: GRID_COLORS.readonly };
    };

  // 指定商品区分のみ編集可能にするファクトリ
  const makeEditable = (categories: string[]) => (params: any) => {
    if (params.data?._isHeader || params.node?.rowPinned) return false;
    return categories.includes(params.data?.productCategory ?? '');
  };

  // 列定義

  // コード値・区分値の列（名称列から値を引く・既定は非表示）
  const codeColumns = planDetailCodeColumns(whiteCellStyle, {
    // 定番商品は一般卸メッシュ粒度のためサマリ商品名は「-」（コードも出さない）
    isWithoutSummaryProduct: (d) => d.productCategory === '定番商品',
  });

  const columnDefs: (ColDef | ColGroupDef)[] = [
    {
      headerName: 'メタブランド',
      field: 'metaBrand',
      width: 112,
      cellClass: 'ag-cell-left-pinned',
      cellStyle: (params: any) => ({
        ...(whiteCellStyle(params) || {}),
        ...copySourceLeftBorder(params.data?._copySource),
      }),
      filter: true,
      // 合計行は先頭の列（メタブランド・容器容量G・サマリ商品名・一般卸メッシュ）を結合して「合計」表示
      colSpan: (params: any) => (params.node?.rowPinned ? 4 : 1),
      headerTooltip:
        'メタブランド[自動表示]サマリ商品/一般卸メッシュに紐づくメタブランドを取得表示',
    },
    {
      headerName: '容器容量G',
      field: 'containerCapacityG',
      width: 112,
      cellClass: 'ag-cell-left-pinned',
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
      cellClass: 'ag-cell-left-pinned',
      // サマリ商品名：商品区分が定番商品を除き全行を活性（編集可・黄）。定番商品のみ非活性（グレー）。
      cellStyle: makeCellStyle({ 定番商品: 'gray' }, 'yellow'),
      editable: (params) =>
        !params.data?._isHeader &&
        !params.node?.rowPinned &&
        params.data?.productCategory !== '定番商品',
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: {
        // 明細追加フォームと同一の共通マスタ（サマリ商品名）から選択肢を生成
        comboOptions: summaryProductComboOptions(SUMMARY_PRODUCT_VALUES),
        placeholder: 'サマリ商品名を選択',
      },
      cellEditorPopup: true,
      filter: true,
      headerTooltip: 'サマリ商品[自動表示]前年同月実績のサマリ商品を取得表示',
      // 定番商品は一般卸メッシュを使用するためサマリ商品名は「-」で表示
      valueFormatter: (params: any) =>
        params.data?.productCategory === '定番商品'
          ? '-'
          : (params.value ?? ''),
      // サマリ商品名選択時、共通マスタから
      // メタブランド／容器容量G／一般卸メッシュ／入数／当月実績／前年実績を
      // 自動補完する（明細追加と同一挙動。実績系はサマリ商品に紐づく前年同月実績値）。
      // 当月着地見込は算出値のため補完対象外（従来どおり計算式で算出）。
      // サマリ商品名は社外売上高・売上原価の算出元でもあるため recalcGiftLikeRates で追従させる。
      // 連動セルは共通フックで反映し、Ctrl+Z 1回で主セルごと戻る（→ 02 §7.3）。
      // 定番商品はサマリ商品名を編集できないため、state 同期は従来どおり定番商品以外のみ。
      onCellValueChanged: makeHandler('summaryProduct', {
        depFields: [...SUMMARY_MASTER_FIELDS, ...GIFT_LIKE_CALC_FIELDS],
        deriveDeps: (value, row) => {
          const master = SUMMARY_PRODUCT_BY_VALUE.get(value);
          return recalcGiftLikeRates({
            ...row,
            ...(master
              ? {
                  metaBrand: master.metaBrand,
                  containerCapacityG: master.containerCapacityG,
                  wholesaleMesh: master.wholesaleMesh,
                  quantity: master.quantity,
                  actual: master.currentActual,
                  prevYear: master.prevYearActual,
                }
              : {}),
          });
        },
        syncState: (row) => {
          if (row.section !== '定番商品') syncRowBySection(row);
        },
        rowIdOf: linkedRowKeyOf(['plan', 'net', 'planPrice', 'price']),
      }),
    },
    {
      // 定番商品=黄（セレクトボックス）、新商品=白、特殊商品=グレー（不使用）、ギフト=白（自動表示）
      headerName: '一般卸メッシュ',
      field: 'wholesaleMesh',
      width: 88,
      cellClass: 'ag-cell-left-pinned',
      // 一般卸メッシュは全区分で非活性（自動表示）。定番商品も編集不可（グレー）。
      cellStyle: makeCellStyle({
        定番商品: 'gray',
        新商品: 'white',
        特殊商品: 'gray',
        ギフト: 'white',
      }),
      editable: false,
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: {
        // 共通マスタ（一般卸メッシュ）から選択肢を生成
        comboOptions: toComboOptions(WHOLESALE_MESH_VALUES),
        placeholder: '一般卸メッシュを選択',
      },
      cellEditorPopup: true,
      filter: true,
      headerTooltip:
        '一般卸メッシュ[自動表示]前年同月実績の一般卸メッシュを取得表示',
      onCellValueChanged: (params) => {
        // 定番商品で一般卸メッシュ選択時、共通マスタから
        // メタブランド／容器容量G／入数／当月実績／前年実績を、
        // 対応するサマリ商品名を自動補完する（実績系はメッシュに紐づく前年同月実績値）。
        // 当月着地見込は算出値のため補完対象外（従来どおり計算式で算出）。
        // 一般卸メッシュは社外売上高・売上原価の算出元でもあるため recalcGiftLikeRates で追従させる。
        const mesh = WHOLESALE_MESH_BY_VALUE.get(params.newValue);
        const summary = SUMMARY_PRODUCT_BY_WHOLESALE_MESH.get(params.newValue);
        const updatedData = recalcGiftLikeRates({
          ...params.data,
          wholesaleMesh: params.newValue,
          ...(mesh
            ? {
                metaBrand: mesh.metaBrand,
                containerCapacityG: mesh.containerCapacityG,
                quantity: mesh.quantity,
                actual: mesh.currentActual,
                prevYear: mesh.prevYearActual,
              }
            : {}),
          ...(summary ? { summaryProduct: summary.value } : {}),
        });
        // 連動項目をグリッド表示へ反映（上記サマリ商品名編集と同様）。
        Object.assign(params.data, updatedData);
        if (params.node)
          params.api.refreshCells({ rowNodes: [params.node], force: true });
        if (params.data.section === '定番商品') {
          params.context.updateRegularProduct(updatedData);
        }
      },
    },
    // コード値・区分値の列（PJルール：名称と別列で保持。既定は非表示で列メニューから表示できる）
    codeColumns.metaBrandCode,
    codeColumns.containerCapacityCode,
    codeColumns.summaryProductCode,
    codeColumns.wholesaleMeshCode,
    {
      // 終売区分：商品区分によらず全行を非活性（グレー）。
      // 中身はランダムなYYYY/MM（一部はデータなし＝ー表示）。
      headerName: '終売区分',
      field: 'endSale',
      ...GRID_MONTH_TEXT_FILTER,
      width: 88,
      cellClass: 'ag-cell-left',
      cellStyle: whiteCellStyle,
      editable: false,
      valueGetter: (params: any) =>
        params.node?.rowPinned
          ? ''
          : params.data?.productCategory === '定番商品'
            ? ''
            : endSaleDummy(params),
      // 合計行はスクロール列（終売区分～販売期間）を結合（表示は空欄）
      colSpan: (params: any) => (params.node?.rowPinned ? 4 : 1),
      valueFormatter: (params: any) =>
        params.node?.rowPinned ? '' : formatEmptyAsDash(params),
      // 終売区分はカレンダー（年月）入力。グリッドは MonthYearCellEditor を popup 表示する
      cellEditor: MonthYearCellEditor,
      cellEditorPopup: true,
      headerTooltip:
        '終売区分[自動表示]サマリ商品/一般卸メッシュに紐づく終売予定年月（YYYY/MM）を取得表示',
      onCellValueChanged: (params) => {
        const updatedData = {
          ...params.data,
          endSale: params.newValue,
        };
        if (params.data.section === 'ギフト') {
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
      // 定番商品は一般卸メッシュ単位で新規追加が発生しないため（補足5-2）、
      // 選択肢から外し、既存の定番商品行はグレーアウトして非活性にする。
      // （計画函数・納価・売価は補足5-1のとおり定番商品でも入力できる）
      cellStyle: (params: any) =>
        isRegularProductRow(params)
          ? whiteCellStyle(params)
          : yellowCellStyle(params),
      editable: (params: any) =>
        !params.data?._isHeader &&
        !params.node?.rowPinned &&
        !isRegularProductRow(params),
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
      // 販促区分：特殊商品・ギフトは区分名で固定のため非活性（グレー・編集不可）、他区分は活性（黄）。
      headerName: '販促区分',
      field: 'promotion',
      width: 144,
      cellClass: 'ag-cell-left',
      cellStyle: makeCellStyle({ 特殊商品: 'gray', ギフト: 'gray' }, 'yellow'),
      editable: (params: any) =>
        !params.data?._isHeader &&
        !params.node?.rowPinned &&
        params.data?.productCategory !== '特殊商品' &&
        params.data?.productCategory !== 'ギフト',
      cellEditor: SingleComboboxCellEditor,
      cellEditorParams: (params: any) => {
        const cat = params.data?.productCategory ?? '';
        return {
          comboOptions: promotionComboOptions(
            cat === '特殊商品' ? ['特殊商品'] : getPromotionLabels(cat)
          ),
          placeholder: '販促区分を選択',
        };
      },
      // 特殊商品は選択肢データが無いため「特殊商品」を表示（それ以外は入力値）
      valueFormatter: (params: any) =>
        params.data?.productCategory === '特殊商品'
          ? '特殊商品'
          : (params.value ?? ''),
      cellEditorPopup: true,
      headerTooltip:
        '販促区分[自動表示]サマリ商品/一般卸メッシュに紐づく販促区分を取得表示',
    },
    {
      // ギフトは上旬/中旬/下旬の3行1セット。販売期間は全区分で非活性（グレー・自動表示）。
      // セル結合対象外（行ごとに表示）。
      headerName: '販売期間',
      field: 'period',
      width: 72,
      cellClass: 'ag-cell-left',
      cellStyle: whiteCellStyle,
      rowSpan: () => 1,
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
      // 入数＝整数（3桁区切り）。合計行は空欄。
      valueFormatter: countFormatterExceptTotal,
    },
    {
      headerName: '函数',
      children: [
        {
          // 全区分=黄（手入力）。ギフトも行ごとに計画(箱数)を入力するためセル結合対象外。
          headerName: '計画',
          headerTooltip: '函数-計画[入力値/自動表示]前年同月実績値を取得表示',
          field: 'plan',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 80,
          cellClass: 'ag-cell-right',
          cellStyle: yellowCellStyle,
          rowSpan: () => 1,
          editable: (params) =>
            !params.data._isHeader && !params.node.rowPinned,
          // 函数-計画＝整数（3桁区切り）。函数反映・計画コピーは素の数値を書き込むため
          // 表示側で桁区切りを付ける。
          valueFormatter: planCountFormatter,
          // 整数のみ入力可（小数は入力させない）。
          // cellDataType の自動推論は valueParser を数値型のものへ上書きし、
          // 保持値が number になって集計の文字列処理が壊れるため false で無効化する。
          cellEditor: 'agNumberCellEditor',
          cellEditorParams: { precision: 0 },
          cellDataType: false,
          valueParser: planNumberParser(0),
          // 函数(計画) は社外売上高・売上原価の算出元でもあるため
          // recalcGiftLikeRates で追従させる（連動セルは共通フック → 02 §7.3）。
          onCellValueChanged: makeHandler('plan', {
            depFields: GIFT_LIKE_CALC_FIELDS,
            deriveDeps: (_value, row) => recalcGiftLikeRates(row),
            syncState: syncRowBySection,
            rowIdOf: linkedRowKeyOf([
              'net',
              'planPrice',
              'price',
              'quantity',
              'summaryProduct',
              'wholesaleMesh',
              'metaBrand',
            ]),
          }),
        },
        {
          // 新商品=グレー（非活性）、その他=白（自動表示）
          headerName: '当月着地見込',
          headerTooltip:
            '函数-当月着地見込[算出]当月実績÷当月実績反映日数×当月日数',
          field: 'estimate',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 124,
          cellClass: 'ag-cell-right',
          cellStyle: makeCellStyle({ 新商品: 'gray' }, 'white'),
          // 当月着地見込＝当月実績÷当月実績反映日数×当月日数（算出値）。
          // 合計行（ピン留め）は集計済みの値をそのまま表示する。
          valueGetter: (params) => {
            if (params.node?.rowPinned) return params.data?.estimate ?? '';
            if (params.data?._isHeader) return '';
            const v = currentMonthEstimate(
              parseFormulaNumber(params.data?.actual) || 0,
              params.data?.summaryProduct || params.data?.wholesaleMesh
            );
            return v ? String(v) : '';
          },
          // 算出値のため素の数値が入る。表示側で3桁区切りを付ける。
          valueFormatter: planCountFormatter,
        },
        {
          headerName: '当月実績',
          headerTooltip: '函数-当月実績[自動表示]同年同月実績値を取得表示',
          field: 'actual',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 92,
          cellClass: 'ag-cell-right',
          cellStyle: whiteCellStyle,
          // 函数-当月実績＝整数（3桁区切り）
          valueFormatter: planCountFormatter,
        },
        {
          // 新商品=グレー（非活性）、その他=白（自動表示）
          headerName: '前年実績',
          headerTooltip: '函数-前年実績[自動表示]前年同月実績値を取得表示',
          field: 'prevYear',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 92,
          cellClass: 'ag-cell-right',
          cellStyle: makeCellStyle({ 新商品: 'gray' }, 'white'),
          // 函数-前年実績＝整数（3桁区切り）
          valueFormatter: planCountFormatter,
        },
        {
          // 新商品/ギフト=グレー（非活性）、その他=白（計算項目）
          headerName: '計画/前年実績比',
          headerTooltip: '函数-計画/前年実績比[算出]計画/前年実績*100%',
          field: 'ratio',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 140,
          cellClass: 'ag-cell-right',
          // 計画/前年実績比＝小数第1位（％）
          valueFormatter: planRateFormatter(PLAN_DETAIL_DIGITS.ratio),
          cellStyle: makeCellStyle({ 新商品: 'gray', ギフト: 'gray' }, 'white'),
        },
      ],
    },
    {
      // ギフト/特殊商品=黄（手入力）、その他=グレー（非活性）
      headerName: 'NET',
      headerTooltip:
        'NET[条件分岐]定番商品・新商品：[自動表示]固定NET設定値を取得表示、特殊商品・ギフト：[入力値]前年同月実績値を取得表示',
      field: 'net',
      ...GRID_NUMBER_TEXT_FILTER,
      width: 84,
      cellClass: 'ag-cell-right',
      cellStyle: makeCellStyle(
        { ギフト: 'yellow', 特殊商品: 'yellow' },
        'gray'
      ),
      editable: makeEditable(['ギフト', '特殊商品']),
      cellEditor: 'agTextCellEditor',
      // NET＝小数第2位（入力値も同じ桁へ丸めて保持する）。合計行は空欄。
      valueFormatter: priceFormatterExceptTotal,
      valueParser: planNumberParser(PLAN_DETAIL_DIGITS.price),
      // NET はマージン率等の算出元でもあるため recalcGiftLikeRates で追従させる
      // （連動セルは共通フック → 02 §7.3）。
      onCellValueChanged: makeHandler('net', {
        depFields: GIFT_LIKE_CALC_FIELDS,
        deriveDeps: (_value, row) => recalcGiftLikeRates(row),
        syncState: syncRowBySection,
        rowIdOf: linkedRowKeyOf([
          'plan',
          'planPrice',
          'price',
          'quantity',
          'summaryProduct',
          'wholesaleMesh',
          'metaBrand',
        ]),
      }),
    },
    {
      headerName: '納価',
      children: [
        {
          // 商品区分によらず全区分で手入力可（黄）
          headerName: '計画',
          headerTooltip: '納価-計画[入力値]商品区分・取引制度によらず手入力可',
          field: 'planPrice',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 80,
          cellClass: 'ag-cell-right',
          // EDI反映との差異が±1.00以上なら赤字・太字で強調
          cellStyle: withEdiDiffHighlight(yellowCellStyle),
          editable: (params) =>
            !params.data._isHeader && !params.node.rowPinned,
          cellEditor: 'agTextCellEditor',
          // 納価-計画＝小数第2位（入力値も同じ桁へ丸めて保持する）。合計行は空欄。
          valueFormatter: priceFormatterExceptTotal,
          valueParser: planNumberParser(PLAN_DETAIL_DIGITS.price),
          // 納価(計画) はマージン率・値入率・値入額の算出元でもあるため
          // recalcGiftLikeRates で追従させる（連動セルは共通フック → 02 §7.3）。
          onCellValueChanged: makeHandler('planPrice', {
            depFields: GIFT_LIKE_CALC_FIELDS,
            deriveDeps: (_value, row) => recalcGiftLikeRates(row),
            syncState: syncRowBySection,
            rowIdOf: linkedRowKeyOf([
              'plan',
              'net',
              'price',
              'quantity',
              'summaryProduct',
              'wholesaleMesh',
              'metaBrand',
            ]),
          }),
        },
        {
          headerName: 'EDI反映',
          headerTooltip: '納価-EDI反映[自動表示]EDIの納価を取得表示',
          field: 'ediPrice',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 80,
          cellClass: 'ag-cell-right',
          cellStyle: whiteCellStyle,
          // 空欄行が多いため、擬似ランダムなEDI納価で補完しー表示を減らす
          // （合計行は単価のため集計せず空欄。ediDummy 側で '' を返す）。
          valueGetter: (params: any) => ediDummy(params),
          // 納価-EDI反映＝小数第2位。合計行は空欄。
          valueFormatter: priceFormatterExceptTotal,
        },
        {
          // 新商品/特殊商品/定番商品=グレー（非活性）、その他=白（自動表示）
          headerName: '前年実績',
          headerTooltip: '納価-前年実績[自動表示]前年同月実績値を取得表示',
          field: 'prevYearPrice',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 88,
          cellClass: 'ag-cell-right',
          // 納価-前年実績＝小数第2位。合計行は空欄。
          valueFormatter: priceFormatterExceptTotal,
          cellStyle: makeCellStyle(
            {
              新商品: 'gray',
              特殊商品: 'gray',
              定番商品: 'gray',
            },
            'white'
          ),
        },
      ],
    },
    {
      // 全区分=黄（手入力）
      headerName: '売価',
      headerTooltip:
        '売価[入力値/自動表示]前年同月実績値を取得表示（手入力可）',
      field: 'price',
      ...GRID_NUMBER_TEXT_FILTER,
      width: 80,
      cellClass: 'ag-cell-right',
      cellStyle: yellowCellStyle,
      editable: (params) => !params.data._isHeader && !params.node.rowPinned,
      // 売価＝整数（入力時点で小数を入力させず、保持値も整数へ丸める）。
      // cellDataType の自動推論は valueParser を上書きするため false で無効化する。
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { precision: 0 },
      cellDataType: false,
      valueFormatter: amountFormatterExceptTotal,
      valueParser: planNumberParser(PLAN_DETAIL_DIGITS.amount),
      // 売価は値入率・値入額の算出元でもあるため recalcGiftLikeRates で追従させる
      // （連動セルは共通フック → 02 §7.3）。
      onCellValueChanged: makeHandler('price', {
        depFields: GIFT_LIKE_CALC_FIELDS,
        deriveDeps: (_value, row) => recalcGiftLikeRates(row),
        syncState: syncRowBySection,
        rowIdOf: linkedRowKeyOf([
          'plan',
          'net',
          'planPrice',
          'quantity',
          'summaryProduct',
          'wholesaleMesh',
          'metaBrand',
        ]),
      }),
    },
    {
      // 商品区分によらず全区分で手入力可（黄）。ギフト/特殊商品は算出値を初期表示する。
      // 入力しても他項目は再計算しない（納価・NET・売価を編集した時点で、
      // ギフト/特殊商品のみ recalcGiftLikeRates により算出値へ戻る）。
      headerName: 'マージン率',
      headerTooltip:
        'マージン率[算出/入力値]手入力しない場合は(納価-NET)/納価*100%を算出表示、商品区分によらず手入力での上書きも可',
      field: 'margin',
      ...GRID_NUMBER_TEXT_FILTER,
      width: 88,
      cellClass: 'ag-cell-right',
      // マージン率＝小数第2位（％）
      valueFormatter: planRateFormatter(PLAN_DETAIL_DIGITS.marginRate),
      valueParser: planNumberParser(PLAN_DETAIL_DIGITS.marginRate),
      // 手入力で上書きしたセル（変更済み＝黄＋橙枠）は算出値ではないため、
      // 計算式ツールチップではなく手入力値である旨を表示する。
      // 未変更のセルは従来どおり計算式ツールチップ（共通の tooltipValueGetter）。
      // 合計行は納価が未入力の行を含めずに算出するため、その旨を表示する（課題1758・1815）。
      tooltipValueGetter: (params: any) =>
        params.node?.rowPinned
          ? NO_DELIVERY_PRICE_NOTE
          : isCellChanged(params)
            ? `手入力値（(納価 − NET) ÷ 納価 × 100% の算出値を上書き）\n= ${planRateFormatter(
                PLAN_DETAIL_DIGITS.marginRate
              )(params)}`
            : formulaHL.tooltipValueGetter(params),
      cellStyle: yellowCellStyle,
      editable: (params) => !params.data._isHeader && !params.node.rowPinned,
      cellEditor: 'agTextCellEditor',
      onCellValueChanged: (params) => {
        // 連動再計算はせず、入力値をそのまま行データへ保持する。
        const updatedData = { ...params.data, margin: params.newValue };
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
    {
      // 値入額=(売価-納価)×入数×函数(計画)（算出・全区分。課題1757）。合計行は明細の合計。
      headerName: '値入額',
      headerTooltip: '値入額[算出](売価-納価)*入数*函数(計画)',
      field: 'markupAmount',
      ...GRID_NUMBER_TEXT_FILTER,
      width: 88,
      cellClass: 'ag-cell-right',
      cellStyle: whiteCellStyle,
      editable: false,
      // 値入額＝整数
      valueFormatter: planAmountFormatter(PLAN_DETAIL_DIGITS.amount),
    },
    {
      // ギフト/特殊商品=白（算出値）、その他=グレー（入力不可）
      headerName: '値入率',
      headerTooltip: '値入率[算出](売価-納価)/売価*100%',
      field: 'discount',
      ...GRID_NUMBER_TEXT_FILTER,
      width: 80,
      cellClass: 'ag-cell-right',
      // 値入率＝小数第1位（％）
      valueFormatter: planRateFormatter(PLAN_DETAIL_DIGITS.rate),
      cellStyle: makeCellStyle({ ギフト: 'white', 特殊商品: 'white' }, 'gray'),
    },
    {
      headerName: '量経追加口率',
      headerTooltip: '量経追加口率[算出]量経追加口/社外売上高*100%',
      field: 'volumeAddRate',
      ...GRID_NUMBER_TEXT_FILTER,
      width: 104,
      cellClass: 'ag-cell-right',
      // 量経追加口率＝小数第1位（％）
      valueFormatter: planRateFormatter(PLAN_DETAIL_DIGITS.rate),
      cellStyle: whiteCellStyle,
      editable: false,
    },
    {
      headerName: '社外売上高',
      headerTooltip: '社外売上高[算出]社外売単価×入数×函数(計画)',
      field: 'externalSales',
      ...GRID_NUMBER_TEXT_FILTER,
      width: 88,
      cellClass: 'ag-cell-right',
      // 社外売上高＝整数
      valueFormatter: planAmountFormatter(PLAN_DETAIL_DIGITS.amount),
      cellStyle: whiteCellStyle,
      editable: false,
    },
    {
      headerName: '売上原価',
      headerTooltip: '売上原価[算出]売上原価単価×入数×函数(計画)',
      field: 'delivery',
      ...GRID_NUMBER_TEXT_FILTER,
      width: 88,
      cellClass: 'ag-cell-right',
      // 売上原価＝整数
      valueFormatter: planAmountFormatter(PLAN_DETAIL_DIGITS.amount),
      cellStyle: whiteCellStyle,
      editable: false,
    },
    {
      headerName: '売買差益率',
      headerTooltip: '売買差益率[算出]売買差益/売上高*100%',
      field: 'profit',
      ...GRID_NUMBER_TEXT_FILTER,
      width: 104,
      cellClass: 'ag-cell-right',
      // 売買差益率＝小数第1位（％）
      valueFormatter: planRateFormatter(PLAN_DETAIL_DIGITS.rate),
      cellStyle: whiteCellStyle,
    },
    // 一次店/三次店 列（常時表示。右端＝Actions列の直前）。
    // コード列は名称列の直前に置く（支払先コード＋支払先などの既存列と同じ並び）。
    {
      headerName: '一次店コード',
      field: 'tier1Code',
      width: 104,
      cellClass: 'ag-cell-left',
      cellStyle: whiteCellStyle,
      editable: false,
      valueGetter: storeCodeValueGetter('tier1'),
    },
    {
      headerName: '一次店',
      field: 'tier1',
      width: 160,
      cellClass: 'ag-cell-left',
      cellStyle: whiteCellStyle,
      editable: false,
      valueGetter: storeValueGetter('tier1'),
    },
    {
      headerName: '三次店コード',
      field: 'tier3Code',
      width: 104,
      cellClass: 'ag-cell-left',
      cellStyle: whiteCellStyle,
      editable: false,
      valueGetter: storeCodeValueGetter('tier3'),
    },
    {
      headerName: '三次店',
      field: 'tier3',
      width: 160,
      cellClass: 'ag-cell-left',
      cellStyle: whiteCellStyle,
      editable: false,
      valueGetter: storeValueGetter('tier3'),
    },
    {
      headerName: '',
      // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
      suppressColumnsToolPanel: true,
      colId: 'actions',
      // 「︙」のメニューだけを出す列（→ UX-087）
      width: 45,
      minWidth: 45,
      maxWidth: 45,
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
        // アイコンはセット先頭行(上旬)にのみ描画し、中旬/下旬は描画しない（結合風表示）。
        const isGift = params.data.section === 'ギフト';
        if (isGift && !params.data._giftFirst) return null;

        const handleDelete = () => {
          params.context.onDeleteRow(params.data);
        };

        const handleCopyForPane = () => {
          // ギフトも他区分と同様にコピーする（セット単位で3行まとめて複製する）
          params.context.onCopyForPane(params.data);
        };

        // 定番商品かどうかを判定
        const isRegularProduct =
          params.data.section === '定番商品' ||
          params.data.productCategory === '定番商品';

        // 前年実績（函数・納価のいずれか）に値がある行は削除させない。
        const priorYearExists = hasPriorYearActual(
          params.data.prevYear,
          params.data.prevYearPrice
        );
        const deleteDisabled = isRegularProduct || priorYearExists;
        const deleteTitle = isRegularProduct
          ? '定番商品は削除できません'
          : priorYearExists
            ? '前年実績がある行は削除できません'
            : '削除';

        // 行の操作は「︙」のメニュー（共通部品 RowActionMenu）で出す（画面設計標準・UI/UX UX-087 → 02 §7「行の操作」）
        return (
          <RowActionMenu>
            <DropdownMenuItem
              onClick={isRegularProduct ? undefined : handleCopyForPane}
              disabled={isRegularProduct}
              className={
                isRegularProduct
                  ? 'text-gray-400'
                  : 'text-green-600 focus:text-green-600'
              }
            >
              <Copy
                className={`h-4 w-4 ${isRegularProduct ? 'text-gray-400' : 'text-green-600'}`}
              />
              {isRegularProduct
                ? 'コピー（定番商品はコピーできません）'
                : 'コピー'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={deleteDisabled ? undefined : handleDelete}
              disabled={deleteDisabled}
              className={
                deleteDisabled
                  ? 'text-gray-400'
                  : 'text-red-600 focus:text-red-600'
              }
            >
              <Trash2
                className={`h-4 w-4 ${deleteDisabled ? 'text-gray-400' : 'text-red-600'}`}
              />
              {deleteDisabled ? `削除（${deleteTitle}）` : '削除'}
            </DropdownMenuItem>
          </RowActionMenu>
        );
      },
    },
  ];

  return columnDefs;
};
