// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

/**
 * Shared tax-webhook handler logic.
 *
 * Both `CHECKOUT_CALCULATE_TAXES` and `ORDER_CALCULATE_TAXES` follow
 * the same flow: gate â†’ transform â†’ engine call â†’ transform â†’ respond.
 * This module factors that flow so each webhook handler is a thin
 * adapter over the shared `handleTaxCalculation` function.
 *
 * Fail-soft (constitution Â§8): engine errors return an empty tax
 * response so Saleor falls back to its catalog rates. `OSTAX_FAIL_HARD=1`
 * opts the merchant into fail-hard behavior â€” engine errors return a
 * 5xx so Saleor blocks the checkout.
 */

import type { OpenSalesTaxClient } from '../lib/ostax-client';
import { buildOstRequest } from '../transformers/saleor-to-ost';
import {
  buildSaleorResponse,
  emptyTaxResponse,
  type SaleorTaxResponse,
} from '../transformers/ost-to-saleor';
import type { TaxesCalculationPayload } from './subscription';

export interface Logger {
  info: (msg: string, ctx?: Record<string, unknown>) => void;
  warn: (msg: string, ctx?: Record<string, unknown>) => void;
  error: (msg: string, ctx?: Record<string, unknown>) => void;
}

export interface TaxHandlerDeps {
  client: OpenSalesTaxClient;
  failHard: boolean;
  /**
   * Per-state nexus allowlist (CP-3). Empty set = filter disabled
   * (engine called for every cart, preserving pre-v1.2 behavior).
   * Non-empty = short-circuit any ship-to whose `countryArea` (US
   * state code) is not in the set, returning an empty tax response
   * without an engine round-trip. Saleor falls back to its catalog
   * rates (typically: no tax) on the empty response.
   */
  nexusStates?: ReadonlySet<string>;
  logger?: Logger;
}

const defaultLogger: Logger = {
  info: (msg, ctx) => console.log(JSON.stringify({ level: 'info', msg, ...ctx })),
  warn: (msg, ctx) => console.warn(JSON.stringify({ level: 'warn', msg, ...ctx })),
  error: (msg, ctx) => console.error(JSON.stringify({ level: 'error', msg, ...ctx })),
};

export class TaxCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaxCalculationError';
  }
}

export interface HandleTaxesContext {
  eventType: 'checkout' | 'order';
  saleorApiUrl: string;
}

/**
 * Run the gate â†’ engine â†’ transform pipeline. Returns the Saleor tax
 * response, or throws when fail-hard mode is on and the engine errors.
 */
export async function handleTaxCalculation(
  payload: TaxesCalculationPayload,
  ctx: HandleTaxesContext,
  deps: TaxHandlerDeps,
): Promise<SaleorTaxResponse> {
  const log = deps.logger ?? defaultLogger;
  const { taxBase } = payload;

  const lineCount = Array.isArray(taxBase?.lines) ? taxBase.lines.length : 0;
  log.info('tax_calc.received', {
    event: ctx.eventType,
    saleorApiUrl: ctx.saleorApiUrl,
    line_count: lineCount,
  });

  const gated = buildOstRequest(taxBase);
  if (!gated.ok) {
    log.info('tax_calc.skipped', {
      event: ctx.eventType,
      reason: gated.reason,
    });
    return emptyTaxResponse();
  }

  // Per-state nexus filter (CP-3). When the merchant has set
  // OSTAX_NEXUS_STATES, short-circuit any ship-to whose state is not
  // in the allowlist. Saleor's `countryArea` ships as a 2-letter US
  // state code (e.g. "MN"). Unresolvable state with the filter enabled
  // is fail-closed (no engine call, no tax line) — the safer default
  // for a merchant who explicitly opted into the filter. Mirrors
  // WooCom v0.5 / Vendure v1.2 / Odoo v0.3.
  const nexusStates = deps.nexusStates;
  if (nexusStates !== undefined && nexusStates.size > 0) {
    const rawState = taxBase.address.countryArea ?? '';
    const state = rawState.trim().toUpperCase();
    if (state === '' || !nexusStates.has(state)) {
      log.info('tax_calc.skipped', {
        event: ctx.eventType,
        reason: 'nexus-filter',
        state: state === '' ? null : state,
      });
      return emptyTaxResponse();
    }
  }

  const productLineCount = taxBase.lines.length;
  const shippingIndex =
    gated.request.line_items.length > productLineCount ? productLineCount : null;

  try {
    const start = Date.now();
    const ostResponse = await deps.client.calculate(gated.request);
    const rtt = Date.now() - start;
    log.info('tax_calc.ok', {
      event: ctx.eventType,
      rtt_ms: rtt,
      tax_total: ostResponse.tax_total,
    });
    return buildSaleorResponse(ostResponse, shippingIndex);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('tax_calc.engine_error', {
      event: ctx.eventType,
      error: message,
      fail_hard: deps.failHard,
    });
    if (deps.failHard) {
      throw new TaxCalculationError(`OST engine error: ${message}`);
    }
    log.warn('tax_calc.fail_soft', {
      event: ctx.eventType,
      action: 'returning empty response',
    });
    return emptyTaxResponse();
  }
}
