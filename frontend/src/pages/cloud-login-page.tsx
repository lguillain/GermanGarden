import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { ErrorNotice, Loading } from '../components/feedback';
import { WelcomeLayout } from '../components/welcome-layout';
import { sessionQuery } from '../queries/session-query';
import { gardenQuery } from '../queries/garden-query';

export function CloudLogin() {
  const navigate = useNavigate(),
    cache = useQueryClient();
  const [error, setError] = useState<Error | null>(null),
    [busy, setBusy] = useState(false);
  const savedSession = useQuery({
    queryKey: ['login-session'],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase!.auth.getSession();
      if (error) throw error;
      if (!data.session) return false;
      // Confirm the saved session before redirecting, avoiding a loop on API 401s.
      cache.setQueryData(['auth'], data.session.user);
      void cache.prefetchQuery(gardenQuery());
      await cache.fetchQuery(sessionQuery());
      return true;
    },
  });
  if (savedSession.isPending)
    return (
      <WelcomeLayout title="Welcome back">
        <Loading />
      </WelcomeLayout>
    );
  if (savedSession.data) return <Navigate to="/" replace />;
  return (
    <WelcomeLayout title="Welcome back">
      <form
        className="panel login-form"
        onSubmit={async (event) => {
          event.preventDefault();
          // Read the actual fields: autofill may not emit React change events.
          const fields = new FormData(event.currentTarget);
          setBusy(true);
          setError(null);
          try {
            const login = String(fields.get('username') ?? '')
              .trim()
              .toLowerCase();
            const password = String(fields.get('password') ?? '');
            const email = login.includes('@') ? login : `${login}@vocab-garden.test`;
            const { error } = await supabase!.auth.signInWithPassword({ email, password });
            if (error) throw error;
            cache.clear();
            navigate('/');
          } catch (error) {
            setError(
              error instanceof Error ? error : new Error('Could not sign in. Please try again.'),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="e.g. leo"
            required
          />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <ErrorNotice error={error} />
        <button className="primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="muted small">
        Use the account created for you by the garden owner. Your progress is saved across devices.
      </p>
    </WelcomeLayout>
  );
}
