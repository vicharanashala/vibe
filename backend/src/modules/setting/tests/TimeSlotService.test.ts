import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimeSlotService } from '../services/TimeSlotService.js';
import {
  SlotBookingKind,
  SlotBookingStatus,
} from '#shared/interfaces/models.js';

/**
 * Unit tests for TimeSlotService.canStudentAccessCourse — the access gate that
 * decides whether a student may open a course item based on the course's
 * time-slot ("commitment") booking config and the student's booked slot(s).
 *
 * The gate logic (all times IST):
 *  - feature inactive / no config           -> ALLOW
 *  - active, student not enrolled            -> DENY  ("not enrolled")
 *  - active, slots defined, student unbooked -> DENY  ("must book a time slot")
 *  - active, NO slots defined, unbooked      -> ALLOW (don't lock everyone out)
 *  - active, booked, now inside any slot     -> ALLOW
 *  - active, booked, now outside all slots   -> DENY  ("only allowed during ...")
 *
 * The DB is bypassed by stubbing BaseService._withTransaction, and the system
 * clock is faked so the IST window checks are deterministic.
 */

const USER = 'student-1';
const COURSE = 'course-1';
const VERSION = 'version-1';

function makeService(
  opts: {
    timeslots?: { isActive: boolean; slots: any[]; dailyBaseAllowance?: number } | null;
    enrollment?: {
      _id?: string;
      assignedTimeSlots?: { from: string; to: string }[];
    } | null;
    version?: { courseId: string; itemCounts?: Record<string, number> } | null;
    bookings?: { date: string; from: string; to: string }[];
  } = {},
) {
  const {
    timeslots = null,
    enrollment = undefined,
    version = { courseId: COURSE },
    bookings = [],
  } = opts;

  const settingsRepo = {
    readTimeslotsSettings: vi.fn().mockResolvedValue(timeslots),
    updateTimeslotsSettings: vi.fn().mockResolvedValue({acknowledged: true}),
  };
  const courseRepo = {
    read: vi.fn().mockResolvedValue({ _id: COURSE }),
    readVersion: vi.fn().mockResolvedValue(version),
  };
  const enrollmentService = {
    findEnrollment: vi.fn().mockResolvedValue(enrollment),
    addMultipleTimeSlotsToStudent: vi.fn().mockResolvedValue(true),
    updateStudentTimeSlot: vi.fn().mockResolvedValue(true),
    grantCommitmentExtraHours: vi.fn().mockResolvedValue(5),
  };
  const slotBookingRepo = {
    // Date-aware: return only the bookings whose date matches the queried day.
    findActiveForStudent: vi
      .fn()
      .mockImplementation((_u: string, _c: string, _v: string, date?: string) =>
        Promise.resolve(bookings.filter(b => !date || b.date === date)),
      ),
    createBooking: vi.fn().mockResolvedValue({_id: 'booking-new'}),
    // Capacity guard: how many active bookings a slot already holds. Default 0;
    // override per-test to exercise the "don't cap below booked" clamp.
    countActiveInSlot: vi.fn().mockResolvedValue(0),
  };
  const db = {} as any;

  const svc = new TimeSlotService(
    settingsRepo as any,
    courseRepo as any,
    enrollmentService as any,
    db,
    slotBookingRepo as any,
  );

  // Run transaction callbacks immediately with a dummy session — no real DB.
  vi.spyOn(svc as any, '_withTransaction').mockImplementation((fn: any) => fn({}));

  return { svc, settingsRepo, enrollmentService, courseRepo, slotBookingRepo };
}

/**
 * Freeze the clock so that the current IST wall-clock equals hh:mm.
 * getCurrentISTTime() computes (UTC now + 5:30), so set UTC = (hh:mm - 5:30).
 */
function setNowToIST(hh: number, mm: number) {
  const utcMinutes = (hh * 60 + mm - 330 + 1440) % 1440;
  const uh = Math.floor(utcMinutes / 60);
  const um = utcMinutes % 60;
  vi.setSystemTime(new Date(Date.UTC(2026, 0, 15, uh, um, 0)));
}

const slot = (from: string, to: string) => ({ from, to, studentIds: [USER] });

