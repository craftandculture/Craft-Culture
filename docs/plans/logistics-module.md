# Logistics Module - Design Plan

> **Status:** Planning - HIGH PRIORITY
> **Created:** 2026-01-05
> **Last Updated:** 2026-01-05

## Urgency

**13,500+ bottles currently on water / inbound via ocean freight.**

This system is needed ASAP to:
- Track inbound shipments
- Manage customs clearance
- Handle warehouse intake (WMS)
- Allocate stock to orders

### WMS Integration

**Standardizing on [Logilize WMS](https://logilize.com)** - contracts being signed, rollout starting soon.

**Key Logilize Features (relevant to C&C):**

| Feature | Benefit for Wine | Status |
|---------|------------------|--------|
| **Cloud-Based** | No on-prem infrastructure | Using |
| **API Integration** | Connect to our platform | Using |
| **Product Traceability** | Track by SKU, batch, expiry | Using |
| **FIFO Enforcement** | Ship older vintages first | Using |
| **Pick Optimization** | Efficient order fulfillment | Using |
| **Offline Mobile App** | Warehouse ops without internet | Using |
| **RFID Capability** | Automated scanning | Future |
| **AWS Serverless** | Reliable, scalable | Using |

**Integration Points:**
- Inbound: Shipment → WMS stock intake
- Inventory: Real-time stock levels sync
- Outbound: Order → Pick/pack instructions
- Traceability: Batch/location tracking

---

## Overview

A centralized logistics module to manage all import/export operations, paperwork, and processes for wine distribution into UAE/GCC markets.

### Problem Statement

Wine import into UAE/GCC involves multiple documents, regulatory requirements, and handoffs between parties. Currently this lives in spreadsheets, emails, and physical paperwork. A centralized module would:

- Track shipment lifecycle from supplier to customer
- Store all required documents in one place
- Automate document generation where possible
- Provide visibility to relevant parties (admin, partners, distributors)

---

## Application Framework

### Pattern: Case Management + State Machine + Task Engine

The logistics module follows a **Case Management** pattern where:

- **Case** = Shipment (the central entity)
- **State Machine** = Shipment moves through defined stages
- **Tasks** = Checklist items required at each stage
- **Documents** = Files attached throughout the lifecycle
- **Timeline** = Activity feed for audit trail

```
┌─────────────────────────────────────────────────────────┐
│                      SHIPMENT                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐             │
│  │ STATE 1 │───▶│ STATE 2 │───▶│ STATE 3 │───▶ ...     │
│  └─────────┘    └─────────┘    └─────────┘             │
│       │              │              │                   │
│       ▼              ▼              ▼                   │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐             │
│  │  Tasks  │    │  Tasks  │    │  Tasks  │             │
│  │  Docs   │    │  Docs   │    │  Docs   │             │
│  │  Events │    │  Events │    │  Events │             │
│  └─────────┘    └─────────┘    └─────────┘             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Why This Framework?

**Reusable** - Same pattern works for future features:
- Export shipments
- Customer claims/returns
- Partner onboarding
- Compliance certifications

**Flexible** - Configuration over code:
- States defined in database
- Tasks defined per state
- Document types per case type

**Auditable** - Built-in compliance:
- Every action logged
- Document versioning
- Task completion tracking

---

## Shipment Lifecycle

### States

| State | Description | Entry Criteria |
|-------|-------------|----------------|
| `draft` | Shipment being prepared | Created |
| `confirmed` | Supplier confirmed, ready to ship | All line items confirmed |
| `in_transit` | Goods shipped, en route | BOL/AWB uploaded |
| `arrived` | Arrived at port/airport | Arrival notification |
| `customs` | Customs clearance in progress | Customs docs submitted |
| `cleared` | Customs cleared, duty paid | Duty receipt uploaded |
| `warehoused` | In bonded warehouse | Warehouse receipt |
| `delivering` | Out for delivery | Delivery scheduled |
| `delivered` | Complete | POD received |
| `cancelled` | Shipment cancelled | Manual cancellation |

### State Transitions

```
draft ──────────▶ confirmed ──────────▶ in_transit
                      │                      │
                      ▼                      ▼
                 cancelled              arrived
                                            │
                                            ▼
                                        customs
                                            │
                                            ▼
                                        cleared
                                            │
                                            ▼
                                       warehoused
                                            │
                                            ▼
                                       delivering
                                            │
                                            ▼
                                        delivered
```

---

## Documents

### Document Types

| Type | Source | Stage | Required |
|------|--------|-------|----------|
| Commercial Invoice | Generated | draft | Yes |
| Packing List | Generated | draft | Yes |
| Bill of Lading (Sea) | Uploaded | in_transit | Conditional |
| Airway Bill (Air) | Uploaded | in_transit | Conditional |
| Certificate of Origin | Uploaded | customs | Yes |
| Health Certificate | Uploaded | customs | Yes |
| Import Permit | Uploaded | customs | Yes |
| Customs Declaration | Generated/Uploaded | customs | Yes |
| Duty Payment Receipt | Uploaded | cleared | Yes |
| Warehouse Receipt | Generated | warehoused | Yes |
| Delivery Note | Generated | delivering | Yes |
| Proof of Delivery | Uploaded | delivered | Yes |

### Document Generation

Some documents can be auto-generated from shipment data:

- **Commercial Invoice** - Line items, prices, terms
- **Packing List** - Cases, weights, dimensions
- **Customs Declaration** - Product codes, values, duties
- **Warehouse Receipt** - Intake confirmation
- **Delivery Note** - Customer delivery details

Template system using React PDF or similar.

---

## Tasks

### Task Types

| Type | Description | Completion |
|------|-------------|------------|
| `document_upload` | Upload a required document | File attached |
| `document_verify` | Verify uploaded document | Manual approval |
| `data_entry` | Enter required information | Fields populated |
| `approval` | Approve to proceed | Manual sign-off |
| `external` | Waiting on external party | Manual confirmation |
| `automated` | System task | Automatic |

### Tasks by Stage

**Draft**
- [ ] Add line items
- [ ] Confirm quantities with supplier
- [ ] Generate commercial invoice
- [ ] Generate packing list

**Confirmed**
- [ ] Book freight
- [ ] Confirm shipping date
- [ ] Upload booking confirmation

**In Transit**
- [ ] Upload BOL/AWB
- [ ] Enter vessel/flight details
- [ ] Confirm ETA

**Customs**
- [ ] Upload Certificate of Origin
- [ ] Upload Health Certificate
- [ ] Upload Import Permit
- [ ] Submit customs declaration
- [ ] Pay import duty
- [ ] Upload duty receipt

**Cleared**
- [ ] Confirm clearance
- [ ] Arrange transfer to warehouse

**Warehoused**
- [ ] Confirm warehouse intake
- [ ] Quality inspection
- [ ] Allocate stock to orders

**Delivering**
- [ ] Schedule delivery
- [ ] Generate delivery note
- [ ] Dispatch goods

**Delivered**
- [ ] Upload proof of delivery
- [ ] Customer confirmation

---

## Data Model

### Core Tables

```sql
-- Shipments (the case)
CREATE TABLE shipments (
  id UUID PRIMARY KEY,
  reference VARCHAR(50) UNIQUE,  -- SHP-2024-0001

  -- Relationships
  partner_id UUID REFERENCES partners(id),
  distributor_id UUID REFERENCES partners(id),

  -- Status
  status shipment_status NOT NULL DEFAULT 'draft',

  -- Shipping Details
  shipping_method shipping_method,  -- sea, air
  origin_country VARCHAR(2),
  destination_country VARCHAR(2) DEFAULT 'AE',

  -- Vessel/Flight
  carrier VARCHAR(255),
  vessel_name VARCHAR(255),
  voyage_number VARCHAR(100),

  -- Dates
  estimated_departure DATE,
  actual_departure DATE,
  estimated_arrival DATE,
  actual_arrival DATE,
  cleared_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  -- Financials
  freight_cost_usd DECIMAL(10,2),
  duty_amount_usd DECIMAL(10,2),
  total_value_usd DECIMAL(10,2),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Shipment Line Items
CREATE TABLE shipment_items (
  id UUID PRIMARY KEY,
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,

  -- Product
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,  -- cases

  -- From Order (optional)
  order_id UUID REFERENCES private_client_orders(id),
  order_item_id UUID,

  -- Values
  unit_price_usd DECIMAL(10,2),
  total_value_usd DECIMAL(10,2),

  -- Customs
  hs_code VARCHAR(20),
  country_of_origin VARCHAR(2),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shipment Documents
CREATE TABLE shipment_documents (
  id UUID PRIMARY KEY,
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,

  -- Document Info
  type document_type NOT NULL,
  name VARCHAR(255) NOT NULL,

  -- Storage
  url TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),

  -- Source
  source document_source NOT NULL,  -- uploaded, generated
  template_id VARCHAR(100),  -- if generated

  -- Verification
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES users(id),

  -- Metadata
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Shipment Tasks
CREATE TABLE shipment_tasks (
  id UUID PRIMARY KEY,
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,

  -- Task Definition
  stage shipment_status NOT NULL,
  type task_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  required BOOLEAN DEFAULT true,

  -- Status
  status task_status DEFAULT 'pending',

  -- Assignment
  assignee_id UUID REFERENCES users(id),
  due_date DATE,

  -- Completion
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),

  -- Linked Document (for upload tasks)
  document_id UUID REFERENCES shipment_documents(id),

  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shipment Timeline (extends activity_logs or separate)
CREATE TABLE shipment_events (
  id UUID PRIMARY KEY,
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,

  -- Event
  event_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,

  -- Context
  old_status shipment_status,
  new_status shipment_status,
  document_id UUID REFERENCES shipment_documents(id),
  task_id UUID REFERENCES shipment_tasks(id),

  -- Actor
  actor_id UUID REFERENCES users(id),
  actor_type actor_type DEFAULT 'user',

  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Enums

```sql
CREATE TYPE shipment_status AS ENUM (
  'draft',
  'confirmed',
  'in_transit',
  'arrived',
  'customs',
  'cleared',
  'warehoused',
  'delivering',
  'delivered',
  'cancelled'
);

CREATE TYPE shipping_method AS ENUM (
  'sea',
  'air'
);

CREATE TYPE document_type AS ENUM (
  'commercial_invoice',
  'packing_list',
  'bill_of_lading',
  'airway_bill',
  'certificate_of_origin',
  'health_certificate',
  'import_permit',
  'customs_declaration',
  'duty_receipt',
  'warehouse_receipt',
  'delivery_note',
  'proof_of_delivery',
  'other'
);

CREATE TYPE document_source AS ENUM (
  'uploaded',
  'generated'
);

CREATE TYPE task_type AS ENUM (
  'document_upload',
  'document_verify',
  'data_entry',
  'approval',
  'external',
  'automated'
);

CREATE TYPE task_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'skipped',
  'blocked'
);
```

---

## UI Design

### Navigation

Add to Admin Nav:
```
Logistics → /platform/admin/logistics
```

Sub-navigation:
- Shipments (list/kanban)
- Documents (all docs across shipments)
- Reports (analytics)

### Shipment List View

Two view modes:

**Table View**
| Reference | Partner | Status | Method | ETA | Items | Value |
|-----------|---------|--------|--------|-----|-------|-------|
| SHP-2024-042 | Domaine X | Customs | Sea | Jan 15 | 24 cases | $12,400 |

**Kanban View**
```
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│  Draft  │ │In Transit│ │ Customs │ │Warehouse│ │Delivered│
├─────────┤ ├─────────┤ ├─────────┤ ├─────────┤ ├─────────┤
│ Card 1  │ │ Card 3  │ │ Card 5  │ │ Card 7  │ │ Card 9  │
│ Card 2  │ │ Card 4  │ │ Card 6  │ │ Card 8  │ │         │
└─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
```

### Shipment Detail View

```
┌──────────────────────────────────────────────────────────────┐
│  SHIPMENT #SHP-2024-0042                          [Actions ▼]│
│  Partner: Domaine Example  •  ETA: Jan 15, 2024              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ○ Draft ── ● Confirmed ── ● In Transit ── ◐ Customs ── ○   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  [Overview] [Items] [Documents] [Tasks] [Timeline]           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  OVERVIEW TAB:                                               │
│  ┌────────────────────┐  ┌────────────────────┐              │
│  │ Shipping Details   │  │ Key Dates          │              │
│  │ Method: Sea        │  │ Departed: Jan 3    │              │
│  │ Carrier: Maersk    │  │ ETA: Jan 15        │              │
│  │ Vessel: MSC Anna   │  │ Cleared: -         │              │
│  └────────────────────┘  └────────────────────┘              │
│                                                              │
│  TASKS (3/5 complete)                                        │
│  ☑ Upload BOL                                                │
│  ☑ Confirm ETA                                               │
│  ☑ Upload Certificate of Origin                              │
│  ☐ Upload Import Permit              ← Next action           │
│  ☐ Pay Duty                                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Mobile Considerations

- Collapsible stage indicator
- Swipeable tabs
- Task completion from list view
- Document upload via camera
- Offline document viewing (PWA consideration)

---

## Integration Points

### File Storage

Use existing file upload infrastructure or:
- Vercel Blob for documents
- Generate signed URLs for secure access

### PDF Generation

Options:
- React PDF (`@react-pdf/renderer`)
- Puppeteer/Playwright for HTML-to-PDF
- External service (e.g., DocRaptor)

### Notifications

Extend existing notification system:
- Status change alerts
- Task due date reminders
- Document verification requests

### External Systems

- Freight forwarder API (tracking) - TBD
- Customs broker integration - TBD
- **Logilize WMS** - Confirmed, contracts signing
- Accounting/ERP export - TBD

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Database schema
- [ ] Basic CRUD for shipments
- [ ] Shipment list view (table)
- [ ] Shipment detail view
- [ ] Manual status updates

### Phase 2: Documents
- [ ] Document upload
- [ ] Document type categorization
- [ ] Document viewer
- [ ] Basic PDF generation (invoice, packing list)

### Phase 3: Tasks
- [ ] Task engine
- [ ] Tasks by stage
- [ ] Task completion workflow
- [ ] Required task validation for stage transitions

### Phase 4: State Machine
- [ ] Formal state transitions
- [ ] Transition guards (required tasks/docs)
- [ ] Automatic status updates
- [ ] Timeline/activity feed

### Phase 5: Visibility
- [ ] Partner shipment view
- [ ] Distributor shipment view
- [ ] Email notifications
- [ ] Dashboard widgets

### Phase 6: Advanced
- [ ] Kanban view
- [ ] Bulk operations
- [ ] Advanced PDF templates
- [ ] Reporting/analytics
- [ ] Mobile optimizations

---

## Open Questions

1. **Scope**
   - PCO orders only, or also B2B?
   - Single orders per shipment, or consolidated?
   - Inbound only, or outbound re-exports?

2. **Documents**
   - Specific regulatory formats required?
   - Document retention requirements?
   - Version control needed?

3. **Access Control**
   - Which roles see which shipments?
   - Can partners create shipments?
   - Distributor visibility level?

4. **Integration**
   - Specific freight forwarders to integrate?
   - Customs broker software?
   - Accounting system export format?

5. **Financial Tracking**
   - Track estimated vs actual costs?
   - Invoice logistics separately?
   - Duty reconciliation workflow?

---

## References

- [Case Management Model and Notation (CMMN)](https://www.omg.org/cmmn/)
- [XState - State Machines for JS](https://xstate.js.org/)
- [Temporal.io - Workflow Engine](https://temporal.io/)

---

## Notes

*Add implementation notes and decisions here as the project progresses.*
