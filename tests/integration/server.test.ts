// SPDX-License-Identifier: Apache-2.0

/**
 * Server-level integration test.
 *
 * Boots the real HTTP server with a fake OST engine, hits the
 * /api/manifest endpoint, and asserts the response shape. Exercises
 * the manifest/register/webhook wiring without needing a live Saleor.
 */

import { AddressInfo } from 'node:net';

import { startServer } from '../../src/server';
import type { ServerHandle } from '../../src/server';

describe('server integration', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let handle: ServerHandle;
  let baseUrl: string;

  beforeAll(async () => {
    originalEnv = { ...process.env };
    process.env.PORT = '0'; // ask OS for a free port
    process.env.APP_API_BASE_URL = 'http://localhost:3000';
    process.env.OSTAX_API_URL = 'http://127.0.0.1:1';
    process.env.OSTAX_TIMEOUT_MS = '500';
    handle = await startServer();
    const addr = handle.server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    if (handle) await handle.close();
    process.env = originalEnv;
  });

  it('GET /api/manifest returns the Saleor manifest', async () => {
    const res = await fetch(`${baseUrl}/api/manifest`);
    expect(res.status).toBe(200);
    const manifest = (await res.json()) as Record<string, unknown>;
    expect(manifest.id).toBe('ejosterberg.opensalestax');
    expect(manifest.name).toBe('OpenSalesTax');
    expect(manifest.permissions).toEqual(['HANDLE_TAXES']);
    expect(Array.isArray(manifest.webhooks)).toBe(true);
    const webhooks = manifest.webhooks as Array<{ syncEvents?: string[]; targetUrl: string }>;
    expect(webhooks).toHaveLength(2);
    const events = webhooks.flatMap((w) => w.syncEvents ?? []);
    expect(events).toContain('CHECKOUT_CALCULATE_TAXES');
    expect(events).toContain('ORDER_CALCULATE_TAXES');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    expect(res.status).toBe(404);
  });

  it('GET /health returns 503 when engine is unreachable', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(503);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
  });

  it('webhook endpoint rejects unauthenticated requests', async () => {
    const res = await fetch(`${baseUrl}/api/webhooks/checkout-calculate-taxes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ taxBase: {} }),
    });
    // No saleor signature, no APL entry — must NOT be 200.
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
