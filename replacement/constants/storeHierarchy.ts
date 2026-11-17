// 店舗階層（一次店・三次店・販売店）のマスタと選択肢ヘルパー。
// 振替詳細の基本情報（TransferInfo）と、検印済み明細（振替元）の検索条件
// （ReferenceTable）が同じ項目・同じ連動を持つため、定義元をここに一元化する。

// 販売店未選択を表す値（「販売店」の初期値）。
export const STORE_NONE = '-';

// 店舗階層のマスタ（モック。値は「コード:名称」→ 02 §9-1・UX-114）。
//   一次店 : 三次店 = 1 : N
//   三次店 : 販売店 = 1 : N
// 3項目の連動（絞り込み・自動選択）は本マスタを唯一の定義元とする。
export const STORE_HIERARCHY: {
  primary: string;
  tertiaries: { tertiary: string; stores: string[] }[];
}[] = [
  {
    primary: '10888030:三菱食品株式会社（イオン）',
    tertiaries: [
      {
        tertiary: '10863223:イオン東北ＲＤＣ',
        stores: ['21100677:イオンリテール', '21100731:マックスバリュ東北'],
      },
      {
        tertiary: '10863241:イオン関東ＲＤＣ',
        stores: ['21100684:イオンリテール関東', '21100742:マックスバリュ関東'],
      },
    ],
  },
  {
    primary: '10888045:伊藤忠食品株式会社',
    tertiaries: [
      {
        tertiary: '10863258:伊藤忠食品　東日本ＤＣ',
        stores: ['21100695:イトーヨーカ堂', '21100758:ヨークベニマル'],
      },
      {
        tertiary: '10863264:伊藤忠食品　西日本ＤＣ',
        stores: ['21100703:ライフコーポレーション'],
      },
    ],
  },
  {
    primary: '10888062:加藤産業株式会社',
    tertiaries: [
      {
        tertiary: '10863277:加藤産業　首都圏ＤＣ',
        stores: ['21100718:サミット', '21100769:ヤオコー'],
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
