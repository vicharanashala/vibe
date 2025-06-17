import {User} from '#auth/classes/transformers/User.js';
import {UserService} from '#users/services/UserService.js';
import {USERS_TYPES} from '#users/types.js';
import {injectable, inject} from 'inversify';
import {
  JsonController,
  Get,
  HttpCode,
  Param,
} from 'routing-controllers';

@JsonController('/users', {transformResponse: true})
@injectable()
export class UserController {
  constructor(
    @inject(USERS_TYPES.UserService)
    private readonly userService: UserService,
  ) {}

  @Get('/firebase/:firebaseUID')
  @HttpCode(200)
  async getUserByFirebaseUID(
    @Param('firebaseUID') firebaseUID: string,
  ): Promise<User> {
    const user = await this.userService.findByFirebaseUID(firebaseUID);
    return new User(user);
  }
}
