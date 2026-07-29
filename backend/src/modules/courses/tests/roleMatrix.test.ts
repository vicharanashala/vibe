import {describe, expect, it} from 'vitest';
import {subject} from '@casl/ability';
import {
  CourseActions,
  getCourseAbility,
} from '../abilities/courseAbilities.js';
import {
  CourseVersionActions,
  getCourseVersionAbility,
} from '../abilities/versionAbilities.js';
import {AuthenticatedUser} from '#root/shared/interfaces/models.js';

/**
 * The agreed role model:
 *   Admins and instructors have the same permissions, except
 *     1. admins reach every course, instructors only their own;
 *     2. only admins may create or delete a course (or a course version).
 */

const COURSE = 'course-a';
const VERSION = 'version-a';
const OTHER_COURSE = 'course-b';
const OTHER_VERSION = 'version-b';

const admin: AuthenticatedUser = {
  userId: 'u-admin',
  globalRole: 'admin',
  enrollments: [],
};

const enrolledAs = (role: any): AuthenticatedUser => ({
  userId: `u-${role}`,
  globalRole: 'user',
  enrollments: [{courseId: COURSE, versionId: VERSION, role}],
});

const instructor = enrolledAs('INSTRUCTOR');
const manager = enrolledAs('MANAGER');
const student = enrolledAs('STUDENT');
const ta = enrolledAs('TA');

const ownCourse = subject('Course', {courseId: COURSE});
const otherCourse = subject('Course', {courseId: OTHER_COURSE});
const ownVersion = subject('CourseVersion', {versionId: VERSION});
const otherVersion = subject('CourseVersion', {versionId: OTHER_VERSION});

