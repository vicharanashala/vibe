/*
  Warnings:

  - The `answers` column on the `submitSession` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "submitSession" DROP COLUMN "answers",
ADD COLUMN     "answers" TEXT[];

-- CreateTable
CREATE TABLE "TotalProgress" (
    "id" SERIAL NOT NULL,
    "studentId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL,
    "courseInstanceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TotalProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AverageProgress" (
    "id" SERIAL NOT NULL,
    "progress" INTEGER NOT NULL,
    "courseInstanceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AverageProgress_pkey" PRIMARY KEY ("id")
);
