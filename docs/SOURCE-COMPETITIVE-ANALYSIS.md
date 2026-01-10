# SOURCE Tool - Competitive Analysis & Implementation Plan

> **Purpose**: This document provides competitive analysis and actionable implementation tasks for improving the SOURCE RFQ tool. Feed this to Claude Code for implementation.

---

## Executive Summary

The SOURCE tool is a wine RFQ management system. After analyzing competitors in the wine/beverage B2B space, here are the key gaps and opportunities.

### Top Competitors Analyzed

| Platform | Focus | Key Strength |
|----------|-------|--------------|
| **Liv-ex** | Fine wine trading exchange | Real-time pricing, LWIN standardization, anonymous trading |
| **Provi** | Beverage alcohol marketplace | Largest buyer network, ML-powered search, integrated payments |
| **SevenFifty** | Wine/spirits ordering | Unified ordering across distributors, custom ecommerce stores |
| **Zoovu** | B2B CPQ | AI-powered configuration, visual product builders |
| **AutoRFP.ai** | RFQ automation | AI parsing of any format, confidence scores, learning system |

---

## Gap Analysis: SOURCE vs Competitors

### What Competitors Do Better

#### 1. Real-Time Pricing & Market Data (Liv-ex)
- **Liv-ex**: 40,000+ price updates daily, 20+ years historical data
- **SOURCE**: No market price benchmarking
- **Gap**: Partners quote blind without knowing market rates

#### 2. Unified Marketplace Experience (Provi/SevenFifty)
- **Provi**: Single inbox for all distributor communications
- **SevenFifty**: Order from multiple distributors in one cart
- **SOURCE**: Siloed per-RFQ experience, no persistent partner relationships

#### 3. AI-Powered Parsing with Confidence Scores (AutoRFP.ai)
- **AutoRFP.ai**: Shows 0-100 trust scores, learns from corrections
- **SOURCE**: Has GPT-4o parsing but no confidence UI or learning loop
- **Gap**: Users can't see/correct low-confidence parses

#### 4. Integrated Payments (Provi)
- **Provi**: ProviPay handles invoicing, credits, scheduled payments
- **SOURCE**: No payment integration
- **Gap**: Manual invoicing after quote acceptance

#### 5. Product Discovery & Search (SevenFifty)
- **SevenFifty**: Browse distributor portfolios, filter by grape/region/price
- **SOURCE**: Only handles inbound requests, no discovery
- **Gap**: Can't proactively find wines from partners

#### 6. Analytics & Insights (Liv-ex)
- **Liv-ex**: Price indices, market trends, portfolio analytics
- **SOURCE**: No analytics dashboard
- **Gap**: No visibility into partner performance or market trends

---

## Implementation Priorities

### Priority 1: Critical Fixes (Do First)

These are bugs/tech debt that should be fixed immediately.

#### 1.1 Remove Debug Logging in Production

**File**: `apps/web/src/app/_source/controller/partnerGetManyRfqs.ts`

**Problem**: Debug query runs on every request (lines 27-39)

**Action**: Delete or gate behind development check:
```typescript
// DELETE these lines (27-39):
const allAssignments = await db
  .select({...})
  .from(sourceRfqPartners)
  .limit(20);
logger.warn('[SOURCE] Partner getMany - all assignments in system', {...});
```

#### 1.2 Fix N+1 Query in Bulk Select

**File**: `apps/web/src/app/_source/controller/adminBulkSelectQuotes.ts`

**Problem**: Loop with 4 queries per selection (lines 100-139)

**Action**: Refactor to batch operations:
```typescript
// Replace the for loop with batch operations:
await db.transaction(async (tx) => {
  // 1. Unselect all existing quotes for these items in one query
  const itemIds = selections.map(s => s.itemId);
  await tx.update(sourceRfqQuotes)
    .set({ isSelected: false })
    .where(inArray(sourceRfqQuotes.itemId, itemIds));

  // 2. Select new quotes in one query
  const quoteIds = selections.map(s => s.quoteId);
  await tx.update(sourceRfqQuotes)
    .set({ isSelected: true })
    .where(inArray(sourceRfqQuotes.id, quoteIds));

  // 3. Update items - batch by building values
  // Use a single query with CASE statements or multiple small batches
});
```

