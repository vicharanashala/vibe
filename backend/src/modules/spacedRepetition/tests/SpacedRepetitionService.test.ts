import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { SpacedRepetitionService } from '../services/SpacedRepetitionService.js';
import { DEFAULT_SM2_STATE, IReviewItem } from '../interfaces/IReviewItem.js';
import { ForbiddenError, NotFoundError } from 'routing-controllers';

describe('SpacedRepetitionService: End-to-End Module Orchestration', () => {
  let service: SpacedRepetitionService;
  let mockReviewItemRepo: any;
  let mockStudentSRStatusRepo: any;
  let mockQuestionBankRepo: any;
  let mockQuestionRepo: any;
  let mockCourseRepo: any;
  let mockUserRepo: any;
  let mockDb: any;
  let mockUsersCollection: any;

  const STUDENT_ID = 'student_test_101';
  const COURSE_ID = 'course_test_202';
  const QUESTION_ID = 'question_test_303';
  const ITEM_ID = new ObjectId('000000000000000000000001');

  beforeEach(() => {
    vi.clearAllMocks();

    mockUsersCollection = {
      findOne: vi.fn().mockResolvedValue({ _id: 'u1', firebaseUID: STUDENT_ID, email: 'student@test.com' }),
    };

    mockDb = {
      getClient: vi.fn(),
      getCollection: vi.fn().mockResolvedValue(mockUsersCollection),
    };

    mockReviewItemRepo = {
      findByStudent: vi.fn().mockResolvedValue([]),
      findByStudentAndCourse: vi.fn().mockResolvedValue([]),
      findByStudentAndQuestion: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((item: any) => Promise.resolve({ _id: 'item_id_1', ...item })),
      createMany: vi.fn().mockImplementation((items: any[]) => Promise.resolve(items.length)),
      update: vi.fn().mockImplementation((_id: string, updates: any) => Promise.resolve({ _id, ...updates })),
      updateExamPrepBulk: vi.fn().mockResolvedValue({ modifiedCount: 5, distinctStudentsModified: 2 }),
      updatePauseBulk: vi.fn().mockResolvedValue({ modifiedCount: 4, distinctStudentsModified: 2 }),
      updateNotificationOptOutBulk: vi.fn().mockResolvedValue({ modifiedCount: 1, distinctStudentsModified: 1 }),
      findDueByStudent: vi.fn().mockResolvedValue([]),
    };

    mockStudentSRStatusRepo = {
      getStatus: vi.fn().mockResolvedValue(false),
      setStatus: vi.fn().mockResolvedValue(true),
      setStatusForMany: vi.fn().mockResolvedValue({ matchedCount: 2, modifiedCount: 2 }),
      getStatusForMany: vi.fn().mockResolvedValue(new Map()),
    };

    mockQuestionBankRepo = {
      findById: vi.fn(),
      findByCourseId: vi.fn().mockResolvedValue([]),
    };

    mockQuestionRepo = {
      getById: vi.fn().mockResolvedValue({
        _id: QUESTION_ID,
        type: 'SELECT_ONE_IN_LOT',
        incorrectLotItems: [{ _id: 'opt_wrong' }],
        correctLotItem: { _id: 'opt_right' },
        solution: { lotItemId: 'opt_right' },
      }),
      findById: vi.fn(),
    };

    mockCourseRepo = {
      findById: vi.fn().mockResolvedValue({ _id: COURSE_ID, title: 'Machine Learning' }),
    };

    mockUserRepo = {
      findById: vi.fn().mockResolvedValue({ _id: STUDENT_ID, firstName: 'Aarav', email: 'aarav@test.com' }),
    };

    // Instantiate service with mocked dependencies
    service = new SpacedRepetitionService(
      mockDb,
      mockReviewItemRepo,
      mockStudentSRStatusRepo,
      mockQuestionBankRepo,
      mockQuestionRepo,
      mockCourseRepo,
      mockUserRepo,
    );

    // Bypass MongoDB replica set transaction wrapper for unit testing
    (service as any)._withTransaction = vi.fn().mockImplementation(async (op: any) => {
      const mockSession = {} as any;
      return op(mockSession);
    });
  });

  describe('Student Status & SR Disable Toggle (Teacher / Student control)', () => {
    it('returns sr_disabled: false by default when no status record exists', async () => {
      mockStudentSRStatusRepo.getStatus.mockResolvedValueOnce(false);
      const isOff = await service.getStudentSRStatus(STUDENT_ID);
      expect(isOff).toBe(false);
    });

    it('returns true when student has opted out / teacher disabled SR', async () => {
      mockStudentSRStatusRepo.getStatus.mockResolvedValueOnce(true);
      const isOff = await service.getStudentSRStatus(STUDENT_ID);
      expect(isOff).toBe(true);
    });

    it('updates single student SR disabled status', async () => {
      mockStudentSRStatusRepo.setStatus.mockResolvedValueOnce(true);

      const res = await service.setStudentSRStatus(STUDENT_ID, true);
      expect(res.sr_disabled).toBe(true);
      expect(mockStudentSRStatusRepo.setStatus).toHaveBeenCalledWith(STUDENT_ID, true, expect.anything());
    });

    it('bulk updates multiple students SR status (Teacher Cohort Control)', async () => {
      const studentIds = ['student_1', 'student_2'];
      const res = await service.bulkSetStudentSRStatus(studentIds, true);

      expect(res.studentsAffected).toBe(2);
      expect(res.itemsAffected).toBe(2);
      expect(mockStudentSRStatusRepo.setStatusForMany).toHaveBeenCalledWith(studentIds, true, expect.anything());
    });
  });

  describe('Auto-Seeding on Course / Quiz Completion', () => {
    it('seeds new ReviewItems with default SM-2 state for eligible questions', async () => {
      const questionIds = ['q1', 'q2'];
      mockReviewItemRepo.findByStudentAndCourse.mockResolvedValueOnce([]);

      const res = await service.seedSchedule(STUDENT_ID, COURSE_ID, questionIds);
      expect(res.seeded).toBe(2);
      expect(mockReviewItemRepo.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            student_id: STUDENT_ID,
            course_id: COURSE_ID,
            question_id: 'q1',
            n: 0,
            EF: DEFAULT_SM2_STATE.EF,
            source: 'auto-seed',
          }),
        ]),
        expect.anything(),
      );
    });

    it('does not re-seed if items already exist for this student and course', async () => {
      mockReviewItemRepo.findByStudentAndCourse.mockResolvedValueOnce([
        { _id: 'item_1', student_id: STUDENT_ID, course_id: COURSE_ID } as any,
      ]);

      const res = await service.seedSchedule(STUDENT_ID, COURSE_ID, ['q1', 'q2']);
      expect(res.seeded).toBe(0);
      expect(mockReviewItemRepo.createMany).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when attempting to seed for a student with SR disabled', async () => {
      mockStudentSRStatusRepo.getStatus.mockResolvedValueOnce(true);

      await expect(
        service.seedSchedule(STUDENT_ID, COURSE_ID, ['q1']),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('Course Retention Metrics & Schedule Queries', () => {
    it('calculates retention summary correctly', async () => {
      const past = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago (overdue)
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24); // 1 day future

      const items: Partial<IReviewItem>[] = [
        { _id: '1', EF: 2.6, next_review_at: past, is_paused: false, exam_prep_mode: false } as any,
        { _id: '2', EF: 2.4, next_review_at: future, is_paused: false, exam_prep_mode: false } as any,
      ];
      mockReviewItemRepo.findByStudentAndCourse.mockResolvedValueOnce(items);

      const retention = await service.getCourseRetention(STUDENT_ID, COURSE_ID);
      expect(retention.totalItems).toBe(2);
      expect(retention.overdueCount).toBe(1);
      expect(retention.averageEF).toBeCloseTo(2.5, 2);
    });
  });

  describe('Submit Review: Answer Processing & Algorithmic Updates', () => {
    it('throws NotFoundError if the review item does not exist', async () => {
      mockReviewItemRepo.findByStudentAndQuestion.mockResolvedValueOnce(null);

      await expect(
        service.submitReview(STUDENT_ID, QUESTION_ID, 'got_it'),
      ).rejects.toThrow(NotFoundError);
    });

    it('progresses SM-2 on correct answer (got_it)', async () => {
      const initialItem: Partial<IReviewItem> = {
        _id: ITEM_ID,
        student_id: STUDENT_ID,
        course_id: COURSE_ID,
        question_id: QUESTION_ID,
        n: 1,
        EF: 2.5,
        interval_days: 1,
        is_paused: false,
        exam_prep_mode: false,
      };
      mockReviewItemRepo.findByStudentAndQuestion.mockResolvedValueOnce(initialItem);

      const res = await service.submitReview(STUDENT_ID, QUESTION_ID, 'got_it');
      expect(res.item).toBeDefined();
      expect(mockReviewItemRepo.update).toHaveBeenCalledWith(
        ITEM_ID.toString(),
        expect.objectContaining({
          n: 2,
          interval_days: 6,
        }),
        expect.anything(),
      );
    });

    it('resets interval to 1 day on missed review', async () => {
      const initialItem: Partial<IReviewItem> = {
        _id: ITEM_ID,
        student_id: STUDENT_ID,
        course_id: COURSE_ID,
        question_id: QUESTION_ID,
        n: 3,
        EF: 2.5,
        interval_days: 15,
        is_paused: false,
        exam_prep_mode: false,
      };
      mockReviewItemRepo.findByStudentAndQuestion.mockResolvedValueOnce(initialItem);

      await service.submitReview(STUDENT_ID, QUESTION_ID, 'missed');
      expect(mockReviewItemRepo.update).toHaveBeenCalledWith(
        ITEM_ID.toString(),
        expect.objectContaining({
          n: 0,
          interval_days: 1,
        }),
        expect.anything(),
      );
    });

    it('forces interval reset when objective MCQ answer is wrong even if got_it was clicked', async () => {
      const initialItem: Partial<IReviewItem> = {
        _id: ITEM_ID,
        student_id: STUDENT_ID,
        course_id: COURSE_ID,
        question_id: QUESTION_ID,
        n: 2,
        EF: 2.5,
        interval_days: 6,
        is_paused: false,
        exam_prep_mode: false,
      };
      mockReviewItemRepo.findByStudentAndQuestion.mockResolvedValueOnce(initialItem);

      const res = await service.submitReview(
        STUDENT_ID,
        QUESTION_ID,
        'got_it',
        [0], // student picks option 0 (opt_wrong), canonical correct is option 1
      );

      expect(res.qualityAdjusted).toBe(true);
      expect(res.qualityAdjustedFrom).toBe('got_it');

      // SM-2 invariant override: wrong pick MUST reset interval to 1 and n to 0
      expect(mockReviewItemRepo.update).toHaveBeenCalledWith(
        ITEM_ID.toString(),
        expect.objectContaining({
          n: 0,
          interval_days: 1,
        }),
        expect.anything(),
      );
    });
  });

  describe('Teacher Controls: Bulk Pause, Exam Prep, Remediation Hints, and Manual Assignment', () => {
    it('bulkUpdatePause toggles pause flag across cohort students', async () => {
      mockReviewItemRepo.updatePauseBulk.mockResolvedValueOnce({
        modifiedCount: 4,
        distinctStudentsModified: 2,
      });

      const res = await service.bulkUpdatePause(['stu1', 'stu2'], COURSE_ID, true);
      expect(res.itemsAffected).toBe(4);
      expect(res.studentsAffected).toBe(2);
      expect(mockReviewItemRepo.updatePauseBulk).toHaveBeenCalledWith(
        ['stu1', 'stu2'],
        COURSE_ID,
        true,
        expect.anything(),
      );
    });

    it('bulkUpdateExamPrepMode compresses intervals for upcoming exams', async () => {
      mockReviewItemRepo.updateExamPrepBulk.mockResolvedValueOnce({
        modifiedCount: 5,
        distinctStudentsModified: 2,
      });

      const res = await service.bulkUpdateExamPrepMode(['stu1', 'stu2'], COURSE_ID, true);
      expect(res.itemsAffected).toBe(5);
      expect(res.studentsAffected).toBe(2);
      expect(mockReviewItemRepo.updateExamPrepBulk).toHaveBeenCalledWith(
        ['stu1', 'stu2'],
        COURSE_ID,
        true,
        expect.anything(),
      );
    });

    it('setRemediationHint attaches a teacher hint to a student review card', async () => {
      const initialItem: Partial<IReviewItem> = {
        _id: ITEM_ID,
        student_id: STUDENT_ID,
        question_id: QUESTION_ID,
      };
      mockReviewItemRepo.findByStudentAndQuestion.mockResolvedValueOnce(initialItem);

      const res = await service.setRemediationHint(
        STUDENT_ID,
        QUESTION_ID,
        'Remember to consider boundary conditions',
      );

      expect(res.questionId).toBe(QUESTION_ID);
      expect(res.remediation_hint).toBe('Remember to consider boundary conditions');
      expect(mockReviewItemRepo.update).toHaveBeenCalledWith(
        ITEM_ID.toString(),
        expect.objectContaining({
          remediation_hint: 'Remember to consider boundary conditions',
        }),
        expect.anything(),
      );
    });

    it('assignReview manually pushes a question to a student queue and auto-enables SR if disabled', async () => {
      mockStudentSRStatusRepo.getStatus.mockResolvedValueOnce(true);
      mockReviewItemRepo.findByStudentAndQuestion.mockResolvedValueOnce(null);

      const res = await service.assignReview(
        STUDENT_ID,
        QUESTION_ID,
        COURSE_ID,
      );

      expect(res.autoEnabled).toBe(true);
      expect(mockStudentSRStatusRepo.setStatus).toHaveBeenCalledWith(STUDENT_ID, false, expect.anything());
      expect(mockReviewItemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          student_id: STUDENT_ID,
          course_id: COURSE_ID,
          question_id: QUESTION_ID,
          source: 'manual',
        }),
        expect.anything(),
      );
    });
  });
});
