// 計画詳細(マージン率固定)：EDI反映の固定ダミー（モック。バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// 画面は src/app/components/sales-plan/plan-detail-margin-rate-fixed/page.tsx。

import {
  PLAN_DETAIL_DIGITS,
  roundPlanNumber,
} from '@/app/utils/sales-plan/common/planDetailNumberFormat';
import type { CommentHistoryItem } from '@/app/components/shared/common/CommentHistoryPane';
import type { MarginRate } from '@/app/types/planDetail';

// EDI反映の固定ダミー生成用。納価-計画（初期値）を基準にオフセットを与え、
// 差異±1.00未満（強調なし）／±1.00以上（強調）が混在するようにする。一部は空欄（ー）。
export const EDI_OFFSETS = [0.3, -0.5, 0.8, 1.5, -2.2, 3.1, -0.2, 2.6];

export const hashStr = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

// EDI反映の固定値。納価-計画を編集しても EDI反映 は固定のままなので、
// 「納価-計画 と EDI反映 の差異が±1.00以上」で強調表示が動的に切り替わる。
export const fixedEdi = (id: string, planPrice?: string): string => {
  const s = hashStr(id);
  if (s % 4 === 0) return ''; // 適度にデータなし（ー）
  const plan = parseFloat(String(planPrice ?? '').replace(/,/g, ''));
  if (!(plan > 0)) return '';
  return roundPlanNumber(
    plan + EDI_OFFSETS[s % EDI_OFFSETS.length],
    PLAN_DETAIL_DIGITS.price
  );
};

// コメント履歴ペイン（shared/common/CommentHistoryPane）のモックデータ。
// 操作（申請・引戻し・承認・差戻し）と、その操作の後の計画ステータスで表す。
// 流れ：申請 → 引戻し → 申請 → 差戻し → 申請 → 承認
// 共通ペインの持ち方に合わせて古い順（日時の昇順）で並べる（表示は新しい順）。
export const COMMENT_HISTORY_DATA: CommentHistoryItem[] = [
  {
    actionType: '申請',
    status: '承認待ち',
    datetime: '2025/02/20 15:54:45',
    userName: '河〇　雅◇',
    comment: '販促NETは競合対策提示条件。',
  },
  {
    actionType: '引戻し',
    status: '未申請',
    datetime: '2025/02/20 16:02:10',
    userName: '河〇　雅◇',
    comment: '販促の条件を見直すため引き戻します。',
  },
  {
    actionType: '申請',
    status: '承認待ち',
    datetime: '2025/02/20 16:14:25',
    userName: '河〇　雅◇',
    comment: '販促の条件を見直したため、再度申請します。',
  },
  {
    actionType: '差戻し',
    status: '差戻し',
    datetime: '2025/02/20 18:47:05',
    userName: '◇山　〇郎',
    comment: '函数計画を前年販売実績120%となるよう更新すること。',
  },
  {
    actionType: '申請',
    status: '承認待ち',
    datetime: '2025/02/21 9:30:45',
    userName: '河〇　雅◇',
    comment: '函数計画を前年販売実績120%となるように修正。',
  },
  {
    actionType: '承認',
    status: '承認済み',
    datetime: '2025/02/21 12:47:05',
    userName: '◇山　〇郎',
    comment: '',
  },
];

export const SAMPLE_STORES = [
  { tier1: '三菱食品株式会社（イオン）', tier3: 'イオン東北ＲＤＣ' },
  {
    tier1: '加藤産業株式会社　仙台支店イオンＲＤＣ',
    tier3: 'イオン商品調達株式会社　ＡＧＭ東北ＲＤＣ',
  },
  {
    tier1: '伊藤忠食品株式会社　仙台支店',
    tier3: '伊藤忠食品株式会社　仙台支店',
  },
];

export const RETAIL_MARGIN_RATES: MarginRate[] = [
  {
    tier1: '三菱食品株式会社（イオン）',
    tier3: 'イオン東北ＲＤＣ',
    rate: 7.62,
  },
  {
    tier1: '加藤産業株式会社　仙台支店イオンＲＤＣ',
    tier3: 'イオン商品調達株式会社　ＡＧＭ東北ＲＤＣ',
    rate: 7.62,
  },
  {
    tier1: '伊藤忠食品株式会社　仙台支店',
    tier3: '伊藤忠食品株式会社　仙台支店',
    rate: 7.62,
  },
];
