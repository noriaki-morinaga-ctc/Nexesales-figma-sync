// 支払詳細(自販機)：基本情報の値・支払明細の初期データ・支払根拠資料の初期ファイル・引用元のデータなど（モック。バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// 画面は src/app/components/payment/payment-detail-vending/page.tsx。
import { format } from 'date-fns';
import {
  type EvidenceFile,
  type EvidenceUserRole,
} from '@/app/components/payment/payment-detail-vending/components/EvidenceViewerPane';
import {
  INVOICE_LANDSCAPE_PAGES,
  INVOICE_PORTRAIT,
  QUOTATION_LOCATION_OPERATION,
  QUOTATION_LOCATION_CONTRACT,
  APPROVAL_LOCATION_CONTRACT,
  APPROVAL_LOCATION_OPERATION,
  GENERIC_DOCUMENT,
} from './evidenceImages';
import type {
  ExpenseItemData,
  PaymentRoundData,
  QuoteSourceData,
} from '@/app/components/payment/payment-detail-vending/paymentDetailVending.types';

// ===== 基本情報カードの参照専用の項目値（モック）。他の支払詳細画面と表記・構成を揃える =====
export const BASIC_INFO_APPLICATION_DATE = '2025/06/15'; // 申請日（対象年月の翌月）

// 申請時に確定する組織情報（モック）。申請事業場・申請部署＝実際に伝票を入力した組織。
export const BASIC_INFO_APPLICANT_OFFICE = '10002012:近畿圏本部'; // 申請事業場

export const BASIC_INFO_APPLICANT_DEPT = '10000121:近畿圏本部営業一部'; // 申請部署

// 分割・振替有無。本支払は分割・振替とも発生していない。
export const BASIC_INFO_IS_SPLIT = false;

export const BASIC_INFO_IS_TRANSFER = false;

// 未着請求書有（モック）。支払データの未着請求書区分を参照専用（非活性）で表示する。
export const HAS_UNARRIVED_INVOICE = false;

// 自部門の費用負担部署（画面ヘッダー表示・明細/分割先の既定値で共用）
export const OWN_COST_BEARING_DEPT = '10000328:近畿圏本部営業一部';

// 基本情報カード（画面ヘッダー）の表示値。明細の初期データ・分割先の新規行初期値でも
// 参照するため、それらより前に定義する。
export const BASIC_INFO_CREATOR = '5172733:アサヒ太郎'; // 営業担当者

export const BASIC_INFO_SALES_STORE = '30200743:イオン'; // 販売店

export const BASIC_INFO_TERTIARY_STORE =
  '10754885:日本アクセス株式会社首都圏支社'; // 三次店

export const BASIC_INFO_PRIMARY_STORE = '10010078:日本アクセス仙台営業所'; // 一次店

