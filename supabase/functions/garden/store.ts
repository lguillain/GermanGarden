import type { SupabaseClient } from '@supabase/supabase-js';
import { Learner, ReviewSelection, requireThat } from './model.ts';
import type { Store, Snapshot } from './service.ts';
import type { Measure } from './timing.ts';
import { progressChanges } from './persistence.ts';
import { scopedProgressRequest } from './progress-request.ts';
import type { ContextDocument } from './word-context.ts';

// This adapter owns database access and the baseline used for atomic writes.
interface StoreOptions {
  userId: string;
  name: string;
  measure: Measure;
  matcher: boolean;
  scoped: ReturnType<typeof scopedProgressRequest>;
}
// Successful list and RPC responses carry data; maybeSingle callers include null in T.
type QueryResult<T> = PromiseLike<{ data: T | null; error: unknown }>;

export function createStore(admin: SupabaseClient, options: StoreOptions): Store {
  const { userId, name, measure, matcher, scoped } = options;
  let snapshot: Snapshot | undefined;
  let loadFunction = 'load_learner_progress';
  if (scoped) loadFunction = 'load_scoped_progress';
  else if (matcher) loadFunction = 'load_matcher_progress';
  const contextKey = (key: string, shared: boolean) => `${shared ? 'shared' : userId}:${key}`;
  // Time a query (when labelled) and surface database errors to the HTTP layer.
  async function query<T>(label: string | null, operation: () => QueryResult<T>): Promise<T> {
    const { data, error } = await (label ? measure(label, operation) : operation());
    if (error) throw error;
    return data as T;
  }
  const rpc = <T = unknown>(label: string | null, fn: string, args: Record<string, unknown>) =>
    query<T>(label, () => admin.rpc(fn, args));
  return {
    context: {
      async read(key, shared) {
        const data = await query<{ content: ContextDocument } | null>(null, () =>
          admin
            .from('word_context_documents')
            .select('content')
            .eq('key', contextKey(key, shared))
            .maybeSingle(),
        );
        return data?.content ?? null;
      },
      claim: (key, shared, token) =>
        rpc(null, 'claim_word_context', {
          p_key: contextKey(key, shared),
          p_user_id: shared ? null : userId,
          p_token: token,
        }),
      async finish(key, shared, token, content) {
        const data = await rpc(null, 'finish_word_context', {
          p_key: contextKey(key, shared),
          p_token: token,
          p_content: content,
        });
        return data === true;
      },
    },
    keepTopicWord: (wordId, topic) =>
      rpc('keep', 'keep_topic_word', {
        p_user_id: userId,
        p_name: name,
        p_word_id: wordId,
        p_topic: topic,
      }),
    review: (scope, topic, excluded = [], mode = 'mixed') =>
      rpc<ReviewSelection>('review', 'load_review_selection', {
        p_excluded: excluded,
        p_mode: mode,
        p_user_id: userId,
        p_scope: scope,
        p_topic: topic,
      }),
    practiceSummary: (topic) =>
      rpc('practice_summary', 'load_practice_summary', { p_user_id: userId, p_topic: topic }),
    async associations(wordId) {
      const data = await query('associations', () =>
        admin.from('word_associations').select('related_id').eq('word_id', wordId).order('rank'),
      );
      return data.map((row) => row.related_id as string);
    },
    async verbObjects(wordId, pos) {
      if (pos !== 'verb' && pos !== 'noun') return [];
      const data = await query('verb_objects', () =>
        admin
          .from('verb_objects')
          .select('verb_id,noun_id,phrase')
          .eq(pos === 'verb' ? 'verb_id' : 'noun_id', wordId)
          .order('phrase'),
      );
      return data.map((row) => ({
        related_id: (pos === 'verb' ? row.noun_id : row.verb_id) as string,
        phrase: row.phrase as string,
      }));
    },
    async profile() {
      const data = await query<{ name: string; level: string | null } | null>('profile', () =>
        admin.from('learner_profiles').select('name, level').eq('user_id', userId).maybeSingle(),
      );
      return data ?? { name, level: null };
    },
    async load() {
      snapshot = await rpc<Snapshot>('progress', loadFunction, {
        p_user_id: userId,
        p_name: name,
        ...scoped,
      });
      // Keep the comparison baseline separate from mutable domain state.
      return structuredClone(snapshot);
    },
    async save(version, data: Learner) {
      requireThat(!scoped, 'Read-only progress cannot be saved.', 500);
      requireThat(
        snapshot && snapshot.version === version,
        'Progress must be loaded before saving.',
        500,
      );
      const saved = matcher
        ? await rpc('save', 'save_matcher_progress', {
            p_user_id: userId,
            p_version: version,
            p_user: data.user,
            p_swipes: data.swipes.slice(snapshot.data.swipes.length),
            p_known: data.known.slice(snapshot.data.known.length),
          })
        : await rpc('save', 'save_learner_progress', {
            p_user_id: userId,
            p_version: version,
            p_changes: progressChanges(snapshot.data, data),
          });
      return saved === true;
    },
  };
}
