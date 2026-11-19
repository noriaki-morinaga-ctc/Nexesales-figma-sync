// 計画詳細（NET固定・マージン率固定）の明細表で、2画面とも同じ行の操作
// （ギフトのセット〔上旬・中旬・下旬の3行〕の追加・コピー・更新・取得と、商品区分ごとの行の更新）。
// 行の状態（商品区分ごとの配列）は明細表が持ち、ここでは更新の処理だけを作る。
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { ProductData } from '@/types/salesPlanWholesale';
import {
  GIFT_PERIODS,
  giftPeriodIndex,
  newGiftSetId,
} from '@/utils/sales-plan/common/productCategoryChange';
import { matchesRow } from '@/utils/sales-plan/common/planRowMatch';
import { makeEmptyProduct } from '@/utils/sales-plan/plan-detail/planDetailEmptyRow';

type RowsSetter = Dispatch<SetStateAction<ProductData[]>>;

interface UsePlanDetailRowHandlersArgs {
  // ギフトの行（セットの現在値を取り出すのに使う）
  giftProductsData: ProductData[];
  setRegularProductsData: RowsSetter;
  setNewProductsData: RowsSetter;
  setPromotionProductsData: RowsSetter;
  setGiftProductsData: RowsSetter;
  // 行データを作り直してグリッドへ反映する（明細表の再構築トークンを進める）
  bumpGridRebuild: () => void;
  // 追加・コピーした行の id を受け取り、その行へ移って強調する（useRevealNewRows の markRows → 02 §8・UX-112）
  onRowsAdded?: (ids: string[]) => void;
  // 行の値（計画函数・単価）から社外売上高・売上原価・値入額などを計算し直す（計算のパターンごとの関数）
  recalcRow: (row: ProductData) => ProductData;
}

export function usePlanDetailRowHandlers({
  giftProductsData,
  setRegularProductsData,
  setNewProductsData,
  setPromotionProductsData,
  setGiftProductsData,
  bumpGridRebuild,
  onRowsAdded,
  recalcRow,
}: UsePlanDetailRowHandlersArgs) {
  // ギフト：上旬/中旬/下旬の3行を1セットとして追加（plans=各期間の箱数=計画函数）。
  const handleAddGiftSet = useCallback(
    (base: Partial<ProductData>, plans: [string, string, string]) => {
      const seq = Date.now();
      const newId = newGiftSetId();
      const rows: ProductData[] = GIFT_PERIODS.map((period, i) => ({
        ...makeEmptyProduct('ギフト'),
        ...base,
        section: 'ギフト',
        productCategory: 'ギフト',
        giftSetId: newId,
        period,
        plan: plans[i] ?? '',
        estimate: plans[i] ?? '',
        id: `new-${seq}-${i}`,
        _addedSeq: seq,
        _copySource: 'new' as const,
      })).map(recalcRow);
      // 最下行に追加し、追加した行へ移って強調する（→ 02 §8「行の追加位置」・UX-112）
      onRowsAdded?.(rows.map((r) => String(r.id)));
      setGiftProductsData((prev) => [...prev, ...rows]);
      bumpGridRebuild();
    },
    [bumpGridRebuild, onRowsAdded, setGiftProductsData, recalcRow]
  );
  // ギフト：セットをまるごと複製して新規セット（上旬/中旬/下旬の3行）を追加。
  // handleAddGiftSet と同様だが、行の追加経路をコピー由来（_copySource:'detail'・id=copy-...）とする。
  // sourceSetId（コピー元のセットの giftSetId）を渡すと、表示でコピー元のセットのすぐ下に並ぶ（orderAddedRows）。
  const handleAddCopiedGiftSet = useCallback(
    (
      base: Partial<ProductData>,
      plans: [string, string, string],
      sourceSetId?: string
    ) => {
      const seq = Date.now();
      const newId = newGiftSetId();
      const rows: ProductData[] = GIFT_PERIODS.map((period, i) => ({
        ...makeEmptyProduct('ギフト'),
        ...base,
        section: 'ギフト',
        productCategory: 'ギフト',
        giftSetId: newId,
        period,
        plan: plans[i] ?? '',
        estimate: plans[i] ?? '',
        id: `copy-${seq}-${i}`,
        _addedSeq: seq,
        _copySource: 'detail' as const,
        _copyOf: sourceSetId,
      })).map(recalcRow);
      onRowsAdded?.(rows.map((r) => String(r.id)));
      setGiftProductsData((prev) => [...prev, ...rows]);
      bumpGridRebuild();
    },
    [bumpGridRebuild, onRowsAdded, setGiftProductsData, recalcRow]
  );
  // ギフト：セットの共通項目・各期間の計画(箱数)を更新。
  const handleUpdateGiftSet = useCallback(
    (
      giftSetId: string,
      base: Partial<ProductData>,
      plans: [string, string, string]
    ) => {
      setGiftProductsData((prev) =>
        prev.map((r) => {
          if (r.giftSetId !== giftSetId) return r;
          const idx = giftPeriodIndex(r.period);
          const plan = plans[idx] ?? r.plan;
          return recalcRow({
            ...r,
            ...base,
            section: 'ギフト',
            productCategory: 'ギフト',
            giftSetId,
            period: r.period,
            plan,
            estimate: plan,
          });
        })
      );
      bumpGridRebuild();
    },
    [bumpGridRebuild, setGiftProductsData, recalcRow]
  );
  // ギフト：セットの現在値を取得（編集ペインの初期表示用）。
  const getGiftSet = useCallback(
    (
      giftSetId: string
    ): { base: ProductData; plans: [string, string, string] } | null => {
      const rows = giftProductsData
        .filter((r) => r.giftSetId === giftSetId)
        .sort((a, b) => giftPeriodIndex(a.period) - giftPeriodIndex(b.period));
      if (rows.length === 0) return null;
      return {
        base: rows[0],
        plans: [rows[0]?.plan ?? '', rows[1]?.plan ?? '', rows[2]?.plan ?? ''],
      };
    },
    [giftProductsData]
  );
  // 経費対象（expTarget）のチェックの更新
  const handleUpdateRegularProduct = useCallback(
    (updatedData: ProductData) => {
      setRegularProductsData((prev) =>
        prev.map((item) => (matchesRow(item, updatedData) ? updatedData : item))
      );
    },
    [setRegularProductsData]
  );
  const handleUpdateNewProduct = useCallback(
    (updatedData: ProductData) => {
      setNewProductsData((prev) =>
        prev.map((item) => (matchesRow(item, updatedData) ? updatedData : item))
      );
    },
    [setNewProductsData]
  );
  const handleUpdatePromotionProduct = useCallback(
    (updatedData: ProductData) => {
      setPromotionProductsData((prev) =>
        prev.map((item) => (matchesRow(item, updatedData) ? updatedData : item))
      );
    },
    [setPromotionProductsData]
  );
  const handleUpdateGiftProduct = useCallback(
    (updatedData: ProductData) => {
      setGiftProductsData((prev) =>
        prev.map((item) => (matchesRow(item, updatedData) ? updatedData : item))
      );
    },
    [setGiftProductsData]
  );

  return {
    handleAddGiftSet,
    handleAddCopiedGiftSet,
    handleUpdateGiftSet,
    getGiftSet,
    handleUpdateRegularProduct,
    handleUpdateNewProduct,
    handleUpdatePromotionProduct,
    handleUpdateGiftProduct,
  };
}
