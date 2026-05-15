// SPDX-License-Identifier: Apache-2.0

import {
  handleTaxCalculation,
  TaxCalculationError,
} from '../../src/handlers/tax-handler';
import type { Logger } from '../../src/handlers/tax-handler';
import type { TaxesCalculationPayload } from '../../src/handlers/subscription';
import type {
  Address,
  CalculationResult,
  LineItem,
  OpenSalesTaxClient,
} from '@ejosterberg/opensalestax';

function fakeClient(
  impl: (address: Address, lineItems: LineItem[]) => Promise<CalculationResult>,
): OpenSalesTaxClient {
  // Cast through unknown so we can supply a mock with only `calculate`
  // (we don't exercise `health`/`healthCheck` paths in this suite).
  return { calculate: impl } as unknown as OpenSalesTaxClient;
}

function noopLogger(): Logger {
  return { info: () => undefined, warn: () => undefined, error: () => undefined };
}

function makePayload(overrides?: Partial<TaxesCalculationPayload['taxBase']>): TaxesCalculationPayload {
  return {
    taxBase: {
      currency: 'USD',
      shippingPrice: { amount: 0 },
      address: {
        country: { code: 'US' },
        countryArea: 'MN',
        postalCode: '55403',
      },
      lines: [{ id: 'L1', quantity: 1, chargeTaxes: true, totalPrice: { amount: 100 } }],
      ...overrides,
    },
  };
}

const CTX = { eventType: 'checkout' as const, saleorApiUrl: 'https://shop.saleor.io/graphql/' };

describe('handleTaxCalculation', () => {
  it('returns empty response for non-USD currency without calling engine', async () => {
    const calc = jest.fn();
    const res = await handleTaxCalculation(
      makePayload({ currency: 'EUR' }),
      CTX,
      { client: fakeClient(calc), failHard: false, logger: noopLogger() },
    );
    expect(calc).not.toHaveBeenCalled();
    expect(res.lines).toHaveLength(0);
  });

  it('returns empty response for non-US country without calling engine', async () => {
    const calc = jest.fn();
    const res = await handleTaxCalculation(
      makePayload({ address: { country: { code: 'CA' }, postalCode: '55403' } }),
      CTX,
      { client: fakeClient(calc), failHard: false, logger: noopLogger() },
    );
    expect(calc).not.toHaveBeenCalled();
    expect(res.lines).toHaveLength(0);
  });

  it('calls engine and transforms response for USD/US payload', async () => {
    const calc = jest.fn(() =>
      Promise.resolve<CalculationResult>({
        subtotal: '100.00',
        taxTotal: '7.88',
        lines: [
          {
            amount: '100.00',
            category: 'general',
            tax: '7.88',
            ratePct: '7.88',
            jurisdictions: [],
            note: null,
          },
        ],
        disclaimer: '',
      }),
    );
    const res = await handleTaxCalculation(makePayload(), CTX, {
      client: fakeClient(calc),
      failHard: false,
      logger: noopLogger(),
    });
    expect(calc).toHaveBeenCalledTimes(1);
    expect(res.lines).toHaveLength(1);
    expect(res.lines[0]?.total_net_amount).toBe(100);
    expect(res.lines[0]?.tax_rate).toBeCloseTo(0.0788, 4);
  });

  it('fail-soft: returns empty response on engine error', async () => {
    const calc = jest.fn(() => Promise.reject(new Error('ECONNREFUSED')));
    const res = await handleTaxCalculation(makePayload(), CTX, {
      client: fakeClient(calc),
      failHard: false,
      logger: noopLogger(),
    });
    expect(res.lines).toHaveLength(0);
    expect(res.shipping_price_gross_amount).toBe(0);
  });

  it('fail-hard: throws TaxCalculationError on engine error', async () => {
    const calc = jest.fn(() => Promise.reject(new Error('ECONNREFUSED')));
    await expect(
      handleTaxCalculation(makePayload(), CTX, {
        client: fakeClient(calc),
        failHard: true,
        logger: noopLogger(),
      }),
    ).rejects.toThrow(TaxCalculationError);
  });

  it('handles shipping line: extracts shipping from synthetic last OST line', async () => {
    const calc = jest.fn(() =>
      Promise.resolve<CalculationResult>({
        subtotal: '110.00',
        taxTotal: '8.66',
        lines: [
          {
            amount: '100.00',
            category: 'general',
            tax: '7.88',
            ratePct: '7.88',
            jurisdictions: [],
            note: null,
          },
          {
            amount: '10.00',
            category: 'shipping',
            tax: '0.79',
            ratePct: '7.88',
            jurisdictions: [],
            note: null,
          },
        ],
        disclaimer: '',
      }),
    );
    const res = await handleTaxCalculation(
      makePayload({ shippingPrice: { amount: 10 } }),
      CTX,
      { client: fakeClient(calc), failHard: false, logger: noopLogger() },
    );
    expect(res.lines).toHaveLength(1);
    expect(res.shipping_price_net_amount).toBe(10);
    expect(res.shipping_price_gross_amount).toBeCloseTo(10.79, 2);
  });

  it('does not include customer addresses or product names in log calls', async () => {
    const calls: Array<{ msg: string; ctx?: Record<string, unknown> }> = [];
    const logger: Logger = {
      info: (msg, ctx) => calls.push({ msg, ...(ctx !== undefined ? { ctx } : {}) }),
      warn: () => undefined,
      error: () => undefined,
    };
    const calc = jest.fn(() =>
      Promise.resolve<CalculationResult>({
        subtotal: '100.00',
        taxTotal: '7.88',
        lines: [
          {
            amount: '100.00',
            category: 'general',
            tax: '7.88',
            ratePct: '7.88',
            jurisdictions: [],
            note: null,
          },
        ],
        disclaimer: '',
      }),
    );
    await handleTaxCalculation(makePayload(), CTX, {
      client: fakeClient(calc),
      failHard: false,
      logger,
    });
    const serialized = JSON.stringify(calls);
    expect(serialized).not.toContain('55403');
    expect(serialized).not.toContain('MN');
    expect(serialized).not.toContain('L1');
  });
});
