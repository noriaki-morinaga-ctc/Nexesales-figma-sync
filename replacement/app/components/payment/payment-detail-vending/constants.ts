// 支払詳細(自販機)：画面の定数（確認の文言・列の ID・管理項目のマスタ・選択肢・セルの色・列の定義など）
import { ColDef } from 'ag-grid-community';
import {
  GRID_EMPTY_TEXT,
  GRID_COLORS,
  suppressEditNavKeys,
  type CellColorLegendItem,
} from '@/app/components/grid';
import { COST_BEARING_DEPT_MASTER } from '@/app/constants/costBearingDeptMaster';
import { type SingleComboboxOption } from '@/app/components/ui/single-combobox';
import { SingleComboboxCellEditor } from '@/app/components/ui/single-combobox-cell-editor';
import { DateMonthYearCellEditor } from '@/app/components/ui/date-month-year-cell-editor';
import type {
  ConfirmAction,
  NavigationTarget,
} from './paymentDetailVending.types';
import {
  SALES_STORE_OPTIONS,
  TERTIARY_STORE_OPTIONS,
  PRIMARY_STORE_OPTIONS,
  SALES_REP_OPTIONS,
} from '@/mocks/payment/payment-detail-vending/paymentDetail';
import { IdCellRenderer } from './components/IdCellRenderer';
import {
  splitCategoryCode,
  splitCategoryName,
  nameWithoutCode,
  toComboOption,
  toPaneOption,
  toStoreComboOption,
} from './utilsRows';
import {
  SplitCollapseHeader,
  SplitCollapseCellRenderer,
} from './components/SplitCollapseCells';

// 支払確認ダイアログのメッセージ（不変のためモジュール定数として保持・レンダー毎の再生成を避ける）
export const CONFIRM_MESSAGE_MAP: Record<
  Exclude<ConfirmAction, null>,
  {
    title: string;
    description: string;
    toast: string;
    button: string;
    buttonClass: string;
  }
> = {
  apply: {
    title: '申請の確認',
    description: '支払データを申請します。よろしいですか？',
    toast: '申請が完了しました。',
    button: '申請',
    buttonClass: 'bg-green-500 hover:bg-green-600',
  },
  withdraw: {
    title: '引戻しの確認',
    description: '支払データを引戻しします。よろしいですか？',
    toast: '引戻しが完了しました。',
    button: '引戻し',
    buttonClass:
      'bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50',
  },
  approve: {
    title: '承認の確認',
    description: '支払データを承認します。よろしいですか？',
    toast: '承認が完了しました。',
    button: '承認',
    buttonClass: 'bg-green-500 hover:bg-green-600',
  },
  seal: {
    title: '検印の確認',
    description: '支払データに検印します。よろしいですか？',
    toast: '検印が完了しました。',
    button: '検印',
    buttonClass: 'bg-green-500 hover:bg-green-600',
  },
  reject: {
    title: '差戻しの確認',
    description: '支払データを差戻しします。よろしいですか？',
    toast: '差戻しが完了しました。',
    button: '差戻し',
    buttonClass: 'bg-red-500 hover:bg-red-600',
  },
};

export const NAVIGATION_CONFIRM_MAP: Record<
  NavigationTarget,
  { menuId: string; description: string }
> = {
  paymentList: {
    menuId: 'payment-list',
    description:
      '支払申請一覧参照画面へ戻ります。編集中の内容は保存されません。よろしいですか？',
  },
  planDetail: {
    menuId: 'plan-detail-vending',
    description:
      '計画詳細(自販機)画面へ遷移します。編集中の内容は保存されません。よろしいですか？',
  },
};

// 配下の経費項目の上に置く区切り（見出し）行。名称に「小計」は付けない。
// 背景は計画詳細(自販機)の経費計画グリッドの営業経費／自販機関係費と同じ
// GRID_COLORS.sectionRowBg（グレー）に揃える（→ 02 §7）。
export const EXPENSE_SECTION_ITEMS = [
  '営業経費',
  '自販機関係費',
  '長期前払費用',
];

