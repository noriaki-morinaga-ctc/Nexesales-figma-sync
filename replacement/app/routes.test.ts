import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

// routes.tsx / Header.tsx は画面コンポーネント一式を巻き込むため、
// ここではモジュールを import せずソースを静的に読み取って不変条件を検証する。
const APP_DIR = path.resolve(__dirname);
// 画面は src/features/<カテゴリ>/<ルートID>/、共通部品は src/components/ にある
const SRC_DIR = path.resolve(__dirname, '..');
const ROUTES_SRC = readFileSync(path.join(APP_DIR, 'routes.tsx'), 'utf8');
const HEADER_SRC = readFileSync(
  path.join(SRC_DIR, 'components', 'layout', 'Header.tsx'),
  'utf8'
);

/** ROUTES の各エントリから ルートID と dir を取り出す。 */
function parseRoutes(): { id: string; dir: string }[] {
  const body = ROUTES_SRC.slice(
    ROUTES_SRC.indexOf('export const ROUTES'),
    ROUTES_SRC.indexOf('export const ROUTE_DIR_EXCEPTIONS')
  );
  const re = /^\s{2}'?([a-z][a-z0-9-]*)'?:\s*\{$/gm;
  const out: { id: string; dir: string }[] = [];
  for (const m of body.matchAll(re)) {
    const rest = body.slice(m.index);
    const dir = /dir:\s*'([^']+)'/.exec(rest);
    if (!dir) throw new Error(`dir が見つからない: ${m[1]}`);
    out.push({ id: m[1], dir: dir[1] });
  }
  return out;
}

/** ROUTE_DIR_EXCEPTIONS の中身。 */
function parseExceptions(): Set<string> {
  const m = /ROUTE_DIR_EXCEPTIONS = new Set\(\[([^\]]*)\]\)/.exec(ROUTES_SRC);
  if (!m) return new Set();
  return new Set([...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
}

/** Header の MENU_ITEMS から末端（children を持たない）のメニュー ID を取り出す。 */
function parseMenuLeafIds(): string[] {
  const raw = HEADER_SRC.slice(
    HEADER_SRC.indexOf('export const MENU_ITEMS'),
    HEADER_SRC.indexOf('export function Header(')
  );
  // コメントアウトされたメニュー定義は対象外にする
  const body = raw
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');

  // children: [ ... ] を括弧の対応で切り出す（インデントに依存させない）
  const ids: string[] = [];
  let cursor = 0;
  for (;;) {
    const at = body.indexOf('children:', cursor);
    if (at === -1) break;
    const open = body.indexOf('[', at);
    if (open === -1) break;
    let depth = 0;
    let end = open;
    for (let i = open; i < body.length; i++) {
      if (body[i] === '[') depth++;
      else if (body[i] === ']') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const block = body.slice(open, end);
    for (const m of block.matchAll(/id:\s*'([^']+)'/g)) ids.push(m[1]);
    cursor = end + 1;
  }
  return ids;
}

const routes = parseRoutes();
const exceptions = parseExceptions();
const externalIds = new Set(['bi-system', 'budget-sales-system']);

describe('ROUTES', () => {
  it('58 ルート（56 画面 ＋ 実績モード別名 2）が定義されている', () => {
    expect(routes.length).toBe(58);
    // 実体の画面ディレクトリは 56。plan-list-actual は plan-list、
    // marketing-file-upload-actual は marketing-file-upload を再利用する。
    expect(new Set(routes.map((r) => r.dir)).size).toBe(56);
  });

  it('ルート ID が重複していない', () => {
    const ids = routes.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ルート ID がディレクトリ名の末尾セグメントと一致する', () => {
    const mismatched = routes
      .filter((r) => !exceptions.has(r.id))
      .filter((r) => r.dir.split('/').at(-1) !== r.id);
    expect(mismatched).toEqual([]);
  });

  it('全ルートの page.tsx が実在する', () => {
    const missing = routes.filter(
      (r) => !existsSync(path.join(SRC_DIR, 'features', r.dir, 'page.tsx'))
    );
    expect(missing).toEqual([]);
  });
});

// フォルダーの置き方（→ 04 §画面ディレクトリ構成・08 D-10）。
// src/app/ は Next.js へ移すときにルーティングのフォルダーになるため、画面の切り替え以外を置かない。
describe('フォルダーの構成', () => {
  const entriesOf = (dir: string) =>
    readdirSync(path.join(SRC_DIR, dir), { withFileTypes: true });

  it('src/app/ には画面の切り替えのファイルだけを置く', () => {
    const allowed = new Set([
      'App.tsx',
      'routes.tsx',
      'routes.test.ts',
      'Attributions.md',
    ]);
    const extra = entriesOf('app')
      .map((e) => e.name)
      .filter((n) => !allowed.has(n));
    expect(extra).toEqual([]);
  });

  it('src/components/ の直下はフォルダー（ui・grid・layout・shared）だけ', () => {
    const names = entriesOf('components').map((e) =>
      e.isDirectory() ? `${e.name}/` : e.name
    );
    expect(names.sort()).toEqual(['grid/', 'layout/', 'shared/', 'ui/']);
  });

  it('src/features/<カテゴリ>/ の直下に画面のファイルを置かない（画面ディレクトリと shared/ だけ）', () => {
    // カテゴリのフォルダーがそのまま画面ディレクトリのもの（top）は除く
    const routeDirs = new Set(parseRoutes().map((r) => r.dir));
    const strays = entriesOf('features')
      .filter((c) => c.isDirectory() && !routeDirs.has(c.name))
      .flatMap((c) =>
        entriesOf(`features/${c.name}`)
          .filter((e) => e.isFile())
          .map((e) => `${c.name}/${e.name}`)
      );
    expect(strays).toEqual([]);
  });
});

describe('Header のメニュー', () => {
  const leafIds = parseMenuLeafIds();

  it('末端メニュー ID を抽出できている', () => {
    expect(leafIds.length).toBeGreaterThan(20);
  });

  it('末端メニュー ID がすべて ROUTES に存在する（外部システムを除く）', () => {
    const known = new Set(routes.map((r) => r.id));
    const orphans = leafIds.filter(
      (id) => !known.has(id) && !externalIds.has(id)
    );
    // 過去に Header が 'sales-plan-table' を送るのに App.tsx は 'sales-plan-page' で
    // 分岐しており、default 分岐に落ちて偶然描画されていた。その再発を防ぐ。
    expect(orphans).toEqual([]);
  });
});

describe('App.tsx の初期表示ページ', () => {
  const INITIAL_SRC = readFileSync(path.join(APP_DIR, 'App.tsx'), 'utf8');
  const known = new Set(routes.map((r) => r.id));

  /** JSDoc のルート ID 一覧（`- \`id\` … 説明` 行）。 */
  const listed = [
    ...INITIAL_SRC.matchAll(/^\s*\*\s*-\s*`([a-z][a-z0-9-]*)`\s*…/gm),
  ].map((m) => m[1]);

  it('currentPage の初期値が実在するルート ID を指している', () => {
    const m =
      /const \[currentPage, setCurrentPage\] = useState<string>\(\s*'([^']+)'/.exec(
        INITIAL_SRC
      );
    expect(m).not.toBeNull();
    expect(known.has(m![1])).toBe(true);
  });

  it('コメントのルート ID 一覧が ROUTES と一致している', () => {
    // 一覧が古びると「切り替えたい画面が載っていない」状態になるため同期を強制する。
    expect([...listed].sort()).toEqual([...known].sort());
  });
});
