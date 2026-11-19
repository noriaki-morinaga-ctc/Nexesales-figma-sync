// Todo：朴：C追加口・拡売費支払モック修正中
// 引用明細選択エリア（下ペイン）。支払詳細(追加口請求書有／追加口請求書無／商流販売店紐づけなし)の
// 「支払情報引用」ボタンで開き（画面ごとの違いは QuoteSelectionConfig で受け取る）、
// 新しく追加する支払回へ引用する伝票（支払No＋支払回数）を一覧から選ぶ。
// 一覧は伝票行の下に明細行（分割の枝番行を含む）を並べた階層表示とし、
//   ・伝票情報（支払先・対象年月・支払No・支払回数）は左に固定して表示する
//   ・明細情報は親画面の拡売費一覧（PaymentNonProductExpensePane）と同じ列構成にそろえる
// 引用元の伝票は伝票行のラジオで1件選び、ペインタイトル右の「引用」で
// 当該伝票の明細すべてを引用する（→ 20260814_第28回 決定事項2・3・4／課題No.1222）。
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AgGridReact } from 'ag-grid-react';
import type {
  ColDef,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  IHeaderParams,
} from 'ag-grid-community';
import { ChevronDown, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  GRID_COLORS,
  totalCellStyle,
  GRID_DEFAULT_COL_DEF,
  GRID_BASE_PROPS,
  GRID_STATUS_BAR,
  editableBg,
  gridFilterContextMenuItems,
  useGridColumnState,
  GRID_NUMBER_TEXT_FILTER,
  GRID_MONTH_TEXT_FILTER,
  GRID_EMPTY_TEXT,
} from '@/components/grid';
import { addMonths, toYearMonth } from '@/utils/common/yearMonth';
import {
  campaignClassCode,
  managementClassCode,
  managementCodeName,
} from '@/utils/payment/payment-detail/paymentComboFieldOptions';
import { campaignCodeNameOf } from '@/utils/common/comboFieldOptions';
import type { ExpenseBasicInfo } from '@/types/paymentDetail';

// 引用元となる支払明細データ（拡売費一覧の明細と同じ項目構成）。
// 管理区分・施策区分は拡売費一覧と同様に「名称」を保持し、コードは表示時に導出する。
export interface QuoteDetailRow {
  paymentNo: string; // 支払No
  round: string; // 支払回数
  detailNo: number | string; // 明細No（拡売費一覧の「No.」に対応）
  // データ元・請求金額・照合支払区分は、値を持つ明細だけが個別に持ち、
  // 持たない明細は既定値で補う（dataSourceOf／billAmountOf／matchTypeOf）。
  dataSource?: string; // データ元（請求EDI／AIC入力／手入力）
  billName: string; // 卸からの請求名称（請求EDI・請求詳細から連携された商品名）
  billNote: string; // 備考（請求EDI・請求詳細から連携された備考）
  planExpContent: string; // メタブランド（メタブランド名）
  product: string; // サマリ商品名
  billAmount?: number | string; // 請求金額（請求書に記載された金額）
  payAmount: number | string; // 支払金額
  matchType?: string; // 照合支払区分
  // 計画金額・計画差異は一覧の列には出さない（拡売費一覧に計画の列が無いため）。
  // 引用時は計画紐づけを引き継がず計画金額を0円にする（→ 20260814_第28回 決定事項12）。
  planAmount: number | string; // 計画金額
  planDiff: number | string; // 計画差異
  taxClass: string; // 税区分
  mgmtClass: string; // 管理区分（名称）
  mgmtCode: string; // 管理コード（コード）
  measureClass: string; // 施策区分（名称）
  measureCode: string; // 施策コード（コード）
  summary1: string; // 摘要1（社内用）
  summary2: string; // 摘要2（社外用）
  billNo: string; // 請求書番号
  billPage: string; // 請求書ページ
  // 分割の枝番行（親行の直下に表示する「親明細No-枝番」の行）。親行のデータを再掲し、
  // 支払金額・請求金額のみ空白にする（金額は「負担金額」で表す）。
  isBranch?: boolean;
  // 分割先の値（枝番行のみ保持）。拡売費一覧と同じく、枝番行はこれらを明細行と
  // 同じ列（負担金額・商流・組織・管理／施策・摘要）に自身の値として表示する。
  splitAmount?: number | string; // 負担金額（分割先が負担する金額）
  splitPrimaryStore?: string; // 分割先の一次店
  splitTertiaryStore?: string; // 分割先の三次店
  splitStore?: string; // 分割先の販売店
  splitDept?: string; // 分割先の費用負担部署
  splitStaff?: string; // 分割先の担当者
  splitMgmtClass?: string; // 分割先の管理区分（名称）
  splitMgmtCode?: string; // 分割先の管理コード（コード）
  splitMeasureClass?: string; // 分割先の施策区分（名称）
  splitMeasureCode?: string; // 分割先の施策コード（コード）
  splitSummary1?: string; // 分割先の摘要1（社内用）
  splitSummary2?: string; // 分割先の摘要2（社外用）
}

// 伝票行（明細をまとめる親行）。伝票情報だけを持ち、明細情報の列は空にする。
export interface QuoteVoucherRow {
  isVoucher: true;
  paymentNo: string; // 支払No
  round: string; // 支払回数
  targetMonth: string; // 対象年月（'YYYY/MM'）
  payee: string; // 支払先
  detailCount: number; // 明細件数（明細行のみ。分割の枝番行は除く）
  branchCount: number; // 分割の枝番行の件数
}

// 一覧に並べる行（伝票行または明細行）。
export type QuoteGridRow = QuoteVoucherRow | QuoteDetailRow;

const isVoucherRow = (row?: QuoteGridRow | null): row is QuoteVoucherRow =>
  !!row && (row as QuoteVoucherRow).isVoucher === true;
const isDetailRow = (row?: QuoteGridRow | null): row is QuoteDetailRow =>
  !!row && !isVoucherRow(row);

// 分割の枝番行（分割先）を持つ親明細（支払No C2400NTO3／支払回数1／明細No 1）。
// 枝番行は本行のデータを再掲するため、行オブジェクトを共有できるよう切り出す。
const QUOTE_BRANCH_PARENT: QuoteDetailRow = {
  paymentNo: 'C2400NTO3',
  round: '1',
  detailNo: 1,
  billName: 'アサヒ飲料 三ツ矢サイダー 春の店頭値引き',
  billNote: '',
  planExpContent: '三ツ矢',
  product: '三ツ矢サイダー500mL24本',
  payAmount: 45000,
  planAmount: 45000,
  taxClass: '1:課税10%',
  mgmtClass: '売上連動拡売費A口',
  mgmtCode: 'RA001',
  measureClass: '販売促進',
  measureCode: 'SP001',
  summary1: '春の店頭値引き原資（社内）',
  summary2: '三ツ矢サイダー 店頭値引き（社外）',
  planDiff: 0,
  billNo: '457810SA',
  billPage: '①01',
};

// 分割の枝番行を持つ親明細（支払No C2400NTO4／支払回数1／明細No 1）。
// 検索条件の初期値（対象年月＝前月）で表示される伝票にも分割の例を置く。
const QUOTE_PREV_BRANCH_PARENT: QuoteDetailRow = {
  paymentNo: 'C2400NTO4',
  round: '1',
  detailNo: 1,
  billName: 'アサヒ飲料 三ツ矢サイダー 試飲会費用　20店日',
  billNote: '',
  planExpContent: '三ツ矢',
  product: '三ツ矢サイダー350mL28本',
  payAmount: 20000,
  planAmount: 20000,
  taxClass: '1:課税10%',
  mgmtClass: '拡売費(固定費)B口',
  mgmtCode: 'FB002',
  measureClass: 'スポット',
  measureCode: 'SS002',
  summary1: '試飲会実施費（社内）',
  summary2: '三ツ矢サイダー試飲会（社外）',
  planDiff: 0,
  billNo: '457818SA',
  billPage: '①01',
};

// 分割の枝番行を1件生成する。明細Noは「親明細No-枝番」（例「1-1」）とし、
// 親行のデータを再掲したうえで支払金額・計画金額のみ空白にする
//（金額は「負担金額」（splitAmount）で表す）。分割先の値は引数で与える。
const makeBranchRow = (
  parent: QuoteDetailRow,
  branchNo: number,
  splitValues: Partial<QuoteDetailRow>
): QuoteDetailRow => ({
  ...parent,
  detailNo: `${parent.detailNo}-${branchNo}`,
  payAmount: '',
  planAmount: '',
  isBranch: true,
  ...splitValues,
});

