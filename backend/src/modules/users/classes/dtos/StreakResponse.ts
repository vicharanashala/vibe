import { Expose } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class StreakResponse {
  @Expose()
  @IsNumber()
  currentStreak: number;

  @Expose()
  @IsNumber()
  longestStreak: number;

  @Expose()
  @IsBoolean()
  isActiveToday: boolean;

  @Expose()
  @IsOptional()
  @IsString()
  lastActiveDate: string | null;

  @Expose()
  @IsOptional()
  @IsNumber()
  nextMilestone: number | null;

  @Expose()
  @IsNumber()
  progressToNext: number;

  @Expose()
  @IsArray()
  @IsNumber({}, { each: true })
  newlyUnlockedMilestones: number[];
}