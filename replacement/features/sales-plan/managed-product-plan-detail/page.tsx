import { useCallback, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type {
  CellClassParams,
  CellStyle,
  CellValueChangedEvent,
  ColDef,
  GetRowIdParams,
  ValueFormatterParams,
  ValueParserParams,
  NewValueParams,
} from 'ag-grid-community';
import { Save, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CARD_CLASS, FIT_LABEL_CLASS } from '@/styles/commonStyles';
import {
  PlanBasicInfoField,
  PlanBasicInfoFitGrid,
  PlanBasicInfoRow,
  PlanBasicInfoSpacer,
} from '@/components/ui/plan-basic-info';
import { MonthStripPicker } from '@/components/ui/month-strip-picker';
import {
  BASIC_INFO_CREATOR,
  BASIC_INFO_DEALER,
  BASIC_INFO_DEPARTMENT,
  BASIC_INFO_OFFICE,
  PLAN_NO_DATA_MONTHS,
} from '@/mocks/common/planBasicInfo';
import {
  STORE_TIER_LIST,
  firstStoreCode,
  thirdStoreCode,
} from '@/mocks/common/storeTier';
import { joinCodeName } from '@/utils/common/nameCode';
import {
  viewportGridHeight,
  useGridColumnState,
  GRID_DEFAULT_COL_DEF,
  GRID_EMPTY_TEXT,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  withHeaderTooltips,
  gridFilterContextMenuItems,
  GRID_COLORS,
  GRID_NUMBER_TEXT_FILTER,
  GRID_NUMBER_FILTER,
  useChangedCells,
  withComparableCellValues,
} from '@/components/grid';
import { ScreenTitle } from '@/components/ui/screen-title';
import { useAppNavigation } from '@/components/ui/use-app-navigation';

// データ型定義
// 社外売上高・1本あたり単価・当月進捗率は他項目から算出する項目のため行データには持たず、
// valueGetter で都度求める（算出ロジックは下の算出ヘルパー群）。
// 函単価・入数・前年函数・当月函数は本来マスタや実績から取得する値だが、
// 本モックでは行データのダミー値として保持する。
interface ProductSalesPlanData {
  id: string;
  productCategory: string; // 商品区分
  summaryProductCode: string; // サマリ商品コード
  summaryProduct: string; // サマリ商品名称
  // 函単価(円)。当該サマリ商品・当該商流販売店における社外売上高単価として
  // 各種マスタで定義される値（モックはダミー値）。
  casePrice: number;
  // サマリ商品の入数。1本あたり単価の算出元（モックはダミー値）。
  caseQuantity: number;
  prevYearCases: number; // 前年函数
  referenceProductCode: string; // 参考商品コード
  referenceProduct: string; // 参考商品名称
  targetCases: number; // 目標函数
  plannedCases: number; // 計画函数
  currentMonthCases: number; // 当月函数
}

// 計画函数の最大桁数
const PLANNED_CASES_MAX_DIGITS = 5;

// 基本情報に表示する三次店/一次店。本画面では販売店・三次店・一次店がいずれも一意（1件）の
// ため、計画詳細(マージン率固定・NET入力)と同じ参照元（src/mocks/common/storeTier）の先頭を使う。
const BASIC_INFO_STORE_TIER = STORE_TIER_LIST[0];

// 一次店の列幅。取引先名（例「T1001:三菱食品株式会社（イオン）」）が既定の1列幅
// （5列等幅）に収まらないため2列分を占有させる。三次店は1列幅に収まるので既定のまま。
const BASIC_INFO_FIRST_STORE_COL_SPAN = 'col-span-2';

// 基本情報の対象年月の初期値（旧表示「2026年5月」に対応）。
const BASIC_INFO_INITIAL_YEAR_MONTH = '2026/05';

// 商品販売計画No. のダミー値。計画一覧(管理対象商品)が生成する商品販売計画No と
// 同じ「A + 年下2桁 + 連番6桁」形式に合わせる。
const BASIC_INFO_PRODUCT_SALES_PLAN_NO = 'A26100503';

// 初期モックデータ
// サマリ商品コード・参考商品コード・函単価・入数・前年函数・当月函数はダミー値。
// 1本あたり単価が割り切れるよう函単価と入数の組み合わせを選んでいる。
const INITIAL_DATA: ProductSalesPlanData[] = [
  {
    id: '1',
    productCategory: '定番商品(月間・EDLP)',
    summaryProductCode: '45130081',
    summaryProduct: '三ツ矢サイダーゼロストロング１．５Ｌ８本',
    casePrice: 2400,
    caseQuantity: 8,
    prevYearCases: 625,
    referenceProductCode: '45130024',
    referenceProduct: '三ツ矢サイダー 500ml×24',
    targetCases: 650,
    plannedCases: 640,
    currentMonthCases: 600,
  },
  {
    id: '2',
    productCategory: '定番商品(月間・EDLP)',
    summaryProductCode: '45140112',
    summaryProduct: 'ウィルキンソンタンサン１Ｌ１２本',
    casePrice: 2160,
    caseQuantity: 12,
    prevYearCases: 545,
    referenceProductCode: '45140024',
    referenceProduct: 'ウィルキンソンタンサン 500ml×24',
    targetCases: 560,
    plannedCases: 555,
    currentMonthCases: 530,
  },
  {
    id: '3',
    productCategory: '新商品（当月発売品）',
    summaryProductCode: '45990001',
    summaryProduct: '新商品A 500mlPET',
    casePrice: 2400,
    caseQuantity: 24,
    prevYearCases: 200,
    referenceProductCode: '45990024',
    referenceProduct: '新商品A 500ml×24',
    targetCases: 250,
    plannedCases: 230,
    currentMonthCases: 0,
  },
];

// ── Grid の算出項目 ────────────────────────────────────────────────────
// 函単価は「当該サマリ商品・当該商流販売店における社外売上高単価」として各種マスタが
// 定義する値のため、画面では算出せず行データの値をそのまま表示する。
// 以下は函単価・入数・計画函数・当月函数から画面で算出する項目。

// 1本あたり単価(円) ＝ サマリ商品の函単価 ÷ サマリ商品の入数。
// 入数が0の行は算出できないため NaN を返す。
// 行ID（AG Grid 公式 getRowId）。モジュール直下に置いて参照を固定する（→ 02 §7.1）
const getRowId = (params: GetRowIdParams<ProductSalesPlanData>) =>
  params.data.id;

const unitPriceOf = (row: ProductSalesPlanData): number =>
  row.caseQuantity === 0 ? NaN : row.casePrice / row.caseQuantity;

// 社外売上高(円) ＝ 計画函数 × 函単価
const externalSalesOf = (row: ProductSalesPlanData): number =>
  row.plannedCases * row.casePrice;

// 当月進捗率(%) ＝ 当月函数 ÷ 計画函数（小数第一位を四捨五入）。
// 計画函数が0の行は率を算出できないため NaN を返す。
const progressRateOf = (row: ProductSalesPlanData): number =>
  row.plannedCases === 0
    ? NaN
    : Math.round((row.currentMonthCases / row.plannedCases) * 100);

// 数値フォーマッタ（カンマ区切り）
const formatNumber = (
  params: ValueFormatterParams<ProductSalesPlanData, number>
): string => (params.value != null ? params.value.toLocaleString() : '0');

// 算出項目の数値フォーマッタ（カンマ区切り）。
// マスタが引けない等で算出できない行は空白セルの標準表示（ハイフン）に倒す。
const formatDerivedNumber = (
  params: ValueFormatterParams<ProductSalesPlanData, number>
): string =>
  Number.isFinite(params.value)
    ? (params.value as number).toLocaleString()
    : GRID_EMPTY_TEXT;

// 計画函数の入力値を整数にパース（半角数字のみ・最大5桁）
const parsePlannedCases = (raw: unknown): number | null => {
  const sanitized = String(raw ?? '')
    .replace(/[^0-9]/g, '')
    .slice(0, PLANNED_CASES_MAX_DIGITS);
  if (!sanitized) {
    return null;
  }
  return Number(sanitized);
};

export default function ManagedProductPlanDetail() {
  // 画面の切り替え（→ ui/use-app-navigation）
  const navigate = useAppNavigation();
  // 行データ
  const [rowData, setRowData] = useState<ProductSalesPlanData[]>(INITIAL_DATA);

  // ヘッダー情報カードの開閉状態（既定: 開）
  const [isHeaderOpen, setIsHeaderOpen] = useState(true);

  // 「一覧へ戻る」の確認ダイアログ表示状態
  const [isBackConfirmOpen, setIsBackConfirmOpen] = useState(false);

  // 基本情報の対象年月（月ストリップ）。基準画面 計画詳細(マージン率固定・NET入力)と同様、
  // 画面内で保持する（本画面では表示専用でグリッドへは連動しない）。
  const [targetYearMonth, setTargetYearMonth] = useState(
    BASIC_INFO_INITIAL_YEAR_MONTH
  );

  // 計画函数のセル編集確定時のハンドラ
  const handlePlannedCasesChanged = useCallback(
    (params: NewValueParams<ProductSalesPlanData>) => {
      const parsed = parsePlannedCases(params.newValue);

      // 不正値の場合は元の値に戻してエラー通知
      if (parsed === null) {
        params.node?.setDataValue('plannedCases', params.oldValue);
        toast.error('計画函数は半角数字（最大5桁）で入力してください');
        return;
      }

      // 同じ値なら何もしない
      if (parsed === params.oldValue) {
        return;
      }

      setRowData((prev) =>
        prev.map((row) =>
          row.id === params.data.id ? { ...row, plannedCases: parsed } : row
        )
      );
      toast.success('計画函数を更新しました');
    },
    []
  );

  // カラム定義
  const columnDefs: ColDef<ProductSalesPlanData>[] = useMemo(
    () => [
      {
        headerName: '商品区分',
        field: 'productCategory',
        width: 90,
        filter: true,
        // 先頭列（aria-colindex=1）は grid.css のチェックボックス中央寄せ規則が効くため、
        // 解除用の ag-cell-left を併記して左寄せへ戻す（grid.css の同規則コメント参照）。
        cellClass: 'cell-left ag-cell-left',
      },
      {
        headerName: 'サマリ商品コード',
        field: 'summaryProductCode',
        width: 96,
        filter: true,
        cellClass: 'cell-left',
      },
      {
        headerName: 'サマリ商品名称',
        field: 'summaryProduct',
        // 商品名は残りの幅に広げる（管理対象商品一覧のサマリ商品・参考商品と同じ。→ 02 §7「列状態の永続化」）
        flex: 1,
        suppressAutoSize: true, // 残りの幅に広げる列のため自動調整から外す（flex を保つ）
        minWidth: 240,
        filter: true,
        cellClass: 'cell-left',
      },
      {
        // 社外売上高 ＝ 計画函数 × 函単価（算出項目）
        headerName: '社外売上高(円)',
        colId: 'externalSales',
        width: 84,
        ...GRID_NUMBER_FILTER,
        valueGetter: (params) =>
          params.data ? externalSalesOf(params.data) : null,
        valueFormatter: formatDerivedNumber,
        cellClass: 'cell-right',
      },
      {
        // 1本あたり単価 ＝ サマリ商品の函単価 ÷ サマリ商品の入数（算出項目）
        // 初期表示は非表示（見出しの右クリック「列選択」で表示できる）
        headerName: '1本あたり単価(円)',
        colId: 'unitPrice',
        hide: true,
        width: 90,
        ...GRID_NUMBER_FILTER,
        valueGetter: (params) =>
          params.data ? unitPriceOf(params.data) : null,
        valueFormatter: formatDerivedNumber,
        cellClass: 'cell-right',
      },
      {
        // 入数 ＝ 各種マスタが定義する、当該サマリ商品の入数
        // （画面では算出せずマスタ値をそのまま表示する。モックはダミー値）
        // 初期表示は非表示（見出しの右クリック「列選択」で表示できる）
        headerName: '入数',
        field: 'caseQuantity',
        hide: true,
        width: 60,
        ...GRID_NUMBER_FILTER,
        valueFormatter: formatNumber,
        cellClass: 'cell-right',
      },
      {
        // 函単価 ＝ 各種マスタが定義する、当該サマリ商品・当該商流販売店の社外売上高単価
        // （画面では算出せずマスタ値をそのまま表示する。モックはダミー値）
        // 初期表示は非表示（見出しの右クリック「列選択」で表示できる）
        headerName: '函単価(円)',
        field: 'casePrice',
        hide: true,
        width: 66,
        ...GRID_NUMBER_FILTER,
        valueFormatter: formatNumber,
        cellClass: 'cell-right',
      },
      {
        // 計画函数（インライン編集可。編集できるセルは白、値を変えたら黄色の強調 → 02 §7.2）
        headerName: '計画函数',
        field: 'plannedCases',
        width: 60,
        ...GRID_NUMBER_FILTER,
        editable: true,
        singleClickEdit: true,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: {
          min: 0,
          max: 99999,
          precision: 0,
        },
        valueParser: (
          params: ValueParserParams<ProductSalesPlanData, number>
        ) => parsePlannedCases(params.newValue) ?? params.oldValue,
        valueFormatter: formatNumber,
        cellClass: 'cell-right',
        onCellValueChanged: handlePlannedCasesChanged,
      },
      {
        headerName: '目標函数',
        field: 'targetCases',
        width: 60,
        ...GRID_NUMBER_FILTER,
        valueFormatter: formatNumber,
        cellClass: 'cell-right',
      },
      {
        headerName: '前年函数',
        field: 'prevYearCases',
        width: 60,
        ...GRID_NUMBER_FILTER,
        valueFormatter: formatNumber,
        cellClass: 'cell-right',
      },
      {
        headerName: '参考商品コード',
        field: 'referenceProductCode',
        width: 96,
        filter: true,
        cellClass: 'cell-left',
      },
      {
        headerName: '参考商品名称',
        field: 'referenceProduct',
        // 商品名は残りの幅に広げる（管理対象商品一覧のサマリ商品・参考商品と同じ。→ 02 §7「列状態の永続化」）
        flex: 1,
        suppressAutoSize: true, // 残りの幅に広げる列のため自動調整から外す（flex を保つ）
        minWidth: 240,
        filter: true,
        cellClass: 'cell-left',
      },
      {
        // 当月進捗率 ＝ 当月函数 ÷ 計画函数（小数第一位を四捨五入）
        headerName: '当月進捗率',
        colId: 'progressRate',
        width: 60,
        // 値は「94%」の文字列のため、数値へ変換して数値フィルタで絞り込む
        ...GRID_NUMBER_TEXT_FILTER,
        valueGetter: (params) => {
          if (!params.data) {
            return GRID_EMPTY_TEXT;
          }
          const rate = progressRateOf(params.data);
          return Number.isFinite(rate) ? `${rate}%` : GRID_EMPTY_TEXT;
        },
        cellClass: 'cell-right',
      },
      {
        headerName: '当月函数',
        field: 'currentMonthCases',
        width: 60,
        ...GRID_NUMBER_FILTER,
        valueFormatter: formatNumber,
        cellClass: 'cell-right',
      },
    ],
    [handlePlannedCasesChanged]
  );

  // ヘッダーが省略表示された場合にマウスオーバーで全文表示する（参照を固定する → 02 §7.1）
  const columnDefsWithTooltip = useMemo(
    () => withHeaderTooltips(columnDefs),
    [columnDefs]
  );

  // defaultColDef設定（共通プリセット＋編集可=白／編集不可=灰の背景色）
  // 計画函数：値を変えたセルの強調（薄い黄＋オレンジ枠。元の値に戻したら解除 → 02 §7.2）。
  // 利用者が編集したセルだけが対象（計算し直したセルは対象外）。
  const productPlanChanged = useChangedCells();
  const productPlanGridContext = useMemo(
    () => ({ isCellChanged: productPlanChanged.isCellChanged }),
    [productPlanChanged.isCellChanged]
  );
  const handleProductPlanCellValueChanged = useCallback(
    (e: CellValueChangedEvent) => {
      productPlanChanged.trackCellChange(withComparableCellValues(e));
      e.api.refreshCells({
        rowNodes: [e.node],
        columns: [e.column],
        force: true,
      });
    },
    [productPlanChanged]
  );
  const defaultColDef = useMemo<ColDef<ProductSalesPlanData>>(
    () => ({
      // 共通の既定（行の型を持たない ColDef）を、この表の行の型の列設定として混ぜる
      ...(GRID_DEFAULT_COL_DEF as ColDef<ProductSalesPlanData>),
      // 編集可=白／編集不可=灰（画面設計標準）。寄せは cellClass(cell-left/right) で付与するため
      // ここでは背景色のみ返す（display/justify を含めると cellClass の寄せが無効になる）。
      cellStyle: (params: CellClassParams<ProductSalesPlanData>) =>
        ({
          backgroundColor: params.colDef.editable
            ? GRID_COLORS.editable
            : GRID_COLORS.readonly,
        }) as CellStyle,
    }),
    []
  );

  // 列幅・並び順・ソートの保存／復元
  // ※列の並び順の変更と初期非表示列の追加に伴い v4 へ更新
  //   （旧保存状態のままだと新しい並び順・初期非表示が反映されないため）。
  const gridColumnStateProps = useGridColumnState(
    'ManagedProductPlanDetail.grid.columnState.v4'
  );

  // 一覧へ戻る：計画詳細(マージン率固定・NET入力)と同様、入力中データの破棄を確認してから
  // 計画一覧(管理対象商品)へ遷移する。
  const handleBack = useCallback(() => {
    setIsBackConfirmOpen(true);
  }, []);

  // 戻る確定 → 計画一覧(管理対象商品)へ遷移
  const handleBackConfirm = useCallback(() => {
    setIsBackConfirmOpen(false);
    navigate('managed-product-plan-list');
  }, [navigate]);

  return (
    // 他の計画詳細（計画詳細(マージン率固定・NET入力)等）と同じ構成。
    // 縦方向 flex で「スクロール領域(伸縮) → フッタ」とし、フッタをスクロール領域の外へ
    // 置くことで、内容量に関わらず画面下部へ追従させる。
    <div className="flex h-full w-full overflow-hidden bg-gray-100">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* スクロール可能エリア */}
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <div className="min-w-300">
            {/* ヘッダ部（タイトル + 情報カード） */}
            <div className="px-6 pt-3 pb-2">
              {/* 画面名はヘッダー（システム名の右）に表示する。計画詳細(自販機)が右端に本画面への
              遷移ボタンを持つのと対になるよう、本画面も右端に計画詳細への遷移ボタンを置く。 */}
              <ScreenTitle title="計画詳細(管理対象商品)" />
              <div className="px-3 py-1.5">
                <div className="flex items-center justify-end">
                  {/* ボタンの体裁は計画詳細(自販機)の同位置のボタンと同じ共通クラスを使う */}
                  <button className="btn-toolbar-outline">計画詳細</button>
                </div>
              </div>

              {/* ヘッダー情報カード（開閉可能） */}
              <CollapsibleCard
                title="基本情報"
                open={isHeaderOpen}
                onOpenChange={setIsHeaderOpen}
              >
                {/* 項目・行構成・表示体裁を計画詳細(マージン率固定・NET入力)へ統一する。
              等幅5列グリッド（PlanBasicInfoRow）で各行の項目を縦に揃え、コードを持つ項目は
              同画面と同じ参照元から「コード:名称」で表示する。
              本画面固有の「商品販売計画No.」は、基準画面にない項目のため2行目を新設して置く。
              計画書インポート／計画書エクスポート／見積書エクスポートは本画面では扱わないため、
              カードヘッダーのボタンは持たない。 */}
                {/* 「商品販売計画No.」が 5.625rem に収まらないため、項目名の列をその列で一番長い項目名の幅に
                    合わせる並び（PlanBasicInfoFitGrid → 05「ラベルが幅に収まらない画面」）にする */}
                <div className="p-4">
                  <PlanBasicInfoFitGrid>
                    {/* 1行目: 対象年月（月ストリップ）とステータス。
                月ストリップの必要幅から対象年月を col-span-4 とし、ステータスを5列目に
                固定することで、2行目以降の列位置と縦に揃う（基準画面と同一）。
                本画面はコメント履歴を持たないため、ステータス横のボタンは置かない。 */}
                    <PlanBasicInfoRow>
                      {/* 4列分＝8トラック。月ストリップは残りの7トラックへ広げる */}
                      <div className="col-span-8 grid grid-cols-subgrid items-center">
                        <label className={FIT_LABEL_CLASS}>対象年月</label>
                        <div className="col-span-7 min-w-0">
                          <MonthStripPicker
                            disabledMonths={PLAN_NO_DATA_MONTHS}
                            value={targetYearMonth}
                            onChange={setTargetYearMonth}
                          />
                        </div>
                      </div>

                      <PlanBasicInfoField label="ステータス" value="登録済" />
                    </PlanBasicInfoRow>

                    {/* 2行目: 本画面固有の商品販売計画No.。計画一覧(管理対象商品)の
                同名列と同じ値を参照専用で表示する。
                持たない項目は列を空けず左へ詰める。 */}
                    <PlanBasicInfoRow>
                      <PlanBasicInfoField
                        label="商品販売計画No."
                        value={BASIC_INFO_PRODUCT_SALES_PLAN_NO}
                      />
                      <PlanBasicInfoSpacer />
                      <PlanBasicInfoSpacer />
                      <PlanBasicInfoSpacer />
                      <PlanBasicInfoSpacer />
                    </PlanBasicInfoRow>

                    {/* 3行目: 事業場・部署・作成者。
                持たない項目（基準画面の「担当エリア」「三次店企業」）は列を空けず左へ詰める。 */}
                    <PlanBasicInfoRow>
                      <PlanBasicInfoField
                        label="事業場"
                        value={joinCodeName(
                          BASIC_INFO_OFFICE.code,
                          BASIC_INFO_OFFICE.name
                        )}
                      />
                      <PlanBasicInfoField
                        label="部署"
                        value={joinCodeName(
                          BASIC_INFO_DEPARTMENT.code,
                          BASIC_INFO_DEPARTMENT.name
                        )}
                      />
                      <PlanBasicInfoField
                        label="作成者"
                        value={joinCodeName(
                          BASIC_INFO_CREATOR.code,
                          BASIC_INFO_CREATOR.name
                        )}
                      />
                      <PlanBasicInfoSpacer />
                      <PlanBasicInfoSpacer />
                    </PlanBasicInfoRow>

                    {/* 4行目: 販売店・三次店・一次店（最終行のため下区切り罫線なし）。
                いずれも一意（1件）のため参照専用値として左から順に詰めて並べる。
                一次店のみ取引先名が1列幅に収まらないため2列分を占有させる。 */}
                    <PlanBasicInfoRow divider={false}>
                      <PlanBasicInfoField
                        label="販売店"
                        value={joinCodeName(
                          BASIC_INFO_DEALER.code,
                          BASIC_INFO_DEALER.name
                        )}
                      />
                      <PlanBasicInfoField
                        label="三次店"
                        value={joinCodeName(
                          thirdStoreCode(BASIC_INFO_STORE_TIER.third),
                          BASIC_INFO_STORE_TIER.third
                        )}
                      />
                      <PlanBasicInfoField
                        label="一次店"
                        value={joinCodeName(
                          firstStoreCode(BASIC_INFO_STORE_TIER.first),
                          BASIC_INFO_STORE_TIER.first
                        )}
                        colSpanClass={BASIC_INFO_FIRST_STORE_COL_SPAN}
                      />
                    </PlanBasicInfoRow>
                  </PlanBasicInfoFitGrid>
                </div>
              </CollapsibleCard>
            </div>

            {/* グリッド部 */}
            <div className="px-6 pt-3 pb-2">
              <div>
                <div className={`${CARD_CLASS} overflow-hidden`}>
                  {/* グリッド本体（1920x1080 のPCで画面いっぱいに表示）。減算値 7.5rem は
                ヘッダーメニュー・フッタ・グリッド部の余白の固定高。
                基本情報カードはスクロールアウトしてよい。 */}
                  <div
                    className="grid-unified w-full p-2"
                    style={{
                      height: viewportGridHeight(7.5),
                      minHeight: '25rem',
                    }}
                  >
                    <AgGridReact
                      rowData={rowData}
                      context={productPlanGridContext}
                      onCellValueChanged={handleProductPlanCellValueChanged}
                      columnDefs={columnDefsWithTooltip}
                      defaultColDef={defaultColDef}
                      statusBar={GRID_STATUS_BAR}
                      getContextMenuItems={gridFilterContextMenuItems}
                      domLayout="normal"
                      ensureDomOrder={true}
                      stopEditingWhenCellsLoseFocus={true}
                      getRowId={getRowId}
                      {...GRID_BASE_PROPS}
                      {...gridColumnStateProps}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* フッタ：スクロール領域の外に置き、画面下部へ追従させる */}
        <div className="bg-white border-t border-gray-200 px-6 py-2 shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <button
                type="button"
                className="btn-action-base btn-action-outline"
                onClick={handleBack}
              >
                <ArrowLeft className="h-4 w-4" />
                一覧へ戻る
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn-action-base btn-action-blue">
                <Save className="h-4 w-4" />
                登録
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 「一覧へ戻る」の確認ダイアログ（計画詳細(マージン率固定・NET入力)と同一文言） */}
      <ConfirmDialog
        open={isBackConfirmOpen}
        title="画面移動の確認"
        confirmLabel="移動"
        description="入力中のデータが破棄されます。本当によろしいですか？"
        onConfirm={handleBackConfirm}
        onCancel={() => setIsBackConfirmOpen(false)}
      />
    </div>
  );
}
