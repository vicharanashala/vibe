import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  isDemoStudentEmail,
  studentDisplay,
  courseDisplay,
  questionDisplay,
  seedSchedule,
  getSchedule,
  getCourseRetention,
  submitReview,
  skipReview,
  boostReview,
  setRemediationHint,
  setPaused,
  setExamPrepMode,
  assignReview,
  getAssignableQuestions,
  getStudentSRStatus,
  setStudentSRDisabled,
  bulkSetStudentSRDisabled,
} from './spaced-repetition-api';

describe('Spaced Repetition: Client API Layer (spaced-repetition-api.ts)', () => {
  const originalFetch = globalThis.fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Display & Utility Functions', () => {
    it('isDemoStudentEmail identifies demo student accounts', () => {
      expect(isDemoStudentEmail('student@test.com')).toBe(true);
      expect(isDemoStudentEmail('other.user@domain.com')).toBe(false);
      expect(isDemoStudentEmail(null)).toBe(false);
      expect(isDemoStudentEmail(undefined)).toBe(false);
    });

    it('studentDisplay resolves known and fallback student IDs', () => {
      const known = studentDisplay('stu-helper-002');
      expect(known.name).toBe('Arjun Mehta');
      expect(known.email).toBe('arjun.m@test.com');

      const unknown = studentDisplay('random-student-id');
      expect(unknown.name).toBe('Student random');
      expect(unknown.email).toBe('random@unknown.local');
    });

    it('courseDisplay resolves known courses and provides fallbacks', () => {
      const course1 = courseDisplay('mock-course-1');
      expect(course1.name).toBe('Demo Spaced Repetition Course');

      const fallback = courseDisplay('custom-course-xyz');
      expect(fallback.name).toBe('Course custom-c');
    });

    it('questionDisplay returns metadata for catalogue questions', () => {
      const q = questionDisplay('mock-question-1');
      expect(q).not.toBeNull();
      expect(q?.body).toBeTruthy();

      const unknown = questionDisplay('non-existent-question');
      expect(unknown).toBeNull();
    });
  });

  describe('Student Review & Scheduling API Calls', () => {
    it('seedSchedule sends POST to /api/spaced-repetition/:studentId/seed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ seeded: 3 }),
      });

      const res = await seedSchedule('student-1', 'course-1', ['q1', 'q2', 'q3']);
      expect(res.seeded).toBe(3);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/spaced-repetition/student-1/seed'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ courseId: 'course-1', questionIds: ['q1', 'q2', 'q3'] }),
        }),
      );
    });

    it('getSchedule sends GET to /api/spaced-repetition/:studentId/schedule', async () => {
      const dummySchedule = [
        {
          _id: 'item-1',
          student_id: 'student-1',
          course_id: 'course-1',
          question_id: 'q1',
          EF: 2.5,
          n: 1,
          interval_days: 1,
          next_review_at: new Date().toISOString(),
          last_reviewed_at: null,
          notification_opt_out: false,
        },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => dummySchedule,
      });

      const schedule = await getSchedule('student-1');
      expect(schedule).toEqual(dummySchedule);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/spaced-repetition/student-1/schedule'),
        expect.anything(),
      );
    });

    it('getCourseRetention sends GET to /api/spaced-repetition/:studentId/course/:courseId', async () => {
      const dummyRetention = {
        courseId: 'course-1',
        totalItems: 10,
        dueItems: 2,
        retentionScore: 85,
        avgEF: 2.4,
        nextReviewAt: new Date().toISOString(),
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => dummyRetention,
      });

      const retention = await getCourseRetention('student-1', 'course-1');
      expect(retention).toEqual(dummyRetention);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/spaced-repetition/student-1/course/course-1'),
        expect.anything(),
      );
    });

    it('submitReview sends POST to /api/spaced-repetition/:studentId/review with quality and answers', async () => {
      const dummyResponse = {
        item: { _id: 'item-1', EF: 2.6, n: 2, interval_days: 6 },
        qualityAdjusted: false,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => dummyResponse,
      });

      const res = await submitReview(
        'student-1',
        'q-1',
        'got_it',
        [2],
      );

      expect(res).toEqual(dummyResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/spaced-repetition/student-1/review'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            questionId: 'q-1',
            quality: 'got_it',
            selectedOptionIndices: [2],
            numericAnswer: undefined,
          }),
        }),
      );
    });

    it('skipReview fails open if backend endpoint is unavailable', async () => {
      const res = await skipReview('student-1', 'q-1');
      expect(res).toEqual({ ok: true });
    });

    it('boostReview sends POST to /api/spaced-repetition/:studentId/boost', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, message: 'Card boosted' }),
      });

      const res = await boostReview('student-1', 'q-1');
      expect(res.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/spaced-repetition/student-1/boost'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ questionId: 'q-1' }),
        }),
      );
    });
  });

  describe('Teacher Controls & Bulk Actions', () => {
    it('setRemediationHint sends PATCH to /api/spaced-repetition/:studentId/remediation-hint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ questionId: 'q-1', remediation_hint: 'Review chapter 3' }),
      });

      const res = await setRemediationHint('student-1', 'q-1', 'Review chapter 3');
      expect(res.remediation_hint).toBe('Review chapter 3');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/spaced-repetition/student-1/remediation-hint'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ questionId: 'q-1', hint: 'Review chapter 3' }),
        }),
      );
    });

    it('setPaused sends PATCH to /api/spaced-repetition/bulk/pause', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ updatedCount: 1, studentsAffected: 1, itemsAffected: 1, message: 'Paused' }),
      });

      await setPaused('student-1', 'course-1', true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/spaced-repetition/bulk/pause'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ courseId: 'course-1', studentIds: ['student-1'], paused: true }),
        }),
      );
    });

    it('setExamPrepMode sends PATCH to /api/spaced-repetition/bulk/exam-prep', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ updatedCount: 1, studentsAffected: 1, itemsAffected: 1, message: 'Exam mode enabled' }),
      });

      await setExamPrepMode('student-1', 'course-1', true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/spaced-repetition/bulk/exam-prep'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ courseId: 'course-1', studentIds: ['student-1'], enabled: true }),
        }),
      );
    });

    it('getStudentSRStatus sends GET to /api/spaced-repetition/students/:studentId/status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ studentId: 'student-1', sr_disabled: false }),
      });

      const status = await getStudentSRStatus('student-1');
      expect(status.sr_disabled).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/spaced-repetition/students/student-1/status'),
        expect.anything(),
      );
    });

    it('setStudentSRDisabled sends PATCH to /api/spaced-repetition/students/:studentId/sr-disabled', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ studentId: 'student-1', sr_disabled: true, message: 'Disabled' }),
      });

      await setStudentSRDisabled('student-1', true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/spaced-repetition/students/student-1/sr-disabled'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ sr_disabled: true }),
        }),
      );
    });

    it('bulkSetStudentSRDisabled sends PATCH to /api/spaced-repetition/bulk/sr-disabled', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, count: 2 }),
      });

      await bulkSetStudentSRDisabled(['student-1', 'student-2'], true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/spaced-repetition/bulk/sr-disabled'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ studentIds: ['student-1', 'student-2'], sr_disabled: true }),
        }),
      );
    });

    it('getAssignableQuestions sends GET to /api/spaced-repetition/courses/:courseId/assignable-questions', async () => {
      const mockQuestions = [
        { id: 'q-10', body: 'What is O(1)?', type: 'SELECT_ONE_IN_LOT', fromCourse: true, bankIds: ['bank-1'] },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuestions,
      });

      const questions = await getAssignableQuestions('course-1');
      expect(questions).toEqual(mockQuestions);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/spaced-repetition/courses/course-1/assignable-questions'),
        expect.anything(),
      );
    });

    it('assignReview sends POST to /api/spaced-repetition/:studentId/assign', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, itemId: 'new-item-id' }),
      });

      const res = await assignReview({
        studentId: 'student-1',
        courseId: 'course-1',
        questionId: 'q-10',
      });

      expect(res.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/spaced-repetition/student-1/assign'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            questionId: 'q-10',
            courseId: 'course-1',
          }),
        }),
      );
    });

    it('throws descriptive error when API returns non-200 status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden: Student has opted out of spaced repetition',
      });

      await expect(getSchedule('student-1')).rejects.toThrow('API error 403');
    });
  });
});