describe('TimeSlotService.canStudentAccessCourse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows access when the time-slot feature is inactive', async () => {
    const { svc, enrollmentService } = makeService({
      timeslots: { isActive: false, slots: [] },
    });

    const res = await svc.canStudentAccessCourse(USER, COURSE, VERSION);

    expect(res.canAccess).toBe(true);
    // Should short-circuit before even looking up the enrollment.
    expect(enrollmentService.findEnrollment).not.toHaveBeenCalled();
  });

  it('allows access when there is no time-slot config at all', async () => {
    const { svc } = makeService({ timeslots: null });

    const res = await svc.canStudentAccessCourse(USER, COURSE, VERSION);

    expect(res.canAccess).toBe(true);
  });

  it('denies access when the student is not enrolled', async () => {
    const { svc } = makeService({
      timeslots: { isActive: true, slots: [slot('13:00', '15:00')] },
      enrollment: null,
    });

    const res = await svc.canStudentAccessCourse(USER, COURSE, VERSION);

    expect(res.canAccess).toBe(false);
    expect(res.message).toMatch(/not enrolled/i);
  });

  it('denies access when active with slots but the student has not booked one', async () => {
    const { svc } = makeService({
      timeslots: { isActive: true, slots: [slot('13:00', '15:00')] },
      enrollment: { assignedTimeSlots: [] },
    });

    const res = await svc.canStudentAccessCourse(USER, COURSE, VERSION);

    expect(res.canAccess).toBe(false);
    expect(res.message).toMatch(/book a time slot/i);
  });

  it('allows access when active but no slots are defined yet (avoids locking everyone out)', async () => {
    const { svc } = makeService({
      timeslots: { isActive: true, slots: [] },
      enrollment: { assignedTimeSlots: [] },
    });

    const res = await svc.canStudentAccessCourse(USER, COURSE, VERSION);

    expect(res.canAccess).toBe(true);
  });

  it('allows access when the current time is inside the booked slot', async () => {
    setNowToIST(14, 0); // 14:00 IST, inside 13:00–15:00
    const { svc } = makeService({
      timeslots: { isActive: true, slots: [slot('13:00', '15:00')] },
      enrollment: { assignedTimeSlots: [{ from: '13:00', to: '15:00' }] },
    });

    const res = await svc.canStudentAccessCourse(USER, COURSE, VERSION);

    expect(res.canAccess).toBe(true);
  });

  it('denies access when the current time is OUTSIDE the booked slot', async () => {
    setNowToIST(16, 30); // 16:30 IST, after 13:00–15:00
    const { svc } = makeService({
      timeslots: { isActive: true, slots: [slot('13:00', '15:00')] },
      enrollment: { assignedTimeSlots: [{ from: '13:00', to: '15:00' }] },
    });

    const res = await svc.canStudentAccessCourse(USER, COURSE, VERSION);

    expect(res.canAccess).toBe(false);
    expect(res.message).toMatch(/only allowed during/i);
    expect(res.message).toContain('13:00 to 15:00');
  });

  it('allows access when the current time falls in one of several booked slots', async () => {
    setNowToIST(9, 30); // 09:30 IST, inside the first slot
    const { svc } = makeService({
      timeslots: {
        isActive: true,
        slots: [slot('09:00', '10:00'), slot('13:00', '15:00')],
      },
      enrollment: {
        assignedTimeSlots: [
          { from: '09:00', to: '10:00' },
          { from: '13:00', to: '15:00' },
        ],
      },
    });

    const res = await svc.canStudentAccessCourse(USER, COURSE, VERSION);

    expect(res.canAccess).toBe(true);
  });

  it('treats the slot boundaries as inclusive (start and end minute allow access)', async () => {
    const { svc } = makeService({
      timeslots: { isActive: true, slots: [slot('13:00', '15:00')] },
      enrollment: { assignedTimeSlots: [{ from: '13:00', to: '15:00' }] },
    });

    setNowToIST(13, 0); // exactly at start
    expect((await svc.canStudentAccessCourse(USER, COURSE, VERSION)).canAccess).toBe(true);

    setNowToIST(15, 0); // exactly at end
    expect((await svc.canStudentAccessCourse(USER, COURSE, VERSION)).canAccess).toBe(true);
  });

  // --- dual-read: NEW slotBookings path (alongside the legacy assignedTimeSlots) ---

  it('allows access via a slot booking covering now (no legacy slot)', async () => {
    setNowToIST(14, 0); // inside 13:00–15:00 on 2026-01-15
    const { svc } = makeService({
      timeslots: { isActive: true, slots: [slot('13:00', '15:00')] },
      enrollment: {}, // no assignedTimeSlots — only the new booking
      bookings: [{ date: '2026-01-15', from: '13:00', to: '15:00' }],
    });

    const res = await svc.canStudentAccessCourse(USER, COURSE, VERSION);
    expect(res.canAccess).toBe(true);
  });

  it('denies when a booking exists but the current time is outside it', async () => {
    setNowToIST(16, 30); // after 13:00–15:00
    const { svc } = makeService({
      timeslots: { isActive: true, slots: [slot('13:00', '15:00')] },
      enrollment: {},
      bookings: [{ date: '2026-01-15', from: '13:00', to: '15:00' }],
    });

    const res = await svc.canStudentAccessCourse(USER, COURSE, VERSION);
    expect(res.canAccess).toBe(false);
    expect(res.message).toMatch(/only allowed during/i);
  });

  it('honors an overnight booking after midnight (booked the previous day)', async () => {
    // setNowToIST pins UTC to Jan 15, so IST 00:30 lands on Jan 16; the evening
    // window was therefore booked on the previous IST day, Jan 15.
    setNowToIST(0, 30);
    const { svc } = makeService({
      timeslots: { isActive: true, slots: [slot('22:00', '01:00')] },
      enrollment: {},
      bookings: [{ date: '2026-01-15', from: '22:00', to: '01:00' }],
    });

    const res = await svc.canStudentAccessCourse(USER, COURSE, VERSION);
    expect(res.canAccess).toBe(true);
  });

  it('denies (must book) when neither a booking nor a legacy slot exists', async () => {
    setNowToIST(14, 0);
    const { svc } = makeService({
      timeslots: { isActive: true, slots: [slot('13:00', '15:00')] },
      enrollment: {}, // no legacy slot, no bookings
      bookings: [],
    });

    const res = await svc.canStudentAccessCourse(USER, COURSE, VERSION);
    expect(res.canAccess).toBe(false);
    expect(res.message).toMatch(/book a time slot/i);
  });
});

