import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  GetRowIdParams,
  ICellRendererParams,
  IRowNode,
} from 'ag-grid-community';
import {
  GRID_DEFAULT_COL_DEF,
  GRID_BASE_PROPS,
  GRID_STATUS_BAR,
  editableBg,
  gridFilterContextMenuItems,
  useGridColumnState,
} from '@/components/grid';
// 管理区分／施策区分の区分値・名称は拡売費一覧と同じ導出ロジックを使う。
import {
  campaignClassCode,
  managementClassCode,
  managementCodeName,
} from '@/utils/payment/payment-detail/paymentComboFieldOptions';
import { campaignCodeNameOf } from '@/utils/common/comboFieldOptions';
import {
  BUTTON_BASE,
  BUTTON_STYLES,
  FORM_LABEL_CLASS,
} from '@/styles/commonStyles';
import {
  MultiCombobox,
  type MultiComboboxOption,
} from '@/components/ui/multi-combobox';
import type { PlanFieldValues } from '@/types/paymentDetail';

// 担当エリアと、そのエリアを担当する営業担当者（モック）。
// 基本情報の部署（首都圏営業第二部）配下のエリアを想定する。
// 計画明細の「担当エリア」「担当者」列と、ペインヘッダーの担当エリア選択で共通に使う。
const PLAN_AREAS = [
  { code: 'AR11', name: '東京東', staff: '5172733:アサヒ　太郎' },
  { code: 'AR12', name: '東京西', staff: '5172734:アサヒ　花子' },
  { code: 'AR13', name: '神奈川', staff: '5172741:アサヒ　大輔' },
  { code: 'AR14', name: '千葉', staff: '5172740:アサヒ　結衣' },
] as const;

// 担当エリア選択（複数選択コンボボックス）の選択肢。
const PLAN_AREA_OPTIONS: MultiComboboxOption[] = PLAN_AREAS.map((area) => ({
  value: area.code,
  label: area.name,
  code: area.code,
}));

// 担当エリア選択の初期値。全担当エリアを選択した状態（＝全エリアの計画を表示）から始める。
export const ALL_PLAN_AREA_CODES: string[] = PLAN_AREAS.map(
  (area) => area.code
);

// 支払明細に紐づける計画明細データ（Excel 選択エリア）。
// 親へは「選択内容を反映」（onApply）の引数として渡すため、型の export は不要。
interface PlanDetailRow {
  // 行ID（getRowId 用）。計画明細を一意に識別する項目が無いため、行データの生成時
  //（getPlanDetailRows）に振る。列には表示せず、親画面へも渡さない。
  id: string;
  status: string; // ステータス
  planExpContent: string; // メタブランド（メタブランド名）
  product: string; // サマリ商品名
  planAmount: number | string; // 計画金額
  // 紐づけ済み金額：他の支払明細から当該計画明細へ既に紐づけられている金額の累計。
  // 列としては表示しないが、モックデータの実績値として保持する。
  linkedAmount: number | string;
  mgmtClass: string; // 管理区分（コード）
  mgmtClassName: string; // 管理区分名称
  mgmtCode: string; // 管理コード（コード）
  mgmtCodeName: string; // 管理コード名称
  measureClassCode: string; // 施策区分（区分値）
  measureClass: string; // 施策区分名称
  measureCode: string; // 施策コード
  measureCodeName: string; // 施策コード名称
  summary1: string; // 摘要1（社内用）
  summary2: string; // 摘要2（社外用）
  // 担当エリア・担当者：計画を作成した担当エリアとその営業担当者（コード:名称）。
  // 販売店×部署(第5階層)で取得すると別担当エリアの計画も含まれるため、
  // 一覧で判別できるよう表示する。
  areaCode: string; // 担当エリア（コード）。担当エリア選択での絞り込みに使う
  area: string; // 担当エリア
  staff: string; // 担当者
  // 支払回数：紐づけ済みの明細に表示する、紐づけを行った支払伝票の支払回数。
  // 「選択内容を反映」で親画面の支払回数を設定する（未設定の紐づけ済み明細は 1）。
  paymentCount?: number | string;
  // 紐づいている拡売費明細（親画面の拡売費一覧の No.）。
  // 「明細No」列に表示するほか、どの支払明細と紐づいた計画明細かを裏で保持する
  //（1件の計画明細に複数の支払明細が紐づく「多対1」もあるため配列で持つ）。
  linkedExpenseLineNos?: (number | string)[];
  // 明細No のダミー値。紐づく拡売費明細を持たない「実施済み」の計画明細
  //（他の支払伝票で紐づけた想定の明細）に、モックとして表示する明細No を持たせる。
  // 拡売費一覧の明細の No.（1〜7）と紛れないよう、8 以降を採番する。
  dummyDetailNo?: number | string;
}

// モックの計画明細の定義用。担当エリア・担当者は行データの生成時（getPlanDetailRows）に割り当てる。
// 行ID（id）も生成時に振る。
type PlanDetailSeed = Omit<PlanDetailRow, 'id' | 'areaCode' | 'area' | 'staff'>;

