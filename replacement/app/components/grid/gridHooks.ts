// グリッド共通の再利用フック群。
// - useChangedCells：編集セルの変更ハイライト（黄）の追跡・判定
// - useGridColumnState：列状態（幅/並び/ソート/表示）の localStorage 永続化（固定は列定義どおり）
// - useFormulaSourceHighlight：計算式セルのホバーで算出元セルを枠線強調
// - useLinkedCellUndo：主セル編集に連動する従属セルを Undo/Redo で一括・厳密復元
import { useCallback, useMemo, useRef } from 'react';
import type { CellClassRules } from 'ag-grid-community';

// ─────────────────────────────────────────────────────────────────────────
// useChangedCells：編集セルの「変更ハイライト（黄）」共通仕様の中核フック（→ 02 §7.2）。
// 各画面で重複していた changedCellsRef／originalCellValuesRef／cellChangeKey／
// isCellChanged／記録処理を1箇所に集約する。色は gridStyles の changedCellStyle
// （GRID_COLORS.changedBg/Border）を単一ソースとして使う。
//
// 使い方（画面で直接フックを呼ぶ。ラッパーコンポーネントは用いない）：
//   - const { isCellChanged, trackCellChange, resetChangedCells } = useChangedCells();
//   - onCellValueChanged の冒頭で trackCellChange(params) を呼ぶ（変更/復帰で強調を出し入れ）。
//   - cellStyle で isCellChanged(params) を見て changedCellStyle を適用する。
//   - 保存確定時に resetChangedCells() で強調をクリアする。
export function useChangedCells() {
  // 変更されたセル（行ID::列ID）の集合。
  const changedCellsRef = useRef<Set<string>>(new Set());
  // 各セルの元値（初回編集時に記録）。元値へ戻したら強調を解除するため。
  const originalCellValuesRef = useRef<Map<string, string>>(new Map());

  // セルの一意キー（行ID::列ID）。列IDは colId 優先、無ければ field。
  const cellChangeKey = (params: any): string =>
    `${params.node?.id}::${params.column?.getColId?.() ?? params.colDef?.field}`;

  // 変更済みセルか（ヘッダー行・合計行=ピン留め行は対象外）。
  const isCellChanged = useCallback((params: any): boolean => {
    if (params?.data?._isHeader || params?.node?.rowPinned) return false;
    return changedCellsRef.current.has(cellChangeKey(params));
  }, []);

  // セル編集確定時に呼ぶ。元値を退避し、元値と異なれば強調に追加／同じなら解除。
  // 変更が残る場合 true を返す。
  const trackCellChange = useCallback((params: any): boolean => {
    const key = cellChangeKey(params);
    if (!originalCellValuesRef.current.has(key)) {
      originalCellValuesRef.current.set(key, String(params.oldValue ?? ''));
    }
    const orig = originalCellValuesRef.current.get(key) ?? '';
    const changed = String(params.newValue ?? '') !== orig;
    if (changed) changedCellsRef.current.add(key);
    else changedCellsRef.current.delete(key);
    return changed;
  }, []);

  // 保存確定時などに強調・元値記録をすべてクリアする。
  const resetChangedCells = useCallback((): void => {
    changedCellsRef.current.clear();
    originalCellValuesRef.current.clear();
  }, []);

  return { isCellChanged, trackCellChange, resetChangedCells };
}

export type UseChangedCells = ReturnType<typeof useChangedCells>;

// ─────────────────────────────────────────────────────────────────────────
// 保存済みの列状態を localStorage から読む（未保存・パース失敗時は null）。
// 画面側で「初回表示か（＝保存済み設定が無いか）」を判定したい場合に使う。
export function readSavedColumnState(storageKey: string): any[] | null {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : null;
  } catch {
    // パース失敗時は保存なし扱い（自動列幅調整にフォールバック）
    return null;
  }
}

// 現在の列状態を localStorage へ保存する。画面側で既定の列設定（初期非表示列・
// 自動列幅調整）を確定させた直後など、フックのイベント外で保存したい場合に使う。
export function saveGridColumnState(storageKey: string, api: any): void {
  localStorage.setItem(storageKey, JSON.stringify(api.getColumnState()));
}

