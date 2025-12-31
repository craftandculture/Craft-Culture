import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { pricingItems, pricingSessions } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import type { CalculationVariables } from '../schemas/calculationVariablesSchema';
import calculatePrices from '../utils/calculatePrices';

/**
 * Calculate prices for all items in a session
 *
 * Reads raw data and column mapping, calculates B2B and D2C prices,
 * and stores results in pricingItems table
 *
 * @example
 *   await trpcClient.pricingCalc.session.calculate.mutate({
 *     id: 'uuid-here',
 *   });
 */
const sessionCalculate = adminProcedure
  .input(
    z.object({
      id: z.string().uuid(),
    }),
  )
  .mutation(async ({ input }) => {
    const { id } = input;

    // Get session with raw data and variables
    const [session] = await db
      .select({
        id: pricingSessions.id,
        rawData: pricingSessions.rawData,
        columnMapping: pricingSessions.columnMapping,
        calculationVariables: pricingSessions.calculationVariables,
      })
      .from(pricingSessions)
      .where(eq(pricingSessions.id, id))
      .limit(1);

    if (!session) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Pricing session not found',
      });
    }

    if (!session.calculationVariables) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Please configure calculation variables first',
      });
    }

    if (!session.rawData || !Array.isArray(session.rawData)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No raw data found in session',
      });
    }

    const columnMapping = session.columnMapping as Record<string, string> | null;
    if (!columnMapping) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Column mapping not configured',
      });
    }

    const variables = session.calculationVariables as CalculationVariables;

    // Extract raw products from data using column mapping
    const rawProducts = session.rawData
      .map((row) => {
        const typedRow = row as Record<string, unknown>;

        // Get required fields
        const productNameCol = columnMapping.productName;
        const priceCol = columnMapping.ukInBondPrice;

        if (!productNameCol || !priceCol) return null;

        const productName = typedRow[productNameCol];
        const priceValue = typedRow[priceCol];

        if (!productName || priceValue === undefined || priceValue === null) return null;

        // Parse price - handle various formats
        let ukInBondPrice: number;
        if (typeof priceValue === 'number') {
          ukInBondPrice = priceValue;
        } else {
          // Try to parse string price (remove currency symbols, commas)
          const cleanPrice = String(priceValue).replace(/[^0-9.-]/g, '');
          ukInBondPrice = parseFloat(cleanPrice);
        }

        if (isNaN(ukInBondPrice) || ukInBondPrice <= 0) return null;

        // Get optional fields
        const vintageCol = columnMapping.vintage;
        const currencyCol = columnMapping.currency;
        const caseConfigCol = columnMapping.caseConfig;
        const bottleSizeCol = columnMapping.bottleSize;
        const regionCol = columnMapping.region;
        const producerCol = columnMapping.producer;
        const lwinCol = columnMapping.lwin;

        // Parse case config - default to 6 if not found or invalid
        let caseConfig = 6;
        if (caseConfigCol && typedRow[caseConfigCol]) {
          const configValue = typedRow[caseConfigCol];
          if (typeof configValue === 'number') {
            caseConfig = configValue;
          } else {
            const parsed = parseInt(String(configValue).replace(/[^0-9]/g, ''), 10);
            if (!isNaN(parsed) && parsed > 0) {
              caseConfig = parsed;
            }
          }
        }

        return {
          productName: String(productName),
          vintage: vintageCol ? String(typedRow[vintageCol] ?? '') || undefined : undefined,
          ukInBondPrice,
          inputCurrency: currencyCol ? String(typedRow[currencyCol] ?? '') || variables.inputCurrency : variables.inputCurrency,
          caseConfig,
          bottleSize: bottleSizeCol ? String(typedRow[bottleSizeCol] ?? '') || undefined : undefined,
          region: regionCol ? String(typedRow[regionCol] ?? '') || undefined : undefined,
          producer: producerCol ? String(typedRow[producerCol] ?? '') || undefined : undefined,
          lwin: lwinCol ? String(typedRow[lwinCol] ?? '') || undefined : undefined,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    if (rawProducts.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No valid products found. Check column mapping and ensure price column has valid numbers.',
      });
    }

    // Calculate prices
    const calculatedProducts = calculatePrices(rawProducts, variables);

    // Delete existing items
    await db.delete(pricingItems).where(eq(pricingItems.sessionId, id));

    // Insert new items
    await db.insert(pricingItems).values(
      calculatedProducts.map((product) => ({
        sessionId: id,
        productName: product.productName,
        vintage: product.vintage,
        region: product.region,
        producer: product.producer,
        bottleSize: product.bottleSize,
        caseConfig: product.caseConfig,
        lwin: product.lwin,
        ukInBondPrice: product.ukInBondPrice,
        inputCurrency: product.inputCurrency,
        inBondCaseUsd: product.inBondCaseUsd,
        inBondBottleUsd: product.inBondBottleUsd,
        inBondCaseAed: product.inBondCaseAed,
        inBondBottleAed: product.inBondBottleAed,
        deliveredCaseUsd: product.deliveredCaseUsd,
        deliveredBottleUsd: product.deliveredBottleUsd,
        deliveredCaseAed: product.deliveredCaseAed,
        deliveredBottleAed: product.deliveredBottleAed,
      })),
    );

    // Update session status and item count
    await db
      .update(pricingSessions)
      .set({
        status: 'calculated',
        itemCount: calculatedProducts.length,
        updatedAt: new Date(),
      })
      .where(eq(pricingSessions.id, id));

    return {
      success: true,
      itemCount: calculatedProducts.length,
    };
  });

export default sessionCalculate;