// 集計行（合計・営業経費・自販機関係費）。1行全体を強調する
// （背景は合計＝薄い青、区切り行＝グレー。太字は合計行のみ → 02 §7）。
export const EXPENSE_AGGREGATE_ITEMS = ['合計', ...EXPENSE_SECTION_ITEMS];

// 分割先行のみが持つ項目の colId。経費明細グリッドでは本体列と同じ階層に並べ、
// ロケ契約料前払金グリッド（分割を行わない）では除外するために使う。
export const SPLIT_INFO_COL_IDS = [
  'splitDestManager',
  'splitDestStore',
  'splitPrimaryStore',
  'splitTertiaryStore',
  'splitDestGuide',
];

// 「他部門から分割/振替された経費明細」タブで第一階層「分割/振替元」にまとめる列の colId。
// 当タブは自部門が分割先のため、分割セット固有列を分割元（他部門）の情報として表示する。
// グループ内はこの配列の並び順で表示する（columnDefs 上の並びと異なるため事前に並べ替える）。
export const SPLIT_SOURCE_INFO_COL_IDS = [
  'splitSourceDate',
  'splitSourcePaymentNo',
  'splitSourcePaymentRound',
  'splitSourceOffice',
  'splitDestDept',
  'splitDestManager',
];

// 「他部門から分割/振替された経費明細」タブで支払明細グリッドと項目名が異なる列のヘッダー名。
// キーは colId（colId を持たない列は field）。
export const SPLIT_FROM_OTHER_HEADER_OVERRIDES: Record<string, string> = {
  // 手売りの「分割金額」「振替金額」に合わせる（当タブは分割・振替を1つの表で出すため → UI/UX UX-085）
  amount: '分割・振替金額',
  splitDestDept: '部署', // 分割/振替元の部署
};

// 当タブで非表示にする分割セット固有列（負担金額・販売店・三次店・一次店）。
// 負担金額は当タブでは支払金額列を「分割・振替金額」へ改称して表示するため重複を避ける。
// 分割案内は分割/振替元グループの対象外だが列としては残すため除外対象にしない。
export const SPLIT_SOURCE_INFO_HIDDEN_COL_IDS = [
  'splitAmount',
  ...SPLIT_INFO_COL_IDS.filter(
    (colId) =>
      !SPLIT_SOURCE_INFO_COL_IDS.includes(colId) && colId !== 'splitDestGuide'
  ),
];

// 償却情報グループ（前払金グリッド）の子列 colId。
export const AMORTIZATION_INFO_COL_IDS = [
  'amortAccrualDate',
  'amortStartDate',
  'amortEndDate',
  'crmCode',
];

// 償却仕訳情報グループ（前払金グリッド）の子列 colId。
export const AMORTIZATION_JOURNAL_COL_IDS = [
  'amortMgmtCategoryCode',
  'amortMgmtCategoryName',
  'amortMgmtCodeCode',
  'amortMgmtCodeName',
  'amortMeasureCategoryCode',
  'amortMeasureCategoryName',
  'amortMeasureCodeCode',
  'amortMeasureCodeName',
];

// ===== 選択肢マスタと "コード:名称" の変換ヘルパー =====

// 管理コードを1件しか持たない管理区分のコード（名称は管理区分名称と同じ）。
// 組み合わせが一意に決まるため、管理区分の入力時に管理コードを自動補完する。
export const SELF_MANAGEMENT_CODE = '99999';

// 部門を管理コードで持つ管理区分（オペ協力金・ロケ契約料・その他一時費用）で共用する選択肢。
export const DEPARTMENT_MANAGEMENT_CODES = [
  '10010:本社',
  '10020:支社Ａ　自販機部門',
  '10180:支社Ｂ自販機（共通）',
  '10210:支社Ｂ開発（開拓）',
];

