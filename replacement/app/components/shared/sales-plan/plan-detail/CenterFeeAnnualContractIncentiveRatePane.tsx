import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { RightPane } from '@/app/components/ui/right-pane';
import { Button } from '@/app/components/ui/button';
import { NumericInput } from '@/app/components/ui/numeric-input';
import { Label } from '@/app/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog';
import {
  SingleCombobox,
  type SingleComboboxOption,
} from '@/app/components/ui/single-combobox';
import { MonthYearPicker } from '@/app/components/ui/month-year-picker';
import { RequiredBadge } from '@/app/components/ui/required-badge';
import {
  campaignClassComboOptions,
  campaignCodeComboOptions,
} from '@/app/constants/comboFieldOptions';
import { EXPENSE_CAMPAIGN_CODE_OPTIONS } from '@/app/constants/expenseRelations';
import {
  fillFromCampaignClass,
  fillFromCampaignCode,
  isCampaignCodeInClass,
} from '@/app/utils/common/expenseRelations';
import type { MarginRate } from '@/app/types/planDetail';

// 年契基本分・センターフィ率・取組強化マージン率で共通利用する率入力ペイン。
// 算出方法（納品金額／社外売上高／直接入力）・反映方法（商流別／メタブランド別）を
// 選び、一括入力／各行入力で率を設定する。複数画面で共通利用する。

type Tier1Mode = 'delivery' | 'externalSales' | 'manual';
type Tier2Mode = 'distribution' | 'brand';

// メタブランド別反映時の一覧
// PB は「PB商品：除く」を選択した場合に表示一覧から除外する（メタブランド名で判別する）
const BRAND_LIST = [
  'ワンダ',
  '三ツ矢',
  'ウィルキンソン',
  '十六茶',
  '水',
  'カルピス',
  'おいしい水',
  'バヤリース',
  '若武者',
  'アサヒ飲料',
  '三ツ矢サイダー',
  'カルピスウォーター',
  'ウィルキンソンタンサン',
  'PB',
];

// PB商品の判別に用いるメタブランド名
const PB_BRAND_NAME = 'PB';

// 各行のデフォルト値
const DISTRIBUTION_DEFAULT = '7.60';
const BRAND_DEFAULT = '8.70';

// 経費の反映先（10/8 ASD資料「計画上の経費反映先について＋計上月の検討」）。
// 管理区分・管理コードはマスタ未提供のため、資料記載の値のみを「コード:名称」で持つ（仮）。
const toPaneOption = (opt: string): SingleComboboxOption => ({
  value: opt,
  label: opt,
});

// 管理区分・管理コードの候補（全ペイン共通。会計管理区分マスタ・会計管理コードマスタから取得する想定）。
// 担当者が選択し、対象月以降の将来月にも反映する（決定事項 No.578・579）。
const MANAGEMENT_CLASS_PANE_OPTIONS = [
  '1C5:年契・短契（売上連動）',
  'UEP:センターフィ',
].map(toPaneOption);
// 本社広域企業は 10010:本社 を選ぶ
const MANAGEMENT_CODE_PANE_OPTIONS = [
  '10015:支社A卸部門',
  '10010:本社',
  '99999:センターフィ',
].map(toPaneOption);

// 管理区分・管理コードの初期値（マスタ管理者が業務用の固定値マスタに設定する想定。決定事項 No.824）。
// 取組強化マージンのコードは未決定のため、資料の拡売費計画イメージに合わせて年契基本分と同じ値にする。
const DEFAULT_MANAGEMENT = {
  managementClass: '1C5:年契・短契（売上連動）',
  managementCode: '10015:支社A卸部門',
};
const CENTER_FEE_DEFAULT_MANAGEMENT = {
  managementClass: 'UEP:センターフィ',
  managementCode: '99999:センターフィ',
};

// 施策区分・施策コードは拡売費計画と同じ選択肢（名称＋コードの2行表示）を使う
const CAMPAIGN_CLASS_PANE_OPTIONS = campaignClassComboOptions();

