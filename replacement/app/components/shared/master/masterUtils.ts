// 型1 マスタメンテ画面の共通ロジック（検索・世代の集約・入力チェック・採番・UL用シート）。
// 画面固有の業務ロジックは持たず、MasterScreenDef の定義だけで動く。
// メッセージの文言は共通メッセージ一覧（constants/masterMessages.ts）から引く（文言をここに書かない）。

import * as XLSX from 'xlsx';
import type { SingleComboboxOption } from '../../ui/single-combobox';
import { masterMessage } from '../../../constants/masterMessages';
import type {
  MasterCriteria,
  MasterCriteriaValue,
  MasterDraft,
  MasterFieldDef,
  MasterGridRow,
  MasterPaneMode,
  MasterRow,
  MasterScreenDef,
  MasterUniqueGroup,
} from './masterTypes';

/** モックのログインユーザー（共通ヘッダーの表示名に合わせる） */
export const MOCK_USER_NAME = 'アサヒ太郎';

/** 無効化フラグの検索条件のキー（項目ではないため予約キーで扱う。値は active／inactive の配列） */
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
 * 主キーの項目へ親としてつながる項目か（事業場→部署→社員の事業場・部署など）。
 * 主キーを絞り込むための項目で、主キーが変更不可のときは一緒に変更不可になる
 */
export const isAncestorOfPk = (def: MasterScreenDef, key: string): boolean =>
  def.fields.some(
    (c) => c.parentKey === key && (c.pk === true || isAncestorOfPk(def, c.key))
  );

/**
 * 更新ペインで変更できる項目（主キー・固定値・表示のみ・主キーの親（絞り込み用の項目）を除く）
 */
export const updatableFields = (def: MasterScreenDef): MasterFieldDef[] =>
  formFields(def).filter(
    (f) =>
      !f.pk &&
      !f.readOnly &&
      f.fixedValue === undefined &&
      !isAncestorOfPk(def, f.key)
  );

/**
 * 更新ペイン（操作列の編集アイコン・行のダブルクリック）を設けるか。
 * 変更できる項目が無いマスタ（主キーと無効化フラグだけ。システム管理者設定など）は
 * 登録・無効化・削除だけにする（Q&A QM-033。型1 ルール R-63）。画面定義では指定せず、項目から判定する
 */
export const hasUpdate = (def: MasterScreenDef): boolean =>
  updatableFields(def).length > 0;

/** 幅の広い入力欄にする文字数（この文字数以上の text と textarea。Q&A QM-034） */
export const WIDE_TEXT_LENGTH = 40;
export const isWideField = (field: MasterFieldDef): boolean =>
  field.kind === 'textarea' ||
  (field.kind === 'text' && (field.maxLength ?? 0) >= WIDE_TEXT_LENGTH);

/** 複数行の入力欄の行数（約 50 文字で 1 行。3〜6 行） */
export const textareaRows = (field: MasterFieldDef): number =>
  Math.min(6, Math.max(3, Math.ceil((field.maxLength ?? 150) / 50)));

/** 右ペインの幅（rem）。幅の広い入力欄を持つ画面は広げて開く（利用者はドラッグで変えられる） */
export const PANE_WIDTH_REM = 34;
export const PANE_WIDTH_WIDE_REM = 44;
export const paneWidthOf = (def: MasterScreenDef): number =>
  formFields(def).some(isWideField) ? PANE_WIDTH_WIDE_REM : PANE_WIDTH_REM;

/** 検索条件の値を配列にそろえる（複数選択の項目は配列、それ以外は空文字＝未入力） */
export const criteriaValues = (
  value: MasterCriteriaValue | undefined
): string[] => (Array.isArray(value) ? value : value ? [value] : []);

/** 検索条件に値が入っているか */
export const hasCriteriaValue = (
  value: MasterCriteriaValue | undefined
): boolean => (Array.isArray(value) ? value.length > 0 : Boolean(value));

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

/**
 * 親項目の選択値で子の候補を絞る（親が未選択なら全件）。
 * 検索条件は親が複数選択のため配列を受け付ける（選んだ親のいずれかに属する候補）
 */
export const childOptions = (
  field: MasterFieldDef,
  parentValue: MasterCriteriaValue | undefined
): { code: string; name: string }[] => {
  const all = field.options ?? [];
  const parents = criteriaValues(parentValue);
  if (!field.parentOf || parents.length === 0) return all;
  return all.filter((o) => parents.includes(field.parentOf?.[o.code] ?? ''));
};

