# SOURCE Tool - Implementation Plan

> **Purpose**: Comprehensive implementation guide for AI agents. Feed this to Claude Code for implementation.
> **Created**: January 2025
> **Status**: Ready for Implementation

---

## Overview

This plan covers the complete enhancement of the SOURCE RFQ tool, including:
1. AI-powered LWIN matching during parsing
2. Partner output enrichment with LWIN details
3. Post-selection workflow (PO generation, supplier confirmation)
4. Self-sourcing workflow for unfulfilled items
5. Multi-supplier price comparison features

---

## Priority Order

| Sprint | Feature | Complexity | Business Value |
|--------|---------|------------|----------------|
| 1 | Post-Selection Workflow | Medium | Critical - Currently frozen |
| 2 | Multi-Supplier Price Comparison | Medium | High |
| 3 | AI LWIN Matching Enhancement | High | High |
| 4 | Partner Output Enrichment | Low | Medium |
| 5 | Self-Sourcing Workflow | Medium | Medium |

---

## Sprint 1: Post-Selection Workflow

### Problem
RFQ flow currently stops at "Selecting" status with no next steps. Need complete workflow to finalize, generate POs, and track delivery.

### Database Schema Changes

Add to `apps/web/src/database/schema.ts`:

```typescript
// Purchase Orders - one per partner with selected quotes
export const sourcePurchaseOrders = pgTable('source_purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqId: uuid('rfq_id').references(() => sourceRfqs.id, { onDelete: 'cascade' }).notNull(),
  partnerId: uuid('partner_id').references(() => partners.id).notNull(),
  poNumber: text('po_number').notNull().unique(),
  status: text('status').notNull().default('draft'), // draft, sent, confirmed, shipped, delivered, cancelled
  totalAmountUsd: decimal('total_amount_usd', { precision: 12, scale: 2 }),
  deliveryDate: date('delivery_date'),
  deliveryAddress: text('delivery_address'),
  deliveryInstructions: text('delivery_instructions'),
  paymentTerms: text('payment_terms'),
  notes: text('notes'),
  pdfUrl: text('pdf_url'),
  sentAt: timestamp('sent_at', { mode: 'date' }),
  confirmedAt: timestamp('confirmed_at', { mode: 'date' }),
  shippedAt: timestamp('shipped_at', { mode: 'date' }),
  deliveredAt: timestamp('delivered_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
});

export const sourcePurchaseOrderItems = pgTable('source_purchase_order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  poId: uuid('po_id').references(() => sourcePurchaseOrders.id, { onDelete: 'cascade' }).notNull(),
  rfqItemId: uuid('rfq_item_id').references(() => sourceRfqItems.id).notNull(),
  quoteId: uuid('quote_id').references(() => sourceRfqQuotes.id).notNull(),
  productName: text('product_name').notNull(),
  lwin: text('lwin'),
  quantity: integer('quantity').notNull(),
  unitType: text('unit_type'), // case, bottle
  unitPriceUsd: decimal('unit_price_usd', { precision: 10, scale: 2 }),
  lineTotalUsd: decimal('line_total_usd', { precision: 12, scale: 2 }),
});
```

### New Controllers

Create these files in `apps/web/src/app/_source/controller/`:

#### 1. `adminFinalizeRfq.ts`
```typescript
/**
 * Finalize RFQ selections and prepare for PO generation
 *
 * - Validates all required items have selections
 * - Updates RFQ status to 'finalized'
 * - Returns summary of selections by partner
 */
const adminFinalizeRfq = adminProcedure
  .input(z.object({ rfqId: z.string().uuid() }))
  .mutation(async ({ input }) => {
    // 1. Get all items and their selections
    // 2. Check if any required items are unselected
    // 3. Group selections by partner
    // 4. Update RFQ status to 'finalized'
    // 5. Return partner groupings for PO preview
  });
```

#### 2. `adminGeneratePurchaseOrders.ts`
```typescript
/**
 * Generate Purchase Orders from finalized RFQ
 *
 * Creates one PO per partner with their selected quotes
 * Generates unique PO numbers (format: PO-YYYY-NNNN)
 */
const adminGeneratePurchaseOrders = adminProcedure
  .input(z.object({
    rfqId: z.string().uuid(),
    deliveryDate: z.string().optional(),
    deliveryAddress: z.string().optional(),
    notes: z.string().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    // 1. Get finalized RFQ with all selections
    // 2. Group items by partner
    // 3. For each partner with selections:
    //    - Generate PO number
    //    - Create PO record
    //    - Create PO item records
    //    - Calculate totals
    // 4. Update RFQ status to 'po_generated'
    // 5. Return created POs
  });
```