// ペインの入力値。「更新」で確定した値を控えておき、開き直したときに復元する。
interface RateFormValues {
  tier1Mode: Tier1Mode;
  tier2Mode: Tier2Mode;
  value: string;
  indexValue: string;
  excludePB: boolean;
  excludeWater2L: boolean;
  bulkValue: string;
  rowValues: { [key: string]: string };
  managementClass: string;
  managementCode: string;
  campaignClass: string;
  campaignCode: string;
  postingMonth: string;
}

// 初期値：算出方法は「納品金額」、反映方法は「商流別」、PB商品・水2Lは「除く」
// （PB商品はセンターフィのみ「含む」。生成時に差し込む）
// 管理区分・管理コード（ペインごとに異なる）と計上月の初期値（対象年月の翌月）は、生成時に差し込む。
const INITIAL_FORM_VALUES: RateFormValues = {
  tier1Mode: 'delivery',
  tier2Mode: 'distribution',
  value: '',
  indexValue: '100',
  excludePB: true,
  excludeWater2L: true,
  bulkValue: '',
  rowValues: {},
  managementClass: '',
  managementCode: '',
  campaignClass: '',
  campaignCode: '',
  postingMonth: '',
};

// 更新時に親へ渡す入力値
export interface RateInputResult {
  tier1Mode: Tier1Mode;
  tier2Mode: Tier2Mode;
  value: string;
  indexValue: string;
  bulkValue: string;
  rowValues: { [key: string]: string };
  /** 水2Lを除く（年契基本分のみ。未表示の画面では常に false） */
  excludeWater2L: boolean;
  /** 管理区分（「コード:名称」） */
  managementClass: string;
  /** 管理コード（「コード:名称」） */
  managementCode: string;
  /** 計上月（YYYY/MM） */
  postingMonth: string;
  /** 施策区分・施策コード（showCampaign=false の画面では undefined） */
  campaign?: {
    campaignClass: string;
    campaignCode: string;
  };
  /**
   * ボタン横に表示する値。**単位を含んだ表示用文字列**。
   * 率（納品金額／社外売上高）は `8.70%`、直接入力（金額）は `123,000円` の形式。
   * 直接入力は金額のため「%」を付けてはいけない。
   */
  averageDisplay: string;
}

