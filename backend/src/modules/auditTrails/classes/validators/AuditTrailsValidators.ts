import { Type } from "class-transformer";
import { IsNotEmpty, IsObject, IsString, ValidateNested } from "class-validator";
import { JSONSchema } from "class-validator-jsonschema/build/decorators.js";


class AuditTrailsDetails {
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
    @ValidateNested()
    @IsObject()
    @Type(() => AuditTrailsDetails)
    @JSONSchema({
        description: "Audit trail details",
    })
    auditTrails: AuditTrailsDetails;
}


export class AuditTrailUserIdParams {
    @JSONSchema({
        description: "User ID for which to retrieve audit trails",
    })
    @IsString()
    @IsNotEmpty()
    userId: string;
}