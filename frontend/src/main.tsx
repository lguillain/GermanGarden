import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BrowserRouter, HashRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { api, ApiError } from './api';
import type { Activity, Card, Chat, Correction, Garden, Grammar, GrammarOptions, Matcher, Session, Time, Topic, Word } from './api';
import GardenScene, { PlantIcon, SeedIcon, TopicScene } from './GardenScene';
import './styles.css';
import { supabase } from './supabase';
import { CloudLogin } from './CloudLogin';

const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } } });
const grammarLabels: Record<string, string> = { Nominativ: 'Nominative', Akkusativ: 'Accusative', Dativ: 'Dative', Genitiv: 'Genitive', Singular: 'Singular', Plural: 'Plural', Präsens: 'Present', Perfekt: 'Conversational past', Präteritum: 'Simple past', Plusquamperfekt: 'Past perfect', 'Futur I': 'Future', 'Konjunktiv II': 'Subjunctive II', Imperativ: 'Imperative', Positiv: 'Positive', Komparativ: 'Comparative', Superlativ: 'Superlative', 'stark (no article)': 'Strong (no article)', 'schwach (der/die/das)': 'Weak (definite article)', 'gemischt (ein/kein/mein)': 'Mixed (indefinite article)', ich: 'I (ich)', du: 'You (du)', 'er/sie/es': 'He / she / it', wir: 'We (wir)', ihr: 'You, plural (ihr)', 'sie/Sie': 'They / formal you' };

