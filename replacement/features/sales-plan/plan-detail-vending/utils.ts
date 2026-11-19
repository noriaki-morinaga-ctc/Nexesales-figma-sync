// 計画詳細(自販機)：画面の状態に依存しない処理（計算式の解析・セルの位置の変換・ヘッダーの差分・行の書式など）
import {
  GRID_COLORS,
  totalCellStyle,
  GRID_EMPTY_TEXT,
} from '@/components/grid';
import { PREV_YEAR_SHIPPING_WORKING_DAYS } from '@/mocks/sales-plan/plan-detail-vending/salesPlan';
import {
  EXPENSE_BRANCH_NAMES,
  EXPENSE_RATIO_BASE,
  HIGHLIGHT_TRIGGER_FIELDS,
} from './constants';

// 経費計画表の数値をカンマ区切りで整形するヘルパー（"－"等は変換しない）
// 指定した桁数で四捨五入する汎用関数
export const round = (value: number, decimals: number = 0): number => {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

// 比率(%)を小数第1位まで表示する文字列に整形（小数第2位を四捨五入）。
// 計算結果・表示の共通整形に用いる（末尾の "%" は呼び出し側で付与）。
export const formatDecimal1 = (value: number): string =>
  (Math.round(value * 10) / 10).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

export const formatExpenseNumber = (value: any): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str === '－' || str === '' || str === 'xx') return str;
  const num = parseFloat(str.replace(/,/g, ''));
  if (isNaN(num)) return str;
  return Math.round(num).toLocaleString();
};

// 列文字 → 数値インデックス（A=1, B=2, ... Z=26, AA=27 ...）
export const colLetterToIndex = (col: string): number => {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + (col.charCodeAt(i) - 64);
  }
  return index;
};

// 数値インデックス → 列文字
export const indexToColLetter = (index: number): string => {
  let col = '';
  while (index > 0) {
    const rem = (index - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    index = Math.floor((index - 1) / 26);
  }
  return col;
};

// Excel形式のセル参照（例：B2、C3、B3:B7、H2:N2）をパースする関数
// 同一列範囲・同一行範囲・矩形範囲すべてに対応
export const parseFormulaReferences = (formula: string): string[] => {
  if (!formula) return [];

  const allRefs: string[] = [];

  // 範囲表記（例：B3:B7、H2:N2、H3:K6）を検出して展開
  const rangeMatches = formula.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/g);
  if (rangeMatches) {
    rangeMatches.forEach((range) => {
      const parts = range.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
      if (parts) {
        const startColIdx = colLetterToIndex(parts[1]);
        const startRow = parseInt(parts[2], 10);
        const endColIdx = colLetterToIndex(parts[3]);
        const endRow = parseInt(parts[4], 10);
        for (let c = startColIdx; c <= endColIdx; c++) {
          for (let r = startRow; r <= endRow; r++) {
            allRefs.push(`${indexToColLetter(c)}${r}`);
          }
        }
      }
    });
  }

  // 単独のセル参照（例：B2、C3）を検出（範囲表記以外）
  const formulaWithoutRanges = formula.replace(/[A-Z]+\d+:[A-Z]+\d+/g, '');
  const singleMatches = formulaWithoutRanges.match(/[A-Z]+\d+/g);
  if (singleMatches) {
    allRefs.push(...singleMatches);
  }

  return allRefs;
};

// Excel形式のセル参照をAG Gridの行・カラムIDに変換
export const excelRefToCellId = (
  ref: string
): { rowIndex: number; colId: string } | null => {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;

  const col = match[1];
  const row = parseInt(match[2], 10);

  // 列の対応付け（B=col1, C=col2, など）
  const colMap: Record<string, string> = {
    A: 'category',
    B: 'col1',
    C: 'col2',
    D: 'col3',
    E: 'col4',
    F: 'col5',
    G: 'col6',
    H: 'col7',
    I: 'col8',
    J: 'col9',
    K: 'col10',
    L: 'col11',
    M: 'col12',
    N: 'col13',
    O: 'col14',
    P: 'col15',
    Q: 'col16',
    R: 'col17',
    S: 'col18',
    T: 'col19',
    U: 'col20',
    V: 'col21',
    W: 'col22',
    X: 'col23',
    Y: 'col24',
    Z: 'col25',
    AA: 'col26',
    AB: 'col27',
  };

  const colId = colMap[col];
  if (!colId) return null;

  // 行番号の変換（Excel行2 = AG Grid rowIndex 0）
  const rowIndex = row - 2;

  return { rowIndex, colId };
};

