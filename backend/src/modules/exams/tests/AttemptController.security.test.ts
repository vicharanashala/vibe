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

    describe('Exam content redaction for students', () => {
        const createRedactionExam = async (windowFields: Record<string, unknown> = {}) => {
            (app as any).__asOwner();
            const examRes = await request(app)
                .post('/exams')
                .send({ title: 'Redaction test exam', ...windowFields });
            const examId = examRes.body._id;
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
                    explanation: 'Correct answer: 4, because 2+2=4.',
                });
            await request(app)
                .patch(`/exams/${examId}`)
                .send({ eligibility: { mode: 'none' }, published: true });
            return examId;
        };

        it('always strips correctOptions/explanation for a student, window open or unset', async () => {
            const examId = await createRedactionExam();

            (app as any).__asStudent();
            const res = await request(app).get(`/exams/${examId}`);
            expect(res.status).toBe(200);
            expect(res.body.questions[0].correctOptions).toEqual([]);
            expect(res.body.questions[0].explanation).toBeFalsy();
            // Question content itself is still readable -- the student is
            // inside the (unbounded) window, just never gets the answer key.
            expect(res.body.questions[0].questionText).toBe('What is 2 + 2?');
            expect(res.body.questions[0].options).toHaveLength(2);

            (app as any).__asOwner();
            const ownerRes = await request(app).get(`/exams/${examId}`);
            expect(ownerRes.body.questions[0].correctOptions).toEqual(['b']);
        });

        it('also strips question content for a student before opensAt', async () => {
            const now = Date.now();
            const examId = await createRedactionExam({ opensAt: now + 3_600_000, closesAt: now + 7_200_000 });

            (app as any).__asStudent();
            const res = await request(app).get(`/exams/${examId}`);
            expect(res.status).toBe(200);
            expect(res.body.questions[0].correctOptions).toEqual([]);
            expect(res.body.questions[0].questionText).toBe('');
            expect(res.body.questions[0].options).toEqual([]);
            // Metadata a "not open yet" UI needs still comes through.
            expect(res.body.title).toBe('Redaction test exam');
            expect(res.body.opensAt).toBe(now + 3_600_000);
            expect(res.body.closesAt).toBe(now + 7_200_000);
            expect(res.body.questions).toHaveLength(1);
            expect(res.body.questions[0].marks).toBe(1);

            (app as any).__asOwner();
            const ownerRes = await request(app).get(`/exams/${examId}`);
            expect(ownerRes.body.questions[0].questionText).toBe('What is 2 + 2?');
        });

        it('also strips question content for a student after closesAt', async () => {
            const now = Date.now();
            const examId = await createRedactionExam({ opensAt: now - 7_200_000, closesAt: now - 3_600_000 });

            (app as any).__asStudent();
            const res = await request(app).get(`/exams/${examId}`);
            expect(res.status).toBe(200);
            expect(res.body.questions[0].correctOptions).toEqual([]);
            expect(res.body.questions[0].questionText).toBe('');
            expect(res.body.questions[0].options).toEqual([]);
            expect(res.body.questions).toHaveLength(1);

            (app as any).__asOwner();
            const ownerRes = await request(app).get(`/exams/${examId}`);
            expect(ownerRes.body.questions[0].questionText).toBe('What is 2 + 2?');
        });

        it('applies the same redaction to GET /exams/published', async () => {
            const now = Date.now();
            const examId = await createRedactionExam({ opensAt: now + 3_600_000, closesAt: now + 7_200_000 });

            (app as any).__asStudent();
            const res = await request(app).get('/exams/published');
            expect(res.status).toBe(200);
            const listed = res.body.find((e: any) => e._id === examId);
            expect(listed).toBeTruthy();
            expect(listed.questions[0].correctOptions).toEqual([]);
            expect(listed.questions[0].questionText).toBe('');
            expect(listed.questions).toHaveLength(1);
            expect(listed.questions[0].marks).toBe(1);
            expect(listed.opensAt).toBe(now + 3_600_000);
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

    describe('Question negativeMarks/correctOptions/options validation', () => {
        it('rejects a question whose negativeMarks exceeds its own marks (the live-repro scenario)', async () => {
            (app as any).__asOwner();
            const examRes = await request(app).post('/exams').send({ title: 'Overpenalty test exam' });
            const examId = examRes.body._id;
            // The exact shape that produced a live 0/101 score before this fix:
            // a 100-mark correct question would have been dragged to 0 by one
            // 1-mark question carrying a 1000-point custom penalty. Now rejected
            // at creation instead of being reachable at all.
            const res = await request(app)
                .post(`/exams/${examId}/questions`)
                .send({
                    type: 'MCQ',
                    questionText: 'Low marks, huge custom penalty',
                    options: [{ id: 'a', text: 'wrong' }, { id: 'b', text: 'right' }],
                    correctOptions: ['b'],
                    marks: 1,
                    useCustomNegative: true,
                    negativeMarks: 1000,
                });
            expect(res.status).toBe(400);
        });

        it('rejects a PATCH that pushes negativeMarks above the question\'s existing marks', async () => {
            (app as any).__asOwner();
            const examRes = await request(app).post('/exams').send({ title: 'Patch overpenalty test exam' });
            const examId = examRes.body._id;
            const qRes = await request(app)
                .post(`/exams/${examId}/questions`)
                .send({
                    type: 'MCQ',
                    questionText: 'Ok for now',
                    options: [{ id: 'a', text: 'wrong' }, { id: 'b', text: 'right' }],
                    correctOptions: ['b'],
                    marks: 1,
                    useCustomNegative: true,
                    negativeMarks: 1,
                });
            const questionId = qRes.body.questions[0].id;

            const res = await request(app)
                .patch(`/exams/${examId}/questions/${questionId}`)
                .send({ negativeMarks: 5 });
            expect(res.status).toBe(400);
        });

        it('rejects a bulk-add batch containing one overpenalized question, with no partial write', async () => {
            (app as any).__asOwner();
            const examRes = await request(app).post('/exams').send({ title: 'Bulk overpenalty test exam' });
            const examId = examRes.body._id;

            const res = await request(app)
                .post(`/exams/${examId}/questions/bulk`)
                .send({
                    questions: [
                        {
                            type: 'MCQ',
                            questionText: 'Fine question',
                            options: [{ id: 'a', text: 'wrong' }, { id: 'b', text: 'right' }],
                            correctOptions: ['b'],
                            marks: 5,
                        },
                        {
                            type: 'MCQ',
                            questionText: 'Bad question',
                            options: [{ id: 'a', text: 'wrong' }, { id: 'b', text: 'right' }],
                            correctOptions: ['b'],
                            marks: 1,
                            useCustomNegative: true,
                            negativeMarks: 1000,
                        },
                    ],
                });
            expect(res.status).toBe(400);

            const examAfter = await request(app).get(`/exams/${examId}`);
            expect(examAfter.body.questions).toHaveLength(0);
        });

        it('rejects correctOptions referencing an option id that does not exist', async () => {
            (app as any).__asOwner();
            const examRes = await request(app).post('/exams').send({ title: 'Bad correctOptions test exam' });
            const examId = examRes.body._id;
            const res = await request(app)
                .post(`/exams/${examId}/questions`)
                .send({
                    type: 'MCQ',
                    questionText: 'Unanswerable question',
                    options: [{ id: 'a', text: 'x' }, { id: 'b', text: 'y' }],
                    correctOptions: ['z'],
                    marks: 1,
                });
            expect(res.status).toBe(400);
        });

        it('rejects duplicate option ids on the same question', async () => {
            (app as any).__asOwner();
            const examRes = await request(app).post('/exams').send({ title: 'Duplicate option id test exam' });
            const examId = examRes.body._id;
            const res = await request(app)
                .post(`/exams/${examId}/questions`)
                .send({
                    type: 'MCQ',
                    questionText: 'Ambiguous options',
                    options: [{ id: 'a', text: 'x' }, { id: 'a', text: 'y' }],
                    correctOptions: ['a'],
                    marks: 1,
                });
            expect(res.status).toBe(400);
        });

        it('rejects field lengths past the new caps', async () => {
            (app as any).__asOwner();
            const examRes = await request(app).post('/exams').send({ title: 'Length cap test exam' });
            const examId = examRes.body._id;
            const baseQuestion = {
                type: 'MCQ' as const,
                options: [{ id: 'a', text: 'x' }, { id: 'b', text: 'y' }],
                correctOptions: ['a'],
                marks: 1,
            };

            const overLongQuestionText = await request(app)
                .post(`/exams/${examId}/questions`)
                .send({ ...baseQuestion, questionText: 'x'.repeat(10001) });
            expect(overLongQuestionText.status).toBe(400);

            const overLongExplanation = await request(app)
                .post(`/exams/${examId}/questions`)
                .send({ ...baseQuestion, questionText: 'ok', explanation: 'x'.repeat(10001) });
            expect(overLongExplanation.status).toBe(400);

            const overLongOptionText = await request(app)
                .post(`/exams/${examId}/questions`)
                .send({
                    ...baseQuestion,
                    questionText: 'ok',
                    options: [{ id: 'a', text: 'x'.repeat(2001) }, { id: 'b', text: 'y' }],
                });
            expect(overLongOptionText.status).toBe(400);

            const overLongInstructions = await request(app)
                .patch(`/exams/${examId}`)
                .send({ instructions: 'x'.repeat(20001) });
            expect(overLongInstructions.status).toBe(400);
        });
    });

    describe('Rate limiting', () => {
        it('429s a burst of startAttempt calls past the configured max', async () => {
            (app as any).__asOwner();
            const examRes = await request(app).post('/exams').send({ title: 'Rate limit start test exam' });
            const examId = examRes.body._id;
            await addQuestion(examId);
            await request(app)
                .patch(`/exams/${examId}`)
                .send({ eligibility: { mode: 'none' }, published: true });

            (app as any).__asStudent();
            // Comfortably above max:30 even accounting for this file's earlier
            // tests sharing the same per-IP bucket (no Authorization header is
            // ever set in this test harness, so keyGenerator falls back to
            // req.ip for every request in the file).
            const results = await Promise.all(
                Array.from({ length: 40 }, () => request(app).post(`/exams/${examId}/attempts/start`).send({})),
            );
            expect(results.some((r) => r.status === 429)).toBe(true);
        });

        it('429s a burst of submitAttempt calls past the configured max', async () => {
            (app as any).__asOwner();
            const examRes = await request(app)
                .post('/exams')
                .send({ title: 'Rate limit submit test exam', allowRetakes: true });
            const examId = examRes.body._id;
            await addQuestion(examId);
            await request(app)
                .patch(`/exams/${examId}`)
                .send({ eligibility: { mode: 'none' }, published: true });

            (app as any).__asStudent();
            await request(app).post(`/exams/${examId}/attempts/start`).send({});
            // allowRetakes: true so repeated submissions on one exam aren't
            // themselves rejected by the no-retakes lock, isolating this test
            // to the rate limiter specifically. Comfortably above max:20 for
            // the same shared-bucket reason as the startAttempt burst above.
            const results = await Promise.all(
                Array.from({ length: 30 }, () =>
                    request(app).post(`/exams/${examId}/attempts`).send({ responses: [] }),
                ),
            );
            expect(results.some((r) => r.status === 429)).toBe(true);
        });
    });

    describe('Proctoring payload limits', () => {
        it('rejects more than 300 proctoringEvents in one submission', async () => {
            (app as any).__asOwner();
            const examRes = await request(app)
                .post('/exams')
                .send({ title: 'Too many proctoring events test exam' });
            const examId = examRes.body._id;
            await addQuestion(examId);
            await request(app)
                .patch(`/exams/${examId}`)
                .send({ eligibility: { mode: 'none' }, published: true });

            (app as any).__asStudent();
            await request(app).post(`/exams/${examId}/attempts/start`).send({});
            const res = await request(app)
                .post(`/exams/${examId}/attempts`)
                .send({
                    responses: [],
                    proctoringEvents: Array.from({ length: 301 }, (_, i) => ({ type: 'no-face', at: Date.now() + i })),
                });
            expect(res.status).toBe(400);
        });

        it('rejects a proctoring event imageDataUrl over 100,000 characters', async () => {
            (app as any).__asOwner();
            const examRes = await request(app)
                .post('/exams')
                .send({ title: 'Oversized proctoring image test exam' });
            const examId = examRes.body._id;
            await addQuestion(examId);
            await request(app)
                .patch(`/exams/${examId}`)
                .send({ eligibility: { mode: 'none' }, published: true });

            (app as any).__asStudent();
            await request(app).post(`/exams/${examId}/attempts/start`).send({});
            const res = await request(app)
                .post(`/exams/${examId}/attempts`)
                .send({
                    responses: [],
                    proctoringEvents: [{ type: 'no-face', at: Date.now(), imageDataUrl: 'x'.repeat(100_001) }],
                });
            expect(res.status).toBe(400);
        });
    });

    describe('Publish gate on question count', () => {
        it('rejects publishing an exam with no questions', async () => {
            (app as any).__asOwner();
            const examRes = await request(app).post('/exams').send({ title: 'Zero-question publish test' });
            const examId = examRes.body._id;

            const res = await request(app).patch(`/exams/${examId}`).send({ published: true });
            expect(res.status).toBe(400);
        });

        it('allows publishing once the exam has at least one question', async () => {
            (app as any).__asOwner();
            const examRes = await request(app).post('/exams').send({ title: 'One-question publish test' });
            const examId = examRes.body._id;
            await addQuestion(examId);

            const res = await request(app).patch(`/exams/${examId}`).send({ published: true });
            expect(res.status).toBe(200);
            expect(res.body.published).toBe(true);
        });
    });

    describe('Clearing opensAt/closesAt', () => {
        it('actually clears both fields when patched to null', async () => {
            (app as any).__asOwner();
            const now = Date.now();
            const examRes = await request(app)
                .post('/exams')
                .send({ title: 'Window clear test exam', opensAt: now + 3_600_000, closesAt: now + 7_200_000 });
            const examId = examRes.body._id;

            const clearRes = await request(app)
                .patch(`/exams/${examId}`)
                .send({ opensAt: null, closesAt: null });
            expect(clearRes.status).toBe(200);
            expect(clearRes.body.opensAt).toBeFalsy();
            expect(clearRes.body.closesAt).toBeFalsy();

            const refetch = await request(app).get(`/exams/${examId}`);
            expect(refetch.body.opensAt).toBeFalsy();
            expect(refetch.body.closesAt).toBeFalsy();
        });
    });

    describe('MCQ/MSQ option count validation', () => {
        it('rejects a question created with fewer than 2 options', async () => {
            (app as any).__asOwner();
            const examRes = await request(app).post('/exams').send({ title: 'Single-option create test exam' });
            const examId = examRes.body._id;

            const res = await request(app)
                .post(`/exams/${examId}/questions`)
                .send({
                    type: 'MCQ',
                    questionText: 'Only one option',
                    options: [{ id: 'a', text: 'x' }],
                    correctOptions: ['a'],
                    marks: 1,
                });
            expect(res.status).toBe(400);
        });

        it('rejects a PATCH that drops an existing question below 2 options', async () => {
            (app as any).__asOwner();
            const examRes = await request(app).post('/exams').send({ title: 'Single-option patch test exam' });
            const examId = examRes.body._id;
            const qRes = await request(app)
                .post(`/exams/${examId}/questions`)
                .send({
                    type: 'MCQ',
                    questionText: 'Starts with 2 options',
                    options: [{ id: 'a', text: 'x' }, { id: 'b', text: 'y' }],
                    correctOptions: ['a'],
                    marks: 1,
                });
            const questionId = qRes.body.questions[0].id;

            const res = await request(app)
                .patch(`/exams/${examId}/questions/${questionId}`)
                .send({ options: [{ id: 'a', text: 'x' }] });
            expect(res.status).toBe(400);
        });
    });

    describe('Proctoring heartbeat', () => {
        it('is a no-op (200) when pinged before the attempt was ever started', async () => {
            (app as any).__asOwner();
            const examRes = await request(app).post('/exams').send({ title: 'Heartbeat before start test exam' });
            const examId = examRes.body._id;
            await addQuestion(examId);
            await request(app)
                .patch(`/exams/${examId}`)
                .send({ eligibility: { mode: 'none' }, published: true });

            (app as any).__asStudent();
            const res = await request(app).post(`/exams/${examId}/attempts/heartbeat`).send({});
            expect(res.status).toBe(200);
        });

        it('succeeds after the attempt was started', async () => {
            (app as any).__asOwner();
            const examRes = await request(app).post('/exams').send({ title: 'Heartbeat after start test exam' });
            const examId = examRes.body._id;
            await addQuestion(examId);
            await request(app)
                .patch(`/exams/${examId}`)
                .send({ eligibility: { mode: 'none' }, published: true });

            (app as any).__asStudent();
            await request(app).post(`/exams/${examId}/attempts/start`).send({});
            const res = await request(app).post(`/exams/${examId}/attempts/heartbeat`).send({});
            expect(res.status).toBe(200);
        });

        it('429s a burst of heartbeat calls past the configured max', async () => {
            (app as any).__asOwner();
            const examRes = await request(app).post('/exams').send({ title: 'Heartbeat rate limit test exam' });
            const examId = examRes.body._id;
            await addQuestion(examId);
            await request(app)
                .patch(`/exams/${examId}`)
                .send({ eligibility: { mode: 'none' }, published: true });

            (app as any).__asStudent();
            await request(app).post(`/exams/${examId}/attempts/start`).send({});
            // Comfortably above max:10 for the same shared-bucket reason as
            // the other rate-limit burst tests in this file.
            const results = await Promise.all(
                Array.from({ length: 20 }, () => request(app).post(`/exams/${examId}/attempts/heartbeat`).send({})),
            );
            expect(results.some((r) => r.status === 429)).toBe(true);
        });

        it('never flags a fast test-speed attempt (well under the grace window) even with zero heartbeats', async () => {
            (app as any).__asOwner();
            const examRes = await request(app).post('/exams').send({ title: 'Fast attempt no-flag test exam' });
            const examId = examRes.body._id;
            await request(app).patch(`/exams/${examId}`).send({
                proctoring: { detectors: [{ detectorName: 'cameraMic', enabled: true }] },
            });
            await addQuestion(examId);
            await request(app)
                .patch(`/exams/${examId}`)
                .send({ eligibility: { mode: 'none' }, published: true });

            (app as any).__asStudent();
            await request(app).post(`/exams/${examId}/attempts/start`).send({});
            // No heartbeat calls at all -- same shape as the original live
            // bypass -- but submitted immediately, well under the 90s grace
            // window, so this must NOT be flagged.
            const res = await request(app)
                .post(`/exams/${examId}/attempts`)
                .send({ responses: [], tabSwitches: 0, proctoringEvents: [] });
            expect(res.status).toBe(201);
            expect(res.body.proctoringSuspicious).toBeFalsy();
        });
    });

    describe('minSubmitTime enforcement', () => {
        it('rejects an immediate submission when the exam requires a minimum time on it', async () => {
            (app as any).__asOwner();
            const examRes = await request(app)
                .post('/exams')
                .send({ title: 'Min submit time test exam', minSubmitTime: 120 });
            const examId = examRes.body._id;
            await addQuestion(examId);
            await request(app)
                .patch(`/exams/${examId}`)
                .send({ eligibility: { mode: 'none' }, published: true });

            (app as any).__asStudent();
            await request(app).post(`/exams/${examId}/attempts/start`).send({});
            const res = await request(app)
                .post(`/exams/${examId}/attempts`)
                .send({ responses: [], tabSwitches: 0, proctoringEvents: [] });
            expect(res.status).toBe(403);
            expect(res.body.message).toContain('You must spend at least');
        });

        it('does not reject an immediate submission when no minSubmitTime is configured', async () => {
            (app as any).__asOwner();
            const examRes = await request(app).post('/exams').send({ title: 'No min submit time test exam' });
            const examId = examRes.body._id;
            await addQuestion(examId);
            await request(app)
                .patch(`/exams/${examId}`)
                .send({ eligibility: { mode: 'none' }, published: true });

            (app as any).__asStudent();
            await request(app).post(`/exams/${examId}/attempts/start`).send({});
            const res = await request(app)
                .post(`/exams/${examId}/attempts`)
                .send({ responses: [], tabSwitches: 0, proctoringEvents: [] });
            expect(res.status).toBe(201);
        });
    });
});
