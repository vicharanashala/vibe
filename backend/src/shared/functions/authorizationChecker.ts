import { AuthenticatedUser, IUser } from '../interfaces/models.js';
import { AbilityBuilder, MongoAbility, createMongoAbility } from "@casl/ability";

// Import unified ability setup functions from each module
import { setupAllCourseAbilities } from "#root/modules/courses/abilities/index.js";
import { setupAllQuizAbilities } from "#root/modules/quizzes/abilities/index.js";
import { setupAllNotificationAbilities } from "#root/modules/notifications/abilities/index.js";
import { setupAllUserAbilities } from "#root/modules/users/abilities/index.js";
import { currentUserChecker } from './currentUserChecker.js';
import { EnrollmentService } from '#root/modules/users/services/EnrollmentService.js';
import { getFromContainer } from 'routing-controllers';

const enrollmentService = getFromContainer(EnrollmentService);

// Define the CASL authorization options interface
export interface CaslAuthOptions {
    action: string;
    subject: string;
    resource?: any;
}

/**
 * Creates a unified ability that includes all modules for a user
 */
function createUserAbility(user: AuthenticatedUser): MongoAbility<any> {
    const builder = new AbilityBuilder(createMongoAbility);
    
    // Setup abilities for all modules
    setupAllCourseAbilities(builder, user);
    setupAllQuizAbilities(builder, user);
    setupAllNotificationAbilities(builder, user);
    setupAllUserAbilities(builder, user);
    
    return builder.build();
}

/**
 * Extracts resource parameters from request for scoped permissions
 */
function extractResourceFromRequest(action: any): any {
    const params = action.request.params || {};

    // Build resource object based on available parameters
    const resource: any = {};
    
    // Common ID patterns
    if (params.id) resource.id = params.id;
    if (params.courseId) resource.courseId = params.courseId;
    if (params.versionId) resource.versionId = params.versionId;
    if (params.itemId) resource.itemId = params.itemId;
    if (params.userId) resource.userId = params.userId;
    return Object.keys(resource).length > 0 ? resource : undefined;
}

/**
 * Main authorization checker - compatible with routing-controllers
 */
export async function authorizationChecker(action: any, roles: any[]): Promise<boolean> {
    const user = await currentUserChecker(action) as IUser;
    if (!user) {
        return false;
    }
    const enrollments= await enrollmentService.getAllEnrollments(user._id.toString());
    const authenticatedUser: AuthenticatedUser = {
        userId: user._id.toString(),
        globalRole: user.roles,
        enrollments: enrollments.map(enrollment => ({
            courseId: enrollment.courseId.toString(),
            versionId: enrollment.courseVersionId.toString(),
            role: enrollment.role,
        })),
    };
    // Extract CASL options from the roles parameter
    // routing-controllers will pass the options from @Authorized({action: "...", subject: "..."})
    const caslOptions = roles[0] as CaslAuthOptions;

    // Create user's abilities
    const ability = createUserAbility(authenticatedUser);
    
    // Extract resource from request if not explicitly provided
    const resource = caslOptions.resource || extractResourceFromRequest(action);
    
    // Check CASL permission
    return ability.can(caslOptions.action, resource || caslOptions.subject);
}
