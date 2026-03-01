import { BaseService, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { CohortListQueryDto, CohortListResponseDto, CourseVersionListQueryDto, CourseVersionListResponseDto } from "../classes/validators/courseAndCohorts.js";
import { ClientSession } from "mongodb";


@injectable()
export class CohortsService extends BaseService {
    constructor(
        @inject(GLOBAL_TYPES.Database)
        private readonly mongoDatabase: MongoDatabase,

    ) {
        super(mongoDatabase);
    }

    // async listCourseVersions(userId: string, query: CourseVersionListQueryDto): Promise<CourseVersionListResponseDto> {
        // return await this._withTransaction(async (session: ClientSession) => {

        // })
    // }
    // async listCohorts(userId: string, query: CohortListQueryDto): Promise<CohortListResponseDto> {
        // return await this._withTransaction(async (session: ClientSession) => {

        // })
    // }

}