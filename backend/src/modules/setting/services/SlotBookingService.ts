import {injectable, inject} from 'inversify';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  InternalServerError,
} from 'routing-controllers';
import {
  BaseService,
  MongoDatabase,
  ISettingRepository,
  ISlotBookingRepository,
} from '#shared/index.js';
import {
  ISlotBooking,
  SlotBookingKind,
  SlotBookingStatus,
} from '#shared/interfaces/models.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {EnrollmentService} from '#users/services/EnrollmentService.js';
import {USERS_TYPES} from '#users/types.js';

/**
 * Books and manages per-day slot bookings (the commitment-scheme records).
 *
 * The resource-optimization goal is load scheduling: the per-slot capacity cap
 * is the ceiling on concurrent learners in a window, and the bookings form a
 * demand schedule. This service enforces that ceiling plus each student's daily
 * allowance, in IST.
 */
@injectable()
export class SlotBookingService extends BaseService {
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

  /** How many days before the study day booking opens. */
  private static readonly BOOKING_OPEN_LEAD_DAYS = 2;
  /** Hour (IST) at which booking opens on D-2. */
  private static readonly BOOKING_OPEN_HOUR = 9;

  /** IST "now" as epoch ms whose UTC fields read as the IST wall clock. */
  private getISTNowMs(): number {
    return Date.now() + 5.5 * 60 * 60 * 1000;
  }

