-- AlterTable
ALTER TABLE "ParticipantSession"
ADD COLUMN "overallRating" INTEGER,
ADD COLUMN "feedbackText" TEXT,
ADD COLUMN "feedbackSubmittedAt" TIMESTAMP(3);