#### 1.3 Add Transaction Wrapper to Partner Submit

**File**: `apps/web/src/app/_source/controller/partnerSubmitQuotes.ts`

**Problem**: Multiple related updates without transaction (lines 107-179)

**Action**: Wrap in transaction:
```typescript
await db.transaction(async (tx) => {
  // All the existing updates go inside here
  await tx.delete(sourceRfqQuotes)...
  await tx.insert(sourceRfqQuotes)...
  await tx.update(sourceRfqPartners)...
  await tx.update(sourceRfqs)...
  await tx.update(sourceRfqItems)...
});
```

---

### Priority 2: UX Improvements (Competitor Parity)

#### 2.1 Add Parse Confidence Display

**Inspired by**: AutoRFP.ai's trust scores

**What to build**:
- Show confidence score (0-100%) next to each parsed item
- Color code: Green (>80%), Yellow (50-80%), Red (<50%)
- Allow inline editing of low-confidence items
- Learn from corrections (store in database for future matching)

**Files to modify**:
- `apps/web/src/app/_source/controller/adminParseInput.ts` - Already has confidence
- Create new component: `apps/web/src/app/_source/components/ParsedItemRow.tsx`
- Add to RFQ detail page UI

**Database change**:
```sql
-- Add to sourceRfqItems or create new table
ALTER TABLE source_rfq_items ADD COLUMN user_corrected BOOLEAN DEFAULT false;
ALTER TABLE source_rfq_items ADD COLUMN original_parsed_name TEXT;
```

#### 2.2 Implement Compact Comparison Table

**Inspired by**: Liv-ex trading screen, spreadsheet UX

**Reference**: Already planned in `apps/web/src/app/_source/REDESIGN-PLAN.md`

**Key features to implement**:
- 24px row height (dense view)
- Sticky headers
- Color-coded prices (green=best, red=highest)
- Progress indicator: "12 of 50 items selected"
- Keyboard navigation (arrow keys, Enter to select, B for best)

**Create new component**:
```
apps/web/src/app/_source/components/ComparisonTable/
├── ComparisonTable.tsx      # Main container
├── ComparisonRow.tsx        # Single row
├── ComparisonHeader.tsx     # Sticky header with partner names
├── PriceCell.tsx            # Price display with color coding
└── useKeyboardNavigation.ts # Keyboard handling hook
```

#### 2.3 Add Bulk Action Buttons

**Inspired by**: Provi's quick actions, spreadsheet select-all

**Actions to add**:
- "Select Best Prices" - One click selects cheapest for all items
- "Select All from [Partner]" - Dropdown to assign all to one partner
- "Clear All Selections" - Reset
- "Show Unselected Only" - Filter toggle

**New controller**: `apps/web/src/app/_source/controller/adminAutoSelectBest.ts`
```typescript
// Logic: For each item, find quote with lowest costPricePerCaseUsd
// Select it automatically
// Return count of selections made
```

---

### Priority 3: New Features (Competitive Advantage)

#### 3.1 Purchase Order Generation

**Inspired by**: Provi's integrated ordering, SevenFifty's order management

**What competitors have that SOURCE lacks**:
- After selecting quotes, no way to generate POs for partners
- No tracking of what was ordered vs delivered
- Manual email follow-up required

**Database schema** (add to `apps/web/src/database/schema.ts`):
```typescript
export const sourcePurchaseOrders = pgTable('source_purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqId: uuid('rfq_id').references(() => sourceRfqs.id, { onDelete: 'cascade' }).notNull(),
  partnerId: uuid('partner_id').references(() => partners.id).notNull(),
  poNumber: text('po_number').notNull().unique(),
  status: text('status').notNull().default('draft'), // draft, sent, confirmed, received, cancelled
  totalAmountUsd: decimal('total_amount_usd', { precision: 12, scale: 2 }),
  deliveryDate: date('delivery_date'),
  deliveryInstructions: text('delivery_instructions'),
  paymentTerms: text('payment_terms'),
  pdfUrl: text('pdf_url'),
  sentAt: timestamp('sent_at', { mode: 'date' }),
  confirmedAt: timestamp('confirmed_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
});

export const sourcePurchaseOrderItems = pgTable('source_purchase_order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  poId: uuid('po_id').references(() => sourcePurchaseOrders.id, { onDelete: 'cascade' }).notNull(),
  rfqItemId: uuid('rfq_item_id').references(() => sourceRfqItems.id).notNull(),
  quoteId: uuid('quote_id').references(() => sourceRfqQuotes.id).notNull(),
  quantity: integer('quantity').notNull(),
  unitPriceUsd: decimal('unit_price_usd', { precision: 10, scale: 2 }),
  lineTotalUsd: decimal('line_total_usd', { precision: 12, scale: 2 }),
});
```

