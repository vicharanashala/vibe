import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsIn, IsMongoId } from 'class-validator';
import { Type } from 'class-transformer';

export class PriorTurnDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsString()
  @IsNotEmpty()
  answer: string;
}

export class AskQuestionDto {
  @IsMongoId()
  @IsNotEmpty()
  courseId: string;

  @IsMongoId()
  @IsOptional()
  moduleId?: string;

  @IsMongoId()
  @IsOptional()
  sectionId?: string;

  @IsString()
  @IsNotEmpty()
  question: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PriorTurnDto)
  priorTurns?: PriorTurnDto[];

  @IsString()
  @IsOptional()
  @IsIn(['summarize', 'key_points', 'real_life_example', 'short_notes', 'explain_differently', 'custom'])
  promptType?: 'summarize' | 'key_points' | 'real_life_example' | 'short_notes' | 'explain_differently' | 'custom';

  @IsMongoId()
  @IsOptional()
  currentVideoId?: string;

  @IsString()
  @IsOptional()
  currentVideoTitle?: string;
}
