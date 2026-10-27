import { sql } from 'drizzle-orm';

import type db from '@/database/client';
import { privateClientOrders } from '@/database/schema';

import generateOrderNumber from './generateOrderNumber';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The next PCO order number for this year, held for the transaction
 *
 * Takes a transaction-level advisory lock first, so two orders created at the
 * same moment queue for a number instead of both reading the same last one and
 * colliding. The lock is released when the transaction ends, by which time the
 * new order (and its number) is in the table for the next caller.
 *
 * @example
 *   await db.transaction(async (tx) => {
 *   const { orderNumber } = await nextPcoOrderNumber(tx);
 *   await tx.insert(privateClientOrders).values({ orderNumber, ... });
 *   });
 *
 * @param tx - The transaction the order is inserted in
 * @returns The order number, and its sequence for callers numbering several
 */
const nextPcoOrderNumber = async (tx: Transaction) => {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext('pco_order_number'))`,
  );

  const yearStart = `PCO-${new Date().getFullYear()}-`;

  const [last] = await tx
    .select({ orderNumber: privateClientOrders.orderNumber })
    .from(privateClientOrders)
    .where(sql`${privateClientOrders.orderNumber} LIKE ${yearStart + '%'}`)
    .orderBy(sql`${privateClientOrders.orderNumber} DESC`)
    .limit(1);

  const lastSequence = last?.orderNumber
    ? parseInt(last.orderNumber.split('-')[2] ?? '0', 10) || 0
    : 0;

  const sequence = lastSequence + 1;

  return { orderNumber: generateOrderNumber(sequence), sequence };
};

/**
 * Whether an error is a unique-constraint violation (a number taken meanwhile)
 *
 * @param error - The error thrown by an insert
 * @returns True for Postgres error 23505
 */
export const isUniqueViolation = (error: unknown) => {
  const codeOf = (value: unknown) =>
    value && typeof value === 'object' && 'code' in value
      ? (value as { code: unknown }).code
      : null;
  const cause =
    error && typeof error === 'object' && 'cause' in error
      ? (error as { cause: unknown }).cause
      : null;
  const message = error instanceof Error ? error.message : '';

  return (
    codeOf(error) === '23505' ||
    codeOf(cause) === '23505' ||
    message.includes('duplicate key') ||
    message.includes('unique constraint')
  );
};

export default nextPcoOrderNumber;
