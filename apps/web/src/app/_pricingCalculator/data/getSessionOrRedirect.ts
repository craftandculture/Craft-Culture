import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import db from '@/database/client';
import { pricingItems, pricingSessions, users } from '@/database/schema';

import type { CalculationVariables } from '../schemas/calculationVariablesSchema';

/**
 * Get a pricing session by ID or redirect to list page if not found
 *
 * @param sessionId - The session ID to fetch
 * @returns The session with items
 */
const getSessionOrRedirect = async (sessionId: string) => {
  const [session] = await db
    .select({
      id: pricingSessions.id,
      name: pricingSessions.name,
      status: pricingSessions.status,
      sourceType: pricingSessions.sourceType,
      sourceFileName: pricingSessions.sourceFileName,
      googleSheetId: pricingSessions.googleSheetId,
      rawData: pricingSessions.rawData,
      detectedColumns: pricingSessions.detectedColumns,
      columnMapping: pricingSessions.columnMapping,
      calculationVariables: pricingSessions.calculationVariables,
      itemCount: pricingSessions.itemCount,
      errors: pricingSessions.errors,
      warnings: pricingSessions.warnings,
      createdAt: pricingSessions.createdAt,
      updatedAt: pricingSessions.updatedAt,
      createdBy: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(pricingSessions)
    .leftJoin(users, eq(pricingSessions.createdBy, users.id))
    .where(eq(pricingSessions.id, sessionId))
    .limit(1);

  if (!session) {
    redirect('/platform/admin/pricing-calculator');
  }

  const items = await db
    .select()
    .from(pricingItems)
    .where(eq(pricingItems.sessionId, sessionId));

  return {
    ...session,
    calculationVariables: session.calculationVariables as CalculationVariables | null,
    items,
  };
};

export default getSessionOrRedirect;
