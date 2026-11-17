// 型1 マスタメンテCRUD型 画面の本体（検索条件 ＋ 一覧 ＋ 右ペイン ＋ 確認ダイアログ）。
// 画面側は MasterScreenDef とモックの初期データを渡すだけで、全マスタ共通の標準仕様
// （マスタ画面標準化 p.7）に沿った画面になる。モックのためデータはメモリ上で保持する。
// 2026-10-30 画面設計標準 ver0.3・guidelines（10/28〜29）への準拠：
// ・画面名はヘッダーに出す（ScreenTitle）。外周の余白は px-6 pt-3 pb-3、一覧画面の型（→ 05）
// ・未保存の入力の破棄確認は RightPane（dirty）に任せ、画面では持たない（→ 02 §13.1）
// ・モック用の権限切替は SingleCombobox（絞り込み欄なし）。shadcn の Select は使わない（→ 02 §4）
// ・画面初期表示時に先頭の検索条件へフォーカスする（→ 06 初期フォーカス）

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  masterConfirmMessage,
  masterMessage,
} from '@/utils/common/masterMessages';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ScreenTitle } from '@/components/ui/screen-title';
import { SingleCombobox } from '@/components/ui/single-combobox';
import { BUTTON_STYLES, FORM_LABEL_CLASS } from '@/styles/commonStyles';
import { MasterSearchCard } from './MasterSearchCard';
import { MasterListCard } from './MasterListCard';
import { MasterEditPane } from './MasterEditPane';
import type {
  MasterCriteria,
  MasterCriteriaValue,
  MasterDraft,
  MasterGridRow,
  MasterPaneMode,
  MasterRow,
  MasterScreenDef,
} from './masterTypes';
import {
  MOCK_USER_NAME,
  applyCriteria,
  businessKeyDisplay,
  deleteKeyDisplay,
  downloadUploadSheet,
  draftFromRow,
  emptyDraft,
  endOfTimeOf,
  hasUpdate,
  nextAutoNumber,
  nowString,
  periodBefore,
  predecessorOf,
  resolveMasterDef,
  rowValuesFromDraft,
  validateDraft,
  withCascade,
  withGenerationInfo,
} from './masterUtils';

// 権限（モック）：参照＝全ユーザー、更新＝マスタ管理者。参照のみは更新系ボタンを非活性で表示する（10/2 決定6）
type MockRole = 'maintainer' | 'viewer';
const ROLE_OPTIONS: { value: MockRole; label: string }[] = [
  { value: 'maintainer', label: 'マスタ管理者（更新可）' },
  { value: 'viewer', label: '参照のみ' },
];

type ConfirmKind = 'delete' | 'inactivate';

interface MasterMaintenancePageProps {
  def: MasterScreenDef;
  initialRows: MasterRow[];
}

