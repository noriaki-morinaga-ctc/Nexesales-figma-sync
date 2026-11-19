// 計画一覧（実績一覧を含む）：一覧の列の定義（列のグループ）とセルの表示部品。
// リンクを押したときの遷移は画面から引数で受け取る。

import type {
  ColDef,
  ColGroupDef,
  ICellRendererParams,
} from 'ag-grid-community';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Clock,
  Undo2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { valueOrEmpty } from '@/components/ui/empty-value';
import { GRID_EMPTY_TEXT, GRID_MONTH_TEXT_FILTER } from '@/components/grid';
import { OVERDUE_BADGE_CLASS } from '@/styles/commonStyles';

import { VENDING_PATTERN } from './constants';
import type { SalesPlanData } from './planList.types';

// ステータスごとのアイコン・色設定（支払申請一覧参照と同じ方式）
const STATUS_CONFIG: Record<
  string,
  { icon: typeof AlertCircle; className: string }
> = {
  未申請: { icon: AlertCircle, className: 'text-orange-500' },
  承認待ち: { icon: Clock, className: 'text-blue-500' },
  // 差戻しは未申請（オレンジ）と見分けるため赤にする（UI/UX UX-011）
  差戻し: { icon: Undo2, className: 'text-red-600' },
  承認済み: { icon: CheckCircle, className: 'text-green-600' },
  確定: { icon: CheckCircle2, className: 'text-green-600' },
  未承認確定: { icon: AlertTriangle, className: 'text-yellow-600' },
};

// 作成パターン=自販機行の実績登録(アライアンス品)の状況を対象年月から決定する。
// 202601～202604は「登録済」、それ以外（202605以降など）は「未登録」。
const resolveHqActualStatus = (targetMonth: string): string =>
  targetMonth >= '202601' && targetMonth <= '202604' ? '登録済' : '未登録';

// 作成パターン=自販機行の実績登録(アライアンス品以外)の状況を対象年月から決定する。
// 202601～202603・202605は「登録済」、202604・202606は「未登録(一部)」、その他は「未登録」。
const resolveOpeActualStatus = (targetMonth: string): string => {
  if (targetMonth >= '202601' && targetMonth <= '202603') return '登録済';
  if (targetMonth === '202604') return '未登録(一部)';
  if (targetMonth === '202605') return '登録済';
  if (targetMonth === '202606') return '未登録(一部)';
  return '未登録';
};

// 実績登録の期限超過（モックの判定）。自販機行で、未登録のまま期限を過ぎた対象年月。
// 赤背景にはせず、セル内に「期限超過」のラベルを出す（UX-028）。
const HQ_ACTUAL_OVERDUE_MONTH = '202605';
const OPE_ACTUAL_OVERDUE_MONTH = '202604';
// 実績登録が期限超過か（未登録・一部未の自販機行で、対象年月が期限を過ぎた月）。
// セルの背景（cell-overdue）とラベル（期限超過）の両方で使う
const isActualOverdue = (
  data: { tradeSystem?: string; targetMonth?: string } | undefined,
  value: unknown,
  overdueMonth: string
): boolean =>
  (value === '未登録' || value === '未登録(一部)') &&
  data?.tradeSystem === VENDING_PATTERN &&
  data?.targetMonth === overdueMonth;

interface LinkCellParams extends ICellRendererParams<SalesPlanData> {
  onLinkClick: (data: SalesPlanData) => void;
}

// 計画書番号・実績番号のリンク。値のある行だけリンクにし、値の無い行は空欄（決定事項No.785）
function LinkCellRenderer(props: LinkCellParams) {
  if (!props.value || !props.data) return null;
  const data = props.data;
  return (
    <button
      type="button"
      className="cursor-pointer text-blue-600 hover:underline focus:ring-2 focus:ring-blue-500 focus:outline-none"
      onClick={() => props.onLinkClick(data)}
    >
      {props.value}
    </button>
  );
}

// ステータスセルレンダラー（アイコン＋文言・支払申請一覧参照と同じ方式）
function StatusRenderer(props: ICellRendererParams<SalesPlanData>) {
  const config = STATUS_CONFIG[props.value];
  if (!config) {
    return <span className="text-gray-900">{props.value}</span>;
  }
  const Icon = config.icon;
  return (
    <div className="flex items-center gap-1">
      <Icon className={`h-5 w-5 ${config.className}`} />
      <span className="text-gray-900">{props.value}</span>
    </div>
  );
}

interface ActualStatusParams extends ICellRendererParams<SalesPlanData> {
  overdueMonth: string;
}

