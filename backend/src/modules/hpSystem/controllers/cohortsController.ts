import { inject, injectable } from "inversify";
import { Authorized, BadRequestError, CurrentUser, Get, HttpCode, JsonController, Param, Post, QueryParams } from "routing-controllers";
import { OpenAPI, ResponseSchema } from "routing-controllers-openapi";
import { HP_SYSTEM_TYPES } from "../types.js";
import { CohortsService } from "../services/cohortsService.js";
import { BadRequestErrorResponse, IUser } from "#root/shared/index.js";
import { CohortListQueryDto, CohortStudentsListQueryDto, CohortStudentsResponseDto, CourseVersionListQueryDto } from "../classes/validators/courseAndCohorts.js";
import { plainToInstance } from "class-transformer";

@OpenAPI({
    tags: ['HP Activities'],
    description: 'Operations for managing cohorts',
})
@injectable()
@JsonController('/hp/courses-cohorts')
export class CohortsController {
    constructor(
        @inject(HP_SYSTEM_TYPES.cohortsService)
        private readonly cohortsService: CohortsService,
    ) { }


    @OpenAPI({ summary: "List all enrolled course versions" })
    @Get("/courses/versions")
    @Authorized()
    @HttpCode(200)
    @ResponseSchema(BadRequestErrorResponse, {
        description: 'Bad Request Error',
        statusCode: 400,
    })
    async listCourseVersions(@QueryParams() query: CourseVersionListQueryDto, @CurrentUser() user: IUser) {
        const userId = user._id.toString();

        return await this.cohortsService.listCourseVersions(userId, query);
        // const response = {
        //     success: true,
        //     data: [
        //         {
        //             courseId: "c1",
        //             courseName: "Full Stack Development",
        //             versions: [
        //                 {
        //                     courseVersionId: "65f1b6d2a7a3f2c9b7a2d111",
        //                     versionName: "v1.0 - Core",
        //                     totalCohorts: 4,
        //                     createdAt: "2026-01-10T08:30:00Z",
        //                 },
        //                 {
        //                     courseVersionId: "cv124",
        //                     versionName: "v2.0 - NextJS Edition",
        //                     totalCohorts: 2,
        //                     createdAt: "2026-03-01T09:00:00Z",
        //                 },
        //             ],
        //         },
        //     ],
        //     meta: {
        //         totalCourses: 2,
        //         totalVersions: 3,
        //         page: query.page ?? 1,
        //         limit: query.limit ?? 10,
        //         sortBy: query.sortBy ?? "createdAt",
        //         sortOrder: query.sortOrder ?? "desc",
        //         search: query.search ?? "fullstack",
        //     },
        // };

        // return response;
    }

    @OpenAPI({ summary: "List all enrolled cohorts" })
    @Get("/cohorts")
    @Authorized()
    @HttpCode(200)
    @ResponseSchema(BadRequestErrorResponse, {
        description: 'Bad Request Error',
        statusCode: 400,
    })
    async listCohorts(@QueryParams() query: CohortListQueryDto, @CurrentUser() user: IUser) {
        const userId = user._id.toString();

        return await this.cohortsService.listCohorts(userId, query);

        const response = {
            success: true,
            message: "Cohorts fetched successfully",
            data: [
                {
                    cohortId: "co1",
                    cohortName: "JAN-2026",
                    courseVersionId: "65f1b6d2a7a3f2c9b7a2d111",
                    stats: {
                        totalStudents: 120,
                        totalActivities: 15,
                        publishedActivities: 12,
                        draftActivities: 3,
                        totalHpDistributed: 8500,
                        totalCredits: 9000,
                        totalDebits: 500,
                        pendingApprovals: 8,
                        overdueActivities: 4,
                    },
                    lastActivityAt: "2026-02-20T10:30:00Z",
                    createdAt: "2026-01-05T08:00:00Z",
                },
            ],
            meta: {
                totalRecords: 25,
                totalPages: 3,
                currentPage: query.page ?? 1,
                limit: query.limit ?? 10,
                sortBy: query.sortBy ?? "totalStudents",
                sortOrder: query.sortOrder ?? "desc",
                search: query.search ?? "cohort",
            },
        };

        return response;
    }

    @OpenAPI({ summary: "List cohorts the student is enrolled in (hpSystem enabled)" })
    @Get("/student-cohorts")
    @Authorized()
    @HttpCode(200)
    @ResponseSchema(BadRequestErrorResponse, {
        description: 'Bad Request Error',
        statusCode: 400,
    })
    async listStudentCohorts(@QueryParams() query: CohortListQueryDto, @CurrentUser() user: IUser) {
        const userId = user._id.toString();
        return await this.cohortsService.listStudentCohorts(userId, query);
    }


    @OpenAPI({ summary: "List cohort students with HP and completion percentage" })
    @Authorized()
    @Get("/version/:versionId/cohort/:cohortName/students")
    @ResponseSchema(CohortStudentsResponseDto)
    @HttpCode(200)
    @ResponseSchema(BadRequestErrorResponse, {
        description: 'Bad Request Error',
        statusCode: 400,
    })
    async listCohortStudents(@Param("versionId") versionId: string,
        @Param("cohortName") cohortName: string,
        @QueryParams() query: CohortStudentsListQueryDto): Promise<CohortStudentsResponseDto> {


        if (!versionId?.trim()) throw new BadRequestError("versionId is required");
        if (!cohortName?.trim()) throw new BadRequestError("cohortName is required");

        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const sortBy = query.sortBy ?? "name";
        const sortOrder = query.sortOrder ?? "asc";
        const search = query.search?.trim();

        return await this.cohortsService.listCohortStudents({ versionId, cohortName, query: { page, limit, sortBy, sortOrder, search } });

    }

}