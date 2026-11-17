import React, { useState, useMemo, useEffect } from 'react';
import { ColDef, ColGroupDef } from 'ag-grid-community';
import {
  Calendar,
  TrendingUp,
  CalendarRange,
  ClipboardList,
  SlidersHorizontal,
} from 'lucide-react';
import { RotateCcw } from 'lucide-react';

import {
  PLAN_DETAIL_DIGITS,
  formatPlanRate,
} from '@/utils/sales-plan/common/planDetailNumberFormat';
import { rateCellStyle } from '@/components/grid';
import {
  CARD_TITLE_CLASS,
  FORM_LABEL_CLASS,
  BUTTON_STYLES,
  BUTTON_BASE,
} from '@/styles/commonStyles';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { RightPane } from '@/components/ui/right-pane';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useResizableHeight,
  ResizeHandle,
} from '@/components/ui/resizable-panel';
import { MultiCombobox } from '@/components/ui/multi-combobox';
import {
  AggregationFilter,
  type ExcludePair,
} from '@/features/sales-plan/shared/common/AggregationFilter';
import {
  META_BRAND_OPTIONS,
  CONTAINER_CAPACITY_OPTIONS,
} from '@/constants/aggregationAxisMaster';
import {
  makeSimulationTreeValueFor,
  type SimulationRatios,
} from '@/utils/sales-plan/simulation/simulationDetailAggregate';
import { SimulationCampaignSummaryTable } from '@/features/sales-plan/shared/simulation/SimulationCampaignSummaryTable';
import { AggregationItemTreeTable } from '@/features/sales-plan/shared/common/AggregationItemTreeTable';
import {
  AGGREGATION_PERIOD_FROM_ID,
  SimulationPeriodPicker,
} from '@/features/sales-plan/shared/simulation/SimulationPeriodPicker';
import { SegmentToggle } from '@/components/shared/common/SegmentToggle';
import { KpiCard } from '@/features/sales-plan/shared/common/KpiCard';

interface UnifiedAggregationData {
  label: string; // ユニークなキー
  displayLabel?: string; // 表示用ラベル（指定がない場合はlabelを使用）
  highlight: boolean;
  monthly_budget: string;
  monthly_plan: string;
  monthly_budgetRate: string;
  monthly_previousYear: string;
  monthly_previousYearRate: string;
  cumulative_budget: string;
  cumulative_plan: string;
  cumulative_budgetRate: string;
  cumulative_actual: string;
  cumulative_actualRate: string;
  cumulative_previousYear: string;
  cumulative_previousYearRate: string;
  yearly_budget: string;
  yearly_plan: string;
  yearly_budgetRate: string;
  yearly_previousYear: string;
  yearly_previousYearRate: string;
  children?: string[]; // 子項目のラベル（キー）
}

interface SimulationAggregationPaneProps {
  // シミュレーションの表に無い項目を按分する構成比（画面が取得して渡す）
  ratios: SimulationRatios;
  // 企画単位集計データ（下ペイン廃止に伴い集計表側で表示）
  campaignData?: any[];
  // 販売計画(詳細)グリッドの全明細行。パターン別集計表を確度選択で絞り込んで実集計する。
  detailRows?: any[];
  // 集計対象設定ペインの開閉。右ペインは画面で常に1つのみ表示するため、
  // 他の右ペインと同様に親画面（closeAllRightPanes／togglePane）で管理する。
  // 未指定時は本コンポーネント内で開閉を保持する（単体利用時のフォールバック）。
  aggFilterPaneOpen?: boolean;
  onToggleAggFilterPane?: () => void;
  onCloseAggFilterPane?: () => void;
  // シミュレーション（集計）の対象期間（YYYY/MM）。グラフ・詳細・企画単位集計に適用する。
  // シミュレーション（詳細）の対象期間とは連動しない（6/16 第9回 決定9）。
  // 明細の絞り込みに使うため画面（page.tsx）側で保持する。
  fromPeriod: string;
  toPeriod: string;
  onFromPeriodChange: (value: string) => void;
  onToPeriodChange: (value: string) => void;
  // 画面ごとの違い
  // 開閉の状態を保存するキーの頭（画面ごとに一意。例：'SimNetFixed'・'SimMargin'）
  expandStatePrefix: string;
  // 企画単位集計の表に一般卸メッシュの列を出すか（NET固定は出す）
  showWholesaleMesh?: boolean;
  // タブの中身の下に余白（pb-4）を取るか
  hasContentBottomPadding?: boolean;
}

