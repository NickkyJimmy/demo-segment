-- AlterTable
ALTER TABLE "ParticipantSession"
DROP COLUMN "overallRating",
DROP COLUMN "feedbackText",
DROP COLUMN "feedbackSubmittedAt";

-- AlterTable
ALTER TABLE "Response"
ADD COLUMN "q1" INTEGER,
ADD COLUMN "q2" INTEGER,
ADD COLUMN "q3" INTEGER,
ADD COLUMN "q4" INTEGER,
ADD COLUMN "q5" INTEGER,
ADD COLUMN "q6" INTEGER;

-- Backfill existing response rows (if any) from old single rating.
UPDATE "Response"
SET
  "q1" = COALESCE("rating", 3),
  "q2" = COALESCE("rating", 3),
  "q3" = COALESCE("rating", 3),
  "q4" = COALESCE("rating", 3),
  "q5" = COALESCE("rating", 3),
  "q6" = COALESCE("rating", 3);

ALTER TABLE "Response"
ALTER COLUMN "q1" SET NOT NULL,
ALTER COLUMN "q2" SET NOT NULL,
ALTER COLUMN "q3" SET NOT NULL,
ALTER COLUMN "q4" SET NOT NULL,
ALTER COLUMN "q5" SET NOT NULL,
ALTER COLUMN "q6" SET NOT NULL,
DROP COLUMN "rating";
