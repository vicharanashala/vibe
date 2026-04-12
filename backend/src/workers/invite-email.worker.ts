import { parentPort, workerData } from "worker_threads";
import "reflect-metadata";
import { Container } from "inversify";
import "dotenv/config";

import {
  InviteRepository,
  CourseRepository,
  MongoDatabase,
  ProgressRepository,
  EnrollmentRepository,
  SettingRepository,
  UserRepository,
} from "#root/shared/index.js";

import {
  InviteService,
  MailService,
} from "#root/modules/notifications/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { AttemptRepository, QuestionBankRepository, QuizRepository, SubmissionRepository, UserQuizMetricsRepository } from "#root/modules/quizzes/repositories/index.js";
import { AnomalyRepository } from "#root/modules/anomalies/index.js";
import { CourseRegistrationRepository } from "#root/modules/courseRegistration/repositories/index.js";
import { ProjectSubmissionRepository } from "#root/modules/projects/repositories/index.js";
import { ReportRepository } from "#root/modules/reports/repositories/index.js";
import { ItemRepository } from "#root/shared/database/providers/mongo/repositories/ItemRepository.js";
import { EnrollmentService } from "#root/modules/users/services/EnrollmentService.js";
import { ProgressService } from "#root/modules/users/services/ProgressService.js";
import { FeedbackRepository } from "#root/modules/quizzes/repositories/providers/mongodb/FeedbackRepository.js";

interface WorkerData {
  inviteIds: string[];
  courseId: string;
  courseVersionId: string;
  mongoUri: string;
  dbName: string;
}

const data = workerData as WorkerData;

const inviteIds = Array.isArray(data?.inviteIds) ? data.inviteIds : [];
const courseId = data.courseId;
const courseVersionId = data.courseVersionId;
const mongoUri = data.mongoUri;
const dbName = data.dbName || "vibe";
if (!parentPort) {
  console.error("❌ parentPort missing — worker must run in thread");
  process.exit(1);
}

console.log(`📨 Invite worker started for ${inviteIds.length} invites`);

const container = new Container({ defaultScope: "Singleton" });
container.bind<string>(GLOBAL_TYPES.uri).toConstantValue(mongoUri);
container.bind<string>(GLOBAL_TYPES.dbName).toConstantValue(dbName);

container
  .bind<MongoDatabase>(GLOBAL_TYPES.Database)
  .to(MongoDatabase)
  .inSingletonScope();

const database = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
await database.connect();
const inviteRepo = new InviteRepository(database)
const progressRepo = new ProgressRepository(database)
const attemptRepo = new AttemptRepository(database)
const enrollmentRepo = new EnrollmentRepository(attemptRepo, database)
const anomalyRepo = new AnomalyRepository(database)
const settingsRepo = new SettingRepository(database)
const courseRegistrationRepo = new CourseRegistrationRepository(database)
const projectSubmissionRepo = new ProjectSubmissionRepository(database)
const questionBankRepo = new QuestionBankRepository(database)
const reportsRepo = new ReportRepository(database)
const courseRepo = new CourseRepository(database, progressRepo, enrollmentRepo, anomalyRepo, settingsRepo, courseRegistrationRepo, projectSubmissionRepo, questionBankRepo, reportsRepo, inviteRepo)
const mailService = new MailService()
const userRepo = new UserRepository(database)
const itemRepo = new ItemRepository(database, courseRepo)
const submissionRepo = new SubmissionRepository(database)
const userQuizMetricsRepo = new UserQuizMetricsRepository(database)
const quizRepo = new QuizRepository(database)
const feedbackRepo = new FeedbackRepository(database)
const progressService = new ProgressService(progressRepo, submissionRepo, courseRepo, settingsRepo, userRepo, itemRepo, enrollmentRepo, userQuizMetricsRepo, quizRepo, projectSubmissionRepo, feedbackRepo, database)
const enrollmentService = new EnrollmentService(enrollmentRepo, courseRepo, userRepo, itemRepo, courseRegistrationRepo, progressService, settingsRepo, inviteRepo, progressRepo, database)
const inviteService = new InviteService(inviteRepo, userRepo, courseRepo, enrollmentRepo, mailService, itemRepo, enrollmentService, database);

(async () => {
  if (!inviteIds.length) {
    parentPort?.postMessage({ success: true, processed: 0 });
    process.exit(0);
  }

  try {
    const course = await courseRepo.read(courseId.toString());
    const version = await courseRepo.readVersion(courseVersionId.toString());
    const courseSettings = await settingsRepo.readCourseSettings(courseId.toString(), courseVersionId.toString());
    const allProctorsDisabled =
      courseSettings.settings.proctors.detectors.every(
        (detector: any) => detector.settings.enabled === false
      );
    let processed = 0;

    for (const inviteId of inviteIds) {
      try {
        const invite = await inviteRepo.findInviteById(inviteId);
        if (!invite) continue;

        const email = inviteService.createInviteEmailMessage(
          invite,
          course,
          version,
          allProctorsDisabled
        );



        await mailService.sendMail(email);

        processed++;
      } catch (err) {
        console.error(`❌ Failed email invite ${inviteId}`, err);
      }
    }

    console.log(`🏁 Invite worker finished → ${processed}/${inviteIds.length}`);
    await database.disconnect();
    parentPort?.postMessage({ success: true, processed });

    process.exit(0);
  } catch (err) {
    console.error("❌ Worker fatal error", err);
    parentPort?.postMessage({ success: false });
    // process.exit(1);
  }
})();


