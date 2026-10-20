import type { ReactNode } from 'react';
import { Heading } from './feedback';

export function WelcomeLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="welcome">
      <span className="brand">Vocab Garden</span>
      <Heading title={title}>{description}</Heading>
      {children}
    </div>
  );
}
