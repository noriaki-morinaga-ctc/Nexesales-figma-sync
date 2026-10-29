import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../ui/collapsible';
import { ChevronDown, Save, Send, Check, X, CornerUpLeft } from 'lucide-react';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Input } from '../../ui/input';
import { TEXT_INPUT_CLASS } from '../../../../styles/commonStyles';
import { Label } from '../../ui/label';
import { RequiredBadge } from '../../ui/required-badge';
import { BottomPane } from '../../ui/bottom-pane';
import { useState, useMemo, useRef, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ColGroupDef, GetRowIdParams } from 'ag-grid-community';
import {
  GRID_DEFAULT_COL_DEF,
  GRID_BASE_PROPS,
  GRID_NO_FILTER_COLUMN_TYPES,
  GRID_EMPTY_TEXT,
} from '../../grid';
import { ScreenTitle } from '../../ui/screen-title';

// AG Gridヘッダー用：必須列はヘッダー名の後ろに赤いアスタリスクを表示する。
// 全ヘッダーで書式を統一する（中央寄せ・折り返し表示で文字が見切れないようにする）。
const RequiredHeader = (props: { displayName: string; required?: boolean }) => (
  <span className="flex w-full items-center justify-center gap-0.5 whitespace-normal break-words py-1.5 text-center leading-tight font-bold">
    {props.displayName}
    {props.required && <span className="text-red-500">＊</span>}
  </span>
);

// 行ID（AG Grid 公式 getRowId）。ロケ契約料一覧・借方／貸方 明細の各行が持つ id を使う
// （表示項目はいずれも編集可で行の識別に使えないため、行データ側で id を振る）。
// モジュール直下に置いて参照を固定する（→ 02 §7.1）。
const getRecordRowId = (
  params: GetRowIdParams<Record<string, string>>
): string => params.data.id;

// AG Grid valueFormatter：金額をカンマ区切り（桁区切り）で表示する（空欄は「-」）。
const formatAmountCell = (params: { value?: unknown }): string => {
  const v = params.value;
  if (v === null || v === undefined || v === '') return GRID_EMPTY_TEXT;
  const num = Number(String(v).replace(/,/g, ''));
  return Number.isNaN(num) ? String(v) : num.toLocaleString();
};

// AG Grid valueFormatter：日付を yyyy/MM/dd 形式にゼロ埋めして表示する（空欄は「-」、不正値はそのまま）。
const formatDateCell = (params: { value?: unknown }): string => {
  const v = params.value;
  if (v === null || v === undefined || v === '') return GRID_EMPTY_TEXT;
  const parts = String(v).split('/');
  if (parts.length !== 3) return String(v);
  const [y, m, d] = parts;
  return `${y}/${m.padStart(2, '0')}/${d.padStart(2, '0')}`;
};

// 借方・貸方 明細テーブルの列メタ情報（表の列定義と明細追加ペインの入力欄で共通利用）。
// required:true の項目は必須（ヘッダーの＊・入力欄の必須バッジ）。
// numeric:true の項目は表で右寄せ＋カンマ区切り、date:true の項目は右寄せ＋yyyy/MM/dd 表示。
const JOURNAL_COLUMNS: {
  field: string;
  headerName: string;
  required?: boolean;
  numeric?: boolean;
  date?: boolean;
}[] = [
  { field: 'accountItem', headerName: '勘定科目', required: true },
  { field: 'department', headerName: '部署', required: true },
  { field: 'managementCategory', headerName: '管理区分', required: true },
  { field: 'managementCode', headerName: '管理コード', required: true },
  { field: 'amount', headerName: '金額', required: true, numeric: true },
  { field: 'taxCategory', headerName: '税区分', required: true },
  { field: 'note1', headerName: '摘要1', required: true },
  { field: 'application2', headerName: '適用2' },
  { field: 'billTo', headerName: '請求先', required: true },
  { field: 'kanaName', headerName: 'カナ名称' },
  { field: 'postalCode', headerName: '郵便番号' },
  { field: 'address1', headerName: '住所1' },
  { field: 'address2', headerName: '住所2' },
  { field: 'address3', headerName: '住所3' },
  {
    field: 'invoiceIssuanceCategory',
    headerName: '請求書発行区分',
    required: true,
  },
  { field: 'invoiceIssueDate', headerName: '請求書発行日付', date: true },
  { field: 'billingContent', headerName: '請求内容', required: true },
  { field: 'collectionMethod', headerName: '回収方法', required: true },
  {
    field: 'collectionScheduledDate',
    headerName: '回収予定日',
    required: true,
    date: true,
  },
  { field: 'ledgerManagementNumber', headerName: '台帳管理番号' },
  { field: 'occurrenceCause', headerName: '発生原因' },
  { field: 'sortKey', headerName: 'ソートキー' },
  { field: 'quantity', headerName: '数量', numeric: true },
  { field: 'unitPrice', headerName: '単価', numeric: true },
  { field: 'unit', headerName: '単位' },
];

