import {Expose} from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsMongoId,
  IsOptional,
  ValidateIf,
} from 'class-validator';

export class GetUserProgressParams {
  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  userId: string;

  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  courseId: string;

  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  courseVersionId: string;
}

export class StartItemBody {
  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  itemId: string;

  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  moduleId: string;

  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  sectionId: string;
}

export class StartItemParams {
  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  userId: string;

  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  courseId: string;

  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  courseVersionId: string;
}

export class StartItemResponse {
  @Expose()
  watchItemId: string;

  constructor(data: Partial<StartItemResponse>) {
    Object.assign(this, data);
  }
}

export class StopItemParams {
  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  userId: string;

  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  courseId: string;

  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  courseVersionId: string;
}

export class StopItemBody {
  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  watchItemId: string;

  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  itemId: string;

  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  sectionId: string;

  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  moduleId: string;
}

export class UpdateProgressBody {
  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  moduleId: string;

  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  sectionId: string;

  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  itemId: string;

  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  watchItemId: string;
}

export class UpdateProgressParams {
  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  userId: string;

  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  courseId: string;

  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  courseVersionId: string;
}

export class ResetCourseProgressParams {
  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  userId: string;

  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  courseId: string;

  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  courseVersionId: string;
}

export class ResetCourseProgressBody {
  @IsOptional()
  @IsString()
  @IsMongoId()
  moduleId?: string | null;

  @IsOptional()
  @IsString()
  @IsMongoId()
  sectionId?: string | null;

  @IsOptional()
  @IsString()
  @IsMongoId()
  itemId?: string | null;

  @ValidateIf(
    o => o.moduleId === null && (o.sectionId !== null || o.itemId !== null),
    {message: 'moduleId is required if sectionId or itemId is provided'},
  )
  invalidFieldsCheck?: any; // dummy field to trigger validation error

  @ValidateIf(o => o.sectionId === null && o.itemId !== null, {
    message: 'sectionId is required if itemId is provided',
  })
  invalidFieldsCheck2?: any; // dummy field to trigger validation error
}
