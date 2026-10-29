import { useSyncExternalStore } from 'react';

// ===== お知らせ 共有 in-memory ストア（モック・バックエンドなし） =====
// お知らせメンテ画面(NoticeAdminScreen)が使用する（TOP画面との共有は未対応）。
// 本文の描画・シリアライズロジックは noticeBody.tsx に集約（本ファイルは再エクスポートのみ）。

// 新商品サンプル用の商品写真（三ツ矢トロピカルMix）。base64 埋め込みはせず public 配下の画像を参照する（→ 07）。
const TROPICAL_MIX_IMAGE_SRC = '/images/notice/img-tropical-mix.jpg';

// 本文のリッチ表記。inline はマーク統合型（太字/斜体/下線/取消線の組合せ可・リンク）。
// string = プレーン / NoticeRun = 装飾付きテキスト（b:太字 i:斜体 u:下線 s:取消線 url:リンク）
export interface NoticeRun {
  text: string;
  url?: string;
  b?: boolean;
  i?: boolean;
  u?: boolean;
  s?: boolean;
}
// インライン画像（段落や引用・リストの中で、文字と同じ行に置ける画像。Teams等と同様）。
// src は画像URLまたはデータURL。段落内に img: を持つセグメントとして表す。
export interface NoticeImg {
  img: string;
  alt?: string;
}
export type NoticeInline = string | NoticeRun | NoticeImg;
// ブロック: 段落 / 引用 / 箇条書き / 番号付きリスト / 画像
// img: src は画像のURLまたはデータURL（エディタで貼り付けた画像はデータURLを保持）
export type NoticeBlock =
  | { type: 'p'; content: NoticeInline[] }
  | { type: 'quote'; content: NoticeInline[] }
  | { type: 'bullets'; items: NoticeInline[][] }
  | { type: 'ol'; items: NoticeInline[][] }
  | { type: 'img'; src: string; alt?: string };

export type NoticeStatus = 'draft' | 'published' | 'withdrawn';

export interface NoticeItem {
  id: number;
  type: 'important' | 'notice';
  date: string; // 表示用（= 掲載開始日時 "YYYY/MM/DD HH:mm"）。TopDashboard 互換。
  title: string;
  body: NoticeBlock[];
  // 関連リンク（任意・単一）。SharePoint に限らず任意URL。表示名は linkLabel。
  linkUrl?: string;
  linkLabel?: string;
  status: NoticeStatus;
  startAt: string; // 掲載開始日時 "YYYY/MM/DD HH:mm"
  endAt?: string; // 掲載終了日時（未指定=無期限）
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  deleted?: boolean;
}

// 一覧表示・新着判定の基準時刻（モック用の固定 NOW）
export const NOW_STR = '2026/06/26 00:00';

export const STATUS_LABEL: Record<NoticeStatus, string> = {
  draft: '下書き',
  published: '公開',
  withdrawn: '取下げ',
};

// 表示用の派生ステータス（保存ステータス＋掲載期間から算出）
export type DisplayStatus =
  | 'draft'
  | 'scheduled'
  | 'open'
  | 'ended'
  | 'withdrawn';
export const DISPLAY_STATUS_LABEL: Record<DisplayStatus, string> = {
  draft: '下書き',
  scheduled: '予約',
  open: '公開中',
  ended: '掲載終了',
  withdrawn: '取下げ',
};
export const displayStatus = (
  n: Pick<NoticeItem, 'status' | 'startAt' | 'endAt'>
): DisplayStatus => {
  if (n.status === 'draft') return 'draft';
  if (n.status === 'withdrawn') return 'withdrawn';
  if (n.startAt > NOW_STR) return 'scheduled';
  if (n.endAt && n.endAt < NOW_STR) return 'ended';
  return 'open';
};

// 一般画面（TOP）に出すのは「公開中」のみ
export const isNoticeVisible = (n: NoticeItem): boolean =>
  !n.deleted && displayStatus(n) === 'open';

// ===== 本文レンダリング・ヘルパ（実体は noticeBody に集約・再エクスポート） =====
export {
  inlineToText,
  bodyPreviewText,
  renderInline,
  renderNoticeBody,
} from './noticeBody';

// ===== シードデータ =====
const AUDIT = {
  createdBy: 'システム管理部 田中',
  createdAt: '2024/12/01 09:00',
  updatedBy: 'システム管理部 田中',
  updatedAt: '2025/06/04 12:00',
};

