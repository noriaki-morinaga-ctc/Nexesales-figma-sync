// 計画詳細(マージン率固定)：明細の上の帯（補足8-7 図1-1・1-2。UI は議論中のため、いったん図のとおり）。
// ・直前の突合があれば「突合しました。…［取消］」（図1-2）
// ・未突合があれば、未突合の案内と「選択解除」「選択した2行を突合」（図1-1）

import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { BUTTON_BASE, BUTTON_STYLES } from '@/styles/commonStyles';

import type { LastEdiMatch } from '@/features/sales-plan/plan-detail-margin-rate-fixed/useEdiMatching';

interface EdiMatchBannerProps {
  // 未突合の実販EDIの件数
  unmatchedCount: number;
  // 明細表で選択中の行の数
  selectedCount: number;
  // 直前の突合（無ければ突合の帯を出さない）
  lastMatch: LastEdiMatch | null;
  onClearSelection: () => void;
  onMatchSelected: () => void;
  // 帯の［取消］（確認ダイアログを出す）
  onCancelLastMatch: () => void;
}

export function EdiMatchBanner({
  unmatchedCount,
  selectedCount,
  lastMatch,
  onClearSelection,
  onMatchSelected,
  onCancelLastMatch,
}: EdiMatchBannerProps) {
  return (
    <>
      {lastMatch && (
        <Alert className="mt-2 border-emerald-300 bg-emerald-50 py-2 text-emerald-900">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="text-emerald-900">
            <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-bold">突合しました。</span>
              <span>
                {lastMatch.summaryProduct}／計画{lastMatch.planPrice}円 ⇔ EDI
                {lastMatch.ediPrice}円（差 {lastMatch.diff}
                ）。誤りがあれば行頭の「取消」で戻せます。
              </span>
              <button
                type="button"
                onClick={onCancelLastMatch}
                className={`${BUTTON_STYLES.cancel} ${BUTTON_BASE} ml-auto px-3 py-1 whitespace-nowrap text-sm`}
              >
                取消
              </button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      {unmatchedCount > 0 && (
        <UnmatchedBanner
          unmatchedCount={unmatchedCount}
          selectedCount={selectedCount}
          onClearSelection={onClearSelection}
          onMatchSelected={onMatchSelected}
        />
      )}
    </>
  );
}

interface UnmatchedBannerProps {
  unmatchedCount: number;
  selectedCount: number;
  onClearSelection: () => void;
  onMatchSelected: () => void;
}

function UnmatchedBanner({
  unmatchedCount,
  selectedCount,
  onClearSelection,
  onMatchSelected,
}: UnmatchedBannerProps) {
  // 突合は計画行1行とEDI行1行の2行を選んだときだけ押せる（組み合わせの誤りは押したときに知らせる）
  const isMatchDisabled = selectedCount !== 2;
  const isClearDisabled = selectedCount === 0;
  return (
    <Alert className="mt-2 border-amber-300 bg-amber-50 py-2 text-amber-800">
      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      <AlertDescription className="text-amber-800">
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-bold">
            実販EDIの未突合が{unmatchedCount}件あります。
          </span>
          <span>
            EDI行を計画行へドラッグするか、計画行1行とEDI行1行を選んで「選択した2行を突合」を押してください。突合しないまま保存すると、計画納価が空欄の明細として追加されます。
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClearSelection}
              disabled={isClearDisabled}
              className={`${
                isClearDisabled ? BUTTON_STYLES.disabled : BUTTON_STYLES.cancel
              } ${BUTTON_BASE} px-3 py-1 whitespace-nowrap text-sm`}
            >
              選択解除
            </button>
            <button
              type="button"
              onClick={onMatchSelected}
              disabled={isMatchDisabled}
              className={`${
                isMatchDisabled ? BUTTON_STYLES.disabled : BUTTON_STYLES.outline
              } ${BUTTON_BASE} px-3 py-1 whitespace-nowrap text-sm`}
            >
              選択した2行を突合
            </button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
