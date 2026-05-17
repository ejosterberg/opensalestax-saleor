// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

/**
 * App version constant.
 *
 * Kept in sync with `package.json` by `npm version` at release time. The
 * server logs this at boot and the manifest advertises it to Saleor.
 * Importing `package.json` directly is avoided to keep the build's
 * `rootDir` clean and the published bundle slim.
 */

export const APP_VERSION = '1.1.1';