let allNotices: NoticeItem[] = [
  {
    id: 0,
    type: 'important',
    date: '2025/05/03 15:23',
    title: 'NEXTSALES　定期メンテナンスのお知らせ',
    body: [
      {
        type: 'p',
        content: [
          '毎月最終木曜日 ',
          { text: '15:00～16:00', b: true },
          ' の間、定期メンテナンス作業を行います。対象システムは販売計画管理システム全般です。',
        ],
      },
      {
        type: 'p',
        content: [
          '最新の作業予定は ',
          {
            text: 'メンテナンスカレンダー',
            url: 'https://contoso.sharepoint.com/sites/NextSales/SitePages/メンテナンスカレンダー.aspx',
          },
          ' をご確認ください。ご不明点は ',
          {
            text: 'システム運用チーム（Teams）',
            url: 'https://teams.microsoft.com/l/channel/19%3Asample/運用',
          },
          ' までご連絡ください。',
        ],
      },
    ],
    linkUrl:
      'https://contoso.sharepoint.com/sites/NextSales/SitePages/定期メンテナンス案内.aspx',
    linkLabel: 'メンテナンス案内ページ',
    status: 'published',
    startAt: '2025/05/03 15:23',
    ...AUDIT,
  },
  {
    id: 1,
    type: 'notice',
    date: '2025/06/04 12:00',
    title: 'システムに関するお知らせ',
    body: [
      {
        type: 'p',
        content: [
          '年始に伴いシステムの動作確認を実施しました。現在は ',
          { text: '正常稼働', b: true },
          ' しております。',
        ],
      },
    ],
    status: 'published',
    startAt: '2025/06/04 12:00',
    ...AUDIT,
  },
  {
    id: 2,
    type: 'notice',
    date: '2024/12/11 15:20',
    title: 'サービス時間・問い合わせ先',
    body: [
      {
        type: 'bullets',
        items: [
          [{ text: 'サービス時間', b: true }, '：7:30～23:00'],
          [
            { text: '問い合わせ先', b: true },
            '：',
            {
              text: 'ヘルプデスク受付フォーム',
              url: 'https://forms.office.com/r/helpdesk-sample',
            },
            '（TEL: 0120-xxx-xxx）',
          ],
          [{ text: '対応時間', b: true }, '：平日 9:00～18:00'],
        ],
      },
    ],
    linkUrl:
      'https://contoso.sharepoint.com/sites/NextSales/SitePages/サービス時間と問い合わせ先.aspx',
    linkLabel: 'サービス時間・問い合わせ先ページ',
    status: 'published',
    startAt: '2024/12/11 15:20',
    ...AUDIT,
  },
  {
    id: 3,
    type: 'notice',
    date: '2024/12/11 15:20',
    title: 'サービス時間・問い合わせ先（改定版）',
    body: [
      {
        type: 'p',
        content: [
          'サービス時間・問い合わせ先を改定しました。詳細は ',
          {
            text: '改定のお知らせ',
            url: 'https://contoso.sharepoint.com/sites/NextSales/SitePages/改定のお知らせ.aspx',
          },
          ' をご覧ください。',
        ],
      },
      {
        type: 'bullets',
        items: [
          [
            { text: 'サービス時間', b: true },
            '：7:30～23:00（年末年始を除く）',
          ],
          [
            { text: '問い合わせ先', b: true },
            '：',
            {
              text: 'システム管理部（Teams）',
              url: 'https://teams.microsoft.com/l/channel/19%3Asample/システム管理部',
            },
          ],
        ],
      },
    ],
    linkUrl:
      'https://contoso.sharepoint.com/sites/NextSales/SitePages/サービス時間と問い合わせ先_改定版.aspx',
    status: 'published',
    startAt: '2024/12/11 15:20',
    ...AUDIT,
  },
  {
    id: 4,
    type: 'notice',
    date: '2026/06/20 10:00',
    title: '（下書き）夏季休業期間のご案内',
    body: [
      {
        type: 'p',
        content: [
          '夏季休業期間中のヘルプデスク対応について、確定後にお知らせします。（これは',
          { text: '下書き', b: true },
          'のため一般画面には未掲載です）',
        ],
      },
    ],
    status: 'draft',
    startAt: '2026/06/20 10:00',
    createdBy: 'システム管理部 田中',
    createdAt: '2026/06/20 10:00',
    updatedBy: 'システム管理部 田中',
    updatedAt: '2026/06/20 10:00',
  },
  {
    id: 5,
    type: 'notice',
    date: '2026/04/10 10:00',
    title: '（取下げ）旧サポート窓口に関するお知らせ',
    body: [
      {
        type: 'p',
        content: [
          '本件は内容を見直すため一旦',
          { text: '取下げ', b: true },
          'ました。新しい窓口は別途ご案内します。',
        ],
      },
    ],
    status: 'withdrawn',
    startAt: '2026/04/10 10:00',
    createdBy: 'システム管理部 田中',
    createdAt: '2026/04/10 10:00',
    updatedBy: 'システム管理部 朝比奈',
    updatedAt: '2026/05/20 17:30',
  },
  {
    id: 6,
    type: 'important',
    date: '2026/05/01 09:00',
    title: 'システム切替に伴う一時停止のご案内',
    body: [
      {
        type: 'p',
        content: [
          {
            text: '2026年5月の切替作業は完了しました。',
            b: true,
          },
          '（掲載期間が終了したため一般画面には表示されていません）',
        ],
      },
      {
        type: 'ol',
        items: [
          ['旧システムの停止：2026/05/15'],
          ['新システムの稼働開始：2026/05/16'],
        ],
      },
    ],
    status: 'published',
    startAt: '2026/05/01 09:00',
    endAt: '2026/05/31 23:59',
    createdBy: 'システム管理部 田中',
    createdAt: '2026/04/20 09:00',
    updatedBy: 'システム管理部 田中',
    updatedAt: '2026/05/16 10:00',
  },
  {
    id: 7,
    type: 'notice',
    date: '2026/06/20 09:00',
    title: '夏季の問い合わせ受付時間について（掲載期間あり）',
    body: [
      {
        type: 'p',
        content: [
          '夏季の受付時間は次のとおりです。掲載は ',
          { text: '2026/07/31', u: true },
          ' までです。',
        ],
      },
      {
        type: 'bullets',
        items: [
          ['受付時間：9:00～17:00'],
          [
            '詳細：',
            {
              text: '夏季対応ページ',
              url: 'https://contoso.sharepoint.com/sites/NextSales/SitePages/夏季対応.aspx',
            },
          ],
        ],
      },
    ],
    status: 'published',
    startAt: '2026/06/20 09:00',
    endAt: '2026/07/31 23:59',
    linkUrl:
      'https://contoso.sharepoint.com/sites/NextSales/SitePages/夏季対応.aspx',
    linkLabel: '夏季対応ページ',
    createdBy: 'システム管理部 朝比奈',
    createdAt: '2026/06/18 14:00',
    updatedBy: 'システム管理部 朝比奈',
    updatedAt: '2026/06/18 14:00',
  },
  {
    id: 8,
    type: 'notice',
    date: '2026/07/01 09:00',
    title: '（予約投稿）7月の機能リリース予定',
    body: [
      {
        type: 'p',
        content: [
          '7月のリリース内容です。掲載開始は ',
          { text: '2026/07/01', b: true, i: true },
          ' のため、まだ一般画面には表示されていません。',
        ],
      },
      {
        type: 'quote',
        content: ['対象機能・影響範囲は確定後に更新します。'],
      },
    ],
    status: 'published',
    startAt: '2026/07/01 09:00',
    createdBy: 'システム管理部 朝比奈',
    createdAt: '2026/06/25 11:00',
    updatedBy: 'システム管理部 朝比奈',
    updatedAt: '2026/06/25 11:00',
  },
  {
    // 画像を使ったお知らせのサンプル（新商品案内）
    id: 9,
    type: 'important',
    date: '2026/06/20 10:00',
    title: '【新商品】三ツ矢トロピカルMix 発売のお知らせ',
    body: [
      {
        type: 'p',
        content: [
          'このたび、',
          { text: '三ツ矢トロピカルMix', b: true },
          ' を全国で発売いたします。営業活動の際は、下記の商品概要をご確認ください。',
        ],
      },
      {
        type: 'img',
        src: TROPICAL_MIX_IMAGE_SRC,
        alt: '三ツ矢トロピカルMix 商品写真',
      },
      {
        type: 'bullets',
        items: [
          [{ text: '商品名', b: true }, '：三ツ矢トロピカルMix'],
          [{ text: '容器・容量', b: true }, '：PET500ml'],
          [{ text: '希望小売価格', b: true }, '：200円（税別）、216円（税込）'],
          [{ text: '品目', b: true }, '：炭酸飲料（果汁10％未満）'],
          [{ text: '発売日', b: true }, '：7月21日（9月までの販売を予定）'],
          [{ text: '発売地域', b: true }, '：全国'],
        ],
      },
      {
        type: 'p',
        content: [
          '販促物・店頭POPの申込は ',
          {
            text: '販促物申込フォーム',
            url: 'https://forms.office.com/r/newproduct-sample',
          },
          ' から受け付けています。',
        ],
      },
    ],
    linkUrl:
      'https://contoso.sharepoint.com/sites/NextSales/SitePages/新商品案内.aspx',
    linkLabel: '新商品 商品情報ページ',
    status: 'published',
    startAt: '2026/06/20 10:00',
    createdBy: 'システム管理部 野田',
    createdAt: '2026/06/18 14:00',
    updatedBy: 'システム管理部 野田',
    updatedAt: '2026/06/18 14:00',
  },
];

