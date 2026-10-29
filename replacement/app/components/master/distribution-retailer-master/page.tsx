import { CopyableArea } from '../../ui/copyable-area';
import {
  buildSearchSummary,
  formatSummaryValue,
} from '../../ui/search-summary';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../ui/collapsible';
import { ChevronDown, RotateCcw, Upload } from 'lucide-react';
import { useState, useMemo, useRef } from 'react';
import { SingleCombobox } from '../../ui/single-combobox';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { TEXT_INPUT_CLASS } from '../../../../styles/commonStyles';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, GetRowIdParams } from 'ag-grid-community';
import {
  GRID_BASE_PROPS,
  GRID_DEFAULT_COL_DEF,
  gridFilterContextMenuItems,
} from '../../grid';
import { ScreenTitle } from '../../ui/screen-title';

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

interface DistributionRetailerMasterProps {
  onMenuChange?: (menuId: string) => void;
}

// サンプルデータ生成用の基本データ
const departments = [
  '北海道支社営業一部',
  '北海道支社営業二部',
  '北海道支社営業三部',
  '東北支社営業一部',
  '関東支社営業一部',
];
const managers = [
  '平山 智己',
  '二階堂 拓哉',
  '竹原 幸奈',
  '田中 太郎',
  '鈴木 花子',
  '佐藤 次郎',
  '山田 花子',
  '高橋 一郎',
];
const retailers = [
  '21102278:ホーマック',
  '21102279:コープさっぽろ',
  '21102280:イオン北海道',
  '21102281:ツルハドラッグ',
  '21102282:サツドラ',
];
const tertiaryStores = [
  '10760813:国分北海道株式会社恵庭流通センター',
  '10760814:国分北海道株式会社札幌流通センター',
  '10760815:国分北海道株式会社旭川流通センター',
  '10760816:三菱食品株式会社北海道支社',
  '10760817:日本アクセス北海道株式会社',
];
const primaryStores = [
  '10888833:国分北海道株式会社経理財務部 経理財務課',
  '10888834:国分北海道株式会社営業企画部',
  '10888835:三菱食品株式会社営業本部',
  '10888836:日本アクセス株式会社営業統括部',
];
const beverageDivisions = ['CA', 'CB', 'CC', 'CD'];
const channels = [
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
    const deptIndex = (i - 1) % departments.length;
    const managerIndex = (i - 1) % managers.length;
    const retailerIndex = (i - 1) % retailers.length;
    const tertiaryIndex = (i - 1) % tertiaryStores.length;
    const primaryIndex = (i - 1) % primaryStores.length;
    const beverageIndex = (i - 1) % beverageDivisions.length;
    const channelIndex = (i - 1) % channels.length;

    data.push({
      id: String(i),
      distributionRetailerManager: `${departments[deptIndex]}／${managers[managerIndex]}`,
      retailer: retailers[retailerIndex],
      retailerAccountingOrg: departments[deptIndex],
      tertiaryDepartment: departments[(deptIndex + 1) % departments.length],
      tertiaryManager: managers[(managerIndex + 1) % managers.length],
      tertiaryStore: tertiaryStores[tertiaryIndex],
      primaryStore: primaryStores[primaryIndex],
      beverageDivision: beverageDivisions[beverageIndex],
      channel: channels[channelIndex],
    });
  }

  return data;
}

