import { HttpError, requireThat } from './model.ts';
import type { Complete } from './ai.ts';

// Provider transport only; practice rules and prompts live in ai.ts.
export function createCompletion(
  key: string | undefined,
  model = 'claude-sonnet-4-6',
): Complete | undefined {
  if (!key) return undefined;

  return async (system, message, history = []) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: AbortSignal.timeout(60_000),
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: attempt === 0 ? 1500 : 3000,
          system:
            attempt === 0
              ? system
              : system +
                '\nReturn one complete, valid JSON object only. Do not include commentary or Markdown fences. Escape quotes and newlines inside JSON strings.',
          messages: [
            ...history.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: message },
          ],
        }),
      });
      if (!response.ok)
        throw new HttpError(502, 'AI practice is temporarily unavailable. Please try again.');
      const data = await response.json();
      const raw = data.content
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('')
        .trim();
      try {
        if (data.stop_reason === 'max_tokens') throw new Error('Truncated AI response');
        const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
        requireThat(
          parsed && typeof parsed === 'object' && !Array.isArray(parsed),
          'Invalid AI response.',
          502,
        );
        return parsed;
      } catch {
        // Retry malformed or truncated output once without replaying it as conversation history.
      }
    }
    throw new HttpError(502, 'The AI returned an unreadable response. Please try again.');
  };
}
