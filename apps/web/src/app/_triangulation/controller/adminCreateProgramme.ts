import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Turn a name into a stable slug for the programme
 *
 * @param name - The client's business name
 * @returns A lowercase, hyphenated identifier
 */
const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/**
 * Start a consignment programme for a client
 *
 * Takes a partner we already hold rather than a typed name, so the programme
 * is linked to the same record their orders, invoices and branding hang off —
 * a second spelling of "Cult Wines" would otherwise quietly become a second
 * client with its own stock.
 *
 * Idempotent by slug: creating one that exists returns it instead of failing,
 * which keeps the button harmless if it is pressed twice.
 *
 * The programme starts on `lwin`, because only Crurated issue W codes. The WMS
 * owner and Zoho customer strings are left empty on purpose — they decide what
 * the live feeds pull in, and guessing them would fill a new client's figures
 * with somebody else's stock.
 */
const adminCreateProgramme = adminProcedure
  .input(
    z.object({
      partnerId: z.string().uuid().optional().nullable(),
      /** Used when the client has no partner record yet */
      name: z.string().min(2).max(120).optional(),
      identityStrategy: z.enum(['w_code', 'lwin']).default('lwin'),
    }),
  )
  .mutation(async ({ input }) => {
    const { partnerId, identityStrategy } = input;

    let name = input.name?.trim() ?? '';

    if (partnerId) {
      const [partner] = await client<{ businessName: string }[]>`
        SELECT business_name AS "businessName"
        FROM partners WHERE id = ${partnerId} LIMIT 1
      `;

      if (!partner) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'That partner no longer exists',
        });
      }

      name = partner.businessName;
    }

    if (!name) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Choose a partner, or give the client a name',
      });
    }

    const slug = slugify(name);

    const [existing] = await client<{ id: string }[]>`
      SELECT id FROM tri_programmes WHERE slug = ${slug} LIMIT 1
    `;

    if (existing) {
      return { id: existing.id, name, slug, created: false };
    }

    const [created] = await client<{ id: string }[]>`
      INSERT INTO tri_programmes
        ("name", "slug", "consignor_id", "identity_strategy")
      VALUES (${name}, ${slug}, ${partnerId ?? null}, ${identityStrategy})
      RETURNING id
    `;

    if (!created) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not create the programme',
      });
    }

    return { id: created.id, name, slug, created: true };
  });

export default adminCreateProgramme;
