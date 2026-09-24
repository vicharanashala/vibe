import { IsString, IsArray, IsOptional, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class TranscriptItemDto {
  @IsOptional()
  @IsString()
  videoId?: string;

  @IsOptional()
  @IsString()
  videoTitle?: string;

  @IsString()
  transcriptText!: string;
}

export class GenerateSectionNotesDto {
  @IsString()
  courseVersionId!: string;

  @IsString()
  sectionId!: string;

  @IsOptional()
  @IsString()
  sectionTitle?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TranscriptItemDto)
  transcripts!: TranscriptItemDto[];
}
