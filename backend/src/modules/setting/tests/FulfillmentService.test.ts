import 'reflect-metadata';
import {describe, it, expect, vi, beforeEach} from 'vitest';
import {FulfillmentService} from '../services/FulfillmentService.js';
import {SlotBookingStatus} from '#shared/interfaces/models.js';

/**
 * Unit tests for the Phase 3 fulfillment evaluator. The DB is bypassed by
 * stubbing the slot-booking repo + settings repo; we assert the window-overlap
 * math, the threshold verdict, and that windows that haven't ended are skipped.
 */

const COURSE = 'course-1';
const VERSION = 'version-1';

// 2026-06-20, 13:00–15:00 IST → 120-minute window.
// In UTC that is 07:30 → 09:30 on 2026-06-20.
const DAY_BOOKING = {
  _id: 'b1',
  userId: 'student-1',
  courseId: COURSE,
  courseVersionId: VERSION,
  date: '2026-06-20',
  from: '13:00',
  to: '15:00',
  status: SlotBookingStatus.BOOKED,
};

function makeService(opts: {
  bookings?: any[];
  sessions?: any[];
  timeslots?: any;
  percentCompleted?: number;
}) {
  const {
    bookings = [DAY_BOOKING],
    sessions = [],
    timeslots = {isActive: true, slots: [], fulfillmentThresholdPct: 90},
    percentCompleted = 0,
  } = opts;

  const slotBookingRepo = {
    findBookingsToEvaluate: vi.fn().mockResolvedValue(bookings),
    findWatchSessionsOverlapping: vi.fn().mockResolvedValue(sessions),
    setFulfillment: vi.fn().mockResolvedValue(true),
  };
  const settingsRepo = {
    readTimeslotsSettings: vi.fn().mockResolvedValue(timeslots),
  };
  const enrollmentService = {
    findEnrollment: vi.fn().mockResolvedValue({percentCompleted}),
  };
  const svc = new FulfillmentService(
    slotBookingRepo as any,
    settingsRepo as any,
    enrollmentService as any,
    {} as any,
  );
  return {svc, slotBookingRepo, settingsRepo, enrollmentService};
}

// A watch session as Date objects.
const session = (startUTC: string, endUTC: string) => ({
  startTime: new Date(startUTC),
  endTime: new Date(endUTC),
});

