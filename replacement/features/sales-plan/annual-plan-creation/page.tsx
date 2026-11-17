// 年間計画（補助機能）。量販/卸を統一した1画面。
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Save, SlidersHorizontal, ArrowLeft } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import type {
  ColDef,
  ColGroupDef,
  FilterChangedEvent,
  GridApi,
  ICellRendererParams,
} from 'ag-grid-community';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  SingleComboboxCellEditor,
  toComboOptions,
} from '@/components/ui/single-combobox-cell-editor';
import { MultiCombobox } from '@/components/ui/multi-combobox';
import { RightPane } from '@/components/ui/right-pane';
import { PlanSearchPane } from '@/features/sales-plan/shared/plan-detail/PlanSearchPane';
import {
  viewportGridHeight,
  GRID_COLORS,
  GRID_DEFAULT_COL_DEF,
  GRID_BASE_PROPS,
  GRID_EMPTY_TEXT,
  GRID_STATUS_BAR,
  gridFilterContextMenuItems,
  existingFuncCellStyle,
  withHeaderTooltips,
  useChangedCells,
  useFormulaSourceHighlight,
  type FormulaDefs,
  useGridColumnState,
  asCellStyle,
} from '@/components/grid';
import { makeDetailTooltip } from '@/utils/sales-plan/common/formulaCellHelpers';
import { SingleCombobox } from '@/components/ui/single-combobox';
import { generateRowData } from '@/mocks/sales-plan/annual-plan-creation';
import { promotionComboOptions } from '@/constants/comboFieldOptions';
import {
  BUTTON_STYLES,
  BUTTON_BASE,
  FORM_LABEL_CLASS,
  CARD_CLASS,
} from '@/styles/commonStyles';
import {
  PROMOTION_NONE_LABEL,
  CATEGORY_LABELS_ANNUAL,
} from '@/constants/promotionCategories';
import { getPromotionLabels } from '@/utils/sales-plan/common/promotionCategories';
import { ScreenTitle } from '@/components/ui/screen-title';
import { useAppNavigation } from '@/components/ui/use-app-navigation';
import { planBasicInfoOf } from '@/mocks/common/planBasicInfo';

// 函数（月次計画）列。年間合計・全商品合計の再集計にも使用する。
const MONTH_COLUMNS: { field: string; headerName: string }[] = [
  { field: 'jan', headerName: '1月' },
  { field: 'feb', headerName: '2月' },
  { field: 'mar', headerName: '3月' },
  { field: 'apr', headerName: '4月' },
  { field: 'may', headerName: '5月' },
  { field: 'jun', headerName: '6月' },
  { field: 'jul', headerName: '7月' },
  { field: 'aug', headerName: '8月' },
  { field: 'sep', headerName: '9月' },
  { field: 'oct', headerName: '10月' },
  { field: 'nov', headerName: '11月' },
  { field: 'dec', headerName: '12月' },
];
const MONTH_FIELDS = MONTH_COLUMNS.map((column) => column.field);

// 実績で塗り替えられた月（実績反映月）。当該月の函数は実績値のため変更不可とする。
// モックでは1〜5月を実績反映済みとして扱う。
const ACTUAL_REFLECTED_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may'];

// 対象年の選択肢：過去2年・当年・翌年の4年分（当年はシステム日付の年）。
// システムは過去3年分のデータを保持し、計画の箱は翌年まで作成されるため（決定事項13）。
const CURRENT_YEAR = new Date().getFullYear();
const TARGET_YEAR_OPTIONS = [-2, -1, 0, 1].map((offset) =>
  String(CURRENT_YEAR + offset)
);

// 年間計画表の先頭に固定する合計行の名称（10/20手売りセッション 決定事項19で「（売上高）」を削除）
const GRAND_TOTAL_LABEL = '全商品合計';

// 前年実績の行（FTRトランから取得し、商品区分〜マージン率を持たない）
const PREV_YEAR_TYPE = '前年実績';
// 前年実績の行の商品区分〜マージン率に表示する値（10/20手売りセッション 決定事項26）
const PREV_YEAR_DASH = '-';
const isPrevYearRow = (row: { yearType?: string } | undefined): boolean =>
  row?.yearType === PREV_YEAR_TYPE;
// 商品区分〜マージン率の valueFormatter：前年実績の行は「-」、それ以外は format の結果を表示する
// （全商品合計の前年実績の行は値を持たないため、「-」も出さず format に任せる）
const withPrevYearDash =
  (format: (params: any) => string = (params) => params.value ?? '') =>
  (params: any): string =>
    isPrevYearRow(params.data) && params.data?.metaBrand !== GRAND_TOTAL_LABEL
      ? PREV_YEAR_DASH
      : format(params);

// ギフトは計画／実績の行を上旬・中旬・下旬の3行1セット（販売期間＝salePeriod）で表示する。
// 前年実績の行は3行に分けず1行にまとめる（10/20手売りセッション 決定事項17）。
interface GiftRowLike {
  salePeriod?: string;
  yearType?: string;
}

// ギフトの上旬・下旬で、実績反映月のセルか（空欄表示・入力不可）。
// 実績反映月は月の実績を中旬の行に表示し、上旬・下旬の行は空欄とする（「-」は表示しない。決定事項18）。
const isGiftEmptyCell = (
  row: GiftRowLike | undefined,
  field: string
): boolean =>
  !!row?.salePeriod &&
  row.salePeriod !== '中旬' &&
  !isPrevYearRow(row) &&
  ACTUAL_REFLECTED_MONTHS.includes(field);

// ギフトの3行1セットでセル結合する列（函数・合計・販売期間以外）。
// 結合した背の高いセルを縦中央寄せにするクラスの付与判定に使う。
const GIFT_MERGED_FIELDS = [
  'yearType',
  'productCategory',
  'promotion',
  'deliveryPrice',
  'sellingPrice',
  'discountRate',
  'net',
  'marginRate',
];

// 計算式（派生）セル → 計算式テンプレートと算出元フィールド。
// 計算式セルにホバーすると計算式ツールチップ（式＋実値の2行）を表示し、
// 同時に当該行内の算出元セルの枠線を強調する（明細表・集計表と共通の仕組み）。
const ANNUAL_COLUMN_LABELS: Record<string, string> = {
  deliveryPrice: '納価',
  sellingPrice: '売価',
  marginRate: 'マージン率',
};

// 函数（1月〜12月）・合計の表示整形。整数表示を基本としつつ、小数を入力された場合でも
// 小数点以下3桁以上を出さないよう小数点以下2桁で四捨五入する（桁区切りは付けない）。
const formatCaseCount = (value: unknown): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return value == null ? GRID_EMPTY_TEXT : String(value);
  }
  return value.toLocaleString('ja-JP', {
    maximumFractionDigits: 2,
    useGrouping: false,
  });
};