describe('TimeSlotService.canStudentAccessCourseByVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves courseId from the version and denies outside the booked slot', async () => {
    setNowToIST(16, 30); // outside 13:00–15:00
    const { svc, courseRepo, settingsRepo } = makeService({
      version: { courseId: COURSE },
      timeslots: { isActive: true, slots: [slot('13:00', '15:00')] },
      enrollment: { assignedTimeSlots: [{ from: '13:00', to: '15:00' }] },
    });

    const res = await svc.canStudentAccessCourseByVersion(USER, VERSION);

    expect(courseRepo.readVersion).toHaveBeenCalledWith(VERSION);
    expect(settingsRepo.readTimeslotsSettings).toHaveBeenCalled(); // delegated through
    expect(res.canAccess).toBe(false);
    expect(res.message).toMatch(/only allowed during/i);
  });

  it('allows access when inside the booked slot (via version lookup)', async () => {
    setNowToIST(14, 0); // inside 13:00–15:00
    const { svc } = makeService({
      version: { courseId: COURSE },
      timeslots: { isActive: true, slots: [slot('13:00', '15:00')] },
      enrollment: { assignedTimeSlots: [{ from: '13:00', to: '15:00' }] },
    });

    const res = await svc.canStudentAccessCourseByVersion(USER, VERSION);

    expect(res.canAccess).toBe(true);
  });

  it('denies and does not run the gate when the version cannot be found', async () => {
    const { svc, settingsRepo } = makeService({ version: null });

    const res = await svc.canStudentAccessCourseByVersion(USER, VERSION);

    expect(res.canAccess).toBe(false);
    expect(res.message).toMatch(/version not found/i);
    expect(settingsRepo.readTimeslotsSettings).not.toHaveBeenCalled();
  });
});

