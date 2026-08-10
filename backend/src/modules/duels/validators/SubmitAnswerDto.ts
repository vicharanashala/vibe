import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class SubmitAnswerDto {
  @IsString()
  @IsNotEmpty()
  lotItemId: string;

  @IsNumber()
  @IsNotEmpty()
  responseTimeMs: number;
}
