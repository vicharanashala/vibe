import { IsString, IsNotEmpty, IsOptional, IsNumber, IsObject, IsEnum, ValidateNested, IsArray, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { JSONSchema } from 'class-validator-jsonschema';

export enum AnomalyType {
  VOICE_DETECTION = 'voiceDetection',
  NO_FACE = 'no_face',
  MULTIPLE_FACES = 'multiple_faces',
  BLUR_DETECTION = 'blurDetection',
  FOCUS = 'focus',
  HAND_GESTURE_DETECTION = 'handGestureDetection',
  FACE_RECOGNITION = 'faceRecognition',
}

export class SessionMetadata {
  @JSONSchema({
    description: 'Unique session identifier',
    example: 'session-12345',
  })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @JSONSchema({
    description: 'Exam identifier',
    example: 'exam-67890',
  })
  @IsString()
  @IsNotEmpty()
  examId: string;

  @JSONSchema({
    description: 'Browser information',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  })
  @IsString()
  @IsOptional()
  browserInfo?: string;

  @JSONSchema({
    description: 'User agent string',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  })
  @IsString()
  @IsOptional()
  userAgent?: string;
}

export class CreateAnomalyWithFileBody {
  @JSONSchema({
    description: 'User ID who triggered the anomaly',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @JSONSchema({
    description: 'Course ID where anomaly occurred',
    example: '507f1f77bcf86cd799439012',
  })
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @JSONSchema({
    description: 'Course version ID',
    example: 'v1.0',
  })
  @IsString()
  @IsNotEmpty()
  courseVersionId: string;

  @JSONSchema({
    description: 'Module ID (optional)',
    example: '507f1f77bcf86cd799439013',
  })
  @IsString()
  @IsOptional()
  moduleId?: string;

  @JSONSchema({
    description: 'Section ID (optional)',
    example: '507f1f77bcf86cd799439014',
  })
  @IsString()
  @IsOptional()
  sectionId?: string;

  @JSONSchema({
    description: 'Item ID (optional)',
    example: '507f1f77bcf86cd799439015',
  })
  @IsString()
  @IsOptional()
  itemId?: string;

  @JSONSchema({
    description: 'Type of anomaly detected',
    enum: Object.values(AnomalyType),
    example: AnomalyType.VOICE_DETECTION,
  })
  @IsEnum(AnomalyType)
  anomalyType: AnomalyType;

  @JSONSchema({
    description: 'Penalty points assigned for this anomaly',
    example: 5,
    minimum: 0,
  })
  @IsNumber()
  penaltyPoints: number;

  @JSONSchema({
    description: 'Number of faces detected in the image',
    example: 1,
    minimum: 0,
  })
  @IsNumber()
  facesDetected: number;

  @JSONSchema({
    description: 'Session metadata including session ID and exam ID',
  })
  @ValidateNested()
  @Type(() => SessionMetadata)
  sessionMetadata: SessionMetadata;
}

export class CreateAnomalyBody {
  @JSONSchema({
    description: 'User ID who triggered the anomaly',
    example: '64f5e8b2c8a4d12345678901',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @JSONSchema({
    description: 'Course ID where anomaly occurred',
    example: '64f5e8b2c8a4d12345678902',
  })
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @JSONSchema({
    description: 'Course version ID',
    example: 'v1.0',
  })
  @IsString()
  @IsNotEmpty()
  courseVersionId: string;

  @JSONSchema({
    description: 'Module ID (optional)',
    example: '64f5e8b2c8a4d12345678903',
  })
  @IsString()
  @IsOptional()
  moduleId?: string;

  @JSONSchema({
    description: 'Section ID (optional)',
    example: '64f5e8b2c8a4d12345678904',
  })
  @IsString()
  @IsOptional()
  sectionId?: string;

  @JSONSchema({
    description: 'Item ID (optional)',
    example: '64f5e8b2c8a4d12345678905',
  })
  @IsString()
  @IsOptional()
  itemId?: string;

  @JSONSchema({
    description: 'Type of anomaly detected',
    enum: Object.values(AnomalyType),
    example: AnomalyType.VOICE_DETECTION,
  })
  @IsEnum(AnomalyType)
  anomalyType: AnomalyType;

  @JSONSchema({
    description: 'Penalty points assigned for this anomaly',
    example: 5,
    minimum: 0,
  })
  @IsNumber()
  penaltyPoints: number;

  @JSONSchema({
    description: 'Base64 encoded image data captured during anomaly',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...',
  })
  @IsString()
  @IsNotEmpty()
  imageData: string;

  @JSONSchema({
    description: 'Number of faces detected in the image',
    example: 2,
    minimum: 0,
  })
  @IsNumber()
  facesDetected: number;

  @JSONSchema({
    description: 'Session metadata including session ID and exam ID',
  })
  @ValidateNested()
  @Type(() => SessionMetadata)
  sessionMetadata: SessionMetadata;
}

export class AnomalyIdParams {
  @JSONSchema({
    description: 'Anomaly record ID',
    example: '64f5e8b2c8a4d12345678906',
  })
  @IsString()
  @IsNotEmpty()
  id: string;
}

export class UserIdParams {
  @JSONSchema({
    description: 'User ID',
    example: '64f5e8b2c8a4d12345678901',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class CourseIdParams {
  @JSONSchema({
    description: 'Course ID',
    example: '64f5e8b2c8a4d12345678902',
  })
  @IsString()
  @IsNotEmpty()
  courseId: string;
}

export class SessionIdParams {
  @JSONSchema({
    description: 'Session ID',
    example: 'session-12345',
  })
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

export class ExamIdParams {
  @JSONSchema({
    description: 'Exam ID',
    example: 'exam-67890',
  })
  @IsString()
  @IsNotEmpty()
  examId: string;
}

export class MultipartAnomalyData {
  @JSONSchema({
    description: 'JSON string containing all anomaly data',
    example: JSON.stringify({
      userId: "507f1f77bcf86cd799439011",
      courseId: "507f1f77bcf86cd799439012",
      courseVersionId: "507f1f77bcf86cd799439016",
      moduleId: "507f1f77bcf86cd799439013",
      sectionId: "507f1f77bcf86cd799439014",
      itemId: "507f1f77bcf86cd799439015",
      anomalyType: "voiceDetection",
      penaltyPoints: 5,
      facesDetected: 1,
      sessionMetadata: {
        sessionId: "session-12345",
        examId: "exam-67890",
        browserInfo: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    }),
  })
  @IsString()
  @IsNotEmpty()
  data: string;
}

export class GetUserAnomaliesQuery {
  @JSONSchema({
    description: 'Filter by course version ID',
    example: 'v1.0',
  })
  @IsString()
  @IsOptional()
  courseVersionId?: string;

  @JSONSchema({
    description: 'Filter by course ID',
    example: '64f5e8b2c8a4d12345678902',
  })
  @IsString()
  @IsOptional()
  courseId?: string;

  @JSONSchema({
    description: 'Filter by module ID',
    example: '64f5e8b2c8a4d12345678903',
  })
  @IsString()
  @IsOptional()
  moduleId?: string;

  @JSONSchema({
    description: 'Filter by section ID',
    example: '64f5e8b2c8a4d12345678904',
  })
  @IsString()
  @IsOptional()
  sectionId?: string;

  @JSONSchema({
    description: 'Filter by item ID',
    example: '64f5e8b2c8a4d12345678905',
  })
  @IsString()
  @IsOptional()
  itemId?: string;

  @JSONSchema({
    description: 'Filter by anomaly type',
    enum: Object.values(AnomalyType),
    example: AnomalyType.VOICE_DETECTION,
  })
  @IsEnum(AnomalyType)
  @IsOptional()
  anomalyType?: AnomalyType;

  @JSONSchema({
    description: 'Filter anomalies from this date (ISO 8601 format)',
    example: '2024-01-01T00:00:00.000Z',
    format: 'date-time',
  })
  @IsDateString()
  @IsOptional()
  anomaliesFrom?: string;

  @JSONSchema({
    description: 'Filter anomalies to this date (ISO 8601 format)',
    example: '2024-12-31T23:59:59.999Z',
    format: 'date-time',
  })
  @IsDateString()
  @IsOptional()
  anomaliesTo?: string;

  @JSONSchema({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
  })
  @IsNumber()
  @IsOptional()
  page?: number;

  @JSONSchema({
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsNumber()
  @IsOptional()
  limit?: number;
}

export class AnomalyDataResponse {
  @JSONSchema({
    description: 'Success status',
    example: true,
  })
  success: boolean;

  @JSONSchema({
    description: 'Anomaly data',
  })
  data: any;

  @JSONSchema({
    description: 'Response message',
    example: 'Anomaly recorded successfully',
  })
  message: string;
}

export class AnomalyStatsResponse {
  @JSONSchema({
    description: 'Success status',
    example: true,
  })
  success: boolean;

  @JSONSchema({
    description: 'Anomaly statistics',
  })
  data: {
    totalAnomalies: number;
    totalPenaltyPoints: number;
    anomalyBreakdown: Record<string, number>;
  };
}