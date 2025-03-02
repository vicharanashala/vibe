import { UserService } from "api/services/UserService";
import UserResolver from "./UserResolver";




export const resolvers = [
    UserResolver
] as const;