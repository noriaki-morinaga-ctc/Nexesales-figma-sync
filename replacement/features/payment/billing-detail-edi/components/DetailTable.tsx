// 請求詳細：請求明細エリア
// 「シングル画面案.xlsx ⑤-１請求・支払反映画面」の明細列に準拠し、AIC が入力する列を編集可、
// 支払・照合系（支払金額・差額（請求-支払）・照合区分・担当者・販売店・一次店・三次店）を
// 参照専用とする。数量×請求書記載単価・入数は入力値／マスタから自動算出する。
// データ元（EDI／AIC入力）は同シートに無い追加列で、明細の作成経路を示す参照専用列とする。
//
// 入力支援（PPT「To-Be 方向性」）：
//   ・Excel／OCR 結果の値をセル範囲へまとめて貼り付けできる（公式 cellSelection ＋ クリップボード）
//   ・サマリ商品名はコード下4桁でも検索して選択できる／得意先名は過去の入力リストから選択する
//   ・数量 × 請求単価を参考値として表示し、請求金額との突合に使う
//   ・明細行の追加・複製・削除
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { AgGridReact } from 'ag-grid-react';
import type {
  CellValueChangedEvent,
  ColDef,
  ColGroupDef,
  ICellRendererParams,
  NewValueParams,
} from 'ag-grid-community';
import { Copy, EllipsisVertical, Plus, Trash2 } from 'lucide-react';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { EditableComboboxCellEditor } from '@/components/ui/editable-combobox-cell-editor';
import { SingleComboboxCellEditor } from '@/components/ui/single-combobox-cell-editor';
import {
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  GRID_COLORS,
  copySourceLeftBorder,
  editableBg,
  useChangedCells,
  useGridColumnState,
  useRevealNewRows,
  useLinkedCellUndo,
  withHeaderTooltips,
  gridFilterContextMenuItems,
  GRID_MONTH_TEXT_FILTER,
  GRID_NUMBER_FILTER,
  GRID_EMPTY_TEXT,
  formatEmptyAsDash,
} from '@/components/grid';
import { parseFormulaNumber } from '@/components/grid/gridCommon';
import {
  formatBillingUnitPrice,
  roundBillingNumber,
} from '@/utils/payment/billing/billingNumberFormat';
import {
  billingCalcAmountOf,
  billingDiffOf,
  billingFormulaTooltipOf,
  billingUnitPriceOf,
  isBillingAmountMismatch,
} from '@/utils/payment/billing/billingDetailFormula';
import {
  BUTTON_STYLES,
  BUTTON_BASE,
  CARD_TITLE_CLASS,
} from '@/styles/commonStyles';
import {
  BILLING_EXPENSE_TYPE_OPTIONS,
  BILLING_UNIT_OPTIONS,
  BILLING_TAX_KBN_OPTIONS,
  BILLING_UNSET_CUSTOMER_CODE,
  BILLING_UNSET_CUSTOMER_NAME,
} from '@/constants/billing';
import {
  isBillingDetailStatusLocked,
  aggregateBillingDetailRows,
} from '@/utils/payment/billing/billing';
import {
  BILLING_CUSTOMER_LINK_BY_CODE,
  BILLING_SUMMARY_PRODUCT_BY_NAME,
  billingCustomerByStores,
  billingCustomerComboOptions,
  billingCustomerCodeComboOptions,
  billingStoreComboOptions,
  billingStoreDisplayName,
  billingSummaryProductComboOptions,
} from '@/mocks/common/billing';
import { createEmptyBillingDetailRow } from '@/utils/payment/billing/billing';
import type { BillingDetailStatus, BillingDetailRow } from '@/types/billing';

interface DetailTableProps {
  rows: BillingDetailRow[];
  // 行の増減（追加・複製・削除）。新しい配列を渡す（構造変化のみ rowData 参照が変わる）
  onRowsChange: (rows: BillingDetailRow[]) => void;
  // セル編集による値変更の通知（rows の参照は変えず Undo履歴を維持する。→ 02 §7.1）
  onValueChange: () => void;
  // 支払処理まで進んだ請求書は参照専用にする（本画面の明細は常に参照専用）
  readOnly?: boolean;
}

