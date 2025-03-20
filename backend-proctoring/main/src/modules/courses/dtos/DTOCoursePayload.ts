import { IsBoolean, IsEmpty, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { CoursePayload } from "../interfaces/ICourseService";
import { ICourseVersion, IItem, IItemId, IModule, ISection } from '../../../shared/interfaces/IUser'

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


export class DTOCourseVersionPayload implements ICourseVersion {
    @IsEmpty()
    _id?: string | undefined;

    @IsEmpty()
    courseId: string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(255)
    version: string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(1000)
    description: string;

    @IsEmpty()
    modules: DTOModulePayload[];

    @IsEmpty()
    createdAt: Date;

    @IsEmpty()
    updatedAt: Date;

}

export class DTOModulePayload implements IModule {

    @IsEmpty()
    moduleId?: string | undefined;

    @IsNotEmpty()
    @IsString()
    @MaxLength(255)
    name: string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(1000)
    description: string;

    @IsEmpty()
    order:string;

    @IsOptional()
    @IsMongoId()
    @IsString()
    afterModuleId?: string;

    @IsOptional()
    @IsMongoId()
    @IsString()
    beforeModuleId?: string;

    @IsEmpty()
    sections: ISection[];

    @IsEmpty()
    createdAt: Date;

    @IsEmpty()
    updatedAt: Date;

}

export class DTOSectionPayload implements ISection {

    @IsEmpty()
    sectionId?: string | undefined;

    @IsNotEmpty()
    @IsString()
    @MaxLength(255)
    name: string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(1000)
    description: string;

    @IsEmpty()
    order:string;

    @IsOptional()
    @IsMongoId()
    @IsString()
    afterSectionId?: string;

    @IsOptional()
    @IsMongoId()
    @IsString()
    beforeSectionId?: string;

    @IsEmpty()
    itemIds: IItemId[];

    @IsEmpty()
    createdAt: Date;

    @IsEmpty()
    updatedAt: Date;
}


export enum ItemType {
    VIDEO = "VIDEO",
    QUIZ = "QUIZ",
    BLOG = "BLOG",
  }
  
  export interface IBaseItem {
    name: string;
    description: string;
    type: ItemType;
    sectionId: string;
    order: string;
    isLast: boolean;
    itemDetailsId: string;
  }
  
  export interface IVideoDetails {
    URL: string;
    startTime: string;
    endTime: string;
    points: number;
  }
  
  export interface IQuizDetails {
    questionVisibility: number;
  }
  
  export interface IBlogDetails {
    tags: string[];
    content: string;
    points: number;
  }
  
