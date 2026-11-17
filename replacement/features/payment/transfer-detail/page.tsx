// Todo：朴：C追加口・拡売費支払モック修正中
import React, { useState, useRef } from 'react';
import {
  Save,
  Send,
  Check,
  Undo2,
  X,
  CornerUpLeft,
  Stamp,
  ArrowLeft,
} from 'lucide-react';
import {
  TransferDetailSearch,
  type TransferDetailBasicInfoValues,
} from './components/TransferInfo';
import {
  NonProductExpensePane,
  type NonProductExpensePaneHandle,
  type ExpenseRow,
} from './components/NonProductExpensePane';
import { RightPane } from '@/components/ui/right-pane';
import { STORE_NONE } from '@/constants/storeHierarchy';
import {
  ReferenceTable,
  INITIAL_REFERENCE_ROWS,
  TRANSFER_TERMINAL_ORG_OPTIONS,
  type ReferenceRow,
} from './components/ReferenceTable';
import { ScreenTitle } from '@/components/ui/screen-title';
import { FooterCommentField } from '@/components/shared/common/FooterCommentField';

// ── モックデータ ────────────────────────────────────────────

// コメント履歴のモックデータ（支払詳細(追加口請求書有)と同形式）
const COMMENT_HISTORY_DATA = [
  {
    actionType: '承認',
    datetime: '2025/02/21 12:47:05',
    userName: '◇山　〇郎',
    comment: '',
  },
  {
    actionType: '振替申請承認',
    datetime: '2025/02/21 9:30:45',
    userName: '河〇　雅◇',
    comment: '振替先部署を首都圏営業第二部へ修正。',
  },
  {
    actionType: '保存',
    datetime: '2025/02/21 9:20:45',
    userName: '河〇　雅◇',
    comment: '振替先部署を首都圏営業第二部へ修正。',
  },
  {
    actionType: '振替差戻し',
    datetime: '2025/02/20 18:47:05',
    userName: '◇山　〇郎',
    comment: '振替先部署が誤っているため修正すること。',
  },
  {
    actionType: '振替申請',
    datetime: '2025/02/20 16:14:25',
    userName: '河〇　雅◇',
    comment: '検印済み明細より振替処理を実施。',
  },
  {
    actionType: '保存',
    datetime: '2025/02/20 15:54:45',
    userName: '河〇　雅◇',
    comment: '検印済み明細より振替処理を実施。',
  },
];

