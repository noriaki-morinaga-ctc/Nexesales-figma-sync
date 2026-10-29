import { useCallback, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { CustomCellRendererProps } from 'ag-grid-react';
import type {
  CellValueChangedEvent,
  ColDef,
  ColGroupDef,
  GridApi,
  ValueFormatterParams,
} from 'ag-grid-community';
import {
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

import {
  useGridColumnState,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  GRID_COLORS,
  withHeaderTooltips,
  gridFilterContextMenuItems,
  GRID_DATE_TEXT_FILTER,
  GRID_MONTH_TEXT_FILTER,
  GRID_NUMBER_FILTER,
  GRID_EMPTY_TEXT,
} from '../../../grid';
import { BUTTON_STYLES, BUTTON_BASE } from '../../../../../styles/commonStyles';
import type {
  BillingEdiDetailRow,
  BillingEdiErrorSummary,
} from '../../../../constants/billingEdiMockData';
import {
  findCorrection,
  formatCorrectionTooltip,
  formatDetailErrorCategories,
  formatDetailErrorFields,
  formatDetailErrorReasons,
  isCorrectableField,
  isCorrectedRow,
  matchesErrorSummary,
  resolveDetailStatus,
  qtyUnitLabel,
  selectableQtyUnits,
} from '../../../../utils/billingEdiImport';
import { SingleComboboxCellEditor } from '../../../ui/single-combobox-cell-editor';

// 変換できなかった項目に表示する文言（エラー）。
// 商流販売店が導出できない場合も取込エラーのため、同じ「(未変換)」で表す（決定13）
const UNCONVERTED_LABEL = '(未変換)';

// 列（field）とエラー項目名の対応。形式エラーの項目だけ画面で修正できる
const ERROR_FIELD_BY_COLUMN: Record<string, string> = {
  accountingDate: '計上日',
  billingAmount: '請求計上金額',
  qtyUnit: '計上対象数量単位',
  productCodeOriginal: '商品コード',
};

// 参照専用セルの共通スタイル（灰背景）。この明細は形式エラーの項目だけ入力でき、
// それ以外は参照専用のため、入力可（白）と不可（灰）を背景色で見分けられるようにする
// （支払詳細(商流販売店紐づけなし)等と同じ GRID_COLORS.readonly / editable を使う）。
const RO_STYLE = { backgroundColor: GRID_COLORS.readonly } as const;
// 参照専用セル＋条件付きの文字色
const roWithColor = (color?: string) =>
  color ? { ...RO_STYLE, color } : RO_STYLE;

// 未変換セルの表示（空文字を赤字の「(未変換)」にする）
const unconvertedFormatter = (params: ValueFormatterParams): string =>
  params.value ? String(params.value) : UNCONVERTED_LABEL;

const unconvertedStyle = (params: { value?: unknown }) =>
  roWithColor(params.value ? undefined : GRID_COLORS.overText);

// 形式エラーで修正できる項目のセル設定を組み立てる。
//   ・修正前は編集可（白）。連携生値が数値・日付として保持できない場合はその生値を赤字で出す
//   ・修正後は変更セルとして黄背景にし、ツールチップで原本→修正後を確認できるようにする
const correctableCell = (
  colField: string,
  fallbackFormatter: (params: ValueFormatterParams) => string
): Partial<ColDef<BillingEdiDetailRow>> => {
  const errorField = ERROR_FIELD_BY_COLUMN[colField];
  return {
    editable: (params) =>
      !!params.data && isCorrectableField(params.data, errorField),
    valueFormatter: (params) => {
      const raw = params.data?.rawValues?.[errorField];
      return raw ?? fallbackFormatter(params);
    },
    cellStyle: (params) => {
      if (!params.data) return RO_STYLE;
      if (findCorrection(params.data, errorField)) {
        // 原本から変更したセル（画面設計標準の変更セル表現）
        return {
          backgroundColor: GRID_COLORS.changedBg,
          borderColor: GRID_COLORS.changedBorder,
        };
      }
      if (!isCorrectableField(params.data, errorField)) {
        // この行では入力できない項目（灰）
        return RO_STYLE;
      }
      // 入力可（白）。型変換できなかった連携生値はそのまま赤字で出す
      return params.data.rawValues?.[errorField] !== undefined
        ? { backgroundColor: GRID_COLORS.editable, color: GRID_COLORS.overText }
        : { backgroundColor: GRID_COLORS.editable };
    },
    tooltipValueGetter: (params) => {
      if (!params.data) return '';
      const correction = findCorrection(params.data, errorField);
      return correction
        ? formatCorrectionTooltip(correction)
        : (params.value ?? '');
    },
  };
};

// ステータスセルレンダラー（アイコン＋文言）。エラー行を一目で判別できるようにする
const DetailStatusRenderer = (
  props: CustomCellRendererProps<BillingEdiDetailRow>
) => {
  const isError = props.value === 'エラー';
  const Icon = isError ? AlertTriangle : CheckCircle;
  return (
    <div className="flex items-center gap-1 overflow-hidden">
      <Icon
        className={`h-5 w-5 flex-shrink-0 ${
          isError ? 'text-red-600' : 'text-green-600'
        }`}
      />
      <span
        className={isError ? 'truncate font-bold text-red-600' : 'truncate'}
      >
        {props.value}
      </span>
    </div>
  );
};

// 既定は参照専用（灰背景）。列側で cellStyle を持つ列は各列でこの色を引き継ぐ
const DETAIL_DEFAULT_COL_DEF = { ...GRID_DEFAULT_COL_DEF, cellStyle: RO_STYLE };

// 未修正の入力可セル（データ不正の項目）1件。前／次のエラーで辿る単位
interface ErrorCellTarget {
  rowIndex: number;
  colId: string;
}

// 表示中の並び（フィルター・ソート後の行順 × 表示中の列順）で、未修正の入力可セルを列挙する。
// 変換マスタ未登録はエラーサマリで直すため対象外（明細で入力できるのはデータ不正のみ）
const collectErrorCells = (api: GridApi<BillingEdiDetailRow>) => {
  const colIds = api
    .getAllDisplayedColumns()
    .map((col) => col.getColId())
    .filter((colId) => ERROR_FIELD_BY_COLUMN[colId]);
  const targets: ErrorCellTarget[] = [];
  api.forEachNodeAfterFilterAndSort((node) => {
    if (!node.data || node.rowIndex == null) return;
    for (const colId of colIds) {
      const field = ERROR_FIELD_BY_COLUMN[colId];
      if (
        isCorrectableField(node.data, field) &&
        !findCorrection(node.data, field)
      ) {
        targets.push({ rowIndex: node.rowIndex, colId });
      }
    }
  });
  return { targets, colIds };
};

// フォーカス中のセルを起点に、表示順で前後にある未修正の入力可セルを探す。
// フォーカスが無い場合は先頭より前にいるものとみなす（次＝先頭、前＝無し）。
// 対象外の列にフォーカスがあっても行・列の位置で前後を決める
const findAdjacentErrorCell = (
  api: GridApi<BillingEdiDetailRow>,
  direction: 'prev' | 'next'
): ErrorCellTarget | undefined => {
  const { targets, colIds } = collectErrorCells(api);
  const focused = api.getFocusedCell();
  const position = (rowIndex: number, colId: string) =>
    rowIndex * (colIds.length + 1) + colIds.indexOf(colId) + 1;
  const anchor = focused
    ? position(focused.rowIndex, focused.column.getColId())
    : -1;
  return direction === 'next'
    ? targets.find((t) => position(t.rowIndex, t.colId) > anchor)
    : [...targets]
        .reverse()
        .find((t) => position(t.rowIndex, t.colId) < anchor);
};

// エラー項目名 → 修正する列（ERROR_FIELD_BY_COLUMN の逆引き）
const COLUMN_BY_ERROR_FIELD: Record<string, string> = Object.fromEntries(
  Object.entries(ERROR_FIELD_BY_COLUMN).map(([colId, field]) => [field, colId])
);

// グリッドの context 経由でセルレンダラーに渡す、入力可セルへの移動処理
interface DetailGridContext {
  jumpToCell: (target: ErrorCellTarget) => void;
}

// エラー項目セル。明細で直せる（データ不正かつ未修正の）項目だけをリンク表示にし、
// 押すとその項目の入力セルへ移る。変換マスタ未登録の項目はエラーサマリで直すため文字のみ
const ErrorFieldRenderer = (
  props: CustomCellRendererProps<BillingEdiDetailRow, string, DetailGridContext>
) => {
  const { data, node, context } = props;
  if (!data) return null;
  const fields = Array.from(new Set(data.errors.map((e) => e.field)));
  return (
    <div className="flex items-center overflow-hidden whitespace-nowrap">
      {fields.map((field, i) => {
        const colId = COLUMN_BY_ERROR_FIELD[field];
        const jumpable =
          !!colId &&
          isCorrectableField(data, field) &&
          !findCorrection(data, field) &&
          node.rowIndex != null;
        return (
          <span key={field} className="flex items-center">
            {i > 0 && '、'}
            {jumpable ? (
              <button
                type="button"
                className="cursor-pointer text-blue-600 hover:underline"
                onClick={() =>
                  context.jumpToCell({
                    rowIndex: node.rowIndex as number,
                    colId,
                  })
                }
                aria-label={`${field}の入力欄へ移動`}
              >
                {field}
              </button>
            ) : (
              field
            )}
          </span>
        );
      })}
    </div>
  );
};

interface BillingDetailListProps {
  rowData: BillingEdiDetailRow[];
  // 形式エラーの項目を画面で修正したときの通知（原本は保持し差分として記録する）
  onCorrect: (detailId: string, field: string, corrected: string) => void;
  // エラーサマリで選択中の1件。指定があるとその対象明細だけに絞り込む
  filterSummary: BillingEdiErrorSummary | null;
  // 絞り込みを解除する
  onClearFilter: () => void;
}

export function BillingDetailList({
  rowData,
  onCorrect,
  filterSummary,
  onClearFilter,
}: BillingDetailListProps) {
  // エラー行のみに絞り込むトグル。
  // この画面の目的は取込エラーへの対処のため、既定でエラー行のみを表示する。
  const [errorRowsOnly, setErrorRowsOnly] = useState(true);

  const errorCount = useMemo(
    () => rowData.filter((d) => d.errors.length > 0).length,
    [rowData]
  );

  // 事業所コード・請求書No・請求伝票番号・エラー項目での絞り込みは画面独自の検索項目を
  // 持たず、AG Grid の列フィルター（セル右クリック → フィルター）で行う。
  const displayedRows = useMemo(() => {
    // エラーサマリで1件選ばれている間は、その対象明細だけを見せる（他の条件より優先）
    if (filterSummary) {
      return rowData.filter((d) => matchesErrorSummary(d, filterSummary));
    }
    return errorRowsOnly ? rowData.filter((d) => d.errors.length > 0) : rowData;
  }, [errorRowsOnly, filterSummary, rowData]);

  // セル編集の確定時に、修正差分（原本→修正後）を親へ通知する
  const handleCellValueChanged = useCallback(
    (event: CellValueChangedEvent<BillingEdiDetailRow>) => {
      const colId = event.column.getColId();
      const errorField = ERROR_FIELD_BY_COLUMN[colId];
      if (!errorField || !event.data) return;
      onCorrect(event.data.id, errorField, String(event.newValue ?? ''));
    },
    [onCorrect]
  );

  // ── 入力可セルへのジャンプ（エラー項目の押下／前・次のエラー）
  // 列が多く入力可のセルが横に散らばるため、公式 API でスクロールしてフォーカスする
  const gridRef = useRef<AgGridReact<BillingEdiDetailRow>>(null);
  // 未修正の入力可セルの件数、フォーカス中のセルが何件目か（0始まり。対象外なら -1）、
  // 前後に移動先があるか（無い側のボタンは非活性にする）
  const [errorCellNav, setErrorCellNav] = useState({
    total: 0,
    current: -1,
    hasPrev: false,
    hasNext: false,
  });

  // 件数・位置・前後の移動先の有無を、表示中の行・列とフォーカス位置から数え直す
  const refreshErrorCellNav = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    const { targets } = collectErrorCells(api);
    const focused = api.getFocusedCell();
    const next = {
      total: targets.length,
      current: focused
        ? targets.findIndex(
            (t) =>
              t.rowIndex === focused.rowIndex &&
              t.colId === focused.column.getColId()
          )
        : -1,
      hasPrev: !!findAdjacentErrorCell(api, 'prev'),
      hasNext: !!findAdjacentErrorCell(api, 'next'),
    };
    setErrorCellNav((prev) =>
      prev.total === next.total &&
      prev.current === next.current &&
      prev.hasPrev === next.hasPrev &&
      prev.hasNext === next.hasNext
        ? prev
        : next
    );
  }, []);

  const jumpToCell = useCallback((target: ErrorCellTarget) => {
    const api = gridRef.current?.api;
    if (!api) return;
    api.ensureIndexVisible(target.rowIndex, 'middle');
    api.ensureColumnVisible(target.colId, 'middle');
    api.setFocusedCell(target.rowIndex, target.colId);
  }, []);

  // 前／次のエラー。フォーカス中のセルを起点に、表示順で前後の未修正セルへ移る
  const handleJumpError = useCallback(
    (direction: 'prev' | 'next') => {
      const api = gridRef.current?.api;
      if (!api) return;
      const target = findAdjacentErrorCell(api, direction);
      if (target) jumpToCell(target);
    },
    [jumpToCell]
  );

  // エラー項目セルのリンクから呼ぶ移動処理（参照を固定してセルの再描画を避ける）
  const gridContext = useMemo<DetailGridContext>(
    () => ({ jumpToCell }),
    [jumpToCell]
  );

  // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）。
  // v6：修正列と、商品変換の2段階化（オンライン商品／サマリ商品）・費目判別ロジック・
  // 消費税区分／請求消費税額を追加。v7：連携値と変換後を列グループに分割。v8：変換後の列を変換元の直後へ移動。v9：影響範囲列を廃止（エラーサマリ側で確認する）。
  // v11：得意先区分を削除（決定22）。v12：事業所・得意先の個別変換列を廃止し、
  // 商流販売店を一次店・三次店の4列に変更（決定12・13）。v13：卸会社→卸店名（請求元）へ改称。
  // v14：請求元コード・請求元名／卸店名（請求元・変換後）／請求消費税額を削除し、
  // 商流販売店に販売店を追加、取込日時を受信日時・再取込日時へ、備考とケース入数を
  // 企画・商品（連携値）へ移動。
  // v15：ステータス・区分・エラー項目・エラー内容を左固定にした（保存済みの固定状態で上書きされないよう更新）。
  const gridColumnStateProps = useGridColumnState(
    'billingEdiImport.detailColumnState.v15',
    { autoSize: false }
  );

  // 明細列定義。決定6により集約せず1行単位で表示する。
  // 卸から連携された値（原本）と、取込時に自社マスタへ変換・導出した結果を列グループで分け、
  // どちらの項目かをヘッダーで見分けられるようにする。変換後の列は変換元の直後に置き、
  // 変換前後を並べて突き合わせられるようにする（レビュー指摘＝変換前後の併記）。
  // 形式エラーの項目のみ編集可（マスタでは直せないため）。変換エラーはマスタを修正して再取込する。
  const columnDefs: (
    | ColDef<BillingEdiDetailRow>
    | ColGroupDef<BillingEdiDetailRow>
  )[] = useMemo(
    () => [
      {
        // エラー行を一目で判別できるよう最左に置く。
        // 影響範囲（請求書内すべて／伝票内すべて／この明細のみ）はエラーサマリ側で確認する。
        headerName: '取込結果',
        children: [
          {
            headerName: 'ステータス',
            colId: 'status',
            width: 120,
            cellClass: 'cell-left',
            cellRenderer: DetailStatusRenderer,
            valueGetter: (params) =>
              params.data ? resolveDetailStatus(params.data) : '',
          },
          {
            headerName: '区分',
            colId: 'errorCategory',
            width: 170,
            cellClass: 'cell-left',
            // 変換マスタ未登録＝マスタ修正または変換後の値の登録／データ不正＝明細で値を修正
            valueGetter: (params) =>
              params.data ? formatDetailErrorCategories(params.data) : '',
          },
          {
            headerName: 'エラー項目',
            colId: 'errorField',
            width: 170,
            cellClass: 'cell-left',
            valueGetter: (params) =>
              params.data ? formatDetailErrorFields(params.data) : '',
            // 明細で直せる項目はリンク表示にし、押すとその入力セルへ移る
            cellRenderer: ErrorFieldRenderer,
            // 修正してもエラー項目名（値）は変わらないため、値の比較では再描画されず
            // 修正済みの項目がリンクのまま残る。行データが更新されたら常に描き直す
            equals: () => false,
          },
          {
            headerName: 'エラー内容',
            colId: 'errorReason',
            width: 240,
            cellClass: 'cell-left',
            valueGetter: (params) =>
              params.data ? formatDetailErrorReasons(params.data) : '',
          },
          {
            // 原本（卸から連携された値）を画面で修正したか。原本は上書きせず差分として保持する
            headerName: '修正',
            colId: 'corrected',
            width: 100,
            cellClass: 'cell-left',
            valueGetter: (params) => {
              if (!params.data || !isCorrectedRow(params.data)) return '';
              return Array.from(
                new Set(params.data.corrections.map((c) => c.kind))
              ).join('、');
            },
            cellStyle: (params) =>
              params.value
                ? {
                    backgroundColor: GRID_COLORS.changedBg,
                    borderColor: GRID_COLORS.changedBorder,
                  }
                : RO_STYLE,
            tooltipValueGetter: (params) =>
              params.data?.corrections
                .map(formatCorrectionTooltip)
                .join(' / ') ?? '',
          },
          {
            // 明細ごとの受信日時。基本情報の受信日時はこの最も古い値を出す
            headerName: '受信日時',
            field: 'receivedAt',
            ...GRID_DATE_TEXT_FILTER,
            width: 140,
            cellClass: 'cell-left',
          },
          {
            // この明細を最後に再取込した日時。基本情報の再取込日時はこの最も新しい値を出す
            headerName: '再取込日時',
            field: 'reimportedAt',
            ...GRID_DATE_TEXT_FILTER,
            width: 140,
            cellClass: 'cell-left',
            valueFormatter: (params) =>
              params.value ? params.value : GRID_EMPTY_TEXT,
          },
        ],
      },
      {
        // 区分2 請求元情報（請求書単位）
        headerName: '請求書（連携値）',
        children: [
          {
            headerName: '請求書No',
            field: 'billingNo',
            width: 130,
            cellClass: 'cell-left',
          },
          // 請求元コード（2-5）・請求元名（2-6）は画面に出さない（商流変換の入力としては保持する）
          {
            headerName: '事業所コード',
            field: 'senderOfficeCode',
            width: 130,
            cellClass: 'cell-left',
          },
          {
            headerName: '事業所名',
            field: 'senderOfficeName',
            width: 180,
            cellClass: 'cell-left',
          },
        ],
      },
      // 請求元企業（変換後）は列にしない。請求元企業は一覧・基本情報とも
      // 連携値をそのまま表示する方式で変換処理を挟まないため、変換後の列を持つ意味がない
      // （提供企業コードからの導出は取込では行い、一覧の行キーに使う。決定15）
      {
        // 区分3 得意先情報（伝票単位）※伝票ヘッダ項目のため1伝票に1つ
        headerName: '伝票（連携値）',
        children: [
          {
            headerName: '請求伝票番号',
            field: 'slipNo',
            width: 130,
            cellClass: 'cell-left',
          },
          {
            headerName: '得意先コード',
            field: 'customerCode',
            width: 120,
            cellClass: 'cell-left',
          },
          {
            headerName: '得意先名',
            field: 'customerName',
            width: 160,
            cellClass: 'cell-left',
          },
          // 得意先区分（3-8）は取込では保持するが画面には出さない。
          // 得意先はコードと名称があれば判別できるため（決定22 2026-08-18）。
        ],
      },
      {
        // 商流販売店変換マスタを①／②の組合せで引いて導出する（決定12）。
        //   ①提供企業＋請求元企業事業所＋得意先
        //   ②事業所が連携されない場合は 提供企業＋請求元企業＋得意先
        // 導出できない明細は取込エラーとし、請求詳細画面へは連携しない（決定13）。
        headerName: '商流販売店（変換後）',
        children: [
          {
            headerName: '販売店コード',
            field: 'storeCode',
            width: 130,
            cellClass: 'cell-left',
            valueFormatter: unconvertedFormatter,
            cellStyle: unconvertedStyle,
          },
          {
            headerName: '販売店名',
            field: 'storeName',
            width: 180,
            cellClass: 'cell-left',
            valueFormatter: unconvertedFormatter,
            cellStyle: unconvertedStyle,
          },
          {
            headerName: '一次店コード',
            field: 'primaryStoreCode',
            width: 130,
            cellClass: 'cell-left',
            valueFormatter: unconvertedFormatter,
            cellStyle: unconvertedStyle,
          },
          {
            headerName: '一次店名',
            field: 'primaryStoreName',
            width: 200,
            cellClass: 'cell-left',
            valueFormatter: unconvertedFormatter,
            cellStyle: unconvertedStyle,
          },
          {
            headerName: '三次店コード',
            field: 'tertiaryStoreCode',
            width: 130,
            cellClass: 'cell-left',
            valueFormatter: unconvertedFormatter,
            cellStyle: unconvertedStyle,
          },
          {
            headerName: '三次店名',
            field: 'tertiaryStoreName',
            width: 180,
            cellClass: 'cell-left',
            valueFormatter: unconvertedFormatter,
            cellStyle: unconvertedStyle,
          },
        ],
      },
      {
        // 区分4 請求明細
        headerName: '計上（連携値）',
        children: [
          {
            headerName: '計上No',
            field: 'recordingNo',
            width: 120,
            cellClass: 'cell-left',
          },
          {
            headerName: '計上日',
            field: 'accountingDate',
            width: 130,
            cellClass: 'cell-left',
            ...correctableCell('accountingDate', (params) =>
              params.value ? String(params.value) : ''
            ),
          },
        ],
      },
      {
        // 対象期間（終了日・4-22）が属する月。終了日が空欄なら請求締日（区分2）が
        // 属する月とする（→ 20260804_第27回 決定事項8／課題 No.1184・No.1286）。
        headerName: '対象年月（変換後）',
        children: [
          {
            headerName: '対象年月',
            field: 'targetMonth',
            ...GRID_MONTH_TEXT_FILTER,
            width: 110,
            cellClass: 'cell-left',
            headerTooltip:
              '対象期間（終了日）が属する月。終了日が空欄のときは請求締日が属する月',
            // 対象期間（終了日）と請求締日のどちらも取れないと導出できない
            valueFormatter: (params) =>
              params.value ? params.value : '(導出不可)',
            cellStyle: (params) =>
              roWithColor(params.value ? undefined : GRID_COLORS.overText),
          },
        ],
      },
      {
        // 区分4-21/4-22/4-3
        headerName: '期間・区分（連携値）',
        children: [
          {
            headerName: '対象期間(開始日)',
            field: 'periodFrom',
            width: 150,
            cellClass: 'cell-left',
          },
          {
            headerName: '対象期間(終了日)',
            field: 'periodTo',
            width: 150,
            cellClass: 'cell-left',
            headerTooltip: '対象月の導出元。空欄のときは請求締日から導出する',
          },
          {
            // 対象期間（終了日）が空欄の明細で対象月を導出する元（区分2）。
            headerName: '請求締日',
            field: 'billingClosingDate',
            width: 130,
            cellClass: 'cell-left',
            headerTooltip:
              '請求元情報（レコード区分2）の請求締日。対象期間（終了日）が空欄のときの対象月の導出元',
          },
          {
            headerName: '計上区分',
            field: 'recordingType',
            width: 100,
            cellClass: 'cell-left',
            // 取消はこの区分で表され、金額は正のまま。支払への反映方法は未決のため表示のみ
            cellStyle: (params) =>
              roWithColor(
                params.value === '取消' ? GRID_COLORS.overText : undefined
              ),
          },
        ],
      },
      {
        // 区分4-24。費目判別の入力のひとつ
        headerName: '摘要（連携値）',
        children: [
          {
            headerName: '摘要コード',
            field: 'summaryCode',
            width: 110,
            cellClass: 'cell-left',
          },
          {
            headerName: '摘要名',
            field: 'summaryName',
            width: 170,
            cellClass: 'cell-left',
            valueFormatter: unconvertedFormatter,
            cellStyle: unconvertedStyle,
          },
        ],
      },
      {
        // 卸ごとの判別ロジックで導出（決定9）。判別に使った項目の隣に置く
        headerName: '費目（変換後）',
        children: [
          {
            // 卸ごとにパターン化した費目判別ロジック（決定9）。使う項目が卸で変わる
            headerName: '費目判別ロジック',
            field: 'expenseRule',
            width: 170,
            cellClass: 'cell-left',
          },
          {
            // 判別できない明細は追加口として取り込むため空にならない。判別できなかったことの
            // 表示は請求詳細画面が担うため、この画面では赤字の「(未変換)」を出さない（決定19）
            headerName: '費目',
            field: 'expenseType',
            width: 100,
            cellClass: 'cell-left',
          },
        ],
      },
      {
        // 区分4-23／区分4-8・4-9・区分5-3
        headerName: '企画・商品（連携値）',
        children: [
          {
            headerName: '販売促進企画番号',
            field: 'promotionPlanNo',
            width: 150,
            cellClass: 'cell-left',
          },
          {
            headerName: '商品コード(変換前)',
            field: 'productCodeOriginal',
            width: 170,
            cellClass: 'cell-left',
            // 必須項目（区分4-8）が未連携のケースは画面で補える
            ...correctableCell('productCodeOriginal', (params) =>
              params.value ? String(params.value) : '(未連携)'
            ),
          },
          {
            headerName: '商品名(変換前)',
            field: 'productNameOriginal',
            width: 190,
            cellClass: 'cell-left',
          },
          {
            // 区分5-5。卸によって拡売費の内容が商品名ではなくこちらに入る（決定8）。
            // どちらも連携値のまま表示し、読み替えロジックは設けない
            headerName: '備考',
            field: 'noteOriginal',
            width: 190,
            cellClass: 'cell-left',
            valueFormatter: (params) =>
              params.value ? params.value : GRID_EMPTY_TEXT,
          },
          {
            // 標準は 1：プライベート／3：JAN。5：SDP・6：GTIN は卸独自の拡張値
            headerName: '商品コード使用区分',
            field: 'productCodeType',
            width: 150,
            cellClass: 'cell-left',
          },
          {
            // 金額（連携値）から移動。商品に関する連携値としてまとめて見せる
            headerName: 'ケース入数',
            field: 'casePack',
            width: 110,
            cellClass: 'cell-right',
            valueFormatter: (params) =>
              params.value?.toLocaleString() ?? GRID_EMPTY_TEXT,
          },
        ],
      },
      {
        // 商品コード → オンライン商品 → サマリ商品 の2段階変換（決定6・宿題4）
        headerName: '商品（変換後）',
        children: [
          {
            headerName: 'オンライン商品コード',
            field: 'onlineProductCode',
            width: 180,
            cellClass: 'cell-left',
            valueFormatter: unconvertedFormatter,
            cellStyle: unconvertedStyle,
          },
          {
            headerName: 'オンライン商品名',
            field: 'onlineProductName',
            width: 200,
            cellClass: 'cell-left',
            valueFormatter: unconvertedFormatter,
            cellStyle: unconvertedStyle,
          },
          {
            headerName: 'サマリ商品コード',
            field: 'summaryProductCode',
            width: 160,
            cellClass: 'cell-left',
            valueFormatter: unconvertedFormatter,
            cellStyle: unconvertedStyle,
          },
          {
            headerName: 'サマリ商品名',
            field: 'summaryProductName',
            width: 180,
            cellClass: 'cell-left',
            valueFormatter: unconvertedFormatter,
            cellStyle: unconvertedStyle,
          },
        ],
      },
      {
        // 区分4-10〜4-19。金額の検算に必要な項目をまとめる
        headerName: '金額（連携値）',
        children: [
          {
            headerName: '請求計上対象数量',
            field: 'billingQty',
            ...GRID_NUMBER_FILTER,
            width: 140,
            cellClass: 'cell-right',
            // 決定11により数量なしを許容する。空欄で表示しエラーとはしない
            valueFormatter: (params) =>
              params.value == null
                ? GRID_EMPTY_TEXT
                : params.value.toLocaleString(),
          },
          {
            headerName: '計上対象数量単位',
            field: 'qtyUnit',
            width: 150,
            cellClass: 'cell-left',
            // 値はコードのまま持ち、表示だけ名称にする（再取込にもコードで渡すため）。
            // 定義外の区分値が来た場合は連携生値を出し、画面で正しい区分値へ直せる
            ...correctableCell('qtyUnit', (params) =>
              params.value ? qtyUnitLabel(String(params.value)) : ''
            ),
            // 自由入力だと定義外の値で直して再びエラーになるため、区分値の候補から選ぶ。
            // 円は請求計上条件区分が「％」の明細のみ候補に出すため、行ごとに候補を差し替える
            cellEditorPopup: true,
            cellEditorSelector: (params) => ({
              component: SingleComboboxCellEditor,
              params: {
                comboOptions: params.data
                  ? selectableQtyUnits(params.data).map(({ code, label }) => ({
                      value: code,
                      label,
                      code,
                    }))
                  : [],
                placeholder: '単位を選択',
              },
            }),
          },
          {
            headerName: '請求計上条件区分',
            field: 'billingConditionType',
            width: 150,
            cellClass: 'cell-left',
          },
          {
            headerName: '請求計上条件',
            field: 'billingCondition',
            width: 130,
            cellClass: 'cell-right',
            // 区分が「％」のときは単価ではなく率（例: 1.26%）。それ以外は3桁区切りの金額
            valueFormatter: (params) =>
              params.data?.billingConditionType === '％'
                ? `${params.value}%`
                : (params.value?.toLocaleString() ?? GRID_EMPTY_TEXT),
          },
          {
            headerName: '請求計上金額',
            field: 'billingAmount',
            width: 140,
            cellClass: 'cell-right',
            // 数値に変換できない場合は連携生値を出し、画面で正しい金額へ直せる
            ...correctableCell('billingAmount', (params) =>
              params.value == null
                ? GRID_EMPTY_TEXT
                : params.value.toLocaleString()
            ),
            // 数値入力（整数）。計上金額は円単位のため小数を持たない（フォーマット定義 区分4-15）
            cellEditor: 'agNumberCellEditor',
            cellEditorParams: { precision: 0 },
          },
          {
            headerName: '請求金額計算区分',
            field: 'amountCalcType',
            width: 150,
            cellClass: 'cell-left',
          },
          {
            headerName: '消費税区分',
            field: 'taxType',
            width: 120,
            cellClass: 'cell-left',
          },
          // 請求消費税額（4-17）は仕様上ゼロ固定で実データでも常にゼロのため列にしない
          // （取込では保持する）
        ],
      },
    ],
    []
  );

  const columnDefsWithTooltip = useMemo(
    () => withHeaderTooltips(columnDefs),
    [columnDefs]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-1 flex shrink-0 items-center justify-between gap-3">
        {/* 表示件数は列フィルターでも変わるため、グリッド下部のステータスバーで示す */}
        <span className="text-sm text-gray-700">
          {rowData.length.toLocaleString()} 件中 {errorCount.toLocaleString()}{' '}
          件がエラー
        </span>
        <div className="flex items-center gap-3">
          {/* 未修正の入力可セル（データ不正の項目）を表示順に辿る */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleJumpError('prev')}
              disabled={!errorCellNav.hasPrev}
              className={`flex items-center gap-1 px-2 py-0.5 whitespace-nowrap text-sm ${errorCellNav.hasPrev ? BUTTON_STYLES.outline : BUTTON_STYLES.disabled} ${BUTTON_BASE}`}
              aria-label="前のエラー"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              前のエラー
            </button>
            <span className="min-w-20 text-center text-sm text-gray-700">
              {errorCellNav.current >= 0 ? errorCellNav.current + 1 : '-'} /{' '}
              {errorCellNav.total} 件
            </span>
            <button
              type="button"
              onClick={() => handleJumpError('next')}
              disabled={!errorCellNav.hasNext}
              className={`flex items-center gap-1 px-2 py-0.5 whitespace-nowrap text-sm ${errorCellNav.hasNext ? BUTTON_STYLES.outline : BUTTON_STYLES.disabled} ${BUTTON_BASE}`}
              aria-label="次のエラー"
            >
              次のエラー
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* エラーサマリの行を選ぶとここに絞り込み条件が出る。解除で全明細へ戻す */}
          {filterSummary && (
            <span className="flex items-center gap-2 rounded-md border border-blue-300 bg-blue-50 px-2 py-0.5 text-sm text-gray-700">
              <span>
                エラーサマリで絞り込み中：{filterSummary.field}
                {filterSummary.valueCode
                  ? `（${filterSummary.valueCode}）`
                  : ''}
              </span>
              <button
                onClick={onClearFilter}
                className={`flex items-center gap-1 px-2 py-0.5 whitespace-nowrap text-sm ${BUTTON_STYLES.outline} ${BUTTON_BASE}`}
                aria-label="絞り込みを解除"
              >
                <X className="h-3.5 w-3.5" />
                絞り込みを解除
              </button>
            </span>
          )}
          <label className="flex items-center gap-1 text-sm text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={errorRowsOnly}
              disabled={filterSummary !== null}
              onChange={(e) => setErrorRowsOnly(e.target.checked)}
            />
            エラー行のみ
          </label>
        </div>
      </div>
      <div className="min-h-0 w-full flex-1">
        <AgGridReact<BillingEdiDetailRow>
          ref={gridRef}
          rowData={displayedRows}
          columnDefs={columnDefsWithTooltip}
          defaultColDef={DETAIL_DEFAULT_COL_DEF}
          getContextMenuItems={gridFilterContextMenuItems}
          domLayout="normal"
          getRowId={(params) => params.data.id}
          onCellValueChanged={handleCellValueChanged}
          context={gridContext}
          // 行・列の表示やフォーカスが変わるたびに「n / N 件」を数え直す
          onCellFocused={refreshErrorCellNav}
          onModelUpdated={refreshErrorCellNav}
          onDisplayedColumnsChanged={refreshErrorCellNav}
          stopEditingWhenCellsLoseFocus={true}
          {...GRID_BASE_PROPS}
          {...gridColumnStateProps}
          statusBar={GRID_STATUS_BAR}
        />
      </div>
    </div>
  );
}
