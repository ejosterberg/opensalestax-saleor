// SPDX-License-Identifier: Apache-2.0

/**
 * Shared GraphQL subscription for the tax-calc webhooks.
 *
 * Both `CHECKOUT_CALCULATE_TAXES` and `ORDER_CALCULATE_TAXES` deliver
 * the same `CalculateTaxes` payload shape (research/saleor-tax-app.md
 * §3) — only the dispatching event differs. We request the minimum
 * fields needed to call the OST engine, to keep payload size small.
 */

export const TAX_CALCULATION_SUBSCRIPTION = /* GraphQL */ `
  fragment TaxBaseFragment on TaxableObject {
    currency
    shippingPrice {
      amount
    }
    address {
      country {
        code
      }
      countryArea
      postalCode
    }
    lines {
      id
      quantity
      chargeTaxes
      totalPrice {
        amount
      }
    }
  }

  subscription CalculateTaxes {
    event {
      ... on CalculateTaxes {
        taxBase {
          ...TaxBaseFragment
        }
      }
    }
  }
`;

/** The payload shape Saleor delivers to either tax webhook. */
export interface TaxesCalculationPayload {
  taxBase: {
    currency: string;
    shippingPrice?: { amount: number };
    address: {
      country: { code: string };
      countryArea?: string;
      postalCode: string;
    };
    lines: Array<{
      id: string;
      quantity: number;
      chargeTaxes: boolean;
      totalPrice: { amount: number };
    }>;
  };
}
