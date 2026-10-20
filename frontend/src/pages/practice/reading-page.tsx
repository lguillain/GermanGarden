import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api, type Word } from '../../api';
import { AiPracticeLayout } from './ai-practice-layout';
import { ErrorNotice } from '../../components/feedback';
import { TargetWords } from './target-words';
import { usePracticeWords } from './use-practice-words';
import { useScope } from '../../hooks/use-scope';

export function ReadingPage() {
  const { scope, topic, query } = useScope();
  const words = usePracticeWords(query);
  const [showTranslation, setShowTranslation] = useState(false);
  const reading = useMutation({
    mutationFn: () =>
      api<{ targets: Word[]; text: { setting: string; de: string; en: string } }>('/reading', {
        scope,
        topic,
      }),
    onSuccess: () => setShowTranslation(false),
  });
  return (
    <AiPracticeLayout title="Reading" words={words} grammar={false}>
      {words.data && (
        <>
          <button className="primary" disabled={reading.isPending} onClick={() => reading.mutate()}>
            {reading.isPending
              ? 'Writing passage…'
              : reading.data
                ? 'New passage'
                : 'Start reading'}
          </button>
          <ErrorNotice error={reading.error} />
          {reading.data && (
            <>
              <TargetWords words={reading.data.targets} />
              <article className="panel reading">
                <p className="eyebrow">{reading.data.text.setting}</p>
                <p lang="de">{reading.data.text.de}</p>
                <button
                  aria-expanded={showTranslation}
                  onClick={() => setShowTranslation((s) => !s)}
                >
                  {showTranslation ? 'Hide translation' : 'Show English translation'}
                </button>
                {showTranslation && <p className="translation">{reading.data.text.en}</p>}
              </article>
            </>
          )}
        </>
      )}
    </AiPracticeLayout>
  );
}
