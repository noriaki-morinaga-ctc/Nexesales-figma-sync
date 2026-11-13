// Todo：朴：C追加口・拡売費支払モック修正中
import { useEffect, useMemo, useRef, useState } from 'react';
import { History } from 'lucide-react';
import { CollapsibleCard } from '@/app/components/ui/collapsible-card';
import {
  FIT_CELL_CLASS,
  FIT_GRID_CLASS,
  FIT_LABEL_CLASS,
  FIT_ROW_CLASS,
  FIT_WIDE_CELL_CLASS,
  FIT_WIDE_VALUE_CLASS,
} from '@/styles/commonStyles';
import { valueOrEmpty } from '@/app/components/ui/empty-value';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog';
import { Label } from '@/app/components/ui/label';
import { MonthYearPicker } from '@/app/components/ui/month-year-picker';
import { SingleCombobox } from '@/app/components/ui/single-combobox';
import { toYearMonth } from '@/app/utils/common/yearMonth';
import {
  STORE_NONE,
  PRIMARY_STORE_OPTIONS,
  PRIMARY_BY_TERTIARY,
  TERTIARY_BY_STORE,
  tertiaryOptionsFor,
  storeOptionsFor,
} from '@/app/constants/storeHierarchy';
import { ownerOrgOf } from '@/app/utils/payment/payment-detail/paymentOrgCascade';
import type { SingleComboboxOption } from '@/app/components/ui/single-combobox';

// 基本情報の項目値（モック）。費用分割の分割元情報など、他画面から参照するため export する。
export const BASIC_INFO = {
  targetMonth: '2025年10月', // 対象年月
  postingMonth: '2025年10月', // 計上年月
  // 振替伝票番号。振替詳細画面1枚に対して1つ振られる（20260721_第21回_共通 決定事項6）。
  // 支払一覧の「支払No/振替No」列と同形式（payment-list の toTransferNo が生成する F26 系）。
  transferNo: 'F26100007', // 振替No
  primaryStore: '三菱食品株式会社（イオン）:10888030', // 一次店
  tertiaryStore: 'イオン東北ＲＤＣ:10863223', // 三次店
  store: 'イオンリテール:21100677', // 販売店
  // 事業場・部署・末端組織・営業担当者は、画面では商流販売店の担当組織
  //（paymentOrgCascade の ownerOrgOf）から求めるようになったため表示には使わない。
  // 上記 store（イオンリテール）の担当組織と同じ値で、検印済み明細のモック行が参照する。
  office: '首都圏本部:10000623', // 事業場
  dept: '首都圏営業第二部:10002990', // 部署
  // 申請側（下段）＝実際に伝票を入力した組織・人。本振替は代行入力ではないため
  // 担当側（上段）と同値とする（20260728_第24回 決定事項7・18）。
  applicantOffice: '首都圏本部:10000623', // 申請事業場
  applicantDept: '首都圏営業第二部:10002990', // 申請部署
  applicant: 'アサヒ　太郎:5172733', // 申請者
  // 申請末端組織は計画無し支払でのみ入力される項目のため空とする（表示はグレーの「-」）
  //（支払詳細(追加口請求書有) の支払情報エリアと同じ扱い）。
  // 振替伝票での要否は課題 No.0956 とあわせて確認する。
  applicantTerminalOrg: '', // 申請末端組織（未入力。表示はグレーの「-」）
  // 末端組織（課題 No.0898・No.0956）。販売計画作成者側の組織のため上段に置く。
  // 代行入力ではないため部署と同値。
  terminalOrg: '首都圏営業第二部:10002990', // 末端組織
  staff: 'アサヒ　太郎:5172733', // 営業担当者
  // ステータス（支払一覧のステータス6種に合わせる）
  status: '承認待ち',
} as const;

// 振替元・振替先のどちらを固定して操作するかを選ぶラジオの表示名。
// 名称は継続検討中（宿題7）のため、差し替えが1箇所で済むようここに集約する。
export const EXECUTOR_LABELS = {
  source: '振替元を固定する', // 振替元を基本情報で確定し、振替先を入力する
  destination: '振替先を固定する', // 振替先を基本情報で確定し、振替元を検索で選ぶ
} as const;

// 商流3項目（販売店・一次店・三次店）のラベル接頭辞。
// 同じ入力欄が固定する側によって振替元にも振替先にもなるため、
// どちらを指定しているのかをラベルで示す（20260728_第24回 宿題事項7／課題管理表 No.1080）。
export const STORE_LABEL_PREFIX = {
  source: '振替元', // 振替元を固定する：商流は振替元の指定（検印済み明細の絞り込みに使う）
  destination: '振替先', // 振替先を固定する：商流は振替先の指定（枝番行の値になる）
} as const;