// 保存済みの列状態に無い列（保存後に追加された列）を、列定義上の直前の列の後ろへ差し込む。
// applyColumnState(applyOrder: true) は state に無い列を末尾へ回すため、
// 列を追加すると保存済みのブラウザだけ右端に表示されてしまうのを防ぐ。
// defState は復元前の getColumnState()（＝列定義の順）。
export function withMissingColumnsInDefOrder(
  savedState: any[],
  defState: any[]
): any[] {
  const merged = [...savedState];
  const known = new Set(merged.map((s) => s.colId));
  defState.forEach((col, i) => {
    if (known.has(col.colId)) return;
    // 列定義上の直前にある既知の列の後ろ。無ければ先頭。
    let insertAt = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = merged.findIndex((s) => s.colId === defState[j].colId);
      if (k >= 0) {
        insertAt = k + 1;
        break;
      }
    }
    merged.splice(insertAt, 0, col);
    known.add(col.colId);
  });
  return merged;
}

// ─────────────────────────────────────────────────────────────────────────
// useGridColumnState：列状態（列幅・並び順・ソート・表示）を localStorage へ
// 保存／復元する共通フック。返り値を <AgGridReact> に spread するだけで永続化が有効に
// なる（AG Grid公式API使用）。storageKey は画面ごとに必ず一意にすること（衝突するため）。
interface UseGridColumnStateOptions {
  // 保存済み状態が無い初回のみ内容フィット（autoSize）する。不要な画面は false。
  autoSize?: boolean;
  // 画面独自の onGridReady があれば渡す（復元処理の後に連結実行される）。
  onGridReady?: (event: any) => void;
}

export function useGridColumnState(
  storageKey: string,
  options: UseGridColumnStateOptions = {}
) {
  const { autoSize = true, onGridReady } = options;

  // 初回マウント時点で保存済み状態があるか。autoSizeStrategy の要否判定にのみ使う。
  const hasSavedStateOnMount = useMemo(
    () => !!readSavedColumnState(storageKey),
    [storageKey]
  );

  // 現在の列状態を localStorage へ保存する共通処理
  const saveColumnState = useCallback(
    (api: any) => saveGridColumnState(storageKey, api),
    [storageKey]
  );

  // <AgGridReact> に spread するプロパティ一式を返す
  return useMemo(
    () => ({
      // 初期表示時に保存済み列状態を復元（公式：applyColumnState）。
      // 復元元はマウント時のスナップショットではなく都度 localStorage を読む。
      // 折り畳みカードの開閉などでグリッドだけが再生成される場合も、同一セッション内の
      // 直近の列状態（および画面側が保存した既定の列設定）を復元できるようにするため。
      onGridReady: (event: any) => {
        const savedColumnState = readSavedColumnState(storageKey);
        if (savedColumnState) {
          event.api.applyColumnState({
            // 列の固定（pinned）は保存済みの状態を使わず、常に列定義に従う。
            // 固定するのは右端の操作ボタン列だけとする方針（→ 02 §7「列の固定」）のため、
            // 以前に保存された左固定などがブラウザに残っていても戻さない。
            state: withMissingColumnsInDefOrder(
              savedColumnState.map(({ pinned: _pinned, ...rest }) => rest),
              event.api.getColumnState()
            ),
            applyOrder: true,
          });
        }
        // 画面独自の onGridReady を後続実行
        onGridReady?.(event);
      },
      // 列状態の変更（列幅・並び替え・ソート・表示）を都度保存（公式イベント）。
      // 固定（pinned）は復元しないため、固定の変更では保存しない。
      // 列幅・並び替えはドラッグ確定時(finished=true)のみ保存する。
      onColumnResized: (event: any) => {
        if (event.finished) saveColumnState(event.api);
      },
      onColumnMoved: (event: any) => {
        if (event.finished) saveColumnState(event.api);
      },
      onSortChanged: (event: any) => saveColumnState(event.api),
      onColumnVisible: (event: any) => saveColumnState(event.api),
      // 保存済み状態が無い場合のみ初期表示時に自動列幅調整（公式：autoSizeStrategy）。
      // 保存済みがある場合はその列幅を優先するため自動調整を無効化する。
      autoSizeStrategy:
        autoSize && !hasSavedStateOnMount
          ? ({ type: 'fitCellContents' } as const)
          : undefined,
    }),
    [storageKey, hasSavedStateOnMount, saveColumnState, autoSize, onGridReady]
  );
}

