import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MODEL_CACHE,
  ModelLoadError,
  clearAppFiles,
  clearProctoringCache,
  loadAsset,
  loadAssets,
  type LoadProgress,
} from './model-loader';

/** In-memory Cache Storage, enough for the loader. */
class FakeCache {
  entries = new Map<string, Response>();
  failPut = false;
  async match(url: string) {
    return this.entries.get(url)?.clone();
  }
  async put(url: string, response: Response) {
    if (this.failPut) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    this.entries.set(url, response);
  }
  async delete(url: string) {
    return this.entries.delete(url);
  }
}

class FakeCacheStorage {
  stores = new Map<string, FakeCache>();
  async open(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new FakeCache());
    return this.stores.get(name)!;
  }
  async keys() {
    return [...this.stores.keys()];
  }
  async delete(name: string) {
    return this.stores.delete(name);
  }
}

/** A response body the test feeds chunk by chunk. */
function controllableBody() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) });
  return {
    stream,
    push: (n: number) => controller.enqueue(new Uint8Array(n).fill(7)),
    close: () => controller.close(),
    fail: () => controller.error(new TypeError('network error')),
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const asset = { id: 'model', url: 'https://cdn.example/model.bin', size: 400 };
let storage: FakeCacheStorage;

beforeEach(() => {
  storage = new FakeCacheStorage();
  vi.stubGlobal('caches', storage);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('loadAsset', () => {
  it('downloads with byte progress against the pinned size, then saves the file', async () => {
    const body = controllableBody();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body.stream, { headers: { 'content-length': '120' } })));
    const progress: LoadProgress[] = [];
    const loading = loadAsset(asset, (p) => progress.push(p));

    await flush();
    body.push(100);
    await new Promise((r) => setTimeout(r, 150));
    expect(progress.at(-1)).toMatchObject({ state: 'downloading', received: 100, total: 400 });
    body.push(300);
    body.close();

    const file = await loading;
    expect(file).toMatchObject({ fromCache: false, saved: true });
    expect(file.bytes.byteLength).toBe(400);
    expect(progress.at(-1)).toEqual({ state: 'done', received: 400, total: 400 });
    expect((await storage.open(MODEL_CACHE)).entries.has(asset.url)).toBe(true);
  });

  it('loads a saved file from the device without downloading', async () => {
    const fetch = vi.fn(async () => new Response(new Uint8Array(400)));
    vi.stubGlobal('fetch', fetch);
    await loadAsset(asset);
    fetch.mockClear();

    const progress: LoadProgress[] = [];
    const file = await loadAsset(asset, (p) => progress.push(p));
    expect(fetch).not.toHaveBeenCalled();
    expect(file).toMatchObject({ fromCache: true, saved: true });
    expect(progress.at(-1)).toEqual({ state: 'cached', received: 400, total: 400 });
  });

  it('uses the response size when no size is pinned, and none when there is no size at all', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(50), { headers: { 'content-length': '50' } })));
    const known: LoadProgress[] = [];
    await loadAsset({ id: 'a', url: 'https://cdn.example/a' }, (p) => known.push(p));
    expect(known.find((p) => p.state === 'downloading')?.total).toBe(50);

    const body = controllableBody();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body.stream)));
    const unknown: LoadProgress[] = [];
    const loading = loadAsset({ id: 'b', url: 'https://cdn.example/b' }, (p) => unknown.push(p));
    await flush();
    body.push(30);
    await new Promise((r) => setTimeout(r, 150));
    expect(unknown.at(-1)).toMatchObject({ state: 'downloading', received: 30, total: null });
    body.close();
    await loading;
  });

  it('stops claiming a total once more bytes than expected arrive', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(500))));
    const progress: LoadProgress[] = [];
    await loadAsset(asset, (p) => progress.push(p));
    expect(progress.every((p) => p.total === null || p.received <= p.total)).toBe(true);
    expect(progress.at(-1)).toEqual({ state: 'done', received: 500, total: 500 });
  });

  it('discards a damaged saved file and downloads it again', async () => {
    const cache = await storage.open(MODEL_CACHE);
    cache.entries.set(asset.url, new Response(new Uint8Array(10), { headers: { 'x-vibe-size': '400' } }));
    const fetch = vi.fn(async () => new Response(new Uint8Array(400)));
    vi.stubGlobal('fetch', fetch);

    const file = await loadAsset(asset);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(file).toMatchObject({ fromCache: false, saved: true });
    expect(file.bytes.byteLength).toBe(400);
  });

  it('still returns the file when the device refuses to store it', async () => {
    (await storage.open(MODEL_CACHE)).failPut = true;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(400))));
    expect(await loadAsset(asset)).toMatchObject({ fromCache: false, saved: false });
  });

  it('works without Cache Storage, reporting the file as not saved', async () => {
    vi.stubGlobal('caches', undefined);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(400))));
    expect(await loadAsset(asset)).toMatchObject({ fromCache: false, saved: false });
  });

  it('explains failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(loadAsset(asset)).rejects.toMatchObject({ reason: 'network', message: 'Couldn’t reach the model server.' });

    vi.stubGlobal('fetch', vi.fn(async () => new Response('gone', { status: 404 })));
    await expect(loadAsset(asset)).rejects.toMatchObject({ reason: 'http' });

    const body = controllableBody();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body.stream)));
    const loading = loadAsset(asset);
    await flush();
    body.fail();
    await expect(loading).rejects.toBeInstanceOf(ModelLoadError);
    await expect(loading).rejects.toMatchObject({ reason: 'interrupted' });
  });

  it('reports a stall after 20 seconds without data, and recovers when data arrives', async () => {
    vi.useFakeTimers();
    const body = controllableBody();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body.stream)));
    const progress: LoadProgress[] = [];
    const loading = loadAsset(asset, (p) => progress.push(p));

    await vi.advanceTimersByTimeAsync(0);
    body.push(100);
    await vi.advanceTimersByTimeAsync(19_000);
    expect(progress.at(-1)?.state).toBe('downloading');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(progress.at(-1)).toMatchObject({ state: 'stalled', received: 100 });

    body.push(100);
    await vi.advanceTimersByTimeAsync(0);
    expect(progress.at(-1)).toMatchObject({ state: 'downloading', received: 200 });
    body.push(200);
    body.close();
    await expect(loading).resolves.toMatchObject({ fromCache: false });
  });

  it('sends at most about ten progress updates a second', async () => {
    vi.useFakeTimers();
    const body = controllableBody();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body.stream)));
    const progress: LoadProgress[] = [];
    const loading = loadAsset({ id: 'x', url: 'https://cdn.example/x', size: 1000 }, (p) => progress.push(p));
    await vi.advanceTimersByTimeAsync(0);
    const before = progress.length;
    for (let i = 0; i < 50; i++) body.push(10);
    await vi.advanceTimersByTimeAsync(0);
    expect(progress.length - before).toBeLessThanOrEqual(2);
    body.push(500);
    body.close();
    await loading;
    expect(progress.at(-1)).toEqual({ state: 'done', received: 1000, total: 1000 });
  });
});

