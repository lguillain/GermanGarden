// Share both completed and in-flight loads within a function instance.
// Failed loads are retried; only vocabulary, never learner state, is cached.
export function catalogCache<T>(
  load: () => Promise<T>,
  ttl = 300_000,
  now = Date.now,
): () => Promise<T> {
  let cached: { data: T; expires: number } | undefined;
  let pending: Promise<T> | undefined;
  return () => {
    if (cached && now() < cached.expires) return Promise.resolve(cached.data);
    if (!pending) {
      pending = Promise.resolve()
        .then(load)
        .then((data) => {
          cached = { data, expires: now() + ttl };
          return data;
        })
        .finally(() => {
          pending = undefined;
        });
    }
    return pending;
  };
}
