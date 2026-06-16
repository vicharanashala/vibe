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

  /** Current calendar date in IST as YYYY-MM-DD. */
  private getCurrentISTDate(): string {
    const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const y = istNow.getUTCFullYear();
    const m = String(istNow.getUTCMonth() + 1).padStart(2, '0');
    const d = String(istNow.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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
   * Book a time slot for the current IST day. Enforces: feature active, the slot
   * is offered, no duplicate, the student's daily allowance, and the slot's hard
   * capacity cap.
   */
  async bookSlot(
    userId: string,
    courseId: string,
    courseVersionId: string,
    slot: {from: string; to: string},
    cohortId?: string,
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

      const date = this.getCurrentISTDate();
      const myBookings = await this.slotBookingRepo.findActiveForStudent(
        userId,
        courseId,
        courseVersionId,
        date,
        session,
      );

      if (myBookings.some(b => b.from === slot.from && b.to === slot.to)) {
        throw new BadRequestError('You have already booked this slot today.');
      }

      const allowance = timeslots.dailyBaseAllowance ?? 1;
      if (myBookings.length >= allowance) {
        throw new BadRequestError(
          `You have used your ${allowance} booking(s) for today.`,
        );
      }

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

      const hoursReserved = this.slotHours(slot.from, slot.to);

      // Per-course hours budget — the "committed hours" ceiling, plus any extra
      // hours an instructor has granted this student. A booking reserves its
      // hours; the student can't exceed their budget. Undefined = unlimited.
      if (timeslots.totalBudgetHours != null) {
        const budget =
          timeslots.totalBudgetHours +
          ((enrollment as {commitmentExtraHours?: number})
            .commitmentExtraHours ?? 0);
        const consumed = await this.slotBookingRepo.sumReservedHoursForStudent(
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

      const now = new Date();
      const booking: ISlotBooking = {
        userId,
        enrollmentId: enrollment._id,
        courseId,
        courseVersionId,
        cohortId: cohortId ?? undefined,
        date,
        from: slot.from,
        to: slot.to,
        overnight: this.isOvernight(slot.from, slot.to),
        kind: SlotBookingKind.BASE,
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
