import { describe, it, expect } from 'vitest';
import {
  roundHalfAway,
  toIntegerCount,
  calcSplitAmount,
  calcSelfShare,
  calcSelfShareAmount,
  isSelfShareAlert,
  alertLineNos,
  hasAnySplit,
  effectiveAllocations,
  sumSplitOut,
  isSplitEditable,
  type SplitAllocation,
  type SplitSourceEntry,
} from './additionalEntrySplit';

// 仕様まとめ（20260925_追加口分割_仕様まとめ.html 2-3）の明細と入力値。
// 分割先は 首都圏本部営業三部(A)・関東本部営業二部(B)・関東本部信越支店(C)。
const ENTRY_1: SplitSourceEntry = {
  lineNo: 1,
  capacity: 24,
  payCases: 180,
  payLoose: 0,
  addUnit: 71,
};
const ENTRY_2: SplitSourceEntry = {
  lineNo: 2,
  capacity: 24,
  payCases: 150,
  payLoose: 0,
  addUnit: 64,
};
// バラのみの明細
const ENTRY_3: SplitSourceEntry = {
  lineNo: 3,
  capacity: 24,
  payCases: 0,
  payLoose: 12,
  addUnit: 66,
};
// ケースとバラの両方を持つ明細（画面の行データは文字列で持つこともある）
const ENTRY_9: SplitSourceEntry = {
  lineNo: '9',
  capacity: '24',
  payCases: '200',
  payLoose: '12',
  addUnit: '71',
};

const alloc = (
  lineNo: number | string,
  destId: string,
  cases: number,
  loose: number
): SplitAllocation => ({ lineNo, destId, cases, loose });

const ALLOCATIONS: SplitAllocation[] = [
  alloc(1, 'A', 20, 0),
  alloc(1, 'B', 15, 0),
  alloc(1, 'C', 25, 0),
  alloc(2, 'A', 18, 0),
  alloc(2, 'B', 12, 0),
  alloc(2, 'C', 17, 0),
  alloc(3, 'A', 0, 3),
  alloc(3, 'B', 0, 2),
  alloc(3, 'C', 0, 1),
  alloc(9, 'A', 30, 3),
  alloc(9, 'B', 28, 2),
  alloc(9, 'C', 22, 1),
];

describe('roundHalfAway', () => {
  it('0.5 は絶対値の大きい方へ丸める（符号に対して対称）', () => {
    expect(roundHalfAway(12.5)).toBe(13);
    expect(roundHalfAway(-12.5)).toBe(-13);
    expect(roundHalfAway(12.4)).toBe(12);
    expect(roundHalfAway(-12.4)).toBe(-12);
  });

  it('0 は 0 のまま（-0 にしない）', () => {
    expect(Object.is(roundHalfAway(0), 0)).toBe(true);
    expect(roundHalfAway(-0.4)).toBe(0);
  });
});

describe('toIntegerCount', () => {
  it('Excel から貼り付けた小数を四捨五入で整数にする', () => {
    expect(toIntegerCount(12.4)).toBe(12);
    expect(toIntegerCount(12.5)).toBe(13);
    expect(toIntegerCount('12.5')).toBe(13);
  });

  it('3桁区切りの文字列も数値として扱う', () => {
    expect(toIntegerCount('1,234.6')).toBe(1235);
  });

  it('マイナス（返品）も四捨五入する', () => {
    expect(toIntegerCount(-3.5)).toBe(-4);
  });

  it('空・非数は 0 にする', () => {
    expect(toIntegerCount('')).toBe(0);
    expect(toIntegerCount(null)).toBe(0);
    expect(toIntegerCount(undefined)).toBe(0);
    expect(toIntegerCount('abc')).toBe(0);
  });
});

describe('calcSplitAmount', () => {
  it('（ケース × 入数 ＋ バラ）× 追加口バラ単価 で計算する', () => {
    // No.1 首都圏本部営業三部：（20 × 24 ＋ 0）× 71
    expect(calcSplitAmount(20, 0, 24, 71)).toBe(34080);
  });

  it('バラのみの明細も計算できる', () => {
    // No.3 首都圏本部営業三部：（0 × 24 ＋ 3）× 66
    expect(calcSplitAmount(0, 3, 24, 66)).toBe(198);
  });

  it('ケースとバラの両方を持つ明細も計算できる', () => {
    // No.9 首都圏本部営業三部：（30 × 24 ＋ 3）× 71
    expect(calcSplitAmount(30, 3, 24, 71)).toBe(51333);
  });

  it('単価が小数のときは金額を四捨五入する', () => {
    expect(calcSplitAmount(1, 0, 3, 10.5)).toBe(32); // 31.5 → 32
    expect(calcSplitAmount(1, 1, 3, 10.3)).toBe(41); // 41.2 → 41
  });

  it('文字列の入力値も受け付ける', () => {
    expect(calcSplitAmount('20', '0', '24', '71')).toBe(34080);
  });
});

