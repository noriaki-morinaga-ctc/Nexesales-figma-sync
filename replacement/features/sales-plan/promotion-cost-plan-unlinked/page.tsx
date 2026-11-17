// 販売計画表(商流紐づけなし)
// 販売計画(詳細)タブは廃止し、拡売費計画のみをカードで表示する。
// サブコンポーネント（検索・拡売費・参照）とモックデータは本画面専用
// （PromotionCostPlanUnlinked* / mockData）として保持し、
// 卸(NET固定)系モジュール（PlanDetailNetFixed* ／ src/mocks/sales-plan/plan-detail-net-fixed）には依存しない。
// ※拡売費グリッド本体は共通の NonProductExpensePane を利用する。
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Save,
  Send,
  Check,
  Undo2,
  Copy,
  CornerUpLeft,
  ArrowLeft,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CURRENT_USER_NAME } from '@/mocks/common/planBasicInfo';
import { addMonths } from '@/utils/common/yearMonth';
import { SearchPane } from './components/SearchPane';
import {
  NonProductExpensePane,
  type NonProductExpenseData,
  type NonProductExpenseGridHandle,
} from './components/NonProductExpensePane';
import { RightPane } from '@/components/ui/right-pane';
import { CommentHistoryPane } from '@/components/shared/common/CommentHistoryPane';
import { Label } from '@/components/ui/label';
import { RequiredBadge } from '@/components/ui/required-badge';
import { ExpenseBlockFields } from '@/features/sales-plan/shared/common/ExpenseBlockFields';
import { BottomPane } from '@/components/ui/bottom-pane';
import { ReferenceTable } from './components/ReferenceTable';
import { SingleCombobox } from '@/components/ui/single-combobox';
import { COMMENT_HISTORY_DATA } from '@/mocks/sales-plan/promotion-cost-plan-unlinked';
import { EMPTY_EXPENSE_FORM } from '@/constants/nonProductExpenseForm';
import type { ExpenseFormValues } from '@/types/nonProductExpense';
import { DEFAULT_META_BRAND } from '@/constants/nonProductExpenseForm';
import {
  expenseMissingFields,
  toExpenseForm,
  fromExpenseForm,
} from '@/utils/common/nonProductExpenseForm';
import { hasSummaryProduct } from '@/utils/sales-plan/plan-detail/nonProductExpenseRow';
import { productCodeFromValue } from '@/utils/common/comboFieldOptions';
import { expenseSummaryProductOptionCode } from '@/utils/common/summaryProductSearch';
import {
  META_BRAND_MASTER,
  EXPENSE_SUMMARY_PRODUCT_OPTIONS,
} from '@/constants/productMasters';
import { ScreenTitle } from '@/components/ui/screen-title';
import {
  PlanReferencePeriodField,
  usePlanReferencePeriod,
} from '@/features/sales-plan/shared/plan-detail/PlanReferenceTable';
import { FooterCommentField } from '@/components/shared/common/FooterCommentField';

// 未入力の必須項目名を列挙してトースト文言にする。
const requiredMsg = (fields: string[]): string =>
  `${fields.join('・')}を入力してください。`;
// 拡売費フォームのヘルパー（expenseMissingFields・toExpenseForm・fromExpenseForm）は
// 共通モジュール utils/common/nonProductExpenseForm に集約（単一ソース）。

