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
  UnauthorizedError,
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
    if (user._id) return String(user._id);
    // Without _id, downstream queries would silently produce empty results
    // (e.g. upsert would target an empty userId filter). The auth middleware
    // is supposed to populate this on every request; if it didn't, fail loud.
    throw new UnauthorizedError(
      'Authenticated user is missing _id; cannot resolve companion owner.',
    );
  }
}

export {CompanionController};