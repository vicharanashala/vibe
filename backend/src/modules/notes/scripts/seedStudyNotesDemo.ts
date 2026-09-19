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
import { QUIZZES_TYPES } from "../../quizzes/types.js";
import { QuestionService } from "../../quizzes/services/QuestionService.js";
import { QuestionBankService } from "../../quizzes/services/QuestionBankService.js";
import { QuizService } from "../../quizzes/services/QuizService.js";
import { QuestionFactory } from "../../quizzes/classes/transformers/Question.js";
import { QuestionBank } from "../../quizzes/classes/transformers/QuestionBank.js";


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
  console.log(BOLD(" 🌱  Vibe – Study Notes Demo Seed Script"));
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
  const itemsGroupsCol = db.collection("item_groups");
  const sectionStudyNotesCol = db.collection("section_study_notes");

  // ── 3. Lookup or Create Instructor User ──────────────────────────────────────
  let instructorMongoId: string;
  let instructorUser = await usersCol.findOne({ email: INSTRUCTOR_EMAIL });

  if (!instructorUser) {
    log("💡", YELLOW(`Instructor user ${INSTRUCTOR_EMAIL} not found. Creating one...`));
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
    // Wipe Firebase & Mongo student records to re-seed cleanly
    try {
      const fbUser = await auth.getUserByEmail(STUDENT_EMAIL);
      await auth.deleteUser(fbUser.uid);
    } catch {}
    await usersCol.deleteOne({ _id: studentUser._id });
    await enrollmentsCol.deleteMany({ userId: studentUser._id });
  }

  // Create clean Student User
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
  log("✅", GREEN(`Student user seeded cleanly (ID: ${studentMongoId})`));

  // ── 5. Clean up old Study Notes Demo Courses ────────────────────────────────
  const demoCourseName = "Study Notes Demo Course";
  const existingCourses = await coursesCol.find({ name: demoCourseName }).toArray();
  for (const course of existingCourses) {
    const courseIdStr = course._id.toHexString();
    await coursesCol.deleteOne({ _id: course._id });
    await courseVersionsCol.deleteMany({ courseId: course._id });
    await enrollmentsCol.deleteMany({ courseId: courseIdStr });
    await sectionStudyNotesCol.deleteMany({ courseVersionId: { $in: course.versions?.map((v: ObjectId) => v.toHexString()) || [] } });
    log("🗑 ", `Cleaned up existing course database records for course ID: ${courseIdStr}`);
  }

  // Close direct client connection so we don't hold lock during service transactions
  await mongoClient.close();

  // ── 6. Load App Modules to Initialize Inversify Container ───────────────────
  log("⚙️", "Initializing application modules and Inversify services...");
  await loadAppModules("all");
  const container = getContainer();

  const database = container.get<any>(GLOBAL_TYPES.Database);
  await database.connect();

  const courseService = container.get<CourseService>(COURSES_TYPES.CourseService);
  const moduleService = container.get<ModuleService>(COURSES_TYPES.ModuleService);
  const sectionService = container.get<SectionService>(COURSES_TYPES.SectionService);
  const itemService = container.get<ItemService>(COURSES_TYPES.ItemService);
  const enrollmentService = container.get<EnrollmentService>(USERS_TYPES.EnrollmentService);

  const questionService = container.get<QuestionService>(QUIZZES_TYPES.QuestionService);
  const questionBankService = container.get<QuestionBankService>(QUIZZES_TYPES.QuestionBankService);
  const quizService = container.get<QuizService>(QUIZZES_TYPES.QuizService);

  // ── 7. Create Demo Course ──────────────────────────────────────────────────
  log("🚀", "Creating Demo Course structure via CourseService...");
  const coursePayload = new Course();
  coursePayload.name = demoCourseName;
  coursePayload.description = "A dedicated demo course to test instructor-quality section study notes.";

  const createdCourse = await courseService.createCourse(
    coursePayload,
    "v1.0.0",
    "Initial course version with transcription assets",
    instructorMongoId,
    [],
    false,
    100
  );

  const courseId = createdCourse._id!.toString();
  const versionId = createdCourse.versions[0].toString();
  log("✅", GREEN(`Course & Version created (Course: ${courseId}, Version: ${versionId})`));

  // ── 8. Create Module, Section, and Video Items ──────────────────────────────
  log("📖", "Adding Module and Section...");
  const versionWithModule = await moduleService.createModule(versionId, {
    name: "Introduction to Advanced Algorithms",
    description: "Learn about complexity, asymptotic bounds, and basic data structure performance."
  });

  const moduleId = versionWithModule.modules[0].moduleId.toString();

  const versionWithSection = await sectionService.createSection(versionId, moduleId, {
    name: "Divide and Conquer Paradigms",
    description: "Deep dive into merge sort, quick sort, and time complexity analysis."
  });

  const sectionId = versionWithSection.modules[0].sections[0].sectionId.toString();
  log("✅", GREEN(`Module & Section created (Module: ${moduleId}, Section: ${sectionId})`));

  log("🎥", "Adding Video learning items...");
  await itemService.createItem(versionId, moduleId, sectionId, {
    name: "01. Divide and Conquer — General Method",
    description: "Understanding sorting recursively and calculating boundaries.",
    type: ItemType.VIDEO,
    videoDetails: {
      URL: "https://www.youtube.com/watch?v=VJAHv4Fbu6M",
      startTime: "00:00:00",
      endTime: "00:10:00",
      points: 10,
      transcript: TRANSCRIPT_1
    }
  });

  await itemService.createItem(versionId, moduleId, sectionId, {
    name: "02. Merge Sort — Time and Space Complexity",
    description: "Detailed walkthrough of tree recursion, recurrence relation, and space requirements.",
    type: ItemType.VIDEO,
    videoDetails: {
      URL: "https://www.youtube.com/watch?v=x2FcDIUUaLI",
      startTime: "00:00:00",
      endTime: "00:10:00",
      points: 10,
      transcript: TRANSCRIPT_2
    }
  });

  log("✅", GREEN("Video items successfully added to section"));

  // ── 9. Programmatically create 6 MCQ Questions from the Transcripts ───────
  log("❓", "Creating MCQ Questions derived from Video Transcripts...");
  const questionSpecs = [
    // Video 1 Questions
    {
      question: {
        text: "What is the primary solving strategy of the Divide and Conquer algorithm?",
        type: "SELECT_ONE_IN_LOT" as const,
        isParameterized: false,
        hint: "Refer to the initial steps described in the video.",
        timeLimitSeconds: 60,
        priority: "MEDIUM" as const,
        bloomLevel: "understanding" as const,
        source: "INSTRUCTOR" as const,
        reviewStatus: "APPROVED" as const,
      },
      solution: {
        correctLotItem: {
          text: "Divide the problem into subproblems, solve each recursively, and combine their solutions.",
          explaination: "As explained in the video, Divide and Conquer breaks a problem down into smaller subproblems, solves them recursively, and combines the results."
        },
        incorrectLotItems: [
          {
            text: "Iteratively find local optimal solutions to build a global solution.",
            explaination: "This is the greedy strategy, not Divide and Conquer."
          },
          {
            text: "Solve all potential states simultaneously and backtrack upon hitting a dead-end.",
            explaination: "This describes backtracking or search, not Divide and Conquer."
          },
          {
            text: "Transform a problem into a network flow and optimize using linear programming.",
            explaination: "This is dynamic programming or optimization, not Divide and Conquer."
          }
        ]
      }
    },
    {
      question: {
        text: "Under what condition does the Divide and Conquer algorithm solve a problem directly without dividing it further?",
        type: "SELECT_ONE_IN_LOT" as const,
        isParameterized: false,
        hint: "Think about the base case condition.",
        timeLimitSeconds: 60,
        priority: "MEDIUM" as const,
        bloomLevel: "understanding" as const,
        source: "INSTRUCTOR" as const,
        reviewStatus: "APPROVED" as const,
      },
      solution: {
        correctLotItem: {
          text: "When the problem size is very small and cannot be further broken down.",
          explaination: "The video states that if the problem 'P' is small of smaller size, we directly solve it."
        },
        incorrectLotItems: [
          {
            text: "When the recursion stack is completely empty.",
            explaination: "The stack is not empty when a direct solution is reached; it is the base case of recursion."
          },
          {
            text: "When the combine operator is simple addition or multiplication.",
            explaination: "The type of combine operator does not dictate whether division can happen."
          },
          {
            text: "When the problem is of quadratic size.",
            explaination: "Quadratic size is typically large and needs division; only small problems are solved directly."
          }
        ]
      }
    },
    {
      question: {
        text: "Which of the following is NOT listed in the video as an application of the Divide and Conquer algorithm?",
        type: "SELECT_ONE_IN_LOT" as const,
        isParameterized: false,
        hint: "Review the four applications mentioned at the end of the video.",
        timeLimitSeconds: 60,
        priority: "MEDIUM" as const,
        bloomLevel: "knowledge" as const,
        source: "INSTRUCTOR" as const,
        reviewStatus: "APPROVED" as const,
      },
      solution: {
        correctLotItem: {
          text: "Dijkstra's Shortest Path Algorithm",
          explaination: "Dijkstra's is a greedy algorithm, not listed as a divide and conquer application in the video."
        },
        incorrectLotItems: [
          {
            text: "Merge Sort",
            explaination: "Merge Sort is explicitly listed as a divide and conquer application in the video."
          },
          {
            text: "Binary Search",
            explaination: "Binary Search is explicitly listed as a divide and conquer application in the video."
          },
          {
            text: "Strassen's Matrix Multiplication",
            explaination: "Strassen's matrix multiplication is explicitly listed as a divide and conquer application in the video."
          }
        ]
      }
    },
    // Video 2 Questions
    {
      question: {
        text: "In Merge Sort, how are the indices used to divide the main array recursively?",
        type: "SELECT_ONE_IN_LOT" as const,
        isParameterized: false,
        hint: "Think about the calculation of the middle element index.",
        timeLimitSeconds: 60,
        priority: "MEDIUM" as const,
        bloomLevel: "understanding" as const,
        source: "INSTRUCTOR" as const,
        reviewStatus: "APPROVED" as const,
      },
      solution: {
        correctLotItem: {
          text: "By computing the midpoint index as (low + high) / 2.",
          explaination: "The video explains that the midpoint mid is computed using the index values as (low + high) / 2."
        },
        incorrectLotItems: [
          {
            text: "By splitting the array using a pivot element's value.",
            explaination: "Splitting by a pivot is the strategy of Quick Sort, not Merge Sort."
          },
          {
            text: "By scanning for the minimum element index and swapping it.",
            explaination: "This describes Selection Sort, not Merge Sort division."
          },
          {
            text: "By partitioning the elements based on whether they are odd or even.",
            explaination: "Merge Sort divides elements based on index midpoints, not their values."
          }
        ]
      }
    },
    {
      question: {
        text: "What is the time complexity of the Merge Sort algorithm in the best, average, and worst cases?",
        type: "SELECT_ONE_IN_LOT" as const,
        isParameterized: false,
        hint: "The division and merge steps are always identical in structure.",
        timeLimitSeconds: 60,
        priority: "MEDIUM" as const,
        bloomLevel: "understanding" as const,
        source: "INSTRUCTOR" as const,
        reviewStatus: "APPROVED" as const,
      },
      solution: {
        correctLotItem: {
          text: "O(N log N) in all cases",
          explaination: "The video states that the time complexity of Merge Sort is O(N log N) in all cases, including best, average, and worst cases."
        },
        incorrectLotItems: [
          {
            text: "O(N log N) for best case, O(N^2) for average and worst cases",
            explaination: "Merge Sort guarantees O(N log N) in all cases, unlike Quick Sort."
          },
          {
            text: "O(N) for best case, O(N log N) for average and worst cases",
            explaination: "Merge Sort is always O(N log N), even in the best case, because it always divides and merges."
          },
          {
            text: "O(N) in all cases",
            explaination: "Merge Sort requires dividing and merging, which takes O(N log N)."
          }
        ]
      }
    },
    {
      question: {
        text: "Why does Merge Sort require auxiliary space of O(N) during its execution?",
        type: "SELECT_ONE_IN_LOT" as const,
        isParameterized: false,
        hint: "Focus on the needs of the merge function.",
        timeLimitSeconds: 60,
        priority: "MEDIUM" as const,
        bloomLevel: "analysis" as const,
        source: "INSTRUCTOR" as const,
        reviewStatus: "APPROVED" as const,
      },
      solution: {
        correctLotItem: {
          text: "Because a temporary array is needed to hold combined elements before copying them back.",
          explaination: "As discussed in the video, unlike Quick Sort which sorts in place, Merge Sort requires O(N) auxiliary space during the merging step."
        },
        incorrectLotItems: [
          {
            text: "Because of the recursive stack frames stored in call memory.",
            explaination: "Call stack memory is O(log N), not the main O(N) auxiliary space needed for merged elements."
          },
          {
            text: "Because it needs to clone the pivot element for each subdivision.",
            explaination: "Merge Sort does not use a pivot element."
          },
          {
            text: "Because it randomizes the array elements to ensure stability.",
            explaination: "Stability is a property of the sorting, but the O(N) space is for merging elements, not randomization."
          }
        ]
      }
    }
  ];

  const questionIds: string[] = [];
  for (const spec of questionSpecs) {
    const questionObj = QuestionFactory.createQuestion(spec as any, instructorMongoId);
    const createdId = await questionService.create(questionObj);
    questionIds.push(createdId);
  }
  log("✅", GREEN(`${questionIds.length} Questions created successfully`));

  // ── 10. Create Question Bank ───────────────────────────────────────────────
  log("🏦", "Creating Question Bank...");
  const questionBankSpec = new QuestionBank({
    courseId: new ObjectId(courseId),
    courseVersionId: new ObjectId(versionId),
    questions: questionIds.map(id => new ObjectId(id)),
    title: "Divide and Conquer MCQ Bank",
    description: "Strictly authored based on the video transcripts of General Method and Merge Sort.",
    points: 10
  });
  const questionBankId = await questionBankService.create(questionBankSpec);
  log("✅", GREEN(`Question Bank created (ID: ${questionBankId})`));

  // ── 11. Create Quiz Item ──────────────────────────────────────────────────
  log("📝", "Creating Quiz learning item...");
  const quizItem = await itemService.createItem(versionId, moduleId, sectionId, {
    name: "03. Divide and Conquer Paradigms Quiz",
    description: "Complete the quiz to test your understanding and unlock the study notes PDF.",
    type: ItemType.QUIZ,
    quizDetails: {
      passThreshold: 0.7,
      maxAttempts: -1,
      quizType: 'NO_DEADLINE',
      releaseTime: new Date(),
      approximateTimeToComplete: "00:15:00",
      allowPartialGrading: false,
      allowHint: true,
      allowSkip: false,
      showCorrectAnswersAfterSubmission: true,
      showExplanationAfterSubmission: true,
      showScoreAfterSubmission: true,
      questionVisibility: 1
    } as any
  });

  const quizItemId = quizItem.createdItem._id!.toString();
  log("✅", GREEN(`Quiz learning item created (ID: ${quizItemId})`));

  // Link Question Bank to Quiz
  log("🔗", "Linking Question Bank to Quiz...");
  await quizService.addQuestionBank(quizItemId, {
    bankId: questionBankId,
    count: 6
  });
  log("✅", GREEN("Question Bank linked to Quiz successfully"));

  // ── 12. Enroll Student User ──────────────────────────────────────────────────
  log("👥", "Enrolling student user on course version...");
  await enrollmentService.enrollUser(
    studentMongoId,
    courseId,
    versionId,
    "STUDENT"
  );
  log("✅", GREEN("Student enrolled successfully"));

  // ── 13. Generate Copy-pasteable Request Payload ──────────────────────────────
  const sampleTranscripts = [
    {
      videoTitle: "01. Divide and Conquer — General Method",
      transcriptText: TRANSCRIPT_1
    },
    {
      videoTitle: "02. Merge Sort — Time and Space Complexity",
      transcriptText: TRANSCRIPT_2
    }
  ];

  const triggerPayload = {
    courseVersionId: versionId,
    sectionId: sectionId,
    sectionTitle: "Divide and Conquer Paradigms",
    transcripts: sampleTranscripts
  };

  // ── 11. Print CLI Summary ───────────────────────────────────────────────────
  console.log("\n" + BOLD("━".repeat(58)));
  console.log(BOLD(GREEN(" ✔  Study Notes Demo Course seeded successfully!")));
  console.log(BOLD("━".repeat(58)));
  console.log();
  console.log(BOLD("  Login credentials:"));
  console.log(`    Instructor Email : ${GREEN(INSTRUCTOR_EMAIL)}`);
  console.log(`    Student Email    : ${GREEN(STUDENT_EMAIL)}`);
  console.log(`    Password         : ${GREEN(INSTRUCTOR_PASSWORD)}`);
  console.log();
  console.log(BOLD("  Seeded Identifiers:"));
  console.log(`    Course ID        : ${GREEN(courseId)}`);
  console.log(`    Version ID       : ${GREEN(versionId)}`);
  console.log(`    Module ID        : ${GREEN(moduleId)}`);
  console.log(`    Section ID       : ${GREEN(sectionId)}`);
  console.log();
  console.log(BOLD("  Copy-Pasteable Postman/curl Request Payload:"));
  console.log(DIM(JSON.stringify(triggerPayload, null, 2)));
  console.log();
  console.log(BOLD("━".repeat(58)) + "\n");
}

