import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AgGridReact } from 'ag-grid-react';
import type {
  ColDef,
  ColGroupDef,
  ICellRendererParams,
  ValueParserParams,
  ValueFormatterParams,
} from 'ag-grid-community';
import { Trash2, AlertTriangle, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { joinNameCode } from '../../utils/nameCode';
import { CollapsibleCard } from '../ui/collapsible-card';
import { SingleComboboxCellEditor } from '../ui/single-combobox-cell-editor';
import {
  managementClassComboOptions,
  managementCodeComboOptions,
  campaignClassComboOptions,
  campaignCodeComboOptions,
  managementClassCode,
  campaignClassCode,
} from '../../constants/paymentComboFieldOptions';
// 「XX名称」列（管理コード名称・施策コード名称）は、計画詳細(マージン率固定・NET入力) の
// 拡売費計画と同じ名称マスタ・同じ選択肢ビルダーを使う（名称からコードを設定するため）。
import {
  managementCodeNameOf,
  managementCodeOfName,
  managementCodeNameComboOptions,
  campaignCodeNameOf,
  campaignCodeOfName,
  campaignCodeNameComboOptions,
} from '../../constants/comboFieldOptions';
import {
  EXPENSE_MANAGEMENT_CODE_OPTIONS,
  EXPENSE_CAMPAIGN_CODE_OPTIONS,
  managementClassFromCode,
  isManagementCodeInClass,
  campaignClassFromCode,
  isCampaignCodeInClass,
} from '../../constants/expenseRelations';
import {
  // 一次店/三次店/販売店は振替詳細の基本情報（TransferInfo）と同じ商流マスタを使う。
  PRIMARY_STORE_OPTIONS,
  tertiaryOptionsFor,
  storeOptionsFor,
} from '../../constants/storeHierarchy';
// 費用負担部署・担当者は「支払として存在する組合せ」だけを選べるよう、
// 商流3項目と合成した連動（純関数）を使う（→ constants/paymentOrgCascade）。
import {
  deptOptionsFor,
  staffOptionsFor,
  applyStoreOrgCascade,
  type StoreOrgSelection,
} from '../../constants/paymentOrgCascade';
import {
  GRID_DEFAULT_COL_DEF,
  GRID_BASE_PROPS,
  GRID_STATUS_BAR,
  GRID_COLORS,
  withHeaderTooltips,
  useGridColumnState,
  useRevealNewRows,
  useLinkedCellUndo,
  GRID_NO_FILTER_COLUMN_TYPES,
} from '../grid';
import {
  CARD_TITLE_CLASS,
  FORM_LABEL_CLASS,
} from '../../../styles/commonStyles';
import type { SplitDetailItem } from './PaymentNonProductExpensePane';
import { valueOrEmpty } from '../ui/empty-value';

// ============================================================================
// 型定義
// ============================================================================

// 振替元（費用振替対象）の情報。拡売費一覧の「振替」ボタン押下行から反映する。
// 未指定の項目はモック既定値で補完する（参照専用表示）。
export interface AllocationPaneSource {
  paymentDetailNo?: string; // 支払No（＝支払明細書No.）
  paymentCount?: number | string; // 支払回数
  detailNo?: number | string; // 明細No
  status?: string; // ステータス
  targetPeriod?: string; // 対象年月
  store?: string; // 販売店
  tertiaryStore?: string; // 三次店
  primaryStore?: string; // 一次店
  office?: string; // 事業所（事業場）
  dept?: string; // 部署
  staff?: string; // 営業担当者
  mgmtClass?: string; // 管理区分（コード）
  mgmtClassName?: string; // 管理区分名称
  mgmtCode?: string; // 管理コード（コード）
  mgmtCodeName?: string; // 管理コード名称
  measureClass?: string; // 施策区分（区分値コード）
  measureClassName?: string; // 施策区分名称
  measureCode?: string; // 施策コード（コード）
  measureCodeName?: string; // 施策コード名称
  product?: string; // 対象商品
  payAmount?: number; // 支払金額
  summary1?: string; // 摘要1（社内用）
  summary2?: string; // 摘要2（社外用）
}

// 振替先明細の初期行1件。振替明細一覧の枝番行（「X-N」の振替先行）から引き継ぐ。
export interface AllocationPaneDest {
  // 引き継ぎ元の枝番行 No.（例「1-1」）。一覧側で枝番行が削除されたとき、
  // 振替先明細の対応行を特定して取り除くためのキー。
  sourceLineNo?: string;
  product: string; // 対象商品
  amount: number; // 振替金額
  // 振替先グループの値（未指定の項目は振替元情報〔source〕の値を引き継ぐ）。
  primaryStore?: string; // 一次店
  tertiaryStore?: string; // 三次店
  store?: string; // 販売店
  dept?: string; // 費用負担部署
  staff?: string; // 担当者
  // 管理区分／施策区分は名称、管理コード／施策コードはコードを保持する（振替先明細の DestRow モデル）。
  mgmtClass?: string; // 管理区分（名称）
  mgmtCode?: string; // 管理コード（コード）
  measureClass?: string; // 施策区分（名称）
  measureCode?: string; // 施策コード（コード）
  summary1?: string; // 摘要１
  summary2?: string; // 摘要２
}

// 「振替先追加」で追加する行の既定値。振替詳細の基本情報で「振替先を固定する」のとき、
// 基本情報の値を対応する列へ設定するために画面側から渡す。
// 未指定（undefined）の項目は従来どおり振替元情報（source）の値を引き継ぐ。
export interface AllocationPaneDestDefaults {
  primaryStore?: string; // 一次店
  tertiaryStore?: string; // 三次店
  store?: string; // 販売店
  dept?: string; // 費用負担部署
  staff?: string; // 担当者
}

interface AllocationPaneProps {
  // 拡売費一覧の振替対象行から反映する振替元情報（未指定時はモック）。
  source?: AllocationPaneSource;
  // 「振替先追加」で追加する行の既定値（「振替先を固定する」のときの基本情報の値）。
  destDefaults?: AllocationPaneDestDefaults;
  // 振替先明細の初期行：振替対象行の費用振替先（商品＝対象商品／支払金額＝振替金額）。
  // 未指定の項目（三次店・販売店・費用負担部署・担当者 等）は振替元情報（source）を参照する。
  initialDests?: AllocationPaneDest[];
  // 「登録」押下時に、振替先明細を親へ渡す（親がその他一覧へ X-N 行として追加）。
  onConfirm?: (dests: SplitDetailItem[]) => void;
  // 「振替先を固定する」のとき true。振替先は基本情報の商流・組織で確定しているため、
  // 一次店・三次店・販売店・費用負担部署・担当者を非活性（灰背景）にする。
  destFieldsLocked?: boolean;
}

// 振替先明細の1行（振替元画面で入力・集計対象）。Excel「振替先明細」シートに準拠。
interface DestRow {
  id: string;
  // 引き継ぎ元の枝番行 No.（振替明細一覧から引き継いだ行のみ持つ。画面には表示しない）。
  sourceLineNo?: string;
  product: string; // 対象商品
  expenseItem: string; // 経費項目
  amount: number | null; // 振替金額
  primaryStore: string; // 一次店
  tertiaryStore: string; // 三次店
  store: string; // 販売店
  dept: string; // 費用負担部署
  staff: string; // 担当者
  mgmtClass: string; // 管理区分
  mgmtCode: string; // 管理コード
  measureClass: string; // 施策区分
  measureCode: string; // 施策コード
  summary1: string; // 摘要１
  summary2: string; // 摘要２
}

// ============================================================================
// 既定値・モック
// ============================================================================

// 振替元情報の既定モック（source 未指定時／未反映項目の補完に使用）。
const DEFAULT_SOURCE: Required<AllocationPaneSource> = {
  paymentDetailNo: 'C2400NTO4',
  paymentCount: 1,
  detailNo: 1,
  status: '部支店長承認待ち',
  // 対象年月は費用負担部署・担当者の候補（支払として存在する組合せ）の絞り込みにも使うため、
  // 基本情報（TransferInfo の BASIC_INFO）と同じ「YYYY年M月」表記で持つ。
  targetPeriod: '2025年10月',
  store: '00123 ロケ量販スーパー',
  tertiaryStore: '0045 ○○流通センター',
  primaryStore: '01 ○○支店',
  office: '大阪事業所',
  dept: '関西第1営業部:10003001',
  staff: '山田 翔一郎',
  mgmtClass: '1B6',
  mgmtClassName: 'チャネル対策条件（売上連動）',
  mgmtCode: '99999',
  mgmtCodeName: '量販経費追加スーパー',
  measureClass: '20',
  measureClassName: '販売促進',
  measureCode: 'SP001',
  measureCodeName: '販売促進',
  product: 'ワンダモーニングショット６ＰＮ',
  payAmount: 57432,
  summary1: '量販経費追加スーパーの実施費用（社内）',
  summary2: 'ワンダモーニングショット６ＰＮ 販売促進（社外）',
};

// 一次店/三次店/販売店は振替詳細の基本情報（TransferInfo）と同じ商流マスタ
//（constants/storeHierarchy）を参照し、一次店→三次店→販売店の絞り込み・自動選択も同じ挙動にする。

// 費用負担部署・担当者の選択肢は固定リストではなく、対象年月の支払として存在する組合せから
// 行ごとに求める（deptOptionsFor／staffOptionsFor）。販売店・部署・担当者は相互に連動する。
// 管理区分/管理コード/施策区分/施策コードは計画詳細(マージン率固定・NET入力)の拡売費計画と同様に、
// 共通ビルダー（名称＋コードの2行表示）で選択する。区分列＝名称を保持・表示、コード列＝コードを
// 保持・表示。コード選択で対応区分を自動セット、区分変更で不一致コードをクリアする（連動）。

// ============================================================================
// ヘルパー
// ============================================================================

// 整数の3桁区切り整形。
const formatInt = (v: number | null | undefined): string =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.round(v).toLocaleString('ja-JP')
    : '';

// 数値／文字列いずれで渡される項目（支払回数・明細No 等）を表示用テキストに変換する。
const toText = (v: number | string | null | undefined): string =>
  v == null ? '' : String(v);

// 参照専用の「ラベル：値」フィールド。支払詳細(追加口請求書有)の「基本情報」と同一テーマ：
// ラベル（青太字・右寄せ・固定幅）を左、値を同一行に素テキストで表示する。
function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <label
        className={`${FORM_LABEL_CLASS} whitespace-nowrap w-36 text-right`}
      >
        {label}
      </label>
      <span className="h-8 flex items-center text-sm text-gray-900">
        {valueOrEmpty(value)}
      </span>
    </div>
  );
}

