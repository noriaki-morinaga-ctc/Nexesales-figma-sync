// 支払詳細(追加口請求書有)の追加口分割 ─ モックデータ。
//
//   ・分割先候補：当該支払の販売店（21100677:イオンリテール）に紐づく商流販売店のうち、
//     自部署（10002990:首都圏営業第二部）を除いたもの。自部署は一覧に出さず、
//     分割先へ配ったあとの残りを自部署負担分とする（→ 20260901_第33回 決定事項4）。
//   ・前月の分割設定：分割先の選択ペインの初期チェックと、追加口分割ペインの初期値に使う。
//     値は追加口明細のモック（DetailTable の RAW_ENTRY_ROWS）に合わせ、
//     自部署負担分がマイナスにならない範囲で設定している。
//   ・分割（IN）の追加口明細：他部署から当部署へ分割された明細（参照専用・固定のモック行）。
//     本来は分割元の申請をきっかけに分割先の支払詳細へ行が追加されるが、
//     モックでは同一画面の「分割（IN）」タブに固定行を表示する（→ 実装計画 決定事項2）。
import type { SplitAllocation } from '../utils/additionalEntrySplit';

// 分割先候補の商流販売店（分割先商流販売店の選択ペインの1行）。
// 販売店・三次店・一次店・部署・担当者をコードと名称に分けて持つ（親画面の表記にそろえる）。
export interface SplitDestination {
  id: string; // 商流販売店を識別するキー（三次店コード）
  storeCode: string; // 販売店コード
  storeName: string; // 販売店名称
  tertiaryCode: string; // 三次店コード
  tertiaryName: string; // 三次店名称
  primaryCode: string; // 一次店コード
  primaryName: string; // 一次店名称
  deptCode: string; // 部署コード
  deptName: string; // 部署名称
  staffCode: string; // 担当者コード
  staffName: string; // 担当者名
  planCases: number; // 計画ケース
}

// 支払回1回分の分割の状態（親画面が支払回数ごとに保持する）。
export interface AdditionalEntrySplitState {
  destIds: string[]; // 選んだ分割先（SplitDestination.id）。列の並び順を兼ねる
  allocations: SplitAllocation[]; // 明細 × 分割先ごとのケース・バラ
}

// 分割（IN）タブの追加口明細（他部署から分割された明細・全項目参照専用）。
export interface SplitInEntryRow {
  lineNo: number; // No.
  srcDept: string; // 分割元部署（名称:コード。分割（IN）の拡売費一覧の表記にそろえる）
  srcStaff: string; // 分割元担当者（名称:コード）
  srcPaymentNo: string; // 分割元支払No
  srcPaymentCount: number; // 分割元支払回数
  srcLineNo: number; // 分割元明細No
  dataSource: string; // データ元
  productCode: string; // サマリ商品コード
  productName: string; // サマリ商品名
  capacity: number; // 入数
  cases: number; // ケース
  loose: number; // バラ
  addUnit: number; // 追加口バラ単価
  addAmount: number; // 追加口金額
  addNet: number; // 支払NET（追加口分）
  billDetailNo: string; // 請求書番号
}

// 当該支払の販売店（基本情報の販売店と同じ）。
const STORE_CODE = '21100677';
const STORE_NAME = 'イオンリテール';
// 一次店（候補はすべて同じ一次店）。
const PRIMARY_CODE = '10888030';
const PRIMARY_NAME = '三菱食品株式会社（イオン）';

const destination = (
  tertiaryCode: string,
  tertiaryName: string,
  deptCode: string,
  deptName: string,
  staffCode: string,
  staffName: string,
  planCases: number
): SplitDestination => ({
  id: tertiaryCode,
  storeCode: STORE_CODE,
  storeName: STORE_NAME,
  tertiaryCode,
  tertiaryName,
  primaryCode: PRIMARY_CODE,
  primaryName: PRIMARY_NAME,
  deptCode,
  deptName,
  staffCode,
  staffName,
  planCases,
});

// 分割先候補の商流販売店（自部署を除く10件）。担当者名は伏字のダミー。
export const SPLIT_DESTINATION_CANDIDATES: SplitDestination[] = [
  destination(
    '10924807',
    '三菱食品㈱広域流通本部イオンＧ春日部物流Ｃ',
    '10003325',
    '首都圏本部営業三部',
    '5510361',
    '◯藤　△一',
    1791
  ),
  destination(
    '10925064',
    '三菱食品㈱北関東物流センターイオン',
    '10003310',
    '関東本部営業二部',
    '5504263',
    '◯木　△樹',
    1126
  ),
  destination(
    '11012547',
    '三菱食品株式会社イオン新潟センター',
    '10003342',
    '関東本部信越支店',
    '5496728',
    '◯橋　△子',
    703
  ),
  destination(
    '10011986',
    '三菱食品株式会社北東北支店青森ＤＣ',
    '10000074',
    '東北支社北東北支店',
    '9395060',
    '◯中　△太',
    2602
  ),
  destination(
    '10006877',
    '三菱食品株式会社０４８静岡オフィス',
    '10000107',
    '中部北陸本部静岡支店',
    '5187223',
    '◯藤　△咲',
    3830
  ),
  destination(
    '10906344',
    '三菱食品（株）富山ＤＣ',
    '10000108',
    '中部北陸本部北陸支店',
    '5512362',
    '◯辺　△也',
    1434
  ),
  destination(
    '10848994',
    '三菱食品株式会社福岡ＤＣ（食品）',
    '10000145',
    '九州支社営業一部',
    '9394173',
    '◯本　△子',
    115
  ),
  destination(
    '10941541',
    '三菱食品株式会社石狩加食ＤＣ',
    '10000587',
    '北海道支社営業二部',
    '5510382',
    '◯村　△輔',
    129
  ),
  destination(
    '10987865',
    '三菱食品（株）イオン東大阪加食センター',
    '10003358',
    '近畿圏本部営業五部',
    '5510357',
    '◯林　△真',
    4625
  ),
  destination(
    '11004681',
    '三菱食品株式会社イオン西条加食センター',
    '10003364',
    '中四国支社営業三部',
    '7302208',
    '◯藤　△希',
    2085
  ),
];

