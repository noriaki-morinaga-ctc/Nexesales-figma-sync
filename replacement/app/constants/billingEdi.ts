// 請求EDI取込の区分値の定義・業務の決まり（バックエンドをつないでも残す値）。

import type { QtyUnitCode } from '@/app/types/billingEdi';

// 請求EDI（販売促進金請求）取込結果の型定義・仮データ。
// フォーマット: 日本加工食品卸協会 販売促進金システム 請求データ Version1。
// 項目の出典（区分x-y）は docs/EDI/請求EDIフォーマット_変換対象項目_棚卸.md を参照。
// 一覧の1行は「請求元企業 × 受信日時」＝1回の受信ファイル。実サンプル3社（国分・三菱食品・
// 伊藤忠食品）を解析した結果、いずれも1ファイル＝1卸で、区分1〜8のセットの繰り返しは
// 同一卸内の束（国分2,786組／三菱6組＝事業所単位）だった。請求書・伝票は1ファイル内に
// 多数あるため行にはできない（国分＝請求書442・伝票2,786・明細16,953）。
// 支払は商流販売店単位で、EDIとは粒度が一致しない。支払との紐づけは請求一覧・請求詳細が担う。
//
// 仮データの件数はすべて明細データから集計する（buildCounts／countErrorRows）。
// 実データ規模の数値を手書きすると画面の中で辻褄が合わなくなるため、モック内で閉じさせる。
// ファイル単位で取り込めないエラー。いずれもシステム管理担当が対応する。
//   フォーマット不正   … レコード長・区分の並び・文字コードが仕様と違う
//   二重取込           … 同一ファイルの再受信（作成日付＋作成時刻＋提供企業コードで判定）
//   件数・金額不一致   … 区分8-3 レコード件数／8-4 請求金額合計が実データと合わない
// ※受信失敗は受信できていない＝行を作れないため、この一覧には載らない
export const SYSTEM_ERROR_REASONS = [
  'フォーマット不正',
  '二重取込',
  '件数・金額不一致',
] as const;

export type SystemErrorReason = (typeof SYSTEM_ERROR_REASONS)[number];

// エラー区分。誰が対応するかで分ける（技術的な分類ではなく対応の担い手で切る）。
//   変換マスタ未登録 … 連携値は正しいが自社マスタに無い。業務担当がマスタを直すか
//                       変換後の値を登録して再取込する（決定4）
//   データ不正       … 連携値そのものが不正。卸へ照会するか、画面で値を直して再取込する
export const BILLING_EDI_ERROR_CATEGORIES = [
  '変換マスタ未登録',
  'データ不正',
] as const;

export type BillingEdiErrorCategory =
  (typeof BILLING_EDI_ERROR_CATEGORIES)[number];

// 計上対象数量単位の区分値と名称（請求EDIフォーマット定義 sys09_v2 区分4-12）。
// 0：円 は請求計上条件区分（4-13）が 0：％ の場合のみ使える
export const QTY_UNIT_DEFINITIONS: { code: QtyUnitCode; label: string }[] = [
  { code: '0', label: '円' },
  { code: '1', label: 'ケース' },
  { code: '3', label: 'バラ' },
  { code: '5', label: 'キログラム' },
  { code: '7', label: 'グラム' },
];

// 販売促進金摘要コード（区分4-24）の名称。フォーマット仕様書のコード表（01〜99）より抜粋。
// 費目（追加口／拡売費）の判別に使う最有力の項目（決定9）。
export const PROMO_SUMMARY_NAMES: Record<string, string> = {
  '01': 'センターフィ',
  '02': '大陳料',
  '03': '拡売協力金',
  '04': 'チラシ代',
  '06': 'ポップ代',
  '10': 'キャンペーン協力金',
  '22': '新規定番導入料',
  '90': '(各社任意コード)',
};

