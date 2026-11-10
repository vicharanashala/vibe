import { faceCountAssets, faceRecognitionAssets, gestureAssets, MODEL_CHECK_LABELS, MODEL_HOSTS, voiceAssets, type ModelAsset, type ModelCheck } from './assets';
import { simdSupported, wasmSupported } from './browser';
import { formatMb } from './format';
import { APP_CACHE_PREFIX, MODEL_CACHE } from './model-loader';

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  /** What was found, in plain language. */
  detail: string;
  /** What to do about it (warnings and failures). */
  fix?: string;
}

const HOST_TIMEOUT_MS = 8_000;
const SLOW_MS = 3_000;
const LOW_SPACE_BYTES = 200 * 1024 * 1024;
const UPDATE_BROWSER = 'Use an up-to-date Chrome, Edge or Firefox on a computer.';

/** "Chrome 130 on Windows", from the browser's own report where available. */
export function describeBrowser(): string {
  const data = (navigator as Navigator & { userAgentData?: { brands?: { brand: string; version: string }[]; platform?: string } }).userAgentData;
  const brand = data?.brands?.find((b) => !/not.?a.?brand|chromium/i.test(b.brand)) ?? data?.brands?.find((b) => /chromium/i.test(b.brand));
  if (brand) return `${brand.brand} ${brand.version}${data?.platform ? ` on ${data.platform}` : ''}`;
  const ua = navigator.userAgent;
  const match =
    /(Edg|OPR|Firefox|Chrome|Version)\/(\d+)/.exec(ua.replace(/Version\/(\d+).*Safari/, 'Safari/$1')) ?? /(Safari)\/(\d+)/.exec(ua);
  const names: Record<string, string> = { Edg: 'Edge', OPR: 'Opera', Version: 'Safari' };
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : /iPhone|iPad/.test(ua) ? 'iOS' : '';
  return match ? `${names[match[1]] ?? match[1]} ${match[2]}${os ? ` on ${os}` : ''}` : ua;
}

function webglSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

async function permission(name: 'camera' | 'microphone'): Promise<PermissionState | null> {
  try {
    return (await navigator.permissions.query({ name: name as PermissionName })).state;
  } catch {
    return null; // Not every browser can report this.
  }
}

function browserChecks(): CheckResult[] {
  const results: CheckResult[] = [{ id: 'browser', label: 'Browser', status: 'info', detail: describeBrowser() }];
  const secure = typeof isSecureContext === 'boolean' ? isSecureContext : location.protocol === 'https:';
  results.push(
    secure
      ? { id: 'secure', label: 'Secure connection', status: 'pass', detail: 'The page is on a secure (https) connection.' }
      : { id: 'secure', label: 'Secure connection', status: 'fail', detail: 'The page isn’t on a secure connection, so the camera is unavailable.', fix: 'Open ViBe from its https:// address.' },
  );
  results.push(
    wasmSupported()
      ? simdSupported()
        ? { id: 'wasm', label: 'WebAssembly', status: 'pass', detail: 'Supported, with SIMD.' }
        : { id: 'wasm', label: 'WebAssembly', status: 'warn', detail: 'Supported, but without SIMD, so checks run more slowly.', fix: UPDATE_BROWSER }
      : { id: 'wasm', label: 'WebAssembly', status: 'fail', detail: 'Not supported: voice and hand-gesture checks can’t run.', fix: UPDATE_BROWSER },
  );
  results.push(
    webglSupported()
      ? { id: 'webgl', label: 'WebGL graphics', status: 'pass', detail: 'Available.' }
      : {
          id: 'webgl',
          label: 'WebGL graphics',
          status: 'fail',
          detail: 'Not available: hand gestures can’t run and face detection is much slower.',
          fix: 'Turn on hardware acceleration in your browser settings, update your graphics drivers, or use an up-to-date Chrome, Edge or Firefox.',
        },
  );
  const workers = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
  results.push(
    workers
      ? { id: 'workers', label: 'Background workers', status: 'pass', detail: 'Available.' }
      : { id: 'workers', label: 'Background workers', status: 'fail', detail: 'Not available: face and hand checks can’t run.', fix: UPDATE_BROWSER },
  );
  const audio = typeof AudioContext !== 'undefined';
  results.push(
    audio
      ? { id: 'audio', label: 'Audio processing', status: 'pass', detail: 'Available.' }
      : { id: 'audio', label: 'Audio processing', status: 'fail', detail: 'Not available: the voice check can’t run.', fix: UPDATE_BROWSER },
  );
  return results;
}

