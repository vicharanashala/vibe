import {describe, it, expect, vi, beforeEach} from 'vitest';
import {UserService} from '#users/services/UserService.js';

const ADMIN = {_id: 'a1', roles: 'admin', email: 'admin@x.org'} as any;
const STUDENT = {
  _id: '6afcaaaaaaaaaaaaaaaaaaaa',
  firebaseUID: 'uid-student',
  email: 'old@x.org',
} as any;

function setup(overrides: {
  byEmail?: any;
  firebaseUid?: string | null;
  editError?: any;
} = {}) {
  const userRepo = {
    findById: vi.fn(async (id: string) => (id === STUDENT._id ? STUDENT : null)),
    findByEmail: vi.fn(async () => overrides.byEmail ?? null),
    edit: vi.fn(async () => {
      if (overrides.editError) throw overrides.editError;
    }),
  };
  const auth = {
    findFirebaseUidByEmail: vi.fn(async () => overrides.firebaseUid ?? null),
    setFirebaseEmail: vi.fn(async () => ({
      previousEmail: 'old@x.org',
      signInMethods: ['password'],
    })),
  };
  const service = new UserService(userRepo as any, {} as any, auth as any);
  return {service, userRepo, auth};
}

describe('UserService.changeEmail', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('changes the email on Firebase and the user record, normalised', async () => {
    const {service, userRepo, auth} = setup();
    const res = await service.changeEmail(STUDENT._id, '  New@X.org ', ADMIN);
    expect(auth.setFirebaseEmail).toHaveBeenCalledWith('uid-student', 'new@x.org');
    expect(userRepo.edit).toHaveBeenCalledWith(STUDENT._id, {email: 'new@x.org'});
    expect(res).toEqual({
      email: 'new@x.org',
      previousEmail: 'old@x.org',
      signInMethods: ['password'],
    });
  });

  it('refuses a non-admin, even though the decorator does not check roles', async () => {
    const {service, auth} = setup();
    await expect(
      service.changeEmail(STUDENT._id, 'new@x.org', {roles: 'user'} as any),
    ).rejects.toMatchObject({httpCode: 403});
    expect(auth.setFirebaseEmail).not.toHaveBeenCalled();
  });

  it('404s for an unknown user', async () => {
    const {service} = setup();
    await expect(
      service.changeEmail('6afcbbbbbbbbbbbbbbbbbbbb', 'new@x.org', ADMIN),
    ).rejects.toMatchObject({httpCode: 404});
  });

  it('400s when the email is unchanged (case-insensitive)', async () => {
    const {service, auth} = setup();
    await expect(
      service.changeEmail(STUDENT._id, 'OLD@x.org', ADMIN),
    ).rejects.toMatchObject({httpCode: 400, message: "That's already their email"});
    expect(auth.setFirebaseEmail).not.toHaveBeenCalled();
  });

  it('409s when another user record has the email', async () => {
    const {service, auth} = setup({byEmail: {_id: 'someone-else'}});
    await expect(
      service.changeEmail(STUDENT._id, 'taken@x.org', ADMIN),
    ).rejects.toMatchObject({
      httpCode: 409,
      message: 'This email is already used by another account',
    });
    expect(auth.setFirebaseEmail).not.toHaveBeenCalled();
  });

  it('409s when another Firebase account has the email', async () => {
    const {service, auth} = setup({firebaseUid: 'uid-other'});
    await expect(
      service.changeEmail(STUDENT._id, 'taken@x.org', ADMIN),
    ).rejects.toMatchObject({httpCode: 409});
    expect(auth.setFirebaseEmail).not.toHaveBeenCalled();
  });

  it('puts the old Firebase email back if saving the user record fails', async () => {
    const {service, auth} = setup({editError: new Error('db down')});
    await expect(
      service.changeEmail(STUDENT._id, 'new@x.org', ADMIN),
    ).rejects.toThrow('db down');
    expect(auth.setFirebaseEmail).toHaveBeenNthCalledWith(1, 'uid-student', 'new@x.org');
    expect(auth.setFirebaseEmail).toHaveBeenNthCalledWith(2, 'uid-student', 'old@x.org');
  });

  it('maps a duplicate-key race on the user record to 409, after reverting Firebase', async () => {
    const {service, auth} = setup({editError: Object.assign(new Error('dup'), {code: 11000})});
    await expect(
      service.changeEmail(STUDENT._id, 'new@x.org', ADMIN),
    ).rejects.toMatchObject({httpCode: 409});
    expect(auth.setFirebaseEmail).toHaveBeenCalledTimes(2);
  });
});
