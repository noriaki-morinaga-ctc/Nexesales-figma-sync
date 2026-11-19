// ブラウザの保存領域（localStorage）の読み書き（→ 04 §画面ディレクトリ構成「Next.js へ移せる書き方」）。
// localStorage を直接呼ばず、ここを通す。
// - サーバー側（Next.js の描画）では window が無いため、読むと null・書いても何もしない
// - 保存できない環境（プライベートモード・容量超過）や壊れた保存値でも例外を投げない

const storage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // 保存領域を使えない設定のブラウザ
    return null;
  }
};

/** 文字のまま読む（未保存・読めないときは null） */
export function readStoredText(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** JSON として読む（未保存・壊れた値・読めないときは null） */
export function readStoredJson<T = unknown>(key: string): T | null {
  const raw = readStoredText(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 文字のまま保存する（保存できたら true） */
export function writeStoredText(key: string, value: string): boolean {
  try {
    const s = storage();
    if (!s) return false;
    s.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** JSON にして保存する（保存できたら true） */
export function writeStoredJson(key: string, value: unknown): boolean {
  return writeStoredText(key, JSON.stringify(value));
}

/** 保存した値を消す */
export function removeStored(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // 保存領域を扱えない環境では何もしない
  }
}
