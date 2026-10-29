import { describe, it, expect } from 'vitest';
import {
  SPLIT_DESTINATION_CANDIDATES,
  PREV_MONTH_SPLIT,
  SPLIT_IN_ENTRY_ROWS,
} from './additionalEntrySplitMockData';
import { createEntryRows } from '../components/payment/payment-detail-with-invoice/components/DetailTable';
import {
  alertLineNos,
  calcSplitAmount,
  effectiveAllocations,
} from '../utils/additionalEntrySplit';

// 自部署（基本情報の部署）。分割先候補に含めてはならない。
const SELF_DEPT_CODE = '10002990';

describe('SPLIT_DESTINATION_CANDIDATES', () => {
  it('自部署を含まない', () => {
    expect(
      SPLIT_DESTINATION_CANDIDATES.some((d) => d.deptCode === SELF_DEPT_CODE)
    ).toBe(false);
  });

  it('id（三次店コード）が重複しない', () => {
    const ids = SPLIT_DESTINATION_CANDIDATES.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('すべて当該支払の販売店に紐づく', () => {
    expect(
      SPLIT_DESTINATION_CANDIDATES.every((d) => d.storeCode === '21100677')
    ).toBe(true);
  });
});

describe('PREV_MONTH_SPLIT', () => {
  const candidateIds = new Set(SPLIT_DESTINATION_CANDIDATES.map((d) => d.id));
  const entries = createEntryRows();

  it('前月の分割先はすべて候補に含まれる', () => {
    expect(PREV_MONTH_SPLIT.destIds.every((id) => candidateIds.has(id))).toBe(
      true
    );
  });

  it('入力はすべて前月の分割先のもの', () => {
    const destIds = new Set(PREV_MONTH_SPLIT.destIds);
    expect(
      PREV_MONTH_SPLIT.allocations.every((a) => destIds.has(a.destId))
    ).toBe(true);
  });

  it('入力はすべて追加口明細に存在する No. のもの', () => {
    const lineNos = new Set(entries.map((e) => String(e.lineNo)));
    expect(
      PREV_MONTH_SPLIT.allocations.every((a) => lineNos.has(String(a.lineNo)))
    ).toBe(true);
  });

  it('ケース・バラとも 0 の入力を持たない（0 の組み合わせは作らない）', () => {
    expect(effectiveAllocations(PREV_MONTH_SPLIT.allocations)).toHaveLength(
      PREV_MONTH_SPLIT.allocations.length
    );
  });

  it('追加口明細に当てはめても自部署負担分がマイナスの明細が出ない', () => {
    expect(alertLineNos(entries, PREV_MONTH_SPLIT.allocations)).toEqual([]);
  });

  it('No.5 は分割しない明細として入力を持たない', () => {
    expect(
      PREV_MONTH_SPLIT.allocations.some((a) => String(a.lineNo) === '5')
    ).toBe(false);
  });
});

describe('SPLIT_IN_ENTRY_ROWS', () => {
  it('追加口金額は（ケース × 入数 ＋ バラ）× 追加口バラ単価', () => {
    for (const row of SPLIT_IN_ENTRY_ROWS) {
      expect(row.addAmount, `No.${row.lineNo}`).toBe(
        calcSplitAmount(row.cases, row.loose, row.capacity, row.addUnit)
      );
    }
  });

  it('No. は 1 からの連番', () => {
    expect(SPLIT_IN_ENTRY_ROWS.map((r) => r.lineNo)).toEqual(
      SPLIT_IN_ENTRY_ROWS.map((_, i) => i + 1)
    );
  });

  it('ケース・バラとも 0 の行を持たない', () => {
    expect(
      SPLIT_IN_ENTRY_ROWS.some((r) => r.cases === 0 && r.loose === 0)
    ).toBe(false);
  });

  it('分割元は自部署以外の1部署（1つの追加口が複数部署から分割されることはない）', () => {
    const srcDepts = new Set(SPLIT_IN_ENTRY_ROWS.map((r) => r.srcDept));
    expect(srcDepts.size).toBe(1);
    expect([...srcDepts][0].includes(SELF_DEPT_CODE)).toBe(false);
  });
});
