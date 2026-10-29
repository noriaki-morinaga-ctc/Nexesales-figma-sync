// 支払詳細(引用)画面用：SearchPane をベースに作成
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../../ui/collapsible';
import { SingleCombobox } from '../../../ui/single-combobox';
import { MonthYearPicker } from '../../../ui/month-year-picker';
import {
  DEALER_OPTIONS,
  FIRST_STORE_OPTIONS,
  THIRD_STORE_OPTIONS,
} from '../../../../constants/storeTierMockData';
import { ChevronDown, Download } from 'lucide-react';
import { useState } from 'react';

interface SearchPaneProps {
  onImport: () => void;
  onExport: () => void;
  onQuoteExport: () => void;
}

export function SearchPane({
  onImport,
  onExport,
  onQuoteExport,
}: SearchPaneProps) {
  const [isOpen, setIsOpen] = useState(true);
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
  const [targetMonth, setTargetMonth] = useState('2025/10');

  // 販売店／一次店／三次店（名称・コード検索可能なシングルコンボボックス）。
  // 選択肢は拡売費計画(商流販売店に紐づき無し)画面と同じ共通マスタ
  // （storeTierMockData）を使用する。初期表示は先頭を選択済み。
  const [dealer, setDealer] = useState(DEALER_OPTIONS[0].value);
  const [firstStore, setFirstStore] = useState(FIRST_STORE_OPTIONS[0].value);
  const [thirdStore, setThirdStore] = useState(THIRD_STORE_OPTIONS[0].value);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4"
    >
      {/* タイトルヘッダー */}
      <div className="bg-white px-3 pt-2 pb-4 card-header-accent flex items-center justify-between">
        <span className="text-gray-900 font-bold text-lg">基本情報</span>

        {/* ヘッダーボタン */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            className="flex items-center gap-2 bg-white text-blue-600 px-3 py-1 rounded-lg border-2 border-blue-600 hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors whitespace-nowrap text-sm"
            aria-label="エクスポート"
            onClick={onExport}
          >
            <Download className="h-[1rem] w-[1rem]" />
            エクスポート
          </button>
        </div>

        <CollapsibleTrigger className="hover:text-blue-700 transition-colors">
          <ChevronDown
            className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          {/* 1行目: 4列グリッド */}
          <div className="grid grid-cols-4 gap-3 mb-2 pb-3 border-b border-gray-300">
            {/* 販売計画書 No. */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-blue-900 whitespace-nowrap w-36 text-right font-bold px-2 py-1">
                販売計画書 No.
              </label>
              <div className="w-[160px]">
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
              <MonthYearPicker value={targetMonth} onChange={setTargetMonth} />
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
            {/* 販売店（セレクトボックス） */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-blue-900 whitespace-nowrap w-36 text-right font-bold px-2 py-1">
                販売店
              </label>
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
            </div>

            {/* 一次店（セレクトボックス） */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-blue-900 whitespace-nowrap w-36 text-right font-bold px-2 py-1">
                一次店
              </label>
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
            </div>

            {/* 三次店（セレクトボックス） */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-blue-900 whitespace-nowrap w-36 text-right font-bold px-2 py-1">
                三次店
              </label>
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
            </div>

            {/* 空白セル（4列目） */}
            <div className="flex items-center gap-2"></div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
