// 請求EDI取込結果詳細 ─ 議事録2026/8/4 決定事項13
// 請求EDI取込一覧で選択した1行（卸会社×受信日時）の内訳を表示し、再取込を指示する画面。
// 商流販売店の割当・誤りの修正は請求詳細画面が担う（この画面では行わない）。
// 形式エラー（数値項目に数値以外の値 等）はこちらでは直せず、卸への照会・再送依頼になる。
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { RotateCcw, ArrowLeft } from 'lucide-react';

import { Checkbox } from '@/app/components/ui/checkbox';
import { CollapsibleCard } from '@/app/components/ui/collapsible-card';
import { Label } from '@/app/components/ui/label';
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog';
import {
  useResizableHeight,
  ResizeHandle,
} from '@/app/components/ui/resizable-panel';
import { BasicInfo } from './components/BasicInfo';
import { ErrorList } from './components/ErrorList';
import { BillingDetailList } from './components/BillingDetailList';
import type {
  BillingEdiErrorSummary,
  BillingEdiImportRow,
} from '@/app/types/billingEdi';
import { targetCountOf } from '@/app/utils/payment/billing/billingEdiImport';
import { ScreenTitle } from '@/app/components/ui/screen-title';
import { viewportGridHeight } from '@/app/components/grid';

// 請求EDI明細（画面のいちばん下の表）の高さで画面の縦幅から引く分（rem。アプリのヘッダー・
// 画面下部のボタンの列・カードの下の余白）。最下部までスクロールした状態で、表が画面に
// ちょうど収まる値（UX-099。実測で決めた値）。
const DETAIL_GRID_OFFSET_REM = 9.5;

interface BillingEdiDetailProps {
  // 一覧の行データ（App.tsx が state で保持）
  rows: BillingEdiImportRow[];
  // 一覧で選択された行のID。メニューから直接開いた場合は未選択とし、既定行を表示する
  selectedId?: string;
  onBack?: () => void;
  // 再取込指示の確定処理（エラーサマリ1件が単位。対象を「再取込指示済」に更新する）
  // 再取込の実行（オンライン。押した時点で結果が確定する）
  onReimportSummary: (rowId: string, summaryId: string) => void;
  // エラーサマリの「変換後の値」を登録したときの反映
  onAssignValue: (
    rowId: string,
    summaryId: string,
    assignedValue: string
  ) => void;
  // 形式エラーの値を画面で修正したときの反映（原本は保持し差分として記録する）
  onCorrectDetail: (
    rowId: string,
    detailId: string,
    field: string,
    corrected: string
  ) => void;
}

