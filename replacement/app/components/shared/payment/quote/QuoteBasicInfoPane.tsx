import { Download } from 'lucide-react';
import { useState } from 'react';

// 支払詳細(見積)・(見積入力)共通の基本情報エリア（→ 02 §12.2）
import { CollapsibleCard } from '../../../ui/collapsible-card';
import { SingleCombobox } from '../../../ui/single-combobox';
import { MonthYearPicker } from '../../../ui/month-year-picker';
import {
  DEALER_OPTIONS,
  FIRST_STORE_OPTIONS,
  THIRD_STORE_OPTIONS,
} from '../../../../constants/storeTierMockData';
import {
  resolveQuoteBasicInfo,
  type QuoteBasicInfo,
} from '../../../../utils/payment/quote/quoteBasicInfo';

import { BUTTON_STYLES, BUTTON_BASE } from '../../../../../styles/commonStyles';
interface SearchPaneProps {
  onImport: () => void;
  onExport: () => void;
  onQuoteExport: () => void;
  // 支払一覧の引用ペインで入力された基本情報（プリフィル用）。未指定時は既定値。
  basicInfo?: QuoteBasicInfo;
  // 販売店・一次店・三次店を選べるコンボにする（支払詳細(見積)）。
  // 省略時は引用ペインで選択済みの内容を文字で表示する（支払詳細(見積入力)）
  storesEditable?: boolean;
}

