# Order Lifecycle

Understanding where your order is in the process.

---

## The Complete Journey

Your order goes through several phases from submission to delivery:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ORDER LIFECYCLE OVERVIEW                            │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │    1     │    │    2     │    │    3     │    │    4     │    │    5     │
  │ SUBMIT   │───▶│ REVIEW   │───▶│ PAYMENT  │───▶│ FULFILL  │───▶│DELIVERED │
  │          │    │          │    │          │    │          │    │          │
  │ You act  │    │ C&C acts │    │ Money    │    │ Shipping │    │ Complete │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
       │               │               │               │               │
       ▼               ▼               ▼               ▼               ▼
    1-2 days       1-3 days       3-10 days       5-21 days         Done!
```

---

## Phase 1: Submission

### What You Do
- Create order with products and client details
- Upload partner invoice
- Click **Submit Order**

### Statuses in This Phase

| Status | Meaning | Your Action |
|--------|---------|-------------|
| **Draft** | Order being created | Complete and submit |
| **Submitted** | Sent to C&C for review | Wait for review |

```
  YOU                                      C&C
   │                                        │
   │  ┌─────────┐                          │
   │  │  DRAFT  │  Creating order...       │
   │  └────┬────┘                          │
   │       │ [Submit]                      │
   │       ▼                               │
   │  ┌───────────┐                        │
   │  │ SUBMITTED │ ─────────────────────▶ │  Received!
   │  └───────────┘                        │
   │                                        │
```

---

## Phase 2: Review

### What Happens
C&C reviews your order for:
- Product availability
- Pricing accuracy
- Client information completeness
- Document verification

### Statuses in This Phase

| Status | Meaning | Your Action |
|--------|---------|-------------|
| **Under C&C Review** | Team is checking order | Wait |
| **Revision Requested** | Changes needed | Edit and resubmit |
| **C&C Approved** | Order accepted | Wait for next phase |

### If Revision is Requested

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠️  REVISION REQUESTED                                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Reason: "Please confirm quantity - client requested 2 cases       │
│           but invoice shows 3 cases"                                │
│                                                                     │
│  [View Order]  [Edit Order]                                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**What to do:**
1. Click **Edit Order**
2. Fix the issue mentioned
3. Add a note explaining the change
4. Click **Resubmit**

---

## Phase 3: Verification (If Required)

Some distributors require client verification. This is an extra step to confirm the client is registered with the distributor.

### Statuses in This Phase

| Status | Meaning | Your Action |
|--------|---------|-------------|
| **Awaiting Partner Verification** | Confirm client is verified | Click "Confirm Verification" |
| **Awaiting Distributor Verification** | Distributor checking | Wait |
| **Verification Suspended** | Issue with verification | Contact C&C support |

### Your Verification Action

```
┌─────────────────────────────────────────────────────────────────────┐
│  VERIFICATION REQUIRED                                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Please confirm that the client "John Smith" is registered          │
│  and verified with the distributor.                                 │
│                                                                     │
│  Client: John Smith                                                 │
│  Email: john.smith@email.com                                        │
│  Phone: +971 50 123 4567                                            │
│                                                                     │
│  ☐ I confirm this client is verified with the distributor          │
│                                                                     │
│  [Confirm Verification]                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 4: Payment

Money flows through the chain. You'll see the order progress through payment statuses.

### Payment Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PAYMENT FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────┘

  CLIENT              DISTRIBUTOR              C&C               YOU (PARTNER)
     │                     │                    │                      │
     │  Pays invoice       │                    │                      │
     │ ──────────────────▶ │                    │                      │
     │                     │  Pays C&C          │                      │
     │                     │ ─────────────────▶ │                      │
     │                     │                    │  Pays you            │
     │                     │                    │ ───────────────────▶ │
     │                     │                    │                      │
     │                     │                    │                   💰 │
```

### Statuses in This Phase

| Status | What's Happening | Your Action |
|--------|------------------|-------------|
| **Awaiting Client Payment** | Distributor collecting from client | Wait |
| **Client Paid** | Client has paid distributor | Wait |
| **Awaiting Distributor Payment** | Distributor paying C&C | Wait |
| **Distributor Paid** | C&C received payment | Wait |
| **Awaiting Partner Payment** | C&C preparing your payment | Wait |
| **Partner Paid** | 💰 You received payment! | Complete |

### When Do You Get Paid?

You receive payment from C&C after the distributor has paid. This typically happens:
- **Standard:** 7-14 days after client payment
- **Faster:** Once stock is confirmed delivered

---

## Phase 5: Fulfillment & Delivery

The wine is shipped and delivered to the client.

### Delivery Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FULFILLMENT FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌──────────┐
  │  SCHEDULING │      │   STOCK     │      │    WITH     │      │DELIVERED │
  │  DELIVERY   │─────▶│ IN TRANSIT  │─────▶│ DISTRIBUTOR │─────▶│          │
  └─────────────┘      └─────────────┘      └─────────────┘      └──────────┘
        │                    │                    │                    │
        ▼                    ▼                    ▼                    ▼
   Distributor          Wine shipping        Arrived at           Client
   contacts client      to UAE               distributor          received
```

