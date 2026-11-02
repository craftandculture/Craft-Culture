import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import parseOutletCodesSheet from '../utils/parseOutletCodesSheet';
import resolveOwner from '../utils/resolveOwner';
import type { OwnerRef } from '../utils/resolveOwner';
import tableReady from '../utils/tableReady';

/**
 * Take the outlet's Codes tab in as its register of codes
 *
 * Each row names a CDR code's wine, owner and invoice. The owner is resolved
 * once, here, by the same rule as a document's tag — C&C, CRU, RARE, Crurated,
 * CULT, PS — so a label nobody recognises is reported now rather than
 * discovered as a wrong statement later.
 *
 * Replaces the outlet's register wholesale: the sheet is the record, kept by
 * the person who settles the account.
 *
 * @param outletId - The outlet
 * @param file - The Codes tab exported as xlsx or csv, base64
 * @returns What was read and which owner labels matched nobody
 */
const adminImportOutletCodes = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      file: z.string().min(1),
    }),
  )
  .mutation(async ({ input }) => {
    if (!(await tableReady('cons_outlet_codes'))) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'The codes register is not on this database yet — its migration has not run.',
      });
    }

    let parsed: ReturnType<typeof parseOutletCodesSheet>;

    try {
      parsed = parseOutletCodesSheet(input.file);
    } catch (error) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: error instanceof Error ? error.message : 'Could not read that file.',
      });
    }

    if (parsed.rows.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'That Codes tab has no rows.',
      });
    }

    const owners = await client<OwnerRef[]>`
      SELECT id, name, consignment_tag AS "consignmentTag",
             owner_aliases AS "ownerAliases",
             takes_unattributed AS "takesUnattributed"
      FROM cons_owners WHERE is_active
    `;

    const unknownLabels = new Set<string>();

    const rows = parsed.rows.map((row) => {
      /*
        The label is a tag in all but name — "C&C" squashes to CC — and an owner
        is also known by its name, so "Crurated" resolves either way.
      */
      const byName = owners.find(
        (owner) =>
          owner.name.toUpperCase().replace(/[^A-Z0-9]/g, '') ===
          (row.ownerLabel ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
      );
      const ownerId =
        byName?.id ??
        (row.ownerLabel
          ? resolveOwner({ tag: row.ownerLabel, owners }).ownerId
          : null);

      if (row.ownerLabel && !ownerId) unknownLabels.add(row.ownerLabel);

      return {
        outlet_id: input.outletId,
        outlet_code: row.outletCode,
        wine_name: row.wineName,
        owner_label: row.ownerLabel,
        owner_id: ownerId,
        doc_ref: row.docRef,
        doc_date: row.docDate,
        case_config: row.caseConfig,
        is_consignment: row.isConsignment,
        source: 'codes-tab',
      };
    });

    await client`
      DELETE FROM cons_outlet_codes WHERE outlet_id = ${input.outletId}
    `;
    await client`INSERT INTO cons_outlet_codes ${client(rows)}`;

    return {
      sheetName: parsed.sheetName,
      rows: rows.length,
      withCode: rows.filter((row) => row.outlet_code).length,
      withOwner: rows.filter((row) => row.owner_id).length,
      invoices: new Set(rows.map((row) => row.doc_ref).filter(Boolean)).size,
      unknownOwners: [...unknownLabels],
    };
  });

export default adminImportOutletCodes;
