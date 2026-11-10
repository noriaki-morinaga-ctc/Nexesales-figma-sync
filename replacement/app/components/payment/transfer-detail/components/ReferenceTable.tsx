// 振替詳細：「検印済み明細（振替元）」カード（基本情報と振替明細の間に常時表示）。
// 計画詳細(マージン率固定・NET入力)の「拡売費計画(コピー元)」ペイン
// （ReferenceTable）と同じ役割だが、後続の仕様変更が
// 計画詳細側へ波及しないよう独立コンポーネントとして新規作成している。
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  ICellRendererParams,
  RowDoubleClickedEvent,
} from 'ag-grid-community';
import { Search } from 'lucide-react';

import {
  GRID_DEFAULT_COL_DEF,
  GRID_BASE_PROPS,
  GRID_STATUS_BAR,
  GRID_COLORS,
  gridFilterContextMenuItems,
  withHeaderTooltips,
  useGridColumnState,
  GRID_NO_FILTER_COLUMN_TYPES,
  GRID_EMPTY_TEXT,
} from '../../../grid';
import { campaignClassCode } from '../../../../constants/paymentComboFieldOptions';
import { campaignClassFromCode } from '../../../../constants/expenseRelations';
import { OFFICE_OPTIONS } from '../../../../constants/paymentListSearchOptions';
import {
  STORE_NONE,
  PRIMARY_STORE_OPTIONS,
  tertiaryOptionsFor,
  storeOptionsFor,
} from '../../../../constants/storeHierarchy';
// 部署・営業担当者は「支払として存在する組合せ」から候補を求め、商流3項目と連動させる。
import {
  deptOptionsFor,
  staffOptionsFor,
  applyStoreOrgCascade,
  STORE_OWNER_ORG,
  type StoreOrgSelection,
} from '../../../../constants/paymentOrgCascade';
// 年月の表記変換（'YYYY年M月' ⇔ 'YYYY/MM'）は共通ヘルパーを使う。
import { toYearMonth, toMonthLabel } from '../../../../utils/common/yearMonth';
import {
  FORM_LABEL_CLASS,
  CARD_CLASS,
} from '../../../../../styles/commonStyles';
import { BASIC_INFO, type TransferDetailBasicInfoValues } from './TransferInfo';
import { CopyableArea } from '../../../ui/copyable-area';
import { CollapsibleCard } from '../../../ui/collapsible-card';
import { SearchClearButton } from '../../../ui/search-clear-button';
import {
  buildSearchSummary,
  formatSummaryValue,
} from '../../../ui/search-summary';
import {
  SingleCombobox,
  type SingleComboboxOption,
} from '../../../ui/single-combobox';

// 参照行（振替元で検印済みの明細）。
// 列構成は振替明細一覧の「支払No」〜「一次店」に準拠する。
// no は行の識別（getRowId）に使う内部値で、列としては表示しない
//（先頭列は「振替処理」ボタン）。
export interface ReferenceRow {
  no: number; // 行識別用の連番（非表示）
  paymentNo: string; // 支払No
  paymentCount: number; // 支払回数
  detailNo: number; // 明細No
  metaBrand: string; // メタブランド（サマリ商品から導出）
  product: string; // 商品
  payAmount: number; // 支払金額
  mgmtClass: string; // 管理区分（コード）
  mgmtClassName: string; // 管理区分名称
  mgmtCode: string; // 管理コード（コード）
  mgmtCodeName: string; // 管理コード名称
  measureClass: string; // 施策区分（区分値は名称から導出）
  measureCode: string; // 施策コード（名称はコードから導出）
  dept: string; // 費用負担部署
  store: string; // 販売店
  tertiaryStore: string; // 三次店
  primaryStore: string; // 一次店
  summary1: string; // 摘要1（社内用）
  summary2: string; // 摘要2（社外用）
  // 以下は列を持たず、行データとしてのみ保持する項目（画面には表示しない）。
  // 振替明細へ移動しても引き継げるよう、各行が値を持つ。
  postingMonth: string; // 計上年月
  targetMonth: string; // 対象年月
  office: string; // 事業場
  // 末端組織＝実際に伝票を入力した組織（部署配下の最下位組織）。列は持たず検索条件で使う。
  terminalOrg: string; // 末端組織
  staff: string; // 営業担当者
  // 支払先（コード:名称）。PRIMEのBIが支払先を軸に参照するため、振替詳細でも同等に保持する。
  payee: string;
}

// 検印済み明細（振替元）のモックデータ（22件）。
// ※ 振替明細一覧（NonProductExpensePane の EXPENSE_ROWS）とは別の明細を表すため、
//   支払No・支払回数・明細No・商品・金額が重複しないダミー値を設定している。
// ※ 行は「振替処理」「振替明細の削除」で両グリッド間を移動するため、
//   実データは親（TransferDetail）が state として保持する。ここでは初期値のみ定義する。
// 検索条件の選択肢の表示は「コード:名称」に統一する（事業場の選択肢と同じ体裁）。
// 値は行データと同じ「名称:コード」を保持し、絞り込み（codeOf での突き合わせ）と
// 基本情報からの初期値反映にそのまま使う。
const toCodeNameLabel = (nameCode: string): string => {
  const [name = '', code = ''] = nameCode.split(':');
  return code ? `${code}:${name}` : nameCode;
};

// サマリ商品名の先頭からメタブランドを導出する（モック用）。
// 当モックのサマリ商品は商品マスタ（productMasters）に無い名称のため、
// 支払詳細の拡売費一覧と同じメタブランド名（三ツ矢・カルピス 等）へ前方一致で寄せる。
// 商品を持たない明細（「-」）はメタブランドも「-」とする。
const META_BRANDS = [
  '三ツ矢',
  'ウィルキンソン',
  'カルピス',
  '十六茶',
  'ワンダ',
];
const metaBrandOf = (product: string): string =>
  META_BRANDS.find((brand) => product.startsWith(brand)) ?? '-';

// 基本情報の担当末端組織（④末端組織のみに紐づく支払で選択する）の選択肢。
// 検印済み明細が持つ末端組織と、販売店の担当組織（STORE_OWNER_ORG）の和集合から作る。
// 部署マスタ（ORG_DEPTS）とはコードが異なる組織があるため（九州営業部の二重コード）、
// 明細と同じ値を選択肢にして絞り込みの突き合わせと担当組織の表示を一致させる。
// 値は明細と同じ「名称:コード」、表示は「コード:名称」。
// 定義は INITIAL_REFERENCE_ROWS の直後（TRANSFER_TERMINAL_ORG_OPTIONS）。

