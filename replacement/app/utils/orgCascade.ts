// 検索条件の組織項目（事業場 → 部署 → 末端組織 → 担当者）の連動フィルタリング。
// 仕様：docs/UI・UX/計画一覧Copilotモック_梶田案.html のタブ「仕様（連動フィルタリング）」。
//   ① 下位の選択肢を、上位の選択値の配下に絞り込む
//      （すぐ上が「指定なし」または「自動追加の値だけ」なら、さらに上で判定。上位がすべてそうなら全件）
//   ② 上位の選択値を外すと、選択肢から外れた下位の選択値を自動で解除する（最下位まで連鎖）
//   ③ 上位の選択値をすべて外しても、下位の選択値は解除しない（選択肢が全件に広がるため）
//   ④ 下位の値を選ぶと、その所属先を上位に自動で追加する（最上位まで連鎖。対象はその項目の選択値すべて）
//   ⑤ 空だった項目に④で値が入ると「自動追加の値だけ」の状態になり、下位の選択肢を絞り込まない。
//      利用者がその項目を操作する（選ぶ・外す）か、項目が空になると、この状態は解除される
//   ⑥ 下位の値を外しても、上位の選択値は変わらない（自動追加した上位の値も外さない）
//   ⑦ 自動で追加・解除・選択したときは通知する（通知文は本ファイルで作り、表示は画面側）
//   ⑧ 上位の選択で選択肢が1件だけに絞られた下位の項目は、値が空ならその1件を自動で選択する（上位から順に連鎖。
//      画面設計標準 3.2 2/2「候補が1件になった項目は自動で選択する」）。上位がすべて「指定なし」で全件の
//      項目は対象外。自動で選んだ値は、上位の変更で選択肢が1件でなくなったら解除する。
//      利用者がその項目を操作すると、自動で選んだ値ではなくなる（以後は①〜⑥のとおり）
// 画面ごとに持つ階層は違ってよい（例：末端組織の無い画面）。levels に上位から順に渡す。
// 純関数として提供し、状態は呼び出し側（hooks）が持つ。
import {
  ORG_ITEMS,
  findOrgItem,
  orgAncestor,
  type OrgLevel,
} from '../constants/orgHierarchy';

export interface OrgCascadeState {
  /** 階層ごとの選択値（表示順＝マスタの並び） */
  values: Partial<Record<OrgLevel, string[]>>;
  /** 「自動追加の値だけ」の状態の階層（ルール⑤） */
  autoOnly: OrgLevel[];
  /** 選択肢が1件のため自動で選んだ値の階層（ルール⑧） */
  autoSelected?: OrgLevel[];
}

export interface OrgCascadeConfig {
  /** 画面が持つ組織項目（上位から順） */
  levels: readonly OrgLevel[];
  /** 通知に使う項目名（例：salesRep → 作成者） */
  labels: Partial<Record<OrgLevel, string>>;
  /** 解除件数の単位（既定「件」。担当者は「名」） */
  units?: Partial<Record<OrgLevel, string>>;
}

export interface OrgCascadeResult {
  state: OrgCascadeState;
  /** ルール④で上位に追加した通知（上位から順） */
  addedMessages: string[];
  /** ルール②⑧で解除した通知（上位から順） */
  removedMessages: string[];
  /** ルール⑧で自動選択した通知（上位から順） */
  selectedMessages: string[];
}

const valuesOf = (state: OrgCascadeState, level: OrgLevel) =>
  state.values[level] ?? [];

// その項目が下位を絞り込むか（値があり、「自動追加の値だけ」の状態でない）
const narrows = (state: OrgCascadeState, level: OrgLevel) =>
  valuesOf(state, level).length > 0 && !state.autoOnly.includes(level);

const nameOf = (level: OrgLevel, value: string) =>
  findOrgItem(level, value)?.name ?? value;

// マスタの並び順にそろえる
const inMasterOrder = (level: OrgLevel, values: Iterable<string>) => {
  const set = new Set(values);
  return ORG_ITEMS[level].map((o) => o.value).filter((v) => set.has(v));
};

// ルール①⑤：その項目の選択肢（value の一覧・マスタの並び）
export function orgCandidates(
  config: OrgCascadeConfig,
  state: OrgCascadeState,
  level: OrgLevel
): string[] {
  const idx = config.levels.indexOf(level);
  // すぐ上から順に、絞り込む上位を探す
  for (let i = idx - 1; i >= 0; i--) {
    const upper = config.levels[i];
    if (!narrows(state, upper)) continue;
    const allowed = new Set(valuesOf(state, upper));
    return ORG_ITEMS[level]
      .filter((o) => {
        const a = orgAncestor(level, o.value, upper);
        return a !== undefined && allowed.has(a);
      })
      .map((o) => o.value);
  }
  return ORG_ITEMS[level].map((o) => o.value);
}

