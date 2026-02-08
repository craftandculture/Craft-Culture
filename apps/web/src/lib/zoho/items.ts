/**
 * Zoho Books Items API
 *
 * Fetch and manage inventory items from Zoho Books.
 *
 * @see https://www.zoho.com/books/api/v3/items/
 */

import { zohoFetch } from './client';

/**
 * Zoho Item (inventory product)
 */
export interface ZohoItem {
  item_id: string;
  name: string;
  sku: string;
  status: 'active' | 'inactive';
  description?: string;
  rate: number;
  unit?: string;
  tax_id?: string;
  tax_name?: string;
  tax_percentage?: number;
  purchase_rate?: number;
  purchase_account_id?: string;
  account_id?: string;
  inventory_account_id?: string;
  vendor_id?: string;
  vendor_name?: string;
  stock_on_hand?: number;
  available_stock?: number;
  actual_available_stock?: number;
  committed_stock?: number;
  initial_stock?: number;
  initial_stock_rate?: number;
  item_type: 'sales' | 'purchases' | 'sales_and_purchases' | 'inventory';
  product_type?: 'goods' | 'service';
  is_taxable?: boolean;
  reorder_level?: number;
  created_time: string;
  last_modified_time: string;
  // Custom fields may exist
  custom_fields?: Array<{
    customfield_id: string;
    label: string;
    value: string;
  }>;
}

/**
 * List items response
 */
interface ZohoItemsListResponse {
  code: number;
  message: string;
  items: ZohoItem[];
  page_context: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    total: number;
  };
}

/**
 * Get a single item by ID
 */
const getItem = async (itemId: string) => {
  const response = await zohoFetch<{ code: number; message: string; item: ZohoItem }>(
    `/items/${itemId}`,
  );
  return response.item;
};

/**
 * List items with pagination
 */
const listItems = async (page = 1, perPage = 200) => {
  const response = await zohoFetch<ZohoItemsListResponse>(
    `/items?page=${page}&per_page=${perPage}`,
  );
  return response;
};

/**
 * Fetch ALL items from Zoho (handles pagination automatically)
 */
const getAllItems = async () => {
  const allItems: ZohoItem[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await listItems(page, 200);
    allItems.push(...response.items);
    hasMore = response.page_context.has_more_page;
    page++;

    // Safety limit to prevent infinite loops
    if (page > 100) {
      console.warn('Zoho items fetch: reached page limit of 100');
      break;
    }
  }

  return allItems;
};

/**
 * Search items by name or SKU
 */
const searchItems = async (searchText: string) => {
  const response = await zohoFetch<ZohoItemsListResponse>(
    `/items?search_text=${encodeURIComponent(searchText)}`,
  );
  return response.items;
};

/**
 * Create item request
 */
export interface ZohoCreateItemRequest {
  name: string;
  sku?: string;
  rate: number;
  description?: string;
  unit?: string;
  item_type?: 'sales' | 'purchases' | 'sales_and_purchases' | 'inventory';
  product_type?: 'goods' | 'service';
  is_taxable?: boolean;
  tax_id?: string;
  purchase_rate?: number;
  account_id?: string;
  purchase_account_id?: string;
  inventory_account_id?: string;
  reorder_level?: number;
  initial_stock?: number;
  initial_stock_rate?: number;
  vendor_id?: string;
  // Standard fields repurposed for wine inventory
  upc?: string; // Used for HS Code
  isbn?: string; // Used for Country of Origin
  manufacturer?: string; // Producer
  brand?: string; // Producer (same as manufacturer)
  custom_fields?: Array<{
    label: string;
    value: string;
  }>;
}

/**
 * Wine inventory item data for Zoho sync
 */
export interface WineItemData {
  lwin18: string;
  productName: string;
  producer?: string | null;
  vintage?: number | null;
  hsCode?: string | null;
  countryOfOrigin?: string | null;
  bottlesPerCase?: number;
  bottleSizeMl?: number;
}

/**
 * Create a new item in Zoho
 */
const createItem = async (item: ZohoCreateItemRequest) => {
  const response = await zohoFetch<{ code: number; message: string; item: ZohoItem }>(
    '/items',
    {
      method: 'POST',
      body: JSON.stringify(item),
    },
  );
  return response.item;
};

