export function gardenGnomeCount(
  words: { review_due?: boolean; learned?: boolean; overdue_since?: string | null }[],
  now: number,
): number {
  const oldest = Math.min(
    ...words
      .filter((word) => word.review_due && !word.learned)
      .map((word) => Date.parse(word.overdue_since || ''))
      .filter(Number.isFinite),
  );
  const hours = (now - oldest) / 3_600_000;
  return hours < 12 ? 0 : Math.min(6, 1 + Math.floor(hours / 24));
}
