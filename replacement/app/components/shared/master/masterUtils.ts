// 型1 マスタメンテ画面の共通ロジック（検索・世代の集約・入力チェック・採番・UL用シート）。
// 画面固有の業務ロジックは持たず、MasterScreenDef の定義だけで動く。
// メッセージの文言は共通メッセージ一覧（constants/masterMessages.ts）から引く（文言をここに書かない）。

import * as XLSX from 'xlsx';
import type { SingleComboboxOption } from '../../ui/single-combobox';
import { masterMessage } from '../../../constants/masterMessages';
import type {
  MasterCriteria,
  MasterDraft,
  MasterFieldDef,
  MasterGridRow,
  MasterPaneMode,
  MasterRow,
  MasterScreenDef,
} from './masterTypes';

/** モックのログインユーザー（共通ヘッダーの表示名に合わせる） */
export const MOCK_USER_NAME = 'アサヒ太郎';

/** 無効化フラグの検索条件のキー（項目ではないため予約キーで扱う。値は active／inactive） */
export const INACTIVE_CRITERIA_KEY = '__inactive';

/** 有効なデータの適用終了年月日。適用終了は必ず設定する（Q&A No.34⑧、現行と同じ） */
export const END_OF_TIME = '4000/12/31';
/** 適用期間が年月のマスタの、有効なデータの適用終了年月 */
export const END_OF_MONTH = '4000/12';

/** 適用期間の粒度（適用終了の項目が年月なら month） */
export const periodKind = (def: MasterScreenDef): 'date' | 'month' =>
  def.generation && fieldByKey(def, def.generation.endKey)?.kind === 'month'
    ? 'month'
    : 'date';

/** 画面ごとの「有効なデータの適用終了」（年月日は 4000/12/31、年月は 4000/12） */
export const endOfTimeOf = (def: MasterScreenDef): string =>
  periodKind(def) === 'month' ? END_OF_MONTH : END_OF_TIME;

/** 世代管理の適用開始の検索条件（From〜To）のキー */
export const startFromKey = (def: MasterScreenDef): string =>
  `${def.generation?.startKey ?? ''}From`;
export const startToKey = (def: MasterScreenDef): string =>
  `${def.generation?.startKey ?? ''}To`;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 今日（YYYY/MM/DD） */
export const todayString = (): string => {
  const d = new Date();
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
};

