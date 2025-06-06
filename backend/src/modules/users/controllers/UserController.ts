import 'reflect-metadata';
import {
  JsonController,
  Get,
  Param,
  NotFoundError,
  HttpCode,
} from 'routing-controllers';
import {inject, injectable} from 'inversify';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {
  UserByFirebaseUIDParams,
  UserByFirebaseUIDResponse,
  UserNotFoundErrorResponse,
} from '../classes/validators/UserValidators';
import {IUserRepository} from 'shared/database/interfaces/IUserRepository';
import {BadRequestErrorResponse} from 'shared/middleware/errorHandler';
import TYPES from '../types';

/**
 * Controller for managing user-related operations.
 *
 * @category Users/Controllers
 */
@OpenAPI({
  tags: ['Users'],
})
@JsonController('/users', {transformResponse: true})
@injectable()
export class UserController {
  constructor(
    @inject(TYPES.UserRepo) private userRepository: IUserRepository,
  ) {}

  /**
   * Finds a user by Firebase UID.
   */
  @Get('/firebase/:firebaseUID')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Get User by Firebase UID',
    description: 'Retrieves a user using their Firebase UID.',
  })
  @ResponseSchema(UserByFirebaseUIDResponse, {
    description: 'User found successfully',
  })
  @ResponseSchema(UserNotFoundErrorResponse, {
    description: 'User not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async getUserByFirebaseUID(
    @Param('firebaseUID') firebaseUID: string,
  ): Promise<UserByFirebaseUIDResponse> {
    try {
      const user = await this.userRepository.findByFirebaseUID(firebaseUID);

      return {
        id: user._id!.toString(),
        firebaseUID: user.firebaseUID,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error('An unexpected error occurred while fetching the user.');
    }
  }
}
