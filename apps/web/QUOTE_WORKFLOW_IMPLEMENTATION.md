# Quote Approval Workflow Implementation

This document describes the new quote approval workflow that has been implemented in the Craft & Culture platform.

## Overview

The quote approval workflow allows users to submit buy requests for quotes, which are then reviewed and confirmed by the C&C team before proceeding to purchase order submission and final confirmation.

## Workflow States

### State Diagram

```
draft → sent → buy_request_submitted → under_cc_review → cc_confirmed → po_submitted → po_confirmed
                                              ↓              ↑
                                       revision_requested ──┘
```

### Status Descriptions

1. **draft** - Quote is being created
2. **sent** - Quote has been sent to client
3. **buy_request_submitted** - User has submitted the quote for C&C approval
4. **under_cc_review** - C&C is actively reviewing and checking with suppliers
5. **revision_requested** - C&C needs changes or wants to offer alternatives
6. **cc_confirmed** - C&C has confirmed availability and pricing
7. **po_submitted** - User has submitted a purchase order
8. **po_confirmed** - Final confirmation - order is complete

## Database Changes

### New Enum Values

Added to `quote_status` enum:
- `buy_request_submitted`
- `under_cc_review`
- `revision_requested`
- `cc_confirmed`
- `po_submitted`
- `po_confirmed`

### New Columns on `quotes` Table

**Buy Request Tracking:**
- `buyRequestSubmittedAt` (timestamp)
- `buyRequestSubmittedBy` (uuid, references users)
- `buyRequestCount` (integer, default 0)

**C&C Review Tracking:**
- `ccReviewStartedAt` (timestamp)
- `ccReviewedBy` (uuid, references users)
- `ccNotes` (text)

**Revision Tracking:**
- `revisionRequestedAt` (timestamp)
- `revisionRequestedBy` (uuid, references users)
- `revisionReason` (text)
- `revisionSuggestions` (jsonb)
- `revisionHistory` (jsonb array)

**C&C Confirmation:**
- `ccConfirmedAt` (timestamp)
- `ccConfirmedBy` (uuid, references users)
- `ccConfirmationNotes` (text)

**PO Tracking:**
- `poNumber` (text)
- `poSubmittedAt` (timestamp)
- `poSubmittedBy` (uuid, references users)
- `poAttachmentUrl` (text)

**PO Confirmation:**
- `poConfirmedAt` (timestamp)
- `poConfirmedBy` (uuid, references users)
- `poConfirmationNotes` (text)

## API Endpoints

### User Endpoints (Protected)

#### `quotes.submitBuyRequest`
Submit a buy request for a quote.

**Input:**
```typescript
{
  quoteId: string; // UUID
}
```

**Transitions:** `sent` → `buy_request_submitted` or `revision_requested` → `buy_request_submitted`

**Notifications:** Sends email to all admin users

---

#### `quotes.submitPO`
Submit a purchase order for a confirmed quote.

**Input:**
```typescript
{
  quoteId: string; // UUID
  poNumber: string;
  poAttachmentUrl?: string; // Optional URL to PO document
}
```

**Transitions:** `cc_confirmed` → `po_submitted`

**Notifications:** Sends email to all admin users

---

### Admin Endpoints (Admin Only)

#### `quotes.startCCReview`
Start C&C review process on a submitted buy request.

**Input:**
```typescript
{
  quoteId: string; // UUID
  ccNotes?: string; // Internal notes for supplier checks
}
```

**Transitions:** `buy_request_submitted` → `under_cc_review`

---

#### `quotes.confirm`
Confirm a quote after C&C review.

**Input:**
```typescript
{
  quoteId: string; // UUID
  ccConfirmationNotes?: string;
}
```

**Transitions:** `under_cc_review` → `cc_confirmed`

**Notifications:** Sends email to quote owner

---

#### `quotes.requestRevision`
Request revisions on a quote with alternative suggestions.

**Input:**
```typescript
{
  quoteId: string; // UUID
  revisionReason: string;
  revisionSuggestions: {
    items: Array<{
      lineItemIndex: number;
      issue: string;
      alternatives?: Array<{
        vintage?: string;
        availability?: string;
        priceAdjustment?: string;
      }>;
      suggestion?: string;
    }>;
    generalNotes?: string;
  };
}
```

**Transitions:** `under_cc_review` → `revision_requested`

**Notifications:** Sends email to quote owner with alternatives

---

#### `quotes.confirmPO`
Confirm a submitted purchase order (final step).

**Input:**
```typescript
{
  quoteId: string; // UUID
  poConfirmationNotes?: string;
}
```

**Transitions:** `po_submitted` → `po_confirmed`

**Notifications:** Sends email to quote owner

---

## Email Notifications

The following email templates need to be created in Loops:

### Template IDs Required

1. **quote-buy-request-submitted** (to admins)
   - Variables: adminName, quoteName, quoteId, customerName, customerEmail, totalUsd, submittedDate, reviewUrl

2. **quote-confirmed-by-cc** (to user)
   - Variables: userName, quoteName, quoteId, totalUsd, ccConfirmationNotes, confirmedDate, quoteUrl

3. **quote-revision-requested** (to user)
   - Variables: userName, quoteName, quoteId, revisionReason, requestedDate, quoteUrl

4. **quote-po-submitted** (to admins)
   - Variables: adminName, quoteName, quoteId, customerName, customerEmail, poNumber, totalUsd, submittedDate, reviewUrl

