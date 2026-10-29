// モックデータ用の「原本ファイル」生成（モック専用）。
// ※ 支払詳細(自販機)画面ローカルのモック専用モジュール（Figma Make から移植）。
//
// 表示タブの初期データは実ファイルを持たないため、本来はダウンロードできない。
// ただしデモでは「原本DLの流れ」まで見せたいため、**画面に表示している内容から
// 同じ拡張子のファイルを組み立てて**ダウンロードさせる。
//  - `.pdf` の資料 … 表示中のページ画像を1ページずつ収めたPDFを生成
//  - `.xlsx` / `.xls` の資料 … サンプル内容のブックを生成（SheetJS）
//  - それ以外 … 生成しない（DLボタンは無効のまま）
//
// 実装版では S3 の原本をそのまま配信するため、このファイルは不要になる。

// 画像を読み込む（SVGデータURIでも可）
const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像を読み込めませんでした'));
    img.src = url;
  });

// 画像をJPEGのバイト列にする（PDFへ DCTDecode で埋め込むため）
const toJpegBytes = async (
  img: HTMLImageElement,
  maxWidth = 1240
): Promise<{ bytes: Uint8Array; width: number; height: number }> => {
  const naturalWidth = img.naturalWidth || img.width || 800;
  const naturalHeight = img.naturalHeight || img.height || 1130;
  const scale = Math.min(1, maxWidth / naturalWidth);
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas を使えません');
  // 透明部分が黒くならないよう白で塗ってから描画する
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85)
  );
  if (!blob) throw new Error('JPEGに変換できませんでした');
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width,
    height,
  };
};

const encoder = new TextEncoder();
const ascii = (text: string) => encoder.encode(text);

// A4 の用紙にページ画像を収める（縦横は画像の比率で選ぶ）
const A4_SHORT = 595.28;
const A4_LONG = 841.89;

const pageSizeFor = (width: number, height: number) => {
  const landscape = width > height;
  const pageWidth = landscape ? A4_LONG : A4_SHORT;
  const pageHeight = landscape ? A4_SHORT : A4_LONG;
  const scale = Math.min(pageWidth / width, pageHeight / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  return {
    pageWidth,
    pageHeight,
    drawWidth,
    drawHeight,
    offsetX: (pageWidth - drawWidth) / 2,
    offsetY: (pageHeight - drawHeight) / 2,
  };
};

/**
 * ページ画像（JPEG）を並べた最小構成のPDFを組み立てる。
 * 外部ライブラリを使わず、必要なオブジェクトだけを手で書き出している。
 */
const imagesToPdf = (
  pages: { bytes: Uint8Array; width: number; height: number }[]
): Blob => {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;

  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === 'string' ? ascii(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  // オブジェクト番号 n の開始位置を記録する（xref 用）
  const startObject = (n: number) => {
    offsets[n] = length;
  };

  const pageCount = pages.length;
  // 1=Catalog, 2=Pages, 以降 ページごとに Page/Contents/Image の3つ
  const pageObjNo = (i: number) => 3 + i * 3;
  const contentObjNo = (i: number) => pageObjNo(i) + 1;
  const imageObjNo = (i: number) => pageObjNo(i) + 2;
  const objectCount = 2 + pageCount * 3;

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  startObject(1);
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  startObject(2);
  const kids = pages.map((_, i) => `${pageObjNo(i)} 0 R`).join(' ');
  push(
    `2 0 obj\n<< /Type /Pages /Kids [ ${kids} ] /Count ${pageCount} >>\nendobj\n`
  );

  pages.forEach((page, i) => {
    const size = pageSizeFor(page.width, page.height);
    const content =
      `q ${size.drawWidth.toFixed(2)} 0 0 ${size.drawHeight.toFixed(2)} ` +
      `${size.offsetX.toFixed(2)} ${size.offsetY.toFixed(2)} cm /Im0 Do Q\n`;

    startObject(pageObjNo(i));
    push(
      `${pageObjNo(i)} 0 obj\n<< /Type /Page /Parent 2 0 R ` +
        `/MediaBox [ 0 0 ${size.pageWidth.toFixed(2)} ${size.pageHeight.toFixed(2)} ] ` +
        `/Resources << /XObject << /Im0 ${imageObjNo(i)} 0 R >> >> ` +
        `/Contents ${contentObjNo(i)} 0 R >>\nendobj\n`
    );

    startObject(contentObjNo(i));
    push(
      `${contentObjNo(i)} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`
    );

    startObject(imageObjNo(i));
    push(
      `${imageObjNo(i)} 0 obj\n<< /Type /XObject /Subtype /Image ` +
        `/Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB ` +
        `/BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`
    );
    push(page.bytes);
    push('\nendstream\nendobj\n');
  });

  const xrefStart = length;
  let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= objectCount; n += 1)
    xref += `${String(offsets[n] ?? 0).padStart(10, '0')} 00000 n \n`;
  push(xref);
  push(
    `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  );

  return new Blob(chunks as BlobPart[], {
    type: 'application/pdf',
  });
};

// モックのExcelブックを組み立てる（同梱の SheetJS を使う）
const buildMockWorkbook = async (fileName: string): Promise<Blob> => {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.aoa_to_sheet([
    [fileName],
    ['※ プロトタイプのモックデータです。実データは含まれません。'],
    [],
    ['項目', '内容'],
    ['資料名', fileName],
    ['備考', '画面表示用のサンプルとして生成したファイルです'],
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'サンプル');
  const buffer = XLSX.write(book, {
    bookType: 'xlsx',
    type: 'array',
  }) as ArrayBuffer;
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

/** モック資料をDL可能か（生成できる形式か）。 */
export const canBuildMockOriginal = (fileName: string, pageUrls: string[]) =>
  (/\.pdf$/i.test(fileName) && pageUrls.length > 0) ||
  /\.xlsx?$/i.test(fileName);

/**
 * モック資料の「原本」を組み立てて Blob URL を返す。生成できない場合は null。
 * 生成したURLは呼び出し側で解放する（ダウンロード後に revoke する）。
 */
export const buildMockOriginalUrl = async (
  fileName: string,
  pageUrls: string[]
): Promise<string | null> => {
  try {
    if (/\.pdf$/i.test(fileName) && pageUrls.length > 0) {
      const pages = [];
      for (const url of pageUrls)
        pages.push(await toJpegBytes(await loadImage(url)));
      return URL.createObjectURL(imagesToPdf(pages));
    }
    if (/\.xlsx?$/i.test(fileName))
      return URL.createObjectURL(await buildMockWorkbook(fileName));
    return null;
  } catch {
    return null;
  }
};