/** 業務キーを構成する項目（主キーのうち世代管理の適用開始・終了を除く。自動採番のコードも業務キー） */
export const businessKeyFields = (def: MasterScreenDef): MasterFieldDef[] =>
  def.fields.filter(
    (f) =>
      f.pk &&
      f.key !== def.generation?.startKey &&
      f.key !== def.generation?.endKey
  );

/** ユニーク制約の項目（主キーとは別に重複を禁じる組）。fields の unique を 1 つの組として扱う */
export const uniqueKeyFields = (def: MasterScreenDef): MasterFieldDef[] =>
  def.fields.filter((f) => f.unique);

/** 一意制約の組の一覧（fields の unique ＋ uniqueGroups） */
export const uniqueGroupsOf = (def: MasterScreenDef): MasterUniqueGroup[] => {
  const groups: MasterUniqueGroup[] = [];
  const uniq = uniqueKeyFields(def);
  if (uniq.length > 0) groups.push({ keys: uniq.map((f) => f.key) });
  return groups.concat(def.uniqueGroups ?? []);
};

/** 確認ダイアログ・メッセージで行を示す項目（displayKeys があればそれ、無ければ業務キー） */
export const displayKeyFields = (def: MasterScreenDef): MasterFieldDef[] =>
  def.displayKeys
    ? def.displayKeys
        .map((k) => fieldByKey(def, k))
        .filter((f): f is MasterFieldDef => Boolean(f))
    : businessKeyFields(def);

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

