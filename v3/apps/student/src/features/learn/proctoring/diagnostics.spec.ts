import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatReport, runDiagnostics, type CheckResult } from './diagnostics';
import { MODEL_CACHE } from './model-loader';

async function all(): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  for await (const r of runDiagnostics()) out.push(r);
  return out;
}
const find = (results: CheckResult[], id: string) => results.find((r) => r.id === id)!;

function healthyBrowser({ permissions = 'granted', devices = ['videoinput', 'audioinput'] }: { permissions?: string; devices?: string[] } = {}) {
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('OffscreenCanvas', class {});
  vi.stubGlobal('AudioContext', class {});
  vi.stubGlobal('Worker', class {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { enumerateDevices: vi.fn(async () => devices.map((kind) => ({ kind }))) },
  });
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: vi.fn(async () => ({ state: permissions })) } });
  Object.defineProperty(navigator, 'storage', { configurable: true, value: { estimate: vi.fn(async () => ({ quota: 2e9, usage: 1e8 })) } });
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistration: vi.fn(async () => ({})) } });
  const saved = new Set<string>();
  vi.stubGlobal('caches', {
    open: vi.fn(async () => ({ keys: async () => [...saved].map((url) => new Request(url)) })),
    keys: vi.fn(async () => [MODEL_CACHE, 'vibe-assets', 'vibe-shell-3']),
  });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(1000))));
  return { saved };
}

beforeEach(() => healthyBrowser());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('runDiagnostics', () => {
  it('passes a healthy setup, including every model host', async () => {
    const results = await all();
    for (const id of ['secure', 'wasm', 'webgl', 'workers', 'audio', 'camera', 'microphone', 'storage']) expect(find(results, id).status).toBe('pass');
    const hosts = results.filter((r) => r.id.startsWith('host-'));
    expect(hosts.map((h) => h.label)).toEqual(expect.arrayContaining(['Model server: cdn.jsdelivr.net', 'Model server: storage.googleapis.com', 'Model server: tfhub.dev (Kaggle)']));
    expect(hosts.every((h) => h.status === 'pass')).toBe(true);
    expect(find(results, 'app-files').detail).toMatch(/^Installed \(2 saved file groups\)/);
  });

  it('fails a browser without WebAssembly or WebGL and suggests an up-to-date browser', async () => {
    vi.spyOn(WebAssembly, 'validate').mockReturnValue(false);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const results = await all();
    expect(find(results, 'wasm')).toMatchObject({ status: 'fail', fix: expect.stringMatching(/up-to-date Chrome, Edge or Firefox/) });
    expect(find(results, 'webgl').status).toBe('fail');
  });

  it('names an unreachable host and suggests another network or turning off an ad blocker', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => (url.includes('storage.googleapis.com') ? Promise.reject(new TypeError('blocked')) : new Response('{}'))),
    );
    const host = find(await all(), 'host-storage.googleapis.com');
    expect(host).toMatchObject({ status: 'fail', detail: 'Couldn’t be reached.' });
    expect(host.fix).toMatch(/another network.*ad blocker or VPN/);
  });

  it('reports blocked camera access and a missing microphone', async () => {
    healthyBrowser({ permissions: 'denied', devices: ['videoinput'] });
    const results = await all();
    expect(find(results, 'camera')).toMatchObject({ status: 'fail', detail: expect.stringMatching(/blocked/) });
    expect(find(results, 'microphone')).toMatchObject({ status: 'fail', detail: 'No microphone found.' });
  });

  it('warns about low storage and a browser that won’t save models', async () => {
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { estimate: vi.fn(async () => ({ quota: 1e8, usage: 9e7 })) } });
    vi.stubGlobal('caches', undefined);
    const results = await all();
    expect(find(results, 'storage').status).toBe('warn');
    expect(find(results, 'saved-models')).toMatchObject({ status: 'warn', detail: expect.stringMatching(/download every time/) });
  });

  it('lists which checks’ models are saved', async () => {
    const { saved } = healthyBrowser();
    const { faceCountAssets } = await import('./assets');
    faceCountAssets().forEach((a) => saved.add(new URL(a.url).href));
    expect(find(await all(), 'saved-models').detail).toBe('Saved on this device: Face detection.');
  });

  it('never opens the camera or microphone', async () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { enumerateDevices: async () => [], getUserMedia } });
    await all();
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});

describe('formatReport', () => {
  it('lists every check with its result and fix, the browser, and nothing personal', async () => {
    localStorage.setItem('vibe-auth', 'secret-token');
    const results = await all();
    const report = formatReport(results, new Date('2026-11-10T10:00:00Z'));
    expect(report).toMatch(/^ViBe device check, 2026-11-10T10:00:00.000Z\nBrowser: /);
    expect(report).toContain('[PASS] WebAssembly: Supported, with SIMD.');
    expect(report.split('\n').filter((l) => /^\[(PASS|WARN|FAIL|INFO)\]/.test(l))).toHaveLength(results.length);
    expect(report).not.toMatch(/secret-token|@|data:image/);
  });
});
