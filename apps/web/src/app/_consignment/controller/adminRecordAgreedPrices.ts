import { TRPCError } from '@trpc/server';
import { and, eq, gt, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';

import getOwnerDeliveryOwners from '@/app/_cellar/data/getOwnerDeliveryOwners';
import resolveFxToUsd from '@/app/_logistics/utils/resolveFxToUsd';
import soldToCraftAndCulture from '@/app/_partners/utils/soldToCraftAndCulture';
import { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';
import db from '@/database/client';
import {
  partners,
  saleMandateLots,
  saleMandates,
  wmsStock,
  wmsStockMovements,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import generateMandateNumber from '../utils/generateMandateNumber';

/**
 * Record prices agreed with an owner away from the portal, as their offers
 *
 * When C&C agrees with a member, by phone or on a sheet, which wines it may
 * sell and at what price, those prices belong where the member's own asking
 * prices live: their Selling offers. One offer per wine at the agreed price,
 * converted to USD at the stated rate. Bottles already sold on orders are
 * counted, so a wine sold out reads as sold, one part sold as partly sold,
 * and the rest stays offered for C&C to sell (not on any price list).
 *
 * Preview first (`dryRun`), then save. An existing offer for the same wine
 * has its price updated rather than a second one created.
 *
 * @example
 *   await trpcClient.consignment.admin.recordAgreedPrices.mutate({
 *     ownerId, eurToUsd: 1.16, dryRun: true,
 *     lines: [{ lwin18: '1035984-2023-06-00750', agreedBottles: 6, eurPerBottle: 40 }],
 *   });
 */
const adminRecordAgreedPrices = adminProcedure
  .input(
    z.object({
      ownerId: z.string().uuid(),
      /** Omit for today's rate, looked up the way shipment imports do */
      eurToUsd: z.number().min(0.5).max(2).optional(),
      dryRun: z.boolean().default(true),
      note: z.string().trim().max(300).optional(),
      lines: z
        .array(
          z.object({
            lwin18: z.string().trim().min(10),
            agreedBottles: z.number().int().min(1),
            eurPerBottle: z.number().positive(),
          }),
        )
        .min(1)
        .max(100),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const fx = input.eurToUsd
      ? { rate: input.eurToUsd, source: 'stated' }
      : await resolveFxToUsd('EUR');
    if (!fx.rate || fx.source === 'unresolved') {
      throw new TRPCError({ code: 'BAD_GATEWAY', message: 'Could not look up today\'s EUR rate. Give a rate instead.' });
    }
    const eurToUsd = fx.rate;

    const [owner] = await db
      .select({ id: partners.id, name: partners.businessName })
      .from(partners)
      .where(eq(partners.id, input.ownerId));
    if (!owner) throw new TRPCError({ code: 'NOT_FOUND', message: 'Owner not found' });

    const keys = [...new Set(input.lines.map((line) => lwinPakKeyOf(line.lwin18)))];
    const keyPattern = (key: string) => {
      const [lwin, vintage, size] = key.split('-');
      return `${lwin}-${vintage}-%-${size}`;
    };

    // Bottles of each wine that left on orders, other than the owner's own deliveries
    const picks = await db
      .select({
        lwin18: wmsStockMovements.lwin18,
        orderId: wmsStockMovements.orderId,
        cases: wmsStockMovements.quantityCases,
        bottles: wmsStockMovements.quantityBottles,
      })
      .from(wmsStockMovements)
      .where(
        and(
          eq(wmsStockMovements.fromOwnerId, owner.id),
          // Picked for orders, taken out (samples, damage), or bought by C&C: gone either way
          // Collected by the owner or taken for their own samples is not a sale
          sql`(${wmsStockMovements.movementType} = 'pick' OR ${wmsStockMovements.reasonCode} IN ('stock_out:samples', 'stock_out:marketing', 'stock_out:sold_outside_zoho') OR ${soldToCraftAndCulture})`,
          sql`(${sql.join(keys.map((key) => sql`${wmsStockMovements.lwin18} LIKE ${keyPattern(key)}`), sql` OR `)})`,
        ),
      );
    const deliveries = await getOwnerDeliveryOwners(picks.map((pick) => pick.orderId));
    /*
      Two wines can share a pack-agnostic key and differ only in the pack
      digits: Arnoux-Lachaux's village Chambolle (…-03-…) and Clos des
      Danguerins (…-02-…) are one LWIN. Where a key appears on more than one
      line, each line matches its exact code instead.
    */
    const keyCounts = new Map<string, number>();
    for (const line of input.lines) {
      const key = lwinPakKeyOf(line.lwin18);
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    }
    const matchKey = (lwin18: string) => {
      const key = lwinPakKeyOf(lwin18);
      return (keyCounts.get(key) ?? 0) > 1 ? lwin18 : key;
    };

    const soldByKey = new Map<string, number>();
    for (const pick of picks) {
      const delivery = pick.orderId ? deliveries.get(pick.orderId) : undefined;
      if (delivery?.ownerId === owner.id) continue;
      const pack = Number(pick.lwin18.split('-')[2]) || 1;
      const key = matchKey(pick.lwin18);
      soldByKey.set(key, (soldByKey.get(key) ?? 0) + Math.abs(pick.bottles ?? pick.cases * pack));
    }

    // What is still held, for the offers' lots
    const held = await db
      .select()
      .from(wmsStock)
      .where(
        and(
          eq(wmsStock.ownerId, owner.id),
          gt(wmsStock.quantityCases, 0),
          sql`(${sql.join(keys.map((key) => sql`${wmsStock.lwin18} LIKE ${keyPattern(key)}`), sql` OR `)})`,
        ),
      );

    const existing = await db
      .select({
        id: saleMandates.id,
        lwinKey: saleMandates.lwinKey,
        lwin18: saleMandates.lwin18,
        number: saleMandates.mandateNumber,
      })
      .from(saleMandates)
      .where(
        and(
          eq(saleMandates.ownerId, owner.id),
          inArray(saleMandates.lwinKey, keys),
          ne(saleMandates.status, 'withdrawn'),
        ),
      );
    // The exact wine only: two wines can share a key (Arnoux-Lachaux village and Clos des Danguerins)
    const existingFor = (lwin18: string) => existing.find((row) => row.lwin18 === lwin18);

    // Names for lines whose wine has left entirely
    const names = await db
      .selectDistinct({ lwin18: wmsStockMovements.lwin18, productName: wmsStockMovements.productName })
      .from(wmsStockMovements)
      .where(
        and(
          sql`(${sql.join(keys.map((key) => sql`${wmsStockMovements.lwin18} LIKE ${keyPattern(key)}`), sql` OR `)})`,
          eq(wmsStockMovements.movementType, 'receive'),
        ),
      );

    const plan = input.lines.map((line) => {
      const key = lwinPakKeyOf(line.lwin18);
      const match = matchKey(line.lwin18);
      const sold = Math.min(soldByKey.get(match) ?? 0, line.agreedBottles);
      const remaining = line.agreedBottles - sold;
      const rows = held.filter((row) => matchKey(row.lwin18) === match);
      const heldBottles = rows.reduce(
        (sum, row) => sum + row.quantityCases * (row.caseConfig ?? 1) + (row.openBottles ?? 0),
        0,
      );
      const status = remaining === 0 ? 'sold' : sold > 0 ? 'partially_sold' : 'offered';
      return {
        lwin18: line.lwin18,
        key,
        productName:
          rows[0]?.productName ??
          names.find((name) => matchKey(name.lwin18) === match)?.productName ??
          null,
        agreedBottles: line.agreedBottles,
        soldBottles: sold,
        remainingBottles: remaining,
        heldBottles,
        eurPerBottle: line.eurPerBottle,
        askPerBottleUsd: Math.round(line.eurPerBottle * eurToUsd * 100) / 100,
        status: status as 'sold' | 'partially_sold' | 'offered',
        existingOffer: existingFor(line.lwin18)?.number ?? null,
        problem: !rows[0] && !names.some((name) => matchKey(name.lwin18) === match)
          ? 'No wine of this code ever held for this owner'
          : remaining > heldBottles
            ? `${remaining} still to sell but only ${heldBottles} held`
            : null,
        rows,
      };
    });

    const preview = plan.map(({ rows: _rows, ...line }) => line);
    if (input.dryRun) return { saved: false, owner: owner.name, eurToUsd, rateSource: fx.source, lines: preview };

    const blocking = plan.filter((line) => line.problem?.startsWith('No wine'));
    if (blocking.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Not held for ${owner.name}: ${blocking.map((line) => line.lwin18).join(', ')}`,
      });
    }

    const note =
      input.note ??
      `Agreed with C&C at €${'{eur}'} per bottle, converted at €1 = $${eurToUsd} (${fx.source}) on ${new Date().toISOString().slice(0, 10)}`;

    for (const line of plan) {
      const ownerNotes = note.replace('{eur}', String(line.eurPerBottle));
      const current = existingFor(line.lwin18);
      if (current) {
        await db
          .update(saleMandates)
          .set({ askPerBottleUsd: line.askPerBottleUsd, ownerNotes, updatedAt: new Date() })
          .where(eq(saleMandates.id, current.id));
        continue;
      }

      const first = line.rows[0];
      const mandateNumber = await generateMandateNumber();
      await db.transaction(async (tx) => {
        const [mandate] = await tx
          .insert(saleMandates)
          .values({
            mandateNumber,
            ownerId: owner.id,
            ownerName: owner.name,
            lwin18: line.lwin18,
            lwinKey: line.key,
            productName: first?.productName ?? line.productName ?? line.lwin18,
            producer: first?.producer ?? null,
            vintage: first?.vintage ?? (Number(line.key.split('-')[1]) || null),
            bottleSize: first?.bottleSize ?? null,
            caseConfig: first?.caseConfig ?? null,
            bottlesOffered: line.agreedBottles,
            bottlesRemaining: line.remainingBottles,
            askPerBottleUsd: line.askPerBottleUsd,
            status: line.status,
            offeredAt: new Date(),
            ownerNotes,
            adminNotes: `Recorded by ${ctx.user.name ?? ctx.user.email} from prices agreed away from the portal`,
            createdBy: ctx.user.id,
          })
          .returning({ id: saleMandates.id });
        if (!mandate || line.remainingBottles === 0) return;

        // The bottles still to sell, against the rows that hold them
        let toLink = line.remainingBottles;
        const lots = [];
        for (const row of line.rows) {
          if (toLink <= 0) break;
          const rowBottles = row.quantityCases * (row.caseConfig ?? 1) + (row.openBottles ?? 0);
          const take = Math.min(rowBottles, toLink);
          toLink -= take;
          lots.push({
            mandateId: mandate.id,
            stockId: row.id,
            locationId: row.locationId,
            lotNumber: row.lotNumber ?? null,
            shipmentId: row.shipmentId ?? null,
            reExportBoeNumber: row.reExportBoeNumber ?? null,
            bottlesOffered: take,
            bottlesRemaining: take,
            previousNotForSale: row.notForSale ?? true,
          });
        }
        if (lots.length) await tx.insert(saleMandateLots).values(lots);
      });
    }

    return { saved: true, owner: owner.name, eurToUsd, rateSource: fx.source, lines: preview };
  });

export default adminRecordAgreedPrices;
