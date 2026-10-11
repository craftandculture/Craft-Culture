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
 * The Zoho item name for a wine: "Chateau Margaux 2015 (6x75cl)"
 *
 * Pack and size are in the name because Zoho refuses two items with one name,
 * and the 6-pack and the 3-pack of a wine are two items.
 */
const wineItemName = (data: WineItemData) => {
  const hasVintageInName = data.vintage && data.productName.includes(String(data.vintage));
  const base = data.vintage && !hasVintageInName ? `${data.productName} ${data.vintage}` : data.productName;
  const pack = `${data.bottlesPerCase ?? 6}x${Math.round((data.bottleSizeMl ?? 750) / 10)}cl`;
  return base.includes(`(${pack})`) ? base : `${base} (${pack})`;
};

/**
 * Create a wine inventory item in Zoho
 *
 * Maps WMS stock data to Zoho item fields:
 * - Name = product name + vintage + pack (e.g., "Chateau Margaux 2015 (6x75cl)")
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

  const itemName = wineItemName(data);

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

/**
 * Find, create, or update a wine item in Zoho by SKU (lwin18)
 *
 * Matches on the exact code only — dashes ignored, so an item still holding
 * the compact form is found. It used to fall back to the first 11 characters
 * ("1015362-202" covers every vintage 2020–2029) and then to the product
 * name, which ignores pack; both attached wines to the wrong item and, when
 * they missed, created duplicates. An inactive item with the code is made
 * active again rather than duplicated.
 *
 * If found, compares name/manufacturer/brand against desired values and
 * pushes an update to Zoho when any of them have changed. This means
 * renames in the source application propagate to Zoho on next sync.
 *
 * @returns The existing, updated, or newly created Zoho item
 */
const findOrCreateWineItem = async (data: WineItemData) => {
  const flat = (sku: string | undefined) => (sku ?? '').replace(/[-\s]/g, '').toUpperCase();
  const wanted = flat(data.lwin18);
  const matches = (await searchItems(data.lwin18)).filter((item) => flat(item.sku) === wanted);
  let existingItem = matches.find((item) => item.status === 'active') ?? matches[0];

  if (existingItem && existingItem.status !== 'active') {
    await markItemActive(existingItem.item_id);
    existingItem = { ...existingItem, status: 'active' };
  }

  if (existingItem) {
    // Build the desired item shape (same logic as createWineItem so name format stays consistent)
    const desiredName = wineItemName(data);
    const desiredManufacturer = data.producer ?? undefined;
    const desiredBrand = data.producer ?? undefined;

    const nameChanged = existingItem.name !== desiredName;
    const manufacturerChanged =
      desiredManufacturer !== undefined &&
      (existingItem as ZohoItem & { manufacturer?: string }).manufacturer !==
        desiredManufacturer;
    const brandChanged =
      desiredBrand !== undefined &&
      (existingItem as ZohoItem & { brand?: string }).brand !== desiredBrand;

    const skuChanged = existingItem.sku !== data.lwin18;

    if (nameChanged || manufacturerChanged || brandChanged || skuChanged) {
      // A refused tidy-up (a name another item holds) must not stop the
      // receipt or order that asked for the item
      try {
        const updated = await updateItem(existingItem.item_id, {
          name: desiredName,
          sku: data.lwin18,
          manufacturer: desiredManufacturer,
          brand: desiredBrand,
        });
        return { item: updated, created: false, updated: true };
      } catch (error) {
        console.warn('Zoho item tidy-up refused; using the item as it is', { itemId: existingItem.item_id, error });
        return { item: existingItem, created: false, updated: false };
      }
    }

    return { item: existingItem, created: false, updated: false };
  }

  // Create new item
  const newItem = await createWineItem(data);
  return { item: newItem, created: true, updated: false };
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
