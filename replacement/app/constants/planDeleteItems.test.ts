import { describe, it, expect } from 'vitest';
import {
  expenseDeleteItems,
  hasSimulationExpense,
  planDetailKeyItems,
  simulationExpenseItems,
  simulationKeyItems,
} from './planDeleteItems';
import type { NonProductExpenseData } from '../types/nonProductExpense';

// 削除確認ペインのラベルだけを取り出す（並び順の検証用）。
const labels = (items: { label: string }[]): string[] =>
  items.map((item) => item.label);

// ラベルから値を引く。
const valueOf = (items: { label: string; value: unknown }[], label: string) =>
  items.find((item) => item.label === label)?.value;

describe('planDetailKeyItems（補足5-1 の販売計画更新KEY）', () => {
  const targetYearMonth = '2025/10';

  it('マージン率固定・NET入力：定番商品は対象年月・サマリ商品名・商品区分・販促区分', () => {
    const items = planDetailKeyItems(
      'marginNet',
      {
        productCategory: '定番商品',
        summaryProduct: '三ツ矢サイダー350mL28本',
        promotion: '定番・EDLP',
      },
      targetYearMonth
    );
    expect(labels(items)).toEqual([
      '対象年月',
      'サマリ商品名',
      '商品区分',
      '販促区分',
    ]);
    expect(valueOf(items, '対象年月')).toBe('2025年10月');
    // サマリ商品名・販促区分は基本情報と同じ「コード:名称」表記
    expect(valueOf(items, 'サマリ商品名')).toMatch(
      /^P\d{4}:三ツ矢サイダー350mL28本$/
    );
    expect(valueOf(items, '販促区分')).toMatch(/^PR\d{3}:定番・EDLP$/);
  });

  it('マージン率固定・NET入力：ギフトは販売期間が加わる', () => {
    const items = planDetailKeyItems(
      'marginNet',
      { productCategory: 'ギフト', summaryProduct: 'カルピスギフトセット' },
      targetYearMonth
    );
    expect(labels(items)).toEqual([
      '対象年月',
      'サマリ商品名',
      '商品区分',
      '販促区分',
      '販売期間',
    ]);
    expect(valueOf(items, '販売期間')).toBe('上旬・中旬・下旬');
  });

  it('NET固定：定番商品はサマリ商品名ではなく一般卸メッシュがKEY', () => {
    const items = planDetailKeyItems(
      'netFixed',
      {
        productCategory: '定番商品',
        summaryProduct: '三ツ矢サイダー350mL28本',
        wholesaleMesh: '【三ツ矢150円】三ツ矢サイダー28・350',
        promotion: '定番・EDLP',
      },
      targetYearMonth
    );
    expect(labels(items)).toEqual([
      '対象年月',
      '一般卸メッシュ',
      '商品区分',
      '販促区分',
    ]);
    expect(valueOf(items, '一般卸メッシュ')).toBe(
      '【三ツ矢150円】三ツ矢サイダー28・350'
    );
  });

  it('NET固定：新商品はサマリ商品名がKEY（NETは含まない）', () => {
    const items = planDetailKeyItems(
      'netFixed',
      {
        productCategory: '新商品',
        summaryProduct: '三ツ矢特濃グレープ',
        net: '89.16',
      },
      targetYearMonth
    );
    expect(labels(items)).toEqual([
      '対象年月',
      'サマリ商品名',
      '商品区分',
      '販促区分',
    ]);
  });

  it('NET固定：特殊商品はNETが加わる', () => {
    const items = planDetailKeyItems(
      'netFixed',
      { productCategory: '特殊商品', summaryProduct: '特殊A', net: '21.50' },
      targetYearMonth
    );
    expect(labels(items)).toEqual([
      '対象年月',
      'サマリ商品名',
      '商品区分',
      '販促区分',
      'NET',
    ]);
    expect(valueOf(items, 'NET')).toBe('21.50');
    // 特殊商品の販促区分は区分名で固定表示される（コード:名称）
    expect(valueOf(items, '販促区分')).toMatch(/^PR\d{3}:特殊商品$/);
  });

  it('NET固定：ギフトは販売期間とNETが加わる', () => {
    const items = planDetailKeyItems(
      'netFixed',
      {
        productCategory: 'ギフト',
        summaryProduct: '十六茶ギフトセット',
        net: '174.00',
      },
      targetYearMonth
    );
    expect(labels(items)).toEqual([
      '対象年月',
      'サマリ商品名',
      '商品区分',
      '販促区分',
      '販売期間',
      'NET',
    ]);
  });

  it('値が無い項目は「-」で表示する', () => {
    const items = planDetailKeyItems('netFixed', undefined, targetYearMonth);
    expect(valueOf(items, 'サマリ商品名')).toBe('-');
    expect(valueOf(items, '商品区分')).toBe('-');
    expect(valueOf(items, '販促区分')).toBe('-');
  });
});

