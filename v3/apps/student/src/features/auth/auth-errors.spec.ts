import { describeAuthError } from './auth-errors';

describe('describeAuthError', () => {
  it('never shows raw Firebase config errors to students', () => {
    for (const code of ['auth/auth-domain-config-required', 'auth/operation-not-allowed', 'auth/unauthorized-domain']) {
      const message = describeAuthError(Object.assign(new Error(`Firebase: Error (${code}).`), { code }));
      expect(message).not.toMatch(/firebase/i);
      expect(message).toMatch(/email and password/);
    }
  });
});
