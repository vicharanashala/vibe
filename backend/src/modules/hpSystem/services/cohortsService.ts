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

    private async _handleExisitingCourse(): Promise<CourseWithVersionsDto[]> {
        return [
            {
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
            },
            {
                courseId: "000000000000000000000003",
                courseName: "Hp System course",
                versions: [
                    {
                        courseVersionId: "69b7a82ef131f5fad0c7a76e",
                        versionName: "Hp System course",
                        totalCohorts: 1,
                        createdAt: "2026-03-16T10:00:00Z",
                    }
                ]
            }
        ];
    }


    async listCourseVersions(userId: string, query: CourseVersionListQueryDto): Promise<CourseVersionListResponseDto> {
        return await this._withTransaction(async (session: ClientSession) => {
            return {
                success: true,
                data: await this._handleExisitingCourse(),
                meta: {
                    totalCourses: 2,
                    totalVersions: 3,
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
            let cohorts: CohortListItemDto[] = [];

            if (query.courseVersionId) {
                // 1. Fetch hardcoded cohorts for this version
                const fetched = await this._handleExisitingCohorts(query.courseVersionId);
                if (fetched) cohorts = fetched;

                // 2. Fetch dynamic DB cohorts for this version
                const dbCohorts = await this._fetchDbCohorts(query.courseVersionId);
                cohorts.push(...dbCohorts);
            }

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
        })
    }

    /**
     * Fetches cohorts from the DB `cohorts` collection for a given courseVersionId
     * and builds CohortListItemDto objects with stats.
     */
    private async _fetchDbCohorts(courseVersionId: string): Promise<CohortListItemDto[]> {
        const dbCohorts = await this.cohortRepository.getCohortsByVersionId(courseVersionId);
        if (!dbCohorts || dbCohorts.length === 0) return [];

        const results = await Promise.all(
            dbCohorts.map(async (cohort) => {
                const cohortId = cohort._id?.toString() ?? "";
                const [
                    totalStudents,
                    totalActivities,
                    draftActivities,
                    publishedActivities,
                ] = await Promise.all([
                    this.cohortRepository.getTotalStudentsCountForCohort(courseVersionId, cohortId),
                    this.activityRepository.getCountByCohortName(cohort.name),
                    this.activityRepository.getDraftCountByCohortName(cohort.name),
                    this.activityRepository.getPublishedCountByCohortName(cohort.name),
                ]);

                return {
                    cohortName: cohort.name,
                    courseVersionId,
                    stats: {
                        totalStudents,
                        totalActivities,
                        draftActivities,
                        publishedActivities,
                        totalHpDistributed: 0,
                        totalCredits: 0,
                        totalDebits: 0,
                        pendingApprovals: 0,
                        overdueActivities: 0,
                    },
                    lastActivityAt: cohort.updatedAt?.toISOString?.() ?? new Date().toISOString(),
                    createdAt: cohort.createdAt?.toISOString?.() ?? new Date().toISOString(),
                };
            })
        );

        return results;
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

            // 1. Try hardcoded cohorts first
            let students = await this._handleExisitingCohortStudents(versionId, cohortName, query);

            // 2. If not a hardcoded cohort, try dynamic DB cohort
            if (!students) {
                const dbCohorts = await this.cohortRepository.getCohortsByVersionId(versionId);
                const matchedCohort = dbCohorts.find(
                    c => c.name.toLowerCase() === cohortName.trim().toLowerCase()
                );

                if (matchedCohort && matchedCohort._id) {
                    students = await this.cohortRepository.getStudentsForCohortByCohortId(
                        versionId,
                        matchedCohort._id.toString(),
                        query
                    );
                }
            }

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