**New controllers**:
```
apps/web/src/app/_source/controller/
├── adminGeneratePurchaseOrders.ts   # Create POs from selected quotes
├── adminSendPurchaseOrder.ts        # Email PO to partner
├── adminGetPurchaseOrders.ts        # List POs for an RFQ
├── partnerConfirmPurchaseOrder.ts   # Partner confirms receipt
└── partnerGetPurchaseOrder.ts       # Partner views their PO
```

**New components**:
```
apps/web/src/app/_source/components/
├── PurchaseOrderPDFTemplate.tsx     # PDF layout for PO
├── PurchaseOrderList.tsx            # List POs on RFQ detail
└── PurchaseOrderCard.tsx            # Single PO display
```

#### 3.2 Partner Performance Analytics

**Inspired by**: Liv-ex member analytics, Provi distributor insights

**What to track**:
- Response rate: % of RFQs partner responded to
- Average response time (hours)
- Quote competitiveness: % of items where they had best price
- Win rate: % of their quotes that were selected
- Reliability: Delivery accuracy, issue rate

**Database schema**:
```typescript
export const sourcePartnerMetrics = pgTable('source_partner_metrics', {
  partnerId: uuid('partner_id').primaryKey().references(() => partners.id),
  totalRfqsReceived: integer('total_rfqs_received').default(0),
  totalRfqsResponded: integer('total_rfqs_responded').default(0),
  avgResponseTimeHours: decimal('avg_response_time_hours', { precision: 8, scale: 2 }),
  totalQuotesSubmitted: integer('total_quotes_submitted').default(0),
  totalQuotesWon: integer('total_quotes_won').default(0),
  totalValueWonUsd: decimal('total_value_won_usd', { precision: 14, scale: 2 }),
  lastUpdatedAt: timestamp('last_updated_at', { mode: 'date' }),
});
```

**New controller**: `apps/web/src/app/_source/controller/adminGetPartnerMetrics.ts`

**New component**: `apps/web/src/app/_source/components/PartnerMetricsCard.tsx`
- Show when selecting partners for RFQ
- Display: Response rate, avg time, win rate
- Color code: Green (good), Yellow (average), Red (poor)

#### 3.3 Market Price Benchmarking

**Inspired by**: Liv-ex pricing data, Wine-Searcher market prices

**What to build**:
- When adding items, show estimated market price range
- Flag quotes that are significantly above/below market
- Source: LWIN database prices, historical quote data

**Implementation**:
1. Add `estimatedMarketPriceUsd` to `sourceRfqItems`
2. During parsing, look up LWIN and fetch average price
3. In comparison table, show "vs Market" column
4. Alert if quote is >20% above market average

---

### Priority 4: AI Enhancements

#### 4.1 Smarter Wine Matching

**Current**: Trigram similarity on display name (matchLwinWines.ts)

**Improvements**:
1. **Embedding-based search**: Use OpenAI embeddings for semantic matching
2. **Synonym handling**: Shiraz = Syrah, Pinot Grigio = Pinot Gris
3. **Producer aliases**: "DRC" = "Domaine de la Romanée-Conti"
4. **Vintage normalization**: "NV", "Non-Vintage", "N.V." all match

**File**: `apps/web/src/app/_source/utils/matchLwinWines.ts`

#### 4.2 Quote Anomaly Detection

**What to build**:
- Flag quotes that are outliers (>2 std dev from mean)
- Suggest investigation for suspiciously low prices
- Alert if same wine priced very differently by same partner

**New utility**: `apps/web/src/app/_source/utils/detectQuoteAnomalies.ts`

---

### Priority 5: Mobile Experience

#### 5.1 Partner Mobile Quote Submission

