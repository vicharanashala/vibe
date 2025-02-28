import { Prisma, ProgressEnum } from "@prisma/client";
import prisma from "../config/prisma";
import { CourseProgressRepository } from "../repositories/CourseProgressRepository";

interface UpdatedEntities {
  course: string | null;
  modules: string[] | null;
  sections: string[] | null;
  sectionItems: string[] | null;
}

interface SectionItem {
  sectionItemId: string;
  sequence: number;
}

interface Section {
  sectionId: string;
  sequence: number;
  sectionItems: SectionItem[];
}

interface Module {
  moduleId: string;
  sequence: number;
  sections: Section[];
}

interface CourseProgressData {
  courseInstanceId: string;
  studentIds: string[];
  modules: Module[];
}

interface SeperatedIds {
  modules: string[];
  sections: string[];
  sectionItems: string[];
  firstModule: string | null;
  firstSection: string | null;
  firstSectionItem: string | null;
}

interface NextData {
  moduleNextData: Prisma.ModuleNextCreateManyInput[];
  sectionNextData: Prisma.SectionNextCreateManyInput[];
  sectionItemNextData: Prisma.SectionItemNextCreateManyInput[];
}

function extractAllIds(courseProgressData: CourseProgressData): SeperatedIds {
  // 1) Make a shallow copy of modules array
  const sortedModules = [...courseProgressData.modules];

  // 2) Sort modules by sequence
  sortedModules.sort((a, b) => a.sequence - b.sequence);

  // 3) Sort sections and section items within each module by their sequence
  for (const mod of sortedModules) {
    mod.sections.sort((a, b) => a.sequence - b.sequence);

    for (const sec of mod.sections) {
      sec.sectionItems.sort((a, b) => a.sequence - b.sequence);
    }
  }

  // 4) Extract the IDs from the sorted structures
  const modules = sortedModules.map((module) => module.moduleId);

  const sections = sortedModules.flatMap((module) =>
    module.sections.map((section) => section.sectionId)
  );

  const sectionItems = sortedModules.flatMap((module) =>
    module.sections.flatMap((section) =>
      section.sectionItems.map((sectionItem) => sectionItem.sectionItemId)
    )
  );

  // 5) Identify the "first" module, section, sectionItem by sequence === 1
  //    (We use the same logic you already have, but on the sorted structure)
  const firstModule = sortedModules.find((module) => module.sequence === 1);
  console.log("I am first Moduledshvdnvnsvnlsd", firstModule);

  if (!firstModule) {
    // If no first module exists, return empty arrays and nulls
    return {
      modules,
      sections,
      sectionItems,
      firstModule: null,
      firstSection: null,
      firstSectionItem: null,
    };
  }

  // Find the first section in that module
  const firstSection =
    firstModule.sections.find((section) => section.sequence === 1) || null;

  // Find the first section item in that section
  const firstSectionItem =
    firstSection?.sectionItems.find((item) => item.sequence === 1)
      ?.sectionItemId || null;

  return {
    modules,
    sections,
    sectionItems,
    firstModule: firstModule.moduleId,
    firstSection: firstSection?.sectionId || null,
    firstSectionItem,
  };
}

