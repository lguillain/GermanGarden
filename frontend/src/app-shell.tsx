import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from './api';
import { ErrorNotice, Loading } from './components/feedback';
import { SetupPage } from './pages/setup-page';
import { supabase } from './supabase';
import { sessionQuery } from './queries/session-query';

export function AppShell() {
  const cache = useQueryClient();
  const auth = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      const { data, error } = await supabase!.auth.getSession();
      if (error) throw error;
      return data.session?.user ?? null;
    },
  });
  const session = useQuery(sessionQuery());
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    setMenuOpen(false);
    const heading = document.querySelector('h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      (heading as HTMLElement).focus();
    }
  }, [location.pathname]);
  const signOut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase!.auth.signOut({ scope: 'local' });
      if (error) throw error;
    },
    onSuccess: () => {
      cache.clear();
      navigate('/profile');
    },
  });
  if (auth.isSuccess && !auth.data) return <Navigate to="/profile" replace />;
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
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className={`app-sidebar${menuOpen ? ' menu-open' : ''}`} aria-label="App navigation">
        <Link className="brand" to="/">
          German Garden
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
          disabled={signOut.isPending}
          onClick={() => signOut.mutate()}
        >
          <img className="farmer-icon" src={`${import.meta.env.BASE_URL}farmer.svg`} alt="" />
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
          <ErrorNotice error={signOut.error} />
          {session.error && (
            <>
              <ErrorNotice error={session.error} />
              <button onClick={() => session.refetch()}>Retry</button>
            </>
          )}
          <Suspense fallback={<Loading />}>
            <Outlet context={session.data} />
          </Suspense>
        </main>
      </div>
    </>
  );
}