// 「YYYY年M月」表記を MonthYearPicker が扱う「YYYY/MM」へ変換するのは共通ヘルパー
// （utils/common/yearMonth の toYearMonth）に委譲する。BASIC_INFO は他画面（費用分割の振替元情報など）が
// 参照するため表記を変えず、ピッカーの初期値としてのみ変換する。

// 基本情報の現在値。「振替先を固定する」のときの振替先明細の既定値など、
// 画面側（TransferDetail）が参照するため onChange で通知する。
export interface TransferDetailBasicInfoValues {
  executor: 'source' | 'destination'; // 固定する側（'source'＝振替元を固定する／'destination'＝振替先を固定する）
  targetMonth: string; // 対象年月（YYYY/MM）
  postingMonth: string; // 計上年月（YYYY/MM）
  primaryStore: string; // 一次店（未選択は空文字）
  tertiaryStore: string; // 三次店（未選択は空文字）
  store: string; // 販売店（未選択は STORE_NONE）
  // 以下4項目は固定する側の商流販売店（store）の担当組織。
  // 販売店が未選択のうちは担当組織が定まらないため空文字（＝絞り込まない）。
  office: string; // 事業場
  dept: string; // 担当部署
  terminalOrg: string; // 担当末端組織
  staff: string; // 営業担当者
}

interface TransferDetailSearchProps {
  // 基本情報の値が変わるたびに現在値を通知する。
  onChange?: (values: TransferDetailBasicInfoValues) => void;
  // ステータス横のコメント履歴ボタン押下時のハンドラ
  onStatusClick?: () => void;
  // 振替明細に枝番行（振替先行）が1本でもあるか。
  // 固定する側を切り替えると枝番行の商流・組織が基本情報の値で上書きされるため、
  // 枝番行がある場合のみ確認ダイアログを挟む。
  hasBranchRows?: boolean;
  // 担当末端組織の選択肢（販売店を選ばない④のときに選ぶ）。
  // 検印済み明細の値と突き合わせるため、明細を持つ画面側（TransferDetail）から渡す。
  terminalOrgOptions?: SingleComboboxOption[];
}

