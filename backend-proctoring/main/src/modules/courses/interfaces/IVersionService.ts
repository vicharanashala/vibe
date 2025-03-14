import { ICourseVersion } from "shared/interfaces/IUser";
import { DTOCourseVersionPayload } from "../dtos/DTOCoursePayload";


export interface IVersionService {
    // get(couseId: string, versionId: string): Promise<ICourseVersion | null>;
    create(courseId: string, payload: DTOCourseVersionPayload): Promise<ICourseVersion | null>;
    update(courseId: string, versionId: string, payload: Partial<DTOCourseVersionPayload>): Promise<ICourseVersion | null>;
}