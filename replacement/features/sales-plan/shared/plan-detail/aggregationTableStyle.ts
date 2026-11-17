import type { ValueGetterParams } from 'ag-grid-community';
import { GRID_COLORS } from '@/components/grid';

// 販売計画(集計)の年間集計・拡売費集計の表で共通の書式（UI/UX UX-095）。
// 項目（行を結合したセル）は左上・太字、計画／実績の行は名前も数値も太字、
// 項目と項目のあいだは濃い線（項目の中の行どうしは薄い線）。

/** 太字で強調するサブ項目（計画／実績の行） */
export const AGG_PRIMARY_SUB_ITEM = '計画／実績';

/** 年間集計の項目の列の幅（px。AG Grid の列の幅は px で書く → 02 §7「列の幅」） */
export const ANNUAL_ITEM_COL_WIDTH = 120;
/** 拡売費集計の種類別の列の幅（px） */
export const PROMOTION_ITEM_COL_WIDTH = 200;

/**
 * 項目のセル（行を結合したセル）の cellClass。
 * ag-cell-left：1列目の左寄せ、cell-span-top：結合したセルの中身を上に置く（grid.css）。
 */
export const AGG_ITEM_CELL_CLASS = 'ag-cell-left cell-span-top';

/**
 * 項目のセルの中身（セル描画部品の外側の要素）の className。
 * 文字は上から並べ、1行目を最初の行（計画／実績）の文字の高さにそろえる
 * （行の高さ約 2.25rem に対し、1行目の上に 0.625rem 空ける）。
 */
export const AGG_ITEM_CONTENT_CLASS =
  // 規約例外（2行ラベル）：勘定科目／管理区分の2行や長い項目名の折り返しを結合したセルに収めるため、行間を leading-tight（1.25）とする
  'flex items-start pt-2.5 font-bold text-sm leading-tight';

/** 開閉ボタンは1行目の文字と同じ高さにそろえる */
export const AGG_ITEM_TOGGLE_CLASS = 'flex h-lh items-center';

interface AggRowData {
  subItem?: string;
  isLastInGroup?: boolean;
}

/**
 * 太字にする行（計画／実績の行）か。サブ項目・数値のセルの cellStyle で
 * `fontWeight: isAggPrimaryRow(params.data) ? 'bold' : 'normal'` と書く
 * （値を 'bold'／'normal' の文字列で書く → 01 フォントウェイト）。
 */
export const isAggPrimaryRow = (data: AggRowData | undefined) =>
  data?.subItem === AGG_PRIMARY_SUB_ITEM;

/** 行の下の線（項目の最後の行は濃い線、それ以外は薄い線） */
export const aggRowBorderBottom = (data: AggRowData | undefined) =>
  data?.isLastInGroup
    ? `1px solid ${GRID_COLORS.strongDivider}`
    : `1px solid ${GRID_COLORS.gridLine}`;

// ── 項目の列での絞り込み（UX-097） ──
// 項目名・備考は項目の先頭の行（計画／実績）にしか無いため、そのままでは項目で絞り込むと
// 先頭の行だけが残り、配下のサブ項目（予算・前年実績・差・比）が消える。
// 列の filterValueGetter（AG Grid 公式）で、全行の絞り込みの値を「その行の項目」の値にする。

/** 項目の列の絞り込みの値：全行で項目名（groupName。改行は詰める） */
export const aggItemFilterValue = (params: ValueGetterParams): string =>
  String(params.data?.groupName ?? '').replace(/\n/g, '');

/**
 * 先頭の行にだけ値がある列（備考など）の絞り込みの値：全行で、同じ項目の先頭の行の値。
 * 備考は表の中で書き換えられるため、絞り込みのたびに先頭の行の今の値を引く。
 */
export const aggItemFirstRowFilterValue =
  (field: string) =>
  (params: ValueGetterParams): string => {
    const groupName = params.data?.groupName;
    let value = '';
    params.api.forEachNode((node) => {
      if (
        !value &&
        node.data?.isFirstInGroup &&
        node.data?.groupName === groupName
      )
        value = String(node.data?.[field] ?? '');
    });
    return value;
  };
