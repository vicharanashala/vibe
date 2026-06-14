import {ClientSession} from 'mongodb';
import {ISlotBooking} from '../../interfaces/models.js';

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

  /** Mark a booking cancelled (student re-book or instructor removal). */
  cancelBooking(
    bookingId: string,
    session?: ClientSession,
  ): Promise<boolean>;
}
