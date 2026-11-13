// 根拠資料プレビュー用のサンプル画像（モック専用）。
// ※ 支払詳細(自販機)画面ローカルのモック専用データ（Figma Make から移植）。
//   ガイドライン 07「base64 埋め込み禁止」の対象外として、モック確認用に限り保持する。
//   実装版では S3 に格納した原本・変換後PDF の配信URLに置き換え、このファイルは削除する。
// レイアウト・配色は配布された請求書サンプルを個別に再現している（両者はデザインが異なる）。
//  - 横長（A4横）＝請求書サンプル①：モノクロ基調。中央に「請 求 書」＋下線、
//    左上に集計3列（今回御買上高／消費税等／今月御請求額）、明細はグレーヘッダーの罫線表。
//  - 縦長（A4縦）＝請求書サンプル②：水色基調。中央に大きな青い「請 求 書」、
//    年月日の分割記入、登録番号、青枠の集計表（前回請求高〜差引当月請求高）、
//    明細は水色ヘッダー＋青罫線で伝票ごとに「計」。
// 実装時は BOX に格納された PDF の各ページを画像化したものに差し替わる。
//
// データの扱い（2026-07-21 決定）：
//  - 商品名のみ実データ（A-FRAME 実データ／営業用飲料商品マスタ の商品名）を使用。
//    アサヒ飲料の自社製品のためそのまま載せている。
//  - 取引先名は**すべて架空のダミー**（サンプルベンディング／ダミーストア）。取引先コード・住所・
//    電話番号・インボイス登録番号も実在しない値。外部に見せる可能性があるため実在の社名は使わない。
//    ※発行元は費目で変わる。ロケ運転費・オペ協力金・コラム料は自販機オペレータだが、
//      ロケ契約料（設置場所の使用料）は設置場所の持ち主＝コンビニ本部・ビル管理会社・
//      施設などが相手になる。オペレータだけとは限らない。
//  - 金額・単価は顧客提示時に不要なため、ぼかして読めないようにする。
//
// 外部アセットを持たない方針のため、SVG をデータURI にしてインラインで保持する。

// 全角スペース（テンプレートリテラル内の全角スペースは no-irregular-whitespace の対象になるため定数で埋め込む）
const FW_SPACE = '\u3000';

const svgToDataUri = (svg: string) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(svg);

// 帳票に印字する番号。画面側の項目と一致させるため、ここを唯一の出所にして
// 支払詳細(自販機)画面（page.tsx）から import して使う。
//  - 請求書番号 … 明細グリッドの「請求書番号」列（アウトプットイメージ③項目詳細 No.55）
//  - 稟議決裁書番号 … 同 No.58
export const INVOICE_NO_LANDSCAPE = 'NP-2025-100412'; // 横長（サンプルベンディング東）
export const INVOICE_NO_PORTRAIT = 'NV-2025-0731'; // 縦長（サンプルベンディング中央）
export const APPROVAL_DOC_NO = '稟2025-自販-0642'; // 稟議決裁書番号

// 金額をぼかすための定義（網掛けパターンとガウスぼかし）。
const BLUR_DEFS = `
  <defs>
    <pattern id="mask" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="4" height="4" fill="#e5e7eb"/>
      <line x1="0" y1="0" x2="0" y2="4" stroke="#cbd5e1" stroke-width="2"/>
    </pattern>
    <!-- 金額は読み取れないところまでぼかす（桁数も判別しにくい強さ） -->
    <filter id="soft"><feGaussianBlur stdDeviation="3.2"/></filter>
    <!-- 大きな文字（合計金額など）用。文字サイズに合わせてさらに強くする -->
    <filter id="soft-lg"><feGaussianBlur stdDeviation="7.5"/></filter>
  </defs>`;

// ───────────────────────────────────────────────
// 横長（A4横・請求書サンプル①）
// モノクロ基調。列＝伝票日付／伝票No.／商品／入数／数量／単価／金額／発注No.／納品先／適用
// ───────────────────────────────────────────────
// 実データ（営業用飲料商品マスタ）の商品名。明細行の生成に使う。
const PRODUCTS: [string, string, string][] = [
  ['459787', 'ワンダ　金の微糖　缶１８５ｇ', '420'],
  ['987547', 'アサヒ　十六茶　ＰＥＴ２Ｌ', '180'],
  ['134897', '三ツ矢サイダー　缶３５０ｍｌ', '230'],
  ['789340', '「カルピスウォーター」５００', '270'],
  ['164797', 'アサヒ　スーパーＨ２Ｏ　缶４９０ｇ', '230'],
  ['556437', 'バヤリース　オレンジ　ＰＥＴ２８０ｍｌ', '180'],
  ['333287', 'ワンダ　モーニングショット　缶１８５ｇ', '300'],
  ['589623', 'アサヒ　おいしい水　富士山　ＰＥＴ６００ｍｌ', '150'],
  ['145698', '「カルピスソーダ」５００ｍｌ（ＰＥＴ）自販機用', '180'],
  ['999875', 'ワンダ　極　ブラック　ボトル缶２８５ｇ', '300'],
  ['112045', 'アサヒ　十六茶　ボトル缶２７５ｇ', '210'],
  ['220388', '三ツ矢サイダー　ＰＥＴ１．５Ｌ', '340'],
  ['331902', '「守る働く乳酸菌」ＰＥＴ１００ｍｌ', '160'],
  ['447120', 'ワンダ　特製カフェオレ　缶１８５ｇ', '290'],
  ['558431', 'アサヒ　おしるこ　缶１９０ｇ', '250'],
  ['669274', 'バヤリース　アップル　ＰＥＴ１．５Ｌ', '330'],
  ['770156', '濃いめの「カルピス」ＰＥＴ４９０ｍｌ', '280'],
  ['881093', 'アサヒ　おいしい水　六甲　ＰＥＴ６００ｍｌ', '150'],
  ['992740', '「カルピスソーダ」１６０', '120'],
  ['103865', 'アサヒ　十六茶　缶２４５ｇ', '200'],
  ['214977', 'ワンダ　極　ブラック　ボトル缶４００ｇ', '360'],
  ['325108', '三ツ矢サイダー　ボトル缶３００ｍｌ', '240'],
  ['436291', '「健茶王」すっきり烏龍茶２８０ｍｌＰＥＴ', '260'],
  ['547382', 'アサヒ　スーパーＨ２Ｏ　ＰＥＴ２Ｌ', '350'],
  ['658473', '「ほっとレモン」＜希釈用＞', '310'],
  ['769564', 'アサヒ　十六茶　（ＬＬ）紙パックスリム２５０ｍｌ', '170'],
];

