import { CollapsibleCard } from '../../../ui/collapsible-card';
import { MonthStripPicker } from '../../../ui/month-strip-picker';
import { ConfirmDialog } from '../../../ui/confirm-dialog';
import { History } from 'lucide-react';
import { useState } from 'react';
import {
  SALES_PERSON_OPTIONS,
  OFFICE_OPTIONS,
  DEPARTMENT_OPTIONS,
  TERMINAL_ORG_OPTIONS,
} from '../../../../constants/salesSelectionMockData';
import {
  NO_LINK_PATTERN_OPTIONS,
  DEFAULT_NO_LINK_PATTERN,
  SALES_ROLE_OPTIONS,
  DEFAULT_SALES_ROLE,
  OWN_DEPARTMENT,
  fieldControlOf,
  type NoLinkPattern,
  type SalesRole,
} from '../../../../constants/salesPlanNoLinkPattern';
import { BASIC_INFO_STATUS } from '../../../../constants/planBasicInfoMockData';
import { SingleCombobox } from '../../../ui/single-combobox';
import { FORM_LABEL_CLASS } from '../../../../../styles/commonStyles';

interface SearchPaneProps {
  onStatusClick?: () => void;
  // 対象年月（親で制御する場合に渡す。コピー元の下ペインと共有するため）
  targetYearMonth?: string;
  onChangeTargetYearMonth?: (value: string) => void;
}

