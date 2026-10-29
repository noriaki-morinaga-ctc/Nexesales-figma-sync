// 販売店 ⇄ 費用負担部署 ⇄ 担当者 の連動絞り込み（決定2。費用分割の B-4／振替詳細の A-1 で共用）。
// 店舗階層（storeHierarchy.ts の applyStoreCascade）と同じ形の純関数として提供する。
//
// 候補の求め方は 2 通りあり、引数 targetMonth の有無で切り替わる。
//   ・targetMonth あり：その対象年月の**支払として実在する組合せ**のみを候補にする
//     （memo A「候補は分割元と同じ対象年月の支払を参照する」。振替詳細が使用）
//   ・targetMonth なし：**マスタ上ありうる組合せ**を候補にする
//     （販売店に紐づく部署／部署に属する担当者。費用分割の分割先明細が使用）
// 費用分割側も分割元の対象年月を渡せるようになれば、マスタ側のフォールバックは廃止できる。
//
// 関係：
//   販売店 : 費用負担部署 ＝ N : N（相互に絞り込む）
//   費用負担部署 : 担当者 ＝ 1 : N（部署で担当者を絞り、担当者の選択で部署を自動設定）
//
// 値の表記は基本情報（BASIC_INFO.dept / staff）に合わせて「名称:コード」で統一する。
// 販売店の値は商流マスタ（storeHierarchy.ts）と同じ「名称:コード」を使う。
//
// あわせて、販売店1件に対して一意に定まる「担当組織」（事業場・担当部署・担当末端組織・
// 営業担当者）も当ファイルで持つ。販売店と組織の対応を1箇所に集約するため
//（→ ファイル末尾「商流販売店の担当組織」）。

import {
  STORE_NONE,
  applyStoreCascade,
  type StoreSelection,
} from './storeHierarchy';
import { toYearMonth } from '../utils/yearMonth';

// 商流・組織の現在値（分割先明細・振替先明細の1行分／検索条件の1組）。
export interface OrgSelection {
  store: string; // 販売店
  dept: string; // 費用負担部署
  staff: string; // 担当者
}

// 商流3項目と組織3項目をあわせた現在値（販売店は共通の1項目）。
export type StoreOrgSelection = StoreSelection & OrgSelection;

export interface OrgOption {
  value: string;
  label: string;
}

// 「対象年月 × 販売店 × 費用負担部署 × 担当者」の1組合せ。
export interface PaymentOrgCombo {
  targetMonth: string; // 対象年月（'YYYY/MM'）
  store: string; // 販売店（名称:コード）
  dept: string; // 費用負担部署（名称:コード）
  staff: string; // 担当者（名称:コード）
}

// ============================================================================
// マスタ（targetMonth を指定しないときの候補元）
// ============================================================================

// 費用負担部署マスタ（モック・10件）。
export const ORG_DEPTS = [
  '首都圏営業第一部:10002985',
  '首都圏営業第二部:10002990',
  '東北営業部:10003056',
  '北海道営業部:10003041',
  '中部営業部:10003002',
  '近畿営業部:10003015',
  '関西第1営業部:10003001',
  '中四国営業部:10003025',
  '九州営業部:10003030',
  '本社広域量販営業部:10000175',
] as const;

// 担当者マスタ（モック・10件）。担当者は必ず1つの費用負担部署に属する（1:N）。
export const ORG_STAFFS = [
  'アサヒ　太郎:5172733',
  'アサヒ　花子:5172734',
  'アサヒ　次郎:5172735',
  'アサヒ　美咲:5172736',
  'アサヒ　健太:5172737',
  'アサヒ　彩:5172738',
  'アサヒ　悠人:5172739',
  'アサヒ　結衣:5172740',
  'アサヒ　大輔:5172741',
  'アサヒ　千尋:5172742',
] as const;

// 費用負担部署 → 担当者（1:N）。
export const STAFFS_BY_DEPT: Record<string, string[]> = {
  '首都圏営業第一部:10002985': ['アサヒ　花子:5172734', 'アサヒ　結衣:5172740'],
  '首都圏営業第二部:10002990': ['アサヒ　太郎:5172733', 'アサヒ　大輔:5172741'],
  '東北営業部:10003056': ['アサヒ　悠人:5172739'],
  '北海道営業部:10003041': ['アサヒ　彩:5172738'],
  '中部営業部:10003002': ['アサヒ　次郎:5172735'],
  '近畿営業部:10003015': ['アサヒ　美咲:5172736'],
  '関西第1営業部:10003001': ['アサヒ　健太:5172737'],
  '中四国営業部:10003025': ['アサヒ　千尋:5172742'],
  '九州営業部:10003030': [],
  '本社広域量販営業部:10000175': [],
};

