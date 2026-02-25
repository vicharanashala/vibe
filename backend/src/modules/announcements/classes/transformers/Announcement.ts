import 'reflect-metadata';
import { Expose, Transform, Type } from 'class-transformer';
import {
    ObjectIdToString,
    StringToObjectId,
} from '#shared/constants/transformerConstants.js';
import {
    ID,
    AnnouncementType,
    IAnnouncementAttachment,
} from '#shared/interfaces/models.js';
import { JSONSchema } from 'class-validator-jsonschema';
import {
    IsNotEmpty,
    IsString,
    IsOptional,
    IsArray,
    IsBoolean,
    IsEnum,
    ValidateNested,
} from 'class-validator';

export class Announcement {
    @JSONSchema({
        title: 'Announcement ID',
        description: 'Unique identifier for the announcement',
        type: 'string',
    })
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    _id?: ID;

    @JSONSchema({
        title: 'Title',
        description: 'Title of the announcement',
        type: 'string',
    })
    @IsString()
    @IsNotEmpty()
    title: string;

    @JSONSchema({
        title: 'Content',
        description: 'Detailed content of the announcement',
        type: 'string',
    })
    @IsString()
    @IsNotEmpty()
    content: string;

    @JSONSchema({
        title: 'Type',
        description: 'Announcement type',
        type: 'string',
        enum: ['GENERAL', 'COURSE_SPECIFIC', 'VERSION_SPECIFIC'],
    })
    @IsEnum(AnnouncementType)
    type: AnnouncementType;

    @JSONSchema({ title: 'Course ID', type: 'string' })
    @IsOptional()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    courseId?: ID;

    @JSONSchema({ title: 'Course Version ID', type: 'string' })
    @IsOptional()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    courseVersionId?: ID;

    @JSONSchema({ title: 'Course Name', type: 'string' })
    @IsOptional()
    @IsString()
    courseName?: string;

    @JSONSchema({ title: 'Course Version Name', type: 'string' })
    @IsOptional()
    @IsString()
    courseVersionName?: string;

    @JSONSchema({ title: 'Instructor ID', type: 'string' })
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    instructorId: ID;

    @JSONSchema({ title: 'Instructor Name', type: 'string' })
    @IsString()
    instructorName: string;

    @JSONSchema({ title: 'Attachments', type: 'array' })
    @IsOptional()
    @IsArray()
    attachments?: IAnnouncementAttachment[];

    @JSONSchema({ title: 'Is Hidden', type: 'boolean' })
    @IsBoolean()
    isHidden: boolean;

    @Type(() => Date)
    createdAt: Date;

    @Type(() => Date)
    updatedAt: Date;
}

@Expose()
export class AnnouncementResponse {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => Announcement)
    announcements: any[];

    @IsOptional()
    totalDocuments?: number;

    @IsOptional()
    totalPages?: number;

    @IsOptional()
    isAdmin?: boolean;

    constructor(
        announcements: any[],
        totalDocuments?: number,
        totalPages?: number,
        isAdmin?: boolean,
    ) {
        this.announcements = announcements;
        this.totalDocuments = totalDocuments;
        this.totalPages = totalPages;
        this.isAdmin = isAdmin;
    }
}

@Expose()
export class AnnouncementMessageResponse {
    @IsString()
    @Expose()
    message: string;

    constructor(message: string) {
        this.message = message;
    }
}
