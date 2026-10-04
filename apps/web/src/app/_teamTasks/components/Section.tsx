import type { ReactNode } from 'react';

/** A titled group of job cards, hidden when empty */
const Section = ({ title, count, tone, children }: { title: string; count: number; tone?: 'danger' | 'success'; children: ReactNode }) => {
  if (!count) return null;

  return (
    <section className="space-y-2">
      <h2
        className={`text-xs font-semibold uppercase tracking-wide ${
          tone === 'danger' ? 'text-text-danger' : tone === 'success' ? 'text-text-success' : 'text-text-muted'
        }`}
      >
        {title} <span className="font-normal">· {count}</span>
      </h2>
      <div className="grid items-start gap-2 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
};

export default Section;