// categories は経費明細グリッドで入力できる管理区分（"コード:名称"）。
// 管理コードが SELF_MANAGEMENT_CODE の1件だけの管理区分は文字列で、
// 複数の管理コードを持つ管理区分は { category, codes } で列挙する。
// aggregationOnlyCodes は経費明細グリッドでは入力できないが、支払情報サマリでは
// このグループへ集計する管理区分コード（他システム由来の明細を拾うための集計ルール）。
export const MANAGEMENT_ITEM_GROUPS: {
  summaryCategory: string; // 支払情報サマリの集計先管理区分コード
  account: string; // 勘定科目（"コード:名称"）
  categories: (string | { category: string; codes: string[] })[];
  aggregationOnlyCodes?: string[];
}[] = [
  {
    summaryCategory: '127',
    account: '1220:条件口（売上連動）',
    categories: ['127:オペ条件口(手出票)'],
    aggregationOnlyCodes: ['120', '121', '122'],
  },
  {
    summaryCategory: '33S',
    account: '2751:量販経費追加口（売上非連動）',
    categories: ['33S:ロケ運転費（売上非連動）'],
  },
  {
    summaryCategory: '69D',
    account: '5220:販売促進費（その他）',
    categories: [
      { category: '69D:オペ協力金', codes: DEPARTMENT_MANAGEMENT_CODES },
    ],
  },
  {
    summaryCategory: '69E',
    account: '5220:販売促進費（その他）',
    categories: [
      { category: '69E:ロケ契約料', codes: DEPARTMENT_MANAGEMENT_CODES },
    ],
  },
  {
    summaryCategory: '69F',
    account: '5220:販売促進費（その他）',
    categories: [
      { category: '69F:その他一時費用', codes: DEPARTMENT_MANAGEMENT_CODES },
    ],
  },
  {
    summaryCategory: 'V7P',
    account: '5590:販売器具自販機（コラム料）',
    categories: ['V7P:自販機コラム料'],
  },
  {
    summaryCategory: '880',
    account: '5520:販売器具自販機（リース料）',
    categories: [
      '880:自販機リース料',
      '881:リース料振替口（自販機）',
      '882:カードＲリース料',
      '883:自販機リース貸収入',
      'V7A:自動出票専用',
    ],
  },
  {
    summaryCategory: '89H',
    account: '5530:販売器具自販機（関係費）',
    categories: [
      '890:販売器具空缶・ビニール袋代',
      '891:販売器具工事代',
      '892:販売器具リフレッシュ費',
      '893:販売器具リース料等',
      '894:販売器具保守メンテ料',
      '895:販売器具費繰延処理',
      '896:販売器具転送費',
      '897:自販機廃棄費',
      '898:防盗対策費',
      '899:販売器具買取費',
      '89A:その他販売器具費',
      '89B:修繕費収入',
      '89C:リフレッシュ収入',
      '89D:廃棄費収入',
      '89E:リース自販機買取費',
      '89G:販売器具修繕費',
      '89H:販売器具移設費',
      {
        category: '89I:販売器具費振替',
        codes: ['88888:販売器具費振替－災害対応', '99999:販売器具費振替'],
      },
      '89J:自販機移設転送費',
      '89K:自販機整備転送費',
      '89L:自販機廃棄転送費',
      '89M:自販機付帯品送料',
      '89N:自販機部品送料',
      '89O:自販機付帯品取付取外',
      '89P:自販機付帯品整備',
      'V7F:自動出票専用',
    ],
  },
  {
    summaryCategory: '89H',
    account: '5580:販売器具自販機（減価償却費）',
    categories: ['8A1:リース自販機買取（減価償却費）', 'V7K:自動出票専用'],
  },
  {
    summaryCategory: '89H',
    account: '5610:販売器具自販機（保険料）',
    categories: ['V7U:販売器具自販機（保険料）'],
  },
  {
    summaryCategory: '89H',
    account: '5630:販売器リース資産減価償却費',
    categories: ['V7Z:自販機リース資産減価償却費'],
  },
];

