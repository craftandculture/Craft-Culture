import type { PropsWithChildren, ReactNode } from 'react';

import Typography from '@/app/_ui/components/Typography/Typography';

export type PanelTone = 'neutral' | 'brand' | 'warning' | 'danger' | 'success';

export interface PanelProps {
  title: ReactNode;
  /** One line under the title. Anything longer belongs in the body. */
  hint?: ReactNode;
  tone?: PanelTone;
  /** Buttons or counts, right-aligned against the title */
  actions?: ReactNode;
}

const TONES: Record<
  PanelTone,
  { box: string; label: 'primary' | 'brand' | 'warning' | 'danger' | 'success' }
> = {
  neutral: { box: 'border-border-primary', label: 'primary' },
  brand: { box: 'border-border-brand/40 bg-fill-brand/10', label: 'brand' },
  warning: {
    box: 'border-border-warning/40 bg-fill-warning/10',
    label: 'warning',
  },
  danger: { box: 'border-border-danger/40 bg-fill-danger/10', label: 'danger' },
  success: {
    box: 'border-border-success/40 bg-fill-success/10',
    label: 'success',
  },
};

/**
 * The one boxed section these screens are built from
 *
 * Every notice, worklist and drill-down here was a hand-rolled div, so the
 * padding, the border weight and the place the title sat drifted between them
 * — and a screen whose boxes do not agree with each other reads as noise
 * however good each one is on its own.
 *
 * The title stays short and the hint stays to a line, which is the only
 * reliable defence against these panels growing into essays.
 */
const Panel = ({
  title,
  hint,
  tone = 'neutral',
  actions,
  children,
}: PropsWithChildren<PanelProps>) => (
  <section className={`rounded-xl border p-4 ${TONES[tone].box}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <Typography variant="labelSm" colorRole={TONES[tone].label}>
          {title}
        </Typography>
        {hint ? (
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <p className="mt-0.5 max-w-3xl">{hint}</p>
          </Typography>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
    {children ? <div className="mt-3">{children}</div> : null}
  </section>
);

export default Panel;
