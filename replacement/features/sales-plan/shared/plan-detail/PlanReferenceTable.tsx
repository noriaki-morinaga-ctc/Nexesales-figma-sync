import { useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ColGroupDef, GetRowIdParams } from 'ag-grid-community';

import {
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  GRID_EMPTY_TEXT,
  gridFilterContextMenuItems,
  useGridColumnState,
  withHeaderTooltips,
  GRID_MONTH_TEXT_FILTER,
  CopyRowCellRenderer,
} from '@/components/grid';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { FORM_LABEL_CLASS } from '@/styles/commonStyles';
import { addMonths, yearAroundRange } from '@/utils/common/yearMonth';
import {
  EXPENSE_MANAGEMENT_CODE_OPTIONS,
  EXPENSE_CAMPAIGN_CODE_OPTIONS,
} from '@/constants/expenseRelations';
import {
  managementClassFromCode,
  campaignClassFromCode,
} from '@/utils/common/expenseRelations';
import {
  managementClassCodeOf,
  managementCodeNameOf,
  campaignClassCodeOf,
  campaignCodeNameOf,
} from '@/utils/common/comboFieldOptions';
import type { NonProductExpenseData } from '@/types/nonProductExpense';

// 参照ダミー行へ採番する管理コード／施策コード（expenseRelations と整合）
const MGMT_CODES = EXPENSE_MANAGEMENT_CODE_OPTIONS.map((o) => o.value);
const CAMP_CODES = EXPENSE_CAMPAIGN_CODE_OPTIONS.map((o) => o.value);

// 拡売費計画の「参照用」下ペインに表示する自計画の参照グリッド。
// 自計画の過去12か月分（ダミー）を表示し、各行のコピーボタンで拡売費計画グリッドへ取り込む。
// 列構成は拡売費計画表と同一にする（アクション列は左端）。

interface PlanReferenceTableProps {
  /** コピーボタン押下時に対象行を親へ渡す（拡売費計画へ追加） */
  onCopyRow: (row: NonProductExpenseData) => void;
  /** 対象年月（YYYY/MM）。この12か月前〜この月を表示する（usePlanReferencePeriod で持つ） */
  period: string;
}

// 参照表の対象年月（既定＝基本情報の対象年月。基本情報の対象年月が変わったら追従させる）。
// 対象年月の選択は下ペインの見出しの行（BottomPane の titleExtra）に置くため、画面で持って参照表へ渡す。
export function usePlanReferencePeriod(
  targetMonth: string
): [string, (value: string) => void] {
  const [period, setPeriod] = useState(targetMonth);
  useEffect(() => {
    setPeriod(targetMonth);
  }, [targetMonth]);
  return [period, setPeriod];
}

interface PlanReferencePeriodFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** 基本情報の対象年月（YYYY/MM）。選択できる範囲（前後1年）の基準。省略時は範囲を設けない */
  targetMonth?: string;
}

// 下ペインの見出しの行に置く「対象年月」の選択（→ 02 §10.3 BottomPane）。
// 選択できるのは基本情報エリアの対象年月の前後1年
//（1年前の同月〜1年後の同月。課題1908で未来の計画も引用できるようにした。1年後までとするかは確認事項）。
export function PlanReferencePeriodField({
  value,
  onChange,
  targetMonth,
}: PlanReferencePeriodFieldProps) {
  const { min, max } = targetMonth
    ? yearAroundRange(targetMonth)
    : { min: undefined, max: undefined };
  return (
    <div className="flex items-center gap-2">
      <label className={`${FORM_LABEL_CLASS} whitespace-nowrap`}>
        対象年月
      </label>
      <MonthYearPicker value={value} onChange={onChange} min={min} max={max} />
    </div>
  );
}

