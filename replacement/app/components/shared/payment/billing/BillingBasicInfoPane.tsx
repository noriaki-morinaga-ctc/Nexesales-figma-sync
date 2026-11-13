// 請求詳細：基本情報エリア
// 入力単位の属性を表示する。データ元（請求EDI／AIC入力）は入力単位の属性で、
// 同じ請求元企業事業所でも別の入力単位になる（決定23 2026-08-18）。
// 対象年月は入力単位のキーから外し、受付日時（請求EDI＝受信日時／AIC入力＝登録日時）を
// キーとする（20260818_第30回 宿題事項15）。
// 新規作成（請求一覧の「新規作成」）は AIC 入力のため、請求元企業は特定できずブランク、
// 請求元企業事業所は名称のみで識別する（決定24）。
// 既存の入力単位はキー項目のため参照表示のままとする。
// 提供企業（請求EDIレコード区分1）は参考情報として請求元企業の前に参照表示する
//（→ 20261006_第37回 決定事項2・4）。
// 1つの入力単位に複数の請求書No. が含まれるため、請求書No. は明細側で入力する。
// 体裁は支払詳細(追加口請求書有)の基本情報カード（SearchPane）に準拠する。
import { useState, type ReactNode } from 'react';
import { CollapsibleCard } from '@/app/components/ui/collapsible-card';
import { EmptyValue, valueOrEmpty } from '@/app/components/ui/empty-value';
import { Input } from '@/app/components/ui/input';
import { cn } from '@/app/components/ui/utils';
import {
  FIT_CELL_CLASS,
  FIT_GRID_CLASS,
  FIT_LABEL_CLASS,
  TEXT_INPUT_CLASS,
} from '@/styles/commonStyles';
import type { BillingRow } from '@/app/types/billing';

interface BasicInfoPaneProps {
  entry: BillingRow;
  // 新規作成時のみ入力可にする（既定は参照表示）
  editable?: boolean;
  // 入力内容の変更通知（変更のあった項目だけを渡す）
  onChange?: (patch: Partial<BillingRow>) => void;
}

export function BillingBasicInfoPane({
  entry,
  editable = false,
  onChange,
}: BasicInfoPaneProps) {
  // 基本情報の折り畳み状態（既定は展開）
  const [isBasicInfoOpen, setIsBasicInfoOpen] = useState(true);

  // ヘッダー項目の共通描画。値は参照表示のテキストも入力欄も置けるよう ReactNode で受ける。
  // rowStart：コードと名称の組を行の左端から始める（組が行をまたがないように → 05）
  const renderLabelField = (
    label: string,
    value: ReactNode,
    id?: string,
    rowStart = false
  ) => (
    <div className={cn(FIT_CELL_CLASS, rowStart && 'col-start-1')}>
      <label htmlFor={id} className={FIT_LABEL_CLASS}>
        {label}
      </label>
      <span className="h-8 min-w-0 flex items-center text-sm text-gray-900">
        {/* 値が無いときはグレーの「-」（→ 05 値が空の項目・UX-068） */}
        {valueOrEmpty(value)}
      </span>
    </div>
  );

  // 値が無い項目はグレーの「-」で表示する（共通部品 ui/empty-value）
  const dashIfEmpty = (value: string): ReactNode => valueOrEmpty(value);

  // 請求元企業名・請求元企業事業所名は「12桁コード:名称」で長くなるため、
  // 枠に収まらない場合は末尾を省略する（全文はマウスオーバーで確認できる）。
  const dashIfEmptyTruncated = (value: string): ReactNode =>
    value ? (
      <span className="block truncate" title={value}>
        {value}
      </span>
    ) : (
      <EmptyValue />
    );

  return (
    <CollapsibleCard
      title="基本情報"
      open={isBasicInfoOpen}
      onOpenChange={setIsBasicInfoOpen}
    >
      <div className="p-4">
        {/* 1行目：データ種別 / 受付日時 / 入力状況（単独の項目）
            2行目：提供企業（コード・名称）/ 請求元企業（コード・名称）
            3行目：請求元企業事業所（コード・名称）
            コードと名称の組は同じ行に置き、行をまたがせない（→ 05）。
            「請求元企業事業所コード」などが 5.625rem に収まらないため、項目名の列をその列で一番長い
            項目名の幅に合わせる並び（FIT_GRID_CLASS → 05「ラベルが幅に収まらない画面」）にする */}
        <div className={`${FIT_GRID_CLASS} mb-2 gap-y-2.5`}>
          {/* データ種別は入力単位の属性（決定23）。請求EDI分とAIC入力分は別の入力単位になる */}
          {renderLabelField(
            'データ種別',
            dashIfEmpty(entry.dataSource === 'EDI' ? '請求EDI' : 'AIC入力')
          )}
          {/* 受付日時は請求EDI＝受信日時、AIC入力＝登録日時を1項目で表す。
              名称は課題 No.1287 で決着した。取込・登録の結果として入るため参照表示 */}
          {renderLabelField('受付日時', dashIfEmpty(entry.receivedAt))}
          {/* 入力状況は明細の入力・支払反映に応じて決まるため、新規作成時も参照表示 */}
          {renderLabelField('入力状況', dashIfEmpty(entry.status))}
          {/* 提供企業（請求EDIレコード区分1）は参考情報。請求EDI取込一覧（提供企業単位）との
              つながりを示すために出す。コードは提供企業コード（提供企業事業所コードではない）。
              AIC入力分は提供企業を持たないため「-」（新規作成時も入力欄は設けない） */}
          {renderLabelField(
            '提供企業コード',
            dashIfEmpty(entry.providerCode),
            undefined,
            true
          )}
          {renderLabelField(
            '提供企業名',
            dashIfEmptyTruncated(entry.providerName)
          )}
          {/* AIC入力分は請求元企業を特定できないためブランク（決定24。入力欄も設けない）。
              コードと名称は別項目で表示する */}
          {renderLabelField(
            '請求元企業コード',
            dashIfEmpty(entry.billCompanyCode)
          )}
          {renderLabelField(
            '請求元企業名',
            dashIfEmptyTruncated(entry.billCompanyName),
            'billingCompanyName'
          )}
          {renderLabelField(
            '請求元企業事業所コード',
            dashIfEmpty(entry.billOfficeCode),
            undefined,
            true
          )}
          {/* 請求元企業事業所名は AIC入力分では名称のみで識別する（決定24） */}
          {renderLabelField(
            '請求元企業事業所名',
            editable ? (
              <Input
                id="billingOfficeName"
                value={entry.billOfficeName}
                onChange={(e) => onChange?.({ billOfficeName: e.target.value })}
                placeholder="請求元企業事業所名を入力"
                className={`${TEXT_INPUT_CLASS} w-full min-w-0`}
              />
            ) : (
              dashIfEmptyTruncated(entry.billOfficeName)
            ),
            'billingOfficeName'
          )}
        </div>
      </div>
    </CollapsibleCard>
  );
}
