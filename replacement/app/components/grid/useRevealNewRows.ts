// 追加・コピーで増えた行を見つけやすくする共通フック。
//
// 行追加は React の state 更新で行うため、追加した直後はまだグリッドに行が無い。
// そこで markRows で行IDを記録しておき、グリッドの onRowDataUpdated（＝行が反映された
// 後）に、さらに描画が済む次フレームで次の順に行う。
//   1. グリッド内部で新規行までスクロール（ensureIndexVisible）
//   2. スクロールで行が描画し直された次のフレームで、新規行が画面で見えていなければ
//      ページ側のスクロール領域も動かす
//   3. 行全体をフラッシュし、指定があれば先頭セルへフォーカスを移す
//      （描画し直したセルがまだ DOM を持たないうちに flashCells を呼ぶと AG Grid 内部で
//      例外になるため、1 と同じフレームでは行わない）
//
// タブ・フィルタで新規行が表示対象外のときは行が存在しないため、何もしない。
import { useCallback, useMemo, useRef } from 'react';
import type { GridApi, IRowNode } from 'ag-grid-community';

// 行フラッシュの既定時間（ms）。AG Grid 既定（0.5秒）では見落とすため長めにする。
const DEFAULT_FLASH_DURATION_MS = 1500;
const DEFAULT_FADE_DURATION_MS = 800;
// 可視域へ寄せるときに上端へ残す余白（px）。
const TOP_GAP_PX = 8;