/** combo／select のコードに対応する名称。値が無いときは emptyLabel（例：「指定なし」） */
export const optionName = (field: MasterFieldDef, code: unknown): string => {
  const c = String(code ?? '');
  if (!c) return field.emptyLabel ?? '';
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
 * 子を選ぶと親を自動で設定し（検索条件は所属する親を追加し）、親を変えたら親に合わない子をクリアする
 * （画面設計標準 3.2 2/2・02 §9-2 のルール①②④）。
 * 親子は 2 段以上でもよい（事業場→部署→社員。Q&A QM-032）：子を選ぶと親の親まで設定し、親を変えると子の子まで見直す
 */
export const withCascade = <T extends Record<string, MasterCriteriaValue>>(
  def: MasterScreenDef,
  values: T,
  key: string,
  value: MasterCriteriaValue
): T => {
  const next: Record<string, MasterCriteriaValue> = { ...values, [key]: value };
  // 子を選んだら所属する親を設定する（検索条件＝配列は親に追加、右ペイン＝文字列は置き換え）。親の親へも順に
  let child = fieldByKey(def, key);
  let childValue: MasterCriteriaValue = value;
  while (child?.parentKey && child.parentOf && hasCriteriaValue(childValue)) {
    const parentOf = child.parentOf;
    const parentKey = child.parentKey;
    const parents = criteriaValues(childValue)
      .map((v) => parentOf[v])
      .filter((p): p is string => Boolean(p));
    if (Array.isArray(childValue)) {
      const current = criteriaValues(next[parentKey]);
      next[parentKey] = [
        ...current,
        ...parents.filter((p) => !current.includes(p)),
      ];
    } else if (parents[0]) {
      next[parentKey] = parents[0];
    }
    childValue = next[parentKey];
    child = fieldByKey(def, parentKey);
  }
  // 親を変えたら、親に合わない子（子の子も）の値を外す。親が未選択なら子は絞らない
  const ancestorValues = criteriaValues(next[key]);
  if (ancestorValues.length === 0) return next as T;
  const descendants = (k: string): MasterFieldDef[] =>
    def.fields
      .filter((f) => f.parentKey === k)
      .flatMap((c) => [c, ...descendants(c.key)]);
  descendants(key).forEach((d) => {
    const dv = next[d.key];
    if (!hasCriteriaValue(dv)) return;
    // 子の値から親を順にたどって、変更した項目の値に当たるものを求める
    const toAncestor = (v: string): string => {
      let f: MasterFieldDef | undefined = d;
      let code = v;
      while (f && f.key !== key) {
        code = f.parentOf?.[code] ?? '';
        f = f.parentKey ? fieldByKey(def, f.parentKey) : undefined;
      }
      return code;
    };
    const belongs = (v: string) => ancestorValues.includes(toAncestor(v));
    if (Array.isArray(dv)) next[d.key] = dv.filter(belongs);
    else if (!belongs(dv)) next[d.key] = '';
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
 * 選択肢のある項目は複数選択（いずれかに一致。未選択＝条件なし）、他の条件とは AND。
 * 世代管理のマスタは各業務キーの最新世代で判定し、当てはまった業務キーは全世代を返す
 * （展開すれば過去の世代も見られる。Q&A No.34②）。
 */
export const applyCriteria = (
  def: MasterScreenDef,
  rows: MasterRow[],
  criteria: MasterCriteria
): MasterRow[] => {
  const active = Object.entries(criteria).filter(([, v]) =>
    hasCriteriaValue(v)
  );
  if (active.length === 0) return rows;
  const fromKey = startFromKey(def);
  const toKey = startToKey(def);
  const matches = (row: MasterRow): boolean =>
    active.every(([key, value]) => {
      if (key === INACTIVE_CRITERIA_KEY) {
        // 有効・無効の複数選択（両方なら条件なし）
        const states = criteriaValues(value);
        if (states.includes('active') && states.includes('inactive'))
          return true;
        return states.includes('inactive')
          ? row.inactive === true
          : !row.inactive;
      }
      if (def.generation && (key === fromKey || key === toKey)) {
        // 適用開始の From〜To（両端を含む）
        const start = String(row[def.generation.startKey] ?? '');
        const v = String(value);
        return key === fromKey ? start >= v : start <= v;
      }
      const field = fieldByKey(def, key);
      if (!field) return true;
      const cell = String(row[key] ?? '');
      if (Array.isArray(value)) return value.includes(cell);
      switch (field.kind) {
        case 'text':
        case 'textarea': {
          const keys = [key, ...(field.searchAlsoKeys ?? [])];
          return keys.some((k) => String(row[k] ?? '').includes(value));
        }
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

/** 数値入力の整数部の桁数（符号・小数は数えない） */
export const integerDigitsOf = (value: string): number =>
  value.replace(/^-/, '').split('.')[0].length;

/**
 * 入力チェック（フロント側）。
 * 必須・形式・文字数・桁と範囲・適用期間の前後・業務キーの重複・一意制約・世代の期間重複を検査し、
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
    if (f.kind === 'number') {
      const n = Number(v);
      if (Number.isNaN(n)) {
        errors.push(masterMessage('MSG-E-004', f.label));
      } else if (f.min !== undefined && n < f.min) {
        // 決定事項で決めた業務上の下限（例：適用優先順は 1 以上）
        errors.push(masterMessage('MSG-E-013', f.label, String(f.min)));
      } else if (
        (f.max !== undefined && n > f.max) ||
        (f.maxDigits !== undefined && integerDigitsOf(v) > f.maxDigits)
      ) {
        // 上限・桁の超過（共通メッセージに上限専用の文言が無いため「値が正しくありません」）
        errors.push(masterMessage('MSG-E-004', f.label));
      }
    }
    if (
      (f.kind === 'text' || f.kind === 'textarea') &&
      f.maxLength !== undefined &&
      [...v].length > f.maxLength
    ) {
      // 文字数の上限（入力欄でも超える文字を受け付けない。共通メッセージに文字数専用の文言が無いため「値が正しくありません」）
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
  // 一意制約：同じ値の組（世代管理は同じ適用開始の中で。未設定も同じ値として比べる）を重複して登録できない
  uniqueGroupsOf(def).forEach((group) => {
    const fields = group.keys
      .map((k) => fieldByKey(def, k))
      .filter((f): f is MasterFieldDef => Boolean(f));
    if (fields.length === 0) return;
    const sameUnique = (r: MasterRow): boolean =>
      (!group.activeOnly || r.inactive !== true) &&
      fields.every((f) => String(r[f.key] ?? '') === (draft[f.key] ?? '')) &&
      (!gen || String(r[gen.startKey] ?? '') === (draft[gen.startKey] ?? ''));
    if (others.some(sameUnique)) {
      const names = gen
        ? `${labelsOf(fields)}・${fieldByKey(def, gen.startKey)?.label ?? ''}`
        : labelsOf(fields);
      errors.push(masterMessage('MSG-E-012', names, def.entityLabel, op));
    }
  });
  return errors;
};

/** 行を示す表示（「コード:名称」で並べる。displayKeys があればその項目、無ければ業務キー。適用開始・終了は含まない） */
export const businessKeyDisplay = (
  def: MasterScreenDef,
  row: MasterRow
): string =>
  displayKeyFields(def)
    .map((f) => {
      const code = String(row[f.key] ?? '');
      if (f.kind === 'combo' || f.kind === 'select') {
        const name = optionName(f, code);
        if (!code) return name;
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
