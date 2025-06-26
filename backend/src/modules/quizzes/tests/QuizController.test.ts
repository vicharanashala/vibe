import Express from 'express';
import request from 'supertest';
import {
  useExpressServer,
  useContainer,
  RoutingControllersOptions,
} from 'routing-controllers';
import {Container} from 'inversify';
import {faker} from '@faker-js/faker';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {sharedContainerModule} from '#root/container.js';
import {quizzesContainerModule} from '../container.js';
import {coursesContainerModule} from '#root/modules/courses/container.js';
import {usersContainerModule} from '#root/modules/users/container.js';
import {quizzesModuleOptions} from '../index.js';
import {coursesModuleOptions} from '#root/modules/courses/index.js';
import {authContainerModule} from '#root/modules/auth/container.js';
import {authModuleOptions} from '#root/modules/auth/index.js';
import {beforeAll, describe, it, expect, beforeEach, vi} from 'vitest';
import {ItemType} from '#root/shared/interfaces/models.js';
import { FirebaseAuthService } from '#root/modules/auth/services/FirebaseAuthService.js';
import { notificationsContainerModule } from '#root/modules/notifications/container.js';

describe('QuizController',{timeout: 30000}, () => {
  const appInstance = Express();
  let app: any;
  let userId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const container = new Container();
    await container.load(
      sharedContainerModule,
      quizzesContainerModule,
      coursesContainerModule,
      usersContainerModule,
      authContainerModule,
      notificationsContainerModule
    );
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);

    const options: RoutingControllersOptions = {
      controllers: [
        ...(quizzesModuleOptions.controllers as Function[]),
        ...(coursesModuleOptions.controllers as Function[]),
        ...(authModuleOptions.controllers as Function[]),
      ],
      authorizationChecker: async () => true,
      defaultErrorHandler: true,
      validation: true,
      currentUserChecker: async () => {
        return userId
          ? {
              _id: userId,
              email: 'quiz_test_user@example.com',
              name: 'Quiz Test User',
            }
          : null;
      },
    };
    app = useExpressServer(appInstance, options);

    // Sign up a user and store the userId
    const signUpBody = {
      email: faker.internet.email(),
      password: 'TestPassword123!',
      firstName: faker.person.firstName().replace(/[^a-zA-Z]/g, ''),
      lastName: faker.person.lastName().replace(/[^a-zA-Z]/g, ''),
    };
    const signupRes = await request(app).post('/auth/signup').send(signUpBody);
    expect(signupRes.status).toBe(201);
    userId = signupRes.body.userId;
    expect(userId).toBeTruthy();
    vi.spyOn(FirebaseAuthService.prototype, 'getUserIdFromReq').mockResolvedValue(userId)
  }, 900000);

  // Helper: create a quiz and question bank, return their IDs
  async function setupQuizWithBank() {
    // 1. Create course
    const courseRes = await request(app).post('/courses').send({
      name: 'Course for QuizController',
      description: 'Course for quiz controller test',
    });
    expect(courseRes.status).toBe(201);
    const courseId = courseRes.body._id;

    // 2. Create course version
    const versionRes = await request(app)
      .post(`/courses/${courseId}/versions`)
      .send({
        version: 'v1',
        description: 'Version for quiz controller test',
      });
    expect(versionRes.status).toBe(201);
    const versionId = versionRes.body._id;

    // 3. Create module
    const moduleRes = await request(app)
      .post(`/courses/versions/${versionId}/modules`)
      .send({
        name: 'Module for QuizController',
        description: 'Module for quiz controller test',
      });
    expect(moduleRes.status).toBe(201);
    const moduleId = moduleRes.body.version.modules[0].moduleId;

    // 4. Create section
    const sectionRes = await request(app)
      .post(`/courses/versions/${versionId}/modules/${moduleId}/sections`)
      .send({
        name: 'Section for QuizController',
        description: 'Section for quiz controller test',
      });
    expect(sectionRes.status).toBe(201);
    const sectionId = sectionRes.body.version.modules[0].sections[0].sectionId;

    // 5. Create a real question
    const questionData = {
      text: 'What is 2 + 2?',
      type: 'NUMERIC_ANSWER_TYPE',
      points: 5,
      timeLimitSeconds: 30,
      isParameterized: false,
      parameters: [],
      hint: 'Simple math.',
    };
    const solution = {
      decimalPrecision: 0,
      upperLimit: 10,
      lowerLimit: 0,
      value: 4,
    };
    const questionRes = await request(app).post('/quizzes/questions').send({
      question: questionData,
      solution,
    });
    expect(questionRes.status).toBe(201);
    const questionId = questionRes.body.questionId;

    // 6. Create question bank with the question
    const bankRes = await request(app)
      .post('/quizzes/question-bank')
      .send({
        courseId,
        courseVersionId: versionId,
        questions: [questionId],
        title: 'Bank for QuizController',
        description: 'Bank for quiz controller test',
      });
    expect(bankRes.status).toBe(200);
    const questionBankId = bankRes.body.questionBankId;

    // 7. Create quiz item referencing the question bank
    const itemPayload = {
      name: 'Quiz Item for QuizController',
      description: 'Quiz item description',
      type: ItemType.QUIZ,
      quizDetails: {
        questionVisibility: 3,
        allowPartialGrading: true,
        deadline: faker.date.future(),
        allowHint: true,
        maxAttempts: 5,
        releaseTime: faker.date.future(),
        quizType: 'DEADLINE',
        showCorrectAnswersAfterSubmission: true,
        showExplanationAfterSubmission: true,
        showScoreAfterSubmission: true,
        approximateTimeToComplete: '00:30:00',
        passThreshold: 0.7,
      },
    };

    const itemRes = await request(app)
      .post(
        `/courses/versions/${versionId}/modules/${moduleId}/sections/${sectionId}/items`,
      )
      .send(itemPayload);
    expect(itemRes.status).toBe(201);
    const quizId = itemRes.body.createdItem._id;

    // Add question bank to quiz item
    const updateQuizRes = await request(app)
      .post(`/quizzes/quiz/${quizId}/bank`)
      .send({
        bankId: questionBankId,
        count: 1,
      });
    expect(updateQuizRes.status).toBe(200);

    return {quizId, questionBankId, questionId};
  }

  describe('POST /quizzes/quiz/:quizId/bank', () => {
    it('should give 500 as already added', async () => {
      const {quizId, questionBankId} = await setupQuizWithBank();
      const res = await request(app)
        .post(`/quizzes/quiz/${quizId}/bank`)
        .send({bankId: questionBankId, count: 1});
      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(
        'Question bank is already added to the quiz',
      );
    });
  });

  describe('DELETE /quizzes/quiz/:quizId/bank/:questionBankId', () => {
    it('should remove a question bank from a quiz', async () => {
      const {quizId, questionBankId} = await setupQuizWithBank();
      await request(app)
        .post(`/quizzes/quiz/${quizId}/bank`)
        .send({bankId: questionBankId, count: 1});
      const res = await request(app).delete(
        `/quizzes/quiz/${quizId}/bank/${questionBankId}`,
      );
      expect(res.status).toBe(200);
    });
  });

  describe('PATCH /quizzes/quiz/:quizId/bank (edit)', () => {
    it('should edit a question bank configuration', async () => {
      const {quizId, questionBankId} = await setupQuizWithBank();
      const res = await request(app)
        .patch(`/quizzes/quiz/${quizId}/bank`)
        .send({bankId: questionBankId, count: 2});
      expect(res.status).toBe(200);
    });
  });

  describe('GET /quizzes/quiz/:quizId/bank', () => {
    it('should get all question banks for a quiz', async () => {
      const {quizId, questionBankId} = await setupQuizWithBank();
      const res = await request(app).get(`/quizzes/quiz/${quizId}/bank`);
      expect(res.status).toBe(200);
      expect(res.body[0].bankId).toBe(questionBankId);
    });
  });

  describe('GET /quizzes/quiz/:quizId/user/:userId', () => {
    it('should get user metrics for a quiz', async () => {
      const {quizId, questionId} = await setupQuizWithBank();
      const attemptRes = await request(app).post(`/quizzes/${quizId}/attempt`);
      const attemptId = attemptRes.body.attemptId;
      // Attempt the question
      const submitRes = await request(app)
        .post(`/quizzes/${quizId}/attempt/${attemptId}/submit`)
        .send({
          answers: [
            {
              questionId: questionId,
              questionType: 'NUMERIC_ANSWER_TYPE',
              answer: {value: 9},
            },
          ],
        });
      expect(submitRes.status).toBe(200);
      const res = await request(app).get(
        `/quizzes/quiz/${quizId}/user/${userId}`,
      );
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('quizId');
      expect(res.body).toHaveProperty('userId');
    });
  });

  describe('GET /quizzes/quiz/attempts/:attemptId', () => {
    it('should get quiz attempt details', async () => {
      const {quizId, questionId} = await setupQuizWithBank();
      // Create attempt
      const attemptRes = await request(app).post(`/quizzes/${quizId}/attempt`);
      expect(attemptRes.status).toBe(200);
      const attemptId = attemptRes.body.attemptId;
      // Save answers (optional, but makes attempt more realistic)
      await request(app)
        .post(`/quizzes/${quizId}/attempt/${attemptId}/save`)
        .send({
          answers: [
            {
              questionId,
              questionType: 'NUMERIC_ANSWER_TYPE',
              answer: {value: 4},
            },
          ],
        });

      const res = await request(app).get(`/quizzes/quiz/attempts/${attemptId}`);
      console.log('Attempt response:', res.body);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('quizId');
    });
  });

  describe('GET /quizzes/quiz/submissions/:submissionId', () => {
    it('should get quiz submission details', async () => {
      const {quizId, questionId} = await setupQuizWithBank();
      // Create attempt
      const attemptRes = await request(app).post(`/quizzes/${quizId}/attempt`);
      expect(attemptRes.status).toBe(200);
      const attemptId = attemptRes.body.attemptId;
      // Submit answers
      const submitRes = await request(app)
        .post(`/quizzes/${quizId}/attempt/${attemptId}/submit`)
        .send({
          answers: [
            {
              questionId,
              questionType: 'NUMERIC_ANSWER_TYPE',
              answer: {value: 4},
            },
          ],
        });
      expect(submitRes.status).toBe(200);
      // get submissions for quiz
      const quizSubmissionRes = await request(app).get(
        `/quizzes/quiz/${quizId}/submissions`,
      );
      expect(quizSubmissionRes.status).toBe(200);
      expect(Array.isArray(quizSubmissionRes.body)).toBe(true);
      const submissionId =
        quizSubmissionRes.body[0]._id || quizSubmissionRes.body[0].submissionId;
      const res = await request(app).get(
        `/quizzes/quiz/submissions/${submissionId}`,
      );
      console.log('Submission response:', res.body);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('quizId');
    });
  });

  describe('GET /quizzes/quiz/:quizId/details', () => {
    it('should get quiz details', async () => {
      const {quizId} = await setupQuizWithBank();
      const res = await request(app).get(`/quizzes/quiz/${quizId}/details`);
      console.log('Quiz details response:', res.body);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name');
    });
  });

  describe('GET /quizzes/quiz/:quizId/analytics', () => {
    it('should get quiz analytics', async () => {
      const {quizId, questionId} = await setupQuizWithBank();
      const attemptRes = await request(app).post(`/quizzes/${quizId}/attempt`);
      const attemptId = attemptRes.body.attemptId;
      // Attempt the question
      const submitRes = await request(app)
        .post(`/quizzes/${quizId}/attempt/${attemptId}/submit`)
        .send({
          answers: [
            {
              questionId: questionId,
              questionType: 'NUMERIC_ANSWER_TYPE',
              answer: {value: 9},
            },
          ],
        });
      console.log('Submit response:', submitRes.body);
      expect(submitRes.status).toBe(200);
      const res = await request(app).get(`/quizzes/quiz/${quizId}/analytics`);
      console.dir(res.body, {depth: null});
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalAttempts');
    });
  });

  describe('GET /quizzes/quiz/:quizId/performance', () => {
    it('should get quiz performance stats', async () => {
      const {quizId, questionId} = await setupQuizWithBank();
      const attemptRes = await request(app).post(`/quizzes/${quizId}/attempt`);
      const attemptId = attemptRes.body.attemptId;
      // Attempt the question
      const submitRes = await request(app)
        .post(`/quizzes/${quizId}/attempt/${attemptId}/submit`)
        .send({
          answers: [
            {
              questionId: questionId,
              questionType: 'NUMERIC_ANSWER_TYPE',
              answer: {value: 9},
            },
          ],
        });
      expect(submitRes.status).toBe(200);
      const res = await request(app).get(`/quizzes/quiz/${quizId}/performance`);
      console.log('Quiz performance response:', res.body);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /quizzes/quiz/:quizId/results', () => {
    it('should get quiz results', async () => {
      const {quizId, questionId} = await setupQuizWithBank();
      const attemptRes = await request(app).post(`/quizzes/${quizId}/attempt`);
      const attemptId = attemptRes.body.attemptId;
      // Attempt the question
      const submitRes = await request(app)
        .post(`/quizzes/${quizId}/attempt/${attemptId}/submit`)
        .send({
          answers: [
            {
              questionId: questionId,
              questionType: 'NUMERIC_ANSWER_TYPE',
              answer: {value: 9},
            },
          ],
        });
      expect(submitRes.status).toBe(200);
      const res = await request(app).get(`/quizzes/quiz/${quizId}/results`);
      console.log('Quiz results response:', res.body);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /quizzes/quiz/:quizId/flagged', () => {
    it('should get flagged questions for a quiz', async () => {
      // const { quizId } = await setupQuizWithBank();
      // const res = await request(app).get(`/quizzes/quiz/${quizId}/flagged`);
      // expect(res.status).toBe(201);
      // No further assertion as flagged questions may not exist
    });
  });

  describe('POST /quizzes/quiz/submission/:submissionId/score/:score', () => {
    it('should update quiz submission score', async () => {
      const {quizId, questionId} = await setupQuizWithBank();
      // Create attempt
      const attemptRes = await request(app).post(`/quizzes/${quizId}/attempt`);
      expect(attemptRes.status).toBe(200);
      const attemptId = attemptRes.body.attemptId;

      // Submit answers
      const submitRes = await request(app)
        .post(`/quizzes/${quizId}/attempt/${attemptId}/submit`)
        .send({
          answers: [
            {
              questionId,
              questionType: 'NUMERIC_ANSWER_TYPE',
              answer: {value: 4},
            },
          ],
        });
      expect(submitRes.status).toBe(200);
      // Get submission ID
      const quizSubmissionRes = await request(app).get(
        `/quizzes/quiz/${quizId}/submissions`,
      );
      expect(quizSubmissionRes.status).toBe(200);
      expect(Array.isArray(quizSubmissionRes.body)).toBe(true);
      const submissionId = quizSubmissionRes.body[0]._id;

      // Update score
      const res = await request(app).post(
        `/quizzes/quiz/submission/${submissionId}/score/5`,
      );
      expect(res.status).toBe(200);
    });
  });

  describe('POST /quizzes/quiz/submission/:submissionId/regrade', () => {
    it('should regrade a quiz submission', async () => {
      const {quizId, questionId} = await setupQuizWithBank();
      // Create attempt
      const attemptRes = await request(app)
        .post(`/quizzes/${quizId}/attempt`)
        .send();
      expect(attemptRes.status).toBe(200);
      const attemptId = attemptRes.body.attemptId;

      // Submit answers
      const submitRes = await request(app)
        .post(`/quizzes/${quizId}/attempt/${attemptId}/submit`)
        .send({
          answers: [
            {
              questionId,
              questionType: 'NUMERIC_ANSWER_TYPE',
              answer: {value: 4},
            },
          ],
        });
      expect(submitRes.status).toBe(200);
      // Get submission ID
      const quizSubmissionRes = await request(app).get(
        `/quizzes/quiz/${quizId}/submissions`,
      );
      expect(quizSubmissionRes.status).toBe(200);
      expect(Array.isArray(quizSubmissionRes.body)).toBe(true);
      const submissionId = quizSubmissionRes.body[0]._id;
      // Regrade
      const res = await request(app)
        .post(`/quizzes/quiz/submission/${submissionId}/regrade`)
        .send({gradingStatus: 'FAILED'});
      expect(res.status).toBe(200);
      // get grading result
      const gradingRes = await request(app).get(
        `/quizzes/quiz/submissions/${submissionId}`,
      );
      expect(gradingRes.status).toBe(200);
      expect(gradingRes.body.gradingResult).toBeDefined();
      expect(gradingRes.body.gradingResult.gradingStatus).toBe('FAILED');
      console.log('Regrade response:', gradingRes.body);
    });
  });

  describe('POST /quizzes/quiz/submission/:submissionId/question/:questionId/feedback', () => {
    it('should add feedback to a question in a submission', async () => {
      const {quizId, questionId} = await setupQuizWithBank();
      // Create attempt
      const attemptRes = await request(app)
        .post(`/quizzes/${quizId}/attempt`)
        .send();
      expect(attemptRes.status).toBe(200);
      const attemptId = attemptRes.body.attemptId;

      // Submit answers
      const submitRes = await request(app)
        .post(`/quizzes/${quizId}/attempt/${attemptId}/submit`)
        .send({
          answers: [
            {
              questionId,
              questionType: 'NUMERIC_ANSWER_TYPE',
              answer: {value: 4},
            },
          ],
        });
      expect(submitRes.status).toBe(200);
      // Get submission ID
      const quizSubmissionRes = await request(app).get(
        `/quizzes/quiz/${quizId}/submissions`,
      );
      expect(quizSubmissionRes.status).toBe(200);
      expect(Array.isArray(quizSubmissionRes.body)).toBe(true);
      const submissionId = quizSubmissionRes.body[0]._id;
      // Add feedback
      const res = await request(app)
        .post(
          `/quizzes/quiz/submission/${submissionId}/question/${questionId}/feedback`,
        )
        .send({feedback: 'Good job!'});
      expect(res.status).toBe(200);

      // get submission to verify feedback
      const submissionRes = await request(app).get(
        `/quizzes/quiz/submissions/${submissionId}`,
      );
      expect(submissionRes.status).toBe(200); 
      expect(
        submissionRes.body.gradingResult.overallFeedback[0].answerFeedback,
      ).toBe('Good job!');
    });
  });
});
