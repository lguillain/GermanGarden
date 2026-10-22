import { Garden, grammarOptions } from './domain.ts';
import { requireThat, HttpError } from './model.ts';
import {
  READ_SYSTEM,
  CHAT_SYSTEM,
  GRAMMAR_GEN_SYSTEM,
  GRAMMAR_CHECK_SYSTEM,
  LEVEL_GUIDANCE,
  GUIDE_SYSTEM,
} from './prompts.ts';
export type Body = Record<string, unknown>;
export type Message = { role: 'user' | 'assistant'; content: string; corrections?: unknown[] };
export type Complete = (
  system: string,
  message: string,
  history?: Message[],
) => Promise<Record<string, unknown>>;
export function text(body: Body, key: string, fallback = '', max = 3000): string {
  const value = body[key] ?? fallback;
  requireThat(typeof value === 'string' && value.length <= max, `Invalid ${key}.`);
  return value;
}
function format(template: string, values: Record<string, string>) {
  return template
    .replace(/\{(level|level_rule|targets)\}/g, (_, key) => values[key] || '')
    .replaceAll('{{', '{')
    .replaceAll('}}', '}');
}
function corrections(data: Record<string, unknown>, sentence: string) {
  return (Array.isArray(data.corrections) ? data.corrections : [])
    .filter(
      (c) =>
        c &&
        typeof c.original === 'string' &&
        typeof c.corrected === 'string' &&
        c.original &&
        c.original !== c.corrected &&
        sentence.toLowerCase().includes(c.original.toLowerCase()),
    )
    .map((c) => ({ original: c.original, corrected: c.corrected, note: String(c.note || '') }));
}
export async function aiPractice(path: string, body: Body, garden: Garden, complete: Complete) {
  const level = garden.state.user.level || 'A2';
  const values = {
    level,
    level_rule: LEVEL_GUIDANCE[level as keyof typeof LEVEL_GUIDANCE] || LEVEL_GUIDANCE.A2,
    targets: '',
  };
  if (path === '/reading') {
    const targets =
      body.target_ids === undefined
        ? garden.targets(text(body, 'scope', 'all'), text(body, 'topic'))
        : garden.practiceTargets(text(body, 'scope', 'all'), text(body, 'topic'), body.target_ids);
    const result = await complete(
      format(READ_SYSTEM, values),
      'Target words: ' +
        JSON.stringify(
          targets.map((w) => ({
            lemma: w.lemma,
            article: w.article,
            english: w.english,
            level: w.level,
          })),
        ),
    );
    requireThat(
      typeof result.de === 'string' && typeof result.en === 'string',
      'The AI returned an incomplete passage. Try again.',
      502,
    );
    return {
      targets,
      text: { setting: String(result.setting || ''), de: result.de, en: result.en },
    };
  }
  if (path === '/chat') {
    const ids = body.target_ids ?? [];
    requireThat(
      Array.isArray(ids) && ids.length <= 5 && ids.every((id) => typeof id === 'string'),
      'Invalid target words.',
    );
    const targets = ids.length
      ? garden.practiceTargets(text(body, 'scope', 'all'), text(body, 'topic'), ids)
      : garden.targets(text(body, 'scope', 'all'), text(body, 'topic'));
    values.targets = targets.map((w) => w.lemma).join(', ');
    const history = body.history ?? [];
    requireThat(
      Array.isArray(history) &&
        history.length <= 100 &&
        history.every(
          (m) =>
            m &&
            ['user', 'assistant'].includes(m.role) &&
            typeof m.content === 'string' &&
            m.content.length <= 20000,
        ),
      'Invalid conversation.',
    );
    requireThat(
      body.start === undefined || typeof body.start === 'boolean',
      'Invalid conversation start.',
    );
    const starting = !ids.length || body.start === true;
    const message = text(body, 'message').trim();
    if (!starting) requireThat(message, 'Write a message first.');
    const result = await complete(
      format(CHAT_SYSTEM, values),
      !starting
        ? message
        : 'Open with a greeting and a friendly question inviting use of a target word.',
      !starting ? history : [],
    );
    requireThat(
      typeof result.reply === 'string',
      'The AI returned an incomplete reply. Try again.',
      502,
    );
    const updated: Message[] = !starting
      ? [
          ...history,
          { role: 'user', content: message, corrections: corrections(result, message) },
          { role: 'assistant', content: result.reply },
        ]
      : [{ role: 'assistant', content: result.reply }];
    const userWords =
      updated
        .filter((m) => m.role === 'user')
        .map((m) => m.content.toLowerCase())
        .join(' ')
        .match(/[\p{L}]+/gu) || [];
    const used = targets
      .filter((w) => {
        const lemma = w.lemma.toLowerCase(),
          stems = [lemma];
        for (const end of ['en', 'ern', 'eln', 'e', 'n'])
          if (lemma.endsWith(end) && lemma.length - end.length >= 3)
            stems.push(lemma.slice(0, -end.length));
        return userWords.some((word) => stems.some((stem) => word.startsWith(stem)));
      })
      .map((w) => w.lemma);
    return { targets, history: updated, used };
  }
  if (path === '/grammar') {
    const word = garden.word(text(body, 'word_id'));
    requireThat(garden.kept(word.id) || garden.learned(word.id), 'Practice word not found.', 404);
    const supplied = body.config ?? {};
    requireThat(
      supplied && typeof supplied === 'object' && !Array.isArray(supplied),
      'Invalid grammar options.',
    );
    const config: Record<string, string> = {};
    for (const [key, options] of Object.entries(grammarOptions[word.pos] || {})) {
      const value = (supplied as Body)[key] ?? options[0];
      requireThat(
        typeof value === 'string' && options.includes(value),
        'Choose a valid grammar option.',
      );
      config[key] = value;
    }
    const action = text(body, 'action', 'generate');
    requireThat(['generate', 'correct'].includes(action), 'Invalid grammar action.');
    const sentence = text(body, 'sentence').trim();
    if (action === 'correct') requireThat(sentence, 'Write a sentence first.');
    const result = await complete(
      format(action === 'correct' ? GRAMMAR_CHECK_SYSTEM : GRAMMAR_GEN_SYSTEM, values),
      `Target: ${JSON.stringify(word)}\nConfiguration: ${JSON.stringify(config)}\nLearner sentence: ${sentence}`,
    );
    return action === 'correct'
      ? { ...result, corrections: corrections(result, sentence) }
      : result;
  }
  throw new HttpError(404, 'Unknown AI activity.');
}
export async function guidance(garden: Garden, input: string, complete: Complete) {
  const result = await complete(
    GUIDE_SYSTEM + '\nActivities:\n' + JSON.stringify(garden.catalog.activities),
    input,
  );
  const weights: Record<string, number> = {};
  for (const a of garden.catalog.activities)
    weights[a.id] =
      typeof result[a.id] === 'number' && Number.isFinite(result[a.id])
        ? Math.max(0.3, Math.min(3, result[a.id] as number))
        : 1;
  return weights;
}