// 納品先（架空の営業所名）と伝票の組み合わせ。
const DELIVERY = [
  ['858508', '60131372', 'サンプルベンディング　東営業所'],
  ['858553', '60512193', 'サンプルベンディング　中央支店'],
  ['858556', '80674', 'サンプルベンディング　西営業所'],
  ['858648', '60131410', 'サンプルベンディング　東営業所'],
];

// 1ページ26行。明細が入りきらないため複数ページになる（実運用でも同様）。
const ROWS_PER_PAGE = 26;

// ページ番号から、そのページに載る明細行を生成する。
const buildRows = (pageNo: number) => {
  const rows: string[][] = [];
  for (let i = 0; i < ROWS_PER_PAGE; i++) {
    const seq = (pageNo - 1) * ROWS_PER_PAGE + i;
    const [code, name, unit] = PRODUCTS[seq % PRODUCTS.length];
    const [slip, order, dest] = DELIVERY[seq % DELIVERY.length];
    const day = ((seq * 3) % 28) + 1;
    const qty = ((seq * 7) % 12) + 1;
    const amount = Number(unit) * qty * 20;
    // 各ページ最後の1行だけ返品（マイナス）にして実物の見た目に寄せる
    const isReturn = i === ROWS_PER_PAGE - 1;
    rows.push([
      `9月${day}日`,
      slip,
      code,
      name,
      '20.0×2',
      isReturn ? '-3' : String(qty),
      unit,
      isReturn
        ? `-${(Number(unit) * 3).toLocaleString()}`
        : amount.toLocaleString(),
      order,
      dest,
      isReturn ? '袋破れ　返品' : '',
    ]);
  }
  return rows;
};

