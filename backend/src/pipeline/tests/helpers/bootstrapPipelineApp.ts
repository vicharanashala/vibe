import Express from 'express';
import { randomUUID } from 'node:crypto';
import { useContainer, useExpressServer } from 'routing-controllers';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { vi } from 'vitest';
import type { Express as ExpressType } from 'express';
import type { IUser } from '#root/shared/interfaces/models.js';
import { Container } from 'inversify';
import { ProgressService } from '#root/modules/users/services/ProgressService.js';

interface PipelineUser {
  id: string;
  token: string;
  role: 'admin' | 'user';
}

interface BootstrappedPipelineApp {
  app: ExpressType;
  createUser: (role: 'admin' | 'user') => Promise<PipelineUser>;
  stop: () => Promise<void>;
}

export async function bootstrapPipelineApp(): Promise<BootstrappedPipelineApp> {
  process.env.NODE_ENV = 'test';
  process.env.PIPELINE_TEST_MODE = 'true';
  process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-test';
  process.env.FIREBASE_AUTH_EMULATOR_HOST =
    process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  process.env.FIREBASE_EMULATOR_HOST =
    process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1:4000';

  const mongoServer = await MongoMemoryServer.create();
  process.env.DB_URL = mongoServer.getUri();
  process.env.DB_NAME = `pipeline_${Date.now()}`;

  const originalConsoleLog = console.log;
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    const text = args.map(arg => String(arg)).join(' ');
    if (
      text.includes('vibe-backend-staging-239934307367.asia-south1.run.app') ||
      text.includes('AuditTrails indexes ensured')
    ) {
      return;
    }
    originalConsoleLog(...args);
  });

  const [
    { GLOBAL_TYPES },
    { FirebaseAuthService },
    { InversifyAdapter },
    { sharedContainerModule },
    { usersContainerModule },
    { coursesContainerModule },
    { quizzesContainerModule },
    { projectsContainerModule },
    { anomaliesContainerModule },
    { settingContainerModule },
    { CourseController },
    { CourseVersionController },
    { ModuleController },
    { SectionController },
    { ItemController },
    { EnrollmentController },
    { ProgressController },
    { AttemptController },
    { QuizController },
    { QuestionController },
    { QuestionBankController },
    { ProjectController },
    { AnomalyController },
  ] =
    await Promise.all([
      import('#root/types.js'),
      import('#root/modules/auth/services/FirebaseAuthService.js'),
      import('#root/inversify-adapter.js'),
      import('#root/container.js'),
      import('#root/modules/users/container.js'),
      import('#root/modules/courses/container.js'),
      import('#root/modules/quizzes/container.js'),
      import('#root/modules/projects/container.js'),
      import('#root/modules/anomalies/container.js'),
      import('#root/modules/setting/container.js'),
      import('#root/modules/courses/controllers/CourseController.js'),
      import('#root/modules/courses/controllers/CourseVersionController.js'),
      import('#root/modules/courses/controllers/ModuleController.js'),
      import('#root/modules/courses/controllers/SectionController.js'),
      import('#root/modules/courses/controllers/ItemController.js'),
      import('#root/modules/users/controllers/EnrollmentController.js'),
      import('#root/modules/users/controllers/ProgressController.js'),
      import('#root/modules/quizzes/controllers/AttemptController.js'),
      import('#root/modules/quizzes/controllers/QuizController.js'),
      import('#root/modules/quizzes/controllers/QuestionController.js'),
      import('#root/modules/quizzes/controllers/QuestionBankController.js'),
      import('#root/modules/projects/controllers/projectController.js'),
      import('#root/modules/anomalies/controllers/AnomalyController.js'),
    ]);
  const container = new Container();
  await container.load(
    sharedContainerModule,
    usersContainerModule,
    coursesContainerModule,
    quizzesContainerModule,
    projectsContainerModule,
    anomaliesContainerModule,
    settingContainerModule,
  );

  // Minimal dependency placeholders needed by CourseRepository wiring in pipeline boot.
  container.bind(Symbol.for('CourseRegistrationRepository')).toConstantValue({});
  container.bind(Symbol.for('ledgerRepository')).toConstantValue({});
  container.bind(Symbol.for('cohortRepository')).toConstantValue({});
  container.bind(Symbol.for('ReportRepo')).toConstantValue({});
  container.bind(Symbol.for('InviteRepo')).toConstantValue({});
  container.bind(Symbol.for('InviteService')).toConstantValue({});
  container.bind(Symbol.for('NotificationService')).toConstantValue({});
  container.bind(Symbol.for('MailService')).toConstantValue({});
  container.bind(Symbol.for('AuditTrailsRepository')).toConstantValue({
    createAuditTrail: async () => null,
  });

  const adapter = new InversifyAdapter(container);
  useContainer(adapter);

  vi.spyOn(ProgressService.prototype as any, 'getCourseSettingService').mockReturnValue({
    isLinearProgressionEnabled: async () => true,
  });

  const controllers: Function[] = [
    CourseController,
    CourseVersionController,
    ModuleController,
    SectionController,
    ItemController,
    EnrollmentController,
    ProgressController,
    AttemptController,
    QuizController,
    QuestionController,
    QuestionBankController,
    ProjectController,
    AnomalyController,
  ];

  const app = useExpressServer(Express(), {
    controllers,
    defaultErrorHandler: true,
    validation: true,
    authorizationChecker: async () => true,
  });

  const userRepo = container.get<any>(GLOBAL_TYPES.UserRepo);
  const database = container.get<any>(GLOBAL_TYPES.Database);
  await database.connect();

  const authHeaderToToken = (header?: string): string => {
    if (!header) {
      return '';
    }
    const parts = header.split(' ');
    return parts.length === 2 ? parts[1] : header;
  };

  const createUser = async (role: 'admin' | 'user'): Promise<PipelineUser> => {
    const user: IUser = {
      firebaseUID: `pipeline-firebase-${randomUUID()}`,
      email: `pipeline-${randomUUID()}@example.com`,
      firstName: role === 'admin' ? 'Pipeline' : 'Student',
      lastName: role === 'admin' ? 'Admin' : 'User',
      roles: role,
    };

    const id = await userRepo.create(user);
    return { id, token: id, role };
  };

  const getUserFromToken = async (token: string): Promise<IUser> => {
    const user = await userRepo.findById(token);
    if (!user) {
      throw new Error('User not found for token');
    }
    return user;
  };

  const firebaseAuthBinding = await container.rebind(FirebaseAuthService);
  firebaseAuthBinding.toConstantValue({
    verifyToken: async (token: string) => true,
    getUserIdFromReq: async (req: any) => {
      const token = authHeaderToToken(req?.headers?.authorization);
      const user = await getUserFromToken(token);
      return user._id.toString();
    },
    getCurrentUserFromToken: async (token: string) => getUserFromToken(token),
  } as unknown as InstanceType<typeof FirebaseAuthService>);

  vi.spyOn(FirebaseAuthService.prototype, 'verifyToken').mockResolvedValue(true);
  vi.spyOn(FirebaseAuthService.prototype, 'getUserIdFromReq').mockImplementation(
    async (req: any): Promise<string> => {
      const token = authHeaderToToken(req?.headers?.authorization);
      const user = await getUserFromToken(token);
      return user._id.toString();
    },
  );
  vi.spyOn(
    FirebaseAuthService.prototype,
    'getCurrentUserFromToken',
  ).mockImplementation(async (token: string): Promise<IUser> => {
    return getUserFromToken(token);
  });

  const stop = async () => {
    vi.restoreAllMocks();
    delete process.env.PIPELINE_TEST_MODE;
    await database.disconnect();
    await mongoServer.stop();
  };

  return {
    app,
    createUser,
    stop,
  };
}