export default function BillingEdiDetail({
  rows,
  selectedId,
  onBack,
  onReimportSummary,
  onAssignValue,
  onCorrectDetail,
}: BillingEdiDetailProps) {
  // 表示対象の行。選択IDがあればそれを rows から引き直す（再取込後も表示を最新に保つ）。
  // 選択が無い場合（メニューから直接開いた場合）はエラーを持つ最初の行、
  // 無ければ先頭行を既定表示とする。
  const source = useMemo(() => {
    const selected = selectedId
      ? rows.find((r) => r.id === selectedId)
      : undefined;
    return selected ?? rows.find((r) => r.errorSummaries.length > 0) ?? rows[0];
  }, [rows, selectedId]);

  // エラーサマリの内訳。区分ごとの件数と、解消すると直る明細の総数を出す。
  // 1明細に複数のエラーが付くことがあるため、エラー明細件数の合計は基本情報の
  // 「エラー事業所数」とは数える単位が違う。
  const errorSummaryTotals = useMemo(() => {
    const summaries = source.errorSummaries;
    return {
      conversion: summaries.filter((e) => e.category === '変換マスタ未登録')
        .length,
      format: summaries.filter((e) => e.category === 'データ不正').length,
      targetTotal: summaries.reduce(
        (sum, e) => sum + targetCountOf(source.details, e),
        0
      ),
    };
  }, [source.errorSummaries, source.details]);

  // 再取込の対象としてチェックしたエラーサマリ（決定18：複数選択してまとめて実行する）
  const [selectedForReimport, setSelectedForReimport] = useState<
    BillingEdiErrorSummary[]
  >([]);
  // 再取込確認ダイアログの開閉
  const [isReimportOpen, setIsReimportOpen] = useState(false);

  // エラーサマリで選択中の1件。選択すると請求EDI明細をその対象明細だけに絞り込む
  const [selectedSummary, setSelectedSummary] =
    useState<BillingEdiErrorSummary | null>(null);

  // 「未実施・未解消のみ表示」。対応が要るエラーに絞って見られるよう初期値はON。
  // 解消済みは履歴としてデータに残し、OFFにすれば表示する
  const [isResolvedHidden, setIsResolvedHidden] = useState(true);

  // 絞り込み中のエラーが非表示になった場合（解消済みを隠したとき）は、
  // 見えない行で請求EDI明細が絞られたままにならないよう絞り込みを外して扱う
  const visibleSelectedSummary = useMemo(() => {
    if (!selectedSummary || !isResolvedHidden) return selectedSummary;
    const current = source.errorSummaries.find(
      (e) => e.id === selectedSummary.id
    );
    return current?.resolveState === '解消' ? null : selectedSummary;
  }, [selectedSummary, isResolvedHidden, source.errorSummaries]);

  // 「エラーサマリ」カードの高さ（ドラッグで拡縮。集計ペインと同じ構成）。
  // 画面のいちばん下の「請求EDI明細」は画面いっぱいの高さ（viewportGridHeight。UX-099）
  const errorSummaryResize = useResizableHeight({
    defaultHeight: 240,
    minHeight: 150,
    maxHeight: 500,
  });

  // 形式エラーの値を画面で修正したときの処理。
  // 変換エラー（マスタ未登録）はマスタを直して再取込するため、この画面では修正しない（決定4）。
  const handleCorrectDetail = (
    detailId: string,
    field: string,
    corrected: string
  ) => {
    onCorrectDetail(source.id, detailId, field, corrected);
    toast.success(
      `「${field}」を修正しました。原本の連携値は保持し、修正前後を差分として記録します。`
    );
  };

  // 再取込の実行。チェックしたエラーサマリをまとめて再取込する（決定18）。
  // 同一の変換エラーが多数の明細に及ぶため、1件ずつ実行するのは負担が大きい。
  // 取込はオンラインのため、押した時点で結果（解消／未解消）が確定する。
  const handleConfirmReimport = () => {
    if (selectedForReimport.length === 0) return;
    // TODO: 再取込APIを呼び出す
    selectedForReimport.forEach((summary) =>
      onReimportSummary(source.id, summary.id)
    );
    toast.success(`${selectedForReimport.length} 件のエラーを再取込しました。`);
    setIsReimportOpen(false);
  };

  // 再取込の確認文言。選択したエラーの区分に応じて、事前に何を済ませておくべきかを示す。
  //   形式エラー（データ不正）… 請求EDI明細のセルで値を修正済みか
  //   変換エラー             … 変換マスタを修正済みか、「変換後の値」を登録済みか
  const reimportConfirmMessage = useMemo(() => {
    if (selectedForReimport.length === 0) return '';
    const detailCount = selectedForReimport.reduce(
      (sum, summary) => sum + targetCountOf(source.details, summary),
      0
    );
    const hasCorrectable = selectedForReimport.some((s) => s.correctable);
    const hasConversion = selectedForReimport.some((s) => !s.correctable);
    const notes: string[] = [];
    if (hasConversion) {
      notes.push(
        '変換マスタを修正済みか、「変換後の値」を登録済みであることを確認してください。'
      );
    }
    if (hasCorrectable) {
      notes.push(
        '請求EDI明細で値を修正済みであることを確認してください。原本の連携値は保持し、修正前後を差分として記録します。'
      );
    }
    return `選択した ${selectedForReimport.length} 件のエラー（エラー明細件数 ${detailCount} 件）を再取込します。${notes.join('')}よろしいですか？`;
  }, [selectedForReimport, source.details]);

  // 「変換後の値」をエラーサマリのセルで登録したときの処理
  const handleAssign = (summaryId: string, assignedValue: string) => {
    onAssignValue(source.id, summaryId, assignedValue);
  };

  return (
    <div className="min-w-300">
      <div className="px-6 pt-3 pb-3">
        {/* 画面名はヘッダー（システム名の右）に表示する */}
        <ScreenTitle title="請求EDI取込結果詳細" />

        {/* 基本情報（振替詳細と同じ5列グリッド構成。カテゴリごとに横並び） */}
        <CollapsibleCard title="基本情報">
          <div className="p-4">
            <BasicInfo row={source} />
          </div>
        </CollapsibleCard>

        {/* エラーサマリ（同じ原因の明細をまとめた作業単位）。変換エラーと形式エラーを区分で分ける */}
        <CollapsibleCard
          title={
            <span className="flex items-baseline gap-3">
              <span>エラーサマリ</span>
              <span className="text-sm font-normal text-gray-500">
                変換マスタ未登録 {errorSummaryTotals.conversion} 件 / データ不正{' '}
                {errorSummaryTotals.format} 件 / エラー明細件数{' '}
                {errorSummaryTotals.targetTotal} 件
              </span>
            </span>
          }
          headerActions={
            // 状態が未実施・未解消の行だけに絞る（解消済みを隠す）表示切替
            <div className="flex items-center gap-2">
              <Checkbox
                id="error-summary-hide-resolved"
                checked={isResolvedHidden}
                onCheckedChange={(checked) =>
                  setIsResolvedHidden(checked === true)
                }
              />
              <Label
                htmlFor="error-summary-hide-resolved"
                className="cursor-pointer text-sm font-normal whitespace-nowrap"
              >
                未実施・未解消のみ表示
              </Label>
            </div>
          }
        >
          <div className="p-2">
            <div
              className="flex flex-col"
              style={{ height: errorSummaryResize.height }}
            >
              <ErrorList
                rowData={source.errorSummaries}
                details={source.details}
                onSelectionChange={setSelectedForReimport}
                onAssign={handleAssign}
                onSelect={setSelectedSummary}
                selectedId={visibleSelectedSummary?.id ?? null}
                hideResolved={isResolvedHidden}
              />
            </div>
            {/* リサイズハンドルはAG Gridの外（表の下端）に配置し、集計ペインと統一する */}
            <div className="relative h-2">
              <ResizeHandle onMouseDown={errorSummaryResize.handleMouseDown} />
            </div>
          </div>
        </CollapsibleCard>

        {/* 請求EDI明細（参照専用）。決定6により集約せず1行単位で表示する */}
        <CollapsibleCard title="請求EDI明細">
          <div className="p-2">
            {/* 画面のいちばん下の表は、画面いっぱいの高さにする（UX-099 → 05「画面いっぱいのグリッド」）。
                最下部までスクロールした状態で表が画面にちょうど収まる高さ。下端のバーで高さは変えない */}
            <div
              className="flex flex-col"
              style={{
                height: viewportGridHeight(DETAIL_GRID_OFFSET_REM),
                minHeight: '25rem',
              }}
            >
              <BillingDetailList
                rowData={source.details}
                onCorrect={handleCorrectDetail}
                filterSummary={visibleSelectedSummary}
                onClearFilter={() => setSelectedSummary(null)}
              />
            </div>
          </div>
        </CollapsibleCard>
      </div>

      {/* フッター（他画面と同じ sticky。画面から抜ける操作と実行操作を置く） */}
      <div
        data-screen-footer
        className="bg-white border-t border-gray-200 px-6 py-2 sticky bottom-0 z-10 mt-4 min-w-300"
      >
        {/* 「一覧へ戻る」は左端、実行操作は右端（振替詳細のフッターと同じ配置）。
            再取込はエラーサマリ（変換後の値）と請求EDI明細（値の修正）の両方の修正を反映し、
            結果も両エリアと基本情報に出る画面全体の操作のため、特定のエリアではなくフッターに置く。 */}
        <div className="flex flex-wrap gap-3 justify-between">
          <div>
            <button
              className="btn-action-base btn-action-outline"
              onClick={onBack}
              aria-label="一覧へ戻る"
            >
              <ArrowLeft className="h-4 w-4" />
              一覧へ戻る
            </button>
          </div>
          <div className="flex items-center gap-3">
            {/* 対象はエラーサマリでチェックした行（決定18）。1件も選んでいなければ非活性 */}
            <button
              type="button"
              onClick={() => setIsReimportOpen(true)}
              disabled={selectedForReimport.length === 0}
              className="btn-action-base btn-action-blue"
              aria-label="選択したエラーを再取込"
            >
              <RotateCcw className="h-4 w-4" />
              選択したエラーを再取込
              {selectedForReimport.length > 0
                ? `（${selectedForReimport.length} 件）`
                : ''}
            </button>
          </div>
        </div>
      </div>

      {/* 再取込確認ダイアログ。値の登録はGrid（形式＝請求EDI明細のセル／変換＝エラーサマリの
          「変換後の値」）で行うため、ダイアログは実行確認のみを担う。 */}
      <ConfirmDialog
        open={isReimportOpen}
        onOpenChange={setIsReimportOpen}
        title="確認"
        description={reimportConfirmMessage}
        confirmLabel="再取込"
        onConfirm={handleConfirmReimport}
      />
    </div>
  );
}
