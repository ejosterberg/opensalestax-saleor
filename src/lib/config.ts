// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

/**
 * Typed environment-variable loader with validation.
 *
 * Fail-fast at boot when required vars are missing or malformed â€”
 * the constitution (Â§7, Â§8) wants production misconfigurations to
 * surface immediately, not as silent JWT verification skips.
 */

import { stripTrailingSlashes } from './url';

export interface AppConfig {
  /** Port the HTTP server listens on. Default 3000. */
  port: number;
  /** Base URL the app advertises in its manifest. Required. */
  appBaseUrl: string;
  /** OpenSalesTax engine base URL. Required. */
  ostaxApiUrl: string;
  /** OpenSalesTax engine API key. Optional. */
  ostaxApiKey: string | undefined;
  /** OST engine request timeout in ms. Default 5000. */
  ostaxTimeoutMs: number;
  /**
   * Fail-hard mode (constitution Â§8). When true, engine 5xx errors
   * propagate as webhook errors and block the checkout. When false
   * (default), engine errors return empty tax responses and let
   * Saleor fall back to its own catalog rates.
   */
  failHard: boolean;
  /**
   * Per-state nexus allowlist (CP-3). Empty set means "no filter
   * — call engine for every cart" (v1.1 behavior). When non-empty,
   * webhooks whose ship-to state is not in this set short-circuit
   * with an empty tax response without round-tripping the engine.
   * Parsed from `OSTAX_NEXUS_STATES` as a comma-separated list of
   * uppercase 2-letter US state codes (e.g. "MN,WI,IA"). Invalid
   * tokens are dropped silently with a single startup warning.
   */
  nexusStates: ReadonlySet<string>;
  /**
   * Single-tenant Saleor install. When set, the EnvAPL is seeded
   * from these values (per `@saleor/app-sdk`'s EnvAPL contract).
   * Empty strings are tolerated to support pre-install boot â€”
   * Saleor's install POST will then write the real values into
   * the running process's env (or the merchant edits docker-compose).
   */
  saleor: {
    apiUrl: string;
    appId: string;
    appToken: string;
  };
}

const FALSEY: ReadonlySet<string> = new Set(['', '0', 'false', 'no', 'off']);

function parseBool(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  return !FALSEY.has(raw.trim().toLowerCase());
}

function parsePort(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  // Port 0 is a valid input: the OS picks a free port. Used in tests.
  if (!Number.isFinite(n) || n < 0 || n > 65535) {
    throw new Error(`Invalid PORT "${raw}" â€” expected integer 0-65535`);
  }
  return n;
}

/** US state-code regex: uppercase 2-letter ISO 3166-2 subdivision. */
const STATE_CODE_REGEX = /^[A-Z]{2}$/;

/**
 * Parse `OSTAX_NEXUS_STATES` env var into a frozen Set of uppercase
 * 2-letter state codes. Accepts comma- or whitespace-separated input,
 * normalizes case, and silently drops malformed tokens. Returns an
 * empty Set when the input is undefined or empty (filter disabled).
 */
export function parseNexusStates(raw: string | undefined): ReadonlySet<string> {
  if (raw === undefined) return Object.freeze(new Set<string>());
  const trimmed = raw.trim();
  if (trimmed === '') return Object.freeze(new Set<string>());
  const out = new Set<string>();
  for (const tok of trimmed.split(/[\s,]+/)) {
    const upper = tok.trim().toUpperCase();
    if (STATE_CODE_REGEX.test(upper)) out.add(upper);
  }
  Object.freeze(out);
  return out;
}

function parseTimeout(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid OSTAX_TIMEOUT_MS "${raw}" â€” expected positive integer`);
  }
  return n;
}

function validateUrl(value: string, name: string): string {
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new Error(`${name} must be http(s); got protocol "${u.protocol}"`);
    }
    return value;
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid ${name} "${value}": ${cause}`);
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const appBaseUrl = env.APP_API_BASE_URL ?? '';
  if (!appBaseUrl) {
    throw new Error('APP_API_BASE_URL is required (public URL the app is reachable at)');
  }
  validateUrl(appBaseUrl, 'APP_API_BASE_URL');

  const ostaxApiUrl = env.OSTAX_API_URL ?? '';
  if (!ostaxApiUrl) {
    throw new Error('OSTAX_API_URL is required (OpenSalesTax engine base URL)');
  }
  validateUrl(ostaxApiUrl, 'OSTAX_API_URL');

  return {
    port: parsePort(env.PORT, 3000),
    appBaseUrl: stripTrailingSlashes(appBaseUrl),
    ostaxApiUrl: stripTrailingSlashes(ostaxApiUrl),
    ostaxApiKey: env.OSTAX_API_KEY ?? undefined,
    ostaxTimeoutMs: parseTimeout(env.OSTAX_TIMEOUT_MS, 5000),
    failHard: parseBool(env.OSTAX_FAIL_HARD),
    nexusStates: parseNexusStates(env.OSTAX_NEXUS_STATES),
    saleor: {
      apiUrl: env.SALEOR_API_URL ?? '',
      appId: env.SALEOR_APP_ID ?? '',
      appToken: env.SALEOR_APP_TOKEN ?? '',
    },
  };
}
