import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

export class CourseRegistrationBody {
  @IsString()
  @IsNotEmpty()
  @JSONSchema({ example: 'John Doe' })
  name: string;

  @IsEmail()
  @IsNotEmpty()
  @JSONSchema({ example: 'john@example.com' })
  email: string;

  @IsString()
  @IsNotEmpty()
  @JSONSchema({ example: '9876543210' })
  mobile: string;

  @IsEnum(['MALE', 'FEMALE', 'OTHERS'])
  @JSONSchema({ enum: ['MALE', 'FEMALE', 'OTHERS'], example: 'MALE' })
  gender: 'MALE' | 'FEMALE' | 'OTHERS';

  @IsString()
  @IsNotEmpty()
  @JSONSchema({ example: 'CityName' })
  city: string;

  @IsString()
  @IsNotEmpty()
  @JSONSchema({ example: 'StateName' })
  state: string;

  @IsEnum(['GENERAL', 'OBC', 'SE', 'ST', 'OTHERS'])
  @JSONSchema({
    enum: ['GENERAL', 'OBC', 'SE', 'ST', 'OTHERS'],
    example: 'GENERAL',
  })
  category: 'GENERAL' | 'OBC' | 'SE' | 'ST' | 'OTHERS';

  @IsString()
  @IsNotEmpty()
  @JSONSchema({ example: 'UniversityName' })
  university: string;
}

// export class CourseRegistrationBody {
//   detail: CourseRegistrationDetail;
// }

import { IsOptional, IsInt, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ICourseRegistration } from '#root/shared/index.js';

export class RegistrationFilterQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 10;

  @IsOptional()
  @IsString()
  search: string = '';

  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'ALL'])
  // status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL' = 'ALL';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

  @IsOptional()
  @IsIn(['older', 'latest'])
  sort: 'older' | 'latest';
}

export class RegistrationParams {
  @JSONSchema({
    description: 'ID of the registration',
    type: 'string',
  })
  @IsMongoId()
  @IsNotEmpty()
  registrationId: string;
}

export class UpdateStatusBody {
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export class BulkUpdateStatusBody {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional() // allow the array to be empty
  @JSONSchema({
    description: 'Array of registration IDs to update',
    example: ['68d7c3aaa1291bb31a3739f0', '68d7c3aaa1291bb31a3739f1'],
  })
  selected?: string[];
}

// export class updateSettingsBody {
//   @IsString()
//   @IsNotEmpty()
//   @JSONSchema({example: 'Gender'})
//   label: string;

//   @IsEnum([
//     'TEXT',
//     'TEXTAREA',
//     'EMAIL',
//     'TEL',
//     'DATE',
//     'NUMBER',
//     'URL',
//     'SELECT',
//   ])
//   @IsNotEmpty()
//   @JSONSchema({example: 'select'})
//   type:
//     | 'TEXT'
//     | 'TEXTAREA'
//     | 'EMAIL'
//     | 'TEL'
//     | 'DATE'
//     | 'NUMBER'
//     | 'URL'
//     | 'SELECT';
//   @IsOptional()
//   @IsArray()
//   @ArrayUnique()
//   @IsString({each: true})
//   @JSONSchema({example: ''})
//   options?: string[];

//   @IsBoolean()
//   @IsNotEmpty()
//   @JSONSchema({example: true})
//   required: boolean;

//   @IsBoolean()
//   @IsOptional()
//   @JSONSchema({example: true})
//   isDefault: boolean;
// }

// export class UpdateRegistrationSchemasBody {
//   @IsObject()
//   @JSONSchema({ example: { type: 'object', properties: { name: { type: 'string' } } } }) // Example; adjust as needed
//   jsonSchema: any;

//   @IsObject()
//   @JSONSchema({ example: { type: 'VerticalLayout', elements: [{ type: 'Control', scope: '#/properties/name' }] } }) 
//   uiSchema: any;
// }/


export class UpdateRegistrationSchemasBody {
  @IsObject()
  @JSONSchema({ description: "Dynamic JSON Schema for the form" })
  jsonSchema: Record<string, any>;

  @IsObject()
  @JSONSchema({ description: "Dynamic UI Schema for the form" })
  uiSchema: Record<string, any>;
}

export class PendingRegistrationResponse {
  @IsString()
  _id: string;

  @IsString()
  userId: string;

  @IsString()
  courseId: string;

  @IsString()
  versionId: string;

  @IsString()
  status: string;

  @IsString()
  createdAt: string;

  @IsObject()
  @JSONSchema({ description: "User information" })
  user: {
    email: string;
    firstName: string;
    lastName: string;
  };

  @IsObject()
  @JSONSchema({ description: "Course information" })
  course: {
    name: string;
  };

  @IsObject()
  @JSONSchema({ description: "Version information" })
  version: {
    version: string;
  };
}

export class ApprovedRegistrationResponse {
  @IsString()
  _id: string;

  @IsString()
  userId: string;

  @IsString()
  courseId: string;

  @IsString()
  versionId: string;

  @IsString()
  status: string;

  @IsObject()
  @JSONSchema({ description: "Course information" })
  course: {
    name: string;
  };
}

export class GetPendingRegistrationsParams {
  @IsString()
  instructorId: string;
}

export class GetUnreadApprovedRegistrationsParams {
  @IsString()
  studentId: string;
}

export class markNotificationAsReadResponse {
  @IsString()
  message: string;

  @IsBoolean()
  success: boolean;
}

class CourseVersionDetailsObject {
  @IsString()
  id: string;

  @IsString()
  courseId: string;

  @IsObject()
  course: object;

  @IsString()
  version: string;

  @IsString()
  description: string;

  @IsArray()
  modules: Array<any>;

  @IsNumber()
  totalItems: number;

  @IsString()
  createdAt: string;

  @IsString()
  updatedAt: string;

  @IsArray()
  instructors: Array<any>;
}

export class CourseVersionDetailsResponse {
  @ValidateNested()
  @Type(() => CourseVersionDetailsObject)
  @IsObject()
  @JSONSchema({ description: "Course Version Details" })
  courseVersionDetails: CourseVersionDetailsObject[];
}


export class AllRegistrationsResponse {

  @IsNumber()
  totalDocuments: number;

  @IsNumber()
  totalPages: number;

  @IsNumber()
  currentPage: number;

  @IsArray()
  registrations: ICourseRegistration[];
}


export class updateStatusResponse {
  @JSONSchema({description: 'Message',example:'Registration status updated successfully'})
  @IsString()
  message: string;

  @ValidateNested()
  @IsArray()
  registration: ICourseRegistration[];
}

export class updateStatusBulkResponse {
  @JSONSchema({description: 'Message',example:'Registration status updated successfully'})
  @IsString()
  message: string;

  @IsNumber()
  registration:number;
}