describe('calcSelfShare', () => {
  it('支払ケース・支払バラから分割先の合計を引いた残りになる', () => {
    expect(calcSelfShare(ENTRY_1, ALLOCATIONS)).toEqual({
      cases: 120,
      loose: 0,
    });
    expect(calcSelfShare(ENTRY_3, ALLOCATIONS)).toEqual({ cases: 0, loose: 6 });
    expect(calcSelfShare(ENTRY_9, ALLOCATIONS)).toEqual({
      cases: 120,
      loose: 6,
    });
  });

  it('No. が数値と文字列で混在していても同じ明細として扱う', () => {
    expect(calcSelfShare(ENTRY_9, [alloc('9', 'A', 10, 0)])).toEqual({
      cases: 190,
      loose: 12,
    });
    expect(calcSelfShare(ENTRY_1, [alloc('1', 'A', 10, 0)])).toEqual({
      cases: 170,
      loose: 0,
    });
  });

  it('分割先の入力が無ければ全量が自部署負担分に残る', () => {
    expect(calcSelfShare(ENTRY_1, [])).toEqual({ cases: 180, loose: 0 });
  });
});

describe('calcSelfShareAmount', () => {
  it('追加口金額から分割先の金額の合計を差し引く', () => {
    // No.1 追加口金額：180 × 24 × 71 = 306,720／分割先：（20＋15＋25）× 24 × 71 = 102,240
    expect(
      calcSelfShareAmount({ ...ENTRY_1, addAmount: 306720 }, ALLOCATIONS)
    ).toBe(204480);
    // No.9 追加口金額：（200 × 24 ＋ 12）× 71 = 341,652（画面の行データは文字列のこともある）
    expect(
      calcSelfShareAmount({ ...ENTRY_9, addAmount: '341652' }, ALLOCATIONS)
    ).toBe(204906);
  });

  it('単価に端数があっても、分割先と自部署の金額の合計は追加口金額に一致する', () => {
    // 入数3・単価10.5：追加口金額（3ケース）＝ 94.5 → 95、分割先1ケース ＝ 31.5 → 32
    const entry = {
      lineNo: 1,
      capacity: 3,
      payCases: 3,
      payLoose: 0,
      addUnit: 10.5,
      addAmount: 95,
    };
    const allocations = [alloc(1, 'A', 1, 0), alloc(1, 'B', 1, 0)];
    const self = calcSelfShareAmount(entry, allocations);
    // 自部署1ケースを同じ式で計算すると32だが、端数のズレは自部署で吸収して31になる（第33回 決定事項8）
    expect(self).toBe(31);
    expect(self + 32 + 32).toBe(95);
  });
});

describe('isSelfShareAlert', () => {
  // No.2 と No.8 の首都圏本部営業三部に桁を1つ多く入力した状態（仕様まとめ 3-1）
  const overInput: SplitAllocation[] = [
    alloc(2, 'A', 138, 0),
    alloc(2, 'B', 12, 0),
    alloc(2, 'C', 17, 0),
  ];

  it('分割元の支払がプラスで自部署負担分がマイナスならアラート', () => {
    expect(isSelfShareAlert(ENTRY_2, overInput)).toBe(true);
  });

  it('自部署負担分が 0 以上ならアラートなし', () => {
    expect(isSelfShareAlert(ENTRY_2, ALLOCATIONS)).toBe(false);
  });

  it('自部署負担分がちょうど 0 ならアラートなし', () => {
    expect(isSelfShareAlert(ENTRY_1, [alloc(1, 'A', 180, 0)])).toBe(false);
  });

  it('バラだけがマイナスでもアラート', () => {
    expect(isSelfShareAlert(ENTRY_3, [alloc(3, 'A', 0, 13)])).toBe(true);
  });

  it('分割元の支払がマイナス（返品）の明細はアラートを出さない', () => {
    const returned: SplitSourceEntry = {
      lineNo: 20,
      capacity: 24,
      payCases: -10,
      payLoose: 0,
      addUnit: 71,
    };
    expect(isSelfShareAlert(returned, [alloc(20, 'A', -4, 0)])).toBe(false);
    expect(isSelfShareAlert(returned, [])).toBe(false);
  });

  it('分割元の支払が 0 の明細はアラートを出さない', () => {
    const zero: SplitSourceEntry = {
      lineNo: 21,
      capacity: 24,
      payCases: 0,
      payLoose: 0,
      addUnit: 71,
    };
    expect(isSelfShareAlert(zero, [alloc(21, 'A', 1, 0)])).toBe(false);
  });
});

