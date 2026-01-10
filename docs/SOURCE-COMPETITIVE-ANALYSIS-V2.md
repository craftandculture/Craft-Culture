# SOURCE Tool - Competitive Analysis V2

> **Updated**: January 2025
> **Purpose**: Deep dive comparison vs wine trading platforms and B2B quoting tools, with implementation priorities.

---

## What's Been Improved Since V1

### Implemented Features

| Feature | Status | Notes |
|---------|--------|-------|
| Transaction wrappers | Done | `partnerSubmitQuotes.ts` now uses `db.transaction()` |
| N+1 query fix | Done | `adminBulkSelectQuotes.ts` uses batch operations |
| Debug logging removed | Done | `partnerGetManyRfqs.ts` cleaned up |
| Auto-select best | Done | `adminAutoSelectBest.ts` with `lowest_price` and `single_partner` strategies |
| LWIN search UI | Done | `AddItemModal.tsx` with 208k+ wine database search |
| Item editing modals | Done | `ItemEditorModal.tsx` for inline editing |
| Partner contact selection | Done | Select specific contacts when sending RFQs |

### Current Capabilities Summary

```
SOURCE Today:
- Create RFQs from Excel/email via GPT-4o parsing
- LWIN database matching (trigram similarity)
- Send to multiple partners with deadlines
- Partners submit quotes with exact/alternative/N/A options
- Auto-select best prices or single partner
- Generate PDF/Excel quotes
- Activity logging and notifications
```

---

## Competitive Landscape 2025

### Wine-Specific Platforms

