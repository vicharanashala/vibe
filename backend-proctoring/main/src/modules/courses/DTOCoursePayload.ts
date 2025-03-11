import { IsBoolean, IsEmpty, IsNotEmpty, IsNumber, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { CoursePayload } from "./ICourseService";
import { ICourseVersion, IItem, IModule, ISection } from '../../shared/interfaces/IUser'

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
    id?: string | undefined;

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

    @ValidateNested({ each: true })
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

    @IsNotEmpty()
    @IsNumber()
    @Min(1)
    @Max(20)
    order:number;

    @ValidateNested({ each: true })
    sections: DTOSectionPayload[];

    @IsBoolean()
    isLast: boolean;

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

    @IsNotEmpty()
    @IsNumber()
    @Min(1)
    @Max(20)
    order:number;

    @IsEmpty()
    itemIds: string[];

    @IsBoolean()
    isLast: boolean;

    @IsEmpty()
    createdAt: Date;

    @IsEmpty()
    updatedAt: Date;
}

