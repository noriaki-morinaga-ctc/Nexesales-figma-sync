import { ChevronRight, Plus } from 'lucide-react';
import {
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  ColGroupDef,
  FilterChangedEvent,
  GridApi,
  RowClassParams,
} from 'ag-grid-community';

import { toast } from 'sonner';

import {
  viewportGridHeight,
  GRID_DEFAULT_COL_DEF,
  GRID_WRAP_HEADER_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  gridFilterContextMenuItems,
  GRID_COLORS,
  formatEmptyAsDash,
  useFormulaSourceHighlight,
  useGridColumnState,
  CopySourceLegend,
  withHeaderTooltips,
  withSpanSafeHeaderHeight,
  useChangedCells,
  useLinkedCellUndo,
  asRowStyle,
  useRevealNewRows,
} from '@/components/grid';
import {
  orderAddedRows,
  productRowBlockKey,
} from '@/utils/common/addedRowOrder';

import { planDetailTotalRatesOf } from '@/utils/sales-plan/plan-detail/planDetailTotalRates';

import {
  PlanBulkActionsMenu,
  PlanRateMenu,
  PlanRelatedScreensMenu,
} from '@/features/sales-plan/shared/plan-detail/PlanDetailHeaderMenus';
import { HeaderDivider } from '@/components/shared/common/HeaderDivider';
import { Input } from '@/components/ui/input';

import { PlanCopyPane } from '@/features/sales-plan/shared/plan-detail/PlanCopyPane';
import type { SalesPlanCopyResult } from '@/features/sales-plan/shared/plan-detail/PlanCopyPane';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  REGULAR_PRODUCTS_DATA,
  NEW_PRODUCTS_DATA,
  PROMOTION_PRODUCTS_DATA,
  GIFT_PRODUCTS_DATA,
} from '@/mocks/sales-plan/plan-detail-net-fixed';
import type { ProductData } from '@/types/salesPlanWholesale';

import { CATEGORY_LABELS_NET } from '@/constants/promotionCategories';
import { getPromotionLabels } from '@/utils/sales-plan/common/promotionCategories';

import {
  PLAN_DETAIL_DIGITS,
  formatPlanRate,
} from '@/utils/sales-plan/common/planDetailNumberFormat';
import { currentMonthEstimate } from '@/utils/sales-plan/plan-detail/currentMonthEstimate';
import {
  buildCategoryChangeRows,
  newGiftSetId,
} from '@/utils/sales-plan/common/productCategoryChange';

import { FORM_LABEL_CLASS, TEXT_INPUT_CLASS } from '@/styles/commonStyles';
import { heldRowKeyOf } from '@/utils/sales-plan/simulation/heldCategoryRows';

import {
  withRowId,
  giftRowSpan,
  costUnitPriceOf,
  recalcGiftLikeRates,
  WHOLESALE_FORMULA_DEFS,
} from '@/features/sales-plan/plan-detail-net-fixed/utils';
import { buildDetailColumnDefs } from '@/features/sales-plan/plan-detail-net-fixed/utilsDetailColumns';
import { usePlanDetailRowHandlers } from '@/features/sales-plan/shared/plan-detail/usePlanDetailRowHandlers';
import { makeEmptyProduct } from '@/utils/sales-plan/plan-detail/planDetailEmptyRow';
import { CHAIN_STORES } from '@/mocks/common/chainStore';
import { SegmentToggle } from '@/components/shared/common/SegmentToggle';

export interface DetailTableHandle {
  addCopiedRow: (data: ProductData) => void;
  // 明細追加：フォーム値から新規行を生成し、最下行へ追加
  addNewRow: (overrides: Partial<ProductData> & { section: string }) => void;
  // 明細削除：一意な id で対象行を表から除去
  deleteRow: (target: ProductData | string) => void;
  // ギフト以外の明細編集を id 一致で更新（商品区分＝section で対象配列を選択）
  updateRow: (data: ProductData) => void;
  // ギフト：上旬/中旬/下旬の3行を1セットとして追加（plans=各期間の箱数=計画函数）
  addGiftSet: (
    base: Partial<ProductData>,
    plans: [string, string, string]
  ) => void;
  // ギフト：セットをまるごと複製して新規セット（3行）を追加（コピー由来）
  addCopiedGiftSet: (
    base: Partial<ProductData>,
    plans: [string, string, string]
  ) => void;
  // ギフト：セットの共通項目・各期間の計画(箱数)を更新
  updateGiftSet: (
    giftSetId: string,
    base: Partial<ProductData>,
    plans: [string, string, string]
  ) => void;
  // ギフト：セットの現在値を取得（編集ペインの初期表示用）
  getGiftSet: (
    giftSetId: string
  ) => { base: ProductData; plans: [string, string, string] } | null;
  // 計画保存時：明細コピー・明細追加の帯と編集セルの強調を消し、未保存状態を解除する
  clearSavedMarks: () => void;
}

interface DetailTableProps {
  onOpenFixedMargin?: () => void;
  onOpenAddDetail?: (section: string) => void;
  onDeleteDetail?: (data: ProductData) => void;
  onOpenAnnualContract?: () => void;
  onOpenCenterFee?: () => void;
  onOpenWholesaleIncentive?: () => void;
  // 前月計画コピー右ペイン。他の右ペインと排他表示するため開閉は親が管理する。
  copyPaneOpen?: boolean;
  onOpenCopyPane?: () => void;
  onCloseCopyPane?: () => void;
  // 各ペインで設定した値。**単位を含んだ表示用文字列**（率は `8.70%`、直接入力の金額は `123,000円`）。
  // 金額に「%」を付けないため、単位は渡す側で付与する。
  annualContractAvg?: string;
  centerFeeAvg?: string;
  wholesaleIncentiveAvg?: string;
  // 年間計画／シミュレーションへの画面遷移コールバック
  onNavigate?: (menuId: string) => void;
  // 年間計画・シミュレーションのボタンを非活性にするか（取引制度を変更した後の対象年月）
  isPlanNavigationDisabled?: boolean;
  // グリッドの全明細行が変わったときに親へ通知する（販売計画(集計)の算出元）。
  // 親側は必ず useCallback で安定化したハンドラを渡すこと（毎レンダリング再生成すると無限ループになる）。
  onRowsChange?: (rows: ProductData[]) => void;
  // 見出しの行の先頭に置く「販売計画(詳細)｜拡売費計画」の切替（親が持つ。UX-106）
  sectionSwitch?: React.ReactNode;
}

