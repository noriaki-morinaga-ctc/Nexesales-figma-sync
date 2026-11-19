// 請求EDI取込一覧 ─ 議事録2026/8/4 決定事項13
// 1行＝請求元企業 × 受信日時＝1回の受信ファイル。実サンプル3社の解析では
// いずれも1ファイル＝1卸で、区分1〜8のセットの繰り返しは同一卸内の束だった。
// 請求書・伝票は1ファイル内に多数あるため行にはできない。
// 支払は商流販売店単位でEDIとは粒度が異なり、支払との紐づけは請求一覧・請求詳細が担う。
import { useEffect, useMemo, useState } from 'react';

import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { SearchPane } from './components/SearchPane';
import { ResultList } from './components/ResultList';
import { INITIAL_SEARCH_CRITERIA } from '@/mocks/payment/billing-edi-list';
import type {
  BillingEdiImportRow,
  BillingEdiSearchCriteria,
} from '@/types/billingEdi';
import { filterBillingEdiRows } from '@/utils/payment/billing/billingEdiImport';
import { ScreenTitle } from '@/components/ui/screen-title';
import {
  useAppNavigation,
  useRouteParams,
} from '@/components/ui/use-app-navigation';
import { useBillingEdi } from '@/features/payment/shared/billing-edi/BillingEdiProvider';

export default function BillingEdiList() {
  const navigate = useAppNavigation();
  const params = useRouteParams();
  // 一覧の行データ（BillingEdiProvider が持つ。詳細画面の再取込・修正を反映する）
  const { rows, reset } = useBillingEdi();

  // 詳細画面の「戻る」以外（メニューなど）から開いたときは、行データを初期状態へ戻す。
  // 再取込でエラーを取り除いた行も元に戻し、何度でも同じ操作を試せるようにする（モックの都合。実システムでは行わない）
  useEffect(() => {
    if (params.from !== 'billing-edi-detail') reset();
  }, [params, reset]);

  // 検索条件（一覧の絞り込みに反映）
  const [searchCriteria, setSearchCriteria] =
    useState<BillingEdiSearchCriteria>(INITIAL_SEARCH_CRITERIA);

  // 一覧表示用データ（検索条件で絞り込み）
  const displayedRows = useMemo(
    () => filterBillingEdiRows(rows, searchCriteria),
    [rows, searchCriteria]
  );

  // 詳細ボタン押下処理（請求EDI取込結果詳細へ遷移する）
  const handleDetail = (row: BillingEdiImportRow) => {
    navigate('billing-edi-detail', { id: row.id });
  };

  return (
    // ページ自体はスクロールさせず、下端の一覧カード内のグリッドだけをスクロールさせる。
    // 高さの固定値をやめて「タイトル・検索条件を引いた残り」をグリッドへ割り当て、
    // 横スクロールバーが画面外へ押し出されないようにする（支払一覧と同じ構成）。
    // 画面が低く下限 23.75rem を割り込む場合は、はみ出した分だけメイン領域側がスクロールする。
    <div className="min-w-300 h-full flex flex-col">
      <div className="px-6 pt-3 pb-3 flex-1 min-h-0 flex flex-col">
        {/* 画面名はヘッダー（システム名の右）に表示する */}
        <ScreenTitle title="請求EDI取込一覧" />

        {/* 検索条件カード（条件変更で一覧を絞り込み） */}
        <SearchPane criteria={searchCriteria} onChange={setSearchCriteria} />

        {/* 取込一覧カード（fillParent でページの余り高さいっぱいまで広げ、折り畳み時は下限を外してヘッダーのみの高さへ戻す） */}
        <CollapsibleCard
          title="請求EDI取込一覧"
          fillParent
          className="data-[state=open]:min-h-95"
          contentClassName="p-2 flex flex-col flex-1 min-h-0"
        >
          {/* 一覧グリッド */}
          <ResultList rowData={displayedRows} onDetail={handleDetail} />
        </CollapsibleCard>
      </div>
    </div>
  );
}
