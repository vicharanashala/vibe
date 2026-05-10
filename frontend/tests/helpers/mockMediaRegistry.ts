import { vi } from 'vitest';

export const mediaRegistryMock = {
  register: vi.fn(),
  unregister: vi.fn(),
  pauseAll: vi.fn(),
  pauseAllExcept: vi.fn(),
  getActive: vi.fn(() => null),
};

export function mockMediaRegistry() {
  vi.mock('@/lib/MediaRegistry', () => ({
    MediaRegistry: mediaRegistryMock,
    default: mediaRegistryMock,
  }));
}