// 管理区分・管理コード・施策区分・施策コードの8項目（区分値・名称を含む）を組み立てる。
// 保持するのは販売計画（拡売費計画）と同じマスタのダミーデータ（管理区分名称・管理コード・
// 施策区分名称・施策コード）で、区分値・名称は拡売費一覧と同じ導出ロジックで求める。
// 「選択内容を反映」でそのまま拡売費一覧へ渡る項目のため、両画面で表記をそろえる。
const planClassFields = (
  mgmtClass: string, // 管理区分名称
  mgmtCode: string, // 管理コード
  measureClass: string, // 施策区分名称
  measureCode: string // 施策コード
): Pick<
  PlanDetailRow,
  | 'mgmtClass'
  | 'mgmtClassName'
  | 'mgmtCode'
  | 'mgmtCodeName'
  | 'measureClassCode'
  | 'measureClass'
  | 'measureCode'
  | 'measureCodeName'
> => ({
  mgmtClass: managementClassCode(mgmtClass),
  mgmtClassName: mgmtClass,
  mgmtCode,
  mgmtCodeName: managementCodeName(mgmtCode),
  measureClassCode: campaignClassCode(measureClass),
  measureClass,
  measureCode,
  measureCodeName: campaignCodeNameOf(measureCode),
});

// 「計画紐づけ＝実施済み」の計画明細を1件生成する。
// 親画面（拡売費一覧）の計画の枝番行と対になる行で、表示値は枝番行（＝親行の再掲）に合わせる。
//   メタブランド ＝ 枝番行の「メタブランド」
//   商品         ＝ 枝番行の「商品」
//   計画金額／紐づけ済み金額 ＝ 枝番行の「計画金額」（多対1の場合は紐づく明細の合計）
//   管理区分・施策区分の区分値／名称は拡売費一覧と同じ導出ロジックで求める。
// ※親画面のモックデータ（PaymentNonProductExpensePane の EXPENSE_ROWS）と対の内容のため、
//   一方を変更したら他方も合わせること。
const makeLinkedPlanRow = (args: {
  expenseLineNos: (number | string)[]; // 紐づく拡売費明細の No.
  planExpContent: string; // メタブランド（メタブランド名）（枝番行の同名列）
  product: string; // サマリ商品名（枝番行の商品）
  amount: number; // 計画金額＝紐づけ済み金額
  mgmtClass: string; // 管理区分名称
  mgmtCode: string; // 管理コード
  measureClass: string; // 施策区分名称
  measureCode: string; // 施策コード
  summary1: string;
  summary2: string;
}): PlanDetailSeed => ({
  status: '実施済み',
  planExpContent: args.planExpContent,
  product: args.product,
  planAmount: args.amount,
  linkedAmount: args.amount,
  ...planClassFields(
    args.mgmtClass,
    args.mgmtCode,
    args.measureClass,
    args.measureCode
  ),
  summary1: args.summary1,
  summary2: args.summary2,
  linkedExpenseLineNos: args.expenseLineNos,
});

// 拡売費一覧（親画面）の計画の枝番行と対になる「実施済み」の計画明細。
//   No.1（3件）／No.4（2件）／No.5（1件）… 各枝番行の計画金額をそのまま持つ。
//   No.2（1件）      … 拡売費 No.2・No.3 の2明細が紐づく多対1のため 800（200＋600）。
const LINKED_PLAN_DETAIL_ROWS: PlanDetailSeed[] = [
  // 拡売費 No.1（ワンダ モーニングショット アプリ20%キャンペーン）の計画の枝番行 3件
  ...[7433, 5000, 15000].map((amount) =>
    makeLinkedPlanRow({
      expenseLineNos: [1],
      planExpContent: 'ワンダ',
      product: 'ワンダモーニングショット185g30本',
      amount,
      mgmtClass: '売上連動拡売費A口',
      mgmtCode: 'RA001',
      measureClass: '販売促進',
      measureCode: 'SP001',
      summary1: 'アプリ施策の値引き原資（社内）',
      summary2: 'アプリ20%相当の販促値引（社外）',
    })
  ),
  // 拡売費 No.4（ウィルキンソン 新商品棚替え作業協力金）の計画の枝番行 2件
  ...[20000, 10000].map((amount) =>
    makeLinkedPlanRow({
      expenseLineNos: [4],
      planExpContent: 'ウィルキンソン',
      product: 'ウィルキンソン炭酸水500mL24本',
      amount,
      mgmtClass: '拡売費(固定費)A口',
      mgmtCode: 'FA002',
      measureClass: 'リピート',
      measureCode: 'SR001',
      summary1: '棚替え什器協力費（社内）',
      summary2: '新商品棚替え協力（社外）',
    })
  ),
  // 拡売費 No.5（三ツ矢サイダー 店頭販促企画）の計画の枝番行 1件
  makeLinkedPlanRow({
    expenseLineNos: [5],
    planExpContent: '三ツ矢',
    product: '三ツ矢サイダー500mL24本',
    amount: 12000,
    mgmtClass: '売上連動拡売費本社口',
    mgmtCode: 'RH001',
    measureClass: 'リピート',
    measureCode: 'SR002',
    summary1: '店頭販促企画の販促費（社内）',
    summary2: '三ツ矢サイダー店頭企画（社外）',
  }),
  // 拡売費 No.2（アサヒ飲料アプリ 会員エントリー費）の計画の枝番行 1件。
  // 拡売費 No.2・No.3 の2明細が紐づくため、金額は 800 とする。
  makeLinkedPlanRow({
    expenseLineNos: [2, 3],
    planExpContent: 'ブランド横断(全商品)',
    product: '-',
    amount: 800,
    mgmtClass: '拡売費(固定費)B口',
    mgmtCode: 'FB001',
    measureClass: 'スポット',
    measureCode: 'SS001',
    summary1: 'アプリ会員エントリー費（社内）',
    summary2: 'アプリ会員登録キャンペーン（社外）',
  }),
];

