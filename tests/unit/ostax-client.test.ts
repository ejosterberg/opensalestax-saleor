// SPDX-License-Identifier: Apache-2.0

import {
  OpenSalesTaxApiError,
  OpenSalesTaxClient,
} from '../../src/lib/ostax-client';

describe('OpenSalesTaxClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetch(
    responder: (input: RequestInfo | URL, init?: RequestInit) => Response,
  ): void {
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      Promise.resolve(responder(input, init)),
    ) as typeof fetch;
  }

  it('trims trailing slashes from the base URL', async () => {
    const client = new OpenSalesTaxClient({ baseUrl: 'http://engine.local:8080///' });
    mockFetch((input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      expect(url).toBe('http://engine.local:8080/v1/health');
      return new Response(
        JSON.stringify({ status: 'ok', version: 'x', database_connected: true }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    await client.health();
  });

  it('returns parsed JSON on 200 OK', async () => {
    const client = new OpenSalesTaxClient({ baseUrl: 'http://engine.local:8080' });
    mockFetch(
      () =>
        new Response(
          JSON.stringify({
            subtotal: '100.00',
            tax_total: '7.88',
            lines: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    const out = await client.calculate({
      address: { zip5: '55401' },
      line_items: [{ amount: '100.00', category: 'general' }],
    });
    expect(out.subtotal).toBe('100.00');
  });

  it('throws OpenSalesTaxApiError on HTTP 500', async () => {
    const client = new OpenSalesTaxClient({ baseUrl: 'http://engine.local:8080' });
    mockFetch(
      () =>
        new Response('boom', {
          status: 500,
          headers: { 'content-type': 'text/plain' },
        }),
    );
    await expect(
      client.calculate({ address: { zip5: '55401' }, line_items: [] }),
    ).rejects.toThrow(OpenSalesTaxApiError);
  });

  it('includes the X-API-Key header when apiKey is configured', async () => {
    const client = new OpenSalesTaxClient({
      baseUrl: 'http://engine.local:8080',
      apiKey: 'k-secret',
    });
    mockFetch((_input, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('x-api-key')).toBe('k-secret');
      return new Response('{}', { status: 200 });
    });
    await client.health().catch(() => undefined);
  });

  it('omits X-API-Key when apiKey is empty string', async () => {
    const client = new OpenSalesTaxClient({
      baseUrl: 'http://engine.local:8080',
      apiKey: '',
    });
    mockFetch((_input, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('x-api-key')).toBeNull();
      return new Response(
        JSON.stringify({ status: 'ok', version: 'x', database_connected: true }),
        { status: 200 },
      );
    });
    await client.health();
  });

  it('healthCheck() returns ok:false on network error and never throws', async () => {
    const client = new OpenSalesTaxClient({ baseUrl: 'http://engine.local:8080' });
    mockFetch(() => {
      throw new Error('ECONNREFUSED');
    });
    const h = await client.healthCheck();
    expect(h.ok).toBe(false);
    expect(h.error).toContain('ECONNREFUSED');
    expect(typeof h.rtt_ms).toBe('number');
  });

  it('healthCheck() returns ok:true when engine reports healthy', async () => {
    const client = new OpenSalesTaxClient({ baseUrl: 'http://engine.local:8080' });
    mockFetch(
      () =>
        new Response(
          JSON.stringify({
            status: 'ok',
            version: '0.55.4',
            database_connected: true,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    const h = await client.healthCheck();
    expect(h.ok).toBe(true);
    expect(h.version).toBe('0.55.4');
    expect(h.db_connected).toBe(true);
  });

  it('healthCheck() returns ok:false when database_connected is false', async () => {
    const client = new OpenSalesTaxClient({ baseUrl: 'http://engine.local:8080' });
    mockFetch(
      () =>
        new Response(
          JSON.stringify({
            status: 'ok',
            version: 'x',
            database_connected: false,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    const h = await client.healthCheck();
    expect(h.ok).toBe(false);
  });
});