// 引用元候補のモックデータ（検印済みの支払明細）。
const QUOTE_DETAIL_ROWS: QuoteDetailRow[] = [
  {
    paymentNo: 'C2400NTO1',
    round: '1',
    detailNo: 1,
    billName: 'アサヒ飲料 ワンダ モーニングショット ６Ｐ アプリ20',
    billNote: '',
    planExpContent: 'ワンダ',
    product: 'ワンダモーニングショット185g30本',
    payAmount: 57433,
    planAmount: 56000,
    taxClass: '2:課税8%',
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    measureClass: '販売促進',
    measureCode: 'SP001',
    summary1: 'アプリ施策の値引き原資（社内）',
    summary2: 'アプリ20%相当の販促値引（社外）',
    planDiff: 1433,
    billNo: '457801SA',
    billPage: '①02',
  },
  {
    paymentNo: 'C2400NTO1',
    round: '1',
    detailNo: 2,
    billName: 'アサヒ飲料 アプリエントリーキャンペーン費',
    billNote: '',
    planExpContent: 'ブランド横断(全商品)',
    product: '-',
    payAmount: 200,
    planAmount: 200,
    taxClass: '1:課税10%',
    mgmtClass: '拡売費(固定費)A口',
    mgmtCode: 'FA001',
    measureClass: '新規導入',
    measureCode: 'SN001',
    summary1: 'アプリエントリー費（社内）',
    summary2: 'アプリ登録キャンペーン（社外）',
    planDiff: 0,
    billNo: '457802SA',
    billPage: '①02',
  },
  {
    paymentNo: 'C2400NTO1',
    round: '2',
    detailNo: 1,
    billName: 'アサヒ飲料 三ツ矢サイダー 試飲会費用　30店日',
    billNote: '',
    planExpContent: '三ツ矢',
    product: '-',
    payAmount: 600,
    planAmount: 0,
    taxClass: '1:課税10%',
    mgmtClass: '拡売費(固定費)B口',
    mgmtCode: 'FB001',
    measureClass: 'スポット',
    measureCode: 'SS001',
    summary1: '試飲会実施費（社内）',
    summary2: '三ツ矢サイダー試飲会（社外）',
    planDiff: 600,
    billNo: '457803SA',
    billPage: '①03',
  },
  {
    paymentNo: 'C2400NTO2',
    round: '1',
    detailNo: 1,
    billName: 'アサヒ飲料 ウィルキンソン 棚替え協力費',
    billNote: '',
    planExpContent: 'ウィルキンソン',
    product: 'ウィルキンソン炭酸水500mL24本',
    // 請求金額と支払金額に差がある明細（請求－支払：差額 2,000）。
    billAmount: 32000,
    matchType: '2:条件違い',
    payAmount: 30000,
    planAmount: 28000,
    taxClass: '1:課税10%',
    mgmtClass: '拡売費(固定費)A口',
    mgmtCode: 'FA002',
    measureClass: 'スポット',
    measureCode: 'SS003',
    summary1: '棚替え作業協力金（社内）',
    summary2: 'ウィルキンソン新商品棚替え（社外）',
    planDiff: 2000,
    billNo: '457804SA',
    billPage: '①03',
  },
  {
    paymentNo: 'C2400NTO2',
    round: '2',
    detailNo: 1,
    billName: 'アサヒ飲料 三ツ矢サイダーＰＥＴ５００ 店頭企画',
    billNote: '',
    planExpContent: '三ツ矢',
    product: '三ツ矢サイダー500mL24本',
    payAmount: 12000,
    planAmount: 12000,
    taxClass: '1:課税10%',
    mgmtClass: '売上連動拡売費B口',
    mgmtCode: 'RB001',
    measureClass: '販売促進',
    measureCode: 'SP002',
    summary1: '店頭販促企画の販促費（社内）',
    summary2: '三ツ矢サイダー店頭企画（社外）',
    planDiff: 0,
    billNo: '457805SA',
    billPage: '①02',
  },
  {
    paymentNo: 'C2400NTO2',
    round: '3',
    detailNo: 1,
    billName: 'アサヒ飲料 ワンダ極微糖 NET差額拡売費',
    billNote: '',
    planExpContent: 'ワンダ',
    product: 'ワンダ金の微糖185g30本',
    payAmount: 92000,
    planAmount: 0,
    taxClass: '2:課税8%',
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    measureClass: '販売促進',
    measureCode: 'SP001',
    summary1: 'NET差額の自動振替（社内）',
    summary2: 'ネット差額調整（社外）',
    planDiff: -8000,
    billNo: 'NET2409-001',
    billPage: '①02',
  },
  // ── 追加のダミーデータ（検索結果の件数確認用。支払No C2400NTO3〜5 の各回） ──
  QUOTE_BRANCH_PARENT,
  // 枝番行（分割先）。親行（C2400NTO3／1回目／明細No 1）のデータを再掲し、
  // 分割先グループの各列にダミーデータを設定する（分割金額の合計＝親行の支払金額 45,000）。
  makeBranchRow(QUOTE_BRANCH_PARENT, 1, {
    splitAmount: 27000,
    splitPrimaryStore: '10888030:三菱食品株式会社（イオン）',
    splitTertiaryStore: '10863223:イオン東北ＲＤＣ',
    splitStore: '21100677:イオンリテール',
    splitDept: '10002990:首都圏営業第二部',
    splitStaff: '5172733:アサヒ　太郎',
    splitMgmtClass: '売上連動拡売費A口',
    splitMgmtCode: 'RA001',
    splitMeasureClass: '販売促進',
    splitMeasureCode: 'SP001',
    splitSummary1: '首都圏営業第二部へ分割（社内）',
    splitSummary2: '三ツ矢サイダー 店頭値引き（社外）',
  }),
  makeBranchRow(QUOTE_BRANCH_PARENT, 2, {
    splitAmount: 18000,
    splitPrimaryStore: '10888032:加藤産業株式会社',
    splitTertiaryStore: '10863225:イオン中部ＲＤＣ',
    splitStore: '21100678:マックスバリュ東海',
    splitDept: '10003002:中部営業部',
    splitStaff: '5172735:アサヒ　次郎',
    splitMgmtClass: '売上連動拡売費A口',
    splitMgmtCode: 'RA002',
    splitMeasureClass: '販売促進',
    splitMeasureCode: 'SP002',
    splitSummary1: '中部営業部へ分割（社内）',
    splitSummary2: '三ツ矢サイダー 店頭値引き（社外）',
  }),
  {
    paymentNo: 'C2400NTO3',
    round: '1',
    detailNo: 2,
    billName: 'アサヒ飲料 カルピスウォーター 新商品導入',
    billNote: '',
    planExpContent: 'カルピス',
    product: 'カルピスウォーター500mL24本',
    payAmount: 60000,
    planAmount: 55000,
    taxClass: '1:課税10%',
    mgmtClass: '拡売費(固定費)A口',
    mgmtCode: 'FA001',
    measureClass: '新規導入',
    measureCode: 'SN001',
    summary1: '新商品導入の棚獲得費（社内）',
    summary2: 'カルピスウォーター新発売（社外）',
    planDiff: 5000,
    billNo: '457811SA',
    billPage: '①01',
  },
  {
    paymentNo: 'C2400NTO3',
    round: '1',
    detailNo: 3,
    // 請求金額と支払金額に差がある明細（請求－支払：差額 5,000）。
    billAmount: 30000,
    matchType: '1:数量違い',
    billName: 'アサヒ飲料 十六茶 チラシ協賛',
    billNote: '',
    planExpContent: '十六茶',
    product: '十六茶630mL24本',
    payAmount: 25000,
    planAmount: 30000,
    taxClass: '1:課税10%',
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA002',
    measureClass: '販売促進',
    measureCode: 'SP003',
    summary1: 'チラシ協賛費（社内）',
    summary2: '十六茶 チラシ掲載（社外）',
    planDiff: -5000,
    billNo: '457812SA',
    billPage: '①02',
  },
  {
    paymentNo: 'C2400NTO3',
    round: '1',
    detailNo: 4,
    billName: 'アサヒ飲料 ワンダ極ブラック NET差額拡売費',
    billNote: '',
    planExpContent: 'ワンダ',
    product: 'ワンダ金の微糖185g30本',
    payAmount: 88000,
    planAmount: 0,
    taxClass: '2:課税8%',
    mgmtClass: '売上連動拡売費B口',
    mgmtCode: 'RB001',
    measureClass: '販売促進',
    measureCode: 'SP002',
    summary1: 'NET差額の自動振替（社内）',
    summary2: 'ネット差額調整（社外）',
    planDiff: 88000,
    billNo: 'NET2504-001',
    billPage: '①02',
  },
  {
    paymentNo: 'C2400NTO3',
    round: '1',
    detailNo: 5,
    billName: 'アサヒ飲料 ウィルキンソン 什器設置費',
    billNote: '',
    planExpContent: 'ウィルキンソン',
    product: 'ウィルキンソン炭酸水500mL24本',
    payAmount: 18000,
    planAmount: 18000,
    taxClass: '1:課税10%',
    mgmtClass: '拡売費(固定費)A口',
    mgmtCode: 'FA002',
    measureClass: 'スポット',
    measureCode: 'SS003',
    summary1: '販促什器の設置費（社内）',
    summary2: 'ウィルキンソン什器設置（社外）',
    planDiff: 0,
    billNo: '457813SA',
    billPage: '①03',
  },
  {
    paymentNo: 'C2400NTO3',
    round: '2',
    detailNo: 1,
    billName: 'アサヒ飲料 三ツ矢サイダー エンド展開協力費',
    billNote: '',
    planExpContent: '三ツ矢',
    product: '三ツ矢サイダー250mL30本',
    payAmount: 52000,
    planAmount: 50000,
    taxClass: '1:課税10%',
    mgmtClass: '売上連動拡売費B口',
    mgmtCode: 'RB002',
    measureClass: '販売促進',
    measureCode: 'SP001',
    summary1: 'エンド展開の協力費（社内）',
    summary2: '三ツ矢サイダー エンド展開（社外）',
    planDiff: 2000,
    billNo: '457814SA',
    billPage: '①01',
  },
  {
    paymentNo: 'C2400NTO3',
    round: '2',
    detailNo: 2,
    billName: 'アサヒ飲料 ワンダ アプリクーポン施策',
    billNote: '',
    planExpContent: 'ワンダ',
    product: 'ワンダモーニングショット185g30本',
    payAmount: 36000,
    planAmount: 36000,
    taxClass: '2:課税8%',
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    measureClass: '販売促進',
    measureCode: 'SP002',
    summary1: 'アプリクーポン原資（社内）',
    summary2: 'ワンダ アプリ10円引き（社外）',
    planDiff: 0,
    billNo: '457815SA',
    billPage: '①01',
  },
  {
    paymentNo: 'C2400NTO3',
    round: '2',
    detailNo: 3,
    billName: 'アサヒ飲料 カルピス 新規棚獲得施策',
    billNote: '',
    planExpContent: 'カルピス',
    product: 'カルピスウォーター500mL24本',
    payAmount: 42000,
    planAmount: 38000,
    taxClass: '1:課税10%',
    mgmtClass: '拡売費(固定費)B口',
    mgmtCode: 'FB001',
    measureClass: '新規導入',
    measureCode: 'SN002',
    summary1: '新規棚獲得の販促費（社内）',
    summary2: 'カルピス 新規棚展開（社外）',
    planDiff: 4000,
    billNo: '457816SA',
    billPage: '①02',
  },
  {
    paymentNo: 'C2400NTO3',
    round: '2',
    detailNo: 4,
    billName: 'アサヒ飲料 十六茶 リピート購入特典',
    billNote: '',
    planExpContent: '十六茶',
    product: '十六茶2L6本',
    payAmount: 21000,
    planAmount: 24000,
    taxClass: '1:課税10%',
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA002',
    measureClass: 'リピート',
    measureCode: 'SR001',
    summary1: 'リピート特典の原資（社内）',
    summary2: '十六茶 まとめ買い特典（社外）',
    planDiff: -3000,
    billNo: '457817SA',
    billPage: '①02',
  },
  {
    paymentNo: 'C2400NTO3',
    round: '2',
    detailNo: 5,
    billName: 'アサヒ飲料 ワンダ カフェオレ NET差額拡売費',
    billNote: '',
    planExpContent: 'ワンダ',
    product: 'ワンダ ボトルコーヒー微糖500mL24本',
    payAmount: 67000,
    planAmount: 0,
    taxClass: '2:課税8%',
    mgmtClass: '売上連動拡売費B口',
    mgmtCode: 'RB001',
    measureClass: '販売促進',
    measureCode: 'SP002',
    summary1: 'NET差額の自動振替（社内）',
    summary2: 'ネット差額調整（社外）',
    planDiff: 67000,
    billNo: 'NET2505-001',
    billPage: '①03',
  },
  QUOTE_PREV_BRANCH_PARENT,
  // 分割の枝番行（分割先）。親行（C2400NTO4／1回目／明細No 1）のデータを再掲し、
  // 分割先の値を設定する（負担金額の合計＝親行の支払金額 20,000）。
  makeBranchRow(QUOTE_PREV_BRANCH_PARENT, 1, {
    splitAmount: 12000,
    splitPrimaryStore: '10888030:三菱食品株式会社（イオン）',
    splitTertiaryStore: '10863223:イオン東北ＲＤＣ',
    splitStore: '21100677:イオンリテール',
    splitDept: '10002990:首都圏営業第二部',
    splitStaff: '5172733:アサヒ　太郎',
    splitMgmtClass: '拡売費(固定費)B口',
    splitMgmtCode: 'FB002',
    splitMeasureClass: 'スポット',
    splitMeasureCode: 'SS002',
    splitSummary1: '首都圏営業第二部へ分割（社内）',
    splitSummary2: '三ツ矢サイダー試飲会（社外）',
  }),
  makeBranchRow(QUOTE_PREV_BRANCH_PARENT, 2, {
    splitAmount: 8000,
    splitPrimaryStore: '10888032:加藤産業株式会社',
    splitTertiaryStore: '10863225:イオン中部ＲＤＣ',
    splitStore: '21100678:マックスバリュ東海',
    splitDept: '10003002:中部営業部',
    splitStaff: '5172735:アサヒ　次郎',
    splitMgmtClass: '拡売費(固定費)B口',
    splitMgmtCode: 'FB001',
    splitMeasureClass: 'スポット',
    splitMeasureCode: 'SS003',
    splitSummary1: '中部営業部へ分割（社内）',
    splitSummary2: '三ツ矢サイダー試飲会（社外）',
  }),
  {
    paymentNo: 'C2400NTO4',
    round: '1',
    detailNo: 2,
    billName: 'アサヒ飲料 ワンダ 店頭定番販促',
    billNote: '',
    planExpContent: 'ワンダ',
    product: 'ワンダ金の微糖185g30本',
    payAmount: 48000,
    planAmount: 45000,
    taxClass: '2:課税8%',
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    measureClass: '販売促進',
    measureCode: 'SP001',
    summary1: '定番販促の値引き原資（社内）',
    summary2: 'ワンダ 定番棚値引き（社外）',
    planDiff: 3000,
    billNo: '457819SA',
    billPage: '①01',
  },
  {
    paymentNo: 'C2400NTO4',
    round: '1',
    detailNo: 3,
    dataSource: 'AIC入力',
    billName: 'アサヒ飲料 ウィルキンソン 看板広告費',
    billNote: '',
    planExpContent: 'ウィルキンソン',
    product: 'ウィルキンソン炭酸水500mL24本',
    payAmount: 33000,
    planAmount: 33000,
    taxClass: '1:課税10%',
    mgmtClass: '拡売費(固定費)B口',
    mgmtCode: 'FB001',
    measureClass: 'スポット',
    measureCode: 'SS001',
    summary1: '店頭看板の掲出費（社内）',
    summary2: 'ウィルキンソン看板広告（社外）',
    planDiff: 0,
    billNo: '457820SA',
    billPage: '①02',
  },
  {
    paymentNo: 'C2400NTO4',
    round: '1',
    detailNo: 4,
    billName: 'アサヒ飲料 カルピス 本社一括販促',
    billNote: '',
    planExpContent: 'カルピス',
    product: 'カルピスウォーター500mL24本',
    payAmount: 75000,
    planAmount: 80000,
    taxClass: '1:課税10%',
    mgmtClass: '売上連動拡売費本社口',
    mgmtCode: 'RH001',
    measureClass: '販売促進',
    measureCode: 'SP003',
    summary1: '本社一括販促費（社内）',
    summary2: 'カルピス 全国キャンペーン（社外）',
    planDiff: -5000,
    billNo: '457821SA',
    billPage: '①02',
  },
  {
    paymentNo: 'C2400NTO4',
    round: '1',
    detailNo: 5,
    billName: 'アサヒ飲料 ワンダ ブラック NET差額拡売費',
    billNote: '',
    planExpContent: 'ワンダ',
    product: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
    payAmount: 54000,
    planAmount: 0,
    taxClass: '2:課税8%',
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA002',
    measureClass: '販売促進',
    measureCode: 'SP002',
    summary1: 'NET差額の自動振替（社内）',
    summary2: 'ネット差額調整（社外）',
    planDiff: 54000,
    billNo: 'NET2506-001',
    billPage: '①03',
  },
  {
    paymentNo: 'C2400NTO4',
    round: '2',
    detailNo: 1,
    billName: 'アサヒ飲料 三ツ矢サイダー 夏の特売企画',
    billNote: '',
    planExpContent: '三ツ矢',
    product: '三ツ矢サイダー250mL30本',
    payAmount: 63000,
    planAmount: 60000,
    taxClass: '1:課税10%',
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    measureClass: '販売促進',
    measureCode: 'SP001',
    summary1: '夏の特売の値引き原資（社内）',
    summary2: '三ツ矢サイダー 夏の特売（社外）',
    planDiff: 3000,
    billNo: '457822SA',
    billPage: '①01',
  },
  {
    paymentNo: 'C2400NTO4',
    round: '2',
    detailNo: 2,
    billName: 'アサヒ飲料 十六茶 新商品Web告知',
    billNote: '',
    planExpContent: '十六茶',
    product: '十六茶630mL24本',
    payAmount: 29000,
    planAmount: 25000,
    taxClass: '1:課税10%',
    mgmtClass: '拡売費(固定費)本社口',
    mgmtCode: 'FH001',
    measureClass: '新規導入',
    measureCode: 'SN003',
    summary1: 'Web告知の広告費（社内）',
    summary2: '十六茶 新商品Web告知（社外）',
    planDiff: 4000,
    billNo: '457823SA',
    billPage: '①01',
  },
  {
    paymentNo: 'C2400NTO4',
    round: '2',
    detailNo: 3,
    billName: 'アサヒ飲料 ワンダ サンプリング費用',
    billNote: '',
    planExpContent: 'ワンダ',
    product: 'ワンダ金の微糖185g30本',
    payAmount: 41000,
    planAmount: 41000,
    taxClass: '1:課税10%',
    mgmtClass: '拡売費(固定費)A口',
    mgmtCode: 'FA001',
    measureClass: '新規導入',
    measureCode: 'SN004',
    summary1: 'サンプリング実施費（社内）',
    summary2: 'ワンダ 店頭サンプリング（社外）',
    planDiff: 0,
    billNo: '457824SA',
    billPage: '①02',
  },
  {
    paymentNo: 'C2400NTO4',
    round: '2',
    detailNo: 4,
    billName: 'アサヒ飲料 カルピス リピート展示会',
    billNote: '',
    planExpContent: 'カルピス',
    product: 'カルピスウォーター500mL24本',
    payAmount: 17000,
    planAmount: 20000,
    taxClass: '1:課税10%',
    mgmtClass: '売上連動拡売費B口',
    mgmtCode: 'RB002',
    measureClass: 'リピート',
    measureCode: 'SR002',
    summary1: '展示会出展費（社内）',
    summary2: 'カルピス 展示会出展（社外）',
    planDiff: -3000,
    billNo: '457825SA',
    billPage: '①02',
  },
  {
    paymentNo: 'C2400NTO4',
    round: '2',
    detailNo: 5,
    billName: 'アサヒ飲料 三ツ矢サイダー NET差額拡売費',
    billNote: '',
    planExpContent: '三ツ矢',
    product: '三ツ矢サイダー500mL24本',
    payAmount: 39000,
    planAmount: 0,
    taxClass: '2:課税8%',
    mgmtClass: '売上連動拡売費本社口',
    mgmtCode: 'RH002',
    measureClass: '販売促進',
    measureCode: 'SP002',
    summary1: 'NET差額の自動振替（社内）',
    summary2: 'ネット差額調整（社外）',
    planDiff: 39000,
    billNo: 'NET2507-001',
    billPage: '①03',
  },
  {
    paymentNo: 'C2400NTO5',
    round: '1',
    detailNo: 1,
    billName: 'アサヒ飲料 ワンダ 秋のポイント施策',
    billNote: '',
    planExpContent: 'ワンダ',
    product: 'ワンダモーニングショット185g30本',
    payAmount: 58000,
    planAmount: 55000,
    taxClass: '2:課税8%',
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    measureClass: '販売促進',
    measureCode: 'SP001',
    summary1: 'ポイント還元原資（社内）',
    summary2: 'ワンダ ポイント10倍（社外）',
    planDiff: 3000,
    billNo: '457826SA',
    billPage: '①01',
  },
  {
    paymentNo: 'C2400NTO5',
    round: '1',
    detailNo: 2,
    billName: 'アサヒ飲料 三ツ矢サイダー スポット協賛',
    billNote: '',
    planExpContent: '三ツ矢',
    product: '三ツ矢サイダー250mL30本',
    payAmount: 26000,
    planAmount: 26000,
    taxClass: '1:課税10%',
    mgmtClass: '拡売費(固定費)A口',
    mgmtCode: 'FA002',
    measureClass: 'スポット',
    measureCode: 'SS001',
    summary1: 'スポット協賛費（社内）',
    summary2: '三ツ矢サイダー 協賛（社外）',
    planDiff: 0,
    billNo: '457827SA',
    billPage: '①01',
  },
  {
    paymentNo: 'C2400NTO5',
    round: '1',
    detailNo: 3,
    billName: 'アサヒ飲料 十六茶 デジタル広告費',
    billNote: '',
    planExpContent: '十六茶',
    product: '十六茶2L6本',
    payAmount: 44000,
    planAmount: 40000,
    taxClass: '1:課税10%',
    mgmtClass: '拡売費(固定費)B口',
    mgmtCode: 'FB002',
    measureClass: '新規導入',
    measureCode: 'SN003',
    summary1: 'デジタル広告の出稿費（社内）',
    summary2: '十六茶 Web広告（社外）',
    planDiff: 4000,
    billNo: '457828SA',
    billPage: '①02',
  },
  {
    paymentNo: 'C2400NTO5',
    round: '1',
    detailNo: 4,
    billName: 'アサヒ飲料 カルピス 店頭値引き支援',
    billNote: '',
    planExpContent: 'カルピス',
    product: 'カルピスウォーター500mL24本',
    payAmount: 31000,
    planAmount: 35000,
    taxClass: '1:課税10%',
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA002',
    measureClass: '販売促進',
    measureCode: 'SP001',
    summary1: '店頭値引きの支援金（社内）',
    summary2: 'カルピス 店頭値引き（社外）',
    planDiff: -4000,
    billNo: '457829SA',
    billPage: '①02',
  },
  {
    paymentNo: 'C2400NTO5',
    round: '1',
    detailNo: 5,
    billName: 'アサヒ飲料 ワンダ極微糖 NET差額拡売費',
    billNote: '',
    planExpContent: 'ワンダ',
    product: 'ワンダ金の微糖185g30本',
    payAmount: 72000,
    planAmount: 0,
    taxClass: '2:課税8%',
    mgmtClass: '売上連動拡売費B口',
    mgmtCode: 'RB001',
    measureClass: '販売促進',
    measureCode: 'SP002',
    summary1: 'NET差額の自動振替（社内）',
    summary2: 'ネット差額調整（社外）',
    planDiff: 72000,
    billNo: 'NET2508-001',
    billPage: '①03',
  },
  {
    paymentNo: 'C2400NTO5',
    round: '3',
    detailNo: 1,
    billName: 'アサヒ飲料 三ツ矢サイダー 年末店頭企画',
    billNote: '',
    planExpContent: '三ツ矢',
    product: '三ツ矢サイダー500mL24本',
    payAmount: 85000,
    planAmount: 80000,
    taxClass: '1:課税10%',
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    measureClass: '販売促進',
    measureCode: 'SP001',
    summary1: '年末企画の販促費（社内）',
    summary2: '三ツ矢サイダー 年末企画（社外）',
    planDiff: 5000,
    billNo: '457830SA',
    billPage: '①01',
  },
  {
    paymentNo: 'C2400NTO5',
    round: '3',
    detailNo: 2,
    billName: 'アサヒ飲料 ワンダ 年末エンド展開',
    billNote: '',
    planExpContent: 'ワンダ',
    product: 'ワンダ金の微糖185g30本',
    payAmount: 49000,
    planAmount: 49000,
    taxClass: '2:課税8%',
    mgmtClass: '売上連動拡売費B口',
    mgmtCode: 'RB002',
    measureClass: '販売促進',
    measureCode: 'SP003',
    summary1: 'エンド展開の協力費（社内）',
    summary2: 'ワンダ 年末エンド展開（社外）',
    planDiff: 0,
    billNo: '457831SA',
    billPage: '①01',
  },
  {
    paymentNo: 'C2400NTO5',
    round: '3',
    detailNo: 3,
    billName: 'アサヒ飲料 ウィルキンソン クーラー什器費',
    billNote: '',
    planExpContent: 'ウィルキンソン',
    product: 'ウィルキンソン炭酸水500mL24本',
    payAmount: 56000,
    planAmount: 50000,
    taxClass: '1:課税10%',
    mgmtClass: '拡売費(固定費)A口',
    mgmtCode: 'FA002',
    measureClass: 'スポット',
    measureCode: 'SS003',
    summary1: 'クーラー什器の設置費（社内）',
    summary2: 'ウィルキンソン什器設置（社外）',
    planDiff: 6000,
    billNo: '457832SA',
    billPage: '①02',
  },
  {
    paymentNo: 'C2400NTO5',
    round: '3',
    detailNo: 4,
    billName: 'アサヒ飲料 十六茶 リピート販促物',
    billNote: '',
    planExpContent: '十六茶',
    product: '十六茶630mL24本',
    payAmount: 23000,
    planAmount: 25000,
    taxClass: '1:課税10%',
    mgmtClass: '拡売費(固定費)本社口',
    mgmtCode: 'FH002',
    measureClass: 'リピート',
    measureCode: 'SR003',
    summary1: '販促物の制作費（社内）',
    summary2: '十六茶 販促物設置（社外）',
    planDiff: -2000,
    billNo: '457833SA',
    billPage: '①02',
  },
  {
    paymentNo: 'C2400NTO5',
    round: '3',
    detailNo: 5,
    billName: 'アサヒ飲料 カルピス NET差額拡売費',
    billNote: '',
    planExpContent: 'カルピス',
    product: 'カルピスウォーター500mL24本',
    payAmount: 61000,
    planAmount: 0,
    taxClass: '2:課税8%',
    mgmtClass: '売上連動拡売費本社口',
    mgmtCode: 'RH001',
    measureClass: '販売促進',
    measureCode: 'SP002',
    summary1: 'NET差額の自動振替（社内）',
    summary2: 'ネット差額調整（社外）',
    planDiff: 61000,
    billNo: 'NET2510-001',
    billPage: '①03',
  },
];

