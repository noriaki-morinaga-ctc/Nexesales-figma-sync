// 画面共通スタイル（画面設計標準準拠）。
// ボタン配色だけでなく、フォームのラベル色・値色、タイトル等の
// タイポグラフィといった「画面横断で統一したい className」をここに集約する。
// gridStyles（グリッドセル配色）と対になる、UI 全般の共通スタイル定義。

// 操作分類ごとのボタン配色（通常時＋ホバー時／画面設計標準 スライド18 準拠）。
// 各値は「色・枠線・ホバー」のみを表現する className 断片で、native button / shadcn Button の
// いずれにも合成できる（角丸・余白・フォーカスリングは利用側または共通定数で付与）。
export const BUTTON_STYLES = {
  // メイン操作（登録・検索・保存・アップロード等／DB更新を伴う確定系）＝塗り青
  primary: 'bg-blue-500 hover:bg-blue-600 text-white',
  // 承認ワークフロー操作（確認依頼・承認申請）＝塗り緑
  approve: 'bg-green-500 hover:bg-green-600 text-white',
  // データ削除操作＝塗り赤
  delete: 'bg-red-600 hover:bg-red-700 text-white',
  // 承認ワークフローの差戻し（承認者が申請を申請者へ戻す）＝塗り赤。
  // 削除とは別の操作分類（画面設計標準 3.8 No.3）。アイコンはゴミ箱ではなく CornerUpLeft
  sendBack: 'bg-red-600 hover:bg-red-700 text-white',
  // 承認ワークフローの引戻し（申請者が自分の申請を取り下げる）＝白地・青枠（3.8 No.4）。アイコンは CornerUpLeft
  withdraw: 'bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50',
  // 標準アウトライン（子画面表示・コピー・行追加等のサブ操作）＝白地・青枠
  outline: 'bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50',
  // 取消し系（キャンセル・いいえ・クリア・閉じる・戻る）＝白地・グレー枠
  cancel: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
  // 非活性
  disabled:
    'bg-gray-300 text-gray-500 border border-gray-400 cursor-not-allowed',
} as const;

// 全ボタン共通の付帯クラス（角丸・トランジション・フォーカスリング）。
export const BUTTON_BASE =
  'rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500';

// フォーム項目ラベル（紺・太字／text-blue-900＝#1E3A8A）。
// リンク（text-blue-600）と同じ明るい青だとリンクと誤解されるため、リンクより濃い紺にする（UI/UX UX-009・UX-010）。
export const FORM_LABEL_CLASS = 'text-sm font-bold text-blue-900';

// 一覧画面の検索条件の並び（全画面で同じ5列にし、画面が違っても同じ画面幅なら項目の幅・縦の線をそろえる）。
// 各項目は「ラベル＋入力欄（flex-1 min-w-0）」の flex 行にし、範囲指定は2列分を使う（→ 05）。
export const SEARCH_GRID_CLASS = 'grid grid-cols-5 gap-x-5 gap-y-2.5';
// 検索条件のラベル（幅 5.625rem・右寄せ。shrink-0 で画面幅が狭くても入力欄の左の線をずらさない）。
// 右寄せは text-right ではなく flex の justify-end にする（幅を超える長いラベルは入力欄側でなく左へはみ出させる → 05）。
export const SEARCH_LABEL_CLASS = `${FORM_LABEL_CLASS} flex shrink-0 justify-end whitespace-nowrap w-[5.625rem]`;

// 文字・数値の入力欄（shadcn の Input）。コンボボックス・年月日の入力と同じ見た目にする
// （高さ 2.375rem・濃いグレーの枠・薄い影・text-sm・フォーカスで青枠。UI/UX UX-023）。
// 幅・読み取り専用の背景・エラーの枠などは、この後ろに足す（後ろの指定が優先される）。
export const TEXT_INPUT_CLASS =
  'h-9.5 border-gray-400 bg-white text-sm shadow-sm focus:ring-2 focus:ring-blue-500';

// 値テキスト（入力値・表示値）。
export const FORM_VALUE_CLASS = 'text-sm text-gray-900';

// 文字サイズ・色の共通タイポグラフィ（支払申請一覧参照画面に準拠）。
// ペインの見出し（右ペイン等）：1.125rem(18px) 太字 黒。
// 画面名はヘッダー（システム名の右）に出すため本文には置かない（→ ui/screen-title.tsx の ScreenTitle）。
export const SCREEN_TITLE_CLASS = 'text-lg font-bold text-gray-900';
// カード／セクションタイトル：1rem(16px) 太字 黒
export const CARD_TITLE_CLASS = 'text-base font-bold text-gray-900';

export type ButtonStyleKey = keyof typeof BUTTON_STYLES;