// 数値セルの入力値を数値へ変換する。Excel／OCR からの貼り付けで
// 「1,490」「¥1,490」のような表記が入るため、共通の parseFormulaNumber で正規化する。
// 数値として解釈できない値・空欄は null（未入力）にする。
const parseNumberCell = (value: unknown): number | null => {
  const parsed = parseFormulaNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// 請求書記載単価の入力値。数値へ正規化したうえで小数第3位を四捨五入し、
// 表示（小数第2位まで）と保持値がずれないようにする。
const parseUnitPriceCell = (value: unknown): number | null => {
  const parsed = parseNumberCell(value);
  return parsed == null ? null : roundBillingNumber(parsed);
};

// 数値の3桁区切り（小数は指定桁まで）
const formatNumber = (value: unknown, fractionDigits = 0): string =>
  typeof value === 'number'
    ? value.toLocaleString('ja-JP', {
        minimumFractionDigits: 0,
        maximumFractionDigits: fractionDigits,
      })
    : '';

// 支払処理まで進んだ明細（支払画面反映済／支払処理申請中／支払処理検印済）は行全体を参照専用にする。
const isLockedRow = (row: BillingDetailRow | undefined): boolean =>
  isBillingDetailStatusLocked(row?.status);

// 規約例外（画面ごとの部品）：AIC入力は明細を編集でき、請求EDIは参照専用で扱いが違うため、中身が似ていても今は画面ごとに持つ。後で共通化する可能性あり（→ 02 §12.2）
export function DetailTable({
  rows,
  onRowsChange,
  onValueChange,
  readOnly = false,
}: DetailTableProps) {
  const [isOpen, setIsOpen] = useState(true);
  const gridRef = useRef<AgGridReact<BillingDetailRow>>(null);

  // 行操作（追加・複製・削除）のハンドラは操作列のセルレンダラー経由で呼ばれる。
  // セルレンダラーは AG Grid の components（初期化時のみ反映されるグリッドオプション）に
  // 登録され、描画済みセルは登録時のクロージャを保持し続けるため、rows や採番カウンタを
  // 直接クロージャへ閉じ込めると古い値で行配列を組み直してしまう
  //（例：1行だけ削除したつもりが、削除前の配列に差し替わり他の変更が消える）。
  // 常に最新値を読めるよう ref で保持し、ハンドラの参照も安定させる（→ 02 §7.1）。
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  // 追加行のID採番（既存IDと重複しない連番）
  const addedSeqRef = useRef(0);

  const changed = useChangedCells();
  const { makeHandler, clearCache: clearLinkedCache } =
    useLinkedCellUndo<BillingDetailRow>();
  // 行の作り直し（行の追加・複製・削除）で行の値が入れ替わるため、連動セルのキャッシュも破棄する（→ 02 §7.3）
  const rowIdSignature = rows.map((row) => row.id).join(',');
  useEffect(() => {
    clearLinkedCache();
  }, [rowIdSignature, clearLinkedCache]);
  // 列構成の変更（操作列を右端固定へ移動・合計行/拡売費コード/摘要の削除、
  // v4：サマリ商品名をサマリ商品コード／サマリ商品名の2列へ分割、
  // v5：データ元列をステータス列の左に追加、
  // v6：得意先コード〜三次店をデータ元列の右へ移動、
  // v7：ステータスをデータ元列の右（得意先コードの左）へ移動、
  // v8：得意先コード〜三次店を請求書No. の後ろへ移動、
  // v9：データ元列を削除し入力単位の属性として基本情報へ移動、費目列を追加（決定19・23）、
  // v10：商品名（サマリ商品名の直後）・備考（右固定列の手前）を追加、
  // v11：販売店・一次店・三次店を「販売店→三次店→一次店」の順に並べ替え
  //（→ 20260821_第31回 決定事項8））に伴い
  // storageKey を更新する
  //（旧 localStorage の列状態が復元されると新列が末尾に回るため。→ 02 §9）
  // コピーで増えた行を見つけやすくする（行全体をフラッシュし可視域へ送る）。
  const reveal = useRevealNewRows();

  const gridColumnStateProps = useGridColumnState(
    'billingDetailEdi.columnState.v2',
    {
      onGridReady: (event) => {
        reveal.captureApi(event.api);
      },
    }
  );

  const productOptions = useMemo(() => billingSummaryProductComboOptions(), []);
  const customerOptions = useMemo(() => billingCustomerComboOptions(), []);
  const customerCodeOptions = useMemo(
    () => billingCustomerCodeComboOptions(),
    []
  );
  // 商流販売店（販売店・一次店・三次店）の選択肢。表記は「コード:名称」（→ 02 §9）。
  // AIC入力の入力単位では紐づけ表で導出できない明細を画面で選んで補える
  const storeOptions = useMemo(() => billingStoreComboOptions('storeName'), []);
  const primaryStoreOptions = useMemo(
    () => billingStoreComboOptions('primaryStore'),
    []
  );
  const tertiaryStoreOptions = useMemo(
    () => billingStoreComboOptions('tertiaryStore'),
    []
  );

  // 編集可否。請求EDIで取り込んだ入力単位は本画面では修正できず、誤りがあった場合は
  // 支払詳細画面で修正する（→ 20260821_第31回 決定事項13）。
  // このため本画面の明細セルはすべて編集不可とする。
  const isEditable = useCallback(() => false, []);

  // 全セル編集不可のため背景は灰で統一する（→ 02 §7.2）
  const inputStyle = useMemo(() => editableBg(false), []);

  const readonlyStyle = useMemo(() => editableBg(false), []);
  // 操作列（ボタンのみ）の背景。データセルではないため白で表示する
  const actionStyle = useMemo(() => editableBg(true), []);

  // 販売店・一次店・三次店のいずれかが未入力（未選択）の明細は「商流未設定」とする。
  // 得意先コード・得意先名から商流販売店変換マスタで導出できなかった場合と、
  // 導出後に手で消した場合の両方を同じ扱いにするため、3項目の入力有無だけで判定する。
  // 支払処理まで進んだ明細は支払側がステータスを持つため触らない。
  const resolveStoreStatus = (row: BillingDetailRow): BillingDetailStatus =>
    isLockedRow(row)
      ? row.status
      : row.storeName && row.primaryStore && row.tertiaryStore
        ? '支払画面未反映'
        : '商流未設定';

  // 商流未設定（販売店・一次店・三次店が埋まっていない）の行は1行全体を赤くハイライトする。
  // 紐づけマスタの更新が必要な明細を一覧で見つけられるようにするため。
  // 実際の配色は下の <style>（--billing-alert-bg）側。編集グリッドのため参照を固定する（→ 02 §7.1）
  const rowClassRules = useMemo(
    () => ({
      'billing-row-alert': (params: { data?: BillingDetailRow }) =>
        params.data?.status === '商流未設定',
    }),
    []
  );

  // サマリ商品名 → 入数（マスタ補完）。Undo は主セル1回で入数ごと戻る（→ 02 §7.3）
  const handleProductChanged = useMemo(
    () =>
      makeHandler('productName', {
        depFields: ['perCase'],
        deriveDeps: (value) => ({
          perCase: BILLING_SUMMARY_PRODUCT_BY_NAME.get(value)?.perCase ?? null,
        }),
      }),
    [makeHandler]
  );

  // 商流未設定の付け外しを行の色（rowClassRules）へ反映する。
  // 連動セルの共通フックは node.data 直接更新＋refreshCells のため行クラスが再評価されない。
  const withRowRedraw = useCallback(
    (handler: (params: any) => void | Promise<void>) =>
      async (params: any): Promise<void> => {
        await handler(params);
        params.api?.redrawRows?.({ rowNodes: [params.node] });
      },
    []
  );

  // 得意先名 → 得意先コード・担当者・販売店・一次店・三次店（商流販売店変換マスタから補完）。
  // 紐づけ表に無い得意先は「商流未設定」となり、紐づけマスタの更新対象になる。
  const handleCustomerChanged = useMemo(
    () =>
      withRowRedraw(
        makeHandler('customerName', {
          depFields: [
            'customerCode',
            'staffName',
            'storeName',
            'primaryStore',
            'tertiaryStore',
            'status',
          ],
          deriveDeps: (value, row) => {
            const link = Array.from(
              BILLING_CUSTOMER_LINK_BY_CODE.values()
            ).find((customer) => customer.customerName === value);
            return {
              customerCode: link?.customerCode ?? '',
              staffName: link?.staffName ?? '',
              storeName: billingStoreDisplayName(link?.storeName ?? ''),
              primaryStore: billingStoreDisplayName(link?.primaryStore ?? ''),
              tertiaryStore: billingStoreDisplayName(link?.tertiaryStore ?? ''),
              status: resolveStoreStatus({
                ...row,
                storeName: billingStoreDisplayName(link?.storeName ?? ''),
                primaryStore: billingStoreDisplayName(link?.primaryStore ?? ''),
                tertiaryStore: billingStoreDisplayName(
                  link?.tertiaryStore ?? ''
                ),
              }),
            };
          },
        })
      ),
    [makeHandler, withRowRedraw]
  );

  // 得意先コード → 得意先名・担当者・販売店・一次店・三次店（商流販売店変換マスタから補完）。
  // 得意先名と同じ紐づけ表を引くため、コード側から選んでも同じ結果になる。
  const handleCustomerCodeChanged = useMemo(
    () =>
      withRowRedraw(
        makeHandler('customerCode', {
          depFields: [
            'customerName',
            'staffName',
            'storeName',
            'primaryStore',
            'tertiaryStore',
            'status',
          ],
          deriveDeps: (value, row) => {
            const link = BILLING_CUSTOMER_LINK_BY_CODE.get(value);
            return {
              customerName: link?.customerName ?? '',
              staffName: link?.staffName ?? '',
              storeName: billingStoreDisplayName(link?.storeName ?? ''),
              primaryStore: billingStoreDisplayName(link?.primaryStore ?? ''),
              tertiaryStore: billingStoreDisplayName(link?.tertiaryStore ?? ''),
              status: resolveStoreStatus({
                ...row,
                storeName: billingStoreDisplayName(link?.storeName ?? ''),
                primaryStore: billingStoreDisplayName(link?.primaryStore ?? ''),
                tertiaryStore: billingStoreDisplayName(
                  link?.tertiaryStore ?? ''
                ),
              }),
            };
          },
        })
      ),
    [makeHandler, withRowRedraw]
  );

  // 販売店・三次店・一次店の編集で「商流未設定」を付け外しする。
  // 3項目のいずれかを空にすれば商流未設定に戻り、すべて埋まれば外れる。
  // あわせて得意先も切り替える。商流販売店が決まらない明細は支払側へ渡す先が無いため、
  // 得意先コード・得意先名を受け皿（商流未設定）へ寄せ、担当者は空にする。
  // 3項目を埋め直したときは、その組み合わせから得意先を逆引きして元に戻す
  // （逆引きできない組み合わせは空にして、得意先を選び直してもらう）。
  // ここでは連動セルの共通フック（useLinkedCellUndo）を使わない。同フックは導出結果を
  // 「行ID::主フィールド::主セル値」でキャッシュするため、他の2項目にも依存する本判定では
  // 別の組み合わせで求めた古い結果が復元されてしまう（例：三次店を空にしたまま
  // 販売店を選び直すと、以前その販売店だった時の空ステータスが戻る）。
  // ステータス・得意先は行の3項目から一意に決まる純粋な導出のため、変更のたびに計算し直す。
  // Undo/Redo でも onCellValueChanged が再発火するため、同じ計算で正しい値になる。
  const handleStoreChanged = useCallback(
    (params: NewValueParams<BillingDetailRow>) => {
      const row = params.data;
      if (!row || isLockedRow(row)) return;
      const next = resolveStoreStatus(row);
      if (next === '商流未設定') {
        row.customerCode = BILLING_UNSET_CUSTOMER_CODE;
        row.customerName = BILLING_UNSET_CUSTOMER_NAME;
        row.staffName = '';
      } else if (row.customerCode === BILLING_UNSET_CUSTOMER_CODE) {
        const link = billingCustomerByStores(row);
        row.customerCode = link?.customerCode ?? '';
        row.customerName = link?.customerName ?? '';
        row.staffName = link?.staffName ?? '';
      }
      row.status = next;
      // 行の色（rowClassRules）と得意先セルも再評価させるため、行ごと描き直す
      if (params.node) params.api.redrawRows({ rowNodes: [params.node] });
    },
    // resolveStoreStatus は素の関数のため依存に含めない（毎レンダー同一の判定）
    []
  );

  const columnDefs = useMemo<(ColDef<BillingDetailRow> | ColGroupDef)[]>(
    () => [
      {
        headerName: 'No.',
        colId: 'no',
        // 明細行の連番
        valueGetter: (params) =>
          params.context?.rowNoById?.get(params.data?.id ?? '') ?? '',
        width: 56,
        minWidth: 56,
        sortable: false,
        filter: false,
        resizable: false,
        suppressMovable: true,
        cellClass: 'cell-left',
        // 行の追加経路（明細コピー＝緑）を左端の帯で示す（→ 計画詳細と同じ共通表現）
        cellStyle: (params) => ({
          ...readonlyStyle,
          ...copySourceLeftBorder(params.data?._copySource),
        }),
      },
      // データ元は入力単位の属性として基本情報に表示する（決定23 2026-08-18）。
      // 同じ請求元企業事業所でも請求EDIとAIC入力は別の入力単位になるため、
      // 1つの入力単位の明細はすべて同じデータ元になり、明細の列としては持たない。
      {
        headerName: 'ステータス',
        field: 'status',
        cellClass: 'cell-left',
        cellStyle: readonlyStyle,
      },
      {
        // 対象月。請求EDI取込結果詳細から連携される（レコード区分4の対象期間（終了日）が属する月。
        // 終了日が空欄なら請求締日が属する月 → 20260804_第27回 決定事項8）。
        // 請求EDI取込結果詳細の項目からの増減が分かるよう、この画面にも持たせる
        //（→ 本コメントスレッド返信 梶田 2026-08-21）。
        headerName: '対象月',
        field: 'targetMonth',
        ...GRID_MONTH_TEXT_FILTER,
        headerTooltip:
          '対象期間（終了日）が属する月。終了日が空欄のときは請求締日が属する月',
        editable: isEditable,
        cellClass: 'cell-left',
        cellStyle: inputStyle,
      },
      {
        // 費目（追加口／拡売費）。取込時に卸ごとの判別ロジックで決まる。
        // 判別できなかった明細は追加口として取り込まれるため（決定19）、
        // その旨をこの画面で分かるようにする。誤りは支払詳細画面で拡売費に修正する。
        headerName: '費目',
        field: 'expenseType',
        headerTooltip:
          'AIC入力分は選択して入力する。請求EDI取込分は取込時に判別した結果を表示し、判別できなかった明細は追加口として取り込み赤字で示す',
        // AIC入力の入力単位は判別の元になるデータが無いため画面で選ぶ
        editable: isEditable,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: [...BILLING_EXPENSE_TYPE_OPTIONS] },
        valueFormatter: (params) =>
          params.data?.expenseUnresolved
            ? `${params.value}（判別不可）`
            : formatEmptyAsDash(params),
        tooltipValueGetter: (params) =>
          params.data?.expenseUnresolved
            ? '取込時に費目を判別できず、追加口として取り込みました。誤っている場合は支払詳細画面で拡売費に修正してください。'
            : '',
        cellClass: 'cell-left',
        cellStyle: (params) => {
          const base = inputStyle;
          return params.data?.expenseUnresolved
            ? { ...base, color: GRID_COLORS.overText }
            : base;
        },
        width: 104,
      },
      {
        headerName: '請求金額',
        field: 'billAmount',
        ...GRID_NUMBER_FILTER,
        headerTooltip:
          '数量×請求書記載単価と1円以上ずれている場合は赤字で示す（取込時にはチェックしない）',
        editable: isEditable,
        valueParser: (params) => parseNumberCell(params.newValue),
        valueFormatter: (params) =>
          formatNumber(params.value) || GRID_EMPTY_TEXT,
        cellClass: 'cell-right',
        cellStyle: (params) =>
          isBillingAmountMismatch(params.data)
            ? { ...inputStyle, color: GRID_COLORS.overText }
            : inputStyle,
      },
      {
        headerName: '支払金額',
        field: 'payAmount',
        valueFormatter: (params) =>
          formatNumber(params.value) || GRID_EMPTY_TEXT,
        cellClass: 'cell-right',
        cellStyle: readonlyStyle,
      },
      {
        headerName: '数量×請求書記載単価',
        colId: 'calcAmount',
        ...GRID_NUMBER_FILTER,
        headerTooltip:
          '数量 × 請求書記載単価（参考値。小数第3位を四捨五入して第2位まで）。請求金額とずれている場合は赤字で示す',
        valueGetter: (params) => billingCalcAmountOf(params.data),
        valueFormatter: (params) =>
          formatBillingUnitPrice(params.value) || GRID_EMPTY_TEXT,
        cellClass: 'cell-right',
        cellStyle: (params) =>
          isBillingAmountMismatch(params.data)
            ? { ...readonlyStyle, color: GRID_COLORS.overText }
            : readonlyStyle,
      },
      {
        // 名称は課題 No.1364 で「差額（請求-支払）」に決着した（合計サマリーバーと同一名称）
        headerName: '差額（請求-支払）',
        colId: 'diff',
        ...GRID_NUMBER_FILTER,
        headerTooltip: '請求金額 − 支払金額',
        valueGetter: (params) => billingDiffOf(params.data),
        valueFormatter: (params) =>
          formatNumber(params.value, 2) || GRID_EMPTY_TEXT,
        cellClass: 'cell-right',
        cellStyle: readonlyStyle,
      },
      {
        headerName: '照合区分',
        field: 'matchKbn',
        cellClass: 'cell-left',
        cellStyle: readonlyStyle,
      },
      {
        headerName: '消費税区分',
        field: 'taxKbn',
        editable: isEditable,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: [...BILLING_TAX_KBN_OPTIONS] },
        cellClass: 'cell-left',
        cellStyle: inputStyle,
      },
      // 消費税額・支払消費税額は表示しない。税額の確認はBIへ寄せ、この画面は
      // 消費税区分だけを持って他の金額項目はすべて税抜で扱う
      //（→ 20260821_第31回 決定事項9・11・12）。
      {
        // サマリ商品はコード列・名称列の2列で表示する。値は単一ソース（productName）で、
        // コード列は valueFormatter でサマリ商品マスタのコードに置き換える（→ 02 §9）。
        // どちらの列も同じコンボで編集でき、コード下4桁でも検索できる。
        headerName: 'サマリ商品コード',
        colId: 'productCode',
        field: 'productName',
        valueFormatter: (params) =>
          BILLING_SUMMARY_PRODUCT_BY_NAME.get(params.value)?.code ??
          GRID_EMPTY_TEXT,
        editable: isEditable,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: productOptions,
          placeholder: 'サマリ商品を選択（コード下4桁でも検索可）',
          width: '26rem',
        },
        onCellValueChanged: handleProductChanged,
        cellClass: 'cell-left',
        cellStyle: inputStyle,
        width: 112,
      },
      {
        headerName: 'サマリ商品名',
        field: 'productName',
        editable: isEditable,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: productOptions,
          placeholder: 'サマリ商品を選択（コード下4桁でも検索可）',
          width: '26rem',
        },
        onCellValueChanged: handleProductChanged,
        cellClass: 'cell-left',
        cellStyle: inputStyle,
        width: 208,
      },
      {
        // 請求書に記載された商品名（→ 20260821_第31回 決定事項8）。
        // サマリ商品名と対比して確認する項目のため隣に置く。
        headerName: '商品名',
        field: 'itemName',
        editable: isEditable,
        headerTooltip: '請求書に記載された商品名（サマリ商品名とは別）',
        cellClass: 'cell-left',
        cellStyle: inputStyle,
        width: 208,
      },
      {
        headerName: '入数',
        field: 'perCase',
        headerTooltip: 'サマリ商品マスタから自動補完',
        valueFormatter: (params) =>
          formatNumber(params.value) || GRID_EMPTY_TEXT,
        cellClass: 'cell-right',
        cellStyle: readonlyStyle,
      },
      {
        headerName: '請求単位',
        field: 'billingUnit',
        editable: isEditable,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: [...BILLING_UNIT_OPTIONS] },
        cellClass: 'cell-left',
        cellStyle: inputStyle,
      },
      {
        headerName: '数量',
        field: 'qty',
        ...GRID_NUMBER_FILTER,
        editable: isEditable,
        valueParser: (params) => parseNumberCell(params.newValue),
        valueFormatter: (params) =>
          formatNumber(params.value) || GRID_EMPTY_TEXT,
        cellClass: 'cell-right',
        cellStyle: inputStyle,
      },
      {
        // 正式な請求単価。請求金額 ÷ 数量で算出し、小数第3位を四捨五入して第2位まで表示する
        //（→ 20260821_第31回 決定事項15／課題 No.1283・No.1317）。参照専用。
        headerName: '請求単価（逆算）',
        colId: 'calcUnitPrice',
        ...GRID_NUMBER_FILTER,
        headerTooltip: '請求金額 ÷ 数量（小数第3位を四捨五入して第2位まで）',
        valueGetter: (params) => billingUnitPriceOf(params.data),
        valueFormatter: (params) =>
          formatBillingUnitPrice(params.value) || GRID_EMPTY_TEXT,
        cellClass: 'cell-right',
        cellStyle: readonlyStyle,
      },
      {
        // 参考値。請求EDIから連携された単価、またはAICが入力した単価をそのまま持つ。
        headerName: '請求書記載単価',
        field: 'unitPrice',
        ...GRID_NUMBER_FILTER,
        headerTooltip:
          '請求EDIから連携された単価、またはAICが入力した単価（小数第3位を四捨五入して第2位まで）。参考値で、正式な単価は請求金額÷数量で算出する',
        editable: isEditable,
        valueParser: (params) => parseUnitPriceCell(params.newValue),
        valueFormatter: (params) =>
          formatBillingUnitPrice(params.value) || GRID_EMPTY_TEXT,
        cellClass: 'cell-right',
        cellStyle: inputStyle,
      },
      {
        headerName: '請求伝票No.',
        field: 'slipNo',
        editable: isEditable,
        cellClass: 'cell-left',
        cellStyle: inputStyle,
      },
      {
        headerName: '請求書No.',
        field: 'invoiceNo',
        editable: isEditable,
        cellClass: 'cell-left',
        cellStyle: inputStyle,
      },
      // ── 請求先（得意先）と、そこから紐づく商流販売店 ──
      // 得意先名を選ぶと担当者・販売店・一次店・三次店が紐づけ表から補完される。
      // 請求書の記載順（明細→請求書No.）に合わせ、請求書No. の後ろにまとめて置く。
      {
        headerName: '得意先コード',
        field: 'customerCode',
        editable: isEditable,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: customerCodeOptions,
          placeholder: '過去の入力リストから選択',
          width: '26rem',
        },
        onCellValueChanged: handleCustomerCodeChanged,
        cellClass: 'cell-left',
        cellStyle: inputStyle,
      },
      {
        headerName: '得意先名',
        field: 'customerName',
        editable: isEditable,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: customerOptions,
          placeholder: '過去の入力リストから選択',
          width: '26rem',
        },
        onCellValueChanged: handleCustomerChanged,
        cellClass: 'cell-left',
        cellStyle: inputStyle,
        width: 192,
      },
      {
        headerName: '営業担当者',
        field: 'staffName',
        headerTooltip:
          '商流販売店変換マスタから自動反映（表記は「コード:名称」）',
        cellClass: 'cell-left',
        cellStyle: readonlyStyle,
      },
      // 商流販売店は「販売店→三次店→一次店」の順に並べる。
      // AIC入力の入力単位は紐づけ表で導出できない明細があるため画面で選べるようにし、
      // 請求EDI取込分は紐づけ表からの自動反映のみとして参照専用にする。
      {
        headerName: '販売店',
        field: 'storeName',
        headerTooltip:
          'AIC入力分は候補から選ぶか名称を直接入力する。請求EDI取込分は商流販売店変換マスタから自動反映',
        editable: isEditable,
        cellEditor: EditableComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: storeOptions,
          placeholder: '選択、または名称を入力',
          width: '20rem',
        },
        onCellValueChanged: handleStoreChanged,
        cellClass: 'cell-left',
        cellStyle: inputStyle,
        width: 144,
      },
      {
        headerName: '三次店',
        field: 'tertiaryStore',
        headerTooltip:
          'AIC入力分は候補から選ぶか名称を直接入力する。請求EDI取込分は商流販売店変換マスタから自動反映',
        editable: isEditable,
        cellEditor: EditableComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: tertiaryStoreOptions,
          placeholder: '選択、または名称を入力',
          width: '20rem',
        },
        onCellValueChanged: handleStoreChanged,
        cellClass: 'cell-left',
        cellStyle: inputStyle,
        width: 208,
      },
      {
        headerName: '一次店',
        field: 'primaryStore',
        headerTooltip:
          'AIC入力分は候補から選ぶか名称を直接入力する。請求EDI取込分は商流販売店変換マスタから自動反映',
        editable: isEditable,
        cellEditor: EditableComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: primaryStoreOptions,
          placeholder: '選択、または名称を入力',
          width: '20rem',
        },
        onCellValueChanged: handleStoreChanged,
        cellClass: 'cell-left',
        cellStyle: inputStyle,
        width: 144,
      },
      {
        // 備考（→ 20260821_第31回 決定事項8）。明細のどの項目とも対応しないため、
        // 右固定されない列の末尾に置く。
        headerName: '備考',
        field: 'note',
        editable: isEditable,
        cellClass: 'cell-left',
        cellStyle: inputStyle,
        width: 208,
      },
      // 支払画面へ反映した明細の反映先。卸から差異の問い合わせがあった際に
      // どの支払へ反映したかを追えるようにする。場所は明細の一番右
      //（→ 20260821_第31回 業務機能要件_手売り_支払_XX_請求詳細 AL115 コメント）。
      {
        headerName: '支払No.',
        field: 'payNo',
        headerTooltip: '支払画面へ反映した明細の反映先の支払No.',
        valueFormatter: (params) => params.value || '-',
        cellClass: 'cell-left',
        cellStyle: readonlyStyle,
        width: 120,
      },
      {
        headerName: '支払回数',
        field: 'payCount',
        headerTooltip: '支払画面へ反映した明細の反映先の支払回数',
        valueFormatter: (params) =>
          params.value == null ? GRID_EMPTY_TEXT : `${params.value}回目`,
        cellClass: 'cell-right',
        cellStyle: readonlyStyle,
        width: 88,
      },
      {
        // 行操作（三点リーダー）は右端に右固定する（登録系グリッドの共通方針。→ 02 §8）
        headerName: '操作',
        colId: 'rowAction',
        cellRenderer: 'billingRowActionRenderer',
        width: 56,
        minWidth: 56,
        sortable: false,
        filter: false,
        resizable: false,
        suppressMovable: true,
        pinned: 'right',
        cellClass: 'cell-center',
        // 操作列はデータセルではなくボタンの置き場のため、非活性（灰）ではなく白背景にする
        cellStyle: actionStyle,
      },
    ],
    [
      isEditable,
      handleStoreChanged,
      inputStyle,
      readonlyStyle,
      actionStyle,
      productOptions,
      customerOptions,
      customerCodeOptions,
      storeOptions,
      primaryStoreOptions,
      tertiaryStoreOptions,
      handleProductChanged,
      handleCustomerChanged,
      handleCustomerCodeChanged,
    ]
  );

  // Undo履歴を維持するため props の参照を安定させる（→ 02 §7.1）
  const gridColumnDefs = useMemo(
    () => withHeaderTooltips(columnDefs),
    [columnDefs]
  );
  // 計算式が入るセル（数量×請求書記載単価・請求単価・差額（請求-支払））は、マウスオーバーで
  // 「式 ＝ 実値 ＝ 結果」を表示する（支払詳細（請求書有）の追加口グリッドと同じ方針）。
  // 請求金額と数量×請求書記載単価が1円以上ずれている明細は、両セルにずれの理由も出す。
  // 計算式が無い列は共通既定どおりセル値を出す（列幅で省略された値の全文表示）。
  // Undo履歴を維持するため参照を固定する（→ 02 §7.1）
  const defaultColDef = useMemo<ColDef<BillingDetailRow>>(
    () => ({
      // 共通の既定（行の型を持たない ColDef）を、この表の行の型の列設定として混ぜる
      ...(GRID_DEFAULT_COL_DEF as ColDef<BillingDetailRow>),
      tooltipValueGetter: (params) => {
        // 列の識別子は colId（算出列）→ field（データ列）の順に見る
        const colDef = params.colDef as ColDef<BillingDetailRow> | undefined;
        const colKey = colDef?.colId ?? colDef?.field;
        return (
          billingFormulaTooltipOf(colKey, params.data) ?? params.value ?? ''
        );
      },
    }),
    []
  );

  const getRowId = useCallback(
    (params: { data: BillingDetailRow }) => params.data.id,
    []
  );
  // 行番号：明細行の連番
  const rowNoById = useMemo(() => {
    const noById = new Map<string, string>();
    rows.forEach((row, index) => {
      noById.set(row.id, String(index + 1));
    });
    return noById;
  }, [rows]);

  const gridContext = useMemo(
    () => ({
      isCellChanged: changed.isCellChanged,
      rowNoById,
      rows,
    }),
    [changed.isCellChanged, rowNoById, rows]
  );

  // 行の増減（追加・複製・削除）で、他行を参照して算出する値が変わるため再描画する。
  //   ・No.（rowNoById＝行配列の並び位置から採番）
  // AG Grid は行データを差し替えても残った行のセルを再利用（recycleRows）し、
  // context の差し替えでも valueGetter を再評価しないため、公式 API で明示的に再計算させる。
  useEffect(() => {
    gridRef.current?.api?.refreshCells({ force: true });
  }, [rows]);

  // セル編集：変更ハイライトの追跡と派生値（数量×請求書記載単価）の再描画。
  const handleCellValueChanged = useCallback(
    (params: CellValueChangedEvent<BillingDetailRow>) => {
      changed.trackCellChange(params);
      params.api.refreshCells({ force: true });
      onValueChange();
    },
    [changed, onValueChange]
  );

  // 明細追加（最下行に空行を1行。標準 4.4 の「最上部」ではなく、請求詳細は決定事項 No.469 に従う）
  const handleAddRow = useCallback(() => {
    const currentRows = rowsRef.current;
    addedSeqRef.current += 1;
    // 入力単位には複数の請求書No. が含まれるため、直前行の請求書No. を引き継ぐ
    // （同じ請求書の明細を続けて入力するケースが多い）。
    const invoiceNo = currentRows[currentRows.length - 1]?.invoiceNo ?? '';
    const added: BillingDetailRow = {
      ...createEmptyBillingDetailRow(`ADD-${addedSeqRef.current}`, invoiceNo),
      // 左端にオレンジの帯を出し、明細追加で増えた行だと後から分かるようにする
      //（新規作成時の初期空行には帯を付けないため、追加操作の側で付ける）
      _copySource: 'new',
    };
    // 追加した行は最下行に増えるため、押下後は最終行まで自動でスクロールし、行をフラッシュする
    // （→ 20260821_第31回 決定事項16＝決定事項一覧 No.469。強調は共通の useRevealNewRows）
    reveal.markRows([added]);
    onRowsChange([...currentRows, added]);
  }, [onRowsChange, reveal]);

  // コピー直後だけ、閉じた操作メニューの既定のフォーカス復帰（＝コピー元行の
  // 三点リーダー）を止めるための目印。復帰させるとブラウザがコピー元行を可視域へ
  // 寄せ直し、最下行までのスクロールが巻き戻ってしまう。
  const focusCopiedRowRef = useRef(false);

  // 行の複製（末尾へ1行）。対象行の直下へ挟むと以降の明細のNo. がずれてしまうため、
  // 明細追加と同じく最下行へ足す。
  const handleCopyRow = useCallback(
    (row: BillingDetailRow) => {
      const currentRows = rowsRef.current;
      addedSeqRef.current += 1;
      const copied: BillingDetailRow = {
        ...row,
        id: `ADD-${addedSeqRef.current}`,
        // 左端に緑の帯を出し、コピーで増えた行だと後から分かるようにする
        _copySource: 'detail',
      };
      // コピーした行を強調対象にする。最下行に増えるため、行が反映された後に最終行まで
      // スクロールしてフラッシュされる（明細追加と同じ挙動。→ 20260821_第31回 決定事項16）
      reveal.markRows([copied]);
      onRowsChange([...currentRows, copied]);
      // フォーカスの復帰先をコピー元行から最下行へ移す（操作メニューを閉じたあとに
      // DropdownMenuContent の onCloseAutoFocus で実施する）
      focusCopiedRowRef.current = true;
    },
    [onRowsChange, reveal]
  );

  // 請求単価の逆算メニューは持たない。正式な請求単価は常に請求金額 ÷ 数量で算出し、
  // 連携値・AIC入力値は参考項目として別に保持するため、書き換える操作が要らなくなった
  //（→ 20260821_第31回 決定事項15）。

  // 行の削除
  const handleDeleteRow = useCallback(
    (row: BillingDetailRow) => {
      onRowsChange(rowsRef.current.filter((target) => target.id !== row.id));
    },
    [onRowsChange]
  );

  // 行操作セル（三点リーダーのメニュー。支払詳細(追加口請求書有)と同一体裁）。
  // 支払処理まで進んだ行は削除も含めて全ての操作を非活性にする（行全体が参照専用）。
  // 参照専用モード（入力状況＝反映済）では、メニューを開く三点リーダーごと非活性にする。
  const RowActionRenderer = useCallback(
    (props: ICellRendererParams<BillingDetailRow>) => {
      const row = props.data;
      if (!row) return null;
      // 請求EDIで取り込んだ明細はコピー・削除ができない。行の追加・複製・削除は
      // AIC入力で追加した明細だけが対象のため、本画面では常に非活性にする
      // （→ 20260821_第31回 決定事項13）。
      const disabled = true;
      const deleteDisabled = true;
      const disabledCls = 'text-gray-400';
      return (
        <div className="flex items-center justify-center h-full">
          {/* modal={false}：閉じる際に body の pointer-events をロックさせない */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                disabled={readOnly}
                className={
                  readOnly
                    ? 'text-gray-400 p-1 rounded cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-800 p-1 rounded hover:bg-gray-100 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none'
                }
                aria-label="操作メニュー"
                title="操作"
              >
                <EllipsisVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              // コピー後はコピー元行の三点リーダーへフォーカスを戻さない。
              // 戻すとブラウザがその行を可視域へ寄せ、最下行までのスクロールが
              // 巻き戻るため、代わりにコピーした最下行へフォーカスを移す。
              onCloseAutoFocus={(event) => {
                if (!focusCopiedRowRef.current) return;
                focusCopiedRowRef.current = false;
                event.preventDefault();
                // メニューのフォーカストラップが外れた次フレームで移す
                requestAnimationFrame(() => {
                  const api = gridRef.current?.api;
                  if (!api) return;
                  // 最下行へのスクロールは共通の useRevealNewRows が済ませている
                  api.setFocusedCell(rowsRef.current.length - 1, 'rowAction');
                });
              }}
            >
              <DropdownMenuItem
                onClick={disabled ? undefined : () => handleCopyRow(row)}
                disabled={disabled}
                className={
                  disabled ? disabledCls : 'text-green-600 focus:text-green-600'
                }
              >
                <Copy
                  className={`w-4 h-4 ${disabled ? 'text-gray-400' : 'text-green-600'}`}
                />
                コピー
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={
                  deleteDisabled ? undefined : () => handleDeleteRow(row)
                }
                disabled={deleteDisabled}
                className={
                  deleteDisabled
                    ? disabledCls
                    : 'text-red-600 focus:text-red-600'
                }
              >
                <Trash2
                  className={`w-4 h-4 ${deleteDisabled ? 'text-gray-400' : 'text-red-600'}`}
                />
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
    [handleCopyRow, handleDeleteRow, readOnly]
  );

  const components = useMemo(
    () => ({ billingRowActionRenderer: RowActionRenderer }),
    [RowActionRenderer]
  );

  // タイトル下の合計サマリーバーの表示構成
  // （支払詳細(追加口請求書有)の追加口合計と同一フォーマット）。
  // 値はセル編集のたびに再計算するため useMemo は使わない（rows は参照が変わらないため）。
  const totals = aggregateBillingDetailRows(rows);
  // 請求金額は税抜。消費税区分ごとの内訳を並べ、税額そのものは表示しない
  //（→ 20260821_第31回 決定事項9・12）。区分は明細に現れたものだけを出す。
  const taxKbnBreakdown = BILLING_TAX_KBN_OPTIONS.filter(
    (kbn) => totals.billAmountByTaxKbn[kbn] != null
  ).map((kbn) => ({
    label: `${kbn.split(':')[1]} 請求金額(税抜)`,
    value: formatNumber(totals.billAmountByTaxKbn[kbn], 2),
  }));
  const summaryGroups = [
    {
      label: '請求',
      items: [
        {
          label: '請求金額合計(税抜)',
          value: formatNumber(totals.billAmount, 2),
        },
        ...taxKbnBreakdown,
      ],
    },
    {
      label: '支払',
      // 「支払画面未反映分合計」は持たない（決定事項21：未反映という概念をなくす）。
      items: [
        {
          // 請求明細グリッドの支払金額の合計であるため「支払金額合計」とする
          //（→ 20260821_第31回 決定事項20）
          label: '支払金額合計(税抜)',
          value: formatNumber(totals.payAmount, 2),
        },
        {
          // 請求金額と支払金額の差額。名称は課題 No.1364 で決着（明細の差額列と同一名称）
          label: '差額（請求-支払）',
          value: formatNumber(totals.correction, 2),
        },
      ],
    },
    {
      // 確定（検印）後金額は独立したエリアを設けず、この合計サマリーバーにまとめる
      //（→ 20260821_第31回 決定事項20）。明細の支払金額合計とは名称で区別する。
      label: '確定（検印）後',
      items: [
        {
          label: '確定(検印)済 支払金額合計(税抜)',
          value: formatNumber(totals.sealedPayAmount, 2),
          emphasize: true,
        },
      ],
    },
  ];

  return (
    <CollapsibleCard
      title={<span className={CARD_TITLE_CLASS}>請求明細</span>}
      open={isOpen}
      onOpenChange={setIsOpen}
      // 画面の残りの高さいっぱいに広げる（固定の calc(100vh-…) にしない → 05）。開いている間だけ下限 25rem
      fillParent
      className="data-[state=open]:min-h-100"
      contentClassName="p-2 flex flex-col flex-1 min-h-0"
    >
      {/* 合計サマリーバー（支払詳細(追加口請求書有)の追加口合計と同一フォーマット）。
          「合計」ラベル＋グループ見出し（請求／支払／確定（検印）後）の下に各項目を表示する。
          横幅はカード幅いっぱいに広げ、各グループは項目数で按分する（flexGrow は項目数=JS動的値）。 */}
      <div className="pb-3">
        <div className="flex w-full items-stretch overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {/* 合計ラベル（全高・縦中央・左揃え） */}
          <div className="flex shrink-0 items-center border-r border-gray-200 px-4 text-left text-sm font-bold text-gray-900 whitespace-nowrap">
            合計
          </div>
          {/* グループ（請求／支払／確定（検印）後）。項目数で横幅を按分する。 */}
          {summaryGroups.map((group) => (
            <div
              key={group.label}
              className="flex basis-0 flex-col border-r border-gray-200 last:border-r-0"
              style={{ flexGrow: group.items.length }}
            >
              {/* グループ見出し（左揃え） */}
              <div className="border-b border-gray-200 bg-gray-100 px-2 py-1 text-left text-xs font-bold text-gray-700 whitespace-nowrap">
                {group.label}
              </div>
              {/* グループ内の項目 */}
              <div className="flex flex-1 items-stretch divide-x divide-gray-200">
                {group.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-1 flex-col items-end px-3 py-1"
                  >
                    <span className="text-xs text-gray-500">{item.label}</span>
                    <span
                      className={`text-sm font-bold whitespace-nowrap ${
                        'emphasize' in item && item.emphasize
                          ? 'text-blue-700'
                          : 'text-gray-900'
                      }`}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 合計サマリーバーと明細グリッドの間に置く操作行（AIC入力と同じ配置）。
          左：本画面の明細は参照専用（決定事項13）のため、修正できないことと修正先を明示する。
          右：明細追加ボタン（操作対象の明細グリッドの直上・右端に置く）。
          本画面は参照専用のため常に非活性だが、AIC入力と同じ位置に置いて画面間で操作を揃える。 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pb-1.5">
        <span className="text-xs text-gray-500">
          請求EDIで取り込んだ明細は本画面では修正できません。誤りがある場合は支払詳細画面で修正してください。
        </span>
        <button
          onClick={handleAddRow}
          disabled
          className={`ml-auto flex items-center gap-1 px-2 py-1 whitespace-nowrap text-sm ${BUTTON_STYLES.disabled} ${BUTTON_BASE}`}
          aria-label="明細追加"
        >
          <Plus className="h-4 w-4" />
          明細追加
        </button>
      </div>
      {/* 行ハイライト色は GRID_COLORS を CSS変数で注入し、<style> 内の hex 直書きを避ける（→ 02 §10.1） */}
      <div
        className="billing-detail-grid flex-1 min-h-0 w-full"
        style={
          { '--billing-alert-bg': GRID_COLORS.alertRowBg } as CSSProperties
        }
      >
        {/* 商流未設定の行：1行全体を赤背景にする。各セルの cellStyle 背景（白/灰）を
            上書きするため全セルを対象にする（ホバー時も警告色を優先して残す）。 */}
        <style>{`
          .billing-detail-grid .ag-row.billing-row-alert .ag-cell {
            background-color: var(--billing-alert-bg) !important;
          }
        `}</style>
        <AgGridReact<BillingDetailRow>
          ref={gridRef}
          rowData={rows}
          columnDefs={gridColumnDefs}
          defaultColDef={defaultColDef}
          // 計算式をツールチップで見せるため、省略されていないセルでも出す（グローバルは whenTruncated）
          tooltipShowMode="standard"
          components={components}
          getRowId={getRowId}
          // 計算式の説明ツールチップを待たずに出す（他画面と同じ表示0.3秒・非表示5秒。
          // 既定の2秒では一度目が出ないように見えるため）
          tooltipShowDelay={300}
          tooltipHideDelay={5000}
          onRowDataUpdated={reveal.onRowDataUpdated}
          rowClassRules={rowClassRules}
          context={gridContext}
          getContextMenuItems={gridFilterContextMenuItems}
          onCellValueChanged={handleCellValueChanged}
          // ※ Excel とのコピー＆ペースト（範囲選択＋クリップボード）は
          //    GRID_BASE_PROPS の cellSelection で全グリッド共通に有効化している。
          domLayout="normal"
          {...GRID_BASE_PROPS}
          {...gridColumnStateProps}
          statusBar={GRID_STATUS_BAR}
        />
      </div>
    </CollapsibleCard>
  );
}