export default function DistributionRetailerMaster({
  onMenuChange,
}: DistributionRetailerMasterProps) {
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

  // 詳細ボタンレンダラー
  const DetailButtonRenderer = (props: any) => {
    return (
      <div className="flex items-center h-full">
        <button
          className="px-4 py-1 rounded-full bg-white text-blue-600 border-2 border-blue-600 font-medium hover:bg-blue-50 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm whitespace-nowrap"
          onClick={() => handleDetail(props.data)}
          aria-label="編集"
        >
          編集
        </button>
      </div>
    );
  };

  const handleDetail = (data: DistributionRetailerData) => {
    console.log('詳細クリック:', data);
    // 商流販売店マスタ詳細画面に遷移
    if (onMenuChange) {
      onMenuChange('distribution-retailer-detail');
    }
  };

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
    console.log('販売店選択');
  };

  const handleFileUpload = () => {
    const fileInput = fileInputRef.current;
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      setSelectedFileName(fileInput.files[0].name);
      console.log('ファイルアップロード:', fileInput.files[0].name);
    }
  };

  // AG Grid列定義
  const columnDefs: ColDef<DistributionRetailerData>[] = useMemo(
    () => [
      {
        headerName: '',
        field: 'detail',
        width: 80,
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
        width: 200,
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
        width: 180,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '販売店計上組織',
        field: 'retailerAccountingOrg',
        width: 160,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '三次店担当部署',
        field: 'tertiaryDepartment',
        width: 160,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '三次店担当者',
        field: 'tertiaryManager',
        width: 120,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '三次店',
        field: 'tertiaryStore',
        width: 280,
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
        width: 280,
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
        width: 120,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: 'チャネル',
        field: 'channel',
        width: 140,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
    ],
    []
  );

  // defaultColDef設定（共通の既定列設定。見出しのフィルタボタンは出さず、フィルタは右クリックで開く）
  const defaultColDef = useMemo<ColDef<DistributionRetailerData>>(
    () => ({
      ...GRID_DEFAULT_COL_DEF,
      cellStyle: {
        lineHeight: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      },
    }),
    []
  );

  return (
    <div className="min-w-[120rem]">
      <div className="px-6 py-3">
        {/* 画面名はヘッダー（システム名の右）に表示する */}
        <ScreenTitle title="商流販売店マスタ一覧" />
        {/* 検索条件の値は Ctrl+C／右クリック「コピー」で表示中の値をコピーできる（CopyableArea → 02 §15） */}
        <CopyableArea>
          <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-[1.5rem]"
          >
            {/* タイトルヘッダー */}
            <div className="bg-white px-[0.75rem] pt-[0.5rem] pb-[1rem] card-header-accent">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-gray-900 font-bold text-lg">
                    商流販売店マスタ一覧
                  </span>
                </div>
                {/* 折り畳んでいる間だけ、値が入っている検索条件を1行で出す（CollapsibleCard の collapsedSummary と同じ体裁） */}
                {!isOpen && searchSummary && (
                  <span
                    className="ml-4 min-w-0 flex-1 truncate text-sm text-gray-700"
                    title={searchSummary}
                  >
                    {searchSummary}
                  </span>
                )}

                <CollapsibleTrigger className="hover:text-blue-700 transition-colors">
                  <ChevronDown
                    className={`h-[1.25rem] w-[1.25rem] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </CollapsibleTrigger>
              </div>
            </div>

            <CollapsibleContent>
              <div className="bg-white px-[0.75rem] pt-[0.5rem] pb-[1rem]">
                <div className="text-gray-900 font-bold text-lg mb-[0.75rem]">
                  検索条件
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-[1rem]">
                  {/* 1行目: 部署1、部署2、営業担当者 */}
                  <div className="flex items-center flex-wrap gap-[0.5rem] mb-[0.625rem]">
                    {/* 部署1 */}
                    <div className="flex items-center gap-[0.25rem]">
                      <label className="text-sm text-blue-900 whitespace-nowrap font-bold w-[6.25rem]">
                        部署1
                      </label>
                      <SingleCombobox
                        className="w-[10rem]"
                        options={DEPARTMENT1_OPTIONS}
                        value={department1}
                        onChange={setDepartment1}
                        placeholder="指定なし"
                        clearable
                        searchable={false}
                      />
                    </div>

                    {/* 部署2 */}
                    <div className="flex items-center gap-[0.25rem] ml-[1.25rem]">
                      <label className="text-sm text-blue-900 whitespace-nowrap font-bold w-[6.25rem]">
                        部署2
                      </label>
                      <SingleCombobox
                        className="w-[10rem]"
                        options={DEPARTMENT2_OPTIONS}
                        value={department2}
                        onChange={setDepartment2}
                        placeholder="指定なし"
                        clearable
                        searchable={false}
                      />
                    </div>

                    {/* 営業担当者 */}
                    <div className="flex items-center gap-[0.25rem] ml-[1.25rem]">
                      <label className="text-sm text-blue-900 whitespace-nowrap font-bold w-[6.25rem]">
                        営業担当者
                      </label>
                      <SingleCombobox
                        className="w-[10rem]"
                        options={SALES_REP_OPTIONS}
                        value={salesRep}
                        onChange={setSalesRep}
                        placeholder="指定なし"
                        clearable
                        searchable={false}
                      />
                    </div>
                  </div>

                  {/* 2行目: チャネル、販売店 */}
                  <div className="flex items-center gap-[0.5rem] mb-[0.625rem]">
                    {/* チャネル */}
                    <div className="flex items-center gap-[0.25rem]">
                      <label className="text-sm text-blue-900 whitespace-nowrap font-bold w-[6.25rem]">
                        チャネル
                      </label>
                      <SingleCombobox
                        className="w-[10rem]"
                        // 未選択＝「指定なし」（条件なし）。「全て」の選択肢は持たない（→ 02 §9）
                        options={CHANNEL_OPTIONS}
                        value={channel}
                        onChange={setChannel}
                        placeholder="指定なし"
                        clearable
                        searchable={false}
                      />
                    </div>

                    {/* 販売店 */}
                    <div className="flex items-center gap-[0.25rem] ml-[1.25rem]">
                      <label className="text-sm text-blue-900 whitespace-nowrap font-bold w-[6.25rem]">
                        販売店
                      </label>
                      <button
                        className="px-4 py-1 rounded-full bg-white text-blue-600 border-2 border-blue-600 font-medium hover:bg-blue-50 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm whitespace-nowrap"
                        onClick={handleRetailerSelect}
                        aria-label="販売店選択"
                      >
                        選択
                      </button>
                    </div>
                  </div>

                  {/* クリアボタン（検索はリアルタイムのため検索ボタンは設けない） */}
                  <div className="flex justify-end gap-[0.5rem]">
                    <Button
                      variant="outline"
                      className="border-gray-300 text-gray-700 hover:bg-gray-50 py-6 rounded-lg"
                      onClick={handleClear}
                    >
                      <RotateCcw className="h-[1rem] w-[1rem] mr-[0.5rem]" />
                      クリア
                    </Button>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CopyableArea>

        {/* 商流販売店マスタ一覧テーブル */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-[1.5rem]">
          <div className="p-[1rem]">
            <div
              className="sales-plan-list-grid"
              style={{ height: '25rem', width: '100%' }}
            >
              <AgGridReact<DistributionRetailerData>
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
                // selectionColumnDef={{
                //width: 60,
                //minWidth: 60,
                //maxWidth: 60,
                //resizable: false,
                //suppressMovable: true,
                //}}
                animateRows={true}
              />
            </div>
          </div>
        </div>

        {/* 商流販売店マスタ アップロードセクション */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-[1.5rem]">
          {/* タイトルヘッダー */}
          <div className="bg-white px-[0.75rem] pt-[0.5rem] pb-[1rem] card-header-accent">
            <span className="text-gray-900 font-bold text-lg">
              商流販売店マスタ アップロード
            </span>
          </div>

          {/* アップロードコンテンツ */}
          <div className="p-[1rem]">
            <div className="flex items-center gap-[0.5rem]">
              {/* ファイル名表示領域と参照ボタン（連結） */}
              <div className="flex items-center">
                <Input
                  type="text"
                  value={selectedFileName}
                  readOnly
                  placeholder=""
                  className={`${TEXT_INPUT_CLASS} w-[25rem] text-gray-900 border-r-0 rounded-r-none`}
                />
                <Button
                  variant="outline"
                  className="h-[2rem] border-gray-400 text-gray-700 hover:bg-gray-50 rounded-l-none border-l"
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
                <Upload className="h-[1rem] w-[1rem] mr-[0.5rem]" />
                アップロード
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
