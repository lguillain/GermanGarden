import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { ErrorNotice, Loading } from '../components/feedback';
import { WelcomeLayout } from '../components/welcome-layout';

export function ProfilePage() {
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const profiles = useQuery({
    queryKey: ['profiles'],
    queryFn: () => api<{ slug: string; name: string }[]>('/profiles'),
  });
  const select = useMutation({
    mutationFn: (body: object) => api('/profile', body),
    onSuccess: async () => {
      cache.clear();
      navigate('/');
    },
  });
  return (
    <WelcomeLayout
      title="Who’s learning?"
      description="Choose your profile to pick up where you left off."
    >
      <div className="panel">
        {profiles.isPending && <Loading />}
        <ErrorNotice error={profiles.error} />
        <div className="profile-list">
          {profiles.data?.map((p) => (
            <button
              key={p.slug}
              disabled={select.isPending}
              onClick={() => select.mutate({ existing: p.slug })}
            >
              {p.name}
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            select.mutate({ name });
          }}
        >
          <label htmlFor="name">New learner</label>
          <div className="input-row">
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={80}
              required
            />
            <button className="primary" disabled={select.isPending}>
              Create profile
            </button>
          </div>
        </form>
        <ErrorNotice error={select.error} />
      </div>
      <p className="muted small">Profiles and progress are saved on this computer.</p>
    </WelcomeLayout>
  );
}
