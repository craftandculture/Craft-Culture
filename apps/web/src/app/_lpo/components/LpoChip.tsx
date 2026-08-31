'use client';

export interface LpoChipProps {
  tone: 'good' | 'warn' | 'bad' | 'plain';
}

const TONES = {
  good: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warn: 'bg-amber-50 text-amber-800 ring-amber-200',
  bad: 'bg-red-50 text-red-700 ring-red-200',
  plain: 'bg-fill-secondary text-text-muted ring-border-muted',
} as const;

/**
 * A short statement of what a line needs, colour-carrying but never
 * colour-only — the wording says the same thing as the tone, so the screen
 * still reads on a printout or to anyone who cannot separate the two.
 */
const LpoChip = ({ tone, children }: React.PropsWithChildren<LpoChipProps>) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONES[tone]}`}
  >
    {children}
  </span>
);

export default LpoChip;
