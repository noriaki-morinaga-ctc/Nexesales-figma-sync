// 販売計画表(商流紐づけなし)
// 販売計画(詳細)タブは廃止し、拡売費計画のみをカードで表示する。
// サブコンポーネント（検索・拡売費・参照）とモックデータは本画面専用
// （PromotionCostPlanUnlinked* / salesPlanNoLinkMockData）として保持し、
// 卸(NET固定)系モジュール（PlanDetailNetFixed* / salesPlanWholesaleMockData）には依存しない。
// ※拡売費グリッド本体は共通の NonProductExpensePane を利用する。
import { useState, useRef, useEffect } from 'react';
import { Button } from '../../ui/button';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { Save, Send, Check, Undo2, Copy, CornerUpLeft } from 'lucide-react';
import { CURRENT_USER_NAME } from '../../../constants/planBasicInfoMockData';
import { addMonths } from '../../../utils/yearMonth';
import { SearchPane } from './components/SearchPane';
import {
  NonProductExpensePane,
  type NonProductExpenseData,
  type NonProductExpenseGridHandle,
} from './components/NonProductExpensePane';
import { RightPane } from '../../ui/right-pane';
import { DeleteConfirmPane } from '../../ui/delete-confirm-pane';
import { expenseDeleteItems } from '../../../constants/planDeleteItems';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Label } from '../../ui/label';
import { RequiredBadge } from '../../ui/required-badge';
import { ExpenseBlockFields } from '../../shared/ExpenseBlockFields';
import { ApproverSelect } from '../../shared/ApproverSelect';
import { Textarea } from '../../ui/textarea';
import { BottomPane } from '../../ui/bottom-pane';
import { ReferenceTable } from './components/ReferenceTable';
import { SingleCombobox } from '../../ui/single-combobox';
import {
  COMMENT_HISTORY_DATA,
  EMPTY_EXPENSE_FORM,
  type ExpenseFormValues,
} from '../../../constants/salesPlanNoLinkMockData';
import {
  DEFAULT_META_BRAND,
  expenseMissingFields,
  fromExpenseForm,
  toExpenseForm,
} from '../../../constants/nonProductExpenseForm';
import { hasSummaryProduct } from '../../../constants/nonProductExpenseTypes';
import { productCodeFromValue } from '../../../constants/comboFieldOptions';
import { expenseSummaryProductOptionCode } from '../../../utils/summaryProductSearch';
import {
  META_BRAND_MASTER,
  EXPENSE_SUMMARY_PRODUCT_OPTIONS,
} from '../../../constants/productMasters';
import { BUTTON_STYLES, BUTTON_BASE } from '../../../../styles/commonStyles';
import { ScreenTitle } from '../../ui/screen-title';

// 未入力の必須項目名を列挙してトースト文言にする。
const requiredMsg = (fields: string[]): string =>
  `${fields.join('・')}を入力してください。`;
// 拡売費フォームのヘルパー（expenseMissingFields・toExpenseForm・fromExpenseForm）は
// 共通モジュール ../constants/nonProductExpenseForm に集約（単一ソース）。

