import { TRPCError } from '@trpc/server';
import { and, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsForwarders, logisticsQuoteRequestRecipients, logisticsQuotes } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import forwarderEmailDomain from '../utils/forwarderEmailDomain';

/**
 * Edit a forwarder, or fold a duplicate into the one to keep
 *
 * Contacts are replaced as given and their domains recalculated. Merging moves
 * the duplicate's quotes and request rows to the forwarder kept, adds its
 * contacts there, and removes it; a request that asked both keeps one row.
 *
 * @example
 *   await trpcClient.logistics.admin.forwarders.update.mutate({ forwarderId, contacts: [{ email: 'ops@hillebrand.com' }] });
 *   await trpcClient.logistics.admin.forwarders.update.mutate({ forwarderId: duplicateId, mergeIntoId: keepId });
 */
const adminUpdateForwarder = adminProcedure
  .input(
    z.object({
      forwarderId: z.string().uuid(),
      name: z.string().trim().min(1).optional(),
      contacts: z
        .array(z.object({ name: z.string().trim().optional(), email: z.string().trim().toLowerCase().email() }))
        .max(20)
        .optional(),
      isActive: z.boolean().optional(),
      mergeIntoId: z.string().uuid().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const [forwarder] = await db
      .select()
      .from(logisticsForwarders)
      .where(eq(logisticsForwarders.id, input.forwarderId))
      .limit(1);

    if (!forwarder) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Forwarder not found' });
    }

    if (input.mergeIntoId) {
      if (input.mergeIntoId === forwarder.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'A forwarder cannot be merged into itself' });
      }

      const [keep] = await db
        .select()
        .from(logisticsForwarders)
        .where(eq(logisticsForwarders.id, input.mergeIntoId))
        .limit(1);

      if (!keep) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'The forwarder to keep was not found' });
      }

      await db.transaction(async (tx) => {
        await tx
          .update(logisticsQuotes)
          .set({ forwarderId: keep.id, updatedAt: new Date() })
          .where(eq(logisticsQuotes.forwarderId, forwarder.id));

        // A request that asked both keeps the row already on the forwarder kept
        await tx.execute(sql`
          DELETE FROM ${logisticsQuoteRequestRecipients} dup
          USING ${logisticsQuoteRequestRecipients} kept
          WHERE dup.forwarder_id = ${forwarder.id}
            AND kept.forwarder_id = ${keep.id}
            AND kept.request_id = dup.request_id
        `);
        await tx
          .update(logisticsQuoteRequestRecipients)
          .set({ forwarderId: keep.id, updatedAt: new Date() })
          .where(eq(logisticsQuoteRequestRecipients.forwarderId, forwarder.id));

        const emails = new Set(keep.contacts.map((c) => c.email.toLowerCase()));
        await tx
          .update(logisticsForwarders)
          .set({
            contacts: [...keep.contacts, ...forwarder.contacts.filter((c) => !emails.has(c.email.toLowerCase()))],
            emailDomains: [...new Set([...keep.emailDomains, ...forwarder.emailDomains])],
            updatedAt: new Date(),
          })
          .where(eq(logisticsForwarders.id, keep.id));
        await tx.delete(logisticsForwarders).where(eq(logisticsForwarders.id, forwarder.id));
      });

      return { mergedInto: keep.id };
    }

    if (input.name && input.name.toLowerCase() !== forwarder.name.toLowerCase()) {
      const [clash] = await db
        .select({ id: logisticsForwarders.id })
        .from(logisticsForwarders)
        .where(and(sql`lower(${logisticsForwarders.name}) = lower(${input.name})`, ne(logisticsForwarders.id, forwarder.id)))
        .limit(1);

      if (clash) {
        throw new TRPCError({ code: 'CONFLICT', message: `${input.name} is already on file; merge into it instead` });
      }
    }

    const [updated] = await db
      .update(logisticsForwarders)
      .set({
        ...(input.name && { name: input.name }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.contacts && {
          contacts: input.contacts.map((c) => ({ email: c.email, ...(c.name ? { name: c.name } : {}) })),
          emailDomains: [
            ...new Set(input.contacts.map((c) => forwarderEmailDomain(c.email)).filter((d): d is string => !!d)),
          ],
        }),
        updatedAt: new Date(),
      })
      .where(eq(logisticsForwarders.id, forwarder.id))
      .returning();

    if (!updated) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The change was not saved' });
    }

    return updated;
  });

export default adminUpdateForwarder;
