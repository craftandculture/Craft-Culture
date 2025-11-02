# Loops Email Setup Guide

This guide explains how to set up transactional emails in Loops.so for the Craft & Culture platform.

## Prerequisites

1. **Loops Account**: Sign up at https://loops.so
2. **API Key**: Get your API key from Loops dashboard → Settings → API Keys
3. **Environment Variable**: Add `LOOPS_API_KEY=your_key_here` to your `.env` file

## Overview

The application uses Loops for:
- Magic link authentication emails
- User approval notifications
- Quote workflow notifications (review, confirmation, PO submission)
- Admin notifications for new users and quote requests

## Required Transactional Email Templates

You need to create the following transactional email templates in your Loops dashboard. Go to **Loops Dashboard → Transactional** to create each template.

### 1. Magic Link Email ✅ (Already Created)

**Transactional ID**: `cmglxdfzwzzscz00inq1dm56c`
**Purpose**: Send magic link for passwordless authentication
**Trigger**: When user clicks "Sign In" button

**Data Variables**:
- `{{magicLink}}` - The authentication URL user clicks to sign in

**Example Email Subject**: `Sign in to Craft & Culture`

**Example Email Body**:
```
Hi there,

Click the link below to sign in to your Craft & Culture account:

{{magicLink}}

This link expires in 10 minutes.

If you didn't request this, you can safely ignore this email.

---
Craft & Culture
```

---

### 2. New User Signup (Admin Notification) ✅ (Already Created)

**Transactional ID**: `cmhagixdf7c3z160h3aaga4xp`
**Purpose**: Notify admins when a new user signs up
**Trigger**: When new user completes signup

**Data Variables**:
- `{{adminName}}` - Name of the admin receiving notification
- `{{userName}}` - Name of new user who signed up
- `{{userEmail}}` - Email of new user
- `{{userType}}` - Customer type (B2B or B2C)
- `{{signupDate}}` - Date user signed up
- `{{approvalUrl}}` - URL to approve/reject user

**Example Email Subject**: `New User Signup: {{userName}}`

**Example Email Body**:
```
Hi {{adminName}},

A new user has signed up and is waiting for approval:

Name: {{userName}}
Email: {{userEmail}}
Customer Type: {{userType}}
Signup Date: {{signupDate}}

Review and approve their account:
{{approvalUrl}}

---
Craft & Culture Admin
```

---

### 3. User Account Approved ⚠️ (Needs Creation)

**Transactional ID**: `user-approved`
**Purpose**: Notify user when their account is approved
**Trigger**: When admin approves a user account

**Data Variables**:
- `{{userName}}` - Name of approved user
- `{{platformUrl}}` - URL to platform

**Suggested Email Subject**: `Welcome to Craft & Culture! Your account is approved`

**Suggested Email Body**:
```
Hi {{userName}},

Great news! Your Craft & Culture account has been approved.

You can now access the platform and start creating quotes:
{{platformUrl}}

If you have any questions, feel free to reach out to our team.

Welcome aboard!

---
Craft & Culture Team
```

---

### 4. Quote Review Started ✅ (Created)

**Transactional ID**: `cmhexu2adkscr1y0ia83rd76j`
**Purpose**: Notify customer when C&C starts reviewing their quote
**Trigger**: When admin clicks "Start Review" on a quote

**Data Variables**:
- `{{userName}}` - Customer name
- `{{quoteName}}` - Name of the quote
- `{{quoteId}}` - Quote ID
- `{{reviewDate}}` - Date review started
- `{{quoteUrl}}` - URL to view quote

**Suggested Email Subject**: `Your quote "{{quoteName}}" is being reviewed`

**Suggested Email Body**:
```
Hi {{userName}},

We've started reviewing your quote request:

Quote: {{quoteName}}
ID: {{quoteId}}
Started: {{reviewDate}}

Our team is checking product availability and pricing. We'll update you once the review is complete.

View your quote:
{{quoteUrl}}

---
Craft & Culture Team
```

---

### 5. Quote Confirmed by C&C ⚠️ (Needs Creation)

**Transactional ID**: `quote-confirmed-by-cc`
**Purpose**: Notify customer when C&C confirms their quote
**Trigger**: When admin clicks "Approve Quote"

