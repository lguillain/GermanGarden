import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export function CloudLogin() {
  const navigate = useNavigate(),
    cache = useQueryClient();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <div className="welcome">
      <span className="brand">Vocab Garden</span>
      <header className="page-heading">
        <h1>Welcome back</h1>
      </header>
      <form
        className="panel"
        onSubmit={async (event) => {
          event.preventDefault();
          // Read the actual fields: autofill may not emit React change events.
          const fields = new FormData(event.currentTarget);
          setBusy(true);
          setError('');
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
              error instanceof Error ? error.message : 'Could not sign in. Please try again.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
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
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="muted small">
        Use the account created for you by the garden owner. Your progress is saved across devices.
      </p>
    </div>
  );
}
