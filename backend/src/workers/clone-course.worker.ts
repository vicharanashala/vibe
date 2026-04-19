import { parentPort, workerData } from "worker_threads";
import "reflect-metadata";
import { Container } from "inversify";
import "dotenv/config";

import {
    CourseRepository,
    MongoDatabase,
    ProgressRepository,
    EnrollmentRepository,
    SettingRepository,
    UserRepository,
    InviteRepository,
} from "#root/shared/index.js";

import { GLOBAL_TYPES } from "#root/types.js";
import { AttemptRepository, QuestionBankRepository, QuestionRepository, SubmissionRepository, UserQuizMetricsRepository } from "#root/modules/quizzes/repositories/index.js";
import { AnomalyRepository } from "#root/modules/anomalies/index.js";
import { CourseRegistrationRepository } from "#root/modules/courseRegistration/repositories/index.js";
import { ProjectSubmissionRepository } from "#root/modules/projects/repositories/index.js";
import { ReportRepository } from "#root/modules/reports/repositories/index.js";
import { ItemRepository } from "#root/shared/database/providers/mongo/repositories/ItemRepository.js";
import { FeedbackRepository } from "#root/modules/quizzes/repositories/providers/mongodb/FeedbackRepository.js";
import { ObjectId } from "mongodb";
import { QuestionBank } from "#root/modules/quizzes/classes/transformers/QuestionBank.js";
import type { Module } from "#root/modules/courses/classes/index.js";

interface WorkerData {
    modules: Module[];
    newVersionId: string;
    newCourseId: string;
    mongoUri: string;
    dbName: string;
}

const data = workerData as WorkerData;

const modules = Array.isArray(data?.modules) ? data.modules : [];
const newVersionId = data.newVersionId;
const newCourseId = data.newCourseId;
const mongoUri = data.mongoUri;
const dbName = data.dbName || "vibe";

if (!parentPort) {
    console.error("parentPort missing - worker must run in thread");
    process.exit(1);
}

console.log(`Clone worker started for ${modules.length} modules`);

// Setup DI container
const container = new Container({ defaultScope: "Singleton" });
container.bind<string>(GLOBAL_TYPES.uri).toConstantValue(mongoUri);
container.bind<string>(GLOBAL_TYPES.dbName).toConstantValue(dbName);

container
    .bind<MongoDatabase>(GLOBAL_TYPES.Database)
    .to(MongoDatabase)
    .inSingletonScope();

const database = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
await database.connect();

// Initialize repositories
const progressRepo = new ProgressRepository(database);
const attemptRepo = new AttemptRepository(database);
const enrollmentRepo = new EnrollmentRepository(attemptRepo, database, progressRepo);
const anomalyRepo = new AnomalyRepository(database);
const settingsRepo = new SettingRepository(database);
const courseRegistrationRepo = new CourseRegistrationRepository(database);
const projectSubmissionRepo = new ProjectSubmissionRepository(database);
const questionBankRepo = new QuestionBankRepository(database);
const reportsRepo = new ReportRepository(database);
const inviteRepo = new InviteRepository(database);
const userRepo = new UserRepository(database);
const courseRepo = new CourseRepository(
    database,
    progressRepo,
    enrollmentRepo,
    anomalyRepo,
    settingsRepo,
    courseRegistrationRepo,
    projectSubmissionRepo,
    questionBankRepo,
    reportsRepo,
    inviteRepo
);
const itemRepo = new ItemRepository(database, courseRepo);
const questionRepo = new QuestionRepository(database);
const feedbackRepo = new FeedbackRepository(database);

