import 'reflect-metadata';
import {Expose, Transform, Type} from 'class-transformer';
import {JSONSchema} from 'class-validator-jsonschema';
import {
  IsNotEmpty,
  IsString,
  IsMongoId,
  IsOptional,
  IsDate,
  IsNumber,
  ArrayMinSize,
  IsArray,
} from 'class-validator';

export class ReinstatementParams {
  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({description: 'Course ID'})
  courseId: string;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({description: 'Course Version ID'})
  courseVersionId: string;

  @IsMongoId()
  @IsNotEmpty()
  @JSONSchema({description: 'Learner user ID to reinstate'})
  userId: string;
}

export class ReinstatementBody {
  @IsOptional()
  @IsMongoId()
  @JSONSchema({
    description: 'Cohort ID — defaults to the cohort they were ejected from',
    type: 'string',
  })
  cohortId?: string;
}

@Expose()
export class ReinstatementResponse {
  @IsString()
  @Expose()
  @JSONSchema({description: 'Success message'})
  message: string;

  @IsString()
  @Expose()
  @Transform(({value}) => value?.toString())
  @JSONSchema({description: 'Enrollment ID that was reinstated'})
  enrollmentId: string;

  @IsString()
  @Expose()
  @Transform(({value}) => value?.toString())
  @JSONSchema({description: 'User ID of the reinstated learner'})
  userId: string;

  @IsString()
  @Expose()
  @Transform(({value}) => value?.toString())
  @JSONSchema({description: 'Course ID'})
  courseId: string;

  @IsString()
  @Expose()
  @Transform(({value}) => value?.toString())
  @JSONSchema({description: 'Course Version ID'})
  courseVersionId: string;

  @IsDate()
  @Type(() => Date)
  @Expose()
  @JSONSchema({description: 'Timestamp of reinstatement'})
  reinstatedAt: Date;
}

export class BulkReinstatementBody {
  @IsArray()
  @IsMongoId({each: true})
  @ArrayMinSize(1)
  @JSONSchema({description: 'Array of user IDs to reinstate'})
  userIds: string[];

  @IsNotEmpty()
  @IsMongoId()
  @JSONSchema({description: 'Course ID'})
  courseId: string;

  @IsNotEmpty()
  @IsMongoId()
  @JSONSchema({description: 'Course Version ID'})
  courseVersionId: string;

  @IsOptional()
  @IsMongoId()
  @JSONSchema({description: 'Cohort ID'})
  cohortId?: string;
}

@Expose()
export class BulkReinstatementResponse {
  @IsNumber()
  @Expose()
  successCount: number;

  @IsNumber()
  @Expose()
  failureCount: number;

  @IsArray()
  @Expose()
  errors: string[];
}
