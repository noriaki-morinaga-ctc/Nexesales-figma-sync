// paymentOrgCascade（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import type {
  OrgOption,
  OrgSelection,
  PaymentOrgCombo,
  StoreOrgSelection,
  StoreOwnerOrg,
} from '@/app/types/organization';
import { STORE_NONE } from '@/app/constants/storeHierarchy';
import { applyStoreCascade } from '@/app/utils/common/storeHierarchy';
import { toYearMonth } from '@/app/utils/common/yearMonth';
import {
  AUTO_SELECT_FIELDS,
  MASTER_DEPT_ONLY_COMBOS,
  MASTER_ORG_COMBOS,
  OWNER_ORG_NONE,
  PAYMENT_ORG_COMBOS,
  STORE_OWNER_ORG,
} from '@/app/constants/paymentOrgCascade';

// ============================================================================
// ヘルパー
// ============================================================================

const toOptions = (values: readonly string[]): OrgOption[] =>
  values.map((v) => ({ value: v, label: v }));

// 販売店が未選択（空 or「-」）か。
const isStoreUnselected = (store: string): boolean =>
  !store || store === STORE_NONE;

// 候補の母集団を決める。
//   targetMonth 指定あり：当該年月の支払組合せ
//   targetMonth 指定なし：マスタ由来の組合せ（販売店未選択時の部署候補も含む）
const combosFor = (
  targetMonth: string,
  combos?: PaymentOrgCombo[]
): PaymentOrgCombo[] => {
  const month = toYearMonth(targetMonth ?? '');
  // 差し替え（テスト用）が指定された場合も、年月の絞り込みは同じように効かせる。
  const source =
    combos ??
    (month
      ? PAYMENT_ORG_COMBOS
      : [...MASTER_ORG_COMBOS, ...MASTER_DEPT_ONLY_COMBOS]);
  return month
    ? source.filter((c) => toYearMonth(c.targetMonth) === month)
    : source;
};

// 指定された項目の値で母集団を絞る（未選択の項目は絞り込まない）。
const narrow = (
  combos: PaymentOrgCombo[],
  selection: Partial<OrgSelection>
): PaymentOrgCombo[] =>
  combos.filter(
    (c) =>
      (isStoreUnselected(selection.store ?? '') ||
        c.store === selection.store) &&
      (!selection.dept || c.dept === selection.dept) &&
      (!selection.staff || c.staff === selection.staff)
  );

// 母集団に残っている値を重複なく取り出す。
// 空文字（担当者が未登録の部署のプレースホルダ）と「-」（販売店の未選択）は候補に出さない。
const distinct = (
  combos: PaymentOrgCombo[],
  field: keyof OrgSelection
): string[] =>
  [...new Set(combos.map((c) => c[field]))].filter(
    (v) => v && v !== STORE_NONE
  );

// ============================================================================
// 選択肢
// ============================================================================
// いずれも targetMonth は省略可能（省略時はマスタ由来の候補）。
// combos はテスト用の差し替え口。

// 費用負担部署の選択肢。販売店・担当者が選択済みなら、その組合せが存在する部署へ絞り込む。
export const deptOptionsFor = (
  store: string,
  staff = '',
  targetMonth = '',
  combos?: PaymentOrgCombo[]
): OrgOption[] =>
  toOptions(
    distinct(narrow(combosFor(targetMonth, combos), { store, staff }), 'dept')
  );

// 担当者の選択肢。販売店・費用負担部署が選択済みなら、その組合せが存在する担当者へ絞り込む。
export const staffOptionsFor = (
  store: string,
  dept = '',
  targetMonth = '',
  combos?: PaymentOrgCombo[]
): OrgOption[] =>
  toOptions(
    distinct(narrow(combosFor(targetMonth, combos), { store, dept }), 'staff')
  );

// 販売店の選択肢の絞り込みに使う、費用負担部署に紐づく販売店の一覧。
// 部署が未選択のときは絞り込まない（undefined を返す）。
export const storesForDept = (
  dept: string,
  targetMonth = '',
  combos?: PaymentOrgCombo[]
): string[] | undefined =>
  dept
    ? distinct(narrow(combosFor(targetMonth, combos), { dept }), 'store')
    : undefined;