// 自計画ダミーの素データ（拡売費）。
const BASE_REFERENCE = [
  {
    metaBrand: '三ツ矢',
    summaryProduct: '十六茶PET630（ラベルレス）',
    amount: 150000,
    prior: 148000,
    month: '2025/10',
    mClass: '拡売費A',
    mCode: 'A001',
    account: '販促費',
    cClass: '新規導入',
    cCode: 'SK001',
    desc: '店頭POP費用',
  },
  {
    metaBrand: 'カルピス',
    summaryProduct: '三ツ矢特濃ピーチスカッシュP500',
    amount: 300000,
    prior: 290000,
    month: '2025/10',
    mClass: '拡売費B',
    mCode: 'B002',
    account: '広告費',
    cClass: '販売促進',
    cCode: 'SK002',
    desc: 'TV-CM放映費',
  },
  {
    metaBrand: '十六茶',
    summaryProduct: '「カルピス」（プラボトル）470ml',
    amount: 80000,
    prior: 82000,
    month: '2025/10',
    mClass: '拡売費A',
    mCode: 'A003',
    account: '販促費',
    cClass: 'スポット',
    cCode: 'SK003',
    desc: 'サンプリング費用',
  },
  {
    metaBrand: 'ワンダ',
    summaryProduct: 'ワンダ金の微糖１８５ｇ３０本',
    amount: 130000,
    prior: 125000,
    month: '2025/10',
    mClass: '拡売費B',
    mCode: 'B006',
    account: 'イベント費',
    cClass: 'リピート',
    cCode: 'SK014',
    desc: '試飲キャンペーン費',
  },
  {
    metaBrand: 'ウィルキンソン',
    summaryProduct: 'ウィルキンソンタンサン１Ｌ１２本',
    amount: 450000,
    prior: 440000,
    month: '2025/09',
    mClass: '拡売費C',
    mCode: 'C001',
    account: '販促費',
    cClass: '',
    cCode: '',
    desc: '展示会出展費',
  },
  {
    metaBrand: 'おいしい水',
    summaryProduct: '「アサヒおいしい水」六甲PET2L（ラベルレス）',
    amount: 120000,
    prior: 110000,
    month: '2025/09',
    mClass: '拡売費B',
    mCode: 'B003',
    account: 'イベント費',
    cClass: 'スポット',
    cCode: 'SK009',
    desc: '試飲イベント費',
  },
  {
    metaBrand: '三ツ矢',
    summaryProduct: '三ツ矢特濃ピーチスカッシュP500',
    amount: 220000,
    prior: 215000,
    month: '2025/09',
    mClass: '拡売費A',
    mCode: 'A007',
    account: '広告費',
    cClass: '販売促進',
    cCode: 'SK015',
    desc: 'Web動画広告費',
  },
  {
    metaBrand: 'モンスター',
    summaryProduct: 'モンスターエナジー355ml',
    amount: 260000,
    prior: 250000,
    month: '2025/08',
    mClass: '拡売費C',
    mCode: 'C002',
    account: '広告費',
    cClass: 'リピート',
    cCode: 'SK010',
    desc: 'デジタル広告費',
  },
  {
    metaBrand: 'カルピス',
    summaryProduct: '「カルピス」（プラボトル）470ml',
    amount: 185000,
    prior: 0,
    month: '2025/08',
    mClass: '拡売費A',
    mCode: 'A008',
    account: '販促費',
    cClass: '新規導入',
    cCode: 'SK016',
    desc: '新商品導入販促費',
  },
  {
    metaBrand: '十六茶',
    summaryProduct: '十六茶PET630（ラベルレス）',
    amount: 270000,
    prior: 260000,
    month: '2025/07',
    mClass: '拡売費B',
    mCode: 'B007',
    account: 'イベント費',
    cClass: 'スポット',
    cCode: 'SK017',
    desc: '夏季イベント協賛費',
  },
  {
    metaBrand: 'ワンダ',
    summaryProduct: 'ワンダ金の微糖１８５ｇ３０本',
    amount: 95000,
    prior: 90000,
    month: '2025/07',
    mClass: '拡売費A',
    mCode: 'A004',
    account: '販促費',
    cClass: '新規導入',
    cCode: '',
    desc: '店頭什器費用',
  },
  {
    metaBrand: '三ツ矢',
    summaryProduct: '十六茶PET630（ラベルレス）',
    amount: 180000,
    prior: 175000,
    month: '2025/06',
    mClass: '拡売費B',
    mCode: 'B004',
    account: '広告費',
    cClass: '販売促進',
    cCode: 'SK006',
    desc: '新聞折込チラシ費',
  },
  {
    metaBrand: 'モンスター',
    summaryProduct: 'モンスターエナジー355ml',
    amount: 145000,
    prior: 140000,
    month: '2025/06',
    mClass: '拡売費C',
    mCode: 'C003',
    account: '販促費',
    cClass: 'スポット',
    cCode: 'SK018',
    desc: '量販店エンド費',
  },
  {
    metaBrand: 'カルピス',
    summaryProduct: '「カルピス」（プラボトル）470ml',
    amount: 210000,
    prior: 205000,
    month: '2025/05',
    mClass: '拡売費A',
    mCode: 'A005',
    account: '販促費',
    cClass: 'リピート',
    cCode: 'SK007',
    desc: '増量パック販促費',
  },
  {
    metaBrand: 'おいしい水',
    summaryProduct: '「アサヒおいしい水」六甲PET2L（ラベルレス）',
    amount: 160000,
    prior: 158000,
    month: '2025/04',
    mClass: '拡売費B',
    mCode: 'B008',
    account: '広告費',
    cClass: '販売促進',
    cCode: 'SK019',
    desc: '交通広告費（春季）',
  },
  {
    metaBrand: 'ウィルキンソン',
    summaryProduct: 'ウィルキンソンタンサン１Ｌ１２本',
    amount: 140000,
    prior: 138000,
    month: '2025/03',
    mClass: '拡売費C',
    mCode: 'C002',
    account: 'イベント費',
    cClass: 'スポット',
    cCode: 'SK011',
    desc: 'サンプリングイベント費',
  },
  {
    metaBrand: '十六茶',
    summaryProduct: '三ツ矢特濃ピーチスカッシュP500',
    amount: 330000,
    prior: 320000,
    month: '2025/01',
    mClass: '拡売費B',
    mCode: 'B005',
    account: '広告費',
    cClass: '販売促進',
    cCode: 'SK012',
    desc: '交通広告費',
  },
  {
    metaBrand: 'ワンダ',
    summaryProduct: 'ワンダ金の微糖１８５ｇ３０本',
    amount: 200000,
    prior: 190000,
    month: '2025/01',
    mClass: '拡売費A',
    mCode: 'A009',
    account: '販促費',
    cClass: 'リピート',
    cCode: 'SK020',
    desc: '初売り販促費',
  },
  {
    metaBrand: 'モンスター',
    summaryProduct: 'モンスターエナジー355ml',
    amount: 175000,
    prior: 170000,
    month: '2024/12',
    mClass: '拡売費A',
    mCode: 'A002',
    account: '販促費',
    cClass: '',
    cCode: 'SK013',
    desc: '店頭値引き販促費',
  },
  {
    metaBrand: 'カルピス',
    summaryProduct: '三ツ矢特濃ピーチスカッシュP500',
    amount: 240000,
    prior: 235000,
    month: '2024/11',
    mClass: '拡売費B',
    mCode: 'B009',
    account: '広告費',
    cClass: '販売促進',
    cCode: 'SK021',
    desc: '年末特売広告費',
  },
];

