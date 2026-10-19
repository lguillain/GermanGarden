import { Catalog, Learner, Word, requireThat, initialSrs, growth, reviewOutcome, shuffle } from './model.ts';

export const grammarOptions: Record<string, Record<string, string[]>> = {
  noun: { case: ['Nominativ', 'Akkusativ', 'Dativ', 'Genitiv'], number: ['Singular', 'Plural'] },
  verb: { tense: ['Präsens', 'Perfekt', 'Präteritum', 'Plusquamperfekt', 'Futur I', 'Konjunktiv II', 'Imperativ'], person: ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'] },
  adj: { degree: ['Positiv', 'Komparativ', 'Superlativ'], declension: ['stark (no article)', 'schwach (der/die/das)', 'gemischt (ein/kein/mein)'] },
};
export class Garden {
  constructor(public catalog: Catalog, public state: Learner, public now = Date.now(), public preferredTopic?: string) {}
  iso() { return new Date(this.now).toISOString(); }
  topic(id: string) { const topic = this.catalog.activities.find(a => a.id === id); requireThat(topic, 'Unknown topic.'); return topic; }
  word(id: string) { const word = this.catalog.words.find(w => w.id === id); requireThat(word, 'Unknown word.', 404); return word; }
  inTopic(id: string, topic: string) { return !topic || this.catalog.word_activities.some(a => a.word_id === id && a.activity_id === topic); }
  kept(id: string) { return this.state.swipes.find(s => s.word_id === id && s.action === 'keep'); }
  learned(id: string) { return this.state.known.includes(id) || this.state.learned.includes(id); }
  due(id: string) { const srs = this.state.srs[id]; return !srs || Date.parse(srs.due_at || '') <= this.now; }
  details(word: Word) {
    const kept = this.kept(word.id), learned = this.learned(word.id), srs = this.state.srs[word.id];
    const stage = growth(srs, learned), due = !!kept?.planted_at && !!srs && this.due(word.id) && !learned;
    const status = kept ? (kept.planted_at ? 'planted' : 'bag') : learned ? 'learned' : this.state.swipes.some(s => s.word_id === word.id) ? 'not_now' : 'new';
    return { ...word, growth: stage, learned, review_due: due, status, interval_days: srs?.interval_days || 0, reps: srs?.reps || 0,
      visual_stage: due ? 'due' : learned || stage === 5 ? 'grown' : status === 'planted' ? 'planted' : status === 'bag' ? 'seeds' : 'unseen' };
  }
  sentence(word: Word, topic = '') {
    const sentences = this.catalog.sentences.filter(s => s.word_id === word.id);
    const preferred = topic ? sentences.filter(s => s.activity_id === topic) : [];
    const sentence = shuffle(preferred.length ? preferred : sentences)[0];
    return { ...this.details(word), word_id: word.id, sentence_id: sentence?.id ?? null, de: sentence?.text || '', en: sentence?.english || '', activity_id: topic || sentence?.activity_id || null,
      activity_name: this.catalog.activities.find(a => a.id === (topic || sentence?.activity_id))?.name || '' };
  }
  bag() { return this.catalog.words.filter(w => { const s = this.kept(w.id); return s && !s.planted_at; }).map(w => this.details(w)); }
  scope(scope = 'all', topic = '') {
    requireThat(['all', 'topic', 'bag'].includes(scope), 'Unknown word set.');
    if (scope === 'topic') this.topic(topic);
    return this.catalog.words.filter(w => { const s = this.kept(w.id); return s && (scope === 'bag' ? !s.planted_at : !!s.planted_at && (scope !== 'topic' || this.inTopic(w.id, topic))); });
  }
  reviewWords(scope = 'all', topic = '') { return this.scope(scope, topic).filter(w => !this.learned(w.id) && this.due(w.id)); }
  counts(topic = '', review = false) {
    const words = (scope: string, topic = '') => review ? this.reviewWords(scope, topic) : this.scope(scope, topic);
    return { plants: words(topic ? 'topic' : 'all', topic).length, seeds: words('bag').length };
  }
  review(scope = 'all', topic = '') {
    const words = this.reviewWords(scope, topic).sort((a, b) => Number(!!this.state.srs[a.id]) - Number(!!this.state.srs[b.id]) || Date.parse(this.state.srs[a.id]?.due_at || '') - Date.parse(this.state.srs[b.id]?.due_at || ''));
    const word = words[0], srs = word && (this.state.srs[word.id] || initialSrs());
    const card = word ? { ...this.sentence(word, scope === 'topic' ? topic : ''), rating_options: [1, 2, 3, 4].map(grade => {
      const outcome = reviewOutcome(srs, grade);
      return { grade, growth: growth(outcome), next_review_seconds: Math.trunc(outcome.interval_days * 86400) };
    }) } : null;
    return { card, remaining: words.length, counts: this.counts(topic, true) };
  }
  grade(id: string, grade: number, scope = 'all', topic = '') {
    requireThat(this.reviewWords(scope, topic).some(w => w.id === id), 'This word is no longer due in this review set. Refresh to continue.', 409);
    const outcome = reviewOutcome(this.state.srs[id] || initialSrs(), grade);
    this.state.srs[id] = { ...outcome, due_at: new Date(this.now + Math.trunc(outcome.interval_days * 86400) * 1000).toISOString(), last_grade: grade, last_review_at: this.iso() };
    for (const swipe of this.state.swipes) if (swipe.word_id === id && swipe.action === 'keep' && !swipe.planted_at) swipe.planted_at = this.iso();
    this.state.reviews.push({ word_id: id, grade, reviewed_at: this.iso() });
    return this.review(scope, topic);
  }
  add(id: string, topic: string) {
    const word = this.word(id); this.topic(topic); requireThat(this.inTopic(id, topic), 'This word does not belong to this topic.');
    if (this.kept(id)) return { added: false };
    requireThat(this.bag().length < 20, 'Your seed bag is full. Review a seed to make room.', 409);
    this.state.swipes.push({ word_id: id, activity_id: topic, sentence_id: this.sentence(word, topic).sentence_id, action: 'keep', planted_at: null, swiped_at: this.iso() });
    return { added: true };
  }
  setTopic(topic: string | null) { if (topic) this.topic(topic); Object.assign(this.state.user, { current_topic: topic, cards_in_bucket: 0, drop_streak: 0 }); }
  unseen(word: Word) { return !this.learned(word.id) && !this.state.swipes.some(s => s.word_id === word.id); }
  bestTopic(exclude = '') {
    const level = this.state.user.level || 'A2';
    if (this.preferredTopic && this.preferredTopic !== exclude && this.catalog.words.some(w => w.level === level && this.inTopic(w.id, this.preferredTopic!) && this.unseen(w))) return this.preferredTopic;
    return shuffle(this.catalog.activities).filter(a => a.id !== exclude && this.catalog.words.some(w => w.level === level && this.inTopic(w.id, a.id) && this.unseen(w)))
      .sort((a, b) => this.catalog.words.filter(w => w.level === level && this.inTopic(w.id, a.id) && !this.unseen(w)).length - this.catalog.words.filter(w => w.level === level && this.inTopic(w.id, b.id) && !this.unseen(w)).length)[0]?.id || null;
  }
  matcher() {
    const u = this.state.user;
    if (!u.current_topic) this.setTopic(this.bestTopic());
    if (u.cards_in_bucket >= 5 && u.drop_streak >= 7) { const next = this.bestTopic(u.current_topic || ''); if (next) this.setTopic(next); }
    const pick = () => {
      const levels = ['A1', 'A2', 'B1'], level = u.level || 'A2', index = levels.indexOf(level), roll = Math.random();
      const below = index > 0 ? .15 * u.affinity_below : 0, above = index < 2 ? .15 * u.affinity_above : 0;
      const chosen = roll < below ? levels[index - 1] : roll < below + above ? levels[index + 1] : level;
      const pool = this.catalog.words.filter(w => this.unseen(w) && this.inTopic(w.id, u.current_topic || '') && this.catalog.sentences.some(s => s.word_id === w.id && s.activity_id === u.current_topic));
      return shuffle(pool.filter(w => w.level === chosen))[0] || shuffle(pool.filter(w => w.level === level))[0];
    };
    let word = u.current_topic ? pick() : undefined;
    if (!word) { this.setTopic(this.bestTopic(u.current_topic || '')); if (u.current_topic) word = pick(); }
    return { card: word ? this.sentence(word, u.current_topic || '') : null, bag: this.bag() };
  }
  swipe(id: string, action: string, topic: string | null, sentenceId: number) {
    const word = this.word(id), u = this.state.user;
    requireThat(['keep', 'not_now', 'learned'].includes(action), 'Unknown action.');
    requireThat(this.unseen(word), 'This word has already been handled. Refresh to continue.', 409);
    requireThat(this.catalog.sentences.some(s => s.id === sentenceId && s.word_id === id), 'The sentence does not match this word.');
    if (topic) this.topic(topic);
    if (action === 'keep') requireThat(this.bag().length < 20, 'Your seed bag is full. Review a seed to make room.', 409);
    this.state.swipes.push({ word_id: id, activity_id: topic, sentence_id: sentenceId, action: action === 'keep' ? 'keep' : 'drop', drop_reason: action === 'keep' ? null : action === 'learned' ? 'known' : 'uninteresting', swiped_at: this.iso(), planted_at: null });
    if (action === 'learned') { this.state.known.push(id); u.level_bias = Math.min(2, u.level_bias + .1); }
    const levels = ['A1', 'A2', 'B1'], rel = levels.indexOf(word.level) - levels.indexOf(u.level || 'A2');
    if (rel === -1) u.affinity_below *= action === 'learned' ? .85 : action === 'keep' ? 1.1 : .95;
    if (rel === 1) u.affinity_above *= action === 'not_now' ? .9 : 1.1;
    if (rel === 0 && action === 'learned') u.affinity_above *= 1.05;
    u.affinity_above = Math.min(1.5, u.affinity_above); u.affinity_below = Math.min(1.5, u.affinity_below);
    u.swipe_count++; u.cards_in_bucket++;
    if (action === 'keep') u.drop_streak = 0; else if (action === 'not_now') u.drop_streak++;
    return this.matcher();
  }
  topicDetail(topic: string) {
    return { activity: this.topic(topic), words: this.catalog.words.filter(w => this.inTopic(w.id, topic)).map(w => this.details(w)).sort((a, b) => Number(b.status === 'planted') - Number(a.status === 'planted') || a.lemma.localeCompare(b.lemma)) };
  }
  time() {
    const today = this.iso().slice(0, 10), sessions = this.state.sessions;
    return { today_seconds: sessions.filter(s => s.started_at.startsWith(today) || s.last_beat_at.startsWith(today)).reduce((sum, s) => sum + s.seconds, 0), total_seconds: sessions.reduce((sum, s) => sum + s.seconds, 0), current_session_seconds: sessions.at(-1)?.seconds || 0, timer_seconds: 300 };
  }
  heartbeat() {
    const last = this.state.sessions.at(-1), gap = last ? Math.floor((this.now - Date.parse(last.last_beat_at)) / 1000) : Infinity;
    if (last && gap <= 90) { last.seconds += Math.max(0, gap); last.last_beat_at = this.iso(); }
    else this.state.sessions.push({ started_at: this.iso(), last_beat_at: this.iso(), seconds: 0 });
    return this.time();
  }
  home() {
    const plots = [], topics = [];
    for (const activity of this.catalog.activities) {
      const all = this.catalog.words.filter(w => this.inTopic(w.id, activity.id)).map(w => this.details(w));
      const plants = all.filter(w => w.status === 'planted' || w.learned);
      if (plants.length) plots.push({ ...activity, words: plants });
      const levelWords = all.filter(w => !this.state.user.level || w.level === this.state.user.level);
      const overview = { unseen: 0, seeds: 0, planted: 0, due: 0, grown: 0 };
      for (const w of levelWords) overview[w.visual_stage as keyof typeof overview]++;
      topics.push({ ...activity, overview, total: all.length, planted: plants.length, planted_pct: all.length ? plants.length / all.length * 100 : 0, grown_pct: all.length ? plants.reduce((sum, w) => sum + w.growth / 5, 0) / all.length * 100 : 0, seed_bag_here: all.filter(w => w.status === 'bag').length });
    }
    return { plots: plots.sort((a, b) => a.name.localeCompare(b.name)), topics: topics.sort((a, b) => a.name.localeCompare(b.name)), bag: this.bag(), summary: { bag_count: this.bag().length, bag_cap: 20, due_now: this.reviewWords().length, planted_total: this.scope().length, time: this.time() } };
  }
  practice(scope: string, topic: string) { return { words: this.scope(scope, topic).map(w => this.sentence(w, topic)), grammar_options: grammarOptions, counts: this.counts(topic) }; }
  targets(scope: string, topic: string) { const words = shuffle(this.scope(scope, topic)).slice(0, 5); requireThat(words.length, 'Keep or plant some words first.'); return words.map(w => this.sentence(w, topic)); }
}