// 利用者が項目 level の選択値を next にしたときの、全項目の新しい状態と通知を求める。
export function applyOrgSelection(
  config: OrgCascadeConfig,
  prev: OrgCascadeState,
  level: OrgLevel,
  next: string[]
): OrgCascadeResult {
  const unitOf = (lv: OrgLevel) => config.units?.[lv] ?? '件';
  const prevValues = valuesOf(prev, level);
  const added = next.some((v) => !prevValues.includes(v));
  const state: OrgCascadeState = {
    values: { ...prev.values, [level]: inMasterOrder(level, next) },
    // 利用者が操作した項目は「自動追加の値だけ」の状態ではなくなる（ルール⑤）
    autoOnly: prev.autoOnly.filter((l) => l !== level),
    // 利用者が操作した項目は「自動で選んだ値」ではなくなる（ルール⑧）
    autoSelected: (prev.autoSelected ?? []).filter((l) => l !== level),
  };

  // ルール④：選んだ値の所属先を上位へ追加（最上位まで連鎖。対象はその項目の選択値すべて）
  const addedMessages: string[] = [];
  if (added) {
    for (let i = config.levels.indexOf(level); i > 0; i--) {
      const lower = config.levels[i];
      const upper = config.levels[i - 1];
      const lowerValues = valuesOf(state, lower);
      if (lowerValues.length === 0) break;
      const current = valuesOf(state, upper);
      const parents = lowerValues
        .map((v) => orgAncestor(lower, v, upper))
        .filter((v): v is string => v !== undefined);
      const toAdd = inMasterOrder(upper, parents).filter(
        (p) => !current.includes(p)
      );
      if (toAdd.length === 0) continue;
      if (current.length === 0) state.autoOnly = [...state.autoOnly, upper];
      state.values[upper] = inMasterOrder(upper, [...current, ...toAdd]);
      addedMessages.unshift(
        `${config.labels[upper]}に追加しました（${toAdd.map((v) => nameOf(upper, v)).join('、')}）`
      );
    }
  }

  // ルール②：選択肢から外れた値を解除（上位から順に判定するため最下位まで連鎖する）
  const removedMessages: string[] = [];
  config.levels.slice(1).forEach((lv) => {
    const allowed = new Set(orgCandidates(config, state, lv));
    const current = valuesOf(state, lv);
    const removed = current.filter((v) => !allowed.has(v));
    if (removed.length === 0) return;
    state.values[lv] = current.filter((v) => allowed.has(v));
    if (state.values[lv]!.length === 0) {
      state.autoOnly = state.autoOnly.filter((l) => l !== lv);
    }
    removedMessages.push(
      `${config.labels[lv]}の選択を${removed.length}${unitOf(lv)}解除しました（${removed.map((v) => nameOf(lv, v)).join('、')}）`
    );
  });

  // ルール⑧：選択肢が1件だけに絞られた空の項目を自動で選ぶ（上位から順に連鎖）。
  // 自動で選んだ値は、選択肢が1件でなくなったら解除し、1件のままなら追従させる
  const selectedMessages: string[] = [];
  config.levels.forEach((lv, idx) => {
    if (lv === level) return;
    const narrowed = config.levels
      .slice(0, idx)
      .some((upper) => narrows(state, upper));
    const candidates = narrowed ? orgCandidates(config, state, lv) : [];
    const isAuto = (state.autoSelected ?? []).includes(lv);
    if (isAuto) {
      if (candidates.length === 1) {
        state.values[lv] = candidates;
        return;
      }
      const released = valuesOf(state, lv);
      state.values[lv] = [];
      state.autoSelected = (state.autoSelected ?? []).filter((l) => l !== lv);
      if (released.length > 0) {
        removedMessages.push(
          `${config.labels[lv]}の自動選択を解除しました（${released.map((v) => nameOf(lv, v)).join('、')}）`
        );
      }
      return;
    }
    // 新しく自動で選ぶのは、利用者が操作した項目より下の項目だけ（利用者が外した項目を、
    // 別の項目の操作で選び直さないため）
    if (
      idx > config.levels.indexOf(level) &&
      valuesOf(state, lv).length === 0 &&
      candidates.length === 1
    ) {
      state.values[lv] = candidates;
      state.autoSelected = [...(state.autoSelected ?? []), lv];
      selectedMessages.push(
        `${config.labels[lv]}を自動で選択しました（${nameOf(lv, candidates[0])}）`
      );
    }
  });

  return { state, addedMessages, removedMessages, selectedMessages };
}
