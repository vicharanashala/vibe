import { ITimeSlot } from '#shared/interfaces/models.js';
import { TimeSlotService } from '../services/TimeSlotService.js';
import { SETTING_TYPES } from '../types.js';
import { injectable, inject } from 'inversify';
import {
  JsonController,
  Post,
  Put,
  Get,
  Delete,
  Body,
  Param,
  OnUndefined,
  InternalServerError,
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  Authorized,
  HttpCode,
  CurrentUser,
  QueryParams,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { IUser } from '#root/shared/index.js';
import { InternalServerErrorResponse } from '../../../shared/middleware/errorHandler.js';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { getItemAbility, ItemActions } from '#root/modules/courses/abilities/itemAbilities.js';
import { subject } from '@casl/ability';

// Response classes for student timeslot operations
class StudentTimeSlotResponse {
  success: boolean;
  message?: string;
}

class ChooseTimeSlotRequestBody {
  courseId: string;
  courseVersionId: string;
  timeSlot: { from: string; to: string };
}

// Request DTO for removing student from timeslot
interface RemoveStudentFromTimeSlotRequest {
  courseId: string;
  courseVersionId: string;
  studentId: string;
  timeSlot: { from: string; to: string };
}

// Request body for adding time slots
class AddTimeSlotsRequestBody {
  courseId: string;
  courseVersionId: string;
  timeSlots: ITimeSlot[];
}

// Request body for removing time slots
class RemoveTimeSlotsRequestBody {
  courseId: string;
  courseVersionId: string;
  timeSlotsToRemove: { from: string; to: string }[];
}

// Request body for updating time slot
class UpdateTimeSlotRequestBody {
  courseId: string;
  courseVersionId: string;
  oldTimeSlot: { from: string; to: string };
  newTimeSlot: { from: string; to: string };
}

// Request body for toggling time slots
class ToggleTimeSlotsRequestBody {
  courseId: string;
  courseVersionId: string;
  isActive: boolean;
}

// Request body for configuring the per-course hours budget from the
// instructor's total estimated hours per category (all videos together, all
// quizzes together, all projects together, etc.).
class SetHoursBudgetRequestBody {
  courseId: string;
  courseVersionId: string;
  categoryHours: {
    VIDEO?: number;
    QUIZ?: number;
    BLOG?: number;
    PROJECT?: number;
    FEEDBACK?: number;
  };
  hoursFactor?: number;
}

// Request body for the Phase 3 fulfillment + bonus rules.
class SetFulfillmentConfigRequestBody {
  courseId: string;
  courseVersionId: string;
  fulfillmentThresholdPct?: number; // 0–100, default 90
  bonusOnFulfillment?: boolean;
}

// Request body for capacity-derived per-slot caps (Option A).
class SetCapacityConfigRequestBody {
  courseId: string;
  courseVersionId: string;
  targetConcurrentStudents: number; // total students the backend is provisioned for
  headroomFactor?: number; // 0 < x <= 1, default 0.7
}

// Request body for granting a student extra committed hours.
class ExtendStudentHoursRequestBody {
  courseId: string;
  courseVersionId: string;
  studentId: string;
  extraHours: number;
}

// Request body for awarding a student extra bookings (consumable pool).
class GrantExtraBookingsRequestBody {
  courseId: string;
  courseVersionId: string;
  studentId: string;
  extraBookings: number;
}

// Response for time slot operations
class TimeSlotResponse {
  success: boolean;
  message?: string;
  data?: any;
}

// Response for getting time slots
class GetTimeSlotsResponse {
  success: boolean;
  data?: { isActive: boolean; slots: ITimeSlot[] } | null;
}

// Response for access check
class AccessCheckResponse {
  success: boolean;
  canAccess: boolean;
  message?: string;
}

@OpenAPI({
  tags: ['Time Slots'],
})
@JsonController('/timeslots', { transformResponse: true })
@injectable()
class TimeSlotController {
  constructor(
    @inject(SETTING_TYPES.TimeSlotService)
    private readonly timeSlotService: TimeSlotService,
  ) { }

  @OpenAPI({
    summary: 'Add time slots to a course',
    description:
      'Adds new time slots to a course and assigns students to them. Updates both course settings and student enrollments.',
  })
  @Authorized()
  @Post('/add')
  @HttpCode(200)
  @ResponseSchema(TimeSlotResponse, {
    description: 'Time slots added successfully',
  })
  @ResponseSchema(InternalServerErrorResponse, {
    description: 'Failed to add time slots',
    statusCode: 500,
  })
  async addTimeSlots(
    @Body() body: AddTimeSlotsRequestBody,
    @CurrentUser() user: IUser,
    @Ability(getItemAbility) { ability },
  ): Promise<TimeSlotResponse> {


    // Create an item resource object for permission checking
    const itemResource = subject('Item', { versionId: body.courseVersionId });

    // Check permission using ability.can() with the actual item resource
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this item',
      );
    }

    try {
      const result = await this.timeSlotService.addTimeSlots(
        body.courseId,
        body.courseVersionId,
        body.timeSlots,
        user._id.toString(),
      );

      return {
        success: result,
        message: result ? 'Time slots added successfully' : 'Failed to add time slots'
      };
    } catch (error) {
      if (error instanceof BadRequestError) {
        throw error;
      }
      throw new InternalServerError(`Failed to add time slots: ${error}`);
    }
  }

  @OpenAPI({
    summary: 'Remove time slots from a course',
    description:
      'Removes specified time slots from a course settings.',
  })
  @Authorized()
  @Post('/remove')
  @HttpCode(200)
  @ResponseSchema(TimeSlotResponse, {
    description: 'Time slots removed successfully',
  })
  @ResponseSchema(InternalServerErrorResponse, {
    description: 'Failed to remove time slots',
    statusCode: 500,
  })
  async removeTimeSlots(
    @Body() body: RemoveTimeSlotsRequestBody,
    @CurrentUser() user: IUser,
    @Ability(getItemAbility) { ability },
  ): Promise<TimeSlotResponse> {

    // Create an item resource object for permission checking
    const itemResource = subject('Item', { versionId: body.courseVersionId });

    // Check permission using ability.can() with the actual item resource
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this item',
      );
    }

    try {
      const result = await this.timeSlotService.removeTimeSlots(
        body.courseId,
        body.courseVersionId,
        body.timeSlotsToRemove,
        user._id.toString(),
      );

      return {
        success: result,
        message: result ? 'Time slots removed successfully' : 'Failed to remove time slots'
      };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BadRequestError) {
        throw error;
      }
      throw new InternalServerError(`Failed to remove time slots: ${error}`);
    }
  }

  @OpenAPI({
    summary: 'Toggle time slots active status',
    description:
      'Enables or disables time slots for a course.',
  })
  @Authorized()
  @Put('/toggle')
  @HttpCode(200)
  @ResponseSchema(TimeSlotResponse, {
    description: 'Time slots status toggled successfully',
  })
  @ResponseSchema(InternalServerErrorResponse, {
    description: 'Failed to toggle time slots status',
    statusCode: 500,
  })
  async toggleTimeSlots(
    @Body() body: ToggleTimeSlotsRequestBody,
    @CurrentUser() user: IUser,
    @Ability(getItemAbility) { ability },
  ): Promise<TimeSlotResponse> {

    // Create an item resource object for permission checking
    const itemResource = subject('Item', { versionId: body.courseVersionId });

    // Check permission using ability.can() with the actual item resource
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this item',
      );
    }

    try {
      const result = await this.timeSlotService.toggleTimeSlots(
        body.courseId,
        body.courseVersionId,
        body.isActive,
        user._id.toString(),
      );

      return {
        success: result,
        message: result ? 'Time slots status updated successfully' : 'Failed to update time slots status'
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalServerError(`Failed to toggle time slots: ${error}`);
    }
  }

  @OpenAPI({
    summary: 'Get time slots for a course',
    description:
      'Retrieves all time slots configured for a specific course version.',
  })
  @Authorized()
  @Get('/course/:courseId/version/:courseVersionId')
  @HttpCode(200)
  @ResponseSchema(GetTimeSlotsResponse, {
    description: 'Time slots retrieved successfully',
  })
  @ResponseSchema(InternalServerErrorResponse, {
    description: 'Failed to get time slots',
    statusCode: 500,
  })
  async getTimeSlots(
    @Param('courseId') courseId: string,
    @Param('courseVersionId') courseVersionId: string,
    @CurrentUser() user: IUser,
    @Ability(getItemAbility) { ability },
  ): Promise<GetTimeSlotsResponse> {

    // Create an item resource object for permission checking
    const itemResource = subject('Item', { versionId: courseVersionId });

    // Check permission using ability.can() with the actual item resource
    if (!ability.can(ItemActions.ViewAll, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to read this item',
      );
    }

    try {
      const timeSlots = await this.timeSlotService.getTimeSlots(
        courseId,
        courseVersionId,
      );

      return {
        success: true,
        data: timeSlots
      };
    } catch (error) {
      throw new InternalServerError(`Failed to get time slots: ${error}`);
    }
  }

  @OpenAPI({
    summary: 'Update an existing time slot',
    description:
      'Updates an existing time slot and updates all student enrollments assigned to it.',
  })
  @Authorized()
  @Put('/update')
  @HttpCode(200)
  @ResponseSchema(TimeSlotResponse, {
    description: 'Time slot updated successfully',
  })
  @ResponseSchema(InternalServerErrorResponse, {
    description: 'Failed to update time slot',
    statusCode: 500,
  })
  async updateTimeSlot(
    @Body() body: UpdateTimeSlotRequestBody,
    @CurrentUser() user: IUser,
    @Ability(getItemAbility) { ability },
  ): Promise<TimeSlotResponse> {

    // Create an item resource object for permission checking
    const itemResource = subject('Item', { versionId: body.courseVersionId });

    // Check permission using ability.can() with the actual item resource
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to update this item',
      );
    }

    try {
      const result = await this.timeSlotService.updateTimeSlot(
        body.courseId,
        body.courseVersionId,
        body.oldTimeSlot,
        body.newTimeSlot,
        user._id.toString(),
      );

      return {
        success: result,
        message: result ? 'Time slot updated successfully' : 'Failed to update time slot'
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      if (error instanceof BadRequestError) {
        throw error;
      }
      throw new InternalServerError(`Failed to update time slot: ${error}`);
    }
  }

  @OpenAPI({
    summary: 'Check time-slot access for the current student',
    description:
      "Returns whether the calling student can currently access the course under its time-slot rules. Used by the player to poll for a live cut-off when a booked window ends.",
  })
  @Authorized()
  @Get('/check-access/:courseId/:courseVersionId')
  @HttpCode(200)
  async checkTimeSlotAccess(
    @Param('courseId') courseId: string,
    @Param('courseVersionId') courseVersionId: string,
    @CurrentUser() user: IUser,
  ): Promise<{ canAccess: boolean; message?: string }> {
    try {
      return await this.timeSlotService.canStudentAccessCourse(
        user._id.toString(),
        courseId,
        courseVersionId,
      );
    } catch (error) {
      throw new InternalServerError(`Failed to check time slot access: ${error}`);
    }
  }

  @OpenAPI({
    summary: 'Set the per-course hours budget',
    description:
      "Stores the students' committed-hours budget as the sum of the instructor's total estimated hours per category (all videos together, all quizzes together, all projects together, etc.). Captured when the feature is enabled.",
  })
  @Authorized()
  @Put('/budget')
  @HttpCode(200)
  @ResponseSchema(TimeSlotResponse, {
    description: 'Hours budget configured successfully',
  })
  async setHoursBudget(
    @Body() body: SetHoursBudgetRequestBody,
    @CurrentUser() user: IUser,
    @Ability(getItemAbility) { ability },
  ): Promise<TimeSlotResponse> {
    const itemResource = subject('Item', { versionId: body.courseVersionId });
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this item',
      );
    }

    try {
      const data = await this.timeSlotService.configureHoursBudget(
        body.courseId,
        body.courseVersionId,
        body.categoryHours ?? {},
        body.hoursFactor,
        user._id.toString(),
      );
      return {
        success: true,
        message: 'Hours budget configured successfully',
        data,
      };
    } catch (error) {
      if (
        error instanceof BadRequestError ||
        error instanceof NotFoundError
      ) {
        throw error;
      }
      throw new InternalServerError(`Failed to set hours budget: ${error}`);
    }
  }

  @OpenAPI({
    summary: 'Set the fulfillment & bonus rules',
    description:
      'Stores the Phase 3 fulfillment threshold (active share of a window, 0–100, default 90) and whether fulfilling a window grants a same-day bonus booking.',
  })
  @Authorized()
  @Put('/fulfillment')
  @HttpCode(200)
  @ResponseSchema(TimeSlotResponse, {
    description: 'Fulfillment settings configured successfully',
  })
  async setFulfillmentConfig(
    @Body() body: SetFulfillmentConfigRequestBody,
    @Ability(getItemAbility) { ability },
  ): Promise<TimeSlotResponse> {
    const itemResource = subject('Item', { versionId: body.courseVersionId });
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this item',
      );
    }

    try {
      const data = await this.timeSlotService.configureFulfillment(
        body.courseId,
        body.courseVersionId,
        body.fulfillmentThresholdPct,
        body.bonusOnFulfillment ?? false,
      );
      return {
        success: true,
        message: 'Fulfillment settings configured successfully',
        data,
      };
    } catch (error) {
      if (error instanceof BadRequestError || error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalServerError(
        `Failed to set fulfillment settings: ${error}`,
      );
    }
  }

  @OpenAPI({
    summary: 'Set the booking capacity budget',
    description:
      "Derives each time slot's maxStudents from a single capacity knob — the total students the backend is provisioned to serve at once — so per-slot caps stay within the infra budget. perSlotCap = floor(targetConcurrentStudents × headroomFactor ÷ maxOverlappingWindows). A slot is never capped below its already-booked count.",
  })
  @Authorized()
  @Put('/capacity')
  @HttpCode(200)
  @ResponseSchema(TimeSlotResponse, {
    description: 'Capacity settings configured successfully',
  })
  async setCapacityConfig(
    @Body() body: SetCapacityConfigRequestBody,
    @Ability(getItemAbility) { ability },
  ): Promise<TimeSlotResponse> {
    const itemResource = subject('Item', { versionId: body.courseVersionId });
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this item',
      );
    }

    try {
      const data = await this.timeSlotService.configureCapacity(
        body.courseId,
        body.courseVersionId,
        body.targetConcurrentStudents,
        body.headroomFactor,
      );
      return {
        success: true,
        message: 'Capacity settings configured successfully',
        data,
      };
    } catch (error) {
      if (error instanceof BadRequestError || error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalServerError(`Failed to set capacity settings: ${error}`);
    }
  }

  @OpenAPI({
    summary: 'Grant a student extra committed hours',
    description:
      "Adds extra hours to a student's committed-hours budget (instructor action when a student has used up their hours).",
  })
  @Authorized()
  @Put('/extend')
  @HttpCode(200)
  @ResponseSchema(TimeSlotResponse, {
    description: 'Extra hours granted successfully',
  })
  async extendStudentHours(
    @Body() body: ExtendStudentHoursRequestBody,
    @CurrentUser() user: IUser,
    @Ability(getItemAbility) { ability },
  ): Promise<TimeSlotResponse> {
    const itemResource = subject('Item', { versionId: body.courseVersionId });
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this item',
      );
    }

    try {
      const data = await this.timeSlotService.extendStudentHours(
        body.courseId,
        body.courseVersionId,
        body.studentId,
        body.extraHours,
        user._id.toString(),
      );
      return {
        success: true,
        message: 'Extra hours granted successfully',
        data,
      };
    } catch (error) {
      if (
        error instanceof BadRequestError ||
        error instanceof NotFoundError ||
        error instanceof ForbiddenError
      ) {
        throw error;
      }
      throw new InternalServerError(`Failed to grant extra hours: ${error}`);
    }
  }

  @OpenAPI({
    summary: 'Award a student extra bookings',
    description:
      "Adds extra bookings to a student's consumable pool so they can book beyond their daily allowance (instructor action). These grant bookings bypass the slot capacity cap and hours budget.",
  })
  @Authorized()
  @Put('/grant-bookings')
  @HttpCode(200)
  @ResponseSchema(TimeSlotResponse, {
    description: 'Extra bookings awarded successfully',
  })
  async grantExtraBookings(
    @Body() body: GrantExtraBookingsRequestBody,
    @CurrentUser() user: IUser,
    @Ability(getItemAbility) { ability },
  ): Promise<TimeSlotResponse> {
    const itemResource = subject('Item', { versionId: body.courseVersionId });
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this item',
      );
    }

    try {
      const data = await this.timeSlotService.grantExtraBookings(
        body.courseId,
        body.courseVersionId,
        body.studentId,
        body.extraBookings,
        user._id.toString(),
      );
      return {
        success: true,
        message: 'Extra bookings awarded successfully',
        data,
      };
    } catch (error) {
      if (
        error instanceof BadRequestError ||
        error instanceof NotFoundError ||
        error instanceof ForbiddenError
      ) {
        throw error;
      }
      throw new InternalServerError(`Failed to award extra bookings: ${error}`);
    }
  }

  @OpenAPI({
    summary: 'Student chooses a time slot',
    description: 'Allows a student to choose a time slot for their course enrollment.',
  })
  @Authorized()
  @Post('/student/choose')
  @HttpCode(200)
  @ResponseSchema(StudentTimeSlotResponse, {
    description: 'Time slot chosen successfully',
  })
  @ResponseSchema(InternalServerErrorResponse, {
    description: 'Failed to choose time slot',
    statusCode: 500,
  })
  async chooseTimeSlot(
    @Body() body: ChooseTimeSlotRequestBody,
    @CurrentUser() user: IUser,
  ): Promise<StudentTimeSlotResponse> {
    try {
      const result = await this.timeSlotService.chooseTimeSlot(
        body.courseId,
        body.courseVersionId,
        body.timeSlot,
        user._id.toString(),
      );

      return {
        success: true,
        message: 'Time slot chosen successfully'
      };
    } catch (error) {
      if (error instanceof BadRequestError || error instanceof ForbiddenError || error instanceof NotFoundError) {
        return {
          success: false,
          message: error.message
        };
      }
      throw new InternalServerError(`Failed to choose time slot: ${error}`);
    }
  }

  @OpenAPI({
    summary: 'Teacher removes a student from a time slot',
    description: 'Allows a teacher to remove a specific student from a time slot.',
  })
  @Authorized()
  @Post('/teacher/remove-student')
  @HttpCode(200)
  @ResponseSchema(StudentTimeSlotResponse, {
    description: 'Student removed from time slot successfully',
  })
  @ResponseSchema(InternalServerErrorResponse, {
    description: 'Failed to remove student from time slot',
    statusCode: 500,
  })
  async removeStudentFromTimeSlot(
    @Body() body: RemoveStudentFromTimeSlotRequest,
    @Ability(getItemAbility) { ability },
  ): Promise<StudentTimeSlotResponse> {

    // Create an item resource object for permission checking
    const itemResource = subject('Item', { versionId: body.courseVersionId });

    // Check permission using ability.can() with the actual item resource
    if (!ability.can(ItemActions.Modify, itemResource)) {
      throw new ForbiddenError(
        'You do not have permission to modify this item',
      );
    }

    // Manual validation as fallback
    if (!body || !body.courseId || !body.courseVersionId || !body.studentId || !body.timeSlot) {
      return {
        success: false,
        message: 'Invalid request body. All fields are required.'
      };
    }

    if (!body.timeSlot.from || !body.timeSlot.to) {
      return {
        success: false,
        message: 'Invalid time slot. Both from and to are required.'
      };
    }

    try {
      const result = await this.timeSlotService.removeStudentFromTimeSlot(
        body.courseId,
        body.courseVersionId,
        body.studentId,
        body.timeSlot
      );

      return {
        success: true,
        message: 'Student removed from time slot successfully'
      };
    } catch (error) {
      if (error instanceof BadRequestError || error instanceof NotFoundError || error instanceof ForbiddenError) {
        return {
          success: false,
          message: error.message
        };
      }
      throw new InternalServerError(`Failed to remove student from time slot: ${error}`);
    }
  }
}

export { TimeSlotController };
