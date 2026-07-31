import {ItemType} from '#root/shared/interfaces/models.js';
import {Type} from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';

/**
 * Version of the bundle format itself. Bump only on breaking changes to the
 * shape below, so an importer can reject (or migrate) bundles it cannot read.
 */
export const BUNDLE_FORMAT_VERSION = 1;

/**
 * A quiz item's reference to a question bank, with the ObjectId replaced by a
 * bundle-local key. This is what makes a bundle portable across servers.
 */
class BundleQuestionBankRef {
  @IsString()
  @JSONSchema({
    description: 'Bundle-local key of the referenced question bank',
    example: 'bank-0',
  })
  bankKey!: string;

  @IsNumber()
  @JSONSchema({description: 'How many questions to draw from the bank'})
  count!: number;

  @IsOptional()
  @IsArray()
  @IsString({each: true})
  difficulty?: string[];

  @IsOptional()
  @IsArray()
  @IsString({each: true})
  tags?: string[];

  @IsOptional()
  @IsString()
  type?: string;
}

class BundleQuestionBank {
  @IsString()
  @JSONSchema({
    description: 'Bundle-local key referenced by quiz items',
    example: 'bank-0',
  })
  key!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({each: true})
  tags?: string[];

  @IsOptional()
  @IsNumber()
  points?: number;

  @IsArray()
  @IsObject({each: true})
  @JSONSchema({
    description:
      'Question documents with their server-specific fields (_id, createdBy, studentQuestionId) removed. Shape varies by question type.',
  })
  questions!: Record<string, any>[];
}

class BundleItem {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ItemType)
  type!: ItemType;

  @IsString()
  @JSONSchema({
    description: 'Lexorank ordering key, preserved from the source course',
  })
  order!: string;

  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;

  @IsOptional()
  @IsObject()
  @JSONSchema({
    description:
      'Type-specific payload (video URL and offsets, blog content, quiz settings, ...). For QUIZ items questionBankRefs is lifted out into the sibling field below.',
  })
  details?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @ValidateNested({each: true})
  @Type(() => BundleQuestionBankRef)
  questionBankRefs?: BundleQuestionBankRef[];
}

class BundleSection {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  order!: string;

  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @IsArray()
  @ValidateNested({each: true})
  @Type(() => BundleItem)
  items!: BundleItem[];
}

class BundleModule {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  order!: string;

  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @IsArray()
  @ValidateNested({each: true})
  @Type(() => BundleSection)
  sections!: BundleSection[];
}

class BundleCourse {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

class BundleVersion {
  @IsString()
  version!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  supportLink?: string;
}

/**
 * Where the bundle came from. Recorded for traceability only — these ids belong
 * to the source server and are never used to address anything on import.
 */
class BundleSource {
  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  courseVersionId?: string;
}

class CourseBundle {
  @IsInt()
  @Min(1)
  @JSONSchema({description: 'Bundle format version', example: 1})
  formatVersion!: number;

  @IsOptional()
  @IsDateString()
  exportedAt?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BundleSource)
  source?: BundleSource;

  @ValidateNested()
  @Type(() => BundleCourse)
  course!: BundleCourse;

  @ValidateNested()
  @Type(() => BundleVersion)
  version!: BundleVersion;

  @IsArray()
  @ValidateNested({each: true})
  @Type(() => BundleModule)
  modules!: BundleModule[];

  @IsArray()
  @ValidateNested({each: true})
  @Type(() => BundleQuestionBank)
  questionBanks!: BundleQuestionBank[];

  @IsOptional()
  @IsObject()
  @JSONSchema({
    description:
      'Course settings (linear progression, seek-forward, proctoring detectors). Defaults are applied when absent.',
  })
  settings?: Record<string, any>;
}

class ExportCourseVersionParams {
  @IsMongoId()
  @JSONSchema({description: 'The ID of the course to export'})
  courseId!: string;

  @IsMongoId()
  @JSONSchema({description: 'The ID of the version to export'})
  versionId!: string;
}

class ImportCourseResponse {
  @IsString()
  @JSONSchema({description: 'The ID of the newly created course'})
  courseId!: string;

  @IsString()
  @JSONSchema({description: 'The ID of the newly created course version'})
  versionId!: string;

  @IsString()
  @JSONSchema({description: 'Name the course was created under'})
  name!: string;

  @IsString()
  message!: string;
}

export {
  BundleQuestionBankRef,
  BundleQuestionBank,
  BundleItem,
  BundleSection,
  BundleModule,
  BundleCourse,
  BundleVersion,
  BundleSource,
  CourseBundle,
  ExportCourseVersionParams,
  ImportCourseResponse,
};

export const COURSE_TRANSFER_VALIDATORS = [
  BundleQuestionBankRef,
  BundleQuestionBank,
  BundleItem,
  BundleSection,
  BundleModule,
  BundleCourse,
  BundleVersion,
  BundleSource,
  CourseBundle,
  ExportCourseVersionParams,
  ImportCourseResponse,
];
