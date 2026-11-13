// 支払詳細(商流販売店紐づけなし)：拡売費一覧の明細のモック（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// 画面は src/app/components/payment/payment-detail-unlinked/page.tsx。
import {
  NET_MGMT_CLASS_NAME,
  BLANK,
} from '@/app/utils/payment/payment-detail/nonProductExpenseRows';
import type { ExpenseRow } from '@/app/types/paymentDetail';

const EXPENSE_ROWS: ExpenseRow[] = [
  // ── 未承認NET拡売費合計（販売計画選択ボタン付き） ──────────────
  {
    ...BLANK,
    isGroup: true,
    product: '未承認NET拡売費合計',
    payAmount: 250000,
    planAmount: 250000,
    summary1: 'NET差額拡売費自動振替分',
  },
  {
    ...BLANK,
    isNetUnapproved: true,
    lineNo: 1,
    // 未承認NET明細は追加口（請求EDI取込）のNET差額から自動生成される。
    dataSource: '請求EDI',
    billName: 'アサヒ飲料 ワンダ極微糖 NET差額拡売費',
    planExpContent: 'ワンダ',
    product: 'ワンダ金の微糖185g30本',
    payAmount: 92000,
    planAmount: 0,
    taxClass: '課税8%:2',
    // 未承認NET明細の管理区分は「値引き（売上連動）」（区分値 1B3）で固定。
    mgmtClass: NET_MGMT_CLASS_NAME,
    mgmtCode: 'RA001',
    measureClass: '販売促進',
    measureCode: 'SP001',
    billNo: 'NET2407-001',
    planDiff: -8000,
    summary1: 'NET差額の自動振替（社内）',
    summary2: 'ネット差額調整（社外）',
    matchType: '',
    billPage: '①02',
  },
  {
    ...BLANK,
    isNetUnapproved: true,
    lineNo: 2,
    dataSource: '請求EDI',
    billName: 'アサヒ飲料 ワンダ カフェオレ NET差額拡売費',
    planExpContent: 'ワンダ',
    product: 'ワンダ ボトルコーヒー微糖500mL24本',
    payAmount: 85000,
    planAmount: 0,
    taxClass: '課税8%:2',
    // 未承認NET明細の管理区分は「値引き（売上連動）」（区分値 1B3）で固定。
    mgmtClass: NET_MGMT_CLASS_NAME,
    mgmtCode: 'RA002',
    measureClass: '販売促進',
    measureCode: 'SP002',
    billNo: 'NET2407-002',
    planDiff: -5000,
    summary1: 'NET差額の自動振替（社内）',
    summary2: 'ネット差額調整（社外）',
    matchType: '',
    billPage: '①02',
  },
  {
    ...BLANK,
    isNetUnapproved: true,
    lineNo: 3,
    dataSource: '請求EDI',
    billName: 'アサヒ飲料 ワンダ ブラック NET差額拡売費',
    planExpContent: 'ワンダ',
    product: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
    payAmount: 73000,
    planAmount: 0,
    taxClass: '課税8%:2',
    // 未承認NET明細の管理区分は「値引き（売上連動）」（区分値 1B3）で固定。
    mgmtClass: NET_MGMT_CLASS_NAME,
    mgmtCode: 'RB001',
    measureClass: '販売促進',
    measureCode: 'SP003',
    billNo: 'NET2407-003',
    planDiff: 13000,
    summary1: 'NET差額の自動振替（社内）',
    summary2: 'ネット差額調整（社外）',
    matchType: '',
    billPage: '①02',
  },
  // ── その他拡売費 ──────────────────────────────
  {
    ...BLANK,
    isGroup: true,
    product: 'その他拡売費合計',
    // 支払金額・計画金額＝その他明細の各合計（初回描画後は applyExpenseFormulas が再集計）
    payAmount: 57633,
    planAmount: 70233,
  },
  {
    ...BLANK,
    lineNo: 1,
    dataSource: '請求EDI',
    // 計画紐づけステータス：計画紐づけ済み（アイコン＝CircleCheck・緑）
    planLinked: true,
    billName: 'アサヒ飲料 ワンダ モーニングショット ６Ｐ アプリ20',
    billNote: 'アプリ20%相当の販促値引',
    // 請求金額（請求書に記載の金額）。計画金額とは別項目として保持する。
    billAmount: 57433,
    planExpContent: 'ワンダ',
    product: 'ワンダモーニングショット185g30本',
    payAmount: 57433,
    // 計画金額（列は非表示。合計サマリーの集計には使わない）。
    planAmount: 27433,
    taxClass: '課税8%:2',
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    measureClass: '販売促進',
    measureCode: 'SP001',
    billNo: '457801SA',
    planDiff: 0,
    summary1: 'アプリ施策の値引き原資（社内）',
    summary2: 'アプリ20%相当の販促値引（社外）',
    matchType: '数量違い:1',
    billPage: '①02',
  },
  // 費用分割先（ワンダ モーニングショットの分割明細）
  {
    ...BLANK,
    lineNo: '1-1',
    // 枝番行は親行（No.1）データの再掲のため、データ元も親行と同じ値にする。
    dataSource: '請求EDI',
    billName: 'アサヒ飲料 ワンダ モーニングショット ６Ｐ アプリ20',
    billNote: 'アプリ20%相当の販促値引',
    planExpContent: 'ワンダ',
    product: 'ワンダモーニングショット185g30本',
    payAmount: 20000,
    costSplit: '分割先',
    // 分割先グループ列：管理区分＝区分値「10」（売上連動拡売費A口）／管理コード＝RA001。
    // 区分列は名称を保持（区分値・名称は列側で導出）。費用分割ペインと同一モデル。
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    summary1: '東日本支社より分割',
    summary2: 'アプリ20%相当の販促値引（社外）',
    splitPrimaryStore: '三菱食品株式会社（イオン）:10888030',
    splitTertiaryStore: 'イオン東北ＲＤＣ:10863223',
    splitStore: 'イオンリテール:21100677',
    splitDept: '首都圏営業第二部:10002990',
    splitStaff: 'アサヒ　太郎:5172733',
  },
  {
    ...BLANK,
    lineNo: '1-2',
    dataSource: '請求EDI',
    billName: 'アサヒ飲料 ワンダ モーニングショット ６Ｐ アプリ20',
    billNote: 'アプリ20%相当の販促値引',
    planExpContent: 'ワンダ',
    product: 'ワンダモーニングショット185g30本',
    payAmount: 10000,
    costSplit: '分割先',
    // 分割先グループ列：管理区分＝区分値「10」（売上連動拡売費A口）／管理コード＝RA002。
    // 区分列は名称を保持（区分値・名称は列側で導出）。費用分割ペインと同一モデル。
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA002',
    summary1: '中部支社より分割',
    // 商流・組織は商流／組織マスタ（storeHierarchy／paymentOrgCascade）に実在する
    // 組合せにする（一次店〜担当者の各列で選択できる候補と一致させるため）。
    splitPrimaryStore: '三菱食品株式会社（イオン）:10888030',
    splitTertiaryStore: 'イオン関東ＲＤＣ:10863241',
    splitStore: 'マックスバリュ関東:21100742',
    splitDept: '中部営業部:10003002',
    splitStaff: 'アサヒ　次郎:5172735',
  },
  {
    ...BLANK,
    lineNo: 2,
    dataSource: 'AIC入力',
    // 計画紐づけステータス：計画紐づけ済み（アイコン＝CircleCheck・緑）
    planLinked: true,
    billName: 'アサヒ飲料 ワンダ アプリエントリーキャンペーン費',
    billNote: 'アプリエントリーキャンペーン',
    // 請求金額（請求書に記載の金額）。計画金額とは別項目として保持する。
    billAmount: 200,
    planExpContent: 'ブランド横断(全商品)',
    product: '-',
    payAmount: 200,
    planAmount: 200,
    taxClass: '課税10%:1',
    // 管理区分〜施策コード名称は No.3 と同じ値にする
    //（管理区分・管理コード・施策区分・施策コードの4項目。名称列は各値から導出）。
    mgmtClass: '拡売費(固定費)B口',
    mgmtCode: 'FB001',
    measureClass: 'スポット',
    measureCode: 'SS001',
    billNo: '457802SA',
    planDiff: 0,
    summary1: 'アプリ会員エントリー費（社内）',
    summary2: 'アプリ会員登録キャンペーン（社外）',
    matchType: '照合支払:0',
    billPage: '①02',
  },
  {
    ...BLANK,
    lineNo: 3,
    dataSource: 'AIC入力',
    // 計画紐づけステータス：計画紐づけ済み（アイコン＝CircleCheck・緑）
    planLinked: true,
    billName: 'アサヒ飲料 三ツ矢サイダー 試飲会費用　30店日',
    billNote: '試飲会費用（30店日）',
    // 請求金額（請求書に記載の金額）。計画金額とは別項目として保持する。
    billAmount: 600,
    planExpContent: '三ツ矢',
    product: '-',
    payAmount: 0,
    planAmount: 600,
    taxClass: '課税10%:1',
    mgmtClass: '拡売費(固定費)B口',
    mgmtCode: 'FB001',
    measureClass: 'スポット',
    measureCode: 'SS001',
    billNo: '457803SA',
    planDiff: -600,
    summary1: '店頭試飲会の実施費用（社内）',
    summary2: '試飲会30店日分の実施（社外）',
    matchType: '条件違い:2',
    billPage: '①02',
  },
  {
    ...BLANK,
    lineNo: 4,
    dataSource: '請求EDI',
    // 計画紐づけステータス：計画紐づけ済み（アイコン＝CircleCheck・緑）
    planLinked: true,
    billName: 'アサヒ飲料 ウィルキンソン 棚替え協力費',
    billNote: '新商品棚替え協力',
    // 請求金額（請求書に記載の金額）。計画金額とは別項目として保持する。
    billAmount: 30000,
    planExpContent: 'ウィルキンソン',
    product: 'ウィルキンソン炭酸水500mL24本',
    payAmount: 0,
    planAmount: 30000,
    taxClass: '課税10%:1',
    mgmtClass: '拡売費(固定費)A口',
    mgmtCode: 'FA002',
    measureClass: 'リピート',
    measureCode: 'SR001',
    planDiff: -30000,
    summary1: '棚替え什器協力費（社内）',
    summary2: '新商品棚替え協力（社外）',
    matchType: '数量違い:1',
    billNo: '457804SA',
    billPage: '①02',
  },
  {
    ...BLANK,
    lineNo: 5,
    // 追加口の行番15（データ元＝手入力）から転記された行のため、データ元も手入力。
    dataSource: '手入力',
    // 計画紐づけステータス：計画紐づけ済み（アイコン＝CircleCheck・緑）
    planLinked: true,
    // 追加口の行番15（拡売費処理）から転記された行。「追加口処理」で追加口へ戻せる。
    // 請求金額（請求書に記載の金額）。計画金額とは別項目として保持する。
    billAmount: 12000,
    sourceLineNo: 15,
    billName: 'アサヒ飲料 三ツ矢サイダーＰＥＴ５００ 店頭企画',
    billNote: '三ツ矢サイダー 店頭企画',
    planExpContent: '三ツ矢',
    // 追加口の行番15（三ツ矢サイダーＰＥＴ５００）に合わせて設定
    product: '三ツ矢サイダー500mL24本',
    payAmount: 0,
    planAmount: 12000,
    taxClass: '課税8%:2',
    mgmtClass: '売上連動拡売費本社口',
    mgmtCode: 'RH001',
    measureClass: 'リピート',
    measureCode: 'SR002',
    planDiff: -12000,
    summary1: '店頭販促企画の販促費（社内）',
    summary2: '三ツ矢サイダー店頭企画（社外）',
    matchType: '照合支払:0',
    billNo: '457805SA',
    billPage: '①02',
  },
  {
    // 計画紐づけ前（未紐付）の明細。
    // 「管理区分」〜「摘要2（社外用）」は
    // 初期表示を空白にする（BLANK の既定値をそのまま使う）。
    ...BLANK,
    lineNo: 6,
    dataSource: '請求EDI',
    billName: 'アサヒ飲料 カルピスウォーター 店頭サンプリング費',
    billNote: 'カルピスウォーター 新商品サンプリング',
    planExpContent: 'カルピス',
    product: 'カルピスウォーター500mL24本',
    // 請求金額は請求書の金額 8,000。計画未紐づけのため計画金額は 0。
    billAmount: 8000,
    payAmount: 0,
    planAmount: 0,
    taxClass: '課税8%:2',
    // 税込(円)＝支払金額×税率＋支払金額（課税8%）／計画差異＝支払金額−計画金額
    planDiff: 0,
    billNo: '457806SA',
    billPage: '①03',
  },
  {
    // No.6 と同じ値を持つ計画紐づけ前（未紐付）の明細（No. のみ 7）。
    // 管理区分〜摘要2 等は BLANK の既定値（空白）のまま。
    ...BLANK,
    lineNo: 7,
    dataSource: '請求EDI',
    billName: 'アサヒ飲料 カルピスウォーター 店頭サンプリング費',
    billNote: 'カルピスウォーター 新商品サンプリング',
    planExpContent: 'カルピス',
    product: 'カルピスウォーター500mL24本',
    billAmount: 8000,
    payAmount: 0,
    planAmount: 0,
    taxClass: '課税8%:2',
    planDiff: 0,
    billNo: '457806SA',
    billPage: '①03',
  },
];

// 既定の拡売費明細を新規生成する（行オブジェクトを複製して返す）。
// グリッドの編集は行オブジェクトへ直接反映されるため、支払回数ごとに
// 独立したデータセットを持てるよう、呼び出しのたびに複製する。
export const createExpenseRows = (): ExpenseRow[] =>
  EXPENSE_ROWS.map((row) => ({ ...row }));