const buildLandscape = (pageNo: number, totalPages: number) => {
  const W = 1160;
  const H = 820; // A4横（297:210）の比率に合わせる
  // 列の左端（境界線）座標
  const col = [70, 128, 174, 226, 430, 486, 538, 600, 664, 740, 1010, 1120];
  const top = 248; // 明細ヘッダーの上端
  const rowH = 15;
  const headH = 15;

  const headers = [
    '伝票日付',
    '伝票No.',
    '',
    '商品',
    '入数',
    '数量',
    '単価',
    '金額',
    '発注No.',
    '納品先',
    '適用',
  ];
  let head = `<rect x="${col[0]}" y="${top}" width="${col[11] - col[0]}" height="${headH}" fill="#d9d9d9" stroke="#000" stroke-width="0.8"/>`;
  headers.forEach((h, i) => {
    if (!h) return;
    // 伝票No.は2列ぶち抜き（伝票No.＋枝番）
    const right = i === 1 ? col[3] : col[i + 1];
    const cxm = (col[i] + right) / 2;
    head += `<text x="${cxm}" y="${top + 11}" font-size="8.5" text-anchor="middle" fill="#000">${h}</text>`;
  });

  const pageRows = buildRows(pageNo);
  const rows = pageRows
    .map((r, i) => {
      const y = top + headH + i * rowH;
      const ty = y + 11;
      // 金額がマイナスなら赤字（実物どおり）
      const amountFill = r[7].startsWith('-') ? '#ff0000' : '#000';
      let cells = `<rect x="${col[0]}" y="${y}" width="${col[11] - col[0]}" height="${rowH}" fill="#fff" stroke="#000" stroke-width="0.5"/>`;
      col.forEach((x) => {
        cells += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + rowH}" stroke="#000" stroke-width="0.5"/>`;
      });
      cells += `
      <text x="${(col[0] + col[1]) / 2}" y="${ty}" font-size="8.5" text-anchor="middle" fill="#000">${r[0]}</text>
      <text x="${(col[1] + col[2]) / 2}" y="${ty}" font-size="8.5" text-anchor="middle" fill="#000">${r[1]}</text>
      <text x="${(col[2] + col[3]) / 2}" y="${ty}" font-size="8.5" text-anchor="middle" fill="#000">${r[2]}</text>
      <text x="${col[3] + 5}" y="${ty}" font-size="8.5" fill="#000">※${r[3]}</text>
      <text x="${col[5] - 4}" y="${ty}" font-size="8.5" text-anchor="end" fill="#000">${r[4]}</text>
      <text x="${col[6] - 4}" y="${ty}" font-size="8.5" text-anchor="end" fill="#000">${r[5]}</text>
      <text x="${col[7] - 4}" y="${ty}" font-size="8.5" text-anchor="end" fill="#000" filter="url(#soft)">${r[6]}</text>
      <text x="${col[8] - 4}" y="${ty}" font-size="8.5" text-anchor="end" fill="${amountFill}" filter="url(#soft)">${r[7]}</text>
      <text x="${col[9] - 4}" y="${ty}" font-size="8.5" text-anchor="end" fill="#000">${r[8]}</text>
      <text x="${col[9] + 4}" y="${ty}" font-size="8" fill="#000">${r[9]}</text>
      <text x="${col[10] + 4}" y="${ty}" font-size="8.5" fill="#000">${r[10]}</text>`;
      return cells;
    })
    .join('');

  const bodyBottom = top + headH + pageRows.length * rowH;

  return svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${BLUR_DEFS}
    <rect width="${W}" height="${H}" fill="#ffffff"/>

    <!-- 右上：請求書No・発行日。画面の明細「請求書番号」と同じ値にする -->
    <text x="${W - 400}" y="86" font-size="11" fill="#000">請求書No：${INVOICE_NO_LANDSCAPE}</text>
    <text x="${W - 240}" y="86" font-size="11" fill="#000">発行日：2025年10月20日</text>

    <!-- 宛先 -->
    <text x="70" y="118" font-size="11" font-weight="bold" fill="#000">アサヒ飲料株式会社${FW_SPACE}御中</text>

    <!-- 中央タイトル（下線付き） -->
    <text x="${W / 2}" y="120" font-size="17" letter-spacing="12" text-anchor="middle" fill="#000">請${FW_SPACE}求${FW_SPACE}書</text>
    <line x1="${W / 2 - 88}" y1="130" x2="${W / 2 + 88}" y2="130" stroke="#000" stroke-width="1.6"/>

    <!-- 発行元 -->
    <text x="${W - 320}" y="150" font-size="11" font-weight="bold" fill="#000">株式会社サンプルベンディング${FW_SPACE}東営業所</text>
    <text x="${W - 320}" y="167" font-size="10" fill="#000">東京都港区XX1-2-3</text>
    <text x="${W - 320}" y="182" font-size="10" fill="#000">TEL: 03-0000-0000</text>

    <text x="78" y="186" font-size="10" fill="#000">下記の通りご請求申し上げます。${FW_SPACE}${FW_SPACE}※印は軽減税率（8％）対</text>

    <!-- 左上の集計3列（今回御買上高／消費税等／今月御請求額）。金額はぼかす。
         合計は請求全体の値のため最終ページにのみ表示する。 -->
    ${
      pageNo === totalPages
        ? `<g>
      <rect x="70" y="196" width="230" height="16" fill="#d9d9d9" stroke="#000" stroke-width="0.8"/>
      <rect x="70" y="212" width="230" height="18" fill="#fff" stroke="#000" stroke-width="0.8"/>
      <line x1="147" y1="196" x2="147" y2="230" stroke="#000" stroke-width="0.8"/>
      <line x1="224" y1="196" x2="224" y2="230" stroke="#000" stroke-width="0.8"/>
      <text x="108" y="208" font-size="8.5" text-anchor="middle" fill="#000">今回御買上高</text>
      <text x="185" y="208" font-size="8.5" text-anchor="middle" fill="#000">消費税等</text>
      <text x="262" y="208" font-size="8.5" text-anchor="middle" fill="#000">今月御請求額</text>
      <text x="142" y="225" font-size="9" text-anchor="end" fill="#000" filter="url(#soft)">58,778,706</text>
      <text x="219" y="225" font-size="9" text-anchor="end" fill="#000" filter="url(#soft)">4,702,296</text>
      <text x="296" y="225" font-size="9" text-anchor="end" fill="#000" filter="url(#soft)">63,481,002</text>
    </g>`
        : ''
    }

    <!-- 右：締切日・お支払期限 -->
    <text x="${W - 250}" y="207" font-size="8.5" fill="#000">締切日：2025年09月30日</text>
    <text x="${W - 250}" y="222" font-size="8.5" fill="#000">お支払期限：2025年10月31日</text>

    <!-- 明細表 -->
    ${head}
    ${rows}
    <rect x="${col[0]}" y="${top}" width="${col[11] - col[0]}" height="${bodyBottom - top}" fill="none" stroke="#000" stroke-width="1"/>


    <text x="70" y="${H - 20}" font-size="9" fill="#9ca3af">- ${pageNo} / ${totalPages} -</text>
  </svg>`);
};

// ───────────────────────────────────────────────
// 縦長（A4縦・請求書サンプル②）
// 水色基調。伝票ごとに明細＋「計」、末尾に小計と当月集計。
// ───────────────────────────────────────────────
const PORTRAIT_GROUPS = [
  {
    date: '2025/10/05',
    slip: '21444404',
    sub: '08141762',
    rows: [
      ['アサヒ　十六茶　缶２４５ｇ', '8', '48', '78', '3,744'],
      ['ワンダ　金の微糖　缶１８５ｇ', '4', '24', '78', '1,872'],
      ['三ツ矢サイダー　ボトル缶３００ｍｌ', '2', '12', '78', '936'],
    ],
    total: '16,224',
  },
  {
    date: '2025/10/05',
    slip: '60151452',
    sub: '08141462',
    rows: [
      ['「カルピスウォーター」３５０', '120', '720', '151', '108,720'],
      ['アサヒ　十六茶　ＰＥＴ２Ｌ', '2', '12', '78', '936'],
      ['バヤリース　オレンジ　ＰＥＴ１．５Ｌ', '4', '24', '78', '1,872'],
      ['アサヒ　おしるこ　缶１９０ｇ', '2', '12', '109', '1,308'],
      ['運賃', '', '1', '500', '500'],
    ],
    total: '113,336',
  },
  {
    date: '2025/10/14',
    slip: '21444821',
    sub: '08142522',
    rows: [
      ['ワンダ　極　ブラック　ボトル缶４００ｇ', '8', '48', '109', '5,232'],
      ['アサヒ　スーパーＨ２Ｏ　ＰＥＴ２Ｌ', '6', '36', '109', '3,924'],
      ['「カルピスソーダ」５００ｍｌ（ＰＥＴ）', '5', '30', '78', '2,340'],
      ['三ツ矢サイダー　缶５００ｍｌ', '3', '18', '98', '1,764'],
      ['「守る働く乳酸菌」ＰＥＴ１００ｍｌ', '7', '42', '98', '4,116'],
      ['アサヒ　おいしい水　六甲　ＰＥＴ６００ｍｌ', '4', '24', '78', '1,872'],
      ['ワンダ　特製カフェオレ　缶１８５ｇ', '5', '30', '78', '2,340'],
    ],
    total: '24,486',
  },
];

const buildPortrait = (pageNo: number, totalPages: number) => {
  const W = 826;
  const H = 1169;
  // 列境界（月日／伝票№／※／品名／ケース数／個数／単価／金額）
  const col = [128, 200, 272, 288, 448, 512, 566, 638, 745];
  const BLUE = '#1f5fbf'; // 見出し文字の青
  const LINE = '#5b9bd5'; // 罫線の水色
  const FILL = '#deeaf6'; // 表ヘッダーの薄い水色
  const rowH = 15.5;
  const top = 268;

  let y = top + 16;
  let body = '';

  PORTRAIT_GROUPS.forEach((g) => {
    g.rows.forEach((r, i) => {
      const ty = y + 11;
      if (i === 0) {
        body += `<text x="${col[0] + 4}" y="${ty}" font-size="8.5" fill="#000">${g.date}</text>
                 <text x="${col[1] + 4}" y="${ty}" font-size="8.5" fill="#000">${g.slip}</text>`;
      }
      body += `
        <text x="${col[2] + 3}" y="${ty}" font-size="8" fill="#000">${r[0] === '運賃' ? '' : '※'}</text>
        <text x="${col[3] + 4}" y="${ty}" font-size="8.5" fill="#000">${r[0]}</text>
        <text x="${col[5] - 5}" y="${ty}" font-size="8.5" text-anchor="end" fill="#000">${r[1]}</text>
        <text x="${col[6] - 5}" y="${ty}" font-size="8.5" text-anchor="end" fill="#000">${r[2]}</text>
        <text x="${col[7] - 5}" y="${ty}" font-size="8.5" text-anchor="end" fill="#000" filter="url(#soft)">${r[3]}</text>
        <text x="${col[8] - 6}" y="${ty}" font-size="8.5" text-anchor="end" fill="#000" filter="url(#soft)">${r[4]}</text>`;
      y += rowH;
    });
    // 伝票番号の控え2行（実物どおり品名列に伝票№と枝番が並ぶ）
    body += `<text x="${col[3] + 4}" y="${y + 11}" font-size="8.5" fill="#000">${g.slip}</text>`;
    y += rowH;
    body += `<text x="${col[3] + 4}" y="${y + 11}" font-size="8.5" fill="#000">${g.sub}</text>
             <text x="${col[7] - 5}" y="${y + 11}" font-size="8.5" text-anchor="end" fill="#000">計</text>
             <text x="${col[8] - 6}" y="${y + 11}" font-size="8.5" text-anchor="end" fill="#000" filter="url(#soft)">${g.total}</text>`;
    y += rowH;
  });

  // 末尾の小計・当月集計
  const tail = [
    ['静岡支店　小計', '小計', '152,039'],
    ['当月売上計　軽減', '', '151,539'],
    ['当月売上計　標準', '', '500'],
    ['8%軽減', '', '12,123'],
    ['10%標準', '', '50'],
    ['合計', '', '164,212'],
  ];
  let tailSvg = '';
  y += 6;
  tail.forEach(([label, mid, val]) => {
    const ty = y + 11;
    tailSvg += `<text x="${col[3] + 4}" y="${ty}" font-size="8.5" fill="#000">${label}</text>
      ${mid ? `<text x="${col[7] - 5}" y="${ty}" font-size="8.5" text-anchor="end" fill="#000">${mid}</text>` : ''}
      <text x="${col[8] - 6}" y="${ty}" font-size="8.5" text-anchor="end" fill="#000" filter="url(#soft)">${val}</text>`;
    y += rowH;
  });

  const tableBottom = y + 8;

  // 縦罫線（表全体）
  const vlines = col
    .map(
      (x) =>
        `<line x1="${x}" y1="${top}" x2="${x}" y2="${tableBottom}" stroke="${LINE}" stroke-width="0.8"/>`
    )
    .join('');

  return svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${BLUR_DEFS}
    <rect width="${W}" height="${H}" fill="#ffffff"/>

    <!-- 中央タイトル（青・大きめ） -->
    <text x="${W / 2}" y="103" font-size="24" font-weight="bold" letter-spacing="10" text-anchor="middle" fill="${BLUE}">請${FW_SPACE}求${FW_SPACE}書</text>

    <!-- 宛先・発行元 -->
    <text x="128" y="128" font-size="10.5" font-weight="bold" fill="#000">アサヒ飲料株式会社${FW_SPACE}御中</text>
    <text x="${W - 84}" y="146" font-size="10.5" font-weight="bold" text-anchor="end" fill="#000">株式会社サンプルベンディング${FW_SPACE}中央支店</text>

    <!-- 年月日（分割記入式）と登録番号 -->
    <text x="452" y="174" font-size="10" fill="#000">2025</text>
    <text x="486" y="174" font-size="10" fill="${BLUE}">年</text>
    <text x="506" y="174" font-size="10" fill="#000">10</text>
    <text x="528" y="174" font-size="10" fill="${BLUE}">月</text>
    <text x="548" y="174" font-size="10" fill="#000">31</text>
    <text x="570" y="174" font-size="10" fill="${BLUE}">日</text>
    <text x="655" y="174" font-size="10" fill="#000">35</text>
    <line x1="620" y1="178" x2="700" y2="178" stroke="#000" stroke-width="0.8"/>
    <text x="452" y="190" font-size="8" fill="#000">登録番号：T0000000000002</text>
    <!-- 請求書No。画面の明細「請求書番号」と同じ値にする -->
    <text x="452" y="203" font-size="8" fill="#000">請求書No：${INVOICE_NO_PORTRAIT}</text>

    <text x="128" y="190" font-size="9.5" fill="${BLUE}">下記の通りご請求申し上げます。</text>

    <!-- 上部の集計表（前回請求高〜差引当月請求高）。数値欄は空欄のまま（実物どおり） -->
    <g>
      <rect x="128" y="198" width="${W - 212}" height="18" fill="${FILL}" stroke="${LINE}" stroke-width="0.8"/>
      <rect x="128" y="216" width="${W - 212}" height="26" fill="#fff" stroke="${LINE}" stroke-width="0.8"/>
      ${[128, 216, 304, 392, 480, 568, 656, 742]
        .map(
          (x) =>
            `<line x1="${x}" y1="198" x2="${x}" y2="242" stroke="${LINE}" stroke-width="0.8"/>`
        )
        .join('')}
      ${[
        '前回請求高',
        '御入金高',
        '相　　殺',
        '差引残高',
        '当月売上高',
        '消費税額等',
        '差引当月請求高',
      ]
        .map(
          (t, i) =>
            `<text x="${[172, 260, 348, 436, 524, 612, 699][i]}" y="${211}" font-size="8.5" text-anchor="middle" fill="${BLUE}">${t}</text>`
        )
        .join('')}
    </g>

    <text x="128" y="258" font-size="9" fill="#000">※ は軽減税率対象です。</text>

    <!-- 明細ヘッダー -->
    <rect x="${col[0]}" y="${top}" width="${col[8] - col[0]}" height="16" fill="${FILL}" stroke="${LINE}" stroke-width="0.8"/>
    <text x="${(col[0] + col[1]) / 2}" y="${top + 11}" font-size="8.5" text-anchor="middle" fill="#000">月${FW_SPACE}日</text>
    <text x="${(col[1] + col[2]) / 2}" y="${top + 11}" font-size="8.5" text-anchor="middle" fill="#000">伝票№</text>
    <text x="${(col[3] + col[4]) / 2}" y="${top + 11}" font-size="8.5" text-anchor="middle" fill="#000">品${FW_SPACE}名</text>
    <text x="${(col[4] + col[5]) / 2}" y="${top + 11}" font-size="8.5" text-anchor="middle" fill="#000">ケース数</text>
    <text x="${(col[5] + col[6]) / 2}" y="${top + 11}" font-size="8.5" text-anchor="middle" fill="#000">個${FW_SPACE}数</text>
    <text x="${(col[6] + col[7]) / 2}" y="${top + 11}" font-size="8.5" text-anchor="middle" fill="#000">単${FW_SPACE}価</text>
    <text x="${(col[7] + col[8]) / 2}" y="${top + 11}" font-size="8.5" text-anchor="middle" fill="#000">金${FW_SPACE}額</text>

    ${body}
    ${tailSvg}
    ${vlines}
    <rect x="${col[0]}" y="${top}" width="${col[8] - col[0]}" height="${tableBottom - top}" fill="none" stroke="${LINE}" stroke-width="1.2"/>


    <!-- 下部の短い黒線（実物どおり） -->
    <line x1="272" y1="${H - 82}" x2="340" y2="${H - 82}" stroke="#000" stroke-width="2.5"/>

    <text x="128" y="${H - 28}" font-size="9" fill="#9ca3af">- ${pageNo} / ${totalPages} -</text>
  </svg>`);
};

