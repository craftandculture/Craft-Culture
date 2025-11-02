# Loops Templates - Quick Reference

## Templates to Create (7 total)

Copy these IDs exactly - they are case-sensitive!

---

### 1. User Account Approved
**ID**: `user-approved`
**Variables**: `userName`, `platformUrl`
**Subject**: Welcome to Craft & Culture! Your account is approved

---

### 2. Quote Review Started
**ID**: `quote-review-started`
**Variables**: `userName`, `quoteName`, `quoteId`, `reviewDate`, `quoteUrl`
**Subject**: Your quote "{{quoteName}}" is being reviewed

---

### 3. Quote Confirmed
**ID**: `quote-confirmed-by-cc`
**Variables**: `userName`, `quoteName`, `quoteId`, `totalUsd`, `ccConfirmationNotes`, `confirmedDate`, `quoteUrl`
**Subject**: Your quote "{{quoteName}}" has been approved!

---

### 4. Revision Requested
**ID**: `quote-revision-requested`
**Variables**: `userName`, `quoteName`, `quoteId`, `revisionReason`, `requestDate`, `quoteUrl`
**Subject**: Changes requested for "{{quoteName}}"

---

### 5. Buy Request Submitted (Admin)
**ID**: `quote-buy-request-submitted`
**Variables**: `adminName`, `quoteName`, `quoteId`, `customerName`, `customerEmail`, `totalUsd`, `submittedDate`, `reviewUrl`
**Subject**: New Order Request: {{quoteName}} - ${{totalUsd}}

---

### 6. PO Submitted (Admin)
**ID**: `quote-po-submitted`
**Variables**: `adminName`, `quoteName`, `quoteId`, `customerName`, `customerEmail`, `poNumber`, `totalUsd`, `submittedDate`, `reviewUrl`
**Subject**: PO Submitted: {{poNumber}} - ${{totalUsd}}

---

### 7. PO Confirmed
**ID**: `quote-po-confirmed`
**Variables**: `userName`, `quoteName`, `quoteId`, `poNumber`, `totalUsd`, `confirmationNotes`, `confirmedDate`, `deliveryLeadTime`, `quoteUrl`
**Subject**: Order Confirmed: {{poNumber}}

---

## Quick Setup Steps

1. Go to https://loops.so → Transactional
2. Click "Create transactional email"
3. Enter the **ID** exactly as shown above
4. Add all the **Variables** listed
5. Write your email content using {{variableName}} syntax
6. Test with sample data
7. Publish
8. Repeat for all 7 templates

---

## Already Created ✅

These are already set up in your Loops account:
- Magic Link: `cmglxdfzwzzscz00inq1dm56c`
- New User Signup (Admin): `cmhagixdf7c3z160h3aaga4xp`

---

## Test After Setup

1. **User Flow**:
   - Admin approves user → User gets "user-approved" email
   - User submits quote → Admin gets "quote-buy-request-submitted" email
   - Admin starts review → User gets "quote-review-started" email
   - Admin confirms → User gets "quote-confirmed-by-cc" email

2. **PO Flow**:
   - User submits PO → Admin gets "quote-po-submitted" email
   - Admin confirms PO → User gets "quote-po-confirmed" email

3. **Revision Flow**:
   - Admin requests revision → User gets "quote-revision-requested" email
