/**
 * Zoho Create Bill Job
 *
 * Event-driven job to create a bill in Zoho Books when a consignment settlement is created.
 * Bills represent money owed to product owners (vendors).
 */

import { logger, task } from '@trigger.dev/sdk';
import { eq } from 'drizzle-orm';

import { consignmentSettlements, partners } from '@/database/schema';
import { createBill } from '@/lib/zoho/bills';
import { isZohoConfigured } from '@/lib/zoho/client';
import { upsertContactByEmail } from '@/lib/zoho/contacts';
import triggerDb from '@/trigger/triggerDb';

interface ZohoCreateBillPayload {
  settlementId: string;
}

export const zohoCreateBillJob = task({
  id: 'zoho-create-bill',
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  async run(payload: ZohoCreateBillPayload) {
    logger.info('Creating Zoho bill', { settlementId: payload.settlementId });

    if (!isZohoConfigured()) {
      logger.warn('Zoho integration not configured');
      return { success: false, reason: 'not_configured' };
    }

    // Fetch settlement with owner
    const [settlement] = await triggerDb
      .select({
        id: consignmentSettlements.id,
        settlementNumber: consignmentSettlements.settlementNumber,
        ownerId: consignmentSettlements.ownerId,
        owedToOwner: consignmentSettlements.owedToOwner,
        zohoBillId: consignmentSettlements.zohoBillId,
      })
      .from(consignmentSettlements)
      .where(eq(consignmentSettlements.id, payload.settlementId))
      .limit(1);

    if (!settlement) {
      logger.error('Settlement not found', {
        settlementId: payload.settlementId,
      });
      return { success: false, reason: 'settlement_not_found' };
    }

    if (settlement.zohoBillId) {
      logger.info('Bill already exists', {
        settlementId: settlement.id,
        zohoBillId: settlement.zohoBillId,
      });
      return { success: true, reason: 'already_exists' };
    }

    // Fetch owner (partner)
    const [owner] = await triggerDb
      .select()
      .from(partners)
      .where(eq(partners.id, settlement.ownerId))
      .limit(1);

    if (!owner) {
      logger.error('Owner not found', { ownerId: settlement.ownerId });
      return { success: false, reason: 'owner_not_found' };
    }

    // Ensure owner has Zoho vendor ID
    let zohoVendorId = owner.zohoVendorId;
    if (!zohoVendorId) {
      logger.info('Creating Zoho vendor contact for owner', {
        ownerId: owner.id,
      });

      const contact = await upsertContactByEmail({
        contact_name: owner.businessName,
        email: owner.businessEmail ?? undefined,
        phone: owner.businessPhone ?? undefined,
        billing_address: owner.businessAddress
          ? { address: owner.businessAddress }
          : undefined,
        contact_type: 'vendor',
      });

      zohoVendorId = contact.contact_id;

      // Update partner with Zoho vendor ID
      await triggerDb
        .update(partners)
        .set({
          zohoVendorId: contact.contact_id,
          zohoLastSyncAt: new Date(),
        })
        .where(eq(partners.id, owner.id));
    }

    // Create bill in Zoho
    const bill = await createBill({
      vendor_id: zohoVendorId,
      reference_number: settlement.settlementNumber,
      line_items: [
        {
          name: 'Consignment Settlement',
          description: `Settlement ${settlement.settlementNumber}`,
          quantity: 1,
          rate: settlement.owedToOwner,
        },
      ],
      notes: `Consignment settlement ${settlement.settlementNumber}`,
    });

    // Update settlement with Zoho bill details
    await triggerDb
      .update(consignmentSettlements)
      .set({
        zohoBillId: bill.bill_id,
      })
      .where(eq(consignmentSettlements.id, settlement.id));

    logger.info('Zoho bill created', {
      settlementId: settlement.id,
      billId: bill.bill_id,
      billNumber: bill.bill_number,
    });

    return {
      success: true,
      billId: bill.bill_id,
      billNumber: bill.bill_number,
    };
  },
});
