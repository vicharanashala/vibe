import {injectable, inject} from 'inversify';
import {HttpCode, JsonController, Post, Body} from 'routing-controllers';
import {USERS_TYPES} from '#users/types.js';
import {AnomalyService} from '#users/services/index.js';
import {CreateAnamolyBody} from '#users/classes/validators/AnamolyValidators.js';
import {AnomalyResponse} from '#users/classes/index.js';
import {Anomaly} from '#users/classes/transformers/Anamoly.js';

@JsonController('/users/anomaly')
@injectable()
export class AnamolyController {
  constructor(
    @inject(USERS_TYPES.AnamolyService)
    private readonly anamolyService: AnomalyService,
  ) {}

  @Post('/')
  @HttpCode(201)
  async createAnomaly(
    @Body() body: CreateAnamolyBody,
  ): Promise<AnomalyResponse> {
    const anomaly = new Anomaly(body);
    const createdAnomaly = await this.anamolyService.createAnomaly(anomaly);

    if (!createdAnomaly) {
      throw new Error('Failed to create anomaly');
    }

    return new AnomalyResponse(createdAnomaly);
  }
}
