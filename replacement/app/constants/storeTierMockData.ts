// 一次店/三次店のダミーリスト（販売計画条件・年間計画の「販売店」アコーディオン表示用）。
// 各画面でインライン定義していたものをここへ集約する。

export interface StoreTier {
  /** 一次店 */
  first: string;
  /** 三次店 */
  third: string;
}

// 実名称ベース（販売計画表 NET固定／マージン率固定の販売計画条件）
export const STORE_TIER_LIST: StoreTier[] = [
  { first: '三菱食品株式会社（イオン）', third: 'イオン東北ＲＤＣ' },
  {
    first: '加藤産業株式会社　仙台支店イオンＲＤＣ',
    third: 'イオン商品調達株式会社　ＡＧＭ東北ＲＤＣ',
  },
  {
    first: '伊藤忠食品株式会社　仙台支店',
    third: '伊藤忠食品株式会社　仙台支店',
  },
  { first: 'AA株式会社　AA1次支店', third: 'AA株式会社　AA3次支店' },
  { first: 'BB株式会社　BB1次支店', third: 'BB株式会社　BB3次支店' },
  { first: 'CC株式会社　CC1次支店', third: 'CC株式会社　CC3次支店' },
  { first: 'DD株式会社　DD1次支店', third: 'DD株式会社　DD3次支店' },
  { first: 'EE株式会社　EE1次支店', third: 'EE株式会社　EE3次支店' },
  { first: 'FF株式会社　FF1次支店', third: 'FF株式会社　FF3次支店' },
  { first: 'GG株式会社　GG1次支店', third: 'GG株式会社　GG3次支店' },
  { first: 'HH株式会社　HH1次支店', third: 'HH株式会社　HH3次支店' },
  { first: 'II株式会社　II1次支店', third: 'II株式会社　II3次支店' },
  { first: 'JJ株式会社　JJ1次支店', third: 'JJ株式会社　JJ3次支店' },
  { first: 'KK株式会社　KK1次支店', third: 'KK株式会社　KK3次支店' },
  { first: 'LL株式会社　LL1次支店', third: 'LL株式会社　LL3次支店' },
  { first: 'MM株式会社　MM1次支店', third: 'MM株式会社　MM3次支店' },
  { first: 'NN株式会社　NN1次支店', third: 'NN株式会社　NN3次支店' },
  { first: 'OO株式会社　OO1次支店', third: 'OO株式会社　OO3次支店' },
  { first: 'PP株式会社　PP1次支店', third: 'PP株式会社　PP3次支店' },
  { first: 'QQ株式会社　QQ1次支店', third: 'QQ株式会社　QQ3次支店' },
];

// 年間計画の販売店アコーディオン用（実名称・抜粋）
export const STORE_TIER_LIST_ANNUAL: StoreTier[] = [
  { first: '三菱食品株式会社（イオン）', third: 'イオン東北ＲＤＣ' },
  {
    first: '加藤産業株式会社　仙台支店イオンＲＤＣ',
    third: 'イオン商品調達株式会社　ＡＧＭ東北ＲＤＣ',
  },
  {
    first: '伊藤忠食品株式会社　仙台支店',
    third: '伊藤忠食品株式会社　仙台支店',
  },
  { first: '国分グループ本社株式会社', third: '国分東北株式会社' },
  {
    first: '株式会社日本アクセス',
    third: '株式会社日本アクセス東北支社',
  },
];

// 名称・コードで検索できるシングルコンボボックス用の選択肢。
export interface StoreSelectOption {
  value: string;
  label: string;
  code?: string;
}

// 連番コードを付与してコンボボックス選択肢へ変換するヘルパー。
function toStoreOptions(names: string[], prefix: string): StoreSelectOption[] {
  // 名称の重複を除去（一次店/三次店は同名ペアが存在しうるため）
  const unique = Array.from(new Set(names));
  return unique.map((name, index) => ({
    value: name,
    label: name,
    code: `${prefix}${String(index + 1).padStart(3, '0')}`,
  }));
}

// 販売店（正規）の選択肢。DEALER_OPTIONS_DUMMY の生成元であり、画面（支払詳細(引用)等）からも参照する。
export const DEALER_OPTIONS: StoreSelectOption[] = [
  {
    value: 'イオンリテール株式会社',
    label: 'イオンリテール株式会社',
    code: 'DLR001',
  },
  {
    value: '株式会社イトーヨーカ堂',
    label: '株式会社イトーヨーカ堂',
    code: 'DLR002',
  },
  { value: 'ユニー株式会社', label: 'ユニー株式会社', code: 'DLR003' },
  {
    value: '株式会社ライフコーポレーション',
    label: '株式会社ライフコーポレーション',
    code: 'DLR004',
  },
  {
    value: 'マックスバリュ東海株式会社',
    label: 'マックスバリュ東海株式会社',
    code: 'DLR005',
  },
];

// 販売店（ダミー）の選択肢
export const DEALER_OPTIONS_DUMMY: StoreSelectOption[] = DEALER_OPTIONS.map(
  (o, index) => ({
    value: `【ダミー】${o.value}`,
    label: `【ダミー】${o.label}`,
    code: `DLR9${String(index + 1).padStart(2, '0')}`,
  })
);