#### 3. `adminSendPurchaseOrder.ts`
```typescript
/**
 * Send Purchase Order to partner via email
 *
 * - Generates PDF
 * - Sends email with PDF attachment
 * - Updates PO status to 'sent'
 */
const adminSendPurchaseOrder = adminProcedure
  .input(z.object({
    poId: z.string().uuid(),
    contactIds: z.array(z.string().uuid()).optional(),
    message: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    // 1. Get PO with items
    // 2. Generate PDF using existing PDF generation pattern
    // 3. Get partner contacts (or use provided contactIds)
    // 4. Send email with PDF
    // 5. Update PO sentAt and status
  });
```

#### 4. `adminGetPurchaseOrders.ts`
```typescript
/**
 * Get all Purchase Orders for an RFQ
 */
const adminGetPurchaseOrders = adminProcedure
  .input(z.object({ rfqId: z.string().uuid() }))
  .query(async ({ input }) => {
    // Return all POs with items, partner info, and status
  });
```

#### 5. `partnerConfirmPurchaseOrder.ts`
```typescript
/**
 * Partner confirms receipt of Purchase Order
 *
 * - Updates PO status to 'confirmed'
 * - Records confirmation timestamp
 * - Optionally accepts estimated delivery date
 */
const partnerConfirmPurchaseOrder = partnerProcedure
  .input(z.object({
    poId: z.string().uuid(),
    estimatedDeliveryDate: z.string().optional(),
    notes: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    // 1. Verify partner owns this PO
    // 2. Update status to 'confirmed'
    // 3. Record confirmedAt
    // 4. Log activity
  });
```

#### 6. `partnerUpdateDeliveryStatus.ts`
```typescript
/**
 * Partner updates delivery status
 */
const partnerUpdateDeliveryStatus = partnerProcedure
  .input(z.object({
    poId: z.string().uuid(),
    status: z.enum(['shipped', 'delivered']),
    trackingNumber: z.string().optional(),
    notes: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    // Update shipping/delivery status
  });
```

### Router Updates

Update `apps/web/src/app/_source/router.ts`:

```typescript
import adminFinalizeRfq from './controller/adminFinalizeRfq';
import adminGeneratePurchaseOrders from './controller/adminGeneratePurchaseOrders';
import adminSendPurchaseOrder from './controller/adminSendPurchaseOrder';
import adminGetPurchaseOrders from './controller/adminGetPurchaseOrders';
import partnerConfirmPurchaseOrder from './controller/partnerConfirmPurchaseOrder';
import partnerUpdateDeliveryStatus from './controller/partnerUpdateDeliveryStatus';

const adminRouter = createTRPCRouter({
  // ... existing routes
  finalize: adminFinalizeRfq,
  generatePurchaseOrders: adminGeneratePurchaseOrders,
  sendPurchaseOrder: adminSendPurchaseOrder,
  getPurchaseOrders: adminGetPurchaseOrders,
});

const partnerRouter = createTRPCRouter({
  // ... existing routes
  confirmPurchaseOrder: partnerConfirmPurchaseOrder,
  updateDeliveryStatus: partnerUpdateDeliveryStatus,
});
```

### UI Components

Create in `apps/web/src/app/_source/components/`:

#### 1. `PurchaseOrderSection.tsx`
```typescript
/**
 * Section on RFQ detail page showing PO status
 *
 * States:
 * - Pre-finalization: "Finalize Selections" button
 * - Post-finalization: List of POs with status badges
 * - PO detail: Expandable with items and actions
 */
```

#### 2. `PurchaseOrderCard.tsx`
```typescript
/**
 * Individual PO card showing:
 * - Partner name
 * - PO number
 * - Status badge (draft/sent/confirmed/shipped/delivered)
 * - Total value
 * - Actions: View PDF, Send, Mark Delivered
 */
```

#### 3. `PurchaseOrderPDFTemplate.tsx`
```typescript
/**
 * PDF template for PO generation
 * Include:
 * - C&C header/logo
 * - PO number and date
 * - Partner details
 * - Delivery information
 * - Item table with LWIN, quantity, price
 * - Total
 * - Terms and signature line
 */
```

