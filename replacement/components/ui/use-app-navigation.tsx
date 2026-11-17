import { createContext, useContext } from 'react';

import type { NavigateFn } from '@/types/navigation';

// 画面の切り替えを1か所にまとめる共通フック。
// 画面・ヘッダーは props で切り替えの関数を受け取らず、useAppNavigation() で受け取る。
// 切り替えの中身（どの画面を表示するか）は App.tsx が AppNavigationProvider に渡す。
// ルーター（Next.js の useRouter など）へ移すときは、この Provider に渡す関数だけを替える。

// Provider の外（部品見本など）では何もしない
const AppNavigationContext = createContext<NavigateFn>(() => {});

interface AppNavigationProviderProps {
  navigate: NavigateFn;
  children: React.ReactNode;
}

// App 全体（ヘッダーと画面本文の両方）を囲む。
export function AppNavigationProvider({
  navigate,
  children,
}: AppNavigationProviderProps) {
  return (
    <AppNavigationContext.Provider value={navigate}>
      {children}
    </AppNavigationContext.Provider>
  );
}

// 画面を切り替える関数を返す（例：navigate('plan-list')）
export function useAppNavigation(): NavigateFn {
  return useContext(AppNavigationContext);
}
