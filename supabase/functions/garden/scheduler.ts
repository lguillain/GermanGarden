import { requireThat, type Srs } from './model.ts';

// Pure learning rules. No HTTP, persistence, clock reads, or state mutation.
const RATING = { again: 1, hard: 2, good: 3, easy: 4 } as const;
export const REVIEW_GRADES = [RATING.again, RATING.hard, RATING.good, RATING.easy];

export const initialSrs = (): Srs => ({
  ease: 2.5,
  interval_days: 0,
  reps: 0,
  lapses: 0,
  state: 'learning',
});
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
  // A lapse always schedules a one-minute retry.
  if (grade === RATING.again) {
    state = state === 'review' ? 'relearning' : 'learning';
    reps = 0;
    lapses++;
    ease = Math.max(1.3, ease - 0.2);
    interval = 1 / 1440;
  }
  // Learning/relearning uses fixed steps before entering spaced review.
  else if (state === 'learning' || state === 'relearning') {
    if (grade === RATING.hard) interval = 10 / 1440;
    else {
      interval = grade === RATING.good ? 1 : 4;
      state = 'review';
      reps++;
    }
  } else {
    reps++;
    if (grade === RATING.hard) {
      ease = Math.max(1.3, ease - 0.15);
      interval = Math.max(1, interval * 1.2);
    } else if (grade === RATING.good) interval = Math.max(1, interval * ease);
    else {
      ease += 0.15;
      interval = Math.max(1, interval * ease * 1.3);
    }
  }
  if (state === 'review' && interval >= 60) state = 'graduated';
  return { ease, interval_days: interval, reps, lapses, state };
}
