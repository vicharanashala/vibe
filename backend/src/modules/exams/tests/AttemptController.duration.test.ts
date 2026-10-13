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
 * Regression coverage for `AttemptService.submitAttempt` never checking
 * `exam.duration` against real elapsed time — a student who disabled the
 * client-side countdown (or just let it drift) could previously submit a
 * scored attempt no matter how long they'd actually been in the exam.
 */
describe('Exams module — AttemptController duration enforcement', { timeout: 30000 }, () => {
    const appInstance = Express();
    let app: any;
    let db: MongoDatabase;
    const userId = '000000000000000000000003';

    beforeAll(async () => {
        process.env.NODE_ENV = 'test';
        const container = new Container();
        await container.load(sharedContainerModule, examsContainerModule, usersContainerModule);
        const inversifyAdapter = new InversifyAdapter(container);
        useContainer(inversifyAdapter);
        db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
        await db.connect();

        const options: RoutingControllersOptions = {
            controllers: examsModuleOptions.controllers,
            authorizationChecker: async () => true,
            defaultErrorHandler: true,
            validation: true,
            currentUserChecker: async () => ({
                _id: userId,
                firebaseUID: 'test-uid-duration',
                email: 'duration_test_user@example.com',
                firstName: 'Duration',
                lastName: 'Tester',
                roles: 'user' as const,
            }),
        };
        app = useExpressServer(appInstance, options);
    }, 900000);

    const createExamWithQuestion = async (duration: number, extra: Record<string, unknown> = {}) => {
        const examRes = await request(app)
            .post('/exams')
            .send({ title: 'Duration test exam', duration, ...extra });
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
            });

        return examId;
    };

    // Backdates the server-recorded start time directly in
    // `examAttemptStarts` (the collection `AttemptStartRepository` owns) to
    // simulate real elapsed time, since `startAttempt` itself always stamps
    // `Date.now()` and no longer trusts any client-supplied value.
    const backdateStart = async (examId: string, startedAt: number) => {
        const collection = await db.getCollection('examAttemptStarts');
        await collection.updateOne(
            { examId, studentId: userId },
            { $set: { startedAt } },
        );
    };

    it('rejects a submission that never called the start endpoint', async () => {
        const examId = await createExamWithQuestion(30);
        const res = await request(app).post(`/exams/${examId}/attempts`).send({ responses: [] });
        expect(res.status).toBe(403);
    });

    it('rejects a submission arriving long after exam.duration has elapsed', async () => {
        const examId = await createExamWithQuestion(30);
        await request(app).post(`/exams/${examId}/attempts/start`).send({});
        // Backdated to 2 hours ago, well past the 30-minute duration plus
        // grace — pre-fix, a client reporting this as its own startedAt was
        // accepted unconditionally.
        await backdateStart(examId, Date.now() - 2 * 60 * 60 * 1000);
        const res = await request(app).post(`/exams/${examId}/attempts`).send({ responses: [] });
        expect(res.status).toBe(403);
    });

    it('accepts a submission within exam.duration', async () => {
        const examId = await createExamWithQuestion(30);
        await request(app).post(`/exams/${examId}/attempts/start`).send({});
        await backdateStart(examId, Date.now() - 5 * 60 * 1000);
        const res = await request(app).post(`/exams/${examId}/attempts`).send({ responses: [] });
        expect(res.status).toBe(201);
    });

    it('start is idempotent — a later call returns the original timestamp', async () => {
        const examId = await createExamWithQuestion(30);
        const first = await request(app).post(`/exams/${examId}/attempts/start`).send({});
        const second = await request(app).post(`/exams/${examId}/attempts/start`).send({});
        expect(first.body.startedAt).toBe(second.body.startedAt);
    });

    it('clears the server-recorded start time after a successful submit, so a retake gets a fresh one', async () => {
        // Regression coverage: AttemptStartRepository has a permanent
        // unique index on (examId, studentId). Without clearing the record
        // on a successful submit, a retake's `/start` call would keep
        // returning attempt #1's timestamp forever — so a retake started
        // long after the first attempt would have its duration measured
        // from the wrong (already-expired) clock instead of a fresh one.
        const examId = await createExamWithQuestion(30, { allowRetakes: true });

        const startRes = await request(app).post(`/exams/${examId}/attempts/start`).send({});
        expect(startRes.body.startedAt).toBeTypeOf('number');
        const submitRes = await request(app).post(`/exams/${examId}/attempts`).send({ responses: [] });
        expect(submitRes.status).toBe(201);

        const collection = await db.getCollection('examAttemptStarts');
        const stored = await collection.findOne({ examId, studentId: userId });
        expect(stored).toBeNull();

        // The next `/start` call (the retake) must stamp a brand new
        // timestamp rather than finding nothing has changed.
        const retakeStartRes = await request(app).post(`/exams/${examId}/attempts/start`).send({});
        expect(retakeStartRes.body.startedAt).toBeTypeOf('number');
        expect(retakeStartRes.body.startedAt).toBeGreaterThanOrEqual(startRes.body.startedAt);
    });

    it('honors extra minutes from a time grant this student redeemed', async () => {
        const examId = await createExamWithQuestion(10);

        const grantRes = await request(app)
            .post(`/exams/${examId}/time-grants`)
            .send({ minutes: 60, note: 'accommodation' });
        const code = grantRes.body.timeGrants[0].code;

        const redeemRes = await request(app)
            .post(`/exams/${examId}/redeem-grant`)
            .send({ code });
        expect(redeemRes.body.ok).toBe(true);

        await request(app).post(`/exams/${examId}/attempts/start`).send({});
        // 40 minutes elapsed: past the 10-minute base duration, but well
        // within 10 + 60 granted minutes.
        await backdateStart(examId, Date.now() - 40 * 60 * 1000);
        const res = await request(app).post(`/exams/${examId}/attempts`).send({ responses: [] });
        expect(res.status).toBe(201);
    });
});