export const INITIAL_DATA: ExpenseItemData[] = [
  {
    id: '1',
    expenseItem: 'ロケ運転費',
    managementCategory: '33S:ロケ運転費（売上非連動）',
    managementCode: '99999:ロケ運転費（売上非連動）',
    amount: '500,000',
    taxCategory: '1:課税10%',
    measureCategory: '',
    measureCode: '',
    invoiceNumber: '',
    note1: '',
    note2: '',
  },
  {
    id: '2',
    expenseItem: 'オペ協力金',
    managementCategory: '69D:オペ協力金',
    managementCode: '10020:支社Ａ　自販機部門',
    amount: '30,000',
    taxCategory: '1:課税10%',
    measureCategory: '',
    measureCode: '',
    invoiceNumber: '',
    note1: '',
    note2: '',
    splitRole: 'source',
    splitGroupId: '2',
  },
  // オペ協力金の分割先1（分割元 id:2 の直下に表示）。金額以外は分割元の情報を表示し非活性。
  {
    id: '2-1',
    expenseItem: 'オペ協力金',
    managementCategory: '69D:オペ協力金',
    managementCode: '10020:支社Ａ　自販機部門',
    amount: '',
    taxCategory: '1:課税10%',
    measureCategory: '',
    measureCode: '',
    invoiceNumber: '',
    note1: '',
    note2: '',
    splitRole: 'dest',
    splitGroupId: '2',
    splitDestName: 'ユカ',
    splitDestDept: '10000219:本社共通',
    splitAmount: '12,500',
    splitDestMgmtCategory: '69D:オペ協力金',
    splitDestMgmtCode: '10180:支社Ｂ自販機（共通）',
  },
  // オペ協力金の分割先2
  {
    id: '2-2',
    expenseItem: 'オペ協力金',
    managementCategory: '69D:オペ協力金',
    managementCode: '10210:支社Ｂ開発（開拓）',
    amount: '',
    taxCategory: '1:課税10%',
    measureCategory: '',
    measureCode: '',
    invoiceNumber: '',
    note1: '',
    note2: '',
    splitRole: 'dest',
    splitGroupId: '2',
    splitDestName: '八洋',
    splitDestDept: '10001938:首都圏本部営業二部',
    splitAmount: '12,500',
    splitDestMgmtCategory: '69F:その他一時費用',
    splitDestMgmtCode: '10210:支社Ｂ開発（開拓）',
  },
  {
    id: '3',
    expenseItem: 'その他一時費用',
    managementCategory: '69F:その他一時費用',
    managementCode: '10010:本社',
    amount: '120,000',
    taxCategory: '2:課税8%',
    measureCategory: '',
    measureCode: '',
    invoiceNumber: '',
    note1: '',
    note2: '',
  },
  {
    id: '4',
    expenseItem: '自販機コラム料',
    managementCategory: 'V7P:自販機コラム料',
    managementCode: '99999:自販機コラム料',
    amount: '80,000',
    taxCategory: '1:課税10%',
    measureCategory: '',
    measureCode: '',
    invoiceNumber: '',
    note1: '',
    note2: '',
  },
];

// 明細行の既定値。費用負担部署は自部門、販売店・三次店・一次店は基本情報の値、
// 営業担当者は基本情報の値とする。
// 分割先行は自身が持つ値を使うため、この既定値は分割元・通常行にのみ適用する
// （行ごとの値があればそちらを優先）。
export const withRowDefaults = (row: ExpenseItemData): ExpenseItemData =>
  row.splitRole === 'dest'
    ? { costBearingDept: OWN_COST_BEARING_DEPT, ...row }
    : {
        costBearingDept: OWN_COST_BEARING_DEPT,
        splitDestName: BASIC_INFO_SALES_STORE,
        splitTertiaryStore: BASIC_INFO_TERTIARY_STORE,
        splitPrimaryStore: BASIC_INFO_PRIMARY_STORE,
        splitDestManager: BASIC_INFO_CREATOR,
        ...row,
      };

// 経費明細グリッドの初期データ（INITIAL_DATA の全行）。
export const PAYMENT_DETAIL_INITIAL_DATA: ExpenseItemData[] =
  INITIAL_DATA.map(withRowDefaults);

// 「ロケ契約料前払金」グリッドの初期データ（支払明細とは独立したコピーとして保持する）。
export const PREPAYMENT_EXCLUDED_IDS = ['2-1', '2-2', '3', '4'];

export const PREPAYMENT_INITIAL_DATA: ExpenseItemData[] = INITIAL_DATA.filter(
  (row) => !PREPAYMENT_EXCLUDED_IDS.includes(row.id)
).map(withRowDefaults);

// ===== 画面固有の定数（基本情報カードの表示値・レイアウト値） =====

export const PAYMENT_NO = 'C2400NTO2'; // 支払No

export const SALES_PLAN_NO = 'D2420TK08'; // 販売計画書No（計画詳細(自販機)へのリンク元）

// ===== 支払根拠資料（モックデータ） =====

