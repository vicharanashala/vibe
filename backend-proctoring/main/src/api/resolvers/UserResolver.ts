import User from "api/schemas/UserSchema";
import { Query, Resolver } from "type-graphql";

@Resolver()
export default class UserResolver {
  @Query(() => User)
    async user() {
        return {
        _id: "1",
        name: "John Doe",
        email: "abcd@gmail.com",
        }
    }
}