// 参照表（過去計画）の作成者ダミー。
const REFERENCE_CREATORS = [
  'アサヒ　太郎',
  '山田 太郎',
  '佐藤 花子',
  '鈴木 一郎',
];

// 参照表の行ID（→ 画面設計標準 4.7）。no はダミーデータ生成時の連番で一意・編集しない
const getRowId = (params: GetRowIdParams<NonProductExpenseData>) =>
  `ref-${params.data.no}`;

// 過去12か月分の自計画ダミーデータ（拡売費）。
const REFERENCE_ROWS: NonProductExpenseData[] = BASE_REFERENCE.map((b, i) => ({
  no: i + 1,
  metaBrand: b.metaBrand,
  summaryProduct: b.summaryProduct,
  // 拡売費
  exp1PlannedAmount: b.amount,
  exp1PriorYearActual: b.prior,
  exp1PostingMonth: b.month,
  exp1ManagementCode: MGMT_CODES[i % MGMT_CODES.length],
  exp1ManagementClass: managementClassFromCode(
    MGMT_CODES[i % MGMT_CODES.length]
  ),
  exp1AccountItem: b.account,
  exp1CampaignCode: CAMP_CODES[i % CAMP_CODES.length],
  exp1CampaignClass: campaignClassFromCode(CAMP_CODES[i % CAMP_CODES.length]),
  exp1Description: b.desc,
  // 参照表は過去計画のため作成者はダミー。取り込み時にログインユーザーで上書きする。
  exp1Creator: REFERENCE_CREATORS[i % REFERENCE_CREATORS.length],
}));

