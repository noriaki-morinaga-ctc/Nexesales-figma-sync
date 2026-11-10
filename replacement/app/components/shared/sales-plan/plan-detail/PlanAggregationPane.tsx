import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  TrendingUp,
  CalendarRange,
  SlidersHorizontal,
} from 'lucide-react';
import { RotateCcw } from 'lucide-react';

import { Label } from '../../../ui/label';
import { Checkbox } from '../../../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../../../ui/radio-group';
import { CollapsibleCard } from '../../../ui/collapsible-card';
import { RightPane } from '../../../ui/right-pane';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { MultiCombobox } from '../../../ui/multi-combobox';
import {
  AggregationFilter,
  type ExcludePair,
} from '../common/AggregationFilter';
import {
  META_BRAND_OPTIONS,
  CONTAINER_CAPACITY_OPTIONS,
} from '../../../../constants/aggregationAxisMaster';
import {
  computePeriods,
  computeMonthsRange,
  monthsForPeriod,
  displayOf,
  type AggAmounts,
  type ExpenseMonthBasis,
} from '../../../../utils/sales-plan/common/aggregationCalc';
import {
  EMPTY_AGGREGATION_SOURCE,
  type AggregationSource,
} from '../../../../constants/aggregationSourceData';
import {
  canViewActualCost,
  resolveCostAxis,
  COST_AXIS_LABELS,
  type CostAxis,
} from '../../../../utils/sales-plan/common/costUnitPrice';
import { DEFAULT_COMMON_RATE_SETTINGS } from '../../../../constants/commonRateSettings';
import { DEFAULT_TARGET_MONTH_IDX0 } from '../../../../constants/defaultAggregationSource';
import { useResizableHeight, ResizeHandle } from '../../../ui/resizable-panel';
import { makeTreeValueFor } from '../../../../utils/sales-plan/common/aggregationTreeValue';
import {
  AggregationItemTreeTable,
  type AggTreePeriodTab,
} from '../common/AggregationItemTreeTable';
import { AnnualTotalTab } from './AnnualTotalTab';
import { PromotionCostTotalTab } from './PromotionCostTotalTab';
import {
  FORM_LABEL_CLASS,
  BUTTON_STYLES,
  BUTTON_BASE,
} from '../../../../../styles/commonStyles';
import { monthIndex0Of } from '../../../../utils/common/yearMonth';
import {
  PLAN_DETAIL_DIGITS,
  formatPlanRate,
} from '../../../../utils/sales-plan/common/planDetailNumberFormat';
import {
  budgetRateColor,
  diffTextColor,
  previousYearRateColor,
} from '../../../../utils/sales-plan/common/aggregationCardColors';

interface PlanAggregationPaneProps {
  // 対象年月（販売計画エリアの対象年月。集計値・「○月合計」表記を駆動する）
  targetYearMonth?: string;
  // 集計対象設定ペインの開閉。右ペインは画面で常に1つのみ表示するため、
  // 他の右ペインと同様に親画面（closeAllRightPanes／togglePane）で管理する。
  // 未指定時は本コンポーネント内で開閉を保持する（単体利用時のフォールバック）。
  aggFilterPaneOpen?: boolean;
  onToggleAggFilterPane?: () => void;
  onCloseAggFilterPane?: () => void;
  // 集計ソース（販売計画(詳細)・拡売費計画グリッド由来）。未指定時は空＝全項目0。
  source?: AggregationSource;
  // 詳細タブの項目ドリルダウンの開閉状態を localStorage へ保存するときのキー（画面ごとに一意）。
  // 省略時は保存せず、従来どおり常に全て折りたたんだ状態で表示する。
  expandStateKey?: string;
  // 年間集計・拡売費集計タブの基準月も対象年月に連動させるか（計画詳細の手売り2画面で指定）。
  // 未指定時は各タブ内の累計月選択で基準月を選ぶ。
  linkTotalTabsToTargetMonth?: boolean;
}