export const DetailTable = forwardRef<DetailTableHandle, DetailTableProps>(
  function DetailTable(
    {
      onOpenAddDetail,
      onDeleteDetail,
      onOpenAnnualContract,
      onOpenCenterFee,
      onOpenWholesaleIncentive,
      copyPaneOpen = false,
      onOpenCopyPane,
      onCloseCopyPane,
      annualContractAvg = '0.00%',
      centerFeeAvg = '0.00%',
      wholesaleIncentiveAvg = '0.00%',
      onNavigate,
      isPlanNavigationDisabled = false,
      onRowsChange,
      sectionSwitch,
    },
    ref
  ) {
    // 計算式セルのクリック中、算出元セルの枠線を強調するフック。
    const formulaHL = useFormulaSourceHighlight<ProductData>(
      WHOLESALE_FORMULA_DEFS,
      { isEligibleRow: (r) => !r._isHeader && r.metaBrand !== '合計' }
    );

    // 保存時に編集セルの強調を消す（値は変わらないため再描画を明示する）ためのAPI
    const gridApiRef = useRef<GridApi | null>(null);

    // 列状態（列幅・並び順・ソート・固定・表示）を localStorage へ永続化。
    // 復元後に既存の onGridReady（計算式ハイライト用のAPI捕捉）を連結実行する。
    const gridColumnStateProps = useGridColumnState(
      'Wholesale.detailTable.columnState',
      {
        onGridReady: (p: any) => {
          formulaHL.captureApi(p.api);
          gridApiRef.current = p.api;
        },
      }
    );

    // セル編集による未保存状態を保持（画面遷移時のアラート判定に使用）
    const hasUnsavedRef = useRef(false);

    // 追加・コピーした行へなめらかに移り、左端の帯の色を薄くした色で1秒強調する（→ 02 §8「行の追加位置」・UX-112）
    const reveal = useRevealNewRows({ scrollPosition: 'nearest' });

    // 編集セルの変更ハイライト（黄＋オレンジ枠）の追跡・判定（共通フック → 02 §7.2）。
    // 元値に戻したら強調を解除し、計画保存時に resetChangedCells でクリアする。
    // 本画面は列ごとの cellStyle で isCellChanged を参照して強調色を付ける。
    const { isCellChanged, trackCellChange, resetChangedCells } =
      useChangedCells();

    // 未保存があれば確認のうえ画面遷移する共通ハンドラ
    // 年間計画／シミュレーションへの遷移は確認ダイアログで「入力中のデータがリセット
    // される」旨を確認してから遷移する。
    const [pendingNavMenuId, setPendingNavMenuId] = useState<string | null>(
      null
    );
    const handleNavigateWithGuard = (menuId: string) => {
      setPendingNavMenuId(menuId);
    };

    // 明細データ（グリッドの行）の状態
    // 初期表示時から社外売上高・売上原価等が算出値になるよう、各行に
    // recalcGiftLikeRates を1度通す（recalcGiftLikeRates はモジュールスコープの純関数）。
    const [regularProductsData, setRegularProductsData] = useState<
      Array<ProductData>
    >(() => withRowId(REGULAR_PRODUCTS_DATA, 'reg').map(recalcGiftLikeRates));

    const [newProductsData, setNewProductsData] = useState<ProductData[]>(() =>
      withRowId(NEW_PRODUCTS_DATA, 'new').map(recalcGiftLikeRates)
    );

    const [promotionProductsData, setPromotionProductsData] = useState<
      Array<ProductData>
    >(() =>
      withRowId(PROMOTION_PRODUCTS_DATA, 'promo').map(recalcGiftLikeRates)
    );

    const [giftProductsData, setGiftProductsData] = useState<
      Array<ProductData>
    >(() => withRowId(GIFT_PRODUCTS_DATA, 'gift').map(recalcGiftLikeRates));

    // 販売計画(集計)へ渡す全明細行。4つの商品区分タブの行をまとめる。
    const allProductRows = useMemo(
      () => [
        ...regularProductsData,
        ...newProductsData,
        ...promotionProductsData,
        ...giftProductsData,
      ],
      [
        regularProductsData,
        newProductsData,
        promotionProductsData,
        giftProductsData,
      ]
    );

    // 明細行が変わるたびに親へ通知する（集計値をグリッドの現在値へ追従させる）
    useEffect(() => {
      onRowsChange?.(allProductRows);
    }, [allProductRows, onRowsChange]);

    const allData = [
      ...regularProductsData,
      ...newProductsData,
      ...promotionProductsData,
      ...giftProductsData,
    ].map((row) => {
      // 販促区分のダミー値を商品区分に応じて補完
      // 特殊商品はリスト無し→空欄（グリッドで'-'表示）
      if (row.productCategory === '特殊商品') {
        return { ...row, promotion: '' };
      }
      if (row.promotion) return row;
      const labels = getPromotionLabels(row.productCategory);
      return { ...row, promotion: labels[0] ?? '' };
    });

    // 函数計画の初期表示の割合（％）
    const [casePlanPercentage, setCasePlanPercentage] = useState('100');

    // 総店舗数
    const [totalStoreCount, setTotalStoreCount] = useState('50');

    // 区分タブの絞り込み
    const [activeTab, setActiveTab] = useState<string>('all');

    // 表示中のタブで商品区分を変更した行。変更直後に行が消えると利用者が混乱するため、
    // 別の商品区分タブへ切り替えるまでは表示中のタブに残し、切替時に変更後のタブへ移す。
    const [heldRowKeys, setHeldRowKeys] = useState<Set<string>>(
      () => new Set()
    );
    const switchTab = useCallback((tab: string) => {
      setHeldRowKeys(new Set());
      setActiveTab(tab);
    }, []);
    // 表示中のタブに属する行か（商品区分を変更して保留中の行を含む）
    const isRowInActiveTab = (row: ProductData) =>
      activeTab === 'all' ||
      row.section === activeTab ||
      heldRowKeys.has(heldRowKeyOf(row));

    // グリッド再構築トークン。セル編集（AG Gridがnode.dataを直接更新済み）以外の
    // 値更新（モーダル編集・函数反映・コピーペイン適用など）は、行の構造が変わらず
    // rowStructureSignature が変化しないため、このトークンを bump して rowData を
    // 明示的に再構築し、状態の新値をグリッドへ反映する。
    // ※再構築で rowData 参照が変わり Undo 履歴はクリアされるが、これらは意図的な
    //   一括/モーダル操作であり許容する（セル編集の Undo は維持される）。
    const [gridRebuildToken, setGridRebuildToken] = useState(0);
    // 連動セル（主セル編集に連動する従属セル）を Undo/Redo で一括・厳密復元する共通フック（→ 02 §7.3）。
    const { makeHandler, clearCache } = useLinkedCellUndo<ProductData>();
    // 再構築で行データが作り直されるため、連動セルのキャッシュも破棄する（保存確定時も本経路）。
    const bumpGridRebuild = useCallback(() => {
      clearCache();
      setGridRebuildToken((t) => t + 1);
    }, [clearCache]);

    // 行の追加
    const handleAddRow = useCallback(
      (section: string) => {
        if (onOpenAddDetail) {
          onOpenAddDetail(section);
        }
      },
      [onOpenAddDetail]
    );

    // 削除ボタンのクリック
    const handleDeleteClick = useCallback(
      (data: ProductData) => {
        if (onDeleteDetail) {
          onDeleteDetail(data);
        }
      },
      [onDeleteDetail]
    );

    // 行のコピー
    const handleCopyRow = useCallback(
      (data: ProductData) => {
        // 行データを複製する
        const copiedData = {
          ...data,
          // コピー行には一意なIDを再採番（getRowId 衝突・編集時の源行巻き込みを防止）
          id: `copy-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          // 挿入順を採番。商品区分によらず表示時は最下行（行コピーはコピー元の行のすぐ下）へ並ぶ
          _addedSeq: Date.now(),
          // 行コピーはコピー元の行のすぐ下に並べる（orderAddedRows → 02 §8・UX-112）
          _copyOf:
            data._copySource === 'detail'
              ? productRowBlockKey(data)
              : undefined,
        } as ProductData;

        // 追加・コピーした行へ移って強調する（行が反映された後に強調される）
        reveal.markRows([String(copiedData.id)]);

        // 編集ルーティング維持のため行は商品区分ごとの配列へ格納する（表示順は
        // rowData 側で orderAddedRows により並べ替える）。
        if (data.section === '定番商品') {
          setRegularProductsData((prev) => [...prev, copiedData]);
        } else if (data.section === '新商品') {
          setNewProductsData((prev) => [...prev, copiedData]);
        } else if (data.section === '特殊商品') {
          setPromotionProductsData((prev) => [...prev, copiedData]);
        } else if (data.section === 'ギフト') {
          setGiftProductsData((prev) => [...prev, copiedData]);
        }
        bumpGridRebuild();
      },
      [bumpGridRebuild, reveal]
    );

    // ギフトのセットの追加・コピー・更新・取得と、商品区分ごとの行の更新（計画詳細の2画面で共通）
    const {
      handleAddGiftSet,
      handleAddCopiedGiftSet,
      handleUpdateGiftSet,
      getGiftSet,
      handleUpdateRegularProduct,
      handleUpdateNewProduct,
      handleUpdatePromotionProduct,
      handleUpdateGiftProduct,
    } = usePlanDetailRowHandlers({
      giftProductsData,
      setRegularProductsData,
      setNewProductsData,
      setPromotionProductsData,
      setGiftProductsData,
      bumpGridRebuild,
      onRowsAdded: reveal.markRows,
    });

    // Expose 行操作（追加・コピー・削除）to parent via ref
    useImperativeHandle(ref, () => ({
      addCopiedRow: (data: ProductData) => {
        handleCopyRow({ ...data, _copySource: 'detail' });
      },
      // 明細追加：完全な空テンプレートにフォーム値を上書きし、最下行へ追加。
      // id・_addedSeq の採番と商品区分配列への振り分けは handleCopyRow が行う。
      addNewRow: (overrides: Partial<ProductData> & { section: string }) => {
        const base = makeEmptyProduct(overrides.section);
        handleCopyRow({ ...base, ...overrides, _copySource: 'new' });
      },
      // 明細削除：ギフトはセット単位（giftSetId）、その他は一意な id で除去
      deleteRow: (target: ProductData | string) => {
        const row = typeof target === 'string' ? null : target;
        if (row?.section === 'ギフト' && row.giftSetId) {
          setGiftProductsData((prev) =>
            prev.filter((item) => item.giftSetId !== row.giftSetId)
          );
          bumpGridRebuild();
          return;
        }
        const id = typeof target === 'string' ? target : target?.id;
        if (!id) return;
        const del = (prev: ProductData[]) =>
          prev.filter((item) => item.id !== id);
        setRegularProductsData(del);
        setNewProductsData(del);
        setPromotionProductsData(del);
        setGiftProductsData(del);
        bumpGridRebuild();
      },
      // ギフト以外の明細編集を id 一致で更新（商品区分＝section で対象配列を選択）
      // ※モーダル経由の編集は AG Grid のセル編集を通らず node.data が未更新のため、
      //   トークンを bump して rowData を再構築し新値を反映する（セル編集とは別経路）。
      updateRow: (data: ProductData) => {
        if (data.section === '新商品') handleUpdateNewProduct(data);
        else if (data.section === '特殊商品')
          handleUpdatePromotionProduct(data);
        else if (data.section === 'ギフト') handleUpdateGiftProduct(data);
        else handleUpdateRegularProduct(data);
        bumpGridRebuild();
      },
      addGiftSet: handleAddGiftSet,
      addCopiedGiftSet: handleAddCopiedGiftSet,
      updateGiftSet: handleUpdateGiftSet,
      getGiftSet,
      // 計画保存時：左端の帯（明細コピー・明細追加由来）と編集セルの強調を消す。
      // 保存した値を新たな元値とするため、元値の記録と未保存状態もリセットする。
      clearSavedMarks: () => {
        const strip = (prev: ProductData[]) =>
          prev.map((r) =>
            r._copySource ? { ...r, _copySource: undefined } : r
          );
        setRegularProductsData(strip);
        setNewProductsData(strip);
        setPromotionProductsData(strip);
        setGiftProductsData(strip);
        resetChangedCells();
        hasUnsavedRef.current = false;
        // 帯の有無は行構造シグネチャに含まれないため、再構築を明示する
        bumpGridRebuild();
        setTimeout(() => gridApiRef.current?.refreshCells({ force: true }), 0);
      },
    }));

    // 明細コピー：ペインを開かず、明細グリッドへ直接行を複製する。
    // ギフトは上旬/中旬/下旬の3行を1セットとしてまとめて複製する。
    const handleCopyClick = useCallback(
      (data: ProductData) => {
        if (data.section === 'ギフト' && data.giftSetId) {
          const set = getGiftSet(data.giftSetId);
          if (set) {
            handleAddCopiedGiftSet(set.base, set.plans, data.giftSetId);
            toast.success('明細をコピーしました。');
            return;
          }
        }
        handleCopyRow({ ...data, _copySource: 'detail' });
        toast.success('明細をコピーしました。');
      },
      [getGiftSet, handleAddCopiedGiftSet, handleCopyRow]
    );

    // 連動セル反映後の state 同期（商品区分＝section で対象配列を選択）。
    // rowData の参照は変えない（再構築トークンを進めない → 02 §7.1・§7.3）。
    const syncRowBySection = useCallback(
      (row: ProductData) => {
        if (row.section === '定番商品') handleUpdateRegularProduct(row);
        else if (row.section === '新商品') handleUpdateNewProduct(row);
        else if (row.section === '特殊商品') handleUpdatePromotionProduct(row);
        else if (row.section === 'ギフト') handleUpdateGiftProduct(row);
      },
      [
        handleUpdateRegularProduct,
        handleUpdateNewProduct,
        handleUpdatePromotionProduct,
        handleUpdateGiftProduct,
      ]
    );

    // 商品区分の変更（グリッド内のセル編集）。
    // タブ振り分けに使う section・販促区分を連動させ、ギフト⇄他区分では
    // 販売期間の 1行⇔3行（上旬・中旬・下旬）を組み替える。
    // サマリ商品名など既に選択済みの商品情報は変更しない。
    const handleChangeProductCategory = useCallback(
      (data: ProductData, newCategory: string) => {
        // ギフトは3行1セットのためセット全行を変更対象にする。
        const sourceRows =
          data.section === 'ギフト' && data.giftSetId
            ? giftProductsData.filter((r) => r.giftSetId === data.giftSetId)
            : [data];
        const seq = Date.now();
        const rows = buildCategoryChangeRows(sourceRows, newCategory, {
          newGiftSetId,
          newRowId: (i) => `new-${seq}-${i}`,
        });
        if (rows.length === 0) return;
        const removedIds = new Set(sourceRows.map((r) => r.id));
        // 変更前の区分の配列から取り除き、変更後の区分の配列へ入れ替える。
        const replaceIn =
          (category: string) =>
          (prev: ProductData[]): ProductData[] => {
            const kept = prev.filter((r) => !removedIds.has(r.id));
            return newCategory === category ? [...kept, ...rows] : kept;
          };
        setRegularProductsData(replaceIn('定番商品'));
        setNewProductsData(replaceIn('新商品'));
        setPromotionProductsData(replaceIn('特殊商品'));
        setGiftProductsData(replaceIn('ギフト'));
        // 「全て」以外のタブでは、別タブへ切り替えるまで変更した行を表示中のタブに残す。
        if (activeTab !== 'all') {
          setHeldRowKeys((prev) => {
            const next = new Set(prev);
            rows.forEach((r) => next.add(heldRowKeyOf(r)));
            return next;
          });
        }
        // 行構成が変わるためグリッドを再構築して新しい行を反映する。
        bumpGridRebuild();
      },
      [giftProductsData, bumpGridRebuild, activeTab]
    );

    // 合計の算出
    // 値は文字列で保持するのが基本だが、グリッドの編集経路によっては数値で
    // 渡ることがあるため、文字列化してから解釈する。
    const parseNumber = (value: string | number | undefined | null) => {
      if (value === null || value === undefined || value === '') return 0;
      const num = parseFloat(String(value).replace(/,/g, ''));
      return isNaN(num) ? 0 : num;
    };

    // 前年実績×率% を計画函数へ反映するヘルパー（前年実績が無い行は据え置き）
    const applyRateToRows = (rows: ProductData[], rate: number) =>
      rows.map((row) => {
        const base = parseNumber(row.prevYear);
        if (base <= 0) return row;
        return {
          ...row,
          plan: String(Math.round((base * rate) / 100)),
          // 率は小数点以下2桁を四捨五入し、小数点以下1桁で表示する。
          ratio: formatPlanRate(rate, PLAN_DETAIL_DIGITS.ratio),
        };
      });

    // 函数反映の確認ダイアログ表示状態
    const [isApplyConfirmShown, setIsApplyConfirmShown] = useState(false);

    // 「函数反映」ボタン押下：表示中の商品区分の計画函数へ前年実績比の率を適用
    // （確認ダイアログでOK後に実行）
    const handleApplyCasePlan = useCallback(() => {
      const rate = parseNumber(casePlanPercentage);
      if (activeTab === 'all' || activeTab === '定番商品')
        setRegularProductsData((prev) => applyRateToRows(prev, rate));
      if (activeTab === 'all' || activeTab === '新商品')
        setNewProductsData((prev) => applyRateToRows(prev, rate));
      if (activeTab === 'all' || activeTab === '特殊商品')
        setPromotionProductsData((prev) => applyRateToRows(prev, rate));
      if (activeTab === 'all' || activeTab === 'ギフト')
        setGiftProductsData((prev) => applyRateToRows(prev, rate));
      // セル編集を通らない一括更新のため rowData を再構築して新値を反映する。
      bumpGridRebuild();
      toast.success('函数を反映しました。');
      // eslint-disable-next-line react-hooks/exhaustive-deps -- 意図的に依存を限定（列定義/ヘルパーの安定化・再実行抑止のため）
    }, [activeTab, casePlanPercentage]);

    // ペインで指定した商品区分・率でコピーを実行（コピー元＝前年実績を基準）
    const handlePlanCopyExecute = useCallback((result: SalesPlanCopyResult) => {
      const rate = parseNumber(result.percentage);
      const isSelected = (category: string) =>
        result.categories.includes(category);
      if (isSelected('定番商品'))
        setRegularProductsData((prev) => applyRateToRows(prev, rate));
      if (isSelected('新商品'))
        setNewProductsData((prev) => applyRateToRows(prev, rate));
      if (isSelected('特殊商品'))
        setPromotionProductsData((prev) => applyRateToRows(prev, rate));
      if (isSelected('ギフト'))
        setGiftProductsData((prev) => applyRateToRows(prev, rate));
      // 拡売費は別表（拡売費計画）のため本表では対象外
      // セル編集を通らない一括更新のため rowData を再構築して新値を反映する。
      bumpGridRebuild();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- 意図的に依存を限定（列定義/ヘルパーの安定化・再実行抑止のため）
    }, []);

    // マージン率・値入率・社外売上高・売上原価の算出は recalcGiftLikeRates（モジュールスコープ）を参照。

    // 列フィルタを通過した行のID（フィルタ無しは null）。合計行を表示中の行だけで計算し直すために使う
    // （画面設計標準 4.4 ③）。公式の onFilterChanged／forEachNodeAfterFilter で取得する。
    const [filteredRowIds, setFilteredRowIds] = useState<Set<string> | null>(
      null
    );
    const handleFilterChanged = useCallback((e: FilterChangedEvent) => {
      if (!e.api.isAnyFilterPresent()) {
        setFilteredRowIds(null);
        return;
      }
      const ids = new Set<string>();
      e.api.forEachNodeAfterFilter((node) => {
        if (node.id) ids.add(node.id);
      });
      setFilteredRowIds(ids);
    }, []);

    const totals = useMemo(() => {
      // 合計行は表示中の商品区分タブの明細だけを集計する
      // （「全て」は全区分。rowData のタブ絞り込みと同じ条件）。
      // 列フィルタ中は、フィルタを通過した行だけを集計する（行IDは getRowId と同じ組み立て）。
      const targetRows = allData.filter(
        (row) =>
          isRowInActiveTab(row) &&
          !row._isHeader &&
          (!filteredRowIds ||
            filteredRowIds.has(
              row.id ?? `${row.section}-${row.metaBrand}-${row.summaryProduct}`
            ))
      );

      // ギフトは上旬/中旬/下旬の3行1セット。販売期間・計画(函数)以外はセル結合されて
      // 3行が1セル＝1つの値の表示になるため、セット代表行だけを集計して三重計上を防ぐ。
      const countedGiftSets = new Set<string>();
      const mergedRows = targetRows.filter((row) => {
        if (!row.giftSetId) return true;
        if (countedGiftSets.has(row.giftSetId)) return false;
        countedGiftSets.add(row.giftSetId);
        return true;
      });

      const sumOf = (
        rows: ProductData[],
        pick: (row: ProductData) => string | number | undefined | null
      ): number => rows.reduce((sum, row) => sum + parseNumber(pick(row)), 0);
      // 函数は整数のみのため、合計も四捨五入して整数にする。
      const countText = (value: number): string =>
        value.toLocaleString('ja-JP', { maximumFractionDigits: 0 });

      // 率は分子・分母を合算してから除算する（課題1758・utils/sales-plan/plan-detail/planDetailTotalRates）。
      // 金額列（社外売上高・値入額）と同じくギフトはセット代表行だけを対象にする。
      const rates = planDetailTotalRatesOf(
        mergedRows,
        'netFixed',
        costUnitPriceOf
      );
      // 分母が0のときは空値（率の列の valueFormatter が「-」を表示する）。
      const rateText = (value: number): string =>
        Number.isFinite(value) ? String(value) : '';

      return {
        section: '合計',
        metaBrand: '合計',
        summaryProduct: '',
        wholesaleMesh: '',
        productCategory: '',
        endSale: '',
        promotion: '',
        // 入数・売価は行ごとの単位・単価のため合計しない（空欄表示）。
        quantity: '',
        // 計画(函数)はギフトも行ごとに値が異なる（セル結合対象外）ため全行を集計する。
        plan: countText(sumOf(targetRows, (row) => row.plan)),
        estimate: countText(
          mergedRows.reduce(
            (sum, row) =>
              sum +
              currentMonthEstimate(
                parseNumber(row.actual),
                row.summaryProduct || row.wholesaleMesh
              ),
            0
          )
        ),
        actual: countText(sumOf(mergedRows, (row) => row.actual)),
        prevYear: countText(sumOf(mergedRows, (row) => row.prevYear)),
        // 金額列は列の valueFormatter（planAmountFormatter）が桁を整えるため、
        // ここでは素の数値文字列で渡す。
        // NET・納価(計画/EDI反映/前年実績) は単価のため合計しない（空欄表示）。
        net: '',
        planPrice: '',
        ediPrice: '',
        prevYearPrice: '',
        price: '',
        // 値入額は金額のため明細を合計する（課題1757）。
        markupAmount: String(sumOf(mergedRows, (row) => row.markupAmount)),
        externalSales: String(sumOf(mergedRows, (row) => row.externalSales)),
        delivery: String(sumOf(mergedRows, (row) => row.delivery)),
        // ％表示の列は合計せず、分子・分母の合算から率を求めて表示する（課題1758）。
        ratio: rateText(rates.ratio),
        margin: rateText(rates.margin),
        unitRate: '',
        discount: rateText(rates.discount),
        volumeAddRate: rateText(rates.volumeAddRate),
        profit: rateText(rates.profit),
        exp1PlannedAmount: '',
        exp1PostingMonth: '',
        exp1Delivery: '',
        exp1ManagementClass: '',
        exp1ManagementCode: '',
        exp1Description: '',
        exp2PlannedAmount: '',
        exp2PostingMonth: '',
        exp2Delivery: '',
        exp2ManagementClass: '',
        exp2ManagementCode: '',
        exp2Description: '',
        expTarget: false,
        _isHeader: false,
      };
      // isRowInActiveTab は activeTab・heldRowKeys から決まるため、それらを依存に置く。
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allData, activeTab, heldRowKeys, filteredRowIds]);

    // 列の定義（最初の描画で1回だけ作る。処理は utilsDetailColumns.tsx）
    const [columnDefs] = useState<(ColDef | ColGroupDef)[]>(() =>
      buildDetailColumnDefs({
        formulaHL,
        isCellChanged,
        makeHandler,
        parseNumber,
        syncRowBySection,
      })
    );

    const defaultColDef: ColDef = useMemo(
      () => ({
        ...GRID_DEFAULT_COL_DEF,
        // 収まらない見出しは折り返し、見出しの高さを中身に合わせる（→ 02 §7・UX-078）
        ...GRID_WRAP_HEADER_COL_DEF,
        resizable: true,
        sortable: true,
        filter: true,
        // 空白セルは「-」を表示（画面設計標準）
        valueFormatter: formatEmptyAsDash,
        // ギフトの3行1セットをセル結合（販売期間・計画列は個別に rowSpan:1 で上書き）
        rowSpan: giftRowSpan,
      }),
      []
    );

    // グリッドへ渡す defaultColDef（menuTabs・ハイライト/ギフト結合の cellClassRules を合成）。
    // 参照を安定させ、セル値編集による再レンダーで列定義が作り直されないようにする。
    // （defaultColDef の参照が変わると AG Grid が列を再読込し Undo/Redo 履歴をクリアするため）
    const gridDefaultColDef = useMemo<ColDef>(
      () => ({
        ...defaultColDef,
        menuTabs: ['generalMenuTab', 'columnsMenuTab'],
        // 計算式セルは計算式テキスト、それ以外は従来どおりセル値を表示する
        tooltipValueGetter: formulaHL.tooltipValueGetter,
        // 算出元セルの枠線ハイライト（計算式セルのクリック中のみ付与）
        cellClassRules: {
          // 共通の既定列設定のルール（値が無いセルの「-」をグレー等）を引き継ぐ
          ...defaultColDef.cellClassRules,
          ...formulaHL.cellClassRules,
          // ギフト結合セル（先頭行＝spanされる列）にセット下端の罫線を付与。
          // 販売期間・計画・操作列は結合対象外（行ごと）のため除外。
          'gift-merged-bottom': (p: any) =>
            !!p.data?._giftFirst &&
            p.colDef.field !== 'period' &&
            p.colDef.field !== 'plan' &&
            p.colDef.colId !== 'actions',
        },
      }),
      [defaultColDef, formulaHL.cellClassRules, formulaHL.tooltipValueGetter]
    );

    // ヘッダー tooltip 付与済みの列定義。参照を安定させ Undo 履歴クリアを防ぐ（同上）。
    const gridColumnDefs = useMemo(
      () => withSpanSafeHeaderHeight(withHeaderTooltips(columnDefs)),
      [columnDefs]
    );

    // 各行の一意ID生成。参照安定化のため useCallback 化（同上）。
    const getRowIdCallback = useCallback(
      (params: any) =>
        params.data?.id ??
        `${params.data.section}-${params.data.metaBrand}-${params.data.summaryProduct}`,
      []
    );

    // 行の構造シグネチャ（行ID＋ギフトセット＋挿入順）。セル値の編集では変化せず、
    // 行の追加/削除/コピー/並べ替えでのみ変化する。これを rowData 再生成のトリガに
    // することで「値編集では rowData 参照を変えない」＝AG Grid の Undo/Redo 履歴を維持する。
    // （rowData 参照が変わると公式仕様で履歴がクリアされる。セル値は AG Grid がノードの
    //   data を直接更新し、値の永続化は onCellValueChanged→state 同期で担保される）
    const rowStructureSignature = useMemo(
      () =>
        allData
          .map(
            (r) =>
              `${r.id ?? `${r.section}-${r.metaBrand}-${r.summaryProduct}`}#${r.giftSetId ?? ''}#${r._addedSeq ?? ''}`
          )
          .join('|'),
      [allData]
    );

    // タブフィルターを適用したデータを生成
    // （商品区分を変更して保留中の行は、別タブへ切り替えるまで表示中のタブに残す）
    const rowData = useMemo(() => {
      const byTab = allData.filter(isRowInActiveTab);
      // 明細追加・コピーで採番した行（_addedSeq あり）を、商品区分によらず並べ直す。
      // 新規・下ペインのコピーは最下行へ追加した順、行コピーはコピー元の行のすぐ下
      // （ギフトは3行1セットで動かす）。既存行は元の順序を維持（→ 02 §8・UX-112）。
      const sorted = orderAddedRows(byTab, productRowBlockKey);
      // ギフトの3行1セットをセル結合するため、セット単位で
      // 先頭行(_giftFirst＋行数_giftSpan)・中央行(_giftMiddle：操作アイコン表示)・
      // 最終行(_giftLast：操作列の下罫線)を付与する。
      const annotated = sorted.map((row) => ({
        ...row,
        _giftFirst: false,
        _giftSpan: 1,
        _giftMiddle: false,
        _giftLast: false,
      }));
      let i = 0;
      while (i < annotated.length) {
        const row = annotated[i];
        if (row.section !== 'ギフト' || !row.giftSetId) {
          i++;
          continue;
        }
        let j = i;
        while (
          j < annotated.length &&
          annotated[j].giftSetId === row.giftSetId
        ) {
          j++;
        }
        const size = j - i;
        annotated[i]._giftFirst = true;
        annotated[i]._giftSpan = size;
        annotated[j - 1]._giftLast = true;
        annotated[i + Math.floor(size / 2)]._giftMiddle = true;
        i = j;
      }
      return annotated;
      // allData は本文で参照するが依存には含めない（値編集で rowData 参照を変えず
      // Undo 履歴を維持するため、再生成は構造シグネチャ／再構築トークンの変化時のみに限定）。
      // 構造変化・非セル編集の値更新時は allData が最新のため rebuild に必要な値も最新。
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rowStructureSignature, activeTab, heldRowKeys, gridRebuildToken]);

    const getRowStyle = asRowStyle(
      useCallback((params: RowClassParams) => {
        // ピン留めされた行（合計行）
        if (params.node.rowPinned) {
          return {
            backgroundColor: GRID_COLORS.total, // amber-100 - 商品に紐づかない拡売費と同じ色
            fontWeight: 'bold',
          };
        }

        // 通常の行は背景色を設定せず、CSSのホバー効果を優先
        return {};
      }, [])
    );

    return (
      <>
        {/* 販売計画(詳細)のタブの中身（カードの枠・見出しは親の開閉カード〔CollapsibleCard〕が持つため、ここでは枠を付けない → 05「白カード」・UX-065） */}
        <div className="mb-4">
          {/* 見出しの行（1行。UI/UX UX-106 → 02 §10.4 PlanDetailHeaderMenus）。
              左：販売計画(詳細)｜拡売費計画 › 商品区分 ｜ 総間口数。右：凡例・一括操作・率設定・関連画面・明細追加。
              入りきらない幅では折り返す（flex-wrap） */}
          <div className="flex flex-wrap items-center gap-2 pb-3 text-left text-gray-900">
            {sectionSwitch}
            {sectionSwitch && (
              <ChevronRight
                className="h-5 w-5 text-gray-400"
                aria-hidden="true"
              />
            )}
            {/* 商品区分の切替（自販機と同じ共通部品 SegmentToggle → 02 §6・UI/UX UX-090） */}
            <SegmentToggle
              ariaLabel="商品区分"
              options={[
                { value: 'all', label: '全て' },
                { value: '定番商品', label: '定番商品' },
                { value: '新商品', label: '新商品' },
                { value: '特売', label: '特売' },
                { value: 'ギフト', label: 'ギフト' },
              ]}
              value={activeTab}
              onChange={(tab) => switchTab(tab)}
            />
            <HeaderDivider />
            <label
              htmlFor="total-store-count"
              className={`${FORM_LABEL_CLASS} whitespace-nowrap`}
            >
              総間口数
            </label>
            <Input
              id="total-store-count"
              type="text"
              value={totalStoreCount}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
                setTotalStoreCount(value);
              }}
              className={`${TEXT_INPUT_CLASS} w-15 text-right`}
              maxLength={3}
              aria-describedby="total-store-count-note"
            />
            {/* 課題No.0363：保存時のアラートではなく、入力欄の横に文言を表示する。
                見出しを1行に収めるため短く出し、全文はマウスを乗せたとき（title）と読み上げで伝える（UX-106） */}
            <span
              id="total-store-count-note"
              className="text-xs whitespace-nowrap text-gray-500"
              title="入力値は次月以降の販売計画にも反映されます"
            >
              ※次月以降にも反映
              <span className="sr-only">
                （入力値は次月以降の販売計画にも反映されます）
              </span>
            </span>

            <div className="ml-auto flex items-center gap-2">
              {/* コピー由来カラーバーの凡例（この画面は参照ペイン無し＝販売計画コピー元は出ない） */}
              <CopySourceLegend showReference={false} />
              {/* 一括操作：前月計画コピー（右ペインで実行。コピー元は前月計画で固定）・函数反映 */}
              <PlanBulkActionsMenu
                onPlanCopy={() => onOpenCopyPane?.()}
                casePlanPercentage={casePlanPercentage}
                onCasePlanPercentageChange={setCasePlanPercentage}
                onApplyCasePlan={() => setIsApplyConfirmShown(true)}
              />
              {/* 率設定：年契基本分・センターフィ等の右ペインを開く（拡売費計画と共通の並び） */}
              <PlanRateMenu
                items={[
                  {
                    label: '年契基本分',
                    value: annualContractAvg,
                    onClick: onOpenAnnualContract,
                  },
                  {
                    label: 'センターフィ',
                    value: centerFeeAvg,
                    onClick: onOpenCenterFee,
                  },
                  {
                    label: '取組強化マージン',
                    value: wholesaleIncentiveAvg,
                    onClick: onOpenWholesaleIncentive,
                  },
                ]}
              />
              {/* 関連画面：年間計画・シミュレーション（未保存時は確認後に画面遷移） */}
              <PlanRelatedScreensMenu
                items={[
                  {
                    label: '年間計画',
                    onClick: () =>
                      handleNavigateWithGuard('annual-plan-creation'),
                    disabled: isPlanNavigationDisabled,
                  },
                  {
                    label: 'シミュレーション',
                    onClick: () =>
                      handleNavigateWithGuard(
                        'sales-plan-simulation-net-fixed'
                      ),
                    disabled: isPlanNavigationDisabled,
                  },
                ]}
              />
              {/* 明細追加ボタン */}
              <button
                onClick={() =>
                  handleAddRow(activeTab === 'all' ? '' : activeTab)
                }
                className="btn-toolbar-outline"
                aria-label="明細追加"
              >
                <Plus className="h-4 w-4" />
                明細追加
              </button>
            </div>
          </div>

          {/* AG Grid Table（1920x1080 のPCで画面いっぱいに表示）
            減算値 10.5rem = ヘッダ・フッタ・カード下余白の固定高。最下部までスクロールした
            状態でグリッド本体が画面高にちょうど収まる値（カード見出し・タブ・ツールバーは
            スクロールアウトしてよい方針）。 */}
          <div
            className="sales-detail-grid"
            style={{ height: viewportGridHeight(10.5), minHeight: '25rem' }}
          >
            <style>{`
                    .sales-detail-grid .ag-cell-right {
                      text-align: right;
                    }
                    .sales-detail-grid .ag-cell-left {
                      text-align: left;
                    }
                    .sales-detail-grid .ag-cell-center {
                      text-align: center;
                    }

                    /* （見出しの背景色・文字色は共通テーマ GRID_THEME に委ねる → 02 §7「ヘッダーの配色」・UI/UX UX-031） */
                    .sales-detail-grid .ag-header-cell {
                      border-right: 1px solid var(--grid-strong-divider);
                    }
                    .sales-detail-grid .ag-cell {
                      transition: background-color 0.2s ease;
                    }
                    /* ギフト3行1セットの結合セルは、セット下端の横罫線が消えるため補う */
                    .sales-detail-grid .ag-cell.gift-merged-bottom {
                      border-bottom: 1px solid var(--grid-grid-line) !important;
                    }
                    /* 操作列：ギフトはセット内部の横罫線を消し、最終行のみ下罫線を出して
                       1セットに結合されたように見せる（アイコンは中央行にのみ描画） */
                    .sales-detail-grid .ag-cell.gift-actions {
                      border-bottom: none !important;
                    }
                    .sales-detail-grid .ag-cell.gift-actions-bottom {
                      border-bottom: 1px solid var(--grid-grid-line) !important;
                    }
                    /* ホバー：行全体を薄いブルー（GRID_COLORS.rowHover）でハイライト。
                       白・グレー系セルも含め、行内の全セルをブルーにする。 */
                    .sales-detail-grid .ag-row-hover:not(.ag-full-width-row):not(.ag-row-pinned) .ag-cell,
                    .sales-detail-grid .ag-row-hover:not(.ag-full-width-row):not(.ag-row-pinned) .ag-cell[style*="background-color"] {
                      background-color: var(--grid-row-hover) !important;
                    }
                    .sales-detail-grid .ag-row-pinned-top {
                      border-top: 2px solid var(--grid-pinned-row-border);
                    }
                    .sales-detail-grid .ag-row-pinned-top .ag-cell:hover {
                      background-color: var(--grid-total) !important; /* 合計行はホバーエフェクトを維持 */
                    }
                    /* 編集中のセルはクリーム色を強調 */
                    .sales-detail-grid .ag-cell-inline-editing[style*="background-color: rgb(254, 249, 195)"] {
                      background-color: var(--grid-editing-bg) !important;
                      box-shadow: 0 0 0 2px var(--grid-editing-border) inset;
                    }
                  `}</style>
            <AgGridReact
              rowData={rowData}
              columnDefs={gridColumnDefs}
              // ギフトの3行1セルをセル結合（rowSpan）するために必須
              suppressRowTransform={true}
              defaultColDef={gridDefaultColDef}
              getContextMenuItems={gridFilterContextMenuItems}
              statusBar={GRID_STATUS_BAR}
              pinnedTopRowData={[totals]}
              onFilterChanged={handleFilterChanged}
              // 追加・コピーした行へ移って強調する（共通フック useRevealNewRows）
              onRowDataUpdated={reveal.onRowDataUpdated}
              getRowStyle={getRowStyle}
              onCellMouseOver={formulaHL.onCellMouseOver}
              onCellMouseOut={formulaHL.onCellMouseOut}
              // 計算式をツールチップで見せるため、省略されていないセルでも出す（グローバルは whenTruncated）
              tooltipShowMode="standard"
              tooltipShowDelay={300}
              tooltipHideDelay={5000}
              onCellValueChanged={(params: any) => {
                // いずれかのセルが編集されたら未保存状態にする
                hasUnsavedRef.current = true;
                // 編集済みセルを記録（元値に戻したら解除）し、当該セルを再描画して
                // 黄色＋オレンジ枠（changedCellStyle）を反映する（共通フック → 02 §7.2）
                trackCellChange(params);
                params.api.refreshCells({
                  rowNodes: [params.node],
                  columns: [params.column.getColId()],
                  force: true,
                });
              }}
              getRowId={getRowIdCallback}
              {...GRID_BASE_PROPS}
              {...gridColumnStateProps}
              context={{
                onAddRow: handleAddRow,
                onDeleteRow: handleDeleteClick,
                onCopyRow: handleCopyRow,
                onCopyForPane: handleCopyClick,
                updateRegularProduct: handleUpdateRegularProduct,
                updateNewProduct: handleUpdateNewProduct,
                updatePromotionProduct: handleUpdatePromotionProduct,
                updateGiftProduct: handleUpdateGiftProduct,
                changeProductCategory: handleChangeProductCategory,
              }}
            />
          </div>
        </div>

        {/* 前月計画コピー 右ペイン
          販売店（チェーン）選択なし。商品区分→コピー元％→コピー実行の確認。
          ＝計画詳細(マージン率固定・NET入力)の「前月計画コピー」と同じ内容。 */}
        <PlanCopyPane
          chainStores={CHAIN_STORES}
          open={copyPaneOpen}
          onClose={onCloseCopyPane ?? (() => {})}
          title="前月計画コピー"
          showStoreSelection={false}
          categories={CATEGORY_LABELS_NET}
          onExecute={handlePlanCopyExecute}
        />

        {/* 函数反映の確認: 表内に入力中のデータがある場合にリセットされる旨を確認 */}
        <ConfirmDialog
          open={isApplyConfirmShown}
          title="函数反映の確認"
          confirmLabel="反映"
          description="入力中のデータがリセットされます。本当によろしいですか？"
          onConfirm={() => {
            setIsApplyConfirmShown(false);
            handleApplyCasePlan();
          }}
          onCancel={() => setIsApplyConfirmShown(false)}
        />

        {/* 年間計画／シミュレーション遷移の確認 */}
        <ConfirmDialog
          open={pendingNavMenuId !== null}
          title="画面移動の確認"
          confirmLabel="移動"
          description="入力中のデータが破棄されます。本当によろしいですか？"
          onConfirm={() => {
            const id = pendingNavMenuId;
            setPendingNavMenuId(null);
            if (id) onNavigate?.(id);
          }}
          onCancel={() => setPendingNavMenuId(null)}
        />
      </>
    );
  }
);
