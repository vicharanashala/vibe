import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { CourseRepository } from "../../repositories/CourseRepository";
import { ICourse } from "shared/interfaces/IUser";

describe("CourseRepository", () => {
  let mongoServer: MongoMemoryServer;
  let courseRepository: CourseRepository;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    courseRepository = new CourseRepository();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it("should create a course", async () => {
    const courseData: ICourse = {
      name: "Test Course",
      description: "This is a test course",
      instructors: ["instructor123"],
      versions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const createdCourse = await courseRepository.create(courseData);
    expect(createdCourse).toBeDefined();
    expect(createdCourse?.name).toBe("Test Course");
  });

  it("should read a course by ID", async () => {
    const course = await courseRepository.create({
      name: "Fetch Course",
      description: "Fetching course",
      instructors: ["instructor123"],
      versions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const fetchedCourse = await courseRepository.read(course?._id as string);
    expect(fetchedCourse).toBeDefined();
    expect(fetchedCourse?.name).toBe("Fetch Course");
  });

  it("should update a course", async () => {
    const course = await courseRepository.create({
      name: "Old Course",
      description: "Old description",
      instructors: ["instructor123"],
      versions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const updatedCourse = await courseRepository.update(course?._id as string, {
      name: "Updated Course",
      description: "Updated description",
    });

    expect(updatedCourse).toBeDefined();
    expect(updatedCourse?.name).toBe("Updated Course");
  });
});
