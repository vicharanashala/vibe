import {injectable, inject} from 'inversify';
import {
  BaseService,
  MongoDatabase,
  ISettingRepository,
  ISlotBookingRepository,
} from '#shared/index.js';
import {
  ISlotBooking,
  SlotBookingStatus,
} from '#shared/interfaces/models.js';
import {IWatchSession} from '#shared/database/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {EnrollmentService} from '#users/services/EnrollmentService.js';
import {USERS_TYPES} from '#users/types.js';

/** Default share of a window a student must be active to FULFILL it. */
const DEFAULT_THRESHOLD_PCT = 90;
/**
 * Floor for the "finished early" credit: a student who engaged DENSELY (active
 * >= threshold of the time they were present) but left before the booked window
 * ended still fulfills, provided they put in at least this many minutes — or the
 * whole window if it is shorter. Stops a token 5-minute appearance from passing
 * while not punishing someone who did their work and left.
 */
const EARLY_FINISH_MIN_MINUTES = 45;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export interface FulfillmentRunSummary {
  evaluated: number;
  fulfilled: number;
  unfulfilled: number;
  skipped: number; // window not yet ended
}

/**
 * Phase 3 of the commitment scheme: at a booked window's end, measure how long
 * the student was actually active (from watchTime pings) and mark the booking
 * FULFILLED or UNFULFILLED. A FULFILLED window is what later grants a bonus
 * booking (see SlotBookingService.bookSlot, gated by `bonusOnFulfillment`).
 *
 * This is an accountability signal, not an access gate — it only annotates
 * bookings, so it is safe to run on every active course.
 */
