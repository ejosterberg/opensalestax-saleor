// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

/**
 * Integration test against a real OpenSalesTax engine.
 *
 * Skipped when `OSTAX_API_URL` is not set in the environment so unit
 * test runs in CI (without the engine in reach) stay green. Locally
 * the test runs against the shared engine at
 * `http://10.32.161.126:8080` if the env var is exported.
 */

import { OpenSalesTaxClient } from '../../src/lib/ostax-client';
import { handleTaxCalculation } from '../../src/handlers/tax-handler';
import type { TaxesCalculationPayload } from '../../src/handlers/subscription';

const baseUrl = process.env.OSTAX_API_URL;
const describeIfEngine = baseUrl !== undefined && baseUrl !== '' ? describe : describe.skip;

describeIfEngine('end-to-end with real OST engine', () => {
  const client = new OpenSalesTaxClient({ baseUrl: baseUrl ?? '' });

  it('reports healthy', async () => {
    const h = await client.healthCheck();
    expect(h.ok).toBe(true);
  });

  it('returns tax for a $100 MN cart via the shared handler', async () => {
    const payload: TaxesCalculationPayload = {
      taxBase: {
        currency: 'USD',
        shippingPrice: { amount: 0 },
        address: {
          country: { code: 'US' },
          countryArea: 'MN',
          postalCode: '55403',
        },
        lines: [{ id: 'L1', quantity: 1, chargeTaxes: true, totalPrice: { amount: 100 } }],
      },
    };
    const out = await handleTaxCalculation(
      payload,
      { eventType: 'checkout', saleorApiUrl: 'https://it.example/graphql/' },
      {
        client,
        failHard: false,
        logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
      },
    );
    expect(out.lines).toHaveLength(1);
    const line = out.lines[0];
    expect(line).toBeDefined();
    if (!line) return;
    expect(line.total_net_amount).toBe(100);
    expect(line.total_gross_amount).toBeGreaterThan(100);
    expect(line.tax_rate).toBeGreaterThan(0.05);
    expect(line.tax_rate).toBeLessThan(0.12);
  });
});
