import { Search } from 'lucide-react';
import { useState, useMemo } from 'react';
import 'ag-grid-enterprise';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, GetRowIdParams } from 'ag-grid-community';
import { toast } from 'sonner';

import { CopyableArea } from '@/components/ui/copyable-area';
import { Button } from '@/components/ui/button';
import {
  SEARCH_GRID_CLASS,
  SEARCH_LABEL_CLASS,
  BUTTON_STYLES,
  BUTTON_BASE,
} from '@/styles/commonStyles';
import {
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  withHeaderTooltips,
  gridFilterContextMenuItems,
  useGridColumnState,
  GRID_MONTH_TEXT_FILTER,
} from '@/components/grid';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SingleCombobox } from '@/components/ui/single-combobox';
import { summaryProductComboOptions } from '@/constants/comboFieldOptions';
import { RequiredBadge } from '@/components/ui/required-badge';
import { RightPane } from '@/components/ui/right-pane';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { SearchClearButton } from '@/components/ui/search-clear-button';
import {
  buildSearchSummary,
  formatSummaryValue,
} from '@/components/ui/search-summary';
import { ScreenTitle } from '@/components/ui/screen-title';

import { generateSampleData } from '@/mocks/master/managed-product-list';
import type { ProductTargetData } from './managedProductList.types';
import { EMPTY_TARGET_FORM, INITIAL_SEARCH_FILTERS } from './constants';
import { isAreaOverlapped } from './utils';
import { ActionsCellRenderer } from './components/ActionsCellRenderer';

// 一覧グリッドの行ID（→ 画面設計標準 4.7）。サンプルデータの id、新規登録行は登録時に採番した id を使う
const getRowId = (params: GetRowIdParams<ProductTargetData>) => params.data.id;