// グループを管理区分単位へ展開したマスタ。以降の参照はすべてこの配列から導出する。
export const MANAGEMENT_ITEM_MASTER = MANAGEMENT_ITEM_GROUPS.flatMap((group) =>
  group.categories.map((entry) => {
    const category = typeof entry === 'string' ? entry : entry.category;
    return {
      category,
      codes:
        typeof entry === 'string'
          ? [`${SELF_MANAGEMENT_CODE}:${splitCategoryName(category)}`]
          : entry.codes,
      summaryCategory: group.summaryCategory,
      account: group.account,
    };
  })
);

// 管理区分コードでの参照用（管理コード・勘定科目・集計先はすべてここから引く）。
export const MANAGEMENT_ITEM_BY_CATEGORY_CODE = Object.fromEntries(
  MANAGEMENT_ITEM_MASTER.map((m) => [splitCategoryCode(m.category), m])
);

// 管理区分の選択肢（マスタの登録順）。
export const MANAGEMENT_CATEGORY_OPTIONS = MANAGEMENT_ITEM_MASTER.map(
  (m) => m.category
);

export const MANAGEMENT_CATEGORY_COMBO_OPTIONS =
  MANAGEMENT_CATEGORY_OPTIONS.map(toComboOption);

export const MANAGEMENT_CODE_COMBO_OPTIONS_BY_CATEGORY: Record<
  string,
  SingleComboboxOption[]
> = Object.fromEntries(
  MANAGEMENT_ITEM_MASTER.map((m) => [
    splitCategoryCode(m.category),
    m.codes.map(toComboOption),
  ])
);

// 管理区分コード → 支払情報サマリの集計先管理区分コード。
// 入力可能な管理区分に加え、入力はできないが集計対象となるコード（aggregationOnlyCodes）も含める。
export const SUMMARY_TARGET_BY_CATEGORY_CODE: Record<string, string> =
  Object.fromEntries([
    ...MANAGEMENT_ITEM_MASTER.map((m) => [
      splitCategoryCode(m.category),
      m.summaryCategory,
    ]),
    ...MANAGEMENT_ITEM_GROUPS.flatMap((group) =>
      (group.aggregationOnlyCodes ?? []).map((code) => [
        code,
        group.summaryCategory,
      ])
    ),
  ]);

// ロケ契約料前払金グリッドの償却仕訳情報グループ内「管理区分」の固定値（"コード:名称"）。
// 当グリッドは全行がロケ契約料他前払い金(償却)のため、604 固定・入力不可で表示する。
export const AMORTIZATION_FIXED_MANAGEMENT_CATEGORY =
  '604:ロケ契約料他前払い金(償却)';

// ===== セルエディタ =====

// "コード:名称" 項目の検索付きドロップダウンは共通の SingleComboboxCellEditor（→ 02 §12）。
// この画面は「コード:名称」が長いため幅を広げ、検索の案内を出す。クリアできるのは任意項目の列だけ（列ごとに clearable）
export const COMBO_CELL_EDITOR_PARAMS = {
  width: '22rem',
  placeholder: 'コード または 名称で検索...',
  clearable: false,
};

// 年月日の列は共通の DateMonthYearCellEditor（年→月→日で選ぶ）。空にもできる
export const DATE_CELL_EDITOR_PARAMS = { required: false, clearable: true };

// 税区分の選択肢。税率はこの税区分に応じて自動表示する（読み取り専用）。
// コードはマスタの値のため、選択肢から外したコード（3:その他(5%)）の分は
// 欠番のままにし、後続の「4:その他(非課税)」を繰り上げない。
export const TAX_CATEGORY_OPTIONS = [
  '1:課税10%',
  '2:課税8%',
  '4:その他(非課税)',
];

