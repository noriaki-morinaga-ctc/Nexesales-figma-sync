import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AgGridReact } from 'ag-grid-react';
import type {
  ColDef,
  ColGroupDef,
  GetRowIdParams,
  GridReadyEvent,
  IRowNode,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { Copy } from 'lucide-react';
import {
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  gridFilterContextMenuItems,
} from '../grid';
import { RightPane } from '../ui/right-pane';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { TEXT_INPUT_CLASS } from '../../../styles/commonStyles';
import { ConfirmDialog } from '../ui/confirm-dialog';
import {
  CHAIN_STORES,
  type ChainStore,
} from '../../constants/chainStoreMockData';

// 販売計画（詳細）のコピー用・右ペインウィザード。
// 「本部計画コピー」「計画コピー」で共通利用する。
// フロー（課題0386,0433 準拠）：
//   ①販売店（チェーン）選択 ※showStoreSelection=true のときのみ
//   ②商品区分の選択（拡売費を含む。初期は「定番商品」のみチェック）
//   ③コピー元の何%で函数を入力するかを選択
//   ④コピー実行の確認（入力中のデータがリセットされる旨）

// コピー元の説明（ペイン本文の先頭に表示）。どの計画をコピーするかを利用者が確認できるようにする。
// 前月計画コピー：同じ販売計画の前月分／本部計画コピー：選んだ販売店の本部計画の同じ月の分。
const COPY_SOURCE_DESCRIPTION = {
  previousMonth:
    '同じ販売計画（販売店・一次店・三次店が同じ計画）の前月（対象年月の1か月前）の計画をコピーします',
  headquarters:
    '選択した販売店の本部計画（一次店・三次店を指定していない、販売店のみに紐づく計画）の、対象年月と同じ月の計画をコピーします',
} as const;

// 販売店（チェーン）選択グリッドの行ID（→ 画面設計標準 4.7）。販売店コードは一覧内で一意
const getChainRowId = (params: GetRowIdParams<ChainStore>) => params.data.code;

// コピー実行時に親へ渡す入力値
export interface SalesPlanCopyResult {
  /** 選択したチェーン（販売店選択ありのときのみ。なしのときは null） */
  chain: { code: string; name: string } | null;
  /** 選択された商品区分（拡売費を含む） */
  categories: string[];
  /** コピー元に掛ける率（%。小数第1位まで） */
  percentage: string;
}

interface PlanCopyPaneProps {
  /** 表示状態 */
  open: boolean;
  /** 閉じるハンドラ */
  onClose: () => void;
  /** ペインのタイトル（例：本部計画コピー／計画コピー） */
  title: string;
  /** 販売店（チェーン）選択ステップを表示するか（本部計画コピー＝true） */
  showStoreSelection?: boolean;
  /** コピー対象の商品区分（拡売費を除く。画面ごとに指定） */
  categories: string[];
  /** 拡売費をコピー対象に含めるか（既定：含める） */
  includeExpense?: boolean;
  /** コピー実行時のコールバック */
  onExecute?: (result: SalesPlanCopyResult) => void;
}

// 拡売費のラベル（商品区分とは区分けして表示する）
const EXPENSE_LABEL = '拡売費';

export function PlanCopyPane({
  open,
  onClose,
  title,
  showStoreSelection = false,
  categories,
  includeExpense = true,
  onExecute,
}: PlanCopyPaneProps) {
  // ステップ構成：販売店選択の有無で先頭ステップが変わる
  const steps = useMemo(
    () =>
      showStoreSelection
        ? (['store', 'category', 'percentage'] as const)
        : (['category', 'percentage'] as const),
    [showStoreSelection]
  );

  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  // 選択チェーン（販売店選択ありのとき）
  const [selectedChain, setSelectedChain] = useState<ChainStore | null>(null);
  // 選択商品区分（初期は「定番商品」のみ／pptx準拠）
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    '定番商品',
  ]);
  // 拡売費の選択状態（初期は未選択）
  const [expenseSelected, setExpenseSelected] = useState(false);
  // コピー元に掛ける率（%）。既定は100%
  const [percentage, setPercentage] = useState('100');
  // コピー実行の確認ダイアログ
  const [showExecuteConfirm, setShowExecuteConfirm] = useState(false);
  // コピー元の説明（前月計画コピー／本部計画コピーで出し分け）
  const copySourceDescription = showStoreSelection
    ? COPY_SOURCE_DESCRIPTION.headquarters
    : COPY_SOURCE_DESCRIPTION.previousMonth;

  // 開くたびに初期状態へリセット。
  // 開いたままコピー種別が切り替わる場合（計画コピー⇄本部計画コピー）も、
  // 別ペインを開き直したのと同じ扱いにするため title／showStoreSelection を依存に含める
  // （ステップ数が種別で変わるため、前種別の stepIndex を引き継がせない）。
  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    setSelectedChain(null);
    setSelectedCategories(['定番商品']);
    setExpenseSelected(false);
    setPercentage('100');
    setShowExecuteConfirm(false);
  }, [open, title, showStoreSelection]);

  // ── 販売店（チェーン）Grid の列定義（販売店グループのみ）──
  const columnDefs = useMemo<(ColDef<ChainStore> | ColGroupDef<ChainStore>)[]>(
    () => [
      {
        headerName: '販売店',
        children: [
          { field: 'code', headerName: 'コード', width: 120 },
          { field: 'name', headerName: '販売店名', flex: 1, minWidth: 200 },
        ],
      },
    ],
    []
  );

  // グリッド初期化時：自社チェーン（isOwn）を初期選択し、先頭へスクロール
  const handleGridReady = (event: GridReadyEvent<ChainStore>) => {
    let ownNode: IRowNode<ChainStore> | null = null;
    event.api.forEachNode((node) => {
      if (node.data?.isOwn && !ownNode) ownNode = node;
    });
    if (ownNode) {
      const node: IRowNode<ChainStore> = ownNode;
      node.setSelected(true);
      event.api.ensureNodeVisible(node);
      setSelectedChain(node.data ?? null);
    }
  };

  // 行選択の反映
  const handleSelectionChanged = (event: SelectionChangedEvent<ChainStore>) => {
    const rows = event.api.getSelectedRows();
    setSelectedChain(rows[0] ?? null);
  };

  // 商品区分「すべて」チェックの切替
  const allCategoriesSelected = selectedCategories.length === categories.length;
  const handleToggleAllCategories = (checked: boolean) => {
    setSelectedCategories(checked ? [...categories] : []);
  };

  // 個別の商品区分チェックの切替
  const handleToggleCategory = (category: string, checked: boolean) => {
    setSelectedCategories((prev) =>
      checked ? [...prev, category] : prev.filter((c) => c !== category)
    );
  };

  // ステップごとの入力充足チェック（このステップから先へ進めるか）
  const isStepSatisfied = (step: (typeof steps)[number]) => {
    if (step === 'store') return selectedChain !== null;
    if (step === 'category')
      return selectedCategories.length > 0 || expenseSelected;
    return true;
  };

  // 次へ進めるか（現在のステップの入力充足）
  const canProceed = isStepSatisfied(currentStep);

  // ステップインジケータの押下で移動できるか。
  // 「次へ」「戻る」と同じ条件にそろえる：戻るのは無条件、進むのは間に挟まる
  // 各ステップが「次へ」を押せる状態（入力充足）のときのみ。
  const canGoToStep = (target: number) =>
    target <= stepIndex ||
    steps.slice(stepIndex, target).every((step) => isStepSatisfied(step));

  // コピー実行（確認ダイアログでOK後に呼ばれる）
  const handleExecute = () => {
    const resultCategories = [
      ...selectedCategories,
      ...(includeExpense && expenseSelected ? [EXPENSE_LABEL] : []),
    ];
    onExecute?.({
      chain: selectedChain
        ? { code: selectedChain.code, name: selectedChain.name }
        : null,
      categories: resultCategories,
      percentage,
    });
    toast.success('計画をコピーしました。');
    onClose();
  };

  return (
    <>
      <RightPane
        open={open}
        onClose={onClose}
        title={title}
        description={copySourceDescription}
        initialWidth={showStoreSelection ? 44 : 26}
        footer={
          <div className="flex items-center gap-2">
            {/* 最初のステップには戻る先が無いためボタンを出さない
                （閉じるのはヘッダーの×／Esc） */}
            {!isFirst && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStepIndex((i) => i - 1)}
              >
                戻る
              </Button>
            )}
            {isLast ? (
              <Button
                type="button"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={!canProceed}
                onClick={() => setShowExecuteConfirm(true)}
              >
                <Copy className="h-4 w-4" />
                コピー実行
              </Button>
            ) : (
              <Button
                type="button"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={!canProceed}
                onClick={() => setStepIndex((i) => i + 1)}
              >
                次へ
              </Button>
            )}
          </div>
        }
      >
        <div className="flex h-full flex-col gap-4">
          {/* コピー元の説明（RightPane の description は画面に出ないため本文に表示する） */}
          <p className="rounded bg-blue-50 px-3 py-2 text-sm text-gray-700">
            {copySourceDescription}
          </p>
          {/* ステップインジケータ。番号・ラベルの押下でも「次へ」「戻る」と同じように
              対象のステップへ切り替わる（入力が足りず「次へ」を押せないステップより
              先へは進めない）。 */}
          <ol className="flex items-center gap-2 text-sm">
            {steps.map((step, idx) => {
              const label =
                step === 'store'
                  ? '販売店'
                  : step === 'category'
                    ? '商品区分'
                    : 'コピー元％';
              const active = idx === stepIndex;
              const done = idx < stepIndex;
              const reachable = canGoToStep(idx);
              return (
                <li key={step} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStepIndex(idx)}
                    disabled={!reachable}
                    aria-current={active ? 'step' : undefined}
                    aria-label={`${idx + 1} ${label}`}
                    className={`flex items-center gap-2 rounded-sm transition-opacity focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                      reachable
                        ? 'cursor-pointer hover:opacity-70'
                        : 'cursor-not-allowed opacity-50'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        active
                          ? 'bg-blue-600 text-white'
                          : done
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span
                      className={
                        active ? 'font-bold text-blue-700' : 'text-gray-500'
                      }
                    >
                      {label}
                    </span>
                  </button>
                  {idx < steps.length - 1 && (
                    <span className="mx-1 text-gray-300">›</span>
                  )}
                </li>
              );
            })}
          </ol>

          {/* ① 販売店（チェーン）選択 */}
          {currentStep === 'store' && (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <p className="text-sm text-gray-700">
                コピー元の本部計画を持つ販売店を1件選択してください。
              </p>
              <div
                className="chain-select-grid min-h-[20rem] flex-1"
                style={{ width: '100%' }}
              >
                {/* 自社チェーン行を淡い色で強調 */}
                <style>{`
                  .chain-select-grid .ag-row.chain-own-row {
                    background-color: rgb(239 246 255);
                  }
                `}</style>
                <AgGridReact<ChainStore>
                  rowData={CHAIN_STORES}
                  columnDefs={columnDefs}
                  defaultColDef={GRID_DEFAULT_COL_DEF}
                  getRowId={getChainRowId}
                  getContextMenuItems={gridFilterContextMenuItems}
                  rowSelection={{
                    mode: 'singleRow',
                    checkboxes: true,
                    enableClickSelection: true,
                  }}
                  selectionColumnDef={{
                    width: 50,
                    resizable: false,
                    suppressMovable: true,
                    suppressHeaderMenuButton: true,
                  }}
                  rowClassRules={{
                    'chain-own-row': (params) => !!params.data?.isOwn,
                  }}
                  onGridReady={handleGridReady}
                  onSelectionChanged={handleSelectionChanged}
                  statusBar={GRID_STATUS_BAR}
                  {...GRID_BASE_PROPS}
                />
              </div>
            </div>
          )}

          {/* ② 商品区分の選択 */}
          {currentStep === 'category' && (
            <div className="flex flex-col gap-4">
              {/* 前ステップで選択したコピー元（チェーン）を分かりやすく表示 */}
              {showStoreSelection && (
                <div className="rounded-lg border border-gray-200 bg-blue-50 p-4">
                  <span className="mb-2 block text-sm font-bold text-gray-900">
                    選択内容
                  </span>
                  <dl className="text-sm">
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-gray-500">
                        コピー元チェーン
                      </dt>
                      <dd className="font-bold text-gray-900">
                        {selectedChain
                          ? `${selectedChain.name}（${selectedChain.code}）`
                          : '未選択'}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
              <p className="text-sm text-gray-700">
                コピーする商品区分を選択してください。
              </p>

              {/* 商品区分セクション */}
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">
                    商品区分
                  </span>
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={allCategoriesSelected}
                      onCheckedChange={(checked) =>
                        handleToggleAllCategories(checked === true)
                      }
                    />
                    <span className="text-sm text-gray-700">すべて</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((category) => (
                    <label
                      key={category}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <Checkbox
                        checked={selectedCategories.includes(category)}
                        onCheckedChange={(checked) =>
                          handleToggleCategory(category, checked === true)
                        }
                      />
                      <span className="text-sm text-gray-900">{category}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 拡売費セクション（商品区分と区分けして表示） */}
              {includeExpense && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <span className="mb-2 block text-sm font-bold text-gray-900">
                    拡売費
                  </span>
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={expenseSelected}
                      onCheckedChange={(checked) =>
                        setExpenseSelected(checked === true)
                      }
                    />
                    <span className="text-sm text-gray-900">
                      {EXPENSE_LABEL}
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* ③ コピー元の何%で函数を入力するか */}
          {currentStep === 'percentage' && (
            <div className="flex flex-col gap-4">
              {/* 前ステップで選択した内容のサマリ（視覚的に確認できるように表示） */}
              <div className="rounded-lg border border-gray-200 bg-blue-50 p-4">
                <span className="mb-2 block text-sm font-bold text-gray-900">
                  選択内容
                </span>
                <dl className="space-y-2 text-sm">
                  {showStoreSelection && (
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-gray-500">
                        コピー元チェーン
                      </dt>
                      <dd className="font-bold text-gray-900">
                        {selectedChain
                          ? `${selectedChain.name}（${selectedChain.code}）`
                          : '未選択'}
                      </dd>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-gray-500">商品区分</dt>
                    <dd className="flex flex-wrap gap-1">
                      {selectedCategories.length === 0 && !expenseSelected ? (
                        <span className="text-gray-900">未選択</span>
                      ) : (
                        <>
                          {selectedCategories.map((category) => (
                            <span
                              key={category}
                              className="rounded bg-white px-2 py-0.5 text-gray-900 ring-1 ring-blue-200"
                            >
                              {category}
                            </span>
                          ))}
                          {includeExpense && expenseSelected && (
                            <span className="rounded bg-white px-2 py-0.5 text-gray-900 ring-1 ring-amber-300">
                              {EXPENSE_LABEL}
                            </span>
                          )}
                        </>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              <p className="text-sm text-gray-700">
                コピー元の何%で函数を入力しますか？
                <br />
                <span className="text-gray-500">
                  {showStoreSelection
                    ? '例）本部計画の3割で組み立てたい場合は「30」を入力。'
                    : '例）前月計画の9割で組み立てたい場合は「90」を入力。'}
                </span>
              </p>
              <div className="flex items-center justify-center gap-2 py-4">
                <span className="text-sm text-gray-700">コピー元の</span>
                <Input
                  type="text"
                  value={percentage}
                  onChange={(e) => {
                    // 整数3桁・小数第1位まで入力可能（数字と小数点のみ許可）
                    const value = e.target.value
                      .replace(/[^0-9.]/g, '') // 数字と小数点以外を除去
                      .replace(/(\..*)\./g, '$1') // 2つ目以降の小数点を除去
                      .replace(/^(\d{0,3})(\.\d?)?.*$/, '$1$2'); // 整数3桁・小数1桁に制限
                    setPercentage(value);
                  }}
                  className={`${TEXT_INPUT_CLASS} w-[100px] rounded border px-2 py-1 text-right text-base`}
                  maxLength={5}
                />
                <span className="text-base text-gray-900">%</span>
              </div>
            </div>
          )}
        </div>
      </RightPane>

      {/* コピー実行の確認：表内に入力中のデータがある場合にリセットされる旨を確認 */}
      <ConfirmDialog
        open={showExecuteConfirm}
        title="コピー実行の確認"
        confirmLabel="コピー"
        description="入力中のデータがリセットされます。本当によろしいですか？"
        onConfirm={() => {
          setShowExecuteConfirm(false);
          handleExecute();
        }}
        onCancel={() => setShowExecuteConfirm(false)}
      />
    </>
  );
}
