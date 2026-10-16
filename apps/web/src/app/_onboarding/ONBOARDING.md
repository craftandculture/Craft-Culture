# Private Cellar onboarding

How a private collector becomes a cellar member, separate from the B2B
sign-up (`/sign-in` → `/welcome`, unchanged apart from one link).

## Flows

**Joining from the website**
1. `/join` — email → sign-in link (magic link; existing email signs that account in).
2. `/join/application` — Your details (name required) · Verification · Your collection · Membership (accept the Private Cellar Terms, the only acceptance). Verification offers *Complete later*, Your collection *Skip for now*; answers save as they go.
3. *Request my private cellar* → `/join/status` (open sign-up) while Kevin and Laraine review.
4. Admin approves on **Cellar members → Applications** → cellar opens, cellar-ready email, a Team Tasks job per wine source.

**Invited**
1. **Cellar members → Invites → Invite member** creates the account (approved) and the cellar. The link is shown once (Copy / WhatsApp) until the Loops template exists.
2. The member opens `/join?invite=…`, signs in, completes the four steps, presses *Open my private cellar*, sees the *Welcome to your Private Cellar* screen (`CellarOpened`) and enters `/platform/cellar`.

**Billing mode** — `CELLAR_BILLING_MODE` (Vercel env): `invoice` (default) or `card`.
- `invoice`: membership billed through **Zoho Books**. The first action (after the Emirates ID) activates the cellar at once and opens a Team Tasks job, *"<member> — set up monthly membership invoice"*, to create the recurring invoice (AED 600/month; VAT as confirmed by our tax adviser). Extra storage is read off **Cellar members → Storage** and added to that month's invoice. Non-payment: **Pause** on the Storage tab (status `past_due`) stops buy/release/sell until **Resume**; a paused member cannot re-activate themselves.
- `card`: Zoho Billing **Premium** (subscriptions, hosted card pages, dunning) — the flow below. Set only once Billing, the gateway, plan and add-on exist.

**Activation (first action)** — card mode
1. Viewing the cellar and *Available now* is free.
2. Buy, release, offer for sale or a transfer in → `NOT_ACTIVATED` → *Activate your cellar* sheet: Emirates ID if missing, then Zoho Billing's hosted card page.
3. Zoho returns to `/platform/cellar/activated` → subscription confirmed → membership `active` (billing starts) → back to where they were.
4. Failed payment → `past_due` → actions paused → *Update your card*.

Members created before this journey have no `cellar_memberships` row and are **not gated**.

**Transfers follow their shipment** — on **Cellar members → Intakes**, *Link a shipment* ties a transfer (LCB or another cellar) to the inbound logistics shipment carrying it. From then on:
- the stage follows the shipment's status: booked/picked up → *arranging*; in transit to at warehouse → *shipping to the UAE*; delivered → *in your cellar*. It only ever moves forward, and the earlier stages (including *arriving at our UK bond*) stay manual. `advanceShipmentIntakes` is called wherever shipment status is written (status change, Hillebrand sync, receiving, finalise), stores the stage and tells the member once; reads also derive it from the shipment, so a missed call only costs the message;
- the member's card lists the wines on that shipment that are **theirs** (a line's override owner, else the shipment's partner — the receiving rule, so the card shows what lands in their cellar), with mode and ETA. On a consolidated shipment, **set the owner on each collector's lines**; the Intakes row warns when none are assigned.

**Your collection options** (`constants/wineSources.ts`, stored as text): LCB (UK bond) · elsewhere in the UK or Europe · a wine investment platform · multiple locations · already with C&C · buy in the UAE · starting a new collection. Every detail is optional. Vault, merchant and platform names are type-ahead suggestions (`constants/wineHolders.ts`), never a required list. Collection size is chosen as a band and stored as approximate cases (`approx_cases`), so no column was added.

**Terms** — `/legal/private-cellar-terms`, version `2026-10-v5` (recorded on the application, not shown on the page). Accepted once, when the cellar is opened. Activation only confirms the fee: the activation sheet shows a checkbox only when no application with `terms_accepted_at` exists for the cellar. Cold room stated as 12–16°C and humidity 50–80%, matching the Wineted contract; the same range is used on the website.

## Data

`cellar_applications` (one per user) · `cellar_intakes` (one per wine source) ·
`cellar_memberships` (Zoho subscription + status) · `cellar_invites` (token
stored hashed, 14 days) · membership terms on `cellar_release_rates`
(`membership_fee_aed`, `included_cases`, `extra_case_monthly_aed`).

One calculation for the month's charge (`_cellar/utils/monthlyMembershipCharge`)
and one case count (`_cellar/utils/countChargeableCases`), in **case units**:
everything measured in standard 75cl bottles (half bottle ½, magnum 2, double
magnum 4, Imperial 8, other sizes by volume), rounded up to the next six — each
sealed case on its own (up to 6 = ½, 7–12 = 1, 13–18 = 1½…), loose bottles
pooled the same way. This is the single rule terms s.5 states (v3). Sizes are parsed from cl/ml/L
(`bottleMillilitres`) — '150cl' used to be read as 150 ml.

## Rate card (Oct 2026)

Storage priced at London +20% (BBR/Octavian ~£17/12-bottle case/yr):

| | Default |
|---|---|
| Membership | AED 600 / month + VAT where applicable (free-zone zero-rating NOT yet confirmed — terms v3 deliberately make no VAT promise) |
| Included | 20 × 12-bottle cases (240 bottles; a 6-bottle case uses ½) |
| Extra 12-bottle case | AED 8 / month (`extra_case_monthly_aed`) |
| Extra 6-bottle case | AED 4 / month (half, derived) |
| Counted | at month end, from what is held that day |

Example: 40 × 12-bottle cases → AED 600 + 20 × 8 = AED 760 / month.

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
  (quantity-based, priced per **6-bottle unit** = half the Release Rates extra-case price, i.e. AED 4); dunning retries then unpaid;
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
- Zoho is sent 6-bottle units (two per 12-bottle case); the add-on's price must stay at half the Release Rates extra-case price.
- The terms at `/legal/private-cellar-terms` (v5) are a draft for UAE counsel: eligibility/KYC, C&C's importer capacity (s.6), overseas custody (s.9), insurance with liability (s.10, s.15), lien and sale (s.13–14), release routes (s.11) and RAK jurisdiction (s.19). Set an effective date when published.
