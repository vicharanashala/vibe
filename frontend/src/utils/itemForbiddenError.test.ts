import {describe, it, expect} from 'vitest';
import {classifyItemForbiddenError} from './itemForbiddenError';

describe('classifyItemForbiddenError', () => {
  it('matches all three real time-slot messages from TimeSlotService.canStudentAccessCourse', () => {
    expect(
      classifyItemForbiddenError(
        'Course access is only allowed during your booked time slot.',
      ),
    ).toBe('time-slot');
    expect(
      classifyItemForbiddenError(
        'You must book a time slot to access this course. Please choose a slot to continue.',
      ),
    ).toBe('time-slot');
    expect(
      classifyItemForbiddenError(
        'Course access is only allowed during your booked time slots: 09:00 to 10:00 IST. Current time: 14:32 IST',
      ),
    ).toBe('time-slot');
  });

  it('does not mistake the archived-course-version message for a time-slot error', () => {
    // This is exactly the regression the original PR review flagged: an
    // archived course also returns a 403, but should never route to the
    // amber time-slot banner.
    expect(
      classifyItemForbiddenError(
        "This course version is inactive, you can't access items",
      ),
    ).toBe('known-generic');
  });

  it('does not mistake the out-of-order-progression message for a time-slot error', () => {
    expect(
      classifyItemForbiddenError("You don't have permission to watch this item"),
    ).toBe('known-generic');
  });

  it('classifies "not enrolled" as known-generic, not time-slot', () => {
    // Deliberately not a time-slot case -- see classifyItemForbiddenError's
    // doc comment. Pinned here so a future change doesn't accidentally
    // start routing it to the time-slot banner.
    expect(
      classifyItemForbiddenError('Student not enrolled in this course.'),
    ).toBe('known-generic');
  });

  it('flags a genuinely new/unexpected 403 message as unrecognized', () => {
    expect(classifyItemForbiddenError('Something entirely new went wrong')).toBe(
      'unrecognized',
    );
  });

  it('is case-insensitive on the time-slot keywords', () => {
    expect(classifyItemForbiddenError('BOOK A SLOT to continue')).toBe('time-slot');
  });
});