// 計画明細のモックデータ。
const PLAN_DETAIL_ROWS: PlanDetailSeed[] = [
  {
    status: '未実施',
    planExpContent: 'ブランド横断(全商品)',
    product: '-',
    planAmount: 200000,
    linkedAmount: '',
    ...planClassFields('拡売費(固定費)B口', 'FB002', 'スポット', 'SS001'),
    summary1: 'アプリエントリー費',
    summary2: 'アプリ登録キャンペーン',
  },
  {
    status: '実施済み',
    // 明細No は他の支払伝票で紐づけた想定のダミー値。
    dummyDetailNo: 8,
    planExpContent: '三ツ矢',
    product: '三ツ矢サイダー500mL24本',
    planAmount: 600000,
    linkedAmount: 566000,
    ...planClassFields('拡売費(固定費)B口', 'FB001', 'スポット', 'SS002'),
    summary1: '試飲会費用　30店日',
    summary2: '店頭試飲会の実施',
  },
  {
    status: '実施済み',
    // 明細No は他の支払伝票で紐づけた想定のダミー値。
    dummyDetailNo: 9,
    planExpContent: 'ブランド横断(全商品)',
    product: '-',
    planAmount: 1200000,
    linkedAmount: 1142338,
    ...planClassFields('売上連動拡売費本社口', 'RH001', 'リピート', 'SR001'),
    summary1: '年契引当　3－6月分',
    summary2: '年間契約分（3〜6月）',
  },
  {
    status: '実施済み',
    // 明細No は他の支払伝票で紐づけた想定のダミー値。
    dummyDetailNo: 10,
    planExpContent: 'ワンダ',
    product: 'ワンダ金の微糖185g30本',
    planAmount: 180000,
    linkedAmount: 177000,
    ...planClassFields('売上連動拡売費A口', 'RA001', 'リピート', 'SR003'),
    summary1: '①ポイント10P',
    summary2: 'ポイント10倍還元',
  },
  {
    status: '実施済み',
    // 明細No は他の支払伝票で紐づけた想定のダミー値。
    dummyDetailNo: 11,
    planExpContent: 'ワンダ',
    product: 'ワンダ ボトルコーヒー微糖500mL24本',
    planAmount: 120000,
    linkedAmount: 123420,
    ...planClassFields('売上連動拡売費A口', 'RA001', 'リピート', 'SR003'),
    summary1: '①ポイント10P',
    summary2: 'ポイント10倍還元',
  },
  {
    status: '実施済み',
    // 明細No は他の支払伝票で紐づけた想定のダミー値。
    dummyDetailNo: 12,
    planExpContent: 'ワンダ',
    product: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
    planAmount: 80000,
    linkedAmount: 67660,
    ...planClassFields('売上連動拡売費A口', 'RA001', 'リピート', 'SR003'),
    summary1: '①ポイント10P',
    summary2: 'ポイント10倍還元',
  },
  {
    status: '実施済み',
    // 明細No は他の支払伝票で紐づけた想定のダミー値。
    dummyDetailNo: 13,
    planExpContent: 'ワンダ',
    product: 'ワンダ金の微糖185g30本',
    planAmount: 0,
    linkedAmount: 88220,
    ...planClassFields('売上連動拡売費A口', 'RA001', 'リピート', 'SR003'),
    summary1: '①ポイント10P',
    summary2: 'ポイント10倍還元',
  },
  {
    status: '未実施',
    planExpContent: '三ツ矢特濃',
    product: '三ツ矢特濃ピーチスカッシュ500mL24本',
    planAmount: 180000,
    linkedAmount: '',
    ...planClassFields('売上連動拡売費B口', 'RB002', '販売促進', 'SP001'),
    summary1: '',
    summary2: '',
  },
  {
    status: '未実施',
    planExpContent: '三ツ矢特濃',
    product: '三ツ矢特濃ピーチスカッシュ500mL24本',
    planAmount: 50000,
    linkedAmount: '',
    ...planClassFields('売上連動拡売費A口', 'RA002', '販売促進', 'SP003'),
    summary1: '',
    summary2: '',
  },
  {
    status: '未実施',
    planExpContent: '三ツ矢',
    product: '三ツ矢サイダー350mL28本',
    planAmount: 120000,
    linkedAmount: '',
    ...planClassFields('売上連動拡売費B口', 'RB002', '販売促進', 'SP001'),
    summary1: '',
    summary2: '',
  },
  {
    status: '未実施',
    planExpContent: 'カルピス',
    product: 'カルピスソーダ500mL24本',
    planAmount: 100000,
    linkedAmount: '',
    ...planClassFields('売上連動拡売費B口', 'RB002', '販売促進', 'SP001'),
    summary1: '',
    summary2: '',
  },
  {
    status: '実施済み',
    // 明細No は他の支払伝票で紐づけた想定のダミー値。
    dummyDetailNo: 14,
    planExpContent: '三ツ矢',
    product: '三ツ矢サイダー1.5L8本',
    planAmount: 120000,
    linkedAmount: '',
    ...planClassFields('売上連動拡売費B口', 'RB002', 'リピート', 'SR003'),
    summary1: '①ポイント10P、②チラシ代',
    summary2: 'ポイント10倍還元・チラシ掲載',
  },
  {
    status: '未実施',
    planExpContent: '三ツ矢',
    product: '三ツ矢サイダー1.5L8本',
    planAmount: 100000,
    linkedAmount: '',
    ...planClassFields('売上連動拡売費A口', 'RA002', '販売促進', 'SP003'),
    summary1: '①ポイント10P、②チラシ代',
    summary2: 'ポイント10倍還元・チラシ掲載',
  },
  {
    status: '未実施',
    planExpContent: '十六茶',
    product: '十六茶2L6本',
    planAmount: 100000,
    linkedAmount: '',
    ...planClassFields('売上連動拡売費A口', 'RA002', '販売促進', 'SP003'),
    summary1: '',
    summary2: '',
  },
  {
    status: '未実施',
    planExpContent: '三ツ矢',
    product: '三ツ矢サイダー500mL24本',
    planAmount: 150000,
    linkedAmount: '',
    ...planClassFields('売上連動拡売費B口', 'RB002', '販売促進', 'SP002'),
    summary1: '①アプリ▲10円',
    summary2: 'アプリクーポン10円引き',
  },
  {
    status: '未実施',
    planExpContent: '十六茶',
    product: '十六茶630mL24本',
    planAmount: 120000,
    linkedAmount: '',
    ...planClassFields('売上連動拡売費B口', 'RB002', '販売促進', 'SP002'),
    summary1: '①アプリ▲10円',
    summary2: 'アプリクーポン10円引き',
  },
  {
    status: '未実施',
    planExpContent: 'ウィルキンソン',
    product: 'ウィルキンソン炭酸水500mL24本',
    planAmount: 100000,
    linkedAmount: '',
    ...planClassFields('売上連動拡売費B口', 'RB002', '販売促進', 'SP002'),
    summary1: '①アプリ▲10円',
    summary2: 'アプリクーポン10円引き',
  },
  {
    status: '未実施',
    planExpContent: 'カルピス',
    product: 'カルピスウォーター500mL24本',
    planAmount: 120000,
    linkedAmount: '',
    ...planClassFields('売上連動拡売費B口', 'RB002', '販売促進', 'SP002'),
    summary1: '①アプリ▲10円',
    summary2: 'アプリクーポン10円引き',
  },
  {
    status: '未実施',
    planExpContent: '十六茶',
    product: '十六茶660mL24本',
    planAmount: 100000,
    linkedAmount: '',
    ...planClassFields('売上連動拡売費B口', 'RB002', '販売促進', 'SP002'),
    summary1: '①アプリ▲10円',
    summary2: 'アプリクーポン10円引き',
  },
  {
    // 計画紐づけ「未実施」・計画金額 8,000 の明細。
    // 紐づけ済み金額（linkedAmount）は空文字のため空白で表示される。
    status: '未実施',
    planExpContent: 'ワンダ',
    product: 'ワンダ金の微糖185g30本',
    planAmount: 8000,
    linkedAmount: '',
    ...planClassFields('売上連動拡売費A口', 'RA001', 'リピート', 'SR003'),
    summary1: '②ポイント5P',
    summary2: 'ポイント5倍還元',
  },
  {
    // 計画紐づけ「未実施」・計画金額 4,000 の明細 1件目（上と同じく金額2列は空白）。
    status: '未実施',
    planExpContent: '十六茶',
    product: '十六茶630mL24本',
    planAmount: 4000,
    linkedAmount: '',
    ...planClassFields('売上連動拡売費A口', 'RA002', '販売促進', 'SP003'),
    summary1: '②チラシ代',
    summary2: 'チラシ掲載',
  },
  {
    // 計画紐づけ「未実施」・計画金額 4,000 の明細 2件目。
    status: '未実施',
    planExpContent: 'カルピス',
    product: 'カルピスウォーター500mL24本',
    planAmount: 4000,
    linkedAmount: '',
    ...planClassFields('売上連動拡売費B口', 'RB002', '販売促進', 'SP001'),
    summary1: '②特売▲20円',
    summary2: '特売値引き20円引き',
  },
  {
    // 計画紐づけ「未実施」・計画金額 16,000 の明細（上と同じく金額2列は空白）。
    status: '未実施',
    planExpContent: 'ウィルキンソン',
    product: 'ウィルキンソン炭酸水500mL24本',
    planAmount: 16000,
    linkedAmount: '',
    ...planClassFields('売上連動拡売費A口', 'RA001', 'スポット', 'SS001'),
    summary1: '②エントリー特典',
    summary2: 'エントリーキャンペーン特典',
  },
];