  /** Format an IST-space epoch ms (UTC fields = IST wall clock) as YYYY-MM-DD. */
  private formatISTDate(istMs: number): string {
    const ist = new Date(istMs);
    const y = ist.getUTCFullYear();
    const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
    const d = String(ist.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Current calendar date in IST as YYYY-MM-DD. */
  private getCurrentISTDate(): string {
    return this.formatISTDate(this.getISTNowMs());
  }

  /** The IST calendar date a Date was created on (for the per-day allowance). */
  private istDateOf(d: Date): string {
    return this.formatISTDate(d.getTime() + 5.5 * 60 * 60 * 1000);
  }

  /**
   * When booking opens for study day D: 09:00 IST on D-2. Returned as an
   * IST-space epoch ms. A student may book today, tomorrow, and the day after
   * tomorrow (the latter only once its 09:00 IST D-2 open time is reached).
   */
  private bookingOpenMs(date: string): number {
    const [y, m, d] = date.split('-').map(Number);
    const nineAm = Date.UTC(
      y,
      m - 1,
      d,
      SlotBookingService.BOOKING_OPEN_HOUR,
      0,
      0,
      0,
    );
    return (
      nineAm - SlotBookingService.BOOKING_OPEN_LEAD_DAYS * 24 * 60 * 60 * 1000
    );
  }

  /**
   * When a specific slot closes for booking: its own start time on study day D.
   * A slot can be booked right up until it starts; once it has begun it can no
   * longer be booked. Returned as an IST-space epoch ms.
   */
  private slotCloseMs(date: string, from: string): number {
    const [y, m, d] = date.split('-').map(Number);
    const [h, min] = from.split(':').map(Number);
    return Date.UTC(y, m - 1, d, h, min, 0, 0);
  }

  private toMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  /** A window crosses midnight when its start is at/after its end. */
  private isOvernight(from: string, to: string): boolean {
    return this.toMinutes(from) >= this.toMinutes(to);
  }

  /** Window length in hours, handling cross-midnight wrap. */
  private slotHours(from: string, to: string): number {
    let minutes = this.toMinutes(to) - this.toMinutes(from);
    if (minutes <= 0) minutes += 24 * 60;
    return Math.round((minutes / 60) * 100) / 100;
  }

  /**
   * Book a time slot for a study day (defaults to today). A booking for day D is
   * only accepted inside D's booking window — 09:00 IST on D-2 through 09:00 IST
   * on D. Enforces: feature active, the slot is offered, the booking window, no
   * duplicate, the student's per-day allowance, the slot's hard capacity cap, and
   * the course hours budget.
   */
  async bookSlot(
    userId: string,
    courseId: string,
    courseVersionId: string,
    slot: {from: string; to: string},
    cohortId?: string,
    targetDate?: string,
  ): Promise<ISlotBooking> {
    return this._withTransaction(async (session) => {
      const timeslots = await this.settingsRepo.readTimeslotsSettings(
        courseId,
        courseVersionId,
        session,
      );
      if (!timeslots || !timeslots.isActive) {
        throw new BadRequestError(
          'Time slot booking is not enabled for this course.',
        );
      }

      const configured = timeslots.slots.find(
        s => s.from === slot.from && s.to === slot.to,
      );
      if (!configured) {
        throw new NotFoundError(
          'That time slot is not offered for this course.',
        );
      }

      let enrollment = await this.enrollmentService.findEnrollment(
        userId,
        courseId,
        courseVersionId,
        cohortId,
      );
      // The enrollment row's cohortId may be null or differ from the
      // client-sent cohortId; identify the enrolled user, not the cohort, so
      // retry cohort-agnostic before failing (mirrors #1081 / ItemService).
      if (!enrollment && cohortId) {
        enrollment = await this.enrollmentService.findEnrollment(
          userId,
          courseId,
          courseVersionId,
        );
      }
      if (!enrollment) {
        throw new NotFoundError('You are not enrolled in this course.');
      }

      const today = this.getCurrentISTDate();
      const date = targetDate ?? today;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new BadRequestError('Invalid booking date.');
      }

      // The booking window: opens 09:00 IST on D-2, and a slot stays bookable
      // right up until it starts (it closes at its own start time on D).
      const openMs = this.bookingOpenMs(date);
      const closeMs = this.slotCloseMs(date, slot.from);
      const nowMs = this.getISTNowMs();
      if (nowMs < openMs) {
        throw new BadRequestError(
          `Booking for ${date} hasn't opened yet. ` +
            `It opens at 9:00 AM IST on ${this.formatISTDate(openMs)}.`,
        );
      }
      if (nowMs >= closeMs) {
        throw new BadRequestError(
          `Booking for the ${slot.from}–${slot.to} slot on ${date} has closed. ` +
            'A slot can be booked up until it starts.',
        );
      }

      // All of the student's active bookings on this course (any study day).
      const allBookings = await this.slotBookingRepo.findActiveForStudent(
        userId,
        courseId,
        courseVersionId,
        undefined,
        session,
      );

      if (
        allBookings.some(
          b => b.date === date && b.from === slot.from && b.to === slot.to,
        )
      ) {
        throw new BadRequestError(
          'You have already booked this slot for that day.',
        );
      }

      // Allowance is per CALENDAR DAY the booking is made (not per study day):
      // every booking a student creates today shares one daily allowance.
      const baseAllowance = timeslots.dailyBaseAllowance ?? 1;
      const madeToday = allBookings.filter(
        b =>
          (b.bookedOnDate ??
            (b.createdAt ? this.istDateOf(b.createdAt) : undefined)) === today,
      );
      // Phase 3 bonus: when enabled, each window the student FULFILLED today
      // grants one extra booking for today. Bonuses expire daily because this
      // is recomputed from today's fulfillments each time.
      const bonusesToday = timeslots.bonusOnFulfillment
        ? allBookings.filter(
            b =>
              b.status === SlotBookingStatus.FULFILLED &&
              b.fulfilledAt &&
              this.istDateOf(b.fulfilledAt) === today,
          ).length
        : 0;
      const effectiveAllowance = baseAllowance + bonusesToday;
      // A booking beyond the normal daily allowance (base + earned bonus) is
      // only permitted by drawing from the instructor-awarded extra-bookings
      // pool. Such grant bookings bypass the capacity cap and the hours budget.
      const extraBookingsPool =
        (enrollment as {commitmentExtraBookings?: number})
          .commitmentExtraBookings ?? 0;
      const usingGrant = madeToday.length >= effectiveAllowance;
      if (usingGrant && extraBookingsPool <= 0) {
        const earned = bonusesToday > 0 ? ` (+${bonusesToday} bonus)` : '';
        throw new BadRequestError(
          `You have used your ${effectiveAllowance} booking(s) for today${earned}.`,
        );
      }
      // A booking beyond the base allowance is an extra (bonus) booking.
      const kind =
        madeToday.length >= baseAllowance
          ? SlotBookingKind.BONUS
          : SlotBookingKind.BASE;

      const hoursReserved = this.slotHours(slot.from, slot.to);

      // Capacity cap and hours budget apply to normal bookings only; an awarded
      // grant booking bypasses both by design.
      if (!usingGrant) {
        // Hard capacity cap — the per-window concurrency ceiling.
        if (configured.maxStudents) {
          const taken = await this.slotBookingRepo.countActiveInSlot(
            courseId,
            courseVersionId,
            date,
            slot,
            session,
          );
          if (taken >= configured.maxStudents) {
            throw new BadRequestError(
              'This time slot is full. Please choose another.',
            );
          }
        }

        // Per-course hours budget — the "committed hours" ceiling, plus any
        // extra hours an instructor has granted this student. A booking reserves
        // its hours; the student can't exceed their budget. Undefined =
        // unlimited.
        if (timeslots.totalBudgetHours != null) {
          const budget =
            timeslots.totalBudgetHours +
            ((enrollment as {commitmentExtraHours?: number})
              .commitmentExtraHours ?? 0);
          const consumed =
            await this.slotBookingRepo.sumReservedHoursForStudent(
              userId,
              courseId,
              courseVersionId,
              session,
            );
          if (consumed + hoursReserved > budget) {
            const remaining = Math.max(
              0,
              Math.round((budget - consumed) * 100) / 100,
            );
            throw new BadRequestError(
              `This booking (${hoursReserved}h) exceeds your committed hours for this course. ` +
                `You have ${remaining}h of ${budget}h remaining.`,
            );
          }
        }
      }

      const now = new Date();
      const booking: ISlotBooking = {
        userId,
        enrollmentId: enrollment._id,
        courseId,
        courseVersionId,
        cohortId: cohortId ?? undefined,
        date,
        bookedOnDate: today,
        from: slot.from,
        to: slot.to,
        overnight: this.isOvernight(slot.from, slot.to),
        kind,
        status: SlotBookingStatus.BOOKED,
        hoursReserved,
        createdAt: now,
        updatedAt: now,
      };

      const created = await this.slotBookingRepo.createBooking(
        booking,
        session,
      );
      if (!created) {
        throw new InternalServerError('Failed to create the booking.');
      }
      // Draw one from the awarded pool when this booking exceeded the normal
      // daily allowance, so each grant is single-use.
      if (usingGrant) {
        await this.enrollmentService.consumeCommitmentExtraBooking(
          String(enrollment._id),
          session,
        );
      }
      return created;
    });
  }

  /** Cancel one of the student's own bookings (used for re-booking / changes). */
  async cancelBooking(userId: string, bookingId: string): Promise<boolean> {
    return this._withTransaction(async (session) => {
      const booking = await this.slotBookingRepo.findById(bookingId, session);
      if (!booking) {
        throw new NotFoundError('Booking not found.');
      }
      if (String(booking.userId) !== String(userId)) {
        throw new ForbiddenError('You can only cancel your own bookings.');
      }
      return this.slotBookingRepo.cancelBooking(bookingId, session);
    });
  }

  /** A student's active bookings, optionally for a single IST date. */
  async getStudentBookings(
    userId: string,
    courseId: string,
    courseVersionId: string,
    date?: string,
  ): Promise<ISlotBooking[]> {
    return this.slotBookingRepo.findActiveForStudent(
      userId,
      courseId,
      courseVersionId,
      date,
    );
  }

  /**
   * The size of a student's awarded extra-bookings pool — how many bookings
   * they may still make beyond their normal daily allowance. Lets the client
   * keep the "Book" action enabled when an instructor has granted extras.
   */
  async getStudentExtraBookings(
    userId: string,
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
  ): Promise<number> {
    let enrollment = await this.enrollmentService.findEnrollment(
      userId,
      courseId,
      courseVersionId,
      cohortId,
    );
    if (!enrollment && cohortId) {
      enrollment = await this.enrollmentService.findEnrollment(
        userId,
        courseId,
        courseVersionId,
      );
    }
    return (
      (enrollment as {commitmentExtraBookings?: number} | null)
        ?.commitmentExtraBookings ?? 0
    );
  }

  /**
   * Booked load per window for an IST day — the "demand schedule" that lets ops
   * size capacity per window and scale down off-peak. Defaults to today.
   */
  async getSlotDemand(
    courseId: string,
    courseVersionId: string,
    date?: string,
  ): Promise<{
    date: string;
    isActive: boolean;
    slots: Array<{
      from: string;
      to: string;
      maxStudents: number | null;
      booked: number;
      remaining: number | null;
    }>;
  }> {
    const day = date ?? this.getCurrentISTDate();
    const timeslots = await this.settingsRepo.readTimeslotsSettings(
      courseId,
      courseVersionId,
    );
    if (!timeslots) {
      return {date: day, isActive: false, slots: []};
    }

    const slots = await Promise.all(
      timeslots.slots.map(async s => {
        const booked = await this.slotBookingRepo.countActiveInSlot(
          courseId,
          courseVersionId,
          day,
          {from: s.from, to: s.to},
        );
        return {
          from: s.from,
          to: s.to,
          maxStudents: s.maxStudents ?? null,
          booked,
          remaining:
            s.maxStudents != null ? Math.max(0, s.maxStudents - booked) : null,
        };
      }),
    );

    return {date: day, isActive: timeslots.isActive, slots};
  }
}
