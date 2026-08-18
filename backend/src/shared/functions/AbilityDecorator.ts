import {getFromContainer, createParamDecorator} from 'routing-controllers';
import {AuthenticatedUser, AuthenticatedUserEnrollements} from '../interfaces/models.js';
import {FirebaseAuthService} from '#root/modules/auth/services/FirebaseAuthService.js';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';
import {MongoAbility} from '@casl/ability';
import {COHORT_SCOPED_ROLES} from './cohortScope.js';

const VALID_ENROLLMENT_ROLES = ['STUDENT', 'INSTRUCTOR', 'MANAGER', 'TA', 'STAFF'];

/**
 * `roles` on the raw user doc has been observed as either a scalar string or
 * an array; normalize defensively so an array-shaped value doesn't silently
 * fail a strict `=== 'admin'` check.
 */
function normalizeGlobalRole(roles: unknown): 'admin' | 'user' {
  const values = Array.isArray(roles) ? roles : [roles];
  return values.some(r => typeof r === 'string' && r.toLowerCase() === 'admin')
    ? 'admin'
    : 'user';
}

/**
 * Enrollment role values in the DB are inconsistently cased (and sometimes
 * null); normalize to the canonical uppercase enum so a stray `student` or
 * `instructor` doesn't fall through every ability switch with zero grants.
 */
function normalizeEnrollmentRole(
  role: unknown,
): AuthenticatedUserEnrollements['role'] | null {
  if (typeof role !== 'string') return null;
  const upper = role.toUpperCase();
  return VALID_ENROLLMENT_ROLES.includes(upper)
    ? (upper as AuthenticatedUserEnrollements['role'])
    : null;
}

/**
 * Derive the cohorts an enrollment confines its holder to.
 *
 * Staff fail *open*: an instructor with no assignment stays unscoped and keeps
 * the course-wide reach they have today, so the wall goes up only once an
 * administrator assigns cohorts. Students are pinned to their own cohort so a
 * client-supplied `cohortId` can never widen them — but a student whose row
 * predates cohorts (`cohortId` absent) stays unscoped, because tightening
 * those would lock legacy learners out of courses that have no cohorts.
 */
function resolveEnrollmentCohorts(
  role: AuthenticatedUserEnrollements['role'],
  enrollment: {cohortId?: unknown; assignedCohortIds?: unknown[]},
): string[] | null {
  if (COHORT_SCOPED_ROLES.has(role)) {
    const assigned = enrollment.assignedCohortIds ?? [];
    return assigned.length > 0 ? assigned.map(id => id.toString()) : null;
  }
  if (role === 'STUDENT') {
    return enrollment.cohortId ? [enrollment.cohortId.toString()] : null;
  }
  return null;
}

/**
 * Parameter decorator that builds and injects user abilities into the controller method
 * Usage: methodName(@Ability(getCourseAbility) ability: MongoAbility<any>)
 */
export function Ability(
  abilityBuilder: (
    user: AuthenticatedUser,
  ) => MongoAbility<any> | Promise<MongoAbility<any>>,
) {
  return createParamDecorator({
    value: async action => {
      // Get current user
      const authService = getFromContainer(FirebaseAuthService);
      const token = action.request.headers['authorization']?.split(' ')[1];

      if (!token) {
        throw new Error('No authorization token provided');
      }

      const user = await authService.getCurrentUserFromToken(token);
      if (!user) {
        throw new Error('User not found');
      }

      // Get user's enrollments
      const enrollmentService = getFromContainer(EnrollmentService);
      const enrollments = await enrollmentService.getAllEnrollments(
        user._id.toString(),
      );

      // Create authenticated user object
      const authenticatedUser: AuthenticatedUser = {
        userId: user._id.toString(),
        globalRole: normalizeGlobalRole(user.roles),
        enrollments: enrollments
          .map(enrollment => {
            const role = normalizeEnrollmentRole(enrollment.role);
            return {
              courseId: enrollment.courseId.toString(),
              versionId: enrollment.courseVersionId.toString(),
              role,
              cohortIds: role
                ? resolveEnrollmentCohorts(role, enrollment)
                : null,
            };
          })
          .filter(
            (e): e is AuthenticatedUserEnrollements => e.role !== null,
          ),
      };

      // `authenticatedUser` carries the cohort scope CASL cannot express as a
      // static rule; controllers pass it to CohortScopeService.
      return {
        ability: await abilityBuilder(authenticatedUser),
        user: user,
        authenticatedUser,
      };
    },
  });
}
