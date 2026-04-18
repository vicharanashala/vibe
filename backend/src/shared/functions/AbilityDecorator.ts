import { getFromContainer, createParamDecorator } from 'routing-controllers';
import { AuthenticatedUser } from '../interfaces/models.js';
import { FirebaseAuthService } from '#root/modules/auth/services/FirebaseAuthService.js';
import { EnrollmentService } from '#root/modules/users/services/EnrollmentService.js';
import { MongoAbility } from '@casl/ability';

/**
 * Parameter decorator that builds and injects user abilities into the controller method
 * Usage: methodName(@Ability(getCourseAbility) ability: MongoAbility<any>)
 */
export function Ability(abilityBuilder: (user: AuthenticatedUser) => MongoAbility<any> | Promise<MongoAbility<any>>) {
    return createParamDecorator({
        value: async (action) => {
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
            const enrollments = await enrollmentService.getAllEnrollments(user._id.toString());
            
            // Create authenticated user object
            const authenticatedUser: AuthenticatedUser = {
                userId: user._id.toString(),
                globalRole: user.roles,
                enrollments: enrollments.map(enrollment => ({
                    courseId: enrollment.courseId.toString(),
                    versionId: enrollment.courseVersionId.toString(),
                    role: enrollment.role,
                })),
            };
            
            // Build and return the ability using the provided builder function
            return {ability: await abilityBuilder(authenticatedUser), user: user}
        }
    });
}