/** 現在日時（YYYY/MM/DD HH:mm）。作成日時・更新日時に使う */
export const nowString = (): string => {
  const d = new Date();
  return `${todayString()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/** 日付入力（YYYY/MM/DD）の形式チェック */
export const isValidDateString = (value: string): boolean =>
  /^\d{4}\/\d{2}\/\d{2}$/.test(value);

/** 年月入力（YYYY/MM）の形式チェック */
export const isValidMonthString = (value: string): boolean =>
  /^\d{4}\/\d{2}$/.test(value);

/** 項目の種類に応じた形式チェック（date＝年月日、month＝年月） */
export const isValidPeriodValue = (
  kind: MasterFieldDef['kind'],
  value: string
): boolean =>
  kind === 'month' ? isValidMonthString(value) : isValidDateString(value);

export const fieldByKey = (
  def: MasterScreenDef,
  key: string
): MasterFieldDef | undefined => def.fields.find((f) => f.key === key);

/** 入力項目（右ペインに出す項目） */
export const formFields = (def: MasterScreenDef): MasterFieldDef[] =>
  def.fields.filter((f) => !f.hideInForm);

/**
 * 全マスタ共通のルールを画面定義に当てる（画面ごとの定義で外せないようにする）。
 * ・適用終了は必須（Q&A No.34⑧）
 * ・適用終了は検索条件にしない（適用開始の From〜To だけ。Q&A No.34②）
 */
export const resolveMasterDef = (def: MasterScreenDef): MasterScreenDef => {
  const gen = def.generation;
  if (!gen) return def;
  return {
    ...def,
    fields: def.fields.map((f) =>
      f.key === gen.endKey ? { ...f, required: true } : f
    ),
    searchKeys: def.searchKeys.filter((k) => k !== gen.endKey),
  };
};

/** 親項目の選択値で子の候補を絞る（親が未選択なら全件） */
export const childOptions = (
  field: MasterFieldDef,
  parentValue: string
): { code: string; name: string }[] => {
  const all = field.options ?? [];
  if (!field.parentOf || parentValue === '') return all;
  return all.filter((o) => field.parentOf?.[o.code] === parentValue);
};

/** 業務キーを構成する項目（主キーのうち世代管理の適用開始・終了を除く。自動採番のコードも業務キー） */
export const businessKeyFields = (def: MasterScreenDef): MasterFieldDef[] =>
  def.fields.filter(
    (f) =>
      f.pk &&
      f.key !== def.generation?.startKey &&
      f.key !== def.generation?.endKey
  );

/** ユニーク制約の項目（主キーとは別に重複を禁じる組） */
export const uniqueKeyFields = (def: MasterScreenDef): MasterFieldDef[] =>
  def.fields.filter((f) => f.unique);

/** 行の業務キー（表示・重複判定に使う） */
export const businessKeyOf = (
  def: MasterScreenDef,
  row: Record<string, unknown>
): string =>
  businessKeyFields(def)
    .map((f) => String(row[f.key] ?? ''))
    .join('|');

/** 項目名を「・」でつなぐ（メッセージの差し込み用） */
const labelsOf = (fields: MasterFieldDef[]): string =>
  fields.map((f) => f.label).join('・');

/** combo／select のコードに対応する名称 */
export const optionName = (field: MasterFieldDef, code: unknown): string => {
  const c = String(code ?? '');
  if (!c) return '';
  return field.options?.find((o) => o.code === c)?.name ?? c;
};

/** コード・名称の候補を検索付きコンボボックスの選択肢へ変換する（value＝コード） */
export const toComboOptions = (
  options: { code: string; name: string }[] | undefined
): SingleComboboxOption[] =>
  (options ?? []).map((o) => ({ value: o.code, label: o.name, code: o.code }));

/** 数値の表示書式（一覧・右ペインの表示用。入力欄は生の文字列のまま） */
export const formatNumber = (field: MasterFieldDef, value: unknown): string => {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  switch (field.format) {
    case 'decimal2':
      return n.toLocaleString('ja-JP', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    case 'decimal4':
      return n.toLocaleString('ja-JP', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      });
    default:
      return n.toLocaleString('ja-JP', { maximumFractionDigits: 0 });
  }
};

/**
 * 親子の連動を当てた値を返す（検索条件・右ペイン共通）。
 * 子を選ぶと親を自動で設定し、親を変えたら親に合わない子をクリアする。
 */
export const withCascade = <T extends Record<string, string>>(
  def: MasterScreenDef,
  values: T,
  key: string,
  value: string
): T => {
  const next: Record<string, string> = { ...values, [key]: value };
  const field = fieldByKey(def, key);
  if (field?.parentKey && field.parentOf && value !== '') {
    next[field.parentKey] = field.parentOf[value] ?? next[field.parentKey];
  }
  def.fields
    .filter((f) => f.parentKey === key)
    .forEach((child) => {
      const childValue = next[child.key] ?? '';
      if (
        childValue !== '' &&
        value !== '' &&
        child.parentOf?.[childValue] !== value
      ) {
        next[child.key] = '';
      }
    });
  return next as T;
};

/** 新規登録の初期値（固定値の項目はその値、適用終了は 4000/12/31（年月は 4000/12）、他は空） */
export const emptyDraft = (def: MasterScreenDef): MasterDraft =>
  Object.fromEntries(
    def.fields.map((f) => {
      if (f.fixedValue !== undefined) return [f.key, f.fixedValue];
      if (f.key === def.generation?.endKey) return [f.key, endOfTimeOf(def)];
      return [f.key, ''];
    })
  );

/** 行から入力値へ（更新・コピーの初期値） */
export const draftFromRow = (
  def: MasterScreenDef,
  row: MasterRow
): MasterDraft =>
  Object.fromEntries(
    def.fields.map((f) => [f.key, row[f.key] == null ? '' : String(row[f.key])])
  );

/** 入力値から行の項目値へ（number は数値に変換） */
export const rowValuesFromDraft = (
  def: MasterScreenDef,
  draft: MasterDraft
): Record<string, unknown> =>
  Object.fromEntries(
    def.fields.map((f) => {
      const v = draft[f.key] ?? '';
      if (f.kind === 'number') return [f.key, v === '' ? null : Number(v)];
      return [f.key, v];
    })
  );

/** 業務キーごとの最新世代（適用開始が最も新しい世代） */
const latestGenerationByKey = (
  def: MasterScreenDef,
  rows: MasterRow[]
): Map<string, MasterRow> => {
  const startKey = def.generation?.startKey ?? '';
  const latest = new Map<string, MasterRow>();
  rows.forEach((row) => {
    const group = businessKeyOf(def, row);
    const current = latest.get(group);
    if (
      !current ||
      String(row[startKey] ?? '') > String(current[startKey] ?? '')
    ) {
      latest.set(group, row);
    }
  });
  return latest;
};

/**
 * 検索条件を適用する（検索ボタンは無く、条件変更のたびに呼ばれる）。
 * 世代管理のマスタは各業務キーの最新世代で判定し、当てはまった業務キーは全世代を返す
 * （展開すれば過去の世代も見られる。Q&A No.34②）。
 */
export const applyCriteria = (
  def: MasterScreenDef,
  rows: MasterRow[],
  criteria: MasterCriteria
): MasterRow[] => {
  const active = Object.entries(criteria).filter(([, v]) => v !== '');
  if (active.length === 0) return rows;
  const fromKey = startFromKey(def);
  const toKey = startToKey(def);
  const matches = (row: MasterRow): boolean =>
    active.every(([key, value]) => {
      if (key === INACTIVE_CRITERIA_KEY) {
        return value === 'inactive' ? row.inactive === true : !row.inactive;
      }
      if (def.generation && (key === fromKey || key === toKey)) {
        // 適用開始の From〜To（両端を含む）
        const start = String(row[def.generation.startKey] ?? '');
        return key === fromKey ? start >= value : start <= value;
      }
      const field = fieldByKey(def, key);
      if (!field) return true;
      const cell = String(row[key] ?? '');
      switch (field.kind) {
        case 'text': {
          const keys = [key, ...(field.searchAlsoKeys ?? [])];
          return keys.some((k) => String(row[k] ?? '').includes(value));
        }
        case 'number':
          return cell === value;
        default:
          return cell === value;
      }
    });
  if (!def.generation) return rows.filter(matches);
  const hitKeys = new Set<string>();
  latestGenerationByKey(def, rows).forEach((row, group) => {
    if (matches(row)) hitKeys.add(group);
  });
  return rows.filter((row) => hitKeys.has(businessKeyOf(def, row)));
};

/**
 * 世代の情報を付ける。業務キーごとに最新世代（適用開始が最も新しい世代）を
 * 集約行（親）とし、それ以外の世代（過去の世代）を子にする。世代管理を持たない画面は全行が親になる。
 */
export const withGenerationInfo = (
  def: MasterScreenDef,
  rows: MasterRow[]
): MasterGridRow[] => {
  const gen = def.generation;
  if (!gen) {
    return rows.map((row) => ({
      ...row,
      generationGroup: row.id,
      isLatestGeneration: true,
      treePath: [row.id],
    }));
  }
  const latestByGroup = latestGenerationByKey(def, rows);
  return rows.map((row) => {
    const group = businessKeyOf(def, row);
    const isLatest = latestByGroup.get(group)?.id === row.id;
    return {
      ...row,
      generationGroup: group,
      isLatestGeneration: isLatest,
      treePath: isLatest ? [group] : [group, row.id],
    };
  });
};

/** 自動採番（既存の最大番号＋1。採番ルールは業務チームへ確認中） */
export const nextAutoNumber = (
  rows: MasterRow[],
  key: string,
  prefix: string,
  width = 4
): string => {
  const max = rows.reduce((acc, row) => {
    const v = String(row[key] ?? '');
    if (!v.startsWith(prefix)) return acc;
    const n = Number(v.slice(prefix.length));
    return Number.isNaN(n) ? acc : Math.max(acc, n);
  }, 0);
  return `${prefix}${String(max + 1).padStart(width, '0')}`;
};

/** 日付（YYYY/MM/DD）の前日 */
export const dayBefore = (date: string): string => {
  const [y, m, d] = date.split('/').map(Number);
  const dt = new Date(y, m - 1, d - 1);
  return `${dt.getFullYear()}/${pad2(dt.getMonth() + 1)}/${pad2(dt.getDate())}`;
};

/** 年月（YYYY/MM）の前月 */
export const monthBefore = (month: string): string => {
  const [y, m] = month.split('/').map(Number);
  const dt = new Date(y, m - 2, 1);
  return `${dt.getFullYear()}/${pad2(dt.getMonth() + 1)}`;
};

/** 適用期間の粒度に応じた「ひとつ前」（年月日なら前日、年月なら前月） */
export const periodBefore = (def: MasterScreenDef, value: string): string =>
  periodKind(def) === 'month' ? monthBefore(value) : dayBefore(value);

/**
 * 新しい世代を登録したときに、適用終了を自動で前日（前月）にする前の世代（10/21 朝比奈決定）。
 * 同じ業務キーで、新しい世代の適用開始より前に始まる最も新しい世代のうち、期間が重なるもの。
 * 適用終了が主キーに含まれるマスタ（管理対象商品など）は主キーが変わるため対象外（重なりはエラー）。
 */
export const predecessorOf = (
  def: MasterScreenDef,
  rows: MasterRow[],
  draft: MasterDraft
): MasterRow | undefined => {
  const gen = def.generation;
  if (!gen || fieldByKey(def, gen.endKey)?.pk) return undefined;
  const start = draft[gen.startKey] ?? '';
  if (!isValidPeriodValue(fieldByKey(def, gen.startKey)?.kind ?? 'date', start))
    return undefined;
  const key = businessKeyOf(def, draft);
  const prev = rows
    .filter(
      (r) =>
        businessKeyOf(def, r) === key && String(r[gen.startKey] ?? '') < start
    )
    .sort((a, b) =>
      String(b[gen.startKey] ?? '').localeCompare(String(a[gen.startKey] ?? ''))
    )[0];
  return prev && String(prev[gen.endKey] ?? '') >= start ? prev : undefined;
};

/**
 * 入力チェック（フロント側）。
 * 必須・形式・適用期間の前後・業務キーの重複・ユニーク制約・世代の期間重複を検査し、
 * エラー文言（共通メッセージ一覧）の配列を返す（右ペイン上部にまとめて表示する）。
 */
export const validateDraft = (
  def: MasterScreenDef,
  draft: MasterDraft,
  rows: MasterRow[],
  mode: MasterPaneMode,
  editingId: string | null
): string[] => {
  const errors: string[] = [];
  const op = mode === 'update' ? '更新' : '登録';
  formFields(def).forEach((f) => {
    if (f.readOnly) return;
    const v = (draft[f.key] ?? '').trim();
    if (f.required && v === '') {
      errors.push(masterMessage('MSG-E-015', f.label));
      return;
    }
    if (v === '') return;
    if (f.kind === 'number' && Number.isNaN(Number(v))) {
      errors.push(masterMessage('MSG-E-004', f.label));
    }
    if (f.kind === 'date' && !isValidDateString(v)) {
      errors.push(
        masterMessage(
          'MSG-E-008',
          `${f.label}は YYYY/MM/DD の形式で入力してください。`
        )
      );
    }
    if (f.kind === 'month' && !isValidMonthString(v)) {
      errors.push(
        masterMessage(
          'MSG-E-008',
          `${f.label}は YYYY/MM の形式で入力してください。`
        )
      );
    }
  });
  if (errors.length > 0) return errors;

  const others = rows.filter((r) => r.id !== editingId || mode !== 'update');
  const gen = def.generation;
  const bizFields = businessKeyFields(def);
  const keyOfDraft = businessKeyOf(def, draft);
  // 自動採番のコードが業務キーのとき、新規登録ではまだ値が無いので業務キーの重複は見ない
  const keyKnown = bizFields.every((f) => (draft[f.key] ?? '') !== '');
  if (gen) {
    const start = draft[gen.startKey] ?? '';
    const end = draft[gen.endKey] ?? '';
    // 前の世代は登録時に適用終了を前日（前月）にするため、重なりの判定から外す
    const predecessor =
      mode !== 'update' ? predecessorOf(def, rows, draft) : undefined;
    if (start && end < start) {
      const startLabel = fieldByKey(def, gen.startKey)?.label ?? '適用開始';
      const endLabel = fieldByKey(def, gen.endKey)?.label ?? '適用終了';
      errors.push(
        masterMessage(
          'MSG-E-008',
          `${endLabel}は${startLabel}以降にしてください。`
        )
      );
    }
    const overlapped =
      keyKnown &&
      others.find((r) => {
        if (r.id === predecessor?.id) return false;
        if (businessKeyOf(def, r) !== keyOfDraft) return false;
        const rs = String(r[gen.startKey] ?? '');
        const re = String(r[gen.endKey] ?? '');
        return rs <= end && start <= re;
      });
    if (overlapped) {
      errors.push(masterMessage('MSG-E-016', `${def.entityLabel}の世代`, op));
    }
  } else if (keyKnown) {
    const duplicated = others.some((r) => businessKeyOf(def, r) === keyOfDraft);
    if (duplicated) {
      errors.push(
        masterMessage('MSG-E-012', labelsOf(bizFields), def.entityLabel, op)
      );
    }
  }
  // ユニーク制約：同じ値の組（世代管理は同じ適用開始の中で）を重複して登録できない
  const uniq = uniqueKeyFields(def);
  if (uniq.length > 0) {
    const sameUnique = (r: MasterRow): boolean =>
      uniq.every((f) => String(r[f.key] ?? '') === (draft[f.key] ?? '')) &&
      (!gen || String(r[gen.startKey] ?? '') === (draft[gen.startKey] ?? ''));
    if (others.some(sameUnique)) {
      const names = gen
        ? `${labelsOf(uniq)}・${fieldByKey(def, gen.startKey)?.label ?? ''}`
        : labelsOf(uniq);
      errors.push(masterMessage('MSG-E-012', names, def.entityLabel, op));
    }
  }
  return errors;
};

/** 業務キーの表示（「コード:名称」で並べる。適用開始・終了は含まない） */
export const businessKeyDisplay = (
  def: MasterScreenDef,
  row: MasterRow
): string =>
  businessKeyFields(def)
    .map((f) => {
      const code = String(row[f.key] ?? '');
      if (f.kind === 'combo' || f.kind === 'select') {
        const name = optionName(f, code);
        return name && name !== code ? `${code}:${name}` : code;
      }
      if (f.kind === 'number') return formatNumber(f, code);
      return code;
    })
    .filter((s) => s !== '')
    .join(' / ');

/** 削除確認に出すキー。世代管理のマスタは適用開始も主キーのため併せて出す（10/21 戦略NET レビュー） */
export const deleteKeyDisplay = (
  def: MasterScreenDef,
  row: MasterRow
): string => {
  const key = businessKeyDisplay(def, row);
  const gen = def.generation;
  if (!gen) return key;
  const startLabel = fieldByKey(def, gen.startKey)?.label ?? '適用開始年月日';
  return `${key} / ${startLabel} ${String(row[gen.startKey] ?? '')}`;
};

/**
 * アップロード用シート（UL用シート）をダウンロードする。
 * 全件ダウンロード（右クリックのエクスポート）とは別物で、一括アップロードの
 * フォーマット（項目を削らせないヘッダ行）を取得する（10/2 決定1・6）。
 */
export const downloadUploadSheet = (def: MasterScreenDef): string => {
  const headers = def.uploadSheetColumns ?? formFields(def).map((f) => f.label);
  const sheet = XLSX.utils.aoa_to_sheet([headers]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, def.entityLabel.slice(0, 31));
  const stamp = nowString().replace(/[/ :]/g, '');
  const fileName = `${def.title}_アップロード用シート_${stamp}.xlsx`;
  XLSX.writeFile(book, fileName);
  return fileName;
};
