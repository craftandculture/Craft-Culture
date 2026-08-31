'use client';

import { IconAlertTriangle, IconCheck, IconFileExport } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useState } from 'react';
import { toast } from 'sonner';

import { PEGGED } from '@/app/_logistics/utils/resolveFxToUsd';
import useTRPC from '@/lib/trpc/browser';
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
 * The dirham's fixed rate to the dollar, from the one place that holds it.
 *
 * AED is pegged, so this is arithmetic rather than a rate anyone has to agree —
 * but it is still read from `PEGGED` rather than typed here, because a second
 * copy of a rate is a second answer waiting to disagree.
 */
const AED_TO_USD = PEGGED.AED ?? 0.2723;

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
  /*
    The order arrives in dirhams and is billed in dollars.

    Converting a forty-three line order by hand to check a total is the sort of
    task that gets done once and then trusted, so both readings are one click
    apart. The rate is the peg, so nothing here is an estimate.
  */
  const [currency, setCurrency] = useState<'AED' | 'USD'>('AED');
  /*
    Who the order is for, where the document does not say.

    A PDF purchase order carries its client on the letterhead. A replenishment
    spreadsheet does not — it is a stock list, and the customer is context. So
    it is asked for rather than guessed, and the order cannot be created
    without one: a sales order needs to belong to somebody.
  */
  const [client, setClient] = useState(order.client ?? '');
  const inUsd = currency === 'USD';
  const convert = (aed: number) => (inUsd ? aed * AED_TO_USD : aed);
  const amount = (aed: number) => `${currency} ${money(convert(aed))}`;

  const api = useTRPC();

  /*
    The order, keyed for you.

    Refused rather than part-done when a line is unidentified or short: half an
    order in Zoho leaves someone reconciling two partial ones, which is worse
    than none. A price disagreement does not block it — that is a conversation
    to have first, and the chips say which lines to have it about.
  */
  /*
    Lines we cannot identify are left off, not held against the rest.

    Blocking the whole order on one unmatched line was too strict: a client's
    sheet naming a wine we do not stock stopped eight good lines from being
    created, and the way through was to edit their spreadsheet. The unmatched
    ones are excluded, named on the order itself so the omission is on the
    record, and the button says how many it will create.

    A real disagreement with a stated total still blocks — that is the order
    contradicting itself, which is a different thing from us not recognising a
    wine.
  */
  const orderable = lines.filter((line) => line.match.lwin18);
  const excluded = lines.filter((line) => !line.match.lwin18);

  const blocked =
    orderable.length === 0
      ? 'no line could be identified'
      : reconciliation.agrees === false
        ? 'the order does not add up to its stated total'
        : null;

  const { mutate: createOrder, isPending: isCreating } = useMutation(
    api.lpo.admin.createZohoOrder.mutationOptions({
      onSuccess: (r) => {
        toast.success(
          `Draft ${r.salesOrderNumber ?? 'sales order'} created in Zoho — ` +
            `${r.lineCount} lines${r.itemsCreated > 0 ? `, ${r.itemsCreated} new item code${r.itemsCreated === 1 ? '' : 's'}` : ''}. ` +
            'Open it in Zoho and confirm before sending.',
          { duration: 20000 },
        );
      },
      onError: (error) => toast.error(error.message, { duration: 20000 }),
    }),
  );
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
          <div className="flex items-center gap-3">
            {/* Both readings one click apart — the order is in dirhams, the
                invoice is in dollars, and converting forty-three lines by hand
                to check a total is done once and then trusted. */}
            <div className="flex overflow-hidden rounded-md border border-border-muted text-[11px] font-semibold">
              {(['AED', 'USD'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setCurrency(code)}
                  className={`px-2 py-1 ${
                    currency === code
                      ? 'bg-text-primary text-white'
                      : 'bg-background-primary text-text-muted hover:text-text-primary'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
            {/* Asked for only when the document does not name one */}
            {!order.client && (
              <input
                value={client}
                onChange={(event) => setClient(event.target.value)}
                placeholder="Customer in Zoho"
                title="A replenishment sheet does not name its customer, so the order needs one"
                className="w-44 rounded-md border border-border-muted bg-background-primary px-2 py-1.5 text-xs"
              />
            )}
            {/* The step this screen exists to remove: 43 lines and 13 item
                codes, all of it derivable from what is already on screen. */}
            <button
              type="button"
              onClick={() =>
                createOrder({
                  client: client.trim(),
                  // We bill in dollars whatever the PO is written in
                  billingCurrency: 'USD',
                  poNumber: order.poNumber,
                  poDate: order.poDate,
                  creditTerms: order.creditTerms,
                  excluded: excluded.map((line) => line.wine),
                  lines: orderable.map((line) => ({
                      lwin18: line.match.lwin18 as string,
                      wine: line.match.matchedWine ?? line.wine,
                      vintage: Number(line.vintage) || null,
                      bottles: line.bottles,
                      soldPack: line.soldPack,
                      unitPriceAed: line.unitPriceAed,
                      bottleSizeMl: line.sizeMl,
                      // Customs fields Zoho holds on the item, not the order
                      hsCode: line.hsCode,
                      countryOfOrigin: line.countryOfOrigin,
                    })),
                })
              }
              disabled={isCreating || blocked !== null || !client.trim()}
              title={
                blocked
                  ? `Not ready: ${blocked}`
                  : !client.trim()
                    ? 'Name the customer this order is for'
                    : 'Creates a DRAFT sales order in Zoho, billed in USD, with any missing item codes'
              }
              className="flex items-center gap-1.5 rounded-md bg-text-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              <IconFileExport className="h-3.5 w-3.5" />
              {isCreating
                ? 'Creating…'
                : excluded.length > 0
                  ? `Create draft order (${orderable.length} of ${lines.length} lines)`
                  : 'Create draft order in Zoho'}
            </button>
            {reconciliation.agrees === null ? (
              // A sheet states no total, so there is nothing to agree with
              <LpoChip tone="warn">No stated total to check against</LpoChip>
            ) : reconciliation.agrees ? (
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
        </div>
        {!order.client && !client.trim() ? (
          <p className="mt-2 text-[11px] text-text-muted">
            This sheet does not name a customer — type the Zoho customer it is
            for before creating the order.
          </p>
        ) : blocked ? (
          <p className="mt-2 text-[11px] text-text-muted">
            The draft order is held back until {blocked}.
          </p>
        ) : excluded.length > 0 ? (
          <p className="mt-2 text-[11px] text-text-muted">
            {excluded.length} line{excluded.length === 1 ? '' : 's'} we could not
            identify will be left off and named on the order:{' '}
            {excluded.map((line) => line.wine).join(', ')}.
          </p>
        ) : null}
        {inUsd && (
          <p className="mt-2 text-[11px] text-text-muted">
            Converted at the dirham&rsquo;s peg, {AED_TO_USD} USD per AED — the
            order itself is stated in AED.
          </p>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['Lines', String(reconciliation.lineCount)],
            ['Bottles', String(reconciliation.totalBottles)],
            ['Order value', amount(reconciliation.computedTotalAed)],
            [
              'Stated total',
              reconciliation.declaredTotalAed === null
                ? 'not stated'
                : amount(reconciliation.declaredTotalAed),
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

      {/*
        Said once at the top as well as per line: on a forty-three line order
        the two that disagree with the quote are otherwise indistinguishable
        from the forty-one that do not.
      */}
      {summary.priceDisputes > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
            {summary.priceDisputes} line
            {summary.priceDisputes === 1 ? '' : 's'} priced differently from the
            quote
          </p>
          <p className="mt-1 text-xs text-red-700 dark:text-red-400">
            Checked against the last published quote to this client
            {summary.quotedLines > 0
              ? ` — ${summary.quotedLines} of ${lines.length} lines were quoted`
              : ''}
            . The order still adds up against itself; this is the price it adds
            up to.
          </p>
        </div>
      )}
      {summary.withoutHsCode > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            {summary.withoutHsCode} line
            {summary.withoutHsCode === 1 ? '' : 's'} have no HS code
          </p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            The code is taken from the shipment the wine arrived on and written
            onto the Zoho item. Without it the item is created a customs field
            short, which is noticed at a border rather than here — set them on
            the shipment&rsquo;s Items tab first.
          </p>
        </div>
      )}
      {summary.priceDisputes === 0 && summary.quotedLines > 0 && (
        <div className="rounded-xl border border-border-muted px-4 py-3">
          <p className="text-[13px] text-text-muted">
            Prices match the last published quote on {summary.quotedLines} of{' '}
            {lines.length} lines. The rest were not quoted.
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border-muted">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-muted text-left text-[11px] uppercase tracking-wide text-text-muted">
              <th className="px-3 py-2 font-medium">Ordered</th>
              <th className="px-3 py-2 font-medium">Identified as</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">We hold</th>
              <th className="px-3 py-2 text-right font-medium">Unit {currency}</th>
              <th className="px-3 py-2 text-right font-medium">Total {currency}</th>
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
                  {money(convert(line.unitPriceAed))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {money(convert(line.lineTotalAed))}
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
                    {/* An item created without one leaves the customs
                        paperwork a field short, and it is only noticed at the
                        border. */}
                    {line.match.lwin18 && !line.hsCode && (
                      <LpoChip tone="warn">no HS code</LpoChip>
                    )}
                    {/* The order's price against the one we offered. Whose
                        figure is right is a conversation, so it is reported
                        with both numbers rather than corrected. */}
                    {line.priceDiffersBy !== null && line.quote && (
                      <LpoChip tone="bad">
                        {line.priceDiffersBy > 0 ? 'above' : 'below'} quote{' '}
                        {line.quote.quoteRef} by {currency}{' '}
                        {money(Math.abs(convert(line.priceDiffersBy)))}
                      </LpoChip>
                    )}
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
