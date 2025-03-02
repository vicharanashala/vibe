import { UserInterface } from "api/interfaces/UserInterface";
import User from "api/schemas/UserSchema";
import { UserService } from "api/services/UserService";
import { Query, Resolver } from "type-graphql";
import { Service } from "typedi";

@Service()
@Resolver()
export default class UserResolver {

    constructor(
        private readonly userService: UserService
    ) { }

    @Query(() => User)
    async user() {
        return {
            _id: "1",
            name: "John Doe",
            email: "abcd@gmail.com",
        }
    }
}