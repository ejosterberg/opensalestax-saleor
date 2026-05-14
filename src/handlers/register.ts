// SPDX-License-Identifier: Apache-2.0

/**
 * POST /api/register — Saleor app installation endpoint.
 *
 * Saleor's install POST delivers `auth_token` + the calling
 * `saleorApiUrl`. The SDK verifies origin, stores both into the APL,
 * and returns 200 to Saleor. After this the merchant can configure
 * the app as their channel's tax provider.
 */

import { createAppRegisterHandler } from '@saleor/app-sdk/handlers/fetch-api';
import type { APL } from '@saleor/app-sdk/APL';

export function createRegisterRouteHandler(
  apl: APL,
): (req: Request) => Response | Promise<Response> {
  return createAppRegisterHandler({
    apl,
    // Note: `allowedSaleorUrls` is intentionally left undefined here
    // so a self-hosted merchant doesn't have to pre-list their own
    // Saleor domain. In an environment with multiple known Saleor
    // domains, set ALLOWED_SALEOR_URLS in env and validate against it.
  });
}
