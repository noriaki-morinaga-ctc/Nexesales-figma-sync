import { Save, Send, Check, X, CornerUpLeft, Undo2 } from 'lucide-react';
import { useState, useMemo, useRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  GetRowIdParams,
  type CellValueChangedEvent,
} from 'ag-grid-community';

import { CollapsibleCard } from '@/app/components/ui/collapsible-card';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Input } from '@/app/components/ui/input';
import {
  TEXT_INPUT_CLASS,
  CARD_CLASS,
  SEARCH_GRID_CLASS,
  SEARCH_LABEL_CLASS,
} from '@/styles/commonStyles';
import { Label } from '@/app/components/ui/label';
import { RequiredBadge } from '@/app/components/ui/required-badge';
import { BottomPane } from '@/app/components/ui/bottom-pane';
import {
  GRID_DEFAULT_COL_DEF,
  GRID_BASE_PROPS,
  GRID_NO_FILTER_COLUMN_TYPES,
  GRID_EMPTY_TEXT,
  GRID_STATUS_BAR,
  useGridColumnState,
  useChangedCells,
  withComparableCellValues,
} from '@/app/components/grid';
import { ScreenTitle } from '@/app/components/ui/screen-title';
import { FooterCommentField } from '@/app/components/shared/common/FooterCommentField';

// AG Gridヘッダー用：必須列はヘッダー名の後ろに必須バッジ（RequiredBadge）を表示する。
// 全ヘッダーで書式を統一する（左寄せ・折り返し表示で文字が見切れないようにする）。
const RequiredHeader = (props: { displayName: string; required?: boolean }) => (
  // 規約例外（2行ラベル）：折り返す見出しを行高に収めるため、行間を leading-tight とする
  <span className="flex w-full items-center justify-start gap-0.5 whitespace-normal break-words py-1.5 text-left leading-tight font-bold">
    {props.displayName}
    {props.required && <RequiredBadge />}
  </span>
);

// 行ID（AG Grid 公式 getRowId）。ロケ契約料一覧・借方／貸方 明細の各行が持つ id を使う
// （表示項目はいずれも編集可で行の識別に使えないため、行データ側で id を振る）。
// モジュール直下に置いて参照を固定する（→ 02 §7.1）。
const getRecordRowId = (
  params: GetRowIdParams<Record<string, string>>
): string => params.data.id;

// AG Grid valueFormatter：金額をカンマ区切り（桁区切り）で表示する（空欄は「-」）。
const formatAmountCell = (params: { value?: unknown }): string => {
  const v = params.value;
  if (v === null || v === undefined || v === '') return GRID_EMPTY_TEXT;
  const num = Number(String(v).replace(/,/g, ''));
  return Number.isNaN(num) ? String(v) : num.toLocaleString();
};

// AG Grid valueFormatter：日付を yyyy/MM/dd 形式にゼロ埋めして表示する（空欄は「-」、不正値はそのまま）。
const formatDateCell = (params: { value?: unknown }): string => {
  const v = params.value;
  if (v === null || v === undefined || v === '') return GRID_EMPTY_TEXT;
  const parts = String(v).split('/');
  if (parts.length !== 3) return String(v);
  const [y, m, d] = parts;
  return `${y}/${m.padStart(2, '0')}/${d.padStart(2, '0')}`;
};

