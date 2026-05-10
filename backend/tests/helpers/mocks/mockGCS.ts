import { vi } from 'vitest';

export const gcsFileMock = {
  save: vi.fn(async () => undefined),
  download: vi.fn(async () => [Buffer.from('mock')]),
  delete: vi.fn(async () => undefined),
  exists: vi.fn(async () => [true]),
  getSignedUrl: vi.fn(async () => ['https://storage.test/signed']),
};

export const gcsBucketMock = {
  file: vi.fn(() => gcsFileMock),
  upload: vi.fn(async () => [gcsFileMock]),
  getFiles: vi.fn(async () => [[]]),
};

export const gcsClientMock = {
  bucket: vi.fn(() => gcsBucketMock),
};

export function mockGCS() {
  vi.mock('@google-cloud/storage', () => ({
    Storage: vi.fn(() => gcsClientMock),
  }));
}

export function resetGCSMocks() {
  Object.values(gcsFileMock).forEach(fn => 'mockReset' in fn && fn.mockReset());
  Object.values(gcsBucketMock).forEach(fn => 'mockReset' in fn && fn.mockReset());
}
