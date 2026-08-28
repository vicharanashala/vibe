import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class JoinMatchmakingQueueDto {
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsString()
  @IsOptional()
  moduleId?: string;
}