export function PlanAggregationPane({
  targetYearMonth = '2025/10',
  aggFilterPaneOpen,
  onToggleAggFilterPane,
  onCloseAggFilterPane,
  source = EMPTY_AGGREGATION_SOURCE,
  expandStateKey,
  linkTotalTabsToTargetMonth = false,
}: PlanAggregationPaneProps = {}) {
  const [isOpen, setIsOpen] = useState(true);
  // 対象年月は基本情報（PlanSearchPane）の対象年月に従う。
  // selectedMonth は「○月合計」「1〜○月累計」の表記と、集計対象月の両方を駆動する。
  // 月の解釈は utils/common/yearMonth の monthIndex0Of に集約する（page.tsx の月別展開と基準を揃えるため）。
  const monthIdx0 = monthIndex0Of(targetYearMonth) ?? DEFAULT_TARGET_MONTH_IDX0;
  const selectedMonth = String(monthIdx0 + 1);
  // 「A口のみ集計」チェック状態（初期＝チェックなし）。true で拡売費A口2費目のみ集計。
  const [isAOnlyPromo, setIsAOnlyPromo] = useState(false);
  // 拡売費集計対象選択（対象月／計上月）。拡売費の集計月をどちらの年月で見るかを切り替える。
  const [expenseMonthBasis, setExpenseMonthBasis] =
    useState<ExpenseMonthBasis>('target');
  // 原価軸（実原価／支社受渡原価）。補足2-3：権限のあるユーザーのみ切替できる。
  const [costAxis, setCostAxis] = useState<CostAxis>('transfer');
  // 実原価の閲覧権限。無い場合は切替トグル自体を表示しない（補足2-3 FR-0074-11）。
  const canSwitchCostAxis = canViewActualCost();
  // 表示単位（円／千円）。金額の桁が大きいため既定は千円。
  const [displayUnit, setDisplayUnit] = useState<'yen' | 'thousand'>(
    'thousand'
  );
  // 集計単位選択①＝メタブランド、②＝容器容量G（いずれも複数選択）─ 課題0290
  // 確定値：右ペインの「確定」を押下したときのみ更新され、集計対象として扱う。
  const [selectedMetaBrands, setSelectedMetaBrands] = useState<string[]>([]);
  const [selectedContainerCapacities, setSelectedContainerCapacities] =
    useState<string[]>([]);
  // 掛け合わせ（①×②）のうち集計対象外にする除外ペア（確定値）
  const [excludePairs, setExcludePairs] = useState<ExcludePair[]>([]);
  // 編集値：右ペインでの入力内容。確定するまで確定値へは反映しない。
  const [draftMetaBrands, setDraftMetaBrands] = useState<string[]>([]);
  const [draftContainerCapacities, setDraftContainerCapacities] = useState<
    string[]
  >([]);
  const [draftExcludePairs, setDraftExcludePairs] = useState<ExcludePair[]>([]);
  // 集計対象設定の右ペイン（センターフィ率と同様のスライドイン）開閉。
  // 親から開閉を渡された場合はそちらに従い、他の右ペインと排他表示にする。
  // 集計単位①②・除外ペアの値は本コンポーネントで保持するため、開閉しても保持される。
  const [isInternalAggFilterPaneOpen, setIsInternalAggFilterPaneOpen] =
    useState(false);
  const showAggFilterPane = aggFilterPaneOpen ?? isInternalAggFilterPaneOpen;
  const handleToggleAggFilterPane = () => {
    if (onToggleAggFilterPane) onToggleAggFilterPane();
    else setIsInternalAggFilterPaneOpen((v) => !v);
  };
  const handleCloseAggFilterPane = () => {
    if (onCloseAggFilterPane) onCloseAggFilterPane();
    else setIsInternalAggFilterPaneOpen(false);
  };
  // ペインを開いたときに編集値を確定値で初期化する。
  // 確定せずに閉じた場合は編集内容を破棄し、次に開くと確定値から編集し直す。
  useEffect(() => {
    if (!showAggFilterPane) return;
    setDraftMetaBrands(selectedMetaBrands);
    setDraftContainerCapacities(selectedContainerCapacities);
    setDraftExcludePairs(excludePairs);
    // 開いた時点の確定値のみを取り込むため、確定値は依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAggFilterPane]);
  // 集計単位①②・除外ペアの編集値をすべて初期化する（確認ダイアログなしで即時リセット）。
  // 確定値は変わらないため、確定を押すまで集計対象は変化しない。
  const handleResetAggFilter = () => {
    setDraftMetaBrands([]);
    setDraftContainerCapacities([]);
    setDraftExcludePairs([]);
  };
  // 編集値を確定値へ反映してペインを閉じる。集計対象が更新されるのはこのタイミングのみ。
  const handleSubmitAggFilter = () => {
    setSelectedMetaBrands(draftMetaBrands);
    setSelectedContainerCapacities(draftContainerCapacities);
    setExcludePairs(draftExcludePairs);
    handleCloseAggFilterPane();
  };
  // 集計単位①（メタブランド）の変更。選択から外れた値を含む除外ペアも同時に取り除く
  // （brand が空＝「除外ペアを追加」直後の未入力行は残す）。集計単位と除外ペアの整合を保つ。
  const handleChangeMetaBrands = (next: string[]) => {
    setDraftMetaBrands(next);
    setDraftExcludePairs((pairs) =>
      pairs.filter((p) => !p.brand || next.includes(p.brand))
    );
  };
  // 集計単位②（容器容量G）の変更。選択から外れた値を含む除外ペアも同時に取り除く
  const handleChangeContainerCapacities = (next: string[]) => {
    setDraftContainerCapacities(next);
    setDraftExcludePairs((pairs) =>
      pairs.filter((p) => !p.capacity || next.includes(p.capacity))
    );
  };

  const [activeTab, setActiveTab] = useState<
    'annual' | 'expense' | 'detail' | 'graph'
  >('graph'); // タブ管理
  // 集計表の高さ（ドラッグで拡縮）
  // 年間集計・拡売費集計は共通の初期値、詳細タブのみ 620
  const PANEL_HEIGHT = 700;
  const { height: tableHeight, handleMouseDown } = useResizableHeight({
    defaultHeight: 620,
  });
  // 年間集計・拡売費集計も詳細タブと同様に「表＋グリッド外のリサイズハンドル」で構成する
  const annualResize = useResizableHeight({ defaultHeight: PANEL_HEIGHT });
  const expenseResize = useResizableHeight({ defaultHeight: PANEL_HEIGHT });

  // グラフ用に表示単位（円／千円）の除数を算出する
  // 千円表示時は金額を 1000 で割る（率項目には適用しない）
  const chartDivisor = displayUnit === 'thousand' ? 1000 : 1;

  // 集計フィルタ（集計単位①②＋除外ペア）と、対象月の期間別集計（計算エンジン）。
  const aggFilter = useMemo(
    () => ({
      metaBrands: selectedMetaBrands,
      capacities: selectedContainerCapacities,
      excludePairs,
      aOnlyPromo: isAOnlyPromo,
      expenseMonthBasis,
      // 権限が無ければ支社受渡原価へ倒す
      costAxis: resolveCostAxis(costAxis),
      commonRates: DEFAULT_COMMON_RATE_SETTINGS,
    }),
    [
      selectedMetaBrands,
      selectedContainerCapacities,
      excludePairs,
      isAOnlyPromo,
      expenseMonthBasis,
      costAxis,
    ]
  );

  const periods = useMemo(
    () => computePeriods(source, monthIdx0 + 1, aggFilter),
    [source, monthIdx0, aggFilter]
  );

  // グラフ（初期表示）に出すカード（6項目固定・資料 課題0623「計画詳細_グラフタブ」の〇項目に統一）：
  // 函数・売上高・社外売上高・管理利益額・拡売費＝金額／管理利益率＝率。
  const CHART_CARD_ITEMS: {
    name: string;
    key: keyof AggAmounts;
    isRate: boolean;
    isQuantity?: boolean;
    // コスト項目（少ないほど良い）。カードの配色を反転する目印（→ aggregationCardColors）
    isCost?: boolean;
  }[] = [
    { name: '函数', key: 'func', isRate: false, isQuantity: true },
    { name: '売上高', key: 'sales', isRate: false },
    { name: '社外売上高', key: 'extSales', isRate: false },
    { name: '管理利益額', key: 'mgmtProfit', isRate: false },
    { name: '管理利益率', key: 'mgmtProfitRate', isRate: true },
    {
      name: '拡売費（売上連動拡売費＋直接固定費）',
      key: 'promo',
      isRate: false,
      // 拡売費はコスト項目のため、予算比・前年比の良し悪しが他の指標と逆になる
      // （予算・前年を下回る＝○、上回る＝×）。カードの色判定を反転させる目印。
      isCost: true,
    },
  ];

  const buildChartData = (prefix: 'monthly' | 'cumulative' | 'yearly') => {
    const a = periods[prefix];
    return CHART_CARD_ITEMS.map((item) => {
      const d = displayOf(a[item.key], item.isRate);
      // 函数＝数量（函）は金額単位で割らない。率は×100、金額は表示単位で除算。
      const scale = (v: number) =>
        item.isQuantity ? v : item.isRate ? v * 100 : v / chartDivisor;
      return {
        name: item.name,
        isRate: item.isRate,
        isQuantity: item.isQuantity,
        isCost: item.isCost,
        予算: scale(d.budget),
        計画: scale(d.plan),
        前年同月: scale(d.prevYear),
      };
    });
  };

  const prepareMonthlyChartData = () => buildChartData('monthly');
  const prepareCumulativeChartData = () => buildChartData('cumulative');
  const prepareYearlyChartData = () => buildChartData('yearly');

  // ── 詳細タブ（集計単位別行 × 項目列）─ 集計項目xlsx「販売計画（集計）詳細」準拠 ──
  // 〇項目＝初期表示、△項目＝初期非表示（hide:true、AG Gridの列ツールパネルで表示）、×項目＝列に含めない。
  // ＋ボタンは使わず、AG Grid 標準の列表示/非表示機能で△を出す。
  // 詳細タブの項目ツリー（P/Lドリルダウン）。各ノードを計算エンジンのキーに対応づけ、
  // 親項目を展開すると率/金額/内訳（A口・B口・本社口）の子項目を表示する。
  // derive 指定のノードはエンジン値から派生計算（函単価＝金額÷函数、率＝金額÷売上高 等）。

  // 詳細タブ：表示項目ドリルダウン（資料「各項目_折りたたみ表示」準拠）の対象期間サブタブ。
  // 各期間を補足3-1 の計算エンジンで算出して valueFor に供給する。
  // ラベルの `${selectedMonth}` と monthsForPeriod に渡す月は同じ monthIdx0 由来（表示と値がズレないため）。
  const detailPeriodTabs = useMemo<AggTreePeriodTab[]>(() => {
    const mk = (p: 'monthly' | 'cumulative' | 'yearly') =>
      makeTreeValueFor(
        computeMonthsRange(
          source,
          monthsForPeriod(p, monthIdx0 + 1),
          aggFilter
        ),
        displayUnit
      );
    return [
      { label: `${selectedMonth}月合計`, valueFor: mk('monthly') },
      { label: `1～${selectedMonth}月累計`, valueFor: mk('cumulative') },
      { label: '年間', valueFor: mk('yearly') },
    ];
  }, [source, selectedMonth, monthIdx0, aggFilter, displayUnit]);

  const renderMiniBarChart = (data: any, index: number) => {
    const budgetRate = (data.計画 / data.予算) * 100;
    const previousYearRate = (data.計画 / data.前年同月) * 100;

    // 表示単位ラベル（円／千円）。比率は単位非依存のため率計算には影響しない
    const unitLabel = displayUnit === 'thousand' ? '千円' : '円';

    // 配色（棒グラフ・率テキスト・差の文字色）はシミュレーションと閾値を揃えるため共通判定に委ねる。
    // 拡売費（コスト項目）は予算・前年を下回るほど良いため isCost=true で配色が反転し、
    // 予算達成率・前年比とも 100%以下＝緑／100%超＝赤になる。
    // 他の指標（函数・売上高・社外売上高・管理利益額・管理利益率）は従来どおり。
    const isCostCard = Boolean(data.isCost);
    const budgetColor = budgetRateColor(budgetRate, isCostCard);
    const previousYearColor = previousYearRateColor(
      previousYearRate,
      isCostCard
    );

    // 値の表示整形：率項目（管理利益率・売買差益率）は％、金額項目は接頭辞＋円／千円
    // 率項目は小数点以下2桁を四捨五入し、小数点以下1桁・3桁区切りで表示する
    // 金額項目は円・千円いずれの表示単位でも整数表示にする
    // （円・千円とも端数は四捨五入する）
    const formatValue = (v: number, prefix: string) =>
      data.isRate
        ? formatPlanRate(v, PLAN_DETAIL_DIGITS.rate)
        : data.isQuantity
          ? `${Math.round(v).toLocaleString()} 函`
          : `${prefix}${Math.round(v).toLocaleString()} ${unitLabel}`;

    // 差（計画−予算／計画−前年同月）の表記と文字色。
    // プラスは「+」＋青字、マイナスは「△」＋赤字とし、色以外の手がかり（符号）を必ず併用する。
    // 丸めた結果が 0 になる場合は符号を付けず既定色にする。率項目はポイント差を小数第1位まで表示する。
    const buildDiff = (v: number) => {
      const abs = Math.abs(v);
      const rounded = data.isRate
        ? Number(abs.toFixed(1))
        : data.isQuantity
          ? Math.round(abs)
          : displayUnit === 'thousand'
            ? Math.round(abs)
            : Math.round(abs);
      const body = data.isRate
        ? formatPlanRate(rounded, PLAN_DETAIL_DIGITS.rate)
        : data.isQuantity
          ? `${rounded.toLocaleString()} 函`
          : `${rounded.toLocaleString()} ${unitLabel}`;
      if (rounded === 0) return { text: body, className: 'text-gray-500' };
      // 拡売費（コスト項目）は予算・前年を上回る＝×のため、色だけを反転させる
      // （プラス＝赤／マイナス＝青）。符号（+／△）は算術どおりで変えない。
      return v > 0
        ? { text: `+${body}`, className: diffTextColor(v, isCostCard) }
        : { text: `△${body}`, className: diffTextColor(v, isCostCard) };
    };

    const budgetDiff = buildDiff(data.計画 - data.予算);
    const previousYearDiff = buildDiff(data.計画 - data.前年同月);

    return (
      <div
        key={index}
        className="bg-gradient-to-br from-white to-blue-50 rounded-xl border-2 border-gray-300 p-4 shadow-md hover:shadow-lg transition-shadow"
      >
        <div className="text-sm font-bold text-gray-800 mb-3 pb-2 border-b-2 border-blue-200">
          {data.name}
        </div>
        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-1">計画値</div>
          <div className="text-xl font-bold text-blue-600">
            {formatValue(data.計画, '¥')}
          </div>
        </div>
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-sm text-gray-600">予算達成率</span>
            <span className={`text-sm font-bold ${budgetColor.text}`}>
              {formatPlanRate(budgetRate, PLAN_DETAIL_DIGITS.rate)}
            </span>
          </div>
          {/* 棒グラフ内の％は見出しの予算達成率と重複するため表示しない（塗りのみで割合を表す） */}
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`${budgetColor.bar} h-3 rounded-full transition-all duration-700 ease-out`}
              style={{ width: `${Math.min(budgetRate, 100)}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-0.5">
            <span className="text-sm text-gray-500">予算差</span>
            <span className={`text-sm font-medium ${budgetDiff.className}`}>
              {budgetDiff.text}
            </span>
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-sm text-gray-600">前年比</span>
            <span className={`text-sm font-bold ${previousYearColor.text}`}>
              {formatPlanRate(previousYearRate, PLAN_DETAIL_DIGITS.rate)}
            </span>
          </div>
          {/* 棒グラフ内の％は見出しの前年比と重複するため表示しない（塗りのみで割合を表す） */}
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`${previousYearColor.bar} h-3 rounded-full transition-all duration-700 ease-out`}
              style={{
                width: `${Math.min(previousYearRate, 100)}%`,
              }}
            />
          </div>
          <div className="flex justify-between items-center mt-0.5">
            <span className="text-sm text-gray-500">前年差</span>
            <span
              className={`text-sm font-medium ${previousYearDiff.className}`}
            >
              {previousYearDiff.text}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // 各項目のTooltip

  return (
    <CollapsibleCard
      title="販売計画(集計)"
      open={isOpen}
      onOpenChange={setIsOpen}
      className="mb-4"
    >
      <div className="p-4">
        <div className="flex flex-col gap-3">
          {/* 1行目: 集計対象選択ボタン・タブボタン（対象年月は販売計画エリアに従う） */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* 集計対象選択（押下で右ペインを表示。集計単位①×②・除外・プレビューを設定） */}
            <button
              type="button"
              onClick={handleToggleAggFilterPane}
              className={`flex items-center gap-2 h-8 px-3 rounded-lg border-2 border-blue-600 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors whitespace-nowrap ${
                showAggFilterPane
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-blue-600 hover:bg-blue-50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              集計対象選択
            </button>

            {/* タブボタン群（1行目右側） */}
            <div className="flex items-center justify-end ml-auto">
              <div className="flex border-2 border-blue-600 rounded-lg overflow-hidden">
                <button
                  onClick={() => setActiveTab('annual')}
                  className={`px-4 py-1 h-8 whitespace-nowrap text-sm font-medium transition-colors ${
                    activeTab === 'annual'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  年間集計
                </button>
                <div className="w-px bg-blue-600" />
                <button
                  onClick={() => setActiveTab('expense')}
                  className={`px-4 py-1 h-8 whitespace-nowrap text-sm font-medium transition-colors ${
                    activeTab === 'expense'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  拡売費集計
                </button>
                <div className="w-px bg-blue-600" />
                <button
                  onClick={() => setActiveTab('detail')}
                  className={`px-4 py-1 h-8 whitespace-nowrap text-sm font-medium transition-colors ${
                    activeTab === 'detail'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  詳細
                </button>
                <div className="w-px bg-blue-600" />
                <button
                  onClick={() => setActiveTab('graph')}
                  className={`px-4 py-1 h-8 whitespace-nowrap text-sm font-medium transition-colors ${
                    activeTab === 'graph'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  グラフ
                </button>
              </div>
            </div>
          </div>

          {/* 2行目: 拡売費集計対象選択・拡売費の集計 */}
          <div className="flex items-center gap-3">
            {/* 拡売費集計対象選択 */}
            <div className="flex items-center gap-2">
              <label
                className={`${FORM_LABEL_CLASS} whitespace-nowrap w-35 px-2 py-1`}
              >
                拡売費集計対象選択
              </label>
              <RadioGroup
                value={expenseMonthBasis}
                onValueChange={(value) =>
                  setExpenseMonthBasis(value as ExpenseMonthBasis)
                }
                className="flex items-center gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="target" id="expense-basis-target" />
                  <Label
                    htmlFor="expense-basis-target"
                    className="cursor-pointer text-sm font-normal"
                  >
                    対象月
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="posting" id="expense-basis-posting" />
                  <Label
                    htmlFor="expense-basis-posting"
                    className="cursor-pointer text-sm font-normal"
                  >
                    計上月
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* 拡売費の集計：A口のみチェックボックス（チェックで拡売費A口2費目のみ集計） */}
            <div className="flex items-center gap-2">
              <label className={`${FORM_LABEL_CLASS} whitespace-nowrap`}>
                拡売費の集計
              </label>
              <Checkbox
                id="a-only-promo"
                checked={isAOnlyPromo}
                onCheckedChange={(checked) => setIsAOnlyPromo(checked === true)}
              />
              <Label
                htmlFor="a-only-promo"
                className="cursor-pointer text-sm font-normal whitespace-nowrap"
              >
                A口のみ
              </Label>
            </div>

            {/* 原価軸トグル（補足2-3）：実原価の閲覧権限がある部署のみ表示する。
                権限が無いユーザーには支社受渡原価のみを表示し、切替操作を出さない。 */}
            {canSwitchCostAxis && (
              <div className="flex items-center gap-2">
                <label className={`${FORM_LABEL_CLASS} whitespace-nowrap`}>
                  原価軸
                </label>
                <div className="inline-flex rounded-md border border-gray-300 overflow-hidden h-8">
                  <button
                    type="button"
                    onClick={() => setCostAxis('transfer')}
                    aria-pressed={costAxis === 'transfer'}
                    className={`px-4 text-sm font-medium transition-colors ${
                      costAxis === 'transfer'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {COST_AXIS_LABELS.transfer}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCostAxis('actual')}
                    aria-pressed={costAxis === 'actual'}
                    className={`px-4 text-sm font-medium transition-colors ${
                      costAxis === 'actual'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {COST_AXIS_LABELS.actual}
                  </button>
                </div>
                {/* モック表現の注記：実原価は支社受渡原価からの仮算出値、閲覧権限もモックログイン
                    ユーザー固定であることをホバー時に明示する（実装は行わずモック上の表現のみ）。 */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      className="cursor-help text-xs whitespace-nowrap text-gray-600"
                    >
                      ※モック表現
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-80">
                    実原価は支社受渡原価×0.94で仮算出した参考値です（実原価マスタが未実装のため）。閲覧権限もモックログインユーザーに固定して表現しています。
                  </TooltipContent>
                </Tooltip>
              </div>
            )}

            {/* 表示単位トグル（円／千円） */}
            <div className="flex items-center gap-2">
              <label className={`${FORM_LABEL_CLASS} whitespace-nowrap`}>
                表示単位
              </label>
              <div className="inline-flex rounded-md border border-gray-300 overflow-hidden h-8">
                <button
                  onClick={() => setDisplayUnit('yen')}
                  className={`px-4 text-sm font-medium transition-colors ${
                    displayUnit === 'yen'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  円
                </button>
                <button
                  onClick={() => setDisplayUnit('thousand')}
                  className={`px-4 text-sm font-medium transition-colors ${
                    displayUnit === 'thousand'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  千円
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* タブ内容（集計対象設定は画面右ペインで開く） */}
      <div className="px-4 pb-4">
        {/* グラフ表示 */}
        {activeTab === 'graph' && (
          <div className="mb-4">
            <Tabs defaultValue="monthly" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4 bg-transparent p-0 h-auto gap-1">
                <TabsTrigger
                  value="monthly"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded"
                >
                  <Calendar className="w-4 h-4" />
                  <span className="font-medium">{selectedMonth}月合計</span>
                </TabsTrigger>
                <TabsTrigger
                  value="cumulative"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span className="font-medium">1～{selectedMonth}月累計</span>
                </TabsTrigger>
                <TabsTrigger
                  value="yearly"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded"
                >
                  <CalendarRange className="w-4 h-4" />
                  <span className="font-medium">年間</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="monthly">
                <div className="grid grid-cols-6 gap-2">
                  {prepareMonthlyChartData().map((data, idx) =>
                    renderMiniBarChart(data, idx)
                  )}
                </div>
              </TabsContent>

              <TabsContent value="cumulative">
                <div className="grid grid-cols-6 gap-2">
                  {prepareCumulativeChartData().map((data, idx) =>
                    renderMiniBarChart(data, idx)
                  )}
                </div>
              </TabsContent>

              <TabsContent value="yearly">
                <div className="grid grid-cols-6 gap-2">
                  {prepareYearlyChartData().map((data, idx) =>
                    renderMiniBarChart(data, idx)
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* 表表示 */}
        {activeTab === 'detail' && (
          <div className="mb-4">
            {/* 課題0623：詳細タブの集計表を表示項目ドリルダウン（資料「各項目_折りたたみ表示」準拠・
                補足3-1計算・対象月合計/累計/年間タブ・補助項目を表示）へ統一 */}
            <AggregationItemTreeTable
              view="monthlyDetail"
              periodTabs={detailPeriodTabs}
              height={tableHeight}
              // ドリルダウンの開閉状態を画面ごとに保存する
              // （補助項目の表示／非表示それぞれで別に保持される）
              expandStateKey={expandStateKey}
            />
            {/* リサイズハンドルはAG Gridの外（表の下端）に配置し、年間集計・拡売費集計と統一する */}
            <div className="relative h-2">
              <ResizeHandle onMouseDown={handleMouseDown} />
            </div>
          </div>
        )}

        {/* 年間集計表示 */}
        {activeTab === 'annual' && (
          <div className="mb-4">
            <div style={{ height: annualResize.height }}>
              <AnnualTotalTab
                source={source}
                isWholesaleContext
                displayUnit={displayUnit}
                aggFilter={aggFilter}
                // 指定時は詳細・グラフタブと同じく基本情報の対象年月を基準月にする
                targetMonth={
                  linkTotalTabsToTargetMonth ? selectedMonth : undefined
                }
              />
            </div>
            {/* リサイズハンドルはAG Gridの外（表の下端）に配置し、詳細タブと統一する */}
            <div className="relative h-2">
              <ResizeHandle onMouseDown={annualResize.handleMouseDown} />
            </div>
          </div>
        )}

        {/* 拡売費集計表示 */}
        {activeTab === 'expense' && (
          <div className="mb-4">
            <div style={{ height: expenseResize.height }}>
              <PromotionCostTotalTab
                source={source}
                displayUnit={displayUnit}
                // 拡売費集計でも集計単位②（容器容量G）を集計に反映する
                aggFilter={aggFilter}
                // 指定時は詳細・グラフタブと同じく基本情報の対象年月を基準月にする
                targetMonth={
                  linkTotalTabsToTargetMonth ? selectedMonth : undefined
                }
              />
            </div>
            {/* リサイズハンドルはAG Gridの外（表の下端）に配置し、詳細タブと統一する */}
            <div className="relative h-2">
              <ResizeHandle onMouseDown={expenseResize.handleMouseDown} />
            </div>
          </div>
        )}
      </div>

      {/* 集計対象設定（画面右ペイン：センターフィ率などと同様のスライドイン） */}
      <RightPane
        open={showAggFilterPane}
        onClose={handleCloseAggFilterPane}
        title="集計対象設定"
        description="集計単位①×②・除外する組合せ・集計対象プレビューを設定します"
        initialWidth={26}
        minWidth={22}
        maxWidth={40}
        footer={
          <div className="flex items-center justify-end gap-3">
            {/* 集計単位①②・除外ペアの編集値を即時リセット（確認ダイアログなし） */}
            <button
              type="button"
              onClick={handleResetAggFilter}
              className={`${BUTTON_STYLES.cancel} ${BUTTON_BASE} inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium`}
            >
              <RotateCcw className="w-4 h-4" />
              すべてリセット
            </button>
            {/* 集計対象が更新されるのは、この確定を押下したタイミングのみ */}
            <button
              type="button"
              onClick={handleSubmitAggFilter}
              className={`${BUTTON_STYLES.primary} ${BUTTON_BASE} inline-flex items-center h-8 px-4 text-sm font-medium`}
            >
              確定
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {/* 集計単位①メタブランド × ②容器容量G（複数選択・掛け合わせ）─ 課題0290 */}
          <div className="flex flex-col gap-2">
            <label className={FORM_LABEL_CLASS}>
              集計単位①（メタブランド）
            </label>
            <MultiCombobox
              options={META_BRAND_OPTIONS}
              value={draftMetaBrands}
              onChange={handleChangeMetaBrands}
              placeholder="メタブランド"
            />
            <div className="text-center text-lg font-bold text-blue-700">×</div>
            <label className={FORM_LABEL_CLASS}>集計単位②（容器容量G）</label>
            <MultiCombobox
              options={CONTAINER_CAPACITY_OPTIONS}
              value={draftContainerCapacities}
              onChange={handleChangeContainerCapacities}
              placeholder="容器容量G"
            />
          </div>

          {/* 集計対象プレビュー（①×②を選択時のみ）＋除外する組合せ（①・②とも2つ以上選択時のみ）─ 課題0290 */}
          {/* プレビューは編集中の内容を確認するためのものなので編集値を表示する */}
          {draftMetaBrands.length > 0 && draftContainerCapacities.length > 0 ? (
            <AggregationFilter
              metaBrandOptions={META_BRAND_OPTIONS}
              containerCapacityOptions={CONTAINER_CAPACITY_OPTIONS}
              selectedMetaBrands={draftMetaBrands}
              selectedContainerCapacities={draftContainerCapacities}
              excludePairs={draftExcludePairs}
              onChangeExcludePairs={setDraftExcludePairs}
            />
          ) : (
            <p className="rounded-md bg-gray-50 px-3 py-4 text-xs text-gray-400">
              集計単位①・②をそれぞれ1つ以上選択すると、集計対象プレビューを表示します。
            </p>
          )}
        </div>
      </RightPane>
    </CollapsibleCard>
  );
}