export function SearchPane({
  onStatusClick,
  targetYearMonth: targetYearMonthProp,
  onChangeTargetYearMonth,
}: SearchPaneProps) {
  const [isOpen, setIsOpen] = useState(true);
  // 対象年月（カレンダー入力）。親から渡された場合は制御コンポーネントとして共有する。
  const [internalYearMonth, setInternalYearMonth] = useState('2025/10');
  const targetYearMonth = targetYearMonthProp ?? internalYearMonth;
  const setTargetYearMonth = onChangeTargetYearMonth ?? setInternalYearMonth;
  // 対象年月変更の確認（入力中データのリセットを確認してから反映）
  const [pendingYearMonth, setPendingYearMonth] = useState<string | null>(null);
  // パターン（紐づけ種別）。既定は②商流のみに紐づく。
  const [pattern, setPattern] = useState<NoLinkPattern>(
    DEFAULT_NO_LINK_PATTERN
  );
  // パターン変更の確認（入力中データのリセットを確認してから反映）
  const [pendingPattern, setPendingPattern] = useState<NoLinkPattern | null>(
    null
  );
  // ロール（モック確認用）。営業企画／営業で部署の扱いが変わる。
  const [role, setRole] = useState<SalesRole>(DEFAULT_SALES_ROLE);
  // 事業場／部署（名称・コード検索可能なシングルコンボボックス）
  // 事業場は本画面では常に非活性で選択変更が発生しないため、単純な表示用の値として持つ
  // （将来 事業場 を活性化する場合はここを useState に戻し、下の SingleCombobox の
  // disabled と onChange を部署と同様の変更可能な形に戻す）。
  const office = '首都圏本部';
  const [department, setDepartment] = useState('首都圏営業第二部');
  // 末端組織（名称・コード検索可能なシングルコンボボックス）。初期表示は選択済み。
  const [terminalOrg, setTerminalOrg] = useState('東京第一営業所');
  // 作成者（名称・コード検索可能なシングルコンボボックス）。初期表示は1名選択済み。
  const [creator, setCreator] = useState('山田 太郎');

  const control = fieldControlOf(pattern);

  // 販売店・一次店・三次店（パターンで選択肢・値・活性が決まる）。
  // 値が null の項目（③の販売店、②の一次店・三次店）はユーザーの選択を保持する。
  const [dealer, setDealer] = useState('');
  const [firstStore, setFirstStore] = useState('');
  const [thirdStore, setThirdStore] = useState('');
  const dealerValue = control.dealerValue ?? dealer;
  const firstStoreValue = control.firstStoreValue ?? firstStore;
  const thirdStoreValue = control.thirdStoreValue ?? thirdStore;

  // 営業ロールは自部署を自動選択し、部署を非活性にする。
  const departmentEnabled = role === 'planning';
  const departmentValue = role === 'sales' ? OWN_DEPARTMENT : department;

  // 部署の選択変更時：紐づく末端組織・作成者をクリアする。
  const handleDepartmentChange = (next: string) => {
    setDepartment(next);
    setTerminalOrg('');
    setCreator('');
  };

  // 末端組織の選択変更時：紐づく作成者をクリアする。
  const handleTerminalOrgChange = (next: string) => {
    setTerminalOrg(next);
    setCreator('');
  };

  // パターン変更時：入力中データがリセットされるため確認を挟む。
  const handlePatternChange = (next: NoLinkPattern) => {
    if (next === pattern) return;
    setPendingPattern(next);
  };

  return (
    <>
      <CollapsibleCard
        title="基本情報"
        open={isOpen}
        onOpenChange={setIsOpen}
        className="mb-4"
      >
        <div className="p-4">
          {/* 1行目: 対象年月（月ストリップ）とステータス */}
          {/* ステータスの位置は対象年月の col-span で制御する（等幅5列を維持）。
              月ストリップの必要幅（ラベル85px＋ストリップ1048px＝約1141px）に対し、
              3列では最大1113px（1920px幅）で収まらずステータスに重なるため、
              収まる唯一の span が col-span-4。ステータスは5列目に固定され、
              2行目以降の列位置とも縦に揃う。 */}
          <div className="grid grid-cols-5 gap-3 mb-2 pb-3 border-b border-gray-300">
            {/* 対象年月 */}
            <div className="col-span-4 flex items-center gap-2">
              <label
                className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
              >
                対象年月
              </label>
              <div className="min-w-0">
                <MonthStripPicker
                  value={targetYearMonth}
                  onChange={(v) => setPendingYearMonth(v)}
                />
              </div>
            </div>

            {/* ステータス（非活性。横にコメント履歴ボタンを配置） */}
            <div className="flex items-center gap-2">
              <label
                className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
              >
                ステータス
              </label>
              <div className="h-8 flex items-center text-sm text-gray-900 whitespace-nowrap px-2">
                {BASIC_INFO_STATUS}
              </div>
              {/* 1280px幅ではステータス列（col-span-1）にラベル+値+本ボタンが収まらず、
                  カードのoverflow-hiddenでボタン右側が見切れていた（既存事象）。
                  2xl未満はアイコンのみにして必要幅を縮め、aria-labelで読み上げ名は維持する。 */}
              <button
                type="button"
                onClick={onStatusClick}
                className="flex items-center gap-1 bg-white text-blue-600 px-2 py-1 rounded-lg border-2 border-blue-600 hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors whitespace-nowrap text-xs"
                aria-label="コメント履歴"
              >
                <History className="h-[0.875rem] w-[0.875rem]" />
                <span className="hidden 2xl:inline">コメント履歴</span>
              </button>
            </div>
          </div>

          {/* 2行目: パターン（紐づけ種別）とロール */}
          {/* パターンの3択は「商流販売店に紐づかない」等の長いラベルがあり、既定のcol-span-2幅
              （1600px基準）のままだと1280pxでラベルが折り返す。2xl(1536px)未満はパターンを
              広く・ロールを狭くし、1600px（2xl）では従来のパターン/ロール比を維持する。 */}
          <div className="grid grid-cols-5 gap-3 mb-2 pb-3 border-b border-gray-300">
            <fieldset className="col-span-3 2xl:col-span-2 flex items-center gap-2">
              <legend className="sr-only">パターン（紐づけ種別）</legend>
              <span
                className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
              >
                パターン
              </span>
              <div className="flex flex-1 min-w-0 items-center gap-4">
                {NO_LINK_PATTERN_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    className="flex items-center gap-1.5 whitespace-nowrap text-sm text-gray-900 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="no-link-pattern"
                      value={o.value}
                      checked={pattern === o.value}
                      onChange={() => handlePatternChange(o.value)}
                      className="focus:ring-2 focus:ring-blue-500"
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* ロール（モック確認用。営業企画／営業で部署の扱いが変わる） */}
            <fieldset className="col-span-2 2xl:col-span-3 flex items-center gap-2">
              <legend className="sr-only">ロール（モック確認用）</legend>
              <span
                className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
              >
                ロール
              </span>
              <div className="flex items-center gap-4">
                {SALES_ROLE_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    className="flex items-center gap-1.5 whitespace-nowrap text-sm text-gray-900 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="sales-role"
                      value={o.value}
                      checked={role === o.value}
                      onChange={() => setRole(o.value)}
                      className="focus:ring-2 focus:ring-blue-500"
                    />
                    {o.label}
                  </label>
                ))}
                {/* モック確認用である旨は選択肢の後（営業の右隣）に置く。 */}
                <span className="whitespace-nowrap text-xs font-normal text-gray-500">
                  ※モック確認用
                </span>
              </div>
            </fieldset>
          </div>

          {/* 3行目: 事業場／部署／末端組織／作成者 */}
          <div className="grid grid-cols-5 gap-3 mb-2 pb-3 border-b border-gray-300">
            {/* 事業場（本画面では常に非活性。販売店と同様、常時disabledのため onChange は no-op） */}
            <div className="flex items-center gap-2">
              <label
                className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
              >
                事業場
              </label>
              <div className="flex-1 min-w-0">
                <SingleCombobox
                  options={OFFICE_OPTIONS}
                  value={office}
                  onChange={() => undefined}
                  placeholder="事業場を選択／検索"
                  disabled
                />
              </div>
            </div>

            {/* 部署（営業企画は選択可・営業は自部署を自動選択して非活性） */}
            <div className="flex items-center gap-2">
              <label
                className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
              >
                部署
              </label>
              <div className="flex-1 min-w-0">
                <SingleCombobox
                  options={DEPARTMENT_OPTIONS}
                  value={departmentValue}
                  onChange={handleDepartmentChange}
                  placeholder="部署を選択／検索"
                  disabled={!departmentEnabled}
                />
              </div>
            </div>

            {/* 末端組織（名称・コード検索可能なシングルコンボボックス。全パターン活性） */}
            <div className="flex items-center gap-2">
              <label
                className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
              >
                末端組織
              </label>
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

            {/* 作成者（名称・コード検索可能なシングルコンボボックス。1名のみ選択） */}
            <div className="flex items-center gap-2">
              <label
                className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
              >
                作成者
              </label>
              <div className="flex-1 min-w-0">
                <SingleCombobox
                  options={SALES_PERSON_OPTIONS}
                  value={creator}
                  onChange={setCreator}
                  placeholder="作成者を選択／検索"
                  clearable
                />
              </div>
            </div>

            {/* 空白セル（5列構成を維持） */}
            <div className="flex items-center gap-2"></div>
          </div>

          {/* 4行目: 販売店／一次店／三次店（最終行のため下区切り罫線なし。他行と同じ5列グリッド） */}
          <div className="grid grid-cols-5 gap-3">
            {/* 販売店（③販売店のみ のときだけ通常コードから選択できる） */}
            <div className="flex items-center gap-2">
              <label
                className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
              >
                販売店
              </label>
              <div className="flex-1 min-w-0">
                <SingleCombobox
                  options={control.dealerOptions}
                  value={dealerValue}
                  onChange={setDealer}
                  placeholder="販売店を選択／検索"
                  disabled={!control.dealerEnabled}
                  clearable={control.dealerEnabled}
                />
              </div>
            </div>

            {/* 一次店（②商流のみ のときだけ通常コードかダミーから選択できる） */}
            <div className="flex items-center gap-2">
              <label
                className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
              >
                一次店
              </label>
              <div className="flex-1 min-w-0">
                <SingleCombobox
                  options={control.firstStoreOptions}
                  value={firstStoreValue}
                  onChange={setFirstStore}
                  placeholder="一次店を選択／検索"
                  disabled={!control.firstStoreEnabled}
                  clearable={control.firstStoreEnabled}
                />
              </div>
            </div>

            {/* 三次店（②商流のみ のときだけ通常コードかダミーから選択できる） */}
            <div className="flex items-center gap-2">
              <label
                className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
              >
                三次店
              </label>
              <div className="flex-1 min-w-0">
                <SingleCombobox
                  options={control.thirdStoreOptions}
                  value={thirdStoreValue}
                  onChange={setThirdStore}
                  placeholder="三次店を選択／検索"
                  disabled={!control.thirdStoreEnabled}
                  clearable={control.thirdStoreEnabled}
                />
              </div>
            </div>

            {/* 空白セル */}
            <div className="flex items-center gap-2"></div>
            <div className="flex items-center gap-2"></div>
          </div>
        </div>
      </CollapsibleCard>

      {/* 対象年月変更の確認: 入力中データのリセットを確認 */}
      <ConfirmDialog
        open={pendingYearMonth !== null}
        title="対象年月変更の確認"
        confirmLabel="変更"
        description="入力中のデータがリセットされます。本当によろしいですか？"
        onConfirm={() => {
          if (pendingYearMonth !== null) setTargetYearMonth(pendingYearMonth);
          setPendingYearMonth(null);
        }}
        onCancel={() => setPendingYearMonth(null)}
      />

      {/* パターン変更の確認: 入力中データのリセットを確認 */}
      <ConfirmDialog
        open={pendingPattern !== null}
        title="パターン変更の確認"
        confirmLabel="変更"
        description="入力中のデータがリセットされます。本当によろしいですか？"
        onConfirm={() => {
          if (pendingPattern !== null) {
            setPattern(pendingPattern);
            // 紐づけ先が変わるため、ユーザーが選んだ販売店・一次店・三次店は破棄する。
            setDealer('');
            setFirstStore('');
            setThirdStore('');
          }
          setPendingPattern(null);
        }}
        onCancel={() => setPendingPattern(null)}
      />
    </>
  );
}
