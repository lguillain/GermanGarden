import type { ReactNode } from 'react';

export function PracticeActivityCard({
  title,
  controls,
  action,
  footer,
  children,
}: {
  title: ReactNode;
  controls?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel practice-activity-card round-activity" aria-label="Practice activity">
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