// 実績登録状況セルレンダラー（アイコン＋文言）
// 「未登録」「一部未」は AlertCircle、「登録済」は CheckCircle。
// 対象外（「-」など）はアイコンなしで文言のみ表示（「-」はグレー）。
// 期限超過（cellRendererParams.overdueMonth と対象年月が一致する自販機行）は、
// 文言の右に「期限超過」のラベルを出す。
function ActualStatusRenderer(props: ActualStatusParams) {
  const value = props.value;
  if (value === '未登録' || value === '未登録(一部)') {
    const isOverdue = isActualOverdue(props.data, value, props.overdueMonth);
    return (
      <div className="flex items-center gap-1">
        <AlertCircle className="h-5 w-5 text-orange-500" />
        <span className="text-gray-900">{value}</span>
        {isOverdue && (
          <Badge variant="outline" className={OVERDUE_BADGE_CLASS}>
            期限超過
          </Badge>
        )}
      </div>
    );
  }
  if (value === '登録済') {
    return (
      <div className="flex items-center gap-1">
        <CheckCircle className="h-5 w-5 text-green-600" />
        <span className="text-gray-900">{value}</span>
      </div>
    );
  }
  return <span className="text-gray-900">{valueOrEmpty(value)}</span>;
}

/** 実績登録の列（アライアンス品／アライアンス品以外） */
const actualStatusColumn = (
  headerName: string,
  resolve: (targetMonth: string) => string,
  overdueMonth: string
): ColDef<SalesPlanData> => ({
  headerName,
  // ヘッダーを headerName の \n の位置で2段表示にする。
  // 折り返しと高さ調整は AG Grid 公式の wrapHeaderText / autoHeaderHeight、
  // 改行位置の固定は headerClass 経由の white-space: pre-line（画面の <style>）で行う。
  headerClass: 'header-wrap-pre-line',
  wrapHeaderText: true,
  autoHeaderHeight: true,
  // 自販機行は対象年月で判定、それ以外（自販機以外）は対象外のため「-」表示
  valueGetter: (params) =>
    params.data?.tradeSystem === VENDING_PATTERN
      ? resolve(params.data?.targetMonth ?? '')
      : GRID_EMPTY_TEXT,
  cellRenderer: ActualStatusRenderer,
  // 期限超過の対象年月（ラベルの表示判定に使う）
  cellRendererParams: { overdueMonth },
  // ステータスバッジ（アイコン）は中央寄せ
  cellClass: 'cell-center',
  // 期限超過のセルは背景を薄い赤にする（→ 02 §7「期限超過の表示」）
  cellClassRules: {
    'cell-overdue': (params) =>
      isActualOverdue(params.data, params.value, overdueMonth),
  },
});

/** 自販機行は値を持たない項目（「-」表示） */
const notForVending =
  (get: (data: SalesPlanData) => string) =>
  (params: { data?: SalesPlanData }) =>
    params.data?.tradeSystem === VENDING_PATTERN
      ? GRID_EMPTY_TEXT
      : (params.data && get(params.data)) || '';

/** 三次店・一次店の代表（組み合わせがあるときは1件目） */
const representativeStore =
  (key: 'tertiaryStore' | 'primaryStore') =>
  (params: { data?: SalesPlanData }) => {
    const details = params.data?.storeDetails;
    if (details && details.length > 0) return details[0][key];
    return params.data?.[key] || '';
  };

interface PlanListColumnHandlers {
  /** 計画書番号のリンクを押したとき */
  onPlanClick: (data: SalesPlanData) => void;
  /** 実績番号のリンクを押したとき */
  onActualClick: (data: SalesPlanData) => void;
}

/** 名称の左に置くコードの列 */
const codeColumn = (
  headerName: string,
  field: keyof SalesPlanData
): ColDef<SalesPlanData> => ({
  headerName,
  field,
  cellClass: 'cell-left',
});

/**
 * 列のグループ（見出しの上の段）。列を動かしてもグループの外へ出ないよう marryChildren を付ける
 * （同じグループを離して置くと見出しが分かれるため）
 */
const columnGroup = (
  headerName: string,
  children: ColDef<SalesPlanData>[]
): ColGroupDef<SalesPlanData> => ({
  headerName,
  marryChildren: true,
  children,
});

/**
 * 計画一覧の列の定義。列は業務のまとまりのグループ（基本情報・得意先・組織・手売り・自販機）に分け、
 * 見出しを2段にする（UI/UX UX-116。グループ名と並びは ASD の検討結果どおり。実績番号は自販機のグループ）。
 */
