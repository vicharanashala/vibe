import { inject, injectable } from "inversify";
import { Authorized, Body, CurrentUser, Get, HttpCode, JsonController, Param, Patch, Post, QueryParams } from "routing-controllers";
import { OpenAPI, ResponseSchema } from "routing-controllers-openapi";
import { HP_SYSTEM_TYPES } from "../types.js";
import { ActivityService } from "../services/activityService.js";
import { CreateActivityBody, ListActivitiesQuery, UpdateActivityBody } from "../classes/validators/activityValidators.js";
import { Ability } from "#root/shared/functions/AbilityDecorator.js";
import { BadRequestErrorResponse, IUser } from "#root/shared/index.js";

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
    return this.activityService.create(teacherId, body);
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
    return this.activityService.update(id, body);
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
    return this.activityService.publish(id, teacherId);
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
    return this.activityService.archive(id);
  }

  @OpenAPI({ summary: "Get an activity by id" })
  @Get("/:id")
  @Authorized()
  @HttpCode(201)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async getById(
    @Param("id") id: string,
  ) {
    return this.activityService.getById(id);
  }

  @OpenAPI({ summary: "List activities with filters" })
  @Get("/")
  @Authorized()
  @HttpCode(201)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async list(
    @QueryParams() query: ListActivitiesQuery
  ) {
    return this.activityService.list(query);
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
    return this.activityService.delete(id, teacherId);
  }
}