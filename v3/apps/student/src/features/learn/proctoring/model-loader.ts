import type { ModelAsset } from './assets';

/** Cache Storage bucket for proctoring model files. Bump the suffix to drop every saved file. */
export const MODEL_CACHE = 'vibe-proctoring-v1';
/** Every cache this app creates starts with this; "Clear app files" removes them all. */
export const APP_CACHE_PREFIX = 'vibe-';
/** A download that receives nothing for this long is reported as stalled. */
export const STALL_MS = 20_000;
/** At most one progress update per this many ms per file (plus the final one). */
const PROGRESS_INTERVAL_MS = 100;
const SIZE_HEADER = 'x-vibe-size';

export type LoadState = 'checking' | 'downloading' | 'stalled' | 'cached' | 'done';

export interface LoadProgress {
  state: LoadState;
  received: number;
  /** null when the size isn't known: show bytes received, never a made-up percentage. */
  total: number | null;
}

export interface LoadedFile {
  bytes: Uint8Array<ArrayBuffer>;
  fromCache: boolean;
  /** False when the device refused to store it (it will download again next time). */
  saved: boolean;
}

export type LoadFailure = 'network' | 'http' | 'interrupted' | 'unsupported';

/** A model file couldn't be loaded, with a reason students can act on. */
export class ModelLoadError extends Error {
  constructor(
    readonly reason: LoadFailure,
    message: string,
  ) {
    super(message);
    this.name = 'ModelLoadError';
  }
}

async function openModelCache(): Promise<Cache | null> {
  try {
    return typeof caches === 'undefined' ? null : await caches.open(MODEL_CACHE);
  } catch {
    // Some private-browsing modes and insecure contexts refuse Cache Storage.
    return null;
  }
}

async function readSaved(cache: Cache, url: string): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    const hit = await cache.match(url);
    if (!hit) return null;
    const expected = Number(hit.headers.get(SIZE_HEADER));
    const bytes = new Uint8Array(await hit.arrayBuffer());
    if (expected > 0 && bytes.byteLength === expected) return bytes;
  } catch {
    // Unreadable entry: treated as missing below.
  }
  await cache.delete(url).catch(() => undefined);
  return null;
}

async function save(cache: Cache | null, url: string, bytes: Uint8Array<ArrayBuffer>, contentType: string | null): Promise<boolean> {
  if (!cache) return false;
  try {
    await cache.put(
      url,
      new Response(bytes, {
        headers: { 'content-type': contentType ?? 'application/octet-stream', [SIZE_HEADER]: String(bytes.byteLength) },
      }),
    );
    return true;
  } catch {
    // QuotaExceededError and friends: still usable for this lesson.
    return false;
  }
}

/**
 * Loads one model file: from the device when it was saved before (and is
 * intact), otherwise downloaded with byte-accurate progress and then saved.
 */
export async function loadAsset(
  asset: ModelAsset,
  onProgress: (progress: LoadProgress) => void = () => undefined,
  options: { signal?: AbortSignal; stallMs?: number } = {},
): Promise<LoadedFile> {
  const { signal, stallMs = STALL_MS } = options;
  onProgress({ state: 'checking', received: 0, total: asset.size ?? null });

  const cache = await openModelCache();
  const saved = cache && (await readSaved(cache, asset.url));
  if (saved) {
    onProgress({ state: 'cached', received: saved.byteLength, total: saved.byteLength });
    return { bytes: saved, fromCache: true, saved: true };
  }

  let response: Response;
  try {
    response = await fetch(asset.url, { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ModelLoadError('network', 'Couldn’t reach the model server.');
  }
  if (!response.ok) throw new ModelLoadError('http', `The model server answered with an error (${response.status}).`);

  // Content-Length is the compressed size when the CDN compresses, so the pinned size wins.
  const headerSize = Number(response.headers.get('content-length')) || null;
  let total: number | null = asset.size ?? headerSize;
  let received = 0;
  const chunks: Uint8Array[] = [];
  let state: LoadState = 'downloading';
  let lastEmit = 0;
  let trailing: ReturnType<typeof setTimeout> | undefined;
  const emit = (force = false) => {
    const now = Date.now();
    if (!force && now - lastEmit < PROGRESS_INTERVAL_MS) {
      // Throttled: still show the latest numbers once the interval passes.
      trailing ??= setTimeout(() => {
        trailing = undefined;
        emit(true);
      }, PROGRESS_INTERVAL_MS - (now - lastEmit));
      return;
    }
    clearTimeout(trailing);
    trailing = undefined;
    lastEmit = now;
    onProgress({ state, received, total });
  };
  emit(true);

  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  const armStallTimer = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      state = 'stalled';
      emit(true);
    }, stallMs);
  };

  try {
    if (!response.body) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      chunks.push(bytes);
      received = bytes.byteLength;
    } else {
      const reader = response.body.getReader();
      armStallTimer();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        // More bytes than the expected total means the total was wrong: stop claiming a percentage.
        if (total !== null && received > total) total = null;
        // The stall timer changes `state` behind TypeScript's back.
        const wasStalled = (state as LoadState) === 'stalled';
        state = 'downloading';
        armStallTimer();
        emit(wasStalled);
      }
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ModelLoadError('interrupted', 'The download was interrupted.');
  } finally {
    clearTimeout(stallTimer);
    clearTimeout(trailing);
    trailing = undefined;
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  state = 'done';
  total = received;
  emit(true);

  return { bytes, fromCache: false, saved: await save(cache, asset.url, bytes, response.headers.get('content-type')) };
}

