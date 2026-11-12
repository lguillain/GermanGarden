// Path patterns shared by request routing, catalogue scoping and progress scoping.
const decode = (match: RegExpMatchArray | null, index = 1) =>
  match ? decodeURIComponent(match[index]) : null;

export const topicDetailPath = (path: string) => decode(path.match(/^\/topics\/([^/]+)$/));
export const relatedWordsPath = (path: string) => decode(path.match(/^\/words\/([^/]+)\/related$/));
export function topicKeepPath(path: string) {
  const match = path.match(/^\/topics\/([^/]+)\/words\/([^/]+)\/keep$/);
  return match ? { topic: decode(match, 1)!, wordId: decode(match, 2)! } : null;
}