// 要素の最も近いスクロール可能な祖先。
// scrollIntoView はスクロール可能な祖先をすべて動かしてしまうため、
// ページ側で動かす対象をこの1つに限定する。
const scrollParentOf = (el: HTMLElement): HTMLElement | null => {
  let parent: HTMLElement | null = el.parentElement;
  while (parent) {
    const overflowY = window.getComputedStyle(parent).overflowY;
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      parent.scrollHeight > parent.clientHeight + 1
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
};

// 行のDOM要素を探す。AG Grid は .ag-row に row-id 属性を付与する。
// 行IDに記号が含まれてもよいよう、セレクタではなく属性の照合で探す。
const rowElementOf = (rowId: string): HTMLElement | null =>
  Array.from(document.querySelectorAll<HTMLElement>('.ag-row')).find(
    (el) => el.getAttribute('row-id') === rowId
  ) ?? null;

// 記録したキー（行データそのもの／行ID）から行ノードを解決する。
// getRowId を設定していないグリッドでは行IDを外から指定できないため、
// 追加した行データの参照一致でも探せるようにする。
const resolveNode = (api: GridApi, key: RevealRowKey): IRowNode | null => {
  if (key === undefined || key === null) return null;
  if (typeof key === 'string' || typeof key === 'number') {
    return api.getRowNode(String(key)) ?? null;
  }
  let found: IRowNode | null = null;
  api.forEachNode((node) => {
    if (!found && node.data === key) found = node;
  });
  return found;
};

// 強調対象の指定方法：行データそのもの、または getRowId 準拠の行ID。
export type RevealRowKey = object | string | number | undefined | null;

export interface UseRevealNewRowsOptions {
  // 増えた行を自動で検出する。コピーボタンがペインを開き、行は親コンポーネントで
  // 追加されるなど、追加処理へ markRows を差し込めない画面で使う。
  // 行データの参照を覚えておき、行数が増えたときに初めて現れた行だけを強調する
  // （セル編集は行数が変わらないため対象外）。
  autoDetect?: boolean;
  // フォーカスを移す列の field / colId。省略時はフォーカスを移さない。
  focusColumn?: string;
  // 行フラッシュの点灯・フェード時間（ms）。
  flashDuration?: number;
  fadeDuration?: number;
  // グリッド内のスクロールの仕方。
  //   'top'（既定）：新規行をグリッドの先頭（見出し行の直下）へ送る。
  //   'nearest'：新規行が見えていれば動かさず、隠れているときだけ最小限スクロールする。
  //     コピー元の行の直下に出す画面で使う（'top' だとコピー元が上へ流れて見えなくなり、
  //     押した直後に一覧がずれて別の行のボタンを押してしまう）。
  scrollPosition?: 'top' | 'nearest';
}

export interface UseRevealNewRows {
  // onGridReady で Grid API を渡す（既に API を保持している画面はその場で渡してよい）。
  captureApi: (api: GridApi) => void;
  // 追加・コピーした行（行データまたは行ID）を記録する。
  // 実際の強調は行がグリッドへ反映された後に行われる。
  markRows: (rows: RevealRowKey[]) => void;
  // グリッドの onRowDataUpdated へ渡すハンドラ。
  // イベントから Grid API を受け取るため、captureApi を呼ばない画面でも使える。
  onRowDataUpdated: (event?: { api: GridApi }) => void;
}

export function useRevealNewRows(
  options: UseRevealNewRowsOptions = {}
): UseRevealNewRows {
  const {
    autoDetect = false,
    focusColumn,
    flashDuration = DEFAULT_FLASH_DURATION_MS,
    fadeDuration = DEFAULT_FADE_DURATION_MS,
    scrollPosition = 'top',
  } = options;

  const apiRef = useRef<GridApi | null>(null);
  const pendingRowsRef = useRef<RevealRowKey[]>([]);
  // autoDetect 用：既に見た行データと、直前の行数。
  const seenRowsRef = useRef<WeakSet<object>>(new WeakSet());
  const prevRowCountRef = useRef<number | null>(null);

  const captureApi = useCallback((api: GridApi) => {
    apiRef.current = api;
  }, []);

  const markRows = useCallback((rows: RevealRowKey[]) => {
    pendingRowsRef.current = rows.filter(
      (row) => row !== undefined && row !== null
    );
  }, []);

  // autoDetect：行数が増えたときだけ、初めて現れた行データを強調対象にする。
  const collectAddedRows = useCallback((api: GridApi): RevealRowKey[] => {
    const all: object[] = [];
    api.forEachNode((node) => {
      if (node.data) all.push(node.data as object);
    });
    const added = all.filter((data) => !seenRowsRef.current.has(data));
    all.forEach((data) => seenRowsRef.current.add(data));
    const prevCount = prevRowCountRef.current;
    prevRowCountRef.current = all.length;
    // 初回描画と、行数が増えていない更新（セル編集・絞り込み）は対象外
    if (prevCount === null || all.length <= prevCount) return [];
    return added;
  }, []);

  const onRowDataUpdated = useCallback(
    (event?: { api: GridApi }) => {
      if (event?.api) apiRef.current = event.api;
      if (autoDetect && apiRef.current && pendingRowsRef.current.length === 0) {
        pendingRowsRef.current = collectAddedRows(apiRef.current);
      }
      const keys = pendingRowsRef.current;
      if (keys.length === 0) return;
      const api = apiRef.current;
      if (!api) return;
      pendingRowsRef.current = [];
      // 行が追加された直後はセルがまだ描画されておらず flashCells が効かないため、
      // 描画が済む次フレームまで待ってから強調・スクロールを行う。
      window.requestAnimationFrame(() => {
        const nodes = keys
          .map((key) => resolveNode(api, key))
          .filter((n): n is IRowNode => !!n && n.rowIndex != null);
        if (nodes.length === 0) return;
        const headIndex = nodes[0].rowIndex as number;

        // 'top'：グリッド内部で新規行を先頭へ送る。これで新規行は見出し行の直下に来る。
        // 'nearest'：位置を指定しない（AG Grid 公式の既定＝見えていれば動かさず、隠れていれば最小限スクロール）。
        api.ensureIndexVisible(
          headIndex,
          scrollPosition === 'top' ? 'top' : null
        );

        // スクロールで描画し直した行が DOM に揃う次フレームで、残りを行う
        window.requestAnimationFrame(() => {
          // 新規行が画面で見えていなければ、ページ側のスクロール領域も動かす。
          const rowEl = nodes[0].id ? rowElementOf(nodes[0].id) : null;
          const gridEl =
            rowEl?.closest<HTMLElement>('.ag-root-wrapper') ?? null;
          const scroller = gridEl ? scrollParentOf(gridEl) : null;
          if (rowEl && scroller) {
            // 下ペイン表示中は画面下部が覆われる。<main> の padding-bottom がその高さに
            // なるため、これを除いた位置を可視域の下端とみなす。
            const main = scroller.closest('main') ?? scroller;
            const padBottom =
              parseFloat(window.getComputedStyle(main).paddingBottom) || 0;
            const clearBottom = main.getBoundingClientRect().bottom - padBottom;
            const scrollerTop = scroller.getBoundingClientRect().top;
            const rowRect = rowEl.getBoundingClientRect();
            // 行が半分以上隠れているときだけ、行が上端へ来るようにスクロールする。
            // 下ペイン展開中は可視域が狭いため、少しでも見えていれば動かさない
            // （動かすと列見出しが画面外へ出てしまう）。
            if (
              rowRect.top < scrollerTop ||
              rowRect.top + rowRect.height / 2 > clearBottom
            ) {
              scroller.scrollTop += rowRect.top - scrollerTop - TOP_GAP_PX;
            }
          }

          // 行全体をフラッシュし、指定があれば先頭セルへフォーカスを移す
          if (focusColumn) api.setFocusedCell(headIndex, focusColumn);
          api.flashCells({ rowNodes: nodes, flashDuration, fadeDuration });
        });
      });
    },
    [
      autoDetect,
      collectAddedRows,
      focusColumn,
      flashDuration,
      fadeDuration,
      scrollPosition,
    ]
  );

  // 戻り値を固定し、画面側の useCallback の依存配列へ入れても作り直しが起きないようにする
  return useMemo(
    () => ({ captureApi, markRows, onRowDataUpdated }),
    [captureApi, markRows, onRowDataUpdated]
  );
}
