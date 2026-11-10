import { describe, it, expect } from 'vitest';
import { applyLinkedTaxClass, linkedTaxClassOf } from './expenseTaxClass';
import { NET_UNAPPROVED_MGMT_CLASS_NAME } from './paymentSummaryAggregate';

describe('linkedTaxClassOf（管理区分に紐づく税区分）', () => {
  it('1B3（値引き（売上連動））は課税8%:2', () => {
    expect(linkedTaxClassOf(NET_UNAPPROVED_MGMT_CLASS_NAME)).toBe('課税8%:2');
  });

  it('紐づく税区分の無い管理区分・空は undefined', () => {
    expect(linkedTaxClassOf('拡売費(固定費)B口')).toBeUndefined();
    expect(linkedTaxClassOf('')).toBeUndefined();
    expect(linkedTaxClassOf(undefined)).toBeUndefined();
  });
});

describe('applyLinkedTaxClass（管理区分を変えたときの税区分）', () => {
  it('1B3 にしたら税区分を紐づく値にする', () => {
    const row = {
      mgmtClass: NET_UNAPPROVED_MGMT_CLASS_NAME,
      taxClass: '課税10%:1',
    };
    expect(applyLinkedTaxClass(row)).toBe(true);
    expect(row.taxClass).toBe('課税8%:2');
  });

  it('既に同じ値、または紐づく税区分が無いときは変えない', () => {
    const same = {
      mgmtClass: NET_UNAPPROVED_MGMT_CLASS_NAME,
      taxClass: '課税8%:2',
    };
    expect(applyLinkedTaxClass(same)).toBe(false);
    const other = { mgmtClass: '拡売費(固定費)B口', taxClass: '課税10%:1' };
    expect(applyLinkedTaxClass(other)).toBe(false);
    expect(other.taxClass).toBe('課税10%:1');
  });
});
