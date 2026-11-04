import cron from 'node-cron';
import { appConfig } from '#root/config/app.js';
import { getContainer } from '#root/bootstrap/loadModules.js';
import { SPACED_REPETITION_TYPES } from '../types.js';
import { ReviewItemRepository, StudentSRStatusRepository } from '#spacedRepetition/repositories/index.js';
import { IReviewItem } from '../interfaces/IReviewItem.js';
import { NOTIFICATIONS_TYPES } from '../../notifications/types.js';
import { NotificationService } from '../../notifications/services/NotificationService.js';

/**
 * Per-student cap on due items considered per notification tick.
 *
 * A student who has accumulated 1000+ due items is almost certainly
 * in a clock-drift or seed-loop edge case; sending 1000 items' worth
 * of dedup'd course IDs into one notification is wasteful. 200 is
 * generous (a focused course has ~50-100 questions) while still
 * bounding per-student work.
 *
 * Audit B3 fix: without this, a heavy user could trigger pathological
 * work per tick. The cap also bounds the dedup'd course set size.
 */
export const PER_STUDENT_NOTIFICATION_CAP = 200;

/**
 * Groups an array of due ReviewItems by student_id.
 * Each student gets one notification listing all their due questions,
 * rather than one notification per question.
 */
export function groupByStudent(items: IReviewItem[]): Map<string, IReviewItem[]> {
  const map = new Map<string, IReviewItem[]>();
  for (const item of items) {
    if (!map.has(item.student_id)) {
      map.set(item.student_id, []);
    }
    map.get(item.student_id)!.push(item);
  }
  return map;
}

/**
 * Caps a per-student item list to PER_STUDENT_NOTIFICATION_CAP, keeping
 * the most-overdue items (earliest next_review_at first). Mutates the
 * input array in place. Returns the same array for chaining.
 *
 * Idempotent: if the list is already at or below the cap, no-op.
 */
export function applyPerStudentCap(items: IReviewItem[]): IReviewItem[] {
  if (items.length <= PER_STUDENT_NOTIFICATION_CAP) return items;
  items.sort(
    (a, b) => a.next_review_at.getTime() - b.next_review_at.getTime(),
  );
  items.length = PER_STUDENT_NOTIFICATION_CAP;
  return items;
}

/**
 * Runs the review-notification logic once. Extracted from the cron
 * callback so tests can invoke it without going through node-cron.
 *
 * Note: this is an internal helper. Callers should use
 * `scheduleReviewNotificationJob()` to register the cron.
 */
export async function runReviewNotificationJob(): Promise<void> {
  if (!appConfig.ENABLE_SPACED_REPETITION_JOB) {
    return;
  }

  console.log('🔁 Spaced repetition review notification job started...');

  try {
    const container = getContainer();
    const reviewItemRepo = container.get<ReviewItemRepository>(
      SPACED_REPETITION_TYPES.ReviewItemRepo,
    );

    const now = new Date();
    // N2: push the notification_opt_out filter into the Mongo
    // query. The cron no longer pulls items it will immediately
    // discard. The repository handles the $ne:true semantics;
    // docs that pre-date the field default to "not opted out".
    const allDueItems = await reviewItemRepo.findDueItems(now, undefined, undefined, {
      excludeOptedOut: true,
    });

    // Knob 6 (Phase C, 2026-07-21): drop items whose student has SR
    // disabled entirely. Bulk-read the user flags in one round trip
    // to avoid an N+1 lookup per due item.
    const studentSRStatusRepo = container.get<StudentSRStatusRepository>(
      SPACED_REPETITION_TYPES.StudentSRStatusRepo,
    );
    const distinctStudentIds = [
      ...new Set(allDueItems.map(i => i.student_id)),
    ];
    const disabledMap = await studentSRStatusRepo.getStatusForMany(
      distinctStudentIds,
    );

    // Filter out students who have SR disabled entirely by a teacher.
    // (N2: the notification_opt_out filter is now upstream in the
    // Mongo query — allDueItems already excludes opted-out items.)
    const notifiableItems = allDueItems.filter(item => {
      if (disabledMap.get(item.student_id) === true) return false;
      return true;
    });

    if (!notifiableItems.length) {
      console.log('✅ No review notifications to send.');
      return;
    }

    const grouped = groupByStudent(notifiableItems);

    // B3: cap per-student items to PER_STUDENT_NOTIFICATION_CAP
    // before they reach the notification path. Sort most-overdue
    // first so the most-neglected cards are surfaced.
    for (const [, studentItems] of grouped) {
      applyPerStudentCap(studentItems);
    }

    console.log(
      `📬 Sending review notifications to ${grouped.size} student(s) ` +
      `(${notifiableItems.length} item(s) due)...`,
    );

    for (const [studentId, items] of grouped) {
      try {
        const notificationsService = getContainer().get<NotificationService>(
          NOTIFICATIONS_TYPES.NotificationService,
        );
        await notificationsService.notifyReviewReminder(
          studentId,
          [...new Set(items.map(i => i.course_id))],
          items.length,
        );
      } catch (notifyError) {
        // Per-student errors are caught individually so one failure
        // does not stop notifications for other students.
        console.error(
          `❌ Failed to notify student ${studentId}:`,
          notifyError,
        );
      }
    }

    console.log('✅ Spaced repetition review notification job completed.');
  } catch (error) {
    console.error('❌ Spaced repetition review notification job failed:', error);
  }
}

/**
 * Registers the spaced repetition review notification cron job.
 *
 * Schedule: every hour on the hour.
 * Gated by: ENABLE_SPACED_REPETITION_JOB=true in env.
 * Timezone: Asia/Kolkata (matches existing jobs in the codebase).
 *
 * On each tick: see `runReviewNotificationJob()` for the actual logic.
 */
export function scheduleReviewNotificationJob(): void {
  cron.schedule(
    '0 * * * *',
    async () => {
      await runReviewNotificationJob();
    },
    {
      timezone: 'Asia/Kolkata',
    },
  );
}
