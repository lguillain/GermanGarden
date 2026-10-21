import type { Chat, Word } from '../../api';
import type { ReadingResult } from './practice-activities';

export interface PracticeWord extends Word {
  practice_reasons: { track: 'recognition' | 'production'; reason: string }[];
}
export interface PracticeRound {
  version: 1;
  words: PracticeWord[];
  completed: number;
  step: 'meet' | 'flashcards' | 'choose' | 'chat' | 'read' | 'finished';
  cardIndex: number;
  direction: 'recognition' | 'production';
  revealed: boolean;
  chat: Chat | null;
  draft: string;
  reading: ReadingResult | null;
}
export const sessionCount = (words: number) => Math.ceil(words / 5);
export function startRound(words: PracticeWord[]): PracticeRound {
  return {
    version: 1,
    words,
    completed: 0,
    step: 'meet',
    cardIndex: 0,
    direction: 'recognition',
    revealed: false,
    chat: null,
    draft: '',
    reading: null,
  };
}
export function nextSession(round: PracticeRound): PracticeRound {
  return { ...startRound(round.words), completed: round.completed };
}
export function readRound(key: string): PracticeRound | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const value = JSON.parse(raw) as PracticeRound;
  if (
    value.version !== 1 ||
    !Array.isArray(value.words) ||
    !value.words.length ||
    !value.words.every(
      (word) =>
        typeof word.id === 'string' &&
        typeof word.lemma === 'string' &&
        typeof word.english === 'string' &&
        Array.isArray(word.practice_reasons),
    ) ||
    new Set(value.words.map((word) => word.id)).size !== value.words.length ||
    !Number.isInteger(value.completed) ||
    value.completed < 0 ||
    value.completed > sessionCount(value.words.length) ||
    !['meet', 'flashcards', 'choose', 'chat', 'read', 'finished'].includes(value.step) ||
    !Number.isInteger(value.cardIndex) ||
    value.cardIndex < 0 ||
    value.cardIndex > 4 ||
    !['recognition', 'production'].includes(value.direction) ||
    typeof value.revealed !== 'boolean' ||
    typeof value.draft !== 'string' ||
    (value.chat !== null &&
      (!value.chat || !Array.isArray(value.chat.history) || !Array.isArray(value.chat.targets))) ||
    (value.reading !== null && (!value.reading?.text || typeof value.reading.text.de !== 'string'))
  )
    return null;
  return value;
}
