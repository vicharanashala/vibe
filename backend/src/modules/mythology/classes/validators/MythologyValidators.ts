import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, Min } from 'class-validator';

export class ChatBody {
  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsArray()
  @IsOptional()
  conversationHistory?: Array<{ role: string; text: string }>;
}

export class SyncScoreBody {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsNumber()
  @Min(0)
  streak!: number;

  @IsNumber()
  @Min(0)
  karma!: number;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  track?: string;
}

export class RiddleBody {
  @IsString()
  @IsNotEmpty()
  lessonTitle!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class PouchSyncBody {
  @IsNumber()
  @Min(0)
  currentStreak!: number;

  @IsString()
  @IsOptional()
  lastActiveDate?: string;

  @IsArray()
  @IsOptional()
  pouchDocs?: any[];

  @IsArray()
  @IsOptional()
  indexedMetrics?: any[];
}
