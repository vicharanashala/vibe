import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './server.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