// 販売計画シミュレーション（NET固定・マージン率固定）の集計表のペイン。画面ごとの違いは Props で渡す
// （開閉の保存キー・一般卸メッシュの列・タブの中身の下の余白）。
export function SimulationAggregationPane({
  ratios,
  campaignData = [],
  detailRows = [],
  aggFilterPaneOpen,
  onToggleAggFilterPane,
  onCloseAggFilterPane,
  fromPeriod,
  toPeriod,
  onFromPeriodChange,
  onToPeriodChange,
  expandStatePrefix,
  showWholesaleMesh = false,
  hasContentBottomPadding = false,
}: SimulationAggregationPaneProps) {
  const [isOpen, setIsOpen] = useState(true);
  // 「A口のみ集計」チェック状態（初期＝チェックなし）。true で拡売費A口2費目
  // （売上連動拡売費A口・拡売費(固定費)A口。計画詳細と同じ）のみ集計する。
  const [isAOnlyPromo, setIsAOnlyPromo] = useState(false);
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
  // 企画単位集計の確度フィルター（既定はチェックあり）。詳細／グラフを切り替えても保持する。
  const [shouldExcludeCampaignReflected, setShouldExcludeCampaignReflected] =
    useState(true);
  const [shouldExcludeCampaignRejected, setShouldExcludeCampaignRejected] =
    useState(true);
  // 対象期間合計／企画単位集計のタブ（詳細・グラフで同じ選択を使う）
  const [detailTableTab, setDetailTableTab] = useState('monthly');
  // 企画単位集計を選んでいる間は「詳細」「グラフ」を両方とも非活性にする（10/27 第4回 決定事項6）
  const isCampaignTabSelected = detailTableTab === 'campaign';
  const [activeTab, setActiveTab] = useState<
    'annual' | 'expense' | 'detail' | 'graph'
  >('graph'); // タブ管理
  // 集計表の高さ（ドラッグで拡縮）。パターン①／②・企画単位集計をそれぞれ独立にリサイズする。
  const pattern1Resize = useResizableHeight({ defaultHeight: 360 });
  const pattern2Resize = useResizableHeight({ defaultHeight: 360 });
  const campaignResize = useResizableHeight({ defaultHeight: 400 });
  // パターン①の集計確度選択（デフォルト：確定・A・B・Cをチェック、反映済は未チェック）
  const [isP1Fixed, setIsP1Fixed] = useState(true);
  const [isP1A, setIsP1A] = useState(true);
  const [isP1B, setIsP1B] = useState(true);
  const [isP1C, setIsP1C] = useState(true);
  const [isP1Reflected, setIsP1Reflected] = useState(false);
  // パターン②の集計確度選択（デフォルト：確定のみチェック）
  const [isP2Fixed, setIsP2Fixed] = useState(true);
  const [isP2A, setIsP2A] = useState(false);
  const [isP2B, setIsP2B] = useState(false);
  const [isP2C, setIsP2C] = useState(false);
  const [isP2Reflected, setIsP2Reflected] = useState(false);

  // ツリー階層の定義（トップレベル項目のみ）
  const topLevelItems = [
    '函数',
    '売上高',
    '売上原価',
    '売上総利益',
    '変動費(CF+ロケ補填)',
    '売買差益',
    '直接固定費',
    '管理利益',
  ];

  // 集計単位の選択肢は SSOT（aggregationAxisMaster）を参照。
  // 一般卸メッシュ・サマリ商品は集計単位から削除済み（課題0488/資料mst準拠）。

  const unifiedData: UnifiedAggregationData[] = [
    {
      label: '函数',
      highlight: false,
      monthly_budget: '19,360',
      monthly_plan: '17,665',
      monthly_budgetRate: '91.2 %',
      monthly_previousYear: '21,750',
      monthly_previousYearRate: '81.2 %',
      cumulative_budget: '58,080',
      cumulative_plan: '52,995',
      cumulative_budgetRate: '91.2 %',
      cumulative_actual: '48,600',
      cumulative_actualRate: '83.7 %',
      cumulative_previousYear: '65,250',
      cumulative_previousYearRate: '81.2 %',
      yearly_budget: '232,320',
      yearly_plan: '211,980',
      yearly_budgetRate: '91.2 %',
      yearly_previousYear: '261,000',
      yearly_previousYearRate: '81.2 %',
    },
    {
      label: '売上高',
      highlight: false,
      children: ['社外売上高', '売上値引', '条件口（帳合料）'],
      monthly_budget: '22,279,000',
      monthly_plan: '30,238,947',
      monthly_budgetRate: '135.7 %',
      monthly_previousYear: '42,993,765',
      monthly_previousYearRate: '70.3 %',
      cumulative_budget: '96,837,000',
      cumulative_plan: '90,716,841',
      cumulative_budgetRate: '93.7 %',
      cumulative_actual: '85,500,000',
      cumulative_actualRate: '88.3 %',
      cumulative_previousYear: '98,981,295',
      cumulative_previousYearRate: '91.7 %',
      yearly_budget: '387,348,000',
      yearly_plan: '362,867,364',
      yearly_budgetRate: '93.7 %',
      yearly_previousYear: '395,925,180',
      yearly_previousYearRate: '91.7 %',
    },
    {
      label: '社外売上高',
      highlight: false,
      monthly_budget: '52,600,000',
      monthly_plan: '49,004,744',
      monthly_budgetRate: '93.2 %',
      monthly_previousYear: '54,113,322',
      monthly_previousYearRate: '90.6 %',
      cumulative_budget: '157,800,000',
      cumulative_plan: '147,014,232',
      cumulative_budgetRate: '93.2 %',
      cumulative_actual: '138,600,000',
      cumulative_actualRate: '87.8 %',
      cumulative_previousYear: '162,339,966',
      cumulative_previousYearRate: '90.6 %',
      yearly_budget: '631,200,000',
      yearly_plan: '588,056,928',
      yearly_budgetRate: '93.2 %',
      yearly_previousYear: '649,359,864',
      yearly_previousYearRate: '90.6 %',
    },
    {
      label: '売上値引',
      highlight: false,
      children: ['売上値引率', '売上値引金額', '量経追加口', '売上連動拡売費'],
      monthly_budget: '20,321,000',
      monthly_plan: '18,765,797',
      monthly_budgetRate: '92.3 %',
      monthly_previousYear: '21,119,557',
      monthly_previousYearRate: '88.9 %',
      cumulative_budget: '60,963,000',
      cumulative_plan: '56,297,391',
      cumulative_budgetRate: '92.3 %',
      cumulative_actual: '53,100,000',
      cumulative_actualRate: '87.1 %',
      cumulative_previousYear: '63,358,671',
      cumulative_previousYearRate: '88.9 %',
      yearly_budget: '243,852,000',
      yearly_plan: '225,189,564',
      yearly_budgetRate: '92.3 %',
      yearly_previousYear: '253,434,684',
      yearly_previousYearRate: '88.9 %',
    },
    {
      label: '売上値引率',
      displayLabel: '-率',
      highlight: false,
      monthly_budget: '38.6%',
      monthly_plan: '38.3%',
      monthly_budgetRate: '-0.3 %',
      monthly_previousYear: '39.0%',
      monthly_previousYearRate: '-0.7 %',
      cumulative_budget: '38.6%',
      cumulative_plan: '38.3%',
      cumulative_budgetRate: '-0.3 %',
      cumulative_actual: '38.3%',
      cumulative_actualRate: '-0.3 %',
      cumulative_previousYear: '39.0%',
      cumulative_previousYearRate: '-0.7 %',
      yearly_budget: '38.6%',
      yearly_plan: '38.3%',
      yearly_budgetRate: '-0.3 %',
      yearly_previousYear: '39.0%',
      yearly_previousYearRate: '-0.7 %',
    },
    {
      label: '売上値引金額',
      displayLabel: '-金額',
      highlight: false,
      monthly_budget: '20,321,000',
      monthly_plan: '18,765,797',
      monthly_budgetRate: '92.3 %',
      monthly_previousYear: '21,119,557',
      monthly_previousYearRate: '88.9 %',
      cumulative_budget: '60,963,000',
      cumulative_plan: '56,297,391',
      cumulative_budgetRate: '92.3 %',
      cumulative_actual: '53,100,000',
      cumulative_actualRate: '87.1 %',
      cumulative_previousYear: '63,358,671',
      cumulative_previousYearRate: '88.9 %',
      yearly_budget: '243,852,000',
      yearly_plan: '225,189,564',
      yearly_budgetRate: '92.3 %',
      yearly_previousYear: '253,434,684',
      yearly_previousYearRate: '88.9 %',
    },
    {
      label: '量経追加口',
      highlight: false,
      children: [
        '量経追加口率',
        '量経追加口金額',
        '量経追加口率（CF込）',
        '量経追加口金額（CF込）',
      ],
      monthly_budget: '20,048,000',
      monthly_plan: '18,350,207',
      monthly_budgetRate: '91.5 %',
      monthly_previousYear: '20,702,268',
      monthly_previousYearRate: '88.6 %',
      cumulative_budget: '60,144,000',
      cumulative_plan: '55,050,621',
      cumulative_budgetRate: '91.5 %',
      cumulative_actual: '51,900,000',
      cumulative_actualRate: '86.3 %',
      cumulative_previousYear: '62,106,804',
      cumulative_previousYearRate: '88.6 %',
      yearly_budget: '240,576,000',
      yearly_plan: '220,202,484',
      yearly_budgetRate: '91.5 %',
      yearly_previousYear: '248,427,216',
      yearly_previousYearRate: '88.6 %',
    },
    {
      label: '量経追加口率',
      displayLabel: '-率',
      highlight: false,
      monthly_budget: '38.1%',
      monthly_plan: '37.4%',
      monthly_budgetRate: '-0.7 %',
      monthly_previousYear: '38.3%',
      monthly_previousYearRate: '-0.9 %',
      cumulative_budget: '38.1%',
      cumulative_plan: '37.4%',
      cumulative_budgetRate: '-0.7 %',
      cumulative_actual: '37.4%',
      cumulative_actualRate: '-0.7 %',
      cumulative_previousYear: '38.3%',
      cumulative_previousYearRate: '-0.9 %',
      yearly_budget: '38.1%',
      yearly_plan: '37.4%',
      yearly_budgetRate: '-0.7 %',
      yearly_previousYear: '38.3%',
      yearly_previousYearRate: '0.9 %',
    },
    {
      label: '量経追加口金額',
      displayLabel: '-金額',
      highlight: false,
      monthly_budget: '20,048,000',
      monthly_plan: '18,350,207',
      monthly_budgetRate: '91.5 %',
      monthly_previousYear: '20,702,268',
      monthly_previousYearRate: '88.6 %',
      cumulative_budget: '60,144,000',
      cumulative_plan: '55,050,621',
      cumulative_budgetRate: '91.5 %',
      cumulative_actual: '51,900,000',
      cumulative_actualRate: '86.3 %',
      cumulative_previousYear: '62,106,804',
      cumulative_previousYearRate: '88.6 %',
      yearly_budget: '240,576,000',
      yearly_plan: '220,202,484',
      yearly_budgetRate: '91.5 %',
      yearly_previousYear: '248,427,216',
      yearly_previousYearRate: '88.6 %',
    },
    {
      label: '量経追加口率（CF込）',
      displayLabel: '-率（CF込）',
      highlight: false,
      monthly_budget: '38.8%',
      monthly_plan: '38.2%',
      monthly_budgetRate: '-0.6 %',
      monthly_previousYear: '39.1%',
      monthly_previousYearRate: '-0.9 %',
      cumulative_budget: '38.8%',
      cumulative_plan: '38.2%',
      cumulative_budgetRate: '-0.6 %',
      cumulative_actual: '38.2%',
      cumulative_actualRate: '-0.6 %',
      cumulative_previousYear: '39.1%',
      cumulative_previousYearRate: '-0.9 %',
      yearly_budget: '38.8%',
      yearly_plan: '38.2%',
      yearly_budgetRate: '-0.6 %',
      yearly_previousYear: '39.1%',
      yearly_previousYearRate: '-0.9 %',
    },
    {
      label: '量経追加口金額（CF込）',
      displayLabel: '-金額（CF込）',
      highlight: false,
      monthly_budget: '20,321,000',
      monthly_plan: '18,765,797',
      monthly_budgetRate: '92.3 %',
      monthly_previousYear: '21,119,557',
      monthly_previousYearRate: '88.9 %',
      cumulative_budget: '60,963,000',
      cumulative_plan: '56,297,391',
      cumulative_budgetRate: '92.3 %',
      cumulative_actual: '53,100,000',
      cumulative_actualRate: '87.1 %',
      cumulative_previousYear: '63,358,671',
      cumulative_previousYearRate: '88.9 %',
      yearly_budget: '243,852,000',
      yearly_plan: '225,189,564',
      yearly_budgetRate: '92.3 %',
      yearly_previousYear: '253,434,684',
      yearly_previousYearRate: '88.9 %',
    },
    {
      label: '売上連動拡売費',
      highlight: false,
      children: [
        '売上連動拡売費率',
        '売上連動拡売費金額',
        '売上連動拡売費A口',
        '売上連動拡売費B口',
        '売上連動拡売費本社口',
      ],
      monthly_budget: '273,000',
      monthly_plan: '415,590',
      monthly_budgetRate: '152.2 %',
      monthly_previousYear: '417,289',
      monthly_previousYearRate: '99.6 %',
      cumulative_budget: '819,000',
      cumulative_plan: '1,246,770',
      cumulative_budgetRate: '152.2 %',
      cumulative_actual: '1,175,400',
      cumulative_actualRate: '143.5 %',
      cumulative_previousYear: '1,251,867',
      cumulative_previousYearRate: '99.6 %',
      yearly_budget: '3,276,000',
      yearly_plan: '4,987,080',
      yearly_budgetRate: '152.2 %',
      yearly_previousYear: '5,007,468',
      yearly_previousYearRate: '99.6 %',
    },
    {
      label: '売上連動拡売費率',
      displayLabel: '-率',
      highlight: false,
      monthly_budget: '0.5%',
      monthly_plan: '0.8%',
      monthly_budgetRate: '0.3 %',
      monthly_previousYear: '0.8%',
      monthly_previousYearRate: '0.0 %',
      cumulative_budget: '0.5%',
      cumulative_plan: '0.8%',
      cumulative_budgetRate: '0.3 %',
      cumulative_actual: '0.8%',
      cumulative_actualRate: '0.3 %',
      cumulative_previousYear: '0.8%',
      cumulative_previousYearRate: '0.0 %',
      yearly_budget: '0.5%',
      yearly_plan: '0.8%',
      yearly_budgetRate: '0.3 %',
      yearly_previousYear: '0.8%',
      yearly_previousYearRate: '0.0 %',
    },
    {
      label: '売上連動拡売費金額',
      displayLabel: '-金額',
      highlight: false,
      monthly_budget: '273,000',
      monthly_plan: '415,590',
      monthly_budgetRate: '152.2 %',
      monthly_previousYear: '417,289',
      monthly_previousYearRate: '99.6 %',
      cumulative_budget: '819,000',
      cumulative_plan: '1,246,770',
      cumulative_budgetRate: '152.2 %',
      cumulative_actual: '1,175,400',
      cumulative_actualRate: '143.5 %',
      cumulative_previousYear: '1,251,867',
      cumulative_previousYearRate: '99.6 %',
      yearly_budget: '3,276,000',
      yearly_plan: '4,987,080',
      yearly_budgetRate: '152.2 %',
      yearly_previousYear: '5,007,468',
      yearly_previousYearRate: '99.6 %',
    },
    {
      label: '売上連動拡売費A口',
      highlight: false,
      monthly_budget: '91,000',
      monthly_plan: '138,530',
      monthly_budgetRate: '152.2 %',
      monthly_previousYear: '139,096',
      monthly_previousYearRate: '99.6 %',
      cumulative_budget: '273,000',
      cumulative_plan: '415,590',
      cumulative_budgetRate: '152.2 %',
      cumulative_actual: '391,800',
      cumulative_actualRate: '143.5 %',
      cumulative_previousYear: '417,289',
      cumulative_previousYearRate: '99.6 %',
      yearly_budget: '1,092,000',
      yearly_plan: '1,662,360',
      yearly_budgetRate: '152.2 %',
      yearly_previousYear: '1,669,156',
      yearly_previousYearRate: '99.6 %',
    },
    {
      label: '売上連動拡売費B口',
      highlight: false,
      monthly_budget: '91,000',
      monthly_plan: '138,530',
      monthly_budgetRate: '152.2 %',
      monthly_previousYear: '139,096',
      monthly_previousYearRate: '99.6 %',
      cumulative_budget: '273,000',
      cumulative_plan: '415,590',
      cumulative_budgetRate: '152.2 %',
      cumulative_actual: '391,800',
      cumulative_actualRate: '143.5 %',
      cumulative_previousYear: '417,289',
      cumulative_previousYearRate: '99.6 %',
      yearly_budget: '1,092,000',
      yearly_plan: '1,662,360',
      yearly_budgetRate: '152.2 %',
      yearly_previousYear: '1,669,156',
      yearly_previousYearRate: '99.6 %',
    },
    {
      label: '売上連動拡売費本社口',
      highlight: false,
      monthly_budget: '91,000',
      monthly_plan: '138,530',
      monthly_budgetRate: '152.2 %',
      monthly_previousYear: '139,097',
      monthly_previousYearRate: '99.6 %',
      cumulative_budget: '273,000',
      cumulative_plan: '415,590',
      cumulative_budgetRate: '152.2 %',
      cumulative_actual: '391,800',
      cumulative_actualRate: '143.5 %',
      cumulative_previousYear: '417,289',
      cumulative_previousYearRate: '99.6 %',
      yearly_budget: '1,092,000',
      yearly_plan: '1,662,360',
      yearly_budgetRate: '152.2 %',
      yearly_previousYear: '1,669,156',
      yearly_previousYearRate: '99.6 %',
    },
    {
      label: '条件口（帳合料）',
      highlight: false,
      monthly_budget: '200,000',
      monthly_plan: '250,000',
      monthly_budgetRate: '125.0 %',
      monthly_previousYear: '220,000',
      monthly_previousYearRate: '113.6 %',
      cumulative_budget: '600,000',
      cumulative_plan: '750,000',
      cumulative_budgetRate: '125.0 %',
      cumulative_actual: '705,000',
      cumulative_actualRate: '117.5 %',
      cumulative_previousYear: '660,000',
      cumulative_previousYearRate: '113.6 %',
      yearly_budget: '2,400,000',
      yearly_plan: '3,000,000',
      yearly_budgetRate: '125.0 %',
      yearly_previousYear: '2,640,000',
      yearly_previousYearRate: '113.6 %',
    },
    {
      label: '売上原価',
      highlight: false,
      children: ['売上原価率', '売上原価金額'],
      monthly_budget: '30,000,000',
      monthly_plan: '27,500,000',
      monthly_budgetRate: '91.7 %',
      monthly_previousYear: '28,000,000',
      monthly_previousYearRate: '98.2 %',
      cumulative_budget: '90,000,000',
      cumulative_plan: '82,500,000',
      cumulative_budgetRate: '91.7 %',
      cumulative_actual: '80,000,000',
      cumulative_actualRate: '88.9 %',
      cumulative_previousYear: '84,000,000',
      cumulative_previousYearRate: '98.2 %',
      yearly_budget: '360,000,000',
      yearly_plan: '330,000,000',
      yearly_budgetRate: '91.7 %',
      yearly_previousYear: '336,000,000',
      yearly_previousYearRate: '98.2 %',
    },
    {
      label: '売上原価率',
      displayLabel: '-率',
      highlight: false,
      monthly_budget: '57.0%',
      monthly_plan: '57.2%',
      monthly_budgetRate: '0.2 %',
      monthly_previousYear: '57.5%',
      monthly_previousYearRate: '-0.3 %',
      cumulative_budget: '57.0%',
      cumulative_plan: '57.2%',
      cumulative_budgetRate: '0.2 %',
      cumulative_actual: '57.2%',
      cumulative_actualRate: '0.2 %',
      cumulative_previousYear: '57.5%',
      cumulative_previousYearRate: '-0.3 %',
      yearly_budget: '57.0%',
      yearly_plan: '57.2%',
      yearly_budgetRate: '0.2 %',
      yearly_previousYear: '57.5%',
      yearly_previousYearRate: '-0.3 %',
    },
    {
      label: '売上原価金額',
      displayLabel: '-金額',
      highlight: false,
      monthly_budget: '30,000,000',
      monthly_plan: '27,500,000',
      monthly_budgetRate: '91.7 %',
      monthly_previousYear: '28,000,000',
      monthly_previousYearRate: '98.2 %',
      cumulative_budget: '90,000,000',
      cumulative_plan: '82,500,000',
      cumulative_budgetRate: '91.7 %',
      cumulative_actual: '80,000,000',
      cumulative_actualRate: '88.9 %',
      cumulative_previousYear: '84,000,000',
      cumulative_previousYearRate: '98.2 %',
      yearly_budget: '360,000,000',
      yearly_plan: '330,000,000',
      yearly_budgetRate: '91.7 %',
      yearly_previousYear: '336,000,000',
      yearly_previousYearRate: '98.2 %',
    },
    {
      label: '売上総利益',
      highlight: false,
      children: ['売上総利益率', '売上総利益金額'],
      monthly_budget: '22,079,000',
      monthly_plan: '20,238,947',
      monthly_budgetRate: '91.7 %',
      monthly_previousYear: '20,993,765',
      monthly_previousYearRate: '96.4 %',
      cumulative_budget: '66,237,000',
      cumulative_plan: '60,716,841',
      cumulative_budgetRate: '91.7 %',
      cumulative_actual: '57,500,000',
      cumulative_actualRate: '86.8 %',
      cumulative_previousYear: '62,981,295',
      cumulative_previousYearRate: '96.4 %',
      yearly_budget: '264,948,000',
      yearly_plan: '242,867,364',
      yearly_budgetRate: '91.7 %',
      yearly_previousYear: '251,925,180',
      yearly_previousYearRate: '96.4 %',
    },
    {
      label: '売上総利益率',
      displayLabel: '-率',
      highlight: false,
      monthly_budget: '42.0%',
      monthly_plan: '42.2%',
      monthly_budgetRate: '0.2 %',
      monthly_previousYear: '43.0%',
      monthly_previousYearRate: '-0.8 %',
      cumulative_budget: '42.0%',
      cumulative_plan: '42.2%',
      cumulative_budgetRate: '0.2 %',
      cumulative_actual: '41.1%',
      cumulative_actualRate: '-0.9 %',
      cumulative_previousYear: '43.0%',
      cumulative_previousYearRate: '-0.8 %',
      yearly_budget: '42.0%',
      yearly_plan: '42.2%',
      yearly_budgetRate: '0.2 %',
      yearly_previousYear: '43.0%',
      yearly_previousYearRate: '-0.8 %',
    },
    {
      label: '売上総利益金額',
      displayLabel: '-金額',
      highlight: false,
      monthly_budget: '22,079,000',
      monthly_plan: '20,238,947',
      monthly_budgetRate: '91.7 %',
      monthly_previousYear: '20,993,765',
      monthly_previousYearRate: '96.4 %',
      cumulative_budget: '66,237,000',
      cumulative_plan: '60,716,841',
      cumulative_budgetRate: '91.7 %',
      cumulative_actual: '57,500,000',
      cumulative_actualRate: '86.8 %',
      cumulative_previousYear: '62,981,295',
      cumulative_previousYearRate: '96.4 %',
      yearly_budget: '264,948,000',
      yearly_plan: '242,867,364',
      yearly_budgetRate: '91.7 %',
      yearly_previousYear: '251,925,180',
      yearly_previousYearRate: '96.4 %',
    },
    {
      label: '変動費(CF+ロケ補填)',
      highlight: false,
      children: ['センターフィ', 'ロケ補填'],
      monthly_budget: '0',
      monthly_plan: '0',
      monthly_budgetRate: '0.0 %',
      monthly_previousYear: '0',
      monthly_previousYearRate: '0.0 %',
      cumulative_budget: '0',
      cumulative_plan: '0',
      cumulative_budgetRate: '0.0 %',
      cumulative_actual: '0',
      cumulative_actualRate: '0.0 %',
      cumulative_previousYear: '0',
      cumulative_previousYearRate: '0.0 %',
      yearly_budget: '0',
      yearly_plan: '0',
      yearly_budgetRate: '0.0 %',
      yearly_previousYear: '0',
      yearly_previousYearRate: '0.0 %',
    },
    {
      label: 'センターフィ',
      highlight: false,
      monthly_budget: '0',
      monthly_plan: '0',
      monthly_budgetRate: '0.0 %',
      monthly_previousYear: '0',
      monthly_previousYearRate: '0.0 %',
      cumulative_budget: '0',
      cumulative_plan: '0',
      cumulative_budgetRate: '0.0 %',
      cumulative_actual: '0',
      cumulative_actualRate: '0.0 %',
      cumulative_previousYear: '0',
      cumulative_previousYearRate: '0.0 %',
      yearly_budget: '0',
      yearly_plan: '0',
      yearly_budgetRate: '0.0 %',
      yearly_previousYear: '0',
      yearly_previousYearRate: '0.0 %',
    },
    {
      label: 'ロケ補填',
      highlight: false,
      monthly_budget: '0',
      monthly_plan: '0',
      monthly_budgetRate: '0.0 %',
      monthly_previousYear: '0',
      monthly_previousYearRate: '0.0 %',
      cumulative_budget: '0',
      cumulative_plan: '0',
      cumulative_budgetRate: '0.0 %',
      cumulative_actual: '0',
      cumulative_actualRate: '0.0 %',
      cumulative_previousYear: '0',
      cumulative_previousYearRate: '0.0 %',
      yearly_budget: '0',
      yearly_plan: '0',
      yearly_budgetRate: '0.0 %',
      yearly_previousYear: '0',
      yearly_previousYearRate: '0.0 %',
    },
    {
      label: '売買差益',
      highlight: false,
      children: ['売買差益率', '売買差益金額', '売買差益函単価'],
      monthly_budget: '13,559,000',
      monthly_plan: '12,446,544',
      monthly_budgetRate: '91.8 %',
      monthly_previousYear: '12,684,608',
      monthly_previousYearRate: '98.1 %',
      cumulative_budget: '40,677,000',
      cumulative_plan: '37,339,632',
      cumulative_budgetRate: '91.8 %',
      cumulative_actual: '35,190,000',
      cumulative_actualRate: '86.5 %',
      cumulative_previousYear: '38,053,824',
      cumulative_previousYearRate: '98.1 %',
      yearly_budget: '162,708,000',
      yearly_plan: '149,358,528',
      yearly_budgetRate: '91.8 %',
      yearly_previousYear: '152,215,296',
      yearly_previousYearRate: '98.1 %',
    },
    {
      label: '売買差益率',
      displayLabel: '-率',
      highlight: false,
      monthly_budget: '42.0%',
      monthly_plan: '41.2%',
      monthly_budgetRate: '-0.8 %',
      monthly_previousYear: '38.4%',
      monthly_previousYearRate: '2.8 %',
      cumulative_budget: '42.0%',
      cumulative_plan: '41.2%',
      cumulative_budgetRate: '-0.8 %',
      cumulative_actual: '41.2%',
      cumulative_actualRate: '-0.8 %',
      cumulative_previousYear: '38.4%',
      cumulative_previousYearRate: '2.8 %',
      yearly_budget: '42.0%',
      yearly_plan: '41.2%',
      yearly_budgetRate: '-0.8 %',
      yearly_previousYear: '38.4%',
      yearly_previousYearRate: '2.8 %',
    },
    {
      label: '売買差益金額',
      displayLabel: '-金額',
      highlight: false,
      monthly_budget: '13,559,000',
      monthly_plan: '12,446,544',
      monthly_budgetRate: '91.8 %',
      monthly_previousYear: '12,684,608',
      monthly_previousYearRate: '98.1 %',
      cumulative_budget: '40,677,000',
      cumulative_plan: '37,339,632',
      cumulative_budgetRate: '91.8 %',
      cumulative_actual: '35,190,000',
      cumulative_actualRate: '86.5 %',
      cumulative_previousYear: '38,053,824',
      cumulative_previousYearRate: '98.1 %',
      yearly_budget: '162,708,000',
      yearly_plan: '149,358,528',
      yearly_budgetRate: '91.8 %',
      yearly_previousYear: '152,215,296',
      yearly_previousYearRate: '98.1 %',
    },
    {
      label: '売買差益函単価',
      displayLabel: '-函単価',
      highlight: false,
      monthly_budget: '700',
      monthly_plan: '705',
      monthly_budgetRate: '100.7 %',
      monthly_previousYear: '583',
      monthly_previousYearRate: '120.9 %',
      cumulative_budget: '700',
      cumulative_plan: '705',
      cumulative_budgetRate: '100.7 %',
      cumulative_actual: '724',
      cumulative_actualRate: '103.4 %',
      cumulative_previousYear: '583',
      cumulative_previousYearRate: '120.9 %',
      yearly_budget: '700',
      yearly_plan: '705',
      yearly_budgetRate: '100.7 %',
      yearly_previousYear: '583',
      yearly_previousYearRate: '120.9 %',
    },
    {
      label: '直接固定費',
      highlight: false,
      children: ['拡売費（固定費）', '自販機関連費'],
      monthly_budget: '1,415,000',
      monthly_plan: '1,860,000',
      monthly_budgetRate: '131.4 %',
      monthly_previousYear: '1,748,333',
      monthly_previousYearRate: '106.4 %',
      cumulative_budget: '4,245,000',
      cumulative_plan: '5,580,000',
      cumulative_budgetRate: '131.4 %',
      cumulative_actual: '5,253,000',
      cumulative_actualRate: '123.7 %',
      cumulative_previousYear: '5,244,999',
      cumulative_previousYearRate: '106.4 %',
      yearly_budget: '16,980,000',
      yearly_plan: '22,320,000',
      yearly_budgetRate: '131.4 %',
      yearly_previousYear: '20,979,996',
      yearly_previousYearRate: '106.4 %',
    },
    {
      label: '拡売費（固定費）',
      highlight: false,
      children: [
        '拡売費（固定費）拡売費A口',
        '拡売費（固定費）拡売費B口',
        '拡売費（固定費）拡売費本社口',
      ],
      monthly_budget: '1,000,000',
      monthly_plan: '1,300,000',
      monthly_budgetRate: '130.0 %',
      monthly_previousYear: '1,200,000',
      monthly_previousYearRate: '108.3 %',
      cumulative_budget: '3,000,000',
      cumulative_plan: '3,900,000',
      cumulative_budgetRate: '130.0 %',
      cumulative_actual: '3,700,000',
      cumulative_actualRate: '123.3 %',
      cumulative_previousYear: '3,600,000',
      cumulative_previousYearRate: '108.3 %',
      yearly_budget: '12,000,000',
      yearly_plan: '15,600,000',
      yearly_budgetRate: '130.0 %',
      yearly_previousYear: '14,400,000',
      yearly_previousYearRate: '108.3 %',
    },
    {
      label: '拡売費（固定費）拡売費A口',
      highlight: false,
      monthly_budget: '333,333',
      monthly_plan: '433,333',
      monthly_budgetRate: '130.0 %',
      monthly_previousYear: '400,000',
      monthly_previousYearRate: '108.3 %',
      cumulative_budget: '1,000,000',
      cumulative_plan: '1,300,000',
      cumulative_budgetRate: '130.0 %',
      cumulative_actual: '1,233,333',
      cumulative_actualRate: '123.3 %',
      cumulative_previousYear: '1,200,000',
      cumulative_previousYearRate: '108.3 %',
      yearly_budget: '4,000,000',
      yearly_plan: '5,200,000',
      yearly_budgetRate: '130.0 %',
      yearly_previousYear: '4,800,000',
      yearly_previousYearRate: '108.3 %',
    },
    {
      label: '拡売費（固定費）拡売費B口',
      highlight: false,
      monthly_budget: '333,333',
      monthly_plan: '433,333',
      monthly_budgetRate: '130.0 %',
      monthly_previousYear: '400,000',
      monthly_previousYearRate: '108.3 %',
      cumulative_budget: '1,000,000',
      cumulative_plan: '1,300,000',
      cumulative_budgetRate: '130.0 %',
      cumulative_actual: '1,233,333',
      cumulative_actualRate: '123.3 %',
      cumulative_previousYear: '1,200,000',
      cumulative_previousYearRate: '108.3 %',
      yearly_budget: '4,000,000',
      yearly_plan: '5,200,000',
      yearly_budgetRate: '130.0 %',
      yearly_previousYear: '4,800,000',
      yearly_previousYearRate: '108.3 %',
    },
    {
      label: '拡売費（固定費）拡売費本社口',
      highlight: false,
      monthly_budget: '333,334',
      monthly_plan: '433,334',
      monthly_budgetRate: '130.0 %',
      monthly_previousYear: '400,000',
      monthly_previousYearRate: '108.3 %',
      cumulative_budget: '1,000,000',
      cumulative_plan: '1,300,000',
      cumulative_budgetRate: '130.0 %',
      cumulative_actual: '1,233,334',
      cumulative_actualRate: '123.3 %',
      cumulative_previousYear: '1,200,000',
      cumulative_previousYearRate: '108.3 %',
      yearly_budget: '4,000,000',
      yearly_plan: '5,200,000',
      yearly_budgetRate: '130.0 %',
      yearly_previousYear: '4,800,000',
      yearly_previousYearRate: '108.3 %',
    },
    {
      label: '自販機関連費',
      highlight: false,
      children: ['コルム料', 'リース料', '販売器具費'],
      monthly_budget: '415,000',
      monthly_plan: '560,000',
      monthly_budgetRate: '134.9 %',
      monthly_previousYear: '548,333',
      monthly_previousYearRate: '102.1 %',
      cumulative_budget: '1,245,000',
      cumulative_plan: '1,680,000',
      cumulative_budgetRate: '134.9 %',
      cumulative_actual: '1,553,000',
      cumulative_actualRate: '124.7 %',
      cumulative_previousYear: '1,644,999',
      cumulative_previousYearRate: '102.1 %',
      yearly_budget: '4,980,000',
      yearly_plan: '6,720,000',
      yearly_budgetRate: '134.9 %',
      yearly_previousYear: '6,579,996',
      yearly_previousYearRate: '102.1 %',
    },
    {
      label: 'コルム料',
      highlight: false,
      monthly_budget: '138,333',
      monthly_plan: '186,667',
      monthly_budgetRate: '134.9 %',
      monthly_previousYear: '182,778',
      monthly_previousYearRate: '102.1 %',
      cumulative_budget: '415,000',
      cumulative_plan: '560,000',
      cumulative_budgetRate: '134.9 %',
      cumulative_actual: '517,667',
      cumulative_actualRate: '124.7 %',
      cumulative_previousYear: '548,333',
      cumulative_previousYearRate: '102.1 %',
      yearly_budget: '1,660,000',
      yearly_plan: '2,240,000',
      yearly_budgetRate: '134.9 %',
      yearly_previousYear: '2,193,332',
      yearly_previousYearRate: '102.1 %',
    },
    {
      label: 'リース料',
      highlight: false,
      monthly_budget: '138,333',
      monthly_plan: '186,667',
      monthly_budgetRate: '134.9 %',
      monthly_previousYear: '182,778',
      monthly_previousYearRate: '102.1 %',
      cumulative_budget: '415,000',
      cumulative_plan: '560,000',
      cumulative_budgetRate: '134.9 %',
      cumulative_actual: '517,667',
      cumulative_actualRate: '124.7 %',
      cumulative_previousYear: '548,333',
      cumulative_previousYearRate: '102.1 %',
      yearly_budget: '1,660,000',
      yearly_plan: '2,240,000',
      yearly_budgetRate: '134.9 %',
      yearly_previousYear: '2,193,332',
      yearly_previousYearRate: '102.1 %',
    },
    {
      label: '販売器具費',
      highlight: false,
      monthly_budget: '138,334',
      monthly_plan: '186,666',
      monthly_budgetRate: '134.9 %',
      monthly_previousYear: '182,777',
      monthly_previousYearRate: '102.1 %',
      cumulative_budget: '415,000',
      cumulative_plan: '560,000',
      cumulative_budgetRate: '134.9 %',
      cumulative_actual: '517,666',
      cumulative_actualRate: '124.7 %',
      cumulative_previousYear: '548,333',
      cumulative_previousYearRate: '102.1 %',
      yearly_budget: '1,660,000',
      yearly_plan: '2,240,000',
      yearly_budgetRate: '134.9 %',
      yearly_previousYear: '2,193,332',
      yearly_previousYearRate: '102.1 %',
    },
    {
      label: '管理利益',
      highlight: false,
      children: ['管理利益率', '管理利益金額', '管理利益函単価'],
      monthly_budget: '12,144,000',
      monthly_plan: '10,586,544',
      monthly_budgetRate: '87.2 %',
      monthly_previousYear: '10,936,275',
      monthly_previousYearRate: '96.8 %',
      cumulative_budget: '36,432,000',
      cumulative_plan: '31,759,632',
      cumulative_budgetRate: '87.2 %',
      cumulative_actual: '29,937,000',
      cumulative_actualRate: '82.2 %',
      cumulative_previousYear: '32,808,825',
      cumulative_previousYearRate: '96.8 %',
      yearly_budget: '145,728,000',
      yearly_plan: '127,038,528',
      yearly_budgetRate: '87.2 %',
      yearly_previousYear: '131,235,300',
      yearly_previousYearRate: '96.8 %',
    },
    {
      label: '管理利益率',
      displayLabel: '-率',
      highlight: false,
      monthly_budget: '37.6%',
      monthly_plan: '35.0%',
      monthly_budgetRate: '-2.6 %',
      monthly_previousYear: '33.1%',
      monthly_previousYearRate: '1.9 %',
      cumulative_budget: '37.6%',
      cumulative_plan: '35.0%',
      cumulative_budgetRate: '-2.6 %',
      cumulative_actual: '35.0%',
      cumulative_actualRate: '-2.6 %',
      cumulative_previousYear: '33.1%',
      cumulative_previousYearRate: '1.9 %',
      yearly_budget: '37.6%',
      yearly_plan: '35.0%',
      yearly_budgetRate: '-2.6 %',
      yearly_previousYear: '33.1%',
      yearly_previousYearRate: '1.9 %',
    },
    {
      label: '管理利益金額',
      displayLabel: '-金額',
      highlight: false,
      monthly_budget: '12,144,000',
      monthly_plan: '10,586,544',
      monthly_budgetRate: '87.2 %',
      monthly_previousYear: '10,936,275',
      monthly_previousYearRate: '96.8 %',
      cumulative_budget: '36,432,000',
      cumulative_plan: '31,759,632',
      cumulative_budgetRate: '87.2 %',
      cumulative_actual: '29,937,000',
      cumulative_actualRate: '82.2 %',
      cumulative_previousYear: '32,808,825',
      cumulative_previousYearRate: '96.8 %',
      yearly_budget: '145,728,000',
      yearly_plan: '127,038,528',
      yearly_budgetRate: '87.2 %',
      yearly_previousYear: '131,235,300',
      yearly_previousYearRate: '96.8 %',
    },
    {
      label: '管理利益函単価',
      displayLabel: '-函単価',
      highlight: false,
      monthly_budget: '627',
      monthly_plan: '599',
      monthly_budgetRate: '95.5 %',
      monthly_previousYear: '503',
      monthly_previousYearRate: '119.1 %',
      cumulative_budget: '627',
      cumulative_plan: '599',
      cumulative_budgetRate: '95.5 %',
      cumulative_actual: '616',
      cumulative_actualRate: '98.2 %',
      cumulative_previousYear: '503',
      cumulative_previousYearRate: '119.1 %',
      yearly_budget: '627',
      yearly_plan: '599',
      yearly_budgetRate: '95.5 %',
      yearly_previousYear: '503',
      yearly_previousYearRate: '119.1 %',
    },
  ];

  const buildRows = (
    getBudget: (r: UnifiedAggregationData) => string,
    getPlan: (r: UnifiedAggregationData) => string,
    getBudgetRate: (r: UnifiedAggregationData) => string,
    getActual: ((r: UnifiedAggregationData) => string) | null,
    getActualRate: ((r: UnifiedAggregationData) => string) | null,
    getPreviousYear: (r: UnifiedAggregationData) => string,
    getPreviousYearRate: (r: UnifiedAggregationData) => string
  ) => {
    const dataByLabel = new Map(unifiedData.map((r) => [r.label, r]));
    const rows: any[] = [];

    // 子孫の総数を計算（ツリー全体の子孫数）
    const countDescendants = (label: string): number => {
      const data = dataByLabel.get(label);
      if (!data || !data.children || data.children.length === 0) {
        return 0;
      }
      let count = data.children.length;
      for (const child of data.children) {
        count += countDescendants(child);
      }
      return count;
    };

    // 階層構造をフラット配列として構築
    const buildFlatTree = (label: string, parentPath: string[] = []): void => {
      const data = dataByLabel.get(label);
      if (!data) return;

      const level = parentPath.length;
      const descendantCount = countDescendants(label);
      const currentPath = [...parentPath, label];
      const displayLabel = data.displayLabel || label;

      // サブラベルを決定（-率、-金額などの場合は2列目に表示）
      let itemLabel = displayLabel;
      let subLabel = '';
      if (displayLabel.startsWith('-')) {
        itemLabel = '';
        subLabel = displayLabel;
      }

      rows.push({
        label: itemLabel,
        subLabel: subLabel,
        originalLabel: label,
        budget: getBudget(data),
        plan: getPlan(data),
        budgetRate: getBudgetRate(data),
        actual: getActual ? getActual(data) : '',
        actualRate: getActualRate ? getActualRate(data) : '',
        previousYear: getPreviousYear(data),
        previousYearRate: getPreviousYearRate(data),
        highlight: data.highlight,
        level,
        hasChildren: data.children && data.children.length > 0,
        descendantCount,
        hierarchyPath: currentPath,
      });

      // 子要素がある場合は再帰的に追加
      if (data.children && data.children.length > 0) {
        for (const childLabel of data.children) {
          buildFlatTree(childLabel, currentPath);
        }
      }
    };

    // トップレベル項目からツリーを構築
    for (const topItem of topLevelItems) {
      buildFlatTree(topItem, []);
    }

    return rows;
  };

  const leftData = buildRows(
    (r) => r.monthly_budget,
    (r) => r.monthly_plan,
    (r) => r.monthly_budgetRate,
    (r) => r.cumulative_actual,
    (r) => r.cumulative_actualRate,
    (r) => r.monthly_previousYear,
    (r) => r.monthly_previousYearRate
  );

  const cumulativeData = buildRows(
    (r) => r.cumulative_budget,
    (r) => r.cumulative_plan,
    (r) => r.cumulative_budgetRate,
    (r) => r.cumulative_actual,
    (r) => r.cumulative_actualRate,
    (r) => r.cumulative_previousYear,
    (r) => r.cumulative_previousYearRate
  );

  const yearlyData = buildRows(
    (r) => r.yearly_budget,
    (r) => r.yearly_plan,
    (r) => r.yearly_budgetRate,
    null,
    null,
    (r) => r.yearly_previousYear,
    (r) => r.yearly_previousYearRate
  );

  // パターン別集計表の値は、確度選択で絞り込んだ販売計画(詳細)の実集計で供給する。
  // → renderTablePatternSection 内で makeSimulationTreeValueFor によりパターンごとに生成する。

  // 月次用カラム定義（メタブランド別集計）
  const monthlyColumnDefs: (ColDef | ColGroupDef)[] = useMemo(
    () => [
      {
        headerName: 'メタブランド',
        field: 'metaBrand',
        width: 128,
        lockPinned: true,
        cellClass: 'ag-cell-left-pinned',
        // 1列目左寄せは cellClass 'ag-cell-left-pinned'（grid.css）で担保。
        // ここでは1文字インデントのみ付与する。
        cellStyle: { paddingLeft: '1em' },
        flex: 0,
      },
      {
        headerName: '売上高',
        children: [
          {
            headerName: '構成比',
            field: 'netSales_composition',
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
          {
            headerName: '予算比',
            field: 'netSales_budgetRate',
            cellStyle: (params) => rateCellStyle(params.value),
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
          {
            headerName: '前年比',
            field: 'netSales_previousYearRate',
            cellStyle: (params) => rateCellStyle(params.value),
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
        ],
      },
      {
        headerName: '管理利益',
        children: [
          {
            headerName: '構成比',
            field: 'managementProfit_composition',
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
          {
            headerName: '予算比',
            field: 'managementProfit_budgetRate',
            cellStyle: (params) => rateCellStyle(params.value),
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
          {
            headerName: '前年比',
            field: 'managementProfit_previousYearRate',
            cellStyle: (params) => rateCellStyle(params.value),
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
          {
            headerName: '率',
            field: 'managementProfit_rate',
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
          {
            headerName: '率前年差',
            field: 'managementProfit_rateDiff',
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
        ],
      },
    ],
    []
  );

  // 累計用カラム定義（メタブランド別集計）
  const cumulativeColumnDefs: (ColDef | ColGroupDef)[] = useMemo(
    () => [
      {
        headerName: 'メタブランド',
        field: 'metaBrand',
        width: 128,
        lockPinned: true,
        cellClass: 'ag-cell-left-pinned',
        // 1列目左寄せは cellClass 'ag-cell-left-pinned'（grid.css）で担保。
        // ここでは1文字インデントのみ付与する。
        cellStyle: { paddingLeft: '1em' },
        flex: 0,
      },
      {
        headerName: '売上高',
        children: [
          {
            headerName: '構成比',
            field: 'netSales_composition',
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
          {
            headerName: '予算比',
            field: 'netSales_budgetRate',
            cellStyle: (params) => rateCellStyle(params.value),
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
          {
            headerName: '前年比',
            field: 'netSales_previousYearRate',
            cellStyle: (params) => rateCellStyle(params.value),
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
        ],
      },
      {
        headerName: '管理利益',
        children: [
          {
            headerName: '構成比',
            field: 'managementProfit_composition',
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
          {
            headerName: '予算比',
            field: 'managementProfit_budgetRate',
            cellStyle: (params) => rateCellStyle(params.value),
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
          {
            headerName: '前年比',
            field: 'managementProfit_previousYearRate',
            cellStyle: (params) => rateCellStyle(params.value),
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
          {
            headerName: '率',
            field: 'managementProfit_rate',
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
          {
            headerName: '率前年差',
            field: 'managementProfit_rateDiff',
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
        ],
      },
    ],
    []
  );

  // 年間用カラム定義（メタブランド別集計）
  const yearlyColumnDefs: (ColDef | ColGroupDef)[] = useMemo(
    () => [
      {
        headerName: 'メタブランド',
        field: 'metaBrand',
        width: 128,
        lockPinned: true,
        cellClass: 'ag-cell-left-pinned',
        // 1列目左寄せは cellClass 'ag-cell-left-pinned'（grid.css）で担保。
        // ここでは1文字インデントのみ付与する。
        cellStyle: { paddingLeft: '1em' },
        flex: 0,
      },
      {
        headerName: '売上高',
        children: [
          {
            headerName: '構成比',
            field: 'netSales_composition',
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
          {
            headerName: '予算比',
            field: 'netSales_budgetRate',
            cellStyle: (params) => rateCellStyle(params.value),
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
          {
            headerName: '前年比',
            field: 'netSales_previousYearRate',
            cellStyle: (params) => rateCellStyle(params.value),
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
        ],
      },
      {
        headerName: '管理利益',
        children: [
          {
            headerName: '構成比',
            field: 'managementProfit_composition',
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
          {
            headerName: '予算比',
            field: 'managementProfit_budgetRate',
            cellStyle: (params) => rateCellStyle(params.value),
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
          {
            headerName: '前年比',
            field: 'managementProfit_previousYearRate',
            cellStyle: (params) => rateCellStyle(params.value),
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
          {
            headerName: '率',
            field: 'managementProfit_rate',
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
          {
            headerName: '率前年差',
            field: 'managementProfit_rateDiff',
            flex: 1,
            minWidth: 80,
            cellClass: 'ag-cell-right',
          },
        ],
      },
    ],
    []
  );

  // グラフ用に表示単位（円／千円）の除数を算出する
  // 千円表示時は金額を 1000 で割る（率項目には適用しない）
  const chartDivisor = displayUnit === 'thousand' ? 1000 : 1;

  // グラフ（初期表示）に表示する6指標（資料 課題0623「計画詳細_グラフタブ」の〇項目に統一）
  // 函数＝数量（函）、売上高・社外売上高・管理利益額・拡売費＝金額、管理利益率＝率（％）。
  // label は集計データとの突合キー、name はカードの表示名（両者が異なる項目のみ表記が変わる）。
  const CHART_TARGET_ITEMS = [
    { label: '函数', name: '函数', isRate: false, isQuantity: true },
    // 社外売上高は売上高の左に表示する（10/30 第5回 決定事項22）
    { label: '社外売上高', name: '社外売上高', isRate: false },
    { label: '売上高', name: '売上高', isRate: false },
    { label: '管理利益', name: '管理利益額', isRate: false },
    { label: '管理利益率', name: '管理利益率', isRate: true },
    {
      label: '拡売費（売上連動拡売費＋直接固定費）',
      name: '拡売費（売上連動拡売費＋直接固定費）',
      isRate: false,
      // 拡売費はコスト項目のため、予算比・前年比の良し悪しが他の指標と逆になる
      // （予算・前年を下回る＝○、上回る＝×）。カードの色判定を反転させる目印。
      isCost: true,
    },
  ];

  // フラット化済みデータ（leftData/cumulativeData/yearlyData）から6指標を抽出する
  const prepareChartDataFrom = (rows: typeof leftData) =>
    CHART_TARGET_ITEMS.map(({ label, name, isRate, isQuantity, isCost }) => {
      const row = rows.find((r) => (r.originalLabel || r.label) === label);
      // 率・数量（函数）は金額単位に非依存のため除数を適用しない
      const divisor = isRate || isQuantity ? 1 : chartDivisor;
      const parseValue = (str?: string) =>
        parseFloat(String(str ?? '0').replace(/,/g, '')) / divisor;
      if (!row) {
        // 集計データにラベルが無い項目（例：拡売費（売上連動拡売費＋直接固定費））はモック値で表示
        const seed = Array.from(label).reduce((s, c) => s + c.charCodeAt(0), 0);
        const mock = (o: number) =>
          isRate
            ? 8 + ((seed * o) % 70)
            : (60000 + ((seed * o * 131) % 900000)) / divisor;
        return {
          name,
          予算: mock(7),
          計画: mock(5),
          前年同月: mock(3),
          isRate,
          isQuantity,
          isCost,
        };
      }
      return {
        name,
        予算: parseValue(row.budget),
        計画: parseValue(row.plan),
        前年同月: parseValue(row.previousYear),
        isRate,
        isQuantity,
        isCost,
      };
    });

  const prepareMonthlyChartData = () => prepareChartDataFrom(leftData);
  const prepareCumulativeChartData = () => prepareChartDataFrom(cumulativeData);
  const prepareYearlyChartData = () => prepareChartDataFrom(yearlyData);

  // パターン見出し＋集計確度選択チェックボックス
  const renderPatternHeader = (
    patternLabel: string,
    values: {
      a: boolean;
      b: boolean;
      c: boolean;
      fixed: boolean;
      reflected: boolean;
    },
    handlers: {
      onA: (v: boolean) => void;
      onB: (v: boolean) => void;
      onC: (v: boolean) => void;
      onFixed: (v: boolean) => void;
      onReflected: (v: boolean) => void;
    }
  ) => {
    const items = [
      { label: '確定', checked: values.fixed, onChange: handlers.onFixed },
      { label: 'A', checked: values.a, onChange: handlers.onA },
      { label: 'B', checked: values.b, onChange: handlers.onB },
      { label: 'C', checked: values.c, onChange: handlers.onC },
    ];
    return (
      <div className="flex items-center gap-6 mb-2">
        {/* パターン①②の見出しはカードのタイトルと同じ大きさにする */}
        <span className={CARD_TITLE_CLASS}>{patternLabel}</span>
        <div className="flex items-center gap-2">
          <label className={`${FORM_LABEL_CLASS} whitespace-nowrap`}>
            集計確度選択
          </label>
          <div className="flex items-center gap-4">
            {items.map((item) => (
              <label
                key={item.label}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={(e) => item.onChange(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm">{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // パターン①／②の確度選択値とハンドラ
  const p1Values = {
    a: isP1A,
    b: isP1B,
    c: isP1C,
    fixed: isP1Fixed,
    reflected: isP1Reflected,
  };
  const p1Handlers = {
    onA: setIsP1A,
    onB: setIsP1B,
    onC: setIsP1C,
    onFixed: setIsP1Fixed,
    onReflected: setIsP1Reflected,
  };
  const p2Values = {
    a: isP2A,
    b: isP2B,
    c: isP2C,
    fixed: isP2Fixed,
    reflected: isP2Reflected,
  };
  const p2Handlers = {
    onA: setIsP2A,
    onB: setIsP2B,
    onC: setIsP2C,
    onFixed: setIsP2Fixed,
    onReflected: setIsP2Reflected,
  };

  // パターン別グラフセクション（見出し＋グラフ群）
  const renderChartPatternSection = (
    wrapperClass: string,
    patternLabel: string,
    values: {
      a: boolean;
      b: boolean;
      c: boolean;
      fixed: boolean;
      reflected: boolean;
    },
    handlers: {
      onA: (v: boolean) => void;
      onB: (v: boolean) => void;
      onC: (v: boolean) => void;
      onFixed: (v: boolean) => void;
      onReflected: (v: boolean) => void;
    },
    chartData: any[]
  ) => (
    <div className={wrapperClass}>
      {renderPatternHeader(patternLabel, values, handlers)}
      <div className="grid grid-cols-6 gap-2">
        {chartData.map((data, idx) => renderKpiCard(data, idx))}
      </div>
    </div>
  );

  // パターン別テーブルセクション（見出し＋集計表）
  const renderTablePatternSection = (
    wrapperClass: string,
    patternLabel: string,
    values: {
      a: boolean;
      b: boolean;
      c: boolean;
      fixed: boolean;
      reflected: boolean;
    },
    handlers: {
      onA: (v: boolean) => void;
      onB: (v: boolean) => void;
      onC: (v: boolean) => void;
      onFixed: (v: boolean) => void;
      onReflected: (v: boolean) => void;
    },
    _gridClass?: string,
    _colDefs?: (ColDef | ColGroupDef)[]
  ) => {
    // パターン①／②で独立した高さ・リサイズハンドルを使う
    const resize =
      patternLabel === 'パターン②' ? pattern2Resize : pattern1Resize;
    // 集計確度選択（確定/A/B/C）で販売計画(詳細)の明細を絞り込み、パターンごとに実集計する。
    // → パターン①/②で対象行が変わるため集計値も変わる。
    const patternValueFor = makeSimulationTreeValueFor(
      detailRows,
      { fixed: values.fixed, a: values.a, b: values.b, c: values.c },
      ratios,
      displayUnit,
      // 「A口のみ」チェック時は対象管理区分の拡売費だけを集計する（共通対応方針P31）
      { aOnlyPromo: isAOnlyPromo }
    );
    return (
      <div className={wrapperClass}>
        {renderPatternHeader(patternLabel, values, handlers)}
        {/* 課題0623：表示項目は計画詳細（詳細タブ=monthlyDetail）と揃える一方、集計値は
            シミュレーション(詳細)グリッドの入力を確度選択で絞り込んで合算する。
            詳細グリッドが持たない項目（量経追加口・売上原価 等）は空欄表示。 */}
        <AggregationItemTreeTable
          view="simulation"
          valueFor={patternValueFor}
          height={resize.height}
          // ドリルダウンの開閉状態をパターンごとに保存する
          // （補助項目の表示／非表示それぞれで別に保持される）
          expandStateKey={`${expandStatePrefix}.agg.${patternLabel === 'パターン①' ? 'p1' : 'p2'}`}
          columnStateKey={`${expandStatePrefix}.agg.${patternLabel === 'パターン①' ? 'p1' : 'p2'}.columnState`}
        />
        {/* リサイズハンドルはAG Gridの外（表の下端）に配置する */}
        <div className="relative h-2">
          <ResizeHandle onMouseDown={resize.handleMouseDown} />
        </div>
      </div>
    );
  };

  const renderKpiCard = (data: any, index: number) => {
    const budgetRate = (data.計画 / data.予算) * 100;
    const previousYearRate = (data.計画 / data.前年同月) * 100;

    // 表示単位ラベル（円／千円）。比率は単位非依存のため率計算には影響しない
    const unitLabel = displayUnit === 'thousand' ? '千円' : '円';

    // 拡売費（コスト項目）は少ないほど良いため、KPI カードの色の向きを逆にする（→ KpiCard）
    const isCostCard = Boolean(data.isCost);

    // 値の表示整形：率項目（売買差益率・管理利益率）は％、金額項目は接頭辞＋円／千円
    // 率項目は小数点以下2桁を四捨五入し、小数点以下1桁・3桁区切りで表示する（計画詳細のグラフと同じ丸め）
    // 金額項目は円・千円いずれの表示単位でも整数表示にする（円・千円とも端数は四捨五入する）
    const formatValue = (v: number, prefix: string) =>
      data.isRate
        ? formatPlanRate(v, PLAN_DETAIL_DIGITS.rate)
        : data.isQuantity
          ? `${Math.round(v).toLocaleString()} 函`
          : `${prefix}${Math.round(v).toLocaleString()} ${unitLabel}`;

    // 差（計画−予算／計画−前年）の表記。プラスは「+」、マイナスは「△」を付け、色以外の手がかり（符号）を必ず併用する。
    // 丸めた結果が 0 になる場合は符号を付けない。率項目はポイント差を小数第1位まで表示する。
    const buildDiff = (v: number) => {
      const abs = Math.abs(v);
      // 丸めた結果が0なら符号を付けないため、率もここで表示桁へ丸めてから判定する。
      const rounded = data.isRate
        ? Number(abs.toFixed(PLAN_DETAIL_DIGITS.rate))
        : Math.round(abs);
      const body = data.isRate
        ? formatPlanRate(rounded, PLAN_DETAIL_DIGITS.rate)
        : data.isQuantity
          ? `${rounded.toLocaleString()} 函`
          : `${rounded.toLocaleString()} ${unitLabel}`;
      if (rounded === 0) return body;
      return v > 0 ? `+${body}` : `△${body}`;
    };

    const budgetDiff = buildDiff(data.計画 - data.予算);
    const previousYearDiff = buildDiff(data.計画 - data.前年同月);

    return (
      <KpiCard
        key={index}
        name={data.name}
        valueLabel="計画値"
        valueText={formatValue(data.計画, '¥')}
        budgetRate={budgetRate}
        budgetRateText={formatPlanRate(budgetRate, PLAN_DETAIL_DIGITS.rate)}
        budgetDiffText={budgetDiff}
        previousYearRate={previousYearRate}
        previousYearRateText={formatPlanRate(
          previousYearRate,
          PLAN_DETAIL_DIGITS.rate
        )}
        previousYearDiffText={previousYearDiff}
        isCost={isCostCard}
      />
    );
  };

  // 集計表の累計・年間表示は廃止（対象期間合計のみ表示）
  const showCumulativeYearly = false;

  return (
    <CollapsibleCard
      title="シミュレーション（集計）"
      open={isOpen}
      onOpenChange={setIsOpen}
      className="mb-4"
    >
      <div className="p-4">
        {/* 第1行 */}
        <div className="flex items-center gap-3 mb-3">
          {/* 対象期間（集計エリアの1行目に常時表示） */}
          <SimulationPeriodPicker
            fromId={AGGREGATION_PERIOD_FROM_ID}
            ariaLabelPrefix="集計の対象期間"
            shouldAllowPastMonths
            fromPeriod={fromPeriod}
            toPeriod={toPeriod}
            onFromPeriodChange={onFromPeriodChange}
            onToPeriodChange={onToPeriodChange}
          />

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

          <div className="flex items-center justify-end ml-auto">
            {/* タブボタン群 */}
            <div className="flex border-2 border-blue-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setActiveTab('detail')}
                disabled={isCampaignTabSelected}
                className={`px-4 py-1 h-8 whitespace-nowrap text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  activeTab === 'detail'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-blue-600 hover:bg-blue-50 disabled:hover:bg-white'
                }`}
              >
                詳細
              </button>
              <div className="w-px bg-blue-600" />
              <button
                onClick={() => setActiveTab('graph')}
                disabled={isCampaignTabSelected}
                className={`px-4 py-1 h-8 whitespace-nowrap text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  activeTab === 'graph'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-blue-600 hover:bg-blue-50 disabled:hover:bg-white'
                }`}
              >
                グラフ
              </button>
            </div>
          </div>
        </div>

        {/* 第2行 */}
        <div className="flex items-center gap-3">
          {/* 拡売費集計対象選択 */}
          <div className="flex items-center gap-2">
            <label
              className={`${FORM_LABEL_CLASS} whitespace-nowrap w-35 px-2 py-1`}
            >
              拡売費集計対象選択
            </label>
            <RadioGroup
              defaultValue="target-month"
              className="flex items-center gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="target-month" id="target-month" />
                <Label
                  htmlFor="target-month"
                  className="cursor-pointer text-sm font-normal"
                >
                  対象月
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="posting-month" id="posting-month" />
                <Label
                  htmlFor="posting-month"
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

          {/* 表示単位トグル（円／千円） */}
          <div className="flex items-center gap-2">
            <label className={`${FORM_LABEL_CLASS} whitespace-nowrap`}>
              表示単位
            </label>
            <SegmentToggle
              ariaLabel="表示単位"
              options={[
                { value: 'yen', label: '円' },
                { value: 'thousand', label: '千円' },
              ]}
              value={displayUnit}
              onChange={setDisplayUnit}
            />
          </div>
        </div>
      </div>

      {/* タブ内容（集計対象設定は画面右ペインで開く） */}
      <div className={hasContentBottomPadding ? 'pb-4' : undefined}>
        {/* グラフ表示 */}
        {activeTab === 'graph' && (
          <div className="mb-4">
            <Tabs
              value={detailTableTab}
              onValueChange={setDetailTableTab}
              className="w-full"
            >
              <TabsList
                className={`grid w-full grid-cols-2 mb-4 bg-transparent p-0 h-auto gap-1`}
              >
                <TabsTrigger
                  value="monthly"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded"
                >
                  <Calendar className="w-4 h-4" />
                  <span className="font-medium">対象期間合計</span>
                </TabsTrigger>
                <TabsTrigger
                  value="campaign"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded"
                >
                  <ClipboardList className="w-4 h-4" />
                  <span className="font-medium">企画単位集計</span>
                </TabsTrigger>
                {showCumulativeYearly && (
                  <>
                    <TabsTrigger
                      value="cumulative"
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded"
                    >
                      <TrendingUp className="w-4 h-4" />
                      <span className="font-medium">累計</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="yearly"
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded"
                    >
                      <CalendarRange className="w-4 h-4" />
                      <span className="font-medium">年間</span>
                    </TabsTrigger>
                  </>
                )}
              </TabsList>

              <TabsContent value="monthly">
                {renderChartPatternSection(
                  'mx-4',
                  'パターン①',
                  p1Values,
                  p1Handlers,
                  prepareMonthlyChartData()
                )}
                {renderChartPatternSection(
                  'mx-4 mt-6',
                  'パターン②',
                  p2Values,
                  p2Handlers,
                  prepareMonthlyChartData()
                )}
              </TabsContent>

              {/* 企画単位集計タブ（詳細タブと同じテーブルを表示） */}
              <TabsContent value="campaign">
                <div className="mx-4 mt-2 mb-4">
                  <SimulationCampaignSummaryTable
                    columnStateKey={`${expandStatePrefix}.campaign.columnState`}
                    shouldExcludeReflected={shouldExcludeCampaignReflected}
                    shouldExcludeRejected={shouldExcludeCampaignRejected}
                    onExcludeReflectedChange={setShouldExcludeCampaignReflected}
                    onExcludeRejectedChange={setShouldExcludeCampaignRejected}
                    showWholesaleMesh={showWholesaleMesh}
                    data={campaignData}
                    displayUnit={displayUnit}
                    height={campaignResize.height}
                  />
                  {/* リサイズハンドルはAG Gridの外（表の下端）に配置する */}
                  <div className="relative h-2">
                    <ResizeHandle
                      onMouseDown={campaignResize.handleMouseDown}
                    />
                  </div>
                </div>
              </TabsContent>

              {showCumulativeYearly && (
                <>
                  <TabsContent value="cumulative">
                    {renderChartPatternSection(
                      'mx-4',
                      'パターン①',
                      p1Values,
                      p1Handlers,
                      prepareCumulativeChartData()
                    )}
                    {renderChartPatternSection(
                      'mx-4 mt-6',
                      'パターン②',
                      p2Values,
                      p2Handlers,
                      prepareCumulativeChartData()
                    )}
                  </TabsContent>

                  <TabsContent value="yearly">
                    {renderChartPatternSection(
                      'mx-4',
                      'パターン①',
                      p1Values,
                      p1Handlers,
                      prepareYearlyChartData()
                    )}
                    {renderChartPatternSection(
                      'mx-4 mt-6',
                      'パターン②',
                      p2Values,
                      p2Handlers,
                      prepareYearlyChartData()
                    )}
                  </TabsContent>
                </>
              )}
            </Tabs>
          </div>
        )}

        {/* 表表示 */}
        {activeTab === 'detail' && (
          <div className="mb-4 relative">
            <Tabs
              value={detailTableTab}
              onValueChange={setDetailTableTab}
              className="w-full"
            >
              <TabsList
                className={`grid w-full grid-cols-2 mb-4 bg-transparent p-0 h-auto gap-1`}
              >
                <TabsTrigger
                  value="monthly"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded"
                >
                  <Calendar className="w-4 h-4" />
                  <span className="font-medium">対象期間合計</span>
                </TabsTrigger>
                <TabsTrigger
                  value="campaign"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded"
                >
                  <ClipboardList className="w-4 h-4" />
                  <span className="font-medium">企画単位集計</span>
                </TabsTrigger>
                {showCumulativeYearly && (
                  <>
                    <TabsTrigger
                      value="cumulative"
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded"
                    >
                      <TrendingUp className="w-4 h-4" />
                      <span className="font-medium">累計</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="yearly"
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded"
                    >
                      <CalendarRange className="w-4 h-4" />
                      <span className="font-medium">年間</span>
                    </TabsTrigger>
                  </>
                )}
              </TabsList>

              <TabsContent value="monthly">
                <style>{`
                      .sales-plan-aggregation-monthly .ag-cell-right {
                        text-align: right;
                      }
                      .sales-plan-aggregation-monthly .ag-cell-left-pinned {
                        background-color: inherit !important;
                        font-weight: 600;
                        text-align: left;
                      }
                      /* ヘッダ背景・罫線・セル背景は共通テーマ（支払申請一覧参照と同一）に統一。
                         合計行のみ getRowStyle で薄青（GRID_COLORS.total）にする。 */
                      /* 販売計画(詳細)に合わせ行ホバーをGRID_COLORS.rowHoverに統一 */
                      .sales-plan-aggregation-monthly .ag-row-hover .ag-cell {
                        background-color: var(--grid-row-hover) !important;
                      }
                      .sales-plan-aggregation-monthly [col-id="label"].ag-cell {
                        z-index: 2;
                        overflow: visible;
                      }
                      .sales-plan-aggregation-monthly [col-id="label"] .ag-cell-wrapper {
                        height: 100%;
                        align-items: center;
                      }
                      .sales-plan-aggregation-monthly .ag-row-level-1 [col-id="label"].ag-cell {
                        background-color: var(--grid-tree-level1-bg) !important;
                      }
                      .sales-plan-aggregation-monthly .ag-row-level-2 [col-id="label"].ag-cell {
                        background-color: var(--grid-tree-level2-bg) !important;
                      }
                      .sales-plan-aggregation-monthly .ag-row-highlight .ag-cell-left-pinned {
                        background-color: var(--grid-row-hover) !important;
                      }
                      .sales-plan-aggregation-monthly .ag-pinned-left-header .ag-header-cell:first-child {
                        border-right: none !important;
                      }
                      .sales-plan-aggregation-monthly .ag-pinned-left-header .ag-header-cell:nth-child(2) {
                        border-left: none !important;
                      }
                    `}</style>
                {renderTablePatternSection(
                  'mx-4',
                  'パターン①',
                  p1Values,
                  p1Handlers,
                  'sales-plan-aggregation-monthly',
                  monthlyColumnDefs
                )}
                {renderTablePatternSection(
                  'mx-4 mt-6',
                  'パターン②',
                  p2Values,
                  p2Handlers,
                  'sales-plan-aggregation-monthly',
                  monthlyColumnDefs
                )}
              </TabsContent>

              {showCumulativeYearly && (
                <>
                  <TabsContent value="cumulative">
                    <style>{`
                      .sales-plan-aggregation-cumulative .ag-cell-right {
                        text-align: right;
                      }
                      .sales-plan-aggregation-cumulative .ag-cell-left-pinned {
                        background-color: inherit !important;
                        font-weight: 600;
                        text-align: left;
                      }
                      /* ヘッダ背景・罫線・セル背景は共通テーマ（支払申請一覧参照と同一）に統一。
                         合計行のみ getRowStyle で薄青（GRID_COLORS.total）にする。 */
                      /* 販売計画(詳細)に合わせ行ホバーをGRID_COLORS.rowHoverに統一 */
                      .sales-plan-aggregation-cumulative .ag-row-hover .ag-cell {
                        background-color: var(--grid-row-hover) !important;
                      }
                      .sales-plan-aggregation-cumulative [col-id="label"].ag-cell {
                        z-index: 2;
                        overflow: visible;
                      }
                      .sales-plan-aggregation-cumulative [col-id="label"] .ag-cell-wrapper {
                        height: 100%;
                        align-items: center;
                      }
                      .sales-plan-aggregation-cumulative .ag-row-level-1 [col-id="label"].ag-cell {
                        background-color: var(--grid-tree-level1-bg) !important;
                      }
                      .sales-plan-aggregation-cumulative .ag-row-level-2 [col-id="label"].ag-cell {
                        background-color: var(--grid-tree-level2-bg) !important;
                      }
                      .sales-plan-aggregation-cumulative .ag-row-highlight .ag-cell-left-pinned {
                        background-color: var(--grid-row-hover) !important;
                      }
                      .sales-plan-aggregation-cumulative .ag-pinned-left-header .ag-header-cell:first-child {
                        border-right: none !important;
                      }
                      .sales-plan-aggregation-cumulative .ag-pinned-left-header .ag-header-cell:nth-child(2) {
                        border-left: none !important;
                      }
                    `}</style>
                    {renderTablePatternSection(
                      'mx-4',
                      'パターン①',
                      p1Values,
                      p1Handlers,
                      'sales-plan-aggregation-cumulative',
                      cumulativeColumnDefs
                    )}
                    {renderTablePatternSection(
                      'mx-4 mt-6',
                      'パターン②',
                      p2Values,
                      p2Handlers,
                      'sales-plan-aggregation-cumulative',
                      cumulativeColumnDefs
                    )}
                  </TabsContent>

                  <TabsContent value="yearly">
                    <style>{`
                      .sales-plan-aggregation-yearly .ag-cell-right {
                        text-align: right;
                      }
                      .sales-plan-aggregation-yearly .ag-cell-left-pinned {
                        background-color: inherit !important;
                        font-weight: 600;
                        text-align: left;
                      }
                      /* ヘッダ背景・罫線・セル背景は共通テーマ（支払申請一覧参照と同一）に統一。
                         合計行のみ getRowStyle で薄青（GRID_COLORS.total）にする。 */
                      /* 販売計画(詳細)に合わせ行ホバーをGRID_COLORS.rowHoverに統一 */
                      .sales-plan-aggregation-yearly .ag-row-hover .ag-cell {
                        background-color: var(--grid-row-hover) !important;
                      }
                      .sales-plan-aggregation-yearly [col-id="label"].ag-cell {
                        z-index: 2;
                        overflow: visible;
                      }
                      .sales-plan-aggregation-yearly [col-id="label"] .ag-cell-wrapper {
                        height: 100%;
                        align-items: center;
                      }
                      .sales-plan-aggregation-yearly .ag-row-level-1 [col-id="label"].ag-cell {
                        background-color: var(--grid-tree-level1-bg) !important;
                      }
                      .sales-plan-aggregation-yearly .ag-row-level-2 [col-id="label"].ag-cell {
                        background-color: var(--grid-tree-level2-bg) !important;
                      }
                      .sales-plan-aggregation-yearly .ag-row-highlight .ag-cell-left-pinned {
                        background-color: var(--grid-row-hover) !important;
                      }
                      .sales-plan-aggregation-yearly .ag-pinned-left-header .ag-header-cell:first-child {
                        border-right: none !important;
                      }
                      .sales-plan-aggregation-yearly .ag-pinned-left-header .ag-header-cell:nth-child(2) {
                        border-left: none !important;
                      }
                    `}</style>
                    {renderTablePatternSection(
                      'mx-4',
                      'パターン①',
                      p1Values,
                      p1Handlers,
                      'sales-plan-aggregation-yearly',
                      yearlyColumnDefs
                    )}
                    {renderTablePatternSection(
                      'mx-4 mt-6',
                      'パターン②',
                      p2Values,
                      p2Handlers,
                      'sales-plan-aggregation-yearly',
                      yearlyColumnDefs
                    )}
                  </TabsContent>
                </>
              )}

              {/* 企画単位集計タブ（対象期間合計と切替表示） */}
              <TabsContent value="campaign">
                <div className="mx-4 mt-2 mb-4">
                  <SimulationCampaignSummaryTable
                    columnStateKey={`${expandStatePrefix}.campaign.columnState`}
                    shouldExcludeReflected={shouldExcludeCampaignReflected}
                    shouldExcludeRejected={shouldExcludeCampaignRejected}
                    onExcludeReflectedChange={setShouldExcludeCampaignReflected}
                    onExcludeRejectedChange={setShouldExcludeCampaignRejected}
                    showWholesaleMesh={showWholesaleMesh}
                    data={campaignData}
                    displayUnit={displayUnit}
                    height={campaignResize.height}
                  />
                  {/* リサイズハンドルはAG Gridの外（表の下端）に配置する */}
                  <div className="relative h-2">
                    <ResizeHandle
                      onMouseDown={campaignResize.handleMouseDown}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* 年間集計表示 */}
        {activeTab === 'annual' && (
          <div className="p-6">
            <div className="text-center text-gray-600 py-8">
              年間集計機能は準備中です
            </div>
          </div>
        )}

        {/* 拡売費集計表示 */}
        {activeTab === 'expense' && (
          <div className="p-6">
            <div className="text-center text-gray-600 py-8">
              拡売費集計機能は準備中です
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
        <div className="flex flex-col gap-3">
          {/* 集計単位①メタブランド × ②容器容量G（複数選択・掛け合わせ）─ 課題0290 */}
          <div className="flex flex-col gap-1.5">
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