// 摘要1（社内用）・摘要2（社外用）のモック値を組み立てる。
// 明細ごとの実データは持たないため、管理コード名称・商品・施策区分から機械的に生成し、
// 22件すべてに値が入るようにする（振替処理で振替明細へ引き継がれる項目）。
const withSummaries = (
  rows: Omit<
    ReferenceRow,
    'summary1' | 'summary2' | 'payee' | 'terminalOrg' | 'metaBrand'
  >[]
): ReferenceRow[] =>
  rows.map((r) => ({
    ...r,
    metaBrand: metaBrandOf(r.product),
    // 末端組織＝実際に伝票を入力した組織。代行入力では費用負担部署と異なるが、
    // 当モックは代行入力の明細を持たないため部署と同値とする
    //（支払詳細(追加口請求書有) の SearchPane と同じ扱い）。
    terminalOrg: r.dept,
    // 支払先は拡売費を支払う卸（一次店）とし、他画面と同じ「コード:名称」で保持する。
    payee: toCodeNameLabel(r.primaryStore),
    summary1: `${r.mgmtCodeName}の実施費用（社内）`,
    summary2:
      r.product === '-'
        ? `${r.measureClass}施策（社外）`
        : `${r.product} ${r.measureClass}（社外）`,
  }));

export const INITIAL_REFERENCE_ROWS: ReferenceRow[] = withSummaries([
  {
    no: 1,
    paymentNo: 'C2400NTS1',
    paymentCount: 1,
    detailNo: 1,
    product: '三ツ矢サイダーゼロ６００ＭＬＰ',
    payAmount: 88400,
    mgmtClass: '10',
    mgmtClassName: '売上連動拡売費A口',
    mgmtCode: 'RA002',
    mgmtCodeName: 'チラシ協賛A',
    measureClass: '販売促進',
    measureCode: 'SP011',
    dept: '北海道営業部:10003041',
    store: 'アークス:21100784',
    tertiaryStore: '国分　北海道ＤＣ:10863349',
    primaryStore: '国分グループ本社株式会社:10888066',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '北海道支社:10000658',
    staff: 'アサヒ　彩:5172738',
  },
  {
    no: 2,
    paymentNo: 'C2400NTS1',
    paymentCount: 1,
    detailNo: 2,
    product: 'カルピスソーダ５００ＭＬＰ',
    payAmount: 26400,
    mgmtClass: '60',
    mgmtClassName: '拡売費(固定費)本社口',
    mgmtCode: 'FH002',
    mgmtCodeName: '全国広告費',
    measureClass: 'スポット',
    measureCode: 'SS011',
    dept: '北海道営業部:10003041',
    store: 'アークス:21100784',
    tertiaryStore: '国分　北海道ＤＣ:10863349',
    primaryStore: '国分グループ本社株式会社:10888066',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '北海道支社:10000658',
    staff: 'アサヒ　彩:5172738',
  },
  {
    no: 3,
    paymentNo: 'C2400NTS2',
    paymentCount: 1,
    detailNo: 1,
    product: '十六茶ラテ２７５ＭＬＰ',
    payAmount: 143000,
    mgmtClass: '20',
    mgmtClassName: '売上連動拡売費B口',
    mgmtCode: 'RB002',
    mgmtCodeName: 'エンド展開A',
    measureClass: 'リピート',
    measureCode: 'SR011',
    dept: '東北営業部:10003056',
    store: 'ヨークベニマル:21100792',
    tertiaryStore: '日本アクセス　東北ＤＣ:10863356',
    primaryStore: '株式会社日本アクセス:10888051',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '東北支社:10000662',
    staff: 'アサヒ　悠人:5172739',
  },
  {
    no: 4,
    paymentNo: 'C2400NTS2',
    paymentCount: 2,
    detailNo: 2,
    product: '-',
    payAmount: 3500,
    mgmtClass: '40',
    mgmtClassName: '拡売費(固定費)A口',
    mgmtCode: 'FA002',
    mgmtCodeName: 'クーラー什器費',
    measureClass: '新規導入',
    measureCode: 'SN011',
    dept: '東北営業部:10003056',
    store: 'ヨークベニマル:21100792',
    tertiaryStore: '日本アクセス　東北ＤＣ:10863356',
    primaryStore: '株式会社日本アクセス:10888051',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '東北支社:10000662',
    staff: 'アサヒ　悠人:5172739',
  },
  {
    no: 5,
    paymentNo: 'C2400NTS3',
    paymentCount: 1,
    detailNo: 1,
    product: '三ツ矢サイダー５００ＭＬＰ',
    payAmount: 128000,
    mgmtClass: '10',
    mgmtClassName: '売上連動拡売費A口',
    mgmtCode: 'RA002',
    mgmtCodeName: 'チラシ協賛A',
    measureClass: '販売促進',
    measureCode: 'SP002',
    dept: '中部営業部:10003002',
    store: 'マックスバリュ東海:21100678',
    tertiaryStore: 'イオン中部ＲＤＣ:10863225',
    primaryStore: '加藤産業株式会社:10888032',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '中部本部:10000631',
    staff: 'アサヒ　次郎:5172735',
  },
  {
    no: 6,
    paymentNo: 'C2400NTO3',
    paymentCount: 1,
    detailNo: 1,
    product: 'カルピスウォーター５００ＭＬＰ',
    payAmount: 45500,
    mgmtClass: '20',
    mgmtClassName: '売上連動拡売費B口',
    mgmtCode: 'RB001',
    mgmtCodeName: '新規導入販促',
    measureClass: 'リピート',
    measureCode: 'SR002',
    dept: '首都圏営業第一部:10002985',
    store: 'イトーヨーカ堂:21100695',
    tertiaryStore: '伊藤忠食品　東日本ＤＣ:10863258',
    primaryStore: '伊藤忠食品株式会社:10888045',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '首都圏本部:10000623',
    staff: 'アサヒ　花子:5172734',
  },
  {
    no: 7,
    paymentNo: 'C2400NTO3',
    paymentCount: 1,
    detailNo: 2,
    product: '十六茶６００ＭＬＰ',
    payAmount: 82300,
    mgmtClass: '10',
    mgmtClassName: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    mgmtCodeName: '店頭定番販促',
    measureClass: '販売促進',
    measureCode: 'SP003',
    dept: '首都圏営業第二部:10002990',
    store: 'イオンリテール:21100677',
    tertiaryStore: 'イオン東北ＲＤＣ:10863223',
    primaryStore: '三菱食品株式会社（イオン）:10888030',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '首都圏本部:10000623',
    staff: 'アサヒ　太郎:5172733',
  },
  {
    no: 8,
    paymentNo: 'C2400NTO4',
    paymentCount: 1,
    detailNo: 1,
    product: 'ワンダ極微糖ボトル缶３７０ｇ',
    payAmount: 250000,
    mgmtClass: '10',
    mgmtClassName: '売上連動拡売費A口',
    mgmtCode: 'RA002',
    mgmtCodeName: 'チラシ協賛A',
    measureClass: '新規導入',
    measureCode: 'SN002',
    dept: '近畿営業部:10003015',
    store: '平和堂:21100711',
    tertiaryStore: '日本アクセス　関西ＤＣ:10863271',
    primaryStore: '株式会社日本アクセス:10888051',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '関西本部:10000645',
    staff: 'アサヒ　美咲:5172736',
  },
  {
    no: 9,
    paymentNo: 'C2400NTO4',
    paymentCount: 1,
    detailNo: 2,
    product: '-',
    payAmount: 900,
    mgmtClass: '40',
    mgmtClassName: '拡売費(固定費)A口',
    mgmtCode: 'FA002',
    mgmtCodeName: 'クーラー什器費',
    measureClass: 'スポット',
    measureCode: 'SS002',
    dept: '近畿営業部:10003015',
    store: '平和堂:21100711',
    tertiaryStore: '日本アクセス　関西ＤＣ:10863271',
    primaryStore: '株式会社日本アクセス:10888051',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '関西本部:10000645',
    staff: 'アサヒ　美咲:5172736',
  },
  {
    no: 10,
    paymentNo: 'C2400NTO5',
    paymentCount: 1,
    detailNo: 1,
    product: '三ツ矢サイダー１．５ＬＰ',
    payAmount: 64800,
    mgmtClass: '60',
    mgmtClassName: '拡売費(固定費)本社口',
    mgmtCode: 'FH001',
    mgmtCodeName: '本社広告枠',
    measureClass: '販売促進',
    measureCode: 'SP004',
    dept: '九州営業部:10003028',
    store: 'イズミ:21100725',
    tertiaryStore: '三菱食品　九州ＤＣ:10863288',
    primaryStore: '三菱食品株式会社（イオン）:10888030',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '九州支社:10000679',
    staff: 'アサヒ　健太:5172737',
  },
  {
    no: 11,
    paymentNo: 'C2400NTO5',
    paymentCount: 2,
    detailNo: 2,
    product: 'ワンダモーニングショット６ＰＮ',
    payAmount: 37600,
    mgmtClass: '20',
    mgmtClassName: '売上連動拡売費B口',
    mgmtCode: 'RB001',
    mgmtCodeName: '新規導入販促',
    measureClass: 'リピート',
    measureCode: 'SR003',
    dept: '九州営業部:10003028',
    store: 'イズミ:21100725',
    tertiaryStore: '三菱食品　九州ＤＣ:10863288',
    primaryStore: '三菱食品株式会社（イオン）:10888030',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '九州支社:10000679',
    staff: 'アサヒ　健太:5172737',
  },
  {
    no: 12,
    paymentNo: 'C2400NTO6',
    paymentCount: 1,
    detailNo: 1,
    product: 'ウィルキンソンタンサン１．０ＬＰ',
    payAmount: 15400,
    mgmtClass: '10',
    mgmtClassName: '売上連動拡売費A口',
    mgmtCode: 'RA002',
    mgmtCodeName: 'チラシ協賛A',
    measureClass: '新規導入',
    measureCode: 'SN003',
    dept: '首都圏営業第一部:10002985',
    store: 'サミット:21100732',
    tertiaryStore: '国分　首都圏ＤＣ:10863294',
    primaryStore: '国分グループ本社株式会社:10888066',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '首都圏本部:10000623',
    staff: 'アサヒ　花子:5172734',
  },
  {
    no: 13,
    paymentNo: 'C2400NTO6',
    paymentCount: 1,
    detailNo: 2,
    product: 'カルピスウォーター１．５ＬＰ',
    payAmount: 96250,
    mgmtClass: '10',
    mgmtClassName: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    mgmtCodeName: '店頭定番販促',
    measureClass: '販売促進',
    measureCode: 'SP005',
    dept: '首都圏営業第一部:10002985',
    store: 'サミット:21100732',
    tertiaryStore: '国分　首都圏ＤＣ:10863294',
    primaryStore: '国分グループ本社株式会社:10888066',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '首都圏本部:10000623',
    staff: 'アサヒ　花子:5172734',
  },
  {
    no: 14,
    paymentNo: 'C2400NTO7',
    paymentCount: 1,
    detailNo: 1,
    product: '十六茶２ＬＰ',
    payAmount: 22000,
    mgmtClass: '60',
    mgmtClassName: '拡売費(固定費)本社口',
    mgmtCode: 'FH002',
    mgmtCodeName: '全国広告費',
    measureClass: 'スポット',
    measureCode: 'SS003',
    dept: '中部営業部:10003002',
    store: 'バロー:21100744',
    tertiaryStore: '加藤産業　中部ＤＣ:10863301',
    primaryStore: '加藤産業株式会社:10888032',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '中部本部:10000631',
    staff: 'アサヒ　次郎:5172735',
  },
  {
    no: 15,
    paymentNo: 'C2400NTO7',
    paymentCount: 2,
    detailNo: 2,
    product: '-',
    payAmount: 1200,
    mgmtClass: '40',
    mgmtClassName: '拡売費(固定費)A口',
    mgmtCode: 'FA001',
    mgmtCodeName: '什器設置費',
    measureClass: 'スポット',
    measureCode: 'SS004',
    dept: '中部営業部:10003002',
    store: 'バロー:21100744',
    tertiaryStore: '加藤産業　中部ＤＣ:10863301',
    primaryStore: '加藤産業株式会社:10888032',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '中部本部:10000631',
    staff: 'アサヒ　次郎:5172735',
  },
  {
    no: 16,
    paymentNo: 'C2400NTO8',
    paymentCount: 1,
    detailNo: 1,
    product: '三ツ矢サイダー２５０ＭＬ缶',
    payAmount: 53900,
    mgmtClass: '20',
    mgmtClassName: '売上連動拡売費B口',
    mgmtCode: 'RB002',
    mgmtCodeName: 'エンド展開A',
    measureClass: 'リピート',
    measureCode: 'SR004',
    dept: '首都圏営業第二部:10002990',
    store: 'ヤオコー:21100758',
    tertiaryStore: '三菱食品　関東ＤＣ:10863312',
    primaryStore: '三菱食品株式会社（イオン）:10888030',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '首都圏本部:10000623',
    staff: 'アサヒ　太郎:5172733',
  },
  {
    no: 17,
    paymentNo: 'C2400NTO8',
    paymentCount: 1,
    detailNo: 2,
    product: 'ワンダ極微糖ボトル缶３７０ｇ',
    payAmount: 78400,
    mgmtClass: '10',
    mgmtClassName: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    mgmtCodeName: '店頭定番販促',
    measureClass: '販売促進',
    measureCode: 'SP006',
    dept: '首都圏営業第二部:10002990',
    store: 'ヤオコー:21100758',
    tertiaryStore: '三菱食品　関東ＤＣ:10863312',
    primaryStore: '三菱食品株式会社（イオン）:10888030',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '首都圏本部:10000623',
    staff: 'アサヒ　太郎:5172733',
  },
  {
    no: 18,
    paymentNo: 'C2400NTO9',
    paymentCount: 1,
    detailNo: 1,
    product: 'カルピスウォーター５００ＭＬＰ',
    payAmount: 41250,
    mgmtClass: '60',
    mgmtClassName: '拡売費(固定費)本社口',
    mgmtCode: 'FH001',
    mgmtCodeName: '本社広告枠',
    measureClass: '新規導入',
    measureCode: 'SN004',
    dept: '近畿営業部:10003015',
    store: 'イズミヤ:21100766',
    tertiaryStore: '国分　関西ＤＣ:10863325',
    primaryStore: '国分グループ本社株式会社:10888066',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '関西本部:10000645',
    staff: 'アサヒ　美咲:5172736',
  },
  {
    no: 19,
    paymentNo: 'C2400NTO9',
    paymentCount: 2,
    detailNo: 2,
    product: 'ウィルキンソンタンサン５００ＭＬＰ',
    payAmount: 18700,
    mgmtClass: '10',
    mgmtClassName: '売上連動拡売費A口',
    mgmtCode: 'RA002',
    mgmtCodeName: 'チラシ協賛A',
    measureClass: 'リピート',
    measureCode: 'SR005',
    dept: '近畿営業部:10003015',
    store: 'イズミヤ:21100766',
    tertiaryStore: '国分　関西ＤＣ:10863325',
    primaryStore: '国分グループ本社株式会社:10888066',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '関西本部:10000645',
    staff: 'アサヒ　美咲:5172736',
  },
  {
    no: 20,
    paymentNo: 'C2400NT10',
    paymentCount: 1,
    detailNo: 1,
    product: '十六茶６００ＭＬＰ',
    payAmount: 110000,
    mgmtClass: '20',
    mgmtClassName: '売上連動拡売費B口',
    mgmtCode: 'RB001',
    mgmtCodeName: '新規導入販促',
    measureClass: '販売促進',
    measureCode: 'SP007',
    dept: '九州営業部:10003028',
    store: 'サンリブ:21100779',
    tertiaryStore: '日本アクセス　九州ＤＣ:10863337',
    primaryStore: '株式会社日本アクセス:10888051',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '九州支社:10000679',
    staff: 'アサヒ　健太:5172737',
  },
  // 支払No「C2400NT11」の2明細。当画面の基本情報（TransferDetailSearch）と同じ商流の明細として、
  //   ・費用負担部署：基本情報の「部署」（BASIC_INFO.dept）
  //   ・販売店：イオンリテール:21100677
  //   ・三次店・一次店：上記販売店から一意に定まる値（TransferInfo の STORE_HIERARCHY より
  //     イオン東北ＲＤＣ:10863223 → 三菱食品株式会社（イオン）:10888030）
  // を設定する。その他の列はダミー値。
  {
    no: 21,
    paymentNo: 'C2400NT11',
    paymentCount: 1,
    detailNo: 1,
    product: 'カルピスウォーター２ＬＰ',
    payAmount: 72600,
    mgmtClass: '10',
    mgmtClassName: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    mgmtCodeName: '店頭定番販促',
    measureClass: '販売促進',
    measureCode: 'SP012',
    dept: BASIC_INFO.dept,
    store: 'イオンリテール:21100677',
    tertiaryStore: 'イオン東北ＲＤＣ:10863223',
    primaryStore: '三菱食品株式会社（イオン）:10888030',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '首都圏本部:10000623',
    staff: 'アサヒ　太郎:5172733',
  },
  {
    no: 22,
    paymentNo: 'C2400NT11',
    paymentCount: 1,
    detailNo: 2,
    product: 'ウィルキンソンジンジャエール５００ＭＬＰ',
    payAmount: 34100,
    mgmtClass: '60',
    mgmtClassName: '拡売費(固定費)本社口',
    mgmtCode: 'FH002',
    mgmtCodeName: '全国広告費',
    measureClass: 'スポット',
    measureCode: 'SS012',
    dept: BASIC_INFO.dept,
    store: 'イオンリテール:21100677',
    tertiaryStore: 'イオン東北ＲＤＣ:10863223',
    primaryStore: '三菱食品株式会社（イオン）:10888030',
    postingMonth: '2025年10月',
    targetMonth: '2025年10月',
    office: '首都圏本部:10000623',
    staff: 'アサヒ　太郎:5172733',
  },
]);

