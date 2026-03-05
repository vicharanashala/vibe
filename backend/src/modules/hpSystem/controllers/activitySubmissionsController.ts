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
import { CreateHpActivitySubmissionBodyDto, ListSubmissionsQueryDto, ReviewHpActivitySubmissionBodyDto } from "../classes/validators/activitySubmissionValidators.js";

@OpenAPI({
  tags: ["HP Activity Submissions"],
  description: "Operations for managing HP activity submissions",
})
@injectable()
@JsonController("/hp/activity-submissions")
export class HpActivitySubmissionController {
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
    return this.submissionService.submit(student, body, { files, images });
  }

  @OpenAPI({ summary: "Get submission by id" })
  @Get("/:id")
  @Authorized()
  @HttpCode(200)
  async getById(@Param("id") id: string) {
    return this.submissionService.getById(id);
  }

  @OpenAPI({ summary: "List submissions (teacher/admin)" })
  @Get("/")
  @Authorized()
  @HttpCode(200)
  async list(@QueryParams() query: ListSubmissionsQueryDto) {
    return this.submissionService.list(query);
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
    return this.submissionService.review(id, teacherId, body);
  }
}