const errorText = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
function ErrorNotice({ error }: { error: unknown }) { return error ? <p className="error" role="alert">{errorText(error)}</p> : null; }
function Loading() { return <p className="muted" role="status">Loading…</p>; }
function Heading({ title, children }: { title: string; children?: React.ReactNode }) { return <header className="page-heading"><div><h1>{title}</h1>{children && <p className="muted">{children}</p>}</div></header>; }
function Empty({ children }: { children: React.ReactNode }) { return <div className="panel empty">{children}</div>; }
function useScope() {
  const [params] = useSearchParams();
  const scope = params.get('scope') || 'all';
  const topic = params.get('topic') || '';
  const { activities } = useOutletContext<Session>();
  const label = scope === 'bag' ? 'Seed bag' : scope === 'topic' ? activities.find(a => a.id === topic)?.name || 'Topic' : 'Your garden';
  return { scope, topic, label, query: `?${new URLSearchParams({ scope, topic })}` };
}
function WordSetSwitch({ page, counts }: { page: '/practice' | '/review'; counts?: { plants: number; seeds: number } }) {
  const { scope, topic } = useScope();
  return (
    <div className="word-set-switch" role="group" aria-label="Word set">
      <Link className={`button${scope !== 'bag' ? ' primary' : ''}`} aria-current={scope !== 'bag' ? 'true' : undefined} to={`${page}?${new URLSearchParams({ scope: topic ? 'topic' : 'all', topic })}`}><span aria-hidden="true"><PlantIcon /></span>Plants{counts && <span className="word-set-count">{counts.plants}</span>}</Link>
      <Link className={`button${scope === 'bag' ? ' primary' : ''}`} aria-current={scope === 'bag' ? 'true' : undefined} to={`${page}?${new URLSearchParams({ scope: 'bag', topic })}`}><span aria-hidden="true"><SeedIcon /></span>Seeds{counts && <span className="word-set-count">{counts.seeds}</span>}</Link>
    </div>
  );
}
function ScopeLinks({ scope = 'all', topic = '', disabled = false }: { scope?: string; topic?: string; disabled?: boolean }) {
  const query = `?${new URLSearchParams({ scope, topic })}`;
  return disabled ? <span className="muted">Plant words to practise and review</span> : <div className="actions"><Link className="button" to={`/practice${query}`}>Practice</Link><Link className="button" to={`/review${query}`}>Review</Link></div>;
}
function WordTitle({ word, showArticle = true }: { word: Word; showArticle?: boolean }) { return <span lang="de">{showArticle && word.article && <span className="article">{word.article} </span>}{word.lemma}</span>; }
function WordCard({ word, revealed, onReveal }: { word: Word; revealed: boolean; onReveal: () => void }) {
  return <article className="panel word-card"><div className="word-meta">{word.level} <span>·</span> {word.pos}</div><h2><WordTitle word={word} showArticle={revealed} /></h2>
    {word.plural && <p className="muted" lang="de">Plural: {word.plural}</p>}
    {word.de && <p className="sentence" lang="de">{word.de}</p>}
    {revealed ? <div className="translation"><strong>{word.english}</strong>{word.en && <p>{word.en}</p>}</div> : <button className="button" onClick={onReveal}>Show translation</button>}
  </article>;
}
function Profile() {
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const profiles = useQuery({ queryKey: ['profiles'], queryFn: () => api<{ slug: string; name: string }[]>('/profiles') });
  const select = useMutation({ mutationFn: (body: object) => api('/profile', body), onSuccess: async () => { cache.clear(); navigate('/'); } });
  return <div className="welcome"><span className="brand">Vocab Garden</span><Heading title="Who’s learning?">Choose your profile to pick up where you left off.</Heading>
    <div className="panel">{profiles.isPending && <Loading />}<ErrorNotice error={profiles.error} />
      <div className="profile-list">{profiles.data?.map(p => <button key={p.slug} disabled={select.isPending} onClick={() => select.mutate({ existing: p.slug })}>{p.name}<span aria-hidden="true">→</span></button>)}</div>
      <form onSubmit={e => { e.preventDefault(); select.mutate({ name }); }}><label htmlFor="name">New learner</label><div className="input-row"><input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" maxLength={80} required /><button className="primary" disabled={select.isPending}>Create profile</button></div></form>
      <ErrorNotice error={select.error} />
    </div><p className="muted small">Profiles and progress are saved on this computer.</p></div>;
}
function Setup({ session }: { session: Session }) {
  const cache = useQueryClient();
  const [level, setLevel] = useState('');
  const [goals, setGoals] = useState('');
  const save = useMutation({ mutationFn: () => api('/onboarding', { level, goals }), onSuccess: () => cache.invalidateQueries({ queryKey: ['session'] }) });
  return <div className="welcome"><span className="brand">Vocab Garden</span><Heading title={`Welcome, ${session.user.name}`}>A couple of basics before you start.</Heading><form className="panel" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
    <fieldset><legend>What’s your German level?</legend>{[['A1', 'A1 — just starting'], ['A2', 'A2 — basic'], ['B1', 'B1 — getting there'], ['unsure', 'Not sure — start with A1']].map(([value, label]) => <label className="radio" key={value}><input type="radio" name="level" value={value} checked={level === value} onChange={() => setLevel(value)} required />{label}</label>)}</fieldset>
    <label htmlFor="goals">Where would you like to feel more confident? <span className="muted">(optional)</span></label><textarea id="goals" value={goals} onChange={e => setGoals(e.target.value)} placeholder="For example: doctor’s appointments and finding a flat" maxLength={3000} disabled={!session.ai_available} />
    {!session.ai_available && <p className="muted small">Personalised guidance is available when an AI key is configured.</p>}
    <ErrorNotice error={save.error} /><button className="primary" disabled={!level || save.isPending}>{save.isPending ? 'Saving…' : 'Start learning'}</button>
  </form></div>;
}
const duration = (seconds: number) => seconds >= 3600 ? `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m` : seconds >= 60 ? `${Math.floor(seconds / 60)}m` : `${seconds}s`;
function Shell() {
  const cache = useQueryClient();
  const auth = useQuery({ queryKey: ['auth'], queryFn: async () => {
    const { data, error } = await supabase!.auth.getSession();
    if (error) throw error;
    return data.session?.user ?? null;
  }, enabled: !!supabase });
  const session = useQuery({ queryKey: ['session'], queryFn: () => api<Session>('/session') });
  const location = useLocation();
  const navigate = useNavigate();
  const ready = !!session.data?.user.level;
  useQuery({ queryKey: ['time', session.data?.user.name], queryFn: () => api<Time>('/heartbeat', {}), enabled: ready, refetchInterval: () => document.visibilityState === 'visible' ? 15000 : false });
  useEffect(() => { const heading = document.querySelector('h1'); if (heading) { heading.setAttribute('tabindex', '-1'); (heading as HTMLElement).focus(); } }, [location.pathname]);
  const switchProfile = useMutation({ mutationFn: () => api('/profile', undefined, 'DELETE'), onSuccess: () => { cache.clear(); navigate('/profile'); } });
  if (supabase && auth.isSuccess && !auth.data) return <Navigate to="/profile" replace />;
  if (session.isPending && !auth.data) return <div className="welcome"><Loading /></div>;
  if (session.error instanceof ApiError && session.error.status === 401) return <Navigate to="/profile" replace />;
  if (session.error && !auth.data) return <div className="welcome"><ErrorNotice error={session.error} /><button onClick={() => session.refetch()}>Retry</button></div>;
  if (session.data && !session.data.user.level) return <Setup session={session.data} />;
  return <><a className="skip" href="#main" onClick={e => { if (supabase) { e.preventDefault(); document.getElementById('main')?.focus(); } }}>Skip to content</a><aside className="app-sidebar" aria-label="App navigation"><Link className="brand" to="/">Vocab Garden</Link><nav aria-label="Main navigation"><NavLink end to="/">Garden</NavLink><NavLink to="/explore">Explore topics</NavLink><NavLink to="/matcher">Find words</NavLink><NavLink to="/practice">Practice</NavLink><NavLink to="/review">Review</NavLink></nav><button className="profile-button" disabled={switchProfile.isPending} onClick={() => switchProfile.mutate()}><svg className="farmer-icon" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="14" fill="#c6d9b6" /><path d="M7 39 Q7 26 20 26 Q33 26 33 39" fill="#577b59" /><path d="M14 27 L14 39 M26 27 L26 39" stroke="#a7bd84" strokeWidth="4" /><ellipse cx="20" cy="19" rx="9" ry="10" fill="#d6ac80" /><path d="M12 14 L15 5 Q20 3 25 5 L28 14" fill="#c2a367" /><path d="M7 14 Q20 10 33 14 L32 17 Q20 15 8 17Z" fill="#dfc68c" /><circle cx="17" cy="20" r="1" fill="#4c503a" /><circle cx="23" cy="20" r="1" fill="#4c503a" /><path d="M17 24 Q20 26 23 24" fill="none" stroke="#90674e" strokeWidth="1.4" strokeLinecap="round" /></svg><span className="profile-identity"><span>{session.data?.user.name ?? auth.data?.user_metadata?.name ?? auth.data?.email?.split('@')[0] ?? 'Learner'}</span><span className="profile-level">{session.data?.user.level}</span></span></button></aside>
    <div className="app-content"><main id="main" tabIndex={-1} className="container"><ErrorNotice error={switchProfile.error} />{session.isPending ? <Loading /> : session.error ? <><ErrorNotice error={session.error} /><button onClick={() => session.refetch()}>Retry</button></> : <Outlet context={session.data} />}</main>
</div>
  </>;
}
function Bag({ words }: { words: Word[] }) {
  return <aside className="panel bag" aria-label="Seed bag">
    <div className="section-heading"><h2>Seed bag</h2><span className="badge">{words.length} / 20</span></div>
    {words.length ? <><ul className="bag-words">{words.map(w => <li key={w.id}><WordTitle word={w} /></li>)}</ul><div className="actions"><Link className="button" to="/practice?scope=bag">Practice</Link><Link className="button primary" to="/review?scope=bag">Plant</Link></div></> : <><p className="muted">Your seed bag is empty.</p><Link className="button primary" to="/matcher">Find words</Link></>}
  </aside>;
}
const topicStages = [
  ['unseen', 'Unseen / Not now'],
  ['seeds', 'Seeds'],
  ['planted', 'Planted'],
  ['due', 'Review due'],
  ['grown', 'Grown / Learned'],
] as const;
function TopicProgress({ counts }: { counts: Topic['overview'] }) {
  const description = topicStages.map(([key, label]) => `${label}: ${counts[key]} words`).join(', ');
  return <span className="topic-distribution" role="img" aria-label={description}>
    <span className="topic-bar" aria-hidden="true">{topicStages.map(([key, label]) => <span key={key} className={`stage-${key}`} style={{ flexGrow: counts[key] }} title={`${label}: ${counts[key]} words`} />)}</span>
    <span className="topic-counts" aria-hidden="true">{topicStages.map(([key, label]) => <span key={key} title={`${label}: ${counts[key]} words`}><i className={`stage-${key}`} />{counts[key]}</span>)}</span>
  </span>;
}
function TopicList({ topics }: { topics: Topic[] }) {
  const { user } = useOutletContext<Session>();
  return <div className="topic-list">{topics.map(t => <Link className="topic-row topic-overview-row" key={t.id} to={`/topics/${encodeURIComponent(t.id)}`}>
    <span className="topic-name">{t.name}<span className="topic-total small muted">{Object.values(t.overview).reduce((sum, count) => sum + count, 0)} {user.level} words</span></span>
    <TopicProgress counts={t.overview} />
    <span className="topic-arrow" aria-hidden="true">→</span>
  </Link>)}</div>;
}
function Home() {
  const result = useQuery({ queryKey: ['garden'], queryFn: () => api<Garden>('/garden') });
  if (result.isPending) return <Loading />;
  if (result.error) return <ErrorNotice error={result.error} />;
  const { summary, bag, plots } = result.data!;
  const active = summary.planted_total > 0;
  return <div className="garden-home">
    <div className="garden-intro"><Heading title="Your garden" />
    <div className="garden-actions">
      {active && <Link className="button primary" to="/review">Review words{summary.due_now > 0 && <span className="action-count">{summary.due_now} due</span>}</Link>}
      <Link className={`button${active ? '' : ' primary'}`} to="/matcher">Find new words</Link>
    </div></div>
    <section className="panel garden-progress" aria-label="Learning progress">
      <dl className="progress-totals">
        <div><dt>Words planted</dt><dd>{summary.planted_total}</dd></div>
        <div><dt>Reviews due</dt><dd>{summary.due_now}</dd></div>
        <div><dt>Time today</dt><dd>{duration(summary.time.today_seconds)}</dd></div>
        <div><dt>Total time</dt><dd>{duration(summary.time.total_seconds)}</dd></div>
      </dl>
    </section>
    <GardenScene plots={plots} bagCount={bag.length} bagContent={<Bag words={bag} />} />
  </div>;
}
function ExplorePage() {
  const [filter, setFilter] = useState('');
  const result = useQuery({ queryKey: ['garden'], queryFn: () => api<Garden>('/garden') });
  if (result.isPending) return <Loading />;
  if (result.error) return <ErrorNotice error={result.error} />;
  const topics = result.data!.topics;
  const matching = topics.filter(topic => topic.name.toLowerCase().includes(filter.trim().toLowerCase()));
  return <><Heading title="Explore more topics" />
    <label className="explore-search"><span className="sr-only">Find a topic to explore</span><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Find a topic…" /></label>
    <div className="topic-legend">{topicStages.map(([key, label]) => <span key={key}><i className={`stage-${key}`} />{label}</span>)}</div>
    {matching.length ? <TopicList topics={matching} /> : <Empty>{topics.length ? 'No topics match your search.' : 'Every topic has a place in your garden.'}</Empty>}
  </>;
}
function TopicPage() {
  const { user } = useOutletContext<Session>();
  const topic = decodeURIComponent(useLocation().pathname.split('/').pop() || '');
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showOtherLevels, setShowOtherLevels] = useState(false);
  const [sort, setSort] = useState<{ key: 'lemma' | 'english' | 'level' | 'status'; descending: boolean } | null>(null);
  const [notice, setNotice] = useState('');
  const result = useQuery({ queryKey: ['topic', topic], queryFn: () => api<{ activity: Activity; words: Word[] }>(`/topics/${encodeURIComponent(topic)}`) });
  const add = useMutation({
    mutationFn: (word: Word) => api<{ added: boolean }>(`/topics/${encodeURIComponent(topic)}/words/${encodeURIComponent(word.id)}/keep`, {}),
    onSuccess: async (data, word) => {
      setNotice(data.added ? `${word.lemma} added to your seed bag.` : 'This word is already in your bag or garden.');
      await cache.invalidateQueries();
    },
  });
  if (result.isPending) return <Loading />;
  if (result.error) return <ErrorNotice error={result.error} />;
  const { activity, words } = result.data!;
  const overview = words.filter(word => word.level === user.level).reduce((counts, word) => {
    counts[word.visual_stage || 'unseen']++;
    return counts;
  }, { unseen: 0, seeds: 0, planted: 0, due: 0, grown: 0 });
  const statuses: Record<string, string> = { new: 'Unseen', not_now: 'Not now', learned: 'Learned', bag: 'In seed bag', planted: 'Planted', due: 'Review due', grown: 'Grown' };
  const visibleWords = words.filter(w => showOtherLevels || w.level === user.level || (w.status !== 'new' && w.status !== 'not_now'));
  const matching = visibleWords.filter(w => (filter === 'all' || (filter === 'due' ? w.review_due : filter === 'grown' ? w.visual_stage === 'grown' : filter === 'learned' ? w.learned : w.status === filter)) &&
    `${w.article || ''} ${w.lemma} ${w.english}`.toLowerCase().includes(search.trim().toLowerCase()));
  const statusLabel = (word: Word) => {
    const status = word.review_due ? 'Review due' : word.learned ? 'Learned' : statuses[word.status || 'new'];
    return status;
  };
  if (sort) matching.sort((a, b) => {
    const valueA = sort.key === 'status' ? statusLabel(a) : a[sort.key];
    const valueB = sort.key === 'status' ? statusLabel(b) : b[sort.key];
    const order = valueA.localeCompare(valueB, sort.key === 'lemma' ? 'de' : 'en', { numeric: true, sensitivity: 'base' });
    return (sort.descending ? -order : order) || a.lemma.localeCompare(b.lemma, 'de') || a.id.localeCompare(b.id);
  });
  const columns = [['lemma', 'Word'], ['english', 'Meaning'], ['level', 'Level'], ['status', 'Status']] as const;
  return <><div className="topic-back-links"><Link className="back" to="/">← Garden</Link><Link className="back" to="/explore">Explore topics</Link></div><div className="topic-page-heading"><Heading title={activity.name} /><ScopeLinks scope="topic" topic={topic} disabled={!words.some(w => w.status === 'planted')} /></div>
    <section className="topic-progress-summary" aria-label="Topic progress"><span className="level-progress-label">{user.level} progress</span><TopicProgress counts={overview} /></section>
    <TopicScene key={topic} plot={{ id: activity.id, name: activity.name, words: words.filter(w => w.status === 'planted' || w.learned) }} />
    <h2 className="topic-list-heading">Words</h2>
    <div className="topic-word-controls">
      <label><span className="sr-only">Search words</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search German or English…" /></label>
      <label><span className="sr-only">Word status</span><select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All statuses ({visibleWords.length})</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="other-levels-toggle"><input type="checkbox" checked={showOtherLevels} onChange={e => setShowOtherLevels(e.target.checked)} />Show other levels</label>
    </div>
    {notice && <p role="status" className="small">{notice}</p>}<ErrorNotice error={add.error} />
    {matching.length ? <div className="panel table-wrap"><table className="topic-words"><thead><tr>{columns.map(([key, label]) => <th key={key} scope="col" aria-sort={sort?.key === key ? (sort.descending ? 'descending' : 'ascending') : 'none'}><button className="table-sort" onClick={() => setSort(current => ({ key, descending: current?.key === key ? !current.descending : false }))}>{label}<span aria-hidden="true">{sort?.key === key ? (sort.descending ? '↓' : '↑') : '↕'}</span></button></th>)}<th><span className="sr-only">Seed bag</span></th></tr></thead>
      <tbody>{matching.map(w => <tr key={w.id} className={w.status === 'new' && user.level && w.level !== user.level ? 'word-outside-level' : undefined}><td><WordTitle word={w} /></td><td>{w.english}</td><td>{w.level}</td><td><span className={`badge status-chip stage-${w.visual_stage || 'unseen'}`}>{w.status === 'bag' ? <SeedIcon /> : (w.status === 'planted' || Boolean(w.learned)) ? <PlantIcon word={w} /> : null}{statusLabel(w)}</span></td>
        <td>{w.review_due && <Link className="button review-word-link" to={`/review?scope=topic&topic=${encodeURIComponent(topic)}`}>Review</Link>}{w.status !== 'bag' && w.status !== 'planted' && <button disabled={add.isPending} aria-label={`Add ${w.lemma} to seed bag`} onClick={() => add.mutate(w)}>{add.isPending && add.variables?.id === w.id ? 'Adding…' : 'Add to bag'}</button>}</td></tr>)}</tbody></table></div>
      : <Empty>No words match this view.</Empty>}
  </>;
}
function MatcherPage() {
  const { activities, ai_available } = useOutletContext<Session>();
  const [params] = useSearchParams();
  const initialTopic = params.get('topic') || '';
  const [topic, setTopic] = useState(initialTopic);
  const [guidance, setGuidance] = useState('');
  const [revealed, setRevealed] = useState(false);
  const cache = useQueryClient();
  const key = ['matcher', initialTopic];
  const result = useQuery({
    queryKey: key, queryFn: () => api<Matcher>(`/matcher?topic=${encodeURIComponent(initialTopic)}`),
    staleTime: Infinity, refetchOnMount: true, refetchOnReconnect: false,
  });
  const update = (data: Matcher) => { cache.setQueryData(key, data); cache.invalidateQueries({ queryKey: ['garden'] }); setRevealed(false); };
  const guide = useMutation({ mutationFn: (selection: { topic: string; guidance?: string }) => api<Matcher>('/guide', selection), onSuccess: update });
  const swipe = useMutation({ onMutate: () => { setRevealed(false); }, mutationFn: (action: string) => { const c = result.data!.card!; return api<Matcher>('/matcher', { action, word_id: c.word_id, activity_id: c.activity_id, sentence_id: c.sentence_id }); }, onSuccess: update });
  const loading = result.isPending || result.isFetching;
  const busy = loading || guide.isPending || swipe.isPending;
  const preview = swipe.isPending ? result.data?.previews?.[swipe.variables] : undefined;
  const card = preview?.card === undefined ? result.data?.card : preview.card;
  useEffect(() => { setRevealed(false); setTopic(initialTopic); }, [initialTopic]);
  return <>
    <Heading title="Find new words" />
    <div className="matcher-layout">
      <section className="panel matcher-selection" aria-label="Word selection">
        <label htmlFor="matcher-topic">Topic</label>
        <select id="matcher-topic" value={topic} disabled={busy} onChange={e => {
          setTopic(e.target.value);
          guide.mutate({ topic: e.target.value });
        }}>
          <option value="">Choose for me</option>
          {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {ai_available && <details className="disclosure matcher-guidance">
          <summary>Help me choose a topic</summary>
          <form className="disclosure-body" onSubmit={e => {
            e.preventDefault();
            setTopic('');
            guide.mutate({ topic: '', guidance });
          }}>
            <label htmlFor="matcher-guidance">Where will you use German?</label>
            <p id="matcher-guidance-help" className="muted small">We’ll match your description to a topic and show related words.</p>
            <textarea id="matcher-guidance" aria-describedby="matcher-guidance-help" value={guidance} onChange={e => setGuidance(e.target.value)} placeholder="A wine evening with friends" maxLength={3000} disabled={busy} required />
            <button disabled={busy || !guidance.trim()}>{guide.isPending ? 'Matching…' : 'Match a topic'}</button>
          </form>
        </details>}
        {guide.isPending && <p className="muted small" role="status">Finding words…</p>}
        <ErrorNotice error={guide.error} />
      </section>
      <section className="matcher-study" aria-label="Current word" aria-busy={busy}>
        {loading ? <Loading /> : result.error ? <ErrorNotice error={result.error} /> : card ? <>
          <div className="panel matcher-card">
          <p className="eyebrow">{card.activity_name || 'Core vocabulary'}</p>
          <WordCard key={card.word_id} word={card} revealed={revealed} onReveal={() => setRevealed(true)} />
          <div className="card-actions">
            <button disabled={busy} onClick={() => swipe.mutate('not_now')}>Not now</button>
            <button disabled={busy} onClick={() => swipe.mutate('learned')}>Already learned</button>
            <button className="primary" disabled={busy} onClick={() => swipe.mutate('keep')}>Keep word</button>
          </div>
          </div>
        </> : <Empty><h2>No more words in this selection</h2><p>Choose another topic.</p></Empty>}
        {swipe.isPending && <p className="muted small" role="status">Saving your choice…</p>}
        <ErrorNotice error={swipe.error} />
        {swipe.error && <button onClick={() => result.refetch()}>Refresh card</button>}
      </section>
      <Bag words={result.data?.bag || []} />
    </div>
  </>;
}
function reviewDelay(seconds: number) {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hr`;
  const days = Math.round(seconds / 86400 * 10) / 10;
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}
function ReviewPage() {
  const { scope, topic, query, label } = useScope();
  const cache = useQueryClient();
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set());
  const key = ['review', scope, topic];
  const result = useQuery({ queryKey: key, queryFn: () => api<{ card: Card | null; remaining: number; counts: { plants: number; seeds: number } }>(`/review${query}`), staleTime: Infinity, refetchOnMount: 'always' });
  const grade = useMutation({ mutationFn: (value: number) => api<{ card: Card | null; remaining: number; counts: { plants: number; seeds: number } }>('/review', { word_id: result.data!.card!.word_id, grade: value, scope, topic }), onSuccess: data => { const reviewedId = result.data!.card!.word_id; cache.setQueryData(key, data); cache.invalidateQueries({ queryKey: ['review'], refetchType: 'none' }); cache.invalidateQueries({ queryKey: ['garden'] }); cache.invalidateQueries({ queryKey: ['topic'] }); cache.invalidateQueries({ queryKey: ['matcher'] }); cache.invalidateQueries({ queryKey: ['practice'] }); cache.invalidateQueries({ queryKey: ['flashcards'] }); setRevealed(false); setReviewed(previous => new Set([...previous, reviewedId])); } });
  const card = result.data?.card;
  useEffect(() => { setRevealed(false); setReviewed(new Set()); }, [query]);
  return <><div className="practice-heading-row"><Heading title="Review">{scope === 'topic' ? label : undefined}</Heading><WordSetSwitch page="/review" counts={result.data?.counts} /></div><div className="study">
    {result.data && <div className="review-progress">
      <div className="review-progress-counts"><span>{reviewed.size} reviewed</span><span>{result.data.remaining} to review</span></div>
      <progress aria-label="Review progress" aria-valuetext={`${reviewed.size} words reviewed this visit, ${result.data.remaining} words to review`} value={reviewed.size} max={Math.max(1, reviewed.size + result.data.remaining)} />
    </div>}{result.isPending ? <Loading /> : result.error ? <ErrorNotice error={result.error} /> : card ? <><WordCard key={card.word_id} word={card} revealed={revealed} onReveal={() => setRevealed(true)} />{revealed && <div className="grade-actions">{card.rating_options?.map(option => <button key={option.grade} disabled={grade.isPending} className={option.grade === 3 ? 'primary' : ''} onClick={() => grade.mutate(option.grade)}>
  <strong>{['Again', 'Hard', 'Good', 'Easy'][option.grade - 1]}</strong>
  <span className="rating-delay">In {reviewDelay(option.next_review_seconds)}</span>
  <span className="rating-growth">{scope === 'bag' ? 'Plants seed' : option.grade === 1 ? 'Needs more care' : option.growth > (card.growth ?? 0) ? 'Plant grows' : 'Waters plant'}</span>
</button>)}</div>}</> : <Empty>{scope === 'bag' && reviewed.size > 0 ? 'Your seeds are planted.' : scope === 'bag' ? 'No seeds to review.' : 'All caught up! No words are due for review.'} <Link to="/matcher">Find new words</Link>.</Empty>}<ErrorNotice error={grade.error} /></div></>;
}
function PracticePage() {
  const { scope, query, label } = useScope();
  const { ai_available } = useOutletContext<Session>();
  const result = useQuery({ queryKey: ['practice', query], queryFn: () => api<{ words: Word[]; counts: { plants: number; seeds: number } }>(`/practice${query}`) });
  const modes = [ ['flashcards', 'Flashcards', 'Browse your words and reveal their translations.'], ['chat', 'Conversation', 'Practise your words in a short German conversation.'], ['read', 'Reading', 'Read a short passage written around your vocabulary.'], ['grammar', 'Grammar playground', 'Explore word forms and get feedback on your own sentences.'] ];
  return <><div className="practice-heading-row"><Heading title="Practice">{scope === 'topic' ? label : undefined}</Heading>
    <WordSetSwitch page="/practice" counts={result.data?.counts} /></div>
    {result.isPending ? <Loading /> : result.error ? <ErrorNotice error={result.error} /> : !result.data?.words.length ? <Empty>No words in this set yet. <Link to="/matcher">Find new words</Link> or practise your <Link to="/practice?scope=bag">seed bag</Link>.</Empty> : <div className="practice-grid">
    {modes.map(([path, title, description]) => <article className="panel" key={path}><h2>{title}</h2><p className="muted">{description}</p>{path === 'flashcards' || ai_available ? <Link className="button" to={`/practice/${path}${query}`}>Start {title.toLowerCase()} →</Link> : <p className="muted small">Needs ANTHROPIC_API_KEY in your local .env file.</p>}</article>)}</div>}</>;
}
function Flashcards() {
  const { query, label } = useScope();
  const result = useQuery({ queryKey: ['flashcards', query], queryFn: () => api<{ cards: Word[] }>(`/flashcards${query}`), staleTime: Infinity, refetchOnMount: 'always' });
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { setIndex(0); setRevealed(false); }, [result.data, query]);
  const cards = result.data?.cards || [];
  const move = (next: number) => { setIndex(next); setRevealed(false); };
  return <><Link className="back" to={`/practice${query}`}>← Practice</Link><Heading title="Flashcards">{label}{cards.length && index < cards.length ? ` · ${index + 1} / ${cards.length}` : ''}</Heading>
    <div className="study">{result.isPending ? <Loading /> : result.error ? <ErrorNotice error={result.error} /> : !cards.length ? <Empty>No words in this deck yet.</Empty> : index < cards.length ? <>
      <WordCard word={cards[index]} revealed={revealed} onReveal={() => setRevealed(true)} />
      <div className="card-actions"><button disabled={index === 0} onClick={() => move(index - 1)}>Previous</button><button className="primary" onClick={() => move(index + 1)}>{index === cards.length - 1 ? 'Finish deck' : 'Next'}</button></div>
    </> : <Empty><h2>Deck complete</h2><div className="actions"><button onClick={() => move(0)}>Go through again</button><Link className="button" to={`/practice${query}`}>Back to practice</Link></div></Empty>}</div>
  </>;
}
function Corrections({ items }: { items?: Correction[] }) { return <>{items?.map((c,i) => <div className="correction" key={i}><s lang="de">{c.original}</s> → <strong lang="de">{c.corrected}</strong><p>{c.note}</p></div>)}</>; }
function AiPractice({ mode }: { mode: 'chat' | 'read' | 'grammar' }) {
  const { scope, topic, query, label } = useScope();
  const { ai_available } = useOutletContext<Session>();
  const words = useQuery({ queryKey: ['practice', query], queryFn: () => api<{ words: Word[]; grammar_options: GrammarOptions }>(`/practice${query}`) });
  const [chat, setChat] = useState<Chat | null>(null);
  const [message, setMessage] = useState('');
  const [showTranslation, setShowTranslation] = useState(false);
  const [wordId, setWordId] = useState('');
  const [wordSearch, setWordSearch] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [sentence, setSentence] = useState('');
  const selected = words.data?.words.find(w => w.id === wordId) || words.data?.words[0];
  const chatCall = useMutation({ mutationFn: () => api<Chat>('/chat', { scope, topic, message, history: chat?.history || [], target_ids: chat?.targets.map(t => t.id) || [] }), onSuccess: data => { setChat(data); setMessage(''); } });
  const reading = useMutation({ mutationFn: () => api<{ targets: Word[]; text: { setting: string; de: string; en: string } }>('/reading', { scope, topic }), onSuccess: () => setShowTranslation(false) });
  const grammar = useMutation({ mutationFn: (action: string) => api<Grammar>('/grammar', { word_id: selected?.id, config, sentence, action }) });
  const titles = { chat: 'Conversation', read: 'Reading', grammar: 'Grammar playground' };
  return <><Link className="back" to={`/practice${query}`}>← Practice</Link><Heading title={titles[mode]}>{scope === 'all' ? undefined : label}</Heading>{!ai_available ? <Empty>AI practice is not configured yet. Ask the garden owner to enable it.</Empty> : words.isPending ? <Loading /> : words.error ? <ErrorNotice error={words.error} /> : !words.data?.words.length ? <Empty>No words in this practice set yet. <Link to="/matcher">Find words</Link>.</Empty> : <div className={`study wide${mode === 'grammar' ? ' grammar-study' : ' ai-study'}`}>
    {mode === 'chat' && <>{chat && <div className="chips">{chat.targets.map(w => <span className={`badge ${chat.used.includes(w.lemma) ? 'used' : ''}`} key={w.id}><WordTitle word={w} />{chat.used.includes(w.lemma) ? ' ✓' : ''}</span>)}</div>}{chat && <div className="chat-log" aria-live="polite">{chat?.history.map((m,i) => <article className={`panel message ${m.role}`} key={i}><p className="eyebrow">{m.role === 'user' ? 'You' : 'Conversation partner'}</p><p lang="de">{m.content}</p><Corrections items={m.corrections} /></article>)}</div>}{!chat ? <button className="primary" disabled={chatCall.isPending} onClick={() => chatCall.mutate()}>{chatCall.isPending ? 'Starting conversation…' : 'Start conversation'}</button> : <form className="input-row" onSubmit={e => { e.preventDefault(); chatCall.mutate(); }}><label className="flex">Your reply in German<input value={message} onChange={e => setMessage(e.target.value)} maxLength={3000} required disabled={chatCall.isPending} autoComplete="off" /></label><button className="primary" disabled={chatCall.isPending || !message.trim()}>{chatCall.isPending ? 'Replying…' : 'Send'}</button></form>}<ErrorNotice error={chatCall.error} /></>}
    {mode === 'read' && <><button className="primary" disabled={reading.isPending} onClick={() => reading.mutate()}>{reading.isPending ? 'Writing passage…' : reading.data ? 'New passage' : 'Start reading'}</button><ErrorNotice error={reading.error} />{reading.data && <><div className="chips">{reading.data.targets.map(w => <span className="badge" key={w.id}><WordTitle word={w} /></span>)}</div><article className="panel reading"><p className="eyebrow">{reading.data.text.setting}</p><p lang="de">{reading.data.text.de}</p><button aria-expanded={showTranslation} onClick={() => setShowTranslation(s => !s)}>{showTranslation ? 'Hide translation' : 'Show English translation'}</button>{showTranslation && <p className="translation">{reading.data.text.en}</p>}</article></>}</>}
    {mode === 'grammar' && <div className="grammar-layout">
      <aside className="grammar-word-picker" aria-label="Practice words">
        <label htmlFor="grammar-word-search">Words</label><input id="grammar-word-search" placeholder="Find a word…" value={wordSearch} onChange={e => setWordSearch(e.target.value)} />
        <ul className="grammar-word-list">{words.data.words.filter(w => `${w.lemma} ${w.english}`.toLowerCase().includes(wordSearch.trim().toLowerCase())).map(w => <li key={w.id}>
          <button aria-pressed={selected?.id === w.id} disabled={grammar.isPending} onClick={() => { setWordId(w.id); setConfig({}); setSentence(''); grammar.reset(); }}><span><WordTitle word={w} /></span><span className="small muted">{w.english}</span></button>
        </li>)}</ul>
        {!words.data.words.some(w => `${w.lemma} ${w.english}`.toLowerCase().includes(wordSearch.trim().toLowerCase())) && <p className="small muted">No matching words.</p>}
      </aside>
      <div className="grammar-workspace"><div className="panel"><h2><WordTitle word={selected!} /></h2><div className="input-row grammar-options">{Object.entries(words.data?.grammar_options[selected?.pos || ''] || {}).map(([key, values]) => <label className="flex" key={key}>{key[0].toUpperCase()+key.slice(1)}<select value={config[key] || values[0]} disabled={grammar.isPending} onChange={e => { setConfig(c => ({ ...c, [key]: e.target.value })); grammar.reset(); }}>{values.map(value => <option key={value} value={value}>{grammarLabels[value] || value}</option>)}</select></label>)}</div><button disabled={grammar.isPending} onClick={() => grammar.mutate('generate')}>{grammar.isPending ? 'Working…' : 'Generate example'}</button><hr /><form onSubmit={e => { e.preventDefault(); grammar.mutate('correct'); }}><label htmlFor="sentence">Or write your own German sentence</label><textarea id="sentence" value={sentence} onChange={e => setSentence(e.target.value)} maxLength={3000} required disabled={grammar.isPending} /><button className="primary" disabled={grammar.isPending || !sentence.trim()}>Check sentence</button></form></div><ErrorNotice error={grammar.error} />{grammar.data && <article className="panel grammar-result" aria-live="polite">{grammar.data.expected_form && <p>Target form: <strong lang="de">{grammar.data.expected_form}</strong></p>}{grammar.data.de && <p className="sentence" lang="de">{grammar.data.de}</p>}{grammar.data.en && <p className="muted">{grammar.data.en}</p>}{grammar.data.meets_config !== undefined && <p>{grammar.data.meets_config ? 'The target word matches the chosen form.' : 'The target word does not match the chosen form yet.'}</p>}<Corrections items={grammar.data.corrections} /><p>{grammar.data.focus || grammar.data.grammar_focus}</p></article>}</div></div>}
  </div>}</>;
}
function AiRoute({ mode }: { mode: 'chat' | 'read' | 'grammar' }) {
  const location = useLocation();
  return <AiPractice key={`${mode}:${location.search}`} mode={mode} />;
}
function App() {
  return <Routes><Route path="/profile" element={supabase ? <CloudLogin /> : <Profile />} /><Route element={<Shell />}><Route index element={<Home />} /><Route path="explore" element={<ExplorePage />} /><Route path="topics/:topic" element={<TopicPage />} /><Route path="matcher" element={<MatcherPage />} /><Route path="review" element={<ReviewPage />} /><Route path="practice" element={<PracticePage />} /><Route path="practice/flashcards" element={<Flashcards />} /><Route path="practice/chat" element={<AiRoute mode="chat" />} /><Route path="practice/read" element={<AiRoute mode="read" />} /><Route path="practice/grammar" element={<AiRoute mode="grammar" />} /><Route path="*" element={<Empty>Page not found. <Link to="/">Go to your garden</Link>.</Empty>} /></Route></Routes>;
}
const Router = supabase ? HashRouter : BrowserRouter;
if (supabase) supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') client.clear(); });
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={client}><Router><App /></Router></QueryClientProvider></React.StrictMode>);
