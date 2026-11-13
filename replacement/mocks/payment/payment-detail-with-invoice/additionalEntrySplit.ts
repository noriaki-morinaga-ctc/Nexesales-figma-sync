// 支払詳細(請求書あり)：追加口分割の分割先候補・前月の分割のモック（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// 画面は src/app/components/payment/payment-detail-with-invoice/page.tsx。

import type {
  AdditionalEntrySplitState,
  SplitDestination,
} from '@/app/types/paymentDetail';
import type { SplitAllocation } from '@/app/utils/payment/payment-detail/additionalEntrySplit';

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
