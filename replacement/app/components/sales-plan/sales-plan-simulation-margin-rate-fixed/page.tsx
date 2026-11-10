import { useState, useRef, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Save, Undo2 } from 'lucide-react';

import { Button } from '../../ui/button';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { SimulationBasicInfoPane } from '../../shared/sales-plan/simulation/SimulationBasicInfoPane';
import { BASIC_INFO_DEALER } from '../../../constants/planBasicInfoMockData';
import { AGGREGATION_PERIOD_FROM_ID } from '../../shared/sales-plan/simulation/SimulationPeriodPicker';
import { AggregationPane } from './components/AggregationPane';
import { DetailTable } from './components/DetailTable';
import type { DetailTableHandle, ProductData } from './components/DetailTable';
import { RightPane } from '../../ui/right-pane';
import { DeleteConfirmPane } from '../../ui/delete-confirm-pane';
import { Input } from '../../ui/input';
import { TEXT_INPUT_CLASS, CARD_CLASS } from '../../../../styles/commonStyles';
import { Label } from '../../ui/label';
import { MonthYearPicker } from '../../ui/month-year-picker';
import {
  isInPeriod,
  thisYearDecember,
  thisYearJanuary,
} from '../../../utils/common/yearMonth';
import { NumericInput } from '../../ui/numeric-input';
import {
  PLAN_DETAIL_DIGITS,
  formatPlanAmountText,
  formatPlanRateText,
} from '../../../utils/sales-plan/common/planDetailNumberFormat';
import { SingleCombobox } from '../../ui/single-combobox';
import {
  campaignComboOptions,
  registeredCampaignName,
} from '../../../utils/sales-plan/simulation/simulationCampaignName';
import { ExpenseBlockFields } from '../../shared/sales-plan/common/ExpenseBlockFields';
import { RequiredBadge } from '../../ui/required-badge';
import { DetailProductSelector } from '../../shared/sales-plan/common/DetailProductSelector';
import {
  hasSameSimulationKey,
  simulationKeyDuplicateMessage,
  confirmBlockReason,
} from '../../../utils/sales-plan/simulation/simulationConfirmRules';
import {
  isNetInputMonth,
  tradeSystemOf,
} from '../../../utils/sales-plan/simulation/tradeSystem';
import {
  CAMPAIGN_OPTIONS,
  EMPTY_DETAIL_FORM,
  PROBABILITY_OPTIONS,
  SIMULATION_CAMPAIGN_SUMMARY_ROWS,
  type DetailFormValues,
} from '../../../constants/simulationSalesPlanMockData';
import { buildExpenseFields } from '../../../constants/expenseRelations';
import {
  getPromotionLabels,
  hasPromotionOptions,
  PROMOTION_NONE_LABEL,
  CATEGORY_OPTIONS_MARGIN,
} from '../../../constants/promotionCategories';
import { promotionComboOptions } from '../../../constants/comboFieldOptions';
import { simulationKeyItems } from '../../../constants/planDeleteItems';
import { SimulationExpenseDeleteInfo } from '../../shared/sales-plan/simulation/SimulationExpenseDeleteInfo';
// 販促区分の必須判定は販売計画表と共有（promotionCategoryHelpers 単一ソース）。
import { promotionValid } from '../../../constants/promotionCategoryHelpers';
import { ScreenTitle } from '../../ui/screen-title';

// ── モックデータ ────────────────────────────────────────────

// コメント履歴のモックデータ

// 施策区分・施策コードの選択肢（SingleCombobox で選択／検索）

// 非活性項目の表示補完。空（undefined/null/空文字）は Grid と同様に「-」を表示する。
const dashIfEmpty = (v: any): string =>
  v === undefined || v === null || v === '' ? '-' : String(v);

const sectionToCategory = (section: string): string => {
  if (section.includes('新商品')) return '新商品';
  if (section.includes('特殊商品')) return '特売';
  if (section === 'ギフト') return 'ギフト';
  return '定番商品';
};

// 商品区分 → 詳細テーブルのセクション名（sectionToCategory の逆変換）。
// 当画面の商品区分は「特売」だが詳細テーブル上のセクション名は「特殊商品」のため読み替える。
// 未知の値は定番商品へ寄せる（詳細テーブル側の既定がギフトのため素通しさせない）。
const categoryToSection = (category: string): string => {
  if (category === '新商品') return '新商品';
  if (category === '特売' || category === '特殊商品') return '特殊商品';
  if (category === 'ギフト') return 'ギフト';
  return '定番商品';
};

// 量販の商品区分（卸の「特殊商品」は量販では「特売」）
const RETAIL_CATEGORY_OPTIONS = CATEGORY_OPTIONS_MARGIN;

// 企画・確度・対象月の選択肢（明細ペイン用）

// 反映済はシステムが付与する状態のため手動選択不可

// 未入力の必須項目名を列挙してトースト文言にする。
const requiredMsg = (fields: string[]): string =>
  `${fields.join('・')}を入力してください。`;

