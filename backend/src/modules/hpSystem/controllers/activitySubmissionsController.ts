import { inject, injectable } from "inversify";
import {
  Authorized,
  Body,
  CurrentUser,
  Get,
  HttpCode,
  JsonController,
  Param,
  Post,
  QueryParam,
  QueryParams,
  UploadedFiles,
  UseBefore,
  Req,
  Put,
} from "routing-controllers";
import { OpenAPI, ResponseSchema } from "routing-controllers-openapi";
import { IUser, BadRequestErrorResponse } from "#root/shared/index.js";
import multer from "multer";

import { HP_SYSTEM_TYPES } from "../types.js";
import { ActivitySubmissionsService } from "../services/activitySubmissionsService.js";
import { CreateOrUpdateHpActivitySubmissionBodyDto, FilterQueryDto, ListSubmissionsQueryDto, ReviewHpActivitySubmissionBodyDto, StudentActivitySubmissionsResponseDto, StudentActivitySubmissionStatsResponseDto, StudentCohortWiseActivitySubmissionsStatsDto, StudentDashboardStatsQueryDto, StudentDashboardStatsResponseDto, SubmissionFeedbackBody } from "../classes/validators/activitySubmissionValidators.js";

@OpenAPI({
  tags: ["HP Activity Submissions"],
  description: "Operations for managing HP activity submissions",
})
@injectable()
@JsonController("/hp/activity-submissions")
export class ActivitySubmissionsController {
  constructor(
    @inject(HP_SYSTEM_TYPES.activitySubmissionsService)
    private readonly submissionService: ActivitySubmissionsService
  ) { }

  @OpenAPI({ summary: "Submit an activity" })
  @Post("/")
  @Authorized()
  @HttpCode(201)
  @UseBefore(multer().any())
  @ResponseSchema(BadRequestErrorResponse, { description: "Bad Request Error", statusCode: 400 })
  async submit(
    @CurrentUser() user: IUser,
    @Body({ required: true }) body: CreateOrUpdateHpActivitySubmissionBodyDto,
    @Req() req: any,
  ) {
    const allFiles = req.files as Express.Multer.File[];
    const files = allFiles?.filter(f => f.fieldname === "files");
    const images = allFiles?.filter(f => f.fieldname === "images");
    const student = {
      id: user._id.toString(),
      email: user.email,
      name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
    };

    const doc = await this.submissionService.submit(student, body, { files, images });
    return { success: true, data: doc };
  }

  @OpenAPI({ summary: "Edit an activity submission" })
  @Put("/:submissionId")
  @Authorized()
  @HttpCode(200)
  @UseBefore(multer().any())
  @ResponseSchema(BadRequestErrorResponse, { description: "Bad Request Error", statusCode: 400 })
  async updateSubmission(
    @CurrentUser() user: IUser,
    @Param("submissionId") submissionId: string,
    @Body({ required: true }) body: CreateOrUpdateHpActivitySubmissionBodyDto,
    @Req() req: any,
  ) {
    const allFiles = req.files as Express.Multer.File[];
    const files = allFiles?.filter(f => f.fieldname === "files");
    const images = allFiles?.filter(f => f.fieldname === "images");

    const student = {
      id: user._id.toString(),
      email: user.email,
      name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
    };

    const doc = await this.submissionService.updateSubmission(submissionId, student, body, { files, images });

    return { success: true, data: doc };
  }

  @OpenAPI({ summary: "Get submission by id" })
  @Get("/:id")
  @Authorized()
  @HttpCode(200)
  async getById(@Param("id") id: string) {
    const doc = await this.submissionService.getById(id);
    return { success: true, data: doc };
  }

  @OpenAPI({ summary: "Get currently logged in student's submissions" })
  @Get("/student/my-submissions")
  @Authorized()
  @HttpCode(200)
  async getMySubmissions(
    @CurrentUser() user: IUser,
    @QueryParams() query: FilterQueryDto,
    @QueryParam("cohort") cohort?: string
  ): Promise<any> {
    const studentId = user._id.toString();
    const doc = await this.submissionService.listMySubmissions(studentId, query, cohort);
    return { success: true, data: doc.data };
  }