### RFQ Status Flow Update

Update RFQ status enum in schema:
```typescript
status: text('status').notNull().default('draft'),
// Values: draft, sent, collecting, comparing, selecting, finalized, po_generated, completed, cancelled
```

---

## Sprint 2: Multi-Supplier Price Comparison

### Problem
Currently no way to easily compare prices across suppliers for the same items.

### Database Schema Changes

```typescript
// Store historical quote data for market intelligence
export const sourceMarketPrices = pgTable('source_market_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  lwin: text('lwin').notNull(),
  avgPriceUsd: decimal('avg_price_usd', { precision: 10, scale: 2 }),
  minPriceUsd: decimal('min_price_usd', { precision: 10, scale: 2 }),
  maxPriceUsd: decimal('max_price_usd', { precision: 10, scale: 2 }),
  quoteCount: integer('quote_count').default(0),
  lastUpdated: timestamp('last_updated', { mode: 'date' }).defaultNow(),
});

// Partner performance metrics
export const sourcePartnerMetrics = pgTable('source_partner_metrics', {
  partnerId: uuid('partner_id').primaryKey().references(() => partners.id),
  totalRfqsReceived: integer('total_rfqs_received').default(0),
  totalRfqsResponded: integer('total_rfqs_responded').default(0),
  avgResponseTimeHours: decimal('avg_response_time_hours', { precision: 8, scale: 2 }),
  totalQuotesSubmitted: integer('total_quotes_submitted').default(0),
  totalQuotesWon: integer('total_quotes_won').default(0),
  totalValueWonUsd: decimal('total_value_won_usd', { precision: 14, scale: 2 }),
  bestPriceRate: decimal('best_price_rate', { precision: 5, scale: 2 }), // % of time they had best price
  lastUpdated: timestamp('last_updated', { mode: 'date' }).defaultNow(),
});
```

### New Controllers

#### 1. `adminGetPriceComparison.ts`
```typescript
/**
 * Get price comparison matrix for RFQ items
 *
 * Returns:
 * - Items as rows
 * - Partners as columns
 * - Prices with color coding (best/worst)
 * - Market reference prices
 * - Partner scorecards
 */
const adminGetPriceComparison = adminProcedure
  .input(z.object({ rfqId: z.string().uuid() }))
  .query(async ({ input }) => {
    // 1. Get all items with their quotes
    // 2. Get market prices for LWINs
    // 3. Get partner metrics
    // 4. Build comparison matrix
    // 5. Calculate savings potential
  });
```

#### 2. `adminGetPartnerMetrics.ts`
```typescript
/**
 * Get performance metrics for partners
 */
const adminGetPartnerMetrics = adminProcedure
  .input(z.object({
    partnerIds: z.array(z.string().uuid()).optional(),
  }))
  .query(async ({ input }) => {
    // Return metrics for specified partners or all
  });
```

#### 3. `updateMarketPrices.ts` (utility function)
```typescript
/**
 * Update market prices from quote history
 * Call this after quote selection
 */
const updateMarketPrices = async (quoteIds: string[]) => {
  // 1. Get quotes with LWIN
  // 2. Calculate new averages per LWIN
  // 3. Upsert market prices
};
```

### UI Components

#### 1. `PriceComparisonTable.tsx`
```typescript
/**
 * Matrix view of prices across suppliers
 *
 * Features:
 * - Items as rows, partners as columns
 * - Color coding: green (best), red (highest), yellow (market outlier)
 * - Sticky headers for scrolling
 * - Click to select quote
 * - Bulk selection shortcuts
 * - Savings summary row
 */
interface PriceComparisonTableProps {
  rfqId: string;
  onQuoteSelect: (itemId: string, quoteId: string) => void;
}
```

#### 2. `PartnerScorecard.tsx`
```typescript
/**
 * Partner performance card
 *
 * Shows:
 * - Response rate %
 * - Avg response time
 * - Win rate %
 * - Best price rate %
 * - Total value won
 * - Trend indicators
 */
```

#### 3. `MarketPriceIndicator.tsx`
```typescript
/**
 * Shows market reference price with visual indicator
 *
 * - Display avg/min/max
 * - Show if quote is above/below market
 * - Percentage difference
 */
```

