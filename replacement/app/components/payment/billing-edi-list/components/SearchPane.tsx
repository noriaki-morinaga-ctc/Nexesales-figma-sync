import { Search } from 'lucide-react';

import { SearchRangeField } from '@/app/components/ui/search-range-field';
import { CopyableArea } from '@/app/components/ui/copyable-area';
import { DateMonthYearPicker } from '@/app/components/ui/date-month-year-picker';
import { CollapsibleCard } from '@/app/components/ui/collapsible-card';
import { SearchClearButton } from '@/app/components/ui/search-clear-button';
import {
  buildSearchSummary,
  formatSummaryRange,
} from '@/app/components/ui/search-summary';
import { SingleCombobox } from '@/app/components/ui/single-combobox';
import { BILLING_EDI_PAYEE_OPTIONS } from '@/mocks/payment/billing-edi-list';
import { SEARCH_GRID_CLASS, SEARCH_LABEL_CLASS } from '@/styles/commonStyles';
import { INITIAL_SEARCH_CRITERIA } from '@/mocks/payment/billing-edi-list';
import type { BillingEdiSearchCriteria } from '@/app/types/billingEdi';

interface SearchPaneProps {
  criteria: BillingEdiSearchCriteria;
  onChange: (next: BillingEdiSearchCriteria) => void;
}

export function SearchPane({ criteria, onChange }: SearchPaneProps) {
  // 1項目だけ更新するヘルパー
  const update = <K extends keyof BillingEdiSearchCriteria>(
    key: K,
    value: BillingEdiSearchCriteria[K]
  ) => {
    onChange({ ...criteria, [key]: value });
  };

  // 検索条件カードを折り畳んだときに見出しの行へ出す要約（値が入っている項目だけ。UI/UX UX-024）
  const searchSummary = buildSearchSummary([
    {
      label: '受信日',
      value: formatSummaryRange(criteria.importDateFrom, criteria.importDateTo),
    },
    { label: '請求元企業', value: criteria.payee },
    {
      label: 'ステータス',
      value: criteria.status === 'all' ? '' : criteria.status,
    },
  ]);

  // クリアボタン押下処理（検索条件を初期値に戻す）
  const handleClear = () => {
    onChange(INITIAL_SEARCH_CRITERIA);
  };

  // 検索条件の値は Ctrl+C／右クリック「コピー」で表示中の値をコピーできる（CopyableArea → 02 §15）
  return (
    <CopyableArea className="shrink-0">
      <CollapsibleCard
        title={
          <span className="flex items-center gap-2">
            <Search className="h-5 w-5 text-gray-700" />
            検索条件
          </span>
        }
        // 画面が低くてもグリッドに押しつぶされないよう縮めない（足りない分は画面側がスクロールする）
        className="shrink-0"
        // クリアボタンはヘッダーバーに置き、専用の行を使わない（計画一覧と同一体裁）
        headerActions={<SearchClearButton onClick={handleClear} />}
        collapsedSummary={searchSummary}
      >
        <div className="px-4 py-1.5">
          {/* 検索条件（3条件）を1行に配置する。
              一覧に列として存在する項目だけを条件にする */}
          {/* 一覧画面の検索条件は全画面共通の5列（→ 05 一覧画面の検索条件） */}
          <div className={SEARCH_GRID_CLASS}>
            {/* 受信日（範囲）。共通カレンダー部品で選択し、×でクリアできる。
                開始＞終了の逆転を作らせないよう、開始の上限に終了・終了の下限に開始を渡す。 */}
            <SearchRangeField
              wide
              label="受信日"
              htmlFor="search-import-date-from"
              groupLabel="検索受信日の範囲"
              start={
                <DateMonthYearPicker
                  className="w-full"
                  compact
                  id="search-import-date-from"
                  ariaLabel="受信日（開始）"
                  value={criteria.importDateFrom}
                  max={criteria.importDateTo}
                  clearable
                  onChange={(value) => update('importDateFrom', value)}
                />
              }
              end={
                <DateMonthYearPicker
                  className="w-full"
                  compact
                  ariaLabel="受信日（終了）"
                  value={criteria.importDateTo}
                  min={criteria.importDateFrom}
                  clearable
                  onChange={(value) => update('importDateTo', value)}
                />
              }
            />

            {/* 請求元企業 */}
            <div className="flex items-center gap-2">
              <label htmlFor="search-payee" className={SEARCH_LABEL_CLASS}>
                請求元企業
              </label>
              {/* 請求元企業は取引先マスタから選ぶ（自由入力では表記ゆれで絞り込めないため） */}
              <div className="min-w-0 flex-1">
                <SingleCombobox
                  id="search-payee"
                  value={criteria.payee}
                  onChange={(value) => update('payee', value)}
                  options={BILLING_EDI_PAYEE_OPTIONS.map((name) => ({
                    value: name,
                    label: name,
                  }))}
                  placeholder="指定なし"
                />
              </div>
            </div>

            {/* ステータス */}
            <div className="flex items-center gap-2">
              <label htmlFor="search-status" className={SEARCH_LABEL_CLASS}>
                ステータス
              </label>
              <SingleCombobox
                id="search-status"
                className="min-w-0 flex-1"
                // 未選択＝「指定なし」（条件なし）。「全て」の選択肢は持たない（→ 02 §9）。
                // 検索条件の値は従来どおり未選択を 'all' で持つ（絞り込みの意味は変えない）
                options={[
                  { value: '正常', label: '正常' },
                  { value: 'エラー', label: 'エラー' },
                ]}
                value={criteria.status === 'all' ? '' : criteria.status}
                onChange={(v) => update('status', v || 'all')}
                placeholder="指定なし"
                clearable
                searchable={false}
              />
            </div>
          </div>
        </div>
      </CollapsibleCard>
    </CopyableArea>
  );
}
