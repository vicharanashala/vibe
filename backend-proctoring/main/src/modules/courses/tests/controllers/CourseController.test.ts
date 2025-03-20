import request from "supertest";
import { Application } from "express";
import { createExpressServer, useContainer } from "routing-controllers";
import Container from "typedi";
import { CourseController } from "../../controllers/CourseController";
import { CourseService } from "../../services/CourseService";
import { ICourseRepository } from "shared/database/interfaces/ICourseRepository";

// Mock Repository
const mockRepository: Partial<ICourseRepository> = {
  create: jest.fn(),
  read: jest.fn(),
  update: jest.fn(),
};

// Inject Mocks
Container.set("ICourseRepository", mockRepository);
Container.set("ICourseService", new CourseService(mockRepository as ICourseRepository));

let app: Application;

beforeAll(() => {
  useContainer(Container);
  app = createExpressServer({
    controllers: [CourseController],
  });
});

describe("CourseController API", () => {
  it("should create a course", async () => {
    const mockCourse = {
      id: "123",
      name: "Test Course",
      description: "A sample test course",
      instructors: ["user123"],
      versions: [],
    };

    (mockRepository.create as jest.Mock).mockResolvedValue(mockCourse);

    const response = await request(app)
      .post("/courses")
      .send({
        name: "Test Course",
        description: "A sample test course",
        instructors: ["user123"],
      })
      .expect(200);

    expect(response.body.name).toBe("Test Course");
    expect(mockRepository.create).toHaveBeenCalled();
  });

  it("should fetch a course by ID", async () => {
    const mockCourse = {
      id: "123",
      name: "Test Course",
      description: "A sample test course",
      instructors: ["user123"],
      versions: [],
    };

    (mockRepository.read as jest.Mock).mockResolvedValue(mockCourse);

    const response = await request(app).get("/courses/123").expect(200);

    expect(response.body.name).toBe("Test Course");
    expect(mockRepository.read).toHaveBeenCalledWith("123");
  });

  it("should update a course", async () => {
    const updatedCourse = {
      id: "123",
      name: "Updated Course",
      description: "Updated description",
      instructors: ["user123"],
      versions: [],
    };

    (mockRepository.update as jest.Mock).mockResolvedValue(updatedCourse);

    const response = await request(app)
      .patch("/courses/123")
      .send({
        name: "Updated Course",
        description: "Updated description",
      })
      .expect(200);

    expect(response.body.name).toBe("Updated Course");
    expect(mockRepository.update).toHaveBeenCalledWith("123", expect.any(Object));
  });
});
