# Craft & Culture Platform - Consolidated Context

> **Purpose**: Handoff document for AI agents. Contains complete business context and technical direction.
> **Created**: January 2025

---

## Business Model

### Overview

Craft & Culture (C&C) is a wine distribution company serving the GCC market (UAE, Saudi Arabia, Qatar, etc.).

```
┌─────────────────────────────────────────────────────────────────┐
│                      CRAFT & CULTURE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PRIMARY BUSINESS: Distribution services for wine brands         │
│                                                                  │
│  MAIN CLIENTS: Distributors                                      │
│  ├── Wine/spirits brands wanting GCC market access               │
│  ├── Importers bringing products into the region                 │
│  └── Regional distributors expanding portfolios                  │
│                                                                  │
│  RETAIL ARM: Pocket Cellar                                       │
│  ├── B2C: Direct to consumers                                    │
│  └── B2B: Corporate gifting, events, companies                   │
│                                                                  │
│  NOTE: C&C does NOT sell direct to hotels/restaurants            │
│        Distributors are the main clients                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Value Proposition for Distributors

| Service | Description |
|---------|-------------|
| Market Entry | Navigate GCC import regulations, licensing |
| Compliance | Handle all documentation, certifications, registrations |
| Distribution | Network of retail/HoReCa partners |
| Logistics | Shipment tracking, goods receiving, warehousing |
| Market Intel | Pricing strategy, competitive landscape |

---

## Platform Architecture

### Three Core Systems

```
┌─────────────────────────────────────────────────────────────────┐
│                     C&C PLATFORM MODULES                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. SOURCE (RFQ Tool)                                            │
│     └── Source wines from supplier partners at best prices       │
│     └── AI parsing, LWIN matching, multi-partner quotes          │
│     └── Implementation plan: /docs/SOURCE-IMPLEMENTATION-PLAN.md │
│                                                                  │
│  2. OPERATIONS PLATFORM (Core Focus)                             │
│     ├── Document Storage                                         │
│     ├── Goods In Tracking                                        │
│     └── Compliance Management                                    │
│                                                                  │
│  3. POCKET CELLAR (Retail Storefront)                            │
│     └── B2C and B2B wine sales                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Operations Platform (Priority Build)

### Purpose

**Internal tool** to support C&C operations, with **client-facing visibility** layer.

- NOT a sales tool
- Demonstrates operational maturity to clients
- Builds confidence that C&C can scale
- Reduces "where's my shipment?" support queries

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    OPERATIONS PLATFORM                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   INTERNAL (C&C Team)              CLIENT PORTAL (Distributors)  │
│   ┌─────────────────────┐          ┌─────────────────────────┐  │
│   │ • Manage documents  │          │ • View their shipments  │  │
│   │ • Track shipments   │  ─────►  │ • See compliance status │  │
│   │ • Monitor compliance│          │ • Access their docs     │  │
│   │ • Process goods in  │          │ • Track deliveries      │  │
│   │ • Coordinate ops    │          │ • (Read-only / limited) │  │
│   └─────────────────────┘          └─────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Module 1: Document Storage

**What it stores:**
- Import licenses
- Health certificates
- Product registrations
- Customs documentation
- Lab reports
- Compliance certificates

**Features needed:**
| Feature | Priority | Description |
|---------|----------|-------------|
| Upload/organize | Must have | By product, shipment, market, client |
| Document tagging | Must have | Type: license, cert, lab report, etc. |
| Expiry tracking | Must have | Store expiry dates, trigger alerts |
| Search | Must have | Find any document quickly |
| Client assignment | Must have | Link docs to specific distributor clients |
| Share externally | Nice to have | Generate links for customs/authorities |
| OCR extraction | Future | Auto-extract key fields from uploads |

### Module 2: Goods In Tracking

**What it tracks:**
- Inbound shipments from suppliers
- Container/shipment status
- Customs clearance progress
- Warehouse receipt confirmation
- Inventory updates

**Features needed:**
| Feature | Priority | Description |
|---------|----------|-------------|
| Create shipment | Must have | Log new inbound shipment |
| Link documents | Must have | Attach relevant docs to shipment |
| Status tracking | Must have | In transit → Customs → Cleared → Received |
| Client assignment | Must have | Which distributor is this for |
| ETA tracking | Must have | Expected arrival dates |
| Receipt confirmation | Must have | Confirm goods received, quantities |
| Container tracking | Nice to have | Container number, seal, etc. |
| Warehouse location | Future | Where stock is stored |

### Module 3: Compliance Management

**What it monitors:**
- License expiry dates across all clients/products
- Regulatory requirements by market (UAE, Saudi, etc.)
- Renewal status and deadlines
- Audit trail of compliance activities

**Features needed:**
| Feature | Priority | Description |
|---------|----------|-------------|
| Expiry dashboard | Must have | See all upcoming expirations |
| Alert system | Must have | Email/SMS 90/60/30 days before expiry |
| Market checklists | Must have | Requirements for UAE, Saudi, Qatar, etc. |
| Renewal tracking | Must have | Status of renewal applications |
| Audit log | Nice to have | History of all compliance activities |
| Regulatory updates | Future | Notify when regulations change |

### Client Portal (Visibility Layer)

**What distributors can see:**
| Data | Access Level |
|------|--------------|
| Their shipments | View status, ETA, linked docs |
| Their documents | View/download their licenses, certs |
| Compliance status | See expiry dates, renewal status |
| Activity log | Recent updates on their account |
| Inventory | Stock levels (if applicable) |

