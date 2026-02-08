/* eslint-disable */
/**
 * Analyze Zoho Items against LWIN Database
 *
 * This script:
 * 1. Fetches all items from Zoho Books
 * 2. Categorizes by type (wine with LWIN SKU, wine without, spirits, other)
 * 3. Validates LWIN SKUs against lwin_wines table
 * 4. Identifies duplicates
 * 5. Outputs a comprehensive report
 *
 * Run: npx tsx scripts/analyze-zoho-items.ts
 */

// Load env FIRST before any other imports
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Now import modules that depend on env vars
import postgres from 'postgres';

// Direct Zoho API fetch (bypasses serverConfig module caching issues)
// Trim all values to remove newlines/whitespace from Vercel env vars
const ZOHO_CONFIG = {
  clientId: process.env.ZOHO_CLIENT_ID?.trim().replace(/["\n]/g, ''),
  clientSecret: process.env.ZOHO_CLIENT_SECRET?.trim().replace(/["\n]/g, ''),
  refreshToken: process.env.ZOHO_REFRESH_TOKEN?.trim().replace(/["\n]/g, ''),
  organizationId: process.env.ZOHO_ORGANIZATION_ID?.trim().replace(/["\n]/g, ''),
  region: (process.env.ZOHO_REGION?.trim().replace(/["\n]/g, '') || 'us') as string,
};

const getZohoUrls = () => {
  const region = ZOHO_CONFIG.region;
  const domains: Record<string, { accounts: string; api: string }> = {
    us: { accounts: 'https://accounts.zoho.com', api: 'https://www.zohoapis.com/books/v3' },
    eu: { accounts: 'https://accounts.zoho.eu', api: 'https://www.zohoapis.eu/books/v3' },
    in: { accounts: 'https://accounts.zoho.in', api: 'https://www.zohoapis.in/books/v3' },
    au: { accounts: 'https://accounts.zoho.com.au', api: 'https://www.zohoapis.com.au/books/v3' },
  };
  return domains[region] || domains.us;
};

let accessToken: string | null = null;

const getAccessToken = async () => {
  if (accessToken) return accessToken;

  const { accounts } = getZohoUrls();
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: ZOHO_CONFIG.clientId!,
    client_secret: ZOHO_CONFIG.clientSecret!,
    refresh_token: ZOHO_CONFIG.refreshToken!,
  });

  const response = await fetch(`${accounts}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${await response.text()}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  return accessToken;
};

const zohoFetch = async <T>(endpoint: string): Promise<T> => {
  const token = await getAccessToken();
  const { api } = getZohoUrls();
  const url = new URL(`${api}${endpoint}`);
  url.searchParams.set('organization_id', ZOHO_CONFIG.organizationId!);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Zoho API error: ${response.status} - ${await response.text()}`);
  }

  return response.json();
};

interface ZohoItem {
  item_id: string;
  name: string;
  sku: string;
  status: string;
  rate: number;
  stock_on_hand?: number;
  item_type: string;
}

const getAllItems = async (): Promise<ZohoItem[]> => {
  const allItems: ZohoItem[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await zohoFetch<{
      items: ZohoItem[];
      page_context: { has_more_page: boolean };
    }>(`/items?page=${page}&per_page=200`);

    allItems.push(...response.items);
    hasMore = response.page_context.has_more_page;
    page++;

    if (page > 100) break; // Safety limit
  }

  return allItems;
};

const client = postgres(process.env.DB_URL || '', { prepare: false });

// LWIN18 format: 7-digit LWIN + 4-digit vintage + 2-digit case + 5-digit bottle
// Example: 1013573-2020-06-00750 = 101357320200600750 (18 chars without dashes)
const LWIN_SKU_PATTERN = /^\d{18}$/;

// Parse LWIN18 from compact SKU
const parseLwinSku = (sku: string) => {
  if (!LWIN_SKU_PATTERN.test(sku)) return null;

  const lwin7 = sku.slice(0, 7);
  const vintage = sku.slice(7, 11);
  const caseSize = sku.slice(11, 13);
  const bottleSize = sku.slice(13, 18);

  return {
    lwin7,
    vintage,
    caseSize,
    bottleSize,
    lwin18: `${lwin7}-${vintage}-${caseSize}-${bottleSize}`,
  };
};

// Categorize SKU prefix
const getCategory = (sku: string | undefined) => {
  if (!sku) return 'NO_SKU';
  if (LWIN_SKU_PATTERN.test(sku)) return 'WINE_LWIN';

  const prefix = sku.split('-')[0]?.toUpperCase();
  const categories: Record<string, string> = {
    TEQ: 'SPIRITS_TEQUILA',
    GIN: 'SPIRITS_GIN',
    WKY: 'SPIRITS_WHISKY',
    RUM: 'SPIRITS_RUM',
    VOD: 'SPIRITS_VODKA',
    BOR: 'SPIRITS_OTHER',
    SOT: 'SPIRITS_OTHER',
    RTD: 'RTD',
    WIN: 'WINE_CUSTOM',
  };

  return categories[prefix] || 'OTHER';
};

async function main() {
  console.log('=== ZOHO ITEMS ANALYSIS ===\n');

  // Check credentials
  if (!ZOHO_CONFIG.clientId || !ZOHO_CONFIG.clientSecret || !ZOHO_CONFIG.refreshToken || !ZOHO_CONFIG.organizationId) {
    console.error('Zoho credentials not configured in .env.local:');
    console.log('  ZOHO_CLIENT_ID:', ZOHO_CONFIG.clientId ? '✅' : '❌ missing');
    console.log('  ZOHO_CLIENT_SECRET:', ZOHO_CONFIG.clientSecret ? '✅' : '❌ missing');
    console.log('  ZOHO_REFRESH_TOKEN:', ZOHO_CONFIG.refreshToken ? '✅' : '❌ missing');
    console.log('  ZOHO_ORGANIZATION_ID:', ZOHO_CONFIG.organizationId ? '✅' : '❌ missing');
    console.log('  ZOHO_REGION:', ZOHO_CONFIG.region);
    await client.end();
    process.exit(1);
  }

  console.log('Fetching items from Zoho...');

  let items: ZohoItem[];
  try {
    items = await getAllItems();
    console.log(`Fetched ${items.length} items from Zoho\n`);
  } catch (error) {
    console.error('Failed to fetch Zoho items:', error);
    await client.end();
    process.exit(1);
  }

  // Categorize items
  const categorized: Record<string, ZohoItem[]> = {};
  const lwinItems: Array<{ item: ZohoItem; parsed: ReturnType<typeof parseLwinSku> }> = [];

  for (const item of items) {
    const category = getCategory(item.sku);
    if (!categorized[category]) categorized[category] = [];
    categorized[category].push(item);

    if (category === 'WINE_LWIN') {
      lwinItems.push({ item, parsed: parseLwinSku(item.sku) });
    }
  }

  // Print category summary
  console.log('=== CATEGORY BREAKDOWN ===');
  const sortedCategories = Object.entries(categorized).sort((a, b) => b[1].length - a[1].length);
  for (const [category, items] of sortedCategories) {
    console.log(`${category}: ${items.length} items`);
  }
  console.log('');

  // Validate LWIN items against database
  console.log('=== LWIN VALIDATION ===');
  console.log(`Validating ${lwinItems.length} items with LWIN-style SKUs...\n`);

  const validLwins: typeof lwinItems = [];
  const invalidLwins: typeof lwinItems = [];

  for (const { item, parsed } of lwinItems) {
    if (!parsed) continue;

    const [match] = await client`
      SELECT lwin, display_name FROM lwin_wines WHERE lwin = ${parsed.lwin7}
    `;

    if (match) {
      validLwins.push({ item, parsed });
    } else {
      invalidLwins.push({ item, parsed });
    }
  }

  console.log(`✅ Valid LWINs: ${validLwins.length}`);
  console.log(`❌ Invalid LWINs: ${invalidLwins.length}`);
  console.log('');

  // Show invalid LWINs
  if (invalidLwins.length > 0) {
    console.log('=== INVALID LWIN SKUs (not in Liv-ex database) ===');
    for (const { item, parsed } of invalidLwins.slice(0, 20)) {
      console.log(`SKU: ${item.sku} | LWIN7: ${parsed?.lwin7} | Name: ${item.name}`);
    }
    if (invalidLwins.length > 20) {
      console.log(`... and ${invalidLwins.length - 20} more`);
    }
    console.log('');
  }

  // Check for duplicates (same name or same SKU)
  console.log('=== DUPLICATE CHECK ===');
  const skuCounts: Record<string, ZohoItem[]> = {};
  const nameCounts: Record<string, ZohoItem[]> = {};

  for (const item of items) {
    if (item.sku) {
      if (!skuCounts[item.sku]) skuCounts[item.sku] = [];
      skuCounts[item.sku].push(item);
    }
    const normalizedName = item.name.toLowerCase().trim();
    if (!nameCounts[normalizedName]) nameCounts[normalizedName] = [];
    nameCounts[normalizedName].push(item);
  }

  const duplicateSkus = Object.entries(skuCounts).filter(([, items]) => items.length > 1);
  const duplicateNames = Object.entries(nameCounts).filter(([, items]) => items.length > 1);

  console.log(`Duplicate SKUs: ${duplicateSkus.length}`);
  console.log(`Duplicate Names: ${duplicateNames.length}`);

  if (duplicateSkus.length > 0) {
    console.log('\nDuplicate SKUs:');
    for (const [sku, items] of duplicateSkus.slice(0, 10)) {
      console.log(`  ${sku}: ${items.length} items`);
      for (const item of items) {
        console.log(`    - ${item.name} (ID: ${item.item_id})`);
      }
    }
    if (duplicateSkus.length > 10) {
      console.log(`  ... and ${duplicateSkus.length - 10} more`);
    }
  }

  console.log('');

  // Show sample of valid wine items
  console.log('=== SAMPLE VALID WINE ITEMS ===');
  for (const { item, parsed } of validLwins.slice(0, 10)) {
    const [match] = await client`
      SELECT display_name FROM lwin_wines WHERE lwin = ${parsed?.lwin7}
    `;
    console.log(`Zoho: ${item.name}`);
    console.log(`  SKU: ${item.sku} → LWIN18: ${parsed?.lwin18}`);
    console.log(`  Liv-ex: ${match?.display_name || 'N/A'}`);
    console.log(`  Stock: ${item.stock_on_hand || 0}`);
    console.log('');
  }

  // Summary
  console.log('=== SUMMARY ===');
  console.log(`Total Zoho Items: ${items.length}`);
  console.log(`Wine (LWIN SKU): ${categorized['WINE_LWIN']?.length || 0}`);
  console.log(`  - Valid LWINs: ${validLwins.length}`);
  console.log(`  - Invalid LWINs: ${invalidLwins.length}`);
  console.log(`Wine (Custom SKU): ${categorized['WINE_CUSTOM']?.length || 0}`);
  console.log(`Spirits: ${Object.entries(categorized).filter(([k]) => k.startsWith('SPIRITS')).reduce((sum, [, v]) => sum + v.length, 0)}`);
  console.log(`RTD: ${categorized['RTD']?.length || 0}`);
  console.log(`Other: ${categorized['OTHER']?.length || 0}`);
  console.log(`No SKU: ${categorized['NO_SKU']?.length || 0}`);

  await client.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
