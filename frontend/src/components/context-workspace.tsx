import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, useId } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { api, type Message, type Word, type Session } from '../api';
import { ErrorNotice, Loading } from './feedback';
import { WordTitle } from './word-card';

interface ContextReply {
  introduction: string;
  messages: Message[];
}
export default function ContextWorkspace({ word, open }: { word: Word; open: boolean }) {
  const session = useOutletContext<Session | undefined>();
  const [params] = useSearchParams();
  const topic = word.activity_id || params.get('topic') || '';
  const queryClient = useQueryClient();
  const queryKey = ['word-context', word.id, topic, session?.user.level];
  const [question, setQuestion] = useState('');
  const request = useRef({ question: '', id: '' });
  const inputId = useId();
  const result = useQuery({
    queryKey,
    queryFn: () => api<ContextReply>('/context', { word_id: word.id, topic }),
    enabled: open && !!session,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const mutation = useMutation({
    mutationFn: (action: 'send' | 'clear') => {
      if (action === 'send' && request.current.question !== question) {
        request.current = { question, id: crypto.randomUUID() };
      }
      return api<ContextReply>('/context', {
        word_id: word.id,
        topic,
        action,
        question,
        request_id: request.current.id,
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      setQuestion('');
      request.current = { question: '', id: '' };
    },
  });
  const busy = mutation.isPending || result.isFetching;
  return (
    <div className="context-workspace">
      <h3>
        <WordTitle word={word} />
      </h3>
      {result.isPending && !result.error && <Loading />}
      <ErrorNotice error={result.error} />
      {result.error && <button onClick={() => result.refetch()}>Try again</button>}
      {result.data && (
        <>
          <p className="context-text">{result.data.introduction}</p>
          <div className="context-messages" role="log" aria-label="Context conversation">
            {result.data.messages.map((message, index) => (
              <div className={`context-message context-${message.role}`} key={index}>
                <strong>{message.role === 'user' ? 'You' : 'Context'}</strong>
                <p className="context-text">{message.content}</p>
              </div>
            ))}
          </div>
          {!!result.data.messages.length && (
            <button disabled={busy} onClick={() => mutation.mutate('clear')}>
              Clear conversation
            </button>
          )}
          {session?.ai_available === false && (
            <p>AI is currently unavailable. Your saved context is still available.</p>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate('send');
            }}
          >
            <label htmlFor={inputId}>Ask about this word</label>
            <textarea
              id={inputId}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={3000}
              disabled={busy}
            />
            <button
              className="primary"
              disabled={busy || !question.trim() || !session?.ai_available}
            >
              {mutation.isPending ? 'Working…' : 'Send'}
            </button>
          </form>
        </>
      )}
      <ErrorNotice error={mutation.error} />
    </div>
  );
}
