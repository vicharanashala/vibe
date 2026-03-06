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
    if (!ability.can(ItemActions.View, itemResource)) {
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