// 明細フォームの未入力必須項目名を列挙する。
// 必須：サマリ商品名・計画函数・企画・確度・企画名・対象年月・販促区分（選択肢を持つ区分）。
//       拡売費①②は任意入力（拡売費なしの明細もある）で、管理コード/管理区分/計画金額/計上年月の
//       いずれかに入力がある場合のみ、その4項目を必須とする。
//       企画名はKEYには含まないが入力必須（KEY項目は補足5-2を参照）。
//       計画函数はギフトのみ上旬/中旬/下旬の3入力で、3つとも必須。
// 任意：NET・納価・マージン率・売価・売上原価・社外売上高・入数・売買差益率・
//       値入率・商品区分・拡売費の摘要・拡売費の施策コード/施策区分（明細1行がキーとなる）。
// ギフトは上旬/中旬/下旬の3行1セット（箱数入力）に置換したため、販売期間の必須チェックは廃止。
// 拡売費①の必須項目（管理コード・管理区分・計画金額・計上年月）が全て未入力かを判定する。
// 全て未入力の間は拡売費②を非活性にし、①→②の順で入力させる。
const EXP_REQUIRED_SUFFIXES = [
  'ManagementCode',
  'ManagementClass',
  'PlannedAmount',
  'PostingMonth',
] as const;
const isExp1Empty = (f: any): boolean =>
  EXP_REQUIRED_SUFFIXES.every(
    (suffix) => String(f?.[`exp1${suffix}`] ?? '').trim() === ''
  );

// 拡売費②の必須項目（管理コード・管理区分・計画金額・計上年月）のいずれかに入力があるかを判定する。
// 管理区分名称・管理コード名称は管理区分・管理コードと同じ値を持つため判定対象に含まれる。
// 施策区分・施策コード・摘要1のみの入力は「入力あり」とみなさない。
const hasExp2Input = (f: any): boolean =>
  EXP_REQUIRED_SUFFIXES.some(
    (suffix) => String(f?.[`exp2${suffix}`] ?? '').trim() !== ''
  );

const detailMissingFields = (f: any): string[] => {
  const m: string[] = [];
  if (String(f.summaryProduct ?? '').trim() === '') m.push('サマリ商品名');
  // 計画函数は必須。ギフトは上旬/中旬/下旬の3行1セットで追加するため3つとも必須。
  const planMissing =
    f.category === 'ギフト'
      ? ['boxEarly', 'boxMid', 'boxLate'].some(
          (key) => String(f[key] ?? '').trim() === ''
        )
      : String(f.plan ?? '').trim() === '';
  if (planMissing) m.push('計画函数');
  if (String(f.campaign ?? '').trim() === '') m.push('企画');
  if (String(f.campaignName ?? '').trim() === '') m.push('企画名');
  if (String(f.probability ?? '').trim() === '') m.push('確度');
  if (String(f.targetMonth ?? '').trim() === '') m.push('対象年月');
  if (!promotionValid(f)) m.push('販促区分');
  const expSuffixLabels: Array<[string, string]> = [
    ['ManagementCode', '管理コード'],
    ['ManagementClass', '管理区分'],
    ['PlannedAmount', '計画金額'],
    ['PostingMonth', '計上年月'],
  ];
  // 拡売費①②とも、必須項目のいずれかに入力がある場合のみ必須（拡売費なしの明細もある）
  const expPrefixes: Array<'exp1' | 'exp2'> = [
    ...(isExp1Empty(f) ? [] : (['exp1'] as const)),
    ...(hasExp2Input(f) ? (['exp2'] as const) : []),
  ];
  expPrefixes.forEach((prefix) => {
    const prefixLabel = prefix === 'exp1' ? '拡売費①' : '拡売費②';
    expSuffixLabels.forEach(([suffix, label]) => {
      if (String(f[`${prefix}${suffix}`] ?? '').trim() === '')
        m.push(`${prefixLabel}${label}`);
    });
  });
  return m;
};

interface SalesPlanSimulationMarginRateFixedProps {
  // 計画詳細へ戻るときの画面遷移コールバック
  onMenuChange?: (menuId: string) => void;
}