// 経費計画グリッド用のExcelセル参照 → AG Grid ID変換（経費表のカラム対応）
export const expenseExcelRefToCellId = (
  ref: string
): { rowIndex: number; colId: string } | null => {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const col = match[1];
  const row = parseInt(match[2], 10);
  // 転置後のカラム対応（行=経費項目、列=拠点/区分）
  const colMap: Record<string, string> = {
    A: 'category',
    B: 'catPlan', // 計画金額
    C: 'catHonsha', // 本社
    D: 'catShishaA', // 支社A　自販機部門
    E: 'catShishaBKyotsu', // 支社B　自販機(共通)
    F: 'catShishaBKaitaku', // 支社B　開発(開拓)
    G: 'catZengetsuJisseki', // 前月実績
    H: 'catZengetsuHi', // 前月比
    I: 'catYosan', // 予算
    J: 'catYosanHi', // 予算比
    K: 'catZennenJisseki', // 前年同月実績
    L: 'catZennenHi', // 前年同月比
  };
  const colId = colMap[col];
  if (!colId) return null;
  const rowIndex = row - 2; // Excel行2 = rowIndex 0
  return { rowIndex, colId };
};

// 経費計画の数式を、項目名ベースの説明文として返す
// （販売計画表と同様の tooltipValueGetter ロジック）。数式が無いセルは null。
export const expenseFormulaDesc = (
  rowIndex: number,
  field: string,
  data: any
): string | null => {
  if (!data?.[`${field}_formula`]) return null;
  // 比率列（前月比/予算比/前年同月比）
  if (EXPENSE_RATIO_BASE[field]) {
    const op = String(data[`${field}_formula`]).includes('/') ? '÷' : '−';
    return `数式: 計画金額 ${op} ${EXPENSE_RATIO_BASE[field]}`;
  }
  // 拠点列（前払金(償却)行=12 は子行の合計、経費金額合計行=0 はその他経費の合算）
  if (EXPENSE_BRANCH_NAMES[field]) {
    if (rowIndex === 12) {
      return `数式: ロケ契約中 + ロケ契約見込（${EXPENSE_BRANCH_NAMES[field]}）`;
    }
    return `数式: オペ協力金 + その他一時費用 + ロケ契約料 + ロケ契約料他前払い金(償却)（${EXPENSE_BRANCH_NAMES[field]}）`;
  }
  // 経費金額合計行（rowIndex 0）の前月実績・予算・前年同月実績は計画金額と同じ集計式を表示
  if (
    rowIndex === 0 &&
    (field === 'catZengetsuJisseki' ||
      field === 'catYosan' ||
      field === 'catZennenJisseki')
  ) {
    return '数式: 条件口 + ロケ運転費 + その他経費（オペ協力金・一時費用・ロケ契約料等）の合計';
  }
  // 条件口行（rowIndex 2）の前月実績・予算・前年同月実績は計画金額と同じ集計式を表示
  if (
    rowIndex === 2 &&
    (field === 'catZengetsuJisseki' || field === 'catZennenJisseki')
  ) {
    return '数式: オペ条件口 + 帳合料 + オペ金銭口/オペ条件口(手出票)';
  }
  // 条件口率行（rowIndex 6）の予算＝条件口 ÷ 商流販売店計の予算金額
  if (rowIndex === 6 && field === 'catYosan') {
    return '数式: 条件口 ÷ 商流販売店計の予算';
  }
  // 条件口率行（rowIndex 6）の前年同月実績＝条件口 ÷ 商流販売店計の前年実績
  if (rowIndex === 6 && field === 'catZennenJisseki') {
    return '数式: 条件口 ÷ 商流販売店計の前年実績';
  }
  // 条件口率行（rowIndex 6）の前月実績＝条件口 ÷ 前月の社外売上高
  if (rowIndex === 6 && field === 'catZengetsuJisseki') {
    return '数式: 条件口 ÷ 前月の社外売上高';
  }
  // ロケ運転費行（rowIndex 7）の実績は数式を削除し固定値のため数式表示なし
  // ロケ運転費率行（rowIndex 8）の前月実績＝ロケ運転費 ÷ 前月の社外売上高
  if (rowIndex === 8 && field === 'catZengetsuJisseki') {
    return '数式: ロケ運転費 ÷ 前月の社外売上高';
  }
  // ロケ運転費率行（rowIndex 8）の予算＝ロケ運転費 ÷ 商流販売店計の予算
  if (rowIndex === 8 && field === 'catYosan') {
    return '数式: ロケ運転費 ÷ 商流販売店計の予算';
  }
  // ロケ運転費率行（rowIndex 8）の前年同月実績＝ロケ運転費 ÷ 商流販売店計の前年実績
  if (rowIndex === 8 && field === 'catZennenJisseki') {
    return '数式: ロケ運転費 ÷ 商流販売店計の前年実績';
  }
  // 計画金額列
  if (field === 'catPlan') {
    switch (rowIndex) {
      case 0:
        return '数式: 条件口 + ロケ運転費 + その他経費（オペ協力金・一時費用・ロケ契約料等）の合計';
      case 2:
        return '数式: オペ条件口 + 帳合料 + オペ金銭口/オペ条件口(手出票)';
      case 3:
        return '数式: 商流販売店計の当月計画 × オペ条件口率';
      case 4:
        return '数式: 商流販売店計の当月計画 × 帳合料率';
      case 6:
        return '数式: 条件口 ÷ 商流販売店計の当月計画';
      case 7:
        return '数式: 商流販売店計の当月計画 × ロケ運転費率';
      case 9:
      case 10:
      case 11:
      case 12:
      case 13:
      case 14:
        return '数式: 本社 + 支社A + 支社B共通 + 支社B開拓';
    }
  }
  return null;
};

