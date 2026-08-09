-- CreateTable
CREATE TABLE "CardReview" (
    "id" SERIAL NOT NULL,
    "cardId" INTEGER NOT NULL,
    "wasCorrect" BOOLEAN NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "srsIntervalDays" INTEGER NOT NULL DEFAULT 0,
    "srsRepetitions" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3),

    CONSTRAINT "CardReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardReview_cardId_reviewedAt_idx" ON "CardReview"("cardId", "reviewedAt");

-- CreateIndex
CREATE INDEX "CardReview_reviewedAt_idx" ON "CardReview"("reviewedAt");

-- AddForeignKey
ALTER TABLE "CardReview" ADD CONSTRAINT "CardReview_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
