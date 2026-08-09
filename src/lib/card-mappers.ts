export type CardStatRecord = {
  correct: number;
  incorrect: number;
  dueAt: string | null;
  srsIntervalDays: number;
  srsEase: number;
  srsRepetitions: number;
} | null;

export type CardReviewRecord = {
  id: number;
  wasCorrect: boolean;
  reviewedAt: string;
  srsIntervalDays: number;
  srsRepetitions: number;
  dueAt: string | null;
};

export type PersistedCard = {
  id: number;
  front: string;
  back: string;
  category: string;
  stat?: CardStatRecord;
  reviews?: CardReviewRecord[];
};

export type StudyCard = {
  id: number;
  front: string;
  back: string;
  category: string;
  stat?: CardStatRecord;
  reviews?: CardReviewRecord[];
};

export function mapPersistedCards(cards: PersistedCard[]): StudyCard[] {
  return cards.map((card) => ({
    id: card.id,
    front: card.front,
    back: card.back,
    category: card.category,
    stat: card.stat,
    reviews: card.reviews,
  }));
}