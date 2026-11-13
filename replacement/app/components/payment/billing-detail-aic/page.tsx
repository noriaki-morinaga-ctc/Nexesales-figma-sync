// 請求詳細(AIC入力) ─ 課題891/893
// AIC（情報センター）が卸の請求書1件分の内容を入力する画面。
// データ種別ごとに画面を分け、請求EDIで取り込んだ入力単位は請求詳細(請求EDI)で扱う。
// 本画面は AIC入力の入力単位専用のため、明細はすべて画面で入力・修正できる。
// 構成は支払詳細(追加口請求書有)（PaymentDetailWithInvoice）に準拠し、基本情報 → 確定（検印）後金額 → 請求明細 → フッターの縦積み。
// 明細の列構成は「シングル画面案.xlsx ⑤-１請求・支払反映画面」に準拠する（→ DetailTable）。
import { useEffect, useState } from 'react';
import { Undo2, Save, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { BUTTON_STYLES } from '@/styles/commonStyles';
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog';
import { BillingBasicInfoPane } from '@/app/components/shared/payment/billing/BillingBasicInfoPane';
import { DetailTable } from './components/DetailTable';
import {
  BILLING_DETAIL_BY_DATA_SOURCE,
  BILLING_LIST,
} from '@/mocks/common/billing';
import { NEW_BILLING_ID } from '@/app/constants/billing';
import {
  createEmptyBillingDetailRows,
  isBillingDetailStatusLocked,
} from '@/app/utils/payment/billing/billing';
import type { BillingDetailRow, BillingRow } from '@/app/types/billing';
import { ScreenTitle } from '@/app/components/ui/screen-title';

interface BillingDetailAicProps {
  // 請求一覧で選択された入力単位（AIC入力分）。
  // メニューから直接開いた場合は既定の入力単位を表示する
  entry?: BillingRow;
  onBack?: () => void;
}

// メニューから直接開いた場合の既定表示（AIC入力の入力単位）
const DEFAULT_ENTRY =
  BILLING_LIST.find((row) => row.dataSource === 'AIC入力') ?? BILLING_LIST[0];

// 明細の初期表示。新規作成はまとめて入力できるよう空行を並べ、
// 既存の入力単位は AIC入力のモック明細を、直接書き換えないよう複製して読み込む
// （モックは入力単位ごとではなくデータ種別ごとに1組だけ持つ）。
const loadDetailRows = (entry: BillingRow): BillingDetailRow[] =>
  entry.id === NEW_BILLING_ID
    ? createEmptyBillingDetailRows()
    : BILLING_DETAIL_BY_DATA_SOURCE['AIC入力'].map((row) => ({
        ...row,
      }));

export default function BillingDetailAic({
  entry,
  onBack,
}: BillingDetailAicProps) {
  const targetEntry = entry ?? DEFAULT_ENTRY;
  // 新規作成の入力単位は基本情報の請求元企業事業所名を入力できる。
  // 請求元企業は AIC入力分では特定できないため入力欄を設けず、対象年月は入力単位のキーから
  // 外れたため項目自体を持たない（決定24／20260818_第30回 宿題事項15。→ BasicInfoPane）。
  // 明細グリッドは既存の入力単位と同じ DetailTable を使う（空行が並ぶだけで挙動は同じ）。
  const isNewEntry = targetEntry.id === NEW_BILLING_ID;
  // 基本情報の編集内容。新規作成時のみ画面で書き換わる
  const [entryDraft, setEntryDraft] = useState<BillingRow>(targetEntry);
  // 明細行。セル編集では参照を変えず、行の増減時のみ差し替える（Undo維持。→ 02 §7.1）
  const [rows, setRows] = useState<BillingDetailRow[]>(() =>
    loadDetailRows(targetEntry)
  );
  // セル編集による値変更の通知カウンタ（合計サマリーバーの再計算トリガー）。
  // 値そのものは参照せず、再レンダーを起こすためだけに保持する。
  const [, setValueVersion] = useState(0);
  // 「一覧へ戻る」の確認ダイアログの表示状態（計画詳細(NET固定)と同一文言）
  const [isBackOpen, setIsBackOpen] = useState(false);
  // 削除の確認ダイアログの表示状態（AIC入力の入力単位のみ。決定25）
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // 表示対象の入力単位が変わったら基本情報と明細を読み直す
  useEffect(() => {
    setEntryDraft(targetEntry);
    setRows(loadDetailRows(targetEntry));
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

  // 削除：誤って作成した AIC 入力の入力単位を消して一覧へ戻る（決定25）
  const handleDelete = () => {
    setIsDeleteOpen(false);
    toast.success('入力単位を削除しました。');
    onBack?.();
  };

  return (
    <div className="min-w-300 h-full flex flex-col">
      <div className="px-6 pt-3 pb-3 flex-1 min-h-0 flex flex-col">
        {/* 画面名はヘッダー（システム名の右）に表示する（データ種別は基本情報で示すため、画面名には付けない。
            ヘッダーメニューのみ「請求詳細(AIC入力)」と区別して表記する） */}
        <ScreenTitle title="請求詳細" />

        {/* 基本情報（新規作成時のみ入力可） */}
        <BillingBasicInfoPane
          entry={entryDraft}
          editable={isNewEntry}
          onChange={(patch) => setEntryDraft((prev) => ({ ...prev, ...patch }))}
        />

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
            {/* 削除：AIC入力で誤って作成した入力単位を消す（決定25）。
                活性は入力状況＝入力中のみ。反映済は表示したまま非活性にする。
                請求詳細(請求EDI)には常に非活性で置く。 */}
            <button
              onClick={() => setIsDeleteOpen(true)}
              disabled={entryDraft.status !== '入力中'}
              className="btn-action-base btn-action-red"
              aria-label="削除"
              title={
                entryDraft.status === '入力中'
                  ? undefined
                  : '反映済のため削除できません'
              }
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

      {/* 削除の確認ダイアログ（AIC入力の入力単位のみ。決定25） */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="削除の確認"
        description="この入力単位と、含まれる明細をすべて削除します。元に戻せません。よろしいですか？"
        confirmLabel="削除"
        confirmClassName={BUTTON_STYLES.delete}
        onConfirm={handleDelete}
      />

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