// 横長の請求書（3ページ想定）。ページごとにフッタのページ番号が変わる。
export const INVOICE_LANDSCAPE_PAGES = [
  buildLandscape(1, 3),
  buildLandscape(2, 3),
  buildLandscape(3, 3),
];

// 縦長の請求書（単一ページ）
export const INVOICE_PORTRAIT = buildPortrait(1, 1);

// ───────────────────────────────────────────────
// 見積書（A4縦）
// 一般的な見積書の体裁に合わせている（マネーフォワード等のテンプレート構成を参照）：
//   タイトル「御見積書」／見積No.・発行日（右上）／宛先（左・御中）／
//   発行元（右・社判）／件名／合計金額を大きく枠で強調／
//   明細表（品名・数量・単位・単価・金額）／小計・消費税・合計／
//   有効期限・納期・支払条件などの条件欄／備考欄
// 金額は請求書と同じくガウスぼかしで伏せる。
// ───────────────────────────────────────────────
export interface QuotationLine {
  name: string;
  detail?: string; // 品名の下に出す補足（仕様・期間など）
  qty: number;
  unit: string;
  price: number;
}

interface QuotationSpec {
  quoteNo: string;
  issueDate: string;
  issuer: string;
  issuerAddr: string;
  issuerTel: string;
  issuerRegNo: string;
  seal: string; // 社判に入れる文字（2〜4文字）
  to: string;
  toDept: string;
  subject: string;
  lines: QuotationLine[];
  validUntil: string;
  delivery: string;
  place: string;
  payment: string;
  note?: string[];
}

