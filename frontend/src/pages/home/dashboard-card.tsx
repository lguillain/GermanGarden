import type { ReactNode } from 'react';
import { DashboardIllustration, type DashboardIllustrationKind } from './dashboard-illustration';
import './garden-dashboard.css';

export function PlantedCount({ count }: { count?: number }) {
  return (
    <span className="garden-planted-count">
      <DashboardIllustration kind="sprouts" />
      <span>
        <strong>{count ?? '—'}</strong> words planted
      </span>
    </span>
  );
}

export function DashboardCard({
  title,
  count,
  detail,
  inlineDetail = false,
  kind,
  children,
}: {
  title: string;
  count?: number;
  detail: string;
  inlineDetail?: boolean;
  kind: DashboardIllustrationKind;
  children?: ReactNode;
}) {
  return (
    <article className="panel garden-dashboard-card" aria-label={title}>
      <div className="garden-dashboard-summary">
        <div>
          <h3>{title}</h3>
          <p className="garden-dashboard-count">
            <span className="garden-dashboard-value">
              <strong>{count ?? '—'}</strong>
              {inlineDetail && <span>{detail}</span>}
            </span>
            {!inlineDetail && <span>{detail}</span>}
          </p>
        </div>
        <DashboardIllustration kind={kind} />
      </div>
      {children && <div className="garden-dashboard-actions">{children}</div>}
    </article>
  );
}
