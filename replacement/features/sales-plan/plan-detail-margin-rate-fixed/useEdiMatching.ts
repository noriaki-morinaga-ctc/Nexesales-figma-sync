// 計画詳細(マージン率固定)：実販EDI（実販FACT）と計画行の突合の状態と操作（補足8-7.EDI反映 マッチングUI）。
// 明細の行（商品区分ごとの配列）は明細表 DetailTable が持ち、本フックは実販EDIの一覧と突合の操作を持つ。
//
// 実販EDIの反映（バッチ）で反映ルール①〜③に当たらなかった実績は、ルール④で計画行として追加され、
// 行頭に「追加」が付く（補足8-1）。突合は、この追加の行を同じサマリ商品の元の計画行へまとめる操作：
//   ・追加の行を計画行へドラッグする（AG Grid 公式の行のドラッグ。行は動かさない）
//   ・計画行1行と追加の行1行のチェックを付けて「選択した2行を突合」を押す（AG Grid 公式の行選択）
// 突合すると、追加の行の実販函数・EDI納価が計画行へ移り、追加の行は無くなる（課題 No.0596・決定事項 No.565）。
// 突合しなければ、追加の行は計画行のまま残る（保存しても変わらない）。
// 突合は確認を出さず、明細の上の帯で「突合しました。…［取消］」と知らせる（補足8-7 図1-2 のとおり。仮：
// 規約 02 §5 は完了をトーストで知らせるとしており、図・本文 X80 とあわせて UI は議論中）。
// 取消（帯・行頭）は確認ダイアログを出す（補足8-7 ④）。取り消すと追加の行に戻る。

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
  addedRowHintOf,
  addedRowIdOf,
  ediMatchErrorOf,
  ediPriceDiffText,
  formatEdiPrice,
  isAddedByEdiRow,
  isEdiMatchCandidate,
  matchedPlanRowOf,
  sectionsAfterCancel,
  sectionsAfterMatch,
  unmatchedPlanRowOf,
} from './utilsEdiMatching';

// 商品区分（section）→ その区分の明細の行
export type DetailSections = Record<string, ProductData[]>;

