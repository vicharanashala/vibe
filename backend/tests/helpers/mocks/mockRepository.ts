import { vi, type Mock } from 'vitest';

export type MockedRepository<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R ? Mock<(...args: A) => R> : T[K];
};

export function createMockRepo<T extends object>(): MockedRepository<T> {
  const cache = new Map<string | symbol, Mock>();
  return new Proxy({} as MockedRepository<T>, {
    get(_target, prop) {
      if (!cache.has(prop)) cache.set(prop, vi.fn());
      return cache.get(prop);
    },
    has() { return true; },
  });
}

export function resetMockRepo<T extends object>(repo: MockedRepository<T>): void {
  for (const key of Object.keys(repo)) {
    const fn = (repo as Record<string, unknown>)[key];
    if (typeof fn === 'function' && 'mockReset' in fn) (fn as Mock).mockReset();
  }
}
