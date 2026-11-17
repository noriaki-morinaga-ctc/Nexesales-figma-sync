import { Search, Upload } from 'lucide-react';
import { useState, useMemo, useRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, GetRowIdParams } from 'ag-grid-community';

import { CopyableArea } from '@/components/ui/copyable-area';
import {
  buildSearchSummary,
  formatSummaryValue,
} from '@/components/ui/search-summary';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { SingleCombobox } from '@/components/ui/single-combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  SEARCH_GRID_CLASS,
  SEARCH_LABEL_CLASS,
  TEXT_INPUT_CLASS,
  CARD_CLASS,
} from '@/styles/commonStyles';
import { SearchClearButton } from '@/components/ui/search-clear-button';
import {
  GRID_BASE_PROPS,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  gridFilterContextMenuItems,
  useGridColumnState,
} from '@/components/grid';
import { ScreenTitle } from '@/components/ui/screen-title';
import { useAppNavigation } from '@/components/ui/use-app-navigation';

interface DistributionRetailerData {
  id: string;
  distributionRetailerManager: string; // 商流販売店担当者（部署名／担当者名）
  retailer: string; // 販売店
  retailerAccountingOrg: string; // 販売店計上組織
  tertiaryDepartment: string; // 三次店担当部署
  tertiaryManager: string; // 三次店担当者
  tertiaryStore: string; // 三次店
  primaryStore: string; // 一次店
  beverageDivision: string; // 飲料事業区分
  channel: string; // チャネル
}

// サンプルデータ生成用の基本データ
const DEPARTMENTS = [
  '北海道支社営業一部',
  '北海道支社営業二部',
  '北海道支社営業三部',
  '東北支社営業一部',
  '関東支社営業一部',
];
const MANAGERS = [
  '平山 智己',
  '二階堂 拓哉',
  '竹原 幸奈',
  '田中 太郎',
  '鈴木 花子',
  '佐藤 次郎',
  '山田 花子',
  '高橋 一郎',
];
const RETAILERS = [
  '21102278:ホーマック',
  '21102279:コープさっぽろ',
  '21102280:イオン北海道',
  '21102281:ツルハドラッグ',
  '21102282:サツドラ',
];
const TERTIARY_STORES = [
  '10760813:国分北海道株式会社恵庭流通センター',
  '10760814:国分北海道株式会社札幌流通センター',
  '10760815:国分北海道株式会社旭川流通センター',
  '10760816:三菱食品株式会社北海道支社',
  '10760817:日本アクセス北海道株式会社',
];
const PRIMARY_STORES = [
  '10888833:国分北海道株式会社経理財務部 経理財務課',
  '10888834:国分北海道株式会社営業企画部',
  '10888835:三菱食品株式会社営業本部',
  '10888836:日本アクセス株式会社営業統括部',
];
const BEVERAGE_DIVISIONS = ['CA', 'CB', 'CC', 'CD'];
const CHANNELS = [
  '全国/DS･HC',
  '全国/CVS',
  '全国/SM',
  '北海道/DS･HC',
  '北海道/CVS',
];

// 検索条件の初期値（クリアで戻す値）。未選択（''）＝条件なし（「指定なし」）
const INITIAL_SEARCH_FILTERS = {
  department1: 'hokkaido-sales-1',
  department2: 'hokkaido-sales-1-as',
  salesRep: 'hirayama-tomoki',
  channel: '',
};

