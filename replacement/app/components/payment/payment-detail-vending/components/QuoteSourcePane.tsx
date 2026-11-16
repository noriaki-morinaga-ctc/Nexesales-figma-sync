// 支払詳細(自販機)：引用明細選択ペイン（下ペイン）。「支払情報引用」ボタンで開き、「引用」で当画面へ取り込む。
// タイトル・条件の置き方・高さは手売りの支払詳細の引用明細選択（shared/payment/quote/QuoteSelectionPane を包む下ペイン）と
// そろえる（UI/UX UX-076 → 02 BottomPane）：タイトル「引用明細選択」、条件はタイトル直下の固定ヘッダー（headerContent）に横一列、
// 高さは画面の半分（initialHeightRatio 0.5・最小22・最大52）。

import { AgGridReact } from 'ag-grid-react';
import { ColDef, type GetRowIdFunc } from 'ag-grid-community';

import {
  useGridColumnState,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
} from '@/app/components/grid';
import {
  FORM_LABEL_CLASS,
  BUTTON_STYLES,
  BUTTON_BASE,
} from '@/styles/commonStyles';

import { SingleCombobox } from '@/app/components/ui/single-combobox';

import { MonthYearPicker } from '@/app/components/ui/month-year-picker';
import { BottomPane } from '@/app/components/ui/bottom-pane';
import { CollapsibleCard } from '@/app/components/ui/collapsible-card';

import {
  QUOTE_SOURCE_TARGET_MONTH,
  QUOTE_SOURCE_PAYMENT_NO,
  QUOTE_SOURCE_ROUND_OPTIONS,
} from '@/mocks/payment/payment-detail-vending/paymentDetail';

import type { QuoteSourceData } from '@/app/components/payment/payment-detail-vending/paymentDetailVending.types';
import { LabelField } from './LabelField';

interface QuoteSourcePaneProps {
  // ペインの開閉
  open: boolean;
  // 閉じる
  onClose: () => void;
  // 引用（選択した引用元の内容を当画面へ取り込む）
  onApply: () => void;
  // 引用元の支払回数
  quoteSourceRound: string;
  // 引用元の支払回数を選ぶ
  onQuoteSourceRoundChange: (round: string) => void;
  // 選択中の支払回数の引用元
  quoteSource: QuoteSourceData;
  // 引用元の支払明細グリッドの列（参照専用）
  columnDefs: ColDef[];
  // 引用元の支払明細グリッドの列状態の保存／復元
  gridColumnStateProps: ReturnType<typeof useGridColumnState>;
  // 行ID
  getRowId: GetRowIdFunc;
}

export function QuoteSourcePane({
  open,
  onClose,
  onApply,
  quoteSourceRound,
  onQuoteSourceRoundChange,
  quoteSource,
  columnDefs,
  gridColumnStateProps,
  getRowId,
}: QuoteSourcePaneProps) {
  return (
    <BottomPane
      open={open}
      onClose={onClose}
      title="引用明細選択"
      // 親画面と当ペインの表示領域が半分ずつになるよう自動調整する（手売りの引用明細選択と同じ）。
      initialHeightRatio={0.5}
      minHeight={22}
      maxHeight={52}
      // タイトル直下（固定ヘッダー内）へ条件を横一列に置く（手売りの引用明細選択と同じ置き方）。
      headerContent={
        <div className="flex flex-wrap items-center gap-4">
          {/* 対象年月（引用元は当画面の対象年月に固定のため入力不可） */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="quote-source-target-month"
              className={`${FORM_LABEL_CLASS} whitespace-nowrap`}
            >
              対象年月
            </label>
            <MonthYearPicker
              id="quote-source-target-month"
              value={QUOTE_SOURCE_TARGET_MONTH}
              onChange={() => {}}
              disabled
            />
          </div>

          {/* 支払No（引用元が定まると自動で決まるため入力不可） */}
          <LabelField
            label="支払No"
            value={QUOTE_SOURCE_PAYMENT_NO}
            labelClassName={`${FORM_LABEL_CLASS} whitespace-nowrap`}
          />

          {/* 支払回数 */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="quote-source-round"
              className={`${FORM_LABEL_CLASS} whitespace-nowrap`}
            >
              支払回数
            </label>
            <SingleCombobox
              id="quote-source-round"
              className="w-20"
              options={[
                ...QUOTE_SOURCE_ROUND_OPTIONS.map((round) => ({
                  value: round,
                  label: round,
                })),
              ]}
              value={quoteSourceRound}
              onChange={onQuoteSourceRoundChange}
              placeholder="選択"
              searchable={false}
            />
          </div>
        </div>
      }
      headerActions={
        // 引用：選択した引用元の内容を当画面へ取り込む（当ペインの確定操作）。
        // DB更新を伴う確定系のため塗り青（→ 01・02 §10.2）。
        // 高さはタイトル（text-lg＝行高 1.75rem）と同じ h-7 に抑え、ボタンを置いても
        // ヘッダーが既定の高さのままになるようにする（btn-action-base は 2.25rem のため使わない）。
        <button
          className={`${BUTTON_STYLES.primary} ${BUTTON_BASE} inline-flex h-7 items-center gap-2 px-3 text-sm font-medium whitespace-nowrap`}
          onClick={onApply}
          aria-label="引用"
        >
          引用
        </button>
      }
    >
      {/* 支払明細情報の表をペインの残りの高さいっぱいに広げ、ペインの高さに合わせて伸び縮みさせる
          （下ペインは初めて開いたときに明細5行分の高さになる → 02 BottomPane） */}
      <div className="flex min-h-0 flex-1 flex-col p-3">
        {/* 引用元の支払情報（参照専用）。選択した対象年月・支払回数の内容を表示する。 */}
        <CollapsibleCard title="支払情報">
          <div className="p-4">
            {/* 1行目: 支払先 / 発生日 / 支払予定日 */}
            <div className="grid grid-cols-4 gap-3 mb-2.5 pb-2.5 border-b border-gray-300">
              <LabelField label="支払先" value={quoteSource.destination} />
              <LabelField label="発生日" value={quoteSource.occurrenceDate} />
              <LabelField
                label="支払予定日"
                value={quoteSource.scheduledDate}
              />
              <div />
            </div>

            {/* 2行目: 備考（最終行のため下区切り罫線なし） */}
            <LabelField label="備考" value={quoteSource.note} />
          </div>
        </CollapsibleCard>

        {/* 引用元の支払明細（参照専用）。列構成は経費明細グリッドと同じ。 */}
        <CollapsibleCard title="支払明細情報" className="mt-3" fillParent>
          <div className="expense-item-grid min-h-0 w-full flex-1 px-3 py-3">
            <AgGridReact
              rowData={quoteSource.expenseData}
              columnDefs={columnDefs}
              defaultColDef={GRID_DEFAULT_COL_DEF}
              // 左端はデータのID列（先頭列）を表示するため行番号列は無効化
              rowNumbers={false}
              getRowId={getRowId}
              statusBar={GRID_STATUS_BAR}
              // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）
              {...gridColumnStateProps}
              // 共通基本プロパティ（Enter縦移動・テキスト選択／grid/）
              {...GRID_BASE_PROPS}
            />
          </div>
        </CollapsibleCard>
      </div>
    </BottomPane>
  );
}
