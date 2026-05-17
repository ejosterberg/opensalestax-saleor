// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

/**
 * Minimal HTTP client for the OpenSalesTax engine.
 *
 * Uses the global `fetch` available on Node 20+ â€” no axios / node-fetch
 * dependency. Lifted from `opensalestax-medusa`'s client.ts; the engine
 * HTTP contract is identical, only the package boundary changes.
 */

import { stripTrailingSlashes } from './url';

export interface OpenSalesTaxClientOptions {
  baseUrl: string;
  apiKey?: string;
  /** Per-request timeout in milliseconds. Default 5000. */
  timeoutMs?: number;
}

export interface CalculateLineItem {
  /** Pre-tax decimal string, e.g. "100.00". */
  amount: string;
  /** One of the OST engine's categories, or "" to use the default. */
  category: string;
}

export interface CalculateRequest {
  address: { zip5: string };
  line_items: CalculateLineItem[];
}

export interface JurisdictionRate {
  type: string;
  name: string;
  rate_pct: string;
  tax: string | null;
}

export interface CalculatedLine {
  amount: string;
  category: string;
  tax: string;
  rate_pct: string;
  jurisdictions: JurisdictionRate[];
  note?: string | null;
}

export interface CalculateResponse {
  subtotal: string;
  tax_total: string;
  lines: CalculatedLine[];
  disclaimer?: string;
}

export interface EngineHealth {
  status: string;
  version: string;
  database_connected: boolean;
}

export interface HealthCheckResult {
  ok: boolean;
  version?: string;
  db_connected?: boolean;
  rtt_ms: number;
  error?: string;
}

export class OpenSalesTaxApiError extends Error {
  public readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'OpenSalesTaxApiError';
    if (status !== undefined) {
      this.status = status;
    }
  }
}

/**
 * Thin client over the OST engine's v1 HTTP API.
 *
 * Calls `POST /v1/calculate` for per-line tax calculation and
 * `GET /v1/health` for liveness probing.
 */
export class OpenSalesTaxClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(options: OpenSalesTaxClientOptions) {
    this.baseUrl = stripTrailingSlashes(options.baseUrl);
    if (options.apiKey !== undefined) {
      this.apiKey = options.apiKey;
    }
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  /** Calculate per-line tax for the given destination ZIP + line items. */
  async calculate(req: CalculateRequest): Promise<CalculateResponse> {
    return this.post<CalculateResponse>('/v1/calculate', req);
  }

  /** Raw engine health payload â€” `{ status, version, database_connected }`. */
  async health(): Promise<EngineHealth> {
    return this.get<EngineHealth>('/v1/health');
  }

  /**
   * Liveness probe wrapper with RTT measurement and never-throws contract.
   *
   * Used by the Saleor app's startup probe (constitution Â§4). Returns
   * `{ ok: false, error }` on any failure rather than throwing, so the
   * caller can log a warning and continue booting.
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const h = await this.health();
      return {
        ok: h.status === 'ok' && h.database_connected,
        version: h.version,
        db_connected: h.database_connected,
        rtt_ms: Date.now() - start,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        rtt_ms: Date.now() - start,
        error: message,
      };
    }
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.apiKey !== undefined && this.apiKey !== '') {
      headers['X-API-Key'] = this.apiKey;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      const init: RequestInit = { method, headers, signal: controller.signal };
      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }
      response = await fetch(url, init);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new OpenSalesTaxApiError(
        `Network error contacting OpenSalesTax engine at ${this.baseUrl}: ${message}`,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new OpenSalesTaxApiError(
        `OpenSalesTax engine returned HTTP ${response.status}${text ? ': ' + text.slice(0, 200) : ''}`,
        response.status,
      );
    }

    try {
      return (await response.json()) as T;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new OpenSalesTaxApiError(
        `OpenSalesTax engine returned malformed JSON: ${message}`,
      );
    }
  }
}
