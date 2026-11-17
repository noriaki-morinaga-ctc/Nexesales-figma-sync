// 計画詳細(マージン率固定)：実販EDI（実販FACT）と計画行の突合の状態と操作（補足8-7.EDI反映 マッチングUI）。
// 明細の行（商品区分ごとの配列）は明細表 DetailTable が持ち、本フックは実販EDIの一覧と突合の操作を持つ。
//
// 突合のしかた（補足8-7 3.）：
//   ・EDI行（未突合の実販EDI）を計画行へドラッグする（AG Grid 公式の行のドラッグ。行は動かさない）
//   ・計画行1行とEDI行1行のチェックを付けて「選択した2行を突合」を押す（AG Grid 公式の行選択）
// 突合は確認を出さず、明細の上の帯で「突合しました。…［取消］」と知らせる（補足8-7 図1-2 のとおり。仮：
// 規約 02 §5 は完了をトーストで知らせるとしており、図・本文 X80 とあわせて UI は議論中）。
// 取消（帯・行頭）は確認ダイアログを出す（補足8-7 ④）。
// 突合しないまま保存すると、計画納価が空欄の明細として追加する（補足8-1 ルール④）。

import { useCallback, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import type {
  GridApi,
  RowClassParams,
  RowDragCancelEvent,
  RowDragEndEvent,
  RowDragEnterEvent,
  RowSelectionOptions,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { toast } from 'sonner';

import { CURRENT_USER_NAME } from '@/mocks/common/planBasicInfo';
import type { EdiActual, ProductData } from '@/types/salesPlanRetail';

import type { EdiMatchGridContext } from './utilsEdiColumns';
import {
  addedPlanRowOf,
  addedRowPlacementOf,
  ediMatchErrorOf,
  ediPriceDiffText,
  ediRowHintOf,
  ediRowOf,
  formatEdiPrice,
  isEdiMatchCandidate,
  matchedPlanRowOf,
  unmatchedPlanRowOf,
} from './utilsEdiMatching';

// 商品区分（section）→ その区分の明細の行
export type DetailSections = Record<string, ProductData[]>;

interface UseEdiMatchingOptions {
  // 実販EDIの一覧の初期値（最初の描画で1回だけ呼ぶ）
  initialActuals: () => EdiActual[];
  // 商品区分ごとの明細の行（明細表の状態）
  sections: DetailSections;
  // 未突合のまま保存したEDIを明細として追加したときに、商品区分ごとの行をまとめて置き換える
  setSections: (next: DetailSections) => void;
  // 突合・取消した計画行を明細表の状態へ反映する（id の一致で置き換える）
  syncPlanRow: (row: ProductData) => void;
  // セル編集を通らない値の変更のため、明細表の行を作り直す（→ 02 §7.1）
  bumpGridRebuild: () => void;
  // 未保存の状態にする（画面を移るときの確認に使う）
  markUnsaved: () => void;
  gridApiRef: RefObject<GridApi | null>;
  // 明細表の枠（ドラッグ中に、突合できる計画行へ枠を出すための属性を付ける）
  gridContainerRef: RefObject<HTMLDivElement | null>;
}

// 直前の突合（明細の上の帯に出し、帯の［取消］の対象にする。補足8-7 図1-2）
export interface LastEdiMatch {
  planRowId: string;
  summaryProduct: string;
  planPrice: string;
  ediPrice: string;
  diff: string;
}

// ドラッグ中のEDI行のサマリ商品（未突合の一覧の位置）を明細表の枠に付ける属性
const DRAG_ATTRIBUTE = 'data-edi-drag';

// 日時（YYYY/MM/DD HH:mm:ss）。手動で突合した日時として残す（補足8-7 ①）
const nowText = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export function useEdiMatching({
  initialActuals,
  sections,
  setSections,
  syncPlanRow,
  bumpGridRebuild,
  markUnsaved,
  gridApiRef,
  gridContainerRef,
}: UseEdiMatchingOptions) {
  const [ediActuals, setEdiActuals] = useState<EdiActual[]>(initialActuals);

  // 未突合の実販EDI と、その表示用の行（EDI行）
  const unmatchedActuals = useMemo(
    () => ediActuals.filter((edi) => edi.status === 'unmatched'),
    [ediActuals]
  );
  const unmatchedEdiRows = useMemo(
    () => unmatchedActuals.map(ediRowOf),
    [unmatchedActuals]
  );

  // 未突合の実販EDIのサマリ商品（重複なし）。ドラッグ中の枠のクラス名の番号に使う
  const unmatchedProducts = useMemo(
    () =>
      Array.from(new Set(unmatchedActuals.map((edi) => edi.summaryProduct))),
    [unmatchedActuals]
  );

  // 選択中の行の数（「選択した2行を突合」「選択解除」の活性に使う）
  const [selectedCount, setSelectedCount] = useState(0);

  // 突合の取消の確認ダイアログの対象の計画行
  const [cancelTarget, setCancelTarget] = useState<ProductData | null>(null);

  // 直前の突合（次に突合するか、その突合を取消すまで帯に出す）
  const [lastMatch, setLastMatch] = useState<LastEdiMatch | null>(null);

  const allPlanRows = useMemo(() => Object.values(sections).flat(), [sections]);

  const actualOf = useCallback(
    (id: string | undefined) => ediActuals.find((edi) => edi.id === id),
    [ediActuals]
  );

  // 行を作り直した後に、全セルの書式を描き直す。計画納価の塗り（EDI納価と違うか）は計画納価の値が
  // 変わらなくても変わるため、値が変わったセルだけを描き直す既定の更新では反映されない。
  const refreshCellStylesAfterRebuild = useCallback(() => {
    setTimeout(() => gridApiRef.current?.refreshCells({ force: true }), 0);
  }, [gridApiRef]);

  // 計画行1行とEDI行1行を突合する（ドラッグ・選択した2行の突合で共通）
  const matchRows = useCallback(
    (planRow: ProductData | undefined, ediRow: ProductData | undefined) => {
      const edi = actualOf(ediRow?._ediActualId);
      const error = ediMatchErrorOf(planRow, edi);
      if (error || !planRow || !edi) {
        toast.error(error ?? '突合できませんでした。');
        return;
      }
      syncPlanRow(matchedPlanRowOf(planRow, edi));
      setEdiActuals((prev) =>
        prev.map((item) =>
          item.id === edi.id
            ? {
                ...item,
                status: 'manual',
                planRowId: planRow.id,
                matchedAt: nowText(),
                matchedBy: CURRENT_USER_NAME,
              }
            : item
        )
      );
      gridApiRef.current?.deselectAll();
      markUnsaved();
      bumpGridRebuild();
      refreshCellStylesAfterRebuild();
      setLastMatch({
        planRowId: planRow.id ?? '',
        summaryProduct: planRow.summaryProduct,
        planPrice: formatEdiPrice(planRow.planPrice) || '-',
        ediPrice: formatEdiPrice(edi.ediPrice),
        diff: ediPriceDiffText(planRow.planPrice, edi.ediPrice) || '-',
      });
    },
    [
      actualOf,
      syncPlanRow,
      gridApiRef,
      markUnsaved,
      bumpGridRebuild,
      refreshCellStylesAfterRebuild,
    ]
  );

  // 「選択した2行を突合」
  const handleMatchSelected = useCallback(() => {
    const rows = (gridApiRef.current?.getSelectedRows() ?? []) as ProductData[];
    const ediRows = rows.filter((row) => row._ediRow);
    const planRows = rows.filter((row) => !row._ediRow);
    if (rows.length !== 2 || ediRows.length !== 1 || planRows.length !== 1) {
      toast.error('計画行1行とEDI行1行を選んでください。');
      return;
    }
    matchRows(planRows[0], ediRows[0]);
  }, [gridApiRef, matchRows]);

  // 「選択解除」
  const handleClearSelection = useCallback(() => {
    gridApiRef.current?.deselectAll();
  }, [gridApiRef]);

  const handleSelectionChanged = useCallback((event: SelectionChangedEvent) => {
    setSelectedCount(event.api.getSelectedRows().length);
  }, []);

  // 行頭の「取消」：確認ダイアログを出す
  const requestCancel = useCallback((row: ProductData) => {
    setCancelTarget(row);
  }, []);

  // 帯の［取消］：直前の突合の計画行を対象に、行頭の取消と同じ確認ダイアログを出す
  const requestCancelLastMatch = useCallback(() => {
    if (!lastMatch) return;
    const row = gridApiRef.current?.getRowNode(lastMatch.planRowId)?.data as
      | ProductData
      | undefined;
    if (row) setCancelTarget(row);
  }, [lastMatch, gridApiRef]);

  // 取消の確定：計画行は実販EDIを反映する前に、EDI実績は未突合に戻す（補足8-7 ④。削除・復元ではなく参照を外す）
  const confirmCancel = useCallback(() => {
    const target = cancelTarget;
    setCancelTarget(null);
    if (!target) return;
    // 明細表の行は編集で値が変わっているため、状態の行ではなく最新の行（node.data）を使う
    const latest =
      (target.id && gridApiRef.current?.getRowNode(target.id)?.data) || target;
    const edi = actualOf(latest._ediActualId);
    if (!edi) return;
    syncPlanRow(unmatchedPlanRowOf(latest, edi));
    setEdiActuals((prev) =>
      prev.map((item) =>
        item.id === edi.id
          ? {
              ...item,
              status: 'unmatched',
              planRowId: undefined,
              matchedAt: undefined,
              matchedBy: undefined,
            }
          : item
      )
    );
    // 帯に出している突合を取消したら、帯を消す
    setLastMatch((prev) => (prev?.planRowId === latest.id ? null : prev));
    markUnsaved();
    bumpGridRebuild();
    refreshCellStylesAfterRebuild();
    toast.success('突合を取り消しました。');
  }, [
    cancelTarget,
    gridApiRef,
    refreshCellStylesAfterRebuild,
    actualOf,
    syncPlanRow,
    markUnsaved,
    bumpGridRebuild,
  ]);

  const closeCancel = useCallback(() => setCancelTarget(null), []);

  // 保存時：未突合のまま残った実販EDIを、計画納価が空欄の明細として追加する（補足8-1 ルール④）。
  // 追加した件数を返す（0件なら何もしない）。
  const addUnmatchedAsRows = useCallback((): number => {
    if (unmatchedActuals.length === 0) return 0;
    const working: DetailSections = Object.fromEntries(
      Object.entries(sections).map(([section, rows]) => [section, [...rows]])
    );
    const addedIds = new Map<string, string>();
    unmatchedActuals.forEach((edi) => {
      const { section, index } = addedRowPlacementOf(
        working,
        edi.summaryProduct
      );
      const id = `edi-added-${edi.id}-${Date.now()}`;
      addedIds.set(edi.id, id);
      working[section] = [
        ...(working[section] ?? []).slice(0, index),
        addedPlanRowOf(edi, section, id),
        ...(working[section] ?? []).slice(index),
      ];
    });
    setSections(working);
    setEdiActuals((prev) =>
      prev.map((item) =>
        addedIds.has(item.id)
          ? { ...item, status: 'added', planRowId: addedIds.get(item.id) }
          : item
      )
    );
    bumpGridRebuild();
    return unmatchedActuals.length;
  }, [unmatchedActuals, sections, setSections, bumpGridRebuild]);

  // ── 行のドラッグ（EDI行 → 計画行）──
  const setDragAttribute = useCallback(
    (value: string | null) => {
      const el = gridContainerRef.current;
      if (!el) return;
      if (value === null) el.removeAttribute(DRAG_ATTRIBUTE);
      else el.setAttribute(DRAG_ATTRIBUTE, value);
    },
    [gridContainerRef]
  );

  // ドラッグを始めたら、そのEDI行と同じサマリ商品の突合先の候補へ枠を出す（行は描き直さず属性だけ変える）
  const handleRowDragEnter = useCallback(
    (event: RowDragEnterEvent<ProductData>) => {
      const row = event.node.data;
      if (!row?._ediRow) return;
      const index = unmatchedProducts.indexOf(row.summaryProduct);
      setDragAttribute(index >= 0 ? String(index) : null);
    },
    [unmatchedProducts, setDragAttribute]
  );

  // ドロップした計画行へ突合する（EDI行の外・同じ行へのドロップは何もしない）
  const handleRowDragEnd = useCallback(
    (event: RowDragEndEvent<ProductData>) => {
      setDragAttribute(null);
      const ediRow = event.node.data;
      const target = event.overNode?.data;
      if (!ediRow?._ediRow || !target || target.id === ediRow.id) return;
      if (event.overNode?.rowPinned) return;
      matchRows(target, ediRow);
    },
    [setDragAttribute, matchRows]
  );

  const handleRowDragCancel = useCallback(
    (_event: RowDragCancelEvent<ProductData>) => setDragAttribute(null),
    [setDragAttribute]
  );

  // 突合先の候補の計画行に、ドラッグ中の枠のクラスを付ける（EDI行のサマリ商品ごとに番号を分ける）
  const getRowClass = useCallback(
    (params: RowClassParams<ProductData>): string | undefined => {
      const row = params.data;
      if (!row || params.node.rowPinned || row._ediRow) return undefined;
      const index = unmatchedProducts.indexOf(row.summaryProduct);
      return index >= 0 && isEdiMatchCandidate(row, row.summaryProduct)
        ? `edi-drop-candidate-${index}`
        : undefined;
    },
    [unmatchedProducts]
  );

  // ドラッグ中の枠の CSS（明細表の <style> に足す）。色は gridStyles の CSS 変数で参照する
  const dragHighlightCss = useMemo(
    () =>
      unmatchedProducts
        .map(
          (_product, i) =>
            `.sales-detail-grid[${DRAG_ATTRIBUTE}="${i}"] .ag-row.edi-drop-candidate-${i} { outline: 0.125rem dashed var(--grid-edi-drop-border); outline-offset: -0.125rem; }`
        )
        .join('\n'),
    [unmatchedProducts]
  );

  // 突合できる行か（チェックボックスを出す行）：EDI行と、未突合の実販EDIの突合先の候補の計画行
  const isSelectableForMatch = useCallback(
    (row: ProductData | undefined): boolean =>
      !!row &&
      (!!row._ediRow ||
        unmatchedProducts.some((product) => isEdiMatchCandidate(row, product))),
    [unmatchedProducts]
  );

  // 行選択は未突合の実販EDIがあるときだけ使う（無いときは選択の列を出さない＝登録系の明細表の既定 → 02 §8）。
  // チェックボックスは突合に関わる行（EDI行と突合先の候補）にだけ出す（図1-1・1-2 は全行だが、
  // 2026-11-17 に関わる行だけでよいと決めた）。行のクリックでは選択しない（セルを編集するため）。
  const rowSelection = useMemo<RowSelectionOptions<ProductData> | undefined>(
    () =>
      unmatchedActuals.length === 0
        ? undefined
        : {
            mode: 'multiRow',
            checkboxes: (params) => isSelectableForMatch(params.data),
            headerCheckbox: false,
            enableClickSelection: false,
            isRowSelectable: (node) => isSelectableForMatch(node.data),
            hideDisabledCheckboxes: true,
          },
    [unmatchedActuals.length, isSelectableForMatch]
  );

  // 明細表の context に渡す操作
  const gridContext: EdiMatchGridContext = useMemo(
    () => ({
      onRequestCancelEdiMatch: requestCancel,
      ediRowHintOf: (row: ProductData) => {
        const edi = actualOf(row._ediActualId);
        return edi ? ediRowHintOf(edi, allPlanRows) : '';
      },
    }),
    [requestCancel, actualOf, allPlanRows]
  );

  return {
    unmatchedEdiRows,
    unmatchedCount: unmatchedActuals.length,
    selectedCount,
    cancelTarget,
    lastMatch,
    requestCancelLastMatch,
    rowSelection,
    getRowClass,
    dragHighlightCss,
    gridContext,
    handleMatchSelected,
    handleClearSelection,
    handleSelectionChanged,
    handleRowDragEnter,
    handleRowDragEnd,
    handleRowDragCancel,
    confirmCancel,
    closeCancel,
    addUnmatchedAsRows,
  };
}