const yen = (n: number) => '\\' + n.toLocaleString();

const buildQuotation = (q: QuotationSpec) => {
  const W = 826;
  const H = 1169;
  const INK = '#1a1a1a';
  const RULE = '#333333';

  // 明細から積み上げて集計する（小計・消費税10%・合計が必ず整合する）
  const subtotal = q.lines.reduce((s, l) => s + l.qty * l.price, 0);
  const tax = Math.floor(subtotal * 0.1);
  const total = subtotal + tax;

  // 明細表のレイアウト
  const tblX = 62;
  const tblW = W - 124;
  const col = [tblX, 400, 470, 530, 630, tblX + tblW]; // 品名/数量/単位/単価/金額
  const top = 466;
  const headH = 24;
  const rowH = 30;
  const MIN_ROWS = 9; // 実物同様、余白行を引いて表の高さを保つ

  const rowCount = Math.max(q.lines.length, MIN_ROWS);

  let rows = '';
  for (let i = 0; i < rowCount; i++) {
    const y = top + headH + i * rowH;
    const l = q.lines[i];
    rows += `<rect x="${tblX}" y="${y}" width="${tblW}" height="${rowH}" fill="${i % 2 ? '#fafafa' : '#ffffff'}" stroke="${RULE}" stroke-width="0.6"/>`;
    if (l) {
      const hasDetail = !!l.detail;
      // 補足がある行は品名を少し上げ、下に小さく仕様を出す
      const nameY = hasDetail ? y + 13 : y + 19;
      rows += `<text x="${col[0] + 10}" y="${nameY}" font-size="11" fill="${INK}">${l.name}</text>`;
      if (hasDetail) {
        rows += `<text x="${col[0] + 10}" y="${y + 25}" font-size="8.5" fill="#666">${l.detail}</text>`;
      }
      rows += `
        <text x="${col[2] - 8}" y="${y + 19}" font-size="11" text-anchor="end" fill="${INK}">${l.qty.toLocaleString()}</text>
        <text x="${(col[2] + col[3]) / 2}" y="${y + 19}" font-size="10" text-anchor="middle" fill="${INK}">${l.unit}</text>
        <text x="${col[4] - 8}" y="${y + 19}" font-size="11" text-anchor="end" fill="${INK}" filter="url(#soft)">${l.price.toLocaleString()}</text>
        <text x="${col[5] - 10}" y="${y + 19}" font-size="11" text-anchor="end" fill="${INK}" filter="url(#soft)">${(l.qty * l.price).toLocaleString()}</text>`;
    }
  }

  const tblBottom = top + headH + rowCount * rowH;

  // 縦罫線
  const vlines = col
    .map(
      (x) =>
        `<line x1="${x}" y1="${top}" x2="${x}" y2="${tblBottom}" stroke="${RULE}" stroke-width="0.6"/>`
    )
    .join('');

  // 小計・消費税・合計（明細表の右下に続けて出す）
  const sumRows: [string, number, boolean][] = [
    ['小　計', subtotal, false],
    ['消費税（10%）', tax, false],
    ['合　計', total, true],
  ];
  let sumSvg = '';
  sumRows.forEach(([label, val, bold], i) => {
    const y = tblBottom + i * 28;
    sumSvg += `
      <rect x="${col[3]}" y="${y}" width="${col[5] - col[3]}" height="28" fill="${bold ? '#f0f0f0' : '#ffffff'}" stroke="${RULE}" stroke-width="0.6"/>
      <line x1="${col[4]}" y1="${y}" x2="${col[4]}" y2="${y + 28}" stroke="${RULE}" stroke-width="0.6"/>
      <text x="${(col[3] + col[4]) / 2}" y="${y + 18}" font-size="10.5" text-anchor="middle" fill="${INK}" ${bold ? 'font-weight="bold"' : ''}>${label}</text>
      <text x="${col[5] - 10}" y="${y + 18}" font-size="${bold ? 12 : 11}" text-anchor="end" fill="${INK}" ${bold ? 'font-weight="bold"' : ''} filter="url(#soft)">${yen(val)}</text>`;
  });

  const condTop = tblBottom + 3 * 28 + 34;

  // 条件欄（有効期限・納期・納入場所・支払条件）
  const conds: [string, string][] = [
    ['見積有効期限', q.validUntil],
    ['納　　期', q.delivery],
    ['納入場所', q.place],
    ['お支払条件', q.payment],
  ];
  const condSvg = conds
    .map(([k, v], i) => {
      const y = condTop + i * 24;
      return `
      <rect x="${tblX}" y="${y}" width="150" height="24" fill="#f5f5f5" stroke="${RULE}" stroke-width="0.6"/>
      <rect x="${tblX + 150}" y="${y}" width="330" height="24" fill="#ffffff" stroke="${RULE}" stroke-width="0.6"/>
      <text x="${tblX + 75}" y="${y + 16}" font-size="10" text-anchor="middle" fill="${INK}">${k}</text>
      <text x="${tblX + 160}" y="${y + 16}" font-size="10" fill="${INK}">${v}</text>`;
    })
    .join('');

  const noteTop = condTop + conds.length * 24 + 22;
  const noteSvg = `
    <text x="${tblX}" y="${noteTop}" font-size="10" font-weight="bold" fill="${INK}">備考</text>
    <rect x="${tblX}" y="${noteTop + 8}" width="${tblW}" height="76" fill="#ffffff" stroke="${RULE}" stroke-width="0.6"/>
    ${(q.note ?? [])
      .map(
        (n, i) =>
          `<text x="${tblX + 12}" y="${noteTop + 30 + i * 18}" font-size="9.5" fill="${INK}">${n}</text>`
      )
      .join('')}`;

  return svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${BLUR_DEFS}
    <rect width="${W}" height="${H}" fill="#ffffff"/>

    <!-- タイトル -->
    <text x="${W / 2}" y="92" font-size="26" font-weight="bold" letter-spacing="14" text-anchor="middle" fill="${INK}">御${FW_SPACE}見${FW_SPACE}積${FW_SPACE}書</text>
    <line x1="${W / 2 - 130}" y1="104" x2="${W / 2 + 130}" y2="104" stroke="${INK}" stroke-width="1.4"/>

    <!-- 右上：見積No.／発行日 -->
    <text x="${W - 62}" y="132" font-size="10" text-anchor="end" fill="${INK}">見積No.${FW_SPACE}${q.quoteNo}</text>
    <text x="${W - 62}" y="150" font-size="10" text-anchor="end" fill="${INK}">発行日${FW_SPACE}${FW_SPACE}${q.issueDate}</text>

    <!-- 宛先 -->
    <text x="62" y="150" font-size="14" font-weight="bold" fill="${INK}">${q.to}</text>
    <text x="62" y="172" font-size="11" fill="${INK}">${q.toDept}</text>
    <line x1="62" y1="182" x2="430" y2="182" stroke="${INK}" stroke-width="0.8"/>

    <!-- 発行元（右） -->
    <text x="${W - 62}" y="188" font-size="12.5" font-weight="bold" text-anchor="end" fill="${INK}">${q.issuer}</text>
    <text x="${W - 62}" y="206" font-size="9.5" text-anchor="end" fill="${INK}">${q.issuerAddr}</text>
    <text x="${W - 62}" y="221" font-size="9.5" text-anchor="end" fill="${INK}">TEL ${q.issuerTel}</text>
    <text x="${W - 62}" y="236" font-size="9.5" text-anchor="end" fill="${INK}">登録番号 ${q.issuerRegNo}</text>
    <!-- 社判（角印を模した二重丸）。住所・TEL の文字に重ならないよう左側に置く -->
    <circle cx="452" cy="212" r="27" fill="none" stroke="#c0392b" stroke-width="1.6" opacity="0.7"/>
    <circle cx="452" cy="212" r="23" fill="none" stroke="#c0392b" stroke-width="0.8" opacity="0.7"/>
    ${q.seal
      .split('\n')
      .map(
        (s, i, a) =>
          `<text x="452" y="${212 + (i - (a.length - 1) / 2) * 13 + 4}" font-size="11" text-anchor="middle" fill="#c0392b" opacity="0.75">${s}</text>`
      )
      .join('')}

    <text x="62" y="214" font-size="11" fill="${INK}">下記のとおりお見積り申し上げます。</text>

    <!-- 件名 -->
    <rect x="62" y="238" width="150" height="28" fill="#f5f5f5" stroke="${RULE}" stroke-width="0.6"/>
    <rect x="212" y="238" width="380" height="28" fill="#ffffff" stroke="${RULE}" stroke-width="0.6"/>
    <text x="137" y="257" font-size="10.5" text-anchor="middle" fill="${INK}">件${FW_SPACE}${FW_SPACE}名</text>
    <text x="224" y="257" font-size="10.5" fill="${INK}">${q.subject}</text>

    <!-- 合計金額（大きく強調） -->
    <rect x="62" y="286" width="${tblW}" height="62" fill="#f7f7f7" stroke="${INK}" stroke-width="1.6"/>
    <text x="86" y="324" font-size="14" font-weight="bold" fill="${INK}">御見積金額（税込）</text>
    <text x="${W - 86}" y="328" font-size="26" font-weight="bold" text-anchor="end" fill="${INK}" filter="url(#soft-lg)">${yen(total)}</text>
    <text x="86" y="370" font-size="9" fill="#666">※本見積書は消費税率10%にて算出しております。</text>

    <!-- 明細表ヘッダー -->
    <rect x="${tblX}" y="${top}" width="${tblW}" height="${headH}" fill="#e8e8e8" stroke="${RULE}" stroke-width="0.8"/>
    <text x="${(col[0] + col[1]) / 2}" y="${top + 16}" font-size="10.5" text-anchor="middle" fill="${INK}">品名・仕様</text>
    <text x="${(col[1] + col[2]) / 2}" y="${top + 16}" font-size="10.5" text-anchor="middle" fill="${INK}">数量</text>
    <text x="${(col[2] + col[3]) / 2}" y="${top + 16}" font-size="10.5" text-anchor="middle" fill="${INK}">単位</text>
    <text x="${(col[3] + col[4]) / 2}" y="${top + 16}" font-size="10.5" text-anchor="middle" fill="${INK}">単価</text>
    <text x="${(col[4] + col[5]) / 2}" y="${top + 16}" font-size="10.5" text-anchor="middle" fill="${INK}">金額</text>

    ${rows}
    ${vlines}
    <rect x="${tblX}" y="${top}" width="${tblW}" height="${tblBottom - top}" fill="none" stroke="${RULE}" stroke-width="1.2"/>

    ${sumSvg}
    ${condSvg}
    ${noteSvg}
  </svg>`);
};

// 【1】ロケ運転費（オペレータ→アサヒ飲料）
export const QUOTATION_LOCATION_OPERATION = buildQuotation({
  quoteNo: 'CVS-2025-0713',
  issueDate: '2025年6月25日',
  issuer: '株式会社サンプルベンディング　東営業所',
  issuerAddr: '東京都〇〇区〇〇1-2-3',
  issuerTel: '03-0000-1234',
  issuerRegNo: 'T0000000000001',
  seal: 'サンプル\n東',
  to: 'アサヒ飲料株式会社　御中',
  toDept: '首都圏支社　首都圏営業第一部',
  subject: '自動販売機運営業務委託料（2025年7月分）',
  lines: [
    {
      name: '定期巡回補充業務',
      detail: '週2回巡回・商品補充および在庫確認／対象12台',
      qty: 12,
      unit: '台',
      price: 1200,
    },
    {
      name: '釣銭補充・金銭回収業務',
      detail: '釣銭準備金の補充および売上金回収・入金代行',
      qty: 12,
      unit: '台',
      price: 300,
    },
    {
      name: '機器清掃・軽微メンテナンス',
      detail: '外装清掃、商品見本の整備、消耗部品の交換',
      qty: 12,
      unit: '台',
      price: 150,
    },
    {
      name: '緊急対応（故障対応）',
      detail: '受付から4時間以内の現地対応（時間外を除く）',
      qty: 1,
      unit: '件',
      price: 200,
    },
  ],
  validUntil: '発行日より30日間',
  delivery: '2025年7月1日 ～ 2025年7月31日',
  place: '貴社指定の設置ロケーション（12ヶ所）',
  payment: '月末締め翌月末日　銀行振込',
  note: [
    '・上記は2025年7月分の運営業務に係る委託料です。設置台数の増減が生じた場合は、翌月分にて精算いたします。',
    '・自然災害・事故等による特別対応が発生した場合は、別途お見積りいたします。',
    '・商品仕入代金および電気料金は本見積に含まれておりません。',
  ],
});

// 【2】ロケ契約料他前払金（施設管理会社→アサヒ飲料）
export const QUOTATION_LOCATION_CONTRACT = buildQuotation({
  quoteNo: 'AZ-2025-0286',
  issueDate: '2025年7月10日',
  issuer: '株式会社ダミーストア　本部',
  issuerAddr: '東京都〇〇区〇〇4-5-6',
  issuerTel: '03-0000-7700',
  issuerRegNo: 'T0000000000003',
  seal: 'ダミー\nストア',
  to: 'アサヒ飲料株式会社　御中',
  toDept: '首都圏支社　首都圏営業第一部',
  subject: '自動販売機設置に伴う契約一時金',
  lines: [
    {
      name: '設置場所使用契約一時金',
      detail: '契約期間：2025年8月1日～2028年8月31日（3年分）',
      qty: 1,
      unit: '式',
      price: 100000,
    },
    {
      name: '電源工事負担金',
      detail: '専用回路増設および分電盤改修に係る工事負担金',
      qty: 1,
      unit: '式',
      price: 15000,
    },
    {
      name: '設置基礎工事費',
      detail: '設置面コンクリート基礎打設・転倒防止金具設置',
      qty: 1,
      unit: '式',
      price: 5000,
    },
  ],
  validUntil: '2025年7月31日',
  delivery: '2025年8月1日（設置予定日）',
  place: 'ダミーストア〇〇店　店舗入口脇',
  payment: '契約締結後、請求書発行より30日以内　銀行振込（前払）',
  note: [
    '・契約期間は3年とし、中途解約の場合は未経過分を月割にて返金いたします。',
    '・電気料金は実費精算とし、本見積には含まれておりません。',
    '・工事日程は貴社および当社の立会日程を調整のうえ確定いたします。',
  ],
});

// ───────────────────────────────────────────────
// 稟議書（A4縦）
// **社内文書**のため社外文書とは体裁が異なる：
//   - 宛先（御中）は書かない。代わりに上部に押印式の決裁ライン欄を置く
//   - 発行元・住所・TEL・インボイス登録番号も不要
//   - 稟議番号／起案日／決裁日を必ず出す（要件のアウトプットイメージ③項目詳細 No.58/60 に対応）
//   - 金額は印字しない（欄自体を設けない）
// ───────────────────────────────────────────────
interface ApprovalSpec {
  docNo: string; // 稟議番号
  draftDate: string; // 起案日
  decisionDate: string; // 決裁日
  drafter: string; // 起案者（部署＋役割）
  approvers: string[]; // 決裁ライン（左から順に承認）
  subject: string; // 件名
  payee: string; // 支払先
  period: string; // 契約期間・委託期間
  reasons: string[]; // 稟議理由
  attachments: string[]; // 添付資料
}

const buildApproval = (a: ApprovalSpec) => {
  const W = 826;
  const H = 1169;
  const INK = '#1a1a1a';
  const RULE = '#333333';
  const L = 62; // 左マージン
  const CW = W - 124; // 本文幅

  // 決裁欄（右上）。起案者＋決裁ラインを押印枠で並べる。
  // タイトルと重ならないよう、枠はタイトルより下（y=140〜）に置く。
  const boxW = 88;
  const boxH = 62;
  const stampTop = 142;
  const cells = ['起案', ...a.approvers];
  const stampX = W - L - boxW * cells.length;
  const stamp = cells
    .map((label, i) => {
      const x = stampX + i * boxW;
      return `
      <rect x="${x}" y="${stampTop}" width="${boxW}" height="18" fill="#f0f0f0" stroke="${RULE}" stroke-width="0.7"/>
      <rect x="${x}" y="${stampTop + 18}" width="${boxW}" height="${boxH}" fill="#ffffff" stroke="${RULE}" stroke-width="0.7"/>
      <text x="${x + boxW / 2}" y="${stampTop + 13}" font-size="8.5" text-anchor="middle" fill="${INK}">${label}</text>
      <circle cx="${x + boxW / 2}" cy="${stampTop + 18 + boxH / 2}" r="19" fill="none" stroke="#c0392b" stroke-width="1.2" opacity="0.6"/>
      <text x="${x + boxW / 2}" y="${stampTop + 18 + boxH / 2 + 4}" font-size="9" text-anchor="middle" fill="#c0392b" opacity="0.65">承認</text>`;
    })
    .join('');

  // 本文の項目欄
  const rows: [string, string][] = [
    ['件　　名', a.subject],
    ['支　払　先', a.payee],
    ['契約／委託期間', a.period],
    ['起　案　者', a.drafter],
  ];
  let y = 258; // 決裁欄（〜222）より下から本文を始める
  const info = rows
    .map(([k, v]) => {
      const h = 34;
      const seg = `
      <rect x="${L}" y="${y}" width="150" height="${h}" fill="#f5f5f5" stroke="${RULE}" stroke-width="0.7"/>
      <rect x="${L + 150}" y="${y}" width="${CW - 150}" height="${h}" fill="#ffffff" stroke="${RULE}" stroke-width="0.7"/>
      <text x="${L + 75}" y="${y + 22}" font-size="10.5" text-anchor="middle" fill="${INK}">${k}</text>
      <text x="${L + 162}" y="${y + 22}" font-size="10.5" fill="${INK}">${v}</text>`;
      y += h;
      return seg;
    })
    .join('');

  // 稟議理由。実物同様、記入欄には余白を持たせる（最低8行ぶん）。
  const reasonTop = y + 30;
  const reasonLines = Math.max(a.reasons.length, 8);
  const reasonH = 24 + reasonLines * 26 + 12;
  const reason = `
    <rect x="${L}" y="${reasonTop}" width="${CW}" height="24" fill="#f0f0f0" stroke="${RULE}" stroke-width="0.7"/>
    <text x="${L + 10}" y="${reasonTop + 16}" font-size="10.5" font-weight="bold" fill="${INK}">稟議理由</text>
    <rect x="${L}" y="${reasonTop + 24}" width="${CW}" height="${reasonH - 24}" fill="#ffffff" stroke="${RULE}" stroke-width="0.7"/>
    ${a.reasons
      .map(
        (r, i) =>
          `<text x="${L + 14}" y="${reasonTop + 48 + i * 26}" font-size="10" fill="${INK}">${i + 1}．${r}</text>`
      )
      .join('')}`;

  // 添付資料
  const attachTop = reasonTop + reasonH + 26;
  const attachH = 24 + Math.max(a.attachments.length, 4) * 24 + 12;
  const attach = `
    <rect x="${L}" y="${attachTop}" width="${CW}" height="24" fill="#f0f0f0" stroke="${RULE}" stroke-width="0.7"/>
    <text x="${L + 10}" y="${attachTop + 16}" font-size="10.5" font-weight="bold" fill="${INK}">添付資料</text>
    <rect x="${L}" y="${attachTop + 24}" width="${CW}" height="${attachH - 24}" fill="#ffffff" stroke="${RULE}" stroke-width="0.7"/>
    ${a.attachments
      .map(
        (t, i) =>
          `<text x="${L + 14}" y="${attachTop + 46 + i * 24}" font-size="10" fill="${INK}">・${t}</text>`
      )
      .join('')}`;

  return svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#ffffff"/>

    <!-- 社内文書のため社名は右上の小さな表記のみ。宛先（御中）は書かない -->
    <text x="${L}" y="60" font-size="10" fill="#555">アサヒ飲料株式会社</text>

    <!-- タイトル -->
    <text x="${W / 2}" y="112" font-size="24" font-weight="bold" letter-spacing="12" text-anchor="middle" fill="${INK}">稟${FW_SPACE}議${FW_SPACE}書</text>
    <line x1="${W / 2 - 108}" y1="124" x2="${W / 2 + 108}" y2="124" stroke="${INK}" stroke-width="1.4"/>

    <!-- 決裁欄（押印式） -->
    ${stamp}

    <!-- 稟議番号・起案日・決裁日 -->
    <text x="${L}" y="160" font-size="10.5" fill="${INK}">稟議番号：${a.docNo}</text>
    <text x="${L}" y="180" font-size="10.5" fill="${INK}">起案日${FW_SPACE}：${a.draftDate}</text>
    <text x="${L}" y="200" font-size="10.5" fill="${INK}">決裁日${FW_SPACE}：${a.decisionDate}</text>

    ${info}
    ${reason}
    ${attach}

    <text x="${L}" y="${H - 44}" font-size="9" fill="#666">※本稟議は電子稟議システムにて申請・決裁を行う。</text>
  </svg>`);
};