/**
 * Create a wine inventory item in Zoho
 *
 * Maps WMS stock data to Zoho item fields:
 * - Name = product name + vintage (e.g., "Chateau Margaux 2015")
 * - SKU = lwin18 (critical for picking)
 * - Description = pack config only (e.g., "6x75cl")
 * - UPC = HS Code (for customs)
 * - ISBN = Country of Origin (for customs)
 * - Manufacturer/Brand = Producer
 */
const createWineItem = async (data: WineItemData) => {
  const bottlesPerCase = data.bottlesPerCase ?? 6;
  const bottleSizeMl = data.bottleSizeMl ?? 750;
  const bottleSizeCl = Math.round(bottleSizeMl / 10);

  // Build name with vintage: "Chateau Margaux 2015"
  // Only add vintage if not already in the product name
  const hasVintageInName = data.vintage && data.productName.includes(String(data.vintage));
  const itemName = data.vintage && !hasVintageInName
    ? `${data.productName} ${data.vintage}`
    : data.productName;

  // Description is just pack config: "6x75cl"
  const description = `${bottlesPerCase}x${bottleSizeCl}cl`;

  const item: ZohoCreateItemRequest = {
    name: itemName,
    sku: data.lwin18,
    rate: 0, // Will be set when selling
    unit: 'Case',
    item_type: 'inventory',
    product_type: 'goods',
    is_taxable: true,
    description,
    // Customs paperwork fields
    upc: data.hsCode ?? undefined,
    isbn: data.countryOfOrigin ?? undefined,
    // Producer
    manufacturer: data.producer ?? undefined,
    brand: data.producer ?? undefined,
  };

  return createItem(item);
};

/**
 * Find or create a wine item in Zoho by SKU (lwin18)
 *
 * Searches for existing item with matching SKU using multiple strategies:
 * 1. Exact SKU match
 * 2. LWIN-11 prefix match (first 11 digits = wine ID without vintage/pack)
 * 3. Product name search as fallback
 *
 * @returns The existing or newly created Zoho item
 */
const findOrCreateWineItem = async (data: WineItemData) => {
  // Strategy 1: Search by full LWIN-18 SKU
  const existingItems = await searchItems(data.lwin18);

  // Try exact match first
  let existingItem = existingItems.find((item) => item.sku === data.lwin18);

  // Strategy 2: Try matching by LWIN-11 prefix (first 11 digits = wine identifier)
  // This handles cases where existing items have truncated SKUs
  if (!existingItem && data.lwin18.length >= 11) {
    const lwin11Prefix = data.lwin18.substring(0, 11);
    existingItem = existingItems.find((item) => item.sku?.startsWith(lwin11Prefix));
  }

  // Strategy 3: Search by product name if SKU search didn't find anything
  if (!existingItem) {
    const nameSearchItems = await searchItems(data.productName);
    // Match by exact name or name with vintage
    const nameWithVintage = data.vintage
      ? `${data.productName} ${data.vintage}`
      : data.productName;
    existingItem = nameSearchItems.find(
      (item) =>
        item.name === data.productName ||
        item.name === nameWithVintage ||
        item.name.toLowerCase() === data.productName.toLowerCase(),
    );
  }

  if (existingItem) {
    return { item: existingItem, created: false };
  }

  // Create new item
  const newItem = await createWineItem(data);
  return { item: newItem, created: true };
};

/**
 * Update an existing item
 */
const updateItem = async (itemId: string, item: Partial<ZohoCreateItemRequest>) => {
  const response = await zohoFetch<{ code: number; message: string; item: ZohoItem }>(
    `/items/${itemId}`,
    {
      method: 'PUT',
      body: JSON.stringify(item),
    },
  );
  return response.item;
};

/**
 * Delete an item
 */
const deleteItem = async (itemId: string) => {
  const response = await zohoFetch<{ code: number; message: string }>(
    `/items/${itemId}`,
    {
      method: 'DELETE',
    },
  );
  return response;
};

/**
 * Mark item as active
 */
const markItemActive = async (itemId: string) => {
  const response = await zohoFetch<{ code: number; message: string }>(
    `/items/${itemId}/active`,
    {
      method: 'POST',
    },
  );
  return response;
};

/**
 * Mark item as inactive
 */
const markItemInactive = async (itemId: string) => {
  const response = await zohoFetch<{ code: number; message: string }>(
    `/items/${itemId}/inactive`,
    {
      method: 'POST',
    },
  );
  return response;
};

export {
  createItem,
  createWineItem,
  deleteItem,
  findOrCreateWineItem,
  getAllItems,
  getItem,
  listItems,
  markItemActive,
  markItemInactive,
  searchItems,
  updateItem,
};
