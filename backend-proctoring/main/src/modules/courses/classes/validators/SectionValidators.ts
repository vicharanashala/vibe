import 'reflect-metadata';
import { IsEmpty, IsNotEmpty, IsString, MaxLength, IsOptional, IsMongoId } from "class-validator";
import { ISection } from "shared/interfaces/IUser";
import { ID } from "shared/types";

class CreateSectionPayloadValidator implements ISection {
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
  order: string;

  @IsOptional()
  @IsMongoId()
  @IsString()
  afterSectionId?: string;

  @IsOptional()
  @IsMongoId()
  @IsString()
  beforeSectionId?: string;

  @IsEmpty()
  itemsGroupId?: ID;

  @IsEmpty()
  createdAt: Date;

  @IsEmpty()
  updatedAt: Date;
}

export {
    CreateSectionPayloadValidator
}