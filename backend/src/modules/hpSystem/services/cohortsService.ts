import { BaseService, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { CohortListItemDto, CohortListQueryDto, CohortListResponseDto, CohortStudentItemDto, CohortStudentsListQueryDto, CohortStudentsResponseDto, CourseVersionListQueryDto, CourseVersionListResponseDto, CourseWithVersionsDto } from "../classes/validators/courseAndCohorts.js";
import { ClientSession } from "mongodb";
import { HP_SYSTEM_TYPES } from "../types.js";
import { CohortRepository } from "../repositories/providers/mongodb/cohortsRepository.js";
import { ActivityRepository } from "../repositories/index.js";
import { BadRequestError } from "routing-controllers";


@injectable()
export class CohortsService extends BaseService {
    constructor(
        @inject(GLOBAL_TYPES.Database)
        private readonly mongoDatabase: MongoDatabase,

        @inject(HP_SYSTEM_TYPES.cohortRepository)
        private readonly cohortRepository: CohortRepository,


        @inject(HP_SYSTEM_TYPES.activityRepository)
        private readonly activityRepository: ActivityRepository,

    ) {
        super(mongoDatabase);
    }

    private async _handleExisitingCourse(): Promise<CourseWithVersionsDto> {
        return {
            courseId: "000000000000000000000001",
            courseName: "MERN Stack Development",
            versions: [
                {
                    courseVersionId: "000000000000000000000001",
                    versionName: "Pinternship",
                    totalCohorts: 3, // Euclideans, Dijkstrians, Kruskalians
                    createdAt: "2025-12-18T07:52:42Z",
                },
                {
                    courseVersionId: "000000000000000000000002",
                    versionName: "Vinternship",
                    totalCohorts: 2, // RSAians, AKSians
                    createdAt: "2025-12-18T07:52:42Z",
                }
            ]
        }
    }


    async listCourseVersions(userId: string, query: CourseVersionListQueryDto): Promise<CourseVersionListResponseDto> {
        return await this._withTransaction(async (session: ClientSession) => {
            return {
                success: true,
                data: [
                    await this._handleExisitingCourse(),
                ],
                meta: {
                    totalCourses: 1,
                    totalVersions: 2,
                    page: query.page ?? 1,
                    limit: query.limit ?? 10,
                    sortBy: query.sortBy ?? "createdAt",
                    sortOrder: query.sortOrder ?? "desc",
                    search: query.search,
                }
            }
        })
    }

    private async _handleExisitingCohorts(versionId: string): Promise<CohortListItemDto[] | null> {
        if (versionId !== "000000000000000000000001" && versionId !== "000000000000000000000002")
            return null;

        if (versionId === "000000000000000000000001") {
            // existing version ids under p-internship
            const cohorts = [
                { cohortName: "Euclideans", cohortVersionId: "6968e12cbf2860d6e39051af" },
                { cohortName: "Dijkstrians", cohortVersionId: "6970f87e30644cbc74b67150" },
                { cohortName: "Kruskalians", cohortVersionId: "697b4e262942654879011c57" },
            ] as const;

            const results = await Promise.all(
                cohorts.map(async (c) => {
                    const [
                        totalStudents,
                        totalActivities,
                        draftActivities,
                        publishedActivities,
                    ] = await Promise.all([
                        this.cohortRepository.getTotalStudentsCountForCourseVersion(c.cohortVersionId),
                        this.activityRepository.getCountByCohortName(c.cohortName),
                        this.activityRepository.getDraftCountByCohortName(c.cohortName),
                        this.activityRepository.getPublishedCountByCohortName(c.cohortName),
                    ]);

                    // If these are placeholders, keep them here.
                    // Later you can replace with repo calls without changing the structure.
                    const totalHpDistributed = 0;
                    const totalCredits = 0;
                    const totalDebits = 0;
                    const pendingApprovals = 0;
                    const overdueActivities = 0;

                    return {
                        cohortName: c.cohortName,
                        courseVersionId: versionId, // keep the requested "parent" version id
                        stats: {
                            totalStudents,
                            totalActivities,
                            draftActivities,
                            publishedActivities,
                            totalHpDistributed,
                            totalCredits,
                            totalDebits,
                            pendingApprovals,
                            overdueActivities,
                        },
                        lastActivityAt: "2026-01-20T10:00:00Z",
                        createdAt: "2026-01-15T08:00:00Z",
                    };
                })
            );

            return results;
        } else if (versionId === "000000000000000000000002") {
            const cohorts = [
                { cohortName: "RSAians", cohortVersionId: "69903415e1930c015760a719" },
                { cohortName: "AKSians", cohortVersionId: "69942dc6d6d99b252e3a54ff" },
            ] as const;

            const results = await Promise.all(
                cohorts.map(async (c) => {
                    const [
                        totalStudents,
                        totalActivities,
                        draftActivities,
                        publishedActivities,
                    ] = await Promise.all([
                        this.cohortRepository.getTotalStudentsCountForCourseVersion(c.cohortVersionId),
                        this.activityRepository.getCountByCohortName(c.cohortName),
                        this.activityRepository.getDraftCountByCohortName(c.cohortName),
                        this.activityRepository.getPublishedCountByCohortName(c.cohortName),
                    ]);

                    const totalHpDistributed = 0;
                    const totalCredits = 0;
                    const totalDebits = 0;
                    const pendingApprovals = 0;
                    const overdueActivities = 0;

                    return {
                        cohortName: c.cohortName,
                        courseVersionId: versionId,
                        stats: {
                            totalStudents,
                            totalActivities,
                            draftActivities,
                            publishedActivities,
                            totalHpDistributed,
                            totalCredits,
                            totalDebits,
                            pendingApprovals,
                            overdueActivities,
                        },
                        lastActivityAt: "2026-01-20T10:00:00Z",
                        createdAt: "2026-01-15T08:00:00Z",
                    };
                })
            );

            return results;
        }
        // here cohortid is courseVersionId (to handle existing cohorts for existing course version)


    }

    async listCohorts(userId: string, query: CohortListQueryDto): Promise<CohortListResponseDto> {
        return await this._withTransaction(async (session: ClientSession) => {
            const cohorts = await this._handleExisitingCohorts(query.courseVersionId);
            // if (cohorts)
            return {
                success: true,
                message: "Cohorts fetched successfully",
                data: cohorts,
                meta: {
                    totalRecords: cohorts.length,
                    totalPages: 1,
                    page: query.page ?? 1,
                    limit: query.limit ?? 10,
                    sortBy: query.sortBy ?? "createdAt",
                    sortOrder: query.sortOrder ?? "desc",
                    search: query.search ?? "cohort",
                    currentPage: query.page ?? 1,
                },
            }

            // IMP: IMPLEMENT LOGIC FOR UPCOMING COURSES FROM ENROLLMENT COLLECTION    

        })
    }

    private async _handleExisitingCohortStudents(
        versionId: string,
        cohortName: string,
        query: CohortStudentsListQueryDto
    ): Promise<CohortStudentItemDto[] | null> {
        // Map: parentVersionId -> cohortName -> actualCourseVersionId
        const EXISTING_COHORTS_MAP: Record<string, Record<string, string>> = {
            "000000000000000000000001": {
                euclideans: "6968e12cbf2860d6e39051af",
                dijkstrians: "6970f87e30644cbc74b67150",
                kruskalians: "697b4e262942654879011c57",
            },
            "000000000000000000000002": {
                rsaians: "69903415e1930c015760a719",
                aksians: "69942dc6d6d99b252e3a54ff",
            },
        };

        const normalizedCohort = cohortName?.trim().toLowerCase();
        if (!normalizedCohort) return null;

        const cohortMapForVersion = EXISTING_COHORTS_MAP[versionId];
        if (!cohortMapForVersion) return null;

        const actualVersionId = cohortMapForVersion[normalizedCohort];
        if (!actualVersionId) return null;

        return this.cohortRepository.getStudentsForExistingCohortByVersionId(actualVersionId, query);
    }


    async listCohortStudents(input: {
        versionId: string;
        cohortName: string;
        query?: CohortStudentsListQueryDto;
    }): Promise<CohortStudentsResponseDto> {
        return await this._withTransaction(async (session: ClientSession) => {
            const { versionId, cohortName } = input;
            const query = input.query ?? {};

            if (!versionId?.trim()) throw new BadRequestError("versionId is required");
            if (!cohortName?.trim()) throw new BadRequestError("cohortName is required");


            const students = await this._handleExisitingCohortStudents(versionId, cohortName, query);

            return {
                success: true,
                data: students ?? [],
                meta: {
                    totalRecords: students?.length ?? 0,
                    totalPages: 1,
                    ...query
                },
            }

        })
    }
}