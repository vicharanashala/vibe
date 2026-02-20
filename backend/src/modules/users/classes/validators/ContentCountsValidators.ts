import {IsInt, IsOptional} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';

export class ContentCountsValidator {
  @JSONSchema({
    description: 'Total number of items in the course',
    example: 45,
    type: 'integer',
  })
  @IsOptional()
  @IsInt()
  totalItems?: number;

  @JSONSchema({
    description: 'Number of video items in the course',
    example: 24,
    type: 'integer',
  })
  @IsOptional()
  @IsInt()
  videos?: number;

  @JSONSchema({
    description: 'Number of quiz items in the course',
    example: 12,
    type: 'integer',
  })
  @IsOptional()
  @IsInt()
  quizzes?: number;

  @JSONSchema({
    description: 'Number of blog/article items in the course',
    example: 9,
    type: 'integer',
  })
  @IsOptional()
  @IsInt()
  articles?: number;

  @JSONSchema({
    description: 'Number of project items in the course',
    example: 2,
    type: 'integer',
  })
  @IsOptional()
  @IsInt()
  project?: number;

  @JSONSchema({
    description: 'Total quiz score achieved by the student',
    example: 85,
    type: 'number',
  })
  @IsOptional()
  @IsInt()
  totalQuizScore?: number;

  @JSONSchema({
    description: 'Total maximum quiz score possible',
    example: 100,
    type: 'number',
  })
  @IsOptional()
  @IsInt()
  totalQuizMaxScore?: number;

  @JSONSchema({
    description: 'Number of completed video items',
    example: 20,
    type: 'integer',
  })
  @IsOptional()
  @IsInt()
  completedVideos?: number;

  @JSONSchema({
    description: 'Number of completed quiz items',
    example: 10,
    type: 'integer',
  })
  @IsOptional()
  @IsInt()
  completedQuizzes?: number;

  @JSONSchema({
    description: 'Number of completed article items',
    example: 8,
    type: 'integer',
  })
  @IsOptional()
  @IsInt()
  completedArticles?: number;

  @JSONSchema({
    description: 'Number of completed project items',
    example: 1,
    type: 'integer',
  })
  @IsOptional()
  @IsInt()
  completedProjects?: number;
}