function getNextData(courseData: CourseProgressData): NextData {
  // Get modules in order and build next-pair data with courseInstanceId
  const moduleNextData = courseData.modules.map((module, index) => ({
    moduleId: module.moduleId,
    nextModuleId: courseData.modules[index + 1]?.moduleId || null,
    courseInstanceId: courseData.courseInstanceId,
    sectionId:
      module.sections.find((section) => section.sequence === 1)?.sectionId ||
      null,
  })) as Prisma.ModuleNextCreateManyInput[];

  // Get sections in order and build next-pair data with moduleId and sectionId
  const sectionNextData = courseData.modules.flatMap((module) =>
    module.sections.map((section, index) => ({
      sectionId: section.sectionId,
      nextSectionId: module.sections[index + 1]?.sectionId || null,
      moduleId: module.moduleId,
      sectionItemId:
        section.sectionItems.find((item) => item.sequence === 1)
          ?.sectionItemId || null,
    }))
  ) as Prisma.SectionNextCreateManyInput[];

  // Get sectionItems in order and build next-pair data with sectionId
  const sectionItemNextData = courseData.modules.flatMap((module) =>
    module.sections.flatMap((section) =>
      section.sectionItems.map((item, index) => ({
        sectionItemId: item.sectionItemId,
        nextSectionItemId:
          section.sectionItems[index + 1]?.sectionItemId || null,
        sectionId: section.sectionId,
      }))
    )
  ) as Prisma.SectionItemNextCreateManyInput[];

  return {
    moduleNextData,
    sectionNextData,
    sectionItemNextData,
  };
}

function updateEntityListFields(
  updatedEntities: UpdatedEntities,
  updates: Partial<UpdatedEntities>
): UpdatedEntities {
  return {
    ...updatedEntities,
    modules: updates.modules
      ? [...(updatedEntities.modules || []), ...updates.modules]
      : updatedEntities.modules,
    sections: updates.sections
      ? [...(updatedEntities.sections || []), ...updates.sections]
      : updatedEntities.sections,
    sectionItems: updates.sectionItems
      ? [...(updatedEntities.sectionItems || []), ...updates.sectionItems]
      : updatedEntities.sectionItems,
  };
}

const courseProgressRepo = new CourseProgressRepository();

export class CourseProgressService {
  /**
   * Updates the progress of a section item for a student in a course instance.
   *
   * - Marks the current section item as COMPLETE.
   * - If `cascade` is true:
   *   - Retrieves the next section item and marks it as IN_PROGRESS if available.
   *   - If no next section item exists, marks the section as COMPLETE.
   *
   * @param courseInstanceId - Unique ID of the course instance.
   * @param studentId - Unique ID of the student.
   * @param sectionItemId - Unique ID of the section item being updated.
   * @param cascade - Whether to cascade progress updates to subsequent entities (default: true).
   * @returns A promise containing the updated entities.
   * @throws Error if the progress update fails.
   */
  public async updateSectionItemProgress(
    courseInstanceId: string,
    studentId: string,
    sectionItemIds: string[], // Changed to accept an array of IDs
    cascade: boolean = true
  ): Promise<UpdatedEntities[]> {
    // Now returns an array of updates
    const updates: UpdatedEntities[] = [];
    for (const sectionItemId of sectionItemIds) {
      try {
        const previousSectionItem = await prisma.sectionItemNext.findFirst({
          where: { nextSectionItemId: sectionItemId },
          select: { sectionItemId: true },
        });

        if (previousSectionItem) {
          const previousItemProgress =
            await prisma.studentSectionItemProgress.findUnique({
              where: {
                studentId_sectionItemId_courseInstanceId: {
                  studentId,
                  sectionItemId: previousSectionItem.sectionItemId,
                  courseInstanceId,
                },
              },
              select: { progress: true },
            });

          if (
            previousItemProgress &&
            previousItemProgress.progress !== ProgressEnum.COMPLETE
          ) {
            throw new Error(
              `Cannot update progress for sectionItemId ${sectionItemId} because the previous item (${previousSectionItem.sectionItemId}) is not complete.`
            );
          }
        }

        await courseProgressRepo.updateSectionItemProgress(
          courseInstanceId,
          studentId,
          [sectionItemId]
        );

        if (cascade) {
          const sectionItemDetails =
            await courseProgressRepo.getSectionItemDetails(
              courseInstanceId,
              studentId,
              sectionItemId
            );

          if (!sectionItemDetails) {
            throw new Error(
              `Section item details not found for sectionItemId ${sectionItemId}`
            );
          }

          const { nextSectionItemId, sectionId } = sectionItemDetails;
          if (nextSectionItemId) {
            await courseProgressRepo.updateSectionItemProgress(
              courseInstanceId,
              studentId,
              [nextSectionItemId]
            );
            updates.push({
              course: null,
              modules: null,
              sections: null,
              sectionItems: [sectionItemId, nextSectionItemId],
            });
          } else {
            const updatedEntities = await this.updateSectionProgress(
              courseInstanceId,
              studentId,
              sectionId,
              cascade
            );

            updates.push(
              updateEntityListFields(updatedEntities, {
                sectionItems: [sectionItemId],
              })
            );
          }
        } else {
          updates.push({
            course: null,
            modules: null,
            sections: null,
            sectionItems: [sectionItemId],
          });
        }
      } catch (error) {
        console.error(
          `Error updating section item progress for section item ${sectionItemId}:`,
          error
        );
        throw error;
      }
    }
    return updates;
  }

