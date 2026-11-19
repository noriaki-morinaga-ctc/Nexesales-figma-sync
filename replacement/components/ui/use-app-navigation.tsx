import { createContext, useContext } from 'react';

import type { NavigateFn, RouteParams } from '@/types/navigation';

// 画面の切り替えを1か所にまとめる共通フック。
// 画面・ヘッダーは props で切り替えの関数を受け取らず、useAppNavigation() で受け取る。
// 遷移先へ引き継ぐ値は navigate の第2引数（文字列のパラメータ）で渡し、遷移先は useRouteParams() で読む。
// 切り替えの中身（どの画面を表示するか）と今のパラメータは App.tsx が AppNavigationProvider に渡す。
// ルーター（Next.js）へ移すときは、navigate を useRouter().push に、パラメータを URL のクエリ（useSearchParams）に替える。

// Provider の外（部品見本など）では何もしない
const AppNavigationContext = createContext<NavigateFn>(() => {});
const RouteParamsContext = createContext<RouteParams>({});

interface AppNavigationProviderProps {
  navigate: NavigateFn;
  // 今の画面へ遷移したときに受け取ったパラメータ（メニューから開いたときは空）
  params: RouteParams;
  children: React.ReactNode;
}

// App 全体（ヘッダーと画面本文の両方）を囲む。
export function AppNavigationProvider({
  navigate,
  params,
  children,
}: AppNavigationProviderProps) {
  return (
    <AppNavigationContext.Provider value={navigate}>
      <RouteParamsContext.Provider value={params}>
        {children}
      </RouteParamsContext.Provider>
    </AppNavigationContext.Provider>
  );
}

// 画面を切り替える関数を返す（例：navigate('plan-list')、navigate('billing-edi-detail', { id: 'R1' })）
export function useAppNavigation(): NavigateFn {
  return useContext(AppNavigationContext);
}

// 今の画面へ遷移したときに受け取ったパラメータを返す（メニューから開いたときは空のオブジェクト）
export function useRouteParams(): RouteParams {
  return useContext(RouteParamsContext);
}
