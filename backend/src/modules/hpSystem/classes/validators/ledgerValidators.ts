import { Expose, Type } from "class-transformer";
import { HpLedgerTransformer } from "../transformers/Ledger.js";
import { IsNumber, IsString, ValidateNested } from "class-validator";

export class StudentLedgerDetailsDto {
    @Expose()
    @IsString()
    studentName: string;

    @Expose()
    @IsString()
    studentEmail: string;

    @Expose()
    @IsNumber()
    hpPoints: number;
}

export class LedgerListResponseDto {

    @Expose()
    @Type(() => HpLedgerTransformer)
    data: HpLedgerTransformer[];

    @Expose()
    @ValidateNested()
    @Type(() => StudentLedgerDetailsDto)
    studentDetails: StudentLedgerDetailsDto;

    @Expose()
    total: number;

    @Expose()
    page: number;

    @Expose()
    limit: number;
}