export const MEASURE_CATEGORY_OPTIONS = [
  '01:本社拡売費',
  '02:支社拡売費',
  '99:その他',
];

export const MEASURE_CODE_OPTIONS = [
  '001:新商品導入施策',
  '002:店頭販促施策',
  '003:価格訴求施策',
  '004:季節キャンペーン',
  '005:エリア限定施策',
];

export const PAYMENT_DESTINATION_OPTIONS = [
  '1001584:AAA営業本部商品部',
  '1001585:BBB営業本部商品部',
  '1001586:CCC営業本部商品部',
];

// 施策区分・施策コード・支払先の選択肢（グリッド用／右ペイン用）。
// ロケ契約料前払金グリッドの償却仕訳情報グループの管理コード（管理区分は 604 固定のため
// 経費明細グリッドの組み合わせマスタの対象外）は部門の選択肢を流用する。
export const AMORTIZATION_MANAGEMENT_CODE_COMBO_OPTIONS =
  DEPARTMENT_MANAGEMENT_CODES.map(toComboOption);

export const MEASURE_CATEGORY_COMBO_OPTIONS =
  MEASURE_CATEGORY_OPTIONS.map(toComboOption);

export const MEASURE_CODE_COMBO_OPTIONS =
  MEASURE_CODE_OPTIONS.map(toComboOption);

export const PAYMENT_DESTINATION_PANE_OPTIONS =
  PAYMENT_DESTINATION_OPTIONS.map(toPaneOption);

// ===== 管理項目別合計値の集計定義 =====

// 前払金の償却項目（管理区分コード XKA）の経費項目名。
// 合計値グリッドの最下行・ロケ契約料前払金グリッドの固定表示・計画対象外の判定で
// 同じ文字列を参照するため定数化する。
export const PREPAID_AMORTIZATION_ITEM = '長期前払費用自販機関係費';

// XKA に対応する勘定科目。合計値グリッドの集計対象の勘定科目と、
// ロケ契約料前払金グリッド（管理区分 XKA 固定）の勘定科目表示で共用する。
export const PREPAID_AMORTIZATION_ACCOUNT = 'K150:長期前払費用C/V関係費';

// 合計値グリッドに表示する経費項目（集計対象が無い項目は金額0で表示される）。
export const SUMMARY_EXPENSE_ITEMS = [
  'オペ条件口(手出票)',
  'ロケ運転費',
  'オペ協力金',
  'その他一時費用',
  'ロケ契約料',
  '自販機コラム料',
  '自販機リース料',
  '販売器具移設費',
  // XKA（前払金の償却項目）は最下行に配置する
  PREPAID_AMORTIZATION_ITEM,
];

// 「管理区分」列に表示する管理区分コード（経費明細の集計先管理区分＝
// MANAGEMENT_ITEM_MASTER の summaryCategory に対応）。
// 880（自販機リース料）・89H（販売器具移設費）の行は、それぞれ同じグループの
// 他の管理区分（881〜883・890〜89P 等）もまとめて集計する。
export const SUMMARY_MANAGEMENT_CODE: Record<string, string> = {
  'オペ条件口(手出票)': '127',
  ロケ運転費: '33S',
  オペ協力金: '69D',
  その他一時費用: '69F',
  ロケ契約料: '69E',
  [PREPAID_AMORTIZATION_ITEM]: 'XKA',
  自販機コラム料: 'V7P',
  自販機リース料: '880',
  販売器具移設費: '89H',
};

