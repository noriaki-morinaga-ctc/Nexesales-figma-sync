import { describe, it, expect } from 'vitest';
import { PAYMENT_ORG_COMBOS } from './paymentOrgCascade';
import {
  storesForDept,
  deptOptionsFor,
  staffOptionsFor,
  applyOrgCascade,
  applyStoreOrgCascade,
  ownerOrgOf,
} from '@/utils/payment/payment-detail/paymentOrgCascade';
import type { PaymentOrgCombo } from '@/types/organization';
import { STORE_HIERARCHY, STORE_NONE } from './storeHierarchy';

// 実データ（PAYMENT_ORG_COMBOS）は 販売店:部署 = N:1、部署:担当者 = 1:1 のため、
// 「候補が複数残る」ケースを検証するためのテスト専用マスタを併用する。
//   部署A : 販売店X・販売店Y（N:1）／担当者1・担当者2（1:N）
//   部署B : 販売店Z／担当者3
//   ※ 販売店Y は担当者1のみ、販売店X は担当者1・2の両方が担当する。
const FIXTURE: PaymentOrgCombo[] = [
  {
    targetMonth: '2025/10',
    store: '販売店X:1',
    dept: '部署A:100',
    staff: '担当者1:900',
  },
  {
    targetMonth: '2025/10',
    store: '販売店X:1',
    dept: '部署A:100',
    staff: '担当者2:901',
  },
  {
    targetMonth: '2025/10',
    store: '販売店Y:2',
    dept: '部署A:100',
    staff: '担当者1:900',
  },
  {
    targetMonth: '2025/10',
    store: '販売店Z:3',
    dept: '部署B:200',
    staff: '担当者3:902',
  },
  // 対象年月違い（2025/11）。同じ販売店でも別部署・別担当者の支払が存在する。
  {
    targetMonth: '2025/11',
    store: '販売店X:1',
    dept: '部署C:300',
    staff: '担当者4:903',
  },
];

const values = (options: { value: string }[]) => options.map((o) => o.value);

describe('選択肢の絞り込み', () => {
  it('部署を選ぶと、その部署の支払が存在する販売店だけが候補になる', () => {
    expect(storesForDept('部署A:100', '2025/10', FIXTURE)).toEqual([
      '販売店X:1',
      '販売店Y:2',
    ]);
  });

  it('販売店を選ぶと、その販売店の支払が存在する部署だけが候補になる', () => {
    expect(values(deptOptionsFor('販売店Z:3', '', '2025/10', FIXTURE))).toEqual(
      ['部署B:200']
    );
  });

  it('部署を選ぶと、その部署の支払が存在する担当者だけが候補になる', () => {
    expect(
      values(staffOptionsFor(STORE_NONE, '部署A:100', '2025/10', FIXTURE))
    ).toEqual(['担当者1:900', '担当者2:901']);
  });

  it('販売店と部署の両方を選ぶと、両方に合致する担当者だけが候補になる', () => {
    expect(
      values(staffOptionsFor('販売店Y:2', '部署A:100', '2025/10', FIXTURE))
    ).toEqual(['担当者1:900']);
  });

  it('対象年月が異なる支払の組合せは候補に出ない', () => {
    expect(values(deptOptionsFor('販売店X:1', '', '2025/10', FIXTURE))).toEqual(
      ['部署A:100']
    );
    expect(values(deptOptionsFor('販売店X:1', '', '2025/11', FIXTURE))).toEqual(
      ['部署C:300']
    );
  });

  it('対象年月は「YYYY年M月」表記でも「YYYY/MM」と同じ結果になる', () => {
    expect(
      values(deptOptionsFor('販売店X:1', '', '2025年10月', FIXTURE))
    ).toEqual(['部署A:100']);
  });
});

describe('applyOrgCascade：販売店の選択', () => {
  it('部署が一意に定まる販売店を選ぶと、部署が自動でセットされる', () => {
    const next = applyOrgCascade(
      { store: STORE_NONE, dept: '', staff: '' },
      'store',
      '販売店Y:2',
      '2025/10',
      FIXTURE
    );
    // 販売店Y は 部署A・担当者1 の組合せしか存在しないため、両方が確定する。
    expect(next).toEqual({
      store: '販売店Y:2',
      dept: '部署A:100',
      staff: '担当者1:900',
    });
  });

  it('選択中の部署・担当者が組合せに無くなったらクリアされる', () => {
    const next = applyOrgCascade(
      { store: '販売店X:1', dept: '部署A:100', staff: '担当者2:901' },
      'store',
      '販売店Z:3',
      '2025/10',
      FIXTURE
    );
    expect(next).toEqual({
      store: '販売店Z:3',
      dept: '部署B:200',
      staff: '担当者3:902',
    });
  });

  it('販売店を未選択に戻しても部署・担当者は維持される（絞り込まない）', () => {
    const next = applyOrgCascade(
      { store: '販売店X:1', dept: '部署A:100', staff: '担当者2:901' },
      'store',
      STORE_NONE,
      '2025/10',
      FIXTURE
    );
    expect(next).toEqual({
      store: STORE_NONE,
      dept: '部署A:100',
      staff: '担当者2:901',
    });
  });
});

