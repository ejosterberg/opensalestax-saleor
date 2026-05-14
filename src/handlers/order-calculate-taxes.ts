// SPDX-License-Identifier: Apache-2.0

/**
 * Sync webhook handler for `ORDER_CALCULATE_TAXES`.
 *
 * Saleor calls this on order create + every line edit on an unfinalized
 * order. Same payload + response shape as `CHECKOUT_CALCULATE_TAXES` —
 * only the event name differs (research §2).
 */

import { SaleorSyncWebhook } from '@saleor/app-sdk/handlers/fetch-api';

import type { BuildWebhookDeps } from './checkout-calculate-taxes';
import { handleTaxCalculation } from './tax-handler';
import { TAX_CALCULATION_SUBSCRIPTION, type TaxesCalculationPayload } from './subscription';

export function buildOrderCalculateTaxesWebhook(
  deps: BuildWebhookDeps,
): {
  webhook: SaleorSyncWebhook<TaxesCalculationPayload, 'ORDER_CALCULATE_TAXES'>;
  handler: (req: Request) => Response | Promise<Response>;
} {
  const webhook = new SaleorSyncWebhook<
    TaxesCalculationPayload,
    'ORDER_CALCULATE_TAXES'
  >({
    name: 'OpenSalesTax — Order tax calculation',
    webhookPath: 'api/webhooks/order-calculate-taxes',
    event: 'ORDER_CALCULATE_TAXES',
    apl: deps.apl,
    query: TAX_CALCULATION_SUBSCRIPTION,
  });

  const handler = webhook.createHandler(async (_req, ctx) => {
    const result = await handleTaxCalculation(
      ctx.payload,
      { eventType: 'order', saleorApiUrl: ctx.authData.saleorApiUrl },
      deps,
    );
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  return { webhook, handler };
}
