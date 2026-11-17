// 計画詳細(マージン率固定)：明細表の実販EDI（実販FACT）の突合に関わる列・セルの見せ方（補足8-7.EDI反映 マッチングUI）。
// 判定は utilsEdiMatching.ts、状態と操作は useEdiMatching.ts。

import type {
  CellClassParams,
  CellStyle,
  ColDef,
  ICellRendererParams,
  IRowDragItem,
  ITooltipParams,
  RowDragCallbackParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { Undo2 } from 'lucide-react';

import {
  GRID_COLORS,
  copySourceLeftBorder,
  requiredEmptyCellStyle,
} from '@/components/grid';
import { Badge } from '@/components/ui/badge';
import type { EdiMatchStatus, ProductData } from '@/types/salesPlanRetail';

import {
  EDI_MARKER_LABELS,
  EDI_STATUS_DESCRIPTIONS,
  ediPriceDiffText,
  formatEdiPrice,
  isEdiPriceDifferent,
} from './utilsEdiMatching';

type CellStyleFn = (
  params: CellClassParams<ProductData>
) => CellStyle | undefined;

type TooltipFn = (params: ITooltipParams<ProductData>) => string | undefined;

// 明細表の context に渡す、突合の操作（useEdiMatching が作る）
export interface EdiMatchGridContext {
  // 行頭の「取消」：突合の取消の確認を出す
  onRequestCancelEdiMatch: (row: ProductData) => void;
  // EDI行のツールチップ（一致する計画納価が無いことと突合先の候補）
  ediRowHintOf: (row: ProductData) => string;
}

// 行頭マーカーのバッジの色（文字と枠。白地）。自動＝緑／手動＝紫／追加＝赤／未突合＝青（補足8-7 図1-1・1-2）
const EDI_MARKER_BADGE_CLASS: Record<EdiMatchStatus, string> = {
  unmatched: 'border-blue-600 bg-white text-blue-700',
  auto1: 'border-green-600 bg-white text-green-700',
  auto2: 'border-green-600 bg-white text-green-700',
  auto3: 'border-green-600 bg-white text-green-700',
  manual: 'border-violet-600 bg-white text-violet-700',
  added: 'border-red-600 bg-white text-red-700',
};

const hasValue = (value: unknown): boolean => String(value ?? '').trim() !== '';

// 行の突合の状態（EDI行は未突合）。実販EDIを反映していない計画行は undefined。
const ediStatusOf = (
  row: ProductData | undefined
): EdiMatchStatus | undefined =>
  row?._ediRow ? 'unmatched' : row?.ediMatchStatus;

// EDI行（未突合）のセル：行全体を薄い藍にし、編集できないことを示す（補足8-7 図1-1）
export const ediRowCellStyle = (): CellStyle => ({
  backgroundColor: GRID_COLORS.ediUnmatchedRowBg,
});

// 行頭マーカーの列（補足8-7 ②）。計画行は突合の状態（自動・手動・追加）を出し、手動の行には「取消」を置く。
// EDI行は計画行へドラッグするためのハンドル（AG Grid 公式の rowDrag）と「未突合」を出す。
// コピー由来カラーバー（明細コピー・明細追加の左端の帯）も左端のこの列に付ける（→ 02 §10.1）。
export const buildEdiMarkerColumn = (
  baseCellStyle: CellStyleFn
): ColDef<ProductData> => ({
  headerName: 'EDI',
  colId: 'ediMarker',
  width: 88,
  cellClass: 'cell-center',
  sortable: false,
  headerTooltip:
    'EDI[自動表示]実販FACT（実販EDI）の突合の状態。自動＝反映ルールで自動で反映／手動＝担当者が突合（取消で戻せる）／追加＝未突合のまま保存して追加した明細／未突合＝一致する計画納価が無いEDI行（計画行へドラッグして突合する）',
  // EDI行だけドラッグできる（ドロップした計画行へ突合する。行は動かさない＝rowDragManaged なし）
  rowDrag: (params: RowDragCallbackParams<ProductData>) =>
    !!params.data?._ediRow && !params.node.rowPinned,
  rowDragText: (params: IRowDragItem) => {
    const row = params.rowNode?.data as ProductData | undefined;
    return `${row?.summaryProduct ?? ''}（EDI納価 ${formatEdiPrice(
      row?.ediPrice
    )}）を計画行へ突合`;
  },
  // 文言をセルの値にしてフィルタ・コピー・出力でも使えるようにする
  valueGetter: (params: ValueGetterParams<ProductData>) => {
    if (params.node?.rowPinned) return '';
    const status = ediStatusOf(params.data);
    return status ? EDI_MARKER_LABELS[status] : '';
  },
  tooltipValueGetter: (params: ITooltipParams<ProductData>) => {
    if (params.node?.rowPinned || !params.data) return undefined;
    if (params.data._ediRow) {
      return (params.context as EdiMatchGridContext).ediRowHintOf(params.data);
    }
    const status = ediStatusOf(params.data);
    return status ? EDI_STATUS_DESCRIPTIONS[status] : undefined;
  },
  cellStyle: (params: CellClassParams<ProductData>) => ({
    ...(baseCellStyle(params) || {}),
    ...copySourceLeftBorder(params.data?._copySource),
  }),
  cellRenderer: (params: ICellRendererParams<ProductData>) => {
    const row = params.data;
    if (!row || params.node.rowPinned) return null;
    const status = ediStatusOf(row);
    if (!status) return null;
    const badge = (
      <Badge variant="outline" className={EDI_MARKER_BADGE_CLASS[status]}>
        {EDI_MARKER_LABELS[status]}
      </Badge>
    );
    if (status !== 'manual') return badge;
    return (
      <span className="inline-flex items-center gap-1">
        {badge}
        <button
          type="button"
          onClick={() =>
            (params.context as EdiMatchGridContext).onRequestCancelEdiMatch(row)
          }
          className="p-1 rounded transition-colors text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          aria-label={`${row.summaryProduct}の突合を取消`}
          title="突合を取消"
        >
          <Undo2 className="w-4 h-4" />
        </button>
      </span>
    );
  },
});

// 突合できていないEDI納価のセルか（未突合のEDI行と、計画納価が空欄のまま実販EDIを反映した追加行）。
// 赤の塗りと、行ホバー中の文字の色（cell-edi-mismatch）で共通に使う。
export const isEdiPriceMismatch = (row: ProductData | undefined): boolean =>
  hasValue(row?.ediPrice) && (!!row?._ediRow || !hasValue(row?.planPrice));

// EDI反映のセル（補足8-7 図1-1・1-2）：
// ・未突合のEDI行と、計画納価が空欄のまま実販EDIを反映した行（追加行）は、赤の塗りで突合できていないことを知らせる
// ・計画行に反映済みのEDI納価は薄い緑（反映済み）。計画納価と違う（手動で突合した）ときは太字にする
export const ediPriceCellStyle =
  (baseCellStyle: CellStyleFn): CellStyleFn =>
  (params) => {
    const base = baseCellStyle(params);
    if (!base) return base;
    const row = params.data;
    if (!hasValue(row?.ediPrice)) return base;
    if (isEdiPriceMismatch(row)) {
      return {
        ...base,
        backgroundColor: GRID_COLORS.ediMismatchBg,
        color: GRID_COLORS.ediMismatchText,
        fontWeight: 'bold',
      };
    }
    return {
      ...base,
      backgroundColor: GRID_COLORS.ediReflectedBg,
      color: GRID_COLORS.ediReflectedText,
      ...(isEdiPriceDifferent(row?.planPrice, row?.ediPrice)
        ? { fontWeight: 'bold' }
        : {}),
    };
  };

// 計画納価のセル：計画納価とEDI納価が違う行（手動で突合した行など）は塗りで残す（補足8-7 ③。
// 閾値内で反映したときのアラートと同じ見せ方。以前の「差が±1.00以上なら赤字・太字」を置き換えた）。
export const withEdiPriceDiffFill =
  (baseCellStyle: CellStyleFn): CellStyleFn =>
  (params) => {
    const base = baseCellStyle(params);
    if (!base || params.data?._ediRow) return base;
    return isEdiPriceDifferent(params.data?.planPrice, params.data?.ediPrice)
      ? {
          ...base,
          backgroundColor: GRID_COLORS.ediPriceDiffBg,
          fontWeight: 'bold',
        }
      : base;
  };

// 計画納価のツールチップ：EDI納価と違うときは差を出す（違わないときは列の既定のツールチップ）
export const planPriceEdiTooltip =
  (fallback: TooltipFn): TooltipFn =>
  (params) => {
    const row = params.data;
    if (
      !params.node?.rowPinned &&
      !row?._ediRow &&
      isEdiPriceDifferent(row?.planPrice, row?.ediPrice)
    ) {
      return `計画納価 ${formatEdiPrice(row?.planPrice)}／EDI納価 ${formatEdiPrice(
        row?.ediPrice
      )}（差 ${ediPriceDiffText(row?.planPrice, row?.ediPrice)}）\n計画納価とEDI納価が違います。突合しても計画納価は書き換えません。`;
    }
    return fallback(params);
  };

// 未突合のまま保存して追加した行（追加行）の入力・選択欄が空欄のときは、必須未入力の強調を付ける
// （補足8-1 ルール④：商品区分・販促区分・計画函数・納価・売価は空欄で追加され、担当者が入力する → 02 §7.1.5）。
export const withAddedRowRequired =
  (field: keyof ProductData, baseCellStyle: CellStyleFn): CellStyleFn =>
  (params) => {
    const base = baseCellStyle(params);
    if (!base) return base;
    const row = params.data;
    return row?.ediMatchStatus === 'added' && !hasValue(row?.[field])
      ? requiredEmptyCellStyle(base)
      : base;
  };