// 行操作（コピー・削除）セル。各列を直接編集できるため「編集」ボタンは持たない。
const ActionCellRenderer = (props: ICellRendererParams) => {
  const { onCopy, onDelete } = props.context;
  return (
    <div className="flex h-full items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onCopy?.(props.data)}
        className="rounded p-1 text-green-600 transition-colors hover:bg-green-50 hover:text-green-800 focus:ring-2 focus:ring-green-500 focus:outline-none"
        aria-label="コピー"
        title="コピー"
      >
        <Copy className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onDelete?.(props.data.id)}
        className="rounded p-1 text-red-600 transition-colors hover:bg-red-50 hover:text-red-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
        aria-label="削除"
        title="削除"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};

// 振替元情報（自動反映・参照専用）。ペインのヘッダー（タイトル直下）等へ独立配置できるよう外出しする。
// 支払詳細(マージン率固定・NET入力)の「基本情報」と同じ CollapsibleCard テーマで折り畳み可能とし、
// 既定は折りたたみ状態（defaultOpen=false）にする。
export function AllocationPaneSourceInfo({
  source,
}: {
  source?: AllocationPaneSource;
}) {
  const src: Required<AllocationPaneSource> = {
    ...DEFAULT_SOURCE,
    ...(source ?? {}),
  };
  return (
    <CollapsibleCard title="振替元情報" defaultOpen={false}>
      <div className="p-4">
        {/* 1行目：販売店・一次店・三次店（振替明細で「振替」を押下した行の商流） */}
        <div className="grid grid-cols-4 gap-3 mb-2 items-center pb-3 border-b border-gray-300">
          <ReadonlyField label="販売店" value={src.store} />
          <ReadonlyField label="一次店" value={src.primaryStore} />
          <ReadonlyField label="三次店" value={src.tertiaryStore} />
        </div>
        {/* 2行目：費用負担部署・管理区分・管理コード（基本情報と同様に行ごとに下線で区切る） */}
        <div className="grid grid-cols-4 gap-3 mb-2 items-center pb-3 border-b border-gray-300">
          <ReadonlyField label="費用負担部署" value={src.dept} />
          <ReadonlyField
            label="管理区分"
            value={joinNameCode(src.mgmtClassName, src.mgmtClass)}
          />
          <ReadonlyField
            label="管理コード"
            value={joinNameCode(src.mgmtCodeName, src.mgmtCode)}
          />
        </div>
        {/* 3行目：支払金額・施策区分・施策コード */}
        <div className="grid grid-cols-4 gap-3 mb-2 items-center pb-3 border-b border-gray-300">
          <ReadonlyField label="支払金額" value={formatInt(src.payAmount)} />
          <ReadonlyField
            label="施策区分"
            value={joinNameCode(src.measureClassName, src.measureClass)}
          />
          <ReadonlyField
            label="施策コード"
            value={joinNameCode(src.measureCodeName, src.measureCode)}
          />
        </div>
        {/* 4行目：支払No・支払回数・明細No（振替明細で「振替」を押下した行の値） */}
        <div className="grid grid-cols-4 gap-3 mb-2 items-center pb-3 border-b border-gray-300">
          <ReadonlyField label="支払No" value={src.paymentDetailNo} />
          <ReadonlyField label="支払回数" value={toText(src.paymentCount)} />
          <ReadonlyField label="明細No" value={toText(src.detailNo)} />
        </div>
        {/* 5行目：摘要1（社内用）・摘要2（社外用）。最終行・下線なし。
            値が長くなるため2列分の幅を割り当てる。 */}
        <div className="grid grid-cols-4 gap-3 mb-2 items-center">
          <div className="col-span-2">
            <ReadonlyField label="摘要1（社内用）" value={src.summary1} />
          </div>
          <div className="col-span-2">
            <ReadonlyField label="摘要2（社外用）" value={src.summary2} />
          </div>
        </div>
      </div>
    </CollapsibleCard>
  );
}

