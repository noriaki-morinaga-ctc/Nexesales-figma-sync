// AG Grid の全画面共通の設定（モジュールの登録・グローバルの既定値・数値入力のホイール止め）。
// アプリの起動時に1回だけ setupAgGrid() を呼ぶ（いまは App.tsx。Next.js では Providers の部品）。
// ライセンスキーは App.tsx で設定する（Figma Make への反映でキーを伏せる場所を変えないため）。
import {
  ModuleRegistry,
  AllCommunityModule,
  provideGlobalGridOptions,
} from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';

import { AG_GRID_LOCALE_JA } from './gridLocale';
import { GridHiddenColumnsStatusPanel } from './GridComponents';
import {
  GRID_THEME,
  GRID_COLUMN_TYPES,
  GRID_DATA_TYPE_DEFINITIONS,
  gridFilterContextMenuItems,
  attachFilterInputClearButtons,
  installNumberInputWheelGuard,
  gridHeaderStyle,
  GRID_SORT_ICONS,
} from './gridCommon';
import { applyGridColorVariables } from '@/styles/gridStyles';

let isAgGridSetUp = false;

export function setupAgGrid(): void {
  // 2回目以降は何もしない（開発時の再読み込み等で二重に登録しない）
  if (isAgGridSetUp) return;
  isAgGridSetUp = true;

  // グリッドの色（gridStyles.ts が正）を CSS 変数として登録する（grid.css が参照する）。main.tsx でも呼ぶが、
  // Figma Make は自分の起動ファイルを使い main.tsx を通らないため、App から必ず呼ばれるここでも呼ぶ
  // （2回目は何もしない）。登録されないと grid.css の色（プルダウンの ▼ など）が透明になる（UX-123）
  applyGridColorVariables();

  // AG Grid Enterprise モジュールをグローバルに登録（全コンポーネントで利用可能にする）
  ModuleRegistry.registerModules([AllCommunityModule, AllEnterpriseModule]);

  // AG Grid グローバル設定（日本語ロケール＋共通テーマ）
  // theme を全グリッドのデフォルトとして登録。各グリッドで theme= を指定しなければ
  // この GRID_THEME が自動適用される（個別指定があればそちらが優先）。
  provideGlobalGridOptions({
    localeText: AG_GRID_LOCALE_JA, // 全グリッド共通の日本語ロケール
    theme: GRID_THEME, // 全画面共通グリッドテーマ
    // 右クリックメニューの共通化（フィルタ項目の追加＋エクスポートの全件出力化）。
    // グリッド側で getContextMenuItems= を指定しない場合はこれが適用される
    //（個別指定があればそちらが優先。指定する場合も同じ関数を渡すこと）。
    getContextMenuItems: gridFilterContextMenuItems,
    // 列フィルタの種類を値の型で決める（数値・日付は専用フィルタ、文字は選択式。→ grid/gridCommon）
    dataTypeDefinitions: GRID_DATA_TYPE_DEFINITIONS,
    columnTypes: GRID_COLUMN_TYPES,
    // 列グループの見出しの配色（配下に編集できる列が無いグループをグレーにする。→ grid/gridCommon の gridHeaderStyle）。
    // 列の見出しは GRID_DEFAULT_COL_DEF の headerStyle で付く（画面が defaultColDef を渡すとグローバルの
    // defaultColDef は効かないため）。defaultColGroupDef は画面で渡さない
    defaultColGroupDef: { headerStyle: gridHeaderStyle },
    // 数値・テキストフィルタの入力欄に×（クリア）を付ける（年月フィルタと同じ操作。→ grid/gridCommon）
    onFilterOpened: attachFilterInputClearButtons,
    // 列幅で省略されたときだけツールチップを出す（画面設計標準 4.2 ⑥）。
    // 計算式をツールチップで見せるグリッドは、画面側で tooltipShowMode="standard" にする
    tooltipShowMode: 'whenTruncated',
    // 列幅の自動調整で測った幅に足す余白（AG Grid の既定は 20px）。半角1文字分（約6px）狭くする試作
    //（UI/UX 確認用モックのコメント #14「自動調整をもう半角くらい狭く」。結論が出たら規約に書く）
    autoSizePadding: 14,
    // 並べ替えの印は ▲▼ を上下に並べた形（今の向きを濃く。並べ替え中の列だけ。→ grid/gridCommon・UX-098）
    icons: GRID_SORT_ICONS,
    // 件数表示（statusBar）を付けないグリッドにも、非表示の列があるときだけ「非表示の列：N列　列選択」を出す
    //（列は見出しの右クリックの「列選択」でどのグリッドでも隠せるため。非表示の列が無いときは grid.css で行ごと隠す。
    // 件数表示のあるグリッドは GRID_STATUS_BAR の件数パネルが同じ表示を持つ。→ 02 §8「非表示の列」・UX-054）
    statusBar: {
      statusPanels: [
        { statusPanel: GridHiddenColumnsStatusPanel, align: 'left' as const },
      ],
    },
  });

  // 数値の入力欄でホイールによる値の増減を止める（画面設計標準 4.6）
  installNumberInputWheelGuard();
}