// 計画明細の行データ（画面を開いている間、モジュール側で保持する実体）。
// 「選択内容を反映」で計画紐づけ・支払回数・明細No を書き換えるため、ペインを
// 開き直しても内容が残るよう、モジュール定数のコピーを1度だけ作って共有する
//（モジュール定数そのものは汚さない）。
// 担当エリア・担当者は、拡売費一覧と紐づく計画明細を本支払の営業担当者のエリア（先頭）、
// それ以外を各エリアへ順に割り当てる（別担当エリアの計画も一覧に含まれる想定のモック）。
let planDetailRowsStore: PlanDetailRow[] | null = null;
const withPlanArea = (
  row: PlanDetailSeed,
  area: (typeof PLAN_AREAS)[number],
  id: string
): PlanDetailRow => ({
  ...row,
  id,
  areaCode: area.code,
  area: area.name,
  staff: area.staff,
});
const getPlanDetailRows = (): PlanDetailRow[] => {
  if (!planDetailRowsStore) {
    planDetailRowsStore = [
      ...LINKED_PLAN_DETAIL_ROWS.map((row, i) =>
        withPlanArea(row, PLAN_AREAS[0], `linked-${i + 1}`)
      ),
      ...PLAN_DETAIL_ROWS.map((row, i) =>
        withPlanArea(row, PLAN_AREAS[i % PLAN_AREAS.length], `plan-${i + 1}`)
      ),
    ];
  }
  return planDetailRowsStore;
};

