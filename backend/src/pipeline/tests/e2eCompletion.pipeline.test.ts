import request from 'supertest';
import { faker } from '@faker-js/faker';
import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest';
import { ProgressService } from '#root/modules/users/services/ProgressService.js';
import { bootstrapPipelineApp } from './helpers/bootstrapPipelineApp.js';

const ALL_ANOMALY_TYPES = [
  'NO_FACE',
  'MULTIPLE_FACES',
  'VOICE_DETECTION',
  'BLUR_DETECTION',
  'FOCUS',
  'HAND_GESTURE_DETECTION',
  'FACE_RECOGNITION',
] as const;

type PipelineItemType = 'VIDEO' | 'QUIZ' | 'BLOG' | 'PROJECT' | 'FEEDBACK';

interface PipelineItem {
  id: string;
  moduleId: string;
  sectionId: string;
  type: PipelineItemType;
  questionId?: string;
}

interface BootstrapState {
  app: any;
  stop: () => Promise<void>;
  adminToken: string;
  studentId: string;
  studentToken: string;
  courseId: string;
  versionId: string;
  moduleId: string;
  sectionId: string;
  items: {
    video1: PipelineItem;
    quiz1: PipelineItem;
    article: PipelineItem;
    video2: PipelineItem;
    quiz2: PipelineItem;
    project: PipelineItem;
    feedback: PipelineItem;
  };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function runStep<T>(label: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    console.error(`FAIL | ${label} | ${toErrorMessage(error)}`);
    throw error;
  }
}

async function runPhase<T>(label: string, action: () => Promise<T>): Promise<T> {
  try {
    const result = await action();
    console.log(`PASS | ${label}`);
    return result;
  } catch (error) {
    console.error(`FAIL | ${label} | ${toErrorMessage(error)}`);
    throw error;
  }
}

function extractItemId(responseBody: any): string {
  return (
    responseBody?.createdItem?._id?.toString?.() ||
    responseBody?.itemsGroup?.items?.[responseBody.itemsGroup.items.length - 1]?._id?.toString?.() ||
    responseBody?.itemsGroup?.items?.[0]?._id?.toString?.() ||
    responseBody?.item?._id?.toString?.()
  );
}

function buildVideoPayload(name: string) {
  return {
    name,
    description: `${name} description`,
    type: 'VIDEO',
    videoDetails: {
      URL: 'https://example.com/video.mp4',
      startTime: '00:00:00',
      endTime: '00:01:00',
      points: 10,
    },
  };
}

function buildQuizPayload(name: string) {
  return {
    name,
    description: `${name} description`,
    type: 'QUIZ',
    quizDetails: {
      questionVisibility: 3,
      allowPartialGrading: true,
      allowSkip: false,
      deadline: faker.date.future(),
      allowHint: true,
      maxAttempts: 3,
      releaseTime: faker.date.recent(),
      quizType: 'DEADLINE',
      showCorrectAnswersAfterSubmission: true,
      showExplanationAfterSubmission: true,
      showScoreAfterSubmission: true,
      approximateTimeToComplete: '00:10:00',
      passThreshold: 0.6,
    },
  };
}

function buildArticlePayload() {
  return {
    name: 'Article 1',
    description: 'Article item',
    type: 'BLOG',
    blogDetails: {
      content: 'This is a test article.',
      estimatedReadTimeInMinutes: 2,
      points: '10.0',
    },
  };
}

function buildProjectPayload() {
  return {
    name: 'Project 1',
    description: 'Build and submit a project URL',
    type: 'PROJECT',
    details: {
      name: 'Project 1',
      description: 'Build and submit a project URL',
    },
  };
}

function buildFeedbackPayload() {
  return {
    name: 'Feedback 1',
    description: 'Course feedback',
    type: 'FEEDBACK',
    feedbackFormDetails: {
      jsonSchema: {
        type: 'object',
        required: ['rating', 'comment'],
        properties: {
          rating: { type: 'number', minimum: 1, maximum: 5 },
          comment: { type: 'string' },
        },
      },
      uiSchema: {
        comment: {
          'ui:widget': 'textarea',
        },
      },
    },
  };
}

