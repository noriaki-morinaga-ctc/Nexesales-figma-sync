import { Plus, Copy } from 'lucide-react';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  ColGroupDef,
  CellValueChangedEvent,
  CellMouseOverEvent,
  IRowNode,
} from 'ag-grid-community';
import { toast } from 'sonner';

import {
  GRID_DEFAULT_COL_DEF,
  GRID_BASE_PROPS,
  GRID_EMPTY_TEXT,
  GRID_STATUS_BAR,
  GRID_COLORS,
  changedCellStyle,
  viewportGridHeight,
  gridFilterContextMenuItems,
  useGridColumnState,
  useRevealNewRows,
  useChangedCells,
  useLinkedCellUndo,
  CellColorLegend,
  CopySourceLegend,
  copySourceLeftBorder,
  GRID_NUMBER_FILTER,
  asCellStyle,
} from '@/app/components/grid';
import {
  markCopySource,
  stripCopySource,
} from '@/app/utils/common/copySourceMarks';
import { SingleComboboxCellEditor } from '@/app/components/ui/single-combobox-cell-editor';
import {
  EXPENSE_CAMPAIGN_CLASS_OPTIONS,
  EXPENSE_CAMPAIGN_CODE_OPTIONS,
} from '@/app/constants/expenseRelations';
import {
  campaignClassComboOptions,
  campaignCodeComboOptions,
  campaignClassCode,
  managementCodeName,
} from '@/app/utils/payment/payment-detail/paymentComboFieldOptions';
import {
  campaignClassFromCode,
  isCampaignCodeInClass,
  managementClassFromCode,
  isManagementCodeInClass,
} from '@/app/utils/common/expenseRelations';
// サマリ商品名 → 商品マスタ（メタブランドの自動入力に使う）と、
// サマリ商品列の選択肢に使うサマリ商品名の一覧。
import { SUMMARY_PRODUCT_BY_VALUE } from '@/app/constants/productMasters';
// ブランド横断(全商品)。サマリ商品の絞り込み対象外にする。
import {
  // 一次店/三次店/販売店は費用分割の分割先明細と同じ商流マスタを使う。
  STORE_NONE,
  PRIMARY_STORE_OPTIONS,
  tertiaryOptionsFor,
  storeOptionsFor,
} from '@/app/constants/storeHierarchy';
import {
  deptOptionsFor,
  staffOptionsFor,
  storesForDept,
  applyStoreOrgCascade,
} from '@/app/utils/payment/payment-detail/paymentOrgCascade';
import type { StoreOrgSelection } from '@/app/types/organization';
// 施策コード → 施策コード名称（名称列の表示・絞り込み用）。
// 管理区分／管理コードの選択肢（名称＋コードの2行表示）と、名称→コードの逆引き。
import {
  managementCodeComboOptions,
  managementCodeNameComboOptions,
} from '@/app/constants/comboFieldOptions';
import {
  campaignCodeNameOf,
  managementCodeOfName,
} from '@/app/utils/common/comboFieldOptions';
import {
  DEFAULT_DATA_SOURCE,
  WITH_INVOICE_DATA_SOURCE_COLUMNS,
  WITHOUT_INVOICE_DATA_SOURCE_COLUMNS,
} from '@/app/constants/dataSource';
import { type AmountBreakdown } from '@/app/utils/payment/payment-detail/paymentAmountBreakdown';
import {
  applyLinkedTaxClass,
  linkedTaxClassOf,
} from '@/app/utils/payment/payment-detail/expenseTaxClass';
import { PaymentAmountBreakdownTable } from './PaymentAmountBreakdownTable';
import {
  isExpenseInvoiceRefEditable,
  markExpenseManualEdit,
  originDataSourceOf,
} from '@/app/utils/payment/payment-detail/paymentDataSource';
import {
  isNetLinkForRound,
  missingNetProducts,
  type NetUnapprovedLink,
} from '@/app/utils/payment/payment-detail/netUnapprovedLink';
import { CARD_TITLE_CLASS } from '@/styles/commonStyles';
import { CollapsibleCard } from '@/app/components/ui/collapsible-card';
import type {
  ExpenseBasicInfo,
  ExpenseRow,
  PaymentNonProductExpensePaneHandle,
  ExpensePaneVariant,
  ExpenseSummary,
} from '@/app/types/paymentDetail';
import {
  NET_MGMT_CLASS_NAME,
  managementClassCodeOf,
  managementCodeCandidates,
  storeOrgSelectionOf,
  SUMMARY_PRODUCT_NONE,
  summaryProductComboOptionsFor,
  hasSummaryProduct,
  isSplitDestData,
  isBranchData,
  newExpenseRowId,
  nextAddedRowSeq,
  assignExpenseRowIds,
  getExpenseRowId,
  isNetListRow,
  isPlanTargetSelectable,
  BLANK,
  parentLineNoOfRow,
  listKeyOf,
  sortRowsForDisplay,
  branchParentKeyOf,
  branchParentKeyOfBranch,
  nextDetailLineNo,
  nextSplitBranchNo,
  nextParentLineNo,
  inheritedFromParent,
  createNetUnapprovedRow,
  fmtPay,
  intFmt,
  intValueParser,
  toNum,
  billPayDiffOf,
  FORMULA_DEFS,
  isFormulaCell,
  isNetDetailReclassified,
  isOtherDetailReclassifiedToNet,
  applyExpenseFormulas,
  createManualExpenseRow,
  createEmptyExpenseRows,
} from '@/app/utils/payment/payment-detail/nonProductExpenseRows';
import {
  MANAGEMENT_CLASS_COMBO_OPTIONS,
  MANAGEMENT_CLASS_COMBO_OPTIONS_WITH_NET,
  EMPTY_BASIC_INFO,
  STORE_ORG_FIELD,
  MGMT_PLAN_CLEARED,
  MEASURE_PLAN_CLEARED,
  META_BRAND_COMBO_OPTIONS,
  COLUMN_STATE_KEYS,
  PLAN_TARGET_ROW_SELECTION,
  TAX_CLASS_COMBO_OPTIONS,
  MATCH_TYPE_COMBO_OPTIONS,
  TRANSFERRED_LEGEND_ITEM,
  EXPENSE_COLOR_LEGEND,
  INITIAL_SUMMARY,
} from './nonProductExpenseConstants';
import {
  PlanTargetSelectAllHeader,
  BranchCollapseHeader,
  BranchCollapseCellRenderer,
  RowMenuCellRenderer,
} from './NonProductExpenseCellRenderers';

interface PaymentNonProductExpensePaneProps {
  // 画面差分（既定は支払詳細(追加口請求書有)）。
  variant?: ExpensePaneVariant;
  // 表示する拡売費明細（支払回数ごとのデータセット）。未指定時は既定データを生成する。
  initialRows?: ExpenseRow[];
  // 拡売費計画引用ボタン押下（拡売費計画引用の下ペインを表示）。
  // group は押下元がどちらの一覧か（未承認NET／その他）を示す。
  // ※「選択」の設定先は当一覧のチェックボックス列で選ぶ（下ペインへは渡さない）。
  onOpenPlanSelection?: (group?: 'net' | 'other') => void;
  // 費用振替ボタン押下（操作メニュー「振替」）。押下で費用振替画面（下ペイン）を開く。
  onOpenTransfer?: (data: ExpenseRow) => void;
  // 明細行（親行）の商流・組織列に表示する、画面の基本情報の値。
  basicInfo?: ExpenseBasicInfo;
  // 操作メニュー「追加口処理」押下。当該明細を拡売費一覧から外したことを親へ伝える。
  // 親は追加口一覧へ当該明細を追加する（追加口から移した明細は元の行を戻す）。
  onRevertToAddition?: (data: ExpenseRow) => void;
  // タイトル右の「明細追加」ボタン押下
  onOpenAddExpense?: () => void;
  // 追加口一覧から連動する「未承認NET拡売費」データ（O列合計・商品名別O列・手入力の商品・支払回数）
  netUnapproved?: NetUnapprovedLink;
  // 表示中の支払回数。別の支払回数の連動データ（切替の直後に届く前の回の値）を当てないために使う。
  round?: string;
  // 明細を編集したときに呼ぶ。親画面が未保存の状態を持つために使う
  //（未保存で引用ボタンを押した場合に保存を促すため → 20260814_第28回 決定事項6）。
  onEdited?: () => void;
  // 合計表（拡売費計）の変更通知。支払詳細(追加口請求書有／追加口請求書無)が通知する
  //（親が支払情報カードの合計表へ渡す）。
  onBreakdownChange?: (breakdown: AmountBreakdown) => void;
  // コピー・明細追加した行に左端の帯（拡売費コピー＝緑／新規追加＝オレンジ）と凡例を付けるか。
  // 既定は付けない（従来どおり）。支払詳細(追加口請求書有)・(追加口請求書無)で指定する
  //（→ 販売計画側の表現を踏襲。02 §10.1 コピー由来カラーバー）。
  showCopySourceBand?: boolean;
}

// 表の高さで画面の縦幅から引く分（rem。アプリのヘッダー・画面下部のボタンの列・カードの下の余白）。
// 最下部までスクロールした状態で、表が画面にちょうど収まる値（UX-099。実測で決めた値）。
const PAYMENT_EXPENSE_GRID_OFFSET_REM = 10.25;

export const PaymentNonProductExpensePane = forwardRef<
  PaymentNonProductExpensePaneHandle,
  PaymentNonProductExpensePaneProps
