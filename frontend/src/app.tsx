import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './app-shell';
import { Empty, Loading } from './components/feedback';
import { AiRoute } from './pages/practice/practice-route';
import { CloudLogin } from './pages/cloud-login-page';
import { ExplorePage } from './pages/explore/explore-page';
import { FlashcardsPage } from './pages/practice/flashcards-page';
import { HomePage } from './pages/home/home-page';
import { MatcherPage } from './pages/matcher-page';
import { PracticePage } from './pages/practice/practice-page';
import { ReviewPage } from './pages/review-page';
import { TopicPage } from './pages/topic/topic-page';
import { supabase } from './supabase';
const DesignPage = lazy(() =>
  import('./pages/design/design-page').then(({ DesignPage }) => ({ default: DesignPage })),
);

export function App() {
  return (
    <Routes>
      <Route
        path="/design"
        element={
          <main className="container">
            <Suspense fallback={<Loading />}>
              <DesignPage />
            </Suspense>
          </main>
        }
      />
      <Route path="/profile" element={supabase ? <CloudLogin /> : <MissingConfiguration />} />
      <Route element={supabase ? <AppShell /> : <MissingConfiguration />}>
        <Route index element={<HomePage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="topics/:topic" element={<TopicPage />} />
        <Route path="matcher" element={<MatcherPage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="practice" element={<PracticePage />} />
        <Route path="practice/flashcards" element={<FlashcardsPage />} />
        <Route path="practice/chat" element={<AiRoute mode="chat" />} />
        <Route path="practice/read" element={<AiRoute mode="read" />} />
        <Route path="practice/grammar" element={<GrammarRedirect />} />
        <Route
          path="*"
          element={
            <Empty>
              Page not found. <Link to="/">Go to your garden</Link>.
            </Empty>
          }
        />
      </Route>
    </Routes>
  );
}

function GrammarRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/practice/flashcards${search}`} replace />;
}

function MissingConfiguration() {
  return (
    <main className="container">
      <Empty>
        Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to connect to your garden.
      </Empty>
    </main>
  );
}
