# SOURCE Module UX Redesign Plan

## Current Problems
1. Wasted vertical space - only ~10 items visible at once
2. No bottle/case quantity toggle on input
3. Manual selection only - no bulk actions
4. No PO generation for partners
5. Limited export options

---

## Input Side Enhancements

### 1. Quantity Unit Toggle
```
Requested: [12] [bottles ▼]  →  converts to cases based on case config
           [2]  [cases ▼]    →  displays bottle equivalent
```

### 2. Case Configuration
- Standard options: 1, 3, 6, 12, 24 bottles/case
- Custom entry for bespoke configs
- Auto-calculate total bottles from cases or vice versa

### 3. Compact Item Entry
- Inline editing (no modals)
- Tab through fields
- Paste from Excel support

---

## Comparison Table Redesign

### Layout: Dense Spreadsheet View
```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Auto-select Best] [Select All Cult] [Clear All]  Progress: 12/50 ████░ │
├─────────────────────────────────────────────────────────────────────────┤
│ PRODUCT                          QTY    PARTNER A   PARTNER B   FINAL   │
├─────────────────────────────────────────────────────────────────────────┤
│ Montrachet 2022 · Montille       6cs    $111 ✓      $125        $111    │
│ Barolo 2016 · Pio Cesare         6cs    $111        N/A         -       │
│ Pape-Clément 2012                6cs    $110 ✓      $118        $115    │
│ Clinet 2018 · Pomerol            6cs    -           $95 ✓       $95     │
│ ...40 more rows...                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Features

#### 1. Compact Rows (24px height)
- Single line per item
- Product: Name · Producer · Vintage (truncated)
- Qty: Number + unit badge (cs/bt)
- Prices: Colored cells (green=best, red=highest)

#### 2. Sticky Headers
- Column headers stay visible on scroll
- Partner names always visible

#### 3. Keyboard Navigation
- ↑↓ = Navigate rows
- ←→ = Navigate partner columns
- Enter/Space = Select quote
- B = Select best price for row
- Tab = Next unselected item

#### 4. Bulk Actions
- **Auto-select Best**: One click selects cheapest for all items
- **Select All from Partner**: Assign all to one partner
- **Clear Selection**: Reset all selections
- **Reassign N/A Items**: Move to different partner

#### 5. Progress Indicator
- "12 of 50 items selected"
- Visual progress bar
- Filter: Show only unselected

#### 6. Inline Price Adjustment
- Click final price to edit
- Shows margin calculation
- Audit trail of changes

---

## Output Side: Export Options

### 1. Client Quote (existing)
- **PDF**: Professional quote for B2B distributor
- **Excel**: Detailed breakdown with pricing

### 2. Partner Purchase Orders (NEW)
Generate PO for each winning partner:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PURCHASE ORDER                                │
│                    Craft & Culture                               │
├─────────────────────────────────────────────────────────────────┤
│ TO: Cult Wines                    PO#: PO-2026-0042             │
│     contact@cultwines.com         Date: 09 Jan 2026             │
│                                   Delivery: 15 Jan 2026         │
├─────────────────────────────────────────────────────────────────┤
│ Re: RFQ SRC-2026-0001 - [Client Name]                           │
├─────────────────────────────────────────────────────────────────┤
│ PRODUCT                          QTY     PRICE/CS    TOTAL      │
│ Montrachet 2022 · Montille       6 cs    $111.00     $666.00    │
│ Barolo 2016 · Pio Cesare         6 cs    $111.00     $666.00    │
│ Chateau Palmer 2020              6 cs    $111.00     $666.00    │
├─────────────────────────────────────────────────────────────────┤
│                                  SUBTOTAL:           $1,998.00  │
│                                  TOTAL:              $1,998.00  │
├─────────────────────────────────────────────────────────────────┤
│ Delivery Instructions:                                          │
│ [Delivery address / Ex-works collection details]                │
│                                                                  │
│ Payment Terms: [30 days net / As agreed]                        │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Partner Confirmation Email
- Notify winning partners automatically
- Include PO as attachment
- Request delivery confirmation

### 4. Internal Summary
- Total cost breakdown by partner
- Margin analysis
- Items not sourced (for follow-up)

---

## Export Actions UI

```
┌──────────────────────────────────────────────────────────────┐
│ Generate Outputs                                              │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ CLIENT QUOTE                                                  │
│ ┌──────────────┐  ┌──────────────┐                           │
│ │ 📄 PDF       │  │ 📊 Excel     │                           │
│ │ Download     │  │ Download     │                           │
│ └──────────────┘  └──────────────┘                           │
│                                                               │
│ PARTNER ORDERS                                                │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ ☑ Cult Wines (6 items, $1,998)      [📄 PO] [✉️ Send]   │  │
│ │ ☑ Berry Bros (3 items, $850)        [📄 PO] [✉️ Send]   │  │
│ │ ☐ Justerini & Brooks (0 items)      No items selected   │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 📨 Send All POs to Partners                            │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Database Changes Needed

### New Table: `source_rfq_purchase_orders`
```sql
- id, rfq_id, partner_id
- po_number (PO-2026-0042)
- status (draft, sent, confirmed, cancelled)
- sent_at, confirmed_at
- delivery_date, delivery_instructions
- payment_terms
- total_amount_usd
- pdf_url (stored in S3/Vercel Blob)
```

### New Table: `source_rfq_po_items`
```sql
- id, po_id, rfq_item_id, quote_id
- quantity, unit_price, line_total
```

---

## Implementation Phases

### Phase 1: Compact Table
- [ ] Redesign comparison table (dense rows)
- [ ] Add sticky headers
- [ ] Add progress indicator
- [ ] Add bulk action buttons

### Phase 2: Keyboard & Selection
- [ ] Keyboard navigation
- [ ] Auto-select best prices
- [ ] Filter by selection status

### Phase 3: Input Improvements
- [ ] Bottle/case quantity toggle
- [ ] Case config on items

### Phase 4: Partner PO System
- [ ] PO generation logic
- [ ] PO PDF template
- [ ] Email sending to partners
- [ ] PO status tracking

### Phase 5: IMPORT Integration
- [ ] Link to IMPORT module
- [ ] Track incoming inventory
- [ ] Match deliveries to POs

---

## Color Coding Reference

| State | Background | Text | Border |
|-------|------------|------|--------|
| Best Price | `bg-green-50` | `text-green-700` | - |
| Highest Price | `bg-red-50` | `text-red-600` | - |
| Selected | `bg-brand/10` | - | `border-brand` |
| N/A | `bg-red-50` | `text-red-500` | - |
| No Quote | `bg-gray-50` | `text-gray-400` | - |
