// 支払詳細(商流販売店紐づけなし)画面の「支払情報サマリ」カード。
// ヘッダーのトグルで表示を切り替える。
//   詳細（既定）… 管理項目別合計値（拡売費の管理区分別に集計した表）
//   分割（IN）／振替（IN） … 他部門から分割（振替）された経費明細
//
// 「詳細」の表の型は自販機の支払詳細（管理項目別合計値）に合わせる。
// 本画面は計画パターン②③④で計画が存在し支払回数を複数回持つため、支払回数をまとめる
// 支払情報サマリの詳細を設ける（→ 20260804_第26回_共通 決定事項19／課題 No.1127）。
// 決定19 の「実販函数から拡売費までの列は削除する」に従い、手売り型の実販函数〜拡売費の
// 列（＝追加口に関する項目）は持たない。
//
// 自販機との差分：
//   ・集計対象の会計統一科目 … 拡売費の勘定科目は「販促費」単一で情報量がないため落とす
//   ・営業経費小計／自販機関係費小計 … チャネルごとの括りは「区別しない」方針
//                                      （→ 20260804_第26回_共通 決定事項20）と矛盾するため入れない
// ※「全支払回数分の合算」は表の型が固まってから対応する（現状は表示中の支払回のみ集計）。
import React, { useState, useMemo, type ReactNode, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  GetRowIdParams,
  ICellRendererParams,
  type CellValueChangedEvent,
} from 'ag-grid-community';
import {
  GRID_DEFAULT_COL_DEF,
  GRID_BASE_PROPS,
  GRID_EMPTY_TEXT,
  GRID_COLORS,
  gridFilterContextMenuItems,
  useGridColumnState,
  GRID_NUMBER_TEXT_FILTER,
  useChangedCells,
  withComparableCellValues,
} from '@/app/components/grid';
import { EXPENSE_MANAGEMENT_CLASS_OPTIONS } from '@/app/constants/expenseRelations';
import { managementClassCode } from '@/app/utils/payment/payment-detail/paymentComboFieldOptions';
import { isSplitDestRow } from '@/app/components/payment/payment-detail-unlinked/utils';
import { CollapsibleCard } from '@/app/components/ui/collapsible-card';
import { CARD_TITLE_CLASS } from '@/styles/commonStyles';
import { SegmentToggle } from '@/app/components/shared/common/SegmentToggle';
import {
  useResizableHeight,
  ResizeHandle,
} from '@/app/components/ui/resizable-panel';

// 自部門の費用負担部署（基本情報カードの申請部署＝SearchPane の APPLICANT_DEPT と同じ）。
// 分割先の費用負担部署がこれと異なる行を「他部門へ」に計上する。
const OWN_COST_BEARING_DEPT = '10002990:首都圏営業第二部';

// 計画差異がこの割合を超える行を強調（赤背景）し、その行だけ差異理由を入力可能にする。
const PLAN_DIFFERENCE_ALERT_RATE = 0.1;

// 合計行の管理区分名称。
const TOTAL_ROW_LABEL = '合計';

// 集計に使う拡売費明細の項目（NonProductExpensePane の ExpenseRow の部分集合）。
export interface SummarySourceRow {
  isGroup?: boolean;
  isTotal?: boolean;
  costSplit?: string;
  payAmount: number | string;
  mgmtClassName: string;
  splitDept?: string;
}

// 他部門から分割（振替）された経費明細のうち、集計に使う項目。
export interface SummaryChargeFromRow {
  payAmount: number | string;
  mgmtClassName: string;
}

// 管理項目別合計値グリッドの1行。
interface SummaryRow {
  managementCode: string; // 管理区分（区分値）
  expenseItem: string; // 管理区分名称
  amount: string; // 支払合計
  chargeTo: string; // 他部門へ
  chargeFrom: string; // 他部門から
  monthlyTotal: string; // 負担額合計（支払合計 − 他部門へ ＋ 他部門から）
  yearOverYear: string; // 前年比
  planAmount: string; // 計画金額
  planDifference: string; // 計画差（負担額合計 − 計画金額）
  planDifferenceRate: string; // 計画差異
  differenceReason: string; // 差異理由
  isTotalRow: boolean; // 合計行か（強調表示の判定用）
  isAlertRow: boolean; // 計画差異が大きい行か（強調表示・差異理由の入力可否）
}