async function deviceChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const devices = await navigator.mediaDevices?.enumerateDevices?.().catch(() => null);
  for (const [name, kind, label] of [
    ['camera', 'videoinput', 'Camera'],
    ['microphone', 'audioinput', 'Microphone'],
  ] as const) {
    const state = await permission(name);
    const count = devices ? devices.filter((d) => d.kind === kind).length : null;
    const found = count === null ? '' : count === 0 ? ` No ${name} found.` : ` ${count} ${name}${count === 1 ? '' : 's'} found.`;
    if (count === 0)
      results.push({ id: name, label, status: 'fail', detail: `No ${name} found.`, fix: `Connect a ${name}, or turn it on in your computer’s settings.` });
    else if (state === 'denied')
      results.push({
        id: name,
        label,
        status: 'fail',
        detail: `Access is blocked for this site.${found}`,
        fix: 'Click the lock or camera icon next to the address bar, allow it for this site, then reload.',
      });
    else if (state === 'granted') results.push({ id: name, label, status: 'pass', detail: `Allowed.${found}` });
    else
      results.push({
        id: name,
        label,
        status: 'info',
        detail: `${state === 'prompt' ? 'Not allowed yet: your browser will ask when a lesson needs it.' : 'This browser can’t report whether it’s allowed.'}${found}`,
      });
  }
  return results;
}

async function storageCheck(): Promise<CheckResult> {
  try {
    const { quota = 0, usage = 0 } = await navigator.storage.estimate();
    const free = quota - usage;
    return free < LOW_SPACE_BYTES
      ? {
          id: 'storage',
          label: 'Storage space',
          status: 'warn',
          detail: `About ${formatMb(free)} MB free for this site; the models need about 40 MB.`,
          fix: 'Free up disk space, or clear other sites’ data in your browser settings.',
        }
      : { id: 'storage', label: 'Storage space', status: 'pass', detail: `About ${formatMb(free)} MB free for this site.` };
  } catch {
    return { id: 'storage', label: 'Storage space', status: 'info', detail: 'This browser can’t report free space.' };
  }
}

function assetsByCheck(): Record<ModelCheck, ModelAsset[]> {
  const simd = simdSupported();
  return {
    faceCount: faceCountAssets(),
    faceRecognition: faceRecognitionAssets(),
    gesture: gestureAssets(simd),
    voice: voiceAssets(simd),
  };
}

async function savedModelsCheck(): Promise<CheckResult> {
  if (typeof caches === 'undefined')
    return {
      id: 'saved-models',
      label: 'Saved models',
      status: 'warn',
      detail: 'This browser won’t let ViBe save models, so they download every time.',
      fix: 'Leave private or incognito browsing, or allow this site to store data.',
    };
  try {
    const cache = await caches.open(MODEL_CACHE);
    const saved = new Set((await cache.keys()).map((request) => request.url));
    const complete = Object.entries(assetsByCheck())
      .filter(([, assets]) => assets.every((a) => saved.has(new URL(a.url).href)))
      .map(([check]) => MODEL_CHECK_LABELS[check as ModelCheck]);
    return {
      id: 'saved-models',
      label: 'Saved models',
      status: 'info',
      detail: complete.length ? `Saved on this device: ${complete.join(', ')}.` : 'None saved yet. They download the first time a lesson needs them.',
    };
  } catch {
    return {
      id: 'saved-models',
      label: 'Saved models',
      status: 'warn',
      detail: 'Saved models couldn’t be read.',
      fix: 'Use “Download models again” below.',
    };
  }
}

