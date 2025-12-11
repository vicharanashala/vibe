import { EnrollmentRole } from '#root/shared/index.js';
import {Type} from 'class-transformer';
import {
  IsArray,
  ArrayNotEmpty,
  IsMongoId,
  IsNotEmpty,
  ValidateNested,
  IsEmail,
  IsString,
  IsIn,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
class CourseAndVersionId {
  @JSONSchema({
    description: 'ID of the course to which users are being invited',
    type: 'string',
  })
  @IsMongoId()
  @IsNotEmpty()
  courseId: string;

  @JSONSchema({
    description: 'ID of the specific version of the course',
    type: 'string',
  })
  @IsMongoId()
  @IsNotEmpty()
  versionId: string;
}
class EmailInvite {
  @JSONSchema({
    description: 'Email address of the user to be invited',
    type: 'string',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @JSONSchema({
    description: 'Role that the user will have in the course',
    type: 'string',
    enum: ['INSTRUCTOR', 'STUDENT', 'MANAGER', 'TA', 'STAFF'],
    example: 'STUDENT',
  })
  @IsString()
  @IsIn(['INSTRUCTOR', 'STUDENT', 'MANAGER', 'TA', 'STAFF'])
  @IsNotEmpty()
  role: EnrollmentRole;
}

class InviteBody {
//   @IsArray()
//   @ArrayNotEmpty()
//   @ValidateNested({each: true})
//   @Type(() => EmailInvite)
  inviteData: EmailInvite;
}



export {
  InviteBody,
  CourseAndVersionId,
  EmailInvite
}