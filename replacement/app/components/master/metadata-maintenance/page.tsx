import { Search, Download } from 'lucide-react';
import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { AgGridReact } from 'ag-grid-react';
import type {
  ColDef,
  GetRowIdParams,
  ICellRendererParams,
  CellValueChangedEvent,
} from 'ag-grid-community';

import { CopyableArea } from '../../ui/copyable-area';
import { SingleCombobox } from '../../ui/single-combobox';
import { SearchClearButton } from '../../ui/search-clear-button';
import { Input } from '../../ui/input';
import {
  FORM_LABEL_CLASS,
  TEXT_INPUT_CLASS,
  CARD_CLASS,
} from '../../../../styles/commonStyles';
import { BottomPane } from '../../ui/bottom-pane';
import {
  GRID_BASE_PROPS,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  editableBg,
  gridFilterContextMenuItems,
  useChangedCells,
  useGridColumnState,
  withHeaderTooltips,
  GRID_DATE_TEXT_FILTER,
} from '../../grid';
import { ScreenTitle } from '../../ui/screen-title';

// メタデータメンテナンス画面
// AWS Glue Data Catalog（参照元）／ Aurora PostgreSQL（実体）のメタデータを保守する。
// 上段＝テーブル単位一覧、下段＝選択テーブルのカラム詳細の2階層構成。
// カタログ／DB由来の項目（物理名・型・NULL許可など）は読取専用（灰背景）で表示し、
// 人手でメンテナンスする項目（論理名・説明・分類・機密区分など）のみ編集可（白背景）とする。

// テーブル単位メタデータ
interface MetadataTableData {
  id: string;
  databaseName: string; // データベース名（読取・カタログ由来）
  schemaName: string; // スキーマ名（読取・PostgreSQL）
  tablePhysicalName: string; // テーブル物理名（読取・カタログ由来）
  tableLogicalName: string; // テーブル論理名（編集）
  tableType: string; // テーブル種別 TABLE/VIEW（読取・カタログ由来）
  tableDescription: string; // テーブル説明（編集）
  classification: string; // 分類/タグ（編集）
  steward: string; // 管理者（データスチュワード）（編集）
  dataSource: string; // データソース（読取・Glue Connection）
  catalogUpdatedAt: string; // カタログ取込日時（読取・カタログ由来）
  updatedBy: string; // メタデータ編集者（読取・本アプリ監査）
  updatedAt: string; // メタデータ編集日時（読取・本アプリ監査）
}

// カラム単位メタデータ
interface MetadataColumnData {
  id: string;
  tableId: string; // 所属テーブルID（画面内リンク用）
  columnPhysicalName: string; // カラム物理名（読取・カタログ由来）
  columnLogicalName: string; // カラム論理名（編集）
  dataType: string; // データ型（読取・カタログ由来）
  lengthPrecision: string; // 桁数・精度（読取・PostgreSQL）
  nullable: string; // NULL許可（読取・PostgreSQL）
  primaryKey: string; // 主キー（読取・PostgreSQL制約）
  defaultValue: string; // デフォルト値（読取・PostgreSQL）
  columnDescription: string; // カラム説明（業務定義）（編集）
  sensitivity: string; // 機密区分（個人情報等）（編集）
  columnTag: string; // 分類/タグ（編集）
}

// 行ID（→ 画面設計標準 4.7）。テーブル一覧は t1〜、カラム詳細は c1〜 の id（いずれも一意・編集しない）
const getTableRowId = (params: GetRowIdParams<MetadataTableData>) =>
  params.data.id;
const getColumnRowId = (params: GetRowIdParams<MetadataColumnData>) =>
  params.data.id;

// 分類の選択肢（分類/タグ・機密区分）
const CLASSIFICATION_OPTIONS = ['販売計画', 'マスタ', '支払', '予算', '共通'];
const SENSITIVITY_OPTIONS = ['公開', '社外秘', '個人情報', '機密'];

