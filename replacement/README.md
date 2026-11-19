# Figma Make 取り込み用（main c2c58620 時点の src 一式）

前回の取り込み（main 3c9dec4f）から src のフォルダー構成が変わりました（画面・部品・処理を src/app の外へ移しています）。

Figma Make への指示：

GitHub の Nexesales-figma-sync リポジトリ（main ブランチ）にある次のフォルダー・ファイルで、src の同じ名前のものを置き換えてください。
対象フォルダーは完全置換（中にあるファイルをすべて消してから入れ直す）し、作業途中のエラーは無視してください。

| replacement/ | 置き換え先 |
|---|---|
| app/ | src/app/（App.tsx・routes.tsx・routes.test.ts・Attributions.md だけになります。src/app/components・constants・types・utils は無くなります） |
| features/ | src/features/（新規） |
| components/ | src/components/（新規） |
| constants/ | src/constants/（新規） |
| types/ | src/types/（新規） |
| utils/ | src/utils/（新規） |
| mocks/ | src/mocks/ |
| styles/ | src/styles/ |
| main.tsx | src/main.tsx |

※ 上の表にない src の中のもの（src/assets など Figma Make 側のファイル）は、消さずにそのまま残してください。
※ src/app/App.tsx の AG Grid ライセンスキーは公開用に伏せています（AG_GRID_LICENSE_KEY）。
   取り込み後、置き換える前の App.tsx にあった本物のキーに戻してください。
※ 初期表示の画面（App.tsx の currentPage の初期値）は、GitHub 側の値で上書きせず、Figma Make 側の今の設定のままにしてください。
※ import は `@/features/…`・`@/components/…`・`@/constants/…`・`@/types/…`・`@/utils/…`・`@/mocks/…`・`@/styles/…` の別名（@ = src）を使います。vite.config の alias（'@' → ./src）はそのまま残してください。
