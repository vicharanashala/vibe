import { IUserService } from "api/interfaces/UserInterface";
import User, {
  CreateUserInput,
  UpdateUserInput,
  UserModel,
} from "api/schemas/UserSchema";
import { MongoUserService } from "api/services/UserService";
import { Arg, Mutation, Query, Resolver } from "type-graphql";
import { Inject, Service } from "typedi";

@Service()
@Resolver()
export default class UserResolver {
  constructor(
    @Inject(() => MongoUserService)
    private readonly userService: IUserService
  ) {}

  @Query(() => [User], {
    description: "Get all users from the database",
  })
  async getUsers(): Promise<User[]> {
    return await UserModel.find();
  }

  @Mutation(() => User, {
    description: "Create a new user in the database",
  })
  async createUser(
    @Arg("input", {
      description: "The user data to create a new user",
    })
    input: CreateUserInput
  ): Promise<User> {
    return await this.userService.createUser(input);
  }

  @Query(() => User, {
    description: "Get a user by its ID",
  })
  async getUserById(
    @Arg("id", {
      description: "The unique identifier of the user",
    })
    id: string
  ): Promise<User | null> {
    return await this.userService.getUserById(id);
  }

  @Mutation(() => User)
  async updateUser(
    @Arg("id", {
      description: "The unique identifier of the user",
    })
    id: string,
    @Arg("input", {
      description: "The user data to update",
    })
    input: UpdateUserInput
  ): Promise<User | null> {
    return await this.userService.updateUser(id, input);
  }
}