export function QuoteBasicInfoPane({
  onImport,
  onExport,
  onQuoteExport,
  basicInfo,
  storesEditable = false,
}: SearchPaneProps) {
  const [isOpen, setIsOpen] = useState(true);
  // 引用ペインの入力値（未指定項目は既定値で補完）をプリフィル初期値に使う。
  const resolved = resolveQuoteBasicInfo(basicInfo);
  // 販売計画書Noの選択State（先頭を初期選択）
  const [planNoValue, setPlanNoValue] = useState('0');

  // 販売計画書Noのリスト
  const planNoList = [
    'D2420TK08',
    'D2420TK09',
    'D2420TK10',
    'D2421TK01',
    'D2421TK02',
  ];
  // 対象年月（カレンダー入力・YYYY/MM 形式）
  const [targetMonth, setTargetMonth] = useState(resolved.targetMonth);

  // 販売店／一次店／三次店（storesEditable のとき：名称・コード検索可能なシングルコンボボックス）。
  // 選択肢は拡売費計画(商流販売店に紐づき無し)画面と同じ共通マスタ（storeTierMockData）。
  const [dealer, setDealer] = useState(resolved.dealer);
  const [firstStore, setFirstStore] = useState(resolved.firstStore);
  const [thirdStore, setThirdStore] = useState(resolved.thirdStore);

  // 販売店／一次店／三次店は引用ペインで選択済みの内容を「コード:名前」でテキスト表示する（編集不可）。
  // 選択肢マスタ（storeTierMockData）から value に対応する code・名称を引く。
  const findStoreLabel = (
    options: { value: string; label: string; code?: string }[],
    value: string
  ) => {
    const found = options.find((o) => o.value === value);
    if (!found) return value;
    return found.code ? `${found.code}:${found.label}` : found.label;
  };
  const dealerLabel = findStoreLabel(DEALER_OPTIONS, resolved.dealer);
  const firstStoreLabel = findStoreLabel(
    FIRST_STORE_OPTIONS,
    resolved.firstStore
  );
  const thirdStoreLabel = findStoreLabel(
    THIRD_STORE_OPTIONS,
    resolved.thirdStore
  );

  return (
    <CollapsibleCard
      title="基本情報"
      open={isOpen}
      onOpenChange={setIsOpen}
      headerActions={
        <>
          <button
            className={`${BUTTON_STYLES.outline} ${BUTTON_BASE} flex items-center gap-2 px-3 py-1 whitespace-nowrap text-sm`}
            aria-label="エクスポート"
            onClick={onExport}
          >
            <Download className="h-4 w-4" />
            エクスポート
          </button>
        </>
      }
    >
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        {/* 1行目: 4列グリッド */}
        <div className="grid grid-cols-4 gap-3 mb-2 pb-3 border-b border-gray-300">
          {/* 販売計画書 No. */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-blue-900 whitespace-nowrap w-36 text-right font-bold px-2 py-1">
              販売計画書 No.
            </label>
            <div className="w-40">
              <SingleCombobox
                options={planNoList.map((no, index) => ({
                  value: String(index),
                  label: no,
                }))}
                value={planNoValue}
                onChange={setPlanNoValue}
                filterOnType
              />
            </div>
          </div>

          {/* 対象年月 */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-blue-900 whitespace-nowrap w-36 text-right font-bold px-2 py-1">
              対象年月
            </label>
            <MonthYearPicker
              value={targetMonth}
              onChange={setTargetMonth}
              clearable={storesEditable}
            />
          </div>

          {/* 空白セル（4列目・計上年月は支払明細情報へ移動） */}
          <div className="flex items-center gap-2"></div>
        </div>

        {/* 2行目: 4列グリッド（4列目は空） */}
        <div className="grid grid-cols-4 gap-3 mb-2 pb-3 border-b border-gray-300">
          {/* 事業場 */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-blue-900 whitespace-nowrap w-36 text-right font-bold px-2 py-1">
              事業場
            </label>
            <div className="flex-1 h-8 flex items-center text-sm px-6 text-gray-900">
              10000623:首都圏本部
            </div>
          </div>

          {/* 部署 */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-blue-900 whitespace-nowrap w-36 text-right font-bold px-2 py-1">
              部署
            </label>
            <div className="flex-1 h-8 flex items-center text-sm px-6 text-gray-900">
              10002990:首都圏営業第二部
            </div>
          </div>

          {/* 営業担当者 */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-blue-900 whitespace-nowrap w-36 text-right font-bold px-2 py-1">
              営業担当者
            </label>
            <div className="flex-1 h-8 flex items-center text-sm px-6 text-gray-900">
              5172733:アサヒ　太郎
            </div>
          </div>

          {/* 空白セル（4列目） */}
          <div className="flex items-center gap-2"></div>
        </div>

        {/* 3行目: 4列グリッド（4列目は空・最終行のため下区切り罫線なし） */}
        <div className="grid grid-cols-4 gap-3">
          {/* 販売店（見積入力＝引用ペインで選択済みの内容を文字で表示／見積＝選べるコンボ） */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-blue-900 whitespace-nowrap w-36 text-right font-bold px-2 py-1">
              販売店
            </label>
            {storesEditable ? (
              <div className="w-[calc((100%-9.5rem)*0.8)]">
                <SingleCombobox
                  options={DEALER_OPTIONS}
                  value={dealer}
                  onChange={setDealer}
                  ariaLabel="販売店"
                  placeholder="販売店を選択／検索"
                  clearable
                />
              </div>
            ) : (
              <div className="flex-1 h-8 flex items-center text-sm px-6 text-gray-900">
                {dealerLabel}
              </div>
            )}
          </div>

          {/* 一次店（見積入力＝引用ペインで選択済みの内容を文字で表示／見積＝選べるコンボ） */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-blue-900 whitespace-nowrap w-36 text-right font-bold px-2 py-1">
              一次店
            </label>
            {storesEditable ? (
              <div className="w-[calc((100%-9.5rem)*0.8)]">
                <SingleCombobox
                  options={FIRST_STORE_OPTIONS}
                  value={firstStore}
                  onChange={setFirstStore}
                  ariaLabel="一次店"
                  placeholder="一次店を選択／検索"
                  clearable
                />
              </div>
            ) : (
              <div className="flex-1 h-8 flex items-center text-sm px-6 text-gray-900">
                {firstStoreLabel}
              </div>
            )}
          </div>

          {/* 三次店（見積入力＝引用ペインで選択済みの内容を文字で表示／見積＝選べるコンボ） */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-blue-900 whitespace-nowrap w-36 text-right font-bold px-2 py-1">
              三次店
            </label>
            {storesEditable ? (
              <div className="w-[calc((100%-9.5rem)*0.8)]">
                <SingleCombobox
                  options={THIRD_STORE_OPTIONS}
                  value={thirdStore}
                  onChange={setThirdStore}
                  ariaLabel="三次店"
                  placeholder="三次店を選択／検索"
                  clearable
                />
              </div>
            ) : (
              <div className="flex-1 h-8 flex items-center text-sm px-6 text-gray-900">
                {thirdStoreLabel}
              </div>
            )}
          </div>

          {/* 空白セル（4列目） */}
          <div className="flex items-center gap-2"></div>
        </div>
      </div>
    </CollapsibleCard>
  );
}
