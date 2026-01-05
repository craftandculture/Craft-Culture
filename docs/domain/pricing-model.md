# Pricing Model

> **Status:** Draft - needs review
> **Last Updated:** 2026-01-05

## Overview

Craft & Culture operates three pricing channels for wine distribution into UAE/GCC:

| Channel | Customer Type | Complexity | Use Case |
|---------|--------------|------------|----------|
| **B2B** | Business partners | Simple | Trade partner quotes |
| **PCO** | Private clients | Complex | High-net-worth individual orders |
| **Pocket Cellar** | Consumers | Most complex | B2C marketplace (per-bottle) |

All prices are calculated in **USD** and converted to **AED** for display.

---

## Pricing Philosophy

> "Our objective is to make money, so we will seize opportunities."

- **Margin flexibility:** Different channels allow different margins based on what the market will bear
- **B2C vs B2B:** Consumers (Pocket Cellar) are less price-sensitive than business partners
- **Per-partner customization:** Special relationships warrant custom pricing
- **Bespoke deals:** High-value opportunities may justify unique terms

The system is designed to maximize revenue while remaining competitive in each channel.

---

## The Core Formula Pattern

All margins use **division, not multiplication**:

```
finalPrice = basePrice ÷ (1 - marginPercent ÷ 100)
```

**Why?** This calculates "what price yields X margin when sold" rather than "add X% to cost".

Example with 10% margin on $100:
- ❌ Multiplication: $100 × 1.10 = $110 (margin is 9.09% of final)
- ✅ Division: $100 ÷ 0.90 = $111.11 (margin is exactly 10% of final)

---

## B2B Pricing (Simplest)

**One step:** Apply C&C margin to supplier price.

```
Supplier Price (USD)
       ↓
  ÷ (1 - 5%)
       ↓
Final B2B Price
```

| Variable | Default | Description |
|----------|---------|-------------|
| C&C Margin | 5% | Craft & Culture's margin |

**Example:** $1,000 supplier price → $1,052.63 final (C&C earns $52.63)

<!--
QUESTION FOR KEVIN:
- Is 5% the standard B2B margin?
- Are there cases where this varies by partner or product?
-->

---

## PCO Pricing (7 Steps)

Private Client Orders go through a multi-layer calculation:

```
Supplier Price (USD)
       ↓
[1] C&C Margin (2.5%)          → Landed Duty Free
       ↓
[2] Import Duty (20%)          ─┐
[3] Transfer Cost (0.75%)      ─┼→ Duty Paid Landed
       ↓                        ─┘
[4] Distributor Margin (7.5%)  → After Distributor
       ↓
[5] VAT (5%)                   → Final Price
```

### Default Variables

| Variable | Default | Applied To |
|----------|---------|------------|
| C&C Margin | 2.5% | Supplier price |
| Import Duty | 20% | Landed Duty Free |
| Transfer Cost | 0.75% | Landed Duty Free |
| Distributor Margin | 7.5% | Duty Paid Landed |
| VAT | 5% | After Distributor |

### Worked Example

$150/case supplier price:

| Step | Calculation | Result |
|------|-------------|--------|
| Supplier Price | — | $150.00 |
| C&C Margin (2.5%) | 150 ÷ 0.975 | $153.85 |
| Import Duty (20%) | 153.85 × 0.20 | $30.77 |
| Transfer Cost (0.75%) | 153.85 × 0.0075 | $1.15 |
| Duty Paid Landed | 153.85 + 30.77 + 1.15 | $185.77 |
| Distributor Margin (7.5%) | 185.77 ÷ 0.925 | $200.84 |
| VAT (5%) | 200.84 × 0.05 | $10.04 |
| **Final Price** | 200.84 + 10.04 | **$210.88** |

### What Each Party Sees

**Admin View:** Full breakdown (all margins visible)

**Partner View:** Consolidated (hides C&C margin)
- Subtotal: $153.85 (Landed Duty Free)
- Duty: $30.77
- Logistics: $1.15
- VAT: $10.04
- **Total: $210.88**

<!--
QUESTION FOR KEVIN:
- Is "Landed Duty Free" the correct industry term?
- The partner sees "Subtotal" - should this be labelled differently?
- Transfer Cost shows as "Logistics" to partners - is this correct terminology?
-->

---

## Pocket Cellar Pricing (10 Steps)

B2C consumer pricing adds **per-bottle logistics** and **sales commission**:

```
Supplier Price (USD)
       ↓
[1] C&C Margin (5%)            → After C&C
       ↓
[2] Logistics ($20/bottle air) → Landed Duty Free
       ↓
[3] Import Duty (20%)          ─┐
[4] Transfer Cost (0.75%)      ─┼→ Duty Paid Landed
       ↓                        ─┘
[5] Distributor Margin (7.5%)  → After Distributor
       ↓
[6] Sales Commission (2%)      → Pre-VAT  (paid to sales agent by distributor)
       ↓
[7] VAT (5%)                   → Final Price
```

### Logistics by Product Source

| Source | Per Bottle | Notes |
|--------|------------|-------|
| **Air Freight** | $20 | Fast, higher cost - international products |
| **Ocean Freight** | $5 | Slower, lower cost - bulk shipments |
| **Local Inventory** | $0 | Already in UAE warehouse |

> **Active Volume:** 13,500+ bottles currently on water / inbound via ocean freight.
> Ocean is heavily used for bulk imports - not theoretical.

