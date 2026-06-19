import 'reflect-metadata';
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {SlotBookingService} from '../services/SlotBookingService.js';
import {
  SlotBookingKind,
  SlotBookingStatus,
} from '#shared/interfaces/models.js';

/**
 * Unit tests for SlotBookingService.bookSlot / cancelBooking — the
 * commitment-scheme booking logic. The hard capacity cap (per-window
 * concurrency ceiling) and the per-student daily allowance are the load-control
 * knobs and get the most coverage.
 *
 * The DB is bypassed by stubbing BaseService._withTransaction.
 */

const USER = 'student-1';
const COURSE = 'course-1';
const VERSION = 'version-1';

const SLOT = {from: '13:00', to: '15:00'}; // 2h, same-day

// Frozen clock: 2026-06-20 08:00 IST (= 02:30 UTC), before the 9 AM cutoff, so
// booking for "today" is inside its window. Keeps the booking-window check
// deterministic regardless of when the suite runs.
const FROZEN_UTC = '2026-06-20T02:30:00.000Z';
const TODAY = '2026-06-20';

function makeService(
  opts: {
    timeslots?: any;
    enrollment?: any;
    myBookings?: any[];
    slotCount?: number;
    bookingById?: any;
    reservedHours?: number;
  } = {},
) {
  const {
    timeslots = {
      isActive: true,
      slots: [{from: '13:00', to: '15:00', studentIds: [], maxStudents: 2}],
      dailyBaseAllowance: 1,
    },
    enrollment = {_id: 'enroll-1'},
    myBookings = [],
    slotCount = 0,
    bookingById = null,
    reservedHours = 0,
  } = opts;

  const slotBookingRepo = {
    findActiveForStudent: vi.fn().mockResolvedValue(myBookings),
    countActiveInSlot: vi.fn().mockResolvedValue(slotCount),
    sumReservedHoursForStudent: vi.fn().mockResolvedValue(reservedHours),
    createBooking: vi
      .fn()
      .mockImplementation((b: any) => Promise.resolve({...b, _id: 'booking-new'})),
    findById: vi.fn().mockResolvedValue(bookingById),
    cancelBooking: vi.fn().mockResolvedValue(true),
  };
  const settingsRepo = {
    readTimeslotsSettings: vi.fn().mockResolvedValue(timeslots),
  };
  const enrollmentService = {
    findEnrollment: vi.fn().mockResolvedValue(enrollment),
  };
  const db = {} as any;

  const svc = new SlotBookingService(
    slotBookingRepo as any,
    settingsRepo as any,
    enrollmentService as any,
    db,
  );
  vi.spyOn(svc as any, '_withTransaction').mockImplementation((fn: any) =>
    fn({}),
  );

  return {svc, slotBookingRepo, settingsRepo, enrollmentService};
}