export default function SalesPlanSimulationMarginRateFixed({
  onMenuChange,
}: SalesPlanSimulationMarginRateFixedProps) {
  // 戻る・保存の確認ダイアログ表示状態
  const [isBackConfirmShown, setIsBackConfirmShown] = useState(false);
  const [isSaveConfirmShown, setIsSaveConfirmShown] = useState(false);

  // 下ペインの状態管理
  // 明細テーブルの全行（追加可否・確定排他の判定に使用）
  const [allDetailRows, setAllDetailRows] = useState<ProductData[]>([]);
  const [campaignSummaryRows, setCampaignSummaryRows] = useState<ProductData[]>(
    SIMULATION_CAMPAIGN_SUMMARY_ROWS
  );

  // 確度プルダウンの選択肢を生成。確定の排他に該当する場合は「確定」を除外し、理由を返す。
  const buildProbabilityOptions = (pseudoRow: {
    id?: string;
    summaryProduct?: string;
    probability?: string;
    _planKey?: string;
  }) => {
    const reason = confirmBlockReason(
      {
        id: pseudoRow.id,
        summaryProduct: pseudoRow.summaryProduct ?? '',
        probability: pseudoRow.probability,
        _planKey: pseudoRow._planKey,
      },
      allDetailRows
    );
    const selfConfirmed =
      pseudoRow.probability === '確定' || pseudoRow.probability === '反映済';
    const blockConfirm = reason != null && !selfConfirmed;
    const options = (
      blockConfirm
        ? PROBABILITY_OPTIONS.filter((c) => c !== '確定')
        : PROBABILITY_OPTIONS
    ).map((c) => ({ value: c, label: c }));
    return { options, reason: blockConfirm ? reason : null };
  };

  // 対象期間（YYYY/MM）。シミュレーション（集計）とシミュレーション（詳細）はそれぞれ独立して
  // 対象期間を持ち、連動させない（6/16 第9回 決定9。業務上、集計と詳細で表示したい期間が
  // 異なる場合があるため）。初期値はいずれも当年1月〜12月。
  // 集計の対象期間：集計エリアで入力し、グラフ・詳細・企画単位集計にかける。
  const [aggFromPeriod, setAggFromPeriod] = useState(thisYearJanuary);
  const [aggToPeriod, setAggToPeriod] = useState(thisYearDecember);
  // 詳細の対象期間：詳細のヘッダーで入力し、明細表・参照用下ペインにかける。
  // 明細追加ペインの対象年月もこの期間内のみ選択可能にするため画面側で保持する。
  const [detailFromPeriod, setDetailFromPeriod] = useState(thisYearJanuary);
  const [detailToPeriod, setDetailToPeriod] = useState(thisYearDecember);
  // 集計表へ渡す明細（対象期間内の対象年月のみ）。allDetailRows は確定排他の判定に
  // 期間外の明細も含めて使うため、絞り込みは集計表へ渡す分だけに行う。
  const periodDetailRows = useMemo(
    () =>
      allDetailRows.filter((row) =>
        isInPeriod(row.targetMonth ?? '', aggFromPeriod, aggToPeriod)
      ),
    [allDetailRows, aggFromPeriod, aggToPeriod]
  );

  // 先頭入力（集計の対象期間 from）へ初期フォーカス。描画確定後に id で取得して focus する。
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      document.getElementById(AGGREGATION_PERIOD_FROM_ID)?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // 明細系右ペインの状態管理
  const [isAddDetailPaneShown, setIsAddDetailPaneShown] = useState(false);
  const [isDeleteDetailPaneShown, setIsDeleteDetailPaneShown] = useState(false);
  const [detailSection, setDetailSection] = useState<string>('');
  const [detailData, setDetailData] = useState<any>(null);

  // 販売計画(詳細)コピー用
  const detailTableRef = useRef<DetailTableHandle>(null);

  // 明細追加・編集フォーム
  const [addForm, setAddForm] = useState<DetailFormValues>(EMPTY_DETAIL_FORM);
  const [isAddSubmitted, setIsAddSubmitted] = useState(false);

  // 取引制度の判定（明細追加ペイン）。
  // 販売店・1次店/3次店（遷移元の計画詳細から引き継ぐ基本情報）と、ペインで入力された
  // 対象年月・サマリ商品名をキーに固定マージン率／NET入力を判定する。モックには判定用の
  // マスタが無いため、グリッドと同じく対象年月の月の偶奇で代用する。
  // 対象年月が未入力の間は判定できないため、NETは非活性とする。
  const addTradeSystem = tradeSystemOf(addForm.targetMonth);
  const addNetEditable = isNetInputMonth(addForm.targetMonth);

  // 販売計画(集計)の「集計対象設定」右ペイン。他の右ペインと排他表示するため親で管理する。
  // （集計単位①②・除外ペアの値は集計コンポーネント側で保持するため開閉しても失われない）
  const [isAggFilterPaneShown, setIsAggFilterPaneShown] = useState(false);

  // すべての右ペインを閉じるヘルパー関数
  const closeAllRightPanes = () => {
    setIsAddDetailPaneShown(false);
    setIsDeleteDetailPaneShown(false);
    setIsAggFilterPaneShown(false);
  };

  // ペイン元のボタン/リンクを押下するたびに開閉を切り替えるヘルパー
  // 既に開いている場合は全ペインを閉じ、閉じている場合は対象ペインのみ開く
  const togglePane = (isOpen: boolean, openFn: () => void) => {
    closeAllRightPanes();
    if (!isOpen) openFn();
  };

  // 明細追加ペインの追加実行。
  // continuous=true（連続追加）はペインを開いたままフォームを初期化し、
  // false（追加）は他ペインと同様にペインを閉じる。
  const handleAddDetailSubmit = (continuous: boolean) => {
    setIsAddSubmitted(true);
    // 必須項目チェック。未入力の項目名を列挙してトースト表示する。
    const addMissing = detailMissingFields(addForm);
    if (addMissing.length) {
      toast.error(requiredMsg(addMissing));
      return;
    }
    // シミュレーション更新KEYが同じ明細があれば追加しない（VL-06。入力は保持する）
    const isDuplicated = hasSameSimulationKey(
      {
        targetMonth: addForm.targetMonth,
        campaign: addForm.campaign,
        probability: addForm.probability,
        summaryProduct: addForm.summaryProduct,
        wholesaleMesh: addForm.wholesaleMesh,
        section: categoryToSection(addForm.category),
        promotion: addForm.promotion,
        net: addForm.net,
        planPrice: addForm.deliveryPrice,
        // ギフトは上旬/中旬/下旬の3行1セットのため、上旬で判定する
        period: addForm.category === 'ギフト' ? '上旬' : undefined,
      },
      allDetailRows,
      (row) => isNetInputMonth(row.targetMonth)
    );
    if (isDuplicated) {
      toast.error(simulationKeyDuplicateMessage('追加'));
      return;
    }
    // 合計行の直下（先頭）に新規明細を追加する。
    // 計画函数は必須項目のため、ここに来る時点で入力済み。
    // 追加先セクションはフォームで選択中の商品区分から決める（どの＋から開いたかではない）。
    // ペインで商品区分を変更した場合も、選択どおりのセクションへ追加される。
    const section = categoryToSection(addForm.category);
    const commonFields = {
      section,
      productCategory: addForm.category || '定番商品',
      wholesaleMesh: addForm.wholesaleMesh,
      summaryProduct: addForm.summaryProduct,
      metaBrand: addForm.metaBrand,
      containerCapacityG: addForm.containerCapacityG,
      quantity: addForm.quantity,
      endSale: addForm.endSale,
      promotion: addForm.promotion,
      // 必須項目（企画/確度/企画名/対象年月）を新規行にも保存する
      campaign: addForm.campaign,
      probability: addForm.probability,
      campaignName: addForm.campaignName,
      targetMonth: addForm.targetMonth,
      net: addForm.net,
      planPrice: addForm.deliveryPrice,
      delivery: addForm.deliveryPrice,
      price: addForm.price,
      ...buildExpenseFields(addForm),
    };
    if (section === 'ギフト') {
      // ギフトは上旬/中旬/下旬の3行1セットで追加（各期間の箱数=計画）
      detailTableRef.current?.addGiftSet(commonFields, [
        addForm.boxEarly.trim() || '0',
        addForm.boxMid.trim() || '0',
        addForm.boxLate.trim() || '0',
      ]);
    } else {
      detailTableRef.current?.addNewRow({
        ...commonFields,
        plan: addForm.plan.trim() || '0',
      });
    }
    // ペインで企画名を変えた場合も、同じ対象年月・同じ企画の明細へ連動する
    detailTableRef.current?.syncCampaignName(
      addForm.targetMonth,
      addForm.campaign,
      addForm.campaignName
    );
    setAddForm({ ...EMPTY_DETAIL_FORM, category: addForm.category });
    setIsAddSubmitted(false);
    if (!continuous) setIsAddDetailPaneShown(false);
    toast.success('明細を追加しました。');
  };

  // 明細追加ペインを開く
  const handleOpenAddDetail = (section: string) => {
    const isOpen = isAddDetailPaneShown && detailSection === section;
    closeAllRightPanes();
    if (isOpen) return;
    setDetailSection(section);
    setAddForm({
      ...EMPTY_DETAIL_FORM,
      category: sectionToCategory(section),
    });
    setIsAddSubmitted(false);
    setIsAddDetailPaneShown(true);
  };

  // 明細削除ペインを開く
  const handleOpenDeleteDetail = (data: any) => {
    const isOpen = isDeleteDetailPaneShown && detailData === data;
    closeAllRightPanes();
    if (isOpen) return;
    setDetailData(data);
    setIsDeleteDetailPaneShown(true);
  };

  // 検索エリア（追加用）
  const [, setOpen] = useState(false);

  // 検索エリア（編集用）
  const [, setEditOpen] = useState(false);

  // 検索エリア（コピー用）
  const [, setCopyOpen] = useState(false);

  // リスト外クリック時にリスト表示を閉じる
  const wrapperRef = useRef(null);
  const editWrapperRef = useRef(null);
  const copyWrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
      if (
        editWrapperRef.current &&
        !editWrapperRef.current.contains(event.target)
      ) {
        setEditOpen(false);
      }
      if (
        copyWrapperRef.current &&
        !copyWrapperRef.current.contains(event.target)
      ) {
        setCopyOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden bg-gray-100">
      {/* 左ペイン：メインコンテンツ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* スクロール可能エリア */}
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <div className="min-w-300">
            <div className="px-6 pt-3 pb-2">
              {/* 画面名はヘッダー（システム名の右）に表示する */}
              <ScreenTitle title="販売計画シミュレーション(マージン率固定・NET入力)" />

              {/* 販売計画条件エリア */}
              <section aria-labelledby="search-heading">
                <h2 id="search-heading" className="sr-only">
                  検索条件
                </h2>
                <SimulationBasicInfoPane
                  tradingSystem="マージン率固定"
                  dealer={BASIC_INFO_DEALER}
                />
              </section>

              {/* 販売計画(集計)エリア */}
              <section aria-labelledby="aggregation-heading" className="mb-6">
                <h2 id="aggregation-heading" className="sr-only">
                  販売計画(集計)
                </h2>
                <AggregationPane
                  campaignData={campaignSummaryRows}
                  detailRows={periodDetailRows}
                  aggFilterPaneOpen={isAggFilterPaneShown}
                  onToggleAggFilterPane={() =>
                    togglePane(isAggFilterPaneShown, () =>
                      setIsAggFilterPaneShown(true)
                    )
                  }
                  onCloseAggFilterPane={() => setIsAggFilterPaneShown(false)}
                  fromPeriod={aggFromPeriod}
                  toPeriod={aggToPeriod}
                  onFromPeriodChange={setAggFromPeriod}
                  onToPeriodChange={setAggToPeriod}
                />
              </section>

              {/* 販売計画(詳細) */}
              <section className="mb-4" aria-labelledby="detail-card-heading">
                <h2 id="detail-card-heading" className="sr-only">
                  販売計画(詳細)
                </h2>
                {/* 白カード（→ 05 白カード） */}
                <div className={`${CARD_CLASS} p-4`}>
                  <DetailTable
                    ref={detailTableRef}
                    onOpenAddDetail={handleOpenAddDetail}
                    onOpenDeleteDetail={handleOpenDeleteDetail}
                    onCampaignDataChange={setCampaignSummaryRows}
                    onRowsChange={setAllDetailRows}
                    targetPeriodFrom={detailFromPeriod}
                    targetPeriodTo={detailToPeriod}
                    onTargetPeriodFromChange={setDetailFromPeriod}
                    onTargetPeriodToChange={setDetailToPeriod}
                    aggregationPeriodFrom={aggFromPeriod}
                    aggregationPeriodTo={aggToPeriod}
                  />
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* アクションボタン。data-screen-footer は下ペインが上へドックする目印で、
            下ペイン表示中もこのバーは画面最下部に表示されたままになる。 */}
        <div
          data-screen-footer
          className="bg-white border-t border-gray-200 px-6 py-2 flex-shrink-0"
        >
          <div className="flex flex-wrap gap-3 justify-between">
            <div>
              <Button
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50 h-9 rounded-lg"
                onClick={() => setIsBackConfirmShown(true)}
              >
                <Undo2 className="h-4 w-4 mr-2" />
                計画詳細へ戻る
              </Button>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <Button
                className="bg-blue-500 hover:bg-blue-600 text-white h-9 rounded-lg"
                onClick={() => setIsSaveConfirmShown(true)}
              >
                <Save className="h-4 w-4 mr-2" />
                保存/反映
              </Button>
            </div>
          </div>
        </div>

        {/* 企画単位集計は集計表（AggregationPane）側へ移設 */}
      </div>

      {/* 右ペイン：明細追加 */}
      <RightPane
        open={isAddDetailPaneShown}
        onClose={() => setIsAddDetailPaneShown(false)}
        title="明細追加"
        description="明細を追加します"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => handleAddDetailSubmit(true)}
            >
              連続追加
            </Button>
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => handleAddDetailSubmit(false)}
            >
              追加
            </Button>
          </div>
        }
      >
        <div className="flex flex-col h-full">
          {/* 検索エリア */}
          <div className="bg-white p-4 border-b border-gray-300">
            <div className="space-y-3">
              {/* 対象年月。シミュレーションは対象期間が複数月にわたり、新商品に該当するかが
                  対象年月によって変わるため、商品選択より先に入力させる
                  （対象年月 → 商品区分 → 新商品のみ表示 → サマリ商品名。メタブランド・容器容量Gは自動反映）。 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  対象年月 <RequiredBadge />
                </Label>
                <div
                  className={
                    isAddSubmitted && !String(addForm.targetMonth ?? '').trim()
                      ? 'rounded-md ring-1 ring-red-500'
                      : ''
                  }
                >
                  {/* シミュレーション（詳細）の対象期間内のみ選択可能にする。
                      期間外の月を選べると、追加した明細が表示中の明細に表示されないため */}
                  <MonthYearPicker
                    required
                    className="w-full"
                    value={addForm.targetMonth || ''}
                    // 企画名は対象年月×企画ごとのため、選択中の企画の企画名を取り直す
                    onChange={(v) =>
                      setAddForm((p) => ({
                        ...p,
                        targetMonth: v,
                        campaignName: p.campaign
                          ? registeredCampaignName(allDetailRows, v, p.campaign)
                          : p.campaignName,
                      }))
                    }
                    min={detailFromPeriod}
                    max={detailToPeriod}
                    clearable
                  />
                </div>
              </div>
              {/* 商品選択（販売計画(卸)と同等：サマリ商品名/メタブランド/容器容量G/新商品のみ表示） */}
              <DetailProductSelector
                useWholesaleMesh={false}
                categoryOptions={RETAIL_CATEGORY_OPTIONS}
                showCategorySelect={true}
                category={addForm.category}
                onCategoryChange={(v) =>
                  setAddForm({ ...EMPTY_DETAIL_FORM, category: v })
                }
                summaryProduct={addForm.summaryProduct}
                wholesaleMesh={addForm.wholesaleMesh}
                metaBrand={addForm.metaBrand}
                containerCapacityG={addForm.containerCapacityG}
                onSelectSummaryProduct={(p) =>
                  setAddForm((prev) => ({
                    ...prev,
                    summaryProduct: p.value,
                    metaBrand: p.metaBrand,
                    containerCapacityG: p.containerCapacityG,
                    wholesaleMesh: p.wholesaleMesh,
                    quantity: p.quantity,
                    promotion: p.promotion,
                    currentEstimate: p.currentEstimate,
                    currentActual: p.currentActual,
                    prevYearActual: p.prevYearActual,
                    net: p.net,
                    deliveryPrice: p.deliveryPrice,
                    price: p.price,
                    margin: p.margin,
                    costOfSales: p.costOfSales,
                    seihan: p.seihan,
                    profitRate: p.profitRate,
                    discountRate: p.discountRate,
                    endSale: p.endSale,
                  }))
                }
                onSelectWholesaleMesh={(m) =>
                  setAddForm((prev) => ({
                    ...prev,
                    wholesaleMesh: m.value,
                    metaBrand: m.metaBrand,
                    containerCapacityG: m.containerCapacityG,
                    quantity: m.quantity,
                    currentEstimate: m.currentEstimate,
                    currentActual: m.currentActual,
                    prevYearActual: m.prevYearActual,
                    net: m.net,
                  }))
                }
                // メタブランド・容器容量Gは常に非活性（サマリ商品名の選択で自動反映。絞り込みには使わない）
                autoFillOnly
                onClearPrimary={() =>
                  setAddForm((prev) => ({
                    ...prev,
                    summaryProduct: '',
                    wholesaleMesh: '',
                    metaBrand: '',
                    containerCapacityG: '',
                  }))
                }
                submitted={isAddSubmitted}
                newProductBaseMonth={addForm.targetMonth}
                requireNewProductBaseMonth
                // 商品区分が「新商品」なら、対象年月の入力後に『新商品のみ表示』を初期チェック（課題No.0374）
                onlyNewByDefaultForNewCategory
              />
            </div>
          </div>

          {/* 入力フォームエリア（コンテナ幅に応じて 1→2→3 列に変動） */}
          <div className="flex-1 overflow-y-auto bg-white p-4">
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 @md:grid-cols-2 @2xl:grid-cols-3">
              {/* 企画 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  企画 <RequiredBadge />
                </Label>
                <div
                  className={
                    isAddSubmitted && !String(addForm.campaign ?? '').trim()
                      ? 'rounded-md ring-1 ring-red-500'
                      : ''
                  }
                >
                  <SingleCombobox
                    ariaRequired
                    // 使用中の企画は企画名を併記する
                    options={campaignComboOptions(
                      CAMPAIGN_OPTIONS,
                      allDetailRows,
                      addForm.targetMonth
                    )}
                    value={addForm.campaign}
                    // 同じ対象年月・同じ企画に登録済みの企画名を設定する（無ければ空欄）
                    onChange={(v) =>
                      setAddForm((p) => ({
                        ...p,
                        campaign: v,
                        campaignName: registeredCampaignName(
                          allDetailRows,
                          p.targetMonth,
                          v
                        ),
                      }))
                    }
                    placeholder="企画を選択"
                    clearable
                  />
                </div>
              </div>

              {/* 企画名：企画に付随する名称。KEYには含まないが入力必須 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  企画名 <RequiredBadge />
                </Label>
                <Input
                  aria-required="true"
                  value={addForm.campaignName}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, campaignName: e.target.value }))
                  }
                  placeholder="企画名を入力"
                  className={`${TEXT_INPUT_CLASS} w-full ${isAddSubmitted && !String(addForm.campaignName ?? '').trim() ? 'ring-1 ring-red-500' : ''}`}
                />
              </div>

              {/* 確度 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  確度 <RequiredBadge />
                </Label>
                {(() => {
                  const { options, reason } = buildProbabilityOptions({
                    summaryProduct: addForm.summaryProduct,
                    probability: addForm.probability,
                  });
                  return (
                    <>
                      <div
                        className={
                          isAddSubmitted &&
                          !String(addForm.probability ?? '').trim()
                            ? 'rounded-md ring-1 ring-red-500'
                            : ''
                        }
                      >
                        <SingleCombobox
                          ariaRequired
                          options={options}
                          value={addForm.probability}
                          onChange={(v) =>
                            setAddForm((p) => ({ ...p, probability: v }))
                          }
                          placeholder="確度を選択"
                          clearable
                        />
                      </div>
                      {reason && (
                        <p className="text-xs text-red-600">{reason}</p>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* 販促区分（任意） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  販促区分 <RequiredBadge />
                </Label>
                {addForm.category === 'ギフト' ||
                addForm.category === '特殊商品' ? (
                  // 特殊商品・ギフトは販促区分が区分名で固定のため非活性表示
                  <Input
                    aria-required="true"
                    value={addForm.category}
                    readOnly
                    className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
                  />
                ) : hasPromotionOptions(addForm.category) ? (
                  <div
                    className={
                      isAddSubmitted && !addForm.promotion.trim()
                        ? 'rounded-md ring-1 ring-red-500'
                        : ''
                    }
                  >
                    <SingleCombobox
                      ariaRequired
                      options={promotionComboOptions(
                        getPromotionLabels(addForm.category)
                      )}
                      value={addForm.promotion}
                      onChange={(v) =>
                        setAddForm((p) => ({
                          ...p,
                          promotion: v,
                        }))
                      }
                      placeholder="販促区分を選択"
                      clearable
                    />
                  </div>
                ) : (
                  <Input
                    aria-required="true"
                    value={PROMOTION_NONE_LABEL}
                    readOnly
                    className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
                  />
                )}
              </div>

              {/* 終売区分：サマリ商品名の選択に紐づいて自動表示されるため非活性 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  終売区分
                </Label>
                <Input
                  value={dashIfEmpty(addForm.endSale)}
                  readOnly
                  className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
                />
              </div>

              {/* 計画函数（ギフトは上旬/中旬/下旬ごとの箱数を入力） */}
              {addForm.category === 'ギフト' ? (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">
                    計画函数：上旬／中旬／下旬 <RequiredBadge />
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ['上旬', 'boxEarly'],
                        ['中旬', 'boxMid'],
                        ['下旬', 'boxLate'],
                      ] as const
                    ).map(([label, key]) => (
                      <div key={key} className="space-y-1">
                        <span className="block text-xs text-gray-500">
                          {label}
                        </span>
                        <NumericInput
                          aria-required="true"
                          value={addForm[key]}
                          /* 計画函数は整数のみ入力可 */
                          maxFractionDigits={0}
                          onChange={(e) =>
                            setAddForm((p) => ({
                              ...p,
                              [key]: e.target.value,
                            }))
                          }
                          placeholder="計画函数"
                          className={
                            isAddSubmitted && !String(addForm[key] ?? '').trim()
                              ? 'w-full bg-white border-gray-400 shadow-sm ring-1 ring-red-500 focus:ring-2 focus:ring-blue-500'
                              : 'w-full bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500'
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">
                    計画函数 <RequiredBadge />
                  </Label>
                  <NumericInput
                    aria-required="true"
                    value={addForm.plan}
                    /* 計画函数は整数のみ入力可 */
                    maxFractionDigits={0}
                    onChange={(e) =>
                      setAddForm((p) => ({
                        ...p,
                        plan: e.target.value,
                      }))
                    }
                    placeholder="計画函数を入力"
                    className={
                      isAddSubmitted && !String(addForm.plan ?? '').trim()
                        ? 'w-full bg-white border-gray-400 shadow-sm ring-1 ring-red-500 focus:ring-2 focus:ring-blue-500'
                        : 'w-full bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500'
                    }
                  />
                </div>
              )}

              {/* NET。判定した取引制度で活性/非活性を切り替える
                  （NET入力＝手入力、固定マージン率＝納価×マージン率から算出のため非活性）。 */}
              <div className="space-y-1.5">
                <Label
                  className={
                    addNetEditable
                      ? 'text-sm font-medium text-gray-700'
                      : 'text-sm font-medium text-gray-400'
                  }
                >
                  NET
                </Label>
                <NumericInput
                  value={addForm.net}
                  maxFractionDigits={PLAN_DETAIL_DIGITS.price}
                  disabled={!addNetEditable}
                  onChange={(e) =>
                    setAddForm((p) => ({
                      ...p,
                      net: e.target.value,
                    }))
                  }
                  placeholder="NET（任意）"
                  className={
                    addNetEditable
                      ? 'w-full bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500'
                      : 'w-full bg-gray-100 border-gray-300 text-gray-600 cursor-not-allowed'
                  }
                />
                <span className="text-xs text-gray-500">
                  {addTradeSystem === null
                    ? '対象年月を選択すると取引制度を判定します。'
                    : addTradeSystem === 'fixedMargin'
                      ? '固定マージン率のため、NETは入力できません。'
                      : 'NET入力のため、NETを入力できます。'}
                </span>
              </div>

              {/* 納価 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  納価
                </Label>
                <NumericInput
                  value={addForm.deliveryPrice}
                  maxFractionDigits={PLAN_DETAIL_DIGITS.price}
                  onChange={(e) =>
                    setAddForm((p) => ({
                      ...p,
                      deliveryPrice: e.target.value,
                    }))
                  }
                  placeholder="納価（任意）"
                  className="w-full bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* マージン率 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  マージン率
                </Label>
                <Input
                  value={formatPlanRateText(
                    addForm.margin,
                    PLAN_DETAIL_DIGITS.marginRate
                  )}
                  readOnly
                  className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
                />
              </div>

              {/* 売価 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  売価
                </Label>
                <NumericInput
                  value={addForm.price}
                  maxFractionDigits={PLAN_DETAIL_DIGITS.amount}
                  onChange={(e) =>
                    setAddForm((p) => ({
                      ...p,
                      price: e.target.value,
                    }))
                  }
                  placeholder="売価（任意）"
                  className="w-full bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 売上原価（非活性） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  売上原価
                </Label>
                <Input
                  value={formatPlanAmountText(
                    addForm.costOfSales,
                    PLAN_DETAIL_DIGITS.amount
                  )}
                  readOnly
                  className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
                />
              </div>

              {/* 社外売上高（非活性） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  社外売上高
                </Label>
                <Input
                  value={formatPlanAmountText(
                    addForm.seihan,
                    PLAN_DETAIL_DIGITS.amount
                  )}
                  readOnly
                  className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
                />
              </div>

              {/* 入数（非活性） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  入数
                </Label>
                <Input
                  value={addForm.quantity}
                  readOnly
                  className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
                />
              </div>

              {/* 売買差益率（非活性） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  売買差益率
                </Label>
                <Input
                  value={formatPlanRateText(
                    addForm.profitRate,
                    PLAN_DETAIL_DIGITS.rate
                  )}
                  readOnly
                  className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
                />
              </div>

              {/* 値入率（非活性） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  値入率
                </Label>
                <Input
                  value={formatPlanRateText(
                    addForm.discountRate,
                    PLAN_DETAIL_DIGITS.rate
                  )}
                  readOnly
                  className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
                />
              </div>

              {/* 拡売費①（全幅・内部もコンテナ幅に応じて変動） */}
              <div className="space-y-3 border-t border-gray-300 pt-3 @md:col-span-2 @2xl:col-span-3">
                <div className="text-sm font-bold text-gray-700">拡売費①</div>
                <ExpenseBlockFields
                  prefix="exp1"
                  form={addForm}
                  setForm={setAddForm}
                  submitted={isAddSubmitted}
                  required={!isExp1Empty(addForm)}
                  campaignRequired={false}
                />
              </div>

              {/* 拡売費②（全幅・内部もコンテナ幅に応じて変動） */}
              <div className="space-y-3 border-t border-gray-300 pt-3 @md:col-span-2 @2xl:col-span-3">
                <div className="text-sm font-bold text-gray-700">拡売費②</div>
                <ExpenseBlockFields
                  prefix="exp2"
                  form={addForm}
                  setForm={setAddForm}
                  submitted={isAddSubmitted}
                  required={hasExp2Input(addForm)}
                  campaignRequired={false}
                  disabled={isExp1Empty(addForm)}
                />
              </div>
            </div>
          </div>
        </div>
      </RightPane>

      {/* 右ペイン：明細削除確認（共通部品 DeleteConfirmPane） */}
      <DeleteConfirmPane
        open={isDeleteDetailPaneShown}
        onClose={() => setIsDeleteDetailPaneShown(false)}
        title="明細削除の確認"
        description="明細を削除します"
        // 削除対象は業務KEY項目（補足5-2）で示し、拡売費①②の内訳を children で続ける
        items={simulationKeyItems('marginNet', detailData)}
        onDelete={() => {
          // 対象明細をグリッドから削除（ギフトはセット単位で削除）
          if (detailData?.id != null) {
            detailTableRef.current?.deleteRow(detailData);
          }
          setIsDeleteDetailPaneShown(false);
          toast.success('明細を削除しました。');
        }}
      >
        <SimulationExpenseDeleteInfo data={detailData} />
      </DeleteConfirmPane>

      {/* 戻る（画面移動）の確認 */}
      <ConfirmDialog
        open={isBackConfirmShown}
        title="画面移動の確認"
        confirmLabel="移動"
        description="入力中のデータが破棄されます。本当によろしいですか？"
        onConfirm={() => {
          setIsBackConfirmShown(false);
          // 遷移元の計画詳細へ戻る（未保存の入力は破棄する）
          onMenuChange?.('plan-detail-margin-rate-fixed');
        }}
        onCancel={() => setIsBackConfirmShown(false)}
      />

      {/* 保存の確認 */}
      <ConfirmDialog
        open={isSaveConfirmShown}
        title="保存の確認"
        confirmLabel="保存"
        description="シミュレーションを保存します。対象となるすべての販売計画表のデータを更新します。本当によろしいですか？"
        onConfirm={() => {
          setIsSaveConfirmShown(false);
          // 保存後は帯の色と編集セルの黄色強調を消す（計画詳細と同じ）
          detailTableRef.current?.clearSavedMarks();
          toast.success('シミュレーションを保存しました。');
        }}
        onCancel={() => setIsSaveConfirmShown(false)}
      />
    </div>
  );
}
