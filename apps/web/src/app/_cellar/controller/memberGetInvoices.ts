import { TRPCError } from '@trpc/server';

import { stockOwnerProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';
import { listInvoices } from '@/lib/zoho/invoices';
import logger from '@/utils/logger';

import getMemberPaymentDetails from '../data/getMemberPaymentDetails';
import getMemberZohoCustomer from '../data/getMemberZohoCustomer';

export type MemberInvoiceStatus = 'due' | 'overdue' | 'part_paid' | 'paid';

const STATUS: Record<string, MemberInvoiceStatus | undefined> = {
  sent: 'due',
  viewed: 'due',
  overdue: 'overdue',
  partially_paid: 'part_paid',
  paid: 'paid',
};

/**
 * The member's invoices, read live from Zoho Books
 *
 * Zoho is the only record of what a member has been billed and what they have
 * paid, so nothing is copied into Index to drift from it. Drafts and voided
 * invoices are left out: a draft has not been issued and a void was never
 * owed.
 *
 * Hidden from someone with view-only access. What the holder owes is the
 * holder's business and the manager's who pays on their behalf, not a guest's.
 *
 * Never throws for Zoho being away: the page says the invoices cannot be shown
 * just now, rather than failing.
 *
 * @example
 *   const { invoices, due } =
 *     await trpcClient.cellar.member.getInvoices.query();
 */
const memberGetInvoices = stockOwnerProcedure.query(async ({ ctx }) => {
  if (ctx.cellarRole === 'viewer') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Invoices are shown to the cellar holder.',
    });
  }

  const customerId = await getMemberZohoCustomer(ctx.partner.id);

  if (!customerId || !isZohoConfigured()) {
    return {
      state: 'not_linked' as const,
      invoices: [],
      due: [],
      paymentDetails: null,
    };
  }

  try {
    const invoices = [];

    for (let page = 1; page <= 5; page += 1) {
      const result = await listInvoices({ customerId, page, perPage: 200 });
      invoices.push(...result.invoices);
      if (!result.pageContext?.has_more_page) break;
    }

    const shown = invoices.flatMap((invoice) => {
      const status = STATUS[invoice.status];

      /* The customer filter is Zoho's; this makes sure of it */
      if (!status || invoice.customer_id !== customerId) return [];

      return [
        {
          id: invoice.invoice_id,
          number: invoice.invoice_number,
          date: invoice.date,
          dueDate: invoice.due_date,
          reference: invoice.reference_number || null,
          status,
          currency: invoice.currency_code,
          total: invoice.total,
          balance: status === 'paid' ? 0 : invoice.balance,
        },
      ];
    });

    shown.sort((a, b) => b.date.localeCompare(a.date));

    /* What is owed, per currency: AED and USD are never added together */
    const owed = new Map<string, number>();
    for (const invoice of shown) {
      if (invoice.balance > 0) {
        owed.set(
          invoice.currency,
          (owed.get(invoice.currency) ?? 0) + invoice.balance,
        );
      }
    }

    return {
      state: 'ok' as const,
      invoices: shown,
      due: [...owed.entries()].map(([currency, amount]) => ({
        currency,
        amount: Math.round(amount * 100) / 100,
      })),
      paymentDetails: owed.size > 0 ? await getMemberPaymentDetails() : null,
    };
  } catch (error) {
    logger.error('Could not read a member’s invoices from Zoho', {
      partnerId: ctx.partner.id,
      error,
    });

    return {
      state: 'unavailable' as const,
      invoices: [],
      due: [],
      paymentDetails: null,
    };
  }
});

export default memberGetInvoices;
