import { ICourseVersion } from "shared/interfaces/IUser";
import {
  DTOCourseVersionPayload,
  DTOModulePayload,
} from "../dtos/DTOCoursePayload";

export interface IVersionService {
  // get(couseId: string, versionId: string): Promise<ICourseVersion | null>;
  create(
    courseId: string,
    payload: DTOCourseVersionPayload
  ): Promise<ICourseVersion | null>;
  update(
    courseId: string,
    versionId: string,
    payload: Partial<DTOCourseVersionPayload>
  ): Promise<ICourseVersion | null>;
  createModule(
    courseId: string,
    versionId: string,
    module: DTOModulePayload
  ): Promise<ICourseVersion | null>;
  updateModule(
    courseId: string,
    versionId: string,
    moduleId: string,
    module: Partial<DTOModulePayload>
  ): Promise<ICourseVersion | null>;
  moveModule(
    courseId: string,
    versionId: string,
    moduleId: string,
    afterModuleId?: string,
    beforeModuleId?: string
  ): Promise<ICourseVersion | null>;
  createSection(
    courseId: string,
    versionId: string,
    moduleId: string,
    section: DTOModulePayload
  ): Promise<ICourseVersion | null>;
  updateSection(
    courseId: string,
    versionId: string,
    moduleId: string,
    sectionId: string,
    section: Partial<DTOModulePayload>
  ): Promise<ICourseVersion | null>;
  moveSection(
    courseId: string,
    versionId: string,
    moduleId: string,
    sectionId: string,
    afterSectionId?: string,
    beforeSectionId?: string
  ): Promise<ICourseVersion | null>;
}
