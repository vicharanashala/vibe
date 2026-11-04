import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CourseMentorController } from '../controllers/CourseMentorController.js';
import { IUser } from '#root/shared/interfaces/models.js';

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// The controller's only external dep is `CourseRepository` and a few
// audit-trail utilities. We mock the repo and stub the audit trail
// to keep these tests focused on the controller's logic — admin gate,
// 404 handling, idempotency, response shape.

const fakeCourseId = '64b7f1f9e4d2f91b7c9a1e23';
const fakeUserId = '64b7f1f9e4d2f91b7c9a9999';

const mockCourse = {
  _id: fakeCourseId,
  name: 'Mentor Test Course',
  description: 'Test course for mentor management',
  versions: [],
  instructors: [],
  mentorIds: [],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const mockRepo = {
  read: vi.fn(),
  updateMentors: vi.fn(),
  getMentorIds: vi.fn(),
};

const adminUser: IUser = {
  _id: fakeUserId as any,
  firebaseUID: 'admin-firebase-uid',
  email: 'admin@test.com',
  firstName: 'Admin',
  lastName: 'User',
  roles: 'admin',
} as unknown as IUser;

const teacherUser: IUser = {
  _id: fakeUserId as any,
  firebaseUID: 'teacher-firebase-uid',
  email: 'teacher@test.com',
  firstName: 'Teacher',
  lastName: 'User',
  roles: 'teacher',
} as unknown as IUser;

const studentUser: IUser = {
  _id: fakeUserId as any,
  firebaseUID: 'student-firebase-uid',
  email: 'student@test.com',
  firstName: 'Student',
  lastName: 'User',
  roles: 'user',
} as unknown as IUser;

// Mock the audit trail module so we don't write to a real audit collection
// during these tests. The import path matches the controller's static import.
vi.mock('#root/utils/setAuditTrail.js', () => ({
  setAuditTrail: vi.fn(),
}));

// ── Controller instance ──────────────────────────────────────────────────────

const controller = new CourseMentorController(mockRepo as any);

// ── Tests ───────────────────────────────────────────────────────────────────

describe('CourseMentorController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default happy-path mocks: course exists, update succeeds,
    // post-update read returns the new list.
    mockRepo.read.mockResolvedValue(mockCourse);
    mockRepo.updateMentors.mockResolvedValue({
      matchedCount: 1,
      modifiedCount: 1,
    });
    mockRepo.getMentorIds.mockResolvedValue([
      'user-a',
      'user-b',
    ]);
  });

  describe('admin-only gate', () => {
    it('lets an admin user add a mentor', async () => {
      const result = await controller.manageMentors(
        {courseId: fakeCourseId},
        {add: ['user-a'], remove: []},
        adminUser,
        {} as Request,
      );
      expect(result.courseId).toBe(fakeCourseId);
      expect(result.mentorIds).toEqual(['user-a', 'user-b']);
      expect(result.added).toEqual(['user-a']);
      expect(result.removed).toEqual([]);
      expect(result.matchedCount).toBe(1);
      expect(result.modifiedCount).toBe(1);
    });

    it('rejects a non-admin teacher with ForbiddenError', async () => {
      await expect(
        controller.manageMentors(
          {courseId: fakeCourseId},
          {add: ['user-a'], remove: []},
          teacherUser,
          {} as Request,
        ),
      ).rejects.toThrow(/Only admins can manage the course mentor list/);
      // Repo should NOT have been touched — gate fails before any DB call.
      expect(mockRepo.read).not.toHaveBeenCalled();
      expect(mockRepo.updateMentors).not.toHaveBeenCalled();
    });

    it('rejects a non-admin student with ForbiddenError', async () => {
      await expect(
        controller.manageMentors(
          {courseId: fakeCourseId},
          {add: ['user-a'], remove: []},
          studentUser,
          {} as Request,
        ),
      ).rejects.toThrow(/Only admins can manage the course mentor list/);
      expect(mockRepo.read).not.toHaveBeenCalled();
    });
  });

  describe('404 when course missing', () => {
    it('throws NotFoundError when the course does not exist', async () => {
      mockRepo.read.mockResolvedValue(null);
      await expect(
        controller.manageMentors(
          {courseId: fakeCourseId},
          {add: ['user-a'], remove: []},
          adminUser,
          {} as Request,
        ),
      ).rejects.toThrow(/No course found with id/);
      // The update should not have been attempted.
      expect(mockRepo.updateMentors).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the course disappears mid-update', async () => {
      // Course existed on the pre-check, but getMentorIds returns null
      // (defensive guard against the rare race).
      mockRepo.read.mockResolvedValue(mockCourse);
      mockRepo.updateMentors.mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1,
      });
      mockRepo.getMentorIds.mockResolvedValue(null);
      await expect(
        controller.manageMentors(
          {courseId: fakeCourseId},
          {add: ['user-a'], remove: []},
          adminUser,
          {} as Request,
        ),
      ).rejects.toThrow(/disappeared during mentor update/);
    });
  });

  describe('idempotency', () => {
    it('treats an empty body as a no-op', async () => {
      mockRepo.updateMentors.mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 0,
      });
      const result = await controller.manageMentors(
        {courseId: fakeCourseId},
        {},
        adminUser,
        {} as Request,
      );
      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([]);
      expect(result.modifiedCount).toBe(0);
      // updateMentors should still be called — the repo layer short-
      // circuits internally and returns a synthetic result, so the
      // controller doesn't need to special-case empties.
      expect(mockRepo.updateMentors).toHaveBeenCalledWith(
        fakeCourseId,
        [],
        [],
      );
    });

    it('accepts add + remove in the same body', async () => {
      const result = await controller.manageMentors(
        {courseId: fakeCourseId},
        {add: ['user-a'], remove: ['user-z']},
        adminUser,
        {} as Request,
      );
      expect(result.added).toEqual(['user-a']);
      expect(result.removed).toEqual(['user-z']);
      expect(mockRepo.updateMentors).toHaveBeenCalledWith(
        fakeCourseId,
        ['user-a'],
        ['user-z'],
      );
    });
  });

  describe('response shape', () => {
    it('returns the post-update mentorIds list as plain strings', async () => {
      mockRepo.getMentorIds.mockResolvedValue([
        '64b7f1f9e4d2f91b7c9a1e01',
        '64b7f1f9e4d2f91b7c9a1e02',
      ]);
      const result = await controller.manageMentors(
        {courseId: fakeCourseId},
        {add: ['64b7f1f9e4d2f91b7c9a1e01'], remove: []},
        adminUser,
        {} as Request,
      );
      expect(result.mentorIds).toEqual([
        '64b7f1f9e4d2f91b7c9a1e01',
        '64b7f1f9e4d2f91b7c9a1e02',
      ]);
      expect(typeof result.mentorIds[0]).toBe('string');
    });

    it('echoes the request add/remove arrays verbatim', async () => {
      const result = await controller.manageMentors(
        {courseId: fakeCourseId},
        {add: ['a', 'b', 'c'], remove: ['x', 'y']},
        adminUser,
        {} as Request,
      );
      expect(result.added).toEqual(['a', 'b', 'c']);
      expect(result.removed).toEqual(['x', 'y']);
    });
  });
});