describe('TimeSlotService.chooseTimeSlot (dual-write)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('records a slot booking when a student chooses a slot', async () => {
    setNowToIST(14, 0);
    const { svc, slotBookingRepo } = makeService({
      timeslots: { isActive: true, slots: [slot('13:00', '15:00')] },
      enrollment: { _id: 'enroll-1' }, // no assignedTimeSlots yet
    });

    const ok = await svc.chooseTimeSlot(
      COURSE,
      VERSION,
      { from: '13:00', to: '15:00' },
      USER,
    );

    expect(ok).toBe(true);
    expect(slotBookingRepo.createBooking).toHaveBeenCalledOnce();
    expect(slotBookingRepo.createBooking.mock.calls[0][0]).toMatchObject({
      userId: USER,
      enrollmentId: 'enroll-1',
      from: '13:00',
      to: '15:00',
      kind: SlotBookingKind.BASE,
      status: SlotBookingStatus.BOOKED,
      hoursReserved: 2,
      overnight: false,
    });
  });

  it('does not write a booking when the student already has a slot', async () => {
    const { svc, slotBookingRepo } = makeService({
      timeslots: { isActive: true, slots: [slot('13:00', '15:00')] },
      enrollment: {
        _id: 'enroll-1',
        assignedTimeSlots: [{ from: '13:00', to: '15:00' }],
      },
    });

    await expect(
      svc.chooseTimeSlot(COURSE, VERSION, { from: '13:00', to: '15:00' }, USER),
    ).rejects.toThrowError(/already have a time slot/i);
    expect(slotBookingRepo.createBooking).not.toHaveBeenCalled();
  });
});

describe('TimeSlotService.toggleTimeSlots (preserve)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('preserves slots and allowance when toggling off', async () => {
    const { svc, settingsRepo } = makeService({
      timeslots: {
        isActive: true,
        slots: [slot('13:00', '15:00')],
        dailyBaseAllowance: 2,
      },
    });

    const ok = await svc.toggleTimeSlots(COURSE, VERSION, false, 'teacher-1');

    expect(ok).toBe(true);
    const saved = settingsRepo.updateTimeslotsSettings.mock.calls[0][2];
    expect(saved.isActive).toBe(false);
    expect(saved.slots).toHaveLength(1); // preserved, not cleared
    expect(saved.dailyBaseAllowance).toBe(2); // preserved
  });

  it('initializes an empty config when none exists', async () => {
    const { svc, settingsRepo } = makeService({ timeslots: null });

    const ok = await svc.toggleTimeSlots(COURSE, VERSION, true, 'teacher-1');

    expect(ok).toBe(true);
    expect(settingsRepo.updateTimeslotsSettings.mock.calls[0][2]).toMatchObject({
      isActive: true,
      slots: [],
    });
  });
});

describe('TimeSlotService.addTimeSlots (teacher dual-write)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mirrors a teacher slot assignment into a slot booking per student', async () => {
    setNowToIST(10, 0);
    const { svc, slotBookingRepo, enrollmentService } = makeService({
      timeslots: { isActive: true, slots: [] },
      enrollment: { _id: 'enroll-1' },
    });

    const ok = await svc.addTimeSlots(
      COURSE,
      VERSION,
      [{ from: '13:00', to: '15:00', studentIds: [USER], maxStudents: 30 }],
      'teacher-1',
    );

    expect(ok).toBe(true);
    expect(enrollmentService.updateStudentTimeSlot).toHaveBeenCalledOnce();
    expect(slotBookingRepo.createBooking).toHaveBeenCalledOnce();
    expect(slotBookingRepo.createBooking.mock.calls[0][0]).toMatchObject({
      userId: USER,
      enrollmentId: 'enroll-1',
      from: '13:00',
      to: '15:00',
      kind: SlotBookingKind.BASE,
      status: SlotBookingStatus.BOOKED,
    });
  });
});

