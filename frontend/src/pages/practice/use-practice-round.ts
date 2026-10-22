import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { weakWordsQuery } from '../../queries/weak-words-query';
import { nextSession, readRound, startRound, type PracticeRound } from './practice-round';

export function usePracticeRound(storageKey: string, query: string) {
  const [round, setRound] = useState<PracticeRound | null>(() => {
    try {
      return readRound(storageKey);
    } catch {
      return null;
    }
  });
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    if (!round) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(round));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [round, storageKey]);
  const candidates = useQuery(weakWordsQuery(query));
  const [starting, setStarting] = useState(false);
  const exitRound = () => {
    setRound(null);
    try {
      localStorage.removeItem(storageKey);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  };
  const begin = async () => {
    setStarting(true);
    try {
      const fresh = await candidates.refetch();
      if (!fresh.error) setRound(fresh.data?.words.length ? startRound(fresh.data.words) : null);
      if (!fresh.error && !fresh.data?.words.length) {
        try {
          localStorage.removeItem(storageKey);
        } catch {
          setStorageError(true);
        }
      }
    } finally {
      setStarting(false);
    }
  };
  const update = (patch: Partial<PracticeRound>) =>
    setRound((current) =>
      current && round && current.words === round.words && current.completed === round.completed
        ? { ...current, ...patch }
        : current,
    );
  const finish = () => {
    if (round) update({ completed: round.completed + 1, step: 'finished' });
  };
  const canFinish =
    round?.step === 'read'
      ? !!round.reading
      : round?.step === 'chat' && !!round.chat?.history.some((message) => message.role === 'user');
  const advanceSession = () => setRound((current) => (current ? nextSession(current) : current));
  return {
    round,
    storageError,
    candidates,
    starting,
    exitRound,
    begin,
    update,
    finish,
    canFinish,
    advanceSession,
  };
}
