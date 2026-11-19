// 請求EDI取込の行データを、取込一覧と取込結果詳細で共有する Provider。
// 詳細画面の再取込・変換後の値の登録・連携値の修正を一覧にも反映するため、2画面の外で持つ。
// 選んだ取込分は遷移のパラメータ（id）で渡し、詳細画面がこの行データから引き直す（再取込後も表示が古くならない）。
// Next.js へ移すときは支払の layout に置き、中身を API の呼び出し（取得・再取込・登録・修正）に替える。
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import type {
  BillingEdiAssignMasters,
  BillingEdiImportRow,
} from '@/types/billingEdi';
import {
  assignBillingEdiValue,
  correctBillingEdiDetail,
  formatBillingEdiStamp,
  reimportBillingEdiSummary,
} from '@/utils/payment/billing/billingEdiUpdate';

interface BillingEdiContextValue {
  // 取込一覧の行データ
  rows: BillingEdiImportRow[];
  // 再取込の実行（エラーサマリ1件が単位。オンラインで、押した時点で結果が確定する）
  reimportSummary: (rowId: string, summaryId: string) => void;
  // エラーサマリの「変換後の値」の登録
  assignValue: (
    rowId: string,
    summaryId: string,
    assignedValue: string
  ) => void;
  // 形式エラーの値の修正（原本は保持し差分として記録する）
  correctDetail: (
    rowId: string,
    detailId: string,
    field: string,
    corrected: string
  ) => void;
  // 行データを初期状態へ戻す（モックの都合。何度でも同じ操作を試せるようにする。実システムでは行わない）
  reset: () => void;
}

const BillingEdiContext = createContext<BillingEdiContextValue | null>(null);

interface BillingEdiProviderProps {
  // 行データの初期値（モック。実システムでは API から取得する）
  initialRows: BillingEdiImportRow[];
  // 変換後の値を明細へ反映するときに引くマスタ
  masters: BillingEdiAssignMasters;
  // 修正者として記録する操作者（ログインユーザー）
  operator: string;
  children: React.ReactNode;
}

export function BillingEdiProvider({
  initialRows,
  masters,
  operator,
  children,
}: BillingEdiProviderProps) {
  const [rows, setRows] = useState<BillingEdiImportRow[]>(initialRows);

  const reimportSummary = useCallback(
    (rowId: string, summaryId: string) => {
      const now = formatBillingEdiStamp(new Date());
      setRows((prev) =>
        reimportBillingEdiSummary(
          prev,
          rowId,
          summaryId,
          now,
          operator,
          masters
        )
      );
    },
    [masters, operator]
  );

  const assignValue = useCallback(
    (rowId: string, summaryId: string, assignedValue: string) => {
      setRows((prev) =>
        assignBillingEdiValue(prev, rowId, summaryId, assignedValue)
      );
    },
    []
  );

  const correctDetail = useCallback(
    (rowId: string, detailId: string, field: string, corrected: string) => {
      const now = formatBillingEdiStamp(new Date());
      setRows((prev) =>
        correctBillingEdiDetail(
          prev,
          rowId,
          detailId,
          field,
          corrected,
          now,
          operator
        )
      );
    },
    [operator]
  );

  const reset = useCallback(() => setRows(initialRows), [initialRows]);

  const value = useMemo(
    () => ({ rows, reimportSummary, assignValue, correctDetail, reset }),
    [rows, reimportSummary, assignValue, correctDetail, reset]
  );

  return (
    <BillingEdiContext.Provider value={value}>
      {children}
    </BillingEdiContext.Provider>
  );
}

// 請求EDI取込の行データと更新の処理を返す（BillingEdiProvider の中で使う）
export function useBillingEdi(): BillingEdiContextValue {
  const value = useContext(BillingEdiContext);
  if (!value) {
    throw new Error('useBillingEdi は BillingEdiProvider の中で使う');
  }
  return value;
}