// テーブル一覧シートのExcel出力列（見出し＋フィールド）。
const TABLE_EXPORT_COLS: {
  header: string;
  field: keyof MetadataTableData;
}[] = [
  { header: 'データベース名', field: 'databaseName' },
  { header: 'スキーマ名', field: 'schemaName' },
  { header: 'テーブル物理名', field: 'tablePhysicalName' },
  { header: 'テーブル論理名', field: 'tableLogicalName' },
  { header: 'テーブル種別', field: 'tableType' },
  { header: 'テーブル説明', field: 'tableDescription' },
  { header: '分類/タグ', field: 'classification' },
  { header: '管理者', field: 'steward' },
  { header: 'データソース', field: 'dataSource' },
  { header: 'カタログ取込日時', field: 'catalogUpdatedAt' },
  { header: 'メタデータ編集者', field: 'updatedBy' },
  { header: 'メタデータ編集日時', field: 'updatedAt' },
];

// カラム詳細シート（テーブル名ごと）のExcel出力列（見出し＋フィールド）。
const DETAIL_EXPORT_COLS: {
  header: string;
  field: keyof MetadataColumnData;
}[] = [
  { header: 'カラム物理名', field: 'columnPhysicalName' },
  { header: 'カラム論理名', field: 'columnLogicalName' },
  { header: 'データ型', field: 'dataType' },
  { header: '桁数・精度', field: 'lengthPrecision' },
  { header: 'NULL許可', field: 'nullable' },
  { header: '主キー', field: 'primaryKey' },
  { header: 'デフォルト値', field: 'defaultValue' },
  { header: 'カラム説明（業務定義）', field: 'columnDescription' },
  { header: '機密区分', field: 'sensitivity' },
  { header: '分類/タグ', field: 'columnTag' },
];

// Excelシート名の制約（31文字以内／禁止文字 : \ / ? * [ ] 不可）に整形し、重複時は連番を付す。
const buildSheetName = (raw: string, used: Set<string>): string => {
  const base = raw.replace(/[\\/?*[\]:]/g, '_').slice(0, 31) || 'sheet';
  let name = base;
  let n = 1;
  while (used.has(name)) {
    const suffix = `_${n++}`;
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
  }
  used.add(name);
  return name;
};

// サンプル：テーブル単位メタデータ
const SAMPLE_TABLES: MetadataTableData[] = [
  {
    id: 't1',
    databaseName: 'nexesales',
    schemaName: 'sales',
    tablePhysicalName: 'sales_plan',
    tableLogicalName: '販売計画',
    tableType: 'TABLE',
    tableDescription: '得意先別・商品別の月次販売計画を保持する',
    classification: '販売計画',
    steward: '本社/アサヒ太郎',
    dataSource: 'aurora-nexesales',
    catalogUpdatedAt: '2026/07/01 03:00',
    updatedBy: 'アサヒ太郎',
    updatedAt: '2026/06/28 14:20',
  },
  {
    id: 't2',
    databaseName: 'nexesales',
    schemaName: 'sales',
    tablePhysicalName: 'sales_actual',
    tableLogicalName: '販売実績',
    tableType: 'TABLE',
    tableDescription: 'EDI連携で取り込む販売実績',
    classification: '販売計画',
    steward: '本社/アサヒ太郎',
    dataSource: 'aurora-nexesales',
    catalogUpdatedAt: '2026/07/01 03:00',
    updatedBy: 'アサヒ太郎',
    updatedAt: '2026/06/20 09:10',
  },
  {
    id: 't3',
    databaseName: 'nexesales',
    schemaName: 'master',
    tablePhysicalName: 'distribution_retailer',
    tableLogicalName: '商流販売店マスタ',
    tableType: 'TABLE',
    tableDescription: '商流上の販売店・一次店・三次店の対応',
    classification: 'マスタ',
    steward: '本社/アサヒ太郎',
    dataSource: 'aurora-nexesales',
    catalogUpdatedAt: '2026/07/01 03:00',
    updatedBy: 'アサヒ太郎',
    updatedAt: '2026/05/30 17:45',
  },
  {
    id: 't4',
    databaseName: 'nexesales',
    schemaName: 'payment',
    tablePhysicalName: 'payment_application',
    tableLogicalName: '支払申請',
    tableType: 'TABLE',
    tableDescription: '拡売費等の支払申請ヘッダ',
    classification: '支払',
    steward: '本社/アサヒ太郎',
    dataSource: 'aurora-nexesales',
    catalogUpdatedAt: '2026/07/01 03:00',
    updatedBy: 'アサヒ太郎',
    updatedAt: '2026/06/15 11:05',
  },
  {
    id: 't5',
    databaseName: 'nexesales',
    schemaName: 'sales',
    tablePhysicalName: 'v_sales_plan_summary',
    tableLogicalName: '販売計画サマリ',
    tableType: 'VIEW',
    tableDescription: '販売計画を月次で集計したビュー',
    classification: '販売計画',
    steward: '本社/アサヒ太郎',
    dataSource: 'aurora-nexesales',
    catalogUpdatedAt: '2026/07/01 03:00',
    updatedBy: 'アサヒ太郎',
    updatedAt: '2026/06/10 08:30',
  },
];

