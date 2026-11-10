import {
  FileText,
  Clock,
  Undo2,
  CheckCircle,
  CheckCircle2,
  Send,
  FileSpreadsheet,
  FileStack,
  Search,
} from 'lucide-react';
import { useState, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { CustomCellRendererProps } from 'ag-grid-react';
import type { ColDef, GetRowIdParams } from 'ag-grid-community';

import { SingleCombobox } from '../../ui/single-combobox';
import { SearchClearButton } from '../../ui/search-clear-button';
import { MultiCombobox } from '../../ui/multi-combobox';
import {
  useOrgCascadeSearch,
  toOrgComboOptions,
} from '../../ui/use-org-cascade-search';
import type { OrgCascadeConfig } from '../../../utils/common/orgCascade';
import type { OrgLevel } from '../../../constants/orgHierarchy';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import {
  useGridColumnState,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  withHeaderTooltips,
  gridFilterContextMenuItems,
  GRID_MONTH_TEXT_FILTER,
  GRID_EMPTY_TEXT,
  formatEmptyAsDash,
} from '../../grid';
import { MonthYearPicker } from '../../ui/month-year-picker';
import {
  FORM_LABEL_CLASS,
  BUTTON_STYLES,
  CARD_CLASS,
} from '../../../../styles/commonStyles';
import { ScreenTitle } from '../../ui/screen-title';

// 検索条件の初期値（クリアボタンで戻す値）
const INITIAL_DATE_BASIS = 'accounting'; // 計上年月
const INITIAL_YEAR_MONTH_START = '2026/01';
const INITIAL_YEAR_MONTH_END = '2026/12';
// ステータス：未選択（''）＝条件なし（「指定なし」）。「全て」の選択肢は持たない（→ 02 §9）
const INITIAL_STATUS = '';
// 事業場・部署・営業担当者：ログインユーザーの所属・本人
const INITIAL_ORG: Partial<Record<OrgLevel, string[]>> = {
  office: ['hokkaido'],
  department: ['hokkaido-sales-1'],
  salesRep: ['yamada-taro'],
};

// 事業場・部署・営業担当者は複数選択で、上位・下位の選択肢を連動させる
// （→ utils/common/orgCascade.ts。末端組織は持たない）。選択肢は組織階層マスタから「コード:名称」で表示する
const ORG_CASCADE_CONFIG: OrgCascadeConfig = {
  levels: ['office', 'department', 'salesRep'],
  labels: { office: '事業場', department: '部署', salesRep: '営業担当者' },
};

// ステータスごとのアイコン・色設定
const STATUS_CONFIG: Record<
  string,
  { icon: typeof FileText; className: string }
> = {
  未登録: { icon: FileText, className: 'text-gray-400' },
  担当者承認待ち: { icon: Clock, className: 'text-blue-500' },
  所属長承認待ち: { icon: Clock, className: 'text-blue-500' },
  所属長差戻し: { icon: Undo2, className: 'text-orange-500' },
  確認者確認待ち: { icon: Clock, className: 'text-blue-500' },
  確認者差戻し: { icon: Undo2, className: 'text-orange-500' },
  経理検印待ち: { icon: Clock, className: 'text-blue-500' },
  経理差戻し: { icon: Undo2, className: 'text-orange-500' },
  検印済: { icon: CheckCircle, className: 'text-green-600' },
  送信済: { icon: Send, className: 'text-indigo-500' },
  '支払・実績登録完了': {
    icon: CheckCircle2,
    className: 'text-green-600',
  },
};

interface QuoteData {
  id: string;
  accountingMonth: string; // 計上年月
  paymentStatementNo: string; // 支払明細書No
  paymentAmount: number; // 支払金額(税抜)
  payeeCode: string; // 支払先コード
  payeeName: string; // 支払先名称
  status: string; // ステータス
  targetMonth: string; // 対象年月
  officeCode: string; // 事業場コード（8桁）
  office: string; // 事業場
  departmentCode: string; // 部署コード（8桁）
  department: string; // 部署
  salesRepCode: string; // 営業担当者コード（7桁）
  salesRep: string; // 営業担当者
  retailerCode: string; // 販売店コード（8桁）
  retailer: string; // 販売店
  tertiaryStoreCode: string; // 三次店コード（8桁）
  tertiaryStore: string; // 三次店
  primaryStoreCode: string; // 一次店コード（8桁）
  primaryStore: string; // 一次店
  monthlyRetailerPlanNo: string; // 月次販売店計画書No
  yearOverYearPlanDiff: number; // 前年比・計画差異
  applicationDate: string; // 申請日
}

// 行IDは行の id（生成時の連番で一意。→ 画面設計標準 4.7）
const getRowId = (params: GetRowIdParams<QuoteData>) => params.data.id;

// グリッドの context 型（セルレンダラーから呼ぶコールバックを受け渡す）
interface QuoteListGridContext {
  onPaymentSheet: (data: QuoteData) => void;
  onQuote: (data: QuoteData) => void;
}

// 支払表ボタンレンダラー（クリック時の遷移は context.onPaymentSheet 経由で呼ぶ）。
// 再生成によるグリッド再描画を避けるためモジュールスコープに定義する。
const PaymentSheetButtonRenderer = (
  props: CustomCellRendererProps<QuoteData>
) => {
  // 支払表ボタン押下処理
  const handleClick = () => {
    const context = props.context as QuoteListGridContext;
    if (props.data) {
      context.onPaymentSheet(props.data);
    }
  };
  return (
    <button
      className={`${BUTTON_STYLES.outline} h-8 flex-shrink-0 px-2 py-0.5 rounded-full font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm whitespace-nowrap`}
      onClick={handleClick}
    >
      支払表
    </button>
  );
};

// 引用ボタンレンダラー（クリック時の遷移は context.onQuote 経由で呼ぶ）。
// 再生成によるグリッド再描画を避けるためモジュールスコープに定義する。
const QuoteButtonRenderer = (props: CustomCellRendererProps<QuoteData>) => {
  // 引用ボタン押下処理
  const handleClick = () => {
    const context = props.context as QuoteListGridContext;
    if (props.data) {
      context.onQuote(props.data);
    }
  };
  return (
    <button
      className="h-8 flex-shrink-0 px-2 py-0.5 rounded-full bg-white text-blue-600 border-2 border-blue-600 font-medium hover:bg-blue-50 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm whitespace-nowrap"
      onClick={handleClick}
    >
      引用
    </button>
  );
};

// ステータスセルレンダラー（アイコン＋文言）
const StatusRenderer = (props: CustomCellRendererProps<QuoteData>) => {
  const config = STATUS_CONFIG[props.value];
  if (!config) {
    return <span className="text-gray-900">{props.value}</span>;
  }
  const Icon = config.icon;
  // 列幅を締めた際にテキストを3点リーダで省略するため、
  // アイコンは縮小不可（flex-shrink-0）、文言は truncate（overflow-hidden + ellipsis）にする。
  // 縦中央寄せはAG Grid標準（.ag-cell-wrapper）で自動。
  return (
    <div className="flex items-center gap-1 overflow-hidden">
      <Icon className={`h-5 w-5 flex-shrink-0 ${config.className}`} />
      <span className="text-gray-900 truncate">{props.value}</span>
    </div>
  );
};

interface QuoteListProps {
  onMenuChange?: (menuId: string) => void;
}

export default function QuoteList({ onMenuChange }: QuoteListProps) {
  // AG Grid参照
  const gridRef = useRef<AgGridReact<QuoteData>>(null);

  // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）。
  // 返り値を <AgGridReact> に spread するだけで永続化が有効になる。
  const gridColumnStateProps = useGridColumnState('quoteList.columnState');

  // 検索条件の状態管理
  const [dateBasis, setDateBasis] = useState(INITIAL_DATE_BASIS);
  const [yearMonthStart, setYearMonthStart] = useState(
    INITIAL_YEAR_MONTH_START
  );
  const [yearMonthEnd, setYearMonthEnd] = useState(INITIAL_YEAR_MONTH_END);
  const [status, setStatus] = useState(INITIAL_STATUS);
  // 組織項目は複数選択・連動フィルタリング（未選択＝条件なし。※一覧の絞り込みには使わない・UIのみ）
  const org = useOrgCascadeSearch(ORG_CASCADE_CONFIG, INITIAL_ORG);

  // サンプルデータ（仮データ・後ほど正式データを指定予定）
  const generateSampleData = (): QuoteData[] => {
    const statuses = Object.keys(STATUS_CONFIG);
    const offices = ['北海道支社', '東北支社', '首都圏支社', '近畿圏支社'];
    // 事業場コード（8桁・各事業場に対応）
    const officeCodes = ['10000621', '10000622', '10000623', '10000624'];
    const departments = [
      '北海道営業一部',
      '東北営業一部',
      '首都圏営業一部',
      '近畿圏営業一部',
    ];
    // 部署コード（8桁・各部署に対応）
    const departmentCodes = ['10002984', '10002985', '10002986', '10002987'];
    const salesReps = ['山田 太郎', '佐藤 花子', '鈴木 一郎', '田中 美咲'];
    // 営業担当者コード（7桁・各担当者に対応）
    const salesRepCodes = ['5172733', '5172734', '5172735', '5172736'];
    const payees = [
      { code: '10234671', name: '国分株式会社' },
      { code: '10234672', name: '三菱食品株式会社' },
      { code: '10234673', name: '伊藤忠食品株式会社' },
      { code: '10234674', name: '日本アクセス株式会社' },
    ];
    const retailers = [
      'セブン-イレブン',
      'ファミリーマート',
      'ローソン',
      'イオン',
    ];
    // 販売店コード（8桁・各販売店に対応）
    const retailerCodes = ['30200740', '30200741', '30200742', '30200743'];
    const tertiaryStores = [
      '国分北海道株式会社経営FC',
      '三菱食品株式会社広島FC',
      '伊藤忠食品株式会社東北支社',
      '日本アクセス株式会社首都圏支社',
    ];
    // 三次店コード（8桁・各三次店に対応）
    const tertiaryStoreCodes = ['10754882', '10754883', '10754884', '10754885'];
    const primaryStores = [
      '国分6社通販',
      '三菱食品株式会社北見営業所',
      '伊藤忠食品札幌支店',
      '日本アクセス仙台営業所',
    ];
    // 一次店コード（8桁・各一次店に対応）
    const primaryStoreCodes = ['10010075', '10010076', '10010077', '10010078'];

    const data: QuoteData[] = [];
    for (let i = 1; i <= 20; i++) {
      const payee = payees[i % payees.length];
      const month = ((i % 12) + 1).toString().padStart(2, '0');
      data.push({
        id: String(i),
        accountingMonth: `2026/${month}`,
        paymentStatementNo: `S26${String(100000 + i).padStart(6, '0')}`,
        paymentAmount: (i * 12345) % 1000000,
        payeeCode: payee.code,
        payeeName: payee.name,
        status: statuses[i % statuses.length],
        targetMonth: `2026/${month}`,
        officeCode: officeCodes[i % officeCodes.length],
        office: offices[i % offices.length],
        departmentCode: departmentCodes[i % departmentCodes.length],
        department: departments[i % departments.length],
        salesRepCode: salesRepCodes[i % salesRepCodes.length],
        salesRep: salesReps[i % salesReps.length],
        retailerCode: retailerCodes[i % retailerCodes.length],
        retailer: retailers[i % retailers.length],
        tertiaryStoreCode: tertiaryStoreCodes[i % tertiaryStoreCodes.length],
        tertiaryStore: tertiaryStores[i % tertiaryStores.length],
        primaryStoreCode: primaryStoreCodes[i % primaryStoreCodes.length],
        primaryStore: primaryStores[i % primaryStores.length],
        monthlyRetailerPlanNo: `A26${String(200000 + i).padStart(6, '0')}`,
        yearOverYearPlanDiff: i % 3 === 0 ? 0 : ((i * 7) % 21) - 10,
        applicationDate: `2026/${month}/15`,
      });
    }
    return data;
  };

  const [rowData] = useState<QuoteData[]>(generateSampleData());

  // クリアボタン押下処理（検索条件を初期値に戻す）。
  // 組織項目は未選択（指定なし）にする（決定事項No.774・No.783）
  const handleClear = () => {
    setDateBasis(INITIAL_DATE_BASIS);
    setYearMonthStart(INITIAL_YEAR_MONTH_START);
    setYearMonthEnd(INITIAL_YEAR_MONTH_END);
    setStatus(INITIAL_STATUS);
    org.reset();
  };

  // 支払表ボタン押下処理（支払申請承認画面へ遷移予定）
  const handlePaymentSheet = (data: QuoteData) => {
    // TODO: 選択行（data）をもとに支払申請承認画面へ遷移する
    void data;
  };

  // 引用ボタン押下処理（支払詳細(引用)画面へ遷移する）
  const handleQuote = (data: QuoteData) => {
    void data;
    onMenuChange?.('payment-detail-quote');
  };

  // 請求書受領形態一覧ボタン押下処理
  const handleInvoiceReceiptType = () => {
    // TODO: 請求書受領形態一覧を表示する
  };

  // 支払登録根拠資料一覧ボタン押下処理
  const handlePaymentBasisDoc = () => {
    // TODO: 支払登録根拠資料一覧を表示する
  };

  // AG Grid列定義
  const columnDefs: ColDef<QuoteData>[] = useMemo(
    () => [
      {
        headerName: '',
        field: 'paymentSheet',
        cellRenderer: PaymentSheetButtonRenderer,
        sortable: false,
        filter: false,
        suppressMovable: true,
        resizable: false,
        cellClass: 'cell-left',
      },
      {
        headerName: '',
        field: 'amortization',
        cellRenderer: QuoteButtonRenderer,
        sortable: false,
        filter: false,
        suppressMovable: true,
        resizable: false,
        // 引用ボタンが最低限収まる幅に固定する（セルの余白を詰める）
        width: 45,
        minWidth: 45,
        maxWidth: 45,
        suppressSizeToFit: true,
        cellStyle: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0',
        },
      },
      {
        headerName: '計上年月',
        field: 'accountingMonth',
        ...GRID_MONTH_TEXT_FILTER,
        cellClass: 'cell-left',
      },
      {
        headerName: '支払明細書No',
        field: 'paymentStatementNo',
        cellClass: 'cell-left',
        // ステータスが未登録の場合は支払明細書Noを空欄表示する
        valueFormatter: (params) =>
          params.data?.status === '未登録'
            ? GRID_EMPTY_TEXT
            : formatEmptyAsDash(params),
      },
      {
        headerName: '月次販売店計画書No',
        field: 'monthlyRetailerPlanNo',
        cellClass: 'cell-left',
      },
      {
        headerName: '支払金額(税抜)',
        field: 'paymentAmount',
        cellClass: 'cell-right',
        valueFormatter: (params) =>
          params.value?.toLocaleString() || GRID_EMPTY_TEXT,
      },
      {
        headerName: '支払先コード',
        field: 'payeeCode',
        cellClass: 'cell-left',
      },
      {
        headerName: '支払先名称',
        field: 'payeeName',
        cellClass: 'cell-left',
      },
      {
        headerName: 'ステータス',
        field: 'status',
        cellRenderer: StatusRenderer,
        cellClass: 'cell-left',
      },
      {
        headerName: '対象年月',
        field: 'targetMonth',
        ...GRID_MONTH_TEXT_FILTER,
        cellClass: 'cell-left',
      },
      {
        headerName: '事業場コード',
        field: 'officeCode',
        cellClass: 'cell-left',
      },
      {
        headerName: '事業場名称',
        field: 'office',
        cellClass: 'cell-left',
      },
      {
        headerName: '部署コード',
        field: 'departmentCode',
        cellClass: 'cell-left',
      },
      {
        headerName: '部署名称',
        field: 'department',
        cellClass: 'cell-left',
      },
      {
        headerName: '営業担当者コード',
        field: 'salesRepCode',
        cellClass: 'cell-left',
      },
      {
        headerName: '営業担当者名称',
        field: 'salesRep',
        cellClass: 'cell-left',
      },
      {
        headerName: '販売店コード',
        field: 'retailerCode',
        cellClass: 'cell-left',
      },
      {
        headerName: '販売店名称',
        field: 'retailer',
        cellClass: 'cell-left',
      },
      {
        headerName: '三次店コード',
        field: 'tertiaryStoreCode',
        cellClass: 'cell-left',
      },
      {
        headerName: '三次店名称',
        field: 'tertiaryStore',
        cellClass: 'cell-left',
      },
      {
        headerName: '一次店コード',
        field: 'primaryStoreCode',
        cellClass: 'cell-left',
      },
      {
        headerName: '一次店名称',
        field: 'primaryStore',
        cellClass: 'cell-left',
      },
      {
        headerName: '前年比・計画差異',
        field: 'yearOverYearPlanDiff',
        cellClass: 'cell-center',
        // 差異がある場合は「×」、差異がない場合は「-」を表示
        valueFormatter: (params) => (params.value ? '×' : GRID_EMPTY_TEXT),
      },
      {
        headerName: '申請日',
        field: 'applicationDate',
        cellClass: 'cell-left',
      },
    ],
    []
  );

  // ヘッダーが省略表示された場合にマウスオーバーで全文表示するため、
  // 各列に headerTooltip（=headerName）を付与する（共通ヘルパー・grid/）
  const columnDefsWithTooltip = useMemo(
    () => withHeaderTooltips(columnDefs),
    [columnDefs]
  );

  return (
    <div className="min-w-[75rem]">
      <div className="px-6 pt-3 pb-3">
        {/* 画面名はヘッダー（システム名の右）に表示する */}
        <ScreenTitle title="引用一覧" />

        {/* 検索条件カード */}
        <div className={`${CARD_CLASS} overflow-hidden mb-3`}>
          {/* 検索条件ヘッダー（クリアボタンはヘッダー右端に置き、専用の行を使わない。計画一覧と同一体裁） */}
          <div className="px-3 py-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-gray-700" />
              <h2 className="text-gray-900 font-bold text-base">検索条件</h2>
            </div>
            <SearchClearButton onClick={handleClear} />
          </div>

          <div className="px-4 py-1.5">
            {/* 計上年月・対象年月 ラジオボタン（年月の基準・上段に独立配置） */}
            {/* pl-8: ラジオの丸を「年月(開始)」ラベル（w-24 右揃え）の文字開始位置に合わせる */}
            <RadioGroup
              value={dateBasis}
              onValueChange={setDateBasis}
              className="flex flex-row items-center gap-4 mb-2.5 pl-8"
            >
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="accounting" id="date-basis-accounting" />
                <label
                  htmlFor="date-basis-accounting"
                  className={`${FORM_LABEL_CLASS} whitespace-nowrap cursor-pointer`}
                >
                  計上年月
                </label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="target" id="date-basis-target" />
                <label
                  htmlFor="date-basis-target"
                  className={`${FORM_LABEL_CLASS} whitespace-nowrap cursor-pointer`}
                >
                  対象年月
                </label>
              </div>
            </RadioGroup>

            {/* 検索条件フィールド（3列Grid：各セル＝ラベル＋入力。ラベル左端を縦に揃える） */}
            <div className="grid grid-cols-[auto_auto_auto] items-center gap-x-6 gap-y-2.5">
              {/* 2行目1列目: 年月(開始)～年月(終了)（1つのまとまりとして近接配置） */}
              {/* MonthYearPicker は id/aria-label 非対応のため範囲をグループ化して名前付け */}
              <div
                className="flex items-center gap-2"
                role="group"
                aria-label="検索対象年月の範囲"
              >
                <label
                  className={`${FORM_LABEL_CLASS} whitespace-nowrap w-24 text-right`}
                >
                  年月(開始)
                </label>
                <MonthYearPicker
                  value={yearMonthStart}
                  onChange={setYearMonthStart}
                  required={false}
                />
                {/* ～ */}
                <span className="text-sm text-gray-700 px-1">～</span>
                <label className={`${FORM_LABEL_CLASS} whitespace-nowrap`}>
                  年月(終了)
                </label>
                <MonthYearPicker
                  value={yearMonthEnd}
                  onChange={setYearMonthEnd}
                  required={false}
                />
              </div>

              {/* 2行目2列目: ステータス */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="search-status"
                  className={`${FORM_LABEL_CLASS} whitespace-nowrap w-24 text-right`}
                >
                  ステータス
                </label>
                <SingleCombobox
                  id="search-status"
                  className="w-44"
                  options={[
                    { value: '未登録', label: '未登録' },
                    { value: '担当者承認待ち', label: '担当者承認待ち' },
                    { value: '所属長承認待ち', label: '所属長承認待ち' },
                    { value: '所属長差戻し', label: '所属長差戻し' },
                    { value: '確認者確認待ち', label: '確認者確認待ち' },
                    { value: '確認者差戻し', label: '確認者差戻し' },
                    { value: '経理検印待ち', label: '経理検印待ち' },
                    { value: '経理差戻し', label: '経理差戻し' },
                    { value: '検印済', label: '検印済' },
                    { value: '送信済', label: '送信済' },
                    {
                      value: '支払・実績登録完了',
                      label: '支払・実績登録完了',
                    },
                  ]}
                  value={status}
                  onChange={setStatus}
                  placeholder="指定なし"
                  clearable
                  searchable={false}
                />
              </div>

              {/* 2行目3列目: 空（事業場を3行目1列目に送るためのプレースホルダー） */}
              <div />

              {/* 3行目1列目: 事業場 */}
              <div
                className="flex items-center gap-2"
                role="group"
                aria-labelledby="label-office"
              >
                <label
                  id="label-office"
                  htmlFor="search-office"
                  className={`${FORM_LABEL_CLASS} whitespace-nowrap w-24 text-right`}
                >
                  事業場
                </label>
                <div className="w-60">
                  <MultiCombobox
                    id="search-office"
                    options={toOrgComboOptions(
                      org.options('office'),
                      'codeName'
                    )}
                    value={org.values('office')}
                    onChange={(v) => org.change('office', v)}
                  />
                </div>
              </div>

              {/* 3行目2列目: 部署 */}
              <div
                className="flex items-center gap-2"
                role="group"
                aria-labelledby="label-department"
              >
                <label
                  id="label-department"
                  htmlFor="search-department"
                  className={`${FORM_LABEL_CLASS} whitespace-nowrap w-24 text-right`}
                >
                  部署
                </label>
                <div className="w-60">
                  <MultiCombobox
                    id="search-department"
                    options={toOrgComboOptions(
                      org.options('department'),
                      'codeName'
                    )}
                    value={org.values('department')}
                    onChange={(v) => org.change('department', v)}
                  />
                </div>
              </div>

              {/* 3行目3列目: 営業担当者 */}
              <div
                className="flex items-center gap-2"
                role="group"
                aria-labelledby="label-sales-rep"
              >
                <label
                  id="label-sales-rep"
                  htmlFor="search-sales-rep"
                  className={`${FORM_LABEL_CLASS} whitespace-nowrap w-24 text-right`}
                >
                  営業担当者
                </label>
                <div className="w-60">
                  <MultiCombobox
                    id="search-sales-rep"
                    options={toOrgComboOptions(
                      org.options('salesRep'),
                      'codeName'
                    )}
                    value={org.values('salesRep')}
                    onChange={(v) => org.change('salesRep', v)}
                    unit="名"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 引用一覧テーブル */}
        <div className={`${CARD_CLASS} p-2`}>
          {/* グリッド上部ボタン群 */}
          <div className="flex items-center gap-2 mb-2">
            <button
              className="btn-toolbar-outline ml-auto"
              aria-label="請求書受領形態一覧"
              onClick={handleInvoiceReceiptType}
            >
              <FileSpreadsheet className="h-[1rem] w-[1rem]" />
              請求書受領形態一覧
            </button>
            <button
              className="btn-toolbar-outline"
              aria-label="支払登録根拠資料一覧"
              onClick={handlePaymentBasisDoc}
            >
              <FileStack className="h-[1rem] w-[1rem]" />
              支払登録根拠資料一覧
            </button>
          </div>

          <div
            className="quote-list-grid"
            style={{ height: '23.75rem', width: '100%' }}
          >
            <AgGridReact<QuoteData>
              ref={gridRef}
              rowData={rowData}
              getRowId={getRowId}
              columnDefs={columnDefsWithTooltip}
              defaultColDef={GRID_DEFAULT_COL_DEF}
              getContextMenuItems={gridFilterContextMenuItems}
              domLayout="normal"
              animateRows={true}
              // セルレンダラーへ渡すコールバック（支払表・引用ボタンの遷移処理）
              context={
                {
                  onPaymentSheet: handlePaymentSheet,
                  onQuote: handleQuote,
                } satisfies QuoteListGridContext
              }
              // 共通基本プロパティ（Enter縦移動・テキスト選択／grid/）
              {...GRID_BASE_PROPS}
              // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）
              {...gridColumnStateProps}
              statusBar={GRID_STATUS_BAR}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