// 費目判別ロジックの名称（決定9。卸ごとにパターン化し、どの卸にどれを適用するかを設定する）。
// 議事録2026/8/4：摘要コード(4-24)を使う卸は少なく、国分は「商品コードを全て0にして商品名を
// その他とし、請求条件を数量1で請求」、別の卸は「請求計上条件区分」で判別できる、とされている。
export const EXPENSE_RULES = {
  bySummaryCode: '摘要コード判別',
  byProductCode: '商品コード判別',
  byConditionType: '請求計上条件区分判別',
  // 国分・トーカン。約定区分が H ならセンターフィ、N なら摘要コード判別へ回す
  // （8-24 決定1／第27回 決定9）
  byContractType: '約定区分判別',
  // 卸ごとのロジックで判別できない場合の最終フォールバック（第30回 決定27／第31回 決定17）
  byTaxType: '消費税区分判別',
} as const;

export type ExpenseRule = (typeof EXPENSE_RULES)[keyof typeof EXPENSE_RULES];

// 約定区分（8-24 決定1）。H＝センターフィ、N＝摘要コード判別へ回す。
// ※日食協フォーマットに「約定区分」という項目名は無く、どの項目で連携されるかが未特定
//   （計上№（4-4）の7桁目が有力候補。卸への確認待ち）。特定できるまでは明細が持つ
//   contractType を連携値の置き場とし、画面には出さない。
export const CONTRACT_TYPE_CENTER_FEE = 'H';

export const CONTRACT_TYPE_NORMAL = 'N';

// 画面で値を直したときの区分。
//   連携値修正 … 形式エラー。卸から届いた値そのものが不正なため、明細のセルで直す
//   変換値指定 … 変換エラー。連携値は正しく変換先が決まらないため、変換後の値を指定する
//                （マスタ修正が本筋。値の指定は応急処置＝資料No1「卸へ照会し値を指定」）
export const CORRECTION_KINDS = ['連携値修正', '変換値指定'] as const;

export type CorrectionKind = (typeof CORRECTION_KINDS)[number];

// 変換エラーで画面から指定する「変換後の値」の種類。
// 商流販売店変換マスタの出力は商流販売店（一次店・三次店・販売店）そのものであり（決定12）、
// コードごとの変換先を指定する方式は採らない。
export const ASSIGN_TARGETS = ['商流販売店', 'オンライン商品'] as const;

export type AssignTarget = (typeof ASSIGN_TARGETS)[number];

// エラー項目 → 指定する変換後の値の種類
export const ASSIGN_TARGET_BY_FIELD: Record<string, AssignTarget> = {
  商流販売店: '商流販売店',
  商品コード: 'オンライン商品',
};

// エラー種別ごとの対応部署（決定10 2026-08-18）。マスタで設定し、対応の進行に応じて付け替えない。
// 取込エラーの一次対応はAICが担う（課題No.1278・2026-08-27 芳賀回答。営業戦略部はデータの
// 詳細を見られる環境にないため）。ファイル自体が壊れていて業務では直せないものだけ
// システム管理担当が対応する。
export const ERROR_CATEGORY_OWNERS: Record<string, string> = {
  フォーマット不正: 'システム管理担当',
  二重取込: 'システム管理担当',
  '件数・金額不一致': 'システム管理担当',
  変換マスタ未登録: 'AIC',
  データ不正: 'AIC',
};

// 再取込の状態（エラーサマリ1件ごと）
export const REIMPORT_STATES = ['未実施', '解消', '未解消'] as const;

export type ReimportState = (typeof REIMPORT_STATES)[number];

// 商品を特定できない商品コード（すべて0／すべて9）。卸が拡売費をまとめて請求するときに使う。
// 変換エラーにはせず、サマリ商品「ブランド横断」へ寄せる（8-24 決定2）。
// オンライン商品は特定できないため空のままとする。
export const SUMMARY_PRODUCT_CROSS_BRAND_CODE = 'SM9999';

export const SUMMARY_PRODUCT_CROSS_BRAND_NAME = 'ブランド横断';
