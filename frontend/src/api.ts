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
  const headers: Record<string, string> =
    body === undefined ? {} : { 'Content-Type': 'application/json' };
  if (!supabase) throw new ApiError(503, 'Supabase is not configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new ApiError(401, 'Please sign in.');
  headers.Authorization = `Bearer ${data.session.access_token}`;
  headers.apikey = publishableKey;
  let response: Response;
  try {
    response = await fetch(`${cloudApiUrl}${path}`, {
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
  production_unlocked?: boolean;
  production_growth?: number;
  can_mark_learned?: boolean;
  track?: 'recognition' | 'production';
  review_due?: boolean;
  overdue_since?: string | null;
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
  user: { name: string; level: string | null };
  ai_available: boolean;
}
export interface Topic extends Activity {
  overview: Record<'unseen' | 'seeds' | 'planted' | 'due' | 'grown', number>;
  total: number;
  planted: number;
}
export interface GardenPlot {
  id: string;
  name: string;
  words: Word[];
}
export interface Garden {
  level_up?: {
    current_level: string;
    next_level: string;
    all_learned: boolean;
  } | null;
  plots: GardenPlot[];
  topics: Topic[];
  bag: Word[];
  summary: {
    bag_count: number;
    bag_cap: number;
    due_now: number;
    due_today?: number;
    found_today?: number;
    upcoming_reviews?: { date: string; count: number }[];
    planted_total: number;
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
