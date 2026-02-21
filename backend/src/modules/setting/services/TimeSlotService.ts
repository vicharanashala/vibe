import { injectable, inject } from 'inversify';
import { GLOBAL_TYPES } from '#root/types.js';
import {
  BadRequestError,
  NotFoundError,
  InternalServerError,
} from 'routing-controllers';
import {
  BaseService,
  MongoDatabase,
  ISettingRepository,
  ICourseRepository,
  IEnrollment,
  ITimeSlot,
} from '#shared/index.js';
import { ObjectId } from 'mongodb';
import { EnrollmentService } from '#users/services/EnrollmentService.js';
import { USERS_TYPES } from '#users/types.js';
import { AuditingDto } from '../classes/validators/CourseSettingValidators.js';
import { getISTFormattedTimestamp } from '#root/utils/toISOFormat.js';

@injectable()
export class TimeSlotService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.SettingRepo)
    private readonly settingsRepo: ISettingRepository,

    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,

    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,

    @inject(GLOBAL_TYPES.Database)
    private readonly mongoDatabase: MongoDatabase,
  ) {
    super(mongoDatabase);
  }

  /**
   * Validates time format HH:MM in 24-hour format
   */
  private validateTimeFormat(time: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  /**
   * Validates that from time is before to time
   */
  private validateTimeRange(from: string, to: string): boolean {
    const [fromHour, fromMin] = from.split(':').map(Number);
    const [toHour, toMin] = to.split(':').map(Number);
    
    const fromMinutes = fromHour * 60 + fromMin;
    const toMinutes = toHour * 60 + toMin;
    
    return fromMinutes < toMinutes;
  }

  /**
   * Get current IST time in HH:MM format
   */
  private getCurrentISTTime(): string {
    const now = new Date();
    // IST is UTC+5:30
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const hours = istTime.getUTCHours().toString().padStart(2, '0');
    const minutes = istTime.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Check if current time is within the given time slot
   */
  private isCurrentTimeInSlot(timeSlot: { from: string; to: string }): boolean {
    const currentTime = this.getCurrentISTTime();
    const [currentHour, currentMin] = currentTime.split(':').map(Number);
    const [fromHour, fromMin] = timeSlot.from.split(':').map(Number);
    const [toHour, toMin] = timeSlot.to.split(':').map(Number);
    
    const currentMinutes = currentHour * 60 + currentMin;
    const fromMinutes = fromHour * 60 + fromMin;
    const toMinutes = toHour * 60 + toMin;
    
    return currentMinutes >= fromMinutes && currentMinutes <= toMinutes;
  }

  /**
   * Add time slots to course settings
   */
  async addTimeSlots(
    courseId: string,
    courseVersionId: string,
    timeSlots: ITimeSlot[],
    userId: string,
  ): Promise<boolean> {
    return this._withTransaction(async (session) => {
      // Validate course and version exist
      const course = await this.courseRepo.read(courseId, session);
      if (!course) {
        throw new NotFoundError(`Course with ID ${courseId} not found.`);
      }

      const courseVersion = await this.courseRepo.readVersion(
        courseVersionId,
        session,
      );
      if (!courseVersion) {
        throw new NotFoundError(
          `Course version with ID ${courseVersionId} not found.`,
        );
      }

      // Validate time slots
      for (const slot of timeSlots) {
        if (!this.validateTimeFormat(slot.from)) {
          throw new BadRequestError(
            `Invalid time format for 'from' field: ${slot.from}. Use HH:MM format.`,
          );
        }
        if (!this.validateTimeFormat(slot.to)) {
          throw new BadRequestError(
            `Invalid time format for 'to' field: ${slot.to}. Use HH:MM format.`,
          );
        }
        if (!this.validateTimeRange(slot.from, slot.to)) {
          throw new BadRequestError(
            `Invalid time range: ${slot.from} to ${slot.to}. 'From' time must be before 'to' time.`,
          );
        }
      }

      // Get existing timeslots settings
      let existingTimeslots = await this.settingsRepo.readTimeslotsSettings(
        courseId,
        courseVersionId,
        session,
      );

      // Initialize timeslots if not exists
      if (!existingTimeslots) {
        existingTimeslots = {
          isActive: true,
          slots: [],
        };
      }

      // Add new time slots (avoiding duplicates)
      const existingSlots = existingTimeslots.slots;
      for (const newSlot of timeSlots) {
        // Check if slot already exists
        const exists = existingSlots.some(
          (existingSlot) =>
            existingSlot.from === newSlot.from && existingSlot.to === newSlot.to,
        );
        
        if (!exists) {
          existingSlots.push(newSlot);
        }
      }

      // Update timeslots settings
      const result = await this.settingsRepo.updateTimeslotsSettings(
        courseId,
        courseVersionId,
        existingTimeslots,
        session,
      );

      if (!result) {
        throw new InternalServerError('Failed to update course settings with time slots.');
      }

      // Update enrollments for students in the time slots
      for (const slot of timeSlots) {
        for (const studentId of slot.studentIds) {
          await this.enrollmentService.updateStudentTimeSlot(
            studentId,
            courseId,
            courseVersionId,
            { from: slot.from, to: slot.to },
            session,
          );
        }
      }

      return true;
    });
  }

  /**
   * Remove time slots from course settings
   */
  async removeTimeSlots(
    courseId: string,
    courseVersionId: string,
    timeSlotsToRemove: { from: string; to: string }[],
    userId: string,
  ): Promise<boolean> {
    return this._withTransaction(async (session) => {
      const existingTimeslots = await this.settingsRepo.readTimeslotsSettings(
        courseId,
        courseVersionId,
        session,
      );

      if (!existingTimeslots) {
        throw new NotFoundError('No time slots found for this course.');
      }

      // Remove specified time slots
      const remainingSlots = existingTimeslots.slots.filter(
        (slot) =>
          !timeSlotsToRemove.some(
            (removeSlot) =>
              removeSlot.from === slot.from && removeSlot.to === slot.to,
          ),
      );

      const updatedTimeslots = {
        isActive: existingTimeslots.isActive,
        slots: remainingSlots,
      };

      // Update timeslots settings
      const result = await this.settingsRepo.updateTimeslotsSettings(
        courseId,
        courseVersionId,
        updatedTimeslots,
        session,
      );

      if (!result) {
        throw new InternalServerError('Failed to update time slots settings.');
      }

      // Remove time slot from student enrollments
      for (const slotToRemove of timeSlotsToRemove) {
        // Find students assigned to this time slot
        const enrollments = await this.enrollmentService.findEnrollmentsByTimeSlot(
          courseId,
          courseVersionId,
          slotToRemove,
          session,
        );

        // Remove time slot from each student's enrollment
        for (const enrollment of enrollments) {
          const userId = typeof enrollment.userId === 'string' 
            ? enrollment.userId 
            : enrollment.userId.toString();
          
          await this.enrollmentService.removeStudentTimeSlot(
            userId,
            courseId,
            courseVersionId,
            session,
          );
        }
      }

      return true;
    });
  }

  /**
   * Toggle time slots active status
   */
  async toggleTimeSlots(
    courseId: string,
    courseVersionId: string,
    isActive: boolean,
    userId: string,
  ): Promise<boolean> {
    return this._withTransaction(async (session) => {
      const existingTimeslots = await this.settingsRepo.readTimeslotsSettings(
        courseId,
        courseVersionId,
        session,
      );

      // Initialize timeslots if not exists
      if (!existingTimeslots) {
        const newTimeslots = {
          isActive,
          slots: [],
        };
        
        const result = await this.settingsRepo.updateTimeslotsSettings(
          courseId,
          courseVersionId,
          newTimeslots,
          session,
        );
        
        return !!result;
      }

      // If toggling off, delete all slots and remove assigned slots from enrollments
      if (!isActive && existingTimeslots.slots && existingTimeslots.slots.length > 0) {
        // Remove time slot from all student enrollments
        for (const slot of existingTimeslots.slots) {
          // Find students assigned to this time slot
          const enrollments = await this.enrollmentService.findEnrollmentsByTimeSlot(
            courseId,
            courseVersionId,
            { from: slot.from, to: slot.to },
            session,
          );

          // Remove time slot from each student's enrollment
          for (const enrollment of enrollments) {
            const studentUserId = typeof enrollment.userId === 'string' 
              ? enrollment.userId 
              : enrollment.userId.toString();
            
            await this.enrollmentService.removeStudentTimeSlot(
              studentUserId,
              courseId,
              courseVersionId,
              session,
            );
          }
        }
      }

      // Update existing timeslots with new isActive value and empty slots if toggling off
      const updatedTimeslots = {
        isActive,
        slots: isActive ? (existingTimeslots.slots || []) : []
      };

      const result = await this.settingsRepo.updateTimeslotsSettings(
        courseId,
        courseVersionId,
        updatedTimeslots,
        session,
      );

      return !!result;
    });
  }

  /**
   * Update existing time slot
   */
  async updateTimeSlot(
    courseId: string,
    courseVersionId: string,
    oldTimeSlot: { from: string; to: string },
    newTimeSlot: { from: string; to: string },
    userId: string,
  ): Promise<boolean> {
    return this._withTransaction(async (session) => {
      const existingTimeslots = await this.settingsRepo.readTimeslotsSettings(
        courseId,
        courseVersionId,
        session,
      );

      if (!existingTimeslots) {
        throw new NotFoundError('No time slots found for this course.');
      }

      // Find and update the specific time slot
      const slotIndex = existingTimeslots.slots.findIndex(
        (slot) => slot.from === oldTimeSlot.from && slot.to === oldTimeSlot.to
      );

      if (slotIndex === -1) {
        throw new NotFoundError('Time slot not found.');
      }

      // Validate new time slot
      if (!this.validateTimeFormat(newTimeSlot.from)) {
        throw new BadRequestError(
          `Invalid time format for 'from' field: ${newTimeSlot.from}. Use HH:MM format.`,
        );
      }
      if (!this.validateTimeFormat(newTimeSlot.to)) {
        throw new BadRequestError(
          `Invalid time format for 'to' field: ${newTimeSlot.to}. Use HH:MM format.`,
        );
      }
      if (!this.validateTimeRange(newTimeSlot.from, newTimeSlot.to)) {
        throw new BadRequestError(
          `Invalid time range: ${newTimeSlot.from} to ${newTimeSlot.to}. 'From' time must be before 'to' time.`,
        );
      }

      // Update the time slot
      existingTimeslots.slots[slotIndex] = {
        ...existingTimeslots.slots[slotIndex],
        from: newTimeSlot.from,
        to: newTimeSlot.to,
      };

      // Update timeslots settings
      const result = await this.settingsRepo.updateTimeslotsSettings(
        courseId,
        courseVersionId,
        existingTimeslots,
        session,
      );

      if (!result) {
        throw new InternalServerError('Failed to update time slot settings.');
      }

      // Update student enrollments with the new time slot
      await this.enrollmentService.updateTimeSlot(
        courseId,
        courseVersionId,
        oldTimeSlot,
        newTimeSlot,
        session,
      );

      return true;
    });
  }

  /**
   * Get time slots for a course
   */
  async getTimeSlots(
    courseId: string,
    courseVersionId: string,
  ): Promise<{ isActive: boolean; slots: ITimeSlot[] } | null> {
    return this._withTransaction(async (session) => {
      const timeslots = await this.settingsRepo.readTimeslotsSettings(
        courseId,
        courseVersionId,
        session,
      );

      return timeslots;
    });
  }

  /**
   * Check if student can access course based on time slot
   */
  async canStudentAccessCourse(
    userId: string,
    courseId: string,
    courseVersionId: string,
  ): Promise<{ canAccess: boolean; message?: string }> {
    return this._withTransaction(async (session) => {
      // Get timeslots settings
      const timeslots = await this.settingsRepo.readTimeslotsSettings(
        courseId,
        courseVersionId,
        session,
      );

      if (!timeslots || !timeslots.isActive) {
        return { canAccess: true }; // Time slots not active, allow access
      }

      // Get student enrollment
      const enrollment = await this.enrollmentService.findEnrollment(
        userId,
        courseId,
        courseVersionId,
      );

      if (!enrollment) {
        return { canAccess: false, message: 'Student not enrolled in this course.' };
      }

      if (!enrollment.assignedTimeSlot) {
        return { canAccess: false, message: 'No time slot assigned to this student.' };
      }

      // Check if current time is within assigned slot
      const isInSlot = this.isCurrentTimeInSlot(enrollment.assignedTimeSlot);
      
      if (!isInSlot) {
        const currentTime = this.getCurrentISTTime();
        return {
          canAccess: false,
          message: `Course access is only allowed from ${enrollment.assignedTimeSlot.from} to ${enrollment.assignedTimeSlot.to} IST. Current time: ${currentTime}`,
        };
      }

      return { canAccess: true };
    });
  }

  /**
   * Get students assigned to specific time slots
   */
  async getStudentsInTimeSlots(
    courseId: string,
    courseVersionId: string,
  ): Promise<ITimeSlot[]> {
    return this._withTransaction(async (session) => {
      const timeslots = await this.settingsRepo.readTimeslotsSettings(
        courseId,
        courseVersionId,
        session,
      );

      if (!timeslots) {
        return [];
      }

      return timeslots.slots;
    });
  }
}