run().catch((err) => {
  console.error(RED("\n  ✖  Unexpected error during seeding:"), err);
  process.exit(1);
});

const TRANSCRIPT_1 = `hello everyone welcome back to my YouTube channel trouble free in today's video I'm going to explain you about divide and conquer algorithm in the subject of design and Analysis of algorithms so basically in this video we will learn what is design and divide and concur algorithm the working algorithm and then what are the applications of divide and conquer so basically the name itself says divide and conquer one of the algorithms or it is one of the algorithm solving strategy in algorithm solving strategies we have different like we have greedy method we have branch and bound we have divide and conquer we have so many methods backtracking so among all those methods divide and conquer is one of them so it is one of the algorithm solving method as I already said here what we will do is we will divide a bigger problem into number of sub problems okay then we will solve each sub problem we will be solving each sub problem and then we will combine all the solutions together so all these Solutions are combined so first what we will do we are dividing the problem we are dividing a bigger problem into smaller parts and then we are solving them and then again we are combining all those solutions to obtain the final solution so here is the picture like it will be more clear for you you are you are dividing a bigger problem P into P1 P2 and so on up to p n okay and then you are finding solution for each of them for P1 S1 for P2 S2 like that you are finding solution for each and every problem and then you are combining all these problems into the final solution now so what is the solution for the problem P the solution is s but did you get S directly no first you divided P into number of sub paths then you solve for each subpart of p and then you combine all the solutions to get the final solution s okay so this is all about divided and Conquer now let us try to understand write this algorithm in your exam so first you have to apply divide and conquer of p d a c is nothing but divide and conquer of P that means you are passing a problem into divide and conquer algorithm next if we have conditions here if p is very small if suppose p is very small you cannot further break it right for example you have an expression like this 2 plus 3 plus 3 minus 1 into 4 plus 8 something like that you have an expression like this okay in this case it has multiple paths first you have to add 2 and 3 you have to subtract 3 and 1 you have to add 4 and 8 then you have to combine all these so this is an example of divide and conquer instead of this purpose you have only 2 plus 3 then can you further divide it no right you can just add it simply so if p is very small then you can directly write the solution for p okay if p is small of smaller size then you can directly do the solution for p if it is not a smaller one then what you have to do you have to divide P into number of sub Problems P 1 p 2 p 3 and so on up to p n in this case we are dividing it into four sub parts P one p two P three okay and then you are applying divide and conquer on P1 divide and conquer on P1 in the sense again from starting if it is smaller then you will solve it directly again inside this also if you have still more bigger sub problem then you can divide it further okay so now you are solving It 2 plus 3 is 5 3 minus 1 is 2 4 plus 8 is 12. okay you solved it and last you have to combine it so you have to combine DAC of P1 is nothing but what S1 okay this is S1 this is S2 this is SN so you are combining all these outputs so what is a combining operator in between this plus and here we have multiplication you can simply do that okay so this is about dividing conquer algorithm if it is very if the problem which you have taken is very small you can directly find the solution if it is bigger you can divide it into number of sub problems and then apply divide and conquer algorithm on each of the sub problem and then combine all the solutions okay now let us see what are the applications we have four applications bind research quick sort merge sort and stress matrix multiplication so we will be learning about each of them in the next coming videos in the next video you'll learn about my research then I'll explain you about quick sort then merge sort and okay so yeah this is all about this video guys thanks for watching the video till the end if you're still having any doubts let know in the comment section so let's meet up in the next coming video with another topic thank you`;