// 検索条件の選択肢。value は条件の状態、label は一覧の表示値（絞り込みで突き合わせる）
const DEPARTMENT1_OPTIONS = [
  { value: 'hokkaido-sales-1', label: '北海道支社営業一部' },
  { value: 'hokkaido-sales-2', label: '北海道支社営業二部' },
  { value: 'hokkaido-sales-3', label: '北海道支社営業三部' },
];
const DEPARTMENT2_OPTIONS = [
  { value: 'hokkaido-sales-1-as', label: '北海道支社営業一部AS' },
  { value: 'hokkaido-sales-1-bs', label: '北海道支社営業一部BS' },
];
const SALES_REP_OPTIONS = [
  { value: 'hirayama-tomoki', label: '平山 智己' },
  { value: 'nikaido-takuya', label: '二階堂 拓哉' },
  { value: 'takehara-yukina', label: '竹原 幸奈' },
];
const CHANNEL_OPTIONS = [
  { value: 'national-ds-hc', label: '全国/DS･HC' },
  { value: 'national-cvs', label: '全国/CVS' },
  { value: 'national-sm', label: '全国/SM' },
  { value: 'hokkaido-ds-hc', label: '北海道/DS･HC' },
];

// 選択値（value）から一覧の表示値（label）を引く。未選択は ''
const optionLabel = (
  options: { value: string; label: string }[],
  value: string
) => options.find((option) => option.value === value)?.label ?? '';

// 一覧グリッドの行ID（→ 画面設計標準 4.7）。サンプルデータで採番した id（1〜100）を使う
const getRowId = (params: GetRowIdParams<DistributionRetailerData>) =>
  params.data.id;

// 100行のサンプルデータ生成関数
function generateSampleData(): DistributionRetailerData[] {
  const data: DistributionRetailerData[] = [];

  // 1行目は指定されたデータ
  data.push({
    id: '1',
    distributionRetailerManager: '北海道支社営業一部／平山 智己',
    retailer: '21102278:ホーマック',
    retailerAccountingOrg: '北海道支社営業一部',
    tertiaryDepartment: '北海道支社営業二部',
    tertiaryManager: '二階堂 拓哉',
    tertiaryStore: '10760813:国分北海道株式会社恵庭流通センター',
    primaryStore: '10888833:国分北海道株式会社経理財務部 経理財務課',
    beverageDivision: 'CA',
    channel: '全国/DS･HC',
  });

  // 2行目以降の99行を生成
  for (let i = 2; i <= 100; i++) {
    const deptIndex = (i - 1) % DEPARTMENTS.length;
    const managerIndex = (i - 1) % MANAGERS.length;
    const retailerIndex = (i - 1) % RETAILERS.length;
    const tertiaryIndex = (i - 1) % TERTIARY_STORES.length;
    const primaryIndex = (i - 1) % PRIMARY_STORES.length;
    const beverageIndex = (i - 1) % BEVERAGE_DIVISIONS.length;
    const channelIndex = (i - 1) % CHANNELS.length;

    data.push({
      id: String(i),
      distributionRetailerManager: `${DEPARTMENTS[deptIndex]}／${MANAGERS[managerIndex]}`,
      retailer: RETAILERS[retailerIndex],
      retailerAccountingOrg: DEPARTMENTS[deptIndex],
      tertiaryDepartment: DEPARTMENTS[(deptIndex + 1) % DEPARTMENTS.length],
      tertiaryManager: MANAGERS[(managerIndex + 1) % MANAGERS.length],
      tertiaryStore: TERTIARY_STORES[tertiaryIndex],
      primaryStore: PRIMARY_STORES[primaryIndex],
      beverageDivision: BEVERAGE_DIVISIONS[beverageIndex],
      channel: CHANNELS[channelIndex],
    });
  }

  return data;
}

