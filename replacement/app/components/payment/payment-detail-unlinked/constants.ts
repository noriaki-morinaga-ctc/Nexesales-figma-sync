// 引用明細選択エリア（共通部品 shared/payment/quote/QuoteSelectionPane）の本画面の設定と、検索条件の初期値
import { TARGET_MONTH } from './components/SearchPane';
import {
  quoteTargetMonthFrom,
  type QuoteSelectionConfig,
} from '@/app/components/shared/payment/quote/QuoteSelectionPane';

export {
  QuoteSelectionPane,
  QUOTE_PAYEE_ALL,
  QUOTE_PAYEE_OPTIONS,
  type QuoteDetailRow,
  type QuoteSelectionPaneHandle,
} from '@/app/components/shared/payment/quote/QuoteSelectionPane';

// 対象年月の初期値（基本情報の対象年月の1か月前。任意の月へ変更できる）
export const QUOTE_TARGET_MONTH_FROM = quoteTargetMonthFrom(TARGET_MONTH);
export const QUOTE_TARGET_MONTH_TO = QUOTE_TARGET_MONTH_FROM;

// 本画面の設定（列状態の保存キー・データ元の既定・当月の支払No・案内文）
export const QUOTE_SELECTION_CONFIG: QuoteSelectionConfig = {
  columnStateKey: '支払詳細C紐づけなし.引用明細選択.columnState.v3',
  defaultDataSource: null,
  currentPaymentNo: 'C2400NTO5',
  guidanceNote:
    '引用した明細は販売計画と紐づいていないため、計画金額は0円になります。',
};

// 支払情報のステータス（モック）。フッターのボタンの活性もこの値で決める（UI/UX UX-072）。
// 値は支払一覧のステータス（未申請／承認待ち／承認差戻し／検印待ち／検印差戻し／検印済）に合わせる。
export const PAYMENT_DETAIL_STATUS = '承認待ち';
