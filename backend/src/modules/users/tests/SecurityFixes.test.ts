import request from 'supertest';
import Express from 'express';
import { useContainer, useExpressServer } from 'routing-controllers';
import { Container } from 'inversify';
import { ObjectId } from 'mongodb';
import { describe, it, expect, beforeAll, vi } from 'vitest';

// Import container modules
import { sharedContainerModule } from '#root/container.js';
import { authContainerModule } from '#auth/container.js';
import { usersContainerModule } from '#users/container.js';
import { coursesContainerModule } from '#courses/container.js';
import { quizzesContainerModule } from '#root/modules/quizzes/container.js';
import { notificationsContainerModule } from '#root/modules/notifications/container.js';
import { anomaliesContainerModule } from '#root/modules/anomalies/container.js';
import { projectsContainerModule } from '#root/modules/projects/container.js';
import { hpSystemContainerModule } from '#root/modules/hpSystem/container.js';
import { courseRegistrationContainerModule } from '#root/modules/courseRegistration/container.js';
import { reportsContainerModule } from '#root/modules/reports/container.js';
import { ejectionPolicyContainerModule } from '#root/modules/ejectionPolicy/container.js';
import { emotionsContainerModule } from '#root/modules/emotions/container.js';
import { genAIContainerModule } from '#root/modules/genAI/container.js';
import { studentQuestionsContainerModule } from '#root/modules/studentQuestions/container.js';
import { announcementsContainerModule } from '#root/modules/announcements/container.js';
import { auditTrailsContainerModule } from '#root/modules/auditTrails/container.js';
import { settingContainerModule } from '#root/modules/setting/container.js';
import { InversifyAdapter } from '#root/inversify-adapter.js';

// Import controllers
import { ProgressController } from '#users/controllers/ProgressController.js';
import { CourseController } from '#courses/controllers/CourseController.js';
import { CourseVersionController } from '#courses/controllers/CourseVersionController.js';
import { ItemController } from '#courses/controllers/ItemController.js';

// Import services to spy/mock
import { FirebaseAuthService } from '#root/modules/auth/services/FirebaseAuthService.js';
import { EnrollmentService } from '#users/services/EnrollmentService.js';
import { ProgressService } from '#users/services/ProgressService.js';
import { CourseService } from '#courses/services/CourseService.js';
import { CourseVersionService } from '#courses/services/CourseVersionService.js';
import { ItemService } from '#courses/services/ItemService.js';

