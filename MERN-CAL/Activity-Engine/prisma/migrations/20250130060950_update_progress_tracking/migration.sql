-- CreateEnum
CREATE TYPE "ProgressEnum" AS ENUM ('IN_PROGRESS', 'INCOMPLETE', 'COMPLETE');

-- CreateEnum
CREATE TYPE "ContentTypeEnum" AS ENUM ('VIDEO', 'ARTICLE', 'ASSESSMENT');

-- CreateEnum
CREATE TYPE "ViolationTypeEnum" AS ENUM ('MULTIPLE_PEOPLE_DETECTED', 'BLURRY_IMAGE', 'SPEAKING_DETECTED', 'INACTIVE_USER', 'INVALID_FACE_DETECTED', 'OUT_OF_FRAME', 'NOT_FOCUSED');

-- CreateEnum
CREATE TYPE "AssessmentStatusEnum" AS ENUM ('PENDING', 'GRADED', 'FAILED', 'PASSED');

-- CreateEnum
CREATE TYPE "AssessmentAttemptStatusEnum" AS ENUM ('IN_PROGRESS', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "LoginSession" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "access_token" TEXT NOT NULL,
    "expires_in" INTEGER NOT NULL,

    CONSTRAINT "LoginSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attemptSession" (
    "id" SERIAL NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "courseInstanceId" TEXT NOT NULL,
    "studentId" INTEGER NOT NULL,

    CONSTRAINT "attemptSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submitSession" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "attemptId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "answers" TEXT NOT NULL,
    "isAnswerCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submitSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCourseProgress" (
    "studentId" TEXT NOT NULL,
    "courseInstanceId" TEXT NOT NULL,
    "progress" "ProgressEnum" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentCourseProgress_pkey" PRIMARY KEY ("studentId","courseInstanceId")
);

-- CreateTable
CREATE TABLE "StudentModuleProgress" (
    "studentId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "courseInstanceId" TEXT NOT NULL,
    "progress" "ProgressEnum" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentModuleProgress_pkey" PRIMARY KEY ("studentId","moduleId","courseInstanceId")
);

-- CreateTable
CREATE TABLE "StudentSectionProgress" (
    "studentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "courseInstanceId" TEXT NOT NULL,
    "progress" "ProgressEnum" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentSectionProgress_pkey" PRIMARY KEY ("studentId","sectionId","courseInstanceId")
);

-- CreateTable
CREATE TABLE "StudentSectionItemProgress" (
    "studentId" TEXT NOT NULL,
    "sectionItemId" TEXT NOT NULL,
    "courseInstanceId" TEXT NOT NULL,
    "progress" "ProgressEnum" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentSectionItemProgress_pkey" PRIMARY KEY ("studentId","sectionItemId","courseInstanceId")
);

-- CreateTable
CREATE TABLE "ModuleNext" (
    "moduleId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "nextModuleId" TEXT,
    "courseInstanceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleNext_pkey" PRIMARY KEY ("moduleId")
);

-- CreateTable
CREATE TABLE "SectionNext" (
    "sectionId" TEXT NOT NULL,
    "sectionItemId" TEXT NOT NULL,
    "nextSectionId" TEXT,
    "moduleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectionNext_pkey" PRIMARY KEY ("sectionId")
);

-- CreateTable
CREATE TABLE "SectionItemNext" (
    "sectionItemId" TEXT NOT NULL,
    "nextSectionItemId" TEXT,
    "sectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectionItemNext_pkey" PRIMARY KEY ("sectionItemId")
);

-- CreateTable
CREATE TABLE "StudentAssessmentProgress" (
    "id" SERIAL NOT NULL,
    "studentId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "courseInstanceId" TEXT NOT NULL,
    "assessmentStatus" "AssessmentStatusEnum" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAssessmentProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAssessmentAttemptSummary" (
    "studentId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "courseInstanceId" TEXT NOT NULL,
    "latestAttemptId" INTEGER NOT NULL,
    "attemptCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAssessmentAttemptSummary_pkey" PRIMARY KEY ("studentId","assessmentId","courseInstanceId")
);

-- CreateIndex
CREATE INDEX "LoginSession_user_id_idx" ON "LoginSession"("user_id");

-- CreateIndex
CREATE INDEX "LoginSession_access_token_idx" ON "LoginSession"("access_token");

-- CreateIndex
CREATE INDEX "attemptSession_assessmentId_idx" ON "attemptSession"("assessmentId");

-- CreateIndex
CREATE INDEX "attemptSession_studentId_idx" ON "attemptSession"("studentId");

-- CreateIndex
CREATE INDEX "submitSession_studentId_idx" ON "submitSession"("studentId");

-- CreateIndex
CREATE INDEX "submitSession_assessmentId_idx" ON "submitSession"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAssessmentProgress_studentId_assessmentId_courseInst_key" ON "StudentAssessmentProgress"("studentId", "assessmentId", "courseInstanceId");
