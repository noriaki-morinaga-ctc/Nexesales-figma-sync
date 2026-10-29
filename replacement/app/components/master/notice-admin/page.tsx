import { useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { toast } from 'sonner';
import type {
  ColDef,
  RowDoubleClickedEvent,
  ValueGetterParams,
} from 'ag-grid-community';
import {
  AlertTriangle,
  Plus,
  Search,
  SquarePen,
  Trash2,
  Undo2,
} from 'lucide-react';
import {
  GRID_BASE_PROPS,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  formatEmptyAsDash,
  useGridColumnState,
  useRevealNewRows,
  GRID_DATE_TEXT_FILTER,
} from '../../grid';
import { CopyableArea } from '../../ui/copyable-area';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { Checkbox } from '../../ui/checkbox';
import { Input } from '../../ui/input';
import { MultiCombobox } from '../../ui/multi-combobox';
import { RequiredBadge } from '../../ui/required-badge';
import {
  BUTTON_STYLES,
  CARD_TITLE_CLASS,
  FORM_LABEL_CLASS,
  FORM_VALUE_CLASS,
  TEXT_INPUT_CLASS,
} from '../../../../styles/commonStyles';
import {
  type DisplayStatus,
  type NoticeDraft,
  type NoticeItem,
  type NoticeStatus,
  DISPLAY_STATUS_LABEL,
  NOW_STR,
  addNotice,
  bodyPreviewText,
  displayStatus,
  duplicateNotice,
  getNotice,
  removeNotice,
  updateNotice,
  useNotices,
} from './noticeStore';
import {
  ActionCellRenderer,
  StatusCellRenderer,
  StatusIndicator,
  TITLE_MAX,
  TYPE_CONFIG,
  TypeBadgeRenderer,
  type NoticeGridContext,
} from './noticeUi';
import {
  validate,
  type FieldErrors,
  type PublishAction,
} from './noticeValidation';
import { DateTimePopover } from './components/DateTimePopover';
import { NoticePreview } from './components/NoticePreview';
import { RichBodyEditor } from './components/RichBodyEditor';
import { ScreenTitle } from '../../ui/screen-title';

// ===== お知らせメンテ画面（管理者ビュー・モック / in-memory） =====
// 一覧ビュー（検索条件＋一覧グリッド）と編集ビュー（フォーム＋プレビュー）を mode で切り替える。
// 本文ロジック=noticeBody / UI定数・セルレンダラ=noticeUi / 入力チェック=noticeValidation /
// エディタ・プレビュー・日時ピッカー=components/ に分割。

// 列状態（列幅・並び順・ソート）の保存キー。列構成を変えたらバージョンを上げる（→ 02 §9）
// v2：「更新者・更新日時」を「更新者」「更新日時」の2列に分けた
const COLUMN_STATE_KEY = 'noticeAdmin.columnState.v2';

// 白カード（→ 05「白カード（パネル）」）。インライン展開のポップアップを含むため overflow-hidden は付けない
const WHITE_CARD_CLASS = 'bg-white rounded-lg border border-gray-200 shadow-md';

// 入力エラーメッセージ
const FIELD_ERROR_CLASS = 'text-xs text-red-600 mt-0.5';
// 補足説明テキスト
const HINT_CLASS = 'text-xs text-gray-500 mt-0.5';

// 状態の並び順（コード値の順：下書き→予約→公開中→掲載終了→取下げ）。絞り込みの選択肢・一覧のソートで使う
const DISPLAY_STATUS_ORDER = Object.keys(
  DISPLAY_STATUS_LABEL
) as DisplayStatus[];

// 状態の絞り込みは複数選択。何も選ばないときは「すべて」（絞り込みなし）
const STATUS_FILTER_OPTIONS = DISPLAY_STATUS_ORDER.map((v) => ({
  value: v,
  label: DISPLAY_STATUS_LABEL[v],
}));
// 状態の絞り込みの初期値。掲載終了・取下げは過去のお知らせが多くノイズになるため、初期は外す
const INITIAL_FILTER_STATUS: DisplayStatus[] = ['draft', 'scheduled', 'open'];

// 状態列のソート：表示名ではなく状態の並び順（コード値の順）で比較する
const compareStatusLabel = (a: string, b: string): number => {
  const order = (label: string) =>
    DISPLAY_STATUS_ORDER.findIndex((v) => DISPLAY_STATUS_LABEL[v] === label);
  return order(a) - order(b);
};

const createEmptyDraft = (): NoticeDraft => ({
  type: 'notice',
  date: '',
  title: '',
  body: [{ type: 'p', content: [''] }],
  status: 'draft',
  startAt: '',
  endAt: '',
});

// 「今すぐ掲載する」で使う、公開ボタンを押した瞬間の実日時 "YYYY/MM/DD HH:mm"（時分まで）。
const nowDateTime = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function NoticeAdminScreen() {
  const notices = useNotices();
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<NoticeDraft>(createEmptyDraft());
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] =
    useState<boolean>(false);
  const [pendingDelete, setPendingDelete] = useState<NoticeItem | null>(null);
  // 編集対象が変わるたびにエディタを作り直す（contenteditable の初期値を入れ直すため）
  const [editorKey, setEditorKey] = useState<number>(0);
  const [isPublishNow, setIsPublishNow] = useState<boolean>(false);
  // 「今すぐ掲載する」をチェックする前の掲載開始日時（チェックを外したときに戻す）
  const startAtBeforePublishNow = useRef<string>('');

  const [filterStatus, setFilterStatus] = useState<DisplayStatus[]>(
    INITIAL_FILTER_STATUS
  );
  const [filterKeyword, setFilterKeyword] = useState<string>('');

  const errorRef = useRef<HTMLDivElement>(null);

  // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）。タイトル列は flex のため自動サイズ調整は行わない
  const gridColumnStateProps = useGridColumnState(COLUMN_STATE_KEY, {
    autoSize: false,
  });

  // 複製で増えた行を見つけやすくする（行までスクロールし、数秒光らせる。共通フック）
  // 複製した行はコピー元の直下に出すため、一覧は見えていれば動かさない（'nearest'）
  const revealNewRows = useRevealNewRows({ scrollPosition: 'nearest' });
  // 複製した直後の行の位置（コピー元の行の直下に出す）。一覧を再表示するまで保持する
  const [duplicated, setDuplicated] = useState<{
    sourceId: number;
    newId: number;
  } | null>(null);

  const filteredNotices = useMemo(() => {
    const kw = filterKeyword.trim();
    const rows = notices
      .filter(
        (n) =>
          filterStatus.length === 0 || filterStatus.includes(displayStatus(n))
      )
      .filter(
        (n) =>
          !kw || n.title.includes(kw) || bodyPreviewText(n.body).includes(kw)
      )
      .sort((a, b) => b.startAt.localeCompare(a.startAt));
    // 複製した直後は、複製した行をコピー元の行の直下へ移す（→ 5 No.17）
    if (duplicated) {
      const newIndex = rows.findIndex((n) => n.id === duplicated.newId);
      if (newIndex >= 0) {
        const [newRow] = rows.splice(newIndex, 1);
        const sourceIndex = rows.findIndex((n) => n.id === duplicated.sourceId);
        rows.splice(sourceIndex >= 0 ? sourceIndex + 1 : newIndex, 0, newRow);
      }
    }
    return rows;
  }, [notices, filterStatus, filterKeyword, duplicated]);

  // 操作列の「複製」：下書きとして複製し、コピー元の直下に出して光らせる
  const handleDuplicate = (n: NoticeItem) => {
    const newId = duplicateNotice(n.id);
    // 通知の文言は 6.イベント一覧 EV-05 のとおり
    if (newId === null) {
      toast.error('複製に失敗しました。時間をおいて再度お試しください。');
      return;
    }
    setDuplicated({ sourceId: n.id, newId });
    revealNewRows.markRows([String(newId)]);
    toast.success('お知らせを複製しました。');
  };

  const resetEditState = () => {
    // 編集画面へ移ったら、一覧に戻ったときは通常の並び順で表示する
    setDuplicated(null);
    setFieldErrors({});
    setErrorMessages([]);
    setIsDirty(false);
    setIsPublishNow(false);
    setEditorKey((k) => k + 1);
    setMode('edit');
  };

  const handleCreate = () => {
    setDraft(createEmptyDraft());
    setEditingId(null);
    resetEditState();
  };

  const handleEdit = (n: NoticeItem) => {
    setDraft({
      type: n.type,
      date: n.startAt,
      title: n.title,
      body: structuredClone(n.body),
      status: n.status,
      startAt: n.startAt,
      endAt: n.endAt ?? '',
    });
    setEditingId(n.id);
    resetEditState();
  };

  const updateDraft = (patch: Partial<NoticeDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setIsDirty(true);
  };

  // 「今すぐ掲載する」トグル。オンの間は掲載開始日時を空にして非活性にし、
  // 実際に「公開」を押した時点の日時を掲載開始日時とする。
  // オフに戻したら、チェックする前に入っていた掲載開始日時に戻す（→ 5 No.22）。
  const handlePublishNowChange = (on: boolean) => {
    setIsPublishNow(on);
    if (on) {
      startAtBeforePublishNow.current = draft.startAt;
      updateDraft({ startAt: '' });
    } else {
      updateDraft({ startAt: startAtBeforePublishNow.current });
    }
  };

  const handleSave = (status: NoticeStatus) => {
    // 「今すぐ掲載する」ON で公開する場合、「公開」ボタンを押した日時を掲載開始日時に設定する。
    const startAt =
      isPublishNow && status === 'published' ? nowDateTime() : draft.startAt;
    const next: NoticeDraft = {
      ...draft,
      status,
      startAt,
      endAt: draft.endAt?.trim() || undefined,
    };
    // 下書き保存時はタイトル・本文のみ必須（日時等は公開時にチェック）。
    // 保存済みの状態が下書き・取下げで「公開」「再公開」を押したときは、公開時のチェックも行う。
    const publishAction: PublishAction | undefined =
      status !== 'published' || draft.status === 'published'
        ? undefined
        : draft.status === 'withdrawn'
          ? 'republish'
          : 'publish';
    const result = validate(
      next,
      isPublishNow,
      status === 'draft',
      publishAction
    );
    if (result.messages.length) {
      setFieldErrors(result.fieldErrors);
      setErrorMessages(result.messages);
      // エラーサマリへスクロール（描画後に実行）
      setTimeout(
        () =>
          errorRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          }),
        50
      );
      return;
    }
    if (editingId === null) addNotice(next);
    else updateNotice(editingId, next);
    // 成功時のトースト（文言は 6.イベント一覧 EV-07〜EV-10 のとおり）
    toast.success(
      status === 'draft'
        ? 'お知らせを保存しました。'
        : status === 'withdrawn'
          ? 'お知らせを取り下げました。'
          : publishAction
            ? 'お知らせを公開しました。'
            : 'お知らせを更新しました。'
    );
    setIsDirty(false);
    setMode('list');
  };

  const handleBack = () => {
    if (isDirty) setIsDiscardConfirmOpen(true);
    else setMode('list');
  };

  const gridContext = useMemo<NoticeGridContext>(
    () => ({
      onEdit: handleEdit,
      onDup: handleDuplicate,
    }),
    // handleEdit・handleDuplicate は state の setter と共通フックの markRows（参照固定）のみを使うため初回の参照で足りる
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const columnDefs = useMemo<ColDef<NoticeItem>[]>(
    () => [
      {
        headerName: '状態',
        colId: 'status',
        width: 120,
        valueGetter: (p: ValueGetterParams<NoticeItem>) =>
          p.data ? DISPLAY_STATUS_LABEL[displayStatus(p.data)] : '',
        cellRenderer: StatusCellRenderer,
        comparator: compareStatusLabel,
        // 先頭列は grid.css のチェックボックス列向け規則で中央寄せになるため、
        // 先頭データ列用の ag-cell-left で左寄せに戻す
        cellClass: 'ag-cell-left',
      },
      {
        // バッジは「重要」のみ（通常のお知らせは空欄）
        headerName: '重要',
        colId: 'type',
        width: 90,
        // フィルタ・ソート値は表示ラベルに合わせる（内部値 important/notice を出さない）
        valueGetter: (p: ValueGetterParams<NoticeItem>) =>
          p.data?.type === 'important' ? TYPE_CONFIG.important.label : '',
        cellRenderer: TypeBadgeRenderer,
      },
      {
        headerName: 'タイトル',
        field: 'title',
        flex: 1,
        minWidth: 220,
        cellClass: 'cell-left',
      },
      {
        headerName: '掲載開始',
        field: 'startAt',
        ...GRID_DATE_TEXT_FILTER,
        width: 150,
      },
      {
        headerName: '掲載終了',
        field: 'endAt',
        ...GRID_DATE_TEXT_FILTER,
        width: 150,
        valueFormatter: formatEmptyAsDash,
      },
      {
        // 更新者で絞り込めるよう、更新日時とは別の列にする
        headerName: '更新者',
        field: 'updatedBy',
        width: 170,
        cellClass: 'cell-left',
      },
      {
        headerName: '更新日時',
        field: 'updatedAt',
        ...GRID_DATE_TEXT_FILTER,
        width: 150,
      },
      {
        headerName: '操作',
        colId: 'actions',
        width: 110,
        cellRenderer: ActionCellRenderer,
        sortable: false,
        filter: false,
        resizable: false,
        // 右端に固定（他列の幅変更・横スクロールの影響を受けない）
        pinned: 'right',
        lockPinned: true,
        lockPosition: 'right',
        suppressMovable: true,
      },
    ],
    []
  );

  const handleRowDoubleClicked = (e: RowDoubleClickedEvent<NoticeItem>) => {
    // 行のダブルクリックで編集画面へ遷移する
    if (e.data) handleEdit(e.data);
  };

  // ====== 一覧ビュー ======
  if (mode === 'list') {
    return (
      <div className="min-w-[75rem] h-full flex flex-col">
        <div className="px-6 pt-3 pb-3 flex-1 min-h-0 flex flex-col">
          {/* 画面名はヘッダー（システム名の右）に表示する */}
          <ScreenTitle title="お知らせメンテ" />

          {/* 検索条件（絞り込みの並びは、下の一覧グリッドの列順（状態→重要）に合わせる） */}
          {/* 検索条件の値は Ctrl+C／右クリック「コピー」で表示中の値をコピーできる（CopyableArea → 02 §15） */}
          <CopyableArea className="shrink-0">
            <div className={`${WHITE_CARD_CLASS} mb-3`}>
              <div className="px-3 py-1.5 flex items-center gap-2">
                <Search className="h-5 w-5 text-gray-700" aria-hidden="true" />
                <h2 className={CARD_TITLE_CLASS}>検索条件</h2>
              </div>
              <div className="px-4 pb-3 pt-1 flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="notice-filter-status"
                    className={`${FORM_LABEL_CLASS} whitespace-nowrap`}
                  >
                    状態
                  </label>
                  <MultiCombobox
                    id="notice-filter-status"
                    options={STATUS_FILTER_OPTIONS}
                    value={filterStatus}
                    onChange={(v) => setFilterStatus(v as DisplayStatus[])}
                    className="w-80"
                  />
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-80">
                  <label
                    htmlFor="notice-filter-keyword"
                    className={`${FORM_LABEL_CLASS} whitespace-nowrap`}
                  >
                    キーワード
                  </label>
                  <Input
                    id="notice-filter-keyword"
                    value={filterKeyword}
                    onChange={(e) => setFilterKeyword(e.target.value)}
                    placeholder="タイトル・本文"
                    className={TEXT_INPUT_CLASS}
                  />
                </div>
              </div>
            </div>
          </CopyableArea>

          {/* お知らせ一覧（ページの余り高さいっぱいまで広げ、スクロールはグリッド内に閉じる） */}
          <div
            className={`${WHITE_CARD_CLASS} overflow-hidden flex flex-col flex-1 min-h-[23.75rem]`}
          >
            <div className="px-3 py-1.5 flex items-center gap-2">
              <h2 className={CARD_TITLE_CLASS}>お知らせ一覧</h2>
              <button
                type="button"
                onClick={handleCreate}
                className="btn-toolbar-outline ml-auto"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                新規作成
              </button>
            </div>
            <div className="p-2 pt-0 flex-1 min-h-0 w-full">
              <AgGridReact<NoticeItem>
                rowData={filteredNotices}
                columnDefs={columnDefs}
                defaultColDef={GRID_DEFAULT_COL_DEF}
                domLayout="normal"
                // セルレンダラーへ渡すコールバック（編集・複製）
                context={gridContext}
                // 共通基本プロパティ（Enter縦移動・セル範囲選択等／grid/）
                {...GRID_BASE_PROPS}
                onRowDoubleClicked={handleRowDoubleClicked}
                // 行IDはお知らせ番号（複製した行を ID で探して強調するため）
                getRowId={(p) => String(p.data.id)}
                // 複製した行がグリッドに反映されたら、その行までスクロールして光らせる
                onRowDataUpdated={revealNewRows.onRowDataUpdated}
                // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）
                {...gridColumnStateProps}
                statusBar={GRID_STATUS_BAR}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            ※
            「公開中」のお知らせのみTOP画面に表示されます。削除したお知らせは一覧・画面には表示されなくなります。
          </p>
        </div>
      </div>
    );
  }

  // ====== 編集ビュー ======
  const current = editingId !== null ? getNotice(editingId) : undefined;
  const ds = displayStatus(draft);
  // 公開中・掲載終了では掲載開始日時を変更不可とする。
  // 判定は保存済みの状態で行う（編集中の日時変更で活性/非活性が切り替わらないようにする）。
  const savedDs = current ? displayStatus(current) : null;
  const isStartLocked = savedDs === 'open' || savedDs === 'ended';
  // アクションの活性条件（保存済みのステータスで判定。draft.status は保存するまで変わらない）
  const isDraftSaved = draft.status === 'draft'; // 新規・下書き
  const isPublishedSaved = draft.status === 'published'; // 公開中・予約・掲載終了
  const isWithdrawnSaved = draft.status === 'withdrawn'; // 取下げ
  const canWithdraw = isPublishedSaved && savedDs !== 'ended';
  const canDelete = !!current && ds !== 'open';

  return (
    <div className="min-w-[75rem]">
      <div className="px-6 pt-3 pb-3">
        {/* 画面名はヘッダー（システム名の右）に表示し、本文には現在の状態だけを置く */}
        <ScreenTitle
          title={editingId === null ? 'お知らせ 新規作成' : 'お知らせ 編集'}
        />
        <div className="px-3 py-1.5 mb-1">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-xs text-gray-700">
              現在の状態：
              <StatusIndicator ds={ds} />
            </span>
          </div>
        </div>

        {errorMessages.length > 0 && (
          <div
            ref={errorRef}
            role="alert"
            className="mb-3 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-700"
          >
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              入力内容を確認してください（{errorMessages.length}件）
            </div>
            <ul className="list-disc pl-5 space-y-0.5">
              {errorMessages.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* 左: フォーム */}
          <div className={WHITE_CARD_CLASS}>
            <div className="px-3 py-1.5 flex items-center gap-2">
              <SquarePen className="h-5 w-5 text-gray-700" aria-hidden="true" />
              <h2 className={CARD_TITLE_CLASS}>お知らせ内容</h2>
            </div>
            <div className="p-4 pt-1 space-y-4">
              {/* 重要 */}
              <div>
                <span className={`block mb-1 ${FORM_LABEL_CLASS}`}>重要</span>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="notice-important"
                    checked={draft.type === 'important'}
                    onCheckedChange={(checked) =>
                      updateDraft({
                        type: checked === true ? 'important' : 'notice',
                      })
                    }
                  />
                  <label
                    htmlFor="notice-important"
                    className={`${FORM_VALUE_CLASS} cursor-pointer`}
                  >
                    重要として掲載する
                  </label>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold text-white ${TYPE_CONFIG.important.badge}`}
                  >
                    {TYPE_CONFIG.important.label}
                  </span>
                </div>
                <p className={HINT_CLASS}>
                  バッジが付くのは「重要」のみ。通常のお知らせはバッジなしで表示されます。
                </p>
              </div>

              {/* 今すぐ掲載（公開中・掲載終了では掲載開始日時を変更不可のため表示しない） */}
              {!isStartLocked && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="notice-publish-now"
                    checked={isPublishNow}
                    onCheckedChange={(checked) =>
                      handlePublishNowChange(checked === true)
                    }
                  />
                  <label
                    htmlFor="notice-publish-now"
                    className={`${FORM_VALUE_CLASS} cursor-pointer`}
                  >
                    今すぐ掲載する
                  </label>
                  <span className="text-xs text-gray-500">
                    （「公開」ボタンを押した日時を掲載開始日時とします）
                  </span>
                </div>
              )}

              {/* 掲載期間 */}
              <div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="notice-start-at"
                      className={`flex items-center mb-1 ${FORM_LABEL_CLASS}`}
                    >
                      掲載開始日時
                      <RequiredBadge />
                    </label>
                    <DateTimePopover
                      id="notice-start-at"
                      value={draft.startAt}
                      // 公開・再公開するお知らせ（新規・下書き・取下げ）は、当日より前の日付を選べない
                      minDate={
                        draft.status === 'published'
                          ? undefined
                          : NOW_STR.slice(0, 10)
                      }
                      disabled={isPublishNow || isStartLocked}
                      invalid={!!fieldErrors.startAt}
                      onChange={(v) => updateDraft({ startAt: v })}
                      placeholder={
                        isPublishNow ? '公開時に自動設定' : '掲載開始日時を選択'
                      }
                    />
                    {isPublishNow && (
                      <p className="text-xs text-blue-600 mt-0.5">
                        「公開」ボタンを押した日時を掲載開始日時に設定します。
                      </p>
                    )}
                    {isStartLocked && (
                      <p className={HINT_CLASS}>
                        公開中・掲載終了の間は、掲載開始日時は変更できません。
                      </p>
                    )}
                    {fieldErrors.startAt && (
                      <p className={FIELD_ERROR_CLASS}>{fieldErrors.startAt}</p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="notice-end-at"
                      className={`block mb-1 ${FORM_LABEL_CLASS}`}
                    >
                      掲載終了日時（任意）
                    </label>
                    <DateTimePopover
                      id="notice-end-at"
                      value={draft.endAt}
                      invalid={!!fieldErrors.endAt}
                      onChange={(v) => updateDraft({ endAt: v })}
                      placeholder="掲載終了日時を選択"
                      // 選択日の終日掲載が多いため、時刻を省略したときは 23:59 にする
                      defaultTime="23:59"
                    />
                    {fieldErrors.endAt && (
                      <p className={FIELD_ERROR_CLASS}>{fieldErrors.endAt}</p>
                    )}
                  </div>
                </div>
                <p className={HINT_CLASS}>
                  掲載終了日時を未指定にすると無期限になります。
                </p>
              </div>

              {/* タイトル */}
              <div>
                <label
                  htmlFor="notice-title"
                  className={`flex items-center mb-1 ${FORM_LABEL_CLASS}`}
                >
                  タイトル
                  <RequiredBadge />
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    ({draft.title.length}/{TITLE_MAX})
                  </span>
                </label>
                <Input
                  id="notice-title"
                  value={draft.title}
                  onChange={(e) => updateDraft({ title: e.target.value })}
                  maxLength={TITLE_MAX}
                  aria-invalid={!!fieldErrors.title}
                  className={`${TEXT_INPUT_CLASS} ${fieldErrors.title ? 'border-red-400 bg-red-50' : ''}`}
                />
                {fieldErrors.title && (
                  <p className={FIELD_ERROR_CLASS}>{fieldErrors.title}</p>
                )}
              </div>

              {/* 本文 */}
              <div>
                <label
                  htmlFor="notice-body"
                  className={`flex items-center mb-1 ${FORM_LABEL_CLASS}`}
                >
                  本文
                  <RequiredBadge />
                </label>
                <RichBodyEditor
                  key={editorKey}
                  id="notice-body"
                  initialBody={draft.body}
                  invalid={!!fieldErrors.body}
                  onChange={(body) => setDraft((d) => ({ ...d, body }))}
                  onDirty={() => setIsDirty(true)}
                />
                {fieldErrors.body && (
                  <p className={FIELD_ERROR_CLASS}>{fieldErrors.body}</p>
                )}
              </div>

              {/* 宛先 */}
              <div>
                <span className={`block mb-1 ${FORM_LABEL_CLASS}`}>宛先</span>
                <span className={FORM_VALUE_CLASS}>全社（固定）</span>
              </div>

              {current && (
                <div className="text-xs text-gray-500 border-t border-gray-100 pt-2">
                  作成: {current.createdBy} / {current.createdAt}　更新:{' '}
                  {current.updatedBy} / {current.updatedAt}
                </div>
              )}

              {/* 状態別アクション（カード下部バー）
                  左端＝一覧へ戻る。右端寄せで「削除→下書き保存→更新→公開→再公開→取下げ」の順に並べる。
                  ボタンは状態にかかわらず常に表示し、その状態で使えないものは非活性にする
                  （画面を状態ごとに作り分けず、活性/非活性で制御する。権限の制御と同じ考え方）。 */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleBack}
                  className="btn-action-base btn-action-outline"
                >
                  <Undo2 className="w-4 h-4" aria-hidden="true" />
                  一覧へ戻る
                </button>

                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {/* 削除：編集時のみ活性。公開中の直接削除は誤削除防止のため不可（取下げ→削除の2段階） */}
                  <button
                    type="button"
                    onClick={() => current && setPendingDelete(current)}
                    disabled={!canDelete}
                    className="btn-action-base btn-action-red"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    削除
                  </button>
                  {/* 下書き保存：新規・下書きのとき活性 */}
                  <button
                    type="button"
                    onClick={() => handleSave('draft')}
                    disabled={!isDraftSaved}
                    className="btn-action-base btn-action-outline"
                  >
                    下書き保存
                  </button>
                  {/* 更新：公開中・予約・掲載終了のとき活性（下書きは「下書き保存」で保存する）。
                      保存するステータスは公開のまま変えず、状態は掲載日時で算出し直す */}
                  <button
                    type="button"
                    onClick={() => handleSave('published')}
                    disabled={!isPublishedSaved}
                    className="btn-action-base btn-action-blue"
                  >
                    更新
                  </button>
                  {/* 公開：新規・下書きのとき活性 */}
                  <button
                    type="button"
                    onClick={() => handleSave('published')}
                    disabled={!isDraftSaved}
                    className="btn-action-base btn-action-blue"
                  >
                    公開
                  </button>
                  {/* 再公開：取下げのとき活性（取下げからも編集・再公開できるため「下書きに戻す」は置かない） */}
                  <button
                    type="button"
                    onClick={() => handleSave('published')}
                    disabled={!isWithdrawnSaved}
                    className="btn-action-base btn-action-blue"
                  >
                    再公開
                  </button>
                  {/* 取下げ：公開中・予約のとき活性（掲載終了は既にTOP非表示のため非活性） */}
                  <button
                    type="button"
                    onClick={() => handleSave('withdrawn')}
                    disabled={!canWithdraw}
                    className="btn-action-base btn-action-outline"
                  >
                    取下げ
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 右: プレビュー */}
          <NoticePreview draft={draft} />
        </div>
      </div>

      {/* 削除確認（削除実行後は一覧へ戻る） */}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="お知らせの削除"
        description={
          <span className="whitespace-pre-line">
            {pendingDelete
              ? `「${pendingDelete.title}」を削除します。\n削除すると、一覧およびTOP画面に表示されなくなります。\nよろしいですか？`
              : ''}
          </span>
        }
        confirmLabel="削除する"
        confirmClassName={BUTTON_STYLES.delete}
        onConfirm={() => {
          if (pendingDelete) {
            removeNotice(pendingDelete.id);
            // 文言は 6.イベント一覧 EV-11 のとおり
            toast.success('お知らせを削除しました。');
          }
          setPendingDelete(null);
          setIsDirty(false);
          setMode('list');
        }}
        onCancel={() => setPendingDelete(null)}
      />

      {/* 未保存の編集内容の破棄確認 */}
      <ConfirmDialog
        open={isDiscardConfirmOpen}
        title="編集内容が保存されていません"
        description="一覧へ戻ると、編集中の内容は破棄されます。よろしいですか？"
        confirmLabel="破棄して戻る"
        confirmClassName={BUTTON_STYLES.delete}
        onConfirm={() => {
          setIsDiscardConfirmOpen(false);
          setIsDirty(false);
          setMode('list');
        }}
        onCancel={() => setIsDiscardConfirmOpen(false)}
      />
    </div>
  );
}
