import { vi } from 'vitest';

export const firebaseAuthMock = {
  verifyIdToken: vi.fn(async (token: string) => ({
    uid: `uid-${token}`,
    email: `${token}@test.local`,
    email_verified: true,
  })),
  getUser: vi.fn(async (uid: string) => ({ uid, email: `${uid}@test.local`, displayName: 'Test User' })),
  createUser: vi.fn(async (props: { email: string }) => ({ uid: `uid-${props.email}`, ...props })),
  deleteUser: vi.fn(async () => undefined),
  setCustomUserClaims: vi.fn(async () => undefined),
  generatePasswordResetLink: vi.fn(async () => 'https://reset.test/link'),
};

export const firebaseAdminMock = {
  auth: vi.fn(() => firebaseAuthMock),
  apps: [],
  initializeApp: vi.fn(),
  credential: { cert: vi.fn(), applicationDefault: vi.fn() },
};

export function mockFirebaseAdmin() {
  vi.mock('firebase-admin', () => ({ default: firebaseAdminMock, ...firebaseAdminMock }));
}

export function resetFirebaseMocks() {
  Object.values(firebaseAuthMock).forEach(fn => 'mockReset' in fn && fn.mockReset());
}
