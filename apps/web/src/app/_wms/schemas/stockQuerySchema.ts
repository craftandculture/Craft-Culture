import { z } from 'zod';

/**
 * Schema for querying stock overview with filtering and pagination
 */
export const getStockOverviewSchema = z.object({});

/**
 * Schema for querying stock by product (LWIN)
 */
export const getStockByProductSchema = z.object({
  search: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  category: z.enum(['Wine', 'Spirits', 'RTD']).optional(),
  hasExpiry: z.boolean().optional(),
  lowStock: z.boolean().optional(),
  quickFilter: z
    .enum(['all', 'lowStock', 'reserved', 'expiring', 'ownStock', 'consignment'])
    .optional(),
  vintageFrom: z.number().min(1900).max(2100).optional(),
  vintageTo: z.number().min(1900).max(2100).optional(),
  sortBy: z
    .enum(['productName', 'totalCases', 'vintage', 'receivedAt'])
    .default('totalCases'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

/**
 * Schema for querying stock by owner
 */
export const getStockByOwnerSchema = z.object({
  ownerId: z.string().uuid().optional(),
});

/**
 * Schema for querying movement history
 */
export const getMovementHistorySchema = z.object({
  movementType: z
    .enum([
      'receive',
      'putaway',
      'transfer',
      'pick',
      'adjust',
      'count',
      'ownership_transfer',
      'repack_out',
      'repack_in',
      'pallet_add',
      'pallet_remove',
      'pallet_move',
    ])
    .optional(),
  lwin18: z.string().optional(),
  locationId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

/**
 * Schema for querying expiring stock
 */
export const getExpiringStockSchema = z.object({
  daysThreshold: z.number().min(1).max(365).default(90),
  includeExpired: z.boolean().default(true),
});

/**
 * Schema for global stock search
 */
export const searchStockSchema = z.object({
  query: z.string().min(1).max(100),
  limit: z.number().min(1).max(50).default(20),
});

export default getStockOverviewSchema;