**Data Variables**:
- `{{userName}}` - Customer name
- `{{quoteName}}` - Name of the quote
- `{{quoteId}}` - Quote ID
- `{{totalUsd}}` - Total amount in USD
- `{{ccConfirmationNotes}}` - Notes from C&C team
- `{{confirmedDate}}` - Date confirmed
- `{{quoteUrl}}` - URL to view quote

**Suggested Email Subject**: `Your quote "{{quoteName}}" has been approved!`

**Suggested Email Body**:
```
Hi {{userName}},

Great news! Your quote has been approved:

Quote: {{quoteName}}
ID: {{quoteId}}
Total: ${{totalUsd}}
Confirmed: {{confirmedDate}}

Notes from our team:
{{ccConfirmationNotes}}

Next steps: Submit your PO (Purchase Order) to proceed with the order.

View and submit PO:
{{quoteUrl}}

---
Craft & Culture Team
```

---

### 6. Revision Requested ⚠️ (Needs Creation)

**Transactional ID**: `quote-revision-requested`
**Purpose**: Notify customer when C&C requests changes to quote
**Trigger**: When admin clicks "Request Changes"

**Data Variables**:
- `{{userName}}` - Customer name
- `{{quoteName}}` - Name of the quote
- `{{quoteId}}` - Quote ID
- `{{revisionReason}}` - Explanation of what needs to change
- `{{requestDate}}` - Date revision requested
- `{{quoteUrl}}` - URL to view and edit quote

**Suggested Email Subject**: `Changes requested for "{{quoteName}}"`

**Suggested Email Body**:
```
Hi {{userName}},

We've reviewed your quote "{{quoteName}}" and need some changes:

Quote ID: {{quoteId}}
Requested: {{requestDate}}

What needs to change:
{{revisionReason}}

Please review and resubmit your quote:
{{quoteUrl}}

If you have questions, reply to this email.

---
Craft & Culture Team
```

---

### 7. Buy Request Submitted (Admin Notification) ⚠️ (Needs Creation)

**Transactional ID**: `quote-buy-request-submitted`
**Purpose**: Notify admins when customer submits an order request
**Trigger**: When customer clicks "Place Order Request"

**Data Variables**:
- `{{adminName}}` - Admin name
- `{{quoteName}}` - Quote name
- `{{quoteId}}` - Quote ID
- `{{customerName}}` - Customer name
- `{{customerEmail}}` - Customer email
- `{{totalUsd}}` - Total amount
- `{{submittedDate}}` - Submission date
- `{{reviewUrl}}` - URL to review quote

**Suggested Email Subject**: `New Order Request: {{quoteName}} - ${{totalUsd}}`

**Suggested Email Body**:
```
Hi {{adminName}},

A new order request has been submitted:

Quote: {{quoteName}}
ID: {{quoteId}}
Customer: {{customerName}} ({{customerEmail}})
Total: ${{totalUsd}}
Submitted: {{submittedDate}}

Review and start processing:
{{reviewUrl}}

---
Craft & Culture Admin
```

---

### 8. PO Submitted (Admin Notification) ⚠️ (Needs Creation)

**Transactional ID**: `quote-po-submitted`
**Purpose**: Notify admins when customer submits a Purchase Order
**Trigger**: When customer uploads and submits PO

**Data Variables**:
- `{{adminName}}` - Admin name
- `{{quoteName}}` - Quote name
- `{{quoteId}}` - Quote ID
- `{{customerName}}` - Customer name
- `{{customerEmail}}` - Customer email
- `{{poNumber}}` - PO number
- `{{totalUsd}}` - Total amount
- `{{submittedDate}}` - Submission date
- `{{reviewUrl}}` - URL to review PO

**Suggested Email Subject**: `PO Submitted: {{poNumber}} - ${{totalUsd}}`

**Suggested Email Body**:
```
Hi {{adminName}},

A Purchase Order has been submitted:

PO Number: {{poNumber}}
Quote: {{quoteName}}
ID: {{quoteId}}
Customer: {{customerName}} ({{customerEmail}})
Total: ${{totalUsd}}
Submitted: {{submittedDate}}

Review PO and confirm:
{{reviewUrl}}

---
Craft & Culture Admin
```

---

### 9. PO Confirmed ⚠️ (Needs Creation)

**Transactional ID**: `quote-po-confirmed`
**Purpose**: Notify customer when C&C confirms their PO
**Trigger**: When admin clicks "Confirm Purchase Order"