// ===== 永続化（localStorage）=====
// ブラウザ更新でも編集内容が消えないよう、全変更を localStorage に保存する。
// 初期表示時に保存データがあればそちらを優先する（無ければ上記サンプル）。
// サンプルを初期データに戻したいときはブラウザのコンソールで
// localStorage.removeItem('nextsales-notices-v2') を実行して再読み込み。
// v2：試験操作で増えた複製・下書きを全員分リセットするためキーを更新（2026/10/22）
const STORAGE_KEY = 'nextsales-notices-v2';
const loadSaved = (): NoticeItem[] | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length
      ? (parsed as NoticeItem[])
      : null;
  } catch {
    return null;
  }
};
const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allNotices));
  } catch (e) {
    // 容量超過等。保存失敗してもアプリ動作は継続する
    console.warn('お知らせの保存に失敗しました', e);
  }
};
{
  const saved = loadSaved();
  if (saved) allNotices = saved;
}

let snapshot: NoticeItem[] = allNotices.filter((n) => !n.deleted);
const listeners = new Set<() => void>();
const emit = () => {
  snapshot = allNotices.filter((n) => !n.deleted);
  persist();
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getSnapshot = () => snapshot;

export const useNotices = (): NoticeItem[] =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

const nextId = () => allNotices.reduce((m, n) => Math.max(m, n.id), -1) + 1;

export type NoticeDraft = Omit<
  NoticeItem,
  'id' | 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt' | 'deleted'
>;

const ADMIN_USER = 'システム管理部 朝比奈';

export const addNotice = (draft: NoticeDraft): number => {
  const id = nextId();
  allNotices = [
    ...allNotices,
    {
      ...draft,
      id,
      date: draft.startAt,
      createdBy: ADMIN_USER,
      createdAt: NOW_STR,
      updatedBy: ADMIN_USER,
      updatedAt: NOW_STR,
    },
  ];
  emit();
  return id;
};

export const updateNotice = (id: number, draft: NoticeDraft) => {
  allNotices = allNotices.map((n) =>
    n.id === id
      ? {
          ...n,
          ...draft,
          date: draft.startAt,
          updatedBy: ADMIN_USER,
          updatedAt: NOW_STR,
        }
      : n
  );
  emit();
};

export const removeNotice = (id: number) => {
  allNotices = allNotices.map((n) =>
    n.id === id ? { ...n, deleted: true } : n
  );
  emit();
};

export const duplicateNotice = (id: number): number | null => {
  const src = allNotices.find((n) => n.id === id);
  if (!src) return null;
  const newId = nextId();
  allNotices = [
    ...allNotices,
    {
      ...src,
      id: newId,
      title: `${src.title}（複製）`,
      status: 'draft',
      deleted: false,
      createdBy: ADMIN_USER,
      createdAt: NOW_STR,
      updatedBy: ADMIN_USER,
      updatedAt: NOW_STR,
    },
  ];
  emit();
  return newId;
};

export const getNotice = (id: number): NoticeItem | undefined =>
  allNotices.find((n) => n.id === id && !n.deleted);
