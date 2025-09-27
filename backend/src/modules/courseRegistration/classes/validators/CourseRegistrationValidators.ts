import { IsEmail, IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsString } from 'class-validator';
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
  @JSONSchema({ example: "9876543210" })
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
  @JSONSchema({ enum: ['GENERAL', 'OBC', 'SE', 'ST', 'OTHERS'], example: 'GENERAL' })
  category: 'GENERAL' | 'OBC' | 'SE' | 'ST' | 'OTHERS';

  @IsString()
  @IsNotEmpty()
  @JSONSchema({ example: 'UniversityName' })
  university: string;
}

// export class CourseRegistrationBody {
//   detail: CourseRegistrationDetail;
// }


import { IsOptional, IsInt, Min, IsIn } from "class-validator";
import { Type } from "class-transformer";

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
  search: string = "";

  @IsOptional()
  @IsIn(["PENDING", "APPROVED", "REJECTED", "ALL"])
  status: "PENDING" | "APPROVED" | "REJECTED" | "ALL" = "ALL";

  @IsOptional()
  @IsIn(["older", "latest"])
  sort: "older" | "latest" ;
}


export class RegistrationParams{
  @JSONSchema({
      description: 'ID of the registration',
      type: 'string',
    })
    @IsMongoId()
    @IsNotEmpty()
    registrationId: string;
}

export class UpdateStatusBody {
  @IsIn(["PENDING", "APPROVED", "REJECTED"])
  status: "PENDING" | "APPROVED" | "REJECTED";
}