// 基本情報の担当末端組織の選択肢（生成方針は上のコメント参照）。
export const TRANSFER_TERMINAL_ORG_OPTIONS: SingleComboboxOption[] = Array.from(
  new Set([
    ...INITIAL_REFERENCE_ROWS.map((r) => r.terminalOrg),
    ...Object.values(STORE_OWNER_ORG).map((o) => o.dept),
  ])
)
  .sort()
  .map((value) => ({ value, label: toCodeNameLabel(value) }));

// 数値表示（カンマ区切り・小数2桁まで）。
const numFmt = (p: { value: unknown }) =>
  typeof p.value === 'number'
    ? p.value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : String(p.value ?? '') || GRID_EMPTY_TEXT;

// 検索条件の初期値（クリアボタンで戻す値）。項目は支払一覧の検索条件に準じる
//（ステータス・計画紐付ステータス・伝票種別・他部門受領ありは当画面では持たず、
//  代わりに振替詳細の基本情報と同じ 販売店／一次店／三次店 を持つ）。
// 基本情報が渡される（「振替元を固定する」）場合はその値が初期値になるため、
// ここでの組織系の既定は「未選択＝絞り込まない」とする。
const INITIAL_OFFICE = ''; // 事業場：未選択（絞らない）

// 「名称:コード」「コード:名称」いずれの表記からもコード（数字部分）を取り出す。
// 行データは「名称:コード」、検索条件の選択肢ラベルは「コード:名称」のため、
// 突き合わせはコードで行う。
const codeOf = (value: string | undefined): string => {
  if (!value) return '';
  const parts = value.split(':');
  return parts.find((p) => /^\d+$/.test(p.trim()))?.trim() ?? '';
};

