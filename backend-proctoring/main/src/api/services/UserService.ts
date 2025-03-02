import { UserInterface } from "api/interfaces/UserInterface";
import User, { UserModel } from "api/schemas/UserSchema";
import { Service, Inject } from "typedi";


@Service()
export class UserService implements UserInterface {
    async createUser(user: User): Promise<User> {
        return UserModel.create(user);
    }

    async getUserById(id: string): Promise<User | null> {
        return UserModel.findById(id).exec();
    }

    async updateUser(id: string, user: Partial<User>): Promise<User | null> {
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