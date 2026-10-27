import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { ErrorNotice } from '../components/feedback';
import { WelcomeLayout } from '../components/welcome-layout';

export function CloudLogin() {
  const navigate = useNavigate(),
    cache = useQueryClient();
  const [error, setError] = useState<Error | null>(null),
    [busy, setBusy] = useState(false);
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
