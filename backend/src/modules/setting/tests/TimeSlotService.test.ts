import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimeSlotService } from '../services/TimeSlotService.js';

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
    timeslots?: { isActive: boolean; slots: any[] } | null;
    enrollment?: { assignedTimeSlots?: { from: string; to: string }[] } | null;
    version?: { courseId: string } | null;
  } = {},
) {
  const { timeslots = null, enrollment = undefined, version = { courseId: COURSE } } = opts;

  const settingsRepo = {
    readTimeslotsSettings: vi.fn().mockResolvedValue(timeslots),
  };
  const courseRepo = {
    readVersion: vi.fn().mockResolvedValue(version),
  };
  const enrollmentService = {
    findEnrollment: vi.fn().mockResolvedValue(enrollment),
  };
  const db = {} as any;

  const svc = new TimeSlotService(
    settingsRepo as any,
    courseRepo as any,
    enrollmentService as any,
    db,
  );

  // Run transaction callbacks immediately with a dummy session — no real DB.
  vi.spyOn(svc as any, '_withTransaction').mockImplementation((fn: any) => fn({}));

  return { svc, settingsRepo, enrollmentService, courseRepo };
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
