export interface Word {
  id: string;
  lemma: string;
  article?: string | null;
  plural?: string | null;
  pos: string;
  english: string;
  level: string;
}
export interface Activity {
  id: string;
  name: string;
  description?: string;
}
export interface Sentence {
  id: number;
  word_id: string;
  activity_id: string | null;
  text: string;
  english: string;
}
export interface Catalog {
  words: Word[];
  activities: Activity[];
  word_activities: { word_id: string; activity_id: string; relevance: number }[];
  sentences: Sentence[];
}
export type ReviewTrack = 'recognition' | 'production';
export interface Srs {
  production?: Srs | null;
  ease: number;
  interval_days: number;
  reps: number;
  lapses: number;
  state: string;
  due_at?: string;
  last_grade?: number;
  last_review_at?: string;
}
export interface Swipe {
  word_id: string;
  activity_id: string | null;
  sentence_id: number | null;
  action: 'keep' | 'drop';
  drop_reason?: string | null;
  swiped_at: string;
  planted_at: string | null;
}
export interface ReviewSelection {
  topic_exists: boolean;
  vocabulary_available: boolean;
  selected: {
    word: Word;
    swipe: Swipe;
    srs: Srs | null;
    sentence: Sentence | null;
    activity: Activity | null;
  } | null;
  remaining: number;
  counts: { plants: number; seeds: number };
}
export interface Learner {
  seen_ids?: string[]; // Compact discovery snapshots retain only IDs for past decisions.
  user: {
    name: string;
    level: string | null;
    swipe_count: number;
    drop_streak: number;
    cards_in_bucket: number;
    current_topic: string | null;
    affinity_below: number;
    affinity_above: number;
    level_bias: number;
  };
  swipes: Swipe[];
  known: string[];
  learned: string[];
  srs: Record<string, Srs>;
  reviews: { word_id: string; grade: number; reviewed_at: string; track?: ReviewTrack }[];
  weights: Record<string, number>;
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireThat(condition: unknown, message: string, status = 422): asserts condition {
  if (!condition) throw new HttpError(status, message);
}
export function freshLearner(name: string): Learner {
  return {
    user: {
      name,
      level: null,
      swipe_count: 0,
      drop_streak: 0,
      cards_in_bucket: 0,
      current_topic: null,
      affinity_below: 1,
      affinity_above: 1,
      level_bias: 0,
    },
    swipes: [],
    known: [],
    learned: [],
    srs: {},
    reviews: [],
    weights: {},
  };
}
export function shuffle<T>(items: T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
