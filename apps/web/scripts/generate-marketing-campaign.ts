/* eslint-disable turbo/no-undeclared-env-vars */
/**
 * Generate marketing email campaign from local stock
 *
 * Run with: DB_URL="..." pnpm exec tsx scripts/generate-marketing-campaign.ts
 */

import * as fs from 'fs';

import postgres from 'postgres';

const DB_URL = process.env.DB_URL || process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('DB_URL or DATABASE_URL environment variable required');
  process.exit(1);
}

interface LocalStockItem {
  id: string;
  name: string;
  producer: string | null;
  region: string | null;
  country: string | null;
  year: number | null;
  price: number;
  currency: string;
  unit_count: number;
  unit_size: string;
  available_quantity: number;
}

const formatPrice = (price: number) => `$${Math.round(price).toLocaleString()}`;

const formatCaseConfig = (unitCount: number, unitSize: string) => `${unitCount}x${unitSize}`;

const pricePerBottle = (price: number, unitCount: number) => Math.round(price / unitCount);

/**
 * Generate wine card HTML
 */
const generateWineCard = (item: LocalStockItem) => `
  <div class="wine-card">
    <div class="wine-region">${item.region || item.country || ''}</div>
    <div class="wine-name">${item.name}${item.year ? ` '${String(item.year).slice(-2)}` : ''}</div>
    <div class="wine-price">${formatPrice(item.price)}<span class="price-unit">/${item.unit_count}×${item.unit_size}</span></div>
  </div>`;

/**
 * Generate high-engagement B2B email using marketing best practices
 */
const generateEmail = (
  allItems: LocalStockItem[],
  highlights: LocalStockItem[],
  dateString: string
) => {
  const regionCount = new Set(allItems.map((i) => i.region || i.country)).size;
  const prices = allItems.map((i) => i.price).filter((p) => p > 0);
  const minPrice = Math.min(...prices);

  // Featured This Week - Top 4 premium wines from different regions
  const featuredWines = highlights.slice(0, 4);
  const featuredCards = featuredWines.map(generateWineCard).join('\n');

  // Best Value - Top 4 wines by price per bottle (lowest)
  const bestValue = [...allItems]
    .map((item) => ({
      ...item,
      perBottle: item.price / item.unit_count,
    }))
    .filter((item) => item.unit_count >= 6) // Only standard cases
    .sort((a, b) => a.perBottle - b.perBottle)
    .slice(0, 4);
  const bestValueCards = bestValue.map(generateWineCard).join('\n');

  // Trophy Wines - Premium wines over $2000/case
  const trophyWines = allItems
    .filter((item) => item.price >= 2000)
    .sort((a, b) => b.price - a.price)
    .slice(0, 4);
  const trophyCards = trophyWines.map(generateWineCard).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Craft & Culture - Trade Stock</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: transparent;
      color: #1a1a1a;
      line-height: 1.5;
    }

    .container {
      max-width: 600px;
      margin: 0 auto;
    }

    /* Dark Header */
    .header {
      background: #0f0f0f;
      padding: 20px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo-text {
      font-size: 16px;
      font-weight: 700;
      color: #fff;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .logo-sub {
      font-size: 10px;
      color: #666;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-top: 2px;
    }

    .header-date {
      font-size: 11px;
      color: #666;
      letter-spacing: 0.05em;
    }

    /* Hero */
    .hero {
      background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%);
      padding: 56px 32px 48px;
      text-align: center;
      color: #fff;
    }

    .hero-urgency {
      display: inline-block;
      background: #3D9A9A;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      padding: 8px 16px;
      margin-bottom: 24px;
    }

    .hero-headline {
      font-size: 36px;
      font-weight: 800;
      line-height: 1.15;
      margin-bottom: 16px;
      letter-spacing: -0.02em;
    }

    .hero-subhead {
      font-size: 16px;
      color: #888;
      max-width: 400px;
      margin: 0 auto 24px;
    }

    .hero-proof {
      font-size: 13px;
      color: #555;
      font-style: italic;
    }

    /* Value Props */
    .value-props {
      display: grid;
      grid-template-columns: 1fr 1fr;
      background: #3D9A9A;
    }

    .value-prop {
      padding: 28px 24px;
      text-align: center;
      color: #fff;
      border-right: 1px solid rgba(255,255,255,0.1);
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }

    .value-prop:nth-child(2),
    .value-prop:nth-child(4) {
      border-right: none;
    }

    .value-prop:nth-child(3),
    .value-prop:nth-child(4) {
      border-bottom: none;
    }

    .value-prop-title {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .value-prop-desc {
      font-size: 12px;
      opacity: 0.8;
    }

    /* Stats Highlight */
    .stats-highlight {
      background: #f8f8f8;
      padding: 32px;
      display: flex;
      justify-content: center;
      gap: 48px;
      border-bottom: 1px solid #eee;
    }

    .stat {
      text-align: center;
    }

    .stat-number {
      font-size: 42px;
      font-weight: 800;
      color: #1a1a1a;
      line-height: 1;
    }

    .stat-label {
      font-size: 12px;
      font-weight: 600;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-top: 8px;
    }

    /* Wine Grid */
    .wine-section {
      padding: 40px 32px;
    }

    .wine-section.alt {
      background: #f8f8f8;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 24px;
    }

    .section-title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #1a1a1a;
    }

    .section-hint {
      font-size: 12px;
      color: #888;
    }

    .wine-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .wine-card {
      background: #fff;
      border-left: 4px solid #3D9A9A;
      padding: 20px;
      display: flex;
      flex-direction: column;
      min-height: 140px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }

    .wine-region {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #3D9A9A;
      margin-bottom: 8px;
    }

    .wine-name {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: auto;
      line-height: 1.3;
      padding-bottom: 12px;
    }

    .wine-price {
      font-size: 22px;
      font-weight: 800;
      color: #1a1a1a;
    }

    .price-unit {
      font-size: 12px;
      font-weight: 500;
      color: #888;
    }

    /* CTA Section */
    .cta-section {
      padding: 48px 32px;
      text-align: center;
      background: #0f0f0f;
    }

    .cta-headline {
      font-size: 22px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 8px;
    }

    .cta-subtext {
      font-size: 14px;
      color: #666;
      margin-bottom: 28px;
    }

    .cta-buttons {
      display: flex;
      gap: 16px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .cta-button {
      display: inline-block;
      padding: 18px 32px;
      background: #3D9A9A;
      color: #ffffff;
      text-decoration: none;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      transition: background 0.2s;
    }

    .cta-button:hover {
      background: #2d7a7a;
    }

    .cta-button.secondary {
      background: transparent;
      border: 2px solid #3D9A9A;
      color: #3D9A9A;
    }

    .cta-button.secondary:hover {
      background: #3D9A9A;
      color: #fff;
    }

    .cta-guarantee {
      margin-top: 24px;
      font-size: 12px;
      color: #555;
    }

    /* Footer */
    .footer {
      padding: 24px 32px;
      text-align: center;
      background: #0f0f0f;
      border-top: 1px solid #222;
    }

    .footer-brand {
      font-size: 12px;
      font-weight: 700;
      color: #fff;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      opacity: 0.5;
      margin-bottom: 8px;
    }

    .footer-contact {
      font-size: 12px;
      color: #555;
    }

    .footer-contact a {
      color: #888;
      text-decoration: none;
    }

    /* Responsive */
    @media (max-width: 600px) {
      .header { padding: 16px 24px; }
      .hero { padding: 40px 24px; }
      .hero-headline { font-size: 28px; }
      .value-props { grid-template-columns: 1fr; }
      .value-prop { border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.1) !important; }
      .value-prop:last-child { border-bottom: none !important; }
      .stats-highlight { flex-direction: column; gap: 24px; }
      .wine-section { padding: 32px 24px; }
      .wine-grid { grid-template-columns: 1fr; }
      .cta-section { padding: 40px 24px; }
    }
  </style>
</head>
<body>
  <div class="container">

    <!-- Header -->
    <div class="header">
      <div>
        <div class="logo-text">Craft & Culture</div>
        <div class="logo-sub">Fine Wines</div>
      </div>
      <div class="header-date">${dateString}</div>
    </div>

    <!-- Hero -->
    <div class="hero">
      <div class="hero-urgency">Local Stock · Same-Day Picking</div>
      <div class="hero-headline">
        Unmatched range.<br/>Unmatched speed.
      </div>
      <div class="hero-subhead">
        ${allItems.length} wines from ${regionCount} regions — in stock and ready for collection in RAK.
      </div>
      <div class="hero-proof">Trusted by leading distributors across the GCC</div>
    </div>

    <!-- Value Props -->
    <div class="value-props">
      <div class="value-prop">
        <div class="value-prop-title">Unmatched Range</div>
        <div class="value-prop-desc">${regionCount} regions, one supplier</div>
      </div>
      <div class="value-prop">
        <div class="value-prop-title">Local Stock</div>
        <div class="value-prop-desc">In-warehouse RAK, UAE</div>
      </div>
      <div class="value-prop">
        <div class="value-prop-title">Same-Day Picking</div>
        <div class="value-prop-desc">Order today, collect today</div>
      </div>
      <div class="value-prop">
        <div class="value-prop-title">Unmatched Speed</div>
        <div class="value-prop-desc">No waiting, no delays</div>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-highlight">
      <div class="stat">
        <div class="stat-number">${allItems.length}</div>
        <div class="stat-label">Wines In Stock</div>
      </div>
      <div class="stat">
        <div class="stat-number">${regionCount}</div>
        <div class="stat-label">Wine Regions</div>
      </div>
      <div class="stat">
        <div class="stat-number">${formatPrice(minPrice)}</div>
        <div class="stat-label">Starting From</div>
      </div>
    </div>

    <!-- Featured This Week -->
    <div class="wine-section">
      <div class="section-header">
        <div class="section-title">Featured This Week</div>
        <div class="section-hint">Price per case</div>
      </div>
      <div class="wine-grid">
        ${featuredCards}
      </div>
    </div>

    <!-- Best Value -->
    <div class="wine-section alt">
      <div class="section-header">
        <div class="section-title">Best Value</div>
        <div class="section-hint">Great wines, great prices</div>
      </div>
      <div class="wine-grid">
        ${bestValueCards}
      </div>
    </div>

    <!-- Trophy Wines -->
    <div class="wine-section">
      <div class="section-header">
        <div class="section-title">Trophy Wines</div>
        <div class="section-hint">For special occasions</div>
      </div>
      <div class="wine-grid">
        ${trophyCards}
      </div>
    </div>

    <!-- CTA -->
    <div class="cta-section">
      <div class="cta-headline">Ready to see the full list?</div>
      <div class="cta-subtext">${allItems.length} wines available · Updated ${dateString}</div>
      <div class="cta-buttons">
        <a href="https://wine.craftculture.xyz/local-stock?utm_source=email&utm_medium=campaign&utm_campaign=trade_stock_${dateString.toLowerCase().replace(' ', '_')}&utm_content=digital_catalogue" class="cta-button">Access Digital Catalogue</a>
        <a href="mailto:orders@craftculture.xyz?subject=Excel Inventory Request - ${dateString}&utm_source=email&utm_medium=campaign&utm_campaign=trade_stock_${dateString.toLowerCase().replace(' ', '_')}&utm_content=excel_download" class="cta-button secondary">Download Excel Inventory</a>
      </div>
      <div class="cta-guarantee">Questions? Email orders@craftculture.xyz</div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-brand">Craft & Culture</div>
      <div class="footer-contact">
        <a href="mailto:orders@craftculture.xyz">orders@craftculture.xyz</a> · RAK, UAE
      </div>
    </div>

  </div>
</body>
</html>`;
};