// セルクリック時のハンドラー
// ヘッダー項目が影響を受けるかを判定する共通関数
export const computeHeaderDependents = (
  startKey: string,
  visited: string[]
): Set<string> => {
  const headers = new Set<string>();
  const all = new Set([startKey, ...visited]);

  // 出荷稼働日前年比 = 出荷稼働日 ÷ 前年出荷稼働日 → そのいずれかが起点のとき影響を受ける
  if (all.has('0-col17') || all.has('0-col27')) {
    headers.add('shukkaYoyRatio');
  }

  // 社外売上高/当月進捗率 = col4/col6Total*100 → col4 or col6(rows1-5) が依存セットに含まれるとき
  const affectsProgress =
    all.has('0-col4') || [1, 2, 3, 4, 5].some((ri) => all.has(`${ri}-col6`));
  if (affectsProgress) headers.add('progressRate');

  return headers;
};

// クリックしたセルの数式が参照しているグリッド外ヘッダー項目を返す（緑ハイライト用）。
// 専用機PM/提携機PC（col11）は「前年PM/PC × 出荷稼働日前年比 × 直近変動率 …」の数式のため、
// グリッド内の参照セルに加えて出荷稼働日前年比も参照元として強調する。
export const computeHeaderRefs = (
  rowIndex: number,
  field?: string
): Set<string> => {
  const headers = new Set<string>();
  if (field === 'col11' && [1, 2, 3].includes(rowIndex)) {
    headers.add('shukkaYoyRatio');
  }
  return headers;
};

// BFS ユーティリティ
export const bfs = (
  startKeys: string[],
  reverseMap: Map<string, Set<string>>
): Set<string> => {
  const visited = new Set<string>();
  const queue = [...startKeys];
  startKeys.forEach((k) => visited.add(k));
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const deps = reverseMap.get(cur);
    if (!deps) continue;
    deps.forEach((dep) => {
      if (!visited.has(dep)) {
        visited.add(dep);
        queue.push(dep);
      }
    });
  }
  return visited;
};

