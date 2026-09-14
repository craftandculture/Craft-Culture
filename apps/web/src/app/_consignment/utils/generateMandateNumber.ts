import { desc, like } from 'drizzle-orm';

import db from '@/database/client';
import { saleMandates } from '@/database/schema';

/**
 * Next mandate number for the year
 *
 * Max-plus-one, matching the fifteen other generators in this codebase. It is
 * not race-safe: two members offering wine in the same few milliseconds would
 * compute the same number and one would fail on the unique constraint. The
 * caller retries rather than losing the offer, which is the cheapest honest fix
 * short of moving every generator in the codebase onto a sequence.
 *
 * @example
 *   await generateMandateNumber(); // 'MND-2026-0007'
 *
 * @returns A sequential, year-scoped mandate reference
 */
const generateMandateNumber = async () => {
  const prefix = `MND-${new Date().getFullYear()}-`;

  const [latest] = await db
    .select({ mandateNumber: saleMandates.mandateNumber })
    .from(saleMandates)
    .where(like(saleMandates.mandateNumber, `${prefix}%`))
    .orderBy(desc(saleMandates.mandateNumber))
    .limit(1);

  const next = latest
    ? parseInt(latest.mandateNumber.replace(prefix, ''), 10) + 1
    : 1;

  return `${prefix}${String(next).padStart(4, '0')}`;
};

export default generateMandateNumber;
