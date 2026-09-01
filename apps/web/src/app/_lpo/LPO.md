# Client Purchase Orders — Implementation Reference

How a client's LPO becomes a Zoho sales order, and the rules that stop it
becoming the wrong one. Source of truth when working on `_lpo`.

The screen is `/platform/admin/lpo` (Finance → Client LPOs). It reads, reports,
and — on one deliberate press — creates a **draft** sales order in Zoho with any
item codes that order needs.

The manual version of this is: read the PDF, find each wine in the catalogue,
work out which lines are repacks, create those item codes in Zoho by hand, then
key the order line by line. On the reference order that is 43 lines and 13 new
codes, and every step of it is derivable.

---

## The flow

```
upload (.pdf)                    a client's purchase order
  → pdfParse                     text, as the document's own layout flattens it
  → parseLpoText                 blocks parsed in code; totals checked twice

upload (.xlsx/.csv)              a client's replenishment sheet
  → parseReplenishmentSheet      rows that ASK for stock; priced from our book

  → [ person confirms the parse against the stated grand total ]
  → matchLpoLine per line        against OUR catalogue, not the LWIN reference
  → findQuotedPrices             the last published quote to that client
  → [ person settles refusals, removes lines, confirms the price ]
  → adminCreateZohoOrder         item codes, then a DRAFT sales order
```

No model is asked to reproduce line items. The PDF text is parsed
deterministically, which is why 43 lines cost the same as 4 and nothing
truncates.

---

## Core concepts

### The document checks itself, twice

Each line states unit price and line total, and the order states a grand total.
Both are checked (`problem` per line, `computedTotalAed` against
`declaredTotalAed`) and **reported, never repaired** — an order that does not
add up is a question for the client.

A block that cannot be read goes into `skipped` rather than being dropped. A
silent under-read looks exactly like a smaller order, which is the one failure
that would not be noticed.

### Vintage and bottle size are identity, not similarity

The reference order carries eight vintages of Tignanello and six large formats.
Scoring names across vintages would let the 1996 take the 1998's stock, and a
6L Imperial reads almost identically to its 75cl sibling. Both are hard filters
in `matchLpoLine`; only the name is scored, and only within them.

### Availability is summed across every pack

A wine sits in several rows — a 3-pack, a 6-pack, loose bottles — and they are
one wine on a shelf. `matchLpoLine` sums bottles across every row sharing
wine + vintage + size, and returns those rows.

Reading stock off the single matched row reported seven lines of the reference
order unfulfillable while every bottle was in the building, filed under a
different pack. This is the same fault as the pick-list one described in
`_wms/WMS.md`; it recurs because the row you matched is the obvious thing to
read.

### Packs of one wine are not rivals

The confidence margin is measured against the nearest **different** wine. Two
packs of the same wine scoring alike is agreement, not ambiguity, and treating
it as ambiguity refuses matches that are certain.

### In transit is not on the shelf

`availableBottles` counts stock; `inboundBottles` is reported separately.
Promising in-transit stock as picked is how an order is short on the day.

---

## Guards that must not be relaxed

| Guard | Where | What it protects |
|---|---|---|
| bottle size must be 187ml–15,000ml | `parseLpoText` | a magnum read as 1.5ml |
| vintage must be 1900–2100 or NV | `parseLpoText` | a stray figure becoming an order line |
| unparsed blocks listed, not dropped | `parseLpoText` | a short read passing as a short order |
| line arithmetic reported, not corrected | `parseLpoText` | quietly rounding away a client's error |
| vintage equality | `matchLpoLine` | one vintage taking another's stock |
| bottle-size equality | `matchLpoLine` | a 6L filled from 75cl |
| availability summed across packs | `matchLpoLine` | seven false "no stock" lines |
| margin measured against a different wine | `matchLpoLine` | certain matches refused as ambiguous |
| `MIN_SCORE` / `MIN_MARGIN` | `matchLpoLine` | "Opus One" matching "Opus One Overture" |

---

## The reference order

`~/Downloads/Craft & Culture - Consignment Items - LPOCON24082026 - 24-08-2026.pdf`
(C D General Trading). Not committed — it carries the client's prices. A correct
run reads:

- **43 lines · 113 bottles · AED 125,700**, computed equal to declared
- nothing skipped, no line arithmetic disputed
- formats 75cl, 1.5L, 3L, 6L
- **43 of 43 matched**, none refused, no score below 0.75
- eight Tignanello vintages to eight distinct LWINs
- **19 lines take the last bottles** of their wine
- 13 codes Zoho does not yet have; 19 lines are repacks

Replay it after touching extraction or matching. It has already caught the
availability fault described above.

## Creating the order

`adminCreateZohoOrder`. Five rules, each of which cost a wrong sales order to
learn:

- **The SKU is the pack being SOLD, not the stock it comes from.** `match.lwin18`
  is the case we hold — a twelve of Figeac. Selling three bottles of it is
  `…-03-…`. Looking up the held code found the twelve-pack every time: an exact
  match, nothing created, three bottles booked against a case of twelve, and a
  document that read perfectly.
- **Zoho enforces unique item NAMES, not SKUs** — the opposite of the
  assumption. Two packs of one wine cannot share a name, so the pack goes in the
  name as well: `… 1995 (3x75cl)`.
- **The order states its currency.** The client's PO is in AED and they are
  billed in USD; omitting `currency_code` let Zoho use the customer's default
  and printed AED figures as $125,700 against an order worth $34,228. The peg
  comes from `PEGGED`, and the note on the order records the original and the
  rate.
- **Dates are normalised** to `yyyy-MM-dd`; an unreadable one is omitted rather
  than blocking the order.
- **The customer must already exist.** Names are squashed to letters and
  stripped of registered suffixes, so "CD General L.L.C" finds "C D General
  Trading L.L.C". Two customers matching equally well **refuses** rather than
  picking one — Zoho holds duplicates, and half a client's orders under each is
  a reconciliation nobody would enjoy.

It is a **draft**, deliberately: built from a parse, a set of matches and a
price comparison, each a judgement that can be wrong.

Lines that cannot be identified, or that a person removes, are left off and
**named on the order** — an order quietly containing fewer lines than the
document it came from is the hardest kind to reconcile later.

## Known gaps

- **The client's own wording is not remembered.** A name settled by hand today
  is scored from scratch on the next order. Confirmed matches should be stored
  as aliases.
- **HS code and origin come from the shipment**, so a wine never imported has
  neither and its Zoho item is created a customs field short. Flagged before the
  order is created; the fix is the shipment's Items tab.
- **A replenishment sheet guesses the pack.** "Send 4 case" does not say of
  what, so it reads as six bottles; the preview shows what we hold beside it.
- **No repair for items already created** without their customs fields.