export function PlanReferenceTable({
  onCopyRow,
  period: targetPeriod,
}: PlanReferenceTableProps) {
  // 拡売費の列（読取専用・計画金額～摘要1（社内用））。2段ヘッダーは使わずフラットに表示する。
  // 区分値・名称は行の保持値（管理区分=名称／管理コード=コード）から導出して表示する。
  // 前年実績は列に持たない（コピー先では常に「-」で追加される）。
  const makeRefExpenseColumns = (
    prefix: 'exp1'
  ): ColDef<NonProductExpenseData>[] => [
    {
      headerName: '計画金額',
      field: `${prefix}PlannedAmount`,
      width: 96,
      // 金額は整数表示だが、小数を持つ値が来ても3桁以上出さないよう小数点以下2桁で丸める。
      valueFormatter: (params) =>
        params.value?.toLocaleString('ja-JP', { maximumFractionDigits: 2 }) ||
        GRID_EMPTY_TEXT,
      cellClass: 'cell-right',
    },
    {
      headerName: '計上年月',
      field: `${prefix}PostingMonth`,
      ...GRID_MONTH_TEXT_FILTER,
      width: 88,
      // カレンダー（年月）入力の列は左寄せ
      cellClass: 'cell-left',
    },
    {
      headerName: '管理区分',
      colId: `${prefix}ManagementClassCode`,
      width: 88,
      valueGetter: (params) =>
        managementClassCodeOf(params.data?.[`${prefix}ManagementClass`] ?? ''),
    },
    {
      headerName: '管理区分名称',
      field: `${prefix}ManagementClass`,
      width: 136,
    },
    {
      headerName: '管理コード',
      field: `${prefix}ManagementCode`,
      width: 104,
    },
    {
      headerName: '管理コード名称',
      colId: `${prefix}ManagementCodeName`,
      width: 136,
      valueGetter: (params) =>
        managementCodeNameOf(params.data?.[`${prefix}ManagementCode`] ?? ''),
    },
    {
      headerName: '施策区分',
      colId: `${prefix}CampaignClassCode`,
      width: 88,
      valueGetter: (params) =>
        campaignClassCodeOf(params.data?.[`${prefix}CampaignClass`] ?? ''),
    },
    {
      headerName: '施策区分名称',
      field: `${prefix}CampaignClass`,
      width: 120,
    },
    {
      headerName: '施策コード',
      field: `${prefix}CampaignCode`,
      width: 104,
    },
    {
      headerName: '施策コード名称',
      colId: `${prefix}CampaignCodeName`,
      width: 152,
      valueGetter: (params) =>
        campaignCodeNameOf(params.data?.[`${prefix}CampaignCode`] ?? ''),
    },
    // 摘要1（社内用）は残り幅いっぱいに伸ばし、表の右端まできれいに収める
    {
      headerName: '摘要1（社内用）',
      field: `${prefix}Description`,
      flex: 1,
      suppressAutoSize: true, // 残りの幅に広げる列のため自動調整から外す（flex を保つ）
      minWidth: 160,
    },
  ];

  // 列順は拡売費計画表に合わせる（アクション列のみ左端）
  const columnDefs: (
    | ColDef<NonProductExpenseData>
    | ColGroupDef<NonProductExpenseData>
  )[] = useMemo(
    () =>
      withHeaderTooltips<NonProductExpenseData>([
        {
          headerName: '',
          // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
          suppressColumnsToolPanel: true,
          colId: 'actions',
          width: 72,
          sortable: false,
          filter: false,
          suppressHeaderMenuButton: true,
          cellRenderer: CopyRowCellRenderer,
          cellRendererParams: { label: '拡売費計画へコピー' },
        },
        {
          headerName: 'メタブランド',
          field: 'metaBrand',
          width: 120,
          cellClass: 'cell-left',
        },
        {
          headerName: 'サマリ商品',
          field: 'summaryProduct',
          width: 192,
        },
        ...makeRefExpenseColumns('exp1'),
      ]),
    []
  );

  // 列状態（列幅・並び順・ソート・固定・表示）を localStorage へ永続化。
  const gridColumnStateProps = useGridColumnState(
    'Wholesale.referenceTable.columnState.v2'
  );

  const defaultColDef: ColDef = useMemo(
    () => ({
      ...GRID_DEFAULT_COL_DEF,
      resizable: true,
      sortable: true,
      filter: true,
    }),
    []
  );

  // 表示行を対象年月の12か月前〜対象年月で絞り込む（拡売費の計上年月で判定）。
  // 列フィルタ（setFilterModel）ではなく rowData 自体を絞ることで、
  // 計上年月列にアクティブフィルタのアイコンが表示されないようにする。
  const rowData = useMemo(() => {
    if (!targetPeriod) return REFERENCE_ROWS;
    // 選択年月の12か月前〜選択年月を表示対象とする。
    // 'YYYY/MM' はゼロ埋め前提で辞書順＝時系列順のため文字列比較で範囲判定できる
    const from = addMonths(targetPeriod, -12);
    return REFERENCE_ROWS.filter(
      (row) =>
        row.exp1PostingMonth >= from && row.exp1PostingMonth <= targetPeriod
    );
  }, [targetPeriod]);

  return (
    // 下ペインの高さに合わせて伸び縮みする（下限を付けない。下ペインは初めて開いたときに明細5行分の高さになる → 02 BottomPane）
    <div className="reference-grid flex min-h-0 w-full flex-1 flex-col">
      <div className="min-h-0 w-full flex-1">
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={getRowId}
          getContextMenuItems={gridFilterContextMenuItems}
          statusBar={GRID_STATUS_BAR}
          context={{ onCopyRow }}
          // 行のダブルクリックでも拡売費計画へコピーする（コピーボタンと同じ動作）
          onRowDoubleClicked={(params) => params.data && onCopyRow(params.data)}
          {...GRID_BASE_PROPS}
          {...gridColumnStateProps}
        />
      </div>
    </div>
  );
}
