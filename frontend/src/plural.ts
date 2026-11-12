// English count labels, e.g. plural(1, 'word') → "word", plural(3, 'word') → "words".
export const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  count === 1 ? singular : pluralForm;
