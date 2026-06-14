import 'reflect-metadata';
import {Collection, ObjectId, ClientSession} from 'mongodb';
import {injectable, inject} from 'inversify';
import {MongoDatabase} from '../MongoDatabase.js';
import {
  ISlotBooking,
  SlotBookingStatus,
} from '#shared/interfaces/models.js';
import {ISlotBookingRepository} from '#shared/database/index.js';
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
  private initialized = false;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async init() {
    if (!this.initialized) {
      this.slotBookingsCollection =
        await this.db.getCollection<ISlotBooking>('slotBookings');
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
}
