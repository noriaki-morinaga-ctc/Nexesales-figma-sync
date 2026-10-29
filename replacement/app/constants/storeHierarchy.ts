// 店舗階層（一次店・三次店・販売店）のマスタと選択肢ヘルパー。
// 振替詳細の基本情報（TransferInfo）と、検印済み明細（振替元）の検索条件
// （ReferenceTable）が同じ項目・同じ連動を持つため、定義元をここに一元化する。

// 販売店未選択を表す値（「販売店」の初期値）。
export const STORE_NONE = '-';

// 店舗階層のマスタ（モック。「名称:コード」形式で BASIC_INFO と揃える）。
//   一次店 : 三次店 = 1 : N
//   三次店 : 販売店 = 1 : N
// 3項目の連動（絞り込み・自動選択）は本マスタを唯一の定義元とする。
export const STORE_HIERARCHY: {
  primary: string;
  tertiaries: { tertiary: string; stores: string[] }[];
}[] = [
  {
    primary: '三菱食品株式会社（イオン）:10888030',
    tertiaries: [
      {
        tertiary: 'イオン東北ＲＤＣ:10863223',
        stores: ['イオンリテール:21100677', 'マックスバリュ東北:21100731'],
      },
      {
        tertiary: 'イオン関東ＲＤＣ:10863241',
        stores: ['イオンリテール関東:21100684', 'マックスバリュ関東:21100742'],
      },
    ],
  },
  {
    primary: '伊藤忠食品株式会社:10888045',
    tertiaries: [
      {
        tertiary: '伊藤忠食品　東日本ＤＣ:10863258',
        stores: ['イトーヨーカ堂:21100695', 'ヨークベニマル:21100758'],
      },
      {
        tertiary: '伊藤忠食品　西日本ＤＣ:10863264',
        stores: ['ライフコーポレーション:21100703'],
      },
    ],
  },
  {
    primary: '加藤産業株式会社:10888062',
    tertiaries: [
      {
        tertiary: '加藤産業　首都圏ＤＣ:10863277',
        stores: ['サミット:21100718', 'ヤオコー:21100769'],
      },
    ],
  },
];

// 選択肢オブジェクトへの変換。
const toOptions = (values: string[]) =>
  values.map((v) => ({ value: v, label: v }));

// 一次店の選択肢（全件）。
export const PRIMARY_STORE_OPTIONS = toOptions(
  STORE_HIERARCHY.map((p) => p.primary)
);

// 三次店 → 所属する一次店 の逆引き。
export const PRIMARY_BY_TERTIARY: Record<string, string> = {};
// 販売店 → 所属する三次店 の逆引き。
export const TERTIARY_BY_STORE: Record<string, string> = {};
for (const p of STORE_HIERARCHY) {
  for (const t of p.tertiaries) {
    PRIMARY_BY_TERTIARY[t.tertiary] = p.primary;
    for (const s of t.stores) TERTIARY_BY_STORE[s] = t.tertiary;
  }
}

// 三次店の選択肢。一次店が選択済みならその配下のみに絞り込む。
export const tertiaryOptionsFor = (primary: string) =>
  toOptions(
    STORE_HIERARCHY.filter((p) => !primary || p.primary === primary).flatMap(
      (p) => p.tertiaries.map((t) => t.tertiary)
    )
  );

// 販売店の選択肢。三次店が選択済みならその配下、未選択でも一次店が選択済みなら
// その配下の全販売店に絞り込む。先頭には未選択を表す「-」を置く。
export const storeOptionsFor = (primary: string, tertiary: string) =>
  toOptions([
    STORE_NONE,
    ...STORE_HIERARCHY.filter((p) => !primary || p.primary === primary).flatMap(
      (p) =>
        p.tertiaries
          .filter((t) => !tertiary || t.tertiary === tertiary)
          .flatMap((t) => t.stores)
    ),
  ]);

// 商流３項目（一次店・三次店・販売店）の現在値。
export interface StoreSelection {
  primaryStore: string;
  tertiaryStore: string;
  store: string;
}

// 商流３項目の連動を適用した結果を返す（振替詳細の基本情報と同じ挙動）。
//   一次店を選択：配下でなくなった三次店・販売店をクリアする（クリア時は下位もまとめて未選択）。
//   三次店を選択：所属する一次店を自動選択し、配下でなくなった販売店をクリアする。
//   販売店を選択：所属する三次店・一次店を自動選択する（「-」は未選択のため上位は維持）。
// 明細行（費用分割の分割先明細・費用振替の振替先明細）でも同じ連動を使うため、
// 状態を持たない純関数としてここに定義する。
export function applyStoreCascade(
  current: StoreSelection,
  field: keyof StoreSelection,
  value: string
): StoreSelection {
  const { tertiaryStore, store } = current;

  if (field === 'primaryStore') {
    if (!value) {
      return { primaryStore: '', tertiaryStore: '', store: STORE_NONE };
    }
    const tertiaryStillValid = tertiaryStore
      ? PRIMARY_BY_TERTIARY[tertiaryStore] === value
      : true;
    const storeStillValid =
      store && store !== STORE_NONE
        ? PRIMARY_BY_TERTIARY[TERTIARY_BY_STORE[store] ?? ''] === value &&
          (tertiaryStillValid || !tertiaryStore)
        : true;
    return {
      primaryStore: value,
      tertiaryStore: tertiaryStillValid ? tertiaryStore : '',
      store: storeStillValid ? store : STORE_NONE,
    };
  }

  if (field === 'tertiaryStore') {
    const storeStillValid =
      store && store !== STORE_NONE
        ? !!value && TERTIARY_BY_STORE[store] === value
        : true;
    return {
      primaryStore: value
        ? (PRIMARY_BY_TERTIARY[value] ?? '')
        : current.primaryStore,
      tertiaryStore: value,
      store: storeStillValid ? store : STORE_NONE,
    };
  }

  // 販売店
  if (!value || value === STORE_NONE) {
    return { ...current, store: STORE_NONE };
  }
  const tertiary = TERTIARY_BY_STORE[value] ?? '';
  return {
    primaryStore: PRIMARY_BY_TERTIARY[tertiary] ?? '',
    tertiaryStore: tertiary,
    store: value,
  };
}