// 「名称:コード」の選択肢を、表示だけ「コード:名称」に置き換えた選択肢へ変換する。
const toSearchOptions = (
  options: { value: string }[]
): SingleComboboxOption[] =>
  options.map((o) => ({ value: o.value, label: toCodeNameLabel(o.value) }));

// 選択中の値（option の value）に対応するコードを取り出す。
const selectedCode = (
  options: SingleComboboxOption[],
  value: string
): string => {
  if (!value) return '';
  const label = options.find((o) => o.value === value)?.label;
  return codeOf(label ?? value);
};

// 基本情報の値「名称:コード」を、検索条件の選択肢（ラベルは「コード:名称」）に対応付ける。
// コードが一致する選択肢があればそれを選び、無ければ基本情報の値から
// 「コード:名称」の選択肢を作って末尾に追加し、それを選択する
//（基本情報の値をそのまま検索条件に表示するため）。
const resolveSearchOption = (
  options: SingleComboboxOption[],
  nameCode: string | undefined,
  fallbackValue: string
): { options: SingleComboboxOption[]; value: string } => {
  if (!nameCode) return { options, value: fallbackValue };
  const [name = '', code = ''] = nameCode.split(':');
  const matched = options.find((o) => code && o.label.startsWith(`${code}:`));
  if (matched) return { options, value: matched.value };
  const added: SingleComboboxOption = {
    value: code || nameCode,
    label: code ? `${code}:${name}` : nameCode,
  };
  return { options: [...options, added], value: added.value };
};

