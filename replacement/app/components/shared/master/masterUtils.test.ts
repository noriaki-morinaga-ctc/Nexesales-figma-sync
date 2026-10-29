import { describe, expect, it } from 'vitest';
import type { MasterRow, MasterScreenDef } from './masterTypes';
import { masterMessage } from '../../../constants/masterMessages';
import {
  END_OF_MONTH,
  END_OF_TIME,
  applyCriteria,
  dayBefore,
  deleteKeyDisplay,
  emptyDraft,
  endOfTimeOf,
  monthBefore,
  periodBefore,
  resolveMasterDef,
  startFromKey,
  predecessorOf,
  startToKey,
  validateDraft,
  withCascade,
  withGenerationInfo,
} from './masterUtils';

// 世代管理のマスタ（業務キー＝商品・部署、事業場は部署の親）
const DEF: MasterScreenDef = {
  routeId: 'test-master',
  title: 'テストマスタ',
  entityLabel: 'テスト',
  fields: [
    {
      key: 'product',
      label: '商品',
      kind: 'combo',
      pk: true,
      required: true,
      options: [
        { code: 'P1', name: '商品1' },
        { code: 'P2', name: '商品2' },
      ],
    },
    {
      key: 'office',
      label: '事業場',
      kind: 'combo',
      options: [
        { code: 'O1', name: '事業場1' },
        { code: 'O2', name: '事業場2' },
      ],
    },
    {
      key: 'dept',
      label: '部署',
      kind: 'combo',
      pk: true,
      required: true,
      options: [
        { code: 'D1', name: '部署1' },
        { code: 'D2', name: '部署2' },
      ],
      parentKey: 'office',
      parentOf: { D1: 'O1', D2: 'O2' },
    },
    { key: 'start', label: '適用開始年月日', kind: 'date', pk: true },
    { key: 'end', label: '適用終了年月日', kind: 'date' },
    { key: 'net', label: 'NET', kind: 'number' },
  ],
  searchKeys: ['product', 'dept', 'start', 'end'],
  generation: { startKey: 'start', endKey: 'end' },
};

const row = (
  id: string,
  product: string,
  start: string,
  end: string
): MasterRow => ({
  id,
  product,
  office: 'O1',
  dept: 'D1',
  start,
  end,
  net: 1,
  createdBy: '',
  createdAt: '',
  updatedBy: '',
  updatedAt: '',
});

const ROWS: MasterRow[] = [
  row('p1-old', 'P1', '2025/04/01', '2026/03/31'),
  row('p1-new', 'P1', '2026/04/01', END_OF_TIME),
  row('p2-old', 'P2', '2024/04/01', END_OF_TIME),
];

describe('resolveMasterDef', () => {
  it('適用終了年月日を必須にし、検索条件から外す', () => {
    const def = resolveMasterDef(DEF);
    expect(def.fields.find((f) => f.key === 'end')?.required).toBe(true);
    expect(def.searchKeys).toEqual(['product', 'dept', 'start']);
  });
});

describe('emptyDraft', () => {
  it('適用終了年月日の初期値は 4000/12/31', () => {
    expect(emptyDraft(DEF).end).toBe(END_OF_TIME);
  });
});

describe('applyCriteria（世代管理）', () => {
  it('適用開始年月日の From〜To は最新世代で判定し、当てはまった業務キーは全世代を返す', () => {
    const hit = applyCriteria(DEF, ROWS, {
      [startFromKey(DEF)]: '2026/01/01',
      [startToKey(DEF)]: '2026/12/31',
    });
    expect(hit.map((r) => r.id)).toEqual(['p1-old', 'p1-new']);
  });

  it('過去の世代だけが当てはまる業務キーは返さない', () => {
    const hit = applyCriteria(DEF, ROWS, {
      [startFromKey(DEF)]: '2025/01/01',
      [startToKey(DEF)]: '2025/12/31',
    });
    expect(hit).toEqual([]);
  });
});

describe('withGenerationInfo', () => {
  it('適用開始年月日が最も新しい世代を親にする', () => {
    const grid = withGenerationInfo(DEF, ROWS);
    const latest = grid.filter((r) => r.isLatestGeneration).map((r) => r.id);
    expect(latest).toEqual(['p1-new', 'p2-old']);
  });
});

describe('withCascade', () => {
  it('子（部署）を選ぶと親（事業場）を設定する', () => {
    expect(withCascade(DEF, { office: '', dept: '' }, 'dept', 'D2')).toEqual({
      office: 'O2',
      dept: 'D2',
    });
  });

  it('親を変えたら合わない子をクリアする', () => {
    expect(
      withCascade(DEF, { office: 'O1', dept: 'D1' }, 'office', 'O2')
    ).toEqual({ office: 'O2', dept: '' });
  });
});

describe('deleteKeyDisplay', () => {
  it('世代管理のマスタは適用開始年月日も出す', () => {
    expect(deleteKeyDisplay(DEF, ROWS[1])).toBe(
      'P1:商品1 / D1:部署1 / 適用開始年月日 2026/04/01'
    );
  });
});