describe('SlotBookingService.bookSlot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FROZEN_UTC));
  });
  afterEach(() => vi.useRealTimers());

  it('rejects when the time-slot feature is inactive', async () => {
    const {svc} = makeService({timeslots: {isActive: false, slots: []}});
    await expect(
      svc.bookSlot(USER, COURSE, VERSION, SLOT),
    ).rejects.toThrowError(/not enabled/i);
  });

  it('rejects a slot that the course does not offer', async () => {
    const {svc} = makeService();
    await expect(
      svc.bookSlot(USER, COURSE, VERSION, {from: '08:00', to: '09:00'}),
    ).rejects.toThrowError(/not offered/i);
  });

  it('rejects when the student is not enrolled', async () => {
    const {svc} = makeService({enrollment: null});
    await expect(
      svc.bookSlot(USER, COURSE, VERSION, SLOT),
    ).rejects.toThrowError(/not enrolled/i);
  });

  it('falls back to a cohort-agnostic enrollment lookup on a cohortId mismatch', async () => {
    const {svc, enrollmentService, slotBookingRepo} = makeService();
    // The strict (cohortId) lookup misses — e.g. the enrollment row's cohortId
    // is null or different — but the cohort-agnostic retry finds the enrollment,
    // so the booking still succeeds (mirrors the #1081 / ItemService fix).
    enrollmentService.findEnrollment
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({_id: 'enroll-1'});

    await svc.bookSlot(USER, COURSE, VERSION, SLOT, 'cohort-x');

    expect(enrollmentService.findEnrollment).toHaveBeenCalledTimes(2);
    // The retry drops the cohortId (4th arg) to match on identity alone.
    expect(enrollmentService.findEnrollment.mock.calls[1][3]).toBeUndefined();
    expect(slotBookingRepo.createBooking).toHaveBeenCalledOnce();
  });

  it('rejects double-booking the same slot', async () => {
    const {svc} = makeService({
      myBookings: [{date: TODAY, from: '13:00', to: '15:00'}],
    });
    await expect(
      svc.bookSlot(USER, COURSE, VERSION, SLOT),
    ).rejects.toThrowError(/already booked/i);
  });

  it('rejects when the daily allowance is used up', async () => {
    // One booking already made today (a different slot), allowance = 1.
    const {svc} = makeService({
      myBookings: [{bookedOnDate: TODAY, from: '09:00', to: '10:00'}],
    });
    await expect(
      svc.bookSlot(USER, COURSE, VERSION, SLOT),
    ).rejects.toThrowError(/booking\(s\) for today/i);
  });

  it('enforces the hard capacity cap (slot full)', async () => {
    const {svc} = makeService({slotCount: 2}); // maxStudents = 2
    await expect(
      svc.bookSlot(USER, COURSE, VERSION, SLOT),
    ).rejects.toThrowError(/full/i);
  });

  it('books a same-day slot and records BASE/BOOKED with correct hours', async () => {
    const {svc, slotBookingRepo} = makeService();
    const result = await svc.bookSlot(USER, COURSE, VERSION, SLOT);

    expect(slotBookingRepo.createBooking).toHaveBeenCalledOnce();
    const saved = slotBookingRepo.createBooking.mock.calls[0][0];
    expect(saved).toMatchObject({
      userId: USER,
      enrollmentId: 'enroll-1',
      courseId: COURSE,
      courseVersionId: VERSION,
      from: '13:00',
      to: '15:00',
      overnight: false,
      kind: SlotBookingKind.BASE,
      status: SlotBookingStatus.BOOKED,
      hoursReserved: 2,
    });
    expect(result._id).toBe('booking-new');
  });

  it('supports overnight windows (from > to) with wrapped duration', async () => {
    const {svc, slotBookingRepo} = makeService({
      timeslots: {
        isActive: true,
        slots: [{from: '22:00', to: '01:00', studentIds: []}],
        dailyBaseAllowance: 1,
      },
    });

    await svc.bookSlot(USER, COURSE, VERSION, {from: '22:00', to: '01:00'});

    const saved = slotBookingRepo.createBooking.mock.calls[0][0];
    expect(saved.overnight).toBe(true);
    expect(saved.hoursReserved).toBe(3); // 22:00 -> 01:00 = 3h
  });

  it('respects a higher daily allowance (books a second, different slot)', async () => {
    const {svc, slotBookingRepo} = makeService({
      timeslots: {
        isActive: true,
        slots: [
          {from: '09:00', to: '10:00', studentIds: []},
          {from: '13:00', to: '15:00', studentIds: []},
        ],
        dailyBaseAllowance: 2,
      },
      // already made 1 of 2 bookings today
      myBookings: [{bookedOnDate: TODAY, from: '09:00', to: '10:00'}],
    });

    await svc.bookSlot(USER, COURSE, VERSION, SLOT);
    expect(slotBookingRepo.createBooking).toHaveBeenCalledOnce();
  });

  // --- per-course hours budget (SLOT is 13:00–15:00 = 2h) ---

  const budgetSlots = [{from: '13:00', to: '15:00', studentIds: []}];

  it('books when within the committed hours budget', async () => {
    const {svc, slotBookingRepo} = makeService({
      timeslots: {isActive: true, slots: budgetSlots, totalBudgetHours: 4},
      reservedHours: 1, // 1 + 2 = 3 <= 4
    });
    await svc.bookSlot(USER, COURSE, VERSION, SLOT);
    expect(slotBookingRepo.createBooking).toHaveBeenCalledOnce();
  });

  it('allows booking that lands exactly on the budget', async () => {
    const {svc, slotBookingRepo} = makeService({
      timeslots: {isActive: true, slots: budgetSlots, totalBudgetHours: 2},
      reservedHours: 0, // 0 + 2 = 2 <= 2
    });
    await svc.bookSlot(USER, COURSE, VERSION, SLOT);
    expect(slotBookingRepo.createBooking).toHaveBeenCalledOnce();
  });

  it('rejects a booking that would exceed the committed hours budget', async () => {
    const {svc, slotBookingRepo} = makeService({
      timeslots: {isActive: true, slots: budgetSlots, totalBudgetHours: 2},
      reservedHours: 1, // 1 + 2 = 3 > 2
    });
    await expect(
      svc.bookSlot(USER, COURSE, VERSION, SLOT),
    ).rejects.toThrowError(/committed hours/i);
    expect(slotBookingRepo.createBooking).not.toHaveBeenCalled();
  });

  it('counts instructor-granted extra hours toward the budget', async () => {
    const {svc, slotBookingRepo} = makeService({
      timeslots: {isActive: true, slots: budgetSlots, totalBudgetHours: 2},
      enrollment: {_id: 'enroll-1', commitmentExtraHours: 2}, // budget = 2 + 2 = 4
      reservedHours: 1, // 1 + 2 = 3 <= 4
    });
    await svc.bookSlot(USER, COURSE, VERSION, SLOT);
    expect(slotBookingRepo.createBooking).toHaveBeenCalledOnce();
  });

  it('does not enforce a budget when none is configured (unlimited)', async () => {
    const {svc, slotBookingRepo} = makeService({
      timeslots: {isActive: true, slots: budgetSlots}, // no totalBudgetHours
      reservedHours: 999,
    });
    await svc.bookSlot(USER, COURSE, VERSION, SLOT);
    expect(slotBookingRepo.createBooking).toHaveBeenCalledOnce();
    expect(slotBookingRepo.sumReservedHoursForStudent).not.toHaveBeenCalled();
  });
});

