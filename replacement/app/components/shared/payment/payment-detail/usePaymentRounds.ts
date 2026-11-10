// 支払回数（支払回）の切替・追加を扱う共通フック。支払詳細の各画面で共用する。
//
// 挙動は支払詳細(商流販売店紐づけなし)にそろえる（→ 20260804_第26回 決定事項23・24）。
//   ・追加する回数は「選択中の回数＋1」ではなく「現在の最大回数＋1」
//   ・プルダウンでの切替・「＋支払回数追加」のいずれも確認ダイアログを挟む
//   ・「はい」で入力中の内容は破棄する（保存は支払回数1回ごとのため）。
//     破棄は呼び出し側が支払情報・明細グリッドへ key={round} を付けて再マウントすることで行う
//
// 回ごとの初期データ（引用した明細・空の明細など）は画面ごとに持ち方が異なるため
// 本フックでは保持しない。回が増えたことは onRoundAdded で呼び出し側へ通知する。
import { useState } from 'react';
import type { PendingPaymentRound } from '../../../../types/paymentDetail';

interface UsePaymentRoundsOptions {
  // 支払回数の選択肢の初期値（既存の回）。
  initialOptions: string[];
  // 最初に表示する支払回数。省略時は選択肢の先頭。
  initialRound?: string;
  // 回を追加したときに呼ぶ。呼び出し側で当該回の初期データを用意する。
  onRoundAdded?: (round: string) => void;
}

export interface UsePaymentRoundsResult {
  // 表示中の支払回数。
  round: string;
  // 支払回数プルダウンの選択肢。
  options: string[];
  // 確認ダイアログの対象（null なら閉じている）。
  pending: PendingPaymentRound | null;
  // 表示中の回が追加で作られたものか（真っさらな入力画面にする判定に使う）。
  isNewRound: boolean;
  // プルダウンの変更：破棄の確認を挟んでから切り替える。
  selectRound: (next: string) => void;
  // 「＋支払回数追加」押下：確認ダイアログを開く。
  requestAddRound: () => void;
  // 確認ダイアログの「はい」。
  confirmPending: () => void;
  // 確認ダイアログを閉じる（×・領域外）。
  cancelPending: () => void;
  // 確認を挟まずに回を追加して表示する（引用の「支払明細として引用」用）。
  // 追加した回数を返すため、呼び出し側で当該回の初期データを登録できる。
  addRoundNow: () => string;
}

// 選択肢の中の最大回数＋1。回数は数値の文字列で持つ。
const nextRoundOf = (options: string[]): string =>
  String(options.reduce((max, n) => Math.max(max, Number(n) || 0), 0) + 1);

export function usePaymentRounds({
  initialOptions,
  initialRound,
  onRoundAdded,
}: UsePaymentRoundsOptions): UsePaymentRoundsResult {
  const [round, setRound] = useState(initialRound ?? initialOptions[0] ?? '1');
  const [options, setOptions] = useState<string[]>(initialOptions);
  // 追加で作られた回（＋支払回数追加・引用）。真っさらな入力画面を表示する対象。
  const [addedRounds, setAddedRounds] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingPaymentRound | null>(null);

  // 回を選択肢へ足して表示対象にする（確認の有無によらず共通の処理）。
  const appendRound = (next: string) => {
    setOptions((prev) => [...prev, next]);
    setAddedRounds((prev) => [...prev, next]);
    onRoundAdded?.(next);
  };

  return {
    round,
    options,
    pending,
    isNewRound: addedRounds.includes(round),

    selectRound: (next) => {
      if (next === round) return;
      setPending({ count: next, isNew: false });
    },

    requestAddRound: () =>
      setPending({ count: nextRoundOf(options), isNew: true }),

    confirmPending: () => {
      if (!pending) return;
      if (pending.isNew) appendRound(pending.count);
      setRound(pending.count);
      setPending(null);
    },

    cancelPending: () => setPending(null),

    addRoundNow: () => {
      const next = nextRoundOf(options);
      appendRound(next);
      setRound(next);
      return next;
    },
  };
}
