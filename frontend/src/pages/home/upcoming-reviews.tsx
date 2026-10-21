import { useRef } from 'react';
import type { Garden } from '../../api';

export function UpcomingReviews({ summary }: { summary: Garden['summary'] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const upcoming = summary.upcoming_reviews;
  const total = upcoming?.reduce((sum, day) => sum + day.count, 0) ?? 0;
  const maximum = Math.max(1, ...(upcoming?.map((day) => day.count) ?? []));
  return (
    <>
      <button
        className="button upcoming-reviews-trigger"
        aria-label="Upcoming"
        title="Upcoming reviews"
        onClick={() => dialog.current?.showModal()}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2M8 18h2" />
        </svg>
      </button>
      <dialog
        ref={dialog}
        className="upcoming-reviews"
        aria-labelledby="upcoming-reviews-title"
        aria-describedby="upcoming-reviews-description"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            )
              dialog.current?.close();
          }
        }}
      >
        <div className="upcoming-reviews-header">
          <h2 id="upcoming-reviews-title">Upcoming reviews</h2>
          <button className="button" onClick={() => dialog.current?.close()} autoFocus>
            Close
          </button>
        </div>
        <p id="upcoming-reviews-description">
          Each word counts once, on its next review date. Dates use your local time zone. Counts
          change as you review.
        </p>
        <dl className="upcoming-review-counts">
          <div>
            <dt>Due now</dt>
            <dd>{summary.due_now}</dd>
          </div>
          <div>
            <dt>Scheduled for later</dt>
            <dd>{upcoming === undefined ? '—' : total}</dd>
          </div>
        </dl>
        {upcoming === undefined ? (
          <p>Upcoming review counts are unavailable. Please try refreshing the page.</p>
        ) : upcoming.length ? (
          <figure className="review-forecast">
            <figcaption>Words by next review date</figcaption>
            <ol className="review-forecast-bars">
              {upcoming.map(({ date, count }) => {
                const day = new Date(`${date}T12:00:00`);
                const label = day.toLocaleDateString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });
                return (
                  <li
                    key={date}
                    aria-label={`${label}: ${count} ${count === 1 ? 'word' : 'words'}`}
                  >
                    <time dateTime={date} title={label}>
                      <span>
                        {day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      <small>
                        {day.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric' })}
                      </small>
                    </time>
                    <div className="review-forecast-track" aria-hidden="true">
                      <div
                        className="review-forecast-bar"
                        style={{ width: `${(count / maximum) * 100}%` }}
                      />
                    </div>
                    <strong aria-hidden="true">{count}</strong>
                  </li>
                );
              })}
            </ol>
          </figure>
        ) : (
          <p>No future reviews scheduled yet.</p>
        )}
      </dialog>
    </>
  );
}
