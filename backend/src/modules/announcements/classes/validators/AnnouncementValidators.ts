import {
    IsString,
    IsOptional,
    IsMongoId,
    IsNotEmpty,
    IsEnum,
    IsArray,
    ValidateNested,
    IsBoolean,
    IsInt,
    Min,
    Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { JSONSchema } from 'class-validator-jsonschema';
import { AnnouncementType } from '#root/shared/interfaces/models.js';

export class AnnouncementIdParams {
    @JSONSchema({
        description: 'Unique identifier for the announcement',
        type: 'string',
    })
    @IsMongoId()
    @IsNotEmpty()
    announcementId: string;
}

export class AttachmentBody {
    @JSONSchema({
        description: 'Name of the attached file',
        type: 'string',
        example: 'syllabus.pdf',
    })
    @IsString()
    @IsNotEmpty()
    fileName: string;

    @JSONSchema({
        description: 'URL of the attached file',
        type: 'string',
        example: 'https://storage.example.com/syllabus.pdf',
    })
    @IsString()
    @IsNotEmpty()
    fileUrl: string;

    @JSONSchema({
        description: 'Type of the file (e.g., pdf, link)',
        type: 'string',
        example: 'pdf',
    })
    @IsString()
    @IsNotEmpty()
    fileType: string;
}

export class CreateAnnouncementBody {
    @JSONSchema({
        description: 'Title of the announcement',
        type: 'string',
        example: 'Important Course Update',
    })
    @IsString()
    @IsNotEmpty()
    @Matches(/\S/, { message: 'Title cannot be empty or just spaces' })
    title: string;

    @JSONSchema({
        description: 'Detailed content of the announcement',
        type: 'string',
        example: 'The deadline for assignment 3 has been extended...',
    })
    @IsString()
    @IsNotEmpty()
    @Matches(/\S/, { message: 'Content cannot be empty or just spaces' })
    content: string;

    @JSONSchema({
        description: 'Type of announcement: GENERAL, COURSE_SPECIFIC, or VERSION_SPECIFIC',
        type: 'string',
        enum: ['GENERAL', 'COURSE_SPECIFIC', 'VERSION_SPECIFIC'],
        example: 'GENERAL',
    })
    @IsEnum(AnnouncementType)
    @IsNotEmpty()
    type: AnnouncementType;

    @JSONSchema({
        description: 'Course ID (required for COURSE_SPECIFIC and VERSION_SPECIFIC)',
        type: 'string',
    })
    @IsOptional()
    @IsMongoId()
    courseId?: string;

    @JSONSchema({
        description: 'Course Version ID (required for VERSION_SPECIFIC)',
        type: 'string',
    })
    @IsOptional()
    @IsMongoId()
    courseVersionId?: string;

    @JSONSchema({
        description: 'Optional file attachments',
        type: 'array',
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AttachmentBody)
    attachments?: AttachmentBody[];
}

export class UpdateAnnouncementBody {
    @JSONSchema({
        description: 'Updated title',
        type: 'string',
    })
    @IsOptional()
    @IsString()
    @Matches(/\S/, { message: 'Title cannot be empty or just spaces' })
    title?: string;

    @JSONSchema({
        description: 'Updated content',
        type: 'string',
    })
    @IsOptional()
    @IsString()
    @Matches(/\S/, { message: 'Content cannot be empty or just spaces' })
    content?: string;



    @JSONSchema({
        description: 'Updated attachments',
        type: 'array',
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AttachmentBody)
    attachments?: AttachmentBody[];
}

export class AnnouncementQueryParams {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit: number = 10;

    @IsOptional()
    @IsEnum(AnnouncementType)
    @Transform(({ value }) => (value === '' ? undefined : value))
    type?: AnnouncementType;

    @IsOptional()
    @IsMongoId()
    courseId?: string;

    @IsOptional()
    @IsMongoId()
    courseVersionId?: string;
}
