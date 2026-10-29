// Todo：朴：C追加口・拡売費支払モック修正中
import {
  useMemo,
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import type {
  CellValueChangedEvent,
  CellMouseOverEvent,
  GetRowIdParams,
  GridReadyEvent,
  GridApi,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import {
  SingleComboboxCellEditor,
  toComboOptions,
} from '../../../ui/single-combobox-cell-editor';
import { CollapsibleCard } from '../../../ui/collapsible-card';
import { Redo2 } from 'lucide-react';
import { DropdownMenuItem } from '../../../ui/dropdown-menu';
import { SplitPresenceBadge } from '../../../shared/PaymentStatusIcons';
import { CARD_TITLE_CLASS } from '../../../../../styles/commonStyles';
import {
  GRID_DEFAULT_COL_DEF,
  GRID_BASE_PROPS,
  GRID_STATUS_BAR,
  GRID_COLORS,
  changedCellStyle,
  gridFilterContextMenuItems,
  useGridColumnState,
  useChangedCells,
  useRevealNewRows,
  CellColorLegend,
  RowActionMenu,
  GRID_NUMBER_TEXT_FILTER,
  GRID_NUMBER_FILTER,
  GRID_EMPTY_TEXT,
} from '../../../grid';
import type { CellColorLegendItem } from '../../../grid';
import {
  DEFAULT_DATA_SOURCE,
  type DataSource,
} from '../../../../constants/dataSource';
import {
  BILL_RETAILER_NAME,
  ENTRY_PRODUCT_CODE_BY_NAME,
  centerFeeRateOf,
  createWithInvoiceEntryRows,
  entryPlanOf,
  withInvoiceMasterValuesOf,
} from '../../../../constants/paymentWithInvoiceMockData';
import {
  netUnapprovedLinkOf,
  type NetUnapprovedLink,
} from '../../../../utils/netUnapprovedLink';
import {
  applyEntryCellEdit,
  calcEntryAmount,
  computeEntryCenterFeeTotal,
  calcEntryUnitPrice,
  isSameEntryNumber,
  isEntryAlertRow,
  isEntryCellEditable,
  recalcEntryRow,
  toEntryNumber as toNum,
  type PlanType,
} from '../../../../utils/additionalEntryRules';
import { computeEntryBreakdown } from '../../../../utils/paymentBreakdownItems';
import { MATCH_PAYMENT_TYPE_OPTIONS } from '../../../../constants/matchPaymentType';
import { SUMMARY_PRODUCT_OPTIONS } from '../../../../constants/productMasters';
import { deriveExternalUnitPrice } from '../../../../utils/externalUnitPrice';
import type { AmountBreakdown } from '../../../../utils/paymentAmountBreakdown';
import { PaymentAmountBreakdownTable } from '../../../shared/PaymentAmountBreakdownTable';

// 追加口明細データ（請求情報・支払情報・請求-支払・NET）
// 支払回数ごとのデータセットを親（PaymentDetailWithInvoice）が保持するため export する。
export interface AdditionalEntryData {
  isTotal?: boolean;
  lineNo: number | string;
  // データ元（請求EDI／AIC入力／手入力）。合計行は持たない（空白表示）。
  // 請求EDI・AIC入力の明細は、項目を手で直すと手入力に変わる（→ utils/paymentDataSource）。
  dataSource?: DataSource;
  // 手で直す前の元のデータ元。活性は元のデータ元で決める（表示・集計は dataSource）。
  originDataSource?: DataSource;
  // 紐づく計画行を作った方法（一般卸メッシュ／サマリ商品）。計画に無いサマリ商品は持たない。
  // 赤表示と一般卸メッシュの自動振替の判定に使う（→ utils/additionalEntryRules）。
  planType?: PlanType;
  // 手入力の明細でバラ単価・金額を手で直したか（直した値を計算で上書きしない → applyEntryCellEdit）。
  unitPriceManual?: boolean;
  amountManual?: boolean;
  productCode: string;
  productName: string;
  // 請求情報
  capacity: number | string; // 入数
  cases: number | string; // ケース
  loose: number | string; // バラ
  unitPrice: number | string; // バラ単価
  amount: number | string; // 金額
  // 支払情報
  payCases: number | string; // ケース
  payLoose: number | string; // バラ
  addUnit: number | string; // 追加口バラ単価
  expUnit: number | string; // 拡売費バラ単価（NET未承認）
  addAmount: number | string; // 追加口金額
  expAmount: number | string; // 拡売費金額（NET未承認）
  payAmount: number | string; // 支払金額
  // 請求-支払
  diff: number | string; // 差額
  matchType: string; // 照合支払区分
  expProcess: string; // 拡売費処理
  // NET
  seihan: number | string; // 生販
  planNet: number | string; // 計画NET
  // センターフィ率（計画情報。画面の列には出さず裏で持つダミー値 → centerFeeRateOf）。
  // センターフィ額＝社外売上高単価×数量×センターフィ率（→ computeCenterFeeAmount）。
  centerFeeRate?: number | '';
  billNet: number | string; // 請求NET
  addNet: number | string; // 支払NET（追加口分）
  payNet: number | string; // 支払NET（全体）
  billDetailNo: string; // 請求明細番号（拡売費明細の同名の項目と対応する）
  billPage: string; // 請求書ページ
  retailerName: string; // 販売店名（請求書明細から引き継ぐ表示専用項目）
  // 拡売費明細から「追加口処理」で移してきた明細。一覧が切り替わったことが分かるよう、
  // 入力セルの背景を薄い紫（GRID_COLORS.transferredBg）にする。
  fromExpense?: boolean;
  summary1?: string; // 摘要1（社内用）
  summary: string; // 摘要2（社外用）
  funcCheck: boolean | string; // 函数無効チェック
  finalNet: number | string; // 最終NET（函数無効チェックONのときに手入力する確定NET）
}

// 明細追加ペインの入力値（追加口グリッドで編集できる列＋起点となるサマリ商品名）。
export interface EntryFormValues {
  productName: string; // サマリ商品名
  payCases: string; // 支払ケース
  payLoose: string; // 支払バラ
  addNet: string; // 支払NET（追加口分）
  payNet: string; // 支払NET（全体）
  matchType: string; // 照合支払区分
  expProcess: string; // 拡売費処理
  summary1: string; // 摘要1（社内用）
  summary2: string; // 摘要2（社外用）
  funcCheck: boolean; // 函数無効チェック
  finalNet: string; // 最終NET（函数無効チェックONのときに手入力する確定NET）
  billNet: string; // 請求NET（担当者が請求書を見て入力する → 補足1-5 b24.t7）
  cases: string; // ケース（請求）
  loose: string; // バラ（請求）
  // バラ単価（請求）・金額（請求）。ペインは計算した値を初めから表示し、手で直せる
  //（→ updateEntryBillingDraft）。手で直したかを unitPriceManual・amountManual で渡す。
  unitPrice: string;
  amount: string;
  // 手で直したか。省略時は、値が入っていれば手で直した値とみなす。どちらの場合も、
  // 計算した値と同じなら手で直した値として扱わない（→ createManualEntryRow）。
  unitPriceManual?: boolean;
  amountManual?: boolean;
  billPage: string; // 請求書ページ
  billDetailNo: string; // 請求明細番号
  retailerName: string; // 販売店名
}

export interface DetailTableHandle {
  // 拡売費一覧の「追加口処理」ボタンから呼ばれ、「拡売費処理／に移動」で外した明細を
  // そのまま追加口明細へ戻す（移動時の行データを親が保持して渡す）。
  restoreEntry: (row: AdditionalEntryData) => void;
  // 拡売費一覧の「追加口処理」ボタンから呼ばれ、当該明細を追加口明細として1行追加する。
  // 追加口から移した明細（拡売費処理）ではなく、拡売費一覧で作られた明細が対象。
  addFromExpense: (item: {
    productName: string;
    billAmount: number | string;
    payAmount: number | string;
    matchType?: string;
    summary1?: string;
    summary2?: string;
    // 拡売費明細から引き継ぐ請求書情報（追加口明細では billDetailNo／billPage に入る）。
    billNo?: string;
    billPage?: string;
  }) => void;
  // 「明細追加」ペインの「追加」から呼ばれ、入力値をもとに明細を1行足す。
  addManualRow: (values: EntryFormValues) => void;
}

// 追加口カードから親へ通知する集計（合計表の追加口計と、支払情報サマリのセンターフィ額）。
// 合計表のセンターフィは請求詳細のセンターフィから求めるため、ここでは通知しない（→ 親の page.tsx）。
export interface EntryBreakdowns {
  entry: AmountBreakdown;
  // 支払情報サマリのセンターフィ額（この支払回分）＝追加口明細の社外売上高単価×数量×センターフィ率の合計。
  centerFeeAmount: number;
}

interface DetailTableProps {
  // 合計表（追加口計）とサマリのセンターフィ額の変更通知。親が支払情報カードの合計表・支払情報サマリへ渡す。
  onBreakdownChange?: (breakdowns: EntryBreakdowns) => void;
  // タイトル右の「明細追加」ボタン押下（追加口の明細追加ペインを開く）。
  onOpenAddDetail?: () => void;
  // タイトル右の［追加口分割］ボタン押下（分割先商流販売店の選択ペインを開く）。
  // 申請後も押せる（参照のみで開くかは親が支払ステータスで決める → 第33回 決定事項16）。
  onOpenSplit?: () => void;
  // 当該支払回の追加口に分割があるか。タイトル横に「分割あり／分割なし」を出す。
  // 明細グリッドの値は分割しても変えない（→ 第33回 決定事項14・15）。
  hasSplit?: boolean;
  // 表示する追加口明細（支払回数ごとのデータセット）。未指定時は既定データを生成する。
  // グリッドの編集は行オブジェクトへ直接反映されるため、渡した配列がそのまま
  // 当該支払回のデータとして保持される。
  initialRows?: AdditionalEntryData[];
  // 拡売費一覧へ連動する「未承認NET拡売費」データ（O列合計・商品名別O列）の変更通知
  // 支払回数は親が付ける（→ utils/netUnapprovedLink）。
  onNetUnapprovedChange?: (payload: NetUnapprovedLink) => void;
  // 「拡売費処理」列の値が変わった時の通知（拡売費一覧（その他）への行追加／削除に使用）
  onExpProcessChange?: (row: AdditionalEntryData, value: string) => void;
}

// 赤表示の行（サマリ商品の計画で請求NET＜計画NET・計画に無い明細）の背景（配色は共通トークン）
const OVER_BILLED_BG = GRID_COLORS.overBilledBg;

// 追加口明細のセルの色の凡例。色は GRID_COLORS を単一の情報源とする（→ 02 §10.1）。
const ENTRY_COLOR_LEGEND: CellColorLegendItem[] = [
  { color: GRID_COLORS.transferredBg, label: '拡売費から移した明細' },
  {
    color: GRID_COLORS.changedBg,
    borderColor: GRID_COLORS.changedBorder,
    label: '編集したセル',
  },
  {
    color: OVER_BILLED_BG,
    label: '請求NETが計画NETを下回る明細（サマリ商品の計画）・計画に無い明細',
  },
  { color: GRID_COLORS.readonly, label: '入力できないセル' },
];

// 行を赤く表示する明細か（→ utils/additionalEntryRules の isEntryAlertRow）。
//   ・サマリ商品で作った計画に紐づき、請求NET＜計画NET の明細
//   ・計画に無いサマリ商品の明細（計画NETは空欄）
// 一般卸メッシュで作った計画に紐づく明細は、取込・反映の時点で自動で振り替えるため赤くしない。
const isOverBilled = (data: AdditionalEntryData | undefined): boolean =>
  isEntryAlertRow(data);

// 販売店名（請求書明細から引き継ぐ表示専用項目）。明細追加ペインでも使うため再公開する。
export { BILL_RETAILER_NAME };

// 支払回数1の追加口明細を新規生成する（モックデータ → constants/paymentWithInvoiceMockData）。
// 画面は支払回数ごとのデータセット（createWithInvoiceEntryRows）を initialRows で渡す。
export const createEntryRows = (): AdditionalEntryData[] =>
  createWithInvoiceEntryRows('1');

// 明細行に次へ採番する No.（明細行の最大 No.＋1）。
const nextEntryLineNo = (rows: AdditionalEntryData[]): number =>
  rows.reduce((max, row) => {
    if (row.isTotal) return max;
    const n = Number(row.lineNo);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0) + 1;

// 行ID（AG Grid 公式 getRowId）。No.（lineNo）は支払回ごとの明細で重複せず（追加・戻す明細は
// 明細行の最大 No.＋1 で採番）、セル編集でも変わらない。モジュール直下に置いて参照を固定する（→ 02 §7.1）。
const getEntryRowId = (params: GetRowIdParams<AdditionalEntryData>): string =>
  String(params.data.lineNo);

// 追加口明細の空行（拡売費一覧の「追加口処理」で追加する行の既定値）。
const EMPTY_ENTRY_ROW: AdditionalEntryData = {
  lineNo: '',
  productCode: '',
  productName: '',
  capacity: '',
  cases: '',
  loose: '',
  unitPrice: '',
  amount: '',
  payCases: '',
  payLoose: '',
  addUnit: '',
  expUnit: '',
  addAmount: '',
  expAmount: 0,
  payAmount: '',
  diff: '',
  matchType: '',
  expProcess: '-',
  seihan: '',
  planNet: '',
  billNet: '',
  addNet: '',
  payNet: '',
  billDetailNo: '',
  billPage: '',
  retailerName: '',
  summary1: '',
  summary: '',
  funcCheck: false,
  finalNet: '',
};

// 追加口明細に現れないサマリ商品のコード（拡売費明細から移した明細で使う）。
// 追加口明細のサンプルと同じ8桁の体裁でそろえる。
const EXTRA_SUMMARY_PRODUCT_CODES: Record<string, string> = {
  カルピスウォーター500mL24本: '45120169',
  ウィルキンソン炭酸水500mL24本: '45140103',
  十六茶630mL24本: '45150110',
  '三ツ矢サイダー1.5L8本': '45130073',
  'ワンダ ボトルコーヒー微糖500mL24本': '45160035',
};

// サマリ商品名 → サマリ商品コードの逆引き（追加口明細の行を追加するときに使う）。
const BILLING_SUMMARY_PRODUCT_CODE_BY_NAME: Record<string, string> = {
  ...EXTRA_SUMMARY_PRODUCT_CODES,
  ...ENTRY_PRODUCT_CODE_BY_NAME,
};

// サマリ商品名 → 商品マスタの参照値（入数・NET単価・社外売上高単価）。
// 拡売費明細から「追加口処理」で移した明細は請求EDIの取込データを持たないため、
// サマリ商品名で商品マスタを引き、参照列（灰色セル）をこの値で埋める。
// 社外売上高単価は補足2-2「社外売単価の導出方法」に従って導く。ただしモックの商品マスタには
// 導出値が NET 以下になる商品（アイテムバラ単価・オペレータバラ単価を持たない商品）があり、
// そのままではバラ単価（社外売上高単価−NET）が負になるため、NET を上回る売価で代替する。
// 商品マスタの数値項目（文字列）を数値へ。空欄・数値化できない値は空文字にする。
const masterNum = (value: string): number | '' => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : '';
};

// NET・社外売上高単価は、共通の商品マスタの値をこの画面の計画の水準にそろえた値
//（→ constants/paymentWithInvoiceMockData の withInvoiceMasterValuesOf）。
// 明細追加ペインでも同じ参照値を表示するため export する。
export const SUMMARY_PRODUCT_ENTRY_REFERENCE: Record<
  string,
  {
    capacity: number | '';
    net: number | '';
    seihan: number | '';
    productCode: string;
  }
> = SUMMARY_PRODUCT_OPTIONS.reduce(
  (map, option) => {
    if (!option.value || map[option.value]) return map;
    const capacity = masterNum(option.quantity);
    const net = masterNum(option.net);
    if (capacity === '' && net === '') return map;
    const external = deriveExternalUnitPrice(option, '', '').value;
    const price = masterNum(option.price);
    const seihan =
      net === ''
        ? ''
        : Number.isFinite(external) && external > net
          ? external
          : price !== '' && price > net
            ? price
            : '';
    // この画面の計画の水準にそろえたマスタの値（→ withInvoiceMasterValuesOf）。
    const scaled = withInvoiceMasterValuesOf(option.value, { net, seihan });
    map[option.value] = {
      capacity,
      net: scaled.net,
      seihan: scaled.seihan,
      productCode: BILLING_SUMMARY_PRODUCT_CODE_BY_NAME[option.value] ?? '',
    };
    return map;
  },
  {} as Record<
    string,
    {
      capacity: number | '';
      net: number | '';
      seihan: number | '';
      productCode: string;
    }
  >
);

// 明細追加・追加口処理で足す明細の参照値（入数・計画NET・社外売上高単価・計画の種類）。
// 当月の販売計画にあるサマリ商品は計画の値（計画NETは最も安い値 → 補足1-5 b24.t5・t6）と
// 計画の種類を使う。計画に無いサマリ商品はマスタの値（計画NETはマスタのNET → 利用者の決定 Q6）とし、
// 計画の種類を持たない。
export interface EntryReference {
  capacity: number | '';
  net: number | '';
  seihan: number | '';
  productCode: string;
  planType?: PlanType;
}
// サマリ商品のマスタNET（商品マスタのNET。計画の有無によらない）。明細追加で足す明細の
// 支払NET（追加口分）・（全体）の初期値（→ 補足1-5 b24.t12・t13、利用者の決定 2026-10-05）。
export const entryMasterNetOf = (productName: string): number | '' =>
  SUMMARY_PRODUCT_ENTRY_REFERENCE[productName]?.net ?? '';

export const entryReferenceOf = (
  productName: string
): EntryReference | undefined => {
  const master = SUMMARY_PRODUCT_ENTRY_REFERENCE[productName];
  const plan = entryPlanOf(productName);
  if (!plan) return master;
  return {
    capacity: plan.capacity,
    net: plan.planNet,
    seihan: plan.seihan,
    productCode:
      master?.productCode ||
      (BILLING_SUMMARY_PRODUCT_CODE_BY_NAME[productName] ?? ''),
    planType: plan.planType,
  };
};

// 金額から「ケース／バラ」を割り戻す（拡売費明細から移した明細の初期値を作るために使う）。
// 金額をバラ単価で割ったバラ換算の本数を、入数でケースと端数のバラに分ける。
// バラ単価が0以下（＝社外売上高単価がNET以下）の商品は割り戻せないため空欄にする。
const splitCasesAndLoose = (
  amount: number,
  capacity: number | '',
  unitPrice: number
): { cases: number | ''; loose: number | '' } => {
  if (!(unitPrice > 0) || !(amount > 0)) return { cases: '', loose: '' };
  const totalLoose = Math.round(amount / unitPrice);
  if (capacity === '' || capacity <= 0) return { cases: 0, loose: totalLoose };
  const cases = Math.floor(totalLoose / capacity);
  return { cases, loose: totalLoose - cases * capacity };
};

// 拡売費一覧の「追加口処理」で外した明細から、追加口明細の1行を作る。
// 金額は請求金額・支払金額を引き継ぎ、追加口として支払う明細のため追加口金額へ同じ値を入れる。
// 入数・NET・社外売上高単価・計画の種類はサマリ商品名で引き（entryReferenceOf）、
// 請求・支払のケース／バラは引き継いだ金額をバラ単価で割り戻して埋める。
// バラ単価・追加口バラ単価・拡売費バラ単価・追加口金額・支払金額・差額は数式で導く（recalcEntryRow）。
// 請求書番号・請求書ページは拡売費明細の値をそのまま引き継ぐ。
// 画面の操作で作る明細のためデータ元は手入力（一般卸メッシュの自動振替は行わない）。
export const createEntryRowFromExpense = (
  item: Parameters<DetailTableHandle['addFromExpense']>[0],
  lineNo: number
): AdditionalEntryData => {
  const amount = toNum(item.billAmount) ?? 0;
  const payAmount = toNum(item.payAmount) ?? 0;
  const reference = entryReferenceOf(item.productName);
  const capacity = reference?.capacity ?? '';
  const net = reference?.net ?? '';
  const seihan = reference?.seihan ?? '';
  // バラ単価＝社外売上高単価−請求NET。追加口バラ単価も同じNETを使うため同値になる。
  // この単価で請求金額・支払金額を割り戻し、請求・支払のケース／バラを埋める。
  const unitPrice = seihan !== '' && net !== '' ? seihan - net : Number.NaN;
  const billQty = splitCasesAndLoose(amount, capacity, unitPrice);
  const payQty = splitCasesAndLoose(payAmount, capacity, unitPrice);
  const newRow: AdditionalEntryData = {
    ...EMPTY_ENTRY_ROW,
    lineNo,
    dataSource: DEFAULT_DATA_SOURCE,
    productName: item.productName,
    productCode: BILLING_SUMMARY_PRODUCT_CODE_BY_NAME[item.productName] ?? '',
    capacity,
    planNet: net,
    planType: reference?.planType,
    centerFeeRate: centerFeeRateOf(item.productName),
    billNet: net,
    addNet: net,
    payNet: net,
    seihan,
    cases: billQty.cases,
    loose: billQty.loose,
    payCases: payQty.cases,
    payLoose: payQty.loose,
    amount,
    addAmount: payAmount,
    expAmount: 0,
    payAmount,
    matchType: item.matchType ?? '',
    summary1: item.summary1 ?? '',
    summary: item.summary2 ?? '',
    billDetailNo: item.billNo ?? '',
    billPage: item.billPage ?? '',
    retailerName: BILL_RETAILER_NAME,
    // 拡売費一覧から移してきた明細であることを示す（入力セルの背景を変える）。
    fromExpense: true,
  };
  recalcEntryRow(newRow);
  return newRow;
};

// 「明細追加」ペインの入力値から、追加口明細の1行を作る。
// 入数・計画NET・社外売上高単価・計画の種類はサマリ商品名で引く（entryReferenceOf）。
// 請求NETはペインの値をそのまま使う（補足1-5 b24.t7：初期値なし・担当者が請求書を見て入力する）。
// ペインの請求NETは空欄から始まり、担当者が空欄のまま追加したら空欄のまま追加して、
// バラ単価・金額も計算しない（ペインの表示と一致させる）。
// サマリ商品で作った計画に紐づく明細は、請求NETが計画NETを下回ると赤く表示する
//（isEntryAlertRow。空欄は比べられないため赤くしない）。
// 請求情報（ケース・バラ・バラ単価・金額）もペインの入力値を使う（→ 補足1-5 b24.t7〜t11）。
// バラ単価・金額はペインの値を入れ、計算した値と違う値だけ手で直した値として残す。
// 追加口金額・支払金額・差額は数式で導く（recalcEntryRow）。
export const createManualEntryRow = (
  values: EntryFormValues,
  lineNo: number
): AdditionalEntryData => {
  const reference = entryReferenceOf(values.productName);
  const net = reference?.net ?? '';
  const masterNet = entryMasterNetOf(values.productName);
  const typedUnitPrice = toNum(values.unitPrice);
  const typedAmount = toNum(values.amount);
  const newRow: AdditionalEntryData = {
    ...EMPTY_ENTRY_ROW,
    lineNo,
    dataSource: DEFAULT_DATA_SOURCE,
    productName: values.productName,
    productCode: reference?.productCode ?? '',
    capacity: reference?.capacity ?? '',
    planNet: net,
    planType: reference?.planType,
    centerFeeRate: centerFeeRateOf(values.productName),
    billNet: toNum(values.billNet) ?? '',
    cases: toNum(values.cases) ?? '',
    loose: toNum(values.loose) ?? '',
    seihan: reference?.seihan ?? '',
    payCases: toNum(values.payCases) ?? '',
    payLoose: toNum(values.payLoose) ?? '',
    // 支払NET（追加口分）・（全体）はペインの値。未入力ならサマリ商品のマスタNET（→ b24.t12・t13）。
    addNet: toNum(values.addNet) ?? masterNet,
    payNet: toNum(values.payNet) ?? masterNet,
    matchType: values.matchType,
    expProcess: values.expProcess || '-',
    billPage: values.billPage,
    billDetailNo: values.billDetailNo,
    retailerName: values.retailerName,
    summary1: values.summary1,
    summary: values.summary2,
    funcCheck: values.funcCheck,
    finalNet: values.finalNet,
  };
  // バラ単価・金額はペインの値を入れ、手で直した値（計算した値と違う値）にだけ印を付ける。
  // 印の無い値は計算式で求め直す（計算した値と同じ）。函数無効チェックONの明細は計算しないため、
  // ペインの値をそのまま持つ。以後のグリッドの編集も同じ決まり（→ applyEntryCellEdit）。
  if (typedUnitPrice !== null) {
    newRow.unitPriceManual =
      (values.unitPriceManual ?? true) &&
      !isSameEntryNumber(typedUnitPrice, calcEntryUnitPrice(newRow));
    newRow.unitPrice = typedUnitPrice;
  }
  recalcEntryRow(newRow);
  if (typedAmount !== null) {
    newRow.amountManual =
      (values.amountManual ?? true) &&
      !isSameEntryNumber(typedAmount, calcEntryAmount(newRow));
    newRow.amount = typedAmount;
    recalcEntryRow(newRow); // 印の無い金額は計算し直し、差額を金額に合わせる
  }
  return newRow;
};

const TOTAL_ROW: AdditionalEntryData = {
  isTotal: true,
  lineNo: '合計',
  productCode: '',
  productName: '',
  capacity: '',
  cases: '',
  loose: '',
  unitPrice: '',
  amount: '',
  payCases: '',
  payLoose: '',
  addUnit: '',
  expUnit: '',
  addAmount: '',
  expAmount: 0,
  payAmount: '',
  diff: '',
  matchType: '',
  expProcess: '',
  seihan: '',
  planNet: '',
  billNet: '',
  addNet: '',
  payNet: '',
  billDetailNo: '',
  billPage: '',
  retailerName: '',
  summary: '',
  funcCheck: '',
  finalNet: '',
};

// 数値表示（カンマ区切り、空文字・"-"は「-」）
const numFmt = (params: { value: unknown }) => {
  const v = params.value;
  if (v === '' || v === null || v === undefined || v === '-')
    return GRID_EMPTY_TEXT;
  if (typeof v === 'number') return v.toLocaleString();
  return String(v);
};

// 数値入力セルの入力値パーサ。カンマ区切りを許容し、指定の小数桁で四捨五入する
//（digits=0 は整数、digits=2 は小数第3位を四捨五入して小数第2位まで）。
// 数値にできない入力は編集前の値へ戻す（空欄はそのまま空欄にする）。
const numberValueParser =
  (digits: number) =>
  (params: { newValue: unknown; oldValue: unknown }): unknown => {
    const raw = String(params.newValue ?? '')
      .trim()
      .replace(/,/g, '');
    if (raw === '') return '';
    const n = Number(raw);
    if (!Number.isFinite(n)) return params.oldValue;
    const factor = 10 ** digits;
    return Math.round(n * factor) / factor;
  };

// ツールチップ用に値を桁区切り文字列へ整形する（数値化できなければそのまま）。
const fmtN = (v: unknown): string => {
  const n = toNum(v);
  return n === null ? String(v ?? '') : n.toLocaleString();
};

// 計算式が設定された列（派生項目）の定義。
//   refs    : ハイライト対象の参照元フィールド（当該行内）。入力値により分岐する。
//   tooltip : 当該行データから計算式テキスト（式＋実値）を生成する。
// Excel「追加口」表の数式（utils/additionalEntryRules の recalcEntryRow）に対応する。
const FORMULA_DEFS: Record<
  string,
  {
    refs: (row: AdditionalEntryData) => string[];
    tooltip: (row: AdditionalEntryData) => string;
  }
> = {
  // バラ単価H = 社外売上高単価U − 請求NET W
  unitPrice: {
    refs: () => ['seihan', 'billNet'],
    tooltip: (r) =>
      `バラ単価 ＝ 社外売上高単価 − 請求NET ＝ ${fmtN(r.seihan)} − ${fmtN(r.billNet)}`,
  },
  // 金額I =（入数E×請求ケースF ＋ 請求バラG）× バラ単価H
  amount: {
    refs: () => ['capacity', 'cases', 'loose', 'unitPrice'],
    tooltip: (r) =>
      `金額 ＝（入数 × ケース ＋ バラ）× バラ単価 ＝（${fmtN(r.capacity)} × ${fmtN(r.cases)} ＋ ${fmtN(r.loose)}）× ${fmtN(r.unitPrice)}`,
  },
  // 追加口バラ単価L = 社外売上高単価U − 支払NET（追加口分）X
  addUnit: {
    refs: () => ['seihan', 'addNet'],
    tooltip: (r) =>
      `追加口バラ単価 ＝ 社外売上高単価 − 支払NET（追加口分） ＝ ${fmtN(r.seihan)} − ${fmtN(r.addNet)}`,
  },
  // 拡売費バラ単価M = 支払NET（追加口分）X − 支払NET（全体）Y
  expUnit: {
    refs: () => ['addNet', 'payNet'],
    tooltip: (r) =>
      `拡売費バラ単価 ＝ 支払NET（追加口分） − 支払NET（全体） ＝ ${fmtN(r.addNet)} − ${fmtN(r.payNet)}`,
  },
  // 追加口金額N =（入数E×支払ケースJ ＋ 支払バラK）× 追加口バラ単価L
  addAmount: {
    refs: () => ['capacity', 'payCases', 'payLoose', 'addUnit'],
    tooltip: (r) =>
      `追加口金額 ＝（入数 × 支払ケース ＋ 支払バラ）× 追加口バラ単価 ＝（${fmtN(r.capacity)} × ${fmtN(r.payCases)} ＋ ${fmtN(r.payLoose)}）× ${fmtN(r.addUnit)}`,
  },
  // 拡売費金額O =（入数E×支払ケースJ ＋ 支払バラK）× 拡売費バラ単価M
  expAmount: {
    refs: () => ['capacity', 'payCases', 'payLoose', 'expUnit'],
    tooltip: (r) =>
      `拡売費金額 ＝（入数 × 支払ケース ＋ 支払バラ）× 拡売費バラ単価 ＝（${fmtN(r.capacity)} × ${fmtN(r.payCases)} ＋ ${fmtN(r.payLoose)}）× ${fmtN(r.expUnit)}`,
  },
  // 支払金額P = 追加口金額N + 拡売費金額O
  payAmount: {
    refs: () => ['addAmount', 'expAmount'],
    tooltip: (r) =>
      `支払金額 ＝ 追加口金額 ＋ 拡売費金額 ＝ ${fmtN(r.addAmount)} ＋ ${fmtN(r.expAmount)}`,
  },
  // 差額R = 金額I − 支払金額P
  diff: {
    refs: () => ['amount', 'payAmount'],
    tooltip: (r) =>
      `差額 ＝ 金額 − 支払金額 ＝ ${fmtN(r.amount)} − ${fmtN(r.payAmount)}`,
  },
};

// 当該セルが計算式セルか判定する。函数無効チェックON（手入力優先）・合計行は対象外。
// 手入力の明細で手で直したバラ単価・金額も、計算式セルとしては扱わない。
const isFormulaCell = (field: string | undefined, row: AdditionalEntryData) =>
  !!field &&
  !row.isTotal &&
  row.funcCheck !== true &&
  !(field === 'unitPrice' && row.unitPriceManual) &&
  !(field === 'amount' && row.amountManual) &&
  !!FORMULA_DEFS[field];

// 計画NETのツールチップ。紐づく計画の種類（一般卸メッシュ／サマリ商品）も示す
//（赤表示・自動振替の対象は計画の種類で決まるため → 補足2-1 No.10）。
// 計画に無いサマリ商品は計画NETが空欄になる。
const planNetTooltipOf = (row: AdditionalEntryData): string =>
  row.planNet === '' || row.planNet == null
    ? '計画NET：空欄（計画に無いサマリ商品）'
    : `計画NET：${fmtN(row.planNet)}（${row.planType ?? '計画の種類なし'}で作った計画）`;

// 合計行（ピン留め）を再計算する。Excel 19行目の SUM 群に準拠。
//   支払金額合計 = 追加口金額合計 + 拡売費金額合計、差額合計 = 金額合計 − 支払金額合計
const computeEntryTotal = (
  rows: AdditionalEntryData[]
): AdditionalEntryData => {
  let cases = 0;
  let loose = 0;
  let amount = 0;
  let payCases = 0;
  let payLoose = 0;
  let addAmount = 0;
  let expAmount = 0;
  rows.forEach((d) => {
    if (d.isTotal) return;
    cases += toNum(d.cases) ?? 0;
    loose += toNum(d.loose) ?? 0;
    amount += toNum(d.amount) ?? 0;
    payCases += toNum(d.payCases) ?? 0;
    payLoose += toNum(d.payLoose) ?? 0;
    addAmount += toNum(d.addAmount) ?? 0;
    expAmount += toNum(d.expAmount) ?? 0;
  });
  return {
    ...TOTAL_ROW,
    cases,
    loose,
    amount,
    payCases,
    payLoose,
    addAmount,
    expAmount,
    payAmount: addAmount + expAmount,
    diff: amount - (addAmount + expAmount),
  };
};

// 拡売費一覧へ連動する「未承認NET拡売費」データ（→ utils/netUnapprovedLink）。
//   total          = 拡売費金額(NET未承認) O列の合計（Excel O19）
//   byProduct      = 商品名ごとの O列合計（拡売費明細は商品名で参照する）
//   manualProducts = 差を出した手入力の明細を持つ商品（未承認NETの明細も手入力にする）
const computeNetUnapproved = (rows: AdditionalEntryData[]): NetUnapprovedLink =>
  netUnapprovedLinkOf(rows);

// 追加口明細の消費税率。追加口は税率の列を設けず一律8%を裏で保持する
// （→ 課題 No.0871／20260710_第16回 決定事項21）。消費税コード・名称はPRIMEのものを使い、
// 追加口はF始まりの8%を初期値とする（→ 20260724_第23回_共通 決定事項10。
// コードの採番はPRIMEマスタのため基本設計で定める）。
export const ADDITION_TAX_RATE = 0.08;

// 照合支払区分の選択肢（拡売費明細と共通の定数を使う）。
// 「拡売費処理」で当該明細を拡売費明細へ転記するとき、照合支払区分の値を
// そのまま引き継ぐため、両一覧の選択肢は同じでなければならない。
const MATCH_TYPE_OPTIONS = MATCH_PAYMENT_TYPE_OPTIONS;

// 拡売費処理の選択値（この値の明細行は拡売費一覧へ転記される）。
const EXP_PROCESS_APPLIED = '拡売費処理';

// 行操作（拡売費処理）を三点リーダーにまとめたレンダラー。
// 函数無効チェックは請求書情報の右の専用列（チェックボックス）で切り替える。
// 拡売費一覧の操作列（PaymentNonProductExpensePane）と同じ体裁にそろえる。
// 合計行には出さない。
// ハンドラはグリッドの context 経由（中身は ref）で受け取り、列定義を作り直さずに
// 常に最新の処理を呼べるようにする。
const EntryRowMenuCellRenderer = (params: any) => {
  if (params.data?.isTotal) return null;
  const row = params.data as AdditionalEntryData;
  const { onExpMove } = params.context ?? {};
  const activeCls = 'text-blue-600 focus:text-blue-600';
  return (
    <RowActionMenu>
      {/* 拡売費処理：押下で当該明細を追加口一覧から外し、
          拡売費カードの一覧の最下部へ移す。 */}
      <DropdownMenuItem onClick={() => onExpMove?.(row)} className={activeCls}>
        <Redo2 className="h-4 w-4 text-blue-600" />
        拡売費処理
      </DropdownMenuItem>
    </RowActionMenu>
  );
};

export const DetailTable = forwardRef<DetailTableHandle, DetailTableProps>(
  function DetailTable(
    {
      onOpenAddDetail,
      onOpenSplit,
      hasSplit = false,
      onNetUnapprovedChange,
      onExpProcessChange,
      onBreakdownChange,
      initialRows,
    }: DetailTableProps,
    ref
  ) {
    // カードの開閉状態（折り畳み。既定は展開）。
    const [isCardOpen, setIsCardOpen] = useState(true);

    // 表示する行一覧。支払回数ごとのデータセット（initialRows）が渡された場合は
    // その配列をそのまま使い、未指定なら既定データを新規生成する。
    const entryRows = useMemo(
      () => initialRows ?? createEntryRows(),
      [initialRows]
    );

    // グリッドの縦幅（リサイズハンドルのドラッグで手動調整可能。初期480px）。
    const GRID_MIN_HEIGHT = 240; // 縮めすぎ防止の下限
    const [gridHeight, setGridHeight] = useState(480);

    // 合計行のデータ。セル編集・行の増減のたびに再集計し、
    // その更新を合図にタイトル下の合計表（entryBreakdown）も集計し直す。
    const [totalRow, setTotalRow] = useState<AdditionalEntryData>(() =>
      computeEntryTotal(entryRows)
    );

    // タイトル下の合計表（追加口計）と、支払情報サマリへ渡すセンターフィ額。
    // 明細（entryRows）は行オブジェクトを直接書き換えるため、合計行の再集計（totalRow の更新）に合わせて求め直す。
    const breakdowns = useMemo<EntryBreakdowns>(
      () => ({
        entry: computeEntryBreakdown(entryRows),
        centerFeeAmount: computeEntryCenterFeeTotal(entryRows),
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- totalRow の更新を再集計の合図に使う
      [entryRows, totalRow]
    );

    // 合計表を親へ通知する（親が支払情報カードの合計表へ渡す）。
    useEffect(() => {
      onBreakdownChange?.(breakdowns);
    }, [breakdowns, onBreakdownChange]);

    // リサイズハンドルのドラッグ開始。マウス移動量に応じてグリッド縦幅を更新する。
    const handleResizeStart = (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = gridHeight;
      const onMove = (ev: MouseEvent) => {
        const next = Math.max(
          GRID_MIN_HEIGHT,
          startHeight + (ev.clientY - startY)
        );
        setGridHeight(next);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.userSelect = '';
      };
      document.body.style.userSelect = 'none'; // ドラッグ中のテキスト選択を抑止
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };

    // 初回マウント時と枝番構成の変更時に、合計と拡売費一覧へ連動する未承認NET拡売費を更新する。
    useEffect(() => {
      setTotalRow(computeEntryTotal(entryRows));
      onNetUnapprovedChange?.(computeNetUnapproved(entryRows));
    }, [entryRows, onNetUnapprovedChange]);

    // AG Grid API（ハイライト再描画用）。
    const gridApiRef = useRef<GridApi | null>(null);
    // 列幅・並び順・ソートの永続化。画面独自の onGridReady はフックのオプション経由で
    // 実行する（spread で共通の onGridReady を上書きしないため）。
    // ※保存済み列状態は applyColumnState({ applyOrder: true }) で復元されるため、
    //   列構成を変更したらキーの版数を上げて旧状態を破棄する
    //   （v1→v2：No.列追加、v2→v3：分割先グループ列追加、v3→v4：分割先グループを右端へ右固定、
    //     v4→v5：分割情報グループ列をコメントアウト）。
    // 拡売費一覧から移してきた明細を見つけやすくする
    //（行全体をフラッシュし、可視域へ送る）。ハンドル内からも使うため先に定義する。
    const reveal = useRevealNewRows();

    const gridColumnStateProps = useGridColumnState(
      // v5→v6：No. の右に「データ元」列（非活性）を追加。
      // v6→v7：列順を「計画情報 → 請求情報 → 支払情報 → 請求－支払の差 →
      //   照合支払区分・拡売費処理 → 請求書情報」へ組み替えた
      //   （→ 20260710_第16回 決定事項1）。
      // v7→v8：同日ASD決定案「支払並び替え」の①〜⑦に合わせてグループ内の並びも確定した。
      //   社外売上高単価を計画情報へ、請求NET／支払NET2列を各グループの先頭へ移し、
      //   照合支払区分・摘要2を請求－支払へ、拡売費処理・函数無効チェック・最終NET・摘要1を
      //   「社内確認・社内説明用」へまとめ、請求書情報を末尾に置いた。
      // v8→v9：ASD決定案の見出し行（5行目）に合わせ、請求-支払は差額のみ、
      //   照合支払区分（項目名＝※差がある場合のみ）・拡売費処理（項目名＝に移動）を
      //   それぞれ独立した見出しに分け、摘要2・函数無効チェック・最終NET・摘要1は
      //   見出し無しの列にした。
      // v9→v10：「拡売費処理／に移動」の見出しをグループに分けず1セルへ結合した。
      // v10→v11：「拡売費処理／に移動」「函数無効チェック」の2列を廃し、
      //   右端に固定した操作メニュー列（三点リーダー）へ移した。
      // v11→v12：「函数無効チェック」を操作メニューから外し、請求書情報の右に
      //   チェックボックスの列として戻した。
      '支払詳細C.追加口.columnState.v12',
      {
        onGridReady: (event: GridReadyEvent) => {
          gridApiRef.current = event.api;
          reveal.captureApi(event.api);
        },
      }
    );

    // 「拡売費処理／に移動」ボタン押下：当該明細を追加口一覧から取り除き、
    // 拡売費カードの一覧の最下部へ移す（親が onExpProcessChange で転記する）。
    const handleExpMove = (row: AdditionalEntryData) => {
      const api = gridApiRef.current;
      if (!api || row.isTotal) return;
      // entryRows は支払回ごとのデータ実体のため、同じ配列参照のまま取り除く。
      const index = entryRows.indexOf(row);
      if (index < 0) return;
      entryRows.splice(index, 1);
      api.applyTransaction({ remove: [row] });
      setTotalRow(computeEntryTotal(entryRows));
      onNetUnapprovedChange?.(computeNetUnapproved(entryRows));
      // 拡売費一覧へ当該明細を転記する（同一項目の内容をそのまま引き継ぐ）。
      onExpProcessChange?.(row, EXP_PROCESS_APPLIED);
    };

    // 列定義を作り直さずに最新のハンドラを呼べるよう、ref 経由で保持する。
    const expMoveRef = useRef(handleExpMove);
    expMoveRef.current = handleExpMove;
    // セルレンダラーへ渡すグリッドの context（参照は固定し、中身は上記 ref で最新化）。
    const gridContext = useMemo(
      () => ({
        onExpMove: (row: AdditionalEntryData) => expMoveRef.current(row),
      }),
      []
    );

    // 親（PaymentDetailWithInvoice）へ公開するハンドル。
    useImperativeHandle(ref, () => ({
      // 拡売費一覧の「追加口処理」から呼ばれ、「拡売費処理／に移動」で外した明細を
      // そのまま追加口一覧の最上部へ戻す（画面設計標準 4.4）。No. は明細行の最大 No.＋1 で採番し直す。
      restoreEntry: (row: AdditionalEntryData) => {
        const api = gridApiRef.current;
        if (!api) return;
        const restored: AdditionalEntryData = {
          ...row,
          lineNo: nextEntryLineNo(entryRows),
          // 拡売費一覧から戻ってきた明細であることを示す（入力セルの背景を変える）。
          fromExpense: true,
        };
        entryRows.unshift(restored);
        api.applyTransaction({ add: [restored], addIndex: 0 });
        setTotalRow(computeEntryTotal(entryRows));
        onNetUnapprovedChange?.(computeNetUnapproved(entryRows));
        reveal.markRows([restored]);
        reveal.onRowDataUpdated({ api });
      },
      // 拡売費一覧の「追加口処理」で外した明細を、追加口明細の最上部へ足す（画面設計標準 4.4）。
      // No. は既存の明細行の最大 No.＋1。
      // 金額は請求金額・支払金額を引き継ぎ、追加口として支払う明細のため
      // 追加口金額へ同じ値を入れる。入数・NET・社外売上高単価はサマリ商品名で
      // 商品マスタを引いて埋め、請求・支払のケース／バラは引き継いだ金額を
      // バラ単価で割り戻して埋める。バラ単価・追加口バラ単価・拡売費バラ単価・
      // 追加口金額・支払金額・差額は数式で導く（recalcEntryRow）。
      // 請求書番号・請求書ページは拡売費明細の値をそのまま引き継ぐ。
      addFromExpense: (item) => {
        const api = gridApiRef.current;
        if (!api) return;
        const newRow = createEntryRowFromExpense(
          item,
          nextEntryLineNo(entryRows)
        );
        entryRows.unshift(newRow);
        api.applyTransaction({ add: [newRow], addIndex: 0 });
        setTotalRow(computeEntryTotal(entryRows));
        onNetUnapprovedChange?.(computeNetUnapproved(entryRows));
        // 追加した行がすぐ確認できるよう先頭行まで送り、行全体をフラッシュして
        // 一覧が切り替わったことを分かるようにする。
        reveal.markRows([newRow]);
        reveal.onRowDataUpdated({ api });
      },
      // 「明細追加」ペインの入力値から明細を最上部に1行足す（画面設計標準 4.4）。
      // 入数・各NET・社外売上高単価はサマリ商品名で商品マスタを引いて埋め、
      // 請求情報（請求NET・ケース・バラ・バラ単価・金額）と請求書情報（請求書ページ・
      // 請求明細番号・販売店名）はペインの入力値を使う（→ createManualEntryRow）。
      // 未入力のバラ単価・金額と、追加口金額・支払金額・差額は数式で導く（recalcEntryRow）。
      addManualRow: (values) => {
        const api = gridApiRef.current;
        if (!api) return;
        const newRow = createManualEntryRow(values, nextEntryLineNo(entryRows));
        entryRows.unshift(newRow);
        api.applyTransaction({ add: [newRow], addIndex: 0 });
        setTotalRow(computeEntryTotal(entryRows));
        onNetUnapprovedChange?.(computeNetUnapproved(entryRows));
        reveal.markRows([newRow]);
        reveal.onRowDataUpdated({ api });
      },
    }));

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
      const row = e.data as AdditionalEntryData | undefined;
      if (!field || !row || !isFormulaCell(field, row)) {
        setHoverRefs([]);
        return;
      }
      const rowId = e.node?.id ?? '';
      setHoverRefs(FORMULA_DEFS[field].refs(row).map((f) => `${f}::${rowId}`));
    };

    // セルから外れたらハイライトを解除する。
    const handleCellMouseOut = () => setHoverRefs([]);

    // 編集セルの変更ハイライト（共通フック）。変更追跡・判定は共通側へ集約する。
    // 本グリッドは過請求行の赤背景を変更黄より優先する必要があるため、色付けは
    // 各列の cellStyle 方式のまま（判定のみ isCellChanged を使用）。
    const { isCellChanged, trackCellChange } = useChangedCells();

    // セル編集時に変更状態を記録し、当該セルを再描画して背景色（オレンジ）を反映する。
    const handleCellValueChanged = (params: CellValueChangedEvent) => {
      trackCellChange(params);

      // 入力値の変更に伴い、当該行の派生項目（バラ単価・金額・支払金額・差額 等）を
      // Excel「追加口」表の数式に従って再計算する。
      // どの項目を直しても、請求EDI・AIC入力の明細はデータ元が手入力になる（活性は元のまま）。
      // データ元の列と合計表のデータ元別は、下の再描画・再集計で手入力へ移る。
      // 手入力の明細でバラ単価・金額を手で直したときは、その値を残す（→ applyEntryCellEdit）。
      applyEntryCellEdit(
        params.data as AdditionalEntryData,
        params.colDef?.field
      );
      // タイトル下の合計サマリーバーへ反映するため合計を再集計する。
      setTotalRow(computeEntryTotal(entryRows));

      // 拡売費一覧（未承認NET拡売費）へ連動データを通知する。
      onNetUnapprovedChange?.(computeNetUnapproved(entryRows));

      // ※「拡売費処理」は操作メニュー（EntryRowMenuCellRenderer）で移動させるため、
      //   セル編集による通知は行わない（→ handleExpMove）。

      // 編集行の全列を再描画（派生値の反映）＋編集セルの強調色を更新する。
      params.api.refreshCells({
        rowNodes: [params.node],
        force: true,
      });
    };

    // セルの背景色。拡売費明細から「追加口処理」で移してきた明細は、一覧が切り替わった
    // ことが一目で分かるよう、行全体を通常の白／灰ではなく薄い紫にする。
    const rowBgOf = (params: any, normal: string) =>
      params.data?.fromExpense ? GRID_COLORS.transferredBg : normal;

    // 手入力可能セル（数値・右寄せ）スタイル。データ行は白（gridStyles の editable）、
    // 編集後は落ち着いたオレンジ（gridStyles の changedBorder）に統一。
    const inputCellStyle = (params: any) =>
      params.data?.isTotal
        ? {
            fontWeight: 'bold',
            backgroundColor: GRID_COLORS.total,
            textAlign: 'right',
          }
        : isOverBilled(params.data)
          ? { backgroundColor: OVER_BILLED_BG, textAlign: 'right' }
          : isCellChanged(params)
            ? changedCellStyle({ textAlign: 'right' })
            : {
                backgroundColor: rowBgOf(params, GRID_COLORS.editable),
                textAlign: 'right',
              };

    // 非活性（表示のみ）右寄せスタイル。データ行は灰（gridStyles の readonly）。
    const rightStyle = (params: any) =>
      params.data?.isTotal
        ? {
            fontWeight: 'bold',
            backgroundColor: GRID_COLORS.total,
            textAlign: 'right',
          }
        : isOverBilled(params.data)
          ? { backgroundColor: OVER_BILLED_BG, textAlign: 'right' }
          : {
              backgroundColor: rowBgOf(params, GRID_COLORS.readonly),
              textAlign: 'right',
            };

    // 非活性（表示のみ）スタイル。データ行は灰（gridStyles の readonly）。
    const totalStyle = (params: any) =>
      params.data?.isTotal
        ? { fontWeight: 'bold', backgroundColor: GRID_COLORS.total }
        : isOverBilled(params.data)
          ? { backgroundColor: OVER_BILLED_BG }
          : { backgroundColor: rowBgOf(params, GRID_COLORS.readonly) };

    // 手入力可能セル（テキスト・左寄せ）スタイル。データ行は白（gridStyles の editable）、
    // 編集後は落ち着いたオレンジ（gridStyles の changedBorder）に統一。
    const inputTextStyle = (params: any) =>
      params.data?.isTotal
        ? { fontWeight: 'bold', backgroundColor: GRID_COLORS.total }
        : isOverBilled(params.data)
          ? { backgroundColor: OVER_BILLED_BG }
          : isCellChanged(params)
            ? changedCellStyle()
            : { backgroundColor: rowBgOf(params, GRID_COLORS.editable) };

    // 手入力可能セル（チェックボックス・中央寄せ）スタイル。データ行は白（gridStyles の editable）、
    // 変更後は落ち着いたオレンジ（gridStyles の changedBorder）に統一。
    const inputCenterStyle = (params: any) =>
      params.data?.isTotal
        ? {
            fontWeight: 'bold',
            backgroundColor: GRID_COLORS.total,
            textAlign: 'center',
          }
        : isOverBilled(params.data)
          ? { backgroundColor: OVER_BILLED_BG, textAlign: 'center' }
          : isCellChanged(params)
            ? changedCellStyle({ textAlign: 'center' })
            : {
                backgroundColor: rowBgOf(params, GRID_COLORS.editable),
                textAlign: 'center',
              };

    // 操作メニュー列（三点リーダー）用：データ行は白背景・中央寄せ。
    const widgetCenterStyle = (params: any) =>
      params.data?.isTotal
        ? {
            fontWeight: 'bold',
            backgroundColor: GRID_COLORS.total,
            textAlign: 'center',
          }
        : isOverBilled(params.data)
          ? { backgroundColor: OVER_BILLED_BG, textAlign: 'center' }
          : {
              backgroundColor: rowBgOf(params, GRID_COLORS.editable),
              textAlign: 'center',
            };

    // 手入力の明細だけ直せる列（請求情報・請求書情報）の編集可否とセル背景。
    // 直せる行は白（入力セル）、直せない行は灰（非活性）にする。
    const manualOnlyEditable = (p: any) =>
      isEntryCellEditable(p.data, String(p.colDef?.field ?? ''));
    const manualOnlyNumberStyle = (params: any) =>
      manualOnlyEditable(params) ? inputCellStyle(params) : rightStyle(params);
    const manualOnlyTextStyle = (params: any) =>
      manualOnlyEditable(params) ? inputTextStyle(params) : totalStyle(params);

    const columnDefs: ColDef[] = useMemo(
      () => [
        {
          headerName: 'No.',
          field: 'lineNo',
          ...GRID_NUMBER_FILTER,
          width: 70,
          // 先頭列（aria-colindex=1）は grid.css で display:flex・中央寄せが強制されるため、
          // text-align では左寄せにできない。左寄せ用クラス（justify-content:flex-start）を付与する。
          cellClass: 'ag-cell-left-pinned',
          cellStyle: totalStyle,
        },
        {
          // データ元：当該明細の作成元（請求EDI／AIC入力／手入力）。
          // 表示のみの非活性列（灰背景）。合計行は持たないため空白。
          headerName: 'データ元',
          field: 'dataSource',
          width: 100,
          cellStyle: totalStyle,
          editable: false,
        },
        {
          // 項目名は拡売費明細・請求詳細に合わせる（→ 20260821_第31回 決定事項7）。
          headerName: 'サマリ商品コード',
          field: 'productCode',
          width: 110,
          cellStyle: totalStyle,
        },
        {
          headerName: 'サマリ商品名',
          field: 'productName',
          width: 240,
          cellStyle: totalStyle,
        },
        {
          headerName: '入数',
          field: 'capacity',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 70,
          cellStyle: rightStyle,
        },
        {
          // ②計画紐づけ情報。社外売上高単価・計画NETとも販売計画から引く
          //（→ 20260710_第16回 決定事項1／同日ASD決定案「支払並び替え」）。
          headerName: '計画情報',
          children: [
            {
              headerName: '社外売上高単価',
              field: 'seihan',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 130,
              valueFormatter: numFmt,
              cellStyle: rightStyle,
            },
            {
              headerName: '計画NET',
              field: 'planNet',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 90,
              valueFormatter: numFmt,
              cellStyle: rightStyle,
            },
          ],
        },
        {
          // ③請求内容（請求EDI・AIC入力）。請求NETをグループの先頭に置く。
          headerName: '請求情報',
          children: [
            // 手入力の明細（元のデータ元が手入力）だけ直せる（→ 補足1-5 b21.t13〜t17）。
            // 請求EDI・AIC入力の明細は、手で直して手入力になっても直せない（活性は元のまま）。
            {
              headerName: '請求NET',
              field: 'billNet',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 90,
              valueFormatter: numFmt,
              cellStyle: manualOnlyNumberStyle,
              editable: manualOnlyEditable,
              cellEditor: 'agNumberCellEditor',
              cellEditorParams: { precision: 2 },
              valueParser: numberValueParser(2),
            },
            {
              headerName: 'ケース',
              field: 'cases',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 80,
              valueFormatter: numFmt,
              cellStyle: manualOnlyNumberStyle,
              editable: manualOnlyEditable,
              cellEditor: 'agNumberCellEditor',
              cellEditorParams: { precision: 0 },
              valueParser: numberValueParser(0),
            },
            {
              headerName: 'バラ',
              field: 'loose',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 70,
              valueFormatter: numFmt,
              cellStyle: manualOnlyNumberStyle,
              editable: manualOnlyEditable,
              cellEditor: 'agNumberCellEditor',
              cellEditorParams: { precision: 0 },
              valueParser: numberValueParser(0),
            },
            {
              // 計算した値（社外売上高単価－請求NET）を手で直せる。
              headerName: 'バラ単価',
              field: 'unitPrice',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 90,
              valueFormatter: numFmt,
              cellStyle: manualOnlyNumberStyle,
              editable: manualOnlyEditable,
              cellEditor: 'agNumberCellEditor',
              cellEditorParams: { precision: 2 },
              valueParser: numberValueParser(2),
            },
            {
              // 計算した値（（入数×ケース＋バラ）×バラ単価）を手で直せる。
              headerName: '金額',
              field: 'amount',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 110,
              valueFormatter: numFmt,
              cellStyle: manualOnlyNumberStyle,
              editable: manualOnlyEditable,
              cellEditor: 'agNumberCellEditor',
              cellEditorParams: { precision: 0 },
              valueParser: numberValueParser(0),
            },
          ],
        },
        {
          // ④支払情報。請求NETから上書きする支払NET2列をグループの先頭に置く。
          headerName: '支払情報',
          children: [
            {
              headerName: '支払NET（追加口分）',
              field: 'addNet',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 160,
              valueFormatter: numFmt,
              cellStyle: inputCellStyle,
              editable: (p) => !p.data?.isTotal,
              // 数値入力ボックス（小数第2位まで＝小数第3位を四捨五入）。
              cellEditor: 'agNumberCellEditor',
              cellEditorParams: { precision: 2 },
              valueParser: numberValueParser(2),
            },
            {
              headerName: '支払NET（全体）',
              field: 'payNet',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 130,
              valueFormatter: numFmt,
              cellStyle: inputCellStyle,
              editable: (p) => !p.data?.isTotal,
              // 数値入力ボックス（小数第2位まで＝小数第3位を四捨五入）。
              cellEditor: 'agNumberCellEditor',
              cellEditorParams: { precision: 2 },
              valueParser: numberValueParser(2),
            },
            {
              headerName: 'ケース',
              field: 'payCases',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 80,
              valueFormatter: numFmt,
              cellStyle: inputCellStyle,
              editable: (p) => !p.data?.isTotal,
              // 数値入力ボックス（整数）。
              cellEditor: 'agNumberCellEditor',
              cellEditorParams: { precision: 0 },
              valueParser: numberValueParser(0),
            },
            {
              headerName: 'バラ',
              field: 'payLoose',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 70,
              valueFormatter: numFmt,
              cellStyle: inputCellStyle,
              editable: (p) => !p.data?.isTotal,
              // 数値入力ボックス（整数）。
              cellEditor: 'agNumberCellEditor',
              cellEditorParams: { precision: 0 },
              valueParser: numberValueParser(0),
            },
            {
              headerName: '追加口バラ単価',
              field: 'addUnit',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 140,
              valueFormatter: numFmt,
              cellStyle: rightStyle,
            },
            {
              headerName: '拡売費バラ単価\n（NET未承認）',
              field: 'expUnit',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 140,
              valueFormatter: numFmt,
              cellStyle: rightStyle,
            },
            {
              headerName: '追加口金額',
              field: 'addAmount',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 110,
              valueFormatter: numFmt,
              cellStyle: rightStyle,
            },
            {
              headerName: '拡売費金額\n（NET未承認）',
              field: 'expAmount',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 120,
              valueFormatter: numFmt,
              cellStyle: rightStyle,
            },
            {
              headerName: '支払金額',
              field: 'payAmount',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 110,
              valueFormatter: numFmt,
              cellStyle: rightStyle,
            },
          ],
        },
        {
          // ⑤請求・支払差。ASD決定案の見出し行（5行目）に合わせ、差額のみを収める。
          headerName: '請求-支払',
          children: [
            {
              headerName: '差額',
              field: 'diff',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 90,
              valueFormatter: numFmt,
              cellStyle: rightStyle,
            },
          ],
        },
        {
          // 照合支払区分（見出し）／※差がある場合のみ（項目名）。
          // 差が発生した明細のみ手動で選択する。
          headerName: '照合支払区分',
          children: [
            {
              headerName: '※差がある場合のみ',
              field: 'matchType',
              width: 150,
              cellStyle: inputTextStyle,
              editable: (p) => !p.data?.isTotal,
              cellEditor: SingleComboboxCellEditor,
              cellEditorPopup: true,
              cellEditorParams: {
                comboOptions: toComboOptions(MATCH_TYPE_OPTIONS),
                placeholder: '照合支払区分を選択',
              },
            },
          ],
        },
        {
          headerName: '摘要2（社外用）',
          field: 'summary',
          width: 200,
          cellStyle: inputTextStyle,
          editable: (p) => !p.data?.isTotal,
        },
        {
          // 最終NET：明細行は常に手入力できる（函数無効チェックの状態を問わない）。
          headerName: '最終NET',
          field: 'finalNet',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 110,
          valueFormatter: numFmt,
          cellStyle: inputCellStyle,
          editable: (p) => !p.data?.isTotal,
          // 数値入力ボックス（小数第2位まで＝小数第3位を四捨五入）。
          cellEditor: 'agNumberCellEditor',
          cellEditorParams: { precision: 2 },
          valueParser: numberValueParser(2),
        },
        {
          headerName: '摘要1（社内用）',
          field: 'summary1',
          width: 240,
          cellStyle: inputTextStyle,
          editable: (p) => !p.data?.isTotal,
        },
        {
          // ⑦請求情報（請求書から引き継ぐ表示専用項目）。列の末尾に置く。
          //   税率は追加口では列を設けず一律8%を裏で保持する
          //   （→ 課題 No.0871／20260710_第16回 決定事項21）。
          headerName: '請求書情報',
          children: [
            // 手入力の明細だけ直せる（→ 補足1-5 b21.t35〜t37）。
            {
              headerName: '請求書ページ',
              field: 'billPage',
              width: 110,
              cellStyle: manualOnlyTextStyle,
              editable: manualOnlyEditable,
            },
            {
              headerName: '請求明細番号',
              field: 'billDetailNo',
              width: 120,
              cellStyle: manualOnlyTextStyle,
              editable: manualOnlyEditable,
            },
            {
              headerName: '販売店名',
              field: 'retailerName',
              width: 160,
              cellStyle: manualOnlyTextStyle,
              editable: manualOnlyEditable,
            },
          ],
        },
        {
          // 函数無効チェック：請求書情報の右に置き、セル内のチェックボックスで切り替える。
          // ONの明細は数式で再計算せず（recalcEntryRow が先頭で抜ける）、最終NETの手入力値を
          // 優先する。OFFに戻すと数式の値へ戻す。切替はセル編集と同じく
          // handleCellValueChanged で再計算・合計の更新・再描画を行う。
          // 公式の agCheckboxCellRenderer を使い、editable のためクリック／Space で値を切り替える。
          // 合計行はチェックボックスを出さず、編集もさせない。
          headerName: '函数無効チェック',
          field: 'funcCheck',
          width: 150,
          cellRendererSelector: (p) =>
            p.data?.isTotal
              ? undefined
              : { component: 'agCheckboxCellRenderer' },
          editable: (p) => !p.data?.isTotal,
          cellStyle: inputCenterStyle,
          // チェックボックスは中央揃え（→ 02 §7 セルの寄せ）。
          cellClass: 'cell-center',
        },
        {
          // 操作メニュー（拡売費処理）。拡売費一覧の操作列と同様、
          // 一番右へ右固定し、横スクロールしても常に見えるようにする。
          headerName: '',
          colId: 'rowMenu',
          pinned: 'right',
          lockPinned: true,
          sortable: false,
          filter: false,
          resizable: false,
          editable: false,
          width: 56,
          minWidth: 56,
          maxWidth: 56,
          suppressAutoSize: true,
          cellRenderer: EntryRowMenuCellRenderer,
          cellStyle: widgetCenterStyle,
        },
      ],
      []
    );

    const defaultColDef: ColDef = useMemo(
      () => ({
        // 共通の既定列定義（grid/）。ソート/リサイズ/フィルター、ヘッダーの…メニュー・
        // フィルターボタン非表示、tooltip を内包。フィルターは右クリックメニューから開く。
        ...GRID_DEFAULT_COL_DEF,
        // 合計行の文字列（"合計"等）が数値型と推論され "Invalid Number" 表示になるのを防ぐ
        cellDataType: false,
        // 計算式セルは計算式テキストを、それ以外は従来どおりセル値をツールチップ表示する。
        tooltipValueGetter: (params) => {
          const field = params.colDef.field;
          const row = params.data as AdditionalEntryData | undefined;
          if (field && row && isFormulaCell(field, row)) {
            return FORMULA_DEFS[field].tooltip(row);
          }
          if (field === 'planNet' && row && !row.isTotal) {
            return planNetTooltipOf(row);
          }
          return params.value ?? '';
        },
        // マウスオーバー中の計算式セルの参照元セル（`field::rowId`）に枠線を付ける。
        cellClassRules: {
          'formula-ref-highlight': (params) => {
            const field = params.colDef.field;
            const rowId = params.node?.id ?? '';
            return !!field && hoverRefsRef.current.has(`${field}::${rowId}`);
          },
        },
      }),
      []
    );

    return (
      <CollapsibleCard
        title={
          <span className="flex items-center gap-2">
            <span className={CARD_TITLE_CLASS}>追加口</span>
            <SplitPresenceBadge hasSplit={hasSplit} />
          </span>
        }
        open={isCardOpen}
        onOpenChange={setIsCardOpen}
        className="mb-4"
        headerActions={
          /* 操作ボタン（追加口分割・明細追加） */
          <div className="flex items-center gap-2">
            {/* 追加口分割：押下で分割先商流販売店の選択ペイン（下ペイン）を開く。
                明細の選択は不要で、追加口明細の全行が分割の対象（→ 第33回 決定事項3）。 */}
            <button
              type="button"
              onClick={() => onOpenSplit?.()}
              className="btn-toolbar-outline"
              aria-label="追加口分割"
            >
              追加口分割
            </button>
            {/* 明細追加ボタン（販売計画表（NET固定）の販売計画（詳細）と同様） */}
            <button
              onClick={() => onOpenAddDetail?.()}
              className="bg-white text-blue-600 px-3 py-1 rounded-lg border-2 border-blue-600 hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors whitespace-nowrap text-sm"
              aria-label="＋明細追加"
            >
              ＋明細追加
            </button>
          </div>
        }
      >
        <>
          {/* 合計表（請求／支払／差額 × 合計・税率別・データ元別。Excel「追加口カード」B4:K7）。
              今の合計サマリーバーから置き換えた（データ元別 → 課題 No.1275）。 */}
          <div className="p-4">
            <PaymentAmountBreakdownTable
              className="mb-4"
              ariaLabel="追加口の合計"
              items={[{ label: '合計', breakdown: breakdowns.entry }]}
            />

            {/* セルの色の凡例。どの色が何を表すかを一覧の直前で示す。 */}
            <CellColorLegend className="mb-2" items={ENTRY_COLOR_LEGEND} />

            {/* AG Grid（縦幅はリサイズハンドルで可変。JS動的値のため inline style 許容） */}
            <div
              className="additional-entry-grid"
              style={{ height: gridHeight, width: '100%' }}
            >
              {/* 罫線・ヘッダ背景・行高は共通テーマ（GRID_THEME）に委譲。 */}
              <style>{`
          /* 計算式セルにホバー中、計算に使われる参照元セルの枠線ハイライト */
          .additional-entry-grid .ag-cell.formula-ref-highlight {
            box-shadow: inset 0 0 0 2px var(--grid-source-highlight-border);
          }
          /* 函数無効チェック列：公式チェックボックスレンダラーは flex のラッパーで描画され
             text-align が効かないため、ラッパー側で中央に寄せる（→ 02 §7 セルの寄せ）。 */
          .additional-entry-grid .ag-cell[col-id='funcCheck'] .ag-checkbox-cell {
            justify-content: center;
          }
        `}</style>
              <AgGridReact
                rowData={entryRows}
                getRowId={getEntryRowId}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                // 計算式をツールチップで見せるため、省略されていないセルでも出す（グローバルは whenTruncated）
                tooltipShowMode="standard"
                // 操作メニュー（三点リーダー）のセルレンダラーへハンドラを渡す。
                context={gridContext}
                getContextMenuItems={gridFilterContextMenuItems}
                onCellValueChanged={handleCellValueChanged}
                onCellMouseOver={handleCellMouseOver}
                onCellMouseOut={handleCellMouseOut}
                suppressMovableColumns={true}
                ensureDomOrder={true}
                // 横スクロールバーを常時表示し、左右スクロールの存在を分かりやすくする
                alwaysShowHorizontalScroll={true}
                statusBar={GRID_STATUS_BAR}
                {...GRID_BASE_PROPS}
                {...gridColumnStateProps}
              />
            </div>
          </div>

          {/* リサイズハンドル：上下ドラッグでグリッドの縦幅を手動調整する。 */}
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="追加口一覧の高さを変更"
            onMouseDown={handleResizeStart}
            className="flex items-center justify-center h-3 cursor-ns-resize bg-gray-100 hover:bg-gray-200 border-t border-gray-200 transition-colors"
          >
            <div className="w-10 h-1 rounded-full bg-gray-400" />
          </div>
        </>
      </CollapsibleCard>
    );
  }
);
