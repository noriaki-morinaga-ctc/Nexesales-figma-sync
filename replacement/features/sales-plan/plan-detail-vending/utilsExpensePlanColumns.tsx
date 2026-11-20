// 計画詳細(自販機)：経費計画グリッドの列の定義（転置：行＝経費項目、列＝拠点／区分の2段の見出し）。画面の状態・処理は引数で受け取る。
// 画面は最初の描画で1回だけ作る（列の定義を作り直さない。値は ref から読む）。
import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import type { CellClassParams, GridApi } from 'ag-grid-community';
import type {
  createExpensePlanInitialRows,
  EXPENSE_BASELINE,
} from '@/mocks/sales-plan/plan-detail-vending/expense';
import { Input } from '@/components/ui/input';
import {
  GRID_COLORS,
  totalCellStyle,
  sectionRowCellStyle,
} from '@/components/grid';
import { TEXT_INPUT_CLASS } from '@/styles/commonStyles';
import { REF_HIGHLIGHT_BORDER } from './constants';
import { formatDecimal1, formatExpenseNumber } from './utils';

type ExpensePlanRow = ReturnType<typeof createExpensePlanInitialRows>[number];

// 画面から受け取る状態・処理
interface ExpensePlanColumnDeps {
  expenseHighlightedCellsRef: MutableRefObject<string[]>;
  isDiffModeRef: MutableRefObject<boolean>;
  expenseBaselineData: typeof EXPENSE_BASELINE;
  recalculateExpensePlan: () => void;
  setExpensePlanData: Dispatch<SetStateAction<ExpensePlanRow[]>>;
  expensePlanDataRef: MutableRefObject<ExpensePlanRow[]>;
  isExpenseCellEditable: (rowIndex: number, field: string) => boolean;
  getExpenseCellStyle: (
    params: CellClassParams
  ) => Record<string, string | undefined>;
  computeCatPlanValues: (api: GridApi) => Record<number, number>;
  computeExpenseActual: (rowIndex: number, field: string) => number;
}