// 行ID（AG Grid 公式 getRowId）。管理区分名称は管理区分マスタで重複せず、合計行は「合計」のため
// 一覧全体で一意になる。モジュール直下に置いて参照を固定する（→ 02 §7.1）。
const getSummaryRowId = (params: GetRowIdParams<SummaryRow>): string =>
  params.data.expenseItem;

// 文字列・数値混在の金額を数値へ。空・数値でない値は 0 とみなす。
const parseAmount = (value: number | string | undefined): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const n = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// 3桁区切り（小数は四捨五入）。
const formatAmount = (value: number): string =>
  Math.round(value).toLocaleString('ja-JP');

// 基本情報の費用負担部署（＝自部門）と異なる部署が指定されているか。
// 未設定（undefined／空）は自部門とみなし、他部門扱いにしない。
const isOtherCostBearingDept = (dept?: string): boolean =>
  !!dept && dept !== OWN_COST_BEARING_DEPT;

interface AggregationPaneProps {
  // 支払情報サマリ右端のトグルの選択値。既定は詳細（管理項目別合計値）。
  //   詳細＝管理項目別合計値／分割・振替＝他部門から分割（振替）された経費明細。
  summaryTab?: '詳細' | '分割' | '振替';
  onSummaryTabChange?: (tab: '詳細' | '分割' | '振替') => void;
  // 管理項目別合計値の集計元。拡売費明細（分割先行を含む）。
  expenseRows?: SummarySourceRow[];
  // 同上：他部門から分割（振替）された経費明細（「他部門から」の集計元）。
  chargeFromRows?: SummaryChargeFromRow[];
  // 分割・振替 選択時にカード本体へ表示する一覧。
  // リサイズハンドルで調整した本体の縦幅（gridHeight）と選択中のタブを受け取る。
  splitContent?: (gridHeight: number, tab: '分割' | '振替') => ReactNode;
}

