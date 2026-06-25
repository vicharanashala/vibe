import {SlotBookingService} from '../services/SlotBookingService.js';
import {SETTING_TYPES} from '../types.js';
import {injectable, inject} from 'inversify';
import {
  JsonController,
  Post,
  Get,
  Body,
  Param,
  QueryParam,
  Authorized,
  HttpCode,
  CurrentUser,
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  InternalServerError,
} from 'routing-controllers';
import {OpenAPI} from 'routing-controllers-openapi';
import {IUser} from '#root/shared/index.js';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {
  getItemAbility,
  ItemActions,
} from '#root/modules/courses/abilities/itemAbilities.js';
import {subject} from '@casl/ability';

class BookSlotRequestBody {
  courseId: string;
  courseVersionId: string;
  timeSlot: {from: string; to: string};
  cohortId?: string;
  // Study day to book (YYYY-MM-DD IST). Defaults to today. Must fall inside the
  // booking window: opens 9 AM IST on D-2, closes 9 AM IST on D.
  date?: string;
}

class CancelBookingRequestBody {
  bookingId: string;
}

class BookingResponse {
  success: boolean;
  message?: string;
  data?: any;
}

@OpenAPI({tags: ['Slot Bookings']})
@JsonController('/slot-bookings', {transformResponse: true})
@injectable()
class SlotBookingController {
  constructor(
    @inject(SETTING_TYPES.SlotBookingService)
    private readonly slotBookingService: SlotBookingService,
  ) {}

  @OpenAPI({
    summary: 'Book a time slot',
    description:
      'A student books a time slot for a study day (default today). Booking for day D is open from 9 AM IST on D-2 until 9 AM IST on D, subject to the slot capacity cap and their per-day allowance.',
  })
  @Authorized()
  @Post('/book')
  @HttpCode(200)
  async bookSlot(
    @Body() body: BookSlotRequestBody,
    @CurrentUser() user: IUser,
  ): Promise<BookingResponse> {
    try {
      const booking = await this.slotBookingService.bookSlot(
        user._id.toString(),
        body.courseId,
        body.courseVersionId,
        body.timeSlot,
        body.cohortId,
        body.date,
      );
      return {
        success: true,
        message: 'Time slot booked successfully',
        data: booking,
      };
    } catch (error) {
      if (
        error instanceof BadRequestError ||
        error instanceof NotFoundError ||
        error instanceof ForbiddenError
      ) {
        return {success: false, message: error.message};
      }
      throw new InternalServerError(`Failed to book time slot: ${error}`);
    }
  }

  @OpenAPI({
    summary: 'Cancel a booking',
    description: 'A student cancels one of their own bookings (used to re-book).',
  })
  @Authorized()
  @Post('/cancel')
  @HttpCode(200)
  async cancelBooking(
    @Body() body: CancelBookingRequestBody,
    @CurrentUser() user: IUser,
  ): Promise<BookingResponse> {
    try {
      const ok = await this.slotBookingService.cancelBooking(
        user._id.toString(),
        body.bookingId,
      );
      return {
        success: ok,
        message: ok ? 'Booking cancelled' : 'Failed to cancel booking',
      };
    } catch (error) {
      if (
        error instanceof BadRequestError ||
        error instanceof NotFoundError ||
        error instanceof ForbiddenError
      ) {
        return {success: false, message: error.message};
      }
      throw new InternalServerError(`Failed to cancel booking: ${error}`);
    }
  }

  @OpenAPI({
    summary: "List the student's bookings",
    description:
      "Returns the calling student's active bookings for a course, optionally filtered to one IST date (YYYY-MM-DD).",
  })
  @Authorized()
  @Get('/my/course/:courseId/version/:courseVersionId')
  @HttpCode(200)
  async myBookings(
    @Param('courseId') courseId: string,
    @Param('courseVersionId') courseVersionId: string,
    @CurrentUser() user: IUser,
    @QueryParam('date') date?: string,
  ): Promise<BookingResponse> {
    try {
      const data = await this.slotBookingService.getStudentBookings(
        user._id.toString(),
        courseId,
        courseVersionId,
        date,
      );
      return {success: true, data};
    } catch (error) {
      throw new InternalServerError(`Failed to get bookings: ${error}`);
    }
  }

  @OpenAPI({
    summary: 'Slot availability (for booking)',
    description:
      'Booked load and seats remaining per window for an IST day (default today), so an enrolled student can see capacity while picking a slot. Returns counts only — no learner identities.',
  })
  @Authorized()
  @Get('/availability/course/:courseId/version/:courseVersionId')
  @HttpCode(200)
  async getAvailability(
    @Param('courseId') courseId: string,
    @Param('courseVersionId') courseVersionId: string,
    @QueryParam('date') date?: string,
  ): Promise<BookingResponse> {
    try {
      const data = await this.slotBookingService.getSlotDemand(
        courseId,
        courseVersionId,
        date,
      );
      return {success: true, data};
    } catch (error) {
      throw new InternalServerError(
        `Failed to get slot availability: ${error}`,
      );
    }
  }

  @OpenAPI({
    summary: 'Slot demand schedule',
    description:
      'Booked load per window for an IST day (default today) — the demand schedule for capacity planning. Instructors/managers only.',
  })
  @Authorized()
  @Get('/demand/course/:courseId/version/:courseVersionId')
  @HttpCode(200)
  async getDemand(
    @Param('courseId') courseId: string,
    @Param('courseVersionId') courseVersionId: string,
    @Ability(getItemAbility) {ability},
    @QueryParam('date') date?: string,
  ): Promise<BookingResponse> {
    const itemResource = subject('Item', {versionId: courseVersionId});
    if (!ability.can(ItemActions.ViewAll, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to view this course.',
      );
    }
    try {
      const data = await this.slotBookingService.getSlotDemand(
        courseId,
        courseVersionId,
        date,
      );
      return {success: true, data};
    } catch (error) {
      throw new InternalServerError(`Failed to get slot demand: ${error}`);
    }
  }
}

export {SlotBookingController};
