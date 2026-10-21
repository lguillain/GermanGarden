import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api, type Chat, type Word } from '../../api';
import { Corrections } from '../../components/corrections';
import { ErrorNotice } from '../../components/feedback';
import { TargetWords } from './target-words';

export interface ReadingResult {
  targets: Word[];
  text: { setting: string; de: string; en: string };
}
interface Targets {
  scope: string;
  topic: string;
  targetIds?: string[];
}
export function ReadingActivity({
  scope,
  topic,
  targetIds,
  value,
  onChange,
}: Targets & {
  value: ReadingResult | null;
  onChange: (value: ReadingResult) => void;
}) {
  const [showTranslation, setShowTranslation] = useState(false);
  const reading = useMutation({
    mutationFn: () => api<ReadingResult>('/reading', { scope, topic, target_ids: targetIds }),
    onSuccess: (data) => {
      onChange(data);
      setShowTranslation(false);
    },
  });
  return (
    <>
      <button className="primary" disabled={reading.isPending} onClick={() => reading.mutate()}>
        {reading.isPending ? 'Writing passage…' : value ? 'New passage' : 'Start reading'}
      </button>
      <ErrorNotice error={reading.error} />
      {value && (
        <>
          <TargetWords words={value.targets} />
          <article className="panel reading">
            <p className="eyebrow">{value.text.setting}</p>
            <p lang="de">{value.text.de}</p>
            <button aria-expanded={showTranslation} onClick={() => setShowTranslation((s) => !s)}>
              {showTranslation ? 'Hide translation' : 'Show English translation'}
            </button>
            {showTranslation && <p className="translation">{value.text.en}</p>}
          </article>
        </>
      )}
    </>
  );
}
export function ConversationActivity({
  scope,
  topic,
  targetIds,
  value,
  onChange,
  draft,
  onDraft,
}: Targets & {
  value: Chat | null;
  onChange: (value: Chat) => void;
  draft: string;
  onDraft: (value: string) => void;
}) {
  const chatCall = useMutation({
    mutationFn: () =>
      api<Chat>('/chat', {
        scope,
        topic,
        message: draft,
        history: value?.history || [],
        target_ids: value?.targets.map((word) => word.id) || targetIds || [],
        start: !value,
      }),
    onSuccess: (data) => {
      onChange(data);
      onDraft('');
    },
  });
  return (
    <>
      {value && <TargetWords words={value.targets} used={value.used} />}
      {value && (
        <div className="chat-log" aria-live="polite">
          {value.history.map((message, index) => (
            <article className={`panel message ${message.role}`} key={index}>
              <p className="eyebrow">{message.role === 'user' ? 'You' : 'Conversation partner'}</p>
              <p lang="de">{message.content}</p>
              <Corrections items={message.corrections} />
            </article>
          ))}
        </div>
      )}
      {!value ? (
        <button className="primary" disabled={chatCall.isPending} onClick={() => chatCall.mutate()}>
          {chatCall.isPending ? 'Starting conversation…' : 'Start conversation'}
        </button>
      ) : (
        <form
          className="input-row"
          onSubmit={(event) => {
            event.preventDefault();
            chatCall.mutate();
          }}
        >
          <label className="flex">
            Your reply in German
            <input
              value={draft}
              onChange={(event) => onDraft(event.target.value)}
              maxLength={3000}
              required
              disabled={chatCall.isPending}
              autoComplete="off"
            />
          </label>
          <button className="primary" disabled={chatCall.isPending || !draft.trim()}>
            {chatCall.isPending ? 'Replying…' : 'Send'}
          </button>
        </form>
      )}
      <ErrorNotice error={chatCall.error} />
    </>
  );
}