// 販売店 → 費用負担部署（N:N）。販売店に紐づかない部署は候補に出さない。
export const DEPTS_BY_STORE: Record<string, string[]> = {
  'イオンリテール:21100677': [
    '首都圏営業第一部:10002985',
    '首都圏営業第二部:10002990',
    '本社広域量販営業部:10000175',
  ],
  'イオンリテール関東:21100684': [
    '首都圏営業第一部:10002985',
    '首都圏営業第二部:10002990',
  ],
  'マックスバリュ関東:21100742': [
    '首都圏営業第二部:10002990',
    '中部営業部:10003002',
  ],
  'マックスバリュ東北:21100731': [
    '東北営業部:10003056',
    '北海道営業部:10003041',
  ],
  'イトーヨーカ堂:21100695': [
    '首都圏営業第一部:10002985',
    '本社広域量販営業部:10000175',
  ],
  'ヨークベニマル:21100758': ['東北営業部:10003056', '北海道営業部:10003041'],
  'ライフコーポレーション:21100703': [
    '近畿営業部:10003015',
    '関西第1営業部:10003001',
  ],
  'サミット:21100718': ['首都圏営業第二部:10002990', '近畿営業部:10003015'],
  'ヤオコー:21100769': ['中四国営業部:10003025', '九州営業部:10003030'],
};

// 上記マスタを「組合せ」の形へ展開する（targetMonth は持たない＝年月で絞らない）。
// 担当者が未登録の部署も候補に残すため、担当者を空文字にした組合せを1件作る。
const MASTER_ORG_COMBOS: PaymentOrgCombo[] = Object.entries(
  DEPTS_BY_STORE
).flatMap(([store, depts]) =>
  depts.flatMap((dept) => {
    const staffs = STAFFS_BY_DEPT[dept] ?? [];
    return staffs.length
      ? staffs.map((staff) => ({ targetMonth: '', store, dept, staff }))
      : [{ targetMonth: '', store, dept, staff: '' }];
  })
);

// 販売店が未選択のときの部署候補（マスタ全件）。上表に現れない部署も選べるようにする。
const MASTER_DEPT_ONLY_COMBOS: PaymentOrgCombo[] = ORG_DEPTS.flatMap((dept) => {
  const staffs = STAFFS_BY_DEPT[dept] ?? [];
  return staffs.length
    ? staffs.map((staff) => ({
        targetMonth: '',
        store: STORE_NONE,
        dept,
        staff,
      }))
    : [{ targetMonth: '', store: STORE_NONE, dept, staff: '' }];
});

// ============================================================================
// 支払の組合せ（targetMonth を指定したときの候補元）
// ============================================================================

// 支払として実在する組合せ（モック）。
// 値は振替詳細のモック明細（検印済み明細 ReferenceTable の INITIAL_REFERENCE_ROWS と
// 振替明細 NonProductExpensePane の EXPENSE_ROWS）に実在する組合せをそのまま列挙する。
// ※ 現行のモックでは 販売店 : 部署 = N : 1、部署 : 担当者 = 1 : 1 のため、
//   販売店・担当者を選ぶと部署（および担当者）が一意に定まる。
//   部署を選んだときのみ販売店の候補が複数残る。
export const PAYMENT_ORG_COMBOS: PaymentOrgCombo[] = [
  {
    targetMonth: '2025/10',
    store: 'アークス:21100784',
    dept: '北海道営業部:10003041',
    staff: 'アサヒ　彩:5172738',
  },
  {
    targetMonth: '2025/10',
    store: 'ヨークベニマル:21100792',
    dept: '東北営業部:10003056',
    staff: 'アサヒ　悠人:5172739',
  },
  {
    targetMonth: '2025/10',
    store: 'イオンリテール:21100677',
    dept: '首都圏営業第二部:10002990',
    staff: 'アサヒ　太郎:5172733',
  },
  {
    targetMonth: '2025/10',
    store: 'ヤオコー:21100758',
    dept: '首都圏営業第二部:10002990',
    staff: 'アサヒ　太郎:5172733',
  },
  {
    targetMonth: '2025/10',
    store: 'イトーヨーカ堂:21100695',
    dept: '首都圏営業第一部:10002985',
    staff: 'アサヒ　花子:5172734',
  },
  {
    targetMonth: '2025/10',
    store: 'サミット:21100732',
    dept: '首都圏営業第一部:10002985',
    staff: 'アサヒ　花子:5172734',
  },
  {
    targetMonth: '2025/10',
    store: 'マックスバリュ東海:21100678',
    dept: '中部営業部:10003002',
    staff: 'アサヒ　次郎:5172735',
  },
  {
    targetMonth: '2025/10',
    store: 'バロー:21100744',
    dept: '中部営業部:10003002',
    staff: 'アサヒ　次郎:5172735',
  },
  {
    targetMonth: '2025/10',
    store: 'ライフコーポレーション:21100703',
    dept: '中部営業部:10003002',
    staff: 'アサヒ　次郎:5172735',
  },
  {
    targetMonth: '2025/10',
    store: 'サミット:21100718',
    dept: '中部営業部:10003002',
    staff: 'アサヒ　次郎:5172735',
  },
  {
    targetMonth: '2025/10',
    store: '平和堂:21100711',
    dept: '近畿営業部:10003015',
    staff: 'アサヒ　美咲:5172736',
  },
  {
    targetMonth: '2025/10',
    store: 'イズミヤ:21100766',
    dept: '近畿営業部:10003015',
    staff: 'アサヒ　美咲:5172736',
  },
  {
    targetMonth: '2025/10',
    store: 'イズミ:21100725',
    dept: '九州営業部:10003028',
    staff: 'アサヒ　健太:5172737',
  },
  {
    targetMonth: '2025/10',
    store: 'サンリブ:21100779',
    dept: '九州営業部:10003028',
    staff: 'アサヒ　健太:5172737',
  },
];

