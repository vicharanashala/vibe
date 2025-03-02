import { IUserService } from "api/interfaces/UserInterface";
import User, { CreateUserInput, UpdateUserInput, UserModel } from "api/schemas/UserSchema";
import { Service, Inject } from "typedi";


@Service()
export class MongoUserService implements IUserService {
    async createUser(user: CreateUserInput): Promise<User> {
        return UserModel.create(user);
    }

    async getUserById(id: string): Promise<User | null> {
        return UserModel.findById(id).exec();
    }

    async updateUser(id: string, user: UpdateUserInput): Promise<User | null> {
        return UserModel.findByIdAndUpdate(id, user, { new: true }).exec();
    }

    async deleteUser(id: string): Promise<boolean> {
        const result = await UserModel.deleteOne({ _id: id }).exec();
        return result.deletedCount !== 0;
    }

    async listUsers(): Promise<User[]> {
        return UserModel.find().exec();
    }


    
}