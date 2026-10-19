import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export function CloudLogin() {
  const navigate = useNavigate(), cache = useQueryClient();
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  return <div className="welcome"><span className="brand">Vocab Garden</span><header className="page-heading"><h1>Welcome back</h1></header>
    <form className="panel" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError('');
      try {
        const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        cache.clear(); navigate('/');
      } catch (error) { setError(error instanceof Error ? error.message : 'Could not sign in. Please try again.'); }
      finally { setBusy(false); }
    }}>
      <label htmlFor="email">Email</label><input id="email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required />
      <label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
      {error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form><p className="muted small">Use the account created for you by the garden owner. Your progress is saved across devices.</p></div>;
}