@injectable()
export class FulfillmentService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.SlotBookingRepo)
    private readonly slotBookingRepo: ISlotBookingRepository,

    @inject(GLOBAL_TYPES.SettingRepo)
    private readonly settingsRepo: ISettingRepository,

    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,

    @inject(GLOBAL_TYPES.Database)
    private readonly mongoDatabase: MongoDatabase,
  ) {
    super(mongoDatabase);
  }

  private toMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  /** Current calendar date in IST as YYYY-MM-DD. */
  private istDate(nowMs: number): string {
    const ist = new Date(nowMs + IST_OFFSET_MS);
    const y = ist.getUTCFullYear();
    const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
    const d = String(ist.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Absolute UTC [start, end) instants for a booking's window. `from`/`to` are
   * HH:MM IST on `date`; an overnight window (from >= to) ends the next day.
   */
  private windowBoundsUTC(booking: {
    date: string;
    from: string;
    to: string;
  }): {startUTC: Date; endUTC: Date; minutes: number} {
    const [y, m, d] = booking.date.split('-').map(Number);
    const fromMin = this.toMinutes(booking.from);
    let toMin = this.toMinutes(booking.to);
    if (toMin <= fromMin) toMin += 24 * 60; // overnight wrap
    // IST wall-clock midnight of `date` as a UTC instant.
    const dayStartUTC = Date.UTC(y, m - 1, d) - IST_OFFSET_MS;
    const startUTC = new Date(dayStartUTC + fromMin * 60 * 1000);
    const endUTC = new Date(dayStartUTC + toMin * 60 * 1000);
    return {startUTC, endUTC, minutes: toMin - fromMin};
  }

  /** Active minutes within [startUTC, endUTC) across overlapping sessions. */
  private activeMinutes(
    sessions: IWatchSession[],
    startUTC: Date,
    endUTC: Date,
  ): number {
    const winStart = startUTC.getTime();
    const winEnd = endUTC.getTime();
    let ms = 0;
    for (const s of sessions) {
      const start = s.startTime.getTime();
      // A session with no clean endTime is treated as active up to its last
      // ping; clamp a never-stopped session to the window end.
      const endSource = s.endTime ?? s.lastSeenAt ?? s.startTime;
      const end = endSource.getTime();
      const overlap = Math.min(end, winEnd) - Math.max(start, winStart);
      if (overlap > 0) ms += overlap;
    }
    return ms / 60000;
  }

  /**
   * The latest instant (ms) the student was active within [startUTC, endUTC), or
   * null if never active. Used to measure engagement DENSITY up to when they
   * stopped, so finishing early isn't read as idleness.
   */
  private lastActiveWithin(
    sessions: IWatchSession[],
    startUTC: Date,
    endUTC: Date,
  ): number | null {
    const winStart = startUTC.getTime();
    const winEnd = endUTC.getTime();
    let last: number | null = null;
    for (const s of sessions) {
      const endSource = s.endTime ?? s.lastSeenAt ?? s.startTime;
      const end = Math.min(endSource.getTime(), winEnd);
      if (end > winStart) last = last === null ? end : Math.max(last, end);
    }
    return last;
  }

  /**
   * Evaluate every still-BOOKED booking whose window has ended as of `now`.
   * Settings are read once per course version. Returns a run summary.
   */
  async evaluateDueBookings(now: Date = new Date()): Promise<FulfillmentRunSummary> {
    const nowMs = now.getTime();
    const today = this.istDate(nowMs);
    const due = await this.slotBookingRepo.findBookingsToEvaluate(today);

    const summary: FulfillmentRunSummary = {
      evaluated: 0,
      fulfilled: 0,
      unfulfilled: 0,
      skipped: 0,
    };
    const thresholdCache = new Map<string, number | null>();
    // "Has the student finished the course?" cached per student+version — a
    // completed student has no remaining work, so an unused slot isn't wasted.
    const noRemainingWorkCache = new Map<string, boolean>();

    for (const booking of due) {
      const {startUTC, endUTC, minutes} = this.windowBoundsUTC(booking);
      // The window must have fully ended before we judge it.
      if (endUTC.getTime() > nowMs) {
        summary.skipped++;
        continue;
      }

      const courseId = String(booking.courseId);
      const versionId = String(booking.courseVersionId);
      const cacheKey = `${courseId}:${versionId}`;
      let threshold = thresholdCache.get(cacheKey);
      if (threshold === undefined) {
        const ts = await this.settingsRepo.readTimeslotsSettings(
          courseId,
          versionId,
        );
        threshold = ts?.isActive
          ? ts.fulfillmentThresholdPct ?? DEFAULT_THRESHOLD_PCT
          : null; // feature off → don't evaluate
        thresholdCache.set(cacheKey, threshold);
      }
      if (threshold === null) {
        summary.skipped++;
        continue;
      }

      const sessions = await this.slotBookingRepo.findWatchSessionsOverlapping(
        String(booking.userId),
        courseId,
        versionId,
        startUTC,
        endUTC,
      );
      const active = this.activeMinutes(sessions, startUTC, endUTC);
      const activePct =
        minutes > 0 ? Math.min(100, Math.round((active / minutes) * 100)) : 0;

      // (1) Engaged across the full booked window — the original rule.
      let fulfilled = activePct >= threshold;

      // (2) Finished early: engaged DENSELY (>= threshold of the time present)
      // and put in a real session, then left before the window closed. A booked
      // window longer than the work shouldn't read as wasted.
      if (!fulfilled && active > 0) {
        const lastActive = this.lastActiveWithin(sessions, startUTC, endUTC);
        const engagedMin = lastActive
          ? (lastActive - startUTC.getTime()) / 60000
          : 0;
        const densityPct =
          engagedMin > 0
            ? Math.min(100, Math.round((active / engagedMin) * 100))
            : 0;
        const minActive = Math.min(minutes, EARLY_FINISH_MIN_MINUTES);
        if (active >= minActive && densityPct >= threshold) fulfilled = true;
      }

      // (3) No remaining work: a student who has completed the course has
      // nothing left to do in the slot, so don't mark it unfulfilled.
      if (!fulfilled) {
        const userId = String(booking.userId);
        const cohortId = booking.cohortId ? String(booking.cohortId) : '';
        const workKey = `${userId}:${versionId}:${cohortId}`;
        let noWork = noRemainingWorkCache.get(workKey);
        if (noWork === undefined) {
          try {
            const enrollment = await this.enrollmentService.findEnrollment(
              userId,
              courseId,
              versionId,
              cohortId || undefined,
            );
            noWork =
              ((enrollment as {percentCompleted?: number} | null)
                ?.percentCompleted ?? 0) >= 100;
          } catch {
            // Lookup failed (e.g. archived version) — assume work remains rather
            // than crash the run; the slot stays evaluated on engagement alone.
            noWork = false;
          }
          noRemainingWorkCache.set(workKey, noWork);
        }
        if (noWork) fulfilled = true;
      }

      const status = fulfilled
        ? SlotBookingStatus.FULFILLED
        : SlotBookingStatus.UNFULFILLED;

      await this.slotBookingRepo.setFulfillment(
        String((booking as ISlotBooking)._id),
        status,
        activePct,
        now,
      );
      summary.evaluated++;
      if (status === SlotBookingStatus.FULFILLED) summary.fulfilled++;
      else summary.unfulfilled++;
    }

    return summary;
  }
}
