import { useLocation } from 'react-router-dom';
import { ConversationPage } from './pages/conversation-page';
import { GrammarPage } from './pages/grammar-page';
import { ReadingPage } from './pages/reading-page';
// Changing the word set starts a fresh practice session, as does changing modes.
export function AiRoute({ mode }: { mode: 'chat' | 'read' | 'grammar' }) {
  const location = useLocation();
  const key = `${mode}:${location.search}`;
  if (mode === 'chat') return <ConversationPage key={key} />;
  if (mode === 'read') return <ReadingPage key={key} />;
  return <GrammarPage key={key} />;
}