export default function PromotionCostPlanUnlinked() {
  // 画面移動（戻る）の確認ダイアログ表示状態
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  // フッターのコメント入力（差戻し理由など）
  const [commentInput, setCommentInput] = useState('');
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showCommentHistoryPane, setShowCommentHistoryPane] = useState(false);
  // 拡売費グリッドへの行操作ハンドル（追加/コピー/編集/削除を反映）
  const expenseGridRef = useRef<NonProductExpenseGridHandle>(null);

  // 拡売費追加・編集・コピーフォーム
  const [addExpenseForm, setAddExpenseForm] =
    useState<ExpenseFormValues>(EMPTY_EXPENSE_FORM);
  const [addExpenseSubmitted, setAddExpenseSubmitted] = useState(false);
  // 拡売費 各ペインの「新商品のみ表示」絞り込み状態
  const [addExpenseOnlyNew, setAddExpenseOnlyNew] = useState(false);

  // 拡売費系右ペインの状態管理
  const [showAddExpensePane, setShowAddExpensePane] = useState(false);
  const [showDeleteExpensePane, setShowDeleteExpensePane] = useState(false);
  const [expenseData, setExpenseData] = useState<NonProductExpenseData | null>(
    null
  );
  const [pendingCopyExpenseRow, setPendingCopyExpenseRow] =
    useState<NonProductExpenseData | null>(null);

  // 対象年月（基本情報の検索条件）。コピー元の下ペインの対象期間と共有する。
  const [targetYearMonth, setTargetYearMonth] = useState('2025/10');

  // 拡売費「参照用」下ペインの状態管理
  const [showReferencePane, setShowReferencePane] = useState(false);
  // 参照表のコピーボタンで取り込む行（拡売費計画の合計行直下へ挿入）
  const [pendingReferenceCopyRows, setPendingReferenceCopyRows] = useState<
    NonProductExpenseData[] | null
  >(null);

  // コピー元ペインを展開したら、拡売費計画（コピー先）の表の見出しが画面内スクロール領域の
  // 先頭（ヘッダーメニュー直下）へ来るようスクロールする。scrollIntoView は main/ドキュメント
  // まで動かして sticky ヘッダーの表示を乱すため使わず、最も近いスクロール可能な祖先だけを動かす。
  useEffect(() => {
    if (!showReferencePane) return;
    const id = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>('.expense-plan-grid');
      if (!el) return;
      let scroller: HTMLElement | null = el.parentElement;
      while (scroller) {
        const overflowY = window.getComputedStyle(scroller).overflowY;
        if (
          (overflowY === 'auto' || overflowY === 'scroll') &&
          scroller.scrollHeight > scroller.clientHeight
        ) {
          break;
        }
        scroller = scroller.parentElement;
      }
      if (!scroller) return;
      const delta =
        el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      scroller.scrollBy({ top: delta, behavior: 'smooth' });
    }, 350);
    return () => window.clearTimeout(id);
  }, [showReferencePane]);

  // すべての右ペインを閉じるヘルパー関数
  const closeAllRightPanes = () => {
    setShowCommentHistoryPane(false);
    setShowAddExpensePane(false);
    setShowDeleteExpensePane(false);
    setShowReferencePane(false);
  };

  // ペイン元のボタン/リンクを押下するたびに開閉を切り替えるヘルパー
  // 既に開いている場合は全ペインを閉じ、閉じている場合は対象ペインのみ開く
  const togglePane = (isOpen: boolean, openFn: () => void) => {
    closeAllRightPanes();
    if (!isOpen) openFn();
  };

  // 拡売費追加ペインを開く
  const handleOpenAddExpense = () => {
    const isOpen = showAddExpensePane;
    closeAllRightPanes();
    if (isOpen) return;
    // メタブランドの初期値は空欄（課題0946：商流販売店に紐づかない計画は空欄）
    setAddExpenseForm({ ...EMPTY_EXPENSE_FORM });
    setAddExpenseSubmitted(false);
    setAddExpenseOnlyNew(false);
    setShowAddExpensePane(true);
  };

  // 拡売費追加ペインの追加実行。
  // continuous=true（連続追加）はペインを開いたままフォームを初期化し、
  // false（追加）は他ペインと同様にペインを閉じる。
  const handleAddExpenseSubmit = (continuous: boolean) => {
    setAddExpenseSubmitted(true);
    const missing = expenseMissingFields(addExpenseForm, {
      metaBrandRequired: true,
    });
    if (missing.length) {
      toast.error(requiredMsg(missing));
      return;
    }
    // 合計行の直下に追加
    expenseGridRef.current?.addRow(fromExpenseForm(addExpenseForm));
    setAddExpenseForm({ ...EMPTY_EXPENSE_FORM });
    setAddExpenseSubmitted(false);
    if (!continuous) setShowAddExpensePane(false);
    toast.success('拡売費を追加しました。');
  };

  // 拡売費コピー：ペインを開かず、拡売費計画グリッドの合計行直下へ直接行を複製する。
  // 前年実績は引き継がず（削除可）、作成者はログインユーザーになる（fromExpenseForm）。
  const handleCopyExpenseRow = (data: NonProductExpenseData) => {
    expenseGridRef.current?.addRow({
      ...fromExpenseForm(toExpenseForm(data)),
      _copySource: 'detail',
    });
    toast.success('拡売費計画へコピーしました。');
  };

  // 拡売費削除ペインを開く
  const handleOpenDeleteExpense = (data: NonProductExpenseData) => {
    const isOpen = showDeleteExpensePane && expenseData === data;
    closeAllRightPanes();
    if (isOpen) return;
    setExpenseData(data);
    setShowDeleteExpensePane(true);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-gray-100">
      {/* 左ペイン：メインコンテンツ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* スクロール可能エリア */}
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <div className="min-w-[75rem]">
            <div className="px-6 pt-3 pb-2">
              {/* 画面名はヘッダー（システム名の右）に表示する */}
              <ScreenTitle title="拡売費計画(商流販売店に紐づき無し)" />

              {/* 販売計画条件エリア */}
              <section aria-labelledby="search-heading">
                <h2 id="search-heading" className="sr-only">
                  検索条件
                </h2>
                <SearchPane
                  targetYearMonth={targetYearMonth}
                  onChangeTargetYearMonth={setTargetYearMonth}
                  onStatusClick={() =>
                    togglePane(showCommentHistoryPane, () =>
                      setShowCommentHistoryPane(true)
                    )
                  }
                />
              </section>

              {/* 拡売費計画（タブ廃止・カード表示） */}
              <section className="mb-4" aria-labelledby="expense-heading">
                <h2 id="expense-heading" className="sr-only">
                  拡売費計画
                </h2>
                <NonProductExpensePane
                  ref={expenseGridRef}
                  onOpenAddExpense={handleOpenAddExpense}
                  onOpenDeleteExpense={handleOpenDeleteExpense}
                  onOpenCopyExpense={handleCopyExpenseRow}
                  pendingCopyRow={pendingCopyExpenseRow}
                  onCopyComplete={() => setPendingCopyExpenseRow(null)}
                  onOpenReference={() =>
                    togglePane(showReferencePane, () =>
                      setShowReferencePane(true)
                    )
                  }
                  pendingReferenceRows={pendingReferenceCopyRows}
                  onReferenceConsumed={() => setPendingReferenceCopyRows(null)}
                />
              </section>
            </div>
          </div>
        </div>

        {/* 拡売費「参照」下ペイン：自計画（過去12か月）を表示し、コピーボタンで拡売費計画へ追加。
            プッシュ式：親画面に被さらず中身を押し上げるため、参照表と拡売費計画を同時に視認できる。 */}
        <BottomPane
          open
          collapsed={!showReferencePane}
          onCollapsedChange={(next) => setShowReferencePane(!next)}
          onClose={() => setShowReferencePane(false)}
          prominentTab
          collapsedTabLabel="過去の拡売費計画からコピー"
          collapsedTabIcon={<Copy className="h-4 w-4" />}
          title="拡売費計画(コピー元)"
          description="コピーボタン、または行のダブルクリックで拡売費計画へ追加できます"
        >
          <ReferenceTable
            targetMonth={targetYearMonth}
            onCopyRow={(row) => {
              // 取り込んだ行は当計画の新規行。前年実績は持たず（削除可）、
              // 計上年月は基本情報の対象年月の翌月、作成者はログインユーザー。
              setPendingReferenceCopyRows([
                {
                  ...row,
                  isTotal: false,
                  exp1PriorYearActual: null,
                  exp1PostingMonth: addMonths(targetYearMonth, 1),
                  exp1Creator: CURRENT_USER_NAME,
                },
              ]);
              toast.success('参照表からコピーしました。');
            }}
          />
        </BottomPane>

        {/* アクションボタン。data-screen-footer は下ペインが上へドックする目印で、
            下ペイン表示中もこのバーは画面最下部に表示されたままになる。 */}
        <div
          data-screen-footer
          className="bg-white border-t border-gray-200 px-6 py-2 flex-shrink-0"
        >
          <div className="flex flex-wrap gap-3 justify-between">
            <div>
              <Button
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50 h-9 rounded-lg"
                onClick={() => setShowBackConfirm(true)}
              >
                <Undo2 className="h-4 w-4 mr-2" />
                一覧へ戻る
              </Button>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
              {/* コメント欄（支払詳細(追加口請求書有)と同一の複数行テキストエリア） */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <label
                  htmlFor="sales-plan-no-link-comment"
                  className="text-sm text-gray-700 whitespace-nowrap font-medium"
                >
                  コメント
                </label>
                <textarea
                  id="sales-plan-no-link-comment"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="コメントを入力(差戻し理由など)"
                  rows={2}
                  className="h-10 w-full min-w-[10rem] max-w-[32rem] border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
                />
              </div>
              <Button
                className={`${BUTTON_STYLES.delete} ${BUTTON_BASE} py-6`}
                onClick={() => toast.success('差し戻しました。')}
              >
                <CornerUpLeft className="h-4 w-4 mr-2" />
                差戻し
              </Button>
              <Button
                className={`${BUTTON_STYLES.approve} ${BUTTON_BASE} py-6`}
                onClick={() => toast.success('承認しました。')}
              >
                <Check className="h-4 w-4 mr-2" />
                承認
              </Button>
              <Button
                className={`${BUTTON_STYLES.withdraw} ${BUTTON_BASE} py-6`}
                onClick={() => toast.success('計画を引き戻しました。')}
              >
                <CornerUpLeft className="h-4 w-4 mr-2" />
                引戻し
              </Button>
              <Button
                className={`${BUTTON_STYLES.approve} ${BUTTON_BASE} py-6`}
                onClick={() => toast.success('計画承認申請を送信しました。')}
              >
                <Send className="h-4 w-4 mr-2" />
                申請
              </Button>
              <Button
                className={`${BUTTON_STYLES.primary} ${BUTTON_BASE} py-6`}
                onClick={() => {
                  // 保存したら拡売費計画の帯（コピー・追加由来）と編集セルの強調を消す
                  expenseGridRef.current?.clearSavedMarks?.();
                  toast.success('販売計画を保存しました。');
                }}
              >
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
            </div>
          </div>
        </div>

        {/* 計画保存ダイアログ */}
        <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>計画保存</DialogTitle>
              <DialogDescription>販売計画を保存します。</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              販売計画を保存しますがよろしいですか？
            </div>
            <DialogFooter>
              <Button
                className={`${BUTTON_STYLES.primary} ${BUTTON_BASE} py-6`}
                onClick={() => setShowRegisterDialog(false)}
              >
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 計画承認申請ダイアログ */}
        <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>計画承認申請</DialogTitle>
              <DialogDescription>
                販売計画の承認を申請します。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  月次販売計画書No
                </Label>
                <div className="col-span-3 text-sm">SP-2025-10-001</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">対象年月</Label>
                <div className="col-span-3 text-sm">2025年10月</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  申請担当者
                </Label>
                <div className="col-span-3 text-sm">アサヒ　太郎</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  承認担当者
                </Label>
                <ApproverSelect className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">申請備考</Label>
                <Textarea
                  className="col-span-3 bg-white"
                  placeholder="備考を入力してください"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                className={`${BUTTON_STYLES.approve} ${BUTTON_BASE} py-6`}
                onClick={() => setShowApprovalDialog(false)}
              >
                <Send className="h-4 w-4 mr-2" />
                計画承認申請
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 計画引戻しダイアログ */}
        <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>計画引戻し</DialogTitle>
              <DialogDescription>
                申請した販売計画を引き戻します。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  月次販売計画書No
                </Label>
                <div className="col-span-3 text-sm">SP-2025-10-001</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">対象年月</Label>
                <div className="col-span-3 text-sm">2025年10月</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  申請担当者
                </Label>
                <div className="col-span-3 text-sm">アサヒ　太郎</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  承認担当者
                </Label>
                <div className="col-span-3 text-sm">アサヒ　早苗</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">申請備考</Label>
                <div className="col-span-3 text-sm">10月の販売計画</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  引戻し理由
                </Label>
                <Textarea
                  className="col-span-3 bg-white"
                  placeholder="引戻し理由を入力してください"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                className={`${BUTTON_STYLES.approve} ${BUTTON_BASE} py-6`}
                onClick={() => setShowWithdrawDialog(false)}
              >
                <CornerUpLeft className="h-4 w-4 mr-2" />
                計画引戻し
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 計画承認ダイアログ */}
        <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>計画承認</DialogTitle>
              <DialogDescription>販売計画を承認します。</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  月次販売計画書No
                </Label>
                <div className="col-span-3 text-sm">SP-2025-10-001</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">対象年月</Label>
                <div className="col-span-3 text-sm">2025年10月</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  申請担当者
                </Label>
                <div className="col-span-3 text-sm">アサヒ　太郎</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  承認担当者
                </Label>
                <div className="col-span-3 text-sm">アサヒ　早苗</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">申請備考</Label>
                <div className="col-span-3 text-sm">10月の販売計画</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">承認備考</Label>
                <Textarea
                  className="col-span-3 bg-white"
                  placeholder="承認備考を入力してください"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                className={`${BUTTON_STYLES.approve} ${BUTTON_BASE} py-6`}
                onClick={() => setShowApproveDialog(false)}
              >
                <Check className="h-4 w-4 mr-2" />
                承認
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 計画差戻しダイアログ */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>計画差戻し</DialogTitle>
              <DialogDescription>販売計画を差し戻します。</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  月次販売計画書No
                </Label>
                <div className="col-span-3 text-sm">SP-2025-10-001</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">対象年月</Label>
                <div className="col-span-3 text-sm">2025年10月</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  申請担当者
                </Label>
                <div className="col-span-3 text-sm">アサヒ　太郎</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  承認担当者
                </Label>
                <div className="col-span-3 text-sm">アサヒ　早苗</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">申請備考</Label>
                <div className="col-span-3 text-sm">10月の販売計画</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap">
                  差戻し理由
                </Label>
                <Textarea
                  className="col-span-3 bg-white"
                  placeholder="差戻し理由を入力してください"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                className={`${BUTTON_STYLES.delete} ${BUTTON_BASE} py-6`}
                onClick={() => setShowRejectDialog(false)}
              >
                <CornerUpLeft className="h-4 w-4 mr-2" />
                差戻し
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 右ペイン：拡売費追加 */}
      <RightPane
        open={showAddExpensePane}
        onClose={() => setShowAddExpensePane(false)}
        title="拡売費追加"
        description="拡売費を追加します"
        footer={
          <div className="flex items-center justify-end gap-[0.75rem]">
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => handleAddExpenseSubmit(true)}
            >
              連続追加
            </Button>
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => handleAddExpenseSubmit(false)}
            >
              追加
            </Button>
          </div>
        }
      >
        {(() => {
          const f = addExpenseForm;
          const setF = setAddExpenseForm;
          const sub = addExpenseSubmitted;
          const onlyNew = addExpenseOnlyNew;
          const setOnlyNew = setAddExpenseOnlyNew;
          const onlyNewId = 'add-expense-only-new';
          return (
            <div className="space-y-4">
              {/* サマリ商品名 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  サマリ商品名
                </Label>
                <SingleCombobox
                  options={EXPENSE_SUMMARY_PRODUCT_OPTIONS.filter(
                    (o) => o.value === f.summaryProduct || !onlyNew || o.isNew
                  )
                    .filter(
                      (o) =>
                        o.value === f.summaryProduct ||
                        (o.value !== '-' &&
                          // ブランド横断(全商品)は絞り込まず全商品を出す。
                          (!f.metaBrand ||
                            f.metaBrand === DEFAULT_META_BRAND ||
                            o.metaBrand === f.metaBrand))
                    )
                    .map((o) => ({
                      value: o.value,
                      label: o.label ?? o.value,
                      // 明細追加ペインと同じく、サマリ商品コードでも検索できるよう2行目の先頭にコードを表示する
                      code: expenseSummaryProductOptionCode(
                        productCodeFromValue(o.value),
                        o.metaBrand,
                        o.containerCapacityG
                      ),
                      badge: o.isNew ? 'NEW' : undefined,
                    }))}
                  value={f.summaryProduct}
                  onChange={(v) => {
                    const opt = EXPENSE_SUMMARY_PRODUCT_OPTIONS.find(
                      (o) => o.value === v
                    );
                    setF((prev) => ({
                      ...prev,
                      summaryProduct: v,
                      metaBrand:
                        opt && v !== '-'
                          ? opt.metaBrand
                          : v === '-'
                            ? ''
                            : prev.metaBrand,
                    }));
                  }}
                  placeholder="サマリ商品名を選択（任意）"
                  clearable
                />
              </div>

              {/* メタブランド（必須。初期値は空欄） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  メタブランド <RequiredBadge />
                </Label>
                <div
                  className={
                    sub && !f.metaBrand.trim()
                      ? 'rounded-md ring-1 ring-red-500'
                      : ''
                  }
                >
                  {/* サマリ商品名の選択中はサマリ商品名から決まるメタブランドを変更させない
                      （サマリ商品名をクリアすると再び選択できる） */}
                  <SingleCombobox
                    options={META_BRAND_MASTER.map((b) => ({
                      value: b.value,
                      label: b.name,
                      code: b.code,
                    }))}
                    value={f.metaBrand}
                    onChange={(v) => setF((p) => ({ ...p, metaBrand: v }))}
                    placeholder="メタブランドを選択"
                    clearable
                    disabled={hasSummaryProduct(f)}
                  />
                </div>
              </div>

              {/* 新商品のみ表示 */}
              <div className="flex items-center gap-2">
                <input
                  id={onlyNewId}
                  type="checkbox"
                  checked={onlyNew}
                  onChange={(e) => setOnlyNew(e.target.checked)}
                />
                <Label htmlFor={onlyNewId}>新商品のみ表示</Label>
              </div>

              {/* 拡売費（計画金額～摘要1） */}
              <div className="border-t border-gray-200 pt-3">
                <ExpenseBlockFields
                  prefix="exp1"
                  form={f}
                  setForm={setF}
                  submitted={sub}
                  campaignRequired={false}
                  required
                />
              </div>
            </div>
          );
        })()}
      </RightPane>

      {/* 右ペイン：拡売費削除確認（共通部品 DeleteConfirmPane）。
          削除対象を特定できるよう、拡売費グリッドと同じ並びで
          メタブランド～摘要1(社内用)に作成者を加えて並べる。 */}
      <DeleteConfirmPane
        open={showDeleteExpensePane}
        onClose={() => setShowDeleteExpensePane(false)}
        title="拡売費削除"
        description="拡売費を削除します"
        items={expenseDeleteItems(expenseData, { showCreator: true })}
        onDelete={() => {
          // 対象行をグリッドから削除
          if (expenseData?.no != null) {
            expenseGridRef.current?.deleteRow(expenseData.no);
          }
          setShowDeleteExpensePane(false);
          toast.success('拡売費を削除しました。');
        }}
      />

      {/* 右ペイン：コメント履歴 */}
      <RightPane
        open={showCommentHistoryPane}
        onClose={() => setShowCommentHistoryPane(false)}
        title="コメント履歴"
        description=""
      >
        <div className="space-y-3">
          {COMMENT_HISTORY_DATA.map((item, index) => (
            <div
              key={index}
              className="bg-gray-50 p-4 rounded-lg space-y-2 border border-gray-200"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900">
                  {item.actionType}
                </span>
                <span className="text-sm text-gray-600">{item.datetime}</span>
                <span className="text-sm text-gray-900">{item.userName}</span>
              </div>
              {item.comment && (
                <div className="text-sm text-gray-700 bg-white p-2 rounded border border-gray-200">
                  {item.comment}
                </div>
              )}
            </div>
          ))}
        </div>
      </RightPane>

      {/* 戻る（画面移動）の確認: 入力中データの破棄を確認する */}
      <ConfirmDialog
        open={showBackConfirm}
        title="画面移動の確認"
        confirmLabel="移動"
        description="入力中のデータが破棄されます。本当によろしいですか？"
        onConfirm={() => setShowBackConfirm(false)}
        onCancel={() => setShowBackConfirm(false)}
      />
    </div>
  );
}
