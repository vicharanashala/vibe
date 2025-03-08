import { Prisma, ProgressEnum } from "@prisma/client";
import prisma from "../config/prisma";
import e from "express";
import { stringify } from "querystring";



/**
 * Repository class for managing course progress records for students.
 * 
 * This class provides methods to create, retrieve, and update progress records
 * for courses, modules, sections, and section items. Each progress record is
 * associated with a specific course instance and student.
 */
export class CourseProgressRepository {
    /**
     * Creates an initial course progress record for a student in a course instance.
     *
     * - Marks the progress as INCOMPLETE by default.
     *
     * @param courseInstanceId - Unique ID of the course instance.
     * @param studentId - Unique ID of the student.
     * @returns A promise resolving to the created course progress record.
     */

    async createCourseProgress(courseInstanceId: string, studentId: string) {
        return prisma.studentCourseProgress.create({
            data: {
                studentId,
                courseInstanceId,
                progress: ProgressEnum.INCOMPLETE,
            },
        });
    }

    /**
     * Creates an initial module progress record for a student in a course instance.
     *
     * - Marks the progress as INCOMPLETE by default.
     *
     * @param courseInstanceId - Unique ID of the course instance.
     * @param studentId - Unique ID of the student.
     * @param moduleId - Unique ID of the module.
     * @returns A promise resolving to the created module progress record.
     */

    async createModuleProgress(
        courseInstanceId: string,
        studentId: string,
        moduleId: string
    ) {
        return prisma.studentModuleProgress.create({
            data: {
                studentId,
                courseInstanceId,
                moduleId,
                progress: ProgressEnum.INCOMPLETE,
            },
        });
    }

    /**
     * Creates an initial section progress record for a student in a course instance.
     *
     * - Marks the progress as INCOMPLETE by default.
     *
     * @param courseInstanceId - Unique ID of the course instance.
     * @param studentId - Unique ID of the student.
     * @param sectionId - Unique ID of the section.
     * @returns A promise resolving to the created section progress record.
     */

    async createSectionProgress(
        courseInstanceId: string,
        studentId: string,
        sectionId: string
    ) {
        return prisma.studentSectionProgress.create({
            data: {
                studentId,
                courseInstanceId,
                sectionId,
                progress: ProgressEnum.INCOMPLETE,
            },
        });
    }

    /**
     * Creates an initial section item progress record for a student in a course instance.
     *
     * - Marks the progress as INCOMPLETE by default.
     *
     * @param courseInstanceId - Unique ID of the course instance.
     * @param studentId - Unique ID of the student.
     * @param sectionItemId - Unique ID of the section item.
     * @returns A promise resolving to the created section item progress record.
     */

    async createSectionItemProgress(
        courseInstanceId: string,
        studentId: string,
        sectionItemId: string
    ) {
        return prisma.studentSectionItemProgress.create({
            data: {
                studentId,
                courseInstanceId,
                sectionItemId,
                progress: ProgressEnum.INCOMPLETE,
            },
        });
    }

    /**
     * Retrieves the progress of a course for a student in a specific course instance.
     *
     * @param courseInstanceId - Unique ID of the course instance.
     * @param studentId - Unique ID of the student.
     * @returns A promise resolving to the course progress record, if found.
     */


    async getCourseProgress(courseInstanceId: string, studentId: string) {
        
        return prisma.studentCourseProgress.findUnique({
            where: {
                studentId_courseInstanceId:{
                    studentId,
                    courseInstanceId
                }
            },
            select: {
                progress: true,
            },
        });
    }

    /**
     * Retrieves the progress of a module for a student in a specific course instance.
     *
     * @param courseInstanceId - Unique ID of the course instance.
     * @param studentId - Unique ID of the student.
     * @param moduleId - Unique ID of the module.
     * @returns A promise resolving to the module progress record, if found.
     */

    async getModuleProgress(
        courseInstanceId: string,
        studentId: string,
        moduleId: string
    ) {
        return prisma.studentModuleProgress.findUnique({
            where: {
                studentId_moduleId_courseInstanceId: {
                    studentId,
                    moduleId,
                    courseInstanceId,
                },
            },
            select:{
                progress:true
            }
        });
    }

