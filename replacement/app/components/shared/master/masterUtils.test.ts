import { describe, expect, it } from 'vitest';
import type { MasterRow, MasterScreenDef } from './masterTypes';
import { masterMessage } from '@/app/utils/common/masterMessages';
import {
  END_OF_MONTH,
  END_OF_TIME,
  applyCriteria,
  businessKeyDisplay,
  dayBefore,
  deleteKeyDisplay,
  emptyDraft,
  endOfTimeOf,
  hasUpdate,
  isWideField,
  monthBefore,
  optionName,
  paneWidthOf,
  periodBefore,
  resolveMasterDef,
  textareaRows,
  updatableFields,
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

describe('applyCriteria（複数選択・無効化）', () => {
  const plain: MasterScreenDef = { ...DEF, generation: undefined };
  const prows: MasterRow[] = [
    { ...row('a', 'P1', '', ''), inactive: false },
    { ...row('b', 'P2', '', ''), inactive: true },
  ];
  it('選択肢のある項目は配列（いずれかに一致）。未選択＝条件なし', () => {
    expect(applyCriteria(plain, prows, { product: [] }).length).toBe(2);
    expect(
      applyCriteria(plain, prows, { product: ['P2'] }).map((r) => r.id)
    ).toEqual(['b']);
    expect(applyCriteria(plain, prows, { product: ['P1', 'P2'] }).length).toBe(
      2
    );
  });
  it('無効化は有効／無効の複数選択（両方なら条件なし）', () => {
    expect(
      applyCriteria(plain, prows, { __inactive: ['inactive'] }).map((r) => r.id)
    ).toEqual(['b']);
    expect(
      applyCriteria(plain, prows, { __inactive: ['active'] }).map((r) => r.id)
    ).toEqual(['a']);
    expect(
      applyCriteria(plain, prows, { __inactive: ['active', 'inactive'] }).length
    ).toBe(2);
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

  it('検索条件（複数選択）：子を選ぶと所属する親を追加し、親を外すと選択肢外の子を外す', () => {
    expect(
      withCascade(DEF, { office: ['O1'], dept: [] }, 'dept', ['D2'])
    ).toEqual({ office: ['O1', 'O2'], dept: ['D2'] });
    expect(
      withCascade(DEF, { office: ['O1', 'O2'], dept: ['D1', 'D2'] }, 'office', [
        'O2',
      ])
    ).toEqual({ office: ['O2'], dept: ['D2'] });
    // 親をすべて外しても子は外さない（02 §9-2 ③）
    expect(
      withCascade(DEF, { office: ['O2'], dept: ['D2'] }, 'office', [])
    ).toEqual({ office: [], dept: ['D2'] });
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

describe('商品分類導出（QM-028・029）：内部コードの主キー・一意制約の組・桁と範囲・指定なし', () => {
  const RULE_DEF: MasterScreenDef = {
    routeId: 'rule-master',
    title: 'ルールマスタ',
    entityLabel: 'ルール',
    fields: [
      {
        key: 'ruleId',
        label: '導出ルールID',
        kind: 'text',
        pk: true,
        required: true,
        readOnly: true,
        hideInGrid: true,
        hideInForm: true,
      },
      {
        key: 'priority',
        label: '適用優先順',
        kind: 'number',
        required: true,
        format: 'integer',
        maxDigits: 3,
        min: 1,
        max: 999,
      },
      {
        key: 'brand',
        label: 'ブランド',
        kind: 'combo',
        emptyLabel: '指定なし',
        options: [{ code: 'B1', name: 'ブランド1' }],
      },
      {
        key: 'cls',
        label: '商品分類',
        kind: 'combo',
        required: true,
        options: [{ code: 'C1', name: '分類1' }],
      },
    ],
    searchKeys: ['brand', 'cls'],
    inactivation: true,
    autoNumberKey: 'ruleId',
    autoNumberPrefix: 'R',
    uniqueGroups: [
      { keys: ['priority'] },
      { keys: ['brand'], activeOnly: true },
    ],
    displayKeys: ['priority', 'cls'],
  };
  const rrows: MasterRow[] = [
    {
      id: 'r1',
      ruleId: 'R0001',
      priority: 10,
      brand: '',
      cls: 'C1',
      inactive: false,
      createdBy: '',
      createdAt: '',
      updatedBy: '',
      updatedAt: '',
    },
    {
      id: 'r2',
      ruleId: 'R0002',
      priority: 20,
      brand: 'B1',
      cls: 'C1',
      inactive: true,
      createdBy: '',
      createdAt: '',
      updatedBy: '',
      updatedAt: '',
    },
  ];
  const d = (priority: string, brand: string) => ({
    ruleId: '',
    priority,
    brand,
    cls: 'C1',
  });
  it('適用優先順は一意。判断軸の組は未設定も同じ値として比べ、無効化済みの行は除く', () => {
    expect(
      validateDraft(RULE_DEF, d('10', 'B1'), rrows, 'create', null)
    ).toEqual([masterMessage('MSG-E-012', '適用優先順', 'ルール', '登録')]);
    expect(validateDraft(RULE_DEF, d('30', ''), rrows, 'create', null)).toEqual(
      [masterMessage('MSG-E-012', 'ブランド', 'ルール', '登録')]
    );
    // r2（無効化済み）と同じ判断軸は登録できる
    expect(
      validateDraft(RULE_DEF, d('30', 'B1'), rrows, 'create', null)
    ).toEqual([]);
  });
  it('桁（3 桁）と範囲（1〜999）', () => {
    expect(
      validateDraft(RULE_DEF, d('0', 'B1'), rrows, 'create', null)
    ).toEqual([masterMessage('MSG-E-013', '適用優先順', '1')]);
    expect(
      validateDraft(RULE_DEF, d('1000', 'B1'), rrows, 'create', null)
    ).toEqual([masterMessage('MSG-E-004', '適用優先順')]);
    expect(
      validateDraft(RULE_DEF, d('999', 'B1'), rrows, 'create', null)
    ).toEqual([]);
  });
  it('未設定の判断軸は「指定なし」と表示し、確認ダイアログは displayKeys で示す', () => {
    const brand = RULE_DEF.fields[2];
    expect(optionName(brand, '')).toBe('指定なし');
    expect(optionName(brand, 'B1')).toBe('ブランド1');
    expect(businessKeyDisplay(RULE_DEF, rrows[0])).toBe('10 / C1:分類1');
  });
});

// ── 10/30（2回目）Q&A QM-032・033・034・020 ──
// 事業場→部署→社員の 2 段の親子。主キーは社員だけ（システム管理者設定）
const ADMIN_DEF: MasterScreenDef = {
  routeId: 'admin-test',
  title: 'システム管理者設定マスタ',
  entityLabel: 'システム管理者',
  fields: [
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
      options: [
        { code: 'D1', name: '部署1' },
        { code: 'D2', name: '部署2' },
        { code: 'D3', name: '部署3' },
      ],
      parentKey: 'office',
      parentOf: { D1: 'O1', D2: 'O1', D3: 'O2' },
    },
    {
      key: 'staff',
      label: '社員',
      kind: 'combo',
      pk: true,
      required: true,
      options: [
        { code: 'S1', name: '社員1' },
        { code: 'S2', name: '社員2' },
        { code: 'S3', name: '社員3' },
      ],
      parentKey: 'dept',
      parentOf: { S1: 'D1', S2: 'D2', S3: 'D3' },
    },
  ],
  searchKeys: ['office', 'dept', 'staff'],
  inactivation: true,
};

describe('更新ペインの有無（QM-033）：変更できる項目が無いマスタは更新を設けない', () => {
  it('主キーと、主キーの親（絞り込み用）だけのマスタは更新なし', () => {
    expect(updatableFields(ADMIN_DEF)).toEqual([]);
    expect(hasUpdate(ADMIN_DEF)).toBe(false);
  });
  it('主キー以外の項目（役職区分など）があれば更新あり。固定値・表示のみの項目は数えない', () => {
    const withAttr: MasterScreenDef = {
      ...ADMIN_DEF,
      fields: [
        ...ADMIN_DEF.fields,
        {
          key: 'cls',
          label: '役職区分',
          kind: 'combo',
          required: true,
          options: [],
        },
      ],
    };
    expect(hasUpdate(withAttr)).toBe(true);
    const onlyFixed: MasterScreenDef = {
      ...ADMIN_DEF,
      fields: [
        ...ADMIN_DEF.fields,
        {
          key: 'co',
          label: '共通会社',
          kind: 'combo',
          options: [],
          fixedValue: '0093',
        },
        { key: 'no', label: '番号', kind: 'text', readOnly: true },
      ],
    };
    expect(hasUpdate(onlyFixed)).toBe(false);
  });
});

describe('withCascade（2 段の親子。QM-032）', () => {
  it('社員を選ぶと部署と事業場を設定する', () => {
    const next = withCascade(
      ADMIN_DEF,
      { office: '', dept: '', staff: '' },
      'staff',
      'S3'
    );
    expect(next).toEqual({ office: 'O2', dept: 'D3', staff: 'S3' });
  });
  it('事業場を変えると、合わない部署と社員を外す（部署が空になっても社員の所属で判定）', () => {
    const next = withCascade(
      ADMIN_DEF,
      { office: 'O1', dept: 'D1', staff: 'S1' },
      'office',
      'O2'
    );
    expect(next).toEqual({ office: 'O2', dept: '', staff: '' });
  });
  it('部署を変えても事業場が同じなら事業場は保ち、合わない社員だけ外す', () => {
    const next = withCascade(
      ADMIN_DEF,
      { office: 'O1', dept: 'D1', staff: 'S1' },
      'dept',
      'D2'
    );
    expect(next).toEqual({ office: 'O1', dept: 'D2', staff: '' });
  });
  it('検索条件（複数選択）：社員を選ぶと部署・事業場に追加し、事業場を外すと配下の部署・社員を外す', () => {
    const picked = withCascade(
      ADMIN_DEF,
      { office: [], dept: [], staff: [] },
      'staff',
      ['S1', 'S3']
    );
    expect(picked).toEqual({
      office: ['O1', 'O2'],
      dept: ['D1', 'D3'],
      staff: ['S1', 'S3'],
    });
    const narrowed = withCascade(ADMIN_DEF, picked, 'office', ['O1']);
    expect(narrowed).toEqual({ office: ['O1'], dept: ['D1'], staff: ['S1'] });
  });
});

describe('長い文字の項目（QM-034）と数値のマイナス（QM-020・026）', () => {
  const TEXT_DEF: MasterScreenDef = {
    routeId: 'text-test',
    title: '通知管理マスタ',
    entityLabel: '通知',
    fields: [
      {
        key: 'no',
        label: '通知番号',
        kind: 'text',
        pk: true,
        required: true,
        readOnly: true,
      },
      { key: 'title', label: 'タイトル', kind: 'text', maxLength: 40 },
      { key: 'body', label: '本文', kind: 'textarea', maxLength: 200 },
      { key: 'mail', label: 'メール本文', kind: 'textarea', maxLength: 400 },
      { key: 'memo', label: 'メモ', kind: 'text', maxLength: 20 },
    ],
    searchKeys: ['no'],
  };
  it('40 文字以上の文字と複数行は幅の広い入力欄。画面の右ペインは 44rem', () => {
    expect(TEXT_DEF.fields.map(isWideField)).toEqual([
      false,
      true,
      true,
      true,
      false,
    ]);
    expect(paneWidthOf(TEXT_DEF)).toBe(44);
    expect(paneWidthOf(ADMIN_DEF)).toBe(34);
  });
  it('複数行の行数は文字数から（200 文字＝4 行、400 文字＝6 行、下限 3）', () => {
    expect(textareaRows(TEXT_DEF.fields[2])).toBe(4);
    expect(textareaRows(TEXT_DEF.fields[3])).toBe(6);
    expect(
      textareaRows({ key: 'x', label: 'x', kind: 'textarea', maxLength: 50 })
    ).toBe(3);
  });
  it('文字数の上限を超えると「値が正しくありません」', () => {
    const draft = {
      no: '',
      title: 'あ'.repeat(41),
      body: 'い'.repeat(200),
      mail: '',
      memo: '',
    };
    expect(validateDraft(TEXT_DEF, draft, [], 'create', null)).toEqual([
      masterMessage('MSG-E-004', 'タイトル'),
    ]);
  });
});
