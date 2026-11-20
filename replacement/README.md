# Figma Make 取り込み用（main e050d452 時点の src 一式）

前回の取り込み（main dc23a555）からの変更は、下の 1 ファイルだけです。

Figma Make への指示：

GitHub の Nexesales-figma-sync リポジトリ（main ブランチ）の replacement/ にある次のファイルで、src の同じ場所のファイルを置き換えてください。
表にないファイルは変更しないでください。

| replacement/ | 置き換え先 |
|---|---|
| replacement/components/grid/gridSetup.ts | src/components/grid/gridSetup.ts |

※ setupAgGrid() の中で applyGridColorVariables()（グリッドの色の CSS 変数の登録）を呼ぶ形です。この呼び出しを消さないでください。
※ replacement/ には main e050d452 時点の src 一式が入っています。表のファイル以外は前回の取り込みと同じ内容です。
