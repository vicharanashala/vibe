import {MongoMemoryServer} from 'mongodb-memory-server';
import {Container} from 'typedi';
import {ObjectId} from 'mongodb';

// Import the actual repository and database classes
import {MongoDatabase} from 'shared/database/providers/mongo/MongoDatabase';
import {ProgressRepository} from 'shared/database/providers/mongo/repositories/ProgressRepository';
import {IProgress} from 'shared/interfaces/Models';
import {setupUsersModuleDependencies} from 'modules/users';

describe('ProgressRepository Unit Tests', () => {
  let mongoServer: MongoMemoryServer;
  let progressRepository: ProgressRepository;
  let testProgress: IProgress;

  // Mock data
  const userId = 'user123';
  const courseId = new ObjectId().toString();
  const courseVersionId = new ObjectId().toString();

  beforeAll(async () => {
    // Start an in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    // Set up the real MongoDatabase and Repository
    Container.set('Database', new MongoDatabase(uri, 'vibe'));
    setupUsersModuleDependencies();
  });

  afterAll(async () => {
    // Stop the in-memory MongoDB server
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear collections before each test
    const db = Container.get(MongoDatabase);
    const progressCollection = await db.getCollection<IProgress>('progress');
    await progressCollection.deleteMany({});

    // Create a test progress record for use in tests
    testProgress = {
      _id: new ObjectId(),
      userId: userId,
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
      currentModule: new ObjectId(),
      currentSection: new ObjectId(),
      currentItem: new ObjectId(),
      completed: false,
    };

    // Insert test progress record
    await progressCollection.insertOne(testProgress);
  });

  // Tests for findProgress method
  describe('findProgress', () => {
    it('should find a progress record by user, course, and version IDs', async () => {
      const result = await progressRepository.findProgress(
        userId,
        courseId,
        courseVersionId,
      );

      expect(result).toBeTruthy();
      expect(result?.userId).toBe(userId);
      expect(result?.courseId.toString()).toBe(courseId);
      expect(result?.courseVersionId.toString()).toBe(courseVersionId);
    });

    it('should return null if no matching progress record exists', async () => {
      const nonExistentCourseId = new ObjectId().toString();

      const result = await progressRepository.findProgress(
        userId,
        nonExistentCourseId,
        courseVersionId,
      );

      expect(result).toBeNull();
    });
  });

  // Tests for findById method
  describe('findById', () => {
    it('should find a progress record by its ID', async () => {
      const progressId = testProgress._id.toString();

      const result = await progressRepository.findById(progressId);

      expect(result).toBeTruthy();
      expect(result?._id.toString()).toBe(progressId);
    });

    it('should return null if no matching progress ID exists', async () => {
      const nonExistentId = new ObjectId().toString();

      const result = await progressRepository.findById(nonExistentId);

      expect(result).toBeNull();
    });

    it('should throw an error if the ID format is invalid', async () => {
      await expect(progressRepository.findById('invalid-id')).rejects.toThrow();
    });
  });

  // Tests for updateProgress method
  describe('updateProgress', () => {
    it('should update an existing progress record', async () => {
      const updateData = {
        currentModule: new ObjectId(),
        cnurrentSection: new ObjectId(),
        currentItem: new ObjectId(),
        completed: true,
      };

      const result = await progressRepository.updateProgress(
        userId,
        courseId,
        courseVersionId,
        updateData,
      );

      expect(result).toBeTruthy();
      expect(result?.currentModule).toBe(2);
      expect(result?.currentSection).toBe(3);
      expect(result?.currentItem).toBe(4);
      expect(result?.completed).toBe(true);
    });

    it('should throw an error if no matching progress record exists', async () => {
      const nonExistentCourseId = new ObjectId().toString();

      await expect(
        progressRepository.updateProgress(
          userId,
          nonExistentCourseId,
          courseVersionId,
          {currentModule: new ObjectId()},
        ),
      ).rejects.toThrow();
    });
  });

  // Tests for createProgress method
  describe('createProgress', () => {
    it('should create a new progress record', async () => {
      const newProgress: IProgress = {
        userId: 'newuser',
        courseId: new ObjectId(),
        courseVersionId: new ObjectId(),
        currentModule: new ObjectId(),
        currentSection: new ObjectId(),
        currentItem: new ObjectId(),
        completed: false,
      };

      const result = await progressRepository.createProgress(newProgress);

      expect(result).toBeTruthy();
      expect(result._id).toBeDefined();
      expect(result.userId).toBe('newuser');
      expect(result.currentModule).toBe(1);
    });

    it('should throw an error if insertion fails', async () => {
      // Creating an invalid object to cause an insertion error
      const invalidProgress = {} as IProgress;

      await expect(
        progressRepository.createProgress(invalidProgress),
      ).rejects.toThrow();
    });
  });
});