// 借方・貸方 明細テーブルの列メタ情報（表の列定義と明細追加ペインの入力欄で共通利用）。
// required:true の項目は必須（ヘッダーの＊・入力欄の必須バッジ）。
// numeric:true の項目は表で右寄せ＋カンマ区切り、date:true の項目は右寄せ＋yyyy/MM/dd 表示。
const JOURNAL_COLUMNS: {
  field: string;
  headerName: string;
  required?: boolean;
  numeric?: boolean;
  date?: boolean;
}[] = [
  { field: 'accountItem', headerName: '勘定科目', required: true },
  { field: 'department', headerName: '部署', required: true },
  { field: 'managementCategory', headerName: '管理区分', required: true },
  { field: 'managementCode', headerName: '管理コード', required: true },
  { field: 'amount', headerName: '金額', required: true, numeric: true },
  { field: 'taxCategory', headerName: '税区分', required: true },
  { field: 'note1', headerName: '摘要1', required: true },
  { field: 'application2', headerName: '適用2' },
  { field: 'billTo', headerName: '請求先', required: true },
  { field: 'kanaName', headerName: 'カナ名称' },
  { field: 'postalCode', headerName: '郵便番号' },
  { field: 'address1', headerName: '住所1' },
  { field: 'address2', headerName: '住所2' },
  { field: 'address3', headerName: '住所3' },
  {
    field: 'invoiceIssuanceCategory',
    headerName: '請求書発行区分',
    required: true,
  },
  { field: 'invoiceIssueDate', headerName: '請求書発行日付', date: true },
  { field: 'billingContent', headerName: '請求内容', required: true },
  { field: 'collectionMethod', headerName: '回収方法', required: true },
  {
    field: 'collectionScheduledDate',
    headerName: '回収予定日',
    required: true,
    date: true,
  },
  { field: 'ledgerManagementNumber', headerName: '台帳管理番号' },
  { field: 'occurrenceCause', headerName: '発生原因' },
  { field: 'sortKey', headerName: 'ソートキー' },
  { field: 'quantity', headerName: '数量', numeric: true },
  { field: 'unitPrice', headerName: '単価', numeric: true },
  { field: 'unit', headerName: '単位' },
];

