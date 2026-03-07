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
  UseBefore,
  Req,
} from "routing-controllers";
import { OpenAPI, ResponseSchema } from "routing-controllers-openapi";
import { IUser, BadRequestErrorResponse } from "#root/shared/index.js";
import multer from "multer";

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
  @UseBefore(multer().any())
  @ResponseSchema(BadRequestErrorResponse, { description: "Bad Request Error", statusCode: 400 })
  async submit(
    @CurrentUser() user: IUser,
    @Body({ required: true }) body: CreateHpActivitySubmissionBodyDto,
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
    @QueryParams() query: FilterQueryDto
  ): Promise<any> {
    const studentId = user._id.toString();
    // Using the same repository method the teacher uses but bypassing the teacher check/body
    const doc = await this.submissionService.listMySubmissions(studentId, query);
    return { success: true, data: doc.data };
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