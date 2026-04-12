import 'reflect-metadata';
import {
  JsonController,
  Post,
  HttpCode,
  Authorized,
  ForbiddenError,
} from 'routing-controllers';
import {injectable, inject} from 'inversify';
import {OpenAPI} from 'routing-controllers-openapi';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {AutoEjectionEngine} from '../services/AutoEjectionEngine.js';
import {getEjectionPolicyAbility} from '../abilities/ejectionPolicyAbilities.js';

@OpenAPI({tags: ['Auto Ejection']})
@JsonController('/ejection-engine', {transformResponse: true})
@injectable()
export class AutoEjectionController {
  constructor(
    @inject(AutoEjectionEngine)
    private readonly autoEjectionEngine: AutoEjectionEngine,
  ) {}

  @Authorized()
  @Post('/run')
  @HttpCode(200)
  @OpenAPI({summary: 'Manually trigger the auto-ejection engine. Admin only.'})
  async triggerEjectionEngine(
    @Ability(getEjectionPolicyAbility) {user},
  ): Promise<{
    policiesEvaluated: number;
    ejected: number;
    warned: number;
    errors: number;
  }> {
    if (user.roles !== 'admin') {
      throw new ForbiddenError(
        'Only administrators can trigger the ejection engine',
      );
    }
    return this.autoEjectionEngine.runEjectionCycle();
  }
}