>(function PaymentNonProductExpensePane(
  {
    variant = 'with-invoice',
    onOpenPlanSelection,
    onOpenTransfer,
    onRevertToAddition,
    onOpenAddExpense,
    netUnapproved,
    round,
    basicInfo = EMPTY_BASIC_INFO,
    initialRows,
    onEdited,
    onBreakdownChange,
    showCopySourceBand = false,
  }: PaymentNonProductExpensePaneProps,
  ref
) {
  // 支払詳細(追加口請求書無)は請求書を受領しないため、未承認NET／その他の区分を持たず
  // 単一の一覧とする（→ 業務機能要件 52 4.レイアウト r232-255）。
  const hasNetGroup = variant === 'with-invoice';

  // 合計サマリーバーにグループ別（未承認NET拡売費／その他拡売費）の内訳を出すか。
  // 商流販売店紐づけなしは総合計（支払金額）のみを出す。
  const hasSummaryGroups = variant !== 'no-store-link';

  // 合計サマリーバーの代わりに合計表（請求／支払／差額 × 合計・税率別・データ元別）を出すか。
  // 支払詳細(追加口請求書有／追加口請求書無)が対象で、商流販売店紐づけなしの表示と動きは変えない。
  const hasBreakdownTable = variant !== 'no-store-link';

  // 管理区分／管理区分名称列の選択肢。未承認NETの区分「値引き（売上連動）」は
  // 未承認NETの一覧を持つ画面でのみ選べるようにする。共通マスタに無い区分のため、
  // 持たない画面で選べると支払情報サマリの集計・合計から外れてしまう。
  const managementClassOptions = hasNetGroup
    ? MANAGEMENT_CLASS_COMBO_OPTIONS_WITH_NET
    : MANAGEMENT_CLASS_COMBO_OPTIONS;

  // カードの開閉状態（折り畳み。既定は展開）。
  const [isCardOpen, setIsCardOpen] = useState(true);

  // 表示グループ切り替え（未承認NET／その他）。既定は「その他」。
  // 区分を持たない画面（請求書無）は常に「その他」相当の単一一覧を表示する。
  const [activeExpenseGroup, setActiveExpenseGroup] = useState<'net' | 'other'>(
    'other'
  );

  // 明細行（追加口からの転記で動的に増減するため state で保持）。
  // 支払回数ごとのデータセット（initialRows）が渡された場合はそれを初期値とする。
  // 渡されないときは明細を持たない一覧（グループ合計行だけ）から始める（明細のモックは画面から渡す）。
  const [rows, setRows] = useState<ExpenseRow[]>(
    () => initialRows ?? createEmptyExpenseRows()
  );
  // 列定義（useMemo で固定）の valueSetter から最新の行一覧を参照するための ref。
  // 分割元行の支払金額と分割先行（枝番行）の分割金額の整合チェックに使う。
  const rowsRef = useRef<ExpenseRow[]>(rows);
  rowsRef.current = rows;

  // グリッドへ渡す行。明細は No. の昇順（枝番行は親行の直下）で表示する。
  // 行データの実体は入れ替えないため、行の追加・削除・編集の処理は state の
  // 並び（rows）のまま扱ってよい。行ID（getRowId）を持たない行には、ここで振る。
  const displayRows = useMemo(() => {
    assignExpenseRowIds(rows);
    return sortRowsForDisplay(rows);
  }, [rows]);

  // 列定義（useMemo で固定）の valueGetter から最新の基本情報を参照するための ref。
  // 商流・組織列（一次店〜担当者）の親行の表示値に使う。
  const basicInfoRef = useRef(basicInfo);
  basicInfoRef.current = basicInfo;

  // 親（PaymentDetailWithInvoice）へ公開するハンドル。
  //   addFromAddition: 追加口で「拡売費処理」を選択した行を、その他一覧の最上部に追加。
  //   removeBySource : 指定の追加口行番に紐づく行を削除（追加口側で「-」に戻された時）。

  // コピー・追加口からの転記で増えた行を見つけやすくする
  //（行全体をフラッシュし、可視域へ送る）。ハンドル内からも使うため先に定義する。
  const reveal = useRevealNewRows();

  useImperativeHandle(ref, () => ({
    // 支払回数の切替時、表示中の回の明細行を親へ受け渡す（行の増減も含めて退避する）。
    getRows: () => rowsRef.current,
    addFromAddition: (item) => {
      setRows((prev) => {
        // 重複防止：同じ追加口行番に紐づく行が既にあれば追加しない。
        if (prev.some((r) => r.sourceLineNo === item.sourceLineNo)) return prev;
        const newRow: ExpenseRow = {
          ...BLANK,
          sourceLineNo: item.sourceLineNo,
          // No. はその他拡売費の明細行の末尾の続き（最大 No.＋1）を採番する。
          // 分割の枝番の採番や販売計画選択の対象行の突き合わせが No. で行を
          // 特定するため、転記した行にも No. を持たせる。
          lineNo: nextDetailLineNo(prev, 'other'),
          // 転記項目（主要項目）：商品名→商品・支払金額・税率・税区分。
          product: item.product,
          // メタブランドはサマリ商品名で商品マスタを引いて自動入力する。
          planExpContent:
            SUMMARY_PRODUCT_BY_VALUE.get(item.product)?.metaBrand ?? '',
          // 請求金額は追加口明細の請求情報の金額をそのまま引き継ぐ。
          billAmount: item.billAmount ?? '',
          payAmount: item.payAmount,
          planAmount: 0,
          taxClass: item.taxClass ?? '課税10%:1',
          // 照合支払区分・請求書情報は追加口明細の値をそのまま引き継ぐ
          //（照合支払区分は選択済み、請求書番号・請求書ページは入力済みの状態にする）。
          matchType: item.matchType ?? '',
          billNo: item.billNo ?? '',
          billPage: item.billPage ?? '',
          // データ元・摘要1・摘要2は両一覧で同じ項目のため、内容をそのまま引き継ぐ。
          ...(item.dataSource ? { dataSource: item.dataSource } : {}),
          ...(item.originDataSource
            ? { originDataSource: item.originDataSource }
            : {}),
          summary1: item.summary1 ?? '',
          summary2: item.summary2 ?? '',
          // その他一覧の最上部に表示する（画面設計標準 4.4。並びは sortRowsForDisplay）
          _addedSeq: nextAddedRowSeq(),
        };
        // 追加した明細は行全体をフラッシュして、切り替わったことを分かるようにする。
        reveal.markRows([newRow]);
        // その他一覧の最上部に追加する（rows 配列も先頭に置く）。
        return [newRow, ...prev];
      });
    },
    // 「明細追加」ペインの入力値から、その他拡売費の明細を1行足す。
    // No. はその他一覧の続きから採番し、支払金額の未入力は請求金額で埋める
    //（グリッドの数式 applyExpenseFormulas と同じ扱い）。
    addManualRow: (values) => {
      setRows((prev) => {
        const baseRow = createManualExpenseRow(
          values,
          nextDetailLineNo(prev, 'other')
        );
        // 明細追加した行は左端の帯（新規追加）で示す（帯を付ける画面のみ）。
        // 一覧の最上部に表示する（画面設計標準 4.4。並びは sortRowsForDisplay）。
        const newRow = markCopySource(
          { ...baseRow, _addedSeq: nextAddedRowSeq() },
          'new',
          showCopySourceBand
        );
        // 追加した明細は行全体をフラッシュして、どこに増えたかが分かるようにする。
        reveal.markRows([newRow]);
        return [newRow, ...prev];
      });
      toast.success('拡売費明細を追加しました。');
    },
    removeBySource: (sourceLineNo) => {
      setRows((prev) => prev.filter((r) => r.sourceLineNo !== sourceLineNo));
    },
    // 保存・申請時：コピー・明細追加の帯を外す（帯のみ。編集セルの強調は対象外）。
    // 帯を持つ行が無い場合は同じ配列のままのため、再描画は起きない。
    // 帯を持つ行がある場合は行データを差し替えるが、行ID（getRowId）は変わらないため
    // チェックボックス列の選択は残る。
    clearSavedMarks: () => {
      setRows((prev) => stripCopySource(prev));
      setTimeout(
        () =>
          gridApiRef.current?.refreshCells({
            force: true,
            columns: ['lineNo'],
          }),
        0
      );
    },
    // 販売計画選択の「選択」：計画明細の「メタブランド」「サマリ商品名」と
    //「管理区分」〜「摘要2（社外用）」を、一覧でチェックした明細すべてへ設定する
    //（チェックボックス列で選んだ行が対象）。
    setPlanFields: (fields) => {
      // チェックした行（行データの実体）を対象にする。分割の枝番行も対象に含む。
      const targets = new Set(
        ((gridApiRef.current?.getSelectedRows() ?? []) as ExpenseRow[]).filter(
          (r) => !r.isGroup && !r.isTotal
        )
      );
      if (targets.size === 0) {
        toast.warning('設定先の拡売費明細をチェックしてください。');
        return;
      }
      setRows((prev) => {
        const next = prev.map((r) =>
          targets.has(r)
            ? {
                ...r,
                // メタブランド・サマリ商品名は計画明細の値をそのまま設定する。
                planExpContent: fields.planExpContent,
                product: fields.product,
                // 拡売費一覧は管理区分・施策区分に名称、管理コード・施策コードに
                // コードを保持するため、計画明細の値をその形へ振り分ける。
                mgmtClass: fields.mgmtClassName,
                mgmtCode: fields.mgmtCode,
                measureClass: fields.measureClassName,
                measureCode: fields.measureCode,
                summary1: fields.summary1,
                // 摘要2（社外用）は計画から引用せず、支払時に入力した値をそのまま残す。
                // 反映された項目が分かるよう、当該行にマークを立ててセルの色を変える。
                planApplied: true,
                // コード列・名称列は計画明細の値をそのまま表示する
                //（マスタからの導出より優先する）。
                planMgmtClassCode: fields.mgmtClassCode,
                planMgmtCodeName: fields.mgmtCodeName,
                planMeasureClassCode: fields.measureClassCode,
                planMeasureCodeName: fields.measureCodeName,
              }
            : r
        );
        // 計画の項目を入れた明細も手で直した明細のため、データ元を手入力にする
        //（枝番行に入れたときは親の明細を手入力にする）。
        next
          .filter((r, i) => targets.has(prev[i]))
          .forEach((r) => {
            markExpenseManualEdit(next, r);
            // 計画の管理区分に紐づく税区分（1B3＝課税8%:2）があれば入れる（→ C79）。
            applyLinkedTaxClass(r);
          });
        return next;
      });
      toast.success(
        `計画明細の項目を拡売費明細（${targets.size}件）へ設定しました。`
      );
    },
    // フッタの「保存」「申請」押下時：未承認NET拡売費は管理区分 1B3 の明細だけを
    // 表示する一覧のため、管理区分を変えた明細を該当する一覧へ移す。
    //   未承認NET → その他 ：管理区分を「1B3／値引き（売上連動）」から変更した明細
    //   その他   → 未承認NET：管理区分を「1B3／値引き（売上連動）」へ変更した明細
    // No. は移動先の一覧の続きから自動採番し、分割の枝番行は親行に付いて一緒に移す。
    relistByMgmtClass: () => {
      const detailRows = rowsRef.current.filter(
        (r) => !r.isGroup && !r.isTotal && !isBranchData(r)
      );
      const toOther = detailRows.filter(isNetDetailReclassified);
      const toNet = detailRows.filter(isOtherDetailReclassifiedToNet);
      const movedCount = toOther.length + toNet.length;
      if (movedCount === 0) return 0;
      setRows((prev) => {
        const movingParents = new Set<ExpenseRow>([...toOther, ...toNet]);
        // 移動する親行のキー（枝番行を親行に付いて動かすために使う）。
        const movingKeys = new Set(
          [...movingParents].map((r) => branchParentKeyOf(r))
        );
        const isMovingBranch = (r: ExpenseRow) => {
          const key = branchParentKeyOfBranch(r);
          return key !== null && movingKeys.has(key);
        };
        const stayed = prev.filter(
          (r) => !movingParents.has(r) && !isMovingBranch(r)
        );
        // 採番は移動後の一覧（残った明細）の続きから行う。
        let nextNetNo = nextParentLineNo(stayed, 'net');
        let nextOtherNo = nextParentLineNo(stayed, 'other');
        const moved: ExpenseRow[] = [];
        prev.forEach((row) => {
          if (!movingParents.has(row)) return;
          const toNetList = !row.isNetUnapproved;
          const newLineNo = toNetList ? nextNetNo++ : nextOtherNo++;
          moved.push({
            ...row,
            isNetUnapproved: toNetList,
            // 未承認NETへ移した明細は、その他一覧で入れた支払金額をそのまま残す
            //（追加口のNET差額から自動生成した明細ではないため、O列と連動させない）。
            payAmountManual: toNetList ? true : row.payAmountManual,
            lineNo: newLineNo,
          });
          // 分割の枝番行は親行の直下に置くため、新しい No. で採番し直して一緒に移す。
          const parentKey = branchParentKeyOf(row);
          let branchNo = 1;
          prev.forEach((branch) => {
            if (branchParentKeyOfBranch(branch) !== parentKey) return;
            moved.push({
              ...branch,
              isNetUnapproved: toNetList,
              lineNo: `${newLineNo}-${branchNo++}`,
            });
          });
        });
        return [...stayed, ...moved];
      });
      const messages = [
        toOther.length > 0
          ? `未承認NET拡売費の明細（${toOther.length}件）をその他拡売費へ`
          : '',
        toNet.length > 0
          ? `その他拡売費の明細（${toNet.length}件）を未承認NET拡売費へ`
          : '',
      ].filter(Boolean);
      toast.success(`${messages.join('、')}移動しました。`);
      return movedCount;
    },
  }));

  // タイトル下の合計サマリーバーの表示値（総合計＋グループ別の支払金額・計画金額）。
  // 数式の一括適用（applyExpenseFormulas）で再集計するたびに更新する。
  const [summary, setSummary] = useState<ExpenseSummary>(INITIAL_SUMMARY);

  // 合計表（拡売費計）を親へ通知する。初期値（全て0）は数式の一括適用前の仮の値のため、
  // グリッドの準備ができて再集計した後から通知する。
  const hasAppliedFormulas = summary !== INITIAL_SUMMARY;
  useEffect(() => {
    if (!hasBreakdownTable || !hasAppliedFormulas) return;
    onBreakdownChange?.(summary.breakdown);
  }, [summary, hasBreakdownTable, hasAppliedFormulas, onBreakdownChange]);

  // AG Grid API（数式の一括適用用）と、最新の未承認NET連動データ。
  const gridApiRef = useRef<any>(null);

  // 列幅・並び順・ソートの永続化。画面独自の初期化はフックのオプション経由で
  // 実行する（spread で共通の onGridReady を上書きしないため）。
  // ※保存済み列状態は applyColumnState({ applyOrder: true }) で復元されるため、
  //   列IDを変えたらキーの版数を上げて旧状態を破棄する
  //   （v1→v2：管理区分・管理コードの活性化で colId を mgmtClassCode/mgmtCodeCode 等へ変更、
  //     v2→v3：分割先グループの列追加・並び替え、v3→v4：分割先グループへ担当者を追加）。
  const gridColumnStateProps = useGridColumnState(
    // 列構成の変更（計画紐づけ・計画なし・計画漏れの列を追加）に伴い v5 へ更新。
    // 旧 v4 の保存状態には新列が含まれず、復元時に列順・表示が崩れるため。
    // v5→v6：No. 列に「-分割」を付けて表示するため列幅を広げた
    //（旧 v5 の保存状態は旧列幅のままで枝番行の No. が切れるため破棄する）。
    // v6→v7：支払金額の右に分割金額列（splitAmount）を追加。
    // v7→v8：計画金額の右に計画紐づけ済み金額列（planLinkedAmount）を追加。
    // v8→v9：No. の左に枝番行の折りたたみボタン列（branchCollapse）を追加。
    // v9→v10：計画紐づけ済み金額列（planLinkedAmount）を削除し、
    //   計画選択の枝番行の金額は計画金額列で表示するよう変更。
    // v10→v11：計画金額列（planAmount）を支払金額の左へ移動（列順の変更）。
    // v11→v12：計画金額の左に請求金額列（billAmount）を追加。
    // v12→v13：計画なし・計画漏れ列（planMissing）を削除し、
    //   計画紐づけ列（planLinked）を「計画紐づけステータス」に改称・幅を拡大。
    // v13→v14：計画紐づけステータス列のヘッダーを2段表示にし、幅を 170→120 に変更。
    // v14→v15：分割先グループ（2段ヘッダー）を廃止し、負担金額の右へ商流・組織列
    //   （一次店〜担当者）を追加、摘要1・摘要2を施策コード名称の右へ移動（列順の変更）。
    // v15→v16：計画紐づけステータスの右に「計画紐づけ」「計画なし・計画漏れ」列を追加。
    // v16→v17：「計画なし・計画漏れ」列（planMissing）を「計画なし」（planMissing）と
    //   「計画漏れ」（planOmission）の2列に分割し、「計画紐づけ」列をアイコン表示へ変更。
    // v17→v18：計画金額・計画差異・計画紐づけ・計画無し・計画漏れの5列を削除。
    // v18→v19：折りたたみ機能列（branchCollapse）の左に選択チェックボックス列を追加し、
    //   折りたたみ機能列の幅を 60→40 に縮小。
    // v19→v20：選択チェックボックス列の幅を 50→36 に縮小。
    // v20→v21：No. の右に「データ元」列（非活性）を追加。
    // v21→v22：税込(円)列を削除し、差異理由列を「請求－支払：差額」（billPayDiff）と
    //   「照合支払区分」（matchType）の2列へ置き換えて負担金額の右へ配置。
    // v22→v23：保存済みの列状態に残ったソートで初期表示の並びが No. 順に
    //   ならないため、旧 v22 の保存状態を破棄する。
    // v23→v24：商流列の並びを 販売店→三次店→一次店 に変更し、「請求－支払差額」を
    //   「請求－支払：差額」に改称した。保存済みの列状態が旧い列順を復元するため、
    //   両画面ともキーを更新して旧状態を破棄する（請求書無は v1→v2）。
    // 列構成が画面ごとに異なる（未承認NET一覧・追加口処理の有無など）ため、保存キーは
    // 画面ごとに分ける（COLUMN_STATE_KEYS）。同じキーだと一方で隠した列が
    // もう一方へ波及する。
    // v24→v25／v2→v3：拡売費No列を削除した（請求書無は v2→v3）。
    // 請求書無 v4→v5：請求－支払：差額・照合支払区分の2列を表示する列構成にした。
    COLUMN_STATE_KEYS[variant],
    {
      onGridReady: (event: any) => {
        gridApiRef.current = event.api;
        // 明細は No. の昇順（枝番行は親行の直下）で並べて表示するため、
        // 初期表示では列のソートを常に解除する。保存済みの列状態に利用者が
        // 掛けたソートが残っていると、初期描画が No. 順にならないため。
        event.api.applyColumnState({ defaultState: { sort: null } });
        reveal.captureApi(event.api);
        // 初期表示時に数式を一括適用する。
        setSummary(applyExpenseFormulas(event.api, netRef.current));
        // 「メタブランド」「計画金額」「計画差異」列は
        // 未承認NET／その他の両一覧で常に表示する。
        event.api.setColumnsVisible(
          ['planExpContent', 'planAmount', 'planDiff'],
          true
        );
        // 操作メニュー列（分割・更新・コピー・削除）は両一覧で表示する（既定＝表示）。
      },
    }
  );
  // 表示中の支払回数の連動データだけを持つ（別の回の値は当てない）。
  const netRef = useRef(
    isNetLinkForRound(netUnapproved, round) ? netUnapproved : undefined
  );

  // 未承認NETの明細を持ったことのあるサマリ商品（一覧を移した明細も含める）。
  // 追加口明細で新たに拡売費金額（NET未承認）が出たサマリ商品だけに、明細を足すために使う。
  const netProductsRef = useRef<Set<string>>(
    new Set(rows.filter((r) => r.isNetUnapproved).map((r) => String(r.product)))
  );

  // 追加口一覧からの連動データが変わったら、拡売費一覧の数式を再適用する。
  // 担当者が支払NETを直して新たに差が出たサマリ商品は、未承認NETの明細を足す
  //（支払金額は追加口明細の拡売費金額（NET未承認）の合計 → 補足1-5 b21.t26）。
  // 足した明細は担当者が直した結果のため、データ元は手入力とする。
  // 連動データは支払回数つきで届く。支払回数を切り替えた直後は前の回の値が届くことがあるため、
  // 表示中の支払回数の値だけを当てる（→ utils/payment/payment-detail/netUnapprovedLink の isNetLinkForRound）。
  useEffect(() => {
    if (!isNetLinkForRound(netUnapproved, round)) return;
    netRef.current = netUnapproved;
    const missing = hasNetGroup
      ? missingNetProducts(netUnapproved, round, netProductsRef.current)
      : [];
    if (missing.length > 0) {
      missing.forEach(([product]) => netProductsRef.current.add(product));
      // 行が増えると onModelUpdated で数式を再適用する。
      setRows((prev) => {
        let lineNo = nextParentLineNo(prev, 'net');
        const added = missing.map(([product, payAmount]) =>
          createNetUnapprovedRow({
            lineNo: lineNo++,
            product,
            payAmount,
            dataSource: DEFAULT_DATA_SOURCE,
          })
        );
        reveal.markRows(added);
        return [...prev, ...added];
      });
      return;
    }
    if (gridApiRef.current) {
      setSummary(applyExpenseFormulas(gridApiRef.current, netUnapproved));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 連動データの変化だけを合図にする
  }, [netUnapproved, round]);

  // 表示グループ（未承認NET／その他）を AG Grid の外部フィルタで切り替える。
  // 行はモデルに保持したまま表示のみ絞り込むため、合計サマリーの集計
  //（applyExpenseFormulas の forEachNode）は常に全行を対象に算出される。
  const activeGroupRef = useRef(activeExpenseGroup);
  useEffect(() => {
    activeGroupRef.current = activeExpenseGroup;
    gridApiRef.current?.onFilterChanged();
    // 一覧を切り替えたら選択チェックを解除する（非表示の一覧の明細が
    // チェックされたまま「選択」の設定対象に残らないようにする）。
    gridApiRef.current?.deselectAll();
    // 「メタブランド」「計画金額」「計画差異」列は
    // 未承認NET／その他の両一覧で常に表示する。
    gridApiRef.current?.setColumnsVisible(
      ['planExpContent', 'planAmount', 'planDiff'],
      true
    );
    // 操作メニュー列（分割・更新・コピー・削除）は未承認NET／その他の両一覧で表示する。
    // 折りたたみ機能列のヘッダー（一括開閉）は表示中の一覧の枝番行だけを対象にするため、
    // 一覧の切り替えに合わせてアイコンの活性／非活性を描き替える。
    gridApiRef.current?.refreshHeader();
  }, [activeExpenseGroup]);

  // 分割の枝番行の折りたたみ。初期状態は「全て折りたたみ」のため、折りたたみ中ではなく
  // 展開中の親行のキー（`branchParentKeyOf`＝「一覧:No.」）を保持する。
  // No. は未承認NET／その他の一覧で重複するため、No. だけで保持すると一覧をまたいで
  // 連動してしまう。
  // こうすることで、後から追加された明細（引用・分割の登録など）も折りたたみ状態で現れる。
  // 表示の切り替えは外部フィルタで行い、行はモデルに保持したままにする
  //（合計サマリーの集計は常に全行を対象に算出される）。
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(
    new Set()
  );
  // 外部フィルタのコールバックから最新値を参照するための ref（表示グループと同じ方式）。
  const expandedBranchesRef = useRef(expandedBranches);
  useEffect(() => {
    expandedBranchesRef.current = expandedBranches;
    gridApiRef.current?.onFilterChanged();
    // ボタンのアイコン（「>」／「∨」）を現在の開閉状態に合わせて描き替える。
    gridApiRef.current?.refreshCells({
      columns: ['branchCollapse'],
      force: true,
    });
    // ヘッダーのアイコン（一括開閉）も現在の開閉状態に合わせて描き替える。
    gridApiRef.current?.refreshHeader();
  }, [expandedBranches]);

  // 枝番行の増減（分割の登録・計画選択・明細追加など）に合わせて、
  // ヘッダーのアイコンの活性／非活性を描き替える。
  useEffect(() => {
    gridApiRef.current?.refreshHeader();
  }, [rows]);

  // 折りたたみの開閉を切り替える（ボタン押下）。
  const handleToggleCollapse = (row: ExpenseRow) => {
    const key = branchParentKeyOf(row);
    setExpandedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 当該親行が分割の枝番行を持つか（持たない場合はボタンを表示しない）。
  // ※No. は未承認NET／その他の一覧で重複するため、No. だけでなくどちらの一覧の
  //   行かも含めたキーで判定する（例：その他の No.1 の枝番行を、未承認NET の
  //   No.1 の枝番行と誤認しない）。
  const hasBranchRow = (row: ExpenseRow): boolean => {
    const parentKey = branchParentKeyOf(row);
    return rowsRef.current.some(
      (r) => isSplitDestData(r) && branchParentKeyOfBranch(r) === parentKey
    );
  };

  // 分割の枝番行を持つ親行のキー一覧（重複なし）。ヘッダーの一括開閉で使う。
  // ヘッダーは表示中の一覧に対する操作のため、表示中の一覧（未承認NET／その他）の
  // 枝番行のみを対象にする（非表示側の枝番行でボタンが活性にならないようにする）。
  const branchParentKeys = (): string[] => [
    ...new Set(
      rowsRef.current
        .filter(
          (r) => isSplitDestData(r) && listKeyOf(r) === activeGroupRef.current
        )
        .map((r) => branchParentKeyOfBranch(r))
        .filter((key): key is string => !!key)
    ),
  ];

  // ヘッダーのアイコン押下：分割の枝番行を一括で開閉する。
  // 全ての親行が展開中なら全て折りたたみ、それ以外（一部のみ／全て折りたたみ）は全て展開する。
  // ※最新の行・開閉状態は ref／関数形式の更新から参照するため、ヘッダーが保持する
  //   context が古くても正しく動作する。
  // ※表示していない側の一覧の開閉状態は変えない（キーが一覧ごとに分かれているため、
  //   表示中の一覧のキーのみを差し替える）。
  const handleToggleAllCollapse = () => {
    const parents = branchParentKeys();
    if (parents.length === 0) return;
    setExpandedBranches((prev) => {
      const allExpanded = parents.every((key) => prev.has(key));
      const next = new Set(prev);
      if (allExpanded) parents.forEach((key) => next.delete(key));
      else parents.forEach((key) => next.add(key));
      return next;
    });
  };

  // 当該親行が持つ分割の枝番行の分割金額（＝枝番行の支払金額）の合計。
  // ※No. は未承認NET／その他の一覧で重複するため、突き合わせは No. だけでなく
  //   どちらの一覧の行かも含めたキー（`branchParentKeyOf`＝「一覧:No.」）で行う。
  //   No. だけで突き合わせると、未承認NET明細の親行が その他一覧の同じ No. の
  //   枝番行を自分の分割先と誤認する。
  const splitBranchTotal = (parent: ExpenseRow | undefined): number =>
    parent
      ? rowsRef.current
          .filter(
            (r) =>
              isSplitDestData(r) &&
              branchParentKeyOfBranch(r) === branchParentKeyOf(parent)
          )
          .reduce((sum, r) => sum + (toNum(r.payAmount) ?? 0), 0)
      : 0;

  // 外部フィルタ：選択中のグループに属する明細のみ表示する。
  // 合計行（未承認NET拡売費合計／その他拡売費合計）は一覧には表示しない
  //（集計のためモデルには保持。値はタイトル下の合計サマリーで確認できる）。
  // 枝番行は、親行で展開中（＝折りたたみを解除済み）のもののみ表示する（既定は折りたたみ）。
  // 2つのコールバックは useCallback で参照を固定する（最新値は ref から読む）。参照が
  // 変わると AG Grid がフィルタを掛け直して onModelUpdated が発火し、そこでの再集計
  //（setSummary）による再描画で参照がまた変わる、というループになる。ループ中の
  // フィルタの掛け直しで編集中のセルのエディタが閉じ、ダブルクリックで開いた編集が
  // すぐ解除されてしまう。
  const isExternalFilterPresent = useCallback(() => true, []);
  const doesExternalFilterPass = useCallback((node: any) => {
    const d = node.data as ExpenseRow | undefined;
    if (!d) return true;
    if (d.isGroup) return false;
    if (isSplitDestData(d)) {
      // 親行のキーは「一覧:No.」。No. は未承認NET／その他の一覧で重複するため、
      // 一覧をまたいで別の親行の開閉状態を参照しないようにする。
      const parentKey = branchParentKeyOfBranch(d);
      if (!parentKey || !expandedBranchesRef.current.has(parentKey)) {
        return false;
      }
    }
    return activeGroupRef.current === 'net'
      ? isNetListRow(d)
      : !isNetListRow(d);
  }, []);

  // 計算式セルにマウスオーバー中、計算に使われる参照元セル（`field::rowId`）の集合。
  // ref で保持し cellClassRules から最新値を参照、変更時に refreshCells で枠線を反映する。
  const hoverRefsRef = useRef<Set<string>>(new Set());
  const setHoverRefs = (keys: string[]) => {
    const next = new Set(keys);
    const cur = hoverRefsRef.current;
    // 同一集合なら再描画しない（マウス移動中の無駄な再描画を抑止）
    if (cur.size === next.size && [...next].every((k) => cur.has(k))) return;
    hoverRefsRef.current = next;
    gridApiRef.current?.refreshCells({ force: true });
  };

  // 計算式セルにマウスオーバーしたら、計算に使われる参照元セルをハイライト対象にする。
  const handleCellMouseOver = (e: CellMouseOverEvent) => {
    const field = e.colDef?.field;
    const row = e.data as ExpenseRow | undefined;
    if (!field || !row || !isFormulaCell(field, row)) {
      setHoverRefs([]);
      return;
    }
    const rowId = e.node?.id ?? '';
    setHoverRefs(FORMULA_DEFS[field].refs(row).map((f) => `${f}::${rowId}`));
  };

  // セルから外れたらハイライトを解除する。
  const handleCellMouseOut = () => setHoverRefs([]);

  // 編集セルの変更ハイライト（共通フック）。変更追跡・判定は共通側へ集約する。
  // 本グリッドは分割先行の非活性（灰）を変更黄より優先するため、色付けは各列の
  // cellStyle 方式のまま（判定のみ isCellChanged を使用）。
  const { isCellChanged, trackCellChange } = useChangedCells();

  // セル編集時に変更状態を記録し、当該セルを再描画して背景色（オレンジ）を反映する。
  const handleCellValueChanged = (params: CellValueChangedEvent) => {
    trackCellChange(params);
    // 親画面へ未保存であることを伝える（→ 20260814_第28回 決定事項6）。
    onEdited?.();
    // どの項目を直しても、請求EDI・AIC入力の明細はデータ元が手入力になる
    //（活性は元のデータ元のまま。枝番行を直したときは親の明細を手入力にする）。
    // データ元の列と合計表のデータ元別は、下の再集計・再描画で手入力へ移る。
    markExpenseManualEdit(rowsRef.current, params.data as ExpenseRow);

    // 入力値の変更に伴い、各行の派生項目（税額・計画差異）とグループ小計・
    // 総合計を Excel「拡売費」表の数式に従って再計算する。
    setSummary(applyExpenseFormulas(params.api, netRef.current));

    params.api.refreshCells({
      rowNodes: [params.node],
      force: true,
    });
  };

  // 主セルの編集に連動する従属セルの更新は共通フックに委譲する（→ 02 §7.3）。
  // 従属セルは node.data 直接更新＋当該行の再描画で反映し、Undo スタックに積まないため、
  // Ctrl+Z 1回で主セルと従属セルがまとめて戻る。
  const { makeHandler, clearCache } = useLinkedCellUndo<ExpenseRow>();

  // 行データを差し替えたとき（明細の追加・削除・転記・支払回数の切替など、セル編集以外の
  // setRows）は Undo 履歴も消えるため、連動セルのキャッシュも破棄する（→ 02 §7.3）。
  useEffect(() => {
    clearCache();
  }, [displayRows, clearCache]);

  // 利用者が区分・コードを選び直した時点で、販売計画選択から引き継いだ区分値・名称は破棄する
  //（以降は拡売費一覧のマスタから導出した値を表示する）。Undo で戻せるよう従属セルとして扱う。

  // サマリ商品変更時：紐づくメタブランドを自動セットする。
  // 「ー（指定なし）」・空へ戻したときはメタブランドも未選択へ戻す
  //（その後はメタブランドだけを選び直せる）。
  const handleSummaryProductChanged = makeHandler('product', {
    depFields: ['planExpContent'],
    deriveDeps: (product) => ({
      planExpContent:
        product && product !== SUMMARY_PRODUCT_NONE
          ? (SUMMARY_PRODUCT_BY_VALUE.get(product)?.metaBrand ?? '')
          : '',
    }),
  });

  // 管理区分に紐づく税区分（1B3＝課税8%:2）があれば、税区分をその値にする（→ C79）。
  const linkedTaxClassDeps = (row: ExpenseRow) => {
    const next = { mgmtClass: row.mgmtClass, taxClass: row.taxClass };
    applyLinkedTaxClass(next);
    return next.taxClass;
  };

  // 管理コード変更時（コード列・名称列）：対応する管理区分を自動セットする。
  const handleMgmtCodeChanged = makeHandler('mgmtCode', {
    depFields: [
      'mgmtClass',
      'taxClass',
      'planMgmtClassCode',
      'planMgmtCodeName',
    ],
    deriveDeps: (_value, row) => {
      const mgmtClass = managementClassFromCode(row.mgmtCode) || row.mgmtClass;
      return {
        mgmtClass,
        taxClass: linkedTaxClassDeps({ ...row, mgmtClass }),
        ...MGMT_PLAN_CLEARED,
      };
    },
  });

  // 管理区分変更時（区分値列・名称列）：該当しない管理コードはクリアする。
  // ただし「値引き（売上連動）」（未承認NET用）は該当する管理コードを持たない区分のため、
  // 管理コードはクリアせずそのまま保持する。
  const handleMgmtClassChanged = makeHandler('mgmtClass', {
    depFields: [
      'mgmtCode',
      'taxClass',
      'planMgmtClassCode',
      'planMgmtCodeName',
    ],
    deriveDeps: (_value, row) => ({
      mgmtCode:
        row.mgmtCode &&
        row.mgmtClass !== NET_MGMT_CLASS_NAME &&
        !isManagementCodeInClass(row.mgmtCode, row.mgmtClass)
          ? ''
          : row.mgmtCode,
      taxClass: linkedTaxClassDeps(row),
      ...MGMT_PLAN_CLEARED,
    }),
  });

  // 施策コード変更時：対応する施策区分を自動セットする（計画詳細(NET固定) 拡売費計画と同様）。
  const handleCampaignCodeChanged = makeHandler('measureCode', {
    depFields: ['measureClass', 'planMeasureClassCode', 'planMeasureCodeName'],
    deriveDeps: (code, row) => ({
      measureClass: campaignClassFromCode(code) || row.measureClass,
      ...MEASURE_PLAN_CLEARED,
    }),
  });

  // 施策区分変更時：該当しない施策コードはクリアする。
  const handleCampaignClassChanged = makeHandler('measureClass', {
    depFields: ['measureCode', 'planMeasureClassCode', 'planMeasureCodeName'],
    deriveDeps: (cls, row) => ({
      measureCode:
        row.measureCode && !isCampaignCodeInClass(row.measureCode, cls)
          ? ''
          : row.measureCode,
      ...MEASURE_PLAN_CLEARED,
    }),
  });

  // グループ合計行（未承認NET拡売費合計・その他拡売費合計）・総合計行＋非活性セルのスタイル。
  // 合計行は薄い青（gridStyles の total）、通常データ行（非活性列）は灰（readonly）。
  // 追加口一覧から「拡売費処理」で移してきた明細（元の追加口行番を保持する行）。
  // 一覧が切り替わったことが一目で分かるよう、行全体の背景を薄い紫にする。
  // 明細を移す操作を持たない画面（請求書無）では紫にせず、他の行と同じ背景にそろえる。
  const isTransferredRow = (params: any) =>
    hasNetGroup &&
    params.data?.sourceLineNo != null &&
    params.data?.sourceLineNo !== '';
  // セルの背景色。移してきた明細は通常の白／灰ではなく、移動を示す薄い紫にする。
  const rowBgOf = (params: any, normal: string) =>
    isTransferredRow(params) ? GRID_COLORS.transferredBg : normal;

  const groupStyle = asCellStyle((params: any) =>
    params.data?.isGroup || params.data?.isTotal
      ? { fontWeight: 'bold', backgroundColor: GRID_COLORS.total }
      : { backgroundColor: rowBgOf(params, GRID_COLORS.readonly) }
  );

  const rightStyle = asCellStyle((params: any) => ({
    ...groupStyle(params),
    textAlign: 'right' as const,
  }));

  // 「分割」列が「分割先」の行（費用分割で生じた枝番行）。
  const isSplitDestRow = (params: any) => params.data?.costSplit === '分割先';
  // 枝番行（分割先）は親行データの再掲のため、
  // 全セルを非活性（編集不可・灰背景 readonly）にする。
  const isBranchRow = (params: any) => isSplitDestRow(params);

  // 操作ウィジェット列（追加口へ戻す・販売計画選択・費用分割）用：データ行は白背景。
  // 合計行（グループ合計・総合計）は薄い青。枝番行は非活性（灰）。
  const widgetStyle = asCellStyle((params: any) => {
    if (params.data?.isGroup || params.data?.isTotal)
      return { fontWeight: 'bold', backgroundColor: GRID_COLORS.total };
    if (isBranchRow(params)) return { backgroundColor: GRID_COLORS.readonly };
    return { backgroundColor: rowBgOf(params, GRID_COLORS.editable) };
  });

  // 手入力可能セル（数値・右寄せ）。データ行は白（editable）、
  // 入力変更セルは薄い黄背景＋オレンジ枠（gridStyles の changedCellStyle）。
  // 枝番行は非活性（灰）。
  const inputCellStyle = asCellStyle((params: any) => {
    if (params.data?.isGroup || params.data?.isTotal) return groupStyle(params);
    if (isBranchRow(params))
      return {
        backgroundColor: GRID_COLORS.readonly,
        textAlign: 'right' as const,
      };
    return isCellChanged(params)
      ? changedCellStyle({ textAlign: 'right' as const })
      : {
          backgroundColor: rowBgOf(params, GRID_COLORS.editable),
          textAlign: 'right' as const,
        };
  });

  // 枝番行だけを活性にする金額列（分割金額）のセル（数値・右寄せ）。
  // 他の入力列とは活性条件が逆で、対象の枝番行のみ白（editable）、
  // それ以外のデータ行は非活性（灰）にする。合計行は他列と同じ薄い青。
  const branchAmountCellStyle =
    (isTargetRow: (p: any) => boolean) => (params: any) => {
      if (params.data?.isGroup || params.data?.isTotal)
        return rightStyle(params);
      if (!isTargetRow(params))
        return {
          backgroundColor: GRID_COLORS.readonly,
          textAlign: 'right' as const,
        };
      return isCellChanged(params)
        ? changedCellStyle({ textAlign: 'right' as const })
        : {
            backgroundColor: rowBgOf(params, GRID_COLORS.editable),
            textAlign: 'right' as const,
          };
    };

  // 手入力可能セル（テキスト・左寄せ）。データ行は白（editable）、
  // 入力変更セルは薄い黄背景＋オレンジ枠（gridStyles の changedCellStyle）。
  // 枝番行は非活性（灰）。
  // 販売計画選択の「選択内容を反映」で値が入る列。
  const PLAN_APPLIED_COLUMNS = new Set([
    'planExpContent',
    'product',
    'mgmtClassCode',
    'mgmtClassName',
    'mgmtCodeCode',
    'mgmtCodeName',
    'measureClassCode',
    'measureClassName',
    'measureCodeCode',
    'measureCodeName',
    'summary1',
  ]);

  // 当該セルが「選択内容を反映」で値が入ったセルか判定する。
  const isPlanAppliedCell = (params: any) =>
    !!params.data?.planApplied &&
    PLAN_APPLIED_COLUMNS.has(
      String(params.colDef?.colId ?? params.colDef?.field ?? '')
    );

  const inputTextStyle = asCellStyle((params: any) => {
    if (params.data?.isGroup || params.data?.isTotal) return groupStyle(params);
    if (isBranchRow(params)) return { backgroundColor: GRID_COLORS.readonly };
    if (isCellChanged(params)) return changedCellStyle();
    if (isPlanAppliedCell(params))
      return { backgroundColor: GRID_COLORS.appliedBg };
    return { backgroundColor: rowBgOf(params, GRID_COLORS.editable) };
  });

  // 税区分のセル背景。管理区分に紐づく税区分がある明細（1B3）は入力できないため灰にする（→ C79）。
  const taxClassCellStyle = asCellStyle((params: any) =>
    !isBranchRow(params) &&
    !params.data?.isGroup &&
    !params.data?.isTotal &&
    linkedTaxClassOf(params.data?.mgmtClass)
      ? { backgroundColor: rowBgOf(params, GRID_COLORS.readonly) }
      : inputTextStyle(params)
  );

  // メタブランドのセル背景。サマリ商品を選んでいる行は、メタブランドがサマリ商品から
  // 決まるため「入力できないセル」（灰）として表す（→ 拡売費計画の同列と同じ扱い）。
  const metaBrandCellStyle = asCellStyle((params: any) => {
    if (params.data?.isGroup || params.data?.isTotal) return groupStyle(params);
    if (!isBranchRow(params) && hasSummaryProduct(params.data))
      return { backgroundColor: rowBgOf(params, GRID_COLORS.readonly) };
    return inputTextStyle(params);
  });

  // 編集可否（グループ合計行・総合計行・枝番行は編集不可）。
  const editableExceptSummary = (params: any) =>
    !params.data?.isGroup && !params.data?.isTotal && !isBranchRow(params);

  // 一次店〜摘要2（社外用）列の編集可否。分割の枝番行は分割先ごとに値を持つため活性。
  const editableExceptPlanBranch = (params: any) =>
    !params.data?.isGroup && !params.data?.isTotal;

  // 一次店〜摘要2（社外用）のうち、行が自身で値を持つ列（管理区分〜摘要2）のセルスタイル。
  // 分割の枝番行・親行とも活性（白／変更時は黄）にする。
  const splitEditableTextStyle = asCellStyle((params: any) => {
    if (params.data?.isGroup || params.data?.isTotal) return groupStyle(params);
    if (isCellChanged(params)) return changedCellStyle();
    if (isPlanAppliedCell(params))
      return { backgroundColor: GRID_COLORS.appliedBg };
    return { backgroundColor: rowBgOf(params, GRID_COLORS.editable) };
  });

  // 商流・組織列（一次店〜担当者）のセルスタイル。
  // 分割の枝番行のみ活性（白／変更時は黄）。親行は基本情報の値を
  // 参照表示するため非活性（灰）＋グレー文字にする。
  const storeOrgCellStyle = asCellStyle((params: any) => {
    if (params.data?.isGroup || params.data?.isTotal) return groupStyle(params);
    if (!isSplitDestRow(params)) {
      return {
        backgroundColor: rowBgOf(params, GRID_COLORS.readonly),
        color: GRID_COLORS.inheritedText,
      };
    }
    return isCellChanged(params)
      ? changedCellStyle()
      : { backgroundColor: rowBgOf(params, GRID_COLORS.editable) };
  });

  // 商流・組織列（一次店〜担当者）の値取得。
  //   分割の枝番行 … 自身の値（分割先ごとに変更できる）
  //   親行         … 画面の基本情報の値（参照表示）
  const storeOrgValueGetter =
    (key: keyof StoreOrgSelection) => (params: any) => {
      if (params.data?.isGroup || params.data?.isTotal) return '';
      if (isSplitDestRow(params)) {
        return params.data?.[STORE_ORG_FIELD[key]] ?? '';
      }
      return basicInfoRef.current[key];
    };

  // 商流（一次店・三次店・販売店）と組織（費用負担部署・担当者）の連動を当該行へ適用する。
  // 関係・候補は費用分割の分割先明細と同じ定義元（storeHierarchy／paymentOrgCascade）を使う。
  // 編集した列以外の4項目を従属セルとし、共通フックで一括更新する（Undo は主セル1回で戻る → 02 §7.3）。
  const handleStoreOrgCascade = (key: keyof StoreOrgSelection) => {
    const others = (
      Object.keys(STORE_ORG_FIELD) as (keyof StoreOrgSelection)[]
    ).filter((field) => field !== key);
    return makeHandler(STORE_ORG_FIELD[key], {
      depFields: others.map((field) => STORE_ORG_FIELD[field]),
      deriveDeps: (value, row) => {
        const next = applyStoreOrgCascade(storeOrgSelectionOf(row), key, value);
        const deps: Partial<ExpenseRow> = {};
        others.forEach((field) => {
          (deps as Record<string, unknown>)[STORE_ORG_FIELD[field]] =
            next[field];
        });
        return deps;
      },
    });
  };

  // 未承認NET一覧の明細行か判定する（グループ合計行・総合計行は除く）。
  // 当該明細は計画金額を持たない（合計は固定値 250,000 で明細は集計対象外）ため、
  // 計画金額列を「-」表示・非活性（灰背景）にする。
  const isNetUnapprovedDetail = (params: any): boolean =>
    !!params.data?.isNetUnapproved &&
    !params.data?.isGroup &&
    !params.data?.isTotal;

  // 請求金額の編集可否。支払詳細画面へ反映した後に請求内容の誤りが判明した場合は
  // この欄を上書きして訂正するが、請求EDIで連携された明細は修正させない。
  // AIC入力の明細と画面で追加した明細（手入力）だけを修正できる
  //（→ 20260821_第31回 決定事項13・14）。
  // 手で直して手入力になった明細は、元のデータ元で判定する（活性は元のまま）。
  // 枝番行・グループ合計行・総合計行と、請求書を持たない未承認NET明細は対象外。
  const isBillAmountEditable = (params: any): boolean => {
    if (
      params.data?.isGroup ||
      params.data?.isTotal ||
      isBranchRow(params) ||
      isNetUnapprovedDetail(params)
    ) {
      return false;
    }
    const origin = originDataSourceOf(params.data);
    return origin === 'AIC入力' || origin === DEFAULT_DATA_SOURCE;
  };

  // 請求書番号・請求書ページの編集可否（請求書有・無で、元のデータ元が手入力の明細だけ）。
  // 請求書無も紙の請求書を明細追加で手入力するため入力できる（→ C80）。
  // 直せる明細は白（入力セル）、それ以外は親の値を引き継ぐ表示（灰）のまま。
  const isInvoiceRefEditable = (params: any): boolean =>
    isExpenseInvoiceRefEditable(params.data, variant !== 'no-store-link');
  const invoiceRefCellStyle = (params: any) =>
    isInvoiceRefEditable(params)
      ? inputTextStyle(params)
      : withInheritedText(groupStyle)(params);

  // 請求金額のセル背景。修正できる明細は編集可（白）、それ以外は参照専用（灰）。
  const billAmountCellStyle = (params: any) =>
    isBillAmountEditable(params) ? inputCellStyle(params) : rightStyle(params);

  // 枝番行（分割先・計画選択）の主要列（卸からの請求名称〜請求書ページ）は、親行の値を
  // グレー文字で表示する。親行は「当該行の上方向で最も近い、No. が枝番プレフィックスに一致する
  // 非枝番行」とみなす（未承認NET/その他で No. が重複し得るため位置ベースで特定する）。
  const findBranchParentData = (params: any): ExpenseRow | undefined => {
    const lineNo = String(params.data?.lineNo ?? '');
    const dash = lineNo.lastIndexOf('-');
    if (dash < 0) return undefined;
    const parentLineNo = lineNo.slice(0, dash);
    const api = params.api;
    const idx = params.node?.rowIndex;
    if (!api || idx == null) return undefined;
    for (let i = idx - 1; i >= 0; i--) {
      const d = api.getDisplayedRowAtIndex(i)?.data as ExpenseRow | undefined;
      if (
        d &&
        !d.isGroup &&
        !d.isTotal &&
        !isBranchData(d) &&
        String(d.lineNo) === parentLineNo
      ) {
        return d;
      }
    }
    return undefined;
  };

  // 主要列の値取得：枝番行は親行の値を、通常行は自身の field 値を返す。
  const branchParentValueGetter =
    (field: keyof ExpenseRow) => (params: any) => {
      if (!isBranchRow(params)) return params.data?.[field];
      return findBranchParentData(params)?.[field] ?? '';
    };

  // 管理区分〜摘要2（社外用）列の値取得。分割の枝番行は分割先ごとの値を自身で持つため
  // 親行を再掲せず自身の値を返す（それ以外は branchParentValueGetter と同じ）。
  const splitOwnValueGetter = (field: keyof ExpenseRow) => (params: any) =>
    isSplitDestRow(params)
      ? params.data?.[field]
      : branchParentValueGetter(field)(params);

  // 金額列（支払金額・計画金額・計画差異）は枝番行では空白にする
  //（分割の枝番行の金額は「負担金額」列で表す）。
  const branchBlankValueGetter = (field: keyof ExpenseRow) => (params: any) =>
    isBranchRow(params) ? '' : params.data?.[field];

  // 主要列のセルスタイル：枝番行は継承表示（親行の値）のため文字色をグレーにする。
  const withInheritedText = (base: (p: any) => any) => (p: any) =>
    isBranchRow(p) ? { ...base(p), color: GRID_COLORS.inheritedText } : base(p);

  // 区分値・名称の表示値。販売計画選択の「選択」で引き継いだ値（設定先の
  // 親行が持つ）があればそれを優先し、無ければ従来どおり拡売費一覧のマスタから導出する。
  // 利用者が管理区分・施策区分などを選び直した場合は引き継ぎ値を破棄する
  //（管理・施策の区分／コードを選び直す各ハンドラで従属セルとしてクリアする）。
  const planLinkedOr =
    (field: keyof ExpenseRow, derive: (value: any) => string) => (p: any) => {
      const own = p.data?.[field];
      // 値が無いときはグレーの「-」（GRID_DEFAULT_COL_DEF と同じ）
      return (own ? String(own) : derive(p.value)) || GRID_EMPTY_TEXT;
    };

  const columnDefs: (ColDef | ColGroupDef)[] = useMemo(
    () => [
      {
        // 分割の枝番行の折りたたみボタン。
        // No. 列の左（チェックボックス列の右）に置き、親行にのみ表示する。
        // 幅はボタン（w-5＝1.25rem）とセル左右の余白が収まる最小限にとどめる。
        headerName: '',
        // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
        suppressColumnsToolPanel: true,
        headerComponent: BranchCollapseHeader,
        colId: 'branchCollapse',
        lockPinned: true,
        sortable: false,
        filter: false,
        resizable: false,
        editable: false,
        width: 32,
        minWidth: 32,
        maxWidth: 32,
        suppressAutoSize: true,
        cellRenderer: BranchCollapseCellRenderer,
        cellStyle: widgetStyle,
      },
      {
        headerName: 'No.',
        field: 'lineNo',
        ...GRID_NUMBER_FILTER,
        width: 80,
        // 左端の列にコピー・明細追加の帯を重ねる（_copySource を持たない行は何も付かない）。
        // 横寄せは共通クラスで指定する（→ 02 §6 セルの寄せ）
        cellClass: 'cell-left',
        cellStyle: (p: any) => ({
          ...groupStyle(p),
          ...copySourceLeftBorder(p.data?._copySource),
        }),
      },
      {
        // データ元：当該明細の作成元（請求EDI／AIC入力／手入力）。
        // 表示のみの非活性列（灰背景）。グループ合計行・総合計行は空白。
        headerName: 'データ元',
        colId: 'dataSource',
        field: 'dataSource',
        width: 80,
        valueGetter: (p: any) =>
          p.data?.isGroup || p.data?.isTotal ? '' : p.data?.dataSource,
        cellStyle: groupStyle,
        editable: false,
      },
      {
        // 商品名：請求EDIから連携された商品名をそのまま表示する。
        // 拡売費は請求EDIにサマリ商品が連携されない卸が多く、卸によって
        // 拡売費の内容が商品名の欄に入る場合と備考の欄に入る場合があるため、
        // 値が入る可能性がある項目として商品名と備考の両方を持たせる
        //（→ 20260821_第31回 決定事項8。卸ごとに読み替えるロジックは設けない）。
        headerName: '卸からの請求名称',
        field: 'billName',
        width: 192,
        valueGetter: branchParentValueGetter('billName'),
        cellStyle: withInheritedText(inputTextStyle),
        editable: editableExceptSummary,
      },
      {
        // 備考：請求EDIから連携された備考をそのまま表示する（→ 同 決定事項8）。
        headerName: '備考',
        field: 'billNote',
        width: 192,
        valueGetter: branchParentValueGetter('billNote'),
        cellStyle: withInheritedText(inputTextStyle),
        editable: editableExceptSummary,
      },
      {
        // 項目名は拡売費計画に合わせる（→ 20260821_第31回 決定事項7）。
        // メタブランド名＋ブランドコードの2行コンボで選ぶ活性列。
        // サマリ商品を選んでいる行はメタブランドがサマリ商品から決まるため選ばせない
        //（サマリ商品を「ー（指定なし）」へ戻すと再び選べる）。
        headerName: 'メタブランド',
        field: 'planExpContent',
        width: 192,
        valueGetter: branchParentValueGetter('planExpContent'),
        cellStyle: withInheritedText(metaBrandCellStyle),
        editable: (params: any) =>
          editableExceptSummary(params) && !hasSummaryProduct(params.data),
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: META_BRAND_COMBO_OPTIONS,
          placeholder: 'メタブランドを選択',
        },
      },
      {
        // 項目名は拡売費計画に合わせる（→ 20260821_第31回 決定事項7）。
        // サマリ商品名＋商品コードの2行コンボで選ぶ活性列（候補・表示とも
        // 計画詳細(マージン率固定・NET入力)のサマリ商品列にそろえる）。
        // 「ー（指定なし）」も選べ、選ぶとメタブランドも未選択へ戻る。
        headerName: 'サマリ商品',
        field: 'product',
        width: 176,
        valueGetter: branchParentValueGetter('product'),
        cellStyle: withInheritedText(inputTextStyle),
        editable: editableExceptSummary,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        // メタブランド選択時は該当するサマリ商品のみに絞り込む。
        cellEditorParams: (params: any) => ({
          comboOptions: summaryProductComboOptionsFor(
            params.data?.planExpContent
          ),
          placeholder: 'サマリ商品を選択',
        }),
        // サマリ商品を選ぶとメタブランドを自動で入れる。
        onCellValueChanged: handleSummaryProductChanged,
      },
      {
        // 請求金額：請求書に記載された金額。計画金額とは別の項目として行が独自に保持する
        //（値が一致する場合でも計画金額を参照しない）。
        // 枝番行（分割先・計画選択）は親行の内訳で請求単位ではないため空白。
        // 未承認NET一覧の明細行は請求書を持たないため「-」表示。
        //
        // 支払詳細画面へ反映した後に請求内容の誤りが判明した場合は、この欄を上書きして
        // 訂正する（項目は分けず直接上書きし、訂正後の金額を正とする）。
        // ただし請求EDIで連携された明細は修正させず、AIC入力の明細と画面で追加した
        // 明細（手入力）だけを修正できる（→ 20260821_第31回 決定事項13・14）。
        headerName: '請求金額',
        colId: 'billAmount',
        field: 'billAmount',
        ...GRID_NUMBER_FILTER,
        width: 96,
        valueGetter: (p: any) => {
          if (isBranchRow(p)) return '';
          if (isNetUnapprovedDetail(p)) return '-';
          return p.data?.billAmount;
        },
        // 円の金額のため整数で表示する（小数は出さない）。
        valueFormatter: intFmt,
        cellStyle: billAmountCellStyle,
        editable: isBillAmountEditable,
        // 数値入力ボックス（整数）。小数を入れても四捨五入して整数で保持する。
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: { precision: 0 },
        valueParser: intValueParser,
      },
      {
        // 枝番行は空白（分割の枝番行の金額は「負担金額」列で表す）。
        // 税込(円)・計画差異・合計の計算元（編集時に再計算される）。
        headerName: '支払金額',
        field: 'payAmount',
        ...GRID_NUMBER_FILTER,
        width: 96,
        valueGetter: branchBlankValueGetter('payAmount'),
        valueFormatter: intFmt,
        cellStyle: inputCellStyle,
        editable: editableExceptSummary,
        // 数値入力ボックス（整数）。小数を入れても四捨五入して整数で保持する。
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: { precision: 0 },
        valueParser: intValueParser,
        // 分割後も分割元明細は編集できるが、当該行の分割先（No.「X-枝番」）の
        // 分割金額合計を下回る値には変更できない（AG Grid 公式の valueSetter で拒否する）。
        // ※分割先の突き合わせは splitBranchTotal（キー＝「一覧:No.」）で行う。
        //   No. だけで突き合わせると、未承認NET明細が その他一覧の同じ No. の
        //   枝番行を自分の分割先と誤認し、入力値が不当に拒否される。
        valueSetter: (p: any) => {
          const next = toNum(p.newValue) ?? 0;
          const destTotal = splitBranchTotal(p.data);
          if (destTotal > 0 && next < destTotal) {
            toast.error(
              `支払金額は分割先の分割金額合計（${destTotal.toLocaleString('ja-JP')}円）を下回る値に変更できません。`
            );
            return false; // 変更を破棄して元の値へ戻す
          }
          p.data.payAmount = next;
          // 未承認NET明細は、手入力した時点で追加口O列との連動（自動上書き）を
          // 打ち切り、以降は入力値を保持する。
          if (p.data.isNetUnapproved) p.data.payAmountManual = true;
          return true;
        },
      },
      {
        // 負担金額（各部署が負担する金額）：
        //   分割の枝番行 … 当該行が持つ金額（分割先が負担する金額）。活性（白）。
        //   親行         … 支払金額から分割の枝番行の負担金額合計を引いた残り。非活性（灰）。
        //   合計行     … 空白。
        // ※field は指定せず valueGetter／valueSetter で payAmount を読み書きする
        //   （支払金額列と field が重複すると編集確定時にエディタが閉じないため）。
        headerName: '負担金額',
        colId: 'splitAmount',
        ...GRID_NUMBER_FILTER,
        width: 96,
        valueGetter: (p: any) => {
          if (isSplitDestRow(p)) return p.data?.payAmount;
          if (p.data?.isGroup || p.data?.isTotal) return '';
          return (toNum(p.data?.payAmount) ?? 0) - splitBranchTotal(p.data);
        },
        valueFormatter: intFmt,
        cellStyle: branchAmountCellStyle(isSplitDestRow),
        editable: (p: any) => isSplitDestRow(p),
        valueSetter: (p: any) => {
          p.data.payAmount = toNum(p.newValue) ?? 0;
          return true;
        },
      },
      {
        // 請求－支払：差額（請求金額 − 支払金額）。追加口明細と同じ位置づけの参照専用列。
        // 20260821_第31回 決定事項4 により、拡売費明細の「差異理由」を廃止して追加した。
        // 枝番行は請求単位ではないため空白。
        headerName: '請求－支払：差額',
        colId: 'billPayDiff',
        field: 'billPayDiff',
        ...GRID_NUMBER_FILTER,
        width: 104,
        valueGetter: (p: any) => {
          if (isBranchRow(p)) return '';
          const d = p.data as ExpenseRow | undefined;
          return d ? billPayDiffOf(d) : '';
        },
        // 円の金額のため整数で表示する（小数は出さない）。
        valueFormatter: intFmt,
        cellStyle: rightStyle,
        editable: false,
      },
      {
        // 照合支払区分（活性）。追加口明細と同じ選択肢を使う。
        headerName: '照合支払区分',
        colId: 'matchType',
        field: 'matchType',
        width: 104,
        valueGetter: branchParentValueGetter('matchType'),
        cellStyle: withInheritedText(inputTextStyle),
        editable: editableExceptSummary,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: MATCH_TYPE_COMBO_OPTIONS,
          placeholder: '照合支払区分を選択',
        },
      },
      // ── 商流・組織（販売店〜担当者）──────────────────────
      // 親行は画面の基本情報（販売店・三次店・一次店・部署・
      // 営業担当者）の値を非活性（灰・グレー文字）で表示し、分割の枝番行のみ
      // 分割先ごとの値を選択できる。連動・候補は費用分割の分割先明細と同じ。
      {
        // 販売店：商流（一次店・三次店）の配下に絞り込み、費用負担部署が選択済みなら
        // その部署に紐づく販売店だけに絞り込む（販売店:費用負担部署 ＝ N:N）。
        headerName: '販売店',
        field: 'splitStore',
        width: 160,
        valueGetter: storeOrgValueGetter('store'),
        cellStyle: storeOrgCellStyle,
        editable: isSplitDestRow,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: (params: any) => {
          const linked = storesForDept(params.data?.splitDept ?? '');
          const options = storeOptionsFor(
            params.data?.splitPrimaryStore ?? '',
            params.data?.splitTertiaryStore ?? ''
          );
          return {
            comboOptions: linked
              ? options.filter(
                  (o) => o.value === STORE_NONE || linked.includes(o.value)
                )
              : options,
            placeholder: '販売店を選択',
          };
        },
        onCellValueChanged: handleStoreOrgCascade('store'),
      },
      {
        // 三次店：当該行の一次店の配下に絞り込む。選択すると一次店を自動設定する。
        headerName: '三次店',
        field: 'splitTertiaryStore',
        width: 160,
        valueGetter: storeOrgValueGetter('tertiaryStore'),
        cellStyle: storeOrgCellStyle,
        editable: isSplitDestRow,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: (params: any) => ({
          comboOptions: tertiaryOptionsFor(
            params.data?.splitPrimaryStore ?? ''
          ),
          placeholder: '三次店を選択',
        }),
        onCellValueChanged: handleStoreOrgCascade('tertiaryStore'),
      },
      {
        // 一次店：全件から選択。選択すると配下でなくなった三次店・販売店をクリアする。
        headerName: '一次店',
        field: 'splitPrimaryStore',
        width: 176,
        valueGetter: storeOrgValueGetter('primaryStore'),
        cellStyle: storeOrgCellStyle,
        editable: isSplitDestRow,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: PRIMARY_STORE_OPTIONS,
          placeholder: '一次店を選択',
        },
        onCellValueChanged: handleStoreOrgCascade('primaryStore'),
      },
      {
        // 費用負担部署：当該行の販売店に紐づく候補へ絞り込む。
        headerName: '費用負担部署',
        field: 'splitDept',
        width: 160,
        valueGetter: storeOrgValueGetter('dept'),
        cellStyle: storeOrgCellStyle,
        editable: isSplitDestRow,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: (params: any) => ({
          comboOptions: deptOptionsFor(params.data?.splitStore ?? ''),
          placeholder: '費用負担部署を選択',
        }),
        onCellValueChanged: handleStoreOrgCascade('dept'),
      },
      {
        // 担当者：当該行の販売店・費用負担部署に紐づく候補へ絞り込む。
        headerName: '営業担当者',
        field: 'splitStaff',
        width: 128,
        valueGetter: storeOrgValueGetter('staff'),
        cellStyle: storeOrgCellStyle,
        editable: isSplitDestRow,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: (params: any) => ({
          comboOptions: staffOptionsFor(
            params.data?.splitStore ?? '',
            params.data?.splitDept ?? ''
          ),
          placeholder: '担当者を選択',
        }),
        onCellValueChanged: handleStoreOrgCascade('staff'),
      },
      {
        // 管理区分は名称（mgmtClass）を保持し、区分値は名称から導出表示する
        //（費用分割の分割先明細と同一モデル。区分値・名称は列側で相互導出）。
        // 名称＋区分値の2行コンボで選択する活性列。分割の枝番行は自身の値を編集でき、
        // 合計行・グループ合計行は非活性（灰）。
        headerName: '管理区分',
        colId: 'mgmtClassCode',
        field: 'mgmtClass',
        width: 104,
        valueGetter: splitOwnValueGetter('mgmtClass'),
        valueFormatter: planLinkedOr(
          'planMgmtClassCode',
          managementClassCodeOf
        ),
        cellStyle: splitEditableTextStyle,
        editable: editableExceptPlanBranch,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: managementClassOptions,
          placeholder: '管理区分を選択',
        },
        // 管理区分の変更時、該当しない管理コードはクリアする。
        onCellValueChanged: handleMgmtClassChanged,
      },
      {
        // 管理区分名称：mgmtClass（名称）を表示・選択できる活性列。
        // 名称列からの選択でも管理区分（mgmtClass）を更新する（管理区分列と相互連動）。
        headerName: '管理区分名称',
        colId: 'mgmtClassName',
        field: 'mgmtClass',
        width: 160,
        valueGetter: splitOwnValueGetter('mgmtClass'),
        cellStyle: splitEditableTextStyle,
        editable: editableExceptPlanBranch,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: managementClassOptions,
          placeholder: '管理区分名称を選択',
        },
        onCellValueChanged: handleMgmtClassChanged,
      },
      {
        // 管理コード：コードを保持・表示。コード＋名称の2行コンボで選択する活性列。
        // 管理区分が選択済みなら該当コードのみに絞り込む。
        headerName: '管理コード',
        colId: 'mgmtCodeCode',
        field: 'mgmtCode',
        width: 104,
        valueGetter: splitOwnValueGetter('mgmtCode'),
        cellStyle: splitEditableTextStyle,
        editable: editableExceptPlanBranch,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: (params: any) => ({
          comboOptions: managementCodeComboOptions(
            managementCodeCandidates(params.data?.mgmtClass ?? '')
          ),
          placeholder: '管理コードを選択',
        }),
        // 管理コードの選択で対応する管理区分を自動セットする。
        onCellValueChanged: handleMgmtCodeChanged,
      },
      {
        // 管理コード名称：名称を選択できる活性列。名称→コードへ一意に逆引きして
        // mgmtCode に保持し、管理コード（コード）列と相互連動する。
        headerName: '管理コード名称',
        colId: 'mgmtCodeName',
        width: 160,
        valueGetter: (p: any) =>
          p.data?.planMgmtCodeName ||
          managementCodeName(splitOwnValueGetter('mgmtCode')(p)),
        valueSetter: (p: any) => {
          p.data.mgmtCode = managementCodeOfName(p.newValue);
          return true;
        },
        cellStyle: splitEditableTextStyle,
        editable: editableExceptPlanBranch,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: (params: any) => ({
          comboOptions: managementCodeNameComboOptions(
            managementCodeCandidates(params.data?.mgmtClass ?? '')
          ),
          placeholder: '管理コード名称を選択',
        }),
        onCellValueChanged: handleMgmtCodeChanged,
      },
      {
        // 施策区分（コード＝区分値）。名称(上)・区分値(下) のコンボで編集する（値は measureClass に保持）。
        // 表示は区分値、編集は施策区分の選択で行う（活性列）。
        headerName: '施策区分',
        colId: 'measureClassCode',
        field: 'measureClass',
        width: 88,
        valueGetter: splitOwnValueGetter('measureClass'),
        valueFormatter: planLinkedOr('planMeasureClassCode', campaignClassCode),
        cellStyle: splitEditableTextStyle,
        editable: editableExceptPlanBranch,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: campaignClassComboOptions(
            EXPENSE_CAMPAIGN_CLASS_OPTIONS.map((o) => o.value)
          ),
          placeholder: '施策区分を選択',
        },
        // 施策区分の変更時、該当しない施策コードはクリアする。
        onCellValueChanged: handleCampaignClassChanged,
      },
      {
        // 施策区分名称：measureClass（名称）を表示・選択できる活性列。
        // 名称列からの選択でも施策区分（measureClass）を更新する
        //（計画詳細(NET固定) 拡売費計画と同様）。
        headerName: '施策区分名称',
        colId: 'measureClassName',
        field: 'measureClass',
        width: 120,
        valueGetter: splitOwnValueGetter('measureClass'),
        cellStyle: splitEditableTextStyle,
        editable: editableExceptPlanBranch,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: campaignClassComboOptions(
            EXPENSE_CAMPAIGN_CLASS_OPTIONS.map((o) => o.value)
          ),
          placeholder: '施策区分名称を選択',
        },
        // 施策区分名称の変更時、該当しない施策コードはクリアする。
        onCellValueChanged: handleCampaignClassChanged,
      },
      {
        // 施策コード（コード）。コード(上)・名称(下) のコンボで編集する（値は measureCode に保持）。
        // 施策区分が選択済みなら該当コードのみに絞り込む。
        headerName: '施策コード',
        colId: 'measureCodeCode',
        field: 'measureCode',
        width: 104,
        valueGetter: splitOwnValueGetter('measureCode'),
        cellStyle: splitEditableTextStyle,
        editable: editableExceptPlanBranch,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: (params: any) => ({
          comboOptions: campaignCodeComboOptions(
            EXPENSE_CAMPAIGN_CODE_OPTIONS.filter(
              (o) =>
                !params.data.measureClass ||
                isCampaignCodeInClass(o.value, params.data.measureClass)
            ).map((o) => o.value)
          ),
          placeholder: '施策コードを選択',
        }),
        // 施策コードの変更時、対応する施策区分を自動セットする。
        onCellValueChanged: handleCampaignCodeChanged,
      },
      {
        // 施策コード名称：施策コード（measureCode）の名称を表示・選択できる活性列。
        // 名称列からの選択で施策コード（measureCode）を設定し、施策区分も自動セットする
        //（計画詳細(NET固定) 拡売費計画と同様）。値はコードを保持し、名称で絞り込む。
        headerName: '施策コード名称',
        colId: 'measureCodeName',
        field: 'measureCode',
        width: 152,
        valueGetter: splitOwnValueGetter('measureCode'),
        valueFormatter: planLinkedOr('planMeasureCodeName', campaignCodeNameOf),
        cellStyle: splitEditableTextStyle,
        editable: editableExceptPlanBranch,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: (params: any) => ({
          // 値＝施策コード、ラベル＝施策コード名称（名称で絞り込んで選択できる）。
          comboOptions: EXPENSE_CAMPAIGN_CODE_OPTIONS.filter(
            (o) =>
              !params.data.measureClass ||
              isCampaignCodeInClass(o.value, params.data.measureClass)
          ).map((o) => ({
            value: o.value,
            label: campaignCodeNameOf(o.value),
            code: `施策コード: ${o.value}`,
          })),
          placeholder: '施策コード名称を選択',
        }),
        // 施策コード名称の変更時、対応する施策区分を自動セットする。
        onCellValueChanged: handleCampaignCodeChanged,
      },
      {
        // 摘要1・摘要2は施策コード名称の右に置く（一次店〜摘要2（社外用）を1つの
        // まとまりとし、分割の枝番行では分割先ごとの値を編集できるようにするため）。
        headerName: '摘要1（社内用）',
        field: 'summary1',
        width: 128,
        valueGetter: splitOwnValueGetter('summary1'),
        cellStyle: splitEditableTextStyle,
        editable: editableExceptPlanBranch,
      },
      {
        headerName: '摘要2（社外用）',
        field: 'summary2',
        width: 128,
        valueGetter: splitOwnValueGetter('summary2'),
        cellStyle: splitEditableTextStyle,
        editable: editableExceptPlanBranch,
      },
      // 稟議番号・稟議決裁日・稟議区分は項目として設けない。現A-FRAME担当・
      // 運用基準書担当にも確認のうえ、自販機と同じく不要で確認が取れている
      //（→ 課題 No.1128 2026-08-07 ASD芳賀回答）。
      // 勘定科目別金額は項目として設けない。現行の使われ方を調べても支払金額と
      // 同じ値を転記しているだけであり、新システムでは不要と判断された
      //（→ 課題 No.1129 2026-08-17 ASD加藤回答）。
      {
        // 税区分（活性）。税込金額は支払画面に表示しない（→ 20260710_第16回 決定事項12）。
        headerName: '税区分',
        field: 'taxClass',
        width: 104,
        valueGetter: branchParentValueGetter('taxClass'),
        // 管理区分に紐づく税区分がある明細（1B3＝課税8%:2）は非活性（灰）にする（→ C79）。
        cellStyle: withInheritedText(taxClassCellStyle),
        editable: (params: any) =>
          editableExceptSummary(params) &&
          !linkedTaxClassOf(params.data?.mgmtClass),
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: TAX_CLASS_COMBO_OPTIONS,
          placeholder: '税区分を選択',
        },
      },
      {
        headerName: '請求書番号',
        field: 'billNo',
        width: 104,
        valueGetter: branchParentValueGetter('billNo'),
        cellStyle: invoiceRefCellStyle,
        editable: isInvoiceRefEditable,
      },
      {
        headerName: '請求書ページ',
        field: 'billPage',
        width: 88,
        valueGetter: branchParentValueGetter('billPage'),
        cellStyle: invoiceRefCellStyle,
        editable: isInvoiceRefEditable,
      },
      {
        // 操作メニュー（分割・コピー・削除・追加口処理）。
        // 支払詳細(自販機) 経費項目一覧の操作列と同様。
        // 一番右に右固定。未承認NET一覧のみ表示（その他一覧では非表示）。
        headerName: '',
        // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
        suppressColumnsToolPanel: true,
        colId: 'rowMenu',
        pinned: 'right',
        lockPinned: true,
        sortable: false,
        filter: false,
        resizable: false,
        editable: false,
        width: 45,
        minWidth: 45,
        maxWidth: 45,
        suppressAutoSize: true,
        cellRenderer: RowMenuCellRenderer,
        cellStyle: widgetStyle,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 列定義は最初の描画で1回だけ作る（作り直すと列幅・並びが戻る）。中の関数が読むのは描画で変わらない値（変更ハイライトの判定・makeHandler・ref・画面ごとに固定の variant）だけ
    []
  );

  const defaultColDef: ColDef = useMemo(
    () => ({
      // 共通の既定列定義（grid/）。ソート/リサイズ/フィルター、ヘッダーの…メニュー・
      // フィルターボタン非表示、tooltip を内包。フィルターは右クリックメニューから開く。
      ...GRID_DEFAULT_COL_DEF,
      // 合計行・グループ行の文字列が数値型と推論されるのを防ぐ
      cellDataType: false,
      // 計算式セルは計算式テキストを、それ以外は従来どおりセル値をツールチップ表示する。
      tooltipValueGetter: (params) => {
        // セルのツールチップでは colDef は列（ColDef）。列グループ（ColGroupDef）は来ない
        const field = (params.colDef as ColDef).field;
        const row = params.data as ExpenseRow | undefined;
        if (field && row && isFormulaCell(field, row)) {
          return FORMULA_DEFS[field].tooltip(row);
        }
        return params.value ?? '';
      },
      // マウスオーバー中の計算式セルの参照元セル（`field::rowId`）に枠線を付ける。
      // 共通の決まり（値が無いセルを灰色の「-」にする cell-empty など）を引き継ぐ（→ UI/UX UX-080）。
      cellClassRules: {
        ...GRID_DEFAULT_COL_DEF.cellClassRules,
        'formula-ref-highlight': (params) => {
          // セルのツールチップでは colDef は列（ColDef）。列グループ（ColGroupDef）は来ない
          const field = (params.colDef as ColDef).field;
          const rowId = params.node?.id ?? '';
          return !!field && hoverRefsRef.current.has(`${field}::${rowId}`);
        },
      },
    }),
    []
  );

  // 「追加口処理」ボタン押下時の処理。
  //   ・当該その他明細を一覧から削除する。
  //   ・追加口由来の行（sourceLineNo 保持）は、親へ通知して追加口の該当行の
  //     「拡売費処理」を「-」へ戻す（戻し処理）。
  const handleRevert = (data: ExpenseRow) => {
    // 当該明細を拡売費一覧から外し、追加口一覧へ移す。
    // 枝番行（分割先）を持つ親行は、内訳の枝番行も併せて外す。
    const parentKey = branchParentKeyOf(data);
    setRows((prev) =>
      prev.filter(
        (r) =>
          r !== data &&
          !(isBranchData(r) && branchParentKeyOfBranch(r) === parentKey)
      )
    );
    onRevertToAddition?.(data);
  };

  // 操作メニュー「削除」：当該行を一覧から削除する（明細行・分割の枝番行のいずれも）。
  const handleDeleteRow = (data: ExpenseRow) => {
    setRows((prev) => prev.filter((r) => r !== data));
  };

  // 操作メニュー「コピー」：当該行を複製して直下に挿入する。
  // 分割の枝番行の場合は No. を「親No.-枝番」で採番し直し（既存の最大枝番＋1）、
  // 当該親行の分割の枝番行の直後へ挿入する。
  const handleRowMenuCopy = (data: ExpenseRow) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r === data);
      if (!isSplitDestData(data)) {
        // 明細行の複製は No. を採番し直す（同じ一覧の明細行の最大 No.＋1）。
        // No. をそのまま複製すると、分割の枝番の採番や販売計画選択の対象行の
        // 突き合わせが同じ No. の行を取り違えるため。
        // コピーした行は左端の帯（拡売費コピー）で示す（帯を付ける画面のみ）。
        // データ元は、画面の操作で作った明細であることを表すため「手入力」に変える
        // （請求EDI・AIC入力の明細をコピーしても、コピー先は請求と1対1で対応しないため）。
        const copy = markCopySource<ExpenseRow>(
          {
            ...data,
            // 複製元と別の行として扱うため、行ID は新しく振る。
            _rowId: newExpenseRowId(),
            sourceLineNo: undefined,
            lineNo: nextDetailLineNo(prev, listKeyOf(data)),
            dataSource: DEFAULT_DATA_SOURCE,
            // コピーした明細は画面で作った明細のため、活性も手入力として扱う。
            originDataSource: undefined,
          },
          'detail',
          showCopySourceBand
        );
        // コピーした行を強調対象にする（行が反映された後にフラッシュされる）
        reveal.markRows([copy]);
        const next = [...prev];
        next.splice(idx < 0 ? prev.length : idx + 1, 0, copy);
        return next;
      }
      if (idx < 0) return prev;
      const parentKey = parentLineNoOfRow(data);
      if (!parentKey) return prev;
      // 枝番行のコピーも左端の帯（拡売費コピー）で示す（帯を付ける画面のみ）。
      const copy = markCopySource<ExpenseRow>(
        {
          ...data,
          // 複製元と別の行として扱うため、行ID は新しく振る。
          _rowId: newExpenseRowId(),
          sourceLineNo: undefined,
          lineNo: `${parentKey}-${nextSplitBranchNo(prev, parentKey, listKeyOf(data))}`,
        },
        'detail',
        showCopySourceBand
      );
      // コピーした行を強調対象にする（行が反映された後にフラッシュされる）
      reveal.markRows([copy]);
      let insertAt = idx + 1;
      while (
        insertAt < prev.length &&
        isSplitDestData(prev[insertAt]) &&
        parentLineNoOfRow(prev[insertAt]) === parentKey
      ) {
        insertAt += 1;
      }
      const next = [...prev];
      next.splice(insertAt, 0, copy);
      return next;
    });
  };

  // 操作メニュー「分割」：押下した親行に対し、分割の枝番行を1行追加する。
  // No. は「親No.-枝番」（既存の分割の枝番行の最大枝番＋1）で採番し、当該親行の
  // 分割の枝番行の直後へ挿入する。
  // 一次店〜摘要2（社外用）は親行の値を初期値とする
  //（商流・組織は親行が画面の基本情報を表示するため、その値を引き継ぐ）。
  const handleAddSplitBranch = (data: ExpenseRow) => {
    const parentKey = String(data.lineNo);
    setRows((prev) => {
      const idx = prev.findIndex((r) => r === data);
      if (idx < 0) return prev;
      const branchNo = nextSplitBranchNo(prev, parentKey, listKeyOf(data));
      const newRow: ExpenseRow = {
        ...BLANK,
        ...inheritedFromParent(data),
        lineNo: `${parentKey}-${branchNo}`,
        costSplit: '分割先',
        // 負担金額は未入力（0）から始め、利用者が分割先の負担分を入力する。
        payAmount: 0,
        planAmount: 0,
        splitPrimaryStore: basicInfo.primaryStore,
        splitTertiaryStore: basicInfo.tertiaryStore,
        splitStore: basicInfo.store,
        splitDept: basicInfo.dept,
        splitStaff: basicInfo.staff,
        mgmtClass: data.mgmtClass,
        mgmtCode: data.mgmtCode,
        measureClass: data.measureClass,
        measureCode: data.measureCode,
        summary1: data.summary1,
        summary2: data.summary2,
      };
      let insertAt = idx + 1;
      while (
        insertAt < prev.length &&
        isSplitDestData(prev[insertAt]) &&
        parentLineNoOfRow(prev[insertAt]) === parentKey
      ) {
        insertAt += 1;
      }
      const next = [...prev];
      next.splice(insertAt, 0, newRow);
      return next;
    });
    // 追加した枝番行がすぐ確認できるよう、当該親行の折りたたみを開く。
    // キーは外部フィルタ（doesExternalFilterPass）と同じ「一覧:No.」形式にする。
    // No. だけにすると判定と一致せず、枝番行が表示されないままになる。
    setExpandedBranches((prev) => new Set([...prev, branchParentKeyOf(data)]));
  };

  // チェックボックス列ヘッダーの「計画選択」アイコンの対象行。
  // 表示中（未承認NET／その他の絞り込み後）の明細行のみを対象にする。
  const displayedPlanTargetNodes = (): IRowNode[] => {
    const api = gridApiRef.current;
    if (!api) return [];
    const nodes: IRowNode[] = [];
    for (let i = 0; i < api.getDisplayedRowCount(); i += 1) {
      const node = api.getDisplayedRowAtIndex(i);
      if (node && isPlanTargetSelectable(node)) nodes.push(node);
    }
    return nodes;
  };

  // 表示中の明細が全てチェック済みか（ヘッダーのアイコンの操作内容の判定に使う）。
  const isAllPlanTargetsSelected = () => {
    const nodes = displayedPlanTargetNodes();
    return nodes.length > 0 && nodes.every((node) => node.isSelected());
  };

  // ヘッダーの「計画選択」アイコン押下：表示中の明細を全てチェック／全て解除する。
  const handleToggleAllPlanTargets = () => {
    const api = gridApiRef.current;
    const nodes = displayedPlanTargetNodes();
    if (!api || nodes.length === 0) return;
    api.setNodesSelected({ nodes, newValue: !isAllPlanTargetsSelected() });
  };

  // 計画紐づけステータスのアイコン押下：「未紐付」⇔「計画なし」を切り替える。
  // 紐づけ済み（planLinked）の行はアイコンを押下できないため、ここへは到達しない。
  const handleTogglePlanNoTarget = (data: ExpenseRow) => {
    setRows((prev) =>
      prev.map((r) =>
        r === data ? { ...r, planNoTarget: !r.planNoTarget } : r
      )
    );
  };

  // セルの色の凡例。移動を示す薄い紫は、明細を移す操作を持つ画面でのみ出す。
  const colorLegendItems = useMemo(
    () =>
      hasNetGroup
        ? [TRANSFERRED_LEGEND_ITEM, ...EXPENSE_COLOR_LEGEND]
        : EXPENSE_COLOR_LEGEND,
    [hasNetGroup]
  );

  const gridContext = {
    // 画面差分（操作メニューの出し分けに使う）。
    hasNetGroup,
    // 分割の枝番行の折りたたみボタン（親行の左端）から参照する。
    hasBranch: hasBranchRow,
    isCollapsed: (row: ExpenseRow) =>
      !expandedBranches.has(branchParentKeyOf(row)),
    onToggleCollapse: handleToggleCollapse,
    // 折りたたみ機能列のヘッダーのアイコン（一括開閉）から参照する。
    // ヘッダーは再描画されても context を作り直さないため、最新の状態は ref から読む。
    hasAnyBranch: () => branchParentKeys().length > 0,
    isAllBranchExpanded: () => {
      const parents = branchParentKeys();
      return (
        parents.length > 0 &&
        parents.every((key) => expandedBranchesRef.current.has(key))
      );
    },
    onToggleAllCollapse: handleToggleAllCollapse,
    // チェックボックス列のヘッダー（計画選択アイコン）から参照する。
    // ヘッダーは再描画されても context を作り直さないため、最新の状態はグリッドから読む。
    hasPlanTarget: () => displayedPlanTargetNodes().length > 0,
    isAllPlanTargetsSelected,
    onToggleAllPlanTargets: handleToggleAllPlanTargets,
    // 操作メニュー「分割」押下：当該親行に分割の枝番行を1行追加する。
    onSplitCost: (data: ExpenseRow) => handleAddSplitBranch(data),
    onRevert: (data: ExpenseRow) => handleRevert(data),
    // 操作メニュー「削除」押下：当該その他明細を一覧から削除する。
    onDeleteRow: (data: ExpenseRow) => handleDeleteRow(data),
    // 操作メニュー「振替」押下：費用振替画面（下ペイン）を開く。
    onTransfer: (data: ExpenseRow) => onOpenTransfer?.(data),
    // 操作メニュー「コピー」（分割は onSplitCost を共用。削除は無効）。
    onCopyRow: (data: ExpenseRow) => handleRowMenuCopy(data),
    // 当該明細（親行）が分割の枝番行を持つか。「削除」の活性判定に使う。
    // ※No. は未承認NET／その他の一覧で重複するため、キー（一覧:No.）で突き合わせる。
    hasAnyBranchOfRow: (data?: ExpenseRow) =>
      !!data &&
      rowsRef.current.some(
        (r) =>
          isBranchData(r) &&
          branchParentKeyOfBranch(r) === branchParentKeyOf(data)
      ),
    // 計画紐づけステータスのアイコン押下：「未紐付」⇔「計画なし」を切り替える。
    onTogglePlanNoTarget: (data: ExpenseRow) => handleTogglePlanNoTarget(data),
  };

  // タイトル下の合計サマリーバーの表示構成（Excel「拡売費合計」に準拠）。
  // 「合計」＋総合計（支払金額）＋未承認NET拡売費／その他拡売費の各（支払金額）。
  const summaryTotals = useMemo(
    () => [{ label: '支払金額', value: fmtPay(summary.grandPay) }],
    [summary]
  );
  const summaryGroups = useMemo(
    () =>
      hasSummaryGroups
        ? [
            {
              label: '未承認NET拡売費',
              items: [{ label: '支払金額', value: fmtPay(summary.netPay) }],
            },
            {
              label: 'その他拡売費',
              items: [{ label: '支払金額', value: fmtPay(summary.otherPay) }],
            },
          ]
        : [],
    [summary, hasSummaryGroups]
  );

  return (
    <CollapsibleCard
      title={<h2 className={CARD_TITLE_CLASS}>拡売費</h2>}
      open={isCardOpen}
      onOpenChange={setIsCardOpen}
      contentClassName="p-4"
      headerActions={
        /* 操作ボタン（拡売費計画引用／明細追加／未承認NET・その他トグル）
           ※「添付資料登録」は支払明細情報のヘッダへ移動。 */
        <div className="flex items-center gap-2">
          {/* 拡売費計画引用（拡売費計画引用の下ペインを表示）。
              未承認NET／その他のどちらの一覧でも活性とし、表示中の一覧を渡して開く。
              明細を選ばずにグリッド外のボタンから開始できるようにする。
              設定先は利用者がチェックボックス列で選ぶ（未承認NET一覧でも自動では
              チェックしない → 20260821_第31回 宿題事項3）。 */}
          <button
            onClick={() => onOpenPlanSelection?.(activeExpenseGroup)}
            className="btn-toolbar-outline"
            aria-label="拡売費計画引用"
          >
            <Copy className="h-4 w-4" />
            拡売費計画引用
          </button>
          {/* 明細追加：その他選択時のみ活性、未承認NET選択時は非活性。
              未承認NETへの明細追加は行わず、追加口明細の「追加口NET」「支払NET」の
              金額を修正することで対応する（拡売費側へ自動連動する）。 */}
          <button
            onClick={() => onOpenAddExpense?.()}
            disabled={activeExpenseGroup === 'net'}
            className="btn-toolbar-outline"
            aria-label="明細追加"
          >
            <Plus className="h-4 w-4" />
            明細追加
          </button>
          {/* 未承認NET／その他 切り替えボタン（計画詳細(NET固定)の集計タブと同テーマのセグメント）。
              区分を持たない画面（請求書無）では出さない。 */}
          {hasNetGroup && (
            <div className="flex border-2 border-blue-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setActiveExpenseGroup('net')}
                className={`px-4 py-1 h-8 whitespace-nowrap text-sm font-medium transition-colors ${
                  activeExpenseGroup === 'net'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-blue-600 hover:bg-blue-50'
                }`}
              >
                未承認NET
              </button>
              <div className="w-px bg-blue-600" />
              <button
                onClick={() => setActiveExpenseGroup('other')}
                className={`px-4 py-1 h-8 whitespace-nowrap text-sm font-medium transition-colors ${
                  activeExpenseGroup === 'other'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-blue-600 hover:bg-blue-50'
                }`}
              >
                その他
              </button>
            </div>
          )}
        </div>
      }
    >
      <>
        {/* 合計サマリーバー（Excel「拡売費合計」に準拠）。
          「合計」＋総合計（支払金額／計画金額）＋未承認NET拡売費／その他拡売費の各（支払金額／計画金額）。
          合計バーの右の余白には、明細の操作メニューで行える分割・追加口処理の説明を置く。 */}
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          {/* 支払詳細(追加口請求書有／追加口請求書無)は、合計サマリーバーの代わりに合計表を出す
              （Excel「拡売費カード」B13:K16）。 */}
          {hasBreakdownTable ? (
            <PaymentAmountBreakdownTable
              className="min-w-0 max-w-full"
              ariaLabel="拡売費の合計"
              items={[
                {
                  label: '合計',
                  breakdown: summary.breakdown,
                  isBillUnavailable: variant === 'without-invoice',
                },
              ]}
              // 支払詳細(追加口請求書無)は、マイナスを「-」符号で表示する（括弧では分かりにくいため）。
              negativeFormat={
                variant === 'without-invoice' ? 'minus' : 'parentheses'
              }
              // データ元別の列は、請求書有＝請求EDI・AIC入力・手入力、
              // 請求書無＝AIC入力・手入力（→ constants/dataSource.ts）。
              // 請求書無は請求を扱わないため、請求・差額の行は「-」とする。
              dataSourceColumns={
                variant === 'without-invoice'
                  ? WITHOUT_INVOICE_DATA_SOURCE_COLUMNS
                  : WITH_INVOICE_DATA_SOURCE_COLUMNS
              }
            />
          ) : (
            <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              {/* 合計ラベル（全高・左揃え） */}
              <div className="flex shrink-0 items-center border-r border-gray-200 px-4 text-left text-sm font-bold text-gray-900 whitespace-nowrap">
                合計
              </div>
              {/* 総合計（支払金額／計画金額。全高で表示） */}
              {summaryTotals.map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col items-end justify-center border-r border-gray-200 px-3 py-1 last:border-r-0 min-w-42"
                >
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {item.label}
                  </span>
                  <span className="text-sm font-bold whitespace-nowrap text-blue-700">
                    {item.value}
                  </span>
                </div>
              ))}
              {/* グループ（未承認NET拡売費／その他拡売費） */}
              {summaryGroups.map((group) => (
                <div
                  key={group.label}
                  className="flex flex-col border-r border-gray-200 last:border-r-0"
                >
                  {/* グループ見出し（左揃え） */}
                  <div className="border-b border-gray-200 bg-gray-100 px-2 py-1 text-left text-xs font-bold text-gray-700 whitespace-nowrap">
                    {group.label}
                  </div>
                  {/* グループ内の項目（支払金額／計画金額） */}
                  <div className="flex flex-1 items-stretch divide-x divide-gray-200">
                    {group.items.map((item) => (
                      <div
                        key={item.label}
                        className="flex flex-col items-end px-3 py-1 min-w-42"
                      >
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {item.label}
                        </span>
                        <span className="text-sm font-bold whitespace-nowrap text-gray-900">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* 分割・追加口処理の説明（明細の右端の操作メニューから行う操作）。 */}
          <div className="flex-1 text-sm leading-normal text-gray-700 min-w-96">
            <p>
              分割：明細の下に枝番付きの行（1-1、1-2…）を足します。分割先の商流・
              費用負担部署・担当者と負担金額を、枝番付きの行に直接入力してください。
            </p>
            {/* 追加口処理は未承認NET一覧の操作メニューにのみ置くため、
                区分を持たない画面（請求書無）では説明も出さない。 */}
            {hasNetGroup && (
              <p>
                追加口処理：この明細を拡売費から外し、追加口明細へ移します。追加口から
                「拡売費処理」で移してきた明細は、元の追加口明細へ戻ります。
              </p>
            )}
          </div>
        </div>

        {/* セルの色の凡例。どの色が何を表すかを一覧の直前で示す。
            帯を付ける画面では、左端の帯（拡売費コピー／新規追加）の凡例を並べる。
            拡売費計画引用は帯を付けず、従来どおりセルの青背景で示すため、青（コピー元）の凡例は出さない。
            ラベルは計画詳細(マージン率固定・NET入力)の拡売費計画と同じ「拡売費コピー」にそろえる。 */}
        {showCopySourceBand ? (
          <div className="mb-2 flex flex-wrap items-center gap-x-6 gap-y-1">
            <CellColorLegend items={colorLegendItems} />
            <CopySourceLegend
              showReference={false}
              detailLabel="拡売費コピー"
            />
          </div>
        ) : (
          <CellColorLegend className="mb-2" items={colorLegendItems} />
        )}

        {/* 画面のいちばん下の表は、画面いっぱいの高さにする（UX-099 → 05「画面いっぱいのグリッド」）。
            最下部までスクロールした状態で表が画面（ヘッダーとボタンの列のあいだ）にちょうど収まる高さ。
            下ペインを開いている間はペインの高さだけ低くなる（viewportGridHeight）。下端のバーで高さは変えない */}
        <div
          className="expense-grid"
          style={{
            height: viewportGridHeight(PAYMENT_EXPENSE_GRID_OFFSET_REM),
            minHeight: '25rem',
            width: '100%',
          }}
        >
          {/* 罫線・ヘッダ背景・行高は共通テーマ（GRID_THEME）に委譲。 */}
          <style>{`
          /* 選択チェックボックス列（先頭列・列幅は selectionColumnDef で指定）。
             grid.css の先頭列ルールは、セルの最小幅を 3.75rem に広げ（列幅より広い）、
             さらに中央寄せ・padding:0 を強制する。このため列幅を詰めると
             チェックボックスが列の右外へはみ出し、隣の列（折りたたみ機能列）のセルに
             覆われて一部が欠ける。当グリッドでは
               ・最小幅の指定を解除してセルの箱を列幅に一致させる
               ・ヘッダーのチェックボックスと同じ位置になるよう、左寄せ＋
                 他セルと同じ左右余白へ戻す
             ことで、チェックボックス全体が列内に収まるようにする。 */
          .expense-grid .ag-cell[aria-colindex="1"],
          .expense-grid .ag-header-cell[aria-colindex="1"] {
            min-width: 0;
          }
          .expense-grid .ag-cell[aria-colindex="1"] {
            justify-content: flex-start;
            padding-inline: var(--ag-cell-horizontal-padding, 0.5rem);
          }
          /* 計算式セルにホバー中、計算に使われる参照元セルの枠線ハイライト */
          .expense-grid .ag-cell.formula-ref-highlight {
            box-shadow: inset 0 0 0 2px var(--grid-source-highlight-border);
          }
        `}</style>
          <AgGridReact
            rowData={displayRows}
            getRowId={getExpenseRowId}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getContextMenuItems={gridFilterContextMenuItems}
            onRowDataUpdated={reveal.onRowDataUpdated}
            onCellValueChanged={handleCellValueChanged}
            onModelUpdated={(p) => {
              // セル編集中は再集計しない。applyExpenseFormulas 内の
              // refreshCells({ force: true }) が編集中セルのエディタを破棄し、
              // 「ダブルクリックで一瞬だけ編集モードに入りすぐ解除される」事象を招くため。
              // 値変更後の再集計は onCellValueChanged、行増減後は非編集時の本コールバックで行う。
              if (p.api.getEditingCells().length > 0) return;
              // 行の増減（追加口からの転記・戻し）後に、グループ小計・総合計と
              // タイトル下の合計サマリーバーを再集計する。
              setSummary(applyExpenseFormulas(p.api, netRef.current));
            }}
            onCellMouseOver={handleCellMouseOver}
            onCellMouseOut={handleCellMouseOut}
            // 計算式をツールチップで見せるため、省略されていないセルでも出す（グローバルは whenTruncated）
            tooltipShowMode="standard"
            // 折りたたみ機能列の左に選択チェックボックス列を置く。
            // 販売計画選択（下ペイン）の「選択」で項目を設定する対象を、この列で選ぶ。
            rowSelection={PLAN_TARGET_ROW_SELECTION}
            // 合計行・グループ合計行は明細ではないためチェックできないようにする。
            isRowSelectable={isPlanTargetSelectable}
            // チェックの増減に合わせてヘッダーの「計画選択」アイコンの操作内容
            //（全てチェック／全て解除）を描き替える。
            onSelectionChanged={() => gridApiRef.current?.refreshHeader()}
            selectionColumnDef={{
              lockPinned: true,
              // 幅はチェックボックス（1rem）とセル左右の余白が収まる最小限にとどめる。
              width: 29,
              maxWidth: 29,
              resizable: false,
              suppressMovable: true,
              suppressHeaderMenuButton: true,
              // ヘッダーは「計画選択」アイコン（押下で全チェック／全解除）に差し替える。
              headerComponent: PlanTargetSelectAllHeader,
            }}
            context={gridContext}
            isExternalFilterPresent={isExternalFilterPresent}
            doesExternalFilterPass={doesExternalFilterPass}
            // 列は見出しをドラッグして入れ替えられる（計画・支払の明細で同じ → 02 §7「列の入れ替え」・UX-086）
            // 横スクロールバーを常時表示する（列数が多く、左右スクロールでの確認が必須のため）。
            alwaysShowHorizontalScroll={true}
            ensureDomOrder={true}
            statusBar={GRID_STATUS_BAR}
            {...GRID_BASE_PROPS}
            {...gridColumnStateProps}
          />
        </div>
      </>
    </CollapsibleCard>
  );
});
