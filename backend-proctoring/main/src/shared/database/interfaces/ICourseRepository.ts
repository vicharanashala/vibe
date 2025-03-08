import { ICourse } from "shared/interfaces/IUser";

export interface ICourseRepository {
    create(course: ICourse): Promise<ICourse>;
    read(id: string): Promise<ICourse | null>;
    update(id: string, course: ICourse): Promise<ICourse | null>;
    delete(id: string): Promise<boolean>;
    getAll(): Promise<ICourse[]>;
}