// 参照専用セルの共通スタイル（灰背景）と右寄せ版。
const RO_STYLE = { backgroundColor: GRID_COLORS.readonly } as const;
// 右寄せ列は共通クラス cell-right（grid.css）を cellClass で指定する（→ 02 §7）。
const RIGHT_CELL_CLASS = 'cell-right';
// 操作ボタン列（振替処理）のセル：操作ウィジェットのため白背景。
const BUTTON_CELL_STYLE = {
  backgroundColor: GRID_COLORS.editable,
} as const;

// 「振替処理」ボタンセル（先頭列）。押下で当該明細を振替元として振替処理へ進む。
// 振替明細一覧の「分割」ボタン（CostSplitCellRenderer）と同じ見た目に揃える。
const TransferCellRenderer = (props: ICellRendererParams<ReferenceRow>) => {
  const { onTransferProcess, transferDisabled, transferDisabledReason } =
    props.context as {
      onTransferProcess?: (row: ReferenceRow) => void;
      transferDisabled?: boolean;
      transferDisabledReason?: string;
    };
  return (
    <div className="flex items-center justify-center h-full">
      <button
        onClick={
          transferDisabled
            ? undefined
            : () => props.data && onTransferProcess?.(props.data)
        }
        disabled={transferDisabled}
        className={
          transferDisabled
            ? 'px-3 py-1 rounded-full bg-white text-gray-400 border-2 border-gray-300 font-medium cursor-not-allowed text-sm whitespace-nowrap'
            : 'px-3 py-1 rounded-full bg-white text-blue-600 border-2 border-blue-600 font-medium hover:bg-blue-50 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm whitespace-nowrap'
        }
        aria-label="振替処理"
        title={transferDisabled ? transferDisabledReason : '振替処理'}
      >
        振替処理
      </button>
    </div>
  );
};

interface ReferenceTableProps {
  /** 対象年月（YYYY/MM）。基本情報で選択した値をテキスト表示し、絞り込みにも使う */
  targetMonth?: string;
  /** 表示する検印済み明細。未指定時は初期モックデータを表示する */
  rows?: ReferenceRow[];
  /**
   * 「振替処理」ボタン押下、または行のダブルクリック。押下行を振替明細へ移動する。
   * 当グリッドは参照専用でセル編集が無いため、ダブルクリックを操作に割り当てられる
   *（請求一覧の「入力」ボタン／行ダブルクリックと同じ扱い）。
   */
  onTransferProcess?: (row: ReferenceRow) => void;
  /**
   * 振替詳細の基本情報の値。「振替元を固定する」のときに渡され、
   * 検索条件の対応する項目の初期値（クリアで戻る値）として反映する。
   */
  basicInfo?: TransferDetailBasicInfoValues;
  /**
   * 検索条件を非活性にする（「振替元を固定する」のとき true）。
   * 「振替元を固定する」では基本情報の値で絞り込むため、検索条件は設定操作できない。
   */
  searchDisabled?: boolean;
  /**
   * 基本情報の販売店・担当末端組織がともに未選択で、かつ「振替元を固定する」か。
   * 振替元は商流販売店を1つに固定する必要があり（20260721_第21回_共通 決定事項1）、
   * 商流が定まらないと候補を絞れないため、明細そのものを出さない。
   */
  hideRowsUntilStore?: boolean;
  /**
   * 「振替処理」を止めるか（基本情報の販売店が未選択のとき）。
   * 「振替先を固定する」では明細は自由に探せてよいが、商流未選択のまま振替処理すると
   * 枝番行の振替先が空欄かつ編集不可になるため、操作だけを止める。
   */
  transferDisabled?: boolean;
  /** 「振替処理」を止めている理由（ボタンのツールチップに出す） */
  transferDisabledReason?: string;
}