// 単価(col18)の値を求める共通関数。数式(=base*T2)がある行は
// 「基準函単価(base) × 商流販売店計の価格改定率(row0 col19)」を計算し、
// 手入力で数式が無い行は入力値(col18)をそのまま返す。
// 当月計画(col1 = 合計函数 × 単価)など、グリッド外からも同じ単価を参照するため共通化。
export const computeSalesCol18 = (rowData: any, row0Data: any): number => {
  if (rowData?.col18_formula) {
    const m = String(rowData.col18_formula).match(/=\s*([\d.]+)\s*\*/);
    const base = m ? parseFloat(m[1]) : 0;
    const rateRaw = parseFloat(
      String(row0Data?.col19 ?? '0').replace(/[%,]/g, '')
    );
    const rate = isNaN(rateRaw) ? 0 : rateRaw / 100;
    return Math.round(base * rate);
  }
  return parseFloat(String(rowData?.col18 ?? '0').replace(/,/g, '')) || 0;
};

export const computeSalesPlanCol1 = (salesData: any[]): number => {
  const row0 = salesData[0];
  if (!row0) return 0;
  if (!row0.col1_formula) {
    return parseFloat(String(row0.col1 || '0').replace(/,/g, '')) || 0;
  }
  const col17 = parseFloat(String(row0.col17 || '0').replace(/,/g, ''));
  const col16Ratio = isNaN(col17) ? 0 : col17 / PREV_YEAR_SHIPPING_WORKING_DAYS;
  let total = 0;
  for (let i = 1; i <= 5; i++) {
    const d = salesData[i];
    if (!d) continue;
    if (d.col1_formula) {
      let col6: number;
      if (d.col6_formula && i >= 1 && i <= 3) {
        const c13 =
          parseFloat(String(d.col13 || '0').replace(/[%,]/g, '')) / 100;
        const c12 =
          i === 3
            ? 1
            : parseFloat(String(d.col12 || '0').replace(/[%,]/g, '')) / 100;
        const c15 = parseFloat(
          String(d.col15 || '0')
            .replace(/[%,+]/g, '')
            .replace(/▲/g, '-')
        );
        const c9 = parseFloat(String(d.col9 || '0').replace(/,/g, ''));
        if (c9 === 0) {
          col6 = 0;
        } else {
          let c11 = 0,
            c14 = 0;
          if (i === 1) {
            c11 = 950 * c13 * c12 * col16Ratio;
            c14 = round(2000 + c15, 0);
          } else if (i === 2) {
            c11 = 15 * c13 * c12 * col16Ratio;
            c14 = round(1000 + c15, 0);
          } else {
            c11 = 21 * c13 * col16Ratio;
            c14 = parseFloat(String(d.col14 || '0').replace(/,/g, '')) || 0;
          }
          col6 = round(c11 * c14, 0) / c9;
        }
      } else {
        col6 = parseFloat(String(d.col6 || '0').replace(/,/g, '')) || 0;
      }
      // 単価(col18)は数式値（base × 価格改定率）を用いる
      const c18 = computeSalesCol18(d, salesData[0]);
      const c20 = parseFloat(String(d.col20 || '0').replace(/,/g, '')) || 0;
      total += i === 3 ? col6 * c18 + c20 : col6 * c18;
    } else {
      total += parseFloat(String(d.col1 || '0').replace(/,/g, '')) || 0;
    }
  }
  return total;
};

// 差分表示用ヘルパー: { text, color } を返す
export const calcHeaderDiff = (
  current: number,
  baseline: number,
  isPercent = false,
  oneDecimal = false
): { text: string; color: string } => {
  const diff = oneDecimal
    ? Math.round((current - baseline) * 10) / 10
    : Math.round(current - baseline);
  const fmt = (n: number) => (oneDecimal ? formatDecimal1(n) : String(n));
  if (diff === 0)
    return {
      text: isPercent
        ? oneDecimal
          ? '±0.0%'
          : '±0%'
        : oneDecimal
          ? '±0.0'
          : '±0',
      color: GRID_COLORS.neutralText,
    };
  if (diff > 0)
    return {
      text: isPercent ? `+${fmt(diff)}%` : `+${fmt(diff)}`,
      color: GRID_COLORS.increaseText,
    };
  return {
    text: isPercent ? `▲${fmt(Math.abs(diff))}%` : `▲${fmt(Math.abs(diff))}`,
    color: GRID_COLORS.decreaseText,
  };
};

