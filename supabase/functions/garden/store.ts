import type { SupabaseClient } from '@supabase/supabase-js';
import { Learner, ReviewSelection, requireThat } from './model.ts';
import type { Store, Snapshot } from './service.ts';
import type { Measure } from './timing.ts';
import { progressChanges } from './persistence.ts';
import { scopedProgressRequest } from './progress-request.ts';

// This adapter owns database access and the baseline used for atomic writes.
interface StoreOptions {
  userId: string;
  name: string;
  measure: Measure;
  matcher: boolean;
  scoped: ReturnType<typeof scopedProgressRequest>;
}

export function createStore(admin: SupabaseClient, options: StoreOptions): Store {
  const { userId, name, measure, matcher, scoped } = options;
  let snapshot: Snapshot | undefined;
  let loadFunction = 'load_learner_progress';
  if (scoped) loadFunction = 'load_scoped_progress';
  else if (matcher) loadFunction = 'load_matcher_progress';
  return {
    async keepTopicWord(wordId, topic) {
      const { data, error } = await measure('keep', () =>
        admin.rpc('keep_topic_word', {
          p_user_id: userId,
          p_name: name,
          p_word_id: wordId,
          p_topic: topic,
        }),
      );
      if (error) throw error;
      return data;
    },
    async review(scope, topic, excluded = []) {
      const { data, error } = await measure('review', () =>
        admin.rpc('load_review_selection', {
          p_excluded: excluded,
          p_user_id: userId,
          p_scope: scope,
          p_topic: topic,
        }),
      );
      if (error) throw error;
      return data as ReviewSelection;
    },
    async practiceSummary(topic) {
      const { data, error } = await measure('practice_summary', () =>
        admin.rpc('load_practice_summary', { p_user_id: userId, p_topic: topic }),
      );
      if (error) throw error;
      return data;
    },
    async profile() {
      const { data, error } = await measure('profile', () =>
        admin.from('learner_profiles').select('name, level').eq('user_id', userId).maybeSingle(),
      );
      if (error) throw error;
      return data ?? { name, level: null };
    },
    async load() {
      const { data, error } = await measure('progress', () =>
        admin.rpc(loadFunction, { p_user_id: userId, p_name: name, ...scoped }),
      );
      if (error) throw error;
      snapshot = data as Snapshot;
      // Keep the comparison baseline separate from mutable domain state.
      return structuredClone(snapshot);
    },
    async save(version, data) {
      requireThat(!scoped, 'Read-only progress cannot be saved.', 500);
      requireThat(
        snapshot && snapshot.version === version,
        'Progress must be loaded before saving.',
        500,
      );
      if (matcher) {
        const result = await measure('save', () =>
          admin.rpc('save_matcher_progress', {
            p_user_id: userId,
            p_version: version,
            p_user: data.user,
            p_swipes: data.swipes.slice(snapshot!.data.swipes.length),
            p_known: data.known.slice(snapshot!.data.known.length),
          }),
        );
        if (result.error) throw result.error;
        return result.data === true;
      }
      const changes = progressChanges(snapshot.data, data);
      const result = await measure('save', () =>
        admin.rpc('save_learner_progress', {
          p_user_id: userId,
          p_version: version,
          p_changes: changes,
        }),
      );
      if (result.error) throw result.error;
      return result.data === true;
    },
  };
}