// 数値表示（カンマ区切り、空は「-」、文字列はそのまま）
const numFmt = (params: { value: unknown }) => {
  const v = params.value;
  if (v === '' || v === null || v === undefined) return GRID_EMPTY_TEXT;
  if (typeof v === 'number')
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(v);
};

// 数値化（空・非数値は0）。負担金額・請求－支払：差額の算出に使う。
const toNum = (value: unknown): number => {
  const n =
    typeof value === 'number'
      ? value
      : parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// ── 明細情報の既定値 ────────────────────────────────────────
// データ元・請求金額・照合支払区分は、値を持つ明細だけが個別に持ち、
// 持たない明細はここで補う（モックデータの記述量を抑えるため）。
//   データ元     … 請求書番号が「NET」始まり（NET差額の自動振替）は手入力、他は画面ごとの既定
//                  （config.defaultDataSource。追加口請求書有＝請求EDI／追加口請求書無＝AIC入力）
//   請求金額     … 支払金額と同額（＝請求と支払が一致。差額が出る明細だけ個別に持つ）
//   照合支払区分 … 「0:照合支払」（一致）
const dataSourceOf = (row: QuoteDetailRow, defaultSource: string): string =>
  row.dataSource ??
  (String(row.billNo).startsWith('NET') ? '手入力' : defaultSource);
const billAmountOf = (row: QuoteDetailRow): number | string =>
  row.billAmount ?? row.payAmount;
const matchTypeOf = (row: QuoteDetailRow): string =>
  row.matchType ?? '0:照合支払';

// 当該明細（親行）に属する分割の枝番行の負担金額の合計。
// 明細行の「負担金額」（支払金額 − 枝番行の合計）の算出に使う。
const branchTotalOf = (row: QuoteDetailRow): number =>
  QUOTE_DETAIL_ROWS.filter(
    (r) =>
      r.isBranch &&
      r.paymentNo === row.paymentNo &&
      r.round === row.round &&
      String(r.detailNo).split('-')[0] === String(row.detailNo)
  ).reduce((sum, r) => sum + toNum(r.splitAmount), 0);

// ── 検索条件（下ペインのヘッダー） ──────────────────────────
// 対象年月の初期値。引用元は前月であることが多いため、基本情報
//（各画面の SearchPane）の対象年月の1か月前を From-To の初期値に置く（各画面がこの関数で求める）。
// ただし2か月に1度・四半期に1度の支払もあるため、任意の月へ変更できる
//（→ 20260814_第28回 決定事項2）。
export const quoteTargetMonthFrom = (basicTargetMonth: string): string =>
  addMonths(toYearMonth(basicTargetMonth), -1);

// 支払先の検索条件の選択肢（支払詳細の支払先と同じ選択肢）。
// 未選択（QUOTE_PAYEE_ALL＝''）＝絞り込まない（「指定なし」）。「全て」の選択肢は持たない（→ 02 §9）。
const PAYEE_ITOCHU = '1001584:伊藤忠食品株式会社東日本営業本部商品部';
const PAYEE_MITSUBISHI = '1001585:三菱食品株式会社';
const PAYEE_KATO = '1001586:加藤産業株式会社';
export const QUOTE_PAYEE_ALL = '';
export const QUOTE_PAYEE_OPTIONS: string[] = [
  PAYEE_ITOCHU,
  PAYEE_MITSUBISHI,
  PAYEE_KATO,
];

// ── 引用元の伝票（支払No＋支払回数）の伝票情報 ──────────────
// 支払Noは商流販売店×対象年月の単位で採番されるため、対象年月は支払Noごとに一意になる。
// config.currentPaymentNo（C2400NTO3 または C2400NTO5）が本画面の支払明細書（基本情報の支払No＝当月）で、
// 他は過去の月の支払明細書。下の表は当月＝C2400NTO3 のときの対象年月で、当月が C2400NTO5 の画面は
// C2400NTO3 と C2400NTO5 の対象年月を入れ替える（quoteTargetMonthOf）。
// 引用元は支払Noで固定せず、対象年月の範囲と支払先で絞り込む
//（支払Noを固定すると対象年月From-Toを広げても他の月の伝票が出てこないため）。
const QUOTE_TARGET_MONTH_BY_PAYMENT_NO: Record<string, string> = {
  C2400NTO1: '2025/06',
  C2400NTO2: '2025/07',
  C2400NTO5: '2025/08',
  C2400NTO4: '2025/09',
  C2400NTO3: '2025/10',
};
const quoteTargetMonthOf = (
  paymentNo: string,
  currentPaymentNo: QuoteSelectionConfig['currentPaymentNo']
): string => {
  const swapped =
    currentPaymentNo === 'C2400NTO5' && /^C2400NTO[35]$/.test(paymentNo)
      ? paymentNo === 'C2400NTO3'
        ? 'C2400NTO5'
        : 'C2400NTO3'
      : paymentNo;
  return QUOTE_TARGET_MONTH_BY_PAYMENT_NO[swapped] ?? '';
};

// 支払先は支払回ごとの情報（支払情報エリアの「支払先」）のため、伝票単位で持つ。
const QUOTE_PAYEE_BY_VOUCHER: Record<string, string> = {
  'C2400NTO1|1': PAYEE_ITOCHU,
  'C2400NTO1|2': PAYEE_MITSUBISHI,
  'C2400NTO2|1': PAYEE_MITSUBISHI,
  'C2400NTO2|2': PAYEE_KATO,
  'C2400NTO2|3': PAYEE_ITOCHU,
  'C2400NTO3|1': PAYEE_ITOCHU,
  'C2400NTO3|2': PAYEE_MITSUBISHI,
  'C2400NTO4|1': PAYEE_ITOCHU,
  'C2400NTO4|2': PAYEE_KATO,
  'C2400NTO5|1': PAYEE_MITSUBISHI,
  'C2400NTO5|3': PAYEE_ITOCHU,
};

// 伝票のキー（支払No｜支払回数）。折りたたみの開閉状態もこのキーで保持する。
const voucherKeyOf = (row: { paymentNo: string; round: string }): string =>
  `${row.paymentNo}|${row.round}`;

// 行ID（AG Grid 公式 getRowId）。伝票行は「支払No|支払回数」、明細行（分割の枝番行を含む）は
// それに明細No（枝番行は「親明細No-枝番」）を付けて一覧全体で一意にする。
// モジュール直下に置いて参照を固定する（→ 02 §7.1）。
const getQuoteRowId = (params: GetRowIdParams<QuoteGridRow>): string => {
  const row = params.data;
  return isVoucherRow(row)
    ? `voucher-${voucherKeyOf(row)}`
    : `detail-${voucherKeyOf(row)}|${row.detailNo}`;
};

// 伝票のキーの一覧（明細から組み立てる。並びは明細の並び順）。
const QUOTE_VOUCHER_KEYS: string[] = [
  ...new Set(QUOTE_DETAIL_ROWS.map(voucherKeyOf)),
];

// 一覧に並べる行を、検索条件（対象年月の範囲・支払先）で絞り込んで組み立てる。
// 伝票行の直下にその伝票の明細行（分割の枝番行を含む）を並べる。
// 並び順は対象年月の降順（直近の伝票を上に出す）、同一年月は支払No・支払回数の昇順。
// ※対象年月は 'YYYY/MM'（ゼロ埋め）のため、文字列比較で範囲判定できる。
const buildQuoteRows = (
  monthFrom: string,
  monthTo: string,
  payee: string,
  currentPaymentNo: QuoteSelectionConfig['currentPaymentNo']
): QuoteGridRow[] => {
  const vouchers = QUOTE_VOUCHER_KEYS.map((key) => {
    const [paymentNo, round] = key.split('|');
    return {
      key,
      paymentNo,
      round,
      targetMonth: quoteTargetMonthOf(paymentNo, currentPaymentNo),
      payee: QUOTE_PAYEE_BY_VOUCHER[key] ?? '',
    };
  })
    .filter(
      (v) =>
        // 空の側（クリアした開始・終了）は絞り込まない（→ 02 §14.1）
        (!monthFrom || v.targetMonth >= monthFrom) &&
        (!monthTo || v.targetMonth <= monthTo) &&
        (payee === QUOTE_PAYEE_ALL || v.payee === payee)
    )
    .sort(
      (a, b) =>
        b.targetMonth.localeCompare(a.targetMonth) ||
        a.paymentNo.localeCompare(b.paymentNo) ||
        Number(a.round) - Number(b.round)
    );

  return vouchers.flatMap((v) => {
    // 行データはモジュール定数を汚さないようコピーして渡す（→ 02 §7.1）。
    const details = QUOTE_DETAIL_ROWS.filter(
      (r) => voucherKeyOf(r) === v.key
    ).map((r) => ({ ...r }));
    const voucherRow: QuoteVoucherRow = {
      isVoucher: true,
      paymentNo: v.paymentNo,
      round: v.round,
      targetMonth: v.targetMonth,
      payee: v.payee,
      detailCount: details.filter((r) => !r.isBranch).length,
      branchCount: details.filter((r) => r.isBranch).length,
    };
    return [voucherRow, ...details];
  });
};

// ── セルの体裁 ──────────────────────────────────────────────
// 参照専用の一覧のため、明細行・枝番行は編集不可色（灰）で統一する。
const READONLY_CELL_STYLE = editableBg(false);
// 伝票行は拡売費一覧のグループ合計行と同じ合計行のスタイル（白・太字・下の濃い線）にして、明細行と見分けられるようにする。
const VOUCHER_CELL_STYLE = totalCellStyle();

type QuoteCellParams = { data?: QuoteGridRow; value?: unknown };

// 分割の枝番行（親行データの再掲行）か判定する。
const isBranchRow = (params: QuoteCellParams) =>
  isDetailRow(params.data) && !!params.data.isBranch;

// 枝番行が親行から継承表示する列（卸からの請求名称・備考・税区分・請求書番号等）。
// 継承表示はグレー文字にする（拡売費一覧の分割先行と同じ体裁）。
const inheritedCellStyle = (params: QuoteCellParams) => {
  if (isVoucherRow(params.data)) return VOUCHER_CELL_STYLE;
  return isBranchRow(params)
    ? { ...READONLY_CELL_STYLE, color: GRID_COLORS.inheritedText }
    : READONLY_CELL_STYLE;
};

// 枝番行が自身の値を持つ列（負担金額・商流・組織・管理／施策・摘要）と、
// 伝票情報・操作の列。継承表示ではないため文字色は通常のままにする。
const ownCellStyle = (params: QuoteCellParams) =>
  isVoucherRow(params.data) ? VOUCHER_CELL_STYLE : READONLY_CELL_STYLE;
const ownNumCellStyle = (params: QuoteCellParams) => ({
  ...ownCellStyle(params),
  textAlign: 'right' as const,
});

// ── 値の取得 ────────────────────────────────────────────────
// 明細情報の値。伝票行は明細情報の列を持たないため空にする。
const detailValueGetter =
  (field: keyof QuoteDetailRow) => (params: QuoteCellParams) =>
    isDetailRow(params.data) ? (params.data[field] ?? '') : '';

// 伝票情報の値。明細行・枝番行は伝票行の下に並ぶため空にする。
const voucherValueGetter =
  (field: keyof QuoteVoucherRow) => (params: QuoteCellParams) =>
    isVoucherRow(params.data) ? (params.data[field] ?? '') : '';

// 枝番行は自身の分割先の値を、明細行は親の値を表示する列（管理／施策・摘要）。
const branchOwnValueGetter =
  (branchField: keyof QuoteDetailRow, parentField: keyof QuoteDetailRow) =>
  (params: QuoteCellParams) => {
    const row = params.data;
    if (!isDetailRow(row)) return '';
    return row.isBranch ? (row[branchField] ?? '') : (row[parentField] ?? '');
  };

// 請求金額：枝番行は請求単位ではないため空白にする（拡売費一覧と同じ）。
const billAmountValueGetter = (params: QuoteCellParams) => {
  const row = params.data;
  if (!isDetailRow(row) || row.isBranch) return '';
  return billAmountOf(row);
};

// 負担金額：枝番行は自身が負担する金額、明細行は支払金額から枝番行の合計を引いた残り。
const chargeAmountValueGetter = (params: QuoteCellParams) => {
  const row = params.data;
  if (!isDetailRow(row)) return '';
  if (row.isBranch) return row.splitAmount ?? '';
  return toNum(row.payAmount) - branchTotalOf(row);
};

// 請求－支払：差額（請求金額 − 支払金額）。枝番行は空白。
const billPayDiffValueGetter = (params: QuoteCellParams) => {
  const row = params.data;
  if (!isDetailRow(row) || row.isBranch) return '';
  return toNum(billAmountOf(row)) - toNum(row.payAmount);
};

// 明細情報の列数。伝票行の「明細 N件」を明細情報の列いっぱいに表示する
//（colSpan）ために使う。明細情報の列を増減したらこの値も合わせる。
const detailColumnCount = (showDataSourceAndNote: boolean): number =>
  showDataSourceAndNote ? 29 : 27;

// No. 列の値。伝票行は明細の件数を明細情報の列いっぱいに表示する。
const detailNoValueGetter = (params: QuoteCellParams) => {
  const row = params.data;
  if (isVoucherRow(row)) {
    return row.branchCount > 0
      ? `明細 ${row.detailCount}件（うち分割の枝番 ${row.branchCount}行）`
      : `明細 ${row.detailCount}件`;
  }
  return isDetailRow(row) ? row.detailNo : '';
};

// ── セル・ヘッダーの部品 ────────────────────────────────────
// 伝票行の選択ラジオ。引用元は伝票単位で1件のみ選ぶ（明細単位では選ばせない）。
// 選んだ伝票の明細すべては、ペインタイトル右の「引用」で引用する
//（→ 20260814_第28回 決定事項3・4）。
const SelectVoucherCellRenderer = (props: ICellRendererParams) => {
  const row = props.data as QuoteGridRow | undefined;
  if (!isVoucherRow(row)) return null;
  const { isVoucherSelected, onSelectVoucher } = props.context;
  const label = `引用元にする：${row.paymentNo} ${row.round}回目`;
  return (
    <div className="flex h-full items-center justify-center">
      <input
        type="radio"
        name="quote-source-voucher"
        checked={isVoucherSelected(row)}
        onChange={() => onSelectVoucher(row)}
        className="h-4 w-4 cursor-pointer accent-blue-600 focus:ring-2 focus:ring-blue-500"
        aria-label={label}
        title={label}
      />
    </div>
  );
};

// 折りたたみ機能列のヘッダー。押下で伝票行を一括開閉する
//（全て展開中なら全て折りたたみ、それ以外は全て展開）。
// アイコンは開閉を表す ChevronsUpDown とし、セル側のボタンと同じ幅（w-5）で縦位置をそろえる。
// 対象の伝票が1件も無い場合は非活性（灰）にする。
const VoucherCollapseHeader = (props: IHeaderParams) => {
  // ヘッダーは生成時の params を保持し続けるため、params.context では古い関数を
  // 参照することがある。AG Grid 公式の getGridOption で常に最新の context を読む。
  const { hasVoucher, isAllVouchersExpanded, onToggleAllVouchers } =
    props.api.getGridOption('context') ?? props.context;
  const enabled = hasVoucher();
  const expanded = enabled && isAllVouchersExpanded();
  const action = `伝票の明細を全て${expanded ? '折りたたむ' : '展開'}`;
  return (
    <div className="flex h-full w-full items-center justify-start">
      <button
        type="button"
        disabled={!enabled}
        onClick={() => onToggleAllVouchers()}
        className={`flex h-5 w-5 items-center justify-center rounded focus:ring-2 focus:ring-blue-500 focus:outline-none ${
          enabled
            ? 'text-blue-600 hover:bg-gray-200'
            : 'cursor-not-allowed text-gray-400'
        }`}
        aria-expanded={expanded}
        aria-label={enabled ? action : '引用元の伝票なし'}
        title={enabled ? action : '引用元の伝票なし'}
      >
        <ChevronsUpDown className="h-4 w-4" />
      </button>
    </div>
  );
};

// 伝票行の折りたたみボタン（伝票行の左端）。押下でその伝票の明細行を開閉する。
// アイコンは拡売費一覧の折りたたみ機能列と同じく ChevronDown を使い、
// 「∨」＝折りたたみ中（明細を隠している）、「∧」（180度回転）＝展開中とする。
// 明細行・枝番行には表示しない。
const VoucherCollapseCellRenderer = (props: ICellRendererParams) => {
  const row = props.data as QuoteGridRow | undefined;
  if (!isVoucherRow(row)) return null;
  const { isVoucherExpanded, onToggleVoucher } = props.context;
  const collapsed = !isVoucherExpanded(row);
  const action = `伝票の明細を${collapsed ? '展開' : '折りたたむ'}`;
  return (
    <div className="flex h-full items-center justify-center">
      <button
        type="button"
        onClick={() => onToggleVoucher(row)}
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

// 画面ごとの違い（各画面のモジュール直下の定数で渡す。参照を固定して列定義を作り直さない → 02 §7.1）
export interface QuoteSelectionConfig {
  // 列状態の保存キー（画面ごとに一意。列を変更したら版数を上げて旧状態を破棄する）
  columnStateKey: string;
  // データ元の既定（請求書番号が「NET」始まり以外の明細）。null＝請求EDIを介さない画面のため、
  // データ元・備考の列を出さない（拡売費一覧と同じ扱い）
  defaultDataSource: '請求EDI' | 'AIC入力' | null;
  // 本画面の支払明細書（基本情報の支払No＝当月）
  currentPaymentNo: 'C2400NTO3' | 'C2400NTO5';
  // 案内文の最後の文（引用した明細の計画金額の扱い）
  guidanceNote: string;
}

export interface QuoteSelectionPaneHandle {
  // 「引用」ボタン（ペインタイトル右）から呼ぶ。
  // ラジオで選んだ伝票の明細すべてを親へ渡す。
  apply: () => void;
}

interface QuoteSelectionPaneProps {
  // 明細行の商流・組織列に表示する基本情報の値（拡売費一覧へ渡すものと同じ値）。
  basicInfo: ExpenseBasicInfo;
  // 検索条件（下ペインのヘッダーで指定する対象年月の範囲・支払先）。
  monthFrom: string;
  monthTo: string;
  payee: string;
  // 「引用」で確定した明細（選んだ伝票の明細すべて）を親へ通知する。
  onApply?: (rows: QuoteDetailRow[]) => void;
  // 画面ごとの違い
  config: QuoteSelectionConfig;
}

export const QuoteSelectionPane = forwardRef<
  QuoteSelectionPaneHandle,
  QuoteSelectionPaneProps
>(function QuoteSelectionPane(
  {
    basicInfo,
    monthFrom,
    monthTo,
    payee,
    onApply,
    config,
  }: QuoteSelectionPaneProps,
  ref
) {
  const gridApiRef = useRef<GridApi | null>(null);

  // 列幅・ソート・列固定の永続化（列の並び替えは suppressMovableColumns で不可）。
  // ※保存済み列状態の復元で列構成が崩れるため、列を変更したらキーの版数を上げて
  //   旧状態を破棄する（キーと版数は画面ごとの config.columnStateKey）。
  const gridColumnStateProps = useGridColumnState(config.columnStateKey, {
    onGridReady: (event: GridReadyEvent) => {
      gridApiRef.current = event.api;
      // 伝票行の直下に明細行を並べる階層表示のため、初期表示では列のソートを
      // 常に解除する（保存済みの列状態にソートが残っていると並びが崩れるため）。
      event.api.applyColumnState({ defaultState: { sort: null } });
    },
  });

  // 明細行の商流・組織列は画面の基本情報を表示する。列定義は作り直さず ref から読む（→ 02 §7.1）。
  const basicInfoRef = useRef(basicInfo);
  basicInfoRef.current = basicInfo;

  // 一覧に並べる行（検索条件で絞り込んだ伝票行＋その明細行）。
  const rows = useMemo(
    () => buildQuoteRows(monthFrom, monthTo, payee, config.currentPaymentNo),
    [monthFrom, monthTo, payee, config.currentPaymentNo]
  );
  // データ元・備考の列を出すか（請求EDIを介さない画面は出さない）
  const showDataSourceAndNote = config.defaultDataSource !== null;
  const defaultDataSource = config.defaultDataSource ?? '';
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // 表示中の伝票のキー一覧（ヘッダーの一括開閉で使う）。
  const voucherKeys = useMemo(
    () => rows.filter(isVoucherRow).map(voucherKeyOf),
    [rows]
  );
  const voucherKeysRef = useRef(voucherKeys);
  voucherKeysRef.current = voucherKeys;

  // 伝票の折りたたみ。既定は全て折りたたみ（伝票行だけが並ぶ）ため、
  // 折りたたみ中ではなく展開中の伝票のキーを保持する。
  // 表示の切り替えは外部フィルタで行い、行はモデルに保持したままにする
  //（折りたたみ中の伝票でも「選択」で明細すべてを引用できる）。
  const [expandedVouchers, setExpandedVouchers] = useState<Set<string>>(
    new Set()
  );
  const expandedVouchersRef = useRef(expandedVouchers);
  useEffect(() => {
    expandedVouchersRef.current = expandedVouchers;
    gridApiRef.current?.onFilterChanged();
    // ボタンのアイコン（「∨」／「∧」）を現在の開閉状態に合わせて描き替える。
    gridApiRef.current?.refreshCells({
      columns: ['voucherCollapse'],
      force: true,
    });
    // ヘッダーのアイコン（一括開閉）も現在の開閉状態に合わせて描き替える。
    gridApiRef.current?.refreshHeader();
  }, [expandedVouchers]);

  // 検索条件の変更で伝票が増減したら、ヘッダーのアイコンの活性／非活性を描き替える。
  useEffect(() => {
    gridApiRef.current?.refreshHeader();
  }, [rows]);

  // 折りたたみの開閉を切り替える（伝票行のボタン押下）。
  const handleToggleVoucher = (row: QuoteVoucherRow) => {
    const key = voucherKeyOf(row);
    setExpandedVouchers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ヘッダーのアイコン押下：伝票の明細を一括で開閉する。
  // 全ての伝票が展開中なら全て折りたたみ、それ以外（一部のみ／全て折りたたみ）は全て展開する。
  const handleToggleAllVouchers = () => {
    const keys = voucherKeysRef.current;
    if (keys.length === 0) return;
    setExpandedVouchers((prev) => {
      const allExpanded = keys.every((key) => prev.has(key));
      const next = new Set(prev);
      if (allExpanded) keys.forEach((key) => next.delete(key));
      else keys.forEach((key) => next.add(key));
      return next;
    });
  };

  // ラジオで選んだ引用元の伝票（キー＝支払No｜支払回数）。初期値は未選択。
  const [selectedVoucherKey, setSelectedVoucherKey] = useState('');
  const selectedVoucherKeyRef = useRef(selectedVoucherKey);
  useEffect(() => {
    selectedVoucherKeyRef.current = selectedVoucherKey;
    // ラジオのチェック状態を描き替える。
    gridApiRef.current?.refreshCells({
      columns: ['selectQuote'],
      force: true,
    });
  }, [selectedVoucherKey]);

  // 検索条件を変えて選択中の伝票が一覧から消えたら、選択を解除する。
  useEffect(() => {
    if (selectedVoucherKey && !voucherKeys.includes(selectedVoucherKey)) {
      setSelectedVoucherKey('');
    }
  }, [voucherKeys, selectedVoucherKey]);

  // 伝票行のラジオ選択：引用元の伝票を1件に確定する（引用の実行は行わない）。
  const handleSelectVoucher = (row: QuoteVoucherRow) => {
    setSelectedVoucherKey(voucherKeyOf(row));
  };

  // 「引用」：選んだ伝票の明細すべて（分割の枝番行を含む）を親へ渡す。
  // 折りたたみ中でも行はモデルに保持しているため、展開しなくても引用できる
  //（→ 20260814_第28回 決定事項4）。
  useImperativeHandle(ref, () => ({
    apply: () => {
      const key = selectedVoucherKeyRef.current;
      if (!key) {
        toast.error('引用元の伝票を選択してください。');
        return;
      }
      onApply?.(
        rowsRef.current.filter(
          (r): r is QuoteDetailRow => isDetailRow(r) && voucherKeyOf(r) === key
        )
      );
    },
  }));

  // 列定義・context は作り直さず、最新のハンドラを ref 経由で呼ぶ（→ 02 §7.1）。
  const handlersRef = useRef({
    select: handleSelectVoucher,
    toggle: handleToggleVoucher,
    toggleAll: handleToggleAllVouchers,
  });
  handlersRef.current = {
    select: handleSelectVoucher,
    toggle: handleToggleVoucher,
    toggleAll: handleToggleAllVouchers,
  };
  const gridContext = useMemo(
    () => ({
      // 伝票行の選択ラジオから参照する。
      onSelectVoucher: (row: QuoteVoucherRow) =>
        handlersRef.current.select(row),
      isVoucherSelected: (row: QuoteVoucherRow) =>
        selectedVoucherKeyRef.current === voucherKeyOf(row),
      // 折りたたみボタン（伝票行の左端）・ヘッダー（一括開閉）から参照する。
      onToggleVoucher: (row: QuoteVoucherRow) =>
        handlersRef.current.toggle(row),
      onToggleAllVouchers: () => handlersRef.current.toggleAll(),
      isVoucherExpanded: (row: QuoteVoucherRow) =>
        expandedVouchersRef.current.has(voucherKeyOf(row)),
      hasVoucher: () => voucherKeysRef.current.length > 0,
      isAllVouchersExpanded: () =>
        voucherKeysRef.current.length > 0 &&
        voucherKeysRef.current.every((key) =>
          expandedVouchersRef.current.has(key)
        ),
    }),
    []
  );

  // 外部フィルタ：明細行は、伝票行で展開中のもののみ表示する（既定は折りたたみ）。
  const isExternalFilterPresent = () => true;
  const doesExternalFilterPass = (node: { data?: QuoteGridRow }) => {
    const row = node.data;
    if (!row || isVoucherRow(row)) return true;
    return expandedVouchersRef.current.has(voucherKeyOf(row));
  };

  // 商流・組織の列（販売店〜担当者）。枝番行は分割先の値、明細行は画面の基本情報を表示する
  //（拡売費一覧と同じ表示）。
  const storeOrgValueGetter =
    (branchField: keyof QuoteDetailRow, key: keyof ExpenseBasicInfo) =>
    (params: QuoteCellParams) => {
      const row = params.data;
      if (!isDetailRow(row)) return '';
      return row.isBranch
        ? (row[branchField] ?? '')
        : basicInfoRef.current[key];
    };

  // 列定義。操作（選択・折りたたみ）と伝票情報を左に固定し、その右へ明細情報を並べる。
  // 明細情報の列・順序・幅は拡売費一覧（PaymentNonProductExpensePane）にそろえる。
  const columnDefs: ColDef[] = useMemo(
    () => [
      {
        // 選択：引用元の伝票を1件だけ選ぶラジオ。伝票行にのみ表示する。
        // 幅はラジオ（1rem）とセル左右の余白が収まる最小限にとどめる。
        headerName: '',
        // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
        suppressColumnsToolPanel: true,
        colId: 'selectQuote',
        width: 45,
        minWidth: 45,
        maxWidth: 45,
        lockPinned: true,
        sortable: false,
        filter: false,
        resizable: false,
        suppressAutoSize: true,
        cellRenderer: SelectVoucherCellRenderer,
        cellStyle: ownCellStyle,
      },
      {
        // 伝票の折りたたみボタン。伝票行にのみ表示し、押下で明細行を開閉する。
        // 幅はボタン（w-5＝1.25rem）とセル左右の余白が収まる最小限にとどめる
        //（拡売費一覧の折りたたみ機能列と同じ幅）。
        headerName: '',
        // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
        suppressColumnsToolPanel: true,
        headerComponent: VoucherCollapseHeader,
        colId: 'voucherCollapse',
        width: 32,
        minWidth: 32,
        maxWidth: 32,
        lockPinned: true,
        sortable: false,
        filter: false,
        resizable: false,
        suppressAutoSize: true,
        cellRenderer: VoucherCollapseCellRenderer,
        cellStyle: ownCellStyle,
      },
      // ── 伝票情報（伝票行のみ値を持つ） ────────────────
      {
        headerName: '支払先',
        colId: 'payee',
        width: 192,
        valueGetter: voucherValueGetter('payee'),
        cellStyle: ownCellStyle,
      },
      {
        headerName: '対象年月',
        colId: 'targetMonth',
        ...GRID_MONTH_TEXT_FILTER,
        width: 80,
        valueGetter: voucherValueGetter('targetMonth'),
        cellStyle: ownCellStyle,
      },
      {
        // 支払Noは支払回数の左に置く（対象年月ごとに採番される伝票の識別子）。
        headerName: '支払No',
        colId: 'paymentNo',
        width: 104,
        valueGetter: voucherValueGetter('paymentNo'),
        cellStyle: ownCellStyle,
      },
      {
        headerName: '支払回数',
        colId: 'round',
        ...GRID_NUMBER_TEXT_FILTER,
        width: 72,
        valueGetter: voucherValueGetter('round'),
        cellStyle: ownNumCellStyle,
      },
      // ── 明細情報（拡売費一覧と同じ列構成） ──────────────────
      {
        // No.：分割の枝番行は「親No.-枝番」（例「1-1」）。
        // 伝票行は明細の件数を明細情報の列いっぱいに表示する。
        headerName: 'No.',
        colId: 'detailNo',
        width: 80,
        valueGetter: detailNoValueGetter,
        colSpan: (params: QuoteCellParams) =>
          isVoucherRow(params.data)
            ? detailColumnCount(showDataSourceAndNote)
            : 1,
        cellStyle: ownCellStyle,
      },
      // 請求EDIを介さない画面（defaultDataSource が null）は、データ元・備考の列を出さない（拡売費一覧と同じ扱い）。
      ...(showDataSourceAndNote
        ? [
            {
              headerName: 'データ元',
              colId: 'dataSource',
              width: 80,
              valueGetter: (params: QuoteCellParams) =>
                isDetailRow(params.data)
                  ? dataSourceOf(params.data, defaultDataSource)
                  : '',
              cellStyle: inheritedCellStyle,
            },
          ]
        : []),
      {
        // 商品名・備考は請求EDI・請求詳細から連携された値をそのまま表示する
        //（→ 20260821_第31回 決定事項8）。
        headerName: '卸からの請求名称',
        colId: 'billName',
        width: 192,
        valueGetter: detailValueGetter('billName'),
        cellStyle: inheritedCellStyle,
      },
      ...(showDataSourceAndNote
        ? [
            {
              headerName: '備考',
              colId: 'billNote',
              width: 192,
              valueGetter: detailValueGetter('billNote'),
              cellStyle: inheritedCellStyle,
            },
          ]
        : []),
      {
        // 項目名は拡売費計画に合わせる（→ 20260821_第31回 決定事項7）。
        headerName: 'メタブランド',
        colId: 'planExpContent',
        width: 192,
        valueGetter: detailValueGetter('planExpContent'),
        cellStyle: inheritedCellStyle,
      },
      {
        // 項目名は拡売費計画に合わせる（→ 20260821_第31回 決定事項7）。
        headerName: 'サマリ商品',
        colId: 'product',
        width: 176,
        valueGetter: detailValueGetter('product'),
        cellStyle: inheritedCellStyle,
      },
      {
        headerName: '請求金額',
        colId: 'billAmount',
        ...GRID_NUMBER_TEXT_FILTER,
        width: 96,
        valueGetter: billAmountValueGetter,
        valueFormatter: numFmt,
        cellStyle: ownNumCellStyle,
      },
      {
        // 枝番行は空白（枝番行の金額は「負担金額」で表す）。
        headerName: '支払金額',
        colId: 'payAmount',
        ...GRID_NUMBER_TEXT_FILTER,
        width: 96,
        valueGetter: detailValueGetter('payAmount'),
        valueFormatter: numFmt,
        cellStyle: ownNumCellStyle,
      },
      {
        // 負担金額：枝番行は自身が負担する金額、明細行は分割後の残り。
        headerName: '負担金額',
        colId: 'chargeAmount',
        ...GRID_NUMBER_TEXT_FILTER,
        width: 96,
        valueGetter: chargeAmountValueGetter,
        valueFormatter: numFmt,
        cellStyle: ownNumCellStyle,
      },
      {
        headerName: '請求－支払：差額',
        colId: 'billPayDiff',
        ...GRID_NUMBER_TEXT_FILTER,
        width: 104,
        valueGetter: billPayDiffValueGetter,
        valueFormatter: numFmt,
        cellStyle: ownNumCellStyle,
      },
      {
        headerName: '照合支払区分',
        colId: 'matchType',
        width: 104,
        valueGetter: (params: QuoteCellParams) =>
          isDetailRow(params.data) ? matchTypeOf(params.data) : '',
        cellStyle: inheritedCellStyle,
      },
      // ── 商流・組織（販売店〜担当者）──────────────────────
      // 明細行は画面の基本情報の値、枝番行は分割先ごとの値を表示する。
      {
        headerName: '販売店',
        colId: 'store',
        width: 160,
        valueGetter: storeOrgValueGetter('splitStore', 'store'),
        cellStyle: ownCellStyle,
      },
      {
        headerName: '三次店',
        colId: 'tertiaryStore',
        width: 160,
        valueGetter: storeOrgValueGetter('splitTertiaryStore', 'tertiaryStore'),
        cellStyle: ownCellStyle,
      },
      {
        headerName: '一次店',
        colId: 'primaryStore',
        width: 176,
        valueGetter: storeOrgValueGetter('splitPrimaryStore', 'primaryStore'),
        cellStyle: ownCellStyle,
      },
      {
        headerName: '費用負担部署',
        colId: 'dept',
        width: 160,
        valueGetter: storeOrgValueGetter('splitDept', 'dept'),
        cellStyle: ownCellStyle,
      },
      {
        headerName: '営業担当者',
        colId: 'staff',
        width: 128,
        valueGetter: storeOrgValueGetter('splitStaff', 'staff'),
        cellStyle: ownCellStyle,
      },
      // ── 管理区分・施策区分（区分値と名称の2列構成）────────────
      {
        // 管理区分は名称を保持し、区分値（コード）は名称から導出表示する（拡売費一覧と同一）。
        headerName: '管理区分',
        colId: 'mgmtClassCode',
        width: 104,
        valueGetter: branchOwnValueGetter('splitMgmtClass', 'mgmtClass'),
        valueFormatter: (p) => managementClassCode(p.value) || GRID_EMPTY_TEXT,
        cellStyle: ownCellStyle,
      },
      {
        headerName: '管理区分名称',
        colId: 'mgmtClassName',
        width: 160,
        valueGetter: branchOwnValueGetter('splitMgmtClass', 'mgmtClass'),
        cellStyle: ownCellStyle,
      },
      {
        headerName: '管理コード',
        colId: 'mgmtCodeCode',
        width: 104,
        valueGetter: branchOwnValueGetter('splitMgmtCode', 'mgmtCode'),
        cellStyle: ownCellStyle,
      },
      {
        headerName: '管理コード名称',
        colId: 'mgmtCodeName',
        width: 160,
        valueGetter: branchOwnValueGetter('splitMgmtCode', 'mgmtCode'),
        valueFormatter: (p) => managementCodeName(p.value) || GRID_EMPTY_TEXT,
        cellStyle: ownCellStyle,
      },
      {
        // 施策区分は名称を保持し、区分値（コード）は名称から導出表示する（拡売費一覧と同一）。
        headerName: '施策区分',
        colId: 'measureClassCode',
        width: 88,
        valueGetter: branchOwnValueGetter('splitMeasureClass', 'measureClass'),
        valueFormatter: (p) => campaignClassCode(p.value) || GRID_EMPTY_TEXT,
        cellStyle: ownCellStyle,
      },
      {
        headerName: '施策区分名称',
        colId: 'measureClassName',
        width: 120,
        valueGetter: branchOwnValueGetter('splitMeasureClass', 'measureClass'),
        cellStyle: ownCellStyle,
      },
      {
        headerName: '施策コード',
        colId: 'measureCodeCode',
        width: 104,
        valueGetter: branchOwnValueGetter('splitMeasureCode', 'measureCode'),
        cellStyle: ownCellStyle,
      },
      {
        headerName: '施策コード名称',
        colId: 'measureCodeName',
        width: 152,
        valueGetter: branchOwnValueGetter('splitMeasureCode', 'measureCode'),
        valueFormatter: (p) => campaignCodeNameOf(p.value) || GRID_EMPTY_TEXT,
        cellStyle: ownCellStyle,
      },
      // 稟議番号・稟議決裁日・稟議区分は項目として設けない（→ 課題 No.1128）。
      // 勘定科目別金額は項目として設けない（→ 課題 No.1129）。
      {
        headerName: '摘要1（社内用）',
        colId: 'summary1',
        width: 128,
        valueGetter: branchOwnValueGetter('splitSummary1', 'summary1'),
        cellStyle: ownCellStyle,
      },
      {
        headerName: '摘要2（社外用）',
        colId: 'summary2',
        width: 128,
        valueGetter: branchOwnValueGetter('splitSummary2', 'summary2'),
        cellStyle: ownCellStyle,
      },
      {
        headerName: '税区分',
        colId: 'taxClass',
        width: 104,
        valueGetter: detailValueGetter('taxClass'),
        cellStyle: inheritedCellStyle,
      },
      {
        headerName: '請求書番号',
        colId: 'billNo',
        width: 104,
        valueGetter: detailValueGetter('billNo'),
        cellStyle: inheritedCellStyle,
      },
      {
        headerName: '請求書ページ',
        colId: 'billPage',
        width: 88,
        valueGetter: detailValueGetter('billPage'),
        cellStyle: inheritedCellStyle,
      },
    ],
    [showDataSourceAndNote, defaultDataSource]
  );

  const defaultColDef: ColDef = useMemo(
    () => ({
      // 共通の既定列定義（grid/）。ソート/リサイズ/フィルター、ヘッダーの…メニュー・
      // フィルターボタン非表示、tooltip を内包。フィルターは右クリックメニューから開く。
      ...GRID_DEFAULT_COL_DEF,
      cellDataType: false,
    }),
    []
  );

  // 一覧のみの構成（カード枠は持たない）。どの操作で何が起きるかが押す前に分かるよう、
  // グリッドの上に操作の流れを書く（拡売費計画引用・販売計画選択の下ペインと同じ体裁）。
  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-sm leading-normal text-gray-700">
        引用元にする伝票を左端のラジオで1件選び、右上の「引用」を押すと、
        その伝票の明細すべて（費用分割の枝番行を含む）を新しい支払回へ引用します。
        ラジオの右の折りたたみボタンで、伝票の明細を開いて確認できます。
        {config.guidanceNote}
      </p>
      <div className="quote-selection-grid min-h-0 w-full flex-1">
        <AgGridReact
          rowData={rows}
          getRowId={getQuoteRowId}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getContextMenuItems={gridFilterContextMenuItems}
          // 選択ラジオ・折りたたみボタンのセルから操作時の処理を呼ぶ。
          context={gridContext}
          isExternalFilterPresent={isExternalFilterPresent}
          doesExternalFilterPass={doesExternalFilterPass}
          suppressMovableColumns={true}
          // 横スクロールバーを常時表示する（列数が多く、左右スクロールでの確認が必須のため）。
          alwaysShowHorizontalScroll={true}
          ensureDomOrder={true}
          statusBar={GRID_STATUS_BAR}
          {...GRID_BASE_PROPS}
          {...gridColumnStateProps}
        />
      </div>
    </div>
  );
});
