// SPDX-License-Identifier: Apache-2.0

/**
 * APL wiring.
 *
 * EnvAPL is single-tenant (constitution §2 X: merchant self-hosts one
 * Saleor instance per app deployment). The APL is seeded from env vars;
 * Saleor's install POST writes the same fields so subsequent restarts
 * pick them up.
 *
 * Note: The SDK ships a thin `SaleorApp` wrapper class around an APL,
 * but as of @saleor/app-sdk@1.8 its CJS export map mis-points
 * `./saleor-app` to a different file. We don't use the wrapper directly
 * — handlers consume `APL` instances — so we sidestep the issue by
 * constructing only the EnvAPL.
 */

import { EnvAPL } from '@saleor/app-sdk/APL/env';

import type { AppConfig } from './config';

export interface AppInstance {
  apl: EnvAPL;
}

export function createSaleorApp(config: AppConfig): AppInstance {
  const apl = new EnvAPL({
    env: {
      saleorApiUrl: config.saleor.apiUrl,
      token: config.saleor.appToken,
      appId: config.saleor.appId,
    },
    // Print the AuthData on /api/register so the merchant can paste
    // the values into docker-compose for restart-survivability.
    // The recommendation in the SDK is to graduate to a Postgres APL
    // in v0.2 once multi-tenant is needed.
    printAuthDataOnRegister: true,
  });
  return { apl };
}