// 根拠資料のダミーデータ（支払回数ごと）。
// 根拠資料は支払回数単位で持つため、回をキーにして保持する。
// NO. は登録した順に振る（登録日の昇順＝サムネの並び順の初期値）。
// タイムスタンプはアマノ社の定額プラン（1TS/30秒）の制約で順次付与されるため、
// 最後に登録した2件を「待ち」にして、順に付与されていく様子を見せる。
// 1回目：資料を登録済みの回。
//        検印後の資料は置かない。検印後の見せ方は別途 APM用画面で作るため、
//        この画面に混ぜると「通常画面なのに削除できない」状態になってしまう。
// 2回目以降：未登録（0件表示の確認用）
// 既存のモックデータは原本ファイル（アップロードされた実体）を持たない。
// プレビューはページ画像（pageUrls）で見せるが、原本DLはできない状態として初期化する
// （指示書 D5・T4：DLボタンは disabled ＋「モックデータのため原本ファイルなし」）。
export const asMockWithoutOriginal = (files: EvidenceFile[]): EvidenceFile[] =>
  files.map((f) => ({
    ...f,
    originalUrl: undefined,
    pdfPreviewUrl: undefined,
    convertStatus: 'failed' as const,
  }));

export const INITIAL_EVIDENCE_FILES_BY_ROUND: Record<string, EvidenceFile[]> = {
  '1': asMockWithoutOriginal([
    {
      id: 'e1',
      no: 1,
      kind: '請求書',
      fileName: '請求書_サンプルベンディング東_202206.pdf',
      updatedAt: '2026/07/10',
      // 横長（A4横）の請求書。3ページあるためプレビュー内を縦スクロールして送る
      thumbnailUrl: INVOICE_LANDSCAPE_PAGES[0],
      pageUrls: INVOICE_LANDSCAPE_PAGES,
      receiptFormat: '紙と電子' as const,
      issueDate: '2026/07/01',
      timestampStatus: '付与済',
      timestampedAt: '2026/07/10',
    },
    {
      id: 'e2',
      no: 2,
      kind: '見積書',
      fileName: '見積書_ロケ運転費_サンプルベンディング東_202507.pdf',
      updatedAt: '2026/07/10',
      thumbnailUrl: QUOTATION_LOCATION_OPERATION,
      memo: '請求金額が見積と一部異なるため、差額の内訳を別紙（その他資料）に添付。',
      timestampStatus: '付与済',
      timestampedAt: '2026/07/10',
    },
    {
      id: 'e3',
      no: 3,
      kind: '稟議書',
      fileName: '稟議書_ロケ契約_RG-2025-0713.pdf',
      updatedAt: '2026/07/10',
      thumbnailUrl: APPROVAL_LOCATION_CONTRACT,
      timestampStatus: '付与済',
      timestampedAt: '2026/07/10',
    },
    {
      id: 'e4',
      no: 4,
      kind: 'その他の資料',
      fileName: 'ロケ運転費台帳_202206.xlsx',
      updatedAt: '2026/07/11',
      timestampStatus: '付与済',
      timestampedAt: '2026/07/11',
    },
    {
      // 覚書・契約書（2026-09-08 修正指示3 で区分追加）。ロケ契約の覚書。
      id: 'e5c',
      no: 5,
      kind: '覚書・契約書',
      fileName: '覚書_ロケ契約_サンプルベンディング東_2025年度.pdf',
      updatedAt: '2026/07/10',
      thumbnailUrl: GENERIC_DOCUMENT,
      memo: '2025年度ロケ契約の覚書（契約料改定分）。',
      timestampStatus: '付与済',
      timestampedAt: '2026/07/10',
    },
    {
      // 未着の覚書・契約書（代替＝ドラフト版を登録したもの）。
      // 表示タブでは区分「覚書・契約書」＋未着バッジ＋回収予定日を出す（修正指示9）。
      id: 'e5d',
      no: 6,
      kind: '覚書・契約書',
      fileName: '覚書ドラフト_ロケ契約更新_202207.pdf',
      updatedAt: '2026/07/11',
      thumbnailUrl: GENERIC_DOCUMENT,
      notReceived: true,
      collectionDate: '2026/07/31',
      timestampStatus: '付与済',
      timestampedAt: '2026/07/11',
    },
    {
      id: 'e6',
      no: 7,
      // 未着の請求書（代替請求書＝支払通知書を登録したもの）。
      // 表示タブでは区分「請求書」＋未着バッジ＋回収予定日を出す（回答A-3・修正指示8）。
      kind: '請求書',
      fileName: '支払通知書_サンプルベンディング中央_202206.pdf',
      updatedAt: '2026/07/11',
      thumbnailUrl: INVOICE_PORTRAIT,
      notReceived: true,
      collectionDate: '2026/07/25',
      receiptFormat: '電子' as const,
      issueDate: '2026/07/05',
      timestampStatus: '付与済',
      timestampedAt: '2026/07/11',
    },
    {
      id: 'e7b',
      no: 6,
      kind: '稟議書',
      fileName: '稟議書_ロケ運転費_RG-2025-0689.pdf',
      updatedAt: '2026/07/11',
      thumbnailUrl: APPROVAL_LOCATION_OPERATION,
      timestampStatus: '付与済',
      timestampedAt: '2026/07/11',
    },
    {
      id: 'e8',
      no: 7,
      kind: '見積書',
      fileName: '見積書_ロケ契約料他前払金_ダミーストア本部.pdf',
      updatedAt: '2026/07/12',
      thumbnailUrl: QUOTATION_LOCATION_CONTRACT,
      // 付与待ち。開くと30秒間隔（モックは5秒）で順に付与されていく
      timestampStatus: '待ち',
    },
    {
      // 縦長（A4縦）の請求書。検印後に APM が登録した正式な請求書の想定。
      //  ・afterSeal … 「検印後」バッジが出る。検印済の伝票を開いたときの見え方を確認できる
      //  ・付与待ち … 1件付与された後も「済」と「待ち」が画面に並んで残るようにする
      //    （差が見えないと状態表示の意味が伝わらない）
      id: 'e5',
      no: 8,
      kind: '請求書',
      fileName: '請求書_サンプルベンディング中央_202206_検印後追加.pdf',
      updatedAt: '2026/07/18',
      thumbnailUrl: INVOICE_PORTRAIT,
      afterSeal: true,
      timestampStatus: '待ち',
    },
  ]),
  // 2回目は根拠資料が未登録の回。開くと0件メッセージが出る（未登録の状態を見せるため）。
  '2': [],
};

