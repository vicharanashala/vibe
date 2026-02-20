import { Type } from "class-transformer";
import {
  IsArray,
  IsObject,
  IsString,
  ValidateNested,
  IsNotEmpty
} from "class-validator";
import { JSONSchema } from "class-validator-jsonschema/build/decorators.js";

export class AuditTrailsDetails {

  @IsString()
  id: string;

  @IsString()
  category: string;

  @IsString()
  action: string;

  @IsObject()
  context: object;

  @IsObject()
  changes: object;

  @IsObject()
  outcome: object;

  @IsString()
  timestamp: string;
}

export class AuditTrailsResponse {

  @IsString()
  message: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AuditTrailsDetails)
  @JSONSchema({
    description: "List of audit trails"
  })
  data: AuditTrailsDetails[];
}



export class AuditTrailUserIdParams {
    @JSONSchema({
        description: "User ID for which to retrieve audit trails",
    })
    @IsString()
    @IsNotEmpty()
    userId: string;
}