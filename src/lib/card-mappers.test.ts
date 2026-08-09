import test from "node:test";
import assert from "node:assert/strict";
import { mapPersistedCards, type PersistedCard } from "@/lib/card-mappers";

test("mapPersistedCards keeps review history entries", () => {
  const input: PersistedCard[] = [
    {
      id: 10,
      front: "Front",
      back: "Back",
      category: "Biology",
      stat: {
        correct: 3,
        incorrect: 1,
        dueAt: "2026-08-10T12:00:00.000Z",
        srsIntervalDays: 2,
        srsEase: 1.3,
        srsRepetitions: 4,
      },
      reviews: [
        {
          id: 101,
          wasCorrect: true,
          reviewedAt: "2026-08-09T12:00:00.000Z",
          srsIntervalDays: 2,
          srsRepetitions: 4,
          dueAt: "2026-08-10T12:00:00.000Z",
        },
      ],
    },
  ];

  const mapped = mapPersistedCards(input);

  assert.equal(mapped.length, 1);
  assert.equal(mapped[0]?.reviews?.length, 1);
  assert.equal(mapped[0]?.reviews?.[0]?.id, 101);
  assert.equal(mapped[0]?.reviews?.[0]?.wasCorrect, true);
  assert.equal(mapped[0]?.reviews?.[0]?.reviewedAt, "2026-08-09T12:00:00.000Z");
});

test("mapPersistedCards preserves cards without review history", () => {
  const input: PersistedCard[] = [
    {
      id: 11,
      front: "Question",
      back: "Answer",
      category: "Math",
      stat: null,
      reviews: [],
    },
  ];

  const mapped = mapPersistedCards(input);

  assert.deepEqual(mapped, input);
});