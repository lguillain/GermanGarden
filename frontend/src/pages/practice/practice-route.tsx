import { useLocation } from 'react-router-dom';
import { ConversationPage } from './conversation-page';
import { ReadingPage } from './reading-page';
// Changing the word set starts a fresh practice session, as does changing modes.
export function AiRoute({ mode }: { mode: 'chat' | 'read' }) {
  const location = useLocation();
  const key = `${mode}:${location.search}`;
  if (mode === 'chat') return <ConversationPage key={key} />;
  return <ReadingPage key={key} />;
}