// 行ID（AG Grid 公式 getRowId）。生成時に振った id を使う。
// モジュール直下に置いて参照を固定する（→ 02 §7.1）。
const getPlanRowId = (params: GetRowIdParams<PlanDetailRow>): string =>
  params.data.id;

// 計画明細と、拡売費一覧の計画の枝番行の同一性を判定する。
// 計画明細を一意に識別する ID を持たないため、管理コード・施策コード・摘要の一致で判断する。
// 管理区分は、枝番行が「名称」（販売計画選択で反映した行）と「区分値」（初期データの行）の
// どちらを持つ場合もあるため、いずれかと一致すればよいものとする。
const isSamePlanDetail = (
  row: PlanDetailRow,
  branch: {
    mgmtClass?: string;
    mgmtCode?: string;
    measureClass?: string;
    measureCode?: string;
    summary1?: string;
    summary2?: string;
  }
): boolean => {
  const eq = (a: unknown, b: unknown) => String(a ?? '') === String(b ?? '');
  return (
    (eq(row.mgmtClassName, branch.mgmtClass) ||
      eq(row.mgmtClass, branch.mgmtClass)) &&
    eq(row.mgmtCode, branch.mgmtCode) &&
    eq(row.measureCode, branch.measureCode) &&
    eq(row.summary1, branch.summary1) &&
    eq(row.summary2, branch.summary2)
  );
};

// 「選択内容を反映」で紐づけを解除した組み合わせ（親画面の計画の枝番行の削除に使う）。
// 計画の枝番行を削除したときの通知（removePlanDetailLink の引数）と同じ内容。
export interface PlanUnlinkItem {
  parentLineNo: number | string;
  planAmount?: number | string;
  mgmtClass?: string;
  mgmtCode?: string;
  measureClass?: string;
  measureCode?: string;
  summary1?: string;
  summary2?: string;
}

// 紐づけ情報の変更通知。開いている販売計画選択ペインの再描画・グループ再計算に使う。
const planLinkListeners = new Set<() => void>();

// 計画明細から、指定の拡売費明細（No.）との紐づけを外す共通処理。
// 紐づけが残らない明細は計画紐づけを「未実施」へ戻し、支払回数・保持している
// 「紐づく金額」も破棄する（他の支払伝票で紐づけた想定のダミー明細は「実施済み」のまま）。
const detachPlanRowFromExpense = (
  row: PlanDetailRow,
  parentKey: string
): boolean => {
  const linked = (row.linkedExpenseLineNos ?? []).map(String);
  if (!linked.includes(parentKey)) return false;
  row.linkedExpenseLineNos = linked.filter((no) => no !== parentKey);
  if (row.linkedExpenseLineNos.length === 0) {
    if (row.dummyDetailNo === undefined) {
      row.status = '未実施';
      row.paymentCount = undefined;
    }
  }
  return true;
};

