import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import Express from "express";
import { useExpressServer } from "routing-controllers";
import { Container } from "typedi";
import { MongoDatabase } from "../../../../shared/database/providers/mongo/MongoDatabase";
import { CourseRepository } from "../../../../shared/database/providers/mongo/repositories/CourseRepository";
import { coursesModuleOptions } from "../../../../modules/courses";
import { CreateCourseVersionPayloadValidator } from "modules/courses/classes/validators/CourseVersionPayloadValidators";
import { CreateCoursePayloadValidator } from "modules/courses/classes/validators/CoursePayloadValidators";

describe("Course Controller Integration Tests", () => {
  let App = Express();
  let app;
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    // Start an in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Set up the real MongoDatabase and CourseRepository
    Container.set("Database", new MongoDatabase(mongoUri, "vibe"));
    const courseRepo = new CourseRepository(
      Container.get<MongoDatabase>("Database")
    );
    Container.set("NewCourseRepo", courseRepo);

    // Create the Express app with the routing controllers configuration
    app = useExpressServer(App, coursesModuleOptions);
  });

  afterAll(async () => {
    // Close the in-memory MongoDB server after the tests
    await mongoServer.stop();
  });

  // ------Tests for Create Course------
  describe("Course Creation", () => {
    describe("Success Scenario", () => {
      it("should create a course", async () => {
        const coursePayload = {
          name: "New Course",
          description: "Course description",
        };

        const response = await request(app)
          .post("/courses/")
          .send(coursePayload)
          .expect(200);

        expect(response.body.name).toBe("New Course");
        expect(response.body.description).toBe("Course description");
        expect(response.body._id).toBeDefined();
      });
    });

    describe("Errors Scenarios", () => {
      it("should return 500 if unkown error occurs", async () => {
        const coursePayload = {
          name: "New Course",
          description: "Course description",
        };

        // Mock the create method to throw an error
        const courseRepo = Container.get<CourseRepository>("NewCourseRepo");
        jest.spyOn(courseRepo, "create").mockImplementationOnce(() => {
          throw new Error("Mocked error");
        });

        const response = await request(app)
          .post("/courses/")
          .send(coursePayload)
          .expect(500);

        // expect(response.body.message).toContain("Mocked error");
      });

      it("should return 400 for invalid course data", async () => {
        const invalidPayload = { name: "" }; // Missing required fields

        const response = await request(app)
          .post("/courses/")
          .send(invalidPayload)
          .expect(400);

        expect(response.body.message).toContain(
          "Invalid body, check 'errors' property for more info."
        );
      });
    });
  });

  // ------Tests for Read Course------
  describe("Course Retrieval", () => {
    describe("Success Scenario", () => {
      it("should read a course by ID", async () => {
        // First, create a course
        const coursePayload = {
          name: "Existing Course",
          description: "Course description",
        };

        const createdCourseResponse = await request(app)
          .post("/courses/")
          .send(coursePayload)
          .expect(200);

        const courseId = createdCourseResponse.body._id;

        // Now, read the course by its ID
        const response = await request(app)
          .get(`/courses/${courseId}`)
          .expect(200);

        expect(response.body.name).toBe("Existing Course");
        expect(response.body.description).toBe("Course description");
        expect(response.body._id).toBe(courseId);
      });
    });

    describe("Error Scenarios", () => {
      it("should return 404 for a non-existing course", async () => {
        const response = await request(app)
          .get("/courses/67dd98f025dd87ebf638851c")
          .expect(404);
      });
    });
  });

  // ------Tests for Update Course------
  describe("Course Updation", () => {
    describe("Success Scenario", () => {
      it("should update a course by ID", async () => {
        // First, create a course
        const coursePayload = {
          name: "Existing Course",
          description: "Course description",
        };

        const createdCourseResponse = await request(app)
          .post("/courses/")
          .send(coursePayload)
          .expect(200);

        const courseId = createdCourseResponse.body._id;

        // Now, update the course by its ID
        const updatedCoursePayload = {
          name: "Updated Course",
          description: "Updated course description",
        };

        const response = await request(app)
          .put(`/courses/${courseId}`)
          .send(updatedCoursePayload)
          .expect(200);

        expect(response.body.name).toBe("Updated Course");
        expect(response.body.description).toBe("Updated course description");
        expect(response.body._id).toBe(courseId);

        // Check if the course was actually updated
        const readResponse = await request(app)
          .get(`/courses/${courseId}`)
          .expect(200);

        expect(readResponse.body.name).toBe("Updated Course");
        expect(readResponse.body.description).toBe(
          "Updated course description"
        );
      });
    });
  });
});
