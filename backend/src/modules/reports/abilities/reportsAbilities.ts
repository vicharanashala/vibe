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
    const userBounded: Partial<IReport> = {
      reportedBy: user.userId,
    };

    const reportBounded: Partial<IReport> = {
      courseId: enrollment.courseId,
      versionId: enrollment.versionId,
    };

    switch (enrollment.role) {
      case 'STUDENT':
        can(ReportsActions.Create, ReportPermissionSubject.REPORT, {
          ...reportBounded,
          ...userBounded,
        });
        break;
      case 'INSTRUCTOR':
        can(ReportsActions.View, ReportPermissionSubject.REPORT);
        can(
          ReportsActions.Modify,
          ReportPermissionSubject.REPORT,
          reportBounded,
        );
        // cannot(
        //   ReportsActions.Delete,
        //   ReportPermissionSubject.REPORT,
        //   reportBounded,
        // );
        break;
      case 'MANAGER':
        can(ReportsActions.View, ReportPermissionSubject.REPORT);
      // cannot(ReportsActions.Delete, ReportPermissionSubject.REPORT, 
      //   reportBounded,
      // );
      case 'TA':
        can(ReportsActions.View, ReportPermissionSubject.REPORT);
        break;
    }
  })
}

// Get report ablities for a user - ready to use in controller
export function getReportAbility(user: AuthenticatedUser): MongoAbility<any> {
  const builder = createAbilityBuilder();
  setupReportsAbilities(builder, user);
  return builder.build();
}
