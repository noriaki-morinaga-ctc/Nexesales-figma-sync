// 支払詳細(追加口請求書有)：追加口明細と拡売費「未承認NET」の明細の連動。
//
// 追加口明細の拡売費金額（NET未承認）は、同じサマリ商品の合計を未承認NETの明細の支払金額に入れる
//（→ 補足1-5 b21.t26）。追加口カードが連動データ（NetUnapprovedLink）を作り、拡売費カードが
// 未承認NETの明細へ当てる。
//   ・支払金額 … 同じサマリ商品の拡売費金額の合計（支払金額を手で入れた明細は除く）
//   ・データ元 … 振り替えた追加口明細のデータ元に従う。差を出した追加口明細が手入力なら（明細追加・
//                手で直した明細）、未承認NETの明細も手入力にする（利用者の決定 2026-10-03）。
//                いったん手入力になったら戻さない（手で直した明細の決まりと同じ）
//   ・支払回数 … 連動データは支払回数つきで渡す。支払回数を切り替えた直後に前の回の連動データが
//                届いても、別の回のデータは当てない
import { DEFAULT_DATA_SOURCE, type DataSource } from '../../../constants/dataSource';
import { markManualEdit } from './paymentDataSource';

// 連動データに使う追加口明細の項目。
export interface NetLinkEntryRow {
  isTotal?: boolean;
  productName: string;
  expAmount: number | string; // 拡売費金額（NET未承認）
  dataSource?: DataSource;
  originDataSource?: DataSource;
}

// 連動データに当てる拡売費明細の項目。
export interface NetLinkExpenseRow {
  isGroup?: boolean;
  isTotal?: boolean;
  isNetUnapproved?: boolean;
  payAmountManual?: boolean;
  product: string;
  payAmount: number | string;
  dataSource?: DataSource;
  originDataSource?: DataSource;
}

// 追加口カードから拡売費カードへ渡す連動データ。
export interface NetUnapprovedLink {
  total: number; // 拡売費金額（NET未承認）の合計
  byProduct: Record<string, number>; // サマリ商品ごとの拡売費金額（NET未承認）の合計
  // 拡売費金額（NET未承認）が0でない手入力の追加口明細を持つサマリ商品
  manualProducts: string[];
  // どの支払回数の追加口明細から作ったか（画面が付ける）
  round?: string;
}

const amountOf = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// 追加口明細から連動データを作る。
export const netUnapprovedLinkOf = (
  entryRows: readonly NetLinkEntryRow[],
  round?: string
): NetUnapprovedLink => {
  let total = 0;
  const byProduct: Record<string, number> = {};
  const manual = new Set<string>();
  for (const row of entryRows) {
    if (row.isTotal) continue;
    const amount = amountOf(row.expAmount);
    total += amount;
    const name = String(row.productName ?? '');
    if (!name) continue;
    byProduct[name] = (byProduct[name] ?? 0) + amount;
    if (amount !== 0 && row.dataSource === DEFAULT_DATA_SOURCE)
      manual.add(name);
  }
  return { total, byProduct, manualProducts: [...manual], round };
};

// 連動データが、表示中の支払回数のものか。
export const isNetLinkForRound = (
  link: NetUnapprovedLink | undefined,
  round: string | undefined
): link is NetUnapprovedLink => !!link && link.round === round;

// 未承認NETの明細のデータ元（モックの明細を作るとき）。差を出した追加口明細のうち、
// 手入力の明細があれば手入力（元のデータ元つき）、無ければ最初の明細のデータ元。
export const netRowDataSourceOf = (
  sourceRows: readonly NetLinkEntryRow[]
): Pick<NetLinkExpenseRow, 'dataSource' | 'originDataSource'> => {
  const manual = sourceRows.find((r) => r.dataSource === DEFAULT_DATA_SOURCE);
  if (manual) {
    return manual.originDataSource
      ? {
          dataSource: DEFAULT_DATA_SOURCE,
          originDataSource: manual.originDataSource,
        }
      : { dataSource: DEFAULT_DATA_SOURCE };
  }
  return { dataSource: sourceRows[0]?.dataSource };
};

// 連動データを未承認NETの明細へ当てる（行オブジェクトを書き換える）。
// データ元が手入力に変わった明細を返す。
export const linkNetUnapprovedRows = <T extends NetLinkExpenseRow>(
  rows: readonly T[],
  link: NetUnapprovedLink
): T[] => {
  const changed: T[] = [];
  for (const row of rows) {
    if (!row.isNetUnapproved || row.isGroup || row.isTotal) continue;
    const product = String(row.product);
    // 支払金額を手で入れた明細は、入力値を保持する（連動で上書きしない）。
    if (!row.payAmountManual) {
      const amount = link.byProduct[product];
      if (amount != null) row.payAmount = amount;
    }
    if (link.manualProducts.includes(product) && markManualEdit(row)) {
      changed.push(row);
    }
  }
  return changed;
};

// 連動データのうち、未承認NETの明細がまだ無いサマリ商品（明細を足す対象）。
// 別の支払回数の連動データ（切替の直後に届く前の回の値）からは足さない。
export const missingNetProducts = (
  link: NetUnapprovedLink | undefined,
  round: string | undefined,
  knownProducts: ReadonlySet<string>
): [string, number][] =>
  isNetLinkForRound(link, round)
    ? Object.entries(link.byProduct).filter(
        ([product, amount]) => amount !== 0 && !knownProducts.has(product)
      )
    : [];
