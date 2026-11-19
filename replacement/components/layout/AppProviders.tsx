import { useEffect } from 'react';
import { Toaster } from 'sonner';

import { ConfirmDialogHost } from '@/components/ui/confirm-dialog';
import { ScreenTitleProvider } from '@/components/ui/screen-title';
import { AppNavigationProvider } from '@/components/ui/use-app-navigation';
import type { NavigateFn, RouteParams } from '@/types/navigation';

// アプリ全体を囲む共通の Provider と、画面に1つだけ置く部品をまとめる。
// - 画面の切り替え（AppNavigationProvider）・画面名（ScreenTitleProvider）
// - トースト（Toaster。設置はここ1か所だけ → 02「Toaster の設置」）
// - React の外（グリッドの共通処理）から出す確認ダイアログの表示役（ConfirmDialogHost → ui/confirm-dialog の requestConfirm）
// Next.js へ移すときは、この部品をルートの layout から使い、navigate にルーターの処理、params に URL のクエリを渡す。

interface AppProvidersProps {
  // 画面の切り替えの中身（遷移先のルート ID と引き継ぐパラメータを受け取る）
  navigate: NavigateFn;
  // 今の画面へ遷移したときに受け取ったパラメータ（画面は useRouteParams で読む）
  params: RouteParams;
  children: React.ReactNode;
}

export function AppProviders({
  navigate,
  params,
  children,
}: AppProvidersProps) {
  // AG Gridのレガシーテーマスタイルを完全に削除
  useEffect(() => {
    // 既存のag-grid関連のlinkタグを削除
    const links = document.querySelectorAll(
      'link[href*="ag-grid"], link[href*="ag-theme"]'
    );
    links.forEach((link) => link.remove());

    // 既存のag-grid関連のstyleタグを削除
    const styles = document.querySelectorAll('style[data-ag-grid]');
    styles.forEach((style) => style.remove());
  }, []);

  return (
    <AppNavigationProvider navigate={navigate} params={params}>
      <ScreenTitleProvider>
        <Toaster position="top-right" richColors />
        <ConfirmDialogHost />
        {children}
      </ScreenTitleProvider>
    </AppNavigationProvider>
  );
}
