import 'reflect-metadata';
import {Collection, ObjectId, ClientSession} from 'mongodb';
import {injectable, inject} from 'inversify';
import {MongoDatabase} from '../MongoDatabase.js';
import {
  ISlotBooking,
  IWatchTime,
  SlotBookingStatus,
} from '#shared/interfaces/models.js';
import {
  ISlotBookingRepository,
  IWatchSession,
} from '#shared/database/index.js';
import {GLOBAL_TYPES} from '#root/types.js';

/** Accepts a string or ObjectId and returns an ObjectId. */
const oid = (value: string | ObjectId | null | undefined): ObjectId =>
  value instanceof ObjectId ? value : new ObjectId(String(value));

/**
 * MongoDB implementation of the slot-bookings repository — the per-day
 * commitment records for the time-slot booking feature.
 */
@injectable()
export class SlotBookingRepository implements ISlotBookingRepository {
  private slotBookingsCollection: Collection<ISlotBooking>;
  private watchTimeCollection: Collection<IWatchTime>;
  private initialized = false;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async init() {
    if (!this.initialized) {
      this.slotBookingsCollection =
        await this.db.getCollection<ISlotBooking>('slotBookings');
      this.watchTimeCollection =
        await this.db.getCollection<IWatchTime>('watchTime');
      this.initialized = true;

      // Look up a student's bookings for a course/day fast.
      this.slotBookingsCollection.createIndex({
        userId: 1,
        courseId: 1,
        courseVersionId: 1,
        date: 1,
        status: 1,
      });
      // Capacity counts per slot per day.
      this.slotBookingsCollection.createIndex({
        courseId: 1,
        courseVersionId: 1,
        date: 1,
        from: 1,
        to: 1,
        status: 1,
      });
    }
  }

  async createBooking(
    booking: ISlotBooking,
    session?: ClientSession,
  ): Promise<ISlotBooking | null> {
    await this.init();
    const now = new Date();
    const doc: ISlotBooking = {
      ...booking,
      userId: oid(booking.userId),
      enrollmentId: oid(booking.enrollmentId),
      courseId: oid(booking.courseId),
      courseVersionId: oid(booking.courseVersionId),
      cohortId: booking.cohortId ? oid(booking.cohortId) : undefined,
      createdAt: booking.createdAt ?? now,
      updatedAt: now,
      isDeleted: false,
    };

    const result = await this.slotBookingsCollection.insertOne(doc as any, {
      session,
    });
    return {...doc, _id: result.insertedId};
  }

  async findById(
    bookingId: string,
    session?: ClientSession,
  ): Promise<ISlotBooking | null> {
    await this.init();
    return this.slotBookingsCollection.findOne(
      {
        _id: new ObjectId(bookingId),
        status: {$ne: SlotBookingStatus.CANCELLED},
        isDeleted: {$ne: true},
      } as any,
      {session},
    );
  }

  async findActiveForStudent(
    userId: string,
    courseId: string,
    courseVersionId: string,
    date?: string,
    session?: ClientSession,
  ): Promise<ISlotBooking[]> {
    await this.init();
    const query: Record<string, unknown> = {
      userId: new ObjectId(userId),
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
      status: {$ne: SlotBookingStatus.CANCELLED},
      isDeleted: {$ne: true},
    };
    if (date) query.date = date;
    return this.slotBookingsCollection.find(query as any, {session}).toArray();
  }

  async countActiveInSlot(
    courseId: string,
    courseVersionId: string,
    date: string,
    slot: {from: string; to: string},
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    return this.slotBookingsCollection.countDocuments(
      {
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
        date,
        from: slot.from,
        to: slot.to,
        status: {$ne: SlotBookingStatus.CANCELLED},
        isDeleted: {$ne: true},
      } as any,
      {session},
    );
  }

  async sumReservedHoursForStudent(
    userId: string,
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    const result = await this.slotBookingsCollection
      .aggregate(
        [
          {
            $match: {
              userId: new ObjectId(userId),
              courseId: new ObjectId(courseId),
              courseVersionId: new ObjectId(courseVersionId),
              status: {$ne: SlotBookingStatus.CANCELLED},
              isDeleted: {$ne: true},
            },
          },
          {$group: {_id: null, total: {$sum: '$hoursReserved'}}},
        ],
        {session},
      )
      .toArray();
    return result.length > 0 ? (result[0] as any).total ?? 0 : 0;
  }

  /**
   * Sum the reserved hours a student has LOST to unused slots — bookings that
   * ended UNFULFILLED (booked but not attended enough). These hours are spent
   * from the budget with nothing to show for them.
   */
  async sumUnfulfilledHoursForStudent(
    userId: string,
    courseId: string,
    courseVersionId: string,
    sinceDate?: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    const match: Record<string, unknown> = {
      userId: new ObjectId(userId),
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
      status: SlotBookingStatus.UNFULFILLED,
      isDeleted: {$ne: true},
    };
    // `date` is YYYY-MM-DD IST, so a lexical >= is a correct date comparison.
    if (sinceDate) match.date = {$gte: sinceDate};
    const result = await this.slotBookingsCollection
      .aggregate(
        [
          {
            $match: match,
          },
          {$group: {_id: null, total: {$sum: '$hoursReserved'}}},
        ],
        {session},
      )
      .toArray();
    return result.length > 0 ? (result[0] as any).total ?? 0 : 0;
  }

  async cancelBooking(
    bookingId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();
    const result = await this.slotBookingsCollection.updateOne(
      {_id: new ObjectId(bookingId)} as any,
      {$set: {status: SlotBookingStatus.CANCELLED, updatedAt: new Date()}},
      {session},
    );
    return result.modifiedCount > 0;
  }

  async findBookingsToEvaluate(
    onOrBeforeDate: string,
    session?: ClientSession,
  ): Promise<ISlotBooking[]> {
    await this.init();
    return this.slotBookingsCollection
      .find(
        {
          status: SlotBookingStatus.BOOKED,
          date: {$lte: onOrBeforeDate},
          isDeleted: {$ne: true},
        } as any,
        {session},
      )
      .toArray();
  }

  async setFulfillment(
    bookingId: string,
    status: SlotBookingStatus,
    activePct: number,
    fulfilledAt: Date,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();
    const result = await this.slotBookingsCollection.updateOne(
      {_id: new ObjectId(bookingId)} as any,
      {$set: {status, activePct, fulfilledAt, updatedAt: new Date()}},
      {session},
    );
    return result.modifiedCount > 0;
  }

  async findWatchSessionsOverlapping(
    userId: string,
    courseId: string,
    courseVersionId: string,
    startUTC: Date,
    endUTC: Date,
    session?: ClientSession,
  ): Promise<IWatchSession[]> {
    await this.init();
    // A session overlaps [startUTC, endUTC) when it begins before the window
    // ends and its last known activity is at/after the window start. endTime may
    // be absent for a session that never cleanly stopped — lastSeenAt is the
    // fallback for "still active as of".
    const docs = await this.watchTimeCollection
      .find(
        {
          userId: new ObjectId(userId),
          courseId: new ObjectId(courseId),
          courseVersionId: new ObjectId(courseVersionId),
          startTime: {$lt: endUTC},
          $or: [{endTime: {$gte: startUTC}}, {lastSeenAt: {$gte: startUTC}}],
          isDeleted: {$ne: true},
        } as any,
        {session},
      )
      .toArray();
    return docs.map(d => ({
      startTime: d.startTime,
      endTime: d.endTime,
      lastSeenAt: d.lastSeenAt,
    }));
  }
}
