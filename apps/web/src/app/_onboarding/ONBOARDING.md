# Private Cellar onboarding

How a private collector becomes a cellar member, separate from the B2B
sign-up (`/sign-in` → `/welcome`, unchanged apart from one link).

## Flows

**Joining from the website**
1. `/join` — email → sign-in link (magic link; existing email signs that account in).
2. `/join/application` — About you (name required) · Identity · Your wine · Membership (accept terms). Every step but the name has *Skip for now*; answers save as they go.
3. Submit → `/join/status` (open sign-up) while Kevin and Laraine review.
4. Admin approves on **Cellar members → Applications** → cellar opens, cellar-ready email, a Team Tasks job per wine source.

**Invited**
1. **Cellar members → Invites → Invite member** creates the account (approved) and the cellar. The link is shown once (Copy / WhatsApp) until the Loops template exists.
2. The member opens `/join?invite=…`, signs in, completes the four steps, and lands in `/platform/cellar`.

**Activation (first action)**
1. Viewing the cellar and *Available now* is free.
2. Buy, release, offer for sale or a transfer in → `NOT_ACTIVATED` → *Activate your cellar* sheet: Emirates ID if missing, then Zoho Billing's hosted card page.
3. Zoho returns to `/platform/cellar/activated` → subscription confirmed → membership `active` (billing starts) → back to where they were.
4. Failed payment → `past_due` → actions paused → *Update your card*.

Members created before this journey have no `cellar_memberships` row and are **not gated**.

## Data

`cellar_applications` (one per user) · `cellar_intakes` (one per wine source) ·
`cellar_memberships` (Zoho subscription + status) · `cellar_invites` (token
stored hashed, 14 days) · membership terms on `cellar_release_rates`
(`membership_fee_aed`, `included_cases`, `extra_case_monthly_aed`).

One calculation for the month's charge (`_cellar/utils/monthlyMembershipCharge`)
and one case count (`_cellar/utils/countChargeableCases`: sealed case = 1,
loose bottles in sixes rounded up, magnum = 2 bottles).

No duplicates: `ensureApplicantCellar` reuses the application's cellar, then a
collector the user already belongs to, then one with the same business email.
A same-NAME collector is only flagged (`duplicate_of_partner_id`) for an admin
to merge.

## Setup still needed

- **Vercel env**: `IDENTITY_ENCRYPTION_KEY` (`openssl rand -base64 32`), then run
  `cellar.admin.encryptIdentityDocuments` once. `ZOHO_BILLING_WEBHOOK_SECRET`.
  Optional: `ZOHO_BILLING_ORGANIZATION_ID`, `ZOHO_BILLING_PLAN_CODE`
  (default `PRIVATE-CELLAR`), `ZOHO_BILLING_EXTRA_CASE_ADDON` (default `CELLAR-EXTRA-CASE`).
- **Zoho**: enable Billing on the Books organisation; connect a UAE card gateway;
  plan `PRIVATE-CELLAR` (monthly, no tax); add-on `CELLAR-EXTRA-CASE`
  (quantity-based, same price as Release Rates); dunning retries then unpaid;
  add `ZohoSubscriptions.fullaccess.all` to the refresh token's scopes;
  webhook → `https://wine.craftculture.xyz/api/webhooks/zoho-billing?secret=<secret>`
  for payment and subscription events.
- **Loops**: fill the ids in `constants/loopsTemplates.ts`. Until then each send
  is skipped and logged. Variables per template:

| Template | Variables |
|---|---|
| invite | name, inviterName, joinUrl, expiresOn |
| applicationReceived | name, statusUrl |
| newApplicationAdmin | applicantName, applicantEmail, phone, missing, wineSources, adminUrl |
| cellarReady | name, cellarUrl |
| applicationDeclined | name, reason |
| transferUpdate | name, source, holderName, stage, cellarUrl |
| finishSettingUp | name, missing, cellarUrl |

## Known limits

- Storage counts cases **as held when pushed**, not the peak in the month — push near month end.
- The extra-case price charged is the Zoho add-on's price; keep it equal to Release Rates.
- The terms at `/legal/private-cellar-terms` are a draft for legal review.