**Data Variables**:
- `{{userName}}` - Customer name
- `{{quoteName}}` - Quote name
- `{{quoteId}}` - Quote ID
- `{{poNumber}}` - PO number
- `{{totalUsd}}` - Total amount
- `{{confirmationNotes}}` - Notes from C&C
- `{{confirmedDate}}` - Confirmation date
- `{{deliveryLeadTime}}` - Expected delivery timeframe
- `{{quoteUrl}}` - URL to view order

**Suggested Email Subject**: `Order Confirmed: {{poNumber}}`

**Suggested Email Body**:
```
Hi {{userName}},

Your order has been confirmed and is now being processed!

PO Number: {{poNumber}}
Quote: {{quoteName}}
ID: {{quoteId}}
Total: ${{totalUsd}}
Confirmed: {{confirmedDate}}
Expected Delivery: {{deliveryLeadTime}}

Notes from our team:
{{confirmationNotes}}

View your order:
{{quoteUrl}}

We'll keep you updated on the delivery status.

---
Craft & Culture Team
```

---

## Setup Instructions

### Step 1: Create Templates in Loops

1. Log in to your Loops dashboard
2. Go to **Transactional** in the sidebar
3. Click **Create transactional email**
4. For each template above:
   - Enter the **Transactional ID** exactly as shown (case-sensitive!)
   - Add a descriptive name (for your reference)
   - Design the email using Loops editor
   - Add the data variables using `{{variableName}}` syntax
   - Test the template with sample data
   - Publish the template

### Step 2: Set Environment Variable

Add your Loops API key to your environment:

```bash
# In .env file
LOOPS_API_KEY=your_loops_api_key_here
```

### Step 3: Verify Configuration

Check that your `server.config.ts` has the correct Loops API key:

```typescript
loopsApiKey: process.env.LOOPS_API_KEY || '',
```

### Step 4: Test Emails

**Development Mode**:
- Emails are logged to console (mock client)
- Check terminal output when triggering email events

**Production/Preview Mode**:
- Real emails are sent via Loops
- Test each workflow:
  1. User signup → Check admin receives notification
  2. Admin approves user → Check user receives approval email
  3. User submits quote → Check admin receives notification
  4. Admin reviews quote → Check customer receives update
  5. And so on for all workflows

---

## Troubleshooting

### Emails Not Sending

1. **Check API Key**: Verify `LOOPS_API_KEY` is set correctly
2. **Check Environment**: Make sure `NODE_ENV !== 'development'` for real emails
3. **Check Loops Dashboard**: Look for failed sends in Loops → Transactional → Activity
4. **Check Template IDs**: Ensure transactional IDs match exactly (case-sensitive)
5. **Check Data Variables**: Ensure all required variables are provided

### Template Not Found Error

```
Error: Template with ID 'quote-review-started' not found
```

**Solution**: Create the template in Loops dashboard with the exact ID

### Missing Data Variables

```
Error: Missing required variable 'userName'
```

**Solution**: Check the notification function is passing all required dataVariables

### Development Testing

To test real email sends in development:

1. Temporarily change `serverConfig.env` to `'production'` in `loops/client.ts`
2. Make sure `LOOPS_API_KEY` is set
3. Test the email trigger
4. Change back to `'development'` when done

---

## Template Checklist

Use this checklist to track which templates you've created:

- [x] `cmglxdfzwzzscz00inq1dm56c` - Magic Link Email
- [x] `cmhagixdf7c3z160h3aaga4xp` - New User Signup (Admin)
- [ ] `user-approved` - User Account Approved
- [x] `cmhexu2adkscr1y0ia83rd76j` - Quote Review Started
- [ ] `quote-confirmed-by-cc` - Quote Confirmed
- [ ] `quote-revision-requested` - Revision Requested
- [ ] `quote-buy-request-submitted` - Buy Request Submitted (Admin)
- [ ] `quote-po-submitted` - PO Submitted (Admin)
- [ ] `quote-po-confirmed` - PO Confirmed

---

## Need Help?

If you run into issues:

1. Check Loops documentation: https://loops.so/docs
2. Review Loops API logs in dashboard
3. Check application logs for error messages
4. Verify all template IDs match exactly

---

**Last Updated**: January 2025