**What distributors CANNOT see:**
- Internal notes
- Cost/margin data
- Other clients' information
- C&C operational workflows

---

## SOURCE Tool (RFQ Management)

### Current State

Located at: `apps/web/src/app/_source/`

**Capabilities:**
- Create RFQs from Excel/email via GPT-4o parsing
- LWIN database matching (trigram similarity, 208k+ wines)
- Send to multiple partners with deadlines
- Partners submit quotes (exact/alternative/N/A)
- Auto-select best prices or single partner
- Generate PDF/Excel quotes
- Activity logging and notifications

**Recent improvements:**
- Transaction wrappers added
- N+1 queries fixed with batch operations
- Debug logging removed
- Auto-select best feature with strategies

### Implementation Plan

Full plan at: `/docs/SOURCE-IMPLEMENTATION-PLAN.md`

**Planned enhancements:**

| Sprint | Feature |
|--------|---------|
| 1 | Post-Selection Workflow (PO generation, supplier confirmation) |
| 2 | Multi-Supplier Price Comparison |
| 3 | AI LWIN Matching Enhancement (embeddings, semantic search) |
| 4 | Partner Output Enrichment (LWIN in outputs) |
| 5 | Self-Sourcing Workflow (for unfulfilled items) |

---

## Tech Stack

```
Framework:    Next.js 15, React 19
Language:     TypeScript (strict mode)
Database:     PostgreSQL (Neon serverless)
ORM:          Drizzle ORM
API:          tRPC
Auth:         Better Auth (magic links)
Background:   Trigger.dev
Styling:      Tailwind CSS 4
AI:           OpenAI GPT-4o (parsing), embeddings planned
```

### Coding Standards

- One function per file, default exports only
- Arrow functions with const
- Infer return types (no explicit typing)
- Zod for all input validation
- TSDoc comments for exported functions
- Transactions for multi-table operations
- Batch operations (inArray) over loops

Full standards in: `/CLAUDE.md`

---

## Database Schema (Existing)

### SOURCE Tables
```
sourceRfqs              - RFQ header (client, deadline, status)
sourceRfqItems          - Line items on RFQ
sourceRfqPartners       - Partners assigned to RFQ
sourceRfqPartnerContacts - Specific contacts for each partner
sourceRfqQuotes         - Partner quotes per item
sourceRfqActivityLogs   - Activity history
```

### Operations Tables (To Build)
```
documents               - Document storage
documentTypes           - License, cert, lab report, etc.
shipments               - Goods in tracking
shipmentStatuses        - In transit, customs, cleared, received
complianceLicenses      - License/cert records with expiry
complianceAlerts        - Scheduled alert records
```

---

## Integration Points

### SOURCE → Operations

When a PO is generated from SOURCE and goods ship:
1. Create shipment record in Operations
2. Link relevant documents
3. Client sees shipment in their portal
4. Track through to receipt

### Operations → Client Portal

All operations data filtered by client:
- Distributor logs in
- Sees only their shipments, docs, compliance
- Real-time updates as C&C processes

---

## Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Main clients | Distributors | Not direct to hotels/restaurants |
| Retail channel | Pocket Cellar only | B2C and B2B via single storefront |
| Operations platform | Internal + client visibility | Not a sales tool, confidence builder |
| SOURCE purpose | Internal sourcing | Get best prices from supplier partners |

---

## Next Implementation Priorities

### Immediate (Operations Platform)

1. **Database schema** for documents, shipments, compliance
2. **Document storage module** - Upload, organize, tag, search
3. **Goods in module** - Shipment tracking workflow
4. **Compliance module** - Expiry tracking, alerts
5. **Client portal** - Read-only views for distributors

### Parallel (SOURCE Enhancements)

Follow `/docs/SOURCE-IMPLEMENTATION-PLAN.md`:
- Sprint 1: Post-selection workflow (PO generation)
- Sprint 2: Price comparison matrix

---

## File References

```
/docs/
├── CC-PLATFORM-CONTEXT.md          # This file
├── SOURCE-IMPLEMENTATION-PLAN.md   # SOURCE enhancement plan
├── SOURCE-COMPETITIVE-ANALYSIS.md  # V1 competitive analysis
└── SOURCE-COMPETITIVE-ANALYSIS-V2.md # V2 with updates

/apps/web/src/app/
├── _source/                        # SOURCE tool
│   ├── controller/                 # tRPC procedures
│   ├── components/                 # UI components
│   ├── utils/                      # Utilities (LWIN matching, etc.)
│   └── router.ts                   # tRPC router
└── (routes)/                       # Page routes

/apps/web/src/database/
├── schema.ts                       # Drizzle schema
└── client.ts                       # Database client
```

---

## Questions for Implementation

Before building Operations Platform, clarify:

1. **Document types** - What specific document types need tracking?
2. **Shipment workflow** - Exact statuses in your process?
3. **Client access** - What can clients do vs just view?
4. **Alerts** - Email, SMS, in-app, or all?
5. **Existing data** - Any documents/shipments to migrate?

---

## Summary

**Craft & Culture** = Wine distribution for GCC markets

**Clients** = Distributors (wine brands, importers)

**Platform Modules:**
1. **Operations** (priority) - Docs, goods-in, compliance + client portal
2. **SOURCE** - Internal RFQ tool for sourcing
3. **Pocket Cellar** - B2C/B2B retail

**Operations Platform is NOT a sales tool** - it's operational infrastructure that demonstrates professionalism and builds client confidence.