export default function PromotionCostPlanUnlinked() {
  // 画面移動（戻る）の確認ダイアログ表示状態
  const [isBackConfirmShown, setIsBackConfirmShown] = useState(false);
  // フッターのコメント入力（差戻し理由など）
  const [commentInput, setCommentInput] = useState('');
  const [isCommentHistoryPaneShown, setIsCommentHistoryPaneShown] =
    useState(false);
  // 拡売費グリッドへの行操作ハンドル（追加/コピー/編集/削除を反映）
  const expenseGridRef = useRef<NonProductExpenseGridHandle>(null);

  // 拡売費追加・編集・コピーフォーム
  const [addExpenseForm, setAddExpenseForm] =
    useState<ExpenseFormValues>(EMPTY_EXPENSE_FORM);
  const [isAddExpenseSubmitted, setIsAddExpenseSubmitted] = useState(false);
  // 拡売費 各ペインの「新商品のみ表示」絞り込み状態
  const [isAddExpenseOnlyNew, setIsAddExpenseOnlyNew] = useState(false);

  // 拡売費系右ペインの状態管理
  const [isAddExpensePaneShown, setIsAddExpensePaneShown] = useState(false);
  const [pendingCopyExpenseRow, setPendingCopyExpenseRow] =
    useState<NonProductExpenseData | null>(null);

  // 対象年月（基本情報の検索条件）。コピー元の下ペインの対象期間と共有する。
  const [targetYearMonth, setTargetYearMonth] = useState('2025/10');
  // 拡売費計画(コピー元)の対象年月（下ペインの見出しの行で選ぶ）
  const [referencePeriod, setReferencePeriod] =
    usePlanReferencePeriod(targetYearMonth);

  // 拡売費「参照用」下ペインの状態管理
  const [isReferencePaneShown, setIsReferencePaneShown] = useState(false);
  // 参照表のコピーボタンで取り込む行（拡売費計画の最下行へ入れる）
  const [pendingReferenceCopyRows, setPendingReferenceCopyRows] = useState<
    NonProductExpenseData[] | null
  >(null);

  // コピー元ペインを展開したら、拡売費計画（コピー先）の表の見出しが画面内スクロール領域の
  // 先頭（ヘッダーメニュー直下）へ来るようスクロールする。scrollIntoView は main/ドキュメント
  // まで動かして sticky ヘッダーの表示を乱すため使わず、最も近いスクロール可能な祖先だけを動かす。
  useEffect(() => {
    if (!isReferencePaneShown) return;
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
  }, [isReferencePaneShown]);

  // すべての右ペインを閉じるヘルパー関数
  const closeAllRightPanes = () => {
    setIsCommentHistoryPaneShown(false);
    setIsAddExpensePaneShown(false);
    setIsReferencePaneShown(false);
  };

  // ペイン元のボタン/リンクを押下するたびに開閉を切り替えるヘルパー
  // 既に開いている場合は全ペインを閉じ、閉じている場合は対象ペインのみ開く
  const togglePane = (isOpen: boolean, openFn: () => void) => {
    closeAllRightPanes();
    if (!isOpen) openFn();
  };

  // 拡売費追加ペインを開く
  const handleOpenAddExpense = () => {
    const isOpen = isAddExpensePaneShown;
    closeAllRightPanes();
    if (isOpen) return;
    // メタブランドの初期値は空欄（課題0946：商流販売店に紐づかない計画は空欄）
    setAddExpenseForm({ ...EMPTY_EXPENSE_FORM });
    setIsAddExpenseSubmitted(false);
    setIsAddExpenseOnlyNew(false);
    setIsAddExpensePaneShown(true);
  };

  // 拡売費追加ペインの追加実行。
  // continuous=true（連続追加）はペインを開いたままフォームを初期化し、
  // false（追加）は他ペインと同様にペインを閉じる。
  const handleAddExpenseSubmit = (continuous: boolean) => {
    setIsAddExpenseSubmitted(true);
    const missing = expenseMissingFields(addExpenseForm, {
      metaBrandRequired: true,
    });
    if (missing.length) {
      toast.error(requiredMsg(missing));
      return;
    }
    // 最下行に追加（→ 02 §8「行の追加位置」・UX-112）
    expenseGridRef.current?.addRow(
      fromExpenseForm(addExpenseForm, CURRENT_USER_NAME)
    );
    setAddExpenseForm({ ...EMPTY_EXPENSE_FORM });
    setIsAddExpenseSubmitted(false);
    if (!continuous) setIsAddExpensePaneShown(false);
    toast.success('拡売費を追加しました。');
  };

  // 拡売費コピー：ペインを開かず、拡売費計画グリッドのコピー元の行のすぐ下へ直接行を複製する。
  // 前年実績は引き継がず（削除可）、作成者はログインユーザーになる（fromExpenseForm）。
  const handleCopyExpenseRow = (data: NonProductExpenseData) => {
    // コピー元の行（data.no）のすぐ下に入れる（→ 02 §8「行の追加位置」・UX-112）
    expenseGridRef.current?.addRow(
      {
        ...fromExpenseForm(toExpenseForm(data), CURRENT_USER_NAME),
        _copySource: 'detail',
      },
      data.no
    );
    toast.success('拡売費計画へコピーしました。');
  };

  // 拡売費を削除する（確認は出さず、削除したことをトーストで知らせる → 02 §5）
  const handleDeleteExpense = (data: NonProductExpenseData) => {
    if (data?.no != null) expenseGridRef.current?.deleteRow(data.no);
    toast.success('拡売費を削除しました。');
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-gray-100">
      {/* 左ペイン：メインコンテンツ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* スクロール可能エリア */}
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <div className="min-w-300">
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
                  onDeleteExpense={handleDeleteExpense}
                  onOpenCopyExpense={handleCopyExpenseRow}
                  pendingCopyRow={pendingCopyExpenseRow}
                  onCopyComplete={() => setPendingCopyExpenseRow(null)}
                  onOpenReference={() =>
                    togglePane(isReferencePaneShown, () =>
                      setIsReferencePaneShown(true)
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
          collapsed={!isReferencePaneShown}
          onCollapsedChange={(next) => setIsReferencePaneShown(!next)}
          onClose={() => setIsReferencePaneShown(false)}
          prominentTab
          collapsedTabLabel="過去の拡売費計画からコピー"
          collapsedTabIcon={<Copy className="h-4 w-4" />}
          title="拡売費計画(コピー元)"
          titleExtra={
            <PlanReferencePeriodField
              value={referencePeriod}
              onChange={setReferencePeriod}
            />
          }
          description="コピーボタン、または行のダブルクリックで拡売費計画へ追加できます"
        >
          <ReferenceTable
            period={referencePeriod}
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
              <button
                type="button"
                className="btn-action-base btn-action-outline"
                onClick={() => setIsBackConfirmShown(true)}
              >
                <ArrowLeft className="h-4 w-4" />
                一覧へ戻る
              </button>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
              {/* コメント欄（支払詳細(追加口請求書有)と同一の複数行テキストエリア） */}
              <FooterCommentField
                id="sales-plan-no-link-comment"
                value={commentInput}
                onChange={setCommentInput}
                onOpenHistory={() =>
                  togglePane(isCommentHistoryPaneShown, () =>
                    setIsCommentHistoryPaneShown(true)
                  )
                }
              />
              <button
                type="button"
                className="btn-action-base btn-action-red"
                onClick={() => toast.success('差し戻しました。')}
              >
                <Undo2 className="h-4 w-4" />
                差戻し
              </button>
              <button
                type="button"
                className="btn-action-base btn-action-green"
                onClick={() => toast.success('承認しました。')}
              >
                <Check className="h-4 w-4" />
                承認
              </button>
              <button
                type="button"
                className="btn-action-base btn-action-outline-blue"
                onClick={() => toast.success('計画を引き戻しました。')}
              >
                <CornerUpLeft className="h-4 w-4" />
                引戻し
              </button>
              <button
                type="button"
                className="btn-action-base btn-action-green"
                onClick={() => toast.success('計画承認申請を送信しました。')}
              >
                <Send className="h-4 w-4" />
                申請
              </button>
              <button
                type="button"
                className="btn-action-base btn-action-blue"
                onClick={() => {
                  // 保存したら拡売費計画の帯（コピー・追加由来）と編集セルの強調を消す
                  expenseGridRef.current?.clearSavedMarks?.();
                  toast.success('販売計画を保存しました。');
                }}
              >
                <Save className="h-4 w-4" />
                保存
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 右ペイン：拡売費追加 */}
      <RightPane
        open={isAddExpensePaneShown}
        onClose={() => setIsAddExpensePaneShown(false)}
        title="拡売費追加"
        description="拡売費を追加します"
        footer={
          <div className="flex items-center justify-end gap-3">
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
          const sub = isAddExpenseSubmitted;
          const onlyNew = isAddExpenseOnlyNew;
          const setOnlyNew = setIsAddExpenseOnlyNew;
          const onlyNewId = 'add-expense-only-new';
          return (
            <div className="space-y-3">
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
                    ariaRequired
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

      {/* 右ペイン：コメント履歴（共通部品。操作名とその後のステータスを分けて出す → 02 §6） */}
      <CommentHistoryPane
        open={isCommentHistoryPaneShown}
        onClose={() => setIsCommentHistoryPaneShown(false)}
        items={COMMENT_HISTORY_DATA}
      />

      {/* 戻る（画面移動）の確認: 入力中データの破棄を確認する */}
      <ConfirmDialog
        open={isBackConfirmShown}
        title="画面移動の確認"
        confirmLabel="移動"
        description="入力中のデータが破棄されます。本当によろしいですか？"
        onConfirm={() => setIsBackConfirmShown(false)}
        onCancel={() => setIsBackConfirmShown(false)}
      />
    </div>
  );
}
