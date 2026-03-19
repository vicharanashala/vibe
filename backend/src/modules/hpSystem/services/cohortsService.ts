import { BaseService, ISettingRepository, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { CohortListItemDto, CohortListQueryDto, CohortListResponseDto, CohortStudentItemDto, CohortStudentsListQueryDto, CohortStudentsResponseDto, CourseVersionListQueryDto, CourseVersionListResponseDto, CourseWithVersionsDto } from "../classes/validators/courseAndCohorts.js";
import { ClientSession, ObjectId } from "mongodb";
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

        @inject(GLOBAL_TYPES.SettingRepo)
        private readonly settingsRepository: ISettingRepository,

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
            }
        ];
    }


    async listCourseVersions(userId: string, query: CourseVersionListQueryDto): Promise<CourseVersionListResponseDto> {
        return await this._withTransaction(async (session: ClientSession) => {
            const [hardcodedCourses, dynamicCourses, instructorEnrollments] = await Promise.all([
                this._handleExisitingCourse(),
                this.cohortRepository.getDynamicCoursesWithVersions(session),
                this.cohortRepository.getInstructorActiveEnrollments(userId)
            ]);

            const enrolledVersionIds = new Set(instructorEnrollments.map(e => e.courseVersionId));

            const hardcodedMappings = [
                { pseudoVersionId: "000000000000000000000001", cohortVersionId: "6968e12cbf2860d6e39051af" },
                { pseudoVersionId: "000000000000000000000001", cohortVersionId: "6970f87e30644cbc74b67150" },
                { pseudoVersionId: "000000000000000000000001", cohortVersionId: "697b4e262942654879011c57" },
                { pseudoVersionId: "000000000000000000000002", cohortVersionId: "69903415e1930c015760a719" },
                { pseudoVersionId: "000000000000000000000002", cohortVersionId: "69942dc6d6d99b252e3a54ff" },
            ];

            const enrolledPseudoIds = new Set<string>();
            for (const map of hardcodedMappings) {
                if (enrolledVersionIds.has(map.cohortVersionId)) {
                    enrolledPseudoIds.add(map.pseudoVersionId);
                }
            }

            const allCoursesRaw = [...hardcodedCourses, ...dynamicCourses];

            const allCourses = allCoursesRaw.map(course => {
                const filteredVersions = course.versions.filter(v =>
                    enrolledVersionIds.has(v.courseVersionId) || enrolledPseudoIds.has(v.courseVersionId)
                );
                return { ...course, versions: filteredVersions };
            }).filter(course => course.versions.length > 0);

            const totalCourses = allCourses.length;
            const totalVersions = allCourses.reduce((sum, course) => sum + course.versions.length, 0);

            // In-memory pagination and sorting
            const page = query.page ?? 1;
            const limit = query.limit ?? 10;
            const skip = (page - 1) * limit;

            // Simplified sorting (usually handled by DB, but here we merge two lists)
            const sortedCourses = allCourses.sort((a, b) => {
                const aName = a.courseName?.toLowerCase() || "";
                const bName = b.courseName?.toLowerCase() || "";
                if (query.sortBy === "courseName") {
                    return query.sortOrder === "asc" ? aName.localeCompare(bName) : bName.localeCompare(aName);
                }
                return 0; // default to no structural change if not sorting by courseName
            });

            const paginatedCourses = sortedCourses.slice(skip, skip + limit);

            return {
                success: true,
                data: paginatedCourses,
                meta: {
                    totalCourses,
                    totalVersions,
                    page,
                    limit,
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
                    const cohortId = await this.cohortRepository.getCohortIdByCohortName(c.cohortName);

                    const [
                        totalStudents,
                        totalActivities,
                        draftActivities,
                        publishedActivities,
                        totalHpDistributed,
                    ] = await Promise.all([
                        this.cohortRepository.getTotalStudentsCountForCourseVersion(c.cohortVersionId),
                        this.activityRepository.getCountByCohortName(c.cohortName, versionId),
                        this.activityRepository.getDraftCountByCohortName(c.cohortName, versionId),
                        this.activityRepository.getPublishedCountByCohortName(c.cohortName, versionId),
                        cohortId
                            ? this.cohortRepository.getTotalHpDistributedByCohort(versionId)
                            : Promise.resolve(0),
                    ]);

                    const totalCredits = 0;
                    const totalDebits = 0;
                    const pendingApprovals = 0;
                    const overdueActivities = 0;

                    return {
                        cohortName: c.cohortName,
                        courseVersionId: versionId,
                        courseId: "000000000000000000000001",
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
                    const cohortId = await this.cohortRepository.getCohortIdByCohortName(c.cohortName);

                    const [
                        totalStudents,
                        totalActivities,
                        draftActivities,
                        publishedActivities,
                        totalHpDistributed,
                    ] = await Promise.all([
                        this.cohortRepository.getTotalStudentsCountForCourseVersion(c.cohortVersionId),
                        this.activityRepository.getCountByCohortName(c.cohortName, versionId),
                        this.activityRepository.getDraftCountByCohortName(c.cohortName, versionId),
                        this.activityRepository.getPublishedCountByCohortName(c.cohortName, versionId),
                        cohortId
                            ? this.cohortRepository.getTotalHpDistributedByCohort(versionId)
                            : Promise.resolve(0),
                    ]);

                    const totalCredits = 0;
                    const totalDebits = 0;
                    const pendingApprovals = 0;
                    const overdueActivities = 0;

                    return {
                        cohortName: c.cohortName,
                        courseVersionId: versionId,
                        courseId: "000000000000000000000001",
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

            const instructorEnrollments = await this.cohortRepository.getInstructorActiveEnrollments(userId);
            const enrolledVersionIds = new Set(instructorEnrollments.map(e => e.courseVersionId));
            const enrolledCohortIds = new Set(instructorEnrollments.map(e => e.cohortId).filter(Boolean));

            if (query.courseVersionId) {
                const isGeneralInstructorForVersion = instructorEnrollments.some(e =>
                    e.courseVersionId === query.courseVersionId && !e.cohortId
                );

                // 1. Fetch hardcoded cohorts for this version
                const fetched = await this._handleExisitingCohorts(query.courseVersionId);
                if (fetched) {
                    const hardcodedMappings = [
                        { pseudoVersionId: "000000000000000000000001", cohortName: "Euclideans", cohortVersionId: "6968e12cbf2860d6e39051af" },
                        { pseudoVersionId: "000000000000000000000001", cohortName: "Dijkstrians", cohortVersionId: "6970f87e30644cbc74b67150" },
                        { pseudoVersionId: "000000000000000000000001", cohortName: "Kruskalians", cohortVersionId: "697b4e262942654879011c57" },
                        { pseudoVersionId: "000000000000000000000002", cohortName: "RSAians", cohortVersionId: "69903415e1930c015760a719" },
                        { pseudoVersionId: "000000000000000000000002", cohortName: "AKSians", cohortVersionId: "69942dc6d6d99b252e3a54ff" },
                    ];

                    const filteredFetched = fetched.filter(c => {
                        const mapping = hardcodedMappings.find(m => m.cohortName === c.cohortName);
                        return mapping && enrolledVersionIds.has(mapping.cohortVersionId);
                    });
                    cohorts.push(...filteredFetched);
                }

                // 2. Fetch dynamic DB cohorts for this version
                let dbCohorts = await this._fetchDbCohorts(query.courseVersionId, "");

                if (!isGeneralInstructorForVersion) {
                    const dbCohortsData = await this.cohortRepository.getCohortsByVersionId(query.courseVersionId);
                    dbCohorts = dbCohorts.filter(c => {
                        const matchingData = dbCohortsData.find(dbC => dbC.name === c.cohortName);
                        return matchingData && enrolledCohortIds.has(matchingData._id?.toString() || "");
                    });
                }

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
    private async _fetchDbCohorts(courseVersionId: string, courseId: string = ""): Promise<CohortListItemDto[]> {
        const dbCohorts = await this.cohortRepository.getCohortsByVersionId(courseVersionId);
        if (!dbCohorts || dbCohorts.length === 0) return [];

        const results = await Promise.all(
            dbCohorts.map(async (cohort) => {
                const cohortId = cohort._id?.toString() ?? "";
                const [
                    totalStudents,
                    totalHpDistributed,
                    totalActivities,
                    draftActivities,
                    publishedActivities,
                ] = await Promise.all([
                    this.cohortRepository.getTotalStudentsCountForCohort(courseVersionId, cohortId),
                    this.cohortRepository.getTotalHpDistributedByCohort(courseVersionId, cohortId),
                    this.activityRepository.getCountByCohortName(cohort.name, courseVersionId),
                    this.activityRepository.getDraftCountByCohortName(cohort.name, courseVersionId),
                    this.activityRepository.getPublishedCountByCohortName(cohort.name, courseVersionId),
                ]);


                return {
                    cohortName: cohort.name,
                    courseVersionId,
                    courseId: courseId,
                    stats: {
                        totalStudents,
                        totalActivities,
                        draftActivities,
                        publishedActivities,
                        totalHpDistributed,
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


    /**
     * Lists the cohorts the student is enrolled in.
     * Hardcoded cohorts are checked directly via enrollment without needing hpSystem checks.
     * Dynamic cohorts are loaded only if the version's hpSystem is enabled.
     */
    async listStudentCohorts(userId: string, query: CohortListQueryDto): Promise<CohortListResponseDto> {
        return await this._withTransaction(async (session: ClientSession) => {
            const studentCohorts: CohortListItemDto[] = [];

            // 1. Manually check the hardcoded cohorts WITHOUT hpSystem checking
            const hardcodedMappings = [
                { pseudoVersionId: "000000000000000000000001", cohortName: "Euclideans", cohortVersionId: "6968e12cbf2860d6e39051af" },
                { pseudoVersionId: "000000000000000000000001", cohortName: "Dijkstrians", cohortVersionId: "6970f87e30644cbc74b67150" },
                { pseudoVersionId: "000000000000000000000001", cohortName: "Kruskalians", cohortVersionId: "697b4e262942654879011c57" },
                { pseudoVersionId: "000000000000000000000002", cohortName: "RSAians", cohortVersionId: "69903415e1930c015760a719" },
                { pseudoVersionId: "000000000000000000000002", cohortName: "AKSians", cohortVersionId: "69942dc6d6d99b252e3a54ff" },
            ];

            for (const mapping of hardcodedMappings) {
                // Check if student is enrolled in the actual cohortVersionId
                const isEnrolled = await this.cohortRepository.isStudentEnrolledInVersion(userId, mapping.cohortVersionId);
                if (isEnrolled) {
                    // Fetch the hardcoded cohort data using the pseudo version ID
                    const hardcodedList = await this._handleExisitingCohorts(mapping.pseudoVersionId);
                    if (hardcodedList) {
                        const matchedCohort = hardcodedList.find(c => c.cohortName === mapping.cohortName);
                        if (matchedCohort) {
                            studentCohorts.push(matchedCohort);
                        }
                    }
                }
            }

            // 2. Fetch active dynamic enrollments and filter by hpSystem
            const enrollments = await this.cohortRepository.getStudentActiveEnrollments(userId);
            if (enrollments && enrollments.length > 0) {
                const versionIds = [...new Set(enrollments.map(e => e.courseVersionId))];

                // Exclude hardcoded version ids from dynamic lookup to avoid double counting or unnecessary db processing
                const dynamicVersionIds = versionIds.filter(id =>
                    !hardcodedMappings.some(m => m.cohortVersionId === id)
                );

                if (dynamicVersionIds.length > 0) {
                    const courseSettings = await this.settingsRepository.getSettingsByVersionIds(
                        dynamicVersionIds.map(id => new ObjectId(id))
                    );

                    const hpEnabledVersionIds = new Set(
                        (courseSettings ?? [])
                            .filter(s => s.settings?.hpSystem === true)
                            .map(s => s.courseVersionId.toString())
                    );

                    const hpEnrollments = enrollments.filter(e => hpEnabledVersionIds.has(e.courseVersionId));

                    const enrollmentsByVersion = new Map<string, typeof hpEnrollments>();
                    for (const enr of hpEnrollments) {
                        const list = enrollmentsByVersion.get(enr.courseVersionId) ?? [];
                        list.push(enr);
                        enrollmentsByVersion.set(enr.courseVersionId, list);
                    }

                    for (const [versionId, versionEnrollments] of enrollmentsByVersion) {
                        const courseId = versionEnrollments[0]?.courseId?.toString() ?? "";
                        const dynamic = await this._fetchDbCohorts(versionId, courseId);

                        const enrolledCohortNames = new Set(
                            versionEnrollments
                                .map(e => e.cohortName?.toLowerCase())
                                .filter(Boolean)
                        );

                        const hasNoCohortName = versionEnrollments.some(e => !e.cohortName);

                        if (hasNoCohortName) {
                            studentCohorts.push(...dynamic);
                        } else {
                            const matched = dynamic.filter(
                                c => enrolledCohortNames.has(c.cohortName.toLowerCase())
                            );
                            studentCohorts.push(...matched);
                        }
                    }
                }
            }

            return {
                success: true,
                message: "Cohorts fetched successfully",
                data: studentCohorts,
                meta: {
                    totalRecords: studentCohorts.length,
                    totalPages: 1,
                    page: query.page ?? 1,
                    limit: query.limit ?? 10,
                    sortBy: query.sortBy ?? "createdAt",
                    sortOrder: query.sortOrder ?? "desc",
                    search: query.search ?? "",
                    currentPage: query.page ?? 1,
                },
            };
        });
    }
}