export function TransferDetailSearch({
  onChange,
  onStatusClick,
  hasBranchRows = false,
  terminalOrgOptions = [],
}: TransferDetailSearchProps = {}) {
  // 基本情報の折り畳み状態（既定は展開）
  const [isBasicInfoOpen, setIsBasicInfoOpen] = useState(true);

  // 対象年月・計上年月（YYYY/MM 文字列。MonthYearPicker で選択）
  const [targetMonth, setTargetMonth] = useState(
    toYearMonth(BASIC_INFO.targetMonth)
  );
  const [postingMonth, setPostingMonth] = useState(
    toYearMonth(BASIC_INFO.postingMonth)
  );

  // 販売店・一次店・三次店（単一選択コンボボックス）。
  // 初期値は 一次店・三次店＝未選択（空）、販売店＝「-」。
  const [primaryStore, setPrimaryStore] = useState<string>('');
  const [tertiaryStore, setTertiaryStore] = useState<string>('');
  const [store, setStore] = useState<string>(STORE_NONE);

  // 選択状態に応じた選択肢（一次店は常に全件）。
  const tertiaryOptions = useMemo(
    () => tertiaryOptionsFor(primaryStore),
    [primaryStore]
  );
  const storeOptions = useMemo(
    () => storeOptionsFor(primaryStore, tertiaryStore),
    [primaryStore, tertiaryStore]
  );

  // 一次店を選択：配下でなくなった三次店・販売店はクリアする
  //（＝三次店と販売店の選択範囲が当該一次店の配下に絞られる）。
  // クリア（空選択）時は下位（三次店・販売店）もまとめて未選択へ戻す。
  const handlePrimaryChange = (v: string) => {
    setPrimaryStore(v);
    if (!v) {
      setTertiaryStore('');
      setStore(STORE_NONE);
      return;
    }
    const tertiaryStillValid = tertiaryStore
      ? PRIMARY_BY_TERTIARY[tertiaryStore] === v
      : true;
    if (!tertiaryStillValid) setTertiaryStore('');
    const storeStillValid =
      store !== STORE_NONE
        ? PRIMARY_BY_TERTIARY[TERTIARY_BY_STORE[store] ?? ''] === v &&
          (tertiaryStillValid || !tertiaryStore)
        : true;
    if (!storeStillValid) setStore(STORE_NONE);
  };

  // 三次店を選択：所属する一次店を自動選択し、配下でなくなった販売店はクリアする
  //（＝販売店の選択範囲が当該三次店の配下に絞られる）。
  // クリア（空選択）時は販売店のみ未選択へ戻す（一次店の選択は維持する）。
  const handleTertiaryChange = (v: string) => {
    setTertiaryStore(v);
    if (v) setPrimaryStore(PRIMARY_BY_TERTIARY[v] ?? '');
    if (store !== STORE_NONE && (!v || TERTIARY_BY_STORE[store] !== v)) {
      setStore(STORE_NONE);
    }
  };

  // 販売店を選択：所属する三次店・一次店を自動選択する。
  // クリア（空選択）・「-」選択時は未選択（「-」）に戻すのみで、上位の選択は維持する。
  const handleStoreChange = (v: string) => {
    if (!v || v === STORE_NONE) {
      setStore(STORE_NONE);
      return;
    }
    setStore(v);
    const tertiary = TERTIARY_BY_STORE[v] ?? '';
    setTertiaryStore(tertiary);
    setPrimaryStore(PRIMARY_BY_TERTIARY[tertiary] ?? '');
    // 担当末端組織は販売店の担当組織を初期値として入れる（選び直しは可能）。
    // 担当組織が定まらない販売店（ダミー等）では、選択済みの値をそのまま残す。
    const ownerTerminalOrg = ownerOrgOf(v).terminalOrg;
    if (ownerTerminalOrg) setTerminalOrg(ownerTerminalOrg);
  };

  // 固定する側の商流販売店の担当組織（事業場・担当部署・担当末端組織・営業担当者）。
  // 商流販売店が変わると組織欄の表示値も追従する（課題管理表 No.1080）。
  // 販売店が未選択のうちは全項目が空（表示はグレーの「-」）。
  const ownerOrg = useMemo(() => ownerOrgOf(store), [store]);

  // 担当末端組織。販売店・三次店・一次店にダミーを選んだうえで末端組織を指定する
  // 場合や、販売店を選ばない場合（④末端組織のみに紐づく支払）があるため、常に活性とする。
  // 販売店を選ぶと、その担当組織の値を初期値として入れる（handleStoreChange）。
  const [terminalOrg, setTerminalOrg] = useState('');

  // 振替元・振替先のどちらを基本情報で固定するか（＝もう一方を検索・入力で選ぶ）。
  // 'source'＝振替元を固定する（初期値）／'destination'＝振替先を固定する。
  const [executor, setExecutor] = useState<'source' | 'destination'>('source');

  // 固定する側の切り替え確認（枝番行がある場合のみ表示する）。
  // 了承後に executor を変えると、振替明細側が枝番行の商流・組織を基本情報の値へ上書きする。
  const [pendingExecutor, setPendingExecutor] = useState<
    'source' | 'destination' | null
  >(null);

  const handleExecutorChange = (next: 'source' | 'destination') => {
    if (next === executor) return;
    // 枝番行が無ければ上書きされる値も無いため、確認せずに切り替える。
    if (!hasBranchRows) {
      setExecutor(next);
      return;
    }
    setPendingExecutor(next);
  };

  // 基本情報の現在値を親へ通知する。onChange は ref 経由で参照し、
  // 親が毎レンダーで新しい関数を渡しても再通知ループにならないようにする。
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    onChangeRef.current?.({
      executor,
      targetMonth,
      postingMonth,
      primaryStore,
      tertiaryStore,
      store,
      // 事業場・担当部署・担当末端組織・営業担当者は商流販売店の担当組織（ラベル表示）。
      // 未選択のうちは空文字を渡し、検印済み明細の検索条件では絞り込まない。
      office: ownerOrg.office,
      dept: ownerOrg.dept,
      // 担当末端組織は利用者の選択値（販売店選択時は担当組織が初期値）を渡す。
      terminalOrg,
      staff: ownerOrg.staff,
    });
  }, [
    executor,
    targetMonth,
    postingMonth,
    primaryStore,
    tertiaryStore,
    store,
    ownerOrg,
    terminalOrg,
  ]);

  // ヘッダー項目（テキストラベル）の共通描画
  const renderLabelField = (label: string, value: string) => (
    <div className={FIT_CELL_CLASS}>
      <label className={FIT_LABEL_CLASS}>{label}</label>
      <span className="h-8 min-w-0 flex items-center text-sm text-gray-900">
        {valueOrEmpty(value)}
      </span>
    </div>
  );

  // 単一選択コンボボックス項目（販売店・一次店・三次店）の共通描画
  const renderComboField = (
    label: string,
    id: string,
    options: { value: string; label: string }[],
    value: string,
    onChange: (v: string) => void,
    placeholder: string
  ) => (
    <div className={FIT_CELL_CLASS}>
      <label htmlFor={id} className={FIT_LABEL_CLASS}>
        {label}
      </label>
      <div className="min-w-0">
        <SingleCombobox
          id={id}
          options={options}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          clearable
        />
      </div>
    </div>
  );

  return (
    <>
      {/* 基本情報エリア（支払詳細(その他)と同じ折り畳みカード） */}
      <CollapsibleCard
        title="基本情報"
        open={isBasicInfoOpen}
        onOpenChange={setIsBasicInfoOpen}
      >
        {/* 5列。「振替元担当末端組織」などが 5.625rem に収まらないため、項目名の列をその列で一番長い
            項目名の幅に合わせる並び FIT_GRID_CLASS（各行は subgrid で列を受け継ぐ → 05「ラベルが幅に収まらない画面」） */}
        <div className={`p-4 ${FIT_GRID_CLASS}`}>
          {/* 1行目: 振替元・振替先のどちらを固定するかの指定（基本情報の最上段・左端）。
              対象年月より上に置き、以降の入力がどちらの立場のものかを先に決める。 */}
          <div
            className={`${FIT_ROW_CLASS} mb-2 pb-3 border-b border-gray-300`}
          >
            <div className={FIT_WIDE_CELL_CLASS}>
              <label className={FIT_LABEL_CLASS}>固定する側</label>
              <RadioGroup
                value={executor}
                onValueChange={(v) =>
                  handleExecutorChange(v as 'source' | 'destination')
                }
                className={`flex h-8 items-center gap-4 ${FIT_WIDE_VALUE_CLASS}`}
                aria-label="振替元・振替先のどちらを固定するか"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="source" id="executor-source" />
                  <Label
                    htmlFor="executor-source"
                    className="text-sm whitespace-nowrap text-gray-900"
                  >
                    {EXECUTOR_LABELS.source}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem
                    value="destination"
                    id="executor-destination"
                  />
                  <Label
                    htmlFor="executor-destination"
                    className="text-sm whitespace-nowrap text-gray-900"
                  >
                    {EXECUTOR_LABELS.destination}
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          {/* 2行目: 対象年月 / 計上年月 */}
          <div
            className={`${FIT_ROW_CLASS} mb-2 pb-3 border-b border-gray-300`}
          >
            {/* 対象年月（カレンダー選択） */}
            <div className={FIT_CELL_CLASS}>
              <label
                htmlFor="allocate-target-month"
                className={FIT_LABEL_CLASS}
              >
                対象年月
              </label>
              <div className="w-[9.375rem]">
                <MonthYearPicker
                  id="allocate-target-month"
                  value={targetMonth}
                  onChange={setTargetMonth}
                  className="w-full"
                  clearable
                />
              </div>
            </div>

            {/* 計上年月（カレンダー選択） */}
            <div className={FIT_CELL_CLASS}>
              <label
                htmlFor="allocate-posting-month"
                className={FIT_LABEL_CLASS}
              >
                計上年月
              </label>
              <div className="w-[9.375rem]">
                <MonthYearPicker
                  id="allocate-posting-month"
                  value={postingMonth}
                  onChange={setPostingMonth}
                  className="w-full"
                  clearable
                />
              </div>
            </div>

            {/* 振替No（振替詳細画面1枚に1つ。参照専用） */}
            {renderLabelField('振替No', BASIC_INFO.transferNo)}
          </div>

          {/* 3行目: 販売店 / 三次店 / 一次店（単一選択・コード/名称で検索）。
              並びはグリッド・支払詳細(追加口請求書有)と揃える。 */}
          <div
            className={`${FIT_ROW_CLASS} mb-2 pb-3 border-b border-gray-300`}
          >
            {renderComboField(
              `${STORE_LABEL_PREFIX[executor]}販売店`,
              'allocate-store',
              storeOptions,
              store,
              handleStoreChange,
              '販売店を選択／検索'
            )}
            {renderComboField(
              `${STORE_LABEL_PREFIX[executor]}三次店`,
              'allocate-tertiary-store',
              tertiaryOptions,
              tertiaryStore,
              handleTertiaryChange,
              '三次店を選択／検索'
            )}
            {renderComboField(
              `${STORE_LABEL_PREFIX[executor]}一次店`,
              'allocate-primary-store',
              PRIMARY_STORE_OPTIONS,
              primaryStore,
              handlePrimaryChange,
              '一次店を選択／検索'
            )}
          </div>

          {/* 組織欄は上下2段で表す（20260728_第24回 決定事項7・18／課題 No.0956）。
              上段＝販売計画作成者の情報／下段＝支払申請者の情報。
              代行入力でなければ両者は同じ組織になる。 */}
          {/* 上段（販売計画作成者）: 事業場 / 担当部署 / 担当末端組織 / 営業担当者。
              下段（支払申請者）とは別の情報のため、間に区切り線を入れる
              （支払詳細(商流販売店紐づけなし) と同じ体裁）。
              組織3項目は商流3項目と同じく、固定する側でラベルを切り替える
              （STORE_LABEL_PREFIX を共用。課題管理表 No.1080）。
              営業担当者は振替元・振替先で呼び分ける項目ではないためラベルは据え置き、
              値のみ担当組織に追従させる。 */}
          <div
            className={`${FIT_ROW_CLASS} mb-2 pb-3 border-b border-gray-300`}
          >
            {renderLabelField(
              `${STORE_LABEL_PREFIX[executor]}事業場`,
              ownerOrg.office
            )}
            {renderLabelField(
              `${STORE_LABEL_PREFIX[executor]}担当部署`,
              ownerOrg.dept
            )}
            {/* 担当末端組織：常に活性。販売店の選択時は担当組織の値を初期表示する。 */}
            {renderComboField(
              `${STORE_LABEL_PREFIX[executor]}担当末端組織`,
              'allocate-terminal-org',
              terminalOrgOptions,
              terminalOrg,
              setTerminalOrg,
              '末端組織を選択／検索'
            )}
            {renderLabelField('営業担当者', ownerOrg.staff)}
          </div>

          {/* 下段（支払申請者）: 申請事業場 / 申請部署 / 申請末端組織 / 申請者。
              並びは支払詳細(追加口請求書有) の支払情報エリアに合わせる。 */}
          <div
            className={`${FIT_ROW_CLASS} mb-2 pb-3 border-b border-gray-300`}
          >
            {renderLabelField('申請事業場', BASIC_INFO.applicantOffice)}
            {renderLabelField('申請部署', BASIC_INFO.applicantDept)}
            {renderLabelField('申請末端組織', BASIC_INFO.applicantTerminalOrg)}
            {renderLabelField('申請者', BASIC_INFO.applicant)}
          </div>

          {/* ステータス（基本情報の最終行・下ボーダーなし）。
              横にコメント履歴ボタンを配置（支払詳細(追加口請求書有)の支払情報と同形式）。 */}
          <div className={`${FIT_ROW_CLASS} mb-2`}>
            <div className={FIT_WIDE_CELL_CLASS}>
              <label className={FIT_LABEL_CLASS}>ステータス</label>
              <div
                className={`flex items-center gap-2 ${FIT_WIDE_VALUE_CLASS}`}
              >
                <span className="h-8 flex items-center text-sm text-gray-900">
                  {BASIC_INFO.status}
                </span>
                <button
                  type="button"
                  onClick={onStatusClick}
                  className="btn-toolbar-outline"
                  aria-label="コメント履歴"
                >
                  <History className="h-4 w-4" />
                  コメント履歴
                </button>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleCard>

      {/* 固定する側の切り替え確認（枝番行がある場合のみ）。
          共通部品 ConfirmDialog を使い、他画面の確認ダイアログと体裁を揃える。 */}
      <ConfirmDialog
        open={pendingExecutor !== null}
        onOpenChange={(open) => {
          if (!open) setPendingExecutor(null);
        }}
        title="固定する側の変更の確認"
        description={
          pendingExecutor === 'destination'
            ? '振替先の指定が基本情報の値で上書きされます。振替先が複数ある明細は1件にまとめられます（金額は合算）。元に戻すことはできません。よろしいですか？'
            : '振替先の指定が振替元の値で上書きされます。元に戻すことはできません。よろしいですか？'
        }
        confirmLabel="変更する"
        onConfirm={() => {
          if (pendingExecutor) setExecutor(pendingExecutor);
          setPendingExecutor(null);
        }}
        onCancel={() => setPendingExecutor(null)}
      />
    </>
  );
}