5. **quote-po-confirmed** (to user)
   - Variables: userName, quoteName, quoteId, poNumber, totalUsd, poConfirmationNotes, confirmedDate, quoteUrl

## UI Components

### QuoteStatusBadge
Displays a colored badge showing the current quote status.

**Usage:**
```tsx
import QuoteStatusBadge from '@/app/_quotes/components/QuoteStatusBadge';

<QuoteStatusBadge status={quote.status} size="md" />
```

**Props:**
- `status` - The quote status
- `size` - Badge size: 'xs' | 'sm' | 'md' (default: 'md')

---

### QuoteWorkflowTimeline
Displays a visual timeline of the quote approval workflow progress.

**Usage:**
```tsx
import QuoteWorkflowTimeline from '@/app/_quotes/components/QuoteWorkflowTimeline';

<QuoteWorkflowTimeline quote={quote} />
```

**Props:**
- `quote` - The full quote object

**Features:**
- Shows completed, current, and upcoming steps
- Displays timestamps for each step
- Shows notes from C&C team
- Displays revision history with submission count

---

## Deployment Steps

### 1. Push Database Migration

Run from the `apps/web` directory:

```bash
cd apps/web
pnpm drizzle-kit push
```

This will apply the schema changes to your Neon database.

### 2. Create Loops Email Templates

Log in to Loops and create the 5 email templates listed above with their respective template IDs and variables.

### 3. Test the Workflow

1. Create a test quote
2. Change status to 'sent'
3. Submit a buy request
4. As an admin, start C&C review
5. Confirm or request revision
6. If confirmed, submit a PO
7. As an admin, confirm the PO

### 4. Deploy to Production

Follow the standard deployment workflow:

```bash
git add .
git commit -m "feat: implement quote approval workflow with C&C review"
git push origin main
```

Monitor the Vercel deployment and confirm success.

---

## Future Enhancements

### Suggested Improvements

1. **Admin Activity Logging**
   - Add activity log entries for all admin actions
   - Track who approved/rejected/revised quotes

2. **File Upload for POs**
   - Implement file upload functionality for PO attachments
   - Store in cloud storage (S3, etc.)

3. **Supplier Management**
   - Add supplier contact management
   - Track which suppliers were contacted for each quote

4. **Automated Reminders**
   - Send reminder emails if quotes pending review for X days
   - Notify users when revisions are outstanding

5. **Bulk Operations**
   - Allow admins to process multiple buy requests at once
   - Batch PO confirmation

6. **Advanced Reporting**
   - Dashboard showing quote approval metrics
   - Average time to confirmation
   - Revision rate statistics

7. **Webhook Integration**
   - Trigger webhooks on status changes
   - Integrate with external order management systems

---

## Technical Architecture

### File Structure

```
apps/web/src/app/_quotes/
├── components/
│   ├── QuoteStatusBadge.tsx
│   └── QuoteWorkflowTimeline.tsx
├── controller/
│   ├── quotesSubmitBuyRequest.ts
│   ├── quotesStartCCReview.ts
│   ├── quotesConfirm.ts
│   ├── quotesRequestRevision.ts
│   ├── quotesSubmitPO.ts
│   └── quotesConfirmPO.ts
├── schemas/
│   ├── submitBuyRequestSchema.ts
│   ├── startCCReviewSchema.ts
│   ├── confirmQuoteSchema.ts
│   ├── requestRevisionSchema.ts
│   ├── submitPOSchema.ts
│   └── confirmPOSchema.ts
├── utils/
│   ├── notifyAdminsOfBuyRequest.ts
│   ├── notifyUserOfQuoteConfirmation.ts
│   ├── notifyUserOfRevisionRequest.ts
│   ├── notifyAdminsOfPOSubmission.ts
│   └── notifyUserOfPOConfirmation.ts
└── router.ts (updated)
```

### Design Patterns

1. **State Machine**: Quote status transitions follow a strict state machine
2. **Optimistic Notifications**: Notifications are sent asynchronously (fire-and-forget)
3. **Audit Trail**: Revision history maintains complete audit trail
4. **Type Safety**: Full TypeScript types inferred from Zod schemas
5. **Separation of Concerns**: Controllers handle business logic, utils handle notifications

---

## Error Handling

All endpoints validate:
- Quote exists and belongs to user (for user endpoints)
- Quote is in the correct status for the transition
- All required fields are provided

Error responses use tRPC error codes:
- `NOT_FOUND` - Quote doesn't exist or doesn't belong to user
- `BAD_REQUEST` - Invalid status transition or missing fields
- `UNAUTHORIZED` - User not authenticated
- `FORBIDDEN` - User doesn't have admin role (for admin endpoints)
- `INTERNAL_SERVER_ERROR` - Database or system errors

---

## Security Considerations

1. **Authorization**: Admin-only endpoints use `adminProcedure` middleware
2. **Ownership**: User endpoints verify quote ownership before mutation
3. **Validation**: All inputs validated with Zod schemas
4. **SQL Injection**: Protected by Drizzle ORM parameterized queries
5. **Rate Limiting**: Consider adding rate limits to prevent abuse

---

## Support

For questions or issues with this implementation, please:
1. Check the code comments in the controller files
2. Review the workflow diagram above
3. Test the endpoints using the tRPC client
4. Contact the development team

---

**Implementation Date:** 2025-10-31
**Author:** Claude Code
**Version:** 1.0.0
