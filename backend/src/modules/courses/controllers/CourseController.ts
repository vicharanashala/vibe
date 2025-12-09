import {User} from '#auth/classes/transformers/User.js';
import {UserService} from '#users/services/UserService.js';
import {USERS_TYPES} from '#users/types.js';
import {injectable, inject} from 'inversify';
import {
  JsonController,
  Get,
  HttpCode,
  Params,
  OnUndefined,
  Req,
  Body,
  Post,
  Patch,
  Authorized,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
// import {EditUserBody, GetUserParams, GetUserResponse, UserNotFoundErrorResponse } from '../classes/validators/UserValidators.js';
import { AUTH_TYPES } from '#root/modules/auth/types.js';
import { IAuthService } from '#root/modules/auth/interfaces/IAuthService.js';
import { GetUserParams, UserNotFoundErrorResponse } from '#root/modules/users/classes/index.js';

@OpenAPI({
  tags: ['Courses'],
})
@JsonController('/courses', {transformResponse: true})
@injectable()
export class CourseController {
  constructor(
    @inject(USERS_TYPES.UserService)
    private readonly userService: UserService,
    
    @inject(AUTH_TYPES.AuthService)
    private readonly authService: IAuthService,
  ) {}
  @OpenAPI({
    summary: 'Make a user an admin',
    description: `Promotes a user to admin status based on the provided user ID.<br/>
    It returns an empty body with a 200 status code.`,
  })
  @Authorized()
  @Post('/create')
  @OnUndefined(200)
  @ResponseSchema(UserNotFoundErrorResponse, {
    description: 'User not found',
    statusCode: 404,
  })
  async makeAdmin(
    @Params() params: GetUserParams,
    @Body() body: { password: string }
  ): Promise<void> {
    const { userId } = params;
    await this.userService.makeAdmin(userId, body.password);
  }
}
