import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';

import getDailyOutletSales from '../data/getDailyOutletSales';
import staffProcedure from '../utils/staffProcedure';

/**
 * Daily sales at an outlet, for the staff-only daily sales page
 *
 * Staff rather than admin: see `isStaff`. Defaults to the first API-connected
 * outlet, which today is City Drinks.
 *
 * @param outletId - The outlet; omit for the first API-connected one
 * @param days - Daily windows to return, newest first
 */
const staffGetDailySales = staffProcedure
  .input(
    z.object({
      outletId: z.string().uuid().optional(),
      days: z.number().int().min(1).max(90).default(30),
    }),
  )
  .query(async ({ input }) => {
    let outletId = input.outletId;

    if (!outletId) {
      const [first] = await client<{ id: string }[]>`
        SELECT id FROM cons_outlets
        WHERE is_active AND connector = 'api'
        ORDER BY name
        LIMIT 1
      `;

      if (!first) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No outlet is connected to a stock feed yet.',
        });
      }

      outletId = first.id;
    }

    return await getDailyOutletSales(outletId, input.days);
  });

export default staffGetDailySales;
