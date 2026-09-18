import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';
import { listBills } from '@/lib/zoho/bills';
import { isZohoConfigured } from '@/lib/zoho/client';

/** Stop rather than page forever if Zoho keeps saying there is more */
const MAX_PAGES = 40;

/**
 * Take the owners' bills from Zoho
 *
 * The Settled position. An owner's invoice for consigned wine that sold is a
 * supplier bill, so once it is entered "has Cru billed us?" is "does a bill
 * exist" and "have we paid?" is its balance — and the accounts and this
 * reconciliation agree by construction rather than by someone keeping two
 * records in step.
 *
 * Every bill is taken, not only the ones that look like settlements. A bill can
 * be a settlement or an outright purchase and the two cannot be told apart
 * reliably from the document — booking a purchase as a settlement would
 * understate what an owner is still owed wine for. So they are all stored and
 * the reading of them is a question for the screen, not for the sync.
 *
 * Drafts are skipped: not yet a claim on us. Voids are skipped: withdrawn.
 *
 * @returns What was taken, and the vendors it came from
 */
const adminSyncBills = adminProcedure
  .input(z.object({}).optional())
  .mutation(async () => {
    if (!isZohoConfigured()) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Zoho integration is not configured',
      });
    }

    const rows: Record<string, unknown>[] = [];
    const vendors = new Set<string>();
    let page = 1;
    let more = true;

    while (more && page <= MAX_PAGES) {
      const result = await listBills({ page, perPage: 200 });

      for (const bill of result.bills) {
        if (bill.status === 'draft' || bill.status === 'void') continue;

        vendors.add(bill.vendor_name);
        rows.push({
          zoho_bill_id: bill.bill_id,
          bill_number: bill.bill_number,
          zoho_vendor_id: bill.vendor_id ?? null,
          vendor_name: bill.vendor_name,
          status: bill.status,
          bill_date: bill.date,
          due_date: bill.due_date || null,
          reference_number: bill.reference_number ?? null,
          notes: bill.notes ?? null,
          sub_total: bill.sub_total ?? 0,
          total: bill.total ?? 0,
          balance: bill.balance ?? 0,
          currency_code: bill.currency_code ?? null,
          line_items: JSON.stringify(bill.line_items ?? []),
          last_sync_at: new Date().toISOString(),
        });
      }

      more = result.pageContext?.has_more_page ?? false;
      page += 1;
    }

    /*
      Upserted rather than rebuilt. A bill's balance changes as it is paid, and
      that movement is the answer to "have we settled?" — deleting and
      reinserting would work but would churn every row on every sync for no
      gain.
    */
    for (const row of rows) {
      await client`
        INSERT INTO zoho_bills ${client(row)}
        ON CONFLICT (zoho_bill_id) DO UPDATE SET
          bill_number = EXCLUDED.bill_number,
          vendor_name = EXCLUDED.vendor_name,
          status = EXCLUDED.status,
          bill_date = EXCLUDED.bill_date,
          due_date = EXCLUDED.due_date,
          reference_number = EXCLUDED.reference_number,
          notes = EXCLUDED.notes,
          sub_total = EXCLUDED.sub_total,
          total = EXCLUDED.total,
          balance = EXCLUDED.balance,
          currency_code = EXCLUDED.currency_code,
          line_items = EXCLUDED.line_items,
          last_sync_at = EXCLUDED.last_sync_at,
          updated_at = NOW()
      `;
    }

    return {
      bills: rows.length,
      vendors: [...vendors].sort(),
      unpaid: rows.filter((row) => Number(row.balance ?? 0) > 0).length,
    };
  });

export default adminSyncBills;