export default function UnamortizedProjectBillingList() {
  const [isOpen, setIsOpen] = useState(true);
  // フッターのコメント入力値（自販機販売計画表のフッターに準拠）
  const [commentInput, setCommentInput] = useState('');
  const [isSalesPlanOpen, setIsSalesPlanOpen] = useState(true);

  // 列の状態（幅・並び・表示）の保存（→ 02 §7「列状態の永続化」）。借方・貸方は同じ列定義でも別に保存する
  const locationContractColumnStateProps = useGridColumnState(
    'unamortizedProjectBillingList.locationContract.columnState.v1'
  );
  const debitColumnStateProps = useGridColumnState(
    'unamortizedProjectBillingList.debit.columnState.v1'
  );
  const creditColumnStateProps = useGridColumnState(
    'unamortizedProjectBillingList.credit.columnState.v1'
  );

  // ロケ契約料一覧：値を変えたセルの強調（薄い黄＋オレンジ枠。元の値に戻したら解除 → 02 §7.2）。
  // 利用者が編集したセルだけが対象（計算し直したセルは対象外）。
  const locationContractChanged = useChangedCells();
  const locationContractGridContext = useMemo(
    () => ({ isCellChanged: locationContractChanged.isCellChanged }),
    [locationContractChanged.isCellChanged]
  );
  const handleLocationContractCellValueChanged = useCallback(
    (e: CellValueChangedEvent) => {
      locationContractChanged.trackCellChange(withComparableCellValues(e));
      e.api.refreshCells({
        rowNodes: [e.node],
        columns: [e.column],
        force: true,
      });
    },
    [locationContractChanged]
  );
  // 借方の明細：値を変えたセルの強調（薄い黄＋オレンジ枠。元の値に戻したら解除 → 02 §7.2）。
  // 利用者が編集したセルだけが対象（計算し直したセルは対象外）。
  const debitChanged = useChangedCells();
  const debitGridContext = useMemo(
    () => ({ isCellChanged: debitChanged.isCellChanged }),
    [debitChanged.isCellChanged]
  );
  const handleDebitCellValueChanged = useCallback(
    (e: CellValueChangedEvent) => {
      debitChanged.trackCellChange(withComparableCellValues(e));
      e.api.refreshCells({
        rowNodes: [e.node],
        columns: [e.column],
        force: true,
      });
    },
    [debitChanged]
  );
  // 貸方の明細：値を変えたセルの強調（薄い黄＋オレンジ枠。元の値に戻したら解除 → 02 §7.2）。
  // 利用者が編集したセルだけが対象（計算し直したセルは対象外）。
  const creditChanged = useChangedCells();
  const creditGridContext = useMemo(
    () => ({ isCellChanged: creditChanged.isCellChanged }),
    [creditChanged.isCellChanged]
  );
  const handleCreditCellValueChanged = useCallback(
    (e: CellValueChangedEvent) => {
      creditChanged.trackCellChange(withComparableCellValues(e));
      e.api.refreshCells({
        rowNodes: [e.node],
        columns: [e.column],
        force: true,
      });
    },
    [creditChanged]
  );
  const defaultColDef = useMemo(
    () => ({
      ...GRID_DEFAULT_COL_DEF,
      sortable: false,
      filter: false,
      suppressMovable: true,
      wrapHeaderText: true,
      autoHeaderHeight: true,
    }),
    []
  );

  // ===== 未償却案件請求一覧テーブル =====
  // 列定義。1行の縦幅を文字複数行分に固定するため折り返し表示にする。
  // required:true の列はヘッダーに必須マーク（赤いアスタリスク）を表示する。
  const locationContractColumnDefs = useMemo<ColDef[]>(() => {
    const columns: {
      field: string;
      headerName: string;
      required?: boolean;
    }[] = [
      { field: 'managementCategory', headerName: '管理区分' },
      { field: 'status', headerName: 'ステータス' },
      { field: 'installationSiteName', headerName: '設置先名' },
      {
        field: 'locationContractAmount',
        headerName: 'ロケ契約料（償却）金額',
      },
      { field: 'billTo', headerName: '請求先' },
      { field: 'counterpartyName', headerName: '相手先名' },
      { field: 'distributionStoreName', headerName: '商流販売店名' },
      { field: 'note1', headerName: '摘要1', required: true },
      { field: 'billerName', headerName: '請求者名' },
      { field: 'invoiceAddress', headerName: '請求書送付先住所' },
      { field: 'invoiceIssuanceCategory', headerName: '請求書発行区分' },
      { field: 'billingContent', headerName: '請求内容' },
      {
        field: 'collectionScheduledDate',
        headerName: '回収予定日',
        required: true,
      },
    ];
    return columns.map((col) => {
      // 金額・日付は右寄せ、それ以外のテキスト列は左寄せ（標準準拠）。
      const isAmount = col.field === 'locationContractAmount';
      const isDate = col.field === 'collectionScheduledDate';
      const isRight = isAmount || isDate;
      return {
        headerName: col.headerName,
        field: col.field,
        minWidth: 96,
        flex: 1,
        editable: true,
        headerComponent: RequiredHeader,
        headerComponentParams: {
          required: col.required,
        },
        cellClass: isRight ? 'cell-right' : 'cell-left',
        // 金額はカンマ区切り、日付は yyyy/MM/dd 表示に整形する。
        ...(isAmount ? { valueFormatter: formatAmountCell } : {}),
        ...(isDate ? { valueFormatter: formatDateCell } : {}),
      };
    });
  }, []);

  // 表データ。初期値を設定する。id は行ID（getRowId）用で、列には表示しない。
  const [locationContractRowData] = useState<Record<string, string>[]>([
    {
      id: 'lc-1',
      managementCategory: 'ロケ契約料他前払い金（償却）',
      status: '未申請',
      installationSiteName: '峠台Aビル',
      locationContractAmount: '120000',
      billTo: '株式会社峠台商事',
      counterpartyName: '峠台 太郎',
      distributionStoreName: '▲▲販売 A支店',
      note1: 'ロケ契約料償却分',
      billerName: '山田 翔一郎',
      invoiceAddress: '東京都千代田区峠台1-2-3',
      invoiceIssuanceCategory: '電子',
      billingContent: '自販機設置ロケ契約料',
      collectionScheduledDate: '2026/7/31',
    },
    {
      id: 'lc-2',
      managementCategory: 'ロケ契約料他前払い金（償却）',
      status: '申請中',
      installationSiteName: 'みなとテラス',
      locationContractAmount: '84000',
      billTo: 'みなと不動産株式会社',
      counterpartyName: '港 花子',
      distributionStoreName: '■■流通 港南支店',
      note1: '更新分ロケ契約料',
      billerName: '佐藤 美咲',
      invoiceAddress: '神奈川県横浜市港南区港5-6-7',
      invoiceIssuanceCategory: '郵送',
      billingContent: 'オフィス設置飲料ロケ料',
      collectionScheduledDate: '2026/8/15',
    },
    {
      id: 'lc-3',
      managementCategory: 'ロケ契約料他前払い金（償却）',
      status: '承認待ち',
      installationSiteName: '北大路スクエア',
      locationContractAmount: '156000',
      billTo: '北大路開発株式会社',
      counterpartyName: '北大路 健',
      distributionStoreName: '◆◆販売 洛北支店',
      note1: '新規設置ロケ契約料',
      billerName: '田中 一郎',
      invoiceAddress: '京都府京都市北区北大路8-9-1',
      invoiceIssuanceCategory: '電子',
      billingContent: '商業施設ロケ契約料',
      collectionScheduledDate: '2026/9/30',
    },
    {
      id: 'lc-4',
      managementCategory: 'ロケ契約料他前払い金（償却）',
      status: '差戻し',
      installationSiteName: '泉南ロジスティクス',
      locationContractAmount: '62000',
      billTo: '泉南運輸株式会社',
      counterpartyName: '泉南 恵子',
      distributionStoreName: '★★流通 泉州支店',
      note1: '解約に伴う残償却請求',
      billerName: '鈴木 大輔',
      invoiceAddress: '大阪府泉南市泉南10-11-12',
      invoiceIssuanceCategory: '郵送',
      billingContent: '倉庫設置ロケ契約料',
      collectionScheduledDate: '2026/10/20',
    },
    {
      id: 'lc-5',
      managementCategory: 'ロケ契約料他前払い金（償却）',
      status: '未申請',
      installationSiteName: '本町ビジネスタワー',
      locationContractAmount: '98000',
      billTo: '本町ビル管理株式会社',
      counterpartyName: '本町 修',
      distributionStoreName: '●●販売 中央支店',
      note1: '月次ロケ契約料償却',
      billerName: '高橋 由美',
      invoiceAddress: '愛知県名古屋市中区本町13-14-15',
      invoiceIssuanceCategory: '電子',
      billingContent: 'ビル共用部ロケ契約料',
      collectionScheduledDate: '2026/11/10',
    },
  ]);

  // いずれかの行が選択されているか。選択時に借方・貸方カードを表示する。
  // 最左のチェックボックスはグリッド標準の選択列（selectionColumnDef）で単一選択する（計画一覧に準拠）。
  const [hasSelectedRow, setHasSelectedRow] = useState(false);

  // ===== 借方・貸方 明細テーブルの列定義（共通） =====
  // 列メタ情報 JOURNAL_COLUMNS から生成する。
  // required:true の列はヘッダーに必須マーク（赤いアスタリスク）を表示する。
  const journalColumnDefs = useMemo<ColDef[]>(() => {
    return JOURNAL_COLUMNS.map((col) => {
      // 金額・数量・単価・日付は右寄せ、それ以外のテキスト列は左寄せ（標準準拠）。
      const isRight = col.numeric === true || col.date === true;
      return {
        headerName: col.headerName,
        field: col.field,
        minWidth: 96,
        flex: 1,
        editable: true,
        headerComponent: RequiredHeader,
        headerComponentParams: {
          required: col.required,
        },
        cellClass: isRight ? 'cell-right' : 'cell-left',
        // 金額・数量・単価はカンマ区切り、日付は yyyy/MM/dd 表示に整形する。
        ...(col.numeric ? { valueFormatter: formatAmountCell } : {}),
        ...(col.date ? { valueFormatter: formatDateCell } : {}),
      };
    });
  }, []);

  // 借方・貸方 明細の行データ（明細追加ペインの一時保存で増える。初期は空）。
  const [debitRowData, setDebitRowData] = useState<Record<string, string>[]>(
    []
  );
  const [creditRowData, setCreditRowData] = useState<Record<string, string>[]>(
    []
  );

  // 借方・貸方 明細の行選択（単一選択）。選択中の行インデックス。未選択は null。
  const [debitSelectedIndex, setDebitSelectedIndex] = useState<number | null>(
    null
  );
  const [creditSelectedIndex, setCreditSelectedIndex] = useState<number | null>(
    null
  );

  // ===== 明細追加・更新ペイン =====
  // ペインの表示状態。
  const [isDetailPaneShown, setIsDetailPaneShown] = useState(false);
  // ペインのモード。'add'=明細追加 / 'edit'=明細更新。
  const [detailMode, setDetailMode] = useState<'add' | 'edit'>('add');
  // 対象（最初に「明細追加」を押した側／更新対象の側）。'debit'=借方 / 'credit'=貸方。
  const [detailTarget, setDetailTarget] = useState<'debit' | 'credit'>('debit');
  // 更新モードで編集中の行インデックス（追加モードでは未使用）。
  const [detailEditIndex, setDetailEditIndex] = useState<number | null>(null);
  // ペインの入力値（列＝JOURNAL_COLUMNS の field をキーに持つ）。
  const [detailForm, setDetailForm] = useState<Record<string, string>>({});

  // 明細追加ボタン押下：ペイン未表示時のみ対象を確定して開く。
  // （既に開いている場合は最初に押した側を維持する）
  const handleAddDetail = (target: 'debit' | 'credit') => {
    if (isDetailPaneShown) return;
    setDetailMode('add');
    setDetailTarget(target);
    setDetailEditIndex(null);
    setDetailForm({});
    setIsDetailPaneShown(true);
  };

  // 明細更新ボタン押下：選択中の行を入力欄へ読み込んで更新モードで開く。
  const handleUpdateDetail = (target: 'debit' | 'credit') => {
    if (isDetailPaneShown) return;
    const index = target === 'debit' ? debitSelectedIndex : creditSelectedIndex;
    if (index === null) return;
    const rows = target === 'debit' ? debitRowData : creditRowData;
    setDetailMode('edit');
    setDetailTarget(target);
    setDetailEditIndex(index);
    setDetailForm({ ...rows[index] });
    setIsDetailPaneShown(true);
  };

  // ペインの入力欄変更。
  const handleDetailFieldChange = (field: string, value: string) => {
    setDetailForm((prev) => ({ ...prev, [field]: value }));
  };

  // 借方・貸方 明細の行ID（getRowId）の採番。明細追加の一時保存で1件ずつ振る。
  const journalRowSeqRef = useRef(0);

  // 一時保存：対象（借方／貸方）の表へ入力内容を反映し、ペインを閉じる。
  // 追加モードは末尾に1行追加（新しい行ID を振る）、更新モードは選択行を上書きする（行ID は元の行のまま）。
  const handleDetailTempSave = () => {
    const newRow = { ...detailForm };
    const setRows =
      detailTarget === 'debit' ? setDebitRowData : setCreditRowData;
    if (detailMode === 'edit' && detailEditIndex !== null) {
      const index = detailEditIndex;
      setRows((prev) =>
        prev.map((row, i) => (i === index ? { ...newRow, id: row.id } : row))
      );
    } else {
      journalRowSeqRef.current += 1;
      const id = `journal-${journalRowSeqRef.current}`;
      // 新規の明細は最下行に追加する（→ 02 §8「行の追加位置」・UX-112）。
      // 既存の行の位置は変わらないため、行の左の選択（行番号で保持）はずらさない
      setRows((prev) => [...prev, { ...newRow, id }]);
    }
    setIsDetailPaneShown(false);
    setDetailForm({});
  };

  // 戻る：入力を取り消してペインを閉じる。
  const handleDetailBack = () => {
    setIsDetailPaneShown(false);
    setDetailForm({});
  };

  return (
    // 画面全体を縦フレックスにし、コンテンツとフッターの間のスペーサー（flex-1）で
    // 余白を吸収して、固定フッターをウィンドウ底部（＝main の下端）に張り付ける。
    // コンテンツが短い場合でもフッターが底部に固定され、長い場合は sticky で追従する。
    <div className="min-w-300 flex min-h-full flex-col">
      <div className="px-6 pt-3 pb-3">
        {/* 画面名はヘッダー（システム名の右）に表示する */}
        <ScreenTitle title="未償却案件請求一覧" />

        {/* 基本情報 */}
        <CollapsibleCard
          title="基本情報"
          open={isOpen}
          onOpenChange={setIsOpen}
        >
          <div className="p-4">
            {/* 1行目: 5列グリッド */}
            <div className={`${SEARCH_GRID_CLASS} mb-2`}>
              {/* 対象年度 */}
              <div className="flex items-center gap-2">
                <label className={SEARCH_LABEL_CLASS}>対象年度</label>
                <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
                  2026
                </div>
              </div>

              {/* 対象月 */}
              <div className="flex items-center gap-2">
                <label className={SEARCH_LABEL_CLASS}>対象月</label>
                <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
                  7
                </div>
              </div>

              {/* 計画No. */}
              <div className="flex items-center gap-2">
                <label className={SEARCH_LABEL_CLASS}>計画No.</label>
                <div className="flex-1 h-8 flex items-center text-sm text-gray-900"></div>
              </div>
            </div>

            {/* 2行目: 5列グリッド */}
            <div className={`${SEARCH_GRID_CLASS} mb-2`}>
              {/* 販売店 */}
              <div className="flex items-center gap-2">
                <label className={SEARCH_LABEL_CLASS}>販売店</label>
                <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
                  ▲▲
                </div>
              </div>

              {/* 三次店 */}
              <div className="flex items-center gap-2">
                <label className={SEARCH_LABEL_CLASS}>三次店</label>
                <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
                  A支店
                </div>
              </div>

              {/* 一次店 */}
              <div className="flex items-center gap-2">
                <label className={SEARCH_LABEL_CLASS}>一次店</label>
                <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
                  峠台A
                </div>
              </div>

              {/* 空 */}
              <div />
            </div>

            {/* 3行目: 5列グリッド */}
            <div className={`${SEARCH_GRID_CLASS} mb-2`}>
              {/* 事務所 */}
              <div className="flex items-center gap-2">
                <label className={SEARCH_LABEL_CLASS}>事業場</label>
                <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
                  首都圏
                </div>
              </div>

              {/* 部署 */}
              <div className="flex items-center gap-2">
                <label className={SEARCH_LABEL_CLASS}>部署</label>
                <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
                  首都圏営業第一
                </div>
              </div>

              {/* 営業担当者 */}
              <div className="flex items-center gap-2">
                <label className={SEARCH_LABEL_CLASS}>営業担当者</label>
                <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
                  xxxxxx
                </div>
              </div>

              {/* 空 */}
              <div />
            </div>
          </div>
        </CollapsibleCard>

        <div className="flex flex-col gap-4">
          {/* ロケ契約料一覧 */}
          <CollapsibleCard
            title="ロケ契約料一覧"
            open={isSalesPlanOpen}
            onOpenChange={setIsSalesPlanOpen}
            className="mb-0"
          >
            <div className="p-4">
              {/* 最左にチェックボックス列を表示（計画一覧に準拠）。単一選択で借方・貸方カードを表示する。 */}
              <div className="sales-plan-grid overflow-x-auto w-full">
                <AgGridReact
                  rowData={locationContractRowData}
                  context={locationContractGridContext}
                  onCellValueChanged={handleLocationContractCellValueChanged}
                  getRowId={getRecordRowId}
                  columnDefs={locationContractColumnDefs}
                  defaultColDef={defaultColDef}
                  // defaultColDef で filter: false のため、型によるフィルタの追加を止める（→ grid/gridCommon）
                  columnTypes={GRID_NO_FILTER_COLUMN_TYPES}
                  suppressMovableColumns={true}
                  domLayout="autoHeight"
                  rowSelection={{
                    mode: 'singleRow',
                    checkboxes: true,
                    enableClickSelection: false,
                  }}
                  selectionColumnDef={{
                    width: 40,
                    resizable: false,
                    suppressMovable: true,
                    suppressHeaderMenuButton: true,
                    // チェックボックスをセルの中央に配置する
                    cellClass: 'cell-center',
                  }}
                  onSelectionChanged={(event) =>
                    setHasSelectedRow(event.api.getSelectedNodes().length > 0)
                  }
                  statusBar={GRID_STATUS_BAR}
                  {...GRID_BASE_PROPS}
                  {...locationContractColumnStateProps}
                />
              </div>
            </div>
          </CollapsibleCard>

          {/* 行選択時に表示する借方・貸方カード（2カラム並列） */}
          {hasSelectedRow && (
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* 借方カード（左） */}
              <div className={`${CARD_CLASS} overflow-hidden`}>
                <div className="card-header-accent bg-white px-3 pt-2 pb-4 flex items-center justify-between">
                  <span className="text-gray-900 font-bold text-lg">借方</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg"
                      onClick={() => handleAddDetail('debit')}
                    >
                      明細追加
                    </Button>
                    <Button
                      variant="outline"
                      disabled={debitSelectedIndex === null}
                      className="border-blue-600 text-blue-600 hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-700 rounded-lg"
                      onClick={() => handleUpdateDetail('debit')}
                    >
                      明細更新
                    </Button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex">
                    {/* 表外：選択列（単一選択チェックボックス）。中央の表と同じ体裁 */}
                    <div className="flex flex-col flex-shrink-0 pr-2">
                      <div className="h-8 flex items-center justify-center text-sm font-bold text-gray-700 whitespace-nowrap px-1">
                        選択
                      </div>
                      {debitRowData.map((_row, rowIndex) => (
                        <div
                          key={rowIndex}
                          className="h-9 flex items-center justify-center px-1"
                        >
                          <Checkbox
                            checked={debitSelectedIndex === rowIndex}
                            onCheckedChange={(value) =>
                              setDebitSelectedIndex(
                                value === true ? rowIndex : null
                              )
                            }
                            aria-label={`借方 ${rowIndex + 1}行目を選択`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="sales-plan-grid overflow-x-auto w-full">
                      <AgGridReact
                        rowData={debitRowData}
                        context={debitGridContext}
                        onCellValueChanged={handleDebitCellValueChanged}
                        {...debitColumnStateProps}
                        getRowId={getRecordRowId}
                        columnDefs={journalColumnDefs}
                        defaultColDef={defaultColDef}
                        // defaultColDef で filter: false のため、型によるフィルタの追加を止める（→ grid/gridCommon）
                        columnTypes={GRID_NO_FILTER_COLUMN_TYPES}
                        suppressMovableColumns={true}
                        domLayout="autoHeight"
                        statusBar={GRID_STATUS_BAR}
                        {...GRID_BASE_PROPS}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 貸方カード（右） */}
              <div className={`${CARD_CLASS} overflow-hidden`}>
                <div className="card-header-accent bg-white px-3 pt-2 pb-4 flex items-center justify-between">
                  <span className="text-gray-900 font-bold text-lg">貸方</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg"
                      onClick={() => handleAddDetail('credit')}
                    >
                      明細追加
                    </Button>
                    <Button
                      variant="outline"
                      disabled={creditSelectedIndex === null}
                      className="border-blue-600 text-blue-600 hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-700 rounded-lg"
                      onClick={() => handleUpdateDetail('credit')}
                    >
                      明細更新
                    </Button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex">
                    {/* 表外：選択列（単一選択チェックボックス）。中央の表と同じ体裁 */}
                    <div className="flex flex-col flex-shrink-0 pr-2">
                      <div className="h-8 flex items-center justify-center text-sm font-bold text-gray-700 whitespace-nowrap px-1">
                        選択
                      </div>
                      {creditRowData.map((_row, rowIndex) => (
                        <div
                          key={rowIndex}
                          className="h-9 flex items-center justify-center px-1"
                        >
                          <Checkbox
                            checked={creditSelectedIndex === rowIndex}
                            onCheckedChange={(value) =>
                              setCreditSelectedIndex(
                                value === true ? rowIndex : null
                              )
                            }
                            aria-label={`貸方 ${rowIndex + 1}行目を選択`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="sales-plan-grid overflow-x-auto w-full">
                      <AgGridReact
                        rowData={creditRowData}
                        context={creditGridContext}
                        onCellValueChanged={handleCreditCellValueChanged}
                        {...creditColumnStateProps}
                        getRowId={getRecordRowId}
                        columnDefs={journalColumnDefs}
                        defaultColDef={defaultColDef}
                        // defaultColDef で filter: false のため、型によるフィルタの追加を止める（→ grid/gridCommon）
                        columnTypes={GRID_NO_FILTER_COLUMN_TYPES}
                        suppressMovableColumns={true}
                        domLayout="autoHeight"
                        statusBar={GRID_STATUS_BAR}
                        {...GRID_BASE_PROPS}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* コンテンツとフッターの間の余白を吸収し、フッターをウィンドウ底部へ押し下げるスペーサー */}
      <div className="flex-1" aria-hidden="true" />

      {/* 固定フッター（計画詳細画面に準拠：高さ h-9 の btn-action-base。ルートで min-w-[75rem] 済みのため mt-4/min-w は付けない） */}
      <div
        data-screen-footer
        className="bg-white border-t border-gray-200 px-6 py-2 sticky bottom-0 z-10"
      >
        <div className="flex flex-wrap gap-3 justify-between">
          <div>
            <button
              className="btn-action-base btn-action-outline"
              aria-label="戻る"
            >
              <X className="h-4 w-4" />
              戻る
            </button>
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
            <FooterCommentField
              id="billing-unbilled-comment"
              value={commentInput}
              onChange={setCommentInput}
            />
            <button
              className="btn-action-base btn-action-red"
              aria-label="差戻し"
            >
              <Undo2 className="h-4 w-4" />
              差戻し
            </button>
            <button
              className="btn-action-base btn-action-green"
              aria-label="承認"
            >
              <Check className="h-4 w-4" />
              承認
            </button>
            <button
              className="btn-action-base btn-action-outline-blue"
              aria-label="引戻し"
            >
              <CornerUpLeft className="h-4 w-4" />
              引戻し
            </button>
            <button
              className="btn-action-base btn-action-green"
              aria-label="申請"
            >
              <Send className="h-4 w-4" />
              申請
            </button>
            <button
              className="btn-action-base btn-action-blue"
              aria-label="保存"
            >
              <Save className="h-4 w-4" />
              保存
            </button>
          </div>
        </div>
      </div>

      {/* 明細追加ペイン（借方／貸方の「明細追加」押下で表示）。
          一時保存で最初に押した側の表へ入力内容を保存し、戻るで入力を取り消して閉じる。 */}
      <BottomPane
        open={isDetailPaneShown}
        onClose={handleDetailBack}
        title={detailMode === 'edit' ? '明細更新' : '明細追加'}
        description={`${detailTarget === 'debit' ? '借方' : '貸方'}の明細を${
          detailMode === 'edit' ? '更新' : '追加'
        }します`}
        footer={
          <div className="flex flex-wrap gap-3">
            {/* 承認回付（使用可） */}
            <Button className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg">
              承認回付
            </Button>
            {/* 伝票確認（使用可） */}
            <Button
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              伝票確認
            </Button>
            {/* 一時保存（使用可）→ 最初に押した側の表へ保存 */}
            <Button
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg"
              onClick={handleDetailTempSave}
            >
              <Save className="h-4 w-4 mr-2" />
              一時保存
            </Button>
            {/* 戻る（入力取消・ペイン非表示） */}
            <Button
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg"
              onClick={handleDetailBack}
            >
              <X className="h-4 w-4 mr-2" />
              戻る
            </Button>
          </div>
        }
      >
        {/* 表の値を設定する入力欄（JOURNAL_COLUMNS の各列に対応） */}
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 @md:grid-cols-2 @2xl:grid-cols-3">
          {JOURNAL_COLUMNS.map((col) => (
            <div key={col.field} className="space-y-1.5">
              <Label
                htmlFor={`journal-detail-${col.field}`}
                className="text-sm font-medium text-gray-700"
              >
                {col.headerName}
                {col.required && <RequiredBadge />}
              </Label>
              <Input
                id={`journal-detail-${col.field}`}
                aria-required={col.required || undefined}
                className={TEXT_INPUT_CLASS}
                value={detailForm[col.field] || ''}
                onChange={(e) =>
                  handleDetailFieldChange(col.field, e.target.value)
                }
              />
            </div>
          ))}
        </div>
      </BottomPane>
    </div>
  );
}
