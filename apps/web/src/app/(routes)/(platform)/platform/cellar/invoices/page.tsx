'use client';

import { IconDownload, IconReceipt } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

import CellarPageHeader from '@/app/_cellar/components/CellarPageHeader';
import CellarState from '@/app/_cellar/components/CellarState';
import HowToPayPanel from '@/app/_cellar/components/HowToPayPanel';
import useIsCellarViewer from '@/app/_cellar/hooks/useIsCellarViewer';
import useTRPC from '@/lib/trpc/browser';

const money = (currency: string, value: number) =>
  `${currency} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/*
  An invoice's reference is shown only when it reads like the member's own
  purchase order. Our internal order numbers mean nothing to a collector.
*/
const clientReference = (reference: string | null | undefined) =>
  reference && !/^(PCO|SO|INV)-/i.test(reference.trim()) ? reference : null;

type MemberInvoiceStatus = 'due' | 'overdue' | 'part_paid' | 'paid';

const STATUS_LABEL: Record<MemberInvoiceStatus, string> = {
  due: 'Due',
  overdue: 'Overdue',
  part_paid: 'Part paid',
  paid: 'Paid',
};

const STATUS_TONE: Record<MemberInvoiceStatus, string> = {
  due: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300',
  overdue:
    'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300',
  part_paid:
    'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300',
};

/**
 * A member's invoices from Craft & Culture
 *
 * Membership, extra storage, deliveries, condition reports and UK moves are all
 * billed in Zoho Books; this is where the member sees them, what is still owed,
 * and how to pay it. What is owed comes first, each with its own payment
 * details, because payment is due on receipt and "how much, and where to" is
 * the question that brings someone here.
 */
const InvoicesPage = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const isViewer = useIsCellarViewer();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    ...api.cellar.member.getInvoices.queryOptions(),
    enabled: !isViewer,
  });

  const download = async (invoiceId: string) => {
    setDownloadingId(invoiceId);
    try {
      const file = await queryClient.fetchQuery(
        api.cellar.member.getInvoicePdf.queryOptions({ invoiceId }),
      );
      const bytes = Uint8Array.from(atob(file.base64), (char) =>
        char.charCodeAt(0),
      );
      const url = URL.createObjectURL(
        new Blob([bytes], { type: 'application/pdf' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = file.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(
        'The invoice could not be downloaded just now. Please try again shortly.',
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const unpaid = data?.invoices.filter((invoice) => invoice.balance > 0) ?? [];

  return (
    <div className="w-full pb-8">
      <CellarPageHeader
        title="Invoices"
        description="Your invoices from Craft & Culture. Payment is due on receipt."
      />

      {isViewer && (
        <CellarState
          kind="empty"
          message="Invoices are shown to the cellar holder."
        />
      )}

      {!isViewer && isLoading && <CellarState kind="loading" />}

      {!isViewer && isError && <CellarState kind="error" />}

      {data?.state === 'not_linked' && (
        <CellarState
          kind="empty"
          icon={IconReceipt}
          title="No invoices yet"
          message="Your invoices will appear here once the first one is issued."
        />
      )}

      {data?.state === 'unavailable' && <CellarState kind="error" />}

      {data?.state === 'ok' && (
        <>
          {data.due.length > 0 && (
            <section className="to-surface-primary mb-6 rounded-xl border border-emerald-200 bg-gradient-to-b from-emerald-50/70 p-4 shadow-sm dark:border-emerald-900/50 dark:from-emerald-500/10">
              <p className="text-text-muted text-[11px] font-semibold uppercase tracking-wider">
                To pay
              </p>
              <p className="text-text-primary mt-1 text-2xl font-semibold tabular-nums">
                {data.due
                  .map((due) => money(due.currency, due.amount))
                  .join(' + ')}
              </p>
              <p className="text-text-muted mt-0.5 text-xs">
                {unpaid.length} {unpaid.length === 1 ? 'invoice' : 'invoices'}{' '}
                outstanding. Please use the invoice number as your payment
                reference.
              </p>

              <ul className="mt-3 space-y-2">
                {unpaid.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="border-border-muted bg-surface-primary rounded-lg border"
                  >
                    <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-text-primary font-mono text-sm font-semibold">
                          {invoice.number}
                        </p>
                        <p className="text-text-muted text-xs">
                          {format(new Date(invoice.date), 'd MMM yyyy')}
                          {clientReference(invoice.reference)
                            ? ` · ${clientReference(invoice.reference)}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-text-primary text-sm font-semibold tabular-nums">
                          {money(invoice.currency, invoice.balance)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPayingId((current) =>
                              current === invoice.id ? null : invoice.id,
                            )
                          }
                          className="bg-text-primary text-surface-primary h-9 rounded-lg px-3 text-xs font-semibold"
                        >
                          {payingId === invoice.id ? 'Hide' : 'How to pay'}
                        </button>
                      </div>
                    </div>
                    {payingId === invoice.id && (
                      <div className="border-border-muted border-t p-3">
                        <HowToPayPanel
                          details={
                            invoice.currency === 'AED'
                              ? (data.paymentDetailsAed ?? data.paymentDetails)
                              : data.paymentDetails
                          }
                          {...(invoice.currency === 'USD'
                            ? { amountUsd: invoice.balance }
                            : { amountAed: invoice.balance })}
                          reference={invoice.number}
                          confirmHint={false}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.invoices.length === 0 ? (
            <CellarState
              kind="empty"
              icon={IconReceipt}
              title="No invoices yet"
              message="You have no invoices yet. They will appear here once issued."
            />
          ) : (
            <section>
              <h2 className="text-text-muted mb-2 text-[11px] font-semibold uppercase tracking-wider">
                All invoices
              </h2>
              {/* A phone gets one card per invoice */}
              <ul className="space-y-2 sm:hidden">
                {data.invoices.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="border-border-muted bg-surface-primary flex items-center gap-3 rounded-xl border p-3 shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-text-primary font-mono text-sm font-semibold">
                          {invoice.number}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATUS_TONE[invoice.status]}`}
                        >
                          {STATUS_LABEL[invoice.status]}
                        </span>
                      </div>
                      <p className="text-text-muted mt-0.5 text-xs">
                        {format(new Date(invoice.date), 'd MMM yyyy')}
                        {clientReference(invoice.reference)
                          ? ` · ${clientReference(invoice.reference)}`
                          : ''}
                      </p>
                      <p className="text-text-primary mt-1 text-sm font-semibold tabular-nums">
                        {money(invoice.currency, invoice.total)}
                        {invoice.status === 'part_paid' && (
                          <span className="text-text-muted ml-1 text-xs font-normal">
                            ({money(invoice.currency, invoice.balance)} to pay)
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void download(invoice.id)}
                      disabled={downloadingId === invoice.id}
                      aria-label={`Download ${invoice.number}`}
                      className="border-border-muted text-text-primary inline-flex size-10 flex-shrink-0 items-center justify-center rounded-lg border disabled:opacity-50"
                    >
                      <IconDownload size={18} />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-border-muted bg-surface-primary hidden overflow-x-auto rounded-xl border shadow-sm sm:block">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-fill-muted/60 border-border-muted border-b">
                    <tr className="text-text-muted text-[10px] uppercase tracking-[0.08em]">
                      <th className="px-3 py-2 text-left">Invoice</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-right">
                        <span className="sr-only">Download</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border-muted divide-y">
                    {data.invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="px-3 py-2">
                          <span className="text-text-primary block font-mono font-medium">
                            {invoice.number}
                          </span>
                          {clientReference(invoice.reference) && (
                            <span className="text-text-muted block text-xs">
                              {clientReference(invoice.reference)}
                            </span>
                          )}
                        </td>
                        <td className="text-text-muted whitespace-nowrap px-3 py-2 text-xs tabular-nums">
                          {format(new Date(invoice.date), 'd MMM yyyy')}
                        </td>
                        <td className="text-text-primary whitespace-nowrap px-3 py-2 text-right tabular-nums">
                          {money(invoice.currency, invoice.total)}
                          {invoice.status === 'part_paid' && (
                            <span className="text-text-muted block text-xs">
                              {money(invoice.currency, invoice.balance)} to pay
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATUS_TONE[invoice.status]}`}
                          >
                            {STATUS_LABEL[invoice.status]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => void download(invoice.id)}
                            disabled={downloadingId === invoice.id}
                            aria-label={`Download ${invoice.number}`}
                            className="text-text-muted hover:text-text-primary hover:bg-fill-muted inline-flex size-9 items-center justify-center rounded-md disabled:opacity-50"
                          >
                            <IconDownload size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-text-muted mt-3 flex items-center gap-1.5 text-xs">
                <IconReceipt size={14} />
                An invoice shows as paid once we have matched your transfer to
                it.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default InvoicesPage;
