import React from 'react';
import { Link } from 'react-router-dom';

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

export function ErrorNotice({ error }: { error: unknown }) {
  return error ? (
    <p className="error" role="alert">
      {errorText(error)}
    </p>
  ) : null;
}

export function Loading() {
  return (
    <p className="loading-plant muted" role="status">
      <svg viewBox="0 0 64 72" width="48" height="54" aria-hidden="true" focusable="false">
        <ellipse cx="32" cy="64" rx="20" ry="5" fill="#8d6e4c" opacity=".16" />
        <path
          d="M19 64 Q32 58 45 64"
          fill="none"
          stroke="#a7834f"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <g className="loading-plant-sprout">
          <path
            className="loading-plant-stem"
            d="M32 63 Q28 44 32 23"
            pathLength="1"
            fill="none"
            stroke="#608148"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <g className="loading-plant-leaf loading-plant-leaf-left">
            <path d="M31 49 Q13 50 13 34 Q29 33 31 49" fill="#6ea45b" />
            <path d="M30 48 L18 39" stroke="#b1d77b" strokeWidth="1.5" strokeLinecap="round" />
          </g>
          <g className="loading-plant-leaf loading-plant-leaf-right">
            <path d="M31 39 Q48 40 51 25 Q35 24 31 39" fill="#5b9d76" />
            <path d="M33 37 L46 29" stroke="#9fcf8e" strokeWidth="1.5" strokeLinecap="round" />
          </g>
          <g className="loading-plant-flower">
            {[0, 72, 144, 216, 288].map((angle) => (
              <ellipse
                key={angle}
                cx="32"
                cy="14"
                rx="4"
                ry="7"
                fill="#edbd43"
                transform={`rotate(${angle} 32 21)`}
              />
            ))}
            <circle cx="32" cy="21" r="4" fill="#997044" />
          </g>
        </g>
      </svg>
      <span className="sr-only">Loading…</span>
      <span aria-hidden="true">
        Loading
        <span className="loading-dots">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </span>
    </p>
  );
}

export function Heading({
  title,
  children,
  navigation,
  actions,
  titleDetail,
}: {
  title: string;
  children?: React.ReactNode;
  navigation?: { to: string; label: string }[];
  actions?: React.ReactNode;
  titleDetail?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {titleDetail ? (
          <div className="page-heading-title">
            <h1>{title}</h1>
            {titleDetail}
          </div>
        ) : (
          <h1>{title}</h1>
        )}
        {children && <p className="muted">{children}</p>}
      </div>
      {(navigation?.length || actions) && (
        <div className="page-heading-actions">
          {navigation && (
            <nav className="page-navigation" aria-label="Page navigation">
              {navigation.map(({ to, label }) => (
                <Link key={to} to={to}>
                  {label}
                </Link>
              ))}
            </nav>
          )}
          {actions}
        </div>
      )}
    </header>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="panel empty">{children}</div>;
}
