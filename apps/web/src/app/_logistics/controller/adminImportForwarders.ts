import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsForwarders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import cleanForwarderContacts from '../utils/cleanForwarderContacts';
import normaliseCountry from '../utils/normaliseCountry';

/**
 * Bring in a forwarder list from a spreadsheet
 *
 * Rows are grouped by company. A company already on the list (by name,
 * ignoring case) gains any contacts, modes and countries it did not have;
 * nothing it had is removed or overwritten. A new company is added.
 *
 * @example
 *   await trpcClient.logistics.admin.forwarders.import.mutate({ rows });
 */
const adminImportForwarders = adminProcedure
  .input(
    z.object({
      rows: z
        .array(
          z.object({
            name: z.string().trim().min(1),
            contactName: z.string().nullable(),
            email: z.string().nullable(),
            phone: z.string().nullable(),
            role: z.string().nullable(),
            modes: z.array(z.string()),
            originCountries: z.array(z.string()),
            notes: z.string().nullable(),
          }),
        )
        .min(1)
        .max(1000),
    }),
  )
  .mutation(async ({ input }) => {
    const byName = new Map<string, typeof input.rows>();
    for (const row of input.rows) {
      const key = row.name.toLowerCase();
      byName.set(key, [...(byName.get(key) ?? []), row]);
    }

    let added = 0;
    let updated = 0;

    for (const rows of byName.values()) {
      const name = rows[0]!.name;
      const incoming = rows
        .filter((r) => r.email)
        .map((r) => ({ email: r.email!, name: r.contactName, phone: r.phone, role: r.role }));
      const modes = [...new Set(rows.flatMap((r) => r.modes))];
      const countries = [...new Set(rows.flatMap((r) => r.originCountries.map(normaliseCountry)))];
      const notes = rows.map((r) => r.notes).find(Boolean) ?? null;

      const [existing] = await db
        .select()
        .from(logisticsForwarders)
        .where(sql`lower(${logisticsForwarders.name}) = lower(${name})`)
        .limit(1);

      if (!existing) {
        await db.insert(logisticsForwarders).values({
          name,
          ...cleanForwarderContacts(incoming),
          modes,
          originCountries: countries,
          notes,
        });
        added++;
        continue;
      }

      // Keep what is on file first, so an import never overwrites a contact someone corrected
      const merged = cleanForwarderContacts([...existing.contacts, ...incoming]);
      await db
        .update(logisticsForwarders)
        .set({
          contacts: merged.contacts,
          emailDomains: [...new Set([...existing.emailDomains, ...merged.emailDomains])],
          modes: [...new Set([...existing.modes, ...modes])],
          originCountries: [...new Set([...existing.originCountries, ...countries])],
          notes: existing.notes ?? notes,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(logisticsForwarders.id, existing.id));
      updated++;
    }

    return { added, updated, contacts: input.rows.filter((r) => r.email).length };
  });

export default adminImportForwarders;
