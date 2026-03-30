import 'reflect-metadata';
import {Expose, Transform, Type} from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsInt,
  Min,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {ObjectIdToString, StringToObjectId} from '#shared/constants/transformerConstants.js';
import {AchievementTier, IAchievement} from '#root/shared/interfaces/models.js';

@Expose()
export class AchievementDto {
  @JSONSchema({title: 'Achievement ID', type: 'string'})
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true})
  @Transform(StringToObjectId.transformer, {toClassOnly: true})
  _id?: any;

  @JSONSchema({title: 'Slug', description: 'Unique identifier slug', type: 'string', example: 'first_step'})
  @IsString()
  @IsNotEmpty()
  slug: string;

  @JSONSchema({title: 'Title', type: 'string', example: 'First Step'})
  @IsString()
  @IsNotEmpty()
  title: string;

  @JSONSchema({title: 'Description', type: 'string'})
  @IsString()
  description: string;

  @JSONSchema({
    title: 'Tier',
    type: 'string',
    enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'],
  })
  @IsEnum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'])
  tier: AchievementTier;

  @JSONSchema({title: 'Required Course Count', type: 'integer', minimum: 1})
  @IsInt()
  @Min(1)
  requiredCourseCount: number;

  @JSONSchema({title: 'Badge Key', type: 'string', example: 'first-step'})
  @IsString()
  badgeKey: string;

  @JSONSchema({title: 'Earned', description: 'Whether the current user has earned this achievement', type: 'boolean'})
  @IsBoolean()
  earned: boolean;

  @JSONSchema({title: 'Earned At', description: 'Timestamp when the achievement was earned', type: 'string', format: 'date-time', nullable: true})
  @IsOptional()
  @Type(() => Date)
  earnedAt: Date | null;
}

@Expose()
export class AchievementsListResponse {
  @IsArray()
  @ValidateNested({each: true})
  @Type(() => AchievementDto)
  achievements: AchievementDto[];

  constructor(achievements: AchievementDto[]) {
    this.achievements = achievements;
  }
}

@Expose()
export class AchievementMessageResponse {
  @IsString()
  @Expose()
  message: string;

  constructor(message: string) {
    this.message = message;
  }
}