describe('SlotBookingService.bookSlot — booking window (D-2 9AM → D 9AM IST)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  // 2026-06-20 08:00 IST — before the 9 AM cutoff.
  const at = (utc: string) => vi.setSystemTime(new Date(utc));

  it('books tomorrow at any time of day', async () => {
    at('2026-06-20T08:30:00.000Z'); // 14:00 IST on 06-20
    const {svc, slotBookingRepo} = makeService();
    await svc.bookSlot(USER, COURSE, VERSION, SLOT, undefined, '2026-06-21');
    expect(slotBookingRepo.createBooking).toHaveBeenCalledOnce();
    const saved = slotBookingRepo.createBooking.mock.calls[0][0];
    expect(saved.date).toBe('2026-06-21'); // study day
    expect(saved.bookedOnDate).toBe('2026-06-20'); // calendar day booked
  });

  it('rejects booking for today once past the 9 AM cutoff', async () => {
    at('2026-06-20T04:30:00.000Z'); // 10:00 IST on 06-20
    const {svc} = makeService();
    await expect(
      svc.bookSlot(USER, COURSE, VERSION, SLOT, undefined, '2026-06-20'),
    ).rejects.toThrowError(/has closed/i);
  });

  it('allows booking for today before the 9 AM cutoff', async () => {
    at('2026-06-20T02:30:00.000Z'); // 08:00 IST on 06-20
    const {svc, slotBookingRepo} = makeService();
    await svc.bookSlot(USER, COURSE, VERSION, SLOT, undefined, '2026-06-20');
    expect(slotBookingRepo.createBooking).toHaveBeenCalledOnce();
  });

  it('rejects the day-after-tomorrow before its 9 AM open time', async () => {
    at('2026-06-20T02:30:00.000Z'); // 08:00 IST on 06-20 — D-2 window opens at 09:00
    const {svc} = makeService();
    await expect(
      svc.bookSlot(USER, COURSE, VERSION, SLOT, undefined, '2026-06-22'),
    ).rejects.toThrowError(/hasn't opened/i);
  });

  it('allows the day-after-tomorrow from its 9 AM open time', async () => {
    at('2026-06-20T03:30:00.000Z'); // 09:00 IST on 06-20 — D-2 window just opened
    const {svc, slotBookingRepo} = makeService();
    await svc.bookSlot(USER, COURSE, VERSION, SLOT, undefined, '2026-06-22');
    expect(slotBookingRepo.createBooking).toHaveBeenCalledOnce();
  });

  it('rejects a day too far in the future (outside the window)', async () => {
    at('2026-06-20T02:30:00.000Z');
    const {svc} = makeService();
    await expect(
      svc.bookSlot(USER, COURSE, VERSION, SLOT, undefined, '2026-06-25'),
    ).rejects.toThrowError(/hasn't opened/i);
  });
});

describe('SlotBookingService.cancelBooking', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects cancelling a non-existent booking', async () => {
    const {svc} = makeService({bookingById: null});
    await expect(svc.cancelBooking(USER, 'b1')).rejects.toThrowError(
      /not found/i,
    );
  });

  it("rejects cancelling someone else's booking", async () => {
    const {svc} = makeService({bookingById: {userId: 'other-user'}});
    await expect(svc.cancelBooking(USER, 'b1')).rejects.toThrowError(
      /your own/i,
    );
  });

  it('cancels the student own booking', async () => {
    const {svc, slotBookingRepo} = makeService({
      bookingById: {userId: USER},
    });
    const ok = await svc.cancelBooking(USER, 'b1');
    expect(ok).toBe(true);
    expect(slotBookingRepo.cancelBooking).toHaveBeenCalledWith('b1', {});
  });
});