// トークン → 実値（年間計画の行データはそのまま値を保持している）。
// 数値は小数点以下3桁を四捨五入し、小数点以下2桁で表示する
// （マージン率は '11.11%' のような整形済み文字列のためそのまま扱う）。
const annualValueOf = (row: any, token: string): string | null => {
  const raw = row?.[token];
  if (raw == null || raw === '') return null;
  return typeof raw === 'number' ? raw.toFixed(2) : String(raw);
};

const annualTooltip = makeDetailTooltip<any>(
  ANNUAL_COLUMN_LABELS,
  annualValueOf
);

const ANNUAL_FORMULA_DEFS: FormulaDefs<any> = {
  // 値入率 ＝ (売価 − 納価) ÷ 売価 × 100%（前年実績の行は「-」のため計算式セルにしない）
  discountRate: {
    isFormula: (row) => !isPrevYearRow(row),
    refs: () => ['sellingPrice', 'deliveryPrice'],
    tooltip: annualTooltip(
      {
        template: '({sellingPrice} − {deliveryPrice}) ÷ {sellingPrice} × 100%',
      },
      (row) =>
        row?.discountRate != null ? `${row.discountRate.toFixed(2)}%` : ''
    ),
  },
  // NET ＝ 納価 − 納価 × マージン率（前年実績の行は「-」のため計算式セルにしない）
  net: {
    isFormula: (row) => !isPrevYearRow(row),
    refs: () => ['deliveryPrice', 'marginRate'],
    tooltip: annualTooltip(
      { template: '{deliveryPrice} − {deliveryPrice} × {marginRate}' },
      (row) => (row?.net != null ? row.net.toFixed(2) : '')
    ),
  },
  // 合計 ＝ 1月〜12月の函数の合計
  total: {
    refs: () => MONTH_FIELDS,
    tooltip: annualTooltip(
      {
        template: '1月 ＋ 2月 ＋ … ＋ 12月（函数の年間合計）',
        valueLine: false,
      },
      (row) => formatCaseCount(row?.total)
    ),
  },
};

// 条件選択（右ペイン）のメタブランド・容器容量G の選択肢。
const ANNUAL_META_BRAND_OPTIONS = [
  { label: '三ツ矢', value: '三ツ矢', code: 'MB001' },
  { label: 'ワンダ', value: 'ワンダ', code: 'MB006' },
  { label: 'ウィルキンソン', value: 'ウィルキンソン', code: 'MB003' },
  { label: '十六茶', value: '十六茶', code: 'MB004' },
  { label: '水', value: '水', code: 'MB007' },
  { label: 'カルピスコンク', value: 'カルピスコンク', code: 'MB002' },
  { label: 'カルピスストレート', value: 'カルピスストレート', code: 'MB009' },
  { label: 'モンスター', value: 'モンスター', code: 'MB005' },
  { label: 'ヘルスケア', value: 'ヘルスケア', code: 'MB010' },
  { label: 'PB', value: 'PB', code: 'MB011' },
  { label: 'その他', value: 'その他', code: 'MB099' },
  { label: '和紅茶', value: '和紅茶', code: 'MB012' },
];
const ANNUAL_CONTAINER_OPTIONS = [
  { label: 'PET・ボトル缶500', value: 'PET・ボトル缶500', code: 'CG001' },
  {
    label: 'PET・ボトル缶280・350',
    value: 'PET・ボトル缶280・350',
    code: 'CG002',
  },
  { label: '水PET500', value: '水PET500', code: 'CG003' },
  { label: 'PET1.5', value: 'PET1.5', code: 'CG004' },
  { label: 'PET2L', value: 'PET2L', code: 'CG005' },
  { label: '水PET2L', value: '水PET2L', code: 'CG006' },
  { label: 'コーヒー缶', value: 'コーヒー缶', code: 'CG007' },
  { label: '250缶', value: '250缶', code: 'CG008' },
  { label: 'その他', value: 'その他', code: 'CG099' },
  { label: '250缶（20）', value: '250缶（20）', code: 'CG009' },
  { label: 'Lパック', value: 'Lパック', code: 'CG010' },
  { label: 'ギフト', value: 'ギフト', code: 'CG011' },
];

// 行選択の設定（単一行・クリック選択・チェックボックスなし）。
// 毎レンダーで新しいオブジェクトを渡さないよう定数にする（→ 02 §7.1）。
const ANNUAL_ROW_SELECTION = {
  mode: 'singleRow',
  enableClickSelection: true,
  checkboxes: false,
} as const;

// 選択値（value）から表示名（label）を引く。選択中の条件を具体値で表示するのに使う。
const labelOfOption = (
  options: { label: string; value: string }[],
  value: string
): string => options.find((option) => option.value === value)?.label ?? value;

// 同一値のセルを縦結合するための行スパン計算
// keyFn でグループ判定し、グループ先頭行では連続行数、それ以外は1を返す
// 表示順（ソート・フィルタ後）を基準にするため api.getDisplayedRowAtIndex を使用
// state を参照しない純粋な関数のため、列定義の参照を固定できるようモジュールスコープに置く（→ 02 §7.1）
const getMergeRowSpan = (params: any, keyFn: (row: any) => string): number => {
  const api = params.api;
  const node = params.node;
  if (!api || !node || !node.data) return 1;
  const currentKey = keyFn(node.data);

  // ピン留め上部行（合計行）の結合
  if (node.rowPinned === 'top') {
    const count = api.getPinnedTopRowCount();
    // 自身のピン留め行内での位置を特定
    let idx = -1;
    for (let i = 0; i < count; i++) {
      if (api.getPinnedTopRow(i) === node) {
        idx = i;
        break;
      }
    }
    if (idx < 0) return 1;
    const prev = idx > 0 ? api.getPinnedTopRow(idx - 1) : null;
    if (prev && prev.data && keyFn(prev.data) === currentKey) {
      return 1;
    }
    let span = 1;
    while (idx + span < count) {
      const next = api.getPinnedTopRow(idx + span);
      if (next && next.data && keyFn(next.data) === currentKey) {
        span++;
      } else {
        break;
      }
    }
    return span;
  }

  // 通常行（ボディ）の結合
  const index = node.rowIndex;
  if (index == null || index < 0) return 1;
  // 直前行が同一グループなら結合済み（先頭ではない）のためスパンしない
  const prev = api.getDisplayedRowAtIndex(index - 1);
  if (prev && !prev.rowPinned && prev.data && keyFn(prev.data) === currentKey) {
    return 1;
  }
  // 連続する同一グループの行数をカウント（+行で追加された行も自動的に含まれる）
  let span = 1;
  while (true) {
    const next = api.getDisplayedRowAtIndex(index + span);
    if (
      next &&
      !next.rowPinned &&
      next.data &&
      keyFn(next.data) === currentKey
    ) {
      span++;
    } else {
      break;
    }
  }
  return span;
};

