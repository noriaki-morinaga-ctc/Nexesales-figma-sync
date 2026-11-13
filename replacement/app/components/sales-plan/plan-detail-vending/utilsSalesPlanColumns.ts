// 計画詳細(自販機)：販売計画グリッドの列の定義（3段の見出し）。画面の状態・処理は引数で受け取る。
// 画面は最初の描画で1回だけ作る（列の定義を作り直さない。値は ref から読む）。
import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import type { CellClassParams, GridApi } from 'ag-grid-community';
import type { AgGridReact } from 'ag-grid-react';
import type { createSalesPlanInitialRows } from '@/mocks/sales-plan/plan-detail-vending/salesPlan';
import { GRID_COLORS } from '@/app/components/grid';
import { REF_HIGHLIGHT_BORDER } from './constants';
import {
  computeSalesCol18,
  computeSalesPlanCol1,
  formatDecimal1,
  round,
} from './utils';

type SalesPlanRow = ReturnType<typeof createSalesPlanInitialRows>[number];

// 画面から受け取る状態・処理
interface SalesPlanColumnDeps {
  highlightedCellsRef: MutableRefObject<string[]>;
  gridRef: MutableRefObject<AgGridReact | null>;
  recalculateSalesPlan: () => void;
  recalculateAll: () => void;
  evalSalesMultiplyFormula: (formula: string, api: GridApi) => number | null;
  setSalesPlanData: Dispatch<SetStateAction<SalesPlanRow[]>>;
  salesPlanDataRef: MutableRefObject<SalesPlanRow[]>;
  isCellEditable: (rowIndex: number, field: string) => boolean;
  getCellStyle: (params: CellClassParams) => Record<string, string | undefined>;
}