describe('TimeSlotService.configureHoursBudget', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sums the instructor\'s total category hours into the budget', async () => {
    const { svc, settingsRepo } = makeService({
      version: { courseId: COURSE },
      timeslots: { isActive: true, slots: [] },
    });

    // 10h video + 3h quiz + 2h reading + 2h project = 17h
    const res = await svc.configureHoursBudget(
      COURSE,
      VERSION,
      { VIDEO: 10, QUIZ: 3, BLOG: 2, PROJECT: 2 },
      undefined,
      'teacher-1',
    );

    expect(res.totalCategoryHours).toBe(17);
    expect(res.totalBudgetHours).toBe(17);
    const saved = settingsRepo.updateTimeslotsSettings.mock.calls[0][2];
    expect(saved.totalBudgetHours).toBe(17);
    expect(saved.categoryBudgetHours).toEqual({
      VIDEO: 10,
      QUIZ: 3,
      BLOG: 2,
      PROJECT: 2,
    });
  });

  it('applies the hours factor', async () => {
    const { svc } = makeService({
      version: { courseId: COURSE },
    });
    // (4h + 0 + 0 + 0) × 1.5 = 6h
    const res = await svc.configureHoursBudget(
      COURSE,
      VERSION,
      { VIDEO: 4 },
      1.5,
      'teacher-1',
    );
    expect(res.totalCategoryHours).toBe(4);
    expect(res.totalBudgetHours).toBe(6);
  });

  it('rejects when the course version is not found', async () => {
    const { svc } = makeService({ version: null });
    await expect(
      svc.configureHoursBudget(COURSE, VERSION, { VIDEO: 6 }, undefined, 't1'),
    ).rejects.toThrowError(/version not found/i);
  });
});

describe('TimeSlotService.configureFulfillment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes the threshold + bonus and preserves the rest of the config', async () => {
    const { svc, settingsRepo } = makeService({
      timeslots: { isActive: true, slots: [{ from: '09:00', to: '10:00' }], dailyBaseAllowance: 2 },
    });

    const res = await svc.configureFulfillment(COURSE, VERSION, 80, true);

    expect(res).toEqual({ fulfillmentThresholdPct: 80, bonusOnFulfillment: true });
    const saved = settingsRepo.updateTimeslotsSettings.mock.calls[0][2];
    expect(saved).toMatchObject({
      isActive: true,
      dailyBaseAllowance: 2,
      fulfillmentThresholdPct: 80,
      bonusOnFulfillment: true,
    });
    expect(saved.slots).toHaveLength(1); // preserved
  });

  it('defaults the threshold to 90 when not provided', async () => {
    const { svc, settingsRepo } = makeService({ timeslots: { isActive: true, slots: [] } });
    const res = await svc.configureFulfillment(COURSE, VERSION, undefined, false);
    expect(res.fulfillmentThresholdPct).toBe(90);
    expect(settingsRepo.updateTimeslotsSettings.mock.calls[0][2].bonusOnFulfillment).toBe(false);
  });

  it('rejects a threshold outside 0–100', async () => {
    const { svc } = makeService({ timeslots: { isActive: true, slots: [] } });
    await expect(
      svc.configureFulfillment(COURSE, VERSION, 150, true),
    ).rejects.toThrowError(/between 0 and 100/i);
  });
});

