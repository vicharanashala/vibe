/**
 * Regression test for the shared `Ability` parameter decorator.
 *
 * The Milestone C discussionBoard controller relies on `authenticatedUser`
 * being present and on every enrollment row carrying a canonical
 * `cohortIds` array (or `null` for unrestricted-cohort roles). If the
 * decorator regresses — e.g. someone deletes the normaliser, drops the
 * `authenticatedUser` return, or forgets to map `assignedCohortIds` /
 * `cohortId` into the canonical shape — this test must fail loudly so
 * the discussionBoard (and any future controller that consumes
 * `AuthenticatedUserEnrollements.cohortIds`) doesn't silently lose all
 * cohort-scope grants.
 *
 * Strategy: spin up a tiny test-only `routing-controllers` JSON
 * controller that uses `Ability(getDiscussionAbility)` and echoes the
 * envelope it received. Hitting that controller with `supertest`
 * exercises the full decorator chain (token decode → auth → enrollment
 * fetch → cohortId normalisation → ability build) end-to-end, so any
 * silent regression in `AbilityDecorator.ts` will be caught here.
 */

import {ObjectId} from 'mongodb';
import {JsonController, Get, Authorized} from 'routing-controllers';
import {Container} from 'inversify';
import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import Express from 'express';
import request from 'supertest';
import {useContainer, useExpressServer} from 'routing-controllers';

import {InversifyAdapter} from '#root/inversify-adapter.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {sharedContainerModule} from '#root/container.js';
import {authContainerModule} from '#root/modules/auth/container.js';
import {usersContainerModule} from '#root/modules/users/container.js';
import {notificationsContainerModule} from '#root/modules/notifications/container.js';
import {coursesContainerModule} from '#root/modules/courses/container.js';
import {studentQuestionsContainerModule} from '#root/modules/studentQuestions/container.js';
import {anomaliesContainerModule} from '#root/modules/anomalies/container.js';
import {quizzesContainerModule} from '#root/modules/quizzes/container.js';
import {settingContainerModule} from '#root/modules/setting/container.js';
import {courseRegistrationContainerModule} from '#root/modules/courseRegistration/container.js';
import {projectsContainerModule} from '#root/modules/projects/container.js';
import {reportsContainerModule} from '#root/modules/reports/container.js';
import {hpSystemContainerModule} from '#root/modules/hpSystem/container.js';
import {ejectionPolicyContainerModule} from '#root/modules/ejectionPolicy/container.js';
import {emotionsContainerModule} from '#root/modules/emotions/container.js';
import {genAIContainerModule} from '#root/modules/genAI/container.js';
import {announcementsContainerModule} from '#root/modules/announcements/container.js';
import {auditTrailsContainerModule} from '#root/modules/auditTrails/container.js';

import {Ability} from './AbilityDecorator.js';
import {FirebaseAuthService} from '#root/modules/auth/services/FirebaseAuthService.js';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';
import {
  getDiscussionAbility,
  DiscussionActions,
  DiscussionSubject,
} from '#root/modules/discussionBoard/abilities/discussionAbilities.js';

/**
 * Test-only controller that echoes the decorator's envelope to the
 * client. Lets us probe different actions on the same ability
 * (View vs Pin) without needing a separate controller per role.
 */
@JsonController('/__test__/ability')
class AbilityEchoController {
  @Authorized()
  @Get('/echo')
  echo(@Ability(getDiscussionAbility) env: any) {
    // Deep-clone + stringify all cohortIds so ObjectIds arrive as hex
    // strings in the response (avoids the {buffer:...} JSON form).
    const aug = JSON.parse(
      JSON.stringify(env.authenticatedUser, (_k, v) => {
        if (v && typeof v === 'object' && v._bsontype === 'ObjectID') {
          return String(v);
        }
        return v;
      }),
    );
    // Final sweep: any nested cohortIds still as objects get stringified.
    if (aug && Array.isArray(aug.enrollments)) {
      for (const e of aug.enrollments) {
        if (Array.isArray(e.cohortIds)) {
          e.cohortIds = e.cohortIds.map((x: any) => String(x));
        }
      }
    }
    return {
      authenticatedUser: aug,
      canPin: env.ability.can(DiscussionActions.Pin, DiscussionSubject),
      canView: env.ability.can(DiscussionActions.View, DiscussionSubject),
    };
  }
}