async function createQuestionAndAttachToQuiz(
  app: any,
  adminToken: string,
  courseId: string,
  versionId: string,
  quizId: string,
): Promise<string> {
  const questionRes = await request(app)
    .post('/quizzes/questions')
    .set(auth(adminToken))
    .send({
      question: {
        text: 'What is 2 + 2?',
        type: 'NUMERIC_ANSWER_TYPE',
        priority: 'MEDIUM',
        points: 5,
        timeLimitSeconds: 30,
        isParameterized: false,
        parameters: [],
        hint: 'Simple addition',
      },
      solution: {
        decimalPrecision: 0,
        upperLimit: 10,
        lowerLimit: 0,
        value: 4,
      },
    })
    .expect(201);

  const questionId = questionRes.body.questionId;

  const bankRes = await request(app)
    .post('/quizzes/question-bank')
    .set(auth(adminToken))
    .send({
      courseId,
      courseVersionId: versionId,
      questions: [questionId],
      title: `Pipeline Bank ${faker.string.alphanumeric(6)}`,
      description: 'Question bank for pipeline quiz',
    })
    .expect(200);

  await request(app)
    .post(`/quizzes/quiz/${quizId}/bank`)
    .set(auth(adminToken))
    .send({
      bankId: bankRes.body.questionBankId,
      count: 1,
    })
    .expect(200);

  return questionId;
}

async function getProgress(app: any, token: string, courseId: string, versionId: string) {
  const res = await request(app)
    .get(`/users/progress/courses/${courseId}/versions/${versionId}/percentage`)
    .set(auth(token))
    .expect(200);

  return res.body as {
    completed: boolean;
    percentCompleted: number;
    totalItems: number;
    completedItems: number;
  };
}

async function startItem(app: any, token: string, courseId: string, versionId: string, item: PipelineItem) {
  const res = await request(app)
    .post(`/users/progress/courses/${courseId}/versions/${versionId}/start`)
    .set(auth(token))
    .send({
      itemId: item.id,
      moduleId: item.moduleId,
      sectionId: item.sectionId,
    })
    .expect(200);

  return res.body.watchItemId as string;
}

async function stopItem(
  app: any,
  token: string,
  courseId: string,
  versionId: string,
  item: PipelineItem,
  watchItemId: string,
  extra?: Record<string, any>,
) {
  await request(app)
    .post(`/users/progress/courses/${courseId}/versions/${versionId}/stop`)
    .set(auth(token))
    .send({
      watchItemId,
      itemId: item.id,
      moduleId: item.moduleId,
      sectionId: item.sectionId,
      ...extra,
    })
    .expect(200);
}

async function completeQuiz(
  app: any,
  studentToken: string,
  courseId: string,
  versionId: string,
  item: PipelineItem,
) {
  const watchItemId = await startItem(app, studentToken, courseId, versionId, item);

  const attemptRes = await request(app)
    .post(`/quizzes/${item.id}/attempt`)
    .set(auth(studentToken))
    .send({})
    .expect(200);

  const attemptId = attemptRes.body.attemptId;

  await request(app)
    .post(`/quizzes/${item.id}/attempt/${attemptId}/submit`)
    .set(auth(studentToken))
    .send({
      answers: [
        {
          questionId: item.questionId,
          questionType: 'NUMERIC_ANSWER_TYPE',
          answer: { value: 4 },
        },
      ],
      courseId,
      courseVersionId: versionId,
      watchItemId,
    })
    .expect(200);

  await stopItem(app, studentToken, courseId, versionId, item, watchItemId, {
    attemptId,
  });
}

