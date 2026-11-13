import { Fragment, type ReactNode } from 'react';
import type {
  NoticeInline,
  NoticeRun,
  NoticeImg,
  NoticeBlock,
} from '@/app/components/master/notice-admin/useNotices';

// ===== お知らせ本文ロジック集約モジュール =====
// 本文に関する「描画(React)」と「HTML⇔ブロックのシリアライズ」を1ファイルに集約。
// - 描画系（renderNoticeBody 等）: メンテ画面プレビューが使用（useNotices が再エクスポート）。
// - シリアライズ系（blocksToHtml/htmlToBlocks 等）: メンテ画面のリッチ本文エディタが使用。
// 型は useNotices から型のみ import（実行時依存なし＝循環参照は発生しない）。

// インライン画像セグメントかどうかの判定
const isImgSeg = (seg: NoticeInline): seg is NoticeImg =>
  typeof seg === 'object' && seg !== null && 'img' in seg;

// ---------- 描画ヘルパ ----------
export const inlineToText = (seg: NoticeInline): string =>
  typeof seg === 'string'
    ? seg
    : isImgSeg(seg)
      ? '' // インライン画像はプレビュー文言に含めない
      : seg.text;

export const bodyPreviewText = (body: NoticeBlock[]): string => {
  // 先頭のテキストを含むブロックからプレビュー文言を取る
  // （単独画像ブロック・画像インラインだけの段落は飛ばす）
  const textOf = (b: NoticeBlock): string => {
    if (b.type === 'img') return '';
    const segs =
      b.type === 'bullets' || b.type === 'ol' ? (b.items[0] ?? []) : b.content;
    return segs.map(inlineToText).join('');
  };
  for (const b of body) {
    const t = textOf(b);
    if (t.trim() !== '') return t;
  }
  return '［画像］';
};

