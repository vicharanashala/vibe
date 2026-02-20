import 'reflect-metadata';
import {
  IsNotEmpty,
  IsString,
  IsMongoId,
  IsArray,
  IsBoolean,
  IsOptional,
  validate,
  ValidationError,
} from 'class-validator';
import { ITimeSlot } from '#shared/interfaces/models.js';

export class TimeSlotDto implements ITimeSlot {
  @IsNotEmpty()
  @IsString()
  from: string;

  @IsNotEmpty()
  @IsString()
  to: string;

  @IsNotEmpty()
  @IsArray()
  studentIds: string[];
}

export class AddTimeSlotsDto {
  @IsNotEmpty()
  @IsMongoId()
  courseId: string;

  @IsNotEmpty()
  @IsMongoId()
  courseVersionId: string;

  @IsNotEmpty()
  @IsArray()
  timeSlots: TimeSlotDto[];
}

export class RemoveTimeSlotsDto {
  @IsNotEmpty()
  @IsMongoId()
  courseId: string;

  @IsNotEmpty()
  @IsMongoId()
  courseVersionId: string;

  @IsNotEmpty()
  @IsArray()
  timeSlotsToRemove: { from: string; to: string }[];
}

export class ToggleTimeSlotsDto {
  @IsNotEmpty()
  @IsMongoId()
  courseId: string;

  @IsNotEmpty()
  @IsMongoId()
  courseVersionId: string;

  @IsNotEmpty()
  @IsBoolean()
  isActive: boolean;
}

/**
 * Validates time format HH:MM in 24-hour format
 */
export const validateTimeFormat = (time: string): boolean => {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

/**
 * Validates that from time is before to time
 */
export const validateTimeRange = (from: string, to: string): boolean => {
  const [fromHour, fromMin] = from.split(':').map(Number);
  const [toHour, toMin] = to.split(':').map(Number);
  
  const fromMinutes = fromHour * 60 + fromMin;
  const toMinutes = toHour * 60 + toMin;
  
  return fromMinutes < toMinutes;
};

/**
 * Validates time slot data
 */
export const validateTimeSlot = async (timeSlot: TimeSlotDto): Promise<ValidationError[]> => {
  const errors: ValidationError[] = [];

  // Validate basic DTO structure
  const validationErrors = await validate(timeSlot);
  errors.push(...validationErrors);

  // Custom validations
  if (timeSlot.from && !validateTimeFormat(timeSlot.from)) {
    errors.push({
      target: timeSlot,
      property: 'from',
      value: timeSlot.from,
      constraints: { 
        timeFormat: 'Invalid time format. Use HH:MM format in 24-hour format.' 
      },
      children: [],
    } as ValidationError);
  }

  if (timeSlot.to && !validateTimeFormat(timeSlot.to)) {
    errors.push({
      target: timeSlot,
      property: 'to',
      value: timeSlot.to,
      constraints: { 
        timeFormat: 'Invalid time format. Use HH:MM format in 24-hour format.' 
      },
      children: [],
    } as ValidationError);
  }

  if (timeSlot.from && timeSlot.to && !validateTimeRange(timeSlot.from, timeSlot.to)) {
    errors.push({
      target: timeSlot,
      property: 'timeRange',
      value: { from: timeSlot.from, to: timeSlot.to },
      constraints: { 
        timeRange: 'From time must be before to time.' 
      },
      children: [],
    } as ValidationError);
  }

  if (!timeSlot.studentIds || timeSlot.studentIds.length === 0) {
    errors.push({
      target: timeSlot,
      property: 'studentIds',
      value: timeSlot.studentIds,
      constraints: { 
        studentIds: 'Each time slot must have at least one student assigned.' 
      },
      children: [],
    } as ValidationError);
  }

  return errors;
};

/**
 * Validates array of time slots
 */
export const validateTimeSlots = async (timeSlots: TimeSlotDto[]): Promise<ValidationError[]> => {
  const allErrors: ValidationError[] = [];

  for (let i = 0; i < timeSlots.length; i++) {
    const slotErrors = await validateTimeSlot(timeSlots[i]);
    
    // Add index information to errors
    const indexedErrors = slotErrors.map(error => ({
      ...error,
      property: `timeSlots[${i}].${error.property}`,
    }));
    
    allErrors.push(...indexedErrors);
  }

  // Check for duplicate time slots
  const timeRanges = timeSlots.map(slot => `${slot.from}-${slot.to}`);
  const duplicates = timeRanges.filter((range, index) => timeRanges.indexOf(range) !== index);
  
  if (duplicates.length > 0) {
    allErrors.push({
      target: timeSlots,
      property: 'timeSlots',
      value: timeSlots,
      constraints: { 
        duplicateSlots: `Duplicate time slots found: ${duplicates.join(', ')}` 
      },
      children: [],
    } as ValidationError);
  }

  return allErrors;
};
