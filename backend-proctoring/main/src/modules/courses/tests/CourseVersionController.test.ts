import { coursesModuleOptions } from "modules/courses";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  RoutingControllersOptions,
  useExpressServer,
} from "routing-controllers";
import { CourseRepository } from "shared/database/providers/mongo/repositories/CourseRepository";
import { MongoDatabase } from "shared/database/providers/MongoDatabaseProvider";
import Container from "typedi";
import Express from "express";
import request from "supertest";
import { ReadError } from "shared/errors/errors";

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

  describe("Course Version Controller Integration Tests", () => {
    // Create course version
    describe("COURSE VERSION CREATION", () => {
      describe("Success Scenario", () => {
        it("should create a course version", async () => {
          // Create course
          const coursePayload = {
            name: "New Course",
            description: "Course description",
          };

          const response = await request(app)
            .post("/courses/")
            .send(coursePayload)
            .expect(200);

          // Get id
          const courseId = response.body._id;

          // Create course version
          const courseVersionPayload = {
            version: "New Course Version",
            description: "Course version description",
          };

          // log the endpoint to request to
          const endPoint = `/courses/${courseId}/versions`;
          const versionResponse = await request(app)
            .post(endPoint)
            .send(courseVersionPayload)
            .expect(200);

          // Check if the response is correct

          expect(versionResponse.body.course._id).toBe(courseId);
          expect(versionResponse.body.version.version).toBe(
            "New Course Version"
          );
          expect(versionResponse.body.version.description).toBe(
            "Course version description"
          );

          //expect the version id to be in the list of course, this is shared in response
          expect(versionResponse.body.course.versions).toContain(
            versionResponse.body.version._id
          );
        });
      });

      describe("Error Scenarios", () => {
        it("should return 404 if course not found", async () => {
          // Create course version
          const courseVersionPayload = {
            version: "New Course Version",
            description: "Course version description",
          };

          // log the endpoint to request to
          const endPoint = `/courses/123/versions`;
          const versionResponse = await request(app)
            .post(endPoint)
            .send(courseVersionPayload)
            .expect(404);

          // expect(versionResponse.body.message).toContain("Course not found");
        });

        it("should return 400 if invalid course version data", async () => {
          // Create course
          const coursePayload = {
            name: "New Course",
            description: "Course description",
          };

          const response = await request(app)
            .post("/courses/")
            .send(coursePayload)
            .expect(200);

          // Get id
          const courseId = response.body._id;

          // Create course version
          const courseVersionPayload = {
            version: "New Course Version",
            description: "Course version description",
          };

          // log the endpoint to request to
          const endPoint = `/courses/${courseId}/versions`;
          const versionResponse = await request(app)
            .post(endPoint)
            .send({ version: "" })
            .expect(400);

          expect(versionResponse.body.message).toContain(
            "Invalid body, check 'errors' property for more info."
          );

          // expect(versionResponse.body.message).toContain("Invalid course version data");
        });

        it("should return 400 if no course version data", async () => {
          // Create course
          const coursePayload = {
            name: "New Course",
            description: "Course description",
          };

          const response = await request(app)
            .post("/courses/")
            .send(coursePayload)
            .expect(200);

          // Get id
          const courseId = response.body._id;

          // log the endpoint to request to
          const endPoint = `/courses/${courseId}/versions`;
          const versionResponse = await request(app)
            .post(endPoint)
            .send({})
            .expect(400);

          expect(versionResponse.body.message).toContain(
            "Invalid body, check 'errors' property for more info."
          );

          // expect(versionResponse.body.message).toContain("Invalid course version data");
        });
      });
    });

    // Read course version
    describe("COURSE VERSION READ", () => {
      describe("Success Scenario", () => {
        it("should read a course version", async () => {
          // Create course
          const coursePayload = {
            name: "New Course",
            description: "Course description",
          };

          const response = await request(app)
            .post("/courses/")
            .send(coursePayload)
            .expect(200);

          // Get id
          const courseId = response.body._id;

          // Create course version
          const courseVersionPayload = {
            version: "New Course Version",
            description: "Course version description",
          };

          // log the endpoint to request to
          const endPoint = `/courses/${courseId}/versions`;
          const versionResponse = await request(app)
            .post(endPoint)
            .send(courseVersionPayload)
            .expect(200);

          // Get version id
          const versionId = versionResponse.body.version._id;

          // log the endpoint to request to
          const endPoint2 = `/courses/versions/${versionId}`;
          const readResponse = await request(app).get(endPoint2).expect(200);

          expect(readResponse.body.version).toBe("New Course Version");
          expect(readResponse.body.description).toBe(
            "Course version description"
          );
        });
      });

      describe("Error Scenarios", () => {
        it("should return 404 if course version not found", async () => {
          // random mongoid

          let id = "5f9b1b3c9d1f1f1f1f1f1f1f";

          const endPoint2 = `/courses/versions/${id}`;
          const readResponse = await request(app).get(endPoint2).expect(404);

          // expect(readResponse.body.message).toContain("Course version not found");
        });

        // it should return 500, if the database throws ReadError

        it("should return 500 if database throws ReadError", async () => {

          // Create course

          const coursePayload = {
            name: "New Course",
            description: "Course description",
          };

          const response = await request(app)
            .post("/courses/")
            .send(coursePayload)
            .expect(200);

          // Get id

          const courseId = response.body._id;

          // Create course version

          const courseVersionPayload = {
            version: "New Course Version",
            description: "Course version description",
          };

          // log the endpoint to request to

          const endPoint = `/courses/${courseId}/versions`;

          const versionResponse = await request(app)
            .post(endPoint)
            .send(courseVersionPayload)
            .expect(200);

          // Get version id

          const versionId = versionResponse.body.version._id;

          // log the endpoint to request to


          // Mock the database to throw ReadError

          const courseRepo = Container.get<CourseRepository>("NewCourseRepo");

          jest.spyOn(courseRepo, "readVersion").mockImplementationOnce(() => {
            throw new ReadError("Mocked error from another test");
          });
          const endPoint2 = `/courses/versions/${versionId}`;
          const readResponse = await request(app).get(endPoint2).expect(500);

        }
        );  

      });
    });
  });
});
