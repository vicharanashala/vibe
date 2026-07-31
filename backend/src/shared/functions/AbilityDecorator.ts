import {getFromContainer, createParamDecorator} from 'routing-controllers';
import {AuthenticatedUser, AuthenticatedUserEnrollements} from '../interfaces/models.js';
import {FirebaseAuthService} from '#root/modules/auth/services/FirebaseAuthService.js';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';
import {MongoAbility} from '@casl/ability';

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
          .map(enrollment => ({
            courseId: enrollment.courseId.toString(),
            versionId: enrollment.courseVersionId.toString(),
            role: normalizeEnrollmentRole(enrollment.role),
          }))
          .filter(
            (e): e is AuthenticatedUserEnrollements => e.role !== null,
          ),
      };

      // Build and return the ability using the provided builder function
      return {ability: await abilityBuilder(authenticatedUser), user: user};
    },
  });
}