export default function ManagedProductList() {
  // 検索条件の状態管理。計画一覧・計画一覧(管理対象商品)と同様にリアルタイム検索とし、
  // この状態を直接 filteredData のフィルタ条件に用いる（検索ボタンは廃止）。
  const [productCategory, setProductCategory] = useState(
    INITIAL_SEARCH_FILTERS.productCategory
  );
  const [summaryProduct, setSummaryProduct] = useState(
    INITIAL_SEARCH_FILTERS.summaryProduct
  );
  const [targetArea, setTargetArea] = useState(
    INITIAL_SEARCH_FILTERS.targetArea
  );
  const [startMonth, setStartMonth] = useState(
    INITIAL_SEARCH_FILTERS.startMonth
  );
  const [endMonth, setEndMonth] = useState(INITIAL_SEARCH_FILTERS.endMonth);

  // 検索条件を初期値（既定値）へ戻す。一覧のデータ自体は変更しない。
  const handleClear = () => {
    setProductCategory(INITIAL_SEARCH_FILTERS.productCategory);
    setSummaryProduct(INITIAL_SEARCH_FILTERS.summaryProduct);
    setTargetArea(INITIAL_SEARCH_FILTERS.targetArea);
    setStartMonth(INITIAL_SEARCH_FILTERS.startMonth);
    setEndMonth(INITIAL_SEARCH_FILTERS.endMonth);
  };

  // 右ペインとダイアログの状態管理
  const [isPaneOpen, setIsPaneOpen] = useState(false);
  const [paneMode, setPaneMode] = useState<'create' | 'edit'>('create');
  const [selectedData, setSelectedData] = useState<ProductTargetData | null>(
    null
  );

  // フォームの状態管理
  const [formData, setFormData] = useState({ ...EMPTY_TARGET_FORM });

  // サンプルデータ
  const [rowData, setRowData] =
    useState<ProductTargetData[]>(generateSampleData());

  // サマリ商品の選択肢（検索条件・登録/更新ペイン共通）。
  // 一覧が保持する値から重複を除いて生成し、共通ビルダーで「名称＋商品コード」の
  // 2行表示にする（§9）。登録で追加した値もそのまま選択肢に載る。
  const summaryProductOptions = useMemo(
    () =>
      summaryProductComboOptions(
        Array.from(new Set(rowData.map((row) => row.summaryProduct)))
      ),
    [rowData]
  );

  // 検索条件カードを折り畳んだときに見出しの行へ出す要約（値が入っている項目だけ。UI/UX UX-024）
  const searchSummary = buildSearchSummary([
    { label: '商品区分', value: productCategory },
    {
      label: 'サマリ商品',
      value: formatSummaryValue(summaryProduct, summaryProductOptions),
    },
    { label: '管理対象エリア', value: targetArea },
    { label: '管理対象開始月', value: startMonth },
    { label: '管理対象終了月', value: endMonth },
  ]);

  // 参考商品の選択肢（登録/更新ペイン用）。サマリ商品と同じく一覧の実値から生成する。
  const referenceProductOptions = useMemo(
    () =>
      summaryProductComboOptions(
        Array.from(new Set(rowData.map((row) => row.referenceProduct)))
      ),
    [rowData]
  );

  // フィルタリングされたデータ
  const filteredData = useMemo(() => {
    return rowData.filter((row) => {
      // 商品区分フィルタ
      if (productCategory && row.productCategory !== productCategory) {
        return false;
      }

      // サマリ商品フィルタ（コンボボックスで選んだ1件と完全一致。未選択は絞り込みなし）
      if (summaryProduct && row.summaryProduct !== summaryProduct) {
        return false;
      }

      // 管理対象エリアフィルタ
      // 検索条件のエリアが、データのエリア指定に含まれているかチェック
      if (targetArea) {
        // データのエリアをカンマで分割して配列に変換
        const dataAreas = row.targetArea.split(',').map((area) => area.trim());

        // 検索条件のエリアがデータのエリアリストに含まれているかチェック
        if (!dataAreas.includes(targetArea)) {
          return false;
        }
      }

      // 管理対象月フィルタ（期間が重なるデータを表示）。
      // 開始月・終了月とも×でクリアできるため、指定されている側だけ判定する。
      const dataStart = row.targetStartMonth.replace('/', '');
      const dataEnd = row.targetEndMonth.replace('/', '');
      // 開始月のみ指定：開始月以降も管理対象のデータ
      if (startMonth && dataEnd < startMonth.replace('/', '')) {
        return false;
      }
      // 終了月のみ指定：終了月までに管理対象が始まっているデータ
      if (endMonth && dataStart > endMonth.replace('/', '')) {
        return false;
      }

      return true;
    });
  }, [
    rowData,
    productCategory,
    summaryProduct,
    targetArea,
    startMonth,
    endMonth,
  ]);

  // カラム定義
  const columnDefs: ColDef<ProductTargetData>[] = useMemo(
    () => [
      {
        headerName: '商品区分',
        field: 'productCategory',
        width: 96,
        filter: true,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      // サマリ商品・参考商品は flex で残り幅を按分し、管理対象エリアと操作列の間に
      // 余白が出ないようにする（AG Grid 公式の flex。固定幅列とは併用可能）。
      // minWidth は従来の固定幅と同値のため、幅が足りない場合の見え方は従来どおり。
      {
        headerName: 'サマリ商品',
        field: 'summaryProduct',
        flex: 1,
        suppressAutoSize: true, // 残りの幅に広げる列のため自動調整から外す（flex を保つ）
        minWidth: 280,
        filter: true,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '参考商品',
        field: 'referenceProduct',
        flex: 1,
        suppressAutoSize: true, // 残りの幅に広げる列のため自動調整から外す（flex を保つ）
        minWidth: 280,
        filter: true,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '管理対象開始月',
        field: 'targetStartMonth',
        ...GRID_MONTH_TEXT_FILTER,
        width: 120,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '管理対象終了月',
        field: 'targetEndMonth',
        ...GRID_MONTH_TEXT_FILTER,
        width: 120,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '管理対象エリア',
        field: 'targetArea',
        width: 120,
        filter: true,
        cellStyle: {
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
        },
      },
      {
        headerName: '',
        // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
        suppressColumnsToolPanel: true,
        colId: 'actions',
        width: 64,
        pinned: 'right',
        lockPinned: true,
        cellRenderer: ActionsCellRenderer,
        sortable: false,
        filter: false,
        resizable: false,
        cellClass: 'cell-center',
      },
    ],
    []
  );

  // defaultColDef設定
  // 共通の defaultColDef（GRID_DEFAULT_COL_DEF）をそのまま使用する。
  // 列の高さ・セル背景色・文字サイズ・文字フォントは共通テーマ GRID_THEME に一任し、
  // 画面独自の cellStyle で上書きしない（画面設計標準）。
  // ※ ヘッダーのフィルター／列メニューボタン非表示・セル値ツールチップは
  //   GRID_DEFAULT_COL_DEF に内包（フィルターは右クリックメニューから開く）。
  const defaultColDef = useMemo(
    () => ({ ...GRID_DEFAULT_COL_DEF }) as ColDef<ProductTargetData>,
    []
  );

  // 列状態（列幅・並び順・ソート等）を localStorage へ保存／復元する（共通フック）。
  // 列を flex 化した際にキーを更新している。旧キーのまま流用すると、保存済みの
  // 固定幅が applyColumnState で復元され flex レイアウトが無効化されるため。
  const gridColumnStateProps = useGridColumnState(
    'ManagedProductList.targetGrid.columnState.v2'
  );

  // ヘッダーのツールチップ（列幅で省略された見出しの全文表示）を付与した列定義。
  const columnDefsWithTooltips = useMemo(
    () => withHeaderTooltips(columnDefs),
    [columnDefs]
  );

  // 更新ハンドラ
  const handleEdit = (data: ProductTargetData) => {
    setSelectedData(data);
    const areas = data.targetArea.split(', ');
    const isNationwide = areas.includes('全国');
    setFormData({
      productCategory: data.productCategory,
      summaryProduct: data.summaryProduct,
      referenceProduct: data.referenceProduct,
      targetStartMonth: data.targetStartMonth,
      targetEndMonth: data.targetEndMonth,
      areaType: isNationwide ? '全国' : 'エリア指定',
      targetArea: isNationwide ? [] : areas,
    });
    setPaneMode('edit');
    // 削除ペインが開いていれば閉じる（右ペインは同時に1つだけ）
    setIsPaneOpen(true);
  };

  // 右ペインは同時に1つだけ開く（計画詳細(マージン率固定・NET入力)と同方針）
  const closeAllRightPanes = () => {
    setIsPaneOpen(false);
  };

  // 削除する（確認は出さず、削除したことをトーストで知らせる → 02 §5）
  const handleDeleteClick = (data: ProductTargetData) => {
    setRowData((prev) => prev.filter((row) => row.id !== data.id));
    toast.success('データを削除しました');
  };

  // 新規登録ハンドラ
  const handleAddRow = () => {
    setSelectedData(null);
    setFormData({ ...EMPTY_TARGET_FORM });
    setPaneMode('create');
    // 削除ペインが開いていれば閉じる（右ペインは同時に1つだけ）
    setIsPaneOpen(true);
  };

  // 保存ハンドラ
  // continuous=true（連続追加）はペインを開いたままフォームを初期化する
  const handleSave = (continuous = false) => {
    // バリデーション
    if (!formData.productCategory || !formData.summaryProduct) {
      toast.error('商品区分とサマリ商品は必須です');
      return;
    }

    if (!formData.referenceProduct) {
      toast.error('参考商品は必須です');
      return;
    }

    if (!formData.targetStartMonth || !formData.targetEndMonth) {
      toast.error('管理対象期間は必須です');
      return;
    }

    // 開始月 ≤ 終了月チェック
    const start = formData.targetStartMonth.replace('/', '');
    const end = formData.targetEndMonth.replace('/', '');
    if (start > end) {
      toast.error('管理対象開始は管理対象終了以前である必要があります');
      return;
    }

    if (!formData.areaType) {
      toast.error('管理対象エリアは全国またはエリア指定を選択してください');
      return;
    }

    if (
      formData.areaType === 'エリア指定' &&
      formData.targetArea.length === 0
    ) {
      toast.error(
        'エリア指定を選択した場合は、最低1つの支社を選択してください'
      );
      return;
    }

    // 期間重複チェック（同一サマリ商品かつ管理対象エリアが重複する場合のみ）
    const currentArea =
      formData.areaType === '全国' ? '全国' : formData.targetArea.join(', ');

    const duplicateCheck = rowData.some((row) => {
      // 更新時は自分自身を除外
      if (paneMode === 'edit' && row.id === selectedData?.id) {
        return false;
      }

      // 同じサマリ商品でない場合はスキップ
      if (row.summaryProduct !== formData.summaryProduct) {
        return false;
      }

      // エリアが重複しない場合は期間が重なっても許容する
      if (!isAreaOverlapped(currentArea, row.targetArea)) {
        return false;
      }

      const rowStart = row.targetStartMonth.replace('/', '');
      const rowEnd = row.targetEndMonth.replace('/', '');

      // 期間が重なるかチェック
      return start <= rowEnd && end >= rowStart;
    });

    if (duplicateCheck) {
      toast.error(
        '同一サマリ商品・同一管理対象エリアで管理対象期間が重複しています'
      );
      return;
    }

    if (paneMode === 'create') {
      const newData: ProductTargetData = {
        id: String(Date.now()),
        productCategory: formData.productCategory,
        summaryProduct: formData.summaryProduct,
        metaBrand: '',
        referenceProduct: formData.referenceProduct,
        targetStartMonth: formData.targetStartMonth,
        targetEndMonth: formData.targetEndMonth,
        targetArea:
          formData.areaType === '全国'
            ? '全国'
            : formData.targetArea.join(', '),
      };
      setRowData([...rowData, newData]);
      toast.success('データを登録しました');
      // 連続追加：ペインを閉じずにフォームを初期化し、次の入力に備える
      if (continuous) {
        setFormData({ ...EMPTY_TARGET_FORM });
        return;
      }
    } else {
      setRowData(
        rowData.map((row) =>
          row.id === selectedData?.id
            ? {
                ...row,
                productCategory: formData.productCategory,
                summaryProduct: formData.summaryProduct,
                metaBrand: row.metaBrand,
                referenceProduct: formData.referenceProduct,
                targetStartMonth: formData.targetStartMonth,
                targetEndMonth: formData.targetEndMonth,
                targetArea:
                  formData.areaType === '全国'
                    ? '全国'
                    : formData.targetArea.join(', '),
              }
            : row
        )
      );
      toast.success('データを更新しました');
    }
    setIsPaneOpen(false);
  };

  // 支社チェックボックスハンドラ
  const handleAreaChange = (area: string, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        targetArea: [...formData.targetArea, area],
      });
    } else {
      setFormData({
        ...formData,
        targetArea: formData.targetArea.filter((a) => a !== area),
      });
    }
  };

  return (
    <div className="min-w-300 relative overflow-hidden h-full">
      {/* メインコンテンツエリア（右ペインは RightPane のオーバーレイ表示のため
          グリッドは押し出さず全幅のまま。販売計画表(商流紐づけなし)と同一挙動） */}
      {/* ページ自体はスクロールさせず、下端の一覧カード内のグリッドだけをスクロールさせる。
          高さの固定値をやめて「タイトル・検索条件を引いた残り」をグリッドへ割り当て、
          横スクロールバーが画面外へ押し出されないようにする（支払一覧と同じ構成）。
          画面が低く下限 23.75rem を割り込む場合は、はみ出した分だけこの領域がスクロールする。 */}
      <div className="overflow-x-auto overflow-y-auto h-full flex flex-col">
        <div className="px-6 pt-3 pb-3 min-w-300 flex-1 min-h-0 flex flex-col">
          {/* 画面名はヘッダー（システム名の右）に表示する */}
          <ScreenTitle title="管理対象商品一覧" />

          {/* 検索条件カード（計画詳細(マージン率固定・NET入力)と同じ折り畳みカード）。
              ヘッダーバーの黄色帯（card-header-accent）は CollapsibleCard 側が担う。 */}
          {/* 検索条件の値は Ctrl+C／右クリック「コピー」で表示中の値をコピーできる（CopyableArea → 02 §15） */}
          <CopyableArea className="shrink-0">
            <CollapsibleCard
              title={
                <span className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-gray-700" />
                  検索条件
                </span>
              }
              // 画面が低くてもグリッドに押しつぶされないよう縮めない（足りない分は画面側がスクロールする）
              className="shrink-0"
              // クリアボタンはヘッダーバーに置く（計画一覧と同一体裁。検索はリアルタイムのため検索ボタンは廃止）
              headerActions={<SearchClearButton onClick={handleClear} />}
              collapsedSummary={searchSummary}
            >
              <div className="px-4 py-1.5">
                {/* 一覧画面の検索条件は全画面共通の5列（→ 05 一覧画面の検索条件）。
                    1行目: 商品区分、サマリ商品、管理対象エリア／2行目: 管理対象開始月、管理対象終了月 */}
                <div className={SEARCH_GRID_CLASS}>
                  {/* 商品区分 */}
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="search-product-category"
                      className={SEARCH_LABEL_CLASS}
                    >
                      商品区分
                    </label>
                    <SingleCombobox
                      id="search-product-category"
                      className="min-w-0 flex-1"
                      options={[
                        { value: '新商品', label: '新商品' },
                        { value: '重点商品', label: '重点商品' },
                        { value: '自販機専用商品', label: '自販機専用商品' },
                      ]}
                      value={productCategory}
                      onChange={setProductCategory}
                      // 未選択＝「指定なし」（条件なし）。「すべて」の選択肢は持たない（→ 02 §9）
                      placeholder="指定なし"
                      clearable
                      searchable={false}
                    />
                  </div>

                  {/* サマリ商品（検索付き単一選択コンボボックス。任意条件のため clearable） */}
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="search-summary-product"
                      className={SEARCH_LABEL_CLASS}
                    >
                      サマリ商品
                    </label>
                    <div className="min-w-0 flex-1">
                      <SingleCombobox
                        id="search-summary-product"
                        options={summaryProductOptions}
                        value={summaryProduct}
                        onChange={setSummaryProduct}
                        placeholder="指定なし"
                        clearable
                      />
                    </div>
                  </div>

                  {/* 管理対象エリア */}
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="search-target-area"
                      className={SEARCH_LABEL_CLASS}
                    >
                      管理対象エリア
                    </label>
                    <SingleCombobox
                      id="search-target-area"
                      className="min-w-0 flex-1"
                      options={[
                        { value: '全国', label: '全国' },
                        { value: '首都圏本部', label: '首都圏本部' },
                        { value: '関東本部', label: '関東本部' },
                        { value: '中部北陸本部', label: '中部北陸本部' },
                        { value: '近畿圏本部', label: '近畿圏本部' },
                        { value: '北海道支社', label: '北海道支社' },
                        { value: '東北支社', label: '東北支社' },
                        { value: '中四国支社', label: '四国支社' },
                        { value: '九州支社', label: '九州支社' },
                      ]}
                      value={targetArea}
                      onChange={setTargetArea}
                      placeholder="指定なし"
                      clearable
                      searchable={false}
                    />
                  </div>

                  {/* 2行目: 管理対象開始月（行の先頭は col-start-1） */}
                  <div className="flex items-center gap-2 col-start-1">
                    <label className={SEARCH_LABEL_CLASS}>管理対象開始月</label>
                    {/* 検索条件の年月も入力欄の幅いっぱいにする（全項目一律の幅 → 05） */}
                    <div className="flex min-w-0 flex-1">
                      <MonthYearPicker
                        className="w-full"
                        value={startMonth}
                        onChange={setStartMonth}
                        required={false}
                        clearable
                      />
                    </div>
                  </div>

                  {/* 管理対象終了月 */}
                  <div className="flex items-center gap-2">
                    <label className={SEARCH_LABEL_CLASS}>管理対象終了月</label>
                    <div className="flex min-w-0 flex-1">
                      <MonthYearPicker
                        className="w-full"
                        value={endMonth}
                        onChange={setEndMonth}
                        required={false}
                        clearable
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleCard>
          </CopyableArea>

          {/* データ一覧カード（計画一覧(管理対象商品)と同じ折り畳みカード）。
              登録ボタンはヘッダーバー（headerActions）へ配置する。
              fillParent でページの余り高さいっぱいまで広げ、折り畳み時は下限を外してヘッダーのみの高さへ戻す。 */}
          <CollapsibleCard
            title="管理対象商品一覧"
            fillParent
            headerActions={
              <>
                <button
                  className={`${BUTTON_STYLES.outline} ${BUTTON_BASE} px-3 py-1 whitespace-nowrap text-sm`}
                  onClick={handleAddRow}
                  aria-label="+管理対象商品登録"
                >
                  +管理対象商品登録
                </button>
              </>
            }
            className="mb-0 data-[state=open]:min-h-95"
            contentClassName="p-2 flex flex-col flex-1 min-h-0"
          >
            {/* グリッドはカード内の残り高さを埋める（min-h-0 が無いと flex 子要素が縮まない） */}
            <div className="grid-unified flex-1 min-h-0 w-full">
              <AgGridReact
                rowData={filteredData}
                columnDefs={columnDefsWithTooltips}
                defaultColDef={defaultColDef}
                getRowId={getRowId}
                statusBar={GRID_STATUS_BAR}
                domLayout="normal"
                ensureDomOrder={true}
                context={{
                  onEditRow: handleEdit,
                  onDeleteRow: handleDeleteClick,
                }}
                preventDefaultOnContextMenu={true}
                getContextMenuItems={(params) => {
                  // 右クリック時に行を自動選択
                  if (params.node && params.api) {
                    params.api.deselectAll();
                    params.node.setSelected(true);
                  }
                  // 標準のフィルタ導線（ヘッダーのフィルタボタンは非表示のため
                  // 右クリックメニューからフィルタを開く。§7/§8）。
                  return gridFilterContextMenuItems(params);
                }}
                {...GRID_BASE_PROPS}
                {...gridColumnStateProps}
              />
            </div>
          </CollapsibleCard>
        </div>
      </div>
      {/* メインコンテンツエリア終了 */}

      {/* 右ペイン（共通 RightPane：販売計画表(商流紐づけなし)と
          スタイル・左端の形状（リサイズハンドル/折り畳みタブ）・
          表示時のグリッド挙動（オーバーレイ）を統一） */}
      <RightPane
        open={isPaneOpen}
        onClose={() => setIsPaneOpen(false)}
        title={paneMode === 'create' ? '管理対象商品登録' : '管理対象商品更新'}
        description={`管理対象商品の${
          paneMode === 'create' ? '登録' : '更新'
        }を行います`}
        footer={
          <div className="flex items-center justify-end gap-3">
            {/* 連続追加：新規登録時のみ表示。押下してもペインは閉じない */}
            {paneMode === 'create' && (
              <Button
                onClick={() => handleSave(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white py-5 rounded-lg"
              >
                連続追加
              </Button>
            )}
            <Button
              onClick={() => handleSave(false)}
              className="bg-blue-500 hover:bg-blue-600 text-white py-5 rounded-lg"
            >
              {paneMode === 'create' ? '登録' : '更新'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-6">
          {/* 商品区分 */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="productCategory" className="font-bold text-sm">
              商品区分
              <RequiredBadge />
            </Label>
            <SingleCombobox
              ariaRequired
              id="productCategory"
              className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
              options={[
                { value: '新商品', label: '新商品' },
                { value: '重点商品', label: '重点商品' },
                { value: '自販機専用商品', label: '自販機専用商品' },
              ]}
              value={formData.productCategory}
              onChange={(value) =>
                setFormData({
                  ...formData,
                  productCategory: value,
                })
              }
              placeholder="選択してください"
              searchable={false}
            />
          </div>

          {/* サマリ商品 */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="summaryProduct" className="font-bold text-sm">
              サマリ商品
              <RequiredBadge />
            </Label>
            {/* 検索付き単一選択（共通部品）。必須項目のため clearable は付けない。
                更新時はキー項目のため非活性（従来どおり）。 */}
            <SingleCombobox
              id="summaryProduct"
              options={summaryProductOptions}
              value={formData.summaryProduct}
              onChange={(value) =>
                setFormData({
                  ...formData,
                  summaryProduct: value,
                })
              }
              placeholder="コード または 名称で検索..."
              ariaRequired
              disabled={paneMode === 'edit'}
            />
          </div>

          {/* 参考商品 */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="referenceProduct" className="font-bold text-sm">
              参考商品
              <RequiredBadge />
            </Label>
            {/* 検索付き単一選択（共通部品）。必須項目のため clearable は付けない。 */}
            <SingleCombobox
              id="referenceProduct"
              options={referenceProductOptions}
              value={formData.referenceProduct}
              onChange={(value) =>
                setFormData({
                  ...formData,
                  referenceProduct: value,
                })
              }
              placeholder="コード または 名称で検索..."
              ariaRequired
            />
          </div>

          {/* 管理対象開始月 */}
          <div className="flex gap-4">
            {/* 管理対象開始月 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="targetStartMonth" className="font-bold text-sm">
                管理対象開始月
                <RequiredBadge />
              </Label>
              <MonthYearPicker
                id="targetStartMonth"
                required
                value={formData.targetStartMonth}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    targetStartMonth: value,
                  })
                }
                className="w-40"
              />
            </div>

            {/* 管理対象終了月 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="targetEndMonth" className="font-bold text-sm">
                管理対象終了月
                <RequiredBadge />
              </Label>
              <MonthYearPicker
                id="targetEndMonth"
                required
                value={formData.targetEndMonth}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    targetEndMonth: value,
                  })
                }
                className="w-40"
              />
            </div>
          </div>

          {/* 管理対象エリア */}
          <div className="flex flex-col gap-2">
            <Label className="font-bold text-sm">
              管理対象エリア
              <RequiredBadge />
            </Label>
            {/* 更新時はキー項目のため非活性（サマリ商品と同じ扱い）。
                Radix の RadioGroup は disabled が配下の項目へ伝播する。 */}
            <RadioGroup
              value={formData.areaType || ''}
              onValueChange={(value) => {
                setFormData({
                  ...formData,
                  areaType: value as '全国' | 'エリア指定',
                  targetArea: value === '全国' ? [] : formData.targetArea,
                });
              }}
              disabled={paneMode === 'edit'}
              className="flex flex-col gap-3"
            >
              {/* 全国 */}
              <div className="flex items-center gap-2">
                <RadioGroupItem value="全国" id="area-type-all" />
                <Label
                  htmlFor="area-type-all"
                  className="cursor-pointer text-sm font-normal"
                >
                  全国
                </Label>
              </div>
              {/* エリア指定 */}
              <div className="flex items-center gap-2">
                <RadioGroupItem value="エリア指定" id="area-type-specific" />
                <Label
                  htmlFor="area-type-specific"
                  className="cursor-pointer text-sm font-normal"
                >
                  エリア指定
                </Label>
              </div>
            </RadioGroup>
            {/* 全国以外の支社（エリア指定選択時のみ表示） */}
            {formData.areaType === 'エリア指定' && (
              <div className="flex flex-col gap-3 mt-2 pl-6 border-l-2 border-blue-200">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="area-shuto"
                    checked={formData.targetArea.includes('首都圏本部')}
                    onCheckedChange={(checked) =>
                      handleAreaChange('首都圏本部', checked as boolean)
                    }
                  />
                  <label
                    htmlFor="area-shuto"
                    className="text-sm cursor-pointer"
                  >
                    首都圏本部
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="area-kinki"
                    checked={formData.targetArea.includes('近畿圏本部')}
                    onCheckedChange={(checked) =>
                      handleAreaChange('近畿圏本部', checked as boolean)
                    }
                  />
                  <label
                    htmlFor="area-kinki"
                    className="text-sm cursor-pointer"
                  >
                    近畿圏本部
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="area-shikoku"
                    checked={formData.targetArea.includes('中四国支社')}
                    onCheckedChange={(checked) =>
                      handleAreaChange('中四国支社', checked as boolean)
                    }
                  />
                  <label
                    htmlFor="area-shikoku"
                    className="text-sm cursor-pointer"
                  >
                    四国支社
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="area-kyushu"
                    checked={formData.targetArea.includes('九州支社')}
                    onCheckedChange={(checked) =>
                      handleAreaChange('九州支社', checked as boolean)
                    }
                  />
                  <label
                    htmlFor="area-kyushu"
                    className="text-sm cursor-pointer"
                  >
                    九州支社
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="area-tohoku"
                    checked={formData.targetArea.includes('東北支社')}
                    onCheckedChange={(checked) =>
                      handleAreaChange('東北支社', checked as boolean)
                    }
                  />
                  <label
                    htmlFor="area-tohoku"
                    className="text-sm cursor-pointer"
                  >
                    東北支社
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="area-chubu"
                    checked={formData.targetArea.includes('中部北陸本部')}
                    onCheckedChange={(checked) =>
                      handleAreaChange('中部北陸本部', checked as boolean)
                    }
                  />
                  <label
                    htmlFor="area-chubu"
                    className="text-sm cursor-pointer"
                  >
                    中部北陸本部
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="area-hokkaido"
                    checked={formData.targetArea.includes('北海道支社')}
                    onCheckedChange={(checked) =>
                      handleAreaChange('北海道支社', checked as boolean)
                    }
                  />
                  <label
                    htmlFor="area-hokkaido"
                    className="text-sm cursor-pointer"
                  >
                    北海道支社
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="area-chugoku"
                    checked={formData.targetArea.includes('関東本部')}
                    onCheckedChange={(checked) =>
                      handleAreaChange('関東本部', checked as boolean)
                    }
                  />
                  <label
                    htmlFor="area-chugoku"
                    className="text-sm cursor-pointer"
                  >
                    関東本部
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </RightPane>
    </div>
  );
}
