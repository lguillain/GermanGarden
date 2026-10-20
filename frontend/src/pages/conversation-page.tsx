import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api, type Chat } from '../api';
import { AiPracticeLayout } from '../components/ai-practice-layout';
import { Corrections } from '../components/corrections';
import { ErrorNotice } from '../components/feedback';
import { WordTitle } from '../components/word-card';
import { usePracticeWords } from '../hooks/use-practice-words';
import { useScope } from '../hooks/use-scope';

export function ConversationPage() {
  const { scope, topic, query } = useScope();
  const words = usePracticeWords(query);
  const [chat, setChat] = useState<Chat | null>(null);
  const [message, setMessage] = useState('');
  const chatCall = useMutation({
    mutationFn: () =>
      api<Chat>('/chat', {
        scope,
        topic,
        message,
        history: chat?.history || [],
        target_ids: chat?.targets.map((t) => t.id) || [],
      }),
    onSuccess: (data) => {
      setChat(data);
      setMessage('');
    },
  });
  return (
    <AiPracticeLayout title="Conversation" words={words} grammar={false}>
      {words.data && (
        <>
          {chat && (
            <div className="chips">
              {chat.targets.map((w) => (
                <span className={`badge ${chat.used.includes(w.lemma) ? 'used' : ''}`} key={w.id}>
                  <WordTitle word={w} />
                  {chat.used.includes(w.lemma) ? ' ✓' : ''}
                </span>
              ))}
            </div>
          )}
          {chat && (
            <div className="chat-log" aria-live="polite">
              {chat?.history.map((m, i) => (
                <article className={`panel message ${m.role}`} key={i}>
                  <p className="eyebrow">{m.role === 'user' ? 'You' : 'Conversation partner'}</p>
                  <p lang="de">{m.content}</p>
                  <Corrections items={m.corrections} />
                </article>
              ))}
            </div>
          )}
          {!chat ? (
            <button
              className="primary"
              disabled={chatCall.isPending}
              onClick={() => chatCall.mutate()}
            >
              {chatCall.isPending ? 'Starting conversation…' : 'Start conversation'}
            </button>
          ) : (
            <form
              className="input-row"
              onSubmit={(e) => {
                e.preventDefault();
                chatCall.mutate();
              }}
            >
              <label className="flex">
                Your reply in German
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={3000}
                  required
                  disabled={chatCall.isPending}
                  autoComplete="off"
                />
              </label>
              <button className="primary" disabled={chatCall.isPending || !message.trim()}>
                {chatCall.isPending ? 'Replying…' : 'Send'}
              </button>
            </form>
          )}
          <ErrorNotice error={chatCall.error} />
        </>
      )}
    </AiPracticeLayout>
  );
}
