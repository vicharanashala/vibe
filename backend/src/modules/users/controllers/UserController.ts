import 'reflect-metadata';
import {
  JsonController,
  Get,
  Param,
  NotFoundError,
  HttpCode,
} from 'routing-controllers';
import {Inject, Service} from 'typedi';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {
  UserByFirebaseUIDParams,
  UserByFirebaseUIDResponse,
  UserNotFoundErrorResponse,
} from '../classes/validators/UserValidators';
import {IUserRepository} from 'shared/database/interfaces/IUserRepository';
import {BadRequestErrorResponse} from 'shared/middleware/errorHandler';

/**
 * Controller for managing user-related operations.
 *
 * @category Users/Controllers
 */
@OpenAPI({
  tags: ['Users'],
})
@JsonController('/users', {transformResponse: true})
@Service()
export class UserController {
  constructor(@Inject('UserRepo') private userRepository: IUserRepository) {}

  /**
   * Finds a user ID by Firebase UID.
   */
  @Get('/firebase/:firebaseUID')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Get User by Firebase UID',
    description: 'Retrieves a user ID using their Firebase UID.',
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

      if (!user) {
        throw new NotFoundError(
          'User not found with the provided Firebase UID',
        );
      }

      return {
        id: user.id!,
        firebaseUID: user.firebaseUID,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error('An unexpected error occurred while fetching the user.');
    }
  }
}
