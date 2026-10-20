import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Session } from '../api';
import { api } from '../api';
import { ErrorNotice, Heading } from '../components/feedback';

export function SetupPage({ session }: { session: Session }) {
  const cache = useQueryClient();
  const [level, setLevel] = useState('');
  const [goals, setGoals] = useState('');
  const save = useMutation({
    mutationFn: () => api('/onboarding', { level, goals }),
    onSuccess: () => cache.invalidateQueries({ queryKey: ['session'] }),
  });
  return (
    <div className="welcome">
      <span className="brand">Vocab Garden</span>
      <Heading title={`Welcome, ${session.user.name}`}>
        A couple of basics before you start.
      </Heading>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <fieldset>
          <legend>What’s your German level?</legend>
          {[
            ['A1', 'A1 — just starting'],
            ['A2', 'A2 — basic'],
            ['B1', 'B1 — getting there'],
            ['unsure', 'Not sure — start with A1'],
          ].map(([value, label]) => (
            <label className="radio" key={value}>
              <input
                type="radio"
                name="level"
                value={value}
                checked={level === value}
                onChange={() => setLevel(value)}
                required
              />
              {label}
            </label>
          ))}
        </fieldset>
        <label htmlFor="goals">
          Where would you like to feel more confident? <span className="muted">(optional)</span>
        </label>
        <textarea
          id="goals"
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          placeholder="For example: doctor’s appointments and finding a flat"
          maxLength={3000}
          disabled={!session.ai_available}
        />
        {!session.ai_available && (
          <p className="muted small">
            Personalised guidance is available when an AI key is configured.
          </p>
        )}
        <ErrorNotice error={save.error} />
        <button className="primary" disabled={!level || save.isPending}>
          {save.isPending ? 'Saving…' : 'Start learning'}
        </button>
      </form>
    </div>
  );
}
