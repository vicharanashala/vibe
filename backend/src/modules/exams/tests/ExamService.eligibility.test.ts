import { describe, it, expect, beforeAll } from 'vitest';
import { ObjectId } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { EnrollmentRepository } from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import { IUser } from '#shared/interfaces/models.js';
import { ExamRepository } from '../repositories/providers/mongodb/ExamRepository.js';
import { ExamImageStorageService } from '../services/ExamImageStorageService.js';
import { ExamService } from '../services/ExamService.js';
import { IExam, IExamEligibility } from '../classes/transformers/Exam.js';

/**
 * Service-level tests for ExamService.isEligibleForStudent (exercised
 * through the public getExamForUser, since the method itself is private).
 * No eligibility test file existed before this one -- only mode 'none' was
 * covered, indirectly, in AttemptController.security.test.ts's publish-gate
 * block. Covers all 4 modes, not just the new 'cohort' one, since none of
 * the others had direct coverage either.
 *
 * Runs against the in-memory Mongo replica set started in
 * test/globalSetup.ts, instantiating the service/repos directly (no DI
 * container, no HTTP layer) -- same technique as
 * EnrollmentRepository.courseCompletions.test.ts.
 */
describe('ExamService.isEligibleForStudent', () => {
    let db: MongoDatabase;
    let examService: ExamService;
    let examRepo: ExamRepository;
    let enrollmentRepo: EnrollmentRepository;

    const ownerId = new ObjectId().toHexString();
    const courseId = new ObjectId();
    const courseVersionId = new ObjectId();
    const cohortId = new ObjectId();
    const otherCohortId = new ObjectId();

    beforeAll(async () => {
        db = new MongoDatabase(process.env.DB_URL, 'exam_service_eligibility_test');
        await db.connect();
        examRepo = new ExamRepository(db);
        enrollmentRepo = new EnrollmentRepository(db);
        examService = new ExamService(examRepo, new ExamImageStorageService(), enrollmentRepo);
    }, 90000);

    function makeStudentUser(overrides: Partial<IUser> = {}): IUser {
        return {
            _id: new ObjectId().toHexString(),
            firebaseUID: `test-uid-${Math.random()}`,
            email: `student-${Math.random()}@example.com`,
            firstName: 'Test',
            lastName: 'Student',
            roles: 'user',
            ...overrides,
        };
    }

    async function makeExam(eligibility: IExamEligibility | undefined): Promise<IExam> {
        const now = Date.now();
        return examRepo.create({
            title: 'Eligibility test exam',
            duration: 30,
            passingMarks: 1,
            negativeMarking: false,
            negativeMarkingScheme: { MCQ: 'none', MSQ: 'none', NAT: 'none' },
            instructions: '',
            published: true,
            eligibility,
            createdBy: ownerId,
            createdAt: now,
            updatedAt: now,
            questions: [],
            timeGrants: [],
        });
    }

    async function isEligible(exam: IExam, user: IUser): Promise<boolean> {
        try {
            await examService.getExamForUser(exam._id!.toString(), user);
            return true;
        } catch {
            return false;
        }
    }

    async function insertEnrollment(overrides: Record<string, unknown>) {
        const enrollments = await db.getCollection('enrollment');
        await enrollments.insertOne({
            userId: new ObjectId(),
            courseId,
            courseVersionId,
            role: 'STUDENT',
            status: 'ACTIVE',
            enrollmentDate: new Date(),
            percentCompleted: 0,
            isDeleted: false,
            ...overrides,
        } as any);
    }

    it('mode absent (no rule at all): not eligible', async () => {
        const exam = await makeExam(undefined);
        expect(await isEligible(exam, makeStudentUser())).toBe(false);
    });

    it('mode "none": eligible', async () => {
        const exam = await makeExam({ mode: 'none' });
        expect(await isEligible(exam, makeStudentUser())).toBe(true);
    });

    describe('mode "manual"', () => {
        it('email in allowedEmails (case-insensitive): eligible', async () => {
            const exam = await makeExam({ mode: 'manual', allowedEmails: ['Allowed@Example.com'] });
            expect(await isEligible(exam, makeStudentUser({ email: 'allowed@example.com' }))).toBe(true);
        });

        it('email not in allowedEmails: not eligible', async () => {
            const exam = await makeExam({ mode: 'manual', allowedEmails: ['allowed@example.com'] });
            expect(await isEligible(exam, makeStudentUser({ email: 'someone-else@example.com' }))).toBe(false);
        });
    });

    describe('mode "completion"', () => {
        it('percentCompleted above minCompletionPercent: eligible', async () => {
            const user = makeStudentUser();
            await insertEnrollment({ userId: new ObjectId(user._id!.toString()), courseId, courseVersionId, percentCompleted: 90 });
            const exam = await makeExam({ mode: 'completion', courseId: courseId.toString(), courseVersionId: courseVersionId.toString(), minCompletionPercent: 80 });
            expect(await isEligible(exam, user)).toBe(true);
        });

        it('percentCompleted below minCompletionPercent: not eligible', async () => {
            const user = makeStudentUser();
            await insertEnrollment({ userId: new ObjectId(user._id!.toString()), courseId, courseVersionId, percentCompleted: 40 });
            const exam = await makeExam({ mode: 'completion', courseId: courseId.toString(), courseVersionId: courseVersionId.toString(), minCompletionPercent: 80 });
            expect(await isEligible(exam, user)).toBe(false);
        });

        it('no courseVersionId scoping: matches enrollment in a different version of the same course', async () => {
            const user = makeStudentUser();
            const otherVersionId = new ObjectId();
            await insertEnrollment({ userId: new ObjectId(user._id!.toString()), courseId, courseVersionId: otherVersionId, percentCompleted: 100 });
            const exam = await makeExam({ mode: 'completion', courseId: courseId.toString(), minCompletionPercent: 80 });
            expect(await isEligible(exam, user)).toBe(true);
        });

        it('missing courseId/minCompletionPercent on the rule: fails closed', async () => {
            const user = makeStudentUser();
            await insertEnrollment({ userId: new ObjectId(user._id!.toString()), courseId, courseVersionId, percentCompleted: 100 });
            const exam = await makeExam({ mode: 'completion' } as IExamEligibility);
            expect(await isEligible(exam, user)).toBe(false);
        });
    });

    describe('mode "cohort"', () => {
        it('enrollment cohortId matches rule.cohortId: eligible', async () => {
            const user = makeStudentUser();
            await insertEnrollment({ userId: new ObjectId(user._id!.toString()), cohortId });
            const exam = await makeExam({ mode: 'cohort', courseVersionId: courseVersionId.toString(), cohortId: cohortId.toString() });
            expect(await isEligible(exam, user)).toBe(true);
        });

        it('enrollment in a different cohort: not eligible', async () => {
            const user = makeStudentUser();
            await insertEnrollment({ userId: new ObjectId(user._id!.toString()), cohortId: otherCohortId });
            const exam = await makeExam({ mode: 'cohort', courseVersionId: courseVersionId.toString(), cohortId: cohortId.toString() });
            expect(await isEligible(exam, user)).toBe(false);
        });

        it('no enrollment at all for that course version: not eligible', async () => {
            const user = makeStudentUser();
            const exam = await makeExam({ mode: 'cohort', courseVersionId: courseVersionId.toString(), cohortId: cohortId.toString() });
            expect(await isEligible(exam, user)).toBe(false);
        });

        it('enrollment with no cohortId (legacy pre-cohort row): not eligible', async () => {
            const user = makeStudentUser();
            await insertEnrollment({ userId: new ObjectId(user._id!.toString()) });
            const exam = await makeExam({ mode: 'cohort', courseVersionId: courseVersionId.toString(), cohortId: cohortId.toString() });
            expect(await isEligible(exam, user)).toBe(false);
        });

        it('a soft-deleted enrollment whose cohortId would otherwise match: not eligible', async () => {
            const user = makeStudentUser();
            await insertEnrollment({ userId: new ObjectId(user._id!.toString()), cohortId, isDeleted: true });
            const exam = await makeExam({ mode: 'cohort', courseVersionId: courseVersionId.toString(), cohortId: cohortId.toString() });
            expect(await isEligible(exam, user)).toBe(false);
        });

        it('rule missing cohortId/courseVersionId: fails closed', async () => {
            const user = makeStudentUser();
            await insertEnrollment({ userId: new ObjectId(user._id!.toString()), cohortId });
            const exam = await makeExam({ mode: 'cohort' } as IExamEligibility);
            expect(await isEligible(exam, user)).toBe(false);
        });

        it('cohort matches, minCompletionPercent unset: eligible regardless of percentCompleted', async () => {
            const user = makeStudentUser();
            await insertEnrollment({ userId: new ObjectId(user._id!.toString()), cohortId, percentCompleted: 0 });
            const exam = await makeExam({ mode: 'cohort', courseVersionId: courseVersionId.toString(), cohortId: cohortId.toString() });
            expect(await isEligible(exam, user)).toBe(true);
        });

        it('cohort matches, percentCompleted at/above minCompletionPercent: eligible', async () => {
            const user = makeStudentUser();
            await insertEnrollment({ userId: new ObjectId(user._id!.toString()), cohortId, percentCompleted: 80 });
            const exam = await makeExam({ mode: 'cohort', courseVersionId: courseVersionId.toString(), cohortId: cohortId.toString(), minCompletionPercent: 80 });
            expect(await isEligible(exam, user)).toBe(true);
        });

        it('cohort matches, percentCompleted below minCompletionPercent: not eligible', async () => {
            const user = makeStudentUser();
            await insertEnrollment({ userId: new ObjectId(user._id!.toString()), cohortId, percentCompleted: 40 });
            const exam = await makeExam({ mode: 'cohort', courseVersionId: courseVersionId.toString(), cohortId: cohortId.toString(), minCompletionPercent: 80 });
            expect(await isEligible(exam, user)).toBe(false);
        });

        it('cohort does not match even though percentCompleted meets minCompletionPercent: not eligible', async () => {
            const user = makeStudentUser();
            await insertEnrollment({ userId: new ObjectId(user._id!.toString()), cohortId: otherCohortId, percentCompleted: 100 });
            const exam = await makeExam({ mode: 'cohort', courseVersionId: courseVersionId.toString(), cohortId: cohortId.toString(), minCompletionPercent: 80 });
            expect(await isEligible(exam, user)).toBe(false);
        });
    });

    it('owner always sees their own exam regardless of eligibility', async () => {
        const exam = await makeExam(undefined);
        const owner: IUser = { _id: ownerId, firebaseUID: 'owner-uid', email: 'owner@example.com', firstName: 'Owner', roles: 'user' };
        expect(await isEligible(exam, owner)).toBe(true);
    });

    it('admin always sees any exam regardless of eligibility', async () => {
        const exam = await makeExam(undefined);
        expect(await isEligible(exam, makeStudentUser({ roles: 'admin' }))).toBe(true);
    });
});
