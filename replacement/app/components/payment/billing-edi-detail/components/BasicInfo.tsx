import { CheckCircle, AlertTriangle } from 'lucide-react';

import {
  FIT_CELL_CLASS,
  FIT_GRID_CLASS,
  FIT_LABEL_CLASS,
  FIT_ROW_CLASS,
} from '@/styles/commonStyles';
import { valueOrEmpty } from '@/app/components/ui/empty-value';
import type {
  BillingEdiImportRow,
  BillingEdiStatus,
} from '@/app/types/billingEdi';
import {
  countErrorOffices,
  formatPayeeName,
  formatRowOwners,
  formatSummaryCategories,
  latestReimportedAt,
  oldestReceivedAt,
} from '@/app/utils/payment/billing/billingEdiImport';

// ステータスごとのアイコン・色設定（一覧のステータス列と同じ表現に揃える）
const STATUS_CONFIG: Record<
  BillingEdiStatus,
  { icon: typeof CheckCircle; className: string }
> = {
  正常: { icon: CheckCircle, className: 'text-green-600' },
  エラー: { icon: AlertTriangle, className: 'text-red-600' },
};

// ラベル＋値の1項目（項目名の列はその列で一番長い項目名の幅 FIT_LABEL_CLASS）。値が無いときはグレーの「-」
const InfoItem = ({ label, value }: { label: string; value: string }) => (
  <div className={FIT_CELL_CLASS}>
    <label className={FIT_LABEL_CLASS}>{label}</label>
    <span className="flex h-8 min-w-0 items-center text-sm text-gray-900">
      {valueOrEmpty(value)}
    </span>
  </div>
);

interface BasicInfoProps {
  row: BillingEdiImportRow;
}

export function BasicInfo({ row }: BasicInfoProps) {
  const statusConfig = STATUS_CONFIG[row.status];
  const StatusIcon = statusConfig.icon;
  const errorOfficeCount = countErrorOffices(row);

  return (
    // 対象／件数／担当・再取込／ステータス の4行に横並びにし、行間を下ボーダーで区切る
    // （5列。「再取込日時（最新）」が 5.625rem に収まらないため、項目名の列をその列で一番長い項目名の幅に
    // 合わせる並び FIT_GRID_CLASS。各行は subgrid で列を受け継ぐ → 05「ラベルが幅に収まらない画面」）。
    // 件数以外の項目は遷移元の請求EDI取込一覧グリッドと同じ並びにそろえている
    <div className={FIT_GRID_CLASS}>
      {/* 対象 */}
      <div
        className={`${FIT_ROW_CLASS} mb-2.5 pb-2.5 border-b border-gray-300`}
      >
        {/* 請求元企業は提供企業名（1-17）の連携値をそのまま表示する（変換しない）。
            請求元(変換前)は請求EDI取込一覧から削除したことに合わせ、本画面からも外した */}
        <InfoItem label="請求元企業" value={formatPayeeName(row)} />
        {/* 受信日時は明細の最も古い値、再取込日時は最も新しい値を出す。
            明細を持たない行（ファイル単位のエラー）は一覧の値をそのまま使う */}
        <InfoItem
          label="受信日時"
          value={oldestReceivedAt(row.details) || row.receivedAt}
        />
        <InfoItem
          label="再取込日時（最新）"
          value={latestReimportedAt(row.details) || row.reimportedAt}
        />
      </div>

      {/* 件数（決定16で削除したのは請求EDI取込一覧のグリッド列であり、
          請求EDI取込結果詳細では取込分の規模が分かるよう残す） */}
      <div
        className={`${FIT_ROW_CLASS} mb-2.5 pb-2.5 border-b border-gray-300`}
      >
        <InfoItem
          label="請求書数"
          value={`${row.counts.invoices.toLocaleString()} 件`}
        />
        <InfoItem
          label="伝票数"
          value={`${row.counts.slips.toLocaleString()} 件`}
        />
        <InfoItem
          label="明細数"
          value={`${row.counts.details.toLocaleString()} 件`}
        />
      </div>

      {/* 担当（再取込未実施／再取込後 未解消の2件数は、知りたいのは残りのエラー件数で
          エラー事業所数が現時点の件数を表すため削除した
          → 一覧 4.レイアウト AK89 スレッド 加藤 2026-09-14） */}
      <div
        className={`${FIT_ROW_CLASS} mb-2.5 pb-2.5 border-b border-gray-300`}
      >
        {/* エラー種別ごとの対応部署（決定10）。一覧と同じくマスタの値をそのまま出す。
            値は人ではなく部署のため「担当者」から改称した
            （→ 4.レイアウト AK59 スレッド 芳賀 2026-10-11） */}
        <InfoItem label="対応部署" value={formatRowOwners(row)} />
      </div>

      {/* ステータス（最終行・下ボーダーなし） */}
      <div className={`${FIT_ROW_CLASS} mb-2`}>
        <div className={FIT_CELL_CLASS}>
          <label className={FIT_LABEL_CLASS}>ステータス</label>
          <span className="flex h-8 min-w-0 items-center gap-1 text-sm text-gray-900">
            <StatusIcon className={`h-5 w-5 ${statusConfig.className}`} />
            {row.status}
          </span>
        </div>
        {/* 誰が対応するかを判断するための種別。エラーサマリの「区分」を並べる */}
        <InfoItem
          label="エラー種別"
          value={formatSummaryCategories(row.errorSummaries)}
        />
        {/* 取込可否は請求元事業所単位で決まるため、明細単位ではなく
            エラーになっている請求元事業所の数を出す（決定14・16。一覧と同じ数え方） */}
        <InfoItem
          label="エラー事業所数"
          value={errorOfficeCount ? `${errorOfficeCount} 件` : ''}
        />
        {/* 対応状況（トグル）は廃止した。エラーは解消まで日次で通知され、一次対応も
            AIC が担うため、着手の有無を画面で持つ必要がない
            （→ 4.レイアウト AJ45 スレッド 加藤 2026-10-13） */}
      </div>
    </div>
  );
}