describe('Role matrix: admin vs instructor', () => {
  describe('Rule 2 — only admins create or delete courses', () => {
    it('lets only an admin create a course', () => {
      // Checked against the bare subject type, the way the controller does:
      // a course being created has no id yet.
      expect(getCourseAbility(admin).can(CourseActions.Create, 'Course')).toBe(
        true,
      );
      for (const user of [instructor, manager, student, ta]) {
        expect(
          getCourseAbility(user).can(CourseActions.Create, 'Course'),
        ).toBe(false);
      }
    });

    it('lets only an admin delete a course', () => {
      expect(getCourseAbility(admin).can(CourseActions.Delete, ownCourse)).toBe(
        true,
      );
      for (const user of [instructor, manager, student, ta]) {
        expect(
          getCourseAbility(user).can(CourseActions.Delete, ownCourse),
        ).toBe(false);
      }
    });

    it('lets only an admin create a course version', () => {
      // This is the gate the clone endpoint uses, and cloning creates an
      // entire new course.
      expect(
        getCourseVersionAbility(admin).can(
          CourseVersionActions.Create,
          'CourseVersion',
        ),
      ).toBe(true);
      for (const user of [instructor, manager, student, ta]) {
        expect(
          getCourseVersionAbility(user).can(
            CourseVersionActions.Create,
            'CourseVersion',
          ),
        ).toBe(false);
      }
    });

    it('lets only an admin delete or archive a course version', () => {
      const adminAbility = getCourseVersionAbility(admin);
      expect(adminAbility.can(CourseVersionActions.Delete, ownVersion)).toBe(true);
      expect(adminAbility.can(CourseVersionActions.Archive, ownVersion)).toBe(true);

      for (const user of [instructor, manager]) {
        const ability = getCourseVersionAbility(user);
        expect(ability.can(CourseVersionActions.Delete, ownVersion)).toBe(false);
        expect(ability.can(CourseVersionActions.Archive, ownVersion)).toBe(false);
      }
    });
  });

  describe('Rule 1 — instructors match admins, but only in their own courses', () => {
    it('grants an instructor everything else on their own course', () => {
      const ability = getCourseAbility(instructor);
      expect(ability.can(CourseActions.View, ownCourse)).toBe(true);
      expect(ability.can(CourseActions.Modify, ownCourse)).toBe(true);
    });

    it('grants an instructor everything but delete/archive on their own version', () => {
      const ability = getCourseVersionAbility(instructor);
      expect(ability.can(CourseVersionActions.View, ownVersion)).toBe(true);
      expect(ability.can(CourseVersionActions.Modify, ownVersion)).toBe(true);
    });

    it('denies an instructor any access to a course they are not enrolled in', () => {
      const ability = getCourseAbility(instructor);
      expect(ability.can(CourseActions.View, otherCourse)).toBe(false);
      expect(ability.can(CourseActions.Modify, otherCourse)).toBe(false);
      expect(
        getCourseVersionAbility(instructor).can(
          CourseVersionActions.Modify,
          otherVersion,
        ),
      ).toBe(false);
    });

    it('gives an admin every course, including ones they are not enrolled in', () => {
      const ability = getCourseAbility(admin);
      expect(ability.can(CourseActions.View, otherCourse)).toBe(true);
      expect(ability.can(CourseActions.Modify, otherCourse)).toBe(true);
      expect(
        getCourseVersionAbility(admin).can(
          CourseVersionActions.Modify,
          otherVersion,
        ),
      ).toBe(true);
    });

    it('leaves instructors and managers with the same course-level rights', () => {
      const i = getCourseAbility(instructor);
      const m = getCourseAbility(manager);
      for (const action of [CourseActions.View, CourseActions.Modify]) {
        expect(i.can(action, ownCourse)).toBe(m.can(action, ownCourse));
      }
    });
  });

  describe('Export is an admin and manager capability, held at course level', () => {
    it('lets an admin export any course', () => {
      const ability = getCourseAbility(admin);
      expect(ability.can(CourseActions.Export, ownCourse)).toBe(true);
      expect(ability.can(CourseActions.Export, otherCourse)).toBe(true);
    });

    it('lets a manager export their own course but not another', () => {
      const ability = getCourseAbility(manager);
      expect(ability.can(CourseActions.Export, ownCourse)).toBe(true);
      expect(ability.can(CourseActions.Export, otherCourse)).toBe(false);
    });

    it('denies instructors, TAs and students', () => {
      for (const user of [instructor, ta, student]) {
        expect(
          getCourseAbility(user).can(CourseActions.Export, ownCourse),
        ).toBe(false);
      }
    });

    it('does not let an instructor inherit export from their manage grant', () => {
      // Regression guard: instructors hold `manage` on their own course, which
      // covers every action unless export is denied explicitly.
      const ability = getCourseAbility(instructor);
      expect(ability.can(CourseActions.Modify, ownCourse)).toBe(true);
      expect(ability.can(CourseActions.Export, ownCourse)).toBe(false);
    });

    it('still lets someone export a course they manage while instructing another', () => {
      const both: AuthenticatedUser = {
        userId: 'u-both',
        globalRole: 'user',
        enrollments: [
          {courseId: COURSE, versionId: VERSION, role: 'INSTRUCTOR'} as any,
          {
            courseId: OTHER_COURSE,
            versionId: OTHER_VERSION,
            role: 'MANAGER',
          } as any,
        ],
      };
      const ability = getCourseAbility(both);
      expect(ability.can(CourseActions.Export, otherCourse)).toBe(true);
      expect(ability.can(CourseActions.Export, ownCourse)).toBe(false);
    });
  });

  describe('Students and TAs are unaffected', () => {
    it('keeps students read-only on their own course', () => {
      const ability = getCourseAbility(student);
      expect(ability.can(CourseActions.View, ownCourse)).toBe(true);
      expect(ability.can(CourseActions.Modify, ownCourse)).toBe(false);
    });

    it('keeps TAs without course-level write access', () => {
      const ability = getCourseAbility(ta);
      expect(ability.can(CourseActions.Modify, ownCourse)).toBe(false);
      expect(
        getCourseVersionAbility(ta).can(CourseVersionActions.View, ownVersion),
      ).toBe(true);
    });
  });
});