#### 4. `SavingsAnalysis.tsx`
```typescript
/**
 * Summary of savings from current selections
 *
 * - Total savings vs highest prices
 * - Savings by partner
 * - % below market average
 */
```

---

## Sprint 3: AI LWIN Matching Enhancement

### Problem
Current trigram matching has ~40% accuracy. Need semantic matching for better wine identification.

### Database Schema Changes

```typescript
// Requires pgvector extension
// Run: CREATE EXTENSION IF NOT EXISTS vector;

// Add embedding column to LWIN wines table
// ALTER TABLE lwin_wines ADD COLUMN embedding vector(1536);
// CREATE INDEX ON lwin_wines USING ivfflat (embedding vector_cosine_ops);

// Wine synonyms for matching
export const wineSynonyms = pgTable('wine_synonyms', {
  id: uuid('id').primaryKey().defaultRandom(),
  canonical: text('canonical').notNull(), // e.g., "Domaine de la Romanée-Conti"
  synonym: text('synonym').notNull(), // e.g., "DRC"
  type: text('type').notNull(), // producer, grape, region
});
```

### New Utilities

#### 1. `apps/web/src/app/_source/utils/wineEmbeddings.ts`
```typescript
import { openai } from '@ai-sdk/openai';

/**
 * Generate embedding for wine text
 */
const getWineEmbedding = async (text: string) => {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
};

/**
 * Search LWIN wines by embedding similarity
 */
const searchWinesByEmbedding = async (embedding: number[], limit = 5) => {
  // Use pgvector similarity search
  // SELECT * FROM lwin_wines
  // ORDER BY embedding <=> $1
  // LIMIT $2
};

export { getWineEmbedding, searchWinesByEmbedding };
```

#### 2. `apps/web/src/app/_source/utils/enhancedLwinMatcher.ts`
```typescript
/**
 * Enhanced LWIN matching with multiple signals
 */
const matchLwinWine = async (item: {
  productName: string;
  producer?: string;
  vintage?: string;
}) => {
  // 1. Check if AI parsing provided LWIN guess
  // 2. Try exact LWIN lookup
  // 3. Try embedding-based semantic search
  // 4. Fall back to trigram similarity
  // 5. Apply synonym expansion (DRC -> Domaine de la Romanée-Conti)
  // 6. Score and rank all candidates
  // 7. Return best match with confidence score
};
```

#### 3. `apps/web/src/app/_source/utils/wineSynonyms.ts`
```typescript
/**
 * Common wine synonyms and aliases
 */
const PRODUCER_SYNONYMS = {
  'DRC': 'Domaine de la Romanée-Conti',
  'DP': 'Dom Pérignon',
  'Ch.': 'Château',
  // ... more
};

const GRAPE_SYNONYMS = {
  'Shiraz': 'Syrah',
  'Pinot Grigio': 'Pinot Gris',
  // ... more
};

/**
 * Expand synonyms in wine name
 */
const expandSynonyms = (name: string) => {
  // Replace abbreviations with full names
};
```

### Controller Updates

#### Update `adminParseInput.ts`

```typescript
const systemPrompt = `You are an expert at extracting wine product information.
For each wine, provide:
1. Product name (cleaned, standardized)
2. Producer (if identifiable)
3. Vintage (4-digit year or "NV")
4. Quantity and unit type
5. LWIN code if you recognize the wine

Common LWINs:
- Opus One: 1014033
- Château Margaux: 1000214
- DRC La Tâche: 1002456
- Dom Pérignon: 1005521
...

If unsure about LWIN, set confidence to low.`;

// After AI parsing, run enhanced LWIN matcher
const enhancedItems = await Promise.all(
  parsedItems.map(async (item) => {
    const lwinMatch = await matchLwinWine(item);
    return {
      ...item,
      lwin: lwinMatch?.lwin,
      lwinConfidence: lwinMatch?.confidence,
      lwinDisplayName: lwinMatch?.displayName,
    };
  })
);
```

### Migration Script

```typescript
/**
 * Generate embeddings for top wines
 * Run as one-time migration
 */
const generateWineEmbeddings = async () => {
  // 1. Get top 50k wines by popularity
  // 2. Generate embedding for each: `${producer} ${name} ${region}`
  // 3. Store in embedding column
  // Batch process to respect rate limits
};
```

---

