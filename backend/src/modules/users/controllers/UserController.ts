import {User} from '#auth/classes/transformers/User.js';
import {UserService} from '#users/services/UserService.js';
import {USERS_TYPES} from '#users/types.js';
import {injectable, inject} from 'inversify';
import {
  JsonController,
  Get,
  HttpCode,
  Param,
  Params,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import { UserByFirebaseUIDParams, UserByFirebaseUIDResponse, UserNotFoundErrorResponse } from '../classes/validators/UserValidators.js';

@OpenAPI({
  tags: ['Users'],
})
@JsonController('/users', {transformResponse: true})
@injectable()
export class UserController {
  constructor(
    @inject(USERS_TYPES.UserService)
    private readonly userService: UserService,
  ) {}

  @OpenAPI({
    summary: 'Get user by Firebase UID',
    description: 'Retrieves a user profile using their Firebase UID.',
  })
  @Get('/firebase/:firebaseUID')
  @HttpCode(200)
  @ResponseSchema(UserByFirebaseUIDResponse, {
    description: 'User profile retrieved successfully',
  })
  @ResponseSchema(UserNotFoundErrorResponse, {
    description: 'User not found',
    statusCode: 404,
  })
  async getUserByFirebaseUID(
    @Params() params: UserByFirebaseUIDParams,
  ): Promise<User> {
    const {firebaseUID} = params;
    const user = await this.userService.findByFirebaseUID(firebaseUID);
    return new User(user);
  }
}