  @OpenAPI({ summary: "Get student dashboard stats with timeline filter" })
  @Get("/student/dashboard-stats")
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(StudentDashboardStatsResponseDto)
  async getStudentDashboardStats(
    @CurrentUser() user: IUser,
    @QueryParams() query: StudentDashboardStatsQueryDto,
  ): Promise<StudentDashboardStatsResponseDto> {
    const studentId = user._id.toString();
    const { cohortName, courseVersionId, timelineDays = 7 } = query;
    
    const data = await this.submissionService.getStudentDashboardStats(
      studentId,
      cohortName,
      courseVersionId,
      timelineDays
    );
    
    return { success: true, data };
  }

  @OpenAPI({ summary: "List submissions (teacher/admin)" })
  @Get("/")
  @Authorized()
  @HttpCode(200)
  async list(@QueryParams() query: ListSubmissionsQueryDto) {
    const doc = await this.submissionService.list(query);
    return { success: true, data: doc };
  }

  @OpenAPI({ summary: "List student wise submissions" })
  @Get("/student/:studentId/cohort/:cohortId")
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(StudentActivitySubmissionsResponseDto)
  async listStudentCohortWiseSubmssions(
    @CurrentUser() user: IUser,
    @Param("studentId") studentId: string,
    @Param("cohortId") cohortId: string,
    @QueryParams() query: FilterQueryDto,
  ): Promise<StudentActivitySubmissionsResponseDto> {
    const teacherId = user._id.toString();
    return await this.submissionService.listStudentCohortWiseSubmssions(teacherId, studentId, query, cohortId);
  }

  @OpenAPI({ summary: "List student wise submissions stats" })
  @Get("/stats/student/:studentId/cohort/:cohortId")
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(StudentActivitySubmissionStatsResponseDto)
  async listStatsByStudentId(
    @CurrentUser() user: IUser,
    @Param("studentId") studentId: string,
    @Param("cohortId") cohortId: string,
  ): Promise<StudentActivitySubmissionStatsResponseDto> {
    const teacherId = user._id.toString();
    return await this.submissionService.listStudentWiseSubmissionsStats(studentId, cohortId);
  }

  @OpenAPI({ summary: "Review submission (approve/reject/revert)" })
  @Post("/:id/review")
  @Authorized()
  @HttpCode(200)
  async review(
    @Param("id") id: string,
    @CurrentUser() user: IUser,
    @Body({ required: true }) body: ReviewHpActivitySubmissionBodyDto
  ) {
    const teacherId = user._id.toString();
    const doc = await this.submissionService.review(id, teacherId, body);
    return { success: true, data: doc };
  }

  @OpenAPI({ summary: "Review submission (approve/reject/revert)" })
  @Post("/:id/feedback")
  @Authorized()
  @HttpCode(200)
  async addfeedback(
    @Param("id") id: string,
    @CurrentUser() user: IUser,
    @Body() body: SubmissionFeedbackBody
  ) {
    const teacherId = user._id.toString();
    const { feedback } = body;
    const result = await this.submissionService.addfeedback(id, teacherId, feedback);
    return { success: true, data: result };
  }

  @OpenAPI({ summary: "Restore a reverted submission" })
  @Post("/:id/restore")
  @Authorized()
  @HttpCode(200)
  async restore(
      @Param("id") id: string,
      @CurrentUser() user: IUser,
  ) {
      const teacherId = user._id.toString();
      const doc = await this.submissionService.restore(id, teacherId);
      return { success: true, data: doc };
  }

  @OpenAPI({ summary: "get submission stats of a activity for a cohort" })
  @Get("/stats/cohort/:cohortId/activity/:activityId")
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(StudentCohortWiseActivitySubmissionsStatsDto)
  async getCohortActivityStats(
    @CurrentUser() user: IUser,
    @Param("cohortId") cohortId: string,
    @Param("activityId") activityId: string,
  ): Promise<StudentCohortWiseActivitySubmissionsStatsDto> {
    return await this.submissionService.getCohortActivityStats(cohortId, activityId);
  }

  @OpenAPI( { summary: "get bulk stats of activity submissions for a cohort" })
  @Get("/stats/cohort/:cohortId/courseversion/:courseVersionId")
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(StudentActivitySubmissionStatsResponseDto)
  async getBulkCohortActivityStats(
    @CurrentUser() user: IUser,
    @Param("cohortId") cohortId: string,
    @Param("courseVersionId") courseVersionId: string,
  ): Promise<StudentActivitySubmissionStatsResponseDto> {
    const data =  await this.submissionService.getBulkCohortActivityStats(cohortId, courseVersionId);
    return { success: true, data };
  }

}