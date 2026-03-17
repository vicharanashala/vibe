import { inject, injectable } from "inversify";
import { Authorized, Body, CurrentUser, Get, HttpCode, JsonController, Param, Patch, Post, QueryParams } from "routing-controllers";
import { OpenAPI, ResponseSchema } from "routing-controllers-openapi";
import { HP_SYSTEM_TYPES } from "../types.js";
import { ActivityService } from "../services/activityService.js";
import { CreateActivityBody, ListActivitiesQuery, UpdateActivityBody } from "../classes/validators/activityValidators.js";
import { Ability } from "#root/shared/functions/AbilityDecorator.js";
import { BadRequestErrorResponse, IUser } from "#root/shared/index.js";
import { instanceToPlain } from "class-transformer";

@OpenAPI({
  tags: ['HP Activities'],
  description: 'Operations for managing hp activities',
})
@injectable()
@JsonController('/hp/activities')
export class ActivityController {
  constructor(
    @inject(HP_SYSTEM_TYPES.activityService)
    private readonly activityService: ActivityService,
  ) { }

  @OpenAPI({ summary: "Create a draft HP activity" })
  @Post("/")
  @Authorized()
  @HttpCode(201)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async create(
    @Body({ required: true }) body: CreateActivityBody,
    @CurrentUser() user: IUser,

  ) {
    const teacherId = user._id.toString();
    const doc = await this.activityService.create(teacherId, body);
    return { success: true, data: instanceToPlain(doc) };
  }

  @OpenAPI({ summary: "Update an activity (DRAFT/PUBLISHED only)" })
  @Patch("/:id")
  @HttpCode(201)
  @Authorized()
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async update(
    @Param("id") id: string,
    @Body({ required: true }) body: UpdateActivityBody,
  ) {
    const doc = await this.activityService.update(id, body);
    return { success: true, data: doc };
  }

  @OpenAPI({ summary: "Publish an activity" })
  @Post("/:id/publish")
  @Authorized()
  @HttpCode(201)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async publish(
    @Param("id") id: string,
    @CurrentUser() user: IUser,
  ) {
    const teacherId = user._id.toString();
    const doc = await this.activityService.publish(id, teacherId);
    return { success: true, data: doc };
  }

  @OpenAPI({ summary: "Archive an activity" })
  @Post("/:id/archive")
  @Authorized()
  @HttpCode(201)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async archive(
    @Param("id") id: string,
  ) {
    const doc = await this.activityService.archive(id);
    return { success: true, data: doc };
  }

  @OpenAPI({ summary: "Get an activity by id" })
  @Get("/:id")
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async getById(
    @Param("id") id: string,
  ) {
    const doc = await this.activityService.getById(id);
    return { success: true, data: doc };
  }

  @OpenAPI({ summary: "List activities with filters" })
  @Get("/")
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async list(
    @CurrentUser() user:IUser,
    @QueryParams() query: ListActivitiesQuery
  ) {
    const userId = user._id.toString()
    console.log("Activity search with query:", query, "by user:", userId);
    const doc = await this.activityService.list(query, userId);
    return { success: true, data: doc };
  }


  @OpenAPI({ summary: "Delete an activity (Only DRAFT allowed)" })
  @Post("/:id/delete")
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async delete(
    @Param("id") id: string,
    @CurrentUser() user: IUser,
  ) {
    const teacherId = user._id.toString();
    const doc = await this.activityService.delete(id, teacherId);
    return { success: true, data: doc };
  }
}