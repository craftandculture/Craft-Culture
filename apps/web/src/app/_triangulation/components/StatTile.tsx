'use client';

import Typography from '@/app/_ui/components/Typography/Typography';

export interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  tone?: 'primary' | 'muted' | 'success' | 'warning' | 'danger';
}

/**
 * A single headline figure on the triangulation overview
 *
 * Kept deliberately plain: the numbers carry the meaning, and the only colour
 * on the row should be the one flagging a variance that needs attention.
 */
const StatTile = ({ label, value, hint, tone = 'primary' }: StatTileProps) => {
  return (
    <div className="border-border-primary bg-fill-primary rounded-xl border p-4">
      <Typography variant="labelXs" colorRole="muted" asChild>
        <p className="uppercase tracking-wide">{label}</p>
      </Typography>
      <Typography variant="headingLg" colorRole={tone} asChild>
        <p className="mt-1 tabular-nums">{value}</p>
      </Typography>
      {hint ? (
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p className="mt-1">{hint}</p>
        </Typography>
      ) : null}
    </div>
  );
};

export default StatTile;
