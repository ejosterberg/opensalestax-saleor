// SPDX-License-Identifier: Apache-2.0

import { buildOstRequest } from '../../src/transformers/saleor-to-ost';
import type { SaleorTaxBase } from '../../src/transformers/saleor-to-ost';

function makeBase(overrides: Partial<SaleorTaxBase> = {}): SaleorTaxBase {
  return {
    currency: 'USD',
    shippingPrice: { amount: 0 },
    address: {
      country: { code: 'US' },
      countryArea: 'MN',
      postalCode: '55403',
    },
    lines: [{ id: 'L1', quantity: 1, totalPrice: { amount: 100 } }],
    ...overrides,
  };
}

describe('buildOstRequest — gating', () => {
  it('returns non-usd failure when currency is EUR', () => {
    const result = buildOstRequest(makeBase({ currency: 'EUR' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('non-usd');
  });

  it('returns non-us failure when country is CA', () => {
    const result = buildOstRequest(
      makeBase({ address: { country: { code: 'CA' }, postalCode: '55403' } }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('non-us');
  });

  it('returns invalid-zip when postal code is non-numeric', () => {
    const result = buildOstRequest(
      makeBase({ address: { country: { code: 'US' }, postalCode: 'ABCDE' } }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid-zip');
  });

  it('accepts ZIP5+4 and strips the +4', () => {
    const result = buildOstRequest(
      makeBase({ address: { country: { code: 'US' }, postalCode: '55403-1234' } }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.request.address.zip5).toBe('55403');
  });

  it('returns no-lines when lines[] is empty', () => {
    const result = buildOstRequest(makeBase({ lines: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no-lines');
  });
});

describe('buildOstRequest — line mapping', () => {
  it('maps each Saleor line to one OST line', () => {
    const result = buildOstRequest(
      makeBase({
        lines: [
          { id: 'L1', quantity: 1, totalPrice: { amount: 100 } },
          { id: 'L2', quantity: 2, totalPrice: { amount: 50.5 } },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.line_items).toHaveLength(2);
    expect(result.request.line_items[0]).toEqual({
      amount: '100.00',
      category: 'general',
    });
    expect(result.request.line_items[1]).toEqual({
      amount: '50.50',
      category: 'general',
    });
  });

  it('appends a shipping line when shippingPrice > 0', () => {
    const result = buildOstRequest(
      makeBase({ shippingPrice: { amount: 10 } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.line_items).toHaveLength(2);
    expect(result.request.line_items[1]).toEqual({
      amount: '10.00',
      category: 'shipping',
    });
  });

  it('omits the shipping line when shippingPrice is zero', () => {
    const result = buildOstRequest(makeBase({ shippingPrice: { amount: 0 } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.line_items).toHaveLength(1);
  });

  it('omits the shipping line when shippingPrice is missing', () => {
    const base = makeBase();
    delete base.shippingPrice;
    const result = buildOstRequest(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.line_items).toHaveLength(1);
  });

  it('formats decimal amounts to 2 fractional digits', () => {
    const result = buildOstRequest(
      makeBase({ lines: [{ id: 'L1', quantity: 1, totalPrice: { amount: 99.999 } }] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.line_items[0]?.amount).toBe('100.00');
  });
});
