import {ClientSession} from 'mongodb';
import {ISlotBooking, SlotBookingStatus} from '../../interfaces/models.js';

/** A watch-time session reduced to the fields the fulfillment evaluator needs. */
export interface IWatchSession {
  startTime: Date;
  endTime?: Date;
  lastSeenAt?: Date;
}

/**
 * Repository for per-day slot bookings (the commitment-scheme booking records).
 * Each booking is one student reserving one recurring time window for one date.
 */
export interface ISlotBookingRepository {
  /** Persist a new booking. */
  createBooking(
    booking: ISlotBooking,
    session?: ClientSession,
  ): Promise<ISlotBooking | null>;

  /** Fetch a single non-cancelled booking by id. */
  findById(
    bookingId: string,
    session?: ClientSession,
  ): Promise<ISlotBooking | null>;

  /**
   * Active (non-cancelled, non-deleted) bookings for a student on a course
   * version. Pass `date` (YYYY-MM-DD IST) to restrict to a single day.
   */
  findActiveForStudent(
    userId: string,
    courseId: string,
    courseVersionId: string,
    date?: string,
    session?: ClientSession,
  ): Promise<ISlotBooking[]>;

  /** Count active bookings in a given slot on a given date (capacity check). */
  countActiveInSlot(
    courseId: string,
    courseVersionId: string,
    date: string,
    slot: {from: string; to: string},
    session?: ClientSession,
  ): Promise<number>;

  /**
   * Total `hoursReserved` across a student's active (non-cancelled) bookings on
   * a course version — i.e. the hours they've consumed from their budget.
   */
  sumReservedHoursForStudent(
    userId: string,
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<number>;

  /**
   * Total `hoursReserved` a student has LOST to UNFULFILLED (unused) bookings on
   * a course version — hours spent from the budget with nothing gained. Pass
   * `sinceDate` (YYYY-MM-DD IST) to only count recent misses, so the warning
   * decays as the student gets back on track rather than being an all-time tally.
   */
  sumUnfulfilledHoursForStudent(
    userId: string,
    courseId: string,
    courseVersionId: string,
    sinceDate?: string,
    session?: ClientSession,
  ): Promise<number>;

  /** Mark a booking cancelled (student re-book or instructor removal). */
  cancelBooking(
    bookingId: string,
    session?: ClientSession,
  ): Promise<boolean>;

  /**
   * Still-BOOKED bookings whose study day is on or before `onOrBeforeDate`
   * (YYYY-MM-DD IST) — the candidates whose window may have ended and so are
   * due for fulfillment evaluation (Phase 3).
   */
  findBookingsToEvaluate(
    onOrBeforeDate: string,
    session?: ClientSession,
  ): Promise<ISlotBooking[]>;

  /**
   * Record a fulfillment verdict on a booking: set status
   * (FULFILLED/UNFULFILLED), the measured `activePct`, and `fulfilledAt`.
   */
  setFulfillment(
    bookingId: string,
    status: SlotBookingStatus,
    activePct: number,
    fulfilledAt: Date,
    session?: ClientSession,
  ): Promise<boolean>;

  /**
   * Watch-time sessions for a student on a course version that overlap the
   * [startUTC, endUTC) instant range — used to measure how long the student was
   * active during a booked window.
   */
  findWatchSessionsOverlapping(
    userId: string,
    courseId: string,
    courseVersionId: string,
    startUTC: Date,
    endUTC: Date,
    session?: ClientSession,
  ): Promise<IWatchSession[]>;
}
