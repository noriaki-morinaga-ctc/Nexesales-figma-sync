import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '../../ui/button';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { Save, Send, Check, Undo2, CornerUpLeft } from 'lucide-react';
import { SearchPane } from './components/SearchPane';
import { AGGREGATION_PERIOD_FROM_ID } from '../../shared/SimulationPeriodPicker';
import { AggregationPane } from './components/AggregationPane';
import { SimulationDetailTable } from '../../shared/SimulationDetailTable';
import type {
  SimulationDetailTableHandle,
  ProductData,
} from '../../shared/SimulationDetailTable';
import { RightPane } from '../../ui/right-pane';
import { DeleteConfirmPane } from '../../ui/delete-confirm-pane';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Input } from '../../ui/input';
import { TEXT_INPUT_CLASS } from '../../../../styles/commonStyles';
import { Label } from '../../ui/label';
import { ApproverSelect } from '../../shared/ApproverSelect';
import { MonthYearPicker } from '../../ui/month-year-picker';
import {
  isInPeriod,
  thisYearDecember,
  thisYearJanuary,
} from '../../../utils/yearMonth';
import { Textarea } from '../../ui/textarea';
import { NumericInput } from '../../ui/numeric-input';
import {
  PLAN_DETAIL_DIGITS,
  formatPlanAmountText,
  formatPlanRateText,
} from '../../../utils/planDetailNumberFormat';
import { SingleCombobox } from '../../ui/single-combobox';
import { RequiredBadge } from '../../ui/required-badge';
// 拡売費①②の入力ブロックは販売計画表・シミュレーション共通コンポーネントを使用。
import { ExpenseBlockFields } from '../../shared/ExpenseBlockFields';
import { DetailProductSelector } from '../../shared/DetailProductSelector';
import {
  isProductInOriginalPlan,
  confirmBlockReason,
} from '../../../utils/simulationConfirmRules';
import {
  CAMPAIGN_OPTIONS,
  EMPTY_DETAIL_FORM,
  PROBABILITY_OPTIONS,
  SIMULATION_WS_CAMPAIGN_SUMMARY_ROWS,
  type DetailFormValues,
} from '../../../constants/simulationSalesPlanWholesaleMockData';
import { buildExpenseFields } from '../../../constants/expenseRelations';
import {
  getPromotionLabels,
  hasPromotionOptions,
  PROMOTION_NONE_LABEL,
  CATEGORY_OPTIONS_NET_ADDABLE,
} from '../../../constants/promotionCategories';
import { promotionComboOptions } from '../../../constants/comboFieldOptions';
import { simulationKeyItems } from '../../../constants/planDeleteItems';
import { SimulationExpenseDeleteInfo } from '../../shared/SimulationExpenseDeleteInfo';
// 販促区分の必須判定は販売計画表と共有（promotionCategoryHelpers 単一ソース）。
import { promotionValid } from '../../../constants/promotionCategoryHelpers';
import { ScreenTitle } from '../../ui/screen-title';

// ── モックデータ ────────────────────────────────────────────

// コメント履歴のモックデータ

// 施策区分・施策コードの選択肢（SingleCombobox で選択／検索）

// セクション（タブ）→ 明細追加ペインの商品区分。
// 定番商品はペインの選択肢に無い（一般卸メッシュ単位で新規追加が発生しないため）ので、
// 定番商品タブ・全てタブから開いた場合は先頭の選択肢である新商品を初期表示する。
const sectionToCategory = (section: string): string => {
  if (section.includes('特殊商品')) return '特殊商品';
  if (section === 'ギフト') return 'ギフト';
  return '新商品';
};

// 商品区分 → 詳細テーブルのセクション名（sectionToCategory の逆変換）。
// 未知の値は定番商品へ寄せる（詳細テーブル側の既定がギフトのため素通しさせない）。
const categoryToSection = (category: string): string => {
  if (category === '新商品') return '新商品';
  if (category === '特殊商品' || category === '特売') return '特殊商品';
  if (category === 'ギフト') return 'ギフト';
  return '定番商品';
};

// 企画・確度・対象月の選択肢（明細ペイン用）