// ログインしている利用者の区分。本番は認証情報から決まる値であり、画面側で選ぶものではない。
// モックは担当者に固定する（APM 用の見え方は別途 APM用画面で作る）。
export const EVIDENCE_USER_ROLE: EvidenceUserRole = '担当者';

// 引用明細選択ペインの表示値。対象年月は引用元が固定のため入力不可で表示する。
export const QUOTE_SOURCE_TARGET_MONTH = '2025/04';

export const QUOTE_SOURCE_PAYMENT_NO = 'C2400NTO1';

export const QUOTE_SOURCE_ROUND_OPTIONS = ['1', '2'];

// 引用で追加する回の計上月・支払予定日（引用元の日付ではなく当月分の値を設定する）。
export const QUOTED_ACCOUNTING_MONTH = '2025/06';

export const QUOTED_PAYMENT_SCHEDULE_DATE = '2025/07/31';

// 支払回数=2 の引用元では持たない明細の id（分割先2件と その他一時費用）。
export const QUOTE_SOURCE_ROUND2_EXCLUDED_IDS = ['2-1', '2-2', '3'];

// 支払回数=2 の引用元で id を振り直す明細（除外により空いた番号を詰める）。
export const QUOTE_SOURCE_ROUND2_RENUMBERED_IDS: Record<string, string> = {
  '4': '3', // コラム料：id:3 が除外されたため繰り上げる
};

