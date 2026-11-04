import Express from 'express';
import {
    RoutingControllersOptions,
    useContainer,
    useExpressServer,
} from 'routing-controllers';
import { sharedContainerModule } from '#root/container.js';
import { usersContainerModule } from '#root/modules/users/container.js';
import { Container } from 'inversify';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import request from 'supertest';
import { examsContainerModule, examsModuleOptions } from '../index.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Regression coverage for two bugs that shipped together and were only
 * caught by hand-testing through the UI:
 *
 * 1. Route collision — `GET/POST /exams/question-bank` were being swallowed
 *    by `ExamController`'s `GET /exams/:examId` (binding `examId` to the
 *    literal string "question-bank") whenever `ExamController.ts` happened
 *    to evaluate before `QuestionBankController.ts`. That ordering is driven
 *    by *import*-evaluation order, not by any controller-array order, and
 *    was silently broken by `QuestionBankController` importing a helper
 *    (`assertOwnerOrAdmin`) straight from `ExamController.ts` — see
 *    `authz.ts` and `QuestionBankController`'s class doc for the full story.
 * 2. Id normalization — `ExamImageStorageService.resolveQuestionBankEntries`
 *    (the batch path used by `GET /exams/question-bank`) forgot to convert
 *    each entry's Mongo `_id` from an `ObjectId` to a hex string, unlike its
 *    singular sibling `resolveQuestionBankEntry`. Left un-normalized, `_id`
 *    serializes over JSON as `{ buffer: { ... } }` instead of a string,
 *    which round-tripped straight into `POST /:examId/questions/from-bank`
 *    and failed `@IsMongoId()` validation on every request.
 */
describe('Exams module — QuestionBank', { timeout: 30000 }, () => {
    const appInstance = Express();
    let app: any;
    const userId = '000000000000000000000001';
    const otherUserId = '000000000000000000000002';

    beforeAll(async () => {
        process.env.NODE_ENV = 'test';
        const container = new Container();
        await container.load(sharedContainerModule, examsContainerModule, usersContainerModule);
        const inversifyAdapter = new InversifyAdapter(container);
        useContainer(inversifyAdapter);
        const db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
        await db.connect();

        let currentUserId = userId;
        const options: RoutingControllersOptions = {
            controllers: examsModuleOptions.controllers,
            authorizationChecker: async () => true,
            defaultErrorHandler: true,
            validation: true,
            currentUserChecker: async () => ({
                _id: currentUserId,
                firebaseUID: 'test-uid',
                email: 'exam_test_user@example.com',
                firstName: 'Exam',
                lastName: 'Tester',
                roles: 'user' as const,
            }),
        };
        app = useExpressServer(appInstance, options);
        // Exposed for tests that need to act as a different user.
        (app as any).__setUserId = (id: string) => {
            currentUserId = id;
        };
    }, 900000);

    const sampleQuestion = () => ({
        type: 'MCQ' as const,
        questionText: 'What is 2 + 2?',
        options: [
            { id: 'a', text: '3' },
            { id: 'b', text: '4' },
        ],
        correctOptions: ['b'],
        marks: 1,
        topic: 'Arithmetic',
    });

    describe('GET /exams/question-bank (route-collision regression)', () => {
        it('is not swallowed by GET /exams/:examId and returns a list', async () => {
            const res = await request(app).get('/exams/question-bank');
            // A pre-fix run would hit ExamController.getExam instead, which
            // 400s because "question-bank" is not a valid Mongo id for :examId.
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('POST /exams/question-bank', () => {
        it('adds a question to the bank with a normalized string _id', async () => {
            const res = await request(app).post('/exams/question-bank').send(sampleQuestion());
            expect(res.status).toBe(201);
            expect(typeof res.body._id).toBe('string');
        });
    });

    describe('GET /exams/question-bank (id-normalization regression)', () => {
        it('lists entries with normalized string _ids, not raw ObjectIds', async () => {
            await request(app).post('/exams/question-bank').send(sampleQuestion());
            const res = await request(app).get('/exams/question-bank');
            expect(res.status).toBe(200);
            expect(res.body.length).toBeGreaterThan(0);
            for (const entry of res.body) {
                // Pre-fix, this was `{ buffer: { type: 'Buffer', data: [...] } }`.
                expect(typeof entry._id).toBe('string');
                expect(entry._id).toMatch(/^[0-9a-f]{24}$/);
            }
        });
    });

    describe('POST /exams/:examId/questions/from-bank', () => {
        it('copies an owned bank entry into the exam using the id straight off the list response', async () => {
            const examRes = await request(app).post('/exams').send({ title: 'From-bank test exam' });
            expect(examRes.status).toBe(201);
            const examId = examRes.body._id;

            const bankRes = await request(app).post('/exams/question-bank').send(sampleQuestion());
            const bankId = bankRes.body._id;

            const addRes = await request(app)
                .post(`/exams/${examId}/questions/from-bank`)
                .send({ questionIds: [bankId] });
            expect(addRes.status).toBe(201);
            expect(addRes.body.questions.length).toBe(1);
            expect(addRes.body.questions[0].questionText).toBe(sampleQuestion().questionText);
        });

        it('silently skips bank entries owned by another user', async () => {
            const examRes = await request(app).post('/exams').send({ title: 'From-bank ownership test' });
            const examId = examRes.body._id;

            (app as any).__setUserId(otherUserId);
            const otherBankRes = await request(app).post('/exams/question-bank').send(sampleQuestion());
            const otherBankId = otherBankRes.body._id;
            (app as any).__setUserId(userId);

            const addRes = await request(app)
                .post(`/exams/${examId}/questions/from-bank`)
                .send({ questionIds: [otherBankId] });
            expect(addRes.status).toBe(201);
            expect(addRes.body.questions.length).toBe(0);
        });

        it('failure: non-Mongo-id questionIds are rejected', async () => {
            const examRes = await request(app).post('/exams').send({ title: 'From-bank validation test' });
            const examId = examRes.body._id;

            const res = await request(app)
                .post(`/exams/${examId}/questions/from-bank`)
                .send({ questionIds: ['not-a-mongo-id'] });
            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /exams/question-bank/:questionId', () => {
        it('removes an owned bank entry', async () => {
            const bankRes = await request(app).post('/exams/question-bank').send(sampleQuestion());
            const bankId = bankRes.body._id;

            const delRes = await request(app).delete(`/exams/question-bank/${bankId}`);
            expect(delRes.status).toBe(200);
            expect(delRes.body).toEqual({ success: true });

            const listRes = await request(app).get('/exams/question-bank');
            expect(listRes.body.find((e: any) => e._id === bankId)).toBeUndefined();
        });
    });
});
