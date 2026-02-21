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
  Authorized,
  HttpCode,
  CurrentUser,
  QueryParams,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { IUser } from '#root/shared/index.js';
import { InternalServerErrorResponse } from '../../../shared/middleware/errorHandler.js';

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
  ) {}

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
  ): Promise<TimeSlotResponse> {
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
  ): Promise<TimeSlotResponse> {
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
  ): Promise<TimeSlotResponse> {
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
  ): Promise<GetTimeSlotsResponse> {
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
    summary: 'Get students in time slots',
    description:
      'Retrieves all time slots with their assigned students for a course.',
  })
  @Authorized()
  @Get('/students/:courseId/:courseVersionId')
  @HttpCode(200)
  @ResponseSchema(TimeSlotResponse, {
    description: 'Students in time slots retrieved successfully',
  })
  @ResponseSchema(InternalServerErrorResponse, {
    description: 'Failed to get students in time slots',
    statusCode: 500,
  })
  async getStudentsInTimeSlots(
    @Param('courseId') courseId: string,
    @Param('courseVersionId') courseVersionId: string,
    @CurrentUser() user: IUser,
  ): Promise<TimeSlotResponse> {
    try {
      const timeSlots = await this.timeSlotService.getStudentsInTimeSlots(
        courseId,
        courseVersionId,
      );

      return { 
        success: true, 
        data: timeSlots 
      };
    } catch (error) {
      throw new InternalServerError(`Failed to get students in time slots: ${error}`);
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
  ): Promise<TimeSlotResponse> {
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
}

export { TimeSlotController };