// 【1】ロケ契約料（設置場所の新規契約）
export const APPROVAL_LOCATION_CONTRACT = buildApproval({
  docNo: 'RG-2025-0713',
  draftDate: '2025年7月10日',
  decisionDate: '2025年7月18日',
  drafter: '首都圏営業第一部　営業担当',
  approvers: ['グループリーダー', '部長', '本部長'],
  subject: '自動販売機ロケーション新規契約締結の件',
  payee: '株式会社ダミーストア　本部',
  period: '2025年8月　～　2028年8月（3年）',
  reasons: [
    '当該ビルは就業人口約800名であり、既存の競合機は1台のみである。',
    '想定月間販売本数は1,200本を見込む。',
    '投資回収見込みは約14ヶ月であり、採算性に問題はない。',
    '中途解約時は未経過分を月割で返金できる条項を付与済みである。',
  ],
  attachments: ['見積書', '設置場所図面', '販売数量シミュレーション'],
});

// 【2】ロケ運転費（運営業務委託の年次更新）
export const APPROVAL_LOCATION_OPERATION = buildApproval({
  docNo: 'RG-2025-0689',
  draftDate: '2025年6月25日',
  decisionDate: '2025年6月30日',
  drafter: '首都圏営業第一部　営業担当',
  approvers: ['グループリーダー', '部長'],
  subject: '自動販売機運営業務委託契約　年次更新の件',
  payee: '株式会社サンプルベンディング　東営業所',
  period: '2025年7月　～　2026年6月（12ヶ月）',
  reasons: [
    '既存委託先との年次更新である。管理台数は12台。',
    '巡回単価を前年1,150円から1,200円に改定する（前年比4.3%増）。',
    '改定理由は燃料費および人件費の上昇による。',
    '他社2社から相見積を取得したが、緊急対応体制と実績を勘案し継続とする。',
  ],
  attachments: ['見積書', '前年実績報告書', '相見積比較表'],
});

