// Todo：朴：C追加口・拡売費支払モック修正中
import {
  useMemo,
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { AgGridReact } from 'ag-grid-react';
import { toast } from 'sonner';
import {
  ColDef,
  ColGroupDef,
  ICellRendererParams,
  IHeaderParams,
  CellValueChangedEvent,
  CellMouseOverEvent,
  GetRowIdParams,
} from 'ag-grid-community';
import {
  Trash2,
  ArrowLeftRight,
  Upload,
  Copy,
  ChevronDown,
  Undo2,
} from 'lucide-react';

import {
  GRID_DEFAULT_COL_DEF,
  GRID_BASE_PROPS,
  GRID_STATUS_BAR,
  GRID_COLORS,
  gridFilterContextMenuItems,
  withHeaderTooltips,
  useChangedCells,
  useGridColumnState,
  useRevealNewRows,
  viewportGridHeight,
  GRID_NUMBER_TEXT_FILTER,
  GRID_NUMBER_FILTER,
  GRID_EMPTY_TEXT,
  asCellStyle,
} from '@/components/grid';
import { SingleComboboxCellEditor } from '@/components/ui/single-combobox-cell-editor';
// 枝番行（振替先行）の管理区分〜施策コードは、費用振替の振替先明細と同じ
// 選択肢ビルダー・同じ名称/コード変換を使う（列の関係と候補データを揃えるため）。
import {
  campaignClassCode,
  managementClassCode,
  managementClassComboOptions,
  managementCodeComboOptions,
  campaignClassComboOptions,
  campaignCodeComboOptions,
} from '@/utils/payment/payment-detail/paymentComboFieldOptions';
import {
  managementCodeNameComboOptions,
  campaignCodeNameComboOptions,
} from '@/constants/comboFieldOptions';
import {
  managementCodeNameOf,
  managementCodeOfName,
  campaignCodeNameOf,
  campaignCodeOfName,
} from '@/utils/common/comboFieldOptions';
import {
  EXPENSE_MANAGEMENT_CODE_OPTIONS,
  EXPENSE_CAMPAIGN_CODE_OPTIONS,
} from '@/constants/expenseRelations';
import {
  managementClassFromCode,
  isManagementCodeInClass,
  campaignClassFromCode,
  isCampaignCodeInClass,
} from '@/utils/common/expenseRelations';
import {
  // 一次店/三次店/販売店は振替先明細（費用振替）と同じ商流マスタを使う。
  STORE_NONE,
  PRIMARY_STORE_OPTIONS,
  tertiaryOptionsFor,
  storeOptionsFor,
} from '@/constants/storeHierarchy';
import {
  deptOptionsFor,
  staffOptionsFor,
  applyStoreOrgCascade,
} from '@/utils/payment/payment-detail/paymentOrgCascade';
import type { StoreOrgSelection } from '@/types/organization';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import type { TransferDetailBasicInfoValues } from './TransferInfo';

import { BUTTON_STYLES, BUTTON_BASE } from '@/styles/commonStyles';

// 拡売費明細データ（Excel「拡売費」表）
export interface ExpenseRow {
  isGroup?: boolean; // グループ合計行
  isTotal?: boolean; // 総合計行
  lineNo: number | string; // 行番
  paymentNo: string; // 支払No
  paymentCount: number | string; // 支払回数
  detailNo: number | string; // 明細No
  billName: string; // 卸からの請求名称
  planExpContent: string; // 販売計画に記載の拡売費内容
  metaBrand: string; // メタブランド
  product: string; // 商品
  payAmount: number | string; // 支払金額
  planAmount: number | string; // 計画金額
  taxRate: number | string; // 税率
  taxClass: string; // 税区分
  costSplit: string; // 費用分割（ボタン以外のテキスト：分割先 等）
  mgmtClass: string; // 管理区分（コード）
  mgmtClassName: string; // 管理区分名称
  mgmtCode: string; // 管理コード（コード）
  mgmtCodeName: string; // 管理コード名称
  measureClass: string; // 施策区分
  measureCode: string; // 施策コード
  // 振替元（当明細）の費用負担部署・販売店・三次店・一次店。
  // 振替先の同項目は split* フィールド（振替先グループ列）で保持する。
  dept: string; // 費用負担部署
  store: string; // 販売店
  tertiaryStore: string; // 三次店
  primaryStore: string; // 一次店
  approvalNo: string; // 稟議決裁番号
  approvalDate: string; // 稟議決裁日
  summary1: string; // 摘要1（社内用）
  summary2: string; // 摘要2（社外用）
  accountAmount: number | string; // 勘定科目別金額
  taxAmount: number | string; // 税額
  planDiff: number | string; // 計画差異
  diffReason: string; // 差異理由
  billNo: string; // 請求書番号
  billPage: string; // 請求書ページ
  // 以下は列を持たず、行データとしてのみ保持する項目（画面には表示しない）。
  postingMonth: string; // 計上年月
  targetMonth: string; // 対象年月
  office: string; // 事業場
  terminalOrg: string; // 末端組織
  staff: string; // 営業担当者
  // 支払先（コード:名称）。振替元の支払伝票と同等に保持する（列は持たない）。
  payee: string;
  // 商流・組織（一次店〜担当者）。枝番行（「X-N」の振替先行）が振替先の値として保持し、
  // 「一次店」〜「担当者」列に表示する（親行は上の primaryStore〜staff を表示する）。
  splitDept?: string; // 振替先の費用負担部署
  splitStore?: string; // 振替先の販売店
  splitTertiaryStore?: string; // 振替先の三次店
  splitPrimaryStore?: string; // 振替先の一次店
  splitStaff?: string; // 振替先の担当者
  // 列を持たない項目（枝番行のみが保持する）。
  splitOffice?: string; // 振替先の事業場
  // 振替先の末端組織。④（末端組織のみに紐づく支払）では振替先を末端組織で特定する。
  splitTerminalOrg?: string;
}

// 検印済み明細（振替元）から振替明細へ移動する明細の項目
//（ReferenceTable の ReferenceRow から行識別用の no を除いたもの）。
export interface TransferredDetail {
  paymentNo: string; // 支払No
  paymentCount: number | string; // 支払回数
  detailNo: number | string; // 明細No
  metaBrand: string; // メタブランド
  product: string; // 商品
  payAmount: number | string; // 支払金額
  mgmtClass: string; // 管理区分（コード）
  mgmtClassName: string; // 管理区分名称
  mgmtCode: string; // 管理コード（コード）
  mgmtCodeName: string; // 管理コード名称
  measureClass: string; // 施策区分
  measureCode: string; // 施策コード
  dept: string; // 費用負担部署
  store: string; // 販売店
  tertiaryStore: string; // 三次店
  primaryStore: string; // 一次店
  summary1: string; // 摘要1（社内用）
  summary2: string; // 摘要2（社外用）
  // 画面に表示しない項目（移動先でも保持する）。
  postingMonth: string; // 計上年月
  targetMonth: string; // 対象年月
  office: string; // 事業場
  terminalOrg: string; // 末端組織
  staff: string; // 営業担当者
  payee: string; // 支払先（コード:名称）
}

export interface NonProductExpensePaneHandle {
  // 検印済み明細（振替元）の「振替処理」で移動してきた明細を、一覧の最終行に追加する。
  // 追加した行に採番した No. を返す。
  addTransferredRow: (detail: TransferredDetail) => number;
}

interface NonProductExpensePaneProps {
  // 削除ボタン押下で当一覧から取り除いた行を親へ通知する。
  // 親は振替元行のみ検印済み明細（振替元）へ戻す（枝番行＝振替先行は戻さない）。
  onMoveRowToReference?: (data: ExpenseRow) => void;
  // 振替詳細の基本情報の現在値。枝番行の商流・組織列（一次店〜担当者）の活性判定
  //（「振替元を固定する」＝活性／「振替先を固定する」＝非活性）と、
  // 「振替処理」で追加する枝番行の初期値に使う。
  basicInfo?: TransferDetailBasicInfoValues;
  // ヘッダの「根拠資料格納」ボタン押下時のハンドラ
  //（支払詳細(追加口請求書有)の支払情報ヘッダと同テーマのボタン）。
  onOpenAttachment?: () => void;
  // 枝番行（振替先行）が1本でもあるかを親へ通知する。
  // 親は基本情報の固定指定を切り替える際、確認ダイアログの要否判定に使う。
  onBranchRowsChange?: (hasBranchRows: boolean) => void;
}

// 行操作のレンダラー。枝番なしの行は 振替処理／振替元へ戻す、
// 枝番付きの行は コピー／削除。ケバブメニュー（三点リーダー）は廃止し、
// 各操作をアイコンボタンとしてセル内に直接並べる（他画面の行アクション列と同形式）。
// 合計行・グループ合計行は非表示。
const RowMenuCellRenderer = (props: ICellRendererParams) => {
  if (props.data?.isTotal || props.data?.isGroup) return null;
  const { onTransfer, onCopyRow, onDeleteRow } = props.context;
  // 振替先行（「No.-枝番」の枝番行）は、さらに振替できないため非活性にする。
  const isTransferDest = props.data?.costSplit === '分割先';
  // 振替処理は親行（振替元行）で常に活性。固定する側（振替元／振替先）も、
  // 当該親行が既に枝番行を持つかどうかも問わない
  // （「振替先を固定する」でも、経費項目を分けた枝番行を複数追加できるようにする）。
  const isTransferDisabled = isTransferDest;
  // コピーは枝番行（振替先行）のみ活性。固定する側（振替元／振替先）は問わない。
  //   枝番行はgrid内で振替先ごとの値を編集できるため複製できるようにする。
  //   「振替先を固定する」でも、商流・組織は基本情報の値のまま経費項目（管理区分〜摘要2）
  //   だけを分けた枝番行を作りたいため活性のままとする。
  //   親行（振替元行）は検印済み明細から移動した明細のため非活性。
  const isCopyEnabled = isTransferDest;
  return (
    <div className="flex items-center justify-center gap-1 h-full">
      {/* 振替処理：押下で当該親行に枝番行（振替先行）を1行追加する（振替先行のみ非活性）。 */}
      <button
        onClick={
          isTransferDisabled ? undefined : () => onTransfer?.(props.data)
        }
        disabled={isTransferDisabled}
        className={
          isTransferDisabled
            ? 'text-gray-400 p-1 rounded cursor-not-allowed'
            : 'text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none'
        }
        aria-label="振替処理"
        title="振替処理"
      >
        <ArrowLeftRight className="w-4 h-4" />
      </button>
      {/* コピー：押下で当該枝番行を複製する（枝番行のみ活性）。 */}
      <button
        onClick={isCopyEnabled ? () => onCopyRow?.(props.data) : undefined}
        disabled={!isCopyEnabled}
        className={
          isCopyEnabled
            ? 'text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 transition-colors focus:ring-2 focus:ring-green-500 focus:outline-none'
            : 'text-gray-400 p-1 rounded cursor-not-allowed'
        }
        aria-label="コピー"
        title="コピー"
      >
        <Copy className="w-4 h-4" />
      </button>
      {/* 枝番付きの行は「削除」、枝番なしの行は「振替元へ戻す」。
          決定事項4は「削除ボタンは枝番付きの行に設ける」としているが、枝番なしの行の
          操作はデータを消すのではなく検印済み明細（振替元）へ差し戻すものであり、
          振替対象を選び間違えた際に戻す唯一の手段のため、名称とアイコンを分けて残す。 */}
      {isTransferDest ? (
        <button
          onClick={() => onDeleteRow?.(props.data)}
          className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors focus:ring-2 focus:ring-red-500 focus:outline-none"
          aria-label="削除"
          title="削除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={() => onDeleteRow?.(props.data)}
          className="text-orange-500 hover:text-orange-700 p-1 rounded hover:bg-orange-50 transition-colors focus:ring-2 focus:ring-orange-500 focus:outline-none"
          aria-label="振替元へ戻す"
          title="振替元へ戻す（検印済み明細に戻します）"
        >
          <Undo2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// 枝番行（振替先行）の判定と、枝番行の No.「親No.-枝番」から親行の No. を取り出す関数。
// 折りたたみ・コピーの採番で使う（支払詳細(追加口請求書有) の拡売費一覧と同方式）。
const isBranchData = (row?: ExpenseRow) => row?.costSplit === '分割先';
const parentLineNoOfRow = (row: ExpenseRow): string | null => {
  const lineNo = String(row.lineNo ?? '');
  const dash = lineNo.lastIndexOf('-');
  return dash < 0 ? null : lineNo.slice(0, dash);
};

// 枝番行（振替先行）を1本組み立てる。「振替処理」での追加と、
// 検印済み明細から移動した直後の自動生成（決定事項25の読み替え）の双方で使う。
// 経費項目（管理区分〜摘要2）は固定する側にかかわらず振替元の値を引き継ぐ（決定事項4）。
// 商流・組織のみ固定する側で変わる。
//   振替元を固定する … 親行（振替元）の値を初期表示する（編集可）
//   振替先を固定する … 基本情報の値（編集不可）
const buildBranchRow = (
  parent: ExpenseRow,
  info: TransferDetailBasicInfoValues | undefined,
  branchNo: number
): ExpenseRow => {
  const destFixed = info?.executor === 'destination';
  // 基本情報の未選択（一次店・三次店＝空、販売店＝「-」）は値なしとして扱う。
  const selected = (v: string | undefined) => (v && v !== STORE_NONE ? v : '');
  return {
    ...BLANK,
    lineNo: `${parent.lineNo}-${branchNo}`,
    costSplit: '分割先',
    // 枝番行が親行から再掲する列（卸からの請求名称・商品 等）は親行の値を引き継ぐ。
    billName: parent.billName,
    planExpContent: parent.planExpContent,
    metaBrand: parent.metaBrand,
    product: parent.product,
    // 負担金額は未入力（0）から始め、利用者が振替先の負担分を入力する。
    payAmount: 0,
    planAmount: 0,
    // 列を持たない項目（計上年月・対象年月・事業場・末端組織・担当者・支払先）は親行から引き継ぐ。
    postingMonth: parent.postingMonth,
    targetMonth: parent.targetMonth,
    office: parent.office,
    terminalOrg: parent.terminalOrg,
    staff: parent.staff,
    payee: parent.payee,
    // 経費項目（管理区分〜摘要2）は固定する側にかかわらず振替元の値をデフォルト表示する
    //（20260728_第24回 決定事項4。いずれも変更可能）。
    mgmtClass: parent.mgmtClass,
    mgmtClassName: parent.mgmtClassName,
    mgmtCode: parent.mgmtCode,
    mgmtCodeName: parent.mgmtCodeName,
    measureClass: parent.measureClass,
    measureCode: parent.measureCode,
    summary1: parent.summary1,
    summary2: parent.summary2,
    // 商流・組織は固定する側で変わる。
    ...(destFixed
      ? {
          // 振替先を固定する：基本情報の値（枝番行では編集不可）。
          splitPrimaryStore: selected(info?.primaryStore),
          splitTertiaryStore: selected(info?.tertiaryStore),
          splitStore: selected(info?.store),
          splitDept: info?.dept ?? '',
          splitStaff: info?.staff ?? '',
          splitOffice: info?.office ?? '',
          splitTerminalOrg: info?.terminalOrg ?? '',
        }
      : {
          // 振替元を固定する：親行（振替元）の値を初期表示する。
          splitPrimaryStore: parent.primaryStore,
          splitTertiaryStore: parent.tertiaryStore,
          splitStore: parent.store,
          splitDept: parent.dept,
          splitStaff: parent.staff,
          splitOffice: parent.office,
          splitTerminalOrg: parent.terminalOrg,
        }),
  };
};

// 行ID（AG Grid 公式 getRowId）。No.（lineNo）は親行＝最大 No.＋1、枝番行＝「親No.-枝番」
// （既存の最大枝番＋1）で採番され一覧内で重複せず、セル編集でも変わらない。
// モジュール直下に置いて参照を固定する（→ 02 §7.1）。
const getExpenseRowId = (params: GetRowIdParams<ExpenseRow>): string =>
  String(params.data.lineNo);

// 当該親行に次へ追加する枝番行の枝番（既存の枝番行の最大枝番＋1）。
// 「振替処理」での追加と「コピー」での複製の双方で使う。
const nextBranchNo = (rows: ExpenseRow[], parentKey: string): number =>
  rows
    .filter((r) => isBranchData(r) && parentLineNoOfRow(r) === parentKey)
    .reduce((max, r) => {
      const no = String(r.lineNo);
      const n = Number(no.slice(no.lastIndexOf('-') + 1));
      return Number.isFinite(n) && n > max ? n : max;
    }, 0) + 1;

// 枝番行の挿入位置＝当該親行（parentIdx）に紐づく既存の枝番行の直後。
const branchInsertAt = (
  rows: ExpenseRow[],
  parentIdx: number,
  parentKey: string
): number => {
  let insertAt = parentIdx + 1;
  while (
    insertAt < rows.length &&
    isBranchData(rows[insertAt]) &&
    parentLineNoOfRow(rows[insertAt]) === parentKey
  ) {
    insertAt += 1;
  }
  return insertAt;
};

// 折りたたみ機能列のヘッダー。枝番行（振替先行）であることを示す振替のアイコンを置き、
// 押下で枝番行を一括開閉する（全て展開中なら全て折りたたみ、それ以外は全て展開）。
// セル側の折りたたみボタンと同じ幅（w-5）にして縦位置を揃える。
// 枝番行が1件もないときは非活性（灰）にする。
const TransferBranchCollapseHeader = (props: IHeaderParams) => {
  // ヘッダーは生成時の params を保持し続けるため、params.context では古い関数を
  // 参照することがある。AG Grid 公式の getGridOption で常に最新の context を読む。
  const { hasAnyBranch, isAllBranchExpanded, onToggleAllCollapse } =
    props.api.getGridOption('context') ?? props.context;
  const enabled = hasAnyBranch();
  const expanded = enabled && isAllBranchExpanded();
  const action = `振替先の枝番行を全て${expanded ? '折りたたむ' : '展開'}`;
  return (
    <div className="flex h-full w-full items-center justify-start">
      <button
        type="button"
        disabled={!enabled}
        onClick={() => onToggleAllCollapse()}
        className={`flex h-5 w-5 items-center justify-center rounded focus:ring-2 focus:ring-blue-500 focus:outline-none ${
          enabled
            ? 'text-blue-600 hover:bg-gray-200'
            : 'cursor-not-allowed text-gray-400'
        }`}
        aria-expanded={expanded}
        aria-label={enabled ? action : '振替先の枝番行なし'}
        title={enabled ? action : '振替先の枝番行なし'}
      >
        <ArrowLeftRight className="h-4 w-4" />
      </button>
    </div>
  );
};

// 枝番行の折りたたみボタン（親行の左端）。
// アイコンはカードの折りたたみ（CollapsibleCard）と揃えて ChevronDown を使い、
// 「∨」＝折りたたみ中（枝番行を隠している）、「∧」（180度回転）＝展開中とする。
// 親行以外（枝番行・合計行）と、枝番行を持たない親行では表示しない。
const TransferBranchCollapseCellRenderer = (props: ICellRendererParams) => {
  const row = props.data as ExpenseRow | undefined;
  if (!row || row.isGroup || row.isTotal || isBranchData(row)) return null;
  const { hasBranch, isCollapsed, onToggleCollapse } = props.context;
  const lineNo = row.lineNo;
  if (!hasBranch(lineNo)) return null;
  const collapsed = isCollapsed(lineNo);
  const action = `振替先の枝番行を${collapsed ? '展開' : '折りたたむ'}`;
  return (
    <div className="flex h-full items-center justify-center">
      <button
        type="button"
        onClick={() => onToggleCollapse(lineNo)}
        className="flex h-5 w-5 items-center justify-center rounded text-gray-700 hover:bg-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        aria-expanded={!collapsed}
        aria-label={action}
        title={action}
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform ${
            collapsed ? '' : 'rotate-180'
          }`}
        />
      </button>
    </div>
  );
};

// 税区分が裏で持つ税率（パーセントの数値）。税込(円)の計算に使用する。
const TAX_RATE_BY_CLASS: Record<string, number> = {
  '1:課税10%': 0.1,
  '2:課税8%': 0.08,
  '3:その他(5%)': 0.05,
  '4:その他(非課税)': 0,
};

// 税区分の文字列から税率（パーセントの数値）を取得する（不明時は0）。
const taxRateFromClass = (taxClass: unknown): number =>
  TAX_RATE_BY_CLASS[String(taxClass ?? '')] ?? 0;

// 空セル既定値（各行はこれを基にした差分のみ記述）
const BLANK: ExpenseRow = {
  lineNo: '',
  terminalOrg: '',
  paymentNo: '',
  paymentCount: '',
  detailNo: '',
  billName: '',
  planExpContent: '',
  metaBrand: '',
  product: '',
  payAmount: '',
  planAmount: '',
  taxRate: '',
  taxClass: '',
  costSplit: '',
  mgmtClass: '',
  mgmtClassName: '',
  mgmtCode: '',
  mgmtCodeName: '',
  measureClass: '',
  measureCode: '',
  dept: '',
  store: '',
  tertiaryStore: '',
  primaryStore: '',
  approvalNo: '',
  approvalDate: '',
  summary1: '',
  summary2: '',
  accountAmount: '',
  taxAmount: '',
  planDiff: '',
  diffReason: '',
  billNo: '',
  billPage: '',
  postingMonth: '',
  targetMonth: '',
  office: '',
  staff: '',
  payee: '',
  splitDept: '',
  splitStore: '',
  splitTertiaryStore: '',
  splitPrimaryStore: '',
  splitOffice: '',
  splitStaff: '',
  splitTerminalOrg: '',
};

const EXPENSE_ROWS: ExpenseRow[] = [
  {
    ...BLANK,
    lineNo: 1,
    paymentNo: 'C2400NTO1',
    paymentCount: 1,
    detailNo: 1,
    dept: '10002990:首都圏営業第二部',
    store: '21100677:イオンリテール',
    tertiaryStore: '10863223:イオン東北ＲＤＣ',
    primaryStore: '10888030:三菱食品株式会社（イオン）',

    payee: '10888030:三菱食品株式会社（イオン）',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '10000623:首都圏本部',
    terminalOrg: '10002990:首都圏営業第二部',
    staff: '5172733:アサヒ　太郎',
    billName: 'アサヒ飲料 ワンダ モーニングショット ６Ｐ アプリ20',
    planExpContent: 'ワンダ モーニングショット アプリ20%キャンペーン',
    metaBrand: 'ワンダ',
    product: 'ワンダモーニングショット６ＰＮ',
    payAmount: 57433,
    planAmount: 56000,
    taxRate: 0.08,
    taxClass: '2:課税8%',
    mgmtClass: '10',
    mgmtClassName: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    mgmtCodeName: '店頭定番販促',
    approvalNo: '12345',
    approvalDate: '2025/07/29',
    measureClass: '販売促進',
    measureCode: 'SP001',
    billNo: '457801SA',
    accountAmount: 57433,
    taxAmount: 4595,
    planDiff: 1433,
    summary1: 'アプリ施策の値引き原資（社内）',
    summary2: 'アプリ20%相当の販促値引（社外）',
    diffReason: '実績差による調整',
    billPage: '①02',
  },
  // 費用分割先（ワンダ モーニングショットの分割明細）
  {
    ...BLANK,
    lineNo: '1-1',
    billName: 'アサヒ飲料 ワンダ モーニングショット ６Ｐ アプリ20',
    planExpContent: 'ワンダ モーニングショット アプリ20%キャンペーン',
    metaBrand: 'ワンダ',
    product: 'ワンダモーニングショット６ＰＮ',
    // 枝番行の payAmount は「負担金額」列（＝振替先グループの「振替金額」）の値。
    payAmount: 20000,
    costSplit: '分割先',
    mgmtClass: '10',
    mgmtClassName: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    mgmtCodeName: '店頭定番販促',
    // 施策区分・施策コード（振替先グループの施策4列で表示する）。
    measureClass: '販売促進',
    measureCode: 'SP001',
    summary1: '東日本支社より分割',
    summary2: 'アプリ20%相当の販促値引（社外）',
    splitPrimaryStore: '10888030:三菱食品株式会社（イオン）',
    splitTertiaryStore: '10863223:イオン東北ＲＤＣ',
    splitStore: '21100677:イオンリテール',
    splitDept: '10002990:首都圏営業第二部',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '10000623:首都圏本部',
    terminalOrg: '10002990:首都圏営業第二部',
    staff: '5172733:アサヒ　太郎',
    splitOffice: '10000623:首都圏本部',
    splitStaff: '5172733:アサヒ　太郎',
  },
  {
    ...BLANK,
    lineNo: '1-2',
    billName: 'アサヒ飲料 ワンダ モーニングショット ６Ｐ アプリ20',
    planExpContent: 'ワンダ モーニングショット アプリ20%キャンペーン',
    metaBrand: 'ワンダ',
    product: 'ワンダモーニングショット６ＰＮ',
    // 枝番行の payAmount は「負担金額」列（＝振替先グループの「振替金額」）の値。
    payAmount: 10000,
    costSplit: '分割先',
    mgmtClass: '60',
    mgmtClassName: '拡売費(固定費)本社口',
    mgmtCode: 'FH001',
    mgmtCodeName: '本社広告枠',
    // 施策区分・施策コード（振替先グループの施策4列で表示する）。
    measureClass: '新規導入',
    measureCode: 'SN001',
    summary1: '中部支社より分割',
    splitPrimaryStore: '10888032:加藤産業株式会社',
    splitTertiaryStore: '10863225:イオン中部ＲＤＣ',
    splitStore: '21100678:マックスバリュ東海',
    splitDept: '10003002:中部営業部',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '10000623:首都圏本部',
    terminalOrg: '10002990:首都圏営業第二部',
    staff: '5172733:アサヒ　太郎',
    splitOffice: '10000631:中部本部',
    splitStaff: '5172735:アサヒ　次郎',
  },
  {
    ...BLANK,
    lineNo: 2,
    paymentNo: 'C2400NTO1',
    paymentCount: 1,
    detailNo: 2,
    dept: '10002990:首都圏営業第二部',
    store: '21100677:イオンリテール',
    tertiaryStore: '10863223:イオン東北ＲＤＣ',
    primaryStore: '10888030:三菱食品株式会社（イオン）',

    payee: '10888030:三菱食品株式会社（イオン）',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '10000623:首都圏本部',
    terminalOrg: '10002990:首都圏営業第二部',
    staff: '5172733:アサヒ　太郎',
    billName: 'アサヒ飲料 ワンダ アプリエントリーキャンペーン費',
    planExpContent: 'アサヒ飲料アプリ 会員エントリー費',
    metaBrand: '-',
    product: '-',
    payAmount: 200,
    planAmount: 200,
    taxRate: 0.1,
    taxClass: '1:課税10%',
    mgmtClass: '60',
    mgmtClassName: '拡売費(固定費)本社口',
    mgmtCode: 'FH001',
    mgmtCodeName: '本社広告枠',
    approvalNo: '12346',
    approvalDate: '2025/07/20',
    measureClass: '新規導入',
    measureCode: 'SN001',
    billNo: '457802SA',
    accountAmount: 200,
    taxAmount: 20,
    planDiff: 0,
    summary1: 'アプリ会員エントリー費（社内）',
    summary2: 'アプリ会員登録キャンペーン（社外）',
    diffReason: '差異なし',
    billPage: '①02',
  },
  {
    ...BLANK,
    lineNo: 3,
    paymentNo: 'C2400NTO1',
    paymentCount: 2,
    detailNo: 3,
    dept: '10002990:首都圏営業第二部',
    store: '21100677:イオンリテール',
    tertiaryStore: '10863223:イオン東北ＲＤＣ',
    primaryStore: '10888030:三菱食品株式会社（イオン）',

    payee: '10888045:伊藤忠食品株式会社',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '10000623:首都圏本部',
    terminalOrg: '10002990:首都圏営業第二部',
    staff: '5172733:アサヒ　太郎',
    billName: 'アサヒ飲料 三ツ矢サイダー 試飲会費用　30店日',
    planExpContent: '三ツ矢サイダー 店頭試飲会（30店日）',
    metaBrand: '-',
    product: '-',
    payAmount: 600,
    planAmount: 0,
    taxRate: 0.1,
    taxClass: '1:課税10%',
    mgmtClass: '40',
    mgmtClassName: '拡売費(固定費)A口',
    mgmtCode: 'FA001',
    mgmtCodeName: '什器設置費',
    approvalNo: '12347',
    approvalDate: '2025/07/22',
    measureClass: 'スポット',
    measureCode: 'SS001',
    billNo: '457803SA',
    accountAmount: 600,
    taxAmount: 60,
    planDiff: 600,
    summary1: '店頭試飲会の実施費用（社内）',
    summary2: '試飲会30店日分の実施（社外）',
    diffReason: '条修正漏れ',
    billPage: '①02',
  },
  {
    ...BLANK,
    lineNo: 4,
    paymentNo: 'C2400NTO2',
    paymentCount: 1,
    detailNo: 1,
    dept: '10002990:首都圏営業第二部',
    store: '21100677:イオンリテール',
    tertiaryStore: '10863223:イオン東北ＲＤＣ',
    primaryStore: '10888030:三菱食品株式会社（イオン）',

    payee: '10888045:伊藤忠食品株式会社',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '10000623:首都圏本部',
    terminalOrg: '10002990:首都圏営業第二部',
    staff: '5172733:アサヒ　太郎',
    billName: 'アサヒ飲料 ウィルキンソン 棚替え協力費',
    planExpContent: 'ウィルキンソン 新商品棚替え作業協力金',
    payAmount: 30000,
    planAmount: 28000,
    taxRate: 0.1,
    taxClass: '1:課税10%',
    mgmtClass: '60',
    mgmtClassName: '拡売費(固定費)本社口',
    mgmtCode: 'FH001',
    mgmtCodeName: '本社広告枠',
    approvalNo: '12348',
    approvalDate: '2025/07/25',
    measureClass: 'リピート',
    measureCode: 'SR001',
    accountAmount: 30000,
    taxAmount: 3000,
    planDiff: 2000,
    summary1: '棚替え什器協力費（社内）',
    summary2: '新商品棚替え協力（社外）',
    diffReason: '実績差による調整',
    billNo: '457804SA',
    billPage: '①02',
  },
  {
    ...BLANK,
    lineNo: 5,
    paymentNo: 'C2400NTO2',
    paymentCount: 1,
    detailNo: 2,
    dept: '10002990:首都圏営業第二部',
    store: '21100677:イオンリテール',
    tertiaryStore: '10863223:イオン東北ＲＤＣ',
    primaryStore: '10888030:三菱食品株式会社（イオン）',

    payee: '10888062:加藤産業株式会社',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '10000623:首都圏本部',
    terminalOrg: '10002990:首都圏営業第二部',
    staff: '5172733:アサヒ　太郎',
    billName: 'アサヒ飲料 三ツ矢サイダーＰＥＴ５００ 店頭企画',
    planExpContent: '三ツ矢サイダー 店頭販促企画',
    metaBrand: '三ツ矢',
    product: '三ツ矢サイダーＰＥＴ５００',
    payAmount: 12000,
    planAmount: 12000,
    taxRate: 0.08,
    taxClass: '2:課税8%',
    mgmtClass: '60',
    mgmtClassName: '拡売費(固定費)本社口',
    mgmtCode: 'FH001',
    mgmtCodeName: '本社広告枠',
    approvalNo: '12349',
    approvalDate: '2025/07/26',
    measureClass: 'リピート',
    measureCode: 'SR002',
    accountAmount: 12000,
    taxAmount: 960,
    planDiff: 0,
    summary1: '店頭販促企画の販促費（社内）',
    summary2: '三ツ矢サイダー店頭企画（社外）',
    diffReason: '差異なし',
    billNo: '457805SA',
    billPage: '①02',
  },
];

// タイトル下の合計サマリーバーの表示値（支払金額と、振替先行の支払金額合計＝振替金額）。
// 残金額（支払−振替）は両者から算出するため保持しない。
type ExpenseSummary = {
  grandPay: number;
  transferPay: number;
};

// サマリーバーの初期値（初回描画後は applyExpenseFormulas が再集計して上書き）。
const INITIAL_SUMMARY: ExpenseSummary = {
  // 支払金額＝「支払金額」列の合計（振替先行は同列が空欄のため含まない）。
  grandPay: 100233,
  // 振替金額＝「振替金額」列（振替先グループ）の合計。
  transferPay: 30000,
};

// サマリーバー用の数値整形（整数・カンマ区切り）。
const fmtPay = (n: number): string => Math.round(n).toLocaleString();

// 整数表示（小数点以下を四捨五入、カンマ区切り、空は「-」、文字列はそのまま）
const intFmt = (params: { value: unknown }) => {
  const v = params.value;
  if (v === '' || v === null || v === undefined) return GRID_EMPTY_TEXT;
  if (typeof v === 'number') {
    return Math.round(v).toLocaleString();
  }
  return String(v);
};

// 値を数値化する（カンマ区切り文字列も可）。数値化できなければ null。
const toNum = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === '' || v === null || v === undefined || v === '-') return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

// 明細行の派生項目を再計算する。
//   税込(円)  = 支払金額G × 税率（税区分が裏で持つ%）＋ 支払金額G
//   計画差異X = 支払金額G − 計画金額H
const recalcExpenseRow = (row: ExpenseRow): void => {
  if (row.isGroup || row.isTotal) return;
  const rate = taxRateFromClass(row.taxClass);
  const pay = toNum(row.payAmount);
  const plan = toNum(row.planAmount);
  if (pay !== null) row.taxAmount = pay * rate + pay;
  if (pay !== null && plan !== null) row.planDiff = pay - plan;
};

// ツールチップ用に値を桁区切り文字列へ整形する（数値化できなければそのまま）。
const fmtN = (v: unknown): string => {
  const n = toNum(v);
  return n === null ? String(v ?? '') : n.toLocaleString();
};

// 計算式が設定された列（派生項目）の定義。
//   refs    : ハイライト対象の参照元フィールド（当該行内）。
//   tooltip : 当該行データから計算式テキスト（式＋実値）を生成する。
// Excel「拡売費」表の数式（recalcExpenseRow 参照）に対応する。
const FORMULA_DEFS: Record<
  string,
  {
    refs: (row: ExpenseRow) => string[];
    tooltip: (row: ExpenseRow) => string;
  }
> = {
  // 税込(円) = 支払金額G × 税率（税区分が裏で持つ%）＋ 支払金額G
  taxAmount: {
    refs: () => ['taxClass', 'payAmount'],
    tooltip: (r) =>
      `税込 ＝ 支払金額 × 税率 ＋ 支払金額 ＝ ${fmtN(r.payAmount)} × ${
        taxRateFromClass(r.taxClass) * 100
      }% ＋ ${fmtN(r.payAmount)}`,
  },
  // 計画差異X = 支払金額G − 計画金額H
  planDiff: {
    refs: () => ['payAmount', 'planAmount'],
    tooltip: (r) =>
      `計画差異 ＝ 支払金額 − 計画金額 ＝ ${fmtN(r.payAmount)} − ${fmtN(r.planAmount)}`,
  },
};

// 当該セルが計算式セルか判定する。グループ合計行・総合計行は対象外。
const isFormulaCell = (field: string | undefined, row: ExpenseRow) =>
  !!field && !row.isGroup && !row.isTotal && !!FORMULA_DEFS[field];

// 拡売費一覧の数式を一括適用する。
//  ・各明細の税額・計画差異を再計算
//  ・合計エリアの支払金額＝一覧の「支払金額」列の合計
//  ・合計エリアの振替金額＝枝番行（振替先行）の「負担金額」列の合計
const applyExpenseFormulas = (api: any): ExpenseSummary => {
  api.forEachNode((node: any) => {
    const d = node.data as ExpenseRow | undefined;
    if (!d || d.isTotal) return;
    recalcExpenseRow(d);
  });

  // 合計は一覧の列値をそのまま集計する（画面の表示と必ず一致させるため、
  // 行データではなく valueGetter 適用後のセル値＝api.getCellValue を合計する）。
  //   支払金額＝「支払金額」列（振替先行は空欄のため合計に含まれない）
  //   振替金額＝「負担金額」列のうち振替先行の分（＝振替先が負担する金額の合計）
  let grandPay = 0;
  let transferPay = 0;
  api.forEachNode((node: any) => {
    const d = node.data as ExpenseRow | undefined;
    if (!d || d.isTotal || d.isGroup) return;
    const cellValue = (colKey: string) =>
      toNum(api.getCellValue({ rowNode: node, colKey })) ?? 0;
    grandPay += cellValue('payAmount');
    if (d.costSplit === '分割先') transferPay += cellValue('shareAmount');
  });

  // 再計算結果をグリッドへ反映する。
  api.refreshCells({ force: true });
  return { grandPay, transferPay };
};

// 表の高さで画面の縦幅から引く分（rem。アプリのヘッダー・画面下部のボタンの列・カードの下の余白）。
// 最下部までスクロールした状態で、表が画面にちょうど収まる値（UX-099。実測で決めた値）。
const TRANSFER_GRID_OFFSET_REM = 10.25;

export const NonProductExpensePane = forwardRef<
  NonProductExpensePaneHandle,
  NonProductExpensePaneProps
>(function NonProductExpensePane(
  {
    onMoveRowToReference,
    basicInfo,
    onOpenAttachment,
    onBranchRowsChange,
  }: NonProductExpensePaneProps,
  ref
) {
  // カードの開閉状態（折り畳み。既定は展開）。
  const [isCardOpen, setIsCardOpen] = useState(true);

  // 明細行（振替処理での枝番行追加・検印済み明細の移動で増減するため state で保持）。
  const [rows, setRows] = useState<ExpenseRow[]>(EXPENSE_ROWS);
  // 列定義（useMemo で固定）の valueGetter から最新の行一覧を参照するための ref。
  // 枝番行が親行（振替元行）の値を表示するために使う。
  const rowsRef = useRef<ExpenseRow[]>(rows);
  rowsRef.current = rows;

  // 列定義（useMemo で固定）の活性判定・連動から最新の基本情報を参照するための ref。
  const basicInfoRef = useRef(basicInfo);
  basicInfoRef.current = basicInfo;

  // 親（TransferDetail）へ公開するハンドル。
  //   addTransferredRow:  検印済み明細（振替元）の「振替処理」で移動してきた明細を最終行に追加。
  useImperativeHandle(ref, () => ({
    addTransferredRow: (d) => {
      // 既存のデータ行（「X-N」の分割先行を除く）の最大 No. の次を採番する。
      // 採番結果は戻り値として親へ返すため、setRows の外（最新行は rowsRef）で求める。
      const maxLineNo = rowsRef.current.reduce((max, r) => {
        const n = typeof r.lineNo === 'number' ? r.lineNo : Number(r.lineNo);
        return Number.isFinite(n) ? Math.max(max, n) : max;
      }, 0);
      const lineNo = maxLineNo + 1;
      setRows((prev) => {
        const moved: ExpenseRow = {
          ...BLANK,
          lineNo,
          paymentNo: d.paymentNo,
          paymentCount: d.paymentCount,
          detailNo: d.detailNo,
          metaBrand: d.metaBrand,
          product: d.product,
          payAmount: d.payAmount,
          mgmtClass: d.mgmtClass,
          mgmtClassName: d.mgmtClassName,
          mgmtCode: d.mgmtCode,
          mgmtCodeName: d.mgmtCodeName,
          measureClass: d.measureClass,
          measureCode: d.measureCode,
          dept: d.dept,
          store: d.store,
          tertiaryStore: d.tertiaryStore,
          primaryStore: d.primaryStore,
          summary1: d.summary1,
          summary2: d.summary2,
          // 画面には表示しないが、移動元の値をそのまま引き継ぐ。
          postingMonth: d.postingMonth,
          targetMonth: d.targetMonth,
          office: d.office,
          terminalOrg: d.terminalOrg,
          staff: d.staff,
          payee: d.payee,
        };
        // 移動した時点で枝番行（振替先行）を1本用意する
        //（20260728_第24回_共通 決定事項25「開いた時点で1行出す」の読み替え）。
        const branch = buildBranchRow(moved, basicInfoRef.current, 1);
        // 移動した行と自動生成した枝番行を強調対象にする
        //（行が反映された後にフラッシュ表示し、可視域へスクロールする）。
        reveal.markRows([moved, branch]);
        return [...prev, moved, branch];
      });
      // 自動生成した枝番行がすぐ見えるよう、当該親行の折りたたみを開く。
      setExpandedBranches((prev) => new Set([...prev, String(lineNo)]));
      return lineNo;
    },
  }));

  // タイトル下の合計サマリーバーの表示値（総合計＋グループ別の支払金額・計画金額）。
  // 数式の一括適用（applyExpenseFormulas）で再集計するたびに更新する。
  const [summary, setSummary] = useState<ExpenseSummary>(INITIAL_SUMMARY);

  // AG Grid API（数式の一括適用用）。
  const gridApiRef = useRef<any>(null);

  // 枝番行の有無を親へ通知する（基本情報の固定指定を切り替える際の確認要否に使う）。
  // onBranchRowsChange は ref 経由で参照し、親が毎レンダー新しい関数を渡しても
  // 再通知ループにならないようにする。
  const onBranchRowsChangeRef = useRef(onBranchRowsChange);
  onBranchRowsChangeRef.current = onBranchRowsChange;
  const hasAnyBranchRow = rows.some(isBranchData);
  useEffect(() => {
    onBranchRowsChangeRef.current?.(hasAnyBranchRow);
  }, [hasAnyBranchRow]);

  // 直前の固定指定。初回（undefined → 'source'）を切替と誤認しないために保持する。
  const prevExecutorRef = useRef(basicInfo?.executor);

  // 基本情報の固定指定（振替元／振替先）を切り替えたときの処理。
  //   ・枝番行の商流・組織列の活性・背景色が変わるため再描画する
  //   ・既存の枝番行の商流・組織を新しい前提で入れ直す
  //     （振替先固定＝基本情報の値／振替元固定＝親行の値）。
  //     切り替えは基本情報側の確認ダイアログで了承済みのため、ここでは無条件に上書きする。
  useEffect(() => {
    const prev = prevExecutorRef.current;
    prevExecutorRef.current = basicInfo?.executor;
    if (prev !== undefined && prev !== basicInfo?.executor) {
      const destFixed = basicInfo?.executor === 'destination';
      setRows((rowsPrev) => {
        // 「振替先を固定する」（N対1）へ切り替えたときは、親行あたりの枝番行を1本にまとめる。
        // 振替先が基本情報で1つに決まるため、2本目以降は同じ振替先の重複になるため。
        // 金額は合算して残す（振替金額の合計と親行の負担金額を変えない）。
        const keep = new Set<ExpenseRow>();
        const mergedAmount = new Map<string, number>();
        if (destFixed) {
          const keptParents = new Set<string>();
          rowsPrev.forEach((r) => {
            if (!isBranchData(r)) return;
            const key = parentLineNoOfRow(r) ?? '';
            mergedAmount.set(
              key,
              (mergedAmount.get(key) ?? 0) + (toNum(r.payAmount) ?? 0)
            );
            // 各親行の先頭の枝番行だけを残す。
            if (!keptParents.has(key)) {
              keptParents.add(key);
              keep.add(r);
            }
          });
        }
        return rowsPrev
          .filter((r) => !destFixed || !isBranchData(r) || keep.has(r))
          .map((r) => {
            if (!isBranchData(r)) return r;
            const parentKey = parentLineNoOfRow(r);
            const parent = rowsPrev.find(
              (x) => !isBranchData(x) && String(x.lineNo) === parentKey
            );
            if (!parent) return r;
            const rebuilt = buildBranchRow(parent, basicInfoRef.current, 0);
            // 商流・組織を入れ替える（経費項目の入力は残す）。
            return {
              ...r,
              // まとめた場合は枝番を 1 に振り直し、金額は合算値にする。
              ...(destFixed
                ? {
                    lineNo: `${parentKey}-1`,
                    payAmount: mergedAmount.get(parentKey ?? '') ?? r.payAmount,
                  }
                : {}),
              splitPrimaryStore: rebuilt.splitPrimaryStore,
              splitTertiaryStore: rebuilt.splitTertiaryStore,
              splitStore: rebuilt.splitStore,
              splitDept: rebuilt.splitDept,
              splitStaff: rebuilt.splitStaff,
              splitOffice: rebuilt.splitOffice,
              splitTerminalOrg: rebuilt.splitTerminalOrg,
            };
          });
      });
    }
    gridApiRef.current?.refreshCells({ force: true });
  }, [basicInfo?.executor]);

  // 枝番行（振替先行）の折りたたみ。初期状態は「全て折りたたみ」のため、折りたたみ中ではなく
  // 展開中の親行の No. を保持する（後から追加した明細も折りたたみ状態で現れる）。
  // 表示の切り替えは外部フィルタで行い、行はモデルに保持したままにする
  //（合計サマリーの集計は常に全行を対象に算出される）。
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(
    new Set()
  );
  // 外部フィルタのコールバックから最新値を参照するための ref。
  const expandedBranchesRef = useRef(expandedBranches);
  useEffect(() => {
    expandedBranchesRef.current = expandedBranches;
    gridApiRef.current?.onFilterChanged();
    // ボタンのアイコン（「∨」／「∧」）を現在の開閉状態に合わせて描き替える。
    gridApiRef.current?.refreshCells({
      columns: ['branchCollapse'],
      force: true,
    });
    // ヘッダーのアイコン（一括開閉）も現在の開閉状態に合わせて描き替える。
    gridApiRef.current?.refreshHeader();
  }, [expandedBranches]);

  // 枝番行の増減（振替処理・コピー・削除）に合わせて、
  // ヘッダーのアイコンの活性／非活性を描き替える。
  useEffect(() => {
    gridApiRef.current?.refreshHeader();
  }, [rows]);

  // 折りたたみの開閉を切り替える（ボタン押下）。
  const handleToggleCollapse = (lineNo: number | string) => {
    const key = String(lineNo);
    setExpandedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 当該親行が枝番行を持つか（持たない場合はボタンを表示しない）。
  const hasBranchRow = (lineNo: number | string): boolean =>
    rowsRef.current.some(
      (r) => isBranchData(r) && parentLineNoOfRow(r) === String(lineNo)
    );

  // 枝番行を持つ親行の No. 一覧（重複なし）。ヘッダーの一括開閉で使う。
  const branchParentLineNos = (): string[] => [
    ...new Set(
      rowsRef.current
        .filter(isBranchData)
        .map((r) => parentLineNoOfRow(r))
        .filter((no): no is string => !!no)
    ),
  ];

  // ヘッダーのアイコン押下：枝番行を一括で開閉する。
  // 全ての親行が展開中なら全て折りたたみ、それ以外（一部のみ／全て折りたたみ）は全て展開する。
  const handleToggleAllCollapse = () => {
    const parents = branchParentLineNos();
    if (parents.length === 0) return;
    setExpandedBranches((prev) => {
      const allExpanded = parents.every((no) => prev.has(no));
      return allExpanded ? new Set() : new Set(parents);
    });
  };

  // 外部フィルタ：枝番行は、親行で展開中（＝折りたたみを解除済み）のもののみ表示する
  //（既定は折りたたみ）。行はモデルに保持したままのため、合計は全行で算出される。
  const isExternalFilterPresent = () => true;
  const doesExternalFilterPass = (node: any) => {
    const d = node.data as ExpenseRow | undefined;
    if (!d || !isBranchData(d)) return true;
    const parentLineNo = parentLineNoOfRow(d);
    return !!parentLineNo && expandedBranchesRef.current.has(parentLineNo);
  };

  // 計算式セルにマウスオーバー中、計算に使われる参照元セル（`field::rowId`）の集合。
  // ref で保持し cellClassRules から最新値を参照、変更時に refreshCells で枠線を反映する。
  const hoverRefsRef = useRef<Set<string>>(new Set());
  const setHoverRefs = (keys: string[]) => {
    const next = new Set(keys);
    const cur = hoverRefsRef.current;
    // 同一集合なら再描画しない（マウス移動中の無駄な再描画を抑止）
    if (cur.size === next.size && [...next].every((k) => cur.has(k))) return;
    hoverRefsRef.current = next;
    gridApiRef.current?.refreshCells({ force: true });
  };

  // 計算式セルにマウスオーバーしたら、計算に使われる参照元セルをハイライト対象にする。
  const handleCellMouseOver = (e: CellMouseOverEvent) => {
    const field = e.colDef?.field;
    const row = e.data as ExpenseRow | undefined;
    if (!field || !row || !isFormulaCell(field, row)) {
      setHoverRefs([]);
      return;
    }
    const rowId = e.node?.id ?? '';
    setHoverRefs(FORMULA_DEFS[field].refs(row).map((f) => `${f}::${rowId}`));
  };

  // セルから外れたらハイライトを解除する。
  const handleCellMouseOut = () => setHoverRefs([]);

  // 編集セルの変更ハイライト（黄）は共通フックに委譲する（→ 02 §7.2）。
  // 色付けは共通の cellClassRules（GRID_DEFAULT_COL_DEF）が context.isCellChanged を見て行う。
  const { isCellChanged, trackCellChange } = useChangedCells();

  // 列状態（列幅・並び順・ソート）の永続化（→ 02 §7）。
  // 画面独自の onGridReady（API 保持・数式の初期適用）は options 経由で連結する。
  // ※ 列を追加・変更したらキーの版数を上げる。保存済み状態は applyOrder: true で
  //    復元されるため、保存後に追加した列（施策区分〜施策コード名称・摘要1/摘要2 など）が
  //    末尾＝「振替先」グループの右に押し出されてしまう。v2 で並び順を定義どおりに戻す。
  //    v3：「振替先」グループへ担当者・施策区分〜施策コード名称を追加し、並びを振替先明細に合わせた。
  //    v4：「支払金額」の右に「負担金額」を追加した。
  //    v5：「振替先」グループを廃止し、「負担金額」の右へ商流・組織列（一次店〜担当者）を移動。
  //        並びは振替先明細（費用振替）に合わせ、経費項目（管理区分〜摘要2）を右に続ける。
  //    v6：No. の左に枝番行の折りたたみボタン列（branchCollapse）を追加し、
  //        操作列にコピーを追加した（列幅を3アイコンぶんに拡張）。
  // コピーで増えた行を見つけやすくする（行全体をフラッシュし可視域へ送る）。
  const reveal = useRevealNewRows();

  const gridColumnStateProps = useGridColumnState(
    'allocateDetail.expense.columnState.v7',
    {
      onGridReady: (event: any) => {
        gridApiRef.current = event.api;
        reveal.captureApi(event.api);
        // 初期表示時に数式を一括適用する。
        setSummary(applyExpenseFormulas(event.api));
      },
    }
  );

  // セル編集時に変更状態を記録し、当該行の派生値・合計を再計算する。
  const handleCellValueChanged = (params: CellValueChangedEvent) => {
    trackCellChange(params);

    // 入力値の変更に伴い、各行の派生項目（税額・計画差異）とグループ小計・
    // 総合計を Excel「拡売費」表の数式に従って再計算する。
    setSummary(applyExpenseFormulas(params.api));

    params.api.refreshCells({
      rowNodes: [params.node],
      force: true,
    });
  };

  // 総合計行＋非活性セルのスタイル。
  // 合計行は薄い青（gridStyles の total）、通常データ行（非活性列）は灰（readonly）。
  const groupStyle = asCellStyle((params: any) =>
    params.data?.isGroup || params.data?.isTotal
      ? { fontWeight: 'bold', backgroundColor: GRID_COLORS.total }
      : { backgroundColor: GRID_COLORS.readonly }
  );

  // 右寄せ列は共通クラス cell-right（grid.css）を cellClass で指定し、
  // cellStyle には背景色のみを持たせる（→ 02 §7）。
  const RIGHT_CELL_CLASS = 'cell-right';

  // 「分割」列が「分割先」の行は、全セルを非活性（編集不可・灰背景 readonly）にする。
  const isSplitDestRow = (params: any) => params.data?.costSplit === '分割先';

  // 操作ウィジェット列（販売計画選択・費用分割）用：データ行は白背景。
  // 合計行（グループ合計・総合計）は薄い青。分割先行は非活性（灰）。
  const widgetStyle = asCellStyle((params: any) => {
    if (params.data?.isGroup || params.data?.isTotal)
      return { fontWeight: 'bold', backgroundColor: GRID_COLORS.total };
    if (isSplitDestRow(params))
      return { backgroundColor: GRID_COLORS.readonly };
    return { backgroundColor: GRID_COLORS.editable };
  });

  // 枝番行（「X-N」の振替先行）の親行＝振替元行を返す。
  const parentRowOf = (row: ExpenseRow | undefined): ExpenseRow | undefined => {
    const parentLineNo = String(row?.lineNo ?? '').split('-')[0];
    if (!parentLineNo) return undefined;
    return rowsRef.current.find(
      (r) => !r.isGroup && !r.isTotal && String(r.lineNo) === parentLineNo
    );
  };

  // 当該親行（振替元行）に紐づく枝番行（「X-N」の振替先行）の負担金額合計。
  // 親行の「負担金額」（支払金額からの残り）を求めるために使う。
  const branchShareTotal = (parent: ExpenseRow | undefined): number =>
    parent
      ? rowsRef.current
          .filter(
            (r) =>
              r.costSplit === '分割先' &&
              String(r.lineNo).startsWith(`${parent.lineNo}-`)
          )
          .reduce((sum, r) => sum + (toNum(r.payAmount) ?? 0), 0)
      : 0;

  // ── 枝番行（振替先行）の入力列 ────────────────────────────
  // 「振替先」グループを廃止し、枝番行は「一次店」〜「摘要2（社外用）」列で
  // 振替先の値を保持・入力する。列の関係・候補は費用振替の振替先明細と同じ。

  // 商流・組織（一次店〜担当者）の連動項目と、行が保持するフィールドの対応。
  //   枝番行（振替先行）… split* に振替先の値を持つ
  //   親行（振替元行）  … 明細自身の値を持つ（参照表示）
  const BRANCH_STORE_ORG_FIELD: Record<
    keyof StoreOrgSelection,
    keyof ExpenseRow
  > = {
    primaryStore: 'splitPrimaryStore',
    tertiaryStore: 'splitTertiaryStore',
    store: 'splitStore',
    dept: 'splitDept',
    staff: 'splitStaff',
  };
  const PARENT_STORE_ORG_FIELD: Record<
    keyof StoreOrgSelection,
    keyof ExpenseRow
  > = {
    primaryStore: 'primaryStore',
    tertiaryStore: 'tertiaryStore',
    store: 'store',
    dept: 'dept',
    staff: 'staff',
  };
  const storeOrgFieldOf = (params: any, key: keyof StoreOrgSelection) =>
    isSplitDestRow(params)
      ? BRANCH_STORE_ORG_FIELD[key]
      : PARENT_STORE_ORG_FIELD[key];

  // 「振替先を固定する」＝振替先の商流・組織は基本情報で確定しているため入力させない。
  const isDestFixed = () => basicInfoRef.current?.executor === 'destination';

  // 商流・組織列（一次店〜担当者）の活性：枝番行、かつ「振替元を固定する」のときだけ。
  const storeOrgEditable = (params: any) =>
    isSplitDestRow(params) && !isDestFixed();

  // 管理区分〜摘要2（社外用）列の活性：枝番行のみ（親行は振替元の明細のため非活性）。
  const branchEditable = (params: any) => isSplitDestRow(params);

  // 枝番行だけを活性にする列のセル背景（活性＝白／非活性＝灰。合計行は薄い青）。
  const branchCellStyle = (isEditable: (params: any) => boolean) =>
    asCellStyle((params: any) => {
      if (params.data?.isGroup || params.data?.isTotal)
        return { fontWeight: 'bold', backgroundColor: GRID_COLORS.total };
      return isEditable(params)
        ? { backgroundColor: GRID_COLORS.editable }
        : { backgroundColor: GRID_COLORS.readonly };
    });

  // 商流・組織列の値取得。枝番行は振替先の値、親行は明細自身の値を表示する。
  const storeOrgValueGetter =
    (key: keyof StoreOrgSelection) => (params: any) => {
      if (params.data?.isGroup || params.data?.isTotal) return '';
      return params.data?.[storeOrgFieldOf(params, key)] ?? '';
    };
  const storeOrgValueSetter =
    (key: keyof StoreOrgSelection) => (params: any) => {
      params.data[storeOrgFieldOf(params, key)] = params.newValue ?? '';
      return true;
    };

  // 商流（一次店・三次店・販売店）と組織（費用負担部署・担当者）の連動を当該行へ適用する。
  // 関係・候補は振替先明細（費用振替）と同じ定義元（storeHierarchy／paymentOrgCascade）。
  const handleStoreOrgCascade =
    (key: keyof StoreOrgSelection) => (params: any) => {
      const current = (
        Object.keys(BRANCH_STORE_ORG_FIELD) as (keyof StoreOrgSelection)[]
      ).reduce(
        (sel, field) => {
          sel[field] = String(
            params.data?.[storeOrgFieldOf(params, field)] ?? ''
          );
          return sel;
        },
        {} as Record<keyof StoreOrgSelection, string>
      ) as StoreOrgSelection;
      const next = applyStoreOrgCascade(
        current,
        key,
        String(params.newValue ?? ''),
        basicInfoRef.current?.targetMonth ?? ''
      );
      // 編集した列以外で値が変わった項目だけ書き戻す。
      (
        Object.keys(BRANCH_STORE_ORG_FIELD) as (keyof StoreOrgSelection)[]
      ).forEach((field) => {
        if (field !== key) {
          params.data[storeOrgFieldOf(params, field)] = next[field];
        }
      });
      params.api.refreshCells({ rowNodes: [params.node], force: true });
    };

  // 管理区分（名称）を行へ設定する。コード列（mgmtClass）・名称列（mgmtClassName）を同時に更新し、
  // 該当しなくなった管理コードはクリアする（振替先明細と同じ関係）。
  const setMgmtClassName = (row: ExpenseRow, className: string): void => {
    row.mgmtClassName = className;
    row.mgmtClass = managementClassCode(className);
    if (row.mgmtCode && !isManagementCodeInClass(row.mgmtCode, className)) {
      row.mgmtCode = '';
      row.mgmtCodeName = '';
    }
  };

  // 管理コードを行へ設定する。名称列（mgmtCodeName）も更新し、対応する管理区分を自動設定する。
  const setMgmtCode = (row: ExpenseRow, code: string): void => {
    row.mgmtCode = code;
    row.mgmtCodeName = managementCodeNameOf(code);
    const className = managementClassFromCode(code);
    if (className) {
      row.mgmtClassName = className;
      row.mgmtClass = managementClassCode(className);
    }
  };

  // 施策区分（名称）を行へ設定する。該当しなくなった施策コードはクリアする。
  const setMeasureClass = (row: ExpenseRow, className: string): void => {
    row.measureClass = className;
    if (row.measureCode && !isCampaignCodeInClass(row.measureCode, className)) {
      row.measureCode = '';
    }
  };

  // 施策コードを行へ設定する。対応する施策区分を自動設定する。
  const setMeasureCode = (row: ExpenseRow, code: string): void => {
    row.measureCode = code;
    const className = campaignClassFromCode(code);
    if (className) row.measureClass = className;
  };

  // 連動で書き換えた同一行の他セルを再描画する（管理区分〜施策コード名称）。
  const refreshRow = (params: any) =>
    params.api.refreshCells({ rowNodes: [params.node], force: true });

  // 枝番行（振替先行）の「支払No」〜「サマリ商品」列は、親行（振替元行）の値を表示する。
  // 支払金額のみ対象外（枝番行の金額は「負担金額」列で表示する）。
  // No.列は行の識別に必要、一次店〜摘要2は枝番行が自身の値を持つため、いずれも対象外。
  // 枝番行（振替先行）では、親行（振替元）の識別情報を再掲しない。
  // 元の情報は枝番なしの行を見れば分かるため、枝番行には振替時に指定した情報だけを
  // 表示する（2026-08 レビュー指摘）。
  const blankOnSplitDest = (col: ColDef): ColDef => {
    const field = col.field;
    if (!field) return col;
    return {
      ...col,
      valueGetter: (p: any) =>
        isSplitDestRow(p) ? '' : (p.data?.[field] ?? ''),
    };
  };

  // 親行から引き継いで表示するセルは、自身の入力値と区別できるよう文字色をグレーにする。
  const withInheritedTextColor = (col: ColDef): ColDef => {
    const base = col.cellStyle;
    return {
      ...col,
      cellStyle: (p: any) => {
        const style = typeof base === 'function' ? base(p) : base;
        return isSplitDestRow(p)
          ? { ...style, color: GRID_COLORS.inheritedText }
          : style;
      },
    };
  };

  const columnDefs: (ColDef | ColGroupDef)[] = useMemo(() => {
    // 枝番なしの行（振替元）だけが値を持つ列（支払No〜商品・支払金額）。
    // 枝番行では空欄にする（blankOnSplitDest）。
    const inheritedCols: ColDef[] = [
      {
        headerName: '支払No',
        field: 'paymentNo',
        width: 104,
        cellStyle: groupStyle,
      },
      {
        headerName: '支払回数',
        field: 'paymentCount',
        ...GRID_NUMBER_TEXT_FILTER,
        width: 80,
        cellClass: RIGHT_CELL_CLASS,
        cellStyle: groupStyle,
      },
      {
        headerName: '明細No',
        field: 'detailNo',
        ...GRID_NUMBER_FILTER,
        width: 80,
        cellClass: RIGHT_CELL_CLASS,
        cellStyle: groupStyle,
      },
      {
        // メタブランド：検印済み明細（振替元）・支払詳細の拡売費一覧と同じく、サマリ商品の左に置く。
        headerName: 'メタブランド',
        field: 'metaBrand',
        width: 112,
        cellStyle: groupStyle,
      },
      {
        headerName: 'サマリ商品',
        field: 'product',
        width: 176,
        cellStyle: groupStyle,
      },
      {
        headerName: '支払金額',
        field: 'payAmount',
        ...GRID_NUMBER_TEXT_FILTER,
        width: 96,
        valueFormatter: intFmt,
        cellClass: RIGHT_CELL_CLASS,
        cellStyle: groupStyle,
      },
    ].map((col) => withInheritedTextColor(blankOnSplitDest(col as ColDef)));

    // 商流・組織〜経費項目（販売店〜摘要2（社外用））。枝番行は自身の値を保持・入力する。
    // 商流は 販売店 → 三次店 → 一次店 の順（検印済み明細のグリッドと同じ並び）。
    // 列の並び・関係・候補は費用振替の「振替先明細」に合わせる。
    const branchCols: ColDef[] = [
      {
        // 販売店：当該行の一次店・三次店の配下に絞り込む。選択すると一次店・三次店を自動設定する。
        headerName: '販売店',
        colId: 'store',
        width: 160,
        valueGetter: storeOrgValueGetter('store'),
        valueSetter: storeOrgValueSetter('store'),
        cellStyle: branchCellStyle(storeOrgEditable),
        editable: storeOrgEditable,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: (p: any) => ({
          comboOptions: storeOptionsFor(
            String(p.data?.splitPrimaryStore ?? ''),
            String(p.data?.splitTertiaryStore ?? '')
          ),
          placeholder: '販売店を選択',
        }),
        onCellValueChanged: handleStoreOrgCascade('store'),
      },
      {
        // 三次店：当該行の一次店の配下に絞り込む。選択すると一次店を自動設定する。
        headerName: '三次店',
        colId: 'tertiaryStore',
        width: 160,
        valueGetter: storeOrgValueGetter('tertiaryStore'),
        valueSetter: storeOrgValueSetter('tertiaryStore'),
        cellStyle: branchCellStyle(storeOrgEditable),
        editable: storeOrgEditable,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: (p: any) => ({
          comboOptions: tertiaryOptionsFor(
            String(p.data?.splitPrimaryStore ?? '')
          ),
          placeholder: '三次店を選択',
        }),
        onCellValueChanged: handleStoreOrgCascade('tertiaryStore'),
      },
      {
        // 一次店：全件から選択。選択すると配下でなくなった三次店・販売店をクリアする。
        headerName: '一次店',
        colId: 'primaryStore',
        width: 176,
        valueGetter: storeOrgValueGetter('primaryStore'),
        valueSetter: storeOrgValueSetter('primaryStore'),
        cellStyle: branchCellStyle(storeOrgEditable),
        editable: storeOrgEditable,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: PRIMARY_STORE_OPTIONS,
          placeholder: '一次店を選択',
        },
        onCellValueChanged: handleStoreOrgCascade('primaryStore'),
      },
      {
        // 費用負担部署：当該行の販売店・担当者との組合せが支払として存在するものだけに絞り込む。
        headerName: '費用負担部署',
        colId: 'dept',
        width: 160,
        valueGetter: storeOrgValueGetter('dept'),
        valueSetter: storeOrgValueSetter('dept'),
        cellStyle: branchCellStyle(storeOrgEditable),
        editable: storeOrgEditable,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: (p: any) => ({
          comboOptions: deptOptionsFor(
            String(p.data?.splitStore ?? ''),
            String(p.data?.splitStaff ?? ''),
            basicInfoRef.current?.targetMonth ?? ''
          ),
          placeholder: '費用負担部署を選択',
        }),
        onCellValueChanged: handleStoreOrgCascade('dept'),
      },
      {
        // 担当者：当該行の販売店・費用負担部署との組合せが支払として存在するものだけに絞り込む。
        headerName: '営業担当者',
        colId: 'staff',
        width: 120,
        valueGetter: storeOrgValueGetter('staff'),
        valueSetter: storeOrgValueSetter('staff'),
        cellStyle: branchCellStyle(storeOrgEditable),
        editable: storeOrgEditable,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: (p: any) => ({
          comboOptions: staffOptionsFor(
            String(p.data?.splitStore ?? ''),
            String(p.data?.splitDept ?? ''),
            basicInfoRef.current?.targetMonth ?? ''
          ),
          placeholder: '担当者を選択',
        }),
        onCellValueChanged: handleStoreOrgCascade('staff'),
      },
      {
        // 管理区分（コード＝区分値）。行は名称（mgmtClassName）とコード（mgmtClass）を持ち、
        // 名称＋区分値の2行コンボで選択する（表示はコード）。
        headerName: '管理区分',
        colId: 'mgmtClassCode',
        width: 104,
        valueGetter: (p: any) => p.data?.mgmtClass ?? '',
        valueSetter: (p: any) => {
          setMgmtClassName(p.data, String(p.newValue ?? ''));
          return true;
        },
        cellStyle: branchCellStyle(branchEditable),
        editable: branchEditable,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: managementClassComboOptions(),
          placeholder: '管理区分を選択',
        },
        onCellValueChanged: refreshRow,
      },
      {
        // 管理区分名称：名称（mgmtClassName）を表示・選択する。管理区分（コード）列と相互連動する。
        headerName: '管理区分名称',
        colId: 'mgmtClassName',
        width: 160,
        valueGetter: (p: any) => p.data?.mgmtClassName ?? '',
        valueSetter: (p: any) => {
          setMgmtClassName(p.data, String(p.newValue ?? ''));
          return true;
        },
        cellStyle: branchCellStyle(branchEditable),
        editable: branchEditable,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: managementClassComboOptions(),
          placeholder: '管理区分名称を選択',
        },
        onCellValueChanged: refreshRow,
      },
      {
        // 管理コード：コードを保持・表示。管理区分が選択済みなら該当コードのみに絞り込み、
        // 選択で管理区分を自動設定する。
        headerName: '管理コード',
        colId: 'mgmtCodeCode',
        width: 104,
        valueGetter: (p: any) => p.data?.mgmtCode ?? '',
        valueSetter: (p: any) => {
          setMgmtCode(p.data, String(p.newValue ?? ''));
          return true;
        },
        cellStyle: branchCellStyle(branchEditable),
        editable: branchEditable,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: (p: any) => ({
          comboOptions: managementCodeComboOptions(
            EXPENSE_MANAGEMENT_CODE_OPTIONS.map((o) => o.value).filter(
              (c) =>
                !p.data?.mgmtClassName ||
                isManagementCodeInClass(c, p.data.mgmtClassName)
            )
          ),
          placeholder: '管理コードを選択',
        }),
        onCellValueChanged: refreshRow,
      },
      {
        // 管理コード名称：名称を選択できる列。名称→コードへ一意に逆引きして mgmtCode に保持する。
        headerName: '管理コード名称',
        colId: 'mgmtCodeName',
        width: 160,
        valueGetter: (p: any) => managementCodeNameOf(p.data?.mgmtCode ?? ''),
        valueSetter: (p: any) => {
          setMgmtCode(p.data, managementCodeOfName(String(p.newValue ?? '')));
          return true;
        },
        cellStyle: branchCellStyle(branchEditable),
        editable: branchEditable,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: (p: any) => ({
          comboOptions: managementCodeNameComboOptions(
            EXPENSE_MANAGEMENT_CODE_OPTIONS.map((o) => o.value).filter(
              (c) =>
                !p.data?.mgmtClassName ||
                isManagementCodeInClass(c, p.data.mgmtClassName)
            )
          ),
          placeholder: '管理コード名称を選択',
        }),
        onCellValueChanged: refreshRow,
      },
      {
        // 施策区分（コード＝区分値）。行は名称（measureClass）を保持し、表示は区分値。
        headerName: '施策区分',
        colId: 'measureClassCode',
        width: 88,
        valueGetter: (p: any) => p.data?.measureClass ?? '',
        valueFormatter: (p: any) =>
          campaignClassCode(p.value) || GRID_EMPTY_TEXT,
        valueSetter: (p: any) => {
          setMeasureClass(p.data, String(p.newValue ?? ''));
          return true;
        },
        cellStyle: branchCellStyle(branchEditable),
        editable: branchEditable,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: campaignClassComboOptions(),
          placeholder: '施策区分を選択',
        },
        onCellValueChanged: refreshRow,
      },
      {
        // 施策区分名称：名称（measureClass）を表示・選択する。施策区分（区分値）列と相互連動する。
        headerName: '施策区分名称',
        colId: 'measureClassName',
        width: 120,
        valueGetter: (p: any) => p.data?.measureClass ?? '',
        valueSetter: (p: any) => {
          setMeasureClass(p.data, String(p.newValue ?? ''));
          return true;
        },
        cellStyle: branchCellStyle(branchEditable),
        editable: branchEditable,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: campaignClassComboOptions(),
          placeholder: '施策区分名称を選択',
        },
        onCellValueChanged: refreshRow,
      },
      {
        // 施策コード：コードを保持・表示。施策区分が選択済みなら該当コードのみに絞り込み、
        // 選択で施策区分を自動設定する。
        headerName: '施策コード',
        colId: 'measureCodeCode',
        width: 104,
        valueGetter: (p: any) => p.data?.measureCode ?? '',
        valueSetter: (p: any) => {
          setMeasureCode(p.data, String(p.newValue ?? ''));
          return true;
        },
        cellStyle: branchCellStyle(branchEditable),
        editable: branchEditable,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: (p: any) => ({
          comboOptions: campaignCodeComboOptions(
            EXPENSE_CAMPAIGN_CODE_OPTIONS.map((o) => o.value).filter(
              (c) =>
                !p.data?.measureClass ||
                isCampaignCodeInClass(c, p.data.measureClass)
            )
          ),
          placeholder: '施策コードを選択',
        }),
        onCellValueChanged: refreshRow,
      },
      {
        // 施策コード名称：名称を選択できる列。名称→コードへ一意に逆引きして measureCode に保持する。
        headerName: '施策コード名称',
        colId: 'measureCodeName',
        width: 152,
        valueGetter: (p: any) => campaignCodeNameOf(p.data?.measureCode ?? ''),
        valueSetter: (p: any) => {
          setMeasureCode(p.data, campaignCodeOfName(String(p.newValue ?? '')));
          return true;
        },
        cellStyle: branchCellStyle(branchEditable),
        editable: branchEditable,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: (p: any) => ({
          comboOptions: campaignCodeNameComboOptions(
            EXPENSE_CAMPAIGN_CODE_OPTIONS.map((o) => o.value).filter(
              (c) =>
                !p.data?.measureClass ||
                isCampaignCodeInClass(c, p.data.measureClass)
            )
          ),
          placeholder: '施策コード名称を選択',
        }),
        onCellValueChanged: refreshRow,
      },
      {
        headerName: '摘要1（社内用）',
        field: 'summary1',
        width: 160,
        cellStyle: branchCellStyle(branchEditable),
        editable: branchEditable,
      },
      {
        headerName: '摘要2（社外用）',
        field: 'summary2',
        width: 160,
        cellStyle: branchCellStyle(branchEditable),
        editable: branchEditable,
      },
    ];

    return withHeaderTooltips([
      {
        // 枝番行（振替先行）の折りたたみボタン。No. 列の左に置き、
        // 枝番行を持つ親行にのみ表示する。ヘッダーのアイコンで一括開閉する。
        headerName: '',
        // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
        suppressColumnsToolPanel: true,
        headerComponent: TransferBranchCollapseHeader,
        colId: 'branchCollapse',
        lockPinned: true,
        sortable: false,
        filter: false,
        resizable: false,
        editable: false,
        width: 32,
        minWidth: 32,
        maxWidth: 32,
        suppressAutoSize: true,
        cellRenderer: TransferBranchCollapseCellRenderer,
        cellStyle: widgetStyle,
      },
      {
        headerName: 'No.',
        field: 'lineNo',
        width: 56,
        cellClass: 'cell-left',
        cellStyle: groupStyle,
      },
      ...inheritedCols,
      {
        // 負担金額（支払金額の右隣に置く。20260721_第21回_共通 決定事項5 で「残金」としたが、項目名は「負担金額」に戻した）：
        //   親行（振替元行）  … 振替後に振替元へ残る金額（支払金額 − 枝番行の合計）。非活性（灰）。
        //   枝番行（振替先行）… それぞれの振替金額。活性（白）。
        //   合計行            … 空白。
        // 枝番行の合計と親行の負担金額を足すと支払金額に一致する。
        // colId は列状態の保存キーになるため 'shareAmount' のまま据え置く。
        // ※field は指定せず valueGetter／valueSetter で payAmount を読み書きする
        //   （支払金額列と field が重複すると編集確定時にエディタが閉じないため）。
        headerName: '負担金額',
        colId: 'shareAmount',
        ...GRID_NUMBER_TEXT_FILTER,
        width: 96,
        valueGetter: (p: any) => {
          if (isSplitDestRow(p)) return p.data?.payAmount;
          if (p.data?.isGroup || p.data?.isTotal) return '';
          return (toNum(p.data?.payAmount) ?? 0) - branchShareTotal(p.data);
        },
        valueFormatter: intFmt,
        cellClass: RIGHT_CELL_CLASS,
        cellStyle: branchCellStyle(isSplitDestRow),
        editable: isSplitDestRow,
        valueSetter: (p: any) => {
          const input = toNum(p.newValue) ?? 0;
          const parent = parentRowOf(p.data);
          // 親行が特定できない場合は下限（0）だけを効かせる。
          if (!parent) {
            p.data.payAmount = Math.max(input, 0);
            return true;
          }
          // 枝番行の負担金額の合計は、振替元の支払金額を超えられない
          //（超えると親行の負担金額が負になる）。
          // 上限＝親行の支払金額 −（当該行を除く枝番行の負担金額合計）。
          const others =
            branchShareTotal(parent) - (toNum(p.data?.payAmount) ?? 0);
          const limit = Math.max((toNum(parent.payAmount) ?? 0) - others, 0);
          const clamped = Math.min(Math.max(input, 0), limit);
          if (input < 0) {
            toast.warning('振替金額にマイナスは入力できません。');
          } else if (input > limit) {
            // 金額の表示はグリッド（intFmt）と同じく整数へ丸めて揃える。
            toast.warning(
              `振替金額は ${Math.round(limit).toLocaleString()} 円までです（振替元の支払金額を超えられません）。`
            );
          }
          p.data.payAmount = clamped;
          return true;
        },
      },
      // 商流・組織（一次店〜担当者）は振替先の指定そのものであり、常時表示する。
      ...branchCols.slice(0, 5),
      {
        // 経費項目（管理区分〜摘要2）は列数が多く横幅を圧迫するため列グループにまとめ、
        // 既定は折りたたむ。閉じているときは代表として「管理区分」だけを表示し、
        // ヘッダーの開閉で全列を出せる（2026-08 レビュー指摘「表が横長で見辛い」への対応）。
        // 列グループの書き方は請求詳細の「分割情報」（DetailTable.tsx）に合わせる。
        headerName: '経費項目',
        marryChildren: true,
        children: branchCols
          .slice(5)
          .map((col, i) =>
            i === 0 ? col : { ...col, columnGroupShow: 'open' as const }
          ),
      },
      {
        // 行操作（振替処理・コピー・削除／振替元へ戻す）のアイコンボタン列。一番右に右固定。
        // アイコン3個ぶんの幅（ボタン24px×3＋間隔4px×2＋左右余白）を確保する。
        headerName: '',
        // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
        suppressColumnsToolPanel: true,
        colId: 'rowMenu',
        pinned: 'right',
        lockPinned: true,
        sortable: false,
        filter: false,
        resizable: false,
        editable: false,
        width: 93,
        minWidth: 93,
        maxWidth: 93,
        suppressAutoSize: true,
        cellRenderer: RowMenuCellRenderer,
        cellStyle: widgetStyle,
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const defaultColDef: ColDef = useMemo(
    () => ({
      // 共通の既定列定義（grid/）。ソート/リサイズ/フィルター、ヘッダーの…メニュー・
      // フィルターボタン非表示、tooltip を内包。フィルターは右クリックメニューから開く。
      ...GRID_DEFAULT_COL_DEF,
      // 合計行・グループ行の文字列が数値型と推論されるのを防ぐ
      cellDataType: false,
      // 計算式セルは計算式テキストを、それ以外は従来どおりセル値をツールチップ表示する。
      tooltipValueGetter: (params) => {
        // セルのツールチップでは colDef は列（ColDef）。列グループ（ColGroupDef）は来ない
        const field = (params.colDef as ColDef).field;
        const row = params.data as ExpenseRow | undefined;
        if (field && row && isFormulaCell(field, row)) {
          return FORMULA_DEFS[field].tooltip(row);
        }
        return params.value ?? '';
      },
      // マウスオーバー中の計算式セルの参照元セル（`field::rowId`）に枠線を付ける。
      // 共通の変更ハイライト（ag-cell-changed）は画面独自ルールで消えないようマージする。
      cellClassRules: {
        ...GRID_DEFAULT_COL_DEF.cellClassRules,
        'formula-ref-highlight': (params) => {
          // セルのツールチップでは colDef は列（ColDef）。列グループ（ColGroupDef）は来ない
          const field = (params.colDef as ColDef).field;
          const rowId = params.node?.id ?? '';
          return !!field && hoverRefsRef.current.has(`${field}::${rowId}`);
        },
      },
    }),
    []
  );

  // 操作列「振替処理」押下：押下した親行（振替元行）に枝番行（振替先行）を1行追加する。
  // No. は「親No.-枝番」（既存の枝番行の最大枝番＋1）で採番し、当該親行の枝番行の直後へ挿入する。
  // 追加行の初期値の決め方（固定する側で変わる）は buildBranchRow に集約している。
  const handleAddTransferBranch = (data: ExpenseRow) => {
    const parentKey = String(data.lineNo);
    setRows((prev) => {
      const idx = prev.findIndex((r) => r === data);
      if (idx < 0) return prev;
      const newRow = buildBranchRow(
        data,
        basicInfoRef.current,
        nextBranchNo(prev, parentKey)
      );
      // 追加した行を強調対象にする（行が反映された後にフラッシュされる）。
      reveal.markRows([newRow]);
      // 当該親行の既存の枝番行の直後へ挿入する。
      const next = [...prev];
      next.splice(branchInsertAt(prev, idx, parentKey), 0, newRow);
      return next;
    });
    // 追加した枝番行がすぐ確認できるよう、当該親行の折りたたみを開く。
    setExpandedBranches((prev) => new Set([...prev, parentKey]));
  };

  // 操作列「コピー」押下：当該枝番行（振替先行）を複製する。
  // No. は「親No.-枝番」（既存の枝番行の最大枝番＋1）で採番し直し、
  // 当該親行の枝番行の直後へ挿入する。
  const handleCopyBranchRow = (data: ExpenseRow) => {
    const parentKey = parentLineNoOfRow(data);
    if (!parentKey) return;
    setRows((prev) => {
      const idx = prev.findIndex((r) => r === data);
      if (idx < 0) return prev;
      const copy: ExpenseRow = {
        ...data,
        lineNo: `${parentKey}-${nextBranchNo(prev, parentKey)}`,
      };
      // コピーした行を強調対象にする（行が反映された後にフラッシュされる）
      reveal.markRows([copy]);
      const next = [...prev];
      next.splice(branchInsertAt(prev, idx, parentKey), 0, copy);
      return next;
    });
  };

  const gridContext = {
    // 変更ハイライト（黄）の判定。共通の cellClassRules が参照する（→ 02 §7.2）。
    isCellChanged,
    // 操作列「振替処理」押下：当該親行に枝番行（振替先行）を1行追加する。
    onTransfer: (data: ExpenseRow) => handleAddTransferBranch(data),
    // 操作列「コピー」押下：当該枝番行（振替先行）を複製する。
    onCopyRow: (data: ExpenseRow) => handleCopyBranchRow(data),
    // 枝番行の折りたたみ（親行の左端のボタン・ヘッダーの一括開閉）。
    hasBranch: hasBranchRow,
    isCollapsed: (lineNo: number | string) =>
      !expandedBranches.has(String(lineNo)),
    onToggleCollapse: handleToggleCollapse,
    // ヘッダーの一括開閉。最新の行・開閉状態は ref から参照する
    //（ヘッダーが保持する context が古くても正しく動作する）。
    hasAnyBranch: () => rowsRef.current.some(isBranchData),
    isAllBranchExpanded: () => {
      const parents = branchParentLineNos();
      return (
        parents.length > 0 &&
        parents.every((no) => expandedBranchesRef.current.has(no))
      );
    },
    onToggleAllCollapse: handleToggleAllCollapse,
    // 操作列「削除」押下：当該行を一覧から取り除き、検印済み明細（振替元）へ戻す。
    // 分割先行（「X-N」）を持つ行は、その分割先行もあわせて取り除く。
    onDeleteRow: (data: ExpenseRow) => {
      setRows((prev) =>
        prev.filter(
          (r) =>
            r !== data &&
            !(
              r.costSplit === '分割先' &&
              String(r.lineNo).startsWith(`${data.lineNo}-`)
            )
        )
      );
      onMoveRowToReference?.(data);
    },
  };

  // タイトル下の合計サマリーバーの表示構成。
  // 「合計」＋支払金額／振替金額／残金額（支払−振替）。
  const summaryTotals = useMemo(
    () => [
      { label: '支払金額', value: fmtPay(summary.grandPay) },
      { label: '振替金額', value: fmtPay(summary.transferPay) },
      {
        label: '残金額（支払-振替）',
        value: fmtPay(summary.grandPay - summary.transferPay),
      },
    ],
    [summary]
  );
  return (
    // 折り畳みカードは共通部品 CollapsibleCard を使用する（→ 02 §11）。
    <CollapsibleCard
      title="振替明細"
      open={isCardOpen}
      onOpenChange={setIsCardOpen}
      className="p-4"
      contentClassName="mt-4"
      headerActions={
        /* 根拠資料格納（支払詳細(追加口請求書有)の支払情報ヘッダと同テーマ） */
        <button
          type="button"
          onClick={() => onOpenAttachment?.()}
          className={`${BUTTON_STYLES.outline} ${BUTTON_BASE} flex items-center gap-2 px-3 py-1 text-sm whitespace-nowrap`}
          aria-label="根拠資料格納"
        >
          <Upload className="h-4 w-4" />
          根拠資料格納
        </button>
      }
    >
      <>
        {/* 合計サマリーバー。
          「合計」＋支払金額／振替金額／残金額（支払−振替）。 */}
        <div className="mb-4">
          <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            {/* 合計ラベル（全高・左揃え） */}
            <div className="flex shrink-0 items-center border-r border-gray-200 px-4 text-left text-sm font-bold text-gray-900 whitespace-nowrap">
              合計
            </div>
            {/* 支払金額／振替金額／残金額（全高で表示） */}
            {summaryTotals.map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-end justify-center border-r border-gray-200 px-3 py-1 min-w-42"
              >
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {item.label}
                </span>
                <span className="text-sm font-bold whitespace-nowrap text-blue-700">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 画面のいちばん下の表は、画面いっぱいの高さにする（UX-099 → 05「画面いっぱいのグリッド」）。
            最下部までスクロールした状態で表が画面（ヘッダーとボタンの列のあいだ）にちょうど収まる高さ。
            下ペインを開いている間はペインの高さだけ低くなる（viewportGridHeight）。下端のバーで高さは変えない */}
        <div
          className="expense-grid"
          style={{
            height: viewportGridHeight(TRANSFER_GRID_OFFSET_REM),
            minHeight: '25rem',
            width: '100%',
          }}
        >
          {/* 罫線・ヘッダ背景・行高は共通テーマ（GRID_THEME）に委譲。 */}
          <style>{`
          /* 計算式セルにホバー中、計算に使われる参照元セルの枠線ハイライト */
          .expense-grid .ag-cell.formula-ref-highlight {
            box-shadow: inset 0 0 0 2px var(--grid-source-highlight-border);
          }
        `}</style>
          <AgGridReact
            rowData={rows}
            getRowId={getExpenseRowId}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            // 計算式をツールチップで見せるため、省略されていないセルでも出す（グローバルは whenTruncated）
            tooltipShowMode="standard"
            getContextMenuItems={gridFilterContextMenuItems}
            onCellValueChanged={handleCellValueChanged}
            onModelUpdated={(p) => {
              // セル編集中は再集計しない。applyExpenseFormulas 内の
              // refreshCells({ force: true }) が編集中セルのエディタを破棄し、
              // 「ダブルクリックで一瞬だけ編集モードに入りすぐ解除される」事象を招くため。
              // 値変更後の再集計は onCellValueChanged、行増減後は非編集時の本コールバックで行う。
              if (p.api.getEditingCells().length > 0) return;
              // 行の増減（費用分割・費用振替の登録、削除）後に、グループ小計・総合計と
              // タイトル下の合計サマリーバーを再集計する。
              setSummary(applyExpenseFormulas(p.api));
            }}
            onCellMouseOver={handleCellMouseOver}
            onCellMouseOut={handleCellMouseOut}
            // 枝番行（振替先行）の表示／非表示は外部フィルタで切り替える
            //（折りたたみ中も行はモデルに保持し、合計は全行で算出する）。
            isExternalFilterPresent={isExternalFilterPresent}
            doesExternalFilterPass={doesExternalFilterPass}
            context={gridContext}
            suppressMovableColumns={true}
            ensureDomOrder={true}
            // 列幅・並び順・ソートの永続化（→ 02 §7）。列幅は設計値を優先するため
            // 初回の自動フィット（autoSize）は行わない。
            {...gridColumnStateProps}
            onRowDataUpdated={reveal.onRowDataUpdated}
            statusBar={GRID_STATUS_BAR}
            {...GRID_BASE_PROPS}
          />
        </div>
      </>
    </CollapsibleCard>
  );
});
