# Quote Workflow Notifications

This document outlines all email notifications in the quote approval workflow. All notifications use [Loops](https://loops.so) for transactional email delivery.

## 📧 Complete Notification Flow

### 1. Customer Submits Buy Request
**Trigger**: Customer clicks "Submit Order Request" on a draft quote
**Status Change**: `draft` → `buy_request_submitted`
**Notification**: `notifyAdminsOfBuyRequest`
**Recipients**: All admin users
**Template ID**: `quote-buy-request-submitted`

**Email Variables**:
- `adminName` - Name of the admin receiving the notification
- `quoteName` - Name of the quote
- `quoteId` - UUID of the quote
- `customerName` - Name of customer who submitted
- `customerEmail` - Email of customer
- `totalUsd` - Quote total in USD
- `submittedDate` - Date submitted
- `reviewUrl` - Direct link to review the quote in admin panel

**Action Required**: Admin needs to start review

---

### 2. Admin Starts Review
**Trigger**: Admin clicks "Start Review" in admin approval dialog
**Status Change**: `buy_request_submitted` → `under_cc_review`
**Notification**: `notifyUserOfReviewStart`
**Recipients**: Quote owner (customer)
**Template ID**: `quote-review-started`

**Email Variables**:
- `userName` - Customer's name
- `quoteName` - Name of the quote
- `quoteId` - UUID of the quote
- `reviewStartedDate` - Date review started
- `quoteUrl` - Link to view quote status
- `ccNotes` - Optional notes from admin

**Customer Info**: "Your quote is being reviewed by our team"

---

### 3a. Admin Confirms Quote
**Trigger**: Admin clicks "Confirm Quote" after review
**Status Change**: `under_cc_review` → `cc_confirmed`
**Notification**: `notifyUserOfQuoteConfirmation`
**Recipients**: Quote owner (customer)
**Template ID**: `quote-confirmed-by-cc`

**Email Variables**:
- `userName` - Customer's name
- `quoteName` - Name of the quote
- `quoteId` - UUID of the quote
- `totalUsd` - Final confirmed total (with admin adjustments)
- `ccConfirmationNotes` - Optional notes from admin
- `confirmedDate` - Date confirmed
- `quoteUrl` - Link to view confirmed quote

**Action Required**: Customer needs to submit PO

---

### 3b. Admin Requests Revision
**Trigger**: Admin clicks "Request Revision" during review
**Status Change**: `under_cc_review` → `revision_requested`
**Notification**: `notifyUserOfRevisionRequest`
**Recipients**: Quote owner (customer)
**Template ID**: `quote-revision-requested`

**Email Variables**:
- `userName` - Customer's name
- `quoteName` - Name of the quote
- `quoteId` - UUID of the quote
- `revisionReason` - Reason for revision (from admin)
- `requestedDate` - Date revision was requested
- `quoteUrl` - Link to edit the quote

**Action Required**: Customer needs to revise and resubmit

---

### 4. Customer Submits PO
**Trigger**: Customer uploads PO document and clicks "Submit PO"
**Status Change**: `cc_confirmed` → `po_submitted`
**Notification**: `notifyAdminsOfPOSubmission`
**Recipients**: All admin users
**Template ID**: `po-submitted`

**Email Variables**:
- `adminName` - Name of the admin receiving notification
- `quoteName` - Name of the quote
- `quoteId` - UUID of the quote
- `customerName` - Name of customer
- `poNumber` - PO number from customer
- `poAttachmentUrl` - URL to download PO document
- `totalUsd` - Order total
- `submittedDate` - Date PO submitted
- `reviewUrl` - Link to admin panel to confirm PO

**Action Required**: Admin needs to confirm PO and provide delivery time

---

### 5. Admin Confirms PO
**Trigger**: Admin provides delivery lead time and clicks "Confirm PO"
**Status Change**: `po_submitted` → `po_confirmed`
**Notification**: `notifyUserOfPOConfirmation`
**Recipients**: Quote owner (customer)
**Template ID**: `po-confirmed`

**Email Variables**:
- `userName` - Customer's name
- `quoteName` - Name of the quote
- `quoteId` - UUID of the quote
- `poNumber` - Customer's PO number
- `deliveryLeadTime` - Estimated delivery time from admin
- `poConfirmationNotes` - Optional notes from admin
- `confirmedDate` - Date PO confirmed
- `quoteUrl` - Link to view order

**Customer Info**: "Your order is confirmed and will be delivered in X time"

---

## 🔧 Setting Up Loops Templates

You need to create these 6 email templates in your Loops dashboard:

1. **quote-buy-request-submitted** - For admins when customer submits request
2. **quote-review-started** - For customers when admin starts review
3. **quote-confirmed-by-cc** - For customers when quote is confirmed
4. **quote-revision-requested** - For customers when revision needed
5. **po-submitted** - For admins when customer submits PO
6. **po-confirmed** - For customers when PO is confirmed

### Template Creation Steps:

1. Go to [Loops Dashboard](https://app.loops.so)
2. Navigate to Transactional > Templates
3. Create new template for each notification
4. Use the Template ID exactly as shown above
5. Add data variables from the lists above
6. Design email with your branding
7. Test with sample data
8. Publish template

---

## 📊 Notification Summary

| Event | Status Transition | Who Gets Notified | Template ID | Action Required |
|-------|------------------|-------------------|-------------|-----------------|
| Customer submits request | `draft` → `buy_request_submitted` | **Admins** | `quote-buy-request-submitted` | Admin: Start review |
| Admin starts review | `buy_request_submitted` → `under_cc_review` | **Customer** | `quote-review-started` | None (informational) |
| Admin confirms quote | `under_cc_review` → `cc_confirmed` | **Customer** | `quote-confirmed-by-cc` | Customer: Submit PO |
| Admin requests revision | `under_cc_review` → `revision_requested` | **Customer** | `quote-revision-requested` | Customer: Revise quote |
| Customer submits PO | `cc_confirmed` → `po_submitted` | **Admins** | `po-submitted` | Admin: Confirm PO |
| Admin confirms PO | `po_submitted` → `po_confirmed` | **Customer** | `po-confirmed` | None (order complete) |

---

## 🛠️ Implementation Details

### Code Location
- **Notification utilities**: `/apps/web/src/app/_quotes/utils/notify*.ts`
- **Controllers**: `/apps/web/src/app/_quotes/controller/quotes*.ts`

### Email Service
- **Provider**: Loops (https://loops.so)
- **Client**: `/apps/web/src/lib/loops/client.ts`
- **Server Config**: `/apps/web/src/server.config.ts` (for app URLs)

### Notification Pattern
All notifications use the "fire and forget" pattern:
```typescript
// Send notification (fire and forget)
const { default: notifyFunction } = await import('../utils/notifyFunction');
notifyFunction(updatedQuote).catch((error) =>
  console.error('Failed to send notification:', error),
);
```

This ensures that notification failures don't block the main workflow.

---

## ✅ Testing Notifications

1. **Development**: Check console logs for `logger.dev()` messages
2. **Staging**: Verify emails are sent to test addresses
3. **Production**: Monitor Loops dashboard for delivery status

### Test Checklist
- [ ] Admins receive notification when customer submits request
- [ ] Customer receives notification when review starts
- [ ] Customer receives confirmation with adjusted prices
- [ ] Customer receives revision request with reason
- [ ] Admins receive notification when PO submitted
- [ ] Customer receives PO confirmation with delivery time
- [ ] All email links work correctly
- [ ] Email variables populate correctly
- [ ] Emails match brand styling

---

## 🔍 Troubleshooting

### Notification Not Received
1. Check Loops dashboard for delivery status
2. Verify template ID matches exactly
3. Check spam/junk folders
4. Verify email address is correct
5. Check server logs for errors

### Email Variables Not Populating
1. Verify variable names match template
2. Check data being passed to Loops
3. Ensure quote object has required fields

### Admin Users Not Found
- Verify users have `role: 'admin'` in database
- Check database query in notification utility

---

## 📝 Future Enhancements

- [ ] In-app notifications (bell icon)
- [ ] SMS notifications for urgent actions
- [ ] Slack integration for admin team
- [ ] Webhook notifications for external systems
- [ ] Notification preferences per user
- [ ] Digest emails (daily summary)

---

## 🔐 Environment Variables

Required in `.env.local`:
```env
LOOPS_API_KEY=your_loops_api_key
NEXT_PUBLIC_APP_URL=https://your-domain.com
```