interface CenterFeeAnnualContractIncentiveRatePaneProps {
  /** 表示状態 */
  open: boolean;
  /** 閉じるハンドラ */
  onClose: () => void;
  /** ペインのタイトル */
  title: string;
  /** ペインの説明 */
  description: string;
  /** ラジオボタン等のid接頭辞（画面内で一意にする） */
  idPrefix: string;
  /** 商流別リストの元となる固定マージン率データ */
  marginRates: MarginRate[];
  /** 更新時のコールバック（入力値を受け取る） */
  onSubmit?: (result: RateInputResult) => void;
  /** 更新ボタンのラベル */
  submitLabel?: string;
  /** PB商品ラジオボタンを活性にするか（センターフィ率のみtrue） */
  enablePB?: boolean;
  /**
   * 反映方法の「メタブランド別」を活性にするか（年契基本分・センターフィ率でtrue）。
   * 取組強化マージン率にはメタブランド別が存在しないため、
   * PB商品と同様に表示は残したうえで非活性にする。
   */
  enableBrandMode?: boolean;
  /**
   * 「水2L」の除く／含むラジオボタンを表示するか（年契基本分のみtrue）。
   * センターフィ率・取組強化マージン率には水2Lの区分が無いため、
   * 非活性ではなく行ごと非表示にして既存レイアウトを変えない。
   */
  showWater2L?: boolean;
  /**
   * 社外売上高（%）選択時の「係数」入力を活性にするか（年契基本分・センターフィ率でtrue）。
   * 取組強化マージン率には社外売単価の係数が無いため、
   * PB商品と同様に表示は残したうえで非活性にする。
   */
  enableIndex?: boolean;
  /**
   * 管理区分・管理コードの初期値をセンターフィの値にするか（センターフィ率でtrue）。
   * いずれのペインも担当者が上書きして選択できる。
   */
  centerFeeManagement?: boolean;
  /**
   * 施策区分・施策コード（必須）を表示するか（年契基本分・取組強化マージンでtrue）。
   * 拡売費計画上の年契基本分・取組強化マージンを施策で識別するため必須とする。
   * センターフィ率は施策を持たないため表示しない（2026-10-29 ASD回答）。
   */
  showCampaign?: boolean;
  /** 計上月の初期値（YYYY/MM。対象年月の翌月を渡す） */
  defaultPostingMonth?: string;
  /**
   * 親で確定している計上月（YYYY/MM）。拡売費計画グリッドの年契基本分・取組強化マージンの行で
   * 計上月を変更したとき、その値をペインの計上月にも反映する。
   */
  postingMonth?: string;
  /** 折り畳み（付箋）状態。親が保持する場合に指定する */
  collapsed?: boolean;
  /** 折り畳み状態の変更通知 */
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function CenterFeeAnnualContractIncentiveRatePane({
  open,
  onClose,
  title,
  description,
  idPrefix,
  marginRates,
  onSubmit,
  submitLabel = '更新',
  enablePB = false,
  enableBrandMode = false,
  showWater2L = false,
  enableIndex = true,
  centerFeeManagement = false,
  showCampaign = false,
  defaultPostingMonth = '',
  postingMonth: committedPostingMonth,
  collapsed,
  onCollapsedChange,
}: CenterFeeAnnualContractIncentiveRatePaneProps) {
  // 初期は「納品金額」を選択状態にする
  const [tier1Mode, setTier1Mode] = useState<Tier1Mode>('delivery');
  // 反映方法は年契基本分・センターフィ率・取組強化マージン率とも「商流別」を初期選択にする。
  // メタブランド別を選べるのは年契基本分・センターフィ率（enableBrandMode）だが、既定は商流別で揃える。
  const [tier2Mode, setTier2Mode] = useState<Tier2Mode>('distribution');
  const [value, setValue] = useState('');
  const [indexValue, setIndexValue] = useState('100');
  // PB商品。既定はセンターフィ（enablePB）では「含む」、それ以外（非活性）は「除く」。
  const [excludePB, setExcludePB] = useState(!enablePB);
  // 水2L（年契基本分のみ表示）。既定は「除く」。
  const [shouldExcludeWater2L, setShouldExcludeWater2L] = useState(true);
  const [bulkValue, setBulkValue] = useState('');
  const [rowValues, setRowValues] = useState<{ [key: string]: string }>({});
  // 管理区分・管理コード（全ペイン）。初期値はペインごとの値を表示し、担当者が上書きして選択できる
  const defaultManagement = centerFeeManagement
    ? CENTER_FEE_DEFAULT_MANAGEMENT
    : DEFAULT_MANAGEMENT;
  const [managementClass, setManagementClass] = useState(
    defaultManagement.managementClass
  );
  const [managementCode, setManagementCode] = useState(
    defaultManagement.managementCode
  );
  // 施策（showCampaign の画面のみ表示）。値が未決定のため初期値は空欄
  const [campaignClass, setCampaignClass] = useState('');
  const [campaignCode, setCampaignCode] = useState('');
  // 計上月（全ペイン）。初期値は対象年月の翌月
  const [postingMonth, setPostingMonth] = useState(defaultPostingMonth);
  // 更新確認ダイアログの表示状態
  const [isUpdateConfirmShown, setIsUpdateConfirmShown] = useState(false);
  // 更新ボタンを押したか。施策の未選択エラーは、開いた直後ではなく更新を押した後に表示する
  const [isSubmitAttempted, setIsSubmitAttempted] = useState(false);

  // 「更新」で確定した入力値。更新せずに×などで閉じた入力は保存していないため、
  // 開き直したときに確定済みの値へ戻す（折り畳みは閉じないため入力を保持する）。
  const committedRef = useRef<RateFormValues>({
    ...INITIAL_FORM_VALUES,
    excludePB: !enablePB,
    ...defaultManagement,
    postingMonth: defaultPostingMonth,
  });
  useLayoutEffect(() => {
    if (!open) return;
    const c = committedRef.current;
    setTier1Mode(c.tier1Mode);
    setTier2Mode(c.tier2Mode);
    setValue(c.value);
    setIndexValue(c.indexValue);
    setExcludePB(c.excludePB);
    setShouldExcludeWater2L(c.excludeWater2L);
    setBulkValue(c.bulkValue);
    setRowValues(c.rowValues);
    setManagementClass(c.managementClass);
    setManagementCode(c.managementCode);
    setCampaignClass(c.campaignClass);
    setCampaignCode(c.campaignCode);
    // 未確定のまま対象年月が変わった場合も、初期値（対象年月の翌月）に追従させる
    setPostingMonth(c.postingMonth || defaultPostingMonth);
    setIsUpdateConfirmShown(false);
    setIsSubmitAttempted(false);
  }, [open, defaultPostingMonth]);

  // グリッドで計上月が変わったら、確定値とペインの計上月をその値にそろえる。
  // 他の入力中の値は消さないよう、計上月だけを差し替える。
  useEffect(() => {
    if (!committedPostingMonth) return;
    committedRef.current = {
      ...committedRef.current,
      postingMonth: committedPostingMonth,
    };
    setPostingMonth(committedPostingMonth);
  }, [committedPostingMonth]);

  // 施策区分を選択済みなら、その区分に属する施策コードだけを候補にする
  const campaignCodeOptions = campaignCodeComboOptions(
    campaignClass
      ? EXPENSE_CAMPAIGN_CODE_OPTIONS.map((o) => o.value).filter((code) =>
          isCampaignCodeInClass(code, campaignClass)
        )
      : undefined
  );

  // 施策区分確定時：該当しない施策コードはクリアする
  const handleCampaignClassChange = (cls: string) => {
    const patch = fillFromCampaignClass(cls, campaignCode);
    setCampaignClass(patch.CampaignClass ?? '');
    setCampaignCode(patch.CampaignCode ?? '');
  };

  // 施策コード確定時：施策区分を自動で入れる
  const handleCampaignCodeChange = (code: string) => {
    const patch = fillFromCampaignCode(code);
    setCampaignCode(patch.CampaignCode ?? '');
    if (patch.CampaignClass !== undefined) {
      setCampaignClass(patch.CampaignClass);
    }
  };

  // 率は小数点以下2桁まで許可
  const isWithinTwoDecimals = (v: string): boolean =>
    /^\d*(\.\d{0,2})?$/.test(v);
  // 金額は整数のみ許可
  const isInteger = (v: string): boolean => /^\d*$/.test(v);

  // 行リスト（商流別＝一次店/三次店、メタブランド別＝ブランド一覧）
  // メタブランド別のとき、PB商品「除く」を選択していればメタブランド名「PB」を一覧から除外する
  const rows =
    tier2Mode === 'distribution'
      ? marginRates.map((item) => ({
          key: `${item.tier1}/${item.tier3}`,
          // 一次店を1行目、三次店を2行目とし「/」の後で改行する（10/23 第3回 手売りセッション 決定事項11）
          label: `${item.tier1} /\n${item.tier3}`,
        }))
      : BRAND_LIST.filter(
          (brand) => !(excludePB && brand === PB_BRAND_NAME)
        ).map((brand) => ({ key: brand, label: brand }));

  const rowDefault =
    tier2Mode === 'distribution' ? DISTRIBUTION_DEFAULT : BRAND_DEFAULT;

  // 各行の表示値。未入力の行はデフォルト値で補完し、入力を消した行（空文字）は空欄のまま保持する
  // （固定マージン率設定ペインと同一挙動）。
  const getRowValue = (key: string): string => rowValues[key] ?? rowDefault;

  // 行ごとのエラーメッセージ（未入力）。エラーが無ければ null。
  const getRowError = (value: string): string | null =>
    value === '' ? '入力してください' : null;

  // 施策区分・施策コードの未選択エラー（showCampaign の画面のみ。更新を押した後に表示する）
  const getCampaignError = (v: string): string | null =>
    showCampaign && v === '' ? '選択してください' : null;
  const campaignClassError = isSubmitAttempted
    ? getCampaignError(campaignClass)
    : null;
  const campaignCodeError = isSubmitAttempted
    ? getCampaignError(campaignCode)
    : null;

  // 率入力フォームの表示中（直接入力以外）のみ、表示している行の未入力をエラーとする。
  // 施策区分・施策コードは算出方法によらず必須とする。
  const hasError =
    (tier1Mode !== 'manual' &&
      rows.some((row) => getRowError(getRowValue(row.key)) !== null)) ||
    getCampaignError(campaignClass) !== null ||
    getCampaignError(campaignCode) !== null;

  // 率の列見出し（算出方法に応じて切替）
  const valueColumnLabel =
    tier1Mode === 'delivery' ? '納品金額（%）' : '社外売上高（%）';

  // 行リストの見出し（反映方法に応じて切替）
  const listHeaderLabel =
    tier2Mode === 'distribution' ? '一次店/三次店' : 'メタブランド';

  // 一括入力値を全行へ反映
  const handleApplyToAll = () => {
    if (!bulkValue) return;
    const newValues: { [key: string]: string } = {};
    rows.forEach((row) => {
      newValues[row.key] = bulkValue;
    });
    setRowValues(newValues);
  };

  // ボタン横に表示する値を、単位付きの文字列で組み立てる。
  // 直接入力は「金額」のため円表記とし、「%」を付けない（率と金額で単位が異なる）。
  const computeAverageDisplay = (): string => {
    if (tier1Mode === 'manual') {
      const n = parseInt(value, 10);
      return Number.isFinite(n) ? `${n.toLocaleString('ja-JP')}円` : '0円';
    }
    const vals = rows.map((r) => {
      const n = parseFloat(getRowValue(r.key));
      return Number.isFinite(n) ? n : 0;
    });
    if (vals.length === 0) return '0.00%';
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    return `${avg.toFixed(2)}%`;
  };

  // 確認ダイアログでOK後に実際の更新を行う
  const handleSubmit = () => {
    committedRef.current = {
      tier1Mode,
      tier2Mode,
      value,
      indexValue,
      excludePB,
      excludeWater2L: shouldExcludeWater2L,
      bulkValue,
      rowValues,
      managementClass,
      managementCode,
      campaignClass,
      campaignCode,
      postingMonth,
    };
    onSubmit?.({
      tier1Mode,
      tier2Mode,
      value,
      indexValue,
      bulkValue,
      rowValues,
      excludeWater2L: shouldExcludeWater2L,
      averageDisplay: computeAverageDisplay(),
      managementClass,
      managementCode,
      postingMonth,
      campaign: showCampaign ? { campaignClass, campaignCode } : undefined,
    });
    toast.success(
      `${title}を販売計画表に反映しました。保存ボタンでデータが保存されます。`
    );
    onClose();
  };

  // 更新ボタン押下：入力エラーがある場合は確認ダイアログを出さずに中断する
  const handleClickUpdate = () => {
    setIsSubmitAttempted(true);
    if (hasError) {
      toast.error('入力内容に誤りがあります。エラー箇所をご確認ください。');
      return;
    }
    setIsUpdateConfirmShown(true);
  };

  return (
    <>
      <RightPane
        open={open}
        onClose={onClose}
        title={title}
        description={description}
        collapsed={collapsed}
        onCollapsedChange={onCollapsedChange}
      >
        <div className="space-y-4">
          {/* 1段目：算出方法（縦並び） */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              算出方法
            </Label>
            <RadioGroup
              value={tier1Mode}
              onValueChange={(v) => setTier1Mode(v as Tier1Mode)}
            >
              <div className="flex items-center space-x-2 ml-4">
                <RadioGroupItem
                  value="delivery"
                  id={`${idPrefix}-tier1-delivery`}
                />
                <Label htmlFor={`${idPrefix}-tier1-delivery`}>
                  納品金額（%）
                </Label>
                <span className="text-red-500">
                  ※納価未入力の行は計算されません
                </span>
              </div>
              <div className="flex items-center space-x-2 ml-4">
                <RadioGroupItem
                  value="externalSales"
                  id={`${idPrefix}-tier1-external`}
                />
                <Label htmlFor={`${idPrefix}-tier1-external`}>
                  社外売上高（%）
                </Label>
              </div>
              <div className="flex items-center space-x-2 ml-4">
                <RadioGroupItem
                  value="manual"
                  id={`${idPrefix}-tier1-manual`}
                />
                <Label htmlFor={`${idPrefix}-tier1-manual`}>
                  直接入力（金額）
                </Label>
              </div>
            </RadioGroup>

            {/* 係数入力欄（社外売上高を選択したときのみ表示）。
                RadioGroup 内に入れ子にするとロービングtabindexでTab遷移順が崩れるため、
                RadioGroup の外に配置して表示順どおりにフォーカスが移るようにする。 */}
            {tier1Mode === 'externalSales' && (
              <div className="ml-8 space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`${idPrefix}-index`}
                    className={enableIndex ? undefined : 'text-gray-500'}
                  >
                    係数
                  </Label>
                  <NumericInput
                    // 係数は整数のみ入力可（小数は受け付けない）
                    id={`${idPrefix}-index`}
                    step="1"
                    value={indexValue}
                    disabled={!enableIndex}
                    onChange={(e) => {
                      if (isInteger(e.target.value)) {
                        setIndexValue(e.target.value);
                      }
                    }}
                    placeholder="100"
                    className={
                      enableIndex
                        ? 'w-24 text-right bg-white no-spinner border border-gray-300'
                        : 'w-24 text-right bg-gray-100 text-gray-500 no-spinner border border-gray-300 cursor-not-allowed'
                    }
                  />
                  <span
                    className={enableIndex ? 'text-gray-700' : 'text-gray-500'}
                  >
                    %
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  ※社外売上高に掛ける係数を入力します。100％の場合、社外売上高をそのまま使用します。
                </p>
              </div>
            )}
          </div>

          {/* 2段目：反映方法・PB商品（手入力時は非表示） */}
          {tier1Mode !== 'manual' && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  反映方法
                </Label>
                <RadioGroup
                  value={tier2Mode}
                  onValueChange={(v) => setTier2Mode(v as Tier2Mode)}
                >
                  <div className="flex items-center space-x-6 ml-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="distribution"
                        id={`${idPrefix}-tier2-distribution`}
                      />
                      <Label htmlFor={`${idPrefix}-tier2-distribution`}>
                        商流別
                      </Label>
                    </div>
                    {/* メタブランド別（年契基本分・センターフィ率で活性。取組強化マージン率は
                        メタブランド別が存在しないため表示は残して非活性にする） */}
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="brand"
                        id={`${idPrefix}-tier2-brand`}
                        disabled={!enableBrandMode}
                      />
                      <Label
                        htmlFor={`${idPrefix}-tier2-brand`}
                        className={
                          enableBrandMode
                            ? 'text-sm text-gray-700'
                            : 'text-sm text-gray-500 cursor-not-allowed'
                        }
                      >
                        メタブランド別
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>
              {/* PB商品（センターフィ率のみ活性。年契基本分・取組強化マージンは非活性） */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  PB商品
                </Label>
                <RadioGroup
                  value={excludePB ? 'exclude' : 'include'}
                  onValueChange={(v) => setExcludePB(v === 'exclude')}
                  disabled={!enablePB}
                >
                  <div className="flex items-center space-x-6 ml-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="exclude"
                        id={`${idPrefix}-pb-exclude`}
                        disabled={!enablePB}
                      />
                      <Label
                        htmlFor={`${idPrefix}-pb-exclude`}
                        className={
                          enablePB
                            ? 'text-sm text-gray-700'
                            : 'text-sm text-gray-500 cursor-not-allowed'
                        }
                      >
                        除く
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="include"
                        id={`${idPrefix}-pb-include`}
                        disabled={!enablePB}
                      />
                      <Label
                        htmlFor={`${idPrefix}-pb-include`}
                        className={
                          enablePB
                            ? 'text-sm text-gray-700'
                            : 'text-sm text-gray-500 cursor-not-allowed'
                        }
                      >
                        含む
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>
              {/* 水2L（年契基本分のみ。センターフィ率・取組強化マージン率には
                  水2Lの区分が無いため showWater2L=false で行ごと表示しない） */}
              {showWater2L && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    水2L
                  </Label>
                  <RadioGroup
                    value={shouldExcludeWater2L ? 'exclude' : 'include'}
                    onValueChange={(v) =>
                      setShouldExcludeWater2L(v === 'exclude')
                    }
                  >
                    <div className="flex items-center space-x-6 ml-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="exclude"
                          id={`${idPrefix}-water2l-exclude`}
                        />
                        <Label
                          htmlFor={`${idPrefix}-water2l-exclude`}
                          className="text-sm text-gray-700"
                        >
                          除く
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="include"
                          id={`${idPrefix}-water2l-include`}
                        />
                        <Label
                          htmlFor={`${idPrefix}-water2l-include`}
                          className="text-sm text-gray-700"
                        >
                          含む
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </>
          )}

          {/* 直接入力（金額）フォーム */}
          {tier1Mode === 'manual' && (
            <div className="space-y-4 p-4 bg-white rounded-lg border border-gray-300">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  直接入力（金額）
                </Label>
                <div className="flex items-center gap-2">
                  <NumericInput
                    step="1"
                    value={value}
                    onChange={(e) => {
                      if (isInteger(e.target.value)) {
                        setValue(e.target.value);
                      }
                    }}
                    placeholder="123,000"
                    className="flex-1 text-right bg-white no-spinner border border-gray-300"
                  />
                  <span className="text-gray-700">円</span>
                </div>
              </div>
            </div>
          )}

          {/* 率入力フォーム（商流別／メタブランド別 共通） */}
          {tier1Mode !== 'manual' && (
            <div className="space-y-4 p-4 bg-white rounded-lg border border-gray-300">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  一括入力
                </Label>
                <div className="flex items-center gap-2 mb-2">
                  <NumericInput
                    step="0.01"
                    placeholder="10"
                    value={bulkValue}
                    onChange={(e) => {
                      if (isWithinTwoDecimals(e.target.value)) {
                        setBulkValue(e.target.value);
                      }
                    }}
                    className="w-24 text-right bg-white no-spinner border border-gray-300"
                  />
                  <span className="text-gray-700">%</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs ml-2"
                    onClick={handleApplyToAll}
                  >
                    ↓全行に入力
                  </Button>
                </div>
                <div className="text-xs text-blue-700 px-2 py-1 rounded">
                  ※ 各行へ数値をコピーします。個別に修正可能です。
                </div>
              </div>

              <div className="text-sm text-center text-gray-600 py-2">
                ↓ 各行の入力欄へ反映（編集可能）
              </div>

              <div className="space-y-3 border-t border-gray-300 pt-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                  <span className="text-sm font-bold text-gray-700">
                    {listHeaderLabel}
                  </span>
                  <span className="text-sm font-bold text-gray-700">
                    {valueColumnLabel}
                  </span>
                </div>
                {rows.map((row, idx) => {
                  const rowValue = getRowValue(row.key);
                  const error = getRowError(rowValue);
                  const errorId = `${idPrefix}-row-${idx}-error`;
                  return (
                    <div key={idx}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-gray-700 whitespace-pre-line">
                          {row.label}
                        </span>
                        <div className="flex items-center gap-1">
                          <NumericInput
                            step="0.01"
                            value={rowValue}
                            onChange={(e) => {
                              if (isWithinTwoDecimals(e.target.value)) {
                                setRowValues({
                                  ...rowValues,
                                  [row.key]: e.target.value,
                                });
                              }
                            }}
                            placeholder="10"
                            aria-invalid={error !== null}
                            aria-describedby={error ? errorId : undefined}
                            className="w-24 text-right text-sm bg-white no-spinner border border-gray-300"
                          />
                          <span className="text-sm text-gray-700">%</span>
                        </div>
                      </div>
                      {error && (
                        <p
                          id={errorId}
                          className="mt-1 text-xs text-red-600 text-right"
                        >
                          {error}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 管理区分・管理コード・施策区分・施策コード・計上月は1つの枠にまとめる（Figma 1997532796）。
              算出方法によらず表示する。管理区分・管理コードは担当者が選択し、対象月以降の将来月にも反映する想定
              （センターフィも初期値〔マスタ管理者が設定した値〕を上書きして選択できる）。
              施策（年契基本分・取組強化マージンのみ）は対象月以降の将来月にも反映し、計上月は対象月のみに適用する想定。 */}
          <div className="space-y-4 p-4 bg-white rounded-lg border border-gray-300">
            <div className="space-y-2">
              <Label
                htmlFor={`${idPrefix}-management-class`}
                className="text-sm font-medium text-gray-700"
              >
                管理区分 <RequiredBadge />
              </Label>
              <SingleCombobox
                id={`${idPrefix}-management-class`}
                options={MANAGEMENT_CLASS_PANE_OPTIONS}
                value={managementClass}
                onChange={setManagementClass}
                placeholder="コード または 名称で検索..."
                ariaRequired
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor={`${idPrefix}-management-code`}
                className="text-sm font-medium text-gray-700"
              >
                管理コード <RequiredBadge />
              </Label>
              <SingleCombobox
                id={`${idPrefix}-management-code`}
                options={MANAGEMENT_CODE_PANE_OPTIONS}
                value={managementCode}
                onChange={setManagementCode}
                placeholder="コード または 名称で検索..."
                ariaRequired
              />
            </div>
            {showCampaign && (
              <>
                <div className="space-y-2">
                  <Label
                    htmlFor={`${idPrefix}-campaign-class`}
                    className="text-sm font-medium text-gray-700"
                  >
                    施策区分 <RequiredBadge />
                  </Label>
                  <SingleCombobox
                    id={`${idPrefix}-campaign-class`}
                    options={CAMPAIGN_CLASS_PANE_OPTIONS}
                    value={campaignClass}
                    onChange={handleCampaignClassChange}
                    placeholder="コード または 名称で検索..."
                    ariaRequired
                  />
                  {campaignClassError && (
                    <p className="text-xs text-red-600">{campaignClassError}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor={`${idPrefix}-campaign-code`}
                    className="text-sm font-medium text-gray-700"
                  >
                    施策コード <RequiredBadge />
                  </Label>
                  <SingleCombobox
                    id={`${idPrefix}-campaign-code`}
                    options={campaignCodeOptions}
                    value={campaignCode}
                    onChange={handleCampaignCodeChange}
                    placeholder="コード または 名称で検索..."
                    ariaRequired
                  />
                  {campaignCodeError && (
                    <p className="text-xs text-red-600">{campaignCodeError}</p>
                  )}
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label
                htmlFor={`${idPrefix}-posting-month`}
                className="text-sm font-medium text-gray-700"
              >
                計上月 <RequiredBadge />
              </Label>
              <MonthYearPicker
                required
                id={`${idPrefix}-posting-month`}
                value={postingMonth}
                onChange={setPostingMonth}
              />
            </div>
          </div>

          {/* 更新ボタン（右ペイン右下ではなく入力欄の最下段直下に配置） */}
          <div className="flex justify-end">
            <Button
              className="bg-blue-500 hover:bg-blue-600 text-white py-5 rounded-lg"
              onClick={handleClickUpdate}
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      </RightPane>
      {/* 更新確認: 当月以降のすべての販売計画表へ反映する旨を確認 */}
      <ConfirmDialog
        open={isUpdateConfirmShown}
        title="保存の確認"
        confirmLabel="保存"
        description="本設定を更新後に販売計画表の保存を実行すると、当月以降のすべての販売計画表に反映されます。本当によろしいですか？"
        onConfirm={() => {
          setIsUpdateConfirmShown(false);
          handleSubmit();
        }}
        onCancel={() => setIsUpdateConfirmShown(false)}
      />
    </>
  );
}
