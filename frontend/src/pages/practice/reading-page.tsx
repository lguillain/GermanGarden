import { useState } from 'react';
import { AiPracticeLayout } from './ai-practice-layout';
import { ReadingActivity, type ReadingResult } from './practice-activities';
import { usePracticeSummary } from './use-practice-summary';
import { useScope } from '../../hooks/use-scope';

export function ReadingPage() {
  const { scope, topic, query } = useScope();
  const summary = usePracticeSummary(query);
  const [reading, setReading] = useState<ReadingResult | null>(null);
  return (
    <AiPracticeLayout title="Reading" result={summary} wordCount={summary.data?.word_count ?? 0}>
      <ReadingActivity scope={scope} topic={topic} value={reading} onChange={setReading} />
    </AiPracticeLayout>
  );
}
