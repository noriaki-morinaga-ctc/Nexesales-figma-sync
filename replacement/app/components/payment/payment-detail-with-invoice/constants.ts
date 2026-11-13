// 引用明細選択エリア（共通部品 shared/payment/quote/QuoteSelectionPane）の本画面の設定と、検索条件の初期値
import { BASIC_INFO } from '@/app/components/shared/payment/payment-detail/AdditionalPaymentBasicInfoPane';
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
export const QUOTE_TARGET_MONTH_FROM = quoteTargetMonthFrom(
  BASIC_INFO.targetMonth
);
export const QUOTE_TARGET_MONTH_TO = QUOTE_TARGET_MONTH_FROM;

// 本画面の設定（列状態の保存キー・データ元の既定・当月の支払No・案内文）
export const QUOTE_SELECTION_CONFIG: QuoteSelectionConfig = {
  columnStateKey: '支払詳細C.引用明細選択.columnState.v6',
  defaultDataSource: '請求EDI',
  currentPaymentNo: 'C2400NTO3',
  guidanceNote:
    '引用した明細の計画金額は0円になります（拡売費計画から引用した情報は引き継ぎません）。',
};