interface UseEdiMatchingOptions {
  // 実販EDIの一覧の初期値（最初の描画で1回だけ呼ぶ）
  initialActuals: () => EdiActual[];
  // 商品区分ごとの明細の行（明細表の状態）
  sections: DetailSections;
  // 突合・取消で行が増減するため、商品区分ごとの行をまとめて置き換える
  setSections: (next: DetailSections) => void;
  // 行を作り直す（→ 02 §7.1）
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

// ドラッグ中の追加の行のサマリ商品（追加の行のサマリ商品の一覧の位置）を明細表の枠に付ける属性
const DRAG_ATTRIBUTE = 'data-edi-drag';

// 突合先の計画行の枠（青い破線。補足8-7 図1-1）
const EDI_FRAME_CSS =
  'outline: 0.125rem dashed var(--grid-edi-drop-border); outline-offset: -0.125rem;';

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
  bumpGridRebuild,
  markUnsaved,
  gridApiRef,
  gridContainerRef,
}: UseEdiMatchingOptions) {
  const [ediActuals, setEdiActuals] = useState<EdiActual[]>(initialActuals);

  // 反映ルール④で計画行として追加した実販EDI（突合の元になる）
  const addedActuals = useMemo(
    () => ediActuals.filter((edi) => edi.status === 'added'),
    [ediActuals]
  );

  // 追加の行のサマリ商品（重複なし）。ドラッグ中の枠のクラス名の番号に使う
  const addedProducts = useMemo(
    () => Array.from(new Set(addedActuals.map((edi) => edi.summaryProduct))),
    [addedActuals]
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

  // 明細表の行は編集で値が変わっているため、状態の行ではなく最新の行（node.data）を使う
  const latestRowOf = useCallback(
    (row: ProductData): ProductData =>
      ((row.id && gridApiRef.current?.getRowNode(row.id)?.data) as
        | ProductData
        | undefined) ?? row,
    [gridApiRef]
  );

  // 行を作り直した後に、全セルの書式を描き直す。計画納価の塗り（EDI納価と違うか）は計画納価の値が
  // 変わらなくても変わるため、値が変わったセルだけを描き直す既定の更新では反映されない。
  const refreshCellStylesAfterRebuild = useCallback(() => {
    setTimeout(() => gridApiRef.current?.refreshCells({ force: true }), 0);
  }, [gridApiRef]);

  // 計画行1行と追加の行1行を突合する（ドラッグ・選択した2行の突合で共通）
  const matchRows = useCallback(
    (planRow: ProductData | undefined, addedRow: ProductData | undefined) => {
      const edi = actualOf(addedRow?._ediActualId);
      const error = ediMatchErrorOf(planRow, edi);
      if (error || !planRow || !addedRow || !edi) {
        toast.error(error ?? '突合できませんでした。');
        return;
      }
      const latest = latestRowOf(planRow);
      setSections(
        sectionsAfterMatch(
          sections,
          matchedPlanRowOf(latest, edi),
          addedRow.id ?? ''
        )
      );
      setEdiActuals((prev) =>
        prev.map((item) =>
          item.id === edi.id
            ? {
                ...item,
                status: 'manual',
                planRowId: latest.id,
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
        planRowId: latest.id ?? '',
        summaryProduct: latest.summaryProduct,
        planPrice: formatEdiPrice(latest.planPrice) || '-',
        ediPrice: formatEdiPrice(edi.ediPrice),
        diff: ediPriceDiffText(latest.planPrice, edi.ediPrice) || '-',
      });
    },
    [
      actualOf,
      latestRowOf,
      sections,
      setSections,
      gridApiRef,
      markUnsaved,
      bumpGridRebuild,
      refreshCellStylesAfterRebuild,
    ]
  );

  // 「選択した2行を突合」
  const handleMatchSelected = useCallback(() => {
    const rows = (gridApiRef.current?.getSelectedRows() ?? []) as ProductData[];
    const addedRows = rows.filter(isAddedByEdiRow);
    const planRows = rows.filter((row) => !isAddedByEdiRow(row));
    if (rows.length !== 2 || addedRows.length !== 1 || planRows.length !== 1) {
      toast.error('計画行1行と、行頭が「追加」の行1行を選んでください。');
      return;
    }
    matchRows(planRows[0], addedRows[0]);
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

  // 取消の確定：計画行は実販EDIを反映する前に戻し、その直下に追加の行を作り直す
  // （補足8-7 ④。実販EDIは削除・復元ではなく、反映先の参照を追加の行へ戻す）
  const confirmCancel = useCallback(() => {
    const target = cancelTarget;
    setCancelTarget(null);
    if (!target) return;
    const latest = latestRowOf(target);
    const edi = actualOf(latest._ediActualId);
    if (!edi) return;
    setSections(
      sectionsAfterCancel(sections, unmatchedPlanRowOf(latest, edi), edi)
    );
    setEdiActuals((prev) =>
      prev.map((item) =>
        item.id === edi.id
          ? {
              ...item,
              status: 'added',
              planRowId: addedRowIdOf(edi),
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
    latestRowOf,
    actualOf,
    sections,
    setSections,
    markUnsaved,
    bumpGridRebuild,
    refreshCellStylesAfterRebuild,
  ]);

  const closeCancel = useCallback(() => setCancelTarget(null), []);

  // ── 行のドラッグ（追加の行 → 計画行）──
  const setDragAttribute = useCallback(
    (value: string | null) => {
      const el = gridContainerRef.current;
      if (!el) return;
      if (value === null) el.removeAttribute(DRAG_ATTRIBUTE);
      else el.setAttribute(DRAG_ATTRIBUTE, value);
    },
    [gridContainerRef]
  );

  // ドラッグを始めたら、その追加の行と同じサマリ商品の突合先の候補へ枠を出す（行は描き直さず属性だけ変える）
  const handleRowDragEnter = useCallback(
    (event: RowDragEnterEvent<ProductData>) => {
      const row = event.node.data;
      if (!row || !isAddedByEdiRow(row)) return;
      const index = addedProducts.indexOf(row.summaryProduct);
      setDragAttribute(index >= 0 ? String(index) : null);
    },
    [addedProducts, setDragAttribute]
  );

  // ドロップした計画行へ突合する（行の外・同じ行へのドロップは何もしない）
  const handleRowDragEnd = useCallback(
    (event: RowDragEndEvent<ProductData>) => {
      setDragAttribute(null);
      const addedRow = event.node.data;
      const target = event.overNode?.data;
      if (!addedRow || !isAddedByEdiRow(addedRow)) return;
      if (!target || target.id === addedRow.id) return;
      if (event.overNode?.rowPinned) return;
      matchRows(target, addedRow);
    },
    [setDragAttribute, matchRows]
  );

  const handleRowDragCancel = useCallback(
    (_event: RowDragCancelEvent<ProductData>) => setDragAttribute(null),
    [setDragAttribute]
  );

  // 突合先の候補の計画行に、ドラッグ中の枠のクラスを付ける（追加の行のサマリ商品ごとに番号を分ける）。
  // 追加の行には edi-row を付け、選択中の枠（突合先の計画行だけ）の対象から外す。
  const getRowClass = useCallback(
    (params: RowClassParams<ProductData>): string | undefined => {
      const row = params.data;
      if (!row || params.node.rowPinned) return undefined;
      if (isAddedByEdiRow(row)) return 'edi-row';
      const index = addedProducts.indexOf(row.summaryProduct);
      return index >= 0 && isEdiMatchCandidate(row, row.summaryProduct)
        ? `edi-drop-candidate-${index}`
        : undefined;
    },
    [addedProducts]
  );

  // 突合の枠の CSS（明細表の <style> に足す）。色は gridStyles の CSS 変数で参照する。
  // ・チェックを付けた突合先の計画行（追加の行は除く）に青い破線の枠を出す（補足8-7 図1-1 の P2）
  // ・ドラッグ中は、その追加の行と同じサマリ商品の突合先の候補に同じ枠を出す
  // 行に枠を付けるとセルの背景色で隠れるため、図1-1 と同じくセルごとに囲む。
  const dragHighlightCss = useMemo(
    () =>
      [
        `.sales-detail-grid .ag-row.ag-row-selected:not(.edi-row):not(.ag-row-pinned) .ag-cell { ${EDI_FRAME_CSS} }`,
        ...addedProducts.map(
          (_product, i) =>
            `.sales-detail-grid[${DRAG_ATTRIBUTE}="${i}"] .ag-row.edi-drop-candidate-${i} .ag-cell { ${EDI_FRAME_CSS} }`
        ),
      ].join('\n'),
    [addedProducts]
  );

  // 突合できる行か（チェックボックスを出す行）：追加の行と、その突合先の候補の計画行
  const isSelectableForMatch = useCallback(
    (row: ProductData | undefined): boolean =>
      !!row &&
      (isAddedByEdiRow(row) ||
        addedProducts.some((product) => isEdiMatchCandidate(row, product))),
    [addedProducts]
  );

  // 行選択は追加の行があるときだけ使う（無いときは選択の列を出さない＝登録系の明細表の既定 → 02 §8）。
  // チェックボックスは突合に関わる行（追加の行と突合先の候補）にだけ出す（図1-1・1-2 は全行だが、
  // 2026-11-17 に関わる行だけでよいと決めた）。行のクリックでは選択しない（セルを編集するため）。
  const rowSelection = useMemo<RowSelectionOptions<ProductData> | undefined>(
    () =>
      addedActuals.length === 0
        ? undefined
        : {
            mode: 'multiRow',
            checkboxes: (params) => isSelectableForMatch(params.data),
            headerCheckbox: false,
            enableClickSelection: false,
            isRowSelectable: (node) => isSelectableForMatch(node.data),
            hideDisabledCheckboxes: true,
          },
    [addedActuals.length, isSelectableForMatch]
  );

  // 明細表の context に渡す操作
  const gridContext: EdiMatchGridContext = useMemo(
    () => ({
      onRequestCancelEdiMatch: requestCancel,
      addedRowHintOf: (row: ProductData) => {
        const edi = actualOf(row._ediActualId);
        return edi ? addedRowHintOf(edi, allPlanRows) : '';
      },
    }),
    [requestCancel, actualOf, allPlanRows]
  );

  return {
    addedCount: addedActuals.length,
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
  };
}
