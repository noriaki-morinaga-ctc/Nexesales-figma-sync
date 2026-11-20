// 数値のセルを「数字だけ打ち込める入力欄」にする共通の設定（UI/UX UX-122 → 02 §7「入力値のチェック」）。
// 入力欄は AG Grid 公式の agNumberCellEditor（手売りの数値のセルと同じ）。↑↓キーで値を増減させない。
// 値を「2,000」「110%」のような文字で持つ表（自販機の計画・支払など）でも使えるよう、
//   ・編集を始めるときは値を数値（2000・110）にして入力欄に渡す（入力欄は数値しか受け取れないため）
//   ・確定した値（数値）は、編集前の値が文字なら文字に戻してから列の valueSetter／field へ渡す
// を行う。数字以外を戻す valueParser（revertNonNumericValueParser）は列の側にそのまま残す。
import type {
  ColDef,
  ColGroupDef,
  ICellEditorParams,
  ValueSetterParams,
} from 'ag-grid-community';
import { revertNonNumericValueParser } from './gridCommon';

// 編集を始めるときの値を数値にする（桁区切り・%・先頭の＋を外す。数値にできなければ空欄）
const toEditorNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value ?? '')
    .trim()
    .replace(/[,%]/g, '')
    .replace(/^\+/, '');
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

// 確定した値を編集前の値の型に合わせる（文字で持つ列は文字、空欄は空文字）
const toStoredType = (newValue: unknown, oldValue: unknown): unknown => {
  if (typeof oldValue === 'number') return newValue;
  if (newValue == null) return '';
  return typeof newValue === 'number' ? String(newValue) : newValue;
};

// 列の定義に広げて使う形（入力欄＋数字以外を戻す valueParser）。確定した値は数値で列の valueSetter に届くため、
// 値を文字で持つ列は valueSetter で String() にして保存する（valueSetter まで包むときは下の withNumberOnlyCellEditor）。
export const numberOnlyCellEditorProps = (
  precision?: number
): Pick<ColDef, 'cellEditor' | 'cellEditorParams' | 'valueParser'> => ({
  cellEditor: 'agNumberCellEditor',
  cellEditorParams: (params: ICellEditorParams) => ({
    value: toEditorNumber(params.value),
    preventStepping: true,
    ...(precision != null ? { precision } : {}),
  }),
  valueParser: revertNonNumericValueParser,
});

// 列の定義に数値だけの入力欄を付ける。precision に 0 を渡すと整数だけ（小数点を打てない）。
export function withNumberOnlyCellEditor<T = unknown>(
  colDef: ColDef<T>,
  precision?: number
): ColDef<T> {
  const { valueSetter, field } = colDef;
  return {
    ...colDef,
    cellEditor: numberOnlyCellEditorProps(precision).cellEditor,
    cellEditorParams: numberOnlyCellEditorProps(precision).cellEditorParams,
    valueSetter: (params: ValueSetterParams<T>) => {
      const next = {
        ...params,
        newValue: toStoredType(params.newValue, params.oldValue),
      };
      if (typeof valueSetter === 'function') return valueSetter(next);
      if (!field || !params.data) return false;
      (params.data as Record<string, unknown>)[field] = next.newValue;
      return true;
    },
  };
}

// 列の定義の一覧（列グループを含む）のうち、入力できる列すべてに数値だけの入力欄を付ける。
// precisionOf で列ごとの桁を決める（undefined なら小数も可）。
// 画面で組んだ列の定義の型（D）をそのまま返す（列の定義の型を ColDef に狭めないため）。
export function withNumberOnlyCellEditors<D extends object>(
  defs: readonly D[],
  precisionOf: (colDef: ColDef) => number | undefined
): D[] {
  return defs.map((def) => {
    const group = def as ColGroupDef;
    if (group.children) {
      return {
        ...def,
        children: withNumberOnlyCellEditors(group.children, precisionOf),
      };
    }
    const colDef = def as ColDef;
    if (!colDef.editable) return def;
    return withNumberOnlyCellEditor(colDef, precisionOf(colDef)) as D;
  });
}
