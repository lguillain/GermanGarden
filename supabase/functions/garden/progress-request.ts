// Partial snapshots are exclusively for read-only routes. Mutations must retain
// original decision/mark positions for progressChanges and optimistic retries.
export function scopedProgressRequest(path: string, method: string) {
  if (method !== 'GET') return null;
  const topic = path.match(/^\/topics\/([^/]+)$/);
  if (topic) return { p_topic: decodeURIComponent(topic[1]), p_kept_only: false };
  if (path === '/practice') return { p_topic: null, p_kept_only: true };
  return null;
}
