// SPDX-License-Identifier: Apache-2.0

/**
 * GET /api/manifest — returns the Saleor app manifest.
 *
 * Declares two SYNC webhook subscriptions (CHECKOUT_CALCULATE_TAXES,
 * ORDER_CALCULATE_TAXES) and the HANDLE_TAXES app permission.
 */

import { createManifestHandler } from '@saleor/app-sdk/handlers/fetch-api';
import type { AppManifest } from '@saleor/app-sdk/types';
import type { SaleorSyncWebhook } from '@saleor/app-sdk/handlers/fetch-api';

import { APP_VERSION } from '../lib/version';

export interface ManifestDeps {
  appBaseUrl: string;
  webhooks: ReadonlyArray<SaleorSyncWebhook>;
}

export function createManifestRouteHandler(
  deps: ManifestDeps,
): (req: Request) => Response | Promise<Response> {
  return createManifestHandler({
    manifestFactory: ({ appBaseUrl: requestedBaseUrl }): AppManifest => {
      // Prefer the explicitly configured base URL (from env) so a
      // mismatched X-Forwarded-Host header can't trick the app into
      // advertising an attacker-controlled callback URL.
      const baseUrl = deps.appBaseUrl || requestedBaseUrl;
      return {
        id: 'ejosterberg.opensalestax',
        version: APP_VERSION,
        name: 'OpenSalesTax',
        about:
          'Destination-based US sales tax via the self-hosted ' +
          'OpenSalesTax engine. No per-transaction fees; no SaaS lock-in.',
        permissions: ['HANDLE_TAXES'],
        appUrl: baseUrl,
        tokenTargetUrl: `${baseUrl}/api/register`,
        author: 'Eric Osterberg',
        dataPrivacyUrl:
          'https://github.com/ejosterberg/opensalestax-saleor/blob/main/SECURITY.md',
        homepageUrl: 'https://github.com/ejosterberg/opensalestax-saleor',
        supportUrl: 'https://github.com/ejosterberg/opensalestax-saleor/issues',
        extensions: [],
        webhooks: deps.webhooks.map((w) => w.getWebhookManifest(baseUrl)),
      };
    },
  });
}
