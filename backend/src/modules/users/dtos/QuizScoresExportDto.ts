import { Expose, Type } from 'class-transformer';
import { IsArray, IsNumber, IsString } from 'class-validator';

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
  @IsArray()
  quizScores: Array<{
    moduleId: string;
    sectionId: string;
    quizId: string;
    quizName: string;
    maxScore: number;
    attempts: number;
  }>;
}

export class QuizScoresExportResponseDto {
  @Expose()
  @Type(() => StudentQuizScoreDto)
  @IsArray()
  data: StudentQuizScoreDto[];
}
