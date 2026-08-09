import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { parsePositiveInt, readJsonObject } from "@/lib/api-validation";
import { getPrisma } from "@/lib/prisma";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const GROWTH_MULTIPLIER = 1.3;
const FIXED_INTERVALS_MS = [1 * HOUR_MS, 6 * HOUR_MS, 1 * DAY_MS, 2 * DAY_MS];

function addMs(base: Date, ms: number) {
  return new Date(base.getTime() + ms);
}

export async function POST(request: Request) {
  try {
    const prisma = getPrisma();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await readJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const cardId = parsePositiveInt(body.cardId);
    const correct = body.correct;

    if (cardId === null) {
      return NextResponse.json({ error: "Invalid card id." }, { status: 400 });
    }

    if (typeof correct !== "boolean") {
      return NextResponse.json({ error: "Field 'correct' must be a boolean." }, { status: 400 });
    }

    const card = await prisma.card.findFirst({
      where: { id: cardId, userId: user.id },
      select: { id: true },
    });
    if (!card) {
      return NextResponse.json({ error: "Card not found." }, { status: 404 });
    }

    const now = new Date();
    const existing = await prisma.cardStat.findUnique({ where: { cardId } });

    let srsIntervalDays = existing?.srsIntervalDays ?? 0;
    let srsEase = existing?.srsEase ?? GROWTH_MULTIPLIER;
    let srsRepetitions = existing?.srsRepetitions ?? 0;
    let dueAt: Date | null = existing?.dueAt ?? null;

    if (correct) {
      srsRepetitions += 1;

      let nextIntervalMs: number;
      if (srsRepetitions <= FIXED_INTERVALS_MS.length) {
        nextIntervalMs = FIXED_INTERVALS_MS[srsRepetitions - 1]!;
      } else {
        const previousIntervalMs =
          existing?.dueAt && existing?.lastReviewedAt
            ? Math.max(HOUR_MS, existing.dueAt.getTime() - existing.lastReviewedAt.getTime())
            : Math.max(HOUR_MS, srsIntervalDays * DAY_MS);

        nextIntervalMs = Math.round(previousIntervalMs * GROWTH_MULTIPLIER);
      }

      srsEase = GROWTH_MULTIPLIER;
      srsIntervalDays = Math.floor(nextIntervalMs / DAY_MS);
      dueAt = addMs(now, nextIntervalMs);
    } else {
      const resetIntervalMs = FIXED_INTERVALS_MS[0];
      srsRepetitions = 0;
      srsIntervalDays = Math.floor(resetIntervalMs / DAY_MS);
      srsEase = GROWTH_MULTIPLIER;
      dueAt = addMs(now, resetIntervalMs);
    }

    const { stat, review } = await prisma.$transaction(async (tx) => {
      const updatedStat = await tx.cardStat.upsert({
        where: { cardId },
        create: {
          cardId,
          correct: correct ? 1 : 0,
          incorrect: correct ? 0 : 1,
          lastReviewedAt: now,
          srsIntervalDays,
          srsEase,
          srsRepetitions,
          dueAt,
        },
        update: {
          correct: { increment: correct ? 1 : 0 },
          incorrect: { increment: correct ? 0 : 1 },
          lastReviewedAt: now,
          srsIntervalDays,
          srsEase,
          srsRepetitions,
          dueAt,
        },
      });

      const reviewEntry = await tx.cardReview.create({
        data: {
          cardId,
          wasCorrect: correct,
          reviewedAt: now,
          srsIntervalDays,
          srsRepetitions,
          dueAt,
        },
      });

      return { stat: updatedStat, review: reviewEntry };
    });

    return NextResponse.json({ stat, review });
  } catch {
    return NextResponse.json({ error: "Unable to record study result." }, { status: 500 });
  }
}
