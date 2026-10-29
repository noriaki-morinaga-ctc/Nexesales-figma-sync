// 型1 マスタメンテCRUD型 画面の本体（検索条件 ＋ 一覧 ＋ 右ペイン ＋ 確認ダイアログ）。
// 画面側は MasterScreenDef とモックの初期データを渡すだけで、全マスタ共通の標準仕様
// （マスタ画面標準化 p.7）に沿った画面になる。モックのためデータはメモリ上で保持する。

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  masterConfirmMessage,
  masterMessage,
} from '../../../constants/masterMessages';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import {
  BUTTON_STYLES,
  FORM_LABEL_CLASS,
  SCREEN_TITLE_CLASS,
} from '../../../../styles/commonStyles';
import { MasterSearchCard } from './MasterSearchCard';
import { MasterListCard } from './MasterListCard';
import { MasterEditPane } from './MasterEditPane';
import type {
  MasterCriteria,
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

type ConfirmKind = 'delete' | 'inactivate' | 'discard';

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
    row?: MasterRow;
  } | null>(null);

  // 検索条件を適用してから世代を集約する（絞り込みで最新世代が外れても親が欠けないようにする）
  const gridRows = useMemo<MasterGridRow[]>(
    () => withGenerationInfo(def, applyCriteria(def, rows, criteria)),
    [def, rows, criteria]
  );

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

  const handleEdit = useCallback(
    (row: MasterGridRow) => openPane('update', draftFromRow(def, row), row.id),
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

  const closePane = () => {
    setIsPaneOpen(false);
    setErrors([]);
  };

  // ×で閉じる：未保存の入力があれば破棄確認を出す（画面設計標準 3.4）
  const handleRequestClose = () => {
    if (isDirty) setConfirm({ kind: 'discard' });
    else closePane();
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
    if (confirm.kind === 'delete' && target) {
      // 論理削除：削除したデータは業務ユーザーに表示しない（7/30 決定1・10）
      setRows((prev) => prev.filter((r) => r.id !== target.id));
      toast.success(masterMessage('MSG-S-002', def.entityLabel));
    } else if (confirm.kind === 'inactivate' && target) {
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
    } else if (confirm.kind === 'discard') {
      closePane();
    }
    setConfirm(null);
  };

  const handleDownloadUploadSheet = () => {
    const fileName = downloadUploadSheet(def);
    toast.success(
      masterMessage('MSG-S-004', `アップロード用シート（${fileName}）`)
    );
  };

  // 確認ダイアログの文言は共通メッセージ一覧（1行目＝タイトル、2行目＝本文）
  const confirmText = (() => {
    if (!confirm)
      return { title: '', description: '', label: 'OK', className: '' };
    const key = confirm.row ? businessKeyDisplay(def, confirm.row) : '';
    switch (confirm.kind) {
      case 'delete':
        return {
          // 世代管理のマスタは適用開始も主キーのため併せて出す
          ...masterConfirmMessage(
            'MSG-C-001',
            `${def.entityLabel}「${confirm.row ? deleteKeyDisplay(def, confirm.row) : ''}」`
          ),
          label: '削除',
          className: BUTTON_STYLES.delete,
        };
      case 'inactivate':
        return {
          ...masterConfirmMessage('MSG-C-006', `${def.entityLabel}「${key}」`),
          label: '無効化',
          className: BUTTON_STYLES.primary,
        };
      default:
        return {
          ...masterConfirmMessage('MSG-C-002', '入力内容の破棄'),
          label: '破棄して閉じる',
          className: BUTTON_STYLES.delete,
        };
    }
  })();

  const currentRow = editingId
    ? rows.find((r) => r.id === editingId)
    : undefined;

  return (
    <div className="min-w-[75rem] h-full flex flex-col">
      <div className="px-6 pt-6 pb-6 flex-1 min-h-0 flex flex-col">
        {/* 画面タイトル ＋ 権限切替（モック用。実装では画面操作権限マスタで判定する） */}
        <div className="px-3 py-1.5 flex items-center gap-2">
          <h2 className={SCREEN_TITLE_CLASS}>{def.title}</h2>
          <div className="ml-auto flex items-center gap-2">
            <label
              htmlFor={`${def.routeId}-role`}
              className={`${FORM_LABEL_CLASS} whitespace-nowrap`}
            >
              表示権限（モック）
            </label>
            <Select value={role} onValueChange={(v) => setRole(v as MockRole)}>
              <SelectTrigger
                id={`${def.routeId}-role`}
                className="h-8 w-52 text-sm bg-white border-gray-400 shadow-sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <MasterSearchCard
          def={def}
          criteria={criteria}
          onChange={(key, value) =>
            setCriteria((c) => withCascade(def, c, key, value))
          }
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
        errors={errors}
        current={currentRow}
        onChange={handleDraftChange}
        onSubmit={handleSubmit}
        onClose={handleRequestClose}
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
