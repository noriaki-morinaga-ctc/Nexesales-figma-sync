// 追加・コピーで増えた行を見つけやすくする共通フック。
//
// 行追加は React の state 更新で行うため、追加した直後はまだグリッドに行が無い。
// そこで markRows で行IDを記録しておき、グリッドの onRowDataUpdated（＝行が反映された
// 後）に、さらに描画が済む次フレームで次の順に行う。
//   1. グリッド内部で新規行までスクロール。一瞬で飛ぶと何が起きたか分からないため、
//      約0.45秒かけてなめらかに動かす（UI/UX UX-047。視差効果を減らす設定ではすぐ動かす）
//   2. スクロールが止まった次のフレームで、新規行が画面で見えていなければ
//      ページ側のスクロール領域も同じようになめらかに動かす
//   3. 動きが止まってから、行全体をフラッシュし、指定があれば先頭セルへフォーカスを移す
//      （描画し直したセルがまだ DOM を持たないうちに flashCells を呼ぶと AG Grid 内部で
//      例外になるため、スクロールと同じフレームでは行わない）
//
// タブ・フィルタで新規行が表示対象外のときは行が存在しないため、何もしない。
import { useCallback, useMemo, useRef } from 'react';
import type { GridApi, IRowNode } from 'ag-grid-community';

// 行フラッシュの既定時間（ms）。追加・コピーした行は1秒強調する（→ 02 §8「行の追加位置」・UX-112）。
const DEFAULT_FLASH_DURATION_MS = 1000;
const DEFAULT_FADE_DURATION_MS = 300;
// 強調のあいだ行に付ける属性。値は行の _copySource（new／detail／reference）で、
// grid.css がその色（左端の帯の色を薄くした色）で光らせる。
const REVEAL_SOURCE_ATTR = 'data-reveal-source';

// 行の追加経路（左端の帯）。帯の無い行は null（AG Grid 標準の色で光る）。
const copySourceOf = (node: IRowNode): string | null => {
  const source = (node.data as { _copySource?: unknown } | undefined)
    ?._copySource;
  return typeof source === 'string' ? source : null;
};
// 可視域へ寄せるときに上端へ残す余白（px）。
const TOP_GAP_PX = 8;
// なめらかなスクロールにかける時間（ms）。
const SMOOTH_SCROLL_MS = 450;

// 動き始めと終わりをゆっくりにする（ease-in-out）。
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// OS の「視差効果を減らす」設定のときは動かさず、すぐ移す。
const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 要素の縦スクロール位置を、なめらかに to まで動かし、終わったら done を呼ぶ。
// scrollTo の behavior:'smooth' はブラウザごとに時間が違い、終わりも分からないため自前で動かす。
const animateScrollTop = (
  el: HTMLElement,
  to: number,
  done: () => void
): void => {
  const max = Math.max(0, el.scrollHeight - el.clientHeight);
  const target = Math.min(max, Math.max(0, to));
  const from = el.scrollTop;
  if (Math.abs(target - from) < 1 || prefersReducedMotion()) {
    el.scrollTop = target;
    done();
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / SMOOTH_SCROLL_MS);
    el.scrollTop = from + (target - from) * easeInOutCubic(t);
    if (t < 1) window.requestAnimationFrame(step);
    else done();
  };
  window.requestAnimationFrame(step);
};