### Statuses in This Phase

| Status | What's Happening | Your Action |
|--------|------------------|-------------|
| **Scheduling Delivery** | Distributor contacting client | Wait |
| **Delivery Scheduled** | Date confirmed with client | Wait |
| **Stock In Transit** | Wine shipping to UAE | Ship stock (if airfreight) |
| **With Distributor** | Stock at distributor warehouse | Wait |
| **Out For Delivery** | Driver dispatched | Wait |
| **Delivered** | ✓ Client received wine | Complete! |

### If You're Shipping (Airfreight)

If the order uses **partner_airfreight**, you need to ship the wine:

1. You'll receive notification when order reaches "Stock In Transit"
2. Ship to the designated UAE address
3. Provide tracking information
4. Update stock status in the platform

---

## Order Status Summary

### All Statuses at a Glance

| Phase | Status | You Act? | Typical Duration |
|-------|--------|----------|------------------|
| Submit | Draft | ✓ Create | - |
| Submit | Submitted | - | < 1 day |
| Review | Under C&C Review | - | 1-3 days |
| Review | Revision Requested | ✓ Fix | Depends on you |
| Review | C&C Approved | - | < 1 day |
| Verify | Awaiting Partner Verification | ✓ Confirm | < 1 day |
| Verify | Awaiting Distributor Verification | - | 1-3 days |
| Payment | Awaiting Client Payment | - | 1-7 days |
| Payment | Client Paid | - | < 1 day |
| Payment | Awaiting Distributor Payment | - | 3-7 days |
| Payment | Distributor Paid | - | < 1 day |
| Payment | Awaiting Partner Payment | - | 1-3 days |
| Payment | Partner Paid | - | < 1 day |
| Fulfill | Scheduling Delivery | - | 1-3 days |
| Fulfill | Delivery Scheduled | - | < 1 day |
| Fulfill | Stock In Transit | ✓ (if airfreight) | 3-14 days |
| Fulfill | With Distributor | - | 1-3 days |
| Fulfill | Out For Delivery | - | < 1 day |
| Fulfill | Delivered | - | Complete |
| - | Cancelled | - | Terminal |

---

## Status Colors

In the platform, statuses are color-coded:

| Color | Meaning |
|-------|---------|
| 🔵 Blue | In progress, waiting |
| 🟡 Yellow | Action needed from you |
| 🟢 Green | Complete / Success |
| 🔴 Red | Issue / Cancelled |

---

## Tracking Your Orders

### Order List View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MY ORDERS                                              [+ New Order]       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────┬─────────────────────┬───────────────────┬──────────┬────────┐ │
│  │ Order # │ Client              │ Status            │ Total    │ Date   │ │
│  ├─────────┼─────────────────────┼───────────────────┼──────────┼────────┤ │
│  │ PCO-042 │ John Smith          │ 🟡 Revision Req.  │ $1,965   │ Jan 5  │ │
│  │ PCO-041 │ Sarah Johnson       │ 🔵 Client Paid    │ $3,420   │ Jan 3  │ │
│  │ PCO-040 │ Mike Williams       │ 🟢 Delivered      │ $890     │ Dec 28 │ │
│  │ PCO-039 │ Emma Davis          │ 🔵 In Transit     │ $2,150   │ Dec 20 │ │
│  └─────────┴─────────────────────┴───────────────────┴──────────┴────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Filtering Orders

Filter by:
- **Status** - See only orders in specific phase
- **Date Range** - Orders from specific period
- **Client** - Search by client name

---

## Notifications

You'll receive notifications when:

| Event | Notification |
|-------|--------------|
| Order approved | "Order #PCO-042 has been approved" |
| Revision requested | "Order #PCO-042 needs revision" |
| Verification needed | "Please verify client for Order #PCO-042" |
| Payment received | "Payment received for Order #PCO-042" |
| Order delivered | "Order #PCO-042 has been delivered" |

Check your notification preferences in **Settings** to choose email vs. in-app notifications.
