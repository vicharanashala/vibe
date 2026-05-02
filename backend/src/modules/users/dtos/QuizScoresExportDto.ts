import {Expose, Type} from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class StudentQuizScoreDto {
  @Expose()
  @IsString()
  studentId: string;

  @Expose()
  @IsString()
  name: string;

  @Expose()
  @IsString()
  email: string;

  @Expose()
  @IsNumber()
  percentCompleted: number;

  @Expose()
  @IsString()
  @IsOptional()
  cohortName?: string;

  @Expose()
  @IsNumber()
  totalCourseScore: number;

  @Expose()
  @IsNumber()
  totalCourseMaxScore: number;

  @Expose()
  @IsArray()
  quizScores: Array<{
    moduleId: string;
    sectionId: string;
    quizId: string;
    quizName: string;
    questionCount: number;
    quizMaxScore: number;
    maxScore: number;
    attempts: number;
    questionScores: Array<{
      questionId: string;
      score: number;
    }>;
  }>;
}

export class QuizScoresMetadataDto {
  @Expose()
  @IsString()
  courseId: string;

  @Expose()
  @IsString()
  versionId: string;

  @Expose()
  @IsNumber()
  totalStudents: number;

  @Expose()
  @IsString()
  @IsOptional() // Made it optional for backward compatibility
  statusTab?: 'ACTIVE' | 'INACTIVE';

  @Expose()
  @IsNumber()
  durationMs: number;

  @Expose()
  @IsString()
  generatedAt: string;
}

export class QuizScoresExportResponseDto {
  @ValidateNested()
  @Expose()
  @Type(() => StudentQuizScoreDto)
  @IsArray()
  data: StudentQuizScoreDto[];

  @Expose()
  @Type(() => QuizScoresMetadataDto)
  metadata: QuizScoresMetadataDto;
}
