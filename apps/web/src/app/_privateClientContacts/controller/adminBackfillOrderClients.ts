import { and, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partners, privateClientOrders } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import findOrCreateClientForPartner from '../utils/findOrCreateClientForPartner';

/**
 * Give every order that never got a client record one.
 *
 * Both create paths now keep the client, but the orders raised before that do
 * not have one — over half of them — and each is a client who cannot be
 * corrected, cannot be marked verified, and does not appear in anybody's book.
 * Some of them are sitting in the verification steps with no way out.
 *
 * Orders are grouped by partner and by name, so one client with four orders
 * becomes one record holding four, not four records. An existing client of that
 * partner is reused. The most recent order in each group supplies the contact
 * details, being the most likely to be current.
 *
 * Defaults to a **preview**: it reports exactly what it would do and writes
 * nothing. A bulk write across every partner's book is worth seeing first.
 *
 * @param input - Whether to apply the changes, or only report them
 * @returns What was done, or would be, grouped by client
 */
const adminBackfillOrderClients = wmsOperatorProcedure
  .input(
    z.object({
      apply: z.boolean().optional().default(false),
      /** Limit to one partner, to do this a book at a time. */
      partnerId: z.string().uuid().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const orphans = await db
      .select({
        id: privateClientOrders.id,
        orderNumber: privateClientOrders.orderNumber,
        partnerId: privateClientOrders.partnerId,
        partnerName: partners.businessName,
        clientName: privateClientOrders.clientName,
        clientEmail: privateClientOrders.clientEmail,
        clientPhone: privateClientOrders.clientPhone,
        clientAddress: privateClientOrders.clientAddress,
        status: privateClientOrders.status,
        createdAt: privateClientOrders.createdAt,
      })
      .from(privateClientOrders)
      .leftJoin(partners, eq(privateClientOrders.partnerId, partners.id))
      .where(
        and(
          isNull(privateClientOrders.clientId),
          isNotNull(privateClientOrders.partnerId),
          ne(sql`TRIM(${privateClientOrders.clientName})`, ''),
          ...(input.partnerId
            ? [eq(privateClientOrders.partnerId, input.partnerId)]
            : []),
        ),
      )
      .orderBy(privateClientOrders.createdAt);

    // One client is one partner plus one name, however many orders they hold.
    const groups = new Map<string, typeof orphans>();
    for (const order of orphans) {
      const key = `${order.partnerId}::${(order.clientName ?? '').trim().toLowerCase()}`;
      groups.set(key, [...(groups.get(key) ?? []), order]);
    }

    const results: {
      name: string;
      partnerName: string | null;
      orderNumbers: string[];
      created?: boolean;
    }[] = [];

    for (const orders of groups.values()) {
      // Newest last from the ordering above, so its details are the freshest.
      const newest = orders[orders.length - 1];
      if (!newest?.partnerId || !newest.clientName) continue;

      const entry = {
        name: newest.clientName.trim(),
        partnerName: newest.partnerName,
        orderNumbers: orders.map((order) => order.orderNumber),
      };

      if (!input.apply) {
        results.push(entry);
        continue;
      }

      const resolved = await findOrCreateClientForPartner(newest.partnerId, {
        name: newest.clientName,
        email: newest.clientEmail,
        phone: newest.clientPhone,
        address: newest.clientAddress,
      });

      if (!resolved) continue;

      await db
        .update(privateClientOrders)
        .set({ clientId: resolved.clientId, updatedAt: new Date() })
        .where(
          and(
            eq(privateClientOrders.partnerId, newest.partnerId),
            isNull(privateClientOrders.clientId),
            sql`LOWER(TRIM(${privateClientOrders.clientName})) = LOWER(${newest.clientName.trim()})`,
          ),
        );

      results.push({ ...entry, created: resolved.created });
    }

    return {
      applied: input.apply,
      ordersAffected: orphans.length,
      clients: results.length,
      created: results.filter((r) => r.created).length,
      reused: results.filter((r) => r.created === false).length,
      details: results,
    };
  });

export default adminBackfillOrderClients;