// ============================================================================
// 本体
// ============================================================================

// 費用振替 画面（下ペイン用）。振替元（費用振替登録）のみを表示する。
// 確定操作（振替内容を反映）はペインのヘッダー右端へ集約するため、
// 実行関数（register）を親へ公開する（費用分割の「分割内容を反映」と同じ構成）。
export interface AllocationPaneHandle {
  // 整合チェック後、振替先明細を親へ渡して費用振替を反映する（振替内容を反映）。
  register: () => void;
}

export const AllocationPane = forwardRef<
  AllocationPaneHandle,
  AllocationPaneProps
>(function AllocationPane(
  {
    source,
    destDefaults,
    initialDests,
    onConfirm,
    destFieldsLocked = false,
  }: AllocationPaneProps,
  ref
) {
  const src = useMemo<Required<AllocationPaneSource>>(
    () => ({ ...DEFAULT_SOURCE, ...(source ?? {}) }),
    [source]
  );

  // 振替先明細グリッドの API 参照（編集開始などに使用）。
  const gridRef = useRef<AgGridReact<DestRow>>(null);
  // 振替先明細行の ID 採番用の連番。
  const rowSeq = useRef(1);
  // 振替先追加の初期行。一次店〜担当者は、「振替先を固定する」のときは基本情報の値
  //（destDefaults）を、そうでなければ振替元情報（src）の値を引き継ぐ。
  // 管理区分〜施策コード名称は、「振替元を固定する」のとき振替元情報（src）を引き継ぐ（振替先は空白）。
  const makeEmptyRow = useCallback((): DestRow => {
    const id = `dest-${rowSeq.current++}`;
    return {
      id,
      product: src.product, // 対象商品＝振替対象の拡売費「商品」
      expenseItem: '', // 経費項目＝空白
      amount: null, // 振替金額＝空白
      primaryStore: destDefaults?.primaryStore ?? src.primaryStore, // 一次店
      tertiaryStore: destDefaults?.tertiaryStore ?? src.tertiaryStore, // 三次店
      store: destDefaults?.store ?? src.store, // 販売店
      dept: destDefaults?.dept ?? src.dept, // 費用負担部署（基本情報の部署）
      staff: destDefaults?.staff ?? src.staff, // 担当者（基本情報の営業担当者）
      // 管理区分〜施策コード名称は、「振替元を固定する」（destDefaults なし）のとき、
      // 振替を押下した行（src）の値を引き継ぐ。「振替先を固定する」のときは空白。
      // 管理区分／施策区分の列は名称を保持し（コード列は列側で導出）、コード列はコードを保持する。
      mgmtClass: destDefaults ? '' : src.mgmtClassName,
      mgmtCode: destDefaults ? '' : src.mgmtCode,
      measureClass: destDefaults ? '' : src.measureClassName,
      measureCode: destDefaults ? '' : src.measureCode,
      // 摘要１・摘要２は空白。
      summary1: '',
      summary2: '',
    };
  }, [src, destDefaults]);

  // 行ID（参照安定化のため useCallback 化：→ 02 §7.1）。
  const getDestRowId = useCallback((p: any) => p.data.id, []);

  // コピーで増えた行を見つけやすくする（行全体をフラッシュし可視域へ送る）。
  const revealDest = useRevealNewRows();

  // 列状態（列幅・並び順・ソート）の永続化（→ 02 §7）。列幅は設計値を優先する。
  const destColumnStateProps = useGridColumnState(
    'paymentAllocate.dest.columnState.v1',
    {
      autoSize: false,
      onGridReady: (event: any) => revealDest.captureApi(event.api),
    }
  );

  // 連動セルのキャッシュ破棄関数。宣言順の都合で ref 経由に保持する（→ 02 §7.3）。
  const clearLinkedCacheRef = useRef<() => void>(() => {});

  // initialDests の1件を振替先明細の1行に変換する。
  //   振替金額＝支払金額（amount）、対象商品＝商品（product）。
  //   一次店・三次店・販売店・費用負担部署・担当者・管理区分/コード・施策区分/コード・摘要は、
  //   指定があればその値を、無ければ振替元情報（makeEmptyRow が src から設定）を引き継ぐ。
  const toDestRow = useCallback(
    (t: AllocationPaneDest): DestRow => {
      const base = makeEmptyRow();
      return {
        ...base,
        sourceLineNo: t.sourceLineNo,
        product: t.product,
        amount: t.amount,
        primaryStore: t.primaryStore ?? base.primaryStore,
        tertiaryStore: t.tertiaryStore ?? base.tertiaryStore,
        store: t.store ?? base.store,
        dept: t.dept ?? base.dept,
        staff: t.staff ?? base.staff,
        mgmtClass: t.mgmtClass ?? base.mgmtClass,
        mgmtCode: t.mgmtCode ?? base.mgmtCode,
        measureClass: t.measureClass ?? base.measureClass,
        measureCode: t.measureCode ?? base.measureCode,
        summary1: t.summary1 ?? base.summary1,
        summary2: t.summary2 ?? base.summary2,
      };
    },
    [makeEmptyRow]
  );

  // 初期行：振替対象行の費用振替先（initialDests＝一覧の枝番行）を1行ずつ生成する。
  // 既存の振替先が無い（＝検印済み明細の「振替処理」や、振替先未登録行の「振替処理」で開いた）
  // ときは、入力をすぐ始められるよう新規行を1行だけ追加した状態で開く。
  // 当ペインは閉じるたびにアンマウントされるため、開くたびにこの初期化子が評価される。
  const [destRows, setDestRows] = useState<DestRow[]>(() =>
    initialDests?.length ? initialDests.map(toDestRow) : [makeEmptyRow()]
  );

  // 一覧側で枝番行が削除されたとき（initialDests から消えたとき）、
  // 振替先明細の対応行も取り除く。画面で追加した行（sourceLineNo なし）と
  // 残っている引き継ぎ行の入力内容はそのまま保持する。
  useEffect(() => {
    const alive = new Set(
      (initialDests ?? [])
        .map((d) => d.sourceLineNo)
        .filter((v): v is string => !!v)
    );
    setDestRows((prev) =>
      prev.filter((r) => !r.sourceLineNo || alive.has(r.sourceLineNo))
    );
    // 行構成が変わるため連動セルのキャッシュを破棄する（→ 02 §7.3）。
    clearLinkedCacheRef.current();
  }, [initialDests]);

  // セル編集では rowData（destRows）の参照を変えない（Undo/Redo 維持：→ 02 §7.1）。
  // 行オブジェクトは AG Grid が直接更新するため、合計・バリデーションの再計算用に
  // バージョンだけ進めて再レンダーさせる。
  const [editVersion, setEditVersion] = useState(0);
  const handleCellValueChanged = useCallback(
    () => setEditVersion((v) => v + 1),
    []
  );

  // ------------------------------------------------------------------
  // 金額サマリ（支払金額計・振替金額計・残金額計）
  // ------------------------------------------------------------------
  const payTotal = src.payAmount;
  // セル編集は destRows の参照を変えないため、editVersion も依存に含めて再集計する。
  const splitTotal = useMemo(
    () => destRows.reduce((s, r) => s + (r.amount ?? 0), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [destRows, editVersion]
  );
  const remainTotal = payTotal - splitTotal;
  const isRemainNegative = remainTotal < 0;

  // ------------------------------------------------------------------
  // 振替先明細グリッド
  // ------------------------------------------------------------------
  const handleAddDestRow = useCallback(() => {
    setDestRows((prev) => [...prev, makeEmptyRow()]);
  }, [makeEmptyRow]);

  const handleDeleteDestRow = useCallback((id: string) => {
    // 0件でも可（最低1行の制限なし）。
    setDestRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // コピー：対象行を複製し、直下に一意なIDで挿入する。
  const handleCopyDestRow = useCallback((row: DestRow) => {
    setDestRows((prev) => {
      const idx = prev.findIndex((r) => r.id === row.id);
      const copy: DestRow = { ...row, id: `dest-${rowSeq.current++}` };
      // コピーした行を強調対象にする（行が反映された後にフラッシュされる）
      revealDest.markRows([copy]);
      const next = [...prev];
      next.splice(idx < 0 ? prev.length : idx + 1, 0, copy);
      return next;
    });
  }, []);

  // 管理区分↔管理コード／施策区分↔施策コードの連動更新は共通フックに委譲する（→ 02 §7.3）。
  // 従属セルは Undo スタックに積まれないため、Ctrl+Z 1回で主セルごと一括復元される。
  const { makeHandler: makeLinkedHandler, clearCache: clearLinkedCache } =
    useLinkedCellUndo<DestRow>();
  clearLinkedCacheRef.current = clearLinkedCache;

  // 一次店・三次店・販売店（商流）と、費用負担部署・担当者（組織）の連動。
  // 主セル以外の4項目を従属セルとして一括更新するため、Undo は主セル1回でまとめて元に戻る。
  //   一次店   → 配下でなくなった三次店・販売店をクリア
  //   三次店   → 一次店を自動設定し、配下でなくなった販売店をクリア
  //   販売店  → 一次店・三次店を自動設定し、支払として存在しない部署・担当者をクリア（一意なら自動設定）
  //   部署    → 組合せに無い販売店・担当者をクリア（担当者が一意なら自動設定）
  //   担当者  → 部署を一意に自動設定し、組合せに無い販売店をクリア
  // 組織側の候補は「振替元と同じ対象年月の支払」に限定する（→ constants/paymentOrgCascade）。
  const cascadeDeps =
    (field: keyof StoreOrgSelection) =>
    (_mainValue: string, row: DestRow): Partial<DestRow> => {
      const next = applyStoreOrgCascade(
        {
          primaryStore: row.primaryStore ?? '',
          tertiaryStore: row.tertiaryStore ?? '',
          store: row.store ?? '',
          dept: row.dept ?? '',
          staff: row.staff ?? '',
        },
        field,
        String(row[field] ?? ''),
        src.targetPeriod
      );
      const deps: Partial<DestRow> = {};
      if (field !== 'primaryStore') deps.primaryStore = next.primaryStore;
      if (field !== 'tertiaryStore') deps.tertiaryStore = next.tertiaryStore;
      if (field !== 'store') deps.store = next.store;
      if (field !== 'dept') deps.dept = next.dept;
      if (field !== 'staff') deps.staff = next.staff;
      return deps;
    };
  // 各主セルの従属セル＝連動対象5項目から自身を除いたもの。
  const depFieldsExcept = (field: keyof StoreOrgSelection) =>
    (
      ['primaryStore', 'tertiaryStore', 'store', 'dept', 'staff'] as const
    ).filter((f) => f !== field) as (keyof DestRow)[];
  const handlePrimaryStoreChanged = makeLinkedHandler('primaryStore', {
    depFields: depFieldsExcept('primaryStore'),
    deriveDeps: cascadeDeps('primaryStore'),
  });
  const handleTertiaryStoreChanged = makeLinkedHandler('tertiaryStore', {
    depFields: depFieldsExcept('tertiaryStore'),
    deriveDeps: cascadeDeps('tertiaryStore'),
  });
  const handleStoreChanged = makeLinkedHandler('store', {
    depFields: depFieldsExcept('store'),
    deriveDeps: cascadeDeps('store'),
  });
  const handleDeptChanged = makeLinkedHandler('dept', {
    depFields: depFieldsExcept('dept'),
    deriveDeps: cascadeDeps('dept'),
  });
  const handleStaffChanged = makeLinkedHandler('staff', {
    depFields: depFieldsExcept('staff'),
    deriveDeps: cascadeDeps('staff'),
  });

  // 以下4つの連動は、コード列・名称列のどちらから確定しても同じ結果になるよう、
  // 確定値（params.newValue＝名称列では名称）ではなく行データの値を基準に導出する。
  // 管理コード（コード列・名称列）確定時：対応する管理区分を自動セットする。
  const handleMgmtCodeChanged = makeLinkedHandler('mgmtCode', {
    depFields: ['mgmtClass'],
    deriveDeps: (_value, row) => ({
      mgmtClass: managementClassFromCode(row.mgmtCode) || row.mgmtClass,
    }),
  });
  // 管理区分（区分値列・名称列）確定時：該当しない管理コードはクリアする。
  const handleMgmtClassChanged = makeLinkedHandler('mgmtClass', {
    depFields: ['mgmtCode'],
    deriveDeps: (_value, row) => ({
      mgmtCode:
        row.mgmtCode && !isManagementCodeInClass(row.mgmtCode, row.mgmtClass)
          ? ''
          : row.mgmtCode,
    }),
  });
  // 施策コード（コード列・名称列）確定時：対応する施策区分を自動セットする。
  const handleCampaignCodeChanged = makeLinkedHandler('measureCode', {
    depFields: ['measureClass'],
    deriveDeps: (_value, row) => ({
      measureClass: campaignClassFromCode(row.measureCode) || row.measureClass,
    }),
  });
  // 施策区分（区分値列・名称列）確定時：該当しない施策コードはクリアする。
  const handleCampaignClassChanged = makeLinkedHandler('measureClass', {
    depFields: ['measureCode'],
    deriveDeps: (_value, row) => ({
      measureCode:
        row.measureCode &&
        !isCampaignCodeInClass(row.measureCode, row.measureClass)
          ? ''
          : row.measureCode,
    }),
  });

  const destContext = useMemo(
    () => ({
      onCopy: handleCopyDestRow,
      onDelete: handleDeleteDestRow,
    }),
    [handleCopyDestRow, handleDeleteDestRow]
  );

  // 金額セル：白背景（編集可）＋右寄せ。
  // 金額セル：白背景（編集可）。右寄せは共通クラス cell-right で指定する（→ 02 §7）。
  const editableAmountStyle = { backgroundColor: GRID_COLORS.editable };
  const editableTextStyle = { backgroundColor: GRID_COLORS.editable };
  // 編集不可セル：灰（gridStyles の readonly）。
  const readonlyTextStyle = { backgroundColor: GRID_COLORS.readonly };

  // Excel「振替先明細」シートの列構成：対象商品／経費項目／〔振替先グループ〕。
  const destColumnDefs = useMemo<(ColDef<DestRow> | ColGroupDef<DestRow>)[]>(
    () => {
      // 「振替先」グループ配下の列（振替金額〜摘要２）。
      const splitChildren = withHeaderTooltips<DestRow>([
        {
          headerName: '振替金額',
          field: 'amount',
          width: 120,
          editable: true,
          cellEditor: 'agNumberCellEditor',
          valueParser: (p: ValueParserParams) => {
            const n = Number(p.newValue);
            return Number.isFinite(n) ? n : null;
          },
          valueFormatter: (p: ValueFormatterParams) =>
            formatInt(p.value as number | null),
          cellClass: 'cell-right',
          cellStyle: editableAmountStyle,
        },
        {
          // 一次店：全件から選択。選択すると配下でなくなった三次店・販売店をクリアする。
          headerName: '一次店',
          field: 'primaryStore',
          width: 220,
          editable: !destFieldsLocked,
          cellStyle: destFieldsLocked ? readonlyTextStyle : editableTextStyle,
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          cellEditorParams: {
            comboOptions: PRIMARY_STORE_OPTIONS,
            placeholder: '一次店を選択',
          },
          onCellValueChanged: handlePrimaryStoreChanged,
        },
        {
          // 三次店：当該行の一次店の配下に絞り込む。選択すると一次店を自動設定する。
          headerName: '三次店',
          field: 'tertiaryStore',
          width: 220,
          editable: !destFieldsLocked,
          cellStyle: destFieldsLocked ? readonlyTextStyle : editableTextStyle,
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          cellEditorParams: (params: any) => ({
            comboOptions: tertiaryOptionsFor(params.data?.primaryStore ?? ''),
            placeholder: '三次店を選択',
          }),
          onCellValueChanged: handleTertiaryStoreChanged,
        },
        {
          // 販売店：当該行の一次店・三次店の配下に絞り込む。選択すると一次店・三次店を自動設定する。
          headerName: '販売店',
          field: 'store',
          width: 200,
          editable: !destFieldsLocked,
          cellStyle: destFieldsLocked ? readonlyTextStyle : editableTextStyle,
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          cellEditorParams: (params: any) => ({
            comboOptions: storeOptionsFor(
              params.data?.primaryStore ?? '',
              params.data?.tertiaryStore ?? ''
            ),
            placeholder: '販売店を選択',
          }),
          onCellValueChanged: handleStoreChanged,
        },
        {
          // 費用負担部署：当該行の販売店・担当者との組合せが支払として存在するものだけに絞り込む。
          // 選択すると組合せに無い販売店・担当者はクリアし、担当者が一意なら自動設定する。
          headerName: '費用負担部署',
          field: 'dept',
          width: 200,
          editable: !destFieldsLocked,
          cellStyle: destFieldsLocked ? readonlyTextStyle : editableTextStyle,
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          cellEditorParams: (params: any) => ({
            comboOptions: deptOptionsFor(
              params.data?.store ?? '',
              params.data?.staff ?? '',
              src.targetPeriod
            ),
            placeholder: '費用負担部署を選択',
          }),
          onCellValueChanged: handleDeptChanged,
        },
        {
          // 担当者：当該行の販売店・費用負担部署との組合せが支払として存在するものだけに絞り込む。
          // 選択すると費用負担部署が一意に定まり自動設定される。
          headerName: '担当者',
          field: 'staff',
          width: 120,
          editable: !destFieldsLocked,
          cellStyle: destFieldsLocked ? readonlyTextStyle : editableTextStyle,
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          cellEditorParams: (params: any) => ({
            comboOptions: staffOptionsFor(
              params.data?.store ?? '',
              params.data?.dept ?? '',
              src.targetPeriod
            ),
            placeholder: '担当者を選択',
          }),
          onCellValueChanged: handleStaffChanged,
        },
        {
          // 管理区分（コード＝区分値）。名称 mgmtClass から区分値を導出表示。名称＋区分値の2行コンボで選択。
          headerName: '管理区分',
          colId: 'mgmtClassCode',
          field: 'mgmtClass',
          width: 130,
          editable: true,
          cellStyle: editableTextStyle,
          valueFormatter: (p: any) => managementClassCode(p.value),
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          cellEditorParams: {
            comboOptions: managementClassComboOptions(),
            placeholder: '管理区分を選択',
          },
          onCellValueChanged: handleMgmtClassChanged,
        },
        {
          // 管理区分名称：行が保持する名称（mgmtClass）をそのまま表示・入力する列。
          // 名称からも選択でき、管理区分（区分値）列と相互連動する。
          headerName: '管理区分名称',
          colId: 'mgmtClassName',
          field: 'mgmtClass',
          width: 200,
          editable: true,
          cellStyle: editableTextStyle,
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          cellEditorParams: {
            comboOptions: managementClassComboOptions(),
            placeholder: '管理区分名称を選択',
          },
          onCellValueChanged: handleMgmtClassChanged,
        },
        {
          // 管理コード：コードを保持・表示。コード＋名称の2行コンボで選択。
          // 管理区分が選択済みなら該当コードのみに絞り込み、選択で管理区分を自動セット。
          headerName: '管理コード',
          colId: 'mgmtCodeCode',
          field: 'mgmtCode',
          width: 130,
          editable: true,
          cellStyle: editableTextStyle,
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          cellEditorParams: (params: any) => ({
            comboOptions: managementCodeComboOptions(
              EXPENSE_MANAGEMENT_CODE_OPTIONS.map((o) => o.value).filter(
                (c) =>
                  !params.data.mgmtClass ||
                  isManagementCodeInClass(c, params.data.mgmtClass)
              )
            ),
            placeholder: '管理コードを選択',
          }),
          onCellValueChanged: handleMgmtCodeChanged,
        },
        {
          // 管理コード名称：コード mgmtCode の名称を表示・入力する列。
          // 名称で選択した場合も行は管理コードを保持し、管理区分も自動でセットする。
          headerName: '管理コード名称',
          colId: 'mgmtCodeName',
          width: 170,
          editable: true,
          cellStyle: editableTextStyle,
          valueGetter: (p: any) => managementCodeNameOf(p.data?.mgmtCode ?? ''),
          valueSetter: (p: any) => {
            p.data.mgmtCode = managementCodeOfName(p.newValue);
            return true;
          },
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          cellEditorParams: (params: any) => ({
            comboOptions: managementCodeNameComboOptions(
              EXPENSE_MANAGEMENT_CODE_OPTIONS.map((o) => o.value).filter(
                (c) =>
                  !params.data.mgmtClass ||
                  isManagementCodeInClass(c, params.data.mgmtClass)
              )
            ),
            placeholder: '管理コード名称を選択',
          }),
          onCellValueChanged: handleMgmtCodeChanged,
        },
        {
          // 施策区分（コード＝区分値）。名称 measureClass から区分値を導出表示。名称＋区分値の2行コンボで選択。
          headerName: '施策区分',
          colId: 'measureClassCode',
          field: 'measureClass',
          width: 110,
          editable: true,
          cellStyle: editableTextStyle,
          valueFormatter: (p: any) => campaignClassCode(p.value),
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          cellEditorParams: {
            comboOptions: campaignClassComboOptions(),
            placeholder: '施策区分を選択',
          },
          onCellValueChanged: handleCampaignClassChanged,
        },
        {
          // 施策区分名称：行が保持する名称（measureClass）をそのまま表示・入力する列。
          // 名称からも選択でき、施策区分（区分値）列と相互連動する。
          headerName: '施策区分名称',
          colId: 'measureClassName',
          field: 'measureClass',
          width: 130,
          editable: true,
          cellStyle: editableTextStyle,
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          cellEditorParams: {
            comboOptions: campaignClassComboOptions(),
            placeholder: '施策区分名称を選択',
          },
          onCellValueChanged: handleCampaignClassChanged,
        },
        {
          // 施策コード：コードを保持・表示。コード＋名称の2行コンボで選択。
          // 施策区分が選択済みなら該当コードのみに絞り込み、選択で施策区分を自動セット。
          headerName: '施策コード',
          colId: 'measureCodeCode',
          field: 'measureCode',
          width: 130,
          editable: true,
          cellStyle: editableTextStyle,
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          cellEditorParams: (params: any) => ({
            comboOptions: campaignCodeComboOptions(
              EXPENSE_CAMPAIGN_CODE_OPTIONS.map((o) => o.value).filter(
                (c) =>
                  !params.data.measureClass ||
                  isCampaignCodeInClass(c, params.data.measureClass)
              )
            ),
            placeholder: '施策コードを選択',
          }),
          onCellValueChanged: handleCampaignCodeChanged,
        },
        {
          // 施策コード名称：コード measureCode の名称を表示・入力する列。
          // 名称で選択した場合も行は施策コードを保持し、施策区分も自動でセットする。
          headerName: '施策コード名称',
          colId: 'measureCodeName',
          width: 190,
          editable: true,
          cellStyle: editableTextStyle,
          valueGetter: (p: any) =>
            campaignCodeNameOf(p.data?.measureCode ?? ''),
          valueSetter: (p: any) => {
            p.data.measureCode = campaignCodeOfName(p.newValue);
            return true;
          },
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          cellEditorParams: (params: any) => ({
            comboOptions: campaignCodeNameComboOptions(
              EXPENSE_CAMPAIGN_CODE_OPTIONS.map((o) => o.value).filter(
                (c) =>
                  !params.data.measureClass ||
                  isCampaignCodeInClass(c, params.data.measureClass)
              )
            ),
            placeholder: '施策コード名称を選択',
          }),
          onCellValueChanged: handleCampaignCodeChanged,
        },
        {
          headerName: '摘要1（社内用）',
          field: 'summary1',
          width: 180,
          editable: true,
          cellStyle: editableTextStyle,
        },
        {
          // 摘要2（社外用）：最後の列を flex で伸ばし、右固定の操作列との間に余白ができないよう
          // 残り幅いっぱいまで広げる（コンテナが狭い時は minWidth で従来幅を保つ）。
          headerName: '摘要2（社外用）',
          field: 'summary2',
          flex: 1,
          minWidth: 180,
          editable: true,
          cellStyle: editableTextStyle,
        },
      ]);

      // 対象商品はグループ外（ヘッダー2段をまたいで表示）。
      const leading = withHeaderTooltips<DestRow>([
        {
          // 対象商品は入力非活性（編集不可）。背景は編集不可セル色。
          headerName: '対象商品',
          field: 'product',
          width: 130,
          editable: false,
          cellStyle: readonlyTextStyle,
        },
      ]);

      // 一覧の一番右に操作列（コピー・削除）を右固定で追加。
      const actionCol: ColDef<DestRow> = {
        headerName: '',
        colId: 'actions',
        width: 88,
        pinned: 'right',
        lockPinned: true,
        editable: false,
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: ActionCellRenderer,
        cellStyle: { backgroundColor: GRID_COLORS.editable },
      };

      return [
        ...leading,
        { headerName: '振替先', children: splitChildren },
        actionCol,
      ];
    },
    // 固定指定（振替元／振替先）の切替で活性・背景色が変わるため作り直す。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [destFieldsLocked, src.targetPeriod]
  );

  const destDefaultColDef = useMemo<ColDef>(
    () => ({ ...GRID_DEFAULT_COL_DEF, sortable: false, filter: false }),
    []
  );

  // 振替入力の整合チェック（未入力金額・残金額マイナスを弾く）。
  const validateSplit = useCallback((): boolean => {
    if (destRows.some((r) => r.amount == null || r.amount <= 0)) {
      toast.error('振替金額が未入力（または0以下）の振替先があります。');
      return false;
    }
    if (isRemainNegative) {
      toast.error(
        '残金額がマイナスです。振替金額を支払金額以内にしてください。'
      );
      return false;
    }
    return true;
  }, [destRows, isRemainNegative]);

  // 振替内容を反映：整合チェック後、振替先明細を親へ渡して費用振替を登録する
  //（ペインのヘッダー右端の主アクション）。
  const handleRegister = useCallback(() => {
    if (!validateSplit()) return;
    // 保存確定：連動セルのキャッシュを破棄する（→ 02 §7.3）。
    clearLinkedCache();
    toast.success('費用振替を登録しました。');
    onConfirm?.(
      destRows.map((r) => ({
        product: r.product,
        amount: r.amount ?? 0,
        mgmtClass: r.mgmtClass,
        mgmtCode: r.mgmtCode,
        measureClass: r.measureClass,
        measureCode: r.measureCode,
        summary1: r.summary1,
        summary2: r.summary2,
        dept: r.dept,
        store: r.store,
        tertiaryStore: r.tertiaryStore,
        primaryStore: r.primaryStore,
        // 事業場・営業担当者（一覧では非表示。振替先グループ側の裏データとして保持する）。
        office: src.office,
        staff: r.staff,
      }))
    );
  }, [validateSplit, destRows, onConfirm, src.office, clearLinkedCache]);

  // 下ペインのヘッダー（親）から「振替内容を反映」を実行できるように公開する。
  useImperativeHandle(ref, () => ({ register: handleRegister }), [
    handleRegister,
  ]);

  return (
    // ペイン高さにフィットさせ外側スクロールを無くす（h-full）。縦幅を縮めても
    // 上部（振替元情報・合計エリア）とフッタは常に見え、伸縮するのは一覧のみ。
    <div className="flex h-full flex-col">
      {/* タイトル直下：振替元情報（折り畳み）。開いて縦幅が足りない時はこの領域だけ
          内部スクロールして縮み、一覧（件数表示）を圧迫しない。 */}
      <div className="min-h-0 shrink overflow-y-auto">
        <AllocationPaneSourceInfo source={source} />
      </div>

      {/* 振替先明細（入力・行追加／削除）。section は shrink-0＋min-h-[11rem] で潰れず、
          一覧（件数表示）が常に見える高さを確保する。flex-1 で余剰高さを吸収し、
          振替元情報を開いた時は上の領域がスクロールして縮むため件数は常に見える。 */}
      <section className="mb-3 flex min-h-[11rem] shrink-0 grow flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* ヘッダ（支払詳細(マージン率固定・NET入力)の追加口ヘッダと同テーマ：
            card-header-accent のタイトルバー＋アウトライン青ボタン） */}
        <div className="card-header-accent flex shrink-0 items-center justify-between bg-white px-3 py-2 text-left text-gray-900">
          <span className={CARD_TITLE_CLASS}>振替先明細</span>
          <button
            type="button"
            onClick={handleAddDestRow}
            className="rounded-lg border-2 border-blue-600 bg-white px-3 py-1 text-sm whitespace-nowrap text-blue-600 transition-colors hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            aria-label="振替先追加"
          >
            ＋振替先追加
          </button>
        </div>

        {/* 合計エリア（一覧の上・常時表示・自動計算／整合チェック）。
            テーマは拡売費の合計サマリーバーに準拠（左「合計」ラベル＋区切り罫線）。 */}
        <div className="shrink-0 px-3 pt-2">
          <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            {/* 合計ラベル（全高・左揃え） */}
            <div className="flex shrink-0 items-center border-r border-gray-200 px-4 text-left text-sm font-bold whitespace-nowrap text-gray-900">
              合計
            </div>
            <div className="flex min-w-[10.5rem] flex-col items-end justify-center border-r border-gray-200 px-3 py-1">
              <span className="text-xs whitespace-nowrap text-gray-500">
                支払金額 計
              </span>
              <span className="text-sm font-bold whitespace-nowrap text-blue-700">
                {formatInt(payTotal)} 円
              </span>
            </div>
            <div className="flex min-w-[10.5rem] flex-col items-end justify-center border-r border-gray-200 px-3 py-1">
              <span className="text-xs whitespace-nowrap text-gray-500">
                振替金額 計
              </span>
              <span className="text-sm font-bold whitespace-nowrap text-blue-700">
                {formatInt(splitTotal)} 円
              </span>
            </div>
            <div className="flex min-w-[10.5rem] flex-col items-end justify-center px-3 py-1">
              <span className="text-xs whitespace-nowrap text-gray-500">
                残金額 計（支払−振替）
              </span>
              <span
                className={`text-sm font-bold whitespace-nowrap ${
                  isRemainNegative ? 'text-red-600' : 'text-blue-700'
                }`}
              >
                {formatInt(remainTotal)} 円
              </span>
            </div>
          </div>
          {isRemainNegative && (
            <p className="mt-2 flex items-center gap-1 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4" />
              振替金額の合計が支払金額を超えています。残金額がマイナスにならないよう調整してください。
            </p>
          )}
        </div>

        <div className="min-h-0 w-full flex-1 px-3 pt-2 pb-3">
          <AgGridReact
            ref={gridRef}
            rowData={destRows}
            columnDefs={destColumnDefs}
            defaultColDef={destDefaultColDef}
            // defaultColDef で filter: false のため、型によるフィルタの追加を止める（→ grid/gridCommon）
            columnTypes={GRID_NO_FILTER_COLUMN_TYPES}
            context={destContext}
            getRowId={getDestRowId}
            onRowDataUpdated={revealDest.onRowDataUpdated}
            onCellValueChanged={handleCellValueChanged}
            statusBar={GRID_STATUS_BAR}
            {...destColumnStateProps}
            {...GRID_BASE_PROPS}
          />
        </div>
      </section>

      {/* 確定操作（振替内容を反映）はペインのヘッダー右端に置くため、フッターは持たない
          （費用分割の「分割内容を反映」と同じ構成）。 */}
    </div>
  );
});
