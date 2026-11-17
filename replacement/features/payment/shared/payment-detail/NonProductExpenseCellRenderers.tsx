// 拡売費一覧（PaymentNonProductExpensePane）のヘッダー・セルの部品（計画対象の全選択・枝番行の開閉・行メニュー）
import { ICellRendererParams, IHeaderParams } from 'ag-grid-community';
import {
  ChevronDown,
  Split,
  ListChecks,
  Copy,
  Trash2,
  Undo2,
} from 'lucide-react';
import { RowActionMenu } from '@/components/grid';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import type { ExpenseRow } from '@/types/paymentDetail';
import {
  isSplitDestData,
  isBranchData,
} from '@/utils/payment/payment-detail/nonProductExpenseRows';

// 選択チェックボックス列のヘッダー。「計画選択」アイコン（ListChecks・青）を置き、
// 押下で表示中の一覧の明細を全てチェック／全て解除する
//（全てチェック済みなら解除、それ以外はすべてチェック）。
// アイコン・配色はグリッド外の「拡売費計画引用」ボタンと揃え、セル側のチェックボックスと
// 縦位置が揃うよう同じ高さ（h-5）にする。
export const PlanTargetSelectAllHeader = (props: IHeaderParams) => {
  // ヘッダーは生成時の params を保持し続けるため、params.context では古い関数を
  // 参照することがある。AG Grid 公式の getGridOption で常に最新の context を読む。
  const { hasPlanTarget, isAllPlanTargetsSelected, onToggleAllPlanTargets } =
    props.api.getGridOption('context') ?? props.context;
  const enabled = hasPlanTarget();
  const selected = enabled && isAllPlanTargetsSelected();
  const action = `拡売費計画引用の対象を全て${selected ? '解除' : 'チェック'}`;
  return (
    <div className="flex h-full w-full items-center justify-start">
      <button
        type="button"
        disabled={!enabled}
        onClick={() => onToggleAllPlanTargets()}
        className={`flex h-5 w-5 items-center justify-center rounded focus:ring-2 focus:ring-blue-500 focus:outline-none ${
          enabled
            ? 'text-blue-600 hover:bg-gray-200'
            : 'cursor-not-allowed text-gray-400'
        }`}
        aria-pressed={selected}
        aria-label={enabled ? action : '拡売費計画引用の対象なし'}
        title={enabled ? action : '拡売費計画引用の対象なし'}
      >
        <ListChecks className="h-4 w-4" />
      </button>
    </div>
  );
};

// 折りたたみ機能列のヘッダー。分割（Split）のアイコンを置き、
// 押下で分割の枝番行を一括開閉する（全て展開中なら全て折りたたみ、それ以外は全て展開）。
// セル側の折りたたみボタンと同じ幅（w-5）にして縦位置を揃える。
// 対象の枝番行が1件もない場合は非活性（灰）にする。
export const BranchCollapseHeader = (props: IHeaderParams) => {
  // ヘッダーは生成時の params を保持し続けるため、params.context では古い関数を
  // 参照することがある。AG Grid 公式の getGridOption で常に最新の context を読む。
  const { hasAnyBranch, isAllBranchExpanded, onToggleAllCollapse } =
    props.api.getGridOption('context') ?? props.context;
  const enabled = hasAnyBranch();
  const expanded = enabled && isAllBranchExpanded();
  const action = `分割の枝番行を全て${expanded ? '折りたたむ' : '展開'}`;
  return (
    <div className="flex h-full w-full items-center justify-start">
      <button
        type="button"
        disabled={!enabled}
        onClick={() => onToggleAllCollapse()}
        className={`flex h-5 w-5 items-center justify-center rounded focus:ring-2 focus:ring-blue-500 focus:outline-none ${
          enabled
            ? 'text-blue-600 hover:bg-gray-200'
            : 'cursor-not-allowed text-gray-400'
        }`}
        aria-expanded={expanded}
        aria-label={enabled ? action : '分割の枝番行なし'}
        title={enabled ? action : '分割の枝番行なし'}
      >
        <Split className="h-4 w-4" />
      </button>
    </div>
  );
};

