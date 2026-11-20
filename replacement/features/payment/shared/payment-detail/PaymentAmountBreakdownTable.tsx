// 支払詳細(追加口請求書有／追加口請求書無)の合計表（追加口カード・拡売費カード・支払情報カードで共用）。
// 行は項目ごとに「請求／支払／差額」の3行、列は「合計」の右に税率別（4列）・データ元別（画面ごとの列）を並べる。
// 見出しはグループ名の行（税率別／データ元別）と列名の行の2段。
// 並べ替え・絞り込みの要らない小さな静的な表のため、AG Grid ではなく ui/table で組む（→ 02）。
// 数値の書式は Excel の表示形式 #,##0;[Red]\(#,##0\);\- に合わせる
//（マイナスは赤字＋括弧で、色だけに頼らない → 06）。
// マイナスの表記は negativeFormat で「-」符号（例：-100）に切り替えられる（支払詳細(追加口請求書無)）。
// 請求データを持たない項目（請求書無の全項目）は、請求・差額の行を値にかかわらず「-」で表示する。
// 差額を出さない項目（請求書有のセンターフィ。請求と支払が同じ値）は、差額の行を「-」で表示する。
// データ元別の列は画面ごとに渡す（請求書有＝請求EDI・AIC入力・手入力、
// 請求書無＝AIC入力・手入力。→ constants/dataSource.ts）。
//
// 罫線・配色は画面イメージ（Excel）に合わせる。
//   ・セルの罫線は点線。項目の区切りは実線、金額　計の上は二重線
//   ・「合計」列の左は実線・右は二重線、税率別とデータ元別の間は実線
//   ・区分の行の背景は 請求＝薄い青／支払＝薄い灰／差額＝薄い赤
//   ・差額は区分名・値とも赤の太字。0以外の差額のセルは濃いめの赤系の背景で目立たせる
//     （赤字は text-red-700。背景 bg-red-100 の上でも WCAG AA のコントラスト比 4.5:1 を満たす → 06）
// 罫線は border-collapse の優先順位（太い線＞同じ太さなら 二重＞実線＞点線）を使い、
// セルは点線、列（col）と行（tr）に実線・二重線を指定して重ねる。
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/components/ui/utils';
import { EmptyValue } from '@/components/ui/empty-value';
import {
  WITH_INVOICE_DATA_SOURCE_COLUMNS,
  type DataSource,
} from '@/constants/dataSource';
import {
  TAX_RATE_COLUMNS,
  formatBreakdownAmount,
  type BreakdownNegativeFormat,
} from '@/utils/payment/payment-detail/paymentAmountBreakdown';
import {
  breakdownCellValues,
  type BreakdownItem,
  type BreakdownKind,
} from '@/utils/payment/payment-detail/paymentBreakdownItems';

// 表に並べる1項目（項目名と合計表）。項目の定義は utils/payment/payment-detail/paymentBreakdownItems の BreakdownItem。
//   isGrandTotal      … 支払情報カードの金額　計。直前の項目との区切りを二重線にする
//   isBillUnavailable … 請求・差額の行を「-」で表示する（支払詳細(追加口請求書無)の全項目）
//   isDiffUnavailable … 差額の行を「-」で表示する（支払詳細(追加口請求書有)のセンターフィ）
export type PaymentAmountBreakdownItem = BreakdownItem;

interface PaymentAmountBreakdownTableProps {
  items: PaymentAmountBreakdownItem[];
  // 表の説明（スクリーンリーダー向け）。
  ariaLabel: string;
  className?: string;
  // データ元別の列（表示順）。既定は支払詳細(追加口請求書有)の列。
  // 支払詳細(追加口請求書無)は WITHOUT_INVOICE_DATA_SOURCE_COLUMNS を渡す。
  dataSourceColumns?: readonly DataSource[];
  // 負の値の表記。既定は括弧付き（Excel の表示形式）。支払詳細(追加口請求書無)は「-」符号。
  negativeFormat?: BreakdownNegativeFormat;
}

type KindKey = BreakdownKind;

// 区分（請求／支払／差額）ごとの背景色と区分名の文字色。
const KIND_ROWS: {
  key: KindKey;
  label: string;
  bgClass: string;
  labelClass: string;
}[] = [
  {
    key: 'bill',
    label: '請求',
    bgClass: 'bg-sky-50/60',
    labelClass: 'text-gray-600',
  },
  {
    key: 'pay',
    label: '支払',
    bgClass: 'bg-gray-100',
    labelClass: 'text-gray-600',
  },
  {
    key: 'diff',
    label: '差額',
    bgClass: 'bg-red-50/60',
    labelClass: 'font-bold text-red-700',
  },
];

// セルの罫線（点線）。列・行の実線／二重線はこれより優先される。
const CELL_BORDER_CLASS = 'border border-dotted border-slate-300';
const HEAD_CLASS = `${CELL_BORDER_CLASS} h-auto bg-sky-100 px-2 py-1 text-center font-bold text-gray-800`;
// 区切り線の色（項目の区切り＝青、列の区切り＝灰）。
const ITEM_SEPARATOR_CLASS = 'border-b border-solid border-blue-400';
const ITEM_DOUBLE_SEPARATOR_CLASS = 'border-b-4 border-double border-blue-400';