describe('loadAssets', () => {
  it('combines progress across files and says cached only when every file was saved', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(new Uint8Array(url.endsWith('a') ? 100 : 300))));
    const files = [
      { id: 'a', url: 'https://cdn.example/a', size: 100 },
      { id: 'b', url: 'https://cdn.example/b', size: 300 },
    ];
    const first: { state: string; received: number; total: number | null }[] = [];
    const loaded = await loadAssets(files, (p) => first.push(p));
    expect(Object.keys(loaded.files)).toEqual(['a', 'b']);
    expect(loaded.fromCache).toBe(false);
    expect(first.at(-1)).toEqual({ state: 'done', received: 400, total: 400 });

    const second: { state: string }[] = [];
    expect((await loadAssets(files, (p) => second.push(p))).fromCache).toBe(true);
    expect(second.at(-1)?.state).toBe('cached');
  });
});

describe('loadAssets failure', () => {
  it('fails the check on the first failed file, cancels the others and stops reporting their progress', async () => {
    const slow = controllableBody();
    let slowSignal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('blocked')) throw new TypeError('Failed to fetch');
        slowSignal = init?.signal ?? undefined;
        return new Response(slow.stream);
      }),
    );
    const progress: { state: string }[] = [];
    const loading = loadAssets(
      [
        { id: 'slow', url: 'https://cdn.example/slow', size: 100 },
        { id: 'blocked', url: 'https://cdn.example/blocked', size: 100 },
      ],
      (p) => progress.push(p),
    );
    await expect(loading).rejects.toMatchObject({ reason: 'network' });
    expect(slowSignal?.aborted).toBe(true);
    const after = progress.length;
    try {
      slow.push(50);
    } catch {
      // The cancelled stream may refuse more data.
    }
    await flush();
    expect(progress.length).toBe(after);
  });
});

describe('clearing', () => {
  it('"Download models again" deletes only the model cache', async () => {
    await storage.open(MODEL_CACHE);
    await storage.open('vibe-assets');
    await clearProctoringCache();
    expect(await storage.keys()).toEqual(['vibe-assets']);
  });

  it('"Clear app files" deletes this app’s caches and service worker, nothing else', async () => {
    await storage.open(MODEL_CACHE);
    await storage.open('vibe-assets');
    await storage.open('vibe-shell-3');
    await storage.open('someone-else');
    const unregister = vi.fn(async () => true);
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: { getRegistrations: async () => [{ unregister }] } });
    localStorage.setItem('theme', 'dark');

    await clearAppFiles();
    expect(await storage.keys()).toEqual(['someone-else']);
    expect(unregister).toHaveBeenCalled();
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});