describe('前の世代の自動終了（新しい世代の登録）', () => {
  const draft = (start: string) => ({
    product: 'P1',
    office: 'O1',
    dept: 'D1',
    start,
    end: END_OF_TIME,
    net: '2',
  });
  const def = resolveMasterDef(DEF);

  it('dayBefore は月・年をまたいで前日を返す', () => {
    expect(dayBefore('2027/04/01')).toBe('2027/03/31');
    expect(dayBefore('2027/01/01')).toBe('2026/12/31');
    expect(dayBefore('2028/03/01')).toBe('2028/02/29');
  });

  it('期間が重なる最も新しい前の世代を返す', () => {
    expect(predecessorOf(def, ROWS, draft('2027/04/01'))?.id).toBe('p1-new');
  });

  it('前の世代との重なりはエラーにしない（登録時に前日にする）', () => {
    expect(validateDraft(def, draft('2027/04/01'), ROWS, 'copy', null)).toEqual(
      []
    );
  });

  it('同じ適用開始年月日や、新しい世代より前の開始はエラー', () => {
    expect(
      validateDraft(def, draft('2026/04/01'), ROWS, 'copy', null).length
    ).toBe(1);
    expect(
      validateDraft(def, draft('2025/10/01'), ROWS, 'copy', null).length
    ).toBe(1);
  });

  it('適用終了年月日が主キーのマスタは対象外', () => {
    const pkEnd: MasterScreenDef = {
      ...def,
      fields: def.fields.map((f) => (f.key === 'end' ? { ...f, pk: true } : f)),
    };
    expect(predecessorOf(pkEnd, ROWS, draft('2027/04/01'))).toBeUndefined();
  });
});

describe('メッセージは共通メッセージ一覧の文言', () => {
  const def = resolveMasterDef(DEF);
  it('必須・形式・重なりの文言', () => {
    const errs = validateDraft(
      def,
      {
        product: '',
        office: 'O1',
        dept: 'D1',
        start: '2026-04-01',
        end: END_OF_TIME,
        net: 'x',
      },
      ROWS,
      'create',
      null
    );
    // 項目の定義順（商品 → 適用開始年月日 → NET）に出る
    expect(errs).toEqual([
      masterMessage('MSG-E-015', '商品'),
      masterMessage(
        'MSG-E-008',
        '適用開始年月日は YYYY/MM/DD の形式で入力してください。'
      ),
      masterMessage('MSG-E-004', 'NET'),
    ]);
    const overlap = validateDraft(
      def,
      {
        product: 'P1',
        office: 'O1',
        dept: 'D1',
        start: '2026/04/01',
        end: END_OF_TIME,
        net: '2',
      },
      ROWS,
      'copy',
      null
    );
    expect(overlap).toEqual([
      masterMessage('MSG-E-016', 'テストの世代', '登録'),
    ]);
  });
});

describe('年月の適用期間（販売店条件口率・管理対象商品）', () => {
  const MONTH_DEF: MasterScreenDef = {
    ...DEF,
    fields: DEF.fields.map((f) =>
      f.key === 'start' || f.key === 'end' ? { ...f, kind: 'month' } : f
    ),
  };
  const def = resolveMasterDef(MONTH_DEF);
  const mrows: MasterRow[] = [
    { ...row('m1-old', 'P1', '2025/04', '2026/03') },
    { ...row('m1-new', 'P1', '2026/04', END_OF_MONTH) },
  ];
  it('有効なデータの終了は 4000/12、前は前月', () => {
    expect(endOfTimeOf(def)).toBe(END_OF_MONTH);
    expect(emptyDraft(def).end).toBe(END_OF_MONTH);
    expect(monthBefore('2027/01')).toBe('2026/12');
    expect(periodBefore(def, '2027/04')).toBe('2027/03');
  });
  it('年月でも前の世代を見つけ、重なりはエラーにしない', () => {
    const d = {
      product: 'P1',
      office: 'O1',
      dept: 'D1',
      start: '2027/04',
      end: END_OF_MONTH,
      net: '2',
    };
    expect(predecessorOf(def, mrows, d)?.id).toBe('m1-new');
    expect(validateDraft(def, d, mrows, 'copy', null)).toEqual([]);
    expect(
      validateDraft(def, { ...d, start: '2027-04' }, mrows, 'copy', null)
    ).toEqual([
      masterMessage(
        'MSG-E-008',
        '適用開始年月日は YYYY/MM の形式で入力してください。'
      ),
    ]);
  });
});

describe('ユニーク制約（一般卸メッシュ）', () => {
  const UNIQ_DEF: MasterScreenDef = {
    ...DEF,
    fields: [
      { key: 'code', label: 'コード', kind: 'text', pk: true, readOnly: true },
      ...DEF.fields
        .filter(
          (f) => f.key !== 'product' && f.key !== 'dept' && f.key !== 'office'
        )
        .map((f) => (f.key === 'net' ? { ...f, unique: true } : f)),
      { key: 'brand', label: 'ブランド', kind: 'text', unique: true },
    ],
    searchKeys: ['start'],
    autoNumberKey: 'code',
  };
  const def = resolveMasterDef(UNIQ_DEF);
  const urows: MasterRow[] = [
    {
      id: 'u1',
      code: 'C1',
      start: '2026/04/01',
      end: END_OF_TIME,
      net: 1,
      brand: 'B1',
      createdBy: '',
      createdAt: '',
      updatedBy: '',
      updatedAt: '',
    },
  ];
  it('同じ組（＋適用開始）は重複エラー、適用開始が違えば登録できる', () => {
    const same = {
      code: '',
      start: '2026/04/01',
      end: END_OF_TIME,
      net: '1',
      brand: 'B1',
    };
    expect(validateDraft(def, same, urows, 'create', null)).toEqual([
      masterMessage(
        'MSG-E-012',
        'NET・ブランド・適用開始年月日',
        'テスト',
        '登録'
      ),
    ]);
    expect(
      validateDraft(
        def,
        { ...same, start: '2027/04/01' },
        urows,
        'create',
        null
      )
    ).toEqual([]);
  });
});