// 数値セル。差額の行は0以外を赤の太字＋赤系の背景にし、それ以外の行もマイナスは赤字にする。
// 値が null（データが無い）のセルは「-」を出し、強調しない。
const AmountCell = ({
  value,
  kind,
  negativeFormat,
  isTotalColumn = false,
}: {
  value: number | null;
  kind: KindKey;
  negativeFormat?: BreakdownNegativeFormat;
  isTotalColumn?: boolean;
}) => {
  const rounded = value === null ? 0 : Math.round(value);
  const isDiffHighlight = kind === 'diff' && rounded !== 0;
  return (
    <TableCell
      className={cn(
        CELL_BORDER_CLASS,
        'px-2 py-1 text-right tabular-nums text-gray-700',
        // 「合計」列は一段大きい文字で示す。
        isTotalColumn && 'text-base',
        rounded < 0 && 'text-red-700',
        isDiffHighlight && 'bg-red-100 font-bold text-red-700'
      )}
    >
      {/* データが無いセルはグレーの「-」（画面設計標準 3.11） */}
      {value === null ? (
        <EmptyValue />
      ) : (
        formatBreakdownAmount(value, negativeFormat)
      )}
    </TableCell>
  );
};

// 区分（請求／支払／差額）の行の値セル。並びは［合計, 税率別4列, データ元別の列］
//（→ utils/payment/payment-detail/paymentBreakdownItems の breakdownCellValues）。null のセルは「-」を出す。
const KindCells = ({
  values,
  kind,
  negativeFormat,
}: {
  values: (number | null)[];
  kind: KindKey;
  negativeFormat?: BreakdownNegativeFormat;
}) => (
  <>
    {values.map((value, index) => (
      <AmountCell
        // 列の位置で並びが決まる（列の追加・削除は無い）ため、位置をキーにする。
        key={index}
        value={value}
        kind={kind}
        negativeFormat={negativeFormat}
        isTotalColumn={index === 0}
      />
    ))}
  </>
);

export function PaymentAmountBreakdownTable({
  items,
  ariaLabel,
  className,
  dataSourceColumns = WITH_INVOICE_DATA_SOURCE_COLUMNS,
  negativeFormat,
}: PaymentAmountBreakdownTableProps) {
  return (
    // 表が横に長い場合は、表だけを横スクロールさせる（Table のコンテナが overflow-x-auto）。
    <div className={className}>
      <Table aria-label={ariaLabel} className="w-auto border-collapse">
        {/* 列の区切り線（合計の左＝実線・右＝二重線、データ元別の左＝実線） */}
        <colgroup>
          <col />
          <col />
          {/* 左は1本（二重線は太さが足りないと実線で描かれる）、右は二重線 */}
          <col className="border-l border-r-4 border-double border-slate-500" />
          {TAX_RATE_COLUMNS.map((c) => (
            <col key={c} />
          ))}
          {dataSourceColumns.map((s, i) => (
            <col
              key={s}
              className={
                i === 0 ? 'border-l border-solid border-slate-400' : undefined
              }
            />
          ))}
        </colgroup>
        <TableHeader>
          <TableRow className="border-b-0 hover:bg-transparent">
            <TableHead rowSpan={2} className={HEAD_CLASS}>
              項目
            </TableHead>
            <TableHead rowSpan={2} className={HEAD_CLASS}>
              区分
            </TableHead>
            <TableHead
              rowSpan={2}
              className={cn(HEAD_CLASS, 'min-w-28 text-base')}
            >
              合計
            </TableHead>
            <TableHead
              colSpan={TAX_RATE_COLUMNS.length}
              className={cn(HEAD_CLASS, 'text-xs font-medium text-gray-600')}
            >
              税率別
            </TableHead>
            <TableHead
              colSpan={dataSourceColumns.length}
              className={cn(HEAD_CLASS, 'text-xs font-medium text-gray-600')}
            >
              データ元別
            </TableHead>
          </TableRow>
          <TableRow className="border-b-0 hover:bg-transparent">
            {TAX_RATE_COLUMNS.map((c) => (
              <TableHead key={c} className={cn(HEAD_CLASS, 'min-w-24')}>
                {c}
              </TableHead>
            ))}
            {dataSourceColumns.map((s) => (
              <TableHead key={s} className={cn(HEAD_CLASS, 'min-w-24')}>
                {s}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, itemIndex) => {
            // 請求・支払・差額の行の値（請求書無の請求・差額、センターフィの差額は null＝「-」）。
            const cells = breakdownCellValues(item, dataSourceColumns);
            // 項目の区切り（差額の行の下）。次が金額　計なら二重線、最後の項目は引かない。
            const nextItem = items[itemIndex + 1];
            const separatorClass = !nextItem
              ? 'border-b-0'
              : nextItem.isGrandTotal
                ? ITEM_DOUBLE_SEPARATOR_CLASS
                : ITEM_SEPARATOR_CLASS;
            return KIND_ROWS.map((kind, rowIndex) => (
              <TableRow
                key={`${item.label}-${kind.key}`}
                className={cn(
                  'hover:bg-transparent',
                  kind.bgClass,
                  kind.key === 'diff' ? separatorClass : 'border-b-0'
                )}
              >
                {/* 項目名は3行（請求・支払・差額）をまとめて1セルにする */}
                {rowIndex === 0 && (
                  <TableCell
                    rowSpan={KIND_ROWS.length}
                    className={cn(
                      CELL_BORDER_CLASS,
                      'bg-white px-3 py-1 align-middle font-bold text-gray-900'
                    )}
                  >
                    {item.label}
                  </TableCell>
                )}
                <TableCell
                  className={cn(
                    CELL_BORDER_CLASS,
                    'px-2 py-1 text-center',
                    kind.labelClass
                  )}
                >
                  {kind.label}
                </TableCell>
                <KindCells
                  values={cells[kind.key]}
                  kind={kind.key}
                  negativeFormat={negativeFormat}
                />
              </TableRow>
            ));
          })}
        </TableBody>
      </Table>
    </div>
  );
}
