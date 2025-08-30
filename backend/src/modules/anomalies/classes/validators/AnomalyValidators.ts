import { IsEmail, IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { JSONSchema } from "class-validator-jsonschema";
import { AnomalyType, FileType, IAnomalyData } from "../../index.js";
import { ObjectId } from "mongodb";
import { SortOrder, PaginationWithSortQuery } from '#root/shared/interfaces/models.js';

export class NewAnomalyData {
  @JSONSchema({
    description: 'The type of anomaly detected',
    example: AnomalyType.VOICE_DETECTION,
  })
  @IsEnum(AnomalyType)
  @IsNotEmpty()
  type: AnomalyType;

  @JSONSchema({
    description: 'Course ID associated with the anomaly',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  courseId: string;

  @JSONSchema({
    description: 'Version ID associated with the anomaly',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  versionId: string;

  @JSONSchema({
    description: 'Item ID associated with the anomaly',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  itemId: string;
}

export class AnomalyData extends NewAnomalyData implements IAnomalyData {
  @JSONSchema({
    description: 'Unique identifier for the anomaly',
    type: 'string',
    readOnly: true,
  })
  @IsOptional()
  @IsMongoId()
  _id?: string | ObjectId;

  @JSONSchema({
    description: 'User ID associated with the anomaly',
    type: 'string',
    readOnly: true,
  })
  @IsMongoId()
  @IsString()
  userId: string;

  @JSONSchema({
    description: 'Full name of the student who triggered the anomaly',
    type: 'string',
    readOnly: true,
    example: 'John Doe'
  })
  @IsOptional()
  @IsString()
  studentName?: string;

  @JSONSchema({
    description: 'Email of the student who triggered the anomaly',
    type: 'string',
    format: 'email',
    readOnly: true,
    example: 'john.doe@example.com'
  })
  @IsOptional()
  @IsEmail()
  studentEmail?: string;

  @JSONSchema({
    description: 'URL of the anomaly image stored in cloud storage',
    type: 'string',
    readOnly: true,
  })
  @IsOptional()
  @IsString()
  fileName?: string;

  @JSONSchema({
    description: 'Type of the file associated with the anomaly',
    type: 'string',
    enum: Object.values(FileType),
    readOnly: true,
  })
  @IsEnum(FileType)
  @IsOptional()
  @IsString()
  fileType?: FileType;

  @JSONSchema({
    description: 'Timestamp when the anomaly was detected',
    type: 'string',
    format: 'date-time',
    readOnly: true,
  })
  @IsNotEmpty()
  createdAt: Date;
}

export class GetCourseAnomalyParams {
  @JSONSchema({
    description: 'Course ID to filter anomalies',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  courseId: string;

  @JSONSchema({
    description: 'Version ID to filter anomalies',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  versionId: string;
}

export class GetUserAnomalyParams extends GetCourseAnomalyParams {
  @JSONSchema({
    description: 'User ID to filter anomalies',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  userId: string;
}

export class GetItemAnomalyParams extends GetCourseAnomalyParams {
  @JSONSchema({
    description: 'Item ID to filter anomalies',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  itemId: string;
}

export class AnomalyIdParams {
  @JSONSchema({
    description: 'Anomaly ID to identify the anomaly record',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  id: string;
}

export class DeleteAnomalyBody {
  @JSONSchema({
    description: 'Course ID associated with the anomaly to be deleted',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  courseId: string;

  @JSONSchema({
    description: 'Version ID associated with the anomaly to be deleted',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  versionId: string;
}

export class GetAnomalyParams extends GetCourseAnomalyParams {
  @JSONSchema({
    description: 'Anomaly ID to retrieve specific anomaly details',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  anomalyId: string;
}

export class StatsQueryParams {
  @JSONSchema({
    description: 'Item ID to filter anomaly statistics',
    type: 'string',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  itemId?: string;

  @JSONSchema({
    description: 'User ID to filter anomaly statistics',
    type: 'string',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  userId?: string;
}

export { SortOrder, PaginationWithSortQuery };