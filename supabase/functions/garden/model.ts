export interface Word { id: string; lemma: string; article?: string | null; plural?: string | null; pos: string; english: string; level: string }
export interface Activity { id: string; name: string; description?: string }
export interface Sentence { id: number; word_id: string; activity_id: string | null; text: string; english: string }
export interface Catalog { words: Word[]; activities: Activity[]; word_activities: { word_id: string; activity_id: string; relevance: number }[]; sentences: Sentence[] }
export interface Srs { ease: number; interval_days: number; reps: number; lapses: number; state: string; due_at?: string; last_grade?: number; last_review_at?: string }
export interface Swipe { word_id: string; activity_id: string | null; sentence_id: number | null; action: 'keep' | 'drop'; drop_reason?: string | null; swiped_at: string; planted_at: string | null }
export interface Learner {
  user: { name: string; level: string | null; swipe_count: number; drop_streak: number; cards_in_bucket: number; current_topic: string | null; affinity_below: number; affinity_above: number; level_bias: number };
  swipes: Swipe[]; known: string[]; learned: string[]; srs: Record<string, Srs>;
  reviews: { word_id: string; grade: number; reviewed_at: string }[];
  sessions: { started_at: string; last_beat_at: string; seconds: number }[];
  weights: Record<string, number>;
}
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function requireThat(condition: unknown, message: string, status = 422): asserts condition { if (!condition) throw new HttpError(status, message); }
export function freshLearner(name: string): Learner {
  return { user: { name, level: null, swipe_count: 0, drop_streak: 0, cards_in_bucket: 0, current_topic: null, affinity_below: 1, affinity_above: 1, level_bias: 0 }, swipes: [], known: [], learned: [], srs: {}, reviews: [], sessions: [], weights: {} };
}
export const initialSrs = (): Srs => ({ ease: 2.5, interval_days: 0, reps: 0, lapses: 0, state: 'learning' });
export function growth(srs: Partial<Srs> = {}, learned = false) {
  if (learned || srs.state === 'graduated' || (srs.interval_days || 0) >= 45) return 5;
  if ((srs.interval_days || 0) >= 21) return 4;
  if ((srs.interval_days || 0) >= 7) return 3;
  if ((srs.reps || 0) >= 2) return 2;
  return (srs.reps || 0) >= 1 ? 1 : 0;
}
export function reviewOutcome(previous: Srs, grade: number): Srs {
  requireThat(Number.isInteger(grade) && grade >= 1 && grade <= 4, 'Choose a rating from 1 to 4.');
  let { ease, interval_days: interval, reps, lapses, state } = previous;
  if (grade === 1) { state = state === 'review' ? 'relearning' : 'learning'; reps = 0; lapses++; ease = Math.max(1.3, ease - .2); interval = 1 / 1440; }
  else if (state === 'learning' || state === 'relearning') {
    if (grade === 2) interval = 10 / 1440;
    else { interval = grade === 3 ? 1 : 4; state = 'review'; reps++; }
  } else {
    reps++;
    if (grade === 2) { ease = Math.max(1.3, ease - .15); interval = Math.max(1, interval * 1.2); }
    else if (grade === 3) interval = Math.max(1, interval * ease);
    else { ease += .15; interval = Math.max(1, interval * ease * 1.3); }
  }
  if (state === 'review' && interval >= 60) state = 'graduated';
  return { ease, interval_days: interval, reps, lapses, state };
}
export function shuffle<T>(items: T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