// 前月に分割した商流販売店（春日部物流Ｃ・北関東物流Ｃ・イオン新潟センター）。
const DEST_KASUKABE = '10924807';
const DEST_KITAKANTO = '10925064';
const DEST_NIIGATA = '11012547';

// 明細1行分の分割（春日部・北関東・新潟の順に [ケース, バラ]）。
const allocationsOfLine = (
  lineNo: number,
  kasukabe: [number, number],
  kitakanto: [number, number],
  niigata: [number, number]
): SplitAllocation[] => [
  { lineNo, destId: DEST_KASUKABE, cases: kasukabe[0], loose: kasukabe[1] },
  { lineNo, destId: DEST_KITAKANTO, cases: kitakanto[0], loose: kitakanto[1] },
  { lineNo, destId: DEST_NIIGATA, cases: niigata[0], loose: niigata[1] },
];

// 前月の分割設定。No.5 は前月も分割していない（全量が自部署負担分）。
// No.15 は支払ケース・追加口バラ単価が無い明細のため分割しない。
// No.10〜13 は追加口バラ単価に小数を含み、金額の四捨五入を確認できる。
export const PREV_MONTH_SPLIT: AdditionalEntrySplitState = {
  destIds: [DEST_KASUKABE, DEST_KITAKANTO, DEST_NIIGATA],
  allocations: [
    ...allocationsOfLine(1, [20, 0], [15, 0], [25, 0]),
    ...allocationsOfLine(2, [18, 0], [12, 0], [17, 0]),
    ...allocationsOfLine(3, [0, 3], [0, 2], [0, 1]),
    ...allocationsOfLine(4, [6, 0], [8, 0], [5, 0]),
    ...allocationsOfLine(6, [14, 0], [10, 0], [8, 0]),
    ...allocationsOfLine(7, [20, 0], [15, 0], [12, 0]),
    ...allocationsOfLine(8, [45, 0], [30, 0], [25, 0]),
    ...allocationsOfLine(9, [30, 0], [28, 0], [22, 0]),
    ...allocationsOfLine(10, [5, 0], [4, 0], [3, 0]),
    ...allocationsOfLine(11, [15, 0], [12, 0], [10, 0]),
    ...allocationsOfLine(12, [3, 0], [2, 0], [2, 0]),
    ...allocationsOfLine(13, [4, 0], [3, 0], [2, 0]),
    ...allocationsOfLine(14, [3, 0], [2, 0], [2, 0]),
  ],
};

// 分割（IN）の追加口明細の分割元（他部署の支払）。
const SPLIT_IN_SOURCE = {
  srcDept: '首都圏本部営業三部:10003325',
  srcStaff: '◯藤　△一:5510361',
  srcPaymentNo: 'C2400NTO7',
  srcPaymentCount: 1,
  dataSource: '請求EDI',
  billDetailNo: '457801SA',
} as const;

// 分割（IN）の追加口明細1行。追加口金額は（ケース × 入数 ＋ バラ）× 追加口バラ単価。
const splitInRow = (
  lineNo: number,
  srcLineNo: number,
  productCode: string,
  productName: string,
  capacity: number,
  cases: number,
  loose: number,
  addUnit: number,
  addNet: number
): SplitInEntryRow => ({
  ...SPLIT_IN_SOURCE,
  lineNo,
  srcLineNo,
  productCode,
  productName,
  capacity,
  cases,
  loose,
  addUnit,
  addAmount: (cases * capacity + loose) * addUnit,
  addNet,
});

// 他部署（首都圏本部営業三部）から当部署へ分割された追加口明細（参照専用）。
// 分割元明細No が飛んでいるのは、当部署への分割が 0 の明細を作らないため。
export const SPLIT_IN_ENTRY_ROWS: SplitInEntryRow[] = [
  splitInRow(1, 1, '45160011', 'ワンダ金の微糖185g30本', 24, 20, 0, 71, 90),
  splitInRow(
    2,
    2,
    '45160042',
    'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
    24,
    18,
    0,
    64,
    90
  ),
  splitInRow(
    3,
    3,
    '45160042',
    'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
    24,
    0,
    3,
    66,
    88
  ),
  splitInRow(4, 4, '45160011', 'ワンダ金の微糖185g30本', 5, 6, 0, 190, 452),
  splitInRow(
    5,
    6,
    '45160028',
    'ワンダモーニングショット185g30本',
    5,
    14,
    0,
    190,
    452
  ),
  splitInRow(
    6,
    7,
    '45160028',
    'ワンダモーニングショット185g30本',
    5,
    20,
    0,
    154,
    488
  ),
  splitInRow(
    7,
    8,
    '45160035',
    'ワンダ ボトルコーヒー微糖500mL24本',
    24,
    45,
    0,
    73,
    95
  ),
  splitInRow(
    8,
    9,
    '45160042',
    'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
    24,
    30,
    3,
    71,
    87
  ),
];
