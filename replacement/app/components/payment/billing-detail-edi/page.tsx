// 請求詳細(請求EDI) ─ 課題891/893
// 請求EDIで受信した請求書1件分の内容を確認する画面。
// データ種別ごとに画面を分け、AICが入力した入力単位は請求詳細(AIC入力)で扱う。
// 請求EDIで取り込んだ明細は本画面では修正できず、誤りがあった場合は支払詳細画面で
// 修正する（→ 20260821_第31回 決定事項13）。そのため明細はすべて参照表示になる。
// 構成は支払詳細(追加口請求書有)（PaymentDetailWithInvoice）に準拠し、基本情報 → 確定（検印）後金額 → 請求明細 → フッターの縦積み。
// 明細の列構成は「シングル画面案.xlsx ⑤-１請求・支払反映画面」に準拠する（→ DetailTable）。
import { useEffect, useState } from 'react';
import { Undo2, Save, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog';
import { BillingBasicInfoPane } from '@/app/components/shared/payment/billing/BillingBasicInfoPane';
import { DetailTable } from './components/DetailTable';
import {
  BILLING_DETAIL_BY_DATA_SOURCE,
  BILLING_LIST,
} from '@/mocks/common/billing';
import { isBillingDetailStatusLocked } from '@/app/utils/payment/billing/billing';
import type { BillingDetailRow, BillingRow } from '@/app/types/billing';
import { ScreenTitle } from '@/app/components/ui/screen-title';

interface BillingDetailEdiProps {
  // 請求一覧で選択された入力単位（請求EDI取込分）。
  // メニューから直接開いた場合は既定の入力単位を表示する
  entry?: BillingRow;
  onBack?: () => void;
}

// メニューから直接開いた場合の既定表示（請求EDI取込の入力単位）
const DEFAULT_ENTRY =
  BILLING_LIST.find((row) => row.dataSource === 'EDI') ?? BILLING_LIST[0];

// 明細の初期表示。請求EDI取込のモック明細を、直接書き換えないよう複製して読み込む
// （モックは入力単位ごとではなくデータ種別ごとに1組だけ持つ）。
// 請求EDI取込分は夜間バッチで自動作成されるため、本画面に新規作成は無い。
const loadDetailRows = (): BillingDetailRow[] =>
  BILLING_DETAIL_BY_DATA_SOURCE['EDI'].map((row) => ({
    ...row,
  }));

export default function BillingDetailEdi({
  entry,
  onBack,
}: BillingDetailEdiProps) {
  const targetEntry = entry ?? DEFAULT_ENTRY;
  // 基本情報は請求EDIの受信内容がそのまま入るため、すべて参照表示にする
  const [entryDraft, setEntryDraft] = useState<BillingRow>(targetEntry);
  // 明細行。参照専用だが、グリッドの内部状態を入力画面と揃えるため state で保持する
  const [rows, setRows] = useState<BillingDetailRow[]>(() => loadDetailRows());
  // セル編集による値変更の通知カウンタ（合計サマリーバーの再計算トリガー）。
  // 値そのものは参照せず、再レンダーを起こすためだけに保持する。
  const [, setValueVersion] = useState(0);
  // 「一覧へ戻る」の確認ダイアログの表示状態（計画詳細(NET固定)と同一文言）
  const [isBackOpen, setIsBackOpen] = useState(false);

  // 表示対象の入力単位が変わったら基本情報と明細を読み直す
  useEffect(() => {
    setEntryDraft(targetEntry);
    setRows(loadDetailRows());
    setValueVersion(0);
  }, [targetEntry]);

  // 入力状況＝反映済（支払画面へ反映済の請求書）は参照専用。
  const readOnly = entryDraft.status === '反映済';

  // 明細が全て支払処理まで進んでいる（支払画面反映済／支払処理申請中／支払処理検印済）入力単位は、
  // 請求側で操作できることが無くなるためフッターの操作ボタン（支払画面へ反映・保存）を
  // 非活性にする。「一覧へ戻る」は画面から抜ける手段のため常に活性のままとする。
  // ステータスは支払側で更新される参照専用の値のため、画面の編集では変わらない。
  const isAllReflected =
    rows.length > 0 &&
    rows.every((row) => isBillingDetailStatusLocked(row.status));

  // 一覧へ戻る：計画詳細(NET固定)と同様、入力中データの破棄を確認してから遷移する
  const handleBack = () => {
    setIsBackOpen(false);
    onBack?.();
  };

  return (
    <div className="min-w-300 h-full flex flex-col">
      <div className="px-6 pt-3 pb-3 flex-1 min-h-0 flex flex-col">
        {/* 画面名はヘッダー（システム名の右）に表示する（データ種別は基本情報で示すため、画面名には付けない。
            ヘッダーメニューのみ「請求詳細(請求EDI)」と区別して表記する） */}
        <ScreenTitle title="請求詳細" />

        {/* 基本情報（請求EDIの受信内容のため参照表示のみ） */}
        <BillingBasicInfoPane entry={entryDraft} />

        {/* 確定（検印）後金額は独立したエリアを設けず、請求明細の合計サマリーバーへまとめる
            （→ 20260821_第31回 決定事項20）。 */}

        {/* 請求明細 */}
        <DetailTable
          rows={rows}
          onRowsChange={setRows}
          onValueChange={() => setValueVersion((prev) => prev + 1)}
          readOnly={readOnly}
        />
      </div>

      {/* フッターエリア（固定） */}
      <div
        data-screen-footer
        className="bg-white border-t border-gray-200 px-6 py-2 sticky bottom-0 z-10 mt-4 min-w-300"
      >
        <div className="flex flex-wrap gap-3 justify-between">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setIsBackOpen(true)}
              className="btn-action-base btn-action-outline"
              aria-label="一覧へ戻る"
            >
              <Undo2 className="h-4 w-4" />
              一覧へ戻る
            </button>
            {/* 削除：請求EDIで連携された入力単位は削除できない（決定25）。
                画面内の操作ボタンは表示したまま非活性にする全画面共通の整理（5/22 第5回）に
                合わせ、請求詳細(AIC入力)と同じ位置に常に非活性で置き、理由を表示する。 */}
            <button
              disabled
              className="btn-action-base btn-action-red"
              aria-label="削除"
              title="請求EDIで連携されたデータは削除できません"
            >
              <Trash2 className="h-4 w-4" />
              削除
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* PPT 業務フロー To-Be ①②：入力内容を対象商流販売店の支払画面へ反映する */}
            <button
              onClick={() => toast.success('支払画面へ反映しました')}
              disabled={readOnly || isAllReflected}
              className="btn-action-base btn-action-green"
              aria-label="支払画面へ反映"
            >
              <Check className="h-4 w-4" />
              支払画面へ反映
            </button>
            <button
              onClick={() => toast.success('入力内容を保存しました')}
              disabled={readOnly || isAllReflected}
              className="btn-action-base btn-action-blue"
              aria-label="保存"
            >
              <Save className="h-4 w-4" />
              保存
            </button>
          </div>
        </div>
      </div>

      {/* 「一覧へ戻る」の確認ダイアログ（計画詳細(NET固定)と同一文言） */}
      <ConfirmDialog
        open={isBackOpen}
        onOpenChange={setIsBackOpen}
        title="画面移動の確認"
        confirmLabel="移動"
        description="入力中のデータが破棄されます。本当によろしいですか？"
        onConfirm={handleBack}
      />
    </div>
  );
}
