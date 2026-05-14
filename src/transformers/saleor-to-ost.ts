// SPDX-License-Identifier: Apache-2.0

/**
 * Transform Saleor tax-webhook payloads into OST engine request bodies.
 *
 * Gating rules (constitution §5, §10):
 * - currency MUST be "USD"
 * - address.country.code MUST be "US"
 * - address.postalCode MUST match ^\d{5}(-\d{4})?$
 *
 * If any gate fails, returns `null` and the caller short-circuits to
 * an empty tax response so Saleor falls back to its catalog rates.
 */

import type { CalculateLineItem, CalculateRequest } from '../lib/ostax-client';

/** A single Saleor tax line — fields the connector reads. */
export interface SaleorTaxLine {
  id: string;
  quantity: number;
  totalPrice: { amount: number };
}

/** The slice of Saleor's webhook payload the connector reads. */
export interface SaleorTaxBase {
  currency: string;
  shippingPrice?: { amount: number };
  address: {
    country: { code: string };
    countryArea?: string;
    postalCode: string;
  };
  lines: SaleorTaxLine[];
}

const US_ZIP_RE = /^(\d{5})(?:-\d{4})?$/;

export interface GateFailure {
  ok: false;
  reason: 'non-usd' | 'non-us' | 'invalid-zip' | 'no-lines';
  detail: string;
}

export interface GateSuccess {
  ok: true;
  request: CalculateRequest;
}

export type SaleorToOstResult = GateFailure | GateSuccess;

/** Format a JS number as a decimal-string with 2 fractional digits. */
function formatAmount(amount: number): string {
  if (!Number.isFinite(amount)) return '0.00';
  return amount.toFixed(2);
}

export function buildOstRequest(taxBase: SaleorTaxBase): SaleorToOstResult {
  if (taxBase.currency !== 'USD') {
    return { ok: false, reason: 'non-usd', detail: `currency=${taxBase.currency}` };
  }
  if (taxBase.address.country.code !== 'US') {
    return {
      ok: false,
      reason: 'non-us',
      detail: `country=${taxBase.address.country.code}`,
    };
  }

  const zip5 = US_ZIP_RE.exec(taxBase.address.postalCode)?.[1];
  if (zip5 === undefined) {
    return {
      ok: false,
      reason: 'invalid-zip',
      detail: `postalCode=${taxBase.address.postalCode}`,
    };
  }

  if (!Array.isArray(taxBase.lines) || taxBase.lines.length === 0) {
    return { ok: false, reason: 'no-lines', detail: 'lines[] empty' };
  }

  const lineItems: CalculateLineItem[] = taxBase.lines.map((line) => ({
    amount: formatAmount(line.totalPrice.amount),
    category: 'general',
  }));

  const shippingAmount = taxBase.shippingPrice?.amount ?? 0;
  if (shippingAmount > 0) {
    lineItems.push({
      amount: formatAmount(shippingAmount),
      category: 'shipping',
    });
  }

  return {
    ok: true,
    request: {
      address: { zip5 },
      line_items: lineItems,
    },
  };
}