// ============================================================================
// ヘルパー
// ============================================================================

const toOptions = (values: readonly string[]): OrgOption[] =>
  values.map((v) => ({ value: v, label: v }));

// 販売店が未選択（空 or「-」）か。
const isStoreUnselected = (store: string): boolean =>
  !store || store === STORE_NONE;

// 自動選択（候補が1件のとき値を確定する）の対象項目。
// 販売店は「-」＝未選択が意味を持つ入口項目のため自動選択しない。
const AUTO_SELECT_FIELDS: (keyof OrgSelection)[] = ['dept', 'staff'];

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

// ============================================================================
// 商流販売店の担当組織
// ============================================================================
// 振替詳細の基本情報が、固定する側（振替元／振替先）の商流販売店の担当組織を
// 表示するために参照する（20260728 第24回 宿題事項7／課題管理表 No.1080）。
// 上の連動（候補の絞り込み）とは別で、販売店1件に対して一意に定まる組織を表す。

// 販売店の担当組織。
export interface StoreOwnerOrg {
  office: string; // 事業場
  dept: string; // 担当部署
  terminalOrg: string; // 担当末端組織
  staff: string; // 営業担当者
}

// 販売店 → 担当組織（モック）。対象は基本情報で選べる販売店
//（storeHierarchy の STORE_HIERARCHY）の全件。
// 値は既存モックと矛盾しない組合せを採る。
//   ・PAYMENT_ORG_COMBOS に実在する販売店：その組合せ（部署・担当者）をそのまま使う
//   ・それ以外：DEPTS_BY_STORE の先頭の部署と、STAFFS_BY_DEPT の先頭の担当者
// 事業場は当画面の明細（ReferenceTable の INITIAL_REFERENCE_ROWS）が持つ値に合わせる。
// ※ 末端組織は dept と同値のため持たせない（ownerOrgOf で担当部署を写す）。
export const STORE_OWNER_ORG: Record<
  string,
  Omit<StoreOwnerOrg, 'terminalOrg'>
> = {
  'イオンリテール:21100677': {
    office: '首都圏本部:10000623',
    dept: '首都圏営業第二部:10002990',
    staff: 'アサヒ　太郎:5172733',
  },
  'イオンリテール関東:21100684': {
    office: '首都圏本部:10000623',
    dept: '首都圏営業第一部:10002985',
    staff: 'アサヒ　花子:5172734',
  },
  'マックスバリュ関東:21100742': {
    office: '首都圏本部:10000623',
    dept: '首都圏営業第二部:10002990',
    staff: 'アサヒ　太郎:5172733',
  },
  'マックスバリュ東北:21100731': {
    office: '東北支社:10000662',
    dept: '東北営業部:10003056',
    staff: 'アサヒ　悠人:5172739',
  },
  'イトーヨーカ堂:21100695': {
    office: '首都圏本部:10000623',
    dept: '首都圏営業第一部:10002985',
    staff: 'アサヒ　花子:5172734',
  },
  'ヨークベニマル:21100758': {
    office: '東北支社:10000662',
    dept: '東北営業部:10003056',
    staff: 'アサヒ　悠人:5172739',
  },
  'ライフコーポレーション:21100703': {
    office: '関西本部:10000645',
    dept: '近畿営業部:10003015',
    staff: 'アサヒ　美咲:5172736',
  },
  'サミット:21100718': {
    office: '首都圏本部:10000623',
    dept: '首都圏営業第二部:10002990',
    staff: 'アサヒ　太郎:5172733',
  },
  // 九州営業部は現行モックにコードが2種（当表＝10003030／支払の実在組合せ・
  // 検印済み明細＝10003028）ある。検索条件の候補は後者から作られるため、
  // 担当組織には 10003028 を採る（コードの一本化は別途整理する）。
  'ヤオコー:21100769': {
    office: '九州支社:10000679',
    dept: '九州営業部:10003028',
    staff: 'アサヒ　健太:5172737',
  },
};

// 担当組織が定まらないとき（販売店が未選択・担当組織が未登録）の値。
const OWNER_ORG_NONE: StoreOwnerOrg = {
  office: '',
  dept: '',
  terminalOrg: '',
  staff: '',
};

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
