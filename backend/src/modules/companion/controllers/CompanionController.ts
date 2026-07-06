import {ICompanion} from '../classes/interfaces.js';
import {CompanionService} from '../services/CompanionService.js';
import {COMPANION_TYPES} from '../types.js';
import {SelectAnimalBody} from '../classes/validators/CompanionValidators.js';
import {
  JsonController,
  Get,
  Post,
  Body,
  CurrentUser,
} from 'routing-controllers';
import {injectable, inject} from 'inversify';
import {OpenAPI} from 'routing-controllers-openapi';
import {IUser} from '#shared/interfaces/models.js';

@injectable()
@JsonController('/companion')
class CompanionController {
  constructor(
    @inject(COMPANION_TYPES.CompanionService)
    private companionService: CompanionService,
  ) {}

  @Get('/me')
  @OpenAPI({summary: 'Get current companion state + live data'})
  async getCompanion(
    @CurrentUser({required: true}) user: IUser,
  ): Promise<ICompanion | null> {
    return this.companionService.getCompanionState(this._userId(user));
  }

  @Post('/me')
  @OpenAPI({summary: 'Select or change companion animal'})
  async selectAnimal(
    @CurrentUser({required: true}) user: IUser,
    @Body() body: SelectAnimalBody,
  ): Promise<ICompanion> {
    return this.companionService.selectAnimal(this._userId(user), body.animal);
  }

  private _userId(user: IUser | string): string {
    if (typeof user === 'string') return user;
    return user._id ? String(user._id) : '';
  }
}

export {CompanionController};