// 拡売費一覧で計画の枝番行が削除されたときに、当該計画明細の紐づけ情報から
// その拡売費明細（親行の No.）を外す（グルーピングからも外れる）。
// 対象は「当該拡売費明細に紐づく計画明細」のうち、識別項目が一致するもの。
// 同じ内容の計画明細が複数ある場合は、計画金額が一致する行（無ければ先頭）を1件だけ外す
//（枝番行1件＝計画明細1件の紐づけを解除するため）。
export const removePlanDetailLink = (branch: {
  parentLineNo: number | string;
  planAmount?: number | string;
  mgmtClass?: string;
  mgmtCode?: string;
  measureClass?: string;
  measureCode?: string;
  summary1?: string;
  summary2?: string;
}): void => {
  const parentKey = String(branch.parentLineNo);
  const linkedRows = getPlanDetailRows().filter((row) =>
    (row.linkedExpenseLineNos ?? []).map(String).includes(parentKey)
  );
  if (linkedRows.length === 0) return;
  // 識別項目が一致する行に絞る（初期データの枝番行など、一致しない場合は全体から選ぶ）。
  const matched = linkedRows.filter((row) => isSamePlanDetail(row, branch));
  const candidates = matched.length > 0 ? matched : linkedRows;
  const target =
    candidates.find(
      (row) => Number(row.planAmount) === Number(branch.planAmount)
    ) ?? candidates[0];
  detachPlanRowFromExpense(target, parentKey);
  planLinkListeners.forEach((listener) => listener());
};

const numFmt = (params: { value: unknown }) => {
  const v = params.value;
  if (v === '' || v === null || v === undefined) return '';
  if (typeof v === 'number') return v.toLocaleString();
  return String(v);
};

// 編集不可（非活性）セルの背景色。本一覧は計画明細を選択するための参照専用グリッドで、
// 全データ列が編集不可のため、画面設計標準の編集不可色（灰）で統一する。
// ※選択チェックボックス列は操作可能なため対象外（selectionColumnDef 側で既定のまま）。
const READONLY_CELL_STYLE = editableBg(false);
// 金額列など右寄せする編集不可セル。
const READONLY_NUM_CELL_STYLE = editableBg(false, { textAlign: 'right' });

// 計画情報グリッドの「引用」ボタンセル。チェックボックスに代わる行単位の確定操作で、
// 押下でその行の項目を拡売費一覧のチェック行へ設定する。
const SelectPlanCellRenderer = (props: ICellRendererParams) => {
  const row = props.data as PlanDetailRow | undefined;
  if (!row) return null;
  const onSelectPlanRow = props.context?.onSelectPlanRow as
    | ((data: PlanDetailRow) => void)
    | undefined;
  return (
    <div className="flex h-full items-center justify-center">
      <button
        type="button"
        className={`${BUTTON_STYLES.primary} ${BUTTON_BASE} inline-flex h-6 items-center px-3 text-xs font-medium whitespace-nowrap`}
        onClick={() => onSelectPlanRow?.(row)}
        aria-label={`引用：${row.product}`}
      >
        引用
      </button>
    </div>
  );
};

interface PaymentPlanSelectionPaneProps {
  // 「選択」を押した計画明細を親へ通知する。
  onSelect?: (data: PlanDetailRow) => void;
  // 計画情報の「選択」押下時に、設定する項目（管理区分〜摘要2（社外用））を親へ通知する。
  // 設定先の拡売費明細は親画面の拡売費一覧でチェックした行（チェックボックス列）とし、
  // 当ペインでは保持しない。
  onApplyPlanFields?: (fields: PlanFieldValues) => void;
  // 一覧を絞り込む担当エリア（コード）。ペインヘッダーの担当エリア選択（PlanAreaField）の値。
  // 指定した担当エリアの計画明細だけを表示する（未指定・未選択（空）なら絞り込まず全件表示）。
  areaCodes?: string[];
}

