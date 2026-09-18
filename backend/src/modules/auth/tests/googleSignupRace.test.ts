import { Container } from 'inversify';
import { describe, it, expect, beforeAll } from 'vitest';

import { sharedContainerModule } from '#root/container.js';
import { authContainerModule } from '#auth/container.js';
import { usersContainerModule } from '#users/container.js';
import { coursesContainerModule } from '#root/modules/courses/container.js';
import { quizzesContainerModule } from '#root/modules/quizzes/container.js';
import { notificationsContainerModule } from '#root/modules/notifications/container.js';
import { anomaliesContainerModule } from '#root/modules/anomalies/container.js';
import { projectsContainerModule } from '#root/modules/projects/container.js';
import { hpSystemContainerModule } from '#root/modules/hpSystem/container.js';
import { courseRegistrationContainerModule } from '#root/modules/courseRegistration/container.js';
import { reportsContainerModule } from '#root/modules/reports/container.js';
import { ejectionPolicyContainerModule } from '#root/modules/ejectionPolicy/container.js';
import { emotionsContainerModule } from '#root/modules/emotions/container.js';
import { genAIContainerModule } from '#root/modules/genAI/container.js';
import { studentQuestionsContainerModule } from '#root/modules/studentQuestions/container.js';
import { announcementsContainerModule } from '#root/modules/announcements/container.js';
import { auditTrailsContainerModule } from '#root/modules/auditTrails/container.js';
import { settingContainerModule } from '#root/modules/setting/container.js';

import { AUTH_TYPES } from '#auth/types.js';
import { FirebaseAuthService } from '#auth/services/FirebaseAuthService.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';

// Reproduces the suspected root cause of the "duplicate firebaseUID accounts"
// incident (SASTRA report D-05): a brand-new Google SSO user's first-ever
// authenticated request goes through FirebaseAuthService.getCurrentUserFromToken
// -> googleSignup, which checks "does a Mongo user exist for this
// firebaseUID/email?" and, if not, creates one -- a plain check-then-create
// with no unique index and no locking. A real SPA fires several authenticated
// requests in parallel on first load, each hitting this same lazy-provisioning
// path independently. This test fires that same race directly against the
// real service/repository code (mocking only the Firebase Admin SDK call),
// against a real MongoDB (mongodb-memory-server), and reports how many user
// documents actually got created for one firebaseUID.
describe('Google SSO lazy-provisioning race (duplicate account reproduction)', () => {
  let authService: FirebaseAuthService;
  let db: MongoDatabase;

  const fixedUid = 'race-test-uid-' + Date.now();
  const fixedEmail = `race-test-${Date.now()}@example.com`;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';

    const container = new Container();
    await container.load(
      sharedContainerModule,
      authContainerModule,
      usersContainerModule,
      coursesContainerModule,
      quizzesContainerModule,
      notificationsContainerModule,
      anomaliesContainerModule,
      projectsContainerModule,
      hpSystemContainerModule,
      courseRegistrationContainerModule,
      reportsContainerModule,
      ejectionPolicyContainerModule,
      emotionsContainerModule,
      genAIContainerModule,
      studentQuestionsContainerModule,
      announcementsContainerModule,
      auditTrailsContainerModule,
      settingContainerModule,
    );

    authService = container.get<FirebaseAuthService>(AUTH_TYPES.AuthService);
    db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    await db.connect();

    // Stub only the Firebase Admin SDK boundary -- verifyIdToken always
    // resolves to the SAME brand-new user, exactly like N concurrent browser
    // requests all carrying the same freshly-issued Google ID token.
    (authService as any).auth = {
      verifyIdToken: async () => ({ uid: fixedUid, email: fixedEmail }),
      getUser: async () => ({
        uid: fixedUid,
        email: fixedEmail,
        displayName: 'Race Test User',
      }),
    };
  });

  it('does not create more than one user document under concurrent first-login requests', async () => {
    const CONCURRENCY = 10;

    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENCY }, () =>
        authService.getCurrentUserFromToken('fake-token'),
      ),
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    const usersCollection = await (db as any).getCollection('users');
    const matchingUsers = await usersCollection
      .find({ firebaseUID: fixedUid })
      .toArray();

    console.log(
      `[race repro] concurrency=${CONCURRENCY} succeeded=${succeeded} failed=${failed} ` +
        `documents created for firebaseUID=${fixedUid}: ${matchingUsers.length}`,
    );
    if (matchingUsers.length > 1) {
      console.log(
        '[race repro] duplicate _ids:',
        matchingUsers.map((u: any) => u._id.toString()),
      );
    }

    expect(matchingUsers.length).toBe(1);
  });
});
