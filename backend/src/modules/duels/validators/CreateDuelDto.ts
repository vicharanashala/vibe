import { IsMongoId, IsNotEmpty, IsOptional, IsEnum, IsIn, IsDateString } from 'class-validator';

export class CreateDuelDto {
  @IsMongoId()
  @IsNotEmpty()
  courseId: string;

  @IsMongoId()
  @IsOptional()
  moduleId?: string;

  @IsEnum(['FRIEND', 'INVITE_LINK'])
  @IsNotEmpty()
  matchType: 'FRIEND' | 'INVITE_LINK';

  @IsIn([3, 5, 7, 9])
  @IsOptional()
  roundCount?: number;

  @IsMongoId()
  @IsOptional()
  targetUserId?: string;

  @IsDateString()
  @IsOptional()
  scheduledFor?: string;
}