describe('applyOrgCascade：部署の選択', () => {
  it('候補が複数ある担当者は自動選択されない', () => {
    const next = applyOrgCascade(
      { store: STORE_NONE, dept: '', staff: '' },
      'dept',
      '部署A:100',
      '2025/10',
      FIXTURE
    );
    expect(next).toEqual({ store: STORE_NONE, dept: '部署A:100', staff: '' });
  });

  it('組合せに無い販売店・担当者はクリアされる', () => {
    const next = applyOrgCascade(
      { store: '販売店X:1', dept: '部署A:100', staff: '担当者2:901' },
      'dept',
      '部署B:200',
      '2025/10',
      FIXTURE
    );
    expect(next).toEqual({
      store: STORE_NONE,
      dept: '部署B:200',
      staff: '担当者3:902',
    });
  });

  it('販売店が組合せに残っていれば維持される', () => {
    const next = applyOrgCascade(
      { store: '販売店X:1', dept: '', staff: '' },
      'dept',
      '部署A:100',
      '2025/10',
      FIXTURE
    );
    expect(next.store).toBe('販売店X:1');
  });
});

describe('applyOrgCascade：担当者の選択', () => {
  it('担当者を選ぶと部署が一意に定まり自動セットされる', () => {
    const next = applyOrgCascade(
      { store: STORE_NONE, dept: '', staff: '' },
      'staff',
      '担当者2:901',
      '2025/10',
      FIXTURE
    );
    // 担当者2 は 部署A・販売店X の組合せのみのため、販売店も一意だが自動選択はしない。
    expect(next.dept).toBe('部署A:100');
    expect(next.store).toBe(STORE_NONE);
  });

  it('組合せに無い販売店はクリアされる', () => {
    const next = applyOrgCascade(
      { store: '販売店Y:2', dept: '部署A:100', staff: '担当者1:900' },
      'staff',
      '担当者3:902',
      '2025/10',
      FIXTURE
    );
    expect(next).toEqual({
      store: STORE_NONE,
      dept: '部署B:200',
      staff: '担当者3:902',
    });
  });
});

describe('applyStoreOrgCascade：商流3項目との合成', () => {
  const base = {
    primaryStore: '',
    tertiaryStore: '',
    store: STORE_NONE,
    dept: '',
    staff: '',
  };

  it('販売店を選ぶと一次店・三次店と、部署・担当者がまとめて確定する', () => {
    const next = applyStoreOrgCascade(
      base,
      'store',
      '21100677:イオンリテール',
      '2025/10'
    );
    expect(next.tertiaryStore).toBe('10863223:イオン東北ＲＤＣ');
    expect(next.primaryStore).toBe('10888030:三菱食品株式会社（イオン）');
    expect(next.dept).toBe('10002990:首都圏営業第二部');
    expect(next.staff).toBe('5172733:アサヒ　太郎');
  });

  it('一次店を変えて販売店が配下から外れると、部署・担当者もクリアされる', () => {
    const selected = applyStoreOrgCascade(
      base,
      'store',
      '21100677:イオンリテール',
      '2025/10'
    );
    const next = applyStoreOrgCascade(
      selected,
      'primaryStore',
      '10888062:加藤産業株式会社',
      '2025/10'
    );
    expect(next.store).toBe(STORE_NONE);
    // 販売店が未選択に戻っただけでは組織は絞り込まれないため、値は維持される。
    expect(next.dept).toBe('10002990:首都圏営業第二部');
  });

  it('担当者を選んで販売店が変わらない場合、商流の選択は維持される', () => {
    const selected = applyStoreOrgCascade(
      base,
      'store',
      '21100677:イオンリテール',
      '2025/10'
    );
    const next = applyStoreOrgCascade(
      selected,
      'staff',
      '5172733:アサヒ　太郎',
      '2025/10'
    );
    expect(next.primaryStore).toBe('10888030:三菱食品株式会社（イオン）');
    expect(next.store).toBe('21100677:イオンリテール');
  });
});