// 結合キー：計画／実績から前年実績までの行（商品ごとの1セット）。
// メタブランド・容器容量G・サマリ商品・一般卸メッシュは、このセットの単位でだけ結合し、
// それ以上の単位（同じメタブランドの別商品など）では結合しない（10/20手売りセッション 決定事項24）。
const productSetMergeKey = (row: any) =>
  `${row?.metaBrand ?? ''}__${row?.containerCapacity ?? ''}__${
    row?.summaryProduct ?? ''
  }__${row?.wholesaleMesh ?? ''}`;
const productSetRowSpan = (params: any) =>
  getMergeRowSpan(params, productSetMergeKey);
// ギフトの3行1セット（giftSetId）単位の結合キー。ギフト以外は行ごとに一意（結合しない）。
const giftSetMergeKey = (row: any) =>
  row?.giftSetId ?? `row__${row?.id ?? row?.yearType ?? ''}`;
const giftSetRowSpan = (params: any) =>
  getMergeRowSpan(params, giftSetMergeKey);

interface AnnualPlanCreationProps {
  // 遷移元の計画詳細から引き継ぐ取引制度。基本情報の表示内容（取引制度・販売店・
  // 三次店企業）がこの値で切り替わるため、遷移元と一致させる必要がある。
  // メニューから直接開いた場合は既定のマージン率固定とする。
  tradingSystem?: string;
}

