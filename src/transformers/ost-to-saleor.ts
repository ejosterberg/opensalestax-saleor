// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

/**
 * Transform OST engine responses into Saleor tax-webhook responses.
 *
 * Saleor's expected response shape (research/saleor-tax-app.md Â§4):
 *
 *   {
 *     "shipping_price_gross_amount": number,
 *     "shipping_price_net_amount":   number,
 *     "shipping_tax_rate":            number,   // decimal, not percent
 *     "lines": [
 *       { "total_gross_amount": number,
 *         "total_net_amount":   number,
 *         "tax_rate":           number }
 *     ]
 *   }
 *
 * Per-line `total_net_amount` MUST equal the Saleor request's
 * `totalPrice.amount` exactly (research Â§4). We propagate the pre-tax
 * amount we sent to the engine.
 *
 * Tax rate is decimal (0.07690), not percent (7.690).
 */

import type { CalculatedLine, CalculateResponse } from '../lib/ostax-client';

export interface SaleorTaxLineResponse {
  total_gross_amount: number;
  total_net_amount: number;
  tax_rate: number;
}

export interface SaleorTaxResponse {
  shipping_price_gross_amount: number;
  shipping_price_net_amount: number;
  shipping_tax_rate: number;
  lines: SaleorTaxLineResponse[];
}

/** Empty response â€” signals Saleor to fall back to its catalog rates. */
export function emptyTaxResponse(): SaleorTaxResponse {
  return {
    shipping_price_gross_amount: 0,
    shipping_price_net_amount: 0,
    shipping_tax_rate: 0,
    lines: [],
  };
}

function toNumber(value: string | undefined): number {
  if (value === undefined || value === '') return 0;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Convert OST percent string ("7.875") to Saleor decimal (0.07875). */
function pctStringToDecimal(pct: string | undefined): number {
  const n = toNumber(pct);
  return n / 100;
}

function buildLineResponse(line: CalculatedLine): SaleorTaxLineResponse {
  const net = toNumber(line.amount);
  const tax = toNumber(line.tax);
  return {
    total_net_amount: round2(net),
    total_gross_amount: round2(net + tax),
    tax_rate: pctStringToDecimal(line.rate_pct),
  };
}

/**
 * Build a Saleor tax response from an OST engine response.
 *
 * `shippingIndex` is the position of the synthetic shipping line in the
 * OST request (when shipping > 0). If absent, the response has zero
 * shipping values.
 */
export function buildSaleorResponse(
  ostResponse: CalculateResponse,
  shippingIndex: number | null,
): SaleorTaxResponse {
  if (!Array.isArray(ostResponse.lines) || ostResponse.lines.length === 0) {
    return emptyTaxResponse();
  }

  const ostLines = ostResponse.lines;

  let shippingResp: SaleorTaxLineResponse = {
    total_net_amount: 0,
    total_gross_amount: 0,
    tax_rate: 0,
  };

  let productOstLines: CalculatedLine[] = ostLines;
  if (shippingIndex !== null && shippingIndex >= 0 && shippingIndex < ostLines.length) {
    const shippingLine = ostLines[shippingIndex];
    if (shippingLine !== undefined) {
      shippingResp = buildLineResponse(shippingLine);
    }
    productOstLines = ostLines.filter((_, i) => i !== shippingIndex);
  }

  const lines = productOstLines.map(buildLineResponse);

  return {
    shipping_price_net_amount: shippingResp.total_net_amount,
    shipping_price_gross_amount: shippingResp.total_gross_amount,
    shipping_tax_rate: shippingResp.tax_rate,
    lines,
  };
}
