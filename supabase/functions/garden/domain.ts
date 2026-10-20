import {
  Catalog,
  Learner,
  Word,
  Sentence,
  ReviewSelection,
  freshLearner,
  requireThat,
  shuffle,
} from './model.ts';
import { initialSrs, growth, reviewOutcome, REVIEW_GRADES } from './scheduler.ts';

// Stable per decision so a preview and its later confirmed response select the
// same card. Concurrent progress changes still cause selection to be recomputed.
function decisionRandom(seed: string) {
  let value = 2166136261;
  for (const char of seed) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return () => {
    value += 0x6d2b79f5;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function buildCatalogIndex(catalog: Catalog) {
  const topics = new Map<string, Set<string>>();
  const sentences = new Map<string, Sentence[]>();
  for (const row of catalog.word_activities) {
    if (!topics.has(row.word_id)) topics.set(row.word_id, new Set());
    topics.get(row.word_id)!.add(row.activity_id);
  }
  for (const sentence of catalog.sentences) {
    if (!sentences.has(sentence.word_id)) sentences.set(sentence.word_id, []);
    sentences.get(sentence.word_id)!.push(sentence);
  }
  return { topics, sentences, words: new Map(catalog.words.map((word) => [word.id, word])) };
}
const catalogIndexes = new WeakMap<Catalog, ReturnType<typeof buildCatalogIndex>>();
function catalogIndex(catalog: Catalog) {
  let index = catalogIndexes.get(catalog);
  if (!index) {
    index = buildCatalogIndex(catalog);
    catalogIndexes.set(catalog, index);
  }
  return index;
}

export const grammarOptions: Record<string, Record<string, string[]>> = {
  noun: { case: ['Nominativ', 'Akkusativ', 'Dativ', 'Genitiv'], number: ['Singular', 'Plural'] },
  verb: {
    tense: [
      'Präsens',
      'Perfekt',
      'Präteritum',
      'Plusquamperfekt',
      'Futur I',
      'Konjunktiv II',
      'Imperativ',
    ],
    person: ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'],
  },
  adj: {
    degree: ['Positiv', 'Komparativ', 'Superlativ'],
    declension: ['stark (no article)', 'schwach (der/die/das)', 'gemischt (ein/kein/mein)'],
  },
};
// Keep these limits visible beside the rules that enforce them.
const SEED_BAG_CAPACITY = 20;
const LEVELS = ['A1', 'A2', 'B1'];
const SECONDS_PER_DAY = 86_400;
const PRACTICE_TARGET_COUNT = 5;
const SESSION_IDLE_SECONDS = 90;
const TIMER_SECONDS = 300;

export class Garden {
  constructor(
    public catalog: Catalog,
    public state: Learner,
    public now = Date.now(),
  ) {}
  private random = Math.random;
  iso() {
    return new Date(this.now).toISOString();
  }
  topic(id: string) {
    const topic = this.catalog.activities.find((a) => a.id === id);
    requireThat(topic, 'Unknown topic.');
    return topic;
  }
  word(id: string) {
    const word = catalogIndex(this.catalog).words.get(id);
    requireThat(word, 'Unknown word.', 404);
    return word;
  }
  inTopic(id: string, topic: string) {
    return !topic || !!catalogIndex(this.catalog).topics.get(id)?.has(topic);
  }
  kept(id: string) {
    return this.state.swipes.find((s) => s.word_id === id && s.action === 'keep');
  }
  learned(id: string) {
    return this.state.known.includes(id) || this.state.learned.includes(id);
  }
  due(id: string) {
    const srs = this.state.srs[id];
    return !srs || Date.parse(srs.due_at || '') <= this.now;
  }
  details(word: Word) {
    const kept = this.kept(word.id);
    const learned = this.learned(word.id);
    const srs = this.state.srs[word.id];
    const stage = growth(srs, learned);
    // Only scheduled plants wilt. Learned words stay fully grown permanently.
    const reviewDue = Boolean(kept?.planted_at && srs && this.due(word.id) && !learned);

    let status: 'new' | 'not_now' | 'learned' | 'bag' | 'planted';
    if (kept) status = kept.planted_at ? 'planted' : 'bag';
    else if (learned) status = 'learned';
    else if (this.state.swipes.some((swipe) => swipe.word_id === word.id)) status = 'not_now';
    else status = 'new';

    let visualStage: 'unseen' | 'seeds' | 'planted' | 'due' | 'grown';
    if (reviewDue) visualStage = 'due';
    else if (learned || stage === 5) visualStage = 'grown';
    else if (status === 'planted') visualStage = 'planted';
    else if (status === 'bag') visualStage = 'seeds';
    else visualStage = 'unseen';

    return {
      ...word,
      growth: stage,
      learned,
      review_due: reviewDue,
      status,
      interval_days: srs?.interval_days || 0,
      reps: srs?.reps || 0,
      visual_stage: visualStage,
    };
  }
  sentence(word: Word, topic = '') {
    const sentences = catalogIndex(this.catalog).sentences.get(word.id) || [];
    const preferred = topic ? sentences.filter((s) => s.activity_id === topic) : [];
    const sentence = shuffle(preferred.length ? preferred : sentences, this.random)[0];
    return {
      ...this.details(word),
      word_id: word.id,
      sentence_id: sentence?.id ?? null,
      de: sentence?.text || '',
      en: sentence?.english || '',
      activity_id: topic || sentence?.activity_id || null,
      activity_name:
        this.catalog.activities.find((a) => a.id === (topic || sentence?.activity_id))?.name || '',
    };
  }
  bag() {
    const kept = new Map<string, (typeof this.state.swipes)[number]>();
    for (const swipe of this.state.swipes)
      if (swipe.action === 'keep' && !kept.has(swipe.word_id)) kept.set(swipe.word_id, swipe);
    return this.catalog.words
      .filter((word) => kept.has(word.id) && !kept.get(word.id)!.planted_at)
      .map((word) => this.details(word));
  }
  // "all" means planted words across topics. Seeds always have their own set.
  scope(scope = 'all', topic = '') {
    requireThat(['all', 'topic', 'bag'].includes(scope), 'Unknown word set.');
    if (scope === 'topic') this.topic(topic);

    return this.catalog.words.filter((word) => {
      const kept = this.kept(word.id);
      if (!kept) return false;
      if (scope === 'bag') return !kept.planted_at;
      if (!kept.planted_at) return false;
      return scope !== 'topic' || this.inTopic(word.id, topic);
    });
  }

  reviewWords(scope = 'all', topic = '') {
    return this.scope(scope, topic).filter((word) => !this.learned(word.id) && this.due(word.id));
  }

  counts(topic = '', review = false) {
    const countWords = (scope: string, selectedTopic = '') => {
      const words = review
        ? this.reviewWords(scope, selectedTopic)
        : this.scope(scope, selectedTopic);
      return words.length;
    };
    return {
      plants: countWords(topic ? 'topic' : 'all', topic),
      seeds: countWords('bag'),
    };
  }

  review(scope = 'all', topic = '') {
    // Unscheduled words come first, then the earliest due date. Keep catalogue
    // order for ties, matching load_review_selection's word-ID ordering.
    const words = this.reviewWords(scope, topic).sort((first, second) => {
      const firstSchedule = this.state.srs[first.id];
      const secondSchedule = this.state.srs[second.id];
      const scheduledOrder = Number(Boolean(firstSchedule)) - Number(Boolean(secondSchedule));
      return (
        scheduledOrder ||
        Date.parse(firstSchedule?.due_at || '') - Date.parse(secondSchedule?.due_at || '')
      );
    });
    const nextWord = words[0];
    const card = nextWord ? this.reviewCard(nextWord, scope === 'topic' ? topic : '') : null;
    return { card, remaining: words.length, counts: this.counts(topic, true) };
  }
  reviewCard(word: Word, topic = '') {
    const srs = this.state.srs[word.id] || initialSrs();
    return {
      ...this.sentence(word, topic),
      rating_options: REVIEW_GRADES.map((grade) => {
        const outcome = reviewOutcome(srs, grade);
        return {
          grade,
          growth: growth(outcome),
          next_review_seconds: Math.trunc(outcome.interval_days * SECONDS_PER_DAY),
        };
      }),
    };
  }
  grade(id: string, grade: number, scope = 'all', topic = '') {
    const eligible = this.reviewWords(scope, topic).some((word) => word.id === id);
    requireThat(
      eligible,
      'This word is no longer due in this review set. Refresh to continue.',
      409,
    );

    const outcome = reviewOutcome(this.state.srs[id] || initialSrs(), grade);
    const delaySeconds = Math.trunc(outcome.interval_days * SECONDS_PER_DAY);
    this.state.srs[id] = {
      ...outcome,
      due_at: new Date(this.now + delaySeconds * 1000).toISOString(),
      last_grade: grade,
      last_review_at: this.iso(),
    };

    // Every rating plants just this seed, even "Again". Practice never calls this.
    for (const swipe of this.state.swipes) {
      if (swipe.word_id === id && swipe.action === 'keep' && !swipe.planted_at) {
        swipe.planted_at = this.iso();
      }
    }
    this.state.reviews.push({ word_id: id, grade, reviewed_at: this.iso() });
    return this.review(scope, topic);
  }

  private ensureSeedBagSpace() {
    requireThat(
      this.bag().length < SEED_BAG_CAPACITY,
      'Your seed bag is full. Review a seed to make room.',
      409,
    );
  }

  add(id: string, topic: string) {
    const word = this.word(id);
    this.topic(topic);
    requireThat(this.inTopic(id, topic), 'This word does not belong to this topic.');
    if (this.kept(id)) return { added: false };
    this.ensureSeedBagSpace();

    this.state.swipes.push({
      word_id: id,
      activity_id: topic,
      sentence_id: this.sentence(word, topic).sentence_id,
      action: 'keep',
      planted_at: null,
      swiped_at: this.iso(),
    });
    return { added: true };
  }
  setTopic(topic: string | null) {
    if (topic) this.topic(topic);
    Object.assign(this.state.user, { current_topic: topic, cards_in_bucket: 0, drop_streak: 0 });
  }
  unseen(word: Word) {
    return (
      !this.state.seen_ids?.includes(word.id) &&
      !this.learned(word.id) &&
      !this.state.swipes.some((s) => s.word_id === word.id)
    );
  }
  bestTopic(exclude = '') {
    const level = this.state.user.level || 'A2';
    const seen = this.seenWordIds();
    const unseenTopics = new Set<string>(),
      seenCounts = new Map<string, number>();
    for (const word of this.catalog.words) {
      if (word.level !== level) continue;
      for (const topic of catalogIndex(this.catalog).topics.get(word.id) || []) {
        if (seen.has(word.id)) seenCounts.set(topic, (seenCounts.get(topic) || 0) + 1);
        else unseenTopics.add(topic);
      }
    }
    return (
      shuffle(this.catalog.activities, this.random)
        .filter((a) => a.id !== exclude && unseenTopics.has(a.id))
        .sort((a, b) => (seenCounts.get(a.id) || 0) - (seenCounts.get(b.id) || 0))[0]?.id || null
    );
  }
  private seenWordIds() {
    return new Set([
      ...(this.state.seen_ids || []),
      ...this.state.known,
      ...this.state.learned,
      ...this.state.swipes.map((swipe) => swipe.word_id),
    ]);
  }

  private chooseDiscoveryWord(seen: Set<string>) {
    const user = this.state.user;
    const level = user.level || 'A2';
    const levelIndex = LEVELS.indexOf(level);
    const roll = this.random();
    const belowChance = levelIndex > 0 ? 0.15 * user.affinity_below : 0;
    const aboveChance = levelIndex < 2 ? 0.15 * user.affinity_above : 0;
    let chosenLevel = level;
    if (roll < belowChance) chosenLevel = LEVELS[levelIndex - 1];
    else if (roll < belowChance + aboveChance) chosenLevel = LEVELS[levelIndex + 1];

    const pool = this.catalog.words.filter((word) => {
      if (seen.has(word.id) || !this.inTopic(word.id, user.current_topic || '')) return false;
      return catalogIndex(this.catalog)
        .sentences.get(word.id)
        ?.some((sentence) => sentence.activity_id === user.current_topic);
    });
    // Try the sampled level first; fall back to the learner's declared level.
    return (
      shuffle(
        pool.filter((word) => word.level === chosenLevel),
        this.random,
      )[0] ||
      shuffle(
        pool.filter((word) => word.level === level),
        this.random,
      )[0]
    );
  }

  matcher() {
    const user = this.state.user;
    if (!user.current_topic) this.setTopic(this.bestTopic());

    const shouldRotateTopic = user.cards_in_bucket >= 5 && user.drop_streak >= 7;
    if (shouldRotateTopic) {
      const nextTopic = this.bestTopic(user.current_topic || '');
      if (nextTopic) this.setTopic(nextTopic);
    }

    const seen = this.seenWordIds();
    let word = user.current_topic ? this.chooseDiscoveryWord(seen) : undefined;
    if (!word) {
      this.setTopic(this.bestTopic(user.current_topic || ''));
      if (user.current_topic) word = this.chooseDiscoveryWord(seen);
    }
    return {
      card: word ? this.sentence(word, user.current_topic || '') : null,
      bag: this.bag(),
    };
  }
  swipe(id: string, action: string, topic: string | null, sentenceId: number) {
    this.random = decisionRandom(`${id}:${action}:${this.state.user.swipe_count}`);
    const word = this.word(id),
      user = this.state.user;
    requireThat(['keep', 'not_now', 'learned'].includes(action), 'Unknown action.');
    requireThat(this.unseen(word), 'This word has already been handled. Refresh to continue.', 409);
    requireThat(
      this.catalog.sentences.some((s) => s.id === sentenceId && s.word_id === id),
      'The sentence does not match this word.',
    );
    if (topic) this.topic(topic);
    if (action === 'keep') this.ensureSeedBagSpace();
    this.state.swipes.push({
      word_id: id,
      activity_id: topic,
      sentence_id: sentenceId,
      action: action === 'keep' ? 'keep' : 'drop',
      drop_reason: action === 'keep' ? null : action === 'learned' ? 'known' : 'uninteresting',
      swiped_at: this.iso(),
      planted_at: null,
    });
    if (action === 'learned') {
      this.state.known.push(id);
      user.level_bias = Math.min(2, user.level_bias + 0.1);
    }
    this.updateDiscoveryPreferences(word, action);
    user.swipe_count++;
    user.cards_in_bucket++;
    if (action === 'keep') user.drop_streak = 0;
    else if (action === 'not_now') user.drop_streak++;
    return this.matcher();
  }
  private updateDiscoveryPreferences(word: Word, action: string) {
    const user = this.state.user;
    const relativeLevel = LEVELS.indexOf(word.level) - LEVELS.indexOf(user.level || 'A2');
    if (relativeLevel === -1)
      user.affinity_below *= action === 'learned' ? 0.85 : action === 'keep' ? 1.1 : 0.95;
    if (relativeLevel === 1) user.affinity_above *= action === 'not_now' ? 0.9 : 1.1;
    if (relativeLevel === 0 && action === 'learned') user.affinity_above *= 1.05;
    user.affinity_above = Math.min(1.5, user.affinity_above);
    user.affinity_below = Math.min(1.5, user.affinity_below);
  }

  topicDetail(topic: string) {
    return {
      activity: this.topic(topic),
      words: this.catalog.words
        .filter((word) => this.inTopic(word.id, topic))
        .map((word) => this.details(word))
        .sort(
          (a, b) =>
            Number(b.status === 'planted') - Number(a.status === 'planted') ||
            a.lemma.localeCompare(b.lemma),
        ),
    };
  }
  time() {
    if (this.state.time_summary) return this.state.time_summary;
    const today = this.iso().slice(0, 10),
      sessions = this.state.sessions;
    return {
      today_seconds: sessions
        .filter((s) => s.started_at.startsWith(today) || s.last_beat_at.startsWith(today))
        .reduce((sum, s) => sum + s.seconds, 0),
      total_seconds: sessions.reduce((sum, s) => sum + s.seconds, 0),
      current_session_seconds: sessions.at(-1)?.seconds || 0,
      timer_seconds: TIMER_SECONDS,
    };
  }
  heartbeat() {
    const last = this.state.sessions.at(-1),
      gap = last ? Math.floor((this.now - Date.parse(last.last_beat_at)) / 1000) : Infinity;
    if (last && gap <= SESSION_IDLE_SECONDS) {
      last.seconds += Math.max(0, gap);
      last.last_beat_at = this.iso();
    } else
      this.state.sessions.push({ started_at: this.iso(), last_beat_at: this.iso(), seconds: 0 });
    return this.time();
  }
  home() {
    const plots = [],
      topics = [];
    for (const activity of this.catalog.activities) {
      const all = this.catalog.words
        .filter((word) => this.inTopic(word.id, activity.id))
        .map((word) => this.details(word));
      const plants = all.filter((word) => word.status === 'planted' || word.learned);
      if (plants.length) plots.push({ ...activity, words: plants });
      const levelWords = all.filter(
        (word) => !this.state.user.level || word.level === this.state.user.level,
      );
      const overview = { unseen: 0, seeds: 0, planted: 0, due: 0, grown: 0 };
      for (const word of levelWords) overview[word.visual_stage]++;
      topics.push({
        ...activity,
        overview,
        total: all.length,
        planted: plants.length,
        planted_pct: all.length ? (plants.length / all.length) * 100 : 0,
        grown_pct: all.length
          ? (plants.reduce((sum, word) => sum + word.growth / 5, 0) / all.length) * 100
          : 0,
        seed_bag_here: all.filter((word) => word.status === 'bag').length,
      });
    }
    const seedBag = this.bag();
    return {
      plots: plots.sort((a, b) => a.name.localeCompare(b.name)),
      topics: topics.sort((a, b) => a.name.localeCompare(b.name)),
      bag: seedBag,
      summary: {
        bag_count: seedBag.length,
        bag_cap: SEED_BAG_CAPACITY,
        due_now: this.reviewWords().length,
        planted_total: this.scope().length,
        time: this.time(),
      },
    };
  }
  practice(scope: string, topic: string) {
    return {
      words: this.scope(scope, topic).map((word) => this.details(word)),
      grammar_options: grammarOptions,
      counts: this.counts(topic),
    };
  }
  targets(scope: string, topic: string) {
    const words = shuffle(this.scope(scope, topic)).slice(0, PRACTICE_TARGET_COUNT);
    requireThat(words.length, 'Keep or plant some words first.');
    return words.map((word) => this.sentence(word, topic));
  }
}

// Reuse card formatting and scheduling rules with only the selected word's data.
export function reviewSelectionResponse(selection: ReviewSelection, scope: string, topic: string) {
  requireThat(selection.vocabulary_available, 'Vocabulary has not been imported yet.', 503);
  if (scope === 'topic' || topic) requireThat(selection.topic_exists, 'Unknown topic.');
  const { selected, remaining, counts } = selection;
  if (!selected) return { card: null, remaining, counts };
  const state = freshLearner('');
  state.swipes = [selected.swipe];
  if (selected.srs) state.srs[selected.word.id] = selected.srs;
  const garden = new Garden(
    {
      words: [selected.word],
      activities: selected.activity ? [selected.activity] : [],
      word_activities: [],
      sentences: selected.sentence ? [selected.sentence] : [],
    },
    state,
  );
  return {
    card: garden.reviewCard(selected.word, scope === 'topic' ? topic : ''),
    remaining,
    counts,
  };
}
