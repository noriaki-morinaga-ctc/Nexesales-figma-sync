// storeHierarchy（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import type { StoreSelection } from '@/types/organization';
import {
  PRIMARY_BY_TERTIARY,
  STORE_NONE,
  TERTIARY_BY_STORE,
} from '@/constants/storeHierarchy';

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
