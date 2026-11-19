import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Image as ImageIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FORM_LABEL_CLASS, TEXT_INPUT_CLASS } from '@/styles/commonStyles';
import type { NoticeBlock } from '@/features/master/notice-admin/useNotices';
import { blocksToHtml, htmlToBlocks, esc } from './NoticeBody';

// ===== リンク挿入ダイアログ =====
interface LinkInsertDialogProps {
  open: boolean;
  // 既存のリンクを編集するとき true（見出し・ボタン名を「編集」「更新」にする）
  isEdit: boolean;
  text: string;
  url: string;
  onText: (v: string) => void;
  onUrl: (v: string) => void;
  onCancel: () => void;
  onInsert: () => void;
}

function LinkInsertDialog({
  open,
  isEdit,
  text,
  url,
  onText,
  onUrl,
  onCancel,
  onInsert,
}: LinkInsertDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="max-w-90">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-gray-900">
            {isEdit ? 'リンクを編集' : 'リンクを挿入'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label
              htmlFor="notice-link-text"
              className={`block mb-1 ${FORM_LABEL_CLASS}`}
            >
              表示名
            </label>
            <Input
              id="notice-link-text"
              value={text}
              onChange={(e) => onText(e.target.value)}
              placeholder="リンクの表示テキスト"
              className={TEXT_INPUT_CLASS}
            />
          </div>
          <div>
            <label
              htmlFor="notice-link-url"
              className={`block mb-1 ${FORM_LABEL_CLASS}`}
            >
              URL
            </label>
            <Input
              id="notice-link-url"
              value={url}
              onChange={(e) => onUrl(e.target.value)}
              placeholder="https://..."
              className={TEXT_INPUT_CLASS}
            />
          </div>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={onCancel}
            className="btn-action-base btn-action-outline"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onInsert}
            className="btn-action-base btn-action-blue"
          >
            {isEdit ? '更新' : '挿入'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ツールバーボタン
interface ToolbarButtonProps {
  onClick: () => void;
  title: string;
  children: ReactNode;
  // active=true のとき、現在のカーソル位置がこの装飾（太字など）になっている＝
  // 押された状態としてハイライト表示する。
  active?: boolean;
}

function ToolbarButton({
  onClick,
  title,
  children,
  active = false,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-pressed={active}
      aria-label={title}
      className={`p-1.5 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        active
          ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
          : 'text-gray-700 hover:bg-gray-200'
      }`}
      title={title}
    >
      {children}
    </button>
  );
}

// ツールバーの装飾ボタンのアクティブ状態
interface Marks {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
  insertUnorderedList: boolean;
  insertOrderedList: boolean;
  blockquote: boolean;
}
const EMPTY_MARKS: Marks = {
  bold: false,
  italic: false,
  underline: false,
  strikeThrough: false,
  insertUnorderedList: false,
  insertOrderedList: false,
  blockquote: false,
};
// 選んだ文字に付ける装飾（文字を選ばずに押すと、これから入力する文字に付く）
const INLINE_MARKS = ['bold', 'italic', 'underline', 'strikeThrough'] as const;
type InlineMark = (typeof INLINE_MARKS)[number];

// node の祖先（node 自身を含む）のうち、editor 内のリンクを返す（無ければ null）
const ancestorLink = (
  start: Node | null,
  editor: HTMLElement
): HTMLAnchorElement | null => {
  let node: Node | null = start;
  while (node && node !== editor) {
    if (
      node.nodeType === 1 &&
      (node as HTMLElement).tagName.toLowerCase() === 'a'
    ) {
      return node as HTMLAnchorElement;
    }
    node = node.parentNode;
  }
  return null;
};

// ドロップ位置からキャレット range を得るための API（ブラウザにより片方のみ実装）
type CaretPointDocument = Document & {
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
  caretPositionFromPoint?: (
    x: number,
    y: number
  ) => { offsetNode: Node; offset: number } | null;
};

interface RichBodyEditorProps {
  id?: string;
  initialBody: NoticeBlock[];
  onChange: (next: NoticeBlock[]) => void;
  onDirty: () => void;
  invalid?: boolean;
}

// ===== リッチ本文エディタ（contenteditable + execCommand・IME安全） =====
// 装飾の見た目は globals.css の .notice-editor で定義する。
export function RichBodyEditor({
  id,
  initialBody,
  onChange,
  onDirty,
  invalid = false,
}: RichBodyEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const savedRange = useRef<Range | null>(null);
  // 画像削除の2段階操作：1回目のBackspace/Deleteで画像を選択、2回目で削除する。
  const selectedImg = useRef<HTMLImageElement | null>(null);
  // 画像ボタン押下時のキャレット位置（ファイル選択ダイアログ後も挿入位置を保つ）
  const pendingRange = useRef<Range | null>(null);
  const [isLinkOpen, setIsLinkOpen] = useState<boolean>(false);
  const [linkText, setLinkText] = useState<string>('');
  const [linkUrl, setLinkUrl] = useState<string>('');
  // 編集中の既存リンク（リンクの上でダイアログを開いたとき。新規挿入は null）
  const editingLink = useRef<HTMLAnchorElement | null>(null);
  const [isLinkEdit, setIsLinkEdit] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  // ツールバーの装飾ボタンのアクティブ状態（現在のカーソル位置が太字/斜体…かどうか）。
  const [marks, setMarks] = useState<Marks>(EMPTY_MARKS);
  // 表示中のアクティブ状態（exec で「押した直後の状態」を求めるため ref にも持つ）
  const marksRef = useRef<Marks>(EMPTY_MARKS);
  // 文字を選ばずに太字などを押した直後の状態。文字を入力するまで DOM に装飾が無いため、
  // キャレットがその位置にある間はこちらでボタンの表示を上書きする。
  const pendingMarks = useRef<{
    node: Node;
    offset: number;
    marks: Partial<Marks>;
  } | null>(null);

  // 現在のキャレット位置の装飾状態を読み取ってボタン表示に反映する。
  const refreshMarks = () => {
    if (!ref.current) return;
    // 本文エディタ内にキャレットがある時だけ更新（無関係な場所の選択は無視）
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !ref.current.contains(sel.anchorNode))
      return;
    // queryCommandState は CSS 由来の見た目（引用ブロックの italic 等）を拾ってしまうため、
    // キャレット位置の実DOM祖先に該当タグがあるかで判定する。
    const hasAncestor = (tags: string[]): boolean => {
      let node: Node | null = sel.anchorNode;
      while (node && node !== ref.current) {
        if (node.nodeType === 1) {
          const tag = (node as HTMLElement).tagName?.toLowerCase();
          if (tags.includes(tag)) return true;
        }
        node = node.parentNode;
      }
      return false;
    };
    let next: Marks = {
      bold: hasAncestor(['b', 'strong']),
      italic: hasAncestor(['i', 'em']),
      underline: hasAncestor(['u']),
      strikeThrough: hasAncestor(['s', 'strike', 'del']),
      insertUnorderedList: hasAncestor(['ul']),
      insertOrderedList: hasAncestor(['ol']),
      blockquote: hasAncestor(['blockquote']),
    };
    // 押した直後の状態は、キャレットが押した位置から動いていない間だけ反映する
    // （文字を入力すると DOM に装飾が付くため、以降は DOM の判定に任せる）。
    const pending = pendingMarks.current;
    if (
      pending &&
      sel.isCollapsed &&
      sel.anchorNode === pending.node &&
      sel.anchorOffset === pending.offset
    ) {
      next = { ...next, ...pending.marks };
    } else {
      pendingMarks.current = null;
    }
    marksRef.current = next;
    setMarks(next);
  };

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = blocksToHtml(initialBody);
    // 初期表示時のみ本文を流し込む（以降は contenteditable 側が正）
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 初期表示のときだけ本文を流し込む（以降は contenteditable 側が正）
  }, []);

  // 選択範囲の変化（カーソル移動含む）を監視してボタン状態を追従させる。
  useEffect(() => {
    document.addEventListener('selectionchange', refreshMarks);
    return () => document.removeEventListener('selectionchange', refreshMarks);
  }, []);

  // contenteditable の現在の内容を本文ブロックへシリアライズ
  const serialize = () => {
    if (!ref.current) return;
    // 入れ子になった blockquote を平坦化してからシリアライズする
    // （contenteditable が引用内で自動生成する入れ子引用の後始末）。
    let changed = true;
    while (changed) {
      changed = false;
      ref.current.querySelectorAll('blockquote blockquote').forEach((bq) => {
        const parent = bq.parentNode;
        if (!parent) return;
        while (bq.firstChild) parent.insertBefore(bq.firstChild, bq);
        parent.removeChild(bq);
        changed = true;
      });
    }
    onChange(htmlToBlocks(ref.current));
  };

  // 画像選択の解除（ハイライトを外す）
  const clearImgSelection = () => {
    if (selectedImg.current) {
      selectedImg.current.classList.remove('img-selected');
      selectedImg.current = null;
    }
  };
  // 画像を選択状態にする（青枠でハイライト）
  const selectImg = (img: HTMLImageElement) => {
    clearImgSelection();
    img.classList.add('img-selected');
    selectedImg.current = img;
  };
  // キャレット直前の要素が画像なら返す（Backspace で選択対象を探す）
  const imgBeforeCaret = (): HTMLImageElement | null => {
    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0);
    const node: Node | null = r.startContainer;
    const offset = r.startOffset;
    // テキストノード先頭にキャレットがある場合は前の兄弟を見る
    if (node.nodeType === 3 && offset === 0) {
      const prev = node.previousSibling;
      if (prev && (prev as HTMLElement).tagName?.toLowerCase() === 'img')
        return prev as HTMLImageElement;
      return null;
    }
    if (node.nodeType === 1) {
      const el = node as HTMLElement;
      const child = el.childNodes[offset - 1];
      if (child && (child as HTMLElement).tagName?.toLowerCase() === 'img')
        return child as HTMLImageElement;
    }
    return null;
  };

  // 装飾コマンド実行（フォーカス→execCommand→dirty→シリアライズ）
  const exec = (cmd: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    // 文字を選ばずに太字などを押したときは、押した時点でボタンをオン／オフの表示に切り替える
    const sel = window.getSelection();
    if (
      INLINE_MARKS.includes(cmd as InlineMark) &&
      sel?.isCollapsed &&
      sel.anchorNode
    ) {
      const mark = cmd as InlineMark;
      const pending = pendingMarks.current;
      const samePos =
        pending &&
        pending.node === sel.anchorNode &&
        pending.offset === sel.anchorOffset;
      pendingMarks.current = {
        node: sel.anchorNode,
        offset: sel.anchorOffset,
        marks: {
          ...(samePos ? pending.marks : {}),
          [mark]: !marksRef.current[mark],
        },
      };
    }
    onDirty();
    serialize();
    refreshMarks();
  };
  // キャレット位置の祖先 blockquote を返す（無ければ null）
  const currentBlockquote = (): HTMLElement | null => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !ref.current) return null;
    let node: Node | null = sel.anchorNode;
    while (node && node !== ref.current) {
      if (
        node.nodeType === 1 &&
        (node as HTMLElement).tagName.toLowerCase() === 'blockquote'
      ) {
        return node as HTMLElement;
      }
      node = node.parentNode;
    }
    return null;
  };

  // 引用トグル。execCommand('formatBlock','p') は blockquote を確実に外せない
  // （ブラウザにより入れ子が残る）ため、解除は DOM で blockquote を unwrap する。
  const toggleBlockquote = () => {
    ref.current?.focus();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !ref.current) return;

    const bq = currentBlockquote();

    if (bq) {
      // 解除：blockquote の中身を親へ展開して blockquote を除去
      const parent = bq.parentNode;
      if (parent) {
        while (bq.firstChild) parent.insertBefore(bq.firstChild, bq);
        parent.removeChild(bq);
      }
    } else {
      // 引用にする
      document.execCommand('formatBlock', false, 'blockquote');
    }
    onDirty();
    serialize();
    refreshMarks();
  };

  // 引用ブロック内で矢印キーを押したときの抜け処理。
  // ・引用の一番下の行で ↓ → 引用の外（下）の行へ。無ければ通常の空行を作って出る。
  // ・引用の一番上の行で ↑ → 引用の外（上）の行へ。無ければ通常の空行を作って出る。
  // それ以外（引用の途中）は既定動作（カーソル移動）に任せる。
  const handleQuoteArrow = (e: KeyboardEvent<HTMLDivElement>): boolean => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return false;
    const bq = currentBlockquote();
    if (!bq || !ref.current) return false;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;

    // 引用内での上端／下端判定：キャレットの矩形と引用の矩形を比べる。
    // 1行の高さの半分程度を閾値にして判定する（途中の行なら既定動作＝引用内で行移動）。
    const r = sel.getRangeAt(0).cloneRange();
    // 空行だと range の矩形が取れないことがあるため、取れなければ一時 marker で位置を得る
    let caretRect = r.getClientRects()[0] as DOMRect | undefined;
    if (!caretRect) {
      const marker = document.createElement('span');
      marker.textContent = '\u200B'; // ゼロ幅スペース
      r.insertNode(marker);
      caretRect = marker.getBoundingClientRect();
      marker.remove();
      // marker 挿入で range がずれるため、選択を元の位置へ戻す
      sel.removeAllRanges();
      sel.addRange(r);
    }
    const bqRect = bq.getBoundingClientRect();
    // 行高が取れない場合の既定値（1.25rem 相当）
    const lineH = caretRect.height || 20;
    const nearTop = caretRect.top - bqRect.top < lineH * 0.6;
    const nearBottom = bqRect.bottom - caretRect.bottom < lineH * 0.6;

    const placeCaret = (el: HTMLElement) => {
      const nr = document.createRange();
      nr.setStart(el, 0);
      nr.collapse(true);
      sel.removeAllRanges();
      sel.addRange(nr);
    };
    const makeEmptyP = () => {
      const p = document.createElement('p');
      p.appendChild(document.createElement('br'));
      return p;
    };

    if (e.key === 'ArrowDown' && nearBottom) {
      // 引用の下の要素へ。無ければ空段落を作って出る。
      let next = bq.nextElementSibling as HTMLElement | null;
      if (!next) {
        next = makeEmptyP();
        bq.parentNode?.insertBefore(next, bq.nextSibling);
      }
      e.preventDefault();
      placeCaret(next);
      onDirty();
      serialize();
      return true;
    }
    if (e.key === 'ArrowUp' && nearTop) {
      // 引用の上の要素へ。無ければ空段落を作って出る。
      let prev = bq.previousElementSibling as HTMLElement | null;
      if (!prev) {
        prev = makeEmptyP();
        bq.parentNode?.insertBefore(prev, bq);
      }
      e.preventDefault();
      placeCaret(prev);
      onDirty();
      serialize();
      return true;
    }
    return false;
  };

  // 引用ブロック内での Enter／Backspace の挙動。
  // ・Enter：引用の中で改行し、引用を続ける（<br>を挿入）。
  // ・Backspace：引用が空のときは引用ブロックごと解除して通常段落に戻す。
  const handleQuoteEnterBackspace = (
    e: KeyboardEvent<HTMLDivElement>
  ): boolean => {
    const bq = currentBlockquote();
    if (!bq || !ref.current) return false;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;

    // Enter（Shift無し）：引用内で改行して引用を続ける
    if (e.key === 'Enter' && !e.shiftKey && !composing.current) {
      e.preventDefault();
      document.execCommand('insertLineBreak');
      onDirty();
      serialize();
      return true;
    }

    // Backspace：引用が「1行だけで空」のときのみ引用ブロックを解除して通常段落へ戻す。
    // 引用が複数行あるときは既定動作に任せ、その行だけ消す。
    if (e.key === 'Backspace' && sel.isCollapsed) {
      const text = bq.textContent ?? '';
      // 引用内の改行数（<br>）。0なら1行だけの引用。
      const brCount = bq.querySelectorAll('br').length;
      const isSingleEmptyLine = text.trim() === '' && brCount <= 1;
      if (isSingleEmptyLine) {
        e.preventDefault();
        const p = document.createElement('p');
        p.appendChild(document.createElement('br'));
        bq.parentNode?.replaceChild(p, bq);
        const nr = document.createRange();
        nr.setStart(p, 0);
        nr.collapse(true);
        sel.removeAllRanges();
        sel.addRange(nr);
        onDirty();
        serialize();
        return true;
      }
    }
    return false;
  };

  // キャレット・選択範囲がリンクに当たっていれば、そのリンクを返す（無ければ null）
  const currentLink = (): HTMLAnchorElement | null => {
    const editor = ref.current;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !editor) return null;
    const r = sel.getRangeAt(0);
    // キャレット、または選択の両端が同じリンクの中にあるとき（リンクの文字の一部を選んだときなど）。
    // 選択がリンクの外まで広がっているときは編集にしない（選んだ文字で新しくリンクを挿入する）。
    const inside = ancestorLink(r.commonAncestorContainer, editor);
    if (inside) return inside;
    if (r.collapsed) return null;
    // リンクの文字全体を選んだとき：選択の両端はリンクの外側（直前・直後の位置）になるため、
    // 選択範囲と重なるリンクのうち、選んだ文字とリンクの文字が一致するものを編集の対象にする
    const selected = sel.toString().trim();
    const links: HTMLAnchorElement[] = Array.from(
      editor.querySelectorAll<HTMLAnchorElement>('a')
    );
    const hit = links.find(
      (a) => r.intersectsNode(a) && (a.textContent ?? '').trim() === selected
    );
    return hit ?? null;
  };

  // リンクボタン：既存のリンクの上で開いたときは表示名・URLを初期表示して編集する。
  // それ以外は、選択した文字を表示名に入れて新規挿入する。
  const openLink = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount)
      savedRange.current = sel.getRangeAt(0).cloneRange();
    const link = currentLink();
    editingLink.current = link;
    setIsLinkEdit(link !== null);
    if (link) {
      setLinkText(link.textContent ?? '');
      setLinkUrl(link.getAttribute('href') ?? '');
    } else {
      // 選択の端がリンクの中途にかかっているときは、そのリンク全体まで選択を広げる
      // （古いリンクの中に新しいリンクが入れ子にならないよう、まとめて置き換える）
      const r = savedRange.current;
      if (r && ref.current) {
        const startLink = ancestorLink(r.startContainer, ref.current);
        const endLink = ancestorLink(r.endContainer, ref.current);
        if (startLink) r.setStartBefore(startLink);
        if (endLink) r.setEndAfter(endLink);
      }
      setLinkText(r ? r.toString() : sel ? sel.toString() : '');
      setLinkUrl('');
    }
    setIsLinkOpen(true);
  };
  const handleInsertLink = () => {
    const url = linkUrl.trim();
    if (!url) {
      setIsLinkOpen(false);
      return;
    }
    const text = linkText.trim() || url;
    // 既存リンクの編集：その場で表示名・URLを差し替える（表示名は文字だけ。装飾は引き継がない）
    const link = editingLink.current;
    if (link && ref.current?.contains(link)) {
      link.setAttribute('href', url);
      link.textContent = text;
      editingLink.current = null;
      setIsLinkOpen(false);
      onDirty();
      serialize();
      return;
    }
    ref.current?.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand(
      'insertHTML',
      false,
      `<a href="${url.replace(/"/g, '%22')}">${esc(text)}</a>&nbsp;`
    );
    setIsLinkOpen(false);
    onDirty();
    serialize();
  };

  // データURLの画像を挿入。挿入位置は保存した range（無ければ末尾）。
  // 画像はインライン要素（Teams等と同様）。挿入後はキャレットを画像の直後へ置く。
  const insertImageSrc = (src: string, at?: Range | null) => {
    const editor = ref.current;
    if (!editor) return;

    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    // 画像を編集不能な塊として扱い、キャレットの高さが画像に引っ張られないようにする。
    img.setAttribute('contenteditable', 'false');

    // 挿入位置：保存した range が editor 内にあればそこ、無ければ末尾
    const useRange = at && editor.contains(at.startContainer) ? at : null;
    if (useRange) {
      useRange.deleteContents();
      useRange.insertNode(img);
    } else {
      editor.appendChild(img);
    }

    // キャレットを画像の直後（同じ行の右横）へ移動
    editor.focus();
    const newRange = document.createRange();
    newRange.setStartAfter(img);
    newRange.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(newRange);

    onDirty();
    serialize();
  };
  // 現在のキャレット range を複製して返す（非同期挿入の前に保存する用）
  const currentRange = (): Range | null => {
    const sel = window.getSelection();
    return sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  };
  // File を読み込んでデータURL化し挿入（at=挿入位置。非同期前に保存しておく）
  const insertImageFile = (file: File, at?: Range | null) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') insertImageSrc(reader.result, at);
    };
    reader.readAsDataURL(file);
  };
  // ツールバーの画像ボタン → 押下時のキャレット位置を保存してファイル選択ダイアログを開く
  const handlePickImage = () => {
    pendingRange.current = currentRange();
    fileInputRef.current?.click();
  };
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) insertImageFile(f, pendingRange.current);
    pendingRange.current = null;
    e.target.value = ''; // 同じファイルを連続選択できるようにリセット
  };

  return (
    <div
      // 編集面自体は outline を消しているため、フォーカス中は枠全体にリングを出す（→ 06）
      className={`border rounded-md focus-within:ring-2 focus-within:ring-blue-500 ${invalid ? 'border-red-400' : 'border-gray-400'}`}
    >
      <div
        role="toolbar"
        aria-label="本文の書式"
        className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1"
      >
        <ToolbarButton
          onClick={() => exec('bold')}
          title="太字"
          active={marks.bold}
        >
          <Bold className="w-4 h-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => exec('italic')}
          title="斜体"
          active={marks.italic}
        >
          <Italic className="w-4 h-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => exec('underline')}
          title="下線"
          active={marks.underline}
        >
          <Underline className="w-4 h-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => exec('strikeThrough')}
          title="取り消し線"
          active={marks.strikeThrough}
        >
          <Strikethrough className="w-4 h-4" aria-hidden="true" />
        </ToolbarButton>
        <span className="w-px h-5 bg-gray-300 mx-1" aria-hidden="true" />
        <ToolbarButton
          onClick={openLink}
          title="リンク（表示名＋URL。リンクの上で押すと編集）"
        >
          <LinkIcon className="w-4 h-4" aria-hidden="true" />
        </ToolbarButton>
        <span className="w-px h-5 bg-gray-300 mx-1" aria-hidden="true" />
        <ToolbarButton
          onClick={() => exec('insertUnorderedList')}
          title="箇条書き"
          active={marks.insertUnorderedList}
        >
          <List className="w-4 h-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => exec('insertOrderedList')}
          title="番号付きリスト"
          active={marks.insertOrderedList}
        >
          <ListOrdered className="w-4 h-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          // 引用中に押したら解除（DOMでunwrap）、そうでなければ引用にする（トグル）
          onClick={toggleBlockquote}
          title={marks.blockquote ? '引用を解除' : '引用'}
          active={marks.blockquote}
        >
          <Quote className="w-4 h-4" aria-hidden="true" />
        </ToolbarButton>
        <span className="w-px h-5 bg-gray-300 mx-1" aria-hidden="true" />
        <ToolbarButton onClick={handlePickImage} title="画像を挿入">
          <ImageIcon className="w-4 h-4" aria-hidden="true" />
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div
        id={id}
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label="本文"
        aria-invalid={invalid}
        className={`notice-editor min-h-40 max-h-90 overflow-y-auto px-3 py-2 text-sm text-gray-800 leading-normal ${
          isDragOver ? 'ring-2 ring-blue-400 ring-inset bg-blue-50/40' : ''
        }`}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="本文を入力…（画像はドラッグ＆ドロップ／貼り付けも可）"
        onKeyDown={(e) => {
          // 引用ブロックの端で ↑↓ を押したら引用の外へ抜ける（無ければ空行を作る）
          if (handleQuoteArrow(e)) return;
          // 引用内の Enter（引用継続）／空引用での Backspace（引用解除）
          if (handleQuoteEnterBackspace(e)) return;
          if (e.key === 'Backspace' || e.key === 'Delete') {
            // 2回目：画像が選択済みならこのキーで削除
            if (selectedImg.current) {
              e.preventDefault();
              selectedImg.current.remove();
              selectedImg.current = null;
              onDirty();
              serialize();
              return;
            }
            // 1回目：キャレット直前が画像なら、まず選択（削除せず青枠表示）。
            const img = imgBeforeCaret();
            if (img) {
              e.preventDefault();
              selectImg(img);
              return;
            }
          } else {
            // 他キーが押されたら画像選択は解除
            clearImgSelection();
          }
        }}
        onClick={(e) => {
          // 画像クリックで選択、それ以外は選択解除
          const t = e.target as HTMLElement;
          if (t.tagName?.toLowerCase() === 'img') {
            selectImg(t as HTMLImageElement);
            return;
          }
          clearImgSelection();
        }}
        onInput={() => {
          if (!composing.current) onDirty();
        }}
        onBlur={() => {
          clearImgSelection();
          serialize();
        }}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
          onDirty();
        }}
        onPaste={(e) => {
          // 画像がクリップボードにあればベタ貼り（データURL化して挿入）
          const items: DataTransferItem[] = Array.from(
            e.clipboardData.items || []
          );
          const imgItem = items.find((it) => it.type.startsWith('image/'));
          if (imgItem) {
            const file = imgItem.getAsFile();
            if (file) {
              e.preventDefault();
              insertImageFile(file, currentRange());
              return;
            }
          }
          // それ以外はプレーンテキストとして貼り付け
          e.preventDefault();
          const t = e.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, t);
        }}
        onDragOver={(e) => {
          // 画像ドラッグ中のみドロップを受け付ける
          if (Array.from(e.dataTransfer.types).includes('Files')) {
            e.preventDefault();
            if (!isDragOver) setIsDragOver(true);
          }
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          const files: File[] = Array.from(e.dataTransfer.files || []);
          const imgs = files.filter((f) => f.type.startsWith('image/'));
          if (imgs.length) {
            e.preventDefault();
            setIsDragOver(false);
            // ドロップ地点にキャレット range を作る（対応ブラウザのみ／無ければ末尾）
            const doc = document as CaretPointDocument;
            let dropRange: Range | null = null;
            if (doc.caretRangeFromPoint)
              dropRange = doc.caretRangeFromPoint(e.clientX, e.clientY);
            else if (doc.caretPositionFromPoint) {
              const pos = doc.caretPositionFromPoint(e.clientX, e.clientY);
              if (pos) {
                dropRange = document.createRange();
                dropRange.setStart(pos.offsetNode, pos.offset);
                dropRange.collapse(true);
              }
            }
            imgs.forEach((f) => insertImageFile(f, dropRange));
          }
        }}
      />

      <LinkInsertDialog
        open={isLinkOpen}
        isEdit={isLinkEdit}
        text={linkText}
        url={linkUrl}
        onText={setLinkText}
        onUrl={setLinkUrl}
        onCancel={() => setIsLinkOpen(false)}
        onInsert={handleInsertLink}
      />
    </div>
  );
}