export function PaymentPlanSelectionPane({
  onSelect,
  onApplyPlanFields,
  areaCodes,
}: PaymentPlanSelectionPaneProps) {
  const gridRef = useRef<AgGridReact>(null);

  // 担当エリアでの絞り込み（AG Grid 公式の外部フィルター）。
  // コールバックは作り直さず、最新の選択値を ref 経由で参照する。
  const areaCodesRef = useRef(areaCodes);
  areaCodesRef.current = areaCodes;
  const isExternalFilterPresent = useCallback(
    () => (areaCodesRef.current?.length ?? 0) > 0,
    []
  );
  const doesExternalFilterPass = useCallback(
    (node: IRowNode<PlanDetailRow>) =>
      areaCodesRef.current?.includes(node.data?.areaCode ?? '') ?? true,
    []
  );
  // 担当エリアの選択が変わったら絞り込みをやり直す。
  useEffect(() => {
    gridRef.current?.api?.onFilterChanged();
  }, [areaCodes]);

  // 列幅・並び順・ソートの永続化。
  const gridColumnStateProps = useGridColumnState(
    // 列見出しの変更（支払金額 → 紐づく金額）に伴い v4 へ更新。
    // 旧 v3 の保存状態には変更前の列幅が残り、長い見出しが切れて表示されるため。
    // v5：「計画紐づけ」の左に「支払回数」「明細No」列を追加。
    // v6：両グリッドの「紐づけ済み金額」列を削除。
    // v7：計画情報グリッドの「計画紐づけ」列を削除。
    // v8：請求情報の請求金額・紐づく金額・計画無し・計画漏れ、計画情報の支払回数・
    //   明細No・紐づく金額の各列を削除。
    // v9：「対象商品」の左に「メタブランド」列（旧「販売計画に記載の拡売費内容」）を追加し、
    //   「対象商品」を「商品」へ改称。
    // v10：「摘要1（社内用）」の右に「担当エリア」「担当者」列を追加。
    '支払詳細C.販売計画選択.columnState.v10'
  );

  // 計画情報の「選択」押下：当該計画明細の「メタブランド」「サマリ商品名」と
  //「管理区分」〜「摘要2（社外用）」を親へ渡す。
  // 設定先の拡売費明細は親画面の拡売費一覧でチェックした行（チェックボックス列）のため、
  // 対象の絞り込み・設定結果の通知（トースト）は親画面側で行う。
  const handleSelectPlanRow = (plan: PlanDetailRow) => {
    onApplyPlanFields?.({
      planExpContent: String(plan.planExpContent ?? ''),
      product: String(plan.product ?? ''),
      mgmtClassCode: String(plan.mgmtClass ?? ''),
      mgmtClassName: String(plan.mgmtClassName ?? ''),
      mgmtCode: String(plan.mgmtCode ?? ''),
      mgmtCodeName: String(plan.mgmtCodeName ?? ''),
      measureClassCode: String(plan.measureClassCode ?? ''),
      measureClassName: String(plan.measureClass ?? ''),
      measureCode: String(plan.measureCode ?? ''),
      measureCodeName: String(plan.measureCodeName ?? ''),
      summary1: String(plan.summary1 ?? ''),
    });
    onSelect?.(plan);
  };

  // 列定義・context は作り直さず、最新のハンドラを ref 経由で呼ぶ（→ 02 §7.1）。
  const selectPlanRowRef = useRef(handleSelectPlanRow);
  selectPlanRowRef.current = handleSelectPlanRow;
  const planGridContext = useMemo(
    () => ({
      onSelectPlanRow: (plan: PlanDetailRow) => selectPlanRowRef.current(plan),
    }),
    []
  );
  // 行データ。ペインは開くたびに作り直される（親が key を更新する）ため、行データは
  // モジュール側で1度だけ生成した実体を共有し、「選択内容を反映」で更新した紐づけ情報
  //（計画紐づけ・支払回数・明細No）が開き直した後も残るようにする。
  const [planRows] = useState<PlanDetailRow[]>(getPlanDetailRows);

  const columnDefs: ColDef[] = useMemo(
    () => [
      {
        // 選択：当該計画明細の「管理区分」〜「摘要2（社外用）」を、拡売費一覧で
        // チェックした拡売費明細（親画面）へ設定する（行単位の確定操作）。
        headerName: '',
        // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
        suppressColumnsToolPanel: true,
        colId: 'selectPlan',
        width: 72,
        minWidth: 72,
        maxWidth: 72,
        sortable: false,
        filter: false,
        resizable: false,
        editable: false,
        suppressAutoSize: true,
        cellRenderer: SelectPlanCellRenderer,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        // メタブランド：計画明細のメタブランド。「選択」で拡売費一覧の同名列へ設定する。
        // 項目名は拡売費計画に合わせる（→ 20260821_第31回 決定事項7）。
        headerName: 'メタブランド',
        field: 'planExpContent',
        flex: 2,
        minWidth: 192,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        // 項目名は拡売費計画に合わせる（→ 20260821_第31回 決定事項7）。
        headerName: 'サマリ商品',
        field: 'product',
        flex: 2,
        minWidth: 192,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        headerName: '計画金額',
        field: 'planAmount',
        flex: 1,
        minWidth: 88,
        valueFormatter: numFmt,
        cellStyle: READONLY_NUM_CELL_STYLE,
      },
      {
        // 「コード 名称」の1値をコード列・名称列の2列に分割（名称列は同じ field を参照）。
        // コード・名称はそれぞれ別フィールドで保持し、各列が対応フィールドを参照する。
        headerName: '管理区分',
        field: 'mgmtClass',
        flex: 1,
        minWidth: 96,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        headerName: '管理区分名称',
        field: 'mgmtClassName',
        flex: 2,
        minWidth: 160,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        headerName: '管理コード',
        field: 'mgmtCode',
        flex: 1,
        minWidth: 96,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        headerName: '管理コード名称',
        field: 'mgmtCodeName',
        flex: 1,
        minWidth: 96,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        headerName: '施策区分',
        field: 'measureClassCode',
        flex: 1,
        minWidth: 96,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        headerName: '施策区分名称',
        field: 'measureClass',
        flex: 1,
        minWidth: 96,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        headerName: '施策コード',
        field: 'measureCode',
        flex: 1,
        minWidth: 96,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        headerName: '施策コード名称',
        field: 'measureCodeName',
        flex: 1,
        minWidth: 96,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        headerName: '摘要1（社内用）',
        field: 'summary1',
        flex: 2,
        minWidth: 160,
        cellStyle: READONLY_CELL_STYLE,
      },
      // 摘要2（社外用）は拡売費計画に存在しないため列を持たない
      //（→ 20260821_第31回 決定事項3）。
      {
        // 担当エリア・担当者：販売店×部署(第5階層)などのキーで取得すると別担当エリア
        //（＝別担当者）の計画も含まれるため、ユーザーが判別・フィルタできるよう表示する。
        headerName: '担当エリア',
        field: 'area',
        flex: 1,
        minWidth: 96,
        cellStyle: READONLY_CELL_STYLE,
      },
      {
        headerName: '営業担当者',
        field: 'staff',
        flex: 1,
        minWidth: 144,
        cellStyle: READONLY_CELL_STYLE,
      },
    ],
    []
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

  // 計画明細テーブル。flex-1 + min-h-0 で利用可能領域にフィットさせ、
  // AG Grid の行を内部スクロールさせる。これによりステータスバー（件数表示）は
  // 常にグリッド下端に固定表示され、縦幅を縮めても消えない（外側スクロールで
  // sticky フッタに覆われるのを防ぐ）。
  const planGrid = (
    <div
      className="plan-selection-grid min-h-0 flex-1"
      style={{ width: '100%' }}
    >
      {/* 支払申請一覧参照と同様：ヘッダーの全選択チェックボックスに左パディング（左寄せ） */}
      <style>{`
        .plan-selection-grid .ag-header-cell[aria-colindex="1"],
        .plan-selection-grid .ag-header-cell.ag-selection-checkbox-header {
          justify-content: flex-start;
          padding-left: 1.4rem;
        }
      `}</style>
      <AgGridReact
        ref={gridRef}
        rowData={planRows}
        getRowId={getPlanRowId}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getContextMenuItems={gridFilterContextMenuItems}
        suppressMovableColumns={true}
        ensureDomOrder={true}
        // 「引用」ボタンのセルから押下時の処理を呼ぶ。
        context={planGridContext}
        isExternalFilterPresent={isExternalFilterPresent}
        doesExternalFilterPass={doesExternalFilterPass}
        statusBar={GRID_STATUS_BAR}
        {...GRID_BASE_PROPS}
        {...gridColumnStateProps}
      />
    </div>
  );

  // 計画明細のグリッドのみの構成（カード枠は持たない）。設定先の拡売費明細は
  // 親画面の拡売費一覧（チェックボックス列）で選ぶため、当ペインには計画明細だけを表示する。
  // どの行に何が反映されるかが操作前に分かるよう、グリッドの上に操作の流れを書く。
  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-sm leading-normal text-gray-700">
        拡売費明細でチェックを付けた行に、計画の管理区分・管理コード・施策区分・
        施策コード・摘要1（社内用）を反映します。反映したい計画の行の「引用」を
        押してください。チェックは、この画面を開く前でも開いた後でもかまいません。
        反映した項目はセルの色が変わります。
      </p>
      {planGrid}
    </div>
  );
}