<!--
QUESTION FOR KEVIN:
- Does logistics cost vary by bottle size (750ml vs 1.5L)?
- Transit time for ocean vs air?
-->

### Worked Example

$100 supplier price, 6-bottle case, air freight:

| Step | Calculation | Result |
|------|-------------|--------|
| Supplier Price | — | $100.00 |
| C&C Margin (5%) | 100 ÷ 0.95 | $105.26 |
| Logistics (air) | 6 × $20 | $120.00 |
| Landed Duty Free | 105.26 + 120 | $225.26 |
| Import Duty (20%) | 225.26 × 0.20 | $45.05 |
| Transfer Cost (0.75%) | 225.26 × 0.0075 | $1.69 |
| Duty Paid Landed | 225.26 + 45.05 + 1.69 | $272.00 |
| Distributor Margin (7.5%) | 272.00 ÷ 0.925 | $294.05 |
| Sales Commission (2%) | 294.05 × 0.02 | $5.88 |
| Pre-VAT | 294.05 + 5.88 | $299.93 |
| VAT (5%) | 299.93 × 0.05 | $15.00 |
| **Final Price** | 299.93 + 15.00 | **$314.93** |
| **Per Bottle** | 314.93 ÷ 6 | **$52.49** |

<!--
ANSWERED:
- Sales commission (2%) - paid to sales agent by distributor
- C&C margin higher for Pocket Cellar (5%) vs PCO (2.5%) - can charge more to B2C consumers
-->

---

## Exchange Rates

| Conversion | Rate | Type |
|------------|------|------|
| GBP → USD | ~1.27 | Floating (needs updates) |
| EUR → USD | ~1.08 | Floating (needs updates) |
| USD → AED | 3.67 | **Fixed** (pegged since 1997) |

- GBP and EUR rates are configurable in admin dashboard
- USD → AED is fixed and won't change
- Can fetch live GBP/EUR rates from external API

<!--
QUESTION FOR KEVIN:
- What's the source for live exchange rates (GBP/EUR)?
- How often should rates be updated?
-->

---

## Pricing Overrides

### Hierarchy (highest priority first)

1. **Order-Level Override** - Bespoke pricing for specific order
2. **Partner-Level Override** - Custom rates for a partner
3. **Global Config** - Database-stored defaults
4. **Hardcoded Defaults** - Fallback if no config exists

### Partner Overrides

Partners can have custom PCO pricing:

- Configured in Admin → Pricing → Partner Bespoke
- Can override any variable (C&C margin, duty, etc.)
- Can be time-limited (effective from/until)
- Leave blank to use global default for that variable

### Order Overrides (Bespoke Pricing)

For **one-off larger orders** requiring custom pricing:

**Typical use case:** Collector moving entire wine collection to UAE (one-time clearance event)

- Set during order approval
- Overrides both partner and global settings
- Marked as "Bespoke" in calculations
- Requires notes for audit trail

<!--
QUESTION FOR KEVIN:
- Who can set bespoke pricing - only admins?
-->

---

## Key Business Terms

| Term | Meaning |
|------|---------|
| **Landed Duty Free (LDF)** | Price after C&C margin, before any UAE costs. Goods are in UAE but duty not yet paid. |
| **Freezone** | UAE tax-free zone where goods arrive and are stored in-bond. No import duty until clearance. |
| **Transfer Cost** | Cost of moving goods from UAE Freezone to Mainland. Import duty is paid upon this clearance. |
| **Duty Paid Landed** | Price after import duty and transfer costs. Goods cleared for mainland UAE. |
| **In-Bond** | Goods held in Freezone warehouse - duty not yet paid, can be re-exported without duty. |

<!--
QUESTION FOR KEVIN:
- Any other terms I should define?
- Which Freezone do you typically use? (JAFZA, DAFZA, etc.)
-->

---

## Summary Comparison

| Aspect | B2B | PCO | Pocket Cellar |
|--------|-----|-----|---------------|
| C&C Margin | 5% | 2.5% | 5% |
| Import Duty | — | 20% | 20% |
| Transfer Cost | — | 0.75% | 0.75% |
| Distributor Margin | — | 7.5% | 7.5% |
| Logistics | — | — | $20/bottle (air) |
| Sales Commission | — | — | 2% (to sales agent) |
| VAT | — | 5% | 5% |
| **Calculation Steps** | 1 | 7 | 10 |

---

## Questions for Review

1. **B2B Margin:** Is 5% standard, or does it vary?
2. ~~**Terminology:** "Landed Duty Free", "Transfer Cost" - correct terms?~~ ✓ Confirmed
3. ~~**Ocean freight:** Is this actually used or just placeholder?~~ ✓ Heavily used - 13,500+ bottles currently inbound
4. ~~**Sales commission:** Who receives this 2%?~~ ✓ Sales agent, paid by distributor
5. ~~**C&C margin difference:** Why 5% for Pocket Cellar vs 2.5% for PCO?~~ ✓ Can charge more to B2C consumers than PCO private clients
6. **Exchange rates:** Source for live GBP/EUR rates? Update frequency?
7. ~~**Bespoke pricing:** When used and approval process?~~ ✓ One-off large orders (e.g., collector moving collection to UAE)
8. ~~**Transfer cost:** What does this physically cover?~~ ✓ Freezone → Mainland movement
9. ~~**AED rate:** Fixed or floating?~~ ✓ Fixed - pegged to USD since 1997

---

## Notes

*Space for additional context after review.*
