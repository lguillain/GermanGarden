import { cloudApiUrl, publishableKey, supabase } from './supabase';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const requestMethod = method ?? (body === undefined ? 'GET' : 'POST');
  if (supabase && path === '/profile' && requestMethod === 'DELETE') {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw new ApiError(503, error.message);
    return { ok: true } as T;
  }
  const headers: Record<string, string> =
    body === undefined ? {} : { 'Content-Type': 'application/json' };
  if (supabase) {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw new ApiError(401, 'Please sign in.');
    headers.Authorization = `Bearer ${data.session.access_token}`;
    headers.apikey = publishableKey;
  }
  let response: Response;
  try {
    response = await fetch(`${supabase ? cloudApiUrl : '/api'}${path}`, {
      method: requestMethod,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the app. Check your connection and try again.');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const fallback =
      requestMethod === 'GET'
        ? `Could not load this page (error ${response.status}). Please reload.`
        : `Could not complete this action (error ${response.status}). Please try again.`;
    const detail = typeof result?.detail === 'string' ? result.detail : fallback;
    throw new ApiError(response.status, detail);
  }
  if (result === null) {
    throw new ApiError(
      response.status,
      'The server returned an unexpected response. Please reload the app.',
    );
  }
  return result as T;
}
export interface Word {
  id: string;
  word_id?: string;
  lemma: string;
  article?: string;
  plural?: string;
  pos: string;
  english: string;
  level: string;
  de?: string;
  en?: string;
  growth?: number;
  review_due?: boolean;
  visual_stage?: 'unseen' | 'seeds' | 'planted' | 'due' | 'grown';
  status?: 'new' | 'not_now' | 'learned' | 'bag' | 'planted';
  learned?: boolean;
  interval_days?: number;
  reps?: number;
}
export interface Card extends Word {
  rating_options?: { grade: number; next_review_seconds: number; growth: number }[];
  word_id: string;
  activity_id: string | null;
  activity_name: string;
  sentence_id: number;
}
export interface Activity {
  id: string;
  name: string;
  description?: string;
}
export interface Session {
  user: { name: string; level: string | null; swipes: number };
  ai_available: boolean;
  activities: Activity[];
}
export interface Time {
  today_seconds: number;
  total_seconds: number;
  current_session_seconds: number;
  timer_seconds: number;
}
export interface Topic extends Activity {
  overview: Record<'unseen' | 'seeds' | 'planted' | 'due' | 'grown', number>;
  total: number;
  planted: number;
  grown_pct: number;
  planted_pct: number;
  seed_bag_here: number;
}
export interface GardenPlot {
  id: string;
  name: string;
  words: Word[];
}
export interface Garden {
  plots: GardenPlot[];
  topics: Topic[];
  bag: Word[];
  summary: {
    bag_count: number;
    bag_cap: number;
    due_now: number;
    planted_total: number;
    time: Time;
  };
}
export interface Matcher {
  card: Card | null;
  bag: Word[];
  previews?: Partial<Record<string, { card: Card | null; bag: Word[] }>>;
}
export interface Correction {
  original: string;
  corrected: string;
  note: string;
}
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  corrections?: Correction[];
}
export interface Chat {
  targets: Word[];
  history: Message[];
  used: string[];
}
export interface Grammar {
  expected_form?: string;
  de?: string;
  en?: string;
  focus?: string;
  meets_config?: boolean;
  corrections?: Correction[];
  grammar_focus?: string;
}
export type GrammarOptions = Record<string, Record<string, string[]>>;