const generateMarketingCampaign = async () => {
  console.log('Connecting to database...');
  const sql = postgres(DB_URL!, { prepare: false });

  console.log('Querying local stock...');

  const results = await sql<LocalStockItem[]>`
    SELECT
      p.id,
      p.name,
      p.producer,
      p.region,
      p.country,
      p.year,
      po.price,
      po.currency,
      po.unit_count,
      po.unit_size,
      po.available_quantity
    FROM products p
    INNER JOIN product_offers po ON p.id = po.product_id
    WHERE po.source = 'local_inventory'
      AND po.available_quantity > 0
    ORDER BY po.price DESC
  `;

  console.log(`Found ${results.length} items in local stock`);

  if (results.length === 0) {
    console.log('No local stock found. Exiting.');
    await sql.end();
    return;
  }

  // Pick highlights - top wine per region (by price)
  const byRegion = new Map<string, LocalStockItem>();
  results.forEach((item) => {
    const region = item.region || item.country || 'Other';
    if (!byRegion.has(region)) {
      byRegion.set(region, item);
    }
  });

  const highlights = [...byRegion.values()].sort((a, b) => b.price - a.price);

  const now = new Date();
  const dateString = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const html = generateEmail(results, highlights, dateString);

  const outputPath = `/Users/kevinbradford/Desktop/marketing-campaign-${now.toISOString().split('T')[0]}.html`;
  fs.writeFileSync(outputPath, html);

  console.log(`\nMarketing campaign generated!`);
  console.log(`  Output: ${outputPath}`);

  await sql.end();
};

generateMarketingCampaign().catch(console.error);