describe('expenseDeleteItems（拡売費計画の削除確認項目）', () => {
  const row: NonProductExpenseData = {
    no: 1,
    metaBrand: 'カルピス',
    summaryProduct: 'カルピスウォーター500mL24本',
    exp1PlannedAmount: 80000,
    exp1PriorYearActual: 70000,
    exp1PaymentActual: 60000,
    exp1PostingMonth: '2025/10',
    exp1ManagementClass: '売上連動拡売費本社口',
    exp1ManagementCode: 'RH002',
    exp1AccountItem: '販売促進費',
    exp1CampaignClass: 'スポット',
    exp1CampaignCode: 'SS002',
    exp1Description: 'サンプリング費用',
    exp1Creator: 'アサヒ　太郎',
  };

  it('拡売費グリッドと同じ並びでメタブランド～摘要1(社内用)を並べる', () => {
    expect(labels(expenseDeleteItems(row))).toEqual([
      'メタブランド',
      'サマリ商品名',
      '計画金額',
      '計上年月',
      '管理区分',
      '管理区分名称',
      '管理コード',
      '管理コード名称',
      '施策区分',
      '施策区分名称',
      '施策コード',
      '施策コード名称',
      '摘要1(社内用)',
    ]);
  });

  it('前年実績・実績金額は表示しない', () => {
    const shown = labels(expenseDeleteItems(row));
    for (const label of ['前年実績', '実績金額']) {
      expect(shown).not.toContain(label);
    }
  });

  it('作成者は showCreator を指定した画面（拡売費計画(紐づき無し)）だけ末尾に表示する', () => {
    expect(labels(expenseDeleteItems(row))).not.toContain('作成者');
    const items = expenseDeleteItems(row, { showCreator: true });
    expect(labels(items).at(-1)).toBe('作成者');
    expect(valueOf(items, '作成者')).toBe('アサヒ　太郎');
  });

  it('メタブランド・サマリ商品名は「コード:名称」で表示する', () => {
    const items = expenseDeleteItems(row);
    expect(valueOf(items, 'メタブランド')).toMatch(/^.+:カルピス$/);
    expect(valueOf(items, 'サマリ商品名')).toMatch(
      /^P\d{4}:カルピスウォーター500mL24本$/
    );
    expect(valueOf(items, '計画金額')).toBe('80,000');
    expect(valueOf(items, '計上年月')).toBe('2025/10');
    expect(valueOf(items, '摘要1(社内用)')).toBe('サンプリング費用');
  });

  it('行が保持しない側（管理区分の区分値・管理コード名称など）は相互変換で補う', () => {
    const items = expenseDeleteItems(row);
    // 行は管理区分の名称／管理コードのコードだけを保持する
    expect(valueOf(items, '管理区分名称')).toBe('売上連動拡売費本社口');
    expect(valueOf(items, '管理区分')).not.toBe('-');
    expect(valueOf(items, '管理コード')).toBe('RH002');
    expect(valueOf(items, '管理コード名称')).not.toBe('-');
    // 施策も同様に区分値・コード名称を導出する
    expect(valueOf(items, '施策区分名称')).toBe('スポット');
    expect(valueOf(items, '施策区分')).not.toBe('-');
    expect(valueOf(items, '施策コード')).toBe('SS002');
    expect(valueOf(items, '施策コード名称')).not.toBe('-');
  });

  it('行が無いときは全項目を「-」で表示する', () => {
    const items = expenseDeleteItems(undefined, { showCreator: true });
    expect(items.every((item) => item.value === '-')).toBe(true);
  });
});

