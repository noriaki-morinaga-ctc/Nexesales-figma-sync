import { useState } from 'react';

// 支払詳細(商流販売店紐づけなし)画面の基本情報。
// 本画面は商流販売店に紐づかない支払（②商流のみ／③販売店のみ／④末端組織）を扱う。
// パターンをラジオで選び、対象の販売店／一次店／三次店／末端組織を入力すると、その作成単位
// （一次店 × 三次店 × 販売店 × 末端組織。権限整理 P4）の拡売費計画（ヘッダ）が定まる。
// パターンごとにどれがダミーコードになるかは権限整理 P9〜P11 に従う（storeInputAvailability）。
import { CollapsibleCard } from '@/app/components/ui/collapsible-card';
import { SEARCH_GRID_CLASS, SEARCH_LABEL_CLASS } from '@/styles/commonStyles';
import { SingleCombobox } from '@/app/components/ui/single-combobox';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import { Label } from '@/app/components/ui/label';
import {
  DEALER_OPTIONS_DUMMY,
  FIRST_STORE_OPTIONS_DUMMY,
  THIRD_STORE_OPTIONS_DUMMY,
} from '@/mocks/common/storeTier';
import {
  SALES_PERSON_OPTIONS,
  OFFICE_OPTIONS,
  DEPARTMENT_OPTIONS,
  TERMINAL_ORG_OPTIONS,
} from '@/mocks/common/salesSelection';
import {
  NO_LINK_PATTERN,
  DUMMY_STORE_LABEL,
  storeInputAvailability,
  type NoLinkPattern,
} from '@/app/components/payment/payment-detail-unlinked/utils';

interface SearchPaneProps {
  onImport: () => void;
}

// 対象年月（請求を起点に決まるため参照専用）。
// 拡売費計画選択ペインの対象年月の初期値としても参照するため export する。
export const TARGET_MONTH = '2025年10月';

// 参照専用の項目値（モック）。他の支払詳細画面と表記を揃える。
// 引用明細選択（QuoteSelectionPane）の引用元の支払Noにも使うため export する。
export const PAYMENT_STATEMENT_NO = 'C2400NTO5'; // 支払No
// 申請側の組織（申請事業場・申請部署・申請末端組織・申請者）・申請日・分割・振替有無は
// 支払回ごとの情報のため、支払情報エリア（PaymentDetailPane）へ移動した
// （支払詳細(追加口請求書有)と同じ持ち方）。

// ラジオの選択肢（②③④）。
const PATTERN_OPTIONS: { value: NoLinkPattern; id: string }[] = [
  { value: NO_LINK_PATTERN.distributionOnly, id: 'pattern-distribution' },
  { value: NO_LINK_PATTERN.dealerOnly, id: 'pattern-dealer' },
  { value: NO_LINK_PATTERN.terminalOrgOnly, id: 'pattern-terminal-org' },
];

// ダミーコード固定の項目の表示（非活性・コンボボックスを出さない）。
function DummyStoreValue() {
  return (
    <div className="flex-1 h-8 flex items-center rounded-md border border-gray-200 bg-gray-100 px-3 text-sm text-gray-600">
      {DUMMY_STORE_LABEL}
    </div>
  );
}

