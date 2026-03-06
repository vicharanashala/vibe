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
  QueryParams,
  UploadedFiles,
} from "routing-controllers";
import { OpenAPI, ResponseSchema } from "routing-controllers-openapi";
import { IUser, BadRequestErrorResponse } from "#root/shared/index.js";

import { HP_SYSTEM_TYPES } from "../types.js";
import { ActivitySubmissionsService } from "../services/activitySubmissionsService.js";
import { CreateHpActivitySubmissionBodyDto, FilterQueryDto, ListSubmissionsQueryDto, ReviewHpActivitySubmissionBodyDto, StudentActivitySubmissionsResponseDto } from "../classes/validators/activitySubmissionValidators.js";

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
  @ResponseSchema(BadRequestErrorResponse, { description: "Bad Request Error", statusCode: 400 })
  async submit(
    @CurrentUser() user: IUser,
    @Body({ required: true }) body: CreateHpActivitySubmissionBodyDto,
    @UploadedFiles("files", { required: false }) files?: Express.Multer.File[],
    @UploadedFiles("images", { required: false }) images?: Express.Multer.File[],
  ) {
    const student = {
      id: user._id.toString(),
      email: user.email,
      name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
    };
    console.log("Received submission from student:", student, "with body:", body, "and files:", files, "and images:", images);
    const doc = await this.submissionService.submit(student, body, { files, images });
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

  @OpenAPI({ summary: "List submissions (teacher/admin)" })
  @Get("/")
  @Authorized()
  @HttpCode(200)
  async list(@QueryParams() query: ListSubmissionsQueryDto) {
    const doc = await this.submissionService.list(query);
    return { success: true, data: doc };
  }

  @OpenAPI({ summary: "List student wise submissions" })
  @Post("/student/:studentId")
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(StudentActivitySubmissionsResponseDto)
  async listByStudentId(
    @CurrentUser() user: IUser,
    @Param("studentId") studentId: string,
    @QueryParams() query: FilterQueryDto,
    @Body({ required: true }) body: ReviewHpActivitySubmissionBodyDto
  ): Promise<any> {
    const teacherId = user._id.toString();
    const doc = await this.submissionService.listStudentWiseSubmssions(teacherId, studentId, body, query);
    return { success: true, data: doc };
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
}