// 「集計対象の勘定科目」列に表示する科目（サマリの管理区分コード別）。
// サマリの各行に集計される管理区分の勘定科目を、管理区分マスタから集約する
// （集計先が同じ管理区分でも勘定科目は異なりうるため配列で保持し、表示時に "、" で連結する）。
// XKA（前払金の償却項目）は経費明細の管理区分マスタの対象外のため個別に持つ。
export const SUMMARY_AGGREGATION_ACCOUNTS: Record<string, string[]> =
  MANAGEMENT_ITEM_MASTER.reduce(
    (accounts, item) => {
      const list = (accounts[item.summaryCategory] ??= []);
      if (!list.includes(item.account)) list.push(item.account);
      return accounts;
    },
    { XKA: [PREPAID_AMORTIZATION_ACCOUNT] } as Record<string, string[]>
  );

// 支払情報サマリカードの本体高さ（px）。リサイズハンドルのドラッグで手動調整する。
// 既定値は管理項目別合計値グリッドが縦スクロールせずに収まる高さ、下限は縮めすぎ防止。
// 高さの拡縮は共通フック useResizableHeight（ui/resizable-panel）に統一しているため、
// 単位も同フックに合わせて px とする（計画詳細(NET固定)＝ PlanAggregationPane と同じ）。
export const SUMMARY_CARD_DEFAULT_HEIGHT = 512;

export const SUMMARY_CARD_MIN_HEIGHT = 200;

// 支払明細情報（画面のいちばん下の表）の高さで画面の縦幅から引く分（rem。アプリのヘッダー・
// 画面下部のボタンの列・カードの下の余白）。最下部までスクロールした状態で、表が画面に
// ちょうど収まる値（viewportGridHeight に渡す。UX-099。実測で決めた値）。
export const DETAIL_GRID_OFFSET_REM = 9;

export const SALES_STORE_COMBO_OPTIONS =
  SALES_STORE_OPTIONS.map(toStoreComboOption);

export const PRIMARY_STORE_COMBO_OPTIONS =
  PRIMARY_STORE_OPTIONS.map(toStoreComboOption);

export const TERTIARY_STORE_COMBO_OPTIONS =
  TERTIARY_STORE_OPTIONS.map(toStoreComboOption);

export const COST_BEARING_DEPT_COMBO_OPTIONS =
  COST_BEARING_DEPT_MASTER.map(toStoreComboOption);

export const SALES_REP_COMBO_OPTIONS =
  SALES_REP_OPTIONS.map(toStoreComboOption);

// 支払回数プルダウンの初期の選択肢（既存の回）。
export const PAYMENT_ROUND_OPTIONS = ['1'];

// セル背景は共通配色 GRID_COLORS に集約する（hex 直書きしない・→ 02 §10.1）。
export const EDITABLE_CELL_BG = GRID_COLORS.editable; // 編集可：白

export const NON_EDITABLE_CELL_BG = GRID_COLORS.readonly; // 編集不可：灰

export const INHERITED_TEXT_COLOR = GRID_COLORS.inheritedText; // 親の値の参照表示：薄いグレー

// 「他部門から分割/振替された経費明細」タブ専用の列
// （支払明細グリッドには無い分割/振替日・支払No・支払回数・事業場）。
// 当タブは参照専用のため読み取り専用・灰背景にする。表示順は SPLIT_SOURCE_INFO_COL_IDS で決まる。
export const SPLIT_SOURCE_INFO_EXTRA_COLUMN_DEFS: ColDef[] = [
  {
    headerName: '分割/振替日',
    colId: 'splitSourceDate',
    field: 'splitSourceDate',
    editable: false,
    cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
  },
  {
    headerName: '支払No',
    colId: 'splitSourcePaymentNo',
    field: 'splitSourcePaymentNo',
    editable: false,
    cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
  },
  {
    headerName: '支払回数',
    colId: 'splitSourcePaymentRound',
    field: 'splitSourcePaymentRound',
    editable: false,
    cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
  },
  {
    headerName: '事業場',
    colId: 'splitSourceOffice',
    field: 'splitSourceOffice',
    editable: false,
    valueFormatter: (params) =>
      nameWithoutCode(params.value) || GRID_EMPTY_TEXT,
    cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
  },
];

