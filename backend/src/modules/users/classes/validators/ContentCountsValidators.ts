import {
  IsNotEmpty,
  IsInt,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';

export class ContentCountsValidator {
  @JSONSchema({
    description: 'Number of video items in the course',
    example: 24,
    type: 'integer',
  })
  @IsNotEmpty()
  @IsInt()
  videos: number;

  @JSONSchema({
    description: 'Number of quiz items in the course',
    example: 12,
    type: 'integer',
  })
  @IsNotEmpty()
  @IsInt()
  quizzes: number;

  @JSONSchema({
    description: 'Number of blog/article items in the course',
    example: 9,
    type: 'integer',
  })
  @IsNotEmpty()
  @IsInt()
  articles: number;
}
