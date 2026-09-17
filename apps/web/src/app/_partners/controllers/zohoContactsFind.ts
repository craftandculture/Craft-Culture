import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';
import { searchContacts } from '@/lib/zoho/contacts';

/**
 * Zoho customers that might be this partner
 *
 * A partner's Zoho customer was only ever set as a side effect of raising an
 * invoice, which creates one where it finds none. So a partner we have never
 * invoiced has no link, and the only way to make one was to invoice them —
 * which is exactly the wrong order for a distributor whose sales order has to
 * come first.
 *
 * Candidates rather than a match. "C D General Trading L.L.C" and "CD General
 * Trading LLC" are the same company to anybody reading them, and Zoho holds
 * duplicates; choosing between them silently is how half a client's orders end
 * up under each. So this returns what it found and a person picks.
 *
 * @example
 *   const found = await trpcClient.partners.adminFindZohoContacts
 *     .query({ partnerId });
 *
 * @returns Zoho customers matching the partner's name, closest first
 */
const zohoContactsFind = adminProcedure
  .input(
    z.object({
      partnerId: z.string().uuid(),
      /** Overrides the partner's own name when that finds nothing */
      search: z.string().optional(),
    }),
  )
  .query(async ({ input }) => {
    if (!isZohoConfigured()) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Zoho is not configured on this environment.',
      });
    }

    const [partner] = await db
      .select()
      .from(partners)
      .where(eq(partners.id, input.partnerId));

    if (!partner) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Partner not found' });
    }

    const name = input.search?.trim() || partner.businessName;

    /*
      Searched on progressively shorter fragments, because Zoho matches on the
      whole string. Handing it "C D General Trading L.L.C. - S.P.C" returns
      nothing while the customer is plainly there; the first two words find it.
    */
    const words = name
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 1);

    const attempts = [name, words.slice(0, 3).join(' '), words.slice(0, 2).join(' ')]
      .filter((term, index, all) => term && all.indexOf(term) === index);

    const found = new Map<
      string,
      { contactId: string; name: string; company: string | null; email: string | null }
    >();

    for (const term of attempts) {
      const rows = await searchContacts(term);

      for (const row of rows) {
        if (!row.contact_id) continue;

        found.set(row.contact_id, {
          contactId: row.contact_id,
          name: row.contact_name,
          company: row.company_name ?? null,
          email: row.email ?? null,
        });
      }

      if (found.size > 0) break;
    }

    /** Letters alone, which is how two spellings of one company are obviously the same */
    const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
    const wanted = squash(partner.businessName);

    const candidates = [...found.values()].sort((a, b) => {
      const scoreOf = (row: { name: string }) => {
        const key = squash(row.name);

        if (key === wanted) return 0;
        if (key.includes(wanted) || wanted.includes(key)) return 1;

        return 2;
      };

      return scoreOf(a) - scoreOf(b);
    });

    return {
      partner: {
        id: partner.id,
        name: partner.businessName,
        zohoContactId: partner.zohoContactId,
      },
      searched: name,
      candidates,
    };
  });

export default zohoContactsFind;
