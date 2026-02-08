/**
 * Zoho Books Inventory Adjustments API
 *
 * Create inventory adjustments to sync WMS stock quantities with Zoho Books.
 *
 * @see https://www.zoho.com/books/api/v3/inventoryadjustments/
 */

import { zohoFetch } from './client';

/**
 * Inventory adjustment line item
 */
interface InventoryAdjustmentLineItem {
  item_id: string;
  quantity_adjusted: number;
  warehouse_id?: string;
  unit?: string;
  description?: string;
}

/**
 * Create inventory adjustment request
 */
interface CreateInventoryAdjustmentRequest {
  date: string; // YYYY-MM-DD format
  reason: string;
  description?: string;
  line_items: InventoryAdjustmentLineItem[];
  account_id?: string; // Inventory adjustment account
}

/**
 * Inventory adjustment response
 */
interface InventoryAdjustment {
  inventory_adjustment_id: string;
  inventory_adjustment_number: string;
  date: string;
  reason: string;
  description: string;
  total: number;
  line_items: Array<{
    line_item_id: string;
    item_id: string;
    item_name: string;
    quantity_adjusted: number;
    item_total: number;
  }>;
}

/**
 * Create an inventory adjustment
 *
 * @example
 *   await createInventoryAdjustment({
 *     date: '2026-02-08',
 *     reason: 'Cycle Count',
 *     line_items: [
 *       { item_id: 'item123', quantity_adjusted: 5 },
 *       { item_id: 'item456', quantity_adjusted: -2 },
 *     ]
 *   });
 */
const createInventoryAdjustment = async (adjustment: CreateInventoryAdjustmentRequest) => {
  const response = await zohoFetch<{
    code: number;
    message: string;
    inventory_adjustment: InventoryAdjustment;
  }>('/inventoryadjustments', {
    method: 'POST',
    body: JSON.stringify(adjustment),
  });
  return response.inventory_adjustment;
};

/**
 * Get inventory adjustment by ID
 */
const getInventoryAdjustment = async (adjustmentId: string) => {
  const response = await zohoFetch<{
    code: number;
    message: string;
    inventory_adjustment: InventoryAdjustment;
  }>(`/inventoryadjustments/${adjustmentId}`);
  return response.inventory_adjustment;
};

/**
 * List inventory adjustments
 */
const listInventoryAdjustments = async (page = 1, perPage = 200) => {
  const response = await zohoFetch<{
    code: number;
    message: string;
    inventory_adjustments: InventoryAdjustment[];
    page_context: {
      page: number;
      per_page: number;
      has_more_page: boolean;
      total: number;
    };
  }>(`/inventoryadjustments?page=${page}&per_page=${perPage}`);
  return response;
};

export {
  createInventoryAdjustment,
  getInventoryAdjustment,
  listInventoryAdjustments,
};

export type {
  CreateInventoryAdjustmentRequest,
  InventoryAdjustment,
  InventoryAdjustmentLineItem,
};
