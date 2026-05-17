// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

import {
  buildSaleorResponse,
  emptyTaxResponse,
} from '../../src/transformers/ost-to-saleor';
import type { CalculateResponse } from '../../src/lib/ostax-client';

function ostLine(amount: string, tax: string, ratePct: string) {
  return {
    amount,
    category: 'general',
    tax,
    rate_pct: ratePct,
    jurisdictions: [],
  };
}

describe('emptyTaxResponse', () => {
  it('returns all-zero response with no lines', () => {
    expect(emptyTaxResponse()).toEqual({
      shipping_price_gross_amount: 0,
      shipping_price_net_amount: 0,
      shipping_tax_rate: 0,
      lines: [],
    });
  });
});

describe('buildSaleorResponse', () => {
  it('returns empty response when OST returned no lines', () => {
    const ost: CalculateResponse = { subtotal: '0', tax_total: '0', lines: [] };
    expect(buildSaleorResponse(ost, null)).toEqual(emptyTaxResponse());
  });

  it('builds per-line totals with decimal tax rate', () => {
    const ost: CalculateResponse = {
      subtotal: '200.00',
      tax_total: '15.75',
      lines: [
        ostLine('100.00', '7.875', '7.875'),
        ostLine('100.00', '7.875', '7.875'),
      ],
    };
    const out = buildSaleorResponse(ost, null);
    expect(out.lines).toHaveLength(2);
    expect(out.lines[0]).toEqual({
      total_net_amount: 100.0,
      total_gross_amount: 107.88,
      tax_rate: 0.07875,
    });
    expect(out.shipping_price_net_amount).toBe(0);
  });

  it('extracts the shipping line at the configured index', () => {
    const ost: CalculateResponse = {
      subtotal: '110.00',
      tax_total: '8.66',
      lines: [
        ostLine('100.00', '7.875', '7.875'),
        ostLine('10.00', '0.7875', '7.875'),
      ],
    };
    const out = buildSaleorResponse(ost, 1);
    expect(out.lines).toHaveLength(1);
    expect(out.lines[0]?.total_net_amount).toBe(100.0);
    expect(out.shipping_price_net_amount).toBe(10.0);
    expect(out.shipping_price_gross_amount).toBe(10.79);
    expect(out.shipping_tax_rate).toBeCloseTo(0.07875, 5);
  });

  it('treats an out-of-range shipping index as no shipping', () => {
    const ost: CalculateResponse = {
      subtotal: '100.00',
      tax_total: '7.88',
      lines: [ostLine('100.00', '7.875', '7.875')],
    };
    const out = buildSaleorResponse(ost, 5);
    expect(out.shipping_price_net_amount).toBe(0);
    expect(out.lines).toHaveLength(1);
  });

  it('rounds gross to 2 decimals', () => {
    const ost: CalculateResponse = {
      subtotal: '0',
      tax_total: '0',
      lines: [ostLine('33.33', '2.5831', '7.749')],
    };
    const out = buildSaleorResponse(ost, null);
    expect(out.lines[0]?.total_gross_amount).toBe(35.91);
    expect(out.lines[0]?.total_net_amount).toBe(33.33);
  });

  it('converts percent string to decimal rate', () => {
    const ost: CalculateResponse = {
      subtotal: '0',
      tax_total: '0',
      lines: [ostLine('100.00', '8.025', '8.025')],
    };
    const out = buildSaleorResponse(ost, null);
    expect(out.lines[0]?.tax_rate).toBeCloseTo(0.08025, 5);
  });
});