async function appFilesCheck(): Promise<CheckResult> {
  const registration = await navigator.serviceWorker?.getRegistration?.().catch(() => undefined);
  const keys = typeof caches === 'undefined' ? [] : await caches.keys().catch(() => [] as string[]);
  const appCaches = keys.filter((k) => k.startsWith(APP_CACHE_PREFIX) && k !== MODEL_CACHE).length;
  return {
    id: 'app-files',
    label: 'Offline app files',
    status: 'info',
    detail: registration
      ? `Installed (${appCaches} saved file group${appCaches === 1 ? '' : 's'}). If the app behaves oddly after an update, use “Clear app files and reload”.`
      : 'Not installed in this browser.',
  };
}

async function hostCheck({ host, probe, probeBytes }: { host: string; probe: string; probeBytes?: number }): Promise<CheckResult> {
  const label = `Model server: ${host}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HOST_TIMEOUT_MS);
  const started = performance.now();
  try {
    const response = await fetch(probe, { cache: 'no-store', signal: controller.signal });
    const latency = Math.round(performance.now() - started);
    if (!response.ok)
      return { id: `host-${host}`, label, status: 'fail', detail: `Reachable, but it answered with an error (${response.status}).`, fix: 'Try again later; if it persists, tell support.' };
    // Read a little to measure speed, without downloading a whole model.
    let received = 0;
    const reader = response.body?.getReader();
    if (reader) {
      while (received < (probeBytes ?? Infinity)) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
      }
      await reader.cancel().catch(() => undefined);
    }
    const seconds = (performance.now() - started) / 1000;
    const speed = received > 32 * 1024 && seconds > 0 ? `, about ${formatMb(received / seconds)} MB/s` : '';
    return latency > SLOW_MS
      ? {
          id: `host-${host}`,
          label,
          status: 'warn',
          detail: `Reachable but slow (${latency} ms${speed}).`,
          fix: 'Downloads will take a while. A faster network helps; once saved, models don’t download again.',
        }
      : { id: `host-${host}`, label, status: 'pass', detail: `Reachable (${latency} ms${speed}).` };
  } catch {
    return {
      id: `host-${host}`,
      label,
      status: 'fail',
      detail: controller.signal.aborted ? `No answer within ${HOST_TIMEOUT_MS / 1000} seconds.` : 'Couldn’t be reached.',
      fix: 'Try another network (a college or office network may block it), or turn off an ad blocker or VPN for this site.',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Every device check, yielded as each finishes so the page can fill in as it
 * goes. Reads only browser state and the model hosts; sends nothing to ViBe
 * and never opens the camera or microphone.
 */
export async function* runDiagnostics(): AsyncGenerator<CheckResult> {
  for (const result of browserChecks()) yield result;
  for (const result of await deviceChecks()) yield result;
  yield await storageCheck();
  yield await savedModelsCheck();
  yield await appFilesCheck();
  const pending = new Map(MODEL_HOSTS.map((h) => [h.host, hostCheck(h).then((r) => [h.host, r] as const)]));
  while (pending.size) {
    const [host, result] = await Promise.race(pending.values());
    pending.delete(host);
    yield result;
  }
}

const MARK: Record<CheckStatus, string> = { pass: 'PASS', warn: 'WARN', fail: 'FAIL', info: 'INFO' };

/** The plain-text report students copy for support. */
export function formatReport(results: CheckResult[], at: Date = new Date()): string {
  const lines = [`ViBe device check, ${at.toISOString()}`, `Browser: ${describeBrowser()}`, `User agent: ${navigator.userAgent}`, ''];
  for (const r of results) {
    lines.push(`[${MARK[r.status]}] ${r.label}: ${r.detail}`);
    if (r.fix) lines.push(`       Fix: ${r.fix}`);
  }
  return lines.join('\n');
}
