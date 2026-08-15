import "dotenv/config";
import "reflect-metadata";
import admin from "firebase-admin";
import { MongoClient, ObjectId } from "mongodb";
import { loadAppModules, getContainer } from "../../../bootstrap/loadModules.js";
import { GLOBAL_TYPES } from "../../../types.js";
import { USERS_TYPES } from "../../users/types.js";
import { COURSES_TYPES } from "../../courses/types.js";
import { CourseService } from "../../courses/services/CourseService.js";
import { ModuleService } from "../../courses/services/ModuleService.js";
import { SectionService } from "../../courses/services/SectionService.js";
import { ItemService } from "../../courses/services/ItemService.js";
import { EnrollmentService } from "../../users/services/EnrollmentService.js";
import { Course } from "../../courses/classes/transformers/Course.js";
import { ItemType } from "../../../shared/index.js";
import { STUDY_NOTES_TYPES } from "../types/studyNotesTypes.js";
import { StudyNotesService } from "../services/StudyNotesService.js";

// ─── Configuration ────────────────────────────────────────────────────────────

const INSTRUCTOR_EMAIL = process.env.SEED_EMAIL ?? "test@example.com";
const INSTRUCTOR_PASSWORD = process.env.SEED_PASSWORD ?? "Test@1234!";

const STUDENT_EMAIL = "student@example.com";
const STUDENT_PASSWORD = "Test@1234!";

const MONGO_URI = process.env.DB_URL ?? "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME ?? "vibe";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "vibe-36f8c";
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL ?? "";
const FIREBASE_PRIVATE_KEY = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
const FIREBASE_AUTH_EMULATOR = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";