describe('PAYMENT_ORG_COMBOS（モックマスタ）', () => {
  it('担当者から部署が一意に定まる（決定2「担当者→部署一意」）', () => {
    const deptsByStaff = new Map<string, Set<string>>();
    for (const c of PAYMENT_ORG_COMBOS) {
      const set = deptsByStaff.get(c.staff) ?? new Set<string>();
      set.add(c.dept);
      deptsByStaff.set(c.staff, set);
    }
    for (const [staff, depts] of deptsByStaff) {
      expect(`${staff}:${depts.size}`).toBe(`${staff}:1`);
    }
  });

  it('同一の組合せが重複して登録されていない', () => {
    const keys = PAYMENT_ORG_COMBOS.map(
      (c) => `${c.targetMonth}|${c.store}|${c.dept}|${c.staff}`
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('マスタ由来の候補（対象年月を指定しない＝費用分割の分割先明細）', () => {
  it('販売店が未選択なら費用負担部署はマスタ全件', () => {
    expect(values(deptOptionsFor(STORE_NONE)).length).toBe(10);
  });

  it('販売店を選ぶと、その販売店に紐づく部署だけが候補になる', () => {
    expect(values(deptOptionsFor('21100677:イオンリテール'))).toEqual([
      '10002985:首都圏営業第一部',
      '10002990:首都圏営業第二部',
      '10000175:本社広域量販営業部',
    ]);
  });

  it('部署を選ぶと、その部署に所属する担当者だけが候補になる', () => {
    expect(
      values(staffOptionsFor(STORE_NONE, '10002985:首都圏営業第一部'))
    ).toEqual(['5172734:アサヒ　花子', '5172740:アサヒ　結衣']);
  });

  it('storesForDept は部署に紐づく販売店を返し、部署未選択なら undefined', () => {
    expect(storesForDept('')).toBeUndefined();
    expect(storesForDept('10003025:中四国営業部')).toEqual([
      '21100769:ヤオコー',
    ]);
  });

  it('担当者を選ぶと所属部署が自動設定される', () => {
    const next = applyOrgCascade(
      { store: STORE_NONE, dept: '', staff: '' },
      'staff',
      '5172740:アサヒ　結衣'
    );
    expect(next.dept).toBe('10002985:首都圏営業第一部');
  });

  it('費用負担部署をクリアすると担当者もクリアされる', () => {
    const next = applyOrgCascade(
      {
        store: '21100677:イオンリテール',
        dept: '10002985:首都圏営業第一部',
        staff: '5172734:アサヒ　花子',
      },
      'dept',
      ''
    );
    expect(next).toEqual({
      store: '21100677:イオンリテール',
      dept: '',
      staff: '',
    });
  });

  it('担当者をクリアしても自動で選び直されない（他項目は維持）', () => {
    const next = applyOrgCascade(
      {
        store: '21100758:ヨークベニマル',
        dept: '10003056:東北営業部',
        staff: '5172739:アサヒ　悠人',
      },
      'staff',
      ''
    );
    expect(next).toEqual({
      store: '21100758:ヨークベニマル',
      dept: '10003056:東北営業部',
      staff: '',
    });
  });

  it('販売店に紐づかない費用負担部署はクリアされる', () => {
    const next = applyOrgCascade(
      { store: STORE_NONE, dept: '10003002:中部営業部', staff: '' },
      'store',
      '21100677:イオンリテール'
    );
    expect(next.dept).toBe('');
  });
});

describe('商流販売店の担当組織', () => {
  it('販売店の担当組織（事業場・担当部署・営業担当者）を返す', () => {
    expect(ownerOrgOf('21100677:イオンリテール')).toEqual({
      office: '10000623:首都圏本部',
      dept: '10002990:首都圏営業第二部',
      terminalOrg: '10002990:首都圏営業第二部',
      staff: '5172733:アサヒ　太郎',
    });
  });

  it('担当末端組織は担当部署と同値（代行入力の明細を持たないモックの扱い）', () => {
    const owner = ownerOrgOf('21100758:ヨークベニマル');
    expect(owner.terminalOrg).toBe(owner.dept);
  });

  it('販売店が未選択（「-」・空文字）のときは全項目が空', () => {
    const none = { office: '', dept: '', terminalOrg: '', staff: '' };
    expect(ownerOrgOf(STORE_NONE)).toEqual(none);
    expect(ownerOrgOf('')).toEqual(none);
  });

  it('担当組織が未登録の販売店は全項目が空', () => {
    expect(ownerOrgOf('99999999:未登録販売店')).toEqual({
      office: '',
      dept: '',
      terminalOrg: '',
      staff: '',
    });
  });

  it('基本情報で選べる販売店（商流マスタ）には漏れなく担当組織がある', () => {
    const stores = STORE_HIERARCHY.flatMap((p) =>
      p.tertiaries.flatMap((t) => t.stores)
    );
    const missing = stores.filter((s) => !ownerOrgOf(s).dept);
    expect(missing).toEqual([]);
  });
});
