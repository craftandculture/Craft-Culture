'use client';

import { IconAlertTriangle, IconCheck } from '@tabler/icons-react';
import type { inferRouterOutputs } from '@trpc/server';

import type { AppRouter } from '@/trpc-router';

import LpoChip from './LpoChip';

export interface LpoPreviewReportProps {
  preview: inferRouterOutputs<AppRouter>['lpo']['admin']['preview'];
}

const money = (value: number) =>
  value.toLocaleString('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * The order read back: whether it adds up, what each line means, and what
 * fulfilling it would need.
 *
 * Lines wanting a decision are listed above the table as well as flagged in it,
 * because on a forty-three line order the two that need a person are otherwise
 * indistinguishable from the forty-one that do not.
 */
const LpoPreviewReport = ({ preview }: LpoPreviewReportProps) => {
  const { order, reconciliation, summary, lines } = preview;
  const needsAttention = lines.filter(
    (line) => !line.match.lwin18 || line.shortfall > 0 || line.problem,
  );

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border-muted p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">
              {order.poNumber ?? 'Purchase order'}
            </h2>
            <p className="text-[13px] text-text-muted">
              {[order.client, order.poDate, order.creditTerms]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          {reconciliation.agrees ? (
            <LpoChip tone="good">
              <IconCheck className="mr-1 h-3 w-3" />
              Adds up to the stated total
            </LpoChip>
          ) : (
            <LpoChip tone="bad">
              <IconAlertTriangle className="mr-1 h-3 w-3" />
              Does not match the stated total
            </LpoChip>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['Lines', String(reconciliation.lineCount)],
            ['Bottles', String(reconciliation.totalBottles)],
            ['Order value', `AED ${money(reconciliation.computedTotalAed)}`],
            [
              'Stated total',
              reconciliation.declaredTotalAed === null
                ? 'not stated'
                : `AED ${money(reconciliation.declaredTotalAed)}`,
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] uppercase tracking-wide text-text-muted">
                {label}
              </dt>
              <dd className="text-sm font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        {reconciliation.skipped.length > 0 && (
          <p className="mt-3 text-[12px] text-red-600">
            {reconciliation.skipped.length} block
            {reconciliation.skipped.length === 1 ? '' : 's'} could not be read:{' '}
            {reconciliation.skipped.join(' · ')}
          </p>
        )}
      </section>

      <section className="flex flex-wrap gap-2">
        <LpoChip tone={summary.unmatched === 0 ? 'good' : 'bad'}>
          {summary.matched} of {reconciliation.lineCount} identified
        </LpoChip>
        <LpoChip tone={summary.shortLines === 0 ? 'good' : 'bad'}>
          {summary.shortLines} short of stock
        </LpoChip>
        <LpoChip tone="plain">{summary.repackLines} repacks</LpoChip>
        <LpoChip tone={summary.lastBottleLines > 0 ? 'warn' : 'plain'}>
          {summary.lastBottleLines} take the last bottles
        </LpoChip>
        {reconciliation.disputedLines > 0 && (
          <LpoChip tone="bad">{reconciliation.disputedLines} do not multiply</LpoChip>
        )}
      </section>

      {needsAttention.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <h3 className="text-sm font-bold text-amber-900">
            {needsAttention.length} line
            {needsAttention.length === 1 ? ' needs' : 's need'} a decision
          </h3>
          <ul className="mt-2 space-y-1.5 text-[13px]">
            {needsAttention.map((line, index) => (
              <li key={index}>
                <span className="font-medium">
                  {line.wine} {line.vintage}
                </span>{' '}
                <span className="text-text-muted">
                  {line.problem ??
                    (!line.match.lwin18
                      ? line.match.verdict
                      : `short ${line.shortfall} of ${line.bottles}`)}
                </span>
                {line.match.shortlist.length > 0 && !line.match.lwin18 && (
                  <span className="text-text-muted">
                    {' '}
                    — closest: {line.match.shortlist[0]?.wine}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="overflow-x-auto rounded-xl border border-border-muted">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-muted text-left text-[11px] uppercase tracking-wide text-text-muted">
              <th className="px-3 py-2 font-medium">Ordered</th>
              <th className="px-3 py-2 font-medium">Identified as</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">We hold</th>
              <th className="px-3 py-2 text-right font-medium">Unit AED</th>
              <th className="px-3 py-2 text-right font-medium">Total AED</th>
              <th className="px-3 py-2 font-medium">Needs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-muted">
            {lines.map((line, index) => (
              <tr key={index} className="align-top">
                <td className="px-3 py-2">
                  <div className="font-medium">{line.wine}</div>
                  <div className="text-[12px] text-text-muted">
                    {line.vintage} · {line.volumeText}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {line.match.lwin18 ? (
                    <>
                      <div>{line.match.matchedWine}</div>
                      <div className="font-mono text-[11px] text-text-muted">
                        {line.match.lwin18}
                      </div>
                    </>
                  ) : (
                    <span className="text-red-600">{line.match.verdict}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {line.bottles}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {line.match.lwin18 ? line.match.availableBottles : '—'}
                  {line.match.inboundBottles > 0 && (
                    <div className="text-[11px] text-text-muted">
                      +{line.match.inboundBottles} in transit
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {money(line.unitPriceAed)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {money(line.lineTotalAed)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {line.shortfall > 0 && (
                      <LpoChip tone="bad">short {line.shortfall}</LpoChip>
                    )}
                    {line.isRepack && (
                      <LpoChip tone="warn">repack {line.soldPack}-pack</LpoChip>
                    )}
                    {line.match.takesLastBottles && (
                      <LpoChip tone="warn">last bottles</LpoChip>
                    )}
                    {line.problem && <LpoChip tone="bad">check total</LpoChip>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LpoPreviewReport;