describe('Security Fixes Integration Tests', () => {
  const appInstance = Express();
  let app: any;

  // Generate mock ObjectIds for tests
  const courseId = new ObjectId().toString();
  const versionId = new ObjectId().toString();
  const itemId = new ObjectId().toString();

  const adminUserId = new ObjectId().toString();
  const studentUserId = new ObjectId().toString();
  const instructorUserId = new ObjectId().toString();
  const taUserId = new ObjectId().toString();

  const mockAdminUser = {
    _id: adminUserId,
    roles: 'admin',
    email: 'admin@test.com',
    firstName: 'Admin',
    lastName: 'User',
  };

  const mockStudentUser = {
    _id: studentUserId,
    roles: 'user',
    email: 'student@test.com',
    firstName: 'Student',
    lastName: 'User',
  };

  const mockInstructorUser = {
    _id: instructorUserId,
    roles: 'user',
    email: 'instructor@test.com',
    firstName: 'Instructor',
    lastName: 'User',
  };

  const mockTaUser = {
    _id: taUserId,
    roles: 'user',
    email: 'ta@test.com',
    firstName: 'TA',
    lastName: 'User',
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';

    const container = new Container();
    await container.load(
      sharedContainerModule,
      authContainerModule,
      usersContainerModule,
      coursesContainerModule,
      quizzesContainerModule,
      notificationsContainerModule,
      anomaliesContainerModule,
      projectsContainerModule,
      hpSystemContainerModule,
      courseRegistrationContainerModule,
      reportsContainerModule,
      ejectionPolicyContainerModule,
      emotionsContainerModule,
      genAIContainerModule,
      studentQuestionsContainerModule,
      announcementsContainerModule,
      auditTrailsContainerModule,
      settingContainerModule
    );

    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);

    app = useExpressServer(appInstance, {
      controllers: [
        ProgressController,
        CourseController,
        CourseVersionController,
        ItemController,
      ],
      authorizationChecker: async (action) => {
        const token = action.request.headers.authorization?.split(' ')[1];
        return !!token && token !== 'no-token';
      },
      currentUserChecker: async (action) => {
        const token = action.request.headers.authorization?.split(' ')[1];
        if (token === 'admin-token') return mockAdminUser;
        if (token === 'student-token') return mockStudentUser;
        if (token === 'instructor-token') return mockInstructorUser;
        if (token === 'ta-token') return mockTaUser;
        return null;
      },
      defaultErrorHandler: true,
      validation: true,
    });

    // Mock authentication service
    vi.spyOn(FirebaseAuthService.prototype, 'getCurrentUserFromToken').mockImplementation(
      async (token: string): Promise<any> => {
        if (token === 'admin-token') return mockAdminUser;
        if (token === 'student-token') return mockStudentUser;
        if (token === 'instructor-token') return mockInstructorUser;
        if (token === 'ta-token') return mockTaUser;
        throw new Error('Invalid token');
      }
    );

    // Mock enrollment service
    vi.spyOn(EnrollmentService.prototype, 'getAllEnrollments').mockImplementation(
      async (userId: string): Promise<any[]> => {
        if (userId === studentUserId) {
          return [{
            courseId: courseId,
            courseVersionId: versionId,
            role: 'STUDENT',
          }];
        }
        if (userId === instructorUserId) {
          return [{
            courseId: courseId,
            courseVersionId: versionId,
            role: 'INSTRUCTOR',
          }];
        }
        if (userId === taUserId) {
          return [{
            courseId: courseId,
            courseVersionId: versionId,
            role: 'TA',
          }];
        }
        return [];
      }
    );

    // Mock services methods executed by controllers to avoid database calls
    vi.spyOn(ProgressService.prototype, 'getLeaderboardNoAuth').mockResolvedValue({
      course: 'Test Course',
      version: '1.0',
      data: [],
    });

    vi.spyOn(ProgressService.prototype, 'createBulkWatchiTimeDocs').mockResolvedValue({ success: true } as any);

    vi.spyOn(CourseService.prototype, 'getActiveUsersByCourse').mockResolvedValue({ activeUsers: [] });

    vi.spyOn(CourseVersionService.prototype, 'getCourseVersionTotalWatchTime').mockResolvedValue({
      watchTime: '10 hours',
    } as any);

    vi.spyOn(ItemService.prototype, 'getVideoUserAnalytics').mockResolvedValue([] as any);
  });

  describe('1. Leaderboard No-Auth Endpoint Security', () => {
    const path = `/users/progress/courses/${courseId}/versions/${versionId}/leaderboard/no-auth`;

    it('should return 401 Unauthorized when no token is provided', async () => {
      await request(app).get(path).expect(401);
    });

    it('should return 403 Forbidden for STUDENT users', async () => {
      await request(app)
        .get(path)
        .set('Authorization', 'Bearer student-token')
        .expect(403);
    });

    it('should return 200 Success for INSTRUCTOR users', async () => {
      await request(app)
        .get(path)
        .set('Authorization', 'Bearer instructor-token')
        .expect(200);
    });

    it('should return 200 Success for TA users', async () => {
      await request(app)
        .get(path)
        .set('Authorization', 'Bearer ta-token')
        .expect(200);
    });

    it('should return 200 Success for ADMIN users', async () => {
      await request(app)
        .get(path)
        .set('Authorization', 'Bearer admin-token')
        .expect(200);
    });
  });

  describe('2. Watch-Time Bulk Endpoint Security', () => {
    const path = '/users/progress/watch-time/bulk';

    it('should return 401 Unauthorized when no token is provided', async () => {
      await request(app)
        .post(path)
        .send({ courseId, versionId, userId: studentUserId })
        .expect(401);
    });

    it('should return 403 Forbidden when STUDENT tries to bulk update watch-time for other users (userId=null)', async () => {
      await request(app)
        .post(path)
        .set('Authorization', 'Bearer student-token')
        .send({ courseId, versionId, userId: null })
        .expect(403);
    });

    it('should return 403 Forbidden when STUDENT tries to bulk update watch-time for another student', async () => {
      await request(app)
        .post(path)
        .set('Authorization', 'Bearer student-token')
        .send({ courseId, versionId, userId: instructorUserId })
        .expect(403);
    });

    it('should return 201 Created when STUDENT updates watch-time for themselves', async () => {
      await request(app)
        .post(path)
        .set('Authorization', 'Bearer student-token')
        .send({ courseId, versionId, userId: studentUserId })
        .expect(201);
    });

    it('should return 201 Created when INSTRUCTOR updates watch-time for a student', async () => {
      await request(app)
        .post(path)
        .set('Authorization', 'Bearer instructor-token')
        .send({ courseId, versionId, userId: studentUserId })
        .expect(201);
    });

    it('should return 201 Created when ADMIN updates watch-time globally (userId=null)', async () => {
      await request(app)
        .post(path)
        .set('Authorization', 'Bearer admin-token')
        .send({ courseId, versionId, userId: null })
        .expect(201);
    });
  });

  describe('3. Active Users Endpoint Security', () => {
    const path = `/courses/active-users?courseId=${courseId}&courseVersionId=${versionId}`;

    it('should return 401 Unauthorized when no token is provided', async () => {
      await request(app).get(path).expect(401);
    });

    it('should return 403 Forbidden for STUDENT users', async () => {
      await request(app)
        .get(path)
        .set('Authorization', 'Bearer student-token')
        .expect(403);
    });

    it('should return 200 Success for INSTRUCTOR users', async () => {
      await request(app)
        .get(path)
        .set('Authorization', 'Bearer instructor-token')
        .expect(200);
    });

    it('should return 200 Success for TA users', async () => {
      await request(app)
        .get(path)
        .set('Authorization', 'Bearer ta-token')
        .expect(200);
    });

    it('should return 200 Success for ADMIN users', async () => {
      await request(app)
        .get(path)
        .set('Authorization', 'Bearer admin-token')
        .expect(200);
    });
  });

  describe('4. Course Version Watch-Time Endpoint Security', () => {
    const path = `/courses/${courseId}/versions/${versionId}/watch-time`;

    it('should return 401 Unauthorized when no token is provided', async () => {
      await request(app).get(path).expect(401);
    });

    it('should return 403 Forbidden for STUDENT users', async () => {
      await request(app)
        .get(path)
        .set('Authorization', 'Bearer student-token')
        .expect(403);
    });

    it('should return 200 Success for INSTRUCTOR users', async () => {
      await request(app)
        .get(path)
        .set('Authorization', 'Bearer instructor-token')
        .expect(200);
    });

    it('should return 200 Success for TA users', async () => {
      await request(app)
        .get(path)
        .set('Authorization', 'Bearer ta-token')
        .expect(200);
    });

    it('should return 200 Success for ADMIN users', async () => {
      await request(app)
        .get(path)
        .set('Authorization', 'Bearer admin-token')
        .expect(200);
    });
  });

  describe('5. Video Analytics Endpoint Security', () => {
    const path = `/courses/${courseId}/versions/${versionId}/item/${itemId}/analytics/users`;

    it('should return 401 Unauthorized when no token is provided', async () => {
      await request(app).get(path).expect(401);
    });

    it('should return 403 Forbidden for STUDENT users', async () => {
      await request(app)
        .get(path)
        .set('Authorization', 'Bearer student-token')
        .expect(403);
    });

    it('should return 200 Success for INSTRUCTOR users', async () => {
      await request(app)
        .get(path)
        .set('Authorization', 'Bearer instructor-token')
        .expect(200);
    });

    it('should return 200 Success for TA users', async () => {
      await request(app)
        .get(path)
        .set('Authorization', 'Bearer ta-token')
        .expect(200);
    });

    it('should return 200 Success for ADMIN users', async () => {
      await request(app)
        .get(path)
        .set('Authorization', 'Bearer admin-token')
        .expect(200);
    });
  });
});
