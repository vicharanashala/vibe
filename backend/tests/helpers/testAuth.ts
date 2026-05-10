import { ObjectId } from 'mongodb';

export interface TestAuthUser {
  _id: ObjectId | string;
  firebaseUID: string;
  email: string;
  roles: string[];
}

const TEST_TOKEN_PREFIX = 'test-token-';

export function makeTestToken(user: Partial<TestAuthUser> = {}): string {
  const payload = {
    uid: user.firebaseUID ?? `uid-${Date.now()}`,
    email: user.email ?? 'test@vibe.local',
    roles: user.roles ?? ['student'],
    _id: user._id?.toString() ?? new ObjectId().toString(),
  };
  return TEST_TOKEN_PREFIX + Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeTestToken(token: string): TestAuthUser & { uid: string } {
  if (!token.startsWith(TEST_TOKEN_PREFIX)) throw new Error('Invalid test token');
  const raw = token.slice(TEST_TOKEN_PREFIX.length);
  return JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8'));
}

export function authHeaders(user: Partial<TestAuthUser> = {}): Record<string, string> {
  return { Authorization: `Bearer ${makeTestToken(user)}` };
}

export function studentAuth(): Record<string, string> {
  return authHeaders({ roles: ['student'] });
}

export function teacherAuth(): Record<string, string> {
  return authHeaders({ roles: ['teacher'] });
}

export function adminAuth(): Record<string, string> {
  return authHeaders({ roles: ['admin'] });
}