describe('Ability decorator — Milestone D regression guard', {timeout: 30000}, () => {
  const appInstance = Express();
  let app: any;

  // In-memory token → user / enrollments registries, populated by
  // `configure`. The `currentUserChecker` below reads from these.
  const userStore: Record<string, any> = {};
  const enrollmentStore: Record<string, any[]> = {};

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const container = new Container();
    container.load(
      sharedContainerModule,
      authContainerModule,
      usersContainerModule,
      notificationsContainerModule,
      coursesContainerModule,
      studentQuestionsContainerModule,
      anomaliesContainerModule,
      settingContainerModule,
      courseRegistrationContainerModule,
      projectsContainerModule,
      reportsContainerModule,
      hpSystemContainerModule,
      ejectionPolicyContainerModule,
      emotionsContainerModule,
      genAIContainerModule,
      announcementsContainerModule,
      auditTrailsContainerModule,
      quizzesContainerModule,
    );
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);

    // Bind the test controller so useExpressServer can resolve it.
    container.bind(AbilityEchoController).toSelf().inSingletonScope();

    const db = container.get<any>(GLOBAL_TYPES.Database);
    await db.connect();

    app = useExpressServer(appInstance, {
      controllers: [AbilityEchoController],
      authorizationChecker: async action => {
        const auth = action.request.headers.authorization;
        if (!auth) return false;
        const token = auth.includes(' ') ? auth.split(' ')[1] : auth;
        return !!token && token !== 'no-token';
      },
      currentUserChecker: async action => {
        const auth = action.request.headers.authorization;
        if (!auth) return null;
        const token = auth.includes(' ') ? auth.split(' ')[1] : auth;
        return userStore[token] ?? null;
      },
      defaultErrorHandler: true,
      validation: false,
    });
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    for (const k of Object.keys(userStore)) delete userStore[k];
    for (const k of Object.keys(enrollmentStore)) delete enrollmentStore[k];
  });

  function configure(
    user: { _id: ObjectId; firebaseUID: string; email: string; roles: unknown },
    enrollments: any[],
  ): { token: string } {
    const token = `token-${user._id.toString()}`;
    userStore[token] = user;
    enrollmentStore[user._id.toString()] = enrollments;

    vi.spyOn(
      FirebaseAuthService.prototype,
      'getCurrentUserFromToken',
    ).mockImplementation(async (t: string) => {
      if (t !== token) throw new Error('unexpected token');
      return user as any;
    });
    vi.spyOn(
      EnrollmentService.prototype,
      'getAllEnrollments',
    ).mockImplementation(async (uid: string) => {
      return enrollmentStore[uid] ?? [];
    });
    return { token };
  }

  async function getEcho(token: string | null) {
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    return request(app).get('/__test__/ability/echo').set(headers);
  }

  it('populates authenticatedUser.userId from the auth user doc', async () => {
    const user = {
      _id: new ObjectId(),
      firebaseUID: 'fb',
      email: 'u@test',
      roles: 'user',
    };
    const { token } = configure(user, []);
    const res = await getEcho(token);
    expect(res.status).toBe(200);
    expect(res.body.authenticatedUser).toBeDefined();
    expect(res.body.authenticatedUser.userId).toBe(user._id.toString());
  });

  it('normalises a STUDENT cohortId into the canonical cohortIds array', async () => {
    const user = {
      _id: new ObjectId(),
      firebaseUID: 'fb',
      email: 'u@test',
      roles: 'user',
    };
    const courseId = new ObjectId();
    const cohortId = new ObjectId();
    const { token } = configure(user, [
      {
        _id: new ObjectId(),
        userId: user._id,
        courseId,
        courseVersionId: new ObjectId(),
        role: 'STUDENT',
        status: 'ACTIVE',
        cohortId,
      },
    ]);
    const res = await getEcho(token);
    expect(res.status).toBe(200);
    const e = res.body.authenticatedUser.enrollments[0];
    expect(e.role).toBe('STUDENT');
    expect(e.courseId).toBe(courseId.toString());
    expect(Array.isArray(e.cohortIds)).toBe(true);
    expect(e.cohortIds).toHaveLength(1);
    // ObjectId serialises through JSON as an object — verify its hex
    // string representation rather than object identity.
    const cidStr = String(e.cohortIds[0]);
    expect(cidStr).toBe(cohortId.toString());
    expect(cidStr).toMatch(/^[0-9a-f]{24}$/);
  });

  it('normalises an INSTRUCTOR assignedCohortIds array (and grants Pin)', async () => {
    const user = {
      _id: new ObjectId(),
      firebaseUID: 'fb',
      email: 'u@test',
      roles: 'user',
    };
    const courseId = new ObjectId();
    const a = new ObjectId();
    const b = new ObjectId();
    const { token } = configure(user, [
      {
        _id: new ObjectId(),
        userId: user._id,
        courseId,
        courseVersionId: new ObjectId(),
        role: 'INSTRUCTOR',
        status: 'ACTIVE',
        assignedCohortIds: [a, b],
      },
    ]);
    const res = await getEcho(token);
    expect(res.status).toBe(200);
    const e = res.body.authenticatedUser.enrollments[0];
    expect(e.role).toBe('INSTRUCTOR');
    expect(Array.isArray(e.cohortIds)).toBe(true);
    expect(e.cohortIds).toHaveLength(2);
    const asStrs = e.cohortIds.map((x: any) => String(x)).sort();
    expect(asStrs).toEqual([a.toString(), b.toString()].sort());
    expect(res.body.canPin).toBe(true);
    expect(res.body.canView).toBe(true);
  });

  it('normalises a STAFF assignedCohortIds array', async () => {
    const user = {
      _id: new ObjectId(),
      firebaseUID: 'fb',
      email: 'u@test',
      roles: 'user',
    };
    const courseId = new ObjectId();
    const a = new ObjectId();
    const { token } = configure(user, [
      {
        _id: new ObjectId(),
        userId: user._id,
        courseId,
        courseVersionId: new ObjectId(),
        role: 'STAFF',
        status: 'ACTIVE',
        assignedCohortIds: [a],
      },
    ]);
    const res = await getEcho(token);
    expect(res.status).toBe(200);
    const e = res.body.authenticatedUser.enrollments[0];
    expect(e.role).toBe('STAFF');
    expect(String(e.cohortIds[0])).toBe(a.toString());
    expect(res.body.canPin).toBe(true);
  });

  it('returns cohortIds=null for MANAGER (unrestricted on course)', async () => {
    const user = {
      _id: new ObjectId(),
      firebaseUID: 'fb',
      email: 'u@test',
      roles: 'user',
    };
    const courseId = new ObjectId();
    const { token } = configure(user, [
      {
        _id: new ObjectId(),
        userId: user._id,
        courseId,
        courseVersionId: new ObjectId(),
        role: 'MANAGER',
        status: 'ACTIVE',
      },
    ]);
    const res = await getEcho(token);
    expect(res.status).toBe(200);
    const e = res.body.authenticatedUser.enrollments[0];
    expect(e.role).toBe('MANAGER');
    expect(e.cohortIds).toBeNull();
  });

  it('returns cohortIds=null for TA (unrestricted on course)', async () => {
    const user = {
      _id: new ObjectId(),
      firebaseUID: 'fb',
      email: 'u@test',
      roles: 'user',
    };
    const courseId = new ObjectId();
    const { token } = configure(user, [
      {
        _id: new ObjectId(),
        userId: user._id,
        courseId,
        courseVersionId: new ObjectId(),
        role: 'TA',
        status: 'ACTIVE',
      },
    ]);
    const res = await getEcho(token);
    expect(res.status).toBe(200);
    const e = res.body.authenticatedUser.enrollments[0];
    expect(e.role).toBe('TA');
    expect(e.cohortIds).toBeNull();
  });

  it('returns cohortIds=[] for a STUDENT with no cohortId (deny by default)', async () => {
    const user = {
      _id: new ObjectId(),
      firebaseUID: 'fb',
      email: 'u@test',
      roles: 'user',
    };
    const courseId = new ObjectId();
    const { token } = configure(user, [
      {
        _id: new ObjectId(),
        userId: user._id,
        courseId,
        courseVersionId: new ObjectId(),
        role: 'STUDENT',
        status: 'ACTIVE',
      },
    ]);
    const res = await getEcho(token);
    expect(res.status).toBe(200);
    expect(res.body.authenticatedUser.enrollments[0].cohortIds).toEqual([]);
  });

  it('drops enrollment rows whose role is not one of the canonical five', async () => {
    const user = {
      _id: new ObjectId(),
      firebaseUID: 'fb',
      email: 'u@test',
      roles: 'user',
    };
    const courseId = new ObjectId();
    const { token } = configure(user, [
      {
        _id: new ObjectId(),
        userId: user._id,
        courseId,
        courseVersionId: new ObjectId(),
        role: 'OBSERVER',
        status: 'ACTIVE',
      },
      {
        _id: new ObjectId(),
        userId: user._id,
        courseId,
        courseVersionId: new ObjectId(),
        role: 'STUDENT',
        status: 'ACTIVE',
        cohortId: new ObjectId(),
      },
    ]);
    const res = await getEcho(token);
    expect(res.status).toBe(200);
    expect(res.body.authenticatedUser.enrollments).toHaveLength(1);
    expect(res.body.authenticatedUser.enrollments[0].role).toBe('STUDENT');
  });

  it('normalises lowercase / mixed-case enrollment roles to uppercase', async () => {
    const user = {
      _id: new ObjectId(),
      firebaseUID: 'fb',
      email: 'u@test',
      roles: 'user',
    };
    const courseId = new ObjectId();
    const cohortId = new ObjectId();
    const { token } = configure(user, [
      {
        _id: new ObjectId(),
        userId: user._id,
        courseId,
        courseVersionId: new ObjectId(),
        role: 'student',
        status: 'ACTIVE',
        cohortId,
      },
    ]);
    const res = await getEcho(token);
    expect(res.status).toBe(200);
    expect(res.body.authenticatedUser.enrollments[0].role).toBe('STUDENT');
  });

  it('treats globalRole=admin when roles is an array containing "admin"', async () => {
    const user = {
      _id: new ObjectId(),
      firebaseUID: 'fb',
      email: 'u@test',
      roles: ['admin', 'user'],
    };
    const { token } = configure(user, []);
    const res = await getEcho(token);
    expect(res.status).toBe(200);
    expect(res.body.authenticatedUser.globalRole).toBe('admin');
    expect(res.body.canPin).toBe(true);
  });

  it('treats globalRole=user when roles is a plain "user" string', async () => {
    const user = {
      _id: new ObjectId(),
      firebaseUID: 'fb',
      email: 'u@test',
      roles: 'user',
    };
    const { token } = configure(user, []);
    const res = await getEcho(token);
    expect(res.status).toBe(200);
    expect(res.body.authenticatedUser.globalRole).toBe('user');
  });

  it('rejects a request with no authorization header (401)', async () => {
    const res = await getEcho(null);
    expect(res.status).toBe(401);
  });

  it('a STUDENT gets View but NOT Pin (per role-based grant matrix)', async () => {
    const user = {
      _id: new ObjectId(),
      firebaseUID: 'fb',
      email: 'u@test',
      roles: 'user',
    };
    const courseId = new ObjectId();
    const { token } = configure(user, [
      {
        _id: new ObjectId(),
        userId: user._id,
        courseId,
        courseVersionId: new ObjectId(),
        role: 'STUDENT',
        status: 'ACTIVE',
        cohortId: new ObjectId(),
      },
    ]);
    const res = await getEcho(token);
    expect(res.status).toBe(200);
    expect(res.body.canView).toBe(true);
    expect(res.body.canPin).toBe(false);
  });
});