**Inspired by**: Provi mobile app, responsive ordering

**Current state**: Partner pages exist but not optimized for mobile

**What to improve**:
- Large touch targets for quote entry
- Swipe actions (decline, submit)
- Camera OCR for quick price entry from invoices
- Push notifications for new RFQs

**Files to update**:
```
apps/web/src/app/(routes)/(platform)/platform/partner/source/
├── page.tsx                    # RFQ list - add mobile layout
└── [rfqId]/
    └── page.tsx                # Quote form - add mobile layout
```

---

## Implementation Order

### Sprint 1: Critical Fixes
1. Remove debug logging (`partnerGetManyRfqs.ts`)
2. Fix N+1 query (`adminBulkSelectQuotes.ts`)
3. Add transactions (`partnerSubmitQuotes.ts`)

### Sprint 2: Core UX
4. Parse confidence display
5. Compact comparison table
6. Bulk action buttons

### Sprint 3: PO System
7. Database schema for POs
8. Generate PO controller
9. PO PDF template
10. Send PO to partner

### Sprint 4: Analytics
11. Partner metrics schema
12. Metrics calculation logic
13. Partner selection UI with metrics

### Sprint 5: AI & Polish
14. Improved wine matching
15. Quote anomaly detection
16. Mobile responsiveness

---

## File Reference

### Controllers (Business Logic)
```
apps/web/src/app/_source/controller/
├── adminAddItem.ts
├── adminBulkSelectQuotes.ts      # NEEDS FIX: N+1 query
├── adminCreateRfq.ts
├── adminDeleteItem.ts
├── adminDeleteRfq.ts
├── adminGenerateFinalQuote.ts
├── adminGetManyRfqs.ts
├── adminGetOneRfq.ts
├── adminParseInput.ts
├── adminSearchLwin.ts
├── adminSelectQuote.ts
├── adminSendToPartners.ts
├── adminUpdateItem.ts
├── adminUpdateRfq.ts
├── partnerDeclineRfq.ts
├── partnerGetManyRfqs.ts         # NEEDS FIX: Debug logging
├── partnerGetOneRfq.ts
└── partnerSubmitQuotes.ts        # NEEDS FIX: Add transaction
```

### Database Schema
```
apps/web/src/database/schema.ts
# Tables: sourceRfqs, sourceRfqItems, sourceRfqPartners,
#         sourceRfqPartnerContacts, sourceRfqQuotes, sourceRfqActivityLogs
```

### UI Pages
```
apps/web/src/app/(routes)/(platform)/platform/
├── admin/source/
│   ├── page.tsx                  # RFQ list
│   ├── new/page.tsx              # Create RFQ
│   └── [rfqId]/page.tsx          # RFQ detail (needs comparison table)
└── partner/source/
    ├── page.tsx                  # Partner RFQ inbox
    └── [rfqId]/page.tsx          # Quote submission form
```

---

## Competitive Positioning

After implementing these improvements, SOURCE will differentiate by:

| Feature | Liv-ex | Provi | SevenFifty | SOURCE (Future) |
|---------|--------|-------|------------|-----------------|
| RFQ Management | Limited | No | No | **Yes** |
| Multi-partner quotes | No | No | No | **Yes** |
| Fine wine focus | Yes | No | Limited | **Yes** |
| AI parsing | No | ML search | No | **Yes (GPT-4o)** |
| LWIN integration | Yes | No | No | **Yes** |
| PO generation | N/A | Yes | Yes | **Planned** |
| Price benchmarking | Yes | No | No | **Planned** |
| Partner analytics | Limited | Yes | Limited | **Planned** |

**Unique value prop**: The only AI-powered RFQ tool built specifically for fine wine sourcing with LWIN integration and multi-partner quote comparison.

---

## Sources

- [Liv-ex Trading Platform](https://www.liv-ex.com/wwd/trading/)
- [Provi B2B Marketplace](https://www.provi.com)
- [SevenFifty Platform](https://go.sevenfifty.com/)
- [AutoRFP.ai Features](https://autorfp.ai/blog/best-rfq-software)
- [Zoovu CPQ](https://zoovu.com/rfq-software)
- [Beyond Intranet RFQ Software](https://www.beyondintranet.com/blog/10-best-request-for-quotation-softwares/)