interface PlanAreaFieldProps {
  // 選択中の担当エリア（コード）。
  value: string[];
  onChange: (value: string[]) => void;
}

// 拡売費計画引用ペインのヘッダーに置く担当エリア選択（複数選択コンボボックス）。
// 選んだ担当エリアの計画明細だけを一覧に表示する（PaymentPlanSelectionPane の areaCodes へ渡す）。
// 担当エリアを1件も選んでいないときは絞り込まず、全担当エリアの計画明細を表示する。
// 担当エリアを2件以上選んでいるときは、右隣に「複数選択中」と表示する。
// 支払詳細(追加口請求書有／無)で使う（支払詳細(商流販売店紐づけなし)は置かない）。
export function PlanAreaField({ value, onChange }: PlanAreaFieldProps) {
  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="plan-area"
        className={`${FORM_LABEL_CLASS} whitespace-nowrap`}
      >
        担当エリア
      </label>
      {/* 全担当エリアを選んだ状態（初期値）でもチップが1行に収まる幅 */}
      <div className="w-lg">
        <MultiCombobox
          id="plan-area"
          options={PLAN_AREA_OPTIONS}
          value={value}
          onChange={onChange}
          placeholder="担当エリアを選択"
        />
      </div>
      {value.length > 1 && (
        <span className="text-sm whitespace-nowrap text-gray-700">
          複数選択中
        </span>
      )}
    </div>
  );
}
