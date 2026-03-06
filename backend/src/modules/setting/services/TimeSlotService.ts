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
  ITimeSlot,
} from '#shared/index.js';
import { EnrollmentService } from '#users/services/EnrollmentService.js';
import { USERS_TYPES } from '#users/types.js';


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
   * Check if a timeslot is at maximum capacity
   */
  private isTimeslotFull(timeSlot: ITimeSlot): boolean {
    if (!timeSlot.maxStudents) return false; // No limit set
    return timeSlot.studentIds.length > timeSlot.maxStudents;
  }

  /**
   * Check if adding students would exceed timeslot capacity
   */
  private wouldExceedCapacity(timeSlot: ITimeSlot, studentsToAdd: number): boolean {
    if (!timeSlot.maxStudents) return false; // No limit set
    return (timeSlot.studentIds.length + studentsToAdd) > timeSlot.maxStudents;
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
    const result = `${hours}:${minutes}`;
    return result;
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
        if (slot.maxStudents && slot.maxStudents <= 0) {
          throw new BadRequestError(
            `Invalid maxStudents value: ${slot.maxStudents}. Must be greater than 0.`,
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
        // Check if adding students would exceed capacity
        if (this.wouldExceedCapacity(slot, slot.studentIds.length)) {
          throw new BadRequestError(
            `Cannot add ${slot.studentIds.length} students to timeslot ${slot.from}-${slot.to}. ` +
            `Current: ${existingTimeslots.slots.find(s => s.from === slot.from && s.to === slot.to)?.studentIds.length || 0}, ` +
            `Max: ${slot.maxStudents || 'unlimited'}`
          );
        }
        
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
          
          await this.enrollmentService.removeSpecificTimeSlotFromStudent(
            userId,
            courseId,
            courseVersionId,
            slotToRemove,
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
            
            await this.enrollmentService.removeSpecificTimeSlotFromStudent(
              studentUserId,
              courseId,
              courseVersionId,
              { from: slot.from, to: slot.to },
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
    oldTimeSlot: { from: string; to: string; maxStudents?: number },
    newTimeSlot: { from: string; to: string; maxStudents?: number },
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
      if (newTimeSlot.maxStudents && newTimeSlot.maxStudents <= 0) {
        throw new BadRequestError(
          `Invalid maxStudents value: ${newTimeSlot.maxStudents}. Must be greater than 0.`,
        );
      }
      
      // Check if reducing maxStudents would violate current capacity
      const currentSlot = existingTimeslots.slots[slotIndex];
      if (newTimeSlot.maxStudents && currentSlot.studentIds.length > newTimeSlot.maxStudents) {
        throw new BadRequestError(
          `Cannot reduce maxStudents to ${newTimeSlot.maxStudents}. ` +
          `Current enrollment: ${currentSlot.studentIds.length} students.`
        );
      }

      // Update the time slot
      existingTimeslots.slots[slotIndex] = {
        ...existingTimeslots.slots[slotIndex],
        from: newTimeSlot.from,
        to: newTimeSlot.to,
        maxStudents: newTimeSlot.maxStudents,
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
   * Student chooses a time slot
   */
  async chooseTimeSlot(
    courseId: string,
    courseVersionId: string,
    timeSlot: { from: string; to: string },
    studentUserId: string,
  ): Promise<boolean> {
    return this._withTransaction(async (session) => {
      // Check if student already has a timeslot assigned
      const enrollment = await this.enrollmentService.findEnrollment(
        studentUserId,
        courseId,
        courseVersionId
      );

      if (!enrollment) {
        throw new NotFoundError('Enrollment not found for this student.');
      }

      // Check if student already has assigned timeslots (by instructor or self-chosen)
      if (enrollment.assignedTimeSlots && enrollment.assignedTimeSlots.length > 0) {
        throw new BadRequestError('You already have a time slot assigned. Contact your instructor if you need to change it.');
      }

      // Get timeslots settings
      const timeslots = await this.settingsRepo.readTimeslotsSettings(
        courseId,
        courseVersionId,
        session
      );

      if (!timeslots || !timeslots.isActive) {
        throw new BadRequestError('Time slots are not enabled for this course.');
      }

      // Find the requested timeslot
      const requestedSlot = timeslots.slots.find(
        slot => slot.from === timeSlot.from && slot.to === timeSlot.to
      );

      if (!requestedSlot) {
        throw new NotFoundError('Requested time slot not found.');
      }

      // Check if timeslot is at capacity
      if (this.isTimeslotFull(requestedSlot)) {
        throw new BadRequestError('This time slot is full. Please choose another time slot.');
      }

      // Add student to timeslot in course settings
      const updatedSlots = timeslots.slots.map(slot => {
        if (slot.from === timeSlot.from && slot.to === timeSlot.to) {
          return {
            ...slot,
            studentIds: [...slot.studentIds, studentUserId]
          };
        }
        return slot;
      });

      const updatedTimeslots = {
        ...timeslots,
        slots: updatedSlots
      };

      // Update course settings
      const settingsResult = await this.settingsRepo.updateTimeslotsSettings(
        courseId,
        courseVersionId,
        updatedTimeslots,
        session
      );

      if (!settingsResult) {
        throw new InternalServerError('Failed to update course settings.');
      }

      // Update student's enrollment with chosen timeslot
      const enrollmentResult = await this.enrollmentService.addMultipleTimeSlotsToStudent(
        studentUserId,
        courseId,
        courseVersionId,
        [timeSlot],
        session
      );

      if (!enrollmentResult) {
        throw new InternalServerError('Failed to update enrollment.');
      }

      return true;
    });
  }

  
  /**
   * Teacher removes a student from a specific time slot
   */
  async removeStudentFromTimeSlot(
    courseId: string,
    courseVersionId: string,
    studentUserId: string,
    timeSlot: { from: string; to: string },
  ): Promise<boolean> {

    return this._withTransaction(async (session) => {
      // Get timeslots settings
      const timeslots = await this.settingsRepo.readTimeslotsSettings(
        courseId,
        courseVersionId,
        session
      );


      if (!timeslots) {
        throw new NotFoundError(`Time slots not found for course ${courseId}, version ${courseVersionId}. Please ensure timeslots are set up for this course.`);
      }

      // Find the specific timeslot
      const targetSlot = timeslots.slots.find(
        slot => slot.from === timeSlot.from && slot.to === timeSlot.to
      );

      if (!targetSlot) {
        throw new NotFoundError(`Time slot ${timeSlot.from}-${timeSlot.to} not found in this course.`);
      }

      // Check if student is in this timeslot
      if (!targetSlot.studentIds.includes(studentUserId)) {
        throw new BadRequestError('Student is not assigned to this time slot.');
      }

      // Remove student from the timeslot
      const updatedSlots = timeslots.slots.map(slot => {
        if (slot.from === timeSlot.from && slot.to === timeSlot.to) {
          return {
            ...slot,
            studentIds: slot.studentIds.filter(id => id !== studentUserId)
          };
        }
        return slot;
      });

      const updatedTimeslots = {
        ...timeslots,
        slots: updatedSlots
      };

      // Update course settings
      const settingsResult = await this.settingsRepo.updateTimeslotsSettings(
        courseId,
        courseVersionId,
        updatedTimeslots,
        session
      );

      if (!settingsResult) {
        throw new InternalServerError('Failed to update course settings.');
      }

      // Remove the specific timeslot from student's enrollment
      await this.enrollmentService.removeSingleTimeSlotFromStudent(
        studentUserId,
        courseId,
        courseVersionId,
        timeSlot,
        session
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

      if (!enrollment.assignedTimeSlots || enrollment.assignedTimeSlots.length === 0) {
        return { canAccess: true, message: 'No time slot assigned to this student.' };
      }

      // Check if current time is within any of the assigned slots
      const currentTime = this.getCurrentISTTime();
      const hasAccess = enrollment.assignedTimeSlots.some(timeSlot => 
        this.isCurrentTimeInSlot(timeSlot)
      );
      
      if (!hasAccess) {
        const timeSlotsStr = enrollment.assignedTimeSlots
          .map(slot => `${slot.from} to ${slot.to}`)
          .join(', ');
        return {
          canAccess: false,
          message: `Course access is only allowed during these time slots: ${timeSlotsStr} IST. Current time: ${currentTime}`,
        };
      }

      return { canAccess: true };
    });
  }
}