// ============================================================================
// 連動
// ============================================================================

// 組織3項目の連動を適用した結果を返す。
//   販売店を選択：紐づかない費用負担部署・担当者をクリアする（残った候補が1件なら自動設定）。
//   費用負担部署を選択：紐づかない販売店・担当者をクリアする（担当者が一意なら自動設定）。
//   担当者を選択：所属する費用負担部署を自動設定し、紐づかない販売店はクリアする。
//   いずれかをクリア：絞り込みを解除するだけで他項目は維持する
//     （ただし費用負担部署のクリア時は、担当者が必ず1つの部署に属するため担当者もクリアする）。
export function applyOrgCascade(
  current: OrgSelection,
  field: keyof OrgSelection,
  value: string,
  targetMonth = '',
  combos?: PaymentOrgCombo[]
): OrgSelection {
  const next: OrgSelection = { ...current, [field]: value };
  if (field === 'store' && isStoreUnselected(value)) next.store = STORE_NONE;

  // クリア時は絞り込みを解除するだけ（自動設定もしない）。
  if (field === 'dept' && !value) return { ...next, staff: '' };
  if (field === 'staff' && !value) return next;
  if (field === 'store' && isStoreUnselected(value)) return next;

  // 変更した項目だけで絞った母集団。他2項目の妥当性はこれを基準に判定する。
  const pool = narrow(combosFor(targetMonth, combos), { [field]: value });

  // 変更した項目と両立しなくなった値はクリアする。
  for (const other of ['store', 'dept', 'staff'] as (keyof OrgSelection)[]) {
    if (other === field) continue;
    const held = next[other];
    if (other === 'store' && isStoreUnselected(held)) continue;
    if (!held) continue;
    if (!pool.some((c) => c[other] === held)) {
      next[other] = other === 'store' ? STORE_NONE : '';
    }
  }

  // 未選択の項目は、残った母集団で候補が1件なら自動選択する
  //（部署を確定させると担当者の候補がさらに絞られるため、都度絞り直す）。
  // 直前に操作した項目は対象外（クリアした値が自動で戻らないようにする）。
  for (const target of AUTO_SELECT_FIELDS) {
    if (target === field || next[target]) continue;
    const candidates = distinct(narrow(pool, next), target);
    if (candidates.length === 1) next[target] = candidates[0];
  }

  return next;
}

// 商流3項目（storeHierarchy の applyStoreCascade）と組織3項目の連動を合成して適用する。
// 販売店は両者に共通する項目のため、商流側の連動結果を組織側の入力として引き渡す。
export function applyStoreOrgCascade(
  current: StoreOrgSelection,
  field: keyof StoreOrgSelection,
  value: string,
  targetMonth = '',
  combos?: PaymentOrgCombo[]
): StoreOrgSelection {
  // 商流3項目の変更：先に商流の連動を適用し、確定した販売店で組織側を連動させる。
  if (
    field === 'primaryStore' ||
    field === 'tertiaryStore' ||
    field === 'store'
  ) {
    const stores = applyStoreCascade(current, field, value);
    const org = applyOrgCascade(
      { store: stores.store, dept: current.dept, staff: current.staff },
      'store',
      stores.store,
      targetMonth,
      combos
    );
    return { ...stores, ...org };
  }

  // 組織項目の変更：組織側の連動を適用し、販売店が変わった場合のみ商流も追従させる。
  const org = applyOrgCascade(current, field, value, targetMonth, combos);
  if (org.store === current.store) return { ...current, ...org };
  const stores = applyStoreCascade(current, 'store', org.store);
  return { ...stores, ...org };
}

// 販売店の担当組織を返す。販売店が未選択（空・「-」）または担当組織が未登録の
// 場合は全項目を空で返す（画面側は「－」表示、検索条件は絞り込みなしとする）。
// 担当末端組織は担当部署と同値とする。当モックは代行入力の明細を持たないため
//（検印済み明細の terminalOrg と同じ扱い）。
export const ownerOrgOf = (store: string): StoreOwnerOrg => {
  if (isStoreUnselected(store)) return OWNER_ORG_NONE;
  const owner = STORE_OWNER_ORG[store];
  if (!owner) return OWNER_ORG_NONE;
  return { ...owner, terminalOrg: owner.dept };
};
