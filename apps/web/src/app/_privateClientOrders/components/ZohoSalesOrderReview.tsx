'use client';

import { IconAlertTriangle, IconSparkles } from '@tabler/icons-react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface ReviewLine {
  orderItemId: string;
  wine: string;
  producer: string | null;
  vintage: number | null;
  saleLwin18: string;
  packName: string;
  pack: number;
  bottleSizeMl: number;
  cases: number;
  bottles: number;
  ratePerCase: number;
  tradeRatePerCase: number | null;
  willCreate: boolean;
}

export interface ZohoSalesOrderReviewProps {
  lines: ReviewLine[];
  customerName: string;
  orderTotal: number;
  clientTotal: number;
}

const money = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);

/**
 * A chip that says one thing about a line
 *
 * Severity is carried by the border and the icon rather than a fill, so several
 * on one line stay readable instead of competing.
 */
const Flag = ({
  tone,
  children,
}: React.PropsWithChildren<{ tone: 'new' | 'warn' }>) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${
      tone === 'warn'
        ? 'border-fill-warning/60 text-fill-warning'
        : 'border-border-muted text-text-muted'
    }`}
  >
    <Icon icon={tone === 'warn' ? IconAlertTriangle : IconSparkles} size="xs" />
    <span className="text-[11px] font-medium uppercase tracking-wide">
      {children}
    </span>
  </span>
);

/**
 * Every line of the sales order about to be raised, as it will reach Zoho
 *
 * The earlier version summarised — "3 new item codes will be created" over a
 * list of names — and a summary is exactly the wrong shape here. What goes
 * wrong on this screen is a line being billed at the wrong price or booked
 * against the wrong pack, and neither is visible in a name. The SKU is shown
 * because it is the thing actually being created, and its pack segment is the
 * part worth checking.
 *
 * Read as a document, not a form: the order is what someone will see in Zoho a
 * moment later, so the columns are the Zoho columns.
 */
const ZohoSalesOrderReview = ({
  lines,
  customerName,
  orderTotal,
  clientTotal,
}: ZohoSalesOrderReviewProps) => {
  const newCodes = lines.filter((line) => line.willCreate).length;
  const bottles = lines.reduce((sum, line) => sum + line.bottles, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Typography variant="bodySm" className="text-text-muted">
          {lines.length} line{lines.length === 1 ? '' : 's'} · {bottles} bottle
          {bottles === 1 ? '' : 's'}
        </Typography>
        {newCodes > 0 && (
          <Flag tone="new">
            {newCodes} new code{newCodes === 1 ? '' : 's'}
          </Flag>
        )}
      </div>

      {/* Wide on purpose; the page behind must never scroll sideways for it */}
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[34rem] border-collapse">
          <thead>
            <tr className="border-b border-border-muted">
              <th className="pb-1.5 text-left">
                <Typography variant="bodyXs" className="text-text-muted">
                  Item as it will appear in Zoho
                </Typography>
              </th>
              <th className="pb-1.5 pl-3 text-right">
                <Typography variant="bodyXs" className="text-text-muted">
                  Qty
                </Typography>
              </th>
              <th className="pb-1.5 pl-3 text-right">
                <Typography variant="bodyXs" className="text-text-muted">
                  Rate
                </Typography>
              </th>
              <th className="pb-1.5 pl-3 text-right">
                <Typography variant="bodyXs" className="text-text-muted">
                  Total
                </Typography>
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const unpriced = line.ratePerCase <= 0;
              const below =
                line.tradeRatePerCase !== null &&
                line.ratePerCase > 0 &&
                line.ratePerCase < line.tradeRatePerCase;

              return (
                <tr
                  key={line.orderItemId}
                  className="border-b border-border-muted/50 align-top"
                >
                  <td className="py-2 pr-2">
                    <Typography variant="bodySm" className="font-medium">
                      {line.packName}
                    </Typography>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {/*
                        The SKU, because it is the thing being created and its
                        pack segment is what silently goes wrong — a 3-pack sold
                        as a 2 differs from its parent only there.
                      */}
                      <code className="rounded bg-surface-secondary/70 px-1 py-0.5 font-mono text-[11px] text-text-muted">
                        {line.saleLwin18}
                      </code>
                      {line.willCreate && <Flag tone="new">New</Flag>}
                      {unpriced && <Flag tone="warn">No price</Flag>}
                      {below && (
                        <Flag tone="warn">
                          Under trade {money(line.tradeRatePerCase ?? 0)}
                        </Flag>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <Typography
                      variant="bodySm"
                      className="tabular-nums whitespace-nowrap"
                    >
                      {line.cases} × {line.pack}
                      <span className="text-text-muted">
                        ×{Math.round(line.bottleSizeMl / 10)}cl
                      </span>
                    </Typography>
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <Typography
                      variant="bodySm"
                      className={`tabular-nums whitespace-nowrap ${unpriced ? 'text-fill-warning' : ''}`}
                    >
                      {money(line.ratePerCase)}
                    </Typography>
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <Typography
                      variant="bodySm"
                      className="tabular-nums whitespace-nowrap font-medium"
                    >
                      {money(line.ratePerCase * line.cases)}
                    </Typography>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-1 rounded-lg bg-surface-secondary/50 px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <Typography variant="bodySm" className="font-medium">
            Billed to {customerName}
          </Typography>
          <Typography variant="bodyMd" className="font-medium tabular-nums">
            {money(orderTotal)}
          </Typography>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <Typography variant="bodySm" className="text-text-muted">
            What the client pays, per the PCO
          </Typography>
          <Typography variant="bodySm" className="text-text-muted tabular-nums">
            {money(clientTotal)}
          </Typography>
        </div>
        <Typography variant="bodyXs" className="mt-0.5 text-text-muted">
          Priced at what each line was agreed at. The distributor adds their own
          margin and VAT to reach the client&rsquo;s price.
        </Typography>
      </div>
    </div>
  );
};

export default ZohoSalesOrderReview;