// 見積書・稟議書などサムネ用に使う汎用の帳票イメージ（プレースホルダ）
export const GENERIC_DOCUMENT = svgToDataUri(
  `<svg xmlns="http://www.w3.org/2000/svg" width="842" height="1191" viewBox="0 0 842 1191">
    <rect width="842" height="1191" fill="#ffffff"/>
    <rect x="56" y="68" width="300" height="30" fill="#4b5563"/>
    <rect x="536" y="68" width="248" height="16" fill="#9ca3af"/>
    <rect x="536" y="96" width="192" height="16" fill="#9ca3af"/>
    <rect x="56" y="184" width="728" height="3" fill="#d1d5db"/>
    <rect x="56" y="224" width="240" height="20" fill="#6b7280"/>
    <rect x="56" y="300" width="728" height="44" fill="#eef2ff"/>
    ${Array.from({ length: 12 }, (_, i) => {
      const y = 344 + i * 44;
      return `<rect x="56" y="${y}" width="728" height="44" fill="${i % 2 ? '#f9fafb' : '#ffffff'}"/>
      <rect x="76" y="${y + 16}" width="192" height="14" fill="#d1d5db"/>
      <rect x="336" y="${y + 16}" width="128" height="14" fill="#d1d5db"/>
      <rect x="600" y="${y + 16}" width="160" height="14" fill="#d1d5db"/>`;
    }).join('')}
    <rect x="56" y="300" width="728" height="572" fill="none" stroke="#d1d5db" stroke-width="3"/>
    <rect x="464" y="924" width="320" height="68" fill="#eef2ff" stroke="#c7d2fe" stroke-width="3"/>
    <rect x="488" y="948" width="104" height="20" fill="#6b7280"/>
    <rect x="640" y="948" width="120" height="20" fill="#374151"/>
    <rect x="56" y="1060" width="360" height="16" fill="#e5e7eb"/>
    <rect x="56" y="1096" width="280" height="16" fill="#e5e7eb"/>
  </svg>`
);