// 商流販売店計（row 0）の合計函数（col6）= 子行(専用機〜出荷実販差)の col6 合計。
// グリッド外（valueGetter 以外）から「商流販売店計の合計函数」を参照するための共通関数。
export const computeSalesPlanCol6 = (salesData: any[]): number => {
  const r0 = salesData[0];
  const col17 = parseFloat(String(r0?.col17 || '0').replace(/,/g, '')) || 0;
  const col16 = col17 / PREV_YEAR_SHIPPING_WORKING_DAYS;
  let col6Total = 0;
  for (let i = 1; i <= 5; i++) {
    const row = salesData[i];
    if (!row) continue;
    if (row.col6_formula && i >= 1 && i <= 3) {
      const col13 =
        parseFloat(String(row.col13 || '0').replace(/[%,]/g, '')) / 100;
      const col12 =
        i === 3
          ? 1
          : parseFloat(String(row.col12 || '0').replace(/[%,]/g, '')) / 100;
      const col15 = parseFloat(
        String(row.col15 || '0')
          .replace(/[%,+]/g, '')
          .replace(/▲/g, '-')
      );
      const col9 = parseFloat(String(row.col9 || '0').replace(/,/g, ''));
      if (col9 !== 0) {
        let col11 = 0,
          col14 = 0;
        if (i === 1) {
          col11 = 950 * col13 * col12 * col16;
          col14 = round(2000 + col15, 0);
        } else if (i === 2) {
          col11 = 15 * col13 * col12 * col16;
          col14 = round(1000 + col15, 0);
        } else if (i === 3) {
          col11 = 21 * col13 * col16;
          col14 = parseFloat(String(row.col14 || '0').replace(/,/g, '')) || 0;
        }
        col6Total += round(col11 * col14, 0) / col9;
      }
    } else {
      col6Total += parseFloat(String(row.col6 || '0').replace(/,/g, '')) || 0;
    }
  }
  return col6Total;
};

// 差分/実数表示に関わらず「編集可能セル」かどうかを返す（ハイライト起点判定用）
export const isCellTrigger = (rowIndex: number, field: string) => {
  if (rowIndex === 0 && field === 'col17') return true;
  if (
    rowIndex === 1 &&
    (field === 'col12' || field === 'col15' || field === 'col18')
  )
    return true;
  if (
    rowIndex === 2 &&
    (field === 'col12' || field === 'col15' || field === 'col18')
  )
    return true;
  if (rowIndex === 4 && (field === 'col6' || field === 'col18')) return true;
  if (rowIndex === 5 && (field === 'col6' || field === 'col18')) return true;
  return false;
};

export const isHighlightTrigger = (rowIndex: number, field: string) => {
  if (isCellTrigger(rowIndex, field)) return true;
  // アライアンス品（rowIndex 3）の函単価（col18）を起点に追加
  if (rowIndex === 3 && field === 'col18') return true;
  if (rowIndex < 0 || rowIndex > 5) return false;
  return HIGHLIGHT_TRIGGER_FIELDS.has(field);
};

// 行のスタイルを取得する関数
export const getRowStyle = (params: any) => {
  // 合計行（rowIndex === 0）の場合
  if (!params.node?.rowPinned && params.node?.rowIndex === 0) {
    return {
      ...totalCellStyle(),
      fontWeight: 'bold',
    };
  }
  return undefined;
};

// 前年比などの比率(%)を小数第1位まで表示（小数第2位を四捨五入）。
// 値が無い（空・"－"）ときは半角「-」、非数値はそのまま返す。AG Grid の valueFormatter で使用。
export const formatRatioDecimal1 = (value: unknown): string => {
  if (value === null || value === undefined) return GRID_EMPTY_TEXT;
  const str = String(value);
  if (str === '' || str === '－') return GRID_EMPTY_TEXT;
  const num = parseFloat(str.replace(/[,%\s]/g, ''));
  if (isNaN(num)) return str;
  return (
    (Math.round(num * 10) / 10).toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + '%'
  );
};