// 画面単体のエクスポートは不要のため持たない（レビュー指摘 2026/7/22）。
// props は親が保持する計画書インポート用のみで、本コンポーネントでは使用しない。
export function SearchPane(_props: SearchPaneProps) {
  const [isOpen, setIsOpen] = useState(true);

  // 作成単位パターン（②③④）。初期表示は④（末端組織のみに紐づく）。
  const [pattern, setPattern] = useState<NoLinkPattern>(
    NO_LINK_PATTERN.terminalOrgOnly
  );

  // 組織（事業場 → 部署 → 末端組織 → 営業担当者 の階層）。
  // 作成単位は末端組織（第6階層）まで。
  // ※ここで選ぶのは拡売費計画を担当する組織であり、伝票を入力した申請側の組織
  //   （申請事業場・申請部署・申請末端組織・申請者）とは分けて持つ
  //   （→ 20260804_第26回 決定事項18／課題 No.0956）。
  const [office, setOffice] = useState('首都圏本部');
  const [department, setDepartment] = useState('首都圏営業第二部');
  const [terminalOrg, setTerminalOrg] = useState('東京第一営業所');
  // 営業担当者は単一（構造 B-6：支払ヘッダの担当者）。
  const [salesRep, setSalesRep] = useState('山田 太郎');

  // 商流販売店。本画面は商流販売店に紐づかないため、選択肢はダミーの一覧を使う。
  const [dealer, setDealer] = useState('');
  const [firstStore, setFirstStore] = useState('');
  const [thirdStore, setThirdStore] = useState('');

  // パターンごとの入力可否（権限整理 P9〜P11）。
  const available = storeInputAvailability(pattern);

  // パターン変更時：ダミーになる項目の入力値をクリアする。
  const handlePatternChange = (next: NoLinkPattern) => {
    setPattern(next);
    const nextAvailable = storeInputAvailability(next);
    if (!nextAvailable.dealer) setDealer('');
    if (!nextAvailable.firstStore) setFirstStore('');
    if (!nextAvailable.thirdStore) setThirdStore('');
  };

  // 事業場の変更時：紐づく部署・末端組織・営業担当者をクリアする。
  const handleOfficeChange = (next: string) => {
    setOffice(next);
    setDepartment('');
    setTerminalOrg('');
    setSalesRep('');
  };

  // 部署の変更時：紐づく末端組織・営業担当者をクリアする。
  const handleDepartmentChange = (next: string) => {
    setDepartment(next);
    setTerminalOrg('');
    setSalesRep('');
  };

  // 末端組織の変更時：紐づく営業担当者をクリアする。
  const handleTerminalOrgChange = (next: string) => {
    setTerminalOrg(next);
    setSalesRep('');
  };

  return (
    <CollapsibleCard title="基本情報" open={isOpen} onOpenChange={setIsOpen}>
      <div className="p-4">
        {/* 1行目: 作成単位パターン（②③④のラジオ）を最上部に配置。
              選んだパターンにより、どの商流販売店項目がダミーコードになるかが決まる。 */}
        <div className="flex items-start gap-2 mb-2 pb-3 border-b border-gray-300">
          <label className={`${SEARCH_LABEL_CLASS} pt-1.5`}>作成単位</label>
          <RadioGroup
            value={pattern}
            onValueChange={(v) => handlePatternChange(v as NoLinkPattern)}
            className="flex flex-wrap items-center gap-x-8 gap-y-2 pt-1.5"
          >
            {PATTERN_OPTIONS.map((opt) => (
              <div key={opt.id} className="flex items-center space-x-2">
                <RadioGroupItem value={opt.value} id={opt.id} />
                <Label htmlFor={opt.id} className="text-sm text-gray-900">
                  {opt.value}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* 2行目: 販売店 / 三次店 / 一次店。パターンによりダミーコード固定になる（権限 P9-11）。 */}
        <div
          className={`${SEARCH_GRID_CLASS} mb-2 pb-3 border-b border-gray-300`}
        >
          <div className="flex items-center gap-2">
            <label className={SEARCH_LABEL_CLASS}>販売店</label>
            {available.dealer ? (
              <div className="flex-1">
                <SingleCombobox
                  options={DEALER_OPTIONS_DUMMY}
                  value={dealer}
                  onChange={setDealer}
                  placeholder="販売店を選択／検索"
                  clearable
                />
              </div>
            ) : (
              <DummyStoreValue />
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className={SEARCH_LABEL_CLASS}>三次店</label>
            {available.thirdStore ? (
              <div className="flex-1">
                <SingleCombobox
                  options={THIRD_STORE_OPTIONS_DUMMY}
                  value={thirdStore}
                  onChange={setThirdStore}
                  placeholder="三次店を選択／検索"
                  clearable
                />
              </div>
            ) : (
              <DummyStoreValue />
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className={SEARCH_LABEL_CLASS}>一次店</label>
            {available.firstStore ? (
              <div className="flex-1">
                <SingleCombobox
                  options={FIRST_STORE_OPTIONS_DUMMY}
                  value={firstStore}
                  onChange={setFirstStore}
                  placeholder="一次店を選択／検索"
                  clearable
                />
              </div>
            ) : (
              <DummyStoreValue />
            )}
          </div>

          <div className="flex items-center gap-2"></div>
        </div>

        {/* 3行目: 事業場 / 部署 / 末端組織 / 営業担当者（組織階層順・上段＝販売計画側） */}
        <div
          className={`${SEARCH_GRID_CLASS} mb-2 pb-3 border-b border-gray-300`}
        >
          <div className="flex items-center gap-2">
            <label className={SEARCH_LABEL_CLASS}>事業場</label>
            <div className="flex-1 min-w-0">
              <SingleCombobox
                options={OFFICE_OPTIONS}
                value={office}
                onChange={handleOfficeChange}
                placeholder="事業場を選択／検索"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className={SEARCH_LABEL_CLASS}>部署</label>
            <div className="flex-1 min-w-0">
              <SingleCombobox
                options={DEPARTMENT_OPTIONS}
                value={department}
                onChange={handleDepartmentChange}
                placeholder="部署を選択／検索"
              />
            </div>
          </div>

          {/* 末端組織（第6階層）。全パターンで作成単位に含まれる（権限整理 P4）。 */}
          <div className="flex items-center gap-2">
            <label className={SEARCH_LABEL_CLASS}>末端組織</label>
            <div className="flex-1 min-w-0">
              <SingleCombobox
                options={TERMINAL_ORG_OPTIONS}
                value={terminalOrg}
                onChange={handleTerminalOrgChange}
                placeholder="末端組織を選択／検索"
                clearable
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className={SEARCH_LABEL_CLASS}>営業担当者</label>
            <div className="flex-1 min-w-0">
              <SingleCombobox
                options={SALES_PERSON_OPTIONS}
                value={salesRep}
                onChange={setSalesRep}
                placeholder="営業担当者を選択／検索"
              />
            </div>
          </div>
        </div>

        {/* 4行目: 対象年月 / 支払No。作成単位・商流販売店・組織が決まると計画が定まるため、
              選択の流れに合わせて最後に配置する（レビュー指摘 2026/7/22）。
              計画書No は本画面で使わないため項目自体を置かない
              （→ 本コメントスレッド返信 渡邊 2026-08-04）。 */}
        <div className={SEARCH_GRID_CLASS}>
          <div className="flex items-center gap-2">
            <label className={SEARCH_LABEL_CLASS}>対象年月</label>
            <div className="flex-1 h-8 flex items-center text-sm px-2 text-gray-900">
              {TARGET_MONTH}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className={SEARCH_LABEL_CLASS}>支払No</label>
            <div className="flex-1 h-8 flex items-center text-sm px-2 text-gray-900">
              {PAYMENT_STATEMENT_NO}
            </div>
          </div>

          <div className="flex items-center gap-2"></div>
        </div>
      </div>
    </CollapsibleCard>
  );
}
