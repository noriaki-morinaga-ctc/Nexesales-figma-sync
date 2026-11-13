import React from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GetRowIdParams } from 'ag-grid-community';
import {
  Store,
  Box,
  FileText,
  SquareCheckBig,
  Bell,
  Download,
  Info,
} from 'lucide-react';

import { GRID_BASE_PROPS, GRID_COLORS } from '@/app/components/grid';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/app/components/ui/tabs';
import { CARD_TITLE_CLASS, CARD_CLASS } from '@/styles/commonStyles';
import { useAppNavigation } from '@/app/components/ui/use-app-navigation';

// ToDo・支払表の行ID（→ 画面設計標準 4.7）。各表の区分名 category は表内で一意かつ編集しない
const getRowId = (params: GetRowIdParams) => String(params.data.category);

export default function TopDashboard() {
  // 画面の切り替え（→ ui/use-app-navigation）
  const navigate = useAppNavigation();

  // 連絡情報のサンプルデータ
  const notifications = [
    {
      type: 'important',
      date: '2025/06/04 15:23',
      title: 'NEXTSALES　定期メンテナンスのお知らせ',
      description:
        '毎月最終木曜日 15:00～16:00の間、定期メンテナンス作業を行います。',
      action: { type: 'pdf', label: '詳細PDF' },
    },
    {
      type: 'notice',
      date: '2025/01/04 12:00',
      title: 'システムに関するお知らせ',
      description: '',
      action: { type: 'link', label: '詳細を確認する' },
    },
    {
      type: 'notice',
      date: '2024/12/11 15:20',
      title: 'サービス時間・問い合わせ先',
      description: '【サービス時間】7:30~23:00',
      action: { type: 'link', label: '詳細を確認する' },
    },
    {
      type: 'notice',
      date: '2024/12/11 15:20',
      title: 'サービス時間・問い合わせ先',
      description: '【サービス時間】7:30~23:00',
      action: { type: 'link', label: '詳細を確認する' },
    },
  ];

  // ToDo一覧のデータ（手売り）
  const todoData = [
    {
      category: '未登録未申請',
      jun: '719件',
      jul: '1661件',
      aug: '1963件',
      sep: '5835件',
    },
    {
      category: '部支店長承認待ち',
      jun: '586件',
      jul: '1839件',
      aug: '2058件',
      sep: '384件',
    },
    {
      category: '営業本部承認待ち',
      jun: '174件',
      jul: '487件',
      aug: '495件',
      sep: '76件',
    },
    {
      category: '本店承認待ち',
      jun: '274件',
      jul: '85件',
      aug: '63件',
      sep: '2件',
    },
    {
      category: '承認済',
      jun: '4817件',
      jul: '2439件',
      aug: '1932件',
      sep: '214件',
    },
    {
      category: '総件数',
      jun: '6547件',
      jul: '6511件',
      aug: '6511件',
      sep: '6511件',
    },
  ];

  // ToDo一覧のデータ（自販機）
  const todoDataVending = [
    {
      category: '未登録未申請',
      jun: '512件',
      jul: '1234件',
      aug: '1567件',
      sep: '4321件',
    },
    {
      category: '部支店長承認待ち',
      jun: '423件',
      jul: '1456件',
      aug: '1678件',
      sep: '298件',
    },
    {
      category: '営業本部承認待ち',
      jun: '134件',
      jul: '378件',
      aug: '421件',
      sep: '62件',
    },
    {
      category: '本店承認待ち',
      jun: '198件',
      jul: '67件',
      aug: '49件',
      sep: '1件',
    },
    {
      category: '承認済',
      jun: '3621件',
      jul: '1892件',
      aug: '1534件',
      sep: '167件',
    },
    {
      category: '総件数',
      jun: '4888件',
      jul: '5027件',
      aug: '5249件',
      sep: '4849件',
    },
  ];

  // 支払データ（手売り）
  const paymentData = [
    {
      category: '未登録未申請',
      jun: '432件',
      jul: '821件',
      aug: '956件',
      sep: '2134件',
    },
    {
      category: '部支店長承認待ち',
      jun: '298件',
      jul: '645件',
      aug: '782件',
      sep: '156件',
    },
    {
      category: '経理検印待ち',
      jun: '87件',
      jul: '234件',
      aug: '312件',
      sep: '43件',
    },
    {
      category: '経理検印済み',
      jun: '156件',
      jul: '52件',
      aug: '38件',
      sep: '1件',
    },
    {
      category: '総件数',
      jun: '3807件',
      jul: '3319件',
      aug: '3177件',
      sep: '2432件',
    },
  ];

  // 支払データ（自販機）
  const paymentDataVending = [
    {
      category: '未登録未申請',
      jun: '321件',
      jul: '654件',
      aug: '789件',
      sep: '1678件',
    },
    {
      category: '部支店長承認待ち',
      jun: '234件',
      jul: '512件',
      aug: '623件',
      sep: '123件',
    },
    {
      category: '経理検印待ち',
      jun: '67件',
      jul: '189件',
      aug: '245件',
      sep: '34件',
    },
    {
      category: '経理検印済み',
      jun: '123件',
      jul: '41件',
      aug: '29件',
      sep: '0件',
    },
    {
      category: '総件数',
      jun: '2987件',
      jul: '2621件',
      aug: '2534件',
      sep: '1912件',
    },
  ];

  // リンク表示が必要な行
  const linkableCategories = [
    '未登録未申請',
    '部支店長承認待ち',
    '営業本部承認待ち',
    '本店承認待ち',
    '経理検印待ち',
    '経理検印済み',
  ];

  // セルレンダラー：リンク表示
  const LinkCellRenderer = (props: any) => {
    const isLinkable = linkableCategories.includes(props.data.category);
    if (isLinkable) {
      return (
        <a
          href="#"
          className="text-blue-600 hover:text-blue-800 underline"
          onClick={(e) => {
            e.preventDefault();
            // 販売計画表の未登録未申請の6月分がクリックされた場合、販売計画一覧に遷移
            if (
              props.data.category === '未登録未申請' &&
              props.colDef.field === 'jun'
            ) {
              navigate('plan-list');
            }
          }}
        >
          {props.value}
        </a>
      );
    }
    return <span>{props.value}</span>;
  };

  // AgGrid列定義
  const columnDefs: ColDef[] = [
    {
      headerName: '販売計画',
      field: 'category',
      width: 136,
      cellClass: 'col-first',
      cellStyle: {
        backgroundColor: GRID_COLORS.salesCategoryBg,
        fontWeight: 'bold',
        justifyContent: 'flex-start',
      },
    },
    {
      headerName: '6月分',
      field: 'jun',
      flex: 1,
      minWidth: 80,
      cellRenderer: LinkCellRenderer,
      cellClass: 'cell-center',
      cellStyle: {
        backgroundColor: 'white',
      },
    },
    {
      headerName: '7月分',
      field: 'jul',
      flex: 1,
      minWidth: 80,
      cellRenderer: LinkCellRenderer,
      cellClass: 'cell-center',
      cellStyle: {
        backgroundColor: 'white',
      },
    },
    {
      headerName: '8月分',
      field: 'aug',
      flex: 1,
      minWidth: 80,
      cellRenderer: LinkCellRenderer,
      cellClass: 'cell-center',
      cellStyle: {
        backgroundColor: 'white',
      },
    },
    {
      headerName: '9月分',
      field: 'sep',
      flex: 1,
      minWidth: 80,
      cellRenderer: LinkCellRenderer,
      cellClass: 'cell-center',
      cellStyle: {
        backgroundColor: 'white',
      },
    },
  ];

  // 支払列定義
  const paymentColumnDefs: ColDef[] = [
    {
      headerName: '支払',
      field: 'category',
      width: 136,
      cellStyle: {
        backgroundColor: GRID_COLORS.paymentCategoryBg,
        fontWeight: 'bold',
        justifyContent: 'flex-start',
      },
    },
    {
      headerName: '6月分',
      field: 'jun',
      flex: 1,
      minWidth: 80,
      cellRenderer: LinkCellRenderer,
      cellClass: 'cell-center',
      cellStyle: {
        backgroundColor: 'white',
      },
    },
    {
      headerName: '7月分',
      field: 'jul',
      flex: 1,
      minWidth: 80,
      cellRenderer: LinkCellRenderer,
      cellClass: 'cell-center',
      cellStyle: {
        backgroundColor: 'white',
      },
    },
    {
      headerName: '8月分',
      field: 'aug',
      flex: 1,
      minWidth: 80,
      cellRenderer: LinkCellRenderer,
      cellClass: 'cell-center',
      cellStyle: {
        backgroundColor: 'white',
      },
    },
    {
      headerName: '9月分',
      field: 'sep',
      flex: 1,
      minWidth: 80,
      cellRenderer: LinkCellRenderer,
      cellClass: 'cell-center',
      cellStyle: {
        backgroundColor: 'white',
      },
    },
  ];

  return (
    <div className="min-w-300 h-full overflow-hidden">
      <div className="px-6 py-3 h-full flex flex-col overflow-hidden">
        {/* TOPからの遷移。解約の承認フローが支払と異なるため、ロケ契約(償却)一覧は
            支払メニューの配下ではなくこの画面を入口とする
            （→ 本コメントスレッド返信 宮澤 2026-07-21）。 */}
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('location-contract-amortization-list')}
            className="btn-toolbar-outline"
            aria-label="ロケ契約(償却)一覧へ移動"
          >
            <FileText className="h-4 w-4" />
            ロケ契約(償却)一覧
          </button>
          <span className="text-sm text-gray-600">
            長期（償却対象）のロケ契約の確認と解約の申請・承認を行います。
          </span>
        </div>
        <div className="grid grid-cols-10 gap-4 h-full overflow-hidden">
          {/* ToDo一覧セクション（左側6列） */}
          <div className="col-span-6 flex flex-col overflow-hidden border-r border-gray-200 pr-4">
            {/* アイコンとタイトルラベル */}
            <div className="flex items-center gap-2 mb-3">
              <SquareCheckBig
                className="h-5 w-5 text-gray-700"
                aria-hidden="true"
              />
              <h2 className={CARD_TITLE_CLASS}>ToDo一覧</h2>
            </div>

            {/* ToDo一覧テーブル */}
            {/* 規約例外（カードではない枠）：ToDo一覧カードの中でタブと表を囲む枠のため */}
            <div className="bg-white border border-gray-200 rounded-lg p-1 flex-1 overflow-hidden flex flex-col">
              <Tabs
                defaultValue="手売り"
                className="w-full flex-1 flex flex-col overflow-hidden"
              >
                <TabsList className="inline-flex mb-4 bg-transparent p-0 h-auto gap-1">
                  <TabsTrigger
                    value="手売り"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded"
                  >
                    <Store className="w-4 h-4" />
                    <span className="font-medium">手売り</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="自販機"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded"
                  >
                    <Box className="w-4 h-4" />
                    <span className="font-medium">自販機</span>
                  </TabsTrigger>
                </TabsList>

                {/* 手売りタブ */}
                <TabsContent value="手売り" className="flex-1 overflow-auto">
                  <div className="flex flex-col gap-4">
                    {/* 販売計画表 */}
                    <div className="flex flex-col">
                      <div className="flex justify-end mb-2"></div>
                      <div className="grid-unified grid-sales-plan ag-theme-quartz shadow-md">
                        {/* 規約例外（集計表）：状態・項目ごとの行が決まっている集計表で、列の幅・並び・並べ替えを変えられない（resizable・sortable・移動なし）ため、件数表示（statusBar）と列の状態の保存（useGridColumnState）は付けない */}
                        <AgGridReact
                          className="grid-summary-table"
                          rowData={todoData}
                          getRowId={getRowId}
                          columnDefs={columnDefs}
                          domLayout="autoHeight"
                          suppressMovableColumns={true}
                          {...GRID_BASE_PROPS}
                          suppressContextMenu={true}
                          defaultColDef={{
                            suppressHeaderMenuButton: true,
                            sortable: false,
                            resizable: false,
                          }}
                        />
                      </div>
                    </div>

                    {/* 支払表 */}
                    <div className="grid-unified grid-payment ag-theme-quartz shadow-md">
                      {/* 規約例外（集計表）：状態・項目ごとの行が決まっている集計表で、列の幅・並び・並べ替えを変えられない（resizable・sortable・移動なし）ため、件数表示（statusBar）と列の状態の保存（useGridColumnState）は付けない */}
                      <AgGridReact
                        className="grid-summary-table"
                        rowData={paymentData}
                        getRowId={getRowId}
                        columnDefs={paymentColumnDefs}
                        domLayout="autoHeight"
                        suppressMovableColumns={true}
                        {...GRID_BASE_PROPS}
                        suppressContextMenu={true}
                        defaultColDef={{
                          suppressHeaderMenuButton: true,
                          sortable: false,
                          resizable: false,
                        }}
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* 自販機タブ */}
                <TabsContent value="自販機" className="flex-1 overflow-auto">
                  <div className="flex flex-col gap-4">
                    {/* 販売計画表 */}
                    <div className="flex flex-col">
                      <div className="flex justify-end mb-2"></div>
                      <div className="grid-unified grid-sales-plan ag-theme-quartz">
                        {/* 規約例外（集計表）：状態・項目ごとの行が決まっている集計表で、列の幅・並び・並べ替えを変えられない（resizable・sortable・移動なし）ため、件数表示（statusBar）と列の状態の保存（useGridColumnState）は付けない */}
                        <AgGridReact
                          className="grid-summary-table"
                          rowData={todoDataVending}
                          getRowId={getRowId}
                          columnDefs={columnDefs}
                          domLayout="autoHeight"
                          suppressMovableColumns={true}
                          {...GRID_BASE_PROPS}
                          suppressContextMenu={true}
                          defaultColDef={{
                            suppressHeaderMenuButton: true,
                            sortable: false,
                            resizable: false,
                          }}
                        />
                      </div>
                    </div>

                    {/* 支払表 */}
                    <div className="grid-unified grid-payment ag-theme-quartz">
                      {/* 規約例外（集計表）：状態・項目ごとの行が決まっている集計表で、列の幅・並び・並べ替えを変えられない（resizable・sortable・移動なし）ため、件数表示（statusBar）と列の状態の保存（useGridColumnState）は付けない */}
                      <AgGridReact
                        className="grid-summary-table"
                        rowData={paymentDataVending}
                        getRowId={getRowId}
                        columnDefs={paymentColumnDefs}
                        domLayout="autoHeight"
                        suppressMovableColumns={true}
                        {...GRID_BASE_PROPS}
                        suppressContextMenu={true}
                        defaultColDef={{
                          suppressHeaderMenuButton: true,
                          sortable: false,
                          resizable: false,
                        }}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* お知らせセクション（右側4列） */}
          <div className="col-span-4 flex flex-col overflow-hidden">
            {/* アイコンとタイトルラベル */}
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-5 w-5 text-gray-700" aria-hidden="true" />
              <h2 className={CARD_TITLE_CLASS}>お知らせ</h2>
            </div>

            {/* お知らせカード一覧 */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {notifications.map((notification, index) => (
                <div key={index} className={`${CARD_CLASS} p-4`}>
                  {/* バッジと日時 */}
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-bold text-white ${notification.type === 'important' ? 'bg-orange-700' : 'bg-green-700'}`}
                    >
                      {notification.type === 'important' ? '重要' : 'お知らせ'}
                    </span>
                    <span className="text-sm text-gray-600">
                      {notification.date}
                    </span>
                  </div>

                  {/* タイトル */}
                  <h3 className="text-lg font-bold mb-2 text-blue-900">
                    {notification.title}
                  </h3>

                  {/* 説明 */}
                  <p className="text-sm text-gray-600 mb-3">
                    {notification.description}
                  </p>

                  {/* アクション */}
                  <div className="flex justify-end">
                    <a
                      href="#"
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                      onClick={(e) => {
                        e.preventDefault();
                        // TODO: お知らせのアクション（PDF表示・画面遷移）は未実装
                      }}
                    >
                      {notification.action.type === 'pdf' && (
                        <Download className="h-4 w-4" aria-hidden="true" />
                      )}
                      {notification.action.type === 'link' && (
                        <Info className="h-4 w-4" aria-hidden="true" />
                      )}
                      {notification.action.label}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
