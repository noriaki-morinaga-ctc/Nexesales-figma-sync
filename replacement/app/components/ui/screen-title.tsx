import { createContext, useContext, useEffect, useState } from 'react';

// 画面名をヘッダー（システム名「NEXT SALES」の右）に出すための共通部品。
// 各画面は本文に見出しを置かず <ScreenTitle title="〇〇" /> を置くだけにする。
// 画面名の表示はヘッダー（shared/layout/Header.tsx）が受け持つ。

interface ScreenTitleContextValue {
  title: string;
  setTitle: (title: string) => void;
}

const ScreenTitleContext = createContext<ScreenTitleContextValue>({
  title: '',
  setTitle: () => {},
});

interface ScreenTitleProviderProps {
  children: React.ReactNode;
}

// App 全体（ヘッダーと画面本文の両方）を囲む。
export function ScreenTitleProvider({ children }: ScreenTitleProviderProps) {
  const [title, setTitle] = useState('');
  return (
    <ScreenTitleContext.Provider value={{ title, setTitle }}>
      {children}
    </ScreenTitleContext.Provider>
  );
}

// ヘッダーが表示中の画面名を読む。
export function useScreenTitle() {
  return useContext(ScreenTitleContext).title;
}

interface ScreenTitleProps {
  // ヘッダーに出す画面名（モードで変わる場合は呼び出し側で切り替えて渡す）
  title: string;
}

// 表示中の画面名（React の外から読む用。グリッドのエクスポートのファイル名に使う）
let currentScreenTitle = '';

// React の外（グリッドの共通処理など）から表示中の画面名を読む。
export function getCurrentScreenTitle(): string {
  return currentScreenTitle;
}

// 画面名をヘッダーへ登録する（本文には何も描画しない）。
// 画面を離れる（アンマウント）と画面名を消す。
export function ScreenTitle({ title }: ScreenTitleProps) {
  const { setTitle } = useContext(ScreenTitleContext);
  useEffect(() => {
    setTitle(title);
    currentScreenTitle = title;
    return () => {
      setTitle('');
      if (currentScreenTitle === title) currentScreenTitle = '';
    };
  }, [title, setTitle]);
  return null;
}