describe('SlotBookingService.getStudentBookings', () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the student's active bookings for a given IST day", async () => {
    const mine = [
      {_id: 'b1', from: '13:00', to: '15:00', status: SlotBookingStatus.BOOKED},
    ];
    const {svc, slotBookingRepo} = makeService({myBookings: mine});

    const res = await svc.getStudentBookings(USER, COURSE, VERSION, '2026-06-17');

    expect(res).toEqual(mine);
    expect(slotBookingRepo.findActiveForStudent).toHaveBeenCalledWith(
      USER,
      COURSE,
      VERSION,
      '2026-06-17',
    );
  });
});

describe('SlotBookingService.getSlotDemand', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports booked load and remaining capacity per window', async () => {
    const {svc, slotBookingRepo} = makeService({
      timeslots: {
        isActive: true,
        slots: [
          {from: '09:00', to: '10:00', studentIds: [], maxStudents: 30},
          {from: '13:00', to: '15:00', studentIds: []}, // uncapped
        ],
        dailyBaseAllowance: 1,
      },
    });
    slotBookingRepo.countActiveInSlot
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(12);

    const demand = await svc.getSlotDemand(COURSE, VERSION, '2026-01-15');

    expect(demand.date).toBe('2026-01-15');
    expect(demand.isActive).toBe(true);
    expect(demand.slots).toEqual([
      {from: '09:00', to: '10:00', maxStudents: 30, booked: 5, remaining: 25},
      {from: '13:00', to: '15:00', maxStudents: null, booked: 12, remaining: null},
    ]);
  });

  it('returns an empty schedule when no config exists', async () => {
    const {svc} = makeService({timeslots: null});
    const demand = await svc.getSlotDemand(COURSE, VERSION, '2026-01-15');
    expect(demand).toEqual({date: '2026-01-15', isActive: false, slots: []});
  });
});