async function setupCourse(app: any, adminToken: string): Promise<Pick<BootstrapState, 'courseId' | 'versionId' | 'moduleId' | 'sectionId' | 'items'>> {
  const courseRes = await request(app)
    .post('/courses')
    .set(auth(adminToken))
    .send({
      name: `Pipeline Course ${faker.string.alphanumeric(8)}`,
      description: 'Course used for E2E pipeline progress testing',
      versionName: 'Pipeline Base Version',
      versionDescription: 'Base version created by pipeline suite',
    })
    .expect(201);
  const courseId = courseRes.body._id;

  const versionRes = await request(app)
    .post(`/courses/${courseId}/versions`)
    .set(auth(adminToken))
    .send({
      version: '1.0',
      description: 'Pipeline version',
    })
    .expect(201);
  const versionId = versionRes.body._id;

  const moduleRes = await request(app)
    .post(`/courses/versions/${versionId}/modules`)
    .set(auth(adminToken))
    .send({
      name: 'Module 1',
      description: 'Only module for pipeline',
    })
    .expect(201);
  const moduleId = moduleRes.body.version.modules[0].moduleId;

  const sectionRes = await request(app)
    .post(`/courses/versions/${versionId}/modules/${moduleId}/sections`)
    .set(auth(adminToken))
    .send({
      name: 'Section 1',
      description: 'Only section for pipeline',
    })
    .expect(201);
  const sectionId = sectionRes.body.version.modules[0].sections[0].sectionId;

  const video1Res = await request(app)
    .post(`/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`)
    .set(auth(adminToken))
    .send(buildVideoPayload('Video 1'))
    .expect(201);
  const video1Id = extractItemId(video1Res.body);

  const quiz1Res = await request(app)
    .post(`/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`)
    .set(auth(adminToken))
    .send(buildQuizPayload('Quiz 1'))
    .expect(201);
  const quiz1Id = extractItemId(quiz1Res.body);

  const articleRes = await request(app)
    .post(`/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`)
    .set(auth(adminToken))
    .send(buildArticlePayload())
    .expect(201);
  const articleId = extractItemId(articleRes.body);

  const video2Res = await request(app)
    .post(`/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`)
    .set(auth(adminToken))
    .send(buildVideoPayload('Video 2'))
    .expect(201);
  const video2Id = extractItemId(video2Res.body);

  const quiz2Res = await request(app)
    .post(`/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`)
    .set(auth(adminToken))
    .send(buildQuizPayload('Quiz 2'))
    .expect(201);
  const quiz2Id = extractItemId(quiz2Res.body);

  const projectRes = await request(app)
    .post(`/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`)
    .set(auth(adminToken))
    .send(buildProjectPayload())
    .expect(201);
  const projectId = extractItemId(projectRes.body);

  const feedbackRes = await request(app)
    .post(`/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`)
    .set(auth(adminToken))
    .send(buildFeedbackPayload())
    .expect(201);
  const feedbackId = extractItemId(feedbackRes.body);

  const quiz1QuestionId = await createQuestionAndAttachToQuiz(
    app,
    adminToken,
    courseId,
    versionId,
    quiz1Id,
  );
  const quiz2QuestionId = await createQuestionAndAttachToQuiz(
    app,
    adminToken,
    courseId,
    versionId,
    quiz2Id,
  );

  return {
    courseId,
    versionId,
    moduleId,
    sectionId,
    items: {
      video1: { id: video1Id, moduleId, sectionId, type: 'VIDEO' },
      quiz1: {
        id: quiz1Id,
        moduleId,
        sectionId,
        type: 'QUIZ',
        questionId: quiz1QuestionId,
      },
      article: { id: articleId, moduleId, sectionId, type: 'BLOG' },
      video2: { id: video2Id, moduleId, sectionId, type: 'VIDEO' },
      quiz2: {
        id: quiz2Id,
        moduleId,
        sectionId,
        type: 'QUIZ',
        questionId: quiz2QuestionId,
      },
      project: { id: projectId, moduleId, sectionId, type: 'PROJECT' },
      feedback: { id: feedbackId, moduleId, sectionId, type: 'FEEDBACK' },
    },
  };
}

