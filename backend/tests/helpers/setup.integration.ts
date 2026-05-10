import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearTestDb } from './testDb.js';

beforeAll(async () => {
  await setupTestDb();
}, 60000);

afterAll(async () => {
  await teardownTestDb();
}, 60000);

beforeEach(async () => {
  vi.clearAllMocks();
  await clearTestDb();
});
