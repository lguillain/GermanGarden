import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api, type Grammar } from '../../api';
import { AiPracticeLayout } from './ai-practice-layout';
import { Corrections } from './corrections';
import { ErrorNotice } from '../../components/feedback';
import { WordTitle } from '../../components/word-card';
import { usePracticeWords } from './use-practice-words';
import { useScope } from '../../hooks/use-scope';
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
export function GrammarPage() {
  const { query } = useScope();
  const words = usePracticeWords(query);
  const [wordId, setWordId] = useState('');
  const [wordSearch, setWordSearch] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [sentence, setSentence] = useState('');
  const selected = words.data?.words.find((w) => w.id === wordId) || words.data?.words[0];
  const grammar = useMutation({
    mutationFn: (action: string) =>
      api<Grammar>('/grammar', { word_id: selected?.id, config, sentence, action }),
  });
  return (
    <AiPracticeLayout
      title="Grammar playground"
      result={words}
      wordCount={words.data?.words.length ?? 0}
      grammar={true}
    >
      {words.data && (
        <div className="grammar-layout">
          <aside className="grammar-word-picker" aria-label="Practice words">
            <label htmlFor="grammar-word-search">Words</label>
            <input
              id="grammar-word-search"
              placeholder="Find a word…"
              value={wordSearch}
              onChange={(e) => setWordSearch(e.target.value)}
            />
            <ul className="grammar-word-list">
              {words.data.words
                .filter((w) =>
                  `${w.lemma} ${w.english}`.toLowerCase().includes(wordSearch.trim().toLowerCase()),
                )
                .map((w) => (
                  <li key={w.id}>
                    <button
                      aria-pressed={selected?.id === w.id}
                      disabled={grammar.isPending}
                      onClick={() => {
                        setWordId(w.id);
                        setConfig({});
                        setSentence('');
                        grammar.reset();
                      }}
                    >
                      <span>
                        <WordTitle word={w} />
                      </span>
                      <span className="small muted">{w.english}</span>
                    </button>
                  </li>
                ))}
            </ul>
            {!words.data.words.some((w) =>
              `${w.lemma} ${w.english}`.toLowerCase().includes(wordSearch.trim().toLowerCase()),
            ) && <p className="small muted">No matching words.</p>}
          </aside>
          <div className="grammar-workspace">
            <div className="panel">
              <h2>
                <WordTitle word={selected!} />
              </h2>
              <div className="input-row grammar-options">
                {Object.entries(words.data?.grammar_options[selected?.pos || ''] || {}).map(
                  ([key, values]) => (
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
                  ),
                )}
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
        </div>
      )}
    </AiPracticeLayout>
  );
}
