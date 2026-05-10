import { vi } from 'vitest';

export function mockComlinkWorkers() {
  vi.mock('comlink', () => ({
    wrap: vi.fn(() => ({})),
    expose: vi.fn(),
    proxy: vi.fn(v => v),
    transfer: vi.fn(v => v),
    releaseProxy: vi.fn(),
  }));

  if (typeof globalThis.Worker === 'undefined') {
    // @ts-expect-error - jsdom polyfill
    globalThis.Worker = class {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: ErrorEvent) => void) | null = null;
      postMessage = vi.fn();
      terminate = vi.fn();
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
    };
  }
}
