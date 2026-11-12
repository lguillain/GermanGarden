import type { ReactNode } from 'react';

// Review and practice pair a progress bar with visible counts.
export function ProgressBar({
  counts,
  label,
  valueText,
  value,
  max,
}: {
  counts: ReactNode;
  label: string;
  valueText?: string;
  value: number;
  max: number;
}) {
  return (
    <div className="review-progress">
      <div className="review-progress-counts">{counts}</div>
      <progress
        aria-label={label}
        aria-valuetext={valueText}
        value={value}
        max={Math.max(1, max)}
      />
    </div>
  );
}
