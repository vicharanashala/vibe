import 'reflect-metadata';
import { IsNotEmpty, IsString, MaxLength, MinLength, IsEmpty, IsOptional, Min, ValidateIf } from "class-validator";
import { ICourse } from "shared/interfaces/IUser";

class CreateCoursePayloadValidator implements ICourse {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  @MinLength(3)
  name: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  description: string;

  @IsEmpty()
  instructors: string[];

  @IsEmpty()
  versions: string[];

  @IsEmpty()
  createdAt?: Date;

  @IsEmpty()
  updatedAt?: Date;
}

class UpdateCoursePayloadValidator implements Partial<ICourse> {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @MinLength(3)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @MinLength(3)
  description: string;

  @ValidateIf((o) => !o.name && !o.description)
  @IsNotEmpty({ message: 'At least one of "name" or "description" must be provided' })
  nameOrDescription: string;

}



export { CreateCoursePayloadValidator, UpdateCoursePayloadValidator };