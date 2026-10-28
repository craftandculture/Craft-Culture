import { TRPCError } from '@trpc/server';
import { sql } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsForwarders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import forwarderSchema from '../schemas/forwarderSchema';
import cleanForwarderContacts from '../utils/cleanForwarderContacts';
import normaliseCountry from '../utils/normaliseCountry';

/**
 * Add a forwarder to the list, with its people and what it covers
 *
 * @example
 *   await trpcClient.logistics.admin.forwarders.create.mutate({ name: 'Hillebrand', contacts: [{ email: 'ops@hillebrand.com' }] });
 */
const adminCreateForwarder = adminProcedure.input(forwarderSchema).mutation(async ({ input }) => {
  const [clash] = await db
    .select({ id: logisticsForwarders.id })
    .from(logisticsForwarders)
    .where(sql`lower(${logisticsForwarders.name}) = lower(${input.name})`)
    .limit(1);

  if (clash) {
    throw new TRPCError({ code: 'CONFLICT', message: `${input.name} is already on the list` });
  }

  const [forwarder] = await db
    .insert(logisticsForwarders)
    .values({
      name: input.name,
      ...cleanForwarderContacts(input.contacts),
      modes: input.modes,
      originCountries: [...new Set(input.originCountries.map(normaliseCountry))],
      notes: input.notes || null,
    })
    .returning();

  if (!forwarder) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The forwarder was not saved' });
  }

  return forwarder;
});

export default adminCreateForwarder;