// 一番左にデータのID（No.）を表示する列（行番号の代わり）。読み取り専用。
export const ID_COLUMN_DEF: ColDef = {
  headerName: 'No.',
  field: 'id',
  lockPinned: true,
  editable: false,
  sortable: false,
  filter: false,
  resizable: false,
  width: 56,
  minWidth: 56,
  suppressAutoSize: true,
  cellRenderer: IdCellRenderer,
  cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
};

// 分割の開閉の列（No. の左。経費明細グリッドだけ）。手売りの支払詳細の拡売費の表と同じ形（→ UI/UX UX-088）。
export const SPLIT_COLLAPSE_COLUMN_DEF: ColDef = {
  headerName: '',
  // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
  suppressColumnsToolPanel: true,
  headerComponent: SplitCollapseHeader,
  colId: 'splitCollapse',
  sortable: false,
  filter: false,
  resizable: false,
  editable: false,
  suppressMovable: true,
  width: 32,
  minWidth: 32,
  maxWidth: 32,
  suppressAutoSize: true,
  cellRenderer: SplitCollapseCellRenderer,
  cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
};

// 償却情報グループ（前払金グリッド）の子列定義。編集セルは白・名称/コード列は検索付きセレクト。
export const AMORTIZATION_INFO_COLUMN_DEFS: ColDef[] = [
  {
    headerName: '発生日（計上開始初月）',
    colId: 'amortAccrualDate',
    field: 'amortAccrualDate',
    editable: true,
    cellEditor: DateMonthYearCellEditor,
    cellEditorParams: DATE_CELL_EDITOR_PARAMS,
    cellEditorPopup: true,
    cellStyle: { backgroundColor: EDITABLE_CELL_BG },
  },
  {
    headerName: '償却期間開始',
    colId: 'amortStartDate',
    field: 'amortStartDate',
    editable: true,
    cellEditor: DateMonthYearCellEditor,
    cellEditorParams: DATE_CELL_EDITOR_PARAMS,
    cellEditorPopup: true,
    cellStyle: { backgroundColor: EDITABLE_CELL_BG },
  },
  {
    headerName: '償却期間終了',
    colId: 'amortEndDate',
    field: 'amortEndDate',
    editable: true,
    cellEditor: DateMonthYearCellEditor,
    cellEditorParams: DATE_CELL_EDITOR_PARAMS,
    cellEditorPopup: true,
    cellStyle: { backgroundColor: EDITABLE_CELL_BG },
  },
  {
    headerName: 'CRMコード',
    colId: 'crmCode',
    field: 'crmCode',
    editable: true,
    cellEditor: 'agTextCellEditor',
    cellStyle: { backgroundColor: EDITABLE_CELL_BG },
  },
];

