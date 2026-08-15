import 'reflect-metadata';
import {Expose, Type} from 'class-transformer';
import {JSONSchema} from 'class-validator-jsonschema';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ShareLinkEmailStatus,
  ShareLinkStatus,
  ShareLinkViewingMode,
} from '#shared/interfaces/models.js';

export class CourseAndVersionParams {
  @JSONSchema({
    description: 'Course the share links point to',
    type: 'string',
  })
  @IsMongoId()
  @IsNotEmpty()
  courseId: string;

  @JSONSchema({
    description: 'Course version the share links point to',
    type: 'string',
  })
  @IsMongoId()
  @IsNotEmpty()
  versionId: string;
}

export class ShareLinkIdParams {
  @IsMongoId()
  @IsNotEmpty()
  shareLinkId: string;
}

export class ShareLinkTokenParams {
  @JSONSchema({
    description: 'Opaque token carried by the share link',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  @Length(32, 128)
  token: string;
}

export class ShareLinkRecipient {
  @JSONSchema({
    description: 'Name shown to the sharer in the analytics dashboard',
    example: 'Ananya Rao',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  name: string;

  @JSONSchema({
    description: 'Recipient email. Never used to make them sign in — it is the '
      + 'identity the link carries, and where the link can be mailed.',
    example: 'ananya@example.com',
    type: 'string',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class CreateShareLinksBody {
  @JSONSchema({
    description: 'Recipients to mint one link each for',
    type: 'array',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({each: true})
  @Type(() => ShareLinkRecipient)
  recipients: ShareLinkRecipient[];

  @JSONSchema({
    description: 'Cohort the links resolve into',
    type: 'string',
  })
  @IsOptional()
  @IsMongoId()
  cohortId?: string;

  @JSONSchema({
    description:
      'Video item the link was generated from. Optional — the link still opens '
      + 'the course, this only records what the sharer was looking at.',
    type: 'string',
  })
  @IsOptional()
  @IsMongoId()
  itemId?: string;

  @JSONSchema({
    description: 'Days until the links expire. Defaults to 30.',
    type: 'number',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInDays?: number;

  @JSONSchema({
    description:
      'Whether recipients get plain playback or the full proctored ViBe '
      + 'experience. Defaults to PLAIN — someone who was simply sent a video '
      + 'is not a learner working through a course.',
    enum: Object.values(ShareLinkViewingMode),
  })
  @IsOptional()
  @IsEnum(ShareLinkViewingMode)
  viewingMode?: ShareLinkViewingMode;

  @JSONSchema({
    description:
      'Email each recipient their own link. Off by default — the sharer may '
      + 'prefer to hand the links over themselves.',
    type: 'boolean',
  })
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;
}

export class ValidateYouTubeUrlBody {
  @JSONSchema({
    description: 'The YouTube URL the instructor pasted',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  url: string;
}

@Expose()
export class YouTubeValidationResponse {
  @Expose()
  @IsBoolean()
  @JSONSchema({
    description:
      'Whether the video can be played inside ViBe. False means it cannot be '
      + 'tracked either, and no share link should be generated for it.',
  })
  embeddable: boolean;

  @Expose()
  @IsOptional()
  @IsString()
  videoId?: string;

  @Expose()
  @IsOptional()
  @IsString()
  title?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @JSONSchema({
    description: 'Machine-readable reason the video cannot be embedded',
  })
  reason?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @JSONSchema({
    description: 'Message to show the instructor, saying what to do about it',
  })
  message?: string;
}

@Expose()
export class ShareLinkResponse {
  @Expose()
  @IsString()
  shareLinkId: string;

  @Expose()
  @IsString()
  recipientName: string;

  @Expose()
  @IsString()
  recipientEmail: string;

  @Expose()
  @IsString()
  @JSONSchema({description: 'The URL to send to this recipient'})
  url: string;

  @Expose()
  @IsEnum(ShareLinkStatus)
  status: ShareLinkStatus;

  @Expose()
  @IsEnum(ShareLinkViewingMode)
  viewingMode: ShareLinkViewingMode;

  @Expose()
  @IsEnum(ShareLinkEmailStatus)
  @JSONSchema({
    description: 'Whether the link was mailed to this recipient',
  })
  emailStatus: ShareLinkEmailStatus;

  @Expose()
  @Type(() => Date)
  expiresAt: Date;
}

@Expose()
export class CreateShareLinksResponse {
  @Expose()
  @IsArray()
  @ValidateNested({each: true})
  @Type(() => ShareLinkResponse)
  links: ShareLinkResponse[];
}

@Expose()
export class ShareLinkAnalyticsResponse {
  @Expose()
  @IsString()
  shareLinkId: string;

  @Expose()
  @IsString()
  recipientName: string;

  @Expose()
  @IsString()
  recipientEmail: string;

  @Expose()
  @IsEnum(ShareLinkStatus)
  status: ShareLinkStatus;

  @Expose()
  @IsNumber()
  @JSONSchema({description: 'Times the link was opened'})
  openCount: number;

  @Expose()
  @IsNumber()
  @JSONSchema({description: 'Seconds of video actually watched'})
  totalWatchTimeSeconds: number;

  @Expose()
  @IsNumber()
  @JSONSchema({description: 'Items completed out of the version total'})
  completedItems: number;

  @Expose()
  @IsNumber()
  totalItems: number;

  @Expose()
  @IsNumber()
  @JSONSchema({description: 'completedItems / totalItems, 0-100'})
  watchedPercent: number;

  @Expose()
  @IsNumber()
  @JSONSchema({description: 'Rewinds recorded across the shared course'})
  rewinds: number;

  @Expose()
  @IsNumber()
  @JSONSchema({description: 'Fast-forwards recorded across the shared course'})
  fastForwards: number;

  @Expose()
  @IsOptional()
  @Type(() => Date)
  lastSeenAt?: Date;
}

@Expose()
export class ShareLinkAnalyticsListResponse {
  @Expose()
  @IsArray()
  @ValidateNested({each: true})
  @Type(() => ShareLinkAnalyticsResponse)
  recipients: ShareLinkAnalyticsResponse[];
}

@Expose()
export class OpenShareLinkResponse {
  @Expose()
  @IsString()
  @JSONSchema({
    description:
      'Firebase custom token for the guest identity behind this link. The '
      + 'client exchanges it for an ID token and then calls the normal APIs.',
  })
  customToken: string;

  @Expose()
  @IsString()
  courseId: string;

  @Expose()
  @IsString()
  courseVersionId: string;

  @Expose()
  @IsOptional()
  @IsString()
  cohortId?: string;

  @Expose()
  @IsOptional()
  @IsString()
  itemId?: string;

  @Expose()
  @IsString()
  recipientName: string;

  @Expose()
  @IsEnum(ShareLinkViewingMode)
  @JSONSchema({
    description:
      'PLAIN means the client must not start proctoring, rollback or linear '
      + 'gating for this viewer.',
  })
  viewingMode: ShareLinkViewingMode;
}

export class QuickShareBody {
  @JSONSchema({
    description: 'The YouTube URL to share. No course is involved.',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  url: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({each: true})
  @Type(() => ShareLinkRecipient)
  recipients: ShareLinkRecipient[];

  @JSONSchema({
    description:
      'Where the video ends, HH:MM:SS. Supply it so completion can be '
      + 'detected; without it only watch time is meaningful.',
    example: '00:12:30',
  })
  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInDays?: number;

  @IsOptional()
  @IsEnum(ShareLinkViewingMode)
  viewingMode?: ShareLinkViewingMode;

  @JSONSchema({
    description: 'Email each recipient their own link.',
    type: 'boolean',
  })
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;
}

@Expose()
export class QuickShareResponse {
  @Expose()
  @IsString()
  itemId: string;

  @Expose()
  @IsString()
  videoTitle: string;

  @Expose()
  @IsArray()
  @ValidateNested({each: true})
  @Type(() => ShareLinkResponse)
  links: ShareLinkResponse[];
}

@Expose()
export class ShareLinkMessageResponse {
  @Expose()
  @IsString()
  message: string;
}
