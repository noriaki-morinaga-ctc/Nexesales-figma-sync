// 計画詳細(自販機)：画面の定数（経費の行の再計算の順番・拠点名・比率の基準・グリッドをまたぐ参照・強調の対象の列）
import { GRID_COLORS } from '@/components/grid';

// 経費計画表の全ての数式セルを再計算する関数（指定された順序で実行）
// 経費計画のセル値変化時の再計算順序（依存関係順・行インデックス）：
// ※ 行インデックスはデータ種の区切り行（1=営業経費 小計／15=自販機関係費 小計）を含む。
//   区切り行は配下の小計を出すため、配下の行のあとに再計算する（UI/UX UX-120）。
// オペ条件口(3)→帳合料(4)→オペ金銭口/オペ条件口 手出票(5)→条件口(2)→
// 条件口率(6)→ロケ運転費率(8)→ロケ運転費(7)→オペ協力金(9)→その他一時費用(10)→
// ロケ契約料(11)→ロケ契約見込(13)→ロケ契約中(14)→前払い金 償却(12・子行の小計)→
// 営業経費 小計(1)→コラム料(16)→リース料(17)→販売器具費(18)→自販機関係費 小計(15)→
// 経費金額合計(0)
export const EXPENSE_RECALC_ROW_ORDER = [
  3, 4, 5, 2, 6, 8, 7, 9, 10, 11, 13, 14, 12, 1, 16, 17, 18, 15, 0,
];

// 数式説明文用：拠点列名・比率列の分母名
export const EXPENSE_BRANCH_NAMES: Record<string, string> = {
  catHonsha: '本社',
  catShishaA: '支社A',
  catShishaBKyotsu: '支社B共通',
  catShishaBKaitaku: '支社B開拓',
};

export const EXPENSE_RATIO_BASE: Record<string, string> = {
  catZengetsuHi: '前月実績',
  catYosanHi: '予算',
  catZennenHi: '前年実績',
};

// 経費計画の数式が参照する販売計画セルのクロスグリッド参照トークン → 販売計画セルID
// （商流販売店計 row0：当月計画=col1 / 予算金額=col21 / 前年実績金額=col2）
export const EXPENSE_CROSS_GRID_REF_MAP: Record<string, string> = {
  '商流販売店計[当月計画]': '0-col1',
  '販売計画[当月計画]': '0-col1',
  '商流販売店計[予算]': '0-col21',
  '商流販売店計[前年実績]': '0-col2',
};

// ハイライト起点（クリックで、数式の参照を順次辿って依存セルを強調表示する
// 対象）の判定。編集可否(isCellTrigger)とは別管理にし、編集可否は変えない。
// 以下の入力列を起点に追加する。
// 注: 合計函数(col6)は「入力可能なセル」(その他/手売り=行4・出荷実販差=行5)のみ
//     を起点にするため、ここには含めず isCellTrigger 側（行4,5 の col6）に任せる。
//     行0〜3 の col6 は計算セルなので起点から除外される。
export const HIGHLIGHT_TRIGGER_FIELDS = new Set([
  'col21', // 社外売上高_予算
  'col2', // 社外売上高_前年実績
  'col4', // 当月函数
  'col23', // 予算_函数
  'col7', // 前年函数
  'col9', // 平均入数
  'col13', // 直近変動率
  'col20', // アライアンス品契約状況変動に伴う追加売上金額
  'col19', // 価格改定率
  'col25', // 前年PM/PC（専用機PM/提携機PC の算出元）
  'col26', // 直近台数(コラム)（稼働台数(コラム) の算出元）
]);

// 数式ガイドのセル強調スタイル（色は GRID_COLORS へ集約・枠線は border-width-thick=0.125rem）
// クリック＝青実線／参照セル＝緑実線／依存セル＝オレンジ破線で、色相（緑/オレンジ）に
// 依存せず線種でも区別できるようにする（赤緑色覚での混同を避けるユニバーサルデザイン対応。
// → 06 §「色以外の手がかり」）
export const CLICK_HIGHLIGHT_BORDER = `0.125rem solid ${GRID_COLORS.clickHighlightBorder}`; // クリックセル（青・実線枠）
export const REF_HIGHLIGHT_BORDER = `0.125rem solid ${GRID_COLORS.refHighlightBorder}`; // 参照セル（緑・実線枠）
export const DEP_HIGHLIGHT_BORDER = `0.125rem dashed ${GRID_COLORS.dependentBorder}`; // 依存セル（オレンジ・破線枠）
// グリッド外（出荷稼働日欄等）で使う参照セル強調（緑枠のみ・背景は塗らない）
export const REF_HIGHLIGHT_STYLE = {
  border: REF_HIGHLIGHT_BORDER,
};

// 実数／差分表示の切替ボタンのツールチップ（UI/UX UX-055）。差分の基準は前回保存（登録）した値
// （決定事項 2026/06/02 自販機 課題#223：登録した値が以降の差分比較のベース値になる）
export const ACTUAL_MODE_TOOLTIP = '入力した値をそのまま表示します';
export const DIFF_MODE_TOOLTIP = '前回保存した値との差を表示します';
