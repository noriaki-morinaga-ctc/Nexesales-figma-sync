import {
  DEALER_OPTIONS,
  DEALER_OPTION_UNLINKED,
  FIRST_STORE_OPTION_UNLINKED,
  THIRD_STORE_OPTION_UNLINKED,
  FIRST_STORE_OPTIONS,
  THIRD_STORE_OPTIONS,
  type StoreSelectOption,
} from './storeTierMockData';

// 拡売費計画(商流販売店に紐づき無し)のパターンと、パターン別の項目制御。
// 資料 work/画像.png の②③④に対応する（①は商流販売店に紐づく別画面のため本画面には無い）。

export type NoLinkPattern = 'shoryu' | 'dealer' | 'none';

// ラジオの選択肢。画面表示ラベルには番号を出さない（資料との対応はコメントで追える）。
export const NO_LINK_PATTERN_OPTIONS: {
  value: NoLinkPattern;
  label: string;
}[] = [
  { value: 'shoryu', label: '商流のみに紐づく' },
  { value: 'dealer', label: '販売店のみに紐づく' },
  { value: 'none', label: '商流販売店に紐づかない' },
];

export const DEFAULT_NO_LINK_PATTERN: NoLinkPattern = 'shoryu';

// 営業企画／営業でパターン内の部署の扱いが変わる。
// 本プロジェクトはモックのため、ロールは画面上の切替で確認できるようにする。
export type SalesRole = 'planning' | 'sales';

export const SALES_ROLE_OPTIONS: { value: SalesRole; label: string }[] = [
  { value: 'planning', label: '営業企画' },
  { value: 'sales', label: '営業' },
];

export const DEFAULT_SALES_ROLE: SalesRole = 'planning';

// 営業ロールの「自部署」。実データ連携までのモック値。
export const OWN_DEPARTMENT = '首都圏営業第二部';

// パターン別の項目制御。true = 活性。
export interface NoLinkFieldControl {
  dealerOptions: StoreSelectOption[];
  dealerValue: string | null; // null = ユーザー選択を維持する
  dealerEnabled: boolean;
  firstStoreOptions: StoreSelectOption[];
  firstStoreValue: string | null; // null = ユーザー選択を維持する
  firstStoreEnabled: boolean;
  thirdStoreOptions: StoreSelectOption[];
  thirdStoreValue: string | null;
  thirdStoreEnabled: boolean;
}

// パターンに応じた販売店／一次店／三次店の選択肢・値・活性を返す。
// 事業場は全パターン非活性、末端組織は全パターン活性のため、ここでは扱わない。
export function fieldControlOf(pattern: NoLinkPattern): NoLinkFieldControl {
  // ②商流のみ: 販売店はダミー固定、一次店・三次店は通常コードかダミーを選択できる。
  // 一次店・三次店のどちらか一方だけが商流に紐づくケースもあるため、
  // それぞれの候補の先頭にダミーを置き、手動で選べるようにする。
  // 両方ダミーの組み合わせのチェックは基本設計で検討する。
  if (pattern === 'shoryu') {
    return {
      dealerOptions: [DEALER_OPTION_UNLINKED],
      dealerValue: DEALER_OPTION_UNLINKED.value,
      dealerEnabled: false,
      firstStoreOptions: [FIRST_STORE_OPTION_UNLINKED, ...FIRST_STORE_OPTIONS],
      firstStoreValue: null,
      firstStoreEnabled: true,
      thirdStoreOptions: [THIRD_STORE_OPTION_UNLINKED, ...THIRD_STORE_OPTIONS],
      thirdStoreValue: null,
      thirdStoreEnabled: true,
    };
  }
  // ③販売店のみ: 販売店は通常コードで選択できる、一次店・三次店はダミー固定。
  if (pattern === 'dealer') {
    return {
      dealerOptions: DEALER_OPTIONS,
      dealerValue: null,
      dealerEnabled: true,
      firstStoreOptions: [FIRST_STORE_OPTION_UNLINKED],
      firstStoreValue: FIRST_STORE_OPTION_UNLINKED.value,
      firstStoreEnabled: false,
      thirdStoreOptions: [THIRD_STORE_OPTION_UNLINKED],
      thirdStoreValue: THIRD_STORE_OPTION_UNLINKED.value,
      thirdStoreEnabled: false,
    };
  }
  // ④紐づかない: 販売店・一次店・三次店すべてダミー固定。
  return {
    dealerOptions: [DEALER_OPTION_UNLINKED],
    dealerValue: DEALER_OPTION_UNLINKED.value,
    dealerEnabled: false,
    firstStoreOptions: [FIRST_STORE_OPTION_UNLINKED],
    firstStoreValue: FIRST_STORE_OPTION_UNLINKED.value,
    firstStoreEnabled: false,
    thirdStoreOptions: [THIRD_STORE_OPTION_UNLINKED],
    thirdStoreValue: THIRD_STORE_OPTION_UNLINKED.value,
    thirdStoreEnabled: false,
  };
}