// ─────────────────────────────────────────────────────────────────────────
// useFormulaSourceHighlight：計算式（派生）セルにマウスを乗せると、その算出元セルの
// 枠線が変わる挙動の共通フック。
//   ※算出元セルの枠線色は grid.css の `.ag-cell.formula-ref-highlight` で定義。

// 計算式（派生）セルの定義。キーは列の colId（無ければ field）。
export interface FormulaDef<R> {
  // 行ごとに算出セルかどうかが変わる場合の判定（省略時は常に算出セル）。
  // 例: シミュレーション(マージン率固定・NET入力)は行ごとに
  //     「NETが算出／マージン率が設定値」と「マージン率が算出／NETが入力」が入れ替わる。
  isFormula?: (row: R) => boolean;
  // 同一行内の算出元フィールド。明細表が使う。
  refs?: (row: R) => string[];
  // 行をまたぐ算出元（セルキー）。集計表が別項目行を参照するのに使う。
  crossRefs?: (row: R, colId: string) => string[];
  // 計算式テキスト（式＋実値の2行）。省略時はセル値をそのままツールチップに出す。
  tooltip?: (row: R, colId: string) => string;
}
export type FormulaDefs<R> = Record<string, FormulaDef<R>>;

export interface FormulaSourceHighlightOptions<R> {
  // 計算式セルとして扱う行の追加条件（合計行・ヘッダー行を除外する等）。
  isEligibleRow?: (row: R) => boolean;
  // cellClassRules が使うセルキーの生成。既定は `${colId}::${rowId}`。
  // 集計表は行をノードキーで識別するため `${colId}::${data.key}` を渡す。
  cellKeyOf?: (params: any) => string;
}

// 列の識別子。増減列のように field を持たず colId だけの列があるため colId を優先する。
const colIdOf = (params: any): string =>
  params?.colDef?.colId ?? params?.colDef?.field ?? '';

const defaultCellKeyOf = (params: any): string =>
  `${colIdOf(params)}::${params?.node?.id ?? ''}`;