export function MasterMaintenancePage({
  def: screenDef,
  initialRows,
}: MasterMaintenancePageProps) {
  // 全マスタ共通のルール（適用終了年月日は必須・検索条件にしない 等）を当てた定義
  const def = useMemo(() => resolveMasterDef(screenDef), [screenDef]);
  const [rows, setRows] = useState<MasterRow[]>(initialRows);
  const [criteria, setCriteria] = useState<MasterCriteria>({});
  const [role, setRole] = useState<MockRole>('maintainer');
  const canEdit = role === 'maintainer';

  const [isPaneOpen, setIsPaneOpen] = useState(false);
  const [paneMode, setPaneMode] = useState<MasterPaneMode>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MasterDraft>(() => emptyDraft(def));
  // 破棄確認の判定に使う、ペインを開いた時点の入力値
  const [baseline, setBaseline] = useState<MasterDraft>(() => emptyDraft(def));
  const [errors, setErrors] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<{
    kind: ConfirmKind;
    row: MasterRow;
  } | null>(null);

  // 画面初期表示時に先頭の検索条件へフォーカスする（→ 06 初期フォーカス）
  useEffect(() => {
    const id = `${def.routeId}-search-${def.searchKeys[0] ?? ''}`;
    const frame = requestAnimationFrame(() => {
      document.getElementById(id)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [def]);

  // 検索条件を適用してから世代を集約する（絞り込みで最新世代が外れても親が欠けないようにする）
  const gridRows = useMemo<MasterGridRow[]>(
    () => withGenerationInfo(def, applyCriteria(def, rows, criteria)),
    [def, rows, criteria]
  );

  // 未保存の入力があるか（ペインを開いた時点の値との差。RightPane の破棄確認に渡す）
  const isDirty = useMemo(
    () =>
      def.fields.some((f) => (draft[f.key] ?? '') !== (baseline[f.key] ?? '')),
    [def, draft, baseline]
  );

  // state の setter しか使わないため依存なしで安定させる（handleEdit／handleCopy の依存配列に入れる）
  const openPane = useCallback(
    (mode: MasterPaneMode, nextDraft: MasterDraft, id: string | null) => {
      setPaneMode(mode);
      setDraft(nextDraft);
      setBaseline(nextDraft);
      setEditingId(id);
      setErrors([]);
      setIsPaneOpen(true);
    },
    []
  );

  const handleCreate = () => openPane('create', emptyDraft(def), null);

  // 更新ペインは変更できる項目があるマスタだけ（主キーと無効化フラグだけのマスタは登録・無効化・削除のみ。Q&A QM-033）
  const handleEdit = useCallback(
    (row: MasterGridRow) => {
      if (!hasUpdate(def)) return;
      openPane('update', draftFromRow(def, row), row.id);
    },
    [def, openPane]
  );

  // コピー登録：値を引き継いだ登録ペインを開く。適用期間以外の主キーは変更不可で、
  // 新しい世代の適用開始は入力させ、適用終了は 4000/12/31（年月は 4000/12）にする（Q&A No.34⑦⑧）。
  // 自動採番のコードが主キー（一般卸メッシュコード）のときは同じコードの新しい世代なので引き継ぐ
  const handleCopy = useCallback(
    (row: MasterGridRow) => {
      const copied = draftFromRow(def, row);
      const autoField = def.fields.find((f) => f.key === def.autoNumberKey);
      if (def.autoNumberKey && !autoField?.pk) copied[def.autoNumberKey] = '';
      if (def.generation) {
        copied[def.generation.startKey] = '';
        copied[def.generation.endKey] = endOfTimeOf(def);
      }
      openPane('copy', copied, null);
    },
    [def, openPane]
  );

  const handleDelete = useCallback(
    (row: MasterGridRow) => setConfirm({ kind: 'delete', row }),
    []
  );
  const handleInactivate = useCallback(
    (row: MasterGridRow) => setConfirm({ kind: 'inactivate', row }),
    []
  );

  const handleDraftChange = (key: string, value: string) => {
    setDraft((d) => withCascade(def, d, key, value));
  };

  const handleCriteriaChange = (key: string, value: MasterCriteriaValue) => {
    setCriteria((c) => withCascade(def, c, key, value));
  };

  // 閉じる：未保存の入力の確認は RightPane が行う（×・Esc・別のペインを開いたとき。画面設計標準 3.4）
  const closePane = () => {
    setIsPaneOpen(false);
    setErrors([]);
  };

  const handleSubmit = () => {
    const messages = validateDraft(def, draft, rows, paneMode, editingId);
    if (messages.length > 0) {
      setErrors(messages);
      return;
    }
    const now = nowString();
    const values = rowValuesFromDraft(def, draft);
    if (paneMode !== 'update') {
      const autoNumber =
        def.autoNumberKey && !draft[def.autoNumberKey]
          ? {
              [def.autoNumberKey]: nextAutoNumber(
                rows,
                def.autoNumberKey,
                def.autoNumberPrefix ?? ''
              ),
            }
          : {};
      const created: MasterRow = {
        ...values,
        ...autoNumber,
        id: `${def.routeId}-${Date.now()}`,
        createdBy: MOCK_USER_NAME,
        createdAt: now,
        updatedBy: MOCK_USER_NAME,
        updatedAt: now,
      };
      // 新しい世代を登録したら、前の世代の適用終了を新しい世代の適用開始の前日（前月）にする（10/21 決定）
      const gen = def.generation;
      const predecessor = gen ? predecessorOf(def, rows, draft) : undefined;
      const newEnd =
        gen && predecessor ? periodBefore(def, draft[gen.startKey] ?? '') : '';
      setRows((prev) => [
        ...prev.map((r) =>
          gen && r.id === predecessor?.id
            ? {
                ...r,
                [gen.endKey]: newEnd,
                updatedBy: MOCK_USER_NAME,
                updatedAt: now,
              }
            : r
        ),
        created,
      ]);
      const endLabel = gen
        ? (def.fields.find((f) => f.key === gen.endKey)?.label ?? '')
        : '';
      toast.success(
        predecessor
          ? masterMessage('MSG-S-019', def.entityLabel, endLabel, newEnd)
          : masterMessage('MSG-S-003', def.entityLabel)
      );
      // コピー登録は1件ごとに閉じる（主キーを変更不可にしているため続けての登録には使わない）
      if (paneMode === 'copy') {
        closePane();
        return;
      }
      // 新規登録は入力をクリアして続けて登録できる（連続追加ボタンは設けない）
      const cleared = emptyDraft(def);
      setDraft(cleared);
      setBaseline(cleared);
      setErrors([]);
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === editingId
          ? { ...r, ...values, updatedBy: MOCK_USER_NAME, updatedAt: now }
          : r
      )
    );
    toast.success(masterMessage('MSG-S-005', def.entityLabel));
    closePane();
  };

  const handleConfirm = () => {
    if (!confirm) return;
    const target = confirm.row;
    if (confirm.kind === 'delete') {
      // 論理削除：削除したデータは業務ユーザーに表示しない（7/30 決定1・10）
      setRows((prev) => prev.filter((r) => r.id !== target.id));
      toast.success(masterMessage('MSG-S-002', def.entityLabel));
    } else {
      setRows((prev) =>
        prev.map((r) =>
          r.id === target.id
            ? {
                ...r,
                inactive: true,
                updatedBy: MOCK_USER_NAME,
                updatedAt: nowString(),
              }
            : r
        )
      );
      toast.success(masterMessage('MSG-S-018', def.entityLabel));
    }
    setConfirm(null);
  };

  const handleDownloadUploadSheet = () => {
    const fileName = downloadUploadSheet(def);
    toast.success(
      masterMessage('MSG-S-004', `アップロード用シート（${fileName}）`)
    );
  };

  // 確認ダイアログの文言は共通メッセージ一覧（1行目＝タイトル、2行目＝本文）。実行ボタンは操作名（→ 02 §5）
  const confirmText = (() => {
    if (!confirm)
      return { title: '', description: '', label: 'OK', className: '' };
    if (confirm.kind === 'delete') {
      // 世代管理のマスタは適用開始も主キーのため併せて出す
      return {
        ...masterConfirmMessage(
          'MSG-C-001',
          `${def.entityLabel}「${deleteKeyDisplay(def, confirm.row)}」`
        ),
        label: '削除',
        className: BUTTON_STYLES.delete,
      };
    }
    return {
      ...masterConfirmMessage(
        'MSG-C-006',
        `${def.entityLabel}「${businessKeyDisplay(def, confirm.row)}」`
      ),
      label: '無効化',
      className: BUTTON_STYLES.primary,
    };
  })();

  const currentRow = editingId
    ? rows.find((r) => r.id === editingId)
    : undefined;

  // 一覧画面（検索条件＋グリッド1つ）の型：画面側に縦スクロールを出さず、グリッドの中だけをスクロールさせる（→ 05）
  return (
    <div className="min-w-300 h-full flex flex-col">
      <div className="px-6 pt-3 pb-3 flex-1 min-h-0 flex flex-col">
        {/* 画面名はヘッダー（システム名の右）に表示する */}
        <ScreenTitle title={def.title} />
        {/* モック用の権限切替（実装では画面操作権限マスタで判定する）。本文の最初の行の右端に置く */}
        <div className="mb-2 flex shrink-0 items-center justify-end gap-2">
          <label
            htmlFor={`${def.routeId}-role`}
            className={`${FORM_LABEL_CLASS} whitespace-nowrap`}
          >
            表示権限（モック）
          </label>
          <SingleCombobox
            id={`${def.routeId}-role`}
            className="w-52"
            options={ROLE_OPTIONS}
            value={role}
            onChange={(v) => setRole(v as MockRole)}
            searchable={false}
          />
        </div>

        <MasterSearchCard
          def={def}
          criteria={criteria}
          onChange={handleCriteriaChange}
          onClear={() => setCriteria({})}
        />

        <MasterListCard
          def={def}
          rows={gridRows}
          canEdit={canEdit}
          onCreate={handleCreate}
          onEdit={handleEdit}
          onCopy={handleCopy}
          onDelete={handleDelete}
          onInactivate={handleInactivate}
          onDownloadUploadSheet={handleDownloadUploadSheet}
        />
      </div>

      <MasterEditPane
        def={def}
        open={isPaneOpen}
        mode={paneMode}
        draft={draft}
        dirty={isDirty}
        errors={errors}
        current={currentRow}
        onChange={handleDraftChange}
        onSubmit={handleSubmit}
        onClose={closePane}
      />

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={confirmText.title}
        description={confirmText.description}
        confirmLabel={confirmText.label}
        confirmClassName={confirmText.className}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
