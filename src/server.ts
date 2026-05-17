// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

/**
 * HTTP server entrypoint.
 *
 * Raw Node `http` (no Express, no Next.js â€” constitution Â§2 Decision B)
 * with a thin adapter that converts Node `IncomingMessage` to Web API
 * `Request` and `Response` back, so we can mount `@saleor/app-sdk`'s
 * `WebApiHandler` functions directly.
 */

import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { loadConfig } from './lib/config';
import { OpenSalesTaxClient } from './lib/ostax-client';
import { createSaleorApp } from './lib/saleor-app';

import { createManifestRouteHandler } from './handlers/manifest';
import { createRegisterRouteHandler } from './handlers/register';
import { buildCheckoutCalculateTaxesWebhook } from './handlers/checkout-calculate-taxes';
import { buildOrderCalculateTaxesWebhook } from './handlers/order-calculate-taxes';

type FetchHandler = (req: Request) => Response | Promise<Response>;

interface Route {
  method: 'GET' | 'POST';
  path: string;
  handler: FetchHandler;
}

async function nodeRequestToWebRequest(
  nodeReq: IncomingMessage,
  baseUrl: string,
): Promise<Request> {
  const fullUrl = new URL(nodeReq.url ?? '/', baseUrl);
  const headers = new Headers();
  for (const [k, v] of Object.entries(nodeReq.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      for (const item of v) headers.append(k, item);
    } else {
      headers.set(k, v);
    }
  }

  const method = (nodeReq.method ?? 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    return new Request(fullUrl, { method, headers });
  }

  const chunks: Buffer[] = [];
  for await (const chunk of nodeReq) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  const body = Buffer.concat(chunks);
  return new Request(fullUrl, { method, headers, body });
}

async function writeWebResponseToNode(
  webRes: Response,
  nodeRes: ServerResponse,
): Promise<void> {
  nodeRes.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => {
    nodeRes.setHeader(key, value);
  });
  if (webRes.body === null) {
    nodeRes.end();
    return;
  }
  const buf = Buffer.from(await webRes.arrayBuffer());
  nodeRes.end(buf);
}

function matchRoute(
  routes: ReadonlyArray<Route>,
  method: string,
  path: string,
): Route | undefined {
  for (const r of routes) {
    if (r.method === method && r.path === path) return r;
  }
  return undefined;
}

export interface ServerHandle {
  server: http.Server;
  /** Resolves once the boot health probe has finished logging. */
  readyProbe: Promise<void>;
  close(): Promise<void>;
}

export async function startServer(): Promise<ServerHandle> {
  const config = loadConfig();
  const { apl } = createSaleorApp(config);

  const client = new OpenSalesTaxClient({
    baseUrl: config.ostaxApiUrl,
    ...(config.ostaxApiKey !== undefined ? { apiKey: config.ostaxApiKey } : {}),
    timeoutMs: config.ostaxTimeoutMs,
  });

  const checkout = buildCheckoutCalculateTaxesWebhook({
    apl,
    client,
    failHard: config.failHard,
  });
  const order = buildOrderCalculateTaxesWebhook({
    apl,
    client,
    failHard: config.failHard,
  });

  const routes: ReadonlyArray<Route> = [
    {
      method: 'GET',
      path: '/api/manifest',
      handler: createManifestRouteHandler({
        appBaseUrl: config.appBaseUrl,
        webhooks: [checkout.webhook, order.webhook],
      }),
    },
    {
      method: 'POST',
      path: '/api/register',
      handler: createRegisterRouteHandler(apl),
    },
    {
      method: 'POST',
      path: '/api/webhooks/checkout-calculate-taxes',
      handler: checkout.handler,
    },
    {
      method: 'POST',
      path: '/api/webhooks/order-calculate-taxes',
      handler: order.handler,
    },
    {
      method: 'GET',
      path: '/health',
      handler: async (): Promise<Response> => {
        const h = await client.healthCheck();
        const status = h.ok ? 200 : 503;
        return new Response(JSON.stringify(h), {
          status,
          headers: { 'content-type': 'application/json' },
        });
      },
    },
  ];

  const server = http.createServer((nodeReq, nodeRes) => {
    void (async (): Promise<void> => {
      try {
        const path = (nodeReq.url ?? '/').split('?')[0] ?? '/';
        const method = (nodeReq.method ?? 'GET').toUpperCase();
        const route = matchRoute(routes, method, path);
        if (route === undefined) {
          nodeRes.statusCode = 404;
          nodeRes.setHeader('content-type', 'application/json');
          nodeRes.end(JSON.stringify({ error: 'Not Found' }));
          return;
        }
        const webReq = await nodeRequestToWebRequest(nodeReq, config.appBaseUrl);
        const webRes = await route.handler(webReq);
        await writeWebResponseToNode(webRes, nodeRes);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'internal error';
        console.error(
          JSON.stringify({ level: 'error', msg: 'server.uncaught', error: message }),
        );
        if (!nodeRes.headersSent) {
          nodeRes.statusCode = 500;
          nodeRes.setHeader('content-type', 'application/json');
          nodeRes.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      }
    })();
  });

  await new Promise<void>((resolve) => {
    server.listen(config.port, () => resolve());
  });

  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'server.started',
      port: config.port,
      appBaseUrl: config.appBaseUrl,
      ostaxApiUrl: config.ostaxApiUrl,
      saleorApiUrl: config.saleor.apiUrl || '(none â€” pre-install)',
      failHard: config.failHard,
    }),
  );

  // Startup probe â€” log a warning if engine is unreachable but don't crash;
  // engine may come up after the app.
  const readyProbe = client
    .healthCheck()
    .then((h) => {
      if (h.ok) {
        console.log(
          JSON.stringify({
            level: 'info',
            msg: 'engine.healthy',
            version: h.version,
            rtt_ms: h.rtt_ms,
          }),
        );
      } else {
        console.warn(
          JSON.stringify({
            level: 'warn',
            msg: 'engine.unreachable_at_boot',
            error: h.error,
            rtt_ms: h.rtt_ms,
          }),
        );
      }
    })
    .catch(() => undefined);

  return {
    server,
    readyProbe,
    close: async (): Promise<void> => {
      await readyProbe;
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

if (require.main === module) {
  startServer().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ level: 'fatal', msg: 'server.boot_failed', error: message }));
    process.exit(1);
  });
}
