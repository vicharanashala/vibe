import {
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import {IQuestionBank, ID} from 'shared/interfaces/quiz';

class CreateQuestionBankBody implements Partial<IQuestionBank> {
  @IsMongoId()
  @IsString()
  @IsOptional()
  courseId?: string;

  @IsMongoId()
  @IsString()
  @IsOptional()
  courseVersionId?: string;

  @IsString({each: true})
  @IsMongoId({each: true})
  @IsArray()
  @IsOptional()
  questions?: ID[];

  @IsArray()
  @IsOptional()
  @IsString({each: true})
  tags?: string[];

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  description: string;
}

export {CreateQuestionBankBody};