export default function TransferDetail() {
  // フッターのコメント入力（差戻し理由など。支払詳細(その他)と同様）
  const [commentInput, setCommentInput] = useState('');
  // コメント履歴（右ペイン）。基本情報のステータス横のボタンから開く。
  const [isCommentHistoryPaneShown, setIsCommentHistoryPaneShown] =
    useState(false);
  // 基本情報（TransferDetailSearch）の現在値。検印済み明細の絞り込みと、
  // 振替明細の枝番行（振替先行）の活性・初期値に使う。
  const [basicInfo, setBasicInfo] = useState<
    TransferDetailBasicInfoValues | undefined
  >(undefined);

  // 振替明細一覧（検印済み明細からの行追加）操作用
  const expenseTableRef = useRef<NonProductExpensePaneHandle>(null);

  // 検印済み明細（振替元）の行。「振替処理」で振替明細へ移動し、
  // 振替明細の「削除」で戻ってくるため、両グリッドを跨ぐ state として当画面が保持する。
  const [referenceRows, setReferenceRows] = useState<ReferenceRow[]>(
    INITIAL_REFERENCE_ROWS
  );

  // 振替明細に枝番行（振替先行）があるか。基本情報の固定指定を切り替えると
  // 枝番行の商流・組織が上書きされるため、確認ダイアログの要否判定に使う。
  const [hasBranchRows, setHasBranchRows] = useState(false);

  // 基本情報の販売店・担当末端組織がともに未選択か。未選択のときの止め方は固定する側で変える。
  // 販売店を選ばない支払（④末端組織のみに紐づく）は、担当末端組織の選択で明細を特定する。
  //   振替元を固定する … 振替元の商流販売店を1つに固定する必要があるため
  //                      （20260721_第21回_共通 決定事項1）、明細そのものを出さない。
  //   振替先を固定する … 振替元は自由に探せてよい（N対1）ため明細は出し、
  //                      振替処理の操作だけを止める。商流未選択のまま振替処理すると
  //                      枝番行の振替先が空欄かつ編集不可になるため。
  const basicStoreUnselected =
    (!basicInfo?.store || basicInfo.store === STORE_NONE) &&
    !basicInfo?.terminalOrg;
  const isSourceFixed = basicInfo?.executor === 'source';
  const hideRowsUntilStore = basicStoreUnselected && isSourceFixed;

  // 検印済み明細の現在値。振替処理はボタン押下と行のダブルクリックの双方から
  // 呼ばれ、ボタン上でダブルクリックすると短時間に複数回発火しうる。
  // state の反映を待たずに移動済みか判定できるよう ref でも保持する。
  const referenceRowsRef = useRef(referenceRows);
  referenceRowsRef.current = referenceRows;

  // 「振替処理」押下（またはダブルクリック）：当該行を検印済み明細（振替元）から
  // 取り除き、振替明細一覧の最終行として追加する。
  const handleTransferProcess = (row: ReferenceRow) => {
    // 既に移動済みの明細は無視する（同一明細の二重追加を防ぐ）。
    if (!referenceRowsRef.current.some((r) => r.no === row.no)) return;
    referenceRowsRef.current = referenceRowsRef.current.filter(
      (r) => r.no !== row.no
    );
    setReferenceRows(referenceRowsRef.current);
    expenseTableRef.current?.addTransferredRow({
      paymentNo: row.paymentNo,
      paymentCount: row.paymentCount,
      detailNo: row.detailNo,
      metaBrand: row.metaBrand,
      product: row.product,
      payAmount: row.payAmount,
      mgmtClass: row.mgmtClass,
      mgmtClassName: row.mgmtClassName,
      mgmtCode: row.mgmtCode,
      mgmtCodeName: row.mgmtCodeName,
      measureClass: row.measureClass,
      measureCode: row.measureCode,
      dept: row.dept,
      store: row.store,
      tertiaryStore: row.tertiaryStore,
      primaryStore: row.primaryStore,
      summary1: row.summary1,
      summary2: row.summary2,
      // 画面には表示しないが行データとして保持している項目。
      postingMonth: row.postingMonth,
      targetMonth: row.targetMonth,
      office: row.office,
      terminalOrg: row.terminalOrg,
      staff: row.staff,
      payee: row.payee,
    });
  };

  // 振替明細の「振替元へ戻す」押下：取り除かれた行を検印済み明細（振替元）の最終行へ戻す。
  // no は行識別用のため、既存の最大値＋1 を採番する。
  // ただし枝番行（振替先行）は振替元の明細ではないため、検印済み明細へは戻さない。
  const handleMoveRowToReference = (row: ExpenseRow) => {
    const lineNo = String(row.lineNo);
    // 枝番行（分割列＝分割先、または No. が「X-N」形式）は移動対象外。
    const isBranchRow = row.costSplit === '分割先' || /^\d+-\d+$/.test(lineNo);
    if (isBranchRow) return;
    const toNumOrZero = (v: number | string): number => {
      const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
      return Number.isFinite(n) ? n : 0;
    };
    setReferenceRows((prev) => {
      const nextNo = prev.reduce((max, r) => Math.max(max, r.no), 0) + 1;
      const moved: ReferenceRow = {
        no: nextNo,
        paymentNo: row.paymentNo,
        paymentCount: toNumOrZero(row.paymentCount),
        detailNo: toNumOrZero(row.detailNo),
        metaBrand: row.metaBrand,
        product: row.product,
        payAmount: toNumOrZero(row.payAmount),
        mgmtClass: row.mgmtClass,
        mgmtClassName: row.mgmtClassName,
        mgmtCode: row.mgmtCode,
        mgmtCodeName: row.mgmtCodeName,
        measureClass: row.measureClass,
        measureCode: row.measureCode,
        dept: row.dept,
        store: row.store,
        tertiaryStore: row.tertiaryStore,
        primaryStore: row.primaryStore,
        summary1: row.summary1,
        summary2: row.summary2,
        // 画面には表示しないが行データとして保持している項目。
        postingMonth: row.postingMonth,
        targetMonth: row.targetMonth,
        office: row.office,
        terminalOrg: row.terminalOrg,
        staff: row.staff,
        payee: row.payee,
      };
      return [...prev, moved];
    });
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
              <ScreenTitle title="振替詳細" />

              {/* 販売計画条件エリア */}
              <section aria-labelledby="search-heading">
                <h2 id="search-heading" className="sr-only">
                  検索条件
                </h2>
                {/* 基本情報の現在値（固定指定・商流・年月）を受け取り、
                    検印済み明細の絞り込みと、振替明細の枝番行の活性・初期値に使う。 */}
                <TransferDetailSearch
                  onChange={setBasicInfo}
                  hasBranchRows={hasBranchRows}
                  terminalOrgOptions={TRANSFER_TERMINAL_ORG_OPTIONS}
                />
              </section>

              {/* 検印済み明細（振替元）・振替明細（本体・常時表示）。 */}
              <div className="w-full mt-2 space-y-0">
                {/* 検印済み明細（振替元）：基本情報と振替明細の間に 1 枚のカードとして表示する。
                    「振替処理」ボタン：押下行を当グリッドから取り除き、振替明細の最終行へ移動する。
                    「振替元を固定する」のときは、基本情報の値を検索条件の初期値として反映する。 */}
                <section className="mb-4" aria-labelledby="reference-heading">
                  <h2 id="reference-heading" className="sr-only">
                    検印済み明細（振替元）
                  </h2>
                  <ReferenceTable
                    rows={referenceRows}
                    // 対象年月は固定指定にかかわらず基本情報の選択値を表示する。
                    targetMonth={basicInfo?.targetMonth}
                    basicInfo={
                      basicInfo?.executor === 'source' ? basicInfo : undefined
                    }
                    // 「振替元を固定する」では基本情報の値で絞り込むため、検索条件は非活性にする。
                    searchDisabled={basicInfo?.executor === 'source'}
                    hideRowsUntilStore={hideRowsUntilStore}
                    transferDisabled={basicStoreUnselected}
                    transferDisabledReason={
                      isSourceFixed
                        ? '基本情報で振替元の販売店または担当末端組織を選択してください'
                        : '基本情報で振替先の販売店または担当末端組織を選択してください'
                    }
                    onTransferProcess={handleTransferProcess}
                  />
                </section>

                {/* 振替明細一覧（独立カード） */}
                <section className="mb-4" aria-labelledby="expense-heading">
                  <h2 id="expense-heading" className="sr-only">
                    振替明細
                  </h2>
                  <NonProductExpensePane
                    ref={expenseTableRef}
                    onMoveRowToReference={handleMoveRowToReference}
                    // 枝番行（振替先行）の商流・組織列の活性判定と、
                    // 「振替処理」で追加する枝番行の初期値に使う。
                    basicInfo={basicInfo}
                    onBranchRowsChange={setHasBranchRows}
                  />
                </section>
              </div>
            </div>
          </div>
        </div>

        {/* フッターエリア（固定） */}
        <div
          data-screen-footer
          className="bg-white border-t border-gray-200 px-6 py-2 sticky bottom-0 z-10 mt-4 min-w-300"
        >
          <div className="flex flex-wrap gap-3 justify-between">
            <div>
              <button
                className="btn-action-base btn-action-outline"
                aria-label="一覧へ戻る"
              >
                <ArrowLeft className="h-4 w-4" />
                一覧へ戻る
              </button>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
              {/* コメント欄（支払詳細(その他)と同一の複数行テキストエリア） */}
              <FooterCommentField
                id="payment-c-comment"
                value={commentInput}
                onChange={setCommentInput}
                onOpenHistory={() =>
                  // 開くボタン再押下で閉じる（トグル）
                  setIsCommentHistoryPaneShown((prev) => !prev)
                }
              />
              <button
                className="btn-action-base btn-action-red"
                aria-label="取消し"
              >
                <X className="h-4 w-4" />
                取消し
              </button>
              <button
                className="btn-action-base btn-action-red"
                aria-label="差戻し"
              >
                <Undo2 className="h-4 w-4" />
                差戻し
              </button>
              <button
                className="btn-action-base btn-action-green"
                aria-label="承認"
              >
                <Check className="h-4 w-4" />
                承認
              </button>
              {/* 検印（支払詳細(追加口請求書有)のフッターと同一の体裁・配置） */}
              <button
                className="btn-action-base btn-action-green"
                aria-label="検印"
              >
                <Stamp className="h-4 w-4" />
                検印
              </button>
              <button
                className="btn-action-base btn-action-outline-blue"
                aria-label="引戻し"
              >
                <CornerUpLeft className="h-4 w-4" />
                引戻し
              </button>
              <button
                className="btn-action-base btn-action-green"
                aria-label="申請"
              >
                <Send className="h-4 w-4" />
                申請
              </button>
              <button
                className="btn-action-base btn-action-blue"
                aria-label="保存"
              >
                <Save className="h-4 w-4" />
                保存
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 右ペイン：コメント履歴（基本情報のステータス横のボタンから開く） */}
      <RightPane
        open={isCommentHistoryPaneShown}
        onClose={() => setIsCommentHistoryPaneShown(false)}
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
    </div>
  );
}
