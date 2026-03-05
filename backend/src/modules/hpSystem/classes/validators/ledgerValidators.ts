import { Expose, Type } from "class-transformer";
import { HpLedgerTransformer } from "../transformers/Ledger.js";

export class LedgerListResponseDto {

    @Expose()
    @Type(() => HpLedgerTransformer)
    data: HpLedgerTransformer[];

    @Expose()
    total: number;

    @Expose()
    page: number;

    @Expose()
    limit: number;
}