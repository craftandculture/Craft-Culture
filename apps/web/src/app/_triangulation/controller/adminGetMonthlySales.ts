import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import resolveProgrammeId, { uuidLike } from '../utils/programmeId';

export interface MonthlySalesRow {
  /** Month the movement falls in, as YYYY-MM */
  month: string;
  /** Whose wine it is, from the line or its SKU */
  ownerName: string;
  /** Bottles we invoiced out to the outlet */
  soldToOutletBottles: number;
  /** What we invoiced it for, in the invoice's own currency */
  soldToOutletValue: number;
  /** Bottles the outlet reports having sold on */
  outletSoldBottles: number;
  /** What the outlet sold it for, where their file states a price */
  outletSoldValue: number;
  /** Bottles the owner has invoiced us for */
  billedBottles: number;
  /** What the owner billed us, in their invoice's currency */
  billedValue: number;
  /** Bottles sold on by the outlet that no owner has billed us for yet */
  unbilledBottles: number;
  /** Currencies seen in the month, so a mixed one cannot read as a single total */
  currencies: string[];
  /** Lines contributing, so a thin month is visibly thin */
  lineCount: number;
}

/**
 * What sold each month, by owner, in bottles and in money
 *
 * The reconciliation answers "where is the wine" across all time. Settling with
 * an owner is a different question — what went in a given month, and what it
 * was worth — and it could not be answered here at all: every line carries the
 * invoice's unit price and none of it reached a screen, so value was worked out
 * by hand against the invoices the tool had already read.
 *
 * Value is `unit price x quantity` rather than anything per bottle. Zoho states
 * the rate against the unit actually sold, so a 3-pack of Margaux at 1,698 is
 * 1,698 for the line — dividing by the pack would understate it six-fold, which
 * is the same fault that read a price-per-case column as a price-per-bottle in
 * the shipment importer.
 *
 * Currencies are listed rather than summed blindly. Two currencies added
 * together make a number that looks like money and is not.
 *
 * @returns One row per month per owner, newest month first
 */
const adminGetMonthlySales = adminProcedure
  .input(
    z.object({
      programmeId: uuidLike.optional().nullable(),
      /**
       * Read every client at once rather than the one on screen.
       *
       * A mixed invoice belongs to several owners and can only be filed under
       * one client, so scoped to a programme its other owners' bottles are
       * invisible — and a settlement that cannot see an owner's wine is the
       * one thing this view exists to prevent.
       */
      allProgrammes: z.boolean().default(false),
      /** Limit to one owner; omit for every owner in the programme */
      ownerName: z.string().max(120).optional().nullable(),
    }),
  )
  .query(async ({ input }) => {
    const programmeId = resolveProgrammeId(input.programmeId);
    const { ownerName, allProgrammes } = input;

    const rows = await client<MonthlySalesRow[]>`
      WITH lines AS (
        SELECT
          TO_CHAR(COALESCE(l.doc_date, i.as_of_date), 'YYYY-MM') AS month,
          /*
            The line's own statement of ownership wins over the SKU's, because
            an invoice naming its owner is a deliberate act and the SKU's is a
            default until someone sets it.
          */
          COALESCE(
            NULLIF(TRIM(l.stated_owner_name), ''),
            NULLIF(TRIM(s.owner_name), ''),
            /*
              An owner's own invoice is theirs by definition — it is the client
              billing us — so the programme it was uploaded under names the
              owner when the line itself does not. Sales lines get no such
              fallback: "Unattributed" there is real work outstanding, and
              folding it into a client would hide it.
            */
            CASE WHEN i.kind = 'owner_invoice' THEN CASE p.consignment_tag
              WHEN 'CC' THEN 'C&C' WHEN 'CRURATED' THEN 'Crurated'
              WHEN 'RARE' THEN 'Rare' WHEN 'CRU' THEN 'Cru'
              WHEN 'CULT' THEN 'Cult' END END,
            'Unattributed'
          ) AS owner_name,
          i.kind,
          l.quantity_bottles,
          COALESCE(l.unit_price, 0) * COALESCE(l.quantity, 0) AS line_value,
          NULLIF(TRIM(l.currency), '') AS currency
        FROM tri_import_lines l
        JOIN tri_imports i ON i.id = l.import_id
        JOIN tri_programmes p ON p.id = i.programme_id
        LEFT JOIN tri_skus s ON s.id = l.sku_id
        WHERE ${allProgrammes ? client`TRUE` : client`i.programme_id = ${programmeId}`}
          AND i.status = 'committed'
          AND l.status <> 'ignored'
          AND i.kind IN ('cc_sales_to_cd', 'cd_sales', 'owner_invoice')
          AND COALESCE(l.doc_date, i.as_of_date) IS NOT NULL
      )
      SELECT
        month,
        owner_name AS "ownerName",
        COALESCE(SUM(quantity_bottles) FILTER (WHERE kind = 'cc_sales_to_cd'), 0)::float8
          AS "soldToOutletBottles",
        COALESCE(SUM(line_value) FILTER (WHERE kind = 'cc_sales_to_cd'), 0)::float8
          AS "soldToOutletValue",
        COALESCE(SUM(quantity_bottles) FILTER (WHERE kind = 'cd_sales'), 0)::float8
          AS "outletSoldBottles",
        COALESCE(SUM(line_value) FILTER (WHERE kind = 'cd_sales'), 0)::float8
          AS "outletSoldValue",
        COALESCE(SUM(quantity_bottles) FILTER (WHERE kind = 'owner_invoice'), 0)::float8
          AS "billedBottles",
        COALESCE(SUM(line_value) FILTER (WHERE kind = 'owner_invoice'), 0)::float8
          AS "billedValue",
        /*
          What the outlet sold that nobody has billed us for. Negative would
          mean an owner billed for more than sold, which is worth seeing rather
          than clamping to zero.
        */
        (
          COALESCE(SUM(quantity_bottles) FILTER (WHERE kind = 'cd_sales'), 0)
          - COALESCE(SUM(quantity_bottles) FILTER (WHERE kind = 'owner_invoice'), 0)
        )::float8 AS "unbilledBottles",
        COALESCE(
          ARRAY_AGG(DISTINCT currency) FILTER (WHERE currency IS NOT NULL),
          ARRAY[]::text[]
        ) AS currencies,
        COUNT(*)::int AS "lineCount"
      FROM lines
      ${ownerName ? client`WHERE owner_name = ${ownerName}` : client``}
      GROUP BY month, owner_name
      ORDER BY month DESC, owner_name
    `;

    return rows;
  });

export default adminGetMonthlySales;
