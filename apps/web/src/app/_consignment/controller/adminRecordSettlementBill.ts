import { TRPCError } from '@trpc/server';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { z } from 'zod';

import db, { client } from '@/database/client';
import { consignmentSettlements, partners } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';
import { listBills } from '@/lib/zoho/bills';
import { isZohoConfigured } from '@/lib/zoho/client';

/**
 * Record a bill that Finance raised by hand in Zoho against a settlement
 *
 * Automatic bill creation runs as a background job, and background jobs are
 * switched off, so in practice Finance raises payout bills in Zoho directly.
 * Without this the settlement never learns about the bill, its Bill column
 * reads "—" for ever, and the same member can be billed (and paid) twice.
 *
 * The number is looked up in Zoho and the bill's Zoho id is stored on the
 * settlement, exactly as the job would have stored it. Once a settlement has a
 * bill id the job skips it, so it can never be billed automatically again.
 *
 * Refused when the number is not in Zoho, when the bill is void, when it was
 * raised against a different vendor from the member's own, or when it is
 * already recorded against another settlement. Nothing is sent to the member.
 */
const adminRecordSettlementBill = staffAdminProcedure
  .input(
    z.object({
      settlementId: z.string().uuid(),
      billNumber: z.string().trim().min(1).max(100),
    }),
  )
  .mutation(async ({ input }) => {
    if (!isZohoConfigured()) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Zoho is not configured, so the bill cannot be checked.',
      });
    }

    const [settlement] = await db
      .select({
        id: consignmentSettlements.id,
        settlementNumber: consignmentSettlements.settlementNumber,
        zohoBillId: consignmentSettlements.zohoBillId,
        payoutRunId: consignmentSettlements.payoutRunId,
        ownerVendorId: partners.zohoVendorId,
      })
      .from(consignmentSettlements)
      .leftJoin(partners, eq(partners.id, consignmentSettlements.ownerId))
      .where(eq(consignmentSettlements.id, input.settlementId))
      .limit(1);

    if (!settlement) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Settlement not found.',
      });
    }

    if (settlement.zohoBillId) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `${settlement.settlementNumber} already has a bill recorded.`,
      });
    }

    if (!settlement.payoutRunId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `${settlement.settlementNumber} is not in a payout run yet.`,
      });
    }

    const wanted = input.billNumber.toLowerCase();
    const { bills } = await listBills({ billNumber: input.billNumber });
    const bill = bills.find(
      (candidate) => candidate.bill_number?.trim().toLowerCase() === wanted,
    );

    if (!bill) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `No bill numbered ${input.billNumber} was found in Zoho. Check the number and try again.`,
      });
    }

    if (bill.status === 'void') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `${bill.bill_number} is void in Zoho and cannot be recorded.`,
      });
    }

    if (
      settlement.ownerVendorId &&
      bill.vendor_id &&
      bill.vendor_id !== settlement.ownerVendorId
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `${bill.bill_number} was raised against ${bill.vendor_name}, which is not this member's vendor record in Zoho.`,
      });
    }

    const [elsewhere] = await db
      .select({ settlementNumber: consignmentSettlements.settlementNumber })
      .from(consignmentSettlements)
      .where(
        and(
          eq(consignmentSettlements.zohoBillId, bill.bill_id),
          ne(consignmentSettlements.id, settlement.id),
        ),
      )
      .limit(1);

    if (elsewhere) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `${bill.bill_number} is already recorded against ${elsewhere.settlementNumber}.`,
      });
    }

    /*
      Guarded so that two people recording at once, or the bill job finishing
      in the meantime, cannot overwrite a bill id that is already there.
    */
    const [recorded] = await db
      .update(consignmentSettlements)
      .set({ zohoBillId: bill.bill_id, updatedAt: new Date() })
      .where(
        and(
          eq(consignmentSettlements.id, settlement.id),
          isNull(consignmentSettlements.zohoBillId),
        ),
      )
      .returning({ id: consignmentSettlements.id });

    if (!recorded) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `${settlement.settlementNumber} has just had a bill recorded by someone else.`,
      });
    }

    /*
      Kept in the bills cache so the payout screen can show the number. The
      bills sync stores every bill except drafts and voids, so this follows the
      same rule and the next sync simply refreshes the row.
    */
    if (bill.status !== 'draft') {
      try {
        await client`
        INSERT INTO zoho_bills ${client({
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
        })}
        ON CONFLICT (zoho_bill_id) DO NOTHING
      `;
      } catch (error) {
        // The bill is recorded; only the number on screen waits for the next sync
        console.error('Could not cache a recorded consignment bill', {
          billId: bill.bill_id,
          error,
        });
      }
    }

    return {
      settlementNumber: settlement.settlementNumber,
      billNumber: bill.bill_number,
    };
  });

export default adminRecordSettlementBill;