export function ReferenceTable({
  targetMonth = '2025/10',
  rows = INITIAL_REFERENCE_ROWS,
  onTransferProcess,
  basicInfo,
  searchDisabled = false,
  hideRowsUntilStore = false,
  transferDisabled = false,
  transferDisabledReason,
}: ReferenceTableProps) {
  // カード全体の開閉状態（既定は展開）。
  const [isCardOpen, setIsCardOpen] = useState(true);
  // 検索条件カードの開閉状態（既定は展開）。縦幅を抑えられるよう折り畳めるようにする。
  const [isSearchOpen, setIsSearchOpen] = useState(true);

  // 基本情報の事業場・部署・営業担当者に対応する選択肢と値。
  // 基本情報が変わったら下の useEffect で検索条件へ反映し直す。
  const officeField = useMemo(
    () =>
      resolveSearchOption(OFFICE_OPTIONS, basicInfo?.office, INITIAL_OFFICE),
    [basicInfo?.office]
  );
  // 対象年月は基本情報で選択した値をテキスト表示する（当画面では変更しない）。
  const searchTargetMonth = basicInfo?.targetMonth ?? targetMonth;

  // 検索条件の状態管理（項目構成は支払一覧の検索条件に準じる）。
  // 部署・営業担当者は固定マスタではなく「支払として存在する組合せ」から候補を求めるため、
  // 行データと同じ「名称:コード」を値として保持する（基本情報の値をそのまま初期値にできる）。
  const [office, setOffice] = useState(officeField.value);
  const [department, setDepartment] = useState(basicInfo?.dept ?? '');
  const [terminalOrg, setTerminalOrg] = useState(basicInfo?.terminalOrg ?? '');
  const [salesRep, setSalesRep] = useState(basicInfo?.staff ?? '');

  // 販売店・一次店・三次店（振替詳細の基本情報と同じ3項目・同じ連動）。
  // 基本情報があればその値を初期値とし、無ければ 一次店・三次店＝未選択（空）、販売店＝「-」。
  const [primaryStore, setPrimaryStore] = useState<string>(
    basicInfo?.primaryStore ?? ''
  );
  const [tertiaryStore, setTertiaryStore] = useState<string>(
    basicInfo?.tertiaryStore ?? ''
  );
  const [store, setStore] = useState<string>(basicInfo?.store ?? STORE_NONE);

  // 選択状態に応じた選択肢（一次店は常に全件）。
  const tertiaryOptions = useMemo(
    () => tertiaryOptionsFor(primaryStore),
    [primaryStore]
  );
  const storeOptions = useMemo(
    () => storeOptionsFor(primaryStore, tertiaryStore),
    [primaryStore, tertiaryStore]
  );

  // 部署・営業担当者の選択肢。対象年月の支払として存在する組合せのうち、
  // 現在の販売店・もう一方の組織項目に合致するものだけを候補にする。
  const departmentOptions = useMemo(
    () => toSearchOptions(deptOptionsFor(store, salesRep, searchTargetMonth)),
    [searchTargetMonth, store, salesRep]
  );
  const salesRepOptions = useMemo(
    () =>
      toSearchOptions(staffOptionsFor(store, department, searchTargetMonth)),
    [searchTargetMonth, store, department]
  );

  // 末端組織の選択肢。固定マスタではなく当画面の明細が持つ値から重複を除いて作る
  //（モックでは費用負担部署と同値のため、部署と同じ顔ぶれになる）。
  const terminalOrgOptions = useMemo(
    () =>
      toSearchOptions(
        Array.from(new Set(rows.map((r) => r.terminalOrg)))
          .sort()
          .map((value) => ({ value }))
      ),
    [rows]
  );

  // 商流3項目（一次店・三次店・販売店）と組織2項目（部署・営業担当者）の連動をまとめて適用する。
  // 挙動は振替先明細（費用振替ペイン）と同じ純関数（applyStoreOrgCascade）に委譲する。
  const applyCascade = (field: keyof StoreOrgSelection, value: string) => {
    const next = applyStoreOrgCascade(
      { primaryStore, tertiaryStore, store, dept: department, staff: salesRep },
      field,
      value,
      searchTargetMonth
    );
    setPrimaryStore(next.primaryStore);
    setTertiaryStore(next.tertiaryStore);
    setStore(next.store);
    setDepartment(next.dept);
    setSalesRep(next.staff);
  };

  const handlePrimaryStoreChange = (v: string) =>
    applyCascade('primaryStore', v);
  const handleTertiaryStoreChange = (v: string) =>
    applyCascade('tertiaryStore', v);
  const handleStoreChange = (v: string) => applyCascade('store', v);
  const handleDepartmentChange = (v: string) => applyCascade('dept', v);
  const handleSalesRepChange = (v: string) => applyCascade('staff', v);

  // 検索条件で明細を絞り込む（各条件は AND。未選択の条件は絞り込まない）。
  //   年月：基準（計上年月／対象年月）に対応する行の年月が 開始〜終了 の範囲内か
  //   商流・組織：コードで突き合わせ（行データは「名称:コード」、選択肢は「コード:名称」）
  const filteredRows = useMemo(() => {
    // 「振替元を固定する」で販売店・担当末端組織が未選択のうちは明細を出さない（決定事項1）。
    if (hideRowsUntilStore) return [];
    const officeCode = selectedCode(officeField.options, office);
    const deptCode = codeOf(department);
    const staffCode = codeOf(salesRep);
    const terminalOrgCode = codeOf(terminalOrg);
    const storeCode = store !== STORE_NONE ? codeOf(store) : '';
    const primaryCode = codeOf(primaryStore);
    const tertiaryCode = codeOf(tertiaryStore);

    return rows.filter((r) => {
      // 年月は基本情報で選択した対象年月に一致する行のみを対象にする。
      if (searchTargetMonth && toYearMonth(r.targetMonth) !== searchTargetMonth)
        return false;
      if (storeCode && codeOf(r.store) !== storeCode) return false;
      if (primaryCode && codeOf(r.primaryStore) !== primaryCode) return false;
      if (tertiaryCode && codeOf(r.tertiaryStore) !== tertiaryCode)
        return false;
      if (officeCode && codeOf(r.office) !== officeCode) return false;
      if (deptCode && codeOf(r.dept) !== deptCode) return false;
      if (staffCode && codeOf(r.staff) !== staffCode) return false;
      if (terminalOrgCode && codeOf(r.terminalOrg) !== terminalOrgCode)
        return false;
      return true;
    });
  }, [
    rows,
    searchTargetMonth,
    store,
    primaryStore,
    tertiaryStore,
    office,
    department,
    terminalOrg,
    salesRep,
    officeField.options,
    hideRowsUntilStore,
  ]);

  // クリア：検索条件をペインを開いた時点の初期値に戻す
  //（基本情報が渡されている場合はその値、無ければ当画面の既定値）。
  // 検索条件カードを折り畳んだときに見出しの行へ出す要約（値が入っている項目だけ。UI/UX UX-024）。
  // 販売店の「-」（未選択）は値なしとして出さない
  const searchSummary = buildSearchSummary([
    { label: '対象年月', value: searchTargetMonth },
    {
      label: '販売店',
      value: formatSummaryValue(
        store === STORE_NONE ? '' : store,
        storeOptions
      ),
    },
    {
      label: '三次店',
      value: formatSummaryValue(tertiaryStore, tertiaryOptions),
    },
    {
      label: '一次店',
      value: formatSummaryValue(primaryStore, PRIMARY_STORE_OPTIONS),
    },
    { label: '事業場', value: formatSummaryValue(office, officeField.options) },
    { label: '部署', value: formatSummaryValue(department, departmentOptions) },
    {
      label: '末端組織',
      value: formatSummaryValue(terminalOrg, terminalOrgOptions),
    },
    {
      label: '営業担当者',
      value: formatSummaryValue(salesRep, salesRepOptions),
    },
  ]);

  const handleClear = () => {
    setOffice(officeField.value);
    setDepartment(basicInfo?.dept ?? '');
    setTerminalOrg(basicInfo?.terminalOrg ?? '');
    setSalesRep(basicInfo?.staff ?? '');
    setPrimaryStore(basicInfo?.primaryStore ?? '');
    setTertiaryStore(basicInfo?.tertiaryStore ?? '');
    setStore(basicInfo?.store ?? STORE_NONE);
  };

  // 基本情報（固定指定・商流・年月・組織）が変わったら、対応する検索条件を初期値として反映し直す。
  // 下ペイン方式では開くたびに再マウントされて初期値が入っていたが、
  // カードとして常時表示するようになったため明示的に同期する。
  useEffect(() => {
    setOffice(officeField.value);
    setDepartment(basicInfo?.dept ?? '');
    setTerminalOrg(basicInfo?.terminalOrg ?? '');
    setSalesRep(basicInfo?.staff ?? '');
    setPrimaryStore(basicInfo?.primaryStore ?? '');
    setTertiaryStore(basicInfo?.tertiaryStore ?? '');
    setStore(basicInfo?.store ?? STORE_NONE);
  }, [
    officeField.value,
    basicInfo?.dept,
    basicInfo?.terminalOrg,
    basicInfo?.staff,
    basicInfo?.primaryStore,
    basicInfo?.tertiaryStore,
    basicInfo?.store,
  ]);

  const columnDefs: ColDef<ReferenceRow>[] = useMemo(
    () =>
      withHeaderTooltips([
        {
          // 先頭列は No. の値に代えて「振替処理」ボタンを表示する操作列。
          headerName: '',
          colId: 'transferProcess',
          width: 96,
          minWidth: 96,
          sortable: false,
          filter: false,
          resizable: false,
          suppressAutoSize: true,
          cellRenderer: TransferCellRenderer,
          cellStyle: BUTTON_CELL_STYLE,
        },
        {
          headerName: '支払No',
          field: 'paymentNo',
          width: 104,
          cellStyle: RO_STYLE,
        },
        {
          headerName: '支払回数',
          field: 'paymentCount',
          width: 80,
          cellClass: RIGHT_CELL_CLASS,
          cellStyle: RO_STYLE,
        },
        {
          headerName: '明細No',
          field: 'detailNo',
          width: 80,
          cellClass: RIGHT_CELL_CLASS,
          cellStyle: RO_STYLE,
        },
        {
          // メタブランド：支払詳細の拡売費一覧と同じく、サマリ商品の左に置く。
          headerName: 'メタブランド',
          field: 'metaBrand',
          width: 112,
          cellStyle: RO_STYLE,
        },
        {
          headerName: 'サマリ商品',
          field: 'product',
          width: 176,
          cellStyle: RO_STYLE,
        },
        {
          headerName: '支払金額',
          field: 'payAmount',
          width: 96,
          valueFormatter: numFmt,
          cellClass: RIGHT_CELL_CLASS,
          cellStyle: RO_STYLE,
        },
        {
          // コード・名称はそれぞれ別フィールドで保持し、各列が対応フィールドを参照する。
          headerName: '管理区分',
          field: 'mgmtClass',
          width: 104,
          cellStyle: RO_STYLE,
        },
        {
          headerName: '管理区分名称',
          field: 'mgmtClassName',
          width: 160,
          cellStyle: RO_STYLE,
        },
        {
          headerName: '管理コード',
          field: 'mgmtCode',
          width: 104,
          cellStyle: RO_STYLE,
        },
        {
          headerName: '管理コード名称',
          field: 'mgmtCodeName',
          width: 160,
          cellStyle: RO_STYLE,
        },
        {
          // 施策区分（コード＝区分値）。名称 measureClass から区分値を導出して表示する。
          headerName: '施策区分',
          colId: 'measureClassCode',
          field: 'measureClass',
          width: 88,
          valueFormatter: (p) =>
            campaignClassCode(String(p.value ?? '')) || GRID_EMPTY_TEXT,
          cellStyle: RO_STYLE,
        },
        {
          // 施策区分名称：measureClass の名称をそのまま表示する。
          headerName: '施策区分名称',
          colId: 'measureClassName',
          field: 'measureClass',
          width: 120,
          cellStyle: RO_STYLE,
        },
        {
          headerName: '施策コード',
          colId: 'measureCodeCode',
          field: 'measureCode',
          width: 104,
          cellStyle: RO_STYLE,
        },
        {
          // 施策コード名称：コード measureCode が属する施策区分名を導出して表示する。
          headerName: '施策コード名称',
          colId: 'measureCodeName',
          field: 'measureCode',
          width: 120,
          valueFormatter: (p) =>
            campaignClassFromCode(String(p.value ?? '')) || GRID_EMPTY_TEXT,
          cellStyle: RO_STYLE,
        },
        {
          headerName: '費用負担部署',
          field: 'dept',
          width: 160,
          cellStyle: RO_STYLE,
        },
        {
          headerName: '販売店',
          field: 'store',
          width: 160,
          cellStyle: RO_STYLE,
        },
        {
          headerName: '三次店',
          field: 'tertiaryStore',
          width: 160,
          cellStyle: RO_STYLE,
        },
        {
          headerName: '一次店',
          field: 'primaryStore',
          width: 176,
          cellStyle: RO_STYLE,
        },
        {
          headerName: '摘要1（社内用）',
          field: 'summary1',
          width: 160,
          cellStyle: RO_STYLE,
        },
        {
          headerName: '摘要2（社外用）',
          field: 'summary2',
          width: 160,
          cellStyle: RO_STYLE,
        },
      ]),
    []
  );

  // 列状態（列幅・並び順・ソート）の永続化（→ 02 §7）。
  const gridColumnStateProps = useGridColumnState(
    'allocateDetail.reference.columnState.v2'
  );

  // 行ID（参照安定化のため useCallback 化：→ 02 §7.1）。
  const getRowId = useCallback((p: any) => `ref-${p.data.no}`, []);

  // セルレンダラーへ渡すハンドラー群（AG Grid の context）。
  const gridContext = useMemo(
    () => ({ onTransferProcess, transferDisabled, transferDisabledReason }),
    [onTransferProcess, transferDisabled, transferDisabledReason]
  );

  const defaultColDef: ColDef = useMemo(
    () => ({
      // 共通の既定列定義（grid/）。参照専用のため編集・ソートは無効。
      ...GRID_DEFAULT_COL_DEF,
      editable: false,
      sortable: false,
      filter: false,
      suppressMovable: true,
      cellDataType: false,
    }),
    []
  );

  // 明細が0件のときの案内。販売店未選択が理由の場合だけ次に何をすべきかを示す。
  // それ以外の0件は共通ロケールの文言（画面設計標準 4.7。画面ごとに変えない）。
  const overlayNoRowsTemplate = useMemo(
    () =>
      hideRowsUntilStore
        ? '<span class="text-sm text-gray-600">基本情報で振替元の販売店または担当末端組織を選択してください</span>'
        : undefined,
    [hideRowsUntilStore]
  );

  return (
    // 折り畳みカードは共通部品 CollapsibleCard を使用する（→ 02 §11）。
    // 振替明細カードと同じ体裁で、基本情報と振替明細の間に 1 枚のカードとして表示する。
    <CollapsibleCard
      title="検印済み明細（振替元）"
      open={isCardOpen}
      onOpenChange={setIsCardOpen}
      className="p-4"
      contentClassName="mt-4"
    >
      <>
        {/* 検索条件カード（支払一覧の検索条件カードと同じ項目構成）。
            折り畳みカードは共通部品 CollapsibleCard を使用する（→ 02 §11）。 */}
        {/* 検索条件の値は Ctrl+C／右クリック「コピー」で表示中の値をコピーできる（CopyableArea → 02 §15） */}
        <CopyableArea>
          <CollapsibleCard
            title={
              <span className="flex items-center gap-2">
                <Search className="h-5 w-5 text-gray-700" />
                検索条件
              </span>
            }
            open={isSearchOpen}
            onOpenChange={setIsSearchOpen}
            collapsedSummary={searchSummary}
            contentClassName="px-4 py-1.5"
            // クリアボタンはヘッダーバーに置き、専用の行を使わない（計画一覧と同一体裁）
            headerActions={
              <SearchClearButton
                onClick={handleClear}
                disabled={searchDisabled}
              />
            }
          >
            <>
              {/* 検索条件フィールド。支払一覧と同じく列トラックを全行で共有する 8 トラック grid
                （4組のラベル＋入力）。各行の先頭ラベルに col-start-1 を付けて行を折り返す。
                  1行目＝期間系（対象年月のテキスト表示）／
                  2行目＝商流系（販売店・一次店・三次店）／
                  3行目＝組織系（事業場・部署・営業担当者）。 */}
              <div className="grid grid-cols-[max-content_auto_max-content_auto_max-content_auto_max-content_auto] items-center gap-x-3 gap-y-2.5">
                {/* 期間系: 対象年月（列1・2）。基本情報で選択した値をテキスト表示する
                    （当画面では変更しない）。 */}
                <label
                  className={`${FORM_LABEL_CLASS} col-start-1 justify-self-end whitespace-nowrap`}
                >
                  対象年月
                </label>
                <span className="flex h-8 items-center text-sm text-gray-900">
                  {toMonthLabel(searchTargetMonth)}
                </span>

                {/* 商流系（列1〜3）: 販売店／三次店／一次店。
                  振替詳細の基本情報と同じ項目・同じ連動（店舗階層マスタ storeHierarchy が定義元）。 */}
                <label
                  htmlFor="ref-search-store"
                  className={`${FORM_LABEL_CLASS} col-start-1 justify-self-end whitespace-nowrap`}
                >
                  販売店
                </label>
                <div className="w-52">
                  <SingleCombobox
                    id="ref-search-store"
                    options={storeOptions}
                    value={store}
                    onChange={handleStoreChange}
                    placeholder="販売店を選択／検索"
                    clearable
                    disabled={searchDisabled}
                  />
                </div>
                <label
                  htmlFor="ref-search-tertiary-store"
                  className={`${FORM_LABEL_CLASS} justify-self-end whitespace-nowrap`}
                >
                  三次店
                </label>
                <div className="w-52">
                  <SingleCombobox
                    id="ref-search-tertiary-store"
                    options={tertiaryOptions}
                    value={tertiaryStore}
                    onChange={handleTertiaryStoreChange}
                    placeholder="三次店を選択／検索"
                    clearable
                    disabled={searchDisabled}
                  />
                </div>
                <label
                  htmlFor="ref-search-primary-store"
                  className={`${FORM_LABEL_CLASS} justify-self-end whitespace-nowrap`}
                >
                  一次店
                </label>
                <div className="w-52">
                  <SingleCombobox
                    id="ref-search-primary-store"
                    options={PRIMARY_STORE_OPTIONS}
                    value={primaryStore}
                    onChange={handlePrimaryStoreChange}
                    placeholder="一次店を選択／検索"
                    clearable
                    disabled={searchDisabled}
                  />
                </div>

                {/* 組織系（列1〜4）: 事業場／部署／末端組織／営業担当者。
                  基本情報エリアと同じ4項目・同じ並びにする。 */}
                <label
                  htmlFor="ref-search-office"
                  className={`${FORM_LABEL_CLASS} col-start-1 justify-self-end whitespace-nowrap`}
                >
                  事業場
                </label>
                <div className="w-52">
                  <SingleCombobox
                    id="ref-search-office"
                    options={officeField.options}
                    value={office}
                    onChange={setOffice}
                    placeholder="コード または 名称で検索..."
                    clearable
                    disabled={searchDisabled}
                  />
                </div>
                <label
                  htmlFor="ref-search-department"
                  className={`${FORM_LABEL_CLASS} justify-self-end whitespace-nowrap`}
                >
                  部署
                </label>
                <div className="w-52">
                  <SingleCombobox
                    id="ref-search-department"
                    options={departmentOptions}
                    value={department}
                    onChange={handleDepartmentChange}
                    placeholder="コード または 名称で検索..."
                    clearable
                    disabled={searchDisabled}
                  />
                </div>
                <label
                  htmlFor="ref-search-terminal-org"
                  className={`${FORM_LABEL_CLASS} justify-self-end whitespace-nowrap`}
                >
                  末端組織
                </label>
                <div className="w-52">
                  <SingleCombobox
                    id="ref-search-terminal-org"
                    options={terminalOrgOptions}
                    value={terminalOrg}
                    onChange={setTerminalOrg}
                    placeholder="コード または 名称で検索..."
                    clearable
                    disabled={searchDisabled}
                  />
                </div>
                <label
                  htmlFor="ref-search-sales-rep"
                  className={`${FORM_LABEL_CLASS} justify-self-end whitespace-nowrap`}
                >
                  営業担当者
                </label>
                <div className="w-52">
                  <SingleCombobox
                    id="ref-search-sales-rep"
                    options={salesRepOptions}
                    value={salesRep}
                    onChange={handleSalesRepChange}
                    placeholder="コード または 名称で検索..."
                    clearable
                    disabled={searchDisabled}
                  />
                </div>
              </div>
            </>
          </CollapsibleCard>
        </CopyableArea>

        {/* 一覧カード（支払一覧の一覧カードと同形式）。
            画面内に埋め込むため、グリッドは固定の縦幅で行を内部スクロールさせる。
            縦幅は明細 5 行が表示される高さ＝ヘッダー 1.75rem＋行 2.25rem×5（11.25rem）
            ＋ステータスバー・横スクロールバー分 約3rem ≒ 16rem。 */}
        <div className={`${CARD_CLASS} p-2`}>
          <div className="allocate-reference-grid h-64 w-full">
            <AgGridReact
              rowData={filteredRows}
              // 行のダブルクリックでも振替処理を行う（ボタン押下と同じ処理）。
              onRowDoubleClicked={(e: RowDoubleClickedEvent<ReferenceRow>) => {
                if (transferDisabled) return;
                if (e.data) onTransferProcess?.(e.data);
              }}
              // 基本情報の販売店が未選択のうちは、明細を出さず操作の手掛かりを示す。
              overlayNoRowsTemplate={overlayNoRowsTemplate}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              // defaultColDef で filter: false のため、型によるフィルタの追加を止める（→ grid/gridCommon）
              columnTypes={GRID_NO_FILTER_COLUMN_TYPES}
              getRowId={getRowId}
              // セルレンダラー（振替処理ボタン）から呼ぶハンドラーを context 経由で渡す。
              context={gridContext}
              getContextMenuItems={gridFilterContextMenuItems}
              suppressMovableColumns={true}
              ensureDomOrder={true}
              statusBar={GRID_STATUS_BAR}
              {...GRID_BASE_PROPS}
              {...gridColumnStateProps}
            />
          </div>
        </div>
      </>
    </CollapsibleCard>
  );
}
