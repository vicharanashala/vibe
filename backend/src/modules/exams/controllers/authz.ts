import { ForbiddenError } from 'routing-controllers';
import { IUser } from '#root/shared/interfaces/models.js';

/**
 * This app has no secure backend "teacher" role today (role is a
 * client-selected UI choice at login, not a verified claim). So
 * authorization here follows the closest existing precedent,
 * `AnnouncementController`: any authenticated user may create an exam;
 * only the exam's creator or an admin may edit/delete/manage it.
 *
 * Lives in its own module (not inside `ExamController.ts`) specifically so
 * `QuestionBankController` (and `ExamGenAIController`) can import it without
 * creating a load-order dependency on `ExamController.ts` — routing-controllers
 * registers routes in controller *import*-evaluation order, and
 * `QuestionBankController`'s literal `/exams/question-bank` routes must be
 * registered before `ExamController`'s `/exams/:examId` param route or they
 * get swallowed by it. If this helper lived in `ExamController.ts`, importing
 * it from `QuestionBankController.ts` would force `ExamController.ts` to
 * evaluate (and register its routes) first, regardless of any import
 * reordering elsewhere.
 */
export function assertOwnerOrAdmin(createdBy: string, user: IUser): void {
    if (createdBy !== user._id?.toString() && user.roles !== 'admin') {
        throw new ForbiddenError('You can only manage your own exams');
    }
}
