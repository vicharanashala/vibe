import {AbilityBuilder, MongoAbility} from '@casl/ability';
import {
  AuthenticatedUser,
  AuthenticatedUserEnrollements,
} from '#root/shared/interfaces/models.js';
import {createDiscussionAbilityBuilder} from './types.js';

/**
 * Discussion-board actions.
 *
 * CASL only describes the *static* (courseId-bound) half of the rules; the
 * cohort-visibility half is enforced server-side by `DiscussionService`,
 * which uses the caller's authenticated enrollments to filter every read
 * and to gate every write. Keeping these two halves separate is what stops
 * a client-supplied `cohortId` from widening a student's view.
 */
export enum DiscussionActions {
  View = 'view',
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
  Reply = 'reply',
  /**
   * Pin / unpin a thread. Milestone C: only granted to teacher-track roles
   * (INSTRUCTOR / MANAGER / TA / STAFF) on the thread's course. Students
   * can never pin.
   */
  Pin = 'pin',
}

export type DiscussionSubjectType = 'Discussion';

export const DiscussionSubject = 'Discussion';

/**
 * Grant discussion abilities for one authenticated user.
 *
 * - `admin` may do anything across the whole platform.
 * - Every other authenticated user is gated by their enrollments on the
 *   course: a user with no enrollment gets no grants.
 * - INSTRUCTOR / MANAGER / TA / STAFF get the *teacher* track: every
 *   cohort-scoped read / reply action, the `Pin` moderation action, AND
 *   `manage`-level Update + Delete (so they can edit/delete any thread or
 *   reply in their authorized cohort without the caller having to author
 *   it). The cohort isolation done by `DiscussionService` keeps these
 *   powers course-scoped — a teacher's "any" is still "any within their
 *   authorised cohorts", never the whole platform.
 * - STUDENT gets read + reply on their courses, plus Update/Delete on
 *   resources they authored. Whether a student can read *another
 *   cohort's* thread, and whether they can delete *another student's*
 *   thread, is decided by `DiscussionService` at query time, not here.
 */
export function setupDiscussionAbilities(
  builder: AbilityBuilder<any>,
  user: AuthenticatedUser,
): void {
  const {can} = builder;

  if (user.globalRole === 'admin') {
    can('manage', DiscussionSubject);
    return;
  }

  user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
    const courseBounded = {courseId: enrollment.courseId};

    switch (enrollment.role) {
      case 'STUDENT':
        can(DiscussionActions.View, DiscussionSubject, courseBounded);
        can(DiscussionActions.Reply, DiscussionSubject, courseBounded);
        can(DiscussionActions.Create, DiscussionSubject, courseBounded);
        can(DiscussionActions.Update, DiscussionSubject, courseBounded);
        can(DiscussionActions.Delete, DiscussionSubject, courseBounded);
        break;

      case 'INSTRUCTOR':
      case 'MANAGER':
      case 'TA':
      case 'STAFF':
        can(DiscussionActions.View, DiscussionSubject, courseBounded);
        can(DiscussionActions.Reply, DiscussionSubject, courseBounded);
        can(DiscussionActions.Create, DiscussionSubject, courseBounded);
        // Teacher-track gets a `manage` over Update + Delete so they can
        // edit/delete any thread or reply in their authorized course. The
        // controller additionally enforces "author OR teacher" on Update,
        // and "cohort readable" everywhere; course-scoping is what stops
        // a teacher from moderating another course's discussions.
        can(
          DiscussionActions.Update,
          DiscussionSubject,
          courseBounded,
        );
        can(
          DiscussionActions.Delete,
          DiscussionSubject,
          courseBounded,
        );
        // Pin / unpin is a moderator-only action.
        can(DiscussionActions.Pin, DiscussionSubject, courseBounded);
        break;

      default:
        break;
    }
  });
}

export function getDiscussionAbility(
  user: AuthenticatedUser,
): MongoAbility<any> {
  const builder = createDiscussionAbilityBuilder();
  setupDiscussionAbilities(builder, user);
  return builder.build();
}