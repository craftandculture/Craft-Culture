import { z } from 'zod';

import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';
import db from '@/database/client';
import { cellarAllocations } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import notifyAllocationUpdate from '../data/notifyAllocationUpdate';

/**
 * The team offers a wine to members first
 *
 * Every member with a cellar is told. The total available is the team's to
 * know: members see the price, the most they may ask for and when it closes.
 *
 * @example
 *   await trpcClient.cellarSourcing.admin.createAllocation.mutate({ wineName: 'Château Figeac', vintage: 2024, caseConfig: 6, pricePerBottleUsd: 210, totalCases: 20, holdAt: 'uae', fromStock: false });
 */
const adminCreateAllocation = staffAdminProcedure
  .input(
    z
      .object({
        wineName: z.string().trim().min(2).max(200),
        producer: z.string().trim().max(200).optional(),
        lwin18: z.string().trim().max(40).optional(),
        vintage: z.number().int().min(1800).max(2100).optional(),
        format: z.string().trim().max(40).optional(),
        caseConfig: z.number().int().min(1).max(24),
        pricePerBottleUsd: z.number().positive().max(1_000_000),
        totalCases: z.number().int().min(1).max(10_000),
        maxCasesPerMember: z.number().int().min(1).max(10_000).optional(),
        closesAt: z.date().optional(),
        deliveryNote: z.string().trim().max(300).optional(),
        description: z.string().trim().max(2000).optional(),
        holdAt: z.enum(['uae', 'uk']),
        fromStock: z.boolean(),
      })
      .refine((value) => !value.fromStock || Boolean(value.lwin18), {
        message: 'Wine from our stock needs its LWIN-18',
        path: ['lwin18'],
      })
      .refine((value) => !value.fromStock || value.holdAt === 'uae', {
        message: 'Only wine in our UAE warehouse can be reserved from stock',
        path: ['fromStock'],
      }),
  )
  .mutation(async ({ ctx, input }) => {
    const [row] = await db
      .insert(cellarAllocations)
      .values({
        wineName: input.wineName,
        producer: input.producer || null,
        lwin18: input.lwin18 ? normalizeLwin18(input.lwin18) : null,
        vintage: input.vintage ?? null,
        format: input.format || null,
        caseConfig: input.caseConfig,
        pricePerBottleUsd: input.pricePerBottleUsd,
        totalCases: input.totalCases,
        maxCasesPerMember: input.maxCasesPerMember ?? null,
        closesAt: input.closesAt ?? null,
        deliveryNote: input.deliveryNote || null,
        description: input.description || null,
        holdAt: input.holdAt,
        fromStock: input.fromStock,
        createdBy: ctx.user.id,
      })
      .returning({ id: cellarAllocations.id });

    if (row) {
      await notifyAllocationUpdate({
        event: 'opened',
        allocationId: row.id,
        wineName: input.vintage
          ? `${input.wineName} ${input.vintage}`
          : input.wineName,
      });
    }

    return { id: row?.id };
  });

export default adminCreateAllocation;
