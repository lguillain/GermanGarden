import type { Correction } from '../api';
export function Corrections({ items }: { items?: Correction[] }) {
  return (
    <>
      {items?.map((c, i) => (
        <div className="correction" key={i}>
          <s lang="de">{c.original}</s> → <strong lang="de">{c.corrected}</strong>
          <p>{c.note}</p>
        </div>
      ))}
    </>
  );
}