describe('Pipeline E2E completion journey', () => {
  let state: BootstrapState;

  beforeAll(async () => {
    const { boot, admin, student, course } = await runPhase('Setup app, users, and course content', async () => {
      const boot = await runStep('Bootstrap pipeline app', () => bootstrapPipelineApp());
      const admin = await runStep('Create admin user', () => boot.createUser('admin'));
      const student = await runStep('Create student user', () => boot.createUser('user'));
      const course = await runStep('Seed course content', () => setupCourse(boot.app, admin.token));

      await runStep('Enroll student into course version', async () => {
        await request(boot.app)
          .post(`/users/${student.id}/enrollments/courses/${course.courseId}/versions/${course.versionId}`)
          .set(auth(admin.token))
          .send({ role: 'STUDENT' })
          .expect(200);
      });

      return { boot, admin, student, course };
    });

    state = {
      app: boot.app,
      stop: boot.stop,
      adminToken: admin.token,
      studentId: student.id,
      studentToken: student.token,
      courseId: course.courseId,
      versionId: course.versionId,
      moduleId: course.moduleId,
      sectionId: course.sectionId,
      items: course.items,
    };
  }, 300000);

  afterAll(async () => {
    if (state?.stop) {
      await state.stop();
    }
  });

  it('creates users, completes all 7 lesson types, and reaches 100% with anomaly persisted', async () => {
    const watchSpy = vi
      .spyOn(ProgressService.prototype as any, 'isValidWatchTime')
      .mockReturnValue(true);

    const checkpoints: number[] = [];

    await runPhase('Phase 1 | Video 1 completed and progress advanced', async () => {
      const video1Watch = await runStep('Start video 1', () => startItem(
        state.app,
        state.studentToken,
        state.courseId,
        state.versionId,
        state.items.video1,
      ));
      await runStep('Complete video 1', () => stopItem(
        state.app,
        state.studentToken,
        state.courseId,
        state.versionId,
        state.items.video1,
        video1Watch,
        { watchedSeconds: 45 },
      ));
      checkpoints.push((await getProgress(state.app, state.studentToken, state.courseId, state.versionId)).percentCompleted);
    });

    await runPhase('Phase 2 | Quiz 1 completed and progress advanced', async () => {
      await runStep('Complete quiz 1', () => completeQuiz(
        state.app,
        state.studentToken,
        state.courseId,
        state.versionId,
        state.items.quiz1,
      ));
      checkpoints.push((await getProgress(state.app, state.studentToken, state.courseId, state.versionId)).percentCompleted);
    });

    await runPhase('Phase 3 | Article completed and progress advanced', async () => {
      const articleWatch = await runStep('Start article', () => startItem(
        state.app,
        state.studentToken,
        state.courseId,
        state.versionId,
        state.items.article,
      ));
      await runStep('Complete article', () => stopItem(
        state.app,
        state.studentToken,
        state.courseId,
        state.versionId,
        state.items.article,
        articleWatch,
        { watchedSeconds: 30 },
      ));
      checkpoints.push((await getProgress(state.app, state.studentToken, state.courseId, state.versionId)).percentCompleted);
    });

    await runPhase('Phase 4 | Video 2 anomaly recorded and progress advanced', async () => {
      const video2Watch = await runStep('Start video 2', () => startItem(
        state.app,
        state.studentToken,
        state.courseId,
        state.versionId,
        state.items.video2,
      ));

      await runStep('Record NO_FACE anomaly on video 2', async () => {
        for (const anomalyType of ALL_ANOMALY_TYPES) {
          await request(state.app)
            .post('/anomalies/record')
            .set(auth(state.studentToken))
            .send({
              type: anomalyType,
              courseId: state.courseId,
              versionId: state.versionId,
              itemId: state.items.video2.id,
            })
            .expect(201);
        }
      });

      await runStep('Complete video 2', () => stopItem(
        state.app,
        state.studentToken,
        state.courseId,
        state.versionId,
        state.items.video2,
        video2Watch,
        { watchedSeconds: 50 },
      ));
      checkpoints.push((await getProgress(state.app, state.studentToken, state.courseId, state.versionId)).percentCompleted);
    });

    await runPhase('Phase 5 | Quiz 2 completed and progress advanced', async () => {
      await runStep('Complete quiz 2', () => completeQuiz(
        state.app,
        state.studentToken,
        state.courseId,
        state.versionId,
        state.items.quiz2,
      ));
      checkpoints.push((await getProgress(state.app, state.studentToken, state.courseId, state.versionId)).percentCompleted);
    });

    await runPhase('Phase 6 | Project submitted and progress advanced', async () => {
      const projectWatch = await runStep('Start project', () => startItem(
        state.app,
        state.studentToken,
        state.courseId,
        state.versionId,
        state.items.project,
      ));

      await runStep('Submit project', async () => {
        await request(state.app)
          .post('/project')
          .set(auth(state.studentToken))
          .send({
            projectId: state.items.project.id,
            courseId: state.courseId,
            versionId: state.versionId,
            moduleId: state.moduleId,
            sectionId: state.sectionId,
            watchItemId: projectWatch,
            submissionURL: 'https://example.com/submission',
            comment: 'Pipeline project submission',
          })
          .expect(200);
      });

      await runStep('Complete project', () => stopItem(
        state.app,
        state.studentToken,
        state.courseId,
        state.versionId,
        state.items.project,
        projectWatch,
      ));
      checkpoints.push((await getProgress(state.app, state.studentToken, state.courseId, state.versionId)).percentCompleted);
    });

    await runPhase('Phase 7 | Feedback submitted and final progress reached 100%', async () => {
      const feedbackWatch = await runStep('Start feedback', () => startItem(
        state.app,
        state.studentToken,
        state.courseId,
        state.versionId,
        state.items.feedback,
      ));

      await runStep('Submit feedback', async () => {
        await request(state.app)
          .post(`/quizzes/${state.items.feedback.id}/feedback/submit`)
          .set(auth(state.studentToken))
          .send({
            courseId: state.courseId,
            courseVersionId: state.versionId,
            sectionId: state.sectionId,
            details: {
              rating: 5,
              comment: 'Great course',
            },
          })
          .expect(200);
      });

      await runStep('Complete feedback', () => stopItem(
        state.app,
        state.studentToken,
        state.courseId,
        state.versionId,
        state.items.feedback,
        feedbackWatch,
      ));

      const finalProgress = await runStep('Fetch final progress', () => getProgress(
        state.app,
        state.studentToken,
        state.courseId,
        state.versionId,
      ));

      checkpoints.push(finalProgress.percentCompleted);

      expect(finalProgress.totalItems).toBe(7);
      expect(finalProgress.completedItems).toBe(7);
      expect(finalProgress.percentCompleted).toBe(100);
      expect(finalProgress.completed).toBe(true);
    });

    expect(checkpoints.length).toBe(7);
    for (let i = 1; i < checkpoints.length; i++) {
      expect(checkpoints[i]).toBeGreaterThan(checkpoints[i - 1]);
    }

    await runPhase('Phase 8 | Persisted anomaly verified', async () => {
      const anomaliesRes = await runStep('Fetch all anomalies for course version', async () => {
        return request(state.app)
          .get(`/anomalies/course/${state.courseId}/version/${state.versionId}`)
          .set(auth(state.adminToken))
          .query({ page: 1, limit: 20 })
          .expect(200);
      });

      const persisted: any[] = anomaliesRes.body || [];

      for (const anomalyType of ALL_ANOMALY_TYPES) {
        await runStep(`Verify ${anomalyType} anomaly persisted`, async () => {
          const record = persisted.find(
            (a: any) => a.type === anomalyType && a.itemId.toString() === state.items.video2.id,
          );
          expect(record, `Expected ${anomalyType} record to be persisted`).toBeTruthy();
          expect(record.userId.toString()).toBe(state.studentId);
        });
      }
    });

    watchSpy.mockRestore();
  }, 240000);
});
