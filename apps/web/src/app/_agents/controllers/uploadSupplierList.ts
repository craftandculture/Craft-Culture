import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { supplierWines } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import uploadSupplierListSchema from '../schemas/uploadSupplierListSchema';

const INSERT_BATCH = 500;

/**
 * Upload a supplier wine price list
 *
 * Inserts rows immediately without LWIN matching for speed.
 * LWIN matching happens separately when Purchasing runs.
 */
const uploadSupplierList = adminProcedure
  .input(uploadSupplierListSchema)
  .mutation(async ({ input, ctx }) => {
    const { partnerId, partnerName, source, rows, appendMode } = input;

    logger.info('[Agents] Uploading supplier list', {
      partner: partnerName,
      rowCount: rows.length,
      appendMode: !!appendMode,
    });

    // Deactivate previous entries (skip in append mode for chunked uploads)
    if (!appendMode) {
      await db
        .update(supplierWines)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(supplierWines.partnerName, partnerName));
    }

    // Build insert values
    const insertValues = rows.map((row) => ({
      partnerId: partnerId ?? null,
      partnerName,
      productName: row.productName,
      vintage: row.vintage ?? null,
      country: row.country ?? null,
      region: row.region ?? null,
      bottleSize: row.bottleSize ?? null,
      costPriceUsd: row.costPriceUsd ?? null,
      costPriceGbp: row.costPriceGbp ?? null,
      costPriceEur: row.costPriceEur ?? null,
      moq: row.moq ?? null,
      availableQuantity: row.availableQuantity ?? null,
      source: source ?? null,
      uploadedBy: ctx.user.id,
      isActive: true,
    }));

    // Batch insert in chunks to stay under Postgres parameter limits
    for (let i = 0; i < insertValues.length; i += INSERT_BATCH) {
      await db
        .insert(supplierWines)
        .values(insertValues.slice(i, i + INSERT_BATCH));
    }

    logger.info('[Agents] Supplier list uploaded', {
      partner: partnerName,
      total: rows.length,
    });

    return {
      success: true,
      total: rows.length,
    };
  });

export default uploadSupplierList;
