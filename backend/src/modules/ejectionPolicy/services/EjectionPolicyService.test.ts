import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {Container} from 'inversify';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {EjectionPolicyRepository} from '../repositories/providers/mongodb/EjectionPolicyRepository.js';
import {EjectionPolicyService} from './EjectionPolicyService.js';
import {ObjectId} from 'mongodb';
import {GLOBAL_TYPES} from '#root/types.js';
import {EJECTION_POLICY_TYPES} from '../types.js';

describe('EjectionPolicyService', () => {
  let container: Container;
  let database: MongoDatabase;
  let service: EjectionPolicyService;
  let testUserId: string;
  let testCourseId: string;

  beforeAll(async () => {
    const uri = process.env.DB_URL;
    const dbName = process.env.DB_NAME || 'vibe';

    container = new Container();
    container.bind<string>(GLOBAL_TYPES.uri).toConstantValue(uri);
    container.bind<string>(GLOBAL_TYPES.dbName).toConstantValue(dbName);
    container
      .bind<MongoDatabase>(GLOBAL_TYPES.Database)
      .to(MongoDatabase)
      .inSingletonScope();
    container
      .bind<EjectionPolicyRepository>(EJECTION_POLICY_TYPES.EjectionPolicyRepo)
      .to(EjectionPolicyRepository)
      .inSingletonScope();
    container
      .bind<EjectionPolicyService>(EJECTION_POLICY_TYPES.EjectionPolicyService)
      .to(EjectionPolicyService)
      .inSingletonScope();

    database = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    service = container.get<EjectionPolicyService>(
      EJECTION_POLICY_TYPES.EjectionPolicyService,
    );

    await database.connect();

    testUserId = new ObjectId().toString();
    testCourseId = new ObjectId().toString();

    console.log('🧪 Service Test Setup Complete');
  });

  afterAll(async () => {
    try {
      if (database) {
        const collection = await database.getCollection('ejectionPolicies');
        const result = await collection.deleteMany({});
        console.log(`   Deleted ${result.deletedCount} test policies`);
        await database.disconnect();
      }
      console.log('🧹 Service Test Cleanup Complete');
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('Create Policy', () => {
    it('should create a valid policy', async () => {
      const policy = await service.createPolicy(
        {
          name: 'Test Policy',
          description: 'Test Description',
          scope: 'platform',
          isActive: true,
          priority: 100,
          triggers: {
            inactivity: {
              enabled: true,
              thresholdDays: 30,
              warningDays: 7,
            },
          },
          actions: {
            sendWarning: true,
            allowAppeal: true,
            appealDeadlineDays: 5,
          },
        },
        testUserId,
      );

      expect(policy._id).toBeDefined();
      expect(policy.name).toBe('Test Policy');
      console.log(`   ✅ Created policy via service: ${policy._id}`);
    });

    it('should reject policy without enabled triggers', async () => {
      await expect(
        service.createPolicy(
          {
            name: 'Invalid Policy',
            scope: 'platform',
            isActive: true,
            priority: 100,
            triggers: {
              inactivity: {
                enabled: false,
                thresholdDays: 30,
                warningDays: 7,
              },
            },
            actions: {
              sendWarning: true,
              allowAppeal: false,
            },
          },
          testUserId,
        ),
      ).rejects.toThrow('at least one enabled trigger');

      console.log(`   ✅ Correctly rejected policy without enabled triggers`);
    });

    it('should reject invalid inactivity thresholds', async () => {
      await expect(
        service.createPolicy(
          {
            name: 'Invalid Threshold',
            scope: 'platform',
            isActive: true,
            priority: 100,
            triggers: {
              inactivity: {
                enabled: true,
                thresholdDays: 10,
                warningDays: 15, // Invalid: warning > threshold
              },
            },
            actions: {
              sendWarning: true,
              allowAppeal: false,
            },
          },
          testUserId,
        ),
      ).rejects.toThrow('Warning days must be less than threshold days');

      console.log(`   ✅ Correctly rejected invalid thresholds`);
    });

    it('should reject course policy without courseId', async () => {
      await expect(
        service.createPolicy(
          {
            name: 'Course Policy Without ID',
            scope: 'course',
            // Missing courseId
            isActive: true,
            priority: 100,
            triggers: {
              inactivity: {
                enabled: true,
                thresholdDays: 30,
                warningDays: 7,
              },
            },
            actions: {
              sendWarning: true,
              allowAppeal: false,
            },
          },
          testUserId,
        ),
      ).rejects.toThrow('Course-specific policies must have a courseId');

      console.log(`   ✅ Correctly rejected course policy without courseId`);
    });
  });

  describe('Platform Policy Constraints', () => {
    beforeAll(async () => {
      // Clean up any existing platform policies
      const collection = await database.getCollection('ejectionPolicies');
      await collection.deleteMany({scope: 'platform'});
    });

    it('should allow creating first active platform policy', async () => {
      const policy = await service.createPolicy(
        {
          name: 'First Platform Policy',
          scope: 'platform',
          isActive: true,
          priority: 100,
          triggers: {
            inactivity: {enabled: true, thresholdDays: 30, warningDays: 7},
          },
          actions: {sendWarning: true, allowAppeal: false},
        },
        testUserId,
      );

      expect(policy._id).toBeDefined();
      console.log(`   ✅ Created first platform policy`);
    });

    it('should prevent creating second active platform policy', async () => {
      await expect(
        service.createPolicy(
          {
            name: 'Second Platform Policy',
            scope: 'platform',
            isActive: true,
            priority: 100,
            triggers: {
              inactivity: {enabled: true, thresholdDays: 30, warningDays: 7},
            },
            actions: {sendWarning: true, allowAppeal: false},
          },
          testUserId,
        ),
      ).rejects.toThrow('Only one active platform-wide policy is allowed');

      console.log(`   ✅ Correctly prevented multiple platform policies`);
    });

    it('should allow creating inactive platform policy', async () => {
      const policy = await service.createPolicy(
        {
          name: 'Inactive Platform Policy',
          scope: 'platform',
          isActive: false, // Inactive, so should be allowed
          priority: 50,
          triggers: {
            inactivity: {enabled: true, thresholdDays: 60, warningDays: 14},
          },
          actions: {sendWarning: false, allowAppeal: false},
        },
        testUserId,
      );

      expect(policy._id).toBeDefined();
      expect(policy.isActive).toBe(false);
      console.log(`   ✅ Created inactive platform policy`);
    });
  });

  describe('Get Policies', () => {
    it('should get all active policies', async () => {
      const policies = await service.getPolicies({isActive: true});
      expect(policies.length).toBeGreaterThan(0);
      console.log(`   ✅ Retrieved ${policies.length} active policies`);
    });

    it('should get policies by scope', async () => {
      const platformPolicies = await service.getPolicies({scope: 'platform'});
      expect(platformPolicies.every(p => p.scope === 'platform')).toBe(true);
      console.log(
        `   ✅ Retrieved ${platformPolicies.length} platform policies`,
      );
    });

    it('should get active policies for a course', async () => {
      // Create a course-specific policy
      await service.createPolicy(
        {
          name: 'Course Specific',
          scope: 'course',
          courseId: testCourseId,
          isActive: true,
          priority: 150,
          triggers: {
            missedDeadlines: {
              enabled: true,
              consecutiveMisses: 3,
              warningAfterMisses: 2,
            },
          },
          actions: {sendWarning: true, allowAppeal: true},
        },
        testUserId,
      );

      const policies = await service.getActivePoliciesForCourse(testCourseId);

      // Should include both platform-wide and course-specific
      expect(policies.length).toBeGreaterThan(0);
      console.log(
        `   ✅ Retrieved ${policies.length} policies for course (platform + course-specific)`,
      );
    });
  });

  describe('Update Policy', () => {
    it('should update policy name', async () => {
      const created = await service.createPolicy(
        {
          name: 'Original Name',
          scope: 'course',
          courseId: testCourseId,
          isActive: true,
          priority: 100,
          triggers: {
            missedDeadlines: {
              enabled: true,
              consecutiveMisses: 3,
              warningAfterMisses: 2,
            },
          },
          actions: {sendWarning: true, allowAppeal: true},
        },
        testUserId,
      );

      const updated = await service.updatePolicy(created._id!.toString(), {
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');
      console.log(`   ✅ Updated policy name`);
    });

    it('should update policy triggers', async () => {
      const created = await service.createPolicy(
        {
          name: 'Update Triggers Test',
          scope: 'course',
          courseId: testCourseId,
          isActive: true,
          priority: 100,
          triggers: {
            inactivity: {enabled: true, thresholdDays: 30, warningDays: 7},
          },
          actions: {sendWarning: true, allowAppeal: false},
        },
        testUserId,
      );

      const updated = await service.updatePolicy(created._id!.toString(), {
        triggers: {
          inactivity: {enabled: true, thresholdDays: 60, warningDays: 14},
        },
      });

      expect(updated.triggers.inactivity?.thresholdDays).toBe(60);
      console.log(`   ✅ Updated policy triggers`);
    });

    it('should reject invalid updates', async () => {
      const created = await service.createPolicy(
        {
          name: 'Invalid Update Test',
          scope: 'course',
          courseId: testCourseId,
          isActive: true,
          priority: 100,
          triggers: {
            inactivity: {enabled: true, thresholdDays: 30, warningDays: 7},
          },
          actions: {sendWarning: true, allowAppeal: false},
        },
        testUserId,
      );

      await expect(
        service.updatePolicy(created._id!.toString(), {
          triggers: {
            inactivity: {
              enabled: true,
              thresholdDays: 10,
              warningDays: 20, // Invalid
            },
          },
        }),
      ).rejects.toThrow('Warning days must be less than threshold days');

      console.log(`   ✅ Correctly rejected invalid update`);
    });
  });

  describe('Toggle Policy Status', () => {
    it('should toggle policy status from active to inactive', async () => {
      const created = await service.createPolicy(
        {
          name: 'Toggle Test',
          scope: 'course',
          courseId: testCourseId,
          isActive: true,
          priority: 100,
          triggers: {
            inactivity: {enabled: true, thresholdDays: 30, warningDays: 7},
          },
          actions: {sendWarning: true, allowAppeal: false},
        },
        testUserId,
      );

      const toggled = await service.togglePolicyStatus(created._id!.toString());
      expect(toggled.isActive).toBe(false);

      console.log(`   ✅ Toggled policy from active to inactive`);
    });
  });

  describe('Delete Policy', () => {
    it('should delete a policy', async () => {
      const created = await service.createPolicy(
        {
          name: 'To Delete',
          scope: 'course',
          courseId: testCourseId,
          isActive: true,
          priority: 100,
          triggers: {
            inactivity: {enabled: true, thresholdDays: 30, warningDays: 7},
          },
          actions: {sendWarning: true, allowAppeal: false},
        },
        testUserId,
      );

      await service.deletePolicy(created._id!.toString());

      await expect(
        service.getPolicyById(created._id!.toString()),
      ).rejects.toThrow('Policy not found');

      console.log(`   ✅ Policy deleted successfully`);
    });

    it('should throw error when deleting non-existent policy', async () => {
      const fakeId = new ObjectId().toString();

      await expect(service.deletePolicy(fakeId)).rejects.toThrow(
        'Policy not found',
      );

      console.log(`   ✅ Correctly rejected deleting non-existent policy`);
    });
  });

  describe('Validation Edge Cases', () => {
    it('should reject negative threshold values', async () => {
      await expect(
        service.createPolicy(
          {
            name: 'Negative Threshold',
            scope: 'platform',
            isActive: true,
            priority: 100,
            triggers: {
              inactivity: {
                enabled: true,
                thresholdDays: -5, // Invalid
                warningDays: 2,
              },
            },
            actions: {sendWarning: true, allowAppeal: false},
          },
          testUserId,
        ),
      ).rejects.toThrow('Inactivity threshold must be greater than 0');

      console.log(`   ✅ Rejected negative threshold`);
    });

    it('should reject policy violations without violation types', async () => {
      await expect(
        service.createPolicy(
          {
            name: 'No Violation Types',
            scope: 'platform',
            isActive: true,
            priority: 100,
            triggers: {
              policyViolations: {
                enabled: true,
                violationTypes: [], // Empty array
                thresholdCount: 2,
              },
            },
            actions: {sendWarning: true, allowAppeal: false},
          },
          testUserId,
        ),
      ).rejects.toThrow('Violation types must be specified');

      console.log(`   ✅ Rejected empty violation types`);
    });
  });
});
