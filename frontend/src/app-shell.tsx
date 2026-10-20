import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { Session, Time } from './api';
import { api, ApiError } from './api';
import { ErrorNotice, Loading } from './components/feedback';
import { SetupPage } from './pages/setup-page';
import { supabase } from './supabase';

export function AppShell() {
  const cache = useQueryClient();
  const auth = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      const { data, error } = await supabase!.auth.getSession();
      if (error) throw error;
      return data.session?.user ?? null;
    },
    enabled: !!supabase,
  });
  const session = useQuery({ queryKey: ['session'], queryFn: () => api<Session>('/session') });
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const ready = !!session.data?.user.level;
  useQuery({
    queryKey: ['time', session.data?.user.name],
    queryFn: () => api<Time>('/heartbeat', {}),
    enabled: ready,
    refetchInterval: () => (document.visibilityState === 'visible' ? 15000 : false),
  });
  useEffect(() => {
    setMenuOpen(false);
    const heading = document.querySelector('h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      (heading as HTMLElement).focus();
    }
  }, [location.pathname]);
  const switchProfile = useMutation({
    mutationFn: () => api('/profile', undefined, 'DELETE'),
    onSuccess: () => {
      cache.clear();
      navigate('/profile');
    },
  });
  if (supabase && auth.isSuccess && !auth.data) return <Navigate to="/profile" replace />;
  if (session.isPending && !auth.data)
    return (
      <div className="welcome">
        <Loading />
      </div>
    );
  if (session.error instanceof ApiError && session.error.status === 401)
    return <Navigate to="/profile" replace />;
  if (session.error && !auth.data)
    return (
      <div className="welcome">
        <ErrorNotice error={session.error} />
        <button onClick={() => session.refetch()}>Retry</button>
      </div>
    );
  if (session.data && !session.data.user.level) return <SetupPage session={session.data} />;
  return (
    <>
      <a
        className="skip"
        href="#main"
        onClick={(e) => {
          if (supabase) {
            e.preventDefault();
            document.getElementById('main')?.focus();
          }
        }}
      >
        Skip to content
      </a>
      <aside className={`app-sidebar${menuOpen ? ' menu-open' : ''}`} aria-label="App navigation">
        <Link className="brand" to="/">
          Vocab Garden
        </Link>
        <button
          className="mobile-menu"
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? 'Close menu' : 'Menu'}
        </button>
        <nav id="main-navigation" aria-label="Main navigation">
          <NavLink end to="/">
            Garden
          </NavLink>
          <NavLink to="/explore">Explore topics</NavLink>
          <NavLink to="/matcher">Find words</NavLink>
          <NavLink to="/practice">Practice</NavLink>
          <NavLink to="/review">Review</NavLink>
        </nav>
        <button
          className="profile-button"
          disabled={switchProfile.isPending}
          onClick={() => switchProfile.mutate()}
        >
          <svg className="farmer-icon" viewBox="0 0 40 40" aria-hidden="true">
            <rect width="40" height="40" rx="14" fill="#c6d9b6" />
            <path d="M7 39 Q7 26 20 26 Q33 26 33 39" fill="#577b59" />
            <path d="M14 27 L14 39 M26 27 L26 39" stroke="#a7bd84" strokeWidth="4" />
            <ellipse cx="20" cy="19" rx="9" ry="10" fill="#d6ac80" />
            <path d="M12 14 L15 5 Q20 3 25 5 L28 14" fill="#c2a367" />
            <path d="M7 14 Q20 10 33 14 L32 17 Q20 15 8 17Z" fill="#dfc68c" />
            <circle cx="17" cy="20" r="1" fill="#4c503a" />
            <circle cx="23" cy="20" r="1" fill="#4c503a" />
            <path
              d="M17 24 Q20 26 23 24"
              fill="none"
              stroke="#90674e"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <span className="profile-identity">
            <span>
              {session.data?.user.name ??
                auth.data?.user_metadata?.name ??
                auth.data?.email?.split('@')[0] ??
                'Learner'}
            </span>
            <span className="profile-level">{session.data?.user.level}</span>
          </span>
        </button>
      </aside>
      <div className="app-content">
        <main id="main" tabIndex={-1} className="container">
          <ErrorNotice error={switchProfile.error} />
          {session.error && (
            <>
              <ErrorNotice error={session.error} />
              <button onClick={() => session.refetch()}>Retry</button>
            </>
          )}
          <Outlet context={session.data} />
        </main>
      </div>
    </>
  );
}
