'use client';

import { IconAlertTriangle, IconCheck, IconMinus } from '@tabler/icons-react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface ComparisonRow {
  label: string;
  /** What the supplier's paperwork says */
  declared: number | null | undefined;
  /** What we read, or hold */
  ours: number | null | undefined;
  /** Money is compared loosely; counts have to be exact */
  tolerance?: number;
  /** Why a difference here is expected, where it is */
  note?: string;
  /** Rendered form, for currency and the like */
  format?: (value: number) => string;
}

export interface DeclaredComparisonProps {
  rows: ComparisonRow[];
  /** Where on the document the declared figures were read */
  source?: string | null;
}

/**
 * Whether a row agrees, disagrees, or has nothing to say
 *
 * A figure the document does not state is not a disagreement — most invoices
 * never mention pallets — so it reads as unstated rather than as a fault. That
 * distinction is the difference between a check people use and one they learn
 * to click past.
 */
const verdict = ({ declared, ours, tolerance = 0 }: ComparisonRow) => {
  if (declared == null || ours == null) return 'unstated' as const;

  const gap = Math.abs(declared - ours);

  return gap <= (tolerance ? Math.abs(declared) * tolerance : 0)
    ? ('agrees' as const)
    : ('differs' as const);
};

/**
 * Set what a document declares beside what we made of it
 *
 * The supplier already wrote down how many cases, how many bottles and how
 * much money were in the box. Every extraction fault this flow has had would
 * have appeared here as a single number out of place — a pack read as 675, a
 * bottle recorded at 75 litres, six cartons invented out of loose bottles —
 * and each instead reached the shipment, because the document's own totals
 * were parsed and discarded.
 *
 * @param props - The figures to compare and where they were read
 * @returns A two-column comparison with a verdict per row
 */
const DeclaredComparison = ({ rows, source }: DeclaredComparisonProps) => {
  const stated = rows.filter((row) => row.declared != null);
  const differing = stated.filter((row) => verdict(row) === 'differs');

  if (stated.length === 0) {
    return (
      <div className="border-border-muted bg-fill-muted/30 rounded-md border px-3 py-2">
        <Typography variant="bodyXs" colorRole="muted">
          This document states no totals of its own, so there is nothing to
          check the extraction against — read the lines carefully before
          importing.
        </Typography>
      </div>
    );
  }

  return (
    <div
      className={`rounded-md border px-3 py-2.5 ${
        differing.length > 0
          ? 'border-border-warning bg-fill-warning/10'
          : 'border-border-success bg-fill-success/10'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon
          icon={differing.length > 0 ? IconAlertTriangle : IconCheck}
          size="sm"
          colorRole={differing.length > 0 ? 'warning' : 'success'}
        />
        <Typography variant="labelSm">
          {differing.length > 0
            ? `${differing.length} of ${stated.length} figures disagree with the document`
            : `Agrees with the document on all ${stated.length} figures`}
        </Typography>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-text-muted text-left text-xs uppercase">
            <th className="pb-1 font-medium">Figure</th>
            <th className="pb-1 text-right font-medium">Document says</th>
            <th className="pb-1 text-right font-medium">We read</th>
            <th className="w-6 pb-1" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const state = verdict(row);
            const show = (value: number | null | undefined) =>
              value == null ? '—' : (row.format?.(value) ?? String(value));

            return (
              <tr key={row.label} className="align-top">
                <td className="py-0.5 pr-3">
                  <Typography variant="bodySm">{row.label}</Typography>
                  {row.note && state !== 'agrees' ? (
                    <Typography variant="bodyXs" colorRole="muted">
                      {row.note}
                    </Typography>
                  ) : null}
                </td>
                <td className="py-0.5 pr-3 text-right font-medium tabular-nums">
                  {show(row.declared)}
                </td>
                <td className="py-0.5 pr-2 text-right tabular-nums">
                  {show(row.ours)}
                </td>
                <td className="py-0.5">
                  <Icon
                    icon={
                      state === 'agrees'
                        ? IconCheck
                        : state === 'differs'
                          ? IconAlertTriangle
                          : IconMinus
                    }
                    size="sm"
                    colorRole={
                      state === 'agrees'
                        ? 'success'
                        : state === 'differs'
                          ? 'warning'
                          : 'muted'
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {source ? (
        <Typography variant="bodyXs" colorRole="muted" className="mt-2">
          Read from {source}
        </Typography>
      ) : null}
    </div>
  );
};

export default DeclaredComparison;
