import React from 'react';

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
    <p className="muted" role="status">
      Loading…
    </p>
  );
}

export function Heading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="page-heading">
      <div>
        <h1>{title}</h1>
        {children && <p className="muted">{children}</p>}
      </div>
    </header>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="panel empty">{children}</div>;
}
