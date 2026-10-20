import type { Word } from '../../api';
import { WordTitle } from '../../components/word-card';

export function TargetWords({ words, used = [] }: { words: Word[]; used?: string[] }) {
  return (
    <div className="chips">
      {words.map((word) => {
        const isUsed = used.includes(word.lemma);
        return (
          <span className={`badge${isUsed ? ' used' : ''}`} key={word.id}>
            <WordTitle word={word} />
            {isUsed ? ' ✓' : ''}
          </span>
        );
      })}
    </div>
  );
}
