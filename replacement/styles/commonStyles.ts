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
// 各項目は「ラベル＋入力欄（flex-1 min-w-0）」の flex 行にし、範囲指定も開始～終了をセットで1項目分に置く（→ 05）。
export const SEARCH_GRID_CLASS = 'grid grid-cols-5 gap-x-5 gap-y-2.5';
// 検索条件のラベルの幅（5.625rem）。
export const SEARCH_LABEL_WIDTH_CLASS = 'w-[5.625rem]';
// 年月・年月日の部品の compact（検索条件の範囲指定で1項目分に2つ並べるとき → ui/search-range-field.tsx）の×。
// ×の場所を取らず、部品（group/picker）にマウスを乗せたとき・×にフォーカスがあるとき（Tab で×へ移ったとき）だけ
// 値の右端に白地で重ねる。入力欄のフォーカスでは出さない（画面を開いたときの初期フォーカスで値が隠れるため。UI/UX UX-058）。
export const PICKER_COMPACT_CLEAR_CLASS =
  'bg-white opacity-0 group-hover/picker:opacity-100 focus:opacity-100';
// 検索条件のラベル（幅 5.625rem・右寄せ。shrink-0 で画面幅が狭くても入力欄の左の線をずらさない）。
// 右寄せは text-right ではなく flex の justify-end にする（幅を超える長いラベルは入力欄側でなく左へはみ出させる → 05）。
export const SEARCH_LABEL_CLASS = `${FORM_LABEL_CLASS} flex shrink-0 justify-end whitespace-nowrap ${SEARCH_LABEL_WIDTH_CLASS}`;

// ── 項目名が 5.625rem に収まらない画面のフォーム項目（→ 05「ラベルが幅に収まらない画面」）
// 5列を「項目名の列（その列で一番長い項目名の幅）＋値の列（残りを等分）」の10トラックにする。
// 行・項目は CSS の subgrid で親の列を受け継ぐため、行を区切り線で分けても列の縦の線がそろう。
// 項目名と値の間は gap-x-2（0.5rem）、値と次の項目名の間は gap-x-2＋項目名の pl-3 で 1.25rem（SEARCH_GRID_CLASS と同じ）。
export const FIT_GRID_CLASS =
  'grid grid-cols-[repeat(5,max-content_minmax(0,1fr))] gap-x-2';
// 区切り線で分ける1行（親の10トラックを受け継ぐ）。区切り線は呼び出し側で足す
export const FIT_ROW_CLASS = 'col-span-full grid grid-cols-subgrid gap-y-2.5';
// 1項目（項目名＋値の2トラック）。子は「項目名」「値」の2つにする
export const FIT_CELL_CLASS = 'col-span-2 grid grid-cols-subgrid items-center';
// 2列分の項目（4トラック）。値には FIT_WIDE_VALUE_CLASS を付けて残りの3トラックに広げる
export const FIT_WIDE_CELL_CLASS =
  'col-span-4 grid grid-cols-subgrid items-center';
export const FIT_WIDE_VALUE_CLASS = 'col-span-3 min-w-0';
// 項目名（固定幅を付けず、列の幅＝その列で一番長い項目名。右寄せ・折り返さない）
export const FIT_LABEL_CLASS = `${FORM_LABEL_CLASS} flex justify-end whitespace-nowrap pl-3`;

// 文字・数値の入力欄（shadcn の Input）。コンボボックス・年月日の入力と同じ見た目にする
// （高さ 2.375rem・濃いグレーの枠・薄い影・text-sm・フォーカスで青枠。UI/UX UX-023）。
// プレースホルダーは文字のコントラスト 4.5:1 を満たす text-gray-500（→ 01・06）。
// 幅・読み取り専用の背景・エラーの枠などは、この後ろに足す（後ろの指定が優先される）。
export const TEXT_INPUT_CLASS =
  'h-9.5 border-gray-400 bg-white text-sm shadow-sm placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500';

// 期限超過のラベル（ui/badge の Badge に variant="outline" と一緒に付ける。赤の塗りつぶし・白の太字）。
// 期限を過ぎたセルは背景を薄い赤（grid.css の cell-overdue）にし、文言の右にこのラベルを出す（UI/UX UX-028 → 02 §7）。
export const OVERDUE_BADGE_CLASS =
  'border-transparent bg-red-600 font-bold text-white';

// 値テキスト（入力値・表示値）。
export const FORM_VALUE_CLASS = 'text-sm text-gray-900';

// 文字サイズ・色の共通タイポグラフィ（支払申請一覧参照画面に準拠）。
// ペインの見出し（右ペイン等）：1.125rem(18px) 太字 黒。
// 画面名はヘッダー（システム名の右）に出すため本文には置かない（→ ui/screen-title.tsx の ScreenTitle）。
export const SCREEN_TITLE_CLASS = 'text-lg font-bold text-gray-900';
// カード（白地の箱）：白・角丸・枠 card-border・影 shadow-card（UI/UX分科会 決定事項21＝宮澤案。UX-031）。
// 開閉するカードは CollapsibleCard（この定数を使う）。開閉しないカードを画面で組むときもこれを使う。
export const CARD_CLASS =
  'bg-white rounded-lg border border-card-border shadow-card';
// カード／セクションタイトル：1rem(16px) 太字 紺（brand-navy-900。UX-031）
export const CARD_TITLE_CLASS = 'text-base font-bold text-brand-navy-900';

// 下ペイン（BottomPane）が開いている間、ペインの高さ（rem）を入れる CSS 変数の名前（<html> に付ける）。
// 画面の縦幅に合わせる親画面のグリッドは、この分だけ低くして、下ペインの上に収める（→ 02 BottomPane・viewportGridHeight）。
export const BOTTOM_PANE_HEIGHT_VAR = '--bottom-pane-height';