const GREEN = (s: string) => `\x1b[32m${s}\x1b[0m`;
const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`;
const RED = (s: string) => `\x1b[31m${s}\x1b[0m`;
const BOLD = (s: string) => `\x1b[1m${s}\x1b[0m`;
const DIM = (s: string) => `\x1b[2m${s}\x1b[0m`;

function log(icon: string, msg: string) {
  console.log(`  ${icon}  ${msg}`);
}

async function run() {
  console.log("\n" + BOLD("━".repeat(58)));
  console.log(BOLD(" 🐍  Vibe – FastAPI & Pydantic Study Notes Course Seed"));
  console.log(BOLD("━".repeat(58)));
  console.log(DIM(`  Firebase Emulator : ${FIREBASE_AUTH_EMULATOR}`));
  console.log(DIM(`  MongoDB           : ${MONGO_URI} / ${DB_NAME}`));
  console.log(DIM(`  Instructor        : ${INSTRUCTOR_EMAIL}`));
  console.log(DIM(`  Student           : ${STUDENT_EMAIL}`));
  console.log();

  // ── 1. Initialise Firebase Admin SDK ────────────────────────────────────────
  process.env.FIREBASE_AUTH_EMULATOR_HOST = FIREBASE_AUTH_EMULATOR;

  const credential =
    FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY
      ? admin.credential.cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey: FIREBASE_PRIVATE_KEY,
        })
      : admin.credential.applicationDefault();

  if (!admin.apps.length) {
    admin.initializeApp({ credential, projectId: FIREBASE_PROJECT_ID });
  }

  const auth = admin.auth();

  // ── 2. MongoDB Client for Pre-clean & User Setup ────────────────────────────
  const mongoClient = new MongoClient(MONGO_URI);
  try {
    await mongoClient.connect();
  } catch (err: any) {
    console.error(RED(`\n  ✖  Cannot connect to MongoDB: ${err?.message ?? err}`));
    process.exit(1);
  }

  const db = mongoClient.db(DB_NAME);
  const usersCol = db.collection("users");
  const coursesCol = db.collection("courses");
  const courseVersionsCol = db.collection("course_versions");
  const enrollmentsCol = db.collection("enrollments");
  const sectionStudyNotesCol = db.collection("section_study_notes");

  // ── 3. Lookup or Create Instructor User ──────────────────────────────────────
  let instructorMongoId: string;
  let instructorUser = await usersCol.findOne({ email: INSTRUCTOR_EMAIL });

  if (!instructorUser) {
    log("💡", YELLOW(`Instructor user ${INSTRUCTOR_EMAIL} not found. Creating...`));
    let firebaseUid: string;
    try {
      const fbUser = await auth.getUserByEmail(INSTRUCTOR_EMAIL);
      firebaseUid = fbUser.uid;
    } catch {
      const fbUser = await auth.createUser({
        email: INSTRUCTOR_EMAIL,
        password: INSTRUCTOR_PASSWORD,
        emailVerified: true,
        displayName: "Demo Instructor",
      });
      firebaseUid = fbUser.uid;
    }

    const now = new Date();
    const newInstructorDoc = {
      _id: new ObjectId(),
      firebaseUID: firebaseUid,
      email: INSTRUCTOR_EMAIL,
      firstName: "Demo",
      lastName: "Instructor",
      roles: "admin",
      createdAt: now,
      updatedAt: now,
    };
    await usersCol.insertOne(newInstructorDoc);
    instructorMongoId = newInstructorDoc._id.toHexString();
    log("✅", GREEN(`Instructor created in DB (ID: ${instructorMongoId})`));
  } else {
    instructorMongoId = instructorUser._id.toHexString();
    log("✓", `Instructor user found in DB (ID: ${instructorMongoId})`);
  }

  // ── 4. Ensure Student User Exists ───────────────────────────────────────────
  let studentMongoId: string;
  let studentUser = await usersCol.findOne({ email: STUDENT_EMAIL });

  if (studentUser) {
    studentMongoId = studentUser._id.toHexString();
  } else {
    const fbStudent = await auth.createUser({
      email: STUDENT_EMAIL,
      password: STUDENT_PASSWORD,
      emailVerified: true,
      displayName: "Demo Student",
    });

    const now = new Date();
    const newStudentDoc = {
      _id: new ObjectId(),
      firebaseUID: fbStudent.uid,
      email: STUDENT_EMAIL,
      firstName: "Demo",
      lastName: "Student",
      roles: "user",
      createdAt: now,
      updatedAt: now,
    };
    await usersCol.insertOne(newStudentDoc);
    studentMongoId = newStudentDoc._id.toHexString();
    log("✅", GREEN(`Student user created (ID: ${studentMongoId})`));
  }

  // ── 5. Clean up existing FastAPI course if re-running ─────────────────────
  const demoCourseName = "FastAPI & Pydantic Masterclass";
  const existingCourses = await coursesCol.find({ name: demoCourseName }).toArray();
  for (const course of existingCourses) {
    const courseIdStr = course._id.toHexString();
    await coursesCol.deleteOne({ _id: course._id });
    await courseVersionsCol.deleteMany({ courseId: course._id });
    await enrollmentsCol.deleteMany({ courseId: courseIdStr });
    await sectionStudyNotesCol.deleteMany({ courseVersionId: { $in: course.versions?.map((v: ObjectId) => v.toHexString()) || [] } });
    log("🗑 ", `Cleaned up existing course database records for course ID: ${courseIdStr}`);
  }

  // Close direct mongo client connection before initializing container services
  await mongoClient.close();

  // ── 6. Initialize Container & Load Services ─────────────────────────────
  log("⚙️", "Initializing application container & services...");
  const { controllers } = await loadAppModules("all");
  const container = getContainer();

  const database = container.get<any>(GLOBAL_TYPES.Database);
  await database.connect();

  const courseService = container.get<CourseService>(COURSES_TYPES.CourseService);
  const moduleService = container.get<ModuleService>(COURSES_TYPES.ModuleService);
  const sectionService = container.get<SectionService>(COURSES_TYPES.SectionService);
  const itemService = container.get<ItemService>(COURSES_TYPES.ItemService);
  const enrollmentService = container.get<EnrollmentService>(USERS_TYPES.EnrollmentService);
  const studyNotesService = container.get<StudyNotesService>(STUDY_NOTES_TYPES.StudyNotesService);

  // ── 7. Create Course ──────────────────────────────────────────────────────
  log("🚀", "Creating 'FastAPI & Pydantic Masterclass' Course...");
  const coursePayload = new Course();
  coursePayload.name = demoCourseName;
  coursePayload.description = "Master modern Python web APIs with FastAPI, Pydantic data validation schemas, and automated OpenAPI documentation.";

  const createdCourse = await courseService.createCourse(
    coursePayload,
    "v1.0.0",
    "Initial release with Pydantic Models & Data Validation tutorial",
    instructorMongoId,
    [],
    false,
    100
  );

  const courseId = createdCourse._id!.toString();
  const versionId = createdCourse.versions[0].toString();
  log("✅", GREEN(`Course & Version created (Course ID: ${courseId}, Version ID: ${versionId})`));

  // ── 8. Create Module & Section ────────────────────────────────────────────
  log("📖", "Creating Module & Section...");
  const versionWithModule = await moduleService.createModule(versionId, {
    name: "Module 1: Data Validation & Schemas in FastAPI",
    description: "Deep dive into Pydantic models, request body parsing, type hints, and nested schemas."
  });
  const moduleId = versionWithModule.modules[0].moduleId.toString();

  const versionWithSection = await sectionService.createSection(versionId, moduleId, {
    name: "Pydantic Models and Schema Validation",
    description: "Learn how FastAPI leverages Pydantic for request body validation, response serialization, and automatic docs."
  });
  const sectionId = versionWithSection.modules[0].sections[0].sectionId.toString();
  log("✅", GREEN(`Module & Section created (Module ID: ${moduleId}, Section ID: ${sectionId})`));

  // ── 9. Add Video Item with YouTube URL ────────────────────────────────────
  log("🎥", "Adding Video item (https://www.youtube.com/watch?v=9BnXuIGRyxw&t=2s)...");
  const videoItem = await itemService.createItem(versionId, moduleId, sectionId, {
    name: "FastAPI Tutorial #7 | Pydantic Models + Data Validation + Nested Schemas",
    description: "Learn how to define Pydantic BaseModel schemas, declare request body parameters, apply Field validation constraints, and structure nested JSON schemas in FastAPI.",
    type: ItemType.VIDEO,
    videoDetails: {
      URL: "https://www.youtube.com/watch?v=9BnXuIGRyxw&t=2s",
      startTime: "00:00:00",
      endTime: "00:15:00",
      points: 10,
      transcript: FASTAPI_TRANSCRIPT,
    }
  });

  const itemId = videoItem.createdItem._id!.toString();
  log("✅", GREEN(`Video item created (Item ID: ${itemId})`));

  // ── 10. Enroll Student User ───────────────────────────────────────────────
  log("👥", "Enrolling student user on course version...");
  await enrollmentService.enrollUser(
    studentMongoId,
    courseId,
    versionId,
    "STUDENT"
  );
  log("✅", GREEN("Student enrolled successfully"));

  // ── 11. Generate Study Notes via StudyNotesService ────────────────────────
  log("🤖", "Triggering Study Notes Generation via AI Service...");
  const transcripts = [
    {
      videoTitle: "FastAPI Tutorial #7 | Pydantic Models + Data Validation + Nested Schemas",
      transcriptText: FASTAPI_TRANSCRIPT,
    }
  ];

  const notesStart = Date.now();
  await studyNotesService.generateSectionNotes(
    versionId,
    sectionId,
    "Pydantic Models and Schema Validation",
    transcripts
  );
  const durationSec = ((Date.now() - notesStart) / 1000).toFixed(2);
  log("⏱", GREEN(`Study notes generated in ${durationSec}s`));

  // Verify resulting document in database
  const noteDoc = await studyNotesService.getSectionNotes(versionId, sectionId);

  // ── 12. Print Summary ─────────────────────────────────────────────────────
  console.log("\n" + BOLD("━".repeat(58)));
  console.log(BOLD(GREEN(" ✔  New Course & Study Notes seeded successfully!")));
  console.log(BOLD("━".repeat(58)));
  console.log();
  console.log(BOLD("  Course & Video Details:"));
  console.log(`    Course Name      : ${GREEN(demoCourseName)}`);
  console.log(`    YouTube Video URL: ${GREEN("https://www.youtube.com/watch?v=9BnXuIGRyxw&t=2s")}`);
  console.log(`    Course ID        : ${GREEN(courseId)}`);
  console.log(`    Version ID       : ${GREEN(versionId)}`);
  console.log(`    Module ID        : ${GREEN(moduleId)}`);
  console.log(`    Section ID       : ${GREEN(sectionId)}`);
  console.log(`    Video Item ID    : ${GREEN(itemId)}`);
  console.log();
  console.log(BOLD("  Study Notes Status:"));
  console.log(`    Status           : ${GREEN(noteDoc?.status || 'unknown')}`);
  console.log(`    Generated At     : ${noteDoc?.generatedAt}`);
  console.log(`    Markdown Length  : ${noteDoc?.contentMarkdown?.length} characters`);
  console.log();
  console.log(BOLD("  Markdown Preview (first 400 chars):"));
  console.log(DIM(noteDoc?.contentMarkdown?.slice(0, 400) + "..."));
  console.log();
  console.log(BOLD("  Login Credentials to test in UI:"));
  console.log(`    Student Email    : ${GREEN(STUDENT_EMAIL)}`);
  console.log(`    Instructor Email : ${GREEN(INSTRUCTOR_EMAIL)}`);
  console.log(`    Password         : ${GREEN(STUDENT_PASSWORD)}`);
  console.log();
  console.log(BOLD("━".repeat(58)) + "\n");

  process.exit(0);
}

run().catch((err) => {
  console.error(RED("\n  ✖  Error seeding FastAPI course:"), err);
  process.exit(1);
});

const FASTAPI_TRANSCRIPT = `Welcome back to Mohit Decodes! In FastAPI Tutorial #7, we are covering Pydantic Models, Data Validation, and Nested Schemas in FastAPI.

FastAPI is a modern, high-performance web framework for building APIs with Python 3.8+ based on standard Python type hints. Two key technologies power FastAPI under the hood: Starlette for web routing and performance, and Pydantic for data validation, parsing, and schema definition.

1. Introduction to Pydantic:
Pydantic is a data validation and settings management library using Python type annotations. When client HTTP requests arrive with JSON request bodies, FastAPI parses and validates them against Pydantic models automatically.

To define a schema, import BaseModel from pydantic:

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List

class Item(BaseModel):
    name: str
    description: Optional[str] = None
    price: float = Field(gt=0, description="Price must be strictly positive")
    tax: Optional[float] = None
    tags: List[str] = []

2. Request Body Validation:
In FastAPI, to receive a JSON request body, declare a parameter in your path operation function with the type annotation of your Pydantic model:

from fastapi import FastAPI

app = FastAPI()

@app.post("/items/")
async def create_item(item: Item):
    return {"message": "Item created successfully", "item": item}

When a request arrives at POST /items/, FastAPI:
- Reads the JSON body from the HTTP request stream.
- Converts JSON types into Python native types (for example, string numbers to floats).
- Validates field constraints (e.g. price > 0).
- If validation passes, injects the populated Item instance into your function.
- If validation fails, automatically returns an HTTP 422 Unprocessable Entity error with detailed field error locations.
- Automatically generates OpenAPI (Swagger UI) documentation at /docs.

3. Advanced Field Constraints:
Pydantic's Field function allows specifying metadata and validation rules:
- Numeric constraints: gt (greater than), ge (greater/equal), lt (less than), le (less/equal).
- String constraints: min_length, max_length, pattern (regular expression matching).
- Example: username: str = Field(min_length=3, max_length=20, pattern="^[a-zA-Z0-9_]+$")

4. Nested Schemas & Complex Data Models:
Pydantic models can be nested inside other Pydantic models as field types:

class Image(BaseModel):
    url: str
    name: str

class Product(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    images: List[Image]

When receiving a POST request for Product, FastAPI will validate both the top-level product fields and every Image object inside the images list recursively. If any nested field is invalid, FastAPI provides precise JSON path pointers in the HTTP 422 error response.

5. Response Models & Serialization:
You can also use Pydantic models as response models to format and filter outgoing API responses:

class UserIn(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserOut(BaseModel):
    username: str
    email: EmailStr

@app.post("/users/", response_model=UserOut)
async def create_user(user: UserIn):
    # Password will be automatically filtered out from JSON response!
    return user

In summary, Pydantic models provide runtime type checking, data coercion, custom validation, and automatic Swagger documentation in FastAPI applications.`;