// 経費計画用のカラム定義（転置：行=経費項目、列=拠点/区分の2レベルヘッダー）
export const buildExpensePlanColumnDefs = ({
  expenseHighlightedCellsRef,
  isDiffModeRef,
  expenseBaselineData,
  recalculateExpensePlan,
  setExpensePlanData,
  expensePlanDataRef,
  isExpenseCellEditable,
  getExpenseCellStyle,
  computeCatPlanValues,
  computeExpenseActual,
}: ExpensePlanColumnDeps) => {
  const num = (v: any) =>
    parseFloat(String(v ?? '0').replace(/[,%]/g, '')) || 0;

  const onBranchChanged = (params: any) => {
    const newData = expensePlanDataRef.current.map((row, idx) =>
      idx === params.node.rowIndex ? { ...row, ...params.data } : row
    );
    setExpensePlanData(newData);
    recalculateExpensePlan();
  };

  // 拠点列の算出値を返す。
  //   604:ロケ契約料他前払い金(償却)(12) ＝ ロケ契約中(14) + ロケ契約見込(13)
  //   経費金額合計(0)・営業経費 小計(1) ＝ オペ協力金(9)〜前払金(償却)(12) の合算
  //     （12 は小計行のため、その子 13・14 は二重計上を避けて含めない。
  //       自販機関係費(16〜18)の拠点列は「－」のため、0 と 1 は同じ値になる → UI/UX UX-120）
  const branchValue = (api: any, rowIndex: number, field: string): number => {
    const rawAt = (i: number) => {
      const node = api?.getDisplayedRowAtIndex(i);
      const data = node?.data ?? expensePlanDataRef.current[i];
      return num((data as any)?.[field]);
    };
    if (rowIndex === 12) return rawAt(14) + rawAt(13);
    if (rowIndex === 0 || rowIndex === 1) {
      return rawAt(9) + rawAt(10) + rawAt(11) + branchValue(api, 12, field);
    }
    return rawAt(rowIndex);
  };

  // 拠点列（本社/支社）：その他経費は入力、経費金額合計行(0)は当該列の合算。
  // ヘッダーは「管理コード（改行）名称」の2段表示。折り返しと高さ調整は AG Grid 公式の
  // wrapHeaderText / autoHeaderHeight で行い、改行位置は headerName の \n で固定する
  // （\n を有効にする white-space の指定は下の <style> 側）。
  const branchCol = (field: string, headerName: string) => ({
    headerName,
    field,
    wrapHeaderText: true,
    autoHeaderHeight: true,
    width: 88,
    editable: (params: any) =>
      isExpenseCellEditable(params.node?.rowIndex ?? -1, field),
    valueGetter: (params: any) => {
      // 固定上段（単位行）は生値をそのまま表示
      if (params.node?.rowPinned) return params.data[field];
      if (params.data?.isParent && !params.data?.showAsValue) return '';
      const r = params.node?.rowIndex ?? -1;
      // 経費金額合計(0)・営業経費 小計(1)・前払金(償却)(12) は算出行のため合算値を返す
      if (r === 0 || r === 1 || r === 12)
        return branchValue(params.api, r, field);
      return params.data[field];
    },
    valueFormatter: (params: any) => formatExpenseNumber(params.value),
    cellStyle: (params: any) => getExpenseCellStyle(params),
    onCellValueChanged: onBranchChanged,
  });

  // 実績/予算列（読み取り専用）
  const plainCol = (field: string, headerName: string, width = 96) => ({
    headerName,
    field,
    width,
    editable: false,
    valueGetter: (params: any) => {
      if (params.node?.rowPinned) return params.data[field];
      if (params.data?.isParent && !params.data?.showAsValue) return '';
      const r = params.node?.rowIndex ?? -1;
      // 計算行（経費金額合計=0・営業経費 小計=1・条件口=2・条件口率=6・ロケ運転費率=8・
      // 自販機関係費 小計=15）の前月実績・予算・前年同月実績は、設定数式に基づく計算値を表示する。
      // ロケ運転費(7)は数式を削除し固定値のため生データをそのまま表示する。
      if (
        [0, 1, 2, 6, 8, 15].includes(r) &&
        (field === 'catZengetsuJisseki' ||
          field === 'catYosan' ||
          field === 'catZennenJisseki')
      ) {
        return computeExpenseActual(r, field);
      }
      return params.data[field];
    },
    valueFormatter: (params: any) => {
      // 条件口率(6)・ロケ運転費率(8) は率行のため % 付きで表示。
      // 小数第1位まで表示（小数第2位を四捨五入）。
      const r = params.node?.rowIndex ?? -1;
      if ((r === 6 || r === 8) && !params.node?.rowPinned) {
        const v = params.value;
        if (v === null || v === undefined || v === '' || v === '－')
          return v ?? '';
        const n = parseFloat(String(v).replace(/[,%]/g, ''));
        return isNaN(n) ? String(v) : formatDecimal1(n) + '%';
      }
      return formatExpenseNumber(params.value);
    },
    cellStyle: (params: any) => getExpenseCellStyle(params),
  });

  // 比列（cellRenderer が比率を算出）
  const ratioCol = (field: string, headerName: string, width = 80) => ({
    headerName,
    field,
    width,
    editable: false,
    valueGetter: (params: any) =>
      params.data?.isParent && !params.data?.showAsValue
        ? ''
        : params.data[field],
    cellStyle: (params: any) => getExpenseCellStyle(params),
  });

  return [
    {
      // 経費項目ラベル
      headerName: '経費項目',
      field: 'category',
      // この列は列グループに属さず見出しの段を縦にまたぐため、見出しの高さを中身に合わせない
      // （見出し全体の高さを自分の高さとして測り、見出しが伸び続けるため。高さはほかの列に合わせて決まる → UX-062）
      autoHeaderHeight: false,
      width: 192,
      lockPosition: true,
      // 横寄せは共通クラスで指定する（上段に固定した行は中央。→ 02 §6 セルの寄せ）
      cellClass: (params: any) =>
        params.node?.rowPinned === 'top' ? 'cell-center' : 'ag-cell-left',
      cellStyle: (params: any) => {
        if (params.node?.rowPinned === 'top') {
          return {
            backgroundColor: GRID_COLORS.readonly,
          };
        }
        const rowIndex = params.node?.rowIndex ?? -1;
        const rowData = params.data;
        // 字下げ：経費金額合計（rowIndex 0）・区切り行（営業経費／自販機関係費）は字下げしない。
        // 区切り行の配下の項目は1段（1rem）、その子行（オペ条件口など）は2段字下げして
        // 親子関係を示す（→ 02 §7「データ種の区切り（見出し）行」）
        const paddingLeft =
          rowIndex === 0 || rowData?.isGroupHeaderRow
            ? '0.5rem'
            : rowData?.isChild
              ? '2.5rem'
              : '1.5rem';
        const cellKey = `${rowIndex}-category`;
        const isHighlighted =
          expenseHighlightedCellsRef.current.includes(cellKey);
        // 経費金額合計行（rowIndex === 0）は合計行、区切り行（営業経費など）は区切り行のスタイル。
        // その他の行タイトルは通常（編集不可＝灰）背景。太字は合計行と区切り行（→ 02 §7・UX-117）
        const base = {
          paddingLeft,
          border: isHighlighted ? REF_HIGHLIGHT_BORDER : undefined,
        };
        if (rowIndex === 0) return totalCellStyle(base);
        if (rowData?.isGroupHeaderRow) return sectionRowCellStyle(base);
        return { ...base, backgroundColor: GRID_COLORS.readonly };
      },
      cellRenderer: (params: any) => {
        const label = params.value != null ? String(params.value) : '';
        if (params.node?.rowPinned) return label;
        const data = params.data;
        // レート行（オペ条件口=exp_col16 等）は項目名の右に
        // 参照用のレート（オペ条件口率）を編集可能なテキストボックスで表示
        if (data?.rateField) {
          const rate = data[data.rateField] ?? '';
          const rowIndex = params.node?.rowIndex ?? -1;
          // レート(オペ条件口率・帳合料率)を小数第1位まで % 付きで表示。
          // "－"・空・非数値は素通し。
          const formatRate = (v: any): string => {
            if (v == null || v === '' || v === '－') return v ?? '';
            const n = parseFloat(String(v).replace(/[%,]/g, ''));
            return isNaN(n) ? String(v) : formatDecimal1(n) + '%';
          };
          const rateDisplay = formatRate(rate);

          // 差分表示モード: レート（現在値 − 基準値）を表示する。
          // 基準値は expenseBaselineData[rowIndex][rateField] に持つ。
          if (isDiffModeRef.current) {
            const parseRate = (v: any) =>
              parseFloat(
                String(v ?? '')
                  .replace(/[%,+]/g, '')
                  .replace(/▲/g, '-')
              );
            const baseRaw = expenseBaselineData[rowIndex]?.[data.rateField];
            const cur = parseRate(rate);
            const base = parseRate(baseRaw);
            // 現在値／基準値が数値でない場合は項目名のみ表示
            if (baseRaw === undefined || isNaN(cur) || isNaN(base)) {
              return <span>{label}</span>;
            }
            // 小数第1位まで表示（小数第2位を四捨五入）
            const diff = Math.round((cur - base) * 10) / 10;
            const diffText =
              diff === 0
                ? '±0.0%'
                : diff > 0
                  ? `+${formatDecimal1(diff)}%`
                  : `▲${formatDecimal1(Math.abs(diff))}%`;
            const diffColor =
              diff > 0
                ? GRID_COLORS.increaseText
                : diff < 0
                  ? GRID_COLORS.decreaseText
                  : '#374151';
            return (
              // セル幅いっぱいに広げ、差分表示を ml-auto でセル右端へ寄せる
              // （category 列の cell-wrapper/value は下部 style で幅100%に拡張）。
              // 文字色は増減で変わる動的値のため style で渡す。
              <span className="flex w-full items-center">
                <span>{label}</span>
                <span
                  className="ml-auto text-xs font-medium"
                  style={{ color: diffColor }}
                >
                  {diffText}
                </span>
              </span>
            );
          }

          const rateKey = `${rowIndex}-${data.rateField}`;
          // 緑＝参照セル（その行の計画金額数式から参照される）
          const isRefHi = expenseHighlightedCellsRef.current.includes(rateKey);
          // 帳合料率(exp_col17) は入力可。他のレート（オペ条件口率 等）は参照のみ。
          const isRateEditable = data.rateField === 'exp_col17';
          // 入力確定（フォーカスアウト）時に値を反映して再計算する。
          const commitRate = (v: string) => {
            // 表示整形（小数第1位）による見かけの差異は無視し、
            // 数値として変化があるときだけ確定・再計算する。
            const nv = parseFloat(String(v).replace(/[%,]/g, ''));
            const cur = parseFloat(String(rate).replace(/[%,]/g, ''));
            if (isNaN(nv) ? v === rate : nv === cur) return;
            const newData = expensePlanDataRef.current.map((row, idx) =>
              idx === rowIndex ? { ...row, [data.rateField]: v } : row
            );
            setExpensePlanData(newData);
            recalculateExpensePlan();
          };
          return (
            // セル幅いっぱいに広げ、入力ボックスを ml-auto でセル右端へ寄せる
            // （category 列の cell-wrapper/value は下部 style で幅100%に拡張）。
            <span className="flex w-full items-center">
              <span>{label}</span>
              <Input
                type="text"
                // 入力中の再レンダリングでフォーカスが外れないよう非制御入力にし、
                // 外部値が変わったら key で再初期化する（key は spread せず直接渡す）
                key={isRateEditable ? rateDisplay : 'readonly'}
                {...(isRateEditable
                  ? {
                      // 確定は onBlur で行う
                      defaultValue: rateDisplay,
                      // 参照のみの率ボックスと同様に、クリック時は AG Grid の
                      // セルクリック（onExpenseCellClicked）で依存先（オレンジ）を
                      // 強調する。そのため data-rate-box を付け、クリックは
                      // 伝播させる（伝播を止めると強調されない）。
                      // 強調処理は編集を開始しないため、入力・フォーカスは妨げない。
                      'data-rate-box': 'true',
                      onMouseDown: (e: any) => e.stopPropagation(),
                      onBlur: (e: any) => commitRate(e.target.value),
                    }
                  : {
                      value: rateDisplay,
                      readOnly: true,
                      tabIndex: -1,
                      'data-rate-box': 'true',
                    })}
                title={data.rateLabel}
                aria-label={data.rateLabel}
                // 入力欄はほかの入力欄と同じ標準の見た目（TEXT_INPUT_CLASS → 02 §10.2）
                className={`${TEXT_INPUT_CLASS} ml-auto w-20 min-w-0 text-right text-blue-600 ${
                  isRateEditable ? 'cursor-text' : 'cursor-pointer'
                }`}
                style={{
                  border: isRefHi
                    ? REF_HIGHLIGHT_BORDER
                    : `1px solid ${GRID_COLORS.existingFuncBorder}`,
                  backgroundColor: isRateEditable
                    ? GRID_COLORS.editable
                    : GRID_COLORS.readonly,
                }}
              />
            </span>
          );
        }
        return label;
      },
    },
    {
      // 計画金額
      headerName: '計画金額',
      field: 'catPlan',
      width: 96,
      editable: (params: any) =>
        isExpenseCellEditable(params.node?.rowIndex ?? -1, 'catPlan'),
      valueGetter: (params: any) => {
        // 固定上段（単位行）は生値をそのまま表示
        if (params.node?.rowPinned) return params.data.catPlan;
        if (params.data?.isParent && !params.data?.showAsValue) return '';
        const r = params.node?.rowIndex ?? -1;
        // ロケ運転費金額(7) は手入力で数式クリア済みなら生値
        if (r === 7 && !params.data?.catPlan_formula) {
          return params.data.catPlan;
        }
        const computed = computeCatPlanValues(params.api);
        if (r in computed) return computed[r];
        return params.data.catPlan;
      },
      valueSetter: (params: any) => {
        params.data.catPlan = params.newValue;
        // ロケ運転費(7)は入力後、数式を適用せず入力値を採用する。
        // 数式を undefined にすると valueGetter/computeCatPlanValues が
        // 生の入力値を使用する（後続の {...row, ...params.data} で上書き反映）。
        if ((params.node?.rowIndex ?? -1) === 7) {
          params.data.catPlan_formula = undefined;
        }
        return true;
      },
      valueFormatter: (params: any) => {
        if (params.data?.isParent && !params.data?.showAsValue) return '';
        const r = params.node?.rowIndex ?? -1;
        if (r === 6) {
          // 条件口率：計算値（数値）は小数第1位まで % 付きで表示
          return typeof params.value === 'number'
            ? formatDecimal1(params.value) + '%'
            : (params.value ?? '');
        }
        if (r === 8) {
          // ロケ運転費率（生値 "19%"）を小数第1位まで % 付きで表示
          const v = params.value;
          if (v == null || v === '' || v === '－') return v ?? '';
          const n = parseFloat(String(v).replace(/[,%]/g, ''));
          return isNaN(n) ? String(v) : formatDecimal1(n) + '%';
        }
        return formatExpenseNumber(params.value);
      },
      cellStyle: (params: any) => getExpenseCellStyle(params),
      onCellValueChanged: (params: any) => {
        const newData = expensePlanDataRef.current.map((row, idx) =>
          idx === params.node.rowIndex ? { ...row, ...params.data } : row
        );
        setExpensePlanData(newData);
        recalculateExpensePlan();
      },
    },
    {
      headerName: '管理コード別',
      children: [
        branchCol('catHonsha', '10010\n本社'),
        branchCol('catShishaA', '10020\n支社A　自販機部門'),
        branchCol('catShishaBKyotsu', '10180\n支社B　自販機(共通)'),
        branchCol('catShishaBKaitaku', '10210\n支社B　開発(開拓)'),
      ],
    },
    {
      headerName: '前月',
      children: [
        plainCol('catZengetsuJisseki', '前月実績'),
        ratioCol('catZengetsuHi', '前月比'),
      ],
    },
    {
      headerName: '予算',
      children: [
        plainCol('catYosan', '予算'),
        ratioCol('catYosanHi', '予算比'),
      ],
    },
    {
      headerName: '前年',
      children: [
        plainCol('catZennenJisseki', '前年実績'),
        ratioCol('catZennenHi', '前年比'),
      ],
    },
  ];
};