// 一次店（正規）の選択肢
export const FIRST_STORE_OPTIONS: StoreSelectOption[] = toStoreOptions(
  STORE_TIER_LIST.map((t) => t.first),
  'T1'
);

// 三次店（正規）の選択肢
export const THIRD_STORE_OPTIONS: StoreSelectOption[] = toStoreOptions(
  STORE_TIER_LIST.map((t) => t.third),
  'T3'
);

// 選択肢のコード表に、選択肢へ含まれない名称のコードを連番の続きで補って返す。
function toCodeByName(
  options: StoreSelectOption[],
  extraNames: string[],
  prefix: string
): Map<string, string> {
  const codeByName = new Map(options.map((o) => [o.value, o.code ?? '']));
  let sequence = options.length;
  extraNames.forEach((name) => {
    if (codeByName.has(name)) return;
    sequence += 1;
    codeByName.set(name, `${prefix}${String(sequence).padStart(3, '0')}`);
  });
  return codeByName;
}

// 一次店・三次店の名称→コード。基本情報の「コード:名称」表示で引く。
// 年間計画のリスト（STORE_TIER_LIST_ANNUAL）にのみ存在する店舗も引けるよう、
// 選択肢（STORE_TIER_LIST 由来）に無い名称にはコードを補完する。
const FIRST_STORE_CODE_BY_NAME = toCodeByName(
  FIRST_STORE_OPTIONS,
  STORE_TIER_LIST_ANNUAL.map((tier) => tier.first),
  'T1'
);
const THIRD_STORE_CODE_BY_NAME = toCodeByName(
  THIRD_STORE_OPTIONS,
  STORE_TIER_LIST_ANNUAL.map((tier) => tier.third),
  'T3'
);

// 一次店の名称からコードを返す（未登録の名称は空文字）。
export function firstStoreCode(name: string): string {
  return FIRST_STORE_CODE_BY_NAME.get(name) ?? '';
}

// 三次店の名称からコードを返す（未登録の名称は空文字）。
export function thirdStoreCode(name: string): string {
  return THIRD_STORE_CODE_BY_NAME.get(name) ?? '';
}

// 商流紐づけなし（ダミー表示。名称は実在風のダミー値）
export const STORE_TIER_LIST_DUMMY: StoreTier[] = [
  {
    first: '【ダミー】三菱食品株式会社（イオン）',
    third: '【ダミー】イオン東北ＲＤＣ',
  },
  {
    first: '【ダミー】加藤産業株式会社　仙台支店イオンＲＤＣ',
    third: '【ダミー】イオン商品調達株式会社　ＡＧＭ東北ＲＤＣ',
  },
  {
    first: '【ダミー】伊藤忠食品株式会社　仙台支店',
    third: '【ダミー】伊藤忠食品株式会社　仙台支店',
  },
  {
    first: '【ダミー】国分グループ本社株式会社',
    third: '【ダミー】国分東北株式会社',
  },
  {
    first: '【ダミー】株式会社日本アクセス',
    third: '【ダミー】株式会社日本アクセス東北支社',
  },
  {
    first: '【ダミー】三井食品株式会社',
    third: '【ダミー】三井食品株式会社　東北支店',
  },
  {
    first: '【ダミー】株式会社ヤマエ久野',
    third: '【ダミー】ヤマエ久野　仙台支店',
  },
  {
    first: '【ダミー】尾家産業株式会社',
    third: '【ダミー】尾家産業　東北支店',
  },
];

// 一次店（ダミー）の選択肢
export const FIRST_STORE_OPTIONS_DUMMY: StoreSelectOption[] = toStoreOptions(
  STORE_TIER_LIST_DUMMY.map((t) => t.first),
  'T1D'
);

// 三次店（ダミー）の選択肢
export const THIRD_STORE_OPTIONS_DUMMY: StoreSelectOption[] = toStoreOptions(
  STORE_TIER_LIST_DUMMY.map((t) => t.third),
  'T3D'
);

// ── 商流／販売店に紐づかない枠を表す固定ダミー ────────────────────────
// 拡売費計画(商流販売店に紐づき無し)のパターン②③④で、紐づかない側の項目に
// 自動選択して非活性にする。②の一次店・三次店は、候補の先頭に置いて手動で選べるようにする。
// コードは ASD で作成予定の固定値。
// 実マスタ作成後はここを差し替える。
export const DEALER_OPTION_UNLINKED: StoreSelectOption = {
  value: '【ダミー】販売店',
  label: '【ダミー】販売店',
  code: '999999XX',
};

export const FIRST_STORE_OPTION_UNLINKED: StoreSelectOption = {
  value: '【ダミー】一次店',
  label: '【ダミー】一次店',
  code: '999999YY',
};

export const THIRD_STORE_OPTION_UNLINKED: StoreSelectOption = {
  value: '【ダミー】三次店',
  label: '【ダミー】三次店',
  code: '999999ZZ',
};