## Sprint 4: Partner Output Enrichment

### Problem
Partners receive basic RFQ without LWIN codes or market context.

### Changes to Partner Output

#### Update `partnerGetOneRfq.ts`

Return additional fields for each item:
```typescript
items: [
  {
    id: 'uuid',
    productName: 'Opus One 2019',
    quantity: 6,
    unitType: 'case',

    // NEW: LWIN details
    lwin: '1014033',
    lwinConfidence: 0.95,
    lwinProducer: 'Opus One Winery',
    lwinRegion: 'Napa Valley',

    // NEW: Market context
    marketPriceAvgUsd: 550,
    marketPriceRange: { min: 520, max: 580 },

    // NEW: Partner history
    partnerLastQuote: 540,
    partnerWinRate: 0.67, // 67% of their quotes for this wine won
  }
]
```

#### Update Partner RFQ Email Template

```
┌────────────────────────────────────────────────────────────────┐
│ RFQ SRC-2026-0025 - Wine List for Dubai Distributor            │
├────────────────────────────────────────────────────────────────┤
│ ITEM          LWIN       QTY    UNIT    MARKET    YOUR LAST   │
├────────────────────────────────────────────────────────────────┤
│ Opus One 2019 1014033    6      cs/12   $550/cs   $540 (won)  │
│ DRC 2018      1012345    2      cs/6    $8,500    $8,200      │
│ Margaux 2015  1005678    12     cs/12   $320/cs   —           │
└────────────────────────────────────────────────────────────────┘
```

#### Update PDF Export for Partners

Include:
- LWIN column
- Market price column
- Partner's last quote (if available)
- Clear case/bottle configuration

---

## Sprint 5: Self-Sourcing Workflow

### Problem
Some items may not be available from any partner. C&C needs ability to self-source.

### Database Schema Changes

```typescript
// Track self-sourcing attempts
export const sourceSelfSourcing = pgTable('source_self_sourcing', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqItemId: uuid('rfq_item_id').references(() => sourceRfqItems.id).notNull(),
  source: text('source').notNull(), // 'inventory', 'exchange', 'direct'
  sourceDetails: text('source_details'), // e.g., "Liv-ex", "Direct from producer"
  costPriceUsd: decimal('cost_price_usd', { precision: 10, scale: 2 }),
  quantity: integer('quantity'),
  status: text('status').notNull().default('pending'), // pending, available, ordered, received
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
});
```

### New Controllers

#### 1. `adminGetUnsourcedItems.ts`
```typescript
/**
 * Get items that have no valid quotes
 */
const adminGetUnsourcedItems = adminProcedure
  .input(z.object({ rfqId: z.string().uuid() }))
  .query(async ({ input }) => {
    // Return items where:
    // - No quotes OR all quotes are 'not_available'
    // - Not already self-sourced
  });
```

#### 2. `adminCreateSelfSource.ts`
```typescript
/**
 * Record self-sourcing for an item
 */
const adminCreateSelfSource = adminProcedure
  .input(z.object({
    rfqItemId: z.string().uuid(),
    source: z.enum(['inventory', 'exchange', 'direct']),
    sourceDetails: z.string().optional(),
    costPriceUsd: z.number().positive(),
    quantity: z.number().int().positive(),
    notes: z.string().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    // 1. Create self-sourcing record
    // 2. Update item status to 'self_sourced'
    // 3. Log activity
  });
```

#### 3. `adminReRfqItems.ts`
```typescript
/**
 * Create new RFQ from unsourced items
 * Optionally with expanded partner list
 */
const adminReRfqItems = adminProcedure
  .input(z.object({
    rfqItemIds: z.array(z.string().uuid()),
    partnerIds: z.array(z.string().uuid()),
    deadline: z.string().datetime().optional(),
  }))
  .mutation(async ({ input }) => {
    // 1. Create new RFQ with selected items
    // 2. Clone item details
    // 3. Assign new partners
    // 4. Return new RFQ ID
  });
```

### UI Components

#### 1. `UnsourcedItemsPanel.tsx`
```typescript
/**
 * Panel showing items needing self-sourcing
 *
 * Actions:
 * - Re-RFQ to more partners
 * - Source from inventory
 * - Source from exchange (Liv-ex)
 * - Mark as unsourceable
 */
```

