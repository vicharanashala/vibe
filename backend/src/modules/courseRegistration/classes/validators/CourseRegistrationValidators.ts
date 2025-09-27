import { IsEmail, IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';
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

  @IsNumber()
  @IsNotEmpty()
  @JSONSchema({ example: 9876543210 })
  mobile: number;

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
