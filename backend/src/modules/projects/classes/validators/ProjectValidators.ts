import {ID, IUser} from '#root/shared/index.js';
import {IsString, IsUrl, IsOptional, IsDate, IsNotEmpty} from 'class-validator';

export class SubmitProjectBody {
  @IsNotEmpty({message: 'Submission URL is required'})
  @IsUrl({}, {message: 'Submission URL must be a valid URL'})
  submissionURL!: string;

  @IsOptional()
  comment?: string;
}

export class SubmissionResponse {
  @IsString()
  courseId!: ID;

  @IsString()
  courseVersionId!: ID;

  @IsUrl()
  submissionURL!: ID;

  @IsOptional()
  @IsString()
  comment?: ID;

  @IsDate()
  createdAt!: Date;

  @IsOptional()
  userInfo?: Partial<IUser>;
}
