// 自販機（PlanDetailVending）専用の販売計画(集計)コンポーネント。
// 共通の SalesPlanAggregationAG が課題0623対応で刷新される前の版
// （コミット a3ec0f8 時点）を、自販機画面向けに固定して切り出したもの。
// 共通版の後続変更（表示項目ドリルダウン等）の影響を受けないよう独立させている。
import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  ColGroupDef,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  RowClassParams,
} from 'ag-grid-community';
import { ChevronDown, Calendar, TrendingUp, CalendarRange } from 'lucide-react';

import { RadioGroup } from '../../../ui/radio-group';
import { NumericInput } from '../../../ui/numeric-input';
import { CollapsibleCard } from '../../../ui/collapsible-card';
import { useResizableHeight, ResizeHandle } from '../../../ui/resizable-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import {
  GRID_BASE_PROPS,
  GRID_DEFAULT_COL_DEF,
  GRID_EMPTY_TEXT,
  rowKindBg,
  useGridColumnState,
  GRID_NO_FILTER_COLUMN_TYPES,
} from '../../../grid';
import {
  FORM_LABEL_CLASS,
  TEXT_INPUT_CLASS,
} from '../../../../../styles/commonStyles';

// 集計表（売上サマリ数値・詳細）の初期の高さ（px）。表の下端のリサイズハンドルの
// ドラッグで拡縮する（計画詳細(NET固定)＝ PlanAggregationPane と同じ共通フック
// useResizableHeight を使うため、単位も同フックに合わせて px とする）。
const AGGREGATION_TABLE_DEFAULT_HEIGHT = 512;

// 列状態（列幅・列の表示/非表示）の保存キー。画面・グリッドごとに一意にする。
// 列構成を変えたら末尾のバージョンを上げる（旧状態だと新列が末尾に回るため）。
const SALES_SUMMARY_COLUMN_STATE_KEY =
  'salesPlanAggregationVending.salesSummary.columnState.v5';
const DETAIL_COLUMN_STATE_KEY =
  'salesPlanAggregationVending.detail.columnState.v7';

// 列グループ（予算・前年）の開閉状態の保存キー。開閉状態は列状態（columnState）には
// 含まれないため、AG Grid 公式の getColumnGroupState / setColumnGroupState で別に扱う。
const DETAIL_GROUP_STATE_KEY =
  'salesPlanAggregationVending.detail.groupState.v1';

// 売上サマリ数値グリッドの行タイトル列（item1）の既定幅。
// 「初期表示は既定幅・以降はユーザーの調整を保持」を成立させるため、列定義と
// 下の適用済み幅の判定で同じ値を参照する。
const ROW_TITLE_COLUMN_ID = 'item1';
const ROW_TITLE_COLUMN_WIDTH = 198;
// 既定幅を最後に適用したときの値の記録先。
// 列状態（列幅）は利用者の調整を保持するため localStorage に残るが、それだけだと
// 上の既定幅をコード側で変更しても保存済みの旧幅が優先され、いつまでも反映されない。
// 「記録された値 ≠ 現在の既定幅」のときだけ既定幅へ戻すことで、
// 既定幅を変えた直後の初期表示では新しい幅、それ以降は利用者の調整を保持できる。
const ROW_TITLE_WIDTH_APPLIED_KEY =
  'salesPlanAggregationVending.salesSummary.rowTitleWidthApplied';

// 行ID（→ 画面設計標準 4.7）。いずれも固定の行定義から作るため、編集で変わらない値を使う。
//  ・売上サマリ数値：行番号 rowIndex（0〜13 で一意）
//  ・詳細2：行タイトル label（全行で一意）
const getSalesSummaryRowId = (params: GetRowIdParams) =>
  String(params.data.rowIndex);
const getDetailRowId = (params: GetRowIdParams<UnifiedAggregationData>) =>
  params.data.label;

// すべての列を率(%)で表示する項目。金額ではないため金額単位（円／千円）の換算対象から
// 外し、差額列も「小数第1位＋%」で表示する。
const RATE_ITEM_LABELS = new Set(['管理利益率', '条件口率', 'ロケ運転費率']);

// 前年比などの比率(%)を小数第1位まで表示（小数第2位を四捨五入）。
// 値が無い（空・"－"）ときは半角「-」、非数値はそのまま返す。AG Grid の valueFormatter で使用。
const formatRatioDecimal1 = (value: unknown): string => {
  if (value === null || value === undefined) return GRID_EMPTY_TEXT;
  const str = String(value);
  if (str === '' || str === '－') return GRID_EMPTY_TEXT;
  const num = parseFloat(str.replace(/[,%\s]/g, ''));
  if (isNaN(num)) return str;
  return (
    (Math.round(num * 10) / 10).toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + '%'
  );
};

interface UnifiedAggregationData {
  label: string;
  highlight: boolean;
  monthly_budget: string;
  monthly_plan: string;
  monthly_budgetRate: string;
  monthly_previousYear: string;
  monthly_previousYearRate: string;
  cumulative_budget: string;
  cumulative_plan: string;
  cumulative_budgetRate: string;
  cumulative_previousYear: string;
  cumulative_previousYearRate: string;
  yearly_budget: string;
  yearly_plan: string;
  yearly_budgetRate: string;
  yearly_previousYear: string;
  yearly_previousYearRate: string;
}

// セルレンダラー：折りたたみボタン。
// シェブロンは開閉カード（CollapsibleCard）と同じ見た目・挙動に揃える
// （h-5 w-5・text-gray-500／展開時に 180 度回転して上向き・折り畳み時は下向き）。
const CollapseCellRenderer = (props: any) => {
  if (!props.data?.hasCollapse) {
    return <span>{props.value}</span>;
  }
  const isCollapsed =
    props.context?.collapsedRows?.[props.data.collapseGroup] || false;
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          props.context?.toggleCollapse(props.data.collapseGroup);
        }}
        className="flex cursor-pointer items-center border-none bg-transparent p-0 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? '展開' : '折り畳み'}
      >
        <ChevronDown
          className={`h-5 w-5 text-gray-500 transition-transform ${
            isCollapsed ? '' : 'rotate-180'
          }`}
        />
      </button>
      <span>{props.value}</span>
    </div>
  );
};

// マウスオーバー時のツールチップ（画面設計標準準拠）を列定義へ再帰的に付与する。
// ・ヘッダー：列幅で省略された見出しを全文表示（AG Grid公式 headerTooltip）。
// ・セル：列幅で省略されたセル値を全文表示（AG Grid公式 tooltipValueGetter）。
const withStandardTooltips = (
  cols: (ColDef | ColGroupDef)[]
): (ColDef | ColGroupDef)[] =>
  cols.map((col) => {
    const headerTooltip =
      typeof col.headerName === 'string' && col.headerName
        ? col.headerName
        : (col as ColDef).headerTooltip;
    if ('children' in col && col.children) {
      return {
        ...col,
        headerTooltip,
        children: withStandardTooltips(col.children),
      };
    }
    return {
      ...col,
      headerTooltip,
      tooltipValueGetter: (params) =>
        params.value != null ? String(params.value) : '',
    };
  });

interface AggregationPaneProps {
  hideAggregationUnit?: boolean;
  expansionCostLabel?: string;
}

