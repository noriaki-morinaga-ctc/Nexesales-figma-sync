import {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  ColGroupDef,
  RowClassParams,
  GridApi,
  GridReadyEvent,
  FilterChangedEvent,
  RowDataUpdatedEvent,
} from 'ag-grid-community';

import { FileSearch } from 'lucide-react';
import { toast } from 'sonner';

import { planDetailTotalRatesOf } from '@/app/utils/sales-plan/plan-detail/planDetailTotalRates';

import {
  viewportGridHeight,
  GRID_COLORS,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  formatEmptyAsDash,
  gridFilterContextMenuItems,
  useFormulaSourceHighlight,
  useGridColumnState,
  useChangedCells,
  useLinkedCellUndo,
  withHeaderTooltips,
  CopySourceLegend,
  useRevealNewRows,
  asRowStyle,
} from '@/app/components/grid';

import { formatPlanRate } from '@/app/utils/sales-plan/common/planDetailNumberFormat';
import { BottomPane } from '@/app/components/ui/bottom-pane';
import { SimulationReferenceTable } from '@/app/components/shared/sales-plan/simulation/SimulationReferenceTable';
import {
  DETAIL_PERIOD_FROM_ID,
  SimulationPeriodPicker,
} from '@/app/components/shared/sales-plan/simulation/SimulationPeriodPicker';
import {
  BUTTON_STYLES,
  BUTTON_BASE,
  FORM_LABEL_CLASS,
} from '@/styles/commonStyles';
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog';

import {
  REGULAR_PRODUCTS_DATA,
  NEW_PRODUCTS_DATA,
  PROMOTION_PRODUCTS_DATA,
  GIFT_PRODUCTS_DATA,
} from '@/mocks/sales-plan/sales-plan-simulation-margin-rate-fixed';

import {
  GIFT_PERIODS,
  buildCategoryChangeRows,
  giftPeriodIndex,
  newGiftSetId,
} from '@/app/utils/sales-plan/common/productCategoryChange';
import { stripCopySource } from '@/app/utils/common/copySourceMarks';

import {
  heldRowKeyOf,
  isRowInActiveTab,
} from '@/app/utils/sales-plan/simulation/heldCategoryRows';

import { CURRENT_USER_NAME } from '@/mocks/common/planBasicInfo';
import { SIMULATION_CLOSED_MONTHS } from '@/mocks/common/planBasicInfo';
import { addMonths, isInPeriod } from '@/app/utils/common/yearMonth';

import type { ProductData } from '@/app/types/simulation';

import {
  REVEAL_FOCUS_COLUMN,
  REJECTED_BG,
  EMPTY_EXPENSE_FIELDS,
  THIS_YEAR,
} from '@/app/components/sales-plan/sales-plan-simulation-margin-rate-fixed/constants';
import {
  getDetailRowId,
  costUnitPriceOf,
  computeDerived,
  initSimRow,
  categoryToSection,
  giftRowSpan,
  makeEmptyProduct,
  withTargetYear,
  SIM_FORMULA_DEFS,
  parseMetric,
} from '@/app/components/sales-plan/sales-plan-simulation-margin-rate-fixed/utils';
import { buildDetailColumnDefs } from '@/app/components/sales-plan/sales-plan-simulation-margin-rate-fixed/utilsDetailColumns';
import { SegmentToggle } from '@/app/components/shared/common/SegmentToggle';

export interface DetailTableHandle {
  addCopiedRow: (data: ProductData) => void;
  /** 同じ対象年月・同じ企画の明細へ企画名を連動する */
  syncCampaignName: (
    targetMonth: string,
    campaign: string,
    campaignName: string
  ) => void;
  /** 既存行をテンプレートに新規行を合計行直下へ追加（明細追加用） */
  addNewRow: (overrides: Partial<ProductData> & { section: string }) => void;
  /** id 一致行を更新（明細編集用） */
  updateRow: (data: ProductData) => void;
  /** id 一致行を削除（明細削除用）。ギフトはセット単位（giftSetId）で削除 */
  deleteRow: (target: ProductData | ProductData['id']) => void;
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
  // 保存時：左端の帯（コピー元・明細コピー・明細追加）と編集セルの黄色強調を消す
  clearSavedMarks: () => void;
}

interface DetailTableProps {
  onOpenAddDetail?: (section: string) => void;
  onDeleteDetail?: (data: ProductData) => void;
  // 企画単位集計データを親（集計表）へ通知する
  onCampaignDataChange?: (rows: ProductData[]) => void;
  // 全明細を親へ通知する（追加可否・確定排他の判定に使用）
  onRowsChange?: (rows: ProductData[]) => void;
  // シミュレーション（詳細）の対象期間（YYYY/MM）。明細表と参照用下ペインはこの期間内の
  // 対象年月の明細のみ扱う。集計の対象期間とは連動しない（6/16 第9回 決定9）。
  // 明細追加ペインの選択範囲にも使うため画面（page.tsx）側で保持する。
  targetPeriodFrom: string;
  targetPeriodTo: string;
  // 詳細の対象期間の変更。未保存の入力を破棄してから呼ぶ（6/16 第9回 決定10）。
  onTargetPeriodFromChange: (value: string) => void;
  onTargetPeriodToChange: (value: string) => void;
  // シミュレーション（集計）の対象期間（YYYY/MM）。企画単位集計はこの期間内の明細を集計する。
  aggregationPeriodFrom: string;
  aggregationPeriodTo: string;
}