const TRANSCRIPT_2 = `hello everyone welcome back to my YouTube channel trouble free in today's video I'm going to explain you about merge sort in the subject of design and Analysis of algorithms so in this video we will learn what is merge sort with a numerical example the concept of merge sort and the algorithm for merge sort along with the time complexity of the merge sort algorithm Okay so let's get into the video you already know that merge sort is an application of divide and conquer algorithm so you know how divide and conquer works right you will be dividing an array into number of sub arrays and then you will be performing operations on that sub arrays so here in merge sort also we'll do the same process we will first divide the given array into number of sub arrays and then we will merge those sub arrays into a new array again and that array will be in a sorted manner okay it will be in a sorted way so this is about merge sort so now we have an example array with the help of this array we are going to see how the merge sort algorithm will work the basic concept is it is an application of divide and conquer that means you'll be dividing the sub array into number of sorry you'll be dividing the main array into number of sub arrays and then you will sort them and merge them okay so let's do the division process now let me show you the algorithm for merge sort first so this is your merge sort algorithm merge sort of a is the array low low means the first position okay so this is low and high means the last position if low is less than high you are doing mid mid is equal to low plus High by 2 and then again you are performing merge sort from a to low load I mean low from low to mid again from mid plus 1 to high your performing merge sort again that is recursively you are performing merge sort as long as the value of low is less than high you will be performing these steps recursively and then you will be calling the merge function so for this merge function we have a algorithm and that algorithm is the important that algorithm is the heart of this merge sort concept okay I will explain you that algorithm also first let us see how we are dividing the array okay here what is our condition to divide the array if low is less than high yes low is less than high your low is 0 and your high value is eight yeah so low is less than high now mid is equal to low plus High by 2. low plus High by 2 means 0 Plus 8 by 2 don't get confused here we are not using a of low and a of high that means we are not using the elements we are using the indexes only directly okay so mid is equal to low plus High by two so what is the value of low it is 0 and what is the value of high it is 8 0 Plus 8 by 2 how much you will get you will get 4 that means you are doing merge sort now so here what you are doing merge sort of array a from low to mid that is you will do merge sort from a from low to mid right what is mid 4 and then the other merge sort will be a mid plus 1 to high mid plus 1 is 5 and what is high eight that means you are dividing the array so let's divide this array a 0 to 4 is the first array right so 15 5 24 8 1 so this is one array and for this you will get from 5 to 8 that is 3 16 and 20 in the other array now our next step is to again divide the array you have to recursively keep on dividing the array okay so let's take the indexes so I have written the respective indexes you can take the same indexes as it is from the question itself and this will become low this will become high this will become low this will become high for your now let us divide these sub arrays further so what you have to do mid is equal to low plus High by 2 what is low 0 what is High 4 by 2 that is equal to 2 and here mid is equal to 5 Plus 8 divided by 2 13 by 2 you will get 6.5 you can download it off to 6 okay that means now what your merge sort will become merge sort of low to mid is first and mid plus 1 to high is the second one right so what is low here a of 0 comma till mid is one array and a of mid plus 1 3 comma 4 is one more array here also same low to mid is one array and mid plus one to high is one array that means 5 comma 6 you will get in one array and 7 comma 8 you will get in one array low to mid mid plus one to high okay now let us do the sub array for this again for this we are doing the sub array 0 to 2 means fifteen 5 24 right next the other array will be eight and one here also five and six in one array so it will be three and then 16 7 and eight in one area 10 and then 20. now you have to still further divide it so this is 0 1 2 low plus High by 2 0 plus 2 by 2 that means how much you will get you will get mid as 1 mid as 1 means how do you divide this lower and mid in one so that means fifteen and five will come into one array 24 alone will come into one array and these since there are only two elements you can directly split them 8 and 1 3 and 16 and 10 and 20 okay now what you have to do is every all the elements became single elements except this array so let us divide this also so 15 and then 5 done we are done with dividing the array into number of sub arrays now our task is to merge these arrays okay we have to start merging these arrays now let's start merging so you merge 15 and 5 now okay first so while merging whichever element is the lowest element you place it first okay among 5 and 15 which is lower 5 is lower so the array will be in this way 5 and 15 okay now you are going to join this 24. okay on joining 24 what you will get 5 15 and 24 you have to sort the elements in the order only okay so whatever order is whichever is greater you have to sort them you have to combine them in that order basically so now you're going to sort these both things so how do you sort these both things which is lower one so one comes first and then 8 comes okay now you are going to merge these two arrays so when you're merging these two arrays you have to write all the elements in the order so what is the order first one and then 5 and then 8 and then 15 and then 24 okay now this is done let us keep it aside for time being let us come back here now you're going to merge these two so these two in the order it will be 3 and 16 okay now if you merge these two it is going to be 10 and 20. the same now we are going to merge these two things when you are merging these two what will happen see you have to write it in the order right so which element is lowest among all these four 3 so 3 comes first Then followed by 10 Then followed by 16 Then followed by 20. okay so now this is one sub array and this is one sub array let us consider this as the left sub array okay let us consider this as left sub array and let us consider this as right sub array let us represent each element of left sub array with I and write sub array with J now you have to merge these two arrays how we are going to merge I'll show you okay let me write these two sub arrays in a separate paper and come back quickly and then let's start merging the array using the merge algorithm okay after that I will show you the code for the merge algorithm so that you will understand it more better okay now so we have our left sub array we have our right sub array and we have a new empty array which is B and we are representing each element of B with K and this is going to be your sorted array okay so by using the merge sort algorithm merge algorithm you are going to merge these two arrays into the this single array okay let us see how that is going to work first what you have to do is you have to compare L of i and r of J okay so whichever is greater whichever is smaller that will go into the array the array B okay that means you have to compare L of i and r of J that is you have to compare first element of left array and first element of right array you are comparing 1 and 3 which is greater among one and three sorry which is smaller among one and three 1 so you are placing 1 into your sorted sub array okay and you are considering it as k got it slow now since you have placed the element of the left sub array into the sorted array you are going to increment the I that means you are going to do I plus plus okay that means I is going to come here now okay now I the L of I value is 5 okay next now again compare L of I and R of J L of i and r of J which is smaller that will go into the array B right among these both which is smaller 3 is smaller so 3 is smaller you are incrementing K also here okay now you have Place 3 since you placed the element from right sub array now you are going to do J plus plus okay J plus plus means this J will come here okay and you will do K plus plus also okay next why K plus plus you can forget about K for time being because K is little confusing because we have I and J both K we needed to understand the algorithm to write the algorithm we need okay otherwise we don't need K now again compare L of i and r of J what is L of I now 5 and what is r of J 10 among 5 and 10 which is smaller 5 so you are placing 5 into your sorted array so which so you have placed element from which array you placed it from the left array so you have to increment the value from the left array okay now again compare L of i and r of J which is greater among both of them sorry which is smaller among both of them 8 so you are placing 8 into your sorted array so again you are going to do I plus plus now compare L of i and r of J 15 and 10 which is smaller 10 so you are going to place 10 into the sorted array so since you have placed the element from this array you are going to increment J so it is going to become J plus plus okay next again compare L of i and r of J so what is L of I 15 and R of J is 16. 15 is lesser or 16 is lesser 15 so Place 15 into the array now again update I you have updated I so now again compare L of i and r of J 24 and 16 which is lesser 16 so Place 16 into the array next update J so you have updated J so now L of i and r of J 24 and 20 which is lesser 20 so Place 20 into the array got it now you don't have anything to increment it so you can stop it at this point the list J is completed that list I mean the list R is completed so now what is remaining just 24 is remaining right so you can place the 24 directly into the sorted array okay so this is going to be your new sorted array so how we sorted this by using the merge algorithm now I will show you the merge algorithm how it works okay so first merge a low mid high that is your merging low mid High values in the array a so initially I is equal to low and J is equal to Mid plus 1 okay next while I is less than or equal to Mid and J is less than or equal to high that means you are comparing if I is less than or equal to Mid and J is less than or equal to high so I is equal to low yeah I is equal to low the lowest element and then J is equal to Mid plus 1 so what is the mid value of this array 4 right 0 Plus 8 divided by 2. so the mid value is 4 and your starting J at Mid plus one so mid plus 1 is 5 4 plus 1 5 so you are starting J at Mid while I is less than or equal to Mid 0 is less than or equal to 4 and J is less than or equal to 8 5 is less than or equal to 8 that means if if I is becoming greater than mid that is if I is crossing this we are not this algorithm this Loop is not valid okay and if J is crossing this value then this Loop is not valid okay so here if a of I is less than or equal to a of J that is what we are doing right we are comparing a of I and a of J so if a of I is less than or equal to a of J then we are placing this a of J into this sorted array B and then we are incrementing I and we are incrementing K if not else means what here if a of I is greater than a of J that means if a of J value is less than a of I okay then what we are doing we are placing the element from this right sub array into this ordered list right so you are placing the element from the right sub array that is from J into this ordered list and you are incrementing J you are incrementing K okay done so long as this condition is satisfied this Loop can be executed for example if I is greater than mid that is if I reach at the end of the loop and it became greater than mid then what you will do if there are any remaining elements from J you will place those remaining elements into the sorted array and if there if J has reached to the end of the array you will check for I and if there are any remaining elements in I you will place them into this ordered array right so we are doing the same story here if I is greater than mid you are checking if there are any elements present in J if yes you are placing those elements into this ordered array you are incrementing J and you are incrementing K okay and in case if J is greater than high then what you are doing that is if J has reached the end of the array then you are checking if there are any elements in the left sub list and if there are any elements you are placing those elements into the sorted array and you are incrementing I and K okay so this is about this merge function this is about this merge algorithm`;