// グリッドの明細の表示域（縦にスクロールする .ag-body-viewport）を探す。
// API から DOM は取れないため、描画中の行の要素から辿る（同じ行IDの別グリッドと
// 取り違えないよう、行番号と今のスクロール位置も照合する）。
const bodyViewportOf = (api: GridApi): HTMLElement | null => {
  const top = api.getVerticalPixelRange().top;
  for (const node of api.getRenderedNodes()) {
    if (node.id == null || node.rowPinned) continue;
    const el = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.ag-center-cols-container .ag-row'
      )
    ).find(
      (e) =>
        e.getAttribute('row-id') === node.id &&
        e.getAttribute('row-index') === String(node.rowIndex)
    );
    const viewport = el?.closest<HTMLElement>('.ag-body-viewport');
    if (viewport && Math.abs(viewport.scrollTop - top) < 2) return viewport;
  }
  return null;
};

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
        const head = nodes[0];
        const headIndex = head.rowIndex as number;

        // スクロールが止まった後：ページ側を寄せてから、強調・フォーカス
        const finish = () => {
          // 行全体をフラッシュし、指定があれば先頭セルへフォーカスを移す
          if (focusColumn) api.setFocusedCell(headIndex, focusColumn);
          // 光らせるあいだ、行（左右の固定列を含む同じ行IDの要素）に追加経路を付け、
          // 左端の帯の色を薄くした色で光らせる（grid.css）。同じ行IDの別グリッドに付けないよう、
          // 先頭行の要素が属するグリッドの中だけで探す。
          // 光っているあいだに AG Grid が行の要素を描き直すと属性が消えるため、
          // 光り終わるまで毎フレーム付け直し、終わったら外す。
          const sources = nodes
            .map((node) => ({ id: node.id, source: copySourceOf(node) }))
            .filter(
              (x): x is { id: string; source: string } =>
                x.id != null && x.source != null
            );
          const gridOf = (): HTMLElement | null =>
            head.id
              ? (rowElementOf(head.id)?.closest<HTMLElement>(
                  '.ag-root-wrapper'
                ) ?? null)
              : null;
          const markRowsOnPage = () => {
            const gridEl = gridOf();
            if (!gridEl) return;
            gridEl.querySelectorAll<HTMLElement>('.ag-row').forEach((el) => {
              const hit = sources.find(
                (x) => x.id === el.getAttribute('row-id')
              );
              if (hit && el.getAttribute(REVEAL_SOURCE_ATTR) !== hit.source)
                el.setAttribute(REVEAL_SOURCE_ATTR, hit.source);
            });
          };
          if (sources.length > 0) {
            markRowsOnPage();
            const until = performance.now() + flashDuration + fadeDuration;
            const keepMarked = (now: number) => {
              if (now < until) {
                markRowsOnPage();
                window.requestAnimationFrame(keepMarked);
                return;
              }
              document
                .querySelectorAll<HTMLElement>(`[${REVEAL_SOURCE_ATTR}]`)
                .forEach((el) => el.removeAttribute(REVEAL_SOURCE_ATTR));
            };
            window.requestAnimationFrame(keepMarked);
          }
          api.flashCells({ rowNodes: nodes, flashDuration, fadeDuration });
        };
        const revealOnPage = () => {
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
            // 行が半分以上隠れているときだけスクロールする。
            // 下ペイン展開中は可視域が狭いため、少しでも見えていれば動かさない
            // （動かすと列見出しが画面外へ出てしまう）。
            // グリッド全体が可視域に収まるときはグリッドの上端（列見出し）を、収まらないときは
            // 新規行を上端へ寄せる（列見出しを残したまま新規行を見せる → UI/UX UX-048）。
            if (
              rowRect.top < scrollerTop ||
              rowRect.top + rowRect.height / 2 > clearBottom
            ) {
              const gridRect = (gridEl as HTMLElement).getBoundingClientRect();
              const fits = gridRect.height <= clearBottom - scrollerTop;
              const anchorTop = fits ? gridRect.top : rowRect.top;
              animateScrollTop(
                scroller,
                scroller.scrollTop + anchorTop - scrollerTop - TOP_GAP_PX,
                () => window.requestAnimationFrame(finish)
              );
              return;
            }
          }
          finish();
        };

        // 1. グリッド内部のスクロール。
        // 'top'：新規行を先頭（見出し行の直下）へ送る。
        // 'nearest'：見えていれば動かさず、隠れていれば最小限スクロールする（AG Grid の ensureIndexVisible の既定と同じ）。
        const viewport = bodyViewportOf(api);
        if (viewport && head.rowTop != null && head.rowHeight != null) {
          const { top, bottom } = api.getVerticalPixelRange();
          const rowTop = head.rowTop;
          const rowBottom = head.rowTop + head.rowHeight;
          let target = viewport.scrollTop;
          if (scrollPosition === 'top') target = rowTop;
          else if (rowTop < top) target = rowTop;
          else if (rowBottom > bottom)
            target = viewport.scrollTop + (rowBottom - bottom);
          // 2. スクロールで描画し直した行が DOM に揃う次フレームで、ページ側と強調を行う
          animateScrollTop(viewport, target, () =>
            window.requestAnimationFrame(revealOnPage)
          );
        } else {
          // 表示域が見つからないとき（描画中の行が無い等）は、AG Grid の API で移す
          api.ensureIndexVisible(
            headIndex,
            scrollPosition === 'top' ? 'top' : null
          );
          window.requestAnimationFrame(revealOnPage);
        }
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