| Platform | Type | Key Differentiator | Weakness vs SOURCE |
|----------|------|-------------------|-------------------|
| **[Liv-ex](https://www.liv-ex.com/)** | Exchange | 550+ members, real-time pricing, LWIN standard, 40k daily price updates | No RFQ workflow, no custom sourcing |
| **[Bordeaux Index LiveTrade](https://bordeauxindex.com/livetrade)** | Trading | Market-making, 24/7 API trading, portfolio management, guaranteed condition | No multi-partner quotes, merchant not platform |
| **[CultX](https://www.cultx.com/)** | Trading App | Mobile-first, provenance verification, instant trading | Consumer focus, no B2B RFQ |
| **[Vinfolio/FINE+RARE](https://www.vinfolio.com/)** | Marketplace | $750M AUM, real-time valuation, single-page cellar view | No partner quote comparison |
| **[Provi](https://www.provi.com/)** | B2B Ordering | Largest buyer network, ML search, ProviPay, 1400+ distributors | US-only, no fine wine focus |
| **[SevenFifty](https://go.sevenfifty.com/)** | B2B Ordering | Unified ordering, custom ecommerce stores | No RFQ, no quote comparison |

### CPQ/RFQ Platforms

| Platform | Strength | Relevance to SOURCE |
|----------|----------|---------------------|
| **[PROS CPQ](https://pros.com/products/cpq-software/)** | AI dynamic pricing, real-time deal scoring | Price optimization algorithms |
| **[DealHub](https://dealhub.io/)** | Predictive analytics, AI-driven revenue optimization | Quote scoring, win probability |
| **[Oracle CPQ](https://www.oracle.com/cx/sales/cpq/)** | Optimal discount recommendations, AI win probability | Deal prioritization |
| **[Keelvar](https://keelvar.com/)** | Autonomous RFQ bots, 90% manual reduction | Agentic procurement automation |

---

## Gap Analysis: SOURCE vs Competition

### What We're Missing

#### 1. AI-Powered LWIN Matching (HIGH PRIORITY - User Requested)

**Current state**: Trigram similarity matching in `matchLwinWines.ts` (40% threshold)

**What Liv-ex/Wine-Searcher do**:
- Wine Matcher API standardizes Excel lists
- Matches to LWIN with high accuracy
- Adds price information automatically

**What we need**:
```
Input: "Opus One 2019 x 6 cases"
        ↓ AI Parsing (GPT-4o)
        ↓ Enhanced LWIN Matching
Output: {
  lwin: "1014033",
  displayName: "Opus One 2019",
  producer: "Opus One Winery",
  region: "Napa Valley",
  confidence: 0.95,
  marketPrice: { avg: 550, low: 520, high: 580 }  // NEW
}
```

**Implementation approach**:
1. Use OpenAI embeddings for semantic wine matching
2. Build wine synonym database (Shiraz=Syrah, DRC=Domaine de la Romanée-Conti)
3. Combine AI extraction + LWIN lookup in single pass
4. Show match confidence to user with option to correct

#### 2. Partner Output Enrichment (User Requested)

**Current state**: Partners receive RFQ with basic item info

**What partners need**:
- LWIN codes for each item (for their own systems)
- Market price benchmarks
- Stock recommendations based on their history
- Clear case/bottle configuration

**Proposed output format for partners**:
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

#### 3. Real-Time Market Pricing

**What Liv-ex has**: 20+ years historical data, 40k daily updates

**What we could build**:
- Store historical quote data as "market intelligence"
- Show average winning price per wine from past RFQs
- Flag quotes that are outliers vs historical data
- Partner: "Your price is 15% above average winning bid"

#### 4. Portfolio Management & Analytics

**What Bordeaux Index LiveTrade has**:
- Single-page cellar view
- Real-time valuation
- Performance tracking
- Trade directly from portfolio

**What we could build**:
- Partner inventory tracking
- "You quoted this wine 5 times, won 3"
- Stock alert: "Partner X has low stock of DRC"
- Demand forecasting from RFQ patterns

#### 5. Agentic Procurement (Future)

**Industry trend**: Gartner predicts 90% of B2B purchases by AI agents by 2028

**What this means for SOURCE**:
- AI agent that receives client request, parses it, matches LWINs, suggests partners, sends RFQ
- Autonomous quote collection and scoring
- Auto-generate POs for winning quotes
- Human reviews exceptions only

---

## Implementation Priorities

### Sprint 1: AI LWIN Matching Enhancement

**Goal**: Auto-populate LWIN numbers with high accuracy during parsing

**Files to modify**:

1. **`apps/web/src/app/_source/controller/adminParseInput.ts`**

Add LWIN matching in AI prompt:
```typescript
const systemPrompt = `You are an expert at extracting wine product information.
For each wine, also provide your best guess at the LWIN code if you recognize
the wine. LWIN is a 7-digit number. Common LWINs:
- Opus One: 1014033
- Château Margaux: 1000214
- DRC La Tâche: 1002456
...
`
```

2. **`apps/web/src/app/_source/utils/matchLwinWines.ts`**

Enhance matching:
```typescript
// Current: trigram similarity only
// Enhanced: multi-signal matching

const matchLwinWine = async (item: ParsedItem) => {
  // 1. Exact LWIN lookup if provided
  if (item.lwin) {
    return lookupLwin(item.lwin);
  }

  // 2. Embedding-based semantic search
  const embedding = await getEmbedding(
    `${item.producer} ${item.productName} ${item.vintage}`
  );
  const semanticMatches = await searchByEmbedding(embedding, 5);

  // 3. Trigram fallback
  const trigramMatches = await searchByTrigram(item.productName, 5);

  // 4. Score and rank all candidates
  const ranked = rankCandidates([...semanticMatches, ...trigramMatches], item);

  return ranked[0] || null;
};
```

3. **New file: `apps/web/src/app/_source/utils/wineEmbeddings.ts`**

```typescript
import { openai } from '@ai-sdk/openai';

const getWineEmbedding = async (text: string) => {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
};

// Store embeddings for top 50k wines in database
// Use pgvector for similarity search
```

4. **Database change**: Add pgvector extension
```sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE lwin_wines ADD COLUMN embedding vector(1536);

CREATE INDEX ON lwin_wines USING ivfflat (embedding vector_cosine_ops);
```

### Sprint 2: Partner Output Enhancement

**Goal**: Include LWIN and market data in partner-facing RFQ

**Files to modify**:

1. **Partner RFQ detail page** - Show LWIN codes prominently
2. **PDF export for partners** - Include LWIN column
3. **Email template** - Add LWIN reference table

**New data to include**:
```typescript
interface PartnerRfqItem {
  // Existing
  productName: string;
  quantity: number;

  // New - LWIN details
  lwin: string | null;
  lwinConfidence: number;

  // New - Market context
  marketPriceAvgUsd: number | null;
  partnerLastQuote: number | null;
  partnerWinRate: number | null;
}
```

### Sprint 3: Quote Analytics Dashboard

**Goal**: Help admins understand partner performance and pricing trends

**New page**: `/platform/admin/source/analytics`

**Metrics to track**:
- Partner response rates
- Average response time
- Quote competitiveness (% best price)
- Win rates by partner
- Price trends by wine type

**Database schema**:
```sql
CREATE TABLE source_partner_metrics (
  partner_id UUID PRIMARY KEY REFERENCES partners(id),
  total_rfqs_received INTEGER DEFAULT 0,
  total_rfqs_responded INTEGER DEFAULT 0,
  avg_response_hours DECIMAL(8,2),
  total_quotes INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_value_won_usd DECIMAL(14,2),
  best_price_rate DECIMAL(5,2), -- % of time they had best price
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to update on quote selection
CREATE TRIGGER update_partner_metrics
AFTER UPDATE ON source_rfq_items
FOR EACH ROW
WHEN (NEW.selected_quote_id IS DISTINCT FROM OLD.selected_quote_id)
EXECUTE FUNCTION refresh_partner_metrics();
```

### Sprint 4: Purchase Order Generation

**Goal**: Generate POs from selected quotes

**Already planned in V1** - reference previous document.

Key addition: Include LWIN in PO line items.

### Sprint 5: Agentic Features

**Goal**: Reduce manual work in RFQ process

1. **Smart Partner Selection**
   - AI suggests which partners to send RFQ based on:
     - Wine types (Bordeaux specialist vs Burgundy)
     - Past win rates for similar wines
     - Response reliability

2. **Quote Anomaly Detection**
   - Flag quotes >20% above/below historical average
   - Alert: "This price for DRC seems low - verify authenticity"

3. **Auto-Draft RFQ from Email**
   - Forward email to source@craftculture.xyz
   - AI extracts items, creates draft RFQ
   - Admin reviews and sends

---

## Competitive Positioning Matrix

| Capability | Liv-ex | LiveTrade | Provi | SOURCE (Current) | SOURCE (Planned) |
|------------|--------|-----------|-------|------------------|------------------|
| RFQ Workflow | - | - | - | **Yes** | **Yes** |
| Multi-Partner Quotes | - | - | - | **Yes** | **Yes** |
| AI Parsing | - | - | ML search | **GPT-4o** | **GPT-4o + Embeddings** |
| LWIN Integration | Native | - | - | **Trigram** | **Semantic + Embeddings** |
| Real-time Pricing | **40k/day** | **Market-making** | - | - | Historical quotes |
| Partner Analytics | Member stats | - | **Yes** | - | **Planned** |
| PO Generation | N/A | N/A | **Yes** | - | **Planned** |
| API Access | **Yes** | **Yes** | **Yes** | - | Planned |
| Fine Wine Focus | **Yes** | **Yes** | No | **Yes** | **Yes** |

### SOURCE Unique Value Proposition

> **"The only AI-powered RFQ platform built for fine wine sourcing with LWIN integration, multi-partner quote comparison, and automated best-price selection."**

No competitor offers:
1. AI parsing of client wine lists (Excel/email)
2. LWIN matching during parsing
3. Multi-partner quote collection in one workflow
4. Auto-select best prices across partners
5. Fine wine + regional market focus (GCC)

---

## Technical Debt to Address

1. **Remaining N+1 in autoSelectBest** - Lines 163-176 still loop for item updates
2. **No rate limiting** - Partner API endpoints should be rate-limited
3. **No optimistic updates** - UI waits for server response
4. **No WebSocket** - Manual refresh to see new quotes
5. **No offline support** - Partner mobile experience needs PWA

---

## Quick Wins (This Week)

1. **Add LWIN to partner quote form display** - 2 hours
2. **Show LWIN in PDF export** - 1 hour
3. **Add market price reference in comparison table** - 4 hours
4. **Partner metrics calculation trigger** - 4 hours

---

## Sources

### Wine Platforms
- [Liv-ex Global Exchange](https://www.liv-ex.com/)
- [Bordeaux Index LiveTrade](https://bordeauxindex.com/livetrade)
- [CultX Trading App](https://www.cultx.com/)
- [Vinfolio Marketplace](https://www.vinfolio.com/)
- [Provi B2B Marketplace](https://www.provi.com/)
- [SevenFifty Platform](https://go.sevenfifty.com/)

### AI/CPQ Trends
- [PROS CPQ Trends 2025](https://pros.com/learn/blog/future-of-cpq-trends-report-2025/)
- [Gartner AI Agents in B2B](https://www.digitalcommerce360.com/2025/11/28/gartner-ai-agents-15-trillion-in-b2b-purchases-by-2028/)
- [GEP AI-Powered RFQ Automation](https://www.gep.com/blog/technology/ai-powered-rfq-automation-helps-procurement-supplier-selection)
- [State of AI in Procurement 2025](https://artofprocurement.com/blog/state-of-ai-in-procurement)

### LWIN/Wine Data
- [Liv-ex LWIN Database](https://www.liv-ex.com/lwin/)
- [Wine-Searcher LWIN Integration](https://wineindustryadvisor.com/2022/07/20/wine-searcher-works-with-liv-ex/)