// サンプル：カラム単位メタデータ（tableId で上段テーブルに紐づく）
const SAMPLE_COLUMNS: MetadataColumnData[] = [
  {
    id: 'c1',
    tableId: 't1',
    columnPhysicalName: 'sales_plan_id',
    columnLogicalName: '販売計画ID',
    dataType: 'bigint',
    lengthPrecision: '-',
    nullable: '×',
    primaryKey: '○',
    defaultValue: 'nextval(...)',
    columnDescription: '販売計画の一意キー',
    sensitivity: '公開',
    columnTag: '販売計画',
  },
  {
    id: 'c2',
    tableId: 't1',
    columnPhysicalName: 'customer_code',
    columnLogicalName: '得意先コード',
    dataType: 'varchar',
    lengthPrecision: '10',
    nullable: '×',
    primaryKey: '',
    defaultValue: '-',
    columnDescription: '得意先マスタの得意先コード',
    sensitivity: '社外秘',
    columnTag: '販売計画',
  },
  {
    id: 'c3',
    tableId: 't1',
    columnPhysicalName: 'product_code',
    columnLogicalName: '商品コード',
    dataType: 'varchar',
    lengthPrecision: '13',
    nullable: '×',
    primaryKey: '',
    defaultValue: '-',
    columnDescription: '商品マスタの商品コード（JAN）',
    sensitivity: '公開',
    columnTag: '販売計画',
  },
  {
    id: 'c4',
    tableId: 't1',
    columnPhysicalName: 'plan_month',
    columnLogicalName: '計画対象月',
    dataType: 'date',
    lengthPrecision: '-',
    nullable: '×',
    primaryKey: '',
    defaultValue: '-',
    columnDescription: '計画の対象年月（月初日）',
    sensitivity: '公開',
    columnTag: '販売計画',
  },
  {
    id: 'c5',
    tableId: 't1',
    columnPhysicalName: 'plan_quantity',
    columnLogicalName: '計画数量',
    dataType: 'numeric',
    lengthPrecision: '15,2',
    nullable: '○',
    primaryKey: '',
    defaultValue: '0',
    columnDescription: '計画数量（ケース）',
    sensitivity: '社外秘',
    columnTag: '販売計画',
  },
  {
    id: 'c6',
    tableId: 't2',
    columnPhysicalName: 'sales_actual_id',
    columnLogicalName: '販売実績ID',
    dataType: 'bigint',
    lengthPrecision: '-',
    nullable: '×',
    primaryKey: '○',
    defaultValue: 'nextval(...)',
    columnDescription: '販売実績の一意キー',
    sensitivity: '公開',
    columnTag: '販売計画',
  },
  {
    id: 'c7',
    tableId: 't2',
    columnPhysicalName: 'customer_code',
    columnLogicalName: '得意先コード',
    dataType: 'varchar',
    lengthPrecision: '10',
    nullable: '×',
    primaryKey: '',
    defaultValue: '-',
    columnDescription: '得意先マスタの得意先コード',
    sensitivity: '社外秘',
    columnTag: '販売計画',
  },
  {
    id: 'c8',
    tableId: 't3',
    columnPhysicalName: 'retailer_code',
    columnLogicalName: '販売店コード',
    dataType: 'varchar',
    lengthPrecision: '10',
    nullable: '×',
    primaryKey: '○',
    defaultValue: '-',
    columnDescription: '販売店の一意コード',
    sensitivity: '社外秘',
    columnTag: 'マスタ',
  },
  {
    id: 'c9',
    tableId: 't3',
    columnPhysicalName: 'manager_name',
    columnLogicalName: '担当者名',
    dataType: 'varchar',
    lengthPrecision: '50',
    nullable: '○',
    primaryKey: '',
    defaultValue: '-',
    columnDescription: '商流販売店の担当者氏名',
    sensitivity: '個人情報',
    columnTag: 'マスタ',
  },
  {
    id: 'c10',
    tableId: 't4',
    columnPhysicalName: 'application_id',
    columnLogicalName: '申請ID',
    dataType: 'bigint',
    lengthPrecision: '-',
    nullable: '×',
    primaryKey: '○',
    defaultValue: 'nextval(...)',
    columnDescription: '支払申請の一意キー',
    sensitivity: '公開',
    columnTag: '支払',
  },
  {
    id: 'c11',
    tableId: 't4',
    columnPhysicalName: 'applicant_code',
    columnLogicalName: '申請者コード',
    dataType: 'varchar',
    lengthPrecision: '10',
    nullable: '×',
    primaryKey: '',
    defaultValue: '-',
    columnDescription: '申請者の社員コード',
    sensitivity: '個人情報',
    columnTag: '支払',
  },
  {
    id: 'c12',
    tableId: 't5',
    columnPhysicalName: 'plan_month',
    columnLogicalName: '計画対象月',
    dataType: 'date',
    lengthPrecision: '-',
    nullable: '○',
    primaryKey: '',
    defaultValue: '-',
    columnDescription: '集計対象の年月',
    sensitivity: '公開',
    columnTag: '販売計画',
  },
  {
    id: 'c13',
    tableId: 't5',
    columnPhysicalName: 'total_quantity',
    columnLogicalName: '合計数量',
    dataType: 'numeric',
    lengthPrecision: '18,2',
    nullable: '○',
    primaryKey: '',
    defaultValue: '-',
    columnDescription: '月次合計数量（ケース）',
    sensitivity: '社外秘',
    columnTag: '販売計画',
  },
];

