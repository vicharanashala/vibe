import { AuthenticatedUser, IUser } from '../interfaces/models.js';
import { AbilityBuilder, MongoAbility, createMongoAbility, subject } from "@casl/ability";

// Import unified ability setup functions from each module
import { setupAllCourseAbilities } from "#root/modules/courses/abilities/index.js";
import { setupAllQuizAbilities } from "#root/modules/quizzes/abilities/index.js";
import { setupAllNotificationAbilities } from "#root/modules/notifications/abilities/index.js";
import { setupAllUserAbilities } from "#root/modules/users/abilities/index.js";
import { currentUserChecker } from './currentUserChecker.js';
import { EnrollmentService } from '#root/modules/users/services/EnrollmentService.js';
import { getFromContainer } from 'routing-controllers';
import { InviteService } from '#root/modules/notifications/index.js';
import { QuestionBankService } from '#root/modules/quizzes/services/QuestionBankService.js';


// Define the CASL authorization options interface
export interface CaslAuthOptions {
    action: string;
    subject: string;
    resource?: any;
}

/**
 * Creates a unified ability that includes only the relevant module for a user
 */
async function createUserAbility(user: AuthenticatedUser, subject: string): Promise<MongoAbility<any>> {
    const builder = new AbilityBuilder(createMongoAbility);
    
    // Only setup abilities for the module being accessed based on the subject
    switch (subject) {
        case 'Course':
        case 'CourseVersion':
        case 'Module':
        case 'Section':
        case 'Item':
            await setupAllCourseAbilities(builder, user);
            break;
        case 'Quiz':
        case 'Question':
        case 'Attempt':
            await setupAllQuizAbilities(builder, user);
            break;
        case 'Notification':
        case 'Invite':
            setupAllNotificationAbilities(builder, user);
            break;
        case 'User':
        case 'Enrollment':
        case 'Progress':
            setupAllUserAbilities(builder, user);
            break;
        default:
            // For unknown subjects, setup all abilities as fallback
            await setupAllCourseAbilities(builder, user);
            await setupAllQuizAbilities(builder, user);
            setupAllNotificationAbilities(builder, user);
            setupAllUserAbilities(builder, user);
            break;
    }
    
    return builder.build();
}

/**
 * Extracts resource parameters from request for scoped permissions
 */
async function extractResourceFromRequest(action: any, userId: string, subject: string, userAction): Promise<any | undefined> {
    const params = action.request.params || {};

    // Build resource object based on available parameters
    const resource: any = {};
    
    // Common ID patterns

    if (params.courseId) resource.courseId = params.courseId;
    if (params.versionId) resource.versionId = params.versionId;
    if (params.itemId) resource.itemId = params.itemId;
    if (params.quizId) resource.quizId = params.quizId;
    resource.userId = userId;
    if (subject === 'Invite' && userAction === 'modify') {
        const inviteService = getFromContainer(InviteService);
        const invite = await inviteService.findInviteById(params.inviteId);
        if (invite) {
            resource.courseId = invite.courseId.toString();
            resource.versionId = invite.courseVersionId.toString();
        }
    }
    if (subject === 'QuestionBank' && !(userAction === 'create')) {
        const questionBankService = getFromContainer(QuestionBankService);
        const questionBank = await questionBankService.getById(params.questionBankId);
        if (questionBank) {
            resource.courseId = questionBank.courseId.toString();
            resource.versionId = questionBank.courseVersionId.toString();
        }
    }
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
    
    const enrollmentService = getFromContainer(EnrollmentService);
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
    const caslOptions = roles[0] as CaslAuthOptions;

    // Create user's abilities for the specific module
    const ability = await createUserAbility(authenticatedUser, caslOptions.subject);
    
    // Extract resource from request if not explicitly provided
    const resource = await extractResourceFromRequest(action, authenticatedUser.userId, caslOptions.subject, caslOptions.action);
    // For admin users, check without resource constraints first
    let result = false;
    if (authenticatedUser.globalRole === 'admin') {
        result = ability.can(caslOptions.action, caslOptions.subject);
    }
    
    const caslSubject = subject(caslOptions.subject, resource);
    // If admin check passed or user is not admin, check with resource
    if (!result) {
        result = ability.can(caslOptions.action, caslSubject);
    }
    
    // Check CASL permission
    return result;
}
