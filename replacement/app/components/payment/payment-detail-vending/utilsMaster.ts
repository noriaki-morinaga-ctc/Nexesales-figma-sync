// 支払詳細(自販機)：画面の定数を使う処理（管理項目の引き当て・支払情報サマリの照合・カードの高さ・セルの書式・管理コードの連動）
import { CellClassParams, CellStyle } from 'ag-grid-community';
import { type SingleComboboxOption } from '@/app/components/ui/single-combobox';
import type { ExpenseItemData } from './paymentDetailVending.types';
import {
  EXPENSE_SECTION_ITEMS,
  EXPENSE_AGGREGATE_ITEMS,
  MANAGEMENT_ITEM_BY_CATEGORY_CODE,
  MANAGEMENT_CODE_COMBO_OPTIONS_BY_CATEGORY,
  SUMMARY_TARGET_BY_CATEGORY_CODE,
  SUMMARY_MANAGEMENT_CODE,
  DETAIL_CARD_HEIGHT_OFFSET,
  DETAIL_CARD_INITIAL_RATIO,
  DETAIL_CARD_MIN_HEIGHT,
  EDITABLE_CELL_BG,
  NON_EDITABLE_CELL_BG,
  INHERITED_TEXT_COLOR,
} from './constants';
import {
  isSplitDestRow,
  splitCategoryCode,
  rowManagementCodeField,
} from './utilsRows';

export const isExpenseSectionRow = (data?: { expenseItem?: string }): boolean =>
  EXPENSE_SECTION_ITEMS.includes(data?.expenseItem ?? '');

export const isExpenseAggregateRow = (data?: {
  expenseItem?: string;
}): boolean => EXPENSE_AGGREGATE_ITEMS.includes(data?.expenseItem ?? '');

export const managementItem = (managementCategory?: string) =>
  MANAGEMENT_ITEM_BY_CATEGORY_CODE[splitCategoryCode(managementCategory)];

// 管理区分に紐づく管理コードの選択肢。管理区分が未選択の行では選択肢を出さない
// （管理区分を決めないと組み合わせが定まらないため）。
export const managementCodeOptions = (managementCategory?: string): string[] =>
  managementItem(managementCategory)?.codes ?? [];

export const managementCodeComboOptions = (
  managementCategory?: string
): SingleComboboxOption[] =>
  MANAGEMENT_CODE_COMBO_OPTIONS_BY_CATEGORY[
    splitCategoryCode(managementCategory)
  ] ?? [];

// 管理区分に紐づく管理コードかを判定する（管理区分の変更時に組み合わせの成立を確認する）。
export const isValidManagementCode = (
  managementCategory: string,
  managementCode: string
): boolean =>
  managementCodeOptions(managementCategory).includes(managementCode);

// 管理区分に対応する勘定科目。対応が無い管理区分（未入力・旧データ）は空文字を返す。
export const managementAccount = (managementCategory?: string): string =>
  managementItem(managementCategory)?.account ?? '';

// 支払情報サマリの集計先管理区分コード。マスタに無いコード（旧データ等）は自身を集計先とする。
export const summaryTargetCategoryCode = (categoryCode: string): string =>
  SUMMARY_TARGET_BY_CATEGORY_CODE[categoryCode] ?? categoryCode;

// 合計値の各行に足し込む明細かを判定する。
// 明細グリッドに「経費項目」列は無く利用者が入力するのは管理区分のため、管理区分コードで突き合わせる
// （これにより行追加で入力された明細も合計値へ反映される）。
// 明細の管理区分は集計先管理区分（自販機リース料＝880・販売器具移設費＝89H へ寄せる）へ読み替えて比較する。
// 管理区分が未入力の行（分割先明細など）は経費項目名の一致で判定する。
export const matchesSummaryItem = (
  d: Pick<ExpenseItemData, 'expenseItem' | 'managementCategory'>,
  item: string
): boolean => {
  const code = splitCategoryCode(d.managementCategory);
  return code
    ? summaryTargetCategoryCode(code) === SUMMARY_MANAGEMENT_CODE[item]
    : d.expenseItem === item;
};

// 分割金額（「他部門へ」）を足し込む合計値の行かを、分割先の管理区分で判定する。
// 分割先の管理区分が未入力の場合は分割元から引き継いだ経費項目名で判定する。
export const matchesSplitDestSummaryItem = (
  d: ExpenseItemData,
  item: string
): boolean =>
  matchesSummaryItem(
    {
      expenseItem: d.expenseItem,
      managementCategory: d.splitDestMgmtCategory ?? '',
    },
    item
  );

export const initialDetailCardHeight = (): number =>
  Math.max(
    DETAIL_CARD_MIN_HEIGHT,
    (window.innerHeight - DETAIL_CARD_HEIGHT_OFFSET) * DETAIL_CARD_INITIAL_RATIO
  );

// 分割先行は入力不可（灰背景・薄いグレー文字＝親の参照値）、通常行は editableBase で表示する cellStyle。
export const inheritOnDestCellStyle =
  (editableBase: string) =>
  (params: CellClassParams): CellStyle =>
    isSplitDestRow(params.data)
      ? {
          backgroundColor: NON_EDITABLE_CELL_BG,
          color: INHERITED_TEXT_COLOR,
        }
      : { backgroundColor: editableBase };

// 分割先行は入力可（白）、それ以外は入力不可（灰）とする共通 cellStyle。
export const destEditableCellStyle = (params: CellClassParams): CellStyle => ({
  backgroundColor: isSplitDestRow(params.data)
    ? EDITABLE_CELL_BG
    : NON_EDITABLE_CELL_BG,
});

// 管理区分の変更に連動する管理コード（従属セル）を求める。管理コードは管理区分ごとに
// 選択肢が決まっているため、次のとおり更新する。
//  ・選択肢が1件しかない管理区分 … 組み合わせが一意に決まるためその管理コードを自動補完する
//  ・上記以外 … 新しい管理区分で組み合わせが成立しなくなった管理コードをクリアする
// 分割先行は分割先固有の管理コード（splitDestMgmtCode）を対象とし、もう一方はそのまま返す。
export const deriveManagementCodeDeps = (
  managementCategory: string,
  row: ExpenseItemData
): Partial<ExpenseItemData> => {
  const codeField = rowManagementCodeField(row);
  const currentCode = (row[codeField] as string | undefined) ?? '';
  const codeOptions = managementCodeOptions(managementCategory);
  let nextCode = currentCode;
  if (codeOptions.length === 1) {
    nextCode = codeOptions[0];
  } else if (
    currentCode &&
    !isValidManagementCode(managementCategory, currentCode)
  ) {
    nextCode = '';
  }
  return {
    managementCode: row.managementCode,
    splitDestMgmtCode: row.splitDestMgmtCode,
    [codeField]: nextCode,
  };
};
