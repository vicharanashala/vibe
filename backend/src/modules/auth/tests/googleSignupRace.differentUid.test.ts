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

describe('Google SSO lazy-provisioning race (same email, different firebaseUID)', () => {
  let authService: FirebaseAuthService;
  let db: MongoDatabase;

  const fixedEmail = `same-email-race-${Date.now()}@example.com`;

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
  });

  it('reports how many requests succeed/fail and how many documents get created', async () => {
    const CONCURRENCY = 10;
    let callIndex = 0;

    (authService as any).auth = {
      verifyIdToken: async () => {
        const uid = `same-email-race-uid-${callIndex++}-${Date.now()}`;
        return { uid, email: fixedEmail };
      },
      getUser: async (uid: string) => ({
        uid,
        email: fixedEmail,
        displayName: 'Same Email Race Test User',
      }),
    };

    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENCY }, () =>
        authService.getCurrentUserFromToken('fake-token'),
      ),
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const failureMessages = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason?.message);

    const usersCollection = await (db as any).getCollection('users');
    const matchingUsers = await usersCollection
      .find({ email: fixedEmail })
      .toArray();

    console.log(
      `[same-email repro] concurrency=${CONCURRENCY} succeeded=${succeeded} failed=${failed} ` +
        `documents created for email=${fixedEmail}: ${matchingUsers.length}`,
    );
    if (failureMessages.length) {
      console.log('[same-email repro] failure messages:', failureMessages);
    }
    if (matchingUsers.length > 1) {
      console.log(
        '[same-email repro] duplicate _ids / firebaseUIDs:',
        matchingUsers.map((u: any) => `${u._id.toString()}:${u.firebaseUID}`),
      );
    }

    expect(matchingUsers.length).toBe(1);
    expect(succeeded).toBe(CONCURRENCY);
    expect(failed).toBe(0);
  });
});
