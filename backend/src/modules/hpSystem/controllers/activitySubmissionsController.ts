import { inject, injectable } from "inversify";
import { JsonController } from "routing-controllers";
import { OpenAPI } from "routing-controllers-openapi";
import { HP_SYSTEM_TYPES } from "../types.js";
import { ActivitySubmissionsService } from "../services/activitySubmissionsService.js";

@OpenAPI({
  tags: ['HP Activities'],
  description: 'Operations for managing hp activity submissions',
})
@injectable()
@JsonController('/hp/activities/submissions')
export class ActivitySubmissionsController {
  constructor(
    @inject(HP_SYSTEM_TYPES.activitySubmissionsService)
    private readonly activitySubmissionsService: ActivitySubmissionsService,
  ) { }


}