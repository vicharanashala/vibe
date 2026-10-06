/**
 * Milestone D — backend hardening tests for cohort isolation, edge
 * cases, and authorization boundaries across the entire discussion
 * board feature (threads, replies, pin, delete, edit).
 *
 * Test categories mirror the Milestone D spec:
 *
 *   #2   cross-cohort no-leak (5 endpoints, all 404)
 *   #3   student pin (already covered — re-confirmed below)
 *   #4   same-cohort, different-user delete (403, not 404)
 *   #5   teacher moderates wrong course (403/404 per convention)
 *   #6   unauthenticated → all 401
 *   #7   malformed IDs → 400
 *   #8   client-supplied cohortId ignored / extra fields stripped
 *   #9   cascade-delete edge: zero replies (still 204)
 *   #10  double-delete idempotent (second delete → 404)
 *
 * The Milestone A→C `DiscussionController.test.ts` already exercises
 * the happy paths; this file is purely adversarial. It is intentionally
 * a separate file so a regression here doesn't conflate with the
 * success-case test count.
 */

import request from 'supertest';
import Express from 'express';
import {ObjectId} from 'mongodb';
import {useContainer, useExpressServer} from 'routing-controllers';
import {Container} from 'inversify';
import {beforeAll, describe, expect, it, vi} from 'vitest';

import {InversifyAdapter} from '#root/inversify-adapter.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {sharedContainerModule} from '#root/container.js';
import {authContainerModule} from '#root/modules/auth/container.js';
import {usersContainerModule} from '#root/modules/users/container.js';
import {coursesContainerModule} from '#root/modules/courses/container.js';
import {notificationsContainerModule} from '#root/modules/notifications/container.js';
import {projectsContainerModule} from '#root/modules/projects/container.js';
import {courseRegistrationContainerModule} from '#root/modules/courseRegistration/container.js';
import {studentQuestionsContainerModule} from '#root/modules/studentQuestions/container.js';
import {announcementsContainerModule} from '#root/modules/announcements/container.js';
import {auditTrailsContainerModule} from '#root/modules/auditTrails/container.js';
import {settingContainerModule} from '#root/modules/setting/container.js';
import {quizzesContainerModule} from '#root/modules/quizzes/container.js';
import {anomaliesContainerModule} from '#root/modules/anomalies/container.js';
import {reportsContainerModule} from '#root/modules/reports/container.js';
import {hpSystemContainerModule} from '#root/modules/hpSystem/container.js';
import {ejectionPolicyContainerModule} from '#root/modules/ejectionPolicy/container.js';
import {emotionsContainerModule} from '#root/modules/emotions/container.js';
import {genAIContainerModule} from '#root/modules/genAI/container.js';
import {discussionBoardContainerModule} from '../container.js';

import {FirebaseAuthService} from '#root/modules/auth/services/FirebaseAuthService.js';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {ICourseRepository} from '#root/shared/database/interfaces/ICourseRepository.js';
import {DiscussionController} from '../controllers/DiscussionController.js';
import {CourseController} from '#root/modules/courses/controllers/CourseController.js';
import {CourseVersionController} from '#root/modules/courses/controllers/CourseVersionController.js';
import {UserController} from '#root/modules/users/controllers/UserController.js';
import {AuthController} from '#root/modules/auth/controllers/AuthController.js';

const NON_OBJECT_ID_STRINGS = ['not-an-objectid', '!!!', '123', 'xyz'];

const studentAUserId = new ObjectId().toString();
const studentBUserId = new ObjectId().toString();
const studentCUserId = new ObjectId().toString();
const instructor1UserId = new ObjectId().toString();
const instructor2UserId = new ObjectId().toString();

