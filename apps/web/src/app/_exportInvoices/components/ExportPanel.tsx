'use client';

export interface ExportPanelProps {
  title: string;
  /** A count or status shown at the right of the title bar */
  aside?: React.ReactNode;
  className?: string;
}

/**
 * A titled card for one part of the editor's side column
 *
 * Each part — checks, change requests, header, history — sits in its own
 * bordered card so the column reads as separate blocks, not one run of text.
 */
const ExportPanel = ({ title, aside, className = '', children }: React.PropsWithChildren<ExportPanelProps>) => (
  <section className={`overflow-hidden rounded-xl border border-border-muted bg-fill-primary shadow-xs ${className}`}>
    <header className="flex items-center justify-between border-b border-border-muted bg-fill-muted/40 px-4 py-2.5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-primary">{title}</h2>
      {aside}
    </header>
    <div className="p-4">{children}</div>
  </section>
);

export default ExportPanel;
