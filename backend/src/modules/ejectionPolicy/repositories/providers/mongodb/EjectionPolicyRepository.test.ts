import {describe, it, expect, beforeAll, afterAll, beforeEach} from 'vitest';
import {Container} from 'inversify';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {EjectionPolicyRepository} from './EjectionPolicyRepository.js';
import {EjectionPolicy} from '../../../classes/transformers/EjectionPolicy.js';
import {ObjectId} from 'mongodb';
import {GLOBAL_TYPES} from '#root/types.js';
import {EJECTION_POLICY_TYPES} from '../../../types.js';
import {dbConfig} from '#root/config/db.js';

describe('EjectionPolicyRepository', () => {
  let container: Container;
  let database: MongoDatabase;
  let repository: EjectionPolicyRepository;
  let testCourseId: ObjectId;
  let testUserId: ObjectId;

  beforeAll(async () => {
    // Setup DI Container
    container = new Container();

    // Bind database dependencies
    container.bind<string>(GLOBAL_TYPES.uri).toConstantValue(dbConfig.url);
    container
      .bind<string>(GLOBAL_TYPES.dbName)
      .toConstantValue(dbConfig.dbName);
    container
      .bind<MongoDatabase>(GLOBAL_TYPES.Database)
      .to(MongoDatabase)
      .inSingletonScope();

    // Bind repository
    container
      .bind<EjectionPolicyRepository>(EJECTION_POLICY_TYPES.EjectionPolicyRepo)
      .to(EjectionPolicyRepository)
      .inSingletonScope();

    // Get instances
    database = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    repository = container.get<EjectionPolicyRepository>(
      EJECTION_POLICY_TYPES.EjectionPolicyRepo,
    );

    await database.connect();

    // Create test data IDs
    testCourseId = new ObjectId();
    testUserId = new ObjectId();

    console.log('🧪 Test Setup Complete');
    console.log(`   Test Course ID: ${testCourseId.toString()}`);
    console.log(`   Test User ID: ${testUserId.toString()}`);
  });

  afterAll(async () => {
    // Clean up test data
    const collection = await database.getCollection('ejectionPolicies');
    await collection.deleteMany({});
    await database.disconnect();
    console.log('🧹 Test Cleanup Complete');
  });

  describe('Create Policy', () => {
    it('should create a platform-wide policy', async () => {
      const policy = new EjectionPolicy({
        name: 'Platform Inactivity Policy',
        description: 'Removes inactive users platform-wide',
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
          appealDeadlineDays: 7,
        },
        createdBy: testUserId,
      });

      const policyId = await repository.create(policy);

      expect(policyId).toBeDefined();
      expect(ObjectId.isValid(policyId)).toBe(true);

      console.log(`✅ Created platform policy: ${policyId}`);
    });

    it('should create a course-specific policy', async () => {
      const policy = new EjectionPolicy({
        name: 'Course-Specific Deadline Policy',
        description: 'Ejects students who miss multiple deadlines',
        scope: 'course',
        courseId: testCourseId,
        isActive: true,
        priority: 200,
        triggers: {
          missedDeadlines: {
            enabled: true,
            consecutiveMisses: 3,
            warningAfterMisses: 2,
          },
        },
        actions: {
          sendWarning: true,
          allowAppeal: true,
          appealDeadlineDays: 5,
        },
        createdBy: testUserId,
      });

      const policyId = await repository.create(policy);

      expect(policyId).toBeDefined();
      expect(ObjectId.isValid(policyId)).toBe(true);

      console.log(`✅ Created course policy: ${policyId}`);
    });

    it('should create policy with multiple triggers', async () => {
      const policy = new EjectionPolicy({
        name: 'Multi-Trigger Policy',
        description: 'Combines inactivity and violations',
        scope: 'course',
        courseId: testCourseId,
        isActive: true,
        priority: 150,
        triggers: {
          inactivity: {
            enabled: true,
            thresholdDays: 14,
            warningDays: 3,
          },
          policyViolations: {
            enabled: true,
            violationTypes: ['plagiarism', 'code-of-conduct'],
            thresholdCount: 2,
          },
        },
        actions: {
          sendWarning: true,
          allowAppeal: true,
          appealDeadlineDays: 10,
        },
        createdBy: testUserId,
      });

      const policyId = await repository.create(policy);

      expect(policyId).toBeDefined();
      console.log(`✅ Created multi-trigger policy: ${policyId}`);
    });
  });

  describe('Find Policy', () => {
    let createdPolicyId: string;

    beforeEach(async () => {
      const policy = new EjectionPolicy({
        name: 'Find Test Policy',
        scope: 'platform',
        isActive: true,
        priority: 100,
        triggers: {
          inactivity: {enabled: true, thresholdDays: 30, warningDays: 7},
        },
        actions: {sendWarning: true, allowAppeal: true},
        createdBy: testUserId,
      });

      createdPolicyId = await repository.create(policy);
    });

    it('should find policy by ID', async () => {
      const found = await repository.findById(createdPolicyId);

      expect(found).toBeDefined();
      expect(found?.name).toBe('Find Test Policy');
      expect(found?.scope).toBe('platform');
      expect(found?.isActive).toBe(true);
      expect(found?.triggers.inactivity?.enabled).toBe(true);

      console.log(`✅ Found policy by ID: ${found?.name}`);
    });

    it('should return null for non-existent policy', async () => {
      const fakeId = new ObjectId().toString();
      const found = await repository.findById(fakeId);

      expect(found).toBeNull();
      console.log(`✅ Correctly returned null for non-existent policy`);
    });

    it('should return null for deleted policy', async () => {
      // Delete the policy
      await repository.delete(createdPolicyId);

      // Try to find it
      const found = await repository.findById(createdPolicyId);

      expect(found).toBeNull();
      console.log(`✅ Correctly excluded deleted policy`);
    });
  });

  describe('Find Policies with Filters', () => {
    beforeEach(async () => {
      // Create multiple policies for testing filters
      const policies = [
        new EjectionPolicy({
          name: 'Active Platform Policy 1',
          scope: 'platform',
          isActive: true,
          priority: 100,
          triggers: {
            inactivity: {enabled: true, thresholdDays: 30, warningDays: 7},
          },
          actions: {sendWarning: true, allowAppeal: true},
          createdBy: testUserId,
        }),
        new EjectionPolicy({
          name: 'Inactive Platform Policy',
          scope: 'platform',
          isActive: false,
          priority: 50,
          triggers: {
            inactivity: {enabled: true, thresholdDays: 60, warningDays: 14},
          },
          actions: {sendWarning: false, allowAppeal: false},
          createdBy: testUserId,
        }),
        new EjectionPolicy({
          name: 'Active Course Policy',
          scope: 'course',
          courseId: testCourseId,
          isActive: true,
          priority: 200,
          triggers: {
            missedDeadlines: {
              enabled: true,
              consecutiveMisses: 3,
              warningAfterMisses: 2,
            },
          },
          actions: {sendWarning: true, allowAppeal: true},
          createdBy: testUserId,
        }),
      ];

      for (const policy of policies) {
        await repository.create(policy);
      }
    });

    it('should find all active policies', async () => {
      const policies = await repository.find({isActive: true});

      expect(policies.length).toBeGreaterThanOrEqual(2);
      expect(policies.every(p => p.isActive)).toBe(true);

      console.log(`✅ Found ${policies.length} active policies`);
    });

    it('should find policies by scope', async () => {
      const platformPolicies = await repository.find({scope: 'platform'});
      const coursePolicies = await repository.find({scope: 'course'});

      expect(platformPolicies.every(p => p.scope === 'platform')).toBe(true);
      expect(coursePolicies.every(p => p.scope === 'course')).toBe(true);

      console.log(
        `✅ Found ${platformPolicies.length} platform policies, ${coursePolicies.length} course policies`,
      );
    });

    it('should find policies by courseId', async () => {
      const policies = await repository.find({
        scope: 'course',
        courseId: testCourseId.toString(),
      });

      expect(policies.length).toBeGreaterThan(0);
      expect(
        policies.every(p => p.courseId?.toString() === testCourseId.toString()),
      ).toBe(true);

      console.log(
        `✅ Found ${policies.length} policies for course ${testCourseId}`,
      );
    });

    it('should find active platform policies (combined filters)', async () => {
      const policies = await repository.find({
        scope: 'platform',
        isActive: true,
      });

      expect(policies.every(p => p.scope === 'platform' && p.isActive)).toBe(
        true,
      );

      console.log(`✅ Found ${policies.length} active platform policies`);
    });

    it('should sort policies by priority (descending)', async () => {
      const policies = await repository.find({});

      for (let i = 0; i < policies.length - 1; i++) {
        expect(policies[i].priority).toBeGreaterThanOrEqual(
          policies[i + 1].priority,
        );
      }

      console.log(`✅ Policies correctly sorted by priority`);
    });
  });

  describe('Find Active Policies for Course', () => {
    beforeEach(async () => {
      // Create platform and course-specific policies
      await repository.create(
        new EjectionPolicy({
          name: 'Platform Wide',
          scope: 'platform',
          isActive: true,
          priority: 50,
          triggers: {
            inactivity: {enabled: true, thresholdDays: 30, warningDays: 7},
          },
          actions: {sendWarning: true, allowAppeal: true},
          createdBy: testUserId,
        }),
      );

      await repository.create(
        new EjectionPolicy({
          name: 'Course Specific',
          scope: 'course',
          courseId: testCourseId,
          isActive: true,
          priority: 100,
          triggers: {
            missedDeadlines: {
              enabled: true,
              consecutiveMisses: 2,
              warningAfterMisses: 1,
            },
          },
          actions: {sendWarning: true, allowAppeal: true},
          createdBy: testUserId,
        }),
      );

      await repository.create(
        new EjectionPolicy({
          name: 'Inactive Course Policy',
          scope: 'course',
          courseId: testCourseId,
          isActive: false,
          priority: 75,
          triggers: {
            inactivity: {enabled: true, thresholdDays: 10, warningDays: 2},
          },
          actions: {sendWarning: false, allowAppeal: false},
          createdBy: testUserId,
        }),
      );
    });

    it('should find both platform-wide and course-specific active policies', async () => {
      const policies = await repository.findActivePoliciesForCourse(
        testCourseId.toString(),
      );

      expect(policies.length).toBeGreaterThanOrEqual(2);

      const hasPlatformPolicy = policies.some(p => p.scope === 'platform');
      const hasCoursePolicy = policies.some(p => p.scope === 'course');

      expect(hasPlatformPolicy).toBe(true);
      expect(hasCoursePolicy).toBe(true);
      expect(policies.every(p => p.isActive)).toBe(true);

      console.log(
        `✅ Found ${policies.length} active policies for course (platform + course-specific)`,
      );
    });

    it('should exclude inactive policies', async () => {
      const policies = await repository.findActivePoliciesForCourse(
        testCourseId.toString(),
      );

      const hasInactivePolicy = policies.some(p => !p.isActive);
      expect(hasInactivePolicy).toBe(false);

      console.log(`✅ Correctly excluded inactive policies`);
    });
  });

  describe('Check Active Platform Policy', () => {
    it('should return true when active platform policy exists', async () => {
      await repository.create(
        new EjectionPolicy({
          name: 'Active Platform',
          scope: 'platform',
          isActive: true,
          priority: 100,
          triggers: {
            inactivity: {enabled: true, thresholdDays: 30, warningDays: 7},
          },
          actions: {sendWarning: true, allowAppeal: true},
          createdBy: testUserId,
        }),
      );

      const exists = await repository.hasActivePlatformPolicy();
      expect(exists).toBe(true);

      console.log(`✅ Correctly detected active platform policy`);
    });

    it('should return false when only course-specific policies exist', async () => {
      // Clean up any platform policies first
      const collection = await database.getCollection('ejectionPolicies');
      await collection.deleteMany({scope: 'platform'});

      await repository.create(
        new EjectionPolicy({
          name: 'Course Only',
          scope: 'course',
          courseId: testCourseId,
          isActive: true,
          priority: 100,
          triggers: {
            inactivity: {enabled: true, thresholdDays: 30, warningDays: 7},
          },
          actions: {sendWarning: true, allowAppeal: true},
          createdBy: testUserId,
        }),
      );

      const exists = await repository.hasActivePlatformPolicy();
      expect(exists).toBe(false);

      console.log(`✅ Correctly returned false when no platform policy exists`);
    });

    it('should exclude specified policy ID when checking', async () => {
      const policyId = await repository.create(
        new EjectionPolicy({
          name: 'Platform Policy to Exclude',
          scope: 'platform',
          isActive: true,
          priority: 100,
          triggers: {
            inactivity: {enabled: true, thresholdDays: 30, warningDays: 7},
          },
          actions: {sendWarning: true, allowAppeal: true},
          createdBy: testUserId,
        }),
      );

      // Should return false because we're excluding the only platform policy
      const exists = await repository.hasActivePlatformPolicy(policyId);
      expect(exists).toBe(false);

      console.log(`✅ Correctly excluded specified policy from check`);
    });
  });

  describe('Update Policy', () => {
    let policyId: string;

    beforeEach(async () => {
      const policy = new EjectionPolicy({
        name: 'Update Test',
        scope: 'platform',
        isActive: true,
        priority: 100,
        triggers: {
          inactivity: {enabled: true, thresholdDays: 30, warningDays: 7},
        },
        actions: {sendWarning: true, allowAppeal: false},
        createdBy: testUserId,
      });

      policyId = await repository.create(policy);
    });

    it('should update policy name and description', async () => {
      const updated = await repository.update(policyId, {
        name: 'Updated Name',
        description: 'Updated Description',
      });

      expect(updated?.name).toBe('Updated Name');
      expect(updated?.description).toBe('Updated Description');

      console.log(`✅ Updated policy name and description`);
    });

    it('should update policy priority', async () => {
      const updated = await repository.update(policyId, {
        priority: 250,
      });

      expect(updated?.priority).toBe(250);

      console.log(`✅ Updated policy priority to 250`);
    });

    it('should toggle active status', async () => {
      const updated = await repository.update(policyId, {
        isActive: false,
      });

      expect(updated?.isActive).toBe(false);

      console.log(`✅ Toggled policy active status to false`);
    });

    it('should update triggers', async () => {
      const updated = await repository.update(policyId, {
        triggers: {
          inactivity: {
            enabled: true,
            thresholdDays: 60,
            warningDays: 14,
          },
          missedDeadlines: {
            enabled: true,
            consecutiveMisses: 5,
            warningAfterMisses: 3,
          },
        },
      });

      expect(updated?.triggers.inactivity?.thresholdDays).toBe(60);
      expect(updated?.triggers.missedDeadlines?.enabled).toBe(true);

      console.log(`✅ Updated policy triggers`);
    });

    it('should update actions', async () => {
      const updated = await repository.update(policyId, {
        actions: {
          sendWarning: false,
          allowAppeal: true,
          appealDeadlineDays: 14,
        },
      });

      expect(updated?.actions.sendWarning).toBe(false);
      expect(updated?.actions.allowAppeal).toBe(true);
      expect(updated?.actions.appealDeadlineDays).toBe(14);

      console.log(`✅ Updated policy actions`);
    });

    it('should update updatedAt timestamp', async () => {
      const original = await repository.findById(policyId);

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await repository.update(policyId, {priority: 999});

      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        original!.updatedAt.getTime(),
      );

      console.log(`✅ Updated timestamp correctly changed`);
    });

    it('should not update createdAt', async () => {
      const original = await repository.findById(policyId);
      const updated = await repository.update(policyId, {priority: 999});

      expect(updated?.createdAt.getTime()).toBe(original?.createdAt.getTime());

      console.log(`✅ CreatedAt timestamp preserved`);
    });

    it('should return null when updating deleted policy', async () => {
      await repository.delete(policyId);

      const updated = await repository.update(policyId, {
        name: 'Should Not Update',
      });

      expect(updated).toBeNull();

      console.log(`✅ Correctly returned null for deleted policy`);
    });
  });

  describe('Delete Policy (Soft Delete)', () => {
    let policyId: string;

    beforeEach(async () => {
      const policy = new EjectionPolicy({
        name: 'Delete Test',
        scope: 'platform',
        isActive: true,
        priority: 100,
        triggers: {
          inactivity: {enabled: true, thresholdDays: 30, warningDays: 7},
        },
        actions: {sendWarning: true, allowAppeal: false},
        createdBy: testUserId,
      });

      policyId = await repository.create(policy);
    });

    it('should soft delete policy', async () => {
      const deleted = await repository.delete(policyId);
      expect(deleted).toBe(true);

      // Should not be found
      const found = await repository.findById(policyId);
      expect(found).toBeNull();

      console.log(`✅ Policy soft deleted successfully`);
    });

    it('should set isDeleted and deletedAt fields', async () => {
      await repository.delete(policyId);

      // Access the collection directly to see deleted doc
      const collection = await database.getCollection('ejectionPolicies');
      const doc = await collection.findOne({_id: new ObjectId(policyId)});

      expect(doc?.isDeleted).toBe(true);
      expect(doc?.deletedAt).toBeInstanceOf(Date);

      console.log(`✅ isDeleted and deletedAt fields set correctly`);
    });

    it('should exclude deleted policy from queries', async () => {
      await repository.delete(policyId);

      const policies = await repository.find({scope: 'platform'});
      const deletedPolicyInResults = policies.some(
        p => p._id?.toString() === policyId,
      );

      expect(deletedPolicyInResults).toBe(false);

      console.log(`✅ Deleted policy excluded from find queries`);
    });

    it('should return false when deleting already deleted policy', async () => {
      await repository.delete(policyId);
      const secondDelete = await repository.delete(policyId);

      expect(secondDelete).toBe(false);

      console.log(`✅ Correctly returned false for already deleted policy`);
    });

    it('should return false for non-existent policy', async () => {
      const fakeId = new ObjectId().toString();
      const deleted = await repository.delete(fakeId);

      expect(deleted).toBe(false);

      console.log(`✅ Correctly returned false for non-existent policy`);
    });
  });
});
