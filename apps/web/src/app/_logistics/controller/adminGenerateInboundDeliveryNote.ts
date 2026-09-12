import { TRPCError } from '@trpc/server';
import { put } from '@vercel/blob';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  logisticsDocuments,
  logisticsShipmentItems,
  logisticsShipments,
  partners,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import renderInboundDeliveryNotePDF from '../utils/renderInboundDeliveryNotePDF';

/**
 * Generate the delivery note a supplier asks for once their consignment has
 * reached our warehouse, and file it on the shipment.
 *
 * Numbered off the shipment rather than from a sequence: the outbound notes in
 * wms_delivery_notes are keyed to a dispatch batch, so borrowing that counter
 * would interleave two unrelated series and leave gaps in both.
 *
 * Stored as `proof_of_delivery`, NOT `delivery_note`. A delivery note in this
 * module means the transporter's charge for the final leg, which the cost
 * parser reads into the ledger. This document carries no charges, and filing it
 * under that type would offer it to the parser as an invoice.
 *
 * @example
 *   await trpcClient.logistics.generateInboundDeliveryNote.mutate({
 *     shipmentId: 'uuid',
 *   });
 */
const adminGenerateInboundDeliveryNote = adminProcedure
  .input(
    z.object({
      shipmentId: z.string().uuid(),
      /** PNG data URL drawn on the tablet at hand-over. */
      signatureDataUrl: z
        .string()
        .startsWith('data:image/png;base64,')
        .max(2_000_000)
        .optional(),
      signedBy: z.string().min(1).max(120).optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const [shipment] = await db
      .select()
      .from(logisticsShipments)
      .where(eq(logisticsShipments.id, input.shipmentId));

    if (!shipment) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Shipment not found' });
    }

    const items = await db
      .select()
      .from(logisticsShipmentItems)
      .where(eq(logisticsShipmentItems.shipmentId, input.shipmentId));

    if (items.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This shipment has no lines to confirm. Add its items first.',
      });
    }

    let supplierName: string | null = null;
    let supplierAddress: string | null = null;
    if (shipment.partnerId) {
      const [partner] = await db
        .select({
          businessName: partners.businessName,
          businessAddress: partners.businessAddress,
        })
        .from(partners)
        .where(eq(partners.id, shipment.partnerId));
      supplierName = partner?.businessName ?? null;
      supplierAddress = partner?.businessAddress ?? null;
    }

    const generatedAt = new Date();
    const deliveryNoteNumber = `DN-${shipment.shipmentNumber}`;

    /*
      The consignor's own address where we hold one, since that is what the
      supplier expects to see on a note they file. The shipment's origin fields
      describe where the goods left from, which is often a third-party cellar
      rather than the supplier, so they are the fallback and not the first
      choice.
    */
    const originLines = (
      supplierAddress
        ? supplierAddress.split(/\r?\n|,/)
        : [shipment.originWarehouse, shipment.originCity]
    )
      .map((part) => (part ?? '').trim())
      .filter(Boolean);

    // Both halves or neither — a drawn squiggle with no name against it, or a
    // name with nothing drawn, is worse than an honest blank rule.
    const signature =
      input.signatureDataUrl && input.signedBy
        ? {
            dataUrl: input.signatureDataUrl,
            signedBy: input.signedBy,
            signedAt: generatedAt,
          }
        : null;

    const pdfBuffer = await renderInboundDeliveryNotePDF({
      deliveryNote: { deliveryNoteNumber, generatedAt },
      signature,
      shipment: {
        shipmentNumber: shipment.shipmentNumber,
        supplierName,
        originCountry: shipment.originCountry,
        originLines,
        warehouseName: shipment.destinationWarehouse,
        reference: shipment.carrierBookingRef,
        awbOrContainer: shipment.awbNumber ?? shipment.containerNumber ?? shipment.blNumber,
        palletCount: shipment.totalPallets,
        // What the supplier cares about is when it actually landed, so prefer
        // the recorded arrival over today's date.
        arrivedAt: shipment.deliveredAt ?? shipment.ata,
        notes: shipment.partnerNotes,
      },
      items: items.map((i) => ({
        productName: i.productName,
        producer: i.producer,
        vintage: i.vintage,
        lwin: i.lwin,
        cases: i.cases,
        bottlesPerCase: i.bottlesPerCase,
        totalBottles: i.totalBottles,
      })),
    });

    const fileName = `${deliveryNoteNumber}.pdf`;
    const blob = await put(`logistics/delivery-notes/${fileName}`, pdfBuffer, {
      access: 'public',
      contentType: 'application/pdf',
      addRandomSuffix: true,
    });

    const [document] = await db
      .insert(logisticsDocuments)
      .values({
        shipmentId: shipment.id,
        documentType: 'proof_of_delivery',
        documentNumber: deliveryNoteNumber,
        fileUrl: blob.url,
        fileName,
        fileSize: pdfBuffer.length,
        mimeType: 'application/pdf',
        issueDate: generatedAt,
        uploadedBy: ctx.user.id,
        // Ours, not the supplier's — there is nothing to read back out of it,
        // so it is marked done rather than left for the extraction worker.
        extractionStatus: 'completed',
      })
      .returning();

    return {
      deliveryNoteNumber,
      fileUrl: blob.url,
      signed: signature !== null,
      documentId: document?.id ?? null,
      totalCases: items.reduce((s, i) => s + i.cases, 0),
      totalBottles: items.reduce(
        (s, i) => s + (i.totalBottles ?? i.cases * (i.bottlesPerCase ?? 12)),
        0,
      ),
    };
  });

export default adminGenerateInboundDeliveryNote;