(async () => {
    if (!modules.length) {
        parentPort?.postMessage({ success: true, clonedModules: [] });
        process.exit(0);
    }

    try {
        const questionBankMap = new Map<string, string>();

        const cloneQuestionBank = async (oldBankId: string) => {
            if (questionBankMap.has(oldBankId)) {
                return questionBankMap.get(oldBankId)!;
            }

            const originalBank = await questionBankRepo.getById(oldBankId);
            if (!originalBank) {
                throw new Error(`Question bank ${oldBankId} not found`);
            }

            const newBank = new QuestionBank({
                ...originalBank,
                _id: undefined,
                courseId: newCourseId,
                courseVersionId: newVersionId,
                questions: [],
            });

            const newBankId = await questionBankRepo.create(newBank);

            const newQuestionIds = await Promise.all(
                (originalBank.questions || []).map(async qId => {
                    const q = await questionRepo.duplicate(qId.toString());
                    return q?._id?.toString();
                }),
            );

            await questionBankRepo.update(
                newBankId,
                { questions: newQuestionIds.filter(Boolean) },
            );

            questionBankMap.set(oldBankId, newBankId);
            return newBankId;
        };

        const newModules: Module[] = [];
        let processed = 0;

        for (const module of modules) {
            try {
                const newModuleId = new ObjectId().toString();

                // Clone sections in parallel
                const newSections = await Promise.all(
                    module.sections.map(async section => {
                        if (!section.itemsGroupId) {
                            throw new Error("Missing itemsGroupId");
                        }

                        const oldItemGroup = await itemRepo.readItemsGroup(
                            section.itemsGroupId.toString(),
                        );
                        if (!oldItemGroup) {
                            throw new Error("ItemGroup not found");
                        }

                        // Create sectionId once and reuse
                        const newSectionId = new ObjectId().toString();

                        // Parallel item reads - maintain order
                        const fullItems = await Promise.all(
                            oldItemGroup.items.map(i =>
                                itemRepo.readItemById(i._id.toString()),
                            ),
                        );

                        // Clone items preparation
                        const clonedItemPayloads: { oldItemId: string; payload: any }[] = [];

                        for (const item of fullItems) {
                            if (!item) continue;

                            const oldItemId = item._id.toString();
                            const { _id, ...rest } = item;

                            const cloned: any = {
                                ...rest,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                            };

                            if (
                                cloned.type === 'QUIZ' &&
                                cloned.details?.questionBankRefs?.length
                            ) {
                                cloned.details = {
                                    ...cloned.details,
                                    questionBankRefs: await Promise.all(
                                        cloned.details.questionBankRefs.map(async ref => ({
                                            ...ref,
                                            bankId: await cloneQuestionBank(ref.bankId.toString()),
                                        })),
                                    ),
                                };
                            }

                            clonedItemPayloads.push({ oldItemId, payload: cloned });
                        }

                        if (!clonedItemPayloads.length) {
                            throw new Error('No items cloned for section');
                        }

                        const createdItems = await itemRepo.createItems(
                            clonedItemPayloads.map(i => i.payload),
                        );

                        const itemIdMap = new Map<string, string>();
                        createdItems.forEach((created, idx) => {
                            itemIdMap.set(
                                clonedItemPayloads[idx].oldItemId,
                                created._id.toString(),
                            );
                        });

                        const newItemGroup = await itemRepo.createItemsGroup({
                            sectionId: newSectionId,
                            items: oldItemGroup.items.map(ref => {
                                const newItemId = itemIdMap.get(ref._id.toString());
                                if (!newItemId) {
                                    throw new Error(`Missing cloned item for ${ref._id.toString()}`);
                                }

                                return {
                                    ...ref,
                                    _id: new ObjectId(newItemId),
                                };
                            }),
                        });

                        return {
                            ...section,
                            sectionId: newSectionId,
                            itemsGroupId: new ObjectId(newItemGroup._id.toString()),
                        };
                    }),
                );

                newModules.push({
                    ...module,
                    moduleId: newModuleId,
                    sections: newSections,
                });

                processed++;
            } catch (err) {
                console.error(`Failed to clone module ${module.moduleId}`, err);
                throw err;
            }
        }

        console.log(`Clone worker finished: ${processed}/${modules.length} modules`);
        await database.disconnect();
        parentPort?.postMessage({ success: true, clonedModules: newModules });

        process.exit(0);
    } catch (err) {
        console.error("Worker fatal error", err);
        await database.disconnect();
        parentPort?.postMessage({ success: false, error: err.message });
        process.exit(1);
    }
})();
