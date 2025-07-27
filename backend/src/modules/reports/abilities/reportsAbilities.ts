import {
  AuthenticatedUser,
  AuthenticatedUserEnrollements,
  ICourse,
  IReport,
} from '#root/shared/index.js';
import {AbilityBuilder, MongoAbility} from '@casl/ability';
import {ReportPermissionSubject} from '../constants.js';
import {createAbilityBuilder} from '#root/modules/notifications/abilities/types.js';

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
  const {can, cannot} = builder;

  if (user.globalRole == 'admin') {
    can(ReportsActions.Manage, ReportPermissionSubject.REPORT);
    return;
  }

  user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
    const versionBounded: Partial<IReport> = {
      courseId: enrollment.courseId,
      versionId: enrollment.versionId,
    };
    const userBounded: Partial<IReport> = {
      reportedBy: user.userId,
    };
    const courseBounded: Partial<IReport> = {
      courseId: enrollment.courseId,
    };

    switch (enrollment.role) {
      case 'STUDENT':
        can(ReportsActions.Create, ReportPermissionSubject.REPORT, {
          ...versionBounded,
          ...userBounded,
        });
        break;
      case 'INSTRUCTOR':
        can(ReportsActions.View, ReportPermissionSubject.REPORT, courseBounded);
        can(
          ReportsActions.Modify,
          ReportPermissionSubject.REPORT,
          courseBounded,
        );
        cannot(
          ReportsActions.Delete,
          ReportPermissionSubject.REPORT,
          courseBounded,
        );
        break;
      case 'MANAGER':
        can(
          ReportsActions.Manage,
          ReportPermissionSubject.REPORT,
          courseBounded,
        );
        cannot(
          ReportsActions.Delete,
          ReportPermissionSubject.REPORT,
          courseBounded,
        );

        break;
      case 'TA':
        break;
    }
  });
}

// Get report ablities for a user - ready to use in controller
export function getReportAbility(user: AuthenticatedUser): MongoAbility<any> {
  const builder = createAbilityBuilder();
  setupReportsAbilities(builder, user);
  return builder.build();
}
