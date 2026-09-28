# Creating Orders (PCO)

Private Client Orders (PCO) are for individual consumers who want to purchase wine for personal use in the UAE.

---

## Order Creation Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CREATING A NEW ORDER                            │
└─────────────────────────────────────────────────────────────────────┘

    Step 1              Step 2              Step 3              Step 4
 ┌──────────┐       ┌──────────┐       ┌──────────┐       ┌──────────┐
 │  Start   │       │  Add     │       │  Client  │       │  Review  │
 │  Order   │──────▶│ Products │──────▶│  Details │──────▶│ & Submit │
 │          │       │          │       │          │       │          │
 └──────────┘       └──────────┘       └──────────┘       └──────────┘
                                                                │
                                                                ▼
                                                          ┌──────────┐
                                                          │  Done!   │
                                                          │ Submitted│
                                                          └──────────┘
```

---

## Step 1: Start a New Order

1. Go to **Orders** in the main menu
2. Click **+ New Order**
3. You'll see a blank order form

---

## Step 2: Add Products

### From Your Catalog

1. Click **Add Product**
2. Search or browse your product catalog
3. Select the wine(s) you want to add
4. Enter quantity (number of cases)
5. Click **Add to Order**

```
┌─────────────────────────────────────────────────────────────────────┐
│  ADD PRODUCT                                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Search: [Chateau Margaux________________] [Search]                 │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Chateau Margaux 2018                                       │   │
│  │  750ml · 12 bottles per case                                │   │
│  │  Price: $450.00/case                                        │   │
│  │                                                             │   │
│  │  Quantity: [___2___] cases          [Add to Order]          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Product Information Shown

| Field | Description |
|-------|-------------|
| **Name** | Wine name and vintage |
| **Size** | Bottle size (750ml, 1.5L, etc.) |
| **Pack** | Bottles per case (6, 12, etc.) |
| **Price** | Your price per case (Landed Duty Free) |

### Special Requests

Need a product not in your catalog? Use the **Request Product** option to describe what your client needs. Our team will source it for you.

---

## Step 3: Client Details

Enter information about the end client:

| Field | Required | Description |
|-------|----------|-------------|
| **Client Name** | Yes | Full name of the recipient |
| **Email** | Yes | Client's email address |
| **Phone** | Yes | UAE phone number |
| **Delivery Address** | Yes | Full delivery address in UAE |
| **Notes** | No | Special instructions |

```
┌─────────────────────────────────────────────────────────────────────┐
│  CLIENT DETAILS                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Client Name:     [John Smith_______________________________]       │
│                                                                     │
│  Email:           [john.smith@email.com_____________________]       │
│                                                                     │
│  Phone:           [+971 50 123 4567_________________________]       │
│                                                                     │
│  Delivery Address:                                                  │
│  [Villa 42, Palm Jumeirah                                  ]       │
│  [Dubai, UAE                                               ]       │
│                                                                     │
│  Notes (optional):                                                  │
│  [Call before delivery. Gate code: 1234                    ]       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Step 4: Review & Submit

Before submitting, review your order:

### Order Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│  ORDER SUMMARY                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PRODUCTS                                                           │
│  ────────────────────────────────────────────────────────────────── │
│  Chateau Margaux 2018 (12×750ml)     2 cases      $900.00          │
│  Opus One 2019 (6×750ml)             1 case       $650.00          │
│                                                                     │
│  ────────────────────────────────────────────────────────────────── │
│  Subtotal (Landed Duty Free)                      $1,550.00        │
│  Import Duty (20%)                                  $310.00        │
│  Logistics                                           $11.63        │
│  VAT (5%)                                            $93.58        │
│  ────────────────────────────────────────────────────────────────── │
│  TOTAL                                            $1,965.21        │
│                                                                     │
│  CLIENT: John Smith                                                 │
│  DELIVERY: Villa 42, Palm Jumeirah, Dubai                          │
│                                                                     │
│                                              [Submit Order]         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### What You See vs. Client Price

| Line Item | Description |
|-----------|-------------|
| **Subtotal** | Your Landed Duty Free price |
| **Import Duty** | UAE import tax (20%) |
| **Logistics** | Transfer from Freezone to Mainland |
| **VAT** | UAE Value Added Tax (5%) |
| **Total** | Final price to client |

### Upload Documents

Before submitting, you may need to upload:
- Partner Invoice (your invoice to C&C)

---

## After Submission

Once you click **Submit Order**:

1. Order status changes to **Submitted**
2. C&C team receives notification
3. Order enters review queue
4. You'll be notified of any updates

**What happens next?** See [Order Lifecycle](./03-order-lifecycle.md) for the complete journey.

---

## Saving Drafts

Not ready to submit? Your order is automatically saved as a **Draft**.

- Drafts appear in your Orders list
- You can edit and complete them later
- Drafts are not visible to C&C until submitted

---

## Subscription Boxes (Club Partners)

If you run a monthly subscription club, your account can be switched on for **subscription boxes**. You then build one order per box each month and copy it for every member on that box, instead of entering each member's order separately. Ask C&C to enable it.

### 1. Build one order per box

Create a normal order for each box you're sending this month, e.g. *Discovery 3 · Mix*, *Discovery 6*, *Collector 3*. Use any member of that box as the client. Get the wines, quantities and prices right: this is the only order per box you need to check line by line.

### 2. Tag it with its box

On the order page, in the **Subscription box** card:

- **Tier:** Discovery or The Collector
- **Case:** 3 or 6
- **Variant:** Mix, B and B, or **New variant…** to type your own

Click **Save**. The card then shows your **club price next to this order's client total**. If the line is amber, the box costs noticeably more or less than you charge members, so adjust the wines before copying it.

### 3. Clone it for your members

Click **Clone for clients** at the top of the order.

- **Left:** tick your members (search by name, email or phone, or **Select all**). For someone new, click **Add clients not on the list** and paste one per line as `Name, email, phone`; they are saved to your clients for next month.
- **Right:** check the box is the right number of bottles, and that every wine shows a ✓ (enough stock) rather than **Short**.
- Members who already have this box in the last few weeks are greyed out, so nobody gets two.

Click **Create N draft orders**. Each member gets their own draft order with the same wines, prices and box tag.

### 4. Submit

Open any member who needs a swap (e.g. no white) and edit their order. Then **Submit for Review** on each order as usual. C&C reviews them and takes care of invoicing and fulfilment.

**Tip:** On your order list, every order shows its box tag, so you can see at a glance that each member on a box has an order this month.

---

## Tips for Faster Approval

1. **Complete all fields** - Missing information causes delays
2. **Double-check quantities** - Confirm case counts with your client
3. **Verify client contact** - Ensure phone/email are correct
4. **Add delivery notes** - Special access instructions help delivery
5. **Upload invoices promptly** - Required documents speed up review