// 反映済はシステムが付与する状態のため手動選択不可

// 拡売費①②の必須判定（金額/計上年月/管理区分/管理コード）。
// ①は常に必須、②は任意入力で、②に入力がある場合のみ必須とする。
// 摘要1・施策区分・施策コードは任意入力（明細1行がキーとなる）。
// 明細の追加・編集・コピー実行時のガードに使用する。
const EXP_REQUIRED_SUFFIXES = [
  'PlannedAmount',
  'PostingMonth',
  'ManagementClass',
  'ManagementCode',
] as const;
// 未入力の必須項目名を列挙してトースト文言にする。
const requiredMsg = (fields: string[]): string =>
  `${fields.join('・')}を入力してください。`;
// 非活性項目の表示補完。空（undefined/null/空文字）は Grid と同様に「-」を表示する。
const dashIfEmpty = (v: any): string =>
  v === undefined || v === null || v === '' ? '-' : String(v);
// 拡売費①②の各必須項目の表示名（サフィックス→ラベル）。
const EXP_FIELD_LABELS: Record<(typeof EXP_REQUIRED_SUFFIXES)[number], string> =
  {
    PlannedAmount: '計画金額',
    PostingMonth: '計上年月',
    ManagementClass: '管理区分',
    ManagementCode: '管理コード',
  };
// 拡売費ブロックの表示名（prefix→ラベル）。
const EXP_PREFIX_LABELS: Record<'exp1' | 'exp2', string> = {
  exp1: '拡売費①',
  exp2: '拡売費②',
};

// 拡売費①の必須項目（計画金額・計上年月・管理区分・管理コード）が全て未入力かを判定する。
// 全て未入力の間は拡売費②を非活性にし、①→②の順で入力させる。
const isExp1Empty = (f: any): boolean =>
  EXP_REQUIRED_SUFFIXES.every(
    (suffix) => String(f?.[`exp1${suffix}`] ?? '').trim() === ''
  );

// 拡売費②の必須項目（計画金額・計上年月・管理区分・管理コード）のいずれかに入力があるかを判定する。
// 管理区分名称・管理コード名称は管理区分・管理コードと同じ値を持つため判定対象に含まれる。
// 施策区分・施策コード・摘要1のみの入力は「入力あり」とみなさない。
const hasExp2Input = (f: any): boolean =>
  EXP_REQUIRED_SUFFIXES.some(
    (suffix) => String(f?.[`exp2${suffix}`] ?? '').trim() !== ''
  );

// 明細（追加・編集・コピー）の未入力必須項目名を列挙する。
// 販促区分 → 拡売費① → 拡売費②（入力ありの場合のみ）の順。
const detailMissingFields = (f: any): string[] => {
  const fields: string[] = [];
  // 主選択（定番商品＝一般卸メッシュ、それ以外＝サマリ商品名）の未入力チェック
  const isStandard = f.category === '定番商品';
  const primary = isStandard ? f.wholesaleMesh : f.summaryProduct;
  if (String(primary ?? '').trim() === '')
    fields.push(isStandard ? '一般卸メッシュ' : 'サマリ商品名');
  // 計画函数は必須。ギフトは上旬/中旬/下旬の3行1セットで追加するため3つとも必須。
  const planMissing =
    f.category === 'ギフト'
      ? ['boxEarly', 'boxMid', 'boxLate'].some(
          (key) => String(f[key] ?? '').trim() === ''
        )
      : String(f.plan ?? '').trim() === '';
  if (planMissing) fields.push('計画函数');
  // 企画・確度・企画名・対象年月の未入力チェック
  // （企画名はKEYには含まないが入力必須。KEY項目は補足5-2を参照）
  if (String(f.campaign ?? '').trim() === '') fields.push('企画');
  if (String(f.probability ?? '').trim() === '') fields.push('確度');
  if (String(f.campaignName ?? '').trim() === '') fields.push('企画名');
  if (String(f.targetMonth ?? '').trim() === '') fields.push('対象年月');
  if (!promotionValid(f)) fields.push('販促区分');
  // 拡売費①は常に必須、②は入力ありの場合のみ必須
  const expPrefixes: Array<'exp1' | 'exp2'> = hasExp2Input(f)
    ? ['exp1', 'exp2']
    : ['exp1'];
  expPrefixes.forEach((prefix) => {
    EXP_REQUIRED_SUFFIXES.forEach((suffix) => {
      if (String(f[`${prefix}${suffix}`] ?? '').trim() === '') {
        fields.push(`${EXP_PREFIX_LABELS[prefix]}${EXP_FIELD_LABELS[suffix]}`);
      }
    });
  });
  return fields;
};

