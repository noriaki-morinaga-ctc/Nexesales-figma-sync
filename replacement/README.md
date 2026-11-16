# Figma Make 取り込み用（main e8d5158e 時点の src 一式）

Figma Make への指示：

GitHub の Nexesales-figma-sync リポジトリ（main ブランチ）にある
replacement/app/ を src/app/ に、
replacement/styles/ を src/styles/ に、
replacement/mocks/ を src/mocks/ に配置し（src/mocks/ は新しいフォルダ）、
replacement/main.tsx を src/main.tsx に置き換えてください。
対象フォルダは完全置換し、作業途中のエラーは無視してください。

※ src/app/App.tsx の AG Grid ライセンスキーは公開用に伏せています（AG_GRID_LICENSE_KEY）。
   取り込み後、置き換える前の App.tsx にあった本物のキーに戻してください。
※ 初期表示の画面（App.tsx の currentPage の初期値）は、GitHub 側の値で上書きせず、Figma Make 側の今の設定のままにしてください。
※ import は `@/app/…`・`@/mocks/…`・`@/styles/…` の別名（@ = src）を使います。vite.config の alias（'@' → ./src）はそのまま残してください。