export const DetailTable = forwardRef<DetailTableHandle, DetailTableProps>(
  function DetailTable(
    {
      onOpenAddDetail,
      onDeleteDetail,
      onCampaignDataChange,
      onRowsChange,
      targetPeriodFrom,
      targetPeriodTo,
      onTargetPeriodFromChange,
      onTargetPeriodToChange,
      aggregationPeriodFrom,
      aggregationPeriodTo,
    },
    ref
  ) {
    // 明細データ（グリッドの行）の状態
    const [regularProductsData, setRegularProductsData] = useState<
      Array<ProductData>
    >(() => withTargetYear(REGULAR_PRODUCTS_DATA, THIS_YEAR).map(initSimRow));

    const [newProductsData, setNewProductsData] = useState<ProductData[]>(() =>
      withTargetYear(NEW_PRODUCTS_DATA, THIS_YEAR).map(initSimRow)
    );

    const [promotionProductsData, setPromotionProductsData] = useState<
      Array<ProductData>
    >(() => withTargetYear(PROMOTION_PRODUCTS_DATA, THIS_YEAR).map(initSimRow));

    const [giftProductsData, setGiftProductsData] = useState<
      Array<ProductData>
    >(() => withTargetYear(GIFT_PRODUCTS_DATA, THIS_YEAR).map(initSimRow));

    const allData = useMemo(
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

    // シミュレーション（詳細）の対象期間内の明細（明細表の表示対象）
    const periodData = useMemo(
      () =>
        allData.filter((row) =>
          isInPeriod(row.targetMonth ?? '', targetPeriodFrom, targetPeriodTo)
        ),
      [allData, targetPeriodFrom, targetPeriodTo]
    );

    // シミュレーション（集計）の対象期間内の明細（企画単位集計の対象）
    const aggregationPeriodData = useMemo(
      () =>
        allData.filter((row) =>
          isInPeriod(
            row.targetMonth ?? '',
            aggregationPeriodFrom,
            aggregationPeriodTo
          )
        ),
      [allData, aggregationPeriodFrom, aggregationPeriodTo]
    );

    // 保存済みの明細（初期表示時点、以降は保存のたびに更新）。
    // 詳細の対象期間を変更したときは、未保存の入力を破棄してこの内容へ戻す（6/16 第9回 決定10）。
    const savedRowsRef = useRef({
      regular: regularProductsData,
      new: newProductsData,
      promotion: promotionProductsData,
      gift: giftProductsData,
    });

    // 確定排他の判定（セルエディタ・ツールチップ）から常に最新の全明細を参照するための ref
    const allDataRef = useRef<ProductData[]>(allData);
    allDataRef.current = allData;

    // 参照表（販売計画(コピー元)）に表示する初期データのスナップショット。
    // ライブの allData を渡すとコピー実行で追加した行がコピー元側にも現れてしまうため、
    // 初期表示時点の計画を固定表示し、コピー先（シミュレーション詳細）にのみ行が追加されるようにする。
    // 表示する期間は詳細の対象期間（参照表側で絞り込む）。
    const [referenceRows] = useState<ProductData[]>(() => allData);

    // 全明細を親へ通知（追加可否・確定排他の判定に使用）。
    // 4つの状態配列の変化時のみ発火させ、再レンダーループを避ける。
    useEffect(() => {
      onRowsChange?.([
        ...regularProductsData,
        ...newProductsData,
        ...promotionProductsData,
        ...giftProductsData,
      ]);
    }, [
      regularProductsData,
      newProductsData,
      promotionProductsData,
      giftProductsData,
      onRowsChange,
    ]);

    // 企画×確度単位集計：allData を「企画＋確度」でグルーピングし、数値列のみ合計
    // （集計表ではこれを企画でドリルダウン表示する）
    const buildCampaignSummary = (): ProductData[] => {
      const toNum = (s?: string) =>
        s ? parseFloat(String(s).replace(/,/g, '')) || 0 : 0;
      const groups = new Map<string, ProductData[]>();
      aggregationPeriodData.forEach((row) => {
        const key = `${row.campaign || '（未設定）'}｜${row.probability || ''}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      });
      const sum = (rows: ProductData[], f: keyof ProductData) =>
        String(rows.reduce((s, r) => s + toNum(r[f] as string), 0));
      // 明細1行ごとに「単価 × 入数 × 計画函数」を求めて合算する（値入率の加重平均用）
      const sumPerBox = (
        rows: ProductData[],
        unitOf: (r: ProductData) => number
      ) =>
        String(
          rows.reduce(
            (s, r) => s + unitOf(r) * toNum(r.quantity) * toNum(r.plan),
            0
          )
        );
      // グループ内で最初に値を持つ行の値を代表値として採用
      const pick = (rows: ProductData[], f: keyof ProductData) => {
        const found = rows.find(
          (r) => r[f] != null && String(r[f]).trim() !== ''
        );
        return found ? String(found[f]) : '';
      };
      const result: ProductData[] = [];
      let seq = 1;
      groups.forEach((rows) => {
        const i = seq - 1; // 0-based グループ番号（ダミー率の変化用）
        const campaign = rows[0].campaign || '（未設定）';
        result.push({
          id: String(seq++),
          campaign,
          campaignName: pick(rows, 'campaignName'),
          probability: rows[0].probability || '',
          targetMonth: pick(rows, 'targetMonth'),
          section: rows[0].section,
          summary1: pick(rows, 'summary1'),
          metaBrand: pick(rows, 'metaBrand'),
          containerCapacityG: pick(rows, 'containerCapacityG'),
          summaryProduct: pick(rows, 'summaryProduct'),
          // 一般卸メッシュは卸のみ対象のため量販では空欄
          wholesaleMesh: '',
          productCategory: pick(rows, 'productCategory'),
          promotion: pick(rows, 'promotion'),
          delivery: pick(rows, 'delivery'),
          production: pick(rows, 'production'),
          quantity: sum(rows, 'quantity'),
          plan: sum(rows, 'plan'),
          net: sum(rows, 'net'),
          planPrice: sum(rows, 'planPrice'),
          price: sum(rows, 'price'),
          margin: '',
          // 値引率は単純合算できないため代表値（なければダミー値）を表示
          discount: pick(rows, 'discount') || `${(20 + (i % 6)).toFixed(2)}%`,
          managementProfitAmount: sum(rows, 'managementProfitAmount'),
          // 管理利益率は代表値（なければダミー値）を表示
          managementProfitRate:
            pick(rows, 'managementProfitRate') ||
            `${(18 + (i % 5)).toFixed(2)}%`,
          netSales: sum(rows, 'netSales'),
          externalSales: sum(rows, 'externalSales'),
          // 値入率の加重平均用（合計行で Σ値入額 ÷ Σ売価金額 × 100 を算出する）
          _markupAmount: sumPerBox(
            rows,
            (r) => toNum(r.price) - toNum(r.planPrice)
          ),
          _retailAmount: sumPerBox(rows, (r) => toNum(r.price)),
          exp1PlannedAmount: sum(rows, 'exp1PlannedAmount'),
          exp1PostingMonth: '',
          exp1ManagementCode: '',
          exp1AccountItem: '',
          exp1ManagementClass: '',
          exp1Description: '',
          exp2PlannedAmount: sum(rows, 'exp2PlannedAmount'),
          exp2PostingMonth: '',
          exp2ManagementCode: '',
          exp2AccountItem: '',
          exp2ManagementClass: '',
          exp2Description: '',
        });
      });
      return result;
    };

    // 企画単位集計データを集計表へ通知（明細データ・集計の対象期間の変更時のみ実行）
    useEffect(() => {
      onCampaignDataChange?.(buildCampaignSummary());
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aggregationPeriodData]);

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

    // 詳細の対象期間変更の確認（未保存の入力の破棄を確認してから反映）
    const [pendingPeriodApply, setPendingPeriodApply] = useState<
      (() => void) | null
    >(null);

    // 参照用下ペイン（自計画を参照し、コピーで明細へ行追加）
    const [isReferencePaneShown, setIsReferencePaneShown] = useState(false);
    // 明細グリッドの API
    const mainGridApiRef = useRef<GridApi | null>(null);

    // ── 新規行（コピー）の強調表示 ──
    // 行追加は state 更新のため、追加直後はまだグリッドに行が無い。markRows で行IDを記録し、
    // グリッドの onRowDataUpdated（＝行が反映された後）で可視域へ送り、行全体をフラッシュして
    // 先頭セルへフォーカスを移す（下ペイン表示中のページ側のスクロールも共通フックが行う）。
    const reveal = useRevealNewRows({ focusColumn: REVEAL_FOCUS_COLUMN });

    // 明細グリッドのコンテナ（コピー元ペインを開いた際、グリッドヘッダーを
    // ヘッダーメニュー直下へスクロールするための参照）
    const gridContainerRef = useRef<HTMLDivElement>(null);

    // コピー元ペインを開いたら、明細グリッドのヘッダーがヘッダーメニュー（画面上端）の
    // 真下に来るようにスクロールする。ペイン展開のレイアウトが確定してから実行する。
    // ※ scrollIntoView は main／ドキュメントまでスクロールして sticky ヘッダーの表示を
    //   乱すため使わず、画面内のスクロール領域（最も近いスクロール可能な祖先）だけを動かす。
    useEffect(() => {
      if (!isReferencePaneShown) return;
      const id = window.setTimeout(() => {
        const gridEl = gridContainerRef.current;
        if (!gridEl) return;
        let scroller: HTMLElement | null = gridEl.parentElement;
        while (scroller) {
          const overflowY = window.getComputedStyle(scroller).overflowY;
          if (
            (overflowY === 'auto' || overflowY === 'scroll') &&
            scroller.scrollHeight > scroller.clientHeight
          ) {
            break;
          }
          scroller = scroller.parentElement;
        }
        if (!scroller) return;
        const delta =
          gridEl.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top;
        scroller.scrollBy({ top: delta, behavior: 'smooth' });
      }, 350);
      return () => window.clearTimeout(id);
    }, [isReferencePaneShown]);

    // 「反映済を除く」フィルター（デフォルトON）
    const [shouldExcludeReflected, setShouldExcludeReflected] = useState(true);

    // 「不採用を除く」フィルター（デフォルトON）
    const [shouldExcludeRejected, setShouldExcludeRejected] = useState(true);

    // 連動セル（拡売費の管理区分⇔管理コード／施策区分⇔施策コード）の Undo/Redo を、
    // 主セル1回で従属セルごと一括・厳密に戻す共通フック（→ 02 §7.3）。
    const { makeHandler: makeLinkedHandler, clearCache: clearLinkedCache } =
      useLinkedCellUndo<ProductData>();

    // グリッド再構築トークン。セル編集（AG Grid が node.data を直接更新済み）以外の
    // 値更新（明細編集ペイン・ギフトセット更新・保存・未保存入力の破棄など）は、行の構造が
    // 変わらず rowStructureSignature が変化しないため、このトークンを進めて rowData を
    // 明示的に作り直し、状態の新値をグリッドへ反映する（→ 02 §7.1）。
    // ※作り直しで rowData 参照が変わり Undo 履歴はクリアされるが、これらは意図的な
    //   一括・ペイン操作のため許容する（セル編集の Undo は維持される）。
    const [gridRebuildToken, setGridRebuildToken] = useState(0);
    const bumpGridRebuild = useCallback(() => {
      // 作り直し（保存確定を含む）で行の値が入れ替わるため、連動セルのキャッシュも破棄する。
      clearLinkedCache();
      setGridRebuildToken((t) => t + 1);
    }, [clearLinkedCache]);

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

    // 企画名の連動：同じ対象年月・同じ企画の明細すべて（フィルタで非表示の明細・反映済・不採用も含む）へ反映する。
    const handleSyncCampaignName = useCallback(
      (targetMonth: string, campaign: string, campaignName: string) => {
        if (!campaign) return;
        const isSameCampaign = (row: ProductData) =>
          row.targetMonth === targetMonth && row.campaign === campaign;
        const applyName = (prev: ProductData[]) =>
          prev.map((row) =>
            isSameCampaign(row) && row.campaignName !== campaignName
              ? { ...row, campaignName }
              : row
          );
        setRegularProductsData(applyName);
        setNewProductsData(applyName);
        setPromotionProductsData(applyName);
        setGiftProductsData(applyName);
        // rowData は値編集で作り直さないため、表示中の行は公式の updateData で更新する（→ 02 §7.1）
        mainGridApiRef.current?.forEachNode((node) => {
          if (node.data && isSameCampaign(node.data)) {
            node.updateData({ ...node.data, campaignName });
          }
        });
      },
      []
    );

    // 行のコピー
    const handleCopyRow = useCallback(
      (data: ProductData) => {
        // 行データを複製する
        const copiedData: ProductData = {
          ...data,
          // コピー行には一意な id を再採番（getRowId 衝突・編集時の源行巻き込みを防止）
          id: `copy-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          // 挿入順を採番。商品区分によらず表示時は合計行直下（先頭）へ並ぶ
          _addedSeq: Date.now(),
          // 計画キーはコピー元から引き継ぐ（同一計画の明細として確定排他の対象になる）。
          // 元行（_planKey 無し）からのコピーは元行 id を計画キーとして共有する。
          _planKey:
            data._planKey ??
            (data.id != null
              ? `id:${data.id}`
              : `plan-${Date.now()}-${Math.floor(Math.random() * 1e6)}`),
          // 拡売費①②はコピー元（明細追加/コピーフォームの入力値）をそのまま引き継ぐ。
          // 参照ペインからのコピーのみ handleReferenceCopyRow 側で空にする。
          // 追加・コピーで作られた行の作成者はログインユーザー（コピー元の作成者は引き継がない）。
          exp1Creator: CURRENT_USER_NAME,
          exp2Creator: CURRENT_USER_NAME,
        };

        // コピーした行を強調対象にする（行が反映された後に強調される）
        reveal.markRows([String(copiedData.id)]);

        // 編集ルーティング維持のため行は商品区分ごとの配列へ格納する（表示順は
        // rowData 側で _addedSeq により合計行直下へ並べ替える）。
        if (data.section === '定番商品') {
          setRegularProductsData((prev) => [copiedData, ...prev]);
        } else if (data.section === '新商品') {
          setNewProductsData((prev) => [copiedData, ...prev]);
        } else if (data.section === '特殊商品') {
          setPromotionProductsData((prev) => [copiedData, ...prev]);
        } else if (data.section === 'ギフト') {
          setGiftProductsData((prev) => [copiedData, ...prev]);
        }
      },
      [reveal]
    );

    // 参照表からのコピー：
    // ・企画／企画名／確度は未選択（空＝「ー」表示）
    // ・計画函数／NET／納価／売価／マージン率の変更後は 0
    //   （変更前との差分が増減に +/▲ 表示される）
    //   ※変更前（基準値）は参照値としてそのまま引き継ぐ
    // ・拡売費①②はすべて空（「ー」表示）にする。ただし計上年月は詳細の対象期間 from の翌月を設定する
    // ・参照表は詳細の対象期間内の明細だけを表示するため、対象年月はそのまま引き継ぐ
    const handleReferenceCopyRow = useCallback(
      (data: ProductData) => {
        const postingMonth = addMonths(targetPeriodFrom, 1);
        handleCopyRow({
          ...data,
          campaign: '',
          campaignName: '',
          probability: '',
          plan: '0',
          net: '0',
          planPrice: '0',
          price: '0',
          margin: '0',
          ...EMPTY_EXPENSE_FIELDS,
          exp1PostingMonth: postingMonth,
          exp2PostingMonth: postingMonth,
          _copySource: 'reference',
        });
        toast.success('参照表からコピーしました。');
      },
      [handleCopyRow, targetPeriodFrom]
    );

    // ギフト：上旬/中旬/下旬の3行を1セットとして追加（plans=各期間の箱数=計画函数）。
    const handleAddGiftSet = useCallback(
      (base: Partial<ProductData>, plans: [string, string, string]) => {
        const seq = Date.now();
        const newId = newGiftSetId();
        // 追加したセット（3行）は1計画として同じ計画キーを共有する。
        const planKey = `plan-new-${seq}-${Math.floor(Math.random() * 1e6)}`;
        const rows: ProductData[] = GIFT_PERIODS.map((period, i) =>
          initSimRow({
            ...makeEmptyProduct('ギフト'),
            ...base,
            section: 'ギフト',
            productCategory: 'ギフト',
            giftSetId: newId,
            period,
            plan: plans[i] ?? '0',
            id: `new-${seq}-${i}`,
            // 追加した行の作成者はログインユーザー
            exp1Creator: CURRENT_USER_NAME,
            exp2Creator: CURRENT_USER_NAME,
            _addedSeq: seq,
            _planKey: planKey,
            _copySource: 'new',
          } as ProductData)
        );
        setGiftProductsData((prev) => [...rows, ...prev]);
      },
      []
    );

    // ギフト：セットをまるごと複製して新規セット（3行）を追加（コピー由来）。
    // handleAddGiftSet と同一だが、id と追加経路（カラーバー）をコピー扱いにする。
    const handleAddCopiedGiftSet = useCallback(
      (base: Partial<ProductData>, plans: [string, string, string]) => {
        const seq = Date.now();
        const newId = newGiftSetId();
        // 追加したセット（3行）は1計画として同じ計画キーを共有する。
        // コピー由来のため接頭辞は plan-copy-（Sim卸 handleAddCopiedGiftSet と統一）。
        const planKey = `plan-copy-${seq}-${Math.floor(Math.random() * 1e6)}`;
        const rows: ProductData[] = GIFT_PERIODS.map((period, i) =>
          initSimRow({
            ...makeEmptyProduct('ギフト'),
            ...base,
            section: 'ギフト',
            productCategory: 'ギフト',
            giftSetId: newId,
            period,
            plan: plans[i] ?? '0',
            id: `copy-${seq}-${i}`,
            // コピーで作られた行の作成者はログインユーザー
            exp1Creator: CURRENT_USER_NAME,
            exp2Creator: CURRENT_USER_NAME,
            _addedSeq: seq,
            _planKey: planKey,
            _copySource: 'detail' as const,
          } as ProductData)
        );
        // コピーした3行（上旬/中旬/下旬）すべてを強調対象にする
        reveal.markRows(rows.map((r) => String(r.id)));
        setGiftProductsData((prev) => [...rows, ...prev]);
      },
      [reveal]
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
            const merged = {
              ...r,
              ...base,
              section: 'ギフト',
              productCategory: 'ギフト',
              giftSetId,
              period: r.period,
              plan,
            } as ProductData;
            // 納価・NET・売価・函数の変更に合わせて算出列（マージン率・値入率・
            // 社外売上高・管理利益など）を再計算する（セル編集時と同一の算出）。
            computeDerived(merged);
            return merged;
          })
        );
        // セル編集を通らない値更新のため rowData を作り直して新値を反映する。
        bumpGridRebuild();
      },
      [bumpGridRebuild]
    );

    // ギフト：セットの現在値を取得（編集ペインの初期表示用）。
    const getGiftSet = useCallback(
      (
        giftSetId: string
      ): { base: ProductData; plans: [string, string, string] } | null => {
        const rows = giftProductsData
          .filter((r) => r.giftSetId === giftSetId)
          .sort(
            (a, b) => giftPeriodIndex(a.period) - giftPeriodIndex(b.period)
          );
        if (rows.length === 0) return null;
        return {
          base: rows[0],
          plans: [
            rows[0]?.plan ?? '',
            rows[1]?.plan ?? '',
            rows[2]?.plan ?? '',
          ],
        };
      },
      [giftProductsData]
    );

    // 親から ref 経由で addCopiedRow を呼べるようにする
    useImperativeHandle(ref, () => ({
      addCopiedRow: (data: ProductData) => {
        handleCopyRow({ ...data, _copySource: 'detail' });
      },
      addNewRow: (overrides: Partial<ProductData> & { section: string }) => {
        const { section } = overrides;
        const list =
          section === '定番商品'
            ? regularProductsData
            : section === '新商品'
              ? newProductsData
              : section === '特殊商品'
                ? promotionProductsData
                : giftProductsData;
        const base =
          list[0] ??
          regularProductsData[0] ??
          newProductsData[0] ??
          promotionProductsData[0] ??
          giftProductsData[0];
        if (!base) return;
        handleCopyRow({
          ...base,
          // テンプレ行の拡売費は引き継がず一旦空に（フォーム入力があれば overrides で上書き）
          ...EMPTY_EXPENSE_FIELDS,
          // 新規行は確度・企画を空にする（テンプレ行が反映済/不採用でも
          // 「反映済/不採用を除く」フィルタで消えず、合計行直下に表示されるように）
          probability: '',
          campaign: '',
          campaignName: '',
          // 明細追加は新しい計画として扱う（テンプレ行 base の計画キーを引き継がない）
          _planKey: `plan-new-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          ...overrides,
          // base から引き継ぐ古い値を上書きするため末尾で 'new' を設定
          _copySource: 'new',
        } as ProductData);
      },
      updateRow: (data: ProductData) => {
        const upd = (prev: ProductData[]) =>
          prev.map((item) =>
            item.id === data.id ? { ...item, ...data } : item
          );
        setRegularProductsData(upd);
        setNewProductsData(upd);
        setPromotionProductsData(upd);
        setGiftProductsData(upd);
        // 明細編集ペインの更新はセル編集を通らず node.data が未更新のため、rowData を作り直す。
        bumpGridRebuild();
      },
      // 明細削除：ギフトはセット単位（giftSetId）、その他は一意な id で除去
      deleteRow: (target: ProductData | ProductData['id']) => {
        const row =
          target != null && typeof target === 'object' ? target : null;
        if (row?.section === 'ギフト' && row.giftSetId) {
          setGiftProductsData((prev) =>
            prev.filter((item) => item.giftSetId !== row.giftSetId)
          );
          return;
        }
        const id = row ? row.id : target;
        if (id == null) return;
        const del = (prev: ProductData[]) =>
          prev.filter((item) => item.id !== id);
        setRegularProductsData(del);
        setNewProductsData(del);
        setPromotionProductsData(del);
        setGiftProductsData(del);
      },
      addGiftSet: handleAddGiftSet,
      syncCampaignName: handleSyncCampaignName,
      addCopiedGiftSet: handleAddCopiedGiftSet,
      updateGiftSet: handleUpdateGiftSet,
      getGiftSet,
      // 保存時：帯（_copySource）と編集セルの黄色強調を消し、保存した値を新たな元値とする
      clearSavedMarks: () => {
        const saved = {
          regular: stripCopySource(regularProductsData),
          new: stripCopySource(newProductsData),
          promotion: stripCopySource(promotionProductsData),
          gift: stripCopySource(giftProductsData),
        };
        savedRowsRef.current = saved;
        setRegularProductsData(saved.regular);
        setNewProductsData(saved.new);
        setPromotionProductsData(saved.promotion);
        setGiftProductsData(saved.gift);
        resetChangedCells();
        // 保存した値（帯の除去を含む）はセル編集を通らないため、rowData を作り直す。
        bumpGridRebuild();
        setTimeout(
          () => mainGridApiRef.current?.refreshCells({ force: true }),
          0
        );
      },
    }));

    // 明細コピー：ペインを開かず、明細グリッドへ直接行を複製する。
    // ギフトは上旬/中旬/下旬の3行を1セットとしてまとめて複製する。
    const handleCopyClick = useCallback(
      (data: ProductData) => {
        if (data.section === 'ギフト' && data.giftSetId) {
          const set = getGiftSet(data.giftSetId);
          if (set) {
            handleAddCopiedGiftSet(set.base, set.plans);
            toast.success('明細をコピーしました。');
            return;
          }
        }
        handleCopyRow({ ...data, _copySource: 'detail' });
        toast.success('明細をコピーしました。');
      },
      [getGiftSet, handleAddCopiedGiftSet, handleCopyRow]
    );

    // 経費対象（expTarget）のチェックの更新
    const handleUpdateRegularProduct = useCallback(
      (updatedData: ProductData) => {
        setRegularProductsData((prev) =>
          prev.map((item) => (item.id === updatedData.id ? updatedData : item))
        );
      },
      []
    );

    const handleUpdateNewProduct = useCallback((updatedData: ProductData) => {
      setNewProductsData((prev) =>
        prev.map((item) => (item.id === updatedData.id ? updatedData : item))
      );
    }, []);

    const handleUpdatePromotionProduct = useCallback(
      (updatedData: ProductData) => {
        setPromotionProductsData((prev) =>
          prev.map((item) => (item.id === updatedData.id ? updatedData : item))
        );
      },
      []
    );

    const handleUpdateGiftProduct = useCallback((updatedData: ProductData) => {
      setGiftProductsData((prev) =>
        prev.map((item) => (item.id === updatedData.id ? updatedData : item))
      );
    }, []);

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
        // 商品区分「特売」はセクション名「特殊商品」へ読み替える。
        const newSection = categoryToSection(newCategory);
        const rows = buildCategoryChangeRows(sourceRows, newCategory, {
          newGiftSetId,
          newRowId: (i) => `new-${seq}-${i}`,
          section: newSection,
          // 計画函数は変更前／変更後とも販売期間ごとの値のため合算・分配の対象にする
          periodFields: ['plan', 'planBefore', 'planAfter'],
        });
        if (rows.length === 0) return;
        const removedIds = new Set(sourceRows.map((r) => r.id));
        // 変更前のセクションの配列から取り除き、変更後のセクションの配列へ入れ替える。
        const replaceIn =
          (section: string) =>
          (prev: ProductData[]): ProductData[] => {
            const kept = prev.filter((r) => !removedIds.has(r.id));
            return newSection === section ? [...kept, ...rows] : kept;
          };
        setRegularProductsData(replaceIn('定番商品'));
        setNewProductsData(replaceIn('新商品'));
        setPromotionProductsData(replaceIn('特殊商品'));
        setGiftProductsData(replaceIn('ギフト'));
        // 「全て」以外のタブでは、別タブへ切り替えるまで変更した行を表示中のタブに残す
        if (activeTab !== 'all') {
          setHeldRowKeys((prev) => {
            const next = new Set(prev);
            rows.forEach((r) => next.add(heldRowKeyOf(r)));
            return next;
          });
        }
      },
      [giftProductsData, activeTab]
    );

    // 編集セルの変更ハイライト（黄＋オレンジ枠）：共通フックで変更セル・元値を追跡する（→ 02 §7.2）。
    // 元値に戻したら強調を解除する。色付けは各列の cellStyle で isCellChanged を見て行う。
    const { isCellChanged, trackCellChange, resetChangedCells } =
      useChangedCells();
    // 未保存の入力を破棄し、保存済みの明細へ戻す（詳細の対象期間の変更時）。
    // 編集セルの強調と、商品区分の変更でタブに残している行も解除する。
    const discardUnsavedEdits = () => {
      const saved = savedRowsRef.current;
      setRegularProductsData(saved.regular);
      setNewProductsData(saved.new);
      setPromotionProductsData(saved.promotion);
      setGiftProductsData(saved.gift);
      setHeldRowKeys(new Set());
      resetChangedCells();
      // 保存済みの明細へ戻す値はセル編集を通らないため、rowData を作り直す。
      bumpGridRebuild();
      setTimeout(
        () => mainGridApiRef.current?.refreshCells({ force: true }),
        0
      );
    };

    // 詳細の対象期間の変更を確認ダイアログへ回す（同じ値の再選択は何もしない）
    const requestPeriodChange = (
      current: string,
      next: string,
      apply: (value: string) => void
    ) => {
      if (next === current) return;
      setPendingPeriodApply(() => () => {
        discardUnsavedEdits();
        apply(next);
      });
    };

    // 列の定義（最初の描画で1回だけ作る。処理は utilsDetailColumns.tsx）
    const [columnDefs] = useState<(ColDef | ColGroupDef)[]>(() =>
      buildDetailColumnDefs({
        allDataRef,
        handleSyncCampaignName,
        handleUpdateRegularProduct,
        handleUpdateNewProduct,
        handleUpdatePromotionProduct,
        handleUpdateGiftProduct,
        isCellChanged,
        makeLinkedHandler,
      })
    );

    // 計算式セルのクリック中、算出元セルの枠線を強調するフック（計画詳細と同一の仕組み）。
    const formulaHL = useFormulaSourceHighlight<ProductData>(SIM_FORMULA_DEFS, {
      isEligibleRow: (r) => !(r as any)._isHeader && r.metaBrand !== '合計',
    });

    // 列状態（列幅・ソート・固定・表示）を localStorage へ保存／復元する共通フック。
    // 画面独自の onGridReady（API 保持・計算式ハイライトの API 捕捉）は option 経由で連結する。
    const gridColumnStateProps = useGridColumnState(
      'Sim.detail.columnState.v3',
      {
        onGridReady: (e: GridReadyEvent) => {
          mainGridApiRef.current = e.api;
          formulaHL.captureApi(e.api);
        },
      }
    );

    const defaultColDef: ColDef = useMemo(
      () => ({
        ...GRID_DEFAULT_COL_DEF,
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

    // Undo履歴を維持するため props の参照を安定させる（→ 02 §7.1）
    const gridColumnDefs = useMemo(
      () => withHeaderTooltips(columnDefs),
      [columnDefs]
    );
    const gridDefaultColDef = useMemo<ColDef>(
      () => ({
        ...defaultColDef,
        menuTabs: ['generalMenuTab', 'columnsMenuTab'],
        // 計算式セルは計算式テキスト、それ以外は従来どおりセル値を表示する
        tooltipValueGetter: formulaHL.tooltipValueGetter,
        // 計算式セルのクリックで算出元セルを枠線強調
        cellClassRules: {
          // 共通の既定列設定のルール（値が無いセルの「-」をグレー等）を引き継ぐ
          ...GRID_DEFAULT_COL_DEF.cellClassRules,
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
      [defaultColDef, formulaHL]
    );

    // 表示対象の行（タブ・保留行・「反映済を除く」「不採用を除く」・追加順の並べ替えを適用）。
    const visibleRows = useMemo(() => {
      // 商品区分を変更して保留中の行は、別タブへ切り替えるまで表示中のタブに残す
      const byTab = periodData.filter((item) =>
        isRowInActiveTab(item, activeTab, heldRowKeys)
      );
      // 「反映済を除く」「不採用を除く」がチェックされている場合は該当行を非表示
      const filtered = byTab.filter((item) => {
        if (shouldExcludeReflected && item.probability === '反映済')
          return false;
        if (shouldExcludeRejected && item.probability === '不採用')
          return false;
        return true;
      });
      // 明細追加・コピーで採番した行（_addedSeq あり）を、商品区分によらず
      // 合計行直下（先頭）へ新しい順で並べる。既存行は元の順序を維持（安定ソート）。
      const sorted = [...filtered].sort(
        (a, b) => (b._addedSeq ?? 0) - (a._addedSeq ?? 0)
      );
      return sorted;
    }, [
      periodData,
      activeTab,
      heldRowKeys,
      shouldExcludeReflected,
      shouldExcludeRejected,
    ]);

    // 列フィルタを通過した行のID（フィルタ無しは null）。合計行を表示中の明細だけで計算し直すために使う
    // （10/27 第4回 決定事項19・画面設計標準 4.4 ③）。公式の onFilterChanged／forEachNodeAfterFilter で取得する。
    const [filteredRowIds, setFilteredRowIds] = useState<Set<string> | null>(
      null
    );
    const collectFilteredRowIds = useCallback((api: GridApi) => {
      if (!api.isAnyFilterPresent()) {
        setFilteredRowIds(null);
        return;
      }
      const ids = new Set<string>();
      api.forEachNodeAfterFilter((node) => {
        if (node.id) ids.add(node.id);
      });
      setFilteredRowIds(ids);
    }, []);
    const handleFilterChanged = useCallback(
      (e: FilterChangedEvent) => collectFilteredRowIds(e.api),
      [collectFilteredRowIds]
    );
    // 行の追加・削除や区分タブの切替の後は、フィルタを掛け直した結果で取り直す。
    const handleRowDataUpdated = useCallback(
      (e: RowDataUpdatedEvent) => {
        collectFilteredRowIds(e.api);
        reveal.onRowDataUpdated(e);
      },
      [collectFilteredRowIds, reveal]
    );

    // 合計行（表の最上行に固定する青帯の行）。確度が混ざった明細の単純合計で、
    // 表示中の明細（区分タブ・反映済／不採用を除く・列フィルタの結果）だけを合計する。
    const pinnedTotalRows = useMemo(() => {
      const targetRows = visibleRows.filter(
        (row) => !filteredRowIds || filteredRowIds.has(String(row.id))
      );
      // ギフトは上旬/中旬/下旬の3行1セット。販売期間・計画函数以外はセル結合されて
      // 3行で1つの値の表示になるため、セット代表行だけを集計して三重計上を防ぐ（計画詳細と同じ）。
      const countedGiftSets = new Set<string>();
      const mergedRows = targetRows.filter((row) => {
        if (!row.giftSetId) return true;
        if (countedGiftSets.has(row.giftSetId)) return false;
        countedGiftSets.add(row.giftSetId);
        return true;
      });
      const sumOf = (rows: ProductData[], field: keyof ProductData): string =>
        String(
          rows.reduce((sum, row) => {
            const value = parseMetric(row[field] as string);
            return sum + (isNaN(value) ? 0 : value);
          }, 0)
        );
      // ％の列は合計せず、分子・分母の合算から率を求める（計画詳細と同じ。分母が0なら「-」）
      const rates = planDetailTotalRatesOf(
        mergedRows,
        'marginRateFixed',
        costUnitPriceOf
      );
      const rateText = (value: number): string =>
        Number.isFinite(value) ? String(value) : '';
      const profitAmount = Number(sumOf(mergedRows, 'managementProfitAmount'));
      const netSales = Number(sumOf(mergedRows, 'netSales'));
      const total: Partial<ProductData> = {
        id: 'pinned-total',
        section: '合計',
        targetMonth: '合計',
        metaBrand: '合計',
        // 計画函数はギフトも行ごとに値が異なる（セル結合対象外）ため全行を集計する
        plan: sumOf(targetRows, 'plan'),
        planBefore: sumOf(targetRows, 'planBefore'),
        // NET・納価・売価・入数は単価・単位のため合計しない（空欄＝「-」表示）
        margin: rateText(rates.margin),
        discount: rateText(rates.discount),
        managementProfitAmount: String(profitAmount),
        managementProfitRate: netSales
          ? formatPlanRate((profitAmount / netSales) * 100, 2)
          : '',
        netSales: String(netSales),
        externalSales: sumOf(mergedRows, 'externalSales'),
        exp1PlannedAmount: sumOf(mergedRows, 'exp1PlannedAmount'),
        exp1PlannedAmountBefore: sumOf(mergedRows, 'exp1PlannedAmountBefore'),
        exp2PlannedAmount: sumOf(mergedRows, 'exp2PlannedAmount'),
        exp2PlannedAmountBefore: sumOf(mergedRows, 'exp2PlannedAmountBefore'),
      };
      return [total];
      // parseMetric は純粋関数のため依存に含めない
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleRows, filteredRowIds]);

    // 行の構造シグネチャ（表示行の行ID＋ギフトセット＋挿入順）。セル値の編集では変化せず、
    // 行の追加・削除・コピー、タブ・期間・絞り込みの切替などで表示行が変わったときだけ変化する。
    // これを rowData 作り直しのきっかけにし、値編集では rowData 参照を変えない
    // ＝AG Grid の Undo/Redo 履歴を維持する（rowData 参照が変わると公式仕様で履歴がクリアされる。
    // セル値は AG Grid がノードの data を直接更新し、state へは onCellValueChanged で同期する → 02 §7.1）。
    const rowStructureSignature = useMemo(
      () =>
        visibleRows
          .map((r) => `${r.id}#${r.giftSetId ?? ''}#${r._addedSeq ?? ''}`)
          .join('|'),
      [visibleRows]
    );

    // グリッドへ渡す行データ（ギフトのセル結合用の印を付与）
    const rowData = useMemo(() => {
      // ギフトの3行1セットをセル結合するため、セット単位で
      // 先頭行(_giftFirst＋行数_giftSpan)・中央行(_giftMiddle：操作アイコン表示)・
      // 最終行(_giftLast：操作列の下罫線)を付与する。
      const annotated = visibleRows.map((row) => ({
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
      // visibleRows は本文で参照するが依存には含めない（値編集で rowData 参照を変えず
      // Undo 履歴を維持するため、作り直しは構造シグネチャ／再構築トークンの変化時のみに限定）。
      // 構造変化・セル編集を通らない値更新の時点では visibleRows が最新のため、作り直す値も最新。
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rowStructureSignature, gridRebuildToken]);

    const getRowStyle = asRowStyle(
      useCallback((params: RowClassParams) => {
        // ピン留めされた行（合計行）
        if (params.node.rowPinned) {
          return {
            backgroundColor: GRID_COLORS.total, // 合計行：薄青（gridStyles準拠）
            fontWeight: 'bold',
          };
        }

        // 確度に基づいてグレーアウト
        const probability = params.data?.probability;
        if (probability === '反映済') {
          return {
            backgroundColor: GRID_COLORS.readonly, // gray-200 - 薄いグレー
          };
        }
        if (probability === '不採用') {
          return {
            backgroundColor: REJECTED_BG, // 不採用 - より薄いグレー（変更可）
          };
        }

        // 通常の行は背景色を設定せず、CSSのホバー効果を優先
        return {};
      }, [])
    );

    return (
      <>
        {/* シミュレーション（詳細）の中身（カードの枠・見出しは親の開閉カード〔CollapsibleCard〕が持つため、ここでは枠を付けない → 05「白カード」・UX-065） */}
        <div>
          <div className="pb-4">
            {/* 1段目: タイトル、計画コピー対象月、コピーボタン、函数計画の初期表示 */}
            <div className="flex items-center gap-2 flex-nowrap">
              {/* 対象期間（詳細ヘッダー1段目に常時表示。集計の対象期間とは連動しない） */}
              <div>
                <SimulationPeriodPicker
                  fromId={DETAIL_PERIOD_FROM_ID}
                  ariaLabelPrefix="詳細の対象期間"
                  disabledMonths={SIMULATION_CLOSED_MONTHS}
                  fromPeriod={targetPeriodFrom}
                  toPeriod={targetPeriodTo}
                  onFromPeriodChange={(v) =>
                    requestPeriodChange(
                      targetPeriodFrom,
                      v,
                      onTargetPeriodFromChange
                    )
                  }
                  onToPeriodChange={(v) =>
                    requestPeriodChange(
                      targetPeriodTo,
                      v,
                      onTargetPeriodToChange
                    )
                  }
                />
              </div>

              {/* 参照ボタン：自計画を参照し、コピーで明細へ行追加 */}
              <button
                type="button"
                onClick={() => setIsReferencePaneShown((prev) => !prev)}
                className={`flex items-center gap-1 ml-2 px-3 py-1 text-sm whitespace-nowrap ${BUTTON_STYLES.outline} ${BUTTON_BASE}`}
              >
                <FileSearch className="w-4 h-4" />
                販売計画(コピー元)
              </button>

              {/* 行の追加経路（コピー由来）を示すカラーバー凡例 */}
              <CopySourceLegend className="ml-2" />
            </div>

            {/* 2段目: セグメントタブ */}
            <div className="flex items-center gap-2 mt-2">
              {/* 商品区分の切替（自販機・計画詳細と同じ共通部品 SegmentToggle → 02 §6・UI/UX UX-090） */}
              <SegmentToggle
                ariaLabel="商品区分"
                options={[
                  { value: 'all', label: '全て' },
                  { value: '定番商品', label: '定番商品' },
                  { value: '新商品', label: '新商品' },
                  { value: '特殊商品', label: '特売' },
                  { value: 'ギフト', label: 'ギフト' },
                ]}
                value={activeTab}
                onChange={(tab) => switchTab(tab)}
              />

              {/* 反映済を除く */}
              <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap ml-4">
                <input
                  type="checkbox"
                  checked={shouldExcludeReflected}
                  onChange={(e) => setShouldExcludeReflected(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className={FORM_LABEL_CLASS}>反映済を除く</span>
              </label>

              {/* 不採用を除く */}
              <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap ml-2">
                <input
                  type="checkbox"
                  checked={shouldExcludeRejected}
                  onChange={(e) => setShouldExcludeRejected(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className={FORM_LABEL_CLASS}>不採用を除く</span>
              </label>

              {/* 右端配置ボタン */}
              <div className="flex items-center gap-2 ml-auto">
                {/* 明細追加ボタン */}
                <button
                  onClick={() =>
                    handleAddRow(activeTab === 'all' ? '' : activeTab)
                  }
                  className={`${BUTTON_STYLES.outline} ${BUTTON_BASE} px-3 py-1 whitespace-nowrap text-sm`}
                  aria-label="＋明細追加"
                >
                  ＋明細追加
                </button>
              </div>
            </div>
          </div>

          {/* AG Grid Table（1920x1080 のPCで画面いっぱいに表示）
            減算値 11.25rem = ヘッダ・フッタ・カード下余白の固定高。最下部までスクロールした
            状態でグリッド本体が画面高にちょうど収まる値（カード見出し・ツールバーは
            スクロールアウトしてよい方針）。 */}
          <div
            ref={gridContainerRef}
            className="sales-detail-grid"
            style={{
              height: viewportGridHeight(11.25),
              minHeight: '25rem',
              width: '100%',
            }}
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

                    /* 罫線・ヘッダ背景は共通テーマ（GRID_THEME＝支払申請一覧参照と同一）に統一。
                       個別の border-right / ヘッダ背景の上書きは行わない。 */
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
                       白・グレー系（反映済・不採用のグレーアウト含む）も含め、
                       行内の全セルをブルーにする。 */
                    .sales-detail-grid .ag-row-hover:not(.ag-full-width-row):not(.ag-row-pinned) .ag-cell,
                    .sales-detail-grid .ag-row-hover:not(.ag-full-width-row):not(.ag-row-pinned) .ag-cell[style*="background-color"] {
                      background-color: var(--grid-row-hover) !important;
                    }
                    /* マイナス値の赤字表示を維持（ホバー時も） */
                    .sales-detail-grid .ag-cell[style*="color: rgb(220, 38, 38)"] {
                      color: var(--grid-decrease-text) !important;
                    }
                    .sales-detail-grid .ag-row-hover:not(.ag-full-width-row):not(.ag-row-pinned) .ag-cell[style*="color: rgb(220, 38, 38)"] {
                      color: var(--grid-decrease-text) !important;
                    }
                    .sales-detail-grid .ag-row-pinned-top {
                      border-top: 2px solid var(--grid-pinned-row-border);
                    }
                    .sales-detail-grid .ag-row-pinned-top .ag-cell:hover {
                      background-color: var(--grid-total) !important; /* 合計行（薄青）はホバーエフェクトを維持 */
                    }
                    /* 編集中のセルはクリーム色を強調 */
                    .sales-detail-grid .ag-cell-inline-editing[style*="background-color: rgb(255, 255, 255)"] {
                      background-color: var(--grid-editing-bg) !important;
                      box-shadow: 0 0 0 2px var(--grid-editing-border) inset;
                    }
                  `}</style>
            <AgGridReact
              rowData={rowData}
              // 行が反映された後に、コピーした新規行を可視域へ送って強調する
              onRowDataUpdated={handleRowDataUpdated}
              // 合計行（表の最上行に固定）。列フィルタの変更で表示中の明細だけの合計に計算し直す
              pinnedTopRowData={pinnedTotalRows}
              onFilterChanged={handleFilterChanged}
              columnDefs={gridColumnDefs}
              // ギフトの3行1セルをセル結合（rowSpan）するために必須
              suppressRowTransform={true}
              onCellMouseOver={formulaHL.onCellMouseOver}
              onCellMouseOut={formulaHL.onCellMouseOut}
              // 計算式をツールチップで見せるため、省略されていないセルでも出す（グローバルは whenTruncated）
              tooltipShowMode="standard"
              tooltipShowDelay={300}
              tooltipHideDelay={5000}
              onCellValueChanged={(params: any) => {
                // 編集済みセルを記録（元値に戻したら解除）し、当該セルを再描画して
                // 黄色＋オレンジ枠（changedCellStyle）を反映する
                trackCellChange(params);
                params.api.refreshCells({
                  rowNodes: [params.node],
                  columns: [params.column.getColId()],
                  force: true,
                });
              }}
              defaultColDef={gridDefaultColDef}
              getContextMenuItems={gridFilterContextMenuItems}
              statusBar={GRID_STATUS_BAR}
              getRowStyle={getRowStyle}
              getRowId={getDetailRowId}
              ensureDomOrder={true}
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
              {...gridColumnStateProps}
              {...GRID_BASE_PROPS}
            />
          </div>
        </div>

        {/* 参照用下ペイン：自計画を参照し、コピーで明細へ行を追加。
          プッシュ式：親画面に被さらず中身を押し上げるため、参照表と明細表を同時に視認できる。 */}
        <BottomPane
          open={isReferencePaneShown}
          onClose={() => setIsReferencePaneShown(false)}
          title="販売計画(コピー元)"
        >
          <SimulationReferenceTable
            rows={referenceRows}
            onCopyRow={handleReferenceCopyRow}
            showWholesaleMesh={false}
            fromPeriod={targetPeriodFrom}
            toPeriod={targetPeriodTo}
          />
        </BottomPane>

        {/* 詳細の対象期間変更の確認: 明細を取り直すため、未保存の入力の破棄を確認する */}
        <ConfirmDialog
          open={pendingPeriodApply !== null}
          title="対象期間変更の確認"
          confirmLabel="変更"
          description="入力中のデータが破棄されます。本当によろしいですか？"
          onConfirm={() => {
            const apply = pendingPeriodApply;
            setPendingPeriodApply(null);
            apply?.();
          }}
          onCancel={() => setPendingPeriodApply(null)}
        />
      </>
    );
  }
);