    /**
     * Retrieves the progress of a section for a student in a specific course instance.
     *
     * @param courseInstanceId - Unique ID of the course instance.
     * @param studentId - Unique ID of the student.
     * @param sectionId - Unique ID of the section.
     * @returns A promise resolving to the section progress record, if found.
     */

    async getSectionProgress(
        courseInstanceId: string,
        studentId: string,
        sectionId: string
    ) {
        return prisma.studentSectionProgress.findUnique({
            where: {

                studentId_sectionId_courseInstanceId:{
                    studentId,
                    sectionId,
                    courseInstanceId
                }

            },
            select:{
                progress:true
            }
        });
    }

    /**
     * Retrieves the progress of a section item for a student in a specific course instance.
     *
     * @param courseInstanceId - Unique ID of the course instance.
     * @param studentId - Unique ID of the student.
     * @param sectionItemId - Unique ID of the section item.
     * @returns A promise resolving to the section item progress record, if found.
     */

    async getSectionItemProgress(
        courseInstanceId: string,
        studentId: string,
        sectionItemId: string
    ) {
        return prisma.studentSectionItemProgress.findUnique({
            where: {
                studentId_sectionItemId_courseInstanceId:{
                    studentId,
                    sectionItemId,
                    courseInstanceId
                }

            },
            select:{
                progress:true
            }
        });
    }

    /**
     * Retrieves the details of a section item, including the next section item (if any).
     *
     * @param courseInstanceId - Unique ID of the course instance.
     * @param studentId - Unique ID of the student.
     * @param sectionItemId - Unique ID of the section item.
     * @returns A promise resolving to the section item details.
     */

    async getSectionItemDetails(
        courseInstanceId: string,
        studentId: string,
        sectionItemId: string
    ) {
        return prisma.sectionItemNext.findUnique({
            where: {
                sectionItemId,
            },
        });
    }

    /**
     * Retrieves the details of a section, including the next section (if any).
     *
     * @param courseInstanceId - Unique ID of the course instance.
     * @param studentId - Unique ID of the student.
     * @param sectionId - Unique ID of the section.
     * @returns A promise resolving to the section details.
     */

    async getSectionDetails(
        courseInstanceId: string,
        studentId: string,
        sectionId: string
    ) {
        return prisma.sectionNext.findUnique({
            where: {
                sectionId,
            },
        });
    }

    /**
     * Retrieves the details of a module, including the next module (if any).
     *
     * @param courseInstanceId - Unique ID of the course instance.
     * @param studentId - Unique ID of the student.
     * @param moduleId - Unique ID of the module.
     * @returns A promise resolving to the module details.
     */

    async getModuleDetails(
        courseInstanceId: string,
        studentId: string,
        moduleId: string
    ) {
        return prisma.moduleNext.findUnique({
            where: {
                moduleId,
            },
        });
    }


    /**
     * Updates the progress of a course for a student in a specific course instance.
     *
     * - If no progress record exists, creates a new one.
     * - If progress is INCOMPLETE, updates it to IN_PROGRESS.
     * - If progress is IN_PROGRESS, updates it to COMPLETE.
     *
     * @param courseInstanceId - Unique ID of the course instance.
     * @param studentId - Unique ID of the student.
     * @returns A promise resolving to the updated course progress record.
     */

    async updateCourseProgress(courseInstanceId: string, studentId: string) {
        const existingProgress = await prisma.studentCourseProgress.findUnique({
            where: {
                studentId_courseInstanceId: {
                    studentId,
                    courseInstanceId,
                },
            },
        });
        if (!existingProgress) {
            throw new Error("No progress record found");
        }
        const newProgress =
            existingProgress.progress === ProgressEnum.INCOMPLETE
                ? ProgressEnum.IN_PROGRESS
                : ProgressEnum.COMPLETE;

        return prisma.studentCourseProgress.update({
            where: {
                studentId_courseInstanceId: {
                    studentId,
                    courseInstanceId,
                },
            },
            data: {
                progress: newProgress,
            },
        });
    }
    /**
     * Updates the progress of a module for a student in a specific course instance.
     *
     * - If no progress record exists, creates a new one.
     * - If progress is INCOMPLETE, updates it to IN_PROGRESS.
     * - If progress is IN_PROGRESS, updates it to COMPLETE.
     *
     * @param courseInstanceId - Unique ID of the course instance.
     * @param studentId - Unique ID of the student.
     * @param moduleId - Unique ID of the module.
     * @returns A promise resolving to the updated module progress record.
     */

