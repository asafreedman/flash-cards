-- AlterTable
ALTER TABLE "CardStat" ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "srsEase" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
ADD COLUMN     "srsIntervalDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "srsRepetitions" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "CardStat_dueAt_idx" ON "CardStat"("dueAt");
