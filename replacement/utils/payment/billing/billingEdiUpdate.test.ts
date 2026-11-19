import { describe, it, expect } from 'vitest';
import {
  assignBillingEdiValue,
  correctBillingEdiDetail,
  formatBillingEdiStamp,
  reimportBillingEdiSummary,
} from './billingEdiUpdate';
import { matchesErrorSummary } from './billingEdiImport';
import type {
  BillingEdiAssignMasters,
  BillingEdiImportRow,
} from '@/types/billingEdi';
import {
  ASSIGN_OPTIONS,
  BILLING_EDI_ROWS,
  RETAILER_ASSIGN_OPTIONS,
  SUMMARY_PRODUCT_CODE,
  SUMMARY_PRODUCT_NAME,
} from '@/mocks/common/billingEdi';

const MASTERS: BillingEdiAssignMasters = {
  assignOptions: ASSIGN_OPTIONS,
  retailerAssignOptions: RETAILER_ASSIGN_OPTIONS,
  summaryProduct: { code: SUMMARY_PRODUCT_CODE, name: SUMMARY_PRODUCT_NAME },
};
const NOW = '2026/11/17 10:00';
const OPERATOR = 'アサヒ　太郎';

// 指定した項目の未実施のエラーサマリを持つ最初の行とそのサマリ
const findTarget = (field: string) => {
  for (const row of BILLING_EDI_ROWS) {
    const summary = row.errorSummaries.find(
      (e) => e.field === field && e.resolveState === '未実施'
    );
    if (summary) return { row, summary };
  }
  throw new Error(`${field} の未実施のエラーサマリがモックに無い`);
};

const rowOf = (rows: BillingEdiImportRow[], id: string) =>
  rows.find((r) => r.id === id)!;

describe('formatBillingEdiStamp', () => {
  it("'YYYY/MM/DD HH:mm' にする", () => {
    expect(formatBillingEdiStamp(new Date(2026, 0, 5, 9, 7))).toBe(
      '2026/01/05 09:07'
    );
  });
});

describe('reimportBillingEdiSummary', () => {
  it('指示したエラーサマリのエラー（項目＋内容）だけを対象明細から取り除き、サマリを解消にする', () => {
    const { row, summary } = findTarget('商品コード');
    const targetIds = row.details
      .filter((d) => matchesErrorSummary(d, summary))
      .map((d) => d.id);
    expect(targetIds.length).toBeGreaterThan(0);

    const next = rowOf(
      reimportBillingEdiSummary(
        BILLING_EDI_ROWS,
        row.id,
        summary.id,
        NOW,
        OPERATOR,
        MASTERS
      ),
      row.id
    );
    for (const id of targetIds) {
      const detail = next.details.find((d) => d.id === id)!;
      expect(
        detail.errors.some(
          (e) => e.field === summary.field && e.reason === summary.reason
        )
      ).toBe(false);
      expect(detail.reimportedSummaryIds).toContain(summary.id);
    }
    expect(
      next.errorSummaries.find((e) => e.id === summary.id)?.resolveState
    ).toBe('解消');
    expect(next.reimportedAt).toBe(NOW);
    // エラーの残る明細の数とステータスが合っている
    const remaining = next.details.filter((d) => d.errors.length > 0).length;
    expect(next.errorCount).toBe(remaining);
    expect(next.status).toBe(remaining === 0 ? '正常' : 'エラー');
  });

  it('変換後の値が登録されていれば、オンライン商品とサマリ商品を明細へ反映し差分に残す', () => {
    const { row, summary } = findTarget('商品コード');
    const option = ASSIGN_OPTIONS['オンライン商品'][0];
    const assigned = assignBillingEdiValue(
      BILLING_EDI_ROWS,
      row.id,
      summary.id,
      option.value
    );
    const next = rowOf(
      reimportBillingEdiSummary(
        assigned,
        row.id,
        summary.id,
        NOW,
        OPERATOR,
        MASTERS
      ),
      row.id
    );
    const detail = next.details.find((d) =>
      d.reimportedSummaryIds.includes(summary.id)
    )!;
    expect(detail.onlineProductCode).toBe(option.value);
    expect(detail.summaryProductCode).toBe(SUMMARY_PRODUCT_CODE);
    const correction = detail.corrections.find(
      (c) => c.field === 'オンライン商品'
    );
    expect(correction).toMatchObject({
      kind: '変換値指定',
      original: '(未変換)',
      corrected: option.label,
      correctedBy: OPERATOR,
      correctedAt: NOW,
    });
  });

  it('対象外の行・存在しないサマリは変えない', () => {
    const { row } = findTarget('商品コード');
    const next = reimportBillingEdiSummary(
      BILLING_EDI_ROWS,
      row.id,
      'no-such-summary',
      NOW,
      OPERATOR,
      MASTERS
    );
    expect(next).toEqual(BILLING_EDI_ROWS);
  });
});

describe('assignBillingEdiValue', () => {
  it('対象のエラーサマリに変換後の値を登録するだけで、明細は変えない', () => {
    const { row, summary } = findTarget('商流販売店');
    const next = rowOf(
      assignBillingEdiValue(BILLING_EDI_ROWS, row.id, summary.id, 'X'),
      row.id
    );
    expect(
      next.errorSummaries.find((e) => e.id === summary.id)?.assignedValue
    ).toBe('X');
    expect(next.details).toBe(row.details);
  });
});

describe('correctBillingEdiDetail', () => {
  it('原本の連携値を残して修正の差分を記録し、未変換の生値の印を落とす', () => {
    const row = BILLING_EDI_ROWS.find((r) =>
      r.details.some((d) => d.rawValues['計上日'] !== undefined)
    )!;
    const detail = row.details.find(
      (d) => d.rawValues['計上日'] !== undefined
    )!;
    const next = rowOf(
      correctBillingEdiDetail(
        BILLING_EDI_ROWS,
        row.id,
        detail.id,
        '計上日',
        '2026/10/01',
        NOW,
        OPERATOR
      ),
      row.id
    ).details.find((d) => d.id === detail.id)!;
    expect(next.corrections.find((c) => c.field === '計上日')).toMatchObject({
      kind: '連携値修正',
      original: detail.rawValues['計上日'],
      corrected: '2026/10/01',
      correctedBy: OPERATOR,
      correctedAt: NOW,
    });
    expect(next.rawValues['計上日']).toBeUndefined();
  });
});