export function AggregationPane({
  hideAggregationUnit = false,
  expansionCostLabel = '拡売費集計対象選択',
}: AggregationPaneProps = {}) {
  const [isOpen, setIsOpen] = useState(true);

  // 集計表の高さ（ドラッグで拡縮）。売上サマリ数値・詳細で共通の高さを使う。
  const tableResize = useResizableHeight({
    defaultHeight: AGGREGATION_TABLE_DEFAULT_HEIGHT,
  });
  const [detailMode, setDetailMode] = useState<'detail1' | 'detail2' | null>(
    null
  );

  // グラフ表示か（＝表を出していないか）。グラフはグラフ自体の高さに合わせるため、
  // 高さの指定もリサイズハンドルも持たせない。
  const isGraphMode = detailMode === null;
  const [selectedMonth] = useState('7'); // 対象月（販売計画条件から取得想定）
  const [aggregationUnit, setAggregationUnit] = useState('all');
  const [selectedFilter, setSelectedFilter] = useState('');
  const [isAnnualPlanShown, setIsAnnualPlanShown] = useState(false);
  // 表示単位（円／千円）。金額の桁が大きいため既定は千円
  // （計画詳細(マージン率固定・NET入力)＝ PlanAggregationPane と同じ）。
  const [displayUnit, setDisplayUnit] = useState<'yen' | 'thousand'>(
    'thousand'
  );

  // 表示単位のラベルと除数。率・函数は単位非依存のため換算しない。
  const unitLabel = displayUnit === 'thousand' ? '千円' : '円';
  const unitDivisor = displayUnit === 'thousand' ? 1000 : 1;

  // 金額セルを表示単位へ換算する。千円表示は四捨五入して整数にする。
  // 値が無い（空・「－」）ときは半角「-」。非数値と、金額以外（函・台・本・コラム・%）はそのまま返す。
  const formatAmountByUnit = (value: unknown, isAmount: boolean): string => {
    const text = String(value ?? '').trim();
    if (text === '' || text === '－') return GRID_EMPTY_TEXT;
    if (!isAmount) return text;
    const num = parseFloat(text.replace(/,/g, ''));
    if (!Number.isFinite(num)) return text;
    return Math.round(num / unitDivisor).toLocaleString('ja-JP');
  };

  // グラフカードの値表記。率は％、函数は「函」、金額は表示単位（円／千円）を付ける。
  // 金額は円・千円いずれも四捨五入して整数で表示する。
  const formatCardValue = (value: number, unit: string): string => {
    if (unit === '%') return `${value.toFixed(1)}%`;
    if (unit === '函') return `${Math.round(value).toLocaleString('ja-JP')}函`;
    // 金額は末尾に単位（円／千円）を付けるため、先頭の通貨記号は付けない。
    // 単位は函数（「〇〇函」）と同じく値へ続けて書く。
    return `${Math.round(value / unitDivisor).toLocaleString('ja-JP')}${unitLabel}`;
  };

  // 統合表（詳細1／詳細2）の金額列に使う valueFormatter。
  // 行の単位は項目名から判定する（売上函数＝函／管理利益率＝％／その他＝金額）。
  const unifiedAmountFormatter = (params: {
    value: unknown;
    data?: { label?: string };
  }): string =>
    formatAmountByUnit(
      params.value,
      getChartUnit(params.data?.label ?? '') === '¥'
    );

  // 差額列（予算差・前年差）の値。同じ行の「計画/実績」から比較対象を引く。
  // 桁区切り付きの文字列で保持しているため、数値へ直してから引き算する。
  // どちらかが数値でない行（"-" 等）は差を出さず「-」にする。
  const unifiedDiffValueGetter =
    (planField: string, baseField: string) =>
    (params: { data?: Record<string, unknown> }): number | null => {
      const toNumber = (v: unknown): number | null => {
        const num = parseFloat(String(v ?? '').replace(/,/g, ''));
        return Number.isFinite(num) ? num : null;
      };
      const plan = toNumber(params.data?.[planField]);
      const base = toNumber(params.data?.[baseField]);
      if (plan === null || base === null) return null;
      return plan - base;
    };

  // 差額列の表示。金額行は金額単位（円／千円）へ換算し、函数など金額以外の行は
  // 3桁区切りの整数で表示する。
  const unifiedDiffFormatter = (params: {
    value: unknown;
    data?: { label?: string };
  }): string => {
    const value = params.value;
    if (typeof value !== 'number' || !Number.isFinite(value))
      return GRID_EMPTY_TEXT;
    const unit = getChartUnit(params.data?.label ?? '');
    const text =
      unit === '¥'
        ? formatAmountByUnit(value, true)
        : unit === '%'
          ? formatRatioDecimal1(value)
          : Math.round(value).toLocaleString('ja-JP');
    // 増減が一目で分かるよう、プラスは "+"、マイナスは "▲"、増減なしは "±" を頭に付ける
    // （経費計画グリッドの差分表示と同じ体裁）。
    // 四捨五入で 0 になる差も増減なしとして扱う（"-0" とは表示しない）。
    if (parseFloat(text) === 0) return `±${text.replace(/^-/, '')}`;
    return text.startsWith('-') ? `▲${text.slice(1)}` : `+${text}`;
  };
  const [periodStart, setPeriodStart] = useState(1);
  const [periodEnd, setPeriodEnd] = useState(5);
  const [collapsedRows, setCollapsedRows] = useState<{
    [key: number]: boolean;
  }>({});
  const collapsedRowsRef = useRef<{ [key: number]: boolean }>({});
  const gridRef = useRef<any>(null);
  const detailGridRef = useRef<any>(null);

  // 表示単位（円／千円）を切り替えたら金額セルを描き直す。
  // 列定義（valueFormatter）は差し替わるが、AG Grid は関数の差し替えだけでは
  // 既存セルを再評価しないため、明示的に再描画する。
  useEffect(() => {
    gridRef.current?.api?.refreshCells({ force: true });
    detailGridRef.current?.api?.refreshCells({ force: true });
  }, [displayUnit]);

  // 折りたたみ状態が変更されたときにrefを更新し、フィルタとセルを更新
  useEffect(() => {
    collapsedRowsRef.current = collapsedRows;
    if (gridRef.current?.api) {
      gridRef.current.api.onFilterChanged();
      gridRef.current.api.refreshCells({ force: true });
    }
  }, [collapsedRows]);

  // ダミーデータから集計単位別のリストを生成
  const metaBrandList = [
    '三ツ矢',
    'ウィルキンソン',
    '十六茶',
    'カルピス',
    'ワンダ',
  ];
  const containerCapacityList = ['500ml', '1L', '1.5L', '2L'];
  const wholesaleMeshList = [
    '【三ツ矢150円】三ツ矢サイダー28・350',
    '【ウィルキンソン101円】リタ瓶（プレーン）',
    '【十六茶100円】十六茶PET630',
  ];
  const summaryProductList = [
    '三ツ矢サイダーゼロストロング１．５Ｌ８本',
    '三ツ矢サイダーゼロストロング５００ｍＬ２４本',
    'ウィルキンソンタンサン１Ｌ１２本',
    'ウィルキンソンタンサンレモン５００ｍＬ２４本',
  ];

  // 年間計画「通常1」データ（14行）
  const annualPlanNormal1Data = [
    {
      rowIndex: 0,
      item1: '売上高',
      item2: '',
      item3: '',
      item4: '(円)',
      feb_actual: '32,500',
      feb_ratio: '96%',
      mar_actual: '35,200',
      mar_ratio: '99%',
      apr_actual: '31,800',
      apr_ratio: '94%',
      may_actual: '36,500',
      may_ratio: '102%',
      period_actual: '136,000',
      period_ratio: '97%',
      annual_actual: '408,000',
      annual_ratio: '98%',
      highlight: 'yellow',
    },
    {
      rowIndex: 1,
      item1: '社外売上高',
      item2: '',
      item3: '',
      item4: '(円)',
      feb_actual: '52,800',
      feb_ratio: '93%',
      mar_actual: '56,500',
      mar_ratio: '95%',
      apr_actual: '51,200',
      apr_ratio: '91%',
      may_actual: '58,100',
      may_ratio: '97%',
      period_actual: '218,600',
      period_ratio: '94%',
      annual_actual: '655,800',
      annual_ratio: '95%',
      highlight: 'yellow',
    },
    {
      rowIndex: 2,
      item1: '函数',
      item2: '',
      item3: '',
      item4: '(函)',
      feb_actual: '28,100',
      feb_ratio: '91%',
      mar_actual: '30,400',
      mar_ratio: '93%',
      apr_actual: '27,200',
      apr_ratio: '89%',
      may_actual: '31,500',
      may_ratio: '96%',
      period_actual: '117,200',
      period_ratio: '92%',
      annual_actual: '351,600',
      annual_ratio: '93%',
      highlight: 'yellow',
    },
    {
      rowIndex: 3,
      item1: '専用機',
      item2: '',
      item3: '',
      item4: '(函)',
      feb_actual: '15,200',
      feb_ratio: '95%',
      mar_actual: '16,500',
      mar_ratio: '98%',
      apr_actual: '14,800',
      apr_ratio: '92%',
      may_actual: '17,100',
      may_ratio: '101%',
      period_actual: '63,600',
      period_ratio: '96%',
      annual_actual: '192,000',
      annual_ratio: '97%',
      highlight: 'cyan',
      hasCollapse: true,
      collapseGroup: 3,
    },
    {
      rowIndex: 4,
      item1: '　　　台数',
      item2: '',
      item3: '',
      item4: '(台)',
      feb_actual: '1,200',
      feb_ratio: '98%',
      mar_actual: '1,250',
      mar_ratio: '101%',
      apr_actual: '1,180',
      apr_ratio: '96%',
      may_actual: '1,280',
      may_ratio: '103%',
      period_actual: '4,910',
      period_ratio: '99%',
      annual_actual: '14,700',
      annual_ratio: '100%',
      parentRow: 3,
    },
    {
      rowIndex: 5,
      item1: '　　　PM',
      item2: '',
      item3: '',
      item4: '(本)',
      feb_actual: '12.7',
      feb_ratio: '97%',
      mar_actual: '13.2',
      mar_ratio: '97%',
      apr_actual: '12.5',
      apr_ratio: '96%',
      may_actual: '13.4',
      may_ratio: '98%',
      period_actual: '13.0',
      period_ratio: '97%',
      annual_actual: '13.1',
      annual_ratio: '97%',
      parentRow: 3,
    },
    {
      rowIndex: 6,
      item1: '提携機',
      item2: '',
      item3: '',
      item4: '(函)',
      feb_actual: '8,500',
      feb_ratio: '88%',
      mar_actual: '9,200',
      mar_ratio: '91%',
      apr_actual: '8,100',
      apr_ratio: '85%',
      may_actual: '9,600',
      may_ratio: '94%',
      period_actual: '35,400',
      period_ratio: '89%',
      annual_actual: '106,800',
      annual_ratio: '90%',
      highlight: 'cyan',
      hasCollapse: true,
      collapseGroup: 6,
    },
    {
      rowIndex: 7,
      item1: '　　　コラム数',
      item2: '',
      item3: '',
      item4: '(コラム)',
      feb_actual: '2,850',
      feb_ratio: '89%',
      mar_actual: '3,100',
      mar_ratio: '92%',
      apr_actual: '2,700',
      apr_ratio: '86%',
      may_actual: '3,200',
      may_ratio: '95%',
      period_actual: '11,850',
      period_ratio: '90%',
      annual_actual: '35,700',
      annual_ratio: '91%',
      parentRow: 6,
    },
    {
      rowIndex: 8,
      item1: '　　　PC',
      item2: '',
      item3: '',
      item4: '(本)',
      feb_actual: '3.0',
      feb_ratio: '99%',
      mar_actual: '3.0',
      mar_ratio: '99%',
      apr_actual: '3.0',
      apr_ratio: '99%',
      may_actual: '3.0',
      may_ratio: '99%',
      period_actual: '3.0',
      period_ratio: '99%',
      annual_actual: '3.0',
      annual_ratio: '99%',
      parentRow: 6,
    },
    {
      rowIndex: 9,
      item1: 'アライアンス品（本社入力）',
      item2: '',
      item3: '',
      item4: '(函)',
      feb_actual: '3,200',
      feb_ratio: '102%',
      mar_actual: '3,500',
      mar_ratio: '105%',
      apr_actual: '3,100',
      apr_ratio: '99%',
      may_actual: '3,700',
      may_ratio: '108%',
      period_actual: '13,500',
      period_ratio: '103%',
      annual_actual: '40,800',
      annual_ratio: '104%',
      highlight: 'cyan',
      hasCollapse: true,
      collapseGroup: 9,
    },
    {
      rowIndex: 10,
      item1: '　　　台数',
      item2: '',
      item3: '',
      item4: '(台)',
      feb_actual: '1,100',
      feb_ratio: '104%',
      mar_actual: '1,200',
      mar_ratio: '107%',
      apr_actual: '1,050',
      apr_ratio: '101%',
      may_actual: '1,250',
      may_ratio: '110%',
      period_actual: '4,600',
      period_ratio: '105%',
      annual_actual: '13,800',
      annual_ratio: '106%',
      parentRow: 9,
    },
    {
      rowIndex: 11,
      item1: '　　　PM',
      item2: '',
      item3: '',
      item4: '(本)',
      feb_actual: '2.9',
      feb_ratio: '98%',
      mar_actual: '2.9',
      mar_ratio: '98%',
      apr_actual: '3.0',
      apr_ratio: '98%',
      may_actual: '3.0',
      may_ratio: '98%',
      period_actual: '2.9',
      period_ratio: '98%',
      annual_actual: '3.0',
      annual_ratio: '98%',
      parentRow: 9,
    },
    {
      rowIndex: 12,
      item1: 'その他（手売り）',
      item2: '',
      item3: '',
      item4: '(函)',
      feb_actual: '1,200',
      feb_ratio: '80%',
      mar_actual: '1,400',
      mar_ratio: '85%',
      apr_actual: '1,100',
      apr_ratio: '78%',
      may_actual: '1,500',
      may_ratio: '88%',
      period_actual: '5,200',
      period_ratio: '82%',
      annual_actual: '15,600',
      annual_ratio: '83%',
      highlight: 'cyan',
    },
    {
      rowIndex: 13,
      item1: '出荷実販差',
      item2: '',
      item3: '',
      item4: '(函)',
      feb_actual: '500',
      feb_ratio: '110%',
      mar_actual: '600',
      mar_ratio: '115%',
      apr_actual: '450',
      apr_ratio: '105%',
      may_actual: '650',
      may_ratio: '118%',
      period_actual: '2,200',
      period_ratio: '112%',
      annual_actual: '6,600',
      annual_ratio: '113%',
      highlight: 'cyan',
    },
  ];

  // 折りたたみボタンのトグル関数
  const toggleCollapse = (groupIndex: number) => {
    setCollapsedRows((prev) => ({
      ...prev,
      [groupIndex]: !prev[groupIndex],
    }));
  };

  // 年間計画「通常1」列定義
  const annualPlanNormal1ColumnDefs: (ColDef | ColGroupDef)[] = useMemo(
    () => [
      {
        headerName: '',
        suppressMenu: true,
        children: [
          {
            headerName: '',
            field: ROW_TITLE_COLUMN_ID,
            // 行タイトル列の既定幅（全角2文字分＝14px × 2 = 28px を従来の 220px に加算）。
            // 幅を変えるときは ROW_TITLE_COLUMN_WIDTH のみを直せばよい
            // （初期表示への反映は applyRowTitleDefaultWidth が担保する）。
            width: ROW_TITLE_COLUMN_WIDTH,
            suppressAutoSize: true, // 幅を決めてある列のため自動調整から外す
            // 行タイトル列は左詰め（実際の左寄せは下の <style> の
            // .sales-summary-grid 側の規則と合わせて効かせる）。
            cellClass: 'ag-cell-left',
            cellRenderer: CollapseCellRenderer,
            suppressMenu: true,
          },
          {
            headerName: '',
            field: 'item4',
            width: 68,
            cellClass: 'cell-right',
            suppressMenu: true,
            // 金額行の単位表記は表示単位に追従させる（(円) ⇔ (千円)）
            valueFormatter: (params: any) =>
              params.value === '(円)' ? `(${unitLabel})` : (params.value ?? ''),
          },
        ],
      },
      {
        headerName: '4月',
        headerTooltip: 'N-3月',
        children: [
          {
            headerName: '計画/実績',
            field: 'feb_actual',
            width: 120,
            cellClass: 'cell-right',
            // 金額行（単位が (円) の行）のみ表示単位へ換算する
            valueFormatter: (params: any) =>
              formatAmountByUnit(params.value, params.data?.item4 === '(円)'),
          },
          {
            headerName: '前年比',
            field: 'feb_ratio',
            width: 80,
            cellClass: 'cell-right',
            valueFormatter: (params) => formatRatioDecimal1(params.value),
          },
        ],
      },
      {
        headerName: '5月',
        headerTooltip: 'N-2月',
        children: [
          {
            headerName: '計画/実績',
            field: 'mar_actual',
            width: 120,
            cellClass: 'cell-right',
            // 金額行（単位が (円) の行）のみ表示単位へ換算する
            valueFormatter: (params: any) =>
              formatAmountByUnit(params.value, params.data?.item4 === '(円)'),
          },
          {
            headerName: '前年比',
            field: 'mar_ratio',
            width: 80,
            cellClass: 'cell-right',
            valueFormatter: (params) => formatRatioDecimal1(params.value),
          },
        ],
      },
      {
        headerName: '6月',
        headerTooltip: 'N-1月',
        children: [
          {
            headerName: '計画/実績',
            field: 'apr_actual',
            width: 120,
            cellClass: 'cell-right',
            // 金額行（単位が (円) の行）のみ表示単位へ換算する
            valueFormatter: (params: any) =>
              formatAmountByUnit(params.value, params.data?.item4 === '(円)'),
          },
          {
            headerName: '前年比',
            field: 'apr_ratio',
            width: 80,
            cellClass: 'cell-right',
            valueFormatter: (params) => formatRatioDecimal1(params.value),
          },
        ],
      },
      {
        headerName: '7月',
        headerTooltip: '当月',
        children: [
          {
            headerName: '計画/実績',
            field: 'may_actual',
            width: 120,
            cellClass: 'cell-right',
            // 金額行（単位が (円) の行）のみ表示単位へ換算する
            valueFormatter: (params: any) =>
              formatAmountByUnit(params.value, params.data?.item4 === '(円)'),
          },
          {
            headerName: '前年比',
            field: 'may_ratio',
            width: 80,
            cellClass: 'cell-right',
            valueFormatter: (params) => formatRatioDecimal1(params.value),
          },
        ],
      },
      {
        headerName: `${periodStart}～${periodEnd}月`,
        children: [
          {
            headerName: '計画/実績',
            field: 'period_actual',
            width: 120,
            cellClass: 'cell-right',
            // 金額行（単位が (円) の行）のみ表示単位へ換算する
            valueFormatter: (params: any) =>
              formatAmountByUnit(params.value, params.data?.item4 === '(円)'),
          },
          {
            headerName: '前年比',
            field: 'period_ratio',
            width: 80,
            cellClass: 'cell-right',
            valueFormatter: (params) => formatRatioDecimal1(params.value),
          },
        ],
      },
      {
        headerName: '年間計',
        children: [
          {
            headerName: '計画/実績',
            field: 'annual_actual',
            width: 128,
            cellClass: 'cell-right',
            // 金額行（単位が (円) の行）のみ表示単位へ換算する
            valueFormatter: (params: any) =>
              formatAmountByUnit(params.value, params.data?.item4 === '(円)'),
          },
          {
            headerName: '前年比',
            field: 'annual_ratio',
            width: 80,
            cellClass: 'cell-right',
            valueFormatter: (params) => formatRatioDecimal1(params.value),
          },
        ],
      },
    ],
    // displayUnit は金額列の valueFormatter が参照するため依存に含める
    [periodStart, periodEnd, displayUnit]
  );

  const unifiedData: UnifiedAggregationData[] = [
    {
      label: '売上函数',
      highlight: false,
      monthly_budget: '19,360',
      monthly_plan: '17,665',
      monthly_budgetRate: '91.2 %',
      monthly_previousYear: '21,750',
      monthly_previousYearRate: '81.2 %',
      cumulative_budget: '58,080',
      cumulative_plan: '52,995',
      cumulative_budgetRate: '91.2 %',
      cumulative_previousYear: '65,250',
      cumulative_previousYearRate: '81.2 %',
      yearly_budget: '232,320',
      yearly_plan: '211,980',
      yearly_budgetRate: '91.2 %',
      yearly_previousYear: '261,000',
      yearly_previousYearRate: '81.2 %',
    },
    {
      label: '売上高',
      highlight: true,
      monthly_budget: '32,279,000',
      monthly_plan: '30,238,947',
      monthly_budgetRate: '93.7 %',
      monthly_previousYear: '32,993,765',
      monthly_previousYearRate: '91.7 %',
      cumulative_budget: '96,837,000',
      cumulative_plan: '90,716,841',
      cumulative_budgetRate: '93.7 %',
      cumulative_previousYear: '98,981,295',
      cumulative_previousYearRate: '91.7 %',
      yearly_budget: '387,348,000',
      yearly_plan: '362,867,364',
      yearly_budgetRate: '93.7 %',
      yearly_previousYear: '395,925,180',
      yearly_previousYearRate: '91.7 %',
    },
    {
      label: '社外売上高',
      highlight: false,
      monthly_budget: '52,600,000',
      monthly_plan: '49,004,744',
      monthly_budgetRate: '93.2 %',
      monthly_previousYear: '54,113,322',
      monthly_previousYearRate: '90.6 %',
      cumulative_budget: '157,800,000',
      cumulative_plan: '147,014,232',
      cumulative_budgetRate: '93.2 %',
      cumulative_previousYear: '162,339,966',
      cumulative_previousYearRate: '90.6 %',
      yearly_budget: '631,200,000',
      yearly_plan: '588,056,928',
      yearly_budgetRate: '93.2 %',
      yearly_previousYear: '649,359,864',
      yearly_previousYearRate: '90.6 %',
    },
    {
      label: '条件口',
      highlight: false,
      monthly_budget: '20,321,000',
      monthly_plan: '18,765,797',
      monthly_budgetRate: '92.3 %',
      monthly_previousYear: '21,119,557',
      monthly_previousYearRate: '88.9 %',
      cumulative_budget: '60,963,000',
      cumulative_plan: '56,297,391',
      cumulative_budgetRate: '92.3 %',
      cumulative_previousYear: '63,358,671',
      cumulative_previousYearRate: '88.9 %',
      yearly_budget: '243,852,000',
      yearly_plan: '225,189,564',
      yearly_budgetRate: '92.3 %',
      yearly_previousYear: '253,434,684',
      yearly_previousYearRate: '88.9 %',
    },
    {
      label: '　 条件口率',
      highlight: false,
      // 予算比は率どうしの差ではなく「計画/実績 ÷ 予算」の比率で表す
      // （38.3 ÷ 38.6 × 100 ＝ 99.2%）。
      monthly_budget: '38.6%',
      monthly_plan: '38.3%',
      monthly_budgetRate: '99.2 %',
      monthly_previousYear: '39.0%',
      monthly_previousYearRate: '98.2 %',
      cumulative_budget: '38.6%',
      cumulative_plan: '38.3%',
      cumulative_budgetRate: '99.2 %',
      cumulative_previousYear: '39.0%',
      cumulative_previousYearRate: '98.2 %',
      yearly_budget: '38.6%',
      yearly_plan: '38.3%',
      yearly_budgetRate: '99.2 %',
      yearly_previousYear: '39.0%',
      yearly_previousYearRate: '98.2 %',
    },
    {
      label: '33S:ロケ運転費',
      highlight: false,
      monthly_budget: '20,048,000',
      monthly_plan: '18,350,207',
      monthly_budgetRate: '91.5 %',
      monthly_previousYear: '20,702,268',
      monthly_previousYearRate: '88.6 %',
      cumulative_budget: '60,144,000',
      cumulative_plan: '55,050,621',
      cumulative_budgetRate: '91.5 %',
      cumulative_previousYear: '62,106,804',
      cumulative_previousYearRate: '88.6 %',
      yearly_budget: '240,576,000',
      yearly_plan: '220,202,484',
      yearly_budgetRate: '91.5 %',
      yearly_previousYear: '248,427,216',
      yearly_previousYearRate: '88.6 %',
    },
    {
      label: '　 ロケ運転費率',
      highlight: false,
      // 予算比・前年比は率どうしの差ではなく比率で表す
      // （予算比＝37.4 ÷ 38.1 × 100 ＝ 98.2%／前年比＝37.4 ÷ 38.3 × 100 ＝ 97.7%）。
      monthly_budget: '38.1%',
      monthly_plan: '37.4%',
      monthly_budgetRate: '98.2 %',
      monthly_previousYear: '38.3%',
      monthly_previousYearRate: '97.7 %',
      cumulative_budget: '38.1%',
      cumulative_plan: '37.4%',
      cumulative_budgetRate: '98.2 %',
      cumulative_previousYear: '38.3%',
      cumulative_previousYearRate: '97.7 %',
      yearly_budget: '38.1%',
      yearly_plan: '37.4%',
      yearly_budgetRate: '98.2 %',
      yearly_previousYear: '38.3%',
      yearly_previousYearRate: '97.7 %',
    },
    {
      label: '69D:オペ協力金',
      highlight: false,
      monthly_budget: '420,000',
      monthly_plan: '385,000',
      monthly_budgetRate: '91.7 %',
      monthly_previousYear: '398,000',
      monthly_previousYearRate: '96.7 %',
      cumulative_budget: '1,260,000',
      cumulative_plan: '1,155,000',
      cumulative_budgetRate: '91.7 %',
      cumulative_previousYear: '1,194,000',
      cumulative_previousYearRate: '96.7 %',
      yearly_budget: '5,040,000',
      yearly_plan: '4,620,000',
      yearly_budgetRate: '91.7 %',
      yearly_previousYear: '4,776,000',
      yearly_previousYearRate: '96.7 %',
    },
    {
      label: '69Fその他一時金',
      highlight: false,
      monthly_budget: '273,000',
      monthly_plan: '415,590',
      monthly_budgetRate: '152.2 %',
      monthly_previousYear: '417,289',
      monthly_previousYearRate: '99.6 %',
      cumulative_budget: '819,000',
      cumulative_plan: '1,246,770',
      cumulative_budgetRate: '152.2 %',
      cumulative_previousYear: '1,251,867',
      cumulative_previousYearRate: '99.6 %',
      yearly_budget: '3,276,000',
      yearly_plan: '4,987,080',
      yearly_budgetRate: '152.2 %',
      yearly_previousYear: '5,007,468',
      yearly_previousYearRate: '99.6 %',
    },
    {
      label: '69E:ロケ契約料',
      highlight: false,
      monthly_budget: '850,000',
      monthly_plan: '920,000',
      monthly_budgetRate: '108.2 %',
      monthly_previousYear: '880,000',
      monthly_previousYearRate: '104.5 %',
      cumulative_budget: '2,550,000',
      cumulative_plan: '2,760,000',
      cumulative_budgetRate: '108.2 %',
      cumulative_previousYear: '2,640,000',
      cumulative_previousYearRate: '104.5 %',
      yearly_budget: '10,200,000',
      yearly_plan: '11,040,000',
      yearly_budgetRate: '108.2 %',
      yearly_previousYear: '10,560,000',
      yearly_previousYearRate: '104.5 %',
    },
    {
      label: '604:ロケ契約料他前払い金(償却)',
      highlight: false,
      monthly_budget: '200,000',
      monthly_plan: '250,000',
      monthly_budgetRate: '125.0 %',
      monthly_previousYear: '220,000',
      monthly_previousYearRate: '113.6 %',
      cumulative_budget: '600,000',
      cumulative_plan: '750,000',
      cumulative_budgetRate: '125.0 %',
      cumulative_previousYear: '660,000',
      cumulative_previousYearRate: '113.6 %',
      yearly_budget: '2,400,000',
      yearly_plan: '3,000,000',
      yearly_budgetRate: '125.0 %',
      yearly_previousYear: '2,640,000',
      yearly_previousYearRate: '113.6 %',
    },
    {
      label: 'V7P:自販機コラム料',
      highlight: false,
      monthly_budget: '1,200,000',
      monthly_plan: '1,150,000',
      monthly_budgetRate: '95.8 %',
      monthly_previousYear: '1,180,000',
      monthly_previousYearRate: '97.5 %',
      cumulative_budget: '3,600,000',
      cumulative_plan: '3,450,000',
      cumulative_budgetRate: '95.8 %',
      cumulative_previousYear: '3,540,000',
      cumulative_previousYearRate: '97.5 %',
      yearly_budget: '14,400,000',
      yearly_plan: '13,800,000',
      yearly_budgetRate: '95.8 %',
      yearly_previousYear: '14,160,000',
      yearly_previousYearRate: '97.5 %',
    },
    {
      label: '880:自販機リース料',
      highlight: false,
      monthly_budget: '2,850,000',
      monthly_plan: '2,720,000',
      monthly_budgetRate: '95.4 %',
      monthly_previousYear: '2,790,000',
      monthly_previousYearRate: '97.5 %',
      cumulative_budget: '8,550,000',
      cumulative_plan: '8,160,000',
      cumulative_budgetRate: '95.4 %',
      cumulative_previousYear: '8,370,000',
      cumulative_previousYearRate: '97.5 %',
      yearly_budget: '34,200,000',
      yearly_plan: '32,640,000',
      yearly_budgetRate: '95.4 %',
      yearly_previousYear: '33,480,000',
      yearly_previousYearRate: '97.5 %',
    },
    {
      label: '89H:販売器具移設費',
      highlight: false,
      monthly_budget: '1,580,000',
      monthly_plan: '1,420,000',
      monthly_budgetRate: '89.9 %',
      monthly_previousYear: '1,480,000',
      monthly_previousYearRate: '95.9 %',
      cumulative_budget: '4,740,000',
      cumulative_plan: '4,260,000',
      cumulative_budgetRate: '89.9 %',
      cumulative_previousYear: '4,440,000',
      cumulative_previousYearRate: '95.9 %',
      yearly_budget: '18,960,000',
      yearly_plan: '17,040,000',
      yearly_budgetRate: '89.9 %',
      yearly_previousYear: '17,760,000',
      yearly_previousYearRate: '95.9 %',
    },
    {
      label: '管理利益額',
      highlight: true,
      monthly_budget: '12,144,000',
      monthly_plan: '10,586,544',
      monthly_budgetRate: '87.2 %',
      monthly_previousYear: '10,936,275',
      monthly_previousYearRate: '96.8 %',
      cumulative_budget: '36,432,000',
      cumulative_plan: '31,759,632',
      cumulative_budgetRate: '87.2 %',
      cumulative_previousYear: '32,808,825',
      cumulative_previousYearRate: '96.8 %',
      yearly_budget: '145,728,000',
      yearly_plan: '127,038,528',
      yearly_budgetRate: '87.2 %',
      yearly_previousYear: '131,235,300',
      yearly_previousYearRate: '96.8 %',
    },
    {
      label: '管理利益率',
      highlight: false,
      // 予算比・前年比は率どうしの差ではなく比率で表す
      // （予算比＝35.0 ÷ 37.6 × 100 ＝ 93.1%／前年比＝35.0 ÷ 33.1 × 100 ＝ 105.7%）。
      monthly_budget: '37.6%',
      monthly_plan: '35.0%',
      monthly_budgetRate: '93.1 %',
      monthly_previousYear: '33.1%',
      monthly_previousYearRate: '105.7 %',
      cumulative_budget: '37.6%',
      cumulative_plan: '35.0%',
      cumulative_budgetRate: '93.1 %',
      cumulative_previousYear: '33.1%',
      cumulative_previousYearRate: '105.7 %',
      yearly_budget: '37.6%',
      yearly_plan: '35.0%',
      yearly_budgetRate: '93.1 %',
      yearly_previousYear: '33.1%',
      yearly_previousYearRate: '105.7 %',
    },
  ];

  const leftData = unifiedData.map((row) => ({
    label: row.label,
    budget: row.monthly_budget,
    plan: row.monthly_plan,
    budgetRate: row.monthly_budgetRate,
    previousYear: row.monthly_previousYear,
    previousYearRate: row.monthly_previousYearRate,
    highlight: row.highlight,
  }));

  const cumulativeData = unifiedData.map((row) => ({
    label: row.label,
    budget: row.cumulative_budget,
    plan: row.cumulative_plan,
    budgetRate: row.cumulative_budgetRate,
    previousYear: row.cumulative_previousYear,
    previousYearRate: row.cumulative_previousYearRate,
    highlight: row.highlight,
  }));

  const yearlyData = unifiedData.map((row) => ({
    label: row.label,
    budget: row.yearly_budget,
    plan: row.yearly_plan,
    budgetRate: row.yearly_budgetRate,
    previousYear: row.yearly_previousYear,
    previousYearRate: row.yearly_previousYearRate,
    highlight: row.highlight,
  }));

  // Column Definitions - 列グループ化
  const columnDefs: ColDef[] = useMemo(
    () => [
      {
        headerName: '項目',
        field: 'label',
        width: 192,
        lockPinned: true,
        cellClass: 'ag-cell-left-pinned',
        flex: 0,
        suppressAutoSize: true, // 幅を決めてある列のため自動調整から外す
      },
      {
        headerName: '🗓️ 7月合計',
        children: [
          {
            headerName: '計画/実績',
            field: 'monthly_plan',
            width: 88,
            cellClass: 'cell-right',
            valueFormatter: unifiedAmountFormatter,
          },
          {
            headerName: '予算比較',
            groupId: 'monthlyBudgetGroup',
            children: [
              {
                headerName: '予算',
                field: 'monthly_budget',
                width: 88,
                cellClass: 'cell-right',
                valueFormatter: unifiedAmountFormatter,
              },
              {
                headerName: '予算比',
                field: 'monthly_budgetRate',
                columnGroupShow: 'open',
                width: 68,
                cellClass: 'cell-right',
              },
              {
                // 予算差＝計画/実績 − 予算（同じ 7月合計 グループ内の値で算出）
                headerName: '予算差',
                colId: 'monthly_budgetDiff',
                columnGroupShow: 'open',
                width: 88,
                cellClass: 'cell-right',
                valueGetter: unifiedDiffValueGetter(
                  'monthly_plan',
                  'monthly_budget'
                ),
                valueFormatter: unifiedDiffFormatter,
              },
            ],
          },
          {
            headerName: '前年比較',
            groupId: 'monthlyPrevYearGroup',
            children: [
              {
                headerName: '前年',
                field: 'monthly_previousYear',
                width: 88,
                cellClass: 'cell-right',
                valueFormatter: unifiedAmountFormatter,
              },
              {
                headerName: '前年比',
                field: 'monthly_previousYearRate',
                columnGroupShow: 'open',
                width: 68,
                cellClass: 'cell-right',
              },
              {
                // 前年差＝計画/実績 − 前年（同じ 7月合計 グループ内の値で算出）
                headerName: '前年差',
                colId: 'monthly_previousYearDiff',
                columnGroupShow: 'open',
                width: 88,
                cellClass: 'cell-right',
                valueGetter: unifiedDiffValueGetter(
                  'monthly_plan',
                  'monthly_previousYear'
                ),
                valueFormatter: unifiedDiffFormatter,
              },
            ],
          },
        ],
      },
      {
        headerName: `📊 ${periodStart}～${periodEnd}月累計`,
        children: [
          {
            headerName: '計画/実績',
            field: 'cumulative_plan',
            width: 96,
            cellClass: 'cell-right',
            valueFormatter: unifiedAmountFormatter,
          },
          {
            headerName: '予算比較',
            groupId: 'cumulativeBudgetGroup',
            children: [
              {
                headerName: '予算',
                field: 'cumulative_budget',
                width: 96,
                cellClass: 'cell-right',
                valueFormatter: unifiedAmountFormatter,
              },
              {
                headerName: '予算比',
                field: 'cumulative_budgetRate',
                columnGroupShow: 'open',
                width: 68,
                cellClass: 'cell-right',
              },
              {
                // 予算差＝計画/実績 − 予算（同じ 累計 グループ内の値で算出）
                headerName: '予算差',
                colId: 'cumulative_budgetDiff',
                columnGroupShow: 'open',
                width: 96,
                cellClass: 'cell-right',
                valueGetter: unifiedDiffValueGetter(
                  'cumulative_plan',
                  'cumulative_budget'
                ),
                valueFormatter: unifiedDiffFormatter,
              },
            ],
          },
          {
            headerName: '前年比較',
            groupId: 'cumulativePrevYearGroup',
            children: [
              {
                headerName: '前年',
                field: 'cumulative_previousYear',
                width: 96,
                cellClass: 'cell-right',
                valueFormatter: unifiedAmountFormatter,
              },
              {
                headerName: '前年比',
                field: 'cumulative_previousYearRate',
                columnGroupShow: 'open',
                width: 68,
                cellClass: 'cell-right',
              },
              {
                // 前年差＝計画/実績 − 前年（同じ 累計 グループ内の値で算出）
                headerName: '前年差',
                colId: 'cumulative_previousYearDiff',
                columnGroupShow: 'open',
                width: 96,
                cellClass: 'cell-right',
                valueGetter: unifiedDiffValueGetter(
                  'cumulative_plan',
                  'cumulative_previousYear'
                ),
                valueFormatter: unifiedDiffFormatter,
              },
            ],
          },
        ],
      },
      {
        headerName: '📅 年間',
        children: [
          {
            headerName: '計画/実績',
            field: 'yearly_plan',
            width: 96,
            cellClass: 'cell-right',
            valueFormatter: unifiedAmountFormatter,
          },
          {
            headerName: '予算比較',
            groupId: 'yearlyBudgetGroup',
            children: [
              {
                headerName: '予算',
                field: 'yearly_budget',
                width: 96,
                cellClass: 'cell-right',
                valueFormatter: unifiedAmountFormatter,
              },
              {
                headerName: '予算比',
                field: 'yearly_budgetRate',
                columnGroupShow: 'open',
                width: 68,
                cellClass: 'cell-right',
              },
              {
                // 予算差＝計画/実績 − 予算（同じ 年間 グループ内の値で算出）
                headerName: '予算差',
                colId: 'yearly_budgetDiff',
                columnGroupShow: 'open',
                width: 96,
                cellClass: 'cell-right',
                valueGetter: unifiedDiffValueGetter(
                  'yearly_plan',
                  'yearly_budget'
                ),
                valueFormatter: unifiedDiffFormatter,
              },
            ],
          },
          {
            headerName: '前年比較',
            groupId: 'yearlyPrevYearGroup',
            children: [
              {
                headerName: '前年',
                field: 'yearly_previousYear',
                width: 96,
                cellClass: 'cell-right',
                valueFormatter: unifiedAmountFormatter,
              },
              {
                headerName: '前年比',
                field: 'yearly_previousYearRate',
                columnGroupShow: 'open',
                width: 68,
                cellClass: 'cell-right',
              },
              {
                // 前年差＝計画/実績 − 前年（同じ 年間 グループ内の値で算出）
                headerName: '前年差',
                colId: 'yearly_previousYearDiff',
                columnGroupShow: 'open',
                width: 96,
                cellClass: 'cell-right',
                valueGetter: unifiedDiffValueGetter(
                  'yearly_plan',
                  'yearly_previousYear'
                ),
                valueFormatter: unifiedDiffFormatter,
              },
            ],
          },
        ],
      },
    ],
    // displayUnit は金額列の valueFormatter が参照するため依存に含める
    [periodStart, periodEnd, displayUnit]
  );

  const defaultColDef: ColDef = useMemo(
    () => ({
      resizable: true,
      sortable: false,
      filter: false,
      // 列メニュー（三点）ボタンを非表示（共通テーマ標準に合わせる）
      suppressHeaderMenuButton: true,
      // 値が無いセルの「-」をグレーにする（共通の既定列設定のルールを流用）
      cellClassRules: {
        'cell-empty': GRID_DEFAULT_COL_DEF.cellClassRules!['cell-empty'],
      },
    }),
    []
  );

  // 行タイトル列の幅を「初期表示は既定幅・以降は利用者の調整を保持」で適用する。
  // 共通フックが保存済み列状態を復元した後に実行され、既定幅が変わったときだけ上書きする。
  const applyRowTitleDefaultWidth = useCallback((event: GridReadyEvent) => {
    const applied = localStorage.getItem(ROW_TITLE_WIDTH_APPLIED_KEY);
    if (applied === String(ROW_TITLE_COLUMN_WIDTH)) return;
    event.api.applyColumnState({
      state: [{ colId: ROW_TITLE_COLUMN_ID, width: ROW_TITLE_COLUMN_WIDTH }],
    });
    localStorage.setItem(
      ROW_TITLE_WIDTH_APPLIED_KEY,
      String(ROW_TITLE_COLUMN_WIDTH)
    );
  }, []);

  // 列状態（列幅・列の表示/非表示）の保存／復元（共通フック）。
  // 行タイトル列（項目）は幅を決めてあるため自動調整から外す（suppressAutoSize）。
  const salesSummaryColumnStateProps = useGridColumnState(
    SALES_SUMMARY_COLUMN_STATE_KEY,
    { onGridReady: applyRowTitleDefaultWidth }
  );
  // 保存済みの列グループ（予算・前年）の開閉状態を適用する。
  const handleRestoreDetailGroupState = useCallback(
    (event: { api: GridApi }) => {
      try {
        const saved = localStorage.getItem(DETAIL_GROUP_STATE_KEY);
        if (saved) event.api.setColumnGroupState(JSON.parse(saved));
      } catch {
        // 保存値が壊れている場合は列定義どおりの開閉状態のままにする
      }
    },
    []
  );

  const detailColumnStateProps = useGridColumnState(DETAIL_COLUMN_STATE_KEY, {
    // 列状態の復元に続けて、列グループの開閉状態も復元する。
    onGridReady: handleRestoreDetailGroupState,
  });

  // 「列設定をリセット」時は、列グループも列定義どおり＝全て閉じた状態へ戻す。
  // 保存済みの開閉状態も消し、以降の復元で開いた状態が戻らないようにする
  // （初回アクセス時と同じ状態にそろえる）。
  const handleResetDetailGroupState = useCallback((event: { api: GridApi }) => {
    event.api.resetColumnGroupState();
    try {
      localStorage.removeItem(DETAIL_GROUP_STATE_KEY);
    } catch {
      // 保存領域を扱えない環境では消す処理も行わない
    }
  }, []);

  // 列グループを開閉するたびに状態を保存する（次回アクセス時に復元する）。
  const handleSaveDetailGroupState = useCallback((event: { api: GridApi }) => {
    try {
      localStorage.setItem(
        DETAIL_GROUP_STATE_KEY,
        JSON.stringify(event.api.getColumnGroupState())
      );
    } catch {
      // 保存できない環境（プライベートモード等）では記憶しない
    }
  }, []);

  // マウスオーバー時のツールチップ（画面設計標準準拠）を付与した列定義。
  const annualPlanNormal1ColumnDefsWithTooltips = useMemo(
    () => withStandardTooltips(annualPlanNormal1ColumnDefs),
    [annualPlanNormal1ColumnDefs]
  );
  const columnDefsWithTooltips = useMemo(
    () => withStandardTooltips(columnDefs),
    [columnDefs]
  );

  const getRowStyle = useCallback((params: RowClassParams) => {
    // 合計・強調行は共通トークン（GRID_COLORS.total＝薄い青）で強調。
    // それ以外の行背景・ストライプは共通テーマ（GRID_THEME）の既定に委譲する。
    if (params.data?.highlight) {
      return rowKindBg('total', { fontWeight: 'bold' });
    }
    return undefined;
  }, []);

  const getChartUnit = (label: string) => {
    // 階層表現の字下げ（全角・半角の空白）を除いた項目名で判定する
    // （\s は全角空白 U+3000 も対象になる）
    const name = label.replace(/\s/g, '');
    if (name === '売上函数') return '函';
    if (RATE_ITEM_LABELS.has(name)) return '%';
    return '¥';
  };

  const prepareMonthlyChartData = () => {
    const targetIndices = [0, 1, 2, 14, 15];
    return targetIndices.map((idx) => {
      const data = leftData[idx];
      if (!data) return { name: '', unit: '¥', 予算: 0, 計画: 0, 前年同月: 0 };
      const parseValue = (str: string) => parseFloat(str.replace(/,/g, ''));
      return {
        name: data.label,
        unit: getChartUnit(data.label),
        予算: parseValue(data.budget),
        計画: parseValue(data.plan),
        前年同月: parseValue(data.previousYear),
      };
    });
  };

  const prepareCumulativeChartData = () => {
    const targetIndices = [0, 1, 2, 14, 15];
    return targetIndices.map((idx) => {
      const data = cumulativeData[idx];
      if (!data) return { name: '', unit: '¥', 予算: 0, 計画: 0, 前年同月: 0 };
      const parseValue = (str: string) => parseFloat(str.replace(/,/g, ''));
      return {
        name: data.label,
        unit: getChartUnit(data.label),
        予算: parseValue(data.budget),
        計画: parseValue(data.plan),
        前年同月: parseValue(data.previousYear),
      };
    });
  };

  const prepareYearlyChartData = () => {
    const targetIndices = [0, 1, 2, 14, 15];
    return targetIndices.map((idx) => {
      const data = yearlyData[idx];
      if (!data) return { name: '', unit: '¥', 予算: 0, 計画: 0, 前年同月: 0 };
      const parseValue = (str: string) => parseFloat(str.replace(/,/g, ''));
      return {
        name: data.label,
        unit: getChartUnit(data.label),
        予算: parseValue(data.budget),
        計画: parseValue(data.plan),
        前年同月: parseValue(data.previousYear),
      };
    });
  };

  const prepareAnnualPlanData = () => {
    const targetIndices = [0, 1, 2, 15, 16];
    return targetIndices.map((idx) => {
      const data = yearlyData[idx];
      const parseValue = (str: string) => parseFloat(str.replace(/,/g, ''));
      return {
        name: `${data.label}（年間計画）`,
        unit: getChartUnit(data?.label ?? ''),
        予算: parseValue(data?.budget ?? '0'),
        計画: parseValue(data?.plan ?? '0'),
        前年同月: parseValue(data?.previousYear ?? '0'),
      };
    });
  };

  const renderMiniBarChart = (data: any, index: number) => {
    // 率は保持している予算値・前年値を分母に算出する。
    const budgetRate = (data.計画 / data.予算) * 100;
    const previousYearRate = (data.計画 / data.前年同月) * 100;
    // カード下部には値そのものではなく、計画/実績との差を表示する。
    // 符号は詳細グリッドの差額列と同じ体裁（プラス "+"／マイナス "▲"／増減なし "±"）。
    const formatDiff = (diff: number): string => {
      const text = formatCardValue(Math.abs(diff), data.unit);
      if (Math.round(diff) === 0) return `±${text}`;
      return diff > 0 ? `+${text}` : `▲${text}`;
    };
    const budgetDiff = data.計画 - data.予算;
    const previousYearDiff = data.計画 - data.前年同月;

    const getBudgetColor = (rate: number) => {
      if (rate >= 95) return 'bg-emerald-500';
      if (rate >= 85) return 'bg-amber-500';
      return 'bg-red-500';
    };

    const getPreviousYearColor = (rate: number) => {
      if (rate >= 100) return 'bg-emerald-500';
      if (rate >= 90) return 'bg-amber-500';
      return 'bg-red-500';
    };

    const budgetColor = getBudgetColor(budgetRate);
    const previousYearColor = getPreviousYearColor(previousYearRate);

    return (
      <div
        key={index}
        className="bg-gradient-to-br from-white to-blue-50 rounded-xl border-2 border-gray-300 shadow-md hover:shadow-lg transition-shadow px-3.5 py-4"
      >
        <div className="text-sm font-bold text-gray-800 mb-3 pb-2 border-b-2 border-blue-200">
          {data.name}
        </div>
        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-1">計画/実績</div>
          <div className="text-xl font-bold text-blue-600">
            {formatCardValue(data.計画, data.unit)}
          </div>
        </div>
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-sm text-gray-600">予算達成率</span>
            <span
              className={`text-sm font-bold ${budgetRate >= 95 ? 'text-emerald-600' : budgetRate >= 85 ? 'text-amber-600' : 'text-red-600'}`}
            >
              {budgetRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`${budgetColor} h-3 rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-1`}
              style={{ width: `${Math.min(budgetRate, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-sm text-gray-400">
              予算差: {formatDiff(budgetDiff)}
            </span>
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-sm text-gray-600">前年比</span>
            <span
              className={`text-sm font-bold ${previousYearRate >= 100 ? 'text-emerald-600' : previousYearRate >= 90 ? 'text-amber-600' : 'text-red-600'}`}
            >
              {previousYearRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`${previousYearColor} h-3 rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-1`}
              style={{
                width: `${Math.min(previousYearRate, 100)}%`,
              }}
            />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-sm text-gray-400">
              前年差: {formatDiff(previousYearDiff)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <CollapsibleCard
      title="販売計画(集計)"
      open={isOpen}
      onOpenChange={setIsOpen}
      className="mb-4"
    >
      <div className="bg-white rounded-lg border border-gray-200 p-2">
        <div className="flex items-center gap-3">
          {/* 集計単位選択 */}
          <div className="flex items-center gap-2"></div>

          {/* 動的フィルタプルダウン */}
          {aggregationUnit === 'all' && (
            <div className="flex items-center gap-2"></div>
          )}

          {aggregationUnit === 'meta-brand' && (
            <div className="flex items-center gap-2">
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="w-50 h-8 px-3 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">すべて</option>
                {metaBrandList.map((brand, index) => (
                  <option key={index} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>
          )}

          {aggregationUnit === 'container-capacity' && (
            <div className="flex items-center gap-2">
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="w-50 h-8 px-3 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">すべて</option>
                {containerCapacityList.map((capacity, index) => (
                  <option key={index} value={capacity}>
                    {capacity}
                  </option>
                ))}
              </select>
            </div>
          )}

          {aggregationUnit === 'trade-system-mesh' && (
            <div className="flex items-center gap-2">
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="w-70 h-8 px-3 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">すべて</option>
                {wholesaleMeshList.map((mesh, index) => (
                  <option key={index} value={mesh}>
                    {mesh}
                  </option>
                ))}
              </select>
            </div>
          )}

          {aggregationUnit === 'summary-product' && (
            <div className="flex items-center gap-2">
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="w-75 h-8 px-3 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">すべて</option>
                {summaryProductList.map((product, index) => (
                  <option key={index} value={product}>
                    {product}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 拡売費集計対象選択 */}
          <div className="flex items-center gap-2">
            <RadioGroup
              defaultValue="target-month"
              className="flex items-center gap-4"
            >
              <div className="flex items-center gap-2"></div>
              <div className="flex items-center gap-2"></div>
            </RadioGroup>
          </div>

          {/* 担当外拡売費除外トグル */}
          <div className="flex items-center gap-2"></div>

          {/* 期間選択 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-700 whitespace-nowrap">
              累計期間指定
            </span>
            <NumericInput
              min="1"
              max="12"
              maxFractionDigits={0}
              value={String(periodStart)}
              aria-label="累計期間の開始月"
              onChange={(e) => setPeriodStart(Number(e.target.value))}
              className={`${TEXT_INPUT_CLASS} w-20 text-right`}
            />
            <span className="text-sm">～</span>
            <NumericInput
              min="1"
              max="12"
              maxFractionDigits={0}
              value={String(periodEnd)}
              aria-label="累計期間の終了月"
              onChange={(e) => setPeriodEnd(Number(e.target.value))}
              className={`${TEXT_INPUT_CLASS} w-20 text-right`}
            />
            <span className="text-sm text-gray-700">月</span>
          </div>

          {/* 金額単位トグル（円／千円）。計画詳細(マージン率固定・NET入力)＝
              PlanAggregationPane と同じ操作・見た目にそろえる。既定は千円。
              右隣の売上サマリ数値／グラフのトグルとは全角4文字分（text-sm 0.875rem ×4
              ＝3.5rem）空ける。親の gap-3（0.75rem）と mr-11（2.75rem）の合計で確保する。 */}
          <div className="flex items-center gap-2 ml-auto mr-11">
            <label className={`${FORM_LABEL_CLASS} whitespace-nowrap`}>
              金額単位
            </label>
            <div className="inline-flex rounded-md border border-gray-300 overflow-hidden h-8">
              <button
                onClick={() => setDisplayUnit('yen')}
                className={`px-4 text-sm font-medium transition-colors ${
                  displayUnit === 'yen'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                円
              </button>
              <button
                onClick={() => setDisplayUnit('thousand')}
                className={`px-4 text-sm font-medium transition-colors ${
                  displayUnit === 'thousand'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                千円
              </button>
            </div>
          </div>

          {/* 詳細1/詳細2/グラフトグルボタン（標準セグメントトグル） */}
          <div className="flex border-2 border-blue-600 rounded-lg overflow-hidden">
            <button
              onClick={() =>
                setDetailMode(detailMode === 'detail1' ? null : 'detail1')
              }
              className={`px-4 py-1 h-8 whitespace-nowrap text-sm font-medium transition-colors ${
                detailMode === 'detail1'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-blue-600 hover:bg-blue-50'
              }`}
            >
              売上サマリ数値
            </button>
            <div className="w-px bg-blue-600" />
            <button
              onClick={() =>
                setDetailMode(detailMode === 'detail2' ? null : 'detail2')
              }
              className={`px-4 py-1 h-8 whitespace-nowrap text-sm font-medium transition-colors ${
                detailMode === 'detail2'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-blue-600 hover:bg-blue-50'
              }`}
            >
              詳細
            </button>
            <div className="w-px bg-blue-600" />
            <button
              onClick={() => setDetailMode(null)}
              className={`px-4 py-1 h-8 whitespace-nowrap text-sm font-medium transition-colors ${
                detailMode === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-blue-600 hover:bg-blue-50'
              }`}
            >
              グラフ
            </button>
          </div>
        </div>
      </div>

      {/* 表示エリア（詳細1／グラフ／詳細2）。高さはカード下端のハンドルで調整する
      {/* 詳細1表示。グリッド自身に高さを持たせて AG Grid 側で縦スクロールさせる
          （ヘッダー＝タイトル行はスクロールしても固定される）。 */}
      {detailMode === 'detail1' && (
        <div className="mb-4">
          <style>{`
            /* 行タイトル（先頭列）を左詰めにする。
               グローバルCSSの「先頭列を中央寄せ」（チェックボックス列向け）は
               セル自身とその子要素の両方に justify-content: center を効かせるため、
               左寄せにはこの2つを揃えて上書きする必要がある。 */
            .sales-summary-grid .ag-cell[aria-colindex='1'],
            .sales-summary-grid .ag-cell[aria-colindex='1'] > * {
              justify-content: flex-start;
            }
          `}</style>
          <div
            className="sales-summary-grid w-full"
            style={{ height: tableResize.height }}
          >
            <AgGridReact
              {...GRID_BASE_PROPS}
              {...salesSummaryColumnStateProps}
              ref={gridRef}
              rowData={annualPlanNormal1Data}
              columnDefs={annualPlanNormal1ColumnDefsWithTooltips}
              defaultColDef={defaultColDef}
              getRowId={getSalesSummaryRowId}
              // defaultColDef で filter: false のため、型によるフィルタの追加を止める（→ grid/gridCommon）
              columnTypes={GRID_NO_FILTER_COLUMN_TYPES}
              context={{
                collapsedRows: collapsedRows,
                toggleCollapse: toggleCollapse,
              }}
              isExternalFilterPresent={() => true}
              doesExternalFilterPass={(node) => {
                const data = node.data;
                if (!data) return true;
                // 親行が折りたたまれている場合、子行を非表示（refを使って最新の状態を参照）
                if (data.parentRow !== undefined) {
                  return !collapsedRowsRef.current[data.parentRow];
                }
                return true;
              }}
              getRowStyle={(params) =>
                // 主要指標（強調）行は共通トークン（GRID_COLORS.total）で強調。
                // 他の行はテーマ既定の背景に委譲する。
                params.data?.highlight === 'yellow'
                  ? rowKindBg('total', { fontWeight: 'bold' })
                  : undefined
              }
              suppressMovableColumns={true}
              tooltipShowDelay={300}
            />
          </div>
          {/* リサイズハンドルはAG Gridの外（表の下端）に配置し、
                計画詳細(NET固定)＝ PlanAggregationPane と統一する */}
          <div className="relative h-2">
            <ResizeHandle onMouseDown={tableResize.handleMouseDown} />
          </div>
        </div>
      )}

      {/* グラフ表示。カードの高さをグラフの高さに合わせるため、
            高さの制約もリサイズハンドルも持たせない。 */}
      {isGraphMode && (
        <div className="p-6">
          <Tabs defaultValue="monthly" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4 bg-transparent p-0 h-auto gap-1">
              <TabsTrigger
                value="monthly"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded"
              >
                <Calendar className="w-4 h-4" />
                <span className="font-medium">{selectedMonth}月合計</span>
              </TabsTrigger>
              <TabsTrigger
                value="cumulative"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded"
              >
                <TrendingUp className="w-4 h-4" />
                <span className="font-medium">
                  {periodStart}～{periodEnd}月累計
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="yearly"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded"
              >
                <CalendarRange className="w-4 h-4" />
                <span className="font-medium">年間</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="monthly"
              className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg"
            >
              <div className="grid grid-cols-5 gap-2">
                {(isAnnualPlanShown
                  ? prepareAnnualPlanData()
                  : prepareMonthlyChartData()
                ).map((data, idx) => renderMiniBarChart(data, idx))}
              </div>
            </TabsContent>

            <TabsContent
              value="cumulative"
              className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg"
            >
              <div className="grid grid-cols-5 gap-2">
                {(isAnnualPlanShown
                  ? prepareAnnualPlanData()
                  : prepareCumulativeChartData()
                ).map((data, idx) => renderMiniBarChart(data, idx))}
              </div>
            </TabsContent>

            <TabsContent
              value="yearly"
              className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg"
            >
              <div className="grid grid-cols-5 gap-2">
                {(isAnnualPlanShown
                  ? prepareAnnualPlanData()
                  : prepareYearlyChartData()
                ).map((data, idx) => renderMiniBarChart(data, idx))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* 詳細2表示（表）。詳細1と同じくグリッド側で縦スクロールし、
          ヘッダー＝タイトル行を固定する。 */}
      {detailMode === 'detail2' && (
        <div className="mb-4">
          <div className="w-full" style={{ height: tableResize.height }}>
            <AgGridReact
              ref={detailGridRef}
              {...GRID_BASE_PROPS}
              {...detailColumnStateProps}
              onColumnGroupOpened={handleSaveDetailGroupState}
              onColumnsReset={handleResetDetailGroupState}
              // 集計期間・金額単位の変更で列定義が作り直されると開閉状態が
              // 既定へ戻るため、そのたびに保存済みの状態を適用し直す。
              onColumnEverythingChanged={handleRestoreDetailGroupState}
              rowData={unifiedData}
              columnDefs={columnDefsWithTooltips}
              defaultColDef={defaultColDef}
              getRowId={getDetailRowId}
              // defaultColDef で filter: false のため、型によるフィルタの追加を止める（→ grid/gridCommon）
              columnTypes={GRID_NO_FILTER_COLUMN_TYPES}
              getRowStyle={getRowStyle}
              suppressMovableColumns={true}
              tooltipShowDelay={300}
            />
          </div>
          {/* リサイズハンドルはAG Gridの外（表の下端）に配置し、
              計画詳細(NET固定)＝ PlanAggregationPane と統一する */}
          <div className="relative h-2">
            <ResizeHandle onMouseDown={tableResize.handleMouseDown} />
          </div>
        </div>
      )}
    </CollapsibleCard>
  );
}