// 読取専用セルの共通スタイル（灰背景のみ）。横寄せは cellClass で指定する（→ 02 §7）
const READONLY_CELL_STYLE = editableBg(false);

// 編集可セルの共通スタイル（白背景のみ）。横寄せは cellClass で指定する（→ 02 §7）。
// 変更ハイライト（黄）は共通の cellClassRules('ag-cell-changed')＋grid.css で自動適用される
// ため、列側の cellStyle には持たせない（→ 02 §7.2）。
const EDITABLE_CELL_STYLE = editableBg(true);

// 「詳細」ボタン（下ペインのカラム詳細を開く）。
// セル編集と競合しないよう、行/セルのクリックではなく本ボタン押下でのみ開く。
// 起動処理は grid の context 経由で受け取る（列定義の再生成を避ける）。
const DetailButtonRenderer = (
  props: ICellRendererParams<MetadataTableData>
) => {
  if (!props.data) return null;
  const openDetail = props.context?.onOpenDetail as
    | ((data: MetadataTableData) => void)
    | undefined;
  return (
    <div className="flex h-full items-center justify-center">
      <button
        type="button"
        className="rounded-full border-2 border-blue-600 bg-white px-3 py-0.5 text-sm text-blue-600 transition-colors hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        onClick={() => openDetail?.(props.data!)}
        aria-label="カラム詳細を開く"
      >
        詳細
      </button>
    </div>
  );
};

