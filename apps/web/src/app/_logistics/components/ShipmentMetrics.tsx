import Typography from '@/app/_ui/components/Typography/Typography';

export interface ShipmentMetricsProps {
  /** Total cases on the shipment (item-derived). */
  cases: number | null | undefined;
  /** Total bottles on the shipment (item-derived). */
  bottles: number | null | undefined;
  /** Preformatted ETA label (e.g. "12 Jul"); the chip is hidden when absent. */
  etaLabel?: string | null;
}

interface StatProps {
  value: number | null | undefined;
  label: string;
}

/**
 * A single right-aligned metric: a bold tabular figure with a micro label.
 * The visual parts are hidden from assistive tech in favour of one clean
 * `sr-only` label so screen readers announce e.g. "31 cases" once.
 */
const Stat = ({ value, label }: StatProps) => {
  const formatted = (value ?? 0).toLocaleString();

  return (
    <div className="flex flex-col items-end justify-center">
      <span className="sr-only">{`${formatted} ${label}`}</span>
      <div aria-hidden className="flex flex-col items-end">
        <Typography variant="headingSm" className="tabular-nums leading-none">
          {formatted}
        </Typography>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">
          {label}
        </span>
      </div>
    </div>
  );
};

/**
 * Compact cases/bottles stat pair with an optional ETA chip, used on the
 * logistics dashboard and shipments list rows. Totals are expected to be
 * item-derived by the caller's query.
 *
 * @example
 *   <ShipmentMetrics cases={31} bottles={132} etaLabel="12 Jul" />
 */
const ShipmentMetrics = ({ cases, bottles, etaLabel }: ShipmentMetricsProps) => {
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-stretch gap-3 sm:gap-4">
        <Stat value={cases} label="cases" />
        <div aria-hidden className="w-px self-stretch bg-border-muted" />
        <Stat value={bottles} label="bottles" />
      </div>
      {etaLabel && (
        <span className="inline-flex items-center rounded-full bg-surface-secondary px-2 py-0.5 text-[11px] font-medium text-text-muted">
          ETA {etaLabel}
        </span>
      )}
    </div>
  );
};

export default ShipmentMetrics;
