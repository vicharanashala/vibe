import { IsEmpty, IsNotEmpty, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { CoursePayload } from "./ICourseService";

export class DTOCoursePayload implements CoursePayload {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  @MinLength(3)
  name: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  description: string;

  @IsNotEmpty()
  @IsString({ each: true })
  instructors: string[];

  @IsEmpty()
  versions: string[];
}