export interface GroupProgress {
  /** Cached only when every file came from the device. */
  state: LoadState;
  received: number;
  total: number | null;
}

export interface LoadedGroup {
  files: Record<string, Uint8Array<ArrayBuffer>>;
  fromCache: boolean;
  saved: boolean;
}

/** Loads a check's files in parallel and reports their combined progress. */
export async function loadAssets(
  assets: ModelAsset[],
  onProgress: (progress: GroupProgress) => void = () => undefined,
  options: { signal?: AbortSignal; stallMs?: number } = {},
): Promise<LoadedGroup> {
  const each = new Map<string, LoadProgress>();
  const report = () => {
    const all = assets.map((a) => each.get(a.id) ?? { state: 'checking' as const, received: 0, total: a.size ?? null });
    const states = all.map((p) => p.state);
    const state: LoadState = states.every((s) => s === 'cached')
      ? 'cached'
      : states.every((s) => s === 'cached' || s === 'done')
        ? 'done'
        : states.includes('stalled')
          ? 'stalled'
          : states.includes('downloading') || states.includes('done')
            ? 'downloading'
            : 'checking';
    const received = all.reduce((sum, p) => sum + p.received, 0);
    const total = all.every((p) => p.total !== null) ? all.reduce((sum, p) => sum + (p.total ?? 0), 0) : null;
    onProgress({ state, received, total });
  };

  // One failed file fails the check: cancel the rest, and stop reporting their progress.
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  let failed = false;
  let results: LoadedFile[];
  try {
    results = await Promise.all(
      assets.map((asset) =>
        loadAsset(
          asset,
          (progress) => {
            if (failed) return;
            each.set(asset.id, progress);
            report();
          },
          { ...options, signal: controller.signal },
        ).catch((error: unknown) => {
          if (!failed) {
            failed = true;
            controller.abort();
          }
          throw error;
        }),
      ),
    );
  } finally {
    options.signal?.removeEventListener('abort', abort);
  }
  return {
    files: Object.fromEntries(assets.map((a, i) => [a.id, results[i].bytes])),
    fromCache: results.every((r) => r.fromCache),
    saved: results.every((r) => r.saved),
  };
}

/** Deletes every saved proctoring model, so the next load downloads them fresh. */
export async function clearProctoringCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  await caches.delete(MODEL_CACHE).catch(() => false);
}

/**
 * Deletes this app's own caches (app shell, assets, models) and its offline
 * service worker. Sign-in (IndexedDB) and settings (localStorage) are untouched.
 */
export async function clearAppFiles(): Promise<void> {
  if (typeof caches !== 'undefined') {
    const keys = await caches.keys().catch(() => [] as string[]);
    await Promise.all(keys.filter((k) => k.startsWith(APP_CACHE_PREFIX)).map((k) => caches.delete(k).catch(() => false)));
  }
  const registrations = await navigator.serviceWorker?.getRegistrations?.().catch(() => []);
  await Promise.all((registrations ?? []).map((r) => r.unregister().catch(() => false)));
}