#### 2. `SelfSourceModal.tsx`
```typescript
/**
 * Modal for recording self-sourcing
 *
 * Fields:
 * - Source type dropdown
 * - Source details
 * - Cost price
 * - Quantity
 * - Notes
 */
```

### RFQ Item Status Update

Add new statuses:
```typescript
status: text('status').notNull().default('pending'),
// Values: pending, quoted, selected, self_sourced, unsourceable
```

---

## File Structure Summary

### New Files to Create

```
apps/web/src/app/_source/
├── controller/
│   ├── adminFinalizeRfq.ts
│   ├── adminGeneratePurchaseOrders.ts
│   ├── adminSendPurchaseOrder.ts
│   ├── adminGetPurchaseOrders.ts
│   ├── adminGetPriceComparison.ts
│   ├── adminGetPartnerMetrics.ts
│   ├── adminGetUnsourcedItems.ts
│   ├── adminCreateSelfSource.ts
│   ├── adminReRfqItems.ts
│   ├── partnerConfirmPurchaseOrder.ts
│   └── partnerUpdateDeliveryStatus.ts
├── components/
│   ├── PurchaseOrderSection.tsx
│   ├── PurchaseOrderCard.tsx
│   ├── PurchaseOrderPDFTemplate.tsx
│   ├── PriceComparisonTable.tsx
│   ├── PartnerScorecard.tsx
│   ├── MarketPriceIndicator.tsx
│   ├── SavingsAnalysis.tsx
│   ├── UnsourcedItemsPanel.tsx
│   └── SelfSourceModal.tsx
└── utils/
    ├── wineEmbeddings.ts
    ├── enhancedLwinMatcher.ts
    └── wineSynonyms.ts
```

### Schema Updates

```
apps/web/src/database/schema.ts
# Add tables:
# - sourcePurchaseOrders
# - sourcePurchaseOrderItems
# - sourceMarketPrices
# - sourcePartnerMetrics
# - wineSynonyms
# - sourceSelfSourcing
```

---

## Implementation Notes

### Coding Standards

- **One function per file** - Each controller/utility exports a single function
- **Default exports only** - Always use `export default`
- **Arrow functions** - `const functionName = () => {}`
- **Infer return types** - Let TypeScript infer
- **Zod validation** - All inputs validated with Zod schemas
- **Transactions** - Use `db.transaction()` for multi-table operations
- **Batch operations** - Use `inArray()` instead of loops

### Testing Checklist

For each sprint:
- [ ] Database migration runs successfully
- [ ] Controllers handle edge cases
- [ ] UI renders correctly on desktop/mobile
- [ ] Activity logging works
- [ ] Email sending works (if applicable)
- [ ] PDF generation works (if applicable)

### Deployment

After each sprint:
1. Run `pnpm lint:fix` from `apps/web`
2. Commit with conventional commit message
3. Push to main
4. Monitor Vercel deployment
5. Verify in production

---

## Quick Reference

### Current RFQ Status Flow
```
draft → sent → collecting → comparing → selecting → finalized → po_generated → completed
```

### Current Item Status Flow
```
pending → quoted → selected → (self_sourced | unsourceable)
```

### Current PO Status Flow
```
draft → sent → confirmed → shipped → delivered
```

---

## Questions to Clarify

Before implementation, confirm:

1. **PO Number Format** - Is `PO-YYYY-NNNN` acceptable?
2. **Email Templates** - Should PO emails use existing email infrastructure?
3. **Partner Portal** - Do partners need a dedicated PO view/confirmation page?
4. **Inventory Integration** - Is there an inventory system to integrate for self-sourcing?
5. **Exchange Integration** - Should Liv-ex integration be scoped for this phase?
6. **PDF Branding** - Confirm C&C branding requirements for PO PDFs

---

## Success Criteria

| Feature | Success Metric |
|---------|---------------|
| Post-Selection Workflow | Admin can generate, send, and track POs |
| Price Comparison | Clear visual comparison across 3+ partners |
| AI LWIN Matching | >80% accuracy on first match |
| Partner Output | Partners see LWIN in all outputs |
| Self-Sourcing | Admin can record self-sourced items |

---

## References

- Existing code: `apps/web/src/app/_source/`
- Competitive analysis: `docs/SOURCE-COMPETITIVE-ANALYSIS-V2.md`
- UX redesign plans: `apps/web/src/app/_source/REDESIGN-PLAN.md`
