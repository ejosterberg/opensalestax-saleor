// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

/**
 * Sync webhook handler for `CHECKOUT_CALCULATE_TAXES`.
 *
 * Saleor blocks the checkout until we respond. We target â‰¤2s with the
 * OST engine's typical 50-200 ms RTT (research Â§2).
 */

import { SaleorSyncWebhook } from '@saleor/app-sdk/handlers/fetch-api';
import type { APL } from '@saleor/app-sdk/APL';

import type { TaxHandlerDeps } from './tax-handler';
import { handleTaxCalculation } from './tax-handler';
import { TAX_CALCULATION_SUBSCRIPTION, type TaxesCalculationPayload } from './subscription';

export interface BuildWebhookDeps extends TaxHandlerDeps {
  apl: APL;
}

export function buildCheckoutCalculateTaxesWebhook(
  deps: BuildWebhookDeps,
): {
  webhook: SaleorSyncWebhook<TaxesCalculationPayload, 'CHECKOUT_CALCULATE_TAXES'>;
  handler: (req: Request) => Response | Promise<Response>;
} {
  const webhook = new SaleorSyncWebhook<
    TaxesCalculationPayload,
    'CHECKOUT_CALCULATE_TAXES'
  >({
    name: 'OpenSalesTax â€” Checkout tax calculation',
    webhookPath: 'api/webhooks/checkout-calculate-taxes',
    event: 'CHECKOUT_CALCULATE_TAXES',
    apl: deps.apl,
    query: TAX_CALCULATION_SUBSCRIPTION,
  });

  const handler = webhook.createHandler(async (_req, ctx) => {
    const result = await handleTaxCalculation(
      ctx.payload,
      { eventType: 'checkout', saleorApiUrl: ctx.authData.saleorApiUrl },
      deps,
    );
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  return { webhook, handler };
}