export const renderInline = (seg: NoticeInline, i: number): ReactNode => {
  if (typeof seg === 'string') return <span key={i}>{seg}</span>;
  if (isImgSeg(seg))
    return (
      // 規約例外（可変サイズの画像）：大きさが画像ごとに違うため width／height は付けず、枠の大きさを CSS で決める
      <img
        key={i}
        loading="lazy"
        src={seg.img}
        alt={seg.alt ?? ''}
        // 本文エディタ（globals.css の .notice-editor img）と表示を揃える
        className="inline-block align-bottom max-w-full max-h-50 w-auto h-auto object-contain rounded border border-gray-200 m-[0.15rem]"
      />
    );
  let content: ReactNode = seg.text;
  if (seg.b) content = <strong className="font-bold">{content}</strong>;
  if (seg.i) content = <em>{content}</em>;
  if (seg.u) content = <u>{content}</u>;
  if (seg.s) content = <s>{content}</s>;
  if (seg.url)
    content = (
      <a
        href={seg.url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        className="text-blue-600 hover:text-blue-800 underline decoration-blue-300 break-words"
      >
        {content}
      </a>
    );
  return <Fragment key={i}>{content}</Fragment>;
};

// 箇条書き・番号付きリストの共通 className（マーカーは外側に表示）
const LIST_CLASS =
  'pl-5 space-y-0.5 text-xs text-gray-700 leading-normal list-outside';

export const renderNoticeBody = (body: NoticeBlock[]) =>
  body.map((block, bi) => {
    if (block.type === 'bullets')
      return (
        <ul key={bi} className={`${LIST_CLASS} list-disc`}>
          {block.items.map((it, ii) => (
            <li key={ii} className="list-item">
              {it.map(renderInline)}
            </li>
          ))}
        </ul>
      );
    if (block.type === 'ol')
      return (
        <ol key={bi} className={`${LIST_CLASS} list-decimal`}>
          {block.items.map((it, ii) => (
            <li key={ii} className="list-item">
              {it.map(renderInline)}
            </li>
          ))}
        </ol>
      );
    if (block.type === 'quote')
      return (
        <blockquote
          key={bi}
          className="border-l-4 border-gray-300 pl-3 py-0.5 text-xs text-gray-600 italic leading-normal whitespace-pre-line"
        >
          {block.content.map(renderInline)}
        </blockquote>
      );
    if (block.type === 'img')
      return (
        // 規約例外（可変サイズの画像）：大きさが画像ごとに違うため width／height は付けず、枠の大きさを CSS で決める
        <img
          key={bi}
          loading="lazy"
          src={block.src}
          alt={block.alt ?? ''}
          className="max-w-full max-h-50 w-auto h-auto object-contain rounded border border-gray-200 my-1"
        />
      );
    return (
      <p
        key={bi}
        className="text-xs text-gray-700 leading-normal whitespace-pre-line"
      >
        {block.content.map(renderInline)}
      </p>
    );
  });

// ---------- 本文 ⇔ HTML シリアライズ（マーク統合・許可リスト方式） ----------
export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const runToHtml = (seg: NoticeInline): string => {
  if (typeof seg === 'string') return esc(seg).replace(/\n/g, '<br>');
  if (isImgSeg(seg))
    // 規約例外（可変サイズの画像）：大きさが画像ごとに違うため width／height は付けず、枠の大きさを CSS で決める
    return `<img loading="lazy" src="${seg.img.replace(/"/g, '%22')}" alt="${esc(seg.alt ?? '')}" contenteditable="false">`;
  let h = esc(seg.text).replace(/\n/g, '<br>');
  if (seg.b) h = `<strong>${h}</strong>`;
  if (seg.i) h = `<em>${h}</em>`;
  if (seg.u) h = `<u>${h}</u>`;
  if (seg.s) h = `<s>${h}</s>`;
  if (seg.url) h = `<a href="${seg.url.replace(/"/g, '%22')}">${h}</a>`;
  return h;
};

export const blocksToHtml = (blocks: NoticeBlock[]): string =>
  blocks
    .map((b) => {
      if (b.type === 'bullets')
        return `<ul>${b.items.map((it) => `<li>${it.map(runToHtml).join('') || '<br>'}</li>`).join('')}</ul>`;
      if (b.type === 'ol')
        return `<ol>${b.items.map((it) => `<li>${it.map(runToHtml).join('') || '<br>'}</li>`).join('')}</ol>`;
      if (b.type === 'quote')
        return `<blockquote>${b.content.map(runToHtml).join('') || '<br>'}</blockquote>`;
      if (b.type === 'img')
        // 規約例外（可変サイズの画像）：大きさが画像ごとに違うため width／height は付けず、枠の大きさを CSS で決める
        return `<img loading="lazy" src="${b.src.replace(/"/g, '%22')}" alt="${esc(b.alt ?? '')}">`;
      return `<div>${b.content.map(runToHtml).join('') || '<br>'}</div>`;
    })
    .join('');

const normalizeInlines = (arr: NoticeInline[]): NoticeInline[] => {
  const out: NoticeInline[] = [];
  arr.forEach((seg) => {
    if (typeof seg === 'string') {
      if (seg === '') return;
      const last = out[out.length - 1];
      if (typeof last === 'string') out[out.length - 1] = last + seg;
      else out.push(seg);
    } else if (isImgSeg(seg)) {
      // インライン画像はそのまま保持（結合しない）
      out.push(seg);
    } else {
      if (seg.text === '') return;
      out.push(seg);
    }
  });
  return out.length ? out : [''];
};

interface MarkContext {
  b?: boolean;
  i?: boolean;
  u?: boolean;
  s?: boolean;
  url?: string;
}
const serializeInlines = (nodes: Node[]): NoticeInline[] => {
  const out: NoticeInline[] = [];
  const emit = (text: string, ctx: MarkContext) => {
    if (text === '') return;
    const marked = ctx.b || ctx.i || ctx.u || ctx.s || ctx.url;
    if (!marked) {
      const last = out[out.length - 1];
      if (typeof last === 'string') out[out.length - 1] = last + text;
      else out.push(text);
      return;
    }
    const run: NoticeRun = { text };
    if (ctx.b) run.b = true;
    if (ctx.i) run.i = true;
    if (ctx.u) run.u = true;
    if (ctx.s) run.s = true;
    if (ctx.url) run.url = ctx.url;
    out.push(run);
  };
  const walk = (node: Node, ctx: MarkContext) => {
    if (node.nodeType === 3) {
      // nbsp(U+00A0)→半角スペースへ正規化（contenteditable やリンク挿入後の &nbsp; をプレーン化）
      emit((node.nodeValue || '').replace(/\u00A0/g, ' '), ctx);
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'br') {
      emit('\n', ctx);
      return;
    }
    if (tag === 'img') {
      // 段落内の画像はインライン画像セグメントとして出力する
      const src = el.getAttribute('src') || '';
      if (src)
        out.push({
          img: src,
          alt: el.getAttribute('alt') || undefined,
        });
      return;
    }
    const next: MarkContext = { ...ctx };
    if (tag === 'b' || tag === 'strong') next.b = true;
    else if (tag === 'i' || tag === 'em') next.i = true;
    else if (tag === 'u') next.u = true;
    else if (tag === 's' || tag === 'strike' || tag === 'del') next.s = true;
    else if (tag === 'a')
      next.url =
        el.getAttribute('href') || el.getAttribute('data-url') || ctx.url;
    else if (tag === 'span' || tag === 'font') {
      const st = el.style;
      if (st) {
        const fw = st.fontWeight;
        if (fw === 'bold' || fw === '700' || fw === '800' || fw === '900')
          next.b = true;
        if (st.fontStyle === 'italic') next.i = true;
        const td = st.textDecoration || '';
        if (/underline/.test(td)) next.u = true;
        if (/line-through/.test(td)) next.s = true;
      }
    }
    Array.from(el.childNodes).forEach((c) => walk(c, next));
  };
  nodes.forEach((n) => walk(n, {}));
  return out;
};

export const htmlToBlocks = (root: HTMLElement): NoticeBlock[] => {
  const blocks: NoticeBlock[] = [];
  let buffer: Node[] = [];
  const flush = () => {
    if (buffer.length) {
      blocks.push({
        type: 'p',
        content: normalizeInlines(serializeInlines(buffer)),
      });
      buffer = [];
    }
  };
  const liItems = (el: HTMLElement) =>
    Array.from(el.children)
      .filter((li) => li.tagName.toLowerCase() === 'li')
      .map((li) =>
        normalizeInlines(serializeInlines(Array.from(li.childNodes)))
      );
  Array.from(root.childNodes).forEach((node) => {
    if (node.nodeType === 1) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === 'ul') {
        flush();
        const items = liItems(el);
        blocks.push({ type: 'bullets', items: items.length ? items : [['']] });
        return;
      }
      if (tag === 'ol') {
        flush();
        const items = liItems(el);
        blocks.push({ type: 'ol', items: items.length ? items : [['']] });
        return;
      }
      if (tag === 'blockquote') {
        flush();
        blocks.push({
          type: 'quote',
          content: normalizeInlines(
            serializeInlines(Array.from(el.childNodes))
          ),
        });
        return;
      }
      if (tag === 'img') {
        // editor 直下の画像も、単独ブロックに分離せず buffer に積んで
        // 前後のテキスト・インラインと同じ段落にまとめる。
        // これにより「画像の横に文字」がプレビューでも横並びで再現される。
        buffer.push(node);
        return;
      }
      if (tag === 'div' || tag === 'p') {
        flush();
        // 段落内の画像はインライン画像セグメントとして段落に含める
        // （serializeInlines が img を拾う）。画像と文字が同じ行に共存できる。
        blocks.push({
          type: 'p',
          content: normalizeInlines(
            serializeInlines(Array.from(el.childNodes))
          ),
        });
        return;
      }
      buffer.push(node);
      return;
    }
    if (node.nodeType === 3) buffer.push(node);
  });
  flush();
  return blocks.length ? blocks : [{ type: 'p', content: [''] }];
};

// セグメントに中身があるか（テキストあり、またはインライン画像）
const segHasContent = (s: NoticeInline): boolean =>
  isImgSeg(s) ? !!s.img : inlineToText(s).trim() !== '';

export const bodyHasContent = (body: NoticeBlock[]): boolean =>
  body.some((b) => {
    if (b.type === 'img') return !!b.src; // 画像があれば内容ありとみなす
    if (b.type === 'p' || b.type === 'quote')
      return b.content.some(segHasContent);
    return b.items.some((it) => it.some(segHasContent));
  });
