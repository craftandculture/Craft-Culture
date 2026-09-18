import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

export interface OwedByOutlet {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  status: string;
  total: number;
  balance: number;
  currency: string | null;
  /** Days since we invoiced. Null terms are never aged. */
  ageDays: number;
  /** Whether it is due now, under this arrangement's terms */
  isDue: boolean;
  /** Why it is, or is not, due — the rule stated rather than implied */
  reason: string;
}

export interface OwedToOwner {
  ownerName: string;
  billNumber: string | null;
  billDate: string | null;
  status: string | null;
  total: number;
  balance: number;
  currency: string | null;
}

/**
 * What the outlet owes us, and what we owe the owners
 *
 * Two directions, from two places Zoho already holds. City Drinks never send a
 * settlement invoice — we bill them at shipment — so the receivable is our own
 * invoices with their balances. The owners are the other way round, and their
 * bills are the payable.
 *
 * The due-date rule is the part Zoho cannot answer, because it needs the sales:
 * an invoice falls due at month end if the wine sold before then, and at the
 * arrangement's term otherwise. Crurated at City Drinks is open-ended and is
 * never aged at all. That rule is why this module earns its place beside the
 * accounts rather than duplicating them.
 *
 * @param outletId - The outlet whose invoices to age
 * @returns What is owed each way, with the rule that decided it
 */
const adminGetOwed = adminProcedure
  .input(z.object({ outletId: z.string().uuid() }))
  .query(async ({ input }) => {
    const [outlet] = await client<
      { name: string; zohoCustomerMatch: string | null }[]
    >`
      SELECT name, zoho_customer_match AS "zohoCustomerMatch"
      FROM cons_outlets WHERE id = ${input.outletId} LIMIT 1
    `;

    if (!outlet?.zohoCustomerMatch) {
      return { outlet: outlet?.name ?? null, owed: [], owedToOwners: [], summary: null };
    }

    /*
      The shortest terms of any arrangement at this outlet. An invoice is not
      split by owner — one document covers whatever it covers — so it cannot be
      aged by an owner's terms. Where every arrangement is open-ended nothing
      is aged; where any has a term, that is the one that binds us.
    */
    const [terms] = await client<{ termsDays: number | null }[]>`
      SELECT MIN(terms_days) AS "termsDays"
      FROM cons_arrangements
      WHERE outlet_id = ${input.outletId} AND is_active
    `;

    const termsDays = terms?.termsDays ?? null;
    const match = outlet.zohoCustomerMatch
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    const owed = await client<OwedByOutlet[]>`
      SELECT invoice_number AS "invoiceNumber",
             invoice_date::text AS "invoiceDate",
             due_date::text AS "dueDate",
             status, total, balance,
             currency_code AS "currency",
             GREATEST(0, (CURRENT_DATE - invoice_date))::int AS "ageDays",
             false AS "isDue", '' AS reason
      FROM zoho_invoices
      WHERE balance > 0
        AND status NOT IN ('draft', 'void', 'paid')
        AND POSITION(${match} IN REGEXP_REPLACE(UPPER(COALESCE(customer_name, '')), '[^A-Z0-9]', '', 'g')) > 0
      ORDER BY invoice_date
    `;

    const aged = owed.map((row) => {
      if (termsDays === null) {
        return {
          ...row,
          isDue: false,
          reason: 'Open-ended — settles when the wine sells, never aged',
        };
      }

      const overTerm = row.ageDays >= termsDays;

      return {
        ...row,
        isDue: overTerm,
        reason: overTerm
          ? `${row.ageDays} days old, past the ${termsDays}-day term`
          : `${termsDays - row.ageDays} days until the ${termsDays}-day term`,
      };
    });

    const owedToOwners = await client<OwedToOwner[]>`
      SELECT ow.name AS "ownerName",
             b.bill_number AS "billNumber",
             b.bill_date::text AS "billDate",
             b.status,
             COALESCE(b.total, 0) AS total,
             COALESCE(b.balance, 0) AS balance,
             b.currency_code AS currency
      FROM cons_owners ow
      LEFT JOIN zoho_bills b
        ON POSITION(
             REGEXP_REPLACE(UPPER(ow.name), '[^A-Z0-9]', '', 'g')
             IN REGEXP_REPLACE(UPPER(COALESCE(b.vendor_name, '')), '[^A-Z0-9]', '', 'g')
           ) > 0
        AND b.balance > 0
      WHERE ow.is_active
      ORDER BY ow.name, b.bill_date
    `;

    return {
      outlet: outlet.name,
      termsDays,
      owed: aged,
      owedToOwners: owedToOwners.filter((row) => row.billNumber !== null),
      summary: {
        invoices: aged.length,
        outstanding: aged.reduce((sum, row) => sum + row.balance, 0),
        dueNow: aged
          .filter((row) => row.isDue)
          .reduce((sum, row) => sum + row.balance, 0),
        owedToOwners: owedToOwners.reduce((sum, row) => sum + row.balance, 0),
        /** Owners with nothing outstanding — either settled, or never billed us */
        ownersWithNoBill: owedToOwners.filter((row) => row.billNumber === null)
          .length,
      },
    };
  });

export default adminGetOwed;