// 分割の枝番行の折りたたみボタン（親行の左端）。
// アイコンはカードの折りたたみ（CollapsibleCard）と揃えて ChevronDown を使い、
// 「∨」＝折りたたみ中（枝番行を隠している）、「∧」（180度回転）＝展開中とする。
// 親行以外（枝番行・グループ合計行・総合計行）と、枝番行を持たない親行では表示しない。
export const BranchCollapseCellRenderer = (props: ICellRendererParams) => {
  const row = props.data as ExpenseRow | undefined;
  if (!row || row.isGroup || row.isTotal || isBranchData(row)) return null;
  const { hasBranch, isCollapsed, onToggleCollapse } = props.context;
  // No. は未承認NET／その他の一覧で重複するため、判定には行そのものを渡す。
  if (!hasBranch(row)) return null;
  const collapsed = isCollapsed(row);
  return (
    <div className="flex h-full items-center justify-center">
      <button
        type="button"
        onClick={() => onToggleCollapse(row)}
        className="flex h-5 w-5 items-center justify-center rounded text-gray-700 hover:bg-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        aria-expanded={!collapsed}
        aria-label={`分割の枝番行を${collapsed ? '展開' : '折りたたむ'}`}
        title={`分割の枝番行を${collapsed ? '展開' : '折りたたむ'}`}
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform ${
            collapsed ? '' : 'rotate-180'
          }`}
        />
      </button>
    </div>
  );
};

// 行操作（分割・コピー・削除）を三点リーダー（ケバブメニュー）にまとめたレンダラー。
// 支払詳細(自販機) 経費項目一覧の操作列と同様。合計行・グループ合計行は非表示。
// ・分割の枝番行（分割先「1-1」等）：削除のみ活性・他は非活性。
//   ただし分割の枝番行はgrid内で編集できるため、コピーも活性にする。
// ・コピー：枝番行でない明細行と、分割の枝番行が活性（未承認NET一覧は非活性）。
// ・削除：枝番行と、その他一覧の明細行が活性（未承認NET一覧の明細行は非活性）。
//   ただし枝番行（分割・計画）を持つ親行は、先に枝番行を削除する運用のため非活性。
// ・追加口処理：その他一覧の枝番行以外で活性。未承認NET一覧では設けない
//   （未承認NET明細は追加口の「追加口NET」「支払NET」から自動連動するため、
//    追加口へ戻す操作を持たない → 20260710_第16回 決定事項18）。
// ・計画選択：設定先をチェックボックス列で選ぶ動線へ移行したため、本操作メニューに
//   は設けない（グリッド外の「販売計画選択」ボタンから開く）。
// ・振替：振替詳細画面で行うため、本操作メニューには設けない。
export const RowMenuCellRenderer = (props: ICellRendererParams) => {
  if (props.data?.isTotal || props.data?.isGroup) return null;
  const {
    onSplitCost,
    onCopyRow,
    onRevert,
    onDeleteRow,
    hasAnyBranchOfRow,
    hasNetGroup,
  } = props.context;
  // 枝番行（分割先・計画選択）は親行データの再掲のため、削除以外の操作を非活性にする。
  const isBranchRow = isBranchData(props.data);
  const disableOthers = isBranchRow;
  // コピーは「枝番行でないこと」「未承認NET一覧の行でないこと」のみで判定する
  //（No.（行番）は見ない）。
  //   分割の枝番行はgrid内で分割先ごとの値を編集できるため、複製できるよう活性にする。
  const isCopyEnabled = isSplitDestData(props.data)
    ? true
    : !disableOthers && !props.data?.isNetUnapproved;
  // 削除：枝番行（分割先・計画選択）は利用者が分割・計画選択で作成した行のため活性。
  //   明細行はその他一覧のみ活性（未承認NET一覧の明細は追加口から自動連動するため不可）。
  //   枝番行を持つ親行は、内訳の枝番行が残ってしまうため非活性とする
  //  （枝番行をすべて削除してから親行を削除する）。
  const isDeleteEnabled =
    (isBranchRow || !props.data?.isNetUnapproved) &&
    (isBranchRow || !hasAnyBranchOfRow?.(props.data));
  // 追加口処理：押下で当該行を追加口へ戻す。
  //   その他一覧の明細行のみ活性。未承認NET一覧の明細と分割先の枝番行は不可
  //   （→ 20260710_第16回 決定事項18）。
  const isRevertActive = !disableOthers && !props.data?.isNetUnapproved;
  // 分割：押下で当該行に分割の枝番行を追加する。枝番行は分割元にできないため非活性。
  const splitDisabled = isBranchRow;
  // 活性／非活性の共通クラス。
  const activeCls = 'text-blue-600 focus:text-blue-600';
  const disabledCls = 'text-gray-400';
  return (
    // 三点リーダーの開閉・体裁は共通部品（RowActionMenu）に委譲する（マウスホバーで開く）。
    <RowActionMenu>
      <DropdownMenuItem
        onClick={splitDisabled ? undefined : () => onSplitCost?.(props.data)}
        disabled={splitDisabled}
        className={splitDisabled ? disabledCls : activeCls}
      >
        <Split
          className={`w-4 h-4 ${splitDisabled ? 'text-gray-400' : 'text-blue-600'}`}
        />
        分割
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={isCopyEnabled ? () => onCopyRow?.(props.data) : undefined}
        disabled={!isCopyEnabled}
        className={
          isCopyEnabled ? 'text-green-600 focus:text-green-600' : disabledCls
        }
      >
        <Copy
          className={`w-4 h-4 ${isCopyEnabled ? 'text-green-600' : 'text-gray-400'}`}
        />
        コピー
      </DropdownMenuItem>
      {/* 削除：枝番行と、その他一覧の明細行が活性（未承認NET一覧の明細行は非活性）。 */}
      <DropdownMenuItem
        onClick={isDeleteEnabled ? () => onDeleteRow?.(props.data) : undefined}
        disabled={!isDeleteEnabled}
        className={
          isDeleteEnabled ? 'text-red-600 focus:text-red-600' : disabledCls
        }
      >
        <Trash2
          className={`w-4 h-4 ${isDeleteEnabled ? 'text-red-600' : 'text-gray-400'}`}
        />
        削除
      </DropdownMenuItem>
      {/* 追加口処理：押下で当該行を追加口へ戻す（onRevert）。分割先以外は活性。
              追加口と拡売費の間で明細を移す操作のため、拡売費処理を持たない画面
              （請求書無）では設けない。 */}
      {hasNetGroup && (
        <DropdownMenuItem
          onClick={isRevertActive ? () => onRevert?.(props.data) : undefined}
          disabled={!isRevertActive}
          className={isRevertActive ? activeCls : disabledCls}
        >
          <Undo2
            className={`w-4 h-4 ${isRevertActive ? 'text-blue-600' : 'text-gray-400'}`}
          />
          追加口処理
        </DropdownMenuItem>
      )}
    </RowActionMenu>
  );
};
