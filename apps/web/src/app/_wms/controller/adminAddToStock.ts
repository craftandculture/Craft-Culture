import { TRPCError } from '@trpc/server';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import buildLwin18 from '@/app/_lwin/utils/buildLwin18';
import db from '@/database/client';
import { partners, wmsLocations, wmsStock, wmsStockMovements } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import generateMovementNumber from '../utils/generateMovementNumber';
import normalizeLwin18 from '../utils/normalizeLwin18';

/**
 * Add wine to stock that never came through receiving
 *
 * Catching up on a cellar meant every missed line had to be hung on a
 * shipment first, then received, and it was dated today. This books it
 * straight in: the owner, the bay, the cases and loose bottles, and the day it
 * actually arrived, so the owner's timeline and statement show it then. Each
 * row gets a "receive" movement saying who added it and why, so the ledger and
 * rebuilds stay whole. No notice goes to the owner and nothing goes to Zoho.
 *
 * Sealed cases book to the pack's own code; loose bottles book to the
 * single-bottle code, the same way an opened case is recorded.
 *
 * @example
 *   await trpcClient.wms.admin.stock.addToStock.mutate({
 *     ownerId, locationId, templateLwin18: '2004488-2023-03-00750',
 *     caseConfig: 3, cases: 1, looseBottles: 0, arrivedOn: '2026-09-09',
 *     reason: 'Missed at receiving on SHP-2026-0012',
 *   });
 */
