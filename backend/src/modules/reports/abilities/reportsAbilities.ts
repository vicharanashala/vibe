import {
  AuthenticatedUser,
  AuthenticatedUserEnrollements,
  ICourse,
  IReport,
} from '#root/shared/index.js';
import { AbilityBuilder, MongoAbility } from '@casl/ability';
import { ReportPermissionSubject } from '../constants.js';
import { createAbilityBuilder } from '#root/modules/notifications/abilities/types.js';

export enum ReportsActions {
  Manage = 'manage',
  Create = 'create',
  Modify = 'modify',
  Delete = 'delete',
  View = 'view',
}

export async function setupReportsAbilities(
  builder: AbilityBuilder<any>,
  user: AuthenticatedUser,
) {
  const { can, cannot } = builder;

  if (user.globalRole == 'admin') {
    can(ReportsActions.Manage, ReportPermissionSubject.REPORT);
    return;
  }

  // It will ensure the student can only report on enrolled course
  user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
    if (enrollment.role === 'STUDENT') {
      can(ReportsActions.Create, ReportPermissionSubject.REPORT, {
        courseId: enrollment.courseId,
        versionId: enrollment.versionId,
        reportedBy: user.userId,
      });
    }
  });

  // I am considering that, in the instructor dashboard, we should display only those reports that belong to the courses instructed by the respective instructor

  const isInstructor = user.enrollments.some(e => e.role === 'INSTRUCTOR');
  const isManager = user.enrollments.some(e => e.role === 'MANAGER');

  if (isInstructor || isManager) {
    const instructorId = user.userId;

    const instructorCourses = []; // Need to fetch this from db

    const courseIds = instructorCourses.map((c: ICourse) => c._id.toString());

    if (isInstructor) {
      can(ReportsActions.View, ReportPermissionSubject.REPORT, {
        courseId: {$in: courseIds},
      });

      can(ReportsActions.Modify, ReportPermissionSubject.REPORT, {
        courseId: {$in: courseIds},
      });

      cannot(ReportsActions.Delete, ReportPermissionSubject.REPORT, {
        courseId: {$in: courseIds},
      });
    }

    if (isManager) {
      can(ReportsActions.View, ReportPermissionSubject.REPORT, {
        courseId: {$in: courseIds},
      });

      can(ReportsActions.Modify, ReportPermissionSubject.REPORT, {
        courseId: {$in: courseIds},
      });

      cannot(ReportsActions.Delete, ReportPermissionSubject.REPORT, {
        courseId: {$in: courseIds},
      });
    }
  }
}

// Get report ablities for a user - ready to use in controller
export function getReportAbility(user: AuthenticatedUser): MongoAbility<any> {
  const builder = createAbilityBuilder();
  setupReportsAbilities(builder, user);
  return builder.build();
}
