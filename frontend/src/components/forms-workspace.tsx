import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, type Grammar, type GrammarOptions, type Word, type Session } from '../api';
import { Corrections } from './corrections';
import { ErrorNotice, Loading } from './feedback';
import { WordTitle } from './word-card';
const grammarLabels: Record<string, string> = {
  Nominativ: 'Nominative',
  Akkusativ: 'Accusative',
  Dativ: 'Dative',
  Genitiv: 'Genitive',
  Singular: 'Singular',
  Plural: 'Plural',
  Präsens: 'Present',
  Perfekt: 'Conversational past',
  Präteritum: 'Simple past',
  Plusquamperfekt: 'Past perfect',
  'Futur I': 'Future',
  'Konjunktiv II': 'Subjunctive II',
  Imperativ: 'Imperative',
  Positiv: 'Positive',
  Komparativ: 'Comparative',
  Superlativ: 'Superlative',
  'stark (no article)': 'Strong (no article)',
  'schwach (der/die/das)': 'Weak (definite article)',
  'gemischt (ein/kein/mein)': 'Mixed (indefinite article)',
  ich: 'I (ich)',
  du: 'You (du)',
  'er/sie/es': 'He / she / it',
  wir: 'We (wir)',
  ihr: 'You, plural (ihr)',
  'sie/Sie': 'They / formal you',
};
export default function FormsWorkspace({ word }: { word: Word }) {
  const aiAvailable = useOutletContext<Session | undefined>()?.ai_available;
  const options = useQuery({
    queryKey: ['grammar-options'],
    queryFn: () => api<GrammarOptions>('/grammar/options'),
    staleTime: Infinity,
    enabled: aiAvailable === true,
  });
  const [config, setConfig] = useState<Record<string, string>>({});
  const [sentence, setSentence] = useState('');
  const grammar = useMutation({
    mutationFn: (action: string) =>
      api<Grammar>('/grammar', { word_id: word.id, config, sentence, action }),
  });
  if (aiAvailable === false)
    return <p>AI practice is not configured yet. Ask the garden owner to enable it.</p>;
  if (options.error)
    return (
      <>
        <ErrorNotice error={options.error} />
        <button onClick={() => options.refetch()}>Try again</button>
      </>
    );
  if (options.isPending) return <Loading />;
  return (
    <div className="grammar-workspace">
      <div className="panel">
        <h2>
          <WordTitle word={word} />
        </h2>
        <div className="input-row grammar-options">
          {Object.entries(options.data?.[word.pos] || {}).map(([key, values]) => (
            <label className="flex" key={key}>
              {key[0].toUpperCase() + key.slice(1)}
              <select
                value={config[key] || values[0]}
                disabled={grammar.isPending}
                onChange={(e) => {
                  setConfig((c) => ({ ...c, [key]: e.target.value }));
                  grammar.reset();
                }}
              >
                {values.map((value) => (
                  <option key={value} value={value}>
                    {grammarLabels[value] || value}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <button disabled={grammar.isPending} onClick={() => grammar.mutate('generate')}>
          {grammar.isPending ? 'Working…' : 'Generate example'}
        </button>
        <hr />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            grammar.mutate('correct');
          }}
        >
          <label htmlFor="sentence">Or write your own German sentence</label>
          <textarea
            id="sentence"
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            maxLength={3000}
            required
            disabled={grammar.isPending}
          />
          <button className="primary" disabled={grammar.isPending || !sentence.trim()}>
            Check sentence
          </button>
        </form>
      </div>
      <ErrorNotice error={grammar.error} />
      {grammar.data && (
        <article className="panel grammar-result" aria-live="polite">
          {grammar.data.expected_form && (
            <p>
              Target form: <strong lang="de">{grammar.data.expected_form}</strong>
            </p>
          )}
          {grammar.data.de && (
            <p className="sentence" lang="de">
              {grammar.data.de}
            </p>
          )}
          {grammar.data.en && <p className="muted">{grammar.data.en}</p>}
          {grammar.data.meets_config !== undefined && (
            <p>
              {grammar.data.meets_config
                ? 'The target word matches the chosen form.'
                : 'The target word does not match the chosen form yet.'}
            </p>
          )}
          <Corrections items={grammar.data.corrections} />
          <p>{grammar.data.focus || grammar.data.grammar_focus}</p>
        </article>
      )}
    </div>
  );
}