describe('alertLineNos', () => {
  it('アラート対象の明細 No. を明細の並び順で返す', () => {
    const entries = [ENTRY_1, ENTRY_2, ENTRY_3];
    const allocations = [alloc(1, 'A', 200, 0), alloc(3, 'A', 0, 20)];
    expect(alertLineNos(entries, allocations)).toEqual([1, 3]);
  });

  it('アラート対象が無ければ空配列', () => {
    expect(alertLineNos([ENTRY_1, ENTRY_2], ALLOCATIONS)).toEqual([]);
  });
});

describe('hasAnySplit / effectiveAllocations', () => {
  it('0 以外の入力が1件でもあれば分割あり', () => {
    expect(hasAnySplit([alloc(1, 'A', 0, 0), alloc(2, 'A', 0, 1)])).toBe(true);
  });

  it('全て 0、または入力が無ければ分割なし', () => {
    expect(hasAnySplit([alloc(1, 'A', 0, 0), alloc(2, 'B', 0, 0)])).toBe(false);
    expect(hasAnySplit([])).toBe(false);
  });

  it('ケース・バラとも 0 の組み合わせを除く', () => {
    const input = [
      alloc(1, 'A', 0, 0),
      alloc(1, 'B', 5, 0),
      alloc(3, 'A', 0, 2),
    ];
    expect(effectiveAllocations(input)).toEqual([
      alloc(1, 'B', 5, 0),
      alloc(3, 'A', 0, 2),
    ]);
  });
});

describe('sumSplitOut', () => {
  it('分割先へ出したケース・バラ・追加口金額を合計する', () => {
    const total = sumSplitOut([ENTRY_1, ENTRY_3, ENTRY_9], ALLOCATIONS);
    expect(total.cases).toBe(60 + 0 + 80);
    expect(total.loose).toBe(0 + 6 + 6);
    // 追加口金額：No.1（60 × 24 × 71）＋ No.3（6 × 66）＋ No.9（(80 × 24 ＋ 6) × 71）
    expect(total.addAmount).toBe(102240 + 396 + 136746);
  });

  it('バラは入数でケースに換算して足す（最後に四捨五入）', () => {
    // 140 ケース ＋ バラ 12 ÷ 24 ＝ 140.5 → 141
    const total = sumSplitOut([ENTRY_1, ENTRY_3, ENTRY_9], ALLOCATIONS);
    expect(total.caseEquivalent).toBe(141);
  });

  it('入数が取れない明細のバラはケース換算に含めない', () => {
    const noCapacity: SplitSourceEntry = { ...ENTRY_3, capacity: '' };
    const total = sumSplitOut([noCapacity], [alloc(3, 'A', 0, 5)]);
    expect(total.loose).toBe(5);
    expect(total.caseEquivalent).toBe(0);
  });

  it('分割元の明細に無い No. の入力は数えない', () => {
    const total = sumSplitOut(
      [ENTRY_1],
      [alloc(1, 'A', 10, 0), alloc(99, 'A', 50, 0)]
    );
    expect(total.cases).toBe(10);
  });

  it('分割が無ければすべて 0', () => {
    expect(sumSplitOut([ENTRY_1, ENTRY_9], [])).toEqual({
      cases: 0,
      loose: 0,
      caseEquivalent: 0,
      addAmount: 0,
    });
  });
});

describe('isSplitEditable', () => {
  it('申請前・差戻しは編集できる', () => {
    expect(isSplitEditable('未申請')).toBe(true);
    expect(isSplitEditable('承認差戻し')).toBe(true);
    expect(isSplitEditable('検印差戻し')).toBe(true);
  });

  it('申請後は参照のみ', () => {
    expect(isSplitEditable('承認待ち')).toBe(false);
    expect(isSplitEditable('検印待ち')).toBe(false);
    expect(isSplitEditable('検印済')).toBe(false);
  });
});