export function AggregationPane({
  summaryTab = '詳細',
  onSummaryTabChange,
  expenseRows = [],
  chargeFromRows = [],
  splitContent,
}: AggregationPaneProps = {}) {
  const [isOpen, setIsOpen] = useState(true);
  // 表示単位（円／千円）。金額列のみ千円換算する。
  // 本画面は拡売費のみを扱い金額の桁が自販機より小さいため、既定は円にする
  //（千円だと数百円の管理区分が 0 に丸められて内訳が読めなくなる）。
  // 初期表示は千円（支払詳細の各画面で同じ → UI/UX UX-077）
  const [displayUnit, setDisplayUnit] = useState<'yen' | 'thousand'>(
    'thousand'
  );

  // カード本体（サマリ表）の縦幅。リサイズハンドルのドラッグで手動調整可能。
  // JS動的値のため inline style を許容する。
  const GRID_MIN_HEIGHT = 200; // 縮めすぎ防止の下限
  // 既定値は管理項目別合計値（管理区分マスタ10行＋合計行）が縦スクロールせずに収まる高さ。
  const gridResize = useResizableHeight({
    defaultHeight: 460,
    minHeight: GRID_MIN_HEIGHT,
    maxHeight: Infinity,
  });
  const gridHeight = gridResize.height;

  // 列幅・並び順の永続化。案B（管理区分別）へ列構成を入れ替えたため版番号を上げる。
  const gridColumnStateProps = useGridColumnState(
    '支払詳細(商流販売店紐づけなし).支払情報サマリ.columnState.v2'
  );

  const unitLabel = displayUnit === 'thousand' ? '千円' : '円';

  // 管理項目別合計値の行データ。拡売費の管理区分マスタ（統合済み10件）を常に全行出し、
  // 最上行へ合計を付ける。計上のない区分は0円行として残す（→ 課題 No.1127）。
  const rowData: SummaryRow[] = useMemo(() => {
    const unitDivisor = displayUnit === 'thousand' ? 1000 : 1;
    const toDisplay = (value: number): string =>
      formatAmount(value / unitDivisor);

    // グループ合計行・総合計行は明細ではないため集計対象から外す。
    const detailRows = expenseRows.filter((r) => !r.isGroup && !r.isTotal);

    // 各管理区分の集計値。合計行の合算に使うため数値のまま保持する。
    const aggregated = EXPENSE_MANAGEMENT_CLASS_OPTIONS.map((option, index) => {
      const className = option.value;
      const inClass = detailRows.filter((r) => r.mgmtClassName === className);
      // 支払合計：分割先行を除いた明細の支払金額（分割先は分割元の内訳のため二重計上しない）。
      const paymentTotal = inClass
        .filter((r) => !isSplitDestRow(r))
        .reduce((sum, r) => sum + parseAmount(r.payAmount), 0);
      // 他部門へ：分割先の費用負担部署が自部門以外の分割金額。
      const chargeTo = inClass
        .filter((r) => isSplitDestRow(r) && isOtherCostBearingDept(r.splitDept))
        .reduce((sum, r) => sum + parseAmount(r.payAmount), 0);
      // 他部門から：他部門から分割（振替）された経費明細の合計。
      const chargeFrom = chargeFromRows
        .filter((r) => r.mgmtClassName === className)
        .reduce((sum, r) => sum + parseAmount(r.payAmount), 0);
      const monthlyTotal = paymentTotal - chargeTo + chargeFrom;
      // 計上のない管理区分は計画との比較対象にならないため、計画関連の列を「-」にする
      //（自販機の XKA 行＝計画対象外の扱いを流用する）。
      const hasEntry = paymentTotal !== 0 || chargeTo !== 0 || chargeFrom !== 0;
      // 計画金額はモック。実装時は拡売費計画の管理区分別の計画値に差し替える。
      // 負担額合計（＝自部門の負担分）を基準に、管理区分ごとに決まった係数を掛けて
      // 計画差が区分ごとに違う値になるようにする（1行だけ差異が大きくなり、赤背景と
      // 差異理由の入力可否を確認できる）。
      const planRate = 1.05 + (index % 5) * 0.05;
      const planAmount = hasEntry ? monthlyTotal * planRate : 0;
      const planDifference = monthlyTotal - planAmount;
      return {
        className,
        paymentTotal,
        chargeTo,
        chargeFrom,
        monthlyTotal,
        planAmount,
        planDifference,
        hasEntry,
      };
    });

    // 計画差異：計画差 ÷ 計画金額
    const differenceRate = (
      planDifference: number,
      planAmount: number
    ): number => (planAmount === 0 ? 0 : planDifference / planAmount);
    const toRateText = (rate: number): string => (rate * 100).toFixed(2) + '%';

    const displayRows: SummaryRow[] = aggregated.map((r) => {
      const rate = differenceRate(r.planDifference, r.planAmount);
      return {
        managementCode: managementClassCode(r.className),
        expenseItem: r.className,
        amount: toDisplay(r.paymentTotal),
        chargeTo: toDisplay(r.chargeTo),
        chargeFrom: toDisplay(r.chargeFrom),
        monthlyTotal: toDisplay(r.monthlyTotal),
        // 前年比：計画パターン②③④は商流販売店に紐づかず前年同期の実績を特定できないため
        // 常に「-」（列は残し、特定方法が決まった段階で値を入れる。→ 課題 No.1127）。
        yearOverYear: GRID_EMPTY_TEXT,
        planAmount: r.hasEntry ? toDisplay(r.planAmount) : GRID_EMPTY_TEXT,
        planDifference: r.hasEntry
          ? toDisplay(r.planDifference)
          : GRID_EMPTY_TEXT,
        planDifferenceRate: r.hasEntry ? toRateText(rate) : GRID_EMPTY_TEXT,
        differenceReason: '',
        isTotalRow: false,
        isAlertRow: r.hasEntry && Math.abs(rate) > PLAN_DIFFERENCE_ALERT_RATE,
      };
    });

    // 合計行：全管理区分の合算（小計は設けない）。
    const sum = (pick: (r: (typeof aggregated)[number]) => number): number =>
      aggregated.reduce((s, r) => s + pick(r), 0);
    const totalPlanAmount = sum((r) => r.planAmount);
    const totalPlanDifference = sum((r) => r.planDifference);
    const totalRow: SummaryRow = {
      managementCode: '',
      expenseItem: TOTAL_ROW_LABEL,
      amount: toDisplay(sum((r) => r.paymentTotal)),
      chargeTo: toDisplay(sum((r) => r.chargeTo)),
      chargeFrom: toDisplay(sum((r) => r.chargeFrom)),
      monthlyTotal: toDisplay(sum((r) => r.monthlyTotal)),
      yearOverYear: GRID_EMPTY_TEXT,
      planAmount: toDisplay(totalPlanAmount),
      planDifference: toDisplay(totalPlanDifference),
      planDifferenceRate: toRateText(
        differenceRate(totalPlanDifference, totalPlanAmount)
      ),
      differenceReason: '',
      isTotalRow: true,
      isAlertRow: false,
    };

    // 合計行は明細の先頭（最上行）に置く。
    return [totalRow, ...displayRows];
  }, [expenseRows, chargeFromRows, displayUnit]);

  const columnDefs: ColDef[] = useMemo(() => {
    // 金額列：ヘッダーへ表示単位を付し、値は右寄せにする。
    const amountCol = (headerName: string, field: string): ColDef => ({
      headerName: `${headerName} (${unitLabel})`,
      field,
      // 値は整形済みの文字列のため、数値へ変換して数値フィルタで絞り込む（→ 02 §7）
      ...GRID_NUMBER_TEXT_FILTER,
      width: 104,
      cellClass: 'cell-right',
    });
    return [
      { headerName: '管理区分', field: 'managementCode', width: 88 },
      {
        headerName: '管理区分名称',
        field: 'expenseItem',
        width: 160,
        cellClass: 'cell-left',
      },
      amountCol('支払合計', 'amount'),
      amountCol('他部門へ', 'chargeTo'),
      amountCol('他部門から', 'chargeFrom'),
      amountCol('負担額合計', 'monthlyTotal'),
      {
        headerName: '前年比 (％)',
        field: 'yearOverYear',
        ...GRID_NUMBER_TEXT_FILTER,
        width: 88,
        cellClass: 'cell-right',
      },
      amountCol('計画金額', 'planAmount'),
      amountCol('計画差', 'planDifference'),
      {
        headerName: '計画差異 (％)',
        field: 'planDifferenceRate',
        ...GRID_NUMBER_TEXT_FILTER,
        width: 104,
        cellClass: 'cell-right',
      },
      {
        // 差異理由は計画との比較が目的のサマリ側に残す
        //（拡売費明細からは削除済み。明細で見るのは請求と支払の差異のため。
        //  → 20260821_第31回 決定事項4）。
        headerName: '差異理由',
        field: 'differenceReason',
        width: 192,
        // 計画差異が大きく赤背景になる行のみ入力可能にする
        editable: (params) => !!params.data?.isAlertRow,
        cellStyle: { backgroundColor: GRID_COLORS.editable },
        // 入力可能な行が未入力のときだけ、入力を促すプレースホルダを表示する
        cellRenderer: (params: ICellRendererParams) => {
          if (params.value) return params.value;
          if (params.data?.isAlertRow) {
            return (
              <span className="text-gray-600 italic">
                差異理由を入力してください
              </span>
            );
          }
          return '';
        },
        // ※ 差異理由は表示用集計のため state へは保持しない（入力値はグリッド内に留まる）。
      },
    ];
  }, [unitLabel]);

  // 差異理由：値を変えたセルの強調（薄い黄＋オレンジ枠。元の値に戻したら解除 → 02 §7.2）。
  // 利用者が編集したセルだけが対象（計算し直したセルは対象外）。
  const summaryChanged = useChangedCells();
  const summaryGridContext = useMemo(
    () => ({ isCellChanged: summaryChanged.isCellChanged }),
    [summaryChanged.isCellChanged]
  );
  const handleSummaryCellValueChanged = useCallback(
    (e: CellValueChangedEvent) => {
      summaryChanged.trackCellChange(withComparableCellValues(e));
      e.api.refreshCells({
        rowNodes: [e.node],
        columns: [e.column],
        force: true,
      });
    },
    [summaryChanged]
  );
  const defaultColDef: ColDef = useMemo(
    () => ({
      // 共通の既定列定義（grid/）。ヘッダーの…メニュー・フィルターボタン非表示、
      // tooltip 等を内包。読み取り専用の集計表のためソートは無効にする。
      ...GRID_DEFAULT_COL_DEF,
      sortable: false,
      cellDataType: false,
    }),
    []
  );

  return (
    <CollapsibleCard
      title={<span className={CARD_TITLE_CLASS}>支払情報サマリ</span>}
      open={isOpen}
      onOpenChange={setIsOpen}
      className="mb-4"
      headerActions={
        /* 詳細／分割（IN）／振替（IN） トグル。
           詳細＝管理項目別合計値、分割・振替＝他部門から分割・振替を受けた経費明細
           （受領側であることが分かるよう表示名に「（IN）」を付す）。既定は詳細。 */
        <SegmentToggle
          ariaLabel="支払情報サマリの表示"
          className="shrink-0"
          options={[
            { value: '詳細', label: '詳細' },
            { value: '分割', label: '分割（IN）' },
            { value: '振替', label: '振替（IN）' },
          ]}
          value={summaryTab}
          onChange={(tab) => onSummaryTabChange?.(tab)}
        />
      }
    >
      <>
        {summaryTab !== '詳細' ? (
          // 分割・振替：カード本体に「他部門から分割（振替）された経費明細」一覧を表示する。
          <div className="p-4">
            {splitContent?.(
              gridHeight,
              summaryTab === '振替' ? '振替' : '分割'
            )}
          </div>
        ) : (
          <div className="p-4">
            {/* 表示単位トグル（円／千円）。金額列のみ千円換算する。グリッド直上に右寄せ配置。 */}
            <div className="mb-2 flex items-center justify-end gap-2">
              <label className="text-sm font-bold whitespace-nowrap text-blue-900">
                表示単位
              </label>
              <SegmentToggle
                ariaLabel="表示単位"
                options={[
                  { value: 'yen', label: '円' },
                  { value: 'thousand', label: '千円' },
                ]}
                value={displayUnit}
                onChange={setDisplayUnit}
              />
            </div>
            <div
              className="jbr-expense-summary-grid"
              style={{
                height: gridHeight,
                width: '100%',
                // 行ハイライトの配色は CSS 変数で渡し、下の <style> から参照する。
                ['--expense-alert-bg' as string]: GRID_COLORS.alertRowBg,
                ['--expense-total-bg' as string]: GRID_COLORS.total,
              }}
            >
              {/* 罫線・ヘッダ背景・行高は共通テーマ（GRID_THEME）、見出しの寄せは
                  grid.css の共通指定（左寄せ）に委譲する。 */}
              <style>{`
              /* 以下の1行ハイライトは、各セルの cellStyle 背景を上書きするため全セルを対象にする。
                 ホバー行はセル背景を透明にし、テーマが行へ塗るホバー色を見せる。 */
              .jbr-expense-summary-grid .ag-row-hover .ag-cell {
                background-color: transparent !important;
              }
              /* 計画差異が大きい行：赤背景 */
              .jbr-expense-summary-grid .ag-row.expense-summary-alert .ag-cell {
                background-color: var(--expense-alert-bg) !important;
              }
              /* 合計行：薄い青背景・太字 */
              .jbr-expense-summary-grid .ag-row.expense-summary-total .ag-cell {
                background-color: var(--expense-total-bg) !important;
                font-weight: 700;
              }
              /* 値を変えたセル（差異理由）は、赤背景の行の中でも共通の変更ハイライト（薄い黄）を出す（→ 02 §7.2） */
              .jbr-expense-summary-grid .ag-row .ag-cell.ag-cell-changed {
                background-color: var(--grid-changed-bg) !important;
              }
            `}</style>
              {/* 規約例外（集計表）：表示項目（管理区分）ごとの行が決まっている集計表（支払情報サマリ）のため、件数表示（statusBar）は付けない */}
              <AgGridReact
                className="grid-summary-table"
                rowData={rowData}
                context={summaryGridContext}
                onCellValueChanged={handleSummaryCellValueChanged}
                getRowId={getSummaryRowId}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                getContextMenuItems={gridFilterContextMenuItems}
                rowClassRules={{
                  'expense-summary-alert': (params) =>
                    !!params.data?.isAlertRow,
                  'expense-summary-total': (params) =>
                    !!params.data?.isTotalRow,
                }}
                suppressMovableColumns={true}
                ensureDomOrder={true}
                {...GRID_BASE_PROPS}
                {...gridColumnStateProps}
              />
            </div>
          </div>
        )}
        {/* リサイズハンドル：上下ドラッグでカード本体の縦幅を手動調整する。
            詳細＝管理項目別合計値／分割・振替＝他部門一覧の各グリッドを可変にする。 */}
        <div className="relative h-2">
          <ResizeHandle
            onMouseDown={gridResize.handleMouseDown}
            ariaLabel="支払情報サマリの高さを変更"
          />
        </div>
      </>
    </CollapsibleCard>
  );
}