  /**
   * Updates the progress of a section for a student in a course instance.
   *
   * - Marks the current section as COMPLETE.
   * - If `cascade` is true:
   *   - Retrieves the next section and marks it as IN_PROGRESS if available.
   *    - Retrieves the first section item of the next section and marks it as IN_PROGRESS.
   *   - If no next section exists, marks the module as COMPLETE.
   *
   * @param courseInstanceId - Unique ID of the course instance.
   * @param studentId - Unique ID of the student.
   * @param sectionId - Unique ID of the section being updated.
   * @param cascade - Whether to cascade progress updates to subsequent entities (default: true).
   * @returns A promise containing the updated entities.
   * @throws Error if the progress update fails.
   */
  private async updateSectionProgress(
    courseInstanceId: string,
    studentId: string,
    sectionId: string,
    cascade: boolean = true
  ): Promise<UpdatedEntities> {
    try {
      // Mark the current section as COMPLETE
      await courseProgressRepo.updateSectionProgress(
        courseInstanceId,
        studentId,
        sectionId
      );

      const sectionDetails = await courseProgressRepo.getSectionDetails(
        courseInstanceId,
        studentId,
        sectionId
      );

      if (!sectionDetails) {
        throw new Error(`Section details not found for sectionId ${sectionId}`);
      }

      const { nextSectionId, moduleId } = sectionDetails;

      if (cascade) {
        if (nextSectionId) {
          // Mark the next section as IN_PROGRESS
          await courseProgressRepo.updateSectionProgress(
            courseInstanceId,
            studentId,
            nextSectionId
          );

          // Get the first section item of the next section
          const nextSectionDetails = await courseProgressRepo.getSectionDetails(
            courseInstanceId,
            studentId,
            nextSectionId
          );

          if (nextSectionDetails) {
            const { sectionItemId: nextSectionFirstSectionItemId } =
              nextSectionDetails;

            // Mark the first section item of the next section as IN_PROGRESS
            await courseProgressRepo.updateSectionItemProgress(
              courseInstanceId,
              studentId,
              [nextSectionFirstSectionItemId]
            );

            return {
              course: null,
              modules: null,
              sections: [sectionId, nextSectionId],
              sectionItems: [nextSectionFirstSectionItemId],
            };
          } else {
            throw new Error(
              `Section details not found for sectionId ${nextSectionId}`
            );
          }
        } else {
          // If no more sections, mark the module as COMPLETE
          const updatedEntities = await this.updateModuleProgress(
            courseInstanceId,
            studentId,
            moduleId,
            cascade
          );
          return {
            ...updatedEntities,
            sections: [sectionId],
          };
        }
      }

      return {
        course: null,
        modules: null,
        sections: [sectionId],
        sectionItems: null,
      };
    } catch (error) {
      console.error(
        `Error updating section progress for section ${sectionId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Updates the progress of a module for a student in a course instance.
   *
   * - Marks the current module as COMPLETE.
   * - If `cascade` is true:
   *   - Retrieves the next module and marks it as IN_PROGRESS if available.
   * - If next module exists:
   *   - Retrieves the first section of the next module and marks it as IN_PROGRESS.
   *   - Retrieves the first section item of the next section and marks it as IN_PROGRESS.
   *   - If no next module exists, marks the course as COMPLETE.
   *
   * @param courseInstanceId - Unique ID of the course instance.
   * @param studentId - Unique ID of the student.
   * @param moduleId - Unique ID of the module being updated.
   * @param cascade - Whether to cascade progress updates to subsequent entities (default: true).
   * @returns A promise containing the updated entities.
   * @throws Error if the progress update fails.
   */

  private async updateModuleProgress(
    courseInstanceId: string,
    studentId: string,
    moduleId: string,
    cascade: boolean = true
  ): Promise<UpdatedEntities> {
    try {
      // Mark the current module as COMPLETE
      await courseProgressRepo.updateModuleProgress(
        courseInstanceId,
        studentId,
        moduleId
      );

      const moduleDetails = await courseProgressRepo.getModuleDetails(
        courseInstanceId,
        studentId,
        moduleId
      );

      if (!moduleDetails) {
        throw new Error(`Module details not found for moduleId ${moduleId}`);
      }

      const { nextModuleId } = moduleDetails;

      if (cascade) {
        if (nextModuleId) {
          // Mark the next module as IN_PROGRESS
          await courseProgressRepo.updateModuleProgress(
            courseInstanceId,
            studentId,
            nextModuleId
          );

          // Get the first section of the next module
          const nextModuleDetails = await courseProgressRepo.getModuleDetails(
            courseInstanceId,
            studentId,
            nextModuleId
          );

          if (!nextModuleDetails) {
            throw new Error(
              `Module details not found for moduleId ${nextModuleId}`
            );
          }

          const { sectionId: nextModuleFirstSectionId } = nextModuleDetails;

          // Mark the first section of the next module as IN_PROGRESS
          await courseProgressRepo.updateSectionProgress(
            courseInstanceId,
            studentId,
            nextModuleFirstSectionId
          );

          // Get the first section item of the next section of next module
          const nextSectionDetails = await courseProgressRepo.getSectionDetails(
            courseInstanceId,
            studentId,
            nextModuleFirstSectionId
          );

          if (!nextSectionDetails) {
            throw new Error(
              `Section details not found for sectionId ${nextModuleFirstSectionId}`
            );
          }

          const { sectionItemId: nextModuleFirstSectionItemId } =
            nextSectionDetails;

          //Mark the first section item of the next module as IN_PROGRESS
          await courseProgressRepo.updateSectionItemProgress(
            courseInstanceId,
            studentId,
            [nextModuleFirstSectionItemId]
          );

          return {
            course: null,
            modules: [moduleId, nextModuleId],
            sections: [nextModuleFirstSectionId],
            sectionItems: [nextModuleFirstSectionItemId],
          };
        } else {
          // If no more modules, mark the course as COMPLETE
          const updatedEntities = await this.updateCourseProgress(
            courseInstanceId,
            studentId
          );

          return updateEntityListFields(updatedEntities, {
            modules: [moduleId],
          });
        }
      }

      return {
        course: null,
        modules: [moduleId],
        sections: null,
        sectionItems: null,
      };
    } catch (error) {
      console.error(
        `Error updating module progress for module ${moduleId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Updates the progress of a course for a student.
   *
   * - Marks the course as COMPLETE.
   * - No cascading as this is the final entity in the hierarchy.
   *
   * @param courseInstanceId - Unique ID of the course instance.
   * @param studentId - Unique ID of the student.
   * @returns A promise containing the updated course entity.
   * @throws Error if the progress update fails.
   */

  private async updateCourseProgress(
    courseInstanceId: string,
    studentId: string
  ): Promise<UpdatedEntities> {
    try {
      // Mark the course as COMPLETE
      await courseProgressRepo.updateCourseProgress(
        courseInstanceId,
        studentId
      );
      return {
        course: courseInstanceId,
        modules: null,
        sections: null,
        sectionItems: null,
      };
    } catch (error) {
      console.error(
        `Error updating course progress for course ${courseInstanceId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Initializes progress records for all students in a given course instance.
   *
   * This method performs the following tasks:
   * - Creates progress records for the course, modules, sections, and section items for each student.
   * - Sets the first module, first section, and first section item as `IN_PROGRESS`.
   * - Sets all other modules, sections, and section items as `INCOMPLETE`.
   * - Ensures all operations are performed in a database transaction to maintain atomicity.
   *
   * @param courseData - Object containing the course progress data.
   * @param courseData.courseInstanceId - The unique ID of the course instance.
   * @param courseData.studentIds - Array of student IDs for whom progress needs to be initialized.
   * @param courseData.modules - Array of modules containing sections and section items.
   *
   * @returns Promise<{ studentCount: number; totalRecords: number }>
   * - `studentCount`: Total number of students for whom progress was initialized.
   * - `totalRecords`: Total number of records created across all progress tables.
   *
   * @throws Error
   * - If any operation within the transaction fails, the method will throw an error and rollback all changes.
   */
  public async initializeStudentProgress(
    courseData: CourseProgressData
  ): Promise<{ studentCount: number; totalRecords: number }> {
    const { courseInstanceId, studentIds, modules } = courseData;

    let totalRecords = 0;
    const progressRecords = [];

    // Extract all IDs from the course progress data
    const { modules: moduleIds } = extractAllIds(courseData);

    // Create progress records for each student
    for (const studentId of studentIds) {
      let previousModuleComplete = true; // Assume the first module has no predecessor
      let moduleData = [];
      let sectionData = [];
      let sectionItemData = [];

      for (const module of modules) {
        const moduleProgress = previousModuleComplete
          ? ProgressEnum.IN_PROGRESS
          : ProgressEnum.INCOMPLETE;
        moduleData.push({
          courseInstanceId,
          studentId,
          moduleId: module.moduleId,
          progress: moduleProgress,
        });

        // Determine the progress for the first section and section item if the module is 'IN_PROGRESS'
        let firstSectionInitialized = false;
        for (const section of module.sections) {
          const sectionProgress =
            moduleProgress === ProgressEnum.IN_PROGRESS &&
            !firstSectionInitialized
              ? ProgressEnum.IN_PROGRESS
              : ProgressEnum.INCOMPLETE;
          sectionData.push({
            courseInstanceId,
            studentId,
            sectionId: section.sectionId,
            progress: sectionProgress,
          });

          let firstItemInitialized = false;
          for (const item of section.sectionItems) {
            const itemProgress =
              sectionProgress === ProgressEnum.IN_PROGRESS &&
              !firstItemInitialized
                ? ProgressEnum.IN_PROGRESS
                : ProgressEnum.INCOMPLETE;
            sectionItemData.push({
              courseInstanceId,
              studentId,
              sectionItemId: item.sectionItemId,
              progress: itemProgress,
            });

            if (!firstItemInitialized) firstItemInitialized = true;
          }

          if (!firstSectionInitialized) firstSectionInitialized = true;
        }

        // Check if the current module is complete to update the flag for the next module
        const currentModuleProgress =
          await prisma.studentModuleProgress.findUnique({
            where: {
              studentId_moduleId_courseInstanceId: {
                studentId,
                moduleId: module.moduleId,
                courseInstanceId,
              },
            },
            select: { progress: true },
          });

        if (
          currentModuleProgress &&
          currentModuleProgress.progress === ProgressEnum.COMPLETE
        ) {
          previousModuleComplete = true;
        } else {
          previousModuleComplete = false;
        }
      }

      // Add all prepared data to the progress records
      progressRecords.push(
        prisma.studentModuleProgress.createMany({
          data: moduleData,
          skipDuplicates: true,
        }),
        prisma.studentSectionProgress.createMany({
          data: sectionData,
          skipDuplicates: true,
        }),
        prisma.studentSectionItemProgress.createMany({
          data: sectionItemData,
          skipDuplicates: true,
        })
      );

      // Increment total records count
      totalRecords +=
        moduleData.length + sectionData.length + sectionItemData.length;
    }

    // Execute all progress record updates in a transaction
    try {
      await prisma.$transaction(progressRecords);
      return { studentCount: studentIds.length, totalRecords };
    } catch (error) {
      console.error("Error initializing student progress:", error);
      throw new Error("Failed to initialize student progress");
    }
  }

  /**
   * Retrieves the progress data for a specific student within a course instance.
   *
   * This function fetches the current progress status of `courseInstance` only.
   *
   * @param courseInstanceId - The unique identifier for the course instance.
   * @param studentId - The unique identifier for the student whose progress is being fetched.
   * @param moduleId - The unique identifier for the module within the course.
   * @returns A promise that resolves with the student's progress data for the given module in the specified course instance.
   */
  public async getCourseProgress(courseInstanceId: string, studentId: string) {
    const courseProgress = await courseProgressRepo.getCourseProgress(
      courseInstanceId,
      studentId
    );

    return courseProgress;
  }

  /**
   * Retrieves the progress data for a specific student within a module of a given course instance.
   *
   * This function fetches the current progress status of the given `moduleId` only.
   *
   * @param courseInstanceId - The unique identifier for the course instance.
   * @param studentId - The unique identifier for the student whose progress is being fetched.
   * @param moduleId - The unique identifier for the module within the course.
   * @returns A promise that resolves with the student's progress data for the given module in the specified course instance.
   */
  public async getModuleProgress(
    courseInstanceId: string,
    studentId: string,
    moduleId: string
  ) {
    const moduleProgress = await courseProgressRepo.getModuleProgress(
      courseInstanceId,
      studentId,
      moduleId
    );

    return moduleProgress;
  }

  /**
   * Retrieves the progress data for a specific student within a section of a given course instance.
   *
   * This function fetches the current progress status of the given `sectionId` only.
   *
   * @param courseInstanceId The unique identifier for the course instance.
   * @param studentId The unique identifier for the student whose progress is being fetched.
   * @param sectionId The unique identifier for the section within the course.
   * @returns A promise that resolves with the student's progress data for the given section in the specified course instance.
   */
  public async getSectionProgress(
    courseInstanceId: string,
    studentId: string,
    sectionId: string
  ) {
    const sectionProgress = await courseProgressRepo.getSectionProgress(
      courseInstanceId,
      studentId,
      sectionId
    );

    return sectionProgress;
  }

  /**
   * Retrieves the progress data for a specific student within a section item of a given course instance.
   *
   * This function fetches the current progress status of the given `sectionItemId` only.
   *
   * @param courseInstanceId The unique identifier for the course instance.
   * @param studentId The unique identifier for the student whose progress is being fetched.
   * @param sectionItemId The unique identifier for the section item within the course.
   * @returns A promise that resolves with the student's progress data for the given section item in the specified course instance.
   */
  public async getSectionItemProgress(
    courseInstanceId: string,
    studentId: string,
    sectionItemId: string
  ) {
    console.log(
      "dcbnbdscmdsvmnbvnmfv courseInstanceId:",
      courseInstanceId,
      "studentId:",
      studentId,
      "sectionItemId:",
      sectionItemId
    );
    const sectionItemProgress = await courseProgressRepo.getSectionItemProgress(
      courseInstanceId,
      studentId,
      sectionItemId
    );
    return sectionItemProgress;
  }
}

export { SectionItem, Section, Module, CourseProgressData };
