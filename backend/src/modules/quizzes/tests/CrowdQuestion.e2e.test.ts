import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import Express from 'express';
import request from 'supertest';
import {ObjectId} from 'mongodb';

/**
 * Manual verification harness for the crowd-question peer-validation loop
 * (submit -> serve -> answer + thumb -> gate -> instructor ELIGIBLE queue ->
 * approve). Drives the REAL HTTP controllers end to end against a fully
 * isolated, in-memory MongoDB (mongodb-memory-server) — no real database is
 * touched. Firebase is bypassed by mocking FirebaseAuthService's token
 * verification, since no local gcp-service-account.json is available in this
 * environment; every other layer (routing-controllers, DI container,
 * services, repositories, real Mongo reads/writes/indexes) is exercised for
 * real.
 *
 * This file is a one-off verification aid, not part of the permanent suite —
 * it is expected to be deleted after use.
 */

describe('Crowd-question peer-validation E2E', async () => {
  process.env.NODE_ENV = 'test';
  process.env.SCREENING_ENABLED = 'false'; // deterministic pass, no LLM calls
  process.env.SCREENING_CONTEXT_ENABLED = 'false';

  // Multi-document transactions (AttemptService._withTransaction, etc.)
  // require a replica set — a plain standalone instance rejects them.
  const {MongoMemoryReplSet} = await import('mongodb-memory-server');
  const mongod = await MongoMemoryReplSet.create({replSet: {count: 1}});
  process.env.DB_URL = mongod.getUri();
  process.env.DB_NAME = 'crowdq_e2e';

  const {Container} = await import('inversify');
  const {useContainer, useExpressServer} = await import('routing-controllers');
  const {sharedContainerModule} = await import('#root/container.js');
  const {InversifyAdapter} = await import('#root/inversify-adapter.js');
  const {GLOBAL_TYPES} = await import('#root/types.js');
  const {quizzesContainerModule} = await import('../container.js');
  const {coursesContainerModule} = await import('#courses/container.js');
  const {usersContainerModule} = await import('#users/container.js');
  const {authContainerModule} = await import('#auth/container.js');
  const {notificationsContainerModule} = await import(
    '#root/modules/notifications/container.js'
  );
  const {anomaliesContainerModule} = await import(
    '#root/modules/anomalies/container.js'
  );
  const {settingContainerModule} = await import(
    '#root/modules/setting/container.js'
  );
  const {courseRegistrationContainerModule} = await import(
    '#root/modules/courseRegistration/container.js'
  );
  const {projectsContainerModule} = await import(
    '#root/modules/projects/container.js'
  );
  const {reportsContainerModule} = await import(
    '#root/modules/reports/container.js'
  );
  const {hpSystemContainerModule} = await import(
    '#root/modules/hpSystem/container.js'
  );
  const {ejectionPolicyContainerModule} = await import(
    '#root/modules/ejectionPolicy/container.js'
  );
  const {emotionsContainerModule} = await import(
    '#root/modules/emotions/container.js'
  );
  const {genAIContainerModule} = await import('#root/modules/genAI/container.js');
  const {studentQuestionsContainerModule} = await import(
    '#root/modules/studentQuestions/container.js'
  );
  const {announcementsContainerModule} = await import(
    '#root/modules/announcements/container.js'
  );
  const {auditTrailsContainerModule} = await import(
    '#root/modules/auditTrails/container.js'
  );

  const {quizzesModuleOptions} = await import('../index.js');
  const {coursesModuleOptions} = await import('#courses/index.js');
  const {studentQuestionsModuleOptions} = await import(
    '#root/modules/studentQuestions/index.js'
  );
  const {settingModuleOptions} = await import('#root/modules/setting/index.js');

  const {MongoDatabase} = await import(
    '#root/shared/database/providers/mongo/MongoDatabase.js'
  );
  const {FirebaseAuthService} = await import(
    '#root/modules/auth/services/FirebaseAuthService.js'
  );
  const {ItemType} = await import('#root/shared/interfaces/models.js');
  const vi = (await import('vitest')).vi;

  const appInstance = Express();
  let app: any;
  let db: InstanceType<typeof MongoDatabase>;
  let containerRef: InstanceType<typeof Container>;

  // token -> IUser, consulted by both currentUserChecker (@CurrentUser routes)
  // and the mocked Firebase verification (@Ability-gated attempt/submit/course
  // routes), so a single Authorization header works for every route.
  const usersByToken = new Map<string, any>();

  function authHeader(token: string): [string, string] {
    return ['Authorization', `Bearer ${token}`];
  }

  // ObjectIds in questionRenderViews serialize over HTTP as
  // {buffer:{type:'Buffer',data:[...]}} rather than a plain hex string (the
  // frontend has the same bufferToHex conversion for this reason).
  function idToHex(id: any): string {
    if (typeof id === 'string') return id;
    if (id?.buffer?.data) {
      return Buffer.from(id.buffer.data).toString('hex');
    }
    return String(id);
  }

  async function makeTestUser(label: string, roles: 'user' | 'admin' = 'user') {
    const _id = new ObjectId();
    const user = {
      _id,
      firebaseUID: `fake-${_id.toString()}`,
      email: `${label}-${_id.toString()}@example.com`,
      firstName: label,
      lastName: 'Tester',
      roles,
    };
    const usersCollection = await db.getCollection('users');
    await usersCollection.insertOne(user as any);
    const token = _id.toString();
    usersByToken.set(token, user);
    return {user, token};
  }

  // ProgressService.handleQuizeProgressAfterSubmission requires an existing
  // progress doc (normally created when a student starts watching a video).
  // Seed one directly rather than driving the full watch-time HTTP flow.
  async function seedProgress(
    userId: ObjectId,
    courseId: string,
    courseVersionId: string,
    moduleId: string,
    sectionId: string,
    currentItem: string,
  ) {
    const progressCollection = await db.getCollection('progress');
    await progressCollection.insertOne({
      userId,
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
      currentModule: new ObjectId(moduleId),
      currentSection: new ObjectId(sectionId),
      currentItem: new ObjectId(currentItem),
      completed: false,
    } as any);
  }

  async function enroll(
    userId: ObjectId,
    courseId: string,
    courseVersionId: string,
    role: 'STUDENT' | 'INSTRUCTOR',
  ) {
    const enrollmentCollection = await db.getCollection('enrollment');
    await enrollmentCollection.insertOne({
      userId,
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
      role,
      status: 'active',
      enrollmentDate: new Date(),
      percentCompleted: 0,
      isDeleted: false,
    } as any);
  }

  beforeAll(async () => {
    const container = new Container();
    containerRef = container;
    await container.load(
      sharedContainerModule,
      quizzesContainerModule,
      coursesContainerModule,
      usersContainerModule,
      authContainerModule,
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
    );
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
    db = container.get(GLOBAL_TYPES.Database);
    await db.connect();

    vi.spyOn(FirebaseAuthService.prototype, 'getCurrentUserFromToken').mockImplementation(
      async (token: string) => {
        const user = usersByToken.get(token);
        if (!user) throw new Error(`no test user for token ${token}`);
        return {...user, _id: user._id.toString()};
      },
    );

    app = useExpressServer(appInstance, {
      controllers: [
        ...(quizzesModuleOptions.controllers as Function[]),
        ...(coursesModuleOptions.controllers as Function[]),
        ...(studentQuestionsModuleOptions.controllers as Function[]),
        ...(settingModuleOptions.controllers as Function[]),
      ],
      authorizationChecker: async () => true,
      defaultErrorHandler: true,
      validation: true,
      currentUserChecker: async action => {
        const token = action.request.headers['authorization']?.split(' ')[1];
        const user = token ? usersByToken.get(token) : null;
        return user ? {...user, _id: user._id.toString()} : null;
      },
    });
  }, 120000);

  afterAll(async () => {
    await mongod.stop();
  }, 30000);

  it(
    'submits, serves, captures peer responses, flips the gate, and surfaces the question to the instructor',
    {timeout: 120000},
    async () => {
      // ---------- Arrange: instructor + course/video/quiz/graded question ----------
      const {token: instructorToken} = await makeTestUser('instructor', 'admin');
      const auth = authHeader(instructorToken);

      const courseRes = await request(app)
        .post('/courses')
        .set(...auth)
        .send({
          name: 'Crowd-q e2e course',
          description: 'e2e course',
          versionName: 'v1.0',
          versionDescription: 'e2e version',
        });
      expect(courseRes.status).toBe(201);
      const courseId = courseRes.body._id;

      const versionRes = await request(app)
        .post(`/courses/${courseId}/versions`)
        .set(...auth)
        .send({version: 'v2.0', description: 'e2e version 2'});
      expect(versionRes.status).toBe(201);
      const versionId = versionRes.body._id;

      // Course settings must exist before module creation — CourseVersionService
      // reads courseSettings unconditionally (getisHpSystemEnabled) and a null
      // doc throws. Insert directly rather than fighting the full nested
      // SettingsDto validator; this also enables crowd-question submission.
      const courseSettingsCollection = await db.getCollection('courseSettings');
      await courseSettingsCollection.insertOne({
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(versionId),
        settings: {crowdsourcedQuestionSubmissionEnabled: true},
      } as any);

      const moduleRes = await request(app)
        .post(`/courses/versions/${versionId}/modules`)
        .set(...auth)
        .send({name: 'Module', description: 'e2e'});
      expect(moduleRes.status).toBe(201);
      const moduleId = moduleRes.body.version.modules[0].moduleId;

      const sectionRes = await request(app)
        .post(`/courses/versions/${versionId}/modules/${moduleId}/sections`)
        .set(...auth)
        .send({name: 'Section', description: 'e2e'});
      expect(sectionRes.status).toBe(201);
      const sectionId = sectionRes.body.version.modules[0].sections[0].sectionId;

      const videoRes = await request(app)
        .post(
          `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
        )
        .set(...auth)
        .send({
          name: 'Intro video',
          description: 'e2e',
          type: ItemType.VIDEO,
          videoDetails: {
            URL: 'https://example.com/video.mp4',
            startTime: '00:00:00',
            endTime: '00:05:00',
            points: 10,
          },
        });
      expect(videoRes.status).toBe(201);
      const videoItemId = videoRes.body.createdItem._id;

      // A graded question + bank, so the quiz has real scored content
      // alongside the ungraded peer question (realistic mixed quiz).
      const questionRes = await request(app)
        .post('/quizzes/questions')
        .set(...authHeader(instructorToken))
        .send({
          question: {
            text: 'What is 3 + 3?',
            type: 'NUMERIC_ANSWER_TYPE',
            points: 5,
            timeLimitSeconds: 30,
            isParameterized: false,
            parameters: [],
            hint: 'Simple math.',
            priority: 'LOW',
          },
          solution: {decimalPrecision: 0, upperLimit: 10, lowerLimit: 0, value: 6},
        });
      expect(questionRes.status).toBe(201);
      const gradedQuestionId = questionRes.body.questionId;

      const bankRes = await request(app)
        .post('/quizzes/question-bank')
        .set(...authHeader(instructorToken))
        .send({
          courseId,
          courseVersionId: versionId,
          questions: [gradedQuestionId],
          title: 'Crowd-q e2e bank',
          description: 'bank',
        });
      expect(bankRes.status).toBe(200);
      const questionBankId = bankRes.body.questionBankId;

      const quizItemRes = await request(app)
        .post(
          `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
        )
        .set(...authHeader(instructorToken))
        .send({
          name: 'Quiz after crowd-q video',
          description: 'quiz',
          type: ItemType.QUIZ,
          quizDetails: {
            questionBankIds: [questionBankId],
            questionVisibility: 3,
            allowPartialGrading: true,
            allowSkip: true,
            deadline: new Date(Date.now() + 86400000),
            allowHint: true,
            maxAttempts: -1,
            releaseTime: new Date(),
            quizType: 'DEADLINE',
            showCorrectAnswersAfterSubmission: true,
            showExplanationAfterSubmission: true,
            showScoreAfterSubmission: true,
            approximateTimeToComplete: '00:30:00',
            passThreshold: 0,
          },
        });
      expect(quizItemRes.status).toBe(201);
      const quizId = quizItemRes.body.createdItem._id;

      await request(app)
        .post(`/quizzes/quiz/${quizId}/bank`)
        .set(...authHeader(instructorToken))
        .send({bankId: questionBankId, count: 1});

      // 10 enrolled students -> gate threshold = ceil(10 * 0.5) = 5.
      const author = await makeTestUser('author');
      await enroll(author.user._id, courseId, versionId, 'STUDENT');
      await seedProgress(author.user._id, courseId, versionId, moduleId, sectionId, videoItemId);
      const responders: {user: any; token: string}[] = [];
      for (let i = 0; i < 9; i++) {
        const s = await makeTestUser(`responder${i}`);
        await enroll(s.user._id, courseId, versionId, 'STUDENT');
        await seedProgress(s.user._id, courseId, versionId, moduleId, sectionId, videoItemId);
        responders.push(s);
      }

      // ---------- Act 1: author submits a crowd question on the video ----------
      const submitQRes = await request(app)
        .post(`/student-questions/courses/${courseId}/versions/${versionId}/segments/${videoItemId}`)
        .set(...authHeader(author.token))
        .send({
          questionType: 'SELECT_ONE_IN_LOT',
          questionText: 'What color is produced by mixing blue and yellow paint?',
          options: [{text: 'Green'}, {text: 'Purple'}, {text: 'Orange'}],
          correctOptionIndex: 0,
        });
      expect(submitQRes.status).toBe(201);
      expect(submitQRes.body.decision).toBe('pass');
      const crowdQuestionId = submitQRes.body.questionId;
      expect(crowdQuestionId).toBeTruthy();

      const studentQuestionsCollection = await db.getCollection('studentSegmentQuestions');
      const stored = await studentQuestionsCollection.findOne({
        _id: new ObjectId(crowdQuestionId),
      });
      expect(stored?.status).toBe('PENDING');
      expect(stored?.gateState).toBe('COLLECTING');

      // ---------- Act 2: the author is never served their own question ----------
      const authorAttemptRes = await request(app)
        .post(`/quizzes/${quizId}/attempt`)
        .set(...authHeader(author.token))
        .send({});
      expect(authorAttemptRes.status).toBe(200);
      const authorHasPeerQuestion = authorAttemptRes.body.questionRenderViews.some(
        (q: any) => q.isPeerContributed,
      );
      expect(authorHasPeerQuestion).toBe(false);

      // ---------- Act 3: 5 other students answer + thumbs-up, mixed correct/incorrect ----------
      // Need correctRate in [0.30, 0.70] with 5 responses -> 2 correct / 3 incorrect.
      const outcomes = [true, true, false, false, false];
      for (let i = 0; i < 5; i++) {
        const student = responders[i];
        const attemptRes = await request(app)
          .post(`/quizzes/${quizId}/attempt`)
          .set(...authHeader(student.token))
          .send({});
        expect(attemptRes.status).toBe(200);
        const attemptId = attemptRes.body.attemptId;
        const views: any[] = attemptRes.body.questionRenderViews;
        const peerView = views.find(q => q.isPeerContributed);
        expect(peerView).toBeTruthy();

        const gradedView = views.find(q => !q.isPeerContributed);
        const answerCorrectly = outcomes[i];
        const peerLotItem = answerCorrectly
          ? peerView.lotItems.find((li: any) => li.text === 'Green')
          : peerView.lotItems.find((li: any) => li.text !== 'Green');

        const submitRes = await request(app)
          .post(`/quizzes/${quizId}/attempt/${attemptId}/submit`)
          .set(...authHeader(student.token))
          .send({
            courseId,
            courseVersionId: versionId,
            answers: [
              {
                questionId: idToHex(gradedView._id),
                questionType: 'NUMERIC_ANSWER_TYPE',
                answer: {value: 6},
              },
              {
                questionId: idToHex(peerView._id),
                questionType: 'SELECT_ONE_IN_LOT',
                answer: {lotItemId: idToHex(peerLotItem._id)},
                thumb: 'UP',
              },
            ],
          });
        expect(submitRes.status).toBe(200);
      }

      // ---------- Assert: counters + gate flipped to ELIGIBLE ----------
      const afterResponses = await studentQuestionsCollection.findOne({
        _id: new ObjectId(crowdQuestionId),
      });
      expect(afterResponses?.responseCount).toBe(5);
      expect(afterResponses?.correctCount).toBe(2);
      expect(afterResponses?.thumbsUpCount).toBe(5);
      expect(afterResponses?.thumbsDownCount).toBe(0);
      expect(afterResponses?.gateState).toBe('ELIGIBLE');

      // ---------- Assert: instructor ELIGIBLE-filtered queue shows it ----------
      const queueRes = await request(app)
        .get(`/student-questions/courses/${courseId}/versions/${versionId}`)
        .query({status: 'PENDING', gateState: 'ELIGIBLE'})
        .set(...authHeader(instructorToken));
      expect(queueRes.status).toBe(200);
      const found = queueRes.body.items.find((i: any) => i._id === crowdQuestionId);
      expect(found).toBeTruthy();
      expect(found.gateState).toBe('ELIGIBLE');
      expect(found.responseCount).toBe(5);

      // A COLLECTING-only filter must NOT include it anymore.
      const collectingRes = await request(app)
        .get(`/student-questions/courses/${courseId}/versions/${versionId}`)
        .query({status: 'PENDING', gateState: 'COLLECTING'})
        .set(...authHeader(instructorToken));
      expect(
        collectingRes.body.items.some((i: any) => i._id === crowdQuestionId),
      ).toBe(false);

      // ---------- Act 4: instructor approves -> promoted into the graded bank ----------
      const approveRes = await request(app)
        .patch(
          `/student-questions/courses/${courseId}/versions/${versionId}/segments/${videoItemId}/questions/${crowdQuestionId}/status`,
        )
        .set(...authHeader(instructorToken))
        .send({status: 'APPROVED'});
      expect(approveRes.status).toBe(200);

      const afterApproval = await studentQuestionsCollection.findOne({
        _id: new ObjectId(crowdQuestionId),
      });
      expect(afterApproval?.status).toBe('APPROVED');
    },
  );
});