    async updateModuleProgress(
        courseInstanceId: string,
        studentId: string,
        moduleId: string
    ) {
        const existingProgress = await prisma.studentModuleProgress.findUnique({
            where: {
                studentId_moduleId_courseInstanceId: {
                    studentId,
                    moduleId,
                    courseInstanceId,
                },
            },
        });
        if (!existingProgress) {
            throw new Error("No progress record found");
        }
        const newProgress =
            existingProgress.progress === ProgressEnum.INCOMPLETE
                ? ProgressEnum.IN_PROGRESS
                : ProgressEnum.COMPLETE;

        return prisma.studentModuleProgress.update({
            where: {
                studentId_moduleId_courseInstanceId: {
                    studentId,
                    moduleId,
                    courseInstanceId,
                },
            },
            data: {
                progress: newProgress,
            },
        });
    }

    /**
     * Updates the progress of a section for a student in a specific course instance.
     *
     * - If no progress record exists, creates a new one.
     * - If progress is INCOMPLETE, updates it to IN_PROGRESS.
     * - If progress is IN_PROGRESS, updates it to COMPLETE.
     *
     * @param courseInstanceId - Unique ID of the course instance.
     * @param studentId - Unique ID of the student.
     * @param sectionId - Unique ID of the section.
     * @returns A promise resolving to the updated section progress record.
     */

    async updateSectionProgress(
        courseInstanceId: string,
        studentId: string,
        sectionId: string
    ) {
        const existingProgress = await prisma.studentSectionProgress.findUnique({
            where: {
                studentId_sectionId_courseInstanceId: {
                    studentId,
                    sectionId,
                    courseInstanceId,
                },
            },
        });
        if (!existingProgress) {
            throw new Error("No progress record found");
        }
        const newProgress =
            existingProgress.progress === ProgressEnum.INCOMPLETE
                ? ProgressEnum.IN_PROGRESS
                : ProgressEnum.COMPLETE;

        return prisma.studentSectionProgress.update({
            where: {
                studentId_sectionId_courseInstanceId: {
                    studentId,
                    sectionId,
                    courseInstanceId,
                },
            },
            data: {
                progress: newProgress,
            },
        });
    }

    /**
     * Updates the progress of a section item for a student in a specific course instance.
     *
     * - If no progress record exists, creates a new one.
     * - If progress is INCOMPLETE, updates it to IN_PROGRESS.
     * - If progress is IN_PROGRESS, updates it to COMPLETE.
     *
     * @param courseInstanceId - Unique ID of the course instance.
     * @param studentId - Unique ID of the student.
     * @param sectionItemId - Unique ID of the section item.
     * @returns A promise resolving to the updated section item progress record.
     */

    async updateSectionItemProgress(
        courseInstanceId: string,
        studentId: string,
        sectionItemIds: string[]
    ): Promise<any[]> {
        const transactions = sectionItemIds.map(async (sectionItemId) => {
            const existingProgress = await prisma.studentSectionItemProgress.findUnique({
                where: {
                    studentId_sectionItemId_courseInstanceId: {
                        studentId,
                        sectionItemId,
                        courseInstanceId,
                    },
                },
            });

            if (!existingProgress) {
                throw new Error(`No progress record found for section item ID ${sectionItemId}`);
            }

            const newProgress =
                existingProgress.progress === ProgressEnum.INCOMPLETE
                    ? ProgressEnum.IN_PROGRESS
                    : ProgressEnum.COMPLETE;

            return prisma.studentSectionItemProgress.update({
                where: {
                    studentId_sectionItemId_courseInstanceId: {
                        studentId,
                        sectionItemId,
                        courseInstanceId,
                    },
                },
                data: {
                    progress: newProgress,
                },
            });
        });

        return Promise.all(transactions);
    }


}
