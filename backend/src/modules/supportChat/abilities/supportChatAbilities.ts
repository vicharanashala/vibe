import { AbilityBuilder, MongoAbility } from '@casl/ability';
import { ObjectId } from 'mongodb';
import {
  AuthenticatedUser,
  AuthenticatedUserEnrollements,
} from '#root/shared/interfaces/models.js';
import { createSupportChatAbilityBuilder } from './types.js';

// Actions
export enum SupportChatActions {
  ViewQueue = 'viewQueue',
  Respond = 'respond',
  ManageFAQ = 'manageFaq',
}

// Subjects
export type SupportChatSubjectType = 'SupportQuestion' | 'SupportFAQ';

// Actions type
export type SupportChatActionsType = `${SupportChatActions}` | 'manage';

// Abilities
export type SupportChatAbilityType = [SupportChatActionsType, SupportChatSubjectType];

/** Enrollment roles that staff the support queue for their own courses. */
const SUPPORT_STAFF_ROLES: ReadonlySet<AuthenticatedUserEnrollements['role']> = new Set([
  'INSTRUCTOR',
  'MANAGER',
] as AuthenticatedUserEnrollements['role'][]);

/**
 * Setup support chat abilities for a specific role
 * - ADMIN: manage the whole queue and the FAQ bank
 * - INSTRUCTOR/MANAGER: read and answer the queue for their own courses
 * - everyone else: nothing — the queue carries other learners' questions
 */
export function setupSupportChatAbilities(
  builder: AbilityBuilder<any>,
  user: AuthenticatedUser,
) {
  const { can } = builder;

  if (user.globalRole === 'admin') {
    can('manage', 'SupportQuestion');
    can('manage', 'SupportFAQ');
    return;
  }

  user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
    if (!SUPPORT_STAFF_ROLES.has(enrollment.role)) {
      return;
    }

    const courseBounded = { courseId: enrollment.courseId };
    can(SupportChatActions.ViewQueue, 'SupportQuestion', courseBounded);
    can(SupportChatActions.Respond, 'SupportQuestion', courseBounded);
    can(SupportChatActions.ManageFAQ, 'SupportFAQ');
  });
}

/**
 * Get support chat abilities for a user — can be directly used by controllers
 */
export function getSupportChatAbility(user: AuthenticatedUser): MongoAbility<any> {
  const builder = createSupportChatAbilityBuilder();
  setupSupportChatAbilities(builder, user);
  return builder.build();
}

/**
 * The courses whose questions the caller may read.
 *
 * `undefined` means unrestricted and is returned only for admins. Every other
 * caller gets an explicit list — empty when they staff no course, which the
 * repository honours as "match nothing" rather than "match everything".
 */
export function resolveSupportQueueCourseIds(
  user: AuthenticatedUser,
): ObjectId[] | undefined {
  if (user.globalRole === 'admin') {
    return undefined;
  }

  const courseIds = user.enrollments
    .filter(enrollment => SUPPORT_STAFF_ROLES.has(enrollment.role))
    .map(enrollment => enrollment.courseId);

  return [...new Set(courseIds)].map(id => new ObjectId(id));
}
