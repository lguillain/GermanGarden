import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import { type Session } from '../../api';
import { ErrorNotice, Loading } from '../../components/feedback';
import { WordTitle } from '../../components/word-card';
import { PracticeModeCards } from './practice-mode-cards';
import { FlashcardActivity, FlashcardDirection } from './flashcard-activity';
import { PracticeActivityCard } from './practice-activity-card';
import { TargetWords } from './target-words';
import { ConversationActivity, ReadingActivity } from './practice-activities';
import {
  PRACTICE_SESSION_SIZE,
  currentSessionWords,
  practisedWordCount,
  sessionCount,
} from './practice-round';
import { usePracticeRound } from './use-practice-round';

export function WeakPractice({
  scope,
  topic,
  query,
  children,
  overview,
}: {
  scope: string;
  topic: string;
  query: string;
  children?: ReactNode;
  overview?: ReactNode;
}) {
  const cache = useQueryClient();
  const session = useOutletContext<Session | undefined>();
  const account = cache.getQueryData<{ id: string }>(['auth'])?.id;
  if (!account)
    return (
      <>
        {overview}
        <Loading />
      </>
    );
  const storageKey = `garden-practice-round:v1:${account}:${query}`;
  return (
    <WeakPracticeRound
      key={storageKey}
      storageKey={storageKey}
      scope={scope}
      topic={topic}
      query={query}
      aiAvailable={session?.ai_available}
      overview={overview}
    >
      {children}
    </WeakPracticeRound>
  );
}
function WeakPracticeRound({
  storageKey,
  scope,
  topic,
  query,
  aiAvailable,
  children,
  overview,
}: {
  storageKey: string;
  scope: string;
  topic: string;
  query: string;
  children?: ReactNode;
  overview?: ReactNode;
  aiAvailable?: boolean;
}) {
  const {
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
  } = usePracticeRound(storageKey, query);
  if (!round)
    return (
      <>
        {overview}
        <section
          className="panel weak-practice practice-overview"
          aria-label="Words needing attention"
        >
          {storageError && (
            <p role="alert">
              This browser could not clear the saved round. It may return after refreshing.
            </p>
          )}
          {candidates.isPending ? (
            <Loading />
          ) : (
            candidates.data && (
              <>
                <div className="practice-overview-copy">
                  <h2>{candidates.data.words.length} words need attention</h2>
                  <p className="muted">
                    {sessionCount(candidates.data.words.length)}{' '}
                    {sessionCount(candidates.data.words.length) === 1 ? 'session' : 'sessions'} · up
                    to {PRACTICE_SESSION_SIZE} words each
                  </p>
                </div>
                {candidates.data.words.length ? (
                  <button className="primary" disabled={starting} onClick={begin}>
                    {starting ? 'Preparing session…' : 'Start session'}
                  </button>
                ) : (
                  <p>No words need extra attention right now.</p>
                )}
              </>
            )
          )}
          <ErrorNotice error={candidates.error} />
          {candidates.error && <button onClick={() => candidates.refetch()}>Retry</button>}
        </section>
        {children}
      </>
    );

  const total = sessionCount(round.words.length);
  const complete = round.completed >= total;
  const words = currentSessionWords(round);
  return (
    <section
      className={`weak-practice active-practice-round${round.step === 'flashcards' ? ' active-practice-flashcards' : ''}`}
      aria-label="Practice round"
    >
      <header className="practice-round-summary">
        <div>
          <h1>{complete ? 'Round complete' : `Session ${round.completed + 1} of ${total}`}</h1>
          <p>
            {practisedWordCount(round)} of {round.words.length} words practised
          </p>
        </div>
        {round.step === 'flashcards' && (
          <FlashcardDirection
            direction={round.direction}
            onDirection={(direction) => update({ direction, revealed: false })}
          />
        )}
        <div className="practice-round-actions">
          {round.step === 'flashcards' && (
            <button className="practice-text-action" onClick={() => update({ step: 'choose' })}>
              Skip to activity
            </button>
          )}
          <button className="practice-text-action" onClick={exitRound}>
            Exit round
          </button>
        </div>
        {storageError && (
          <p role="alert">
            This browser could not save the round. Keep this page open to retain your progress.
          </p>
        )}
      </header>
      {complete || round.step === 'finished' ? (
        <div className="panel">
          <h2>
            {complete
              ? `You’ve practised all ${round.words.length} words this round.`
              : 'Session complete'}
          </h2>
          {!complete && (
            <p>
              {total - round.completed} {total - round.completed === 1 ? 'session' : 'sessions'}{' '}
              remaining to cover this round.
            </p>
          )}
          <div className="actions">
            {complete ? (
              <button disabled={starting} onClick={begin}>
                {starting ? 'Checking words…' : 'Start another round'}
              </button>
            ) : (
              <button className="primary" onClick={advanceSession}>
                Next session
              </button>
            )}
          </div>
          <ErrorNotice error={candidates.error} />
        </div>
      ) : (
        <>
          {round.step === 'meet' && (
            <div className="panel practice-session-intro">
              <div>
                <h2>Your {words.length} words</h2>
                <ul className="practice-round-words">
                  {words.map((word) => (
                    <li key={word.id}>
                      <strong>
                        <WordTitle word={word} />
                      </strong>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="actions">
                <button className="primary" onClick={() => update({ step: 'flashcards' })}>
                  Go through flashcards
                </button>
                <button onClick={() => update({ step: 'choose' })}>Skip to activity</button>
              </div>
            </div>
          )}
          {round.step === 'flashcards' && words[round.cardIndex] && (
            <FlashcardActivity
              word={words[round.cardIndex]}
              index={round.cardIndex}
              count={words.length}
              direction={round.direction}
              revealed={round.revealed}
              onDirection={(direction) => update({ direction, revealed: false })}
              onReveal={() => update({ revealed: true })}
              onPrevious={() => update({ cardIndex: round.cardIndex - 1, revealed: false })}
              onNext={() =>
                update(
                  round.cardIndex + 1 === words.length
                    ? { step: 'choose' }
                    : { cardIndex: round.cardIndex + 1, revealed: false },
                )
              }
              nextLabel={round.cardIndex + 1 === words.length ? 'Continue to activity' : 'Next'}
              showDirection={false}
            />
          )}
          {round.step === 'choose' && (
            <PracticeModeCards
              includeFlashcards={false}
              aiAvailable={aiAvailable}
              onSelect={(step) =>
                update(step === 'flashcards' ? { step, cardIndex: 0, revealed: false } : { step })
              }
            />
          )}
          {(round.step === 'read' || round.step === 'chat') && (
            <PracticeActivityCard
              title={<h2>{round.step === 'read' ? 'Reading' : 'Conversation'}</h2>}
              action={
                <button className="practice-text-action" onClick={() => update({ step: 'choose' })}>
                  Change activity
                </button>
              }
              footer={
                canFinish ? (
                  <button className="primary" onClick={finish}>
                    Finish session
                  </button>
                ) : undefined
              }
            >
              {((round.step === 'read' && !round.reading) ||
                (round.step === 'chat' && !round.chat)) && <TargetWords words={words} />}
              {aiAvailable === true &&
                (round.step === 'read' ? (
                  <ReadingActivity
                    scope={scope}
                    topic={topic}
                    targetIds={words.map((word) => word.id)}
                    value={round.reading}
                    onChange={(reading) => update({ reading })}
                  />
                ) : (
                  <ConversationActivity
                    scope={scope}
                    topic={topic}
                    targetIds={words.map((word) => word.id)}
                    value={round.chat}
                    onChange={(chat) => update({ chat })}
                    draft={round.draft}
                    onDraft={(draft) => update({ draft })}
                  />
                ))}
            </PracticeActivityCard>
          )}
          {aiAvailable !== true && (
            <p className="muted">
              {aiAvailable === false
                ? 'Reading and conversation need AI practice enabled. You can go through flashcards now and resume the activity later.'
                : 'Checking availability of reading and conversation…'}
            </p>
          )}
        </>
      )}
    </section>
  );
}
