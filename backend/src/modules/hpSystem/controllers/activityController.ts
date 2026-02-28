import { inject, injectable } from "inversify";
import { JsonController } from "routing-controllers";
import { OpenAPI } from "routing-controllers-openapi";
import { HP_SYSTEM_TYPES } from "../types.js";
import { ActivityService } from "../services/activityService.js";

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


}