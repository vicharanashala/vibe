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
 * Regression coverage for three `AttemptService`/`ExamService` bugs a
 * student could exploit even without a UI:
 *
 * 1. `submitAttempt` loaded the exam via a plain `examRepo.findById`
 *    instead of the eligibility+published gate the read path
 *    (`getExamForUser`) already enforces — a student who wasn't eligible,
 *    or where the exam wasn't published, could still submit a real scored
 *    attempt.
 * 2. The "no retakes" check was read-then-insert with no atomicity — two
 *    concurrent submissions could both pass the check.
 * 3. Every attempt stored the full `correctOptions` regardless of the
 *    exam's `revealAnswers` setting, so a student who'd already submitted
 *    could read the answer key straight off the attempt API response.
 */
describe('Exams module — AttemptController eligibility, retakes, answer leakage', { timeout: 30000 }, () => {
    const appInstance = Express();
    let app: any;
    const ownerId = '000000000000000000000010';
    const studentId = '000000000000000000000011';

    beforeAll(async () => {
        process.env.NODE_ENV = 'test';
        const container = new Container();
        await container.load(sharedContainerModule, examsContainerModule, usersContainerModule);
        const inversifyAdapter = new InversifyAdapter(container);
        useContainer(inversifyAdapter);
        const db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
        await db.connect();

        let currentUserId = ownerId;
        const options: RoutingControllersOptions = {
            controllers: examsModuleOptions.controllers,
            authorizationChecker: async () => true,
            defaultErrorHandler: true,
            validation: true,
            currentUserChecker: async () => ({
                _id: currentUserId,
                firebaseUID: `test-uid-${currentUserId}`,
                email: `${currentUserId}@example.com`,
                firstName: 'Test',
                lastName: 'User',
                roles: 'user' as const,
            }),
        };
        app = useExpressServer(appInstance, options);
        (app as any).__asOwner = () => {
            currentUserId = ownerId;
        };
        (app as any).__asStudent = () => {
            currentUserId = studentId;
        };
    }, 900000);

    const addQuestion = async (examId: string) => {
        await request(app)
            .post(`/exams/${examId}/questions`)
            .send({
                type: 'MCQ',
                questionText: 'What is 2 + 2?',
                options: [
                    { id: 'a', text: '3' },
                    { id: 'b', text: '4' },
                ],
                correctOptions: ['b'],
                marks: 1,
            });
    };

    describe('Eligibility / publish gate on submit', () => {
        it('rejects a submission from a student with no eligibility rule configured', async () => {
            (app as any).__asOwner();
            const examRes = await request(app).post('/exams').send({ title: 'Eligibility test exam' });
            const examId = examRes.body._id;
            await addQuestion(examId);

            (app as any).__asStudent();
            await request(app).post(`/exams/${examId}/attempts/start`).send({});
            const res = await request(app)
                .post(`/exams/${examId}/attempts`)
                .send({ responses: [] });
            expect(res.status).toBe(403);
        });

        it('rejects a submission when the exam is eligible but not yet published', async () => {
            (app as any).__asOwner();
            const examRes = await request(app).post('/exams').send({ title: 'Unpublished eligible exam' });
            const examId = examRes.body._id;
            await addQuestion(examId);
            await request(app).patch(`/exams/${examId}`).send({ eligibility: { mode: 'none' } });

            (app as any).__asStudent();
            await request(app).post(`/exams/${examId}/attempts/start`).send({});
            const res = await request(app)
                .post(`/exams/${examId}/attempts`)
                .send({ responses: [] });
            expect(res.status).toBe(403);
        });

        it('accepts a submission once eligible and published', async () => {
            (app as any).__asOwner();
            const examRes = await request(app).post('/exams').send({ title: 'Published eligible exam' });
            const examId = examRes.body._id;
            await addQuestion(examId);
            await request(app)
                .patch(`/exams/${examId}`)
                .send({ eligibility: { mode: 'none' }, published: true });

            (app as any).__asStudent();
            await request(app).post(`/exams/${examId}/attempts/start`).send({});
            const res = await request(app)
                .post(`/exams/${examId}/attempts`)
                .send({ responses: [] });
            expect(res.status).toBe(201);
        });
    });

    describe('Retake race condition', () => {
        it('allows only one attempt through when two submissions race for a no-retake exam', async () => {
            (app as any).__asOwner();
            const examRes = await request(app)
                .post('/exams')
                .send({ title: 'No-retake race exam', allowRetakes: false });
            const examId = examRes.body._id;
            await addQuestion(examId);
            await request(app)
                .patch(`/exams/${examId}`)
                .send({ eligibility: { mode: 'none' }, published: true });

            (app as any).__asStudent();
            await request(app).post(`/exams/${examId}/attempts/start`).send({});
            const [first, second] = await Promise.all([
                request(app).post(`/exams/${examId}/attempts`).send({ responses: [] }),
                request(app).post(`/exams/${examId}/attempts`).send({ responses: [] }),
            ]);
            const statuses = [first.status, second.status].sort();
            expect(statuses).toEqual([201, 403]);
        });
    });

    describe('Answer-key leakage vs revealAnswers', () => {
        it('redacts correctOptions on the submit response and on re-fetch when revealAnswers is off', async () => {
            (app as any).__asOwner();
            const examRes = await request(app)
                .post('/exams')
                .send({ title: 'Hidden answers exam', revealAnswers: false });
            const examId = examRes.body._id;
            const qRes = await request(app)
                .post(`/exams/${examId}/questions`)
                .send({
                    type: 'MCQ',
                    questionText: 'What is 2 + 2?',
                    options: [
                        { id: 'a', text: '3' },
                        { id: 'b', text: '4' },
                    ],
                    correctOptions: ['b'],
                    marks: 1,
                    explanation: 'Correct answer: 4, because 2+2=4.',
                });
            const questionId = qRes.body.questions[0].id;
            await request(app)
                .patch(`/exams/${examId}`)
                .send({ eligibility: { mode: 'none' }, published: true });

            (app as any).__asStudent();
            await request(app).post(`/exams/${examId}/attempts/start`).send({});
            const submitRes = await request(app)
                .post(`/exams/${examId}/attempts`)
                .send({
                    responses: [{ questionId, selectedOptionIds: ['a'] }],
                });
            expect(submitRes.status).toBe(201);
            expect(submitRes.body.answers[questionId].correct).toEqual([]);
            expect(submitRes.body.questions[0].correctOptions).toEqual([]);
            expect(submitRes.body.questions[0].explanation).toBeFalsy();

            const attemptId = submitRes.body._id;
            const getRes = await request(app).get(`/exams/attempts/${attemptId}`);
            expect(getRes.body.answers[questionId].correct).toEqual([]);
            expect(getRes.body.questions[0].correctOptions).toEqual([]);
            expect(getRes.body.questions[0].explanation).toBeFalsy();

            // The exam owner still needs the real answer key to grade/review.
            (app as any).__asOwner();
            const ownerGetRes = await request(app).get(`/exams/attempts/${attemptId}`);
            expect(ownerGetRes.body.answers[questionId].correct).toEqual(['b']);
            expect(ownerGetRes.body.questions[0].correctOptions).toEqual(['b']);
            expect(ownerGetRes.body.questions[0].explanation).toBe('Correct answer: 4, because 2+2=4.');
        });

        it('exposes correctOptions on the submit response when revealAnswers is on', async () => {
            (app as any).__asOwner();
            const examRes = await request(app)
                .post('/exams')
                .send({ title: 'Revealed answers exam', revealAnswers: true });
            const examId = examRes.body._id;
            const qRes = await request(app)
                .post(`/exams/${examId}/questions`)
                .send({
                    type: 'MCQ',
                    questionText: 'What is 2 + 2?',
                    options: [
                        { id: 'a', text: '3' },
                        { id: 'b', text: '4' },
                    ],
                    correctOptions: ['b'],
                    marks: 1,
                });
            const questionId = qRes.body.questions[0].id;
            await request(app)
                .patch(`/exams/${examId}`)
                .send({ eligibility: { mode: 'none' }, published: true });

            (app as any).__asStudent();
            await request(app).post(`/exams/${examId}/attempts/start`).send({});
            const submitRes = await request(app)
                .post(`/exams/${examId}/attempts`)
                .send({ responses: [] });
            expect(submitRes.status).toBe(201);
            expect(submitRes.body.answers[questionId].correct).toEqual(['b']);
        });
    });

    describe('UpdateQuestionBody correctOptions validation', () => {
        it('rejects clearing correctOptions to empty via PATCH', async () => {
            (app as any).__asOwner();
            const examRes = await request(app).post('/exams').send({ title: 'Question edit test exam' });
            const examId = examRes.body._id;
            const qRes = await request(app)
                .post(`/exams/${examId}/questions`)
                .send({
                    type: 'MCQ',
                    questionText: 'What is 2 + 2?',
                    options: [
                        { id: 'a', text: '3' },
                        { id: 'b', text: '4' },
                    ],
                    correctOptions: ['b'],
                    marks: 1,
                });
            const questionId = qRes.body.questions[0].id;

            const res = await request(app)
                .patch(`/exams/${examId}/questions/${questionId}`)
                .send({ correctOptions: [] });
            expect(res.status).toBe(400);
        });
    });

    describe('Exam scheduling window validation', () => {
        it('rejects creating an exam where closesAt is before opensAt', async () => {
            (app as any).__asOwner();
            const now = Date.now();
            const res = await request(app)
                .post('/exams')
                .send({ title: 'Bad window exam', opensAt: now + 60_000, closesAt: now });
            expect(res.status).toBe(400);
        });

        it('rejects patching closesAt earlier than an already-stored opensAt', async () => {
            (app as any).__asOwner();
            const now = Date.now();
            const examRes = await request(app)
                .post('/exams')
                .send({ title: 'Window patch test exam', opensAt: now, closesAt: now + 3_600_000 });
            const examId = examRes.body._id;

            const res = await request(app)
                .patch(`/exams/${examId}`)
                .send({ closesAt: now - 60_000 });
            expect(res.status).toBe(400);
        });
    });
});