describe('TimeSlotService.configureCapacity', () => {
  beforeEach(() => vi.clearAllMocks());

  it('derives per-slot caps from the budget, dividing by max overlap', async () => {
    // Two slots overlap (09–11 and 10–12) → maxOverlap 2. One disjoint (14–15).
    const { svc, settingsRepo } = makeService({
      timeslots: {
        isActive: true,
        slots: [
          { from: '09:00', to: '11:00' },
          { from: '10:00', to: '12:00' },
          { from: '14:00', to: '15:00' },
        ] as any,
        dailyBaseAllowance: 2,
      },
    });

    // 1000 × 0.7 / 2 = 350
    const res = await svc.configureCapacity(COURSE, VERSION, 1000, 0.7);

    expect(res.maxOverlappingWindows).toBe(2);
    expect(res.derivedPerSlotCap).toBe(350);
    expect(res.slots.every(s => s.maxStudents === 350)).toBe(true);

    const saved = settingsRepo.updateTimeslotsSettings.mock.calls[0][2];
    expect(saved).toMatchObject({
      targetConcurrentStudents: 1000,
      capacityHeadroomFactor: 0.7,
      dailyBaseAllowance: 2, // preserved
    });
    expect(saved.slots.every((s: any) => s.maxStudents === 350)).toBe(true);
  });

  it('defaults the headroom factor to 0.7', async () => {
    const { svc } = makeService({
      timeslots: { isActive: true, slots: [{ from: '09:00', to: '10:00' }] as any },
    });
    // disjoint single slot → overlap 1 → 200 × 0.7 / 1 = 140
    const res = await svc.configureCapacity(COURSE, VERSION, 200, undefined);
    expect(res.capacityHeadroomFactor).toBe(0.7);
    expect(res.derivedPerSlotCap).toBe(140);
  });

  it('never caps a slot below its already-booked count', async () => {
    const { svc, slotBookingRepo } = makeService({
      timeslots: { isActive: true, slots: [{ from: '09:00', to: '10:00' }] as any },
    });
    // derived would be 10 × 0.7 / 1 = 7, but the slot already has 12 booked.
    slotBookingRepo.countActiveInSlot.mockResolvedValue(12);

    const res = await svc.configureCapacity(COURSE, VERSION, 10, 0.7);

    expect(res.derivedPerSlotCap).toBe(7);
    expect(res.slots[0].maxStudents).toBe(12); // clamped up to booked
  });

  it('treats back-to-back slots as non-overlapping (overlap 1)', async () => {
    const { svc } = makeService({
      timeslots: {
        isActive: true,
        slots: [
          { from: '09:00', to: '10:00' },
          { from: '10:00', to: '11:00' },
        ] as any,
      },
    });
    const res = await svc.configureCapacity(COURSE, VERSION, 100, 1);
    expect(res.maxOverlappingWindows).toBe(1);
    expect(res.derivedPerSlotCap).toBe(100);
  });

  it('counts an overnight slot as overlapping the early-morning window', async () => {
    // 22:00→02:00 (overnight) overlaps 01:00→03:00 between 01:00 and 02:00.
    const { svc } = makeService({
      timeslots: {
        isActive: true,
        slots: [
          { from: '22:00', to: '02:00' },
          { from: '01:00', to: '03:00' },
        ] as any,
      },
    });
    const res = await svc.configureCapacity(COURSE, VERSION, 100, 1);
    expect(res.maxOverlappingWindows).toBe(2);
  });

  it('rejects a non-positive target', async () => {
    const { svc } = makeService({
      timeslots: { isActive: true, slots: [{ from: '09:00', to: '10:00' }] as any },
    });
    await expect(
      svc.configureCapacity(COURSE, VERSION, 0, 0.7),
    ).rejects.toThrowError(/greater than 0/i);
  });

  it('rejects a headroom factor outside (0, 1]', async () => {
    const { svc } = makeService({
      timeslots: { isActive: true, slots: [{ from: '09:00', to: '10:00' }] as any },
    });
    await expect(
      svc.configureCapacity(COURSE, VERSION, 100, 1.5),
    ).rejects.toThrowError(/between 0/i);
  });

  it('rejects when no slots are defined', async () => {
    const { svc } = makeService({ timeslots: { isActive: true, slots: [] } });
    await expect(
      svc.configureCapacity(COURSE, VERSION, 100, 0.7),
    ).rejects.toThrowError(/No time slots/i);
  });
});

describe('TimeSlotService.extendStudentHours', () => {
  beforeEach(() => vi.clearAllMocks());

  it('grants extra hours and returns the new total', async () => {
    const { svc, enrollmentService } = makeService();

    const res = await svc.extendStudentHours(
      COURSE,
      VERSION,
      'student-9',
      3,
      'teacher-1',
    );

    expect(enrollmentService.grantCommitmentExtraHours).toHaveBeenCalledWith(
      'student-9',
      COURSE,
      VERSION,
      3,
    );
    expect(res.commitmentExtraHours).toBe(5);
  });

  it('rejects a non-positive amount', async () => {
    const { svc, enrollmentService } = makeService();
    await expect(
      svc.extendStudentHours(COURSE, VERSION, 'student-9', 0, 'teacher-1'),
    ).rejects.toThrowError(/greater than 0/i);
    expect(enrollmentService.grantCommitmentExtraHours).not.toHaveBeenCalled();
  });
});