// 引用元の支払情報・経費明細（モック・参照専用）。支払回数の選択で切り替える。
// 引用明細選択ペインでの表示と、引用時のコピー元で共用する
// （ロケ契約料前払金は引用対象外のため持たない）。
export const QUOTE_SOURCE_BY_ROUND: Record<string, QuoteSourceData> = {
  '1': {
    destination: '1001584:AAA営業本部商品部',
    occurrenceDate: '2025/04/15',
    scheduledDate: '2025/06/30',
    note: '4月分の支払情報',
    expenseData: PAYMENT_DETAIL_INITIAL_DATA,
  },
  '2': {
    destination: '1001586:CCC営業本部商品部',
    occurrenceDate: '2025/04/15',
    scheduledDate: '2025/06/30',
    note: '4月分の支払情報',
    expenseData: PAYMENT_DETAIL_INITIAL_DATA.filter(
      (row) => !QUOTE_SOURCE_ROUND2_EXCLUDED_IDS.includes(row.id)
    ).map((row) => ({
      ...row,
      id: QUOTE_SOURCE_ROUND2_RENUMBERED_IDS[row.id] ?? row.id,
    })),
  },
};

// 分割先行のドロップダウン選択肢（販売店・三次店・一次店）。
// 費用負担部署は共通マスタ（constants/costBearingDeptMaster.ts）の全部署をそのまま使う。
export const SALES_STORE_OPTIONS = ['21100677:XXX九州', 'ユカ', '八洋'];

export const TERTIARY_STORE_OPTIONS = ['10863223:YYY九州', '10863224:YYY関東'];

export const PRIMARY_STORE_OPTIONS = [
  '10888030:ZZZ九州支店',
  '10888031:ZZZ関東支店',
];

export const SALES_REP_OPTIONS = [
  BASIC_INFO_CREATOR, // 基本情報の営業担当者
  '5172734:サッポロ花子',
  '5172735:キリン一郎',
];

// 「他部門から分割/振替された経費」タブの初期データ（列構成は経費明細グリッドの列を流用する）。
export const SPLIT_FROM_OTHER_INITIAL_DATA: ExpenseItemData[] = [
  {
    id: 'o1',
    expenseItem: 'オペ協力金',
    managementCategory: '69D:オペ協力金',
    managementCode: '10010:本社',
    amount: '40,000',
    taxCategory: '1:課税10%',
    measureCategory: '',
    measureCode: '',
    invoiceNumber: '',
    note1: '東日本支社より分割',
    note2: '',
  },
  {
    id: 'o2',
    expenseItem: 'その他一時費用',
    managementCategory: '69F:その他一時費用',
    managementCode: '10020:支社Ａ　自販機部門',
    amount: '18,000',
    taxCategory: '2:課税8%',
    measureCategory: '',
    measureCode: '',
    invoiceNumber: '',
    note1: '中部支社より分割',
    note2: '',
  },
];

// 支払回数=1（初期表示）の内容。各 state の初期値と、回を戻したときの復元元に使う。
export const INITIAL_ROUND: PaymentRoundData = {
  paymentDestination: '1001584:AAA営業本部商品部',
  note: '',
  status: '承認待ち',
  applicantOffice: BASIC_INFO_APPLICANT_OFFICE,
  applicantDept: BASIC_INFO_APPLICANT_DEPT,
  applicant: BASIC_INFO_CREATOR,
  applicationDate: BASIC_INFO_APPLICATION_DATE,
  occurrenceDate: new Date(2025, 4, 15),
  occurrenceDateInput: format(new Date(2025, 4, 15), 'yyyy/MM/dd'),
  accountingDateInput: format(new Date(2025, 5, 1), 'yyyy/MM'),
  paymentScheduleDate: new Date(2025, 6, 31),
  paymentScheduleDateInput: format(new Date(2025, 6, 31), 'yyyy/MM/dd'),
  expenseData: PAYMENT_DETAIL_INITIAL_DATA,
  prepaymentData: PREPAYMENT_INITIAL_DATA,
};