// 使い方（各グリッド側）:
//   const fx = useFormulaSourceHighlight<RowType>(FORMULA_DEFS, { isEligibleRow });
//   defaultColDef = { ..., cellClassRules: fx.cellClassRules, tooltipValueGetter: fx.tooltipValueGetter }
//   <AgGridReact onGridReady={(p) => fx.captureApi(p.api)}
//                onCellMouseOver={fx.onCellMouseOver}
//                onCellMouseOut={fx.onCellMouseOut}
//                tooltipShowDelay={300} tooltipHideDelay={5000} />
export function useFormulaSourceHighlight<R>(
  formulaDefs: FormulaDefs<R>,
  options: FormulaSourceHighlightOptions<R> = {}
) {
  // AG Grid API（枠線反映の refreshCells 用）。
  const apiRef = useRef<any>(null);
  // ハイライト中の算出元セルキーの集合。
  const highlightRef = useRef<Set<string>>(new Set());
  // options は毎レンダーで作られ得るため ref 経由で最新を読む。
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const setHighlight = (keys: string[]) => {
    const next = new Set(keys);
    const cur = highlightRef.current;
    // 同一集合なら再描画しない。
    if (cur.size === next.size && [...next].every((k) => cur.has(k))) return;
    highlightRef.current = next;
    apiRef.current?.refreshCells({ force: true });
  };

  return useMemo(() => {
    // 当該セルが計算式セルなら、その定義を返す。
    const defOf = (colId: string, row?: R): FormulaDef<R> | null => {
      const def = formulaDefs[colId];
      if (!def || !row) return null;
      const { isEligibleRow } = optionsRef.current;
      if (isEligibleRow && !isEligibleRow(row)) return null;
      if (def.isFormula && !def.isFormula(row)) return null;
      return def;
    };

    const cellKeyOf = (params: any) =>
      (optionsRef.current.cellKeyOf ?? defaultCellKeyOf)(params);

    return {
      // onGridReady で API を渡す。
      captureApi: (api: any) => {
        apiRef.current = api;
      },

      // 計算式セルにマウスオーバーしたら算出元セルをハイライト対象にする。
      // 1画面に複数グリッドがある場合に備え、対象グリッドの API をイベントから捕捉する。
      onCellMouseOver: (e: any) => {
        if (e?.api) apiRef.current = e.api;
        const colId = colIdOf(e);
        const row = e?.data as R | undefined;
        const def = defOf(colId, row);
        if (!def || !row) {
          setHighlight([]);
          return;
        }
        const rowId = e?.node?.id ?? '';
        setHighlight([
          ...(def.refs?.(row) ?? []).map((f) => `${f}::${rowId}`),
          ...(def.crossRefs?.(row, colId) ?? []),
        ]);
      },

      // セルから外れたらハイライトを解除する。
      onCellMouseOut: (e?: any) => {
        if (e?.api) apiRef.current = e.api;
        setHighlight([]);
      },

      // 画面遷移・タブ切替などで明示的に解除する。
      clear: () => setHighlight([]),

      // defaultColDef に渡す cellClassRules（算出元セルにクラス付与）。
      cellClassRules: {
        'formula-ref-highlight': (params: any) =>
          highlightRef.current.has(cellKeyOf(params)),
      } as CellClassRules,

      // 計算式セルは計算式テキストをツールチップ表示する。
      // それ以外は従来どおりセル値（列幅で省略された値の全文表示）。
      tooltipValueGetter: (params: any) => {
        const colId = colIdOf(params);
        const row = params?.data as R | undefined;
        const def = defOf(colId, row);
        if (def?.tooltip && row) return def.tooltip(row, colId);
        return params?.value ?? '';
      },

      isFormulaCell: (colId: string, row?: R) => !!defOf(colId, row),
    };
    // formulaDefs は各画面でモジュールスコープ定義（不変）のため依存に含めない。
    // options は optionsRef 経由で最新を読むため同様。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ─────────────────────────────────────────────────────────────────────────
// useLinkedCellUndo：主セル編集に連動して従属セル（自動補完・再計算・API取得値）を
// 更新する編集グリッドで、Undo/Redo を「主セル1回で従属セルごと一括・厳密復元」させる
// 共通フック（→ 02 §7.1）。
//
// 仕組み：
//   ・従属セルは setDataValue を使わず node.data 直接更新＋refreshCells で反映する。
//     これにより Undo スタックには「ユーザーが編集した主セル」だけが積まれ、Ctrl+Z 1回で
//     主セル・従属セルがまとめて戻る（多段 Undo・中間不整合を回避）。
//   ・主セル値ごとに従属セルを (行ID::主フィールド::主セル値) でキャッシュする。
//       A. 取得キャッシュ：未訪の値は deriveDeps で導出（同期 master／非同期 API）し記録。
//       B. 退避スナップショット：主セルを変更する度に、切替前（旧値）の現在の従属セルを記録。
//     AG Grid は Undo/Redo でも onCellValueChanged を source:'undo'/'redo' で再発火するため、
//     既訪の値へ戻る時はキャッシュから同期・厳密復元する（API を呼ばない）。B により、
//     master と乖離した既存値や手修正値も正確に戻せる。
//   ・非同期 deriveDeps はレースガード（行ごとの最新リクエスト番号）で古い応答を破棄する。
//
// 注意（画面側の責務）：syncState の setState は rowData 参照を変えない（rebuildトークンを
// bump しない）こと。グリッド再構築（モーダル編集・一括反映等）を行う時は clearCache() を呼ぶ。
//
// 使い方（各グリッド側）:
//   const { makeHandler, clearCache } = useLinkedCellUndo<RowType>();
//   // 列定義の onCellValueChanged に差す：
//   onCellValueChanged: makeHandler('summaryProduct', {
//     depFields: ['metaBrand', 'quantity', 'net', ...],
//     deriveDeps: (v, row) => recalc({ ...row, ...master(v) }), // or: async (v) => await fetchDeps(v)
//     syncState: (row) => routeSetStateBySection(row),
//   })
export interface LinkedCellUndoConfig<R> {
  // スナップショット・反映対象の従属フィールド（この主セルが連動させる列のみ）。
  depFields: (keyof R)[];
  // 主セル値から従属セル値を導出する。同期（master 参照）／非同期（API 取得）のどちらでも可。
  // row は主セル値を反映済みの現在行データ。返り値は depFields を含む部分オブジェクト。
  deriveDeps: (mainValue: string, row: R) => Partial<R> | Promise<Partial<R>>;
  // node.data 反映後の React state 同期（画面側 setState）。省略可。
  syncState?: (row: R) => void;
  // 行ID抽出（省略時 params.node.id）。
  rowIdOf?: (params: any) => string;
}

export function useLinkedCellUndo<R>() {
  // (行ID::主フィールド::主セル値) → 従属セル値スナップショット。
  const cacheRef = useRef<Map<string, Partial<R>>>(new Map());
  // (行ID::主フィールド) → 最新リクエスト番号（非同期取得の古い応答を破棄するレースガード）。
  const reqSeqRef = useRef<Map<string, number>>(new Map());

  // 行データから depFields ぶんだけ抜き出す。
  const pickDeps = (row: any, fields: (keyof R)[]): Partial<R> => {
    const picked: any = {};
    for (const f of fields) picked[f] = row[f as string];
    return picked;
  };

  // node.data 直接更新＋当該行 refreshCells ＋ state 同期（Undoスタックに乗せない）。
  const commit = (
    params: any,
    deps: Partial<R>,
    cfg: LinkedCellUndoConfig<R>
  ): void => {
    Object.assign(params.data, deps);
    params.api.refreshCells({ rowNodes: [params.node], force: true });
    cfg.syncState?.({ ...params.data });
  };

  // 列の onCellValueChanged に差し込む共通ハンドラを生成する。
  const makeHandler = useCallback(
    (mainField: keyof R, cfg: LinkedCellUndoConfig<R>) =>
      async (params: any): Promise<void> => {
        const rowId = (cfg.rowIdOf?.(params) ??
          params?.node?.id ??
          '') as string;
        const base = `${rowId}::${String(mainField)}`;
        const oldKey = `${base}::${String(params.oldValue)}`;
        // Undo/Redo でも params.newValue には「戻し後／やり直し後」の主セル値が入る。
        const newValue = String(params.newValue ?? params.data[mainField]);
        const newKey = `${base}::${newValue}`;

        // B. 変更の度に、切替前（旧値）時点の現在の従属セルを退避（同期・厳密復元用）。
        cacheRef.current.set(oldKey, pickDeps(params.data, cfg.depFields));

        // 既訪の値（Undo/Redo・再選択）＝ キャッシュから同期復元（deriveDeps を呼ばない）。
        const cached = cacheRef.current.get(newKey);
        if (cached) {
          commit(params, cached, cfg);
          return;
        }

        // 未訪の値＝初回導出。deriveDeps が非同期(API)ならレースガードで最新のみ反映する。
        const seq = (reqSeqRef.current.get(base) ?? 0) + 1;
        reqSeqRef.current.set(base, seq);
        const result = cfg.deriveDeps(newValue, { ...params.data });
        const deps =
          result instanceof Promise ? await result.catch(() => null) : result;
        if (!deps) return; // 取得失敗：主セルのみ変更（Undo は有効）
        if (reqSeqRef.current.get(base) !== seq) return; // 古い応答は破棄
        const picked = pickDeps(deps, cfg.depFields);
        cacheRef.current.set(newKey, picked);
        commit(params, picked, cfg);
      },
    []
  );

  // グリッド再構築・保存確定時などにキャッシュを破棄する。
  const clearCache = useCallback((): void => {
    cacheRef.current.clear();
    reqSeqRef.current.clear();
  }, []);

  return { makeHandler, clearCache };
}
