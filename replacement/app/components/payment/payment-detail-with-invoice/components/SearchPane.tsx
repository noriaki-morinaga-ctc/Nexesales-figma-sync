// Todo：朴：C追加口・拡売費支払モック修正中
import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { CollapsibleCard } from '../../../ui/collapsible-card';
import { Button } from '../../../ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from '../../../ui/alert-dialog';
import { SplitTransferMarks } from '../../../shared/PaymentStatusIcons';
import { joinCodeName } from '../../../../utils/nameCode';

// 基本情報の項目値（モック）。費用分割の分割元情報など、他画面から参照するため export する。
// コード付き項目は joinCodeName で「コード:名称」に揃える（支払詳細(自販機)と同じ表記）。
export const BASIC_INFO = {
  targetMonth: '2025年10月', // 対象年月
  paymentStatementNo: 'C2400NTO3', // 支払No（支払No.タブ見出しと同じ値）
  primaryStore: joinCodeName('10888030', '三菱食品株式会社（イオン）'), // 一次店
  tertiaryStore: joinCodeName('10863223', 'イオン東北ＲＤＣ'), // 三次店
  store: joinCodeName('21100677', 'イオンリテール'), // 販売店
  office: joinCodeName('10000623', '首都圏本部'), // 事業場
  dept: joinCodeName('10002990', '首都圏営業第二部'), // 部署
  // 営業担当者（複数。カンマ区切り）
  staff: [
    joinCodeName('5172733', 'アサヒ　太郎'),
    joinCodeName('5172734', 'アサヒ　花子'),
  ].join(','),
  // 末端組織＝拡売費計画を担当する組織。本支払は代行入力ではないため部署と同値
  terminalOrg: joinCodeName('10002990', '首都圏営業第二部'),
  // 申請者・申請日は支払回ごとの情報のため、支払情報エリア（PaymentDetailPane）へ移動。
  // 分割・振替有無。本支払は分割済み。振替は検印後にしか行えず、
  // 本画面のステータスは検印済でない（承認待ち）ため振替は発生しない。
  isSplit: true,
  isTransfer: false,
} as const;

// 販売計画書No のリンク先（大本の販売計画書を表示する計画詳細）。
// 本画面の拡売費は計画詳細(マージン率固定・NET入力)の拡売費計画にそろえているため、
// その計画詳細へ遷移する。
const PLAN_DETAIL_MENU_ID = 'plan-detail-margin-rate-fixed';

interface SearchPaneProps {
  // 画面切替（販売計画書No リンクから計画詳細へ遷移する）。
  onMenuChange?: (menuId: string) => void;
}

export function SearchPane({ onMenuChange }: SearchPaneProps) {
  // 基本情報の折り畳み状態（既定は展開）
  const [isBasicInfoOpen, setIsBasicInfoOpen] = useState(true);
  // 販売計画書No リンク押下後の画面遷移の確認ダイアログの表示状態。
  const [isPlanNavigationOpen, setIsPlanNavigationOpen] = useState(false);

  // 確認ダイアログの「はい」→ 計画詳細へ遷移する（支払詳細(自販機)と同じ）。
  const handlePlanNavigationConfirm = () => {
    setIsPlanNavigationOpen(false);
    onMenuChange?.(PLAN_DETAIL_MENU_ID);
  };

  // 販売計画書No（先頭を表示値とする）
  const planNoList = [
    'D2420TK08',
    'D2420TK09',
    'D2420TK10',
    'D2421TK01',
    'D2421TK02',
  ];

  // ヘッダー項目（テキストラベル）の共通描画。
  // 値はアイコン等も置けるよう ReactNode で受ける。
  const renderLabelField = (label: string, value: ReactNode) => (
    <div className="flex items-center gap-2">
      <label className="text-sm text-blue-900 whitespace-nowrap font-bold w-36 text-right">
        {label}
      </label>
      <span className="h-8 flex items-center text-sm text-gray-900">
        {value}
      </span>
    </div>
  );

  return (
    <>
      {/* 基本情報エリア（支払詳細(その他)と同じ折り畳みカード） */}
      <CollapsibleCard
        title="基本情報"
        open={isBasicInfoOpen}
        onOpenChange={setIsBasicInfoOpen}
      >
        <div className="p-4">
          {/* 1行目: 対象年月 / 販売計画書No / 支払No / 分割・振替有無 */}
          <div className="grid grid-cols-4 gap-3 mb-2 items-center pb-3 border-b border-gray-300">
            {renderLabelField('対象年月', BASIC_INFO.targetMonth)}
            {/* 販売計画書No は計画詳細へのリンク（支払詳細(自販機)と同じ）。URL 遷移ではなく
                onMenuChange による画面切替のため、Button の link バリアントで表現する。
                余白は他のヘッダー項目の値と左端をそろえるため 0 にする。 */}
            {renderLabelField(
              '販売計画書No',
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => setIsPlanNavigationOpen(true)}
                aria-label={`販売計画書No ${planNoList[0]} の計画詳細を開く`}
              >
                {planNoList[0]}
              </Button>
            )}
            {renderLabelField('支払No', BASIC_INFO.paymentStatementNo)}
            {renderLabelField(
              '分割・振替有無',
              <SplitTransferMarks
                isSplit={BASIC_INFO.isSplit}
                isTransfer={BASIC_INFO.isTransfer}
              />
            )}
          </div>

          {/* 2行目: 販売店 / 三次店 / 一次店 */}
          <div className="grid grid-cols-4 gap-3 mb-2 pb-3 border-b border-gray-300">
            {renderLabelField('販売店', BASIC_INFO.store)}
            {renderLabelField('三次店', BASIC_INFO.tertiaryStore)}
            {renderLabelField('一次店', BASIC_INFO.primaryStore)}
            <div />
          </div>

          {/* 3行目: 事業場 / 部署 / 末端組織 / 営業担当者
              （基本情報の最終行・下ボーダーなし）。申請側の組織は支払情報エリアに持ち、
              「申請」を冠して区別する（→ 20260804_第26回 決定事項18／課題 No.0956）。 */}
          <div className="grid grid-cols-4 gap-3 mb-2">
            {renderLabelField('事業場', BASIC_INFO.office)}
            {renderLabelField('部署', BASIC_INFO.dept)}
            {renderLabelField('末端組織', BASIC_INFO.terminalOrg)}
            {renderLabelField('営業担当者', BASIC_INFO.staff)}
          </div>
        </div>
      </CollapsibleCard>

      {/* 販売計画書No リンクの画面遷移の確認ダイアログ（支払詳細(自販機)と同じ体裁・文言）。 */}
      <AlertDialog
        open={isPlanNavigationOpen}
        onOpenChange={setIsPlanNavigationOpen}
      >
        <AlertDialogContent>
          {/* ×ボタン */}
          <button
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
            onClick={() => setIsPlanNavigationOpen(false)}
            aria-label="閉じる"
          >
            <X className="size-6" />
            <span className="sr-only">Close</span>
          </button>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-gray-900">
              画面遷移の確認
            </AlertDialogTitle>
            <AlertDialogDescription>
              計画詳細(マージン率固定・NET入力)画面へ遷移します。編集中の内容は保存されません。よろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
              onClick={handlePlanNavigationConfirm}
            >
              移動
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