export default function AnnualPlanCreation({
  tradingSystem = 'マージン率固定',
}: AnnualPlanCreationProps) {
  // 画面の切り替え（→ ui/use-app-navigation）
  const navigate = useAppNavigation();
  // 対象年（条件）。対象計画（計画／実績・前年実績）の表示対象を決める。
  const [selectedYear, setSelectedYear] = useState<string>('2024');
  // 確定済みの条件（プルダウンを閉じて反映された値）。グリッドの絞り込みに使う。
  const [selectedMetaBrands, setSelectedMetaBrands] = useState<string[]>([]);
  const [selectedContainerCapacities, setSelectedContainerCapacities] =
    useState<string[]>([]);
  // 入力中の条件（プルダウンを開いている間の下書き）。
  // 1件選択するたびには反映せず、プルダウンを閉じた時点でまとめて確定する。
  const [draftMetaBrands, setDraftMetaBrands] = useState<string[]>([]);
  const [draftContainerCapacities, setDraftContainerCapacities] = useState<
    string[]
  >([]);
  // 条件選択の右ペイン開閉（販売計画(集計)の集計対象選択と同様のスライドイン）
  const [isConditionPaneShown, setIsConditionPaneShown] = useState(false);

  // 条件（メタブランド／容器容量G）が選択されているか。
  // 未選択のときは計画表を空表示にする（初期表示は全件ではなく空白）。
  const isConditionSelected =
    selectedMetaBrands.length > 0 || selectedContainerCapacities.length > 0;

  // 未保存の編集があるか（保存ボタンの活性制御・遷移時のアラート用）
  const [, setIsDirty] = useState(false);

  // 編集セルの変更ハイライト（黄）。変更の追跡・判定は共通フックに任せ、
  // 色付けは共通の cellClassRules（ag-cell-changed）が context.isCellChanged を見て行う（→ 02 §7.2）。
  // 保存確定時と、条件変更で入力値を初期化したときに resetChangedCells でクリアする。
  const { isCellChanged, trackCellChange, resetChangedCells } =
    useChangedCells();
  const gridContext = useMemo(() => ({ isCellChanged }), [isCellChanged]);
  // グリッド API（変更ハイライトをクリアした後の再描画に使う）
  const gridApiRef = useRef<GridApi | null>(null);
  // 変更ハイライトをすべてクリアし、表示中のセルの強調を外す
  const clearChangedCells = () => {
    resetChangedCells();
    gridApiRef.current?.refreshCells({ force: true });
  };

  // 選択内容が同一か（順序は問わない）
  const isSameSelection = (a: string[], b: string[]): boolean =>
    a.length === b.length && a.every((v) => b.includes(v));

  // ペインを開いたときに下書きを確定値で初期化する。
  // 確定せずに閉じた場合は編集内容を破棄し、次に開くと確定値から編集し直す。
  useEffect(() => {
    if (!isConditionPaneShown) return;
    setDraftMetaBrands(selectedMetaBrands);
    setDraftContainerCapacities(selectedContainerCapacities);
    // 開いた時点の確定値のみを取り込むため、確定値は依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConditionPaneShown]);

  // 下書きを確定値へ反映してペインを閉じる。条件が更新されるのはこのタイミングのみ。
  // 条件が変わると明細の入力値は初期化される（変更が無い場合は閉じるだけ）。
  const handleSubmitCondition = () => {
    const unchanged =
      isSameSelection(draftMetaBrands, selectedMetaBrands) &&
      isSameSelection(draftContainerCapacities, selectedContainerCapacities);
    setIsConditionPaneShown(false);
    if (unchanged) return;
    setSelectedMetaBrands(draftMetaBrands);
    setSelectedContainerCapacities(draftContainerCapacities);
    // 入力値（明細）を初期化。初期化した入力値の変更ハイライトも消す
    setRowData(generateRowData());
    clearChangedCells();
    setIsDirty(false);
    toast.info('条件を変更し、入力値をリセットしました。');
  };

  // 対象年の変更（選択値は対象計画（計画／実績・前年実績）の表示に使用する）
  const handleYearChange = (year: string) => {
    setSelectedYear(year);
  };

  // ダミーデータ生成

  const [rowData, setRowData] = useState(generateRowData());

  // 合計行の計算
  const calculateTotals = (rows: any[]) => {
    const totals: any = {
      metaBrand: GRAND_TOTAL_LABEL,
      containerCapacity: '',
      summaryProduct: '',
      wholesaleMesh: '',
      yearType: '計画／実績',
      prevYearRatio: '',
      productCategory: '',
      net: null,
      deliveryPrice: null,
      sellingPrice: null,
      discountRate: null,
      marginRate: '',
      jan: 0,
      feb: 0,
      mar: 0,
      apr: 0,
      may: 0,
      jun: 0,
      jul: 0,
      aug: 0,
      sep: 0,
      oct: 0,
      nov: 0,
      dec: 0,
      total: 0,
    };

    const prevYearTotals = { ...totals, yearType: '前年実績' };

    rows.forEach((row) => {
      if (row.yearType === '計画／実績') {
        totals.jan += row.jan || 0;
        totals.feb += row.feb || 0;
        totals.mar += row.mar || 0;
        totals.apr += row.apr || 0;
        totals.may += row.may || 0;
        totals.jun += row.jun || 0;
        totals.jul += row.jul || 0;
        totals.aug += row.aug || 0;
        totals.sep += row.sep || 0;
        totals.oct += row.oct || 0;
        totals.nov += row.nov || 0;
        totals.dec += row.dec || 0;
        totals.total += row.total || 0;
      } else if (row.yearType === '前年実績') {
        prevYearTotals.jan += row.jan || 0;
        prevYearTotals.feb += row.feb || 0;
        prevYearTotals.mar += row.mar || 0;
        prevYearTotals.apr += row.apr || 0;
        prevYearTotals.may += row.may || 0;
        prevYearTotals.jun += row.jun || 0;
        prevYearTotals.jul += row.jul || 0;
        prevYearTotals.aug += row.aug || 0;
        prevYearTotals.sep += row.sep || 0;
        prevYearTotals.oct += row.oct || 0;
        prevYearTotals.nov += row.nov || 0;
        prevYearTotals.dec += row.dec || 0;
        prevYearTotals.total += row.total || 0;
      }
    });

    return [totals, prevYearTotals];
  };

  // 列定義。state を参照しない（結合判定・書式・背景はすべて行データから決まる）ため、
  // 初回だけ作って参照を固定する。毎レンダーで作り直すと列が再読込され、
  // Undo/Redo の履歴が消える（→ 02 §7.1）。
  const columnDefs = useMemo<(ColDef | ColGroupDef)[]>(
    () => [
      {
        headerName: 'メタブランド',
        field: 'metaBrand',
        width: 96,
        // 先頭列は grid.css で中央寄せが強制されるため、左寄せクラスで上書きする
        cellClass: 'ag-cell-left-pinned',
        colSpan: (params) => {
          if (params.data?.metaBrand === GRAND_TOTAL_LABEL) {
            return 4;
          }
          return 1;
        },
        rowSpan: productSetRowSpan,
        cellStyle: asCellStyle((params) => {
          if (params.data?.metaBrand === GRAND_TOTAL_LABEL) {
            return {
              backgroundColor: GRID_COLORS.total,
              fontWeight: 'bold',
            };
          }
          return {
            backgroundColor: GRID_COLORS.readonly,
          };
        }),
        cellRenderer: (params: ICellRendererParams) => {
          if (params.data?.metaBrand === GRAND_TOTAL_LABEL) {
            return GRAND_TOTAL_LABEL;
          }
          if (params.data?.metaBrand === GRAND_TOTAL_LABEL) {
            return '';
          }
          return params.value || '';
        },
      },
      {
        headerName: '容器容量G',
        field: 'containerCapacity',
        width: 88,
        rowSpan: productSetRowSpan,
        // 結合セル（rowSpan）内のテキストを行の高さ中央に配置（メタブランド列と統一）
        cellClass: (params) =>
          params.data?.metaBrand === GRAND_TOTAL_LABEL
            ? 'cell-center'
            : 'cell-left-vmiddle',
        cellStyle: (params) => {
          if (params.data?.metaBrand === GRAND_TOTAL_LABEL) {
            return {
              backgroundColor: GRID_COLORS.total,
            };
          }
          return {
            backgroundColor: GRID_COLORS.readonly,
          };
        },
        cellRenderer: (params: ICellRendererParams) => {
          if (params.data?.metaBrand === GRAND_TOTAL_LABEL) {
            return '';
          }
          return params.value || '';
        },
      },
      {
        headerName: 'サマリ商品',
        field: 'summaryProduct',
        width: 160,
        rowSpan: productSetRowSpan,
        // 結合セル（rowSpan）内のテキストを行の高さ中央に配置（メタブランド列と統一）
        cellClass: (params) =>
          params.data?.metaBrand === GRAND_TOTAL_LABEL
            ? 'cell-center'
            : 'cell-left-vmiddle',
        cellStyle: asCellStyle((params) => {
          if (params.data?.metaBrand === GRAND_TOTAL_LABEL) {
            return {
              backgroundColor: GRID_COLORS.total,
              fontWeight: 'bold',
            };
          }
          return {
            backgroundColor: GRID_COLORS.readonly,
          };
        }),
        cellRenderer: (params: ICellRendererParams) => {
          if (params.data?.metaBrand === GRAND_TOTAL_LABEL) {
            return '';
          }
          return params.value || '';
        },
      },
      {
        headerName: '一般卸メッシュ',
        field: 'wholesaleMesh',
        width: 104,
        // 計画／実績から前年実績までの1セットで結合する（ギフトの3行もこのセットに含まれる）
        rowSpan: productSetRowSpan,
        // 結合セル（rowSpan）内のテキストを行の高さ中央に配置（メタブランド列と統一）
        cellClass: (params) =>
          params.data?.metaBrand === GRAND_TOTAL_LABEL
            ? 'cell-center'
            : 'cell-left-vmiddle',
        cellStyle: (params) => {
          if (params.data?.metaBrand === GRAND_TOTAL_LABEL) {
            return {
              backgroundColor: GRID_COLORS.total,
            };
          }
          return { backgroundColor: GRID_COLORS.readonly };
        },
        cellRenderer: (params: ICellRendererParams) => {
          if (params.data?.summaryProduct === GRAND_TOTAL_LABEL) {
            return '';
          }
          return params.value || '';
        },
      },
      {
        headerName: '当年／前年',
        field: 'yearType',
        width: 88,
        rowSpan: giftSetRowSpan,
        cellStyle: (params) => {
          // 合計行は集計色（薄青）
          if (params.data.metaBrand === GRAND_TOTAL_LABEL) {
            return {
              backgroundColor: GRID_COLORS.total,
              fontWeight: 'bold',
            };
          }
          // 計画／実績（計画値）＝白、前年実績（実績値）＝灰で区別
          if (params.value === '計画／実績') {
            return {
              backgroundColor: GRID_COLORS.planValue,
              fontWeight: 'bold',
            };
          }
          return {
            backgroundColor: GRID_COLORS.actualValue,
            fontWeight: 'bold',
          };
        },
      },
      {
        headerName: '商品区分',
        field: 'productCategory',
        width: 80,
        rowSpan: giftSetRowSpan,
        cellStyle: asCellStyle((params) => {
          const isTotalRow = params.data.metaBrand === GRAND_TOTAL_LABEL;
          if (isTotalRow) {
            return {
              backgroundColor: GRID_COLORS.readonly,
              color: GRID_COLORS.mutedText,
            };
          }
          // 前年実績（実績値）は灰背景（編集不可）
          if (params.data.yearType === '前年実績') {
            return { backgroundColor: GRID_COLORS.actualValue };
          }
          // 計画／実績も編集不可のため非活性（灰）背景
          if (params.data.yearType === '計画／実績') {
            return { backgroundColor: GRID_COLORS.readonly };
          }
          return {};
        }),
        editable: false,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: toComboOptions(CATEGORY_LABELS_ANNUAL),
        },
        valueFormatter: withPrevYearDash(),
      },
      {
        headerName: '販促区分',
        field: 'promotion',
        width: 144,
        rowSpan: giftSetRowSpan,
        cellStyle: asCellStyle((params) => {
          const isTotalRow = params.data.metaBrand === GRAND_TOTAL_LABEL;
          if (isTotalRow) {
            return {
              backgroundColor: GRID_COLORS.readonly,
              color: GRID_COLORS.mutedText,
            };
          }
          // 前年実績（実績値）は灰背景（編集不可）
          if (params.data.yearType === '前年実績') {
            return { backgroundColor: GRID_COLORS.actualValue };
          }
          // 計画／実績も編集不可のため非活性（灰）背景
          if (params.data.yearType === '計画／実績') {
            return { backgroundColor: GRID_COLORS.readonly };
          }
          return {};
        }),
        editable: false,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        // 商品区分に対応する販促区分のみを選択肢として表示
        cellEditorParams: (params: any) => ({
          // 名称（上）・コード（下）の2行で、両方の行で絞り込める共通の選択肢（→ 02 §9）
          comboOptions: promotionComboOptions(
            getPromotionLabels(params.data?.productCategory ?? '')
          ),
        }),
        // 特殊商品は販促区分リストが無いため '-' を表示
        valueFormatter: withPrevYearDash((params: any) =>
          params.data?.productCategory === '特殊商品'
            ? PROMOTION_NONE_LABEL
            : (params.value ?? '')
        ),
      },
      {
        // 販売期間：ギフトは上旬・中旬・下旬の3行1セットで表示する（計画詳細と同じ。
        // 第14回手売りセッション 決定事項8）。自動表示・編集不可で、ギフト以外は空欄。
        // セル結合の対象外（行ごとに表示）。
        headerName: '販売期間',
        field: 'salePeriod',
        width: 72,
        editable: false,
        cellStyle: (params) => {
          // 合計行は他の列と同じ非活性（灰）背景
          if (params.data?.metaBrand === GRAND_TOTAL_LABEL) {
            return { backgroundColor: GRID_COLORS.readonly };
          }
          // 前年実績（実績値）は灰背景、それ以外も編集不可のため非活性（灰）背景
          if (params.data?.yearType === '前年実績') {
            return { backgroundColor: GRID_COLORS.actualValue };
          }
          return { backgroundColor: GRID_COLORS.readonly };
        },
      },
      {
        headerName: '納価',
        field: 'deliveryPrice',
        width: 56,
        rowSpan: giftSetRowSpan,
        type: 'numericColumn',
        valueFormatter: withPrevYearDash((params) =>
          params.value == null ? '' : String(params.value)
        ),
        cellStyle: asCellStyle((params) => {
          const isTotalRow = params.data.metaBrand === GRAND_TOTAL_LABEL;
          if (isTotalRow) {
            return {
              backgroundColor: GRID_COLORS.readonly,
              color: GRID_COLORS.mutedText,
            };
          }
          // 前年実績（実績値）は灰背景（編集不可）
          if (params.data.yearType === '前年実績') {
            return { backgroundColor: GRID_COLORS.actualValue };
          }
          // 計画／実績も編集不可のため非活性（灰）背景
          if (params.data.yearType === '計画／実績') {
            return { backgroundColor: GRID_COLORS.readonly };
          }
          return {};
        }),
        editable: false,
      },
      {
        headerName: '売価',
        field: 'sellingPrice',
        width: 56,
        rowSpan: giftSetRowSpan,
        type: 'numericColumn',
        valueFormatter: withPrevYearDash((params) =>
          params.value == null ? '' : String(params.value)
        ),
        cellStyle: asCellStyle((params) => {
          const isTotalRow = params.data.metaBrand === GRAND_TOTAL_LABEL;
          if (isTotalRow) {
            return {
              backgroundColor: GRID_COLORS.readonly,
              color: GRID_COLORS.mutedText,
            };
          }
          // 前年実績（実績値）は他の灰セルと同じ灰背景
          if (params.data.yearType === '前年実績') {
            return { backgroundColor: GRID_COLORS.actualValue };
          }
          // 計画／実績も編集不可のため非活性（灰）背景
          if (params.data.yearType === '計画／実績') {
            return { backgroundColor: GRID_COLORS.readonly };
          }
          return {};
        }),
        editable: false,
      },
      {
        headerName: '値入率',
        field: 'discountRate',
        width: 64,
        rowSpan: giftSetRowSpan,
        type: 'numericColumn',
        valueFormatter: withPrevYearDash((params) =>
          params.value !== null && params.value !== undefined
            ? `${params.value.toFixed(2)}%`
            : ''
        ),
        cellStyle: asCellStyle((params) => {
          const isTotalRow = params.data.metaBrand === GRAND_TOTAL_LABEL;
          if (isTotalRow) {
            return {
              backgroundColor: GRID_COLORS.readonly,
              color: GRID_COLORS.mutedText,
            };
          }
          // 前年実績（実績値）は他の灰セルと同じ灰背景
          if (params.data.yearType === '前年実績') {
            return { backgroundColor: GRID_COLORS.actualValue };
          }
          // 値入率は編集不可のため非活性（灰）背景。背景未指定だとレンジ選択の
          // 青ハイライトが値入率列だけに透けて見えるため、背景を明示する
          if (params.data.yearType === '計画／実績') {
            return { backgroundColor: GRID_COLORS.readonly };
          }
          return {};
        }),
        editable: false,
      },
      {
        headerName: 'NET',
        field: 'net',
        width: 64,
        rowSpan: giftSetRowSpan,
        type: 'numericColumn',
        valueFormatter: withPrevYearDash((params) =>
          params.value !== null && params.value !== undefined
            ? params.value.toFixed(2)
            : ''
        ),
        cellStyle: asCellStyle((params) => {
          const isTotalRow = params.data.metaBrand === GRAND_TOTAL_LABEL;
          if (isTotalRow) {
            return {
              backgroundColor: GRID_COLORS.readonly,
              color: GRID_COLORS.mutedText,
            };
          }
          // 前年実績（実績値）は他の灰セルと同じ灰背景
          if (params.data.yearType === '前年実績') {
            return { backgroundColor: GRID_COLORS.actualValue };
          }
          // NETは計画／実績であっても編集不可のため非活性（灰）背景
          if (params.data.yearType === '計画／実績') {
            return { backgroundColor: GRID_COLORS.readonly };
          }
          return {};
        }),
        editable: false,
      },
      {
        headerName: 'マージン率',
        field: 'marginRate',
        width: 80,
        rowSpan: giftSetRowSpan,
        valueFormatter: withPrevYearDash(),
        cellStyle: asCellStyle((params) => {
          const isTotalRow = params.data.metaBrand === GRAND_TOTAL_LABEL;
          if (isTotalRow) {
            return {
              backgroundColor: GRID_COLORS.readonly,
              color: GRID_COLORS.mutedText,
            };
          }
          // 前年実績（実績値）は灰背景（編集不可）
          if (params.data.yearType === '前年実績') {
            return { backgroundColor: GRID_COLORS.actualValue };
          }
          // 計画／実績も編集不可のため非活性（灰）背景
          if (params.data.yearType === '計画／実績') {
            return { backgroundColor: GRID_COLORS.readonly };
          }
          return {};
        }),
        editable: false,
      },
      {
        headerName: '函数',
        marryChildren: true,
        // 1〜12月の列は構成が同一のため MONTH_COLUMNS から生成する。
        // 実績反映月（実績で塗り替え済みの月）は変更不可のため非活性（灰・編集不可）とし、
        // 実績反映セルであることが分かるよう左上の三角（existingFuncCellStyle）で示す。
        children: MONTH_COLUMNS.map(({ field, headerName }) => {
          const isActualReflected = ACTUAL_REFLECTED_MONTHS.includes(field);
          return {
            headerName,
            field,
            width: 64,
            type: 'numericColumn',
            // ギフトの上旬・下旬の実績反映月は空欄（月の実績は中旬の行に表示する）
            valueFormatter: (params: any) =>
              isGiftEmptyCell(params.data, field)
                ? ''
                : formatCaseCount(params.value),
            cellStyle: (params: any) => {
              const isTotalRow = params.data.metaBrand === GRAND_TOTAL_LABEL;
              if (isTotalRow) {
                return {
                  backgroundColor: GRID_COLORS.total,
                  fontWeight: 'bold',
                };
              }
              // ギフトの上旬・下旬の実績反映月は入力不可（灰・空欄）
              if (isGiftEmptyCell(params.data, field)) {
                return { backgroundColor: GRID_COLORS.readonly };
              }
              if (params.data.yearType === '計画／実績') {
                // 実績反映月は変更不可（灰背景・枠線）。それ以外は白背景（編集可）
                return isActualReflected
                  ? existingFuncCellStyle({
                      backgroundColor: GRID_COLORS.readonly,
                    })
                  : { backgroundColor: GRID_COLORS.planValue };
              }
              // 前年実績（実績値）は灰背景（編集不可）
              if (params.data.yearType === '前年実績') {
                return { backgroundColor: GRID_COLORS.actualValue };
              }
              return { backgroundColor: GRID_COLORS.readonly };
            },
            editable: (params: any) => {
              // 実績反映月は実績で塗り替えられるため編集不可
              // （ギフトの上旬・下旬の空欄セルも実績反映月のため、ここで入力不可になる）
              if (isActualReflected) return false;
              const isTotalRow = params.data.metaBrand === GRAND_TOTAL_LABEL;
              const isPlan = params.data.yearType === '計画／実績';
              return !isTotalRow && isPlan;
            },
          } as ColDef;
        }),
      },
      {
        headerName: '合計',
        field: 'total',
        width: 80,
        type: 'numericColumn',
        valueFormatter: (params) => formatCaseCount(params.value),
        cellStyle: (params) => {
          const isTotalRow = params.data.metaBrand === GRAND_TOTAL_LABEL;
          if (isTotalRow) {
            return {
              backgroundColor: GRID_COLORS.readonly,
              fontWeight: 'bold',
            };
          }
          return {
            backgroundColor: GRID_COLORS.readonly,
            fontWeight: 'bold',
          };
        },
      },
    ],
    []
  );
  // ヘッダーツールチップを付けた列定義（参照を固定して AgGridReact に渡す）
  const gridColumnDefs = useMemo(
    () => withHeaderTooltips(columnDefs),
    [columnDefs]
  );

  // 行ID。参照を固定する（→ 02 §7.1）。
  const getRowId = useCallback((params: any) => {
    if (params.data?.id) {
      return params.data.id;
    }
    if (params.data?.metaBrand === GRAND_TOTAL_LABEL) {
      return `total-${params.data.yearType}`;
    }
    return `${params.data?.wholesaleMesh}-${params.data?.yearType}`;
  }, []);

  // 条件（メタブランド）でグリッド表示行を即時フィルタ（リアルタイム反映）。
  // 条件未選択（初期表示）は全件ではなく空表示とする。
  const displayedRowData = useMemo(() => {
    if (!isConditionSelected) return [];
    if (selectedMetaBrands.length === 0) return rowData;
    return rowData.filter((row) => selectedMetaBrands.includes(row.metaBrand));
  }, [rowData, selectedMetaBrands, isConditionSelected]);

  // 列フィルタを通過した行のID（フィルタ無しは null）。合計行を表示中の行だけで計算し直すために使う
  // （画面設計標準 4.4 ③）。公式の onFilterChanged／forEachNodeAfterFilter で取得する。
  const [filteredRowIds, setFilteredRowIds] = useState<Set<string> | null>(
    null
  );
  const handleFilterChanged = (e: FilterChangedEvent) => {
    if (!e.api.isAnyFilterPresent()) {
      setFilteredRowIds(null);
      return;
    }
    const ids = new Set<string>();
    e.api.forEachNodeAfterFilter((node) => {
      if (node.id) ids.add(node.id);
    });
    setFilteredRowIds(ids);
  };

  // 合計行の再計算トークン。函数セルの編集で増やし、合計行だけを再計算させる。
  // 編集値は AG Grid が行データ（node.data）へ直接反映するため、rowData の参照は
  // 差し替えない（差し替えると Undo/Redo の履歴が消える。→ 02 §7.1）。
  const [totalsToken, setTotalsToken] = useState(0);

  // 合計行（ピン留め上部行）。条件未選択時は計画表ごと空表示にする。
  // 列フィルタ中は、フィルタを通過した行だけで合計する。
  const totals = useMemo(() => {
    if (!isConditionSelected) return [];
    const rows = filteredRowIds
      ? displayedRowData.filter((row) =>
          filteredRowIds.has(getRowId({ data: row }))
        )
      : displayedRowData;
    try {
      return calculateTotals(rows);
    } catch (error) {
      console.error('Error calculating totals:', error);
      return [];
    }
    // totalsToken は値を使わず、函数編集時の再計算のきっかけとしてのみ依存に置く
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    displayedRowData,
    isConditionSelected,
    filteredRowIds,
    totalsToken,
    getRowId,
  ]);

  // 計算式セルのホバーで算出元セルの枠線を強調し、計算式ツールチップを表示するフック
  const formulaHL = useFormulaSourceHighlight<any>(ANNUAL_FORMULA_DEFS, {
    isEligibleRow: (row) => row?.metaBrand !== GRAND_TOTAL_LABEL,
  });

  // セル編集で未保存状態にし、編集済みセルを記録して黄色＋オレンジ枠で強調
  const handleCellValueChanged = (params: any) => {
    setIsDirty(true);
    // 元値と異なれば強調に追加、元値へ戻したら解除する
    trackCellChange(params);

    // 函数（月次）セルの編集時は、当該行の年間合計を再計算し、
    // 合計行の再計算トークンを進めて「全商品合計（計画／実績）」を動的に再集計する。
    const field = params.column?.getColId?.() ?? params.colDef?.field;
    const isMonthEdit = MONTH_FIELDS.includes(field);
    if (isMonthEdit) {
      const num = parseFloat(String(params.newValue ?? '').replace(/,/g, ''));
      params.data[field] = Number.isFinite(num) ? num : 0;
      // 年間合計（total）＝12か月の合計を再計算
      params.data.total = MONTH_FIELDS.reduce(
        (sum, f) => sum + (Number(params.data[f]) || 0),
        0
      );
      // 合計行（totals）を再計算させる。rowData の参照は変えない（Undo 履歴を保つ）
      setTotalsToken((token) => token + 1);
    }

    // 編集行を再描画（年間合計列・変更強調を反映）。月次編集時は行全体を更新。
    params.api.refreshCells({
      rowNodes: [params.node],
      columns: isMonthEdit ? undefined : [params.column.getColId()],
      force: true,
    });
  };

  // 既定の列設定。共通の cellClassRules（変更ハイライト ag-cell-changed・空値 cell-empty）に
  // 画面独自のルール（ギフト結合セルの縦中央寄せ・計算式の算出元強調）をマージする（→ 02 §7.2 例外）。
  // 参照を固定して渡す（→ 02 §7.1）。
  const gridDefaultColDef = useMemo<ColDef>(
    () => ({
      ...GRID_DEFAULT_COL_DEF,
      cellClassRules: {
        ...GRID_DEFAULT_COL_DEF.cellClassRules,
        // ギフトの3行1セットで結合する列は縦中央寄せにする
        'gift-merged': (params) =>
          !!params.data?.giftSetId &&
          GIFT_MERGED_FIELDS.includes(params.colDef?.field ?? ''),
        ...formulaHL.cellClassRules,
      },
      // 計算式セルは計算式（式＋実値）を、それ以外はセル値をツールチップ表示
      tooltipValueGetter: formulaHL.tooltipValueGetter,
    }),
    [formulaHL]
  );

  // 戻る・保存の確認ダイアログ表示状態
  const [isBackConfirmShown, setIsBackConfirmShown] = useState(false);
  const [isSaveConfirmShown, setIsSaveConfirmShown] = useState(false);

  // 保存（旧「反映」）。現状はモックのため未保存フラグを解除する。
  const handleSave = () => {
    setIsDirty(false);
    // 保存確定で変更ハイライトをクリアする（→ 02 §7.2）
    clearChangedCells();
    toast.success('年間計画を保存しました。');
  };

  // 計画詳細へ戻る（遷移元の計画詳細へ画面遷移。10/20手売りセッション 決定事項35）。
  // 遷移元は引き継いだ取引制度で判別する（NET固定は計画詳細(NET固定)、それ以外は
  // 計画詳細(マージン率固定・NET入力)）。
  const handleBack = () => {
    navigate(
      tradingSystem === 'NET固定'
        ? 'plan-detail-net-fixed'
        : 'plan-detail-margin-rate-fixed'
    );
  };

  // 列幅・並び・ソートの状態を保存／復元する（→ 02 §7 列状態の永続化）
  const planGridColumnStateProps = useGridColumnState(
    '年間計画作成.計画.columnState',
    {
      // グリッド独自の初期化は、フックが列の状態を復元した後に呼ぶ
      onGridReady: (params) => {
        gridApiRef.current = params.api;
        formulaHL.captureApi(params.api);
      },
    }
  );
  return (
    <div className="flex h-full w-full overflow-hidden bg-gray-100">
      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex flex-col h-full bg-gray-100">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-x-auto overflow-y-auto bg-gray-100">
            <div className="min-w-300">
              <div className="px-6 pt-3 pb-2">
                {/* 画面名はヘッダー（システム名の右）に表示する */}
                <ScreenTitle title="年間計画作成" />

                {/* 基本情報は遷移元の計画詳細と完全に同じ項目・並びにするため、
                    同画面の基本情報コンポーネント（PlanSearchPane）を
                    そのまま再利用する。取引制度は遷移元から引き継いだ値を渡す。
                    対象年月、ステータス／コメント履歴、取引制度／チャネルは本画面では
                    扱わないため非表示にする（対象年月は1〜12月が対象で単月を持たない。
                    対象年は条件エリアで選択する）。取引制度の値自体は販売店・三次店企業の
                    出し分けに使うため引き続き渡す。 */}
                <PlanSearchPane
                  basicInfo={planBasicInfoOf(tradingSystem)}
                  showTargetYearMonth={false}
                  showStatus={false}
                  showTradingSystemAndChannel={false}
                  placeCompanyAndAreaAfterStores
                />

                {/* 条件エリア（対象年＋条件選択ボタン。詳細条件は右ペインで設定） */}
                <div className={`${CARD_CLASS} p-4 mb-3`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* 対象年 */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <label className="text-sm text-gray-700 font-medium whitespace-nowrap">
                        対象年:
                      </label>
                      {/* 選択肢は過去2年・当年・翌年の4年分（10/20手売りセッション 決定事項13） */}
                      <SingleCombobox
                        ariaLabel="対象年"
                        className="w-28"
                        options={[
                          ...TARGET_YEAR_OPTIONS.map((year) => ({
                            value: year,
                            label: year,
                          })),
                        ]}
                        value={selectedYear}
                        onChange={handleYearChange}
                        placeholder="選択してください"
                        searchable={false}
                      />
                    </div>
                    {/* 条件選択（押下で右ペインを表示。販売計画(集計)の集計対象選択と同様） */}
                    <button
                      type="button"
                      onClick={() => setIsConditionPaneShown((v) => !v)}
                      className={`flex items-center gap-2 h-8 px-3 rounded-lg border-2 border-blue-600 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors whitespace-nowrap ${
                        isConditionPaneShown
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-blue-600 hover:bg-blue-50'
                      }`}
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      条件選択
                    </button>
                    {/* 選択中の条件（件数ではなく具体の設定値を表示） */}
                    {isConditionSelected && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {selectedMetaBrands.map((value) => (
                          <span
                            key={`meta-${value}`}
                            className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                          >
                            {labelOfOption(ANNUAL_META_BRAND_OPTIONS, value)}
                          </span>
                        ))}
                        {selectedContainerCapacities.map((value) => (
                          <span
                            key={`capacity-${value}`}
                            className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-700"
                          >
                            {labelOfOption(ANNUAL_CONTAINER_OPTIONS, value)}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 実績反映済みセルの凡例。計画詳細(マージン率固定・NET入力)の
                        年間集計と同じく「サンプル → 説明」の順で表示する。
                        函数の実績反映月は灰背景＋左上の三角（existingFuncCellStyle）で
                        編集不可を示すため、サンプルも同じ体裁にする。
                        函数は桁区切りを付けない表示のためサンプルは「XXX」とする。 */}
                    <div className="ml-auto flex items-center gap-1 text-sm">
                      <span
                        className="text-black px-2 py-1 font-medium"
                        style={existingFuncCellStyle({
                          backgroundColor: GRID_COLORS.readonly,
                        })}
                      >
                        XXX
                      </span>
                      <span className="text-black bg-white px-2 py-1">
                        ：実績反映済みセル
                      </span>
                      {/* 凡例「入力不可（ギフトの実績は上旬に集約）」は、ただのグレーアウトと
                          見分けがつかないため設けない（10/20手売りセッション 決定事項16） */}
                    </div>
                  </div>
                </div>

                {/* メインテーブル（1920x1080 のPCで画面いっぱいに表示）
                    減算値 8.25rem = ヘッダ・フッタ・対象年/条件選択バー等の固定高。
                    最下部までスクロールした状態で本カードが画面高にちょうど収まる値。 */}
                <div
                  className={`${CARD_CLASS} mb-3`}
                  style={{
                    height: viewportGridHeight(8.25),
                    minHeight: '25rem',
                  }}
                >
                  {/* 支払申請一覧参照と同じ共通テーマ（GRID_THEME）を使用。
                      theme= は指定せず App.tsx の provideGlobalGridOptions に委譲する。
                      通常行の横罫線は共通テーマ（rowBorder）で付与する（明細の縦罫線は引かない → 02 §7「罫線」）。
                      ただしセル結合（rowSpan）した背の高いセルは、配下の行の横罫線を覆い隠して
                      しまうため、結合セルの下辺罫線が消える。これを補うため全セルに border-bottom
                      を明示して結合セルの横罫線を表示する。 */}
                  <style>{`
                    .annual-plan-grid .ag-cell {
                      border-bottom: 1px solid var(--grid-grid-line);
                    }
                    /* ギフト（上旬・中旬・下旬の3行1セット）で結合した背の高いセルを縦中央に配置する。
                       縦方向 flex の主軸で中央寄せし、横は stretch で各セルの text-align を活かす
                       （計画詳細の .gift-merged-bottom と同じ方式）。 */
                    .annual-plan-grid .ag-cell.gift-merged {
                      display: flex;
                      flex-direction: column;
                      justify-content: center;
                      align-items: stretch;
                    }
                  `}</style>
                  <div className="h-full annual-plan-grid">
                    <AgGridReact
                      {...planGridColumnStateProps}
                      rowData={displayedRowData}
                      columnDefs={gridColumnDefs}
                      defaultColDef={gridDefaultColDef}
                      // 変更ハイライトの判定（共通 cellClassRule が参照する）
                      context={gridContext}
                      getContextMenuItems={gridFilterContextMenuItems}
                      statusBar={GRID_STATUS_BAR}
                      getRowId={getRowId}
                      pinnedTopRowData={totals}
                      onFilterChanged={handleFilterChanged}
                      onCellValueChanged={handleCellValueChanged}
                      onCellMouseOver={formulaHL.onCellMouseOver}
                      onCellMouseOut={formulaHL.onCellMouseOut}
                      // 計算式をツールチップで見せるため、省略されていないセルでも出す（グローバルは whenTruncated）
                      tooltipShowMode="standard"
                      tooltipShowDelay={300}
                      tooltipHideDelay={5000}
                      // 条件未選択（初期表示）は計画表を空表示にする
                      overlayNoRowsTemplate='<span class="text-sm text-gray-500">条件を選択すると、該当する計画データを表示します。</span>'
                      suppressRowTransform={true}
                      ensureDomOrder={true}
                      {...GRID_BASE_PROPS}
                      suppressFieldDotNotation={true}
                      suppressCellFocus={false}
                      rowSelection={ANNUAL_ROW_SELECTION}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* フッター：アクションボタン */}
          <div className="bg-white border-t border-gray-200 px-6 py-2 flex-shrink-0">
            <div className="flex flex-wrap gap-3 justify-between">
              <div>
                {/* 計画詳細へ戻る（計画詳細のフッターと同じデザイン） */}
                <Button
                  variant="outline"
                  onClick={() => setIsBackConfirmShown(true)}
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 h-9 rounded-lg"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  計画詳細へ戻る
                </Button>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <Button
                  onClick={() => setIsSaveConfirmShown(true)}
                  className={`${BUTTON_STYLES.primary} ${BUTTON_BASE} h-9`}
                >
                  <Save className="h-4 w-4 mr-2" />
                  保存/反映
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 条件選択（画面右ペイン：販売計画(集計)の集計対象選択と同様のスライドイン）。
          条件はメタブランドと容器容量Gのみとする（新商品・除外条件は年間計画では不要）。
          条件は1件選択するたびではなく、プルダウンを閉じて確定した時点で1回だけ確認する。 */}
      <RightPane
        open={isConditionPaneShown}
        onClose={() => setIsConditionPaneShown(false)}
        title="条件選択"
        description="メタブランド・容器容量G で対象を絞り込みます"
        initialWidth={26}
        minWidth={22}
        maxWidth={40}
        footer={
          <div className="flex items-center justify-end gap-3">
            {/* 「すべてリセット」は設けない。条件を変えるときは選び直す（10/20手売りセッション 決定事項34） */}
            {/* 条件が更新されるのは、この確定を押下したタイミングのみ */}
            <button
              type="button"
              onClick={handleSubmitCondition}
              className={`${BUTTON_STYLES.primary} ${BUTTON_BASE} inline-flex items-center h-8 px-4 text-sm font-medium`}
            >
              確定
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {/* メタブランド */}
          <div className="flex flex-col gap-2">
            <label className={FORM_LABEL_CLASS}>メタブランド</label>
            <MultiCombobox
              options={ANNUAL_META_BRAND_OPTIONS}
              value={draftMetaBrands}
              onChange={setDraftMetaBrands}
            />
          </div>
          {/* 容器容量G */}
          <div className="flex flex-col gap-2">
            <label className={FORM_LABEL_CLASS}>容器容量G</label>
            <MultiCombobox
              options={ANNUAL_CONTAINER_OPTIONS}
              value={draftContainerCapacities}
              onChange={setDraftContainerCapacities}
            />
          </div>
        </div>
      </RightPane>

      {/* 戻る（画面移動）の確認 */}
      <ConfirmDialog
        open={isBackConfirmShown}
        title="画面移動の確認"
        confirmLabel="移動"
        description="入力中のデータが破棄されます。本当によろしいですか？"
        onConfirm={() => {
          setIsBackConfirmShown(false);
          handleBack();
        }}
        onCancel={() => setIsBackConfirmShown(false)}
      />

      {/* 保存の確認 */}
      <ConfirmDialog
        open={isSaveConfirmShown}
        title="保存の確認"
        confirmLabel="保存"
        description="年間計画を保存します。対象となるすべての販売計画表のデータを更新します。本当によろしいですか？"
        onConfirm={() => {
          setIsSaveConfirmShown(false);
          handleSave();
        }}
        onCancel={() => setIsSaveConfirmShown(false)}
      />
    </div>
  );
}
