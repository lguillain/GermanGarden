import type { ReactNode } from 'react';

export function PracticeActivityCard({
  title,
  controls,
  action,
  footer,
  children,
  flashcards = false,
}: {
  title: ReactNode;
  controls?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  flashcards?: boolean;
}) {
  return (
    <section
      className={`panel practice-activity-card ${flashcards ? 'practice-flashcards' : 'round-activity'}`}
      aria-label={flashcards ? 'Flashcard activity' : 'Practice activity'}
    >
      <header className="practice-activity-header">
        {title}
        {controls}
        {action}
      </header>
      <div className="practice-activity-content">{children}</div>
      {footer && <footer className="practice-activity-footer">{footer}</footer>}
    </section>
  );
}