const mockStudentAUser = {
  _id: studentAUserId,
  firebaseUID: 'studentA-firebase-uid',
  email: 'studentA@test.com',
  firstName: 'Student',
  lastName: 'A',
  roles: 'user',
};
const mockStudentBUser = {
  _id: studentBUserId,
  firebaseUID: 'studentB-firebase-uid',
  email: 'studentB@test.com',
  firstName: 'Student',
  lastName: 'B',
  roles: 'user',
};
// studentC is also in cohort A — used for the same-cohort, different-user
// case (item #4 below).
const mockStudentCUser = {
  _id: studentCUserId,
  firebaseUID: 'studentC-firebase-uid',
  email: 'studentC@test.com',
  firstName: 'Student',
  lastName: 'C',
  roles: 'user',
};
const mockInstructorUser = {
  _id: instructor1UserId,
  firebaseUID: 'instructor1-firebase-uid',
  email: 'instructor1@test.com',
  firstName: 'Instructor',
  lastName: 'One',
  roles: 'user',
};
const mockInstructor2User = {
  _id: instructor2UserId,
  firebaseUID: 'instructor2-firebase-uid',
  email: 'instructor2@test.com',
  firstName: 'Instructor',
  lastName: 'Two',
  roles: 'user',
};

describe('Discussion Controller — Milestone D cohort hardening', {timeout: 90000}, () => {
  const appInstance = Express();
  let app: any;
  let course1Id: string;
  let course1VersionId: string;
  let cohortAId: string;
  let cohortBId: string;
  let course2Id: string;
  let course2VersionId: string;
  let cohortDId: string;

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
      settingContainerModule,
      courseRegistrationContainerModule,
      projectsContainerModule,
      reportsContainerModule,
      hpSystemContainerModule,
      ejectionPolicyContainerModule,
      emotionsContainerModule,
      genAIContainerModule,
      studentQuestionsContainerModule,
      announcementsContainerModule,
      auditTrailsContainerModule,
      discussionBoardContainerModule,
    );

    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);

    const db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    await db.connect();

    const courseRepo = container.get<ICourseRepository>(GLOBAL_TYPES.CourseRepo);

    const c1 = await courseRepo.create({
      name: 'Hardening Main Course',
      description: 'For Milestone D hardening',
      versions: [],
      instructors: [new ObjectId(instructor1UserId)],
    } as any);
    course1Id = (c1!._id as ObjectId).toString();

    const cv1 = await courseRepo.createVersion({
      courseId: new ObjectId(course1Id),
      version: '1.0',
      description: 'main',
      modules: [],
      versionStatus: 'active',
    } as any, undefined);
    course1VersionId = (cv1!._id as ObjectId).toString();
    await courseRepo.addNewCourseVersionToCourse(course1Id, course1VersionId);

    const cohortIds = await courseRepo.createCohorts(
      course1Id,
      course1VersionId,
      ['Cohort A', 'Cohort B'],
      0,
    );
    const hydrated = await courseRepo.getCohortsByIds(cohortIds);
    cohortAId = hydrated.find(c => c.name === 'Cohort A')!._id!.toString();
    cohortBId = hydrated.find(c => c.name === 'Cohort B')!._id!.toString();

    const c2 = await courseRepo.create({
      name: 'Wrong-Course Course',
      description: 'For Milestone D test #5',
      versions: [],
      instructors: [new ObjectId(instructor2UserId)],
    } as any);
    course2Id = (c2!._id as ObjectId).toString();

    const cv2 = await courseRepo.createVersion({
      courseId: new ObjectId(course2Id),
      version: '1.0',
      description: 'wrong',
      modules: [],
      versionStatus: 'active',
    } as any, undefined);
    course2VersionId = (cv2!._id as ObjectId).toString();
    await courseRepo.addNewCourseVersionToCourse(course2Id, course2VersionId);

    const c2Cohorts = await courseRepo.createCohorts(
      course2Id,
      course2VersionId,
      ['Cohort D'],
      0,
    );
    cohortDId = c2Cohorts[0].toString();

    vi.spyOn(FirebaseAuthService.prototype, 'getCurrentUserFromToken')
      .mockImplementation(async (token: string) => {
        switch (token) {
          case 'studentA-token': return mockStudentAUser as any;
          case 'studentB-token': return mockStudentBUser as any;
          case 'studentC-token': return mockStudentCUser as any;
          case 'instructor1-token': return mockInstructorUser as any;
          case 'instructor2-token': return mockInstructor2User as any;
          default: throw new Error('Invalid token');
        }
      });

    vi.spyOn(EnrollmentService.prototype, 'getAllEnrollments')
      .mockImplementation((async (userId: string) => {
        const onCourse1 = (role: string, cohortField: object) => ({
          _id: new ObjectId(),
          userId: new ObjectId(userId),
          courseId: new ObjectId(course1Id),
          courseVersionId: new ObjectId(course1VersionId),
          role,
          status: 'ACTIVE',
          ...cohortField,
        });
        const onCourse2 = (role: string, cohortField: object) => ({
          _id: new ObjectId(),
          userId: new ObjectId(userId),
          courseId: new ObjectId(course2Id),
          courseVersionId: new ObjectId(course2VersionId),
          role,
          status: 'ACTIVE',
          ...cohortField,
        });
        if (userId === studentAUserId) return [onCourse1('STUDENT', {cohortId: new ObjectId(cohortAId)})];
        if (userId === studentCUserId) return [onCourse1('STUDENT', {cohortId: new ObjectId(cohortAId)})];
        if (userId === studentBUserId) return [onCourse1('STUDENT', {cohortId: new ObjectId(cohortBId)})];
        if (userId === instructor1UserId) {
          return [
            onCourse1('INSTRUCTOR', {
              assignedCohortIds: [new ObjectId(cohortAId), new ObjectId(cohortBId)],
            }),
          ];
        }
        if (userId === instructor2UserId) {
          return [
            onCourse2('INSTRUCTOR', {
              assignedCohortIds: [new ObjectId(cohortDId)],
            }),
          ];
        }
        return [];
      }) as any);

    app = useExpressServer(appInstance, {
      controllers: [
        DiscussionController,
        CourseController,
        CourseVersionController,
        AuthController,
        UserController,
      ],
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
        switch (token) {
          case 'studentA-token': return mockStudentAUser;
          case 'studentB-token': return mockStudentBUser;
          case 'studentC-token': return mockStudentCUser;
          case 'instructor1-token': return mockInstructorUser;
          case 'instructor2-token': return mockInstructor2User;
          default: return null;
        }
      },
      defaultErrorHandler: true,
      validation: true,
    });
  });

  async function createThread(
    bearer: string,
    title: string,
    body: string,
    cohortId: string,
    courseId: string = course1Id,
  ): Promise<string> {
    const created = await request(app)
      .post(`/course/${courseId}/discussions`)
      .set('authorization', `Bearer ${bearer}`)
      .send({title, body, cohortId})
      .expect(201);
    return (created.body as {_id: string})._id;
  }

  async function createReply(
    bearer: string,
    threadId: string,
    body: string,
  ): Promise<string> {
    const created = await request(app)
      .post(`/discussions/${threadId}/replies`)
      .set('authorization', `Bearer ${bearer}`)
      .send({body})
      .expect(201);
    return (created.body as {_id: string})._id;
  }

  // -------- Item #2 — cross-cohort no-leak for all 5 endpoints --------
  it('#2 returns 404 (no-leak) for every endpoint when accessed cross-cohort', async () => {
    const threadId = await createThread(
      'studentA-token',
      'cohort A only',
      'private to A',
      cohortAId,
    );
    const replyId = await createReply('studentA-token', threadId, 'private reply');

    await request(app)
      .get(`/discussions/${threadId}`)
      .set('authorization', 'Bearer studentB-token')
      .expect(404);
    await request(app)
      .post(`/discussions/${threadId}/replies`)
      .set('authorization', 'Bearer studentB-token')
      .send({body: 'sneak in'})
      .expect(404);
    await request(app)
      .patch(`/discussions/${threadId}`)
      .set('authorization', 'Bearer studentB-token')
      .send({title: 'hacked'})
      .expect(404);
    await request(app)
      .delete(`/discussions/${threadId}`)
      .set('authorization', 'Bearer studentB-token')
      .expect(404);
    await request(app)
      .delete(`/replies/${replyId}`)
      .set('authorization', 'Bearer studentB-token')
      .expect(404);

    // Sanity: thread is still there for student A.
    await request(app)
      .get(`/discussions/${threadId}`)
      .set('authorization', 'Bearer studentA-token')
      .expect(200);
  });

  // -------- Item #3 — student pin attempt returns 403 (re-confirm) --------
  it('#3 confirms a student attempting to pin a thread gets 403 (not 404)', async () => {
    const threadId = await createThread(
      'studentA-token',
      'student pin test (D)',
      'try to pin',
      cohortAId,
    );
    await request(app)
      .patch(`/discussions/${threadId}/pin`)
      .set('authorization', 'Bearer studentA-token')
      .send({pinned: true})
      .expect(403);
  });

  // -------- Item #4 — same-cohort, different-user → 403 --------
  it('#4 returns 403 when a student deletes another student\'s thread within the same cohort', async () => {
    const threadId = await createThread(
      'studentA-token',
      'A\'s thread — cohort-mate C tries to delete',
      'same cohort different user',
      cohortAId,
    );
    // studentC is also enrolled in cohort A. They should NOT be able to
    // delete student A's thread — that's moderator-only. The Milestone A
    // 404 convention does NOT apply here (cohort visibility isn't in
    // question). So this is a 403, never a 404.
    await request(app)
      .delete(`/discussions/${threadId}`)
      .set('authorization', 'Bearer studentC-token')
      .expect(403);

    await request(app)
      .get(`/discussions/${threadId}`)
      .set('authorization', 'Bearer studentA-token')
      .expect(200);
  });

  it('#4 returns 403 when a student deletes another student\'s reply within the same cohort', async () => {
    const threadId = await createThread(
      'studentA-token',
      'Thread for same-cohort reply delete test',
      'cohort-mate tries to delete the reply',
      cohortAId,
    );
    const replyId = await createReply('studentA-token', threadId, 'A says hi');

    await request(app)
      .delete(`/replies/${replyId}`)
      .set('authorization', 'Bearer studentC-token')
      .expect(403);

    const detail = await request(app)
      .get(`/discussions/${threadId}`)
      .set('authorization', 'Bearer studentA-token')
      .expect(200);
    expect((detail.body as {replies: unknown[]}).replies).toHaveLength(1);
  });

  // -------- Item #5 — teacher moderating a course they are NOT enrolled on --------
  it('#5 blocks a teacher from moderating a thread in a course they have no enrollment on (404 per convention)', async () => {
    const threadId = await createThread(
      'studentA-token',
      'thread in main course',
      'visible only to cohort A',
      cohortAId,
    );

    // instructor2 has an enrollment ONLY on course 2 — they should not
    // be able to pin, edit, or delete a thread on course 1.
    // The DiscussionService cohort-scope check fails first (course1Id
    // isn't in instructor2's scope), so the response is 404 — the
    // thread's existence is not leaked to a teacher with no business
    // in this course.
    await request(app)
      .patch(`/discussions/${threadId}/pin`)
      .set('authorization', 'Bearer instructor2-token')
      .send({pinned: true})
      .expect(404);
    await request(app)
      .patch(`/discussions/${threadId}`)
      .set('authorization', 'Bearer instructor2-token')
      .send({title: 'sneak-edit'})
      .expect(404);
    await request(app)
      .delete(`/discussions/${threadId}`)
      .set('authorization', 'Bearer instructor2-token')
      .expect(404);

    await request(app)
      .get(`/discussions/${threadId}`)
      .set('authorization', 'Bearer studentA-token')
      .expect(200);
  });

  // -------- Item #6 — unauthenticated → all 401 --------
  it('#6 rejects unauthenticated requests to every endpoint with 401', async () => {
    const threadId = await createThread(
      'studentA-token',
      'exists for #6',
      'no auth required to see this',
      cohortAId,
    );
    const replyId = await createReply(
      'studentA-token',
      threadId,
      'also exists for #6',
    );

    await request(app).get(`/course/${course1Id}/discussions`).expect(401);
    await request(app).get(`/discussions/${threadId}`).expect(401);
    await request(app)
      .post(`/course/${course1Id}/discussions`)
      .send({title: 'no auth', body: 'no auth', cohortId: cohortAId})
      .expect(401);
    await request(app)
      .patch(`/discussions/${threadId}`)
      .send({title: 'no auth'})
      .expect(401);
    await request(app).delete(`/discussions/${threadId}`).expect(401);
    await request(app)
      .patch(`/discussions/${threadId}/pin`)
      .send({pinned: true})
      .expect(401);
    await request(app)
      .post(`/discussions/${threadId}/replies`)
      .send({body: 'no auth reply'})
      .expect(401);
    await request(app).delete(`/replies/${replyId}`).expect(401);
  });

  // -------- Item #7 — malformed IDs → graceful 4xx (not 500) --------
  it('#7 returns 4xx (not 500) for malformed :threadId / :replyId / :courseId', async () => {
    for (const bad of NON_OBJECT_ID_STRINGS) {
      await request(app)
        .get(`/discussions/${bad}`)
        .set('authorization', 'Bearer studentA-token')
        .expect((res) => {
          if (res.status >= 500) throw new Error(`GET /discussions/${bad} returned 500`);
          expect([400, 404]).toContain(res.status);
        });
      await request(app)
        .patch(`/discussions/${bad}`)
        .set('authorization', 'Bearer studentA-token')
        .send({title: 'x'})
        .expect((res) => {
          if (res.status >= 500) throw new Error(`PATCH /discussions/${bad} returned 500`);
          expect([400, 404]).toContain(res.status);
        });
      await request(app)
        .delete(`/discussions/${bad}`)
        .set('authorization', 'Bearer studentA-token')
        .expect((res) => {
          if (res.status >= 500) throw new Error(`DELETE /discussions/${bad} returned 500`);
          expect([400, 404]).toContain(res.status);
        });
      await request(app)
        .patch(`/discussions/${bad}/pin`)
        .set('authorization', 'Bearer instructor1-token')
        .send({pinned: true})
        .expect((res) => {
          if (res.status >= 500) throw new Error(`PIN /discussions/${bad} returned 500`);
          expect([400, 403, 404]).toContain(res.status);
        });
      await request(app)
        .post(`/discussions/${bad}/replies`)
        .set('authorization', 'Bearer studentA-token')
        .send({body: 'x'})
        .expect((res) => {
          if (res.status >= 500) throw new Error(`POST replies on /discussions/${bad} returned 500`);
          expect([400, 404]).toContain(res.status);
        });

      await request(app)
        .delete(`/replies/${bad}`)
        .set('authorization', 'Bearer studentA-token')
        .expect((res) => {
          if (res.status >= 500) throw new Error(`DELETE /replies/${bad} returned 500`);
          expect([400, 404]).toContain(res.status);
        });

      await request(app)
        .get(`/course/${bad}/discussions`)
        .set('authorization', 'Bearer studentA-token')
        .expect((res) => {
          if (res.status >= 500) throw new Error(`GET /course/${bad}/discussions returned 500`);
          expect([400, 404]).toContain(res.status);
        });
      await request(app)
        .post(`/course/${bad}/discussions`)
        .set('authorization', 'Bearer studentA-token')
        .send({title: 'x', body: 'y', cohortId: cohortAId})
        .expect((res) => {
          if (res.status >= 500) throw new Error(`POST /course/${bad}/discussions returned 500`);
          expect([400, 404]).toContain(res.status);
        });
    }
  });

  // -------- Item #8 — client-supplied cohortId / extra fields --------
  it('#8 ignores a client-supplied cohortId outside the caller\'s authorised scope', async () => {
    // student A is in cohort A. Sending cohortB in the body must NOT
    // let them post in cohort B — server re-derives the caller's
    // scope and returns 404 (no leak) when the requested cohort
    // falls outside it.
    await request(app)
      .post(`/course/${course1Id}/discussions`)
      .set('authorization', 'Bearer studentA-token')
      .send({
        title: 'Trying to cross cohorts',
        body: 'should not work',
        cohortId: cohortBId,
      })
      .expect(404);

    // Sanity: a thread actually creates when the supplied cohort is
    // the caller\'s own — proving the server did not lose all control.
    const ok = await request(app)
      .post(`/course/${course1Id}/discussions`)
      .set('authorization', 'Bearer studentA-token')
      .send({
        title: 'legit thread',
        body: 'own cohort A',
        cohortId: cohortAId,
      })
      .expect(201);
    expect((ok.body as {cohortId: string}).cohortId).toBe(cohortAId);
  });

  it('#8 silently strips unknown / extra fields from the create-thread body', async () => {
    const created = await request(app)
      .post(`/course/${course1Id}/discussions`)
      .set('authorization', 'Bearer studentA-token')
      .send({
        title: 'extra fields',
        body: 'should land cleanly',
        cohortId: cohortAId,
        authorId: 'someOtherUserId',
        isAdmin: true,
        cohortIds: [cohortBId],
      })
      .expect(201);

    const createdBody = created.body as Record<string, unknown>;
    // authorId should be the caller\'s id, NOT the client-supplied one.
    expect(createdBody.authorId).toBe(studentAUserId);
    // The persisted thread\'s cohort is the caller\'s scope, NOT cohortB.
    expect(createdBody.cohortId).toBe(cohortAId);
    // isAdmin must not be on the response — it was a boolean in the
    // body; if it slipped through as a stored field, that\'s a leak.
    expect(createdBody).not.toHaveProperty('isAdmin');
  });

  // -------- Item #9 — cascade-delete edge: zero replies --------
  it('#9 cascade-deletes a thread with zero replies without throwing', async () => {
    const threadId = await createThread(
      'studentA-token',
      'zero-reply thread',
      'nothing to cascade',
      cohortAId,
    );
    const detail = await request(app)
      .get(`/discussions/${threadId}`)
      .set('authorization', 'Bearer studentA-token')
      .expect(200);
    expect((detail.body as {replies: unknown[]}).replies).toHaveLength(0);

    await request(app)
      .delete(`/discussions/${threadId}`)
      .set('authorization', 'Bearer studentA-token')
      .expect(204);

    await request(app)
      .get(`/discussions/${threadId}`)
      .set('authorization', 'Bearer studentA-token')
      .expect(404);
  });

  // -------- Item #10 — double-delete idempotent --------
  it('#10 makes a second delete of the same thread return 404 (not 500)', async () => {
    const threadId = await createThread(
      'studentA-token',
      'will be deleted twice',
      'idempotent-safe',
      cohortAId,
    );

    await request(app)
      .delete(`/discussions/${threadId}`)
      .set('authorization', 'Bearer studentA-token')
      .expect(204);

    await request(app)
      .delete(`/discussions/${threadId}`)
      .set('authorization', 'Bearer studentA-token')
      .expect(404);
  });

  it('#10 makes a second delete of the same reply return 404 (not 500)', async () => {
    const threadId = await createThread(
      'studentA-token',
      'parent for double-delete reply test',
      'irrelevant',
      cohortAId,
    );
    const replyId = await createReply('studentA-token', threadId, 'first');

    await request(app)
      .delete(`/replies/${replyId}`)
      .set('authorization', 'Bearer studentA-token')
      .expect(204);

    await request(app)
      .delete(`/replies/${replyId}`)
      .set('authorization', 'Bearer studentA-token')
      .expect(404);
  });
});