export default function MetadataMaintenance() {
  // 検索条件（検索ボタンなし＝条件変更でリアルタイム絞り込み）。選択項目の未選択（''）＝条件なし（「指定なし」）
  const [schema, setSchema] = useState('');
  const [tableType, setTableType] = useState('');
  const [tableName, setTableName] = useState('');
  const [classification, setClassification] = useState('');

  // メタデータ（サンプル）。編集はAG Gridが行オブジェクトを直接更新するため参照を維持する。
  // ※実装時：セル編集確定（onCellValueChanged）で監査項目 updatedBy/updatedAt を
  //   ログインユーザー・現在日時で更新し、永続化（API保存）を行うこと（本モックでは未反映）。
  const [tableRows] = useState<MetadataTableData[]>(SAMPLE_TABLES);
  const [columnRows] = useState<MetadataColumnData[]>(SAMPLE_COLUMNS);

  // 選択中テーブル（下ペインのカラム詳細対象）とペイン開閉
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [isPaneOpen, setIsPaneOpen] = useState(false);

  // スキーマ／テーブル種別の選択肢（サンプルデータから一意抽出）
  const schemaOptions = useMemo(
    () => Array.from(new Set(SAMPLE_TABLES.map((t) => t.schemaName))),
    []
  );
  const tableTypeOptions = useMemo(
    () => Array.from(new Set(SAMPLE_TABLES.map((t) => t.tableType))),
    []
  );

  // 検索条件でテーブル一覧を絞り込み（リアルタイム）
  const filteredTables = useMemo(() => {
    const keyword = tableName.trim().toLowerCase();
    return tableRows.filter((t) => {
      if (schema && t.schemaName !== schema) return false;
      if (tableType && t.tableType !== tableType) return false;
      if (classification && t.classification !== classification) return false;
      if (keyword) {
        const target =
          `${t.tablePhysicalName} ${t.tableLogicalName}`.toLowerCase();
        if (!target.includes(keyword)) return false;
      }
      return true;
    });
  }, [tableRows, schema, tableType, classification, tableName]);

  // 選択中テーブルのカラム詳細（下ペイン表示用）
  const filteredColumns = useMemo(
    () => columnRows.filter((c) => c.tableId === selectedTableId),
    [columnRows, selectedTableId]
  );
  const selectedTable = tableRows.find((t) => t.id === selectedTableId);

  // クリア：検索条件を初期化する
  const handleClear = () => {
    setSchema('');
    setTableType('');
    setTableName('');
    setClassification('');
  };

  // 「詳細」ボタン：下ペインにカラム詳細を表示する（セル編集と競合させない）
  const handleOpenDetail = (data: MetadataTableData) => {
    setSelectedTableId(data.id);
    setIsPaneOpen(true);
  };

  // Excelダウンロード（SheetJS）。現在の絞り込み結果を出力する。
  // シート1＝テーブル一覧、シート2以降＝テーブル名（物理名）ごとのカラム詳細。
  const handleDownload = () => {
    const wb = XLSX.utils.book_new();

    // シート1：テーブル一覧
    const tableAoa = [
      TABLE_EXPORT_COLS.map((c) => c.header),
      ...filteredTables.map((t) => TABLE_EXPORT_COLS.map((c) => t[c.field])),
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(tableAoa),
      'テーブル一覧'
    );

    // シート2以降：テーブル名ごとのカラム詳細
    const usedNames = new Set<string>(['テーブル一覧']);
    filteredTables.forEach((t) => {
      const cols = columnRows.filter((c) => c.tableId === t.id);
      const detailAoa = [
        DETAIL_EXPORT_COLS.map((d) => d.header),
        ...cols.map((c) => DETAIL_EXPORT_COLS.map((d) => c[d.field])),
      ];
      const sheetName = buildSheetName(t.tablePhysicalName, usedNames);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet(detailAoa),
        sheetName
      );
    });

    XLSX.writeFile(wb, 'メタデータ.xlsx');
  };

  // テーブル一覧の列定義
  const tableColumnDefs: ColDef<MetadataTableData>[] = useMemo(
    () => [
      {
        // カラム詳細（下ペイン）を開くボタン列。セル編集と分離するため独立列にする
        headerName: '',
        colId: 'detail',
        width: 70,
        minWidth: 70,
        maxWidth: 70,
        editable: false,
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: DetailButtonRenderer,
        cellClass: 'cell-center',
      },
      {
        headerName: 'データベース名',
        field: 'databaseName',
        editable: false,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        headerName: 'スキーマ名',
        field: 'schemaName',
        editable: false,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        headerName: 'テーブル物理名',
        field: 'tablePhysicalName',
        editable: false,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        headerName: 'テーブル論理名',
        field: 'tableLogicalName',
        editable: true,
        cellStyle: EDITABLE_CELL_STYLE,
      },
      {
        headerName: 'テーブル種別',
        field: 'tableType',
        editable: false,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        // 説明は折り返し表示（autoHeight）。内容フィットが折り返し前の全文幅で
        // 極端に横長になるのを防ぐため、この列のみ maxWidth で上限を設ける。
        headerName: 'テーブル説明',
        field: 'tableDescription',
        maxWidth: 288,
        editable: true,
        wrapText: true,
        autoHeight: true,
        cellStyle: EDITABLE_CELL_STYLE,
      },
      {
        headerName: '分類/タグ',
        field: 'classification',
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: CLASSIFICATION_OPTIONS },
        cellStyle: EDITABLE_CELL_STYLE,
      },
      {
        headerName: '管理者',
        field: 'steward',
        editable: true,
        cellStyle: EDITABLE_CELL_STYLE,
      },
      {
        headerName: 'データソース',
        field: 'dataSource',
        editable: false,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        headerName: 'カタログ取込日時',
        field: 'catalogUpdatedAt',
        ...GRID_DATE_TEXT_FILTER,
        editable: false,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        headerName: 'メタデータ編集者',
        field: 'updatedBy',
        editable: false,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        headerName: 'メタデータ編集日時',
        field: 'updatedAt',
        ...GRID_DATE_TEXT_FILTER,
        editable: false,
        cellStyle: READONLY_CELL_STYLE,
      },
    ],
    []
  );

  // カラム詳細の列定義
  const columnColumnDefs: ColDef<MetadataColumnData>[] = useMemo(
    () => [
      {
        headerName: 'カラム物理名',
        field: 'columnPhysicalName',
        editable: false,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        headerName: 'カラム論理名',
        field: 'columnLogicalName',
        editable: true,
        cellStyle: EDITABLE_CELL_STYLE,
      },
      {
        headerName: 'データ型',
        field: 'dataType',
        editable: false,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        headerName: '桁数・精度',
        field: 'lengthPrecision',
        editable: false,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        headerName: 'NULL許可',
        field: 'nullable',
        editable: false,
        cellStyle: READONLY_CELL_STYLE,
        cellClass: 'cell-center',
      },
      {
        headerName: '主キー',
        field: 'primaryKey',
        editable: false,
        cellStyle: READONLY_CELL_STYLE,
        cellClass: 'cell-center',
      },
      {
        headerName: 'デフォルト値',
        field: 'defaultValue',
        editable: false,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        // 説明は折り返し表示（autoHeight）。テーブル説明列と同様に maxWidth で上限を設ける。
        headerName: 'カラム説明（業務定義）',
        field: 'columnDescription',
        maxWidth: 288,
        editable: true,
        wrapText: true,
        autoHeight: true,
        cellStyle: EDITABLE_CELL_STYLE,
      },
      {
        headerName: '機密区分',
        field: 'sensitivity',
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: SENSITIVITY_OPTIONS },
        cellStyle: EDITABLE_CELL_STYLE,
      },
      {
        headerName: '分類/タグ',
        field: 'columnTag',
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: CLASSIFICATION_OPTIONS },
        cellStyle: EDITABLE_CELL_STYLE,
      },
    ],
    []
  );

  // ヘッダーが省略表示された場合にマウスオーバーで全文表示する（参照を固定する → 02 §7.1）
  const tableColumnDefsWithTooltip = useMemo(
    () => withHeaderTooltips(tableColumnDefs),
    [tableColumnDefs]
  );
  const columnColumnDefsWithTooltip = useMemo(
    () => withHeaderTooltips(columnColumnDefs),
    [columnColumnDefs]
  );

  // defaultColDef（共通形をベースに、文字列列の既定横寄せを左寄せに）。
  // 横寄せは grid.css の cell-left/center を cellClass で指定する（→ 02 §7）。
  const defaultColDef = useMemo(
    () => ({
      ...GRID_DEFAULT_COL_DEF,
      cellClass: 'cell-left',
    }),
    []
  );

  // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）。
  // 列は明示幅を持たず、保存済み状態が無い初回は内容フィット（autoSize 既定 true）で自動調整する。
  // ※幅方針を固定幅→内容フィットへ変更したため、旧localStorageの固定幅が
  //   自動調整を上書きしないよう storageKey を v2 に更新する（→ 02 §9）。
  const tableGridColumnStateProps = useGridColumnState(
    'metadataMaintenance.tableList.columnState.v2'
  );
  const columnGridColumnStateProps = useGridColumnState(
    'metadataMaintenance.columnDetail.columnState.v2'
  );

  // 編集セルの変更ハイライト（黄）: グリッドごとに useChangedCells を用意（→ 02 §7.2）。
  const tableChanged = useChangedCells();
  const columnChanged = useChangedCells();

  // セル編集確定で変更を記録し、当該行を再描画して強調色を反映する。
  const handleTableCellChanged = (p: CellValueChangedEvent) => {
    tableChanged.trackCellChange(p);
    p.api.refreshCells({ rowNodes: [p.node], force: true });
  };
  const handleColumnCellChanged = (p: CellValueChangedEvent) => {
    columnChanged.trackCellChange(p);
    p.api.refreshCells({ rowNodes: [p.node], force: true });
  };

  // h-full で定高を保ちつつ（AG Grid の height:100% 解決に必須）、min-h-[45rem] で全体の下限を確保する。
  // 画面高さがこの下限を下回ると root が <main> を超え、画面全体（<main>）に縦スクロールが出る（計画一覧と同挙動）。
  // グリッド高さは従来どおり flex-fill で残り画面に追従するため、検索カードの折返しで chrome 高が変わっても破綻しない。
  return (
    <div className="min-w-300 h-full min-h-180 flex flex-col">
      <div className="px-6 py-3 flex flex-col flex-1 min-h-0">
        {/* 画面名はヘッダー（システム名の右）に表示する */}
        <ScreenTitle title="メタデータメンテナンス" />

        {/* 検索条件カード（管理対象商品一覧と同じレイアウト・検索ボタンなし） */}
        {/* 検索条件の値は Ctrl+C／右クリック「コピー」で表示中の値をコピーできる（CopyableArea → 02 §15） */}
        <CopyableArea className="shrink-0">
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
              {/* 1行目: スキーマ、テーブル種別、分類、テーブル名 */}
              <div className="flex items-center flex-wrap gap-2">
                {/* スキーマ */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="search-schema"
                    className={`${FORM_LABEL_CLASS} whitespace-nowrap w-24 text-right`}
                  >
                    スキーマ
                  </label>
                  <SingleCombobox
                    id="search-schema"
                    className="w-40"
                    // 未選択＝「指定なし」（条件なし）。「すべて」の選択肢は持たない（→ 02 §9）
                    options={schemaOptions.map((sc) => ({
                      value: sc,
                      label: sc,
                    }))}
                    value={schema}
                    onChange={setSchema}
                    placeholder="指定なし"
                    clearable
                    searchable={false}
                  />
                </div>

                {/* テーブル種別 */}
                <div className="flex items-center gap-2 ml-5">
                  <label
                    htmlFor="search-table-type"
                    className={`${FORM_LABEL_CLASS} whitespace-nowrap w-24 text-right`}
                  >
                    テーブル種別
                  </label>
                  <SingleCombobox
                    id="search-table-type"
                    className="w-40"
                    options={tableTypeOptions.map((tt) => ({
                      value: tt,
                      label: tt,
                    }))}
                    value={tableType}
                    onChange={setTableType}
                    placeholder="指定なし"
                    clearable
                    searchable={false}
                  />
                </div>

                {/* 分類 */}
                <div className="flex items-center gap-2 ml-5">
                  <label
                    htmlFor="search-classification"
                    className={`${FORM_LABEL_CLASS} whitespace-nowrap w-24 text-right`}
                  >
                    分類
                  </label>
                  <SingleCombobox
                    id="search-classification"
                    className="w-40"
                    options={CLASSIFICATION_OPTIONS.map((cl) => ({
                      value: cl,
                      label: cl,
                    }))}
                    value={classification}
                    onChange={setClassification}
                    placeholder="指定なし"
                    clearable
                    searchable={false}
                  />
                </div>

                {/* テーブル名（部分一致） */}
                <div className="flex items-center gap-2 ml-5">
                  <label
                    htmlFor="search-table-name"
                    className={`${FORM_LABEL_CLASS} whitespace-nowrap w-24 text-right`}
                  >
                    テーブル名
                  </label>
                  <Input
                    id="search-table-name"
                    type="text"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder="物理名／論理名で絞り込み"
                    className={`${TEXT_INPUT_CLASS} w-60 text-gray-900`}
                  />
                </div>
              </div>
            </div>
          </div>
        </CopyableArea>

        {/* テーブル一覧（管理対象商品一覧のグリッドエリアと同じ体裁：タイトル・黄色下線なし／shadow-md）。
            高さは残り画面に追従（flex-1＋min-h-0）。全体の下限は root の min-h-180 が担い、
            画面高さが下限を割ると <main> 全体に縦スクロールが出る。 */}
        <div
          className={`${CARD_CLASS} overflow-hidden p-2 flex flex-col flex-1 min-h-0`}
        >
          {/* グリッド上部ボタン群（右寄せ） */}
          <div className="flex items-center gap-2 mb-2">
            <button
              className="btn-toolbar-outline ml-auto"
              aria-label="ダウンロード"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
              ダウンロード
            </button>
          </div>
          {/* グリッドは残り画面高さに追従（domLayout="normal"＋flex-1）。min-h-0 は AG Grid が
              height:100% で高さ解決するために必須（外すとヘッダーのみに潰れる）。下限はカード側の floor が担う。 */}
          <div className="sales-plan-list-grid flex-1 min-h-0">
            <AgGridReact<MetadataTableData>
              {...GRID_BASE_PROPS}
              rowData={filteredTables}
              columnDefs={tableColumnDefsWithTooltip}
              defaultColDef={defaultColDef}
              getRowId={getTableRowId}
              getContextMenuItems={gridFilterContextMenuItems}
              statusBar={GRID_STATUS_BAR}
              domLayout="normal"
              context={{
                onOpenDetail: handleOpenDetail,
                isCellChanged: tableChanged.isCellChanged,
              }}
              onCellValueChanged={handleTableCellChanged}
              animateRows={true}
              {...tableGridColumnStateProps}
            />
          </div>
        </div>
      </div>

      {/* カラム詳細（下ペイン・全幅・高さリサイズ可）。テーブル行クリックで開く */}
      <BottomPane
        open={isPaneOpen}
        onClose={() => setIsPaneOpen(false)}
        title={
          selectedTable
            ? `カラム詳細：${selectedTable.tableLogicalName}（${selectedTable.tablePhysicalName}）`
            : 'カラム詳細'
        }
        initialHeight={28}
        minHeight={16}
        maxHeight={48}
      >
        <div className="sales-plan-list-grid flex-1 min-h-0">
          <AgGridReact<MetadataColumnData>
            {...GRID_BASE_PROPS}
            rowData={filteredColumns}
            columnDefs={columnColumnDefsWithTooltip}
            defaultColDef={defaultColDef}
            getRowId={getColumnRowId}
            getContextMenuItems={gridFilterContextMenuItems}
            statusBar={GRID_STATUS_BAR}
            domLayout="normal"
            context={{ isCellChanged: columnChanged.isCellChanged }}
            onCellValueChanged={handleColumnCellChanged}
            animateRows={true}
            {...columnGridColumnStateProps}
          />
        </div>
      </BottomPane>
    </div>
  );
}