describe('FulfillmentService.evaluateDueBookings', () => {
  beforeEach(() => vi.clearAllMocks());

  // Evaluate well after the window closed.
  const AFTER = new Date('2026-06-20T10:00:00Z');

  it('marks FULFILLED when active >= threshold and records activePct', async () => {
    // 13:00–14:54 IST = 07:30–09:24 UTC = 114 min of 120 → 95%.
    const {svc, slotBookingRepo} = makeService({
      sessions: [session('2026-06-20T07:30:00Z', '2026-06-20T09:24:00Z')],
    });

    const summary = await svc.evaluateDueBookings(AFTER);

    expect(summary).toMatchObject({evaluated: 1, fulfilled: 1, unfulfilled: 0});
    const [, status, activePct] = slotBookingRepo.setFulfillment.mock.calls[0];
    expect(status).toBe(SlotBookingStatus.FULFILLED);
    expect(activePct).toBe(95);
  });

  it('marks UNFULFILLED when active < threshold', async () => {
    // 13:00–13:30 IST = 30 min of 120 → 25%.
    const {svc, slotBookingRepo} = makeService({
      sessions: [session('2026-06-20T07:30:00Z', '2026-06-20T08:00:00Z')],
    });

    const summary = await svc.evaluateDueBookings(AFTER);

    expect(summary).toMatchObject({evaluated: 1, unfulfilled: 1, fulfilled: 0});
    const [, status, activePct] = slotBookingRepo.setFulfillment.mock.calls[0];
    expect(status).toBe(SlotBookingStatus.UNFULFILLED);
    expect(activePct).toBe(25);
  });

  it('clamps activePct at 100 when activity exceeds the window', async () => {
    const {svc, slotBookingRepo} = makeService({
      sessions: [session('2026-06-20T06:00:00Z', '2026-06-20T11:00:00Z')],
    });
    await svc.evaluateDueBookings(AFTER);
    const [, status, activePct] = slotBookingRepo.setFulfillment.mock.calls[0];
    expect(status).toBe(SlotBookingStatus.FULFILLED);
    expect(activePct).toBe(100);
  });

  it('skips a window that has not ended yet', async () => {
    const {svc, slotBookingRepo} = makeService({
      sessions: [session('2026-06-20T07:30:00Z', '2026-06-20T09:24:00Z')],
    });
    // 08:00 UTC is before the window end (09:30 UTC).
    const summary = await svc.evaluateDueBookings(
      new Date('2026-06-20T08:00:00Z'),
    );
    expect(summary.skipped).toBe(1);
    expect(summary.evaluated).toBe(0);
    expect(slotBookingRepo.setFulfillment).not.toHaveBeenCalled();
  });

  it('skips when the time-slot feature is inactive', async () => {
    const {svc, slotBookingRepo} = makeService({
      timeslots: {isActive: false, slots: []},
      sessions: [session('2026-06-20T07:30:00Z', '2026-06-20T09:24:00Z')],
    });
    const summary = await svc.evaluateDueBookings(AFTER);
    expect(summary.skipped).toBe(1);
    expect(slotBookingRepo.setFulfillment).not.toHaveBeenCalled();
  });

  it('defaults the threshold to 90% when unset', async () => {
    // Sparse 89%: 30min + 76.8min with a gap, so engagement density is also 89%
    // → fails both the full-window rule and the finished-early rule under the
    // default 90% threshold.
    const eightyNine = makeService({
      timeslots: {isActive: true, slots: []}, // no fulfillmentThresholdPct
      sessions: [
        session('2026-06-20T07:30:00Z', '2026-06-20T08:00:00Z'), // 30 min
        session('2026-06-20T08:13:12Z', '2026-06-20T09:30:00Z'), // 76.8 min
      ],
    });
    await eightyNine.svc.evaluateDueBookings(AFTER);
    expect(eightyNine.slotBookingRepo.setFulfillment.mock.calls[0][1]).toBe(
      SlotBookingStatus.UNFULFILLED,
    );
  });

  it('credits finishing early: dense engagement that leaves before the window ends', async () => {
    // Active 13:00–14:46.8 IST (07:30–09:16.8 UTC) = 106.8 min of a 120-min
    // window → 89% of the window (fails rule 1), but the student was active
    // 100% of the time until they left → FULFILLED via the finished-early rule.
    const {svc, slotBookingRepo} = makeService({
      sessions: [session('2026-06-20T07:30:00Z', '2026-06-20T09:16:48Z')],
    });
    await svc.evaluateDueBookings(AFTER);
    const [, status, activePct] = slotBookingRepo.setFulfillment.mock.calls[0];
    expect(status).toBe(SlotBookingStatus.FULFILLED);
    expect(activePct).toBe(89); // honest measured pct still recorded
  });

  it('does not credit a token appearance below the minimum active floor', async () => {
    // 13:00–13:30 IST = 30 min dense, but under the 45-min floor → UNFULFILLED.
    const {svc, slotBookingRepo} = makeService({
      sessions: [session('2026-06-20T07:30:00Z', '2026-06-20T08:00:00Z')],
    });
    await svc.evaluateDueBookings(AFTER);
    expect(slotBookingRepo.setFulfillment.mock.calls[0][1]).toBe(
      SlotBookingStatus.UNFULFILLED,
    );
  });

  it('credits a slot when the student has no remaining work (course complete)', async () => {
    // Barely active, but the course is 100% complete → nothing left to do, so
    // the booked slot is not counted as wasted.
    const {svc, slotBookingRepo} = makeService({
      sessions: [session('2026-06-20T07:30:00Z', '2026-06-20T07:35:00Z')],
      percentCompleted: 100,
    });
    await svc.evaluateDueBookings(AFTER);
    expect(slotBookingRepo.setFulfillment.mock.calls[0][1]).toBe(
      SlotBookingStatus.FULFILLED,
    );
  });

  it('evaluates an overnight window using next-day bounds', async () => {
    // 23:00–01:00 IST on 2026-06-20 → 17:30 UTC to 19:30 UTC (next IST day).
    const {svc, slotBookingRepo} = makeService({
      bookings: [{...DAY_BOOKING, from: '23:00', to: '01:00'}],
      sessions: [session('2026-06-20T17:30:00Z', '2026-06-20T19:30:00Z')],
    });
    const summary = await svc.evaluateDueBookings(
      new Date('2026-06-20T20:00:00Z'),
    );
    expect(summary).toMatchObject({evaluated: 1, fulfilled: 1});
    expect(slotBookingRepo.setFulfillment.mock.calls[0][2]).toBe(100);
  });
});
