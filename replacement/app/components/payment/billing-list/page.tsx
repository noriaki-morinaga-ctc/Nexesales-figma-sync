// 請求一覧 ─ 課題891/893
// AIC（情報センター）が入力する請求内容を一覧で管理する画面。1行＝入力単位1件
// （PPT スライド8：請求内容反映画面は請求元事業所毎の管理（請求・支払・集計）とする）。
// 1つの入力単位には複数の請求書No. が含まれるため、請求書No. は明細側で持つ。
// 構成は計画一覧（PlanList）に準拠：検索条件カード ＋ 一覧カードの2カード、
// 検索ボタンは設けず検索条件の変更が即時に一覧へ反映される。
//
// 表示項目は「シングル画面案.xlsx ⑤-１請求・支払反映画面」のヘッダー部（管理単位＋集計項目）と
// 同シートのステータスに限る（資料に記載のある項目のみ）。
import { useState, useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type {
  ColDef,
  GetRowIdParams,
  RowDoubleClickedEvent,
} from 'ag-grid-community';
import { Search, Clock, CheckCircle, Plus, Trash2 } from 'lucide-react';
import { CopyableArea } from '../../ui/copyable-area';
import { CollapsibleCard } from '../../ui/collapsible-card';
import { SearchClearButton } from '../../ui/search-clear-button';
import {
  buildSearchSummary,
  formatSummaryRange,
} from '../../ui/search-summary';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { DateMonthYearPicker } from '../../ui/date-month-year-picker';
import { SingleCombobox } from '../../ui/single-combobox';
import {
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  useGridColumnState,
  withHeaderTooltips,
  gridFilterContextMenuItems,
  GRID_DATE_TEXT_FILTER,
  GRID_EMPTY_TEXT,
} from '../../grid';
import {
  BUTTON_STYLES,
  BUTTON_BASE,
  FORM_LABEL_CLASS,
} from '../../../../styles/commonStyles';
import {
  BILLING_LIST,
  BILLING_STATUS_OPTIONS,
  BILLING_PROVIDER_OPTIONS,
  BILLING_DATA_SOURCE_OPTIONS,
  billingCompanyOptionsOf,
  billingOfficeOptionsOf,
  type BillingRow,
  type BillingStatus,
} from '../../../constants/billingMockData';
import { ScreenTitle } from '../../ui/screen-title';

interface BillingListProps {
  // 行の「入力」ボタン／行ダブルクリックで請求詳細を開く
  onOpenDetail?: (entry: BillingRow) => void;
  // 「新規作成」ボタンで空の入力単位の請求詳細を開く
  onCreate?: () => void;
}

// 選択条件の未選択（＝絞り込まない）を表す値。未選択は「指定なし」と表示し、
// 「全て」の選択肢は持たない（→ 02 §9）。
const ALL = '';

// 検索条件の初期値。
// 対象年月は入力単位のキーから外れたため（20260818_第30回 宿題事項15）、受付日時
//（請求EDI＝受信日時／AIC入力＝登録日時）の範囲で絞り込む。データ元の条件も追加する（決定23）。
// 受付日時の範囲は空＝未設定（絞り込まない）。設定時は 'YYYY/MM/DD'（DateMonthYearPicker の形式）。
// 提供企業・請求元企業・請求元企業事業所（コンボボックス）も未選択は空文字。
const INITIAL_CRITERIA = {
  receivedFrom: '',
  receivedTo: '',
  dataSource: ALL,
  provider: '',
  billCompany: '',
  billOffice: '',
  status: ALL,
};

// 入力状況ごとのアイコン・色設定（計画一覧・支払一覧と同じ方式）
const STATUS_CONFIG: Record<
  BillingStatus,
  { icon: typeof Clock; className: string }
> = {
  入力中: { icon: Clock, className: 'text-blue-500' },
  反映済: { icon: CheckCircle, className: 'text-green-600' },
};

// 金額の3桁区切り（小数は2桁まで）
const formatAmount = (value: unknown): string =>
  typeof value === 'number'
    ? value.toLocaleString('ja-JP', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    : '';

// 行IDは入力単位の id（BILLING_LIST で一意。→ 画面設計標準 4.7）
const getRowId = (params: GetRowIdParams<BillingRow>) => params.data.id;

export default function BillingList({
  onOpenDetail,
  onCreate,
}: BillingListProps) {
  const [criteria, setCriteria] = useState(INITIAL_CRITERIA);
  // 削除の確認ダイアログの対象（AIC入力の入力単位のみ。決定25）
  const [deleteTarget, setDeleteTarget] = useState<BillingRow | null>(null);

  // 列状態（列幅・並び順・ソート）の保存／復元。
  // 列構成の変更（消費税3列の削除・確定(検印)後 支払金額合計の追加、
  // v3：請求元企業・請求元企業事業所を「12桁コード:名称」表記にして列幅を拡大、
  // v4：対象年月を削除しデータ元・受付日時を追加（決定23／宿題事項15）、
  // v5：請求元企業・請求元企業事業所をコードと名称の別列に分割、
  // v6：請求元企業の前に提供企業コード・提供企業名を追加（20261006_第37回 決定事項2）に伴い
  // storageKey を更新する（旧 localStorage の列状態が復元されると並び・幅が崩れるため。→ 02 §9）
  const gridColumnStateProps = useGridColumnState('billingList.columnState.v6');

  // 検索条件による絞り込み（検索ボタンは設けず即時反映）
  const filteredRows = useMemo(() => {
    // 受付日時は 'YYYY/MM/DD HH:mm'、検索条件は 'YYYY/MM/DD' のため
    // 日付部分（先頭10文字）だけを取り出して比べる（0埋め済みで辞書順＝日付順）
    return BILLING_LIST.filter((row) => {
      const dateKey = row.receivedAt.slice(0, 10);
      if (criteria.receivedFrom && dateKey < criteria.receivedFrom)
        return false;
      if (criteria.receivedTo && dateKey > criteria.receivedTo) return false;
      if (criteria.dataSource !== ALL && row.dataSource !== criteria.dataSource)
        return false;
      if (criteria.status !== ALL && row.status !== criteria.status)
        return false;
      // 提供企業を持たない AIC入力分は、提供企業を選ぶと対象外になる
      if (criteria.provider && row.providerCode !== criteria.provider)
        return false;
      if (criteria.billCompany && row.billCompanyCode !== criteria.billCompany)
        return false;
      // 事業所は名称で突き合わせる。AIC入力分は事業所コードを持たず名称だけで
      // 識別するため（決定24）、コードで比べると AIC入力の入力単位が拾えない
      if (criteria.billOffice && row.billOfficeName !== criteria.billOffice)
        return false;
      return true;
    });
  }, [criteria]);

  // 提供企業に属する請求元企業だけを候補に出す（連動フィルタ）。
  // 提供企業が未選択のときは全件を候補にする
  const companyOptions = useMemo(
    () => billingCompanyOptionsOf(criteria.provider),
    [criteria.provider]
  );

  // 請求元企業（未選択なら提供企業）に属する事業所だけを候補に出す（連動フィルタ）。
  // どちらも未選択のときは全件を候補にする
  const officeOptions = useMemo(
    () => billingOfficeOptionsOf(criteria.billCompany, criteria.provider),
    [criteria.billCompany, criteria.provider]
  );

  // 提供企業を変えたら、その提供企業に属さない請求元企業・事業所の選択は外す
  const handleProviderChange = (value: string) =>
    setCriteria((prev) => {
      const keepCompany = billingCompanyOptionsOf(value).some(
        (company) => company.code === prev.billCompany
      );
      const billCompany = keepCompany ? prev.billCompany : '';
      const keepOffice = billingOfficeOptionsOf(billCompany, value).some(
        (office) => office.name === prev.billOffice
      );
      return {
        ...prev,
        provider: value,
        billCompany,
        billOffice: keepOffice ? prev.billOffice : '',
      };
    });

  // 請求元企業を変えたら、その企業に属さない事業所の選択は外す
  const handleCompanyChange = (value: string) =>
    setCriteria((prev) => {
      const keepOffice = billingOfficeOptionsOf(value, prev.provider).some(
        (office) => office.name === prev.billOffice
      );
      return {
        ...prev,
        billCompany: value,
        billOffice: keepOffice ? prev.billOffice : '',
      };
    });

  // 検索条件カードを折り畳んだときに見出しの行へ出す要約（値が入っている項目だけ。UI/UX UX-024）。
  // 提供企業・請求元企業はコードで持つため名称に置き換える（事業所は名称で持つ）
  const searchSummary = buildSearchSummary([
    {
      label: '受付日時',
      value: formatSummaryRange(criteria.receivedFrom, criteria.receivedTo),
    },
    { label: 'データ種別', value: criteria.dataSource },
    {
      label: '提供企業',
      value:
        BILLING_PROVIDER_OPTIONS.find((p) => p.code === criteria.provider)
          ?.name ?? criteria.provider,
    },
    {
      label: '請求元企業',
      value:
        companyOptions.find((c) => c.code === criteria.billCompany)?.name ??
        criteria.billCompany,
    },
    { label: '請求元企業事業所', value: criteria.billOffice },
    { label: '入力状況', value: criteria.status },
  ]);

  const handleClear = () => setCriteria(INITIAL_CRITERIA);

  const handleOpenDetail = useCallback(
    (entry: BillingRow) => onOpenDetail?.(entry),
    [onOpenDetail]
  );

  const handleRowDoubleClicked = useCallback(
    (event: RowDoubleClickedEvent<BillingRow>) => {
      if (event.data) handleOpenDetail(event.data);
    },
    [handleOpenDetail]
  );

  // 行操作：詳細（詳細画面へ遷移）と削除。
  // 削除は AIC入力で誤って作成した入力単位のみで、請求EDIで連携された
  // 入力単位は削除できないためボタンを表示しない（決定25 2026-08-18。データ元の区分で制御する）。
  // AIC入力でも入力状況＝反映済（支払画面へ反映済）はボタンを表示したまま非活性にする。
  // 削除アイコンの配色は計画詳細(マージン率固定・NET入力)の明細削除ボタンに揃える。
  const DetailButtonRenderer = useCallback(
    (props: { data?: BillingRow }) => (
      <div className="flex items-center justify-center gap-1">
        <button
          className={`h-8 flex-shrink-0 px-2 py-0.5 rounded-full font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm whitespace-nowrap ${BUTTON_STYLES.outline}`}
          onClick={() => props.data && handleOpenDetail(props.data)}
        >
          詳細
        </button>
        {/* 削除できない行（請求EDI）でも同じ幅の枠を置き、詳細ボタンの位置を揃える */}
        {props.data?.dataSource === 'AIC入力' ? (
          <button
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-red-600 transition-colors hover:bg-red-50 hover:text-red-800 focus:ring-2 focus:ring-red-500 focus:outline-none disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent disabled:hover:text-gray-300"
            onClick={() => props.data && setDeleteTarget(props.data)}
            disabled={props.data.status !== '入力中'}
            aria-label="削除"
            title={
              props.data.status === '入力中'
                ? '削除'
                : '反映済のため削除できません'
            }
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : (
          <span className="h-8 w-8 flex-shrink-0" aria-hidden="true" />
        )}
      </div>
    ),
    [handleOpenDetail]
  );

  // 入力状況（アイコン＋文言）
  const StatusRenderer = (props: { value?: BillingStatus }) => {
    const config = props.value ? STATUS_CONFIG[props.value] : undefined;
    if (!config) return <span className="text-gray-900">{props.value}</span>;
    const Icon = config.icon;
    return (
      <div className="flex items-center gap-1 overflow-hidden">
        <Icon className={`h-5 w-5 flex-shrink-0 ${config.className}`} />
        <span className="text-gray-900 truncate">{props.value}</span>
      </div>
    );
  };

  const columnDefs: ColDef<BillingRow>[] = useMemo(
    () => [
      {
        headerName: '',
        colId: 'entryAction',
        cellRenderer: DetailButtonRenderer,
        sortable: false,
        filter: false,
        suppressMovable: true,
        resizable: false,
        cellClass: 'cell-center',
        width: 120,
        minWidth: 120,
      },
      {
        // データ種別（決定23）。入力単位の属性で、同じ請求元企業事業所でも
        // 請求EDIとAIC入力は別の入力単位（別行）になり、1行にはまとまらない
        //（→ 20260821_第31回「請求一覧画面における請求EDIとAIC入力の分割」／課題 No.1287）。
        headerName: 'データ種別',
        field: 'dataSource',
        headerTooltip: 'EDI＝請求EDI取込／AIC入力＝AICが入力',
        cellClass: 'cell-left',
        width: 110,
      },
      {
        // 対象年月に代えて入力単位のキーにする（20260818_第30回 宿題事項15）。
        // 請求EDIの受信日時とAIC入力の登録日時を1項目で表す名称は
        // 課題 No.1287 で「受付日時」に決着した。
        headerName: '受付日時',
        field: 'receivedAt',
        ...GRID_DATE_TEXT_FILTER,
        headerTooltip: '請求EDI＝受信日時／AIC入力＝登録日時',
        cellClass: 'cell-left',
        width: 160,
      },
      // 提供企業（請求EDIレコード区分1）。請求EDI取込一覧（提供企業単位）との
      // つながりが分かるよう、請求元企業の前に置く。コードは提供企業コード
      //（提供企業事業所コードではない）。AIC入力分は提供企業を持たないため「-」
      //（→ 20261006_第37回 決定事項2・4）
      {
        headerName: '提供企業コード',
        field: 'providerCode',
        cellClass: 'cell-left',
        width: 150,
        valueFormatter: (params) => params.value || GRID_EMPTY_TEXT,
      },
      {
        headerName: '提供企業名',
        field: 'providerName',
        cellClass: 'cell-left',
        width: 200,
        valueFormatter: (params) => params.value || GRID_EMPTY_TEXT,
      },
      // 請求元企業・請求元企業事業所はコードと名称を別の列にする。
      // AIC入力分は請求元企業を特定できないためブランク、事業所はコードを持たない（決定24）
      {
        headerName: '請求元企業コード',
        field: 'billCompanyCode',
        cellClass: 'cell-left',
        width: 160,
        valueFormatter: (params) => params.value || GRID_EMPTY_TEXT,
      },
      {
        headerName: '請求元企業名',
        field: 'billCompanyName',
        cellClass: 'cell-left',
        width: 200,
        valueFormatter: (params) => params.value || GRID_EMPTY_TEXT,
      },
      {
        headerName: '請求元企業事業所コード',
        field: 'billOfficeCode',
        cellClass: 'cell-left',
        width: 190,
        valueFormatter: (params) => params.value || GRID_EMPTY_TEXT,
      },
      {
        headerName: '請求元企業事業所名',
        field: 'billOfficeName',
        cellClass: 'cell-left',
        width: 180,
      },
      {
        headerName: '入力状況',
        field: 'status',
        cellRenderer: StatusRenderer,
        cellClass: 'cell-left',
      },
      {
        headerName: '請求金額合計',
        field: 'billAmount',
        headerTooltip: '請求明細の請求金額（税抜）の合計',
        valueFormatter: (params) =>
          formatAmount(params.value) || GRID_EMPTY_TEXT,
        cellClass: 'cell-right',
      },
      {
        // 請求明細グリッドの支払金額の合計であるため「支払金額合計」とする
        // （→ 20260821_第31回 決定事項20）
        headerName: '支払金額合計',
        field: 'payAmount',
        headerTooltip:
          '請求明細の支払金額（税抜）の合計（支払画面へ反映した明細が対象）',
        valueFormatter: (params) =>
          formatAmount(params.value) || GRID_EMPTY_TEXT,
        cellClass: 'cell-right',
      },
      {
        // 請求金額と支払金額の差額。名称は課題 No.1364 で決着
        headerName: '差額（請求-支払）',
        field: 'correction',
        headerTooltip: '請求金額合計 − 支払金額合計',
        valueFormatter: (params) =>
          formatAmount(params.value) || GRID_EMPTY_TEXT,
        cellClass: 'cell-right',
      },
      // 「支払画面未反映分合計」は持たない。エラーをすべて解消してからでないと反映できず、
      // 請求金額合計と未反映分合計は必ず一致するため、未反映という概念自体をなくす
      //（→ 20260821_第31回 決定事項21）。
      // 消費税の集計も一覧では扱わない。税額の確認はBIへ寄せる（同 決定事項9〜11）。
      {
        // 支払処理の確定（検印）まで進んだ明細だけを集計した支払金額（税抜）。
        // 明細の支払金額合計とは名称で区別する（→ 同 決定事項20）。
        headerName: '確定(検印)済 支払金額合計(税抜)',
        field: 'sealedPayAmount',
        headerTooltip: '支払処理検印済の明細の支払金額合計（税抜）',
        valueFormatter: (params) =>
          formatAmount(params.value) || GRID_EMPTY_TEXT,
        cellClass: 'cell-right',
        width: 220,
      },
    ],
    [DetailButtonRenderer]
  );

  const columnDefsWithTooltip = useMemo(
    () => withHeaderTooltips(columnDefs),
    [columnDefs]
  );

  // 検索条件のプルダウン（ラベル＋Select）を共通の体裁で描画する。
  // データ種別・入力状況のように選択肢が少ない項目で使う（要件書 4.レイアウト No3・No6）
  const renderSelect = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: readonly string[]
  ) => (
    <div className="flex items-center gap-2">
      <label
        htmlFor={id}
        className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[6.875rem] text-right`}
      >
        {label}
      </label>
      <SingleCombobox
        id={id}
        className="flex-1 min-w-0"
        options={options.map((option) => ({ value: option, label: option }))}
        value={value}
        onChange={onChange}
        placeholder="指定なし"
        clearable
        searchable={false}
      />
    </div>
  );

  // 検索条件のコンボボックス（ラベル＋SingleCombobox）を共通の体裁で描画する。
  // 請求元企業・請求元企業事業所は候補が多く、名称・コードで探せる必要があるため
  // プルダウンではなくコンボボックスにする（要件書 4.レイアウト No4・No5）。
  // 未選択（空文字）＝「指定なし」（絞り込まない）で、選択の解除はコンボボックスの×で行う
  const renderCombobox = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    // 値は選択肢ごとに一意な文字列（企業＝コード、事業所＝名称）
    options: { value: string; label: string; code?: string }[]
  ) => (
    <div className="flex items-center gap-2">
      <label
        htmlFor={id}
        className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[6.875rem] text-right`}
      >
        {label}
      </label>
      <div className="min-w-0 flex-1">
        <SingleCombobox
          id={id}
          value={value}
          onChange={onChange}
          options={options}
          placeholder="指定なし"
        />
      </div>
    </div>
  );

  return (
    // ページ自体はスクロールさせず、下端の一覧カード内のグリッドだけをスクロールさせる。
    // 高さの固定値をやめて「タイトル・検索条件を引いた残り」をグリッドへ割り当て、
    // 横スクロールバーが画面外へ押し出されないようにする（支払一覧と同じ構成）。
    // 画面が低く下限 23.75rem を割り込む場合は、はみ出した分だけメイン領域側がスクロールする。
    <div className="min-w-[75rem] h-full flex flex-col">
      <div className="px-6 pt-3 pb-3 flex-1 min-h-0 flex flex-col">
        {/* 画面名はヘッダー（システム名の右）に表示する */}
        <ScreenTitle title="請求一覧" />

        {/* 検索条件カード（計画一覧と同じ折り畳みカード） */}
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
            // クリアボタンはヘッダーバーに置き、専用の行を使わない（検索はリアルタイムのため検索ボタンは廃止。計画一覧と同一体裁）
            headerActions={<SearchClearButton onClick={handleClear} />}
            collapsedSummary={searchSummary}
          >
            <div className="px-4 py-1.5">
              {/* 検索条件は1行。受付日時は内容幅（auto）で詰め、残りをプルダウンで等分する
                  （並びは一覧の列順） */}
              <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-x-5 gap-y-2.5">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="billing-received-from"
                    className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[6.875rem] text-right`}
                  >
                    受付日時
                  </label>
                  {/* 年月日（YYYY/MM/DD）のカレンダーピッカーで範囲指定する。
                      未設定時は 'YYYY/MM/DD' のプレースホルダを表示し、絞り込みを行わない。
                      ピッカー自身が aria-label を持つため、開始・終了それぞれに項目名を渡す。
                      開始＞終了の逆転を作らせないよう、開始の上限に終了・終了の下限に開始を渡す
                      （範囲外の年・月・日はカレンダー上で選択不可になる）。
                      片方が未設定（空文字）のときは上限・下限なしとして扱われる。 */}
                  <div className="flex items-center gap-2">
                    <DateMonthYearPicker
                      id="billing-received-from"
                      ariaLabel="受付日時（開始）"
                      value={criteria.receivedFrom}
                      max={criteria.receivedTo}
                      clearable
                      onChange={(value) =>
                        setCriteria((prev) => ({
                          ...prev,
                          receivedFrom: value,
                        }))
                      }
                    />
                    <span className="text-sm text-gray-700">～</span>
                    <DateMonthYearPicker
                      ariaLabel="受付日時（終了）"
                      value={criteria.receivedTo}
                      min={criteria.receivedFrom}
                      clearable
                      onChange={(value) =>
                        setCriteria((prev) => ({ ...prev, receivedTo: value }))
                      }
                    />
                  </div>
                </div>
                {renderSelect(
                  'billingDataSource',
                  'データ種別',
                  criteria.dataSource,
                  (value) =>
                    setCriteria((prev) => ({ ...prev, dataSource: value })),
                  BILLING_DATA_SOURCE_OPTIONS
                )}
                {/* 提供企業を選ぶと、請求元企業・事業所の候補をその提供企業の配下に絞る */}
                {renderCombobox(
                  'billingProvider',
                  '提供企業',
                  criteria.provider,
                  handleProviderChange,
                  BILLING_PROVIDER_OPTIONS.map((provider) => ({
                    value: provider.code,
                    label: provider.name,
                    code: provider.code,
                  }))
                )}
                {renderCombobox(
                  'billingCompany',
                  '請求元企業',
                  criteria.billCompany,
                  handleCompanyChange,
                  companyOptions.map((company) => ({
                    value: company.code,
                    label: company.name,
                    code: company.code,
                  }))
                )}
                {renderCombobox(
                  'billingOffice',
                  '請求元企業事業所',
                  criteria.billOffice,
                  (value) =>
                    setCriteria((prev) => ({ ...prev, billOffice: value })),
                  // 事業所は名称で識別する（AIC入力分はコードを持たない。決定24）。
                  // コードを持つ事業所はコードも並べて表示し、コードでも探せるようにする
                  officeOptions.map((office) => ({
                    value: office.name,
                    label: office.name,
                    code: office.code || undefined,
                  }))
                )}
                {renderSelect(
                  'billingStatus',
                  '入力状況',
                  criteria.status,
                  (value) =>
                    setCriteria((prev) => ({ ...prev, status: value })),
                  BILLING_STATUS_OPTIONS
                )}
              </div>
            </div>
          </CollapsibleCard>
        </CopyableArea>

        {/* 一覧カード（fillParent でページの余り高さいっぱいまで広げ、折り畳み時は下限を外してヘッダーのみの高さへ戻す） */}
        <CollapsibleCard
          title="請求一覧"
          fillParent
          className="data-[state=open]:min-h-[23.75rem]"
          headerActions={
            /* 新規作成：明細0件の入力単位で請求詳細を開く（カード開閉はしない） */
            <button
              onClick={onCreate}
              className={`flex items-center gap-1 px-2 py-1 whitespace-nowrap text-sm ${BUTTON_STYLES.outline} ${BUTTON_BASE}`}
              aria-label="新規作成"
            >
              <Plus className="h-4 w-4" />
              新規作成
            </button>
          }
          contentClassName="p-2 flex flex-col flex-1 min-h-0"
        >
          <div className="flex-1 min-h-0 w-full">
            <AgGridReact<BillingRow>
              rowData={filteredRows}
              getRowId={getRowId}
              columnDefs={columnDefsWithTooltip}
              defaultColDef={GRID_DEFAULT_COL_DEF}
              // 見出しの計算式（請求金額合計 − 支払金額合計 等）をツールチップで見せるため、省略されていなくても出す
              tooltipShowMode="standard"
              getContextMenuItems={gridFilterContextMenuItems}
              domLayout="normal"
              animateRows={true}
              {...GRID_BASE_PROPS}
              onRowDoubleClicked={handleRowDoubleClicked}
              {...gridColumnStateProps}
              statusBar={GRID_STATUS_BAR}
            />
          </div>
        </CollapsibleCard>
      </div>

      {/* 削除の確認ダイアログ（AIC入力の入力単位のみ。決定25） */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="削除の確認"
        description="この入力単位と、含まれる明細をすべて削除します。元に戻せません。よろしいですか？"
        confirmLabel="削除"
        confirmClassName={BUTTON_STYLES.delete}
        onConfirm={() => setDeleteTarget(null)}
      />
    </div>
  );
}
