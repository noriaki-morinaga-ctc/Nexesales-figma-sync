// PDFプレビュー（指示書 D4）。
// 変換後PDF・PDF原本の表示口をこのコンポーネントに集約する。
// ブラウザ内蔵ビューアに任せる <embed> 実装。
// 実装版では PDF.js に差し替える前提の境界として切り出している。

// ブラウザ内蔵PDFビューアの表示オプション。
//  toolbar=0  … 内蔵ツールバーを出さない
//  navpanes=0 … サイドのページ一覧パネルを出さない
//
// ツールバーを消す狙いは「Google ドライブに保存」を含む外部保存・持ち出し導線を
// 画面に出さないこと。ダウンロードはアプリ側のボタン（常に原本を渡す）に一本化する。
// ※ Chrome の右クリックメニューや Ctrl+S まではページ側から塞げないため、
//   完全な持ち出し防止が要件になる場合は PDF.js 化またはブラウザポリシー側の制御が必要。
const VIEWER_PARAMS = '#toolbar=0&navpanes=0';

// URL に表示オプションを付ける（既にフラグメントが付いている場合は上書きしない）。
const withViewerParams = (src: string) =>
  src.includes('#') ? src : `${src}${VIEWER_PARAMS}`;

export interface PdfPreviewProps {
  // 表示するPDFのURL（変換後PDF または PDF原本）
  src: string;
  // 読み上げ・ツールチップ用の資料名
  fileName: string;
  className?: string;
}

export function PdfPreview({ src, fileName, className = '' }: PdfPreviewProps) {
  const viewerSrc = withViewerParams(src);
  return (
    // key に URL を入れて、資料を切り替えたときに <embed> を作り直す。
    // src 属性だけを差し替えるとブラウザ内蔵ビューアが読み直さず、
    // 表示が空になることがあるため（資料送りで「何も表示されない」事象の対策）。
    <embed
      key={viewerSrc}
      src={viewerSrc}
      type="application/pdf"
      className={`w-full h-full ${className}`}
      title={`${fileName} のプレビュー`}
      aria-label={`${fileName} のプレビュー`}
    />
  );
}
