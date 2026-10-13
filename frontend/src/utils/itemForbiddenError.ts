/**
 * Classifies a ForbiddenError message from ItemService.readItem so the
 * course page can route it to the right UI instead of a generic "locked
 * lesson" message. Kept as a small pure function (rather than inline in
 * course-page.tsx) specifically so the message-matching rules can be unit
 * tested against the exact backend strings without mounting the page.
 *
 * Known exact backend messages, as of this fix:
 *   - out-of-order progression (genuinely a locked lesson):
 *     "You don't have permission to watch this item"
 *   - archived course version:
 *     "This course version is inactive, you can't access items"
 *   - time-slot gate, one of three variants from
 *     TimeSlotService.canStudentAccessCourse:
 *     "Course access is only allowed during your booked time slot."
 *     "You must book a time slot to access this course. Please choose a
 *       slot to continue."
 *     "Course access is only allowed during your booked time slots:
 *       <windows> IST. Current time: <time>"
 *   - not enrolled (also from canStudentAccessCourse, but NOT a time-slot
 *     issue, so deliberately not classified as 'time-slot'):
 *     "Student not enrolled in this course."
 */
export type ItemForbiddenErrorKind = 'time-slot' | 'known-generic' | 'unrecognized';

const TIME_SLOT_PATTERN = /time slot|study window|book a slot|choose a slot/i;

// "Not enrolled" is a known message, but deliberately not a locked-lesson
// case either -- it's included here only so it doesn't trip the
// 'unrecognized' warning, not because the generic locked-lesson message is
// the right thing to show for it. See the caller for that tradeoff.
const KNOWN_GENERIC_PATTERN =
  /you don't have permission to watch this item|this course version is inactive|not enrolled in this course/i;

export function classifyItemForbiddenError(message: string): ItemForbiddenErrorKind {
  if (TIME_SLOT_PATTERN.test(message)) {
    return 'time-slot';
  }
  if (KNOWN_GENERIC_PATTERN.test(message)) {
    return 'known-generic';
  }
  return 'unrecognized';
}