export const buildPlanListColumnDefs = ({
  onPlanClick,
  onActualClick,
}: PlanListColumnHandlers): (
  | ColDef<SalesPlanData>
  | ColGroupDef<SalesPlanData>
)[] => [
  columnGroup('基本情報', [
    {
      // 計画書番号（旧「月次販売計画書No」。決定事項No.776）。押下で計画詳細へ遷移
      // 詳細ボタンの列は設けず、このリンクで計画詳細へ遷移する（決定事項No.768）。
      headerName: '計画書番号',
      field: 'monthlyPlanNo',
      cellRenderer: LinkCellRenderer,
      cellRendererParams: { onLinkClick: onPlanClick },
      // 実績一覧（チェックボックス非表示）では先頭列になり grid.css で中央寄せが
      // 強制されるため、ag-cell-left で左寄せに戻す
      cellClass: ['cell-left', 'ag-cell-left'],
    },
    {
      headerName: '対象年月',
      field: 'targetMonth',
      ...GRID_MONTH_TEXT_FILTER,
      cellClass: 'cell-left',
    },
    {
      headerName: 'ステータス',
      field: 'status',
      cellRenderer: StatusRenderer,
      // ステータスはアイコン＋文言のため左寄せ（→ 02 §7）
      cellClass: 'cell-left',
    },
  ]),
  columnGroup('得意先', [
    {
      headerName: 'チャネル',
      field: 'channel',
      // 自販機はチャネルを持たないため「-」表示
      valueGetter: notForVending((d) => d.channel),
      cellClass: 'cell-left',
    },
    codeColumn('販売店コード', 'retailerCode'),
    {
      headerName: '販売店',
      field: 'retailer',
      cellClass: 'cell-left',
    },
    codeColumn('三次店コード', 'tertiaryStoreCode'),
    {
      headerName: '三次店',
      field: 'tertiaryStore',
      valueGetter: representativeStore('tertiaryStore'),
      // 複数の三次店・一次店の組み合わせを持つ行はここから展開する
      cellRenderer: 'agGroupCellRenderer',
      cellClass: 'cell-left',
    },
    codeColumn('一次店コード', 'primaryStoreCode'),
    {
      headerName: '一次店',
      field: 'primaryStore',
      valueGetter: representativeStore('primaryStore'),
      // 複数の三次店・一次店の組み合わせを持つ行はここから展開する
      cellRenderer: 'agGroupCellRenderer',
      cellClass: 'cell-left',
    },
    codeColumn('三次店企業コード', 'tertiaryStoreCompanyCode'),
    {
      headerName: '三次店企業',
      field: 'tertiaryStoreCompany',
      // 値が無いときは共通の既定列設定がグレーの「-」を表示する
      valueGetter: (params) => params.data?.tertiaryStoreCompany || '',
      cellClass: 'cell-left',
    },
  ]),
  // 組織は階層順（担当エリア→事業場→部署→末端組織→作成者。末端組織＝採算組織第6階層）
  columnGroup('組織', [
    {
      headerName: '担当エリアコード',
      field: 'areaCode',
      // 自販機は担当エリアを持たないため「-」表示
      valueGetter: notForVending((d) => d.areaCode),
      cellClass: 'cell-left',
    },
    {
      headerName: '担当エリア',
      field: 'area',
      valueGetter: notForVending((d) => d.area),
      cellClass: 'cell-left',
    },
    codeColumn('事業場コード', 'officeCode'),
    {
      headerName: '事業場',
      field: 'office',
      cellClass: 'cell-left',
    },
    {
      headerName: '部署',
      field: 'department',
      cellClass: 'cell-left',
    },
    codeColumn('末端組織コード', 'terminalOrgCode'),
    {
      headerName: '末端組織',
      field: 'terminalOrg',
      cellClass: 'cell-left',
    },
    codeColumn('作成者コード', 'salesRepCode'),
    {
      headerName: '作成者',
      field: 'salesRep',
      cellClass: 'cell-left',
    },
  ]),
  columnGroup('手売り', [
    {
      headerName: '商品粒度',
      field: 'inputProductGranularity',
      // 自販機は商品粒度を持たないため「-」表示
      valueGetter: notForVending((d) => d.inputProductGranularity),
      cellClass: 'cell-left',
    },
    {
      headerName: '作成パターン',
      field: 'tradeSystem',
      // jihanki モード時に setFilterModel({filterType:'set'}) が確実に一致するよう
      // Set Filter を明示（Enterpriseの既定だが型を固定して曖昧さを排除）
      filter: 'agSetColumnFilter',
      cellClass: 'cell-left',
    },
  ]),
  columnGroup('自販機', [
    {
      // 実績番号。押下で販売実績詳細へ遷移（決定事項No.768）
      headerName: '実績番号',
      field: 'actualNo',
      cellRenderer: LinkCellRenderer,
      cellRendererParams: { onLinkClick: onActualClick },
      cellClass: 'cell-left',
    },
    // 表示値は「未登録」「済」の二択
    actualStatusColumn(
      '実績登録\n(アライアンス品)',
      resolveHqActualStatus,
      HQ_ACTUAL_OVERDUE_MONTH
    ),
    // 表示値は「未登録」「未登録(一部)」「済」の三択
    actualStatusColumn(
      '実績登録\n(アライアンス品以外)',
      resolveOpeActualStatus,
      OPE_ACTUAL_OVERDUE_MONTH
    ),
  ]),
];
