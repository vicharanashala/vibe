import { ICourse, ICourseVersion } from "shared/interfaces/IUser";

export interface ICourseRepository {
    create(course: ICourse): Promise<ICourse | null>;
    read(id: string): Promise<ICourse | null>;
    update(id: string, course: Partial<ICourse>): Promise<ICourse | null>;
    delete(id: string): Promise<boolean>;
    getAll(): Promise<ICourse[]>;
    createVersion(courseVersion: ICourseVersion): Promise<ICourseVersion | null>;
    readVersion(versionId: string): Promise<ICourseVersion | null>;
    updateVersion(versionId: string, courseVersion: ICourseVersion): Promise<ICourseVersion | null>;
}