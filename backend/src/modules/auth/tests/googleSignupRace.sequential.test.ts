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

// The fix's recovery logic (catch on create() failure -> poll findByEmail ->
// findById on the returned userId) only runs when there's an actual
// conflict. This confirms it stays completely out of the way for the
// overwhelming majority case: no race at all, just an ordinary brand-new
// signup followed by an ordinary repeat login.
describe('Google SSO signup/login without any race', () => {
  let authService: FirebaseAuthService;
  let db: MongoDatabase;

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

  it('a brand-new user signs up once, then logs in again later, with no duplicate ever created', async () => {
    const uid = 'sequential-uid-' + Date.now();
    const email = `sequential-${Date.now()}@example.com`;

    (authService as any).auth = {
      verifyIdToken: async () => ({ uid, email }),
      getUser: async () => ({
        uid,
        email,
        displayName: 'Sequential Test User',
      }),
    };

    const first = await authService.getCurrentUserFromToken('fake-token');
    expect(first).toBeTruthy();
    expect(first.email).toBe(email);
    expect(first.firebaseUID).toBe(uid);

    const usersCollection = await (db as any).getCollection('users');
    const afterFirst = await usersCollection.find({ email }).toArray();
    expect(afterFirst.length).toBe(1);

    // Simulate the user returning later (new page load, new token) -- this
    // must resolve to the SAME document, not attempt to create another.
    const second = await authService.getCurrentUserFromToken('fake-token');
    expect(second._id.toString()).toBe(first._id.toString());

    const afterSecond = await usersCollection.find({ email }).toArray();
    expect(afterSecond.length).toBe(1);
  });
});