export default function DistributionRetailerMaster() {
  // 画面の切り替え（→ ui/use-app-navigation）
  const navigate = useAppNavigation();
  const [isOpen, setIsOpen] = useState(true);

  // 検索条件の状態管理。リアルタイム検索とし、この状態を直接 filteredData の絞り込み条件に用いる
  //（検索ボタンは設けない。画面設計標準 3.2）
  const [department1, setDepartment1] = useState(
    INITIAL_SEARCH_FILTERS.department1
  );
  const [department2, setDepartment2] = useState(
    INITIAL_SEARCH_FILTERS.department2
  );
  const [salesRep, setSalesRep] = useState(INITIAL_SEARCH_FILTERS.salesRep);
  const [channel, setChannel] = useState(INITIAL_SEARCH_FILTERS.channel);
  // const [retailer, setRetailer] = useState(""); // 未使用のため削除

  // アップロード用の状態管理
  const [selectedFileName, setSelectedFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // サンプルデータ（100行）
  const [rowData] = useState<DistributionRetailerData[]>(generateSampleData());

  // 検索条件で絞り込んだ一覧（未選択の条件は絞り込まない）。
  // 部署1・営業担当者は商流販売店担当者（部署名／担当者名）と、チャネルはチャネルと完全一致で突き合わせる。
  // ※部署2（AS/BS）はサンプルデータに対応する項目が無いため絞り込まない
  const filteredData = useMemo(() => {
    const departmentLabel = optionLabel(DEPARTMENT1_OPTIONS, department1);
    const salesRepLabel = optionLabel(SALES_REP_OPTIONS, salesRep);
    const channelLabel = optionLabel(CHANNEL_OPTIONS, channel);
    return rowData.filter((row) => {
      const [managerDepartment, managerName] =
        row.distributionRetailerManager.split('／');
      if (departmentLabel && managerDepartment !== departmentLabel)
        return false;
      if (salesRepLabel && managerName !== salesRepLabel) return false;
      if (channelLabel && row.channel !== channelLabel) return false;
      return true;
    });
  }, [rowData, department1, salesRep, channel]);

  const handleDetail = useCallback(
    (_data: DistributionRetailerData) => {
      // 商流販売店マスタ詳細画面に遷移
      navigate('distribution-retailer-detail');
    },
    [navigate]
  );

  // 詳細ボタンレンダラー（列定義の useMemo で使うため、描画のたびに作り直さない）
  const DetailButtonRenderer = useCallback(
    (props: any) => (
      <div className="flex items-center h-full">
        <button
          className="px-4 py-1 rounded-full bg-white text-blue-600 border-2 border-blue-600 font-medium hover:bg-blue-50 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm whitespace-nowrap"
          onClick={() => handleDetail(props.data)}
          aria-label="編集"
        >
          編集
        </button>
      </div>
    ),
    [handleDetail]
  );

  // 検索条件を初期値へ戻す（一覧は条件に合わせて即時に絞り込み直される）
  // 検索条件を折り畳んだときに見出しの行へ出す要約（値が入っている項目だけ。UI/UX UX-024）
  const searchSummary = buildSearchSummary([
    {
      label: '部署1',
      value: formatSummaryValue(department1, DEPARTMENT1_OPTIONS),
    },
    {
      label: '部署2',
      value: formatSummaryValue(department2, DEPARTMENT2_OPTIONS),
    },
    {
      label: '営業担当者',
      value: formatSummaryValue(salesRep, SALES_REP_OPTIONS),
    },
    { label: 'チャネル', value: formatSummaryValue(channel, CHANNEL_OPTIONS) },
  ]);

  const handleClear = () => {
    setDepartment1(INITIAL_SEARCH_FILTERS.department1);
    setDepartment2(INITIAL_SEARCH_FILTERS.department2);
    setSalesRep(INITIAL_SEARCH_FILTERS.salesRep);
    setChannel(INITIAL_SEARCH_FILTERS.channel);
  };

  const handleRetailerSelect = () => {
    // TODO: 販売店選択（未実装）
  };

  const handleFileUpload = () => {
    const fileInput = fileInputRef.current;
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      setSelectedFileName(fileInput.files[0].name);
    }
  };

  // AG Grid列定義
  const columnDefs: ColDef<DistributionRetailerData>[] = useMemo(
    () => [
      {
        headerName: '',
        // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
        suppressColumnsToolPanel: true,
        // 操作列（行のデータを持たない）のため field ではなく colId
        colId: 'detail',
        width: 64,
        cellRenderer: DetailButtonRenderer,
        sortable: false,
        filter: false,
        suppressMovable: true,
        resizable: false,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '商流販売店担当者',
        field: 'distributionRetailerManager',
        width: 160,
        wrapText: true,
        autoHeight: true,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '販売店',
        field: 'retailer',
        width: 144,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '販売店計上組織',
        field: 'retailerAccountingOrg',
        width: 128,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '三次店担当部署',
        field: 'tertiaryDepartment',
        width: 128,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '三次店担当者',
        field: 'tertiaryManager',
        width: 96,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '三次店',
        field: 'tertiaryStore',
        width: 224,
        wrapText: true,
        autoHeight: true,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '一次店',
        field: 'primaryStore',
        width: 224,
        wrapText: true,
        autoHeight: true,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '飲料事業区分',
        field: 'beverageDivision',
        width: 96,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: 'チャネル',
        field: 'channel',
        width: 112,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
    ],
    [DetailButtonRenderer]
  );

  // defaultColDef設定（共通の既定列設定。見出しのフィルタボタンは出さず、フィルタは右クリックで開く）
  const defaultColDef = useMemo<ColDef<DistributionRetailerData>>(
    () => ({
      // 共通の既定（行の型を持たない ColDef）を、この表の行の型の列設定として混ぜる
      ...(GRID_DEFAULT_COL_DEF as ColDef<DistributionRetailerData>),
      cellClass: 'cell-center',
    }),
    []
  );

  // 列幅・並び・ソートの状態を保存／復元する（→ 02 §7 列状態の永続化）
  const retailerGridColumnStateProps = useGridColumnState(
    '商流販売店マスタ.一覧.columnState'
  );
  return (
    <div className="min-w-300 h-full flex flex-col">
      <div className="px-6 pt-3 pb-3 flex-1 min-h-0 flex flex-col">
        {/* 画面名はヘッダー（システム名の右）に表示する */}
        <ScreenTitle title="商流販売店マスタ一覧" />
        {/* 検索条件の値は Ctrl+C／右クリック「コピー」で表示中の値をコピーできる（CopyableArea → 02 §15） */}
        <CopyableArea className="shrink-0">
          <CollapsibleCard
            title={
              <span className="flex items-center gap-2">
                <Search className="h-5 w-5 text-gray-700" />
                検索条件
              </span>
            }
            open={isOpen}
            onOpenChange={setIsOpen}
            // 画面が低くてもグリッドに押しつぶされないよう縮めない
            className="shrink-0"
            // クリアはヘッダーバーに置く（検索はリアルタイムのため検索ボタンは設けない）
            headerActions={<SearchClearButton onClick={handleClear} />}
            collapsedSummary={searchSummary || undefined}
          >
            <div className="px-4 py-1.5">
              {/* 一覧画面の検索条件は全画面共通の5列（→ 05 一覧画面の検索条件） */}
              <div className={SEARCH_GRID_CLASS}>
                {/* 部署1 */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="search-department1"
                    className={SEARCH_LABEL_CLASS}
                  >
                    部署1
                  </label>
                  <SingleCombobox
                    id="search-department1"
                    className="flex-1 min-w-0"
                    options={DEPARTMENT1_OPTIONS}
                    value={department1}
                    onChange={setDepartment1}
                    placeholder="指定なし"
                    clearable
                    searchable={false}
                  />
                </div>
                {/* 部署2 */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="search-department2"
                    className={SEARCH_LABEL_CLASS}
                  >
                    部署2
                  </label>
                  <SingleCombobox
                    id="search-department2"
                    className="flex-1 min-w-0"
                    options={DEPARTMENT2_OPTIONS}
                    value={department2}
                    onChange={setDepartment2}
                    placeholder="指定なし"
                    clearable
                    searchable={false}
                  />
                </div>
                {/* 営業担当者 */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="search-sales-rep"
                    className={SEARCH_LABEL_CLASS}
                  >
                    営業担当者
                  </label>
                  <SingleCombobox
                    id="search-sales-rep"
                    className="flex-1 min-w-0"
                    options={SALES_REP_OPTIONS}
                    value={salesRep}
                    onChange={setSalesRep}
                    placeholder="指定なし"
                    clearable
                    searchable={false}
                  />
                </div>
                {/* チャネル */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="search-channel"
                    className={SEARCH_LABEL_CLASS}
                  >
                    チャネル
                  </label>
                  <SingleCombobox
                    id="search-channel"
                    className="flex-1 min-w-0"
                    // 未選択＝「指定なし」（条件なし）。「全て」の選択肢は持たない（→ 02 §9）
                    options={CHANNEL_OPTIONS}
                    value={channel}
                    onChange={setChannel}
                    placeholder="指定なし"
                    clearable
                    searchable={false}
                  />
                </div>

                {/* 販売店（選択ペインは未実装） */}
                <div className="flex items-center gap-2">
                  <span className={SEARCH_LABEL_CLASS}>販売店</span>
                  <button
                    className="px-4 py-1 rounded-full bg-white text-blue-600 border-2 border-blue-600 font-medium hover:bg-blue-50 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm whitespace-nowrap"
                    onClick={handleRetailerSelect}
                    aria-label="販売店選択"
                  >
                    選択
                  </button>
                </div>
              </div>
            </div>
          </CollapsibleCard>
        </CopyableArea>

        {/* 一覧カード（fillParent でページの余り高さいっぱいまで広げ、折り畳み時は下限を外してヘッダーのみの高さへ戻す） */}
        <CollapsibleCard
          title="商流販売店マスタ一覧"
          fillParent
          className="data-[state=open]:min-h-95"
          contentClassName="p-2 flex flex-col flex-1 min-h-0"
        >
          <div className="flex-1 min-h-0 w-full">
            <AgGridReact<DistributionRetailerData>
              {...retailerGridColumnStateProps}
              {...GRID_BASE_PROPS}
              rowData={filteredData}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              getRowId={getRowId}
              getContextMenuItems={gridFilterContextMenuItems}
              domLayout="normal"
              rowSelection={{
                mode: 'multiRow',
                checkboxes: false,
                headerCheckbox: false,
                enableClickSelection: false,
              }}
              animateRows={true}
              statusBar={GRID_STATUS_BAR}
            />
          </div>
        </CollapsibleCard>

        {/* 商流販売店マスタ アップロードセクション */}
        <div className={`${CARD_CLASS} shrink-0 overflow-hidden`}>
          {/* タイトルヘッダー */}
          <div className="bg-white px-3 pt-2 pb-4 card-header-accent">
            <span className="text-gray-900 font-bold text-lg">
              商流販売店マスタ アップロード
            </span>
          </div>

          {/* アップロードコンテンツ */}
          <div className="p-4">
            <div className="flex items-center gap-2">
              {/* ファイル名表示領域と参照ボタン（連結） */}
              <div className="flex items-center">
                <Input
                  type="text"
                  value={selectedFileName}
                  readOnly
                  aria-label="選択したファイル名"
                  placeholder=""
                  className={`${TEXT_INPUT_CLASS} w-100 text-gray-900 border-r-0 rounded-r-none`}
                />
                <Button
                  variant="outline"
                  className="h-8 border-gray-400 text-gray-700 hover:bg-gray-50 rounded-l-none border-l"
                  onClick={() => fileInputRef.current?.click()}
                >
                  参照…
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setSelectedFileName(e.target.files[0].name);
                    }
                  }}
                />
              </div>

              {/* アップロードボタン */}
              <Button
                className="bg-blue-500 hover:bg-blue-600 text-white py-6 rounded-lg"
                onClick={handleFileUpload}
              >
                <Upload className="h-4 w-4 mr-2" />
                アップロード
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
