import { useEffect, useRef } from 'react';

/**
 * 下ペイン（BottomPane）・右ペイン（RightPane）を画面で1つだけ表示するための排他制御。
 *
 * 開閉状態は画面ごとに持つが、親画面と子コンポーネント（明細テーブル等）に分散している
 * 画面もあり、画面側で closeAll～ を呼び合う方式では漏れが出る。そのため共通部品側で
 * 「最後に展開したペインだけを残す」よう一元管理する。
 *
 * 折り畳み中のペイン（下ペインのドックタブ・右ペインの付箋）は再表示の入口であり
 * 「表示中のペイン」とは扱わないため、排他の対象外。
 *
 * 先に開いていたペインに未保存の入力があるときは、閉じる前に破棄の確認を出す
 * （画面設計標準 3.4「別のペイン（右ペイン・下ペイン）を開いたとき」）。
 * キャンセルされたら先のペインを残し、新しく開いたペインのほうを閉じる。
 */

interface ActivePane {
  id: symbol;
  close: () => void;
  // 閉じてよいか（未保存の入力があれば確認を出す）。未指定なら確認なしで閉じる
  confirmClose?: () => Promise<boolean>;
}

// 現在展開中のペイン。常に1つだけ保持し、別のペインが展開されたら閉じる。
let activePane: ActivePane | null = null;

/**
 * 表示中のペインに未保存の入力があれば破棄の確認を出す（画面設計標準 3.4
 * 「他行選択によるペインの入れ替え」）。行の選択でペインの中身を入れ替える画面は、
 * 入れ替える前に呼び、false ならその操作をやめる。ペインが無い・入力が無いときは true。
 */
export function confirmDiscardActivePane(): Promise<boolean> {
  return activePane?.confirmClose ? activePane.confirmClose() : Promise.resolve(true);
}

/**
 * ペインの展開を排他制御する。
 *
 * @param expanded 展開表示中なら true（折り畳み中は false）
 * @param close 他のペインが開いたときに自身を閉じる処理
 * @param confirmClose 閉じてよいかの確認（未保存の入力があるときに破棄の確認を出す）
 */
export function useExclusivePane(
  expanded: boolean,
  close: () => void,
  confirmClose?: () => Promise<boolean>
) {
  // 効果から常に最新の close／confirmClose を呼べるようにする（依存に入れて再登録しない）
  const closeRef = useRef(close);
  closeRef.current = close;
  const confirmRef = useRef(confirmClose);
  confirmRef.current = confirmClose;

  // ペインインスタンスの識別子（マウント中は不変）
  const idRef = useRef<symbol | null>(null);
  if (idRef.current === null) idRef.current = Symbol('pane');

  useEffect(() => {
    const id = idRef.current as symbol;
    if (!expanded) {
      if (activePane?.id === id) activePane = null;
      return;
    }
    const self: ActivePane = {
      id,
      close: () => closeRef.current(),
      confirmClose: () => (confirmRef.current ? confirmRef.current() : Promise.resolve(true)),
    };
    const previous = activePane && activePane.id !== id ? activePane : null;
    activePane = self;
    if (previous) {
      // 先に開いていた別のペインを閉じる。未保存の入力があれば確認し、
      // キャンセルなら先のペインを残して自身を閉じる
      void (previous.confirmClose ? previous.confirmClose() : Promise.resolve(true)).then(
        (ok) => {
          if (ok) {
            previous.close();
          } else {
            if (activePane?.id === id) activePane = previous;
            self.close();
          }
        }
      );
    }
    return () => {
      if (activePane?.id === id) activePane = null;
    };
  }, [expanded]);
}