// 償却仕訳情報グループ（前払金グリッド）の子列定義。
// コード列・名称列は同じ field を共有し、どちらからでも同じ選択肢で入力できる（相互に連動）。
// 管理区分・管理区分名称のみ 604（ロケ契約料他前払い金(償却)）固定・入力不可。
export const AMORTIZATION_JOURNAL_COLUMN_DEFS: ColDef[] = [
  {
    headerName: '管理区分',
    colId: 'amortMgmtCategoryCode',
    valueGetter: () =>
      splitCategoryCode(AMORTIZATION_FIXED_MANAGEMENT_CATEGORY),
    editable: false,
    cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
  },
  {
    headerName: '管理区分名称',
    colId: 'amortMgmtCategoryName',
    valueGetter: () =>
      splitCategoryName(AMORTIZATION_FIXED_MANAGEMENT_CATEGORY),
    editable: false,
    cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
  },
  {
    headerName: '管理コード',
    colId: 'amortMgmtCodeCode',
    field: 'amortMgmtCode',
    valueFormatter: (p) => splitCategoryCode(p.value) || GRID_EMPTY_TEXT,
    editable: true,
    cellEditor: SingleComboboxCellEditor,
    cellEditorParams: {
      ...COMBO_CELL_EDITOR_PARAMS,
      comboOptions: AMORTIZATION_MANAGEMENT_CODE_COMBO_OPTIONS,
    },
    cellEditorPopup: true,
    suppressKeyboardEvent: suppressEditNavKeys,
    cellStyle: { backgroundColor: EDITABLE_CELL_BG },
  },
  {
    headerName: '管理コード名称',
    colId: 'amortMgmtCodeName',
    field: 'amortMgmtCode',
    valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
    editable: true,
    cellEditor: SingleComboboxCellEditor,
    cellEditorParams: {
      ...COMBO_CELL_EDITOR_PARAMS,
      comboOptions: AMORTIZATION_MANAGEMENT_CODE_COMBO_OPTIONS,
    },
    cellEditorPopup: true,
    suppressKeyboardEvent: suppressEditNavKeys,
    cellStyle: { backgroundColor: EDITABLE_CELL_BG },
  },
  {
    headerName: '施策区分',
    colId: 'amortMeasureCategoryCode',
    field: 'amortMeasureCategory',
    valueFormatter: (p) => splitCategoryCode(p.value) || GRID_EMPTY_TEXT,
    editable: true,
    cellEditor: SingleComboboxCellEditor,
    cellEditorParams: {
      ...COMBO_CELL_EDITOR_PARAMS,
      comboOptions: MEASURE_CATEGORY_COMBO_OPTIONS,
      clearable: true,
    },
    cellEditorPopup: true,
    suppressKeyboardEvent: suppressEditNavKeys,
    cellStyle: { backgroundColor: EDITABLE_CELL_BG },
  },
  {
    headerName: '施策区分名称',
    colId: 'amortMeasureCategoryName',
    field: 'amortMeasureCategory',
    valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
    editable: true,
    cellEditor: SingleComboboxCellEditor,
    cellEditorParams: {
      ...COMBO_CELL_EDITOR_PARAMS,
      comboOptions: MEASURE_CATEGORY_COMBO_OPTIONS,
      clearable: true,
    },
    cellEditorPopup: true,
    suppressKeyboardEvent: suppressEditNavKeys,
    cellStyle: { backgroundColor: EDITABLE_CELL_BG },
  },
  {
    headerName: '施策コード',
    colId: 'amortMeasureCodeCode',
    field: 'amortMeasureCode',
    valueFormatter: (p) => splitCategoryCode(p.value) || GRID_EMPTY_TEXT,
    editable: true,
    cellEditor: SingleComboboxCellEditor,
    cellEditorParams: {
      ...COMBO_CELL_EDITOR_PARAMS,
      comboOptions: MEASURE_CODE_COMBO_OPTIONS,
      clearable: true,
    },
    cellEditorPopup: true,
    suppressKeyboardEvent: suppressEditNavKeys,
    cellStyle: { backgroundColor: EDITABLE_CELL_BG },
  },
  {
    headerName: '施策コード名称',
    colId: 'amortMeasureCodeName',
    field: 'amortMeasureCode',
    valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
    editable: true,
    cellEditor: SingleComboboxCellEditor,
    cellEditorParams: {
      ...COMBO_CELL_EDITOR_PARAMS,
      comboOptions: MEASURE_CODE_COMBO_OPTIONS,
      clearable: true,
    },
    cellEditorPopup: true,
    suppressKeyboardEvent: suppressEditNavKeys,
    cellStyle: { backgroundColor: EDITABLE_CELL_BG },
  },
];

// 経費明細・ロケ契約料前払金の表の色の凡例（手売りの支払詳細と同じ部品 CellColorLegend で表の上に出す → UI/UX UX-084）
export const DETAIL_COLOR_LEGEND: CellColorLegendItem[] = [
  { color: GRID_COLORS.changedBg, label: '編集したセル' },
  { color: GRID_COLORS.readonly, label: '入力できないセル' },
];