// AG Grid用のカラム定義（3レベルヘッダー）
export const buildSalesPlanColumnDefs = ({
  highlightedCellsRef,
  gridRef,
  recalculateSalesPlan,
  recalculateAll,
  evalSalesMultiplyFormula,
  setSalesPlanData,
  salesPlanDataRef,
  isCellEditable,
  getCellStyle,
}: SalesPlanColumnDeps) => [
  {
    headerName: '',
    // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
    suppressColumnsToolPanel: true,
    field: 'category',
    // この列は列グループに属さず見出しの段を縦にまたぐため、見出しの高さを中身に合わせない
    // （見出し全体の高さを自分の高さとして測り、見出しが伸び続けるため。高さはほかの列に合わせて決まる → UX-062）
    autoHeaderHeight: false,
    width: 160,
    lockPosition: true,
    // 横寄せは共通クラスで指定する（上段に固定した行は中央。→ 02 §6 セルの寄せ）
    cellClass: (params: any) => {
      if (params.node?.rowPinned === 'top') {
        return 'cell-center';
      }
      return 'ag-cell-left';
    },
    cellStyle: (params: any) => {
      if (params.node?.rowPinned === 'top') {
        return {
          backgroundColor: GRID_COLORS.readonly,
        };
      }
      const rowIndex = params.node?.rowIndex ?? -1;

      // 参照セルとして強調表示されているかチェック
      const cellKey = `${rowIndex}-category`;
      const isHighlighted = highlightedCellsRef.current.includes(cellKey);

      // 合計行（rowIndex === 0）の場合は合計色の背景
      if (rowIndex === 0) {
        return {
          backgroundColor: GRID_COLORS.total,
          fontWeight: 'bold',
          paddingLeft: '0.5rem',
          border: isHighlighted ? REF_HIGHLIGHT_BORDER : undefined,
        };
      }
      return {
        backgroundColor: GRID_COLORS.readonly,
        // 合計行以外の行タイトルは太字にしない（太字は合計行のみ／標準準拠）
        fontWeight: 'normal',
        paddingLeft: '0.5rem',
        border: isHighlighted ? REF_HIGHLIGHT_BORDER : undefined,
      };
    },
  },
  {
    headerName: '社外売上高（計画）',
    children: [
      {
        headerName: '当月計画',
        field: 'col1',
        width: 64,
        editable: (params: any) =>
          !params.node?.rowPinned &&
          isCellEditable(params.node?.rowIndex ?? -1, 'col1'),
        tooltipValueGetter: (params: any) => {
          if (params.data.col1_formula) {
            const rowIndex = params.node?.rowIndex ?? -1;
            if (rowIndex === 0)
              return '数式: 専用機 + 提携機 + アライアンス品（本社入力） + その他（手売り） + 出荷実販差';
            if (rowIndex === 3)
              return '数式: 合計函数 × 函単価 + アライアンス品契約状況変動に伴う追加売上金額';
            if (rowIndex >= 1 && rowIndex <= 5)
              return '数式: 合計函数 × 函単価';
          }
          return null;
        },
        valueGetter: (params: any) => {
          // 商流販売店計行（rowIndex === 0）の数式: SUM(B3:B7)
          if (params.data.col1_formula && params.node?.rowIndex === 0) {
            return computeSalesPlanCol1(salesPlanDataRef.current);
          }
          // 専用機行（rowIndex === 1）・提携機行（rowIndex === 2）の数式: =G*S
          if (
            params.data.col1_formula &&
            (params.node?.rowIndex === 1 || params.node?.rowIndex === 2)
          ) {
            // col6(合計函数)は col6 列の valueGetter を単一の計算元と
            // して参照する（K/J の再計算をここで重複させない）
            const col6 =
              parseFloat(
                String(params.getValue('col6') ?? '0').replace(/[,%]/g, '')
              ) || 0;
            // 単価(col18)は col18 列の valueGetter（base × 価格改定率）を参照する
            const col18 = parseFloat(
              String(params.getValue('col18') ?? '0').replace(/[,%]/g, '')
            );
            const result = !isNaN(col6) && !isNaN(col18) ? col6 * col18 : 0;

            return result;
          }
          // アライアンス品行（rowIndex === 3）の数式: =G5*S5+U5
          if (params.data.col1_formula && params.node?.rowIndex === 3) {
            // col6(合計函数)は col6 列の valueGetter を単一の計算元と
            // して参照する（K/J の再計算をここで重複させない）
            const col6 =
              parseFloat(
                String(params.getValue('col6') ?? '0').replace(/[,%]/g, '')
              ) || 0;
            // 単価(col18)は col18 列の valueGetter（base × 価格改定率）を参照する
            const col18 = parseFloat(
              String(params.getValue('col18') ?? '0').replace(/[,%]/g, '')
            );
            const col20 =
              parseFloat(String(params.data.col20 || '0').replace(/,/g, '')) ||
              0;
            const result =
              !isNaN(col6) && !isNaN(col18) ? col6 * col18 + col20 : 0;

            return result;
          }
          // その他行（rowIndex === 4）・出荷実販差行（rowIndex === 5）の数式: =G*S
          if (
            params.data.col1_formula &&
            (params.node?.rowIndex === 4 || params.node?.rowIndex === 5)
          ) {
            const col6 = parseFloat(
              String(params.data.col6 || '0').replace(/,/g, '')
            );
            // 単価(col18)は col18 列の valueGetter（base × 価格改定率）を参照する
            const col18 = parseFloat(
              String(params.getValue('col18') ?? '0').replace(/[,%]/g, '')
            );
            const result = !isNaN(col6) && !isNaN(col18) ? col6 * col18 : 0;

            return result;
          }
          return params.data.col1;
        },
        valueFormatter: (params: any) => {
          // 数式が設定されているセルはすべて計算結果を整数に四捨五入して表示
          if (params.data.col1_formula && typeof params.value === 'number') {
            return Math.round(params.value).toLocaleString();
          }
          if (typeof params.value === 'number') {
            return params.value.toLocaleString();
          }
          return params.value;
        },
        valueSetter: (params: any) => {
          // 数式が入力された場合の処理
          const newValue = params.newValue;
          if (newValue && newValue.startsWith('=')) {
            params.data.col1_formula = newValue;
            // 数式は保存するが、表示は計算値を使用
            return true;
          }
          params.data.col1 = newValue;
          return true;
        },
        cellStyle: (params: any) => getCellStyle(params),
        onCellValueChanged: (params: any) => {
          const newData = salesPlanDataRef.current.map((row, idx) =>
            idx === params.node.rowIndex ? { ...row, ...params.data } : row
          );
          setSalesPlanData(newData);
          // 他の行が変更された場合、数式を含む行を再計算
          params.api.refreshCells({
            rowNodes: [params.api.getDisplayedRowAtIndex(0)!],
            force: true,
          });
          // 専用機行のcol1も再計算（col6やcol18に依存）
          const row1 = params.api.getDisplayedRowAtIndex(1);
          if (row1) {
            params.api.refreshCells({
              rowNodes: [row1],
              force: true,
            });
          }
          // 提携機行のcol1とcol3も再計算
          const row2 = params.api.getDisplayedRowAtIndex(2);
          if (row2) {
            params.api.refreshCells({
              rowNodes: [row2],
              force: true,
            });
          }
        },
      },
      {
        headerName: '予算',
        children: [
          {
            headerName: '金額',
            field: 'col21',
            width: 64,
            hide: true, // 初期非表示（→ SALES_PLAN_INITIAL_HIDDEN_COLS）
            editable: false,
            cellStyle: (params: any) => getCellStyle(params),
          },
          {
            headerName: '予算比',
            field: 'col22',
            width: 56,
            hide: true, // 初期非表示（→ SALES_PLAN_INITIAL_HIDDEN_COLS）
            editable: false,
            tooltipValueGetter: (params: any) => {
              if (params.data.col22_formula) {
                const rowIndex = params.node?.rowIndex ?? -1;
                if (rowIndex >= 0 && rowIndex <= 5)
                  return '数式: 当月計画 ÷ 予算';
              }
              return null;
            },
            // 予算比 = 当月計画(col1) ÷ 予算(col21) × 100
            valueGetter: (params: any) => {
              const rowIndex = params.node?.rowIndex ?? -1;
              if (params.data.col22_formula && rowIndex >= 0 && rowIndex <= 5) {
                const col1 =
                  parseFloat(
                    String(params.getValue('col1') ?? '0').replace(/[,%]/g, '')
                  ) || 0;
                const col21 = parseFloat(
                  String(params.data.col21 ?? '0').replace(/[,%]/g, '')
                );
                if (!isNaN(col21) && col21 !== 0) {
                  return (col1 / col21) * 100;
                }
                return 0;
              }
              return params.data.col22;
            },
            valueFormatter: (params: any) => {
              const rowIndex = params.node?.rowIndex ?? -1;
              if (
                params.data.col22_formula &&
                rowIndex >= 0 &&
                rowIndex <= 5 &&
                typeof params.value === 'number'
              ) {
                return formatDecimal1(params.value) + '%';
              }
              return params.value;
            },
            cellStyle: (params: any) => getCellStyle(params),
          },
        ],
      },
      {
        headerName: '前年実績',
        children: [
          {
            headerName: '金額',
            field: 'col2',
            width: 64,
            hide: true, // 初期非表示（→ SALES_PLAN_INITIAL_HIDDEN_COLS）
            editable: (params: any) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col2'),
            tooltipValueGetter: (params: any) => {
              if (params.data.col2_formula) {
                const rowIndex = params.node?.rowIndex ?? -1;
                if (rowIndex === 0)
                  return '数式: 専用機 + 提携機 + アライアンス品（本社入力） + その他（手売り） + 出荷実販差';
              }
              return null;
            },
            valueGetter: (params: any) => {
              // 数式がある場合は計算結果を表示
              if (params.data.col2_formula && params.node?.rowIndex === 0) {
                let sum = 0;
                // rowIndex 1-5の合計を計算
                for (let i = 1; i <= 5; i++) {
                  const rowNode = params.api.getDisplayedRowAtIndex(i);
                  if (rowNode && rowNode.data.col2) {
                    const value = String(rowNode.data.col2).replace(/,/g, '');
                    const num = parseFloat(value);
                    if (!isNaN(num)) {
                      sum += num;
                    }
                  }
                }
                return sum.toLocaleString();
              }
              return params.data.col2;
            },
            valueSetter: (params: any) => {
              // 数式が入力された場合の処理
              const newValue = params.newValue;
              if (newValue && newValue.startsWith('=')) {
                params.data.col2_formula = newValue;
                // 数式は保存するが、表示は計算値を使用
                return true;
              }
              params.data.col2 = newValue;
              return true;
            },
            cellStyle: (params: any) => getCellStyle(params),
            onCellValueChanged: (params: any) => {
              const newData = [...salesPlanDataRef.current];
              newData[params.node.rowIndex] = params.data;
              setSalesPlanData(newData);
              // 他の行が変更された場合、数式を含む行を再計算
              params.api.refreshCells({
                rowNodes: [params.api.getDisplayedRowAtIndex(0)!],
                force: true,
              });
              // 専用機行も再計算
              const row1 = params.api.getDisplayedRowAtIndex(1);
              if (row1) {
                params.api.refreshCells({
                  rowNodes: [row1],
                  force: true,
                });
              }
              // 提携機行も再計算
              const row2 = params.api.getDisplayedRowAtIndex(2);
              if (row2) {
                params.api.refreshCells({
                  rowNodes: [row2],
                  force: true,
                });
              }
            },
          },
          {
            headerName: '前年比',
            field: 'col3',
            width: 56,
            editable: (params: any) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col3'),
            tooltipValueGetter: (params: any) => {
              if (params.data.col3_formula) {
                return '数式: 当月計画 ÷ 前年実績';
              }
              return null;
            },
            valueGetter: (params: any) => {
              // 数式がある場合は計算結果を表示（rowIndex 0-5 全対応）
              if (
                params.data.col3_formula &&
                (params.node?.rowIndex === 0 ||
                  params.node?.rowIndex === 1 ||
                  params.node?.rowIndex === 2 ||
                  params.node?.rowIndex === 3 ||
                  params.node?.rowIndex === 4 ||
                  params.node?.rowIndex === 5)
              ) {
                // col1(当月計画)は col1 列の valueGetter を単一の計算元
                // として参照する（ここで再計算しない）
                const col1Num =
                  parseFloat(
                    String(params.getValue('col1') ?? '0').replace(/[,%]/g, '')
                  ) || 0;

                const col2Num = parseFloat(
                  String(params.data.col2 || '0').replace(/,/g, '')
                );
                if (!isNaN(col1Num) && !isNaN(col2Num) && col2Num !== 0) {
                  return (col1Num / col2Num) * 100;
                }
                return 0;
              }
              return params.data.col3;
            },
            valueFormatter: (params: any) => {
              // col3（割り算あり）: 小数第1位まで表示（小数第2位を四捨五入）
              if (
                params.data.col3_formula &&
                (params.node?.rowIndex === 0 ||
                  params.node?.rowIndex === 1 ||
                  params.node?.rowIndex === 2 ||
                  params.node?.rowIndex === 3 ||
                  params.node?.rowIndex === 4 ||
                  params.node?.rowIndex === 5)
              ) {
                const value = params.value;
                if (typeof value === 'number') {
                  return formatDecimal1(value) + '%';
                }
              }
              return params.value;
            },
            valueSetter: (params: any) => {
              // 数式が入力された場合の処理
              const newValue = params.newValue;
              if (newValue && newValue.startsWith('=')) {
                params.data.col3_formula = newValue;
                // 数式は保存するが、表示は計算値を使用
                return true;
              }
              params.data.col3 = newValue;
              return true;
            },
            cellStyle: (params: any) => getCellStyle(params),
            onCellValueChanged: (params: any) => {
              const newData = [...salesPlanDataRef.current];
              newData[params.node.rowIndex] = params.data;
              setSalesPlanData(newData);
              // col1やcol2が変更された場合、数式を含む行を再計算
              params.api.refreshCells({
                rowNodes: [params.api.getDisplayedRowAtIndex(0)!],
                force: true,
              });
              // 専用機行も再計算
              const row1 = params.api.getDisplayedRowAtIndex(1);
              if (row1) {
                params.api.refreshCells({
                  rowNodes: [row1],
                  force: true,
                });
              }
            },
          },
        ],
      },
    ],
  },
  {
    // 売上函数（第一階層）。当月実績(col4)を第二・第三階層を結合した
    // 単一リーフ列として表示する
    headerName: '売上函数',
    children: [
      {
        headerName: '当月実績',
        field: 'col4',
        width: 64,
        hide: true, // 初期非表示（→ SALES_PLAN_INITIAL_HIDDEN_COLS）
        editable: (params: any) =>
          !params.node?.rowPinned &&
          isCellEditable(params.node?.rowIndex ?? -1, 'col4'),
        cellStyle: (params: any) => getCellStyle(params),
        onCellValueChanged: (params: any) => {
          const newData = [...salesPlanDataRef.current];
          newData[params.node.rowIndex] = params.data;
          setSalesPlanData(newData);
        },
      },
    ],
  },
  {
    headerName: '合計函数（計画）',
    children: [
      {
        headerName: '合計函数',
        field: 'col6',
        width: 64,
        editable: (params: any) =>
          !params.node?.rowPinned &&
          isCellEditable(params.node?.rowIndex ?? -1, 'col6'),
        // 編集できるのは 4・5 行目だけ（isCellTrigger）で、標準の文字入力で編集する
        tooltipValueGetter: (params: any) => {
          if (params.data.col6_formula) {
            const rowIndex = params.node?.rowIndex ?? -1;
            if (rowIndex === 0)
              return '数式: 専用機 + 提携機 + アライアンス品（本社入力） + その他（手売り） + 出荷実販差';
            if (rowIndex >= 1 && rowIndex <= 3)
              return '数式: 合計本数 ÷ 平均入数';
          }
          return null;
        },
        valueGetter: (params: any) => {
          // その他行（rowIndex === 4）・出荷実販差行（rowIndex === 5）は直接入力セル
          if (params.node?.rowIndex === 4 || params.node?.rowIndex === 5) {
            return params.data.col6;
          }
          // 商流販売店計行（rowIndex === 0）の数式: 各行のcol6を合算
          if (params.data.col6_formula && params.node?.rowIndex === 0) {
            // 各子行(専用機/提携機/アライアンス品/その他/出荷実販差)の
            // col6(合計函数)は、各行の col6 valueGetter を単一の計算元と
            // して参照する（ここで K/J を再計算しない）
            let sum = 0;
            for (let i = 1; i <= 5; i++) {
              const rowNode = params.api.getDisplayedRowAtIndex(i);
              if (!rowNode) continue;
              const childCol6 = parseFloat(
                String(
                  params.api.getCellValue({
                    rowNode,
                    colKey: 'col6',
                  }) ?? '0'
                ).replace(/[,%]/g, '')
              );
              if (!isNaN(childCol6)) sum += childCol6;
            }
            return sum;
          }
          // 専用機/提携機/アライアンス品行（rowIndex 1-3）の数式:
          // =K/J (col10 / col9)。col10(合計本数)は col10 列の valueGetter
          // を単一の計算元として参照する（col11×col14 を再計算しない）
          if (
            params.data.col6_formula &&
            (params.node?.rowIndex ?? -1) >= 1 &&
            (params.node?.rowIndex ?? -1) <= 3
          ) {
            const col10 = parseFloat(
              String(params.getValue('col10') ?? '0').replace(/[,%]/g, '')
            );
            const num9 = parseFloat(
              String(params.data.col9 || '0').replace(/,/g, '')
            );
            if (!isNaN(col10) && !isNaN(num9) && num9 !== 0) {
              return col10 / num9;
            }
            return 0;
          }
          return params.data.col6;
        },
        valueFormatter: (params: any) => {
          if (
            params.data.col6_formula &&
            (params.node?.rowIndex === 0 ||
              params.node?.rowIndex === 1 ||
              params.node?.rowIndex === 2 ||
              params.node?.rowIndex === 3)
          ) {
            const value = params.value;
            if (typeof value === 'number') {
              return Math.round(value).toLocaleString();
            }
          }
          return params.value;
        },
        valueSetter: (params: any) => {
          const rowIndex = params.node?.rowIndex ?? -1;
          const newValue = params.newValue;
          // rows 4,5 は直接入力セル: 常にcol6に保存し数式は不要
          if (rowIndex === 4 || rowIndex === 5) {
            params.data.col6 = newValue;
            params.data.col6_formula = undefined;
            return true;
          }
          if (newValue && newValue.startsWith('=')) {
            params.data.col6_formula = newValue;
            return true;
          }
          params.data.col6 = newValue;
          return true;
        },
        cellStyle: (params: any) => getCellStyle(params),
        onCellValueChanged: (params: any) => {
          const newData = [...salesPlanDataRef.current];
          newData[params.node.rowIndex] = {
            ...params.data,
          };
          setSalesPlanData(newData);
          // 販売計画表と経費計画表の全ての数式セルを再計算
          recalculateAll();
        },
      },
      {
        headerName: '予算',
        children: [
          {
            headerName: '函数',
            field: 'col23',
            width: 64,
            hide: true, // 初期非表示（→ SALES_PLAN_INITIAL_HIDDEN_COLS）
            editable: false,
            cellStyle: (params: any) => getCellStyle(params),
          },
          {
            headerName: '予算比',
            field: 'col24',
            width: 56,
            hide: true, // 初期非表示（→ SALES_PLAN_INITIAL_HIDDEN_COLS）
            editable: false,
            tooltipValueGetter: (params: any) => {
              if (params.data.col24_formula) {
                const rowIndex = params.node?.rowIndex ?? -1;
                if (rowIndex >= 0 && rowIndex <= 5)
                  return '数式: 合計函数 ÷ 予算函数';
              }
              return null;
            },
            // 予算比 = 合計函数(col6) ÷ 予算函数(col23) × 100
            valueGetter: (params: any) => {
              const rowIndex = params.node?.rowIndex ?? -1;
              if (params.data.col24_formula && rowIndex >= 0 && rowIndex <= 5) {
                const col6 =
                  parseFloat(
                    String(params.getValue('col6') ?? '0').replace(/[,%]/g, '')
                  ) || 0;
                const col23 = parseFloat(
                  String(params.data.col23 ?? '0').replace(/[,%]/g, '')
                );
                if (!isNaN(col23) && col23 !== 0) {
                  return (col6 / col23) * 100;
                }
                return 0;
              }
              return params.data.col24;
            },
            valueFormatter: (params: any) => {
              const rowIndex = params.node?.rowIndex ?? -1;
              if (
                params.data.col24_formula &&
                rowIndex >= 0 &&
                rowIndex <= 5 &&
                typeof params.value === 'number'
              ) {
                return formatDecimal1(params.value) + '%';
              }
              return params.value;
            },
            cellStyle: (params: any) => getCellStyle(params),
          },
        ],
      },
      {
        headerName: '前年実績',
        children: [
          {
            headerName: '前年函数',
            field: 'col7',
            width: 64,
            hide: true, // 初期非表示（→ SALES_PLAN_INITIAL_HIDDEN_COLS）
            editable: (params: any) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col7'),
            valueGetter: (params: any) => {
              if (params.data.col7_formula && params.node?.rowIndex === 0) {
                let sum = 0;
                for (let i = 1; i <= 5; i++) {
                  const rowNode = params.api.getDisplayedRowAtIndex(i);
                  if (rowNode && rowNode.data.col7) {
                    const value = String(rowNode.data.col7).replace(/,/g, '');
                    const num = parseFloat(value);
                    if (!isNaN(num)) {
                      sum += num;
                    }
                  }
                }
                return sum.toLocaleString();
              }
              return params.data.col7;
            },
            valueSetter: (params: any) => {
              const newValue = params.newValue;
              if (newValue && newValue.startsWith('=')) {
                params.data.col7_formula = newValue;
                return true;
              }
              params.data.col7 = newValue;
              return true;
            },
            cellStyle: (params: any) => getCellStyle(params),
            onCellValueChanged: (params: any) => {
              const newData = [...salesPlanDataRef.current];
              newData[params.node.rowIndex] = params.data;
              setSalesPlanData(newData);
              if (gridRef.current?.api) {
                gridRef.current.api.refreshCells({
                  rowNodes: [gridRef.current.api.getDisplayedRowAtIndex(0)!],
                  force: true,
                });
              }
              // 専用機行・提携機行のcol7が変更された場合、各行のcol8を再計算
              if (
                (params.node?.rowIndex === 1 || params.node?.rowIndex === 2) &&
                gridRef.current?.api
              ) {
                gridRef.current.api.refreshCells({
                  rowNodes: [params.node],
                  force: true,
                });
              }
            },
          },
          {
            headerName: '前年比',
            field: 'col8',
            width: 56,
            editable: (params: any) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col8'),
            tooltipValueGetter: (params: any) => {
              if (params.data.col8_formula) {
                return '数式: 合計函数 ÷ 前年函数';
              }
              return null;
            },
            valueGetter: (params: any) => {
              // rowIndex 0-5 全対応: G/H
              if (
                params.data.col8_formula &&
                (params.node?.rowIndex === 0 ||
                  params.node?.rowIndex === 1 ||
                  params.node?.rowIndex === 2 ||
                  params.node?.rowIndex === 3 ||
                  params.node?.rowIndex === 4 ||
                  params.node?.rowIndex === 5)
              ) {
                // col6(合計函数)は col6 列の valueGetter を単一の計算元
                // として参照する（ここで再計算しない）
                const col6Value =
                  parseFloat(
                    String(params.getValue('col6') ?? '0').replace(/[,%]/g, '')
                  ) || 0;

                const col7Value = parseFloat(
                  String(params.data.col7 || '0').replace(/,/g, '')
                );
                if (!isNaN(col6Value) && !isNaN(col7Value) && col7Value !== 0) {
                  return (col6Value / col7Value) * 100;
                }
                return 0;
              }
              return params.data.col8;
            },
            valueFormatter: (params: any) => {
              if (
                params.data.col8_formula &&
                (params.node?.rowIndex === 0 ||
                  params.node?.rowIndex === 1 ||
                  params.node?.rowIndex === 2 ||
                  params.node?.rowIndex === 3 ||
                  params.node?.rowIndex === 4 ||
                  params.node?.rowIndex === 5)
              ) {
                const value = params.value;
                if (typeof value === 'number') {
                  return formatDecimal1(value) + '%';
                }
              }
              return params.value;
            },
            valueSetter: (params: any) => {
              const newValue = params.newValue;
              if (newValue && newValue.startsWith('=')) {
                params.data.col8_formula = newValue;
                return true;
              }
              params.data.col8 = newValue;
              return true;
            },
            cellStyle: (params: any) => getCellStyle(params),
            onCellValueChanged: (params: any) => {
              const newData = [...salesPlanDataRef.current];
              newData[params.node.rowIndex] = params.data;
              setSalesPlanData(newData);
              if (gridRef.current?.api) {
                gridRef.current.api.refreshCells({
                  rowNodes: [gridRef.current.api.getDisplayedRowAtIndex(0)!],
                  force: true,
                });
              }
            },
          },
        ],
      },
    ],
  },
  {
    headerName: '算出項目（計画）',
    children: [
      {
        headerName: '平均入数',
        field: 'col9',
        width: 64,
        hide: true, // 初期非表示（→ SALES_PLAN_INITIAL_HIDDEN_COLS）
        editable: (params: any) =>
          !params.node?.rowPinned &&
          isCellEditable(params.node?.rowIndex ?? -1, 'col9'),
        valueFormatter: (params: any) => {
          if (params.node?.rowPinned) return params.value;
          const v = params.value;
          if (v == null || v === '' || v === '－') return v;
          const num = parseFloat(String(v).replace(/,/g, ''));
          if (isNaN(num)) return v;
          return num.toFixed(1);
        },
        cellStyle: (params: any) => getCellStyle(params),
        onCellValueChanged: (params: any) => {
          const newData = salesPlanDataRef.current.map((row, idx) =>
            idx === params.node.rowIndex ? { ...row, ...params.data } : row
          );
          setSalesPlanData(newData);
          // 専用機行のcol9が変更された場合、専用機行のcol6を再計算
          if (params.node?.rowIndex === 1 && gridRef.current?.api) {
            gridRef.current.api.refreshCells({
              rowNodes: [params.node],
              force: true,
            });
          }
          // 提携機行のcol9が変更された場合、提携機行のcol6を再計算
          if (params.node?.rowIndex === 2 && gridRef.current?.api) {
            gridRef.current.api.refreshCells({
              rowNodes: [params.node],
              force: true,
            });
          }
        },
      },
      {
        headerName: '合計本数',
        field: 'col10',
        width: 64,
        hide: true, // 初期非表示（→ SALES_PLAN_INITIAL_HIDDEN_COLS）
        editable: (params: any) =>
          !params.node?.rowPinned &&
          isCellEditable(params.node?.rowIndex ?? -1, 'col10'),
        tooltipValueGetter: (params: any) => {
          if (params.data.col10_formula) {
            const rowIndex = params.node?.rowIndex ?? -1;
            if (rowIndex >= 1 && rowIndex <= 3)
              return '数式: 専用機PM/提携機PC × 稼働台数（コラム）';
          }
          return null;
        },
        valueGetter: (params: any) => {
          // 商流販売店計行（rowIndex === 0）の数式: 各行のcol10を合算
          if (params.data.col10_formula && params.node?.rowIndex === 0) {
            // 各子行の col10 は、各行の col10 valueGetter を単一の計算
            // 元として参照する（ここで col11×col14 等を再計算しない）
            let sum = 0;
            for (let i = 1; i <= 5; i++) {
              const rowNode = params.api.getDisplayedRowAtIndex(i);
              if (!rowNode) continue;
              const childCol10 = parseFloat(
                String(
                  params.api.getCellValue({
                    rowNode,
                    colKey: 'col10',
                  }) ?? '0'
                ).replace(/[,%]/g, '')
              );
              if (!isNaN(childCol10)) sum += childCol10;
            }
            return sum;
          }
          // 専用機/提携機/アライアンス品行（rowIndex 1-3）の数式:
          // =L*O (col11 × col14)。col11・col14 とも各列の valueGetter を
          // 単一の計算元として参照する（col16 等を再計算しない）
          if (
            params.data.col10_formula &&
            (params.node?.rowIndex ?? -1) >= 1 &&
            (params.node?.rowIndex ?? -1) <= 3
          ) {
            const col11 =
              parseFloat(
                String(params.getValue('col11') ?? '0').replace(/[,%]/g, '')
              ) || 0;
            const col14 =
              parseFloat(
                String(params.getValue('col14') ?? '0').replace(/[,%]/g, '')
              ) || 0;
            return round(col11 * col14, 0);
          }
          // 出荷実販差行（rowIndex === 5）の数式: =G7*J2 → col6(rowIndex5) * col9(rowIndex0)
          if (params.data.col10_formula && params.node?.rowIndex === 5) {
            const col6Value = String(params.data.col6 || '0').replace(/,/g, '');
            const num1 = parseFloat(col6Value);
            const row0 = params.api.getDisplayedRowAtIndex(0);
            const col9Row0Value = row0
              ? String(row0.data.col9 || '0').replace(/,/g, '')
              : '0';
            const num2 = parseFloat(col9Row0Value);
            if (!isNaN(num1) && !isNaN(num2)) {
              const result = round(num1 * num2, 0);

              return result;
            }
            return 0;
          }
          return params.data.col10;
        },
        valueFormatter: (params: any) => {
          if (typeof params.value === 'number') {
            return params.value.toLocaleString();
          }
          return params.value;
        },
        valueSetter: (params: any) => {
          const newValue = params.newValue;
          if (newValue && newValue.startsWith('=')) {
            params.data.col10_formula = newValue;
            return true;
          }
          params.data.col10 = newValue;
          return true;
        },
        cellStyle: (params: any) => getCellStyle(params),
        onCellValueChanged: (params: any) => {
          const newData = salesPlanDataRef.current.map((row, idx) =>
            idx === params.node.rowIndex ? { ...row, ...params.data } : row
          );
          setSalesPlanData(newData);
          if (gridRef.current?.api) {
            gridRef.current.api.refreshCells({
              rowNodes: [gridRef.current.api.getDisplayedRowAtIndex(0)!],
              force: true,
            });
          }
          // 専用機行のcol10が変更された場合、専用機行のcol6とcol10を再計算
          if (params.node?.rowIndex === 1) {
            gridRef.current?.api.refreshCells({
              rowNodes: [params.node],
              force: true,
            });
          }
          // 提携機行のcol10が変更された場合、提携機行のcol6を再計算
          if (params.node?.rowIndex === 2) {
            gridRef.current?.api.refreshCells({
              rowNodes: [params.node],
              force: true,
            });
          }
        },
      },
      // 専用機PM/提携機PC と PM/PC商談見込 は、第二階層「専用機PM/提携機PC」の配下へ置く。
      {
        headerName: '専用機PM/提携機PC',
        children: [
          {
            headerName: '専用機PM/提携機PC',
            field: 'col11',
            width: 88,
            editable: (params: any) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col11'),
            tooltipValueGetter: (params: any) => {
              if (params.data.col11_formula) {
                const rowIndex = params.node?.rowIndex ?? -1;
                if (rowIndex === 1)
                  return '数式: 前年PM × 出荷稼働日前年比 × 直近変動率 × PM商談見込';
                if (rowIndex === 2)
                  return '数式: 前年PC × 出荷稼働日前年比 × 直近変動率 × PC商談見込';
                if (rowIndex === 3)
                  return '数式: 前年PM × 出荷稼働日前年比 × 直近変動率';
              }
              return null;
            },
            valueGetter: (params: any) => {
              const rowIndex = params.node?.rowIndex ?? -1;

              // セルに設定された数式（専用機 =Z3*N3*M3*Q2／提携機 =Z4*N4*M4*Q2／
              // アライアンス品 =Z5*N5*Q2 等）をそのまま解釈して計算する。
              // 値はフル精度で返し、表示の小数1桁は valueFormatter で行う
              // （col10 等が col11 を参照しても誤差が出ないようにするため）。
              if (params.data.col11_formula && rowIndex >= 1) {
                const value = evalSalesMultiplyFormula(
                  params.data.col11_formula,
                  params.api
                );
                return value ?? 0;
              }

              return params.data.col11 || 0;
            },
            valueFormatter: (params: any) => {
              const rowIndex = params.node?.rowIndex ?? -1;
              // 数式セルは小数点1桁で表示
              if (
                params.data.col11_formula &&
                (rowIndex === 1 || rowIndex === 2 || rowIndex === 3)
              ) {
                if (typeof params.value === 'number') {
                  return params.value.toLocaleString(undefined, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  });
                }
              }
              return params.value;
            },
            valueSetter: (params: any) => {
              const newValue = params.newValue;
              if (newValue && newValue.startsWith('=')) {
                params.data.col11_formula = newValue;
                return true;
              }
              params.data.col11 = newValue;
              return true;
            },
            cellStyle: (params: any) => getCellStyle(params),
            onCellValueChanged: (params: any) => {
              const newData = salesPlanDataRef.current.map((row, idx) =>
                idx === params.node.rowIndex ? { ...row, ...params.data } : row
              );
              setSalesPlanData(newData);
              if (gridRef.current?.api) {
                gridRef.current.api.refreshCells({
                  rowNodes: [gridRef.current.api.getDisplayedRowAtIndex(1)!],
                  force: true,
                });
                // 提携機行のcol11も再計算
                gridRef.current.api.refreshCells({
                  rowNodes: [gridRef.current.api.getDisplayedRowAtIndex(2)!],
                  force: true,
                });
              }
            },
          },
          {
            // 前年同月の専用機PM/提携機PC。計画値の比較対象として並べる参照表示の列。
            // 編集可否は isCellEditable が一元管理しており、当列は対象外＝入力不可。
            headerName: '前年PM/PC',
            field: 'col25',
            width: 80,
            // col11 と同じ小数第1位まで表示。"－"・空は素通し。
            valueFormatter: (params: any) => {
              const v = params.value;
              if (v == null || v === '' || v === '－') return v ?? '';
              const num = parseFloat(String(v).replace(/,/g, ''));
              if (isNaN(num)) return v;
              return formatDecimal1(num);
            },
            cellStyle: (params: any) => getCellStyle(params),
          },
          {
            headerName: 'PM/PC商談見込',
            field: 'col12',
            width: 80,
            editable: (params: any) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col12'),
            // 比率(%)を小数第1位まで表示（小数第2位を四捨五入）。"－"・空は素通し
            valueFormatter: (params: any) => {
              const v = params.value;
              if (v == null || v === '' || v === '－') return v ?? '';
              const num = parseFloat(String(v).replace(/[%,]/g, ''));
              if (isNaN(num)) return v;
              return formatDecimal1(num) + '%';
            },
            cellStyle: (params: any) => getCellStyle(params),
            onCellValueChanged: (params: any) => {
              const newData = salesPlanDataRef.current.map((row, idx) =>
                idx === params.node.rowIndex ? { ...row, ...params.data } : row
              );
              setSalesPlanData(newData);
              // 販売計画表と経費計画表の全ての数式セルを再計算
              recalculateAll();
            },
          },
        ],
      },
      {
        headerName: '直近変動率',
        field: 'col13',
        width: 72,
        editable: (params: any) =>
          !params.node?.rowPinned &&
          isCellEditable(params.node?.rowIndex ?? -1, 'col13'),
        // 比率(%)を小数第1位まで表示（小数第2位を四捨五入）。"－"・空は素通し
        valueFormatter: (params: any) => {
          const v = params.value;
          if (v == null || v === '' || v === '－') return v ?? '';
          const num = parseFloat(String(v).replace(/[%,]/g, ''));
          if (isNaN(num)) return v;
          return formatDecimal1(num) + '%';
        },
        cellStyle: (params: any) => getCellStyle(params),
        onCellValueChanged: (params: any) => {
          const newData = salesPlanDataRef.current.map((row, idx) =>
            idx === params.node.rowIndex ? { ...row, ...params.data } : row
          );
          setSalesPlanData(newData);
          // 専用機行のcol13が変更された場合、専用機行のcol11を再計算
          if (params.node?.rowIndex === 1 && gridRef.current?.api) {
            gridRef.current.api.refreshCells({
              rowNodes: [params.node],
              force: true,
            });
          }
          // 提携機行のcol13が変更された場合、提携機行のcol11を再計算
          if (params.node?.rowIndex === 2 && gridRef.current?.api) {
            gridRef.current.api.refreshCells({
              rowNodes: [params.node],
              force: true,
            });
          }
        },
      },
      // 稼働台数(コラム) と 台/コラム商談見込 は、第二階層「稼働台数(コラム)」の配下へ置く。
      {
        headerName: '稼働台数（コラム）',
        children: [
          {
            headerName: '稼働台数（コラム）',
            field: 'col14',
            width: 80,
            editable: (params: any) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col14'),
            tooltipValueGetter: (params: any) => {
              if (params.data.col14_formula) {
                const rowIndex = params.node?.rowIndex ?? -1;
                if (rowIndex === 1) return '数式: 前月末台数 + 商談見込台数';
                if (rowIndex === 2)
                  return '数式: 直近コラム数 + 商談見込コラム数';
              }
              return null;
            },
            valueGetter: (params: any) => {
              // 専用機行（rowIndex === 1）の数式: =AA3+P3
              // 直近台数は 直近台数(コラム) 列（col26＝AA列）のセル値を使う。
              if (params.data.col14_formula && params.node?.rowIndex === 1) {
                const col26Num = parseFloat(
                  String(params.data.col26 ?? '').replace(/,/g, '')
                );
                const col15Value = String(params.data.col15 || '0')
                  .replace(/[%,+]/g, '')
                  .replace(/▲/g, '-');
                const num = parseFloat(col15Value);
                if (!isNaN(col26Num) && !isNaN(num)) {
                  const result = round(col26Num + num, 0);

                  return result;
                }

                return 0;
              }
              // 提携機行（rowIndex === 2）の数式: =AA4+P4
              // 直近台数は 直近台数(コラム) 列（col26＝AA列）のセル値を使う。
              if (params.data.col14_formula && params.node?.rowIndex === 2) {
                const col26Num = parseFloat(
                  String(params.data.col26 ?? '').replace(/,/g, '')
                );
                const col15Value = String(params.data.col15 || '0')
                  .replace(/[%,+]/g, '')
                  .replace(/▲/g, '-');
                const num = parseFloat(col15Value);
                if (!isNaN(col26Num) && !isNaN(num)) {
                  const result = round(col26Num + num, 0);

                  return result;
                }

                return 0;
              }

              return params.data.col14;
            },
            valueFormatter: (params: any) => {
              const rowIndex = params.node?.rowIndex ?? -1;
              if (
                params.data.col14_formula &&
                (rowIndex === 1 || rowIndex === 2)
              ) {
                if (typeof params.value === 'number') {
                  return params.value.toLocaleString();
                }
              }
              return params.value;
            },
            valueSetter: (params: any) => {
              const newValue = params.newValue;
              if (newValue && newValue.startsWith('=')) {
                params.data.col14_formula = newValue;
                return true;
              }
              params.data.col14 = newValue;
              return true;
            },
            cellStyle: (params: any) => getCellStyle(params),
            onCellValueChanged: (params: any) => {
              const newData = salesPlanDataRef.current.map((row, idx) =>
                idx === params.node.rowIndex ? { ...row, ...params.data } : row
              );
              setSalesPlanData(newData);
              if (gridRef.current?.api) {
                gridRef.current.api.refreshCells({
                  rowNodes: [gridRef.current.api.getDisplayedRowAtIndex(1)!],
                  force: true,
                });
                // 提携機行のcol14も再計算
                gridRef.current.api.refreshCells({
                  rowNodes: [gridRef.current.api.getDisplayedRowAtIndex(2)!],
                  force: true,
                });
              }
            },
          },
          {
            // 稼働台数(コラム) の算出元になる直近の台数（コラム数）。
            // 稼働台数(コラム) ＝ 直近台数(コラム) ＋ 台/コラム商談見込 の関係で並べる。
            // 編集可否は isCellEditable が一元管理しており、当列は対象外＝入力不可。
            headerName: '直近台数（コラム）',
            field: 'col26',
            width: 96,
            // 台数（コラム数）は整数で3桁区切り表示。"－"・空は素通し。
            valueFormatter: (params: any) => {
              const v = params.value;
              if (v == null || v === '' || v === '－') return v ?? '';
              const num = parseFloat(String(v).replace(/,/g, ''));
              if (isNaN(num)) return v;
              return Math.round(num).toLocaleString();
            },
            cellStyle: (params: any) => getCellStyle(params),
          },
          {
            headerName: '台/コラム商談見込',
            field: 'col15',
            width: 96,
            editable: (params: any) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col15'),
            cellStyle: (params: any) => getCellStyle(params),
            valueFormatter: (params: any) => {
              const val = params.value;
              if (
                val === null ||
                val === undefined ||
                val === '－' ||
                val === ''
              )
                return val ?? '';
              const numStr = String(val)
                .replace(/[+,]/g, '')
                .replace(/▲/g, '-');
              const num = parseFloat(numStr);
              if (isNaN(num)) return String(val);
              if (num > 0) return `+${num.toLocaleString()}`;
              if (num < 0) return `▲${Math.abs(num).toLocaleString()}`;
              return '0';
            },
            valueSetter: (params: any) => {
              const raw = String(params.newValue ?? '').trim();
              if (raw.startsWith('▲')) {
                const num = parseFloat(raw.slice(1).replace(/[,+]/g, ''));
                params.data.col15 = isNaN(num) ? '0' : String(-num);
              } else if (raw.startsWith('+')) {
                const num = parseFloat(raw.slice(1).replace(/,/g, ''));
                params.data.col15 = isNaN(num) ? '0' : String(num);
              } else {
                const num = parseFloat(raw.replace(/,/g, ''));
                params.data.col15 = isNaN(num) ? raw : String(num);
              }
              return true;
            },
            onCellValueChanged: (params: any) => {
              const newData = salesPlanDataRef.current.map((row, idx) =>
                idx === params.node.rowIndex ? { ...row, ...params.data } : row
              );
              setSalesPlanData(newData);
              // 販売計画表と経費計画表の全ての数式セルを再計算
              recalculateAll();
            },
          },
        ],
      },
      {
        // 函単価グループは単価1列のみのため、第2・第3階層を結合した
        // 単一リーフ列（函単価）として表示する
        headerName: '函単価',
        field: 'col18',
        width: 64,
        editable: (params: any) =>
          !params.node?.rowPinned &&
          isCellEditable(params.node?.rowIndex ?? -1, 'col18'),
        // 専用機/提携機/アライアンス品/その他(手売り)/出荷実販差 行
        // （rowIndex 1〜5）の単価は「函単価(数式内の基準額) ×
        // 商流販売店計の価格改定率(row0 col19)」を計算して表示する。
        // 手入力で数式が消えている場合は入力値を表示。
        valueGetter: (params: any) => {
          const rowIndex = params.node?.rowIndex ?? -1;
          if (params.data.col18_formula && rowIndex >= 1 && rowIndex <= 5) {
            // 単価 = 基準函単価 × 商流販売店計(row0)の価格改定率
            const row0 = params.api?.getDisplayedRowAtIndex(0);
            return computeSalesCol18(params.data, row0?.data);
          }
          return params.data.col18;
        },
        valueFormatter: (params: any) => {
          const v = params.value;
          if (v === null || v === undefined || v === '') return v ?? '';
          const num = parseFloat(String(v).replace(/,/g, ''));
          return isNaN(num) ? String(v) : num.toLocaleString();
        },
        valueSetter: (params: any) => {
          // 手入力時は数式を一時クリアして入力値を保持
          // （経費計画表のロケ運転費の計画金額(rowIndex 7)と同じ挙動）
          params.data.col18 = params.newValue;
          params.data.col18_formula = null;
          return true;
        },
        cellStyle: (params: any) => getCellStyle(params),
        onCellValueChanged: (params: any) => {
          const newData = [...salesPlanDataRef.current];
          newData[params.node.rowIndex] = params.data;
          setSalesPlanData(newData);
          // 全ての数式セルを再計算
          recalculateSalesPlan();
        },
      },
      {
        // ヘッダーは headerName の \n の位置で2段に改行する。
        // 折り返しと高さ調整は AG Grid 公式の wrapHeaderText / autoHeaderHeight で行う
        // （見出しの高さは共通テーマの1行分のため、autoHeaderHeight が無いと見切れる）。
        // \n を改行として描画させる white-space の指定は下の <style> 側。
        // 幅は最長行（1段目＝13文字）が収まる値にする。狭いと pre-line でも
        // 折り返しが入り、指定した位置以外でも改行されてしまうため。
        headerName: 'アライアンス品契約状況変動\nに伴う追加売上金額',
        field: 'col20',
        wrapHeaderText: true,
        autoHeaderHeight: true,
        width: 168,
        hide: true, // 初期非表示（→ SALES_PLAN_INITIAL_HIDDEN_COLS）
        editable: (params: any) =>
          !params.node?.rowPinned &&
          isCellEditable(params.node?.rowIndex ?? -1, 'col20'),
        cellStyle: (params: any) => getCellStyle(params),
        onCellValueChanged: (params: any) => {
          const newData = salesPlanDataRef.current.map((row, idx) =>
            idx === params.node.rowIndex ? { ...row, ...params.data } : row
          );
          setSalesPlanData(newData);
        },
      },
    ],
  },
];