export default function SalesPlanSimulationNetFixed() {
  // 戻る・保存の確認ダイアログ表示状態
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showFixedMarginPane, setShowFixedMarginPane] = useState(false);

  // 下ペインの状態管理
  // 明細テーブルの全行（追加可否・確定排他の判定に使用）
  const [allDetailRows, setAllDetailRows] = useState<ProductData[]>([]);
  const [campaignSummaryRows, setCampaignSummaryRows] = useState<ProductData[]>(
    SIMULATION_WS_CAMPAIGN_SUMMARY_ROWS
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
  const [showAddDetailPane, setShowAddDetailPane] = useState(false);
  const [showDeleteDetailPane, setShowDeleteDetailPane] = useState(false);
  const [detailSection, setDetailSection] = useState<string>('');
  const [detailData, setDetailData] = useState<any>(null);

  // 販売計画(詳細)コピー用
  const detailTableRef = useRef<SimulationDetailTableHandle>(null);

  // 明細追加・編集フォーム
  const [addForm, setAddForm] = useState<DetailFormValues>(EMPTY_DETAIL_FORM);
  const [addSubmitted, setAddSubmitted] = useState(false);

  // 販売計画(集計)の「集計対象設定」右ペイン。他の右ペインと排他表示するため親で管理する。
  // （集計単位①②・除外ペアの値は集計コンポーネント側で保持するため開閉しても失われない）
  const [showAggFilterPane, setShowAggFilterPane] = useState(false);

  // すべての右ペインを閉じるヘルパー関数
  const closeAllRightPanes = () => {
    setShowFixedMarginPane(false);
    setShowAddDetailPane(false);
    setShowDeleteDetailPane(false);
    setShowAggFilterPane(false);
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
    // 必須項目（拡売費②は入力ありの場合のみ）が未入力なら追加をブロックする
    setAddSubmitted(true);
    const missing = detailMissingFields(addForm);
    if (missing.length) {
      toast.error(requiredMsg(missing));
      return;
    }
    // 合計行の直下（先頭）に新規明細を追加する。
    // 計画函数は必須項目のため、ここに来る時点で入力済み。
    // 追加先セクションはフォームで選択中の商品区分から決める（どの＋から開いたかではない）。
    // ペインで商品区分を変更した場合も、選択どおりのセクションへ追加される。
    const section = categoryToSection(addForm.category);
    const commonFields = {
      section,
      // 商品区分は必須。未選択のフォールバックも、ペインで選べる先頭の区分に合わせる。
      productCategory: addForm.category || '新商品',
      wholesaleMesh: addForm.wholesaleMesh,
      summaryProduct: addForm.summaryProduct,
      metaBrand: addForm.metaBrand,
      containerCapacityG: addForm.containerCapacityG,
      quantity: addForm.quantity,
      endSale: addForm.endSale,
      promotion: addForm.promotion,
      net: addForm.net,
      planPrice: addForm.deliveryPrice,
      delivery: addForm.deliveryPrice,
      price: addForm.price,
      ...buildExpenseFields(addForm),
      campaign: addForm.campaign,
      probability: addForm.probability,
      campaignName: addForm.campaignName,
      targetMonth: addForm.targetMonth,
    };
    if (section === 'ギフト') {
      // ギフトは上旬/中旬/下旬の3行1セットで追加（各期間の箱数=計画）
      detailTableRef.current?.addGiftSet(
        { ...commonFields, section, productCategory: section },
        [
          addForm.boxEarly.trim() || '0',
          addForm.boxMid.trim() || '0',
          addForm.boxLate.trim() || '0',
        ]
      );
    } else {
      detailTableRef.current?.addNewRow({
        ...commonFields,
        plan: addForm.plan.trim() || '0',
      });
    }
    setAddForm({ ...EMPTY_DETAIL_FORM, category: addForm.category });
    setAddSubmitted(false);
    if (!continuous) setShowAddDetailPane(false);
    toast.success('明細を追加しました。');
  };

  // 明細追加ペインを開く
  const handleOpenAddDetail = (section: string) => {
    const isOpen = showAddDetailPane && detailSection === section;
    closeAllRightPanes();
    if (isOpen) return;
    setDetailSection(section);
    setAddForm({
      ...EMPTY_DETAIL_FORM,
      category: sectionToCategory(section),
    });
    setAddSubmitted(false);
    setShowAddDetailPane(true);
  };

  // 明細削除ペインを開く
  const handleOpenDeleteDetail = (data: any) => {
    const isOpen = showDeleteDetailPane && detailData === data;
    closeAllRightPanes();
    if (isOpen) return;
    setDetailData(data);
    setShowDeleteDetailPane(true);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-gray-100">
      {/* 左ペイン：メインコンテンツ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* スクロール可能エリア */}
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <div className="min-w-[75rem]">
            <div className="px-6 pt-3 pb-2">
              {/* 画面名はヘッダー（システム名の右）に表示する */}
              <ScreenTitle title="販売計画シミュレーション(NET固定)" />

              {/* 販売計画条件エリア */}
              <section aria-labelledby="search-heading">
                <h2 id="search-heading" className="sr-only">
                  検索条件
                </h2>
                <SearchPane />
              </section>

              {/* 販売計画(集計)エリア */}
              <section aria-labelledby="aggregation-heading" className="mb-6">
                <h2 id="aggregation-heading" className="sr-only">
                  販売計画(集計)
                </h2>
                <AggregationPane
                  campaignData={campaignSummaryRows}
                  detailRows={periodDetailRows}
                  aggFilterPaneOpen={showAggFilterPane}
                  onToggleAggFilterPane={() =>
                    togglePane(showAggFilterPane, () =>
                      setShowAggFilterPane(true)
                    )
                  }
                  onCloseAggFilterPane={() => setShowAggFilterPane(false)}
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
                <div className="bg-white rounded-lg border border-gray-200 shadow-md p-4">
                  <SimulationDetailTable
                    ref={detailTableRef}
                    onOpenFixedMargin={() =>
                      togglePane(showFixedMarginPane, () =>
                        setShowFixedMarginPane(true)
                      )
                    }
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
                onClick={() => setShowBackConfirm(true)}
              >
                <Undo2 className="h-4 w-4 mr-2" />
                計画詳細へ戻る
              </Button>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <Button
                className="bg-blue-500 hover:bg-blue-600 text-white h-9 rounded-lg"
                onClick={() => setShowSaveConfirm(true)}
              >
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
            </div>
          </div>
        </div>

        {/* 計画保存ダイアログ */}
        <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>計画保存</DialogTitle>
              <DialogDescription>販売計画を保存します。</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              販売計画を保存しますがよろしいですか？
            </div>
            <DialogFooter>
              <Button
                className="bg-blue-500 hover:bg-blue-600 text-white py-6 rounded-lg"
                onClick={() => setShowRegisterDialog(false)}
              >
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 計画承認申請ダイアログ */}
        <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>計画承認申請</DialogTitle>
              <DialogDescription>
                販売計画の承認を申請します。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  月次販売計画書No
                </Label>
                <div className="col-span-3 text-sm">SP-2025-10-001</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">対象年月</Label>
                <div className="col-span-3 text-sm">2025年10月</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  申請担当者
                </Label>
                <div className="col-span-3 text-sm">アサヒ　太郎</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  承認担当者
                </Label>
                <ApproverSelect className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">申請備考</Label>
                <Textarea
                  className="col-span-3 bg-white"
                  placeholder="備考を入力してください"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                className="bg-green-500 hover:bg-green-600 text-white py-6 rounded-lg"
                onClick={() => setShowApprovalDialog(false)}
              >
                <Send className="h-4 w-4 mr-2" />
                計画承認申請
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 計画引戻しダイアログ */}
        <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>計画引戻し</DialogTitle>
              <DialogDescription>
                申請した販売計画を引き戻します。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  月次販売計画書No
                </Label>
                <div className="col-span-3 text-sm">SP-2025-10-001</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">対象年月</Label>
                <div className="col-span-3 text-sm">2025年10月</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  申請担当者
                </Label>
                <div className="col-span-3 text-sm">アサヒ　太郎</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  承認担当者
                </Label>
                <div className="col-span-3 text-sm">アサヒ　早苗</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">申請備考</Label>
                <div className="col-span-3 text-sm">10月の販売計画</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  引戻し理由
                </Label>
                <Textarea
                  className="col-span-3 bg-white"
                  placeholder="引戻し理由を入力してください"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                className="bg-green-500 hover:bg-green-600 text-white py-6 rounded-lg"
                onClick={() => setShowWithdrawDialog(false)}
              >
                <CornerUpLeft className="h-4 w-4 mr-2" />
                計画引戻し
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 計画承認ダイアログ */}
        <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>計画承認</DialogTitle>
              <DialogDescription>販売計画を承認します。</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  月次販売計画書No
                </Label>
                <div className="col-span-3 text-sm">SP-2025-10-001</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">対象年月</Label>
                <div className="col-span-3 text-sm">2025年10月</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  申請担当者
                </Label>
                <div className="col-span-3 text-sm">アサヒ　太郎</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  承認担当者
                </Label>
                <div className="col-span-3 text-sm">アサヒ　早苗</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">申請備考</Label>
                <div className="col-span-3 text-sm">10月の販売計画</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">承認備考</Label>
                <Textarea
                  className="col-span-3 bg-white"
                  placeholder="承認備考を入力してください"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                className="bg-green-500 hover:bg-green-600 text-white py-6 rounded-lg"
                onClick={() => setShowApproveDialog(false)}
              >
                <Check className="h-4 w-4 mr-2" />
                承認
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 計画差戻しダイアログ */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>計画差戻し</DialogTitle>
              <DialogDescription>販売計画を差し戻します。</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  月次販売計画書No
                </Label>
                <div className="col-span-3 text-sm">SP-2025-10-001</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">対象年月</Label>
                <div className="col-span-3 text-sm">2025年10月</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  申請担当者
                </Label>
                <div className="col-span-3 text-sm">アサヒ　太郎</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  承認担当者
                </Label>
                <div className="col-span-3 text-sm">アサヒ　早苗</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">申請備考</Label>
                <div className="col-span-3 text-sm">10月の販売計画</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  差戻し理由
                </Label>
                <Textarea
                  className="col-span-3 bg-white"
                  placeholder="差戻し理由を入力してください"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                className="bg-red-500 hover:bg-red-600 text-white py-6 rounded-lg"
                onClick={() => setShowRejectDialog(false)}
              >
                <CornerUpLeft className="h-4 w-4 mr-2" />
                差戻し
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 企画単位集計は集計表（AggregationPane）側へ移設 */}
      </div>

      {/* 右ペイン：明細追加 */}
      <RightPane
        open={showAddDetailPane}
        onClose={() => setShowAddDetailPane(false)}
        title="明細追加"
        description="明細を追加します"
        footer={(() => {
          // 元の販売計画表に既に存在する商品は追加不可（非活性＋理由表示）
          const addBlocked = isProductInOriginalPlan(
            allDetailRows,
            addForm.summaryProduct
          );
          return (
            <div className="flex flex-col items-stretch gap-1">
              {addBlocked && (
                <p className="text-xs text-red-600">
                  選択した商品は元の販売計画表に既に存在するため追加できません
                </p>
              )}
              <div className="flex items-center justify-end gap-[0.75rem]">
                <Button
                  type="button"
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={addBlocked}
                  onClick={() => handleAddDetailSubmit(true)}
                >
                  連続追加
                </Button>
                <Button
                  type="button"
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={addBlocked}
                  onClick={() => handleAddDetailSubmit(false)}
                >
                  追加
                </Button>
              </div>
            </div>
          );
        })()}
      >
        <div className="flex flex-col h-full">
          {/* 検索エリア */}
          <div className="bg-white p-4 border-b border-gray-300">
            <div className="space-y-3">
              {/* 対象年月。シミュレーションは対象期間が複数月にわたり、新商品に該当するかが
                  対象年月によって変わるため、商品選択より先に入力させる
                  （対象年月 → 商品区分 → サマリ商品名 → メタブランド → 容器容量G → 新商品のみ表示）。 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  対象年月 <RequiredBadge />
                </Label>
                <div
                  className={
                    addSubmitted && !String(addForm.targetMonth ?? '').trim()
                      ? 'rounded-md ring-1 ring-red-500'
                      : ''
                  }
                >
                  {/* シミュレーション（詳細）の対象期間内のみ選択可能にする。
                      期間外の月を選べると、追加した明細が表示中の明細に表示されないため */}
                  <MonthYearPicker
                    className="w-full"
                    value={addForm.targetMonth || ''}
                    onChange={(v) =>
                      setAddForm((p) => ({ ...p, targetMonth: v }))
                    }
                    min={detailFromPeriod}
                    max={detailToPeriod}
                    required={false}
                    clearable
                  />
                </div>
              </div>
              {/* 商品選択（販売計画(卸)と同等：サマリ商品名/メタブランド/容器容量G/新商品のみ表示） */}
              <DetailProductSelector
                showCategorySelect={true}
                category={addForm.category}
                onCategoryChange={(v) =>
                  setAddForm({ ...EMPTY_DETAIL_FORM, category: v })
                }
                categoryOptions={CATEGORY_OPTIONS_NET_ADDABLE}
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
                    // 定番商品は一般卸メッシュ選択で終売区分を自動反映（NET固定・卸固有）
                    endSale: m.endSale ?? '',
                  }))
                }
                onChangeMetaBrand={(v) =>
                  setAddForm((prev) => ({ ...prev, metaBrand: v }))
                }
                onChangeContainerCapacity={(v) =>
                  setAddForm((prev) => ({ ...prev, containerCapacityG: v }))
                }
                onClearPrimary={() =>
                  setAddForm((prev) => ({
                    ...prev,
                    summaryProduct: '',
                    wholesaleMesh: '',
                    metaBrand: '',
                    containerCapacityG: '',
                  }))
                }
                submitted={addSubmitted}
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
                    addSubmitted && !String(addForm.campaign ?? '').trim()
                      ? 'rounded-md ring-1 ring-red-500'
                      : ''
                  }
                >
                  <SingleCombobox
                    options={CAMPAIGN_OPTIONS.map((c) => ({
                      value: c,
                      label: c,
                    }))}
                    value={addForm.campaign}
                    onChange={(v) => setAddForm((p) => ({ ...p, campaign: v }))}
                    placeholder="企画を選択"
                    clearable
                  />
                </div>
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
                          addSubmitted &&
                          !String(addForm.probability ?? '').trim()
                            ? 'rounded-md ring-1 ring-red-500'
                            : ''
                        }
                      >
                        <SingleCombobox
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

              {/* 企画名：企画に付随する名称。KEYには含まないが入力必須 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  企画名 <RequiredBadge />
                </Label>
                <Input
                  value={addForm.campaignName}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, campaignName: e.target.value }))
                  }
                  placeholder="企画名を入力"
                  className={`${TEXT_INPUT_CLASS} w-full ${addSubmitted && !String(addForm.campaignName ?? '').trim() ? 'ring-1 ring-red-500' : ''}`}
                />
              </div>

              {/* 定番商品はサマリ商品名不要（主選択の一般卸メッシュのみ）。
                  定番商品以外（新商品／特殊商品／ギフト）の一般卸メッシュはサマリ商品名から決まるため、
                  入力させずにサマリ商品名の選択時に自動表示する（計画詳細(NET固定)と同じ表示専用の項目）。 */}
              {addForm.category !== '定番商品' && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">
                    一般卸メッシュ
                  </Label>
                  <Input
                    value={dashIfEmpty(addForm.wholesaleMesh)}
                    readOnly
                    title="サマリ商品名を選択すると自動で表示されます"
                    className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
                  />
                </div>
              )}

              {/* 販促区分（任意） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  販促区分 <RequiredBadge />
                </Label>
                {addForm.category === 'ギフト' ||
                addForm.category === '特殊商品' ? (
                  // 特殊商品・ギフトは販促区分が区分名で固定のため非活性表示
                  <Input
                    value={addForm.category}
                    readOnly
                    className={`${TEXT_INPUT_CLASS} w-full bg-gray-100 text-gray-600 cursor-default`}
                  />
                ) : hasPromotionOptions(addForm.category) ? (
                  <div
                    className={
                      addSubmitted && !addForm.promotion.trim()
                        ? 'rounded-md ring-1 ring-red-500'
                        : ''
                    }
                  >
                    <SingleCombobox
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
                            addSubmitted && !String(addForm[key] ?? '').trim()
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
                      addSubmitted && !String(addForm.plan ?? '').trim()
                        ? 'w-full bg-white border-gray-400 shadow-sm ring-1 ring-red-500 focus:ring-2 focus:ring-blue-500'
                        : 'w-full bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500'
                    }
                  />
                </div>
              )}

              {/* NET */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">NET</Label>
                <NumericInput
                  value={addForm.net}
                  maxFractionDigits={PLAN_DETAIL_DIGITS.price}
                  onChange={(e) =>
                    setAddForm((p) => ({
                      ...p,
                      net: e.target.value,
                    }))
                  }
                  placeholder="NET（任意）"
                  className="w-full bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500"
                />
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

              {/* マージン率（商品区分によらず非活性） */}
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

              {/* 拡売費①（全幅ブロック） */}
              <div className="space-y-3 border-t border-gray-300 pt-3 @md:col-span-2 @2xl:col-span-3">
                <div className="text-sm font-bold text-gray-700">拡売費①</div>
                <ExpenseBlockFields
                  prefix="exp1"
                  form={addForm}
                  setForm={setAddForm}
                  submitted={addSubmitted}
                  required={true}
                  campaignRequired={false}
                />
              </div>

              {/* 拡売費②（全幅ブロック） */}
              <div className="space-y-3 border-t border-gray-300 pt-3 @md:col-span-2 @2xl:col-span-3">
                <div className="text-sm font-bold text-gray-700">拡売費②</div>
                <ExpenseBlockFields
                  prefix="exp2"
                  form={addForm}
                  setForm={setAddForm}
                  submitted={addSubmitted}
                  required={true}
                  shouldValidateRequired={hasExp2Input(addForm)}
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
        open={showDeleteDetailPane}
        onClose={() => setShowDeleteDetailPane(false)}
        title="明細削除の確認"
        description="明細を削除します"
        // 削除対象は業務KEY項目（補足5-2）で示し、拡売費①②の内訳を children で続ける
        items={simulationKeyItems('netFixed', detailData)}
        onDelete={() => {
          // 対象明細をグリッドから削除
          if (detailData?.id != null) {
            detailTableRef.current?.deleteRow(detailData.id);
          }
          setShowDeleteDetailPane(false);
          toast.success('明細を削除しました。');
        }}
      >
        <SimulationExpenseDeleteInfo data={detailData} />
      </DeleteConfirmPane>

      {/* 戻る（画面移動）の確認 */}
      <ConfirmDialog
        open={showBackConfirm}
        title="画面移動の確認"
        confirmLabel="移動"
        description="入力中のデータが破棄されます。本当によろしいですか？"
        onConfirm={() => setShowBackConfirm(false)}
        onCancel={() => setShowBackConfirm(false)}
      />

      {/* 保存の確認 */}
      <ConfirmDialog
        open={showSaveConfirm}
        title="保存の確認"
        confirmLabel="保存"
        description="シミュレーションを保存します。対象となるすべての販売計画表のデータを更新します。本当によろしいですか？"
        onConfirm={() => {
          setShowSaveConfirm(false);
          // 保存後は帯の色と編集セルの黄色強調を消す（計画詳細と同じ）
          detailTableRef.current?.clearSavedMarks();
          toast.success('シミュレーションを保存しました。');
        }}
        onCancel={() => setShowSaveConfirm(false)}
      />
    </div>
  );
}
