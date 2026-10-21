import { useState } from 'react';
import type { Chat } from '../../api';
import { AiPracticeLayout } from './ai-practice-layout';
import { ConversationActivity } from './practice-activities';
import { usePracticeSummary } from './use-practice-summary';
import { useScope } from '../../hooks/use-scope';

export function ConversationPage() {
  const { scope, topic, query } = useScope();
  const summary = usePracticeSummary(query);
  const [chat, setChat] = useState<Chat | null>(null);
  const [draft, setDraft] = useState('');
  return (
    <AiPracticeLayout
      title="Conversation"
      result={summary}
      wordCount={summary.data?.word_count ?? 0}
    >
      <ConversationActivity
        scope={scope}
        topic={topic}
        value={chat}
        onChange={setChat}
        draft={draft}
        onDraft={setDraft}
      />
    </AiPracticeLayout>
  );
}