const adminAddToStock = staffAdminProcedure
  .input(
    z
      .object({
        ownerId: z.string().uuid(),
        locationId: z.string().uuid(),
        /** Copy the wine's details from an existing row, or from any row of this code */
        templateStockId: z.string().uuid().optional(),
        templateLwin18: z.string().trim().min(10).optional(),
        productName: z.string().trim().max(300).optional(),
        producer: z.string().trim().max(200).optional(),
        vintage: z.string().trim().max(10).optional(),
        /** Seven-digit LWIN, or a full LWIN18 whose wine and vintage are used */
        lwin: z.string().trim().max(30).optional(),
        bottleSizeMl: z.number().int().positive().max(30000).default(750),
        caseConfig: z.number().int().min(1).max(48),
        cases: z.number().int().min(0).max(10000),
        looseBottles: z.number().int().min(0).max(10000),
        arrivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        shipmentId: z.string().uuid().optional(),
        lotNumber: z.string().trim().max(60).optional(),
        reExportBoeNumber: z.string().trim().max(60).optional(),
        reason: z.string().trim().min(1, 'Say why it is being added').max(300),
      })
      .refine((v) => v.cases > 0 || v.looseBottles > 0, { message: 'Add at least one case or bottle.' })
      .refine((v) => v.templateStockId || v.templateLwin18 || v.productName, {
        message: 'Choose a wine or enter its name.',
      }),
  )
  .mutation(async ({ input, ctx }) => {
    // Midday in Dubai on the day it arrived, as take-outs are dated
    const midday = new Date(`${input.arrivedOn}T12:00:00+04:00`);
    if (midday.getTime() - Date.now() > 24 * 60 * 60 * 1000) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'The arrival date cannot be in the future.' });
    }
    const arrivedAt = midday.getTime() < Date.now() ? midday : new Date();
    if (Date.now() - arrivedAt.getTime() > 400 * 24 * 60 * 60 * 1000) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'That date is more than a year ago. Ask the office to record it.' });
    }

    const [owner] = await db
      .select({ id: partners.id, name: partners.businessName, type: partners.type })
      .from(partners)
      .where(eq(partners.id, input.ownerId));
    if (!owner) throw new TRPCError({ code: 'NOT_FOUND', message: 'Owner not found' });

    const [location] = await db
      .select({ id: wmsLocations.id, code: wmsLocations.locationCode })
      .from(wmsLocations)
      .where(eq(wmsLocations.id, input.locationId));
    if (!location) throw new TRPCError({ code: 'NOT_FOUND', message: 'Bay not found' });

    const [template] =
      input.templateStockId || input.templateLwin18
        ? await db
            .select()
            .from(wmsStock)
            .where(
              input.templateStockId
                ? eq(wmsStock.id, input.templateStockId)
                : eq(wmsStock.lwin18, input.templateLwin18 as string),
            )
            .orderBy(desc(wmsStock.updatedAt))
            .limit(1)
        : [];
    if ((input.templateStockId || input.templateLwin18) && !template) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'That wine is not in stock records. Enter it by hand.' });
    }

    const productName = input.productName || template?.productName;
    if (!productName) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Enter the wine name.' });
    const producer = input.producer || template?.producer || null;
    /*
      A compact 18-digit LWIN, as Cult Wines and Liv-ex send it, is dashed
      first. Without it the code had no dash and was not seven digits, so the
      wine was booked under a made-up name code that matched nothing.
    */
    const lwin = input.lwin ? normalizeLwin18(input.lwin) : undefined;

    /*
      The wine's code with this row's pack. A template or an LWIN18 gives the
      wine and vintage; a seven-digit LWIN is built out; a wine with no LWIN
      gets a name-based code, as the bulk import gives one.
    */
    const sourceCode = template?.lwin18 ?? (lwin && lwin.includes('-') ? lwin : null);

    /*
      NV is stored as no vintage. When the code carries the year, the vintage
      column takes it too, so the row cannot say one year in its code and
      another in its vintage.
    */
    const codeVintage = sourceCode?.split('-')[1];
    const vintageInput = input.vintage && /^\d{4}$/.test(input.vintage) ? parseInt(input.vintage, 10) : null;
    const vintage: number | null =
      codeVintage === '0000' || codeVintage === '1000'
        ? null
        : codeVintage && /^\d{4}$/.test(codeVintage)
          ? parseInt(codeVintage, 10)
          : (vintageInput ?? template?.vintage ?? null);
    const codeFor = (pack: number) => {
      const sizePart = (input.bottleSizeMl || 750).toString().padStart(5, '0');
      const packPart = pack.toString().padStart(2, '0');
      if (sourceCode) {
        const [wine, vintagePart] = sourceCode.split('-');
        // The size comes from the template unless one was chosen
        const size = template && !lwin ? (sourceCode.split('-')[3] ?? sizePart) : sizePart;
        return `${wine}-${vintagePart ?? '0000'}-${packPart}-${size}`;
      }
      if (lwin && /^\d{7}$/.test(lwin)) {
        return buildLwin18({
          lwin7: lwin,
          vintage,
          caseSize: pack,
          bottleSizeMl: input.bottleSizeMl,
        }).lwin18;
      }
      const namePart = productName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
      return `${namePart}-${vintage ?? '0000'}-${packPart}-${sizePart}`;
    };

    const bottleSizeMl =
      template && !lwin ? Number(template.lwin18.split('-')[3]) || input.bottleSizeMl : input.bottleSizeMl;
    const bottleSize = template?.bottleSize ?? `${bottleSizeMl / 10}cl`;
    // A member's own wine is theirs to keep until they offer it, as receiving records it
    const notForSale = owner.type === 'private_collector';
    // The template's lot, shipment and BOE describe that owner's parcel, so they carry over only to the same owner
    const sameParcel = template?.ownerId === owner.id ? template : undefined;
    const lotNumber = input.lotNumber || sameParcel?.lotNumber || `${input.arrivedOn}-ADD`;
    const shipmentId = input.shipmentId ?? sameParcel?.shipmentId ?? null;
    const reExportBoeNumber = input.reExportBoeNumber || sameParcel?.reExportBoeNumber || null;
    const by = ctx.user.name ?? ctx.user.email;

    const parts = [
      input.cases > 0 ? { pack: input.caseConfig, cases: input.cases } : null,
      // Loose bottles are single-bottle stock, whatever case they came from
      input.looseBottles > 0 ? { pack: 1, cases: input.looseBottles } : null,
    ].filter((part): part is { pack: number; cases: number } => !!part);

    const added = await db.transaction(async (tx) => {
      const rows: { stockId: string; lwin18: string; cases: number; pack: number; movementNumber: string }[] = [];

      for (const part of parts) {
        const lwin18 = codeFor(part.pack);

        const [existing] = await tx
          .select({ id: wmsStock.id })
          .from(wmsStock)
          .where(
            and(
              eq(wmsStock.lwin18, lwin18),
              eq(wmsStock.ownerId, owner.id),
              eq(wmsStock.locationId, location.id),
              lotNumber ? eq(wmsStock.lotNumber, lotNumber) : isNull(wmsStock.lotNumber),
            ),
          )
          .limit(1)
          .for('update');

        let stockId: string;
        if (existing) {
          await tx
            .update(wmsStock)
            .set({
              quantityCases: sql`${wmsStock.quantityCases} + ${part.cases}`,
              availableCases: sql`${wmsStock.availableCases} + ${part.cases}`,
              updatedAt: new Date(),
            })
            .where(eq(wmsStock.id, existing.id));
          stockId = existing.id;
        } else {
          const [created] = await tx
            .insert(wmsStock)
            .values({
              locationId: location.id,
              ownerId: owner.id,
              ownerName: owner.name,
              lwin18,
              productName,
              producer,
              vintage,
              bottleSize,
              caseConfig: part.pack,
              quantityCases: part.cases,
              reservedCases: 0,
              availableCases: part.cases,
              lotNumber,
              receivedAt: arrivedAt,
              shipmentId,
              reExportBoeNumber,
              salesArrangement: template?.salesArrangement ?? 'consignment',
              notForSale,
              category: template?.category ?? 'Wine',
              notes: `Added to stock by ${by}: ${input.reason}`,
            })
            .returning({ id: wmsStock.id });
          if (!created) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not add the stock. Nothing was saved.' });
          }
          stockId = created.id;
        }

        const movementNumber = await generateMovementNumber(tx);
        await tx.insert(wmsStockMovements).values({
          movementNumber,
          movementType: 'receive',
          lwin18,
          productName,
          quantityCases: part.cases,
          quantityBottles: part.cases * part.pack,
          toLocationId: location.id,
          // Whose wine arrived, so the owner's timeline and statement list it
          toOwnerId: owner.id,
          stockId,
          lotNumber,
          shipmentId,
          reasonCode: 'manual_add',
          notes: `Added to stock by ${by}: ${input.reason}`,
          performedBy: ctx.user.id,
          performedAt: arrivedAt,
        });

        rows.push({ stockId, lwin18, cases: part.cases, pack: part.pack, movementNumber });
      }

      return rows;
    });

    return {
      owner: owner.name,
      bay: location.code,
      productName,
      bottles: added.reduce((sum, row) => sum + row.cases * row.pack, 0),
      rows: added,
    };
  });

export default adminAddToStock;
