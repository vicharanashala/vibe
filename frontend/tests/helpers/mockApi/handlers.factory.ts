import { http, HttpResponse, type HttpHandler } from 'msw';
import { server } from './server.js';

export type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface MockEndpointOptions {
  status?: number;
  delayMs?: number;
}

export function mockEndpoint(
  method: Method,
  path: string,
  body: unknown,
  opts: MockEndpointOptions = {}
): HttpHandler {
  const handler = http[method](path, async () => {
    if (opts.delayMs) await new Promise(r => setTimeout(r, opts.delayMs));
    return HttpResponse.json(body, { status: opts.status ?? 200 });
  });
  server.use(handler);
  return handler;
}

export function mockError(method: Method, path: string, status: number, message = 'Mock error'): HttpHandler {
  const handler = http[method](path, () => HttpResponse.json({ error: message }, { status }));
  server.use(handler);
  return handler;
}

export function mockNetworkError(method: Method, path: string): HttpHandler {
  const handler = http[method](path, () => HttpResponse.error());
  server.use(handler);
  return handler;
}