export default function UnamortizedProjectBillingList() {
  const [isOpen, setIsOpen] = useState(true);
  // フッターのコメント入力値（自販機販売計画表のフッターに準拠）
  const [commentInput, setCommentInput] = useState('');
  const [isSummaryOpen, setIsSummaryOpen] = useState(true);
  const [isSalesPlanOpen, setIsSalesPlanOpen] = useState(true);
  const [isExpensePlanOpen, setIsExpensePlanOpen] = useState(true);
  const [clickedCell, setClickedCell] = useState<{
    rowIndex: number;
    field: string;
  } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const [highlightedCells, setHighlightedCells] = useState<{
    references: string[]; // このセルが参照するセル
    affects: string[]; // このセルが影響を与えるセル
  }>({ references: [], affects: [] });

  const gridApiRef = useRef<any>(null);

  // グリッド準備完了時のハンドラー
  const onGridReady = (params: any) => {
    gridApiRef.current = params.api;
  };

  // データ初回描画後に列幅を自動調整するハンドラー
  const onFirstDataRendered = (params: any) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        params.api.autoSizeAllColumns();
      });
    });
  };

  // ツールチップを閉じるためのグローバルクリックハンドラー（無効化）
  // useEffect(() => {
  //   const handleClickOutside = (event: MouseEvent) => {
  //     const target = event.target as HTMLElement;
  //     // AG Gridのセル以外をクリックした場合、ツールチップと強調表示をクリア
  //     if (!target.closest('.ag-cell')) {
  //       setTooltipPosition(null);
  //       setClickedCell(null);
  //       setHighlightedCells({ references: [], affects: [] });
  //     }
  //   };

  //   document.addEventListener('click', handleClickOutside);
  //   return () => {
  //     document.removeEventListener('click', handleClickOutside);
  //   };
  // }, []);

  // セル依存関係マップ（各セルが参照するセルと影響を与えるセル）
  const cellDependencies: {
    [key: string]: {
      references: string[]; // このセルが参照するセル
      affects: string[]; // このセルが影響を与えるセル
    };
  } = {
    // 商流販売店計行（rowIndex === 0）
    '0-col0': { references: ['0-col20', '0-col29', '0-col30'], affects: [] },
    '0-col20': {
      references: [],
      affects: [
        '0-col0',
        '0-col21',
        '0-col28',
        '0-col32',
        '1-col20',
        '2-col20',
      ],
    },
    '0-col21': { references: ['0-col20'], affects: [] },
    '0-col22': { references: ['0-col20'], affects: [] },
    '0-col23': {
      references: [],
      affects: ['0-col24', '0-col28', '1-col23', '2-col23'],
    },
    '0-col24': {
      references: ['0-col25', '0-col23'],
      affects: ['1-col24', '5-col24'],
    },
    '0-col25': { references: [], affects: ['0-col24'] },
    '0-col28': { references: ['0-col20', '0-col23'], affects: ['1-col28'] },
    '0-col29': { references: [], affects: ['0-col0'] },
    '0-col30': { references: [], affects: ['0-col0'] },
    '0-col31': { references: [], affects: ['0-col32'] },
    '0-col32': { references: ['0-col20', '0-col31'], affects: [] },

    // 実販行（rowIndex === 1）
    '1-col20': { references: ['1-col23', '1-col28'], affects: ['2-col20'] },
    '1-col23': {
      references: ['0-col23', '7-col23', '5-col23'],
      affects: ['1-col25', '2-col23'],
    },
    '1-col24': { references: ['0-col24'], affects: ['1-col25'] },
    '1-col25': { references: ['1-col23', '1-col24'], affects: ['2-col25'] },
    '1-col28': { references: ['0-col28'], affects: ['1-col20'] },

    // 専用機行（rowIndex === 2）
    '2-col20': {
      references: ['1-col20', '3-col20', '7-col20'],
      affects: ['2-col28'],
    },
    '2-col21': { references: ['2-col20'], affects: [] },
    '2-col22': { references: ['2-col20'], affects: [] },
    '2-col23': {
      references: ['1-col23', '3-col23', '7-col23'],
      affects: ['2-col24', '2-col28'],
    },
    '2-col24': { references: ['2-col25', '2-col23'], affects: [] },
    '2-col25': {
      references: ['1-col25', '3-col25', '7-col25'],
      affects: ['2-col24', '2-col26'],
    },
    '2-col26': { references: ['2-col25', '2-col27'], affects: [] },
    '2-col27': { references: [], affects: ['2-col26'] },
    '2-col28': { references: ['2-col20', '2-col23'], affects: [] },

    // 提携機行（rowIndex === 3）
    '3-col20': { references: ['3-col23', '3-col28'], affects: ['2-col20'] },
    '3-col21': { references: ['3-col20'], affects: [] },
    '3-col22': { references: ['3-col20'], affects: [] },
    '3-col23': {
      references: ['3-col25', '3-col24'],
      affects: ['3-col20', '2-col23'],
    },
    '3-col24': { references: [], affects: ['3-col23'] },
    '3-col25': { references: [], affects: ['3-col23', '3-col26', '2-col25'] },
    '3-col26': { references: ['3-col25', '3-col27'], affects: [] },
    '3-col27': { references: [], affects: ['3-col26'] },
    '3-col28': { references: [], affects: ['3-col20'] },

    // その他（手売り）行（rowIndex === 4）
    '4-col20': { references: ['4-col23', '4-col28'], affects: [] },
    '4-col23': { references: [], affects: ['4-col20'] },
    '4-col28': { references: [], affects: ['4-col20'] },

    // 出荷実販差行（rowIndex === 5）
    '5-col23': { references: [], affects: ['5-col25', '1-col23'] },
    '5-col24': { references: ['0-col24'], affects: ['5-col25'] },
    '5-col25': { references: ['5-col23', '5-col24'], affects: [] },

    // アライアンス品行（rowIndex === 7）
    '7-col20': { references: ['7-col23', '7-col28'], affects: ['2-col20'] },
    '7-col23': { references: [], affects: ['7-col20', '1-col23', '2-col23'] },
    '7-col25': { references: [], affects: ['2-col25'] },
    '7-col28': { references: [], affects: ['7-col20'] },
  };

  // ツールチップマップ（行インデックス、列フィールド）
  const tooltipMap: { [key: string]: string } = {
    '0-col0': '当月実績額－条件口_金額',
    '0-col21': '当月実績額÷対象年度月の当月計画',
    '0-col22': '当月実績額÷前年度同月の当月実績額',
    '0-col24': '本数÷函数',
    '0-col28': '当月実績額÷函数　※小数点以下を四捨五入',
    '0-col29': '商流販売店別の条件口自動払額の合計＋値差補填',
    '0-col32': '当月実績額÷原価_金額　※小数点以下を四捨五入',
    '1-col20': '函数×函単価',
    '1-col23': '函数(商流販売店計)－函数(アライアンス品)＋函数(出荷実販差)',
    '1-col24': '入数(商流販売店計)',
    '1-col25': '函数(No.5)×入数(No.6)',
    '1-col28': '函単価(販売流通店計)',
    '2-col20':
      '実販の当月実績額－提携機の当月実績額－アライアンス品の当月実績額',
    '2-col21': '当月実績額÷対象年度月の専用機の当月計画',
    '2-col22':
      '当月実績額÷前年度同月の専用機の当月実績額　※小数点以下を四捨五入',
    '2-col23': '実販の函数－提携機の函数－アライアンス品の函数',
    '2-col24': '本数÷函数',
    '2-col25': '実販の本数－提携機の本数－アライアンス品の本数',
    '2-col26': '本数÷稼働台数(コラム)',
    '2-col28': '当月実績額÷函数',
    '3-col20': '函数×函単価',
    '3-col21': '当月実績額÷対象年度月の提携機の当月計画　※小数点以下を四捨五入',
    '3-col22':
      '当月実績額÷前年度同月の提携機の当月実績額　※小数点以下を四捨五入',
    '3-col23': '本数÷入数　※小数点以下を四捨五入',
    '3-col26': '本数÷稼働台数(コラム)',
    '4-col20': '函数×函単価',
    '5-col24': '入数(商流販売店計)',
    '5-col25': '函数×入数',
    '7-col23': 'アライアンス品のオペ函数合計×(オペ函数合計÷商流販売店函数合計)',
    '7-col20': '函数×函単価',
    '7-col27': 'アライアンス品のオペ台数合計×(オペ函数合計÷商流販売店函数合計)',
  };

  // ツールチップ取得関数（現在は使用していないが、参照用に保持）
  const getTooltip = (params: any) => {
    const rowIndex = params.node?.rowIndex ?? -1;
    const field = params.colDef?.field;
    const key = `${rowIndex}-${field}`;
    return tooltipMap[key] || '';
  };

  // セルクリックハンドラー
  const handleCellClick = (params: any) => {
    // セルクリック時のツールチップと強調表示機能を無効化
    // 数式の計算機能は維持されます
    return;

    // 以下、無効化されたコード
    // const rowIndex = params.node?.rowIndex ?? -1;
    // const field = params.colDef?.field;
    // const key = `${rowIndex}-${field}`;
    // const tooltipText = tooltipMap[key] || "";

    // console.log(`handleCellClick called: rowIndex=${rowIndex}, field=${field}`);

    // // 同じセルをクリックした場合は強調表示をクリア
    // if (clickedCell?.rowIndex === rowIndex && clickedCell?.field === field) {
    //   setClickedCell(null);
    //   setTooltipPosition(null);
    //   setHighlightedCells({ references: [], affects: [] });
    //   return;
    // }

    // setClickedCell({ rowIndex, field });

    // // 依存関係に基づいて強調表示するセルを設定
    // const dependencies = cellDependencies[key];
    // if (dependencies) {
    //   setHighlightedCells({
    //     references: dependencies.references,
    //     affects: dependencies.affects,
    //   });
    //   console.log(`Cell ${key} references:`, dependencies.references);
    //   console.log(`Cell ${key} affects:`, dependencies.affects);
    // } else {
    //   setHighlightedCells({ references: [], affects: [] });
    // }

    // // ツールチップを表示
    // if (tooltipText) {
    //   const rect = params.event.target.getBoundingClientRect();
    //   setTooltipPosition({
    //     x: rect.left + rect.width / 2,
    //     y: rect.top - 10,
    //     text: tooltipText,
    //   });
    // } else {
    //   setTooltipPosition(null);
    // }
  };

  // 数値をパースする関数（カンマ区切りを除去）
  const parseNumber = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/,/g, '').replace(/％/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  // 数値をフォーマットする関数
  const formatNumber = (value: number): string => {
    return Math.round(value).toLocaleString();
  };

  // セル変更時の自動計算関数
  const handleCellChange = (params: any) => {
    const newData = [...salesPlanData];
    const rowIndex = params.node.rowIndex;
    const field = params.colDef.field;
    const newValue = params.newValue;

    // 新しい値を反映
    newData[rowIndex] = { ...params.data };

    console.log(
      `handleCellChange - Row ${rowIndex}, Field ${field} changed to: ${newValue}`
    );

    // 商流販売店計行（rowIndex === 0）の計算
    const recalcRow0 = () => {
      const col20 = parseNumber(newData[0].col20);
      const col29 = parseNumber(newData[0].col29);
      const col23 = parseNumber(newData[0].col23);
      const col25 = parseNumber(newData[0].col25);
      const col30 = parseNumber(newData[0].col30);
      const col31 = parseNumber(newData[0].col31);

      console.log('recalcRow0 - Input values:', {
        col20,
        col29,
        col23,
        col25,
        col30,
        col31,
      });

      // 売上高 = 当月実績額 - 条件口_金額
      newData[0].col0 = formatNumber(col20 - (col29 + col30));
      // 入数 = 本数 ÷ 函数
      if (col23 !== 0) {
        newData[0].col24 = formatNumber(Math.round(col25 / col23));
      }
      // 函単価 = 当月実績額 ÷ 函数
      if (col23 !== 0) {
        newData[0].col28 = formatNumber(Math.round(col20 / col23));
      }
      // 条件口 = 条件口_金額 + 値差補填（自動計算済み）
      // 原価率 = 当月実績額 ÷ 原価_金額
      if (col31 !== 0) {
        newData[0].col32 = Math.round(col20 / col31) + '%';
      }

      console.log('recalcRow0 - Output values:', {
        col0: newData[0].col0,
        col24: newData[0].col24,
        col28: newData[0].col28,
        col32: newData[0].col32,
      });
    };

    // 実販行（rowIndex === 1）の計算
    const recalcRow1 = () => {
      const col23_0 = parseNumber(newData[0].col23);
      const col23_7 = parseNumber(newData[7].col23);
      const col23_5 = parseNumber(newData[5].col23);
      const col24_0 = parseNumber(newData[0].col24);
      const col28_0 = parseNumber(newData[0].col28);

      // 函数 = 函数(商流販売店計) - 函数(アライアンス品) + 函数(出荷実販差)
      newData[1].col23 = formatNumber(col23_0 - col23_7 + col23_5);
      const col23_1 = parseNumber(newData[1].col23);

      // 入数 = 入数(商流販売店計)
      newData[1].col24 = newData[0].col24;
      // 本数 = 函数 × 入数
      newData[1].col25 = formatNumber(col23_1 * col24_0);
      // 函単価 = 函単価(販売流通店計)
      newData[1].col28 = newData[0].col28;
      // 当月実績額 = 函数 × 函単価
      newData[1].col20 = formatNumber(col23_1 * col28_0);
    };

    // 専用機行（rowIndex === 2）の計算
    const recalcRow2 = () => {
      const col20_1 = parseNumber(newData[1].col20);
      const col20_3 = parseNumber(newData[3].col20);
      const col20_7 = parseNumber(newData[7].col20);
      const col23_1 = parseNumber(newData[1].col23);
      const col23_3 = parseNumber(newData[3].col23);
      const col23_7 = parseNumber(newData[7].col23);
      const col25_1 = parseNumber(newData[1].col25);
      const col25_3 = parseNumber(newData[3].col25);
      const col25_7 = parseNumber(newData[7].col25);
      const col27_2 = parseNumber(newData[2].col27);

      // 当月実績額 = 実販 - 提携機 - アライアンス品
      newData[2].col20 = formatNumber(col20_1 - col20_3 - col20_7);
      const col20_2 = parseNumber(newData[2].col20);

      // 函数 = 実販 - 提携機 - アライアンス品
      newData[2].col23 = formatNumber(col23_1 - col23_3 - col23_7);
      const col23_2 = parseNumber(newData[2].col23);

      // 本数 = 実販 - 提携機 - アライアンス品
      newData[2].col25 = formatNumber(col25_1 - col25_3 - col25_7);
      const col25_2 = parseNumber(newData[2].col25);

      // 入数 = 本数 ÷ 函数
      if (col23_2 !== 0) {
        newData[2].col24 = formatNumber(Math.round(col25_2 / col23_2));
      }
      // 専用機PM/提携機PC = 本数 ÷ 稼働台数
      if (col27_2 !== 0) {
        newData[2].col26 = formatNumber(Math.round(col25_2 / col27_2));
      }
      // 函単価 = 当月実績額 ÷ 函数
      if (col23_2 !== 0) {
        newData[2].col28 = formatNumber(Math.round(col20_2 / col23_2));
      }
    };

    // 提携機行（rowIndex === 3）の計算
    const recalcRow3 = () => {
      const col23_3 = parseNumber(newData[3].col23);
      const col24_3 = parseNumber(newData[3].col24);
      const col25_3 = parseNumber(newData[3].col25);
      const col27_3 = parseNumber(newData[3].col27);
      const col28_3 = parseNumber(newData[3].col28);

      // 函数 = 本数 ÷ 入数
      if (col24_3 !== 0) {
        newData[3].col23 = formatNumber(Math.round(col25_3 / col24_3));
      }
      // 専用機PM/提携機PC = 本数 ÷ 稼働台数
      if (col27_3 !== 0) {
        newData[3].col26 = formatNumber(Math.round(col25_3 / col27_3));
      }
      // 当月実績額 = 函数 × 函単価
      newData[3].col20 = formatNumber(col23_3 * col28_3);
    };

    // その他（手売り）行（rowIndex === 4）の計算
    const recalcRow4 = () => {
      const col23_4 = parseNumber(newData[4].col23);
      const col28_4 = parseNumber(newData[4].col28);

      // 当月実績額 = 函数 × 函単価
      newData[4].col20 = formatNumber(col23_4 * col28_4);
    };

    // 出荷実販差行（rowIndex === 5）の計算
    const recalcRow5 = () => {
      const col23_5 = parseNumber(newData[5].col23);
      const col24_0 = parseNumber(newData[0].col24);

      // 入数 = 入数(商流販売店計)
      newData[5].col24 = newData[0].col24;
      // 本数 = 函数 × 入数
      newData[5].col25 = formatNumber(col23_5 * col24_0);
    };

    // アライアンス品行（rowIndex === 7）の計算
    const recalcRow7 = () => {
      const col23_7 = parseNumber(newData[7].col23);
      const col28_7 = parseNumber(newData[7].col28);

      // 当月実績額 = 函数 × 函単価
      newData[7].col20 = formatNumber(col23_7 * col28_7);
    };

    // 全ての行を再計算（依存関係を考慮）
    console.log('Starting recalculations...');
    recalcRow0();
    recalcRow7();
    recalcRow5();
    recalcRow1();
    recalcRow3();
    recalcRow2();
    recalcRow4();

    console.log('Recalculations complete. New data:', newData);
    setSalesPlanData(newData);
  };

  // 販売計画データ
  const [salesPlanData, setSalesPlanData] = useState([
    {
      category: '商流販売店計',
      col0: '199,991,000',
      col20: '200,000,000',
      col21: '100%',
      col22: '120%',
      col23: '100,000',
      col24: '25.0',
      col25: '2,500,000',
      col26: '－',
      col27: '－',
      col28: '2,000',
      col29: '9,000',
      col33: '5,000',
      col34: '3,000',
      col30: '1,000',
      col31: '20,000,000',
      col32: '10%',
    },
    {
      category: '実販',
      col0: '－',
      col20: '198,000,000',
      col21: '－',
      col22: '－',
      col23: '99,000',
      col24: '25.0',
      col25: '2,475,000',
      col26: '－',
      col27: '－',
      col28: '2,000',
      col29: '－',
      col33: '－',
      col34: '－',
      col30: '－',
      col31: '－',
      col32: '－',
    },
    {
      category: '専用機',
      col0: '－',
      col20: '195,377,129',
      col21: '90%',
      col22: '90%',
      col23: '98,051',
      col24: '25.0',
      col25: '2,451,378',
      col26: '817',
      col27: '3,000',
      col28: '1,993',
      col29: '－',
      col33: '－',
      col34: '－',
      col30: '－',
      col31: '－',
      col32: '－',
    },
    {
      category: '提携機',
      col0: '－',
      col20: '2,400,000',
      col21: '110%',
      col22: '130%',
      col23: '800',
      col24: '25.0',
      col25: '20,000',
      col26: '7',
      col27: '3,000',
      col28: '3,000',
      col29: '－',
      col33: '－',
      col34: '－',
      col30: '－',
      col31: '－',
      col32: '－',
    },
    {
      category: 'その他（手売り）',
      col0: '－',
      col20: '50,000',
      col21: '－',
      col22: '－',
      col23: '20',
      col24: '25.0',
      col25: '500',
      col26: '－',
      col27: '－',
      col28: '2,500',
      col29: '－',
      col33: '－',
      col34: '－',
      col30: '－',
      col31: '－',
      col32: '－',
    },
    {
      category: '出荷実販差',
      col0: '－',
      col20: '6,300,000',
      col21: '－',
      col22: '－',
      col23: '3,000',
      col24: '25.0',
      col25: '75,000',
      col26: '－',
      col27: '－',
      col28: '2,100',
      col29: '－',
      col33: '－',
      col34: '－',
      col30: '－',
      col31: '－',
      col32: '－',
    },
    {
      category: '前月出荷実販差',
      col0: '－',
      col20: '4,200,000',
      col21: '－',
      col22: '－',
      col23: '2,000',
      col24: '25.0',
      col25: '50,000',
      col26: '－',
      col27: '－',
      col28: '－',
      col29: '－',
      col33: '－',
      col34: '－',
      col30: '－',
      col31: '－',
      col32: '－',
    },
    {
      category: 'アライアンス品',
      col0: '－',
      col20: '172,871',
      col21: '－',
      col22: '－',
      col23: '129',
      col24: '24.2',
      col25: '3,122',
      col26: '20',
      col27: '156',
      col28: '1,340',
      col29: '－',
      col33: '－',
      col34: '－',
      col30: '－',
      col31: '－',
      col32: '－',
    },
  ]);

  // 単位行（4行目）のデータ
  const unitRowData = useMemo(
    () => [
      {
        category: '（金額は税抜き）',
        col0: '円',
        col20: '円',
        col21: '%',
        col22: '%',
        col23: '函',
        col24: '本',
        col25: '本数',
        col26: '本',
        col27: '台/コラム',
        col28: '円',
        col29: '円',
        col33: '円',
        col34: '円',
        col30: '円',
        col31: '円',
        col32: '%',
      },
    ],
    []
  );

  // 経費計画データ
  const [expensePlanData, setExpensePlanData] = useState([
    {
      category: '計画金額',
      col1: '200',
      col2: '20,360',
      col3: '0',
      col4: '21%',
      col5: '18,421',
      col6: '19%',
      col7: '90',
      col8: '90',
      col9: '0',
      col10: '20',
      col11: '35',
      col12: '400',
      col13: '250',
    },
    {
      category: '本社',
      col1: '20',
      col2: '－',
      col3: '－',
      col4: '－',
      col5: '－',
      col6: '－',
      col7: '0',
      col8: '20',
      col9: '0',
      col10: '0',
      col11: '－',
      col12: '－',
      col13: '－',
    },
    {
      category: '支社A　自販機部門',
      col1: '130',
      col2: '',
      col3: '－',
      col4: '－',
      col5: '－',
      col6: '－',
      col7: '90',
      col8: '30',
      col9: '0',
      col10: '10',
      col11: '－',
      col12: '－',
      col13: '－',
    },
    {
      category: '支社B　自販機（共通）',
      col1: '50',
      col2: '',
      col3: '－',
      col4: '－',
      col5: '－',
      col6: '－',
      col7: '0',
      col8: '40',
      col9: '0',
      col10: '10',
      col11: '－',
      col12: '－',
      col13: '－',
    },
    {
      category: '支社B　自販機（開拓）',
      col1: '0',
      col2: '',
      col3: '－',
      col4: '－',
      col5: '－',
      col6: '－',
      col7: '0',
      col8: '0',
      col9: '0',
      col10: '0',
      col11: '－',
      col12: '－',
      col13: '－',
    },
    {
      category: '前月実績',
      col1: 'xx',
      col2: 'xx',
      col3: 'xx',
      col4: 'xx',
      col5: 'xx',
      col6: 'xx',
      col7: 'xx',
      col8: 'xx',
      col9: 'xx',
      col10: 'xx',
      col11: '',
      col12: 'xx',
      col13: 'xx',
    },
    {
      category: '前月比（%）',
      col1: 'xx',
      col2: 'xx',
      col3: 'xx',
      col4: 'xx',
      col5: 'xx',
      col6: 'xx',
      col7: 'xx',
      col8: 'xx',
      col9: 'xx',
      col10: 'xx',
      col11: '',
      col12: 'xx',
      col13: 'xx',
    },
    {
      category: '前年同月実績',
      col1: 'xx',
      col2: 'xx',
      col3: 'xx',
      col4: 'xx',
      col5: 'xx',
      col6: 'xx',
      col7: 'xx',
      col8: 'xx',
      col9: 'xx',
      col10: 'xx',
      col11: '',
      col12: 'xx',
      col13: 'xx',
    },
    {
      category: '前年同月比（%）',
      col1: 'xx',
      col2: 'xx',
      col3: 'xx',
      col4: 'xx',
      col5: 'xx',
      col6: 'xx',
      col7: 'xx',
      col8: 'xx',
      col9: 'xx',
      col10: 'xx',
      col11: '',
      col12: 'xx',
      col13: 'xx',
    },
  ]);

  // 経費計画の単位行データ
  const expenseUnitRowData = useMemo(
    () => [
      {
        category: '',
        col1: '千円',
        col2: '千円',
        col3: '千円',
        col4: '%',
        col5: '千円',
        col6: '%',
        col7: '千円',
        col8: '千円',
        col9: '千円',
        col10: '千円',
        col11: '千円',
        col12: '千円',
        col13: '千円',
      },
    ],
    []
  );

  // セルの編集可否を判定する関数
  const isCellEditable = (rowIndex: number, field: string) => {
    if (rowIndex === 0 && field === 'col15') return true; // 5行目の16列目
    if (
      rowIndex === 1 &&
      (field === 'col10' || field === 'col13' || field === 'col16')
    )
      return true; // 6行目の11,14,17列目
    if (
      rowIndex === 2 &&
      (field === 'col10' || field === 'col13' || field === 'col16')
    )
      return true; // 7行目の11,14,17列目
    // 提携機行（rowIndex === 3）：入数、本数、稼働台数(コラム)、函単価
    if (
      rowIndex === 3 &&
      (field === 'col24' ||
        field === 'col25' ||
        field === 'col27' ||
        field === 'col28')
    )
      return true;
    if (rowIndex === 4 && (field === 'col6' || field === 'col16')) return true; // 9行目の7,17列目
    // その他（手売り）行（rowIndex === 4）：函数、函単価
    if (rowIndex === 4 && (field === 'col23' || field === 'col28')) return true;
    // 出荷実販差行（rowIndex === 5）：函数、函単価
    if (rowIndex === 5 && (field === 'col23' || field === 'col28')) return true;
    return false;
  };

  // 経費計画のセルの編集可否を判定する関数
  const isExpenseCellEditable = (rowIndex: number, field: string) => {
    // 計画金額行（rowIndex=0）：値差補填、ロケ運転費、コラム料、販売器具費
    if (
      rowIndex === 0 &&
      (field === 'col3' ||
        field === 'col5' ||
        field === 'col11' ||
        field === 'col13')
    )
      return true;
    // 本社、支社A、支社B共通、支社B開拓行（rowIndex=1,2,3,4）：オペ協力金、その他一時金、ロケ契約料、ロケ契約料他前払い金
    if (
      rowIndex >= 1 &&
      rowIndex <= 4 &&
      (field === 'col7' ||
        field === 'col8' ||
        field === 'col9' ||
        field === 'col10')
    )
      return true;
    return false;
  };

  // 経費計画のセルスタイルを取得する関数
  const getExpenseCellStyle = (
    params: any,
    alignment: 'left' | 'right' | 'center' = 'right'
  ) => {
    if (params.node?.rowPinned === 'top') {
      return {
        backgroundColor: '#f3f4f6',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      };
    }
    const rowIndex = params.node?.rowIndex ?? -1;
    const field = params.colDef?.field;
    const isEditable = isExpenseCellEditable(rowIndex, field);

    const justifyContent =
      alignment === 'left'
        ? 'flex-start'
        : alignment === 'right'
          ? 'flex-end'
          : 'center';

    return {
      backgroundColor: isEditable ? '#ffffff' : '#f9fafb',
      display: 'flex',
      alignItems: 'center',
      justifyContent,
      textAlign: alignment,
      cursor: isEditable ? 'pointer' : 'default',
    };
  };

  // セルのスタイルを取得する関数（編集可能なセルは白背景）
  const getCellStyle = (
    params: any,
    alignment: 'left' | 'right' | 'center' = 'right'
  ) => {
    if (params.node?.rowPinned === 'top') {
      return {
        backgroundColor: '#f3f4f6',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      };
    }
    const rowIndex = params.node?.rowIndex ?? -1;
    const field = params.colDef?.field;
    const cellKey = `${rowIndex}-${field}`;
    const isEditable = isCellEditable(rowIndex, field);
    // 強調表示機能を無効化
    const isClicked = false; // clickedCell?.rowIndex === rowIndex && clickedCell?.field === field;
    const isReference = false; // highlightedCells.references.includes(cellKey);
    const isAffected = false; // highlightedCells.affects.includes(cellKey);

    const justifyContent =
      alignment === 'left'
        ? 'flex-start'
        : alignment === 'right'
          ? 'flex-end'
          : 'center';

    // 背景色と枠線の決定
    let backgroundColor =
      rowIndex === 0 ? '#f9fafb' : isEditable ? '#ffffff' : '#f9fafb';
    let border = 'none';

    if (isClicked) {
      backgroundColor = '#dbeafe'; // 青色（クリックされたセル）
      border = '2px solid #3b82f6';
    } else if (isReference) {
      backgroundColor = '#d1fae5'; // 緑色（このセルが参照するセル）
      border = '2px solid #10b981';
    } else if (isAffected) {
      backgroundColor = '#fed7aa'; // オレンジ色（このセルが影響を与えるセル）
      border = '2px solid #f59e0b';
    }

    // 合計行（rowIndex === 0）の場合は薄い灰色の背景
    if (rowIndex === 0) {
      let row0BgColor = '#f9fafb';
      if (isClicked) row0BgColor = '#dbeafe';
      else if (isReference) row0BgColor = '#d1fae5';
      else if (isAffected) row0BgColor = '#fed7aa';

      return {
        backgroundColor: row0BgColor,
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        justifyContent,
        textAlign: alignment,
        cursor: isEditable ? 'pointer' : 'default',
        border,
      };
    }

    return {
      backgroundColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent,
      textAlign: alignment,
      cursor: isEditable ? 'pointer' : 'default',
      border,
    };
  };

  // ヘッダーのセルスタイル関数
  const getHeaderCellStyle = (level: number, hasData: boolean) => {
    if (level === 1 && hasData) {
      return {
        backgroundColor: '#0ea5e9',
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
      };
    }
    if (level === 2 && hasData) {
      return {
        backgroundColor: '#d1d5db',
        color: '#111827',
        fontWeight: 'bold',
        textAlign: 'center',
      };
    }
    if (level === 3 && hasData) {
      return {
        backgroundColor: '#9ca3af',
        color: '#111827',
        fontWeight: 'bold',
        textAlign: 'center',
      };
    }
    return { backgroundColor: '#e5e7eb' };
  };

  // AG Grid用のカラム定義（3レベルヘッダー）
  const salesPlanColumnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: '',
        field: 'category',
        width: 180,
        pinned: 'left',
        lockPosition: true,
        headerClass: 'ag-header-cell-left',
        cellClass: (params) => {
          if (params.node?.rowPinned === 'top') {
            return '';
          }
          return 'ag-cell-left';
        },
        cellStyle: (params) => {
          if (params.node?.rowPinned === 'top') {
            return {
              backgroundColor: '#f3f4f6',
              fontSize: '11px',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            };
          }
          const rowIndex = params.node?.rowIndex ?? -1;
          // 合計行（rowIndex === 0）の場合は薄い灰色の背景
          if (rowIndex === 0) {
            return {
              backgroundColor: '#f9fafb',
              fontWeight: 'bold',
              lineHeight: '3.2rem',
              paddingLeft: '0.8rem',
            };
          }
          return {
            backgroundColor: '#f9fafb',
            fontWeight: 'bold',
            lineHeight: '3.2rem',
            paddingLeft: '0.8rem',
          };
        },
      },
      {
        headerName: '売上高',
        field: 'col0',
        minWidth: 100,
        editable: (params) =>
          !params.node?.rowPinned &&
          isCellEditable(params.node?.rowIndex ?? -1, 'col0'),
        cellStyle: (params) => {
          const baseStyle = getCellStyle(params, 'right');
          const value = params.value || '';

          // 値がハイフンの場合は薄い灰色背景（強調表示がない場合のみ）
          const rowIndex = params.node?.rowIndex ?? -1;
          const field = params.colDef?.field;
          const cellKey = `${rowIndex}-${field}`;
          // 強調表示機能を無効化
          const isClicked = false; // clickedCell?.rowIndex === rowIndex && clickedCell?.field === field;
          const isReference = false; // highlightedCells.references.includes(cellKey);
          const isAffected = false; // highlightedCells.affects.includes(cellKey);

          if (
            !isClicked &&
            !isReference &&
            !isAffected &&
            (!value || value.trim() === '－')
          ) {
            return {
              ...baseStyle,
              backgroundColor: '#f9fafb',
              cursor: 'default',
            };
          }

          return baseStyle;
        },
        onCellValueChanged: handleCellChange,
      },
      {
        headerName: '社外売上高',
        children: [
          {
            headerName: '当月実績',
            children: [
              {
                headerName: '実績額',
                field: 'col20',
                minWidth: 120,
                editable: (params) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col20'),
                cellStyle: (params) => {
                  const baseStyle = getCellStyle(params, 'right');
                  const value = params.value || '';

                  // 値がハイフンの場合はより薄い灰色背景（強調表示がない場合のみ）
                  const rowIndex = params.node?.rowIndex ?? -1;
                  const field = params.colDef?.field;
                  const cellKey = `${rowIndex}-${field}`;
                  // 強調表示機能を無効化
                  const isClicked = false; // clickedCell?.rowIndex === rowIndex && clickedCell?.field === field;
                  const isReference = false; // highlightedCells.references.includes(cellKey);
                  const isAffected = false; // highlightedCells.affects.includes(cellKey);

                  if (
                    !isClicked &&
                    !isReference &&
                    !isAffected &&
                    (!value || value.trim() === '－')
                  ) {
                    return {
                      ...baseStyle,
                      backgroundColor: '#f9fafb',
                      cursor: 'default',
                    };
                  }

                  return baseStyle;
                },
                onCellValueChanged: handleCellChange,
              },
              {
                headerName: '計画比',
                field: 'col21',
                minWidth: 90,
                editable: (params) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col21'),
                cellStyle: (params) => {
                  if (params.node?.rowPinned === 'top') {
                    return {
                      backgroundColor: '#f3f4f6',
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    };
                  }
                  const rowIndex = params.node?.rowIndex ?? -1;
                  const isEditable = isCellEditable(rowIndex, 'col21');

                  // 合計行（rowIndex === 0）の場合は薄い灰色の背景
                  if (rowIndex === 0) {
                    return {
                      backgroundColor: '#f9fafb',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      textAlign: 'right',
                      cursor: isEditable ? 'pointer' : 'default',
                    };
                  }

                  // 出荷実販差行より下（rowIndex >= 5）は非編集背景
                  if (rowIndex >= 5) {
                    return {
                      backgroundColor: '#f9fafb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      textAlign: 'right',
                      cursor: 'default',
                    };
                  }

                  // 通常の背景
                  return {
                    backgroundColor: '#f9fafb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    textAlign: 'right',
                    cursor: isEditable ? 'pointer' : 'default',
                  };
                },
                onCellValueChanged: handleCellChange,
              },
              {
                headerName: '前年比',
                field: 'col22',
                minWidth: 90,
                editable: (params) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col22'),
                cellStyle: (params) => {
                  if (params.node?.rowPinned === 'top') {
                    return {
                      backgroundColor: '#f3f4f6',
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    };
                  }
                  const rowIndex = params.node?.rowIndex ?? -1;
                  const isEditable = isCellEditable(rowIndex, 'col22');

                  // 合計行（rowIndex === 0）の場合は薄い灰色の背景
                  if (rowIndex === 0) {
                    return {
                      backgroundColor: '#f9fafb',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      textAlign: 'right',
                      cursor: isEditable ? 'pointer' : 'default',
                    };
                  }

                  // 出荷実販差行より下（rowIndex >= 5）は非編集背景
                  if (rowIndex >= 5) {
                    return {
                      backgroundColor: '#f9fafb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      textAlign: 'right',
                      cursor: 'default',
                    };
                  }

                  // 通常の背景
                  return {
                    backgroundColor: '#f9fafb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    textAlign: 'right',
                    cursor: isEditable ? 'pointer' : 'default',
                  };
                },
                onCellValueChanged: handleCellChange,
              },
            ],
          },
          {
            headerName: '函数',
            children: [
              {
                headerName: '函数',
                field: 'col23',
                minWidth: 100,
                editable: (params) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col23'),
                cellStyle: (params) => getCellStyle(params, 'right'),
                onCellValueChanged: handleCellChange,
              },
              {
                headerName: '入数',
                field: 'col24',
                minWidth: 90,
                editable: (params) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col24'),
                cellStyle: (params) => {
                  if (params.node?.rowPinned === 'top') {
                    return {
                      backgroundColor: '#f3f4f6',
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    };
                  }
                  const rowIndex = params.node?.rowIndex ?? -1;
                  const isEditable = isCellEditable(rowIndex, 'col24');

                  // その他（手売り）行は非編集背景
                  if (rowIndex === 4) {
                    return {
                      backgroundColor: '#f9fafb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      textAlign: 'right',
                      cursor: 'default',
                    };
                  }

                  // 合計行（rowIndex === 0）の場合は薄い灰色の背景
                  if (rowIndex === 0) {
                    return {
                      backgroundColor: '#f9fafb',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      textAlign: 'right',
                      cursor: isEditable ? 'pointer' : 'default',
                    };
                  }

                  return {
                    backgroundColor: isEditable ? '#ffffff' : '#f9fafb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    textAlign: 'right',
                    cursor: isEditable ? 'pointer' : 'default',
                  };
                },
                onCellValueChanged: handleCellChange,
              },
              {
                headerName: '本数',
                field: 'col25',
                minWidth: 90,
                editable: (params) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col25'),
                cellStyle: (params) => {
                  if (params.node?.rowPinned === 'top') {
                    return {
                      backgroundColor: '#f3f4f6',
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    };
                  }
                  const rowIndex = params.node?.rowIndex ?? -1;
                  const isEditable = isCellEditable(rowIndex, 'col25');

                  // その他（手売り）行、アライアンス品行は非編集背景
                  if (rowIndex === 4 || rowIndex === 7) {
                    return {
                      backgroundColor: '#f9fafb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      textAlign: 'right',
                      cursor: 'default',
                    };
                  }

                  // 合計行（rowIndex === 0）の場合は薄い灰色の背景
                  if (rowIndex === 0) {
                    return {
                      backgroundColor: '#f9fafb',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      textAlign: 'right',
                      cursor: isEditable ? 'pointer' : 'default',
                    };
                  }

                  return {
                    backgroundColor: isEditable ? '#ffffff' : '#f9fafb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    textAlign: 'right',
                    cursor: isEditable ? 'pointer' : 'default',
                  };
                },
                onCellValueChanged: handleCellChange,
              },
              {
                headerName: '専用機PM/提携機PC',
                field: 'col26',
                minWidth: 170,
                editable: (params) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col26'),
                cellStyle: (params) => {
                  if (params.node?.rowPinned === 'top') {
                    return {
                      backgroundColor: '#f3f4f6',
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    };
                  }
                  const rowIndex = params.node?.rowIndex ?? -1;
                  const isEditable = isCellEditable(rowIndex, 'col26');

                  // 商流販売店計行は太字の薄灰色
                  if (rowIndex === 0) {
                    return {
                      backgroundColor: '#f9fafb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      textAlign: 'right',
                      cursor: 'default',
                      fontWeight: 'bold',
                    };
                  }
                  // 実販、その他（手売り）、出荷実販差、前月出荷実販差行は非編集背景
                  if (
                    rowIndex === 1 ||
                    rowIndex === 4 ||
                    rowIndex === 5 ||
                    rowIndex === 6
                  ) {
                    return {
                      backgroundColor: '#f9fafb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      textAlign: 'right',
                      cursor: 'default',
                    };
                  }

                  return {
                    backgroundColor: isEditable ? '#ffffff' : '#f9fafb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    textAlign: 'right',
                    cursor: isEditable ? 'pointer' : 'default',
                  };
                },
                onCellValueChanged: handleCellChange,
              },
              {
                headerName: '稼働台数(コラム)',
                field: 'col27',
                minWidth: 160,
                editable: (params) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col27'),
                cellStyle: (params) => {
                  if (params.node?.rowPinned === 'top') {
                    return {
                      backgroundColor: '#f3f4f6',
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    };
                  }
                  const rowIndex = params.node?.rowIndex ?? -1;
                  const isEditable = isCellEditable(rowIndex, 'col27');

                  // 商流販売店計行は太字の薄灰色
                  if (rowIndex === 0) {
                    return {
                      backgroundColor: '#f9fafb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      textAlign: 'right',
                      cursor: 'default',
                      fontWeight: 'bold',
                    };
                  }
                  // 実販、その他（手売り）、出荷実販差、前月出荷実販差行は非編集背景
                  if (
                    rowIndex === 1 ||
                    rowIndex === 4 ||
                    rowIndex === 5 ||
                    rowIndex === 6
                  ) {
                    return {
                      backgroundColor: '#f9fafb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      textAlign: 'right',
                      cursor: 'default',
                    };
                  }

                  return {
                    backgroundColor: isEditable ? '#ffffff' : '#f9fafb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    textAlign: 'right',
                    cursor: isEditable ? 'pointer' : 'default',
                  };
                },
                onCellValueChanged: handleCellChange,
              },
            ],
          },
          {
            headerName: '函単価',
            field: 'col28',
            minWidth: 90,
            editable: (params) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col28'),
            tooltipValueGetter: getTooltip,
            cellStyle: (params) => {
              if (params.node?.rowPinned === 'top') {
                return {
                  backgroundColor: '#f3f4f6',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                };
              }
              const rowIndex = params.node?.rowIndex ?? -1;
              const isEditable = isCellEditable(rowIndex, 'col28');

              // 前月出荷実販差行は非編集背景
              if (rowIndex === 6) {
                return {
                  backgroundColor: '#f9fafb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  textAlign: 'right',
                  cursor: 'default',
                };
              }

              // 合計行（rowIndex === 0）の場合は薄い灰色の背景
              if (rowIndex === 0) {
                return {
                  backgroundColor: '#f9fafb',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  textAlign: 'right',
                  cursor: isEditable ? 'pointer' : 'default',
                };
              }

              return {
                backgroundColor: isEditable ? '#ffffff' : '#f9fafb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                textAlign: 'right',
                cursor: isEditable ? 'pointer' : 'default',
              };
            },
            onCellValueChanged: handleCellChange,
          },
        ],
      },
      {
        headerName: '条件口',
        children: [
          {
            headerName: '合計額',
            field: 'col29',
            minWidth: 90,
            editable: (params) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col29'),
            tooltipValueGetter: getTooltip,
            cellStyle: (params) => {
              if (params.node?.rowPinned === 'top') {
                return {
                  backgroundColor: '#f3f4f6',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                };
              }
              const rowIndex = params.node?.rowIndex ?? -1;
              const isEditable = isCellEditable(rowIndex, 'col29');
              const value = params.value || '';

              if (rowIndex === 0) {
                return {
                  backgroundColor: '#f9fafb',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  textAlign: 'right',
                  cursor: isEditable ? 'pointer' : 'default',
                };
              }

              if (!value || value.trim() === '－') {
                return {
                  backgroundColor: '#f9fafb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  textAlign: 'right',
                  cursor: 'default',
                };
              }

              return {
                backgroundColor: isEditable ? '#ffffff' : '#f9fafb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                textAlign: 'right',
                cursor: isEditable ? 'pointer' : 'default',
              };
            },
            onCellValueChanged: handleCellChange,
          },
          {
            headerName: 'オペ条件口',
            field: 'col33',
            minWidth: 110,
            editable: (params) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col33'),
            cellStyle: (params) => {
              if (params.node?.rowPinned === 'top') {
                return {
                  backgroundColor: '#f3f4f6',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                };
              }
              const rowIndex = params.node?.rowIndex ?? -1;
              const isEditable = isCellEditable(rowIndex, 'col33');
              const value = params.value || '';

              if (rowIndex === 0) {
                return {
                  backgroundColor: '#f9fafb',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  textAlign: 'right',
                  cursor: isEditable ? 'pointer' : 'default',
                };
              }

              if (!value || value.trim() === '－') {
                return {
                  backgroundColor: '#f9fafb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  textAlign: 'right',
                  cursor: 'default',
                };
              }

              return {
                backgroundColor: isEditable ? '#ffffff' : '#f9fafb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                textAlign: 'right',
                cursor: isEditable ? 'pointer' : 'default',
              };
            },
            onCellValueChanged: handleCellChange,
          },
          {
            headerName: '帳合料',
            field: 'col34',
            minWidth: 100,
            editable: (params) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col34'),
            cellStyle: (params) => {
              if (params.node?.rowPinned === 'top') {
                return {
                  backgroundColor: '#f3f4f6',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                };
              }
              const rowIndex = params.node?.rowIndex ?? -1;
              const isEditable = isCellEditable(rowIndex, 'col34');
              const value = params.value || '';

              if (rowIndex === 0) {
                return {
                  backgroundColor: '#f9fafb',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  textAlign: 'right',
                  cursor: isEditable ? 'pointer' : 'default',
                };
              }

              if (!value || value.trim() === '－') {
                return {
                  backgroundColor: '#f9fafb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  textAlign: 'right',
                  cursor: 'default',
                };
              }

              return {
                backgroundColor: isEditable ? '#ffffff' : '#f9fafb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                textAlign: 'right',
                cursor: isEditable ? 'pointer' : 'default',
              };
            },
            onCellValueChanged: handleCellChange,
          },
          {
            headerName: 'オペ金銭口/オペ条件口(旧値補償)',
            field: 'col30',
            minWidth: 100,
            editable: (params) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col30'),
            tooltipValueGetter: getTooltip,
            cellStyle: (params) => {
              if (params.node?.rowPinned === 'top') {
                return {
                  backgroundColor: '#f3f4f6',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                };
              }
              const rowIndex = params.node?.rowIndex ?? -1;
              const isEditable = isCellEditable(rowIndex, 'col30');
              const value = params.value || '';

              // 合計行（rowIndex === 0）の場合は薄い灰色の背景
              if (rowIndex === 0) {
                return {
                  backgroundColor: '#f9fafb',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  textAlign: 'right',
                  cursor: isEditable ? 'pointer' : 'default',
                };
              }

              // 値が空の場合は非編集背景
              if (!value || value.trim() === '') {
                return {
                  backgroundColor: '#f9fafb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  textAlign: 'right',
                  cursor: 'default',
                };
              }

              return {
                backgroundColor: isEditable ? '#ffffff' : '#f9fafb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                textAlign: 'right',
                cursor: isEditable ? 'pointer' : 'default',
              };
            },
            onCellValueChanged: handleCellChange,
          },
        ],
      },
      {
        headerName: '原価',
        children: [
          {
            headerName: '原価',
            field: 'col31',
            minWidth: 90,
            editable: (params) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col31'),
            tooltipValueGetter: getTooltip,
            cellStyle: (params) => {
              if (params.node?.rowPinned === 'top') {
                return {
                  backgroundColor: '#f3f4f6',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                };
              }
              const rowIndex = params.node?.rowIndex ?? -1;
              const isEditable = isCellEditable(rowIndex, 'col31');
              const value = params.value || '';

              // 合計行（rowIndex === 0）の場合は薄い灰色の背景
              if (rowIndex === 0) {
                return {
                  backgroundColor: '#f9fafb',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  textAlign: 'right',
                  cursor: isEditable ? 'pointer' : 'default',
                };
              }

              // 値が空の場合は非編集背景
              if (!value || value.trim() === '') {
                return {
                  backgroundColor: '#f9fafb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  textAlign: 'right',
                  cursor: 'default',
                };
              }

              return {
                backgroundColor: isEditable ? '#ffffff' : '#f9fafb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                textAlign: 'right',
                cursor: isEditable ? 'pointer' : 'default',
              };
            },
            onCellValueChanged: handleCellChange,
          },
          {
            headerName: '原価率',
            field: 'col32',
            minWidth: 90,
            editable: (params) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col32'),
            tooltipValueGetter: getTooltip,
            cellStyle: (params) => {
              if (params.node?.rowPinned === 'top') {
                return {
                  backgroundColor: '#f3f4f6',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                };
              }
              const rowIndex = params.node?.rowIndex ?? -1;
              const isEditable = isCellEditable(rowIndex, 'col32');
              const value = params.value || '';

              // 合計行（rowIndex === 0）の場合は薄い灰色の背景
              if (rowIndex === 0) {
                return {
                  backgroundColor: '#f9fafb',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  textAlign: 'right',
                  cursor: isEditable ? 'pointer' : 'default',
                };
              }

              // 値が空の場合は非編集背景
              if (!value || value.trim() === '') {
                return {
                  backgroundColor: '#f9fafb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  textAlign: 'right',
                  cursor: 'default',
                };
              }

              return {
                backgroundColor: isEditable ? '#ffffff' : '#f9fafb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                textAlign: 'right',
                cursor: isEditable ? 'pointer' : 'default',
              };
            },
            onCellValueChanged: handleCellChange,
          },
        ],
      },
    ],
    [salesPlanData, clickedCell, highlightedCells]
  );

  const defaultColDef = useMemo(
    () => ({
      ...GRID_DEFAULT_COL_DEF,
      sortable: false,
      filter: false,
      suppressMovable: true,
      wrapHeaderText: true,
      autoHeaderHeight: true,
    }),
    []
  );

  // 行のスタイルを取得する関数
  const getRowStyle = (params: any) => {
    // 合計行（rowIndex === 0）の場合
    if (!params.node?.rowPinned && params.node?.rowIndex === 0) {
      return {
        backgroundColor: '#f9fafb',
        fontWeight: 'bold',
      };
    }
  };

  // ===== 未償却案件請求一覧テーブル =====
  // 列定義。1行の縦幅を文字複数行分に固定するため折り返し表示にする。
  // required:true の列はヘッダーに必須マーク（赤いアスタリスク）を表示する。
  const locationContractColumnDefs = useMemo<ColDef[]>(() => {
    const columns: {
      field: string;
      headerName: string;
      required?: boolean;
    }[] = [
      { field: 'managementCategory', headerName: '管理区分' },
      { field: 'status', headerName: 'ステータス' },
      { field: 'installationSiteName', headerName: '設置先名' },
      {
        field: 'locationContractAmount',
        headerName: 'ロケ契約料（償却）金額',
      },
      { field: 'billTo', headerName: '請求先' },
      { field: 'counterpartyName', headerName: '相手先名' },
      { field: 'distributionStoreName', headerName: '商流販売店名' },
      { field: 'note1', headerName: '摘要1', required: true },
      { field: 'billerName', headerName: '請求者名' },
      { field: 'invoiceAddress', headerName: '請求書送付先住所' },
      { field: 'invoiceIssuanceCategory', headerName: '請求書発行区分' },
      { field: 'billingContent', headerName: '請求内容' },
      {
        field: 'collectionScheduledDate',
        headerName: '回収予定日',
        required: true,
      },
    ];
    return columns.map((col) => {
      // 金額・日付は右寄せ、それ以外のテキスト列は左寄せ（標準準拠）。
      const isAmount = col.field === 'locationContractAmount';
      const isDate = col.field === 'collectionScheduledDate';
      const isRight = isAmount || isDate;
      return {
        headerName: col.headerName,
        field: col.field,
        minWidth: 120,
        flex: 1,
        editable: true,
        headerComponent: RequiredHeader,
        headerComponentParams: {
          required: col.required,
        },
        cellClass: isRight ? 'cell-right' : 'cell-left',
        // 金額はカンマ区切り、日付は yyyy/MM/dd 表示に整形する。
        ...(isAmount ? { valueFormatter: formatAmountCell } : {}),
        ...(isDate ? { valueFormatter: formatDateCell } : {}),
      };
    });
  }, []);

  // 表データ。初期値を設定する。id は行ID（getRowId）用で、列には表示しない。
  const [locationContractRowData] = useState<Record<string, string>[]>([
    {
      id: 'lc-1',
      managementCategory: 'ロケ契約料他前払い金（償却）',
      status: '未申請',
      installationSiteName: '峠台Aビル',
      locationContractAmount: '120000',
      billTo: '株式会社峠台商事',
      counterpartyName: '峠台 太郎',
      distributionStoreName: '▲▲販売 A支店',
      note1: 'ロケ契約料償却分',
      billerName: '山田 翔一郎',
      invoiceAddress: '東京都千代田区峠台1-2-3',
      invoiceIssuanceCategory: '電子',
      billingContent: '自販機設置ロケ契約料',
      collectionScheduledDate: '2026/7/31',
    },
    {
      id: 'lc-2',
      managementCategory: 'ロケ契約料他前払い金（償却）',
      status: '申請中',
      installationSiteName: 'みなとテラス',
      locationContractAmount: '84000',
      billTo: 'みなと不動産株式会社',
      counterpartyName: '港 花子',
      distributionStoreName: '■■流通 港南支店',
      note1: '更新分ロケ契約料',
      billerName: '佐藤 美咲',
      invoiceAddress: '神奈川県横浜市港南区港5-6-7',
      invoiceIssuanceCategory: '郵送',
      billingContent: 'オフィス設置飲料ロケ料',
      collectionScheduledDate: '2026/8/15',
    },
    {
      id: 'lc-3',
      managementCategory: 'ロケ契約料他前払い金（償却）',
      status: '承認待ち',
      installationSiteName: '北大路スクエア',
      locationContractAmount: '156000',
      billTo: '北大路開発株式会社',
      counterpartyName: '北大路 健',
      distributionStoreName: '◆◆販売 洛北支店',
      note1: '新規設置ロケ契約料',
      billerName: '田中 一郎',
      invoiceAddress: '京都府京都市北区北大路8-9-1',
      invoiceIssuanceCategory: '電子',
      billingContent: '商業施設ロケ契約料',
      collectionScheduledDate: '2026/9/30',
    },
    {
      id: 'lc-4',
      managementCategory: 'ロケ契約料他前払い金（償却）',
      status: '差戻し',
      installationSiteName: '泉南ロジスティクス',
      locationContractAmount: '62000',
      billTo: '泉南運輸株式会社',
      counterpartyName: '泉南 恵子',
      distributionStoreName: '★★流通 泉州支店',
      note1: '解約に伴う残償却請求',
      billerName: '鈴木 大輔',
      invoiceAddress: '大阪府泉南市泉南10-11-12',
      invoiceIssuanceCategory: '郵送',
      billingContent: '倉庫設置ロケ契約料',
      collectionScheduledDate: '2026/10/20',
    },
    {
      id: 'lc-5',
      managementCategory: 'ロケ契約料他前払い金（償却）',
      status: '未申請',
      installationSiteName: '本町ビジネスタワー',
      locationContractAmount: '98000',
      billTo: '本町ビル管理株式会社',
      counterpartyName: '本町 修',
      distributionStoreName: '●●販売 中央支店',
      note1: '月次ロケ契約料償却',
      billerName: '高橋 由美',
      invoiceAddress: '愛知県名古屋市中区本町13-14-15',
      invoiceIssuanceCategory: '電子',
      billingContent: 'ビル共用部ロケ契約料',
      collectionScheduledDate: '2026/11/10',
    },
  ]);

  // いずれかの行が選択されているか。選択時に借方・貸方カードを表示する。
  // 最左のチェックボックスはグリッド標準の選択列（selectionColumnDef）で単一選択する（計画一覧に準拠）。
  const [hasSelectedRow, setHasSelectedRow] = useState(false);

  // ===== 借方・貸方 明細テーブルの列定義（共通） =====
  // 列メタ情報 JOURNAL_COLUMNS から生成する。
  // required:true の列はヘッダーに必須マーク（赤いアスタリスク）を表示する。
  const journalColumnDefs = useMemo<ColDef[]>(() => {
    return JOURNAL_COLUMNS.map((col) => {
      // 金額・数量・単価・日付は右寄せ、それ以外のテキスト列は左寄せ（標準準拠）。
      const isRight = col.numeric === true || col.date === true;
      return {
        headerName: col.headerName,
        field: col.field,
        minWidth: 120,
        flex: 1,
        editable: true,
        headerComponent: RequiredHeader,
        headerComponentParams: {
          required: col.required,
        },
        cellClass: isRight ? 'cell-right' : 'cell-left',
        // 金額・数量・単価はカンマ区切り、日付は yyyy/MM/dd 表示に整形する。
        ...(col.numeric ? { valueFormatter: formatAmountCell } : {}),
        ...(col.date ? { valueFormatter: formatDateCell } : {}),
      };
    });
  }, []);

  // 借方・貸方 明細の行データ（明細追加ペインの一時保存で増える。初期は空）。
  const [debitRowData, setDebitRowData] = useState<Record<string, string>[]>(
    []
  );
  const [creditRowData, setCreditRowData] = useState<Record<string, string>[]>(
    []
  );

  // 借方・貸方 明細の行選択（単一選択）。選択中の行インデックス。未選択は null。
  const [debitSelectedIndex, setDebitSelectedIndex] = useState<number | null>(
    null
  );
  const [creditSelectedIndex, setCreditSelectedIndex] = useState<number | null>(
    null
  );

  // ===== 明細追加・更新ペイン =====
  // ペインの表示状態。
  const [showDetailPane, setShowDetailPane] = useState(false);
  // ペインのモード。'add'=明細追加 / 'edit'=明細更新。
  const [detailMode, setDetailMode] = useState<'add' | 'edit'>('add');
  // 対象（最初に「明細追加」を押した側／更新対象の側）。'debit'=借方 / 'credit'=貸方。
  const [detailTarget, setDetailTarget] = useState<'debit' | 'credit'>('debit');
  // 更新モードで編集中の行インデックス（追加モードでは未使用）。
  const [detailEditIndex, setDetailEditIndex] = useState<number | null>(null);
  // ペインの入力値（列＝JOURNAL_COLUMNS の field をキーに持つ）。
  const [detailForm, setDetailForm] = useState<Record<string, string>>({});

  // 明細追加ボタン押下：ペイン未表示時のみ対象を確定して開く。
  // （既に開いている場合は最初に押した側を維持する）
  const handleAddDetail = (target: 'debit' | 'credit') => {
    if (showDetailPane) return;
    setDetailMode('add');
    setDetailTarget(target);
    setDetailEditIndex(null);
    setDetailForm({});
    setShowDetailPane(true);
  };

  // 明細更新ボタン押下：選択中の行を入力欄へ読み込んで更新モードで開く。
  const handleUpdateDetail = (target: 'debit' | 'credit') => {
    if (showDetailPane) return;
    const index = target === 'debit' ? debitSelectedIndex : creditSelectedIndex;
    if (index === null) return;
    const rows = target === 'debit' ? debitRowData : creditRowData;
    setDetailMode('edit');
    setDetailTarget(target);
    setDetailEditIndex(index);
    setDetailForm({ ...rows[index] });
    setShowDetailPane(true);
  };

  // ペインの入力欄変更。
  const handleDetailFieldChange = (field: string, value: string) => {
    setDetailForm((prev) => ({ ...prev, [field]: value }));
  };

  // 借方・貸方 明細の行ID（getRowId）の採番。明細追加の一時保存で1件ずつ振る。
  const journalRowSeqRef = useRef(0);

  // 一時保存：対象（借方／貸方）の表へ入力内容を反映し、ペインを閉じる。
  // 追加モードは末尾に1行追加（新しい行ID を振る）、更新モードは選択行を上書きする（行ID は元の行のまま）。
  const handleDetailTempSave = () => {
    const newRow = { ...detailForm };
    const setRows =
      detailTarget === 'debit' ? setDebitRowData : setCreditRowData;
    if (detailMode === 'edit' && detailEditIndex !== null) {
      const index = detailEditIndex;
      setRows((prev) =>
        prev.map((row, i) => (i === index ? { ...newRow, id: row.id } : row))
      );
    } else {
      journalRowSeqRef.current += 1;
      const id = `journal-${journalRowSeqRef.current}`;
      // 新規の明細は最上部に追加する（画面設計標準 4.4）。行の左の選択（行番号で保持）も1行ずらす
      setRows((prev) => [{ ...newRow, id }, ...prev]);
      const setSelectedIndex =
        detailTarget === 'debit'
          ? setDebitSelectedIndex
          : setCreditSelectedIndex;
      setSelectedIndex((i) => (i === null ? i : i + 1));
    }
    setShowDetailPane(false);
    setDetailForm({});
  };

  // 戻る：入力を取り消してペインを閉じる。
  const handleDetailBack = () => {
    setShowDetailPane(false);
    setDetailForm({});
  };

  // 経費計画用のカラム定義（2レベルヘッダー）
  const expensePlanColumnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: '',
        field: 'category',
        width: 220,
        pinned: 'left',
        lockPosition: true,
        headerClass: 'ag-header-cell-left',
        cellClass: (params) => {
          if (params.node?.rowPinned === 'top') {
            return '';
          }
          return 'ag-cell-left';
        },
        cellStyle: (params) => {
          if (params.node?.rowPinned === 'top') {
            return {
              backgroundColor: '#f3f4f6',
              fontSize: '11px',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            };
          }
          const rowIndex = params.node?.rowIndex ?? -1;
          // 行ごとにインデント処理
          const paddingLeft = rowIndex >= 1 && rowIndex <= 4 ? '24px' : '8px';
          return {
            backgroundColor: '#f9fafb',
            fontWeight: 'bold',
            fontSize: '13px',
            lineHeight: '32px',
            paddingLeft,
          };
        },
      },
      {
        headerName: '経費金額',
        children: [
          {
            headerName: '合計額',
            field: 'col1',
            width: 100,
            editable: (params) =>
              isExpenseCellEditable(params.node?.rowIndex ?? -1, 'col1'),
            cellStyle: (params) => getExpenseCellStyle(params, 'right'),
            onCellValueChanged: (params) => {
              const newData = [...expensePlanData];
              newData[params.node.rowIndex] = params.data;
              setExpensePlanData(newData);
            },
          },
        ],
      },
      {
        headerName: '条件口',
        children: [
          {
            headerName: '金額',
            field: 'col2',
            width: 100,
            editable: (params) =>
              isExpenseCellEditable(params.node?.rowIndex ?? -1, 'col2'),
            cellStyle: (params) => getExpenseCellStyle(params, 'right'),
            onCellValueChanged: (params) => {
              const newData = [...expensePlanData];
              newData[params.node.rowIndex] = params.data;
              setExpensePlanData(newData);
            },
          },
          {
            headerName: '値差補填',
            field: 'col3',
            width: 100,
            editable: (params) =>
              isExpenseCellEditable(params.node?.rowIndex ?? -1, 'col3'),
            cellStyle: (params) => getExpenseCellStyle(params, 'right'),
            onCellValueChanged: (params) => {
              const newData = [...expensePlanData];
              newData[params.node.rowIndex] = params.data;
              setExpensePlanData(newData);
            },
          },
          {
            headerName: '条件口率',
            field: 'col4',
            width: 90,
            editable: (params) =>
              isExpenseCellEditable(params.node?.rowIndex ?? -1, 'col4'),
            cellStyle: (params) => getExpenseCellStyle(params, 'right'),
            onCellValueChanged: (params) => {
              const newData = [...expensePlanData];
              newData[params.node.rowIndex] = params.data;
              setExpensePlanData(newData);
            },
          },
        ],
      },
      {
        headerName: 'ロケ運転費',
        children: [
          {
            headerName: '金額',
            field: 'col5',
            width: 100,
            editable: (params) =>
              isExpenseCellEditable(params.node?.rowIndex ?? -1, 'col5'),
            cellStyle: (params) => getExpenseCellStyle(params, 'right'),
            onCellValueChanged: (params) => {
              const newData = [...expensePlanData];
              newData[params.node.rowIndex] = params.data;
              setExpensePlanData(newData);
            },
          },
          {
            headerName: 'ロケ運転費率',
            field: 'col6',
            width: 80,
            editable: (params) =>
              isExpenseCellEditable(params.node?.rowIndex ?? -1, 'col6'),
            cellStyle: (params) => getExpenseCellStyle(params, 'right'),
            onCellValueChanged: (params) => {
              const newData = [...expensePlanData];
              newData[params.node.rowIndex] = params.data;
              setExpensePlanData(newData);
            },
          },
        ],
      },
      {
        headerName: 'その他経費',
        children: [
          {
            headerName: 'オペ協力金',
            field: 'col7',
            width: 100,
            editable: (params) =>
              isExpenseCellEditable(params.node?.rowIndex ?? -1, 'col7'),
            cellStyle: (params) => getExpenseCellStyle(params, 'right'),
            onCellValueChanged: (params) => {
              const newData = [...expensePlanData];
              newData[params.node.rowIndex] = params.data;
              setExpensePlanData(newData);
            },
          },
          {
            headerName: 'その他一時金',
            field: 'col8',
            width: 120,
            editable: (params) =>
              isExpenseCellEditable(params.node?.rowIndex ?? -1, 'col8'),
            cellStyle: (params) => getExpenseCellStyle(params, 'right'),
            onCellValueChanged: (params) => {
              const newData = [...expensePlanData];
              newData[params.node.rowIndex] = params.data;
              setExpensePlanData(newData);
            },
          },
          {
            headerName: 'ロケ契約料',
            field: 'col9',
            width: 100,
            editable: (params) =>
              isExpenseCellEditable(params.node?.rowIndex ?? -1, 'col9'),
            cellStyle: (params) => getExpenseCellStyle(params, 'right'),
            onCellValueChanged: (params) => {
              const newData = [...expensePlanData];
              newData[params.node.rowIndex] = params.data;
              setExpensePlanData(newData);
            },
          },
          {
            headerName: 'ロケ契約料他前払い金（償却）',
            field: 'col10',
            width: 160,
            editable: (params) =>
              isExpenseCellEditable(params.node?.rowIndex ?? -1, 'col10'),
            cellStyle: (params) => getExpenseCellStyle(params, 'right'),
            onCellValueChanged: (params) => {
              const newData = [...expensePlanData];
              newData[params.node.rowIndex] = params.data;
              setExpensePlanData(newData);
            },
          },
          {
            headerName: 'コラム料',
            field: 'col11',
            width: 100,
            editable: (params) =>
              isExpenseCellEditable(params.node?.rowIndex ?? -1, 'col11'),
            cellStyle: (params) => getExpenseCellStyle(params, 'right'),
            onCellValueChanged: (params) => {
              const newData = [...expensePlanData];
              newData[params.node.rowIndex] = params.data;
              setExpensePlanData(newData);
            },
          },
          {
            headerName: 'リース料',
            field: 'col12',
            width: 100,
            editable: (params) =>
              isExpenseCellEditable(params.node?.rowIndex ?? -1, 'col12'),
            cellStyle: (params) => getExpenseCellStyle(params, 'right'),
            onCellValueChanged: (params) => {
              const newData = [...expensePlanData];
              newData[params.node.rowIndex] = params.data;
              setExpensePlanData(newData);
            },
          },
          {
            headerName: '販売器具費',
            field: 'col13',
            width: 100,
            editable: (params) =>
              isExpenseCellEditable(params.node?.rowIndex ?? -1, 'col13'),
            cellStyle: (params) => getExpenseCellStyle(params, 'right'),
            onCellValueChanged: (params) => {
              const newData = [...expensePlanData];
              newData[params.node.rowIndex] = params.data;
              setExpensePlanData(newData);
            },
          },
        ],
      },
    ],
    [expensePlanData]
  );

  return (
    // 画面全体を縦フレックスにし、コンテンツとフッターの間のスペーサー（flex-1）で
    // 余白を吸収して、固定フッターをウィンドウ底部（＝main の下端）に張り付ける。
    // コンテンツが短い場合でもフッターが底部に固定され、長い場合は sticky で追従する。
    <div className="min-w-[75rem] flex min-h-full flex-col">
      <div className="px-6 pt-3 pb-3">
        {/* 画面名はヘッダー（システム名の右）に表示する */}
        <ScreenTitle title="未償却案件請求一覧" />

        {/* 販売実績登録セクション */}
        <Collapsible
          open={isOpen}
          onOpenChange={setIsOpen}
          className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-3"
        >
          {/* タイトルヘッダー */}
          <div className="bg-white px-3 pt-2 pb-4 border-b-2 border-b-amber-400 flex items-center justify-between">
            <span className="text-gray-900 font-bold text-lg"></span>

            <div className="flex items-center gap-3">
              <CollapsibleTrigger className="hover:text-blue-700 transition-colors">
                <ChevronDown
                  className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </CollapsibleTrigger>
            </div>
          </div>

          <CollapsibleContent>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              {/* 1行目: 8列グリッド */}
              <div className="grid grid-cols-8 gap-3 mb-2">
                {/* 対象年度 */}
                <div className="col-span-2 flex items-center gap-1">
                  <label className="text-sm text-blue-900 whitespace-nowrap w-[160px] font-bold px-2 py-1">
                    対象年度
                  </label>
                  <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
                    2026
                  </div>
                </div>

                {/* 対象月 */}
                <div className="col-span-2 flex items-center gap-1">
                  <label className="text-sm text-blue-900 whitespace-nowrap w-[160px] font-bold px-2 py-1">
                    対象月
                  </label>
                  <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
                    7
                  </div>
                </div>

                {/* 計画No. */}
                <div className="col-span-2 flex items-center gap-1">
                  <label className="text-sm text-blue-900 whitespace-nowrap w-[160px] font-bold px-2 py-1">
                    計画No.
                  </label>
                  <div className="flex-1 h-8 flex items-center text-sm text-gray-900"></div>
                </div>
              </div>

              {/* 2行目: 8列グリッド */}
              <div className="grid grid-cols-8 gap-3 mb-2">
                {/* 販売店 */}
                <div className="col-span-2 flex items-center gap-1">
                  <label className="text-sm text-blue-900 whitespace-nowrap w-[160px] font-bold px-2 py-1">
                    販売店
                  </label>
                  <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
                    ▲▲
                  </div>
                </div>

                {/* 三次店 */}
                <div className="col-span-2 flex items-center gap-1">
                  <label className="text-sm text-blue-900 whitespace-nowrap w-[160px] font-bold px-2 py-1">
                    三次店
                  </label>
                  <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
                    A支店
                  </div>
                </div>

                {/* 一次店 */}
                <div className="col-span-2 flex items-center gap-1">
                  <label className="text-sm text-blue-900 whitespace-nowrap w-[160px] font-bold px-2 py-1">
                    一次店
                  </label>
                  <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
                    峠台A
                  </div>
                </div>

                {/* 空 */}
                <div className="col-span-2"></div>
              </div>

              {/* 3行目: 8列グリッド */}
              <div className="grid grid-cols-8 gap-3 mb-2">
                {/* 事務所 */}
                <div className="col-span-2 flex items-center gap-1">
                  <label className="text-sm text-blue-900 whitespace-nowrap w-[160px] font-bold px-2 py-1">
                    事業場
                  </label>
                  <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
                    首都圏
                  </div>
                </div>

                {/* 部署 */}
                <div className="col-span-2 flex items-center gap-1">
                  <label className="text-sm text-blue-900 whitespace-nowrap w-[160px] font-bold px-2 py-1">
                    部署
                  </label>
                  <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
                    首都圏営業第一
                  </div>
                </div>

                {/* 営業担当者 */}
                <div className="col-span-2 flex items-center gap-1">
                  <label className="text-sm text-blue-900 whitespace-nowrap w-[160px] font-bold px-2 py-1">
                    営業担当者
                  </label>
                  <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
                    xxxxxx
                  </div>
                </div>

                {/* 空 */}
                <div className="col-span-2"></div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* 販売実績を配置 */}
        <div className="flex flex-col gap-4">
          {/* 販売実績一覧セクション */}
          <Collapsible
            open={isSalesPlanOpen}
            onOpenChange={setIsSalesPlanOpen}
            className="bg-white rounded-lg border border-gray-200 overflow-hidden"
          >
            {/* タイトルヘッダー */}
            <div className="bg-white px-3 pt-2 pb-4 border-b-2 border-b-amber-400 flex items-center justify-between">
              <span className="text-gray-900 font-bold text-lg"></span>

              <CollapsibleTrigger className="hover:text-blue-700 transition-colors">
                <ChevronDown
                  className={`h-5 w-5 transition-transform ${isSalesPlanOpen ? 'rotate-180' : ''}`}
                />
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                {/* 最左にチェックボックス列を表示（計画一覧に準拠）。単一選択で借方・貸方カードを表示する。 */}
                <div className="sales-plan-grid overflow-x-auto w-full">
                  <AgGridReact
                    rowData={locationContractRowData}
                    getRowId={getRecordRowId}
                    columnDefs={locationContractColumnDefs}
                    defaultColDef={defaultColDef}
                    // defaultColDef で filter: false のため、型によるフィルタの追加を止める（→ grid/gridCommon）
                    columnTypes={GRID_NO_FILTER_COLUMN_TYPES}
                    suppressMovableColumns={true}
                    domLayout="autoHeight"
                    rowSelection={{
                      mode: 'singleRow',
                      checkboxes: true,
                      enableClickSelection: false,
                    }}
                    selectionColumnDef={{
                      pinned: 'left',
                      width: 50,
                      resizable: false,
                      suppressMovable: true,
                      suppressHeaderMenuButton: true,
                      // チェックボックスをセルの中央に配置する
                      cellStyle: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                    }}
                    onSelectionChanged={(event) =>
                      setHasSelectedRow(event.api.getSelectedNodes().length > 0)
                    }
                    onGridReady={onGridReady}
                    {...GRID_BASE_PROPS}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* 行選択時に表示する借方・貸方カード（2カラム並列） */}
          {hasSelectedRow && (
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* 借方カード（左） */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-white px-3 pt-2 pb-4 border-b-2 border-b-amber-400 flex items-center justify-between">
                  <span className="text-gray-900 font-bold text-lg">借方</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg"
                      onClick={() => handleAddDetail('debit')}
                    >
                      明細追加
                    </Button>
                    <Button
                      variant="outline"
                      disabled={debitSelectedIndex === null}
                      className="border-blue-600 text-blue-600 hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-700 rounded-lg"
                      onClick={() => handleUpdateDetail('debit')}
                    >
                      明細更新
                    </Button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex">
                    {/* 表外：選択列（単一選択チェックボックス）。中央の表と同じ体裁 */}
                    <div className="flex flex-col flex-shrink-0 pr-2">
                      <div className="h-8 flex items-center justify-center text-sm font-bold text-gray-700 whitespace-nowrap px-1">
                        選択
                      </div>
                      {debitRowData.map((_row, rowIndex) => (
                        <div
                          key={rowIndex}
                          className="h-9 flex items-center justify-center px-1"
                        >
                          <Checkbox
                            checked={debitSelectedIndex === rowIndex}
                            onCheckedChange={(value) =>
                              setDebitSelectedIndex(
                                value === true ? rowIndex : null
                              )
                            }
                            aria-label={`借方 ${rowIndex + 1}行目を選択`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="sales-plan-grid overflow-x-auto w-full">
                      <AgGridReact
                        rowData={debitRowData}
                        getRowId={getRecordRowId}
                        columnDefs={journalColumnDefs}
                        defaultColDef={defaultColDef}
                        // defaultColDef で filter: false のため、型によるフィルタの追加を止める（→ grid/gridCommon）
                        columnTypes={GRID_NO_FILTER_COLUMN_TYPES}
                        suppressMovableColumns={true}
                        domLayout="autoHeight"
                        {...GRID_BASE_PROPS}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 貸方カード（右） */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-white px-3 pt-2 pb-4 border-b-2 border-b-amber-400 flex items-center justify-between">
                  <span className="text-gray-900 font-bold text-lg">貸方</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg"
                      onClick={() => handleAddDetail('credit')}
                    >
                      明細追加
                    </Button>
                    <Button
                      variant="outline"
                      disabled={creditSelectedIndex === null}
                      className="border-blue-600 text-blue-600 hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-700 rounded-lg"
                      onClick={() => handleUpdateDetail('credit')}
                    >
                      明細更新
                    </Button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex">
                    {/* 表外：選択列（単一選択チェックボックス）。中央の表と同じ体裁 */}
                    <div className="flex flex-col flex-shrink-0 pr-2">
                      <div className="h-8 flex items-center justify-center text-sm font-bold text-gray-700 whitespace-nowrap px-1">
                        選択
                      </div>
                      {creditRowData.map((_row, rowIndex) => (
                        <div
                          key={rowIndex}
                          className="h-9 flex items-center justify-center px-1"
                        >
                          <Checkbox
                            checked={creditSelectedIndex === rowIndex}
                            onCheckedChange={(value) =>
                              setCreditSelectedIndex(
                                value === true ? rowIndex : null
                              )
                            }
                            aria-label={`貸方 ${rowIndex + 1}行目を選択`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="sales-plan-grid overflow-x-auto w-full">
                      <AgGridReact
                        rowData={creditRowData}
                        getRowId={getRecordRowId}
                        columnDefs={journalColumnDefs}
                        defaultColDef={defaultColDef}
                        // defaultColDef で filter: false のため、型によるフィルタの追加を止める（→ grid/gridCommon）
                        columnTypes={GRID_NO_FILTER_COLUMN_TYPES}
                        suppressMovableColumns={true}
                        domLayout="autoHeight"
                        {...GRID_BASE_PROPS}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* コンテンツとフッターの間の余白を吸収し、フッターをウィンドウ底部へ押し下げるスペーサー */}
      <div className="flex-1" aria-hidden="true" />

      {/* 固定フッター（計画詳細画面に準拠：高さ h-9 の btn-action-base。ルートで min-w-[75rem] 済みのため mt-4/min-w は付けない） */}
      <div
        data-screen-footer
        className="bg-white border-t border-gray-200 px-6 py-4 sticky bottom-0 z-10"
      >
        <div className="flex flex-wrap gap-3 justify-between">
          <div>
            <button
              className="btn-action-base btn-action-outline"
              aria-label="戻る"
            >
              <X className="h-4 w-4" />
              戻る
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label
                htmlFor="billing-unbilled-comment"
                className="text-sm text-gray-600 whitespace-nowrap"
              >
                コメント
              </label>
              <textarea
                id="billing-unbilled-comment"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="コメントを入力（差戻し理由など）"
                rows={2}
                className="h-12 w-128 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
              />
            </div>
            <button
              className="btn-action-base btn-action-red"
              aria-label="差戻し"
            >
              <CornerUpLeft className="h-4 w-4" />
              差戻し
            </button>
            <button
              className="btn-action-base btn-action-green"
              aria-label="承認"
            >
              <Check className="h-4 w-4" />
              承認
            </button>
            <button
              className="btn-action-base btn-action-outline-blue"
              aria-label="引戻し"
            >
              <CornerUpLeft className="h-4 w-4" />
              引戻し
            </button>
            <button
              className="btn-action-base btn-action-green"
              aria-label="申請"
            >
              <Send className="h-4 w-4" />
              申請
            </button>
            <button
              className="btn-action-base btn-action-blue"
              aria-label="保存"
            >
              <Save className="h-4 w-4" />
              保存
            </button>
          </div>
        </div>
      </div>

      {/* 明細追加ペイン（借方／貸方の「明細追加」押下で表示）。
          一時保存で最初に押した側の表へ入力内容を保存し、戻るで入力を取り消して閉じる。 */}
      <BottomPane
        open={showDetailPane}
        onClose={handleDetailBack}
        title={detailMode === 'edit' ? '明細更新' : '明細追加'}
        description={`${detailTarget === 'debit' ? '借方' : '貸方'}の明細を${
          detailMode === 'edit' ? '更新' : '追加'
        }します`}
        footer={
          <div className="flex flex-wrap gap-3">
            {/* 承認回付（使用可） */}
            <Button className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg">
              承認回付
            </Button>
            {/* 伝票確認（使用可） */}
            <Button
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              伝票確認
            </Button>
            {/* 一時保存（使用可）→ 最初に押した側の表へ保存 */}
            <Button
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg"
              onClick={handleDetailTempSave}
            >
              <Save className="h-4 w-4 mr-2" />
              一時保存
            </Button>
            {/* 戻る（入力取消・ペイン非表示） */}
            <Button
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg"
              onClick={handleDetailBack}
            >
              <X className="h-4 w-4 mr-2" />
              戻る
            </Button>
          </div>
        }
      >
        {/* 表の値を設定する入力欄（JOURNAL_COLUMNS の各列に対応） */}
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 @md:grid-cols-2 @2xl:grid-cols-3">
          {JOURNAL_COLUMNS.map((col) => (
            <div key={col.field} className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                {col.headerName}
                {col.required && <RequiredBadge />}
              </Label>
              <Input
                className={TEXT_INPUT_CLASS}
                value={detailForm[col.field] || ''}
                onChange={(e) =>
                  handleDetailFieldChange(col.field, e.target.value)
                }
              />
            </div>
          ))}
        </div>
      </BottomPane>

      {/* カスタムツールチップ（無効化） */}
      {/* {tooltipPosition && (
        <div
          style={{
            position: 'fixed',
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translate(-50%, -100%)',
            backgroundColor: '#1f2937',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '13px',
            zIndex: 9999,
            maxWidth: '400px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>計算式:</div>
          {tooltipPosition.text}
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #4b5563', fontSize: '11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#dbeafe', border: '1px solid #3b82f6' }}></div>
              <span>選択中</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#d1fae5', border: '1px solid #10b981' }}></div>
              <span>参照元（このセルが使用）</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#fed7aa', border: '1px solid #f59e0b' }}></div>
              <span>影響先（このセルが影響）</span>
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: '-6px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #1f2937',
            }}
          />
        </div>
      )} */}
    </div>
  );
}
