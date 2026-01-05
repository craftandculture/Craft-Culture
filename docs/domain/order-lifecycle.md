# Order Lifecycle

> **Status:** Draft - needs review
> **Last Updated:** 2026-01-05

## Overview

Two main flows in the platform:

| Flow | Channel | Description |
|------|---------|-------------|
| **B2B Quote** | Business | Partner creates quote → client accepts → becomes order |
| **PCO (Private Client Order)** | Private | Partner submits order → C&C reviews → distributor fulfills |

---

## B2B Quote Flow

```
draft → sent → accepted/rejected/expired
              ↓
        buy_request_submitted → under_cc_review → cc_confirmed
                                      ↓
                              revision_requested
```

### Statuses

| Status | Who Acts | What Happens |
|--------|----------|--------------|
| `draft` | Partner | Building the quote |
| `sent` | Partner | Quote sent to client |
| `accepted` | Client | Client accepts quote |
| `rejected` | Client | Client declines |
| `expired` | System | Quote validity period ended |
| `buy_request_submitted` | Partner | Partner submits to C&C to execute |
| `under_cc_review` | C&C Admin | C&C reviewing the buy request |
| `revision_requested` | C&C Admin | Changes needed |
| `cc_confirmed` | C&C Admin | Order confirmed, ready to execute |

<!--
QUESTION FOR KEVIN:
- What happens after cc_confirmed? Does it become a PCO order?
- Or is B2B fulfillment separate from PCO?
-->

---

## PCO (Private Client Order) Flow

This is the main order flow for private clients.

```
┌─────────────────────────────────────────────────────────────────────┐
│  SUBMISSION                                                         │
│  draft → submitted → under_cc_review → cc_approved                  │
│                            ↓                                        │
│                     revision_requested                              │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  VERIFICATION (optional - some distributors only)                   │
│  awaiting_partner_verification → awaiting_distributor_verification  │
│                                          ↓                          │
│                                  verification_suspended             │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  PAYMENT                                                            │
│  awaiting_client_payment → client_paid → awaiting_distributor_payment│
│                                     → distributor_paid               │
│                                     → awaiting_partner_payment       │
│                                     → partner_paid                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  DELIVERY SCHEDULING                                                │
│  scheduling_delivery → delivery_scheduled                           │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  FULFILLMENT                                                        │
│  stock_in_transit → with_distributor → out_for_delivery → delivered │
└─────────────────────────────────────────────────────────────────────┘
```

### PCO Statuses - Detailed

#### Submission Phase

| Status | Who Acts | What Happens | Next |
|--------|----------|--------------|------|
| `draft` | Partner | Building the order | → submitted |
| `submitted` | Partner | Order submitted to C&C | → under_cc_review |
| `under_cc_review` | C&C Admin | Reviewing order, checking stock | → cc_approved or revision_requested |
| `revision_requested` | C&C Admin | Issues found, partner must fix | → submitted |
| `cc_approved` | C&C Admin | Order approved, ready for next phase | → verification or payment |

<!--
QUESTION FOR KEVIN:
- What does C&C check during review? Stock? Pricing? Client validity?
-->

#### Verification Phase (Optional)

| Status | Who Acts | What Happens | Next |
|--------|----------|--------------|------|
| `awaiting_partner_verification` | Partner | Partner confirms client is verified | → awaiting_distributor_verification |
| `awaiting_distributor_verification` | Distributor | Distributor checks client in their system | → payment phase |
| `verification_suspended` | Distributor | Client verification failed | Partner resolves |

<!--
QUESTION FOR KEVIN:
- Which distributors require verification? (City Drinks mentioned in code)
- What does "verified" mean? KYC? Credit check? License?
-->

#### Payment Phase

| Status | Who Acts | What Happens | Next |
|--------|----------|--------------|------|
| `awaiting_client_payment` | Distributor | Collecting payment from end client | → client_paid |
| `client_paid` | Distributor | Client paid, distributor raises PO to C&C | → awaiting_distributor_payment |
| `awaiting_distributor_payment` | Distributor | Distributor pays C&C | → distributor_paid |
| `distributor_paid` | Distributor | C&C received payment from distributor | → awaiting_partner_payment |
| `awaiting_partner_payment` | C&C Admin | C&C pays partner/supplier | → partner_paid |
| `partner_paid` | C&C Admin | Partner/supplier paid | → scheduling |

<!--
QUESTION FOR KEVIN:
- Is the payment sequence always: Client → Distributor → C&C → Partner?
- Or can payments happen in parallel?
- When does C&C actually receive the wine? Before or after payment?
-->

#### Delivery Scheduling Phase

| Status | Who Acts | What Happens | Next |
|--------|----------|--------------|------|
| `scheduling_delivery` | Distributor | Contacting client for delivery time | → delivery_scheduled |
| `delivery_scheduled` | Distributor | Delivery date confirmed with client | → fulfillment |

#### Fulfillment Phase

| Status | Who Acts | What Happens | Next |
|--------|----------|--------------|------|
| `stock_in_transit` | C&C/Logistics | Wine being shipped to UAE | → with_distributor |
| `with_distributor` | Distributor | Stock received at distributor warehouse | → out_for_delivery |
| `out_for_delivery` | Distributor | Driver dispatched | → delivered |
| `delivered` | Distributor | Client received wine | Complete |
| `cancelled` | Any | Order cancelled | Terminal |

---

## Order Item Stock Status

Individual line items have their own stock tracking:

| Status | Meaning |
|--------|---------|
| `pending` | Stock not yet confirmed |
| `confirmed` | Stock available/allocated |
| `in_transit_to_cc` | Shipping to C&C warehouse |
| `at_cc_bonded` | At C&C bonded warehouse (Freezone) |
| `at_distributor` | Transferred to distributor |
| `delivered` | Delivered to client |

---

## Order Item Source

Where the wine comes from:

| Source | Meaning |
|--------|---------|
| `partner_local` | Partner has stock locally |
| `partner_airfreight` | Partner ships via air |
| `cc_inventory` | C&C has stock in warehouse |
| `manual` | Manually entered |

---

## Documents

Documents attached to orders:

| Type | Who Uploads | When |
|------|-------------|------|
| `partner_invoice` | Partner | Order submission |
| `cc_invoice` | C&C Admin | After approval |
| `distributor_invoice` | Distributor | For client |
| `payment_proof` | Various | Payment confirmation |

---

## Key Parties

| Party | Role in PCO |
|-------|-------------|
| **Partner** | Wine company/supplier - submits orders |
| **C&C Admin** | Reviews, approves, manages logistics |
| **Distributor** | Licensed UAE distributor - handles client relationship, delivery |
| **Private Client** | End customer receiving wine |

<!--
QUESTION FOR KEVIN:
- Who are the main distributors? (City Drinks mentioned)
- Do partners ever deliver directly, or always through distributor?
- What's the relationship between Partner and C&C? Commission? Markup?
-->

---

## Questions for Review

1. What does C&C check during `under_cc_review`?
2. Which distributors require verification? What is "verified"?
3. Payment sequence - always linear or can be parallel?
4. When does physical wine arrive relative to payment?
5. Who are the main distributors?
6. Can partners deliver directly without distributor?
7. How does B2B quote flow connect to PCO (if at all)?

---

## Notes

*Space for additional context after review.*