describe('simulationKeyItems（補足5-2 のKEY）', () => {
  const base = {
    targetMonth: '2025/11',
    campaign: '企画01',
    probability: 'A',
    productCategory: '定番商品',
    summaryProduct: '三ツ矢サイダー350mL28本',
    wholesaleMesh: '【三ツ矢150円】三ツ矢サイダー28・350',
    promotion: '定番・EDLP',
  };

  it('マージン率固定・NET入力：対象年月・企画・確度・サマリ商品名・商品区分・販促区分', () => {
    const items = simulationKeyItems('marginNet', base);
    expect(labels(items)).toEqual([
      '対象年月',
      '企画',
      '確度',
      'サマリ商品名',
      '商品区分',
      '販促区分',
    ]);
    expect(valueOf(items, '対象年月')).toBe('2025年11月');
    expect(valueOf(items, '企画')).toBe('企画01');
    expect(valueOf(items, '確度')).toBe('A');
  });

  it('NET固定：定番商品はサマリ商品名ではなく一般卸メッシュがKEY', () => {
    const items = simulationKeyItems('netFixed', base);
    expect(labels(items)).toEqual([
      '対象年月',
      '企画',
      '確度',
      '一般卸メッシュ',
      '商品区分',
      '販促区分',
    ]);
  });

  it('ギフトは販売期間が加わる（NETはKEYに含めない）', () => {
    const items = simulationKeyItems('netFixed', {
      ...base,
      productCategory: 'ギフト',
      summaryProduct: '十六茶ギフトセット',
    });
    expect(labels(items)).toEqual([
      '対象年月',
      '企画',
      '確度',
      'サマリ商品名',
      '商品区分',
      '販促区分',
      '販売期間',
    ]);
    expect(labels(items)).not.toContain('NET');
  });
});

describe('simulationExpenseItems（拡売費①②の内訳）', () => {
  const row = {
    metaBrand: 'カルピス',
    // 計画金額は「変更前金額」から改称した経緯で PlannedAmountBefore を保持する
    exp1PlannedAmountBefore: '80,000',
    exp1PostingMonth: '2025/11',
    exp1ManagementClass: '売上連動拡売費本社口',
    exp1ManagementCode: 'RH002',
    exp1CampaignClass: 'スポット',
    exp1CampaignCode: 'SS002',
    exp1Description: 'サンプリング費用',
  };

  it('拡売費列と同じ並びで計画金額～摘要1(社内用)を並べる', () => {
    const items = simulationExpenseItems(row, 'exp1');
    expect(labels(items)).toEqual([
      '計画金額',
      '計上年月',
      '管理区分',
      '管理区分名称',
      '管理コード',
      '管理コード名称',
      '施策区分',
      '施策区分名称',
      '施策コード',
      '施策コード名称',
      '摘要1(社内用)',
    ]);
    expect(valueOf(items, '計画金額')).toBe('80,000');
    expect(valueOf(items, '計上年月')).toBe('2025/11');
    expect(valueOf(items, '摘要1(社内用)')).toBe('サンプリング費用');
  });

  it('メタブランド・前年実績は表示しない', () => {
    const shown = labels(simulationExpenseItems(row, 'exp1'));
    for (const label of ['メタブランド', 'サマリ商品名', '前年実績']) {
      expect(shown).not.toContain(label);
    }
  });

  it('行が保持しない側（管理区分の区分値・管理コード名称など）は相互変換で補う', () => {
    const items = simulationExpenseItems(row, 'exp1');
    expect(valueOf(items, '管理区分名称')).toBe('売上連動拡売費本社口');
    expect(valueOf(items, '管理区分')).not.toBe('-');
    expect(valueOf(items, '管理コード')).toBe('RH002');
    expect(valueOf(items, '管理コード名称')).not.toBe('-');
    expect(valueOf(items, '施策区分名称')).toBe('スポット');
    expect(valueOf(items, '施策区分')).not.toBe('-');
    expect(valueOf(items, '施策コード')).toBe('SS002');
    expect(valueOf(items, '施策コード名称')).not.toBe('-');
  });

  it('未入力の拡売費は全項目を「-」で表示する', () => {
    const items = simulationExpenseItems(row, 'exp2');
    expect(items.every((item) => item.value === '-')).toBe(true);
  });

  it('入力の有無は計画金額・計上年月で判定する（未入力ブロックは畳んで表示する）', () => {
    expect(hasSimulationExpense(row, 'exp1')).toBe(true);
    // メタブランドは明細行の値なので、拡売費②の入力有無には影響しない
    expect(hasSimulationExpense(row, 'exp2')).toBe(false);
    expect(hasSimulationExpense(undefined, 'exp1')).toBe(false);
  });
});
